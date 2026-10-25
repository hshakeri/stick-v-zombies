import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Game } from '../js/main.js?v=9.8';
import { Camera } from '../js/engine/camera.js?v=9.8';
import { input } from '../js/engine/input.js?v=9.8';
import { particles } from '../js/engine/particles.js?v=9.8';
import { speech as speech2d } from '../js/engine/speech.js?v=9.8';
import { Player } from '../js/entities/player.js?v=9.8';
import { projectiles } from '../js/entities/projectiles.js?v=9.8';
import { allies } from '../js/entities/allies.js?v=9.8';
import { weapons } from '../js/entities/weapons.js?v=9.8';
import { StageManager } from '../js/systems/stages.js?v=9.8';
import { waves } from '../js/systems/waves.js?v=9.8';
import { combat } from '../js/systems/combat.js?v=9.8';
import { shop } from '../js/systems/shop.js?v=9.8';

import {
  EnderDragonBoss,
  WardenBoss,
  CreakingBoss,
  MercenaryBoss
} from '../3d/js/campaign3d.js?v=10.3';
import { speech3d } from '../3d/js/speech3d.js?v=10.3';

import {
  CREATIVE_BLOCK_TYPES_2D,
  drawCreativeBlocks2D
} from '../2d/arenas2d.js?v=9.8';
import {
  STAGE_OPTIONS_2D,
  install2DExpansion
} from '../2d/expansion2d.js?v=9.8';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

function createCanvasMock() {
  const calls = { save: 0, restore: 0, fillText: [] };
  const gradientStub = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'save') return () => { calls.save += 1; };
      if (prop === 'restore') return () => { calls.restore += 1; };
      if (prop === 'fillText') return (text) => { calls.fillText.push(String(text)); };
      if (prop === 'measureText') return (text) => ({ width: String(text || '').length * 7 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradientStub;
      }
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
  return { ctx, calls };
}

function create2DGameHarness() {
  const { ctx, calls } = createCanvasMock();
  const game = Object.create(Game.prototype);
  game.canvas = { width: 1280, height: 720, clientWidth: 1280, clientHeight: 720 };
  game.ctx = ctx;
  game.state = 'TITLE';
  game.groundY = 0;
  game.camera = new Camera(game.canvas);
  game.stageManager = new StageManager();
  game.player = new Player(game.stageManager.entranceDoor.x + 30, game.groundY);
  game.hudSyncTimer = 0;
  game.lastStaticRender = 1;
  game.hudCache = {};
  game.reportedErrors = new Set();
  game.reportedLayerErrors = new Set();
  game.hostileTargets = [];
  game.missionStripTimer = 0;
  game.missionStripGrace = 0;
  game.weaponPickup = null;
  game.stageCheckpoint = null;
  game.hideAllModals = () => {};
  game.showModal = () => {};
  game.syncContinueButton = () => {};

  const controller = install2DExpansion(game);
  return { game, controller, ctx, calls };
}

function advanceWaveSpawns(game, seconds = 3.2) {
  const steps = Math.ceil(seconds / 0.1);
  for (let i = 0; i < steps; i++) {
    game.update(0.1);
  }
}

function resetGlobalSystems() {
  input.resetHeldInputs();
  waves.stopWave();
  waves.zombies.length = 0;
  waves.spawnQueue.length = 0;
  waves.bossZombie = null;
  projectiles.reset();
  allies.reset(true, false, false);
  particles.reset();
  speech2d.reset();
  speech3d.reset();
  shop.reset();
  combat.resetRun(50);
}

test('2D Expansion [1] Zero Three.js & Singleton Module Parity: 2D never loads Three.js or remote URLs', () => {
  const filesToAudit = [
    'index.html',
    '2d/style2d.css',
    '2d/expansion2d.js',
    '2d/arenas2d.js',
    '2d/bosses2d.js',
    '3d/js/campaign3d.js',
    '3d/js/physics3d.js',
    '3d/js/speech3d.js'
  ];

  for (const rel of filesToAudit) {
    const content = readFileSync(join(ROOT, rel), 'utf8');
    assert.doesNotMatch(
      content,
      /three\.module|from\s+['"][^'"]*three/i,
      `${rel} must never import Three.js so 2D stays lightweight`
    );
    assert.doesNotMatch(
      content,
      /(?:src|href)=["']https?:\/\/|url\(\s*["']?https?:\/\//i,
      `${rel} must not load remote assets`
    );
  }

  const { controller } = create2DGameHarness();
  assert.equal(
    controller.speech3d,
    speech3d,
    '2D expansion and campaign3d bosses must share the exact same speech3d singleton'
  );
});

test('2D Expansion [2] Prominent Level Selector & Title UI: index.html exposes Creative Mode, Stage Select, and Stages 18–23 pills', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /href="2d\/style2d\.css\?v=9\.8"/);
  assert.match(html, /src="2d\/expansion2d\.js\?v=9\.8"/);
  assert.match(html, /id="btn-start-creative"/);
  assert.match(html, /id="title-stage-select"/);
  for (const stage of [18, 19, 20, 21, 22, 23]) {
    assert.match(html, new RegExp(`data-jump-stage="${stage}"`), `missing quick-jump pill for stage ${stage}`);
  }
  assert.equal(STAGE_OPTIONS_2D.length, 24, 'selector must expose Stages 1–23 plus Stage 24 Trophy Room');
});

test('2D Expansion [3] 23-Stage Campaign + 11-Boss Trophy Room: Rocket Corp precedes Zero-Day and all new stages load cleanly', () => {
  resetGlobalSystems();
  const { game, controller } = create2DGameHarness();

  assert.equal(game.stageManager.maxStage, 23);

  // Verify Stage 18: The End + Ender Dragon
  controller.jumpToStage(18, { freshStart: true });
  advanceWaveSpawns(game, 2.0);
  assert.equal(game.stageManager.currentStage, 18);
  assert.equal(game.stageManager.theme, 'the_end');
  assert.ok(waves.zombies.some((z) => z instanceof EnderDragonBoss), 'Stage 18 must spawn EnderDragonBoss');

  // Verify Stage 19: The Aether + horizontal moving platform axis
  controller.jumpToStage(19);
  assert.equal(game.stageManager.currentStage, 19);
  assert.equal(game.stageManager.theme, 'aether');
  assert.equal(game.stageManager.movingPlatforms[0]?.axis, 'x', 'Gold_Aercloud must move horizontally in 2D');

  // Verify Stage 20: Ancient City + The Warden
  controller.jumpToStage(20);
  advanceWaveSpawns(game, 2.0);
  assert.equal(game.stageManager.currentStage, 20);
  assert.equal(game.stageManager.theme, 'ancient_city');
  assert.equal(game.stageManager.movingPlatforms[0]?.axis, 'x', 'Soul_Lantern_Bridge must move horizontally in 2D');
  assert.ok(waves.zombies.some((z) => z instanceof WardenBoss), 'Stage 20 must spawn WardenBoss');

  // Verify Stage 21: Pale Garden + The Creaking
  controller.jumpToStage(21);
  advanceWaveSpawns(game, 2.0);
  assert.equal(game.stageManager.currentStage, 21);
  assert.equal(game.stageManager.theme, 'pale_garden');
  assert.equal(game.stageManager.movingPlatforms[0]?.axis, 'x', 'Hanging_Moss_Bough must move horizontally in 2D');
  assert.ok(waves.zombies.some((z) => z instanceof CreakingBoss), 'Stage 21 must spawn CreakingBoss');

  // Verify Stage 22: Rocket Corp HQ (4 Mercenaries) immediately precedes Stage 23: Zero-Day (H4C3R)
  controller.jumpToStage(22);
  advanceWaveSpawns(game, 4.0);
  assert.equal(game.stageManager.currentStage, 22);
  assert.equal(game.stageManager.theme, 'rocket_corp');
  const mercs = waves.zombies.filter((z) => z instanceof MercenaryBoss);
  assert.equal(mercs.length, 4, 'Stage 22 must spawn Agent, Ballista, Primal, and Hazard');

  controller.jumpToStage(23);
  advanceWaveSpawns(game, 2.0);
  assert.equal(game.stageManager.currentStage, 23);
  assert.equal(game.stageManager.theme, 'zero_day');
  assert.ok(waves.zombies.some((z) => z.type === 'h4c3r'), 'Stage 23 must spawn H4C3R');

  // Verify Stage 24: Trophy Room Epilogue with all 11 Boss Monuments
  controller.jumpToStage(24);
  assert.equal(game.stageManager.isTrophyRoom, true);
  assert.equal(game.stageManager.desktopIcons.length, 11, 'Trophy Room must honor all 11 campaign bosses');

  resetGlobalSystems();
});

test('2D Expansion [4] Pure 2D Canvas Rendering & Gaze-Freeze: all new arenas, voxel blocks, and bosses balance save/restore', () => {
  resetGlobalSystems();
  const { game, controller, ctx, calls } = create2DGameHarness();

  // Render Stages 7, 18, 19, 20, 21, 22, 23, and 24 through full game.render()
  for (const stage of [7, 18, 19, 20, 21, 22, 23, 24]) {
    controller.jumpToStage(stage, { freshStart: stage === 7 });
    if (stage < 24) advanceWaveSpawns(game, 2.5);
    calls.save = 0;
    calls.restore = 0;
    game.update(1 / 60);
    game.render();
    assert.equal(
      calls.save,
      calls.restore,
      `Stage ${stage} (${game.stageManager.theme}) must balance ctx.save and ctx.restore`
    );
    assert.equal(game.reportedLayerErrors.size, 0, `Stage ${stage} must render with zero layer errors`);
  }

  // Exercise special boss states in 2D Canvas (Warden Sonic Boom, Creaking Gaze-Freeze Statue & Resin Tether)
  controller.jumpToStage(20, { freshStart: true });
  advanceWaveSpawns(game, 2.0);
  const warden = waves.zombies.find((z) => z instanceof WardenBoss);
  assert.ok(warden);
  warden.state = 'sonic_active';
  warden.sonicBeamTimer = 0.25;
  warden.sonicTargetX = 420;
  calls.save = 0;
  calls.restore = 0;
  game.render();
  assert.equal(calls.save, calls.restore, 'Warden sonic_active beam must balance save/restore');

  controller.jumpToStage(21, { freshStart: true });
  advanceWaveSpawns(game, 2.0);
  const creaking = waves.zombies.find((z) => z instanceof CreakingBoss);
  assert.ok(creaking);
  // Look directly toward The Creaking -> triggers Gaze-Freeze ("Don't Blink")!
  game.player.x = -260;
  creaking.x = 180;
  game.player.facing = 1;
  creaking.state = 'idle';
  creaking.actionCooldown = 2.0;
  game.update(0.05);
  assert.equal(creaking.isObserved, true, 'facing The Creaking in 2D must trigger Gaze-Freeze');
  assert.equal(creaking.actionKind, 'creaking_statue', 'watched Creaking must enter creaking_statue actionKind');
  assert.equal(creaking.vx, 0, 'watched Creaking must freeze horizontally like a Pale Oak statue');

  calls.save = 0;
  calls.restore = 0;
  game.render();
  assert.equal(calls.save, calls.restore, 'Creaking Gaze-Freeze statue 2D renderer must balance save/restore');

  // Look away & trigger hurt Resin Heart-Tether -> unfreezes The Creaking!
  game.player.facing = -1;
  creaking.isHurt = true;
  creaking.hurtTimer = 0.25;
  game.update(0.05);
  assert.equal(creaking.isObserved, false, 'looking away unfreezes The Creaking');

  calls.save = 0;
  calls.restore = 0;
  game.render();
  assert.equal(calls.save, calls.restore, 'Creaking 2D renderer + Heart-Tether must balance save/restore');

  // Render all 15 Creative Voxel Block types
  const sampleBlocks = CREATIVE_BLOCK_TYPES_2D.map((texKey, i) => ({
    x: -450 + i * 68,
    y: 0,
    width: 68,
    height: 68,
    texKey,
    fuseTimer: texKey === 'tnt_block' ? 0.4 : undefined
  }));
  calls.save = 0;
  calls.restore = 0;
  drawCreativeBlocks2D(ctx, sampleBlocks, 1.25);
  assert.equal(calls.save, calls.restore, 'All 15 2D Creative voxel block renderers must balance save/restore');

  resetGlobalSystems();
});

test('2D Expansion [5] Creative Sandbox Mode: God Mode, 2D Flight, Freeze AI, 8 Weapons, 15 Blocks, TNT Chain, Lucky Block & Spawner', () => {
  resetGlobalSystems();
  const { game, controller } = create2DGameHarness();
  game.startGame({ stage: 1, creative: true });

  assert.equal(controller.sandbox.enabled, true);
  assert.equal(game.player.isGodMode, true);

  // 1. God Mode prevents damage
  const hpBefore = game.player.hp;
  game.player.takeDamage(75, 1, 400);
  assert.equal(game.player.hp, hpBefore, 'God Mode must block incoming player damage');

  // 2. 2D Flight ascends smoothly when jump/up is held
  controller.sandbox.flight = true;
  input.actions.up = true;
  game.update(0.1);
  input.actions.up = false;
  assert.ok(game.player.y < -20, `2D Flight must ascend upward (got y=${game.player.y})`);

  // 3. Equipping all 8 weapons works cleanly & renders without error
  const allWeapons = [
    'pencil',
    'staff',
    'eraser',
    'toolbar_staff',
    'pixel_bazooka',
    'stone_spear',
    'hazard_sign',
    'vira_blades'
  ];
  for (const w of allWeapons) {
    controller.equipCreativeWeapon(w);
    assert.equal(game.player.weaponType, w);
    assert.ok(weapons.getWeaponStats(w).damage >= 25, `weapon ${w} must have valid stats`);
    game.player.weaponTimer = 0.12;
    game.render();
  }

  // 4. Voxel Block placement, 64-block cap, TNT chain reaction, and Lucky Block cracking
  controller.sandbox.flight = false;
  game.player.y = 0;
  const b1 = controller.placeCreativeBlock('obsidian');
  const b2 = controller.placeCreativeBlock('obsidian');
  assert.equal(b2.y, b1.y - 68, 'placing a second block in the same column must stack cleanly on top');

  for (let i = 0; i < 70; i++) {
    controller.placeCreativeBlock(CREATIVE_BLOCK_TYPES_2D[i % CREATIVE_BLOCK_TYPES_2D.length]);
  }
  assert.equal(controller.sandbox.blocks.length, 64, '2D Creative blocks must enforce lightweight 64-block cap');

  controller.clearCreativeBlocks();
  assert.equal(controller.sandbox.blocks.length, 0);

  // Place two adjacent TNT blocks and detonate the first -> chain-reacts the second + damages nearby enemy!
  game.player.x = 0;
  game.player.facing = 1;
  const tntA = controller.placeCreativeBlock('tnt_block');
  game.player.x = 68;
  const tntB = controller.placeCreativeBlock('tnt_block');
  const dummyEnemy = controller.spawnCreativeEntity('walker');
  dummyEnemy.x = tntA.x + 30;
  dummyEnemy.y = 0;
  const enemyHpBefore = dummyEnemy.hp;

  controller.detonateTNTBlock(tntA);
  assert.ok(dummyEnemy.hp < enemyHpBefore || dummyEnemy.isDead, 'TNT blast must damage nearby zombies');
  assert.ok(tntB.fuseTimer > 0, 'adjacent TNT block must ignite via chain reaction');
  game.update(0.35);
  assert.equal(tntB.broken, true, 'chain-reacted TNT block must detonate when its fuse expires');

  // Crack Lucky Block
  const lucky = controller.placeCreativeBlock('lucky_block');
  controller.crackLuckyBlock(lucky);
  assert.equal(lucky.broken, true);

  // 5. Freeze AI halts zombie movement
  controller.nukeAllEnemies();
  assert.equal(waves.zombies.length, 0);
  const spawnedCreaking = controller.spawnCreativeEntity('creeking'); // alias test!
  assert.ok(spawnedCreaking instanceof CreakingBoss, 'spawning creeking alias must spawn CreakingBoss');
  spawnedCreaking.x = 340;
  controller.sandbox.freezeAI = true;
  game.update(0.1);
  assert.equal(spawnedCreaking.x, 340, 'Freeze AI must pause enemy movement');
  controller.sandbox.freezeAI = false;

  // 6. Summon All Allies, Max Stats & Unlock Exit
  controller.summonAllAllies();
  assert.ok(allies.activeAllies.length >= 6, 'Summon All Allies must deploy the stick squad');
  controller.maxAllStats();
  assert.ok(shop.upgrades.every((u) => u.level === u.maxLevel), 'Max Stats must max every workshop upgrade');
  controller.unlockStageExit();
  assert.equal(game.stageManager.exitDoor.isOpen, true, 'Open Exit must unlock the stage exit portal');

  resetGlobalSystems();
});

test('2D Expansion [6] Swept Platform CCD, Floating Island Void Plunge & Stage 7 Lava Hazards', () => {
  resetGlobalSystems();
  const { game, controller } = create2DGameHarness();

  // 1. Swept Vertical CCD prevents high-velocity tunneling through a Creative block
  game.startGame({ stage: 1, creative: false });
  game.player.x = 0;
  game.player.facing = 1;
  const block = controller.placeCreativeBlock('gold_block'); // top at y = -68
  game.player.x = block.x;
  game.player.y = -110;
  game.player.vy = 2200; // hyper-velocity fall that would skip past a 24px snap band in 1/30s
  game.player.isGrounded = false;
  game.update(1 / 30);
  assert.equal(game.player.y, block.y - block.height, 'Swept CCD must catch hyper-velocity falls cleanly on block top');
  assert.equal(game.player.isGrounded, true);

  // Walking off block edge clears standingPlatform cleanly
  game.player.x = block.x + 200;
  game.update(1 / 60);
  assert.equal(game.player.standingPlatform, null, 'stepping past block edge must clear standingPlatform');

  // 2. Floating Island Void Plunge (Stage 18: The End) for both Player and Non-Flying Enemy
  controller.jumpToStage(18, { freshStart: true, creative: false });
  game.player.x = 1040; // past ISLAND_FLOOR_BOUNDS.halfX (980)
  game.player.y = 10;
  game.player.vy = 600;
  game.player.isGrounded = false;
  const startHp = game.player.hp;

  const walker = controller.spawnCreativeEntity('walker');
  walker.x = 1040;
  walker.y = 10;
  walker.vy = 600;
  walker.isGrounded = false;

  for (let step = 0; step < 25; step++) {
    game.update(1 / 30);
  }
  assert.equal(game.player.hp, startHp - 40, 'falling into the void off a floating island must deal 40 damage');
  assert.ok(Math.abs(game.player.x) <= 980, 'player must respawn safely back onto the floating island');
  assert.equal(game.player.y, 0);
  assert.ok(!waves.zombies.includes(walker), 'non-flying enemy falling off the island cliff must be eliminated');

  // 3. Stage 7 (Minecraft Nether) Floor Lava Hazard Pool burns for 20 HP with normalized 0.75s 2D iFrames
  controller.jumpToStage(7, { freshStart: true, creative: false });
  assert.equal(game.stageManager.lavaHazards.length, 2, 'Stage 7 must feature 2 floor lava pools');
  game.player.x = -360;
  game.player.y = 0;
  game.player.iFrames = 0;
  const hpBeforeLava = game.player.hp;
  game.update(1 / 60);
  assert.equal(game.player.hp, hpBeforeLava - 20, 'stepping into Stage 7 floor lava pool must deal 20 burn damage');
  assert.ok(
    game.player.iFrames > 0 && game.player.iFrames <= 0.8,
    `2D lava iFrames must be normalized in seconds (got ${game.player.iFrames})`
  );

  resetGlobalSystems();
});

test('2D Expansion [7] Expressive 2D Comic Speech Bubbles: banter bridge, boss intros, combo callouts & pure 2D projection', () => {
  resetGlobalSystems();
  const { game, calls } = create2DGameHarness();
  game.startGame({ stage: 21, creative: false });
  advanceWaveSpawns(game, 1.5);

  // Stage 21 CreakingBoss intro should already have spawned a speech3d bubble!
  assert.ok(
    speech3d.activeBubbles.length >= 1,
    'CreakingBoss intro in 2D must populate the shared speech3d bubble manager'
  );

  // Legacy speech2d.spawnBubble() calls from base allies/story bosses bridge into expressive speech3d bubbles
  speech2d.spawnBubble(0, -60, 'WATCH THIS COMBO!', 'ally-red', 2.2, { anchor: game.player, priority: 3, cooldownMs: 0 });
  assert.ok(
    speech3d.activeBubbles.some((b) => String(b.text || '').includes('WATCH THIS COMBO')),
    'speech2d.spawnBubble must bridge into expressive speech3d comic bubbles'
  );

  // 20-Hit Combo milestone triggers shout bubble
  combat.combo = 20;
  combat.comboTimer = 2.0;
  game.update(0.05);
  assert.ok(
    speech3d.activeBubbles.some((b) => String(b.text || '').includes('20 HITS')),
    'reaching 20 hits in 2D must trigger a STICK-TACULAR shout bubble'
  );

  calls.save = 0;
  calls.restore = 0;
  game.render();
  assert.equal(calls.save, calls.restore, 'rendering 2D speech3d comic bubbles must balance ctx.save/restore');

  resetGlobalSystems();
});
