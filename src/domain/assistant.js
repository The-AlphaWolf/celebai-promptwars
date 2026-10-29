/**
 * Offline planning assistant. Recognizes a small set of planning intents in a
 * chat message and answers by running the deterministic engine, so demo mode
 * gives real, plan-specific results instead of canned text.
 *
 * Returns { text, plan? } where `plan` is a proposed update the user can apply.
 */
import {
  analyzePlan,
  summarizeBudget,
  changeGuestCount,
  rescaleBudget,
  trimCategory,
  reschedule,
  pickIdeas,
  findContingency,
  formatUsd as usd,
} from './planner.js';
import { parseIsoDate } from './planSchema.js';
import { LIMITS } from './constants.js';


/** Practical ways to save in each budget category, keyed by the profile's budget key. */
const SAVING_TIPS = {
  venue: 'an off-peak day or time, a shorter hire window, or a venue that already includes tables and chairs',
  catering: 'fewer courses or a family-style service, a shorter open bar, or off-peak timing',
  photo: 'fewer hours of coverage, or dropping the second shooter or video',
  decor: 'seasonal or reused pieces, rented rather than bought items, and decorating only the focal points',
  music: 'a shorter live set with a playlist for the rest, or one performer instead of a band',
  attire: 'rented or pre-owned outfits and fewer paid styling sessions',
  stationery: 'digital invitations and printing only what guests need on the day',
  cake: 'a smaller display cake with a sheet cake or dessert table for serving',
  stage: 'a smaller stage, or sharing the sound and power rig with another booking',
  activities: 'volunteer-led sessions or fewer paid workshops',
  marketing: 'social media and community noticeboards instead of paid print',
  operations: 'shared waste stations and a volunteer cleanup crew',
  weather: 'covering only essential areas and planning an indoor fallback nearby',
  security: 'matching paid staff to peak hours and adding briefed volunteer stewards',
};
const GENERIC_TIP = 'two more quotes to compare, dropping optional extras, or off-peak booking';

/** Parses "20000", "20,000", "$20k", "1.5m". */
export function parseAmount(raw) {
  const match = /^\$?\s*([\d,.]+)\s*(k|m)?$/i.exec(raw.trim());
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(base)) return null;
  const multiplier = { k: 1_000, m: 1_000_000 }[match[2]?.toLowerCase()] || 1;
  return Math.round(base * multiplier);
}

/** Everyday words for each budget key, so "catering" finds "Food & Drinks" and "DJ" finds "DJ, Lighting & Games". */
const CATEGORY_WORDS = {
  catering: ['catering', 'caterer', 'food', 'drink', 'drinks', 'bar', 'menu'],
  music: ['music', 'dj', 'band', 'entertainment', 'lighting', 'games'],
  venue: ['venue', 'site', 'hall', 'rental', 'rentals', 'permit', 'permits', 'insurance'],
  decor: ['decor', 'decoration', 'decorations', 'flowers', 'florals', 'favors'],
  photo: ['photo', 'photos', 'photography', 'photographer', 'video'],
  cake: ['cake', 'dessert', 'desserts'],
  attire: ['attire', 'dress', 'outfit', 'outfits', 'beauty', 'makeup'],
  stationery: ['invitations', 'invites', 'stationery'],
  stage: ['stage', 'sound', 'audio'],
  activities: ['activities', 'workshop', 'workshops'],
  marketing: ['promotion', 'marketing', 'signage', 'posters'],
  operations: ['waste', 'toilets', 'cleanup', 'cleaning'],
  weather: ['tent', 'tents', 'weather', 'generator'],
  security: ['security', 'stewards', 'logistics'],
};

/** Finds the budget line a message refers to: everyday words for its key first, then words in its name. */
function findCategory(plan, message) {
  const tokens = message.toLowerCase().match(/[a-z]+/g) || [];
  const byKey = plan.budgetItems.find((item) => CATEGORY_WORDS[item.key]?.some((word) => tokens.includes(word)));
  if (byKey) return byKey;
  const words = tokens.filter((word) => word.length >= 4);
  return plan.budgetItems.find((item) => {
    const category = item.category.toLowerCase();
    return words.some((word) => category.includes(word));
  });
}

function nextMilestones(plan, count = 3) {
  return plan.timeline.filter((m) => m.status !== 'completed').slice(0, count);
}

function statusReport(plan, today) {
  const { daysUntil, insights } = analyzePlan(plan, today);
  const totals = summarizeBudget(plan);
  const lines = [
    `### Plan status: ${plan.title}`,
    `- **${daysUntil ?? '?'} days** until the event`,
    `- **${usd(totals.allocated)}** of ${usd(totals.budget)} allocated, ${usd(totals.spent)} spent, ${usd(totals.contingency)} in reserve`,
    '',
    '#### Insights',
    ...insights.map((insight) => `- ${insight.message}`),
  ];
  const upcoming = nextMilestones(plan);
  if (upcoming.length) {
    lines.push('', '#### Next steps', ...upcoming.map((m, i) => `${i + 1}. **${m.title}** (${m.dueDate || m.phase})`));
  }
  return lines.join('\n');
}

const HELP_TEXT = [
  '### What I can do offline',
  '- "Reduce catering by 15%": trims a category and moves savings to the reserve',
  '- "Set budget to 30k": rescales every allocation',
  '- "We now have 180 guests": rescales per-guest costs and checks the reserve',
  '- "Move the date to 2027-05-20": rebuilds the timeline',
  '- "More ideas": adds concepts matched to your theme',
  '- "Status" or "risks": budget, deadline and vendor check',
].join('\n');

/**
 * @param {object} plan current, already-normalized plan
 * @param {string} message user message
 * @param {Date} [today]
 * @returns {{ text: string, plan?: object }}
 */
export function respondOffline(plan, message, today = new Date()) {
  const text = String(message || '').slice(0, LIMITS.chatMessage);
  const lower = text.toLowerCase();

  const percentCut = /(reduce|cut|trim|lower|decrease|save)\D*?(\d{1,2})\s*%/.exec(lower);
  if (percentCut) {
    const percent = Number(percentCut[2]);
    const target = findCategory(plan, lower);
    if (!target || target === findContingency(plan.budgetItems)) {
      const newBudget = Math.round(plan.budget * (1 - percent / 100));
      return {
        text: `Cutting the whole budget by ${percent}% takes it from ${usd(plan.budget)} to ${usd(newBudget)}. Every category is scaled proportionally.`,
        plan: rescaleBudget(plan, newBudget),
      };
    }
    const { plan: updated, saving } = trimCategory(plan, target.id, percent);
    // trimCategory rounds to $50 steps; say so when that differs from the exact percentage.
    const exact = (target.allocated * percent) / 100;
    const rounding = Math.round(exact) === saving ? '' : ` (${percent}% is ${usd(exact)}, rounded to the plan's $50 steps)`;
    return {
      text: `Trimming **${target.category}** by ${percent}% saves ${usd(saving)}${rounding}, which moves into the contingency reserve. Ways to get there: ${SAVING_TIPS[target.key] ?? GENERIC_TIP}.`,
      plan: updated,
    };
  }

  const budgetMatch = /budget\D{0,12}?(\$?\s*[\d,.]+\s*[km]?)\b/i.exec(text);
  if (budgetMatch && /(set|change|increase|raise|lower|make|is|to)/.test(lower)) {
    const amount = parseAmount(budgetMatch[1]);
    if (amount && amount >= LIMITS.budget.min && amount <= LIMITS.budget.max) {
      return {
        text: `Rescaled every allocation from ${usd(plan.budget)} to ${usd(amount)}, keeping the same proportions.`,
        plan: rescaleBudget(plan, amount),
      };
    }
    return { text: `Budgets must be between ${usd(LIMITS.budget.min)} and ${usd(LIMITS.budget.max)}.` };
  }

  const guestMatch = /(\d{1,4})\s*(guests|people|attendees|pax)/.exec(lower);
  if (guestMatch) {
    const guests = Number(guestMatch[1]);
    if (guests < LIMITS.guests.min || guests > LIMITS.guests.max) {
      return { text: `Guest count must be between ${LIMITS.guests.min} and ${LIMITS.guests.max}.` };
    }
    const updated = changeGuestCount(plan, guests);
    const after = summarizeBudget(updated);
    const note = after.remaining < 0
      ? `This overspends the budget by ${usd(-after.remaining)}; raise the budget or trim another category.`
      : `${usd(after.contingency)} remains in the reserve.`;
    return {
      text: `Going from ${plan.guestCount} to ${guests} guests rescales the per-guest categories (food and drink). ${note}`,
      plan: updated,
    };
  }

  const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(text);
  if (dateMatch && /(move|change|reschedule|date|postpone|shift)/.test(lower)) {
    const date = parseIsoDate(dateMatch[1]);
    if (!date) return { text: `${dateMatch[1]} is not a valid date. Use YYYY-MM-DD.` };
    const updated = reschedule(plan, date, today);
    return {
      text: `Rebuilt the timeline for ${date}. Milestones you already completed keep their status.`,
      plan: updated,
    };
  }

  if (/(idea|brainstorm|inspir|concept|creative)/.test(lower)) {
    const fresh = pickIdeas(plan, { setting: plan.setting, excludeTitles: plan.creativeIdeas.map((idea) => idea.title) });
    if (!fresh.length) return { text: 'You already have every idea in my offline library for this event type. Connect Gemini for more.' };
    const creativeIdeas = [...plan.creativeIdeas, ...fresh.map((idea, i) => ({ ...idea, id: `c${plan.creativeIdeas.length + i + 1}` }))];
    return {
      text: ['### More ideas for your theme', ...fresh.map((idea) => `- **${idea.title}**: ${idea.description}`)].join('\n'),
      plan: { ...plan, creativeIdeas },
    };
  }

  if (/(status|risk|on track|summary|overview|next|what should|todo|to-do)/.test(lower)) {
    return { text: statusReport(plan, today) };
  }

  if (/^(hi|hello|hey|help|what can you do)\b/.test(lower.trim())) return { text: HELP_TEXT };

  return { text: `I could not match that to a planning action offline.\n\n${HELP_TEXT}` };
}
