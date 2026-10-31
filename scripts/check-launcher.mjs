// Exercise the real launcher without opening a browser or leaving a server behind.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const project = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('..', import.meta.url));
const mac = process.platform === 'darwin';
const bundledNode = path.join(project, 'runtime', 'node.exe');
const executable = process.platform === 'win32' && existsSync(bundledNode) ? bundledNode : process.execPath;
const child = spawn(mac ? '/bin/bash' : executable,
  mac ? ['启动游戏.command'] : ['scripts/serve-game.cjs'], {
    cwd: project, env: { ...process.env, MUSHROOM_NO_OPEN: '1', MUSHROOM_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
let log = '';
let startupError;
let exited = false;
child.stdout.on('data', chunk => { log += chunk; });
child.stderr.on('data', chunk => { log += chunk; });
child.on('error', error => { startupError = error; });
child.on('exit', () => { exited = true; });
const done = new Promise(resolve => child.on('close', resolve));
try {
  const deadline = Date.now() + 120_000;
  let url;
  while (!(url = log.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0])) {
    if (startupError) throw startupError;
    if (exited || Date.now() > deadline) throw new Error(`Launcher did not start:\n${log}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const options = { signal: AbortSignal.timeout(5000) };
  const health = await fetch(`${url}__mushroom_health`, options);
  assert.equal((await health.json()).app, 'mushroom-local-game');
  const page = await fetch(url, options);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<html/);
  const model = await fetch(`${url}assets/traveler.glb`, { ...options, method: 'HEAD' });
  assert.equal(model.status, 200);
  assert.equal(model.headers.get('content-type'), 'model/gltf-binary');
  assert.ok(Number(model.headers.get('content-length')) > 2_000_000);
  const manifest = await (await fetch(`${url}assets/collection/manifest.json`, options)).json();
  assert.equal(manifest.length, 13);
  await Promise.all(manifest.flatMap(item => ['glb', 'webp'].map(async ext => {
    const asset = await fetch(`${url}assets/collection/${item.id}.${ext}`, { ...options, method: 'HEAD' });
    assert.equal(asset.status, 200, `${item.id}.${ext}`);
    assert.equal(asset.headers.get('content-type'), ext === 'glb' ? 'model/gltf-binary' : 'image/webp');
    assert.ok(Number(asset.headers.get('content-length')) > 1000);
  })));
  assert.equal((await fetch(`${url}missing-file`, options)).status, 404);
  assert.equal((await fetch(url, { ...options, method: 'POST' })).status, 405);
  assert.equal((await fetch(`${url}%2e%2e%2fpackage.json`, options)).status, 400);
  console.log(`Launcher passed on ${process.platform}/${process.arch}: page, traveler, 26 collection assets, HTTP boundaries.`);
} finally {
  if (!exited) child.kill('SIGTERM');
  await done;
}
