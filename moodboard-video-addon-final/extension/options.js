const $ = id => document.getElementById(id);
chrome.storage.local.get(['localKey', 'moodboardToken']).then(saved => {
  $('localKey').value = saved.localKey || '';
  $('moodboardToken').value = saved.moodboardToken || '';
});
$('save').onclick = async () => {
  const localKey = $('localKey').value.trim();
  const moodboardToken = $('moodboardToken').value.trim();
  if (!localKey || !moodboardToken) { $('status').textContent = 'Both keys are required.'; return; }
  await chrome.storage.local.set({localKey, moodboardToken});
  $('status').textContent = 'Saved. You can now right-click a Pinterest video.';
};
$('test').onclick = async () => {
  const key = $('localKey').value.trim();
  if (!key) { $('status').textContent = 'Enter your Mac bridge key first.'; return; }
  try {
    const res = await fetch('http://127.0.0.1:39761/health', {headers: {'X-Moodboard-Local-Key': key}});
    const data = await res.json();
    $('status').textContent = res.ok && data.ok ? 'Mac converter is running.' : (data.error || 'Could not authenticate.');
  } catch { $('status').textContent = 'Bridge unavailable. Run install-mac.sh and check its logs.'; }
};
