import * as THREE from '../lib/three.module.min.js';
import { audio } from '../../js/engine/audio.js?v=9.8';
import { input } from '../../js/engine/input.js?v=9.8';
import { Camera } from '../../js/engine/camera.js?v=9.8';
import { particles } from '../../js/engine/particles.js?v=9.8';
import { Player } from '../../js/entities/player.js?v=9.8';
import { waves } from '../../js/systems/waves.js?v=9.8';
import { combat } from '../../js/systems/combat.js?v=9.8';
import { shop } from '../../js/systems/shop.js?v=9.8';
import { CAMPAIGN_BEATS, stages } from '../../js/systems/stages.js?v=9.8';
import { projectiles } from '../../js/entities/projectiles.js?v=9.8';
import { allies } from '../../js/entities/allies.js?v=9.8';
import { speech3d as speech } from './speech3d.js?v=10.3';
import { save } from '../../js/systems/save.js?v=9.8';

import {
  Arena3DBuilder,
  WORLD_TO_3D,
  ARENA_HALF_Z,
  to3DX,
  to3DY,
  to3DZ
} from './arena3d.js?v=10.3';
import {
  filterPlatformsForEntity,
  resolveSweptVerticalCollision,
  checkPlatformStepOff,
  clampEnclosedWalls,
  isOpenEdgeTheme,
  CREATIVE_BLOCK_SIZE_2D,
  ISLAND_FLOOR_BOUNDS,
  VOID_FALL_THRESHOLD,
  isEntityOverIsland,
  checkLavaHazard
} from './physics3d.js?v=10.3';
import {
  StickRig3D,
  CreeperLordRig3D,
  GiantCatRig3D,
  LuckyOrbRig3D,
  EnderDragonRig3D,
  buildVoxelWeaponMesh,
  createTurretMesh3D,
  createViraBotMesh3D
} from './models3d.js?v=10.3';
import { getVoxelTexture } from './textures3d.js?v=10.3';
import { extendCampaignFor3D, CAMPAIGN_BEATS_3D } from './campaign3d.js?v=10.3';

const CAMERA_MODES = ['CHASE_3D', 'ISOMETRIC_3D', 'SIDE_25D'];
const CAMERA_LABELS = {
  CHASE_3D: '🎥 3D Chase Cam (Tab)',
  ISOMETRIC_3D: '🎥 Isometric 3D (Tab)',
  SIDE_25D: '🎥 2.5D Side Cam (Tab)'
};

// Zero-allocation scratch structures for per-frame execution (F2.1)
const _scratchProj = new THREE.Vector3();
const _screenPoint = { x: 0, y: 0, zDepth: 0, visible: true, scale: 1.0 };
const _camLookTarget = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const ALLY_TYPES = ['red', 'blue', 'yellow', 'green', 'cursor', 'chosen', 'king'];

// ============================================================================
// Feature F2.2: Shared Static Geometries & Materials (flagged isShared = true)
// ============================================================================

// 1. Voxel Hit Bursts (Unit Cube: scaled via mesh.scale.setScalar(size))
export const SHARED_VOXEL_GEO = new THREE.BoxGeometry(1, 1, 1);
SHARED_VOXEL_GEO.isShared = true;

// 2. Floor Splat Decals (Unit 1x0.04x1 Box Decal: scaled via mesh.scale.set(r, 1, r))
export const SHARED_SPLAT_GEO = new THREE.BoxGeometry(1, 0.04, 1);
SHARED_SPLAT_GEO.isShared = true;
export const SHARED_SPLAT_MAT = new THREE.MeshBasicMaterial({
  color: 0x991b1b,
  transparent: true,
  opacity: 0.7,
  depthWrite: false
});
SHARED_SPLAT_MAT.isShared = true;

// 3. Attack & Boss Telegraph Rings
export const SHARED_TELEGRAPH_GEO = new THREE.RingGeometry(0.4, 3.2, 28);
SHARED_TELEGRAPH_GEO.rotateX(-Math.PI / 2);
SHARED_TELEGRAPH_GEO.isShared = true;
export const SHARED_TELEGRAPH_MAT = new THREE.MeshBasicMaterial({
  color: 0xff2244,
  transparent: true,
  opacity: 0.48,
  side: THREE.DoubleSide,
  depthWrite: false
});
SHARED_TELEGRAPH_MAT.isShared = true;

// 4. Creative Mode Voxel Blocks (68 * WORLD_TO_3D = 2.0 units)
export const CREATIVE_BLOCK_SIZE = 68 * WORLD_TO_3D;
export const CREATIVE_BLOCK_GEO = new THREE.BoxGeometry(
  CREATIVE_BLOCK_SIZE,
  CREATIVE_BLOCK_SIZE,
  CREATIVE_BLOCK_SIZE
);
CREATIVE_BLOCK_GEO.isShared = true;

// 5. Projectiles & Props Shared Geometries
export const SHARED_SKETCH_BLOCK_GEO = new THREE.BoxGeometry(1, 1, 1);
SHARED_SKETCH_BLOCK_GEO.isShared = true;
let _sharedSketchMat = null;

export const SHARED_ANVIL_BASE_GEO = new THREE.BoxGeometry(1.8, 0.5, 1.4);
SHARED_ANVIL_BASE_GEO.isShared = true;
export const SHARED_ANVIL_NECK_GEO = new THREE.BoxGeometry(1.1, 0.6, 0.9);
SHARED_ANVIL_NECK_GEO.isShared = true;
export const SHARED_ANVIL_TOP_GEO = new THREE.BoxGeometry(2.2, 0.75, 1.5);
SHARED_ANVIL_TOP_GEO.isShared = true;
let _sharedAnvilMat = null;

export const SHARED_PROJECTILE_SPHERE_GEO = new THREE.SphereGeometry(0.36, 10, 10);
SHARED_PROJECTILE_SPHERE_GEO.isShared = true;

export const SHARED_HAZARD_CYLINDER_GEO = new THREE.CylinderGeometry(1, 1, 0.14, 16);
SHARED_HAZARD_CYLINDER_GEO.isShared = true;

export const SHARED_INK_DROP_GEO = new THREE.OctahedronGeometry(0.32, 0);
SHARED_INK_DROP_GEO.isShared = true;
export const SHARED_INK_DROP_MAT = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  emissive: 0x00f5ff,
  emissiveIntensity: 0.9,
  roughness: 0.2
});
SHARED_INK_DROP_MAT.isShared = true;

/**
 * Recursively disposes geometries and materials in a Three.js hierarchy.
 * Respects .isShared and .userData.isShared flags when keepShared is true.
 * @param {THREE.Object3D} root
 * @param {boolean} [keepShared=true]
 */
export function disposeHierarchy(root, keepShared = true) {
  if (!root) return;
  root.traverse((child) => {
    if (child.geometry) {
      if (!keepShared || (!child.geometry.isShared && !child.geometry.userData?.isShared)) {
        child.geometry.dispose?.();
      }
    }
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m) continue;
        if (!keepShared || (!m.isShared && !m.userData?.isShared)) {
          m.dispose?.();
        }
      }
    }
  });
}

function wrapEnemyUpdate3D(e, game) {
  if (!e || e._origUpdate3D) return;
  e._origUpdate3D = e.update;
  e.update = function(dt, groundY, player, sketchBlocks, camera, platforms, zombies, friendlyTargets) {
    const currentPlatforms = game.getAllActivePlatforms();
    const zFiltered = filterPlatformsForEntity(this, currentPlatforms, 0);
    const prevY = this.y;

    let effectiveGroundY = groundY;
    const isOpenStage = isOpenEdgeTheme(game.stageManager?.theme);
    const isFlyingBoss = this.type === 'ender_dragon' || Boolean(this.isFlying);

    if (isOpenStage && !isFlyingBoss) {
      const isOverIsland = isEntityOverIsland(this);
      const isOnPlatform = zFiltered.some(p => {
        const halfW = (p.width || 60) * 0.5;
        const pTop = p.y - (p.height || 60);
        return this.x >= p.x - halfW && this.x <= p.x + halfW && this.y >= pTop - 10 && this.y <= pTop + 24;
      });

      if (!isOverIsland && !isOnPlatform) {
        effectiveGroundY = 99999;
      }
    }

    const res = this._origUpdate3D(dt, effectiveGroundY, player, sketchBlocks, camera, zFiltered, zombies, friendlyTargets);
    resolveSweptVerticalCollision(this, zFiltered, prevY, dt);
    checkPlatformStepOff(this);
    return res;
  };
}

export class Game3D {
  constructor() {
    this.webglCanvas = document.getElementById('webglCanvas');
    this.overlayCanvas = document.getElementById('gameCanvas');
    this.ctx = this.overlayCanvas.getContext('2d');

    this.groundY = 0;
    this.camera2D = new Camera(this.overlayCanvas);
    this.stageManager = stages;
    extendCampaignFor3D(this.stageManager, waves);
    this.player = new Player(this.stageManager.entranceDoor.x + 30, this.groundY);
    this.player.z = 0;
    this.player.vz = 0;
    this.player.yaw = Math.PI / 2;
    this.lastSafeIslandPos = { x: this.player.x, y: this.groundY, z: 0 };

    this.state = 'TITLE';
    this.lastTime = 0;
    this.hudSyncTimer = 0;
    this.hudCache = Object.create(null);
    this.hostileTargets = [];
    this.stageCheckpoint = null;
    this.weaponPickup = null;
    this.missionStripTimer = 0;

    this.cameraModeIndex = 0;
    this.keys3D = Object.create(null);

    // Creative Sandbox Mode State
    this.creativeMode = false;
    this.creativeGodMode = true;
    this.creativeFlyMode = false;
    this.creativeFreezeAI = false;
    this.creativeWeaponOverride = null;
    this.creativeBlocks = [];
    this._activeLavaHazards = [];
    this.lastSpaceTapTime = 0;

    this.initThreeScene();
    this.arena3D = new Arena3DBuilder(this.scene, this.stageManager);

    // Entity 3D Mesh Maps
    this.enemyRigs = new Map();
    this.allyRigs = new Map();
    this.turretMeshes = new Map();
    this.sketchBlockMeshes = new Map();
    this.anvilMeshes = new Map();
    this.projectileMeshes = new Map();
    this.hazardMeshes = new Map();
    this.inkMeshes = new Map();
    this.telegraphMeshes = new Map();
    // Zero-allocation persistent scratch structures (F2.1)
    this._scratchEntitySet = new Set();
    this._alignedPlatforms = [];
    this._allPlatforms = [];
    this.viewportWidth = typeof window !== 'undefined' ? (window.innerWidth || 1280) : 1280;
    this.viewportHeight = typeof window !== 'undefined' ? (window.innerHeight || 720) : 720;
    this.cameraAdapter = {
      zoom: 1,
      worldToScreen: (wx, wy, wz = 0) => this.projectWorldToOverlay(wx, wy, wz)
    };
    this.lastHudValues = Object.create(null);

    // Milestone 3 (F3.1, F3.2): Combat combo, grab, clutch & stage reaction tracking
    this.lastComboMilestone = 0;
    this.lastGrabHitApplied = false;
    this.clutchReactionTriggered = false;
    this.clutchCooldownTimer = 0;
    this.lastStageObjectiveComplete = false;

    // Feature F2.2: Pools & Material Caches
    this.voxelParticles = [];
    this.voxelParticlePool = [];
    this.voxelMaterialCache = new Map();

    this.floorSplats3D = [];
    this.floorSplatPool = [];

    this.telegraphMeshPool = [];
    this.creativeBlockPool = [];
    this.creativeMaterialCache = new Map();

    this.projectileMaterialCache = new Map();
    this.hazardMaterialCache = new Map();

    this.buildPlayer3D();
    this.buildSpecialEffectMeshes();
  }

  initThreeScene() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.webglCanvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1324);
    this.scene.fog = new THREE.FogExp2(0x0b1324, 0.011);

    this.camera3D = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 220);
    this.camera3D.position.set(0, 12, 26);

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xdbeafe, 0.85);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.65);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.45);
    this.dirLight.position.set(14, 28, 18);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 90;
    const d = 34;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    this.playerLight = new THREE.PointLight(0xff8800, 1.2, 14);
    this.scene.add(this.playerLight);

    this.dynamicGroup = new THREE.Group();
    this.scene.add(this.dynamicGroup);
  }

  buildPlayer3D() {
    this.playerRig = new StickRig3D({
      color: '#ff7700',
      scale: 1.05,
      isHollowHead: true,
      weaponType: 'pencil'
    });
    this.scene.add(this.playerRig.root);

    // 3D Shadow Blob under player for crisp platforming depth reading
    const shadowGeo = new THREE.CircleGeometry(0.65, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    });
    this.playerShadowBlob = new THREE.Mesh(shadowGeo, shadowMat);
    this.playerShadowBlob.rotation.x = -Math.PI / 2;
    this.scene.add(this.playerShadowBlob);
  }

  buildSpecialEffectMeshes() {
    // 1. Vector Hook Tether Line 3D
    const hookGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1)
    ]);
    const hookMat = new THREE.LineBasicMaterial({ color: 0x00f5ff, linewidth: 3 });
    this.hookLine3D = new THREE.Line(hookGeo, hookMat);
    this.hookLine3D.visible = false;
    this.scene.add(this.hookLine3D);

    // 2. Awakening Kamehameha Laser Beam 3D
    this.awakeningBeamGroup = new THREE.Group();
    const coreGeo = new THREE.CylinderGeometry(0.45, 0.45, 36, 12);
    coreGeo.rotateZ(-Math.PI / 2);
    coreGeo.translate(18, 0, 0);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const outerGeo = new THREE.CylinderGeometry(0.95, 0.95, 36, 12);
    outerGeo.rotateZ(-Math.PI / 2);
    outerGeo.translate(18, 0, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0.48
    });
    this.awakeningBeamGroup.add(new THREE.Mesh(coreGeo, coreMat), new THREE.Mesh(outerGeo, outerMat));
    this.awakeningBeamGroup.visible = false;
    this.scene.add(this.awakeningBeamGroup);

    // 3. Dark Lord Doom Laser 3D
    this.darkLordLaserGroup = new THREE.Group();
    const dlCore = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xffdde5 }));
    const dlOuter = new THREE.Mesh(outerGeo, new THREE.MeshBasicMaterial({
      color: 0xff0033,
      transparent: true,
      opacity: 0.58
    }));
    this.darkLordLaserGroup.add(dlCore, dlOuter);
    this.darkLordLaserGroup.visible = false;
    this.scene.add(this.darkLordLaserGroup);

    // 4. H4C3R Bracket Wall & Terminal Beam 3D
    this.h4c3rWallGroup = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x00f5ff,
      emissive: 0x00b8d4,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.65
    });
    this.h4c3rWallL = new THREE.Mesh(new THREE.BoxGeometry(10, 4.5, 16), wallMat);
    this.h4c3rWallR = new THREE.Mesh(new THREE.BoxGeometry(10, 4.5, 16), wallMat);
    this.h4c3rWallGroup.add(this.h4c3rWallL, this.h4c3rWallR);
    this.h4c3rWallGroup.visible = false;
    this.scene.add(this.h4c3rWallGroup);

    // 5. Weapon Pickup 3D Mesh
    this.pickupGroup3D = new THREE.Group();
    this.pickupRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.08, 10, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    this.pickupRing.rotation.x = Math.PI / 2;
    this.pickupGroup3D.add(this.pickupRing);
    this.pickupGroup3D.visible = false;
    this.scene.add(this.pickupGroup3D);

    // 6. Animator Cursor 3D
    this.cursorGroup3D = new THREE.Group();
    const pointerCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.4, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00f5ff, emissiveIntensity: 0.45 })
    );
    pointerCone.rotation.z = Math.PI * 0.75;
    this.cursorSelectBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.4, 2.8, 2.4)),
      new THREE.LineBasicMaterial({ color: 0x00f5ff })
    );
    this.cursorGroup3D.add(pointerCone, this.cursorSelectBox);
    this.cursorGroup3D.visible = false;
    this.scene.add(this.cursorGroup3D);
  }

  init() {
    this.setupResize();
    input.init(this.overlayCanvas, this.camera2D);
    this.setup3DExtraInputs();
    this.applySavedSettings();
    this.bindUIEvents();
    this.populateStageSelector();
    this.syncContinueButton();
    this.arena3D.rebuildForStage();
    document.fonts?.load?.('900 18px Bungee').catch?.(() => {});
    requestAnimationFrame((t) => {
      this.lastTime = t;
      this.gameLoop(t);
    });
  }

  setup3DExtraInputs() {
    window.addEventListener('keydown', (e) => {
      this.keys3D[e.code] = true;
      if ((e.code === 'Tab' || e.code === 'KeyM') && !e.repeat) {
        e.preventDefault();
        this.cycleCameraMode();
      }
      if (this.state === 'PLAYING' && !e.repeat) {
        if (e.code === 'KeyC') {
          this.toggleCreativeMode();
        } else if (this.creativeMode && e.code === 'KeyV') {
          this.placeCreativeBlock();
        } else if (this.creativeMode && e.code === 'KeyN') {
          this.spawnCreativeEntity();
        } else if (this.creativeMode && e.code === 'KeyG') {
          this.toggleCreativeGod();
        } else if (this.creativeMode && e.code === 'Space') {
          const now = performance.now();
          if (now - this.lastSpaceTapTime < 320) {
            this.toggleCreativeFly();
          }
          this.lastSpaceTapTime = now;
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys3D[e.code] = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  cycleCameraMode() {
    this.cameraModeIndex = (this.cameraModeIndex + 1) % CAMERA_MODES.length;
    const mode = CAMERA_MODES[this.cameraModeIndex];
    const btn = document.getElementById('btn-camera-mode');
    if (btn) {
      const label = btn.querySelector('.hud-btn-label');
      if (label) label.textContent = CAMERA_LABELS[mode];
      else btn.textContent = CAMERA_LABELS[mode];
    }
  }

  populateStageSelector() {
    const stageNames = [
      '1: Main Desktop',
      '2: Adobe Animate',
      '3: Downloads Zone',
      '4: Firewall Grid',
      '5: BSOD (Titan Boss)',
      '6: Recycle Bin',
      '7: Minecraft Nether',
      '8: Terminal Matrix',
      '9: ViraBot Nexus',
      '10: Dark Core (Dark Lord)',
      '11: Command Throne (King Orange)',
      '12: Glitch Browser',
      '13: Cloud Cache',
      '14: Root Gateway',
      '15: Creeper Lord Replay',
      '16: Giant Cat Replay',
      '17: Lucky Dimension (Lucky Orb)',
      '18: The End (Ender Dragon)',
      '19: The Aether (Skylands)',
      '20: Rocket Corp (The Mercenaries)',
      '21: Zero-Day (H4C3R)',
      '22: 🏆 Trophy Room Epilogue'
    ];
    const selectorIds = ['stage-select-dropdown', 'title-stage-select', 'pause-stage-select'];
    selectorIds.forEach((id) => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = '';
      stageNames.forEach((label, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx + 1);
        opt.textContent = `🎯 Stage ${label}`;
        select.appendChild(opt);
      });
      select.addEventListener('change', () => {
        const val = Number(select.value);
        audio.init();
        if (val === 22) {
          this.startGame();
          this.enterTrophyRoom();
        } else if (val >= 1 && val <= 21) {
          this.jumpToStage(val);
        }
        select.blur();
      });
    });

    document.querySelectorAll('[data-jump-stage]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stg = Number(btn.getAttribute('data-jump-stage'));
        if (stg >= 1 && stg <= 21) {
          audio.init();
          this.jumpToStage(stg);
        }
      });
    });
  }

  syncStageSelectors(val) {
    for (const id of ['stage-select-dropdown', 'title-stage-select', 'pause-stage-select']) {
      const el = document.getElementById(id);
      if (el) el.value = String(val);
    }
  }

  jumpToStage(stageNum) {
    this.hideAllModals();
    this.state = 'PLAYING';
    audio.setBGMDucked?.(false);
    input.resetHeldInputs();
    projectiles.reset();
    allies.reset(false, false, stageNum > 11);
    particles.reset();
    speech.reset();
    combat.clearArena();
    this.clearDynamic3DMeshes();

    this.stageManager.loadStage(stageNum);
    this.arena3D.rebuildForStage();

    this.player.resetStageCombat?.(true);
    this.player.hp = this.player.maxHp;
    this.player.x = this.stageManager.entranceDoor.x + 30;
    this.player.y = this.groundY;
    this.player.z = 0;
    this.player.vz = 0;
    this.player.isGrounded = true;
    this.player.weaponType = 'pencil';
    this.player.temporaryWeaponTimer = 0;
    this.player.beginDrawIn?.();

    this.camera2D.snapTo(this.player);
    waves.startWave(stageNum);
    this.prepareWeaponPickup(stageNum);
    this.captureStageCheckpoint();
    this.showMissionStrip(stageNum, this.creativeMode ? 'CREATIVE SANDBOX' : 'STAGE JUMP');
    this.syncStageSelectors(stageNum);
    this.syncCreativeUI();
  }

  setupResize() {
    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);

      this.viewportWidth = width;
      this.viewportHeight = height;

      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(width, height);
      this.camera3D.aspect = width / Math.max(1, height);
      this.camera3D.updateProjectionMatrix();

      this.overlayCanvas.width = Math.max(1, Math.floor(width * dpr));
      this.overlayCanvas.height = Math.max(1, Math.floor(height * dpr));
      this.overlayCanvas.style.width = `${width}px`;
      this.overlayCanvas.style.height = `${height}px`;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);

      particles.configureForCanvas?.(this.overlayCanvas);
      this.camera2D.invalidateViewport?.();
      this.camera2D.clampToArena();
    };
    window.addEventListener('resize', resize);
    resize();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') this.pauseGame();
      this.lastTime = performance.now();
    });
  }

  applySavedSettings() {
    shop.onPurchase = () => this.captureStageCheckpoint();
    particles.setSplatterEnabled?.(save.getSetting('splatter', true));
    const prefersReducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const reducedEffects = save.getSetting('reducedEffects', prefersReducedMotion) === true;
    particles.setReducedEffects?.(reducedEffects);
    this.camera2D.motionScale = reducedEffects ? 0.28 : 1;
    audio.setEnabled?.(save.getSetting('audio', true));
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) {
      const enabled = audio.enabled !== false;
      const icon = btnAudio.querySelector('.hud-btn-icon');
      const label = btnAudio.querySelector('.hud-btn-label');
      if (icon) icon.textContent = enabled ? '🔊' : '🔇';
      if (label) label.textContent = enabled ? 'Audio: ON' : 'Audio: OFF';
    }
  }

  syncContinueButton() {
    const btnContinue = document.getElementById('btn-continue-game');
    if (!btnContinue) return;
    const checkpoint = save.data.checkpoint;
    const canContinue = Boolean(checkpoint && checkpoint.stage > 1);
    btnContinue.style.display = canContinue ? '' : 'none';
    if (canContinue) btnContinue.textContent = `↻ CONTINUE — STAGE ${checkpoint.stage}`;
  }

  bindUIEvents() {
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        audio.init();
        const selectedStage = parseInt(document.getElementById('title-stage-select')?.value, 10);
        if (selectedStage && selectedStage > 1) {
          this.jumpToStage(selectedStage);
        } else {
          this.startGame();
        }
      });
    }
    const btnStartCreative = document.getElementById('btn-start-creative');
    if (btnStartCreative) {
      btnStartCreative.addEventListener('click', () => {
        audio.init();
        const selectedStage = parseInt(document.getElementById('title-stage-select')?.value, 10) || 1;
        this.creativeMode = true;
        this.creativeGodMode = true;
        if (selectedStage === 22) {
          this.startGame();
          this.enterTrophyRoom();
        } else {
          this.jumpToStage(selectedStage);
        }
        this.syncCreativeUI();
        particles.addTextBanner(this.player.x, this.player.y - 95, '🛠️ CREATIVE SANDBOX MODE ON 🛠️', '#34d399');
      });
    }
    const btnCreativeToggle = document.getElementById('btn-creative-toggle');
    if (btnCreativeToggle) {
      btnCreativeToggle.addEventListener('click', () => {
        this.toggleCreativeMode();
        btnCreativeToggle.blur();
      });
    }
    const btnPauseCreative = document.getElementById('btn-pause-creative');
    if (btnPauseCreative) {
      btnPauseCreative.addEventListener('click', () => {
        this.toggleCreativeMode();
      });
    }
    const btnCreativeCollapse = document.getElementById('btn-creative-collapse');
    if (btnCreativeCollapse) {
      btnCreativeCollapse.addEventListener('click', () => {
        const dock = document.getElementById('creative-dock');
        if (dock) {
          const collapsed = dock.classList.toggle('collapsed');
          btnCreativeCollapse.textContent = collapsed ? '▸' : '▾';
        }
      });
    }
    const btnCreativeGod = document.getElementById('creative-god-btn');
    if (btnCreativeGod) {
      btnCreativeGod.addEventListener('click', () => {
        this.toggleCreativeGod();
      });
    }
    const btnCreativeFly = document.getElementById('creative-fly-btn');
    if (btnCreativeFly) {
      btnCreativeFly.addEventListener('click', () => {
        this.toggleCreativeFly();
      });
    }
    const btnCreativeFreezeAI = document.getElementById('creative-freeze-ai-btn');
    if (btnCreativeFreezeAI) {
      btnCreativeFreezeAI.addEventListener('click', () => {
        this.creativeFreezeAI = !this.creativeFreezeAI;
        this.syncCreativeUI();
      });
    }
    const selCreativeWeapon = document.getElementById('creative-weapon-select');
    if (selCreativeWeapon) {
      selCreativeWeapon.addEventListener('change', () => {
        this.equipCreativeWeapon(selCreativeWeapon.value);
        selCreativeWeapon.blur();
      });
    }
    const btnPlaceBlock = document.getElementById('creative-place-block-btn');
    if (btnPlaceBlock) btnPlaceBlock.addEventListener('click', () => this.placeCreativeBlock());
    const btnClearBlocks = document.getElementById('creative-clear-blocks-btn');
    if (btnClearBlocks) btnClearBlocks.addEventListener('click', () => this.clearCreativeBlocks());
    const btnSpawnEntity = document.getElementById('creative-spawn-btn');
    if (btnSpawnEntity) btnSpawnEntity.addEventListener('click', () => this.spawnCreativeEntity());
    const btnAllAllies = document.getElementById('creative-allies-btn');
    if (btnAllAllies) btnAllAllies.addEventListener('click', () => this.summonAllCreativeAllies());
    const btnNuke = document.getElementById('creative-nuke-btn');
    if (btnNuke) btnNuke.addEventListener('click', () => this.nukeCreativeEnemies());
    const btnMaxShop = document.getElementById('creative-max-shop-btn');
    if (btnMaxShop) btnMaxShop.addEventListener('click', () => this.maxCreativeUpgrades());
    const btnOpenPortal = document.getElementById('creative-portal-btn');
    if (btnOpenPortal) {
      btnOpenPortal.addEventListener('click', () => {
        this.stageManager.isObjectiveComplete = true;
        this.stageManager.exitDoor.isOpen = true;
        waves.spawnQueue.length = 0;
        particles.addTextBanner(this.player.x, this.player.y - 85, '🚪 EXIT PORTAL UNLOCKED!', '#34d399');
      });
    }

    const btnContinue = document.getElementById('btn-continue-game');
    if (btnContinue) {
      btnContinue.addEventListener('click', () => {
        audio.init();
        this.startGame({ fromCheckpoint: true });
      });
    }
    const btnHowToPlay = document.getElementById('btn-how-to-play');
    if (btnHowToPlay) {
      btnHowToPlay.addEventListener('click', () => {
        const card = document.querySelector('.controls-guide-card');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.borderColor = '#ffaa00';
          setTimeout(() => { card.style.borderColor = '#3c4059'; }, 1500);
        }
      });
    }
    const btnCameraMode = document.getElementById('btn-camera-mode');
    if (btnCameraMode) {
      btnCameraMode.addEventListener('click', () => this.cycleCameraMode());
    }
    const btnTryAgain = document.getElementById('btn-try-again');
    if (btnTryAgain) btnTryAgain.addEventListener('click', () => this.retryStage());
    const btnRestartCampaign = document.getElementById('btn-restart-campaign');
    if (btnRestartCampaign) btnRestartCampaign.addEventListener('click', () => this.restartGame());
    const btnMenuFromGameOver = document.getElementById('btn-menu-from-gameover');
    if (btnMenuFromGameOver) btnMenuFromGameOver.addEventListener('click', () => this.showTitleScreen());
    const btnVictoryReplay = document.getElementById('btn-victory-replay');
    if (btnVictoryReplay) btnVictoryReplay.addEventListener('click', () => this.startGame());
    const btnVictoryMenu = document.getElementById('btn-victory-menu');
    if (btnVictoryMenu) btnVictoryMenu.addEventListener('click', () => this.showTitleScreen());

    const btnOpenShop = document.getElementById('btn-open-shop');
    if (btnOpenShop) btnOpenShop.addEventListener('click', () => {
      if (this.state === 'PLAYING') this.openShop();
    });
    const btnTouchShop = document.getElementById('btn-touch-shop');
    if (btnTouchShop) btnTouchShop.addEventListener('click', () => {
      if (this.state === 'PLAYING') this.openShop();
    });
    const btnCloseShop = document.getElementById('btn-close-shop');
    const btnResumeFromShop = document.getElementById('btn-resume-from-shop');
    if (btnCloseShop) btnCloseShop.addEventListener('click', () => this.closeShop());
    if (btnResumeFromShop) btnResumeFromShop.addEventListener('click', () => this.closeShop());

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        if (this.state === 'PLAYING') this.pauseGame();
        else if (this.state === 'PAUSED') this.resumeGame();
      });
    }
    const btnTouchPause = document.getElementById('btn-touch-pause');
    if (btnTouchPause) {
      btnTouchPause.addEventListener('click', () => {
        if (this.state === 'PLAYING') this.pauseGame();
      });
    }
    const btnResumeGame = document.getElementById('btn-resume-game');
    if (btnResumeGame) btnResumeGame.addEventListener('click', () => this.resumeGame());
    const btnRestartGame = document.getElementById('btn-restart-game');
    if (btnRestartGame) btnRestartGame.addEventListener('click', () => this.restartGame());
    const btnPauseShop = document.getElementById('btn-pause-shop');
    if (btnPauseShop) {
      btnPauseShop.addEventListener('click', () => {
        this.hideModal('pause-modal');
        this.openShop();
      });
    }
    const btnPauseMenu = document.getElementById('btn-pause-menu');
    if (btnPauseMenu) btnPauseMenu.addEventListener('click', () => this.showTitleScreen());

    const btnPauseAudio = document.getElementById('btn-pause-audio');
    if (btnPauseAudio) {
      const syncPauseAudioLabel = (enabled) => {
        btnPauseAudio.textContent = enabled ? '🔊 Audio: ON' : '🔇 Audio: OFF';
        btnPauseAudio.setAttribute('aria-pressed', String(enabled));
      };
      syncPauseAudioLabel(audio.enabled !== false);
      btnPauseAudio.addEventListener('click', () => {
        audio.init();
        const enabled = audio.toggleAudio();
        syncPauseAudioLabel(enabled);
        save.setSetting('audio', enabled);
        this.applySavedSettings();
      });
    }
    const btnEffectsToggle = document.getElementById('btn-effects-toggle');
    if (btnEffectsToggle) {
      const syncEffectsLabel = (reduced) => {
        btnEffectsToggle.textContent = reduced ? '✨ Effects: REDUCED' : '✨ Effects: FULL';
        btnEffectsToggle.setAttribute('aria-pressed', String(reduced));
      };
      syncEffectsLabel(particles.reducedEffects === true);
      btnEffectsToggle.addEventListener('click', () => {
        const reduced = particles.setReducedEffects?.(particles.reducedEffects !== true) ?? false;
        this.camera2D.motionScale = reduced ? 0.28 : 1;
        syncEffectsLabel(reduced);
        save.setSetting('reducedEffects', reduced);
      });
    }
    const btnSplatterToggle = document.getElementById('btn-splatter-toggle');
    if (btnSplatterToggle) {
      const syncSplatterLabel = (enabled) => {
        btnSplatterToggle.textContent = `🩸 Comic Splatter: ${enabled ? 'ON' : 'OFF'}`;
        btnSplatterToggle.setAttribute('aria-pressed', String(enabled));
      };
      syncSplatterLabel(particles.splatterEnabled !== false);
      btnSplatterToggle.addEventListener('click', () => {
        const enabled = particles.setSplatterEnabled?.(particles.splatterEnabled === false) ?? true;
        syncSplatterLabel(enabled);
        save.setSetting('splatter', enabled);
      });
    }
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        audio.init();
        const enabled = audio.toggleAudio();
        const icon = btnAudio.querySelector('.hud-btn-icon');
        const label = btnAudio.querySelector('.hud-btn-label');
        if (icon) icon.textContent = enabled ? '🔊' : '🔇';
        if (label) label.textContent = enabled ? 'Audio: ON' : 'Audio: OFF';
        save.setSetting('audio', enabled);
      });
    }

    const bindAllyClick = (id, type) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => {
          if (this.state === 'PLAYING') {
            const summoned = allies.summonAlly(type, this.player.x, this.groundY, this.player.facing, waves.zombies);
            if (summoned) {
              const summonedAlly = type === 'cursor'
                ? allies.activeCursors?.[allies.activeCursors.length - 1]
                : allies.activeAllies?.[allies.activeAllies.length - 1];
              speech.triggerTeamBanter(type, 'summon', { anchor: summonedAlly });
            }
          }
        });
      }
    };
    bindAllyClick('ally-red-slot', 'red');
    bindAllyClick('ally-blue-slot', 'blue');
    bindAllyClick('ally-yellow-slot', 'yellow');
    bindAllyClick('ally-green-slot', 'green');
    bindAllyClick('ally-cursor-slot', 'cursor');
    bindAllyClick('ally-chosen-slot', 'chosen');
  }

  toggleCreativeMode(forceState) {
    this.creativeMode = typeof forceState === 'boolean' ? forceState : !this.creativeMode;
    if (this.creativeMode) {
      this.creativeGodMode = true;
      combat.ink = Math.max(combat.ink, 99999);
      this.player.hp = this.player.maxHp;
      this.player.superMeter = this.player.maxSuper;
      particles.addTextBanner(this.player.x, this.player.y - 95, '🛠️ CREATIVE SANDBOX MODE ON 🛠️', '#34d399');
    } else {
      this.creativeFlyMode = false;
      this.creativeFreezeAI = false;
      this.creativeWeaponOverride = null;
      this.player.weaponType = 'pencil';
      this.player.temporaryWeaponTimer = 0;
      particles.addTextBanner(this.player.x, this.player.y - 95, '⚔️ SURVIVAL CAMPAIGN MODE ⚔️', '#ffaa00');
    }
    this.syncCreativeUI();
  }

  syncCreativeUI() {
    const dock = document.getElementById('creative-dock');
    if (dock) dock.classList.toggle('active', this.creativeMode);

    const hudBtn = document.getElementById('btn-creative-toggle');
    if (hudBtn) {
      hudBtn.classList.toggle('active', this.creativeMode);
      const label = hudBtn.querySelector('.hud-btn-label');
      if (label) label.textContent = `Creative: ${this.creativeMode ? 'ON' : 'OFF'} (C)`;
    }

    const pauseBtn = document.getElementById('btn-pause-creative');
    if (pauseBtn) {
      pauseBtn.textContent = `🛠️ Creative Mode: ${this.creativeMode ? 'ON' : 'OFF'}`;
      pauseBtn.setAttribute('aria-pressed', String(this.creativeMode));
    }

    const godBtn = document.getElementById('creative-god-btn');
    if (godBtn) {
      godBtn.classList.toggle('active', this.creativeGodMode);
      godBtn.textContent = `🛡️ God: ${this.creativeGodMode ? 'ON' : 'OFF'}`;
    }

    const flyBtn = document.getElementById('creative-fly-btn');
    if (flyBtn) {
      flyBtn.classList.toggle('active', this.creativeFlyMode);
      flyBtn.textContent = `✈️ Fly: ${this.creativeFlyMode ? 'ON' : 'OFF'}`;
    }

    const freezeBtn = document.getElementById('creative-freeze-ai-btn');
    if (freezeBtn) {
      freezeBtn.classList.toggle('active', this.creativeFreezeAI);
      freezeBtn.textContent = this.creativeFreezeAI ? '⏸️ AI: FROZEN' : '▶️ AI: RUN';
    }
  }

  toggleCreativeFly(forceState) {
    if (!this.creativeMode) return;
    this.creativeFlyMode = typeof forceState === 'boolean' ? forceState : !this.creativeFlyMode;
    this.syncCreativeUI();
    particles.addTextBanner(
      this.player.x,
      this.player.y - 85,
      this.creativeFlyMode ? '✈️ 3D FLIGHT ENABLED' : '✈️ FLIGHT DISABLED',
      '#38bdf8'
    );
    speech.onCreativeAction?.('flight', { enabled: this.creativeFlyMode, anchor: this.player });
  }

  toggleCreativeGod(forceState) {
    if (!this.creativeMode) return;
    this.creativeGodMode = typeof forceState === 'boolean' ? forceState : !this.creativeGodMode;
    this.syncCreativeUI();
    particles.addTextBanner(
      this.player.x,
      this.player.y - 85,
      this.creativeGodMode ? '🛡️ GOD MODE: ON' : '🛡️ GOD MODE: OFF',
      this.creativeGodMode ? '#f59e0b' : '#94a3b8'
    );
    speech.onCreativeAction?.('god_mode', { enabled: this.creativeGodMode, anchor: this.player });
  }

  placeCreativeBlock() {
    if (this.state !== 'PLAYING') return;
    if (this.creativeBlocks.length >= 64) {
      const oldest = this.creativeBlocks.shift();
      if (oldest?.mesh) {
        oldest.mesh.visible = false;
        oldest.mesh.scale.set(1, 1, 1);
        if (oldest.texKey !== 'lava') {
          oldest.mesh.material?.emissive?.setHex?.(0x000000);
          if (oldest.mesh.material) oldest.mesh.material.emissiveIntensity = 0;
        }
        if (this.creativeBlockPool.length < 64) {
          this.creativeBlockPool.push(oldest.mesh);
        } else {
          this.dynamicGroup.remove(oldest.mesh);
          disposeHierarchy(oldest.mesh, true);
        }
      }
    }

    const blockSelect = this.getHudElement('creative-block-select');
    const texKey = blockSelect?.value || 'command_block';
    const isLava = texKey === 'lava';
    const blockW = 68;
    const blockH = 68;
    const bx = Math.max(-920, Math.min(920, this.player.x + this.player.facing * 76));
    const bz = this.player.z || 0;

    // Stack on top if another creative block is already placed at this X/Z spot
    let by = this.player.y;
    for (const cb of this.creativeBlocks) {
      if (Math.abs(cb.x - bx) < 48 && Math.abs(cb.z - bz) < 48) {
        by = Math.min(by, cb.y - cb.height);
      }
    }

    let mat = this.creativeMaterialCache.get(texKey);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        map: getVoxelTexture(texKey),
        roughness: isLava ? 0.25 : 0.4,
        metalness: texKey === 'gold_block' ? 0.55 : 0.15,
        emissive: isLava ? new THREE.Color(0xff4400) : new THREE.Color(0x000000),
        emissiveIntensity: isLava ? 0.8 : 0
      });
      mat.isShared = true;
      this.creativeMaterialCache.set(texKey, mat);
    }
    if (isLava) {
      mat.emissive?.setHex?.(0xff4400);
      mat.emissiveIntensity = 0.8;
    }

    let mesh;
    if (this.creativeBlockPool.length > 0) {
      mesh = this.creativeBlockPool.pop();
      mesh.material = mat;
      mesh.scale.setScalar(1);
    } else {
      mesh = new THREE.Mesh(CREATIVE_BLOCK_GEO, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    if (!mesh.parent) this.dynamicGroup.add(mesh);
    mesh.visible = true;
    mesh.position.set(to3DX(bx), to3DY(by - blockH / 2), to3DZ(bz));

    const blockRecord = {
      x: bx,
      y: by,
      z: bz,
      z3d: bz,
      width: blockW,
      height: blockH,
      depth3d: 68,
      texKey,
      isLava,
      damage: isLava ? 20 : 0,
      mesh,
      fuseTimer: texKey === 'tnt_block' ? 2.2 : (texKey === 'lucky_block' ? 1.1 : null)
    };
    this.creativeBlocks.push(blockRecord);
    this.spawnVoxelBurst(bx, by - blockH / 2, bz, isLava ? '#ff6600' : '#38bdf8', isLava ? 8 : 6);

    if (texKey === 'tnt_block') {
      speech.onCreativeAction?.('tnt_place', { anchor: blockRecord });
    } else if (texKey === 'lucky_block') {
      speech.onCreativeAction?.('lucky_block', { anchor: blockRecord });
    } else if (isLava) {
      particles.addTextBanner(bx, by - 80, '🔥 LAVA HAZARD PLACED', '#ff5500');
      speech.onCreativeAction?.('lava_block', { anchor: blockRecord });
    }
  }

  clearCreativeBlocks() {
    for (const cb of this.creativeBlocks) {
      if (cb.mesh) {
        cb.mesh.visible = false;
        cb.mesh.scale.set(1, 1, 1);
        if (cb.texKey !== 'lava') {
          cb.mesh.material?.emissive?.setHex?.(0x000000);
          if (cb.mesh.material) cb.mesh.material.emissiveIntensity = 0;
        }
        if (this.creativeBlockPool.length < 64) {
          this.creativeBlockPool.push(cb.mesh);
        } else {
          this.dynamicGroup.remove(cb.mesh);
          disposeHierarchy(cb.mesh, true);
        }
      }
    }
    this.creativeBlocks.length = 0;
    particles.addTextBanner(this.player.x, this.player.y - 80, '🗑️ BLOCKS CLEARED', '#94a3b8');
  }

  updateCreativeBlocks(dt) {
    const lavaMat = this.creativeMaterialCache.get('lava');
    if (lavaMat) {
      lavaMat.emissiveIntensity = 0.75 + 0.25 * Math.sin((this.stageManager?.stageTime || 0) * 3.5);
    }

    for (let i = this.creativeBlocks.length - 1; i >= 0; i--) {
      const cb = this.creativeBlocks[i];

      // Pairwise 2: Lava proximity accelerates adjacent TNT detonation
      if (cb.texKey === 'tnt_block' && cb.fuseTimer > 0.5) {
        for (let j = 0; j < this.creativeBlocks.length; j++) {
          const other = this.creativeBlocks[j];
          if ((other.texKey === 'lava' || other.isLava) && Math.hypot(other.x - cb.x, (other.z || 0) - (cb.z || 0)) < 48) {
            cb.isIgnited = true;
            cb.fuseTimer = 0.5;
            break;
          }
        }
      }

      if (cb.fuseTimer === null || cb.fuseTimer === undefined) continue;
      cb.fuseTimer -= dt;

      if (cb.texKey === 'tnt_block' && cb.mesh) {
        const flash = Math.sin(cb.fuseTimer * 24) > 0;
        cb.mesh.scale.setScalar(1 + Math.max(0, (2.2 - cb.fuseTimer) * 0.08));
        cb.mesh.material.emissive?.setHex(flash ? 0xff2222 : 0x000000);
        cb.mesh.material.emissiveIntensity = flash ? 0.75 : 0;
      }

      if (cb.fuseTimer <= 0) {
        if (cb.mesh) {
          cb.mesh.visible = false;
          cb.mesh.scale.set(1, 1, 1);
          if (cb.texKey !== 'lava') {
            cb.mesh.material?.emissive?.setHex?.(0x000000);
            if (cb.mesh.material) {
              cb.mesh.material.emissiveIntensity = 0;
            }
          }
          if (this.creativeBlockPool.length < 64) {
            this.creativeBlockPool.push(cb.mesh);
          } else {
            this.dynamicGroup.remove(cb.mesh);
            disposeHierarchy(cb.mesh, true);
          }
        }
        this.creativeBlocks.splice(i, 1);

        if (cb.texKey === 'tnt_block') {
          audio.playFinisherImpact?.();
          this.camera2D?.addShake?.(0.65);
          particles.emitBossExplosion({
            x: cb.x,
            y: cb.y - 34,
            bodyY: cb.y,
            groundY: this.groundY,
            color: '#ef4444',
            accent: '#facc15',
            radius: 220,
            stickFigure: false,
            seed: Math.abs(Math.round(cb.x + cb.z)) + 101
          });
          this.spawnVoxelBurst(cb.x, cb.y - 34, cb.z, '#ef4444', 22);
          for (const enemy of waves.zombies) {
            if (!enemy || enemy.isDead) continue;
            const dist = Math.hypot(enemy.x - cb.x, (enemy.z || 0) - cb.z);
            if (dist <= 280) {
              const dir = enemy.x >= cb.x ? 1 : -1;
              enemy.takeDamage?.(280, dir, 520, true);
            }
          }
          // Chain reaction: ignite neighboring TNT blocks within 240 units!
          for (const other of this.creativeBlocks) {
            if (other.texKey === 'tnt_block' && other.fuseTimer > 0.15) {
              const dist = Math.hypot(other.x - cb.x, (other.z || 0) - cb.z);
              if (dist <= 240) {
                other.fuseTimer = Math.min(other.fuseTimer, 0.12);
              }
            }
          }
          speech.onCreativeAction?.('tnt_detonate', { anchor: cb, x: cb.x, y: cb.y - 34, z: cb.z });
        } else if (cb.texKey === 'lucky_block') {
          combat.ink += 250;
          this.player.heal?.(60);
          this.spawnVoxelBurst(cb.x, cb.y - 34, cb.z, '#facc15', 16);
          particles.addShockwave(cb.x, cb.y - 30, 180, '#facc15', 8);
          particles.addTextBanner(cb.x, cb.y - 75, '★ LUCKY PRIZE! +250 INK ★', '#facc15');
          speech.onCreativeAction?.('lucky_block_open', { anchor: cb, x: cb.x, y: cb.y - 34, z: cb.z });
        }
      }
    }
  }

  equipCreativeWeapon(w) {
    if (!w) return;
    this.creativeWeaponOverride = w;
    if (w === 'staff' || w === 'eraser' || w === 'pencil') {
      this.player.weaponType = w;
    } else {
      this.player.weaponType = 'staff';
    }
    this.player.temporaryWeaponTimer = w === 'pencil' ? 0 : 999999;
    particles.addTextBanner(this.player.x, this.player.y - 80, `⚔️ EQUIPPED: ${w.toUpperCase()}`, '#ffea00');
    speech.onCreativeAction?.('weapon_switch', { weapon: w, anchor: this.player });
  }

  spawnCreativeEntity() {
    if (this.state !== 'PLAYING') return;
    const type = this.getHudElement('creative-spawn-select')?.value || 'ender_dragon';
    if (type === 'mercenary_squad') {
      for (const m of ['mercenary_agent', 'mercenary_ballista', 'mercenary_primal', 'mercenary_hazard']) {
        waves.spawnZombie(m, this.player, this.groundY, this.camera2D);
      }
      speech.onCreativeAction?.('spawn_entity', { entity: 'mercenary_squad', anchor: this.player });
      return;
    }
    waves.spawnZombie(type, this.player, this.groundY, this.camera2D);
    speech.onCreativeAction?.('spawn_entity', { entity: type, anchor: this.player });
  }

  summonAllCreativeAllies() {
    if (this.state !== 'PLAYING') return;
    if (allies.cooldowns) {
      for (let i = 0; i < ALLY_TYPES.length; i++) {
        const k = ALLY_TYPES[i];
        allies.cooldowns[k] = 0;
        if (allies.recoveryStates) allies.recoveryStates[k] = false;
      }
    }
    const types = ['red', 'blue', 'yellow', 'green', 'cursor', 'chosen'];
    types.forEach((t, idx) => {
      allies.cooldowns[t] = 0;
      allies.summonAlly(t, this.player.x + (idx - 2.5) * 45, this.groundY, this.player.facing, waves.zombies);
    });
    allies.unlockKingAlly?.(this.player.x - this.player.facing * 70, this.groundY);
    particles.addTextBanner(this.player.x, this.player.y - 95, '★ ALL STICK ALLIES DEPLOYED! ★', '#ffea00');
    speech.onCreativeAction?.('summon_allies', { anchor: this.player });
    speech.triggerNamedBanter?.('team_allies_assemble');
  }

  deployCreativeAllies() {
    return this.summonAllCreativeAllies();
  }

  nukeCreativeEnemies() {
    if (this.state !== 'PLAYING') return;
    let count = 0;
    for (const enemy of [...waves.zombies]) {
      if (!enemy || enemy.isDead) continue;
      count++;
      this.spawnVoxelBurst(enemy.x, enemy.y - 40, enemy.z || 0, enemy.color || '#ff6b00', 14);
      enemy.takeDamage?.(99999, this.player.facing, 600, true);
    }
    this.camera2D?.addShake?.(1.0);
    particles.addTextBanner(this.player.x, this.player.y - 95, `💥 NUKED ${count} ENEMIES! 💥`, '#ff3344');
    speech.onCreativeAction?.('nuke_enemies', { anchor: this.player });
  }

  maxCreativeUpgrades() {
    combat.ink = Math.max(combat.ink, 99999);
    for (const upgrade of shop.upgrades || []) {
      while (upgrade.level < upgrade.maxLevel) {
        upgrade.level++;
        upgrade.apply(this.player);
      }
    }
    this.player.hp = this.player.maxHp;
    this.player.superMeter = this.player.maxSuper;
    particles.addTextBanner(this.player.x, this.player.y - 95, '⚡ ALL STATS & UPGRADES MAXED! ⚡', '#38bdf8');
  }

  triggerCreativeWeaponEffect(hostileTargets) {
    const w = this.creativeWeaponOverride;
    if (!w || w === 'pencil' || w === 'staff' || w === 'eraser') return;

    const px = this.player.x + this.player.facing * 65;
    const py = this.player.y - 42;
    const pz = this.player.z || 0;

    if (w === 'pixel_bazooka') {
      // Ballista's 8-Bit Pixel Rocket Barrage
      for (const vy of [-55, 0, 55]) {
        projectiles.spawnViralDart?.(px, py, this.player.facing * 560, vy, 65, '#ef4444');
      }
      this.spawnVoxelBurst(px, py, pz, '#ef4444', 10);
    } else if (w === 'toolbar_staff' || w === 'hazard_sign' || w === 'vira_blades' || w === 'stone_spear') {
      const col = w === 'toolbar_staff' ? '#38bdf8' : (w === 'hazard_sign' ? '#facc15' : (w === 'vira_blades' ? '#ff0033' : '#fbbf24'));
      particles.addShockwave(px, py, 190, col, 8);
      this.spawnVoxelBurst(px, py, pz, col, 12);
      for (const t of hostileTargets) {
        if (!t || t.isDead) continue;
        const dist = Math.hypot(t.x - px, (t.z || 0) - pz);
        if (dist <= 220) {
          t.takeDamage?.(75, this.player.facing, 380, true);
          if (w === 'toolbar_staff') t.applyFreeze?.(2.5);
          if (w === 'hazard_sign') t.applyStun?.(2.0);
        }
      }
    }
  }

  clearDynamic3DMeshes() {
    // 1. Recycle active voxel particles into pool (cap 140)
    for (let i = 0; i < this.voxelParticles.length; i++) {
      const p = this.voxelParticles[i];
      p.mesh.visible = false;
      if (this.voxelParticlePool.length < 140) {
        this.voxelParticlePool.push(p);
      }
    }
    this.voxelParticles.length = 0;

    // 2. Recycle active floor splats into pool (cap 36)
    for (let i = 0; i < this.floorSplats3D.length; i++) {
      const s = this.floorSplats3D[i];
      s.mesh.visible = false;
      if (this.floorSplatPool.length < 36) {
        this.floorSplatPool.push(s);
      }
    }
    this.floorSplats3D.length = 0;

    // 3. Recycle active telegraph rings into pool (cap 12)
    for (const mesh of this.telegraphMeshes.values()) {
      mesh.visible = false;
      if (this.telegraphMeshPool.length < 12) {
        this.telegraphMeshPool.push(mesh);
      }
    }
    this.telegraphMeshes.clear();

    // 4. Recycle active creative blocks into pool (cap 64)
    for (let i = 0; i < this.creativeBlocks.length; i++) {
      const cb = this.creativeBlocks[i];
      if (cb.mesh) {
        cb.mesh.visible = false;
        cb.mesh.scale.set(1, 1, 1);
        if (cb.texKey !== 'lava') {
          cb.mesh.material?.emissive?.setHex?.(0x000000);
          if (cb.mesh.material) cb.mesh.material.emissiveIntensity = 0;
        }
        if (this.creativeBlockPool.length < 64) {
          this.creativeBlockPool.push(cb.mesh);
        } else {
          this.dynamicGroup.remove(cb.mesh);
          disposeHierarchy(cb.mesh, true);
        }
      }
    }
    this.creativeBlocks.length = 0;

    // 5. Dispose unpooled dynamic meshes & clear dynamicGroup
    disposeHierarchy(this.dynamicGroup, true);
    while (this.dynamicGroup.children.length > 0) {
      this.dynamicGroup.remove(this.dynamicGroup.children[0]);
    }

    this.enemyRigs.clear();
    this.allyRigs.clear();
    this.turretMeshes.clear();
    this.sketchBlockMeshes.clear();
    this.anvilMeshes.clear();
    this.projectileMeshes.clear();
    this.hazardMeshes.clear();
    this.inkMeshes.clear();
    this.currentLookTarget = null;
    this.lastHudValues = Object.create(null);
  }

  resetCombatSpeechState() {
    this.lastComboMilestone = 0;
    this.lastGrabHitApplied = false;
    this.clutchReactionTriggered = false;
    this.clutchCooldownTimer = 0;
    this.lastStageObjectiveComplete = false;
  }

  updateCombatSpeechReactions(simDt) {
    if (this.creativeMode && this.creativeGodMode) {
      // God mode disables clutch reactions
      return;
    }

    // ------------------------------------------------------------------------
    // F3.1: Combat Combo Milestones (10-hit, 20-hit, 30-hit)
    // ------------------------------------------------------------------------
    const curCombo = combat.combo || 0;
    if (curCombo < 10) {
      this.lastComboMilestone = 0;
    } else if (curCombo >= 30 && this.lastComboMilestone < 30) {
      this.lastComboMilestone = 30;
      speech.onCombatEvent?.('combo', { hits: 30, anchor: this.player });
    } else if (curCombo >= 20 && this.lastComboMilestone < 20) {
      this.lastComboMilestone = 20;
      speech.onCombatEvent?.('combo', { hits: 20, anchor: this.player });
    } else if (curCombo >= 10 && this.lastComboMilestone < 10) {
      this.lastComboMilestone = 10;
      speech.onCombatEvent?.('combo', { hits: 10, anchor: this.player });
    }

    // ------------------------------------------------------------------------
    // F3.1: Grab Finisher Execution
    // ------------------------------------------------------------------------
    const move = this.player?.activeMove;
    if (move && move.action === 'grab') {
      if (move.hitApplied && !this.lastGrabHitApplied) {
        this.lastGrabHitApplied = true;
        const grabPhrases = ['SLAM DUNK!', 'SEISMIC SLAM!', 'KNOCKOUT SLAM!'];
        const text = grabPhrases[Math.floor(Math.random() * grabPhrases.length)];
        speech.onCombatEvent?.('grab', { text, anchor: this.player });
      }
    } else if (!move) {
      this.lastGrabHitApplied = false;
    }

    // ------------------------------------------------------------------------
    // F3.2: Low-HP Clutch Reactions (<25% HP)
    // ------------------------------------------------------------------------
    if (this.clutchCooldownTimer > 0) {
      this.clutchCooldownTimer -= simDt;
    }
    const player = this.player;
    if (player && !player.isDead && (player.maxHp || 0) > 0) {
      const hpRatio = player.hp / player.maxHp;
      if (hpRatio < 0.25 && player.hp > 0) {
        if (!this.clutchReactionTriggered && this.clutchCooldownTimer <= 0) {
          this.clutchReactionTriggered = true;
          this.clutchCooldownTimer = 15.0; // 15-second cooldown against spam
          speech.onCombatEvent?.('low_hp', { anchor: player });
        }
      } else if (hpRatio >= 0.28) {
        // Hysteresis reset: clear triggered flag once healed back above 28%
        this.clutchReactionTriggered = false;
      }
    }

    // ------------------------------------------------------------------------
    // F3.2: Stage Objective Clear Reaction
    // ------------------------------------------------------------------------
    if (this.stageManager?.isObjectiveComplete && !this.lastStageObjectiveComplete) {
      this.lastStageObjectiveComplete = true;
      speech.onCombatEvent?.('stage_clear', {
        stage: this.stageManager.currentStage,
        anchor: this.player
      });
    }
  }

  startGame(options = {}) {
    const checkpoint = options.fromCheckpoint ? save.data.checkpoint : null;
    const stage = checkpoint && checkpoint.stage >= 1 && checkpoint.stage <= 21 ? checkpoint.stage : 1;
    this.hideAllModals();
    this.state = 'PLAYING';
    audio.setBGMDucked?.(false);
    input.resetHeldInputs();
    projectiles.reset();
    allies.reset(true, false, stage > 11);
    particles.reset();
    speech.reset();
    this.resetCombatSpeechState();
    shop.reset();
    combat.resetRun(checkpoint ? checkpoint.ink ?? 50 : 50);
    this.clearDynamic3DMeshes();

    this.stageManager.loadStage(stage);
    this.arena3D.rebuildForStage();

    this.player = new Player(this.stageManager.entranceDoor.x + 30, this.groundY);
    this.player.z = 0;
    this.player.vz = 0;
    this.player.yaw = Math.PI / 2;
    this.player.isGrounded = true;
    this.lastSafeIslandPos = { x: this.player.x, y: this.groundY, z: 0 };

    if (checkpoint) {
      combat.score = checkpoint.score | 0;
      combat.totalKills = checkpoint.totalKills | 0;
      combat.maxCombo = checkpoint.maxCombo | 0;
      for (const savedUpgrade of checkpoint.upgrades || []) {
        const upgrade = shop.upgrades.find((entry) => entry.id === savedUpgrade.id);
        if (!upgrade) continue;
        const targetLevel = Math.max(0, Math.min(upgrade.maxLevel, savedUpgrade.level | 0));
        while (upgrade.level < targetLevel) {
          upgrade.level++;
          upgrade.apply(this.player);
        }
      }
      this.player.hp = this.player.maxHp;
    }

    this.player.beginDrawIn?.();
    this.camera2D.snapTo(this.player);
    waves.startWave(stage);
    this.prepareWeaponPickup(stage);
    this.captureStageCheckpoint();
    this.showMissionStrip(stage, checkpoint ? 'CONTINUE' : '');
    speech.onCombatEvent?.('stage_start', { stage, anchor: this.player });

    this.syncStageSelectors(stage);
  }

  restartGame() {
    this.hideAllModals();
    this.startGame();
  }

  retryStage() {
    const stage = this.stageManager.currentStage;
    this.hideAllModals();
    this.state = 'PLAYING';
    audio.setBGMDucked?.(false);
    input.resetHeldInputs();
    projectiles.reset();
    allies.reset(false, false, stage > 11);
    particles.reset();
    speech.reset();
    this.resetCombatSpeechState();
    combat.clearArena();
    this.clearDynamic3DMeshes();

    if (this.stageCheckpoint && this.stageCheckpoint.stage === stage) {
      combat.ink = this.stageCheckpoint.ink ?? combat.ink;
      combat.score = this.stageCheckpoint.score ?? combat.score;
      combat.totalKills = this.stageCheckpoint.totalKills ?? combat.totalKills;
    }

    this.stageManager.loadStage(stage);
    this.arena3D.rebuildForStage();

    this.player.resetStageCombat?.(true);
    this.player.hp = this.player.maxHp;
    this.player.x = this.stageManager.entranceDoor.x + 30;
    this.player.y = this.groundY;
    this.player.z = 0;
    this.player.vz = 0;
    this.lastSafeIslandPos = { x: this.player.x, y: this.groundY, z: 0 };
    this.player.isGrounded = true;
    this.player.weaponType = 'pencil';
    this.player.temporaryWeaponTimer = 0;
    this.player.beginDrawIn?.();

    this.camera2D.snapTo(this.player);
    this.prepareWeaponPickup(stage);
    this.captureStageCheckpoint();
    this.showMissionStrip(stage, 'RETRY');
    speech.onCombatEvent?.('stage_start', { stage, anchor: this.player });
    waves.startWave(stage);
  }

  advanceStage(nextStage) {
    this.hideAllModals();
    this.state = 'PLAYING';
    audio.setBGMDucked?.(false);
    save.recordStageCleared(nextStage - 1);
    this.stageManager.loadStage(nextStage);
    projectiles.reset();
    allies.reset(false, true, nextStage > 11);
    particles.reset();
    speech.reset();
    this.resetCombatSpeechState();
    combat.clearArena();
    this.clearDynamic3DMeshes();
    this.arena3D.rebuildForStage();

    this.player.x = this.stageManager.entranceDoor.x + 30;
    this.player.y = this.groundY;
    this.player.z = 0;
    this.lastSafeIslandPos = { x: this.player.x, y: this.groundY, z: 0 };
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.vz = 0;
    this.player.pose = 'idle';
    this.player.attackTimer = 0;
    this.player.weaponTimer = 0;
    this.player.activeMove = null;
    this.player.bufferedMove = null;
    this.player.isRolling = false;
    this.player.rollTimer = 0;
    this.player.diveKick = false;
    this.player.isGrounded = true;
    this.player.airJuggleTarget = null;
    this.player.cancelHook?.(true);
    if (this.player.isAwakened) this.player.deactivateAwakening?.();
    this.player.temporaryWeaponTimer = 0;
    this.player.weaponType = 'pencil';
    this.player.stageDamageTaken = 0;

    const isBossCheckpoint = [5, 10, 11, 15, 16, 17, 18, 20, 21].includes(nextStage);
    const baselineHeal = this.player.maxHp * 0.18;
    const bossSafetyHeal = Math.max(0, this.player.maxHp * 0.75 - this.player.hp);
    this.player.heal(isBossCheckpoint ? Math.max(baselineHeal, bossSafetyHeal) : baselineHeal);
    this.player.beginDrawIn?.();

    this.camera2D.snapTo(this.player);
    waves.startWave(nextStage);
    this.prepareWeaponPickup(nextStage);
    this.captureStageCheckpoint();
    this.showMissionStrip(nextStage);
    speech.onCombatEvent?.('stage_start', { stage: nextStage, anchor: this.player });

    this.syncStageSelectors(nextStage);
  }

  enterTrophyRoom() {
    if (this.stageManager.isTrophyRoom) return;
    this.hideAllModals();
    this.state = 'PLAYING';
    input.resetHeldInputs();
    waves.stopWave();
    projectiles.reset();
    allies.reset(false, false, true);
    particles.reset();
    speech.reset();
    this.resetCombatSpeechState();
    combat.clearArena();
    this.clearDynamic3DMeshes();

    this.stageManager.enterTrophyRoom();
    this.arena3D.rebuildForStage();

    this.player.resetStageCombat?.(true);
    this.player.x = this.stageManager.entranceDoor.x + 60;
    this.player.y = this.groundY;
    this.player.z = 0;
    this.lastSafeIslandPos = { x: this.player.x, y: this.groundY, z: 0 };
    this.player.vz = 0;
    this.player.isGrounded = true;
    this.player.weaponType = 'pencil';
    this.player.temporaryWeaponTimer = 0;
    this.player.beginDrawIn?.();
    this.weaponPickup = null;

    save.recordRun(combat.score, combat.maxCombo, combat.totalKills);
    save.recordVictory();
    this.stageCheckpoint = null;
    this.syncContinueButton();
    audio.setIntensity(0.12);
    audio.setBGMDucked?.(false);
    this.showMissionStrip(21, 'EPILOGUE');
    particles.addTextBanner(this.player.x + 90, this.player.y - 90, '★ 3D TROPHY ROOM UNLOCKED! ★', '#ffd54a');
    speech.spawnSpeechBubble?.('orange', 'TROPHY ROOM UNLOCKED!', {
      style: 'comic',
      mood: '★',
      priority: 4,
      anchor: this.player
    });

    this.syncStageSelectors(22);
  }

  completeGame() {
    this.state = 'VICTORY';
    audio.setIntensity(0);
    audio.setBGMDucked?.(true);
    projectiles.reset();
    allies.reset(false);
    this.player.cancelHook?.(true);
    speech.spawnSpeechBubble?.('orange', 'VICTORY! WE WON!', {
      style: 'comic',
      mood: '★',
      priority: 5,
      anchor: this.player
    });
    save.recordRun(combat.score, combat.maxCombo, combat.totalKills);
    save.recordVictory();
    this.syncContinueButton();
    const score = document.getElementById('victory-score');
    const kills = document.getElementById('victory-kills');
    const combo = document.getElementById('victory-combo');
    if (score) score.innerText = combat.score;
    if (kills) kills.innerText = combat.totalKills;
    if (combo) combo.innerText = `${combat.maxCombo} HITS`;
    this.showModal('victory-modal');
  }

  captureStageCheckpoint() {
    if (this.stageManager.isTrophyRoom) return;
    this.stageCheckpoint = Object.freeze({
      stage: this.stageManager.currentStage,
      ink: combat.ink,
      score: combat.score,
      totalKills: combat.totalKills,
      maxCombo: combat.maxCombo,
      upgrades: Object.freeze(shop.upgrades.map((u) => Object.freeze({ id: u.id, level: u.level }))),
      player: Object.freeze({
        maxHp: this.player.maxHp,
        damageMultiplier: this.player.damageMultiplier,
        speed: this.player.speed,
        jumpForce: this.player.jumpForce,
        lifesteal: this.player.lifesteal,
        superGainRate: this.player.superGainRate
      })
    });
    save.setCheckpoint(this.stageCheckpoint);
    this.syncContinueButton();
  }

  prepareWeaponPickup(stage) {
    const type = stage === 7 ? 'staff' : (stage === 12 ? 'eraser' : null);
    this.weaponPickup = type ? {
      type,
      x: Math.max(-720, this.stageManager.entranceDoor.x + 250),
      y: this.groundY - 28,
      z: 0,
      collected: false
    } : null;

    // Rebuild 3D pickup mesh
    while (this.pickupGroup3D.children.length > 1) {
      this.pickupGroup3D.remove(this.pickupGroup3D.children[1]);
    }
    if (this.weaponPickup) {
      const weaponMesh = buildVoxelWeaponMesh(type);
      weaponMesh.scale.setScalar(0.95);
      weaponMesh.rotation.z = 0.6;
      this.pickupGroup3D.add(weaponMesh);
      this.pickupGroup3D.visible = true;
    } else {
      this.pickupGroup3D.visible = false;
    }
  }

  updateWeaponPickup() {
    const pickup = this.weaponPickup;
    if (!pickup || pickup.collected || this.player.isDead) {
      this.pickupGroup3D.visible = false;
      return;
    }
    this.pickupGroup3D.visible = true;
    const bob = Math.sin(this.stageManager.stageTime * 4.5) * 0.25;
    this.pickupGroup3D.position.set(to3DX(pickup.x), 1.1 + bob, to3DZ(pickup.z || 0));
    this.pickupGroup3D.rotation.y += 0.04;

    const dz = (this.player.z || 0) - (pickup.z || 0);
    if (Math.hypot(this.player.x - pickup.x, (this.player.y - 28) - pickup.y, dz * 0.5) <= 75) {
      pickup.collected = this.player.equipTemporaryWeapon?.(pickup.type, 18) !== false;
      this.pickupGroup3D.visible = false;
    }
  }

  showMissionStrip(stage, prefix = '') {
    const strip = document.getElementById('mission-strip');
    if (!strip) return;
    const beat = this.stageManager.campaignBeat || {};
    const act = document.getElementById('mission-act');
    const mission = document.getElementById('mission-text');
    const lesson = document.getElementById('mission-lesson');
    if (act) act.textContent = `${prefix ? `${prefix} · ` : ''}${beat.act || `STAGE ${stage}`}`;
    if (mission) mission.textContent = beat.mission || this.stageManager.stageName;
    const clue = document.getElementById('mission-clue');
    if (clue) {
      const previousClue = this.stageManager.isTrophyRoom ? beat.clue : (stage > 1 ? CAMPAIGN_BEATS_3D[stage - 1]?.clue : null);
      clue.textContent = previousClue ? `TRACE // ${previousClue}` : '';
    }
    if (lesson) {
      lesson.textContent = this.stageManager.isTrophyRoom
        ? '3D TROPHY ROOM · WALK TO THE RESULTS PORTAL'
        : 'WASD / ARROWS MOVE IN 3D · SPACE JUMP · CLICK / Q COMBO · R-CLICK / K SLASH';
    }
    strip.classList.add('active');
    this.missionStripTimer = 4.0;
    this.missionStripGrace = 0.85;
  }

  updateMissionStrip(dt) {
    if (this.missionStripTimer <= 0) return;
    this.missionStripTimer = Math.max(0, this.missionStripTimer - dt);
    this.missionStripGrace = Math.max(0, (this.missionStripGrace ?? 0) - dt);
    if (this.missionStripTimer === 0) this.getHudElement('mission-strip')?.classList.remove('active');
  }

  showTitleScreen() {
    this.hideAllModals();
    this.state = 'TITLE';
    input.resetHeldInputs();
    audio.setIntensity(0);
    audio.setBGMDucked?.(true);
    this.showModal('title-screen');
  }

  pauseGame() {
    this.state = 'PAUSED';
    audio.setBGMDucked?.(true);
    this.showModal('pause-modal');
  }

  resumeGame() {
    this.hideModal('pause-modal');
    this.state = 'PLAYING';
    audio.setBGMDucked?.(false);
    window.focus();
  }

  openShop() {
    this.state = 'SHOP';
    shop.renderShopUI(this.player);
    this.showModal('shop-modal');
  }

  closeShop() {
    this.hideModal('shop-modal');
    this.state = 'PLAYING';
    window.focus();
  }

  gameOver() {
    this.state = 'GAMEOVER';
    audio.setIntensity(0);
    audio.setBGMDucked?.(true);
    save.recordRun(combat.score, combat.maxCombo, combat.totalKills);
    const elWave = document.getElementById('gameover-wave');
    const elScore = document.getElementById('gameover-score');
    const elKills = document.getElementById('gameover-kills');
    const elCombo = document.getElementById('gameover-combo');
    const elBest = document.getElementById('gameover-best');
    if (elWave) elWave.innerText = `STAGE ${this.stageManager.currentStage}`;
    if (elScore) elScore.innerText = combat.score;
    if (elKills) elKills.innerText = combat.totalKills;
    if (elCombo) elCombo.innerText = `${combat.maxCombo} HITS`;
    if (elBest) elBest.innerText = save.data.best.score;
    this.showModal('gameover-modal');
  }

  showModal(id) {
    document.getElementById(id)?.classList.add('active');
  }
  hideModal(id) {
    document.getElementById(id)?.classList.remove('active');
  }
  hideAllModals() {
    document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.remove('active'));
  }

  collectHostileTargets() {
    const output = this.hostileTargets;
    output.length = 0;
    for (const enemy of waves.zombies) {
      if (enemy && !enemy.isDead) output.push(enemy);
    }
    projectiles.collectHostileTargets?.(output);
    return output;
  }

  gameLoop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1) || 0.016;
    this.lastTime = timestamp;
    try {
      input.update();
      if (this.state === 'PLAYING') {
        const upHeld = Boolean(this.keys3D.KeyW || this.keys3D.ArrowUp || input.touch?.up);
        const downHeld = Boolean(this.keys3D.KeyS || this.keys3D.ArrowDown || input.touch?.down);
        this.zInput = (downHeld ? 1 : 0) - (upHeld ? 1 : 0);

        // Spacebar or touch jump triggers vertical Jump; W/S/Up/Down move in 3D Z-axis
        input.actions.jump = Boolean(input.keys.Space || input.touch?.jump);
        input.actions.jumpPressed = Boolean(input.keysPressed.Space || input.touch?.jumpPressed);

        // Up/Down modifiers for Rising Dragon (W+Q / Up+Q) & Dive Kick / EX Javelin (S+K / Down+Q)
        input.actions.up = upHeld;
        input.actions.down = downHeld;

        // K, X, Right-Click, or touch weapon button triggers Giant Pencil Slash (so W walks in 3D Z!)
        input.actions.weapon = Boolean(input.keys.KeyK || input.keys.KeyX || input.mouse.rightDown || input.touch?.weapon);
        input.actions.weaponPressed = Boolean(input.keysPressed.KeyK || input.keysPressed.KeyX || input.mouse.rightPressed || input.touch?.weaponPressed);
      }

      if (input.actions.shop) {
        if (this.state === 'PLAYING') this.openShop();
        else if (this.state === 'SHOP') this.closeShop();
      }
      if (input.actions.pause) {
        if (this.state === 'PLAYING') this.pauseGame();
        else if (this.state === 'PAUSED') this.resumeGame();
      }
      if (this.state === 'PLAYING') {
        this.update(dt);
      }
      this.render(dt);
    } catch (err) {
      console.error('3D GameLoop error:', err);
    } finally {
      input.endFrame();
    }
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  getAllActivePlatforms() {
    const solidPlats = this.stageManager?.getAllSolidPlatforms() || [];
    if (!this.creativeBlocks || this.creativeBlocks.length === 0) return solidPlats;
    this._allPlatforms.length = 0;
    for (let i = 0; i < solidPlats.length; i++) this._allPlatforms.push(solidPlats[i]);
    for (let i = 0; i < this.creativeBlocks.length; i++) this._allPlatforms.push(this.creativeBlocks[i]);
    return this._allPlatforms;
  }

  update(dt) {
    this.camera2D.update(dt, this.player, waves.zombies.length);
    const simDt = this.camera2D.isHitstopped() ? dt * 0.5 : dt;
    this.hudSyncTimer += simDt;
    this.updateMissionStrip(simDt);

    // Creative Mode God Mode: Infinite HP, Infinite Ink, Full Super, Zero Cooldowns
    if (this.creativeMode && this.creativeGodMode) {
      this.player.hp = this.player.maxHp;
      this.player.isDead = false;
      this.player.superMeter = this.player.maxSuper;
      this.player.rollCooldown = 0;
      this.player.blockCooldown = 0;
      this.player.hookCooldown = 0;
      this.player.grabCooldown = 0;
      combat.ink = Math.max(combat.ink, 99999);
      if (allies.cooldowns) {
        for (let i = 0; i < ALLY_TYPES.length; i++) {
          const k = ALLY_TYPES[i];
          allies.cooldowns[k] = 0;
          if (allies.recoveryStates) allies.recoveryStates[k] = false;
        }
      }
      if (this.creativeWeaponOverride && this.creativeWeaponOverride !== 'pencil') {
        this.player.temporaryWeaponTimer = 999999;
      }
    }

    // Filter platforms by 3D Z-proximity (including custom Creative Voxel Blocks!) so player lands on 3D slabs
    const allPlatforms = this.getAllActivePlatforms();
    const zAlignedPlatforms = filterPlatformsForEntity(this.player, allPlatforms, 0);

    const hostileTargets = this.collectHostileTargets();
    if (this.creativeMode && input.actions.weaponPressed) {
      this.triggerCreativeWeaponEffect(hostileTargets);
    }

    // Feature 6: Dynamic Void Falling Physics
    // On open-edge stages (floating islands / Nether), determine whether the player is over
    // the island floor footprint. If stepping off into the void, supply effectiveGroundY = 99999
    // so 2D gravity naturally plunges the 3D rig below 0 into the void.
    const isOpenStage = isOpenEdgeTheme(this.stageManager?.theme);
    let isPlayerOverFloor = true;
    if (isOpenStage) {
      const isInsideX = Math.abs(this.player.x) <= ISLAND_FLOOR_BOUNDS.halfX;
      const isInsideZ = Math.abs(this.player.z || 0) <= ISLAND_FLOOR_BOUNDS.halfZ;
      isPlayerOverFloor = isInsideX && isInsideZ;
    }

    // Track safe interior coordinates when grounded on the island floor
    if (
      isPlayerOverFloor &&
      this.player.isGrounded &&
      !this.player.isDead &&
      Math.abs(this.player.y - this.groundY) < 4 &&
      !this.player.standingPlatform
    ) {
      const safeMarginX = 80;
      const safeMarginZ = 60;
      if (
        Math.abs(this.player.x) <= ISLAND_FLOOR_BOUNDS.halfX - safeMarginX &&
        Math.abs(this.player.z || 0) <= ISLAND_FLOOR_BOUNDS.halfZ - safeMarginZ
      ) {
        this.lastSafeIslandPos = { x: this.player.x, y: this.groundY, z: this.player.z || 0 };
      }
    }

    const effectiveGroundY = isPlayerOverFloor ? this.groundY : 99999;
    const prevPlayerY = this.player.y;
    this.player.update(simDt, input, effectiveGroundY, projectiles.sketchBlocks, hostileTargets, this.camera2D, zAlignedPlatforms);

    // Continuous Collision Detection (CCD) & Vertical Tunneling Prevention (F3)
    resolveSweptVerticalCollision(this.player, zAlignedPlatforms, prevPlayerY, simDt);
    checkPlatformStepOff(this.player);

    if (this.creativeMode && this.creativeGodMode) {
      this.player.hp = this.player.maxHp;
      this.player.isDead = false;
    }

    // Update Player 3D Z-axis movement & Creative 3D Flight
    this.updatePlayer3DMovement(simDt, hostileTargets);
    checkPlatformStepOff(this.player);
    this.updateCreativeBlocks(simDt);

    // Features 7 & 8: Void Fall Damage, Death & Safe Respawn
    this.checkPlayerVoidFall();

    if (this.player.isDead && this.player.deathTimer <= 0) {
      this.gameOver();
      return;
    }

    if (!(this.creativeMode && this.creativeFreezeAI)) {
      // Ensure each enemy in the wave only lands on platforms matching their Z lane,
      // prevent high-speed vertical tunneling via CCD (F2, F3), and fall into void when off island (F9).
      const enemies = waves.zombies;
      const game = this;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.z === undefined) {
          e.z = (((i * 137 + Math.round(Math.abs(e.x))) % 520) - 260);
        }
        wrapEnemyUpdate3D(e, game);
      }

      // Hook spawnZombie once so any zombie spawned mid-wave also receives Z-lane platform filtering
      if (!waves._spawn3DHooked) {
        const origSpawn = waves.spawnZombie.bind(waves);
        waves.spawnZombie = function(type, player, groundY, camera) {
          const res = origSpawn(type, player, groundY, camera);
          const newlySpawned = waves.zombies[waves.zombies.length - 1];
          if (newlySpawned) {
            if (newlySpawned.z === undefined) {
              newlySpawned.z = (((waves.zombies.length * 137 + Math.round(Math.abs(newlySpawned.x))) % 520) - 260);
            }
            wrapEnemyUpdate3D(newlySpawned, game);
          }
          return res;
        };
        waves._spawn3DHooked = true;
      }

      // Also pass Z-filtered platforms to waves.update based on active enemy / player lane
      const waveTargetZ = waves.bossZombie?.z !== undefined
        ? waves.bossZombie.z
        : (enemies.length > 0 ? (enemies[0]?.z || 0) : (this.player.z || 0));
      const waveAlignedPlatforms = filterPlatformsForEntity({ z: waveTargetZ }, allPlatforms, 0);

      waves.update(
        simDt,
        this.player,
        this.groundY,
        projectiles.sketchBlocks,
        this.camera2D,
        () => {},
        waveAlignedPlatforms,
        allies.getCombatTargets?.() || []
      );

      // Update Enemy & Boss 3D Z-positions and separation
      this.updateEnemies3DMovement(simDt);
    } else {
      // Even when AI is frozen, remove any enemies killed by the player
      for (let i = waves.zombies.length - 1; i >= 0; i--) {
        if (waves.zombies[i].isDead) waves.zombies.splice(i, 1);
      }
    }

    this.stageManager.update(simDt, this.player, waves, (nextStage) => {
      this.stageManager.resolveStageExit(
        nextStage,
        () => (this.stageManager.isTrophyRoom ? this.completeGame() : this.enterTrophyRoom()),
        (stage) => this.advanceStage(stage)
      );
    }, this.camera2D);

    projectiles.update(
      simDt,
      this.groundY,
      hostileTargets,
      this.player,
      this.camera2D,
      allies.getCombatTargets?.() || []
    );

    allies.update(simDt, this.groundY, hostileTargets, this.player, this.camera2D);
    combat.update(simDt, this.player);
    particles.update(simDt);
    speech.update(simDt, this.player);
    this.updateCombatSpeechReactions(simDt);
    this.updateWeaponPickup();

    // Ambient zombie comedy banter: occasional humorous retorts during active zombie waves
    this.zombieRetortTimer = (this.zombieRetortTimer || 0) + simDt;
    if (this.zombieRetortTimer >= 14.0) {
      this.zombieRetortTimer = 0;
      const normalZombies = (waves.zombies || []).filter((z) => !z.isDead && !z.isBoss && !z.isMercenary);
      if (normalZombies.length >= 2) {
        speech.triggerRandomZombieRetort?.({ anchor: normalZombies[0] });
      }
    }

    // Update 3D Arena, 3D Laser Contact Damage & Voxel Particles
    this.arena3D.update(simDt);
    this.check3DLaserDamage();
    this.check3DLavaHazards(simDt);
    this.updateVoxelParticles(simDt);
  }

  check3DLaserDamage() {
    if (this.creativeMode && this.creativeGodMode) return;
    const p = this.player;
    if (!p || p.isDead || (p.iFrames || 0) > 0 || p.isRolling || p.isAwakened) return;

    // 1. Stage Laser Hazards (active low red beams at ground level)
    for (const laser of this.stageManager.laserHazards || []) {
      const isActive = laser.timer < laser.activeDuration;
      if (!isActive) continue;
      const inX = p.x >= laser.x - 22 && p.x <= laser.x + laser.width + 22;
      const inZ = Math.abs(p.z || 0) <= 210;
      const inY = p.y >= -62 && p.y <= 10;
      if (inX && inZ && inY) {
        audio.playLaserZap();
        const knockDir = p.x < laser.x + laser.width * 0.5 ? -1 : 1;
        p.takeDamage(laser.damage || 20, knockDir, 350);
        particles.createHitSparks(p.x, p.y - 24, 10, '#ff2244');
        this.spawnVoxelBurst(p.x, p.y - 24, p.z || 0, '#ff1744', 12);
        return;
      }
    }

    // 2. Dark Lord Doom Laser in 3D
    const doomLaser = (projectiles.projectiles || []).find((pr) => pr.type === 'doom_laser' && !pr.pendingRemoval);
    if (doomLaser) {
      const inBeamX = doomLaser.facing > 0
        ? (p.x >= doomLaser.x && p.x <= doomLaser.x + 1800)
        : (p.x <= doomLaser.x && p.x >= doomLaser.x - 1800);
      const inBeamY = Math.abs((p.y - 35) - doomLaser.y) < (doomLaser.beamWidth || 32) + 25;
      const bossZ = waves.bossZombie?.z || 0;
      const inBeamZ = Math.abs((p.z || 0) - bossZ) <= 140;
      if (inBeamX && inBeamY && inBeamZ) {
        p.takeDamage(doomLaser.damage || 45, doomLaser.facing, 450);
        particles.createHitSparks(p.x, doomLaser.y, 8, '#ff0033');
        this.spawnVoxelBurst(p.x, p.y - 35, p.z || 0, '#ff0033', 14);
      }
    }
  }

  check3DLavaHazards(dt = 0.016) {
    // Polymorphic signature support: check3DLavaHazards(entity, hazard, dt)
    if (dt && typeof dt === 'object') {
      return checkLavaHazard(dt, arguments[1], arguments[2] !== undefined ? arguments[2] : 0.016);
    }

    const safeDt = Math.max(0, typeof dt === 'number' ? dt : 0.016);
    if (!this._activeLavaHazards) this._activeLavaHazards = [];
    const hazards = this._activeLavaHazards;
    hazards.length = 0;

    // 1. Stage Floor Lava Hazard Pools & Channels (e.g. Stage 7 Nether Core)
    const stageHazards = this.stageManager?.lavaHazards;
    if (stageHazards && Array.isArray(stageHazards)) {
      for (let i = 0; i < stageHazards.length; i++) {
        const sh = stageHazards[i];
        if (sh) hazards.push(sh);
      }
    }

    // 2. Placed Creative Mode Lava Blocks
    const cBlocks = this.creativeBlocks;
    if (cBlocks && Array.isArray(cBlocks)) {
      for (let i = 0; i < cBlocks.length; i++) {
        const cb = cBlocks[i];
        if (cb && (cb.texKey === 'lava' || cb.isLava)) {
          hazards.push(cb);
        }
      }
    }

    // 3. Player Lava Hazard Check & Burn Recoil
    const p = this.player;
    if (p && !p.isDead) {
      p.isGodMode = Boolean(this.creativeMode && this.creativeGodMode);

      if (!p.isGodMode && !p.isRolling && (p.iFrames || 0) <= 0 && hazards.length > 0) {
        const pz = p.z !== undefined ? p.z : 0;
        for (let i = 0; i < hazards.length; i++) {
          const h = hazards[i];
          const hz = h.z !== undefined ? h.z : (h.z3d || 0);
          const halfW = (h.width || (h.texKey ? 68 : 160)) * 0.5;
          const halfD = (h.depth3d || (h.texKey ? 68 : 220)) * 0.5;

          const inX = p.x >= h.x - halfW && p.x <= h.x + halfW;
          const inZ = pz >= hz - halfD && pz <= hz + halfD;
          const topY = h.height ? (h.y || 0) - h.height : (h.y || 0);
          const inY = Math.abs(p.y - (h.y || 0)) <= 30 || Math.abs(p.y - topY) <= 30;

          if (inX && inZ && inY) {
            const dmg = h.damage !== undefined ? h.damage : 20;
            p.hp = Math.max(0, (p.hp || 100) - dmg);
            p.stageDamageTaken = (p.stageDamageTaken || 0) + dmg;
            p.vy = -340;
            p.isGrounded = false;
            p.standingPlatform = null;
            p.iFrames = 30;
            p.isHurt = true;
            p.hurtTimer = 0.25;

            audio.playAcidSizzle?.();
            audio.playPlayerHurt?.();
            particles.addDamageText?.(p.x, p.y - 40, dmg, false, '#ff6600');
            particles.createHitSparks?.(p.x, p.y - 20, 8, '#ff6600');
            this.spawnVoxelBurst(p.x, p.y - 10, pz, '#ff6600', 12);

            if (p.hp <= 0 && typeof p.die === 'function') {
              p.die();
            }
            break;
          }
        }
      }
    }

    // 4. Enemy Waves Lava Hazard Check & Burn Recoil
    const enemies = waves?.zombies;
    if (enemies && Array.isArray(enemies)) {
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e || e.isDead || e.pendingRemoval) continue;

        // Decrement tick cooldown timers if active
        if (e.lavaTickCooldown > 0) {
          e.lavaTickCooldown = Math.max(0, e.lavaTickCooldown - safeDt);
        }
        if (e.lavaBurnCooldown > 0) {
          e.lavaBurnCooldown = Math.max(0, e.lavaBurnCooldown - safeDt);
        }

        // Skip damage application if in cooldown or god mode
        if ((e.lavaTickCooldown || 0) > 0 || (e.lavaBurnCooldown || 0) > 0 || e.isGodMode) {
          continue;
        }

        if (hazards.length === 0) continue;

        const ez = e.z !== undefined ? e.z : (e.z3d || 0);

        for (let j = 0; j < hazards.length; j++) {
          const h = hazards[j];
          const hz = h.z !== undefined ? h.z : (h.z3d || 0);
          const halfW = (h.width || (h.texKey ? 68 : 160)) * 0.5;
          const halfD = (h.depth3d || (h.texKey ? 68 : 220)) * 0.5;

          const inX = e.x >= h.x - halfW && e.x <= h.x + halfW;
          const inZ = ez >= hz - halfD && ez <= hz + halfD;
          const topY = h.height ? (h.y || 0) - h.height : (h.y || 0);
          const inY = Math.abs(e.y - (h.y || 0)) <= 30 || Math.abs(e.y - topY) <= 30;

          if (inX && inZ && inY) {
            const dmg = h.damage !== undefined ? h.damage : 20;
            e.hp = Math.max(0, (e.hp || 100) - dmg);
            e.vy = -260;
            e.isGrounded = false;
            e.standingPlatform = null;
            e.lavaTickCooldown = 0.45;
            e.lavaBurnCooldown = 0.45;

            audio.playAcidSizzle?.();
            particles.addDamageText?.(e.x, e.y - 30, dmg, false, '#ff6600');
            particles.createHitSparks?.(e.x, e.y - 20, 6, '#ff6600');
            this.spawnVoxelBurst(e.x, e.y - 10, ez, '#ff6600', 12);

            if (e.hp <= 0) {
              e.isDead = true;
              if (typeof e.die === 'function') {
                e.die(1, 0);
              }
              audio.playZombieDeath?.();
              this.spawnVoxelBurst(e.x, e.y, ez, e.color || '#4ade80', 16);
            }
            break;
          }
        }
      }
    }
  }

  updatePlayer3DMovement(dt, hostileTargets) {
    if (this.player.z === undefined) this.player.z = 0;
    if (this.player.vz === undefined) this.player.vz = 0;

    // Creative Mode 3D Flight (Space = Ascend, Z / Ctrl = Descend, Hover in Mid-Air)
    if (this.creativeMode && this.creativeFlyMode && !this.player.isDead) {
      const flyUp = Boolean(this.keys3D.Space || input.touch?.jump);
      const flyDown = Boolean(this.keys3D.KeyZ || this.keys3D.ControlLeft || this.keys3D.ControlRight);
      const flyDir = (flyDown ? 1 : 0) - (flyUp ? 1 : 0);
      this.player.vy = flyDir * 390;
      const isOpenStage = isOpenEdgeTheme(this.stageManager?.theme);
      const lowerY = isOpenStage ? 220 : this.groundY;
      this.player.y = Math.max(-520, Math.min(lowerY, this.player.y + this.player.vy * dt));
      this.player.isGrounded = true;
    }

    const zDir = this.zInput || 0;
    const zSpeed = this.player.speed * (this.player.isRolling ? 1.35 : 0.78);
    if (zDir !== 0 && !this.player.isDead) {
      this.player.vz = zDir * zSpeed;
    } else {
      this.player.vz *= Math.pow(0.001, dt);
    }

    // Maintain 'run' pose during pure Z-axis movement without 1-frame flickering to 'idle' or 'crouch'
    if (!this.player.isDead && this.player.isGrounded && Math.abs(this.player.vz) > 20 && Math.abs(this.player.vx || 0) <= 20) {
      if (this.player.pose === 'idle' || this.player.pose === 'crouch') {
        this.player.pose = 'run';
        this.player.isCrouching = false;
      }
    }

    // Target Z-assist during attacks so 3D combos snap smoothly into the nearest enemy's Z lane!
    if (this.player.pose?.startsWith('attack') || this.player.pose === 'weapon_slash' || this.player.pose === 'dive_kick') {
      let nearest = null;
      let bestDist = 260;
      const facing = this.player.facing >= 0 ? 1 : -1;
      for (const t of hostileTargets) {
        if (!t || t.isDead) continue;
        if ((t.x - this.player.x) * facing < -30) continue;
        const d = Math.hypot(t.x - this.player.x, (t.z || 0) - this.player.z);
        if (d < bestDist) {
          bestDist = d;
          nearest = t;
        }
      }
      if (nearest && nearest.z !== undefined) {
        this.player.z += (nearest.z - this.player.z) * Math.min(1, dt * 10);
      }
    }

    const isEnclosed = !isOpenEdgeTheme(this.stageManager?.theme);
    this.player.z = this.player.z + this.player.vz * dt;
    if (isEnclosed) {
      clampEnclosedWalls(this.player, true);
    }

    // Smooth 3D Yaw Rotation
    const targetYaw = this.player.facing >= 0 ? Math.PI / 2 : -Math.PI / 2;
    const zTilt = (this.player.vz / Math.max(1, this.player.speed)) * 0.24 * (this.player.facing >= 0 ? 1 : -1);
    const desiredYaw = targetYaw + zTilt;
    this.player.yaw = (this.player.yaw ?? desiredYaw) + (desiredYaw - (this.player.yaw ?? desiredYaw)) * Math.min(1, dt * 28);
  }

  updateEnemies3DMovement(dt) {
    const enemies = waves.zombies;
    const isOpenStage = isOpenEdgeTheme(this.stageManager?.theme);
    const isEnclosed = !isOpenStage;
    const allPlatforms = this.getAllActivePlatforms();
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.isDead) {
        enemies.splice(i, 1);
        continue;
      }
      if (e.z === undefined) {
        // Deterministic spread in Z so hordes fill the 3D arena
        e.z = (((i * 137 + Math.round(Math.abs(e.x))) % 520) - 260);
      }
      if (e.lastHp3D === undefined) e.lastHp3D = e.hp;
      if (e.hp < e.lastHp3D) {
        // Spawn 3D voxel hit burst when damaged!
        this.spawnVoxelBurst(e.x, e.y - (e.height || 60) * 0.5, e.z, e.color || '#4ade80', e.hp <= 0 ? 18 : 7);
        e.lastHp3D = e.hp;
      }

      // Steer enemy Z toward player Z
      const targetZ = this.player.z || 0;
      const dz = targetZ - e.z;
      const zRate = e.isBoss ? 110 : 95;
      let vz = Math.max(-zRate, Math.min(zRate, dz * 1.8));

      // Boid separation in X/Z among ordinary zombies
      if (!e.isBoss) {
        for (let j = 0; j < enemies.length; j++) {
          if (i === j) continue;
          const other = enemies[j];
          const dx = e.x - other.x;
          const oz = e.z - (other.z || 0);
          const distSq = dx * dx + oz * oz;
          if (distSq < 3600 && distSq > 1) {
            vz += (oz / Math.sqrt(distSq)) * 65;
          }
        }
      }

      e.z = e.z + vz * dt;
      if (isEnclosed) {
        clampEnclosedWalls(e, true);
      }
      checkPlatformStepOff(e);

      // Feature 9: Non-Flying Enemy Void Elimination
      if (isOpenStage) {
        const isFlyingBoss = e.type === 'ender_dragon' || Boolean(e.isFlying);
        if (!isFlyingBoss) {
          const isOverIsland = isEntityOverIsland(e);
          const zPlatforms = filterPlatformsForEntity(e, allPlatforms, 0);
          const isOnPlatform = zPlatforms.some(p => {
            const halfW = (p.width || 60) * 0.5;
            const pTop = p.y - (p.height || 60);
            return e.x >= p.x - halfW && e.x <= p.x + halfW && e.y >= pTop - 10 && e.y <= pTop + 24;
          });

          if (!isOverIsland && !isOnPlatform) {
            e.isGrounded = false;
            if (e.y >= VOID_FALL_THRESHOLD) {
              e.hp = 0;
              e.isDead = true;
              e.pendingRemoval = true;
              combat.registerKill(e);
              this.spawnVoxelBurst(e.x, e.y, e.z || 0, e.color || '#4ade80', 16);
              audio.playZombieDeath?.();
              enemies.splice(i, 1);
            }
          }
        }
      }
    }
  }

  checkPlayerVoidFall() {
    const isOpenStage = isOpenEdgeTheme(this.stageManager?.theme);
    if (!isOpenStage) return;

    if (this.player.y >= VOID_FALL_THRESHOLD) {
      if (this.creativeMode && this.creativeGodMode) {
        if (!this.creativeFlyMode) {
          this.respawnPlayerOnIsland();
        }
        return;
      }

      if (this.creativeMode && this.creativeFlyMode) {
        if (this.player.y > 600) {
          this.respawnPlayerOnIsland();
        }
        return;
      }

      if (this.player.isDead) return;

      const voidDamage = 40;
      this.player.hp = Math.max(0, this.player.hp - voidDamage);
      this.player.stageDamageTaken = (this.player.stageDamageTaken || 0) + voidDamage;
      audio.playPlayerHurt?.();
      particles.addTextBanner?.(this.player.x, this.groundY - 80, `⚠ VOID FALL! -${voidDamage} HP`, '#ff3344');
      this.spawnVoxelBurst(this.player.x, this.groundY, this.player.z || 0, '#ff3344', 16);

      if (this.player.hp <= 0) {
        this.player.die();
      } else {
        this.respawnPlayerOnIsland();
      }
    }
  }

  respawnPlayerOnIsland() {
    const bounds = ISLAND_FLOOR_BOUNDS;
    const safeMarginX = 100;
    const safeMarginZ = 80;
    let targetX = this.lastSafeIslandPos ? this.lastSafeIslandPos.x : (this.stageManager?.entranceDoor ? this.stageManager.entranceDoor.x + 40 : 0);
    let targetZ = this.lastSafeIslandPos ? (this.lastSafeIslandPos.z || 0) : 0;

    targetX = Math.max(-(bounds.halfX - safeMarginX), Math.min(bounds.halfX - safeMarginX, targetX));
    targetZ = Math.max(-(bounds.halfZ - safeMarginZ), Math.min(bounds.halfZ - safeMarginZ, targetZ));

    this.player.x = targetX;
    this.player.y = this.groundY;
    this.player.z = targetZ;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.vz = 0;
    this.player.isGrounded = true;
    this.player.standingPlatform = null;
    this.player.iFrames = 1.6;
    this.player.isHurt = false;
    this.player.pose = 'idle';

    audio.playUpgradeBuy?.();
    particles.addShockwave?.(this.player.x, this.groundY - 15, 110, '#38bdf8', 8);
    particles.createDust?.(this.player.x, this.groundY, 14);
    speech.spawnSpeechBubble?.(this.player, 'WHOA! WATCH THE VOID!', {
      style: 'comic',
      mood: '💧',
      priority: 3,
      duration: 1.5,
      bypassCooldown: true
    });
  }

  spawnVoxelBurst(x, y, z, hexColor = '#ff7700', count = 8) {
    if (this.voxelParticles.length >= 140) return;
    const toSpawn = Math.min(count, 140 - this.voxelParticles.length);
    if (toSpawn <= 0) return;

    let mat = this.voxelMaterialCache.get(hexColor);
    if (!mat) {
      const color = new THREE.Color(hexColor);
      mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.4
      });
      mat.isShared = true;
      this.voxelMaterialCache.set(hexColor, mat);
    }

    const x3 = to3DX(x);
    const y3 = Math.max(0.3, to3DY(y));
    const z3 = to3DZ(z);

    for (let i = 0; i < toSpawn; i++) {
      const size = 0.14 + Math.random() * 0.18;
      let p;
      if (this.voxelParticlePool.length > 0) {
        p = this.voxelParticlePool.pop();
      } else {
        const cube = new THREE.Mesh(SHARED_VOXEL_GEO, mat);
        p = { mesh: cube, vx: 0, vy: 0, vz: 0, life: 0 };
      }
      p.mesh.material = mat;
      p.mesh.scale.setScalar(size);
      p.mesh.position.set(x3, y3, z3);
      p.mesh.rotation.set(0, 0, 0);
      if (!p.mesh.parent) this.dynamicGroup.add(p.mesh);
      p.mesh.visible = true;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 6.5;
      p.vx = Math.cos(angle) * speed;
      p.vy = 3.0 + Math.random() * 6.5;
      p.vz = Math.sin(angle) * speed;
      p.life = 0.55 + Math.random() * 0.35;
      this.voxelParticles.push(p);
    }

    // Optional 3D floor splatter stamp if splatter enabled
    if (particles.splatterEnabled !== false) {
      this.spawnFloorSplat3D(x3, z3);
    }
  }

  spawnFloorSplat3D(x3, z3) {
    if (particles.splatterEnabled === false) return;
    const r = 0.35 + Math.random() * 0.45;
    let sRecord;

    if (this.floorSplats3D.length >= 36) {
      // FIFO recycling: recycle oldest splat
      sRecord = this.floorSplats3D.shift();
    } else if (this.floorSplatPool.length > 0) {
      sRecord = this.floorSplatPool.pop();
    } else {
      const splat = new THREE.Mesh(SHARED_SPLAT_GEO, SHARED_SPLAT_MAT);
      sRecord = { mesh: splat, life: 5.5 };
    }

    if (!sRecord.mesh.parent) this.dynamicGroup.add(sRecord.mesh);
    sRecord.mesh.visible = true;
    sRecord.mesh.scale.set(r, 1, r);
    sRecord.mesh.position.set(
      x3 + (Math.random() - 0.5) * 0.8,
      0.03,
      z3 + (Math.random() - 0.5) * 0.8
    );
    sRecord.life = 5.5;
    this.floorSplats3D.push(sRecord);
  }

  updateVoxelParticles(dt) {
    for (let i = this.voxelParticles.length - 1; i >= 0; i--) {
      const p = this.voxelParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        if (this.voxelParticlePool.length < 140) {
          this.voxelParticlePool.push(p);
        } else {
          this.dynamicGroup.remove(p.mesh);
        }
        this.voxelParticles.splice(i, 1);
        continue;
      }
      p.vy -= 18 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.1, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += 6 * dt;
      p.mesh.rotation.y += 5 * dt;
    }

    for (let i = this.floorSplats3D.length - 1; i >= 0; i--) {
      const s = this.floorSplats3D[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        if (this.floorSplatPool.length < 36) {
          this.floorSplatPool.push(s);
        } else {
          this.dynamicGroup.remove(s.mesh);
        }
        this.floorSplats3D.splice(i, 1);
      }
    }
  }

  sync3DScene(dt) {
    // 1. Background & White Void blend
    const voidBlend = this.stageManager.whiteVoidProgress || 0;
    if (voidBlend > 0.2) {
      this.scene.background.setHex(0xf2efe8);
      this.scene.fog.color.setHex(0xf2efe8);
    } else {
      const bgHex = {
        bsod: 0x002b7a,
        minecraft: 0x220c12,
        dark_core: 0x140005,
        command_realm: 0x1f1105,
        the_end: 0x0c0517,
        aether: 0x1a4b75,
        rocket_corp: 0x334155,
        trophy: 0x041838,
        zero_day: 0x060a14
      }[this.stageManager.theme] || 0x0b1528;
      this.scene.background.setHex(bgHex);
      this.scene.fog.color.setHex(bgHex);
    }

    // 2. Sync Player 3D Rig
    const px = to3DX(this.player.x);
    const py = to3DY(this.player.y);
    const pz = to3DZ(this.player.z || 0);
    this.playerRig.root.position.set(px, py, pz);
    this.playerRig.root.rotation.y = this.player.yaw ?? (this.player.facing >= 0 ? Math.PI / 2 : -Math.PI / 2);

    const isPureZRun = !this.player.isDead && this.player.isGrounded !== false &&
      Math.abs(this.player.vz || 0) > 20 && Math.abs(this.player.vx || 0) <= 20;
    const playerPose = (isPureZRun && (this.player.pose === 'idle' || this.player.pose === 'crouch'))
      ? 'run'
      : this.player.pose;

    this.playerRig.update({
      pose: playerPose,
      animTimer: this.player.animTimer,
      isGrounded: this.player.isGrounded !== false,
      isHurt: this.player.isHurt,
      isAwakened: this.player.isAwakened,
      weaponType: (this.creativeMode && this.creativeWeaponOverride) ? this.creativeWeaponOverride : (this.player.weaponType || 'pencil'),
      actionPhase: this.player.moveProgress || (this.player.diveKick ? Math.max(0, Math.min(1, 1 - (this.player.diveKickTimer || 0.5) / 0.5)) : 0),
      dt
    });

    const isEnclosedStage = !isOpenEdgeTheme(this.stageManager?.theme);
    const isOverFloor = isEnclosedStage || isEntityOverIsland(this.player);
    this.playerShadowBlob.visible = isOverFloor && this.player.y < 120 && !this.player.isDead;
    this.playerShadowBlob.position.set(px, 0.04, pz);
    this.playerLight.position.set(px, py + 2.5, pz + 1.2);
    this.playerLight.intensity = this.player.isAwakened ? 3.2 : 1.1;

    // 3. Sync Vector Hook 3D Line
    if (this.player.hookVisualTimer > 0 && this.player.hookLines && this.player.hookLines.length > 0) {
      const line = this.player.hookLines[0];
      this.hookLine3D.visible = true;
      const hx = to3DX(line.endX ?? (this.player.x + this.player.facing * 260));
      const hy = to3DY(line.endY ?? (this.player.y - 30));
      const hz = this.player.hookPullTarget?.z !== undefined ? to3DZ(this.player.hookPullTarget.z) : pz;
      const posAttr = this.hookLine3D.geometry.attributes.position;
      posAttr.setXYZ(0, px, py + 1.4, pz);
      posAttr.setXYZ(1, hx, Math.max(0.5, hy), hz);
      posAttr.needsUpdate = true;
    } else {
      this.hookLine3D.visible = false;
    }

    // 4. Sync Awakening God Mode Laser Beam
    if (this.player.isAwakened && this.player.isFiringLaser) {
      this.awakeningBeamGroup.visible = true;
      this.awakeningBeamGroup.position.set(px, py + 1.5, pz);
      this.awakeningBeamGroup.scale.x = this.player.facing >= 0 ? 1 : -1;
    } else {
      this.awakeningBeamGroup.visible = false;
    }

    // 5. Sync Enemies & Bosses in 3D
    const activeEnemies = this._scratchEntitySet;
    activeEnemies.clear();
    const zombies = waves.zombies;
    for (let i = 0; i < zombies.length; i++) activeEnemies.add(zombies[i]);
    for (const [enemy, rig] of this.enemyRigs.entries()) {
      if (!activeEnemies.has(enemy) || enemy.isDead) {
        this.dynamicGroup.remove(rig.root);
        disposeHierarchy(rig.root, true);
        this.enemyRigs.delete(enemy);
      }
    }
    for (const enemy of waves.zombies) {
      if (enemy.isDead) continue;
      let rig = this.enemyRigs.get(enemy);
      if (!rig) {
        rig = this.createEnemyRig3D(enemy);
        this.dynamicGroup.add(rig.root);
        this.enemyRigs.set(enemy, rig);
      }
      const ex = to3DX(enemy.x);
      const ey = to3DY(enemy.y);
      const ez = to3DZ(enemy.z || 0);
      rig.root.position.set(ex, ey, ez);
      rig.root.rotation.y = (enemy.facing >= 0 ? Math.PI / 2 : -Math.PI / 2);
      rig.update({
        pose: enemy.pose || 'idle',
        animTimer: enemy.animTimer || 0,
        isGrounded: enemy.isGrounded !== false,
        isHurt: enemy.isHurt,
        isAwakened: enemy.isAwakened,
        isFrozen: (enemy.freezeTimer || 0) > 0,
        actionKind: enemy.actionKind,
        actionPhase: enemy.getActionRenderPhase?.() || 0,
        dt
      });
    }

    // 6. Sync Boss Special Beams / Walls (Dark Lord Laser & H4C3R Walls)
    const doomLaserProj = (projectiles.projectiles || []).find((p) => p.type === 'doom_laser' && !p.pendingRemoval);
    if (doomLaserProj) {
      this.darkLordLaserGroup.visible = true;
      this.darkLordLaserGroup.position.set(to3DX(doomLaserProj.x), Math.max(0.8, to3DY(doomLaserProj.y)), to3DZ(waves.bossZombie?.z || 0));
      this.darkLordLaserGroup.scale.x = doomLaserProj.facing >= 0 ? 1 : -1;
    } else {
      this.darkLordLaserGroup.visible = false;
    }

    const boss = waves.bossZombie;
    if (boss && !boss.isDead && boss.type === 'h4c3r' && (boss.state === 'bracket_telegraph' || boss.state === 'bracket_clamp')) {
      this.h4c3rWallGroup.visible = true;
      const gapX = to3DX(boss.safeGapX || 0);
      const gapHalf = (boss.safeGapHalf || 145) * WORLD_TO_3D;
      this.h4c3rWallL.position.set(gapX - gapHalf - 5.5, 2.25, 0);
      this.h4c3rWallR.position.set(gapX + gapHalf + 5.5, 2.25, 0);
    } else {
      this.h4c3rWallGroup.visible = false;
    }

    // 7. Sync Boss & Heavy Telegraph Rings on 3D Arena Floor
    this.syncTelegraphs3D();

    // 8. Sync Allies, Turrets, and Animator Cursor
    this.syncAllies3D(dt);

    // 9. Sync Sketch Blocks, Anvils, Projectiles, Hazards, and Ink Drops
    this.syncProjectilesAndProps3D();

    // 10. Update 3D Camera
    this.updateCamera3D(dt);
  }

  createEnemyRig3D(enemy) {
    if (enemy.type === 'ender_dragon') return new EnderDragonRig3D();
    if (enemy.type === 'creeper_lord') return new CreeperLordRig3D();
    if (enemy.type === 'giant_cat') return new GiantCatRig3D();
    if (enemy.type === 'lucky_orb') return new LuckyOrbRig3D();
    if (enemy.isMercenary) {
      return new StickRig3D({
        color: enemy.color || '#1e293b',
        scale: enemy.scale || 1.24,
        isHollowHead: false,
        isZombie: false,
        isHunched: enemy.type === 'mercenary_primal',
        zombieType: enemy.type,
        weaponType: enemy.weaponType
      });
    }
    if (enemy.type === 'dark_lord') {
      return new StickRig3D({
        color: '#ff1744',
        scale: 1.32,
        isHollowHead: true,
        weaponType: 'vira_blades'
      });
    }
    if (enemy.type === 'king_orange') {
      return new StickRig3D({
        color: '#ff8a00',
        scale: 1.32,
        hasCrown: true,
        weaponType: 'staff'
      });
    }
    if (enemy.type === 'h4c3r') {
      return new StickRig3D({
        color: '#89939c',
        scale: 1.34,
        isHollowHead: true,
        zombieType: 'h4c3r'
      });
    }
    return new StickRig3D({
      color: enemy.color || '#2e7d32',
      scale: (enemy.scale || 1.0) * 0.98,
      isZombie: true,
      isHunched: true,
      zombieType: enemy.type
    });
  }

  syncTelegraphs3D() {
    const activeSources = this._scratchEntitySet;
    activeSources.clear();

    for (let i = 0; i < waves.zombies.length; i++) {
      const z = waves.zombies[i];
      if (z.isDead) continue;
      const isHeavyWindup = z.actionPhase === 'windup' && z.actionDuration > 0;
      const isBossTelegraph = z.isBoss && (
        z.state?.includes('windup') ||
        z.state?.includes('telegraph') ||
        z.state === 'command_windup' ||
        z.state === 'drop_windup'
      );
      if (!isHeavyWindup && !isBossTelegraph) continue;
      activeSources.add(z);

      let mesh = this.telegraphMeshes.get(z);
      if (!mesh) {
        if (this.telegraphMeshes.size >= 12) continue; // Strict cap of 12 active rings
        if (this.telegraphMeshPool.length > 0) {
          mesh = this.telegraphMeshPool.pop();
        } else {
          mesh = new THREE.Mesh(SHARED_TELEGRAPH_GEO, SHARED_TELEGRAPH_MAT);
        }
        if (!mesh.parent) this.dynamicGroup.add(mesh);
        mesh.visible = true;
        this.telegraphMeshes.set(z, mesh);
      }
      const tx = z.leapTargetX !== undefined && (z.actionKind?.includes('leap') || z.actionKind === 'cat_pounce' || z.actionKind === 'mercenary_lunge')
        ? z.leapTargetX
        : (z.rollTargetX !== undefined && (z.state === 'roll_windup' || z.state === 'swoop_windup' || z.state === 'ranged_windup') ? z.rollTargetX : z.x);
      mesh.position.set(to3DX(tx), 0.08, to3DZ(z.z || 0));
      const scale = z.isBoss ? 1.45 : 0.95;
      mesh.scale.setScalar(scale * (0.85 + Math.sin(this.stageManager.stageTime * 14) * 0.15));
    }

    for (const [src, mesh] of this.telegraphMeshes.entries()) {
      if (!activeSources.has(src)) {
        mesh.visible = false;
        if (this.telegraphMeshPool.length < 12) {
          this.telegraphMeshPool.push(mesh);
        } else {
          this.dynamicGroup.remove(mesh);
          disposeHierarchy(mesh, true);
        }
        this.telegraphMeshes.delete(src);
      }
    }
  }

  syncAllies3D(dt = 0.016) {
    const activeSet = this._scratchEntitySet;
    activeSet.clear();
    const activeAllies = allies.activeAllies || [];
    for (let i = 0; i < activeAllies.length; i++) activeSet.add(activeAllies[i]);
    for (const [ally, rig] of this.allyRigs.entries()) {
      if (!activeSet.has(ally)) {
        this.dynamicGroup.remove(rig.root);
        disposeHierarchy(rig.root, true);
        this.allyRigs.delete(ally);
      }
    }
    const allyColors = {
      red: '#ff3344',
      blue: '#2299ff',
      yellow: '#ffcc00',
      green: '#33dd66',
      chosen: '#0a0a0a',
      king: '#ff8a00'
    };
    for (const ally of activeAllies) {
      let rig = this.allyRigs.get(ally);
      if (!rig) {
        rig = new StickRig3D({
          color: allyColors[ally.type] || '#ff3344',
          scale: ally.type === 'king' ? 1.18 : (ally.type === 'chosen' ? 1.08 : 1.02),
          isHollowHead: ally.type === 'chosen',
          hasCrown: ally.type === 'king',
          weaponType: ally.type === 'king' ? 'staff' : null
        });
        this.dynamicGroup.add(rig.root);
        this.allyRigs.set(ally, rig);
      }
      rig.root.position.set(to3DX(ally.x), to3DY(ally.y), to3DZ((this.player.z || 0) - 45));
      rig.root.rotation.y = ally.facing >= 0 ? Math.PI / 2 : -Math.PI / 2;
      rig.update({
        pose: ally.pose || 'idle',
        animTimer: ally.timer || 0,
        isHurt: ally.isHurt,
        isAwakened: false,
        dt
      });
    }

    // Yellow Turrets
    const turretSet = this._scratchEntitySet;
    turretSet.clear();
    const turrets = allies.turrets || [];
    for (let i = 0; i < turrets.length; i++) turretSet.add(turrets[i]);
    for (const [t, mesh] of this.turretMeshes.entries()) {
      if (!turretSet.has(t) || t.isDead) {
        this.dynamicGroup.remove(mesh);
        disposeHierarchy(mesh, true);
        this.turretMeshes.delete(t);
      }
    }
    for (const t of turrets) {
      if (t.isDead) continue;
      let mesh = this.turretMeshes.get(t);
      if (!mesh) {
        mesh = createTurretMesh3D();
        this.dynamicGroup.add(mesh);
        this.turretMeshes.set(t, mesh);
      }
      mesh.position.set(to3DX(t.x), to3DY(t.y), to3DZ(this.player.z || 0));
    }

    // Animator Cursor
    if (allies.activeCursors.length > 0) {
      const c = allies.activeCursors[0];
      this.cursorGroup3D.visible = true;
      const cz = c.targetZombie?.z || 0;
      this.cursorGroup3D.position.set(to3DX(c.x), to3DY(c.y), to3DZ(cz));
      this.cursorSelectBox.visible = Boolean(c.isSelecting);
    } else {
      this.cursorGroup3D.visible = false;
    }
  }

  syncProjectilesAndProps3D() {
    // 1. Sketch Blocks
    const sketchBlocks = projectiles.sketchBlocks || [];
    const blockSet = this._scratchEntitySet;
    blockSet.clear();
    for (let i = 0; i < sketchBlocks.length; i++) blockSet.add(sketchBlocks[i]);
    for (const [b, mesh] of this.sketchBlockMeshes.entries()) {
      if (!blockSet.has(b)) {
        this.dynamicGroup.remove(mesh);
        disposeHierarchy(mesh, true);
        this.sketchBlockMeshes.delete(b);
      }
    }
    for (let i = 0; i < sketchBlocks.length; i++) {
      const b = sketchBlocks[i];
      if (b.z === undefined) b.z = this.player.z || 0;
      let mesh = this.sketchBlockMeshes.get(b);
      if (!mesh) {
        const w = (b.width || 65) * WORLD_TO_3D;
        const h = (b.height || 65) * WORLD_TO_3D;
        if (!_sharedSketchMat) {
          _sharedSketchMat = new THREE.MeshStandardMaterial({
            map: getVoxelTexture('sketch_block'),
            roughness: 0.4
          });
          _sharedSketchMat.isShared = true;
        }
        mesh = new THREE.Mesh(SHARED_SKETCH_BLOCK_GEO, _sharedSketchMat);
        mesh.scale.set(w, h, w);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.dynamicGroup.add(mesh);
        this.sketchBlockMeshes.set(b, mesh);
      }
      mesh.position.set(to3DX(b.x), to3DY(b.y - (b.height || 65) / 2), to3DZ(b.z));
    }

    // 2. Projectiles (Anvils, ViraBots, Pencils, Javelins, Thrown Zombies, Acid, Notes)
    const allProjs = projectiles.projectiles || [];
    const projSet = this._scratchEntitySet;
    projSet.clear();
    for (let i = 0; i < allProjs.length; i++) projSet.add(allProjs[i]);
    for (const [p, mesh] of this.projectileMeshes.entries()) {
      if (!projSet.has(p) || p.isDead || p.pendingRemoval) {
        this.dynamicGroup.remove(mesh);
        disposeHierarchy(mesh, true);
        this.projectileMeshes.delete(p);
      }
    }
    for (let i = 0; i < allProjs.length; i++) {
      const p = allProjs[i];
      if (p.isDead || p.pendingRemoval || p.type === 'doom_laser') continue;
      if (p.z === undefined) p.z = this.player.z || 0;
      let mesh = this.projectileMeshes.get(p);
      if (!mesh) {
        if (p.type === 'anvil') {
          if (!_sharedAnvilMat) {
            _sharedAnvilMat = new THREE.MeshStandardMaterial({
              map: getVoxelTexture('anvil_iron'),
              metalness: 0.7,
              roughness: 0.3
            });
            _sharedAnvilMat.isShared = true;
          }
          mesh = new THREE.Group();
          const base = new THREE.Mesh(SHARED_ANVIL_BASE_GEO, _sharedAnvilMat);
          base.position.y = 0.25;
          const neck = new THREE.Mesh(SHARED_ANVIL_NECK_GEO, _sharedAnvilMat);
          neck.position.y = 0.8;
          const top = new THREE.Mesh(SHARED_ANVIL_TOP_GEO, _sharedAnvilMat);
          top.position.y = 1.45;
          mesh.add(base, neck, top);
        } else if (p.type === 'virabot') {
          mesh = createViraBotMesh3D();
        } else if (p.type === 'pencil' || p.type === 'javelin' || p.type === 'ex_javelin') {
          mesh = buildVoxelWeaponMesh('pencil');
          mesh.rotation.z = -Math.PI / 2;
          if (p.type !== 'pencil') mesh.scale.setScalar(1.45);
        } else if (p.type === 'thrown_zombie') {
          const rig = new StickRig3D({ color: '#2e7d32', scale: 0.9, isZombie: true });
          mesh = rig.root;
        } else {
          const colorKey = typeof p.color === 'string' ? p.color : (typeof p.color === 'number' ? `#${p.color.toString(16).padStart(6, '0')}` : '#76ff03');
          let mat = this.projectileMaterialCache.get(colorKey);
          if (!mat) {
            mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorKey) });
            mat.isShared = true;
            this.projectileMaterialCache.set(colorKey, mat);
          }
          mesh = new THREE.Mesh(SHARED_PROJECTILE_SPHERE_GEO, mat);
        }
        this.dynamicGroup.add(mesh);
        this.projectileMeshes.set(p, mesh);
      }
      mesh.position.set(to3DX(p.x), Math.max(0.05, to3DY(p.y)), to3DZ(p.z));
      if (p.type === 'thrown_zombie') {
        mesh.rotation.z += 0.25;
      }
    }

    // 3. Floor Acid Hazards & Command Pillars
    const hazList = projectiles.hazards || [];
    const hazSet = this._scratchEntitySet;
    hazSet.clear();
    for (let i = 0; i < hazList.length; i++) hazSet.add(hazList[i]);
    for (const [h, mesh] of this.hazardMeshes.entries()) {
      if (!hazSet.has(h) || h.pendingRemoval) {
        this.dynamicGroup.remove(mesh);
        disposeHierarchy(mesh, true);
        this.hazardMeshes.delete(h);
      }
    }
    for (let i = 0; i < hazList.length; i++) {
      const h = hazList[i];
      if (h.pendingRemoval) continue;
      if (h.z === undefined) h.z = this.player.z || 0;
      let mesh = this.hazardMeshes.get(h);
      if (!mesh) {
        const r = Math.max(0.9, (h.radius || 45) * WORLD_TO_3D);
        const colorKey = typeof h.color === 'string' ? h.color : (typeof h.color === 'number' ? `#${h.color.toString(16).padStart(6, '0')}` : '#76ff03');
        let mat = this.hazardMaterialCache.get(colorKey);
        if (!mat) {
          mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(colorKey),
            transparent: true,
            opacity: 0.65
          });
          mat.isShared = true;
          this.hazardMaterialCache.set(colorKey, mat);
        }
        mesh = new THREE.Mesh(SHARED_HAZARD_CYLINDER_GEO, mat);
        mesh.scale.set(r, 1, r);
        this.dynamicGroup.add(mesh);
        this.hazardMeshes.set(h, mesh);
      }
      mesh.position.set(to3DX(h.x), 0.08, to3DZ(h.z));
    }

    // 4. Collectible Ink Drops (3D Glowing Cubes/Crystals)
    const inkList = combat.inkDrops || [];
    const inkSet = this._scratchEntitySet;
    inkSet.clear();
    for (let i = 0; i < inkList.length; i++) inkSet.add(inkList[i]);
    for (const [orb, mesh] of this.inkMeshes.entries()) {
      if (!inkSet.has(orb)) {
        this.dynamicGroup.remove(mesh);
        disposeHierarchy(mesh, true);
        this.inkMeshes.delete(orb);
      }
    }
    for (let i = 0; i < inkList.length; i++) {
      const orb = inkList[i];
      if (orb.z === undefined) orb.z = (this.player.z || 0) * 0.6;
      let mesh = this.inkMeshes.get(orb);
      if (!mesh) {
        mesh = new THREE.Mesh(SHARED_INK_DROP_GEO, SHARED_INK_DROP_MAT);
        this.dynamicGroup.add(mesh);
        this.inkMeshes.set(orb, mesh);
      }
      mesh.position.set(to3DX(orb.x), Math.max(0.4, to3DY(orb.y)), to3DZ(orb.z));
      mesh.rotation.y += 0.08;
    }
  }

  updateCamera3D(dt) {
    const mode = CAMERA_MODES[this.cameraModeIndex];
    const px = to3DX(this.player.x);
    const py = to3DY(this.player.y);
    const pz = to3DZ(this.player.z || 0);

    const shakeX = (this.camera2D.shakeOffsetX || 0) * 0.018;
    const shakeY = (this.camera2D.shakeOffsetY || 0) * 0.018;

    const camDistZ = mode === 'ISOMETRIC_3D' ? 17.5 : (mode === 'SIDE_25D' ? 15.5 : 14.8);
    const halfFovRad = (this.camera3D.fov * Math.PI) / 360;
    const halfHeight = camDistZ * Math.tan(halfFovRad);
    const halfWidth = halfHeight * (this.camera3D.aspect || 1.6);

    // Keep player always in the center horizontally, unless right next to the left/right walls (±28.82),
    // while guaranteeing the full figure + weapon stays well inside the viewport.
    const arenaMaxX = to3DX(980); // 28.8235
    const maxWallOffset = Math.min(3.6, Math.max(1.2, halfWidth - 2.4));
    const wallStopX = arenaMaxX - maxWallOffset;
    const camX = Math.max(-wallStopX, Math.min(wallStopX, px)) + shakeX;

    // Frame vertically at the stick figure's midpoint (py + 1.15) so the full figure
    // from feet (py + 0) to head (py + 2.4) is always centered and completely visible.
    const centerY = py + 1.15 + shakeY;

    _camLookTarget.set(camX, centerY, pz);

    if (mode === 'ISOMETRIC_3D') {
      _camDesiredPos.set(camX, centerY + 7.2, pz + camDistZ);
    } else if (mode === 'SIDE_25D') {
      _camDesiredPos.set(camX, centerY + 1.1, pz + camDistZ);
    } else {
      // CHASE_3D (Default 3D Arena Brawler Camera)
      _camDesiredPos.set(camX, centerY + 2.8, pz + camDistZ);
    }

    const yzLerp = Math.min(1, dt * 16);
    if (!this.currentLookTarget) {
      this.currentLookTarget = _camLookTarget.clone();
      this.camera3D.position.copy(_camDesiredPos);
    } else {
      this.camera3D.position.x = _camDesiredPos.x;
      this.camera3D.position.y += (_camDesiredPos.y - this.camera3D.position.y) * yzLerp;
      this.camera3D.position.z += (_camDesiredPos.z - this.camera3D.position.z) * yzLerp;
      this.currentLookTarget.x = _camLookTarget.x;
      this.currentLookTarget.y += (_camLookTarget.y - this.currentLookTarget.y) * yzLerp;
      this.currentLookTarget.z += (_camLookTarget.z - this.currentLookTarget.z) * yzLerp;
    }
    this.camera3D.lookAt(this.currentLookTarget);
  }

  projectWorldToOverlay(wx, wy, wz = 0, target = _screenPoint) {
    const x3d = to3DX(wx);
    const y3d = to3DY(wy);
    const z3d = to3DZ(wz);
    _scratchProj.set(x3d, y3d, z3d);

    let dist = 16.0;
    let visible = true;
    if (this.camera3D) {
      dist = this.camera3D.position.distanceTo(_scratchProj);
      _scratchProj.project(this.camera3D);
      // Behind-camera frustum culling: In Three.js NDC, z > 1.0 or z < -1.0
      if (_scratchProj.z > 1.0 || _scratchProj.z < -1.0) {
        visible = false;
      }
    }

    const width = this.viewportWidth || (this.overlayCanvas ? this.overlayCanvas.clientWidth : 0) || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const height = this.viewportHeight || (this.overlayCanvas ? this.overlayCanvas.clientHeight : 0) || (typeof window !== 'undefined' ? window.innerHeight : 720);
    target.x = (_scratchProj.x * 0.5 + 0.5) * width;
    target.y = (-_scratchProj.y * 0.5 + 0.5) * height;
    target.zDepth = _scratchProj.z;
    target.visible = visible;
    target.scale = Math.max(0.65, Math.min(1.35, 16.0 / (dist || 16.0)));
    return target;
  }

  render(dt = 0.016) {
    if (this.hudSyncTimer >= 0.05 || this.state !== 'PLAYING') {
      this.syncHUD();
      this.hudSyncTimer %= 0.05;
    }

    // 1. Render 3D WebGL Scene
    this.sync3DScene(dt);
    this.renderer.render(this.scene, this.camera3D);

    // 2. Render 2D Comic Overlay (Speech Bubbles, Floating Damage Text, Indicators)
    const ctx = this.ctx;
    const width = this.viewportWidth || (this.overlayCanvas ? this.overlayCanvas.clientWidth : 0) || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const height = this.viewportHeight || (this.overlayCanvas ? this.overlayCanvas.clientHeight : 0) || (typeof window !== 'undefined' ? window.innerHeight : 720);
    ctx.clearRect(0, 0, width, height);

    const cameraAdapter = this.cameraAdapter;

    // Draw floating damage numbers, text banners, & comic KABOOM popups projected in 3D
    ctx.save();
    const damageTexts = particles.damageTexts;
    if (damageTexts) {
      for (let i = 0; i < damageTexts.length; i++) {
        const ft = damageTexts[i];
        const screen = this.projectWorldToOverlay(ft.x, ft.y, 0);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, ft.life / (ft.maxLife || 1)));
        ctx.font = ft.isBanner
          ? "900 22px 'Bungee', Impact, sans-serif"
          : (ft.isCrit ? "900 18px 'Bungee', Impact, sans-serif" : "bold 15px 'Trebuchet MS', sans-serif");
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.fillStyle = ft.color || '#ffffff';
        ctx.strokeText(ft.text, screen.x, screen.y);
        ctx.fillText(ft.text, screen.x, screen.y);
        ctx.restore();
      }
    }
    const comicPopups = particles.comicPopups;
    if (comicPopups) {
      for (let i = 0; i < comicPopups.length; i++) {
        const pop = comicPopups[i];
        const screen = this.projectWorldToOverlay(pop.x, pop.y, 0);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, pop.life / (pop.maxLife || 0.7)));
        ctx.font = "900 28px 'Bungee', Impact, sans-serif";
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 5;
        ctx.fillStyle = pop.color || '#ffea00';
        ctx.strokeText(pop.text || 'KABOOM!', screen.x, screen.y);
        ctx.fillText(pop.text || 'KABOOM!', screen.x, screen.y);
        ctx.restore();
      }
    }
    ctx.restore();

    waves.drawScreenIndicators?.(ctx, cameraAdapter, width, height);
    this.stageManager.drawScreenGuide?.(ctx, cameraAdapter, width, height);
    speech.draw(ctx, this.cameraAdapter, width, height, this.camera3D);
  }

  getHudElement(id) {
    if (!(id in this.hudCache)) this.hudCache[id] = document.getElementById(id);
    return this.hudCache[id];
  }

  syncHUD() {
    // 1. Player HP
    const hpFill = this.getHudElement('hud-hp-fill');
    const hpText = this.getHudElement('hud-hp-text');
    if (hpFill && hpText) {
      const pct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
      const hpPctStr = `${pct.toFixed(1)}%`;
      const hpTextStr = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
      if (this.lastHudValues.hpPct !== hpPctStr) {
        hpFill.style.width = hpPctStr;
        this.lastHudValues.hpPct = hpPctStr;
      }
      if (this.lastHudValues.hpText !== hpTextStr) {
        hpText.textContent = hpTextStr;
        this.lastHudValues.hpText = hpTextStr;
      }
    }

    // 2. Player Super Meter & Awakening Status
    const superFill = this.getHudElement('hud-super-fill');
    const superText = this.getHudElement('hud-super-text');
    const superSlot = this.getHudElement('skill-super');
    if (superFill && superText) {
      const pct = Math.min(100, (this.player.superMeter / this.player.maxSuper) * 100);
      const superPctStr = `${pct.toFixed(1)}%`;
      const superTextStr = this.player.isAwakened ? '⚡ ACTIVE!' : `${Math.floor(pct)}%`;
      const isSuperReady = pct >= 100 || this.player.isAwakened;

      if (this.lastHudValues.superPct !== superPctStr) {
        superFill.style.width = superPctStr;
        this.lastHudValues.superPct = superPctStr;
      }
      if (this.lastHudValues.superText !== superTextStr) {
        superText.textContent = superTextStr;
        this.lastHudValues.superText = superTextStr;
      }
      if (this.lastHudValues.superReady !== isSuperReady) {
        superFill.classList.toggle('super-ready', isSuperReady);
        if (superSlot) superSlot.classList.toggle('ready', isSuperReady);
        this.lastHudValues.superReady = isSuperReady;
      }
    }

    // 3. Stage & Wave / Objective Status
    const waveNum = this.getHudElement('hud-wave-number');
    const zombieCount = this.getHudElement('hud-zombies-count');
    if (waveNum) {
      const waveStr = this.stageManager.isTrophyRoom
        ? 'EPILOGUE - 3D TROPHY ROOM'
        : `${this.stageManager.currentStage} - ${this.stageManager.stageName}`;
      if (this.lastHudValues.waveStr !== waveStr) {
        waveNum.textContent = waveStr;
        this.lastHudValues.waveStr = waveStr;
      }
    }
    if (zombieCount) {
      const isDoorOpen = this.stageManager.exitDoor.isOpen;
      const isTrophy = this.stageManager.isTrophyRoom;
      const aliveZombies = waves.getAliveCount();
      const zombieKey = `${isDoorOpen}:${isTrophy}:${aliveZombies}`;
      if (this.lastHudValues.zombieKey !== zombieKey) {
        if (isDoorOpen) {
          zombieCount.innerHTML = `<span style="color: #34d399;">${isTrophy ? '★ EXPLORE ➔ RESULTS' : '★ PORTAL OPEN ➔ ENTER EXIT'}</span>`;
        } else {
          zombieCount.textContent = `Zombies: ${aliveZombies}`;
        }
        this.lastHudValues.zombieKey = zombieKey;
      }
    }

    // 4. Boss Health Bar & Label
    const bossBox = this.getHudElement('boss-health-box');
    const bossFill = this.getHudElement('boss-hp-fill');
    const bossLabel = this.getHudElement('boss-name-label');
    if (bossBox && bossFill) {
      const boss = waves.bossZombie;
      const hasActiveBoss = Boolean(boss && !boss.isDead);
      if (hasActiveBoss) {
        if (this.lastHudValues.bossVisible !== true) {
          bossBox.style.display = 'flex';
          this.lastHudValues.bossVisible = true;
        }
        const bossType = boss.type;
        const bossClassName = `boss-health-container ${bossType.replaceAll('_', '-')}-boss`;
        if (this.lastHudValues.bossClassName !== bossClassName) {
          bossBox.className = bossClassName;
          this.lastHudValues.bossClassName = bossClassName;
        }
        if (bossLabel) {
          const labelText = boss.name?.startsWith('MERCENARIES')
            ? boss.name
            : (this.stageManager.campaignBeat?.bossLabel || boss.name || bossType.toUpperCase());
          if (this.lastHudValues.bossLabel !== labelText) {
            bossLabel.textContent = labelText;
            this.lastHudValues.bossLabel = labelText;
          }
        }
        const bossPct = Math.max(0, (boss.hp / boss.maxHp) * 100);
        const bossPctStr = `${bossPct.toFixed(1)}%`;
        if (this.lastHudValues.bossPct !== bossPctStr) {
          bossFill.style.width = bossPctStr;
          this.lastHudValues.bossPct = bossPctStr;
        }
      } else {
        if (this.lastHudValues.bossVisible !== false) {
          bossBox.style.display = 'none';
          this.lastHudValues.bossVisible = false;
          this.lastHudValues.bossClassName = null;
          this.lastHudValues.bossLabel = null;
          this.lastHudValues.bossPct = null;
        }
      }
    }

    // 5. Score & Ink Counter
    const hudScore = this.getHudElement('hud-score');
    const hudInk = this.getHudElement('hud-ink');
    if (hudScore && this.lastHudValues.score !== combat.score) {
      hudScore.textContent = combat.score;
      this.lastHudValues.score = combat.score;
    }
    if (hudInk && this.lastHudValues.ink !== combat.ink) {
      hudInk.textContent = combat.ink;
      this.lastHudValues.ink = combat.ink;
    }

    // 6. Combo Rank & Timer Bar
    const comboContainer = this.getHudElement('hud-combo');
    const comboHits = this.getHudElement('combo-hit-count');
    const comboTitle = this.getHudElement('combo-rank-title');
    const comboBar = this.getHudElement('combo-timer-fill');
    if (comboContainer) {
      const isComboActive = combat.combo >= 2;
      if (isComboActive) {
        if (!this.lastHudValues.comboActive) {
          comboContainer.classList.add('active');
          this.lastHudValues.comboActive = true;
        }
        const hitsText = `${combat.combo} HITS`;
        if (comboHits && this.lastHudValues.comboHits !== hitsText) {
          comboHits.textContent = hitsText;
          this.lastHudValues.comboHits = hitsText;
        }
        const rankInfo = combat.getRankTitle();
        const rankText = `${rankInfo.rank} · ${rankInfo.title}`;
        if (comboTitle && this.lastHudValues.comboTitle !== rankText) {
          comboTitle.textContent = rankText;
          this.lastHudValues.comboTitle = rankText;
        }
        if (comboBar) {
          const pct = Math.max(0, Math.min(100, (combat.comboTimer / combat.comboDuration) * 100));
          const barWidth = `${pct.toFixed(1)}%`;
          if (this.lastHudValues.comboBarWidth !== barWidth) {
            comboBar.style.width = barWidth;
            this.lastHudValues.comboBarWidth = barWidth;
          }
        }
      } else if (this.lastHudValues.comboActive !== false) {
        comboContainer.classList.remove('active');
        this.lastHudValues.comboActive = false;
        this.lastHudValues.comboHits = null;
        this.lastHudValues.comboTitle = null;
        this.lastHudValues.comboBarWidth = null;
      }
    }

    // 7. Ally Summon Slot Cooldowns
    const syncAlly = (id, type, statusId) => {
      const el = this.getHudElement(id);
      if (!el) return;
      const cd = allies.cooldowns[type] || 0;
      const recovering = allies.recoveryStates?.[type] === true;
      const cdCeil = Math.ceil(cd);
      const allyKey = `${cd > 0}:${recovering}:${cdCeil}`;

      if (this.lastHudValues[`ally_${type}`] !== allyKey) {
        const isCooling = cd > 0;
        el.style.opacity = isCooling ? '0.5' : '1.0';
        el.style.filter = isCooling ? 'grayscale(0.6)' : 'none';
        el.classList.toggle('recovering', recovering && isCooling);

        const status = this.getHudElement(statusId);
        if (status) {
          status.textContent = isCooling ? `${recovering ? '↻' : ''}${cdCeil}` : '';
          status.style.opacity = isCooling ? '1' : '0';
        }
        this.lastHudValues[`ally_${type}`] = allyKey;
      }
    };
    syncAlly('ally-red-slot', 'red', 'ally-red-status');
    syncAlly('ally-blue-slot', 'blue', 'ally-blue-status');
    syncAlly('ally-yellow-slot', 'yellow', 'ally-yellow-status');
    syncAlly('ally-green-slot', 'green', 'ally-green-status');
    syncAlly('ally-cursor-slot', 'cursor', 'ally-cursor-status');
    syncAlly('ally-chosen-slot', 'chosen', 'ally-chosen-status');

    // 8. Combat Skill Cooldowns
    const syncSkillCooldown = (slotId, overlayId, remaining) => {
      const remainingCeil = Math.max(1, Math.ceil(remaining));
      const coolingDown = remaining > 0;
      const skillKey = `${coolingDown}:${coolingDown ? remainingCeil : 0}`;

      if (this.lastHudValues[`skill_${slotId}`] !== skillKey) {
        const slot = this.getHudElement(slotId);
        const overlay = this.getHudElement(overlayId);
        if (slot) {
          slot.classList.toggle('cooldown', coolingDown);
          slot.classList.toggle('ready', !coolingDown);
        }
        if (overlay) {
          overlay.style.opacity = coolingDown ? '1' : '0';
          overlay.textContent = coolingDown ? remainingCeil : '';
        }
        this.lastHudValues[`skill_${slotId}`] = skillKey;
      }
    };
    syncSkillCooldown('skill-roll', 'cd-roll-overlay', this.player.rollCooldown);
    syncSkillCooldown('skill-block', 'cd-block-overlay', this.player.blockCooldown);
    syncSkillCooldown('skill-hook', 'cd-hook-overlay', this.player.hookCooldown);
    syncSkillCooldown('skill-grab', 'cd-grab-overlay', this.player.grabCooldown);
  }
}

if (typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const game3d = new Game3D();
    window.__stickGame3D = game3d;
    game3d.init();
  });
}
