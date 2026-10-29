/**
 * Shared enums and input limits. Used by the browser and the API server
 * so both sides validate against exactly the same rules.
 */

export const EVENT_TYPES = ['wedding', 'birthday', 'community'];
export const SETTINGS = ['indoor', 'outdoor', 'mixed'];
export const MILESTONE_STATUSES = ['upcoming', 'in-progress', 'completed'];
export const VENDOR_STATUSES = ['To Research', 'Contacted', 'Quote Received', 'Deposit Paid', 'Booked'];
export const VENDOR_PRIORITIES = ['Critical', 'High', 'Medium', 'Nice-to-have'];

export const LIMITS = {
  guests: { min: 5, max: 5000 },
  budget: { min: 500, max: 1_000_000 },
  title: 120,
  shortText: 200,
  longText: 1000,
  chatMessage: 1000,
  listItems: 25,
};

export const DEFAULT_COLOR = '#8B5CF6';
export const PALETTE = ['#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#3B82F6', '#F43F5E', '#64748B'];

export const MS_PER_DAY = 86_400_000;
