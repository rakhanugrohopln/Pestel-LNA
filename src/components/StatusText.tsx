import React from 'react';
import type { OrganizationItem } from '../context/AuthContext';
import type { PriorityLevel } from '../shared/types';

export function useOrgLookup(organizations: OrganizationItem[]) {
  const byId = new Map(organizations.map((o) => [o.id, o]));
  const segments = organizations.filter((o) => o.level === 'segment');
  const departments = organizations.filter((o) => o.level === 'department');
  const units = organizations.filter((o) => o.level === 'unit');

  const getName = (id?: string) => {
    if (!id) return '-';
    return byId.get(id)?.name || id;
  };

  const getSlug = (id?: string) => {
    if (!id) return '';
    return byId.get(id)?.slug || '';
  };

  return { byId, segments, departments, units, getName, getSlug };
}

export function StatusLabel({ status }: { status: string }) {
  let color = 'text-slate-300 border-slate-700 bg-slate-900/70';
  if (status === 'Dipublikasikan' || status === 'Selesai') {
    color = 'text-emerald-300 border-emerald-700/60 bg-emerald-950/50';
  } else if (status === 'Disetujui' || status === 'Tervalidasi' || status === 'Terverifikasi' || status === 'Ditindaklanjuti') {
    color = 'text-cyan-300 border-cyan-700/60 bg-cyan-950/50';
  } else if (status === 'Menunggu Masukan' || status === 'Menunggu Persetujuan' || status === 'Ditinjau' || status === 'Dalam Analisis') {
    color = 'text-amber-300 border-amber-700/60 bg-amber-950/50';
  } else if (status === 'Revisi' || status === 'Ditolak') {
    color = 'text-rose-300 border-rose-700/60 bg-rose-950/50';
  } else if (status === 'Draft AI' || status === 'Usulan AI' || status === 'Baru') {
    color = 'text-violet-300 border-violet-700/60 bg-violet-950/50';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${color}`}>
      {status}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: PriorityLevel | string }) {
  const map: Record<string, { label: string; cls: string }> = {
    critical: { label: 'Kritis', cls: 'text-rose-300 border-rose-700/60 bg-rose-950/50' },
    high: { label: 'Tinggi', cls: 'text-amber-300 border-amber-700/60 bg-amber-950/50' },
    medium: { label: 'Sedang', cls: 'text-cyan-300 border-cyan-700/60 bg-cyan-950/50' },
    low: { label: 'Rendah', cls: 'text-slate-300 border-slate-700 bg-slate-900/60' },
  };
  const cfg = map[priority] || { label: priority, cls: 'text-slate-300 border-slate-700 bg-slate-900/60' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function formatShortDate(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
