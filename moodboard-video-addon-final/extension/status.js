/* Read-only progress panel. Tokens are only used to query the paired local converter. */
const LOCAL = 'http://127.0.0.1:39761';
const STEPS = ['Download','Convert','Upload','Save'];
const $ = id => document.getElementById(id);
const now = () => Date.now();
const STAGE = {queued: 0, downloading: 0, converting: 1, done: 2, uploading: 2, saving: 3, saved: 4, failed: 0};

function elapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s elapsed` : `${Math.floor(s/60)}m ${s%60}s elapsed`;
}
function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function safePinUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && /^([a-z0-9-]+\.)?pinterest\.(com|co\.uk|co\.in|ca)$/i.test(url.hostname) && /^\/pin\/\d+\/$/.test(url.pathname)) return url.href;
  } catch { /* no link */ }
  return '';
}
function labelFor(state) {
  const labels = {queued:'Queued', downloading:'Downloading',converting:'Converting',done:'GIF ready',uploading:'Uploading',saving:'Saving',saved:'Saved',failed:'Failed'};
  return labels[state] || 'In progress';
}
function buildCard(job) {
  const card = el('section','job');
  const top = el('div','job-top');
  const name = el('span','pin',job.title || `Pinterest Pin ${job.pinId || ''}`);
  name.title = name.textContent;
  const pill = el('span', `state ${job.status === 'failed' ? 'failed' : job.status === 'saved' ? 'saved' : ''}`,labelFor(job.status));
  top.append(name,pill);card.append(top);
  const stage = STAGE[job.status] ?? 0;
  const track = el('div','track');
  const failed = job.status === 'failed';
  for (let i=0;i<4;i++) {
    const seg = el('div','segment');
    if (job.status === 'saved' || i<stage) seg.classList.add('done');
    else if (failed && i === stage) seg.classList.add('error');
    else if (!failed && i===stage) seg.classList.add('current');
    track.append(seg);
  }
  card.append(track);
  const labels = el('div','step-labels');
  for (let i=0;i<4;i++) labels.append(el('span',i===stage?'active':'',STEPS[i]));
  card.append(labels);
  let message = job.error || job.message || 'Waiting for an update';
  if (job.retryError && job.status !== 'failed' && job.status !== 'saved') message = `${message} — ${job.retryError}`;
  card.append(el('p','job-info',message));
  if (job.status==='converting' && job.attempt) {
    const p=job.preset || {};
    card.append(el('p','details',`Preset ${job.attempt}/${job.totalAttempts || 11} · ${p.maxWidth || '?'}px · ${p.fps || '?'} fps · ${p.colors || '?'} colours`));
  }
  if (job.status==='saved' && job.sizeBytes) card.append(el('p','details',`GIF: ${(job.sizeBytes/1000000).toFixed(1)} MB · infinite loop`));
  const meta=el('div','meta');meta.append(el('span','',elapsed(now()-(job.createdAt || now()))));meta.append(el('span','',job.status==='saved' ? 'Cloudflare variants pending' : job.status==='failed' ? 'Needs attention' : 'Runs in background'));card.append(meta);
  const url=safePinUrl(job.sourceUrl);
  if (url) {const actions=el('div','job-actions');const link=el('a','', 'Open original Pin');link.href=url;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);card.append(actions);}
  return card;
}
async function refresh() {
  // A fresh poll starts the upload promptly when GIF conversion is finished.
  chrome.runtime.sendMessage({type:'MOODBOARD_VIDEO_CHECK_JOBS'}).catch(()=>{});
  const {pendingJobs = {}, videoJobActivity = {}, localKey = ''} = await chrome.storage.local.get(['pendingJobs','videoJobActivity','localKey']);
  let jobs = Object.values(videoJobActivity);
  for (const pending of Object.values(pendingJobs)) {
    if (!jobs.some(j=>j.id===pending.id)) jobs.push({...pending,status:'queued',message:'Waiting for Mac converter'});
  }
  if (localKey) {
    const live = await Promise.all(Object.values(pendingJobs).map(async pending => {
      try {
        const r=await fetch(`${LOCAL}/jobs/${encodeURIComponent(pending.id)}`,{cache:'no-store',headers:{'X-Moodboard-Local-Key':localKey}});
        if (!r.ok) return null;
        const data=await r.json();
        return {id:pending.id,data};
      } catch {return null;}
    }));
    for (const value of live) {
      if (!value) continue;
      const current=jobs.find(j=>j.id===value.id);
      if (!current || ['uploading','saving','saved','failed'].includes(current.status)) continue;
      const data=value.data;
      // 'done' is only ready to upload; do not claim it has reached R2.
      Object.assign(current,{status:data.status,message:data.message,attempt:data.attempt,totalAttempts:data.totalAttempts,preset:data.preset,title:data.title || current.title});
    }
  }
  jobs.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const active=Object.keys(pendingJobs).length;
  $('hint').textContent=jobs.length?`${active} active · ${jobs.length} recent job${jobs.length===1?'':'s'}`:'No jobs yet. Right-click a video Pin to start a conversion.';
  const root=$('jobs');root.replaceChildren();
  if (!jobs.length) {const e=el('div','empty');e.append(el('strong','','No video captures yet'),el('p','','Open Pinterest, right-click a video, and choose Send video under pointer to Moodboard.'));root.append(e);}
  else for (const job of jobs.slice(0,12)) root.append(buildCard(job));
  $('checked').textContent='Just updated';
}
$('settings').addEventListener('click',()=>chrome.runtime.openOptionsPage());
$('refresh').addEventListener('click',()=>{void refresh();});
void refresh();
setInterval(()=>void refresh(),3000);
