import './SegmentedControl.css';

export default function SegmentedControl({ options, value, onChange, isDisabled = false }) {
  const optionElements = options.map(function (option) {
    const isSelected = option.value === value;
    let className = isSelected === true ? 'segment selected' : 'segment';
    if (isDisabled === true) {
      className += ' is-disabled';
    }
    return (
      <button
        key={option.value}
        className={className}
        onClick={() => isDisabled !== true && onChange(option.value)}
        disabled={isDisabled}
      >
        {option.label}
      </button>
    );
  });

  let containerClassName = 'segmented-control';
  if (isDisabled === true) {
    containerClassName += ' is-disabled';
  }

  return <div className={containerClassName}>{optionElements}</div>;
}
