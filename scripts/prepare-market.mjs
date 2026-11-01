import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,weld,simplify,prune,normals} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS), report=[];
await mkdir('work/market-assets',{recursive:true});
for(const [id,source,budget] of [
 ['market-fruit','Jingmai_Mountains/回复果.glb',5000],
 ['market-shoes','Jingmai_Mountains/疾风草鞋.glb',5500],
 ['market-bell','Jingmai_Mountains/听风铃.glb',5500],
 ['market-note','图标/菌子便签.glb',5000],
 ['market-basket','图标/背篓.glb',6000],
]){
 const doc=await io.read(source);
 const count=()=>doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0);
 const before=count();
 await doc.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:Math.min(1,budget/before),error:.03}),prune());
 if(count()>budget*1.4){
  const permissive={...MeshoptSimplifier,simplify:(indices,positions,stride,target,error,flags)=>MeshoptSimplifier.simplify(indices,positions,stride,target,error,[...flags,'Permissive'])};
  await doc.transform(simplify({simplifier:permissive,ratio:budget/count(),error:.04}),prune());
 }
 let i=0;
 for(const texture of doc.getRoot().listTextures()){
  const file=`work/market-assets/${id}-${i++}`;await writeFile(file+'.source',texture.getImage());
  execFileSync('python',['scripts/texture.py',file+'.source',file+'.jpg','1024']);
  texture.setImage(await readFile(file+'.jpg')).setMimeType('image/jpeg');
 }
 if(doc.getRoot().listMeshes().some(m=>m.listPrimitives().some(p=>!p.getAttribute('NORMAL'))))await doc.transform(normals({overwrite:false}),weld());
 const output=`public/assets/props/${id}.glb`;await io.write(output,doc);
 const record={id,source,sourceTriangles:before,triangles:count(),bytes:(await stat(output)).size};report.push(record);console.log(record);
 execFileSync('python',['scripts/render-collection.py',output,`work/market-assets/${id}.webp`],{stdio:'inherit'});
}
await writeFile('public/assets/props/market-manifest.json',JSON.stringify(report,null,2)+'\n');
