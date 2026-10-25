import React, { useEffect, useState } from 'react';

const EXAMPLES = [
    'Copy an opportunity URL and paste it here.',
    'Click the paperclip to add an image or PDF.',
    'Remind me to apply for the Nat Geo Open Call. The deadline is December 12.',
    'Save this residency: https://example.org/open-call',
];

/** Matches the moodboard's 5.6s phrase cycle, upward slide and text shimmer. */
export function OpportunityCaptureExamples() {
    const [index, setIndex] = useState(0);
    const [exiting, setExiting] = useState(false);
    useEffect(() => {
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let transition: ReturnType<typeof setTimeout> | undefined;
        const cycle = window.setInterval(() => {
            if (motion.matches || document.hidden || document.querySelector('#opportunity-capture-input:focus')) return;
            setExiting(true);
            transition = setTimeout(() => {
                setIndex((current) => (current + 1) % EXAMPLES.length);
                setExiting(false);
            }, 350);
        }, 5600);
        return () => { clearInterval(cycle); clearTimeout(transition); };
    }, []);
    return <div className="opp-capture-examples" aria-hidden="true"><span>Try</span><span key={index} className={`opp-example-phrase ${exiting ? 'is-exiting' : 'is-entering'}`}>‘{EXAMPLES[index]}’</span></div>;
}
