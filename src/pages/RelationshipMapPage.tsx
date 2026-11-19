import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import { ArrowUpRight } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { apiRequest } from '../lib/api';
import type { GraphEdgeData, GraphNodeData, VisualVerificationState } from '../shared/graph';

const STATE_STYLES: Record<VisualVerificationState, { border: string; bg: string; badge: string; label: string }> = {
  ai_draft: {
    border: '#A855F7',
    bg: '#1E1032',
    badge: 'Draft / Usulan AI',
    label: 'Draft / Usulan AI',
  },
  in_progress: {
    border: '#F59E0B',
    bg: '#24190A',
    badge: 'Dalam Analisis / Review',
    label: 'Dalam Analisis / Menunggu Masukan',
  },
  approved: {
    border: '#06B6D4',
    bg: '#082032',
    badge: 'Disetujui / Terverifikasi',
    label: 'Disetujui / Tervalidasi',
  },
  published: {
    border: '#10B981',
    bg: '#07221B',
    badge: 'Dipublikasikan',
    label: 'Dipublikasikan Resmi',
  },
};

export function RelationshipMapPage() {
  const [rawNodes, setRawNodes] = useState<GraphNodeData[]>([]);
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiRequest<{ nodes: GraphNodeData[]; edges: GraphEdgeData[] }>('/api/v1/relationship-map');
        if (cancelled) return;
        setRawNodes(res.nodes || []);
        setRfNodes(
          (res.nodes || []).map((n) => {
            const st = STATE_STYLES[n.verificationState] || STATE_STYLES.approved;
            return {
              id: n.id,
              position: { x: n.x, y: n.y },
              data: {
                label: (
                  <div className="text-left space-y-0.5">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">{n.kind.replace('_', ' ')}</div>
                    <div className="text-xs font-semibold text-white leading-snug line-clamp-2">{n.label}</div>
                    <div className="text-[10px] text-cyan-300 truncate">{n.subtitle}</div>
                  </div>
                ),
              },
              style: {
                width: 235,
                padding: '10px 12px',
                borderRadius: '10px',
                border: `1.5px solid ${st.border}`,
                background: st.bg,
                color: '#F8FAFC',
              },
            };
          }),
        );
        setRfEdges(
          (res.edges || []).map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            animated: e.verificationState === 'ai_draft',
            style: {
              stroke: STATE_STYLES[e.verificationState]?.border || '#38BDF8',
              strokeWidth: 1.5,
            },
            labelStyle: { fill: '#94A3B8', fontSize: 10 },
          })),
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat Relationship Map.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Relationship Map' },
      ]}
    >
      <div className="space-y-4">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white">Relationship Map — Learning Value Chain Slide 8</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Peta keterhubungan PESTEL → Penelitian LNA → Departemen → CCA/DNA → TNA → Rekomendasi → Learning Path.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px]">
            {(Object.keys(STATE_STYLES) as VisualVerificationState[]).map((k) => (
              <div key={k} className="flex items-center gap-1.5 text-slate-300">
                <span
                  className="w-3 h-3 rounded-sm border"
                  style={{ backgroundColor: STATE_STYLES[k].bg, borderColor: STATE_STYLES[k].border }}
                />
                <span>{STATE_STYLES[k].badge}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 h-[580px] bg-[#0B1220] border border-slate-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Menyusun graf Learning Value Chain...
              </div>
            ) : rfNodes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada simpul data terotorisasi untuk ditampilkan pada peta relasi.
              </div>
            ) : (
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                fitView
                minZoom={0.2}
                fitViewOptions={{ padding: 0.25 }}
                onNodeClick={(_evt, node) => {
                  const found = rawNodes.find((r) => r.id === node.id) || null;
                  setSelectedNode(found);
                }}
              >
                <Background color="#1E293B" gap={20} />
                <Controls />
                <MiniMap nodeColor="#06B6D4" maskColor="rgba(8, 14, 26, 0.7)" />
              </ReactFlow>
            )}
          </div>

          <div className="lg:col-span-3 bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white">Inspektor Simpul</h2>
            {selectedNode ? (
              <div className="space-y-3 text-xs">
                <div className="text-[11px] uppercase tracking-wider text-cyan-400">{selectedNode.kind}</div>
                <div className="text-sm font-semibold text-white">{selectedNode.label}</div>
                <div className="text-slate-300">{selectedNode.subtitle}</div>
                <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800">
                  <span className="text-slate-400">Status Verifikasi: </span>
                  <span className="text-white font-medium">
                    {STATE_STYLES[selectedNode.verificationState]?.label}
                  </span>
                </div>
                {selectedNode.detailPath && (
                  <Link
                    to={selectedNode.detailPath}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg inline-flex items-center justify-center gap-1.5"
                  >
                    <span>Buka Halaman Terkait</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Klik simpul mana saja pada kanvas graf untuk melihat detail dan menavigasi langsung ke modul LNA, PESTEL, CCA/DNA, TNA, atau Rekomendasi.
              </p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
