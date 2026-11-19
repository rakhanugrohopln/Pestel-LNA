export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const SESSION_TOKEN_KEY = 'plncorpu_session_token';
const UAT_GATE_TOKEN_KEY = 'plncorpu_uat_gate_token';

export function getUatGateToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(UAT_GATE_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setUatGateToken(token: string | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.sessionStorage.setItem(UAT_GATE_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(UAT_GATE_TOKEN_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

export function getSessionToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setSessionToken(token: string): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // Ignore storage access errors in restricted frames
  }
}

export function clearSessionToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // Ignore storage access errors
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function readCsrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const pairs = document.cookie.split(';');
  for (const part of pairs) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === 'plncorpu_csrf') {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return '';
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const sessionToken = getSessionToken();
  if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  if (path.startsWith('/api/auth/uat-login')) {
    const uatGateToken = getUatGateToken();
    if (uatGateToken && !headers.has('X-UAT-QC-Gate')) {
      headers.set('X-UAT-QC-Gate', uatGateToken);
    }
  }

  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrf = readCsrfCookie();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (
    response.status === 401 &&
    !path.startsWith('/api/auth/login') &&
    !path.startsWith('/api/auth/bootstrap') &&
    !path.startsWith('/api/auth/uat-login') &&
    !path.startsWith('/api/auth/admin-recovery')
  ) {
    clearSessionToken();
    unauthorizedHandler?.();
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    const csvText = await response.text();
    if (!response.ok) {
      throw new ApiError(csvText || 'Permintaan ekspor gagal.', response.status);
    }
    return csvText as unknown as T;
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (!response.ok) {
    const msg =
      (typeof body.message === 'string' && body.message) ||
      (typeof body.error === 'string' && body.error) ||
      `Permintaan gagal (HTTP ${response.status})`;
    throw new ApiError(msg, response.status, body);
  }

  return body as T;
}
