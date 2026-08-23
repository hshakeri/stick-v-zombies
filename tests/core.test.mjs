import assert from 'node:assert/strict';
import test from 'node:test';

import { Camera } from '../js/engine/camera.js';
import { ParticleSystem, particles } from '../js/engine/particles.js';
import { SPEECH_CORPUS, SpeechBubbleManager, speech } from '../js/engine/speech.js';
import { AllyManager, allies } from '../js/entities/allies.js';
import { DarkLord } from '../js/entities/dark_lord.js';
import { H4C3R } from '../js/entities/h4c3r.js';
import { KingOrange } from '../js/entities/king_orange.js';
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

test('Animator cursor prioritizes a boss over ordinary nearby enemies', () => {
  const manager = new AllyManager();
  const brute = { x: 20, y: 0, type: 'brute', isBoss: false, isDead: false };
  const boss = { x: 500, y: 0, type: 'king_orange', isBoss: true, isDead: false };

  assert.equal(manager.summonAlly('cursor', 0, 0, 1, [brute, boss]), true);
  assert.equal(manager.activeCursors[0].targetZombie, boss);
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

test('camera focus cues and zoom punches stay brief and bounded', () => {
  const camera = new Camera({ clientWidth: 800, clientHeight: 600 });
  const target = { x: -300, y: 0, facing: 1, vx: 0, vy: 0 };

  assert.equal(camera.focusOn(420, -180, 0.5, 0.9), true);
  camera.addZoomPunch(5);
  assert.ok(camera.zoomPunch <= 0.1);
  camera.update(0.05, target, 1);
  assert.ok(camera.targetX > target.x, 'focus should pan toward the authored cue');

  for (let i = 0; i < 20; i += 1) camera.update(0.05, target, 1);
  assert.equal(camera.focusCue, null);
  assert.ok(Math.abs(camera.zoomPunch) < 0.001);
});

test('reachable crowd sizes still trigger the bounded horde zoom', () => {
  const calmCamera = new Camera({ clientWidth: 800, clientHeight: 600 });
  const hordeCamera = new Camera({ clientWidth: 800, clientHeight: 600 });
  const target = { x: 0, y: 0, facing: 1, vx: 0, vy: 0 };

  calmCamera.update(1 / 60, target, 6);
  hordeCamera.update(1 / 60, target, 12);

  assert.equal(calmCamera.targetZoom, 1);
  assert.ok(hordeCamera.targetZoom < calmCamera.targetZoom);
  assert.ok(hordeCamera.targetZoom >= 0.92);
});

test('reduced-motion camera focus cannot sweep across the arena', () => {
  const camera = new Camera({ clientWidth: 800, clientHeight: 600 });
  camera.motionScale = 0.28;
  camera.targetX = 0;
  camera.targetY = -100;
  camera.targetZoom = 1;

  camera.focusOn(900, -500, 1, 0.8);

  assert.ok(Math.abs(camera.focusCue.x - camera.targetX) <= 90);
  assert.ok(Math.abs(camera.focusCue.y - camera.targetY) <= 55);
  assert.ok(camera.focusCue.duration <= 0.55);
  assert.ok(Math.abs(camera.focusCue.zoom - camera.targetZoom) < 0.08);
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

test('post-Dark-Lord stages do not wrap back to the desktop', () => {
  const manager = new StageManager();
  manager.loadStage(11);

  assert.equal(manager.currentStage, 11);
  assert.equal(manager.maxStage, 15);
  assert.notEqual(manager.stageName, 'Main Desktop');
  assert.notEqual(manager.theme, 'desktop');
});

test('stage 14 advances to H4C3R and stage 15 completes the campaign', () => {
  const manager = new StageManager();
  manager.currentStage = 14;
  let completions = 0;
  const advancedStages = [];

  const advanceResult = manager.resolveStageExit(
    15,
    () => { completions += 1; },
    stage => advancedStages.push(stage)
  );
  manager.currentStage = 15;
  const completionResult = manager.resolveStageExit(
    16,
    () => { completions += 1; },
    stage => advancedStages.push(stage)
  );

  assert.equal(advanceResult, 'advance');
  assert.equal(completionResult, 'complete');
  assert.equal(completions, 1);
  assert.deepEqual(advancedStages, [15]);
});

test('late campaign waves are handcrafted, capped, and route both new bosses', () => {
  for (const stage of [11, 12, 13, 14, 15]) {
    const director = new WaveDirector();
    director.generateWaveQueue(stage);
    assert.ok(director.spawnQueue.length <= 30, `stage ${stage} queued too many enemies`);
    if (stage === 11) assert.ok(director.spawnQueue.some(entry => entry.type === 'king_orange'));
    if (stage === 15) assert.ok(director.spawnQueue.some(entry => entry.type === 'h4c3r'));
  }
});

test('wave director never spawns beyond its active-enemy budget', () => {
  const director = new WaveDirector();
  const enemyStub = () => ({ isDead: false, update() {} });
  director.isWaveActive = true;
  director.spawnTimer = 0;
  director.zombies = Array.from({ length: director.maxActiveEnemies }, enemyStub);
  director.spawnQueue = [{ type: 'walker', delay: 0.1 }];
  let spawnCalls = 0;
  director.spawnZombie = () => {
    spawnCalls += 1;
    director.zombies.push(enemyStub());
  };

  director.update(0.1, { x: 0, y: 0 }, 0, [], { addShake() {} }, () => {});
  assert.equal(spawnCalls, 0);
  assert.equal(director.zombies.length, director.maxActiveEnemies);

  director.zombies.pop();
  director.spawnTimer = 0;
  director.update(0.1, { x: 0, y: 0 }, 0, [], { addShake() {} }, () => {});
  assert.equal(spawnCalls, 1);
  assert.equal(director.zombies.length, director.maxActiveEnemies);
});

test('stage laser hazards respect player invulnerability frames', () => {
  const manager = new StageManager();
  manager.loadStage(14);
  const laser = manager.laserHazards[0];
  let damageCalls = 0;
  const player = {
    x: laser.x + laser.width * 0.5,
    y: laser.y + 30,
    isDead: false,
    isRolling: false,
    isAwakened: false,
    iFrames: 0.5,
    takeDamage() {
      damageCalls += 1;
      this.iFrames = 0.8;
    }
  };
  const inactiveWave = { isWaveActive: false, spawnQueue: [], zombies: [] };

  manager.update(0.01, player, inactiveWave, () => {});
  assert.equal(damageCalls, 0);

  player.iFrames = 0;
  manager.update(0.01, player, inactiveWave, () => {});
  assert.equal(damageCalls, 1);
});

test('clearing a stage gives the exit a brief camera cue', () => {
  projectiles.reset();
  const manager = new StageManager();
  manager.loadStage(12);
  const calls = [];
  const camera = {
    focusOn(...args) { calls.push(['focus', ...args]); },
    addZoomPunch(amount) { calls.push(['zoom', amount]); }
  };
  const player = { x: -800, y: 0, isDead: false };
  const clearedWave = { isWaveActive: true, spawnQueue: [], zombies: [] };
  projectiles.projectiles.push(
    { type: 'enemy_shot', isHostile: true },
    { type: 'pencil_spear', isHostile: false }
  );
  projectiles.hazards.push({ type: 'acid' });

  manager.update(0.016, player, clearedWave, () => {}, camera);

  assert.equal(manager.exitDoor.isOpen, true);
  assert.equal(calls[0][0], 'focus');
  assert.equal(calls[1][0], 'zoom');
  assert.deepEqual(projectiles.projectiles.map((entry) => entry.type), ['pencil_spear']);
  assert.equal(projectiles.hazards.length, 0);
  projectiles.reset();
});

test('the final exit waits for H4C3R defeat framing to finish', () => {
  projectiles.reset();
  const manager = new StageManager();
  manager.loadStage(15);
  const calls = [];
  const camera = {
    focusOn(...args) { calls.push(['focus', ...args]); },
    addZoomPunch(amount) { calls.push(['zoom', amount]); }
  };
  const player = { x: -800, y: 0, isDead: false };
  const clearedWave = { isWaveActive: true, spawnQueue: [], zombies: [] };

  manager.update(0.016, player, clearedWave, () => {}, camera);
  assert.equal(manager.exitDoor.isOpen, true);
  assert.deepEqual(calls, [], 'the exit pan must not overwrite the boss defeat focus');

  for (let i = 0; i < 60; i += 1) manager.update(0.016, player, clearedWave, () => {}, camera);
  assert.equal(calls[0][0], 'focus');
  assert.equal(calls[1][0], 'zoom');
});

test('new boss renderers are pure and expose the wave-director contract', () => {
  particles.reset();
  const bosses = [new KingOrange(10, 0), new H4C3R(-10, 0)];
  const { context } = createCanvasContextMock();

  for (const boss of bosses) {
    boss.renderer.draw = () => {};
    assert.equal(boss.isBoss, true);
    assert.ok(Number.isFinite(boss.x));
    assert.ok(Number.isFinite(boss.y));
    assert.ok(Number.isFinite(boss.radius));
    assert.ok(Number.isFinite(boss.maxHp) && boss.maxHp > 0);
    for (let i = 0; i < 10; i += 1) boss.draw(context);
  }

  assert.equal(particles.particles.length, 0);
});

test('boss telegraphs stay grounded and H4C3R has one wave-owned intro', () => {
  const player = new Player(0, 0);
  const bossTarget = {
    x: 20,
    y: 0,
    radius: 30,
    height: 84,
    isDead: false,
    isBoss: true,
    vy: 0,
    takeDamage() {}
  };

  player.checkMeleeHits([bossTarget], 110, 1, 0, false, '#fff', null, true);
  assert.equal(bossTarget.vy, 0);
  assert.equal(player.airJuggleTarget, null);

  const h4c3r = new H4C3R(300, 0);
  h4c3r.actionCooldown = 10;
  const focusCalls = [];
  h4c3r.update(
    0.016,
    0,
    { x: -300, y: 0, vx: 0, isDead: false, isRolling: false, isAwakened: false },
    [],
    { focusOn(...args) { focusCalls.push(args); } },
    []
  );
  assert.equal(focusCalls.length, 0, 'the wave director owns the only boss intro focus');
});

test('freeze slows King Orange time and movement by the same factor', () => {
  const simulateDash = (frozen) => {
    const boss = new KingOrange(0, 0);
    boss.state = 'gold_dash';
    boss.stateTimer = 0.24;
    boss.vx = 610;
    boss.facing = 1;
    if (frozen) boss.freezeTimer = 1;
    const player = { x: -900, y: 0, isDead: false, isRolling: false, isAwakened: false };
    let frames = 0;
    while (boss.state === 'gold_dash' && frames < 100) {
      boss.update(0.01, 0, player, [], null, []);
      frames += 1;
    }
    return boss.x;
  };

  const normalDistance = simulateDash(false);
  const frozenDistance = simulateDash(true);
  assert.ok(Math.abs(normalDistance - frozenDistance) < 6, `${normalDistance} vs ${frozenDistance}`);
});

test('boss-owned cleanup cannot strand the projectile that dealt the final hit', () => {
  projectiles.reset();
  const boss = new KingOrange(0, 0);
  boss.hp = 1;
  projectiles.projectiles.push(
    {
      type: 'king_block', owner: boss.projectileOwner, x: 400, y: -30,
      vx: 0, vy: 0, radius: 18, damage: 1, isHostile: true, life: 1
    },
    {
      type: 'pencil_spear', x: 0, y: -30, vx: 0, vy: 0,
      radius: 18, damage: 20, isHostile: false, life: 1, pierce: 0
    }
  );

  projectiles.update(0.016, 0, [boss], null, { addShake() {} });

  assert.equal(boss.isDead, true);
  assert.deepEqual(projectiles.projectiles, []);
  projectiles.reset();
});

test('speech corpus gives every ally terse, character-specific banter', () => {
  const allyNames = ['red', 'blue', 'yellow', 'green', 'cursor'];
  for (const allyName of allyNames) {
    const lines = SPEECH_CORPUS.allies[allyName];
    assert.ok(Array.isArray(lines) && lines.length >= 3, `${allyName} needs its own quips`);
    assert.ok(lines.every(line => line.length <= 24), `${allyName} has an unreadably long quip`);
  }

  let now = 1000;
  const manager = new SpeechBubbleManager(() => now);
  assert.equal(manager.shout(0, 0, 'allies', 'red'), true);
  assert.equal(manager.shout(20, 0, 'allies', 'blue'), true, 'one ally must not silence another');
  assert.equal(manager.shout(0, 0, 'allies', 'red'), false, 'the same speaker should still be throttled');
  now += 400;
  assert.equal(manager.shout(0, 0, 'allies', 'red'), true);
});

test('three simultaneous speech bubbles occupy distinct readable lanes', () => {
  const manager = new SpeechBubbleManager(() => 1000);
  manager.spawnBubble(400, 300, 'ONE!', 'ally-red', 1.4, { speakerKey: 'one', cooldownMs: 0 });
  manager.spawnBubble(400, 300, 'TWO!', 'ally-blue', 1.4, { speakerKey: 'two', cooldownMs: 0 });
  manager.spawnBubble(400, 300, 'THREE!', 'ally-green', 1.4, { speakerKey: 'three', cooldownMs: 0 });
  const { calls, context } = createCanvasContextMock();

  manager.draw(context, null, 800, 600);

  const bubbleYs = calls.translate.slice(-3).map(([, y]) => y);
  assert.equal(new Set(bubbleYs).size, 3);
  assert.ok(bubbleYs.every((y) => y >= 180), 'bubbles should stay below the two-row compact HUD');
});

test('an empty speech layer performs no canvas work', () => {
  const manager = new SpeechBubbleManager();
  const { calls, context } = createCanvasContextMock();

  manager.draw(context, null, 800, 600);

  assert.equal(calls.save, 0);
  assert.equal(calls.restore, 0);
});
