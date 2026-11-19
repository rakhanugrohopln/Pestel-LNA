import crypto from 'node:crypto';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { getStore, isProductionEnvironment, isUatQuickLoginAllowed, mutateStore } from './store.ts';
import type { UserProfile } from '../src/shared/types.ts';

const SESSION_COOKIE_NAME = 'plncorpu_session';
const CSRF_COOKIE_NAME = 'plncorpu_csrf';
const UAT_QC_COOKIE_NAME = 'plncorpu_uat_qc';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const UAT_QC_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours

// Sliding-window rate limiter for auth endpoints
const authRateWindows = new Map<string, number[]>();
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX = 25;

export type AuthTransport = 'cookie' | 'bearer' | 'none';

export function checkAuthRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const timestamps = (authRateWindows.get(key) || []).filter((t) => now - t < AUTH_RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= AUTH_RATE_LIMIT_MAX) {
    res.status(429).json({
      error: 'Terlalu banyak percobaan login. Silakan coba lagi dalam beberapa menit.',
    });
    return;
  }
  timestamps.push(now);
  authRateWindows.set(key, timestamps);
  next();
}

export function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret !== 'CHANGE_ME_TO_STRONG_RANDOM_SECRET') {
    return envSecret;
  }
  const store = getStore();
  if (store.sessionSigningKey && store.sessionSigningKey.length >= 32) {
    return store.sessionSigningKey;
  }
  return mutateStore((state) => {
    if (!state.sessionSigningKey || state.sessionSigningKey.length < 32) {
      state.sessionSigningKey = crypto.randomBytes(32).toString('hex');
    }
    return state.sessionSigningKey;
  });
}

export function isSessionSecretConfigured(): boolean {
  const s = process.env.SESSION_SECRET?.trim();
  if (s && s !== 'CHANGE_ME_TO_STRONG_RANDOM_SECRET' && s.length >= 16) {
    return true;
  }
  const store = getStore();
  return Boolean(store.sessionSigningKey && store.sessionSigningKey.length >= 32);
}

export function isAdminRecoveryConfigured(): boolean {
  const key = process.env.ADMIN_RECOVERY_KEY?.trim();
  return Boolean(key && key.length >= 12);
}

export function verifyAdminRecoveryKey(candidate: string): boolean {
  const configured = process.env.ADMIN_RECOVERY_KEY?.trim();
  if (!configured || configured.length < 12 || !candidate) return false;
  const a = crypto.createHash('sha256').update(candidate.trim(), 'utf8').digest();
  const b = crypto.createHash('sha256').update(configured, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

export function getAppEnv(): string {
  if (isProductionEnvironment()) return 'production';
  return (process.env.APP_ENV || process.env.NODE_ENV || 'staging').toLowerCase();
}

export function isUatPasscodeRequired(): boolean {
  return Boolean(process.env.UAT_QC_PASSCODE?.trim());
}

function signUatQcToken(exp: number): string {
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = Buffer.from(JSON.stringify({ scope: 'uat-qc', exp, nonce }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(`uat-qc:${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyUatQcToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(`uat-qc:${payload}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      scope?: string;
      exp?: number;
    };
    return parsed.scope === 'uat-qc' && typeof parsed.exp === 'number' && Date.now() <= parsed.exp;
  } catch {
    return false;
  }
}

function isAllowedStagingOrigin(req: Request): boolean {
  const candidates = [
    String(req.headers.origin || ''),
    String(req.headers.referer || ''),
    String(req.headers['x-forwarded-host'] || ''),
    String(req.headers.host || ''),
  ]
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  if (candidates.length === 0) return false;

  const appHost = (() => {
    try {
      return process.env.APP_URL ? new URL(process.env.APP_URL).hostname.toLowerCase() : '';
    } catch {
      return '';
    }
  })();

  return candidates.some((val) => {
    let host = val;
    if (val.startsWith('http://') || val.startsWith('https://')) {
      try {
        host = new URL(val).hostname.toLowerCase();
      } catch {
        return false;
      }
    } else {
      host = val.split(':')[0];
    }
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'aistudio.google.com' ||
      host.endsWith('.run.app') ||
      host.endsWith('.googleusercontent.com') ||
      (Boolean(appHost) && host === appHost)
    );
  });
}

export function verifyUatQcPasscode(candidate: string): boolean {
  const configured = process.env.UAT_QC_PASSCODE?.trim();
  if (!configured || !candidate) return false;
  const a = crypto.createHash('sha256').update(candidate.trim(), 'utf8').digest();
  const b = crypto.createHash('sha256').update(configured, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueUatQcGateIfAllowed(req: Request, res: Response): string | undefined {
  if (!isUatQuickLoginAllowed() || isUatPasscodeRequired()) {
    return undefined;
  }
  if (!isAllowedStagingOrigin(req)) {
    return undefined;
  }
  const existingCookie = req.cookies?.[UAT_QC_COOKIE_NAME];
  if (typeof existingCookie === 'string' && verifyUatQcToken(existingCookie)) {
    return existingCookie;
  }
  const token = signUatQcToken(Date.now() + UAT_QC_TTL_MS);
  res.cookie(UAT_QC_COOKIE_NAME, token, buildCookieOptions(req, true, true));
  return token;
}

export function authorizeUatQcWithPasscode(req: Request, res: Response, passcode: string): string | null {
  if (!isUatQuickLoginAllowed() || !verifyUatQcPasscode(passcode)) {
    return null;
  }
  const token = signUatQcToken(Date.now() + UAT_QC_TTL_MS);
  res.cookie(UAT_QC_COOKIE_NAME, token, buildCookieOptions(req, true, true));
  return token;
}

export function verifyUatQcPermission(req: Request): boolean {
  if (!isUatQuickLoginAllowed()) return false;
  const cookieToken = req.cookies?.[UAT_QC_COOKIE_NAME];
  if (typeof cookieToken === 'string' && verifyUatQcToken(cookieToken)) {
    return true;
  }
  const headerGate = req.headers['x-uat-qc-gate'];
  if (typeof headerGate === 'string' && verifyUatQcToken(headerGate.trim())) {
    return true;
  }
  if (isUatPasscodeRequired()) {
    const keyHeader = req.headers['x-uat-qc-key'];
    if (typeof keyHeader === 'string' && verifyUatQcPasscode(keyHeader)) {
      return true;
    }
  }
  return false;
}

export interface SessionPayload {
  uid: string;
  sessionId: string;
  exp: number;
  iat?: number;
}

export function signSessionToken(payload: SessionPayload): string {
  const normalized: SessionPayload = {
    uid: payload.uid,
    sessionId: payload.sessionId,
    exp: payload.exp,
    iat: payload.iat ?? Date.now(),
  };
  const data = Buffer.from(JSON.stringify(normalized), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.uid || !parsed.sessionId || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const forwardedSsl = String(req.headers['x-forwarded-ssl'] || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();
  return (
    req.secure ||
    forwardedProto.includes('https') ||
    forwardedSsl === 'on' ||
    origin.startsWith('https://') ||
    referer.startsWith('https://')
  );
}

function buildCookieOptions(req: Request, httpOnly: boolean, includeMaxAge = true): CookieOptions {
  const isHttps = isHttpsRequest(req);
  const options: CookieOptions & { partitioned?: boolean } = {
    httpOnly,
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  };
  if (includeMaxAge) {
    options.maxAge = SESSION_TTL_MS;
  }
  if (isHttps) {
    // Enable CHIPS Partitioned cookies so cross-origin AI Studio preview iframes retain cookies reliably
    options.partitioned = true;
  }
  return options as CookieOptions;
}

export function ensureCsrfCookie(req: Request, res: Response): string {
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof existing === 'string' && existing.length >= 16) {
    return existing;
  }
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, buildCookieOptions(req, false, true));
  return token;
}

export function createAndSetSessionCookie(
  req: Request,
  res: Response,
  uid: string,
): { sessionId: string; token: string } {
  const sessionId = `ses-${crypto.randomUUID()}`;
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  mutateStore((state) => {
    state.sessions = (state.sessions || []).filter((s) => s.expiresAt > now && !s.revoked).slice(-200);
    state.revokedSessions = (state.revokedSessions || []).filter((r) => r.expiresAt > now).slice(-500);
    state.sessions.push({
      sessionId,
      userUid: uid,
      expiresAt,
      revoked: false,
      createdAt: new Date(now).toISOString(),
    });
  });

  const token = signSessionToken({ uid, sessionId, exp: expiresAt, iat: now });
  res.cookie(SESSION_COOKIE_NAME, token, buildCookieOptions(req, true, true));
  ensureCsrfCookie(req, res);
  return { sessionId, token };
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function revokeTokenInStore(token: string | null | undefined): void {
  if (typeof token !== 'string' || !token.trim()) return;
  const payload = verifySessionToken(token.trim());
  if (!payload) return;

  const now = Date.now();
  mutateStore((state) => {
    const rec = (state.sessions || []).find((item) => item.sessionId === payload.sessionId);
    if (rec) rec.revoked = true;
    state.revokedSessions = (state.revokedSessions || []).filter((r) => r.expiresAt > now);
    if (!state.revokedSessions.some((r) => r.sessionId === payload.sessionId)) {
      state.revokedSessions.push({ sessionId: payload.sessionId, expiresAt: payload.exp });
    }
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  revokeTokenInStore(req.cookies?.[SESSION_COOKIE_NAME]);
  revokeTokenInStore(extractBearerToken(req));
  res.clearCookie(SESSION_COOKIE_NAME, buildCookieOptions(req, true, false));
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  // Requests carrying a cryptographically verified Bearer token cannot be triggered via passive cross-site CSRF.
  const bearer = extractBearerToken(req);
  if (bearer && verifySessionToken(bearer)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];
  if (typeof cookieToken === 'string' && cookieToken.length >= 16) {
    if (typeof headerToken !== 'string' || headerToken !== cookieToken) {
      res.status(403).json({ error: 'Validasi CSRF gagal. Silakan muat ulang halaman dan coba lagi.' });
      return;
    }
  }
  next();
}

export interface AuthenticatedRequest extends Request {
  authUser?: UserProfile;
  authTransport?: AuthTransport;
}

function validateTokenAndLoadUser(token: string): UserProfile | null {
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const store = getStore();
  const now = Date.now();

  if ((store.revokedSessions || []).some((r) => r.sessionId === payload.sessionId)) {
    return null;
  }

  const stored = store.users.find((u) => u.uid === payload.uid);
  if (!stored || !stored.isActive) return null;

  if (stored.tokensValidAfter && (payload.iat ?? 0) < stored.tokensValidAfter) {
    return null;
  }

  const rec = (store.sessions || []).find((s) => s.sessionId === payload.sessionId);
  if (rec) {
    if (rec.userUid !== payload.uid || rec.revoked || rec.expiresAt <= now) {
      return null;
    }
  }

  return {
    uid: stored.uid,
    email: stored.email,
    displayName: stored.displayName,
    role: stored.role,
    businessSegmentId: stored.businessSegmentId,
    departmentId: stored.departmentId,
    unitId: stored.unitId,
    orgScopeIds: stored.orgScopeIds,
    isActive: stored.isActive,
    isUatSynthetic: stored.isUatSynthetic,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

export function resolveAuthResult(req: Request): { user: UserProfile; transport: AuthTransport } | null {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    const cookieUser = validateTokenAndLoadUser(cookieToken);
    if (cookieUser) {
      return { user: cookieUser, transport: 'cookie' };
    }
  }

  const bearerToken = extractBearerToken(req);
  if (bearerToken) {
    const bearerUser = validateTokenAndLoadUser(bearerToken);
    if (bearerUser) {
      return { user: bearerUser, transport: 'bearer' };
    }
  }

  return null;
}

export function resolveAuthUser(req: Request): UserProfile | null {
  return resolveAuthResult(req)?.user ?? null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const resolved = resolveAuthResult(req);
  if (!resolved) {
    res.status(401).json({ error: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' });
    return;
  }
  req.authUser = resolved.user;
  req.authTransport = resolved.transport;
  next();
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Akses ditolak. Fitur ini hanya untuk Super Admin.' });
    return;
  }
  next();
}
