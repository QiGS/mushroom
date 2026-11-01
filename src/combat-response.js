import { enemyFootprint, moveGroundEnemy } from './enemy-movement.js';

export function meleeContact(enemy, player) {
  let nearest = null, best = Infinity;
  for (const d of enemyFootprint(enemy)) {
    const dx = player.x - d.x, dz = player.z - d.z, length = Math.hypot(dx, dz);
    const distance = Math.max(0, length - d.radius);
    if (distance >= best) continue;
    best = distance;
    const amount = Math.min(d.radius, length) / (length || 1);
    nearest = { x: d.x + dx * amount, z: d.z + dz * amount };
  }
  return nearest;
}

export function beginHitReaction(e, weapon, player) {
  const dx = e.x - player.x, dz = e.z - player.z, length = Math.hypot(dx, dz) || 1;
  const distance = ({ staff: 1.25, axe: 1.65, rifle: 2.1, sniper: 1.6, cannon: 3 })[weapon] || 1.25;
  e.hitPause = e.boss ? .05 : .09;
  e.hitReact = e.boss ? .12 : .32;
  e.hitLabel = .65;
  e.recoil = e.flying ? null : { x: dx / length, z: dz / length, time: .22, speed: distance * (e.boss ? .18 : 1) / .22 };
  if (!e.boss) {
    // A normal hit interrupts an attack, but does not manufacture a weak point.
    if (e.state !== 'stunned') { e.state = 'recover'; e.timer = .65; }
    else e.timer = Math.max(e.timer, .65);
    e.telegraph.visible = e.sweep.visible = false;
  }
}

// Returns true while the body is reacting, so charge AI cannot cancel recoil.
export function advanceHitReaction(world, state, e, dt) {
  if (e.hitPause > 0) { e.hitPause = Math.max(0, e.hitPause - dt); return true; }
  const reacting = e.hitReact > 0 || e.recoil?.time > 0;
  if (e.recoil?.time > 0) {
    const step = Math.min(dt, e.recoil.time);
    const blocked = moveGroundEnemy(world, state, e, e.recoil.x * step * e.recoil.speed, e.recoil.z * step * e.recoil.speed);
    e.recoil.time = blocked ? 0 : Math.max(0, e.recoil.time - step);
  }
  e.hitReact = Math.max(0, (e.hitReact || 0) - dt);
  return reacting;
}

export function bodyChargeContact(game, e, recovery = 1.3) {
  if (!e.blockedBy) return false;
  if (e.blockedBy.kind === 'player' && e.state === 'charge') game.hurt(e);
  e.state = 'recover'; e.timer = recovery; e.combo = 0;
  e.telegraph.visible = e.sweep.visible = false;
  return true;
}
