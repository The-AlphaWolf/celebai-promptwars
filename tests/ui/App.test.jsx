// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import axe from 'axe-core';
import App from '../../src/App.jsx';

beforeEach(() => {
  localStorage.clear();
  // No API server in tests: every request fails, exercising the offline engine path.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  // Reduced motion on: confetti is skipped (jsdom has no canvas).
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderApp = async () => {
  const utils = render(<App />);
  await act(async () => {}); // settle the health check
  return utils;
};

describe('App', () => {
  it('starts with a complete sample plan and planner insights', async () => {
    await renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'Golden Hour Garden Wedding' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Planner insights' })).toBeTruthy();
    expect(screen.getByText('Offline planning engine')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Budget/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('supports arrow-key navigation between tabs', async () => {
    await renderApp();
    const budgetTab = screen.getByRole('tab', { name: /Budget/ });
    budgetTab.focus();
    fireEvent.keyDown(budgetTab, { key: 'ArrowRight' });
    const timelineTab = screen.getByRole('tab', { name: /Timeline/ });
    expect(timelineTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(timelineTab);
    expect(screen.getByRole('tabpanel').id).toBe('panel-timeline');
    fireEvent.keyDown(timelineTab, { key: 'End' });
    expect(screen.getByRole('tab', { name: /Ideas/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Budget/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('builds a new plan from the intake form when no server is available', async () => {
    await renderApp();
    const opener = screen.getByRole('button', { name: 'New plan' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'Plan a new event' });
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Event name'));

    fireEvent.click(within(dialog).getByLabelText(/Community/));
    fireEvent.change(within(dialog).getByLabelText('Event name'), { target: { value: 'Block Party' } });
    fireEvent.change(within(dialog).getByLabelText('Guest count'), { target: { value: '220' } });
    fireEvent.change(within(dialog).getByLabelText('Total budget (USD)'), { target: { value: '9000' } });
    fireEvent.change(within(dialog).getByLabelText('Venue or area'), { target: { value: 'Main street' } });
    fireEvent.change(within(dialog).getByLabelText('Setting'), { target: { value: 'outdoor' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Build my plan' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Block Party' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/Community event for 220 guests/)).toBeTruthy();
    expect(screen.getByText(/plan was built in your browser/)).toBeTruthy();
    expect(screen.getAllByText('Tents, Power & Weather Backup').length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem('celebai_plan_v2')).title).toBe('Block Party');
  });

  it('closes dialogs with Escape and returns focus to the opener', async () => {
    await renderApp();
    const opener = screen.getByRole('button', { name: 'Add category' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Add budget category' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('traps Tab focus inside a dialog', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Close dialog' });
    const submit = within(dialog).getByRole('button', { name: 'Add category' });
    submit.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(submit);
  });

  it('adds a budget category and recalculates totals', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Category name'), { target: { value: 'Fireworks' } });
    fireEvent.change(within(dialog).getByLabelText('Allocated amount (USD)'), { target: { value: '2000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add category' }));
    expect(screen.getByLabelText('Allocated to Fireworks').value).toBe('2000');
    expect(screen.getByText('Over budget')).toBeTruthy();
    expect(screen.getByText(/Allocations exceed the budget by \$2,000/)).toBeTruthy();
  });

  it('applies an assistant proposal from the offline engine', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Ask CelebAI' }));
    const assistant = await screen.findByRole('complementary', { name: 'Planning assistant' });
    fireEvent.change(within(assistant).getByLabelText('Message the planning assistant'), { target: { value: 'Set budget to 40000' } });
    fireEvent.click(within(assistant).getByRole('button', { name: 'Send message' }));

    fireEvent.click(await within(assistant).findByRole('button', { name: 'Apply to plan' }));
    expect(within(assistant).getByText('Applied to your plan')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /\$40,000/ })).toBeTruthy();
  });

  it('ignores a corrupted saved plan', async () => {
    localStorage.setItem('celebai_plan_v2', '{"title":"<b>x</b>","budget":"oops"}');
    await renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'Golden Hour Garden Wedding' })).toBeTruthy();
  });

  it('cycles milestone status and filters the timeline', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('tab', { name: /Timeline/ }));
    const [firstDone] = screen.getAllByRole('button', { name: /^Mark done/ });
    fireEvent.click(firstDone);
    expect(screen.getByText(/1 of 9 done/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('has no detectable accessibility violations on any tab', async () => {
    const { container } = await renderApp();
    for (const tab of screen.getAllByRole('tab')) {
      fireEvent.click(tab);
      const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations.map((violation) => `${tab.textContent}: ${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
    }
  });

  it('has no accessibility violations with a dialog open', async () => {
    const { container } = await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'New plan' }));
    await screen.findByRole('dialog');
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('keeps working when localStorage is unavailable', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    await renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    setItem.mockRestore();
  });
});

describe('FormattedText safety', () => {
  it('renders assistant markdown as text, never as HTML', async () => {
    const { default: FormattedText } = await import('../../src/components/FormattedText.jsx');
    const { container } = render(<FormattedText text={'### Title\n- **bold** <img src=x onerror=alert(1)>\n1. step'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('strong').textContent).toBe('bold');
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    await waitFor(() => expect(container.querySelector('.msg-num-badge').textContent).toBe('1'));
  });
});
