// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import VendorChecklist from '../../src/components/VendorChecklist.jsx';
import IdeaGenerator from '../../src/components/IdeaGenerator.jsx';
import TimelinePlanner from '../../src/components/TimelinePlanner.jsx';
import ThemeSelector from '../../src/components/ThemeSelector.jsx';
import { generatePlan } from '../../src/domain/planner.js';

const TODAY = new Date('2026-10-28T12:00:00Z');
const plan = generatePlan(
  { eventType: 'community', title: 'Fair', date: '2027-01-10', guestCount: 300, budget: 15000, location: 'Riverside park' },
  TODAY,
);

describe('VendorChecklist', () => {
  it('filters by category, changes status and removes vendors', () => {
    const onUpdate = vi.fn();
    render(<VendorChecklist plan={plan} onUpdateVendors={onUpdate} />);
    const cards = () => screen.getAllByRole('heading', { level: 3 });
    expect(cards()).toHaveLength(plan.vendors.length);

    fireEvent.change(screen.getByLabelText('Filter vendors by category'), { target: { value: 'Permits' } });
    expect(cards()).toHaveLength(1);

    const vendor = plan.vendors.find((entry) => entry.category === 'Permits');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Booked' } });
    expect(onUpdate.mock.calls[0][0].find((entry) => entry.id === vendor.id).status).toBe('Booked');

    fireEvent.click(screen.getByRole('button', { name: `Remove ${vendor.name}` }));
    expect(onUpdate.mock.calls[1][0]).toHaveLength(plan.vendors.length - 1);
  });

  it('adds a vendor with sanitized, clamped values', () => {
    const onUpdate = vi.fn();
    render(<VendorChecklist plan={plan} onUpdateVendors={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add vendor' }));
    const dialog = screen.getByRole('dialog', { name: 'Add vendor' });
    fireEvent.change(within(dialog).getByLabelText('Vendor or service'), { target: { value: '  Face painter \u0007 ' } });
    fireEvent.change(within(dialog).getByLabelText('Estimated cost (USD)'), { target: { value: '-40' } });
    fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: 'Critical' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save vendor' }));
    expect(onUpdate).not.toHaveBeenCalled(); // native min="0" validation blocks negative costs

    fireEvent.change(within(dialog).getByLabelText('Estimated cost (USD)'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save vendor' }));
    const added = onUpdate.mock.calls[0][0].at(-1);
    expect(added).toMatchObject({ name: 'Face painter', cost: 0, priority: 'Critical', category: 'General', status: 'To Research' });
  });
});

describe('IdeaGenerator', () => {
  it('shortlists, removes and adds ideas and asks for more', () => {
    const onUpdate = vi.fn();
    const onAsk = vi.fn();
    render(<IdeaGenerator plan={plan} onUpdateIdeas={onUpdate} onAskForIdeas={onAsk} isBusy={false} />);
    const first = plan.creativeIdeas[0];

    const shortlist = screen.getByRole('button', { name: `Shortlist ${first.title}` });
    fireEvent.click(shortlist);
    expect(shortlist.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(shortlist);
    expect(shortlist.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: `Remove ${first.title}` }));
    expect(onUpdate.mock.calls[0][0]).toHaveLength(plan.creativeIdeas.length - 1);

    fireEvent.click(screen.getByRole('button', { name: 'Suggest more' }));
    expect(onAsk).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Add idea' }));
    const dialog = screen.getByRole('dialog', { name: 'Add idea' });
    fireEvent.change(within(dialog).getByLabelText('Idea'), { target: { value: 'Lantern walk' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save idea' }));
    expect(onUpdate.mock.calls[1][0].at(-1)).toMatchObject({ title: 'Lantern walk', category: 'Custom' });
  });
});

describe('TimelinePlanner', () => {
  it('flags overdue milestones and adds new ones in date order', () => {
    const late = { ...plan, timeline: plan.timeline.map((m, i) => (i === 0 ? { ...m, dueDate: '2026-10-01' } : m)) };
    const onUpdate = vi.fn();
    render(<TimelinePlanner plan={late} today={TODAY} onUpdateTimeline={onUpdate} />);
    expect(screen.getByText('Overdue')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }));
    const dialog = screen.getByRole('dialog', { name: 'Add milestone' });
    fireEvent.change(within(dialog).getByLabelText('Milestone'), { target: { value: 'Book first-aid team' } });
    fireEvent.change(within(dialog).getByLabelText('Due date'), { target: { value: '2026-10-15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save milestone' }));

    const updated = onUpdate.mock.calls[0][0];
    expect(updated[1]).toMatchObject({ title: 'Book first-aid team', dueDate: '2026-10-15', status: 'upcoming' });
  });

  it('cycles status via the status dot and deletes milestones', () => {
    const onUpdate = vi.fn();
    render(<TimelinePlanner plan={plan} today={TODAY} onUpdateTimeline={onUpdate} />);
    const first = plan.timeline[0];
    fireEvent.click(screen.getByRole('button', { name: `1. ${first.title}: Upcoming. Change to In progress` }));
    expect(onUpdate.mock.calls[0][0][0].status).toBe('in-progress');
    fireEvent.click(screen.getByRole('button', { name: `Delete milestone ${first.title}` }));
    expect(onUpdate.mock.calls[1][0]).toHaveLength(plan.timeline.length - 1);
  });

  it('shows an empty state when no milestone matches the filter', () => {
    render(<TimelinePlanner plan={plan} today={TODAY} onUpdateTimeline={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(screen.getByText('No milestones match this filter.')).toBeTruthy();
  });
});

describe('ThemeSelector', () => {
  it('opens, selects a theme, and closes on Escape with focus restored', () => {
    const onSelect = vi.fn();
    render(<ThemeSelector currentTheme="cosmic" onSelectTheme={onSelect} />);
    const trigger = screen.getByRole('button', { name: /Colour theme/ });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Pearl Aurora/ }));
    expect(onSelect).toHaveBeenCalledWith('aurora-light');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
