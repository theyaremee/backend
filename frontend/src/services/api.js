const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

let _token = null;

export function setToken(t) { _token = t; }
export function getToken()  { return _token; }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Try token refresh
    const refreshed = await refreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${_token}`;
      const retry = await fetch(`${BASE}${path}`, {
        method, headers, credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      return retry.json();
    }
    // Refresh failed — clear token so app shows login
    _token = null;
    throw new Error('session_expired');
  }

  return res.json();
}

async function refreshToken() {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    _token = data.token;
    return true;
  } catch {
    return false;
  }
}

export const api = {
  login:          (init_data) => request('POST', '/auth/login', { init_data }),
  getMe:          () => request('GET', '/me'),
  setGender:      (gender)    => request('POST', '/me/gender', { gender }),
  getTokenHistory:() => request('GET', '/me/tokens'),

  getTasks:       () => request('GET', '/tasks'),
  claimTask:      (task_id)   => request('POST', '/tasks/claim', { task_id }),

  getReferrals:   () => request('GET', '/referrals'),

  getVipPlans:    () => request('GET', '/vip/plans'),
  createStarsInvoice: (plan) => request('POST', '/payments/stars/invoice', { plan }),
  createQrisPayment:  (plan) => request('POST', '/payments/qris/create', { plan }),
};
