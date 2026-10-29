import { describe, it, expect } from 'vitest';
import { sanitizeText, clampNumber, parseIsoDate, normalizeIntake, normalizePlan } from '../../src/domain/planSchema.js';
import { generatePlan } from '../../src/domain/planner.js';

const TODAY = new Date('2026-10-28T12:00:00Z');

describe('sanitizeText', () => {
  it('trims, strips control characters and caps length', () => {
    expect(sanitizeText('  hi\u0000 there\u0007  ')).toBe('hi there');
    expect(sanitizeText('x'.repeat(50), 10)).toHaveLength(10);
  });

  it('returns an empty string for non-strings', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(42)).toBe('');
    expect(sanitizeText({ toString: () => 'evil' })).toBe('');
  });

  it('keeps markup as plain text (React escapes on render)', () => {
    expect(sanitizeText('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
  });
});

describe('clampNumber', () => {
  it('clamps into range and parses formatted strings', () => {
    expect(clampNumber('$12,500', 0, 100000, 0)).toBe(12500);
    expect(clampNumber(-5, 1, 10, 3)).toBe(1);
    expect(clampNumber(1e12, 1, 10, 3)).toBe(10);
  });

  it('falls back for non-numeric input', () => {
    expect(clampNumber('abc', 1, 10, 7)).toBe(7);
    expect(clampNumber(null, 1, 10, 7)).toBe(7);
    expect(clampNumber('', 1, 10, 7)).toBe(7);
    expect(clampNumber(Infinity, 1, 10, 7)).toBe(7);
  });
});

describe('parseIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(parseIsoDate('2027-02-28')).toBe('2027-02-28');
    expect(parseIsoDate('2027-02-30')).toBeNull();
    expect(parseIsoDate('28/02/2027')).toBeNull();
    expect(parseIsoDate(20270228)).toBeNull();
  });
});

describe('normalizeIntake', () => {
  it('fills safe defaults for empty input', () => {
    expect(normalizeIntake(undefined)).toMatchObject({ eventType: 'wedding', guestCount: 100, budget: 15000, date: null, setting: null });
  });

  it('rejects unknown enums and clamps numbers', () => {
    const intake = normalizeIntake({ eventType: 'rave', guestCount: 999999, budget: 1, setting: 'space' });
    expect(intake).toMatchObject({ eventType: 'wedding', guestCount: 5000, budget: 500, setting: null });
  });
});

describe('normalizePlan', () => {
  const valid = generatePlan({ eventType: 'birthday', title: 'Party', date: '2027-01-10', guestCount: 40, budget: 4000 }, TODAY);

  it('round-trips a valid engine plan', () => {
    const normalized = normalizePlan(valid);
    expect(normalized.title).toBe('Party');
    expect(normalized.budgetItems).toHaveLength(valid.budgetItems.length);
    expect(normalized.budgetItems.reduce((sum, item) => sum + item.allocated, 0)).toBe(4000);
  });

  it('rejects structurally invalid input', () => {
    expect(normalizePlan(null)).toBeNull();
    expect(normalizePlan([])).toBeNull();
    expect(normalizePlan('plan')).toBeNull();
    expect(normalizePlan({ ...valid, title: '' })).toBeNull();
    expect(normalizePlan({ ...valid, budget: 'lots' })).toBeNull();
    expect(normalizePlan({ ...valid, timeline: 'soon' })).toBeNull();
  });

  it('repairs hostile or malformed fields from model output', () => {
    const hostile = normalizePlan({
      ...valid,
      eventType: 'heist',
      budgetItems: [
        { id: 'x', category: 'Venue', allocated: -500, spent: 'NaN', color: 'red; background:url(evil)' },
        { id: 'x', category: 'Food', allocated: 1e15 },
        'not an object',
      ],
      vendors: [{ name: 'A', status: 'Hacked', priority: 'Urgent!!' }],
      timeline: [{ title: 'T', status: 'done', dueDate: '2027-13-01' }],
      creativeIdeas: Array.from({ length: 100 }, (_, i) => ({ title: `Idea ${i}` })),
    });
    expect(hostile.eventType).toBe('wedding');
    expect(hostile.budgetItems).toHaveLength(2);
    expect(hostile.budgetItems[0]).toMatchObject({ allocated: 0, spent: 0 });
    expect(hostile.budgetItems[0].color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(hostile.budgetItems[1].allocated).toBe(1_000_000);
    expect(new Set(hostile.budgetItems.map((item) => item.id)).size).toBe(2);
    expect(hostile.vendors[0]).toMatchObject({ status: 'To Research', priority: 'Medium' });
    expect(hostile.timeline[0]).toMatchObject({ status: 'upcoming', dueDate: null });
    expect(hostile.creativeIdeas).toHaveLength(25);
  });
});
