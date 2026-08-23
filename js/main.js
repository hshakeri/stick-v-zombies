// Main Game Coordinator and Canvas Loop

import { audio } from './engine/audio.js';
import { input } from './engine/input.js';
import { Camera } from './engine/camera.js';
import { particles } from './engine/particles.js';
import { Player } from './entities/player.js';
import { waves } from './systems/waves.js';
import { combat } from './systems/combat.js';
import { shop } from './systems/shop.js';
import { stages } from './systems/stages.js';
import { projectiles } from './entities/projectiles.js';
import { allies } from './entities/allies.js';
import { speech } from './engine/speech.js';

class Game {
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
    this.reportedErrors = new Set();
  }

  init() {
    this.setupResize();
    input.init(this.canvas, this.camera);
    this.bindUIEvents();

    // Start Animation Loop
    requestAnimationFrame((timestamp) => {
      this.lastTime = timestamp;
      this.gameLoop(timestamp);
    });
  }

  setupResize() {
    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // Cap both pixel density and total backing pixels. This keeps 4K/5K
      // displays from allocating a 30M+ pixel canvas while retaining crisp
      // rendering on phones and ordinary desktop screens.
      const dpr = this.camera.getRenderPixelRatio(window.devicePixelRatio || 1);
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
      this.camera.clampToArena();
    };
    window.addEventListener('resize', resize);
    resize();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') this.pauseGame();
      this.lastTime = performance.now();
    });
  }

  bindUIEvents() {
    // Start Game & Controls
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        audio.init();
        this.startGame();
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

    // Try Again on Game Over
    const btnTryAgain = document.getElementById('btn-try-again');
    if (btnTryAgain) {
      btnTryAgain.addEventListener('click', () => {
        this.restartGame();
      });
    }

    const btnMenuFromGameOver = document.getElementById('btn-menu-from-gameover');
    if (btnMenuFromGameOver) btnMenuFromGameOver.addEventListener('click', () => this.showTitleScreen());

    const btnVictoryReplay = document.getElementById('btn-victory-replay');
    if (btnVictoryReplay) btnVictoryReplay.addEventListener('click', () => this.startGame());

    const btnVictoryMenu = document.getElementById('btn-victory-menu');
    if (btnVictoryMenu) btnVictoryMenu.addEventListener('click', () => this.showTitleScreen());

    // Shop Buttons
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

    // Pause Buttons
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

    // Audio Toggle
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        audio.init();
        const enabled = audio.toggleAudio();
        btnAudio.innerText = enabled ? '🔊 Audio: ON' : '🔇 Audio: OFF';
      });
    }

    // Ally summon slot clicks (1 - 5)
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

  startGame() {
    this.hideAllModals();
    this.state = 'PLAYING';
    input.resetHeldInputs();
    projectiles.reset();
    allies.reset(true);
    particles.reset();
    speech.reset();
    shop.reset();
    combat.resetRun(50);
    this.stageManager.loadStage(1);
    this.player = new Player(this.stageManager.entranceDoor.x + 30, this.groundY);
    this.player.isGrounded = true;
    this.camera.snapTo(this.player);
    waves.startWave(1);
  }

  restartGame() {
    this.hideAllModals();
    this.startGame();
  }

  advanceStage(nextStage) {
    this.hideAllModals();
    this.state = 'PLAYING';
    this.stageManager.loadStage(nextStage);
    projectiles.reset();
    allies.reset(false);
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
    this.player.isRolling = false;
    this.player.rollTimer = 0;
    this.player.diveKick = false;
    this.player.isGrounded = true;
    this.player.airJuggleTarget = null;
    this.player.squashX = 1.0;
    this.player.squashY = 1.0;
    const isBossCheckpoint = [5, 10, 11, 15].includes(nextStage);
    const baselineHeal = this.player.maxHp * 0.18;
    const bossSafetyHeal = Math.max(0, this.player.maxHp * 0.75 - this.player.hp);
    this.player.heal(isBossCheckpoint ? Math.max(baselineHeal, bossSafetyHeal) : baselineHeal);
    this.camera.snapTo(this.player);

    waves.startWave(nextStage);

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

    const elWave = document.getElementById('gameover-wave');
    const elScore = document.getElementById('gameover-score');
    const elKills = document.getElementById('gameover-kills');
    const elCombo = document.getElementById('gameover-combo');

    if (elWave) elWave.innerText = `STAGE ${this.stageManager.currentStage}`;
    if (elScore) elScore.innerText = combat.score;
    if (elKills) elKills.innerText = combat.totalKills;
    if (elCombo) elCombo.innerText = `${combat.maxCombo} HITS`;

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

      // Hotkey UI toggles
      if (input.actions.shop) {
        if (this.state === 'PLAYING') this.openShop();
        else if (this.state === 'SHOP') this.closeShop();
      }
      if (input.actions.pause) {
        if (this.state === 'PLAYING') this.pauseGame();
        else if (this.state === 'PAUSED') this.resumeGame();
      }

      // Update Game Logic
      if (this.state === 'PLAYING') {
        this.update(dt);
      }

      // Modal states do not need a full 60 FPS canvas redraw.
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
      // One-frame actions must be released even if a future update or draw
      // throws, otherwise the same attack can remain armed indefinitely.
      input.endFrame();
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(dt) {
    // Camera Shake and Hitstop
    this.camera.update(dt, this.player, waves.zombies.length);

    // Apply fluid slow-mo on hitstop rather than returning early or freezing
    const simDt = this.camera.isHitstopped() ? dt * 0.5 : dt;

    const currentPlatforms = this.stageManager.getAllSolidPlatforms();

    // 1. Update Player
    try {
      this.player.update(simDt, input, this.groundY, projectiles.sketchBlocks, waves.zombies, this.camera, currentPlatforms);
    } catch (e) { console.error('Player update error:', e); }

    if (this.player.isDead && this.player.deathTimer <= 0) {
      this.gameOver();
      return;
    }

    // 2. Update Wave Director
    try {
      waves.update(simDt, this.player, this.groundY, projectiles.sketchBlocks, this.camera, () => {}, currentPlatforms);
    } catch (e) { console.error('Waves update error:', e); }

    // 3. Update Stage Progression, Obstacles, and Doors
    try {
      this.stageManager.update(simDt, this.player, waves, (nextStage) => {
        this.stageManager.resolveStageExit(
          nextStage,
          () => this.completeGame(),
          (stage) => this.advanceStage(stage)
        );
      }, this.camera);
    } catch (e) { console.error('Stage update error:', e); }

    // 4. Update Projectiles & Hazards
    try {
      projectiles.update(simDt, this.groundY, waves.zombies, this.player, this.camera);
    } catch (e) { console.error('Projectiles update error:', e); }

    // 5. Update Allies (including Cursor Pointer)
    try {
      allies.update(simDt, this.groundY, waves.zombies, this.player, this.camera);
    } catch (e) { console.error('Allies update error:', e); }

    // 6. Update Combat Scores & Ink Drops
    try {
      combat.update(simDt, this.player);
    } catch (e) { console.error('Combat update error:', e); }

    // 7. Update Particles
    try {
      particles.update(simDt);
    } catch (e) { console.error('Particles update error:', e); }

    // 8. Update 80s Retro Speech Bubbles
    try {
      speech.update(simDt);
    } catch (e) { console.error('Speech update error:', e); }

  }

  syncHUD() {
    // Player HP
    const hpFill = document.getElementById('hud-hp-fill');
    const hpText = document.getElementById('hud-hp-text');
    if (hpFill && hpText) {
      const pct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
      hpFill.style.width = `${pct}%`;
      hpText.innerText = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
    }

    // Awakening Super Bar
    const superFill = document.getElementById('hud-super-fill');
    const superText = document.getElementById('hud-super-text');
    const superSlot = document.getElementById('skill-super');
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

    // Stage Name & Objective Status
    const waveNum = document.getElementById('hud-wave-number');
    const zombieCount = document.getElementById('hud-zombies-count');
    if (waveNum) waveNum.innerText = `${this.stageManager.currentStage} - ${this.stageManager.stageName}`;
    if (zombieCount) {
      if (this.stageManager.exitDoor.isOpen) {
        zombieCount.innerHTML = `<span style="color: #34d399;">★ DOOR OPEN ➔ ENTER EXIT</span>`;
      } else {
        zombieCount.innerText = `Zombies: ${waves.getAliveCount()}`;
      }
    }

    // Boss Health Bar
    const bossBox = document.getElementById('boss-health-box');
    const bossFill = document.getElementById('boss-hp-fill');
    const bossLabel = document.getElementById('boss-name-label');
    if (bossBox && bossFill) {
      if (waves.bossZombie && !waves.bossZombie.isDead) {
        bossBox.style.display = 'flex';
        const bossType = waves.bossZombie.type;
        const bossClasses = ['dark-lord-boss', 'king-orange-boss', 'h4c3r-boss'];
        bossBox.classList.remove(...bossClasses);
        const bossClass = {
          dark_lord: 'dark-lord-boss',
          king_orange: 'king-orange-boss',
          h4c3r: 'h4c3r-boss'
        }[bossType];
        if (bossClass) bossBox.classList.add(bossClass);
        if (bossLabel) {
          const fallbackName = {
            dark_lord: 'THE DARK LORD (TDL)',
            king_orange: 'KING ORANGE',
            h4c3r: 'H4C3R'
          }[bossType] || 'TITAN UNDEAD';
          bossLabel.innerText = waves.bossZombie.name || fallbackName;
        }
        const bossPct = (waves.bossZombie.hp / waves.bossZombie.maxHp) * 100;
        bossFill.style.width = `${Math.max(0, bossPct)}%`;
      } else {
        bossBox.style.display = 'none';
        bossBox.classList.remove('dark-lord-boss', 'king-orange-boss', 'h4c3r-boss');
      }
    }

    // Score & Ink
    const hudScore = document.getElementById('hud-score');
    const hudInk = document.getElementById('hud-ink');
    if (hudScore) hudScore.innerText = combat.score;
    if (hudInk) hudInk.innerText = combat.ink;

    // Combo Counter
    const comboContainer = document.getElementById('hud-combo');
    const comboHits = document.getElementById('combo-hit-count');
    const comboTitle = document.getElementById('combo-rank-title');
    const comboBar = document.getElementById('combo-timer-fill');

    if (comboContainer && combat.combo >= 2) {
      comboContainer.classList.add('active');
      const rankInfo = combat.getRankTitle();
      if (comboHits) comboHits.innerText = `${combat.combo} HITS`;
      if (comboTitle) comboTitle.innerText = rankInfo.title;
      if (comboBar) comboBar.style.width = `${(combat.comboTimer / combat.comboDuration) * 100}%`;
    } else if (comboContainer) {
      comboContainer.classList.remove('active');
    }

    // Ally Cooldown Displays (Red, Blue, Yellow, Green, Cursor)
    const syncAlly = (id, type) => {
      const el = document.getElementById(id);
      if (!el) return;
      const cd = allies.cooldowns[type] || 0;
      if (cd > 0) {
        el.style.opacity = '0.5';
        el.style.filter = 'grayscale(0.6)';
      } else {
        el.style.opacity = '1.0';
        el.style.filter = 'none';
      }
    };
    syncAlly('ally-red-slot', 'red');
    syncAlly('ally-blue-slot', 'blue');
    syncAlly('ally-yellow-slot', 'yellow');
    syncAlly('ally-green-slot', 'green');
    syncAlly('ally-cursor-slot', 'cursor');

    const syncSkillCooldown = (slotId, overlayId, remaining) => {
      const slot = document.getElementById(slotId);
      const overlay = document.getElementById(overlayId);
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
  }

  render() {
    this.syncHUD();
    const ctx = this.ctx;
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    // Clear Screen
    ctx.fillStyle = '#1e212d';
    ctx.fillRect(0, 0, width, height);

    // Keep the canvas transform balanced even if a future entity renderer
    // throws midway through the world pass.
    this.camera.apply(ctx);
    try {
      // 1. Draw Desktop GUI Environment, Doors, App Platforms, Obstacles, and Taskbar
      this.stageManager.draw(ctx, this.groundY);

      // 2. Draw Projectiles & Hazards
      projectiles.draw(ctx);

      // 3. Draw Ink Drops
      combat.draw(ctx);

      // 4. Draw Zombies
      waves.draw(ctx);

      // 5. Draw Allies & Mouse Cursor
      allies.draw(ctx);

      // 6. Draw Player
      this.player.draw(ctx);

      // 7. Draw Visual FX & Particles
      particles.draw(ctx);
    } finally {
      this.camera.restore(ctx);
    }

    // Screen-space guides stay anchored even while the camera shakes or zooms.
    waves.drawScreenIndicators?.(ctx, this.camera, width, height);
    this.stageManager.drawScreenGuide?.(ctx, this.camera, width, height);

    // Dialogue is screen-space and drawn last so camera motion, enemy markers,
    // and the exit guide never make a punchline tiny, jittery, or obscured.
    speech.draw(ctx, this.camera, width, height);
  }
}

// Instantiate and Run Game on Page Load
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
  });
} else {
  const game = new Game();
  game.init();
}
