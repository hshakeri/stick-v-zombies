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
  MercenaryBoss,
  OVERWORLD_OUTPOST_BLOCKS,
  formatAttackerDeathMessage,
  formatProjectileDeathMessage,
  resolvePlayerDeathCause
} from '../3d/js/campaign3d.js?v=10.7';
import { speech3d } from '../3d/js/speech3d.js?v=10.3';

import {
  CREATIVE_BLOCK_TYPES_2D,
  drawCreativeBlocks2D,
  drawSketchBlocksVoxel2D,
  getCreativeBlockSprite2D,
  paintVoxelBlockPixels2D
} from '../2d/arenas2d.js?v=10.4';
import {
  DEPTH_PARALLAX,
  Depth2DRenderer,
  getDepthProfile2D
} from '../2d/depth2d.js?v=10.4';
import {
  STAGE_OPTIONS_2D,
  install2DExpansion
} from '../2d/expansion2d.js?v=10.4';

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

test('2D Expansion [2] Prominent Level Selector & Title UI: index.html + expansion2d expose Creative Mode, Stage Select, and Stages 18–28 pills', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /href="2d\/style2d\.css\?v=10\.4"/);
  assert.match(html, /src="2d\/expansion2d\.js\?v=10\.4"/);
  assert.match(html, /id="btn-start-creative"/);
  assert.match(html, /id="title-stage-select"/);
  for (const stage of [18, 19, 20, 21, 27, 28]) {
    assert.match(html, new RegExp(`data-jump-stage="${stage}"`), `missing quick-jump pill for stage ${stage}`);
  }
  const expansionSrc = readFileSync(join(ROOT, '2d/expansion2d.js'), 'utf8');
  for (const stage of [22, 23, 24, 25, 26]) {
    assert.match(expansionSrc, new RegExp(`stage:\\s*['"]?${stage}['"]?`), `expansion2d.js must inject quick-jump pill for Stage ${stage}`);
  }
  assert.equal(STAGE_OPTIONS_2D.length, 29, 'selector must expose Stages 1–28 plus Stage 29 Trophy Room');
});

test('2D Expansion [3] 28-Stage Campaign + 11-Boss Trophy Room: Overworld (22), App Gauntlet (23–26) & Rocket Corp (27) precede Zero-Day (28)', () => {
  resetGlobalSystems();
  const { game, controller } = create2DGameHarness();

  assert.equal(game.stageManager.maxStage, 28);

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

  // Verify Stage 22: Minecraft Overworld
  controller.jumpToStage(22);
  assert.equal(game.stageManager.currentStage, 22);
  assert.equal(game.stageManager.theme, 'overworld');

  // Verify Stage 27: Rocket Corp HQ (4 Mercenaries) immediately precedes Stage 28: Zero-Day (H4C3R)
  controller.jumpToStage(27);
  advanceWaveSpawns(game, 4.0);
  assert.equal(game.stageManager.currentStage, 27);
  assert.equal(game.stageManager.theme, 'rocket_corp');
  const mercs = waves.zombies.filter((z) => z instanceof MercenaryBoss);
  assert.equal(mercs.length, 4, 'Stage 27 must spawn Agent, Ballista, Primal, and Hazard');

  controller.jumpToStage(28);
  advanceWaveSpawns(game, 2.0);
  assert.equal(game.stageManager.currentStage, 28);
  assert.equal(game.stageManager.theme, 'zero_day');
  assert.ok(waves.zombies.some((z) => z.type === 'h4c3r'), 'Stage 28 must spawn H4C3R');

  // Verify Stage 29: Trophy Room Epilogue with all 11 Boss Monuments
  controller.jumpToStage(29);
  assert.equal(game.stageManager.isTrophyRoom, true);
  assert.equal(game.stageManager.desktopIcons.length, 11, 'Trophy Room must honor all 11 campaign bosses');

  resetGlobalSystems();
});

test('2D Expansion [4] Pure 2D Canvas Rendering & Gaze-Freeze: all new arenas, voxel blocks, and bosses balance save/restore', () => {
  resetGlobalSystems();
  const { game, controller, ctx, calls } = create2DGameHarness();

  // Render Stages 7, 18..29 through full game.render()
  for (const stage of [7, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]) {
    controller.jumpToStage(stage, { freshStart: stage === 7 });
    if (stage < 29) advanceWaveSpawns(game, 2.5);
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

  // Render all 19 Creative Voxel Block types
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
  assert.equal(calls.save, calls.restore, 'All 19 2D Creative voxel block renderers must balance save/restore');

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

  // 1. Theme depth profiles cover classic, open-edge, App Gauntlet, and expanded biomes cleanly
  for (const theme of ['desktop', 'minecraft', 'the_end', 'aether', 'ancient_city', 'pale_garden', 'youtube', 'chrome', 'spotify', 'slides', 'rocket_corp', 'zero_day', 'trophy']) {
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
    const coveredTexels = new Set();
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
          for (let r = Math.max(0, Math.floor(y / 4)); r < Math.min(16, Math.ceil((y + h) / 4)); r++) {
            for (let c = Math.max(0, Math.floor(x / 4)); c < Math.min(16, Math.ceil((x + w) / 4)); c++) {
              coveredTexels.add(r * 16 + c);
            }
          }
        }
      };
      return { width, height, getContext: () => sctx };
    });

    assert.ok(sprite && sprite.width === 64 && sprite.height === 64, `${texKey} must bake a 64x64 (16x16 x 4px) voxel sprite`);
    assert.equal(smoothingDuringBake, false, `${texKey} sprite bake must disable imageSmoothingEnabled for crisp pixels`);
    assert.equal(coveredTexels.size, 256, `${texKey} must paint all 256 texels of the 16x16 grid`);
    assert.ok(ops.length >= 20, `${texKey} must paint detailed pixel-art runs + features (got ${ops.length} ops)`);

    const sig = ops.join('|');
    assert.ok(!signatures.has(sig), `${texKey} pixel-art texture must be visually distinct from every other block`);
    signatures.add(sig);
  }
  assert.equal(signatures.size, 19, 'all 19 2D Creative voxel block types must produce unique pixel-art textures');

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

  // 4. Spawning inside Stage 29 (Trophy Room, where waves start inactive) activates waves and updates spawned mobs
  controller.jumpToStage(29, { creative: true });
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

test('2D Expansion [11] Stage 10 AvA 8 Showdown Lake Arena: Outernet Lake, Waterfall Cliff, Wrecked Shack, ViraBot Bunker, Depth Motif & Taskbar Suppression', () => {
  resetGlobalSystems();
  const { game, controller, calls } = create2DGameHarness();

  // 1. Selector exposes Showdown Lake label for Stage 10
  const stage10Opt = STAGE_OPTIONS_2D.find((s) => s.value === 10);
  assert.ok(stage10Opt, 'Stage 10 must exist in STAGE_OPTIONS_2D');
  assert.match(stage10Opt.label, /Showdown Lake/i, 'Stage 10 selector label must reference Showdown Lake');

  // 2. Depth-of-field profile for dark_core uses Outernet ava8_lake motif and bakes cached blurred planes cleanly
  const profile = getDepthProfile2D('dark_core');
  assert.equal(profile.motif, 'ava8_lake', 'dark_core depth profile must use the ava8_lake Outernet mountain/cascade motif');
  let bakedPlanes = 0;
  const depthRenderer = new Depth2DRenderer({
    createCanvas: (w, h) => ({
      width: w,
      height: h,
      getContext: () => {
        bakedPlanes += 1;
        return createCanvasMock().ctx;
      }
    })
  });
  depthRenderer.drawBackgroundDepthPlanes(
    createCanvasMock().ctx,
    { currentStage: 10, theme: 'dark_core', isTrophyRoom: false, bounds: { minX: -1200, maxX: 1200, minY: -620 } },
    { x: 0, y: -140 },
    0,
    false
  );
  assert.equal(bakedPlanes, 2, 'ava8_lake offscreen Far + Mid depth planes must bake cleanly');

  // 3. Jump to Stage 10 and verify stage metadata, cliff/boulder platform names, and The Dark Lord boss spawn
  controller.jumpToStage(10, { freshStart: true });
  advanceWaveSpawns(game, 2.0);
  assert.equal(game.stageManager.currentStage, 10);
  assert.equal(game.stageManager.theme, 'dark_core');
  assert.equal(game.stageManager.stageName, 'Outernet Lake (AvA 8 Showdown)');
  assert.equal(game.stageManager.campaignBeat?.act, 'II - THE SHOWDOWN (AVA 8)');
  assert.equal(game.stageManager.platforms[0]?.title, 'Waterfall_Cliff_Ledge');
  assert.equal(game.stageManager.platforms[1]?.title, 'Shack_Bluff_Overlook');
  assert.equal(game.stageManager.platforms[2]?.title, 'Showdown_Canyon_Crag');
  assert.equal(game.stageManager.movingPlatforms[0]?.title, 'Ruptured_Boulder_W');
  assert.equal(game.stageManager.movingPlatforms[1]?.title, 'Ruptured_Boulder_E');
  assert.ok(
    waves.zombies.some((z) => z.type === 'dark_lord' && !z.isDead),
    'Stage 10 Showdown Lake must spawn The Dark Lord boss'
  );

  // 4. Render Stage 10 and verify AvA 8 Lake header paints while legacy red cyber grid & Windows taskbar are suppressed
  calls.save = 0;
  calls.restore = 0;
  calls.fillText.length = 0;
  game.render();

  assert.equal(calls.save, calls.restore, 'ctx.save and ctx.restore must stay balanced on Stage 10 Showdown Lake');
  assert.equal(game.reportedLayerErrors.size, 0, 'Stage 10 Showdown Lake must render with zero 2D layer errors');
  assert.ok(
    calls.fillText.some((t) => t.includes('OUTERNET://THE_SHOWDOWN_LAKE')),
    'Stage 10 2D arena must paint the AvA 8 Showdown Lake banner'
  );
  assert.ok(
    !calls.fillText.some((t) => t.includes('CRITICAL THREAT: THE_DARK_LORD.EXE')),
    'Legacy cyber-grid Dark Core text must be suppressed on AvA 8 Showdown Lake'
  );
  assert.ok(
    !calls.fillText.some((t) => t.includes('🪟 START') || t.includes('Stick_vs_Zombies.exe')),
    'Windows desktop taskbar must be suppressed so the Outernet Lake shore remains visible'
  );

  resetGlobalSystems();
});

test('2D Expansion [12] All 19 Placed Block Voxel Textures, KeyV Isolation & E-Key Voxel SketchBlocks', () => {
  resetGlobalSystems();

  // 1. Rasterize all 19 16x16 voxel block sprites into an exact 16x16 pixel grid and verify richness + uniqueness
  assert.equal(CREATIVE_BLOCK_TYPES_2D.length, 19, 'All 19 Creative block types must be registered');
  const signatures = new Map();
  for (const key of CREATIVE_BLOCK_TYPES_2D) {
    const grid = new Array(16 * 16).fill('');
    const rasterCtx = {
      fillStyle: '#000000',
      fillRect(rx, ry, rw, rh) {
        const c0 = Math.max(0, Math.floor(rx / 4));
        const r0 = Math.max(0, Math.floor(ry / 4));
        const c1 = Math.min(16, Math.ceil((rx + rw) / 4));
        const r1 = Math.min(16, Math.ceil((ry + rh) / 4));
        for (let r = r0; r < r1; r++) {
          for (let c = c0; c < c1; c++) {
            grid[r * 16 + c] = String(this.fillStyle).toLowerCase();
          }
        }
      }
    };
    paintVoxelBlockPixels2D(rasterCtx, key, 0, 0, 64);

    assert.ok(
      grid.every((cell) => cell.length > 0),
      `${key} 16x16 voxel sprite must cover all 256 pixels with zero unpainted gaps`
    );
    const uniqueColors = new Set(grid);
    assert.ok(
      uniqueColors.size >= 4,
      `${key} must render multi-tone 16x16 pixel art (got ${uniqueColors.size} colors)`
    );
    const sig = grid.join('|');
    for (const [otherKey, otherSig] of signatures.entries()) {
      assert.notEqual(sig, otherSig, `${key} must have a distinct 16x16 pixel texture from ${otherKey}`);
    }
    signatures.set(key, sig);
  }
  assert.equal(signatures.size, 19);

  // 2. Verify KeyV in Creative Mode places each of the 19 blocks WITHOUT double-spawning a flat #1c1b29 SketchBlock
  const { game, controller, ctx } = create2DGameHarness();
  controller.jumpToStage(1, { freshStart: true, creative: true });
  assert.equal(controller.sandbox.enabled, true);

  for (let i = 0; i < CREATIVE_BLOCK_TYPES_2D.length; i++) {
    const key = CREATIVE_BLOCK_TYPES_2D[i];
    controller.sandbox.selectedBlock = key;
    game.player.x = -400 + (i % 8) * 100;

    // Simulate browser keydown order where input.js sees KeyV before expansion2d.js
    input.keys['KeyV'] = true;
    input.keysPressed['KeyV'] = true;
    input.update();
    controller.handleCreativeKeyDown({ code: 'KeyV' });
    game.update(0.016);
    input.keys['KeyV'] = false;
    input.endFrame?.();

    const lastPlaced = controller.sandbox.blocks.at(-1);
    assert.ok(lastPlaced, `KeyV must place a Creative block for ${key}`);
    assert.equal(lastPlaced.texKey, key, `Placed Creative block must preserve texKey=${key}`);
    assert.equal(
      projectiles.sketchBlocks.length,
      0,
      `KeyV in Creative Mode must never double-spawn a legacy SketchBlock over ${key}`
    );
  }

  // 3. Verify E-key SketchBlocks in both Creative Mode and Normal Mode stamp texKey and render voxel art (never #1c1b29)
  const fillColorsUsed = [];
  ctx.fillRect = () => {
    fillColorsUsed.push(String(ctx.fillStyle).toLowerCase());
  };

  controller.sandbox.selectedBlock = 'lucky_block';
  game.player.blockCooldown = 0;
  input.keys['KeyE'] = true;
  input.keysPressed['KeyE'] = true;
  input.update();
  game.update(0.016);
  input.keys['KeyE'] = false;
  input.keysPressed['KeyE'] = false;

  assert.equal(projectiles.sketchBlocks.length, 1, 'KeyE must spawn a SketchBlock');
  assert.equal(
    projectiles.sketchBlocks[0].texKey,
    'lucky_block',
    'KeyE in Creative Mode must stamp the selected Creative block texKey'
  );

  // Switch to Normal Mode and press KeyE again -> stamps volcanic obsidian voxel texture
  controller.setCreativeMode(false);
  game.player.blockCooldown = 0;
  game.player.x += 120;
  input.keys['KeyE'] = true;
  input.keysPressed['KeyE'] = true;
  input.update();
  game.update(0.3);
  input.keys['KeyE'] = false;
  input.keysPressed['KeyE'] = false;

  assert.equal(projectiles.sketchBlocks.length, 2);
  assert.equal(projectiles.sketchBlocks[1].texKey, 'obsidian');

  fillColorsUsed.length = 0;
  game.render();
  assert.equal(game.reportedLayerErrors.size, 0, 'Rendering Creative blocks + voxel SketchBlocks must produce zero layer errors');
  assert.ok(
    !fillColorsUsed.includes('#1c1b29') && !fillColorsUsed.includes('#8d6e63'),
    'Legacy flat #1c1b29 / #8d6e63 SketchBlock fills must never paint over voxel blocks'
  );

  // Direct drawSketchBlocksVoxel2D smoke check with damaged HP bar + draw-in reveal
  projectiles.sketchBlocks[0].hp = 90;
  drawSketchBlocksVoxel2D(createCanvasMock().ctx, projectiles.sketchBlocks, 1.5);

  resetGlobalSystems();
});

test('2D Expansion [13] Dedicated App Levels (Stages 23–26): YouTube, Chrome, Spotify & Slides Arenas, Vertical Equalizer Lifts, Eraser Pickup & Depth Motifs', () => {
  resetGlobalSystems();
  const { game, controller, calls } = create2DGameHarness();

  const expectedApps = [
    {
      stage: 23,
      theme: 'youtube',
      stageName: 'YouTube Studio',
      motif: 'youtube_ui',
      staticCount: 3,
      movingCount: 1,
      movingAxis: 'x',
      waveTotal: 16,
      uiSnippet: 'YouTube'
    },
    {
      stage: 24,
      theme: 'chrome',
      stageName: 'Google Chrome',
      motif: 'chrome_tabs',
      staticCount: 4,
      movingCount: 1,
      movingAxis: 'x',
      waveTotal: 16,
      uiSnippet: 'chrome.google.com/stick-vs-zombies/arena'
    },
    {
      stage: 25,
      theme: 'spotify',
      stageName: 'Spotify Player',
      motif: 'spotify_eq',
      staticCount: 3,
      movingCount: 2,
      movingAxis: 'y',
      waveTotal: 16,
      uiSnippet: 'Spotify'
    },
    {
      stage: 26,
      theme: 'slides',
      stageName: 'Google Slides',
      motif: 'slides_deck',
      staticCount: 4,
      movingCount: 1,
      movingAxis: 'x',
      waveTotal: 17,
      uiSnippet: 'SLIDE 02'
    }
  ];

  // 1. Verify STAGE_OPTIONS_2D labels & depth-of-field blurred motif baking for all 4 apps
  for (const app of expectedApps) {
    const opt = STAGE_OPTIONS_2D.find((o) => o.value === app.stage);
    assert.ok(opt, `Stage ${app.stage} must be present in STAGE_OPTIONS_2D`);
    assert.ok(opt.label.includes(app.stageName.split(' ')[0]), `Stage ${app.stage} option label must name ${app.stageName}`);

    const profile = getDepthProfile2D(app.theme);
    assert.equal(profile.motif, app.motif, `${app.theme} depth profile must map to ${app.motif}`);

    let bakedCount = 0;
    const depth = new Depth2DRenderer({
      createCanvas: (w, h) => ({
        width: w,
        height: h,
        getContext: () => {
          bakedCount += 1;
          return createCanvasMock().ctx;
        }
      })
    });
    depth.drawBackgroundDepthPlanes(
      createCanvasMock().ctx,
      { currentStage: app.stage, theme: app.theme, isTrophyRoom: false, bounds: { minX: -1200, maxX: 1200, minY: -620 } },
      { x: 0, y: -140 },
      0,
      false
    );
    assert.equal(bakedCount, 2, `${app.theme} (${app.motif}) must bake both Far and Mid blurred depth planes cleanly`);
  }

  // 2. Jump to each App Stage (23..26), verify layouts, wave counts, UI rendering, and taskbar suppression
  for (const app of expectedApps) {
    controller.jumpToStage(app.stage, { freshStart: app.stage === 23 });
    assert.equal(game.stageManager.currentStage, app.stage);
    assert.equal(game.stageManager.theme, app.theme);
    assert.equal(game.stageManager.stageName, app.stageName);
    assert.equal(game.stageManager.platforms.length, app.staticCount, `${app.stageName} static platform count`);
    assert.equal(game.stageManager.movingPlatforms.length, app.movingCount, `${app.stageName} moving platform count`);
    assert.equal(game.stageManager.movingPlatforms[0]?.axis, app.movingAxis, `${app.stageName} moving platform axis`);

    const totalQueuedAndActive = waves.zombies.length + waves.spawnQueue.length;
    assert.equal(totalQueuedAndActive, app.waveTotal, `${app.stageName} must queue ${app.waveTotal} enemies`);

    if (app.stage === 23) {
      assert.equal(game.stageManager.laserHazards.length, 1, 'Stage 23 YouTube must feature the red skip-ad/buffering laser hazard');
    }
    if (app.stage === 26) {
      assert.ok(game.weaponPickup && game.weaponPickup.type === 'eraser', 'Stage 26 Google Slides must spawn the Giant Pink Eraser pickup');
    }

    calls.save = 0;
    calls.restore = 0;
    calls.fillText.length = 0;
    game.update(1 / 60);
    game.render();

    assert.equal(calls.save, calls.restore, `Stage ${app.stage} (${app.theme}) must balance ctx.save and ctx.restore`);
    assert.equal(game.reportedLayerErrors.size, 0, `Stage ${app.stage} (${app.theme}) must render with zero 2D layer errors`);
    assert.ok(
      calls.fillText.some((t) => t.includes(app.uiSnippet)),
      `Stage ${app.stage} (${app.theme}) must render authentic ${app.uiSnippet} app chrome`
    );
    assert.ok(
      !calls.fillText.some((t) => t.includes('🪟 START') || t.includes('Stick_vs_Zombies.exe')),
      `Stage ${app.stage} (${app.theme}) must suppress the Windows desktop taskbar so full-screen app UI fills the viewport`
    );
  }

  // 3. Verify Stage 25 Spotify's vertical bouncing equalizer lift (`axis: 'y'`) carries Orange smoothly upward & downward
  controller.jumpToStage(25);
  const bassLift = game.stageManager.movingPlatforms[0];
  assert.equal(bassLift.title, 'Equalizer_Bass_W');
  assert.equal(bassLift.axis, 'y');

  game.player.x = bassLift.x;
  game.player.y = bassLift.y - bassLift.height;
  game.player.vy = 0;
  game.player.isGrounded = true;
  game.player.standingPlatform = bassLift;
  game.player.standingPlatformX = bassLift.x;
  game.player.standingPlatformY = bassLift.y;

  const startLiftY = bassLift.y;
  for (let step = 0; step < 6; step++) {
    game.update(1 / 60);
  }
  assert.notEqual(bassLift.y, startLiftY, 'Equalizer_Bass_W must oscillate vertically on axis y');
  assert.equal(
    game.player.standingPlatform,
    bassLift,
    'Orange must stay grounded on the vertically bouncing Spotify equalizer lift'
  );
  assert.ok(
    Math.abs(game.player.y - (bassLift.y - bassLift.height)) <= 6,
    'Orange y position must ride flush with the moving Spotify equalizer lift top'
  );

  resetGlobalSystems();
});

test('2D Expansion [14] Stage 22 Minecraft Overworld Level: Sunny Grasslands, Minecart Rail Track, Destructible Outpost Voxel Blocks & Block Staff Pickup', () => {
  resetGlobalSystems();
  const { game, controller, calls } = create2DGameHarness();

  // 1. Selector option & depth-of-field motif
  const stage22Opt = STAGE_OPTIONS_2D.find((o) => o.value === 22);
  assert.ok(stage22Opt && stage22Opt.label.includes('Minecraft Overworld'), 'Stage 22 option must advertise Minecraft Overworld');
  const depthProfile = getDepthProfile2D('overworld');
  assert.equal(depthProfile.motif, 'overworld_hills', 'overworld theme must map to overworld_hills depth motif');

  // 2. Jump to Stage 22 and inspect arena, wave recipe, weapon pickup, and pre-placed destructible voxel outpost
  controller.jumpToStage(22, { freshStart: true, creative: false });
  assert.equal(game.stageManager.currentStage, 22);
  assert.equal(game.stageManager.theme, 'overworld');
  assert.equal(game.stageManager.stageName, 'Minecraft Overworld');
  assert.equal(game.stageManager.platforms.length, 3, 'Overworld must have 3 static terrain/canopy ledges');
  assert.equal(game.stageManager.movingPlatforms.length, 1, 'Overworld must have 1 moving Minecart_Rail_Track platform');
  assert.equal(game.stageManager.movingPlatforms[0].title, 'Minecart_Rail_Track');
  assert.equal(game.stageManager.movingPlatforms[0].axis, 'x');
  assert.equal(waves.zombies.length + waves.spawnQueue.length, 16, 'Overworld wave recipe must queue 16 enemies');
  assert.ok(game.weaponPickup && game.weaponPickup.type === 'staff', 'Stage 22 Overworld must spawn the Block Staff pickup');

  assert.equal(
    controller.sandbox.blocks.length,
    OVERWORLD_OUTPOST_BLOCKS.length,
    'Stage 22 Overworld must spawn pre-placed destructible voxel outpost blocks'
  );
  const outpostTNT = controller.sandbox.blocks.find((b) => b.texKey === 'tnt_block');
  assert.ok(outpostTNT, 'Stage 22 Overworld outpost must include a hit-ignitable TNT block');

  // 3. Render Stage 22 and confirm Overworld banner + taskbar suppression + zero layer errors
  calls.save = 0;
  calls.restore = 0;
  calls.fillText.length = 0;
  game.update(1 / 60);
  game.render();
  assert.equal(calls.save, calls.restore, 'Stage 22 Overworld must balance ctx.save and ctx.restore');
  assert.equal(game.reportedLayerErrors.size, 0, 'Stage 22 Overworld must render with zero layer errors');
  assert.ok(
    calls.fillText.some((t) => t.includes('MINECRAFT_OVERWORLD')),
    'Stage 22 Overworld must paint the MINECRAFT_OVERWORLD header'
  );
  assert.ok(
    !calls.fillText.some((t) => t.includes('🪟 START') || t.includes('Stick_vs_Zombies.exe')),
    'Stage 22 Overworld must suppress the Windows taskbar'
  );

  resetGlobalSystems();
});

test('2D Expansion [15] How You Died Attribution & Game Over Death Banner: Zombies, Boss Attacks, Lasers, Lava, Void Fall & TNT Blast', () => {
  resetGlobalSystems();
  const { game, controller } = create2DGameHarness();

  // 1. Unit-verify attacker & projectile death message formatters across enemies and boss attacks
  assert.equal(
    formatAttackerDeathMessage({ type: 'walker' }),
    'The Second Coming was slain by Basic Zombie'
  );
  assert.equal(
    formatAttackerDeathMessage({ type: 'warden_boss', state: 'sonic_active' }),
    "The Second Coming was obliterated by The Warden's Sonic Boom"
  );
  assert.equal(
    formatAttackerDeathMessage({ type: 'creaking_boss', state: 'blink_active' }),
    'The Second Coming blinked and was ambushed by The Creaking'
  );
  assert.equal(
    formatAttackerDeathMessage({ type: 'ender_dragon', state: 'breath_active' }),
    "The Second Coming was roasted in Ender Dragon's Breath"
  );
  assert.equal(
    formatAttackerDeathMessage({ type: 'creeper_lord', creeperBlast: true }),
    'The Second Coming was blown up by Creeper Lord'
  );
  assert.equal(
    formatProjectileDeathMessage({ type: 'doom_laser' }),
    "The Second Coming was vaporized by The Dark Lord's Doom Laser"
  );
  assert.equal(
    resolvePlayerDeathCause({ lastDeathReason: '', lastDamageCause: '' }, ''),
    'The Second Coming was defeated in battle'
  );

  // 2. End-to-end 2D combat kill by Zombie -> records exact cause on player, controller, text banner, and gameOver()
  controller.jumpToStage(1, { freshStart: true, creative: false });
  controller.nukeAllEnemies();
  const walker = controller.spawnCreativeEntity('walker');
  walker.x = game.player.x + 12;
  walker.y = 0;
  walker.attackCooldown = 0;
  game.player.hp = 5;
  game.player.iFrames = 0;
  game.player.isRolling = false;
  game.player.isAwakened = false;

  for (let i = 0; i < 15 && !game.player.isDead; i++) {
    game.update(0.05);
  }
  assert.equal(game.player.isDead, true, 'Walker melee hit at 5 HP must kill player');
  assert.equal(
    controller.getLastDeathReason(),
    'The Second Coming was slain by Basic Zombie',
    'Zombie kill must record exact Minecraft-style death cause'
  );
  assert.ok(
    particles.damageTexts.some((ft) => String(ft.text || '').toUpperCase().includes('WAS SLAIN BY BASIC ZOMBIE')),
    'player.die() must spawn an immediate floating death cause banner'
  );
  const prevDoc = globalThis.document;
  const mockDom = new Map();
  const getEl = (id) => {
    if (!mockDom.has(id)) {
      mockDom.set(id, { id, textContent: '', innerText: '', style: {}, classList: { add() {}, remove() {} } });
    }
    return mockDom.get(id);
  };
  globalThis.document = {
    getElementById: getEl,
    querySelector: () => null,
    querySelectorAll: () => []
  };
  try {
    game.gameOver();
    assert.equal(game.state, 'GAMEOVER');
    assert.equal(
      getEl('gameover-death-text').textContent,
      'The Second Coming was slain by Basic Zombie',
      '2D gameOver() must populate #gameover-death-text with exact death cause'
    );
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }

  // 3. End-to-end Stage 23 YouTube Skip-Ad Laser kill -> records YouTube Skip-Ad Laser death cause
  controller.jumpToStage(23, { freshStart: true, creative: false });
  controller.nukeAllEnemies();
  const laser = game.stageManager.laserHazards[0];
  assert.ok(laser);
  laser.timer = 0.1; // active beam
  game.player.x = laser.x + laser.width * 0.5;
  game.player.y = 0;
  game.player.hp = 10;
  game.player.iFrames = 0;
  game.update(1 / 60);
  assert.equal(game.player.isDead, true);
  assert.equal(
    controller.getLastDeathReason(),
    'The Second Coming was vaporized by a YouTube Skip-Ad Laser'
  );

  // 4. End-to-end Stage 7 Nether Lava Pool kill -> records "tried to swim in lava"
  controller.jumpToStage(7, { freshStart: true, creative: false });
  controller.nukeAllEnemies();
  game.player.x = -360;
  game.player.y = 0;
  game.player.hp = 15;
  game.player.iFrames = 0;
  game.update(1 / 60);
  assert.equal(game.player.isDead, true);
  assert.equal(
    controller.getLastDeathReason(),
    'The Second Coming tried to swim in lava'
  );

  // 5. End-to-end Stage 18 Open-Edge Void Plunge kill -> records "fell out of the world"
  controller.jumpToStage(18, { freshStart: true, creative: false });
  controller.nukeAllEnemies();
  game.player.x = 1040;
  game.player.y = 190;
  game.player.vy = 700;
  game.player.hp = 25;
  game.player.iFrames = 0;
  game.update(1 / 60);
  assert.equal(game.player.isDead, true);
  assert.equal(
    controller.getLastDeathReason(),
    'The Second Coming fell out of the world'
  );

  resetGlobalSystems();
});

test('2D Expansion [16] TNT Blows Up Blocks: Destroys Creative & Sketch Blocks, Detaches Standing Entities, Ignites Chain TNT, Cracks Lucky Blocks & Kills Mortal Player', () => {
  resetGlobalSystems();
  const { game, controller } = create2DGameHarness();

  // 1. Jump to Stage 22 (Minecraft Overworld) and smack the outpost TNT crate with Orange's attack!
  controller.jumpToStage(22, { freshStart: true, creative: false });
  controller.nukeAllEnemies();
  const initialOutpostCount = controller.sandbox.blocks.length;
  const outpostTNT = controller.sandbox.blocks.find((b) => b.texKey === 'tnt_block');
  assert.ok(outpostTNT && initialOutpostCount >= 5);

  game.player.x = outpostTNT.x - 52;
  game.player.y = 0;
  game.player.facing = 1;
  game.player.executeLightCombo([], game.camera);
  assert.ok(outpostTNT.isIgnited && outpostTNT.fuseTimer > 0, 'Attacking adjacent TNT block must ignite its fuse');

  // Move Orange safely away before the fuse expires so we inspect outpost block destruction first
  game.player.x = -420;
  for (let i = 0; i < 16; i++) {
    game.update(0.1);
  }
  assert.ok(
    controller.sandbox.blocks.length < initialOutpostCount - 1,
    `Exploding outpost TNT must blow up neighboring Overworld blocks (before=${initialOutpostCount}, after=${controller.sandbox.blocks.length})`
  );

  // 2. Verify TNT blast destroys ALL nearby block types (including command_block, obsidian, cobblestone) AND [E] SketchBlocks,
  //    cracks nearby Lucky Blocks, chain-ignites adjacent TNT, and detaches entities standing on blown-up blocks!
  controller.clearCreativeBlocks();
  projectiles.sketchBlocks.length = 0;

  game.player.x = -60;
  game.player.facing = 1;
  const centerTNT = controller.placeCreativeBlock('tnt_block'); // x = 0
  const nearObsidian = { x: 68, y: 0, width: 68, height: 68, texKey: 'obsidian', broken: false };
  const nearCommand = { x: -68, y: 0, width: 68, height: 68, texKey: 'command_block', broken: false };
  const nearLucky = { x: 0, y: -68, width: 68, height: 68, texKey: 'lucky_block', broken: false };
  const chainTNT = { x: 136, y: 0, width: 68, height: 68, texKey: 'tnt_block', broken: false };
  const farBlock = { x: 600, y: 0, width: 68, height: 68, texKey: 'cobblestone', broken: false };
  controller.sandbox.blocks.push(nearObsidian, nearCommand, nearLucky, chainTNT, farBlock);

  // Also spawn an [E] SketchBlock inside blast radius and a distant [E] SketchBlock outside blast radius
  projectiles.spawnSketchBlock(55, 0, 'obsidian');
  projectiles.spawnSketchBlock(620, 0, 'obsidian');
  assert.equal(projectiles.sketchBlocks.length, 2);

  // Place a zombie standing directly on top of nearObsidian
  const perchedZombie = controller.spawnCreativeEntity('walker');
  perchedZombie.x = 68;
  perchedZombie.y = -68;
  perchedZombie.isGrounded = true;
  perchedZombie.standingPlatform = nearObsidian;

  // Put mortal Orange right next to the TNT with 35 HP -> TNT blast (42 dmg) kills Orange and records TNT death cause!
  game.player.x = 24;
  game.player.y = 0;
  game.player.hp = 35;
  game.player.iFrames = 0;
  game.player.isGodMode = false;

  controller.detonateTNTBlock(centerTNT);

  assert.equal(nearObsidian.broken, true, 'TNT must blow up nearby Obsidian block');
  assert.equal(nearCommand.broken, true, 'TNT must blow up nearby Command Block');
  assert.equal(nearLucky.broken, true, 'TNT must crack nearby Lucky Block');
  assert.ok(chainTNT.isIgnited && chainTNT.fuseTimer > 0, 'TNT must chain-ignite neighboring TNT block');
  assert.equal(farBlock.broken, false, 'Distant block outside blast radius must survive');
  assert.equal(projectiles.sketchBlocks.length, 1, 'TNT must destroy nearby [E] SketchBlock while sparing distant SketchBlock');
  assert.equal(perchedZombie.standingPlatform, null, 'Entity standing on a blown-up block must be detached so gravity drops them');
  assert.equal(game.player.isDead, true, 'Mortal player in close TNT blast radius at 35 HP must be blown up');
  assert.equal(
    controller.getLastDeathReason(),
    'The Second Coming was blown up by TNT',
    'Lethal TNT blast must set exact death message "The Second Coming was blown up by TNT"'
  );

  resetGlobalSystems();
});



