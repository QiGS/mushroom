const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const root = path.join(project, 'dist');
const host = '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
};

function openBrowser(url) {
  if (process.env.MUSHROOM_NO_OPEN === '1') return;
  const child = spawn(process.env.ComSpec || 'cmd.exe',
    ['/d', '/s', '/c', `start "" "${url}"`],
    { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => console.log(`请在浏览器中打开：${url}`));
  child.unref();
}

function ensureBuild() {
  if (fs.existsSync(path.join(root, 'index.html'))) return;
  if (!fs.existsSync(path.join(project, 'package.json'))) {
    throw new Error('找不到游戏文件。请先完整解压压缩包，再启动游戏。');
  }
  console.log('首次从源码启动：正在准备游戏，请保留此窗口。');
  const env = { ...process.env, npm_config_cache: path.join(project, 'work', 'npm-cache') };
  const commands = fs.existsSync(path.join(project, 'node_modules', 'vite'))
    ? ['npm run build'] : ['npm ci', 'npm run build'];
  for (const command of commands) {
    const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command],
      { cwd: project, env, stdio: 'inherit', windowsHide: true });
    if (result.error || result.status !== 0) throw new Error('游戏准备失败，请检查网络并重试。');
  }
}

function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  if (req.url === '/__mushroom_health') {
    res.writeHead(200, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ app: 'mushroom-local-game', version: 1 }));
  }
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
    file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('outside root');
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': path.extname(file) === '.html' ? 'no-store' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

async function existingGame(port) {
  if (!port) return false;
  try {
    const r = await fetch(`http://${host}:${port}/__mushroom_health`, { signal: AbortSignal.timeout(600) });
    return (await r.json()).app === 'mushroom-local-game';
  } catch { return false; }
}

async function main() {
  ensureBuild();
  const start = process.env.MUSHROOM_PORT === undefined ? 5173 : Number(process.env.MUSHROOM_PORT);
  if (!Number.isInteger(start) || start < 0 || start > 65535) throw new Error('无效的端口号。');
  for (let attempt = 0; attempt < 12; attempt++) {
    const port = start === 0 ? 0 : start + attempt;
    if (port > 65535) break;
    const url = `http://${host}:${port}/`;
    if (await existingGame(port)) {
      console.log(`游戏已经运行，正在打开：${url}`);
      openBrowser(url);
      return;
    }
    const server = http.createServer(handler);
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, resolve);
      });
    } catch (error) {
      if (error.code === 'EADDRINUSE') continue;
      throw error;
    }
    const actualUrl = `http://${host}:${server.address().port}/`;
    console.log(`\n菌野 · 美味菌子在哪里\n游戏已启动：${actualUrl}\n请保留此窗口；关闭窗口或按 Ctrl+C 可停止游戏。\n`);
    openBrowser(actualUrl);
    process.once('SIGINT', () => server.close(() => process.exit(0)));
    process.once('SIGTERM', () => server.close(() => process.exit(0)));
    return;
  }
  throw new Error('可用端口被占用，请关闭旧的游戏窗口后重试。');
}

main().catch(error => {
  console.error(`\n启动失败：${error.message}\n`);
  process.exitCode = 1;
});
