import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createTag, getAllTags, searchTags } from '../../lib/resources/db';
import type { HubTag } from '../../lib/resources/types';

interface Props {
    selectedTags: string[];
    onChange: (ids: string[]) => void;
    maxTags?: number;
    label?: string;
}

const cleanTagName = (value: string) =>
    value.replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, 60);

export default function TagInput({ selectedTags, onChange, maxTags = 3, label = 'Tags' }: Props) {
    const [inputValue, setInputValue] = useState('');
    const [allTags, setAllTags] = useState<HubTag[]>([]);
    const [suggestions, setSuggestions] = useState<HubTag[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [isCommitting, setIsCommitting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

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

        let active = true;
        const timer = window.setTimeout(async () => {
            const localMatches = allTags.filter((tag) =>
                tag.name.toLowerCase().includes(query.toLowerCase())
            );
            const remoteMatches = query.length > 1 ? await searchTags(query) : [];
            if (!active) return;

            const unique = new Map<string, HubTag>();
            [...localMatches, ...remoteMatches].forEach((tag) => {
                if (!selectedTags.includes(tag.id)) unique.set(tag.id, tag);
            });
            setSuggestions([...unique.values()].slice(0, 8));
            setShowSuggestions(true);
            setFocusedIndex(-1);
        }, 160);

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

    const addTag = (tag: HubTag) => {
        if (selectedTags.length >= maxTags || selectedTags.includes(tag.id)) return;
        setAllTags((current) => current.some((item) => item.id === tag.id) ? current : [...current, tag]);
        onChange([...selectedTags, tag.id]);
        setInputValue('');
        setSuggestions([]);
        setShowSuggestions(false);
        setFocusedIndex(-1);
    };

    const removeTag = (id: string) => {
        onChange(selectedTags.filter((tagId) => tagId !== id));
    };

    const commitInput = async () => {
        const name = cleanTagName(inputValue);
        if (!name || selectedTags.length >= maxTags || isCommitting) return;

        const exactMatch = [...suggestions, ...allTags].find(
            (tag) => tag.name.toLowerCase() === name.toLowerCase()
        );
        if (exactMatch) {
            addTag(exactMatch);
            return;
        }

        setIsCommitting(true);
        const newTag = await createTag(name);
        if (newTag) {
            setIsCommitting(false);
            addTag(newTag);
            return;
        }

        const existingTags = await searchTags(name);
        const existingMatch = existingTags.find(
            (tag) => tag.name.toLowerCase() === name.toLowerCase()
        );
        setIsCommitting(false);
        if (existingMatch) addTag(existingMatch);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setFocusedIndex((current) => Math.min(current + 1, suggestions.length - 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setFocusedIndex((current) => Math.max(current - 1, -1));
            return;
        }
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            if (focusedIndex >= 0 && suggestions[focusedIndex]) {
                addTag(suggestions[focusedIndex]);
            } else {
                void commitInput();
            }
            return;
        }
        if (event.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
            removeTag(selectedTags[selectedTags.length - 1]);
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
                <input
                    type="text"
                    aria-label={label}
                    placeholder={selectedTags.length >= maxTags ? 'Tag limit reached' : 'Type a tag, then press Enter'}
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    disabled={selectedTags.length >= maxTags || isCommitting}
                    onKeyDown={handleKeyDown}
                    onFocus={() => normalizedInput && setShowSuggestions(true)}
                />
            </div>

            {showSuggestions && normalizedInput && (
                <div className="suggestions-dropdown" role="listbox" aria-label="Tag suggestions">
                    {suggestions.map((tag, index) => (
                        <button
                            key={tag.id}
                            type="button"
                            role="option"
                            aria-selected={index === focusedIndex}
                            className={index === focusedIndex ? 'focused' : ''}
                            onClick={() => addTag(tag)}
                            onMouseEnter={() => setFocusedIndex(index)}
                        >
                            <span>#{tag.name}</span>
                            <small>Use tag</small>
                        </button>
                    ))}
                    {!hasExactMatch && (
                        <button type="button" className="create-option" onClick={() => void commitInput()}>
                            <span>Create “{normalizedInput}”</span>
                            <small>Press Enter</small>
                        </button>
                    )}
                </div>
            )}

            <style>{`
                .tag-input-container { position:relative; min-width:0; }
                .tag-input-field {
                    min-height:46px; width:100%; display:flex; flex-wrap:wrap; align-items:center; gap:6px;
                    padding:6px 9px; border:1px solid var(--border-subtle); border-radius:8px;
                    background:var(--bg-color); color:var(--text-primary); cursor:text; box-sizing:border-box;
                }
                .tag-input-field:focus-within { outline:2px solid var(--border-focus); outline-offset:2px; }
                .tag-input-field input {
                    flex:1 1 180px; min-width:130px; min-height:30px; margin:0; padding:2px 4px;
                    border:0; outline:0; background:transparent; color:var(--text-primary);
                    font:500 .86rem/1.35 var(--font-sans);
                }
                .tag-input-field input::placeholder { color:var(--text-tertiary); }
                .selected-tag-chip {
                    display:inline-flex; align-items:center; gap:5px; max-width:100%; padding:5px 7px 5px 9px;
                    border:1px solid var(--border-subtle); border-radius:999px; background:var(--bg-surface-hover);
                    color:var(--text-primary); font-size:.73rem; font-weight:700; line-height:1;
                }
                .selected-tag-chip button {
                    width:18px; height:18px; display:grid; place-items:center; margin:0; padding:0; border:0;
                    border-radius:50%; background:transparent; color:var(--text-tertiary); cursor:pointer;
                    font:600 15px/1 var(--font-sans);
                }
                .selected-tag-chip button:hover { background:var(--bg-color); color:var(--text-primary); }
                .suggestions-dropdown {
                    position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:80; overflow:auto;
                    max-height:230px; padding:5px; border:1px solid var(--border-subtle); border-radius:9px;
                    background:var(--bg-surface); box-shadow:0 16px 42px rgba(0,0,0,.18);
                }
                .suggestions-dropdown button {
                    width:100%; display:flex; align-items:center; justify-content:space-between; gap:1rem;
                    padding:9px 10px; border:0; border-radius:6px; background:transparent;
                    color:var(--text-primary); text-align:left; cursor:pointer; font:600 .8rem/1.25 var(--font-sans);
                }
                .suggestions-dropdown button:hover,.suggestions-dropdown button.focused { background:var(--bg-surface-hover); }
                .suggestions-dropdown small { color:var(--text-tertiary); font-size:.66rem; font-weight:600; }
                .suggestions-dropdown .create-option { border-top:1px solid var(--border-subtle); border-radius:0 0 6px 6px; color:var(--text-secondary); }
            `}</style>
        </div>
    );
}
