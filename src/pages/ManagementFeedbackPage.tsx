import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, MessageSquarePlus, Send } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PriorityLabel, StatusLabel, formatShortDate } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { FeedbackStatus, ManagementFeedback, PriorityLevel, ResearchStudy } from '../shared/types';

export function ManagementFeedbackPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isManagement = user?.role === 'MANAGEMENT';

  const [feedback, setFeedback] = useState<ManagementFeedback[]>([]);
  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create form for MANAGEMENT
  const [selectedStudyId, setSelectedStudyId] = useState('');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [improvementSuggestion, setImprovementSuggestion] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('high');
  const [submitting, setSubmitting] = useState(false);

  // Admin responses
  const [drafts, setDrafts] = useState<
    Record<string, { status: FeedbackStatus; adminResponse: string; decisionReason: string }>
  >({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fbRes, stRes] = await Promise.all([
        apiRequest<{ feedback: ManagementFeedback[] }>('/api/v1/management-feedback'),
        apiRequest<{ studies: ResearchStudy[] }>('/api/v1/research'),
      ]);
      setFeedback(fbRes.feedback || []);
      setStudies(stRes.studies || []);
      if ((stRes.studies || []).length > 0 && !selectedStudyId) {
        setSelectedStudyId(stRes.studies[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat masukan Management.');
    } finally {
      setLoading(false);
    }
  }, [selectedStudyId]);

  useEffect(() => {
    if (user?.role !== 'USER') {
      void loadData();
    } else {
      setLoading(false);
    }
  }, [user?.role, loadData]);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await apiRequest('/api/v1/management-feedback', {
        method: 'POST',
        body: JSON.stringify({
          researchStudyId: selectedStudyId,
          title: title.trim(),
          comment: comment.trim(),
          improvementSuggestion: improvementSuggestion.trim(),
          priority,
        }),
      });
      setTitle('');
      setComment('');
      setImprovementSuggestion('');
      setNotice('Masukan Management berhasil dikirim.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim masukan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    setError('');
    try {
      await apiRequest(`/api/v1/management-feedback/${id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify(d),
      });
      setNotice('Tanggapan dan status masukan berhasil diperbarui.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tanggapan.');
    }
  };

  if (user?.role === 'USER') {
    return (
      <AppShell breadcrumbs={[{ label: 'Masukan Management' }]}>
        <div className="bg-[#0F172A] border border-rose-800/60 rounded-xl p-10 text-center space-y-3">
          <Lock className="w-8 h-8 text-rose-400 mx-auto" />
          <h1 className="text-lg font-semibold text-white">Akses Ditolak</h1>
          <p className="text-xs text-slate-300">Peran User tidak memiliki akses ke modul Masukan Management.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Masukan Management' },
      ]}
    >
      <div className="space-y-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
          <h1 className="text-xl font-bold text-white">Masukan Management terhadap Penelitian LNA</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Kanal resmi Management untuk menyampaikan masukan perbaikan dan melacak status tindak lanjut (Baru → Ditinjau → Ditindaklanjuti → Selesai) oleh Super Admin PLN CORPU.
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

        {isManagement && (
          <form onSubmit={handleSubmitFeedback} className="bg-[#0F172A] border border-amber-700/50 rounded-xl p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <MessageSquarePlus className="w-4 h-4" />
              <span>BERIKAN MASUKAN PENELITIAN LNA</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                required
                value={selectedStudyId}
                onChange={(e) => setSelectedStudyId(e.target.value)}
                className="md:col-span-2 px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                {studies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studyCode} — {s.title} ({s.status})
                  </option>
                ))}
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="low">Prioritas Rendah</option>
                <option value="medium">Prioritas Sedang</option>
                <option value="high">Prioritas Tinggi</option>
                <option value="critical">Prioritas Kritis</option>
              </select>
            </div>

            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul Masukan..."
              className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
            />
            <textarea
              required
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Komentar evaluasi penelitian LNA..."
              className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
            />
            <textarea
              required
              rows={2}
              value={improvementSuggestion}
              onChange={(e) => setImprovementSuggestion(e.target.value)}
              placeholder="Saran perbaikan yang diharapkan..."
              className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !selectedStudyId}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-semibold rounded-lg"
              >
                {submitting ? 'Mengirim...' : 'Kirim Masukan'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="h-40 rounded-xl bg-[#0F172A] border border-slate-800 animate-pulse" />
        ) : feedback.length === 0 ? (
          <div className="bg-[#0F172A] border border-dashed border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
            Belum ada catatan masukan Management.
          </div>
        ) : (
          <div className="space-y-3">
            {feedback.map((fb) => {
              const study = studies.find((s) => s.id === fb.researchStudyId);
              const draft = drafts[fb.id] || {
                status: fb.status,
                adminResponse: fb.adminResponse || '',
                decisionReason: fb.decisionReason || '',
              };
              return (
                <article key={fb.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{fb.title}</span>
                      <StatusLabel status={fb.status} />
                      <PriorityLabel priority={fb.priority} />
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {fb.submittedByName} · {formatShortDate(fb.createdAt)}
                    </span>
                  </div>

                  {study && (
                    <div className="text-xs">
                      Penelitian:{' '}
                      <Link to={`/lna/${study.id}`} className="text-cyan-400 hover:text-cyan-300 font-medium">
                        {study.studyCode} — {study.title}
                      </Link>
                    </div>
                  )}

                  <p className="text-xs text-slate-200">{fb.comment}</p>
                  <div className="text-xs text-cyan-300">
                    Saran Perbaikan: <span className="text-slate-300">{fb.improvementSuggestion}</span>
                  </div>

                  {fb.adminResponse && (
                    <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 text-xs space-y-1">
                      <div className="font-semibold text-emerald-300">
                        Tanggapan Super Admin ({fb.respondedByName || 'Super Admin'}):
                      </div>
                      <div className="text-slate-200">{fb.adminResponse}</div>
                      {fb.decisionReason && (
                        <div className="text-slate-400">Alasan Keputusan: {fb.decisionReason}</div>
                      )}
                    </div>
                  )}

                  {isSuperAdmin && (
                    <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
                      <select
                        value={draft.status}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [fb.id]: { ...draft, status: e.target.value as FeedbackStatus },
                          }))
                        }
                        className="px-2.5 py-1.5 bg-[#080E1A] border border-slate-700 rounded text-white"
                      >
                        <option value="Baru">Baru</option>
                        <option value="Ditinjau">Ditinjau</option>
                        <option value="Ditindaklanjuti">Ditindaklanjuti</option>
                        <option value="Selesai">Selesai</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Tanggapan Super Admin..."
                        value={draft.adminResponse}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [fb.id]: { ...draft, adminResponse: e.target.value },
                          }))
                        }
                        className="px-2.5 py-1.5 bg-[#080E1A] border border-slate-700 rounded text-white"
                      />
                      <input
                        type="text"
                        placeholder="Alasan keputusan..."
                        value={draft.decisionReason}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [fb.id]: { ...draft, decisionReason: e.target.value },
                          }))
                        }
                        className="px-2.5 py-1.5 bg-[#080E1A] border border-slate-700 rounded text-white"
                      />
                      <button
                        type="button"
                        onClick={() => void handleRespond(fb.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded inline-flex items-center justify-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Perbarui Status</span>
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
