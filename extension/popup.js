// Chrome Extension Popup Script (Manifest V3)

document.addEventListener('DOMContentLoaded', async () => {
    const pageTitleEl = document.getElementById('page-title');
    const pageUrlEl = document.getElementById('page-url');
    const saveBtn = document.getElementById('save-btn');
    const statusMsg = document.getElementById('status-msg');
    const resultBox = document.getElementById('result-box');
    const resultCat = document.getElementById('result-category');
    const resultDeadline = document.getElementById('result-deadline');
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

    // 2. Query active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
        pageTitleEl.textContent = 'Cannot capture this tab';
        pageUrlEl.textContent = 'Restricted page or chrome:// URL';
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
        settingsMsg.textContent = 'Settings saved ✓';
        settingsMsg.style.color = '#15130f';
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
                        // Extract visible text without scripts or hidden elements
                        const clone = document.body.cloneNode(true);
                        const badElements = clone.querySelectorAll('script, style, noscript, svg, nav, footer, header, .cookie-banner');
                        badElements.forEach(el => el.remove());
                        return clone.innerText || '';
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
                    throw new Error('Unauthorized: Click ⚙️ to set your API passphrase');
                }
                throw new Error(data.error || `Server error (HTTP ${response.status})`);
            }

            // Success: Display strictly Saved ✓, Category, Deadline
            const opp = data.opportunity;
            resultCat.textContent = opp.category ? opp.category.replace('_', ' ') : 'Other';

            let deadlineDisplay = 'Deadline Unknown';
            if (opp.deadline_confidence === 'rolling') {
                deadlineDisplay = 'Rolling';
            } else if (opp.deadline_at) {
                const diffDays = Math.ceil((new Date(opp.deadline_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (diffDays <= 0) deadlineDisplay = 'Today / Expired';
                else if (diffDays === 1) deadlineDisplay = 'Tomorrow';
                else deadlineDisplay = `Closes in ${diffDays} days (${new Date(opp.deadline_at).toLocaleDateString()})`;
            } else if (opp.deadline_raw) {
                deadlineDisplay = opp.deadline_raw;
            }

            resultDeadline.textContent = deadlineDisplay;
            resultBox.classList.remove('hidden');

            saveBtn.textContent = 'Saved ✓';
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
