import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'src');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const clean = decodeURIComponent((req.url || '/').split('?')[0]);
  let path = normalize(join(root, clean));
  if (!path.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path) && !extname(path)) path = join(path, 'index.html');
  if (!existsSync(path)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(path).pipe(res);
});

server.listen(4179, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4179'));
