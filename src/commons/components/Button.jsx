import { LoadingSpinner } from './Icon.jsx';
import './Button.css';

export default function Button({ children, variant = '', type = 'button', isDisabled = false, isLoading = false, onClick, className = '', ...props }) {
  const isActuallyDisabled = isDisabled === true || isLoading === true;
  const disabledClass = isActuallyDisabled === true ? 'disabled' : '';
  const buttonClasses = ["button", variant, className, disabledClass].filter(Boolean).join(" ");

  function handleClick(e) {
    if (isActuallyDisabled === true) {
      e.preventDefault();
      return;
    }
    if (onClick !== undefined) {
      onClick(e);
    }
  }

  let content = children;
  if (isLoading === true) {
    content = (
      <>
        <LoadingSpinner size={16} />
        <span className="button-text">{children}</span>
      </>
    );
  }

  if (variant === 'ghost') {
    const ghostClasses = ['ghost-button', className, disabledClass].filter(Boolean).join(' ');
    return (
      <div className={ghostClasses} onClick={handleClick} disabled={isActuallyDisabled} {...props}>
        {content}
      </div>
    );
  }

  if (type === 'submit') {
    return (
      <button type={type} className={buttonClasses} disabled={isActuallyDisabled} onClick={handleClick} {...props}>
        {content}
      </button>
    );
  }

  return (
    <div className={buttonClasses} disabled={isActuallyDisabled} onClick={handleClick} {...props}>
      {content}
    </div>
  );
}
