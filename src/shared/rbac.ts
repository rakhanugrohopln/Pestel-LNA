import type {
  AnalysisPublishStatus,
  LearningRecommendation,
  OrgLevel,
  OrganizationNode,
  PestelIssue,
  ResearchStudy,
  TnaAssessment,
  UserProfile,
} from './types.ts';

export function buildDepartmentResearchPath(slug: string): string {
  return `/lna/departemen/${slug}`;
}

export function buildStudyDetailPath(id: string): string {
  return `/lna/${id}`;
}

export function generateUniqueSlug(name: string, existingSlugs: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96) || 'organisasi';

  const used = new Set(existingSlugs);
  if (!used.has(base)) {
    return base;
  }

  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

export function isSuperAdmin(user: UserProfile): boolean {
  return user.role === 'SUPER_ADMIN';
}

export function isManagement(user: UserProfile): boolean {
  return user.role === 'MANAGEMENT';
}

export function isRegularUser(user: UserProfile): boolean {
  return user.role === 'USER';
}

export function getDescendantOrgIds(rootOrgId: string, orgs: OrganizationNode[]): Set<string> {
  const result = new Set<string>([rootOrgId]);
  let added = true;
  while (added) {
    added = false;
    for (const org of orgs) {
      if (org.parentId && result.has(org.parentId) && !result.has(org.id)) {
        result.add(org.id);
        added = true;
      }
      if (org.businessSegmentId === rootOrgId && !result.has(org.id)) {
        result.add(org.id);
        added = true;
      }
    }
  }
  return result;
}

export function getUserScopedOrgIds(user: UserProfile, orgs: OrganizationNode[]): Set<string> {
  if (user.role === 'SUPER_ADMIN') {
    return new Set(orgs.map((o) => o.id));
  }

  const seeds = new Set<string>([
    user.businessSegmentId,
    user.departmentId,
    ...(user.unitId ? [user.unitId] : []),
    ...user.orgScopeIds,
  ].filter(Boolean));

  // Corporate-level scope ('korporat' or 'seg-penunjang-korporat' when explicitly assigned as corporate)
  if (user.orgScopeIds.includes('ALL_CORPORATE')) {
    return new Set(orgs.map((o) => o.id));
  }

  const result = new Set<string>();
  for (const seed of seeds) {
    // Only expand downwards if seed is department or unit or explicitly scoped segment
    if (seed === user.businessSegmentId && !user.orgScopeIds.includes(seed)) {
      continue;
    }
    const descendants = getDescendantOrgIds(seed, orgs);
    for (const d of descendants) {
      result.add(d);
    }
  }
  if (user.departmentId) result.add(user.departmentId);
  if (user.unitId) result.add(user.unitId);
  return result;
}

export function canAccessOrgRecord(
  user: UserProfile,
  recordSegmentId: string,
  recordDepartmentId: string,
  orgs: OrganizationNode[],
): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.orgScopeIds.includes('ALL_CORPORATE')) return true;
  const scoped = getUserScopedOrgIds(user, orgs);
  return scoped.has(recordDepartmentId) || scoped.has(recordSegmentId);
}

export function canViewResearchStudy(
  user: UserProfile,
  study: ResearchStudy,
  orgs: OrganizationNode[],
): boolean {
  if (user.isUatSynthetic && study.isUatSynthetic === false) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  const orgAllowed = canAccessOrgRecord(user, study.businessSegmentId, study.departmentId, orgs);
  if (!orgAllowed) return false;

  if (user.role === 'MANAGEMENT') {
    return study.status !== 'Draft';
  }

  // USER strictly sees published studies only
  return study.status === 'Dipublikasikan';
}

export function canViewPestelIssue(
  user: UserProfile,
  issue: PestelIssue,
  orgs: OrganizationNode[],
): boolean {
  if (user.isUatSynthetic && issue.isUatSynthetic === false) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  const orgAllowed =
    canAccessOrgRecord(user, issue.businessSegmentId, issue.departmentId, orgs) ||
    issue.proposedDepartmentIds.some((d) => getUserScopedOrgIds(user, orgs).has(d));
  if (!orgAllowed) return false;

  if (user.role === 'MANAGEMENT') {
    return issue.status !== 'Arsip';
  }

  return issue.status === 'Dipublikasikan';
}

export function canViewAnalysisRecord(
  user: UserProfile,
  status: AnalysisPublishStatus,
  businessSegmentId: string,
  departmentId: string,
  orgs: OrganizationNode[],
): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (!canAccessOrgRecord(user, businessSegmentId, departmentId, orgs)) return false;

  if (user.role === 'MANAGEMENT') {
    return status !== 'Draft';
  }

  return status === 'Dipublikasikan';
}

export function canViewRecommendation(
  user: UserProfile,
  rec: LearningRecommendation,
  orgs: OrganizationNode[],
): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (!canAccessOrgRecord(user, rec.businessSegmentId, rec.departmentId, orgs)) return false;

  if (user.role === 'MANAGEMENT') {
    return rec.approvalStatus !== 'Usulan AI';
  }

  return rec.approvalStatus === 'Dipublikasikan';
}

export function canSubmitManagementFeedback(user: UserProfile): boolean {
  return user.role === 'MANAGEMENT';
}

export function canRespondManagementFeedback(user: UserProfile): boolean {
  return user.role === 'SUPER_ADMIN';
}

export function validateDnaConclusion(params: {
  currentCondition: string;
  targetCondition: string;
  developmentGap: string;
}): { valid: boolean; reason?: string } {
  const actual = params.currentCondition.trim();
  const target = params.targetCondition.trim();
  const gap = params.developmentGap.trim();

  if (!actual || actual.length < 10) {
    return {
      valid: false,
      reason: 'Kondisi aktual saat ini wajib diisi (minimal 10 karakter) sebelum menyimpulkan gap pengembangan DNA.',
    };
  }
  if (!target || target.length < 10) {
    return {
      valid: false,
      reason: 'Kondisi target masa depan wajib diisi sebelum menyimpulkan gap pengembangan DNA.',
    };
  }
  if (!gap || gap.length < 5) {
    return {
      valid: false,
      reason: 'Deskripsi gap pengembangan wajib dijelaskan berdasarkan perbandingan kondisi aktual dan target.',
    };
  }
  return { valid: true };
}

export function evaluateTnaRecommendationEligibility(
  tna: Pick<TnaAssessment, 'hasValidGapEvidence' | 'actualLevel' | 'targetLevel' | 'verificationStatus'>,
): { eligible: boolean; recommendedMode: 'training' | 'non_training_or_assessment'; reason: string } {
  if (tna.verificationStatus !== 'Terverifikasi' && tna.verificationStatus !== 'Disetujui' && tna.verificationStatus !== 'Dipublikasikan') {
    return {
      eligible: false,
      recommendedMode: 'non_training_or_assessment',
      reason: 'TNA harus terverifikasi atau disetujui terlebih dahulu sebelum menghasilkan rekomendasi pelatihan.',
    };
  }

  if (!tna.hasValidGapEvidence || tna.targetLevel <= tna.actualLevel) {
    return {
      eligible: false,
      recommendedMode: 'non_training_or_assessment',
      reason: 'Tidak ada bukti gap kompetensi terukur (target <= aktual). Pertimbangkan asesmen lanjutan atau intervensi non-pelatihan.',
    };
  }

  return {
    eligible: true,
    recommendedMode: 'training',
    reason: `Gap kompetensi (${tna.actualLevel} → ${tna.targetLevel}) terverifikasi dan memenuhi syarat rekomendasi pembelajaran.`,
  };
}

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  reason?: string;
}

function isPrivateOrLoopbackIpv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d+$/.test(p))) {
    return false;
  }
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => n < 0 || n > 255)) return true;
  const [a, b] = nums;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function validatePublicNewsUrl(rawUrl: string): UrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, reason: 'URL sumber berita wajib diisi.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Format URL tidak valid. Gunakan URL lengkap dengan https://.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Hanya protokol HTTP atau HTTPS yang diizinkan.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URL dengan kredensial tersemat tidak diizinkan.' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) {
    return { valid: false, reason: 'Hostname sumber berita tidak ditemukan.' };
  }

  const blockedHosts = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'metadata.google.internal',
    'metadata',
  ]);
  if (
    blockedHosts.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    isPrivateOrLoopbackIpv4(host) ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return {
      valid: false,
      reason: 'Akses ke alamat jaringan internal atau metadata server diblokir oleh proteksi SSRF.',
    };
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}

export function getOrgLevelLabel(level: OrgLevel): string {
  if (level === 'segment') return 'Bidang Bisnis';
  if (level === 'directorate') return 'Direktorat';
  if (level === 'department') return 'Departemen';
  return 'Unit Kerja';
}
