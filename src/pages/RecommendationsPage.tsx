import React, { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PriorityLabel, StatusLabel, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type {
  DeliveryMethod,
  LearningPath,
  LearningRecommendation,
  PriorityLevel,
  ResearchStudy,
  TnaAssessment,
} from '../shared/types';

const DELIVERY_OPTIONS: DeliveryMethod[] = [
  'In-Class Training',
  'Digital Learning',
  'Blended Learning',
  'Coaching & Mentoring',
  'Action Learning',
  'Workshop & Simulasi',
  'Intervensi Non-Pelatihan',
];

export function RecommendationsPage() {
  const { user, organizations } = useAuth();
  const { segments, departments, getName } = useOrgLookup(organizations);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([]);
  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [tnaList, setTnaList] = useState<TnaAssessment[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    programTitle: '',
    needSource: 'TNA' as 'LNA' | 'CCA' | 'DNA' | 'TNA' | 'PESTEL',
    researchStudyId: '',
    tnaId: '',
    learningPathId: '',
    professionDesignRef: '',
    targetCompetency: '',
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
    targetAudience: '',
    priority: 'high' as PriorityLevel,
    deliveryMethods: ['Blended Learning'] as DeliveryMethod[],
    isNonTrainingIntervention: false,
    nonTrainingNote: '',
    followUpPlan: '',
    estimatedParticipants: 30,
    approvalStatus: 'Menunggu Persetujuan' as LearningRecommendation['approvalStatus'],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [recRes, stRes, tnaRes, lpRes] = await Promise.all([
        apiRequest<{ recommendations: LearningRecommendation[] }>('/api/v1/recommendations'),
        apiRequest<{ studies: ResearchStudy[] }>('/api/v1/research'),
        apiRequest<{ tnaList: TnaAssessment[] }>('/api/v1/tna'),
        apiRequest<{ learningPaths: LearningPath[] }>('/api/v1/learning-paths'),
      ]);
      setRecommendations(recRes.recommendations || []);
      setStudies(stRes.studies || []);
      setTnaList(tnaRes.tnaList || []);
      setPaths(lpRes.learningPaths || []);
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
      setError(err instanceof Error ? err.message : 'Gagal memuat rekomendasi pembelajaran.');
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
      await apiRequest('/api/v1/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          tnaId: form.tnaId || undefined,
          learningPathId: form.learningPathId || undefined,
          estimatedParticipants: Number(form.estimatedParticipants),
        }),
      });
      setShowForm(false);
      setNotice('Rekomendasi pembelajaran berhasil ditambahkan.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan rekomendasi.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, approvalStatus: LearningRecommendation['approvalStatus']) => {
    setError('');
    try {
      await apiRequest(`/api/v1/recommendations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus }),
      });
      setNotice(`Status rekomendasi diperbarui menjadi ${approvalStatus}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui status rekomendasi.');
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Rekomendasi Pembelajaran' },
      ]}
      actions={
        isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Rekomendasi</span>
          </button>
        )
      }
    >
      <div className="space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
          <h1 className="text-xl font-bold text-white">Rekomendasi Pembelajaran &amp; Intervensi Non-Pelatihan</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Rekomendasi terintegrasi dari hasil LNA, CCA, DNA, dan TNA. Program pelatihan mewajibkan bukti gap TNA yang valid, atau diarahkan sebagai intervensi non-pelatihan.
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
          <form onSubmit={handleCreate} className="bg-[#0F172A] border border-blue-700/50 rounded-xl p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-white">Tambah Rekomendasi Pembelajaran</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                required
                value={form.programTitle}
                onChange={(e) => setForm({ ...form, programTitle: e.target.value })}
                placeholder="Judul Program / Intervensi *"
                className="md:col-span-2 px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <select
                value={form.needSource}
                onChange={(e) => setForm({ ...form, needSource: e.target.value as 'LNA' | 'CCA' | 'DNA' | 'TNA' | 'PESTEL' })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="TNA">Sumber: TNA</option>
                <option value="LNA">Sumber: LNA</option>
                <option value="DNA">Sumber: DNA</option>
                <option value="CCA">Sumber: CCA</option>
                <option value="PESTEL">Sumber: PESTEL</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                value={form.tnaId}
                onChange={(e) => setForm({ ...form, tnaId: e.target.value })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="">Pilih TNA Referensi (Opsional)</option>
                {tnaList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.proposedTraining} ({t.hasValidGapEvidence ? 'Gap Valid' : 'Tanpa Bukti Gap'})
                  </option>
                ))}
              </select>

              <select
                value={form.learningPathId}
                onChange={(e) => setForm({ ...form, learningPathId: e.target.value })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="">Tautkan Learning Path (Opsional)</option>
                {paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                required
                value={form.targetCompetency}
                onChange={(e) => setForm({ ...form, targetCompetency: e.target.value })}
                placeholder="Kompetensi Target *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <input
                required
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                placeholder="Peserta Sasaran *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <input
                type="number"
                min={1}
                value={form.estimatedParticipants}
                onChange={(e) => setForm({ ...form, estimatedParticipants: Number(e.target.value) })}
                placeholder="Estimasi Peserta"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as PriorityLevel })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="low">Prioritas Rendah</option>
                <option value="medium">Prioritas Sedang</option>
                <option value="high">Prioritas Tinggi</option>
                <option value="critical">Prioritas Kritis</option>
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

            <div className="space-y-1.5">
              <label className="text-slate-300">Metode Penyampaian</label>
              <div className="flex flex-wrap gap-2">
                {DELIVERY_OPTIONS.map((m) => {
                  const active = form.deliveryMethods.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          deliveryMethods: active
                            ? prev.deliveryMethods.filter((d) => d !== m)
                            : [...prev.deliveryMethods, m],
                        }))
                      }
                      className={`px-2.5 py-1 rounded border ${
                        active
                          ? 'bg-cyan-600/20 border-cyan-500 text-cyan-200'
                          : 'bg-[#080E1A] border-slate-700 text-slate-400'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={form.isNonTrainingIntervention}
                onChange={(e) => setForm({ ...form, isNonTrainingIntervention: e.target.checked })}
                className="rounded border-slate-600 bg-[#080E1A]"
              />
              <span>Intervensi Non-Pelatihan (Penyelarasan SOP, job aid, coaching operasional)</span>
            </label>

            {form.isNonTrainingIntervention && (
              <input
                value={form.nonTrainingNote}
                onChange={(e) => setForm({ ...form, nonTrainingNote: e.target.value })}
                placeholder="Catatan Intervensi Non-Pelatihan..."
                className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
            )}

            <textarea
              rows={2}
              value={form.followUpPlan}
              onChange={(e) => setForm({ ...form, followUpPlan: e.target.value })}
              placeholder="Rencana Tindak Lanjut & Evaluasi Dampak..."
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
                {saving ? 'Menyimpan...' : 'Simpan Rekomendasi'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="h-44 rounded-xl bg-[#0F172A] border border-slate-800 animate-pulse" />
        ) : recommendations.length === 0 ? (
          <div className="bg-[#0F172A] border border-dashed border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
            <GraduationCap className="w-7 h-7 text-slate-500 mx-auto mb-2" />
            Belum ada rekomendasi pembelajaran yang dapat diakses pada peran Anda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec) => (
              <article key={rec.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusLabel status={rec.approvalStatus} />
                    <PriorityLabel priority={rec.priority} />
                    <span className="text-[11px] text-cyan-300 font-semibold">Sumber: {rec.needSource}</span>
                  </div>
                  <span className="text-xs font-mono-tabular text-slate-300">{rec.estimatedParticipants} peserta</span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-white">{rec.programTitle}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {getName(rec.businessSegmentId)} → {getName(rec.departmentId)} · Sasaran: {rec.targetAudience}
                  </div>
                </div>

                <div className="text-xs text-slate-300">
                  <span className="text-slate-400">Kompetensi Target: </span>
                  {rec.targetCompetency}
                </div>

                <div className="text-xs text-cyan-300">
                  Metode: <span className="text-slate-200">{rec.deliveryMethods.join(', ')}</span>
                </div>

                {rec.isNonTrainingIntervention && (
                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200">
                    Intervensi Non-Pelatihan: {rec.nonTrainingNote || 'Evaluasi operasional & SOP'}
                  </div>
                )}

                {rec.followUpPlan && <p className="text-xs text-slate-400">{rec.followUpPlan}</p>}

                {isSuperAdmin && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2 text-xs">
                    <span className="text-slate-400">Persetujuan:</span>
                    <select
                      value={rec.approvalStatus}
                      onChange={(e) =>
                        void handleStatusChange(
                          rec.id,
                          e.target.value as LearningRecommendation['approvalStatus'],
                        )
                      }
                      className="px-2.5 py-1 bg-[#080E1A] border border-slate-700 rounded text-white"
                    >
                      <option value="Usulan AI">Usulan AI</option>
                      <option value="Menunggu Persetujuan">Menunggu Persetujuan</option>
                      <option value="Disetujui">Disetujui</option>
                      <option value="Dipublikasikan">Dipublikasikan</option>
                      <option value="Ditolak">Ditolak</option>
                    </select>
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
