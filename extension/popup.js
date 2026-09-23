// Chrome Extension Popup Script (Manifest V3)

document.addEventListener('DOMContentLoaded', async () => {
    const pageTitleEl = document.getElementById('page-title');
    const pageUrlEl = document.getElementById('page-url');
    const saveBtn = document.getElementById('save-btn');
    const statusMsg = document.getElementById('status-msg');
    const resultBox = document.getElementById('result-box');
    const resultCat = document.getElementById('result-category');
    const resultDeadline = document.getElementById('result-deadline');
    const viewDashboardLink = document.getElementById('view-dashboard-link');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPane = document.getElementById('settings-pane');
    const mainPane = document.getElementById('main-pane');
    const apiUrlInput = document.getElementById('api-url');
    const apiKeyInput = document.getElementById('api-key');
    const saveSettingsBtn = document.getElementById('save-settings');
    const settingsMsg = document.getElementById('settings-msg');

    // 1. Load saved settings from chrome.storage.local
    const { apiUrl = 'https://abodid.com', apiKey = '' } = await chrome.storage.local.get(['apiUrl', 'apiKey']);
    apiUrlInput.value = apiUrl;
    apiKeyInput.value = apiKey;

    if (viewDashboardLink) {
        viewDashboardLink.href = `${apiUrl.replace(/\/$/, '')}/opportunities`;
    }

    // 2. Query active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
        pageTitleEl.textContent = 'Cannot capture this tab';
        pageUrlEl.textContent = 'Restricted page or browser URL';
        saveBtn.disabled = true;
        return;
    }

    pageTitleEl.textContent = tab.title || 'Untitled Page';
    pageUrlEl.textContent = tab.url;

    // Toggle Settings Pane
    settingsToggle.addEventListener('click', () => {
        settingsPane.classList.toggle('hidden');
    });

    // Save Settings
    saveSettingsBtn.addEventListener('click', async () => {
        const newUrl = apiUrlInput.value.trim().replace(/\/$/, '');
        const newKey = apiKeyInput.value.trim();
        await chrome.storage.local.set({ apiUrl: newUrl, apiKey: newKey });
        if (viewDashboardLink) {
            viewDashboardLink.href = `${newUrl}/opportunities`;
        }
        settingsMsg.textContent = 'Settings saved ✓';
        settingsMsg.style.color = '#047857';
        setTimeout(() => {
            settingsMsg.textContent = '';
            settingsPane.classList.add('hidden');
        }, 1200);
    });

    // Save Opportunity Action
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = '⚡ Ingesting & Extracting...';
        statusMsg.classList.add('hidden');
        resultBox.classList.add('hidden');

        try {
            // Safe script injection to extract visible text
            let extractedText = '';
            try {
                const [execResult] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        const clone = document.body.cloneNode(true);
                        const badElements = clone.querySelectorAll('script, style, noscript, svg, nav, footer, header, .cookie-banner');
                        badElements.forEach(el => el.remove());

                        const pageText = clone.innerText || '';
                        const links = Array.from(document.querySelectorAll('a[href]'))
                            .map((link) => {
                                const label = (link.textContent || '').replace(/\s+/g, ' ').trim();
                                if (!label) return null;
                                try {
                                    return `${label}: ${new URL(link.getAttribute('href'), document.baseURI).href}`;
                                } catch {
                                    return null;
                                }
                            })
                            .filter(Boolean)
                            .slice(0, 100);

                        const fragment = decodeURIComponent(window.location.hash.replace(/^#/, ''));
                        let sectionText = '';
                        if (fragment) {
                            const target = document.getElementById(fragment) || document.querySelector(`[name="${CSS.escape(fragment)}"]`);
                            const section = target?.closest('section, article, main') || target?.parentElement;
                            sectionText = section?.innerText || target?.innerText || '';
                        }

                        return [
                            `CURRENT PAGE: ${document.title}`,
                            `CURRENT URL: ${window.location.href}`,
                            fragment ? `CURRENT SECTION: ${fragment}` : '',
                            sectionText ? `CURRENT SECTION CONTENT:\n${sectionText.slice(0, 4000)}` : '',
                            `VISIBLE PAGE CONTENT:\n${pageText}`,
                            links.length ? `LINK TARGETS:\n${links.join('\n')}` : '',
                        ].filter(Boolean).join('\n\n');
                    },
                });
                if (execResult && execResult.result) {
                    extractedText = execResult.result;
                }
            } catch (scriptErr) {
                console.warn('Script injection restricted on this page, server will fetch URL directly:', scriptErr);
            }

            const currentConfig = await chrome.storage.local.get(['apiUrl', 'apiKey']);
            const baseEndpoint = currentConfig.apiUrl || 'https://abodid.com';
            const endpoint = `${baseEndpoint.replace(/\/$/, '')}/api/opportunities/capture`;

            const headers = {
                'Content-Type': 'application/json',
            };
            if (currentConfig.apiKey) {
                headers['Authorization'] = `Bearer ${currentConfig.apiKey}`;
            }

            const payload = {
                url: tab.url,
                title: tab.title || '',
                page_text: extractedText,
                captured_at: new Date().toISOString(),
                capture_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                password: currentConfig.apiKey || undefined,
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized: Click ⚙️ to set your Curator passcode');
                }
                throw new Error(data.error || `Server error (HTTP ${response.status})`);
            }

            // Success: Populate clean result view
            const opp = data.opportunity;
            resultCat.textContent = opp.category ? opp.category.replace('_', ' ') : 'Other';

            let deadlineDisplay = 'Unspecified';
            if (opp.deadline_confidence === 'rolling') {
                deadlineDisplay = '🔄 Rolling Deadline';
            } else if (opp.deadline_at) {
                const deadlineDate = new Date(opp.deadline_at);
                const diffMs = deadlineDate.getTime() - Date.now();
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                const formattedDate = deadlineDate.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                });

                if (diffDays <= 0) {
                    deadlineDisplay = `⚠️ Deadline Passed (${formattedDate})`;
                } else if (diffDays === 1) {
                    deadlineDisplay = `⚡ Tomorrow · 1 day left (${formattedDate})`;
                } else {
                    deadlineDisplay = `⏱️ ${diffDays} days left · ${formattedDate}`;
                }
            } else if (opp.deadline_raw) {
                deadlineDisplay = opp.deadline_raw;
            }

            resultDeadline.textContent = deadlineDisplay;
            resultBox.classList.remove('hidden');

            saveBtn.textContent = data.is_duplicate ? '✓ Already in Radar' : '✓ Saved to Radar';
            saveBtn.disabled = true;

        } catch (err) {
            statusMsg.textContent = err.message || 'Capture failed';
            statusMsg.className = 'status-msg error';
            statusMsg.classList.remove('hidden');
            saveBtn.disabled = false;
            saveBtn.textContent = '⚡ Try Again';
        }
    });
});
