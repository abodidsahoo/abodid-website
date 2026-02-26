import React from 'react';
import { Search, Shuffle, ArrowLeft, ArrowRight, ArrowDownAZ } from 'lucide-react';
import type { DeckViewMode } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export type DeckControlsProps = {
    viewMode: DeckViewMode;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onToggleSort: () => void;
    onShuffle: () => void;
    onPrev: () => void;
    onNext: () => void;
    currentIndex: number;
    totalCards: number;
};

export function DeckControls({
    viewMode,
    searchQuery,
    onSearchChange,
    onToggleSort,
    onShuffle,
    onPrev,
    onNext,
    currentIndex,
    totalCards
}: DeckControlsProps) {

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center w-full max-w-[340px] px-4 pointer-events-none">

            <div className="text-white/40 text-[10px] font-bold tracking-widest uppercase mb-3 pointer-events-auto" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                {totalCards > 0 ? `${currentIndex + 1} OF ${totalCards}` : '0 RESULTS'}
            </div>

            {/* Search Bar */}
            <div className="relative w-full pointer-events-auto shadow-2xl rounded-xl overflow-hidden mb-2">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-white/50" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-9 pr-3 py-2.5 bg-[#1A1A1A] border border-white/10 rounded-xl text-white placeholder-white/40 focus:ring-1 focus:ring-white/20 transition-all text-[13px] outline-none"
                    placeholder="Search Technology..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                />
            </div>

            {/* Controls Container */}
            <div className="flex items-center justify-between gap-1 w-full bg-[#1A1A1A]/80 backdrop-blur-xl p-1.5 rounded-xl border border-white/10 pointer-events-auto shadow-2xl">

                <button
                    onClick={onToggleSort}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors border",
                        viewMode === 'sorted'
                            ? "bg-white text-black border-transparent"
                            : "text-white/70 hover:bg-white/10 border-transparent hover:text-white"
                    )}
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                    aria-pressed={viewMode === 'sorted'}
                >
                    <ArrowDownAZ className="w-3.5 h-3.5" />
                    <span>Sort A-Z</span>
                </button>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onPrev}
                        disabled={totalCards === 0}
                        className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors disabled:opacity-30"
                        aria-label="Previous card"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>

                    <button
                        onClick={onShuffle}
                        className={cn(
                            "p-2 rounded-lg text-[12px] font-medium transition-colors border flex items-center justify-center",
                            viewMode === 'shuffled'
                                ? "bg-white text-black border-transparent"
                                : "text-white/70 hover:bg-white/10 border-transparent hover:text-white"
                        )}
                        aria-pressed={viewMode === 'shuffled'}
                        aria-label="Shuffle"
                    >
                        <Shuffle className="w-4 h-4" />
                    </button>

                    <button
                        onClick={onNext}
                        disabled={totalCards <= 1}
                        className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors disabled:opacity-30"
                        aria-label="Next card"
                    >
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
