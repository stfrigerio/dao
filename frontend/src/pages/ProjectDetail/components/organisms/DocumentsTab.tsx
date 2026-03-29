import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, ChevronDown, ChevronRight, Trash2, ShieldCheck } from 'lucide-react';
import type { Document, Project } from '../../../../../../shared/types';
import { useDocumentStore } from '@/store/documents';
import { usePhaseStore } from '@/store/phases';
import { useObjectiveStore } from '@/store/objectives';
import { EmptyState } from '@/components/atoms/EmptyState/EmptyState';
import { DocEditor } from '@/components/molecules/DocEditor/DocEditor';
import styles from './DocumentsTab.module.css';

interface DocumentsTabProps {
	project: Project;
}

function DocCard({
	doc,
	projectUuid,
}: {
	doc: Document;
	projectUuid: string;
}) {
	const { updateDocument, reviewDocument, deleteDocument } = useDocumentStore();
	const [expanded, setExpanded] = useState(false);

	return (
		<div className={`${styles.card} ${doc.humanReviewed ? styles.cardReviewed : ''}`}>
			<div className={styles.cardHeader}>
				<div className={styles.cardExpand} onClick={() => setExpanded((v) => !v)}>
					<FileText size={14} className={styles.docIcon} />
					<span className={styles.docName}>{doc.name}</span>
					{doc.humanReviewed && (
						<span className={styles.reviewedBadge}>
							<ShieldCheck size={11} /> REVIEWED
						</span>
					)}
					<span className={styles.docMeta}>{new Date(doc.createdAt).toLocaleDateString()}</span>
					{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
				</div>
				<button
					className={`${styles.reviewBtn} ${doc.humanReviewed ? styles.reviewBtnDone : ''}`}
					onClick={() => reviewDocument(doc.uuid, projectUuid, !doc.humanReviewed)}
					aria-label={doc.humanReviewed ? 'unmark reviewed' : 'mark as reviewed'}
					title={doc.humanReviewed ? 'Reviewed — click to undo' : 'Mark as reviewed'}
				>
					<ShieldCheck size={16} />
				</button>
				<button
					className={styles.deleteBtn}
					onClick={() => deleteDocument(doc.uuid, projectUuid)}
					aria-label="delete document"
				>
					<Trash2 size={16} />
				</button>
			</div>
			<AnimatePresence initial={false}>
				{expanded && (
					<motion.div
						key="content"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.18, ease: 'easeInOut' }}
						style={{ overflow: 'hidden' }}
					>
						<DocEditor
							content={doc.content}
							onSave={(content) => updateDocument(doc.uuid, content, projectUuid)}
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

export function DocumentsTab({ project }: DocumentsTabProps) {
	const { documents, fetchDocuments, loading } = useDocumentStore();
	const { phases, fetchPhases } = usePhaseStore();
	const { objectives, fetchObjectives } = useObjectiveStore();

	const projectDocs = documents[project.uuid] || [];
	const projectPhases = (phases[project.uuid] || []).slice().sort((a, b) => a.orderIndex - b.orderIndex);

	useEffect(() => {
		fetchDocuments(project.uuid);
		fetchPhases(project.uuid);
	}, [project.uuid]);

	useEffect(() => {
		projectPhases.forEach((p) => fetchObjectives(p.uuid));
	}, [projectPhases.length]);

	// Flatten all objectives from the store, keyed by id
	const objectiveById = new Map(
		Object.values(objectives)
			.flat()
			.map((o) => [o.id, o])
	);

	// Partition docs
	const projectLevelDocs = projectDocs.filter((d) => d.phaseId === null);

	if (loading && projectDocs.length === 0) {
		return <EmptyState message="Loading documents..." />;
	}

	if (projectDocs.length === 0) {
		return (
			<EmptyState
				icon={<FileText size={32} />}
				message="No documents yet. Open the Discovery phase and run GENERATE OBJECTIVES first."
			/>
		);
	}

	return (
		<div className={styles.list}>
			{/* Project-level docs (e.g. Project Brief) */}
			{projectLevelDocs.length > 0 && (
				<div className={styles.group}>
					<p className={styles.groupLabel}>Project</p>
					<div className={styles.groupDocs}>
						{projectLevelDocs.map((doc) => (
							<DocCard key={doc.uuid} doc={doc} projectUuid={project.uuid} />
						))}
					</div>
				</div>
			)}

			{/* Per-phase groups */}
			{projectPhases.map((phase) => {
				const phaseDocs = projectDocs.filter((d) => d.phaseId === phase.id);
				if (phaseDocs.length === 0) return null;

				// Docs not tied to any objective
				const phaseOnlyDocs = phaseDocs.filter((d) => d.objectiveId === null);

				// Collect objectives that have docs, preserving order
				const objectivesWithDocs = Object.values(objectives[phase.uuid] || [])
					.slice()
					.sort((a, b) => a.orderIndex - b.orderIndex)
					.filter((obj) => phaseDocs.some((d) => d.objectiveId === obj.id));

				// Docs with objectiveId not found in store (fallback)
				const knownObjIds = new Set(objectivesWithDocs.map((o) => o.id));
				const orphanDocs = phaseDocs.filter(
					(d) => d.objectiveId !== null && !knownObjIds.has(d.objectiveId)
				);

				return (
					<div key={phase.uuid} className={styles.group}>
						<p className={styles.groupLabel}>{phase.name}</p>
						<div className={styles.groupDocs}>
							{phaseOnlyDocs.map((doc) => (
								<DocCard key={doc.uuid} doc={doc} projectUuid={project.uuid} />
							))}
							{objectivesWithDocs.map((obj) => {
								const objDocs = phaseDocs.filter((d) => d.objectiveId === obj.id);
								return (
									<div key={obj.uuid} className={styles.subGroup}>
										<p className={styles.subGroupLabel}>{obj.name}</p>
										{objDocs.map((doc) => (
											<DocCard
												key={doc.uuid}
												doc={doc}
												projectUuid={project.uuid}
											/>
										))}
									</div>
								);
							})}
							{orphanDocs.map((doc) => (
								<DocCard key={doc.uuid} doc={doc} projectUuid={project.uuid} />
							))}
						</div>
					</div>
				);
			})}

			{/* Docs whose phase is not in the store */}
			{(() => {
				const knownPhaseIds = new Set(projectPhases.map((p) => p.id));
				const unknownPhaseDocs = projectDocs.filter(
					(d) => d.phaseId !== null && !knownPhaseIds.has(d.phaseId) && d.phaseId !== null
				);
				if (unknownPhaseDocs.length === 0) return null;
				return (
					<div className={styles.group}>
						<p className={styles.groupLabel}>Other</p>
						<div className={styles.groupDocs}>
							{unknownPhaseDocs.map((doc) => (
								<DocCard key={doc.uuid} doc={doc} projectUuid={project.uuid} />
							))}
						</div>
					</div>
				);
			})()}
		</div>
	);
}
