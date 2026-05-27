import { useRef } from 'react';
import './NativePickerField.css';

export default function NativePickerField({
  type,
  value,
  onChange,
  displayValue,
  placeholder,
  className = '',
  displayClassName = '',
  inputClassName = '',
  leading = null,
  trailing = null,
  disabled = false,
  required = false,
  min,
  max,
  step,
  name,
  id,
  ariaLabel,
}) {
  const inputRef = useRef(null);
  const wrapperClassName = ['native-picker-field', className, disabled ? 'is-disabled' : '']
    .filter(Boolean)
    .join(' ');

  const displayText = displayValue || placeholder || '';
  const displayClasses = ['native-picker-display', !value ? 'is-placeholder' : '', displayClassName]
    .filter(Boolean)
    .join(' ');
  const openPicker = () => {
    if (disabled) return;
    if (typeof inputRef.current?.showPicker === 'function') {
      inputRef.current.showPicker();
    }
  };

  return (
    <div className={wrapperClassName} onClick={openPicker}>
      {leading ? <span className="native-picker-leading" aria-hidden="true">{leading}</span> : null}
      <span className={displayClasses}>{displayText}</span>
      {trailing ? <span className="native-picker-trailing" aria-hidden="true">{trailing}</span> : null}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className={['native-picker-input', inputClassName].filter(Boolean).join(' ')}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
      />
    </div>
  );
}
