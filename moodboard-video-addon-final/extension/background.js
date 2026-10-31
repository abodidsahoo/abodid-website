const MENU_ID = 'send-video-under-pointer-to-moodboard';
const LOCAL = 'http://127.0.0.1:39761';
const API = 'https://abodid.com/api/integrations/moodboard';
const ALARM = 'moodboard-video-jobs';
const MAX_GIF_BYTES = 19_000_000; // strictly under 20 decimal MB

function menu() {
  chrome.contextMenus.removeAll(() => chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Send video under pointer to Moodboard',
    contexts: ['all'],
    documentUrlPatterns: [
      '*://*.pinterest.com/*', '*://*.pinterest.co.uk/*',
      '*://*.pinterest.ca/*', '*://*.pinterest.co.in/*'
    ]
  }));
}
chrome.runtime.onInstalled.addListener(details => {
  menu();
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(menu);

function notify(message, error = false) {
  chrome.notifications.create({type: 'basic', iconUrl: 'icon-128.png',
    title: error ? 'Video to Moodboard: action needed' : 'Video to Moodboard', message});
}

async function settings() {
  const { localKey, moodboardToken } = await chrome.storage.local.get(['localKey', 'moodboardToken']);
  if (!localKey || !moodboardToken) {
    await chrome.runtime.openOptionsPage();
    throw new Error('Configure your local bridge key and existing Moodboard token in this extension’s settings.');
  }
  return {localKey, moodboardToken};
}

async function localRequest(path, key, options = {}) {
  let response;
  try {
    response = await fetch(`${LOCAL}${path}`, {
      ...options, headers: {...(options.headers || {}), 'X-Moodboard-Local-Key': key}, cache: 'no-store'
    });
  } catch {
    throw new Error('Mac video bridge not running. Install/start it using the provided install-mac.sh.');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `Local converter error: ${response.status}`);
  }
  return response;
}

async function resolvePin(tab, info) {
  if (!tab?.id) throw new Error('No browser tab selected.');
  const pin = await new Promise(resolve => {
    chrome.tabs.sendMessage(tab.id, {type: 'MOODBOARD_RESOLVE_PIN'}, {frameId: info.frameId ?? 0}, result => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(result?.pin || null);
    });
  });
  if (!pin?.pinId) {
    throw new Error('Could not identify the exact video under your pointer. Open its individual Pinterest Pin page, then right-click the video.');
  }
  return pin;
}

async function addPending(job) {
  const { pendingJobs = {} } = await chrome.storage.local.get('pendingJobs');
  pendingJobs[job.id] = job;
  await chrome.storage.local.set({pendingJobs});
  await chrome.alarms.create(ALARM, {periodInMinutes: 0.5});
}
async function removePending(id) {
  const {pendingJobs = {}} = await chrome.storage.local.get('pendingJobs');
  delete pendingJobs[id];
  await chrome.storage.local.set({pendingJobs});
  if (!Object.keys(pendingJobs).length) await chrome.alarms.clear(ALARM);
}

async function apiJson(endpoint, token, body) {
  const response = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Moodboard API error: ${response.status}`);
  return data;
}

function safeFileName(value, pinId) {
  const clean = String(value || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ').trim().slice(0, 190);
  return clean.toLowerCase().endsWith('.gif') ? clean : `Pinterest video - ${pinId}.gif`;
}

async function uploadGif(job, state, localKey, moodboardToken) {
  const response = await localRequest(`/jobs/${encodeURIComponent(job.id)}/file`, localKey);
  const gif = await response.blob();
  if (gif.size <= 0 || gif.size > MAX_GIF_BYTES) throw new Error('Converted GIF is empty or exceeds 20 MB.');
  const headerType = (response.headers.get('Content-Type') || '').split(';')[0];
  if (headerType !== 'image/gif') throw new Error('Local converter did not return a GIF.');
  const filename = safeFileName(state.filename, job.pinId);
  const title = String(state.title || `Pinterest video ${job.pinId}`).trim().slice(0, 200);
  // The source page is supplied from the exact Pin under the pointer, not from
  // Pinterest's CDN and not from the webpage's global metadata.
  const pinLink = job.sourceUrl;
  const prepared = await apiJson('prepare', moodboardToken, {
    filename, contentType: 'image/gif', size: gif.size
  });
  const uploaded = await fetch(prepared.uploadUrl, {
    method: 'PUT', headers: prepared.requiredHeaders, body: gif
  });
  if (!uploaded.ok) throw new Error(`R2 upload failed: HTTP ${uploaded.status}`);
  // Deliberately uses the unchanged image endpoint, so Cloudflare receives a normal GIF original.
  await apiJson('complete', moodboardToken, {
    objectKey: prepared.objectKey, originalFilename: filename,
    expectedSize: gif.size, sourceUrl: pinLink,
    title, artistName: ''
  });
  const {savedPins = {}} = await chrome.storage.local.get('savedPins');
  savedPins[job.pinId] = Date.now();
  await chrome.storage.local.set({savedPins});
  await removePending(job.id);
  // Cleanup is best-effort once the live Moodboard API has confirmed success.
  await localRequest(`/jobs/${encodeURIComponent(job.id)}/finish`, localKey, {method: 'POST'}).catch(console.warn);
  notify('Full-length GIF saved to Moodboard. Animated WebP variants will be generated automatically.');
}

let busy = false;
async function checkPending() {
  if (busy) return;
  busy = true;
  try {
    const {pendingJobs = {}} = await chrome.storage.local.get('pendingJobs');
    const jobs = Object.values(pendingJobs);
    if (!jobs.length) { await chrome.alarms.clear(ALARM); return; }
    const {localKey, moodboardToken} = await settings();
    for (const job of jobs) {
      if (Date.now() - job.createdAt > 3 * 60 * 60 * 1000) {
        await removePending(job.id);
        notify(`Video ${job.pinId} timed out. Check the Mac video bridge logs.`, true);
        continue;
      }
      try {
        const state = await (await localRequest(`/jobs/${encodeURIComponent(job.id)}`, localKey)).json();
        if (state.status === 'failed') {
          await removePending(job.id);
          notify(state.error || 'Video conversion failed.', true);
          continue;
        }
        if (state.status === 'done') await uploadGif(job, state, localKey, moodboardToken);
      } catch (error) {
        // A temporary offline bridge or failed upload should retry on the next alarm.
        console.warn('[moodboard video]', job.id, error);
      }
    }
  } finally {busy = false;}
}
chrome.alarms.onAlarm.addListener(a => {if (a.name === ALARM) void checkPending();});
chrome.runtime.onStartup.addListener(() => void checkPending());
chrome.runtime.onInstalled.addListener(() => void checkPending());

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  (async () => {
    const {localKey} = await settings();
    const pin = await resolvePin(tab, info);
    const {savedPins = {}} = await chrome.storage.local.get('savedPins');
    if (savedPins[pin.pinId]) {
      notify('This Pinterest video is already in your Moodboard.');
      return;
    }
    const response = await localRequest('/jobs', localKey, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sourceUrl: pin.sourceUrl})
    });
    const {jobId} = await response.json();
    await addPending({id: jobId, pinId: pin.pinId, sourceUrl: pin.sourceUrl, createdAt: Date.now()});
    notify(`Saving Pinterest video ${pin.pinId}. GIF conversion runs automatically on your Mac.`);
    void checkPending();
  })().catch(e => notify(e?.message || 'Could not start video capture.', true));
});
