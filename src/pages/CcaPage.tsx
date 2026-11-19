import React, { useCallback, useEffect, useState } from 'react';
import { Award, Plus } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { StatusLabel, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type {
  AnalysisPublishStatus,
  CcaAssessment,
  CompetencyItem,
  ProfessionItem,
  ResearchStudy,
} from '../shared/types';

export function CcaPage() {
  const { user, organizations } = useAuth();
  const { segments, departments, getName } = useOrgLookup(organizations);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [ccaList, setCcaList] = useState<CcaAssessment[]>([]);
  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyItem[]>([]);
  const [professions, setProfessions] = useState<ProfessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    researchStudyId: '',
    competencyId: '',
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
    professionName: '',
    competencyType: 'core' as 'core' | 'technical',
    competencyName: '',
    jobStandardRef: 'Belum Dikonfigurasi',
    currentLevel: 2,
    requiredLevel: 4,
    gapNote: '',
    configStatus: 'uat_synthetic' as 'uat_synthetic' | 'unconfigured' | 'official',
    status: 'Draft' as AnalysisPublishStatus,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ccaRes, stRes, compRes] = await Promise.all([
        apiRequest<{ ccaList: CcaAssessment[] }>('/api/v1/cca'),
        apiRequest<{ studies: ResearchStudy[] }>('/api/v1/research'),
        apiRequest<{ competencies: CompetencyItem[]; professions: ProfessionItem[] }>('/api/v1/competencies'),
      ]);
      setCcaList(ccaRes.ccaList || []);
      setStudies(stRes.studies || []);
      setCompetencies(compRes.competencies || []);
      setProfessions(compRes.professions || []);
      if ((stRes.studies || []).length > 0 && !form.researchStudyId) {
        const first = stRes.studies[0];
        setForm((prev) => ({
          ...prev,
          researchStudyId: first.id,
          businessSegmentId: first.businessSegmentId,
          departmentId: first.departmentId,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data CCA.');
    } finally {
      setLoading(false);
    }
  }, [form.researchStudyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await apiRequest('/api/v1/cca', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          competencyId: form.competencyId || undefined,
          currentLevel: Number(form.currentLevel),
          requiredLevel: Number(form.requiredLevel),
        }),
      });
      setShowForm(false);
      setNotice('Penilaian Core Competency Analysis (CCA) berhasil disimpan.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan CCA.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: AnalysisPublishStatus) => {
    setError('');
    try {
      await apiRequest(`/api/v1/cca/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(`Status CCA diperbarui menjadi ${status}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui status CCA.');
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Core Competency Analysis (CCA)' },
      ]}
      actions={
        isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Analisis CCA</span>
          </button>
        )
      }
    >
      <div className="space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
          <h1 className="text-xl font-bold text-white">Core Competency Analysis (CCA)</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Pemetaan kesenjangan kompetensi inti &amp; teknis berdasarkan Direktori Kompetensi dan standar profesi (data uji sintetis UAT dan item berstatus Belum Dikonfigurasi ditandai eksplisit).
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

        {showForm && isSuperAdmin && (
          <form onSubmit={handleCreate} className="bg-[#0F172A] border border-blue-700/50 rounded-xl p-5 space-y-4 text-xs">
            <h2 className="text-sm font-semibold text-white">Tambah Penilaian CCA</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300">Penelitian LNA Rujukan *</label>
                <select
                  required
                  value={form.researchStudyId}
                  onChange={(e) => {
                    const st = studies.find((s) => s.id === e.target.value);
                    setForm({
                      ...form,
                      researchStudyId: e.target.value,
                      businessSegmentId: st?.businessSegmentId || form.businessSegmentId,
                      departmentId: st?.departmentId || form.departmentId,
                    });
                  }}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                >
                  <option value="">Pilih Penelitian LNA...</option>
                  {studies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studyCode} — {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">Master Kompetensi (Opsional)</label>
                <select
                  value={form.competencyId}
                  onChange={(e) => {
                    const c = competencies.find((item) => item.id === e.target.value);
                    const p = c?.professionId ? professions.find((pr) => pr.id === c.professionId) : undefined;
                    setForm({
                      ...form,
                      competencyId: e.target.value,
                      competencyName: c ? c.name : form.competencyName,
                      professionName: p ? p.name : form.professionName,
                      jobStandardRef: c ? c.jobStandardRef : form.jobStandardRef,
                      requiredLevel: c ? c.targetLevel : form.requiredLevel,
                      configStatus: c ? c.configStatus : form.configStatus,
                    });
                  }}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                >
                  <option value="">Input Kompetensi Khusus...</option>
                  {competencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">Jenis Kompetensi</label>
                <select
                  value={form.competencyType}
                  onChange={(e) => setForm({ ...form, competencyType: e.target.value as 'core' | 'technical' })}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                >
                  <option value="core">Kompetensi Inti (Core)</option>
                  <option value="technical">Kompetensi Teknis (Technical)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300">Nama Profesi / Jabatan *</label>
                <input
                  required
                  value={form.professionName}
                  onChange={(e) => setForm({ ...form, professionName: e.target.value })}
                  placeholder="Contoh: Engineer Proteksi & SCADA"
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300">Nama Kompetensi *</label>
                <input
                  required
                  value={form.competencyName}
                  onChange={(e) => setForm({ ...form, competencyName: e.target.value })}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300">Referensi Standar Jabatan</label>
                <input
                  value={form.jobStandardRef}
                  onChange={(e) => setForm({ ...form, jobStandardRef: e.target.value })}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300">Level Saat Ini (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={form.currentLevel}
                  onChange={(e) => setForm({ ...form, currentLevel: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300">Level Target (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={form.requiredLevel}
                  onChange={(e) => setForm({ ...form, requiredLevel: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300">Status Konfigurasi Standar</label>
                <select
                  value={form.configStatus}
                  onChange={(e) =>
                    setForm({ ...form, configStatus: e.target.value as 'uat_synthetic' | 'unconfigured' | 'official' })
                  }
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                >
                  <option value="uat_synthetic">Data Sintetis UAT</option>
                  <option value="unconfigured">Belum Dikonfigurasi</option>
                  <option value="official">Standar Resmi PLN</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-slate-300">Status Publikasi</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as AnalysisPublishStatus })}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                >
                  <option value="Draft">Draft</option>
                  <option value="Terverifikasi">Terverifikasi</option>
                  <option value="Disetujui">Disetujui</option>
                  <option value="Dipublikasikan">Dipublikasikan</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={form.businessSegmentId}
                onChange={(e) => setForm({ ...form, businessSegmentId: e.target.value })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={2}
              value={form.gapNote}
              onChange={(e) => setForm({ ...form, gapNote: e.target.value })}
              placeholder="Catatan gap kompetensi CCA..."
              className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg"
              >
                {saving ? 'Menyimpan...' : 'Simpan CCA'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="h-44 rounded-xl bg-[#0F172A] border border-slate-800 animate-pulse" />
        ) : ccaList.length === 0 ? (
          <div className="bg-[#0F172A] border border-dashed border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
            <Award className="w-7 h-7 text-slate-500 mx-auto mb-2" />
            Belum ada penilaian CCA yang dapat diakses pada peran Anda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ccaList.map((item) => {
              const gap = Math.max(0, item.requiredLevel - item.currentLevel);
              return (
                <div key={item.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <StatusLabel status={item.status} />
                        <span className="text-cyan-300 uppercase font-semibold">{item.competencyType}</span>
                        <span className="text-slate-400">
                          {item.configStatus === 'uat_synthetic'
                            ? 'Sintetis UAT'
                            : item.configStatus === 'unconfigured'
                              ? 'Belum Dikonfigurasi'
                              : 'Standar Resmi'}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-white">{item.competencyName}</h3>
                      <div className="text-xs text-slate-400">
                        Profesi: {item.professionName} · {getName(item.departmentId)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center bg-[#080E1A] border border-slate-800 rounded-lg p-3 text-xs">
                    <div>
                      <div className="text-slate-400 text-[11px]">Level Aktual</div>
                      <div className="text-base font-bold text-white tabular-nums">{item.currentLevel}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Target Standar</div>
                      <div className="text-base font-bold text-cyan-300 tabular-nums">{item.requiredLevel}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Gap</div>
                      <div className="text-base font-bold text-amber-300 tabular-nums">+{gap}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300">
                    <span className="text-slate-400">Ref. Standar Jabatan: </span>
                    {item.jobStandardRef}
                  </div>
                  {item.gapNote && <p className="text-xs text-slate-300">{item.gapNote}</p>}

                  {isSuperAdmin && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Ubah Status:</span>
                      <select
                        value={item.status}
                        onChange={(e) => void handleStatusChange(item.id, e.target.value as AnalysisPublishStatus)}
                        className="px-2.5 py-1 bg-[#080E1A] border border-slate-700 rounded text-white"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Terverifikasi">Terverifikasi</option>
                        <option value="Disetujui">Disetujui</option>
                        <option value="Dipublikasikan">Dipublikasikan</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
