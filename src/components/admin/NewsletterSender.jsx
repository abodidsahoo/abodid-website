import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    createNewsletterBlock,
    createDefaultNewsletterBlocks,
    DEFAULT_NEWSLETTER_HEADING_TEXT,
    DEFAULT_NEWSLETTER_SETTINGS,
    DEFAULT_NEWSLETTER_SUBHEADING_TEXT,
    getNewsletterColumnItems,
    newsletterHasContent,
} from '../../lib/newsletter/blocks.js';
import { compileNewsletterEmail } from '../../lib/newsletter/compiler.js';
import { isNewsletterGifAsset, pickNewsletterMedia } from '../../lib/newsletter/media.js';
import NewsletterBlockEditor, { NewsletterBlockInsertToolbar } from './NewsletterBlockEditor';
import './newsletter-sender.css';

const EMPTY_EMAIL_PREVIEW_DOCUMENT = '<!doctype html><html><head></head><body></body></html>';
const NEWSLETTER_TEST_EMAIL = 'abodidsahoo@gmail.com';

const NEWSLETTER_REVIEW_LABELS = {
    headingGroup: 'Heading + Sub',
    heading: 'Heading',
    subheading: 'Subheading',
    smallText: 'Short text',
    text: 'Paragraph',
    link: 'Link',
    image: 'Image',
    gif: 'GIF',
    button: 'Button',
    divider: 'Divider',
    spacer: 'Spacer',
    columns: 'Columns',
};

const newsletterBlockWillRender = (block) => {
    if (!block || typeof block !== 'object') return false;
    if (block.type === 'headingGroup') return Boolean(block.headingText?.trim() || block.subheadingText?.trim());
    if (['heading', 'subheading', 'smallText', 'text'].includes(block.type)) return Boolean(block.text?.trim());
    if (block.type === 'link') return Boolean(block.text?.trim() && block.url?.trim());
    if (block.type === 'image' || block.type === 'gif') return Boolean(block.imageUrl?.trim() || block.previewImageUrl?.trim());
    if (block.type === 'button') return Boolean(block.label?.trim() && block.url?.trim());
    if (block.type === 'divider' || block.type === 'spacer') return true;
    if (block.type === 'columns') return block.columns?.some((column) => getNewsletterColumnItems(column).some((item) => {
        if (item.type === 'heading' || item.type === 'text') return Boolean(item.text?.trim());
        if (item.type === 'image') return Boolean(item.imageUrl?.trim() || item.previewImageUrl?.trim());
        if (item.type === 'button' || item.type === 'link') return Boolean(item.label?.trim() || item.text?.trim()) && Boolean(item.url?.trim());
        return false;
    }));
    return false;
};

const newsletterReviewLabel = (block) => block.type === 'link' && /(?:\.pdf(?:$|[?#])|download=)/i.test(block.url || '')
    ? 'File link'
    : NEWSLETTER_REVIEW_LABELS[block.type] || block.type;

const getPrimaryNewsletterHeading = (newsletterBlocks = []) => {
    const headingGroup = newsletterBlocks.find((block) => block.type === 'headingGroup' && block.headingText?.trim());
    if (headingGroup) return headingGroup.headingText.trim();
    return newsletterBlocks.find((block) => block.type === 'heading' && block.text?.trim())?.text.trim() || '';
};

const getPrimaryNewsletterSubheading = (newsletterBlocks = []) => {
    const headingGroup = newsletterBlocks.find((block) => block.type === 'headingGroup' && block.subheadingText?.trim());
    if (headingGroup) return headingGroup.subheadingText.trim();
    return newsletterBlocks.find((block) => block.type === 'subheading' && block.text?.trim())?.text.trim() || '';
};

const loadMoodboardMedia = async () => {
    const { data, error } = await supabase
        .from('moodboard_items')
        .select('id, image_url, storage_path, title, tags, published, image_width, image_height, aspect_ratio')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(2000);

    if (error) throw error;
    return (data || []).filter((item) => item.image_url).map((item) => ({
        id: item.id,
        publicUrl: item.image_url,
        name: item.title || String(item.storage_path || '').split('/').pop() || 'Mood board image',
        altText: item.title || '',
        isGif: isNewsletterGifAsset(item),
        isLandscape: Number(item.aspect_ratio) > 1
            || (Number(item.image_width) > 0
                && Number(item.image_height) > 0
                && Number(item.image_width) > Number(item.image_height)),
    }));
};

const mediaPreview = (sample) => sample ? {
    imageUrl: sample.publicUrl,
    alt: sample.altText || sample.name || '',
    previewImageUrl: '',
    previewImageAlt: '',
} : {};

const promotePreviewMedia = (item) => item?.imageUrl || !item?.previewImageUrl
    ? item
    : {
        ...item,
        imageUrl: item.previewImageUrl,
        alt: item.alt || item.previewImageAlt || '',
        previewImageUrl: '',
        previewImageAlt: '',
    };

const removeRetiredNewsletterBlocks = (blocks) => (Array.isArray(blocks) ? blocks : [])
    .filter((block) => block?.type !== 'caseStudy');

const addMoodboardPreviews = (blocks, moodboardMedia) => {
    const availableMedia = Array.isArray(moodboardMedia) ? moodboardMedia : [];
    return blocks.map((block) => {
        if (block.type === 'image' || block.type === 'gif') {
            const promotedBlock = promotePreviewMedia(block);
            if (promotedBlock.imageUrl) return { ...promotedBlock, previewLoading: false };
            const sample = pickNewsletterMedia(availableMedia, block.type);
            return { ...promotedBlock, ...mediaPreview(sample), previewLoading: false };
        }

        if (block.type === 'columns' && Array.isArray(block.columns)) {
            const usedImageUrls = new Set(block.columns.flatMap((column) => (column.items || [])
                .filter((item) => item.type === 'image')
                .map((item) => item.imageUrl || item.previewImageUrl)
                .filter(Boolean)));
            return {
                ...block,
                columns: block.columns.map((column) => ({
                    ...column,
                    items: Array.isArray(column.items) ? column.items.map((item) => {
                        if (item.type !== 'image') return item;
                        const promotedItem = promotePreviewMedia(item);
                        if (promotedItem.imageUrl) return { ...promotedItem, previewLoading: false };
                        const sample = pickNewsletterMedia(availableMedia, 'image', usedImageUrls);
                        if (sample) usedImageUrls.add(sample.publicUrl);
                        return { ...promotedItem, ...mediaPreview(sample), previewLoading: false };
                    }) : column.items,
                })),
            };
        }

        return block;
    });
};

function syncPreviewAttributes(targetElement, sourceElement) {
    const sourceAttributeNames = new Set(Array.from(sourceElement.attributes, ({ name }) => name));

    Array.from(targetElement.attributes).forEach(({ name }) => {
        if (!sourceAttributeNames.has(name)) targetElement.removeAttribute(name);
    });

    Array.from(sourceElement.attributes).forEach(({ name, value }) => {
        if (targetElement.getAttribute(name) !== value) targetElement.setAttribute(name, value);
    });
}

function syncPreviewNode(targetNode, sourceNode) {
    if (targetNode.nodeType !== sourceNode.nodeType || targetNode.nodeName !== sourceNode.nodeName) {
        targetNode.replaceWith(sourceNode.cloneNode(true));
        return;
    }

    if (targetNode.nodeType === 3 || targetNode.nodeType === 8) {
        if (targetNode.nodeValue !== sourceNode.nodeValue) targetNode.nodeValue = sourceNode.nodeValue;
        return;
    }

    if (targetNode.nodeType !== 1) return;
    syncPreviewAttributes(targetNode, sourceNode);

    let childIndex = 0;
    while (childIndex < sourceNode.childNodes.length || childIndex < targetNode.childNodes.length) {
        const targetChild = targetNode.childNodes[childIndex];
        const sourceChild = sourceNode.childNodes[childIndex];

        if (!sourceChild && targetChild) {
            targetChild.remove();
            continue;
        }

        if (sourceChild && !targetChild) {
            targetNode.appendChild(sourceChild.cloneNode(true));
            childIndex += 1;
            continue;
        }

        syncPreviewNode(targetChild, sourceChild);
        childIndex += 1;
    }
}

function updateEmailPreviewFrame(frame, html) {
    const previewDocument = frame?.contentDocument;
    if (!previewDocument?.documentElement || typeof DOMParser === 'undefined') return;

    const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
    const scrollTop = previewDocument.scrollingElement?.scrollTop || 0;
    syncPreviewNode(previewDocument.documentElement, parsedDocument.documentElement);
    if (previewDocument.scrollingElement) previewDocument.scrollingElement.scrollTop = scrollTop;
}

function StableEmailPreview({ title, html }) {
    const frameRef = useRef(null);
    const latestHtmlRef = useRef(html);
    latestHtmlRef.current = html;

    useEffect(() => {
        const animationFrame = window.requestAnimationFrame(() => {
            updateEmailPreviewFrame(frameRef.current, latestHtmlRef.current);
        });

        return () => window.cancelAnimationFrame(animationFrame);
    }, [html]);

    return (
        <iframe
            ref={frameRef}
            title={title}
            srcDoc={EMPTY_EMAIL_PREVIEW_DOCUMENT}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => updateEmailPreviewFrame(frameRef.current, latestHtmlRef.current)}
        />
    );
}

function EmailBackdropControl({ value, onChange }) {
    const pickerValue = /^#[0-9a-f]{6}$/i.test(value || '')
        ? value
        : DEFAULT_NEWSLETTER_SETTINGS.outerBackgroundColor;

    return (
        <label className="email-backdrop-control">
            <span>Email backdrop</span>
            <span className="email-backdrop-inputs">
                <input
                    type="color"
                    value={pickerValue}
                    onChange={(event) => onChange(event.target.value)}
                    aria-label="Email backdrop colour picker"
                />
                <input
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    aria-label="Email backdrop hex value"
                    maxLength={7}
                />
            </span>
        </label>
    );
}

function FullGmailPreview({
    subject,
    senderName,
    senderEmail,
    html,
    backdropColor,
    onBackdropChange,
    onClose,
}) {
    const displaySubject = subject.trim() || 'Your subject line';
    const displaySender = senderName.trim() || 'Abodid Sahoo';

    return (
        <div className="full-gmail-preview-backdrop">
            <section
                className="full-gmail-preview-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="full-gmail-preview-title"
            >
                <button
                    type="button"
                    className="full-gmail-preview-close"
                    onClick={onClose}
                    aria-label="Close full Gmail preview"
                    autoFocus
                >
                    <span aria-hidden="true">×</span>
                </button>

                <header className="full-gmail-topbar">
                    <span className="full-gmail-menu" aria-hidden="true">☰</span>
                    <span className="full-gmail-brand">
                        <img src="/images/admin/gmail-logo.png" alt="" width="30" height="30" />
                        <strong>Gmail</strong>
                    </span>
                    <span className="full-gmail-search" aria-hidden="true">
                        <span>⌕</span>
                        Search mail
                        <i>☷</i>
                    </span>
                    <span className="full-gmail-top-actions" aria-hidden="true">
                        <i>?</i>
                        <i>⚙</i>
                        <i className="apps">⠿</i>
                        <i className="avatar">A</i>
                    </span>
                </header>

                <div className="full-gmail-workspace">
                    <aside className="full-gmail-sidebar" aria-label="Gmail navigation mockup">
                        <button type="button" className="full-gmail-compose" tabIndex={-1}>
                            <span aria-hidden="true">✎</span>
                            Compose
                        </button>
                        <nav>
                            <span className="active"><i aria-hidden="true">▰</i>Inbox<strong>21</strong></span>
                            <span><i aria-hidden="true">☆</i>Starred</span>
                            <span><i aria-hidden="true">◷</i>Snoozed</span>
                            <span><i aria-hidden="true">◇</i>Important</span>
                            <span><i aria-hidden="true">▷</i>Sent</span>
                            <span><i aria-hidden="true">▤</i>Drafts<strong>8</strong></span>
                            <span><i aria-hidden="true">⌄</i>More</span>
                        </nav>
                    </aside>

                    <main className="full-gmail-thread">
                        <div className="full-gmail-reader-toolbar">
                            <span className="full-gmail-reader-icons" aria-hidden="true">
                                <i>←</i><i>▣</i><i>!</i><i>⌫</i><b /><i>✉</i><i>◷</i><i>◇</i><i>⋮</i>
                            </span>
                            <EmailBackdropControl value={backdropColor} onChange={onBackdropChange} />
                            <span className="full-gmail-reader-count" aria-hidden="true">1 of 1&nbsp;&nbsp; ‹ &nbsp;›</span>
                        </div>

                        <div className="full-gmail-subject-row">
                            <h2 id="full-gmail-preview-title">{displaySubject}</h2>
                            <span aria-hidden="true">›</span>
                            <small>Inbox ×</small>
                            <span className="full-gmail-subject-actions" aria-hidden="true">▣ &nbsp;↗</span>
                        </div>

                        <div className="full-gmail-sender-row">
                            <span className="full-gmail-sender-avatar" aria-hidden="true">{displaySender.charAt(0).toUpperCase()}</span>
                            <span className="full-gmail-sender-copy">
                                <strong>{displaySender}</strong>
                                <small>&lt;{senderEmail}&gt;</small>
                                <span>to me⌄</span>
                            </span>
                            <span className="full-gmail-unsubscribe">Unsubscribe</span>
                            <span className="full-gmail-sender-actions" aria-hidden="true">Now&nbsp;&nbsp; ☆ &nbsp;↩ &nbsp;⋮</span>
                        </div>

                        <div className="full-gmail-email-viewport">
                            <StableEmailPreview title="Full-window Gmail newsletter preview" html={html} />
                        </div>
                    </main>
                </div>
            </section>
        </div>
    );
}

export default function NewsletterSender({ accessToken }) {
    const [subject, setSubject] = useState('');
    const [previewText, setPreviewText] = useState('');
    const [blocks, setBlocks] = useState(() => createDefaultNewsletterBlocks());
    const [emailSettings, setEmailSettings] = useState(() => ({ ...DEFAULT_NEWSLETTER_SETTINGS }));
    const [newsletterId, setNewsletterId] = useState(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [templateName, setTemplateName] = useState('');
    const [savedTemplates, setSavedTemplates] = useState([]);
    const [draftStatus, setDraftStatus] = useState('idle');
    const [draftStatusMsg, setDraftStatusMsg] = useState('');
    const [isDraftDirty, setIsDraftDirty] = useState(false);
    const [draftsAvailable, setDraftsAvailable] = useState(true);
    const [status, setStatus] = useState('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const [subscriberCount, setSubscriberCount] = useState(0);
    const [subscribers, setSubscribers] = useState([]);
    const [subscribersLoading, setSubscribersLoading] = useState(true);
    const [subscriberError, setSubscriberError] = useState('');
    const [subscriberSearch, setSubscriberSearch] = useState('');
    const [audienceMode, setAudienceMode] = useState('all');
    const [selectedSubscriberIds, setSelectedSubscriberIds] = useState([]);
    const [isSubscriberPickerOpen, setIsSubscriberPickerOpen] = useState(false);
    const [isAddSubscriberOpen, setIsAddSubscriberOpen] = useState(false);
    const [previewMode, setPreviewMode] = useState('desktop');
    const [isFullGmailPreviewOpen, setIsFullGmailPreviewOpen] = useState(false);
    const [iphoneNotificationApp, setIphoneNotificationApp] = useState('mail');
    const [activeCampaignTab, setActiveCampaignTab] = useState('design');
    const [focusBlockId, setFocusBlockId] = useState(null);
    const [newSubscriber, setNewSubscriber] = useState('');
    const [addSubStatus, setAddSubStatus] = useState('');
    const [senderName, setSenderName] = useState('Abodid Sahoo');
    const [senderEmail, setSenderEmail] = useState('hello@abodid.com');
    const [savedSenderEmails, setSavedSenderEmails] = useState([
        'hello@abodid.com',
        'newsletter@abodid.com',
    ]);
    const [isAddingEmail, setIsAddingEmail] = useState(false);
    const [tempNewEmail, setTempNewEmail] = useState('');
    const moodboardMediaRef = useRef([]);
    const moodboardMediaPromiseRef = useRef(null);

    useEffect(() => {
        fetchSubscribers();
        fetchSavedTemplates();
    }, []);

    useEffect(() => {
        if (!isSubscriberPickerOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setIsSubscriberPickerOpen(false);
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [isSubscriberPickerOpen]);

    useEffect(() => {
        if (!isSubscriberPickerOpen) setIsAddSubscriberOpen(false);
    }, [isSubscriberPickerOpen]);

    useEffect(() => {
        if (!isFullGmailPreviewOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setIsFullGmailPreviewOpen(false);
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [isFullGmailPreviewOpen]);

    const fetchSubscribers = async () => {
        setSubscribersLoading(true);
        setSubscriberError('');

        const { data, error } = await supabase
            .from('subscribers')
            .select('id, email, name')
            .eq('status', 'active')
            .order('email', { ascending: true });

        if (error) {
            setSubscribers([]);
            setSubscriberCount(0);
            setSubscriberError('Could not load subscribers. Please refresh and try again.');
        } else {
            const activeSubscribers = data || [];
            const activeIds = new Set(activeSubscribers.map((subscriber) => subscriber.id));
            setSubscribers(activeSubscribers);
            setSubscriberCount(activeSubscribers.length);
            setSelectedSubscriberIds((currentIds) => currentIds.filter((id) => activeIds.has(id)));
        }
        setSubscribersLoading(false);

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            setDraftStatus('error');
            setDraftStatusMsg('Your session has expired. Refresh the page and sign in again.');
            return null;
        }
    };

    const fetchSavedTemplates = async () => {
        const { data, error } = await supabase
            .from('newsletters')
            .select('id, template_name, subject, preview_text, blocks, settings, sender_name, sender_email, status, updated_at')
            .eq('is_template', true)
            .order('updated_at', { ascending: false });

        if (error) {
            setDraftsAvailable(false);
            setDraftStatusMsg('Saved formats will be available after the newsletter template migration is applied.');
            return;
        }

        setDraftsAvailable(true);
        setSavedTemplates(data || []);
    };

    const markDraftDirty = () => {
        setIsDraftDirty(true);
        if (draftStatus === 'saved') setDraftStatus('idle');
    };

    const updateSubject = (value) => {
        setSubject(value);
        markDraftDirty();
    };

    const updatePreviewText = (value) => {
        setPreviewText(value);
        markDraftDirty();
    };

    const updateEmailBackdrop = (value) => {
        setEmailSettings((currentSettings) => ({
            ...currentSettings,
            outerBackgroundColor: value,
        }));
        markDraftDirty();
    };

    const updateBlocks = (nextBlocks) => {
        const currentHeading = getPrimaryNewsletterHeading(blocks);
        const currentSubheading = getPrimaryNewsletterSubheading(blocks);
        const nextHeading = getPrimaryNewsletterHeading(nextBlocks);
        const nextSubheading = getPrimaryNewsletterSubheading(nextBlocks);

        setSubject((currentSubject) => (
            !currentSubject.trim() || currentSubject.trim() === currentHeading
                ? nextHeading
                : currentSubject
        ));
        setPreviewText((currentPreviewText) => (
            !currentPreviewText.trim() || currentPreviewText.trim() === currentSubheading
                ? nextSubheading
                : currentPreviewText
        ));
        setBlocks(nextBlocks);
        markDraftDirty();
    };

    const getMoodboardMedia = async () => {
        if (moodboardMediaRef.current.length) return moodboardMediaRef.current;
        if (!accessToken) return [];
        if (!moodboardMediaPromiseRef.current) {
            moodboardMediaPromiseRef.current = loadMoodboardMedia()
                .then((media) => {
                    moodboardMediaRef.current = media;
                    return media;
                })
                .catch(() => [])
                .finally(() => {
                    moodboardMediaPromiseRef.current = null;
                });
        }
        return moodboardMediaPromiseRef.current;
    };

    const getRandomMediaPreview = (type = 'image') => mediaPreview(
        pickNewsletterMedia(moodboardMediaRef.current, type),
    );

    useEffect(() => {
        moodboardMediaRef.current = [];
        moodboardMediaPromiseRef.current = null;
        if (accessToken) {
            void getMoodboardMedia().then((media) => {
                setBlocks((currentBlocks) => addMoodboardPreviews(currentBlocks, media));
            });
        }
    }, [accessToken]);

    const addNewsletterBlock = (type) => {
        const usesMoodboardPreview = type === 'image' || type === 'gif' || type === 'columns';
        let newBlock;

        if (type === 'columns') {
            const emptyColumnsBlock = createNewsletterBlock(type);
            newBlock = moodboardMediaRef.current.length
                ? addMoodboardPreviews([emptyColumnsBlock], moodboardMediaRef.current)[0]
                : {
                    ...emptyColumnsBlock,
                    columns: emptyColumnsBlock.columns.map((column) => ({
                        ...column,
                        items: column.items.map((item) => item.type === 'image'
                            ? { ...item, previewLoading: true }
                            : item),
                    })),
                };
        } else {
            const preview = usesMoodboardPreview ? getRandomMediaPreview(type) : {};
            const overrides = usesMoodboardPreview
                ? { ...preview, previewLoading: !preview.previewImageUrl }
                : {};
            newBlock = createNewsletterBlock(type, overrides);
        }

        setBlocks((currentBlocks) => {
            const footerIndex = currentBlocks.findIndex((block) => block.type === 'footer');
            const insertAt = footerIndex === -1 ? currentBlocks.length : footerIndex;
            const nextBlocks = [...currentBlocks];
            nextBlocks.splice(insertAt, 0, newBlock);
            return nextBlocks;
        });
        markDraftDirty();
        setFocusBlockId(newBlock.id);

        const needsPreview = type === 'columns'
            ? newBlock.columns.some((column) => column.items.some((item) => item.type === 'image' && !item.imageUrl && !item.previewImageUrl))
            : usesMoodboardPreview && !newBlock.previewImageUrl;

        if (needsPreview) {
            void getMoodboardMedia().then((media) => {
                setBlocks((currentBlocks) => currentBlocks.map((block) => {
                    if (block.id !== newBlock.id) return block;
                    if (type === 'columns') return addMoodboardPreviews([block], media)[0];
                    if (block.imageUrl || block.previewImageUrl) return block;
                    return { ...block, ...mediaPreview(pickNewsletterMedia(media, type)), previewLoading: false };
                }));
            });
        }
    };

    const loadTemplate = (id) => {
        if (!id) return;
        if (isDraftDirty && !window.confirm('Replace the current design with this saved format?')) return;
        const selected = savedTemplates.find((template) => template.id === id);
        if (!selected) return;

        setNewsletterId(null);
        setSelectedTemplateId(selected.id);
        setTemplateName(selected.template_name || selected.subject || 'Untitled newsletter format');
        const supportedBlocks = removeRetiredNewsletterBlocks(selected.blocks);
        const nextBlocks = supportedBlocks.length ? supportedBlocks : createDefaultNewsletterBlocks();
        setSubject(selected.subject || getPrimaryNewsletterHeading(nextBlocks));
        setPreviewText(selected.preview_text || getPrimaryNewsletterSubheading(nextBlocks));
        setBlocks(addMoodboardPreviews(nextBlocks, moodboardMediaRef.current));
        setEmailSettings({
            ...DEFAULT_NEWSLETTER_SETTINGS,
            ...(selected.settings || {}),
            canvasBackgroundColor: DEFAULT_NEWSLETTER_SETTINGS.canvasBackgroundColor,
        });
        setSenderName(selected.sender_name || 'Abodid Sahoo');
        const nextSenderEmail = selected.sender_email || 'hello@abodid.com';
        setSenderEmail(nextSenderEmail);
        setSavedSenderEmails((currentEmails) => currentEmails.includes(nextSenderEmail)
            ? currentEmails
            : [...currentEmails, nextSenderEmail]);
        setIsDraftDirty(false);
        setDraftStatus('saved');
        setDraftStatusMsg('');
    };

    useEffect(() => {
        if (!savedTemplates.length || selectedTemplateId || isDraftDirty) return;
        loadTemplate(savedTemplates[0].id);
    }, [savedTemplates, selectedTemplateId, isDraftDirty]);

    const saveCampaignDraft = async () => {
        if (!draftsAvailable) {
            setDraftStatus('error');
            setDraftStatusMsg('Campaign storage is not ready yet. Apply the newsletter database migration first.');
            return null;
        }

        setDraftStatus('saving');
        setDraftStatusMsg('Saving draft…');

        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
            subject: subject.trim() || 'Untitled newsletter',
            preview_text: previewText,
            blocks,
            settings: emailSettings,
            sender_name: senderName,
            sender_email: senderEmail,
            status: 'draft',
            is_template: false,
            template_name: null,
        };

        const request = newsletterId
            ? supabase.from('newsletters').update(payload).eq('id', newsletterId).select().single()
            : supabase.from('newsletters').insert({ ...payload, created_by: user.id }).select().single();
        const { data, error } = await request;

        if (error) {
            setDraftStatus('error');
            setDraftStatusMsg(`Draft could not be saved: ${error.message}`);
            return null;
        }

        setNewsletterId(data.id);
        setIsDraftDirty(false);
        setDraftStatus('saved');
        setDraftStatusMsg('Campaign saved and ready for delivery.');
        return data.id;
    };

    const saveTemplate = async () => {
        const normalizedName = templateName.trim();
        if (!normalizedName) {
            setDraftStatus('error');
            setDraftStatusMsg('Give this newsletter format a name first.');
            return;
        }
        if (!draftsAvailable) {
            setDraftStatus('error');
            setDraftStatusMsg('Saved formats are not ready yet. Apply the newsletter template migration first.');
            return;
        }

        setDraftStatus('saving');
        setDraftStatusMsg('Tucking this format away…');

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            setDraftStatus('error');
            setDraftStatusMsg('Your session has expired. Refresh and sign in again.');
            return;
        }

        const payload = {
            template_name: normalizedName,
            is_template: true,
            subject: subject.trim() || 'Untitled newsletter',
            preview_text: previewText,
            blocks,
            settings: emailSettings,
            sender_name: senderName,
            sender_email: senderEmail,
            status: 'draft',
        };
        const request = selectedTemplateId
            ? supabase.from('newsletters').update(payload).eq('id', selectedTemplateId).select().single()
            : supabase.from('newsletters').insert({ ...payload, created_by: user.id }).select().single();
        const { data, error } = await request;

        if (error) {
            setDraftStatus('error');
            setDraftStatusMsg(`This format could not be saved: ${error.message}`);
            return;
        }

        setSelectedTemplateId(data.id);
        setTemplateName(data.template_name || normalizedName);
        setIsDraftDirty(false);
        setDraftStatus('saved');
        setDraftStatusMsg(`“${data.template_name || normalizedName}” is saved for future-you.`);
        await fetchSavedTemplates();
    };

    const handleAddSubscriber = async () => {
        if (!newSubscriber || !newSubscriber.includes('@')) {
            setAddSubStatus('Enter a valid email address.');
            return;
        }

        setAddSubStatus('Adding…');
        const { error } = await supabase
            .from('subscribers')
            .insert({ email: newSubscriber, source: 'admin_manual', status: 'active' });

        if (error) {
            setAddSubStatus(`Error: ${error.message}`);
        } else {
            setAddSubStatus('Added!');
            setNewSubscriber('');
            await fetchSubscribers();
            setIsAddSubscriberOpen(false);
            setAddSubStatus('');
        }
    };

    const handleSend = async (isTest = false) => {
        if (!subject.trim() || !newsletterHasContent(blocks)) {
            setStatus('error');
            setStatusMsg('Add a subject line and at least one content block before sending.');
            return;
        }

        if (!senderEmail.endsWith('@abodid.com')) {
            setStatus('error');
            setStatusMsg('Sender email must end in @abodid.com.');
            return;
        }

        const count = isTest
            ? 1
            : audienceMode === 'selected'
                ? selectedSubscriberIds.length
                : subscriberCount;

        if (!isTest && audienceMode === 'selected' && count === 0) {
            setStatus('error');
            setStatusMsg('Select at least one subscriber before sending.');
            return;
        }

        const audienceDescription = audienceMode === 'selected'
            ? `${count} selected subscriber${count === 1 ? '' : 's'}`
            : `all ${count} active subscribers`;

        if (!isTest && !window.confirm(`Are you sure you want to send this to ${audienceDescription}?`)) {
            return;
        }

        let deliveryNewsletterId = newsletterId;
        if (!isTest && (isDraftDirty || !deliveryNewsletterId)) {
            deliveryNewsletterId = await saveCampaignDraft();
            if (!deliveryNewsletterId) {
                setStatus('error');
                setStatusMsg('Save the newsletter draft before sending.');
                return;
            }
        }

        setStatus('sending');
        setStatusMsg(isTest ? 'Sending test email…' : `Sending to ${audienceDescription}…`);

        try {
            const performSend = async (token) => {
                const response = await fetch('/api/admin/broadcast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        newsletterId: deliveryNewsletterId,
                        subject,
                        previewText,
                        blocks,
                        settings: emailSettings,
                        senderName,
                        senderEmail,
                        isTest,
                        audienceMode,
                        recipientIds: audienceMode === 'selected' ? selectedSubscriberIds : undefined,
                    }),
                });

                if (response.status === 401) throw new Error('Unauthorized');
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to send');
                return result;
            };

            const sessionData = await supabase.auth.getSession();
            let token = sessionData.data.session?.access_token;
            let result;

            try {
                result = await performSend(token);
            } catch (firstError) {
                if (firstError.message !== 'Unauthorized') throw firstError;
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError || !refreshData.session) {
                    throw new Error('Session expired. Please refresh the page and log in again.');
                }
                token = refreshData.session.access_token;
                result = await performSend(token);
            }

            setStatus('success');
            let nextMessage = isTest
                ? `Test sent to ${NEWSLETTER_TEST_EMAIL}.`
                : audienceMode === 'selected'
                    ? `Campaign sent to ${result.count} selected subscribers.`
                    : `Campaign sent to ${result.count} subscribers.`;

            if (result.failures > 0) {
                setStatus('error');
                nextMessage += ` ${result.failures} failed to send.`;
                if (result.errors?.length) nextMessage += ` Errors: ${result.errors.join(', ')}`;
            }
            setStatusMsg(nextMessage);
            if (!isTest) {
                setIsDraftDirty(false);
            }
        } catch (error) {
            setStatus('error');
            setStatusMsg(error.message);
        }
    };

    const handleAddSenderEmail = () => {
        if (tempNewEmail && tempNewEmail.endsWith('@abodid.com') && !savedSenderEmails.includes(tempNewEmail)) {
            setSavedSenderEmails([...savedSenderEmails, tempNewEmail]);
            setSenderEmail(tempNewEmail);
            markDraftDirty();
            setIsAddingEmail(false);
            setTempNewEmail('');
        } else if (!tempNewEmail.endsWith('@abodid.com')) {
            alert('Email must end with @abodid.com');
        }
    };

    const toggleSubscriberSelection = (subscriberId) => {
        setAudienceMode('selected');
        setSelectedSubscriberIds((currentIds) => currentIds.includes(subscriberId)
            ? currentIds.filter((id) => id !== subscriberId)
            : [...currentIds, subscriberId]);
    };

    const normalizedSubscriberSearch = subscriberSearch.trim().toLowerCase();
    const filteredSubscribers = subscribers.filter((subscriber) => {
        if (!normalizedSubscriberSearch) return true;
        return [subscriber.email, subscriber.name]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedSubscriberSearch));
    });
    const selectedSubscriberIdSet = new Set(selectedSubscriberIds);
    const allVisibleSubscribersSelected = audienceMode === 'selected'
        && filteredSubscribers.length > 0
        && filteredSubscribers.every((subscriber) => selectedSubscriberIdSet.has(subscriber.id));

    const toggleVisibleSubscribers = () => {
        setAudienceMode('selected');
        setSelectedSubscriberIds((currentIds) => {
            const nextIds = new Set(currentIds);
            filteredSubscribers.forEach((subscriber) => {
                if (allVisibleSubscribersSelected) nextIds.delete(subscriber.id);
                else nextIds.add(subscriber.id);
            });
            return [...nextIds];
        });
    };

    const deliveryRecipientCount = audienceMode === 'selected'
        ? selectedSubscriberIds.length
        : subscriberCount;
    const hasNewsletterContent = newsletterHasContent(blocks);
    const primaryHeading = blocks.find((b) => b.type === 'heading')?.text?.trim() || '';
    const displaySubject = subject.trim() || primaryHeading || 'Your subject line';
    const hasNewsletterHeading = blocks.some((block) => (block.type === 'headingGroup' && block.headingText?.trim())
        || (block.type === 'heading' && block.text?.trim()));
    const hasNewsletterSubheading = blocks.some((block) => (block.type === 'headingGroup' && block.subheadingText?.trim())
        || (block.type === 'subheading' && block.text?.trim()));
    const populatedContentBlocks = blocks.filter((block) => block.type !== 'footer' && newsletterBlockWillRender(block));
    const contentBlockSummary = Array.from(populatedContentBlocks.reduce((summary, block) => {
        const label = newsletterReviewLabel(block);
        summary.set(label, (summary.get(label) || 0) + 1);
        return summary;
    }, new Map()), ([label, count]) => ({ label, count }));
    const emailBackgroundColor = /^#[0-9a-f]{6}$/i.test(emailSettings.outerBackgroundColor || '')
        ? emailSettings.outerBackgroundColor
        : DEFAULT_NEWSLETTER_SETTINGS.outerBackgroundColor;
    const usesDefaultEmailBackground = emailBackgroundColor.toLowerCase()
        === DEFAULT_NEWSLETTER_SETTINGS.outerBackgroundColor.toLowerCase();
    const campaignReady = Boolean(subject.trim() && hasNewsletterContent && deliveryRecipientCount > 0);
    const isSendingTest = status === 'sending' && statusMsg.toLowerCase().includes('test');
    const compiledPreview = useMemo(() => compileNewsletterEmail({
        blocks,
        settings: emailSettings,
        previewText,
        renderPlaceholders: true,
    }).replaceAll('{{first_name}}', 'Abodid').replaceAll('{{unsubscribe_url}}', '#'), [blocks, emailSettings, previewText]);
    const compiledDesktopPreview = useMemo(() => compileNewsletterEmail({
        blocks,
        settings: emailSettings,
        previewText,
        renderPlaceholders: true,
        responsive: false,
    }).replaceAll('{{first_name}}', 'Abodid').replaceAll('{{unsubscribe_url}}', '#'), [blocks, emailSettings, previewText]);

    const handleCampaignTabKeyDown = (event) => {
        const tabOrder = ['design', 'preview', 'deliver'];
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

        event.preventDefault();
        const currentIndex = tabOrder.indexOf(activeCampaignTab);
        const nextTab = event.key === 'Home'
            ? tabOrder[0]
            : event.key === 'End'
                ? tabOrder[tabOrder.length - 1]
                : event.key === 'ArrowRight'
                    ? tabOrder[(currentIndex + 1) % tabOrder.length]
                    : tabOrder[(currentIndex - 1 + tabOrder.length) % tabOrder.length];

        setActiveCampaignTab(nextTab);
        document.getElementById(`campaign-${nextTab}-tab`)?.focus();
    };

    return (
        <div className="newsletter-sender">
            <header className="newsletter-header">
                <div>
                    <span className="newsletter-eyebrow">Newsletter studio</span>
                    <h2 className="section-title">Create a campaign</h2>
                    <p>Draft, review, choose your audience, then send when everything is ready.</p>
                </div>
            </header>

            <div
                className="campaign-workspace-tabs"
                role="tablist"
                aria-label="Newsletter campaign workspace"
                data-active={activeCampaignTab}
                onKeyDown={handleCampaignTabKeyDown}
            >
                <button
                    id="campaign-design-tab"
                    type="button"
                    role="tab"
                    className={`campaign-workspace-tab design ${activeCampaignTab === 'design' ? 'active' : ''}`}
                    aria-selected={activeCampaignTab === 'design'}
                    aria-controls="campaign-design-panel"
                    tabIndex={activeCampaignTab === 'design' ? 0 : -1}
                    onClick={() => setActiveCampaignTab('design')}
                >
                    <span>Design</span>
                </button>
                <button
                    id="campaign-preview-tab"
                    type="button"
                    role="tab"
                    className={`campaign-workspace-tab preview ${activeCampaignTab === 'preview' ? 'active' : ''}`}
                    aria-selected={activeCampaignTab === 'preview'}
                    aria-controls="campaign-preview-panel"
                    tabIndex={activeCampaignTab === 'preview' ? 0 : -1}
                    onClick={() => setActiveCampaignTab('preview')}
                >
                    <span>Preview</span>
                </button>
                <button
                    id="campaign-deliver-tab"
                    type="button"
                    role="tab"
                    className={`campaign-workspace-tab deliver ${activeCampaignTab === 'deliver' ? 'active' : ''}`}
                    aria-selected={activeCampaignTab === 'deliver'}
                    aria-controls="campaign-deliver-panel"
                    tabIndex={activeCampaignTab === 'deliver' ? 0 : -1}
                    onClick={() => setActiveCampaignTab('deliver')}
                >
                    <span>Deliver</span>
                </button>
                <span className="campaign-tab-glider" aria-hidden="true" />
            </div>

            <div
                id="campaign-design-panel"
                className="campaign-tab-panel"
                role="tabpanel"
                aria-labelledby="campaign-design-tab"
                tabIndex={0}
                hidden={activeCampaignTab !== 'design'}
            >
                <div className="design-workspace-grid">
                    <section className="studio-panel compose-panel design-editor-panel" aria-labelledby="draft-title">
                        <div className="panel-heading">
                            <div>
                                <span className="step-label">Design</span>
                                <h3 id="draft-title">Design your newsletter</h3>
                            </div>
                            <label className="design-template-picker">
                                <span>Pre-saved Newsletters</span>
                                <span className="design-template-select-shell">
                                    <select
                                        className="box-input"
                                        value={selectedTemplateId || savedTemplates[0]?.id || ''}
                                        onChange={(event) => loadTemplate(event.target.value)}
                                        disabled={!draftsAvailable || savedTemplates.length === 0}
                                        aria-label="Pre-saved newsletters"
                                    >
                                        {savedTemplates.map((template) => (
                                            <option key={template.id} value={template.id}>
                                                {template.template_name || template.subject || 'Untitled newsletter'}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="design-template-chevron" aria-hidden="true" />
                                </span>
                            </label>
                        </div>

                        <NewsletterBlockInsertToolbar blocks={blocks} onAddBlock={addNewsletterBlock} />

                        <hr className="newsletter-content-divider" />

                        <div className="newsletter-content-heading">
                            <h4>Newsletter Content</h4>
                        </div>

                        <NewsletterBlockEditor
                            blocks={blocks}
                            onChange={updateBlocks}
                            settings={emailSettings}
                            focusBlockId={focusBlockId}
                            mediaAccessToken={accessToken}
                            getRandomMediaPreview={getRandomMediaPreview}
                        />
                    </section>

                    <section className="studio-panel workspace-preview-panel workspace-preview-column" aria-labelledby="design-live-preview-title">

                        <div className="preview-stage">
                            <div className="email-preview-frame desktop">
                                <StableEmailPreview
                                    title="Live newsletter design preview"
                                    html={compiledDesktopPreview}
                                />
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <div
                id="campaign-preview-panel"
                className="campaign-tab-panel"
                role="tabpanel"
                aria-labelledby="campaign-preview-tab"
                tabIndex={0}
                hidden={activeCampaignTab !== 'preview'}
            >
                <div className="preview-workspace-grid">
                <section className="studio-panel preview-panel preview-inspector-panel" aria-labelledby="live-preview-title">
                    <div className="panel-heading preview-header">
                        <div>
                            <span className="step-label">Preview</span>
                            <h3 id="live-preview-title">Review the inbox and live email</h3>
                        </div>
                        <div className="preview-toggle" aria-label="Preview format">
                            <button
                                type="button"
                                className={`toggle-btn ${previewMode === 'desktop' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('desktop')}
                                aria-pressed={previewMode === 'desktop'}
                            >
                                Desktop
                            </button>
                            <button
                                type="button"
                                className={`toggle-btn ${previewMode === 'mobile' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('mobile')}
                                aria-pressed={previewMode === 'mobile'}
                            >
                                Mobile
                            </button>
                            <button
                                type="button"
                                className={`toggle-btn ${previewMode === 'iphone' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('iphone')}
                                aria-pressed={previewMode === 'iphone'}
                            >
                                iPhone
                            </button>
                        </div>
                    </div>

                    <div
                        className="inbox-preview"
                        aria-label={previewMode === 'iphone'
                            ? `iPhone ${iphoneNotificationApp === 'gmail' ? 'Gmail' : 'Apple Mail'} notification preview`
                            : `Gmail ${previewMode === 'mobile' ? 'mobile' : 'desktop'} inbox appearance preview`}
                    >
                        <div className="inbox-preview-heading">
                            <span className="inbox-preview-label">Inbox appearance</span>
                            <span className="inbox-preview-note">
                                {previewMode === 'iphone'
                                    ? 'iPhone notification preview'
                                    : `Gmail ${previewMode === 'mobile' ? 'mobile' : 'desktop'} preview`}
                            </span>
                        </div>
                        {previewMode === 'iphone' ? (
                            <div>
                                <div className="notification-app-toggle" role="group" aria-label="iPhone notification app">
                                    <button
                                        type="button"
                                        className={iphoneNotificationApp === 'mail' ? 'active' : ''}
                                        aria-pressed={iphoneNotificationApp === 'mail'}
                                        onClick={() => setIphoneNotificationApp('mail')}
                                    >
                                        Apple Mail
                                    </button>
                                    <button
                                        type="button"
                                        className={iphoneNotificationApp === 'gmail' ? 'active' : ''}
                                        aria-pressed={iphoneNotificationApp === 'gmail'}
                                        onClick={() => setIphoneNotificationApp('gmail')}
                                    >
                                        Gmail
                                    </button>
                                </div>
                                <div className="phone-preview-shell">
                                    <div className={`phone-lock-screen ${iphoneNotificationApp === 'gmail' ? 'gmail-notification-screen' : ''}`}>
                                        <div className="phone-status-bar" aria-hidden="true">
                                            <span />
                                            <span className="phone-status-icons">
                                                <i className="phone-cellular"><b /><b /><b /><b /></i>
                                                <i className="phone-wifi" />
                                                <i className="phone-battery" />
                                            </span>
                                        </div>
                                        <span className="phone-dynamic-island" aria-hidden="true" />
                                        <div className="phone-date" aria-hidden="true">Tue Apr 1</div>
                                        <div className="phone-clock" aria-hidden="true">9:41</div>

                                        <article className={`phone-notification-card ${iphoneNotificationApp === 'gmail' ? 'gmail-notification' : 'mail-notification'}`}>
                                            {iphoneNotificationApp === 'gmail' ? (
                                                <span className="phone-mail-icon gmail" aria-hidden="true">
                                                    <img src="/images/admin/gmail-logo.png" alt="" width="24" height="24" />
                                                </span>
                                            ) : (
                                                <span className="phone-mail-icon apple-mail" aria-hidden="true"><i /></span>
                                            )}
                                            <div className="phone-notification-content">
                                                <div className="phone-notification-heading">
                                                    <strong className="phone-notification-sender">{senderName || 'Abodid Sahoo'}</strong>
                                                    <span className="phone-notification-age">now</span>
                                                </div>
                                                <strong className={`phone-notification-subject ${displaySubject !== 'Your subject line' ? '' : 'placeholder'}`}>
                                                    {displaySubject}
                                                </strong>
                                                <p className={previewText ? '' : 'placeholder'}>
                                                    {previewText || 'Your preview text will appear here'}
                                                </p>
                                            </div>
                                        </article>
                                        <div className="phone-lock-shortcuts" aria-hidden="true">
                                            <span className="phone-lock-shortcut phone-flashlight"><i /></span>
                                            <span className="phone-lock-shortcut phone-camera"><i /></span>
                                        </div>
                                        <span className="phone-home-indicator" aria-hidden="true" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={`gmail-preview ${previewMode === 'mobile' ? 'mobile' : 'desktop'}`}>
                                <div className="gmail-topbar" aria-hidden="true">
                                    <span className="gmail-menu-icon">☰</span>
                                    <span className="gmail-wordmark">
                                        <img src="/images/admin/gmail-logo.png" alt="" width="18" height="18" />
                                        Gmail
                                    </span>
                                    <span className="gmail-search"><span>⌕</span> Search mail</span>
                                    <span className="gmail-topbar-icon">?</span>
                                    <span className="gmail-topbar-icon">⚙</span>
                                    <span className="gmail-avatar">A</span>
                                </div>
                                <div className="gmail-toolbar" aria-hidden="true">
                                    <span className="gmail-checkbox" />
                                    <span>⌄</span>
                                    <span>↻</span>
                                    <span>⋮</span>
                                    <span className="gmail-toolbar-count">1–1 of 1</span>
                                    <span>‹</span>
                                    <span>›</span>
                                </div>
                                <div className="gmail-message-row">
                                    <span className="gmail-checkbox" aria-hidden="true" />
                                    <span className="gmail-star" aria-hidden="true">☆</span>
                                    <span className="inbox-preview-sender">{senderName || 'Abodid Sahoo'}</span>
                                    <span className="gmail-message-content">
                                        <span className={`inbox-preview-subject ${displaySubject !== 'Your subject line' ? '' : 'placeholder'}`}>
                                            {displaySubject}
                                        </span>
                                        <span className="inbox-preview-separator" aria-hidden="true"> — </span>
                                        <span className={`inbox-preview-text ${previewText ? '' : 'placeholder'}`}>
                                            {previewText || 'Your preview text will appear here'}
                                        </span>
                                    </span>
                                    <span className="gmail-message-time">Now</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="preview-metadata-grid">
                        <div className="field-group">
                            <label htmlFor="preview-sender-name">From name</label>
                            <input
                                id="preview-sender-name"
                                type="text"
                                value={senderName}
                                onChange={(event) => {
                                    setSenderName(event.target.value);
                                    markDraftDirty();
                                }}
                                placeholder="e.g. Abodid Sahoo"
                                className="box-input"
                            />
                        </div>

                        <div className="field-group">
                            <label htmlFor="newsletter-subject">Subject line</label>
                            <input
                                id="newsletter-subject"
                                type="text"
                                value={subject}
                                onChange={(event) => updateSubject(event.target.value)}
                                placeholder={primaryHeading || "What will make someone want to open this?"}
                                className="box-input"
                            />
                        </div>

                        <div className="field-group preview-text-field">
                            <div className="field-label-row">
                                <label htmlFor="newsletter-preview-text">Preview text</label>
                                <span className={previewText.length > 90 ? 'character-count warning' : 'character-count'}>
                                    {previewText.length}/90
                                </span>
                            </div>
                            <input
                                id="newsletter-preview-text"
                                type="text"
                                className="box-input"
                                placeholder="A useful reason to open the email"
                                value={previewText}
                                onChange={(event) => updatePreviewText(event.target.value)}
                            />
                        </div>
                    </div>

                    <section className="save-template-card" aria-labelledby="save-template-title">
                        <div className="save-template-copy">
                            <span className="save-template-spark" aria-hidden="true" style={{ fontSize: '1.25rem' }}>💾</span>
                            <div>
                                <h4 id="save-template-title">Save this newsletter template</h4>
                            </div>
                        </div>
                        <div className="save-template-form">
                            <label htmlFor="newsletter-template-name" aria-label="Template name">
                                <input
                                    id="newsletter-template-name"
                                    className="box-input"
                                    style={{ width: '100%' }}
                                    value={templateName}
                                    onChange={(event) => setTemplateName(event.target.value)}
                                    placeholder="Template name"
                                />
                            </label>
                            <button
                                type="button"
                                className="save-template-button"
                                onClick={saveTemplate}
                                disabled={draftStatus === 'saving' || !draftsAvailable}
                            >
                                {draftStatus === 'saving' ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                        {draftStatusMsg && <p className={`draft-status ${draftStatus}`}>{draftStatusMsg}</p>}
                    </section>

                </section>

                <section className="studio-panel workspace-preview-panel workspace-preview-column" aria-labelledby="rendered-email-title">
                    <div className="preview-panel-toolbar" style={{ display: 'flex', gap: '1rem', padding: '1rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-color)', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <EmailBackdropControl
                                value={emailSettings.outerBackgroundColor}
                                onChange={updateEmailBackdrop}
                            />
                        </div>
                        <button
                            type="button"
                            className="full-gmail-preview-trigger"
                            style={{ flex: 1, minHeight: '44px', fontSize: '0.85rem' }}
                            onClick={() => setIsFullGmailPreviewOpen(true)}
                        >
                            <span aria-hidden="true" style={{ fontSize: '1.25rem', marginRight: '0.2rem' }}>⛶</span>
                            Full Gmail preview
                        </button>
                    </div>
                    <div className="preview-stage">
                        <div className={`email-preview-frame ${previewMode === 'desktop' ? 'desktop' : 'phone'}`}>
                            <StableEmailPreview
                                title="Compiled newsletter email preview"
                                html={previewMode === 'desktop' ? compiledDesktopPreview : compiledPreview}
                            />
                        </div>
                    </div>
                </section>
                </div>
            </div>

            <div
                id="campaign-deliver-panel"
                className="campaign-tab-panel"
                role="tabpanel"
                aria-labelledby="campaign-deliver-tab"
                tabIndex={0}
                hidden={activeCampaignTab !== 'deliver'}
            >
            <section className="campaign-management compact-delivery-workspace" aria-label="Campaign audience and delivery">
                <div className="management-grid">
                    <section className="management-panel audience-panel" aria-labelledby="audience-title">
                        <div className="management-panel-heading">
                            <div>
                                <span className="panel-number">1</span>
                                <div>
                                    <h4 id="audience-title">Choose your audience</h4>
                                </div>
                            </div>
                        </div>

                        <div className="prominent-subscriber-count" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--newsletter-accent-soft)', padding: '1.5rem', borderRadius: '8px', margin: '1rem 1.1rem', border: '1px solid var(--newsletter-accent)' }}>
                            <strong style={{ fontSize: '3rem', lineHeight: '1', color: 'var(--newsletter-accent)' }}>{deliveryRecipientCount}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subscriber{deliveryRecipientCount === 1 ? '' : 's'} Selected</span>
                        </div>

                        <div className="audience-choice-grid" role="group" aria-label="Audience type">
                            <button
                                type="button"
                                className={`audience-choice ${audienceMode === 'all' ? 'active' : ''}`}
                                onClick={() => {
                                    setAudienceMode('all');
                                    setIsSubscriberPickerOpen(false);
                                }}
                                aria-pressed={audienceMode === 'all'}
                            >
                                <span className="choice-indicator" aria-hidden="true" />
                                <span>
                                    <strong>All active subscribers</strong>
                                    <small>Send to the complete active list ({subscriberCount})</small>
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`audience-choice ${audienceMode === 'selected' ? 'active' : ''}`}
                                onClick={() => {
                                    setAudienceMode('selected');
                                    setIsSubscriberPickerOpen(true);
                                }}
                                aria-pressed={audienceMode === 'selected'}
                            >
                                <span className="choice-indicator" aria-hidden="true" />
                                <span>
                                    <strong>Selected subscribers</strong>
                                    <small>Choose contacts from your subscriber list ({selectedSubscriberIds.length})</small>
                                </span>
                            </button>
                        </div>

                        {audienceMode === 'selected' && (
                            <div className="selected-audience-summary">
                                <div>
                                    <strong>{selectedSubscriberIds.length} subscriber{selectedSubscriberIds.length === 1 ? '' : 's'} selected</strong>
                                    <small>Open the list to review or change recipients.</small>
                                </div>
                                <button type="button" className="btn sec" onClick={() => setIsSubscriberPickerOpen(true)}>
                                    {selectedSubscriberIds.length ? 'Edit selection' : 'Choose subscribers'}
                                </button>
                            </div>
                        )}
                    </section>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <section className="management-panel pre-send-review-panel" aria-labelledby="pre-send-review-title">
                            <div className="management-panel-heading">
                                <div>
                                    <span className="panel-number">2</span>
                                    <div>
                                        <h4 id="pre-send-review-title">Pre-send review</h4>
                                    </div>
                                </div>
                                <div className={`readiness-badge ${campaignReady ? 'ready' : ''}`}>
                                    <span aria-hidden="true">{campaignReady ? '✓' : '!'}</span>
                                    {campaignReady ? 'Ready' : 'Check details'}
                                </div>
                            </div>

                            <div className="pre-send-review-body">
                                <ul className="review-check-list">
                                    <li className={(senderName.trim() && subject.trim() && previewText.trim()) ? 'ready' : 'missing'}>
                                        <span className="review-check-icon" aria-hidden="true">{(senderName.trim() && subject.trim() && previewText.trim()) ? '✓' : '!'}</span>
                                        <span><strong>Inbox details</strong><small>{[senderName.trim() ? 'Name' : null, subject.trim() ? 'Subject' : null, previewText.trim() ? 'Preview text' : null].filter(Boolean).join(', ') || 'Missing details'}</small></span>
                                    </li>
                                    <li className={hasNewsletterContent ? 'ready' : 'missing'}>
                                        <span className="review-check-icon" aria-hidden="true">{hasNewsletterContent ? '✓' : '!'}</span>
                                        <span><strong>Email content</strong><small>{[hasNewsletterHeading ? 'Heading' : null, hasNewsletterSubheading ? 'Subheading' : null, hasNewsletterContent ? `${populatedContentBlocks.length} block${populatedContentBlocks.length === 1 ? '' : 's'}` : null].filter(Boolean).join(', ') || 'No content'}</small></span>
                                    </li>
                                    <li className={usesDefaultEmailBackground ? 'default' : 'ready'}>
                                        <span className="review-check-icon" aria-hidden="true">{usesDefaultEmailBackground ? '?' : '✓'}</span>
                                        <span>
                                            <strong>Email background</strong>
                                            <small className="review-background-status">
                                                <i
                                                    className="review-background-swatch"
                                                    style={{ backgroundColor: emailBackgroundColor }}
                                                    aria-hidden="true"
                                                />
                                                {usesDefaultEmailBackground ? 'Default' : 'Selected'} {emailBackgroundColor.toUpperCase()}
                                            </small>
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        </section>

                        <section className="management-panel test-mail-panel" aria-labelledby="test-mail-title">
                            <div className="management-panel-heading">
                                <div>
                                    <h4 id="test-mail-title">Send a test Mail</h4>
                                </div>
                            </div>
                            <div style={{ padding: '1rem 1.1rem' }}>
                                <div className="test-recipient" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Test recipient</span>
                                    <strong>{NEWSLETTER_TEST_EMAIL}</strong>
                                </div>
                                <button
                                    type="button"
                                    className="btn sec full-width"
                                    onClick={() => handleSend(true)}
                                    disabled={status === 'sending' || !subject.trim() || !hasNewsletterContent}
                                >
                                    {isSendingTest ? 'Sending test…' : 'Send test email'}
                                </button>
                            </div>
                        </section>
                    </div>

                    <section className="management-panel delivery-panel" aria-labelledby="delivery-title">
                        <div className="management-panel-heading compact">
                            <div>
                                <span className="panel-number">3</span>
                                <div>
                                    <h4 id="delivery-title">Final delivery</h4>
                                </div>
                            </div>
                        </div>

                        <div className="delivery-section">
                            <h5>Sender address</h5>
                            <div className="field-group">
                                <label htmlFor="sender-email">From email</label>
                                {!isAddingEmail ? (
                                    <span className="sender-email-select-shell">
                                        <select
                                            id="sender-email"
                                            className="box-input"
                                            value={senderEmail}
                                            onChange={(event) => {
                                                if (event.target.value === 'ADD_NEW') setIsAddingEmail(true);
                                                else {
                                                    setSenderEmail(event.target.value);
                                                    markDraftDirty();
                                                }
                                            }}
                                        >
                                            {savedSenderEmails.map((email) => <option key={email} value={email}>{email}</option>)}
                                            <option value="ADD_NEW">+ Add another sender</option>
                                        </select>
                                        <span className="sender-email-chevron" aria-hidden="true" />
                                    </span>
                                ) : (
                                    <div className="inline-input-actions">
                                        <input
                                            id="sender-email"
                                            type="email"
                                            className="box-input"
                                            placeholder="news@abodid.com"
                                            value={tempNewEmail}
                                            onChange={(event) => setTempNewEmail(event.target.value)}
                                            autoFocus
                                        />
                                        <button type="button" className="btn sec" onClick={() => setIsAddingEmail(false)}>Cancel</button>
                                        <button type="button" className="btn pri" onClick={handleAddSenderEmail}>Save</button>
                                    </div>
                                )}
                                <p className="field-help">Sender addresses must use @abodid.com.</p>
                            </div>
                        </div>

                        <div className="final-send-section">
                            <div className="final-recipient-count">
                                <span>Final audience</span>
                                <strong>{deliveryRecipientCount} recipient{deliveryRecipientCount === 1 ? '' : 's'}</strong>
                            </div>
                            <button
                                type="button"
                                className="btn pri send-button"
                                onClick={() => handleSend(false)}
                                disabled={status === 'sending' || !campaignReady}
                            >
                                {status === 'sending' && !isSendingTest
                                    ? 'Sending campaign…'
                                    : audienceMode === 'selected'
                                        ? `Send to ${selectedSubscriberIds.length} selected`
                                        : `Send to all ${subscriberCount}`}
                            </button>
                            <p className="send-note">You will be asked to confirm before the campaign is sent.</p>
                        </div>

                        {status !== 'idle' && (
                            <div className={`status-alert ${status}`} role="status" aria-live="polite">
                                {statusMsg}
                            </div>
                        )}
                    </section>
                </div>

                {isSubscriberPickerOpen && (
                    <div
                        className="subscriber-picker-backdrop"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) setIsSubscriberPickerOpen(false);
                        }}
                    >
                        <section
                            className="subscriber-picker-dialog"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="subscriber-picker-title"
                        >
                            <header className="subscriber-picker-header">
                                <div>
                                    <span className="step-label">Selected audience</span>
                                    <h4 id="subscriber-picker-title">Choose subscribers</h4>
                                    <p>Select the people who should receive this campaign.</p>
                                </div>
                                <button
                                    type="button"
                                    className="subscriber-picker-close"
                                    onClick={() => setIsSubscriberPickerOpen(false)}
                                    aria-label="Close subscriber list"
                                >
                                    ×
                                </button>
                            </header>

                            <div className="subscriber-picker-toolbar">
                                <div className="search-field">
                                    <span aria-hidden="true">⌕</span>
                                    <input
                                        type="search"
                                        value={subscriberSearch}
                                        onChange={(event) => setSubscriberSearch(event.target.value)}
                                        placeholder="Search email or name"
                                        aria-label="Search subscribers by email or name"
                                        autoFocus
                                    />
                                </div>
                                <details
                                    className="add-subscriber"
                                    open={isAddSubscriberOpen}
                                    onToggle={(event) => setIsAddSubscriberOpen(event.currentTarget.open)}
                                >
                                    <summary>+ Add subscriber</summary>
                                    <div className="add-subscriber-popover">
                                        <div className="add-subscriber-popover-heading">
                                            <strong>Add subscriber</strong>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsAddSubscriberOpen(false);
                                                    setAddSubStatus('');
                                                }}
                                                aria-label="Close add subscriber window"
                                            >
                                                ×
                                            </button>
                                        </div>
                                        <label htmlFor="new-subscriber-email">Email address</label>
                                        <div className="add-subscriber-form-row">
                                            <input
                                                id="new-subscriber-email"
                                                type="email"
                                                placeholder="name@example.com"
                                                className="box-input"
                                                value={newSubscriber}
                                                onChange={(event) => setNewSubscriber(event.target.value)}
                                            />
                                            <button type="button" className="btn pri" onClick={handleAddSubscriber}>Add</button>
                                        </div>
                                        {addSubStatus && (
                                            <p className={addSubStatus === 'Added!' ? 'inline-status success' : 'inline-status error'}>{addSubStatus}</p>
                                        )}
                                    </div>
                                </details>
                            </div>

                            <div className="subscriber-picker-actions">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={allVisibleSubscribersSelected}
                                        onChange={toggleVisibleSubscribers}
                                        disabled={filteredSubscribers.length === 0}
                                    />
                                    <span>{allVisibleSubscribersSelected ? 'Deselect visible' : 'Select visible'}</span>
                                </label>
                                <span>{selectedSubscriberIds.length} selected</span>
                                <button
                                    type="button"
                                    className="clear-selection-button"
                                    onClick={() => setSelectedSubscriberIds([])}
                                    disabled={selectedSubscriberIds.length === 0}
                                >
                                    <span aria-hidden="true">×</span>
                                    Clear
                                </button>
                            </div>

                            <div className="subscriber-card-list">
                                {subscriberError ? (
                                    <p className="subscriber-list-message error">{subscriberError}</p>
                                ) : subscribersLoading ? (
                                    <p className="subscriber-list-message">Loading subscribers…</p>
                                ) : filteredSubscribers.length === 0 ? (
                                    <p className="subscriber-list-message">No subscribers match your search.</p>
                                ) : filteredSubscribers.map((subscriber) => {
                                    const isSelected = selectedSubscriberIdSet.has(subscriber.id);
                                    return (
                                        <label
                                            key={subscriber.id}
                                            className={`subscriber-select-card ${isSelected ? 'selected' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSubscriberSelection(subscriber.id)}
                                                aria-label={`Select ${subscriber.email}`}
                                            />
                                            <span>
                                                <strong>{subscriber.email}</strong>
                                                <small>{subscriber.name || 'No name saved'}</small>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>

                            <footer className="subscriber-picker-footer">
                                <span>{filteredSubscribers.length} subscriber{filteredSubscribers.length === 1 ? '' : 's'} shown</span>
                                <button type="button" className="btn pri" onClick={() => setIsSubscriberPickerOpen(false)}>
                                    Done
                                </button>
                            </footer>
                        </section>
                    </div>
                )}
            </section>
            </div>

            {isFullGmailPreviewOpen && (
                <FullGmailPreview
                    subject={subject}
                    senderName={senderName}
                    senderEmail={senderEmail}
                    html={compiledDesktopPreview}
                    backdropColor={emailSettings.outerBackgroundColor}
                    onBackdropChange={updateEmailBackdrop}
                    onClose={() => setIsFullGmailPreviewOpen(false)}
                />
            )}
        </div>
    );
}
