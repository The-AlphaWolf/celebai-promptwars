import { useMemo, useState } from 'react';
import { DollarSign, Plus, Trash2, PieChart, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import { summarizeBudget } from '../domain/planner';
import { sanitizeText, clampNumber } from '../domain/planSchema';
import { PALETTE, LIMITS } from '../domain/constants';
import './Modal.css';
import './BudgetPlanner.css';

const usd = (value) => `$${Math.round(value).toLocaleString('en-US')}`;

function donutGradient(items, allocated) {
  if (allocated <= 0) return 'rgba(255, 255, 255, 0.1)';
  let start = 0;
  const stops = items.map((item) => {
    const end = start + (item.allocated / allocated) * 100;
    const stop = `${item.color} ${start}% ${end}%`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function AddCategoryDialog({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const [allocated, setAllocated] = useState('');
  const [color, setColor] = useState(PALETTE[2]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const category = sanitizeText(name, 80);
    if (!category) return;
    onAdd({ category, allocated: Math.round(clampNumber(allocated, 0, LIMITS.budget.max, 0)), color });
  };

  return (
    <Modal title="Add budget category" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="modal-body">
        <div className="form-group">
          <label htmlFor="category-name">Category name</label>
          <input id="category-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required data-autofocus />
        </div>
        <div className="form-group">
          <label htmlFor="category-amount">Allocated amount (USD)</label>
          <input id="category-amount" type="number" min="0" value={allocated} onChange={(e) => setAllocated(e.target.value)} required />
        </div>
        <fieldset className="form-group">
          <legend>Colour</legend>
          <div className="color-picker-row">
            {PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`color-swatch ${color === swatch ? 'selected' : ''}`}
                style={{ backgroundColor: swatch }}
                onClick={() => setColor(swatch)}
                aria-label={`Colour ${swatch}`}
                aria-pressed={color === swatch}
              />
            ))}
          </div>
        </fieldset>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Add category</button>
        </div>
      </form>
    </Modal>
  );
}

export default function BudgetPlanner({ plan, onUpdateBudget }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const totals = useMemo(() => summarizeBudget(plan), [plan]);
  const donutBackground = useMemo(() => donutGradient(totals.items, totals.allocated), [totals]);

  const handleAmountChange = (id, field, value) => {
    const amount = Math.round(clampNumber(value, 0, LIMITS.budget.max, 0));
    onUpdateBudget(plan.budgetItems.map((item) => (item.id === id ? { ...item, [field]: amount } : item)));
  };

  const handleAdd = ({ category, allocated, color }) => {
    onUpdateBudget([...plan.budgetItems, { id: `b_${Date.now()}`, category, allocated, spent: 0, color }]);
    setShowAddDialog(false);
  };

  const overBudget = totals.remaining < 0;

  return (
    <div className="budget-planner-wrapper">
      <div className="budget-stat-grid">
        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">Total budget</span>
            <DollarSign size={16} className="stat-icon icon-purple" aria-hidden="true" />
          </div>
          <div className="stat-value">{usd(totals.budget)}</div>
          <div className="stat-subtitle">{totals.allocationPct}% allocated · {usd(totals.contingency)} in reserve</div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">Spent so far</span>
            <TrendingUp size={16} className="stat-icon icon-emerald" aria-hidden="true" />
          </div>
          <div className="stat-value text-emerald">{usd(totals.spent)}</div>
          <div className="stat-subtitle">Across {totals.items.length} categories</div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-header">
            <span className="stat-label">{overBudget ? 'Over budget' : 'Unallocated'}</span>
            {overBudget ? (
              <AlertTriangle size={16} className="stat-icon icon-danger" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={16} className="stat-icon icon-emerald" aria-hidden="true" />
            )}
          </div>
          <div className={`stat-value ${overBudget ? 'text-danger' : 'text-primary'}`}>{usd(Math.abs(totals.remaining))}</div>
          <div className="stat-subtitle">{overBudget ? 'Allocations exceed the total budget' : 'Not yet assigned to a category'}</div>
        </div>
      </div>

      <div className="budget-content-grid">
        <section className="budget-chart-panel glass-panel" aria-labelledby="budget-chart-title">
          <div className="panel-title-row">
            <div className="panel-title-group">
              <PieChart size={18} className="panel-icon" aria-hidden="true" />
              <h2 id="budget-chart-title" className="panel-heading">Allocation</h2>
            </div>
          </div>

          <div className="donut-container">
            <div
              className="donut-circle"
              style={{ background: donutBackground }}
              // CSS-drawn chart, described by aria-label and the legend below.
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="img"
              aria-label={`Budget allocation: ${totals.items.map((item) => `${item.category} ${item.percentage}%`).join(', ')}`}
            >
              <div className="donut-hole">
                <span className="donut-amount">{usd(totals.allocated)}</span>
                <span className="donut-label">Allocated</span>
              </div>
            </div>
          </div>

          <ul className="donut-legend">
            {totals.items.map((item) => (
              <li key={item.id} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span className="legend-name">{item.category}</span>
                <span className="legend-pct">{item.percentage}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="budget-table-panel glass-panel" aria-labelledby="budget-table-title">
          <div className="panel-title-row">
            <div className="panel-title-group">
              <DollarSign size={18} className="panel-icon" aria-hidden="true" />
              <h2 id="budget-table-title" className="panel-heading">Categories</h2>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setShowAddDialog(true)}>
              <Plus size={14} aria-hidden="true" /> Add category
            </button>
          </div>

          <div className="budget-table-scroll">
            <table className="budget-table">
              <caption className="visually-hidden">Budget categories with allocated and spent amounts</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Share</th>
                  <th scope="col">Allocated</th>
                  <th scope="col">Spent</th>
                  <th scope="col">Used</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {totals.items.map((item) => {
                  const usedPct = item.allocated > 0 ? Math.round((item.spent / item.allocated) * 100) : 0;
                  const isOver = item.spent > item.allocated;
                  return (
                    <tr key={item.id}>
                      <th scope="row">
                        <div className="category-cell">
                          <span className="cat-indicator" style={{ backgroundColor: item.color }} aria-hidden="true" />
                          <span className="cat-name">{item.category}</span>
                        </div>
                      </th>
                      <td><span className="pct-badge">{item.percentage}%</span></td>
                      <td>
                        <div className="amount-input-box">
                          <span aria-hidden="true">$</span>
                          <input
                            type="number"
                            value={item.allocated}
                            onChange={(e) => handleAmountChange(item.id, 'allocated', e.target.value)}
                            min="0"
                            step="50"
                            aria-label={`Allocated to ${item.category}`}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="amount-input-box">
                          <span aria-hidden="true">$</span>
                          <input
                            type="number"
                            value={item.spent}
                            onChange={(e) => handleAmountChange(item.id, 'spent', e.target.value)}
                            min="0"
                            step="50"
                            aria-label={`Spent on ${item.category}`}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="progress-cell">
                          <div className="mini-progress-bar" aria-hidden="true">
                            <div
                              className={`mini-progress-fill ${isOver ? 'fill-danger' : ''}`}
                              style={{ width: `${Math.min(100, usedPct)}%`, backgroundColor: isOver ? '#EF4444' : item.color }}
                            />
                          </div>
                          <span className={`progress-label ${isOver ? 'text-danger' : ''}`}>
                            {usedPct}%{isOver && <span className="visually-hidden"> (over allocation)</span>}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-icon-danger"
                          onClick={() => onUpdateBudget(plan.budgetItems.filter((entry) => entry.id !== item.id))}
                          aria-label={`Remove ${item.category}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showAddDialog && <AddCategoryDialog onAdd={handleAdd} onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}
