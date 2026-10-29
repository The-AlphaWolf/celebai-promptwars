/**
 * Sample intakes for the quick-start buttons. Dates are relative to today so
 * samples never describe an event in the past.
 */
import { addDays, toIsoDate } from './planner.js';

const PRESETS = {
  wedding: {
    label: 'Garden wedding',
    daysOut: 320,
    intake: {
      eventType: 'wedding',
      title: 'Golden Hour Garden Wedding',
      guestCount: 140,
      budget: 32000,
      location: 'Vineyard garden with a covered courtyard',
      setting: 'mixed',
      theme: 'Botanical, candlelight and warm gold',
      notes: 'Vegetarian and gluten-free options. Acoustic strings during the ceremony, DJ after dinner.',
    },
  },
  birthday: {
    label: 'Retro 30th birthday',
    daysOut: 75,
    intake: {
      eventType: 'birthday',
      title: 'Retro Arcade 30th Birthday',
      guestCount: 60,
      budget: 6500,
      location: 'Warehouse loft downtown',
      setting: 'indoor',
      theme: 'Neon 80s and 90s arcade',
      notes: 'Arcade games, signature cocktails and a DJ. One guest has a nut allergy.',
    },
  },
  community: {
    label: 'Riverside community fair',
    daysOut: 150,
    intake: {
      eventType: 'community',
      title: 'Riverside Harvest & Maker Fair',
      guestCount: 400,
      budget: 18000,
      location: 'Riverfront park and open-air amphitheater',
      setting: 'outdoor',
      theme: 'Zero-waste, local makers and acoustic music',
      notes: 'Family-friendly workshops for kids, local food market, step-free access throughout.',
    },
  },
};

export const PRESET_TYPES = Object.keys(PRESETS);

export function presetLabel(eventType) {
  return PRESETS[eventType]?.label ?? eventType;
}

/** Returns a sample intake for an event type with a date relative to `today`. */
export function getPresetIntake(eventType, today = new Date()) {
  const preset = PRESETS[eventType] || PRESETS.wedding;
  return { ...preset.intake, date: addDays(toIsoDate(today), preset.daysOut) };
}
