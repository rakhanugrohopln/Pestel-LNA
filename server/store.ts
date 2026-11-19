import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createInitialSeedState, hashPassword } from './seedData.ts';
import type { DatabaseState, StoredUserRecord } from './seedData.ts';
import type { AuditLog, UserRole } from '../src/shared/types.ts';

function resolveDataFilePath(): string {
  const customPath = process.env.PLNCORPU_STORE_PATH?.trim();
  if (customPath) {
    fs.mkdirSync(path.dirname(customPath), { recursive: true });
    return customPath;
  }
  const localDir = path.resolve(process.cwd(), 'data');
  try {
    fs.mkdirSync(localDir, { recursive: true });
    const testPath = path.join(localDir, '.write-check');
    fs.writeFileSync(testPath, 'ok', 'utf8');
    fs.unlinkSync(testPath);
    return path.join(localDir, 'plncorpu-v2-store.json');
  } catch {
    const tmpDir = path.resolve('/tmp', 'plncorpu-data');
    fs.mkdirSync(tmpDir, { recursive: true });
    return path.join(tmpDir, 'plncorpu-v2-store.json');
  }
}

const STORE_PATH = resolveDataFilePath();
const BUNDLED_STORE_PATH = path.resolve(process.cwd(), 'data', 'plncorpu-v2-store.json');

let stateCache: DatabaseState | null = null;

export function revokeUserSessionsInState(state: DatabaseState, uid: string, now = Date.now()): void {
  state.revokedSessions = (state.revokedSessions || []).filter((r) => r.expiresAt > now);
  for (const s of state.sessions || []) {
    if (s.userUid === uid && !s.revoked) {
      s.revoked = true;
      if (!state.revokedSessions.some((r) => r.sessionId === s.sessionId)) {
        state.revokedSessions.push({ sessionId: s.sessionId, expiresAt: s.expiresAt });
      }
    }
  }
}

export function applySuperAdminPasswordUpdate(
  state: DatabaseState,
  params: { email: string; newPassword: string; displayName?: string; action: string; details: string },
): StoredUserRecord {
  const email = params.email.trim().toLowerCase();
  const { hash, salt } = hashPassword(params.newPassword);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  let target = state.users.find((u) => u.email.toLowerCase() === email);
  if (target) {
    target.passwordHash = hash;
    target.passwordSalt = salt;
    target.role = 'SUPER_ADMIN';
    target.isActive = true;
    target.orgScopeIds = ['ALL_CORPORATE'];
    if (params.displayName?.trim()) {
      target.displayName = params.displayName.trim();
    }
    target.tokensValidAfter = nowMs;
    target.updatedAt = nowIso;
  } else {
    target = {
      uid: `usr-${crypto.randomUUID()}`,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      displayName: params.displayName?.trim() || 'Super Admin PLN CORPU',
      role: 'SUPER_ADMIN',
      businessSegmentId: 'seg-penunjang-korporat',
      departmentId: 'dept-corpu-lvc',
      orgScopeIds: ['ALL_CORPORATE'],
      isActive: true,
      isUatSynthetic: false,
      tokensValidAfter: nowMs,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    state.users.push(target);
  }

  revokeUserSessionsInState(state, target.uid, nowMs);

  state.auditLogs.unshift({
    id: `aud-${crypto.randomUUID().slice(0, 12)}`,
    actorUid: target.uid,
    actorEmail: target.email,
    actorRole: 'SUPER_ADMIN',
    action: params.action,
    resourceType: 'user',
    resourceId: target.uid,
    departmentId: target.departmentId,
    details: params.details,
    createdAt: nowIso,
  });
  if (state.auditLogs.length > 1000) {
    state.auditLogs = state.auditLogs.slice(0, 1000);
  }

  return target;
}

function applyOneTimeEnvAdminSync(state: DatabaseState): boolean {
  let mutated = false;

  // 1. Optional one-time idempotent Super Admin reset via server secret env vars
  const resetPassword = process.env.ADMIN_RESET_PASSWORD?.trim();
  if (resetPassword && resetPassword.length >= 8) {
    const resetEmail = (process.env.ADMIN_RESET_EMAIL || 'admin.corpu@pln.co.id').trim().toLowerCase();
    const resetNonce = process.env.ADMIN_RESET_NONCE?.trim() || 'v1';
    const digest = crypto.createHash('sha256').update(`${resetEmail}:${resetPassword}:${resetNonce}`).digest('hex');

    if (digest !== state.lastAdminResetDigest) {
      applySuperAdminPasswordUpdate(state, {
        email: resetEmail,
        newPassword: resetPassword,
        action: 'ADMIN_ENV_PASSWORD_RESET',
        details: `Pemulihan/penyetelan satu kali password Super Admin (${resetEmail}) melalui konfigurasi secret server.`,
      });
      state.lastAdminResetDigest = digest;
      mutated = true;
    }
  }

  // 2. If still no active SUPER_ADMIN exists and BOOTSTRAP_ADMIN_PASSWORD is configured, initialize once
  const hasSuperAdmin = state.users.some((u) => u.role === 'SUPER_ADMIN' && u.isActive);
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  if (!hasSuperAdmin && bootstrapPassword && bootstrapPassword.length >= 8) {
    const bootstrapEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin.corpu@pln.co.id').trim().toLowerCase();
    applySuperAdminPasswordUpdate(state, {
      email: bootstrapEmail,
      newPassword: bootstrapPassword,
      action: 'BOOTSTRAP_SUPER_ADMIN_ENV',
      details: `Inisialisasi satu kali Super Admin (${bootstrapEmail}) melalui secret environment server.`,
    });
    mutated = true;
  }

  return mutated;
}

export function isProductionEnvironment(): boolean {
  const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
  const appEnv = (process.env.APP_ENV || '').trim().toLowerCase();
  const uatFlag = (process.env.ENABLE_UAT_QUICK_LOGIN || '').trim().toLowerCase();
  return nodeEnv === 'production' || appEnv === 'production' || uatFlag === 'false';
}

export function isUatQuickLoginAllowed(): boolean {
  return !isProductionEnvironment();
}

export interface UatDemoSpec {
  email: string;
  role: UserRole;
  displayName: string;
  businessSegmentId: string;
  departmentId: string;
  orgScopeIds: string[];
}

export const UAT_DEMO_ACCOUNTS: UatDemoSpec[] = [
  {
    email: 'superadmin@demo.plncorpu.test',
    role: 'SUPER_ADMIN',
    displayName: 'Super Admin UAT (Demo)',
    businessSegmentId: 'seg-penunjang-korporat',
    departmentId: 'dept-corpu-lvc',
    orgScopeIds: ['ALL_CORPORATE'],
  },
  {
    email: 'management@demo.plncorpu.test',
    role: 'MANAGEMENT',
    displayName: 'Management UAT (Demo)',
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
    orgScopeIds: ['dept-transmisi-grid', 'dept-pembangkitan-ops'],
  },
  {
    email: 'user@demo.plncorpu.test',
    role: 'USER',
    displayName: 'User UAT (Demo)',
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
    orgScopeIds: ['dept-transmisi-grid'],
  },
];

export function ensureUatDemoAccountsInState(state: DatabaseState): boolean {
  if (!isUatQuickLoginAllowed()) return false;
  let mutated = false;
  const nowIso = new Date().toISOString();

  for (const spec of UAT_DEMO_ACCOUNTS) {
    const existing = state.users.find((u) => u.email.toLowerCase() === spec.email);
    if (!existing) {
      // Strong random server-only credential; UAT buttons authenticate via QC-gated backend endpoint, never hardcoded in frontend
      const serverOnlySecret = crypto.randomBytes(32).toString('hex');
      const { hash, salt } = hashPassword(serverOnlySecret);
      state.users.push({
        uid: `usr-uat-${spec.role.toLowerCase()}`,
        email: spec.email,
        passwordHash: hash,
        passwordSalt: salt,
        displayName: spec.displayName,
        role: spec.role,
        businessSegmentId: spec.businessSegmentId,
        departmentId: spec.departmentId,
        orgScopeIds: spec.orgScopeIds,
        isActive: true,
        isUatSynthetic: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      mutated = true;
    } else if (existing.isUatSynthetic) {
      if (
        existing.role !== spec.role ||
        !existing.isActive ||
        JSON.stringify(existing.orgScopeIds) !== JSON.stringify(spec.orgScopeIds)
      ) {
        existing.role = spec.role;
        existing.businessSegmentId = spec.businessSegmentId;
        existing.departmentId = spec.departmentId;
        existing.orgScopeIds = spec.orgScopeIds;
        existing.isActive = true;
        existing.updatedAt = nowIso;
        mutated = true;
      }
    }
  }
  return mutated;
}

function tryReadStoreFile(filePath: string): DatabaseState | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as DatabaseState;
    if (parsed && Array.isArray(parsed.organizations) && Array.isArray(parsed.researchStudies)) {
      return parsed;
    }
  } catch {
    // Ignore parse failures and fall back
  }
  return null;
}

export function getStore(): DatabaseState {
  if (stateCache) {
    if (ensureUatDemoAccountsInState(stateCache)) {
      persistStore(stateCache);
    }
    return stateCache;
  }

  const customOverride = Boolean(process.env.PLNCORPU_STORE_PATH?.trim());
  let loaded = tryReadStoreFile(STORE_PATH);
  let seededFromBundled = false;

  if (!loaded && !customOverride && STORE_PATH !== BUNDLED_STORE_PATH) {
    loaded = tryReadStoreFile(BUNDLED_STORE_PATH);
    seededFromBundled = Boolean(loaded);
  }

  if (loaded) {
    const envMutated = applyOneTimeEnvAdminSync(loaded);
    const uatMutated = ensureUatDemoAccountsInState(loaded);
    stateCache = loaded;
    if (seededFromBundled || envMutated || uatMutated) {
      persistStore(stateCache);
    }
    return stateCache;
  }

  stateCache = createInitialSeedState();
  applyOneTimeEnvAdminSync(stateCache);
  ensureUatDemoAccountsInState(stateCache);
  persistStore(stateCache);
  return stateCache;
}

export function persistStore(state: DatabaseState): void {
  stateCache = state;
  const tmpFile = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, STORE_PATH);
}

export function mutateStore<T>(mutator: (state: DatabaseState) => T): T {
  const state = getStore();
  const result = mutator(state);
  persistStore(state);
  return result;
}

export function recordAuditLog(params: {
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  departmentId?: string;
  details: string;
}): AuditLog {
  const entry: AuditLog = {
    id: `aud-${crypto.randomUUID().slice(0, 12)}`,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    departmentId: params.departmentId,
    details: params.details,
    createdAt: new Date().toISOString(),
  };

  mutateStore((state) => {
    state.auditLogs.unshift(entry);
    if (state.auditLogs.length > 1000) {
      state.auditLogs = state.auditLogs.slice(0, 1000);
    }
  });

  return entry;
}

export function findUserByEmail(email: string): StoredUserRecord | undefined {
  const normalized = email.trim().toLowerCase();
  return getStore().users.find((u) => u.email.toLowerCase() === normalized);
}

export function findUserByUid(uid: string): StoredUserRecord | undefined {
  return getStore().users.find((u) => u.uid === uid);
}

export function findUatSyntheticAccountByRole(role: UserRole): StoredUserRecord | undefined {
  const spec = UAT_DEMO_ACCOUNTS.find((a) => a.role === role);
  if (!spec) return undefined;
  return getStore().users.find(
    (u) => u.email.toLowerCase() === spec.email && u.role === role && u.isUatSynthetic === true && u.isActive,
  );
}

export function needsInitialBootstrap(): boolean {
  const store = getStore();
  return !store.users.some((u) => u.role === 'SUPER_ADMIN' && u.isActive);
}
