import { describe, it, expect, vi } from 'vitest';
import { generatePlan } from '../../src/domain/planner.js';

const written = [];
const saved = [];
vi.mock('jspdf', async (importOriginal) => {
  const { jsPDF } = await importOriginal();
  class RecordingPdf extends jsPDF {
    constructor(...args) {
      super(...args);
      const text = this.text.bind(this);
      this.text = (value, ...rest) => {
        written.push([value].flat().join(' '));
        return text(value, ...rest);
      };
      this.save = (name) => saved.push(name);
    }
  }
  return { jsPDF: RecordingPdf };
});

const { exportPlanToPdf } = await import('../../src/utils/exportPdf.js');

describe('exportPlanToPdf', () => {
  it('renders every plan section and saves a file named after the event', () => {
    const plan = generatePlan({ eventType: 'wedding', title: 'PDF Wedding!', date: '2027-09-01', guestCount: 90, budget: 25000 }, new Date('2026-10-28'));
    exportPlanToPdf(plan);

    const text = written.join('\n');
    expect(text).toContain('PDF Wedding!');
    expect(text).toContain('Contingency Reserve');
    expect(text).toMatch(/\d+%/);
    expect(text).toContain(plan.timeline[0].title);
    expect(text).toContain(plan.vendors[0].name);
    expect(text).toContain(plan.creativeIdeas[0].title);
    expect(text).not.toContain('undefined');
    expect(saved).toEqual(['pdf_wedding__celebai.pdf']);
  });
});
