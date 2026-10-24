import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import fs from 'node:fs/promises';

const extensionRoot = path.resolve(process.cwd(), 'extension');
const target = process.env.BROWSER_TARGET || 'chrome';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = env.PUBLIC_SUPABASE_ANON_KEY || '';
  const appOrigin = env.OPPORTUNITIES_APP_ORIGIN || (mode === 'development' ? 'http://localhost:4321' : 'https://abodid.com');
  const outputDirectory = path.resolve(extensionRoot, 'dist', target);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are required to build the extension.');
  }

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
