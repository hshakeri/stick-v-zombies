import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { Camera } from '../js/engine/camera.js?v=8.5';
import { IMPACT_PROFILES, SPLATTER_LIMITS, ParticleSystem, particles } from '../js/engine/particles.js?v=8.5';
import {
  BOSS_SPEECH_EVENTS,
  MAX_SPEECH_BUBBLES,
  MAX_SPEECH_CHARS,
  MAX_SPEECH_LINES,
  SPEECH_CORPUS,
  SpeechBubbleManager,
  speech
} from '../js/engine/speech.js?v=8.5';
import { AllyManager, allies } from '../js/entities/allies.js?v=8.5';
import { DarkLord } from '../js/entities/dark_lord.js?v=8.5';
import { H4C3R } from '../js/entities/h4c3r.js?v=8.5';
import { KingOrange } from '../js/entities/king_orange.js?v=8.5';
import { LuckyOrb } from '../js/entities/lucky_orb.js?v=8.5';
import { ATTACK_BUFFER_SECONDS, MOVE_DEFINITIONS, Player } from '../js/entities/player.js?v=8.5';
import { ProjectileManager, projectiles } from '../js/entities/projectiles.js?v=8.5';
import { Zombie } from '../js/entities/zombies.js?v=8.5';
import { weapons } from '../js/entities/weapons.js?v=8.5';
import { combat } from '../js/systems/combat.js?v=8.5';
import { shop } from '../js/systems/shop.js?v=8.5';
import { Game } from '../js/main.js?v=8.5';
import { CAMPAIGN_BEATS, MAX_ENVIRONMENT_DECORATIONS, StageManager } from '../js/systems/stages.js?v=8.5';
import {
  ABSOLUTE_ACTIVE_ENEMY_CAP,
  MAX_BOSS_HELPERS,
  MAX_RECIPE_PACK_SIZE,
  MIN_RECIPE_PACK_SIZE,
  NORMAL_ACTIVE_ENEMY_CAP,
  WAVE_RECIPES,
  WAVE_RECIPE_TOTALS,
  WaveDirector,
  waves
} from '../js/systems/waves.js?v=8.5';

const RELEASE_MODULE_VERSION = '8.5';

function listJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
  });
}

test('browser module graph uses one coherent cache version', () => {
  const jsRoot = fileURLToPath(new URL('../js/', import.meta.url));
  const graphFiles = [...listJavaScriptFiles(jsRoot), fileURLToPath(import.meta.url)];
  const expectedSuffix = `.js?v=${RELEASE_MODULE_VERSION}`;
  const relativeImport = /from\s+['"](\.{1,2}\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g;
  let importCount = 0;

  for (const file of graphFiles) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(relativeImport)) {
      importCount += 1;
      assert.ok(
        match[1].endsWith(expectedSuffix),
        `${file} has an unversioned or mismatched import: ${match[1]}`
      );
    }
  }

  const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  assert.match(html, new RegExp(`js/main\\.js\\?v=${RELEASE_MODULE_VERSION}`));
  assert.ok(importCount >= 60, `expected the complete module graph, found ${importCount} imports`);
});

test('display typography uses an asset-free retro pop-art stack', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const css = readFileSync(join(root, 'css/style.css'), 'utf8');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const canvasSources = [
    readFileSync(join(root, 'js/engine/particles.js'), 'utf8'),
    readFileSync(join(root, 'js/systems/stages.js'), 'utf8')
  ].join('\n');

  assert.match(css, /--font-pop-art:\s*Impact,/);
  assert.doesNotMatch(`${css}\n${html}\n${canvasSources}`, /Permanent Marker|Bungee|cursive/i);
});

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
    readyTimer: 0,
    life: 2.5,
    hasActed: false,
    isAlly: true,
    isTargetable: false,
    retreating: false,
    hurtTimer: 0
  });

  manager.update(0.01, 0, [zombie], null, camera);
  for (let i = 0; i < 5; i += 1) {
    manager.update(0.3, 0, [zombie], null, camera);
  }

  assert.equal(damageCalls, 1);
  assert.equal(manager.activeAllies[0].hasActed, true);
  particles.reset();
});

test('Red and Green have a real vulnerable ready beat before their assists fire', () => {
  particles.reset();
  speech.reset();

  for (const type of ['red', 'green']) {
    const manager = new AllyManager();
    const walker = new Zombie(80, 0, 'walker', 1);
    walker.isGrounded = true;
    let playerHits = 0;
    const player = {
      x: 0, y: 0, isDead: false,
      takeDamage() { playerHits += 1; },
      heal() {}
    };
    const camera = { addShake() {}, addZoomPunch() {} };
    assert.equal(manager.summonAlly(type, player.x, 0, 1, [walker]), true);

    for (let frame = 0; frame < 90 && !manager.recoveryStates[type]; frame += 1) {
      walker.update(1 / 60, 0, player, [], camera, [], [walker], manager.getCombatTargets());
      manager.update(1 / 60, 0, [walker], player, camera);
    }

    assert.equal(manager.recoveryStates[type], true, `${type} should be interceptable before acting`);
    assert.equal(manager.activeAllies[0]?.hasActed, false, `${type} should lose an unsafe assist`);
    assert.equal(playerHits, 0, `${type} should visibly intercept the nearby bite`);
  }

  particles.reset();
  speech.reset();
});

test('runner leap contact can intercept every real stick-ally summon', () => {
  particles.reset();
  speech.reset();

  for (const type of ['red', 'blue', 'yellow', 'green']) {
    const manager = new AllyManager();
    const runner = new Zombie(200, 0, 'runner', 1);
    runner.isGrounded = true;
    let playerHits = 0;
    const player = {
      x: 0, y: 0, isDead: false,
      takeDamage() { playerHits += 1; },
      heal() {}
    };
    const camera = { addShake() {}, addZoomPunch() {} };
    manager.summonAlly(type, 0, 0, 1, [runner]);

    for (let frame = 0; frame < 120 && !manager.recoveryStates[type]; frame += 1) {
      runner.update(1 / 60, 0, player, [], camera, [], [runner], manager.getCombatTargets());
      manager.update(1 / 60, 0, [runner], player, camera);
    }

    assert.equal(manager.recoveryStates[type], true, `${type} should be able to block a runner leap`);
    assert.equal(playerHits, 0);
  }

  particles.reset();
  speech.reset();
});

test('stunning a runner cancels its leap contact instead of delaying the hit', () => {
  const runner = new Zombie(0, -20, 'runner', 1);
  runner.leapActive = true;
  runner.applyStun(0.2);
  assert.equal(runner.leapActive, false);
});

test('ally calls and Yellow turrets stay inside the arena at an outward wall', () => {
  particles.reset();
  const manager = new AllyManager();
  const camera = { addShake() {}, addZoomPunch() {} };
  const player = { heal() {} };

  assert.equal(manager.summonAlly('yellow', 1075, 0, 1, []), true);
  assert.ok(manager.activeAllies[0].x <= 1030);
  for (let frame = 0; frame < 60; frame += 1) {
    manager.update(1 / 60, 0, [], player, camera);
  }

  assert.equal(manager.turrets.length, 1);
  assert.ok(Math.abs(manager.turrets[0].x) <= 1030);

  const cursorManager = new AllyManager();
  assert.equal(cursorManager.summonAlly('cursor', 1075, 0, 1, []), true);
  assert.ok(Math.abs(cursorManager.activeCursors[0].startX) <= 1030);
  particles.reset();
});

test('one zombie hit interrupts an ally and starts one extended recovery', () => {
  particles.reset();
  speech.reset();
  const manager = new AllyManager();
  assert.equal(manager.summonAlly('blue', 0, 0, 1, []), true);
  const ally = manager.activeAllies[0];
  ally.y = -80;
  manager.update(0.01, 0, [], { heal() {} }, { addShake() {} });

  assert.equal(manager.getCombatTargets()[0], ally);
  assert.equal(ally.takeDamage(15, 1), true);
  const recovery = manager.maxCooldowns.blue + 4;
  assert.equal(ally.retreating, true);
  assert.equal(ally.hasActed, false, 'an unsafe summon should lose its pending assist');
  assert.equal(manager.cooldowns.blue, recovery);
  assert.equal(manager.recoveryStates.blue, true);
  assert.equal(manager.getCombatTargets().length, 0);

  assert.equal(ally.takeDamage(15, 1), false);
  assert.equal(manager.cooldowns.blue, recovery, 'the same injury must not stack twice');

  manager.reset(false, true);
  assert.equal(manager.cooldowns.blue, recovery, 'stage cleanup should preserve injury recovery');
  manager.reset(false);
  assert.equal(manager.cooldowns.blue, 0, 'a full reset should clear recovery');
  particles.reset();
  speech.reset();
});

test('a nearby zombie targets an ally and never redirects a stored bite', () => {
  const camera = { addShake() {} };
  let playerHits = 0;
  let allyHits = 0;
  const player = {
    x: 48, y: 0, isDead: false,
    takeDamage() { playerHits += 1; }
  };
  const ally = {
    x: 24, y: 0, isAlly: true, isDead: false,
    isTargetable: true, retreating: false,
    takeDamage() { allyHits += 1; }
  };
  const walker = new Zombie(0, 0, 'walker', 1);
  walker.isGrounded = true;

  walker.update(0.01, 0, player, [], camera, [], [walker], [ally]);
  walker.update(0.3, 0, player, [], camera, [], [walker], [ally]);
  assert.equal(allyHits, 1);
  assert.equal(playerHits, 0);

  const secondWalker = new Zombie(0, 0, 'walker', 1);
  secondWalker.isGrounded = true;
  allyHits = 0;
  secondWalker.update(0.01, 0, player, [], camera, [], [secondWalker], [ally]);
  ally.isTargetable = false;
  ally.retreating = true;
  secondWalker.update(0.3, 0, player, [], camera, [], [secondWalker], [ally]);
  assert.equal(allyHits, 0);
  assert.equal(playerHits, 0, 'a telegraphed ally bite must miss instead of snapping to Orange');
});

test('hostile zombie projectiles can interrupt a targetable ally', () => {
  particles.reset();
  const manager = new ProjectileManager();
  let allyHits = 0;
  const ally = {
    x: 0, y: 0, height: 60, radius: 18,
    isAlly: true, isDead: false, isTargetable: true, retreating: false,
    takeDamage() {
      allyHits += 1;
      this.isTargetable = false;
      this.retreating = true;
    }
  };
  const player = { x: 500, y: 0, isDead: false, isRolling: false, isAwakened: false, takeDamage() {} };
  manager.projectiles.push({
    type: 'acid', x: 0, y: -30, vx: 0, vy: 0,
    radius: 12, damage: 8, isHostile: true, life: 1
  });

  manager.update(0.016, 0, [], player, { addShake() {} }, [ally]);

  assert.equal(allyHits, 1);
  assert.equal(manager.projectiles.length, 0);
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

test('the backing-store ratio obeys ten million pixels on 4K and ultrawide screens', () => {
  for (const [width, height] of [[3840, 2160], [7680, 4320], [10000, 4000]]) {
    const camera = new Camera({ clientWidth: width, clientHeight: height });
    const ratio = camera.getRenderPixelRatio(2);
    const backingWidth = Math.floor(width * ratio);
    const backingHeight = Math.floor(height * ratio);
    assert.ok(backingWidth * backingHeight <= 10_000_000, `${width}x${height} allocated too many pixels`);
    assert.ok(ratio <= 2);
  }
});

test('short-screen camera anchor keeps the ground above touch controls', () => {
  const camera = new Camera({ clientWidth: 667, clientHeight: 375 });
  camera.snapTo({ x: 0, y: 0, facing: 1 });

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
  manager.loadStage(16);

  assert.equal(manager.currentStage, 16);
  assert.equal(manager.maxStage, 16);
  assert.notEqual(manager.stageName, 'Main Desktop');
  assert.notEqual(manager.theme, 'desktop');
});

test('stage 14 advances through Lucky Orb to H4C3R before campaign completion', () => {
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
  const orbResult = manager.resolveStageExit(
    16,
    () => { completions += 1; },
    stage => advancedStages.push(stage)
  );
  manager.currentStage = 16;
  const completionResult = manager.resolveStageExit(
    17,
    () => { completions += 1; },
    stage => advancedStages.push(stage)
  );

  assert.equal(advanceResult, 'advance');
  assert.equal(orbResult, 'advance');
  assert.equal(completionResult, 'complete');
  assert.equal(completions, 1);
  assert.deepEqual(advancedStages, [15, 16]);
});

test('late campaign waves are handcrafted, capped, and route both new bosses', () => {
  for (const stage of [11, 12, 13, 14, 15, 16]) {
    const director = new WaveDirector();
    director.generateWaveQueue(stage);
    assert.ok(director.spawnQueue.length <= 30, `stage ${stage} queued too many enemies`);
    if (stage === 11) assert.ok(director.spawnQueue.some(entry => entry.type === 'king_orange'));
    if (stage === 15) assert.ok(director.spawnQueue.some(entry => entry.type === 'lucky_orb'));
    if (stage === 16) assert.ok(director.spawnQueue.some(entry => entry.type === 'h4c3r'));
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
  manager.loadStage(16);
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
  const bosses = [new KingOrange(10, 0), new LuckyOrb(0, 0), new H4C3R(-10, 0)];
  const { context } = createCanvasContextMock();

  for (const boss of bosses) {
    if (boss.renderer) boss.renderer.draw = () => {};
    assert.equal(boss.isBoss, true);
    assert.ok(Number.isFinite(boss.x));
    assert.ok(Number.isFinite(boss.y));
    assert.ok(Number.isFinite(boss.radius));
    assert.ok(Number.isFinite(boss.maxHp) && boss.maxHp > 0);
    for (let i = 0; i < 10; i += 1) boss.draw(context);
  }

  assert.equal(particles.particles.length, 0);
});

test('Lucky Orb roll and prize drop damage only after their telegraphs and only once', () => {
  const camera = { addShake() {}, addZoomPunch() {}, focusOn() {} };
  for (const hz of [30, 60, 120]) {
    const dt = 1 / hz;
    let rollHits = 0;
    const player = {
      x: 0, y: 0, vx: 0, height: 60, radius: 16,
      isDead: false, isRolling: false, isAwakened: false, iFrames: 0,
      takeDamage() { rollHits += 1; }
    };
    const orb = new LuckyOrb(-420, 0);
    orb.startRoll(player, camera);
    const warning = orb.stateDuration;
    let elapsed = 0;
    while (elapsed + dt < warning) {
      orb.update(dt, 0, player, [], camera);
      elapsed += dt;
    }
    assert.equal(rollHits, 0, `${hz}Hz roll damaged during warning`);
    for (let frame = 0; frame < hz * 2 && orb.state !== 'recovery'; frame += 1) {
      orb.update(dt, 0, player, [], camera);
    }
    assert.equal(rollHits, 1, `${hz}Hz roll should sweep-hit once`);

    let dropHits = 0;
    player.takeDamage = () => { dropHits += 1; };
    orb.x = 420;
    orb.startDrops(player, camera);
    const dropWarning = orb.stateDuration;
    elapsed = 0;
    while (elapsed + dt < dropWarning) {
      orb.update(dt, 0, player, [], camera);
      elapsed += dt;
    }
    assert.equal(dropHits, 0, `${hz}Hz drop damaged during warning`);
    for (let frame = 0; frame < hz * 2 && orb.state !== 'recovery'; frame += 1) {
      orb.update(dt, 0, player, [], camera);
    }
    assert.equal(dropHits, 1, `${hz}Hz prize drop should hit once`);
  }
});

test('Lucky Orb speech follows roll, drop, phase, and defeat events', () => {
  const calls = [];
  const originalShoutBoss = speech.shoutBoss;
  speech.shoutBoss = (...args) => { calls.push(args); return true; };
  try {
    const orb = new LuckyOrb(0, 0);
    const player = { x: 300, y: 0, vx: 0 };
    const camera = { addShake() {}, addZoomPunch() {}, focusOn() {} };
    orb.startRoll(player, camera);
    orb.startDrops(player, camera);
    orb.beginPhaseTwo(camera);
    orb.die();
  } finally {
    speech.shoutBoss = originalShoutBoss;
  }
  assert.deepEqual(calls.map((call) => call[3]), ['roll', 'drop', 'phase', 'defeat']);
  assert.ok(calls.every((call) => call[2] === 'luckyOrb'));
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

test('H4C3R packet dash sweeps across low-frame movement without tunneling', () => {
  const boss = new H4C3R(-935, 0);
  Object.assign(boss, {
    state: 'packet_dash', stateDuration: 0.28, stateTimer: 0.28,
    dashStartX: -935, dashTargetX: 935, dashDirection: 1, attackHit: false
  });
  let hits = 0;
  const player = {
    x: 690, y: 0, isDead: false, isRolling: false, isAwakened: false, iFrames: 0,
    takeDamage() { hits += 1; }
  };
  for (let frame = 0; frame < 6; frame += 1) boss.update(0.05, 0, player, [], null, []);
  assert.equal(hits, 1);
});

test('Dark Lord death clears waves, ViraBots, their darts, and the doom laser', () => {
  projectiles.reset();
  const boss = new DarkLord(0, 0);
  boss.facing = 1;
  const player = { x: 700, y: 0, isDead: false, isRolling: false, isAwakened: false, takeDamage() {} };
  const camera = { addShake() {}, addZoomPunch() {} };

  Object.assign(boss, { state: 'energy_waves', stateTimer: 0, comboStep: 0 });
  boss.updateAI(0.01, 0, player, camera, []);
  Object.assign(boss, { state: 'summon_virabots', stateTimer: 0, isAwakened: false });
  boss.updateAI(0.01, 0, player, camera, []);
  Object.assign(boss, { state: 'doom_laser', stateTimer: 1.3, doomLaserFired: false });
  boss.updateAI(0.01, 0, player, camera, []);
  const bot = projectiles.projectiles.find((effect) => effect.type === 'virabot');
  bot.shootTimer = 0;
  projectiles.update(1 / 60, 0, [], player, camera, []);

  assert.ok(['dark_wave', 'virabot', 'vira_dart', 'doom_laser'].every(
    (type) => projectiles.projectiles.some((effect) => effect.type === type && effect.owner === boss)
  ));
  boss.die();
  assert.equal(projectiles.projectiles.some((effect) => effect.owner === boss), false);
  projectiles.reset();
});

test('Dark Lord resists freeze and briefly pauses attacks when stunned', () => {
  const player = { x: 900, y: 0, isDead: false };
  const normal = new DarkLord(0, 0);
  const frozen = new DarkLord(0, 0);
  normal.state = frozen.state = 'walk';
  assert.equal(frozen.applyFreeze(4), true);
  normal.update(0.1, 0, player, [], null, []);
  frozen.update(0.1, 0, player, [], null, []);
  assert.ok(frozen.x > 0 && frozen.x < normal.x, `${frozen.x} vs ${normal.x}`);

  const stunned = new DarkLord(0, 0);
  stunned.state = 'walk';
  assert.equal(stunned.applyStun(3), true);
  stunned.update(0.1, 0, player, [], null, []);
  assert.equal(stunned.x, 0);
  assert.equal(stunned.state, 'walk', 'stun should pause rather than skip an attack state');
  assert.ok(stunned.stunTimer > 0);
});

test('crawler, shieldbearer, and Boom-Bug have distinct readable counters', () => {
  particles.reset();
  let crawlerHits = 0;
  const crawlerTarget = { x: 100, y: 0, height: 60, isDead: false, takeDamage() { crawlerHits += 1; } };
  const crawler = new Zombie(0, 0, 'crawler', 2);
  crawler.isGrounded = true;
  assert.ok(crawler.maxHp < 35 && crawler.speed > 175 && crawler.height < 35);
  crawler.update(1 / 60, 0, crawlerTarget, [], { addShake() {} }, [], [crawler], []);
  assert.ok(crawler.crawlerDashTimer > 0);
  crawler.x = 75;
  crawler.update(1 / 60, 0, crawlerTarget, [], { addShake() {} }, [], [crawler], []);
  assert.equal(crawlerHits, 1);

  const shield = new Zombie(0, 0, 'shieldbearer', 4);
  shield.facing = 1;
  const fullHp = shield.hp;
  const reportedBlockedDamage = shield.takeDamage(30, -1, 400);
  const blockedDamage = fullHp - shield.hp;
  assert.equal(reportedBlockedDamage, blockedDamage);
  assert.ok(particles.splatterDroplets.length > 0, 'zombie hits should emit comic crimson droplets');
  shield.hp = fullHp;
  shield.takeDamage(30, 1, 400);
  assert.ok(blockedDamage < 10);
  assert.equal(fullHp - shield.hp, 30);
  shield.hp = fullHp;
  shield.takeDamage(60, -1, 700, true);
  assert.equal(fullHp - shield.hp, 60, 'heavy frontal attacks must break through the shield');

  combat.resetRun();
  const rewardPlayer = new Player(-45, 0);
  const rewardShield = new Zombie(0, 0, 'shieldbearer', 4);
  rewardPlayer.facing = 1;
  rewardPlayer.hp = 50;
  rewardPlayer.lifesteal = 0.5;
  rewardShield.facing = -1;
  rewardPlayer.checkMeleeHits([rewardShield], 100, 30, 400, false, '#fff', null);
  assert.equal(combat.score, 7, 'blocked hits award only applied damage');
  assert.equal(rewardPlayer.hp, 53.5, 'Ink Recharge uses applied damage');
  assert.ok(rewardPlayer.superMeter < 2, 'shield blocks most Awakening gain');

  particles.reset();
  const airborne = new Zombie(0, -220, 'crawler', 2);
  airborne.takeDamage(999, 1, 800, true);
  assert.ok(particles.splatterStains.every((stain) => stain.y >= 0), 'floor stamps stay on a surface');

  let burstHits = 0;
  const burstTarget = { x: 80, y: 0, isDead: false, takeDamage() { burstHits += 1; } };
  const boomBug = new Zombie(0, 0, 'boom_bug', 6);
  assert.equal(boomBug.beginHeavyAction('boom_burst'), true);
  boomBug.updateHeavyAction(0.69, [burstTarget], { addShake() {} });
  assert.equal(burstHits, 0);
  boomBug.updateHeavyAction(0.02, [burstTarget], { addShake() {} });
  assert.equal(burstHits, 1);
  assert.equal(boomBug.isDead, true);
  assert.ok(particles.splatterStains.length > 0, 'Boom-Bug defeat should leave a short comic floor stamp');
  particles.reset();
});

test('vector hook gathers every lightweight zombie but leaves runners alone', () => {
  particles.reset();
  const player = new Player(0, 0);
  player.isGrounded = true;
  player.facing = 1;
  const walker = new Zombie(140, 0, 'walker', 1);
  const spitter = new Zombie(190, 0, 'spitter', 1);
  const crawler = new Zombie(240, 0, 'crawler', 2);
  const shieldbearer = new Zombie(290, 0, 'shieldbearer', 4);
  const boomBug = new Zombie(340, 0, 'boom_bug', 6);
  const runner = new Zombie(180, 0, 'runner', 1);
  const pullable = [walker, spitter, crawler, shieldbearer, boomBug];
  const targets = [...pullable, runner];
  const originalHp = targets.map((target) => target.hp);

  assert.equal(player.executeVectorHook(targets, { addShake() {}, addZoomPunch() {} }), true);
  assert.equal(player.hookMode, 'pull');
  assert.ok(pullable.every((target) => target.hookPullTimer > 0));
  assert.equal(runner.hookPullTimer, 0);
  assert.deepEqual(targets.map((target) => target.hp), originalHp, 'the utility hook must deal no damage');

  const before = walker.x;
  walker.update(0.1, 0, player, [], { addShake() {} }, [], targets, []);
  assert.ok(walker.x < before, 'persistent hook movement must survive the zombie AI update');
  particles.reset();
});

test('a heavy zombie reverses the hook and pulls Orange without i-frames', () => {
  particles.reset();
  const player = new Player(0, 0);
  player.isGrounded = true;
  player.facing = 1;
  const spitter = new Zombie(180, 0, 'spitter', 1);
  const brute = new Zombie(320, 0, 'brute', 1);
  const bruteX = brute.x;

  player.executeVectorHook([spitter, brute], { addShake() {}, addZoomPunch() {} });

  assert.equal(player.hookMode, 'anchor');
  assert.equal(player.hookPullTarget, brute);
  assert.equal(spitter.hookPullTimer, 0, 'an anchor must override every lightweight catch');
  assert.equal(player.iFrames, 0);
  assert.equal(brute.x, bruteX, 'the heavy target must never be displaced');
  assert.ok(brute.attackCooldown >= 0.35);

  const previousDistance = Math.abs(brute.x - player.x);
  player.updateReverseHookPull(0.1);
  player.applyPhysics(0.1, 0, []);
  assert.ok(Math.abs(brute.x - player.x) < previousDistance);
  assert.equal(player.iFrames, 0, 'the risky pull must not grant invulnerability');

  for (let frame = 0; frame < 30; frame += 1) {
    player.updateReverseHookPull(1 / 60);
    player.applyPhysics(1 / 60, 0, []);
  }
  assert.equal(player.hookPullTimer, 0);
  assert.equal(player.hookPullTarget, null, 'an expired reverse pull must release its enemy reference');
  particles.reset();
});

test('the hook never pushes close zombies away or pulls them beyond arena edges', () => {
  particles.reset();

  const closePlayer = new Player(0, 0);
  closePlayer.isGrounded = true;
  closePlayer.facing = 1;
  const closeWalker = new Zombie(30, 0, 'walker', 1);
  closeWalker.isGrounded = true;
  closePlayer.executeVectorHook([closeWalker], { addShake() {}, addZoomPunch() {} });
  assert.equal(closeWalker.hookPullTimer, 0);
  assert.equal(closeWalker.x, 30);

  for (const side of [-1, 1]) {
    const edgePlayer = new Player(side * 990, 0);
    edgePlayer.isGrounded = true;
    edgePlayer.facing = side;
    const edgeWalker = new Zombie(side * 1090, 0, 'walker', 1);
    edgeWalker.isGrounded = true;
    edgePlayer.executeVectorHook([edgeWalker], { addShake() {}, addZoomPunch() {} });
    edgeWalker.update(0.1, 0, edgePlayer, [], { addShake() {} }, [], [edgeWalker], []);
    assert.ok(Math.abs(edgeWalker.x) <= 1060, `hooked zombie escaped at x=${edgeWalker.x}`);
  }

  particles.reset();
});

test('story-boss hook latches buffer their next action without interrupting a telegraph', () => {
  particles.reset();
  const player = new Player(0, 0);
  player.isGrounded = true;
  player.facing = 1;
  const storyBoss = {
    x: 300, y: 0, radius: 36, height: 90,
    isBoss: true, isDead: false, actionCooldown: 0
  };

  player.executeVectorHook([storyBoss], { addShake() {}, addZoomPunch() {} });
  assert.ok(storyBoss.actionCooldown >= 0.35);
  assert.equal(player.hookPullTarget, storyBoss);
  particles.reset();
});

test('vector hook draw stays balanced and a miss uses the short cooldown', () => {
  particles.reset();
  const player = new Player(0, 0);
  player.isGrounded = true;
  player.renderer.draw = () => {};
  const { calls, context } = createCanvasContextMock();

  player.executeVectorHook([], { addShake() {}, addZoomPunch() {} });
  player.draw(context);

  assert.equal(player.hookMode, 'miss');
  assert.equal(player.hookCooldown, 1);
  assert.equal(calls.save, calls.restore);
  assert.equal(calls.save, 1);
  particles.reset();
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

test('tablet dialogue stays above the two-row skills and ally HUD', () => {
  const manager = new SpeechBubbleManager(() => 1000);
  manager.spawnBubble(450, 700, 'HOOK READY!', 'player', 1.4, {
    speakerKey: 'tablet-hud',
    cooldownMs: 0
  });
  const { calls, context } = createCanvasContextMock();

  manager.draw(context, null, 900, 720);

  const [, bubbleY] = calls.translate.at(-1);
  assert.ok(bubbleY <= 582, `bubble overlapped the tablet hotbar at y=${bubbleY}`);
});

test('an empty speech layer performs no canvas work', () => {
  const manager = new SpeechBubbleManager();
  const { calls, context } = createCanvasContextMock();

  manager.draw(context, null, 800, 600);

  assert.equal(calls.save, 0);
  assert.equal(calls.restore, 0);
});

function collectStringLeaves(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectStringLeaves(entry, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collectStringLeaves(entry, output));
  return output;
}

test('all 16 Restore Key missions are immutable and put Lucky Orb before H4C3R', () => {
  assert.deepEqual(Object.keys(CAMPAIGN_BEATS).map(Number), Array.from({ length: 16 }, (_, index) => index + 1));
  for (let stage = 1; stage <= 16; stage += 1) {
    const beat = CAMPAIGN_BEATS[stage];
    assert.ok(Object.isFrozen(beat), `stage ${stage} metadata must be immutable`);
    for (const key of ['act', 'mission', 'clearText', 'clue']) {
      assert.ok(typeof beat[key] === 'string' && beat[key].length > 0, `stage ${stage} is missing ${key}`);
    }
  }

  assert.match(CAMPAIGN_BEATS[3].clue, /H4C3R/);
  assert.match(CAMPAIGN_BEATS[8].clue, /H4C3R/);
  assert.match(CAMPAIGN_BEATS[14].clue, /H4C3R/);
  assert.equal(CAMPAIGN_BEATS[10].bossLabel, 'DARK LORD // BACKUP');
  assert.equal(CAMPAIGN_BEATS[11].bossLabel, 'KING ORANGE // REPLAY');
  assert.equal(CAMPAIGN_BEATS[15].bossLabel, 'THE LUCKY ORB');
  assert.equal(CAMPAIGN_BEATS[16].bossLabel, 'H4C3R');
});

test('authored wave recipes match every campaign total and pack budget', () => {
  assert.equal(ABSOLUTE_ACTIVE_ENEMY_CAP, 12);
  assert.equal(NORMAL_ACTIVE_ENEMY_CAP, 8);
  assert.equal(MAX_BOSS_HELPERS, 4);

  for (let stage = 1; stage <= 16; stage += 1) {
    const recipe = WAVE_RECIPES[stage];
    assert.ok(Object.isFrozen(recipe), `stage ${stage} recipe must be immutable`);
    assert.equal(recipe.total, WAVE_RECIPE_TOTALS[stage]);
    assert.equal(recipe.packs.flatMap((pack) => pack.enemies).length, recipe.total);
    assert.ok(recipe.bossHelpers <= MAX_BOSS_HELPERS);
    for (const pack of recipe.packs) {
      assert.ok(pack.gap >= 0.9 && pack.gap <= 1.2, `stage ${stage} has an invalid breather`);
      if (pack.bossOnly) assert.equal(pack.enemies.length, 1);
      else assert.ok(
        pack.enemies.length >= MIN_RECIPE_PACK_SIZE && pack.enemies.length <= MAX_RECIPE_PACK_SIZE,
        `stage ${stage} pack size escaped 3-5`
      );
    }
  }

  assert.deepEqual(WAVE_RECIPES[5].packs[0].enemies, ['titan_boss', 'runner', 'spitter', 'runner']);
  assert.deepEqual(WAVE_RECIPES[10].packs[0].enemies, ['dark_lord', 'runner', 'spitter', 'runner', 'brute']);
  assert.deepEqual(WAVE_RECIPES[11].packs[0].enemies, ['king_orange']);
  assert.deepEqual(WAVE_RECIPES[15].packs[0].enemies, ['lucky_orb']);
  assert.deepEqual(WAVE_RECIPES[16].packs[0].enemies, ['h4c3r']);

  const firstStageWith = (type) => Array.from({ length: 16 }, (_, index) => index + 1).find(
    (stage) => WAVE_RECIPES[stage].packs.some((pack) => pack.enemies.includes(type))
  );
  assert.equal(firstStageWith('crawler'), 2);
  assert.equal(firstStageWith('shieldbearer'), 4);
  assert.equal(firstStageWith('boom_bug'), 6);
  assert.equal(WAVE_RECIPE_TOTALS[1], 6);
  assert.equal(WAVE_RECIPE_TOTALS[14], 20);
  assert.equal(Object.values(WAVE_RECIPE_TOTALS).reduce((sum, total) => sum + total, 0), 168);
});

test('boss and ally copy stays inside the terse readable speech contract', () => {
  const lines = collectStringLeaves(SPEECH_CORPUS);
  assert.ok(lines.length >= 70);
  assert.ok(lines.every((line) => line.length <= MAX_SPEECH_CHARS));
  assert.equal(MAX_SPEECH_CHARS, 24);
  assert.equal(MAX_SPEECH_LINES, 2);
  assert.equal(MAX_SPEECH_BUBBLES, 3);

  for (const [boss, events] of Object.entries(BOSS_SPEECH_EVENTS)) {
    assert.ok(events.includes('intro') && events.includes('defeat'));
    assert.ok(events.every((event) => Array.isArray(SPEECH_CORPUS[boss]?.[event])));
  }

  const manager = new SpeechBubbleManager(() => 1000);
  for (let index = 0; index < 5; index += 1) {
    manager.spawnBubble(index * 10, 0, `BUBBLE ${index}`, `speaker-${index}`, 1.2, { cooldownMs: 0 });
  }
  assert.equal(manager.bubbles.length, MAX_SPEECH_BUBBLES);
});

test('move records preserve combo damage and contact once at 30, 60, and 120Hz', () => {
  assert.equal(ATTACK_BUFFER_SECONDS, 0.12);
  const comboDamage = MOVE_DEFINITIONS.combo.reduce((sum, move) => sum + move.damage, 0);
  assert.ok(Math.abs(comboDamage - 212.3) / 212.3 <= 0.05);

  for (const definition of [...MOVE_DEFINITIONS.combo, MOVE_DEFINITIONS.uppercut, MOVE_DEFINITIONS.airFlurry]) {
    assert.ok(definition.contactTime > 0 && definition.contactTime < definition.duration);
    assert.ok(['light', 'medium', 'heavy'].includes(definition.impactTier));
    assert.ok(Object.isFrozen(definition));
  }

  for (const hz of [30, 60, 120]) {
    particles.reset();
    combat.resetRun();
    const player = new Player(0, 0);
    player.isGrounded = true;
    let hits = 0;
    const target = {
      x: 74, y: 0, radius: 18, height: 60, isDead: false,
      takeDamage() { hits += 1; }
    };
    const camera = { addHitstop() {}, addZoomPunch() {} };
    assert.equal(player.executeLightCombo([target], camera), true);
    const step = 1 / hz;
    while (player.activeMove.elapsed + step < MOVE_DEFINITIONS.combo[0].contactTime) {
      player.updateActiveMove(step);
    }
    assert.equal(hits, 0, `${hz}Hz hit before contact`);
    player.updateActiveMove(step);
    assert.equal(hits, 1, `${hz}Hz missed its contact frame`);
    for (let frame = 0; frame < Math.ceil(MOVE_DEFINITIONS.combo[0].duration * hz) + 3; frame += 1) {
      player.updateActiveMove(step);
    }
    assert.equal(hits, 1, `${hz}Hz applied contact more than once`);
  }
  particles.reset();
});

test('the 120ms attack buffer expires early presses and accepts late presses', () => {
  const target = { x: 70, y: 0, radius: 18, height: 60, isDead: false, takeDamage() {} };
  const camera = { addHitstop() {}, addZoomPunch() {} };

  const early = new Player(0, 0);
  early.executeLightCombo([target], camera);
  early.bufferCombatMove('attack');
  early.updateActiveMove(0.13);
  early.updateActiveMove(0.08);
  early.updateActiveMove(0.01);
  assert.equal(early.comboStep, 1, 'an old press must not survive the complete recovery');

  const late = new Player(0, 0);
  late.currentZombies = [target];
  late.currentCamera = camera;
  late.executeLightCombo([target], camera);
  late.updateActiveMove(0.1);
  late.bufferCombatMove('attack');
  late.updateActiveMove(0.08);
  late.updateActiveMove(0.01);
  assert.equal(late.comboStep, 2, 'a press inside the final 120ms should start the next move');
});

test('target assistance is forward-only, limited to 100 units, and steps at most 36', () => {
  const player = new Player(0, 0);
  player.facing = 1;
  player.applyTargetAssist([{ x: 180, y: 0, isDead: false }], 155);
  assert.equal(player.x, 0, 'a distant target must not receive assistance');
  player.applyTargetAssist([{ x: -40, y: 0, isDead: false }], 155);
  assert.equal(player.x, 0, 'a target behind Orange must not receive assistance');
  player.applyTargetAssist([{ x: 100, y: 0, isDead: false }], 95);
  assert.ok(player.x > 0 && player.x <= 36);
});

test('impact-tier hitstop never promotes a medium critical move to heavy', () => {
  particles.reset();
  const player = new Player(0, 0);
  const durations = [];
  const camera = { addHitstop(value) { durations.push(value); }, addZoomPunch() {} };
  const target = { x: 60, y: 0, radius: 18, height: 60, isDead: false, takeDamage() {} };
  player.checkMeleeHits([target], 100, 45, 500, true, '#fff', camera, false, { impactTier: 'medium' });
  assert.deepEqual(durations, [0.025]);
  particles.reset();
});

test('Dark Lord teleport follow-up shows its blade cue before contact damage', () => {
  particles.reset();
  speech.reset();
  const boss = new DarkLord(0, 0);
  boss.facing = 1;
  let hits = 0;
  const player = {
    x: 55, y: 0, isDead: false, isRolling: false, isAwakened: false,
    takeDamage() { hits += 1; }
  };
  boss.startBladeCombo(player, { addZoomPunch() {}, addShake() {} });
  boss.updateAI(0.219, 0, player, { addShake() {} }, []);
  assert.equal(hits, 0);
  boss.updateAI(0.002, 0, player, { addShake() {} }, []);
  assert.equal(hits, 1);
  assert.equal(boss.getActionPhase(), 0.55, 'the contact pose must be visible when damage lands');
  particles.reset();
  speech.reset();
});

test('boss area attacks interrupt only spatially exposed allies while pursuing Orange', () => {
  const player = { x: -700, y: 0, isDead: false, isRolling: false, isAwakened: false, iFrames: 0, takeDamage() {} };
  const camera = { addShake() {}, addHitstop() {}, addZoomPunch() {} };

  let darkHits = 0;
  const darkAlly = { x: 40, y: 0, height: 60, isTargetable: true, isDead: false, retreating: false, takeDamage() { darkHits += 1; } };
  const dark = new DarkLord(0, 0);
  dark.state = 'meteor_slam';
  dark.y = 0;
  dark.update(0.01, 0, player, [], camera, [], [], [darkAlly]);
  assert.equal(darkHits, 1);

  let bracketHits = 0;
  const bracketAlly = { x: 350, y: 0, height: 60, isTargetable: true, isDead: false, retreating: false, takeDamage() { bracketHits += 1; } };
  const hacker = new H4C3R(0, 0);
  hacker.friendlyTargets = [bracketAlly];
  hacker.safeGapX = 0;
  hacker.safeGapHalf = 120;
  hacker.resolveBracketHit(player);
  assert.equal(bracketHits, 1);

  let beamHits = 0;
  const beamAlly = { x: 180, y: 0, height: 60, isTargetable: true, isDead: false, retreating: false, takeDamage() { beamHits += 1; } };
  hacker.friendlyTargets = [beamAlly];
  hacker.friendlyHits.length = 0;
  hacker.attackHit = false;
  hacker.facing = 1;
  hacker.beamY = -30;
  hacker.resolveBeamHit(player);
  hacker.resolveBeamHit(player);
  assert.equal(beamHits, 1);
});

test('brute and Titan damage cannot occur before their warning completes', () => {
  for (const [type, kind, warning] of [
    ['brute', 'brute_slam', 0.55],
    ['titan_boss', 'titan_smash', 0.75]
  ]) {
    particles.reset();
    const enemy = new Zombie(0, 0, type, type === 'titan_boss' ? 5 : 4);
    let hits = 0;
    const target = { x: 40, y: 0, isDead: false, takeDamage() { hits += 1; } };
    assert.equal(enemy.beginHeavyAction(kind), true);
    enemy.updateHeavyAction(warning - 0.001, [target], { addShake() {} });
    assert.equal(hits, 0, `${type} damaged during windup`);
    enemy.updateHeavyAction(0.002, [target], { addShake() {} });
    assert.equal(hits, 1, `${type} did not hit at the active frame`);
    enemy.updateHeavyAction(0.5, [target], { addShake() {} });
    assert.equal(hits, 1, `${type} hit more than once`);
  }
  particles.reset();
});

test('moving platforms carry Orange and ordinary enemies use bounded glitch hops', () => {
  const platform = { x: 0, y: -80, width: 180, height: 20 };
  const player = new Player(0, -100);
  player.platforms = [platform];
  player.isGrounded = true;
  player.standingPlatform = platform;
  player.standingPlatformX = 0;
  player.standingPlatformY = -80;
  platform.x = 25;
  platform.y = -86;
  player.applyPhysics(0, 0, []);
  assert.equal(player.x, 25);
  assert.equal(player.y, -106);

  const walker = new Zombie(0, 0, 'walker', 3);
  walker.isGrounded = true;
  walker.glitchHopCooldown = 0;
  assert.equal(walker.tryGlitchHop({ x: 180, y: -90 }, walker.speed), true);
  assert.ok(walker.vy < 0 && walker.glitchHopCooldown >= 1.65);
  assert.equal(walker.tryGlitchHop({ x: 180, y: -90 }, walker.speed), false);
  walker.x = 2000;
  walker.vx = 100;
  walker.applyPhysics(0.016, 0, []);
  assert.ok(Math.abs(walker.x) <= 1060);
});

test('swept projectiles hit once even when a low frame skips across a target', () => {
  particles.reset();
  const manager = new ProjectileManager();
  let hits = 0;
  const target = {
    x: 0, y: 0, radius: 18, height: 60, isDead: false,
    takeDamage() { hits += 1; }
  };
  manager.projectiles.push({
    type: 'javelin', x: -320, y: -30, vx: 3200, vy: 0,
    radius: 20, damage: 40, pierce: 0, isHostile: false, life: 1
  });
  manager.update(0.2, 0, [target], null, { addShake() {} });
  assert.equal(hits, 1);
  assert.equal(manager.projectiles.length, 0);
  particles.reset();
});

test('all projectile, combatant, hazard, and prop pools enforce their hard caps', () => {
  const manager = new ProjectileManager();
  for (let index = 0; index < 80; index += 1) {
    manager.addProjectile({ type: 'hostile', x: 0, y: 0, vx: 0, vy: 0, isHostile: true, life: 1 });
  }
  assert.equal(manager.countHostileProjectiles(), 32);
  for (let index = 0; index < 100; index += 1) {
    manager.addProjectile({ type: 'friendly', x: 0, y: 0, vx: 0, vy: 0, isHostile: false, life: 1 });
  }
  assert.equal(manager.projectiles.length, 64);
  manager.reset();

  for (let index = 0; index < 8; index += 1) manager.spawnViraBot(index * 5, 0, 1);
  assert.equal(manager.countVirabots(), 4);
  for (let index = 0; index < 20; index += 1) {
    manager.addAcidPool({ x: index, y: 0, radius: 20, duration: 1, maxDuration: 1, tickTimer: 0 });
    manager.spawnSketchBlock(index, 0);
  }
  assert.equal(manager.hazards.length, 12);
  assert.equal(manager.sketchBlocks.length, 8);
  manager.reset();
});

test('ViraBots join the shared hostile target contract and ink drops cap at 32', () => {
  const manager = new ProjectileManager();
  manager.spawnViraBot(0, 0, 1);
  const output = [{ type: 'walker' }];
  assert.equal(manager.collectHostileTargets(output), output);
  assert.equal(output.length, 2);
  assert.equal(output[1].type, 'virabot');

  combat.resetRun();
  for (let index = 0; index < 50; index += 1) combat.spawnInkDrop(index, 0, 1);
  assert.equal(combat.inkDrops.length, 32);
  manager.reset();
  combat.resetRun(50);
});

test('Dark Lord helpers are phase-gated and never exceed four', () => {
  const director = new WaveDirector();
  director.currentWave = 10;
  director.generateWaveQueue(10);
  assert.equal(director.spawnQueue[0].type, 'dark_lord');
  assert.equal(director.spawnQueue[0].bossHealthGate, null);
  assert.deepEqual(director.spawnQueue.slice(1).map((entry) => entry.bossHealthGate), [0.72, 0.72, 0.42, 0.42]);
});

test('temporary staff and eraser pickups alter W briefly, then restore the pencil', () => {
  const staffPlayer = new Player(0, 0);
  assert.equal(staffPlayer.equipTemporaryWeapon('staff', 18), true);
  staffPlayer.executeWeaponAttack([], { addHitstop() {} });
  assert.ok(staffPlayer.activeMove.definition.range > 150);
  assert.ok(staffPlayer.activeMove.definition.duration <= 0.29);

  const eraserPlayer = new Player(0, 0);
  assert.equal(eraserPlayer.equipTemporaryWeapon('eraser', 0.01), true);
  eraserPlayer.executeWeaponAttack([], { addHitstop() {} });
  assert.equal(eraserPlayer.activeMove.stun, 0.65);
  assert.equal(eraserPlayer.activeMove.definition.impactTier, 'heavy');
  eraserPlayer.activeMove = null;
  eraserPlayer.weaponTimer = 0;
  eraserPlayer.update(0.02, { actions: {} }, 0, [], [], { addShake() {} }, []);
  assert.equal(eraserPlayer.weaponType, 'pencil');
});

test('successful ally casts use normal cooldowns and Yellow breaks after three hits', () => {
  particles.reset();
  speech.reset();
  const manager = new AllyManager();
  const near = { x: 400, y: 0, isDead: false, applyFreeze() { this.frozen = true; } };
  const far = { x: 650, y: 0, isDead: false, applyFreeze() { this.frozen = true; } };
  assert.equal(manager.summonAlly('blue', 0, 0, 1, [near, far]), true);
  for (let frame = 0; frame < 90 && !manager.activeAllies[0]?.hasActed; frame += 1) {
    manager.update(1 / 60, 0, [near, far], { heal() {}, x: 0, y: 0 }, { addShake() {} });
  }
  assert.equal(near.frozen, true);
  assert.equal(far.frozen, undefined);
  assert.equal(manager.recoveryStates.blue, false);
  assert.ok(manager.cooldowns.blue <= manager.maxCooldowns.blue);

  manager.reset();
  manager.summonAlly('yellow', 0, 0, 1, []);
  for (let frame = 0; frame < 90 && manager.turrets.length === 0; frame += 1) {
    manager.update(1 / 60, 0, [], { heal() {} }, { addShake() {} });
  }
  const turret = manager.turrets[0];
  assert.ok(turret.duration <= 12 && turret.duration > 11.9);
  assert.equal(turret.takeDamage(99), true);
  assert.equal(turret.takeDamage(99), true);
  assert.equal(turret.isDead, false);
  assert.equal(turret.takeDamage(99), true);
  assert.equal(turret.isDead, true);
  particles.reset();
  speech.reset();
});

test('impact profiles, deterministic speedlines, and every effect pool stay bounded', () => {
  assert.equal(IMPACT_PROFILES.light.sparks, 4);
  assert.equal(IMPACT_PROFILES.medium.sparks, 8);
  assert.equal(IMPACT_PROFILES.medium.hitstop, 0.025);
  assert.equal(IMPACT_PROFILES.heavy.sparks, 14);
  assert.equal(IMPACT_PROFILES.heavy.hitstop, 0.05);

  const first = new ParticleSystem();
  const second = new ParticleSystem();
  const speedlineOptions = { x: 110, y: -40, duration: 2, count: 99, seed: 4242, boss: true };
  const one = first.triggerSpeedlines(speedlineOptions);
  const two = second.triggerSpeedlines(speedlineOptions);
  assert.deepEqual(one, two);
  assert.equal(one.angles.length, 24);
  assert.equal(first.speedlinesMax, 0.3);

  first.setLoadProfile('low');
  for (let index = 0; index < 80; index += 1) {
    first.emitImpact('heavy', index, 0);
    first.addDamageText(0, 0, 10);
    first.addComicPopup(0, 0);
    first.createStickLimbExplosion(0, 0);
  }
  assert.ok(first.particles.length <= 220);
  assert.ok(first.slashArcs.length <= 12);
  assert.ok(first.shockwaves.length <= 8);
  assert.ok(first.damageTexts.length <= 25);
  assert.ok(first.comicPopups.length <= 6);
  assert.ok(first.limbDebris.length <= 24);
});

test('comic splatter is deterministic, bounded, pure to draw, and parent-toggleable', () => {
  const first = new ParticleSystem();
  const second = new ParticleSystem();
  const options = { profile: 'defeat', groundY: 0, direction: 1, seed: 4242 };
  first.emitSplatter(10, -35, options);
  second.emitSplatter(10, -35, options);
  assert.deepEqual(first.splatterDroplets, second.splatterDroplets);
  assert.deepEqual(first.splatterStains, second.splatterStains);

  for (let index = 0; index < 80; index += 1) {
    first.emitSplatter(index, -20, { profile: 'defeat', groundY: 0, seed: index });
  }
  assert.equal(SPLATTER_LIMITS.droplets, 48);
  assert.equal(SPLATTER_LIMITS.stains, 12);
  assert.ok(first.splatterDroplets.length <= SPLATTER_LIMITS.droplets);
  assert.ok(first.splatterStains.length <= SPLATTER_LIMITS.stains);

  const beforeDraw = JSON.stringify([first.splatterDroplets, first.splatterStains]);
  const { context, calls } = createCanvasContextMock();
  first.draw(context);
  assert.equal(JSON.stringify([first.splatterDroplets, first.splatterStains]), beforeDraw);
  assert.equal(calls.save, calls.restore);

  assert.equal(first.setSplatterEnabled(false), false);
  assert.equal(first.splatterDroplets.length, 0);
  assert.equal(first.splatterStains.length, 0);
  assert.deepEqual(first.emitSplatter(0, 0, options), { droplets: 0, stains: 0 });
  assert.equal(first.setSplatterEnabled(true), true);

  const root = fileURLToPath(new URL('../', import.meta.url));
  assert.match(readFileSync(join(root, 'index.html'), 'utf8'), /id="btn-splatter-toggle"[^>]+aria-pressed="true"/);
  assert.match(readFileSync(join(root, 'js/main.js'), 'utf8'), /setSplatterEnabled/);
});

test('stage environments are deterministic, two-layered, and capped at 24 motifs', () => {
  const first = new StageManager();
  first.loadStage(14);
  const snapshot = first.environmentDecorations.map((entry) => ({ ...entry }));
  const second = new StageManager();
  second.loadStage(14);
  assert.equal(snapshot.length, MAX_ENVIRONMENT_DECORATIONS);
  assert.deepEqual(snapshot, second.environmentDecorations);
  assert.deepEqual(new Set(snapshot.map((entry) => entry.layer)), new Set([0, 1]));
  assert.equal(first.stageTime, 0);
});

test('retry preserves progression and upgrades while clearing transient combat state', () => {
  const game = Object.create(Game.prototype);
  const originalStartWave = waves.startWave;
  const originalUpgradeLevel = shop.upgrades[0].level;
  let restartedStage = null;
  try {
    game.stageManager = {
      currentStage: 7,
      entranceDoor: { x: -930 },
      loadStage(stage) { this.currentStage = stage; this.entranceDoor = { x: -930 }; }
    };
    game.player = new Player(400, -30);
    game.player.maxHp = 140;
    game.player.hp = 0;
    game.player.damageMultiplier = 1.4;
    game.player.superMeter = 100;
    game.player.comboStep = 4;
    game.player.activeMove = { stale: true };
    game.player.jumpBuffer = 0.1;
    game.player.coyoteTimer = 0.1;
    game.player.isCrouching = true;
    game.player.isWallSliding = true;
    game.player.ghostTrailTimer = 0.1;
    game.camera = { snapTo() {}, clearTransient() {} };
    game.groundY = 0;
    game.reportedLayerErrors = new Set(['old']);
    game.hideAllModals = () => {};
    game.showMissionStrip = () => {};
    shop.upgrades[0].level = 2;
    combat.ink = 123;
    combat.score = 4567;
    combat.totalKills = 22;
    combat.maxCombo = 17;
    combat.combo = 8;
    combat.inkDrops.push({ value: 2 });
    projectiles.projectiles.push({ type: 'stale', life: 1 });
    projectiles.hazards.push({ duration: 1 });
    allies.activeAllies.push({ type: 'red' });
    speech.bubbles.push({ text: 'stale' });
    particles.particles.push({ life: 1 });
    waves.startWave = (stage) => { restartedStage = stage; };

    game.retryStage();

    assert.equal(restartedStage, 7);
    assert.equal(game.player.hp, 140);
    assert.equal(game.player.damageMultiplier, 1.4);
    assert.equal(game.player.superMeter, 0);
    assert.equal(game.player.comboStep, 0);
    assert.equal(game.player.activeMove, null);
    assert.equal(game.player.jumpBuffer, 0);
    assert.equal(game.player.coyoteTimer, 0);
    assert.equal(game.player.isCrouching, false);
    assert.equal(game.player.isWallSliding, false);
    assert.equal(game.player.ghostTrailTimer, 0);
    assert.equal(combat.ink, 123);
    assert.equal(combat.score, 4567);
    assert.equal(combat.totalKills, 22);
    assert.equal(combat.maxCombo, 17);
    assert.equal(combat.combo, 0);
    assert.equal(shop.upgrades[0].level, 2);
    assert.equal(projectiles.projectiles.length, 0);
    assert.equal(projectiles.hazards.length, 0);
    assert.equal(allies.activeAllies.length, 0);
    assert.equal(speech.bubbles.length, 0);
    assert.equal(particles.particles.length, 0);
    assert.equal(game.weaponPickup.type, 'staff');
    assert.equal(game.stageCheckpoint.stage, 7);
    assert.equal(game.stageCheckpoint.ink, 123);
  } finally {
    waves.startWave = originalStartWave;
    shop.upgrades[0].level = originalUpgradeLevel;
    projectiles.reset();
    allies.reset();
    speech.reset();
    particles.reset();
    combat.resetRun(50);
  }
});

test('throwing world renderers cannot stop later layers or Orange fallback drawing', () => {
  const { calls, context } = createCanvasContextMock();
  let fallbackStrokes = 0;
  context.stroke = () => { fallbackStrokes += 1; };
  const game = Object.create(Game.prototype);
  const order = [];
  const patches = [
    [projectiles, 'draw', () => order.push('projectiles')],
    [combat, 'draw', () => order.push('combat')],
    [waves, 'draw', () => order.push('enemies')],
    [waves, 'drawScreenIndicators', () => order.push('enemy-guides')],
    [allies, 'draw', () => order.push('allies')],
    [particles, 'draw', () => order.push('effects')],
    [speech, 'draw', () => order.push('speech')]
  ];
  const originals = patches.map(([owner, key]) => [owner, key, owner[key]]);
  const originalConsoleError = console.error;
  try {
    for (const [owner, key, replacement] of patches) owner[key] = replacement;
    console.error = () => {};
    game.canvas = { clientWidth: 800, clientHeight: 600 };
    game.ctx = context;
    game.groundY = 0;
    game.state = 'PLAYING';
    game.lastStaticRender = 1;
    game.hudSyncTimer = 0;
    game.reportedErrors = new Set();
    game.reportedLayerErrors = new Set();
    game.syncHUD = () => {};
    game.weaponPickup = null;
    game.player = { x: 0, y: 0, draw(ctx) { ctx.save(); throw new Error('player failed'); } };
    game.stageManager = {
      currentStage: 3,
      stageTime: 0,
      draw() { throw new Error('background failed'); },
      drawScreenGuide() { order.push('stage-guide'); }
    };
    game.camera = {
      apply(ctx) { ctx.save(); },
      restore(ctx) { ctx.restore(); }
    };

    game.render();

    assert.ok(order.includes('projectiles'));
    assert.ok(order.includes('effects'));
    assert.ok(order.includes('stage-guide'));
    assert.equal(order.at(-1), 'speech');
    assert.equal(fallbackStrokes, 1);
    assert.equal(calls.save, calls.restore, 'a failed layer must leave a valid canvas transform');
    assert.equal(game.reportedLayerErrors.size, 2);
  } finally {
    console.error = originalConsoleError;
    for (const [owner, key, original] of originals) owner[key] = original;
  }
});

test('the release stays asset-free and under the 500KB source budget', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const sourceFiles = [
    join(root, 'index.html'),
    join(root, 'css/style.css'),
    ...listJavaScriptFiles(join(root, 'js'))
  ];
  const bytes = sourceFiles.reduce((sum, file) => sum + Buffer.byteLength(readFileSync(file, 'utf8')), 0);
  assert.ok(bytes < 500_000, `combined source is ${bytes} bytes`);

  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const css = readFileSync(join(root, 'css/style.css'), 'utf8');
  assert.doesNotMatch(`${html}\n${css}`, /(?:src|href)=["']https?:\/\//i, 'the game must not download fonts or heavy assets');
  assert.doesNotMatch(css, /url\(\s*["']?https?:\/\//i);
  assert.doesNotMatch(css, /@import/i);
});
