import { useState } from 'react';
import { Bookmark, BookmarkCheck, Plus, Trash2, Wand2, Lightbulb } from 'lucide-react';
import Modal from './Modal';
import { sanitizeText } from '../domain/planSchema';
import { LIMITS } from '../domain/constants';
import './Modal.css';
import './IdeaGenerator.css';

function AddIdeaDialog({ onAdd, onClose }) {
  const [form, setForm] = useState({ title: '', category: '', description: '' });
  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const title = sanitizeText(form.title, LIMITS.title);
    if (!title) return;
    onAdd({ title, category: sanitizeText(form.category, 80) || 'Custom', description: sanitizeText(form.description, LIMITS.longText) });
  };

  return (
    <Modal title="Add idea" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="modal-body">
        <div className="form-group">
          <label htmlFor="idea-title">Idea</label>
          <input id="idea-title" type="text" value={form.title} onChange={update('title')} maxLength={LIMITS.title} required data-autofocus />
        </div>
        <div className="form-group">
          <label htmlFor="idea-category">Category</label>
          <input id="idea-category" type="text" value={form.category} onChange={update('category')} maxLength={80} placeholder="Food, Decor, Activity…" />
        </div>
        <div className="form-group">
          <label htmlFor="idea-description">Description</label>
          <textarea id="idea-description" rows="4" value={form.description} onChange={update('description')} maxLength={LIMITS.longText} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save idea</button>
        </div>
      </form>
    </Modal>
  );
}

export default function IdeaGenerator({ plan, onUpdateIdeas, onAskForIdeas, isBusy }) {
  const [favorites, setFavorites] = useState(() => new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const ideas = plan.creativeIdeas || [];

  const toggleFavorite = (id) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAdd = (idea) => {
    onUpdateIdeas([...ideas, { id: `c_${Date.now()}`, ...idea }]);
    setShowAddDialog(false);
  };

  return (
    <div className="ideas-wrapper">
      <div className="ideas-control-panel glass-panel">
        <div className="ideas-meta">
          <div className="idea-icon-badge" aria-hidden="true">
            <Lightbulb size={20} />
          </div>
          <div>
            <h2 className="panel-heading">Ideas for your guests</h2>
            <p>Matched to your theme, venue and notes</p>
          </div>
        </div>
        <div className="ideas-actions">
          <button type="button" className="btn-primary btn-sm" onClick={onAskForIdeas} disabled={isBusy}>
            <Wand2 size={14} aria-hidden="true" />
            <span>Suggest more</span>
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setShowAddDialog(true)}>
            <Plus size={14} aria-hidden="true" /> Add idea
          </button>
        </div>
      </div>

      <ul className="ideas-grid">
        {ideas.map((idea) => {
          const isSaved = favorites.has(idea.id);
          return (
            <li key={idea.id} className="idea-card glass-panel">
              <div className="idea-card-header">
                <span className="badge badge-idea-cat">{idea.category}</span>
                <div className="idea-actions">
                  <button
                    type="button"
                    className={`btn-fav ${isSaved ? 'is-fav' : ''}`}
                    onClick={() => toggleFavorite(idea.id)}
                    aria-pressed={isSaved}
                    aria-label={`Shortlist ${idea.title}`}
                  >
                    {isSaved ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    className="btn-icon-danger"
                    onClick={() => onUpdateIdeas(ideas.filter((entry) => entry.id !== idea.id))}
                    aria-label={`Remove ${idea.title}`}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <h3 className="idea-title">{idea.title}</h3>
              <p className="idea-description">{idea.description}</p>
            </li>
          );
        })}
      </ul>

      {showAddDialog && <AddIdeaDialog onAdd={handleAdd} onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}
