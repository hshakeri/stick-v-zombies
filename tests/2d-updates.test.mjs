import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
import { save } from '../js/systems/save.js?v=9.8';

import {
  EnderDragonBoss,
  WardenBoss,
  CreakingBoss,
  MercenaryBoss,
  OVERWORLD_OUTPOST_BLOCKS,
  DESERT_PYRAMID_TRAP_BLOCKS,
  formatAttackerDeathMessage,
  formatProjectileDeathMessage,
  resolvePlayerDeathCause
} from '../3d/js/campaign3d.js?v=10.9';
import { speech3d } from '../3d/js/speech3d.js?v=10.3';

import {
  CREATIVE_BLOCK_TYPES_2D,
  drawCreativeBlocks2D,
  drawGroundCraters2D,
  drawSketchBlocksVoxel2D,
  getCreativeBlockSprite2D,
  paintVoxelBlockPixels2D
} from '../2d/arenas2d.js?v=10.7';
import {
  DEPTH_PARALLAX,
  Depth2DRenderer,
  getDepthProfile2D
} from '../2d/depth2d.js?v=10.7';
import {
  STAGE_OPTIONS_2D,
  install2DExpansion
} from '../2d/expansion2d.js?v=10.8';
import {
  OLD_UPDATES_ARCHIVE,
  PURPLE_ALLY_CONFIG,
  installOldUpdatesMenu,
  resolveLegacyUpdateUrl
} from '../3d/js/purple_ally.js?v=11.0';
import {
  HerobrineBoss,
  VictimBoss
} from '../3d/js/secret_bosses.js?v=10.9';
import {
  BOSS_WEAPON_CATALOG,
  PLAYABLE_CHARACTERS,
  BOSS_RUSH_ROSTER,
  ENDLESS_MUTATORS,
  ROGUELIKE_PERKS,
  TROPHY_MONUMENT_BOSSES,
  computeStageRank
} from '../3d/js/gameplay_features.js?v=11.0';

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
    '3d/js/speech3d.js',
    '3d/js/purple_ally.js',
    '3d/js/secret_bosses.js',
    '3d/js/gameplay_features.js'
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

test('2D Expansion [2] Prominent Level Selector & Title UI: index.html + expansion2d expose Creative Mode, Stage Select, and Stages 18–32 pills', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /href="2d\/style2d\.css\?v=10\.5"/);
  assert.match(html, /src="2d\/expansion2d\.js\?v=10\.8"/);
  assert.match(html, /id="btn-start-creative"/);
  assert.match(html, /id="title-stage-select"/);
  for (const stage of [19, 20, 21, 22, 31, 32]) {
    assert.match(html, new RegExp(`data-jump-stage="${stage}"`), `missing quick-jump pill for stage ${stage}`);
  }
  const expansionSrc = readFileSync(join(ROOT, '2d/expansion2d.js'), 'utf8');
  assert.match(expansionSrc, /setAttribute\(['"]data-jump-stage['"],\s*['"]18['"]\)/, 'expansion2d.js must inject quick-jump pill for Stage 18');
  for (const stage of [23, 24, 25, 26, 27, 28, 29, 30]) {
    assert.match(expansionSrc, new RegExp(`stage:\\s*['"]?${stage}['"]?`), `expansion2d.js must inject quick-jump pill for Stage ${stage}`);
  }
  assert.equal(STAGE_OPTIONS_2D.length, 33, 'selector must expose Stages 1–32 plus Stage 33 Trophy Room');
});

test('2D Expansion [3] 32-Stage Campaign + 11-Boss Trophy Room: Stronghold (18) precedes The End (19), Ice Caves (23) & Desert Pyramid Interior (24) precede Overworld Village (25), App Gauntlet (26–29), Outside Rocket Corp (30) precedes Rocket Corp (31) & Zero-Day (32)', () => {
  resetGlobalSystems();
  const { game, controller } = create2DGameHarness();

  assert.equal(game.stageManager.maxStage, 32);

  // Verify Stage 18: The Stronghold right before The End
  controller.jumpToStage(18, { freshStart: true });
  assert.equal(game.stageManager.currentStage, 18);
  assert.equal(game.stageManager.theme, 'stronghold');
  assert.equal(game.stageManager.stageName, 'The Stronghold');

  // Verify Stage 19: The End + Ender Dragon
  controller.jumpToStage(19);
  advanceWaveSpawns(game, 2.0);
  assert.equal(game.stageManager.currentStage, 19);
  assert.equal(game.stageManager.theme, 'the_end');
  assert.ok(waves.zombies.some((z) => z instanceof EnderDragonBoss), 'Stage 19 must spawn EnderDragonBoss');

  // Verify Stage 20: The Aether + horizontal moving platform axis
  controller.jumpToStage(20);
  assert.equal(game.stageManager.currentStage, 20);
  assert.equal(game.stageManager.theme, 'aether');
  assert.equal(game.stageManager.movingPlatforms[0]?.axis, 'x', 'Gold_Aercloud must move horizontally in 2D');

  // Verify Stage 21: Ancient City + The Warden
  controller.jumpToStage(21);
  advanceWaveSpawns(game, 2.0);
  assert.equal(game.stageManager.currentStage, 21);
  assert.equal(game.stageManager.theme, 'ancient_city');
  assert.equal(game.stageManager.movingPlatforms[0]?.axis, 'x', 'Soul_Lantern_Bridge must move horizontally in 2D');
  assert.ok(waves.zombies.some((z) => z instanceof WardenBoss), 'Stage 21 must spawn WardenBoss');

  // Verify Stage 22: Pale Garden + The Creaking
  controller.jumpToStage(22);
  advanceWaveSpawns(game, 2.0);
  assert.equal(game.stageManager.currentStage, 22);
  assert.equal(game.stageManager.theme, 'pale_garden');
  assert.equal(game.stageManager.movingPlatforms[0]?.axis, 'x', 'Hanging_Moss_Bough must move horizontally in 2D');
  assert.ok(waves.zombies.some((z) => z instanceof CreakingBoss), 'Stage 22 must spawn CreakingBoss');

  // Verify Stage 23: Ice Caves & Stage 24: Desert Pyramid Interior immediately precede Stage 25: Minecraft Overworld (Village)
  controller.jumpToStage(23);
  assert.equal(game.stageManager.currentStage, 23);
  assert.equal(game.stageManager.theme, 'ice_caves');
  assert.equal(game.stageManager.stageName, 'Ice Caves');

  controller.jumpToStage(24);
  assert.equal(game.stageManager.currentStage, 24);
  assert.equal(game.stageManager.theme, 'desert_pyramid');
  assert.equal(game.stageManager.stageName, 'Desert Pyramid Interior');

  // Verify Stage 25: Minecraft Overworld (Village)
  controller.jumpToStage(25);
  assert.equal(game.stageManager.currentStage, 25);
  assert.equal(game.stageManager.theme, 'overworld');

  // Verify Stage 30: Outside Rocket Corp immediately precedes Stage 31: Rocket Corp HQ
  controller.jumpToStage(30);
  assert.equal(game.stageManager.currentStage, 30);
  assert.equal(game.stageManager.theme, 'rocket_corp_exterior');
  assert.equal(game.stageManager.stageName, 'Outside Rocket Corp');

  // Verify Stage 31: Rocket Corp HQ (4 Mercenaries) immediately precedes Stage 32: Zero-Day (H4C3R)
  controller.jumpToStage(31);
  advanceWaveSpawns(game, 4.0);
  assert.equal(game.stageManager.currentStage, 31);
  assert.equal(game.stageManager.theme, 'rocket_corp');
  const mercs = waves.zombies.filter((z) => z instanceof MercenaryBoss);
  assert.equal(mercs.length, 4, 'Stage 31 must spawn Agent, Ballista, Primal, and Hazard');

  controller.jumpToStage(32);
  advanceWaveSpawns(game, 2.0);
  assert.equal(game.stageManager.currentStage, 32);
  assert.equal(game.stageManager.theme, 'zero_day');
  assert.ok(waves.zombies.some((z) => z.type === 'h4c3r'), 'Stage 32 must spawn H4C3R');

  // Verify Stage 33: Trophy Room Epilogue with all 11 Boss Monuments
  controller.jumpToStage(33);
  assert.equal(game.stageManager.isTrophyRoom, true);
  assert.equal(game.stageManager.desktopIcons.length, 11, 'Trophy Room must honor all 11 campaign bosses');

  resetGlobalSystems();
});

test('2D Expansion [4] Pure 2D Canvas Rendering & Gaze-Freeze: all new arenas, voxel blocks, and bosses balance save/restore', () => {
  resetGlobalSystems();
  const { game, controller, ctx, calls } = create2DGameHarness();

  // Render Stages 7, 18..33 through full game.render()
  for (const stage of [7, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33]) {
    controller.jumpToStage(stage, { freshStart: stage === 7 });
    if (stage < 33) advanceWaveSpawns(game, 2.5);
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
  controller.jumpToStage(21, { freshStart: true });
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

  controller.jumpToStage(22, { freshStart: true });
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

  // Render all 20 Creative Voxel Block types
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
  assert.equal(calls.save, calls.restore, 'All 20 2D Creative voxel block renderers must balance save/restore');

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

  // 2. Floating Island Void Plunge (Stage 19: The End) for both Player and Non-Flying Enemy
  controller.jumpToStage(19, { freshStart: true, creative: false });
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
  game.startGame({ stage: 22, creative: false });
  advanceWaveSpawns(game, 1.5);

  // Stage 22 CreakingBoss intro should already have spawned a speech3d bubble!
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

  // 1. Theme depth profiles cover classic, open-edge, Stronghold, App Gauntlet, Outside Rocket Corp, and expanded biomes cleanly
  for (const theme of ['desktop', 'minecraft', 'stronghold', 'the_end', 'aether', 'ancient_city', 'pale_garden', 'overworld', 'youtube', 'chrome', 'spotify', 'slides', 'rocket_corp_exterior', 'rocket_corp', 'zero_day', 'trophy']) {
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
  for (const stage of [1, 3, 7, 13, 17, 18, 21, 22, 23, 28]) {
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
  assert.equal(signatures.size, 25, 'all 25 2D Creative voxel block types must produce unique pixel-art textures');

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

  // 4. Spawning inside Stage 33 (Trophy Room, where waves start inactive) activates waves and updates spawned mobs
  controller.jumpToStage(33, { creative: true });
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

test('2D Expansion [12] All 25 Placed Block Voxel Textures, KeyV Isolation & E-Key Voxel SketchBlocks', () => {
  resetGlobalSystems();

  // 1. Rasterize all 25 16x16 voxel block sprites into an exact 16x16 pixel grid and verify richness + uniqueness
  assert.equal(CREATIVE_BLOCK_TYPES_2D.length, 25, 'All 25 Creative block types must be registered');
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
  assert.equal(signatures.size, 25);

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

test('2D Expansion [13] Dedicated App Levels (Stages 26–29): YouTube, Chrome, Spotify & Slides Arenas, Vertical Equalizer Lifts, Eraser Pickup & Depth Motifs', () => {
  resetGlobalSystems();
  const { game, controller, calls } = create2DGameHarness();

  const expectedApps = [
    {
      stage: 26,
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
      stage: 27,
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
      stage: 28,
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
      stage: 29,
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

  // 2. Jump to each App Stage (26..29), verify layouts, wave counts, UI rendering, and taskbar suppression
  for (const app of expectedApps) {
    controller.jumpToStage(app.stage, { freshStart: app.stage === 26 });
    assert.equal(game.stageManager.currentStage, app.stage);
    assert.equal(game.stageManager.theme, app.theme);
    assert.equal(game.stageManager.stageName, app.stageName);
    assert.equal(game.stageManager.platforms.length, app.staticCount, `${app.stageName} static platform count`);
    assert.equal(game.stageManager.movingPlatforms.length, app.movingCount, `${app.stageName} moving platform count`);
    assert.equal(game.stageManager.movingPlatforms[0]?.axis, app.movingAxis, `${app.stageName} moving platform axis`);

    const totalQueuedAndActive = waves.zombies.length + waves.spawnQueue.length;
    assert.equal(totalQueuedAndActive, app.waveTotal, `${app.stageName} must queue ${app.waveTotal} enemies`);

    if (app.stage === 26) {
      assert.equal(game.stageManager.laserHazards.length, 1, 'Stage 26 YouTube must feature the red skip-ad/buffering laser hazard');
    }
    if (app.stage === 29) {
      assert.ok(game.weaponPickup && game.weaponPickup.type === 'eraser', 'Stage 29 Google Slides must spawn the Giant Pink Eraser pickup');
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

  // 3. Verify Stage 28 Spotify's vertical bouncing equalizer lift (`axis: 'y'`) carries Orange smoothly upward & downward
  controller.jumpToStage(28);
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

test('2D Expansion [14] Stage 25 Minecraft Overworld Level: Sunny Grasslands, Minecart Rail Track, Destructible Outpost Voxel Blocks & Block Staff Pickup', () => {
  resetGlobalSystems();
  const { game, controller, calls } = create2DGameHarness();

  // 1. Selector option & depth-of-field motif
  const stage25Opt = STAGE_OPTIONS_2D.find((o) => o.value === 25);
  assert.ok(stage25Opt && stage25Opt.label.includes('Minecraft Overworld'), 'Stage 25 option must advertise Minecraft Overworld');
  const depthProfile = getDepthProfile2D('overworld');
  assert.equal(depthProfile.motif, 'overworld_hills', 'overworld theme must map to overworld_hills depth motif');

  // 2. Jump to Stage 25 and inspect arena, wave recipe, weapon pickup, and pre-placed destructible voxel outpost
  controller.jumpToStage(25, { freshStart: true, creative: false });
  assert.equal(game.stageManager.currentStage, 25);
  assert.equal(game.stageManager.theme, 'overworld');
  assert.equal(game.stageManager.stageName, 'Minecraft Overworld');
  assert.equal(game.stageManager.platforms.length, 3, 'Overworld must have 3 static terrain/canopy ledges');
  assert.equal(game.stageManager.movingPlatforms.length, 1, 'Overworld must have 1 moving Minecart_Rail_Track platform');
  assert.equal(game.stageManager.movingPlatforms[0].title, 'Minecart_Rail_Track');
  assert.equal(game.stageManager.movingPlatforms[0].axis, 'x');
  assert.equal(waves.zombies.length + waves.spawnQueue.length, 16, 'Overworld wave recipe must queue 16 enemies');
  assert.ok(game.weaponPickup && game.weaponPickup.type === 'staff', 'Stage 25 Overworld must spawn the Block Staff pickup');

  assert.equal(
    controller.sandbox.blocks.length,
    OVERWORLD_OUTPOST_BLOCKS.length,
    'Stage 25 Overworld must spawn pre-placed destructible voxel outpost blocks'
  );
  const outpostTNT = controller.sandbox.blocks.find((b) => b.texKey === 'tnt_block');
  assert.ok(outpostTNT, 'Stage 25 Overworld outpost must include a hit-ignitable TNT block');

  // 3. Render Stage 25 and confirm Overworld banner + taskbar suppression + zero layer errors
  calls.save = 0;
  calls.restore = 0;
  calls.fillText.length = 0;
  game.update(1 / 60);
  game.render();
  assert.equal(calls.save, calls.restore, 'Stage 25 Overworld must balance ctx.save and ctx.restore');
  assert.equal(game.reportedLayerErrors.size, 0, 'Stage 25 Overworld must render with zero layer errors');
  assert.ok(
    calls.fillText.some((t) => t.includes('MINECRAFT_OVERWORLD')),
    'Stage 25 Overworld must paint the MINECRAFT_OVERWORLD header'
  );
  assert.ok(
    !calls.fillText.some((t) => t.includes('🪟 START') || t.includes('Stick_vs_Zombies.exe')),
    'Stage 25 Overworld must suppress the Windows taskbar'
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

  // 3. End-to-end Stage 26 YouTube Skip-Ad Laser kill -> records YouTube Skip-Ad Laser death cause
  controller.jumpToStage(26, { freshStart: true, creative: false });
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

  // 5. End-to-end Stage 19 Open-Edge Void Plunge kill -> records "fell out of the world"
  controller.jumpToStage(19, { freshStart: true, creative: false });
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

  // 1. Jump to Stage 25 (Minecraft Overworld) and smack the outpost TNT crate with Orange's attack!
  controller.jumpToStage(25, { freshStart: true, creative: false });
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

test('2D Expansion [17] TNT Blows Up The Ground: Ground TNT carves 2D craters, spares sky/portals, renders cleanly, drops zombies & players into void/lava, respawns safely, and repairs on clear/stage reset', () => {
  resetGlobalSystems();
  const { game, controller, ctx, calls } = create2DGameHarness();

  // 1. Stage 25 (Minecraft Overworld): ground-level TNT carves a crater, sky TNT does not, and entrance/exit portals stay protected!
  controller.jumpToStage(25, { freshStart: true, creative: false });
  controller.nukeAllEnemies();
  controller.clearCreativeBlocks();
  assert.equal(controller.sandbox.groundHoles.length, 0);

  // Sky TNT (y = -320) must NOT carve the floor below
  const skyTNT = { x: -240, y: -320, width: 68, height: 68, texKey: 'tnt_block', broken: false };
  controller.sandbox.blocks.push(skyTNT);
  controller.detonateTNTBlock(skyTNT);
  assert.equal(controller.sandbox.groundHoles.length, 0, 'High-altitude sky TNT must not carve a crater into groundY = 0');

  // Portal-adjacent TNT right on top of entranceDoor must NOT carve into the protected portal zone
  const portalX = game.stageManager.entranceDoor.x;
  const portalTNT = { x: portalX, y: 0, width: 68, height: 68, texKey: 'tnt_block', broken: false };
  controller.sandbox.blocks.push(portalTNT);
  assert.equal(controller.isOverGroundHole2D(portalX), false, 'Entrance portal ground must stay intact');
  controller.detonateTNTBlock(portalTNT);
  assert.equal(controller.isOverGroundHole2D(portalX), false, 'TNT at entrance portal must never blow out portal ground');

  // Ground-level TNT at x = 120 carves a genuine crater hole in the arena floor!
  controller.clearCreativeBlocks();
  game.player.x = -520;
  game.player.y = 0;
  const groundTNT = { x: 120, y: 0, width: 68, height: 68, texKey: 'tnt_block', broken: false };
  controller.sandbox.blocks.push(groundTNT);
  controller.detonateTNTBlock(groundTNT);

  assert.equal(controller.sandbox.groundHoles.length, 1, 'Ground-level TNT must carve a crater in sandbox.groundHoles');
  assert.equal(controller.isOverGroundHole2D(120), true, 'Center of blasted ground crater must report as an open hole');

  // 2. Verify 2D rendering of ground craters on both enclosed (overworld) and lava-sea (minecraft) themes with balanced save/restore
  calls.save = 0;
  calls.restore = 0;
  drawGroundCraters2D(ctx, controller.sandbox.groundHoles, 0, 'overworld', 1.25);
  drawGroundCraters2D(ctx, controller.sandbox.groundHoles, 0, 'minecraft', 2.5);
  assert.equal(calls.save, calls.restore, 'drawGroundCraters2D must strictly balance ctx.save() and ctx.restore()');

  game.reportedLayerErrors.clear();
  game.render();
  assert.equal(game.reportedLayerErrors.size, 0, 'game.render() with active ground craters must produce 0 layer errors');

  // 3. Non-flying zombie positioned over the blasted crater plunges below groundY = 0 and gets eliminated (VOID KO!)
  const craterZombie = controller.spawnCreativeEntity('walker');
  craterZombie.x = 120;
  craterZombie.y = 0;
  craterZombie.isGrounded = true;
  const killsBefore = combat.totalKills;

  for (let step = 0; step < 30 && !craterZombie.isDead && waves.zombies.includes(craterZombie); step++) {
    game.update(0.05);
  }
  assert.equal(waves.zombies.includes(craterZombie), false, 'Zombie dropping into a blown-up ground crater must be eliminated at void threshold');
  assert.ok(combat.totalKills > killsBefore, 'Zombie void elimination in a TNT crater must credit combat kill count');

  // 4. Mortal player stepping into the blasted crater plunges, takes 40 HP void damage, and respawns on guaranteed hole-free ground!
  //    Even if lastSafeIslandX was somehow pointing at 120 (inside the crater), findSafeGroundPoint relocates Orange onto solid ground.
  controller.sandbox.lastSafeIslandX = 120;
  game.player.x = 120;
  game.player.y = 0;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.hp = 100;
  game.player.iFrames = 0;
  game.player.isGodMode = false;

  for (let step = 0; step < 25 && game.player.hp === 100; step++) {
    game.update(0.05);
  }
  assert.equal(game.player.hp, 60, 'Mortal player plunging into an Overworld TNT crater must take 40 void plunge damage');
  assert.equal(game.player.isDead, false, 'Player with 100 HP must survive the first 40 HP crater plunge and respawn');
  assert.equal(game.player.y, 0, 'Respawned player must be placed back at groundY = 0');
  assert.equal(controller.isOverGroundHole2D(game.player.x), false, 'Respawned player must land on hole-free solid ground');

  // 5. Lethal crater plunge at <= 40 HP records exact "How You Died" cause on Overworld AND on Stage 7 Nether Lava Sea!
  game.player.x = 120;
  game.player.y = 0;
  game.player.hp = 30;
  game.player.iFrames = 0;
  for (let step = 0; step < 25 && !game.player.isDead; step++) {
    game.update(0.05);
  }
  assert.equal(game.player.isDead, true, 'Mortal player at 30 HP plunging into a TNT crater must die');
  assert.equal(
    controller.getLastDeathReason(),
    'The Second Coming fell out of the world',
    'Lethal plunge into an Overworld TNT crater must attribute death to falling out of the world'
  );

  // Stage 7 Nether Fortress crater plunge -> lava death message!
  controller.jumpToStage(7, { freshStart: true, creative: false });
  controller.nukeAllEnemies();
  assert.equal(controller.sandbox.groundHoles.length, 0, 'Stage transition must automatically clear previous stage craters');

  controller.carveGroundCrater2D(0, 0);
  assert.equal(controller.sandbox.groundHoles.length, 1);
  game.player.x = 0;
  game.player.y = 0;
  game.player.hp = 30;
  game.player.iFrames = 0;
  game.player.isGodMode = false;
  for (let step = 0; step < 25 && !game.player.isDead; step++) {
    game.update(0.05);
  }
  assert.equal(game.player.isDead, true);
  assert.equal(
    controller.getLastDeathReason(),
    'The Second Coming tried to swim in lava',
    'Lethal plunge into a Stage 7 Nether TNT crater must attribute death to trying to swim in lava'
  );

  // 6. clearCreativeBlocks() repairs all blasted ground holes immediately
  controller.clearCreativeBlocks();
  assert.equal(controller.sandbox.groundHoles.length, 0, 'clearCreativeBlocks() must repair all ground craters');

  resetGlobalSystems();
});

test('2D Expansion [18] Stage 18 The Stronghold (Before The End) & Stage 30 Outside Rocket Corp (Before Rocket Corp HQ): Arenas, Depth Motifs, Hazards & Stone Bricks Block', () => {
  resetGlobalSystems();
  const { game, controller, ctx, calls } = create2DGameHarness();

  // 1. Campaign ordering & selector checks
  const opt18 = STAGE_OPTIONS_2D.find((o) => o.value === 18);
  const opt19 = STAGE_OPTIONS_2D.find((o) => o.value === 19);
  const opt30 = STAGE_OPTIONS_2D.find((o) => o.value === 30);
  const opt31 = STAGE_OPTIONS_2D.find((o) => o.value === 31);
  assert.ok(opt18 && opt18.label.includes('Stronghold'), 'Stage 18 selector must be The Stronghold');
  assert.ok(opt19 && opt19.label.includes('The End'), 'Stage 19 selector must be The End right after The Stronghold');
  assert.ok(opt30 && opt30.label.includes('Outside Rocket Corp'), 'Stage 30 selector must be Outside Rocket Corp');
  assert.ok(opt31 && opt31.label.includes('Rocket Corp HQ'), 'Stage 31 selector must be Rocket Corp HQ right after Outside Rocket Corp');

  assert.equal(getDepthProfile2D('stronghold').motif, 'stronghold_vault', 'stronghold theme must use stronghold_vault depth motif');
  assert.equal(getDepthProfile2D('rocket_corp_exterior').motif, 'rocket_skyline', 'rocket_corp_exterior theme must use rocket_skyline depth motif');

  // Stage 17 clue leads into Stage 18 The Stronghold
  controller.jumpToStage(17, { freshStart: true, creative: false });
  assert.match(String(game.stageManager.campaignBeat?.clue || ''), /STRONGHOLD/i, 'Stage 17 clue must point into The Stronghold');

  // 2. Stage 18: The Stronghold — platforms, End Portal lava pool hazard, wave count, rendering & stone_bricks block
  controller.jumpToStage(18, { freshStart: true, creative: false });
  assert.equal(game.stageManager.currentStage, 18);
  assert.equal(game.stageManager.theme, 'stronghold');
  assert.equal(game.stageManager.stageName, 'The Stronghold');
  assert.equal(game.stageManager.platforms.length, 3, 'Stronghold must have Library, End Portal Sanctum, and Prison Walk platforms');
  assert.equal(game.stageManager.platforms[0]?.title, 'Stronghold_Library_W');
  assert.equal(game.stageManager.platforms[1]?.title, 'End_Portal_Sanctum');
  assert.equal(game.stageManager.platforms[2]?.title, 'Iron_Prison_Walk_E');
  assert.equal(game.stageManager.movingPlatforms.length, 1);
  assert.equal(game.stageManager.movingPlatforms[0]?.title, 'Stone_Brick_Bridge');
  assert.equal(game.stageManager.movingPlatforms[0]?.axis, 'x');
  assert.equal(game.stageManager.lavaHazards.length, 1, 'Stronghold must feature the central End Portal lava pool');
  assert.equal(waves.zombies.length + waves.spawnQueue.length, 16, 'Stronghold wave recipe must queue 16 enemies');

  // Verify stone_bricks Creative voxel block places cleanly
  const brickBlock = controller.placeCreativeBlock('stone_bricks');
  assert.equal(brickBlock.texKey, 'stone_bricks');

  calls.save = 0;
  calls.restore = 0;
  calls.fillText.length = 0;
  game.update(1 / 60);
  game.render();
  assert.equal(calls.save, calls.restore, 'Stage 18 Stronghold must balance ctx.save and ctx.restore');
  assert.equal(game.reportedLayerErrors.size, 0, 'Stage 18 Stronghold must render with zero layer errors');
  assert.ok(
    calls.fillText.some((t) => t.includes('DUNGEON://THE_STRONGHOLD')),
    'Stage 18 Stronghold must paint DUNGEON://THE_STRONGHOLD header'
  );
  assert.ok(
    !calls.fillText.some((t) => t.includes('🪟 START') || t.includes('Stick_vs_Zombies.exe')),
    'Stage 18 Stronghold must suppress the Windows taskbar'
  );

  // Stepping into the Stronghold End Portal lava pool at 15 HP deals 20 burn damage -> "tried to swim in lava"
  controller.nukeAllEnemies();
  controller.clearCreativeBlocks();
  game.player.x = 0;
  game.player.y = 0;
  game.player.hp = 15;
  game.player.iFrames = 0;
  game.update(1 / 60);
  assert.equal(game.player.isDead, true);
  assert.equal(controller.getLastDeathReason(), 'The Second Coming tried to swim in lava');

  // 3. Stage 30: Outside Rocket Corp — perimeter plaza platforms, hover drone, security laser gate, skyscraper background & ground craters
  controller.jumpToStage(30, { freshStart: true, creative: false });
  assert.equal(game.stageManager.currentStage, 30);
  assert.equal(game.stageManager.theme, 'rocket_corp_exterior');
  assert.equal(game.stageManager.stageName, 'Outside Rocket Corp');
  assert.equal(game.stageManager.platforms.length, 3, 'Outside Rocket Corp must have Gatehouse, Overpass, and Armored Van platforms');
  assert.equal(game.stageManager.platforms[0]?.title, 'Security_Gatehouse_W');
  assert.equal(game.stageManager.platforms[1]?.title, 'Rocket_Plaza_Overpass');
  assert.equal(game.stageManager.platforms[2]?.title, 'Armored_Transport_Bay');
  assert.equal(game.stageManager.movingPlatforms.length, 1);
  assert.equal(game.stageManager.movingPlatforms[0]?.title, 'Patrol_Hover_Drone');
  assert.equal(game.stageManager.movingPlatforms[0]?.axis, 'x');
  assert.equal(game.stageManager.laserHazards.length, 1, 'Outside Rocket Corp must feature the perimeter security laser gate');
  assert.equal(waves.zombies.length + waves.spawnQueue.length, 18, 'Outside Rocket Corp wave recipe must queue 18 enemies');

  // Test ground crater rendering for both stronghold & rocket_corp_exterior
  controller.carveGroundCrater2D(-260, 0);
  calls.save = 0;
  calls.restore = 0;
  drawGroundCraters2D(ctx, controller.sandbox.groundHoles, 0, 'stronghold', 1.0);
  drawGroundCraters2D(ctx, controller.sandbox.groundHoles, 0, 'rocket_corp_exterior', 1.0);
  assert.equal(calls.save, calls.restore, 'drawGroundCraters2D for stronghold & rocket_corp_exterior must balance save/restore');
  controller.clearCreativeBlocks();

  calls.save = 0;
  calls.restore = 0;
  calls.fillText.length = 0;
  game.update(1 / 60);
  game.render();
  assert.equal(calls.save, calls.restore, 'Stage 28 Outside Rocket Corp must balance ctx.save and ctx.restore');
  assert.equal(game.reportedLayerErrors.size, 0, 'Stage 28 Outside Rocket Corp must render with zero layer errors');
  assert.ok(
    calls.fillText.some((t) => t.includes('OUTERNET://OUTSIDE_ROCKET_CORP')),
    'Stage 28 Outside Rocket Corp must paint the OUTERNET://OUTSIDE_ROCKET_CORP banner'
  );
  assert.ok(
    calls.fillText.some((t) => t === 'ROCKET CORP'),
    'Stage 28 Outside Rocket Corp must render the towering Rocket Corp HQ skyscraper sign in the background'
  );
  assert.ok(
    !calls.fillText.some((t) => t.includes('🪟 START') || t.includes('Stick_vs_Zombies.exe')),
    'Stage 28 Outside Rocket Corp must suppress the Windows taskbar'
  );

  // Lethal hit from Outside Rocket Corp security laser attributes death to Security Laser
  controller.nukeAllEnemies();
  const secLaser = game.stageManager.laserHazards[0];
  secLaser.timer = 0.1;
  game.player.x = secLaser.x + secLaser.width * 0.5;
  game.player.y = 0;
  game.player.hp = 10;
  game.player.iFrames = 0;
  game.update(1 / 60);
  assert.equal(game.player.isDead, true);
  assert.equal(controller.getLastDeathReason(), 'The Second Coming was vaporized by a Security Laser');

  resetGlobalSystems();
});

test('2D Expansion [19] Purple Ally: Smooth Elytra Swoop, AoE Wind Strike, 2D Elytra Drawing, Wave & King Orange Hi Greeting', () => {
  resetGlobalSystems();
  const { game, controller, calls } = create2DGameHarness();
  controller.jumpToStage(1, { freshStart: true });
  controller.nukeAllEnemies();

  // 1. Purple starts unlocked, has Elytra cooldown, and responds to Key 7 (Digit7)
  assert.equal(allies.unlocked.purple, true, 'Purple must be unlocked by default');
  assert.equal(allies.maxCooldowns.purple, PURPLE_ALLY_CONFIG.cooldown);

  // Spawn a zombie in front of Orange to test Elytra swoop strike damage & launch
  const target = {
    x: game.player.x + 220,
    y: 0,
    vx: 0,
    vy: 0,
    hp: 300,
    maxHp: 300,
    isDead: false,
    isBoss: false,
    isGrounded: true,
    takeDamage(dmg) {
      this.hp -= dmg;
      return dmg;
    }
  };
  waves.zombies.push(target);

  // Trigger via Digit7 keyboard input
  input.keysPressed.Digit7 = true;
  input.update();
  assert.equal(input.actions.ally7, true, 'Digit7 must trigger input.actions.ally7');
  game.update(1 / 60);
  input.endFrame();
  assert.equal(input.actions.ally7, false, 'endFrame must reset input.actions.ally7');

  const purple = allies.activeAllies.find((a) => a.type === 'purple');
  assert.ok(purple, 'Pressing 7 must summon Purple ally');
  assert.equal(purple.flightPhase, 'swoop_in');
  assert.equal(purple.pose, 'elytra_glide');
  assert.ok(purple.y < -300, 'Purple must start high in the sky for his Elytra swoop');
  assert.ok(purple.wingSpread > 0.8, 'Elytra wings must start spread wide');

  // Step through smooth swoop_in -> swoop_strike -> landed (WITHOUT King Orange)
  const ys = [];
  let sawDivePitch = false;
  let sawStrike = false;
  let sawLanded = false;
  let sawTakeoff = false;
  let sawTakeoffUpPitch = false;

  for (let frame = 0; frame < 220; frame++) {
    game.update(1 / 60);
    if (frame % 15 === 0) {
      calls.save = 0;
      calls.restore = 0;
      game.render();
      assert.equal(calls.save, calls.restore, 'Purple Elytra 2D render must balance ctx.save/restore');
    }
    if (purple.flightPhase === 'swoop_in') {
      ys.push(purple.y);
      if (purple.pitchAngle > 0.2) sawDivePitch = true;
    } else if (purple.flightPhase === 'swoop_strike') {
      sawStrike = true;
    } else if (purple.flightPhase === 'landed') {
      sawLanded = true;
    } else if (purple.flightPhase === 'takeoff') {
      sawTakeoff = true;
      if (purple.pitchAngle < -0.15) sawTakeoffUpPitch = true;
    }
  }

  assert.ok(sawDivePitch, 'Purple must pitch smoothly nose-down during Elytra swoop');
  assert.ok(ys.length > 10 && ys[ys.length - 1] > ys[0], 'Purple must smoothly descend along the Bezier swoop curve');
  assert.ok(sawStrike, 'Purple must transition into low-altitude swoop_strike');
  assert.ok(target.hp < 300, 'Purple Elytra swoop must damage zombies along the swoop corridor');
  assert.ok(sawLanded, 'Purple must smoothly land on the ground');
  assert.equal(purple.saidHiToKing, false, 'Without King Orange, Purple must not greet King Orange');
  assert.ok(sawTakeoff && sawTakeoffUpPitch, 'Purple must smoothly pitch nose-up and soar away with his Elytra');
  assert.equal(allies.activeAllies.some((a) => a === purple), false, 'Purple must despawn cleanly after takeoff');

  // 2. Now test WITH King Orange by your side (Stage 12+ / recruited King Orange)
  controller.jumpToStage(12, { freshStart: true });
  controller.nukeAllEnemies();
  speech3d.reset();

  // Let King Orange spawn alongside Orange
  game.update(1 / 60);
  const king = allies.activeAllies.find((a) => a.type === 'king');
  assert.ok(king, 'King Orange must be with the player on Stage 12+');

  allies.cooldowns.purple = 0;
  assert.equal(allies.summonAlly('purple', game.player.x, 0, 1, []), true);
  const purpleWithKing = allies.activeAllies.find((a) => a.type === 'purple');
  assert.ok(purpleWithKing);

  let sawWavePose = false;
  let sawPurpleHiBubble = false;
  let sawKingHiBubble = false;
  for (let frame = 0; frame < 180; frame++) {
    game.update(1 / 60);
    if (purpleWithKing.pose === 'wave') sawWavePose = true;
    for (const b of speech3d.activeBubbles) {
      if (b.text === 'HI, KING!' && String(b.badge).includes('PURPLE')) sawPurpleHiBubble = true;
      if (b.text === 'HI, PURPLE!' && String(b.badge).includes('KING')) sawKingHiBubble = true;
    }
  }

  assert.equal(purpleWithKing.saidHiToKing, true, 'Purple must say Hi when King Orange is with you');
  assert.equal(purpleWithKing.kingReplied, true, 'King Orange must reply Hi to Purple');
  assert.ok(sawWavePose, 'Purple must wave at King Orange upon landing');
  assert.ok(sawPurpleHiBubble, 'Purple must display HI, KING! speech bubble');
  assert.ok(sawKingHiBubble, 'King Orange must display HI, PURPLE! reply bubble');

  // 3. Creative "All Allies" summons both King Orange and Purple
  allies.reset(false, false, false);
  controller.summonAllAllies();
  assert.ok(allies.activeAllies.some((a) => a.type === 'king'), 'summonAllAllies must summon King Orange');
  assert.ok(allies.activeAllies.some((a) => a.type === 'purple'), 'summonAllAllies must summon Purple');

  resetGlobalSystems();
});

test('2D Expansion [20] Old Updates Main Menu Button & Playable Legacy Archive (v1.0, v2.0, v3.0, v4.0 3D)', () => {
  assert.ok(OLD_UPDATES_ARCHIVE.length >= 4, 'Archive must include v1.0, v2.0, v3.0, and v4.0 3D');

  // Verify every archived update build exists on disk, has return_banner.js, and zero external asset URLs
  const badUrl = /(?:src|href)=["']https?:\/\/|url\(\s*["']?https?:\/\//i;
  for (const entry of OLD_UPDATES_ARCHIVE) {
    const fullPath = join(ROOT, entry.path);
    assert.ok(existsSync(fullPath), `Legacy build file must exist: ${entry.path}`);
    const html = readFileSync(fullPath, 'utf8');
    assert.ok(html.includes('return_banner.js'), `${entry.path} must include return_banner.js to go back to Latest Update`);
    assert.doesNotMatch(html, badUrl, `${entry.path} must stay asset-free`);
    assert.equal(
      resolveLegacyUpdateUrl(entry.path, { isSubdir: false, from: '2d' }),
      `${entry.path}?from=2d`
    );
    assert.equal(
      resolveLegacyUpdateUrl(entry.path, { isSubdir: true, from: '3d' }),
      `../${entry.path}?from=3d`
    );
  }
  assert.ok(existsSync(join(ROOT, 'legacy/return_banner.js')), 'Shared return_banner.js must exist');

  // Verify Main Menu button & modal DOM open/close behavior in mock DOM
  const elements = new Map();
  const makeEl = (tag, id = '') => {
    const classes = new Set();
    const listeners = new Map();
    const el = {
      tagName: tag.toUpperCase(),
      id,
      className: '',
      textContent: '',
      innerHTML: '',
      children: [],
      attributes: {},
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); }
      },
      setAttribute(k, v) { this.attributes[k] = v; },
      appendChild(child) {
        this.children.push(child);
        if (child.id) elements.set(child.id, child);
        return child;
      },
      addEventListener(ev, fn) {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      click() {
        for (const fn of listeners.get('click') || []) fn({ target: el });
      }
    };
    if (id) elements.set(id, el);
    return el;
  };

  const titleActions = makeEl('div');
  const gameContainer = makeEl('div', 'game-container');
  const closeBtn = makeEl('button', 'btn-close-old-updates');
  const stayBtn = makeEl('button', 'btn-stay-latest');

  const prevDoc = globalThis.document;
  globalThis.document = {
    body: gameContainer,
    getElementById: (id) => elements.get(id) || null,
    querySelector: (sel) => (sel === '#title-screen .title-actions' ? titleActions : null),
    createElement: (tag) => makeEl(tag)
  };
  try {
    const menu = installOldUpdatesMenu({ isSubdir: false, from: '2d' });
    assert.ok(menu.btn, 'installOldUpdatesMenu must create #btn-old-updates button on Main Menu');
    assert.equal(menu.btn.id, 'btn-old-updates');
    assert.ok(menu.btn.textContent.includes('OLD UPDATES'));
    assert.ok(menu.modal, 'installOldUpdatesMenu must create #old-updates-modal');
    assert.ok(menu.modal.innerHTML.includes('legacy/v1/index.html?from=2d'));
    assert.ok(menu.modal.innerHTML.includes('legacy/v2/index.html?from=2d'));
    assert.ok(menu.modal.innerHTML.includes('legacy/v3/index.html?from=2d'));
    assert.ok(menu.modal.innerHTML.includes('legacy/v4-3d/index.html?from=2d'));

    assert.equal(menu.modal.classList.contains('active'), false);
    menu.btn.click();
    assert.equal(menu.modal.classList.contains('active'), true, 'Clicking OLD UPDATES button must open archive modal');
    closeBtn.click();
    assert.equal(menu.modal.classList.contains('active'), false, 'Clicking Close must close archive modal');
    menu.btn.click();
    stayBtn.click();
    assert.equal(menu.modal.classList.contains('active'), false, 'Clicking Stay on Latest must close archive modal');
  } finally {
    globalThis.document = prevDoc;
  }
});

test('2D Expansion [21] Unlockable Boss Weapons & T Hot-Swap + 8 Playable Stickman Characters (incl. Purple Elytra Glide & King Orange)', () => {
  resetGlobalSystems();
  const { game, controller, calls } = create2DGameHarness();
  const mega = controller.mega;

  // 1. Boss Weapon Unlocks & KeyT Hot-Swap Arsenal
  assert.equal(BOSS_WEAPON_CATALOG.length, 8, 'Catalog must define all 8 weapons');
  mega.unlockedWeapons = new Set(['pencil']);
  if (save.data) save.data.unlockedWeapons = ['pencil'];

  controller.jumpToStage(10, { freshStart: true, creative: false });
  const darkLord = controller.spawnCreativeEntity('dark_lord');
  assert.ok(darkLord, 'Dark Lord boss must spawn');
  darkLord.takeDamage(99999, 1, 0, true);
  assert.ok(mega.unlockedWeapons.has('vira_blades'), 'Defeating The Dark Lord must permanently unlock Dual Vira-Blades');
  assert.ok(save.data.unlockedWeapons.includes('vira_blades'), 'Unlocked weapon must persist to save.data');

  game.player.weaponType = 'pencil';
  controller.handleCreativeKeyDown({ code: 'KeyT', repeat: false, target: { tagName: 'BODY' } });
  assert.equal(game.player.weaponType, 'vira_blades', 'Pressing KeyT must hot-swap to unlocked Dual Vira-Blades');
  controller.handleCreativeKeyDown({ code: 'KeyT', repeat: false, target: { tagName: 'BODY' } });
  assert.equal(game.player.weaponType, 'pencil', 'Pressing KeyT again must cycle back to Giant Pencil');

  // Creative mode exposes all 8 weapons in T-cycle
  assert.equal(mega.getUnlockedWeaponList(true).length, 8, 'Creative mode must expose all 8 weapons');

  // 2. All 8 Playable Stickman Characters
  assert.equal(PLAYABLE_CHARACTERS.length, 8, 'Roster must contain 8 playable stickman characters');

  // King Orange: +30 HP, Golden Crown, starts with Command Staff!
  mega.setCharacter('king', game.player);
  assert.equal(game.player.characterId, 'king');
  assert.equal(game.player.hasCrown, true, 'King Orange must wear a golden crown');
  assert.equal(game.player.weaponType, 'staff', 'King Orange must start with Command Staff');

  // Purple: Interactive mid-air Elytra Glide when holding Space while falling
  mega.setCharacter('purple', game.player);
  assert.equal(game.player.hasElytra, true, 'Purple playable character must have Elytra wings');
  game.player.y = -220;
  game.player.vy = 260;
  game.player.isGrounded = false;
  input.actions.jump = true;
  input.actions.right = true;
  mega.updateCharacterPassives(game.player, 1 / 60, input, [], game.camera, 0);
  assert.equal(game.player.isElytraGliding, true, 'Holding Space mid-air as Purple must activate Elytra glide');
  assert.ok(game.player.vy <= 115, 'Purple Elytra glide must cap downward fall velocity smoothly');
  assert.equal(game.player.pose, 'elytra_glide', 'Purple must adopt elytra_glide pose while gliding');

  // Render Purple + King overlays with balanced save/restore
  calls.save = 0;
  calls.restore = 0;
  mega.drawPlayerCharacterOverlay2D(game.ctx, game.player);
  assert.equal(calls.save, calls.restore, 'Purple playable overlay must balance ctx.save/ctx.restore');

  // Chosen One: Fire Dash Roll burns nearby zombies
  mega.setCharacter('chosen', game.player);
  const burnTarget = controller.spawnCreativeEntity('walker');
  burnTarget.x = game.player.x + 20;
  burnTarget.y = 0;
  const hpBeforeFire = burnTarget.hp;
  game.player.y = 0;
  game.player.isRolling = true;
  game.player._fireDashTick = 0;
  mega.updateCharacterPassives(game.player, 0.05, input, [burnTarget], game.camera, 0);
  assert.ok(burnTarget.hp < hpBeforeFire, 'Chosen One Fire Dash Roll must burn adjacent enemies');

  // Blue: Passive Alchemist HP regeneration
  mega.setCharacter('blue', game.player);
  game.player.hp = 50;
  mega.updateCharacterPassives(game.player, 1.0, input, [], game.camera, 0);
  assert.ok(game.player.hp > 50, 'Blue Alchemist must passively regenerate HP');

  mega.setCharacter('orange', game.player);
  input.resetHeldInputs();
  resetGlobalSystems();
});

test('2D Expansion [22] Boss Rush (13 Bosses incl. Herobrine & Victim), Endless Horde Mutators & Stage Clear Rank Cards (S/A/B/C)', () => {
  resetGlobalSystems();
  const { game, controller } = create2DGameHarness();
  const mega = controller.mega;

  // 1. Stage Clear Rank Card grading (S, A, B, C)
  assert.equal(computeStageRank(25, 0, 20).rank, 'S');
  assert.equal(computeStageRank(35, 30, 8).rank, 'A');
  assert.equal(computeStageRank(55, 50, 2).rank, 'B');
  assert.equal(computeStageRank(95, 110, 0).rank, 'C');

  // 2. Boss Rush Mode: 13 rounds ending with Herobrine (12) & Victim (13)
  assert.equal(BOSS_RUSH_ROSTER.length, 13);
  assert.equal(BOSS_RUSH_ROSTER[11].bossType, 'herobrine_boss');
  assert.equal(BOSS_RUSH_ROSTER[12].bossType, 'victim_boss');

  mega.beginBossRush(controller.jumpToStage, waves, () => game.player, game.groundY, game.camera);
  assert.equal(mega.mode, 'boss_rush');
  assert.equal(mega.bossRushIndex, 0);
  assert.equal(waves.zombies.length, 1);
  assert.equal(waves.zombies[0].type, 'titan_boss', 'Boss Rush Round 1 must spawn Titan Undead');

  // Jump straight to Round 12 (Herobrine) and clear -> advances to Round 13 (Victim) -> completes Boss Rush!
  mega.loadBossRushRound(11, controller.jumpToStage, waves, () => game.player, game.groundY, game.camera);
  assert.equal(waves.zombies[0].type, 'herobrine_boss', 'Boss Rush Round 12 must spawn HerobrineBoss');
  waves.zombies[0].die(true);
  waves.zombies.length = 0;
  mega.updateGameModes(0.1, game.stageManager, waves, game.player, game.groundY, game.camera, {
    jumpToStage: controller.jumpToStage
  });
  assert.equal(mega.bossRushIndex, 12, 'Clearing Round 12 must advance to Round 13');
  assert.equal(waves.zombies[0].type, 'victim_boss', 'Boss Rush Round 13 must spawn VictimBoss');

  waves.zombies[0].die(true);
  waves.zombies.length = 0;
  mega.updateGameModes(0.1, game.stageManager, waves, game.player, game.groundY, game.camera, {
    jumpToStage: controller.jumpToStage
  });
  assert.equal(mega.bossRushComplete, true, 'Clearing Round 13 must complete Boss Rush');
  assert.equal(save.data.unlocks.bossRush, true);
  assert.ok(Number.isFinite(save.data.best.bossRushTime), 'Boss Rush completion must save best time');

  // 3. Endless Horde Mode: valid { type, delay } spawnQueue items + wave progression + mutators
  assert.ok(ENDLESS_MUTATORS.length >= 6);
  mega.beginEndlessHorde(controller.jumpToStage, waves, () => game.player, game.groundY, game.camera);
  assert.equal(mega.mode, 'endless');
  assert.equal(mega.endlessWave, 1);
  assert.ok(waves.spawnQueue.length >= 8, 'Endless Wave 1 must populate spawnQueue');
  assert.equal(typeof waves.spawnQueue[0], 'object', 'Endless spawnQueue entries must be { type, delay } objects');
  assert.equal(typeof waves.spawnQueue[0].type, 'string');

  // Step waves.update to confirm Endless spawnQueue spawns real Zombie entities cleanly!
  waves.spawnTimer = 0;
  waves.update(0.05, game.player, game.groundY, [], game.camera);
  assert.ok(waves.zombies.length >= 1, 'Endless spawnQueue must spawn live zombies cleanly');

  // Clear wave 1 -> advances to wave 2 with mutator!
  waves.spawnQueue.length = 0;
  waves.zombies.length = 0;
  mega.updateGameModes(0.1, game.stageManager, waves, game.player, game.groundY, game.camera, {
    jumpToStage: controller.jumpToStage
  });
  assert.equal(mega.endlessWave, 2, 'Clearing Endless Wave 1 must launch Wave 2');
  assert.ok(save.data.best.endlessWave >= 2, 'Endless Wave record must persist in save.data');

  resetGlobalSystems();
});

test('2D Expansion [23] Tag-Team Ally Combo Synergies & Interactive Stage Toys + Trophy Room Boss Rematch', () => {
  resetGlobalSystems();
  const { game, controller, calls } = create2DGameHarness();
  const mega = controller.mega;

  // 1. All 4 Tag-Team Synergies trigger & affect enemies
  controller.jumpToStage(1, { freshStart: true });
  controller.nukeAllEnemies();
  const foe = controller.spawnCreativeEntity('brute');
  foe.x = 0;
  foe.y = 0;
  foe.hp = 1000;
  foe.maxHp = 1000;

  // Synergy A: Purple + King Orange -> Sky Command Dive
  allies.activeAllies = [
    { type: 'purple', x: 0, y: 0, facing: 1, hasActed: true, isDead: false, retreating: false },
    { type: 'king', x: -60, y: 0, facing: 1, isDead: false, retreating: false }
  ];
  mega.updateAllySynergies(1 / 60, allies, game.player, [foe], game.camera, 0);
  assert.ok(mega.triggeredSynergies.includes('purple_king'), 'Purple + King must trigger Sky Command Dive synergy');
  assert.ok(foe.hp < 1000, 'Sky Command Dive must deal AoE damage');

  // Synergy B: Blue + Yellow Turret -> Frost Turret Overclock
  allies.activeAllies = [{ type: 'blue', x: 0, y: 0, facing: 1, isDead: false, retreating: false }];
  allies.turrets = [{ x: 40, y: 0, duration: 3, isDead: false }];
  mega.updateAllySynergies(1 / 60, allies, game.player, [foe], game.camera, 0);
  assert.ok(mega.triggeredSynergies.includes('blue_yellow'), 'Blue + Yellow Turret must trigger Frost Turret synergy');
  assert.equal(allies.turrets[0].isFrostTurret, true);
  assert.ok(foe.freezeTimer > 0, 'Frost Turret synergy must freeze enemies');

  // Synergy C: Red + Green -> Bass Meteor Dunk
  const hpBeforeBass = foe.hp;
  allies.activeAllies = [
    { type: 'red', x: 0, y: 0, facing: 1, isDead: false, retreating: false },
    { type: 'green', x: 30, y: 0, facing: 1, isDead: false, retreating: false }
  ];
  mega.updateAllySynergies(1 / 60, allies, game.player, [foe], game.camera, 0);
  assert.ok(mega.triggeredSynergies.includes('red_green'), 'Red + Green must trigger Bass Meteor Dunk synergy');
  assert.ok(foe.hp < hpBeforeBass);

  // Synergy D: The Chosen One + Awakened Orange -> Twin Hollow Beam
  const hpBeforeBeam = foe.hp;
  game.player.x = -100;
  game.player.facing = 1;
  game.player.isAwakened = true;
  allies.activeAllies = [{ type: 'chosen', x: -80, y: 0, facing: 1, isDead: false, retreating: false }];
  mega.updateAllySynergies(1 / 60, allies, game.player, [foe], game.camera, 0);
  assert.ok(mega.triggeredSynergies.includes('tco_orange'), 'TCO + Awakened Orange must trigger Twin Hollow Beam');
  assert.ok(foe.hp < hpBeforeBeam);
  game.player.isAwakened = false;

  // 2. Interactive Stage Toys: Stage 25 Overworld (Slime Pads & Minecart)
  controller.jumpToStage(25, { freshStart: true });
  assert.ok(mega.stageToys.some((t) => t.kind === 'slime_pad'), 'Stage 25 Overworld must spawn bouncy Slime Pads');
  assert.ok(mega.stageToys.some((t) => t.kind === 'minecart'), 'Stage 25 Overworld must spawn a kickable Minecart');

  const pad = mega.stageToys.find((t) => t.kind === 'slime_pad');
  game.player.x = pad.x;
  game.player.y = 0;
  game.player.vy = 0;
  mega.updateStageToys(1 / 60, game.player, [], game.camera, game.stageManager, 0);
  assert.equal(game.player.vy, -780, 'Stepping on Slime Pad must launch player sky-high');

  const cart = mega.stageToys.find((t) => t.kind === 'minecart');
  const bowlingTarget = controller.spawnCreativeEntity('walker');
  bowlingTarget.x = cart.x + 25;
  bowlingTarget.y = 0;
  const hpBeforeCart = bowlingTarget.hp;
  mega.triggerStageToy(cart, { facing: 1 }, [bowlingTarget], game.camera, 0);
  mega.updateStageToys(0.04, game.player, [bowlingTarget], game.camera, game.stageManager, 0);
  assert.ok(Math.abs(cart.vx) > 200, 'Minecart must roll forward when kicked');
  assert.ok(bowlingTarget.hp < hpBeforeCart, 'Rolling Minecart must bowl through zombies');

  // 3. Stage 26 YouTube Pause, Stage 28 Spotify Skip, Stage 29 Slides Present
  controller.jumpToStage(26);
  const ytPause = mega.stageToys.find((t) => t.kind === 'app_pause_btn');
  assert.ok(ytPause, 'Stage 26 YouTube must spawn interactive Pause button');
  const frozenFoe = controller.spawnCreativeEntity('walker');
  mega.triggerStageToy(ytPause, game.player, [frozenFoe], game.camera, 0);
  assert.equal(mega.videoPauseTimer, 3.5, 'Hitting YouTube Pause must set 3.5s video freeze timer');
  assert.ok(frozenFoe.freezeTimer > 0, 'YouTube Pause must freeze enemies');

  controller.jumpToStage(28);
  const spSkip = mega.stageToys.find((t) => t.kind === 'app_skip_btn');
  assert.ok(spSkip, 'Stage 28 Spotify must spawn interactive Skip button');
  const stunnedFoe = controller.spawnCreativeEntity('brute');
  mega.triggerStageToy(spSkip, game.player, [stunnedFoe], game.camera, 0);
  assert.ok(stunnedFoe.stunTimer > 0, 'Spotify Skip must stun enemies with a bass drop');

  controller.jumpToStage(29);
  const slPresent = mega.stageToys.find((t) => t.kind === 'app_present_btn');
  assert.ok(slPresent, 'Stage 29 Slides must spawn interactive Present button');
  mega.triggerStageToy(slPresent, game.player, [], game.camera, 0);
  assert.equal(mega.slideWipeX, -960, 'Slides Present button must launch the slide wipe curtain');

  calls.save = 0;
  calls.restore = 0;
  mega.drawStageToys2D(game.ctx, 0.5, 0);
  assert.equal(calls.save, calls.restore, 'drawStageToys2D must balance ctx.save/ctx.restore');

  // 4. Interactive Trophy Room Boss Rematch (Stage 33 -> Stage 10 Dark Lord via KeyE)
  assert.equal(TROPHY_MONUMENT_BOSSES.length, 11);
  controller.jumpToStage(33);
  assert.equal(game.stageManager.isTrophyRoom, true);
  game.player.x = -685; // Dark Lord monument
  mega.updateStageToys(1 / 60, game.player, [], game.camera, game.stageManager, 0);
  assert.equal(mega.nearbyTrophyBoss?.stage, 10, 'Standing near Dark Lord monument must prompt Stage 10 rematch');
  controller.handleCreativeKeyDown({ code: 'KeyE', repeat: false, target: { tagName: 'BODY' }, preventDefault() {} });
  mega.updateStageToys(1 / 60, game.player, [], game.camera, game.stageManager, 0, (m) => controller.jumpToStage(m.stage));
  assert.equal(game.stageManager.currentStage, 10, 'Pressing KeyE at Dark Lord trophy must launch instant Stage 10 rematch');

  resetGlobalSystems();
});

test('2D Expansion [24] Perfect Dodge, Rare Loot Drops, Roguelike Perks, Secret Bosses (Herobrine & Victim) & 2P Co-op / 1v1 Versus', () => {
  resetGlobalSystems();
  const { game, controller, calls } = create2DGameHarness();
  const mega = controller.mega;

  // 1. Perfect Dodge ("FRAME PERFECT!") + Counter Crit
  controller.jumpToStage(1, { freshStart: true });
  controller.nukeAllEnemies();
  const threat = controller.spawnCreativeEntity('brute');
  threat.x = game.player.x + 85;
  threat.y = 0;
  mega.prevRollState = false;
  game.player.isRolling = true;
  const superBefore = game.player.superMeter;
  const dodged = mega.checkPerfectDodge(game.player, [threat], projectiles, game.stageManager, game.camera);
  assert.equal(dodged, true, 'Rolling near an enemy must trigger Perfect Dodge');
  assert.equal(game.player.perfectCounterReady, true, 'Perfect Dodge must prime Counter Crit');
  assert.ok(game.player.superMeter > superBefore, 'Perfect Dodge must grant bonus Awakening meter');

  const hpBeforeCounter = threat.hp;
  mega.onPlayerMeleeOrWeaponHit(game.player, [threat], game.camera, false);
  assert.equal(game.player.perfectCounterReady, false, 'Counter Crit must consume perfectCounterReady');
  assert.ok(threat.hp < hpBeforeCounter, 'Counter Crit must deal bonus burst damage');

  // 2. Rare Loot Drops (Golden Apple, Firework Rocket, Lucky Dice, Glitch Bomb)
  game.player.hp = 40;
  mega.spawnLootDrop(game.player.x, 0, 'golden_apple');
  mega.spawnLootDrop(game.player.x + 120, 0, 'glitch_bomb');
  calls.save = 0;
  calls.restore = 0;
  mega.drawLootDrops2D(game.ctx);
  assert.equal(calls.save, calls.restore, 'drawLootDrops2D must balance ctx.save/ctx.restore');
  mega.updateLootDrops(1 / 60, game.player, [threat], allies, 0, game.camera);
  assert.ok(game.player.hp >= 80 && mega.goldenShieldTimer > 0, 'Collecting Golden Apple must heal +40 HP & grant shield');

  // 3. Roguelike Perks (1-of-3 Picker + Stat Effects)
  assert.equal(ROGUELIKE_PERKS.length, 8);
  const picks = mega.rollPerkChoices(3);
  assert.equal(picks.length, 3, 'Perk picker must offer 3 choices');
  assert.equal(new Set(picks.map((p) => p.id)).size, 3, 'All 3 offered perks must be distinct');
  const prevJump = game.player.jumpForce;
  mega.applyPerk('slime_boots', game.player, allies);
  assert.ok(game.player.jumpForce >= prevJump + 110, 'Slime Bounce Boots perk must increase jumpForce');

  // 4. Secret Bosses: HerobrineBoss & VictimBoss AI, Phase 2, Defeat & Balanced 2D Render
  controller.launchSecretBoss('herobrine_boss');
  const herobrine = waves.zombies.find((z) => z.type === 'herobrine_boss');
  assert.ok(herobrine instanceof HerobrineBoss, 'launchSecretBoss must spawn HerobrineBoss');
  for (let i = 0; i < 45; i++) herobrine.update(0.04, 0, game.player, [], game.camera);
  herobrine.takeDamage(herobrine.maxHp * 0.55, 1, 100, true);
  herobrine.update(0.04, 0, game.player, [], game.camera);
  assert.equal(herobrine.phase, 2, 'HerobrineBoss must enter Phase 2 below 50% HP');
  calls.save = 0;
  calls.restore = 0;
  herobrine.draw(game.ctx, false);
  assert.equal(calls.save, calls.restore, 'HerobrineBoss.draw must balance ctx.save/ctx.restore');
  herobrine.takeDamage(99999, 1, 100, true);
  assert.equal(herobrine.isDead, true);

  controller.launchSecretBoss('victim_boss');
  const victim = waves.zombies.find((z) => z.type === 'victim_boss');
  assert.ok(victim instanceof VictimBoss, 'launchSecretBoss must spawn VictimBoss');
  for (let i = 0; i < 50; i++) victim.update(0.04, 0, game.player, [], game.camera);
  victim.takeDamage(victim.maxHp * 0.55, 1, 100, true);
  victim.update(0.04, 0, game.player, [], game.camera);
  assert.equal(victim.phase, 2, 'VictimBoss must enter Phase 2 below 50% HP');
  calls.save = 0;
  calls.restore = 0;
  victim.draw(game.ctx, false);
  assert.equal(calls.save, calls.restore, 'VictimBoss.draw must balance ctx.save/ctx.restore');
  victim.takeDamage(99999, 1, 100, true);
  assert.equal(victim.isDead, true);

  // 5. Local 2P Co-op & 1v1 Stickman Versus Duel
  controller.jumpToStage(1, { freshStart: true });
  controller.nukeAllEnemies();
  mega.startP2Mode('coop', game.player, 0);
  assert.equal(mega.p2.active, true);
  const p2StartX = mega.p2.x;
  mega.handleP2KeyDown('ArrowRight');
  input.keys.ArrowRight = true;
  input.keys.KeyD = false;
  mega.isolateP1InputsForCoop(input);
  assert.equal(input.actions.right, false, 'ArrowRight must be isolated from P1 when P2 Co-op is active');
  for (let i = 0; i < 12; i++) {
    mega.updateP2(1 / 60, game.player, [], 0, [], game.camera);
    mega.endP2Frame();
  }
  assert.ok(mega.p2.x > p2StartX + 10, 'P2 must move smoothly with ArrowRight in Co-op');
  mega.handleP2KeyUp('ArrowRight');

  calls.save = 0;
  calls.restore = 0;
  mega.drawP22D(game.ctx);
  assert.equal(calls.save, calls.restore, 'drawP22D must balance ctx.save/ctx.restore');

  // 1v1 Versus Best-of-3 Duel
  mega.startP2Mode('versus', game.player, 0);
  assert.equal(mega.mode, 'versus');
  mega.p2.hp = 0;
  mega.updateP2(1 / 60, game.player, [], 0, [], game.camera);
  assert.equal(mega.versusP1Wins, 1, 'KOing P2 in Round 1 must award P1 a round win');
  mega.versusRoundResetTimer = 0.01;
  mega.updateP2(0.05, game.player, [], 0, [], game.camera);
  assert.equal(mega.versusRound, 2, 'Versus must transition cleanly to Round 2');
  mega.p2.hp = 0;
  mega.updateP2(1 / 60, game.player, [], 0, [], game.camera);
  assert.equal(mega.versusWinner, 'P1', 'Winning 2 rounds must crown P1 as Best-of-3 Duel Champion');

  mega.stopP2Mode();
  input.resetHeldInputs();
  resetGlobalSystems();
});

test('2D Expansion [25] Stage 23 Ice Caves & Stage 24 Desert Pyramid Interior (2 Levels Before Overworld Village): Arenas, Depth Motifs, Pyramid TNT Trap & Creative Blocks', () => {
  resetGlobalSystems();
  const { game, controller, ctx, calls } = create2DGameHarness();

  // 1. Verify exact campaign order: Pale Garden (22) -> Ice Caves (23) -> Desert Pyramid Interior (24) -> Minecraft Overworld Village (25)
  const opt22 = STAGE_OPTIONS_2D.find((o) => o.value === 22);
  const opt23 = STAGE_OPTIONS_2D.find((o) => o.value === 23);
  const opt24 = STAGE_OPTIONS_2D.find((o) => o.value === 24);
  const opt25 = STAGE_OPTIONS_2D.find((o) => o.value === 25);
  assert.ok(opt22 && opt22.label.includes('Pale Garden'));
  assert.ok(opt23 && opt23.label.includes('Ice Caves'), 'Stage 23 must be Ice Caves');
  assert.ok(opt24 && opt24.label.includes('Desert Pyramid Interior'), 'Stage 24 must be Desert Pyramid Interior');
  assert.ok(opt25 && opt25.label.includes('Minecraft Overworld'), 'Stage 25 must be Minecraft Overworld Village right after the 2 new levels');

  // Verify depth-of-field profiles & offscreen plane baking for both new biomes
  assert.equal(getDepthProfile2D('ice_caves').motif, 'ice_cavern');
  assert.equal(getDepthProfile2D('desert_pyramid').motif, 'pyramid_chambers');
  for (const [stg, theme] of [[23, 'ice_caves'], [24, 'desert_pyramid']]) {
    let baked = 0;
    const depth = new Depth2DRenderer({
      createCanvas: (w, h) => ({
        width: w,
        height: h,
        getContext: () => {
          baked += 1;
          return createCanvasMock().ctx;
        }
      })
    });
    depth.drawBackgroundDepthPlanes(
      createCanvasMock().ctx,
      { currentStage: stg, theme, isTrophyRoom: false, bounds: { minX: -1200, maxX: 1200, minY: -620 } },
      { x: 0, y: -140 },
      0,
      false
    );
    assert.equal(baked, 2, `${theme} must bake both Far and Mid blurred depth planes`);
  }

  // Stage 22 clue points into Ice Caves
  controller.jumpToStage(22, { freshStart: true, creative: false });
  assert.match(String(game.stageManager.campaignBeat?.clue || ''), /ICE CAVES/i);

  // 2. Stage 23: Ice Caves — platforms, drifting ice floe, wave count, rendering, taskbar suppression & Creative ice blocks
  controller.jumpToStage(23, { freshStart: true, creative: false });
  assert.equal(game.stageManager.currentStage, 23);
  assert.equal(game.stageManager.theme, 'ice_caves');
  assert.equal(game.stageManager.stageName, 'Ice Caves');
  assert.match(String(game.stageManager.campaignBeat?.clue || ''), /DESERT PYRAMID/i);
  assert.equal(game.stageManager.platforms.length, 3);
  assert.equal(game.stageManager.movingPlatforms.length, 1);
  assert.equal(game.stageManager.movingPlatforms[0]?.title, 'Drifting_Ice_Floe');
  assert.equal(game.stageManager.movingPlatforms[0]?.axis, 'x');
  assert.equal(waves.zombies.length + waves.spawnQueue.length, 16, 'Ice Caves must queue 16 enemies');

  const packedIce = controller.placeCreativeBlock('packed_ice');
  const blueIce = controller.placeCreativeBlock('blue_ice');
  assert.equal(packedIce.texKey, 'packed_ice');
  assert.equal(blueIce.texKey, 'blue_ice');

  calls.save = 0;
  calls.restore = 0;
  calls.fillText.length = 0;
  game.update(1 / 60);
  game.render();
  assert.equal(calls.save, calls.restore, 'Stage 23 Ice Caves must balance ctx.save and ctx.restore');
  assert.equal(game.reportedLayerErrors.size, 0, 'Stage 23 Ice Caves must render with zero layer errors');
  assert.ok(calls.fillText.some((t) => t.includes('BIOME://ICE_CAVES')), 'Stage 23 must paint BIOME://ICE_CAVES header');
  assert.ok(!calls.fillText.some((t) => t.includes('🪟 START')), 'Stage 23 Ice Caves must suppress Windows taskbar');

  // 3. Stage 24: Desert Pyramid Interior — sandstone platforms, counterweight, pre-placed Pyramid TNT trap blocks, rendering & ground craters
  controller.jumpToStage(24, { freshStart: true, creative: false });
  assert.equal(game.stageManager.currentStage, 24);
  assert.equal(game.stageManager.theme, 'desert_pyramid');
  assert.equal(game.stageManager.stageName, 'Desert Pyramid Interior');
  assert.match(String(game.stageManager.campaignBeat?.clue || ''), /OVERWORLD/i);
  assert.equal(game.stageManager.platforms.length, 3);
  assert.equal(game.stageManager.movingPlatforms.length, 1);
  assert.equal(game.stageManager.movingPlatforms[0]?.title, 'Sandstone_Counterweight');
  assert.equal(game.stageManager.movingPlatforms[0]?.axis, 'x');
  assert.equal(waves.zombies.length + waves.spawnQueue.length, 16, 'Desert Pyramid Interior must queue 16 enemies');

  assert.equal(
    controller.sandbox.blocks.length,
    DESERT_PYRAMID_TRAP_BLOCKS.length,
    'Stage 24 Desert Pyramid Interior must pre-spawn its 5 sandstone/terracotta/TNT vault blocks'
  );
  const pyramidTNT = controller.sandbox.blocks.find((b) => b.texKey === 'tnt_block');
  assert.ok(pyramidTNT, 'Desert Pyramid Interior vault must include an armed-on-hit TNT trap block');

  // Ground crater rendering balances save/restore on both new biomes
  controller.carveGroundCrater2D(-260, 0);
  calls.save = 0;
  calls.restore = 0;
  drawGroundCraters2D(ctx, controller.sandbox.groundHoles, 0, 'ice_caves', 1.0);
  drawGroundCraters2D(ctx, controller.sandbox.groundHoles, 0, 'desert_pyramid', 1.0);
  assert.equal(calls.save, calls.restore, 'drawGroundCraters2D for ice_caves & desert_pyramid must balance save/restore');
  controller.clearCreativeBlocks();

  calls.save = 0;
  calls.restore = 0;
  calls.fillText.length = 0;
  game.update(1 / 60);
  game.render();
  assert.equal(calls.save, calls.restore, 'Stage 24 Desert Pyramid Interior must balance ctx.save and ctx.restore');
  assert.equal(game.reportedLayerErrors.size, 0, 'Stage 24 Desert Pyramid Interior must render with zero layer errors');
  assert.ok(
    calls.fillText.some((t) => t.includes('DUNGEON://DESERT_PYRAMID_INTERIOR')),
    'Stage 24 must paint DUNGEON://DESERT_PYRAMID_INTERIOR header'
  );
  assert.ok(!calls.fillText.some((t) => t.includes('🪟 START')), 'Stage 24 Desert Pyramid Interior must suppress Windows taskbar');

  resetGlobalSystems();
});






