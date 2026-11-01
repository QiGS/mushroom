import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ActorSpace } from '../src/actor-collision.js';
import { stepBody } from '../src/terrain.js';
import { makeSnake } from '../src/world.js';
import { makeAnt, updateAnt } from '../src/ant-enemy.js';
import { makeEncounter, updateEncounter } from '../src/boss-encounters.js';
import { enemyFootprint, enemyFits, moveGroundEnemy, turnGroundEnemy, placeGroundEnemy } from '../src/enemy-movement.js';
import { beginHitReaction, advanceHitReaction, meleeContact, bodyChargeContact } from '../src/combat-response.js';
import { dialoguePages, speakerPortrait } from '../src/dialog-pages.js';
import { newGame } from '../src/state.js';
import { inAttackArc } from '../src/combat.js';
import { disposeObject } from '../src/resources.js';

function setup() {
  const world = { colliders: [], surfaces: [{ x: 0, z: 0, hx: 200, hz: 200, y: 10 }], actors: new ActorSpace() };
  const state = newGame(); state.gateOpen = true;
  return { world, state, root: new T.Group() };
}
function actor(w, x, z, kind = 'player', radius = .38, y = 10) {
  const a = { position: new T.Vector3(x, y, z), alive: true };
  w.actors.track(a, () => a.alive ? { discs: [{ x: a.position.x, z: a.position.z, radius }], bottom: a.position.y, top: a.position.y + 1.65 } : null, kind);
  return a;
}
function track(w, e) {
  w.actors.track(e, () => e.hp > 0 ? { discs: enemyFootprint(e), bottom: e.object.position.y - .15, top: e.object.position.y + (e.boss ? 2.5 : .85) } : null);
}

test('snake, ant, queen and scorpion charges stop outside the player, including large steps', () => {
  for (const create of [makeSnake, makeAnt, (r,x,z) => makeAnt(r,x,z,true), (r,x,z) => makeEncounter(r,x,z,'scorpion')]) {
    const { world, state, root } = setup(), p = actor(world, 0, 0);
    const e = create(root, 0, 8); e.hp = 10; e.state = 'charge';
    assert.ok(placeGroundEnemy(world, state, e, {x:0,z:8}));
    turnGroundEnemy(world, state, e, Math.PI); track(world, e);
    assert.equal(moveGroundEnemy(world, state, e, 0, -15), true);
    assert.equal(e.blockedBy.owner, p);
    assert.ok(enemyFits(world,state,e,e.x,e.z));
    let hits = 0; const game = { hurt: () => hits++ };
    assert.equal(bodyChargeContact(game,e),true);
    bodyChargeContact(game,e);
    assert.equal(hits,1, 'one charge ends at body contact');
    assert.equal(e.state,'recover');
    disposeObject(root);
  }
});

test('walking and a long dodge cannot cross snake tail, and stopping does not inflict damage', () => {
  const { world, state, root } = setup(), e = makeSnake(root,0,0);
  e.hp=5; placeGroundEnemy(world,state,e,{x:0,z:0}); track(world,e);
  const p=actor(world,-3,-1.62),body={actor:p,position:p.position,vertical:0,grounded:true};
  stepBody(world,state,body,7,0,.05);
  assert.ok(p.position.x < -.65, 'tail has a solid body');
  const stopped=p.position.x;
  for(let i=0;i<40;i++) stepBody(world,state,body,.2,0,.016);
  assert.equal(p.position.x,stopped);
  assert.equal(state.health,5);
  e.hp=0;world.actors.refresh(e);
  stepBody(world,state,body,3,0,.05);
  assert.ok(p.position.x>1,'defeated creatures no longer obstruct');
  disposeObject(root);
});

test('spatial hash supports leaving an old overlap, height separation, relocation and removal',()=>{
  const {world,state}=setup(), p=actor(world,0,0), other=actor(world,.5,0,'npc',.4);
  const body={actor:p,position:p.position,vertical:0,grounded:true};
  stepBody(world,state,body,-1,0,.01);
  assert.ok(p.position.x<-.9,'old overlap can be escaped');
  other.position.set(30,10,0);world.actors.refresh(other);
  assert.equal(world.actors.blocker([{x:0,z:0,radius:.4}],10,12,p),null);
  assert.equal(world.actors.blocker([{x:30,z:0,radius:.4}],10,12,p)?.owner,other);
  assert.equal(world.actors.blocker([{x:30,z:0,radius:.4}],13,15,p),null);
  world.actors.remove(other);
  assert.equal(world.actors.blocker([{x:30,z:0,radius:.4}],10,12,p),null);
  assert.equal(world.actors.records.size,1);
});

test('enemies stop at other enemies and villagers without a false player hit or terrain weak point',()=>{
  for(const kind of ['enemy','npc']){
    const {world,state,root}=setup();actor(world,0,0,kind,.6);
    const e=makeAnt(root,0,4);e.hp=8;e.state='charge';placeGroundEnemy(world,state,e,{x:0,z:4});track(world,e);
    assert.ok(moveGroundEnemy(world,state,e,0,-8));
    let hits=0;bodyChargeContact({hurt:()=>hits++},e);
    assert.equal(hits,0);assert.equal(e.state,'recover');
    disposeObject(root);
  }
});

test('ordinary hits cancel charges and visibly recoil, with no forward AI during reaction',()=>{
  for(const weapon of ['staff','axe','rifle','sniper','cannon']){
    const {world,state,root}=setup(),e=makeSnake(root,0,0);
    e.hp=8;e.state='charge';e.cooldown=.3;placeGroundEnemy(world,state,e,{x:0,z:0});track(world,e);
    const before=e.z;
    beginHitReaction(e,weapon,{x:0,z:3});
    assert.equal(e.state,'recover');assert.equal(e.sweep.visible,false);
    for(let i=0;i<30;i++){
      const reacted=advanceHitReaction(world,state,e,1/60);
      if(i<18) assert.equal(reacted,true);
    }
    assert.ok(before-e.z>=1.24,`${weapon} should visibly push the target away`);
    assert.equal(e.cooldown,0,'hit stop must not make the next staff swing miss');
    assert.ok(enemyFits(world,state,e,e.x,e.z));
    disposeObject(root);
  }
});

test('recoil is wall-safe and a boss hit preserves attack phase and existing weak points',()=>{
  const {world,state,root}=setup(), e=makeSnake(root,0,0);
  world.colliders.push({x:0,z:-3,hx:5,hz:.1,height:3});e.hp=8;
  placeGroundEnemy(world,state,e,{x:0,z:0});track(world,e);
  beginHitReaction(e,'cannon',{x:0,z:3});
  for(let i=0;i<50;i++)advanceHitReaction(world,state,e,.016);
  assert.ok(enemyFits(world,state,e,e.x,e.z));assert.ok(e.z>-.95);
  e.state='stunned';e.timer=2.8;beginHitReaction(e,'staff',{x:0,z:3});assert.equal(e.timer,2.8);
  const boss=makeAnt(root,10,0,true);boss.state='summon';boss.phase=3;boss.hp=200;
  beginHitReaction(boss,'rifle',{x:10,z:3});assert.equal(boss.state,'summon');assert.equal(boss.phase,3);
  assert.ok(boss.recoil.speed*.22<.5);
  const flying=makeEncounter(root,20,0,'butterfly');flying.state='hover';beginHitReaction(flying,'sniper',{x:20,z:3});assert.equal(flying.recoil,null);assert.equal(flying.state,'hover');
  disposeObject(root);
});

test('melee detects the visible tail when the head is out of range, with an attack-facing arc',()=>{
  const {root}=setup(),e=makeSnake(root,0,0),p={x:0,z:-4.4};
  const contact=meleeContact(e,p);
  assert.ok(Math.hypot(p.x-e.x,p.z-e.z)>3);
  assert.ok(inAttackArc(p,contact,0,3,false));
  assert.equal(inAttackArc(p,contact,Math.PI,3,false),false);
  disposeObject(root);
});

test('dialogue pages preserve all text, fit long unpunctuated passages, and resolve each guide portrait',()=>{
  const text='奶奶说：今晚村里煮菌子汤。先找到倒木，再留意落叶下面。'.repeat(5);
  const pages=dialoguePages(text);
  assert.ok(pages.length>1);assert.equal(pages.join(''),text);assert.ok(pages.every(p=>p.length<=78));
  assert.equal(dialoguePages('菌'.repeat(190)).join(''),'菌'.repeat(190));
  assert.equal(speakerPortrait('奶奶 · 村口'),'grandma');assert.equal(speakerPortrait('大叔 · 山货铺'),'uncle');
  assert.equal(speakerPortrait('阿禾 · 放牛小孩'),'herder-guide');assert.equal(speakerPortrait('阿花'),'flower-guide');assert.equal(speakerPortrait('阿山叔'),'forager-guide');assert.equal(speakerPortrait('村口火塘'),undefined);
});


test('ant and scorpion AI recover after one body collision and resume their normal loop',()=>{
  for(const species of ['ant','scorpion']){
    const {world,state,root}=setup(),p=actor(world,0,0);
    const e=species==='ant'?makeAnt(root,0,6):makeEncounter(root,0,6,'scorpion');
    e.hp=e.maxHp=100;placeGroundEnemy(world,state,e,{x:0,z:6});track(world,e);
    e.state='charge';e.timer=2;e.dir.set(0,-1);
    let hits=0;const g={world,state,player:{root:{position:p.position}},gameTime:0,ui:{toast(){}},narrator:{say(){}},hurt(){hits++}};
    const tick=species==='ant'?updateAnt:updateEncounter;
    for(let i=0;i<180 && e.state==='charge';i++){g.gameTime+=1/60;tick(g,e,1/60)}
    assert.equal(hits,1);assert.equal(e.state,'recover');assert.ok(enemyFits(world,state,e,e.x,e.z));
    e.timer=.001;tick(g,e,1/60);assert.equal(e.state,'idle');assert.equal(hits,1);
    disposeObject(root);
  }
});
