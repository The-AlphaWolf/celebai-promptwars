import { Sparkles, Download, Heart, Cake, Users } from 'lucide-react';
import ThemeSelector from './ThemeSelector';
import './Navbar.css';

const SAMPLE_BUTTONS = [
  { type: 'wedding', label: 'Wedding', Icon: Heart },
  { type: 'birthday', label: 'Birthday', Icon: Cake },
  { type: 'community', label: 'Community', Icon: Users },
];

const AI_STATUS = {
  checking: { label: 'Checking AI…', className: 'dot-demo' },
  live: { label: 'Gemini connected', className: 'dot-active' },
  offline: { label: 'Offline planning engine', className: 'dot-demo' },
};

export default function Navbar({ currentEventType, onLoadSample, aiStatus, onExportPdf, isBusy, currentTheme, onSelectTheme }) {
  const status = AI_STATUS[aiStatus] || AI_STATUS.offline;

  return (
    <header className="navbar-wrapper">
      <div className="navbar-container">
        <div className="navbar-brand">
          <div className="brand-icon-box" aria-hidden="true">
            <Sparkles className="brand-sparkle" size={20} />
          </div>
          <div className="brand-text-group">
            <span className="brand-title">
              Celeb<span className="brand-highlight">AI</span>
            </span>
            <span className="brand-badge">Event planner</span>
          </div>
        </div>

        <nav className="event-nav-pills" aria-label="Load a sample plan">
          {SAMPLE_BUTTONS.map(({ type, label, Icon }) => (
            <button
              key={type}
              type="button"
              className={`event-pill-btn ${currentEventType === type ? `active ${type}` : ''}`}
              aria-pressed={currentEventType === type}
              onClick={() => onLoadSample(type)}
              disabled={isBusy}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
              <span className="visually-hidden"> sample</span>
            </button>
          ))}
        </nav>

        <div className="navbar-actions">
          <ThemeSelector currentTheme={currentTheme} onSelectTheme={onSelectTheme} />

          <output className={`api-key-btn ${aiStatus === 'live' ? 'connected' : 'unconfigured'}`}>
            <span className={`status-dot ${status.className}`} aria-hidden="true" />
            <span>{status.label}</span>
          </output>

          <button type="button" className="btn-export" onClick={onExportPdf} disabled={isBusy}>
            <Download size={15} aria-hidden="true" />
            <span className="export-text">Export PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
}
