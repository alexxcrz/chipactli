// Minimal config for the React app runtime
export const API = '';

export function apiUrl(path) {
  if (!path) return API || '';
  if (/^https?:\/\//.test(path)) return path;
  return `${API}${path}`;
}

export default { API };
