import React, { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Save, Bold, Italic, Code, Heading2, Heading3, List, ListOrdered, Quote, Trash2 } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Extension } from '@tiptap/core';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { DOMParser as PmDOMParser } from 'prosemirror-model';
import styles from './DocEditor.module.css';

export interface DocEditorHandle {
	save: () => Promise<void>;
}

interface DocEditorProps {
	content: string | null;
	onSave: (content: string) => Promise<void> | void;
}

interface TocItem {
	text: string;
	level: number;
	pos: number;
}

function getMarkdown(editor: ReturnType<typeof useEditor>): string {
	if (!editor) return '';
	return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
}

interface TocContentProps {
	items: TocItem[];
	onScroll: (pos: number) => void;
	onDelete: (index: number) => void;
}

function TocContent({ items, onScroll, onDelete }: TocContentProps) {
	const minLevel = items.reduce((m, it) => Math.min(m, it.level), 6);

	// Build hierarchical numbering: 1 / 1.1 / 1.1.1
	const counters: number[] = [];
	const numbers = items.map((item) => {
		const depth = item.level - minLevel;
		counters.length = depth + 1;
		counters[depth] = (counters[depth] || 0) + 1;
		return counters.slice(0, depth + 1).join('.');
	});

	return (
		<div className={styles.toc}>
			{items.map((item, i) => {
				const indent = item.level - minLevel;
				return (
					<div key={i} className={styles.tocItem} data-level={item.level} style={{ paddingLeft: `${indent * 1.4}em` }}>
						<span className={styles.tocNumber}>{numbers[i]}</span>
						<button className={styles.tocLink} onClick={() => onScroll(item.pos)} title={item.text}>
							{item.text}
						</button>
						<button className={styles.tocDelete} onClick={() => onDelete(i)} title="Delete section">
							<Trash2 size={16} />
						</button>
					</div>
				);
			})}
		</div>
	);
}

export const DocEditor = forwardRef<DocEditorHandle, DocEditorProps>(function DocEditor({ content, onSave }, ref) {
	const [saving, setSaving] = useState(false);
	const [isDirty, setIsDirty] = useState(false);
	const [toc, setToc] = useState<TocItem[]>([]);
	const savedRef = useRef(content ?? '');
	const tocDomNode = useMemo(() => document.createElement('div'), []);
	const tocRootRef = useRef<Root | null>(null);

	// Stable callbacks stored in refs so the decoration plugin can always call the latest version
	const scrollToHeading = useRef((pos: number) => {});
	const deleteSection = useRef((index: number) => {});

	const TocExtension = useMemo(() => Extension.create({
		name: 'tocDecorator',
		addProseMirrorPlugins() {
			return [new Plugin({
				props: {
					decorations(state) {
						let afterFirstHeading: number | null = null;
						state.doc.descendants((node, pos) => {
							if (afterFirstHeading === null && node.type.name === 'heading' && node.attrs.level === 1) {
								afterFirstHeading = pos + node.nodeSize;
								return false;
							}
						});
						if (afterFirstHeading === null) return DecorationSet.empty;
						const deco = Decoration.widget(afterFirstHeading, tocDomNode, { key: 'toc', side: 1 });
						return DecorationSet.create(state.doc, [deco]);
					},
				},
			})];
		},
	}), [tocDomNode]);

	const editor = useEditor({
		extensions: [
			StarterKit,
			Markdown.configure({ html: false, tightLists: true }),
			Extension.create({
				name: 'markdownPaste',
				addProseMirrorPlugins() {
					const editor = this.editor;
					return [new Plugin({
						key: new PluginKey('markdownPaste'),
						props: {
							clipboardTextParser(text, context, plainText) {
								if (plainText) return null;
								const md = (editor.storage as unknown as { markdown: MarkdownStorage }).markdown;
								const html = md.parser.parse(text);
								const dom = document.createElement('div');
								dom.innerHTML = html;
								return PmDOMParser.fromSchema(editor.schema).parseSlice(dom, { preserveWhitespace: true, context });
							},
						},
					})];
				},
			}),
			Table.configure({ resizable: false }),
			TableRow,
			TableHeader,
			TableCell,
			Placeholder.configure({ placeholder: 'Start writing…' }),
			TocExtension,
		],
		content: content ?? '',
		editorProps: { attributes: { spellcheck: 'false' } },
		onUpdate({ editor }) {
			const md = getMarkdown(editor);
			setIsDirty(md !== savedRef.current);
		},
	});

	// Rebuild TOC on editor updates
	useEffect(() => {
		if (!editor) return;
		const rebuild = () => {
			const items: TocItem[] = [];
			editor.state.doc.descendants((node, pos) => {
				if (node.type.name === 'heading' && node.attrs.level > 1) {
					items.push({ text: node.textContent, level: node.attrs.level as number, pos });
				}
			});
			setToc(items);
		};
		rebuild();
		editor.on('update', rebuild);
		return () => { editor.off('update', rebuild); };
	}, [editor]);

	// Wire up stable callback refs
	useEffect(() => {
		scrollToHeading.current = (pos: number) => {
			editor?.chain().focus().setTextSelection(pos).scrollIntoView().run();
		};
	}, [editor]);

	useEffect(() => {
		deleteSection.current = (index: number) => {
			if (!editor) return;
			const from = toc[index].pos;
			let to = editor.state.doc.content.size;
			for (let i = index + 1; i < toc.length; i++) {
				if (toc[i].level <= toc[index].level) { to = toc[i].pos; break; }
			}
			editor.chain().deleteRange({ from, to }).run();
		};
	}, [editor, toc]);

	// Re-render React content into the decoration DOM node whenever toc changes
	useEffect(() => {
		if (!tocRootRef.current) {
			tocRootRef.current = createRoot(tocDomNode);
		}
		if (toc.length === 0) {
			tocRootRef.current.render(<></>);
		} else {
			tocRootRef.current.render(
				<TocContent
					items={toc}
					onScroll={(pos) => scrollToHeading.current(pos)}
					onDelete={(i) => deleteSection.current(i)}
				/>
			);
		}
	}, [toc, tocDomNode]);

	// Sync content only on initial mount (when editor first becomes available)
	const initializedRef = useRef(false);
	useEffect(() => {
		if (!editor || initializedRef.current) return;
		initializedRef.current = true;
		editor.commands.setContent(content ?? '');
		savedRef.current = content ?? '';
		setIsDirty(false);
	}, [editor]);

	const handleSave = useCallback(async () => {
		if (!editor) return;
		const md = getMarkdown(editor);
		setSaving(true);
		try {
			await onSave(md);
			savedRef.current = md;
			setIsDirty(false);
		} finally {
			setSaving(false);
		}
	}, [editor, onSave]);

	useImperativeHandle(ref, () => ({
		save: handleSave,
	}), [handleSave]);

	// Auto-save after 1s of inactivity
	const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (!isDirty) return;
		if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
		autoSaveTimer.current = setTimeout(() => { handleSave(); }, 1000);
		return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
	}, [isDirty, handleSave]);

	return (
		<div className={styles.editor}>
			{editor && (
				<BubbleMenu editor={editor} className={styles.bubbleMenu}>
					<button
						className={`${styles.bubbleBtn} ${editor.isActive('bold') ? styles.bubbleBtnActive : ''}`}
						onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
						title="Bold"
					><Bold size={13} /></button>
					<button
						className={`${styles.bubbleBtn} ${editor.isActive('italic') ? styles.bubbleBtnActive : ''}`}
						onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
						title="Italic"
					><Italic size={13} /></button>
					<button
						className={`${styles.bubbleBtn} ${editor.isActive('code') ? styles.bubbleBtnActive : ''}`}
						onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}
						title="Inline code"
					><Code size={13} /></button>
					<div className={styles.bubbleDivider} />
					<button
						className={`${styles.bubbleBtn} ${editor.isActive('heading', { level: 2 }) ? styles.bubbleBtnActive : ''}`}
						onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
						title="Heading 2"
					><Heading2 size={13} /></button>
					<button
						className={`${styles.bubbleBtn} ${editor.isActive('heading', { level: 3 }) ? styles.bubbleBtnActive : ''}`}
						onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
						title="Heading 3"
					><Heading3 size={13} /></button>
					<div className={styles.bubbleDivider} />
					<button
						className={`${styles.bubbleBtn} ${editor.isActive('bulletList') ? styles.bubbleBtnActive : ''}`}
						onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
						title="Bullet list"
					><List size={13} /></button>
					<button
						className={`${styles.bubbleBtn} ${editor.isActive('orderedList') ? styles.bubbleBtnActive : ''}`}
						onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
						title="Ordered list"
					><ListOrdered size={13} /></button>
					<button
						className={`${styles.bubbleBtn} ${editor.isActive('blockquote') ? styles.bubbleBtnActive : ''}`}
						onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
						title="Blockquote"
					><Quote size={13} /></button>
				</BubbleMenu>
			)}

			<div className={styles.contentWrap}>
				<EditorContent editor={editor} className={styles.editorContent} />
			</div>
		</div>
	);
});
