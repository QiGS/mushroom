// Invoked only by the ?qa development panel; never shipped in production.
import { BOSSES } from './progression.js';
import { surfaceHeight } from './terrain.js';
export function addTravelQA(game, add) {
  add('QA 三维商店', () => { game.state.coins = 1500; game.state.unlocked = 5; game.ui.journey.market(); });
  add('QA 传送与重生验收', async () => {
    const report = [];
    const check = (ok, message) => { if (!ok) throw new Error(message); report.push('通过 · ' + message); };
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      game.ui.close(); game.photoMode = true;
      const snapshot = JSON.stringify({ chapter: game.state.chapter, coins: game.state.coins, inventory: game.state.inventory, recipes: game.state.recipes });
      for (const anchor of game.world.travelAnchors) {
        game.fastTravel(anchor.id);
        check(Math.hypot(game.state.position.x - anchor.x, game.state.position.z - anchor.z) < .1 && game.grounded && !game.swimming && game.velocity.length() === 0, anchor.name + '落地状态');
      }
      check(snapshot === JSON.stringify({ chapter: game.state.chapter, coins: game.state.coins, inventory: game.state.inventory, recipes: game.state.recipes }), '传送保留章节、物品、金币与料理记录');
      check(Object.values(BOSSES).every(b => game.enemies.some(e => e.id === b.id)), '同地图四个领地首领');
      for (const cause of ['boss', 'water', 'fall', 'acid']) {
        game.fastTravel('bamboo');
        const boss = game.enemies.find(e => e.id === 'boss');
        const dead = game.enemies.find(e => !e.boss && !e.night);
        dead.hp = 0; dead.object.visible = false; game.state.defeated.push(dead.id);
        boss.hp = 1; boss.phase = 3; boss.state = 'charge';
        game.state.health = 1; game.state.shielded = false; game.invincible = 0;
        game.swimming = true; game.waterTimer = 10; game.slowTime = 2;
        const point = game.player.root.position;
        game.spawnAcid(boss, point);
        if (cause === 'acid') {
          point.y = surfaceHeight(game.world, point.x, point.z);
          game.updateAcid(.016);
        } else if (cause === 'boss') game.hurt(boss);
        else game.environmentHit(2, 'QA ' + cause);
        await nextFrame();
        check(!game.pendingRespawn && game.state.health === 5 && game.state.stamina === 100 && Math.hypot(game.state.position.x, game.state.position.z - 30) < 1, cause + '死亡回村口');
        check(game.state.defeated.length === 0 && game.enemies.filter(e => !e.night).every(e => e.hp === e.maxHp && e.state !== 'charge'), cause + '所有怪物重置');
        check(!game.acidPools.length && !game.poisonBolts.length && !game.artillery.length && !game.swimming && game.waterTimer === 0 && game.slowTime === 0 && !game.playerRecoil, cause + '危险物与状态清理');
      }
      check(snapshot === JSON.stringify({ chapter: game.state.chapter, coins: game.state.coins, inventory: game.state.inventory, recipes: game.state.recipes }), '死亡保留行囊与永久进度');
      game.ui.show('传送与重生验收通过', 'LOCAL GAME RUNTIME', `<pre style="white-space:pre-wrap">${report.join('\n')}</pre>`, 'qa-result');
    } catch (error) {
      game.ui.show('传送与重生验收失败', 'LOCAL GAME RUNTIME', `<pre style="white-space:pre-wrap">${report.join('\n')}\n失败 · ${error.message}</pre>`, 'qa-result');
      console.error(error);
    } finally { game.photoMode = false; }
  });
}
