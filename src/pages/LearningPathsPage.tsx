import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { StatusLabel, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { AnalysisPublishStatus, LearningPath } from '../shared/types';

export function LearningPathsPage() {
  const { user, organizations } = useAuth();
  const { segments, departments, getName } = useOrgLookup(organizations);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: 'LP-NEW-01',
    title: '',
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
    professionName: '',
    stagesText: 'Level 1: Fundamental\nLevel 2: Implementasi Unit\nLevel 3: Spesialis / Asesor',
    competenciesText: '',
    description: '',
    status: 'Disetujui' as AnalysisPublishStatus,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ learningPaths: LearningPath[] }>('/api/v1/learning-paths');
      setPaths(res.learningPaths || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat Learning Path.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const stages = form.stagesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const targetCompetencies = form.competenciesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await apiRequest('/api/v1/learning-paths', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim(),
          title: form.title.trim(),
          businessSegmentId: form.businessSegmentId,
          departmentId: form.departmentId,
          professionName: form.professionName.trim(),
          stages,
          targetCompetencies,
          description: form.description.trim(),
          status: form.status,
        }),
      });
      setShowForm(false);
      setNotice('Learning Path berhasil ditambahkan.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan Learning Path.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Learning Path' },
      ]}
      actions={
        isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Learning Path</span>
          </button>
        )
      }
    >
      <div className="space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
          <h1 className="text-xl font-bold text-white">Learning Path &amp; Kurikulum Profesi PLN</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Alur penjenjangan pembelajaran terstruktur berdasarkan Grand Design Profesi dan hasil analisis Learning Value Chain.
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
            <h2 className="text-sm font-semibold text-white">Tambah Learning Path</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Kode Learning Path *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Judul Learning Path *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <input
                required
                value={form.professionName}
                onChange={(e) => setForm({ ...form, professionName: e.target.value })}
                placeholder="Nama Profesi *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as AnalysisPublishStatus })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="Draft">Draft</option>
                <option value="Terverifikasi">Terverifikasi</option>
                <option value="Disetujui">Disetujui</option>
                <option value="Dipublikasikan">Dipublikasikan</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <textarea
                required
                rows={3}
                value={form.stagesText}
                onChange={(e) => setForm({ ...form, stagesText: e.target.value })}
                placeholder="Tahapan Pembelajaran (1 tahap per baris)"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <div className="space-y-2">
                <input
                  value={form.competenciesText}
                  onChange={(e) => setForm({ ...form, competenciesText: e.target.value })}
                  placeholder="Kompetensi Target (pisahkan dengan koma)"
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Deskripsi Learning Path..."
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

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
                {saving ? 'Menyimpan...' : 'Simpan Learning Path'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="h-44 rounded-xl bg-[#0F172A] border border-slate-800 animate-pulse" />
        ) : paths.length === 0 ? (
          <div className="bg-[#0F172A] border border-dashed border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
            <Layers className="w-7 h-7 text-slate-500 mx-auto mb-2" />
            Belum ada Learning Path yang tersedia.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paths.map((lp) => (
              <div key={lp.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono-tabular text-cyan-300 font-semibold">{lp.code}</span>
                  <StatusLabel status={lp.status} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{lp.title}</h3>
                  <div className="text-xs text-slate-400">
                    {lp.professionName} · {getName(lp.businessSegmentId)} → {getName(lp.departmentId)}
                  </div>
                </div>
                {lp.description && <p className="text-xs text-slate-300">{lp.description}</p>}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400">Tahapan Kurikulum:</div>
                  <ol className="space-y-1">
                    {lp.stages.map((st, idx) => (
                      <li
                        key={idx}
                        className="px-3 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-200 flex items-center gap-2"
                      >
                        <span className="w-5 h-5 rounded bg-blue-600/20 text-cyan-300 font-mono-tabular text-[11px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span>{st}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
