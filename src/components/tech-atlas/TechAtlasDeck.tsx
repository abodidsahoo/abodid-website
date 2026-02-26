import React, { useState, useMemo, useEffect } from 'react';
import type { TechnologyCourseRow, DeckViewMode } from './types';
import { TechCard } from './TechCard';
import { DeckControls } from './DeckControls';

interface CardWithId extends TechnologyCourseRow {
    _originalIndex: number;
    _id: string;
}

export function TechAtlasDeck({ rawData }: { rawData: TechnologyCourseRow[] }) {
    // Annotate original indices purely for reliable color picking
    const initialData: CardWithId[] = useMemo(() => {
        return rawData.map((row, idx) => ({ ...row, _originalIndex: idx, _id: row.Technology }));
    }, [rawData]);

    const [viewMode, setViewMode] = useState<DeckViewMode>('default');
    const [searchQuery, setSearchQuery] = useState('');

    // The full universe of cards based on view mode (sort/shuffle overrides default)
    const [deckState, setDeckState] = useState<CardWithId[]>(initialData);

    // The visible subset based on search
    const filteredDeck = useMemo(() => {
        if (!searchQuery.trim()) return deckState;
        const lowerQ = searchQuery.toLowerCase();
        return deckState.filter((card) => card.Technology.toLowerCase().includes(lowerQ));
    }, [deckState, searchQuery]);

    // Which cards are active in the stack
    const [visibleStack, setVisibleStack] = useState<CardWithId[]>([]);

    // Keep visibleStack in sync when filteredDeck changes
    useEffect(() => {
        setVisibleStack([...filteredDeck]);
    }, [filteredDeck]);

    const handleDismiss = (dir: 'left' | 'right') => {
        setVisibleStack((prev) => {
            const next = [...prev];
            const dismissed = next.shift(); // Remove top card
            if (dismissed) {
                next.push(dismissed); // Move to back of the deck loop
            }
            return next;
        });
    };

    const handleNext = () => {
        handleDismiss('left'); // swipe left effect
    };

    const handlePrev = () => {
        setVisibleStack((prev) => {
            const next = [...prev];
            const last = next.pop(); // Take from back
            if (last) {
                next.unshift(last); // Put on top
            }
            return next;
        });
    };

    // Re-sorting logic
    const handleToggleSort = () => {
        if (viewMode === 'sorted') {
            setViewMode('default');
            setDeckState(initialData);
        } else {
            setViewMode('sorted');
            const sorted = [...initialData].sort((a, b) => a.Technology.localeCompare(b.Technology));
            setDeckState(sorted);
        }
    };

    const handleShuffle = () => {
        if (viewMode === 'shuffled') {
            setViewMode('default');
            setDeckState(initialData);
        } else {
            setViewMode('shuffled');
            const shuffled = [...initialData];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setDeckState(shuffled);
        }
    };

    return (
        <div className="relative w-full h-full min-h-screen bg-[#0A0A0A] overflow-hidden flex flex-col">

            {/* Stack Area */}
            <div className="flex-1 w-full relative flex justify-center items-center px-4 pb-32 pt-10">
                <div className="relative w-[95vw] max-w-[850px] h-[80vh] max-h-[700px] flex justify-center mb-10">
                    {visibleStack.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-center flex-col px-8" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                            <span className="text-4xl mb-4">✨</span>
                            <p>No technologies matched your search.</p>
                        </div>
                    ) : (
                        // We slice the first 3 items for performance and stacking, rendering them in REVERSE
                        // so index 0 is at the bottom of the DOM (highest z-index visually mapped via JS)
                        visibleStack.slice(0, 3).reverse().map((card, _reverseIndex, sliceArr) => {
                            const stackIndex = (sliceArr.length - 1) - _reverseIndex; // 0 is top
                            return (
                                <TechCard
                                    key={`${card._id}-${viewMode}`}
                                    data={card}
                                    index={card._originalIndex}
                                    stackIndex={stackIndex}
                                    totalStacked={Math.min(3, visibleStack.length)}
                                    onDismiss={handleDismiss}
                                    isActive={stackIndex === 0}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            <DeckControls
                viewMode={viewMode}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onToggleSort={handleToggleSort}
                onShuffle={handleShuffle}
                onPrev={handlePrev}
                onNext={handleNext}
                currentIndex={
                    visibleStack.length > 0
                        ? deckState.findIndex(c => c._id === visibleStack[0]._id)
                        : 0
                }
                totalCards={filteredDeck.length}
            />
        </div>
    );
}
