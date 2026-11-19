import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  ApiError,
  apiRequest,
  clearSessionToken,
  setSessionToken,
  setUatGateToken,
  setUnauthorizedHandler,
} from '../lib/api';
import type { OrganizationNode, SystemConfigStatus, UserProfile, UserRole } from '../shared/types';
import '../lib/firebase';

export type OrganizationItem = OrganizationNode & {
  researchPath: string;
};

interface AuthContextValue {
  user: UserProfile | null;
  needsBootstrap: boolean;
  config: SystemConfigStatus | null;
  organizations: OrganizationItem[];
  loading: boolean;
  sessionNotice: string;
  clearSessionNotice: () => void;
  login: (email: string, password: string) => Promise<void>;
  loginAsUatRole: (role: UserRole) => Promise<void>;
  authorizeUatQc: (passcode: string) => Promise<void>;
  bootstrapSuperAdmin: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshOrganizations: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [config, setConfig] = useState<SystemConfigStatus | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState('');

  const clearSessionNotice = useCallback(() => {
    setSessionNotice('');
  }, []);

  const refreshOrganizations = useCallback(async () => {
    try {
      const res = await apiRequest<{ organizations: OrganizationItem[] }>('/api/v1/organizations');
      setOrganizations(res.organizations || []);
    } catch (err) {
      setOrganizations([]);
      if (err instanceof ApiError && err.status === 401) {
        throw err;
      }
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const me = await apiRequest<{
        authenticated: boolean;
        user: UserProfile | null;
        config?: SystemConfigStatus;
        uatGateToken?: string;
      }>('/api/auth/session');
      if (me.config) {
        setConfig(me.config);
        setNeedsBootstrap(Boolean(me.config.needsBootstrap));
        if (!me.config.uatQuickLoginEnabled) {
          setUatGateToken(undefined);
        } else if (me.uatGateToken) {
          setUatGateToken(me.uatGateToken);
        }
      }
      if (me.authenticated && me.user) {
        setUser(me.user);
        setSessionNotice('');
        await refreshOrganizations();
      } else {
        clearSessionToken();
        setUser(null);
        setOrganizations([]);
      }
    } catch {
      clearSessionToken();
      setUser(null);
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, [refreshOrganizations]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSessionToken();
      setUser(null);
      setOrganizations([]);
      setSessionNotice('Sesi login Anda telah berakhir atau tidak terverifikasi. Silakan masuk kembali.');
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{
      user: UserProfile;
      sessionToken?: string;
      config?: SystemConfigStatus;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.sessionToken) {
      setSessionToken(res.sessionToken);
    }
    setUser(res.user);
    setSessionNotice('');
    if (res.config) {
      setConfig(res.config);
      setNeedsBootstrap(Boolean(res.config.needsBootstrap));
    }
    await refreshOrganizations();
  };

  const loginAsUatRole = async (role: UserRole) => {
    const res = await apiRequest<{
      user: UserProfile;
      sessionToken?: string;
      config?: SystemConfigStatus;
    }>('/api/auth/uat-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    if (res.sessionToken) {
      setSessionToken(res.sessionToken);
    }
    setUser(res.user);
    setSessionNotice('');
    if (res.config) {
      setConfig(res.config);
      setNeedsBootstrap(Boolean(res.config.needsBootstrap));
    }
    await refreshOrganizations();
  };

  const authorizeUatQc = async (passcode: string) => {
    const res = await apiRequest<{
      ok: boolean;
      uatGateToken?: string;
      config?: SystemConfigStatus;
    }>('/api/auth/uat-qc-authorize', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    });
    if (res.uatGateToken) {
      setUatGateToken(res.uatGateToken);
    }
    if (res.config) {
      setConfig(res.config);
    }
  };

  const bootstrapSuperAdmin = async (email: string, password: string, displayName?: string) => {
    const res = await apiRequest<{
      user: UserProfile;
      sessionToken?: string;
      config?: SystemConfigStatus;
    }>('/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    if (res.sessionToken) {
      setSessionToken(res.sessionToken);
    }
    setUser(res.user);
    setSessionNotice('');
    setNeedsBootstrap(false);
    if (res.config) {
      setConfig(res.config);
    }
    await refreshOrganizations();
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout network error
    }
    clearSessionToken();
    setUser(null);
    setOrganizations([]);
    setSessionNotice('');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        needsBootstrap,
        config,
        organizations,
        loading,
        sessionNotice,
        clearSessionNotice,
        login,
        loginAsUatRole,
        authorizeUatQc,
        bootstrapSuperAdmin,
        logout,
        refreshSession,
        refreshOrganizations,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080E1A] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#0F172A] border border-slate-800 rounded-xl p-6 space-y-4">
            <h1 className="text-lg font-semibold text-white">Terjadi Gangguan Aplikasi</h1>
            <p className="text-sm text-slate-300 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
