import { useState } from 'react';
import { Clock, Plus, Trash2, Check } from 'lucide-react';
import Modal from './Modal';
import { sanitizeText, parseIsoDate } from '../domain/planSchema';
import { toIsoDate } from '../domain/planner';
import { LIMITS } from '../domain/constants';
import './Modal.css';
import './TimelinePlanner.css';

const NEXT_STATUS = { upcoming: 'in-progress', 'in-progress': 'completed', completed: 'upcoming' };
const STATUS_LABEL = { upcoming: 'Upcoming', 'in-progress': 'In progress', completed: 'Completed' };
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
];

function AddMilestoneDialog({ eventDate, onAdd, onClose }) {
  const [form, setForm] = useState({ title: '', dueDate: '', description: '' });
  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const title = sanitizeText(form.title, LIMITS.title);
    if (!title) return;
    const dueDate = parseIsoDate(form.dueDate);
    onAdd({ title, dueDate, phase: dueDate ? 'Custom' : 'Unscheduled', time: dueDate || '', description: sanitizeText(form.description, LIMITS.longText) });
  };

  return (
    <Modal title="Add milestone" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="modal-body">
        <div className="form-group">
          <label htmlFor="milestone-title">Milestone</label>
          <input id="milestone-title" type="text" value={form.title} onChange={update('title')} maxLength={LIMITS.title} required data-autofocus />
        </div>
        <div className="form-group">
          <label htmlFor="milestone-date">Due date</label>
          <input id="milestone-date" type="date" value={form.dueDate} onChange={update('dueDate')} max={eventDate || undefined} />
        </div>
        <div className="form-group">
          <label htmlFor="milestone-notes">Details</label>
          <textarea id="milestone-notes" rows="3" value={form.description} onChange={update('description')} maxLength={LIMITS.longText} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save milestone</button>
        </div>
      </form>
    </Modal>
  );
}

export default function TimelinePlanner({ plan, onUpdateTimeline, today }) {
  const [filter, setFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const items = plan.timeline || [];
  const todayIso = toIsoDate(today);
  const completedCount = items.filter((item) => item.status === 'completed').length;
  const progressPct = items.length ? Math.round((completedCount / items.length) * 100) : 0;
  const visible = items.filter((item) => filter === 'all' || (filter === 'completed' ? item.status === 'completed' : item.status !== 'completed'));

  const setStatus = (id, status) => onUpdateTimeline(items.map((item) => (item.id === id ? { ...item, status } : item)));

  const handleAdd = (milestone) => {
    const added = [...items, { id: `t_${Date.now()}`, status: 'upcoming', ...milestone }];
    added.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    onUpdateTimeline(added);
    setShowAddDialog(false);
  };

  return (
    <div className="timeline-planner-wrapper">
      <div className="timeline-control-panel glass-panel">
        <div className="timeline-progress-group">
          <div className="progress-meta">
            <span className="progress-title" id="timeline-progress-label">Milestone progress</span>
            <span className="progress-stat-badge">{completedCount} of {items.length} done ({progressPct}%)</span>
          </div>
          <progress className="native-progress" aria-labelledby="timeline-progress-label" value={progressPct} max={100}>
            {progressPct}%
          </progress>
        </div>

        <div className="timeline-actions-group">
          <fieldset className="filter-pill-group" aria-label="Filter milestones">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`filter-btn ${filter === option.value ? 'active' : ''}`}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </fieldset>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setShowAddDialog(true)}>
            <Plus size={14} aria-hidden="true" /> Add milestone
          </button>
        </div>
      </div>

      <div className="timeline-track-container">
        <div className="vertical-timeline-line" aria-hidden="true" />
        <ol className="timeline-nodes-list">
          {visible.map((item, index) => {
            const isDone = item.status === 'completed';
            const isActive = item.status === 'in-progress';
            const isOverdue = !isDone && item.dueDate && item.dueDate < todayIso;
            return (
              <li key={item.id} className={`timeline-node-item ${item.status}`}>
                <button
                  type="button"
                  className={`node-status-dot ${isDone ? 'dot-done' : isActive ? 'dot-active' : 'dot-upcoming'}`}
                  onClick={() => setStatus(item.id, NEXT_STATUS[item.status])}
                  aria-label={`${index + 1}. ${item.title}: ${STATUS_LABEL[item.status]}. Change to ${STATUS_LABEL[NEXT_STATUS[item.status]]}`}
                >
                  {isDone ? <Check size={14} aria-hidden="true" /> : isActive ? <Clock size={13} aria-hidden="true" /> : <span className="dot-index" aria-hidden="true">{index + 1}</span>}
                </button>

                <div className="timeline-card glass-panel">
                  <div className="node-card-header">
                    <div className="node-tag-group">
                      <span className="phase-badge">{item.phase || 'Milestone'}</span>
                      {item.dueDate && <time className="phase-badge" dateTime={item.dueDate}>{item.time && item.time !== item.dueDate ? `${item.dueDate} · ${item.time}` : item.dueDate}</time>}
                      <span className={`status-pill ${item.status}`}>{STATUS_LABEL[item.status]}</span>
                      {isOverdue && <span className="status-pill overdue">Overdue</span>}
                    </div>
                    <div className="node-actions">
                      <button type="button" className="btn-status-toggle" onClick={() => setStatus(item.id, isDone ? 'upcoming' : 'completed')}>
                        {isDone ? 'Reopen' : 'Mark done'}
                        <span className="visually-hidden">: {item.title}</span>
                      </button>
                      <button
                        type="button"
                        className="btn-icon-danger"
                        onClick={() => onUpdateTimeline(items.filter((entry) => entry.id !== item.id))}
                        aria-label={`Delete milestone ${item.title}`}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <h3 className={`node-title ${isDone ? 'line-through' : ''}`}>{item.title}</h3>
                  {item.description && <p className="node-description">{item.description}</p>}
                </div>
              </li>
            );
          })}
        </ol>
        {!visible.length && <p className="empty-state">No milestones match this filter.</p>}
      </div>

      {showAddDialog && <AddMilestoneDialog eventDate={plan.date} onAdd={handleAdd} onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}
