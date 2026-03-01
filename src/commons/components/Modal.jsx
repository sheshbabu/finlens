import { createPortal } from 'react-dom';
import { CloseIcon } from './Icon.jsx';
import './Modal.css';

export function ModalBackdrop({ children, onClose, isCentered = true }) {
  function handleBackdropClick(e) {
    if (e.target.classList.contains('modal-backdrop-container')) {
      onClose();
    }
  }

  const backdropClasses = `modal-backdrop-container ${isCentered === true ? 'is-centered' : ''}`;

  return createPortal(
    <div className={backdropClasses} onClick={handleBackdropClick}>
      {children}
    </div>,
    document.body
  );
}

export function ModalContainer({ children, className = '' }) {
  const containerClasses = `modal-content-container ${className}`.trim();
  return <div className={containerClasses}>{children}</div>;
}

export function ModalHeader({ title, onClose }) {
  return (
    <div className="modal-header">
      {title !== undefined ? <h3 className="modal-title">{title}</h3> : null}
      {onClose !== undefined ? <CloseIcon className="modal-close-button" onClick={onClose} /> : null}
    </div>
  );
}

export function ModalContent({ children, className = '' }) {
  const contentClasses = `modal-content ${className}`.trim();
  return <div className={contentClasses}>{children}</div>;
}
