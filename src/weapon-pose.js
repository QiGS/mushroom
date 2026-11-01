import * as T from 'three';

// Landmarks measured in the supplied GLBs, before any bounding-box centering.
// Their barrels have different modelling angles; preserve the authored shape
// while putting the trigger grip at the origin and the bore along local +Z.
const landmarks = {
  rifle: { grip: [-.095,.24,0], support: [.21,.28,0], muzzle: [.48,.447,-.003], breech: [.08,.362,0], scale: 1.05 },
  sniper: { grip: [-.16,.29,.125], support: [.075,.36,-.075], muzzle: [.478,.56,-.392], breech: [.29,.506,-.237], scale: .916 },
  cannon: { grip: [.20,.16,-.075], support: [-.22,.21,.1], muzzle: [-.46,.53,.13], breech: [.13,.32,-.07], scale: .88 },
};
export const GUN_GRIPS = Object.fromEntries(Object.entries(landmarks).map(([id,p]) => {
  const grip = new T.Vector3(...p.grip), muzzle = new T.Vector3(...p.muzzle);
  const forward = muzzle.clone().sub(new T.Vector3(...p.breech)).normalize();
  const right = new T.Vector3(0,1,0).cross(forward).normalize();
  const up = forward.clone().cross(right).normalize();
  const matrix = new T.Matrix4().makeScale(p.scale,p.scale,p.scale)
    .multiply(new T.Matrix4().makeBasis(right,up,forward).transpose())
    .multiply(new T.Matrix4().makeTranslation(-grip.x,-grip.y,-grip.z));
  return [id, { matrix, support: new T.Vector3(...p.support).applyMatrix4(matrix), muzzle: muzzle.applyMatrix4(matrix), raw: p }];
}));

const zero = new T.Vector3();
const shoulder = new T.Vector3(), axis = new T.Vector3(), pole = new T.Vector3();
const elbow = new T.Vector3(), end = new T.Vector3(), rest = new T.Vector3();
const parentRotation = new T.Quaternion(), worldRotation = new T.Quaternion();
const handRotation = new T.Quaternion(), gripRotation = new T.Quaternion();
const chest = new T.Vector3(), target = new T.Vector3();

// Fixed-length two-bone solve: hands follow the actual model sockets, including
// recoil and reload, without stretching the mesh or inheriting the walking swing.
export function solveArm(upper, lower, hand, targetWorld, poleWorld, palmWorld) {
  upper.getWorldPosition(shoulder);
  axis.copy(targetWorld).sub(shoulder);
  const a = lower.position.length(), b = hand.position.length();
  const distance = T.MathUtils.clamp(axis.length(), .015, a + b - .002);
  axis.normalize();
  end.copy(shoulder).addScaledVector(axis,distance);
  pole.copy(poleWorld).sub(shoulder);
  pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const along = (a*a - b*b + distance*distance) / (2*distance);
  elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
  upper.parent.getWorldQuaternion(parentRotation).invert();
  worldRotation.setFromUnitVectors(rest.copy(lower.position).normalize(), axis.copy(elbow).sub(shoulder).normalize());
  upper.quaternion.copy(parentRotation).multiply(worldRotation);
  upper.updateMatrixWorld(true);
  upper.getWorldQuaternion(parentRotation).invert();
  worldRotation.setFromUnitVectors(rest.copy(hand.position).normalize(), axis.copy(end).sub(elbow).normalize());
  lower.quaternion.copy(parentRotation).multiply(worldRotation);
  lower.updateMatrixWorld(true);
  lower.getWorldQuaternion(parentRotation).invert();
  hand.quaternion.copy(parentRotation).multiply(palmWorld);
  hand.updateMatrixWorld(true);
}

const rightTarget = new T.Vector3(), leftTarget = new T.Vector3(), elbowPole = new T.Vector3();
export function poseHeldGun(root, bones, holder, weapon, pitch = 0, options = {}) {
  const profile = GUN_GRIPS[weapon];
  if (!profile) return;
  if (bones) {
    // The support shoulder comes forward, the trigger shoulder sits behind the
    // stock. Keep the head looking along the sight rather than twisting with it.
    bones.chest.rotation.y = .32;
    bones.head.rotation.y = -.26;
  }
  root.updateMatrixWorld(true);
  if (bones) root.worldToLocal(bones.chest.getWorldPosition(chest));
  else chest.set(0,1.34,0);
  const heavy = weapon === 'cannon', scoped = options.scoped && weapon === 'sniper';
  const recoil = Math.pow(T.MathUtils.clamp((options.attack || 0) / .25,0,1),2);
  const reload = options.reload > 0 ? Math.sin(Math.PI * T.MathUtils.clamp(options.reload / options.reloadDuration,0,1)) : 0;
  holder.position.set(chest.x + (heavy ? .10 : .17), chest.y - (heavy ? .12 : .035) + (scoped ? .035 : 0) + Math.max(0,pitch)*.1,
    chest.z + .13 - recoil*(heavy ? .09 : .045) - reload*.025);
  holder.rotation.set(T.MathUtils.clamp(pitch,-1.2,1.15) - recoil*(heavy ? .10 : .045) + reload*.35, reload*.12, reload*-.18);
  holder.updateMatrixWorld(true);
  if (!bones) return;
  // Pull the weapon into reach at steep aim angles or during a crouch. Moving
  // the shared weapon keeps BOTH hands attached instead of stretching an arm.
  for (let pass = 0; pass < 6; pass++) for (const side of ['left','right']) {
    const upper = bones[`${side}Arm`], lower = bones[`${side}Forearm`], hand = bones[`${side}Hand`];
    upper.getWorldPosition(shoulder);
    target.copy(side === 'left' ? profile.support : zero).applyMatrix4(holder.matrixWorld);
    axis.copy(target).sub(shoulder);
    const reach = lower.position.length() + hand.position.length() - .016;
    if (axis.length() > reach) {
      end.copy(target);
      target.copy(shoulder).addScaledVector(axis.normalize(),reach).sub(end);
      holder.getWorldPosition(chest).add(target);
      holder.position.copy(root.worldToLocal(chest));
      holder.updateMatrixWorld(true);
    }
  }
  holder.getWorldPosition(rightTarget);
  leftTarget.copy(profile.support).applyMatrix4(holder.matrixWorld);
  holder.getWorldQuaternion(gripRotation);
  for (const [side,sign,point] of [['right',1,rightTarget],['left',-1,leftTarget]]) {
    elbowPole.set(sign*.65, .75, .04).applyMatrix4(root.matrixWorld);
    // The source hands hang down; rotate the support palm to cradle the fore-end.
    handRotation.setFromEuler(new T.Euler(side === 'left' ? -Math.PI/2 : -.65,0,side === 'left' ? -.3 : .12));
    handRotation.premultiply(gripRotation);
    solveArm(bones[`${side}Arm`],bones[`${side}Forearm`],bones[`${side}Hand`],point,elbowPole,handRotation);
  }
}

export function gripError(bones, holder, weapon) {
  if (!bones || !GUN_GRIPS[weapon]) return 0;
  holder.updateWorldMatrix(true,false);
  let error = 0;
  for (const [side,offset] of [['right',zero],['left',GUN_GRIPS[weapon].support]]) {
    target.copy(offset).applyMatrix4(holder.matrixWorld);
    error = Math.max(error,bones[`${side}Hand`].getWorldPosition(chest).distanceTo(target));
  }
  return error;
}
