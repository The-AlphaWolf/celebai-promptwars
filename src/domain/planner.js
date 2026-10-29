/**
 * Deterministic planning engine.
 *
 * Turns an intake (event type, date, guests, budget, venue, theme, notes)
 * into a complete plan, and analyzes or adjusts existing plans. Pure
 * functions only: `today` is always passed in so results are reproducible
 * and testable. The AI layer may enrich wording and ideas, but every number
 * shown in the dashboard comes from (or is reconciled by) this module.
 */
import { EVENT_PROFILES, CONDITIONAL_ITEMS, OUTDOOR_KEYWORDS, LARGE_CROWD_THRESHOLD } from './profiles.js';
import { normalizeIntake } from './planSchema.js';
import { MS_PER_DAY } from './constants.js';

const CONTINGENCY_KEY = 'contingency';
const CONTINGENCY_PATTERN = /contingenc|reserve|buffer/i;
const PER_GUEST_PATTERN = /cater|food|drink|bar|water/i;
const BOOKED_STATUSES = new Set(['Booked', 'Deposit Paid']);

const roundTo50 = (value) => Math.round(value / 50) * 50;
/** Allocation granularity: $50 steps, $10 for small budgets. Floors, so lines never exceed the spendable amount. */
const floorToStep = (value, budget) => {
  const step = budget >= 5000 ? 50 : 10;
  return Math.floor(value / step) * step;
};
const formatUsd = (value) => `$${Math.round(value).toLocaleString('en-US')}`;

// ---------- dates ----------

/** @param {Date} date */
export function toIsoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function addDays(isoDate, days) {
  return toIsoDate(new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * MS_PER_DAY));
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / MS_PER_DAY);
}

export function phaseLabel(daysBefore) {
  if (daysBefore <= 0) return 'Event day';
  if (daysBefore === 1) return '1 day before';
  if (daysBefore < 14) return `${daysBefore} days before`;
  if (daysBefore < 60) return `${Math.round(daysBefore / 7)} weeks before`;
  return `${Math.round(daysBefore / 30)} months before`;
}

// ---------- context decisions ----------

export function getProfile(eventType) {
  return EVENT_PROFILES[eventType] || EVENT_PROFILES.wedding;
}

/** Uses the explicit setting, otherwise infers outdoor venues from the free text. */
export function detectSetting(intake) {
  if (intake.setting) return intake.setting;
  const text = `${intake.location} ${intake.theme} ${intake.notes}`.toLowerCase();
  return OUTDOOR_KEYWORDS.some((word) => text.includes(word)) ? 'outdoor' : 'indoor';
}

/**
 * Reserve held back for surprises: 10% base, more for weather exposure and
 * for rushed timelines, capped at 20%.
 */
export function contingencyRate({ setting, daysUntil, recommendedLeadDays }) {
  let rate = 0.1;
  if (setting === 'outdoor') rate += 0.05;
  if (setting === 'mixed') rate += 0.03;
  if (daysUntil < recommendedLeadDays / 2) rate += 0.05;
  return Math.min(rate, 0.2);
}

/**
 * Splits the budget into category lines that always sum exactly to the budget.
 * Headcount-driven lines get a bigger share when money per guest is tight and
 * a smaller one when it is generous.
 */
export function allocateBudget(intake, { setting, daysUntil }) {
  const profile = getProfile(intake.eventType);
  const lines = profile.allocation.map((line) => ({ ...line }));
  if (setting !== 'indoor') {
    const weather = CONDITIONAL_ITEMS.outdoor.budget;
    lines.push({ ...weather, share: setting === 'mixed' ? weather.share / 2 : weather.share });
  }
  if (intake.guestCount >= LARGE_CROWD_THRESHOLD) lines.push({ ...CONDITIONAL_ITEMS.largeCrowd.budget });

  const perGuest = intake.budget / intake.guestCount;
  const comfortablePerGuest = profile.minPerGuest * 2;
  const headcountFactor = Math.min(1.5, Math.max(0.75, comfortablePerGuest / perGuest));
  for (const line of lines) {
    if (line.perGuest) line.share *= headcountFactor;
  }

  const reserve = contingencyRate({ setting, daysUntil, recommendedLeadDays: profile.recommendedLeadDays });
  const totalShare = lines.reduce((sum, line) => sum + line.share, 0);
  const spendable = intake.budget * (1 - reserve);

  const items = lines.map((line, index) => ({
    id: `b${index + 1}`,
    key: line.key,
    category: line.category,
    allocated: floorToStep((spendable * line.share) / totalShare, intake.budget),
    spent: 0,
    color: line.color,
  }));
  const allocated = items.reduce((sum, item) => sum + item.allocated, 0);
  items.push({
    id: `b${items.length + 1}`,
    key: CONTINGENCY_KEY,
    category: 'Contingency Reserve',
    allocated: intake.budget - allocated,
    spent: 0,
    color: '#94A3B8',
  });
  return items;
}

/**
 * Schedules milestones backwards from the event date. When there is less
 * time than the schedule needs, every lead time is compressed proportionally.
 */
export function buildTimeline(intake, { eventDate, daysUntil }) {
  const profile = getProfile(intake.eventType);
  const longestLead = Math.max(...profile.milestones.map((m) => m.daysBefore));
  const compressed = daysUntil < longestLead;
  const available = Math.max(daysUntil, 0);

  return profile.milestones.map((milestone, index) => {
    const offset = compressed ? Math.round((milestone.daysBefore * available) / longestLead) : milestone.daysBefore;
    const dueDate = addDays(eventDate, -offset);
    const squeezed = compressed && milestone.daysBefore > 0;
    return {
      id: `t${index + 1}`,
      phase: phaseLabel(offset),
      title: milestone.title,
      time: milestone.time || dueDate,
      dueDate,
      status: 'upcoming',
      description: squeezed
        ? `${milestone.description} Compressed: normally done ${phaseLabel(milestone.daysBefore)}.`
        : milestone.description,
    };
  });
}

// Word-anchored so "minutes" or "donuts" do not read as a nut allergy.
const DIETARY_NEEDS = [
  [/\bvegan/i, 'vegan'],
  [/\bvegetarian/i, 'vegetarian'],
  [/\bgluten/i, 'gluten-free'],
  [/\bhalal/i, 'halal'],
  [/\bkosher/i, 'kosher'],
  [/\b(dairy|lactose)/i, 'dairy-free'],
  [/\b(pea)?nuts?\b/i, 'nut-free'],
  [/\ballerg/i, 'other allergies'],
];

export function buildVendors(intake, { budgetItems, setting, daysUntil }) {
  const profile = getProfile(intake.eventType);
  const specs = [...profile.vendors];
  if (setting !== 'indoor') specs.push(CONDITIONAL_ITEMS.outdoor.vendor);
  if (intake.guestCount >= LARGE_CROWD_THRESHOLD) specs.push(CONDITIONAL_ITEMS.largeCrowd.vendor);
  if (/\b(kids?|children|family)\b/i.test(intake.notes)) {
    specs.push({ budgetKey: null, category: 'Activities', name: 'Kids entertainer or supervised play area', leadDays: 30, priority: 'Medium' });
  }

  const dietary = DIETARY_NEEDS.filter(([pattern]) => pattern.test(intake.notes)).map(([, label]) => label);

  return specs.map((spec, index) => {
    const line = budgetItems.find((item) => item.key === spec.budgetKey);
    const urgent = daysUntil < spec.leadDays;
    const notes = [`Usually booked about ${spec.leadDays} days ahead.`];
    if (urgent) notes.push('Inside the usual lead time: contact this week.');
    if (spec.budgetKey === 'catering') {
      notes.push(`Quote for ${intake.guestCount} guests (about ${formatUsd((line?.allocated || 0) / intake.guestCount)} per head).`);
      if (dietary.length) notes.push(`Confirm options for: ${dietary.join(', ')}.`);
    }
    if (!line) notes.push('Fund from the contingency reserve.');
    return {
      id: `v${index + 1}`,
      category: spec.category,
      name: spec.name,
      contact: '',
      cost: line ? line.allocated : 0,
      leadDays: spec.leadDays,
      status: 'To Research',
      priority: urgent ? 'Critical' : spec.priority,
      notes: notes.join(' '),
    };
  });
}

/** Ranks the idea library by keyword overlap with the theme, notes, venue and title. */
export function pickIdeas(intake, { setting, count = 4, excludeTitles = [] } = {}) {
  const profile = getProfile(intake.eventType);
  const text = `${intake.title} ${intake.theme} ${intake.notes} ${intake.location} ${setting || ''}`.toLowerCase();
  const excluded = new Set(excludeTitles.map((title) => title.toLowerCase()));
  // The library only knows fixed tags, so a free-text theme also gets one idea built from its own words.
  const themeIdea = intake.theme && {
    category: 'Theme',
    title: `Theme thread: ${intake.theme}`,
    description: `Carry "${intake.theme}" through the invitations, signage, table names and one signature dish or drink so every guest touchpoint feels part of it.`,
  };
  const library = profile.ideas
    .map((idea, index) => ({ idea, index, score: idea.tags.filter((tag) => text.includes(tag)).length }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ idea }) => idea);
  const ordered = themeIdea ? [...library.slice(0, count - 1), themeIdea, ...library.slice(count - 1)] : library;
  return ordered
    .filter((idea) => !excluded.has(idea.title.toLowerCase()))
    .slice(0, count)
    .map((idea, i) => ({ id: `c${i + 1}`, category: idea.category, title: idea.title, description: idea.description }));
}

// ---------- plan generation ----------

/**
 * Builds a complete plan from raw intake data.
 * @param {object} rawIntake untrusted form data
 * @param {Date} [today]
 */
export function generatePlan(rawIntake, today = new Date()) {
  const intake = normalizeIntake(rawIntake);
  const profile = getProfile(intake.eventType);
  const todayIso = toIsoDate(today);
  const eventDate = intake.date || addDays(todayIso, profile.recommendedLeadDays);
  const daysUntil = daysBetween(todayIso, eventDate);
  const setting = detectSetting(intake);
  const context = { eventDate, daysUntil, setting };

  const budgetItems = allocateBudget(intake, context);
  const contingency = budgetItems.find((item) => item.key === CONTINGENCY_KEY);
  const dateNote = intake.date ? '' : ` No date given, so the plan assumes ${eventDate} (${profile.recommendedLeadDays} days out).`;

  return {
    title: intake.title || `${profile.label} plan`,
    eventType: intake.eventType,
    date: eventDate,
    guestCount: intake.guestCount,
    budget: intake.budget,
    currency: '$',
    location: intake.location,
    setting,
    theme: intake.theme,
    notes: intake.notes,
    summary:
      `${profile.label} for ${intake.guestCount} guests on a ${formatUsd(intake.budget)} budget ` +
      `(${formatUsd(intake.budget / intake.guestCount)} per guest), ${setting} setting, ${daysUntil} days away. ` +
      `${formatUsd(contingency.allocated)} is held as contingency.${dateNote}`,
    budgetItems,
    timeline: buildTimeline(intake, context),
    vendors: buildVendors(intake, { budgetItems, setting, daysUntil }),
    creativeIdeas: pickIdeas(intake, { setting }),
  };
}

// ---------- analysis ----------

export function findContingency(budgetItems) {
  return budgetItems.find((item) => item.key === CONTINGENCY_KEY) || budgetItems.find((item) => CONTINGENCY_PATTERN.test(item.category));
}

/** Totals, per-category share of the budget and the reserve. */
export function summarizeBudget(plan) {
  const items = plan.budgetItems || [];
  const budget = plan.budget || 0;
  const allocated = items.reduce((sum, item) => sum + (Number(item.allocated) || 0), 0);
  const spent = items.reduce((sum, item) => sum + (Number(item.spent) || 0), 0);
  const contingency = findContingency(items);
  return {
    budget,
    allocated,
    spent,
    remaining: budget - allocated,
    allocationPct: budget > 0 ? Math.round((allocated / budget) * 100) : 0,
    contingency: contingency ? contingency.allocated : 0,
    items: items.map((item) => ({ ...item, percentage: budget > 0 ? Math.round((item.allocated / budget) * 100) : 0 })),
  };
}

/**
 * Checks a plan against the event profile and the calendar and returns
 * prioritized insights. `level` is 'warning' | 'info' | 'success'.
 */
export function analyzePlan(plan, today = new Date()) {
  const profile = getProfile(plan.eventType);
  const todayIso = toIsoDate(today);
  const daysUntil = plan.date ? daysBetween(todayIso, plan.date) : null;
  const totals = summarizeBudget(plan);
  const insights = [];
  const warn = (message) => insights.push({ level: 'warning', message });

  if (daysUntil !== null && daysUntil < 0) {
    insights.push({ level: 'info', message: `The event date passed ${-daysUntil} days ago.` });
  }
  if (totals.remaining < 0) warn(`Allocations exceed the budget by ${formatUsd(-totals.remaining)}. Trim a category or raise the budget.`);

  const perGuest = plan.guestCount ? plan.budget / plan.guestCount : 0;
  if (perGuest && perGuest < profile.minPerGuest) {
    warn(`${formatUsd(perGuest)} per guest is below the ~${formatUsd(profile.minPerGuest)} typically needed for a ${profile.label.toLowerCase()}. Reduce guests or raise the budget.`);
  }
  if (plan.budget > 0 && totals.contingency / plan.budget < 0.08) {
    warn(`Contingency is ${Math.round((totals.contingency / plan.budget) * 100)}% of the budget; keep at least 8–10% for surprises.`);
  }
  if (daysUntil !== null && daysUntil >= 0 && daysUntil < profile.recommendedLeadDays) {
    warn(`${daysUntil} days to go versus a typical ${profile.recommendedLeadDays}-day lead time. Book critical vendors first.`);
  }

  const lateVendors = daysUntil === null ? [] : (plan.vendors || []).filter(
    (vendor) => vendor.leadDays && !BOOKED_STATUSES.has(vendor.status) && daysUntil < vendor.leadDays,
  );
  if (lateVendors.length) {
    warn(`Book now (inside usual lead time): ${lateVendors.slice(0, 3).map((v) => v.name).join(', ')}${lateVendors.length > 3 ? ` and ${lateVendors.length - 3} more` : ''}.`);
  }

  const overdue = (plan.timeline || []).filter((m) => m.dueDate && m.dueDate < todayIso && m.status !== 'completed');
  if (overdue.length) warn(`${overdue.length} milestone${overdue.length > 1 ? 's are' : ' is'} overdue: ${overdue[0].title}${overdue.length > 1 ? ', …' : ''}.`);

  const overspent = totals.items.filter((item) => item.spent > item.allocated);
  if (overspent.length) warn(`Spending is over allocation in ${overspent.map((item) => item.category).join(', ')}.`);

  if (!insights.some((insight) => insight.level === 'warning')) {
    insights.push({ level: 'success', message: 'Budget, schedule and vendors are on track.' });
  }
  return { daysUntil, insights };
}

// ---------- adjustments (used by the offline assistant and AI reconciliation) ----------

/** Makes allocations sum to the budget by moving any difference into the contingency line. */
export function reconcileBudget(plan) {
  const items = plan.budgetItems.map((item) => ({ ...item }));
  let reserve = findContingency(items);
  if (!reserve) {
    reserve = { id: 'b_reserve', key: CONTINGENCY_KEY, category: 'Contingency Reserve', allocated: 0, spent: 0, color: '#94A3B8' };
    items.push(reserve);
  }
  const others = items.filter((item) => item !== reserve).reduce((sum, item) => sum + item.allocated, 0);
  reserve.allocated = Math.max(0, plan.budget - others);
  return { ...plan, budgetItems: items };
}

/** Scales every allocation to a new total budget. */
export function rescaleBudget(plan, newBudget) {
  const factor = newBudget / plan.budget;
  return reconcileBudget({
    ...plan,
    budget: newBudget,
    budgetItems: plan.budgetItems.map((item) => ({ ...item, allocated: roundTo50(item.allocated * factor) })),
    vendors: plan.vendors.map((vendor) => ({ ...vendor, cost: roundTo50(vendor.cost * factor) })),
  });
}

/**
 * Changes the headcount. Per-guest categories scale with it and the difference
 * comes out of (or goes into) the contingency; the total budget is unchanged,
 * so analyzePlan will flag it if the reserve runs out.
 */
export function changeGuestCount(plan, guestCount) {
  const factor = guestCount / plan.guestCount;
  const perGuestKeys = new Set(getProfile(plan.eventType).allocation.filter((line) => line.perGuest).map((line) => line.key));
  const isPerGuest = (item) => (item.key ? perGuestKeys.has(item.key) : PER_GUEST_PATTERN.test(item.category));
  const scaled = plan.budgetItems.map((item) => (isPerGuest(item) ? { ...item, allocated: roundTo50(item.allocated * factor) } : item));
  const reserve = findContingency(scaled);
  const others = scaled.filter((item) => item !== reserve).reduce((sum, item) => sum + item.allocated, 0);
  const budgetItems = reserve
    ? scaled.map((item) => (item === reserve ? { ...item, allocated: Math.max(0, plan.budget - others) } : item))
    : scaled;
  return { ...plan, guestCount, budgetItems };
}

/** Cuts one category by `percent` and moves the savings into the contingency. */
export function trimCategory(plan, itemId, percent) {
  const target = plan.budgetItems.find((item) => item.id === itemId);
  const saving = roundTo50((target.allocated * percent) / 100);
  const budgetItems = plan.budgetItems.map((item) => (item.id === itemId ? { ...item, allocated: item.allocated - saving } : item));
  return { plan: reconcileBudget({ ...plan, budgetItems }), saving };
}

/** Rebuilds the schedule for a new date, keeping progress on milestones with the same title. */
export function reschedule(plan, newDate, today = new Date()) {
  const fresh = generatePlan({ ...plan, date: newDate }, today);
  const statusByTitle = new Map(plan.timeline.map((m) => [m.title, m.status]));
  return {
    ...plan,
    date: fresh.date,
    timeline: fresh.timeline.map((m) => ({ ...m, status: statusByTitle.get(m.title) || m.status })),
  };
}
