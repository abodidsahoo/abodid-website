import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import type { TechnologyCourseRow } from './types';
import { ExternalLink, PlayCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export type TechCardProps = {
    data: TechnologyCourseRow;
    index: number;
    stackIndex: number;
    totalStacked: number;
    onDismiss: (dir: 'left' | 'right') => void;
    isActive: boolean;
};

const PASTEL_PALETTE = [
    'bg-[#FEF08A]', // Lemon
    'bg-[#FBCFE8]', // Pink
    'bg-[#E9D5FF]', // Lavender
    'bg-[#BAE6FD]', // Blue
    'bg-[#FEFCE8]', // Cream
    'bg-[#D9F99D]', // Lime
];

const getYouTubeID = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

export function TechCard({ data, index, stackIndex, totalStacked, onDismiss, isActive }: TechCardProps) {
    const controls = useAnimation();
    const cardRef = useRef<HTMLDivElement>(null);
    const bgColorClass = PASTEL_PALETTE[index % PASTEL_PALETTE.length];

    const SWIPE_THRESHOLD = 50;
    const VELOCITY_THRESHOLD = 500;

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: any) => {
        const swipeDistance = info.offset.x;
        const swipeVelocity = info.velocity.x;

        if (swipeDistance > SWIPE_THRESHOLD || swipeVelocity > VELOCITY_THRESHOLD) {
            animateDismiss('right');
        } else if (swipeDistance < -SWIPE_THRESHOLD || swipeVelocity < -VELOCITY_THRESHOLD) {
            animateDismiss('left');
        } else {
            controls.start({ x: 0, y: 0, rotate: 0, opacity: 1, scale: activeScale });
        }
    };

    const animateDismiss = async (dir: 'left' | 'right') => {
        const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
        const exitX = dir === 'right' ? screenWidth : -screenWidth;
        const exitRotate = dir === 'right' ? 15 : -15;

        await controls.start({
            x: exitX,
            opacity: 0,
            rotate: exitRotate,
            scale: 0.9,
            transition: { duration: 0.3, ease: 'easeOut' }
        });

        controls.set({ x: 0, rotate: 0, opacity: 1, scale: 0.95 });
        onDismiss(dir);
    };

    const isVisible = stackIndex < totalStacked;
    const activeScale = 1 - (stackIndex * 0.04);
    const activeY = stackIndex * 24;
    const zIndex = 50 - stackIndex;

    useEffect(() => {
        if (isActive) {
            controls.start({
                x: 0, y: 0, scale: 1, opacity: 1, rotate: 0,
                transition: { type: 'spring', stiffness: 300, damping: 25 }
            });
        } else if (isVisible) {
            controls.start({
                x: 0, y: activeY, scale: activeScale, opacity: 1, rotate: 0,
                transition: { type: 'spring', stiffness: 300, damping: 25 }
            });
        }
    }, [isActive, stackIndex, isVisible, controls, activeScale, activeY]);

    if (!isVisible && !isActive) return null;

    const ytID = getYouTubeID(data.Intro_Video_or_Tutorial_Link);
    // Explicitly check for exact "null / Na / #N/A" strings that might be in JSON incorrectly if any exist,
    // though the provided JSON seems to have standard URLs or blanks.
    const urlString = (data.Intro_Video_or_Tutorial_Link || "").trim();
    const hasVideo = urlString.length > 5 && urlString.toLowerCase() !== "null";

    return (
        <motion.div
            ref={cardRef}
            className={cn(
                "absolute w-full h-full rounded-[32px] shadow-2xl overflow-hidden flex flex-col will-change-transform origin-[50%_85%]",
                bgColorClass,
                isActive ? "cursor-grab active:cursor-grabbing" : "cursor-default pointer-events-none"
            )}
            style={{ zIndex, fontFamily: 'Satoshi, sans-serif' }}
            animate={controls}
            initial={false}
            drag={isActive ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={handleDragEnd}
            whileTap={isActive ? { scale: 0.99 } : undefined}
        >
            <div className="flex-1 bg-white/40 p-4 sm:p-8 flex flex-col gap-3 sm:gap-5 overflow-hidden">
                {/* Header Block: Huge Title */}
                <div className="flex-shrink-0 mb-1 sm:mb-2">
                    <h1 className="text-4xl sm:text-5xl md:text-[5rem] font-black text-black tracking-tighter leading-[0.9] mb-2">
                        {data.Technology}
                    </h1>
                    <p className="text-sm sm:text-xl md:text-3xl font-bold text-black/70 leading-snug max-w-3xl line-clamp-2">
                        {data.Simple_Utility}
                    </p>
                </div>

                {/* Grid Area: Small notes / Medium notes */}
                <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-4 lg:gap-5 min-h-0">
                    <div className="bg-white/60 rounded-xl sm:rounded-3xl p-3 sm:p-5 flex flex-col overflow-y-auto custom-scrollbar">
                        <h3 className="text-[8px] sm:text-[11px] uppercase font-bold tracking-[0.1em] sm:tracking-[0.2em] text-black/40 mb-1 sm:mb-3">Implementation</h3>
                        <p className="text-[10px] sm:text-sm md:text-lg font-bold text-black/90 leading-tight sm:leading-snug">
                            {data.Real_World_Implementation}
                        </p>
                    </div>
                    <div className="bg-white/60 rounded-xl sm:rounded-3xl p-3 sm:p-5 flex flex-col overflow-y-auto custom-scrollbar">
                        <h3 className="text-[8px] sm:text-[11px] uppercase font-bold tracking-[0.1em] sm:tracking-[0.2em] text-black/40 mb-1 sm:mb-3">Skills Needed</h3>
                        <p className="text-[10px] sm:text-sm md:text-lg font-bold text-black/90 leading-tight sm:leading-snug">
                            {data.Key_Skills_Thought_Process}
                        </p>
                    </div>
                    <div className="bg-white/60 rounded-xl sm:rounded-3xl p-3 sm:p-5 flex flex-col overflow-y-auto custom-scrollbar">
                        <h3 className="text-[8px] sm:text-[11px] uppercase font-bold tracking-[0.1em] sm:tracking-[0.2em] text-black/40 mb-1 sm:mb-3">Example</h3>
                        <p className="text-[10px] sm:text-sm md:text-lg font-bold text-black/90 leading-tight sm:leading-snug">
                            {data.Real_Life_Example}
                        </p>
                    </div>
                </div>

                {/* Footer Block */}
                <div className="flex-shrink-0 bg-white/60 rounded-xl sm:rounded-3xl p-3 sm:p-5 flex flex-col sm:flex-row items-center gap-2 sm:gap-6 mt-auto max-h-[140px] sm:max-h-[160px]">
                    <div className="flex-1 w-full text-center sm:text-left overflow-y-auto custom-scrollbar">
                        <h3 className="text-[8px] sm:text-[11px] uppercase font-bold tracking-[0.1em] sm:tracking-[0.2em] text-black/40 mb-1 sm:mb-2">Origin & Key Info</h3>
                        <p className="text-[10px] sm:text-xs md:text-base font-bold text-black/90 leading-snug">
                            {data.Origin_Company_KeyPeople_Place_and_Year}
                        </p>
                    </div>

                    <div
                        className="w-full sm:w-[220px] h-[100px] sm:h-auto flex-shrink-0 flex items-center justify-center bg-black/5 rounded-xl border border-black/10 overflow-hidden relative"
                        onPointerDown={(e) => e.stopPropagation()} /* Prevents dragging card when trying to click video */
                    >
                        {ytID ? (
                            <iframe
                                className="w-full h-full min-h-[100px]"
                                src={`https://www.youtube.com/embed/${ytID}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        ) : hasVideo ? (
                            <a href={urlString} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4 text-black/60 hover:text-black hover:bg-white/50 w-full h-full justify-center transition-colors">
                                <ExternalLink className="w-5 h-5 sm:w-6 sm:h-6" />
                                <span className="text-[9px] sm:text-xs font-bold uppercase tracking-widest text-center">Open Link</span>
                            </a>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-2 sm:p-4 text-black/40 h-full w-full">
                                <PlayCircle className="w-5 h-5 sm:w-6 sm:h-6 mb-1 opacity-50" />
                                <span className="text-[9px] sm:text-xs font-bold uppercase tracking-[0.1em] text-center">No Video</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
