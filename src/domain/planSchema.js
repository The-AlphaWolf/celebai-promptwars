/**
 * Validation and normalization for everything that crosses a trust boundary:
 * intake form data, plans restored from localStorage, request bodies on the
 * API server, and JSON produced by the language model.
 *
 * React escapes text when rendering, so these helpers never HTML-encode.
 * They enforce types, enums, lengths and numeric ranges instead.
 */
import {
  EVENT_TYPES,
  SETTINGS,
  MILESTONE_STATUSES,
  VENDOR_STATUSES,
  VENDOR_PRIORITIES,
  LIMITS,
  PALETTE,
} from './constants.js';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Trims, strips control characters and caps length. Non-strings become ''. */
export function sanitizeText(value, maxLength = LIMITS.shortText) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
}

/** Coerces to a finite number and clamps to [min, max]; returns fallback when not numeric. */
export function clampNumber(value, min, max, fallback) {
  const parsed = typeof value === 'string' ? Number(value.replace(/[,$\s]/g, '')) : Number(value);
  if (value === null || value === '' || !Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Returns the YYYY-MM-DD string when it is a real calendar date, otherwise null. */
export function parseIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Normalizes raw intake form data. Always returns a complete, safe intake.
 * @param {object} raw
 */
export function normalizeIntake(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const eventType = pickEnum(source.eventType, EVENT_TYPES, 'wedding');
  return {
    eventType,
    title: sanitizeText(source.title, LIMITS.title),
    date: parseIsoDate(source.date),
    guestCount: Math.round(clampNumber(source.guestCount, LIMITS.guests.min, LIMITS.guests.max, 100)),
    budget: Math.round(clampNumber(source.budget, LIMITS.budget.min, LIMITS.budget.max, 15000)),
    location: sanitizeText(source.location),
    setting: pickEnum(source.setting, SETTINGS, null),
    theme: sanitizeText(source.theme),
    notes: sanitizeText(source.notes, LIMITS.longText),
  };
}

function normalizeList(list, mapItem, prefix) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list
    .filter((item) => item && typeof item === 'object')
    .slice(0, LIMITS.listItems)
    .map((item, index) => {
      const mapped = mapItem(item, index);
      let id = sanitizeText(item.id, 40) || `${prefix}${index + 1}`;
      while (seen.has(id)) id = `${id}_${index}`;
      seen.add(id);
      return { id, ...mapped };
    });
}

const money = (value) => Math.round(clampNumber(value, 0, LIMITS.budget.max, 0));

/**
 * Validates an untrusted plan (model output, saved state, request body).
 * Returns a sanitized copy, or null when the plan is structurally unusable.
 * @param {unknown} raw
 */
export function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const title = sanitizeText(raw.title, LIMITS.title);
  const budget = clampNumber(raw.budget, LIMITS.budget.min, LIMITS.budget.max, NaN);
  if (!title || Number.isNaN(budget)) return null;
  if (!Array.isArray(raw.budgetItems) || !Array.isArray(raw.timeline) || !Array.isArray(raw.vendors)) return null;

  const budgetItems = normalizeList(raw.budgetItems, (item, i) => ({
    key: sanitizeText(item.key, 40) || undefined,
    category: sanitizeText(item.category, 80) || `Category ${i + 1}`,
    allocated: money(item.allocated),
    spent: money(item.spent),
    color: HEX_COLOR.test(item.color) ? item.color : PALETTE[i % PALETTE.length],
  }), 'b').filter((item) => item.category);

  const timeline = normalizeList(raw.timeline, (item) => ({
    phase: sanitizeText(item.phase, 80),
    title: sanitizeText(item.title, LIMITS.title) || 'Untitled milestone',
    time: sanitizeText(item.time, 40),
    dueDate: parseIsoDate(item.dueDate),
    status: pickEnum(item.status, MILESTONE_STATUSES, 'upcoming'),
    description: sanitizeText(item.description, LIMITS.longText),
  }), 't');

  const vendors = normalizeList(raw.vendors, (item) => ({
    category: sanitizeText(item.category, 80) || 'General',
    name: sanitizeText(item.name, LIMITS.title) || 'Vendor to be sourced',
    contact: sanitizeText(item.contact, 120),
    cost: money(item.cost),
    leadDays: Math.round(clampNumber(item.leadDays, 0, 730, 0)) || undefined,
    status: pickEnum(item.status, VENDOR_STATUSES, 'To Research'),
    priority: pickEnum(item.priority, VENDOR_PRIORITIES, 'Medium'),
    notes: sanitizeText(item.notes, LIMITS.longText),
  }), 'v');

  const creativeIdeas = normalizeList(raw.creativeIdeas, (item) => ({
    category: sanitizeText(item.category, 80) || 'Creative Concept',
    title: sanitizeText(item.title, LIMITS.title) || 'Untitled idea',
    description: sanitizeText(item.description, LIMITS.longText),
  }), 'c');

  return {
    title,
    eventType: pickEnum(raw.eventType, EVENT_TYPES, 'wedding'),
    date: parseIsoDate(raw.date),
    guestCount: Math.round(clampNumber(raw.guestCount, LIMITS.guests.min, LIMITS.guests.max, 100)),
    budget: Math.round(budget),
    currency: '$',
    location: sanitizeText(raw.location),
    setting: pickEnum(raw.setting, SETTINGS, 'indoor'),
    theme: sanitizeText(raw.theme),
    summary: sanitizeText(raw.summary, LIMITS.longText),
    notes: sanitizeText(raw.notes, LIMITS.longText),
    budgetItems,
    timeline,
    vendors,
    creativeIdeas,
  };
}
