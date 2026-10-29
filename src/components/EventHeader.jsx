import { useMemo } from 'react';
import { Calendar, Users, MapPin, DollarSign, Sparkles, Wand2, PlusCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { analyzePlan, getProfile } from '../domain/planner';
import './EventHeader.css';

const TYPE_BADGE = { wedding: '💍 Wedding', birthday: '🎂 Birthday', community: '🎪 Community event' };
const INSIGHT_ICON = { warning: AlertTriangle, success: CheckCircle2, info: Info };

function countdownLabel(daysUntil) {
  if (daysUntil === null) return 'Date not set';
  if (daysUntil === 0) return 'Today';
  if (daysUntil < 0) return `${-daysUntil} days ago`;
  return `${daysUntil} days to go`;
}

export default function EventHeader({ plan, today, onOpenIntake, onOpenChat, isBusy }) {
  const { daysUntil, insights } = useMemo(() => analyzePlan(plan, today), [plan, today]);
  const perGuest = plan.guestCount ? Math.round(plan.budget / plan.guestCount) : 0;

  return (
    <section className={`event-header-card glass-panel theme-${plan.eventType}`} aria-labelledby="event-title">
      <div className="header-top-row">
        <div className="header-badges">
          <span className="badge badge-type">{TYPE_BADGE[plan.eventType] || getProfile(plan.eventType).label}</span>
          {plan.theme && (
            <span className="badge badge-theme">
              <Sparkles size={12} aria-hidden="true" />
              <span>{plan.theme}</span>
            </span>
          )}
        </div>

        <div className="header-actions">
          <button type="button" className="btn-header-action" onClick={onOpenChat} disabled={isBusy}>
            <Wand2 size={14} aria-hidden="true" />
            <span>Ask the assistant</span>
          </button>
          <button type="button" className="btn-primary btn-header-new" onClick={onOpenIntake} disabled={isBusy}>
            <PlusCircle size={15} aria-hidden="true" />
            <span>New plan</span>
          </button>
        </div>
      </div>

      <div className="header-main-content">
        <h1 id="event-title" className="event-title">{plan.title}</h1>
        {plan.summary && <p className="event-summary">{plan.summary}</p>}
      </div>

      <div className="header-meta-grid">
        <div className="meta-pill">
          <Calendar size={16} className="meta-icon" aria-hidden="true" />
          <div className="meta-text">
            <span className="meta-label">Date</span>
            <span className="meta-value">
              {plan.date ? <time dateTime={plan.date}>{plan.date}</time> : 'TBD'} · {countdownLabel(daysUntil)}
            </span>
          </div>
        </div>
        <div className="meta-pill">
          <Users size={16} className="meta-icon" aria-hidden="true" />
          <div className="meta-text">
            <span className="meta-label">Guests</span>
            <span className="meta-value">{plan.guestCount}</span>
          </div>
        </div>
        <div className="meta-pill">
          <DollarSign size={16} className="meta-icon" aria-hidden="true" />
          <div className="meta-text">
            <span className="meta-label">Budget</span>
            <span className="meta-value">${plan.budget.toLocaleString('en-US')} (${perGuest.toLocaleString('en-US')}/guest)</span>
          </div>
        </div>
        <div className="meta-pill">
          <MapPin size={16} className="meta-icon" aria-hidden="true" />
          <div className="meta-text">
            <span className="meta-label">Venue · setting</span>
            <span className="meta-value">{plan.location || 'Venue TBD'} · {plan.setting}</span>
          </div>
        </div>
      </div>

      <div className="insights-panel" aria-labelledby="insights-title">
        <h2 id="insights-title" className="insights-title">Planner insights</h2>
        <ul className="insights-list">
          {insights.map((insight) => {
            const Icon = INSIGHT_ICON[insight.level];
            return (
              <li key={insight.message} className={`insight insight-${insight.level}`}>
                <Icon size={15} aria-hidden="true" />
                <span>
                  <span className="visually-hidden">{insight.level}: </span>
                  {insight.message}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
