import { useState, useRef, useEffect, useId } from 'react';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { THEMES } from '../config/themes';
import './ThemeSelector.css';

const swatch = (theme) => ({ background: `linear-gradient(135deg, ${theme.previewColor}, ${theme.accentColor})` });

/** Disclosure menu of colour themes. Closes on Escape or outside click and restores focus. */
export default function ThemeSelector({ currentTheme, onSelectTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();
  const active = THEMES.find((theme) => theme.id === currentTheme) || THEMES[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div className="theme-selector-dropdown" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="theme-trigger-btn"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={menuId}
      >
        <span className="theme-dot" style={swatch(active)} aria-hidden="true" />
        <Palette size={14} className="theme-icon" aria-hidden="true" />
        <span className="theme-active-name">
          <span className="visually-hidden">Colour theme: </span>
          {active.name}
        </span>
        <ChevronDown size={13} className={`theme-chevron ${isOpen ? 'rotate' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <ul id={menuId} className="theme-menu glass-panel theme-list">
          {THEMES.map((theme) => {
            const isSelected = theme.id === currentTheme;
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  className={`theme-option-row ${isSelected ? 'selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onSelectTheme(theme.id);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <span className="theme-option-left">
                    <span className="option-swatch" style={swatch(theme)} aria-hidden="true" />
                    <span className="theme-text-block">
                      <span className="theme-name">{theme.name}</span>
                      <span className="theme-mood">{theme.mood}</span>
                    </span>
                  </span>
                  {isSelected && <Check size={14} className="check-indicator" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
