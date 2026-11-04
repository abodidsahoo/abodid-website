import React, { useEffect, useId, useRef } from 'react';

export default function MediaLibraryDialog({ title, description, busy, onClose, onSubmit, children }) {
    const dialogRef = useRef(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog.open) dialog.showModal();
        return () => { if (dialog.open) dialog.close(); };
    }, []);
    return <dialog ref={dialogRef} className="media-library-dialog" aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
        onClick={(event) => {
            if (event.target !== event.currentTarget || busy) return;
            const box = event.currentTarget.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
        }}>
        <form onSubmit={onSubmit}>
            <h3 id={titleId}>{title}</h3>
            {description && <p className="dialog-description">{description}</p>}
            {children}
        </form>
    </dialog>;
}
