import { describe, it, expect } from 'vitest';
import {
  generatePlan,
  analyzePlan,
  summarizeBudget,
  allocateBudget,
  buildTimeline,
  contingencyRate,
  detectSetting,
  pickIdeas,
  phaseLabel,
  daysBetween,
  addDays,
  changeGuestCount,
  rescaleBudget,
  trimCategory,
  reconcileBudget,
  reschedule,
} from '../../src/domain/planner.js';
import { normalizeIntake } from '../../src/domain/planSchema.js';
import { getPresetIntake, PRESET_TYPES } from '../../src/domain/presets.js';

const TODAY = new Date('2026-10-28T12:00:00Z');
const sum = (items) => items.reduce((total, item) => total + item.allocated, 0);
const byKey = (plan, key) => plan.budgetItems.find((item) => item.key === key);

const baseWedding = {
  eventType: 'wedding',
  title: 'Test Wedding',
  date: '2027-10-01',
  guestCount: 120,
  budget: 30000,
  location: 'City hotel ballroom',
  setting: 'indoor',
};

describe('date helpers', () => {
  it('counts days and adds days across month and year boundaries', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(daysBetween('2027-01-02', '2026-12-30')).toBe(-3);
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });

  it('labels phases by distance from the event', () => {
    expect(phaseLabel(0)).toBe('Event day');
    expect(phaseLabel(1)).toBe('1 day before');
    expect(phaseLabel(10)).toBe('10 days before');
    expect(phaseLabel(21)).toBe('3 weeks before');
    expect(phaseLabel(300)).toBe('10 months before');
  });
});

describe('context decisions', () => {
  it('infers outdoor settings from the venue text unless set explicitly', () => {
    expect(detectSetting(normalizeIntake({ location: 'Riverside park' }))).toBe('outdoor');
    expect(detectSetting(normalizeIntake({ location: 'Hotel ballroom' }))).toBe('indoor');
    expect(detectSetting(normalizeIntake({ location: 'Riverside park', setting: 'indoor' }))).toBe('indoor');
  });

  it('raises the contingency for weather and rushed timelines, capped at 20%', () => {
    expect(contingencyRate({ setting: 'indoor', daysUntil: 400, recommendedLeadDays: 300 })).toBeCloseTo(0.1);
    expect(contingencyRate({ setting: 'outdoor', daysUntil: 400, recommendedLeadDays: 300 })).toBeCloseTo(0.15);
    expect(contingencyRate({ setting: 'mixed', daysUntil: 400, recommendedLeadDays: 300 })).toBeCloseTo(0.13);
    expect(contingencyRate({ setting: 'outdoor', daysUntil: 30, recommendedLeadDays: 300 })).toBeCloseTo(0.2);
  });
});

describe('allocateBudget', () => {
  it.each([500, 4999, 15000, 123457, 1_000_000])('always sums exactly to a %i budget with no negative lines', (budget) => {
    const intake = normalizeIntake({ ...baseWedding, budget });
    const items = allocateBudget(intake, { setting: 'outdoor', daysUntil: 20 });
    expect(sum(items)).toBe(budget);
    expect(items.every((item) => item.allocated >= 0)).toBe(true);
  });

  it('gives catering a bigger share when money per guest is tight', () => {
    const lavish = allocateBudget(normalizeIntake({ ...baseWedding, guestCount: 50 }), { setting: 'indoor', daysUntil: 400 });
    const tight = allocateBudget(normalizeIntake({ ...baseWedding, guestCount: 250 }), { setting: 'indoor', daysUntil: 400 });
    const share = (items) => items.find((item) => item.key === 'catering').allocated / sum(items);
    expect(share(tight)).toBeGreaterThan(share(lavish));
  });

  it('adds weather backup outdoors and security for large crowds', () => {
    const indoorSmall = allocateBudget(normalizeIntake({ ...baseWedding, guestCount: 80 }), { setting: 'indoor', daysUntil: 400 });
    const outdoorLarge = allocateBudget(normalizeIntake({ ...baseWedding, guestCount: 200 }), { setting: 'outdoor', daysUntil: 400 });
    expect(indoorSmall.map((item) => item.key)).not.toContain('weather');
    expect(indoorSmall.map((item) => item.key)).not.toContain('security');
    expect(outdoorLarge.map((item) => item.key)).toEqual(expect.arrayContaining(['weather', 'security', 'contingency']));
  });
});

describe('buildTimeline', () => {
  it('schedules milestones backwards from the event date when there is time', () => {
    const intake = normalizeIntake(baseWedding);
    const timeline = buildTimeline(intake, { eventDate: '2027-10-01', daysUntil: 400 });
    expect(timeline[0]).toMatchObject({ dueDate: addDays('2027-10-01', -300), phase: '10 months before', status: 'upcoming' });
    expect(timeline.at(-1)).toMatchObject({ dueDate: '2027-10-01', phase: 'Event day', time: '19:00' });
  });

  it('compresses every lead time proportionally when the event is soon, never scheduling in the past', () => {
    const intake = normalizeIntake(baseWedding);
    const timeline = buildTimeline(intake, { eventDate: '2026-12-27', daysUntil: 60 });
    expect(timeline[0].dueDate).toBe('2026-10-28');
    expect(timeline[0].description).toMatch(/Compressed/);
    const dates = timeline.map((m) => m.dueDate);
    expect([...dates].sort()).toEqual(dates);
  });

  it('puts everything on the event day when the date has passed', () => {
    const timeline = buildTimeline(normalizeIntake(baseWedding), { eventDate: '2026-10-01', daysUntil: -27 });
    expect(timeline.every((m) => m.dueDate === '2026-10-01')).toBe(true);
  });
});

describe('generatePlan', () => {
  it.each(PRESET_TYPES)('builds a complete, balanced %s plan from the sample intake', (type) => {
    const plan = generatePlan(getPresetIntake(type, TODAY), TODAY);
    expect(plan.eventType).toBe(type);
    expect(sum(plan.budgetItems)).toBe(plan.budget);
    expect(plan.timeline.length).toBeGreaterThanOrEqual(5);
    expect(plan.vendors.length).toBeGreaterThanOrEqual(4);
    expect(plan.creativeIdeas).toHaveLength(4);
  });

  it('assumes the recommended lead time when no date is given and says so', () => {
    const plan = generatePlan({ eventType: 'birthday', budget: 5000, guestCount: 40 }, TODAY);
    expect(plan.date).toBe(addDays('2026-10-28', 60));
    expect(plan.summary).toMatch(/No date given/);
    expect(plan.title).toBe('Birthday plan');
  });

  it('marks vendors critical when inside their booking lead time', () => {
    const soon = generatePlan({ ...baseWedding, date: '2027-01-15' }, TODAY);
    expect(soon.vendors.every((vendor) => vendor.priority === 'Critical')).toBe(true);
    const later = generatePlan(baseWedding, TODAY);
    expect(later.vendors.find((vendor) => vendor.category === 'Florals').priority).toBe('Medium');
  });

  it('reacts to notes: dietary needs on the caterer and a kids vendor', () => {
    const plan = generatePlan({ ...baseWedding, notes: 'Vegan and gluten-free menu, lots of kids' }, TODAY);
    const caterer = plan.vendors.find((vendor) => vendor.category === 'Catering');
    expect(caterer.notes).toMatch(/Confirm options for: vegan, gluten-free\./);
    const allergy = generatePlan({ ...baseWedding, notes: 'Two guests with a nut allergy; speeches last 10 minutes' }, TODAY);
    expect(allergy.vendors.find((vendor) => vendor.category === 'Catering').notes).toMatch(/Confirm options for: nut-free, other allergies\./);
    const none = generatePlan({ ...baseWedding, notes: 'Speeches last 10 minutes, donuts at midnight' }, TODAY);
    expect(none.vendors.find((vendor) => vendor.category === 'Catering').notes).not.toMatch(/Confirm options/);
    expect(caterer.notes).toMatch(/per head/);
    expect(plan.vendors.some((vendor) => /Kids/.test(vendor.name))).toBe(true);
  });

  it('normalizes hostile intake instead of throwing', () => {
    const plan = generatePlan({ eventType: '<img>', guestCount: -3, budget: 'free', date: 'tomorrow' }, TODAY);
    expect(plan.eventType).toBe('wedding');
    expect(plan.guestCount).toBe(5);
    expect(sum(plan.budgetItems)).toBe(15000);
  });
});

describe('pickIdeas', () => {
  it('ranks ideas by overlap with theme and notes and can exclude existing ones', () => {
    const intake = normalizeIntake({ eventType: 'community', theme: 'zero-waste eco fair', notes: 'kids workshops' });
    const ideas = pickIdeas(intake, { setting: 'outdoor' });
    expect(ideas[0].title).toMatch(/Reusable cup|maker workshops/);
    const more = pickIdeas(intake, { setting: 'outdoor', excludeTitles: ideas.map((idea) => idea.title) });
    expect(more.some((idea) => ideas.map((i) => i.title).includes(idea.title))).toBe(false);
  });

  it('builds one idea from a free-text theme the tag library does not know', () => {
    const intake = normalizeIntake({ eventType: 'birthday', theme: 'Jungle safari' });
    const ideas = pickIdeas(intake);
    expect(ideas).toHaveLength(4);
    expect(ideas.at(-1)).toMatchObject({ category: 'Theme', title: 'Theme thread: Jungle safari' });
    expect(ideas.at(-1).description).toContain('"Jungle safari"');
    expect(pickIdeas(normalizeIntake({ eventType: 'birthday' })).some((idea) => idea.category === 'Theme')).toBe(false);
  });
});

describe('summarizeBudget and analyzePlan', () => {
  it('summarizes totals and per-category percentages', () => {
    const plan = generatePlan(baseWedding, TODAY);
    const totals = summarizeBudget(plan);
    expect(totals.allocated).toBe(30000);
    expect(totals.remaining).toBe(0);
    expect(totals.contingency).toBe(byKey(plan, 'contingency').allocated);
    expect(totals.items.every((item) => typeof item.percentage === 'number')).toBe(true);
  });

  it('handles an empty plan without dividing by zero', () => {
    expect(summarizeBudget({ budget: 0, budgetItems: [] })).toMatchObject({ allocated: 0, allocationPct: 0, contingency: 0 });
  });

  it('reports on-track for a well-funded plan with time to spare', () => {
    const { insights, daysUntil } = analyzePlan(generatePlan(baseWedding, TODAY), TODAY);
    expect(daysUntil).toBe(338);
    expect(insights).toEqual([{ level: 'success', message: expect.stringMatching(/on track/) }]);
  });

  it('flags low spend per guest, over-allocation, overspending, overdue tasks and late bookings', () => {
    const plan = generatePlan({ ...baseWedding, date: '2027-01-15', guestCount: 400, budget: 20000 }, TODAY);
    plan.budgetItems[0] = { ...plan.budgetItems[0], allocated: plan.budgetItems[0].allocated + 50000, spent: 999999 };
    plan.timeline[0] = { ...plan.timeline[0], dueDate: '2026-10-01' };
    const messages = analyzePlan(plan, TODAY).insights.map((insight) => insight.message).join('\n');
    expect(messages).toMatch(/per guest is below/);
    expect(messages).toMatch(/exceed the budget/);
    expect(messages).toMatch(/over allocation/);
    expect(messages).toMatch(/overdue/);
    expect(messages).toMatch(/Book now/);
    expect(messages).toMatch(/days to go/);
  });

  it('notes when the event is in the past', () => {
    const plan = generatePlan({ ...baseWedding, date: '2026-10-01' }, TODAY);
    expect(analyzePlan(plan, TODAY).insights[0]).toMatchObject({ level: 'info' });
  });
});

describe('plan adjustments', () => {
  const plan = generatePlan(baseWedding, TODAY);

  it('rescaleBudget keeps proportions and an exact total', () => {
    const bigger = rescaleBudget(plan, 45000);
    expect(bigger.budget).toBe(45000);
    expect(sum(bigger.budgetItems)).toBe(45000);
    expect(byKey(bigger, 'venue').allocated).toBeGreaterThan(byKey(plan, 'venue').allocated);
  });

  it('changeGuestCount scales per-guest lines and funds the change from the reserve', () => {
    const more = changeGuestCount(plan, 150);
    expect(byKey(more, 'catering').allocated).toBeGreaterThan(byKey(plan, 'catering').allocated);
    expect(byKey(more, 'venue').allocated).toBe(byKey(plan, 'venue').allocated);
    expect(sum(more.budgetItems)).toBe(30000);
  });

  it('changeGuestCount surfaces an overrun instead of hiding it when the reserve runs out', () => {
    const huge = changeGuestCount(plan, 1000);
    expect(byKey(huge, 'contingency').allocated).toBe(0);
    expect(summarizeBudget(huge).remaining).toBeLessThan(0);
  });

  it('trimCategory moves savings into the contingency', () => {
    const catering = byKey(plan, 'catering');
    const { plan: trimmed, saving } = trimCategory(plan, catering.id, 20);
    expect(saving).toBeGreaterThan(0);
    expect(byKey(trimmed, 'contingency').allocated).toBe(byKey(plan, 'contingency').allocated + saving);
    expect(sum(trimmed.budgetItems)).toBe(30000);
  });

  it('reconcileBudget adds a reserve line when a plan has none', () => {
    const withoutReserve = { ...plan, budgetItems: plan.budgetItems.filter((item) => item.key !== 'contingency') };
    const fixed = reconcileBudget(withoutReserve);
    expect(fixed.budgetItems.at(-1).category).toBe('Contingency Reserve');
    expect(sum(fixed.budgetItems)).toBe(30000);
  });

  it('reschedule rebuilds dates and keeps completed milestones', () => {
    const progressed = { ...plan, timeline: plan.timeline.map((m, i) => (i === 0 ? { ...m, status: 'completed' } : m)) };
    const moved = reschedule(progressed, '2028-01-20', TODAY);
    expect(moved.date).toBe('2028-01-20');
    expect(moved.timeline[0].status).toBe('completed');
    expect(moved.timeline.at(-1).dueDate).toBe('2028-01-20');
  });
});
