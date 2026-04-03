import React, { useMemo, useState } from 'react';
import './PasswordInput.css';

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5C6.5 5 2 9.5 1 12c1 2.5 5.5 7 11 7s10-4.5 11-7c-1-2.5-5.5-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
      <circle cx="12" cy="12" r="2.1" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.3 2 2 3.3l3.4 3.4C3.2 8.2 1.6 10.4 1 12c1 2.5 5.5 7 11 7 2.2 0 4.3-.7 6.1-1.8l2.6 2.6 1.3-1.3L3.3 2Zm8.7 15c-4.5 0-8-3.6-9.1-5 .7-1.3 2-3 3.8-4.2l1.8 1.8a4 4 0 0 0 5.6 5.6l1.7 1.7c-1.2.7-2.5 1.1-3.8 1.1Zm10-5c-.9-2.2-3.8-5.8-8.1-6.8l1.7 1.7c2.8.8 4.9 3.1 5.8 5.1-.4.8-1.2 1.9-2.3 2.9l1.4 1.4c1.3-1.2 2.2-2.6 2.5-3.3Z" />
    </svg>
  );
}

const PasswordInput = React.forwardRef(function PasswordInput({ className = '', inputClassName = '', ...props }, ref) {
  const [visible, setVisible] = useState(false);

  const combinedClassName = useMemo(() => {
    const base = [className, inputClassName, 'passwordInputField'].filter(Boolean).join(' ');
    return base.trim();
  }, [className, inputClassName]);

  return (
    <div className="passwordInputWrap">
      <input
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={combinedClassName}
        autoCapitalize={props.autoCapitalize || 'none'}
        autoCorrect={typeof props.autoCorrect === 'undefined' ? 'off' : props.autoCorrect}
        spellCheck={typeof props.spellCheck === 'undefined' ? false : props.spellCheck}
      />
      <button
        type="button"
        className="passwordToggleBtn"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onClick={() => setVisible((prev) => !prev)}
        onMouseDown={(event) => event.preventDefault()}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
});

export default PasswordInput;
