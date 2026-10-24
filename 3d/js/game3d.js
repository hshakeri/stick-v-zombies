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
import { speech } from '../../js/engine/speech.js?v=9.8';
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
    this.voxelParticles = [];
    this.floorSplats3D = [];

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
    this.showMissionStrip(stageNum, 'STAGE JUMP');
    this.syncStageSelectors(stageNum);
  }

  setupResize() {
    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);

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
            allies.summonAlly(type, this.player.x, this.groundY, this.player.facing, waves.zombies);
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

  clearDynamic3DMeshes() {
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
    this.telegraphMeshes.clear();
    this.voxelParticles.length = 0;
    this.floorSplats3D.length = 0;
    this.currentLookTarget = null;
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
    this.player.isGrounded = true;
    this.player.weaponType = 'pencil';
    this.player.temporaryWeaponTimer = 0;
    this.player.beginDrawIn?.();

    this.camera2D.snapTo(this.player);
    this.prepareWeaponPickup(stage);
    this.captureStageCheckpoint();
    this.showMissionStrip(stage, 'RETRY');
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
    combat.clearArena();
    this.clearDynamic3DMeshes();
    this.arena3D.rebuildForStage();

    this.player.x = this.stageManager.entranceDoor.x + 30;
    this.player.y = this.groundY;
    this.player.z = 0;
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
    combat.clearArena();
    this.clearDynamic3DMeshes();

    this.stageManager.enterTrophyRoom();
    this.arena3D.rebuildForStage();

    this.player.resetStageCombat?.(true);
    this.player.x = this.stageManager.entranceDoor.x + 60;
    this.player.y = this.groundY;
    this.player.z = 0;
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

    this.syncStageSelectors(22);
  }

  completeGame() {
    this.state = 'VICTORY';
    audio.setIntensity(0);
    audio.setBGMDucked?.(true);
    projectiles.reset();
    allies.reset(false);
    this.player.cancelHook?.(true);
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
    if (this.missionStripTimer === 0) document.getElementById('mission-strip')?.classList.remove('active');
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

  update(dt) {
    this.camera2D.update(dt, this.player, waves.zombies.length);
    const simDt = this.camera2D.isHitstopped() ? dt * 0.5 : dt;
    this.hudSyncTimer += simDt;
    this.updateMissionStrip(simDt);

    // Filter platforms by 3D Z-proximity so player lands on 3D slabs when aligned in Z!
    const allPlatforms = this.stageManager.getAllSolidPlatforms();
    const playerZ = this.player.z || 0;
    const zAlignedPlatforms = allPlatforms.filter((p) => {
      const pz = p.z3d || 0;
      const halfD = (p.depth3d || 170) * 0.62;
      return Math.abs(playerZ - pz) <= halfD;
    });

    const hostileTargets = this.collectHostileTargets();
    this.player.update(simDt, input, this.groundY, projectiles.sketchBlocks, hostileTargets, this.camera2D, zAlignedPlatforms);

    // Update Player 3D Z-axis movement
    this.updatePlayer3DMovement(simDt, hostileTargets);

    if (this.player.isDead && this.player.deathTimer <= 0) {
      this.gameOver();
      return;
    }

    waves.update(
      simDt,
      this.player,
      this.groundY,
      projectiles.sketchBlocks,
      this.camera2D,
      () => {},
      allPlatforms,
      allies.getCombatTargets?.() || []
    );

    // Update Enemy & Boss 3D Z-positions and separation
    this.updateEnemies3DMovement(simDt);

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
    speech.update(simDt);
    this.updateWeaponPickup();

    // Update 3D Arena, 3D Laser Contact Damage & Voxel Particles
    this.arena3D.update(simDt);
    this.check3DLaserDamage();
    this.updateVoxelParticles(simDt);
  }

  check3DLaserDamage() {
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

  updatePlayer3DMovement(dt, hostileTargets) {
    if (this.player.z === undefined) this.player.z = 0;
    if (this.player.vz === undefined) this.player.vz = 0;

    const zDir = this.zInput || 0;
    const zSpeed = this.player.speed * (this.player.isRolling ? 1.35 : 0.78);
    if (zDir !== 0 && !this.player.isDead) {
      this.player.vz = zDir * zSpeed;
      if (this.player.vx === 0 && this.player.isGrounded && this.player.pose === 'idle') {
        this.player.pose = 'run';
      }
    } else {
      this.player.vz *= Math.pow(0.001, dt);
    }

    // Target Z-assist during attacks so 3D combos snap smoothly into the nearest enemy's Z lane!
    if (this.player.pose?.startsWith('attack') || this.player.pose === 'weapon_slash') {
      let nearest = null;
      let bestDist = 260;
      for (const t of hostileTargets) {
        if (!t || t.isDead) continue;
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

    this.player.z = Math.max(-ARENA_HALF_Z, Math.min(ARENA_HALF_Z, this.player.z + this.player.vz * dt));

    // Smooth 3D Yaw Rotation
    const targetYaw = this.player.facing >= 0 ? Math.PI / 2 : -Math.PI / 2;
    const zTilt = (this.player.vz / Math.max(1, this.player.speed)) * 0.24 * (this.player.facing >= 0 ? 1 : -1);
    const desiredYaw = targetYaw + zTilt;
    this.player.yaw = (this.player.yaw ?? desiredYaw) + (desiredYaw - (this.player.yaw ?? desiredYaw)) * Math.min(1, dt * 28);
  }

  updateEnemies3DMovement(dt) {
    const enemies = waves.zombies;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
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

      e.z = Math.max(-ARENA_HALF_Z + 30, Math.min(ARENA_HALF_Z - 30, e.z + vz * dt));
    }
  }

  spawnVoxelBurst(x, y, z, hexColor = '#ff7700', count = 8) {
    if (this.voxelParticles.length > 140) return;
    const color = new THREE.Color(hexColor);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      roughness: 0.4
    });
    const x3 = to3DX(x);
    const y3 = Math.max(0.3, to3DY(y));
    const z3 = to3DZ(z);

    for (let i = 0; i < count; i++) {
      const size = 0.14 + Math.random() * 0.18;
      const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
      cube.position.set(x3, y3, z3);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 6.5;
      this.dynamicGroup.add(cube);
      this.voxelParticles.push({
        mesh: cube,
        vx: Math.cos(angle) * speed,
        vy: 3.0 + Math.random() * 6.5,
        vz: Math.sin(angle) * speed,
        life: 0.55 + Math.random() * 0.35
      });
    }

    // Optional 3D floor splatter stamp if splatter enabled
    if (particles.splatterEnabled !== false && this.floorSplats3D.length < 36) {
      const splatMat = new THREE.MeshBasicMaterial({
        color: 0x991b1b,
        transparent: true,
        opacity: 0.7,
        depthWrite: false
      });
      const r = 0.35 + Math.random() * 0.45;
      const splat = new THREE.Mesh(new THREE.BoxGeometry(r, 0.04, r), splatMat);
      splat.position.set(x3 + (Math.random() - 0.5) * 0.8, 0.03, z3 + (Math.random() - 0.5) * 0.8);
      this.dynamicGroup.add(splat);
      this.floorSplats3D.push({ mesh: splat, life: 5.5 });
    }
  }

  updateVoxelParticles(dt) {
    for (let i = this.voxelParticles.length - 1; i >= 0; i--) {
      const p = this.voxelParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.dynamicGroup.remove(p.mesh);
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
        this.dynamicGroup.remove(s.mesh);
        this.floorSplats3D.splice(i, 1);
      } else if (s.life < 1.2) {
        s.mesh.material.opacity = s.life * 0.55;
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
    this.playerRig.update({
      pose: this.player.pose,
      animTimer: this.player.animTimer,
      isGrounded: this.player.isGrounded !== false,
      isHurt: this.player.isHurt,
      isAwakened: this.player.isAwakened,
      weaponType: this.player.weaponType || 'pencil',
      actionPhase: this.player.moveProgress || 0,
      dt
    });

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
    const activeEnemies = new Set(waves.zombies);
    for (const [enemy, rig] of this.enemyRigs.entries()) {
      if (!activeEnemies.has(enemy) || enemy.isDead) {
        this.dynamicGroup.remove(rig.root);
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
    const activeSources = new Set();
    for (const z of waves.zombies) {
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
        const geo = new THREE.RingGeometry(0.4, 3.2, 28);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xff2244,
          transparent: true,
          opacity: 0.48,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        mesh = new THREE.Mesh(geo, mat);
        this.dynamicGroup.add(mesh);
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
        this.dynamicGroup.remove(mesh);
        this.telegraphMeshes.delete(src);
      }
    }
  }

  syncAllies3D(dt = 0.016) {
    const activeSet = new Set(allies.activeAllies);
    for (const [ally, rig] of this.allyRigs.entries()) {
      if (!activeSet.has(ally)) {
        this.dynamicGroup.remove(rig.root);
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
    for (const ally of allies.activeAllies) {
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
    const turretSet = new Set(allies.turrets);
    for (const [t, mesh] of this.turretMeshes.entries()) {
      if (!turretSet.has(t) || t.isDead) {
        this.dynamicGroup.remove(mesh);
        this.turretMeshes.delete(t);
      }
    }
    for (const t of allies.turrets) {
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
    const blockSet = new Set(projectiles.sketchBlocks);
    for (const [b, mesh] of this.sketchBlockMeshes.entries()) {
      if (!blockSet.has(b)) {
        this.dynamicGroup.remove(mesh);
        this.sketchBlockMeshes.delete(b);
      }
    }
    for (const b of projectiles.sketchBlocks) {
      if (b.z === undefined) b.z = this.player.z || 0;
      let mesh = this.sketchBlockMeshes.get(b);
      if (!mesh) {
        const w = (b.width || 65) * WORLD_TO_3D;
        const h = (b.height || 65) * WORLD_TO_3D;
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, w),
          new THREE.MeshStandardMaterial({ map: getVoxelTexture('sketch_block'), roughness: 0.4 })
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.dynamicGroup.add(mesh);
        this.sketchBlockMeshes.set(b, mesh);
      }
      mesh.position.set(to3DX(b.x), to3DY(b.y - (b.height || 65) / 2), to3DZ(b.z));
    }

    // 2. Projectiles (Anvils, ViraBots, Pencils, Javelins, Thrown Zombies, Acid, Notes)
    const allProjs = projectiles.projectiles || [];
    const projSet = new Set(allProjs);
    for (const [p, mesh] of this.projectileMeshes.entries()) {
      if (!projSet.has(p) || p.isDead || p.pendingRemoval) {
        this.dynamicGroup.remove(mesh);
        this.projectileMeshes.delete(p);
      }
    }
    for (const p of allProjs) {
      if (p.isDead || p.pendingRemoval || p.type === 'doom_laser') continue;
      if (p.z === undefined) p.z = this.player.z || 0;
      let mesh = this.projectileMeshes.get(p);
      if (!mesh) {
        if (p.type === 'anvil') {
          mesh = new THREE.Group();
          const ironMat = new THREE.MeshStandardMaterial({
            map: getVoxelTexture('anvil_iron'),
            metalness: 0.7,
            roughness: 0.3
          });
          const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.4), ironMat);
          base.position.y = 0.25;
          const neck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.9), ironMat);
          neck.position.y = 0.8;
          const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 1.5), ironMat);
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
          const col = p.color ? new THREE.Color(p.color) : new THREE.Color(0x76ff03);
          mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.36, 10, 10),
            new THREE.MeshBasicMaterial({ color: col })
          );
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
    const hazSet = new Set(projectiles.hazards || []);
    for (const [h, mesh] of this.hazardMeshes.entries()) {
      if (!hazSet.has(h) || h.pendingRemoval) {
        this.dynamicGroup.remove(mesh);
        this.hazardMeshes.delete(h);
      }
    }
    for (const h of projectiles.hazards || []) {
      if (h.pendingRemoval) continue;
      if (h.z === undefined) h.z = this.player.z || 0;
      let mesh = this.hazardMeshes.get(h);
      if (!mesh) {
        const r = Math.max(0.9, (h.radius || 45) * WORLD_TO_3D);
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(r, r, 0.14, 16),
          new THREE.MeshBasicMaterial({
            color: h.color || 0x76ff03,
            transparent: true,
            opacity: 0.65
          })
        );
        this.dynamicGroup.add(mesh);
        this.hazardMeshes.set(h, mesh);
      }
      mesh.position.set(to3DX(h.x), 0.08, to3DZ(h.z));
    }

    // 4. Collectible Ink Drops (3D Glowing Cubes/Crystals)
    const inkSet = new Set(combat.inkDrops || []);
    for (const [orb, mesh] of this.inkMeshes.entries()) {
      if (!inkSet.has(orb)) {
        this.dynamicGroup.remove(mesh);
        this.inkMeshes.delete(orb);
      }
    }
    for (const orb of combat.inkDrops || []) {
      if (orb.z === undefined) orb.z = (this.player.z || 0) * 0.6;
      let mesh = this.inkMeshes.get(orb);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.32, 0),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x00f5ff,
            emissiveIntensity: 0.9,
            roughness: 0.2
          })
        );
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

    let desiredPos;
    const lookTarget = new THREE.Vector3(camX, centerY, pz);

    if (mode === 'ISOMETRIC_3D') {
      desiredPos = new THREE.Vector3(camX, centerY + 7.2, pz + camDistZ);
    } else if (mode === 'SIDE_25D') {
      desiredPos = new THREE.Vector3(camX, centerY + 1.1, pz + camDistZ);
    } else {
      // CHASE_3D (Default 3D Arena Brawler Camera)
      desiredPos = new THREE.Vector3(camX, centerY + 2.8, pz + camDistZ);
    }

    const yzLerp = Math.min(1, dt * 16);
    if (!this.currentLookTarget) {
      this.currentLookTarget = lookTarget.clone();
      this.camera3D.position.copy(desiredPos);
    } else {
      this.camera3D.position.x = desiredPos.x;
      this.camera3D.position.y += (desiredPos.y - this.camera3D.position.y) * yzLerp;
      this.camera3D.position.z += (desiredPos.z - this.camera3D.position.z) * yzLerp;
      this.currentLookTarget.x = lookTarget.x;
      this.currentLookTarget.y += (lookTarget.y - this.currentLookTarget.y) * yzLerp;
      this.currentLookTarget.z += (lookTarget.z - this.currentLookTarget.z) * yzLerp;
    }
    this.camera3D.lookAt(this.currentLookTarget);
  }

  projectWorldToOverlay(wx, wy, wz = 0) {
    const v = new THREE.Vector3(to3DX(wx), to3DY(wy), to3DZ(wz));
    v.project(this.camera3D);
    const width = this.overlayCanvas.clientWidth || window.innerWidth;
    const height = this.overlayCanvas.clientHeight || window.innerHeight;
    return {
      x: (v.x * 0.5 + 0.5) * width,
      y: (-v.y * 0.5 + 0.5) * height
    };
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
    const width = this.overlayCanvas.clientWidth || window.innerWidth;
    const height = this.overlayCanvas.clientHeight || window.innerHeight;
    ctx.clearRect(0, 0, width, height);

    const cameraAdapter = {
      zoom: 1,
      worldToScreen: (wx, wy) => this.projectWorldToOverlay(wx, wy, 0)
    };

    // Draw floating damage numbers, text banners, & comic KABOOM popups projected in 3D
    ctx.save();
    for (const ft of particles.damageTexts || []) {
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
    for (const pop of particles.comicPopups || []) {
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
    ctx.restore();

    waves.drawScreenIndicators?.(ctx, cameraAdapter, width, height);
    this.stageManager.drawScreenGuide?.(ctx, cameraAdapter, width, height);
    speech.draw(ctx, cameraAdapter, width, height);
  }

  getHudElement(id) {
    if (!(id in this.hudCache)) this.hudCache[id] = document.getElementById(id);
    return this.hudCache[id];
  }

  syncHUD() {
    const hpFill = this.getHudElement('hud-hp-fill');
    const hpText = this.getHudElement('hud-hp-text');
    if (hpFill && hpText) {
      const pct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
      hpFill.style.width = `${pct}%`;
      hpText.innerText = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
    }
    const superFill = this.getHudElement('hud-super-fill');
    const superText = this.getHudElement('hud-super-text');
    const superSlot = this.getHudElement('skill-super');
    if (superFill && superText) {
      const pct = Math.min(100, (this.player.superMeter / this.player.maxSuper) * 100);
      superFill.style.width = `${pct}%`;
      superText.innerText = this.player.isAwakened ? '⚡ ACTIVE!' : `${Math.floor(pct)}%`;
      superFill.classList.toggle('super-ready', pct >= 100 || this.player.isAwakened);
      if (superSlot) superSlot.classList.toggle('ready', pct >= 100 || this.player.isAwakened);
    }
    const waveNum = this.getHudElement('hud-wave-number');
    const zombieCount = this.getHudElement('hud-zombies-count');
    if (waveNum) {
      waveNum.innerText = this.stageManager.isTrophyRoom
        ? 'EPILOGUE - 3D TROPHY ROOM'
        : `${this.stageManager.currentStage} - ${this.stageManager.stageName}`;
    }
    if (zombieCount) {
      if (this.stageManager.exitDoor.isOpen) {
        zombieCount.innerHTML = `<span style="color: #34d399;">${this.stageManager.isTrophyRoom ? '★ EXPLORE ➔ RESULTS' : '★ PORTAL OPEN ➔ ENTER EXIT'}</span>`;
      } else {
        zombieCount.innerText = `Zombies: ${waves.getAliveCount()}`;
      }
    }
    const bossBox = this.getHudElement('boss-health-box');
    const bossFill = this.getHudElement('boss-hp-fill');
    const bossLabel = this.getHudElement('boss-name-label');
    if (bossBox && bossFill) {
      if (waves.bossZombie && !waves.bossZombie.isDead) {
        bossBox.style.display = 'flex';
        const bossType = waves.bossZombie.type;
        bossBox.className = `boss-health-container ${bossType.replaceAll('_', '-')}-boss`;
        if (bossLabel) {
          bossLabel.innerText = waves.bossZombie.name?.startsWith('MERCENARIES')
            ? waves.bossZombie.name
            : (this.stageManager.campaignBeat?.bossLabel || waves.bossZombie.name || bossType.toUpperCase());
        }
        const bossPct = (waves.bossZombie.hp / waves.bossZombie.maxHp) * 100;
        bossFill.style.width = `${Math.max(0, bossPct)}%`;
      } else {
        bossBox.style.display = 'none';
      }
    }
    const hudScore = this.getHudElement('hud-score');
    const hudInk = this.getHudElement('hud-ink');
    if (hudScore) hudScore.innerText = combat.score;
    if (hudInk) hudInk.innerText = combat.ink;

    const comboContainer = this.getHudElement('hud-combo');
    const comboHits = this.getHudElement('combo-hit-count');
    const comboTitle = this.getHudElement('combo-rank-title');
    const comboBar = this.getHudElement('combo-timer-fill');
    if (comboContainer && combat.combo >= 2) {
      comboContainer.classList.add('active');
      const rankInfo = combat.getRankTitle();
      if (comboHits) comboHits.innerText = `${combat.combo} HITS`;
      if (comboTitle) comboTitle.innerText = `${rankInfo.rank} · ${rankInfo.title}`;
      if (comboBar) comboBar.style.width = `${(combat.comboTimer / combat.comboDuration) * 100}%`;
    } else if (comboContainer) {
      comboContainer.classList.remove('active');
    }

    const syncAlly = (id, type, statusId) => {
      const el = this.getHudElement(id);
      if (!el) return;
      const cd = allies.cooldowns[type] || 0;
      const recovering = allies.recoveryStates?.[type] === true;
      el.style.opacity = cd > 0 ? '0.5' : '1.0';
      el.style.filter = cd > 0 ? 'grayscale(0.6)' : 'none';
      el.classList.toggle('recovering', recovering && cd > 0);
      const status = this.getHudElement(statusId);
      if (status) {
        status.innerText = cd > 0 ? `${recovering ? '↻' : ''}${Math.ceil(cd)}` : '';
        status.style.opacity = cd > 0 ? '1' : '0';
      }
    };
    syncAlly('ally-red-slot', 'red', 'ally-red-status');
    syncAlly('ally-blue-slot', 'blue', 'ally-blue-status');
    syncAlly('ally-yellow-slot', 'yellow', 'ally-yellow-status');
    syncAlly('ally-green-slot', 'green', 'ally-green-status');
    syncAlly('ally-cursor-slot', 'cursor', 'ally-cursor-status');
    syncAlly('ally-chosen-slot', 'chosen', 'ally-chosen-status');

    const syncSkillCooldown = (slotId, overlayId, remaining) => {
      const slot = this.getHudElement(slotId);
      const overlay = this.getHudElement(overlayId);
      const coolingDown = remaining > 0;
      if (slot) {
        slot.classList.toggle('cooldown', coolingDown);
        slot.classList.toggle('ready', !coolingDown);
      }
      if (overlay) {
        overlay.style.opacity = coolingDown ? '1' : '0';
        overlay.innerText = coolingDown ? Math.max(1, Math.ceil(remaining)) : '';
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
