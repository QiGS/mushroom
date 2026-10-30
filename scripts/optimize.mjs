import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { stat, writeFile, readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('主角_3d.glb');
const before = doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((v,p)=>v+p.getIndices().getCount()/3,0),0);
await doc.transform(dedup(), weld(), simplify({simplifier:MeshoptSimplifier,ratio:0.035,error:0.005}), prune());
await mkdir('work/textures',{recursive:true});
let i=0;
for(const tex of doc.getRoot().listTextures()){
  const source=`work/textures/${i}.source`,target=`work/textures/${i}.jpg`;
  await writeFile(source,tex.getImage());
  execFileSync('python',['scripts/texture.py',source,target]);
  tex.setImage(await readFile(target)).setMimeType('image/jpeg');i++;
}
await io.write('public/assets/traveler.glb',doc);
const after = doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((v,p)=>v+p.getIndices().getCount()/3,0),0);
const report={sourceTriangles:before,optimizedTriangles:after,bytes:(await stat('public/assets/traveler.glb')).size,source:'User-provided 主角_3d.glb',animation:'Static mesh, procedural movement'};
await writeFile('public/assets/model-info.json',JSON.stringify(report,null,2));
console.log(report);
