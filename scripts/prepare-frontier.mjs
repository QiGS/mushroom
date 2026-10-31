import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, normals } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), report = [];
await mkdir('work/frontier-assets', { recursive: true });
for (const [id, source, budget] of [
  ['canyon-one', '道具二维/峡谷1.glb', 13000],
  ['canyon-two', '道具二维/峡谷2.glb', 11000],
  ['poison-ant', 'new/毒蚂蚁.glb', 5000],
  ['fallen-log', 'new/枯木.glb', 6500],
  ['rock-two', 'new/岩石2.glb', 3000],
  ['rock-three', 'new/岩石3.glb', 3000],
]) {
  if (process.argv[2] && id !== process.argv[2]) continue;
  const doc = await io.read(source);
  const count = () => doc.getRoot().listMeshes().reduce((n,m) => n + m.listPrimitives().reduce((s,p) => s + (p.getIndices()?.getCount() || p.getAttribute('POSITION').getCount())/3,0),0);
  const before = count();
  await doc.transform(dedup(), weld(), simplify({simplifier:MeshoptSimplifier,ratio:Math.min(1,budget/before),error:0.025}),prune());
  let i=0;
  for (const t of doc.getRoot().listTextures()) {
    const f = `work/frontier-assets/${id}-${i++}`;
    await writeFile(f+'.source',t.getImage());
    execFileSync('python',['scripts/texture.py',f+'.source',f+'.jpg','1024']);
    t.setImage(await readFile(f+'.jpg')).setMimeType('image/jpeg');
  }
  if(doc.getRoot().listMeshes().some(m=>m.listPrimitives().some(p=>!p.getAttribute('NORMAL'))))
    await doc.transform(normals({overwrite:false}),weld());
  const output = `public/assets/props/${id}.glb`;
  await io.write(output,doc);
  const record = {id,source,sourceTriangles:before,triangles:count(),bytes:(await stat(output)).size};
  report.push(record); console.log(record);
  execFileSync('python',['scripts/render-collection.py',output,`work/frontier-assets/${id}.webp`],{stdio:'inherit'});
}
await writeFile('public/assets/props/frontier-manifest.json',JSON.stringify(report,null,2));
execFileSync('python',['scripts/prepare-frontier-art.py'],{stdio:'inherit'});
