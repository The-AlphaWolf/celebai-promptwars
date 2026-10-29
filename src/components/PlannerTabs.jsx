import { useRef } from 'react';
import { DollarSign, Calendar, Users, Sparkles } from 'lucide-react';

const TABS = [
  { id: 'budget', label: 'Budget', Icon: DollarSign, count: (plan) => `$${plan.budget.toLocaleString('en-US')}` },
  { id: 'timeline', label: 'Timeline', Icon: Calendar, count: (plan) => plan.timeline.length },
  { id: 'vendors', label: 'Vendors', Icon: Users, count: (plan) => plan.vendors.length },
  { id: 'ideas', label: 'Ideas', Icon: Sparkles, count: (plan) => plan.creativeIdeas.length },
];

/** WAI-ARIA tab list: roving tabindex, Arrow/Home/End keys move and activate. */
export default function PlannerTabs({ plan, activeTab, onChange }) {
  const buttonRefs = useRef({});

  const handleKeyDown = (event) => {
    const index = TABS.findIndex((tab) => tab.id === activeTab);
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = TABS[(moves[event.key] + TABS.length) % TABS.length];
    onChange(next.id);
    buttonRefs.current[next.id]?.focus();
  };

  return (
    // Focus lives on the tabs (roving tabindex), not on the tablist container.
    // oxlint-disable-next-line jsx-a11y/interactive-supports-focus
    <div className="tabs-nav" role="tablist" aria-label="Plan sections" onKeyDown={handleKeyDown}>
      {TABS.map(({ id, label, Icon, count }) => {
        const selected = activeTab === id;
        return (
          <button
            key={id}
            ref={(node) => { buttonRefs.current[id] = node; }}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={selected}
            aria-controls={`panel-${id}`}
            tabIndex={selected ? 0 : -1}
            className={`tab-btn ${selected ? 'active' : ''}`}
            onClick={() => onChange(id)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
            <span className="tab-badge">{count(plan)}</span>
          </button>
        );
      })}
    </div>
  );
}
