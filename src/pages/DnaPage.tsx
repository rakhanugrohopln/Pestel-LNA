import React, { useCallback, useEffect, useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PriorityLabel, StatusLabel, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { AnalysisPublishStatus, DnaAssessment, PriorityLevel, ResearchStudy } from '../shared/types';

export function DnaPage() {
  const { user, organizations } = useAuth();
  const { segments, departments, getName } = useOrgLookup(organizations);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [dnaList, setDnaList] = useState<DnaAssessment[]>([]);
  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    researchStudyId: '',
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
    futureCapabilityNeed: '',
    currentCondition: '',
    targetCondition: '',
    developmentGap: '',
    priority: 'high' as PriorityLevel,
    supportingEvidence: '',
    recommendation: '',
    status: 'Draft' as AnalysisPublishStatus,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dnaRes, stRes] = await Promise.all([
        apiRequest<{ dnaList: DnaAssessment[] }>('/api/v1/dna'),
        apiRequest<{ studies: ResearchStudy[] }>('/api/v1/research'),
      ]);
      setDnaList(dnaRes.dnaList || []);
      setStudies(stRes.studies || []);
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
      setError(err instanceof Error ? err.message : 'Gagal memuat data DNA.');
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
      await apiRequest('/api/v1/dna', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm((prev) => ({
        ...prev,
        futureCapabilityNeed: '',
        currentCondition: '',
        targetCondition: '',
        developmentGap: '',
        supportingEvidence: '',
        recommendation: '',
      }));
      setNotice('Penilaian Developmental Need Analysis (DNA) berhasil disimpan.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan DNA.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: AnalysisPublishStatus) => {
    setError('');
    try {
      await apiRequest(`/api/v1/dna/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(`Status DNA diperbarui menjadi ${status}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui status DNA.');
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Developmental Need Analysis (DNA)' },
      ]}
      actions={
        isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Analisis DNA</span>
          </button>
        )
      }
    >
      <div className="space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
          <h1 className="text-xl font-bold text-white">Developmental Need Analysis (DNA)</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Analisis kapabilitas masa depan dibandingkan kondisi aktual organisasi. Kesimpulan gap pengembangan ditolak otomatis apabila kondisi aktual belum terdokumentasi.
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
            <h2 className="text-sm font-semibold text-white">Tambah Penilaian DNA</h2>

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                required
                value={form.futureCapabilityNeed}
                onChange={(e) => setForm({ ...form, futureCapabilityNeed: e.target.value })}
                placeholder="Kebutuhan Kapabilitas Masa Depan *"
                className="md:col-span-2 px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <textarea
                rows={2}
                value={form.currentCondition}
                onChange={(e) => setForm({ ...form, currentCondition: e.target.value })}
                placeholder="Kondisi Aktual (Wajib >= 15 karakter sebelum menyimpulkan gap)"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <textarea
                rows={2}
                value={form.targetCondition}
                onChange={(e) => setForm({ ...form, targetCondition: e.target.value })}
                placeholder="Kondisi Target Masa Depan *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <textarea
                rows={2}
                value={form.developmentGap}
                onChange={(e) => setForm({ ...form, developmentGap: e.target.value })}
                placeholder="Kesimpulan Gap Pengembangan *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <textarea
                required
                rows={2}
                value={form.supportingEvidence}
                onChange={(e) => setForm({ ...form, supportingEvidence: e.target.value })}
                placeholder="Bukti Pendukung & Dokumen *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
            </div>

            <textarea
              required
              rows={2}
              value={form.recommendation}
              onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
              placeholder="Rekomendasi Tindak Lanjut DNA *"
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
                {saving ? 'Menyimpan...' : 'Simpan DNA'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="h-44 rounded-xl bg-[#0F172A] border border-slate-800 animate-pulse" />
        ) : dnaList.length === 0 ? (
          <div className="bg-[#0F172A] border border-dashed border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
            <TrendingUp className="w-7 h-7 text-slate-500 mx-auto mb-2" />
            Belum ada penilaian DNA yang tersedia pada cakupan Anda.
          </div>
        ) : (
          <div className="space-y-4">
            {dnaList.map((dna) => (
              <article key={dna.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusLabel status={dna.status} />
                    <PriorityLabel priority={dna.priority} />
                    <span className="text-xs text-slate-400">
                      {getName(dna.businessSegmentId)} · {getName(dna.departmentId)}
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-white">{dna.futureCapabilityNeed}</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800">
                    <div className="text-[11px] text-slate-400">Kondisi Aktual</div>
                    <div className="text-slate-200 mt-1">{dna.currentCondition}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800">
                    <div className="text-[11px] text-cyan-400">Kondisi Target</div>
                    <div className="text-slate-200 mt-1">{dna.targetCondition}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800">
                    <div className="text-[11px] text-amber-400">Gap Pengembangan</div>
                    <div className="text-slate-200 mt-1">{dna.developmentGap}</div>
                  </div>
                </div>

                <div className="text-xs text-slate-300">
                  <span className="text-slate-400">Bukti Pendukung: </span>
                  {dna.supportingEvidence}
                </div>
                <div className="text-xs text-emerald-300">
                  Rekomendasi DNA: <span className="text-slate-200">{dna.recommendation}</span>
                </div>

                {isSuperAdmin && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2 text-xs">
                    <span className="text-slate-400">Status:</span>
                    <select
                      value={dna.status}
                      onChange={(e) => void handleStatusChange(dna.id, e.target.value as AnalysisPublishStatus)}
                      className="px-2.5 py-1 bg-[#080E1A] border border-slate-700 rounded text-white"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Terverifikasi">Terverifikasi</option>
                      <option value="Disetujui">Disetujui</option>
                      <option value="Dipublikasikan">Dipublikasikan</option>
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
