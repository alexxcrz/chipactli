// API Wrapper - Fetch simplificado
const API = "http://localhost:3001";

export async function fetchAPI(endpoint, options = {}) {
  const url = `${API}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const config = { ...defaultOptions, ...options };
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }
  
  const respuesta = await fetch(url, config);
  return respuesta;
}

export async function fetchAPIJSON(endpoint, options = {}) {
  const respuesta = await fetchAPI(endpoint, options);
  if (!respuesta.ok) {
    const error = await respuesta.json();
    throw new Error(error.error || 'Error en la solicitud');
  }
  return await respuesta.json();
}
