// Backend endpoints, resolved once at build time.
// VITE_API_URL may be a full URL (https://api.example.com) or a bare host (api.example.com).
// VITE_WS_URL is optional — it defaults to the API URL with http(s) swapped for ws(s).
const withScheme = (url: string, scheme: string) =>
    (/^[a-z]+:\/\//i.test(url) ? url : `${scheme}://${url}`).replace(/\/+$/, '');

export const API_BASE = withScheme(import.meta.env.VITE_API_URL || 'http://localhost:3001', 'https');

export const WS_BASE = import.meta.env.VITE_WS_URL
    ? withScheme(import.meta.env.VITE_WS_URL, 'wss')
    : API_BASE.replace(/^http/, 'ws');
