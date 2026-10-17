import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Mode = 'correct' | 'add' | 'archive';

const correctionFields = {
  plot: [
    ['plot_no', 'Plot number'], ['land_class_od', 'Land class (Odia)'], ['area_acres', 'Area in acres'],
    ['local_name_od', 'Local name (Odia)'], ['boundaries_od', 'Boundary wording'], ['remarks_od', 'Plot remarks'],
  ],
  khata: [
    ['mouza_od', 'Mouza (Odia)'], ['mouza_en', 'Mouza phonetic alias'], ['tehsil_od', 'Tehsil (Odia)'],
    ['district_od', 'District (Odia)'], ['recorded_holders_od', 'Recorded holders (source wording)'],
    ['tenure_od', 'Printed tenure'], ['special_remarks_od', 'Special remarks'],
  ],
} as const;

export default function LandAdminApp() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bundle, setBundle] = useState<any>(null);
  const [mode, setMode] = useState<Mode>('correct');
  const [businessKey, setBusinessKey] = useState('');
  const [scope, setScope] = useState<'plot' | 'khata'>('plot');
  const [field, setField] = useState('land_class_od');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [source, setSource] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [addition, setAddition] = useState({ district_od: '', tehsil_od: '', mouza_od: '', mouza_en: '', khata_no: '', recorded_holders_od: '', tenure_od: '', plot_no: '', land_class_od: '', area_acres: '' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const load = async (activeSession = session) => {
    if (!activeSession?.access_token) return;
    setPending(true); setMessage('');
    const response = await fetch('/api/land/admin/revisions', { headers: { Authorization: `Bearer ${activeSession.access_token}` } });
    const result = await response.json();
    if (!response.ok) setMessage(result.error || 'Could not open the register.');
    else {
      setBundle(result);
      const first = result.khatas?.[0]?.plots?.[0]?.business_key || '';
      setBusinessKey((current) => current || first);
    }
    setPending(false);
  };

  useEffect(() => { if (session) load(session); }, [session]);

  const records = useMemo(() => bundle?.khatas?.flatMap((khata: any) => khata.plots.map((plot: any) => ({ khata, plot }))) || [], [bundle]);
  const selected = records.find((record: any) => record.plot.business_key === businessKey);
  const currentValue = selected ? (scope === 'plot' ? selected.plot[field] : selected.khata[field]) : '';

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); setPending(true); setMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else setSession(data.session);
    setPending(false);
  };

  const save = async () => {
    if (!session?.access_token) return;
    setPending(true); setMessage('');
    let payload: any;
    if (mode === 'correct') {
      payload = { change_type: 'correct', business_key: businessKey, patch: { scope, field, value: field === 'area_acres' ? Number(value) : value }, reason, source_reference: source };
    } else if (mode === 'archive') {
      payload = { change_type: 'archive', business_key: businessKey, patch: {}, reason, source_reference: source };
    } else {
      const khata = {
        khata_no: addition.khata_no, district_od: addition.district_od, tehsil_od: addition.tehsil_od,
        mouza_od: addition.mouza_od, mouza_en: addition.mouza_en, recorded_holders_od: addition.recorded_holders_od,
        tenure_od: addition.tenure_od, issues: [], source_printed_timestamp: '', special_remarks_od: '',
      };
      const plot = {
        plot_no: addition.plot_no, land_class_od: addition.land_class_od, area_acres: Number(addition.area_acres),
        area_sqft: Number(addition.area_acres) * 43560, area_sqm: Number(addition.area_acres) * 4046.8564224,
        area_hectares_calc: Number(addition.area_acres) * 0.40468564224, source_page: 2,
      };
      const key = [addition.district_od, addition.tehsil_od, addition.mouza_od, addition.khata_no, addition.plot_no].join('|');
      payload = { change_type: 'add', business_key: key, patch: { khata, plot }, reason, source_reference: source };
    }
    const response = await fetch('/api/land/admin/revisions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) setMessage(result.error || 'The change could not be saved.');
    else {
      setMessage('Saved. The source remains unchanged and the revision was added to history.');
      setValue(''); setReason(''); setSource(''); setConfirmed(false);
      await load();
    }
    setPending(false);
  };

  if (!session) return <div className="land-admin-shell"><a className="land-back-to-site" href="/land">← Viewer register</a><section className="land-admin-login"><p className="land-kicker">SON-ONLY ADMINISTRATION</p><h1>Land register editor</h1><p>This sign-in is separate from the family viewer password. Only an approved Supabase administrator can save changes.</p><form onSubmit={signIn}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message && <p className="land-form-error" role="alert">{message}</p>}<button className="land-button land-button--primary" disabled={pending}>{pending ? 'Signing in…' : 'Admin sign in'}</button></form></section></div>;

  return <div className="land-admin-shell">
    <header className="land-admin-header"><div><a className="land-back-to-site" href="/land">← Viewer register</a><p className="land-kicker">SON-ONLY ADMINISTRATION</p><h1>Land register editor</h1><p>Every save creates an append-only revision. Original encrypted source files stay unchanged.</p></div><button className="land-button land-button--secondary" onClick={() => supabase.auth.signOut()}>Sign out</button></header>
    {message && <p className={message.startsWith('Saved') ? 'land-form-success' : 'land-form-error'} role="status">{message}</p>}
    {!bundle ? <p>{pending ? 'Loading private records…' : 'No records available.'}</p> : <div className="land-admin-grid">
      <section className="land-admin-editor" aria-labelledby="admin-editor-title"><h2 id="admin-editor-title">Create a reviewed change</h2><div className="land-admin-tabs" role="group" aria-label="Change type">{(['correct', 'add', 'archive'] as Mode[]).map((item) => <button key={item} aria-pressed={mode === item} onClick={() => { setMode(item); setConfirmed(false); }}>{item === 'correct' ? 'Correct record' : item === 'add' ? 'Add record' : 'Archive record'}</button>)}</div>
        {mode !== 'add' && <label>Plot record<select value={businessKey} onChange={(event) => { setBusinessKey(event.target.value); setConfirmed(false); }}>{records.map(({ khata, plot }: any) => <option key={plot.business_key} value={plot.business_key}>Khata {khata.khata_no} · Plot {plot.plot_no} · {khata.mouza_od}</option>)}</select></label>}
        {mode === 'correct' && <><div className="land-two-fields"><label>Record level<select value={scope} onChange={(event) => { const next = event.target.value as 'plot' | 'khata'; setScope(next); setField(correctionFields[next][0][0]); }}><option value="plot">Plot field</option><option value="khata">Khata field</option></select></label><label>Field<select value={field} onChange={(event) => setField(event.target.value)}>{correctionFields[scope].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div><div className="land-before-after"><div><span>Current source/display value</span><pre>{String(currentValue ?? 'Not recorded')}</pre></div><label>Revised value{field === 'area_acres' ? <input type="number" min="0" step="0.0001" value={value} onChange={(event) => setValue(event.target.value)} /> : <textarea rows={5} value={value} onChange={(event) => setValue(event.target.value)} />}</label></div></>}
        {mode === 'add' && <div className="land-add-grid">{Object.entries(addition).map(([key, current]) => <label key={key}>{key.replaceAll('_', ' ')}<input type={key === 'area_acres' ? 'number' : 'text'} step={key === 'area_acres' ? '0.0001' : undefined} value={current} onChange={(event) => setAddition((state) => ({ ...state, [key]: event.target.value }))} /></label>)}</div>}
        {mode === 'archive' && <div className="land-warning-panel"><strong>Archive hides this plot from the viewer.</strong><p>It does not delete the encrypted source or revision history. Use only when a verified source says this row should no longer appear in the family view.</p></div>}
        <label>Reason<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What changed, and why?" /></label><label>Source document and page<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Example: current ROR PDF, page 2, checked 17 Oct 2026" /></label>
        <label className="land-checkbox-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I compared this change with the cited source and reviewed the before/after values.</span></label>
        <div className="land-admin-actions"><button className="land-button land-button--primary" disabled={!confirmed || pending || !reason || !source || (mode === 'correct' && value === '')} onClick={save}>{pending ? 'Saving…' : 'Save revision'}</button><button className="land-button land-button--secondary" onClick={() => { setValue(''); setReason(''); setSource(''); setConfirmed(false); }}>Cancel / clear</button></div>
      </section>
      <aside className="land-history" aria-labelledby="history-title"><h2 id="history-title">Revision history</h2>{bundle.history?.length ? <ol>{[...bundle.history].reverse().map((revision: any) => <li key={revision.id}><strong>{revision.change_type} · {revision.business_key.split('|').slice(-2).join(' / ')}</strong><span>{new Date(revision.created_at).toLocaleString()}</span><p>{revision.reason}</p><small>{revision.source_reference}</small></li>)}</ol> : <p>No revisions saved yet.</p>}</aside>
    </div>}
  </div>;
}

