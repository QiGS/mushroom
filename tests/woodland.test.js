import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {sceneryChunks} from '../src/scenery-instances.js';

test('woodland chunks preserve every placement and keep each draw spatially bounded',()=>{
 const positions=Array.from({length:500},(_,i)=>({x:(i%25)*7-90,z:Math.floor(i/25)*9-85}));
 const chunks=sceneryChunks(positions);
 assert.equal(chunks.flat().length,positions.length);
 assert.equal(new Set(chunks.flat()).size,positions.length);
 for(const chunk of chunks) {
  assert.ok(Math.max(...chunk.map(p=>p.x))-Math.min(...chunk.map(p=>p.x))<24);
  assert.ok(Math.max(...chunk.map(p=>p.z))-Math.min(...chunk.map(p=>p.z))<24);
 }
});
test('new authored trees and bamboo fit the dense-scene geometry and download budgets',async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 const manifest=JSON.parse(await readFile(new URL('../public/assets/props/woodland-manifest.json',import.meta.url),'utf8'));
 for(const asset of manifest) {
  const data=await readFile(new URL('../public/assets/props/'+asset.id+'.glb',import.meta.url));
  assert.ok(data.length<1100000,asset.id);
  const document=await io.readBinary(data);
  const triangles=document.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0);
  assert.equal(triangles,asset.triangles);
  assert.ok(triangles<=5500,asset.id);
  for(const t of document.getRoot().listTextures()) assert.ok(t.getImage().length>0);
 }
});
