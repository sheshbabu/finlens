import './IconButton.css';

export default function IconButton({ children, variant = 'default', onClick, isDisabled = false, isActive = false, className = '', ...props }) {
  const activeClass = isActive === true ? 'active' : '';
  const classes = ['icon-button', variant, activeClass, className].filter(Boolean).join(' ');

  function handleClick(e) {
    if (isDisabled === true) {
      e.preventDefault();
      return;
    }
    if (onClick !== undefined) {
      onClick(e);
    }
  }

  return (
    <button className={classes} onClick={handleClick} disabled={isDisabled} {...props}>
      {children}
    </button>
  );
}
