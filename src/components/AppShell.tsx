import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileBarChart2,
  FileSearch,
  GitBranch,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquarePlus,
  Newspaper,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import plnEmblem from '../assets/images/pln_corpu_emblem_1795056093842.jpg';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface NavGroup {
  title: string;
  items: Array<{
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

export function AppShell({
  breadcrumbs,
  actions,
  children,
}: {
  breadcrumbs: BreadcrumbItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navGroups: NavGroup[] = [
    {
      title: 'UTAMA',
      items: [
        { to: '/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
        { to: '/pestel', label: 'AI News & PESTEL Analysis', icon: Newspaper },
        { to: '/strategic-issues', label: 'Monitoring Isu Strategis', icon: Activity },
      ],
    },
    {
      title: 'LEARNING NEEDS ANALYSIS',
      items: [
        { to: '/lna', label: 'Penelitian & Analisis Kebutuhan (LNA)', icon: FileSearch },
        { to: '/cca', label: 'Core Competency Analysis (CCA)', icon: Award },
        { to: '/dna', label: 'Developmental Need Analysis (DNA)', icon: TrendingUp },
        { to: '/tna', label: 'Training Need Analysis (TNA)', icon: Target },
      ],
    },
    {
      title: 'HASIL ANALISIS',
      items: [
        { to: '/recommendations', label: 'Rekomendasi Pembelajaran', icon: GraduationCap },
        { to: '/learning-paths', label: 'Learning Path', icon: Layers },
        { to: '/relationship-map', label: 'Relationship Map', icon: GitBranch },
        { to: '/reports', label: 'Laporan dan Dokumentasi', icon: FileBarChart2 },
      ],
    },
  ];

  if (user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGEMENT') {
    navGroups.push({
      title: 'MANAGEMENT',
      items: [{ to: '/management-feedback', label: 'Masukan Management', icon: MessageSquarePlus }],
    });
  }

  if (user?.role === 'SUPER_ADMIN') {
    navGroups.push({
      title: 'ADMINISTRASI',
      items: [
        { to: '/admin/users', label: 'Manajemen Pengguna', icon: Users },
        { to: '/admin/organizations', label: 'Master Bidang Bisnis & Departemen', icon: Building2 },
        { to: '/admin/competencies', label: 'Master Kompetensi', icon: BookOpen },
        { to: '/admin/settings', label: 'Pengaturan Sistem', icon: Settings },
        { to: '/admin/audit-logs', label: 'Audit Log', icon: ClipboardCheck },
      ],
    });
  }

  const roleDisplay =
    user?.role === 'SUPER_ADMIN'
      ? 'Super Admin'
      : user?.role === 'MANAGEMENT'
        ? 'Management'
        : 'User';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0A1120] border-r border-slate-800/80 text-slate-200">
      <div className="px-4 py-4 border-b border-slate-800/80 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-cyan-500/40 bg-slate-900 shrink-0">
            <img
              src={plnEmblem}
              alt="PLN CORPU"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white tracking-tight truncate">PLN CORPU</div>
            <div className="text-[11px] text-cyan-400 truncate">Strategic PESTEL &amp; LNA</div>
          </div>
        </Link>
        <button
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="Menu Utama" className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-0.5">
            <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {group.title}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800/80 space-y-2.5 bg-[#080E1A]/60">
        <div className="px-1.5">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-xs font-semibold text-white truncate">{user?.displayName}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">
            {roleDisplay} · {user?.email}
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-2 px-3 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar Sesi</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080E1A] text-slate-100 flex">
      <aside className="hidden lg:block w-68 shrink-0 h-screen sticky top-0">{sidebarContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 max-w-[85vw] h-full">{sidebarContent}</div>
          <button
            type="button"
            aria-label="Tutup overlay navigasi"
            className="flex-1 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 min-h-14 py-2 px-4 sm:px-6 bg-[#080E1A]/90 backdrop-blur border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              aria-label="Buka menu navigasi"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 text-slate-300 hover:text-white border border-slate-800 rounded-md shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={`${bc.label}-${idx}`}>
                  {idx > 0 && <span aria-hidden="true">/</span>}
                  {bc.to ? (
                    <Link to={bc.to} className="hover:text-cyan-300 truncate">
                      {bc.label}
                    </Link>
                  ) : (
                    <span className="text-slate-100 font-medium truncate">{bc.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>
          {actions && <div className="flex items-center flex-wrap gap-2 max-w-full">{actions}</div>}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
