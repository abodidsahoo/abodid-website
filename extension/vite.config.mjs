import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import fs from 'node:fs/promises';

const extensionRoot = path.resolve(process.cwd(), 'extension');
const target = process.env.BROWSER_TARGET || 'chrome';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = env.PUBLIC_SUPABASE_ANON_KEY || '';
  const appOrigin = (env.OPPORTUNITIES_APP_ORIGIN || (mode === 'development' ? 'http://localhost:4321' : 'https://abodid.com')).replace(/\/$/, '');
  const outputDirectory = path.resolve(extensionRoot, 'dist', target);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are required to build the extension.');
  }
  // Every production build is safe, including builds run without the ZIP tool.
  if (mode !== 'development') {
    const authUrl = new URL(supabaseUrl);
    if (appOrigin.replace(/\/$/, '') !== 'https://abodid.com'
      || authUrl.protocol !== 'https:' || !authUrl.hostname.endsWith('.supabase.co')
      || authUrl.username || authUrl.password || authUrl.pathname !== '/'
      || authUrl.search || authUrl.hash) {
      throw new Error('Production requires abodid.com and an HTTPS Supabase project.');
    }
  }
  let publicKey = supabaseAnonKey.startsWith('sb_publishable_');
  if (supabaseAnonKey.split('.').length === 3) {
    try {
      publicKey = JSON.parse(Buffer.from(supabaseAnonKey.split('.')[1], 'base64url').toString()).role === 'anon';
    } catch { publicKey = false; }
  }
  if (!publicKey) throw new Error('Only a public Supabase publishable/anon key may enter the extension build.');

  return {
    root: extensionRoot,
    publicDir: false,
    define: {
      __SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey),
      __APP_ORIGIN__: JSON.stringify(appOrigin),
      __BROWSER_TARGET__: JSON.stringify(target),
    },
    build: {
      outDir: outputDirectory,
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          popup: path.resolve(extensionRoot, 'popup.html'),
          background: path.resolve(extensionRoot, 'src/background.ts'),
          ...(target === 'safari'
            ? { 'safari-callback': path.resolve(extensionRoot, 'src/safari-callback.ts') }
            : {}),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    plugins: [{
      name: 'opportunities-extension-manifest',
      async closeBundle() {
        const manifest = JSON.parse(await fs.readFile(path.resolve(extensionRoot, 'manifests', `${target}.json`), 'utf8'));
        const supabaseOrigin = new URL(supabaseUrl).origin;
        const appOriginPattern = `${appOrigin.replace(/\/$/, '')}/*`;
        manifest.host_permissions = Array.from(new Set([
          ...(manifest.host_permissions || []),
          `${supabaseOrigin}/*`,
          ...(target === 'safari' ? [] : [appOriginPattern]),
        ]));
        if (target === 'chrome') {
          manifest.content_security_policy = {
            extension_pages: `script-src 'self'; object-src 'self'; connect-src ${new URL(appOrigin).origin} ${supabaseOrigin}; base-uri 'none'; frame-ancestors 'none'`,
          };
        }
        if (target === 'safari') {
          manifest.optional_host_permissions = Array.from(new Set([
            ...(manifest.optional_host_permissions || []),
            appOriginPattern,
          ]));
        }
        await fs.writeFile(path.resolve(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
        await fs.cp(path.resolve(extensionRoot, 'icons'), path.resolve(outputDirectory, 'icons'), { recursive: true });
      },
    }],
  };
});
