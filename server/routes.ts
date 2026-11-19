import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import {
  analyzeContentWithGemini,
  getConfiguredGeminiModel,
  isGeminiConfigured,
  safeFetchPublicUrl,
} from './aiService.ts';
import {
  authorizeUatQcWithPasscode,
  checkAuthRateLimit,
  clearSessionCookie,
  createAndSetSessionCookie,
  ensureCsrfCookie,
  getAppEnv,
  isAdminRecoveryConfigured,
  isSessionSecretConfigured,
  isUatPasscodeRequired,
  issueUatQcGateIfAllowed,
  requireAuth,
  requireCsrf,
  requireSuperAdmin,
  resolveAuthResult,
  resolveAuthUser,
  verifyAdminRecoveryKey,
  verifyUatQcPermission,
  type AuthenticatedRequest,
} from './authMiddleware.ts';
import { hashPassword, verifyPassword } from './seedData.ts';
import {
  applySuperAdminPasswordUpdate,
  ensureUatDemoAccountsInState,
  findUatSyntheticAccountByRole,
  findUserByEmail,
  getStore,
  isUatQuickLoginAllowed,
  mutateStore,
  needsInitialBootstrap,
  recordAuditLog,
  revokeUserSessionsInState,
} from './store.ts';
import { buildRelationshipGraph } from '../src/shared/graph.ts';
import {
  buildDepartmentResearchPath,
  buildStudyDetailPath,
  canAccessOrgRecord,
  canRespondManagementFeedback,
  canSubmitManagementFeedback,
  canViewAnalysisRecord,
  canViewPestelIssue,
  canViewRecommendation,
  canViewResearchStudy,
  evaluateTnaRecommendationEligibility,
  generateUniqueSlug,
  validateDnaConclusion,
  validatePublicNewsUrl,
} from '../src/shared/rbac.ts';
import type {
  CcaAssessment,
  CompetencyItem,
  DnaAssessment,
  LearningPath,
  LearningRecommendation,
  ManagementFeedback,
  OrganizationNode,
  PestelCategory,
  PestelIssue,
  ProfessionItem,
  ResearchStudy,
  SystemConfigStatus,
  TnaAssessment,
  UserProfile,
} from '../src/shared/types.ts';

function getSystemConfigStatus(req?: express.Request, uatAuthorizedOverride?: boolean): SystemConfigStatus {
  const uatAllowed = isUatQuickLoginAllowed();
  const uatAuthorized =
    uatAllowed && (uatAuthorizedOverride ?? (req ? verifyUatQcPermission(req) : false));
  return {
    appEnv: getAppEnv(),
    needsBootstrap: needsInitialBootstrap(),
    recoveryConfigured: isAdminRecoveryConfigured(),
    uatQuickLoginEnabled: uatAllowed,
    uatRequiresPasscode: uatAllowed && isUatPasscodeRequired(),
    uatQcAuthorized: uatAuthorized,
    geminiConfigured: isGeminiConfigured(),
    geminiModel: getConfiguredGeminiModel(),
    firestoreConfigured: Boolean(
      firebaseConfig.projectId && firebaseConfig.projectId !== 'remixed-project-id' && firebaseConfig.firestoreDatabaseId,
    ),
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '',
    storageEngine: 'Relational Backend Store + Firestore Telemetry',
    sessionSecretConfigured: isSessionSecretConfigured(),
    csrfEnabled: true,
    rateLimitEnabled: true,
  };
}

function toSafeUser(u: UserProfile): UserProfile {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    businessSegmentId: u.businessSegmentId,
    departmentId: u.departmentId,
    unitId: u.unitId,
    orgScopeIds: u.orgScopeIds,
    isActive: u.isActive,
    isUatSynthetic: u.isUatSynthetic,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function generateStrongPassword(): string {
  const bytes = crypto.randomBytes(9).toString('base64url');
  return `Pln#${bytes}!9`;
}

export function createApiRouter() {
  const router = express.Router();

  // Health & Config
  router.get('/health', (_req, res) => {
    const store = getStore();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      config: getSystemConfigStatus(),
      counts: {
        organizations: store.organizations.length,
        users: store.users.length,
        researchStudies: store.researchStudies.length,
        pestelIssues: store.pestelIssues.length,
        ccaAssessments: store.ccaAssessments.length,
        dnaAssessments: store.dnaAssessments.length,
        tnaAssessments: store.tnaAssessments.length,
        recommendations: store.recommendations.length,
        managementFeedback: store.managementFeedback.length,
      },
    });
  });

  router.get('/config/status', (req, res) => {
    ensureCsrfCookie(req, res);
    const uatGateToken = issueUatQcGateIfAllowed(req, res);
    res.json({
      ...getSystemConfigStatus(req, Boolean(uatGateToken) || verifyUatQcPermission(req)),
      ...(uatGateToken ? { uatGateToken } : {}),
    });
  });

  // Auth Bootstrap Status & One-Time Initial Super Admin Provisioning
  router.get('/auth/bootstrap-status', (req, res) => {
    ensureCsrfCookie(req, res);
    const uatGateToken = issueUatQcGateIfAllowed(req, res);
    res.json({
      needsBootstrap: needsInitialBootstrap(),
      config: getSystemConfigStatus(req, Boolean(uatGateToken) || verifyUatQcPermission(req)),
      ...(uatGateToken ? { uatGateToken } : {}),
    });
  });

  const bootstrapSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    displayName: z.string().min(2).max(120).optional(),
  });

  router.post('/auth/bootstrap', checkAuthRateLimit, (req, res) => {
    if (!needsInitialBootstrap()) {
      res.status(409).json({ error: 'Akun Super Admin awal sudah diinisialisasi. Silakan login.' });
      return;
    }

    const parsed = bootstrapSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Email valid dan password minimal 8 karakter wajib diisi.' });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { hash, salt } = hashPassword(parsed.data.password);
    const now = new Date().toISOString();

    const created = mutateStore((state) => {
      const user = {
        uid: `usr-${crypto.randomUUID()}`,
        email,
        passwordHash: hash,
        passwordSalt: salt,
        displayName: parsed.data.displayName?.trim() || 'Super Admin PLN CORPU',
        role: 'SUPER_ADMIN' as const,
        businessSegmentId: 'seg-penunjang-korporat',
        departmentId: 'dept-corpu-lvc',
        orgScopeIds: ['ALL_CORPORATE'],
        isActive: true,
        isUatSynthetic: false,
        createdAt: now,
        updatedAt: now,
      };
      state.users.push(user);
      return user;
    });

    const { token } = createAndSetSessionCookie(req, res, created.uid);

    recordAuditLog({
      actorUid: created.uid,
      actorEmail: created.email,
      actorRole: created.role,
      action: 'BOOTSTRAP_SUPER_ADMIN',
      resourceType: 'user',
      resourceId: created.uid,
      details: 'Aktivasi satu kali akun Super Admin awal melalui prosedur bootstrap aman.',
    });

    res.status(201).json({ user: toSafeUser(created), sessionToken: token, config: getSystemConfigStatus() });
  });

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  router.post('/auth/login', checkAuthRateLimit, (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Format email atau password tidak valid.' });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const found = findUserByEmail(email);

    if (!found || !found.isActive || !verifyPassword(parsed.data.password, found.passwordHash, found.passwordSalt)) {
      recordAuditLog({
        actorUid: found?.uid || 'anonymous',
        actorEmail: email,
        actorRole: found?.role || 'USER',
        action: 'LOGIN_FAILED',
        resourceType: 'session',
        resourceId: email,
        details: `Percobaan login gagal untuk ${email}.`,
      });
      res.status(401).json({ error: 'Email atau password salah.' });
      return;
    }

    const { sessionId, token } = createAndSetSessionCookie(req, res, found.uid);

    recordAuditLog({
      actorUid: found.uid,
      actorEmail: found.email,
      actorRole: found.role,
      action: 'LOGIN_SUCCESS',
      resourceType: 'session',
      resourceId: sessionId,
      departmentId: found.departmentId,
      details: `Login berhasil sebagai ${found.role}.`,
    });

    res.json({ user: toSafeUser(found), sessionToken: token, config: getSystemConfigStatus() });
  });

  const adminRecoverySchema = z.object({
    email: z.string().email(),
    recoveryKey: z.string().min(1).max(256),
    newPassword: z.string().min(8).max(128),
  });

  router.post('/auth/admin-recovery', checkAuthRateLimit, (req, res) => {
    if (!isAdminRecoveryConfigured()) {
      res.status(503).json({
        error:
          'Pemulihan password admin belum diaktifkan di server. Atur secret server ADMIN_RECOVERY_KEY (minimal 12 karakter) pada Google AI Studio Secrets / Cloud Run, lalu mulai ulang server.',
      });
      return;
    }

    const parsed = adminRecoverySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Email valid, kode pemulihan server, dan password baru minimal 8 karakter wajib diisi.',
      });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    if (!verifyAdminRecoveryKey(parsed.data.recoveryKey)) {
      recordAuditLog({
        actorUid: 'recovery-attempt',
        actorEmail: email,
        actorRole: 'SUPER_ADMIN',
        action: 'ADMIN_RECOVERY_FAILED',
        resourceType: 'user',
        resourceId: email,
        details: `Percobaan pemulihan password admin gagal untuk ${email} (kode pemulihan tidak cocok).`,
      });
      res.status(403).json({ error: 'Kode pemulihan server tidak valid.' });
      return;
    }

    const existing = findUserByEmail(email);
    const isAllowedAdminEmail =
      email === 'admin.corpu@pln.co.id' ||
      existing?.role === 'SUPER_ADMIN' ||
      needsInitialBootstrap();

    if (!isAllowedAdminEmail || (existing && existing.role !== 'SUPER_ADMIN' && email !== 'admin.corpu@pln.co.id')) {
      res.status(403).json({
        error: 'Pemulihan ini hanya diizinkan untuk akun Super Admin (admin.corpu@pln.co.id).',
      });
      return;
    }

    const updated = mutateStore((state) =>
      applySuperAdminPasswordUpdate(state, {
        email,
        newPassword: parsed.data.newPassword,
        action: 'ADMIN_PASSWORD_RECOVERED',
        details: `Password Super Admin (${email}) berhasil dipulihkan melalui kunci pemulihan server yang sah.`,
      }),
    );

    res.json({
      ok: true,
      email: updated.email,
      message: `Password akun Super Admin (${updated.email}) berhasil diperbarui. Silakan masuk dengan password baru Anda.`,
      config: getSystemConfigStatus(),
    });
  });

  router.post('/auth/logout', requireCsrf, (req, res) => {
    const user = resolveAuthUser(req);
    clearSessionCookie(req, res);
    if (user) {
      recordAuditLog({
        actorUid: user.uid,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'LOGOUT',
        resourceType: 'session',
        resourceId: user.uid,
        details: 'Pengguna keluar dan sesi server dicabut.',
      });
    }
    res.json({ ok: true });
  });

  router.post('/auth/uat-qc-authorize', checkAuthRateLimit, requireCsrf, (req, res) => {
    if (!isUatQuickLoginAllowed()) {
      res.status(403).json({ error: 'Fitur UAT dinonaktifkan pada lingkungan production.' });
      return;
    }
    const parsed = z.object({ passcode: z.string().min(1).max(256) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Kode otorisasi QC wajib diisi.' });
      return;
    }
    const token = authorizeUatQcWithPasscode(req, res, parsed.data.passcode);
    if (!token) {
      recordAuditLog({
        actorUid: 'uat-qc-gate',
        actorEmail: 'qc-attempt@plncorpu.test',
        actorRole: 'USER',
        action: 'UAT_QC_AUTH_FAILED',
        resourceType: 'session',
        resourceId: 'uat-qc-gate',
        details: 'Percobaan otorisasi akses panel UAT QC ditolak (kode tidak valid).',
      });
      res.status(403).json({ error: 'Kode otorisasi QC tidak valid.' });
      return;
    }
    res.json({
      ok: true,
      uatGateToken: token,
      config: getSystemConfigStatus(req, true),
    });
  });

  router.post('/auth/uat-login', checkAuthRateLimit, requireCsrf, (req, res) => {
    if (!isUatQuickLoginAllowed()) {
      recordAuditLog({
        actorUid: 'uat-blocked-prod',
        actorEmail: 'uat-blocked@plncorpu.test',
        actorRole: 'USER',
        action: 'UAT_LOGIN_BLOCKED_PROD',
        resourceType: 'session',
        resourceId: 'uat-login',
        details: 'Upaya akses endpoint UAT quick-login pada lingkungan production diblokir.',
      });
      res.status(403).json({ error: 'Login otomatis akun uji coba dinonaktifkan pada lingkungan production.' });
      return;
    }

    if (!verifyUatQcPermission(req)) {
      recordAuditLog({
        actorUid: 'uat-unauthorized',
        actorEmail: 'uat-unauthorized@plncorpu.test',
        actorRole: 'USER',
        action: 'UAT_LOGIN_UNAUTHORIZED_QC',
        resourceType: 'session',
        resourceId: 'uat-login',
        details: 'Percobaan login otomatis UAT ditolak karena otorisasi QC backend tidak valid.',
      });
      res.status(403).json({ error: 'Akses ditolak. Fitur UAT hanya tersedia untuk tim QC terotorisasi.' });
      return;
    }

    const parsed = z.object({ role: z.enum(['SUPER_ADMIN', 'MANAGEMENT', 'USER']) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Role UAT tidak valid. Pilih SUPER_ADMIN, MANAGEMENT, atau USER.' });
      return;
    }

    mutateStore((state) => {
      ensureUatDemoAccountsInState(state);
    });

    const uatAccount = findUatSyntheticAccountByRole(parsed.data.role);
    if (!uatAccount || !uatAccount.isUatSynthetic || !uatAccount.isActive) {
      res.status(404).json({ error: `Akun UAT untuk role ${parsed.data.role} tidak tersedia.` });
      return;
    }

    const { sessionId, token } = createAndSetSessionCookie(req, res, uatAccount.uid);

    recordAuditLog({
      actorUid: uatAccount.uid,
      actorEmail: uatAccount.email,
      actorRole: uatAccount.role,
      action: 'UAT_QUICK_LOGIN',
      resourceType: 'session',
      resourceId: sessionId,
      departmentId: uatAccount.departmentId,
      details: `Login otomatis UAT QC berhasil menggunakan akun sintetis ${uatAccount.email} (${uatAccount.role}).`,
    });

    res.json({
      user: toSafeUser(uatAccount),
      sessionToken: token,
      config: getSystemConfigStatus(req, true),
    });
  });

  const handleSessionCheck = (req: express.Request, res: express.Response) => {
    ensureCsrfCookie(req, res);
    const uatGateToken = issueUatQcGateIfAllowed(req, res);
    const uatAuthz = Boolean(uatGateToken) || verifyUatQcPermission(req);
    const resolved = resolveAuthResult(req);
    if (!resolved) {
      res.json({
        authenticated: false,
        user: null,
        authTransport: 'none',
        config: getSystemConfigStatus(req, uatAuthz),
        ...(uatGateToken ? { uatGateToken } : {}),
      });
      return;
    }
    res.json({
      authenticated: true,
      user: resolved.user,
      authTransport: resolved.transport,
      config: getSystemConfigStatus(req, uatAuthz),
      ...(uatGateToken ? { uatGateToken } : {}),
    });
  };

  router.get('/auth/session', handleSessionCheck);
  router.get('/auth/me', handleSessionCheck);

  // Protected API v1
  router.use('/v1', requireAuth, requireCsrf);

  // Organizations (Business Segments, Departments, Units)
  router.get('/v1/organizations', (_req: AuthenticatedRequest, res) => {
    const store = getStore();
    const items = store.organizations.map((org) => ({
      ...org,
      researchPath:
        org.level === 'department' || org.level === 'unit'
          ? buildDepartmentResearchPath(org.slug)
          : `/lna?segmentId=${org.id}`,
    }));
    res.json({ organizations: items });
  });

  const orgSchema = z.object({
    name: z.string().min(2).max(180),
    level: z.enum(['segment', 'directorate', 'department', 'unit']),
    parentId: z.string().optional(),
    businessSegmentId: z.string().min(1),
    province: z.string().max(80).default('Nasional'),
    description: z.string().max(1000).default(''),
  });

  router.post('/v1/organizations', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = orgSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data organisasi tidak valid.', details: parsed.error.flatten() });
      return;
    }

    const created = mutateStore((state) => {
      const slug = generateUniqueSlug(
        parsed.data.name,
        state.organizations.map((o) => o.slug),
      );
      const id = `${parsed.data.level.slice(0, 4)}-${slug.slice(0, 40)}-${crypto.randomBytes(2).toString('hex')}`;
      const node: OrganizationNode = {
        id,
        name: parsed.data.name.trim(),
        slug,
        level: parsed.data.level,
        parentId: parsed.data.parentId || parsed.data.businessSegmentId,
        businessSegmentId: parsed.data.level === 'segment' ? id : parsed.data.businessSegmentId,
        province: parsed.data.province,
        description: parsed.data.description,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      };
      state.organizations.push(node);
      return node;
    });

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'CREATE_ORGANIZATION',
      resourceType: 'organization',
      resourceId: created.id,
      details: `Menambahkan ${created.level} "${created.name}".`,
    });

    res.status(201).json({ organization: created });
  });

  router.delete('/v1/organizations/:id', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const { id } = req.params;
    const store = getStore();
    const inUse =
      store.researchStudies.some((s) => s.businessSegmentId === id || s.departmentId === id) ||
      store.users.some((u) => u.businessSegmentId === id || u.departmentId === id);

    if (inUse) {
      res.status(409).json({ error: 'Organisasi tidak dapat dihapus karena masih dirujuk oleh pengguna atau penelitian LNA.' });
      return;
    }

    mutateStore((state) => {
      state.organizations = state.organizations.filter((o) => o.id !== id);
    });

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'DELETE_ORGANIZATION',
      resourceType: 'organization',
      resourceId: id,
      details: `Menghapus node organisasi ${id}.`,
    });

    res.json({ ok: true });
  });

  // Executive Dashboard (Role-filtered, 100% real DB queries)
  router.get('/v1/dashboard', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const segmentFilter = typeof req.query.segmentId === 'string' && req.query.segmentId !== 'all' ? req.query.segmentId : '';
    const deptFilter = typeof req.query.departmentId === 'string' && req.query.departmentId !== 'all' ? req.query.departmentId : '';
    const yearFilter = typeof req.query.year === 'string' && req.query.year !== 'all' ? Number(req.query.year) : 0;

    const visibleStudies = store.researchStudies.filter((s) => {
      if (!canViewResearchStudy(user, s, store.organizations)) return false;
      if (segmentFilter && s.businessSegmentId !== segmentFilter) return false;
      if (deptFilter && s.departmentId !== deptFilter) return false;
      if (yearFilter && s.year !== yearFilter) return false;
      return true;
    });

    const visibleIssues = store.pestelIssues.filter((i) => {
      if (!canViewPestelIssue(user, i, store.organizations)) return false;
      if (segmentFilter && i.businessSegmentId !== segmentFilter) return false;
      if (deptFilter && i.departmentId !== deptFilter) return false;
      return true;
    });

    const visibleCcas = store.ccaAssessments.filter(
      (c) =>
        canViewAnalysisRecord(user, c.status, c.businessSegmentId, c.departmentId, store.organizations) &&
        (!segmentFilter || c.businessSegmentId === segmentFilter) &&
        (!deptFilter || c.departmentId === deptFilter),
    );

    const visibleDnas = store.dnaAssessments.filter(
      (d) =>
        canViewAnalysisRecord(user, d.status, d.businessSegmentId, d.departmentId, store.organizations) &&
        (!segmentFilter || d.businessSegmentId === segmentFilter) &&
        (!deptFilter || d.departmentId === deptFilter),
    );

    const visibleTnas = store.tnaAssessments.filter(
      (t) =>
        canViewAnalysisRecord(user, t.verificationStatus, t.businessSegmentId, t.departmentId, store.organizations) &&
        (!segmentFilter || t.businessSegmentId === segmentFilter) &&
        (!deptFilter || t.departmentId === deptFilter),
    );

    const visibleRecs = store.recommendations.filter(
      (r) =>
        canViewRecommendation(user, r, store.organizations) &&
        (!segmentFilter || r.businessSegmentId === segmentFilter) &&
        (!deptFilter || r.departmentId === deptFilter),
    );

    const visibleStudyIds = new Set(visibleStudies.map((s) => s.id));
    const visibleFeedback =
      user.role === 'USER'
        ? []
        : store.managementFeedback.filter(
            (f) => visibleStudyIds.has(f.researchStudyId) && (user.role === 'SUPER_ADMIN' || f.submittedByUid === user.uid || canAccessOrgRecord(user, '', '', store.organizations) || visibleStudyIds.has(f.researchStudyId)),
          );

    const segments = store.organizations.filter((o) => o.level === 'segment');
    const departments = store.organizations.filter((o) => o.level === 'department');

    const researchBySegment = segments.map((seg) => ({
      id: seg.id,
      name: seg.name,
      studies: visibleStudies.filter((s) => s.businessSegmentId === seg.id).length,
      pestel: visibleIssues.filter((i) => i.businessSegmentId === seg.id).length,
    }));

    const researchByDepartment = departments
      .map((dept) => ({
        id: dept.id,
        name: dept.name.replace(/^Departemen\s+/i, ''),
        studies: visibleStudies.filter((s) => s.departmentId === dept.id).length,
        tna: visibleTnas.filter((t) => t.departmentId === dept.id).length,
      }))
      .filter((d) => d.studies > 0 || d.tna > 0 || !segmentFilter);

    const pestelCategories: PestelCategory[] = ['Political', 'Economic', 'Social', 'Technological', 'Environmental', 'Legal'];
    const pestelDistribution = pestelCategories.map((cat) => ({
      category: cat,
      count: visibleIssues.filter((i) => i.categories.includes(cat)).length,
    }));

    const tnaKorporatCount = visibleTnas.filter((t) => t.tnaClassification === 'TNA_KORPORAT').length;
    const tnaUnitCount = visibleTnas.filter((t) => t.tnaClassification === 'TNA_UNIT').length;

    const feedbackStatusDist = (['Baru', 'Ditinjau', 'Ditindaklanjuti', 'Selesai'] as const).map((status) => ({
      status,
      count: visibleFeedback.filter((f) => f.status === status).length,
    }));

    const tnaStatusDist = (['Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan'] as const).map((status) => ({
      status,
      count: visibleTnas.filter((t) => t.verificationStatus === status).length,
    }));

    const yearTrendMap = new Map<number, number>();
    for (const s of visibleStudies) {
      yearTrendMap.set(s.year, (yearTrendMap.get(s.year) || 0) + 1);
    }
    const researchTrend = Array.from(yearTrendMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year: String(year), count }));

    res.json({
      kpis: {
        totalResearchStudies: visibleStudies.length,
        publishedStudies: visibleStudies.filter((s) => s.status === 'Dipublikasikan').length,
        totalPestelIssues: visibleIssues.length,
        ccaCount: visibleCcas.length,
        dnaCount: visibleDnas.length,
        tnaTotalCount: visibleTnas.length,
        tnaKorporatCount,
        tnaUnitCount,
        recommendationsCount: visibleRecs.length,
        managementFeedbackCount: visibleFeedback.length,
        feedbackOpenCount: visibleFeedback.filter((f) => f.status === 'Baru' || f.status === 'Ditinjau').length,
      },
      charts: {
        researchBySegment,
        researchByDepartment,
        pestelDistribution,
        researchTrend,
        tnaStatusDist,
        feedbackStatusDist,
      },
      recentStudies: visibleStudies.slice(0, 6),
      recentIssues: visibleIssues.slice(0, 5),
      recentFeedback: visibleFeedback.slice(0, 5),
    });
  });

  // LNA Research Studies (Core Feature: Bagian 5 & 6)
  router.get('/v1/research', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const businessSegmentId = typeof req.query.businessSegmentId === 'string' ? req.query.businessSegmentId : 'all';
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : 'all';
    const unitId = typeof req.query.unitId === 'string' ? req.query.unitId : 'all';
    const year = typeof req.query.year === 'string' ? req.query.year : 'all';
    const pestelCategory = typeof req.query.pestelCategory === 'string' ? req.query.pestelCategory : 'all';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const priority = typeof req.query.priority === 'string' ? req.query.priority : 'all';

    const items = store.researchStudies
      .filter((study) => {
        if (!canViewResearchStudy(user, study, store.organizations)) return false;
        if (businessSegmentId !== 'all' && study.businessSegmentId !== businessSegmentId) return false;
        if (departmentId !== 'all' && study.departmentId !== departmentId) return false;
        if (unitId !== 'all' && study.unitId !== unitId) return false;
        if (year !== 'all' && String(study.year) !== year) return false;
        if (pestelCategory !== 'all' && !study.relatedPestelCategories.includes(pestelCategory as PestelCategory)) return false;
        if (status !== 'all' && study.status !== status) return false;
        if (priority !== 'all' && study.priority !== priority) return false;
        if (q) {
          const hay = `${study.studyCode} ${study.title} ${study.background} ${study.competencyNeeds} ${study.lnaResult}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((study) => ({
        ...study,
        detailPath: buildStudyDetailPath(study.id),
      }));

    res.json({ studies: items });
  });

  router.get('/v1/research/department/:slug', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const org = store.organizations.find((o) => o.slug === req.params.slug && (o.level === 'department' || o.level === 'unit'));
    if (!org) {
      res.status(404).json({ error: 'Departemen atau unit kerja tidak ditemukan.' });
      return;
    }

    if (!canAccessOrgRecord(user, org.businessSegmentId, org.id, store.organizations)) {
      recordAuditLog({
        actorUid: user.uid,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'ACCESS_DENIED_DEPARTMENT_RESEARCH',
        resourceType: 'department',
        resourceId: org.id,
        departmentId: org.id,
        details: `Penolakan akses penelitian departemen ${org.name} oleh ${user.email}.`,
      });
      res.status(403).json({ error: `Akses ditolak. Akun Anda tidak memiliki otorisasi untuk departemen ${org.name}.` });
      return;
    }

    const studies = store.researchStudies.filter(
      (s) => (s.departmentId === org.id || s.unitId === org.id) && canViewResearchStudy(user, s, store.organizations),
    );
    res.json({ organization: org, studies });
  });

  router.get('/v1/research/:id', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const study = store.researchStudies.find((s) => s.id === req.params.id);
    if (!study) {
      res.status(404).json({ error: 'Penelitian LNA tidak ditemukan.' });
      return;
    }

    if (!canViewResearchStudy(user, study, store.organizations)) {
      recordAuditLog({
        actorUid: user.uid,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'ACCESS_DENIED_RESEARCH_STUDY',
        resourceType: 'research_study',
        resourceId: study.id,
        departmentId: study.departmentId,
        details: `Penolakan akses detail penelitian "${study.studyCode}" oleh ${user.email} (${user.role}).`,
      });
      res.status(403).json({
        error: 'Akses Ditolak. Anda tidak memiliki izin untuk membuka dokumen penelitian LNA ini.',
      });
      return;
    }

    const linkedPestel = store.pestelIssues.filter(
      (p) => (study.linkedPestelIds.includes(p.id) || p.linkedStudyIds.includes(study.id)) && canViewPestelIssue(user, p, store.organizations),
    );
    const cca = store.ccaAssessments.filter(
      (c) => c.researchStudyId === study.id && canViewAnalysisRecord(user, c.status, c.businessSegmentId, c.departmentId, store.organizations),
    );
    const dna = store.dnaAssessments.filter(
      (d) => d.researchStudyId === study.id && canViewAnalysisRecord(user, d.status, d.businessSegmentId, d.departmentId, store.organizations),
    );
    const tna = store.tnaAssessments.filter(
      (t) => t.researchStudyId === study.id && canViewAnalysisRecord(user, t.verificationStatus, t.businessSegmentId, t.departmentId, store.organizations),
    );
    const recommendations = store.recommendations.filter(
      (r) => r.researchStudyId === study.id && canViewRecommendation(user, r, store.organizations),
    );
    const feedback =
      user.role === 'USER' ? [] : store.managementFeedback.filter((f) => f.researchStudyId === study.id);

    res.json({
      study,
      linkedPestel,
      cca,
      dna,
      tna,
      recommendations,
      feedback,
    });
  });

  const researchSchema = z.object({
    studyCode: z.string().min(2).max(64),
    title: z.string().min(5).max(240),
    year: z.number().int().min(2020).max(2035),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    unitId: z.string().optional(),
    background: z.string().min(10).max(4000),
    problemStatement: z.string().min(10).max(3000),
    objectives: z.string().min(5).max(3000),
    strategicIssueSource: z.string().max(500).default(''),
    relatedPestelCategories: z.array(z.enum(['Political', 'Economic', 'Social', 'Technological', 'Environmental', 'Legal'])).default([]),
    linkedPestelIds: z.array(z.string()).default([]),
    sourceUrls: z.array(z.string()).default([]),
    supportingEvidence: z.string().max(4000).default(''),
    currentConditionAnalysis: z.string().max(4000).default(''),
    orgNeedsAnalysis: z.string().max(4000).default(''),
    competencyNeeds: z.string().max(2000).default(''),
    lnaResult: z.string().max(4000).default(''),
    ccaSummary: z.string().max(2000).default(''),
    dnaSummary: z.string().max(2000).default(''),
    tnaSummary: z.string().max(2000).default(''),
    developmentRecommendation: z.string().max(3000).default(''),
    status: z.enum(['Draft', 'Dalam Analisis', 'Menunggu Masukan', 'Revisi', 'Disetujui', 'Dipublikasikan']).default('Draft'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    leadName: z.string().min(2).max(160),
  });

  router.post('/v1/research', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = researchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data penelitian LNA tidak valid.', details: parsed.error.flatten() });
      return;
    }

    const store = getStore();
    if (
      !store.organizations.some((o) => o.id === parsed.data.businessSegmentId) ||
      !store.organizations.some((o) => o.id === parsed.data.departmentId)
    ) {
      res.status(400).json({ error: 'Bidang bisnis atau departemen tidak ditemukan.' });
      return;
    }

    for (const url of parsed.data.sourceUrls) {
      if (url.trim()) {
        const chk = validatePublicNewsUrl(url);
        if (!chk.valid) {
          res.status(400).json({ error: chk.reason });
          return;
        }
      }
    }

    const now = new Date().toISOString();
    const created: ResearchStudy = {
      id: `lna-${crypto.randomUUID().slice(0, 12)}`,
      ...parsed.data,
      sourceUrls: parsed.data.sourceUrls.map((u) => u.trim()).filter(Boolean),
      ownerUserId: user.uid,
      isUatSynthetic: Boolean(user.isUatSynthetic),
      createdAt: now,
      updatedAt: now,
    };

    mutateStore((state) => {
      state.researchStudies.unshift(created);
      for (const pid of created.linkedPestelIds) {
        const p = state.pestelIssues.find((item) => item.id === pid);
        if (p && !p.linkedStudyIds.includes(created.id)) {
          p.linkedStudyIds.push(created.id);
        }
      }
    });

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'CREATE_RESEARCH_STUDY',
      resourceType: 'research_study',
      resourceId: created.id,
      departmentId: created.departmentId,
      details: `Membuat penelitian LNA "${created.studyCode} — ${created.title}" (${created.status}).`,
    });

    res.status(201).json({ study: created });
  });

  router.patch('/v1/research/:id', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const { id } = req.params;
    const partialSchema = researchSchema.partial();
    const parsed = partialSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Pembaruan data penelitian tidak valid.', details: parsed.error.flatten() });
      return;
    }

    let prevStatus = '';
    const updated = mutateStore((state) => {
      const target = state.researchStudies.find((s) => s.id === id);
      if (!target) return null;
      prevStatus = target.status;
      Object.assign(target, parsed.data, { updatedAt: new Date().toISOString() });
      if (parsed.data.status && parsed.data.status !== prevStatus) {
        state.approvalHistory.unshift({
          id: `app-${crypto.randomUUID().slice(0, 8)}`,
          entityType: 'research_study',
          entityId: id,
          fromStatus: prevStatus,
          toStatus: parsed.data.status,
          actorUid: user.uid,
          actorName: user.displayName,
          note: `Perubahan status penelitian dari ${prevStatus} menjadi ${parsed.data.status}.`,
          createdAt: new Date().toISOString(),
        });
      }
      return target;
    });

    if (!updated) {
      res.status(404).json({ error: 'Penelitian tidak ditemukan.' });
      return;
    }

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'UPDATE_RESEARCH_STUDY',
      resourceType: 'research_study',
      resourceId: id,
      departmentId: updated.departmentId,
      details: `Memperbarui penelitian "${updated.studyCode}" (status: ${updated.status}).`,
    });

    res.json({ study: updated });
  });

  router.delete('/v1/research/:id', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const { id } = req.params;
    const removed = mutateStore((state) => {
      const idx = state.researchStudies.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      const [item] = state.researchStudies.splice(idx, 1);
      return item;
    });

    if (!removed) {
      res.status(404).json({ error: 'Penelitian tidak ditemukan.' });
      return;
    }

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'DELETE_RESEARCH_STUDY',
      resourceType: 'research_study',
      resourceId: id,
      departmentId: removed.departmentId,
      details: `Menghapus penelitian "${removed.studyCode}".`,
    });

    res.json({ ok: true });
  });

  // PESTEL Issues & AI Analysis
  router.get('/v1/pestel', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const segmentId = typeof req.query.businessSegmentId === 'string' ? req.query.businessSegmentId : 'all';

    const issues = store.pestelIssues.filter((issue) => {
      if (!canViewPestelIssue(user, issue, store.organizations)) return false;
      if (category !== 'all' && !issue.categories.includes(category as PestelCategory)) return false;
      if (segmentId !== 'all' && issue.businessSegmentId !== segmentId) return false;
      if (q) {
        const hay = `${issue.title} ${issue.summary} ${issue.categories.join(' ')} ${issue.impactAnalysis}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    res.json({ issues });
  });

  const analyzeNewsSchema = z.object({
    sourceUrl: z.string().max(1024).optional(),
    rawText: z.string().max(8000).optional(),
    titleHint: z.string().max(240).optional(),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    province: z.string().max(80).default('Nasional'),
    period: z.string().max(32).default('2026-Q4'),
  });

  router.post('/v1/ai/analyze-news', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = analyzeNewsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Parameter analisis berita tidak valid.', details: parsed.error.flatten() });
      return;
    }

    if (!isGeminiConfigured()) {
      res.status(503).json({
        error: 'GEMINI_API_KEY belum dikonfigurasi pada server sehingga analisis AI tidak dapat dijalankan.',
      });
      return;
    }

    let sourceTitle = parsed.data.titleHint?.trim() || 'Analisis Berita Strategis';
    let sourcePublishedAt = new Date().toISOString().slice(0, 10);
    let publisher = 'Input Analis PLN CORPU';
    let contentText = parsed.data.rawText?.trim() || '';
    let normalizedUrl: string | undefined;

    if (parsed.data.sourceUrl && parsed.data.sourceUrl.trim()) {
      try {
        const fetched = await safeFetchPublicUrl(parsed.data.sourceUrl.trim());
        normalizedUrl = fetched.url;
        sourceTitle = fetched.title;
        publisher = fetched.publisher;
        sourcePublishedAt = fetched.publishedAt;
        if (!contentText) {
          contentText = fetched.excerpt;
        }
      } catch (err) {
        res.status(422).json({
          error: err instanceof Error ? err.message : 'Gagal mengambil konten dari URL berita publik.',
        });
        return;
      }
    }

    if (!contentText || contentText.length < 25) {
      res.status(400).json({
        error: 'Masukkan URL berita publik yang dapat diakses atau ringkasan teks berita minimal 25 karakter.',
      });
      return;
    }

    const store = getStore();
    try {
      const aiResult = await analyzeContentWithGemini({
        title: sourceTitle,
        content: contentText,
        sourceUrl: normalizedUrl,
        organizations: store.organizations,
      });

      const now = new Date().toISOString();
      const issue: PestelIssue = {
        id: `pestel-${crypto.randomUUID().slice(0, 10)}`,
        title: aiResult.title,
        summary: aiResult.summary,
        sourceUrl: normalizedUrl,
        sourceTitle,
        publisher,
        sourcePublishedAt,
        categories: aiResult.categories,
        riskOrOpportunity: aiResult.riskOrOpportunity,
        severity: aiResult.severity,
        impactAnalysis: aiResult.impactAnalysis,
        proposedSegmentIds: aiResult.recommendedSegmentIds,
        proposedDepartmentIds: aiResult.recommendedDepartmentIds,
        linkedStudyIds: [],
        evidenceQuotes: aiResult.evidenceQuotes,
        businessSegmentId: parsed.data.businessSegmentId,
        departmentId: parsed.data.departmentId,
        province: parsed.data.province,
        period: parsed.data.period,
        isAiDraft: true,
        status: 'Draft AI',
        createdBy: user.uid,
        isUatSynthetic: Boolean(user.isUatSynthetic),
        createdAt: now,
        updatedAt: now,
      };

      mutateStore((state) => {
        state.pestelIssues.unshift(issue);
      });

      recordAuditLog({
        actorUid: user.uid,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'AI_PESTEL_ANALYZE',
        resourceType: 'pestel_issue',
        resourceId: issue.id,
        departmentId: issue.departmentId,
        details: `Ekstraksi AI PESTEL (${aiResult.modelUsed}) disimpan sebagai Draft AI untuk verifikasi.`,
      });

      res.status(201).json({ issue, modelUsed: aiResult.modelUsed });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Analisis Gemini API gagal dijalankan.',
      });
    }
  });

  const pestelCreateSchema = z.object({
    title: z.string().min(4).max(240),
    summary: z.string().min(10).max(4000),
    sourceUrl: z.string().max(1024).optional(),
    sourceTitle: z.string().max(300).optional(),
    publisher: z.string().max(160).optional(),
    sourcePublishedAt: z.string().max(40).optional(),
    categories: z.array(z.enum(['Political', 'Economic', 'Social', 'Technological', 'Environmental', 'Legal'])).min(1),
    riskOrOpportunity: z.enum(['risk', 'opportunity', 'both']).default('both'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    impactAnalysis: z.string().max(4000).default(''),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    province: z.string().max(80).default('Nasional'),
    period: z.string().max(32).default('2026-Q4'),
    status: z.enum(['Draft AI', 'Tervalidasi', 'Dipublikasikan', 'Arsip']).default('Tervalidasi'),
  });

  router.post('/v1/pestel', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = pestelCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data isu PESTEL tidak valid.', details: parsed.error.flatten() });
      return;
    }

    if (parsed.data.sourceUrl && parsed.data.sourceUrl.trim()) {
      const check = validatePublicNewsUrl(parsed.data.sourceUrl);
      if (!check.valid) {
        res.status(400).json({ error: check.reason });
        return;
      }
    }

    const now = new Date().toISOString();
    const issue: PestelIssue = {
      id: `pestel-${crypto.randomUUID().slice(0, 10)}`,
      ...parsed.data,
      proposedSegmentIds: [parsed.data.businessSegmentId],
      proposedDepartmentIds: [parsed.data.departmentId],
      linkedStudyIds: [],
      evidenceQuotes: [],
      isAiDraft: false,
      createdBy: user.uid,
      isUatSynthetic: Boolean(user.isUatSynthetic),
      createdAt: now,
      updatedAt: now,
    };

    mutateStore((state) => {
      state.pestelIssues.unshift(issue);
    });

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'CREATE_PESTEL_ISSUE',
      resourceType: 'pestel_issue',
      resourceId: issue.id,
      departmentId: issue.departmentId,
      details: `Menambahkan isu PESTEL "${issue.title}".`,
    });

    res.status(201).json({ issue });
  });

  router.patch('/v1/pestel/:id', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const { id } = req.params;
    const statusSchema = z.object({
      status: z.enum(['Draft AI', 'Tervalidasi', 'Dipublikasikan', 'Arsip']).optional(),
      linkedStudyId: z.string().optional(),
      impactAnalysis: z.string().max(4000).optional(),
    });
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Pembaruan PESTEL tidak valid.' });
      return;
    }

    const updated = mutateStore((state) => {
      const target = state.pestelIssues.find((i) => i.id === id);
      if (!target) return null;
      if (parsed.data.status) {
        target.status = parsed.data.status;
        target.isAiDraft = parsed.data.status === 'Draft AI';
        target.verifiedBy = user.uid;
      }
      if (parsed.data.impactAnalysis !== undefined) {
        target.impactAnalysis = parsed.data.impactAnalysis;
      }
      if (parsed.data.linkedStudyId) {
        if (!target.linkedStudyIds.includes(parsed.data.linkedStudyId)) {
          target.linkedStudyIds.push(parsed.data.linkedStudyId);
        }
        const study = state.researchStudies.find((s) => s.id === parsed.data.linkedStudyId);
        if (study && !study.linkedPestelIds.includes(target.id)) {
          study.linkedPestelIds.push(target.id);
        }
      }
      target.updatedAt = new Date().toISOString();
      return target;
    });

    if (!updated) {
      res.status(404).json({ error: 'Isu PESTEL tidak ditemukan.' });
      return;
    }

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'UPDATE_PESTEL_ISSUE',
      resourceType: 'pestel_issue',
      resourceId: id,
      departmentId: updated.departmentId,
      details: `Memperbarui status PESTEL "${updated.title}" menjadi ${updated.status}.`,
    });

    res.json({ issue: updated });
  });

  router.delete('/v1/pestel/:id', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const { id } = req.params;
    const deleted = mutateStore((state) => {
      const idx = state.pestelIssues.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      const [item] = state.pestelIssues.splice(idx, 1);
      return item;
    });
    if (!deleted) {
      res.status(404).json({ error: 'Isu PESTEL tidak ditemukan.' });
      return;
    }
    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'DELETE_PESTEL_ISSUE',
      resourceType: 'pestel_issue',
      resourceId: id,
      details: `Menghapus isu PESTEL "${deleted.title}".`,
    });
    res.json({ ok: true });
  });

  // Professions & Competency Directory (Bagian 8)
  router.get('/v1/competencies', (_req, res) => {
    const store = getStore();
    res.json({ competencies: store.competencies, professions: store.professions });
  });

  const competencySchema = z.object({
    code: z.string().min(2).max(64),
    name: z.string().min(3).max(200),
    category: z.enum(['core', 'technical', 'behavioral']),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    professionId: z.string().optional(),
    jobStandardRef: z.string().max(120).default('Belum Dikonfigurasi'),
    targetLevel: z.number().int().min(1).max(5).default(3),
    description: z.string().max(1000).default(''),
    configStatus: z.enum(['uat_synthetic', 'unconfigured', 'official']).default('uat_synthetic'),
  });

  router.post('/v1/competencies', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = competencySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data kompetensi tidak valid.' });
      return;
    }

    const item: CompetencyItem = {
      id: `comp-${crypto.randomUUID().slice(0, 8)}`,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    mutateStore((state) => {
      state.competencies.unshift(item);
    });
    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'CREATE_COMPETENCY',
      resourceType: 'competency',
      resourceId: item.id,
      details: `Menambahkan master kompetensi "${item.code} — ${item.name}".`,
    });
    res.status(201).json({ competency: item });
  });

  const professionSchema = z.object({
    code: z.string().min(2).max(64),
    name: z.string().min(3).max(180),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    grandDesignSummary: z.string().max(1500).default('Belum Dikonfigurasi'),
    configStatus: z.enum(['uat_synthetic', 'unconfigured', 'official']).default('uat_synthetic'),
  });

  router.post('/v1/professions', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = professionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data profesi tidak valid.' });
      return;
    }
    const item: ProfessionItem = {
      id: `prof-${crypto.randomUUID().slice(0, 8)}`,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    mutateStore((state) => {
      state.professions.unshift(item);
    });
    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'CREATE_PROFESSION',
      resourceType: 'profession',
      resourceId: item.id,
      details: `Menambahkan profesi "${item.name}".`,
    });
    res.status(201).json({ profession: item });
  });

  // CCA (Core Competency Analysis)
  router.get('/v1/cca', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const items = store.ccaAssessments.filter((c) =>
      canViewAnalysisRecord(user, c.status, c.businessSegmentId, c.departmentId, store.organizations),
    );
    res.json({ ccaList: items });
  });

  const ccaSchema = z.object({
    researchStudyId: z.string().min(1),
    competencyId: z.string().optional(),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    professionName: z.string().min(2).max(180),
    competencyType: z.enum(['core', 'technical']),
    competencyName: z.string().min(3).max(200),
    jobStandardRef: z.string().max(120).default('Belum Dikonfigurasi'),
    currentLevel: z.number().int().min(1).max(5),
    requiredLevel: z.number().int().min(1).max(5),
    gapNote: z.string().max(2000).default(''),
    configStatus: z.enum(['uat_synthetic', 'unconfigured', 'official']).default('uat_synthetic'),
    status: z.enum(['Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan']).default('Draft'),
  });

  router.post('/v1/cca', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = ccaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data CCA tidak valid.', details: parsed.error.flatten() });
      return;
    }

    const now = new Date().toISOString();
    const item: CcaAssessment = {
      id: `cca-${crypto.randomUUID().slice(0, 10)}`,
      ...parsed.data,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    mutateStore((state) => {
      state.ccaAssessments.unshift(item);
    });
    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'CREATE_CCA',
      resourceType: 'cca_assessment',
      resourceId: item.id,
      departmentId: item.departmentId,
      details: `Membuat CCA "${item.competencyName}".`,
    });
    res.status(201).json({ cca: item });
  });

  router.patch('/v1/cca/:id', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = z.object({ status: z.enum(['Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan']) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Status CCA tidak valid.' });
      return;
    }
    const updated = mutateStore((state) => {
      const target = state.ccaAssessments.find((c) => c.id === req.params.id);
      if (!target) return null;
      target.status = parsed.data.status;
      target.updatedAt = new Date().toISOString();
      return target;
    });
    if (!updated) {
      res.status(404).json({ error: 'Data CCA tidak ditemukan.' });
      return;
    }
    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'UPDATE_CCA_STATUS',
      resourceType: 'cca_assessment',
      resourceId: updated.id,
      details: `Status CCA diubah menjadi ${updated.status}.`,
    });
    res.json({ cca: updated });
  });

  // DNA (Developmental Need Analysis)
  router.get('/v1/dna', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const items = store.dnaAssessments.filter((d) =>
      canViewAnalysisRecord(user, d.status, d.businessSegmentId, d.departmentId, store.organizations),
    );
    res.json({ dnaList: items });
  });

  const dnaSchema = z.object({
    researchStudyId: z.string().min(1),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    futureCapabilityNeed: z.string().min(5).max(300),
    currentCondition: z.string().max(3000),
    targetCondition: z.string().max(3000),
    developmentGap: z.string().max(3000),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    supportingEvidence: z.string().min(5).max(3000),
    recommendation: z.string().min(5).max(3000),
    status: z.enum(['Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan']).default('Draft'),
  });

  router.post('/v1/dna', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = dnaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data DNA tidak valid.', details: parsed.error.flatten() });
      return;
    }

    const conclusionCheck = validateDnaConclusion({
      currentCondition: parsed.data.currentCondition,
      targetCondition: parsed.data.targetCondition,
      developmentGap: parsed.data.developmentGap,
    });
    if (!conclusionCheck.valid) {
      res.status(422).json({ error: conclusionCheck.reason });
      return;
    }

    const now = new Date().toISOString();
    const item: DnaAssessment = {
      id: `dna-${crypto.randomUUID().slice(0, 10)}`,
      ...parsed.data,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    mutateStore((state) => {
      state.dnaAssessments.unshift(item);
    });
    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'CREATE_DNA',
      resourceType: 'dna_assessment',
      resourceId: item.id,
      departmentId: item.departmentId,
      details: `Membuat DNA "${item.futureCapabilityNeed}".`,
    });
    res.status(201).json({ dna: item });
  });

  router.patch('/v1/dna/:id', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = z.object({ status: z.enum(['Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan']) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Status DNA tidak valid.' });
      return;
    }
    const updated = mutateStore((state) => {
      const target = state.dnaAssessments.find((d) => d.id === req.params.id);
      if (!target) return null;
      target.status = parsed.data.status;
      target.updatedAt = new Date().toISOString();
      return target;
    });
    if (!updated) {
      res.status(404).json({ error: 'Data DNA tidak ditemukan.' });
      return;
    }
    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'UPDATE_DNA_STATUS',
      resourceType: 'dna_assessment',
      resourceId: updated.id,
      details: `Status DNA diubah menjadi ${updated.status}.`,
    });
    res.json({ dna: updated });
  });

  // TNA (Training Need Analysis: TNA Korporat & TNA Unit)
  router.get('/v1/tna', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const cls = typeof req.query.classification === 'string' ? req.query.classification : 'all';
    const items = store.tnaAssessments.filter((t) => {
      if (!canViewAnalysisRecord(user, t.verificationStatus, t.businessSegmentId, t.departmentId, store.organizations)) {
        return false;
      }
      if (cls !== 'all' && t.tnaClassification !== cls) return false;
      return true;
    });
    res.json({ tnaList: items });
  });

  const tnaSchema = z.object({
    tnaClassification: z.enum(['TNA_KORPORAT', 'TNA_UNIT']),
    researchStudyId: z.string().min(1),
    dnaId: z.string().optional(),
    competencyId: z.string().optional(),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    professionName: z.string().min(2).max(180),
    requiredCompetency: z.string().min(3).max(200),
    actualLevel: z.number().int().min(1).max(5),
    targetLevel: z.number().int().min(1).max(5),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    participantCount: z.number().int().min(1).max(50000),
    proposedTraining: z.string().min(3).max(240),
    hasValidGapEvidence: z.boolean(),
    evidenceNote: z.string().max(2000).default(''),
    verificationStatus: z.enum(['Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan']).default('Draft'),
  });

  router.post('/v1/tna', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = tnaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data TNA tidak valid.', details: parsed.error.flatten() });
      return;
    }

    const now = new Date().toISOString();
    const item: TnaAssessment = {
      id: `tna-${crypto.randomUUID().slice(0, 10)}`,
      ...parsed.data,
      competencyGap: Math.max(0, parsed.data.targetLevel - parsed.data.actualLevel),
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };

    mutateStore((state) => {
      state.tnaAssessments.unshift(item);
    });
    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'CREATE_TNA',
      resourceType: 'tna_assessment',
      resourceId: item.id,
      departmentId: item.departmentId,
      details: `Membuat ${item.tnaClassification} "${item.proposedTraining}".`,
    });
    res.status(201).json({ tna: item });
  });

  router.patch('/v1/tna/:id', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = z
      .object({
        verificationStatus: z.enum(['Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan']),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Status TNA tidak valid.' });
      return;
    }
    const updated = mutateStore((state) => {
      const target = state.tnaAssessments.find((t) => t.id === req.params.id);
      if (!target) return null;
      target.verificationStatus = parsed.data.verificationStatus;
      target.updatedAt = new Date().toISOString();
      return target;
    });
    if (!updated) {
      res.status(404).json({ error: 'Data TNA tidak ditemukan.' });
      return;
    }
    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'UPDATE_TNA_STATUS',
      resourceType: 'tna_assessment',
      resourceId: updated.id,
      details: `Status TNA diubah menjadi ${updated.verificationStatus}.`,
    });
    res.json({ tna: updated });
  });

  // Learning Paths & Recommendations (Bagian 12)
  router.get('/v1/learning-paths', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const paths = store.learningPaths.filter((lp) =>
      canViewAnalysisRecord(user, lp.status, lp.businessSegmentId, lp.departmentId, store.organizations),
    );
    res.json({ learningPaths: paths });
  });

  const lpSchema = z.object({
    code: z.string().min(2).max(64),
    title: z.string().min(4).max(220),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    professionName: z.string().min(2).max(180),
    stages: z.array(z.string().min(2)).min(1),
    targetCompetencies: z.array(z.string()).default([]),
    description: z.string().max(1500).default(''),
    status: z.enum(['Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan']).default('Disetujui'),
  });

  router.post('/v1/learning-paths', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = lpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data Learning Path tidak valid.' });
      return;
    }
    const item: LearningPath = {
      id: `lp-${crypto.randomUUID().slice(0, 8)}`,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    mutateStore((state) => {
      state.learningPaths.unshift(item);
    });
    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'CREATE_LEARNING_PATH',
      resourceType: 'learning_path',
      resourceId: item.id,
      details: `Membuat Learning Path "${item.title}".`,
    });
    res.status(201).json({ learningPath: item });
  });

  router.get('/v1/recommendations', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const items = store.recommendations.filter((r) => canViewRecommendation(user, r, store.organizations));
    res.json({ recommendations: items });
  });

  const recSchema = z.object({
    programTitle: z.string().min(4).max(240),
    needSource: z.enum(['LNA', 'CCA', 'DNA', 'TNA', 'PESTEL']),
    researchStudyId: z.string().min(1),
    tnaId: z.string().optional(),
    learningPathId: z.string().optional(),
    professionDesignRef: z.string().max(200).optional(),
    targetCompetency: z.string().min(3).max(200),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    targetAudience: z.string().min(3).max(200),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('high'),
    deliveryMethods: z
      .array(
        z.enum([
          'In-Class Training',
          'Digital Learning',
          'Blended Learning',
          'Coaching & Mentoring',
          'Action Learning',
          'Workshop & Simulasi',
          'Intervensi Non-Pelatihan',
        ]),
      )
      .min(1),
    isNonTrainingIntervention: z.boolean().default(false),
    nonTrainingNote: z.string().max(1000).optional(),
    isAiSuggested: z.boolean().default(false),
    approvalStatus: z
      .enum(['Usulan AI', 'Menunggu Persetujuan', 'Disetujui', 'Dipublikasikan', 'Ditolak'])
      .default('Menunggu Persetujuan'),
    followUpPlan: z.string().max(1500).default(''),
    estimatedParticipants: z.number().int().min(1).max(50000),
  });

  router.post('/v1/recommendations', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = recSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data rekomendasi pembelajaran tidak valid.', details: parsed.error.flatten() });
      return;
    }

    const store = getStore();
    if (!parsed.data.isNonTrainingIntervention && parsed.data.tnaId) {
      const tna = store.tnaAssessments.find((t) => t.id === parsed.data.tnaId);
      if (!tna) {
        res.status(404).json({ error: 'Data TNA referensi tidak ditemukan.' });
        return;
      }
      const gate = evaluateTnaRecommendationEligibility(tna);
      if (!gate.eligible) {
        res.status(422).json({
          error: gate.reason,
          recommendedMode: gate.recommendedMode,
        });
        return;
      }
    }

    const now = new Date().toISOString();
    const item: LearningRecommendation = {
      id: `rec-${crypto.randomUUID().slice(0, 10)}`,
      ...parsed.data,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };

    mutateStore((state) => {
      state.recommendations.unshift(item);
    });

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'CREATE_RECOMMENDATION',
      resourceType: 'learning_recommendation',
      resourceId: item.id,
      departmentId: item.departmentId,
      details: `Membuat rekomendasi pembelajaran "${item.programTitle}".`,
    });

    res.status(201).json({ recommendation: item });
  });

  router.patch('/v1/recommendations/:id', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const parsed = z
      .object({
        approvalStatus: z.enum(['Usulan AI', 'Menunggu Persetujuan', 'Disetujui', 'Dipublikasikan', 'Ditolak']),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Status persetujuan rekomendasi tidak valid.' });
      return;
    }

    const updated = mutateStore((state) => {
      const target = state.recommendations.find((r) => r.id === req.params.id);
      if (!target) return null;
      target.approvalStatus = parsed.data.approvalStatus;
      if (parsed.data.approvalStatus === 'Disetujui' || parsed.data.approvalStatus === 'Dipublikasikan') {
        target.approvedBy = user.uid;
      }
      target.updatedAt = new Date().toISOString();
      return target;
    });
    if (!updated) {
      res.status(404).json({ error: 'Rekomendasi tidak ditemukan.' });
      return;
    }

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'UPDATE_RECOMMENDATION_STATUS',
      resourceType: 'learning_recommendation',
      resourceId: updated.id,
      details: `Status rekomendasi "${updated.programTitle}" diubah menjadi ${updated.approvalStatus}.`,
    });
    res.json({ recommendation: updated });
  });

  // Masukan Management (Bagian 11)
  router.get('/v1/management-feedback', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (user.role === 'USER') {
      res.status(403).json({ error: 'Peran User tidak memiliki akses ke modul Masukan Management.' });
      return;
    }
    const store = getStore();
    const visibleStudyIds = new Set(
      store.researchStudies.filter((s) => canViewResearchStudy(user, s, store.organizations)).map((s) => s.id),
    );
    const feedback = store.managementFeedback.filter(
      (f) => user.role === 'SUPER_ADMIN' || f.submittedByUid === user.uid || visibleStudyIds.has(f.researchStudyId),
    );
    res.json({ feedback });
  });

  const feedbackCreateSchema = z.object({
    researchStudyId: z.string().min(1),
    title: z.string().min(4).max(200),
    comment: z.string().min(10).max(3000),
    improvementSuggestion: z.string().min(5).max(3000),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  });

  router.post('/v1/management-feedback', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (!canSubmitManagementFeedback(user)) {
      res.status(403).json({ error: 'Hanya akun peran Management yang dapat mengirim masukan perbaikan.' });
      return;
    }

    const parsed = feedbackCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data masukan tidak valid.', details: parsed.error.flatten() });
      return;
    }

    const store = getStore();
    const study = store.researchStudies.find((s) => s.id === parsed.data.researchStudyId);
    if (!study || !canViewResearchStudy(user, study, store.organizations)) {
      res.status(403).json({ error: 'Anda tidak memiliki izin memberikan masukan pada penelitian tersebut.' });
      return;
    }

    const now = new Date().toISOString();
    const entry: ManagementFeedback = {
      id: `fb-${crypto.randomUUID().slice(0, 10)}`,
      ...parsed.data,
      submittedByUid: user.uid,
      submittedByName: user.displayName,
      status: 'Baru',
      createdAt: now,
      updatedAt: now,
    };

    mutateStore((state) => {
      state.managementFeedback.unshift(entry);
    });

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'SUBMIT_MANAGEMENT_FEEDBACK',
      resourceType: 'management_feedback',
      resourceId: entry.id,
      departmentId: study.departmentId,
      details: `Management mengirim masukan "${entry.title}" untuk penelitian ${study.studyCode}.`,
    });

    res.status(201).json({ feedback: entry });
  });

  const feedbackRespondSchema = z.object({
    status: z.enum(['Baru', 'Ditinjau', 'Ditindaklanjuti', 'Selesai']),
    adminResponse: z.string().min(4).max(3000),
    decisionReason: z.string().min(4).max(2000),
  });

  router.patch('/v1/management-feedback/:id/respond', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (!canRespondManagementFeedback(user)) {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat menanggapi dan memperbarui status masukan Management.' });
      return;
    }

    const parsed = feedbackRespondSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data tanggapan tidak valid.', details: parsed.error.flatten() });
      return;
    }

    const updated = mutateStore((state) => {
      const target = state.managementFeedback.find((f) => f.id === req.params.id);
      if (!target) return null;
      const now = new Date().toISOString();
      target.status = parsed.data.status;
      target.adminResponse = parsed.data.adminResponse.trim();
      target.decisionReason = parsed.data.decisionReason.trim();
      target.respondedByUid = user.uid;
      target.respondedByName = user.displayName;
      target.respondedAt = now;
      target.updatedAt = now;
      return target;
    });

    if (!updated) {
      res.status(404).json({ error: 'Masukan Management tidak ditemukan.' });
      return;
    }

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'RESPOND_MANAGEMENT_FEEDBACK',
      resourceType: 'management_feedback',
      resourceId: updated.id,
      details: `Menanggapi masukan "${updated.title}" dengan status ${updated.status}.`,
    });

    res.json({ feedback: updated });
  });

  // Relationship Map
  router.get('/v1/relationship-map', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const studies = store.researchStudies.filter((s) => canViewResearchStudy(user, s, store.organizations));
    const pestelIssues = store.pestelIssues.filter((i) => canViewPestelIssue(user, i, store.organizations));
    const ccaList = store.ccaAssessments.filter((c) =>
      canViewAnalysisRecord(user, c.status, c.businessSegmentId, c.departmentId, store.organizations),
    );
    const dnaList = store.dnaAssessments.filter((d) =>
      canViewAnalysisRecord(user, d.status, d.businessSegmentId, d.departmentId, store.organizations),
    );
    const tnaList = store.tnaAssessments.filter((t) =>
      canViewAnalysisRecord(user, t.verificationStatus, t.businessSegmentId, t.departmentId, store.organizations),
    );
    const recommendations = store.recommendations.filter((r) => canViewRecommendation(user, r, store.organizations));
    const learningPaths = store.learningPaths.filter((lp) =>
      canViewAnalysisRecord(user, lp.status, lp.businessSegmentId, lp.departmentId, store.organizations),
    );

    const graph = buildRelationshipGraph({
      studies,
      pestelIssues,
      orgs: store.organizations,
      ccaList,
      dnaList,
      tnaList,
      recommendations,
      learningPaths,
    });
    res.json(graph);
  });

  // User Management & Protected UAT 3-Role Provisioning (SUPER_ADMIN ONLY)
  router.get('/v1/users', requireSuperAdmin, (_req, res) => {
    const users = getStore().users.map(toSafeUser);
    res.json({ users });
  });

  const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    displayName: z.string().min(2).max(120),
    role: z.enum(['SUPER_ADMIN', 'MANAGEMENT', 'USER']),
    businessSegmentId: z.string().min(1),
    departmentId: z.string().min(1),
    orgScopeIds: z.array(z.string()).default([]),
    isUatSynthetic: z.boolean().default(false),
  });

  router.post('/v1/users', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Data pengguna tidak valid (password minimal 8 karakter).', details: parsed.error.flatten() });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    if (findUserByEmail(email)) {
      res.status(409).json({ error: 'Email tersebut sudah terdaftar.' });
      return;
    }

    const { hash, salt } = hashPassword(parsed.data.password);
    const now = new Date().toISOString();
    const created = mutateStore((state) => {
      const scopes =
        parsed.data.role === 'SUPER_ADMIN'
          ? ['ALL_CORPORATE']
          : parsed.data.orgScopeIds.length > 0
            ? parsed.data.orgScopeIds
            : [parsed.data.departmentId];
      const u = {
        uid: `usr-${crypto.randomUUID()}`,
        email,
        passwordHash: hash,
        passwordSalt: salt,
        displayName: parsed.data.displayName.trim(),
        role: parsed.data.role,
        businessSegmentId: parsed.data.businessSegmentId,
        departmentId: parsed.data.departmentId,
        orgScopeIds: scopes,
        isActive: true,
        isUatSynthetic: parsed.data.isUatSynthetic,
        createdAt: now,
        updatedAt: now,
      };
      state.users.push(u);
      return u;
    });

    recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'CREATE_USER',
      resourceType: 'user',
      resourceId: created.uid,
      departmentId: created.departmentId,
      details: `Membuat akun ${created.role} (${created.email}).`,
    });

    res.status(201).json({ user: toSafeUser(created) });
  });

  router.patch('/v1/users/:uid', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    const parsed = z
      .object({
        role: z.enum(['SUPER_ADMIN', 'MANAGEMENT', 'USER']).optional(),
        businessSegmentId: z.string().optional(),
        departmentId: z.string().optional(),
        orgScopeIds: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        newPassword: z.string().min(8).max(128).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Pembaruan pengguna tidak valid.' });
      return;
    }

    const updated = mutateStore((state) => {
      const target = state.users.find((u) => u.uid === req.params.uid);
      if (!target) return null;
      if (parsed.data.role) target.role = parsed.data.role;
      if (parsed.data.businessSegmentId) target.businessSegmentId = parsed.data.businessSegmentId;
      if (parsed.data.departmentId) target.departmentId = parsed.data.departmentId;
      if (parsed.data.orgScopeIds) target.orgScopeIds = parsed.data.orgScopeIds;
      if (typeof parsed.data.isActive === 'boolean') {
        target.isActive = parsed.data.isActive;
        if (!parsed.data.isActive) {
          target.tokensValidAfter = Date.now();
          revokeUserSessionsInState(state, target.uid);
        }
      }
      if (parsed.data.newPassword) {
        const { hash, salt } = hashPassword(parsed.data.newPassword);
        target.passwordHash = hash;
        target.passwordSalt = salt;
        target.tokensValidAfter = Date.now();
        revokeUserSessionsInState(state, target.uid);
      }
      target.updatedAt = new Date().toISOString();
      return target;
    });

    if (!updated) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }

    recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'UPDATE_USER',
      resourceType: 'user',
      resourceId: updated.uid,
      details: `Memperbarui pengguna ${updated.email} (role: ${updated.role}, aktif: ${updated.isActive}).`,
    });

    res.json({ user: toSafeUser(updated) });
  });

  // Protected UAT Synthetic 3-Role Provisioning (only accessible by authenticated SUPER_ADMIN)
  router.post('/v1/users/provision-uat', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    const specs: Array<{
      email: string;
      displayName: string;
      role: 'SUPER_ADMIN' | 'MANAGEMENT' | 'USER';
      seg: string;
      dept: string;
      scopes: string[];
    }> = [
      {
        email: 'uat.superadmin@plncorpu.local',
        displayName: 'UAT Super Admin (Sintetis)',
        role: 'SUPER_ADMIN',
        seg: 'seg-penunjang-korporat',
        dept: 'dept-corpu-lvc',
        scopes: ['ALL_CORPORATE'],
      },
      {
        email: 'uat.management@plncorpu.local',
        displayName: 'UAT Management Transmisi (Sintetis)',
        role: 'MANAGEMENT',
        seg: 'seg-transmisi',
        dept: 'dept-transmisi-grid',
        scopes: ['dept-transmisi-grid'],
      },
      {
        email: 'uat.user@plncorpu.local',
        displayName: 'UAT User Transmisi (Sintetis)',
        role: 'USER',
        seg: 'seg-transmisi',
        dept: 'dept-transmisi-grid',
        scopes: ['dept-transmisi-grid'],
      },
    ];

    const issuedCredentials: Array<{ email: string; role: string; department: string; oneTimePassword: string }> = [];
    const now = new Date().toISOString();

    mutateStore((state) => {
      for (const spec of specs) {
        const plainPassword = generateStrongPassword();
        const { hash, salt } = hashPassword(plainPassword);
        const existing = state.users.find((u) => u.email.toLowerCase() === spec.email);
        if (existing) {
          existing.passwordHash = hash;
          existing.passwordSalt = salt;
          existing.role = spec.role;
          existing.businessSegmentId = spec.seg;
          existing.departmentId = spec.dept;
          existing.orgScopeIds = spec.scopes;
          existing.isActive = true;
          existing.isUatSynthetic = true;
          existing.updatedAt = now;
        } else {
          state.users.push({
            uid: `usr-${crypto.randomUUID()}`,
            email: spec.email,
            passwordHash: hash,
            passwordSalt: salt,
            displayName: spec.displayName,
            role: spec.role,
            businessSegmentId: spec.seg,
            departmentId: spec.dept,
            orgScopeIds: spec.scopes,
            isActive: true,
            isUatSynthetic: true,
            createdAt: now,
            updatedAt: now,
          });
        }
        issuedCredentials.push({
          email: spec.email,
          role: spec.role,
          department: spec.dept,
          oneTimePassword: plainPassword,
        });
      }
    });

    recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PROVISION_UAT_ACCOUNTS',
      resourceType: 'user',
      resourceId: 'uat-3-roles',
      details: 'Membuat/mereset 3 akun uji sintetis (SUPER_ADMIN, MANAGEMENT, USER) dengan password acak kuat.',
    });

    res.status(201).json({ credentials: issuedCredentials });
  });

  // Audit Logs & Approval History
  router.get('/v1/audit-logs', requireSuperAdmin, (_req, res) => {
    const store = getStore();
    res.json({ logs: store.auditLogs.slice(0, 200), approvalHistory: store.approvalHistory.slice(0, 100) });
  });

  // Authorized Export (CSV / JSON)
  router.get('/v1/export', (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const visibleStudies = store.researchStudies.filter((s) => canViewResearchStudy(user, s, store.organizations));
    const visibleIssues = store.pestelIssues.filter((i) => canViewPestelIssue(user, i, store.organizations));
    const visibleTna = store.tnaAssessments.filter((t) =>
      canViewAnalysisRecord(user, t.verificationStatus, t.businessSegmentId, t.departmentId, store.organizations),
    );
    const visibleRecs = store.recommendations.filter((r) => canViewRecommendation(user, r, store.organizations));

    recordAuditLog({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'EXPORT_DATA',
      resourceType: 'report',
      resourceId: format,
      details: `Ekspor ${format.toUpperCase()} oleh ${user.role} (${visibleStudies.length} penelitian LNA).`,
    });

    if (format === 'csv') {
      const orgMap = new Map(store.organizations.map((o) => [o.id, o.name]));
      const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [
        ['Kode', 'Judul Penelitian LNA', 'Bidang Bisnis', 'Departemen', 'Tahun', 'Prioritas', 'Status', 'Kategori PESTEL'].join(','),
        ...visibleStudies.map((s) =>
          [
            esc(s.studyCode),
            esc(s.title),
            esc(orgMap.get(s.businessSegmentId) || s.businessSegmentId),
            esc(orgMap.get(s.departmentId) || s.departmentId),
            esc(s.year),
            esc(s.priority),
            esc(s.status),
            esc(s.relatedPestelCategories.join('; ')),
          ].join(','),
        ),
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="plncorpu-lna-export.csv"');
      res.send(lines.join('\n'));
      return;
    }

    res.json({
      exportedAt: new Date().toISOString(),
      exportedBy: { email: user.email, role: user.role },
      researchStudies: visibleStudies,
      pestelIssues: visibleIssues,
      tnaAssessments: visibleTna,
      recommendations: visibleRecs,
    });
  });

  return router;
}
