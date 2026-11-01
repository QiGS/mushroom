import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createTravelerRig, TravelerMotion } from '../src/character-motion.js';
import { GUN_GRIPS, poseHeldGun, gripError } from '../src/weapon-pose.js';
const rest={speed:0,grounded:true,vertical:0,turn:0,attack:0,collect:0,dodge:0,time:0};
function actor() {
  const source=new T.Group(); source.add(new T.Mesh(new T.BoxGeometry(.7,1.9,.4),new T.MeshBasicMaterial()));
  const rig=createTravelerRig(source),root=new T.Group(),holder=new T.Group();root.add(rig.root,holder);
  root.position.set(23,4,-8); root.rotation.y=1.3;
  return {root,rig,holder,motion:new TravelerMotion(rig)};
}
test('authored gun models are calibrated without skew and barrels face forward',()=>{
 for(const [id,p] of Object.entries(GUN_GRIPS)) {
  assert.ok(new T.Vector3(...p.raw.grip).applyMatrix4(p.matrix).length()<1e-7);
  const axis=new T.Vector3(...p.raw.muzzle).sub(new T.Vector3(...p.raw.breech)).transformDirection(p.matrix);
  assert.ok(axis.distanceTo(new T.Vector3(0,0,1))<1e-7,id);
  const scale=new T.Vector3().setFromMatrixScale(p.matrix);
  assert.ok(Math.abs(scale.x-scale.y)<1e-7 && Math.abs(scale.y-scale.z)<1e-7);
  assert.ok(p.muzzle.z>.6 && p.muzzle.z<.9);
 }
});
test('both hands stay on weapon grips through walking, aiming, recoil, reloading and dodge',()=>{
 for(const weapon of Object.keys(GUN_GRIPS)) for(const pitch of [-1.2,-.6,0,.5,1.05]) for(const action of [ {},{speed:3.6},{speed:6.5},{scoped:true},{attack:.22},{reload:1,reloadDuration:2},{dodge:.21},{hurt:.16} ]) {
  const {root,rig,holder,motion}=actor();
  for(let i=0;i<30;i++) {
   motion.update(1/60,{...rest,...action,attack:0,time:i/60});
   poseHeldGun(root,rig.bones,holder,weapon,pitch,action);
   assert.ok(gripError(rig.bones,holder,weapon)<.025,`${weapon} pitch ${pitch} ${JSON.stringify(action)} error ${gripError(rig.bones,holder,weapon)}`);
   for(const side of ['left','right']) {
    const a=rig.bones[side+'Arm'].getWorldPosition(new T.Vector3()),b=rig.bones[side+'Forearm'].getWorldPosition(new T.Vector3()),c=rig.bones[side+'Hand'].getWorldPosition(new T.Vector3());
    assert.ok(Math.abs(a.distanceTo(b)-rig.bones[side+'Forearm'].position.length())<1e-6);
    assert.ok(Math.abs(b.distanceTo(c)-rig.bones[side+'Hand'].position.length())<1e-6);
   }
  }
 }
});
test('switching from a firearm restores the normal melee skeleton with no leftover wrist twist',()=>{
 const {root,rig,holder,motion}=actor(),clean=actor();
 motion.update(1/60,rest);clean.motion.update(1/60,rest);
 poseHeldGun(root,rig.bones,holder,'cannon',.6,{reload:1,reloadDuration:2});
 motion.update(1/60,{...rest,attack:.14});clean.motion.update(1/60,{...rest,attack:.14});
 for(const side of ['left','right']) for(const bone of ['Arm','Forearm','Hand']) assert.ok(rig.bones[side+bone].quaternion.angleTo(clean.rig.bones[side+bone].quaternion)<1e-6);
});
