import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Project } from '../../../../../../shared/types';
import { useDocumentStore } from '@/store/documents';
import { EmptyState } from '@/components/atoms/EmptyState/EmptyState';
import styles from './DocumentsTab.module.css';

interface DocumentsTabProps {
	project: Project;
}

export function DocumentsTab({ project }: DocumentsTabProps) {
	const { documents, fetchDocuments, loading } = useDocumentStore();
	const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

	const projectDocs = documents[project.uuid] || [];

	useEffect(() => {
		fetchDocuments(project.uuid);
	}, [project.uuid, fetchDocuments]);

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
			{projectDocs.map((doc) => {
				const isExpanded = expandedDoc === doc.uuid;
				return (
					<div key={doc.uuid} className={styles.card}>
						<button
							className={styles.cardHeader}
							onClick={() => setExpandedDoc(isExpanded ? null : doc.uuid)}
						>
							<FileText size={14} className={styles.docIcon} />
							<span className={styles.docName}>{doc.name}</span>
							<span className={styles.docMeta}>
								{new Date(doc.createdAt).toLocaleDateString()}
							</span>
							{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
						</button>
						<AnimatePresence initial={false}>
							{isExpanded && doc.content && (
								<motion.div
									key="content"
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: 'auto', opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{ duration: 0.18, ease: 'easeInOut' }}
									style={{ overflow: 'hidden' }}
								>
									<div className={styles.content}>
										<ReactMarkdown
											components={{
												strong: ({ children }) => (
													<strong className={styles.bold}>
														{children}
													</strong>
												),
												h1: ({ children }) => (
													<h1 className={styles.h1}>{children}</h1>
												),
												h2: ({ children }) => (
													<h2 className={styles.h2}>{children}</h2>
												),
												h3: ({ children }) => (
													<h3 className={styles.h3}>{children}</h3>
												),
												p: ({ children }) => (
													<p className={styles.p}>{children}</p>
												),
												ul: ({ children }) => (
													<ul className={styles.ul}>{children}</ul>
												),
												ol: ({ children }) => (
													<ol className={styles.ol}>{children}</ol>
												),
												li: ({ children }) => (
													<li className={styles.li}>{children}</li>
												),
												blockquote: ({ children }) => (
													<blockquote className={styles.blockquote}>
														{children}
													</blockquote>
												),
												hr: () => <hr className={styles.hr} />,
												code: ({ children }) => (
													<code className={styles.inlineCode}>
														{children}
													</code>
												),
											}}
										>
											{doc.content}
										</ReactMarkdown>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				);
			})}
		</div>
	);
}
