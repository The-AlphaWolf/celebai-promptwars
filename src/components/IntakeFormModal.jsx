import { useState } from 'react';
import { Wand2, Calendar, Users, DollarSign, MapPin } from 'lucide-react';
import Modal from './Modal';
import { getPresetIntake, presetLabel, PRESET_TYPES } from '../domain/presets';
import { LIMITS } from '../domain/constants';
import './Modal.css';
import './IntakeFormModal.css';

const EVENT_OPTIONS = [
  { value: 'wedding', icon: '💍', title: 'Wedding', description: 'Ceremonies and receptions' },
  { value: 'birthday', icon: '🎂', title: 'Birthday', description: 'Milestones and parties' },
  { value: 'community', icon: '🎪', title: 'Community', description: 'Festivals, fairs and fundraisers' },
];

export default function IntakeFormModal({ onClose, onGenerate, isGenerating }) {
  const [formData, setFormData] = useState(() => getPresetIntake('wedding'));
  const update = (field) => (event) => setFormData((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onGenerate({ ...formData, guestCount: Number(formData.guestCount), budget: Number(formData.budget) });
  };

  return (
    <Modal
      title="Plan a new event"
      description="Tell us the essentials. The planning engine sizes the budget, schedule and vendors to your date, headcount and venue."
      onClose={onClose}
      size="lg"
    >
      <fieldset className="preset-bar" aria-label="Fill the form with a sample event">
        <span className="preset-label">Samples:</span>
        {PRESET_TYPES.map((type) => (
          <button key={type} type="button" className="preset-btn" onClick={() => setFormData(getPresetIntake(type))}>
            {presetLabel(type)}
          </button>
        ))}
      </fieldset>

      <form onSubmit={handleSubmit} className="modal-body">
        <fieldset className="form-group">
          <legend>Event type</legend>
          <div className="event-type-grid">
            {EVENT_OPTIONS.map((option) => (
              <label key={option.value} className={`type-card ${formData.eventType === option.value ? `selected ${option.value}` : ''}`}>
                <input
                  type="radio"
                  name="eventType"
                  value={option.value}
                  checked={formData.eventType === option.value}
                  onChange={update('eventType')}
                  className="visually-hidden"
                />
                <span className="type-icon" aria-hidden="true">{option.icon}</span>
                <span className="type-title">{option.title}</span>
                <span className="type-desc">{option.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="intake-title">Event name</label>
            <input id="intake-title" type="text" value={formData.title} onChange={update('title')} maxLength={LIMITS.title} required data-autofocus />
          </div>
          <div className="form-group">
            <label htmlFor="intake-date">Date</label>
            <div className="input-with-icon">
              <Calendar size={16} className="field-icon" aria-hidden="true" />
              <input id="intake-date" type="date" value={formData.date} onChange={update('date')} required />
            </div>
          </div>
        </div>

        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="intake-guests">Guest count</label>
            <div className="input-with-icon">
              <Users size={16} className="field-icon" aria-hidden="true" />
              <input
                id="intake-guests"
                type="number"
                min={LIMITS.guests.min}
                max={LIMITS.guests.max}
                value={formData.guestCount}
                onChange={update('guestCount')}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="intake-budget">Total budget (USD)</label>
            <div className="input-with-icon">
              <DollarSign size={16} className="field-icon" aria-hidden="true" />
              <input
                id="intake-budget"
                type="number"
                min={LIMITS.budget.min}
                max={LIMITS.budget.max}
                step="100"
                value={formData.budget}
                onChange={update('budget')}
                required
              />
            </div>
          </div>
        </div>

        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="intake-location">Venue or area</label>
            <div className="input-with-icon">
              <MapPin size={16} className="field-icon" aria-hidden="true" />
              <input id="intake-location" type="text" value={formData.location} onChange={update('location')} maxLength={LIMITS.shortText} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="intake-setting">Setting</label>
            <select id="intake-setting" value={formData.setting || ''} onChange={update('setting')} aria-describedby="intake-setting-hint">
              <option value="">Detect from venue</option>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
              <option value="mixed">Indoor and outdoor</option>
            </select>
            <p id="intake-setting-hint" className="form-hint">Outdoor events get weather backup and a larger reserve.</p>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="intake-theme">Theme or style</label>
          <input id="intake-theme" type="text" value={formData.theme} onChange={update('theme')} maxLength={LIMITS.shortText} />
        </div>

        <div className="form-group">
          <label htmlFor="intake-notes">Special requirements</label>
          <textarea
            id="intake-notes"
            rows="3"
            value={formData.notes}
            onChange={update('notes')}
            maxLength={LIMITS.longText}
            placeholder="Dietary needs, accessibility, kids, music…"
          />
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary btn-generate" disabled={isGenerating}>
            {isGenerating ? <span className="btn-spinner" aria-hidden="true" /> : <Wand2 size={16} aria-hidden="true" />}
            <span>{isGenerating ? 'Building plan…' : 'Build my plan'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
