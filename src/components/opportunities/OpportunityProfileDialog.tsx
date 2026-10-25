import { OpportunityBusy } from './OpportunityBusy';
import React, { useEffect, useRef, useState } from 'react';
import { isValidOpportunityUsername, normalizeOpportunityUsername } from '../../lib/opportunities/username';

export interface OpportunityEditableProfile {
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_public: boolean;
    role?: string;
}

interface OpportunityProfileDialogProps {
    accessToken: string | null;
    isOpen: boolean;
    profile: OpportunityEditableProfile;
    onClose: () => void;
    onSaved: (profile: OpportunityEditableProfile) => void;
}

export const OpportunityProfileDialog: React.FC<OpportunityProfileDialogProps> = ({
    accessToken,
    isOpen,
    profile,
    onClose,
    onSaved,
}) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [displayName, setDisplayName] = useState(profile.display_name);
    const [username, setUsername] = useState(profile.username);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setDisplayName(profile.display_name);
        setUsername(profile.username);
        setMessage('');
    }, [isOpen, profile.display_name, profile.username]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isOpen && !dialog.open) {
            dialog.showModal();
        } else if (!isOpen && dialog.open) {
            dialog.close();
        }
    }, [isOpen]);

    const closeDialog = () => {
        if (!isSaving) dialogRef.current?.close();
    };

    const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const cleanUsername = normalizeOpportunityUsername(username);
        const cleanDisplayName = displayName.trim();

        if (!cleanDisplayName) {
            setMessage('Display name cannot be empty.');
            return;
        }
        if (!isValidOpportunityUsername(cleanUsername)) {
            setMessage('Use 3–24 lowercase letters, numbers or underscores. This name may be reserved.');
            return;
        }

        setIsSaving(true);
        setMessage('');
        try {
            const response = await fetch('/api/opportunities/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({
                    display_name: cleanDisplayName,
                    username: cleanUsername,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Profile changes could not be saved.');

            onSaved(payload.profile as OpportunityEditableProfile);
            dialogRef.current?.close();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Profile changes could not be saved.');
        } finally {
            setIsSaving(false);
        }
    };

    const usernameChanged = normalizeOpportunityUsername(username) !== profile.username;

    return (
        <dialog
            ref={dialogRef}
            className="opp-profile-dialog"
            aria-labelledby="opp-profile-dialog-title"
            aria-describedby="opp-profile-dialog-description"
            onClose={onClose}
            onCancel={(event) => {
                event.preventDefault();
                closeDialog();
            }}
        >
            <form className="opp-profile-form" onSubmit={saveProfile}>
                <div className="opp-profile-dialog-heading">
                    <div>
                        <p className="opp-profile-dialog-label">Profile &amp; public URL</p>
                        <h2 id="opp-profile-dialog-title">Edit your collection identity</h2>
                    </div>
                    <button
                        type="button"
                        className="opp-profile-dialog-close"
                        aria-label="Close profile editor"
                        onClick={closeDialog}
                    >
                        ×
                    </button>
                </div>

                <p id="opp-profile-dialog-description" className="opp-profile-dialog-copy">
                    Update the name people see and the address used for your collection.
                </p>

                <div className="opp-profile-field">
                    <label htmlFor="opportunity-profile-display-name">Display name</label>
                    <input
                        id="opportunity-profile-display-name"
                        name="display_name"
                        value={displayName}
                        onChange={(event) => {
                            setDisplayName(event.target.value);
                            setMessage('');
                        }}
                        autoComplete="name"
                        maxLength={120}
                        required
                        autoFocus
                    />
                </div>

                <div className="opp-profile-field">
                    <label htmlFor="opportunity-profile-username">Personal URL</label>
                    <p id="opportunity-profile-username-hint" className="opp-profile-field-note">
                        Use 3–24 lowercase letters, numbers or underscores.
                    </p>
                    <div className="opp-profile-url-field">
                        <span aria-hidden="true">abodid.com/opportunities/</span>
                        <input
                            id="opportunity-profile-username"
                            name="username"
                            value={username}
                            onChange={(event) => {
                                setUsername(normalizeOpportunityUsername(event.target.value));
                                setMessage('');
                            }}
                            aria-describedby={usernameChanged
                                ? 'opportunity-profile-username-hint opportunity-profile-url-warning'
                                : 'opportunity-profile-username-hint'}
                            autoComplete="username"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            minLength={3}
                            maxLength={24}
                            pattern="[a-z0-9_]{3,24}"
                            required
                        />
                    </div>
                </div>

                {usernameChanged && (
                    <p id="opportunity-profile-url-warning" className="opp-profile-url-warning">
                        Changing this address will stop previously shared collection links from working.
                    </p>
                )}

                {message && <p className="opp-profile-message" role="status" aria-live="polite">{message}</p>}

                <div className="opp-profile-actions">
                    <button type="button" className="opp-profile-cancel" onClick={closeDialog} disabled={isSaving}>
                        Cancel
                    </button>
                    <button type="submit" className="opp-profile-save" disabled={isSaving}>
                        {isSaving ? <OpportunityBusy>Saving</OpportunityBusy> : 'Save changes'}
                    </button>
                </div>
            </form>
        </dialog>
    );
};

export default OpportunityProfileDialog;
