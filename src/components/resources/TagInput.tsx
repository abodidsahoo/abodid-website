import React, { useState, useEffect, useRef } from 'react';
import { searchTags, createTag } from '../../lib/resources/db';
import type { HubTag } from '../../lib/resources/types';

interface Props {
    selectedTags: string[]; // IDs
    onChange: (ids: string[]) => void;
    maxTags?: number;
}

export default function TagInput({ selectedTags, onChange, maxTags = 3 }: Props) {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<HubTag[]>([]);
    const [tagObjects, setTagObjects] = useState<HubTag[]>([]); // Store full objects for display
    const [showSuggestions, setShowSuggestions] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (inputValue.trim().length > 1) {
                const results = await searchTags(inputValue);
                // Filter out already selected
                setSuggestions(results.filter(t => !selectedTags.includes(t.id)));
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue, selectedTags]);

    // Click outside to close
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const addTag = (tag: HubTag) => {
        if (selectedTags.length >= maxTags) return;

        onChange([...selectedTags, tag.id]);
        setTagObjects(prev => [...prev, tag]); // Optimistic add
        setInputValue('');
        setSuggestions([]);
    };

    const removeTag = (id: string) => {
        onChange(selectedTags.filter(t => t !== id));
        setTagObjects(prev => prev.filter(t => t.id !== id));
    };

    const handleCreateTag = async () => {
        if (!inputValue.trim()) return;
        const newTag = await createTag(inputValue.trim());
        if (newTag) {
            addTag(newTag);
        }
    };

    return (
        <div className="tag-input-container" ref={containerRef}>
            {/* Selected Tags */}
            <div className="selected-tags">
                {tagObjects.map(tag => (
                    <span key={tag.id} className="selected-tag-chip">
                        #{tag.name}
                        <button
                            type="button"
                            onClick={() => removeTag(tag.id)}
                            className="remove-btn"
                        >
                            &times;
                        </button>
                    </span>
                ))}
            </div>

            {/* Input */}
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    className="hub-input"
                    placeholder={selectedTags.length >= maxTags ? "Max tags reached" : "Type to search or create tags..."}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    disabled={selectedTags.length >= maxTags}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (suggestions.length > 0) {
                                addTag(suggestions[0]);
                            } else if (inputValue.length > 2) {
                                handleCreateTag();
                            }
                        }
                    }}
                />

                {/* Suggestions Dropdown */}
                {showSuggestions && inputValue.length > 1 && (
                    <div className="suggestions-dropdown">
                        {suggestions.map(tag => (
                            <button
                                key={tag.id}
                                type="button"
                                className="suggestion-item"
                                onClick={() => addTag(tag)}
                            >
                                #{tag.name}
                            </button>
                        ))}

                        {/* Create Option */}
                        {suggestions.length === 0 && (
                            <button
                                type="button"
                                className="suggestion-item create-option"
                                onClick={handleCreateTag}
                            >
                                Create new tag: "<strong>{inputValue}</strong>"
                            </button>
                        )}
                    </div>
                )}
            </div>

            <style>{`
        .tag-input-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .selected-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 4px;
        }
        .selected-tag-chip {
            background: var(--text-primary);
            color: var(--text-inverse);
            padding: 4px 10px;
            border-radius: 100px;
            font-size: 13px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .remove-btn {
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            padding: 0;
            opacity: 0.7;
        }
        .remove-btn:hover {
            opacity: 1;
        }
        .suggestions-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            margin-top: 4px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 50;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .suggestion-item {
            display: block;
            width: 100%;
            text-align: left;
            padding: 10px 12px;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 14px;
            cursor: pointer;
            border-bottom: 1px solid var(--border-subtle);
        }
        .suggestion-item:last-child {
            border-bottom: none;
        }
        .suggestion-item:hover {
            background: var(--bg-surface-hover);
        }
        .create-option {
            color: var(--text-secondary);
            font-style: italic;
        }
      `}</style>
        </div>
    );
}
