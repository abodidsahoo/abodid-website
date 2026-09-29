import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createTag, getAllTags, searchTags } from '../../lib/resources/db';
import { cleanTagName, rankTagSuggestions } from '../../lib/resources/tagSuggestions';
import type { HubTag } from '../../lib/resources/types';

interface Props {
    selectedTags: string[];
    onChange: (ids: string[]) => void;
    maxTags?: number;
    label?: string;
}

interface PendingTag {
    key: string;
    name: string;
}

export default function TagInput({ selectedTags, onChange, maxTags = 3, label = 'Tags' }: Props) {
    const [inputValue, setInputValue] = useState('');
    const [allTags, setAllTags] = useState<HubTag[]>([]);
    const [suggestions, setSuggestions] = useState<HubTag[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [pendingTags, setPendingTags] = useState<PendingTag[]>([]);
    const [commitError, setCommitError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedTagsRef = useRef(selectedTags);
    const pendingTagsRef = useRef<PendingTag[]>([]);
    const isMountedRef = useRef(true);

    useEffect(() => {
        selectedTagsRef.current = selectedTags;
    }, [selectedTags]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let active = true;
        getAllTags().then((tags) => {
            if (active) setAllTags(tags);
        });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const query = cleanTagName(inputValue);
        if (!query) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const localMatches = rankTagSuggestions(allTags, query, selectedTags);
        setSuggestions(localMatches);
        setShowSuggestions(true);
        setFocusedIndex(localMatches.length > 0 ? 0 : -1);

        let active = true;
        const timer = window.setTimeout(async () => {
            const remoteMatches = query.length > 1 ? await searchTags(query) : [];
            if (!active) return;

            const rankedMatches = rankTagSuggestions(
                [...localMatches, ...remoteMatches],
                query,
                selectedTags
            );
            setSuggestions(rankedMatches);
            setFocusedIndex(rankedMatches.length > 0 ? 0 : -1);
        }, 100);

        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [allTags, inputValue, selectedTags]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, []);

    const selectedTagObjects = useMemo(
        () => selectedTags
            .map((id) => allTags.find((tag) => tag.id === id))
            .filter((tag): tag is HubTag => Boolean(tag)),
        [allTags, selectedTags]
    );

    const resetInput = () => {
        setInputValue('');
        setSuggestions([]);
        setShowSuggestions(false);
        setFocusedIndex(-1);
        setCommitError(null);
    };

    const publishSelectedTags = (ids: string[]) => {
        selectedTagsRef.current = ids;
        onChange(ids);
    };

    const addTag = (tag: HubTag, reset = true) => {
        const currentTags = selectedTagsRef.current;
        if (
            currentTags.length + pendingTagsRef.current.length >= maxTags
            || currentTags.includes(tag.id)
        ) return;
        setAllTags((current) => current.some((item) => item.id === tag.id) ? current : [...current, tag]);
        publishSelectedTags([...currentTags, tag.id]);
        if (reset) resetInput();
    };

    const removeTag = (id: string) => {
        publishSelectedTags(selectedTagsRef.current.filter((tagId) => tagId !== id));
    };

    const removePendingTag = (key: string) => {
        const nextPending = pendingTagsRef.current.filter((tag) => tag.key !== key);
        pendingTagsRef.current = nextPending;
        if (isMountedRef.current) setPendingTags(nextPending);
    };

    const createInputTag = () => {
        const name = cleanTagName(inputValue);
        if (!name || selectedTagsRef.current.length + pendingTagsRef.current.length >= maxTags) return;

        const exactMatch = allTags.find(
            (tag) => tag.name.toLowerCase() === name.toLowerCase()
        );
        if (exactMatch) {
            addTag(exactMatch);
            return;
        }

        if (pendingTagsRef.current.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) {
            resetInput();
            return;
        }

        const pendingTag = {
            key: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name
        };
        const nextPending = [...pendingTagsRef.current, pendingTag];
        pendingTagsRef.current = nextPending;
        setPendingTags(nextPending);
        resetInput();

        void (async () => {
            const createdTag = await createTag(name);
            const resolvedTag = createdTag || (await searchTags(name)).find(
                (tag) => tag.name.toLowerCase() === name.toLowerCase()
            );

            if (!isMountedRef.current) return;
            removePendingTag(pendingTag.key);
            if (resolvedTag) {
                addTag(resolvedTag, false);
            } else {
                setCommitError(`Could not create “${name}”. Try again.`);
            }
        })();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setFocusedIndex((current) => Math.min(current < 0 ? 0 : current + 1, suggestions.length - 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setFocusedIndex((current) => Math.max(current - 1, -1));
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            if (event.shiftKey) {
                createInputTag();
            } else if (suggestions.length > 0) {
                addTag(suggestions[focusedIndex >= 0 ? focusedIndex : 0]);
            } else {
                setShowSuggestions(true);
                setCommitError('No existing match. Press Shift + Enter to create this tag.');
            }
            return;
        }
        if (event.key === 'Backspace' && !inputValue && selectedTagsRef.current.length > 0) {
            removeTag(selectedTagsRef.current[selectedTagsRef.current.length - 1]);
            return;
        }
        if (event.key === 'Escape') setShowSuggestions(false);
    };

    const normalizedInput = cleanTagName(inputValue);
    const hasExactMatch = [...suggestions, ...allTags].some(
        (tag) => tag.name.toLowerCase() === normalizedInput.toLowerCase()
    );

    return (
        <div className="tag-input-container" ref={containerRef}>
            <div className="tag-input-field" onClick={(event) => {
                const input = event.currentTarget.querySelector('input');
                input?.focus();
            }}>
                {selectedTagObjects.map((tag) => (
                    <span key={tag.id} className="selected-tag-chip">
                        {tag.name}
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                removeTag(tag.id);
                            }}
                            aria-label={`Remove ${tag.name}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
                {pendingTags.map((tag) => (
                    <span key={tag.key} className="selected-tag-chip pending" aria-label={`Creating ${tag.name}`}>
                        {tag.name}
                        <small>saving…</small>
                    </span>
                ))}
                <input
                    type="text"
                    aria-label={label}
                    placeholder={selectedTags.length + pendingTags.length >= maxTags ? 'Tag limit reached' : 'Type to find or create a tag'}
                    value={inputValue}
                    onChange={(event) => {
                        setInputValue(event.target.value);
                        setCommitError(null);
                    }}
                    disabled={selectedTags.length + pendingTags.length >= maxTags}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (normalizedInput) setShowSuggestions(true);
                    }}
                    aria-activedescendant={focusedIndex >= 0 ? `tag-suggestion-${suggestions[focusedIndex]?.id}` : undefined}
                    aria-autocomplete="list"
                />
            </div>

            {showSuggestions && normalizedInput && (
                <div className="suggestions-dropdown" role="listbox" aria-label="Tag suggestions">
                    {suggestions.map((tag, index) => (
                        <button
                            key={tag.id}
                            id={`tag-suggestion-${tag.id}`}
                            type="button"
                            role="option"
                            aria-selected={index === focusedIndex}
                            className={index === focusedIndex ? 'focused' : ''}
                            onClick={() => addTag(tag)}
                            onMouseEnter={() => setFocusedIndex(index)}
                        >
                            <span>#{tag.name}</span>
                            <small>{index === 0 ? 'Enter · Best match' : 'Use tag'}</small>
                        </button>
                    ))}
                    {!hasExactMatch && (
                        <button type="button" className="create-option" onClick={createInputTag}>
                            <span>Create “{normalizedInput}”</span>
                            <small>Shift + Enter</small>
                        </button>
                    )}
                </div>
            )}
            <div className="tag-input-help">Enter uses the best match · Shift + Enter creates exactly what you typed</div>
            {commitError && <div className="tag-input-error" role="alert">{commitError}</div>}

            <style>{`
                .tag-input-container { position:relative; min-width:0; }
                .tag-input-field {
                    min-height:48px; width:100%; display:flex; flex-wrap:wrap; align-items:center; gap:6px;
                    padding:8px 12px; border:1px solid var(--pop-border, rgba(21, 19, 15, 0.78)); border-radius:12px;
                    background:var(--pop-cream, #fff8e8); color:var(--pop-ink, #15130f); cursor:text; box-sizing:border-box;
                }
                .tag-input-field:focus-within {
                    border-color: var(--pop-blue, #2b56ff) !important;
                    outline: 1px solid var(--pop-blue, #2b56ff) !important;
                    outline-offset: 0px !important;
                    box-shadow: 0 0 0 1px var(--pop-blue, #2b56ff);
                }
                .tag-input-field input {
                    flex:1 1 180px; min-width:130px; min-height:32px; margin:0; padding:2px 4px;
                    border:0; outline:0; background:transparent; color:var(--pop-ink, #15130f);
                    font:600 .9rem/1.35 var(--resources-font, sans-serif);
                }
                .tag-input-field input::placeholder { color:rgba(21, 19, 15, 0.6); }
                .selected-tag-chip {
                    display:inline-flex; align-items:center; gap:6px; max-width:100%; padding:6px 10px;
                    border:1px solid var(--pop-border, rgba(21, 19, 15, 0.78)); border-radius:999px; background:var(--pop-yellow, #ffe44f);
                    color:var(--pop-ink, #15130f); font-size:.76rem; font-weight:800; line-height:1;
                }
                .selected-tag-chip button {
                    width:20px; height:20px; display:grid; place-items:center; margin:0; padding:0; border:0;
                    border-radius:50%; background:transparent; color:var(--pop-ink, #15130f); cursor:pointer;
                    font:700 15px/1 var(--resources-font, sans-serif);
                }
                .selected-tag-chip button:hover { background:var(--pop-pink, #ff7eb5); color:var(--pop-ink, #15130f); }
                .selected-tag-chip.pending { opacity:.72; }
                .selected-tag-chip.pending small { font-size:.62rem; font-weight:800; text-transform:uppercase; }
                .suggestions-dropdown {
                    position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:80; overflow:auto;
                    max-height:240px; padding:6px; border:1px solid var(--pop-border, rgba(21, 19, 15, 0.78)); border-radius:14px;
                    background:var(--pop-cream, #fff8e8); box-shadow:0 12px 32px rgba(21, 19, 15, 0.16);
                }
                .suggestions-dropdown button {
                    width:100%; display:flex; align-items:center; justify-content:space-between; gap:1rem;
                    padding:10px 12px; border:0; border-radius:8px; background:transparent;
                    color:var(--pop-ink, #15130f); text-align:left; cursor:pointer; font:700 .85rem/1.25 var(--resources-font, sans-serif);
                }
                .suggestions-dropdown button:hover,.suggestions-dropdown button.focused { background:var(--pop-yellow, #ffe44f); }
                .suggestions-dropdown small { color:rgba(21, 19, 15, 0.7); font-size:.7rem; font-weight:700; text-transform:uppercase; }
                .suggestions-dropdown .create-option { border-top:1px solid var(--pop-line, rgba(21, 19, 15, 0.24)); border-radius:0 0 8px 8px; color:var(--pop-ink, #15130f); }
                .tag-input-help,.tag-input-error { margin-top:6px; font:650 .68rem/1.4 var(--resources-mono, monospace); }
                .tag-input-help { color:rgba(21, 19, 15, 0.64); }
                .tag-input-error { color:#b42318; }
            `}</style>
        </div>
    );
}
