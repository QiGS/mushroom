import { createPathfinder } from './navigation.js';
import { stepBody } from './terrain.js';
import { missionTarget } from './mission.js';
import { BOSSES } from './progression.js';

export function guideDestination(s) {
  const target = missionTarget(s), boss = BOSSES[s.chapter];
  if (boss && !s.defeated.includes(boss.id) && target.name.includes(boss.name))
    return { ...target, ...boss.approach, hint: boss.hint + ' 我就在安全路口等你。' };
  return target;
}

// Walk the same collision-aware path and physics as the player, without granting
// quest progress. Pauses, distance and blocked paths never teleport either actor.
export class TrailGuide {
  constructor(world) {
    this.world = world;
    this.actor = world.guide;
    this.find = createPathfinder(world);
    this.phase = 'idle';
    this.path = [];
    this.body = { actor: this.actor, radius: this.actor.id === 'herder-guide' ? .75 : .4, position: this.actor.object.position, grounded: true, vertical: 0 };
  }
  start(s) {
    this.target = guideDestination(s);
    this.path = this.find(s, this.body.position, this.target);
    const stop = this.path.findLastIndex((p) => {
      const d = Math.hypot(p.x - this.target.x, p.z - this.target.z);
      return d >= 1.7 && d <= 2.5;
    });
    // Leave the clue itself free for E interactions and the player's approach.
    if (stop > 0) this.path.length = stop + 1;
    this.index = 1;
    this.stuck = 0;
    this.phase = this.path.length ? 'walking' : 'blocked';
    return this.path.length > 0;
  }
  stop() {
    this.phase = 'idle';
    this.actor.walking = false;
  }
  update(dt, s, player) {
    this.actor.walking = false;
    if (!['walking', 'waiting'].includes(this.phase)) return null;
    const p = this.body.position;
    if (Math.hypot(player.x - p.x, player.z - p.z) > 8) {
      this.phase = 'waiting';
      return null;
    }
    this.phase = 'walking';
    while (this.index < this.path.length && Math.hypot(this.path[this.index].x - p.x, this.path[this.index].z - p.z) < .16) this.index++;
    if (this.index >= this.path.length) {
      this.phase = 'arrived';
      return this.target;
    }
    const next = this.path[this.index], dx = next.x - p.x, dz = next.z - p.z, distance = Math.hypot(dx, dz);
    const amount = Math.min(distance, 2.4 * dt), x = p.x, z = p.z;
    stepBody(this.world, s, this.body, dx / distance * amount, dz / distance * amount, dt);
    const moved = Math.hypot(p.x - x, p.z - z);
    this.actor.walking = moved > .001;
    this.actor.x = p.x;
    this.actor.z = p.z;
    this.actor.object.rotation.y += Math.atan2(Math.sin(Math.atan2(dx, dz) - this.actor.object.rotation.y), Math.cos(Math.atan2(dx, dz) - this.actor.object.rotation.y)) * Math.min(1, dt * 8);
    this.stuck = moved < .001 ? this.stuck + dt : 0;
    if (this.stuck > 1.5 || this.body.swimming) {
      this.phase = 'blocked';
      this.actor.walking = false;
    }
    return null;
  }
  status() {
    return { idle: 'E 交谈 · 请我带路', walking: '跟我来 · 前往主线线索', waiting: '慢慢来，我在这里等你', arrived: '线索就在附近 · E 聊聊下一步', blocked: '前路受阻 · E 重新商量路线' }[this.phase];
  }
}
