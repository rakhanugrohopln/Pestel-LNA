import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  ExternalLink,
  FileSearch,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PriorityLabel, StatusLabel, formatShortDate, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiRequest } from '../lib/api';
import type {
  OrganizationNode,
  PestelCategory,
  PestelIssue,
  PriorityLevel,
  ResearchStatus,
  ResearchStudy,
} from '../shared/types';

const PESTEL_OPTIONS: PestelCategory[] = [
  'Political',
  'Economic',
  'Social',
  'Technological',
  'Environmental',
  'Legal',
];

const STATUS_OPTIONS: ResearchStatus[] = [
  'Draft',
  'Dalam Analisis',
  'Menunggu Masukan',
  'Revisi',
  'Disetujui',
  'Dipublikasikan',
];

export function LnaStudiesPage() {
  const { slug } = useParams<{ slug?: string }>();
  const { user, organizations } = useAuth();
  const { segments, departments, units, getName } = useOrgLookup(organizations);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [pestelIssues, setPestelIssues] = useState<PestelIssue[]>([]);
  const [activeDepartment, setActiveDepartment] = useState<OrganizationNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [notice, setNotice] = useState('');

  // 8 Filters
  const [q, setQ] = useState('');
  const [businessSegmentId, setBusinessSegmentId] = useState('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [unitId, setUnitId] = useState('all');
  const [year, setYear] = useState('all');
  const [pestelCategory, setPestelCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Create Modal (24 fields)
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studyCode: `LNA-2026-${Math.floor(100 + Math.random() * 899)}`,
    title: '',
    year: 2026,
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
    unitId: '',
    leadName: user?.displayName || 'Tim Peneliti LNA PLN CORPU',
    priority: 'high' as PriorityLevel,
    status: 'Draft' as ResearchStatus,
    strategicIssueSource: '',
    relatedPestelCategories: ['Technological'] as PestelCategory[],
    linkedPestelIds: [] as string[],
    sourceUrlsText: '',
    supportingEvidence: '',
    background: '',
    problemStatement: '',
    objectives: '',
    currentConditionAnalysis: '',
    orgNeedsAnalysis: '',
    competencyNeeds: '',
    lnaResult: '',
    ccaSummary: '',
    dnaSummary: '',
    tnaSummary: '',
    developmentRecommendation: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    setAccessDenied(false);
    try {
      if (slug) {
        const res = await apiRequest<{ organization: OrganizationNode; studies: ResearchStudy[] }>(
          `/api/v1/research/department/${encodeURIComponent(slug)}`,
        );
        setActiveDepartment(res.organization);
        setStudies(res.studies || []);
      } else {
        setActiveDepartment(null);
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (businessSegmentId !== 'all') params.set('businessSegmentId', businessSegmentId);
        if (departmentId !== 'all') params.set('departmentId', departmentId);
        if (unitId !== 'all') params.set('unitId', unitId);
        if (year !== 'all') params.set('year', year);
        if (pestelCategory !== 'all') params.set('pestelCategory', pestelCategory);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (priorityFilter !== 'all') params.set('priority', priorityFilter);

        const res = await apiRequest<{ studies: ResearchStudy[] }>(`/api/v1/research?${params.toString()}`);
        setStudies(res.studies || []);
      }

      const pestelRes = await apiRequest<{ issues: PestelIssue[] }>('/api/v1/pestel');
      setPestelIssues(pestelRes.issues || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setAccessDenied(true);
      }
      setError(err instanceof Error ? err.message : 'Gagal memuat penelitian LNA.');
    } finally {
      setLoading(false);
    }
  }, [slug, q, businessSegmentId, departmentId, unitId, year, pestelCategory, statusFilter, priorityFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    const defaultSeg = activeDepartment?.businessSegmentId || (businessSegmentId !== 'all' ? businessSegmentId : segments[0]?.id || 'seg-transmisi');
    const defaultDept =
      activeDepartment?.id ||
      departments.find((d) => d.businessSegmentId === defaultSeg)?.id ||
      departments[0]?.id ||
      'dept-transmisi-grid';
    setForm((prev) => ({
      ...prev,
      studyCode: `LNA-2026-${Math.floor(100 + Math.random() * 899)}`,
      businessSegmentId: defaultSeg,
      departmentId: defaultDept,
      leadName: user?.displayName || prev.leadName,
    }));
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const sourceUrls = form.sourceUrlsText
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean);

      await apiRequest('/api/v1/research', {
        method: 'POST',
        body: JSON.stringify({
          studyCode: form.studyCode.trim(),
          title: form.title.trim(),
          year: Number(form.year),
          businessSegmentId: form.businessSegmentId,
          departmentId: form.departmentId,
          unitId: form.unitId || undefined,
          leadName: form.leadName.trim(),
          priority: form.priority,
          status: form.status,
          strategicIssueSource: form.strategicIssueSource.trim(),
          relatedPestelCategories: form.relatedPestelCategories,
          linkedPestelIds: form.linkedPestelIds,
          sourceUrls,
          supportingEvidence: form.supportingEvidence.trim(),
          background: form.background.trim(),
          problemStatement: form.problemStatement.trim(),
          objectives: form.objectives.trim(),
          currentConditionAnalysis: form.currentConditionAnalysis.trim(),
          orgNeedsAnalysis: form.orgNeedsAnalysis.trim(),
          competencyNeeds: form.competencyNeeds.trim(),
          lnaResult: form.lnaResult.trim(),
          ccaSummary: form.ccaSummary.trim(),
          dnaSummary: form.dnaSummary.trim(),
          tnaSummary: form.tnaSummary.trim(),
          developmentRecommendation: form.developmentRecommendation.trim(),
        }),
      });
      setShowModal(false);
      setNotice(`Penelitian LNA "${form.studyCode}" berhasil dibuat.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat penelitian LNA.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, nextStatus: ResearchStatus) => {
    setError('');
    try {
      await apiRequest(`/api/v1/research/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(`Status penelitian diperbarui menjadi ${nextStatus}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status penelitian.');
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/api/v1/research/${id}`, { method: 'DELETE' });
      setNotice('Dokumen penelitian LNA berhasil dihapus.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus penelitian.');
    }
  };

  const deptOptionsForFilter =
    businessSegmentId === 'all'
      ? departments
      : departments.filter((d) => d.businessSegmentId === businessSegmentId);

  const unitOptionsForFilter =
    departmentId === 'all' ? units : units.filter((u) => u.parentId === departmentId);

  const formDeptOptions = departments.filter((d) => d.businessSegmentId === form.businessSegmentId);
  const formUnitOptions = units.filter((u) => u.parentId === form.departmentId);

  const visibleDepartments =
    businessSegmentId === 'all'
      ? departments
      : departments.filter((d) => d.businessSegmentId === businessSegmentId);

  return (
    <AppShell
      breadcrumbs={
        slug
          ? [
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Penelitian & Analisis Kebutuhan (LNA)', to: '/lna' },
              { label: activeDepartment?.name || slug },
            ]
          : [
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Penelitian & Analisis Kebutuhan (LNA)' },
            ]
      }
      actions={
        isSuperAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Penelitian LNA</span>
          </button>
        )
      }
    >
      <div className="space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white">
              {activeDepartment
                ? `Penelitian LNA: ${activeDepartment.name}`
                : 'Penelitian & Analisis Kebutuhan (LNA) per Departemen PLN'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              {activeDepartment
                ? `${getName(activeDepartment.businessSegmentId)} — ${activeDepartment.description}`
                : 'Pusat penelitian Learning Value Chain Slide 8 yang menghubungkan isu PESTEL dengan analisis organisasi, CCA, DNA, TNA, dan rekomendasi pembelajaran.'}
            </p>
          </div>
          {slug && (
            <Link
              to="/lna"
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg shrink-0"
            >
              Lihat Semua Departemen
            </Link>
          )}
        </div>

        {accessDenied ? (
          <div className="bg-[#0F172A] border border-rose-800/60 rounded-xl p-8 text-center space-y-3">
            <Lock className="w-8 h-8 text-rose-400 mx-auto" />
            <h2 className="text-base font-semibold text-white">Akses Departemen Ditolak (403)</h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto">{error}</p>
            <Link
              to="/lna"
              className="inline-block px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
            >
              Kembali ke Daftar LNA Terotorisasi
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs">
                {error}
              </div>
            )}
            {notice && (
              <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs">
                {notice}
              </div>
            )}

            {/* Business Segment Tabs + Department Workspace Links (when not inside single slug) */}
            {!slug && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBusinessSegmentId('all');
                      setDepartmentId('all');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      businessSegmentId === 'all'
                        ? 'bg-blue-600/20 border-cyan-500 text-cyan-200'
                        : 'bg-[#0F172A] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    Semua Bidang Bisnis ({segments.length})
                  </button>
                  {segments.map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => {
                        setBusinessSegmentId(seg.id);
                        setDepartmentId('all');
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        businessSegmentId === seg.id
                          ? 'bg-blue-600/20 border-cyan-500 text-cyan-200'
                          : 'bg-[#0F172A] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {seg.name}
                    </button>
                  ))}
                </div>

                {/* Department directory grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleDepartments.map((dept) => (
                    <Link
                      key={dept.id}
                      to={`/lna/departemen/${dept.slug}`}
                      className="bg-[#0B1220] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-3.5 flex items-start justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-cyan-400">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{getName(dept.businessSegmentId)}</span>
                        </div>
                        <div className="text-xs font-semibold text-white truncate">{dept.name}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{dept.description}</div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    </Link>
                  ))}
                </div>

                {/* 8 Filters */}
                <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Cari kode/judul penelitian..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500"
                    />
                  </div>

                  <select
                    aria-label="Filter Bidang Bisnis"
                    value={businessSegmentId}
                    onChange={(e) => {
                      setBusinessSegmentId(e.target.value);
                      setDepartmentId('all');
                      setUnitId('all');
                    }}
                    className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
                  >
                    <option value="all">Semua Bidang Bisnis</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter Departemen"
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      setUnitId('all');
                    }}
                    className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
                  >
                    <option value="all">Semua Departemen</option>
                    {deptOptionsForFilter.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter Unit Kerja"
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
                  >
                    <option value="all">Semua Unit Kerja</option>
                    {unitOptionsForFilter.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter Tahun"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
                  >
                    <option value="all">Semua Tahun</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>

                  <select
                    aria-label="Filter Kategori PESTEL"
                    value={pestelCategory}
                    onChange={(e) => setPestelCategory(e.target.value)}
                    className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
                  >
                    <option value="all">Semua Dimensi PESTEL</option>
                    {PESTEL_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter Status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
                  >
                    <option value="all">Semua Status</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter Prioritas"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
                  >
                    <option value="all">Semua Prioritas</option>
                    <option value="critical">Kritis</option>
                    <option value="high">Tinggi</option>
                    <option value="medium">Sedang</option>
                    <option value="low">Rendah</option>
                  </select>
                </div>
              </div>
            )}

            {/* Studies List */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-36 rounded-xl bg-[#0F172A] border border-slate-800 animate-pulse" />
                ))}
              </div>
            ) : studies.length === 0 ? (
              <div className="bg-[#0F172A] border border-dashed border-slate-800 rounded-xl p-10 text-center space-y-2">
                <FileSearch className="w-7 h-7 text-slate-500 mx-auto" />
                <div className="text-sm font-medium text-slate-300">Belum ada dokumen penelitian LNA</div>
                <div className="text-xs text-slate-500">
                  {user?.role === 'USER'
                    ? 'Hanya penelitian berstatus Dipublikasikan dalam cakupan departemen Anda yang dapat diakses.'
                    : 'Sesuaikan filter atau tambahkan penelitian LNA baru.'}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {studies.map((study) => (
                  <article key={study.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono-tabular font-semibold text-cyan-300">
                            {study.studyCode}
                          </span>
                          <StatusLabel status={study.status} />
                          <PriorityLabel priority={study.priority} />
                          <span className="text-[11px] text-slate-400">Tahun {study.year}</span>
                        </div>
                        <Link
                          to={`/lna/${study.id}`}
                          className="block text-base font-semibold text-white hover:text-cyan-300 transition-colors"
                        >
                          {study.title}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {getName(study.businessSegmentId)} → {getName(study.departmentId)}
                          {study.unitId ? ` → ${getName(study.unitId)}` : ''} · Ketua Tim: {study.leadName}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          to={`/lna/${study.id}`}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 border border-blue-500/40 text-cyan-200 hover:bg-blue-600/30 rounded-lg"
                        >
                          Buka Detail Penelitian
                        </Link>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 line-clamp-2">{study.background}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/80">
                        <div className="text-[11px] text-slate-400">Kebutuhan Kompetensi</div>
                        <div className="text-slate-200 line-clamp-2 mt-0.5">{study.competencyNeeds || '-'}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/80">
                        <div className="text-[11px] text-slate-400">Hasil LNA</div>
                        <div className="text-slate-200 line-clamp-2 mt-0.5">{study.lnaResult || '-'}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/80">
                        <div className="text-[11px] text-slate-400">Rekomendasi Pengembangan</div>
                        <div className="text-slate-200 line-clamp-2 mt-0.5">{study.developmentRecommendation || '-'}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
                      <div className="text-slate-400">
                        PESTEL: <span className="text-slate-200">{study.relatedPestelCategories.join(', ') || '-'}</span> ·
                        Diperbarui {formatShortDate(study.updatedAt)}
                      </div>

                      {isSuperAdmin && (
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Ubah status ${study.studyCode}`}
                            value={study.status}
                            onChange={(e) => void handleStatusChange(study.id, e.target.value as ResearchStatus)}
                            className="px-2 py-1 text-xs bg-[#080E1A] border border-slate-700 rounded text-slate-200"
                          >
                            {STATUS_OPTIONS.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleDelete(study.id)}
                            className="px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-950/50 border border-rose-800/40 rounded inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 24-Field Create Modal (SUPER_ADMIN only) */}
      {showModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F172A] border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white">Tambah Penelitian &amp; Analisis Kebutuhan (LNA)</h2>
                <p className="text-xs text-slate-400">Lengkapi formulir terstruktur Learning Value Chain Slide 8</p>
              </div>
              <button
                type="button"
                aria-label="Tutup form penelitian"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">Kode Penelitian *</label>
                  <input
                    required
                    value={form.studyCode}
                    onChange={(e) => setForm({ ...form, studyCode: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-slate-300">Judul Penelitian LNA *</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Contoh: Analisis Kebutuhan Kompetensi Digital Substation & Proteksi Grid"
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">Bidang Bisnis PLN *</label>
                  <select
                    value={form.businessSegmentId}
                    onChange={(e) => {
                      const nextSeg = e.target.value;
                      const firstDept = departments.find((d) => d.businessSegmentId === nextSeg);
                      setForm({
                        ...form,
                        businessSegmentId: nextSeg,
                        departmentId: firstDept?.id || '',
                        unitId: '',
                      });
                    }}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  >
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">Departemen *</label>
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value, unitId: '' })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  >
                    {(formDeptOptions.length ? formDeptOptions : departments).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">Unit Kerja (Opsional)</label>
                  <select
                    value={form.unitId}
                    onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  >
                    <option value="">Lintas Unit / Tingkat Departemen</option>
                    {formUnitOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">Tahun</label>
                  <input
                    type="number"
                    min={2020}
                    max={2035}
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Prioritas</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as PriorityLevel })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  >
                    <option value="low">Rendah</option>
                    <option value="medium">Sedang</option>
                    <option value="high">Tinggi</option>
                    <option value="critical">Kritis</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Status Awal</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ResearchStatus })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Ketua Tim Peneliti *</label>
                  <input
                    required
                    value={form.leadName}
                    onChange={(e) => setForm({ ...form, leadName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">Latar Belakang Penelitian *</label>
                  <textarea
                    required
                    rows={3}
                    value={form.background}
                    onChange={(e) => setForm({ ...form, background: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Rumusan Masalah *</label>
                  <textarea
                    required
                    rows={3}
                    value={form.problemStatement}
                    onChange={(e) => setForm({ ...form, problemStatement: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Tujuan Penelitian *</label>
                  <textarea
                    required
                    rows={2}
                    value={form.objectives}
                    onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Sumber Isu Strategis &amp; Dokumen Pendukung</label>
                  <textarea
                    rows={2}
                    value={form.strategicIssueSource}
                    onChange={(e) => setForm({ ...form, strategicIssueSource: e.target.value })}
                    placeholder="Contoh: RUPTL 2025-2034, Kajian Grid Code, Laporan Gangguan Transmisi"
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300">Kategori PESTEL Terkait</label>
                <div className="flex flex-wrap gap-2">
                  {PESTEL_OPTIONS.map((cat) => {
                    const active = form.relatedPestelCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            relatedPestelCategories: active
                              ? prev.relatedPestelCategories.filter((c) => c !== cat)
                              : [...prev.relatedPestelCategories, cat],
                          }))
                        }
                        className={`px-2.5 py-1 rounded border ${
                          active
                            ? 'bg-cyan-600/20 border-cyan-500 text-cyan-200'
                            : 'bg-[#080E1A] border-slate-700 text-slate-400'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {pestelIssues.length > 0 && (
                <div className="space-y-1">
                  <label className="text-slate-300">Tautkan Isu PESTEL (Opsional)</label>
                  <select
                    multiple
                    value={form.linkedPestelIds}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        linkedPestelIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white h-20"
                  >
                    {pestelIssues.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">Analisis Kondisi Eksisting</label>
                  <textarea
                    rows={2}
                    value={form.currentConditionAnalysis}
                    onChange={(e) => setForm({ ...form, currentConditionAnalysis: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Analisis Kebutuhan Organisasi</label>
                  <textarea
                    rows={2}
                    value={form.orgNeedsAnalysis}
                    onChange={(e) => setForm({ ...form, orgNeedsAnalysis: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Kebutuhan Kompetensi</label>
                  <textarea
                    rows={2}
                    value={form.competencyNeeds}
                    onChange={(e) => setForm({ ...form, competencyNeeds: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Hasil LNA</label>
                  <textarea
                    rows={2}
                    value={form.lnaResult}
                    onChange={(e) => setForm({ ...form, lnaResult: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Ringkasan CCA</label>
                  <textarea
                    rows={2}
                    value={form.ccaSummary}
                    onChange={(e) => setForm({ ...form, ccaSummary: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Ringkasan DNA</label>
                  <textarea
                    rows={2}
                    value={form.dnaSummary}
                    onChange={(e) => setForm({ ...form, dnaSummary: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Ringkasan TNA</label>
                  <textarea
                    rows={2}
                    value={form.tnaSummary}
                    onChange={(e) => setForm({ ...form, tnaSummary: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Rekomendasi Pengembangan</label>
                  <textarea
                    rows={2}
                    value={form.developmentRecommendation}
                    onChange={(e) => setForm({ ...form, developmentRecommendation: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Bukti Pendukung</label>
                  <textarea
                    rows={2}
                    value={form.supportingEvidence}
                    onChange={(e) => setForm({ ...form, supportingEvidence: e.target.value })}
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">URL Referensi (1 URL per baris)</label>
                  <textarea
                    rows={2}
                    value={form.sourceUrlsText}
                    onChange={(e) => setForm({ ...form, sourceUrlsText: e.target.value })}
                    placeholder="https://web.pln.co.id/..."
                    className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-lg"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Penelitian LNA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
