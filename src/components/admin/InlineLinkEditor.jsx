import { useEffect, useRef, useState } from 'react';

const normalizeHttpsUrl = (value) => {
    const candidate = String(value || '').trim();
    if (!candidate) return '';

    try {
        const parsed = new URL(candidate);
        return parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
        return '';
    }
};

const nodeIsInside = (root, node) => {
    if (!root || !node) return false;
    const element = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    return element === root || root.contains(element);
};

const appendTextWithBreaks = (parent, value) => {
    String(value || '').split('\n').forEach((part, index) => {
        if (index > 0) parent.append(document.createElement('br'));
        if (part) parent.append(document.createTextNode(part));
    });
};

const renderEditorValue = (root, value, links) => {
    if (!root) return;
    const text = String(value || '');
    const normalizedLinks = (Array.isArray(links) ? links : [])
        .map((link) => ({
            start: Number(link?.start),
            end: Number(link?.end),
            url: normalizeHttpsUrl(link?.url),
        }))
        .filter((link) => Number.isInteger(link.start)
            && Number.isInteger(link.end)
            && link.start >= 0
            && link.end > link.start
            && link.end <= text.length
            && link.url)
        .sort((first, second) => first.start - second.start || first.end - second.end);

    const fragment = document.createDocumentFragment();
    let cursor = 0;

    normalizedLinks.forEach((link) => {
        if (link.start < cursor) return;
        appendTextWithBreaks(fragment, text.slice(cursor, link.start));

        const anchor = document.createElement('a');
        anchor.href = link.url;
        anchor.dataset.newsletterLink = 'true';
        anchor.title = link.url;
        appendTextWithBreaks(anchor, text.slice(link.start, link.end));
        fragment.append(anchor);
        cursor = link.end;
    });

    appendTextWithBreaks(fragment, text.slice(cursor));
    root.replaceChildren(fragment);
};

const serializeEditorValue = (root) => {
    let text = '';
    const links = [];

    const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.nodeValue || '';
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tagName = node.tagName.toLowerCase();

        if (tagName === 'br') {
            text += '\n';
            return;
        }

        if (tagName === 'a') {
            const start = text.length;
            Array.from(node.childNodes).forEach(walk);
            const end = text.length;
            const url = normalizeHttpsUrl(node.getAttribute('href'));
            if (url && end > start) links.push({ start, end, url });
            return;
        }

        const isBlock = tagName === 'div' || tagName === 'p';
        if (isBlock && text && !text.endsWith('\n')) text += '\n';
        Array.from(node.childNodes).forEach(walk);
        if (isBlock && node.nextSibling && !text.endsWith('\n')) text += '\n';
    };

    Array.from(root?.childNodes || []).forEach(walk);
    return { text, links };
};

const closestLink = (root, node) => {
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const anchor = element?.closest?.('a[data-newsletter-link="true"]');
    return anchor && root?.contains(anchor) ? anchor : null;
};

export default function InlineLinkEditor({
    value,
    links,
    onChange,
    placeholder = 'Write your newsletter text here…',
    linkColor = '#2457d6',
    linkFontWeight = 600,
    linkFontStyle = 'normal',
    linkUnderline = true,
    allowNameInsertion = false,
}) {
    const editorRef = useRef(null);
    const savedRangeRef = useRef(null);
    const editingAnchorRef = useRef(null);
    const urlInputRef = useRef(null);
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [linkLabel, setLinkLabel] = useState('');
    const [linkUrl, setLinkUrl] = useState('https://');
    const [linkError, setLinkError] = useState('');

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || document.activeElement === editor || isLinkDialogOpen) return;
        renderEditorValue(editor, value, links);
    }, [value, links, isLinkDialogOpen]);

    useEffect(() => {
        if (!isLinkDialogOpen) return undefined;
        const frame = requestAnimationFrame(() => urlInputRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, [isLinkDialogOpen]);

    const emitChange = () => {
        if (!editorRef.current) return;
        onChange(serializeEditorValue(editorRef.current));
    };

    const captureSelection = () => {
        const editor = editorRef.current;
        const selection = window.getSelection();
        if (!editor || !selection?.rangeCount) return savedRangeRef.current;
        const range = selection.getRangeAt(0);
        if (!nodeIsInside(editor, range.commonAncestorContainer)) return savedRangeRef.current;
        savedRangeRef.current = range.cloneRange();
        return savedRangeRef.current;
    };

    const rangeAtEditorEnd = () => {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        return range;
    };

    const openLinkDialog = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const range = captureSelection() || rangeAtEditorEnd();
        savedRangeRef.current = range.cloneRange();
        const anchor = closestLink(editor, range.startContainer);
        editingAnchorRef.current = anchor;
        setLinkLabel(anchor?.textContent || range.toString());
        setLinkUrl(anchor?.href || 'https://');
        setLinkError('');
        setIsLinkDialogOpen(true);
    };

    const closeLinkDialog = () => {
        editingAnchorRef.current = null;
        setLinkError('');
        setIsLinkDialogOpen(false);
        editorRef.current?.focus();
    };

    const placeCaretAfter = (node) => {
        const selection = window.getSelection();
        const range = document.createRange();
        range.setStartAfter(node);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        savedRangeRef.current = range.cloneRange();
    };

    const applyLink = () => {
        const editor = editorRef.current;
        const normalizedUrl = normalizeHttpsUrl(linkUrl);
        const preservedLabel = linkLabel;
        if (!preservedLabel.trim()) {
            setLinkError('Add the words that should become clickable.');
            return;
        }
        if (!normalizedUrl) {
            setLinkError('Use a complete HTTPS link, beginning with https://');
            return;
        }

        editor.focus();
        let anchor = editingAnchorRef.current;
        if (anchor?.isConnected) {
            anchor.href = normalizedUrl;
            anchor.title = normalizedUrl;
            anchor.textContent = preservedLabel;
        } else {
            const range = savedRangeRef.current && nodeIsInside(editor, savedRangeRef.current.commonAncestorContainer)
                ? savedRangeRef.current
                : rangeAtEditorEnd();
            range.deleteContents();
            anchor = document.createElement('a');
            anchor.href = normalizedUrl;
            anchor.dataset.newsletterLink = 'true';
            anchor.title = normalizedUrl;
            anchor.textContent = preservedLabel;
            range.insertNode(anchor);
        }

        placeCaretAfter(anchor);
        emitChange();
        editingAnchorRef.current = null;
        setIsLinkDialogOpen(false);
    };

    const removeLink = () => {
        const anchor = editingAnchorRef.current;
        if (!anchor?.isConnected) return closeLinkDialog();
        const textNode = document.createTextNode(anchor.textContent || '');
        anchor.replaceWith(textNode);
        placeCaretAfter(textNode);
        emitChange();
        editingAnchorRef.current = null;
        setIsLinkDialogOpen(false);
    };

    const insertPlainText = (text) => {
        const editor = editorRef.current;
        const range = captureSelection() || rangeAtEditorEnd();
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        placeCaretAfter(textNode);
        emitChange();
        editor.focus();
    };

    return (
        <div
            className="inline-link-editor"
            style={{
                '--inline-link-color': linkColor,
                '--inline-link-weight': linkFontWeight,
                '--inline-link-style': linkFontStyle === 'italic' ? 'italic' : 'normal',
                '--inline-link-decoration': linkUnderline ? 'underline' : 'none',
            }}
        >
            <div className="inline-link-toolbar">
                <span>Text</span>
                <div className="inline-link-toolbar-actions">
                    {allowNameInsertion && (
                        <button
                            type="button"
                            onMouseDown={(event) => {
                                if (event.button !== 0) return;
                                event.preventDefault();
                                insertPlainText('{{first_name}}');
                            }}
                            onClick={(event) => {
                                if (event.detail === 0) insertPlainText('{{first_name}}');
                            }}
                        >
                            + Insert name
                        </button>
                    )}
                    <button
                        type="button"
                        onMouseDown={(event) => {
                            if (event.button !== 0) return;
                            event.preventDefault();
                            openLinkDialog();
                        }}
                        onClick={(event) => {
                            if (event.detail === 0) openLinkDialog();
                        }}
                    >
                        Add link <kbd>⌘K / Ctrl+K</kbd>
                    </button>
                </div>
            </div>
            <div
                ref={editorRef}
                className="box-input block-copy-editor inline-rich-text"
                contentEditable
                role="textbox"
                aria-label="Newsletter paragraph text"
                aria-multiline="true"
                data-placeholder={placeholder}
                suppressContentEditableWarning
                onInput={() => {
                    emitChange();
                    captureSelection();
                }}
                onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                        event.preventDefault();
                        openLinkDialog();
                    }
                }}
                onKeyUp={captureSelection}
                onMouseUp={captureSelection}
                onClick={(event) => {
                    if (event.target.closest('a')) event.preventDefault();
                    captureSelection();
                }}
                onPaste={(event) => {
                    event.preventDefault();
                    insertPlainText(event.clipboardData.getData('text/plain'));
                }}
                onBlur={(event) => {
                    if (event.currentTarget.parentElement?.contains(event.relatedTarget)) return;
                    emitChange();
                }}
            />

            {isLinkDialogOpen && (
                <div
                    className="inline-link-dialog"
                    role="dialog"
                    aria-label={editingAnchorRef.current ? 'Edit link' : 'Add link'}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            closeLinkDialog();
                        }
                    }}
                >
                    <label>
                        <span>Clickable text</span>
                        <input className="box-input" value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Read the full story" />
                    </label>
                    <label>
                        <span>HTTPS link</span>
                        <input
                            ref={urlInputRef}
                            className="box-input"
                            type="url"
                            value={linkUrl}
                            onChange={(event) => {
                                setLinkUrl(event.target.value);
                                setLinkError('');
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    applyLink();
                                }
                            }}
                            placeholder="https://example.com"
                        />
                    </label>
                    {linkError && <p className="inline-link-error">{linkError}</p>}
                    <div className="inline-link-dialog-actions">
                        {editingAnchorRef.current && <button type="button" className="text-button danger" onClick={removeLink}>Remove link</button>}
                        <button type="button" className="btn sec" onClick={closeLinkDialog}>Cancel</button>
                        <button type="button" className="btn pri" onClick={applyLink}>{editingAnchorRef.current ? 'Update link' : 'Add link'}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
