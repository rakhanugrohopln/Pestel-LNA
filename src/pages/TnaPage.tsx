import React, { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck, Target } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PriorityLabel, StatusLabel, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type {
  AnalysisPublishStatus,
  DnaAssessment,
  PriorityLevel,
  ResearchStudy,
  TnaAssessment,
  TnaClassification,
} from '../shared/types';

export function TnaPage() {
  const { user, organizations } = useAuth();
  const { segments, departments, getName } = useOrgLookup(organizations);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [tnaList, setTnaList] = useState<TnaAssessment[]>([]);
  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [dnaList, setDnaList] = useState<DnaAssessment[]>([]);
  const [classificationFilter, setClassificationFilter] = useState<'all' | TnaClassification>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tnaClassification: 'TNA_KORPORAT' as TnaClassification,
    researchStudyId: '',
    dnaId: '',
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
    professionName: '',
    requiredCompetency: '',
    actualLevel: 2,
    targetLevel: 4,
    priority: 'high' as PriorityLevel,
    participantCount: 40,
    proposedTraining: '',
    hasValidGapEvidence: true,
    evidenceNote: '',
    verificationStatus: 'Draft' as AnalysisPublishStatus,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = classificationFilter !== 'all' ? `?classification=${classificationFilter}` : '';
      const [tnaRes, stRes, dnaRes] = await Promise.all([
        apiRequest<{ tnaList: TnaAssessment[] }>(`/api/v1/tna${qs}`),
        apiRequest<{ studies: ResearchStudy[] }>('/api/v1/research'),
        apiRequest<{ dnaList: DnaAssessment[] }>('/api/v1/dna'),
      ]);
      setTnaList(tnaRes.tnaList || []);
      setStudies(stRes.studies || []);
      setDnaList(dnaRes.dnaList || []);
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
      setError(err instanceof Error ? err.message : 'Gagal memuat data TNA.');
    } finally {
      setLoading(false);
    }
  }, [classificationFilter, form.researchStudyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await apiRequest('/api/v1/tna', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          dnaId: form.dnaId || undefined,
          actualLevel: Number(form.actualLevel),
          targetLevel: Number(form.targetLevel),
          participantCount: Number(form.participantCount),
        }),
      });
      setShowForm(false);
      setNotice('Data TNA berhasil disimpan.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan TNA.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, verificationStatus: AnalysisPublishStatus) => {
    setError('');
    try {
      await apiRequest(`/api/v1/tna/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ verificationStatus }),
      });
      setNotice(`Status verifikasi TNA diperbarui menjadi ${verificationStatus}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status TNA.');
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Training Need Analysis (TNA)' },
      ]}
      actions={
        isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah TNA Korporat / Unit</span>
          </button>
        )
      }
    >
      <div className="space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white">Training Need Analysis (TNA Korporat &amp; TNA Unit)</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Identifikasi kebutuhan pembelajaran tingkat korporat dan unit bisnis berdasarkan gap kompetensi terverifikasi sebelum menghasilkan rekomendasi pelatihan.
            </p>
          </div>

          <div className="flex gap-2 text-xs shrink-0">
            {([
              { id: 'all', label: 'Semua TNA' },
              { id: 'TNA_KORPORAT', label: 'TNA Korporat' },
              { id: 'TNA_UNIT', label: 'TNA Unit' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setClassificationFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg border font-medium ${
                  classificationFilter === tab.id
                    ? 'bg-blue-600/20 border-cyan-500 text-cyan-200'
                    : 'bg-[#080E1A] border-slate-700 text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
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
          <form onSubmit={handleCreate} className="bg-[#0F172A] border border-blue-700/50 rounded-xl p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-white">Tambah Kebutuhan TNA</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={form.tnaClassification}
                onChange={(e) => setForm({ ...form, tnaClassification: e.target.value as TnaClassification })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="TNA_KORPORAT">TNA Korporat</option>
                <option value="TNA_UNIT">TNA Unit</option>
              </select>

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
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="">Pilih Penelitian LNA...</option>
                {studies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studyCode} — {s.title}
                  </option>
                ))}
              </select>

              <select
                value={form.dnaId}
                onChange={(e) => setForm({ ...form, dnaId: e.target.value })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="">Tautkan DNA (Opsional)</option>
                {dnaList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.futureCapabilityNeed}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                required
                value={form.proposedTraining}
                onChange={(e) => setForm({ ...form, proposedTraining: e.target.value })}
                placeholder="Judul Program / Usulan Pelatihan *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <input
                required
                value={form.requiredCompetency}
                onChange={(e) => setForm({ ...form, requiredCompetency: e.target.value })}
                placeholder="Kompetensi yang Dibutuhkan *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <input
                required
                value={form.professionName}
                onChange={(e) => setForm({ ...form, professionName: e.target.value })}
                placeholder="Profesi / Sasaran Jabatan *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <input
                type="number"
                min={1}
                max={5}
                value={form.actualLevel}
                onChange={(e) => setForm({ ...form, actualLevel: Number(e.target.value) })}
                placeholder="Level Aktual"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <input
                type="number"
                min={1}
                max={5}
                value={form.targetLevel}
                onChange={(e) => setForm({ ...form, targetLevel: Number(e.target.value) })}
                placeholder="Level Target"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <input
                type="number"
                min={1}
                value={form.participantCount}
                onChange={(e) => setForm({ ...form, participantCount: Number(e.target.value) })}
                placeholder="Jumlah Peserta"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as PriorityLevel })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="low">Rendah</option>
                <option value="medium">Sedang</option>
                <option value="high">Tinggi</option>
                <option value="critical">Kritis</option>
              </select>
              <select
                value={form.verificationStatus}
                onChange={(e) => setForm({ ...form, verificationStatus: e.target.value as AnalysisPublishStatus })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="Draft">Draft</option>
                <option value="Terverifikasi">Terverifikasi</option>
                <option value="Disetujui">Disetujui</option>
                <option value="Dipublikasikan">Dipublikasikan</option>
              </select>
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

            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={form.hasValidGapEvidence}
                onChange={(e) => setForm({ ...form, hasValidGapEvidence: e.target.checked })}
                className="rounded border-slate-600 bg-[#080E1A]"
              />
              <span>Memiliki bukti gap kompetensi valid (syarat pembuatan rekomendasi pelatihan)</span>
            </label>

            <textarea
              rows={2}
              value={form.evidenceNote}
              onChange={(e) => setForm({ ...form, evidenceNote: e.target.value })}
              placeholder="Catatan bukti gap / alasan intervensi..."
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
                {saving ? 'Menyimpan...' : 'Simpan TNA'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="h-44 rounded-xl bg-[#0F172A] border border-slate-800 animate-pulse" />
        ) : tnaList.length === 0 ? (
          <div className="bg-[#0F172A] border border-dashed border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
            <Target className="w-7 h-7 text-slate-500 mx-auto mb-2" />
            Belum ada data TNA sesuai filter dan hak akses Anda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tnaList.map((tna) => (
              <div key={tna.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-cyan-300">
                      {tna.tnaClassification === 'TNA_KORPORAT' ? 'TNA KORPORAT' : 'TNA UNIT'}
                    </span>
                    <StatusLabel status={tna.verificationStatus} />
                    <PriorityLabel priority={tna.priority} />
                  </div>
                  <span className="text-xs font-mono-tabular text-slate-300">{tna.participantCount} peserta</span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-white">{tna.proposedTraining}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {tna.professionName} · {tna.requiredCompetency} · {getName(tna.departmentId)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-[#080E1A] border border-slate-800 rounded-lg p-2.5 text-xs">
                  <div>
                    <div className="text-[11px] text-slate-400">Aktual</div>
                    <div className="font-bold text-white tabular-nums">{tna.actualLevel}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Target</div>
                    <div className="font-bold text-cyan-300 tabular-nums">{tna.targetLevel}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Gap</div>
                    <div className="font-bold text-amber-300 tabular-nums">+{tna.competencyGap}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <ShieldCheck
                    className={`w-4 h-4 shrink-0 ${tna.hasValidGapEvidence ? 'text-emerald-400' : 'text-amber-400'}`}
                  />
                  <span className={tna.hasValidGapEvidence ? 'text-emerald-300' : 'text-amber-300'}>
                    {tna.hasValidGapEvidence
                      ? 'Bukti gap tervalidasi (siap rekomendasi pelatihan)'
                      : 'Tanpa bukti gap valid (diarahkan ke intervensi non-pelatihan)'}
                  </span>
                </div>
                {tna.evidenceNote && <p className="text-xs text-slate-400">{tna.evidenceNote}</p>}

                {isSuperAdmin && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2 text-xs">
                    <span className="text-slate-400">Verifikasi:</span>
                    <select
                      value={tna.verificationStatus}
                      onChange={(e) => void handleStatusChange(tna.id, e.target.value as AnalysisPublishStatus)}
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
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
