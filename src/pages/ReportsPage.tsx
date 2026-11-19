import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PriorityLabel, StatusLabel, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { LearningRecommendation, PestelIssue, ResearchStudy, TnaAssessment } from '../shared/types';

export function ReportsPage() {
  const { user, organizations } = useAuth();
  const { getName } = useOrgLookup(organizations);

  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [issues, setIssues] = useState<PestelIssue[]>([]);
  const [tnaList, setTnaList] = useState<TnaAssessment[]>([]);
  const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [sRes, pRes, tRes, rRes] = await Promise.all([
          apiRequest<{ studies: ResearchStudy[] }>('/api/v1/research'),
          apiRequest<{ issues: PestelIssue[] }>('/api/v1/pestel'),
          apiRequest<{ tnaList: TnaAssessment[] }>('/api/v1/tna'),
          apiRequest<{ recommendations: LearningRecommendation[] }>('/api/v1/recommendations'),
        ]);
        if (!cancelled) {
          setStudies(sRes.studies || []);
          setIssues(pRes.issues || []);
          setTnaList(tRes.tnaList || []);
          setRecommendations(rRes.recommendations || []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan laporan.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownload = async (format: 'csv' | 'json') => {
    setExporting(true);
    setError('');
    try {
      const data = await apiRequest<string | Record<string, unknown>>(`/api/v1/export?format=${format}`);
      const blob =
        format === 'csv'
          ? new Blob([String(data)], { type: 'text/csv;charset=utf-8;' })
          : new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'csv' ? 'plncorpu-lna-export.csv' : 'plncorpu-lna-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunduh laporan.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Laporan dan Dokumentasi' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleDownload('csv')}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleDownload('json')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor JSON</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
          <h1 className="text-xl font-bold text-white">Laporan dan Dokumentasi PLN CORPU</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Ekspor terotorisasi atas penelitian LNA, isu PESTEL, TNA, dan rekomendasi pembelajaran.
            {user?.role === 'USER' && ' Akun User hanya menerima dokumen berstatus Dipublikasikan.'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs">{error}</div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Penelitian LNA Siap Ekspor</div>
            <div className="mt-1 text-2xl font-bold text-white tabular-nums">{studies.length}</div>
          </div>
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Isu PESTEL Terotorisasi</div>
            <div className="mt-1 text-2xl font-bold text-white tabular-nums">{issues.length}</div>
          </div>
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Kebutuhan TNA</div>
            <div className="mt-1 text-2xl font-bold text-white tabular-nums">{tnaList.length}</div>
          </div>
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Rekomendasi Pembelajaran</div>
            <div className="mt-1 text-2xl font-bold text-white tabular-nums">{recommendations.length}</div>
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Daftar Dokumen Penelitian LNA Terotorisasi</h2>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-xs text-slate-400">Memuat data laporan...</div>
          ) : studies.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Belum ada dokumen penelitian untuk diekspor.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B1220] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Kode</th>
                    <th className="px-4 py-3 font-medium">Judul Penelitian</th>
                    <th className="px-4 py-3 font-medium">Bidang Bisnis &amp; Departemen</th>
                    <th className="px-4 py-3 font-medium">Tahun</th>
                    <th className="px-4 py-3 font-medium">Prioritas</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {studies.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono-tabular text-cyan-300 whitespace-nowrap">{s.studyCode}</td>
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/lna/${s.id}`} className="hover:text-cyan-300">
                          {s.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {getName(s.businessSegmentId)} · {getName(s.departmentId)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{s.year}</td>
                      <td className="px-4 py-3">
                        <PriorityLabel priority={s.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
