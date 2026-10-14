import React, { useEffect, useRef } from 'react';

interface OpportunitySupportPromptProps {
    isOpen: boolean;
    onDismiss: () => void;
}

export const OpportunitySupportPrompt: React.FC<OpportunitySupportPromptProps> = ({
    isOpen,
    onDismiss,
}) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isOpen && !dialog.open) {
            dialog.showModal();
        } else if (!isOpen && dialog.open) {
            dialog.close();
        }
    }, [isOpen]);

    const closeDialog = () => dialogRef.current?.close();

    return (
        <dialog
            ref={dialogRef}
            className="opp-support-dialog"
            aria-labelledby="opp-support-title"
            aria-describedby="opp-support-description"
            onClose={onDismiss}
            onCancel={(event) => {
                event.preventDefault();
                closeDialog();
            }}
        >
            <div className="opp-support-accent" aria-hidden="true" />
            <p className="opp-support-label">Support</p>
            <h2 id="opp-support-title" className="opp-support-title">Found this useful?</h2>
            <p id="opp-support-description" className="opp-support-copy">
                If Opportunity Tracker has helped, you can buy me a coffee. Any amount is appreciated.
            </p>
            <div className="opp-support-actions">
                <a
                    className="opp-support-link"
                    href="/payments"
                    target="_blank"
                    rel="noreferrer"
                    autoFocus
                    onClick={onDismiss}
                >
                    <span>Buy me a coffee</span>
                    <span className="opp-support-arrow" aria-hidden="true">↗</span>
                </a>
                <button type="button" className="opp-support-dismiss" onClick={closeDialog}>
                    Not now
                </button>
            </div>
        </dialog>
    );
};

export default OpportunitySupportPrompt;
