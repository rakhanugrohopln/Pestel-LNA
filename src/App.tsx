/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, ErrorBoundary, useAuth } from './context/AuthContext';
import {
  AdminAuditLogsPage,
  AdminCompetenciesPage,
  AdminOrganizationsPage,
  AdminSettingsPage,
  AdminUsersPage,
} from './pages/AdminPages';
import { CcaPage } from './pages/CcaPage';
import { DashboardPage } from './pages/DashboardPage';
import { DnaPage } from './pages/DnaPage';
import { LearningPathsPage } from './pages/LearningPathsPage';
import { LnaDetailPage } from './pages/LnaDetailPage';
import { LnaStudiesPage } from './pages/LnaStudiesPage';
import { LoginPage } from './pages/LoginPage';
import { ManagementFeedbackPage } from './pages/ManagementFeedbackPage';
import { PestelPage } from './pages/PestelPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { RelationshipMapPage } from './pages/RelationshipMapPage';
import { ReportsPage } from './pages/ReportsPage';
import { TnaPage } from './pages/TnaPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#080E1A] flex items-center justify-center text-slate-300 text-sm">
        Memuat sesi PLN CORPU...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* UTAMA */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pestel"
        element={
          <ProtectedRoute>
            <PestelPage mode="analysis" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/strategic-issues"
        element={
          <ProtectedRoute>
            <PestelPage mode="monitoring" />
          </ProtectedRoute>
        }
      />

      {/* LEARNING NEEDS ANALYSIS */}
      <Route
        path="/lna"
        element={
          <ProtectedRoute>
            <LnaStudiesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lna/departemen/:slug"
        element={
          <ProtectedRoute>
            <LnaStudiesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lna/:id"
        element={
          <ProtectedRoute>
            <LnaDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cca"
        element={
          <ProtectedRoute>
            <CcaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dna"
        element={
          <ProtectedRoute>
            <DnaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tna"
        element={
          <ProtectedRoute>
            <TnaPage />
          </ProtectedRoute>
        }
      />

      {/* HASIL ANALISIS */}
      <Route
        path="/recommendations"
        element={
          <ProtectedRoute>
            <RecommendationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learning-paths"
        element={
          <ProtectedRoute>
            <LearningPathsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/relationship-map"
        element={
          <ProtectedRoute>
            <RelationshipMapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />

      {/* MANAGEMENT */}
      <Route
        path="/management-feedback"
        element={
          <ProtectedRoute>
            <ManagementFeedbackPage />
          </ProtectedRoute>
        }
      />

      {/* ADMINISTRASI */}
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/organizations"
        element={
          <ProtectedRoute>
            <AdminOrganizationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/competencies"
        element={
          <ProtectedRoute>
            <AdminCompetenciesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute>
            <AdminSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute>
            <AdminAuditLogsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
