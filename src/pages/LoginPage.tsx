import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { UserRole } from '../shared/types';
import plnEmblem from '../assets/images/pln_corpu_emblem_1795056093842.jpg';
import gridBackdrop from '../assets/images/energy_grid_backdrop_1795056095087.jpg';

export function LoginPage() {
  const {
    user,
    needsBootstrap,
    config,
    sessionNotice,
    clearSessionNotice,
    login,
    loginAsUatRole,
    authorizeUatQc,
    bootstrapSuperAdmin,
    refreshSession,
  } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('Super Admin PLN CORPU');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uatLoadingRole, setUatLoadingRole] = useState<UserRole | null>(null);
  const [qcPasscode, setQcPasscode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Admin password recovery state
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('admin.corpu@pln.co.id');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [newRecoveryPassword, setNewRecoveryPassword] = useState('');
  const [confirmRecoveryPassword, setConfirmRecoveryPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    clearSessionNotice();

    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    if (needsBootstrap) {
      if (password.length < 8) {
        setError('Password Super Admin awal minimal 8 karakter.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Konfirmasi password tidak cocok.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (needsBootstrap) {
        await bootstrapSuperAdmin(email.trim(), password, displayName.trim());
      } else {
        await login(email.trim(), password);
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk. Periksa email dan password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    clearSessionNotice();

    if (!recoveryEmail.trim() || !recoveryKey.trim() || !newRecoveryPassword) {
      setError('Email admin, kode pemulihan server, dan password baru wajib diisi.');
      return;
    }
    if (newRecoveryPassword.length < 8) {
      setError('Password baru Super Admin minimal 8 karakter.');
      return;
    }
    if (newRecoveryPassword !== confirmRecoveryPassword) {
      setError('Konfirmasi password baru tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ ok: boolean; email: string; message: string }>('/api/auth/admin-recovery', {
        method: 'POST',
        body: JSON.stringify({
          email: recoveryEmail.trim(),
          recoveryKey: recoveryKey.trim(),
          newPassword: newRecoveryPassword,
        }),
      });
      setEmail(res.email || recoveryEmail.trim());
      setPassword('');
      setRecoveryKey('');
      setNewRecoveryPassword('');
      setConfirmRecoveryPassword('');
      setRecoveryMode(false);
      setSuccessMsg(res.message || 'Password Super Admin berhasil diperbarui. Silakan masuk.');
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pemulihan password Super Admin gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUatLogin = async (role: UserRole) => {
    setError('');
    setSuccessMsg('');
    clearSessionNotice();
    setUatLoadingRole(role);
    try {
      await loginAsUatRole(role);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk menggunakan akun uji coba UAT.');
    } finally {
      setUatLoadingRole(null);
    }
  };

  const handleQcAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!qcPasscode.trim()) {
      setError('Masukkan kode otorisasi QC terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    try {
      await authorizeUatQc(qcPasscode.trim());
      setQcPasscode('');
      setSuccessMsg('Akses panel UAT QC diaktifkan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Otorisasi QC gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080E1A] text-slate-100 grid lg:grid-cols-12">
      {/* Left Brand Backdrop */}
      <div className="hidden lg:flex lg:col-span-7 relative overflow-hidden border-r border-slate-800/80 flex-col justify-between p-12 bg-[#0A1120]">
        <img
          src={gridBackdrop}
          alt="Infrastruktur Jaringan Ketenagalistrikan PLN"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080E1A] via-[#080E1A]/75 to-[#080E1A]/60" />

        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl overflow-hidden border border-cyan-500/40 bg-slate-900">
            <img
              src={plnEmblem}
              alt="Logo PLN CORPU"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-white">PLN CORPU</div>
            <div className="text-xs text-cyan-300">Corporate University Strategic Intelligence</div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl space-y-4">
          <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
            Integrated Strategic PESTEL & Learning Needs Analytics
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Sistem terintegrasi PLN Corporate University untuk penelitian kebutuhan pembelajaran per bidang bisnis &amp; departemen berdasarkan Learning Value Chain (LNA → CCA → DNA → TNA), analisis PESTEL otomatis, dan rekomendasi pembelajaran korporat.
          </p>
        </div>
      </div>

      {/* Right Clean Corporate Login Form */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shrink-0">
              <img
                src={plnEmblem}
                alt="Logo PLN CORPU"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-xl font-bold text-white tracking-tight">PLN CORPU</div>
              <div className="text-xs text-cyan-300">Integrated Strategic PESTEL & Learning Needs Analytics</div>
            </div>
          </div>

          {needsBootstrap && !recoveryMode && (
            <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-700/50 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Aktivasi Akun Super Admin Awal</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Belum ada akun Super Admin di lingkungan ini. Buat akun Super Admin pertama untuk mengaktifkan portal dan mengelola akun Management &amp; User.
              </p>
            </div>
          )}

          {sessionNotice && !error && !successMsg && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-700/60 text-amber-200 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{sessionNotice}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-700/60 text-emerald-200 text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {recoveryMode ? (
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>Pemulihan Password Super Admin</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {config?.recoveryConfigured
                    ? 'Masukkan email Super Admin dan secret pemulihan server (ADMIN_RECOVERY_KEY) untuk menetapkan password baru.'
                    : 'Tambahkan secret server ADMIN_RECOVERY_KEY (minimal 12 karakter) pada konfigurasi Secrets Google AI Studio atau Cloud Run, lalu mulai ulang server untuk mengaktifkan pemulihan via portal.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="recovery-email" className="block text-xs font-medium text-slate-300">
                  Email Super Admin
                </label>
                <input
                  id="recovery-email"
                  type="email"
                  required
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="admin.corpu@pln.co.id"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0F172A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="recovery-key" className="block text-xs font-medium text-slate-300">
                  Kode Pemulihan Server (ADMIN_RECOVERY_KEY)
                </label>
                <div className="relative">
                  <input
                    id="recovery-key"
                    type={showRecoveryKey ? 'text' : 'password'}
                    required
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    placeholder="Masukkan secret ADMIN_RECOVERY_KEY"
                    className="w-full pl-3.5 pr-11 py-2.5 text-sm bg-[#0F172A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    aria-label={showRecoveryKey ? 'Sembunyikan kode pemulihan' : 'Tampilkan kode pemulihan'}
                    onClick={() => setShowRecoveryKey((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-white transition-colors"
                  >
                    {showRecoveryKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="recovery-new-password" className="block text-xs font-medium text-slate-300">
                  Password Baru (min. 8 karakter)
                </label>
                <div className="relative">
                  <input
                    id="recovery-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={newRecoveryPassword}
                    onChange={(e) => setNewRecoveryPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                    className="w-full pl-3.5 pr-11 py-2.5 text-sm bg-[#0F172A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="recovery-confirm-password" className="block text-xs font-medium text-slate-300">
                  Konfirmasi Password Baru
                </label>
                <input
                  id="recovery-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmRecoveryPassword}
                  onChange={(e) => setConfirmRecoveryPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0F172A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg transition-colors flex items-center justify-center gap-2 tracking-wide"
              >
                <span>{submitting ? 'Memproses...' : 'ATUR ULANG PASSWORD'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setRecoveryMode(false);
                  setError('');
                }}
                className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Halaman Masuk</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {needsBootstrap && (
                <div className="space-y-1.5">
                  <label htmlFor="bootstrap-name" className="block text-xs font-medium text-slate-300">
                    Nama Super Admin
                  </label>
                  <input
                    id="bootstrap-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0F172A] border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-xs font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin.corpu@pln.co.id"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0F172A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="login-password" className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  {!needsBootstrap && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryMode(true);
                        setError('');
                        setSuccessMsg('');
                        if (email.trim()) setRecoveryEmail(email.trim());
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Lupa Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={needsBootstrap ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full pl-3.5 pr-11 py-2.5 text-sm bg-[#0F172A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {needsBootstrap && (
                <div className="space-y-1.5">
                  <label htmlFor="bootstrap-confirm" className="block text-xs font-medium text-slate-300">
                    Konfirmasi Password
                  </label>
                  <input
                    id="bootstrap-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#0F172A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                )}

              <button
                type="submit"
                disabled={submitting || uatLoadingRole !== null}
                className="w-full py-2.5 px-4 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg transition-colors flex items-center justify-center gap-2 tracking-wide"
              >
                <span>{submitting ? 'Memverifikasi...' : needsBootstrap ? 'AKTIVASI & MASUK' : 'MASUK'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {!recoveryMode && config?.uatQuickLoginEnabled && (
            <div className="p-4 rounded-xl bg-[#0B1220] border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-300 uppercase">
                  <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>AKUN UJI COBA (UAT)</span>
                </div>
                <span className="text-[11px] font-medium text-blue-300/80">Staging / QC</span>
              </div>

              {config.uatRequiresPasscode && !config.uatQcAuthorized ? (
                <form onSubmit={handleQcAuthorize} className="space-y-2.5">
                  <input
                    type="password"
                    value={qcPasscode}
                    onChange={(e) => setQcPasscode(e.target.value)}
                    placeholder="Kode otorisasi QC"
                    aria-label="Kode otorisasi QC"
                    className="w-full px-3 py-2 text-xs bg-[#0F172A] border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 px-3 text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-cyan-200 rounded-lg transition-colors"
                  >
                    Aktifkan Akses QC
                  </button>
                </form>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      { role: 'SUPER_ADMIN', label: 'Masuk sebagai Super Admin' },
                      { role: 'MANAGEMENT', label: 'Masuk sebagai Management' },
                      { role: 'USER', label: 'Masuk sebagai User' },
                    ] as const
                  ).map((item) => {
                    const isBusy = uatLoadingRole === item.role;
                    return (
                      <button
                        key={item.role}
                        type="button"
                        disabled={submitting || uatLoadingRole !== null}
                        onClick={() => void handleUatLogin(item.role)}
                        className="w-full py-2 px-3.5 text-xs font-semibold text-slate-100 bg-[#0F172A] hover:bg-blue-600/20 disabled:opacity-60 border border-blue-500/35 hover:border-cyan-400/60 rounded-lg transition-colors flex items-center justify-between gap-2"
                      >
                        <span>{isBusy ? 'Memasuki sesi UAT...' : item.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
