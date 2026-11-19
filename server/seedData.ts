import crypto from 'node:crypto';
import type {
  ApprovalHistoryEntry,
  AuditLog,
  CcaAssessment,
  CompetencyItem,
  DnaAssessment,
  LearningPath,
  LearningRecommendation,
  ManagementFeedback,
  OrganizationNode,
  PestelIssue,
  ProfessionItem,
  ResearchStudy,
  TnaAssessment,
  UserProfile,
} from '../src/shared/types.ts';

export interface StoredUserRecord extends UserProfile {
  passwordHash: string;
  passwordSalt: string;
  tokensValidAfter?: number;
}

export interface UserSessionRecord {
  sessionId: string;
  userUid: string;
  expiresAt: number;
  revoked: boolean;
  createdAt: string;
}

export interface RevokedSessionRecord {
  sessionId: string;
  expiresAt: number;
}

export interface DatabaseState {
  sessionSigningKey?: string;
  lastAdminResetDigest?: string;
  revokedSessions?: RevokedSessionRecord[];
  organizations: OrganizationNode[];
  users: StoredUserRecord[];
  sessions: UserSessionRecord[];
  researchStudies: ResearchStudy[];
  pestelIssues: PestelIssue[];
  professions: ProfessionItem[];
  competencies: CompetencyItem[];
  ccaAssessments: CcaAssessment[];
  dnaAssessments: DnaAssessment[];
  tnaAssessments: TnaAssessment[];
  learningPaths: LearningPath[];
  recommendations: LearningRecommendation[];
  managementFeedback: ManagementFeedback[];
  approvalHistory: ApprovalHistoryEntry[];
  auditLogs: AuditLog[];
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!hash || !salt) return false;
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function createInitialSeedState(): DatabaseState {
  const now = '2026-11-18T08:00:00.000Z';

  const organizations: OrganizationNode[] = [
    // 7 Initial PLN Business Segments
    {
      id: 'seg-energi-primer',
      name: 'Energi Primer',
      slug: 'energi-primer',
      level: 'segment',
      businessSegmentId: 'seg-energi-primer',
      province: 'Nasional',
      description: 'Ketersediaan energi primer, pasokan bahan bakar, logistik energi, biomassa, transisi energi, dan keamanan rantai pasok.',
      scopeExamples: ['Ketersediaan energi primer', 'Pasokan bahan bakar', 'Logistik energi', 'Biomassa', 'Transisi energi', 'Keamanan rantai pasok'],
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'seg-pembangkitan',
      name: 'Pembangkitan',
      slug: 'pembangkitan',
      level: 'segment',
      businessSegmentId: 'seg-pembangkitan',
      province: 'Nasional',
      description: 'Operasional pembangkit, keandalan pembangkit, efisiensi, energi baru terbarukan, teknologi pembangkit, dan pemeliharaan aset.',
      scopeExamples: ['Operasional pembangkit', 'Keandalan pembangkit', 'Efisiensi pembangkitan', 'Energi baru terbarukan', 'Teknologi pembangkit', 'Pemeliharaan aset'],
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'seg-transmisi',
      name: 'Transmisi dan Penyaluran',
      slug: 'transmisi',
      level: 'segment',
      businessSegmentId: 'seg-transmisi',
      province: 'Nasional',
      description: 'Sistem transmisi, gardu induk, keandalan jaringan, perencanaan sistem, Smart Grid, dan teknologi jaringan listrik.',
      scopeExamples: ['Sistem transmisi', 'Gardu induk', 'Keandalan jaringan', 'Perencanaan sistem', 'Smart Grid', 'Teknologi jaringan listrik'],
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'seg-distribusi',
      name: 'Distribusi',
      slug: 'distribusi',
      level: 'segment',
      businessSegmentId: 'seg-distribusi',
      province: 'Nasional',
      description: 'Jaringan distribusi, keandalan pasokan, gangguan dan pemeliharaan, digitalisasi distribusi, dan efisiensi operasional.',
      scopeExamples: ['Jaringan distribusi', 'Keandalan pasokan', 'Gangguan dan pemeliharaan', 'Digitalisasi distribusi', 'Efisiensi operasional', 'Pengembangan jaringan'],
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'seg-retail-niaga',
      name: 'Retail dan Niaga',
      slug: 'retail-niaga',
      level: 'segment',
      businessSegmentId: 'seg-retail-niaga',
      province: 'Nasional',
      description: 'Pelayanan pelanggan, penjualan listrik, pengalaman pelanggan, transformasi layanan digital, dan pengembangan bisnis retail.',
      scopeExamples: ['Pelayanan pelanggan', 'Penjualan listrik', 'Pengalaman pelanggan', 'Transformasi layanan digital', 'Layanan energi', 'Pengembangan bisnis retail'],
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'seg-penunjang-ketenagalistrikan',
      name: 'Penunjang Ketenagalistrikan',
      slug: 'penunjang-ketenagalistrikan',
      level: 'segment',
      businessSegmentId: 'seg-penunjang-ketenagalistrikan',
      province: 'Nasional',
      description: 'Engineering, konstruksi dan pembangunan, penelitian dan pengembangan, teknologi informasi, sertifikasi, dan pendidikan/pelatihan.',
      scopeExamples: ['Engineering', 'Konstruksi dan pembangunan', 'Penelitian dan pengembangan', 'Teknologi informasi', 'Sertifikasi', 'Pendidikan dan pelatihan'],
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'seg-penunjang-korporat',
      name: 'Penunjang Korporat',
      slug: 'penunjang-korporat',
      level: 'segment',
      businessSegmentId: 'seg-penunjang-korporat',
      province: 'DKI Jakarta',
      description: 'Human Capital, Keuangan, Pengadaan, Legal, Manajemen Risiko, Administrasi, dan PLN Corporate University.',
      scopeExamples: ['Human Capital', 'Keuangan', 'Pengadaan', 'Legal', 'Manajemen risiko', 'Administrasi', 'Corporate University'],
      createdBy: 'system',
      createdAt: now,
    },

    // Configurable Department & Unit Structure
    {
      id: 'dept-ep-biomassa',
      name: 'Departemen Rantai Pasok Biomassa & Energi Primer',
      slug: 'energi-primer-biomassa',
      level: 'department',
      parentId: 'seg-energi-primer',
      businessSegmentId: 'seg-energi-primer',
      province: 'Kalimantan Timur',
      description: 'Pengelolaan kontrak, logistik, dan penjaminan mutu bahan bakar serta biomassa co-firing.',
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'dept-pembangkitan-ops',
      name: 'Departemen Operasional & Pemeliharaan Pembangkit',
      slug: 'pembangkitan-operasional',
      level: 'department',
      parentId: 'seg-pembangkitan',
      businessSegmentId: 'seg-pembangkitan',
      province: 'Jawa Tengah',
      description: 'Optimasi keandalan pembangkit, efisiensi termal, dan integrasi pembangkit EBT.',
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'unit-up-jateng',
      name: 'Unit Pembangkitan Jawa Tengah',
      slug: 'up-jawa-tengah',
      level: 'unit',
      parentId: 'dept-pembangkitan-ops',
      businessSegmentId: 'seg-pembangkitan',
      province: 'Jawa Tengah',
      description: 'Unit kerja pelaksana operasi dan pemeliharaan pembangkit.',
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'dept-transmisi-grid',
      name: 'Departemen Sistem Transmisi & Smart Grid',
      slug: 'transmisi-smart-grid',
      level: 'department',
      parentId: 'seg-transmisi',
      businessSegmentId: 'seg-transmisi',
      province: 'Jawa Barat',
      description: 'Perencanaan sistem penyaluran, gardu induk digital, proteksi IEC 61850, dan stabilitas grid.',
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'dept-distribusi-digital',
      name: 'Departemen Digitalisasi Distribusi & AMI',
      slug: 'distribusi-digital-ami',
      level: 'department',
      parentId: 'seg-distribusi',
      businessSegmentId: 'seg-distribusi',
      province: 'Jawa Timur',
      description: 'Operasi jaringan distribusi pintar, penurunan susut jaringan, dan implementasi AMI.',
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'dept-retail-digital',
      name: 'Departemen Transformasi Layanan Digital & EV',
      slug: 'retail-layanan-digital-ev',
      level: 'department',
      parentId: 'seg-retail-niaga',
      businessSegmentId: 'seg-retail-niaga',
      province: 'DKI Jakarta',
      description: 'Layanan pelanggan digital, pengembangan SPKLU, dan produk energi terbarukan.',
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'dept-ti-ot',
      name: 'Departemen Teknologi Informasi & Keamanan Siber OT',
      slug: 'teknologi-informasi-siber',
      level: 'department',
      parentId: 'seg-penunjang-ketenagalistrikan',
      businessSegmentId: 'seg-penunjang-ketenagalistrikan',
      province: 'DKI Jakarta',
      description: 'Arsitektur TI korporat, integrasi data sistem ketenagalistrikan, dan ketahanan siber OT.',
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'dept-corpu-lvc',
      name: 'Departemen Learning Value Chain & Curriculum',
      slug: 'corpu-learning-value-chain',
      level: 'department',
      parentId: 'seg-penunjang-korporat',
      businessSegmentId: 'seg-penunjang-korporat',
      province: 'Jawa Barat',
      description: 'Pusat pengolahan LNA, CCA, DNA, TNA, Grand Design Profesi, dan Learning Path PLN CorpU.',
      createdBy: 'system',
      createdAt: now,
    },
  ];

  // Bootstrap users strictly from server environment variables when configured (never hardcoded passwords)
  const users: StoredUserRecord[] = [];
  const bootstrapEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin.corpu@pln.co.id').trim().toLowerCase();
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  if (bootstrapEmail && bootstrapPassword && bootstrapPassword.length >= 8) {
    const { hash, salt } = hashPassword(bootstrapPassword);
    users.push({
      uid: `usr-${crypto.randomUUID()}`,
      email: bootstrapEmail,
      passwordHash: hash,
      passwordSalt: salt,
      displayName: 'Super Admin PLN CORPU',
      role: 'SUPER_ADMIN',
      businessSegmentId: 'seg-penunjang-korporat',
      departmentId: 'dept-corpu-lvc',
      orgScopeIds: ['ALL_CORPORATE'],
      isActive: true,
      isUatSynthetic: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  const uatConfigs: Array<{
    emailEnv: string;
    passEnv: string;
    role: 'SUPER_ADMIN' | 'MANAGEMENT' | 'USER';
    name: string;
    seg: string;
    dept: string;
    scopes: string[];
  }> = [
    {
      emailEnv: 'UAT_SUPER_ADMIN_EMAIL',
      passEnv: 'UAT_SUPER_ADMIN_PASSWORD',
      role: 'SUPER_ADMIN',
      name: 'UAT Super Admin',
      seg: 'seg-penunjang-korporat',
      dept: 'dept-corpu-lvc',
      scopes: ['ALL_CORPORATE'],
    },
    {
      emailEnv: 'UAT_MANAGEMENT_EMAIL',
      passEnv: 'UAT_MANAGEMENT_PASSWORD',
      role: 'MANAGEMENT',
      name: 'UAT Management Transmisi',
      seg: 'seg-transmisi',
      dept: 'dept-transmisi-grid',
      scopes: ['dept-transmisi-grid'],
    },
    {
      emailEnv: 'UAT_USER_EMAIL',
      passEnv: 'UAT_USER_PASSWORD',
      role: 'USER',
      name: 'UAT User Transmisi',
      seg: 'seg-transmisi',
      dept: 'dept-transmisi-grid',
      scopes: ['dept-transmisi-grid'],
    },
  ];

  for (const cfg of uatConfigs) {
    const email = process.env[cfg.emailEnv]?.trim().toLowerCase();
    const pass = process.env[cfg.passEnv]?.trim();
    if (email && pass && !users.some((u) => u.email === email)) {
      const { hash, salt } = hashPassword(pass);
      users.push({
        uid: `usr-${crypto.randomUUID()}`,
        email,
        passwordHash: hash,
        passwordSalt: salt,
        displayName: cfg.name,
        role: cfg.role,
        businessSegmentId: cfg.seg,
        departmentId: cfg.dept,
        orgScopeIds: cfg.scopes,
        isActive: true,
        isUatSynthetic: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const professions: ProfessionItem[] = [
    {
      id: 'prof-substation-eng',
      code: 'PROF-TR-01',
      name: 'Substation Protection & Digital Grid Engineer (UAT Sintetis)',
      businessSegmentId: 'seg-transmisi',
      departmentId: 'dept-transmisi-grid',
      grandDesignSummary: 'Grand Design Profesi Enjiniring Gardu Induk Digital & Sistem Proteksi Transmisi (Data UAT Sintetis).',
      configStatus: 'uat_synthetic',
      createdAt: now,
    },
    {
      id: 'prof-boiler-ops',
      code: 'PROF-PB-01',
      name: 'Thermal Boiler & Co-Firing Specialist (UAT Sintetis)',
      businessSegmentId: 'seg-pembangkitan',
      departmentId: 'dept-pembangkitan-ops',
      grandDesignSummary: 'Grand Design Profesi Operasi Pembangkit & Transisi Co-Firing Biomassa (Data UAT Sintetis).',
      configStatus: 'uat_synthetic',
      createdAt: now,
    },
    {
      id: 'prof-dist-unconfigured',
      code: 'PROF-DS-01',
      name: 'Profesi Distribusi & AMI — Belum Dikonfigurasi Resmi',
      businessSegmentId: 'seg-distribusi',
      departmentId: 'dept-distribusi-digital',
      grandDesignSummary: 'Belum Dikonfigurasi — menunggu pemetaan resmi Direktori Kompetensi PLN.',
      configStatus: 'unconfigured',
      createdAt: now,
    },
  ];

  const competencies: CompetencyItem[] = [
    {
      id: 'comp-iec61850',
      code: 'TECH-TR-61850',
      name: 'Digital Substation Protection & IEC 61850 Architecture',
      category: 'technical',
      businessSegmentId: 'seg-transmisi',
      departmentId: 'dept-transmisi-grid',
      professionId: 'prof-substation-eng',
      jobStandardRef: 'SKJ-UAT-TR-01 (Sintetis)',
      targetLevel: 4,
      description: 'Rekayasa proteksi diferensial, konfigurasi SCL, dan komunikasi GOOSE/SV gardu induk digital.',
      configStatus: 'uat_synthetic',
      createdAt: now,
    },
    {
      id: 'comp-cofiring',
      code: 'TECH-PB-COF',
      name: 'Biomass Co-Firing Combustion & Slagging Mitigation',
      category: 'technical',
      businessSegmentId: 'seg-pembangkitan',
      departmentId: 'dept-pembangkitan-ops',
      professionId: 'prof-boiler-ops',
      jobStandardRef: 'SKJ-UAT-PB-02 (Sintetis)',
      targetLevel: 4,
      description: 'Pengendalian rasio pembakaran biomassa dan pemantauan efisiensi termal boiler.',
      configStatus: 'uat_synthetic',
      createdAt: now,
    },
    {
      id: 'comp-core-risk',
      code: 'CORE-PLN-01',
      name: 'Strategic Grid Resilience & Energy Transition Governance',
      category: 'core',
      businessSegmentId: 'seg-penunjang-korporat',
      departmentId: 'dept-corpu-lvc',
      jobStandardRef: 'SKJ-CORE-UAT (Sintetis)',
      targetLevel: 4,
      description: 'Kompetensi inti tata kelola risiko operasional dan eksekusi transisi energi bersih.',
      configStatus: 'uat_synthetic',
      createdAt: now,
    },
    {
      id: 'comp-dist-unconf',
      code: 'TECH-DS-UNCONF',
      name: 'Standar Kompetensi Operasi AMI (Belum Dikonfigurasi)',
      category: 'technical',
      businessSegmentId: 'seg-distribusi',
      departmentId: 'dept-distribusi-digital',
      professionId: 'prof-dist-unconfigured',
      jobStandardRef: 'Belum Dikonfigurasi',
      targetLevel: 3,
      description: 'Menunggu penetapan standar kompetensi jabatan resmi oleh pengelola SDM/CorpU.',
      configStatus: 'unconfigured',
      createdAt: now,
    },
  ];

  const pestelIssues: PestelIssue[] = [
    {
      id: 'pestel-smartgrid-2026',
      title: 'Akselerasi Smart Grid & Gardu Induk Digital untuk Integrasi EBT Intermiten',
      summary:
        'Peningkatan porsi pembangkit EBT variabel menuntut digitalisasi gardu induk berbasis IEC 61850, proteksi adaptif, dan pemantauan telemetri real-time.',
      sourceUrl: 'https://web.pln.co.id/media/siaran-pers',
      sourceTitle: 'Pengembangan Smart Grid dan Digitalisasi Transmisi Nasional',
      publisher: 'Portal Siaran Pers PLN',
      sourcePublishedAt: '2026-10-14',
      categories: ['Technological', 'Environmental'],
      riskOrOpportunity: 'both',
      severity: 'critical',
      impactAnalysis:
        'Menuntut peningkatan kesiapan enjinir transmisi pada sistem proteksi digital dan koordinasi keamanan siber OT.',
      proposedSegmentIds: ['seg-transmisi', 'seg-distribusi', 'seg-penunjang-ketenagalistrikan'],
      proposedDepartmentIds: ['dept-transmisi-grid', 'dept-distribusi-digital', 'dept-ti-ot'],
      linkedStudyIds: ['lna-study-transmisi-2026'],
      evidenceQuotes: ['Integrasi pembangkit EBT intermiten memerlukan respons proteksi dan kendali frekuensi otomatis.'],
      businessSegmentId: 'seg-transmisi',
      departmentId: 'dept-transmisi-grid',
      province: 'Jawa Barat',
      period: '2026-Q4',
      isAiDraft: false,
      status: 'Dipublikasikan',
      createdBy: 'system',
      verifiedBy: 'system',
      createdAt: '2026-10-15T09:00:00.000Z',
      updatedAt: '2026-10-20T10:00:00.000Z',
    },
    {
      id: 'pestel-cofiring-2026',
      title: 'Mandat Peningkatan Bauran Co-Firing Biomassa pada Pembangkit',
      summary:
        'Kewajiban penurunan intensitas emisi PLTU mendorong peningkatan rasio co-firing biomassa beserta kesiapan rantai pasok bahan bakar.',
      sourceUrl: 'https://www.esdm.go.id/id/media-center/arsip-berita',
      sourceTitle: 'Kebijakan Co-Firing Biomassa Menuju Target Net Zero',
      publisher: 'Kementerian ESDM RI',
      sourcePublishedAt: '2026-10-22',
      categories: ['Environmental', 'Political', 'Economic'],
      riskOrOpportunity: 'both',
      severity: 'high',
      impactAnalysis:
        'Unit pembangkitan memerlukan kalibrasi operasi boiler terhadap variasi kadar air biomassa, sementara Energi Primer menjaga kontinuitas pasokan.',
      proposedSegmentIds: ['seg-pembangkitan', 'seg-energi-primer'],
      proposedDepartmentIds: ['dept-pembangkitan-ops', 'dept-ep-biomassa'],
      linkedStudyIds: ['lna-study-pembangkitan-2026'],
      evidenceQuotes: ['Stabilitas kualitas pelet biomassa berpengaruh langsung terhadap efisiensi pembakaran PLTU.'],
      businessSegmentId: 'seg-pembangkitan',
      departmentId: 'dept-pembangkitan-ops',
      province: 'Jawa Tengah',
      period: '2026-Q4',
      isAiDraft: false,
      status: 'Dipublikasikan',
      createdBy: 'system',
      verifiedBy: 'system',
      createdAt: '2026-10-24T10:00:00.000Z',
      updatedAt: '2026-10-28T11:30:00.000Z',
    },
    {
      id: 'pestel-tkdn-draft',
      title: 'Pembaruan Kebijakan TKDN Infrastruktur Ketenagalistrikan EBT',
      summary:
        'Penyesuaian regulasi Tingkat Komponen Dalam Negeri berdampak pada penyusunan dokumen pengadaan proyek gardu induk dan pembangkit EBT.',
      sourceUrl: 'https://jdih.esdm.go.id',
      sourceTitle: 'Regulasi TKDN Infrastruktur Ketenagalistrikan',
      publisher: 'JDIH ESDM',
      sourcePublishedAt: '2026-11-05',
      categories: ['Legal', 'Political'],
      riskOrOpportunity: 'risk',
      severity: 'medium',
      impactAnalysis:
        'Perlu penyelarasan kompetensi evaluasi teknis vendor dan kepatuhan regulasi kontrak pengadaan.',
      proposedSegmentIds: ['seg-penunjang-korporat'],
      proposedDepartmentIds: ['dept-corpu-lvc'],
      linkedStudyIds: ['lna-study-korporat-2026'],
      evidenceQuotes: ['Evaluasi kepatuhan TKDN menjadi prasyarat utama persetujuan proyek EBT baru.'],
      businessSegmentId: 'seg-penunjang-korporat',
      departmentId: 'dept-corpu-lvc',
      province: 'DKI Jakarta',
      period: '2026-Q4',
      isAiDraft: true,
      status: 'Tervalidasi',
      createdBy: 'system',
      createdAt: '2026-11-07T09:00:00.000Z',
      updatedAt: '2026-11-08T09:00:00.000Z',
    },
  ];

  const researchStudies: ResearchStudy[] = [
    {
      id: 'lna-study-transmisi-2026',
      studyCode: 'LNA-TR-2026-001',
      title: 'Penelitian Kebutuhan Pembelajaran Operasi & Proteksi Gardu Induk Digital (Smart Grid)',
      year: 2026,
      businessSegmentId: 'seg-transmisi',
      departmentId: 'dept-transmisi-grid',
      background:
        'Transformasi gardu induk konvensional menuju gardu induk digital berbasis IEC 61850 membutuhkan penguatan kapabilitas enjinir proteksi dan otomasi transmisi.',
      problemStatement:
        'Bagaimana kesenjangan kompetensi operasional sistem proteksi digital dan integrasi telemetri pada unit penyaluran menghadapi penetrasi EBT intermiten?',
      objectives:
        'Mengidentifikasi kebutuhan pembelajaran berbasis bukti (LNA-CCA-DNA-TNA) serta merumuskan TNA Unit dan TNA Korporat untuk kesiapan Smart Grid.',
      strategicIssueSource: 'PESTEL Teknologi & Lingkungan — Akselerasi Smart Grid',
      relatedPestelCategories: ['Technological', 'Environmental'],
      linkedPestelIds: ['pestel-smartgrid-2026'],
      sourceUrls: ['https://web.pln.co.id/media/siaran-pers'],
      supportingEvidence:
        'Data asesmen kompetensi internal unit transmisi menunjukkan rata-rata penguasaan konfigurasi SCL dan GOOSE berada di level 2 dari target level 4.',
      currentConditionAnalysis:
        'Mayoritas enjinir proteksi masih terbiasa dengan relay konvensional hardwired dan memerlukan transisi ke arsitektur digital IEC 61850.',
      orgNeedsAnalysis:
        'Departemen Sistem Transmisi & Smart Grid membutuhkan kesiapan tim commissioning dan pemeliharaan gardu induk digital di regional Jawa-Bali.',
      competencyNeeds: 'Digital Substation Protection, IEC 61850 Configuration, Grid Telemetry & OT Resilience.',
      lnaResult:
        'Ditetapkan prioritas kritis penguatan kompetensi proteksi digital yang dilanjutkan ke pemetaan CCA dan perumusan TNA Unit.',
      ccaSummary: 'Kesenjangan kompetensi teknis IEC 61850 sebesar 2 level terhadap standar profesi enjinir gardu induk.',
      dnaSummary: 'Pengembangan kapabilitas diagnostik jaringan digital dan kolaborasi lintas unit TI/OT.',
      tnaSummary: '90 peserta pada program TNA Unit Proteksi & Otomasi Gardu Induk Digital.',
      developmentRecommendation:
        'Penyelenggaraan Akademi Proteksi & Otomasi Gardu Induk Digital (Blended Learning + Simulasi Simulator Gardu Induk).',
      status: 'Dipublikasikan',
      priority: 'critical',
      leadName: 'Tim Analis LNA Transmisi & CorpU',
      ownerUserId: 'system',
      createdAt: '2026-10-16T08:00:00.000Z',
      updatedAt: '2026-11-01T14:00:00.000Z',
    },
    {
      id: 'lna-study-pembangkitan-2026',
      studyCode: 'LNA-PB-2026-002',
      title: 'Penelitian Kebutuhan Kapabilitas Operasi Boiler Co-Firing Biomassa PLTU',
      year: 2026,
      businessSegmentId: 'seg-pembangkitan',
      departmentId: 'dept-pembangkitan-ops',
      unitId: 'unit-up-jateng',
      background:
        'Penerapan mandat co-firing biomassa menuntut penyesuaian prosedur operasi pembakaran dan penanganan material bahan bakar di pembangkit.',
      problemStatement:
        'Apa kebutuhan pengembangan organisasi dan pelatihan teknis untuk menjaga keandalan boiler saat rasio co-firing meningkat?',
      objectives:
        'Menilai kondisi aktual operasi unit pembangkitan dan menyusun intervensi pembelajaran serta panduan kerja terstandar.',
      strategicIssueSource: 'PESTEL Lingkungan & Politik — Mandat Co-Firing Biomassa',
      relatedPestelCategories: ['Environmental', 'Political', 'Economic'],
      linkedPestelIds: ['pestel-cofiring-2026'],
      sourceUrls: ['https://www.esdm.go.id/id/media-center/arsip-berita'],
      supportingEvidence:
        'Log inspeksi boiler semester berjalan mencatat variasi kadar kalor biomassa memerlukan kalibrasi parameter udara pembakaran.',
      currentConditionAnalysis:
        'Operator senior menguasai operasi batubara murni (level 3), namun pengalaman penanganan slagging biomassa bervariasi antar-shift.',
      orgNeedsAnalysis:
        'Diperlukan standardisasi operasi co-firing serta sinkronisasi inspeksi kualitas pasokan bersama Departemen Energi Primer.',
      competencyNeeds: 'Biomass Co-Firing Combustion Control, Boiler Efficiency Monitoring.',
      lnaResult:
        'Kombinasi kebutuhan pelatihan teknis unit dan penyelarasan SOP penerimaan biomassa.',
      ccaSummary: 'Gap kompetensi teknis operasi co-firing 1 level pada operator boiler shift.',
      dnaSummary: 'Kapabilitas analitik efisiensi termal dan koordinasi kualitas rantai pasok biomassa.',
      tnaSummary: '60 operator & supervisor unit dalam program TNA Unit Co-Firing.',
      developmentRecommendation: 'Workshop & Simulasi Pengendalian Pembakaran Co-Firing Biomassa.',
      status: 'Menunggu Masukan',
      priority: 'high',
      leadName: 'Tim Analis LNA Pembangkitan',
      ownerUserId: 'system',
      createdAt: '2026-10-25T09:00:00.000Z',
      updatedAt: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 'lna-study-korporat-2026',
      studyCode: 'LNA-KP-2026-003',
      title: 'Kajian Kebutuhan Tata Kelola Kontrak EBT & Kepatuhan Regulasi TKDN (TNA Korporat)',
      year: 2026,
      businessSegmentId: 'seg-penunjang-korporat',
      departmentId: 'dept-corpu-lvc',
      background:
        'Perubahan regulasi TKDN proyek EBT memengaruhi proses evaluasi pengadaan dan manajemen risiko proyek strategis di tingkat korporat.',
      problemStatement:
        'Apakah diperlukan program pelatihan korporat atau penyelarasan pedoman pengadaan untuk merespons ketentuan TKDN terbaru?',
      objectives:
        'Menyusun TNA Korporat lintas fungsi pengadaan, legal, dan proyek EBT berbasis analisis kondisi aktual.',
      strategicIssueSource: 'PESTEL Legal & Politik — Kebijakan TKDN',
      relatedPestelCategories: ['Legal', 'Political'],
      linkedPestelIds: ['pestel-tkdn-draft'],
      sourceUrls: ['https://jdih.esdm.go.id'],
      supportingEvidence:
        'Review internal atas dokumen tender EBT menunjukkan perlunya standar verifikasi komponen lokal yang seragam.',
      currentConditionAnalysis:
        'Tim evaluasi memahami regulasi dasar TKDN, tetapi membutuhkan pembaruan metode audit sertifikasi TKDN proyek EBT.',
      orgNeedsAnalysis:
        'Kebutuhan penyelarasan kapabilitas pengadaan strategis pada tingkat korporat.',
      competencyNeeds: 'Evaluasi Kepatuhan TKDN & Manajemen Kontrak Proyek EBT.',
      lnaResult: 'Direkomendasikan pembentukan program TNA Korporat bersama intervensi pembaruan pedoman kerja.',
      ccaSummary: 'Dalam tahap pemetaan.',
      dnaSummary: 'Dalam analisis.',
      tnaSummary: 'Usulan TNA Korporat untuk 120 pegawai lintas unit.',
      developmentRecommendation: 'Program TNA Korporat Tata Kelola Kontrak & TKDN Proyek EBT.',
      status: 'Dalam Analisis',
      priority: 'medium',
      leadName: 'Tim Learning Value Chain CorpU',
      ownerUserId: 'system',
      createdAt: '2026-11-08T09:00:00.000Z',
      updatedAt: '2026-11-12T11:00:00.000Z',
    },
  ];

  const ccaAssessments: CcaAssessment[] = [
    {
      id: 'cca-transmisi-01',
      researchStudyId: 'lna-study-transmisi-2026',
      competencyId: 'comp-iec61850',
      businessSegmentId: 'seg-transmisi',
      departmentId: 'dept-transmisi-grid',
      professionName: 'Substation Protection & Digital Grid Engineer (UAT Sintetis)',
      competencyType: 'technical',
      competencyName: 'Digital Substation Protection & IEC 61850 Architecture',
      jobStandardRef: 'SKJ-UAT-TR-01 (Sintetis)',
      currentLevel: 2,
      requiredLevel: 4,
      gapNote: 'Kesenjangan 2 level pada konfigurasi proteksi digital dan pengujian GOOSE/Sampled Values.',
      configStatus: 'uat_synthetic',
      status: 'Dipublikasikan',
      createdBy: 'system',
      createdAt: '2026-10-18T08:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
    {
      id: 'cca-pembangkitan-01',
      researchStudyId: 'lna-study-pembangkitan-2026',
      competencyId: 'comp-cofiring',
      businessSegmentId: 'seg-pembangkitan',
      departmentId: 'dept-pembangkitan-ops',
      professionName: 'Thermal Boiler & Co-Firing Specialist (UAT Sintetis)',
      competencyType: 'technical',
      competencyName: 'Biomass Co-Firing Combustion & Slagging Mitigation',
      jobStandardRef: 'SKJ-UAT-PB-02 (Sintetis)',
      currentLevel: 3,
      requiredLevel: 4,
      gapNote: 'Perlu penguatan analisis slagging/fouling saat variasi kadar kalor biomassa.',
      configStatus: 'uat_synthetic',
      status: 'Disetujui',
      createdBy: 'system',
      createdAt: '2026-10-26T09:00:00.000Z',
      updatedAt: '2026-11-05T09:00:00.000Z',
    },
  ];

  const dnaAssessments: DnaAssessment[] = [
    {
      id: 'dna-transmisi-01',
      researchStudyId: 'lna-study-transmisi-2026',
      businessSegmentId: 'seg-transmisi',
      departmentId: 'dept-transmisi-grid',
      futureCapabilityNeed: 'Kapabilitas Operasi & Keamanan Telemetri Gardu Induk Digital Terintegrasi',
      currentCondition:
        'Tim operasi saat ini menggunakan prosedur pemeliharaan relay konvensional dan belum memiliki alur diagnostik jaringan IEC 61850 terpadu.',
      targetCondition:
        'Seluruh tim operasi transmisi mampu melakukan komisioning, diagnostik paket GOOSE, dan mitigasi anomali sistem otomasi gardu induk digital.',
      developmentGap:
        'Kesenjangan penguasaan protokol komunikasi gardu induk digital dan kolaborasi insiden TI/OT.',
      priority: 'critical',
      supportingEvidence: 'Hasil audit kesiapan gardu induk digital 2026 dan evaluasi simulasi proteksi regional.',
      recommendation: 'Penyelenggaraan pelatihan berbasis simulator gardu induk digital dan program mentoring lapangan.',
      status: 'Dipublikasikan',
      createdBy: 'system',
      createdAt: '2026-10-19T10:00:00.000Z',
      updatedAt: '2026-11-01T12:00:00.000Z',
    },
    {
      id: 'dna-pembangkitan-01',
      researchStudyId: 'lna-study-pembangkitan-2026',
      businessSegmentId: 'seg-pembangkitan',
      departmentId: 'dept-pembangkitan-ops',
      futureCapabilityNeed: 'Optimalisasi Efisiensi Termal Boiler pada Bauran Co-Firing Tinggi',
      currentCondition:
        'Pengaturan pembakaran antar-shift masih bergantung pada pengalaman individual operator tanpa panduan parameter kalibrasi biomassa terpadu.',
      targetCondition:
        'Seluruh regu operasi menerapkan standar tuning pembakaran co-firing berbasis data real-time heat rate dan kualitas biomassa.',
      developmentGap: 'Gap standardisasi kalibrasi rasio udara-bahan bakar untuk biomassa campuran.',
      priority: 'high',
      supportingEvidence: 'Laporan operasi triwulan unit pembangkitan Jawa Tengah.',
      recommendation: 'Kombinasi penyusunan SOP kalibrasi (intervensi non-pelatihan) dan simulasi operasi boiler.',
      status: 'Terverifikasi',
      createdBy: 'system',
      createdAt: '2026-10-27T10:00:00.000Z',
      updatedAt: '2026-11-06T10:00:00.000Z',
    },
  ];

  const tnaAssessments: TnaAssessment[] = [
    {
      id: 'tna-unit-transmisi-01',
      tnaClassification: 'TNA_UNIT',
      researchStudyId: 'lna-study-transmisi-2026',
      dnaId: 'dna-transmisi-01',
      competencyId: 'comp-iec61850',
      businessSegmentId: 'seg-transmisi',
      departmentId: 'dept-transmisi-grid',
      professionName: 'Substation Protection & Digital Grid Engineer',
      requiredCompetency: 'Digital Substation Protection & IEC 61850 Architecture',
      actualLevel: 2,
      targetLevel: 4,
      competencyGap: 2,
      priority: 'critical',
      participantCount: 90,
      proposedTraining: 'Akademi Proteksi & Otomasi Gardu Induk Digital (IEC 61850)',
      hasValidGapEvidence: true,
      evidenceNote: 'Terverifikasi dari asesmen kompetensi proteksi dan gap DNA gardu induk digital.',
      verificationStatus: 'Dipublikasikan',
      createdBy: 'system',
      createdAt: '2026-10-21T08:00:00.000Z',
      updatedAt: '2026-11-01T14:00:00.000Z',
    },
    {
      id: 'tna-korporat-01',
      tnaClassification: 'TNA_KORPORAT',
      researchStudyId: 'lna-study-korporat-2026',
      competencyId: 'comp-core-risk',
      businessSegmentId: 'seg-penunjang-korporat',
      departmentId: 'dept-corpu-lvc',
      professionName: 'Manajer & Analis Strategis Lintas Direktorat',
      requiredCompetency: 'Strategic Grid Resilience & Energy Transition Governance',
      actualLevel: 3,
      targetLevel: 4,
      competencyGap: 1,
      priority: 'high',
      participantCount: 150,
      proposedTraining: 'Program Kepemimpinan & Tata Kelola Transisi Energi Korporat',
      hasValidGapEvidence: true,
      evidenceNote: 'Kebutuhan penyelarasan tata kelola transisi energi dan kepatuhan regulasi lintas unit.',
      verificationStatus: 'Disetujui',
      createdBy: 'system',
      createdAt: '2026-11-09T09:00:00.000Z',
      updatedAt: '2026-11-12T12:00:00.000Z',
    },
  ];

  const learningPaths: LearningPath[] = [
    {
      id: 'lp-transmisi-smartgrid',
      code: 'LP-TR-SG-2026',
      title: 'Learning Path Enjinir Gardu Induk Digital & Smart Grid',
      businessSegmentId: 'seg-transmisi',
      departmentId: 'dept-transmisi-grid',
      professionId: 'prof-substation-eng',
      professionName: 'Substation Protection & Digital Grid Engineer',
      stages: [
        '1. Fondasi Arsitektur IEC 61850 (Digital Learning)',
        '2. Konfigurasi & Pengujian Proteksi GOOSE/SV (Workshop & Simulasi)',
        '3. Ketahanan Siber & Integrasi SCADA (Blended Learning)',
        '4. Proyek Komisioning Lapangan & Sertifikasi Kompetensi (Action Learning)',
      ],
      targetCompetencies: ['Digital Substation Protection & IEC 61850 Architecture'],
      description: 'Jalur pembelajaran berjenjang sesuai Grand Design Profesi Enjinir Gardu Induk Digital.',
      status: 'Dipublikasikan',
      createdAt: '2026-10-22T09:00:00.000Z',
    },
    {
      id: 'lp-korporat-transition',
      code: 'LP-KP-ET-2026',
      title: 'Learning Path Tata Kelola Transisi Energi & Kepatuhan Proyek EBT',
      businessSegmentId: 'seg-penunjang-korporat',
      departmentId: 'dept-corpu-lvc',
      professionName: 'Analis & Pemimpin Proyek Transisi Energi',
      stages: [
        '1. Regulasi Energi & TKDN Nasional (Digital Learning)',
        '2. Manajemen Risiko & Kontrak Proyek EBT (Action Learning)',
        '3. Coaching Lintas Direktorat (Coaching & Mentoring)',
      ],
      targetCompetencies: ['Strategic Grid Resilience & Energy Transition Governance'],
      description: 'Learning path korporat untuk penyelarasan eksekusi proyek transisi energi.',
      status: 'Disetujui',
      createdAt: '2026-11-10T09:00:00.000Z',
    },
  ];

  const recommendations: LearningRecommendation[] = [
    {
      id: 'rec-smartgrid-01',
      programTitle: 'Akademi Proteksi & Otomasi Gardu Induk Digital (IEC 61850)',
      needSource: 'TNA',
      researchStudyId: 'lna-study-transmisi-2026',
      tnaId: 'tna-unit-transmisi-01',
      learningPathId: 'lp-transmisi-smartgrid',
      professionDesignRef: 'PROF-TR-01 · Grand Design Profesi Transmisi',
      targetCompetency: 'Digital Substation Protection & IEC 61850 Architecture',
      businessSegmentId: 'seg-transmisi',
      departmentId: 'dept-transmisi-grid',
      targetAudience: 'Enjinir Proteksi, SCADA & Pemeliharaan Gardu Induk',
      priority: 'critical',
      deliveryMethods: ['Blended Learning', 'Workshop & Simulasi', 'Digital Learning'],
      isNonTrainingIntervention: false,
      isAiSuggested: false,
      approvalStatus: 'Dipublikasikan',
      followUpPlan: 'Eksekusi batch 1 bersama PLN CorpU Learning Center dan evaluasi Level 3 pasca-pelatihan.',
      estimatedParticipants: 90,
      createdBy: 'system',
      approvedBy: 'system',
      createdAt: '2026-10-22T11:00:00.000Z',
      updatedAt: '2026-11-01T14:30:00.000Z',
    },
    {
      id: 'rec-pembangkitan-sop',
      programTitle: 'Penyelarasan SOP Penerimaan Biomassa & Mentoring Shift Operasi Boiler',
      needSource: 'DNA',
      researchStudyId: 'lna-study-pembangkitan-2026',
      professionDesignRef: 'PROF-PB-01 · Grand Design Profesi Pembangkitan',
      targetCompetency: 'Biomass Co-Firing Combustion & Slagging Mitigation',
      businessSegmentId: 'seg-pembangkitan',
      departmentId: 'dept-pembangkitan-ops',
      targetAudience: 'Supervisor Operasi & Operator Boiler Unit Pembangkitan',
      priority: 'high',
      deliveryMethods: ['Intervensi Non-Pelatihan', 'Coaching & Mentoring'],
      isNonTrainingIntervention: true,
      nonTrainingNote:
        'Sebagian akar masalah berasal dari variasi kualitas pasokan & standar kalibrasi SOP, sehingga ditangani dengan pembaruan SOP dan coaching lapangan tanpa memaksakan pelatihan kelas penuh.',
      isAiSuggested: false,
      approvalStatus: 'Disetujui',
      followUpPlan: 'Finalisasi SOP bersama Departemen Energi Primer sebelum sosialisasi unit.',
      estimatedParticipants: 60,
      createdBy: 'system',
      createdAt: '2026-11-06T10:00:00.000Z',
      updatedAt: '2026-11-10T10:00:00.000Z',
    },
  ];

  const managementFeedback: ManagementFeedback[] = [
    {
      id: 'fb-01',
      researchStudyId: 'lna-study-transmisi-2026',
      title: 'Penambahan Modul Uji Keamanan Siber OT pada Kurikulum Gardu Induk Digital',
      comment:
        'Cakupan proteksi IEC 61850 sudah sangat relevan dengan kesiapan sistem transmisi, namun perlu penekanan koordinasi insiden OT bersama tim TI.',
      improvementSuggestion:
        'Tambahkan studi kasus isolasi jaringan substation saat terjadi anomali paket GOOSE.',
      priority: 'high',
      submittedByUid: 'seed-mgmt',
      submittedByName: 'Management Perwakilan Transmisi',
      status: 'Selesai',
      adminResponse: 'Studi kasus keamanan jaringan IEC 61850 telah ditambahkan ke Tahap 3 Learning Path.',
      decisionReason: 'Diterima karena berdampak langsung terhadap keandalan proteksi dan ketahanan siber OT.',
      respondedByUid: 'system',
      respondedByName: 'Super Admin PLN CORPU',
      respondedAt: '2026-11-01T13:30:00.000Z',
      createdAt: '2026-10-29T09:00:00.000Z',
      updatedAt: '2026-11-01T13:30:00.000Z',
    },
    {
      id: 'fb-02',
      researchStudyId: 'lna-study-pembangkitan-2026',
      title: 'Sinkronisasi Jadwal Mentoring dengan Rencana Overhaul Unit',
      comment:
        'Pelaksanaan coaching shift operasi sebaiknya dijadwalkan di luar periode pemeliharaan puncak agar tidak mengganggu kesiapan unit.',
      improvementSuggestion: 'Sertakan opsi modul microlearning singkat untuk operator shift malam.',
      priority: 'medium',
      submittedByUid: 'seed-mgmt',
      submittedByName: 'Management Perwakilan Pembangkitan',
      status: 'Baru',
      createdAt: '2026-11-11T10:30:00.000Z',
      updatedAt: '2026-11-11T10:30:00.000Z',
    },
  ];

  const approvalHistory: ApprovalHistoryEntry[] = [
    {
      id: 'app-01',
      entityType: 'research_study',
      entityId: 'lna-study-transmisi-2026',
      fromStatus: 'Disetujui',
      toStatus: 'Dipublikasikan',
      actorUid: 'system',
      actorName: 'Super Admin PLN CORPU',
      note: 'Dipublikasikan untuk acuan Learning Path Smart Grid dan TNA Unit.',
      createdAt: '2026-11-01T14:00:00.000Z',
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud-seed-01',
      actorUid: 'system',
      actorEmail: 'system@plncorpu.local',
      actorRole: 'SUPER_ADMIN',
      action: 'SYSTEM_SEED_INITIALIZED',
      resourceType: 'database',
      resourceId: 'initial-seed',
      details: 'Inisialisasi master bidang bisnis PLN, departemen, direktori kompetensi, dan penelitian LNA awal.',
      createdAt: now,
    },
  ];

  return {
    organizations,
    users,
    sessions: [],
    researchStudies,
    pestelIssues,
    professions,
    competencies,
    ccaAssessments,
    dnaAssessments,
    tnaAssessments,
    learningPaths,
    recommendations,
    managementFeedback,
    approvalHistory,
    auditLogs,
  };
}
