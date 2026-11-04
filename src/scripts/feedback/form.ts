export {};

function initializeFeedbackPage() {
    const page = document.querySelector<HTMLElement>('[data-feedback-page], [data-workshop-feedback-page]');
    if (!page || page.dataset.feedbackInitialized === 'true') return;
    page.dataset.feedbackInitialized = 'true';
    const form = page.querySelector<HTMLFormElement>('[data-feedback-form]');
    const feedbackStage = page.querySelector<HTMLElement>('[data-feedback-stage]');
    const thankYou = page.querySelector<HTMLElement>('[data-feedback-thank-you]');
    const status = page.querySelector<HTMLElement>('[data-feedback-status]');
    const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    const buttonLabel = button?.querySelector<HTMLElement>('[data-submit-label]') || button;
    const initialButtonLabel = buttonLabel?.textContent || 'Submit feedback';
    const slug = page.dataset.formSlug || '';
    const receiptKey = `feedback:${slug}:submitted`;
    const pendingKey = `feedback:${slug}:pending`;

    function readStorage(key: string, session = false) {
        try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; }
    }
    function showThankYou(focus = false) {
        // Pages with a separate success URL must never hide their entire content as a fallback.
        if (page!.hasAttribute('data-feedback-redirect')) {
            if (status) status.textContent = 'Thanks for sharing your feedback!';
            return;
        }
        page!.classList.add('is-submitted');
        if (form) form.hidden = true;
        if (feedbackStage) feedbackStage.hidden = true;
        for (const step of page!.querySelectorAll<HTMLElement>('[data-progress-step]')) {
            if (step.dataset.progressStep === '2') step.setAttribute('aria-current', 'step');
            else step.removeAttribute('aria-current');
        }
        if (page!.dataset.resourcesTitle) document.title = page!.dataset.resourcesTitle;
        if (thankYou) {
            thankYou.hidden = false;
            if (focus) {
                thankYou.focus({ preventScroll: true });
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
        }
    }
    if (!page.hasAttribute('data-feedback-redirect') && (page.dataset.previewMode === 'resources' || (page.dataset.previewMode !== 'feedback' && (
        page.classList.contains('is-submitted') || readStorage(receiptKey)
        || (page.dataset.legacyStorageKey && readStorage(page.dataset.legacyStorageKey) === 'true')
    )))) showThankYou();

    if (page.hasAttribute('data-workshop-feedback-page') && page.dataset.resourcesUnlocked !== 'true') {
        // Old receipts were scoped to /nift-workshop-resources. This tiny same-origin check
        // receives those cookies and promotes valid proofs for both navigation tabs.
        fetch('/nift-workshop-resources/access.json', { cache: 'no-store', credentials: 'same-origin' })
            .then((response) => response.ok ? response.json() : null)
            .then((access) => {
                if (!access?.unlocked) return;
                const tab = page.querySelector<HTMLElement>('[data-resources-tab]');
                if (!tab || tab instanceof HTMLAnchorElement) return;
                const link = document.createElement('a'); link.href = '/nift-workshop-resources';
                link.setAttribute('data-resources-tab', ''); link.setAttribute('data-astro-reload', '');
                link.append(...Array.from(tab.childNodes)); tab.replaceWith(link);
                page.dataset.resourcesUnlocked = 'true';
            }).catch(() => { /* A failed access check keeps the form visible and resources gated. */ });
    }

    for (const img of page.querySelectorAll<HTMLImageElement>('[data-workshop-image]')) {
        const markUnavailable = () => {
            const frame = img.closest<HTMLElement>('[data-image-frame]');
            if (frame) frame.dataset.imageState = 'unavailable';
            img.hidden = true;
        };
        img.addEventListener('error', markUnavailable);
        if (img.complete && img.naturalWidth === 0) markUnavailable();
    }

    const changeEmailBtn = page.querySelector<HTMLButtonElement>('[data-change-email-trigger]');
    const emailTargetInfo = page.querySelector<HTMLElement>('[data-email-target-info]');
    const emailInputWrap = page.querySelector<HTMLElement>('[data-email-input-wrapper]');
    changeEmailBtn?.addEventListener('click', () => {
        if (emailTargetInfo) emailTargetInfo.hidden = true;
        if (emailInputWrap) {
            emailInputWrap.hidden = false;
            const input = emailInputWrap.querySelector<HTMLInputElement>('input[name="email"]');
            input?.focus();
            input?.select();
        }
    });

    const emailDialog = page.querySelector<HTMLDialogElement>('#email-prompt-dialog');
    const openDialogBtn = page.querySelector<HTMLButtonElement>('[data-open-email-dialog]');
    const closeDialogBtn = emailDialog?.querySelector<HTMLButtonElement>('[data-close-dialog]');
    const pageEmailStatus = page.querySelector<HTMLElement>('[data-page-email-status]');

    openDialogBtn?.addEventListener('click', () => {
        if (emailDialog && typeof emailDialog.showModal === 'function') {
            emailDialog.showModal();
        }
    });
    closeDialogBtn?.addEventListener('click', () => {
        emailDialog?.close();
    });
    emailDialog?.addEventListener('click', (event) => {
        if (event.target === emailDialog) emailDialog.close();
    });

    for (const form of page.querySelectorAll<HTMLFormElement>('[data-resource-email-form]')) {
        let lastResourceEmail = '';
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
            const buttonLabel = button?.querySelector<HTMLElement>('[data-submit-label]') || button;
            const initialLabel = buttonLabel?.textContent || 'Send all PPTs and links to my email.';
            const status = form.querySelector<HTMLElement>('[data-email-status]');
            const recipient = String(new FormData(form).get('email') || '').trim().toLowerCase();
            const key = form.querySelector<HTMLInputElement>('[name="submission_key"]');
            if (key && lastResourceEmail && lastResourceEmail !== recipient) key.value = crypto.randomUUID();
            lastResourceEmail = recipient;

            if (button) button.disabled = true;
            if (buttonLabel) buttonLabel.textContent = 'Sending…';
            if (status) status.textContent = 'Sending…';
            form.setAttribute('aria-busy', 'true');

            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    headers: { Accept: 'application/json' },
                    body: new FormData(form),
                });
                const result = await response.json();
                if (!response.ok || !result.ok) throw new Error(result.error || 'Please try again.');

                const successMsg = result.status === 'pending'
                    ? 'Your email is being processed.'
                    : 'Sent! Please check your inbox and spam folder.';
                if (status) status.textContent = successMsg;
                if (pageEmailStatus) pageEmailStatus.textContent = successMsg;

                if (emailDialog && emailDialog.contains(form)) {
                    setTimeout(() => {
                        emailDialog.close();
                        if (openDialogBtn) {
                            openDialogBtn.textContent = 'Resource links sent!';
                            openDialogBtn.disabled = true;
                        }
                    }, 1200);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Please try again.';
                if (status) status.textContent = errorMsg;
                if (pageEmailStatus) pageEmailStatus.textContent = errorMsg;
            } finally {
                form.removeAttribute('aria-busy');
                if (button) button.disabled = false;
                if (buttonLabel) buttonLabel.textContent = initialLabel;
            }
        });
    }

    const photographyForm = page.querySelector<HTMLFormElement>('[data-photography-form]');
    const photographyStatus = photographyForm?.querySelector<HTMLElement>('[data-photography-status]');
    photographyForm?.addEventListener('input', () => { if (photographyStatus) photographyStatus.textContent = ''; });
    photographyForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!photographyForm.reportValidity()) return;
        const submit = photographyForm.querySelector<HTMLButtonElement>('button[type="submit"]');
        const label = submit?.querySelector<HTMLElement>('[data-submit-label]');
        const initialLabel = label?.textContent || 'Send';
        if (submit) submit.disabled = true;
        if (label) label.textContent = 'Saving…';
        photographyForm.setAttribute('aria-busy', 'true');
        try {
            const response = await fetch(photographyForm.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(photographyForm) });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not save your interest. Please try again.');
            if (photographyStatus) {
                photographyStatus.textContent = 'Thanks! Your interest is saved.';
                photographyStatus.dataset.state = 'success';
                photographyStatus.focus();
            }
        } catch (error) {
            if (photographyStatus) {
                photographyStatus.textContent = error instanceof Error ? error.message : 'Could not save your interest. Please try again.';
                photographyStatus.dataset.state = 'error';
                photographyStatus.focus();
            }
        } finally {
            photographyForm.removeAttribute('aria-busy');
            if (submit) submit.disabled = false;
            if (label) label.textContent = initialLabel;
        }
    });

    const albumThoughtsForm = page.querySelector<HTMLFormElement>('[data-album-thoughts-form]');
    const albumStatus = albumThoughtsForm?.querySelector<HTMLElement>('[data-album-status]');
    albumThoughtsForm?.addEventListener('input', () => { if (albumStatus) albumStatus.textContent = ''; });
    albumThoughtsForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!albumThoughtsForm.reportValidity()) return;
        const submit = albumThoughtsForm.querySelector<HTMLButtonElement>('button[type="submit"]');
        const label = submit?.querySelector<HTMLElement>('[data-submit-label]');
        const initialLabel = label?.textContent || 'Send';
        if (submit) submit.disabled = true;
        if (label) label.textContent = 'Sending…';
        albumThoughtsForm.setAttribute('aria-busy', 'true');
        try {
            const response = await fetch(albumThoughtsForm.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(albumThoughtsForm) });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not save your thoughts. Please try again.');
            if (albumStatus) {
                albumStatus.textContent = 'Thank you! Your thoughts have been saved privately.';
                albumStatus.dataset.state = 'success';
                albumStatus.focus();
            }
            const textarea = albumThoughtsForm.querySelector<HTMLTextAreaElement>('textarea');
            if (textarea) {
                textarea.value = '';
                textarea.style.height = 'auto';
            }
        } catch (error) {
            if (albumStatus) {
                albumStatus.textContent = error instanceof Error ? error.message : 'Could not save your thoughts. Please try again.';
                albumStatus.dataset.state = 'error';
                albumStatus.focus();
            }
        } finally {
            albumThoughtsForm.removeAttribute('aria-busy');
            if (submit) submit.disabled = false;
            if (label) label.textContent = initialLabel;
        }
    });

    const keyInput = form?.querySelector<HTMLInputElement>('[name="submission_key"]');
    if (keyInput) {
        const pending = readStorage(pendingKey, true);
        if (pending) keyInput.value = pending;
        try { sessionStorage.setItem(pendingKey, keyInput.value); } catch { /* Submission still works without storage. */ }
    }
    const textareas = page.querySelectorAll<HTMLTextAreaElement>('textarea[data-auto-grow]');
    function resize(textarea: HTMLTextAreaElement) {
        if (!textarea.getClientRects().length) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }
    textareas.forEach((textarea) => {
        resize(textarea);
        textarea.addEventListener('input', () => resize(textarea));
    });
    for (const disclosure of form?.querySelectorAll<HTMLDetailsElement>('details') || []) {
        disclosure.addEventListener('toggle', () => {
            if (disclosure.open) disclosure.querySelectorAll<HTMLTextAreaElement>('textarea[data-auto-grow]').forEach(resize);
        });
    }
    // Native validation must be able to reveal and focus an invalid optional contact field.
    form?.addEventListener('invalid', (event) => {
        if (!(event.target instanceof HTMLElement)) return;
        let disclosure = event.target.closest('details');
        while (disclosure) { disclosure.open = true; disclosure = disclosure.parentElement?.closest('details') || null; }
    }, true);
    form?.addEventListener('input', () => { if (status) status.textContent = ''; });
    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const fields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-answer]'));
        if (!fields.some((field) => field instanceof HTMLInputElement && field.type === 'radio' ? field.checked : field.value.trim())) {
            if (status) {
                status.textContent = 'Please add at least one feedback response.';
                status.dataset.state = 'error';
                status.focus();
            }
            return;
        }
        const data = new FormData(form);
        if (button) button.disabled = true;
        if (buttonLabel) buttonLabel.textContent = 'Submitting…';
        form.setAttribute('aria-busy', 'true');
        try {
            const response = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: data });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not save your feedback. Please try again.');
            try {
                localStorage.setItem(receiptKey, payload.id || 'true');
                sessionStorage.removeItem(pendingKey);
            } catch { /* A storage restriction must not hide a successful save. */ }
            const destination = payload.redirect_to || page.dataset.successUrl;
            if (page.hasAttribute('data-feedback-redirect') && destination) {
                window.location.assign(destination);
                return;
            }
            form.reset();
            showThankYou(true);
        } catch (error) {
            if (status) {
                status.textContent = error instanceof Error ? error.message : 'Could not save your feedback. Please try again.';
                status.dataset.state = 'error';
                status.focus();
            }
        } finally {
            form.removeAttribute('aria-busy');
            if (button) button.disabled = false;
            if (buttonLabel) buttonLabel.textContent = initialButtonLabel;
        }
    });
}

initializeFeedbackPage();
document.addEventListener('astro:page-load', initializeFeedbackPage);
