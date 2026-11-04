import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function MediaLibraryMenu({ request, items, onClose }) {
    const menuRef = useRef(null);
    const pointRef = useRef(null);
    const anchorName = `--media-menu-${useId().replace(/[^a-z0-9]/gi, '')}`;
    const nativeFocus = typeof HTMLElement !== 'undefined' && 'focusGroup' in HTMLElement.prototype;
    useEffect(() => {
        if (!request) return undefined;
        const menu = menuRef.current;
        const point = pointRef.current;
        let active = true;
        let frame;
        const restore = () => {
            if (request.source?.isConnected) request.source.focus({ preventScroll: true });
        };
        const focusFirst = () => menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
        const toggled = (event) => {
            if (event.newState === 'closed') { restore(); onClose(); }
            else focusFirst();
        };
        const outside = (event) => { if (!menu.contains(event.target)) { restore(); onClose(); } };
        const outsideFocus = (event) => { if (!menu.contains(event.target) && event.target !== request.source) onClose(); };
        menu.addEventListener('toggle', toggled);
        request.ready.then(() => {
            if (!active) return;
            frame = requestAnimationFrame(() => {
                if (!active) return;
                const nativePopover = 'popover' in HTMLElement.prototype;
                if (nativePopover) menu.showPopover({ source: point });
                else menu.style.display = 'block';
                // Context menus anchor to the pointer; CSS flips at viewport edges.
                // Older engines receive equivalent fixed-position placement.
                if (!CSS.supports('position-area: block-end')) {
                    const rect = menu.getBoundingClientRect();
                    menu.style.left = `${Math.max(8, Math.min(request.x, window.innerWidth - rect.width - 8))}px`;
                    menu.style.top = `${Math.max(8, Math.min(request.y, window.innerHeight - rect.height - 8))}px`;
                }
                document.addEventListener('pointerdown', outside);
                document.addEventListener('focusin', outsideFocus);
                if (!nativePopover) focusFirst();
            });
        });
        return () => {
            active = false;
            cancelAnimationFrame(frame);
            menu.removeEventListener('toggle', toggled);
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('focusin', outsideFocus);
        };
    }, [request, onClose]);
    if (!request) return null;
    const close = () => {
        request.source?.focus({ preventScroll: true });
        onClose();
    };
    return createPortal(<>
        <span ref={pointRef} style={{ position: 'fixed', left: request.x, top: request.y, width: 0, height: 0, anchorName }} />
        <div ref={menuRef} popover="auto" className="media-context-menu" style={{ positionAnchor: anchorName }}
            onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}>
            <div focusgroup="menu nomemory" role={nativeFocus ? undefined : 'menu'} aria-label="Media Library actions"
                onKeyDown={(event) => {
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
                    if (event.key === 'Tab') { close(); return; }
                    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || (nativeFocus && ['ArrowDown', 'ArrowUp'].includes(event.key))) return;
                    const buttons = [...menuRef.current.querySelectorAll('button:not(:disabled)')];
                    const index = buttons.indexOf(document.activeElement);
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
                    event.preventDefault();
                    buttons[next]?.focus();
                }}>
                {items.map((item) => <button key={item.label} type="button" role={nativeFocus ? undefined : 'menuitem'} tabIndex={-1}
                    disabled={item.disabled} onClick={() => { close(); item.run(); }}>
                    {item.icon}<span>{item.label}</span>
                </button>)}
            </div>
        </div>
    </>, request.source?.closest('.media-library') || document.body);
}
