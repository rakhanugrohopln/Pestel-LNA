import type {
  CcaAssessment,
  DnaAssessment,
  LearningPath,
  LearningRecommendation,
  OrganizationNode,
  PestelIssue,
  ResearchStudy,
  TnaAssessment,
} from './types.ts';

export type GraphNodeKind =
  | 'pestel'
  | 'lna_study'
  | 'department'
  | 'cca'
  | 'dna'
  | 'tna'
  | 'recommendation'
  | 'learning_path';

export type VisualVerificationState =
  | 'ai_draft'
  | 'in_progress'
  | 'approved'
  | 'published';

export interface GraphNodeData {
  id: string;
  kind: GraphNodeKind;
  label: string;
  subtitle: string;
  verificationState: VisualVerificationState;
  detailPath?: string;
  entityId: string;
  entityType: string;
  x: number;
  y: number;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  verificationState: VisualVerificationState;
  label?: string;
}

export function mapStatusToVisualState(status: string): VisualVerificationState {
  if (status === 'Draft AI' || status === 'Usulan AI' || status === 'Draft') return 'ai_draft';
  if (status === 'Dipublikasikan') return 'published';
  if (status === 'Disetujui' || status === 'Tervalidasi' || status === 'Terverifikasi') return 'approved';
  return 'in_progress';
}

export function buildRelationshipGraph(params: {
  studies: ResearchStudy[];
  pestelIssues: PestelIssue[];
  orgs: OrganizationNode[];
  ccaList: CcaAssessment[];
  dnaList: DnaAssessment[];
  tnaList: TnaAssessment[];
  recommendations: LearningRecommendation[];
  learningPaths: LearningPath[];
}): { nodes: GraphNodeData[]; edges: GraphEdgeData[] } {
  const { studies, pestelIssues, orgs, ccaList, dnaList, tnaList, recommendations, learningPaths } = params;
  const orgMap = new Map(orgs.map((o) => [o.id, o]));
  const pathMap = new Map(learningPaths.map((p) => [p.id, p]));
  const nodes: GraphNodeData[] = [];
  const edges: GraphEdgeData[] = [];
  const seenNodes = new Set<string>();
  const seenEdges = new Set<string>();

  const addNode = (node: GraphNodeData) => {
    if (!seenNodes.has(node.id)) {
      seenNodes.add(node.id);
      nodes.push(node);
    }
  };
  const addEdge = (edge: GraphEdgeData) => {
    if (!seenEdges.has(edge.id)) {
      seenEdges.add(edge.id);
      edges.push(edge);
    }
  };

  const X_PESTEL = 20;
  const X_LNA = 300;
  const X_DEPT = 580;
  const X_CCA_DNA = 860;
  const X_TNA = 1140;
  const X_REC = 1420;
  const X_PATH = 1700;

  let rowY = 40;

  for (const study of studies) {
    const studyState = mapStatusToVisualState(study.status);
    const studyNodeId = `study-${study.id}`;

    addNode({
      id: studyNodeId,
      kind: 'lna_study',
      label: `${study.studyCode} · ${study.title}`,
      subtitle: `LNA · ${study.status}`,
      verificationState: studyState,
      detailPath: `/lna/${study.id}`,
      entityId: study.id,
      entityType: 'research_study',
      x: X_LNA,
      y: rowY,
    });

    // Connected PESTEL Issues
    const linkedIssues = pestelIssues.filter(
      (p) => study.linkedPestelIds.includes(p.id) || p.linkedStudyIds.includes(study.id),
    );
    linkedIssues.forEach((issue, idx) => {
      const pNodeId = `pestel-${issue.id}`;
      const pState = mapStatusToVisualState(issue.status);
      addNode({
        id: pNodeId,
        kind: 'pestel',
        label: issue.title,
        subtitle: `${issue.categories.join(' · ')} · ${issue.status}`,
        verificationState: pState,
        detailPath: '/pestel',
        entityId: issue.id,
        entityType: 'pestel_issue',
        x: X_PESTEL,
        y: rowY + idx * 105,
      });
      addEdge({
        id: `e-${pNodeId}-${studyNodeId}`,
        source: pNodeId,
        target: studyNodeId,
        verificationState: pState,
        label: 'Masukan Strategis',
      });
    });

    // Department node
    const dept = orgMap.get(study.departmentId);
    const seg = orgMap.get(study.businessSegmentId);
    const deptNodeId = `dept-${study.departmentId}`;
    addNode({
      id: deptNodeId,
      kind: 'department',
      label: dept?.name || study.departmentId,
      subtitle: seg?.name || 'Bidang Bisnis PLN',
      verificationState: studyState,
      detailPath: dept ? `/lna/departemen/${dept.slug}` : '/lna',
      entityId: study.departmentId,
      entityType: 'department',
      x: X_DEPT,
      y: rowY,
    });
    addEdge({
      id: `e-${studyNodeId}-${deptNodeId}`,
      source: studyNodeId,
      target: deptNodeId,
      verificationState: studyState,
      label: 'Unit Penelitian',
    });

    // CCA & DNA
    const studyCcas = ccaList.filter((c) => c.researchStudyId === study.id);
    const studyDnas = dnaList.filter((d) => d.researchStudyId === study.id);
    let detailOffsetY = rowY;
    let lastStageNodeId = deptNodeId;

    for (const cca of studyCcas) {
      const cId = `cca-${cca.id}`;
      const cState = mapStatusToVisualState(cca.status);
      addNode({
        id: cId,
        kind: 'cca',
        label: `CCA: ${cca.competencyName}`,
        subtitle: `${cca.competencyType.toUpperCase()} · Level ${cca.currentLevel} → ${cca.requiredLevel}`,
        verificationState: cState,
        detailPath: '/cca',
        entityId: cca.id,
        entityType: 'cca_assessment',
        x: X_CCA_DNA,
        y: detailOffsetY,
      });
      addEdge({
        id: `e-${deptNodeId}-${cId}`,
        source: deptNodeId,
        target: cId,
        verificationState: cState,
      });
      lastStageNodeId = cId;
      detailOffsetY += 105;
    }

    for (const dna of studyDnas) {
      const dId = `dna-${dna.id}`;
      const dState = mapStatusToVisualState(dna.status);
      addNode({
        id: dId,
        kind: 'dna',
        label: `DNA: ${dna.futureCapabilityNeed}`,
        subtitle: `Prioritas ${dna.priority.toUpperCase()} · ${dna.status}`,
        verificationState: dState,
        detailPath: '/dna',
        entityId: dna.id,
        entityType: 'dna_assessment',
        x: X_CCA_DNA,
        y: detailOffsetY,
      });
      addEdge({
        id: `e-${deptNodeId}-${dId}`,
        source: deptNodeId,
        target: dId,
        verificationState: dState,
      });
      lastStageNodeId = dId;
      detailOffsetY += 105;
    }

    // TNA
    const studyTnas = tnaList.filter((t) => t.researchStudyId === study.id);
    let tnaY = rowY;
    for (const tna of studyTnas) {
      const tId = `tna-${tna.id}`;
      const tState = mapStatusToVisualState(tna.verificationStatus);
      const tParent = tna.dnaId && seenNodes.has(`dna-${tna.dnaId}`) ? `dna-${tna.dnaId}` : lastStageNodeId;
      addNode({
        id: tId,
        kind: 'tna',
        label: `${tna.tnaClassification === 'TNA_KORPORAT' ? 'TNA Korporat' : 'TNA Unit'}: ${tna.proposedTraining}`,
        subtitle: `${tna.participantCount} peserta · ${tna.verificationStatus}`,
        verificationState: tState,
        detailPath: '/tna',
        entityId: tna.id,
        entityType: 'tna_assessment',
        x: X_TNA,
        y: tnaY,
      });
      addEdge({
        id: `e-${tParent}-${tId}`,
        source: tParent,
        target: tId,
        verificationState: tState,
      });
      tnaY += 110;
    }

    // Recommendations & Learning Paths
    const studyRecs = recommendations.filter((r) => r.researchStudyId === study.id);
    let recY = rowY;
    for (const rec of studyRecs) {
      const rId = `rec-${rec.id}`;
      const rState = mapStatusToVisualState(rec.approvalStatus);
      const recSource = rec.tnaId && seenNodes.has(`tna-${rec.tnaId}`)
        ? `tna-${rec.tnaId}`
        : studyTnas.length > 0
          ? `tna-${studyTnas[0].id}`
          : lastStageNodeId;

      addNode({
        id: rId,
        kind: 'recommendation',
        label: rec.programTitle,
        subtitle: `${rec.isAiSuggested ? 'Usulan AI' : 'Terverifikasi'} · ${rec.approvalStatus}`,
        verificationState: rState,
        detailPath: '/recommendations',
        entityId: rec.id,
        entityType: 'learning_recommendation',
        x: X_REC,
        y: recY,
      });
      addEdge({
        id: `e-${recSource}-${rId}`,
        source: recSource,
        target: rId,
        verificationState: rState,
      });

      if (rec.learningPathId && pathMap.has(rec.learningPathId)) {
        const lp = pathMap.get(rec.learningPathId)!;
        const lpId = `lp-${lp.id}`;
        const lpState = mapStatusToVisualState(lp.status);
        addNode({
          id: lpId,
          kind: 'learning_path',
          label: lp.title,
          subtitle: `${lp.professionName} · ${lp.stages.length} tahap`,
          verificationState: lpState,
          detailPath: '/learning-paths',
          entityId: lp.id,
          entityType: 'learning_path',
          x: X_PATH,
          y: recY,
        });
        addEdge({
          id: `e-${rId}-${lpId}`,
          source: rId,
          target: lpId,
          verificationState: lpState,
        });
      }

      recY += 110;
    }

    rowY = Math.max(rowY + 140, detailOffsetY + 30, tnaY + 30, recY + 30);
  }

  return { nodes, edges };
}
