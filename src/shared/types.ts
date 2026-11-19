export type UserRole = 'SUPER_ADMIN' | 'MANAGEMENT' | 'USER';

export type OrgLevel = 'segment' | 'directorate' | 'department' | 'unit';

export type PestelCategory =
  | 'Political'
  | 'Economic'
  | 'Social'
  | 'Technological'
  | 'Environmental'
  | 'Legal';

export type ResearchStatus =
  | 'Draft'
  | 'Dalam Analisis'
  | 'Menunggu Masukan'
  | 'Revisi'
  | 'Disetujui'
  | 'Dipublikasikan';

export type PestelStatus = 'Draft AI' | 'Tervalidasi' | 'Dipublikasikan' | 'Arsip';

export type AnalysisPublishStatus = 'Draft' | 'Terverifikasi' | 'Disetujui' | 'Dipublikasikan';

export type FeedbackStatus = 'Baru' | 'Ditinjau' | 'Ditindaklanjuti' | 'Selesai';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

export type TnaClassification = 'TNA_KORPORAT' | 'TNA_UNIT';

export type DeliveryMethod =
  | 'In-Class Training'
  | 'Digital Learning'
  | 'Blended Learning'
  | 'Coaching & Mentoring'
  | 'Action Learning'
  | 'Workshop & Simulasi'
  | 'Intervensi Non-Pelatihan';

export interface OrganizationNode {
  id: string;
  name: string;
  slug: string;
  level: OrgLevel;
  parentId?: string;
  businessSegmentId: string;
  province?: string;
  description: string;
  scopeExamples?: string[];
  createdBy: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  businessSegmentId: string;
  departmentId: string;
  unitId?: string;
  orgScopeIds: string[];
  isActive: boolean;
  isUatSynthetic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchStudy {
  id: string;
  studyCode: string;
  title: string;
  year: number;
  businessSegmentId: string;
  departmentId: string;
  unitId?: string;
  background: string;
  problemStatement: string;
  objectives: string;
  strategicIssueSource: string;
  relatedPestelCategories: PestelCategory[];
  linkedPestelIds: string[];
  sourceUrls: string[];
  supportingEvidence: string;
  currentConditionAnalysis: string;
  orgNeedsAnalysis: string;
  competencyNeeds: string;
  lnaResult: string;
  ccaSummary: string;
  dnaSummary: string;
  tnaSummary: string;
  developmentRecommendation: string;
  status: ResearchStatus;
  priority: PriorityLevel;
  leadName: string;
  ownerUserId: string;
  isUatSynthetic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PestelIssue {
  id: string;
  title: string;
  summary: string;
  sourceUrl?: string;
  sourceTitle?: string;
  publisher?: string;
  sourcePublishedAt?: string;
  categories: PestelCategory[];
  riskOrOpportunity: 'risk' | 'opportunity' | 'both';
  severity: PriorityLevel;
  impactAnalysis: string;
  proposedSegmentIds: string[];
  proposedDepartmentIds: string[];
  linkedStudyIds: string[];
  evidenceQuotes: string[];
  businessSegmentId: string;
  departmentId: string;
  province: string;
  period: string;
  isAiDraft: boolean;
  status: PestelStatus;
  createdBy: string;
  verifiedBy?: string;
  isUatSynthetic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionItem {
  id: string;
  code: string;
  name: string;
  businessSegmentId: string;
  departmentId: string;
  grandDesignSummary: string;
  configStatus: 'uat_synthetic' | 'unconfigured' | 'official';
  createdAt: string;
}

export interface CompetencyItem {
  id: string;
  code: string;
  name: string;
  category: 'core' | 'technical' | 'behavioral';
  businessSegmentId: string;
  departmentId: string;
  professionId?: string;
  jobStandardRef: string;
  targetLevel: number;
  description: string;
  configStatus: 'uat_synthetic' | 'unconfigured' | 'official';
  createdAt: string;
}

export interface CcaAssessment {
  id: string;
  researchStudyId: string;
  competencyId?: string;
  businessSegmentId: string;
  departmentId: string;
  professionName: string;
  competencyType: 'core' | 'technical';
  competencyName: string;
  jobStandardRef: string;
  currentLevel: number;
  requiredLevel: number;
  gapNote: string;
  configStatus: 'uat_synthetic' | 'unconfigured' | 'official';
  status: AnalysisPublishStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DnaAssessment {
  id: string;
  researchStudyId: string;
  businessSegmentId: string;
  departmentId: string;
  futureCapabilityNeed: string;
  currentCondition: string;
  targetCondition: string;
  developmentGap: string;
  priority: PriorityLevel;
  supportingEvidence: string;
  recommendation: string;
  status: AnalysisPublishStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TnaAssessment {
  id: string;
  tnaClassification: TnaClassification;
  researchStudyId: string;
  dnaId?: string;
  competencyId?: string;
  businessSegmentId: string;
  departmentId: string;
  professionName: string;
  requiredCompetency: string;
  actualLevel: number;
  targetLevel: number;
  competencyGap: number;
  priority: PriorityLevel;
  participantCount: number;
  proposedTraining: string;
  hasValidGapEvidence: boolean;
  evidenceNote: string;
  verificationStatus: AnalysisPublishStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningPath {
  id: string;
  code: string;
  title: string;
  businessSegmentId: string;
  departmentId: string;
  professionId?: string;
  professionName: string;
  stages: string[];
  targetCompetencies: string[];
  description: string;
  status: AnalysisPublishStatus;
  createdAt: string;
}

export interface LearningRecommendation {
  id: string;
  programTitle: string;
  needSource: 'LNA' | 'CCA' | 'DNA' | 'TNA' | 'PESTEL';
  researchStudyId: string;
  tnaId?: string;
  learningPathId?: string;
  professionDesignRef?: string;
  targetCompetency: string;
  businessSegmentId: string;
  departmentId: string;
  targetAudience: string;
  priority: PriorityLevel;
  deliveryMethods: DeliveryMethod[];
  isNonTrainingIntervention: boolean;
  nonTrainingNote?: string;
  isAiSuggested: boolean;
  approvalStatus: 'Usulan AI' | 'Menunggu Persetujuan' | 'Disetujui' | 'Dipublikasikan' | 'Ditolak';
  followUpPlan: string;
  estimatedParticipants: number;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagementFeedback {
  id: string;
  researchStudyId: string;
  title: string;
  comment: string;
  improvementSuggestion: string;
  priority: PriorityLevel;
  submittedByUid: string;
  submittedByName: string;
  status: FeedbackStatus;
  adminResponse?: string;
  decisionReason?: string;
  respondedByUid?: string;
  respondedByName?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalHistoryEntry {
  id: string;
  entityType: 'research_study' | 'pestel_issue' | 'tna' | 'recommendation';
  entityId: string;
  fromStatus: string;
  toStatus: string;
  actorUid: string;
  actorName: string;
  note: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  departmentId?: string;
  details: string;
  createdAt: string;
}

export interface SystemConfigStatus {
  appEnv: string;
  needsBootstrap: boolean;
  recoveryConfigured?: boolean;
  uatQuickLoginEnabled?: boolean;
  uatRequiresPasscode?: boolean;
  uatQcAuthorized?: boolean;
  geminiConfigured: boolean;
  geminiModel: string;
  firestoreConfigured: boolean;
  firestoreDatabaseId: string;
  storageEngine: string;
  sessionSecretConfigured: boolean;
  csrfEnabled: boolean;
  rateLimitEnabled: boolean;
}
