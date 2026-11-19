import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';

const tempStorePath = path.join(os.tmpdir(), `plncorpu-auth-test-${process.pid}-${Date.now()}.json`);
process.env.PLNCORPU_STORE_PATH = tempStorePath;
process.env.SESSION_SECRET = 'test-session-secret-key-at-least-32-chars-long';

const { createApiRouter } = await import('./routes.ts');
const { getStore, mutateStore } = await import('./store.ts');
const { createInitialSeedState, hashPassword } = await import('./seedData.ts');

function createTestApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', createApiRouter());
  return app;
}

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const app = createTestApp();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    await fn(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test.after(() => {
  if (fs.existsSync(tempStorePath)) {
    fs.unlinkSync(tempStorePath);
  }
});

test('auth session works via CHIPS HTTPS cookie and Bearer fallback across preview/publish and revokes on logout', async () => {
  await withServer(async (baseUrl) => {
    // 1. Bootstrap Super Admin over simulated HTTPS reverse proxy (like AI Studio Preview / Cloud Run)
    const bootstrapRes = await fetch(`${baseUrl}/api/auth/bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-Proto': 'https',
        Origin: 'https://aistudio.google.com',
      },
      body: JSON.stringify({
        email: 'admin.corpu@pln.co.id',
        password: 'Pln#InitialPass123!',
        displayName: 'Super Admin PLN CORPU',
      }),
    });
    assert.equal(bootstrapRes.status, 201);
    const bootstrapBody = (await bootstrapRes.json()) as {
      user: { role: string; email: string };
      sessionToken: string;
    };
    assert.equal(bootstrapBody.user.role, 'SUPER_ADMIN');
    assert.ok(bootstrapBody.sessionToken.length > 20);

    // Check Set-Cookie contains HttpOnly, SameSite=None, Secure, Partitioned
    const setCookies = bootstrapRes.headers.getSetCookie();
    const sessionCookieHeader = setCookies.find((c) => c.startsWith('plncorpu_session='));
    assert.ok(sessionCookieHeader, 'plncorpu_session cookie must be set');
    assert.match(sessionCookieHeader, /HttpOnly/i);
    assert.match(sessionCookieHeader, /SameSite=None/i);
    assert.match(sessionCookieHeader, /Secure/i);
    assert.match(sessionCookieHeader, /Partitioned/i);

    const sessionCookiePair = sessionCookieHeader.split(';')[0];
    const csrfCookieHeader = setCookies.find((c) => c.startsWith('plncorpu_csrf='));
    assert.ok(csrfCookieHeader, 'plncorpu_csrf cookie must be set');
    const csrfCookiePair = csrfCookieHeader.split(';')[0];
    const csrfToken = csrfCookiePair.split('=')[1];

    // 2. Verify /api/auth/session and /api/v1/dashboard work via COOKIE ONLY (Publish / permissive browser)
    const sessionCookieCheck = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: sessionCookiePair },
    });
    const sessionCookieJson = (await sessionCookieCheck.json()) as {
      authenticated: boolean;
      authTransport: string;
      user: { role: string };
    };
    assert.equal(sessionCookieJson.authenticated, true);
    assert.equal(sessionCookieJson.authTransport, 'cookie');
    assert.equal(sessionCookieJson.user.role, 'SUPER_ADMIN');

    const dashCookieRes = await fetch(`${baseUrl}/api/v1/dashboard`, {
      headers: { Cookie: sessionCookiePair },
    });
    assert.equal(dashCookieRes.status, 200);
    const dashCookieJson = (await dashCookieRes.json()) as { kpis: { totalResearchStudies: number } };
    assert.ok(dashCookieJson.kpis.totalResearchStudies >= 1);

    // 3. Verify /api/auth/session and /api/v1/dashboard work via BEARER ONLY (strict 3P-cookie-blocked iframe)
    const sessionBearerCheck = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: `Bearer ${bootstrapBody.sessionToken}` },
    });
    const sessionBearerJson = (await sessionBearerCheck.json()) as {
      authenticated: boolean;
      authTransport: string;
    };
    assert.equal(sessionBearerJson.authenticated, true);
    assert.equal(sessionBearerJson.authTransport, 'bearer');

    const dashBearerRes = await fetch(`${baseUrl}/api/v1/dashboard`, {
      headers: { Authorization: `Bearer ${bootstrapBody.sessionToken}` },
    });
    assert.equal(dashBearerRes.status, 200);

    // 4. Verify CSRF still blocks cookie-only POST without X-CSRF-Token
    const csrfRejectRes = await fetch(`${baseUrl}/api/v1/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${sessionCookiePair}; ${csrfCookiePair}`,
      },
      body: JSON.stringify({
        name: 'Test Org Blocked',
        level: 'department',
        businessSegmentId: 'seg-transmisi',
      }),
    });
    assert.equal(csrfRejectRes.status, 403);
    assert.ok(csrfToken.length >= 16);

    // 5. Logout revokes BOTH cookie and Bearer token immediately
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bootstrapBody.sessionToken}`,
        Cookie: `${sessionCookiePair}; ${csrfCookiePair}`,
        'X-CSRF-Token': csrfToken,
      },
    });
    assert.equal(logoutRes.status, 200);

    const afterLogoutCookieDash = await fetch(`${baseUrl}/api/v1/dashboard`, {
      headers: { Cookie: sessionCookiePair },
    });
    assert.equal(afterLogoutCookieDash.status, 401);

    const afterLogoutBearerDash = await fetch(`${baseUrl}/api/v1/dashboard`, {
      headers: { Authorization: `Bearer ${bootstrapBody.sessionToken}` },
    });
    assert.equal(afterLogoutBearerDash.status, 401);
  });
});

test('super admin password recovery validates server key, revokes old sessions, preserves research data, and enforces 3-role creation', async () => {
  const initialStudiesCount = getStore().researchStudies.length;

  await withServer(async (baseUrl) => {
    // 1. Recovery disabled (503) when ADMIN_RECOVERY_KEY is unset
    delete process.env.ADMIN_RECOVERY_KEY;
    const disabledRes = await fetch(`${baseUrl}/api/auth/admin-recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.corpu@pln.co.id',
        recoveryKey: 'AnySecretKey1234',
        newPassword: 'Pln#Recovered999!',
      }),
    });
    assert.equal(disabledRes.status, 503);

    // 2. Log in with initial password first to get an active session token
    const preLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.corpu@pln.co.id',
        password: 'Pln#InitialPass123!',
      }),
    });
    assert.equal(preLoginRes.status, 200);
    const preLoginJson = (await preLoginRes.json()) as { sessionToken: string };

    // 3. Configure ADMIN_RECOVERY_KEY and test rejection on wrong key (403)
    process.env.ADMIN_RECOVERY_KEY = 'PlnCorpuRecoverySecret#2026';
    const wrongKeyRes = await fetch(`${baseUrl}/api/auth/admin-recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.corpu@pln.co.id',
        recoveryKey: 'WrongRecoverySecretKey',
        newPassword: 'Pln#Recovered999!',
      }),
    });
    assert.equal(wrongKeyRes.status, 403);

    // 4. Create a MANAGEMENT and USER account first so we can verify non-admin emails are rejected from admin-recovery
    const mgmtCreateRes = await fetch(`${baseUrl}/api/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${preLoginJson.sessionToken}`,
      },
      body: JSON.stringify({
        email: 'mgmt.transmisi@pln.co.id',
        password: 'Pln#MgmtPass123!',
        displayName: 'VP Manajemen Transmisi',
        role: 'MANAGEMENT',
        businessSegmentId: 'seg-transmisi',
        departmentId: 'dept-transmisi-grid',
      }),
    });
    assert.equal(mgmtCreateRes.status, 201);

    const userCreateRes = await fetch(`${baseUrl}/api/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${preLoginJson.sessionToken}`,
      },
      body: JSON.stringify({
        email: 'analis.transmisi@pln.co.id',
        password: 'Pln#UserPass123!',
        displayName: 'Analis LNA Transmisi',
        role: 'USER',
        businessSegmentId: 'seg-transmisi',
        departmentId: 'dept-transmisi-grid',
      }),
    });
    assert.equal(userCreateRes.status, 201);

    // Reject admin-recovery for non-admin account even with valid recovery key
    const nonAdminRecRes = await fetch(`${baseUrl}/api/auth/admin-recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'mgmt.transmisi@pln.co.id',
        recoveryKey: 'PlnCorpuRecoverySecret#2026',
        newPassword: 'Pln#AttemptEscalation!',
      }),
    });
    assert.equal(nonAdminRecRes.status, 403);

    // 5. Valid recovery for admin.corpu@pln.co.id succeeds (200)
    const recoverRes = await fetch(`${baseUrl}/api/auth/admin-recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.corpu@pln.co.id',
        recoveryKey: 'PlnCorpuRecoverySecret#2026',
        newPassword: 'Pln#NewAdminPass2026!',
      }),
    });
    assert.equal(recoverRes.status, 200);

    // Pre-recovery token MUST be revoked immediately
    const oldTokenCheck = await fetch(`${baseUrl}/api/v1/dashboard`, {
      headers: { Authorization: `Bearer ${preLoginJson.sessionToken}` },
    });
    assert.equal(oldTokenCheck.status, 401);

    // Old password MUST fail (401)
    const oldPwdFail = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.corpu@pln.co.id',
        password: 'Pln#InitialPass123!',
      }),
    });
    assert.equal(oldPwdFail.status, 401);

    // New password succeeds (200) as SUPER_ADMIN and all research data is preserved
    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.corpu@pln.co.id',
        password: 'Pln#NewAdminPass2026!',
      }),
    });
    assert.equal(newLoginRes.status, 200);
    const newLoginJson = (await newLoginRes.json()) as {
      user: { role: string; email: string };
      sessionToken: string;
    };
    assert.equal(newLoginJson.user.role, 'SUPER_ADMIN');
    assert.equal(newLoginJson.user.email, 'admin.corpu@pln.co.id');

    const dashAfterRecovery = await fetch(`${baseUrl}/api/v1/dashboard`, {
      headers: { Authorization: `Bearer ${newLoginJson.sessionToken}` },
    });
    assert.equal(dashAfterRecovery.status, 200);
    const dashJson = (await dashAfterRecovery.json()) as { kpis: { totalResearchStudies: number } };
    assert.equal(dashJson.kpis.totalResearchStudies, initialStudiesCount);

    // Verify MANAGEMENT and USER accounts can log in cleanly as well
    for (const acc of [
      { email: 'mgmt.transmisi@pln.co.id', password: 'Pln#MgmtPass123!', expectedRole: 'MANAGEMENT' },
      { email: 'analis.transmisi@pln.co.id', password: 'Pln#UserPass123!', expectedRole: 'USER' },
    ]) {
      const loginAcc = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, password: acc.password }),
      });
      assert.equal(loginAcc.status, 200);
      const body = (await loginAcc.json()) as { user: { role: string } };
      assert.equal(body.user.role, acc.expectedRole);
    }

    // 6. Verify admin password change via PATCH /api/v1/users/:uid revokes active user sessions
    const listUsersRes = await fetch(`${baseUrl}/api/v1/users`, {
      headers: { Authorization: `Bearer ${newLoginJson.sessionToken}` },
    });
    assert.equal(listUsersRes.status, 200);
    const listUsersJson = (await listUsersRes.json()) as { users: Array<{ uid: string; email: string }> };
    const normalUser = listUsersJson.users.find((u) => u.email === 'analis.transmisi@pln.co.id');
    assert.ok(normalUser);

    const userLoginBefore = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analis.transmisi@pln.co.id', password: 'Pln#UserPass123!' }),
    });
    const userTokenBefore = ((await userLoginBefore.json()) as { sessionToken: string }).sessionToken;

    const patchPwdRes = await fetch(`${baseUrl}/api/v1/users/${normalUser.uid}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newLoginJson.sessionToken}`,
      },
      body: JSON.stringify({ newPassword: 'Pln#UpdatedUserPass2026!' }),
    });
    assert.equal(patchPwdRes.status, 200);

    const userDashRevoked = await fetch(`${baseUrl}/api/v1/dashboard`, {
      headers: { Authorization: `Bearer ${userTokenBefore}` },
    });
    assert.equal(userDashRevoked.status, 401);
  });

  // Clean up test env var
  delete process.env.ADMIN_RECOVERY_KEY;
});

test('one-time ADMIN_RESET_PASSWORD applies once on boot and does not overwrite later password changes', async () => {
  const oneTimeStorePath = path.join(os.tmpdir(), `plncorpu-onetime-test-${process.pid}-${Date.now()}.json`);
  const seed = createInitialSeedState();
  const { hash, salt } = hashPassword('Pln#OriginalUnknown123!');
  seed.users.push({
    uid: 'usr-onetime-admin',
    email: 'admin.corpu@pln.co.id',
    passwordHash: hash,
    passwordSalt: salt,
    displayName: 'Super Admin PLN CORPU',
    role: 'SUPER_ADMIN',
    businessSegmentId: 'seg-penunjang-korporat',
    departmentId: 'dept-corpu-lvc',
    orgScopeIds: ['ALL_CORPORATE'],
    isActive: true,
    isUatSynthetic: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  fs.writeFileSync(oneTimeStorePath, JSON.stringify(seed, null, 2), 'utf8');

  try {
    // Spawn isolated Node child processes importing store.ts to test genuine cold-start idempotency
    const { execFileSync } = await import('node:child_process');
    const runBootCheck = (envExtra: Record<string, string>) => {
      const script = `
        import { findUserByEmail, applySuperAdminPasswordUpdate, mutateStore } from './server/store.ts';
        import { verifyPassword } from './server/seedData.ts';
        const u = findUserByEmail('admin.corpu@pln.co.id');
        if (!u) throw new Error('missing admin');
        console.log(JSON.stringify({
          role: u.role,
          matchesOneTime: verifyPassword('Pln#SecretBootReset2026!', u.passwordHash, u.passwordSalt),
          matchesPortalNew: verifyPassword('Pln#PortalChangedLater2026!', u.passwordHash, u.passwordSalt),
          studies: mutateStore((s) => s.researchStudies.length)
        }));
      `;
      const out = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PLNCORPU_STORE_PATH: oneTimeStorePath,
          ...envExtra,
        },
        encoding: 'utf8',
      });
      return JSON.parse(out.trim()) as {
        role: string;
        matchesOneTime: boolean;
        matchesPortalNew: boolean;
        studies: number;
      };
    };

    // Boot 1 with ADMIN_RESET_PASSWORD: sets password once
    const boot1 = runBootCheck({
      ADMIN_RESET_EMAIL: 'admin.corpu@pln.co.id',
      ADMIN_RESET_PASSWORD: 'Pln#SecretBootReset2026!',
    });
    assert.equal(boot1.role, 'SUPER_ADMIN');
    assert.equal(boot1.matchesOneTime, true);
    assert.ok(boot1.studies >= 1);

    // Simulate user changing password later via portal recovery / CLI
    execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `import { mutateStore, applySuperAdminPasswordUpdate } from './server/store.ts';
         mutateStore((s) => applySuperAdminPasswordUpdate(s, {
           email: 'admin.corpu@pln.co.id',
           newPassword: 'Pln#PortalChangedLater2026!',
           action: 'TEST_PORTAL_CHANGE',
           details: 'Portal change'
         }));`,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, PLNCORPU_STORE_PATH: oneTimeStorePath },
      },
    );

    // Boot 2 with SAME ADMIN_RESET_PASSWORD still present in Secrets: MUST NOT overwrite newer password!
    const boot2 = runBootCheck({
      ADMIN_RESET_EMAIL: 'admin.corpu@pln.co.id',
      ADMIN_RESET_PASSWORD: 'Pln#SecretBootReset2026!',
    });
    assert.equal(boot2.matchesPortalNew, true);
    assert.equal(boot2.matchesOneTime, false);
  } finally {
    if (fs.existsSync(oneTimeStorePath)) {
      fs.unlinkSync(oneTimeStorePath);
    }
    // Touch current in-process store check so main test file stays consistent
    mutateStore((s) => s.users.length);
  }
});
