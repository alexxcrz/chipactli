const MIN_PASSWORD_LENGTH = Math.max(10, Number(process.env.MIN_PASSWORD_LENGTH || 10));

export function validarPasswordSegura(password = '') {
  const valor = String(password || '');
  if (valor.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      mensaje: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
    };
  }

  if (!/[a-z]/.test(valor) || !/[A-Z]/.test(valor) || !/[0-9]/.test(valor)) {
    return {
      ok: false,
      mensaje: 'La contraseña debe incluir al menos una letra minúscula, una mayúscula y un número.'
    };
  }

  return {
    ok: true,
    mensaje: ''
  };
}
