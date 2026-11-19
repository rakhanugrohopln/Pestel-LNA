import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDepartmentResearchPath,
  canSubmitManagementFeedback,
  canViewAnalysisRecord,
  canViewPestelIssue,
  canViewResearchStudy,
  evaluateTnaRecommendationEligibility,
  generateUniqueSlug,
  validateDnaConclusion,
  validatePublicNewsUrl,
} from './rbac.ts';
import { buildRelationshipGraph } from './graph.ts';
import type { OrganizationNode, PestelIssue, ResearchStudy, UserProfile } from './types.ts';

const orgs: OrganizationNode[] = [
  {
    id: 'seg-transmisi',
    name: 'Transmisi dan Penyaluran',
    slug: 'transmisi',
    level: 'segment',
    businessSegmentId: 'seg-transmisi',
    description: 'Sistem transmisi',
    createdBy: 'system',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-transmisi-grid',
    name: 'Departemen Sistem Transmisi & Smart Grid',
    slug: 'transmisi-smart-grid',
    level: 'department',
    parentId: 'seg-transmisi',
    businessSegmentId: 'seg-transmisi',
    description: 'Smart grid',
    createdBy: 'system',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seg-pembangkitan',
    name: 'Pembangkitan',
    slug: 'pembangkitan',
    level: 'segment',
    businessSegmentId: 'seg-pembangkitan',
    description: 'Pembangkitan',
    createdBy: 'system',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-pembangkitan-ops',
    name: 'Departemen Operasional Pembangkit',
    slug: 'pembangkitan-operasional',
    level: 'department',
    parentId: 'seg-pembangkitan',
    businessSegmentId: 'seg-pembangkitan',
    description: 'Operasional pembangkit',
    createdBy: 'system',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const superAdmin: UserProfile = {
  uid: 'u-sa',
  email: 'sa@pln.co.id',
  displayName: 'Super Admin',
  role: 'SUPER_ADMIN',
  businessSegmentId: 'seg-transmisi',
  departmentId: 'dept-transmisi-grid',
  orgScopeIds: ['ALL_CORPORATE'],
  isActive: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const mgmtTransmisi: UserProfile = {
  uid: 'u-mgmt',
  email: 'mgmt@pln.co.id',
  displayName: 'Management Transmisi',
  role: 'MANAGEMENT',
  businessSegmentId: 'seg-transmisi',
  departmentId: 'dept-transmisi-grid',
  orgScopeIds: ['dept-transmisi-grid'],
  isActive: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const userTransmisi: UserProfile = {
  uid: 'u-user',
  email: 'user@pln.co.id',
  displayName: 'User Transmisi',
  role: 'USER',
  businessSegmentId: 'seg-transmisi',
  departmentId: 'dept-transmisi-grid',
  orgScopeIds: ['dept-transmisi-grid'],
  isActive: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const draftTransmisiStudy: ResearchStudy = {
  id: 'st-draft',
  studyCode: 'LNA-2026-01',
  title: 'Draft Kajian Smart Grid',
  year: 2026,
  businessSegmentId: 'seg-transmisi',
  departmentId: 'dept-transmisi-grid',
  background: 'Latar belakang',
  problemStatement: 'Rumusan',
  objectives: 'Tujuan',
  strategicIssueSource: 'PESTEL',
  relatedPestelCategories: ['Technological'],
  linkedPestelIds: [],
  sourceUrls: [],
  supportingEvidence: 'Data internal',
  currentConditionAnalysis: 'Kondisi saat ini',
  orgNeedsAnalysis: 'Kebutuhan organisasi',
  competencyNeeds: 'Kompetensi IEC 61850',
  lnaResult: 'Hasil LNA',
  ccaSummary: '',
  dnaSummary: '',
  tnaSummary: '',
  developmentRecommendation: '',
  status: 'Draft',
  priority: 'high',
  leadName: 'Tim LNA',
  ownerUserId: 'u-sa',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const reviewTransmisiStudy: ResearchStudy = {
  ...draftTransmisiStudy,
  id: 'st-review',
  status: 'Menunggu Masukan',
};

const publishedTransmisiStudy: ResearchStudy = {
  ...draftTransmisiStudy,
  id: 'st-pub',
  status: 'Dipublikasikan',
};

const pembangkitanPublishedStudy: ResearchStudy = {
  ...draftTransmisiStudy,
  id: 'st-pemb',
  businessSegmentId: 'seg-pembangkitan',
  departmentId: 'dept-pembangkitan-ops',
  status: 'Dipublikasikan',
};

test('department slug and route generation', () => {
  const slug = generateUniqueSlug('Departemen Sistem Transmisi', ['departemen-sistem-transmisi']);
  assert.equal(slug, 'departemen-sistem-transmisi-2');
  assert.equal(buildDepartmentResearchPath(slug), '/lna/departemen/departemen-sistem-transmisi-2');
});

test('3-role research visibility and organizational isolation', () => {
  // SUPER_ADMIN sees all
  assert.equal(canViewResearchStudy(superAdmin, draftTransmisiStudy, orgs), true);
  assert.equal(canViewResearchStudy(superAdmin, pembangkitanPublishedStudy, orgs), true);

  // MANAGEMENT sees non-Draft within own department, not other departments unless scoped
  assert.equal(canViewResearchStudy(mgmtTransmisi, draftTransmisiStudy, orgs), false);
  assert.equal(canViewResearchStudy(mgmtTransmisi, reviewTransmisiStudy, orgs), true);
  assert.equal(canViewResearchStudy(mgmtTransmisi, pembangkitanPublishedStudy, orgs), false);

  // USER sees ONLY Dipublikasikan within own department
  assert.equal(canViewResearchStudy(userTransmisi, draftTransmisiStudy, orgs), false);
  assert.equal(canViewResearchStudy(userTransmisi, reviewTransmisiStudy, orgs), false);
  assert.equal(canViewResearchStudy(userTransmisi, publishedTransmisiStudy, orgs), true);
  assert.equal(canViewResearchStudy(userTransmisi, pembangkitanPublishedStudy, orgs), false);
});

test('PESTEL and analysis visibility follow strict 3-role publishing rules', () => {
  const aiIssue: PestelIssue = {
    id: 'p-1',
    title: 'Draft AI Regulasi',
    summary: 'Ringkasan',
    categories: ['Legal'],
    riskOrOpportunity: 'risk',
    severity: 'high',
    impactAnalysis: 'Dampak',
    proposedSegmentIds: ['seg-transmisi'],
    proposedDepartmentIds: ['dept-transmisi-grid'],
    linkedStudyIds: [],
    evidenceQuotes: [],
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
    province: 'Nasional',
    period: '2026-Q4',
    isAiDraft: true,
    status: 'Draft AI',
    createdBy: 'u-sa',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  assert.equal(canViewPestelIssue(superAdmin, aiIssue, orgs), true);
  assert.equal(canViewPestelIssue(userTransmisi, aiIssue, orgs), false);
  assert.equal(canViewAnalysisRecord(userTransmisi, 'Disetujui', 'seg-transmisi', 'dept-transmisi-grid', orgs), false);
  assert.equal(canViewAnalysisRecord(userTransmisi, 'Dipublikasikan', 'seg-transmisi', 'dept-transmisi-grid', orgs), true);
  assert.equal(canSubmitManagementFeedback(mgmtTransmisi), true);
  assert.equal(canSubmitManagementFeedback(userTransmisi), false);
});

test('DNA requires actual condition before gap conclusion and TNA enforces evidence gating', () => {
  assert.equal(
    validateDnaConclusion({ currentCondition: '', targetCondition: 'Target memadai', developmentGap: 'Gap' }).valid,
    false,
  );
  assert.equal(
    validateDnaConclusion({
      currentCondition: 'Operator masih menggunakan inspeksi manual tanpa sensor digital.',
      targetCondition: 'Operasi gardu induk digital berbasis IEC 61850.',
      developmentGap: 'Gap kapabilitas otomasi proteksi dan telemetri digital.',
    }).valid,
    true,
  );

  const noGap = evaluateTnaRecommendationEligibility({
    hasValidGapEvidence: false,
    actualLevel: 4,
    targetLevel: 4,
    verificationStatus: 'Disetujui',
  });
  assert.equal(noGap.eligible, false);

  const validGap = evaluateTnaRecommendationEligibility({
    hasValidGapEvidence: true,
    actualLevel: 2,
    targetLevel: 4,
    verificationStatus: 'Disetujui',
  });
  assert.equal(validGap.eligible, true);
});

test('SSRF protection blocks internal/loopback/metadata hosts', () => {
  assert.equal(validatePublicNewsUrl('http://127.0.0.1:3000/api/health').valid, false);
  assert.equal(validatePublicNewsUrl('http://169.254.169.254/latest/meta-data').valid, false);
  assert.equal(validatePublicNewsUrl('https://web.pln.co.id/media/siaran-pers').valid, true);
});

test('Slide 8 relationship graph maps studies and departments cleanly', () => {
  const graph = buildRelationshipGraph({
    studies: [publishedTransmisiStudy],
    pestelIssues: [],
    orgs,
    ccaList: [],
    dnaList: [],
    tnaList: [],
    recommendations: [],
    learningPaths: [],
  });
  assert.ok(graph.nodes.some((n) => n.kind === 'lna_study'));
  assert.ok(graph.nodes.some((n) => n.kind === 'department'));
});
