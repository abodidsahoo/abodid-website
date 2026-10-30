import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const INSTALLATION_INSTRUCTIONS = 'https://github.com/abodidsahoo/abodid-website/blob/main/extension/README.md#local-installation-and-checks';

export function OpportunityExtensionHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (open && !dialog.current?.open) dialog.current?.showModal();
        if (!open && dialog.current?.open) dialog.current.close();
    }, [open]);
    return <dialog ref={dialog} className="opp-extension-help" data-pop-surface="cream" aria-labelledby="opp-extension-help-title" onClose={onClose} onCancel={onClose}>
        <button type="button" className="opp-extension-help-close" aria-label="Close installation instructions" onClick={onClose}><X size={20} aria-hidden="true" /></button>
        <h2 id="opp-extension-help-title">Install Chrome Extension</h2>
        <p>The store release is coming soon. Local installation is available through the project’s setup guide.</p>
        <a href={INSTALLATION_INSTRUCTIONS} target="_blank" rel="noopener noreferrer"><span>Open installation instructions</span><span aria-hidden="true">↗</span></a>
    </dialog>;
}
