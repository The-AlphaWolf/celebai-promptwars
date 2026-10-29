import { describe, it, expect } from 'vitest';
import { respondOffline, parseAmount } from '../../src/domain/assistant.js';
import { generatePlan, summarizeBudget } from '../../src/domain/planner.js';

const TODAY = new Date('2026-10-28T12:00:00Z');
const plan = generatePlan(
  { eventType: 'wedding', title: 'Assistant Test', date: '2027-10-01', guestCount: 120, budget: 30000, location: 'Hotel', setting: 'indoor' },
  TODAY,
);
const byKey = (p, key) => p.budgetItems.find((item) => item.key === key);

describe('parseAmount', () => {
  it.each([
    ['20000', 20000],
    ['$20,000', 20000],
    ['20k', 20000],
    ['1.5m', 1500000],
    ['lots', null],
  ])('parses %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });
});

describe('respondOffline', () => {
  it('trims a named category by a percentage', () => {
    const result = respondOffline(plan, 'Please reduce catering by 15%', TODAY);
    expect(result.text).toMatch(/Catering & Bar/);
    expect(byKey(result.plan, 'catering').allocated).toBeLessThan(byKey(plan, 'catering').allocated);
    expect(summarizeBudget(result.plan).allocated).toBe(30000);
  });

  it('cuts the whole budget when no category is named', () => {
    const result = respondOffline(plan, 'cut everything by 10%', TODAY);
    expect(result.plan.budget).toBe(27000);
  });

  it('sets a new budget from shorthand amounts', () => {
    expect(respondOffline(plan, 'Set budget to 40k', TODAY).plan.budget).toBe(40000);
  });

  it('refuses out-of-range budgets without proposing a plan', () => {
    const result = respondOffline(plan, 'set budget to 5', TODAY);
    expect(result.plan).toBeUndefined();
    expect(result.text).toMatch(/between/);
  });

  it('resizes for a new headcount', () => {
    const result = respondOffline(plan, 'We now have 150 guests', TODAY);
    expect(result.plan.guestCount).toBe(150);
    expect(result.text).toMatch(/120 to 150/);
  });

  it('warns when a headcount change overspends the budget', () => {
    expect(respondOffline(plan, '900 guests', TODAY).text).toMatch(/overspends/);
  });

  it('rejects impossible headcounts', () => {
    expect(respondOffline(plan, '2 guests', TODAY).plan).toBeUndefined();
  });

  it('reschedules to a valid date and rejects invalid ones', () => {
    expect(respondOffline(plan, 'Move the date to 2027-12-12', TODAY).plan.date).toBe('2027-12-12');
    expect(respondOffline(plan, 'Move the date to 2027-02-31', TODAY).plan).toBeUndefined();
  });

  it('suggests new ideas without repeating existing ones', () => {
    const result = respondOffline(plan, 'more ideas please', TODAY);
    const titles = result.plan.creativeIdeas.map((idea) => idea.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.length).toBeGreaterThan(plan.creativeIdeas.length);
  });

  it('says so when the idea library is exhausted', () => {
    const exhausted = respondOffline(respondOffline(plan, 'more ideas', TODAY).plan, 'more ideas', TODAY);
    expect(exhausted.plan).toBeUndefined();
  });

  it('gives a status report with insights and next steps', () => {
    const result = respondOffline(plan, 'What are my biggest risks?', TODAY);
    expect(result.text).toMatch(/Plan status/);
    expect(result.text).toMatch(/Next steps/);
    expect(result.plan).toBeUndefined();
  });

  it('answers greetings and unknown requests with help text', () => {
    expect(respondOffline(plan, 'hello', TODAY).text).toMatch(/What I can do/);
    expect(respondOffline(plan, 'tell me a joke', TODAY).text).toMatch(/could not match/);
    expect(respondOffline(plan, undefined, TODAY).text).toMatch(/could not match/);
  });
});
