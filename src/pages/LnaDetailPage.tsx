import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Lock,
  MessageSquarePlus,
  Send,
  X,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PriorityLabel, StatusLabel, formatShortDate, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiRequest } from '../lib/api';
import type {
  CcaAssessment,
  DnaAssessment,
  FeedbackStatus,
  LearningRecommendation,
  ManagementFeedback,
  PestelIssue,
  PriorityLevel,
  ResearchStatus,
  ResearchStudy,
  TnaAssessment,
} from '../shared/types';

interface StudyDetailResponse {
  study: ResearchStudy;
  linkedPestel: PestelIssue[];
  cca: CcaAssessment[];
  dna: DnaAssessment[];
  tna: TnaAssessment[];
  recommendations: LearningRecommendation[];
  feedback: ManagementFeedback[];
}

export function LnaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, organizations } = useAuth();
  const { getName } = useOrgLookup(organizations);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isManagement = user?.role === 'MANAGEMENT';

  const [data, setData] = useState<StudyDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [notice, setNotice] = useState('');

  // Management Feedback Modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [fbTitle, setFbTitle] = useState('');
  const [fbComment, setFbComment] = useState('');
  const [fbSuggestion, setFbSuggestion] = useState('');
  const [fbPriority, setFbPriority] = useState<PriorityLevel>('high');
  const [submittingFb, setSubmittingFb] = useState(false);

  // Admin Feedback Response
  const [responseForms, setResponseForms] = useState<
    Record<string, { status: FeedbackStatus; adminResponse: string; decisionReason: string }>
  >({});

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setAccessDenied(false);
    try {
      const res = await apiRequest<StudyDetailResponse>(`/api/v1/research/${id}`);
      setData(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setAccessDenied(true);
      }
      setError(err instanceof Error ? err.message : 'Gagal memuat detail penelitian.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleStatusChange = async (status: ResearchStatus) => {
    if (!id) return;
    setError('');
    try {
      await apiRequest(`/api/v1/research/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(`Status penelitian diubah menjadi ${status}.`);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status penelitian.');
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError('');
    setSubmittingFb(true);
    try {
      await apiRequest('/api/v1/management-feedback', {
        method: 'POST',
        body: JSON.stringify({
          researchStudyId: id,
          title: fbTitle.trim(),
          comment: fbComment.trim(),
          improvementSuggestion: fbSuggestion.trim(),
          priority: fbPriority,
        }),
      });
      setShowFeedbackModal(false);
      setFbTitle('');
      setFbComment('');
      setFbSuggestion('');
      setNotice('Masukan Management berhasil dikirim ke Super Admin PLN CORPU.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim masukan.');
    } finally {
      setSubmittingFb(false);
    }
  };

  const handleRespondFeedback = async (fbId: string) => {
    const form = responseForms[fbId];
    if (!form) return;
    setError('');
    try {
      await apiRequest(`/api/v1/management-feedback/${fbId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setNotice('Tanggapan masukan berhasil disimpan.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menanggapi masukan.');
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Penelitian LNA', to: '/lna' },
        { label: data?.study.studyCode || 'Detail Penelitian' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          {isManagement && data && (
            <button
              type="button"
              onClick={() => setShowFeedbackModal(true)}
              className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg inline-flex items-center gap-1.5"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>BERIKAN MASUKAN</span>
            </button>
          )}
          <Link
            to="/lna"
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </Link>
        </div>
      }
    >
      {loading ? (
        <div className="h-64 rounded-xl bg-[#0F172A] border border-slate-800 animate-pulse" />
      ) : accessDenied ? (
        <div className="bg-[#0F172A] border border-rose-800/60 rounded-xl p-10 text-center space-y-3">
          <Lock className="w-8 h-8 text-rose-400 mx-auto" />
          <h1 className="text-lg font-semibold text-white">Akses Dokumen Ditolak (403)</h1>
          <p className="text-xs text-slate-300 max-w-md mx-auto">{error}</p>
          <Link
            to="/lna"
            className="inline-block px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
          >
            Kembali ke Daftar LNA
          </Link>
        </div>
      ) : !data ? (
        <div className="p-6 rounded-xl bg-[#0F172A] border border-slate-800 text-sm text-slate-300">
          {error || 'Penelitian LNA tidak ditemukan.'}
        </div>
      ) : (
        <div className="space-y-6">
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

          {/* Header Summary */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono-tabular font-semibold text-cyan-300">
                    {data.study.studyCode}
                  </span>
                  <StatusLabel status={data.study.status} />
                  <PriorityLabel priority={data.study.priority} />
                  <span className="text-xs text-slate-400">Tahun {data.study.year}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">{data.study.title}</h1>
                <div className="text-xs text-slate-400">
                  {getName(data.study.businessSegmentId)} → {getName(data.study.departmentId)}
                  {data.study.unitId ? ` → ${getName(data.study.unitId)}` : ''} · Ketua Peneliti: {data.study.leadName}
                </div>
              </div>

              {isSuperAdmin && (
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400">Status Workflow</label>
                  <select
                    value={data.study.status}
                    onChange={(e) => void handleStatusChange(e.target.value as ResearchStatus)}
                    className="px-3 py-1.5 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                  >
                    {(['Draft', 'Dalam Analisis', 'Menunggu Masukan', 'Revisi', 'Disetujui', 'Dipublikasikan'] as ResearchStatus[]).map(
                      (st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80 text-xs sm:text-sm">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-cyan-300">Latar Belakang</div>
                <p className="text-slate-200 leading-relaxed">{data.study.background}</p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-cyan-300">Rumusan Masalah</div>
                <p className="text-slate-200 leading-relaxed">{data.study.problemStatement}</p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-cyan-300">Tujuan Penelitian</div>
                <p className="text-slate-200 leading-relaxed">{data.study.objectives}</p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-cyan-300">Analisis Kondisi Eksisting &amp; Organisasi</div>
                <p className="text-slate-200 leading-relaxed">
                  {data.study.currentConditionAnalysis} {data.study.orgNeedsAnalysis}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800">
                <div className="text-[11px] text-slate-400">Hasil LNA</div>
                <div className="text-xs text-slate-200 mt-1">{data.study.lnaResult || '-'}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800">
                <div className="text-[11px] text-slate-400">Ringkasan CCA</div>
                <div className="text-xs text-slate-200 mt-1">{data.study.ccaSummary || '-'}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800">
                <div className="text-[11px] text-slate-400">Ringkasan DNA</div>
                <div className="text-xs text-slate-200 mt-1">{data.study.dnaSummary || '-'}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800">
                <div className="text-[11px] text-slate-400">Ringkasan TNA &amp; Rekomendasi</div>
                <div className="text-xs text-slate-200 mt-1">
                  {data.study.tnaSummary || '-'} {data.study.developmentRecommendation}
                </div>
              </div>
            </div>

            {data.study.sourceUrls.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                <span className="text-slate-400">Referensi Sumber:</span>
                {data.study.sourceUrls.map((u) => (
                  <a
                    key={u}
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                  >
                    <span>{u}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Linked Learning Value Chain */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Isu PESTEL Terkait ({data.linkedPestel.length})</h2>
              {data.linkedPestel.length === 0 ? (
                <div className="text-xs text-slate-400">Belum ada isu PESTEL terhubung.</div>
              ) : (
                data.linkedPestel.map((p) => (
                  <div key={p.id} className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">{p.title}</span>
                      <StatusLabel status={p.status} />
                    </div>
                    <div className="text-[11px] text-cyan-300">{p.categories.join(', ')}</div>
                    <p className="text-xs text-slate-300">{p.summary}</p>
                  </div>
                ))
              )}
            </div>

            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">
                CCA ({data.cca.length}) · DNA ({data.dna.length}) · TNA ({data.tna.length})
              </h2>
              <div className="space-y-2.5 text-xs">
                {data.cca.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800 flex justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">CCA: {c.competencyName}</div>
                      <div className="text-slate-400">
                        {c.professionName} · Level {c.currentLevel} → {c.requiredLevel}
                      </div>
                    </div>
                    <StatusLabel status={c.status} />
                  </div>
                ))}
                {data.dna.map((d) => (
                  <div key={d.id} className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800 flex justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">DNA: {d.futureCapabilityNeed}</div>
                      <div className="text-slate-400">{d.developmentGap}</div>
                    </div>
                    <StatusLabel status={d.status} />
                  </div>
                ))}
                {data.tna.map((t) => (
                  <div key={t.id} className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800 flex justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">
                        {t.tnaClassification === 'TNA_KORPORAT' ? 'TNA Korporat' : 'TNA Unit'}: {t.proposedTraining}
                      </div>
                      <div className="text-slate-400">
                        {t.participantCount} peserta · Gap Level {t.competencyGap}
                      </div>
                    </div>
                    <StatusLabel status={t.verificationStatus} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Rekomendasi Pembelajaran ({data.recommendations.length})</h2>
            {data.recommendations.length === 0 ? (
              <div className="text-xs text-slate-400">Belum ada rekomendasi pembelajaran untuk penelitian ini.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.recommendations.map((rec) => (
                  <div key={rec.id} className="p-3.5 rounded-lg bg-[#080E1A] border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">{rec.programTitle}</span>
                      <StatusLabel status={rec.approvalStatus} />
                    </div>
                    <div className="text-[11px] text-cyan-300">
                      {rec.deliveryMethods.join(', ')} · {rec.estimatedParticipants} peserta
                    </div>
                    <div className="text-xs text-slate-400">{rec.targetAudience}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Management Feedback Section (hidden for USER) */}
          {user?.role !== 'USER' && (
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Masukan Management ({data.feedback.length})</h2>
                  <p className="text-xs text-slate-400">
                    Riwayat masukan perbaikan dari Management dan tindak lanjut Super Admin
                  </p>
                </div>
                {isManagement && (
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(true)}
                    className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg inline-flex items-center gap-1.5"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>BERIKAN MASUKAN</span>
                  </button>
                )}
              </div>

              {data.feedback.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-800 rounded-lg">
                  Belum ada masukan Management untuk penelitian ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.feedback.map((fb) => {
                    const draft = responseForms[fb.id] || {
                      status: fb.status,
                      adminResponse: fb.adminResponse || '',
                      decisionReason: fb.decisionReason || '',
                    };
                    return (
                      <div key={fb.id} className="p-4 rounded-lg bg-[#080E1A] border border-slate-800 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{fb.title}</span>
                            <StatusLabel status={fb.status} />
                            <PriorityLabel priority={fb.priority} />
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Oleh {fb.submittedByName} · {formatShortDate(fb.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200">{fb.comment}</p>
                        <div className="text-xs text-cyan-300">
                          Saran Perbaikan: <span className="text-slate-300">{fb.improvementSuggestion}</span>
                        </div>

                        {fb.adminResponse && (
                          <div className="p-3 rounded bg-slate-900/90 border border-slate-800 text-xs space-y-1">
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
                          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
                            <select
                              value={draft.status}
                              onChange={(e) =>
                                setResponseForms((prev) => ({
                                  ...prev,
                                  [fb.id]: { ...draft, status: e.target.value as FeedbackStatus },
                                }))
                              }
                              className="px-2.5 py-1.5 bg-[#0F172A] border border-slate-700 rounded text-white"
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
                                setResponseForms((prev) => ({
                                  ...prev,
                                  [fb.id]: { ...draft, adminResponse: e.target.value },
                                }))
                              }
                              className="px-2.5 py-1.5 bg-[#0F172A] border border-slate-700 rounded text-white"
                            />
                            <input
                              type="text"
                              placeholder="Alasan diterima/ditolak..."
                              value={draft.decisionReason}
                              onChange={(e) =>
                                setResponseForms((prev) => ({
                                  ...prev,
                                  [fb.id]: { ...draft, decisionReason: e.target.value },
                                }))
                              }
                              className="px-2.5 py-1.5 bg-[#0F172A] border border-slate-700 rounded text-white"
                            />
                            <button
                              type="button"
                              onClick={() => void handleRespondFeedback(fb.id)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded inline-flex items-center justify-center gap-1"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Simpan Tanggapan</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* BERIKAN MASUKAN Modal (MANAGEMENT only) */}
      {showFeedbackModal && isManagement && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Berikan Masukan Management</h2>
              <button
                type="button"
                aria-label="Tutup modal masukan"
                onClick={() => setShowFeedbackModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">Judul Masukan *</label>
                <input
                  required
                  value={fbTitle}
                  onChange={(e) => setFbTitle(e.target.value)}
                  placeholder="Contoh: Penambahan Skenario Simulasi Blackstart Grid"
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">Komentar Evaluasi *</label>
                <textarea
                  required
                  rows={3}
                  value={fbComment}
                  onChange={(e) => setFbComment(e.target.value)}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">Saran Perbaikan *</label>
                <textarea
                  required
                  rows={2}
                  value={fbSuggestion}
                  onChange={(e) => setFbSuggestion(e.target.value)}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">Tingkat Prioritas</label>
                <select
                  value={fbPriority}
                  onChange={(e) => setFbPriority(e.target.value as PriorityLevel)}
                  className="w-full px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                >
                  <option value="low">Rendah</option>
                  <option value="medium">Sedang</option>
                  <option value="high">Tinggi</option>
                  <option value="critical">Kritis</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingFb}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg"
                >
                  {submittingFb ? 'Mengirim...' : 'Kirim Masukan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
