#!/usr/bin/env node
/** Builds and audits the Chrome package; never uploads or publishes it. */
import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadEnv } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('npm', ['run', 'extension:build:chrome'], { cwd: root, stdio: 'inherit' });
const dir = path.join(root, 'extension/dist/chrome');
const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json')));
const assert = (ok, message) => { if (!ok) throw Error(message); };
assert(manifest.manifest_version === 3, 'Manifest V3 required');
assert(manifest.minimum_chrome_version === '120', 'Review the Chrome minimum version and alarm compatibility');
assert(manifest.name === 'Opportunity Tracker', 'Unexpected extension name');
assert(manifest.description.length <= 132, 'Description exceeds store limit');
assert(manifest.background?.service_worker === 'background.js', 'Missing expected service worker');
assert(manifest.action?.default_popup === 'popup.html', 'Missing expected popup');
assert(!manifest.externally_connectable && !manifest.content_scripts, 'Unexpected external access or always-on content script');
const expectedPermissions = ['activeTab','scripting','storage','contextMenus','identity','notifications','alarms'];
assert(JSON.stringify([...manifest.permissions].sort()) === JSON.stringify(expectedPermissions.sort()), 'Review changed permissions');
const env = { ...loadEnv('production', root, ''), ...process.env };
assert(!env.OPPORTUNITIES_APP_ORIGIN || new URL(env.OPPORTUNITIES_APP_ORIGIN).origin === 'https://abodid.com', 'Release app origin must be https://abodid.com');
assert(new URL(env.PUBLIC_SUPABASE_URL).protocol === 'https:', 'Authentication must use HTTPS');
assert(!env.PUBLIC_SUPABASE_ANON_KEY?.startsWith('sb_secret_'), 'A privileged Supabase key cannot be packaged');
if (env.PUBLIC_SUPABASE_ANON_KEY?.split('.').length === 3) {
    const payload = JSON.parse(Buffer.from(env.PUBLIC_SUPABASE_ANON_KEY.split('.')[1], 'base64url').toString());
    assert(payload.role === 'anon', 'Only the public anon Supabase JWT may be packaged');
}
const hosts = ['https://abodid.com/*', `${new URL(env.PUBLIC_SUPABASE_URL).origin}/*`].sort();
assert(JSON.stringify([...manifest.host_permissions].sort()) === JSON.stringify(hosts), 'Unexpected host permissions; do not ship development endpoints');
const secrets = Object.entries(env).filter(([key,value]) => /KEY|TOKEN|SECRET|PASSWORD|PASSCODE/.test(key) && !key.startsWith('PUBLIC_') && typeof value === 'string' && value.length >= 8).map(([,value]) => value);
const entries = [];
async function inspect(folder, relative = '') {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
        const name = path.posix.join(relative, entry.name);
        assert(!entry.isSymbolicLink(), `Symlink not allowed: ${name}`);
        if (entry.isDirectory()) { await inspect(path.join(folder,entry.name),name); continue; }
        assert(/^(manifest\.json|popup\.html|background\.js|popup\.js|assets\/[\w.-]+\.(js|css)|icons\/icon-(16|48|128)\.png)$/.test(name), `Unexpected package file: ${name}`);
        const bytes = await readFile(path.join(folder,entry.name));
        assert(!secrets.some((value)=>bytes.includes(Buffer.from(value))), 'Privileged credential found; package aborted');
        if (/\.(html|js|css|json)$/.test(name)) {
            const text = bytes.toString();
            // Supabase's bundled SDK contains an unused localhost default.
            // Validate the injected configuration/hosts above, not library literals.
            if (!name.endsWith('.js')) assert(!/localhost|127\.0\.0\.1/.test(text), `Development endpoint found: ${name}`);
            if (name.endsWith('.html')) assert(!/<script\b[^>]*src=["']https?:|\son\w+=["']/i.test(text), 'Remote scripts/inline handlers found');
        }
        entries.push({ path:name, bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex') });
    }
}
await inspect(dir);
for (const [size,file] of Object.entries(manifest.icons || {})) {
    const png = await readFile(path.join(dir,file));
    assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `Invalid PNG: ${file}`);
    assert(png.readUInt32BE(16) === Number(size) && png.readUInt32BE(20) === Number(size), `Wrong icon dimensions: ${file}`);
}
const releaseDir = path.join(root,'extension/releases');
await mkdir(releaseDir,{recursive:true});
const storeNotes = await readFile(path.join(root, 'CHROMEWEBSTORE.md'), 'utf8');
const listing = storeNotes.match(/```text\n([\s\S]*?)\n```/)?.[1];
assert(listing && listing.length <= 16000, 'Missing or oversized store description');
assert(listing.includes(`Version ${manifest.version}`), 'Store listing version differs from manifest');
await writeFile(path.join(releaseDir, 'store-listing.txt'), listing + '\n');
const zip = path.join(releaseDir,`opportunity-tracker-${manifest.version}-chrome.zip`);
execFileSync('python3',['-c', 'import sys,pathlib,zipfile; root=pathlib.Path(sys.argv[1]); files=sys.argv[3:]; z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [z.write(root/f,f) for f in files]; z.close()',dir,zip,...entries.map(e=>e.path)]);
const bytes = await readFile(zip);
const receipt = {version:manifest.version,source_base_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),created_at:new Date().toISOString(),zip,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),permissions:manifest.permissions,host_permissions:manifest.host_permissions,files:entries,uploaded:false,published:false,submission_ready:false,readiness_source:'CHROMEWEBSTORE.md — current release audit'};
await writeFile(path.join(releaseDir,`opportunity-tracker-${manifest.version}-audit.json`),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
