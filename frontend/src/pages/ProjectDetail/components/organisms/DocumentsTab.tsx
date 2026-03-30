import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Trash2, ShieldCheck, Upload, Download } from 'lucide-react';
import type { Document, Project } from '../../../../../../shared/types';
import { useDocumentStore, FILE_BASE_URL } from '@/store/documents';
import { usePhaseStore } from '@/store/phases';
import { useObjectiveStore } from '@/store/objectives';
import { EmptyState } from '@/components/atoms/EmptyState/EmptyState';
import { Modal } from '@/components/atoms/Modal/Modal';
import { DocEditor, type DocEditorHandle } from '@/components/molecules/DocEditor/DocEditor';
import styles from './DocumentsTab.module.css';

interface DocumentsTabProps {
	project: Project;
}

function DocCard({ doc, projectUuid }: { doc: Document; projectUuid: string }) {
	const { updateDocument, renameDocument, reviewDocument, deleteDocument } = useDocumentStore();
	const [open, setOpen] = useState(false);
	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState(doc.name);
	const editorRef = useRef<DocEditorHandle>(null);

	const handleClose = useCallback(async () => {
		await editorRef.current?.save();
		setOpen(false);
	}, []);

	const commitRename = async () => {
		const trimmed = nameDraft.trim();
		if (trimmed && trimmed !== doc.name) {
			await renameDocument(doc.uuid, trimmed, projectUuid);
		} else {
			setNameDraft(doc.name);
		}
		setEditingName(false);
	};

	const isFile = doc.type === 'file';
	const fileHref = doc.url ? `${FILE_BASE_URL}${doc.url}` : undefined;

	return (
		<>
			<div className={`${styles.card} ${doc.humanReviewed ? styles.cardReviewed : ''}`}>
				<div className={styles.cardHeader}>
					<div
						className={styles.cardExpand}
						onClick={() => {
							if (editingName) return;
							if (isFile && fileHref) {
								window.open(fileHref, '_blank', 'noopener');
							} else {
								setOpen(true);
							}
						}}
					>
						<FileText size={14} className={styles.docIcon} />
						{editingName ? (
							<input
								className={styles.docNameInput}
								value={nameDraft}
								autoFocus
								onChange={(e) => setNameDraft(e.target.value)}
								onBlur={commitRename}
								onKeyDown={(e) => {
									if (e.key === 'Enter') commitRename();
									if (e.key === 'Escape') {
										setNameDraft(doc.name);
										setEditingName(false);
									}
								}}
								onClick={(e) => e.stopPropagation()}
							/>
						) : (
							<span
								className={styles.docName}
								onDoubleClick={(e) => {
									e.stopPropagation();
									setNameDraft(doc.name);
									setEditingName(true);
								}}
							>
								{doc.name}
							</span>
						)}
						{doc.humanReviewed && (
							<span className={styles.reviewedBadge}>
								<ShieldCheck size={11} /> REVIEWED
							</span>
						)}
						<span className={styles.docMeta}>
							{new Date(doc.createdAt).toLocaleDateString()}
						</span>
						{isFile && fileHref && <Download size={14} className={styles.docIcon} />}
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
			</div>

			{!isFile && (
				<Modal
					open={open}
					title={doc.name}
					onClose={handleClose}
					size="wide"
				>
					<DocEditor
						ref={editorRef}
						content={doc.content}
						onSave={(content) => updateDocument(doc.uuid, content, projectUuid)}
					/>
				</Modal>
			)}
		</>
	);
}

export function DocumentsTab({ project }: DocumentsTabProps) {
	const { documents, fetchDocuments, uploadDocument, loading } = useDocumentStore();
	const { phases, fetchPhases } = usePhaseStore();
	const { objectives, fetchObjectives } = useObjectiveStore();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	const projectDocs = documents[project.uuid] || [];
	const projectPhases = (phases[project.uuid] || [])
		.slice()
		.sort((a, b) => a.orderIndex - b.orderIndex);

	useEffect(() => {
		fetchDocuments(project.uuid);
		fetchPhases(project.uuid);
	}, [project.uuid]);

	useEffect(() => {
		projectPhases.forEach((p) => fetchObjectives(p.uuid));
	}, [projectPhases.length]);

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true);
		try {
			await uploadDocument(project.uuid, file);
		} finally {
			setUploading(false);
			e.target.value = '';
		}
	};

	const projectLevelDocs = projectDocs.filter((d) => d.phaseId === null);

	return (
		<div className={styles.wrapper}>
			<div className={styles.toolbar}>
				<input
					ref={fileInputRef}
					type="file"
					className={styles.hiddenInput}
					onChange={handleUpload}
				/>
				<button
					className={styles.uploadBtn}
					onClick={() => fileInputRef.current?.click()}
					disabled={uploading}
				>
					<Upload size={14} />
					{uploading ? 'Uploading...' : 'Upload file'}
				</button>
			</div>

			{loading && projectDocs.length === 0 ? (
				<EmptyState message="Loading documents..." />
			) : projectDocs.length === 0 ? (
				<EmptyState
					icon={<FileText size={32} />}
					message="No documents yet. Upload a file or run GENERATE OBJECTIVES in the Discovery phase."
				/>
			) : (
				<div className={styles.list}>
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

					{projectPhases.map((phase) => {
						const phaseDocs = projectDocs.filter((d) => d.phaseId === phase.id);
						if (phaseDocs.length === 0) return null;

						const phaseOnlyDocs = phaseDocs.filter((d) => d.objectiveId === null);
						const objectivesWithDocs = Object.values(objectives[phase.uuid] || [])
							.slice()
							.sort((a, b) => a.orderIndex - b.orderIndex)
							.filter((obj) => phaseDocs.some((d) => d.objectiveId === obj.id));
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
			)}
		</div>
	);
}
