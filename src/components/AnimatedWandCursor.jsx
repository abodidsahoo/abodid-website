import { useEffect, useRef } from 'react';
import { EDITORIAL_ANIMATED_CURSOR_SVG } from '../lib/editorialCursor.js';
import '../styles/animated-wand-cursor.css';

export default function AnimatedWandCursor({ surfaceRef }) {
  const cursorRef = useRef(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    const cursor = cursorRef.current;
    if (!surface || !cursor) return;

    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    let x = 0;
    let y = 0;
    const hide = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      cursor.hidden = true;
      cursor.removeAttribute('data-twinkling');
      surface.removeAttribute('data-wand-active');
    };
    const move = (event) => {
      if (!finePointer.matches || event.pointerType !== 'mouse' ||
          event.target.closest('a, button, input, textarea, select, summary, [contenteditable], [data-native-cursor]')) {
        hide();
        return;
      }
      x = event.clientX - 15;
      y = event.clientY - 15;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        cursor.hidden = false;
        cursor.setAttribute('data-twinkling', '');
        surface.setAttribute('data-wand-active', '');
      });
    };
    // Each pointer interaction gets a short burst; an idle pointer settles.
    const settle = (event) => {
      if (event.animationName === 'editorial-wand-sway') {
        cursor.removeAttribute('data-twinkling');
      }
    };

    surface.addEventListener('pointermove', move, { passive: true });
    surface.addEventListener('pointerleave', hide);
    cursor.addEventListener('animationend', settle);
    finePointer.addEventListener('change', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('resize', hide, { passive: true });
    return () => {
      hide();
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerleave', hide);
      cursor.removeEventListener('animationend', settle);
      finePointer.removeEventListener('change', hide);
      window.removeEventListener('blur', hide);
      window.removeEventListener('scroll', hide);
      window.removeEventListener('resize', hide);
    };
  }, [surfaceRef]);

  return (
    <div
      ref={cursorRef}
      className="editorial-wand"
      aria-hidden="true"
      hidden
      dangerouslySetInnerHTML={{ __html: EDITORIAL_ANIMATED_CURSOR_SVG }}
    />
  );
}
