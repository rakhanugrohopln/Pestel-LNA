import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  KeyRound,
  Plus,
  Settings,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { StatusLabel, formatShortDate, useOrgLookup } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type {
  ApprovalHistoryEntry,
  AuditLog,
  CompetencyItem,
  OrgLevel,
  ProfessionItem,
  SystemConfigStatus,
  UserProfile,
  UserRole,
} from '../shared/types';

function AdminOnlyGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <AppShell breadcrumbs={[{ label: 'Administrasi' }]}>
        <div className="bg-[#0F172A] border border-rose-800/60 rounded-xl p-10 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
          <h1 className="text-lg font-semibold text-white">Akses Khusus Super Admin</h1>
          <p className="text-xs text-slate-300">Halaman administrasi hanya tersedia untuk peran Super Admin.</p>
        </div>
      </AppShell>
    );
  }
  return <>{children}</>;
}

export function AdminUsersPage() {
  const { organizations } = useAuth();
  const { segments, departments, getName } = useOrgLookup(organizations);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'MANAGEMENT' as UserRole,
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
  });

  const [uatModalCreds, setUatModalCreds] = useState<
    Array<{ email: string; role: string; department: string; oneTimePassword: string }> | null
  >(null);
  const [provisioningUat, setProvisioningUat] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ users: UserProfile[] }>('/api/v1/users');
      setUsers(res.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setCreating(true);
    try {
      await apiRequest('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          orgScopeIds: form.role === 'SUPER_ADMIN' ? ['ALL_CORPORATE'] : [form.departmentId],
        }),
      });
      setShowCreate(false);
      setForm((prev) => ({ ...prev, email: '', displayName: '', password: '' }));
      setNotice('Akun pengguna baru berhasil dibuat.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat akun pengguna.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (
    uid: string,
    payload: { role?: UserRole; isActive?: boolean; newPassword?: string },
  ) => {
    setError('');
    try {
      await apiRequest(`/api/v1/users/${uid}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setNotice('Data pengguna berhasil diperbarui.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui pengguna.');
    }
  };

  const handleProvisionUat = async () => {
    setError('');
    setProvisioningUat(true);
    try {
      const res = await apiRequest<{
        credentials: Array<{ email: string; role: string; department: string; oneTimePassword: string }>;
      }>('/api/v1/users/provision-uat', { method: 'POST' });
      setUatModalCreds(res.credentials);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyiapkan akun UAT 3 role.');
    } finally {
      setProvisioningUat(false);
    }
  };

  return (
    <AdminOnlyGuard>
      <AppShell
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Manajemen Pengguna' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={provisioningUat}
              onClick={() => void handleProvisionUat()}
              className="px-3 py-1.5 text-xs font-medium bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-200 rounded-lg inline-flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{provisioningUat ? 'Menyiapkan...' : 'Provision Akun UAT (3 Role)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Tambah Pengguna</span>
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
            <h1 className="text-xl font-bold text-white">Manajemen Pengguna (3 Role: Super Admin, Management, User)</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Kelola akun, penetapan peran, serta cakupan departemen pengguna. Hanya mendukung tepat tiga peran resmi.
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

          {showCreate && (
            <form onSubmit={handleCreate} className="bg-[#0F172A] border border-blue-700/50 rounded-xl p-5 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-white">Buat Akun Pengguna Baru</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Email korporat *"
                  className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
                <input
                  required
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Nama Lengkap *"
                  className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
                <input
                  required
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Password (min 8 karakter) *"
                  className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="MANAGEMENT">Management</option>
                  <option value="USER">User</option>
                </select>
                <select
                  value={form.businessSegmentId}
                  onChange={(e) => {
                    const nextSeg = e.target.value;
                    const firstDept = departments.find((d) => d.businessSegmentId === nextSeg);
                    setForm({
                      ...form,
                      businessSegmentId: nextSeg,
                      departmentId: firstDept?.id || form.departmentId,
                    });
                  }}
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

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg"
                >
                  {creating ? 'Menyimpan...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-6 text-xs text-slate-400">Memuat pengguna...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B1220] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">Pengguna</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Bidang Bisnis &amp; Departemen</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200">
                    {users.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{u.displayName}</div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`Ubah role ${u.email}`}
                            value={u.role}
                            onChange={(e) => void handleUpdateUser(u.uid, { role: e.target.value as UserRole })}
                            className="px-2 py-1 bg-[#080E1A] border border-slate-700 rounded text-xs text-white"
                          >
                            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                            <option value="MANAGEMENT">MANAGEMENT</option>
                            <option value="USER">USER</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {getName(u.businessSegmentId)} · {getName(u.departmentId)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusLabel status={u.isActive ? 'Dipublikasikan' : 'Ditolak'} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void handleUpdateUser(u.uid, { isActive: !u.isActive })}
                            className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded"
                          >
                            {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* One-time UAT credentials modal */}
        {uatModalCreds && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div className="bg-[#0F172A] border border-amber-600/60 rounded-xl w-full max-w-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <Users className="w-4 h-4" />
                  <span>Kredensial UAT 3 Role (Tampil Sekali)</span>
                </div>
                <button
                  type="button"
                  aria-label="Tutup kredensial UAT"
                  onClick={() => setUatModalCreds(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-300">
                Catat kata sandi acak kuat berikut untuk pengujian masing-masing peran (Super Admin, Management, User). Password disimpan ter-hash (scrypt) dan tidak dapat ditampilkan ulang tanpa reset.
              </p>
              <div className="space-y-2.5">
                {uatModalCreds.map((c) => (
                  <div key={c.email} className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-cyan-300">{c.role}</div>
                      <div className="text-white font-mono-tabular">{c.email}</div>
                    </div>
                    <div className="font-mono-tabular bg-slate-900 px-3 py-1.5 rounded border border-slate-700 text-amber-200">
                      {c.oneTimePassword}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setUatModalCreds(null)}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </AdminOnlyGuard>
  );
}

export function AdminOrganizationsPage() {
  const { organizations, refreshOrganizations } = useAuth();
  const { segments, getName } = useOrgLookup(organizations);

  const [name, setName] = useState('');
  const [level, setLevel] = useState<OrgLevel>('department');
  const [businessSegmentId, setBusinessSegmentId] = useState('seg-transmisi');
  const [province, setProvince] = useState('Nasional');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await apiRequest('/api/v1/organizations', {
        method: 'POST',
        body: JSON.stringify({ name, level, businessSegmentId, province, description }),
      });
      setName('');
      setDescription('');
      setNotice('Node organisasi PLN berhasil ditambahkan.');
      await refreshOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menambah organisasi.');
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/api/v1/organizations/${id}`, { method: 'DELETE' });
      await refreshOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus organisasi.');
    }
  };

  return (
    <AdminOnlyGuard>
      <AppShell
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Master Bidang Bisnis & Departemen' },
        ]}
      >
        <div className="space-y-6">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
            <h1 className="text-xl font-bold text-white">Master Bidang Bisnis &amp; Departemen PLN</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Struktur organisasi PLN untuk pemetaan penelitian LNA, CCA, DNA, TNA, dan otorisasi pengguna.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs">{error}</div>
          )}
          {notice && (
            <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs">{notice}</div>
          )}

          <form onSubmit={handleCreate} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>Tambah Bidang Bisnis / Departemen / Unit</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Bidang / Departemen / Unit *"
                className="md:col-span-2 px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as OrgLevel)}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="segment">Bidang Bisnis</option>
                <option value="department">Departemen</option>
                <option value="unit">Unit Kerja</option>
              </select>
              <select
                value={businessSegmentId}
                onChange={(e) => setBusinessSegmentId(e.target.value)}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Wilayah / Provinsi"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi cakupan fungsi..."
                className="md:col-span-2 px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Organisasi</span>
              </button>
            </div>
          </form>

          <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B1220] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nama</th>
                    <th className="px-4 py-3 font-medium">Level</th>
                    <th className="px-4 py-3 font-medium">Bidang Bisnis Induk</th>
                    <th className="px-4 py-3 font-medium">Wilayah</th>
                    <th className="px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {organizations.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{o.name}</div>
                        <div className="text-[11px] text-slate-400">{o.slug}</div>
                      </td>
                      <td className="px-4 py-3 uppercase text-cyan-300">{o.level}</td>
                      <td className="px-4 py-3 text-slate-300">{getName(o.businessSegmentId)}</td>
                      <td className="px-4 py-3 text-slate-400">{o.province || 'Nasional'}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void handleDelete(o.id)}
                          className="p-1.5 text-rose-300 hover:bg-rose-950/50 rounded"
                          aria-label={`Hapus ${o.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AppShell>
    </AdminOnlyGuard>
  );
}

export function AdminCompetenciesPage() {
  const { organizations } = useAuth();
  const { segments, departments, getName } = useOrgLookup(organizations);

  const [competencies, setCompetencies] = useState<CompetencyItem[]>([]);
  const [professions, setProfessions] = useState<ProfessionItem[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [compForm, setCompForm] = useState({
    code: '',
    name: '',
    category: 'technical' as 'core' | 'technical' | 'behavioral',
    businessSegmentId: 'seg-transmisi',
    departmentId: 'dept-transmisi-grid',
    jobStandardRef: 'Belum Dikonfigurasi',
    targetLevel: 4,
    description: '',
    configStatus: 'uat_synthetic' as 'uat_synthetic' | 'unconfigured' | 'official',
  });

  const loadAll = useCallback(async () => {
    try {
      const res = await apiRequest<{ competencies: CompetencyItem[]; professions: ProfessionItem[] }>(
        '/api/v1/competencies',
      );
      setCompetencies(res.competencies || []);
      setProfessions(res.professions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat master kompetensi.');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateCompetency = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await apiRequest('/api/v1/competencies', {
        method: 'POST',
        body: JSON.stringify({ ...compForm, targetLevel: Number(compForm.targetLevel) }),
      });
      setCompForm((p) => ({ ...p, code: '', name: '', description: '' }));
      setNotice('Master kompetensi baru berhasil ditambahkan.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menambah master kompetensi.');
    }
  };

  return (
    <AdminOnlyGuard>
      <AppShell
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Master Kompetensi' },
        ]}
      >
        <div className="space-y-6">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
            <h1 className="text-xl font-bold text-white">Master Kompetensi &amp; Grand Design Profesi</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Direktori kompetensi dan profesi PLN. Item yang belum diisi standar resminya ditandai eksplisit sebagai Belum Dikonfigurasi atau Sintetis UAT.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs">{error}</div>
          )}
          {notice && (
            <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs">{notice}</div>
          )}

          <form onSubmit={handleCreateCompetency} className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-white">Tambah Master Kompetensi</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                required
                value={compForm.code}
                onChange={(e) => setCompForm({ ...compForm, code: e.target.value })}
                placeholder="Kode Kompetensi *"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <input
                required
                value={compForm.name}
                onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
                placeholder="Nama Kompetensi *"
                className="md:col-span-2 px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <select
                value={compForm.category}
                onChange={(e) => setCompForm({ ...compForm, category: e.target.value as 'core' | 'technical' | 'behavioral' })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="core">Core</option>
                <option value="technical">Technical</option>
                <option value="behavioral">Behavioral</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={compForm.businessSegmentId}
                onChange={(e) => setCompForm({ ...compForm, businessSegmentId: e.target.value })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={compForm.departmentId}
                onChange={(e) => setCompForm({ ...compForm, departmentId: e.target.value })}
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                value={compForm.jobStandardRef}
                onChange={(e) => setCompForm({ ...compForm, jobStandardRef: e.target.value })}
                placeholder="Referensi Standar Jabatan"
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              />
              <select
                value={compForm.configStatus}
                onChange={(e) =>
                  setCompForm({
                    ...compForm,
                    configStatus: e.target.value as 'uat_synthetic' | 'unconfigured' | 'official',
                  })
                }
                className="px-3 py-2 bg-[#080E1A] border border-slate-700 rounded-lg text-white"
              >
                <option value="uat_synthetic">Sintetis UAT</option>
                <option value="unconfigured">Belum Dikonfigurasi</option>
                <option value="official">Standar Resmi</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg"
              >
                Simpan Kompetensi
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Direktori Kompetensi ({competencies.length})</h2>
              <div className="space-y-2.5 text-xs">
                {competencies.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular text-cyan-300 font-semibold">{c.code}</span>
                      <span className="text-[11px] text-slate-400">
                        {c.configStatus === 'unconfigured'
                          ? 'Belum Dikonfigurasi'
                          : c.configStatus === 'uat_synthetic'
                            ? 'Sintetis UAT'
                            : 'Resmi'}
                      </span>
                    </div>
                    <div className="font-semibold text-white">{c.name}</div>
                    <div className="text-slate-400">
                      {getName(c.departmentId)} · Target Level {c.targetLevel} · Ref: {c.jobStandardRef}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Profesi &amp; Grand Design ({professions.length})</h2>
              <div className="space-y-2.5 text-xs">
                {professions.map((p) => (
                  <div key={p.id} className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular text-cyan-300 font-semibold">{p.code}</span>
                      <span className="text-[11px] text-slate-400">
                        {p.configStatus === 'unconfigured' ? 'Belum Dikonfigurasi' : 'Sintetis UAT'}
                      </span>
                    </div>
                    <div className="font-semibold text-white">{p.name}</div>
                    <div className="text-slate-300">{p.grandDesignSummary}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </AdminOnlyGuard>
  );
}

export function AdminSettingsPage() {
  const [config, setConfig] = useState<SystemConfigStatus | null>(null);
  const [health, setHealth] = useState<{ status: string; uptimeSeconds: number; counts: Record<string, number> } | null>(
    null,
  );

  useEffect(() => {
    void Promise.all([
      apiRequest<SystemConfigStatus>('/api/config/status'),
      apiRequest<{ status: string; uptimeSeconds: number; counts: Record<string, number> }>('/api/health'),
    ]).then(([c, h]) => {
      setConfig(c);
      setHealth(h);
    });
  }, []);

  return (
    <AdminOnlyGuard>
      <AppShell
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Pengaturan Sistem' },
        ]}
      >
        <div className="space-y-6">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
            <h1 className="text-xl font-bold text-white">Pengaturan &amp; Status Konfigurasi Sistem</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Pembacaan langsung status runtime server, AI Gemini API, persistensi database, dan proteksi keamanan.
            </p>
          </div>

          {config && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-white text-sm">
                  <Settings className="w-4 h-4 text-cyan-400" />
                  <span>Konfigurasi Runtime &amp; Keamanan</span>
                </div>
                <dl className="space-y-2">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <dt className="text-slate-400">Environment Aktif</dt>
                    <dd className="text-white font-mono-tabular">{config.appEnv}</dd>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <dt className="text-slate-400">Engine Persistensi</dt>
                    <dd className="text-cyan-300">{config.storageEngine}</dd>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <dt className="text-slate-400">Firestore Telemetry DB</dt>
                    <dd className="text-white font-mono-tabular">
                      {config.firestoreConfigured ? config.firestoreDatabaseId : 'Belum Dikonfigurasi'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <dt className="text-slate-400">Gemini AI Server-Side</dt>
                    <dd className={config.geminiConfigured ? 'text-emerald-300' : 'text-amber-300'}>
                      {config.geminiConfigured ? `Aktif (${config.geminiModel})` : 'GEMINI_API_KEY Belum Diisi'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <dt className="text-slate-400">CSRF &amp; Rate Limiter</dt>
                    <dd className="text-emerald-300">
                      {config.csrfEnabled && config.rateLimitEnabled ? 'Aktif (HttpOnly + X-CSRF-Token)' : 'Parsial'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <dt className="text-slate-400">Pemulihan Super Admin</dt>
                    <dd className={config.recoveryConfigured ? 'text-emerald-300' : 'text-amber-300'}>
                      {config.recoveryConfigured ? 'Aktif (ADMIN_RECOVERY_KEY)' : 'Belum Dikonfigurasi'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="font-semibold text-white text-sm">Ringkasan Entitas Tersimpan</div>
                {health && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.entries(health.counts).map(([k, v]) => (
                      <div key={k} className="p-3 rounded-lg bg-[#080E1A] border border-slate-800">
                        <div className="text-[11px] text-slate-400">{k}</div>
                        <div className="text-lg font-bold text-white tabular-nums">{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </AdminOnlyGuard>
  );
}

export function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiRequest<{ logs: AuditLog[]; approvalHistory: ApprovalHistoryEntry[] }>('/api/v1/audit-logs')
      .then((res) => {
        setLogs(res.logs || []);
        setHistory(res.approvalHistory || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminOnlyGuard>
      <AppShell
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Audit Log' },
        ]}
      >
        <div className="space-y-6">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-1">
            <h1 className="text-xl font-bold text-white">Audit Log &amp; Riwayat Persetujuan</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Catatan jejak audit keamanan, login, penolakan akses RBAC, pembuatan penelitian LNA, dan perubahan status workflow.
            </p>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2 text-sm font-semibold text-white">
              <ClipboardCheck className="w-4 h-4 text-cyan-400" />
              <span>Jejak Audit Aktivitas ({logs.length})</span>
            </div>
            {loading ? (
              <div className="p-6 text-xs text-slate-400">Memuat audit log...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B1220] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">Waktu</th>
                      <th className="px-4 py-3 font-medium">Aktor</th>
                      <th className="px-4 py-3 font-medium">Aksi</th>
                      <th className="px-4 py-3 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200">
                    {logs.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{formatShortDate(l.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <div className="text-white">{l.actorEmail}</div>
                          <div className="text-[11px] text-cyan-300">{l.actorRole}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono-tabular text-amber-300">{l.action}</td>
                        <td className="px-4 py-2.5 text-slate-300">{l.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Riwayat Perubahan Status Workflow ({history.length})</h2>
              <div className="space-y-2 text-xs">
                {history.map((h) => (
                  <div key={h.id} className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 flex justify-between gap-2">
                    <div>
                      <span className="font-semibold text-white">{h.actorName}</span> mengubah status{' '}
                      <span className="text-slate-400">{h.fromStatus}</span> →{' '}
                      <span className="text-cyan-300">{h.toStatus}</span> ({h.note})
                    </div>
                    <span className="text-slate-400 shrink-0">{formatShortDate(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </AdminOnlyGuard>
  );
}
