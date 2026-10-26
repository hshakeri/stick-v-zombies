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
} from '../3d/js/campaign3d.js?v=10.4';
import { speech3d } from '../3d/js/speech3d.js?v=10.3';

import {
  CREATIVE_BLOCK_TYPES_2D,
  drawCreativeBlocks2D,
  getCreativeBlockSprite2D
} from '../2d/arenas2d.js?v=10.0';
import {
  DEPTH_PARALLAX,
  Depth2DRenderer,
  getDepthProfile2D
} from '../2d/depth2d.js?v=10.0';
import {
  STAGE_OPTIONS_2D,
  install2DExpansion
} from '../2d/expansion2d.js?v=10.0';

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
    '2d/depth2d.js',
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
  assert.match(html, /href="2d\/style2d\.css\?v=10\.0"/);
  assert.match(html, /src="2d\/expansion2d\.js\?v=10\.0"/);
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

test('2D Expansion [8] Depth-of-Field, Cached Offscreen Far/Mid Blur, Parallax, Contact Shadows & Foreground Bokeh', () => {
  resetGlobalSystems();

  // 1. Theme depth profiles cover classic, open-edge, and expanded biomes cleanly
  for (const theme of ['desktop', 'minecraft', 'the_end', 'aether', 'ancient_city', 'pale_garden', 'rocket_corp', 'zero_day', 'trophy']) {
    const profile = getDepthProfile2D(theme);
    assert.ok(profile.farTint && profile.midTint && profile.bokehTint, `theme ${theme} must provide full depth palette`);
  }

  // 2. Instrumented offscreen buffer factory verifies ONCE-PER-STAGE blur baking (zero per-frame ctx.filter!)
  const bakeFilterHistory = [];
  const createOffscreenMock = (width, height) => {
    const gradientStub = { addColorStop() {} };
    let currentFilter = 'none';
    const bctx = new Proxy(
      { filter: 'none' },
      {
        get(target, prop) {
          if (prop === 'filter') return currentFilter;
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradientStub;
          if (prop in target) return target[prop];
          return () => {};
        },
        set(target, prop, value) {
          if (prop === 'filter') {
            currentFilter = value;
            if (value !== 'none') bakeFilterHistory.push(value);
            return true;
          }
          target[prop] = value;
          return true;
        }
      }
    );
    return {
      width,
      height,
      getContext: () => bctx
    };
  };

  const liveBlits = [];
  const liveFilterAssignments = [];
  const ellipses = [];
  const liveGradStub = { addColorStop() {} };
  let liveSaves = 0;
  let liveRestores = 0;
  const liveCtx = new Proxy({}, {
    get(target, prop) {
      if (prop === 'save') return () => { liveSaves += 1; };
      if (prop === 'restore') return () => { liveRestores += 1; };
      if (prop === 'drawImage') {
        return (img, dx, dy, dw, dh) => {
          liveBlits.push({ img, dx, dy, dw, dh });
        };
      }
      if (prop === 'ellipse') {
        return (x, y, rx, ry) => {
          ellipses.push({ x, y, rx, ry });
        };
      }
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => liveGradStub;
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      if (prop === 'filter') liveFilterAssignments.push(value);
      target[prop] = value;
      return true;
    }
  });

  const depth = new Depth2DRenderer({ createCanvas: createOffscreenMock });
  const stageStub = {
    currentStage: 21,
    theme: 'pale_garden',
    isTrophyRoom: false,
    stageTime: 1.5,
    crowdedRender: false,
    bounds: { minX: -1200, maxX: 1200, minY: -620 }
  };

  // Frame 1 at camera.x = 0: bakes Far (3.4px blur) + Mid (1.5px blur) offscreen buffers ONCE
  depth.drawBackgroundDepthPlanes(liveCtx, stageStub, { x: 0, y: -140 }, 0, false);
  assert.deepEqual(
    bakeFilterHistory,
    ['blur(3.4px)', 'blur(1.5px)'],
    'Far (3.4px) and Mid (1.5px) depth planes must bake into blurred offscreen buffers on stage load'
  );
  assert.equal(liveFilterAssignments.length, 0, 'live frame ctx must NEVER touch ctx.filter');
  assert.equal(liveBlits.length, 2, 'background depth pass must blit Far and Mid cached buffers');

  // Render 60 consecutive frames while sweeping camera.x -> ZERO additional blur bakes!
  liveBlits.length = 0;
  for (let f = 1; f <= 60; f++) {
    const camX = -300 + f * 10;
    depth.drawBackgroundDepthPlanes(liveCtx, stageStub, { x: camX, y: -140 }, 0, false);
  }
  assert.equal(
    bakeFilterHistory.length,
    2,
    '60 consecutive frames on the same stage must trigger ZERO additional blur bakes'
  );

  // Verify exact parallax rates at camera.x = 500:
  // Far world shift = 500 * (1 - 0.28) = +360; Mid world shift = 500 * (1 - 0.56) = +220
  liveBlits.length = 0;
  depth.drawBackgroundDepthPlanes(liveCtx, stageStub, { x: 500, y: -140 }, 0, false);
  const [farBlit, midBlit] = liveBlits;
  assert.ok(
    Math.abs((farBlit.dx - (-1400)) - 500 * (1 - DEPTH_PARALLAX.FAR)) < 1e-6,
    'Far plane must parallax at 0.28x camera speed'
  );
  assert.ok(
    Math.abs((midBlit.dx - (-1400)) - 500 * (1 - DEPTH_PARALLAX.MID)) < 1e-6,
    'Mid plane must parallax at 0.56x camera speed'
  );

  // Foreground bokeh moves faster than camera (1.28x -> world shift = -0.28 * camX)
  liveBlits.length = 0;
  depth.drawForegroundBokeh(liveCtx, stageStub, { x: 0, y: -140 }, 0, false);
  const bokehXAt0 = liveBlits[0].dx;
  liveBlits.length = 0;
  depth.drawForegroundBokeh(liveCtx, stageStub, { x: 500, y: -140 }, 0, false);
  const bokehXAt500 = liveBlits[0].dx;
  assert.ok(
    Math.abs((bokehXAt500 - bokehXAt0) - 500 * (1 - DEPTH_PARALLAX.FOREGROUND)) < 1e-6,
    'Foreground bokeh must move faster than camera at 1.28x parallax'
  );

  // Reduced effects mode skips Mid plane blit and Foreground bokeh cleanly
  liveBlits.length = 0;
  depth.drawBackgroundDepthPlanes(liveCtx, stageStub, { x: 200, y: -140 }, 0, true);
  depth.drawForegroundBokeh(liveCtx, stageStub, { x: 200, y: -140 }, 0, true);
  assert.equal(liveBlits.length, 1, 'reducedEffects=true must blit only Far plane and skip Mid + Foreground bokeh');

  // Stage transition triggers a single clean re-bake for the new biome
  stageStub.currentStage = 20;
  stageStub.theme = 'ancient_city';
  depth.drawBackgroundDepthPlanes(liveCtx, stageStub, { x: 0, y: -140 }, 0, false);
  assert.equal(bakeFilterHistory.length, 4, 'changing stages must re-bake Far + Mid depth buffers once');
  assert.equal(liveSaves, liveRestores, 'Depth2DRenderer passes must strictly balance save/restore');

  // 3. Entity elevation contact shadows shrink with jump height and snap onto elevated platforms
  ellipses.length = 0;
  const groundedPlayer = { x: 0, y: 0, isDead: false };
  const jumpingPlayer = { x: 100, y: -220, isDead: false };
  const platformRider = { x: 300, y: -160, isDead: false };
  const voidPlunger = { x: 1120, y: 80, isDead: false };
  const platforms = [{ x: 300, y: -140, width: 140, height: 20 }];
  depth.drawEntityContactShadows(
    liveCtx,
    groundedPlayer,
    [jumpingPlayer, platformRider],
    [voidPlunger],
    platforms,
    0,
    true // openEdge = true -> voidPlunger past |x| > 980 casts no floor shadow!
  );
  assert.equal(ellipses.length, 3, 'entity over open-edge void abyss must not cast a phantom floor shadow');
  const jumpShadow = ellipses[0];
  const platShadow = ellipses[1];
  const groundShadow = ellipses[2];
  assert.ok(jumpShadow.rx < groundShadow.rx, 'airborne entity shadow must shrink with height');
  assert.equal(platShadow.y, -160 + 1.5, 'entity above a solid platform must cast its contact shadow onto that platform top');

  // 4. Full integrated 2D game.render() across enclosed, popup, open-edge, and expanded stages
  const { game, controller, calls } = create2DGameHarness();
  for (const stage of [1, 3, 7, 13, 17, 20, 21, 22]) {
    controller.jumpToStage(stage, { freshStart: stage === 1 });
    game.camera.x = 240;
    calls.save = 0;
    calls.restore = 0;
    game.render();
    assert.equal(calls.save, calls.restore, `integrated depth render on Stage ${stage} must balance save/restore`);
    assert.equal(game.reportedLayerErrors.size, 0, `Stage ${stage} depth render must emit zero layer errors`);
  }

  resetGlobalSystems();
});

test('2D Expansion [9] Crisp 16x16 Voxel Block Pixel-Art Textures & Selector Sync', () => {
  resetGlobalSystems();
  const signatures = new Set();

  for (const texKey of CREATIVE_BLOCK_TYPES_2D) {
    const ops = [];
    let smoothingDuringBake = true;
    const sprite = getCreativeBlockSprite2D(texKey, (width, height) => {
      const sctx = {
        fillStyle: '#000',
        imageSmoothingEnabled: true,
        save() {},
        restore() {},
        clearRect() {},
        fillRect(x, y, w, h) {
          smoothingDuringBake = this.imageSmoothingEnabled;
          ops.push(`${this.fillStyle}@${x},${y},${w},${h}`);
        }
      };
      return { width, height, getContext: () => sctx };
    });

    assert.ok(sprite && sprite.width === 64 && sprite.height === 64, `${texKey} must bake a 64x64 (16x16 x 4px) voxel sprite`);
    assert.equal(smoothingDuringBake, false, `${texKey} sprite bake must disable imageSmoothingEnabled for crisp pixels`);
    assert.ok(ops.length >= 256, `${texKey} must paint full 16x16 pixel-art texel grid + details (got ${ops.length} ops)`);

    const sig = ops.join('|');
    assert.ok(!signatures.has(sig), `${texKey} pixel-art texture must be visually distinct from every other block`);
    signatures.add(sig);
  }
  assert.equal(signatures.size, 15, 'all 15 2D Creative voxel block types must produce unique pixel-art textures');

  // Calling placeCreativeBlock() with no explicit arg uses sandbox.selectedBlock and preserves texKey
  const { game, controller } = create2DGameHarness();
  game.startGame({ stage: 1, creative: true });
  controller.sandbox.selectedBlock = 'creaking_heart';
  const placed = controller.placeCreativeBlock();
  assert.equal(placed.texKey, 'creaking_heart', 'placeCreativeBlock() must place the currently selected block texture');

  resetGlobalSystems();
});

test('2D Expansion [10] Creative Mob & Boss Spawner On-Screen Visibility Across All 24 Roster Types & Trophy Room', () => {
  resetGlobalSystems();
  const { game, controller } = create2DGameHarness();
  game.startGame({ stage: 1, creative: true });
  controller.nukeAllEnemies();

  // 1. Default no-arg spawn at Stage 1 entrance (x = -870, facing right) must place CreakingBoss visibly in front of Orange!
  assert.ok(game.player.x < -700, 'player starts near left entrance on Stage 1');
  game.player.facing = 1;
  const defaultBoss = controller.spawnCreativeEntity();
  assert.ok(defaultBoss instanceof CreakingBoss, 'default Creative spawn must create CreakingBoss');
  const distDefault = Math.abs(defaultBoss.x - game.player.x);
  assert.ok(
    defaultBoss.x > game.player.x && distDefault >= 140 && distDefault <= 420,
    `default Creative boss must spawn visibly in front of Orange instead of off-screen (player=${game.player.x}, boss=${defaultBoss.x})`
  );
  const screenPt = game.camera.worldToScreen(defaultBoss.x, defaultBoss.y - 40);
  assert.ok(
    screenPt.x >= 40 && screenPt.x <= 1240,
    `spawned default boss must be immediately inside the 1280px camera viewport (screenX=${screenPt.x})`
  );

  // 2. Every single Creative spawn roster option + legacy aliases spawns visibly near Orange and updates/renders cleanly
  const allSpawnTypes = [
    'creaking_boss', 'warden_boss', 'ender_dragon', 'mercenary_squad',
    'mercenary_agent', 'mercenary_ballista', 'mercenary_primal', 'mercenary_hazard',
    'h4c3r', 'king_orange', 'dark_lord', 'lucky_orb', 'creeper_lord', 'giant_cat', 'titan_boss',
    'walker', 'runner', 'brute', 'shieldbearer', 'crawler', 'boom_bug', 'spitter', 'stalker', 'warden',
    'basic', 'necromancer', 'creeking'
  ];

  for (const spawnType of allSpawnTypes) {
    controller.nukeAllEnemies();
    game.player.x = -620;
    game.player.facing = 1;
    controller.sandbox.selectedSpawn = spawnType;
    const result = controller.spawnCreativeEntity();
    const list = Array.isArray(result) ? result : [result];
    assert.ok(list.length >= 1 && list.every(Boolean), `${spawnType} must spawn at least one live entity`);
    if (spawnType === 'mercenary_squad') {
      assert.equal(list.length, 4, 'mercenary_squad must spawn all 4 Rocket Corp mercenaries');
    }
    for (const ent of list) {
      const dist = Math.abs(ent.x - game.player.x);
      assert.ok(dist <= 480, `${spawnType} entity must spawn within visible range of Orange (dist=${dist})`);
      assert.equal(ent.facing, -1, `${spawnType} spawned to the right of Orange must face toward Orange`);
    }
    game.update(1 / 60);
    game.render();
    assert.equal(game.reportedLayerErrors.size, 0, `${spawnType} must render with zero 2D layer errors`);
  }

  // 3. Spawning near the right wall flips inward so mobs never spawn off-stage or off an island cliff
  controller.nukeAllEnemies();
  game.player.x = 840;
  game.player.facing = 1;
  const inwardMob = controller.spawnCreativeEntity('walker');
  assert.ok(inwardMob.x < game.player.x && inwardMob.x >= -870, 'spawning near right arena boundary must flip inward onto safe floor');
  assert.equal(inwardMob.facing, 1, 'mob spawned to the left of Orange must face right toward Orange');

  // 4. Spawning inside Stage 24 (Trophy Room, where waves start inactive) activates waves and updates spawned mobs
  controller.jumpToStage(24, { creative: true });
  assert.equal(waves.isWaveActive, false, 'Trophy Room starts with waves inactive');
  game.player.x = 0;
  game.player.facing = 1;
  const trophyRunner = controller.spawnCreativeEntity('runner');
  assert.equal(waves.isWaveActive, true, 'Creative spawn in Trophy Room must activate waves so spawned mobs update');
  const startRunnerX = trophyRunner.x;
  game.update(0.1);
  assert.notEqual(trophyRunner.x, startRunnerX, 'spawned Runner in Trophy Room must actively chase Orange when AI is unfrozen');

  resetGlobalSystems();
});
