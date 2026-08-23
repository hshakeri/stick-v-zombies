import assert from 'node:assert/strict';
import test from 'node:test';

import { Camera } from '../js/engine/camera.js';
import { ParticleSystem, particles } from '../js/engine/particles.js';
import { speech } from '../js/engine/speech.js';
import { AllyManager, allies } from '../js/entities/allies.js';
import { DarkLord } from '../js/entities/dark_lord.js';
import { Player } from '../js/entities/player.js';
import { ProjectileManager, projectiles } from '../js/entities/projectiles.js';
import { weapons } from '../js/entities/weapons.js';
import { combat } from '../js/systems/combat.js';
import { shop } from '../js/systems/shop.js';
import { StageManager } from '../js/systems/stages.js';
import { WaveDirector } from '../js/systems/waves.js';

function createCanvasContextMock() {
  const calls = {
    restore: 0,
    save: 0,
    scale: [],
    translate: []
  };

  const context = new Proxy({}, {
    get(target, property) {
      if (property === 'save') return () => { calls.save += 1; };
      if (property === 'restore') return () => { calls.restore += 1; };
      if (property === 'scale') return (...args) => { calls.scale.push(args); };
      if (property === 'translate') return (...args) => { calls.translate.push(args); };
      if (property in target) return target[property];
      return () => {};
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    }
  });

  return { calls, context };
}

test('projectile drawing balances every canvas save and restore', () => {
  const manager = new ProjectileManager();
  manager.hazards.push({
    x: 0,
    y: 0,
    radius: 20,
    duration: 1,
    maxDuration: 1,
    color: '#0f0'
  });
  manager.sketchBlocks.push({
    x: 0,
    y: 0,
    width: 60,
    height: 60,
    type: 'obsidian',
    hp: 100,
    maxHp: 100
  });
  manager.projectiles.push(
    { type: 'javelin', x: 10, y: -20, rotation: 0 },
    { type: 'doom_laser', x: 20, y: -30, facing: 1, beamWidth: 20 }
  );

  const { calls, context } = createCanvasContextMock();
  manager.draw(context);

  assert.equal(calls.save, 5, 'the fixture should exercise all draw save sites');
  assert.equal(calls.restore, calls.save, 'canvas state must not leak between frames');
});

test('a landed anvil damages nearby zombies exactly once', () => {
  particles.reset();
  const manager = new ProjectileManager();
  let damageCalls = 0;
  const zombie = {
    x: 0,
    y: 0,
    radius: 18,
    isDead: false,
    takeDamage() {
      damageCalls += 1;
    }
  };
  const camera = { addShake() {} };

  manager.projectiles.push({
    type: 'anvil',
    x: 0,
    y: -5,
    vx: 0,
    vy: 100,
    gravity: 1600,
    radius: 35,
    damage: 180,
    isHostile: false,
    isLanded: false,
    life: 4
  });

  manager.update(0.1, 0, [zombie], null, camera);
  manager.update(0.1, 0, [zombie], null, camera);
  manager.update(0.1, 0, [zombie], null, camera);

  assert.equal(damageCalls, 1);
  assert.equal(manager.projectiles[0].isLanded, true);
  particles.reset();
});

test('Red ally ground slam damages each nearby zombie exactly once', () => {
  particles.reset();
  const manager = new AllyManager();
  let damageCalls = 0;
  const zombie = {
    x: 20,
    y: 0,
    isDead: false,
    takeDamage() {
      damageCalls += 1;
    }
  };
  const camera = { addShake() {} };

  manager.activeAllies.push({
    type: 'red',
    x: 0,
    y: -10,
    facing: 1,
    pose: 'dive_kick',
    timer: 0,
    life: 2.5,
    hasActed: false
  });

  manager.update(0.01, 0, [zombie], null, camera);
  for (let i = 0; i < 5; i += 1) {
    manager.update(0.3, 0, [zombie], null, camera);
  }

  assert.equal(damageCalls, 1);
  assert.equal(manager.activeAllies[0].hasActed, true);
  particles.reset();
});

test('enemy spawns stay safely across the arena from both entrances', () => {
  const director = new WaveDirector();
  const fromLeftEntrance = director.getSafeSpawnX({ x: -920 });
  const fromRightEntrance = director.getSafeSpawnX({ x: 920 });

  assert.ok(fromLeftEntrance > 0, 'left entrance should spawn enemies on the right');
  assert.ok(fromRightEntrance < 0, 'right entrance should spawn enemies on the left');
  assert.ok(Math.abs(fromLeftEntrance + 920) >= 380);
  assert.ok(Math.abs(fromRightEntrance - 920) >= 380);
  assert.ok(fromLeftEntrance >= -920 && fromLeftEntrance <= 920);
  assert.ok(fromRightEntrance >= -920 && fromRightEntrance <= 920);
});

test('particle system enforces its cap and reset clears every effect pool', () => {
  const system = new ParticleSystem();
  for (let i = 0; i < system.maxParticles + 50; i += 1) {
    system.particles.push({ life: 1, x: 0, y: 0, vx: 0, vy: 0 });
  }

  system.update(0);
  assert.equal(system.particles.length, system.maxParticles);

  system.damageTexts.push({});
  system.slashArcs.push({});
  system.shockwaves.push({});
  system.comicPopups.push({});
  system.limbDebris.push({});
  system.speedlinesTimer = 1;
  system.speedlinesMax = 1;
  system.reset();

  assert.deepEqual({
    particles: system.particles.length,
    damageTexts: system.damageTexts.length,
    slashArcs: system.slashArcs.length,
    shockwaves: system.shockwaves.length,
    comicPopups: system.comicPopups.length,
    limbDebris: system.limbDebris.length,
    speedlinesTimer: system.speedlinesTimer,
    speedlinesMax: system.speedlinesMax
  }, {
    particles: 0,
    damageTexts: 0,
    slashArcs: 0,
    shockwaves: 0,
    comicPopups: 0,
    limbDebris: 0,
    speedlinesTimer: 0,
    speedlinesMax: 0
  });
});

test('camera conversions use logical canvas size and round-trip world points', () => {
  const camera = new Camera({
    width: 1600,
    height: 1200,
    clientWidth: 800,
    clientHeight: 600
  });
  camera.x = 120;
  camera.y = -80;
  camera.zoom = 1.25;
  camera.shakeOffsetX = 6;
  camera.shakeOffsetY = -4;

  const center = camera.worldToScreen(camera.x, camera.y);
  assert.deepEqual(center, { x: 406, y: 296 });

  const world = { x: 360, y: -212 };
  const screen = camera.worldToScreen(world.x, world.y);
  const roundTrip = camera.screenToWorld(screen.x, screen.y);
  assert.ok(Math.abs(roundTrip.x - world.x) < 1e-9);
  assert.ok(Math.abs(roundTrip.y - world.y) < 1e-9);

  const { calls, context } = createCanvasContextMock();
  camera.apply(context);
  camera.restore(context);
  assert.deepEqual(calls.translate[0], [406, 296]);
  assert.deepEqual(calls.scale[0], [1.25, 1.25]);
  assert.equal(calls.save, 1);
  assert.equal(calls.restore, 1);
});

test('wide viewports cannot zoom beyond the painted arena framing', () => {
  const camera = new Camera({
    width: 3840,
    height: 2160,
    clientWidth: 1920,
    clientHeight: 1080
  });
  const minimumZoom = camera.getMinimumZoom();

  camera.zoom = 0.78;
  camera.targetZoom = 0.78;
  camera.update(1 / 60, { x: 0, y: 0, facing: 1, vx: 1200, vy: 0 }, 30);

  assert.ok(minimumZoom > 0.78);
  assert.ok(camera.zoom >= minimumZoom);
  assert.ok(1920 / camera.zoom <= camera.maxX - camera.minX - 64 + 1e-9);

  const fourKCamera = new Camera({ clientWidth: 3840, clientHeight: 2160 });
  const renderRatio = fourKCamera.getRenderPixelRatio(2);
  assert.ok(renderRatio < 2);
  assert.ok(3840 * 2160 * renderRatio * renderRatio <= 10_000_000 + 1e-6);
});

test('short-screen camera anchor keeps the ground above touch controls', () => {
  const camera = new Camera({ clientWidth: 667, clientHeight: 375 });
  const target = camera.getTargetPosition({ x: 0, y: 0, facing: 1 });
  camera.x = target.x;
  camera.y = target.y;
  camera.zoom = 1;

  const ground = camera.worldToScreen(0, 0);
  assert.ok(ground.y < 250, `ground should stay above the pad, received y=${ground.y}`);
});

test('the Dark Lord doom laser applies one readable full hit', () => {
  particles.reset();
  const manager = new ProjectileManager();
  const damage = [];
  const player = {
    x: 100,
    y: 0,
    iFrames: 0,
    isDead: false,
    isRolling: false,
    isAwakened: false,
    takeDamage(amount) {
      damage.push(amount);
      this.iFrames = 0.9;
    }
  };
  const camera = { addShake() {} };
  manager.projectiles.push({
    type: 'doom_laser',
    x: 0,
    y: -30,
    vx: 0,
    vy: 0,
    facing: 1,
    beamWidth: 32,
    damage: 35,
    duration: 1.2,
    isHostile: true,
    hitPlayer: false,
    life: 1.2
  });

  manager.update(0.1, 0, [], player, camera);
  manager.update(0.1, 0, [], player, camera);

  assert.deepEqual(damage, [35]);
  assert.equal(manager.projectiles[0].hitPlayer, true);
  particles.reset();
});

test('boss drawing is pure and cannot leak particles while paused', () => {
  particles.reset();
  const boss = new DarkLord(0, 0);
  boss.isAwakened = true;
  boss.renderer.draw = () => {};
  const { context } = createCanvasContextMock();

  for (let i = 0; i < 20; i += 1) boss.draw(context);

  assert.equal(particles.particles.length, 0);
});

test('new-run resets restore upgrades and clear transient systems', () => {
  shop.upgrades[0].level = 3;
  weapons.anvilDamage = 999;
  allies.maxCooldowns.red = 2;
  allies.cooldowns.red = 8;
  allies.activeAllies.push({ type: 'red' });
  projectiles.projectiles.push({ type: 'anvil' });
  projectiles.sketchBlocks.push({ type: 'obsidian' });
  projectiles.hazards.push({ type: 'acid' });
  speech.bubbles.push({ text: 'stale' });
  particles.particles.push({ life: 1 });
  combat.score = 9000;
  combat.ink = 999;
  combat.totalKills = 42;
  combat.inkDrops.push({ value: 5 });

  shop.reset();
  allies.reset(true);
  projectiles.reset();
  speech.reset();
  particles.reset();
  combat.resetRun(50);
  const player = new Player(0, 0);

  assert.ok(shop.upgrades.every(upgrade => upgrade.level === 0));
  assert.equal(weapons.anvilDamage, 150);
  assert.equal(allies.maxCooldowns.red, 10);
  assert.equal(allies.cooldowns.red, 0);
  assert.equal(allies.activeAllies.length, 0);
  assert.equal(projectiles.projectiles.length, 0);
  assert.equal(projectiles.sketchBlocks.length, 0);
  assert.equal(projectiles.hazards.length, 0);
  assert.equal(speech.bubbles.length, 0);
  assert.equal(particles.particles.length, 0);
  assert.deepEqual(
    { score: combat.score, ink: combat.ink, kills: combat.totalKills, drops: combat.inkDrops.length },
    { score: 0, ink: 50, kills: 0, drops: 0 }
  );
  assert.deepEqual(
    { hp: player.hp, maxHp: player.maxHp, damage: player.damageMultiplier, speed: player.speed },
    { hp: 100, maxHp: 100, damage: 1, speed: 340 }
  );
});

test('the final-stage exit completes the run without advancing to stage 11', () => {
  const manager = new StageManager();
  manager.currentStage = 10;
  manager.maxStage = 10;
  let completions = 0;
  const advancedStages = [];

  const result = manager.resolveStageExit(
    11,
    () => { completions += 1; },
    stage => advancedStages.push(stage)
  );

  assert.equal(result, 'complete');
  assert.equal(completions, 1);
  assert.deepEqual(advancedStages, []);
});
