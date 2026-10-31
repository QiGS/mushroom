import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, normals } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), report = [];
await mkdir('work/guide-assets', { recursive: true });
await mkdir('public/assets/villagers', { recursive: true });
for (const [id, source] of [
  ['flower-guide', 'npc/采花少女.glb'],
  ['forager-guide', 'npc/采菌大叔 (1).glb'],
  ['herder-guide', 'npc/放牛小孩.glb'],
]) {
  const doc = await io.read(source);
  const count = () => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((s, p) => s + (p.getIndices()?.getCount() || p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  const before = count();
  await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, 18000 / before), error: .012 }), prune());
  let i = 0;
  for (const texture of doc.getRoot().listTextures()) {
    const f = `work/guide-assets/${id}-${i++}`;
    await writeFile(f + '.source', texture.getImage());
    execFileSync('python', ['scripts/texture.py', f + '.source', f + '.jpg', '1024']);
    texture.setImage(await readFile(f + '.jpg')).setMimeType('image/jpeg');
  }
  await doc.transform(normals({ overwrite: false }), weld());
  const output = `public/assets/villagers/${id}.glb`;
  await io.write(output, doc);
  report.push({ id, source, sourceTriangles: before, triangles: count(), bytes: (await stat(output)).size });
  console.log(report.at(-1));
  execFileSync('python', ['scripts/render-collection.py', output, `work/guide-assets/${id}.webp`], { stdio: 'inherit' });
}
await writeFile('public/assets/villagers/guides-manifest.json', JSON.stringify(report, null, 2));
