import { useState } from 'react';
import { Plus, Trash2, Filter } from 'lucide-react';
import Modal from './Modal';
import { sanitizeText, clampNumber } from '../domain/planSchema';
import { VENDOR_STATUSES, VENDOR_PRIORITIES, LIMITS } from '../domain/constants';
import './Modal.css';
import './VendorChecklist.css';

const usd = (value) => `$${Math.round(value || 0).toLocaleString('en-US')}`;
const EMPTY_VENDOR = { category: '', name: '', contact: '', cost: '', priority: 'High', notes: '' };

function AddVendorDialog({ onAdd, onClose }) {
  const [form, setForm] = useState(EMPTY_VENDOR);
  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = sanitizeText(form.name, LIMITS.title);
    if (!name) return;
    onAdd({
      name,
      category: sanitizeText(form.category, 80) || 'General',
      contact: sanitizeText(form.contact, 120),
      cost: Math.round(clampNumber(form.cost, 0, LIMITS.budget.max, 0)),
      priority: form.priority,
      notes: sanitizeText(form.notes, LIMITS.longText),
    });
  };

  return (
    <Modal title="Add vendor" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="modal-body">
        <div className="form-group">
          <label htmlFor="vendor-name">Vendor or service</label>
          <input id="vendor-name" type="text" value={form.name} onChange={update('name')} maxLength={LIMITS.title} required data-autofocus />
        </div>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="vendor-category">Category</label>
            <input id="vendor-category" type="text" value={form.category} onChange={update('category')} maxLength={80} placeholder="Catering, Venue, DJ…" />
          </div>
          <div className="form-group">
            <label htmlFor="vendor-priority">Priority</label>
            <select id="vendor-priority" value={form.priority} onChange={update('priority')}>
              {VENDOR_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="vendor-contact">Contact</label>
            <input id="vendor-contact" type="text" value={form.contact} onChange={update('contact')} maxLength={120} />
          </div>
          <div className="form-group">
            <label htmlFor="vendor-cost">Estimated cost (USD)</label>
            <input id="vendor-cost" type="number" min="0" value={form.cost} onChange={update('cost')} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="vendor-notes">Notes</label>
          <textarea id="vendor-notes" rows="3" value={form.notes} onChange={update('notes')} maxLength={LIMITS.longText} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save vendor</button>
        </div>
      </form>
    </Modal>
  );
}

export default function VendorChecklist({ plan, onUpdateVendors }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');

  const vendors = plan.vendors || [];
  const bookedCount = vendors.filter((vendor) => vendor.status === 'Booked').length;
  const categories = ['all', ...new Set(vendors.map((vendor) => vendor.category))];
  const visible = filterCategory === 'all' ? vendors : vendors.filter((vendor) => vendor.category === filterCategory);

  const handleAdd = (vendor) => {
    onUpdateVendors([...vendors, { id: `v_${Date.now()}`, status: 'To Research', ...vendor }]);
    setShowAddDialog(false);
  };

  return (
    <div className="vendors-wrapper">
      <div className="vendors-control-panel glass-panel">
        <div className="vendor-stats-group">
          <div className="vendor-stat-item">
            <span className="vendor-stat-num">{bookedCount} / {vendors.length}</span>
            <span className="vendor-stat-label" id="vendors-booked-label">Vendors booked</span>
          </div>
          <div className="vendor-progress-container">
            <progress className="native-progress" aria-labelledby="vendors-booked-label" value={bookedCount} max={Math.max(vendors.length, 1)}>
              {bookedCount} of {vendors.length}
            </progress>
          </div>
        </div>

        <div className="vendors-filter-group">
          <div className="category-select-wrapper">
            <Filter size={14} className="filter-icon" aria-hidden="true" />
            <label htmlFor="vendor-filter" className="visually-hidden">Filter vendors by category</label>
            <select id="vendor-filter" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="cat-filter-select">
              {categories.map((category) => (
                <option key={category} value={category}>{category === 'all' ? 'All categories' : category}</option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setShowAddDialog(true)}>
            <Plus size={14} aria-hidden="true" /> Add vendor
          </button>
        </div>
      </div>

      <ul className="vendors-grid">
        {visible.map((vendor) => (
          <li key={vendor.id} className={`vendor-card glass-panel ${vendor.status === 'Booked' ? 'card-booked' : ''}`}>
            <div className="vendor-card-header">
              <div className="vendor-meta-tags">
                <span className="badge badge-category">{vendor.category}</span>
                <span className={`badge-priority priority-${vendor.priority.toLowerCase()}`}>{vendor.priority} priority</span>
              </div>
              <button
                type="button"
                className="btn-icon-danger"
                onClick={() => onUpdateVendors(vendors.filter((entry) => entry.id !== vendor.id))}
                aria-label={`Remove ${vendor.name}`}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>

            <h3 className="vendor-name">{vendor.name}</h3>

            <dl className="vendor-info-rows">
              <div className="vendor-info-row">
                <dt className="info-label">Contact</dt>
                <dd className="info-value text-contact">{vendor.contact || 'To be sourced'}</dd>
              </div>
              <div className="vendor-info-row">
                <dt className="info-label">Budget</dt>
                <dd className="info-value text-cost">{usd(vendor.cost)}</dd>
              </div>
            </dl>

            {vendor.notes && (
              <div className="vendor-notes-box">
                <p>{vendor.notes}</p>
              </div>
            )}

            <div className="vendor-card-footer">
              <label htmlFor={`vendor-status-${vendor.id}`} className="status-label">Status</label>
              <select
                id={`vendor-status-${vendor.id}`}
                value={vendor.status}
                onChange={(e) => onUpdateVendors(vendors.map((entry) => (entry.id === vendor.id ? { ...entry, status: e.target.value } : entry)))}
                className={`status-select ${vendor.status.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {VENDOR_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </li>
        ))}
      </ul>

      {showAddDialog && <AddVendorDialog onAdd={handleAdd} onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}
