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
    expect(result.text).toMatch(/family-style service/);
  });

  it('says when a trim was rounded to $50 steps', () => {
    const withCatering = (allocated) => ({ ...plan, budgetItems: plan.budgetItems.map((item) => (item.key === 'catering' ? { ...item, allocated } : item)) });
    const rounded = respondOffline(withCatering(1550), 'reduce catering by 10%', TODAY).text;
    expect(rounded).toMatch(/saves \$150 \(10% is \$155, rounded to the plan's \$50 steps\)/);
    const exact = respondOffline(withCatering(2000), 'reduce catering by 10%', TODAY).text;
    expect(exact).toMatch(/saves \$200,/);
    expect(exact).not.toMatch(/rounded/);
  });

  it('finds categories by everyday words on every event type', () => {
    const birthday = generatePlan({ eventType: 'birthday', guestCount: 35, budget: 3200, date: '2026-12-19' }, TODAY);
    const djCut = respondOffline(birthday, 'Cut the DJ budget by 25%', TODAY);
    expect(djCut.text).toMatch(/DJ, Lighting & Games/);
    expect(djCut.plan.budget).toBe(3200);
    const cateringCut = respondOffline(birthday, 'Reduce catering by 10%', TODAY);
    expect(cateringCut.text).toMatch(/Food & Drinks/);
    expect(summarizeBudget(cateringCut.plan).allocated).toBe(3200);
    const community = generatePlan({ eventType: 'community', guestCount: 300, budget: 15000, date: '2027-03-01' }, TODAY);
    expect(respondOffline(community, 'trim the sound by 10%', TODAY).text).toMatch(/Stage, Sound & Power/);
    expect(respondOffline(community, 'reduce catering by 10%', TODAY).text).toMatch(/Food & Water Stations/);
  });

  it('gives saving tips that match the trimmed category', () => {
    const decor = respondOffline(plan, 'trim decor by 20%', TODAY).text;
    expect(decor).toMatch(/Florals & Decor/);
    expect(decor).toMatch(/rented rather than bought/);
    expect(decor).not.toMatch(/open bar/);
    const custom = { ...plan, budgetItems: [...plan.budgetItems, { id: 'x1', key: 'custom', category: 'Fireworks', allocated: 0, spent: 0, color: '#FFFFFF' }] };
    expect(respondOffline(custom, 'cut fireworks by 10%', TODAY).text).toMatch(/two more quotes/);
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
