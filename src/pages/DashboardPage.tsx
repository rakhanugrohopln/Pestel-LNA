import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowUpRight,
  Award,
  FileSearch,
  GraduationCap,
  MessageSquarePlus,
  Newspaper,
  Target,
  TrendingUp,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PriorityLabel, StatusLabel, formatShortDate, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiRequest } from '../lib/api';
import type { ManagementFeedback, PestelIssue, ResearchStudy } from '../shared/types';

interface DashboardResponse {
  kpis: {
    totalResearchStudies: number;
    publishedStudies: number;
    totalPestelIssues: number;
    ccaCount: number;
    dnaCount: number;
    tnaTotalCount: number;
    tnaKorporatCount: number;
    tnaUnitCount: number;
    recommendationsCount: number;
    managementFeedbackCount: number;
    feedbackOpenCount: number;
  };
  charts: {
    researchBySegment: Array<{ id: string; name: string; studies: number; pestel: number }>;
    researchByDepartment: Array<{ id: string; name: string; studies: number; tna: number }>;
    pestelDistribution: Array<{ category: string; count: number }>;
    researchTrend: Array<{ year: string; count: number }>;
    tnaStatusDist: Array<{ status: string; count: number }>;
    feedbackStatusDist: Array<{ status: string; count: number }>;
  };
  recentStudies: ResearchStudy[];
  recentIssues: PestelIssue[];
  recentFeedback: ManagementFeedback[];
}

const CHART_COLORS = ['#06B6D4', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#F43F5E'];

export function DashboardPage() {
  const { user, loading: authLoading, organizations } = useAuth();
  const { segments, departments, getName } = useOrgLookup(organizations);

  const [segmentFilter, setSegmentFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

  const filteredDepartments =
    segmentFilter === 'all' ? departments : departments.filter((d) => d.businessSegmentId === segmentFilter);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (segmentFilter !== 'all') params.set('segmentId', segmentFilter);
        if (departmentFilter !== 'all') params.set('departmentId', departmentFilter);
        if (yearFilter !== 'all') params.set('year', yearFilter);
        const res = await apiRequest<DashboardResponse>(`/api/v1/dashboard?${params.toString()}`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          // Global 401 handler clears session and redirects cleanly to /login
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setError('Akses ditolak. Anda tidak memiliki izin untuk mengakses data Executive Dashboard ini.');
          return;
        }
        if (err instanceof ApiError && err.status >= 500) {
          setError('Terjadi gangguan layanan backend atau database. Silakan coba muat ulang beberapa saat lagi.');
          return;
        }
        setError(
          err instanceof Error
            ? `Gagal terhubung ke layanan data dashboard: ${err.message}`
            : 'Gagal terhubung ke layanan data dashboard.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, segmentFilter, departmentFilter, yearFilter, reloadNonce]);

  const roleSubtitle =
    user?.role === 'SUPER_ADMIN'
      ? 'Kendali penuh analitik PESTEL, LNA lintas departemen, CCA/DNA/TNA, dan persetujuan rekomendasi korporat.'
      : user?.role === 'MANAGEMENT'
        ? 'Pemantauan eksekutif hasil penelitian kebutuhan pembelajaran, isu PESTEL, dan penyampaian masukan strategis.'
        : 'Akses baca resmi terhadap hasil penelitian LNA, PESTEL, TNA, dan rekomendasi pembelajaran yang telah dipublikasikan.';

  return (
    <AppShell
      breadcrumbs={[{ label: 'Executive Dashboard' }]}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/lna"
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>Buka Penelitian LNA</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header & Filter Bar */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Executive Dashboard PLN CORPU
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">{roleSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full xl:w-auto xl:max-w-[560px]">
            <select
              aria-label="Filter Bidang Bisnis"
              value={segmentFilter}
              onChange={(e) => {
                setSegmentFilter(e.target.value);
                setDepartmentFilter('all');
              }}
              className="w-full min-w-0 px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400"
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
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full min-w-0 px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="all">Semua Departemen</option>
              {filteredDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter Tahun"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full min-w-0 px-3 py-2 text-xs bg-[#080E1A] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="all">Semua Tahun</option>
              <option value="2026">Tahun 2026</option>
              <option value="2025">Tahun 2025</option>
              <option value="2024">Tahun 2024</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-sm flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="px-3 py-1.5 text-xs font-medium bg-red-900/60 hover:bg-red-800/70 text-red-100 border border-red-700/60 rounded-lg transition-colors"
            >
              Muat Ulang Data
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-[#0F172A] border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          data && (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <Link
                  to="/lna"
                  className="bg-[#0F172A] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Penelitian LNA</span>
                    <FileSearch className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white tabular-nums">
                    {data.kpis.totalResearchStudies}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {data.kpis.publishedStudies} berstatus Dipublikasikan
                  </div>
                </Link>

                <Link
                  to="/pestel"
                  className="bg-[#0F172A] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Isu Strategis PESTEL</span>
                    <Newspaper className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white tabular-nums">
                    {data.kpis.totalPestelIssues}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Terpetakan ke bidang bisnis PLN
                  </div>
                </Link>

                <Link
                  to="/tna"
                  className="bg-[#0F172A] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>TNA (Korporat &amp; Unit)</span>
                    <Target className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white tabular-nums">
                    {data.kpis.tnaTotalCount}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Korporat: {data.kpis.tnaKorporatCount} · Unit: {data.kpis.tnaUnitCount}
                  </div>
                </Link>

                {user?.role === 'USER' ? (
                  <Link
                    to="/recommendations"
                    className="bg-[#0F172A] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-xs">
                      <span>Rekomendasi Pembelajaran</span>
                      <GraduationCap className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white tabular-nums">
                      {data.kpis.recommendationsCount}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      CCA: {data.kpis.ccaCount} · DNA: {data.kpis.dnaCount}
                    </div>
                  </Link>
                ) : (
                  <Link
                    to="/management-feedback"
                    className="bg-[#0F172A] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-xs">
                      <span>Masukan Management</span>
                      <MessageSquarePlus className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white tabular-nums">
                      {data.kpis.managementFeedbackCount}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {data.kpis.feedbackOpenCount} menunggu peninjauan · Rekomendasi: {data.kpis.recommendationsCount}
                    </div>
                  </Link>
                )}
              </div>

              {/* Learning Value Chain Stage Counters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link
                  to="/cca"
                  className="bg-[#0B1220] border border-slate-800/80 rounded-lg px-4 py-3 flex items-center justify-between hover:border-slate-700"
                >
                  <div>
                    <div className="text-[11px] text-slate-400">Core Competency (CCA)</div>
                    <div className="text-lg font-bold text-white tabular-nums">{data.kpis.ccaCount}</div>
                  </div>
                  <Award className="w-4 h-4 text-cyan-400" />
                </Link>
                <Link
                  to="/dna"
                  className="bg-[#0B1220] border border-slate-800/80 rounded-lg px-4 py-3 flex items-center justify-between hover:border-slate-700"
                >
                  <div>
                    <div className="text-[11px] text-slate-400">Developmental Need (DNA)</div>
                    <div className="text-lg font-bold text-white tabular-nums">{data.kpis.dnaCount}</div>
                  </div>
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </Link>
                <Link
                  to="/recommendations"
                  className="bg-[#0B1220] border border-slate-800/80 rounded-lg px-4 py-3 flex items-center justify-between hover:border-slate-700"
                >
                  <div>
                    <div className="text-[11px] text-slate-400">Rekomendasi Program</div>
                    <div className="text-lg font-bold text-white tabular-nums">{data.kpis.recommendationsCount}</div>
                  </div>
                  <GraduationCap className="w-4 h-4 text-emerald-400" />
                </Link>
                <Link
                  to="/relationship-map"
                  className="bg-[#0B1220] border border-slate-800/80 rounded-lg px-4 py-3 flex items-center justify-between hover:border-slate-700"
                >
                  <div>
                    <div className="text-[11px] text-slate-400">Peta Relasi Value Chain</div>
                    <div className="text-xs font-semibold text-cyan-300 mt-0.5">Lihat Graf Interaktif</div>
                  </div>
                  <Activity className="w-4 h-4 text-violet-400" />
                </Link>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-white">Penelitian LNA &amp; Isu PESTEL per Bidang Bisnis</h2>
                      <p className="text-xs text-slate-400">Distribusi data nyata sesuai cakupan akses akun</p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.researchBySegment} margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: '#94A3B8', fontSize: 10 }}
                          tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 18)}…` : v)}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                          height={54}
                        />
                        <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} allowDecimals={false} width={28} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0B1220', borderColor: '#334155', fontSize: 12, color: '#F8FAFC' }}
                        />
                        <Bar dataKey="studies" name="Penelitian LNA" fill="#06B6D4" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Bar dataKey="pestel" name="Isu PESTEL" fill="#3B82F6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Sebaran Dimensi PESTEL</h2>
                    <p className="text-xs text-slate-400">Political, Economic, Social, Technological, Environmental, Legal</p>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.charts.pestelDistribution}
                          dataKey="count"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={82}
                          paddingAngle={3}
                          isAnimationActive={false}
                        >
                          {data.charts.pestelDistribution.map((entry, idx) => (
                            <Cell key={entry.category} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0B1220', borderColor: '#334155', fontSize: 12, color: '#F8FAFC' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] text-slate-300">
                    {data.charts.pestelDistribution.map((p, idx) => (
                      <div key={p.category} className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="truncate">{p.category}</span>
                        <span className="font-mono-tabular text-slate-400">({p.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Studies & Recent PESTEL */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Penelitian LNA Terbaru</h2>
                    <Link to="/lna" className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
                      <span>Semua Penelitian</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {data.recentStudies.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                      Belum ada penelitian LNA yang sesuai filter dan hak akses Anda.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {data.recentStudies.map((study) => (
                        <div key={study.id} className="py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-mono-tabular text-cyan-300">{study.studyCode}</span>
                              <StatusLabel status={study.status} />
                              <PriorityLabel priority={study.priority} />
                            </div>
                            <Link
                              to={`/lna/${study.id}`}
                              className="block text-sm font-medium text-white hover:text-cyan-300 truncate"
                            >
                              {study.title}
                            </Link>
                            <div className="text-xs text-slate-400 truncate">
                              {getName(study.businessSegmentId)} · {getName(study.departmentId)} · {study.year}
                            </div>
                          </div>
                          <Link
                            to={`/lna/${study.id}`}
                            className="shrink-0 px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md"
                          >
                            Detail
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Isu PESTEL Terkini</h2>
                    <Link to="/strategic-issues" className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
                      <span>Monitoring</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {data.recentIssues.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                      Belum ada isu PESTEL tersedia pada cakupan ini.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.recentIssues.map((issue) => (
                        <div key={issue.id} className="p-3 rounded-lg bg-[#0B1220] border border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-cyan-300 font-medium truncate">
                              {issue.categories.join(', ')}
                            </span>
                            <StatusLabel status={issue.status} />
                          </div>
                          <div className="text-xs font-semibold text-white line-clamp-2">{issue.title}</div>
                          <div className="text-[11px] text-slate-400 flex items-center justify-between">
                            <span className="truncate">{getName(issue.businessSegmentId)}</span>
                            <span className="shrink-0">{formatShortDate(issue.updatedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Department Breakdown & Management Feedback */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div
                  className={`${
                    user?.role === 'USER' ? 'lg:col-span-12' : 'lg:col-span-7'
                  } bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-4`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-white">Penelitian LNA &amp; TNA per Departemen</h2>
                      <p className="text-xs text-slate-400">
                        Sebaran penelitian LNA dan kebutuhan pelatihan (TNA) di unit kerja PLN
                      </p>
                    </div>
                    <Link to="/lna" className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
                      <span>Workspace Departemen</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {data.charts.researchByDepartment.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                      Belum ada data penelitian per departemen pada filter saat ini.
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.charts.researchByDepartment.slice(0, 8)}
                          margin={{ top: 10, right: 16, left: 0, bottom: 28 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: '#94A3B8', fontSize: 10 }}
                            tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 18)}…` : v)}
                            interval={0}
                            angle={-15}
                            textAnchor="end"
                            height={58}
                          />
                          <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} allowDecimals={false} width={28} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0B1220',
                              borderColor: '#334155',
                              fontSize: 12,
                              color: '#F8FAFC',
                            }}
                          />
                          <Bar dataKey="studies" name="Penelitian LNA" fill="#06B6D4" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                          <Bar dataKey="tna" name="Analisis TNA" fill="#10B981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {user?.role !== 'USER' && (
                  <div className="lg:col-span-5 bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-white">Masukan Management Terkini</h2>
                        <p className="text-xs text-slate-400">
                          Total {data.kpis.managementFeedbackCount} masukan · {data.kpis.feedbackOpenCount} perlu tinjauan
                        </p>
                      </div>
                      <Link
                        to="/management-feedback"
                        className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                      >
                        <span>Kelola</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    {data.recentFeedback.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                        Belum ada masukan Management yang tercatat.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.recentFeedback.map((fb) => (
                          <div key={fb.id} className="p-3 rounded-lg bg-[#0B1220] border border-slate-800/80 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <StatusLabel status={fb.status} />
                              <PriorityLabel priority={fb.priority} />
                            </div>
                            <div className="text-xs font-semibold text-white line-clamp-2">{fb.title}</div>
                            <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
                              <span className="truncate">{fb.submittedByName}</span>
                              <span className="shrink-0">{formatShortDate(fb.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )
        )}
      </div>
    </AppShell>
  );
}
