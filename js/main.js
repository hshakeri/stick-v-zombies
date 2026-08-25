
import { audio } from './engine/audio.js?v=8.7';
import { input } from './engine/input.js?v=8.7';
import { Camera } from './engine/camera.js?v=8.7';
import { particles } from './engine/particles.js?v=8.7';
import { Player } from './entities/player.js?v=8.7';
import { waves } from './systems/waves.js?v=8.7';
import { combat } from './systems/combat.js?v=8.7';
import { shop } from './systems/shop.js?v=8.7';
import { CAMPAIGN_BEATS, stages } from './systems/stages.js?v=8.7';
import { projectiles } from './entities/projectiles.js?v=8.7';
import { allies } from './entities/allies.js?v=8.7';
import { speech } from './engine/speech.js?v=8.7';
import { save } from './systems/save.js?v=8.7';

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.groundY = 0; // World Ground coordinate
    this.camera = new Camera(this.canvas);
    this.stageManager = stages;
    this.player = new Player(this.stageManager.entranceDoor.x + 30, this.groundY);

    this.state = 'TITLE'; // 'TITLE', 'PLAYING', 'SHOP', 'PAUSED', 'GAMEOVER', 'VICTORY'
    this.lastTime = 0;
    this.lastStaticRender = 0;
    this.hudSyncTimer = 0;
    this.hudCache = Object.create(null);
    this.reportedErrors = new Set();
    this.reportedLayerErrors = new Set();
    this.hostileTargets = [];
    this.stageCheckpoint = null;
    this.weaponPickup = null;
    this.missionStripTimer = 0;
  }

  init() {
    this.setupResize();
    input.init(this.canvas, this.camera);
    this.applySavedSettings();
    this.bindUIEvents();
    this.syncContinueButton();

    requestAnimationFrame((timestamp) => {
      this.lastTime = timestamp;
      this.gameLoop(timestamp);
    });
  }

  setupResize() {
    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = this.camera.getRenderPixelRatio(window.devicePixelRatio || 1);
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
      particles.configureForCanvas?.(this.canvas);
      this.camera.clampToArena();
    };
    window.addEventListener('resize', resize);
    resize();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') this.pauseGame();
      this.lastTime = performance.now();
    });
  }

  applySavedSettings() {
    particles.setSplatterEnabled?.(save.getSetting('splatter', true));
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
    if (typeof document === 'undefined') return;
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
        this.startGame();
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

    const btnTryAgain = document.getElementById('btn-try-again');
    if (btnTryAgain) {
      btnTryAgain.addEventListener('click', () => {
        this.retryStage();
      });
    }

    const btnRestartCampaign = document.getElementById('btn-restart-campaign');
    if (btnRestartCampaign) btnRestartCampaign.addEventListener('click', () => this.restartGame());

    const btnMenuFromGameOver = document.getElementById('btn-menu-from-gameover');
    if (btnMenuFromGameOver) btnMenuFromGameOver.addEventListener('click', () => this.showTitleScreen());

    const btnVictoryReplay = document.getElementById('btn-victory-replay');
    if (btnVictoryReplay) btnVictoryReplay.addEventListener('click', () => this.startGame());

    const btnVictoryMenu = document.getElementById('btn-victory-menu');
    if (btnVictoryMenu) btnVictoryMenu.addEventListener('click', () => this.showTitleScreen());

    const btnOpenShop = document.getElementById('btn-open-shop');
    if (btnOpenShop) {
      btnOpenShop.addEventListener('click', () => {
        if (this.state === 'PLAYING') this.openShop();
      });
    }
    const btnTouchShop = document.getElementById('btn-touch-shop');
    if (btnTouchShop) {
      btnTouchShop.addEventListener('click', () => {
        if (this.state === 'PLAYING') this.openShop();
      });
    }

    const btnCloseShop = document.getElementById('btn-close-shop');
    const btnResumeFromShop = document.getElementById('btn-resume-from-shop');
    const closeShop = () => {
      this.closeShop();
    };
    if (btnCloseShop) btnCloseShop.addEventListener('click', closeShop);
    if (btnResumeFromShop) btnResumeFromShop.addEventListener('click', closeShop);

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
    if (btnResumeGame) {
      btnResumeGame.addEventListener('click', () => {
        this.resumeGame();
      });
    }

    const btnRestartGame = document.getElementById('btn-restart-game');
    if (btnRestartGame) {
      btnRestartGame.addEventListener('click', () => {
        this.restartGame();
      });
    }

    const btnPauseShop = document.getElementById('btn-pause-shop');
    if (btnPauseShop) {
      btnPauseShop.addEventListener('click', () => {
        this.hideModal('pause-modal');
        this.openShop();
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
        btnAudio.setAttribute('aria-label', enabled ? 'Mute sound and music' : 'Enable sound and music');
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
  }

  startGame(options = {}) {
    const checkpoint = options.fromCheckpoint ? save.data.checkpoint : null;
    const stage = checkpoint && checkpoint.stage >= 1 && checkpoint.stage <= 16 ? checkpoint.stage : 1;
    this.hideAllModals();
    this.state = 'PLAYING';
    this.reportedLayerErrors.clear();
    input.resetHeldInputs();
    projectiles.reset();
    allies.reset(true);
    particles.reset();
    speech.reset();
    shop.reset();
    combat.resetRun(checkpoint ? checkpoint.ink ?? 50 : 50);
    this.stageManager.loadStage(stage);
    this.player = new Player(this.stageManager.entranceDoor.x + 30, this.groundY);
    this.player.isGrounded = true;
    if (checkpoint) {
      combat.score = checkpoint.score | 0;
      combat.totalKills = checkpoint.totalKills | 0;
      combat.maxCombo = checkpoint.maxCombo | 0;
      // Re-apply saved upgrade levels through the shop so side effects
      // (ally cooldowns, anvil damage) land exactly like a live purchase.
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
    this.camera.snapTo(this.player);
    waves.startWave(stage);
    this.prepareWeaponPickup(stage);
    this.captureStageCheckpoint();
    this.showMissionStrip(stage, checkpoint ? 'CONTINUE' : '');
  }

  restartGame() {
    this.hideAllModals();
    this.startGame();
  }

  retryStage() {
    const stage = this.stageManager.currentStage;
    this.hideAllModals();
    this.state = 'PLAYING';
    input.resetHeldInputs();
    projectiles.reset();
    allies.reset(false, false);
    particles.reset();
    speech.reset();
    combat.clearArena();
    this.stageManager.loadStage(stage);
    this.player.resetStageCombat?.(true);
    this.player.hp = this.player.maxHp;
    this.player.x = this.stageManager.entranceDoor.x + 30;
    this.player.y = this.groundY;
    this.player.isGrounded = true;
    this.player.weaponType = 'pencil';
    this.player.temporaryWeaponTimer = 0;
    this.camera.snapTo(this.player);
    this.camera.clearTransient?.();
    this.reportedLayerErrors.clear();
    this.prepareWeaponPickup(stage);
    this.captureStageCheckpoint();
    this.showMissionStrip(stage, 'RETRY');
    waves.startWave(stage);
  }

  captureStageCheckpoint() {
    this.stageCheckpoint = Object.freeze({
      stage: this.stageManager.currentStage,
      ink: combat.ink,
      score: combat.score,
      totalKills: combat.totalKills,
      maxCombo: combat.maxCombo,
      upgrades: Object.freeze(shop.upgrades.map((upgrade) => Object.freeze({ id: upgrade.id, level: upgrade.level }))),
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
      collected: false
    } : null;
  }

  updateWeaponPickup() {
    const pickup = this.weaponPickup;
    if (!pickup || pickup.collected || this.player.isDead) return;
    if (Math.hypot(this.player.x - pickup.x, (this.player.y - 28) - pickup.y) <= 62) {
      pickup.collected = this.player.equipTemporaryWeapon?.(pickup.type, 18) !== false;
      this.camera.focusOn?.(pickup.x, pickup.y, 0.18, 0.98);
    }
  }

  drawWeaponPickup(ctx) {
    const pickup = this.weaponPickup;
    if (!pickup || pickup.collected) return;
    const bob = Math.sin(this.stageManager.stageTime * 4.5) * 5;
    const color = pickup.type === 'staff' ? '#ffd166' : '#dff4ff';
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (pickup.type === 'staff') {
      ctx.moveTo(-25, 13);
      ctx.lineTo(25, -13);
    } else {
      if (ctx.roundRect) ctx.roundRect(-24, -14, 48, 28, 7);
      else ctx.rect(-24, -14, 48, 28);
      ctx.fill();
    }
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, 38 + Math.sin(this.stageManager.stageTime * 5) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  getStageLesson(stage) {
    return {
      1: 'MOVE · JUMP · Q COMBO · ROLL',
      2: 'CALL RED · CRAWLERS ARE QUICK',
      3: 'H HOOKS SPITTERS',
      4: 'FLANK SHIELDS · HEAVIES REVERSE H',
      6: 'F GRABS · BOOM-BUGS FLASH',
      7: 'STAFF PICKUP · E ANVIL',
      8: 'AIR CHASE · ALLIES 2–4',
      10: 'FULL METER? PRESS R',
      15: 'READ GOLD MARKERS · MOVE LATE',
      16: 'FINAL PATCH · USE R'
    }[stage] || 'CHAIN MOVES · WATCH RINGS';
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
      const previousClue = stage > 1 ? CAMPAIGN_BEATS[stage - 1]?.clue : null;
      clue.textContent = previousClue ? `TRACE // ${previousClue}` : '';
    }
    if (lesson) lesson.textContent = this.getStageLesson(stage);
    strip.classList.add('active');
    this.missionStripTimer = stage === 1 || [5, 10, 11, 15, 16].includes(stage) ? 4.0 : 3.5;
    this.missionStripGrace = 0.75;
  }

  updateMissionStrip(dt) {
    if (this.missionStripTimer <= 0) return;
    this.missionStripTimer = Math.max(0, this.missionStripTimer - dt);
    this.missionStripGrace = Math.max(0, (this.missionStripGrace ?? 0) - dt);
    // Only fresh button presses dismiss the strip (never held movement),
    // and only after a short grace so the objective is actually readable.
    const relevantInput = input.actions.jumpPressed ||
      input.actions.attackPressed || input.actions.weaponPressed || input.actions.hookPressed ||
      input.actions.rollPressed || input.actions.grabPressed || input.actions.blockPressed ||
      input.actions.superPressed || input.actions.ally1 || input.actions.ally2 || input.actions.ally3 || input.actions.ally4;
    if (relevantInput && this.missionStripGrace <= 0) this.missionStripTimer = 0;
    if (this.missionStripTimer === 0) document.getElementById('mission-strip')?.classList.remove('active');
  }

  advanceStage(nextStage) {
    this.hideAllModals();
    this.state = 'PLAYING';
    save.recordStageCleared(nextStage - 1);
    this.stageManager.loadStage(nextStage);
    projectiles.reset();
    allies.reset(false, true);
    particles.reset();
    speech.reset();
    combat.clearArena();
    this.player.x = this.stageManager.entranceDoor.x + 30;
    this.player.y = this.groundY;
    this.player.vx = 0;
    this.player.vy = 0;
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
    this.player.squashX = 1.0;
    this.player.squashY = 1.0;
    const isBossCheckpoint = [5, 10, 11, 15, 16].includes(nextStage);
    const baselineHeal = this.player.maxHp * 0.18;
    const bossSafetyHeal = Math.max(0, this.player.maxHp * 0.75 - this.player.hp);
    this.player.heal(isBossCheckpoint ? Math.max(baselineHeal, bossSafetyHeal) : baselineHeal);
    this.camera.snapTo(this.player);

    waves.startWave(nextStage);
    this.reportedLayerErrors.clear();
    this.prepareWeaponPickup(nextStage);
    this.captureStageCheckpoint();
    this.showMissionStrip(nextStage);

    particles.addTextBanner(this.player.x, this.player.y - 70, `★ STAGE ${nextStage}: ${this.stageManager.stageName} ★`, '#ffea00');
    if (isBossCheckpoint) {
      particles.addDamageText(this.player.x, this.player.y - 120, 'BOSS CHECKPOINT: HP READY', false, '#34d399');
    }
    particles.addDamageText(this.player.x, this.player.y - 100, `PRESS [B] FOR UPGRADES`, false, '#38bdf8');
  }

  completeGame() {
    this.state = 'VICTORY';
    audio.setIntensity(0);
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

  showTitleScreen() {
    this.hideAllModals();
    this.state = 'TITLE';
    input.resetHeldInputs();
    audio.setIntensity(0);
    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) titleScreen.scrollTop = 0;
    this.showModal('title-screen');
  }

  pauseGame() {
    this.state = 'PAUSED';
    this.showModal('pause-modal');
  }

  resumeGame() {
    this.hideModal('pause-modal');
    this.state = 'PLAYING';
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
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  }

  hideAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  gameLoop(timestamp) {
    try {
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1) || 0.016;
      this.lastTime = timestamp;

      input.update();

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

      if (this.state === 'PLAYING' || timestamp - this.lastStaticRender >= 120) {
        this.render();
        this.lastStaticRender = timestamp;
      }
    } catch (err) {
      const signature = err && err.message ? err.message : String(err);
      if (!this.reportedErrors.has(signature)) {
        this.reportedErrors.add(signature);
        console.error('GameLoop error caught:', err);
      }
    } finally {
      input.endFrame();
    }

    requestAnimationFrame((t) => this.gameLoop(t));
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

  update(dt) {
    this.camera.update(dt, this.player, waves.zombies.length);

    const simDt = this.camera.isHitstopped() ? dt * 0.5 : dt;
    this.hudSyncTimer += simDt;
    this.updateMissionStrip(simDt);

    const currentPlatforms = this.stageManager.getAllSolidPlatforms();
    const hostileTargets = this.collectHostileTargets();

    try {
      this.player.update(simDt, input, this.groundY, projectiles.sketchBlocks, hostileTargets, this.camera, currentPlatforms);
    } catch (e) { console.error('Player update error:', e); }

    if (this.player.isDead && this.player.deathTimer <= 0) {
      this.gameOver();
      return;
    }

    try {
      waves.update(
        simDt,
        this.player,
        this.groundY,
        projectiles.sketchBlocks,
        this.camera,
        () => {},
        currentPlatforms,
        allies.getCombatTargets?.() || []
      );
    } catch (e) { console.error('Waves update error:', e); }

    try {
      this.stageManager.update(simDt, this.player, waves, (nextStage) => {
        this.stageManager.resolveStageExit(
          nextStage,
          () => this.completeGame(),
          (stage) => this.advanceStage(stage)
        );
      }, this.camera);
    } catch (e) { console.error('Stage update error:', e); }

    try {
      projectiles.update(
        simDt,
        this.groundY,
        hostileTargets,
        this.player,
        this.camera,
        allies.getCombatTargets?.() || []
      );
    } catch (e) { console.error('Projectiles update error:', e); }

    try {
      allies.update(simDt, this.groundY, hostileTargets, this.player, this.camera);
    } catch (e) { console.error('Allies update error:', e); }

    try {
      combat.update(simDt, this.player);
    } catch (e) { console.error('Combat update error:', e); }

    try {
      particles.update(simDt);
    } catch (e) { console.error('Particles update error:', e); }

    try {
      speech.update(simDt);
    } catch (e) { console.error('Speech update error:', e); }

    this.updateWeaponPickup();

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

      if (pct >= 100 || this.player.isAwakened) {
        superFill.classList.add('super-ready');
        if (superSlot) superSlot.classList.add('ready');
      } else {
        superFill.classList.remove('super-ready');
        if (superSlot) superSlot.classList.remove('ready');
      }
    }

    const waveNum = this.getHudElement('hud-wave-number');
    const zombieCount = this.getHudElement('hud-zombies-count');
    if (waveNum) waveNum.innerText = `${this.stageManager.currentStage} - ${this.stageManager.stageName}`;
    if (zombieCount) {
      if (this.stageManager.exitDoor.isOpen) {
        zombieCount.innerHTML = `<span style="color: #34d399;">★ DOOR OPEN ➔ ENTER EXIT</span>`;
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
        const bossClasses = ['dark-lord-boss', 'king-orange-boss', 'lucky-orb-boss', 'h4c3r-boss'];
        bossBox.classList.remove(...bossClasses);
        const bossClass = {
          dark_lord: 'dark-lord-boss',
          king_orange: 'king-orange-boss',
          lucky_orb: 'lucky-orb-boss',
          h4c3r: 'h4c3r-boss'
        }[bossType];
        if (bossClass) bossBox.classList.add(bossClass);
        if (bossLabel) {
          const fallbackName = {
            dark_lord: 'DARK LORD // BACKUP',
            king_orange: 'KING ORANGE // REPLAY',
            lucky_orb: 'THE LUCKY ORB',
            h4c3r: 'H4C3R'
          }[bossType] || 'TITAN UNDEAD';
          bossLabel.innerText = this.stageManager.campaignBeat?.bossLabel || waves.bossZombie.name || fallbackName;
        }
        const bossPct = (waves.bossZombie.hp / waves.bossZombie.maxHp) * 100;
        bossFill.style.width = `${Math.max(0, bossPct)}%`;
      } else {
        bossBox.style.display = 'none';
        bossBox.classList.remove('dark-lord-boss', 'king-orange-boss', 'lucky-orb-boss', 'h4c3r-boss');
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
      if (comboTitle) comboTitle.innerText = rankInfo.title;
      if (comboBar) comboBar.style.width = `${(combat.comboTimer / combat.comboDuration) * 100}%`;
    } else if (comboContainer) {
      comboContainer.classList.remove('active');
    }

    const syncAlly = (id, type, statusId) => {
      const el = this.getHudElement(id);
      if (!el) return;
      const cd = allies.cooldowns[type] || 0;
      const recovering = allies.recoveryStates?.[type] === true;
      if (cd > 0) {
        el.style.opacity = '0.5';
        el.style.filter = 'grayscale(0.6)';
      } else {
        el.style.opacity = '1.0';
        el.style.filter = 'none';
      }
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
  }

  renderLayer(name, draw) {
    const ctx = this.ctx;
    if (!this.layerContextGuard || this.layerContextGuard.source !== ctx) {
      const nativeSave = ctx.save.bind(ctx);
      const nativeRestore = ctx.restore.bind(ctx);
      const boundMethods = new Map();
      const state = { depth: 0 };
      const guardedSave = () => { state.depth += 1; nativeSave(); };
      const guardedRestore = () => {
        if (state.depth > 0) {
          state.depth -= 1;
          nativeRestore();
        }
      };
      const proxy = new Proxy(ctx, {
        get(target, property) {
          if (property === 'save') return guardedSave;
          if (property === 'restore') return guardedRestore;
          const value = target[property];
          if (typeof value !== 'function') return value;
          const cached = boundMethods.get(property);
          if (cached?.source === value) return cached.bound;
          const bound = value.bind(target);
          boundMethods.set(property, { source: value, bound });
          return bound;
        },
        set(target, property, value) {
          target[property] = value;
          return true;
        }
      });
      this.layerContextGuard = { source: ctx, proxy, state, nativeSave, nativeRestore };
    }
    const guard = this.layerContextGuard;
    guard.state.depth = 0;
    guard.nativeSave();
    try {
      draw(guard.proxy);
      return true;
    } catch (error) {
      const signature = `${this.stageManager.currentStage}:${name}:${error?.message || String(error)}`;
      if (!this.reportedLayerErrors.has(signature)) {
        this.reportedLayerErrors.add(signature);
        console.error(`Render layer "${name}" recovered:`, error);
      }
      return false;
    } finally {
      while (guard.state.depth > 0) {
        guard.state.depth -= 1;
        guard.nativeRestore();
      }
      guard.nativeRestore();
    }
  }

  drawFallbackPlayer(ctx) {
    const x = Number.isFinite(this.player?.x) ? this.player.x : 0;
    const y = Number.isFinite(this.player?.y) ? this.player.y : this.groundY;
    ctx.save();
    ctx.strokeStyle = '#ff7700';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y - 54, 10, 0, Math.PI * 2);
    ctx.moveTo(x, y - 44);
    ctx.lineTo(x, y - 20);
    ctx.moveTo(x, y - 36);
    ctx.lineTo(x - 15, y - 26);
    ctx.moveTo(x, y - 36);
    ctx.lineTo(x + 15, y - 26);
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x - 12, y);
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x + 12, y);
    ctx.stroke();
    ctx.restore();
  }

  render() {
    try {
      if (this.hudSyncTimer >= 0.05 || this.lastStaticRender === 0 || this.state !== 'PLAYING') {
        this.syncHUD();
        this.hudSyncTimer %= 0.05;
      }
    } catch (error) {
      const message = error?.message || String(error);
      const signature = `HUD sync:${message}`;
      if (!this.reportedErrors.has(signature)) {
        this.reportedErrors.add(signature);
        console.error('HUD sync error:', error);
      }
    }
    const ctx = this.ctx;
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    ctx.fillStyle = '#1e212d';
    ctx.fillRect(0, 0, width, height);

    this.camera.apply(ctx);
    try {
      const crowded = waves.zombies.length >= 8;
      this.renderLayer('background', (layerCtx) => this.stageManager.draw(layerCtx, this.groundY, crowded));
      this.renderLayer('projectiles', (layerCtx) => projectiles.draw(layerCtx, crowded));
      this.renderLayer('ink', (layerCtx) => combat.draw(layerCtx));
      this.renderLayer('enemies', (layerCtx) => waves.draw(layerCtx));
      this.renderLayer('weapon-pickup', (layerCtx) => this.drawWeaponPickup(layerCtx));
      this.renderLayer('allies', (layerCtx) => allies.draw(layerCtx, crowded));
      const playerDrawn = this.renderLayer('player', (layerCtx) => this.player.draw(layerCtx));
      if (!playerDrawn) this.renderLayer('player-fallback', (layerCtx) => this.drawFallbackPlayer(layerCtx));
      this.renderLayer('effects', (layerCtx) => particles.draw(layerCtx));
    } finally {
      this.camera.restore(ctx);
    }

    this.renderLayer('enemy-guides', (layerCtx) => waves.drawScreenIndicators?.(layerCtx, this.camera, width, height));
    this.renderLayer('stage-guide', (layerCtx) => this.stageManager.drawScreenGuide?.(layerCtx, this.camera, width, height));

    this.renderLayer('speech', (layerCtx) => speech.draw(layerCtx, this.camera, width, height));
  }
}

if (typeof document !== 'undefined' && document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    window.__stickGame = game;
    game.init();
  });
} else if (typeof document !== 'undefined') {
  const game = new Game();
  window.__stickGame = game;
  game.init();
}
