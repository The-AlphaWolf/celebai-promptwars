import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: labelled by its title, traps Tab focus, closes on
 * Escape or backdrop click, and returns focus to the opener on close.
 */
export default function Modal({ title, description, onClose, children, size = 'md' }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    const autofocus = dialog.querySelector('[data-autofocus]') || dialog.querySelector(FOCUSABLE);
    autofocus?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      {/* role="dialog" rather than <dialog>: showModal() is unavailable in jsdom, and this keeps one tested code path. */}
      <div
        ref={dialogRef}
        className={`modal-card glass-panel modal-${size}`}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="modal-header">
          <div>
            <h2 id={titleId} className="modal-title">{title}</h2>
            {description && <p id={descriptionId} className="modal-description">{description}</p>}
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
