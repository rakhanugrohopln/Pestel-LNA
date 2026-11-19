import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PriorityLabel, StatusLabel, formatShortDate, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { PestelCategory, PestelIssue, PestelStatus, PriorityLevel, ResearchStudy } from '../shared/types';

const PESTEL_CATEGORIES: PestelCategory[] = [
  'Political',
  'Economic',
  'Social',
  'Technological',
  'Environmental',
  'Legal',
];

export function PestelPage({ mode = 'analysis' }: { mode?: 'analysis' | 'monitoring' }) {
  const { user, organizations, config } = useAuth();
  const { segments, departments, getName } = useOrgLookup(organizations);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [issues, setIssues] = useState<PestelIssue[]>([]);
  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [segmentFilter, setSegmentFilter] = useState('all');

  // AI News Analyzer form (SUPER_ADMIN only)
  const [sourceUrl, setSourceUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [titleHint, setTitleHint] = useState('');
  const [aiSegmentId, setAiSegmentId] = useState(segments[0]?.id || 'seg-transmisi');
  const [aiDepartmentId, setAiDepartmentId] = useState(departments[0]?.id || 'dept-transmisi-grid');
  const [aiProvince, setAiProvince] = useState('Nasional');
  const [aiPeriod, setAiPeriod] = useState('2026-Q4');
  const [analyzing, setAnalyzing] = useState(false);

  // Manual entry drawer
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [manualImpact, setManualImpact] = useState('');
  const [manualCategories, setManualCategories] = useState<PestelCategory[]>(['Technological']);
  const [manualSeverity, setManualSeverity] = useState<PriorityLevel>('high');
  const [manualRiskOpp, setManualRiskOpp] = useState<'risk' | 'opportunity' | 'both'>('both');
  const [manualSegId, setManualSegId] = useState('seg-transmisi');
  const [manualDeptId, setManualDeptId] = useState('dept-transmisi-grid');
  const [manualSourceUrl, setManualSourceUrl] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  // Link to study selector per card
  const [linkTargets, setLinkTargets] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (segmentFilter !== 'all') params.set('businessSegmentId', segmentFilter);
      const [pestelRes, studyRes] = await Promise.all([
        apiRequest<{ issues: PestelIssue[] }>(`/api/v1/pestel?${params.toString()}`),
        apiRequest<{ studies: ResearchStudy[] }>('/api/v1/research'),
      ]);
      setIssues(pestelRes.issues || []);
      setStudies(studyRes.studies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data PESTEL.');
    } finally {
      setLoading(false);
    }
  }, [q, categoryFilter, segmentFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAnalyzeNews = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setAnalyzing(true);
    try {
      const res = await apiRequest<{ issue: PestelIssue; modelUsed: string }>('/api/v1/ai/analyze-news', {
        method: 'POST',
        body: JSON.stringify({
          sourceUrl: sourceUrl.trim() || undefined,
          rawText: rawText.trim() || undefined,
          titleHint: titleHint.trim() || undefined,
          businessSegmentId: aiSegmentId,
          departmentId: aiDepartmentId,
          province: aiProvince,
          period: aiPeriod,
        }),
      });
      setNotice(`Analisis AI (${res.modelUsed}) berhasil disimpan sebagai Draft AI untuk verifikasi Super Admin.`);
      setSourceUrl('');
      setRawText('');
      setTitleHint('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analisis AI gagal dijalankan.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCategories.length === 0) {
      setError('Pilih minimal satu kategori PESTEL.');
      return;
    }
    setError('');
    setNotice('');
    setSavingManual(true);
    try {
      await apiRequest('/api/v1/pestel', {
        method: 'POST',
        body: JSON.stringify({
          title: manualTitle,
          summary: manualSummary,
          impactAnalysis: manualImpact,
          categories: manualCategories,
          severity: manualSeverity,
          riskOrOpportunity: manualRiskOpp,
          businessSegmentId: manualSegId,
          departmentId: manualDeptId,
          sourceUrl: manualSourceUrl.trim() || undefined,
          status: 'Tervalidasi',
        }),
      });
      setShowManualForm(false);
      setManualTitle('');
      setManualSummary('');
      setManualImpact('');
      setManualSourceUrl('');
      setNotice('Isu PESTEL baru berhasil disimpan.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan isu PESTEL.');
    } finally {
      setSavingManual(false);
    }
  };

  const handleUpdatePestel = async (id: string, payload: { status?: PestelStatus; linkedStudyId?: string }) => {
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/v1/pestel/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setNotice('Status / keterkaitan isu PESTEL berhasil diperbarui.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui isu PESTEL.');
    }
  };

  const handleDeletePestel = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/api/v1/pestel/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus isu PESTEL.');
    }
  };

  const aiDepartments = departments.filter((d) => d.businessSegmentId === aiSegmentId);
  const manualDepartments = departments.filter((d) => d.businessSegmentId === manualSegId);

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: mode === 'analysis' ? 'AI News & PESTEL Analysis' : 'Monitoring Isu Strategis' },
      ]}
      actions={
        isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowManualForm((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Isu Manual</span>
          </button>
        )
      }
    >
      <div className="space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
          <h1 className="text-xl font-bold text-white">
            {mode === 'analysis' ? 'AI News & PESTEL Analysis' : 'Monitoring Isu Strategis Lintas Unit'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            {mode === 'analysis'
              ? 'Ekstraksi berita ketenagalistrikan berbasis Gemini API (output awal bertanda Draft AI dengan bukti kutipan) dan pemetaan ke penelitian LNA.'
              : 'Pemantauan isu Political, Economic, Social, Technological, Environmental, dan Legal per bidang bisnis dan departemen PLN.'}
          </p>
        </div>

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

        {/* AI News Analyzer (SUPER_ADMIN in Analysis mode) */}
        {mode === 'analysis' && isSuperAdmin && (
          <form onSubmit={handleAnalyzeNews} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Analisis Berita &amp; Regulasi Otomatis (Gemini AI)</h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Status API AI: {config?.geminiConfigured ? `Tersedia (${config.geminiModel})` : 'Belum Dikonfigurasi'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-300">URL Berita Publik (Dilindungi Validasi Anti-SSRF)</label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://portal-berita-energi.example/artikel"
                  className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-slate-300">Judul / Topik Referensi</label>
                <input
                  type="text"
                  value={titleHint}
                  onChange={(e) => setTitleHint(e.target.value)}
                  placeholder="Contoh: Regulasi TKDN & Percepatan Smart Grid Jawa-Bali"
                  className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-300">Ringkasan / Teks Berita (Opsional jika URL dapat diambil langsung)</label>
              <textarea
                rows={3}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Tempel kutipan artikel kebijakan, berita RUPTL, teknologi ketenagalistrikan, atau regulasi energi..."
                className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400">Bidang Bisnis Target</label>
                <select
                  value={aiSegmentId}
                  onChange={(e) => {
                    const seg = e.target.value;
                    setAiSegmentId(seg);
                    const firstDept = departments.find((d) => d.businessSegmentId === seg);
                    if (firstDept) setAiDepartmentId(firstDept.id);
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
                >
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400">Departemen Target</label>
                <select
                  value={aiDepartmentId}
                  onChange={(e) => setAiDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
                >
                  {(aiDepartments.length ? aiDepartments : departments).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400">Wilayah / Provinsi</label>
                <input
                  type="text"
                  value={aiProvince}
                  onChange={(e) => setAiProvince(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400">Periode</label>
                <input
                  type="text"
                  value={aiPeriod}
                  onChange={(e) => setAiPeriod(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-slate-400">
                Hasil ekstraksi AI wajib berstatus awal Draft AI sebelum dipublikasikan ke User.
              </p>
              <button
                type="submit"
                disabled={analyzing}
                className="px-4 py-2 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{analyzing ? 'Menganalisis...' : 'Jalankan Analisis AI PESTEL'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Manual Creation Form */}
        {showManualForm && isSuperAdmin && (
          <form onSubmit={handleCreateManual} className="bg-[#0F172A] border border-blue-700/50 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Input Manual Isu Strategis PESTEL</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs text-slate-300">Judul Isu</label>
                <input
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-300">URL Referensi (Opsional)</label>
                <input
                  type="url"
                  value={manualSourceUrl}
                  onChange={(e) => setManualSourceUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-300">Ringkasan Isu</label>
              <textarea
                required
                rows={2}
                value={manualSummary}
                onChange={(e) => setManualSummary(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-300">Analisis Dampak ke Bisnis &amp; Kompetensi PLN</label>
              <textarea
                rows={2}
                value={manualImpact}
                onChange={(e) => setManualImpact(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-300">Kategori PESTEL</label>
              <div className="flex flex-wrap gap-2">
                {PESTEL_CATEGORIES.map((cat) => {
                  const checked = manualCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setManualCategories((prev) =>
                          prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
                        )
                      }
                      className={`px-2.5 py-1 text-xs rounded border ${
                        checked
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

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={manualSegId}
                onChange={(e) => {
                  setManualSegId(e.target.value);
                  const firstDept = departments.find((d) => d.businessSegmentId === e.target.value);
                  if (firstDept) setManualDeptId(firstDept.id);
                }}
                className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={manualDeptId}
                onChange={(e) => setManualDeptId(e.target.value)}
                className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
              >
                {(manualDepartments.length ? manualDepartments : departments).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={manualSeverity}
                onChange={(e) => setManualSeverity(e.target.value as PriorityLevel)}
                className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
              >
                <option value="low">Prioritas Rendah</option>
                <option value="medium">Prioritas Sedang</option>
                <option value="high">Prioritas Tinggi</option>
                <option value="critical">Prioritas Kritis</option>
              </select>

              <select
                value={manualRiskOpp}
                onChange={(e) => setManualRiskOpp(e.target.value as 'risk' | 'opportunity' | 'both')}
                className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
              >
                <option value="both">Risiko &amp; Peluang</option>
                <option value="risk">Risiko</option>
                <option value="opportunity">Peluang</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingManual}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
              >
                {savingManual ? 'Menyimpan...' : 'Simpan Isu PESTEL'}
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul, ringkasan, atau dampak isu..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
          >
            <option value="all">Semua Kategori PESTEL</option>
            {PESTEL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200"
          >
            <option value="all">Semua Bidang Bisnis</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* PESTEL Issues List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-[#0F172A] border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : issues.length === 0 ? (
          <div className="bg-[#0F172A] border border-dashed border-slate-800 rounded-xl p-10 text-center text-sm text-slate-400">
            Tidak ada isu PESTEL yang cocok dengan filter atau izin akses akun Anda.
          </div>
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => (
              <article key={issue.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusLabel status={issue.status} />
                      <PriorityLabel priority={issue.severity} />
                      <span className="text-[11px] font-semibold text-cyan-300">
                        {issue.categories.join(' · ')}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {issue.province} · {issue.period}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white">{issue.title}</h3>
                    <div className="text-xs text-slate-400">
                      {getName(issue.businessSegmentId)} → {getName(issue.departmentId)} · Diperbarui {formatShortDate(issue.updatedAt)}
                    </div>
                  </div>

                  {issue.sourceUrl && (
                    <a
                      href={issue.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Sumber</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{issue.summary}</p>

                {issue.impactAnalysis && (
                  <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800/80 text-xs text-slate-300">
                    <span className="font-semibold text-cyan-300">Analisis Dampak: </span>
                    {issue.impactAnalysis}
                  </div>
                )}

                {issue.evidenceQuotes && issue.evidenceQuotes.length > 0 && (
                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="font-medium text-slate-300">Kutipan Bukti Sumber:</div>
                    {issue.evidenceQuotes.map((qText, i) => (
                      <blockquote key={i} className="pl-3 border-l-2 border-cyan-600/60 italic text-slate-300">
                        “{qText}”
                      </blockquote>
                    ))}
                  </div>
                )}

                {issue.linkedStudyIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-400">Terhubung ke LNA:</span>
                    {issue.linkedStudyIds.map((sid) => {
                      const st = studies.find((s) => s.id === sid);
                      return (
                        <Link
                          key={sid}
                          to={`/lna/${sid}`}
                          className="px-2 py-0.5 rounded bg-blue-950/50 border border-blue-700/60 text-cyan-300 hover:text-white"
                        >
                          {st ? `${st.studyCode}` : sid}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {isSuperAdmin && (
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {issue.status !== 'Tervalidasi' && issue.status !== 'Dipublikasikan' && (
                        <button
                          type="button"
                          onClick={() => void handleUpdatePestel(issue.id, { status: 'Tervalidasi' })}
                          className="px-2.5 py-1 text-xs bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 rounded-md inline-flex items-center gap-1 hover:bg-cyan-600/30"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Validasi Isu</span>
                        </button>
                      )}
                      {issue.status !== 'Dipublikasikan' && (
                        <button
                          type="button"
                          onClick={() => void handleUpdatePestel(issue.id, { status: 'Dipublikasikan' })}
                          className="px-2.5 py-1 text-xs bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 rounded-md hover:bg-emerald-600/30"
                        >
                          Publikasikan
                        </button>
                      )}

                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label={`Hubungkan ${issue.title} ke Penelitian LNA`}
                          value={linkTargets[issue.id] || ''}
                          onChange={(e) => setLinkTargets((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                          className="px-2 py-1 text-xs bg-[#080E1A] border border-slate-700 rounded text-slate-200 max-w-52"
                        >
                          <option value="">Pilih Penelitian LNA...</option>
                          {studies.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.studyCode} — {s.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!linkTargets[issue.id]}
                          onClick={() =>
                            linkTargets[issue.id] &&
                            void handleUpdatePestel(issue.id, { linkedStudyId: linkTargets[issue.id] })
                          }
                          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded inline-flex items-center gap-1"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>Tautkan</span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDeletePestel(issue.id)}
                      className="px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-950/50 border border-rose-800/40 rounded inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
