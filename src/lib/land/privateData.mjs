import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createSupabaseServiceClient } from '../supabaseServer.ts';
import { decryptLandAsset } from './crypto.mjs';
import { buildLandBundle } from './dataLogic.mjs';

const secureRoot = resolve(process.cwd(), 'src/data/land/secure');
let baseCache;

const getSecret = () => import.meta.env?.LAND_DATA_ENCRYPTION_KEY || process.env.LAND_DATA_ENCRYPTION_KEY;

const readEncrypted = async (relativePath) => {
  const secret = getSecret();
  if (!secret) throw new Error('LAND_DATA_ENCRYPTION_KEY is not configured.');
  const target = resolve(secureRoot, relativePath);
  if (!target.startsWith(`${secureRoot}${sep}`)) throw new Error('Invalid land asset path.');
  const envelope = await readFile(target, 'utf8');
  return decryptLandAsset(envelope, secret);
};

const loadBase = async () => {
  if (!baseCache) {
    baseCache = Promise.all([
      readEncrypted('khatas.json.enc').then((buffer) => JSON.parse(buffer.toString('utf8'))),
      readEncrypted('documents.json.enc').then((buffer) => JSON.parse(buffer.toString('utf8'))),
      readEncrypted('people.json.enc').then((buffer) => JSON.parse(buffer.toString('utf8'))),
    ]).then(([khatas, documents, people]) => ({ khatas, documents, people }));
  }
  return baseCache;
};

const loadRevisions = async () => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('family_land_revisions')
    .select('id, change_type, business_key, patch, before_snapshot, reason, source_reference, created_by, created_at')
    .order('created_at', { ascending: true });
  if (error) {
    // The encrypted base register remains usable if Supabase is temporarily
    // unavailable or the append-only revisions migration is not installed yet.
    return [];
  }
  return data || [];
};

export const loadLandBundle = async () => {
  const [base, revisions] = await Promise.all([loadBase(), loadRevisions()]);
  return buildLandBundle({ ...base, revisions });
};

export const loadLandPdf = async (slug) => {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid document identifier.');
  return readEncrypted(`pdfs/${slug}.pdf.enc`);
};

export const loadLandMarkdown = async (slug) => {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid document identifier.');
  return readEncrypted(`markdown/${slug}.md.enc`);
};

