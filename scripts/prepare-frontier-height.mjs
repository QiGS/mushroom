import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Vector3,Matrix4,Box3} from 'three';
import {writeFile} from 'node:fs/promises';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS), fields=[];
for(const spec of [
  {id:'canyon-one',x:32,z:-71,width:36,depth:36,height:18,base:-0.5},
  {id:'canyon-two',x:-25,z:-70,width:46,depth:38,height:19,base:-0.8},
]) {
  const doc=await io.read(`public/assets/props/${spec.id}.glb`), tris=[],bounds=new Box3();
  for(const node of doc.getRoot().listNodes()) {
    const matrix=new Matrix4().fromArray(node.getWorldMatrix());
    for(const prim of node.getMesh()?.listPrimitives()||[]) {
      const attr=prim.getAttribute('POSITION'), pts=[];
      for(let i=0;i<attr.getCount();i++) {
        const a=new Vector3().fromArray(attr.getElement(i,[])).applyMatrix4(matrix);
        pts.push(a);bounds.expandByPoint(a);
      }
      const idx=prim.getIndices()?.getArray()||Array.from({length:pts.length},(_,i)=>i);
      for(let i=0;i<idx.length;i+=3)tris.push([pts[idx[i]],pts[idx[i+1]],pts[idx[i+2]]]);
    }
  }
  const size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3()), n=96;
  const data=new Array((n+1)*(n+1)).fill(null);
  for(const tri of tris) {
    const p=tri.map(v=>({x:((v.x-center.x)/size.x+.5)*n,z:((v.z-center.z)/size.z+.5)*n,y:(v.y-bounds.min.y)/size.y*spec.height+spec.base}));
    const [a,b,c]=p, den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
    if(Math.abs(den)<1e-8)continue;
    for(let z=Math.max(0,Math.ceil(Math.min(a.z,b.z,c.z)));z<=Math.min(n,Math.floor(Math.max(a.z,b.z,c.z)));z++)
      for(let x=Math.max(0,Math.ceil(Math.min(a.x,b.x,c.x)));x<=Math.min(n,Math.floor(Math.max(a.x,b.x,c.x)));x++) {
        const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den,w=1-u-v;
        if(u < -.00001 || v < -.00001 || w < -.00001)continue;
        const y=Number((u*a.y+v*b.y+w*c.y).toFixed(3)), k=z*(n+1)+x;
        data[k]=Math.max(data[k]??-999,y);
      }
  }
  fields.push({...spec,n,data});
}
await writeFile('src/frontier-height.js','// Generated from the optimized canyon meshes.\nexport const CANYONS = '+JSON.stringify(fields)+';\n');
console.log('Baked two 96 × 96 walkable canyon heightfields.');
