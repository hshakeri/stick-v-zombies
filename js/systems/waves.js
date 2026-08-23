// Wave Director and Enemy Spawning Manager

import { Zombie } from '../entities/zombies.js';
import { DarkLord } from '../entities/dark_lord.js';
import { KingOrange } from '../entities/king_orange.js';
import { H4C3R } from '../entities/h4c3r.js';
import { audio } from '../engine/audio.js';
import { particles } from '../engine/particles.js';

const BOSS_WAVES = new Set([5, 10, 11, 15]);

// The post-Dark-Lord campaign uses deliberately short, authored encounters.
// This avoids the old linear formula growing into 50-60 enemy queues and keeps
// both update cost and the battlefield readable on phones.
const LATE_WAVE_RECIPES = Object.freeze({
  12: Object.freeze([
    'runner', 'walker', 'spitter', 'runner', 'walker', 'brute', 'spitter',
    'runner', 'walker', 'spitter', 'runner', 'walker', 'brute', 'spitter'
  ]),
  13: Object.freeze([
    'spitter', 'runner', 'walker', 'runner', 'brute', 'spitter', 'runner',
    'walker', 'spitter', 'runner', 'brute', 'spitter', 'runner', 'walker'
  ]),
  14: Object.freeze([
    'runner', 'spitter', 'runner', 'brute', 'walker', 'spitter', 'runner',
    'brute', 'walker', 'spitter', 'runner', 'brute', 'spitter', 'runner',
    'walker', 'spitter'
  ])
});

export class WaveDirector {
  constructor() {
    this.currentWave = 1;
    this.zombies = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1.2;

    this.isWaveActive = false;
    this.isWaveClearing = false;
    this.clearTimer = 0;

    this.bossZombie = null;
    this.spawnSerial = 0;
    this.maxActiveEnemies = 12;
  }

  startWave(waveNumber = 1) {
    this.currentWave = waveNumber;
    this.zombies = [];
    this.spawnQueue = [];
    this.isWaveActive = true;
    this.isWaveClearing = false;
    this.bossZombie = null;
    this.spawnTimer = 1.15; // Brief, readable setup window at every entrance.
    this.spawnSerial = 0;

    audio.playWaveStart();
    audio.setIntensity(BOSS_WAVES.has(this.currentWave) ? 0.95 : (this.currentWave >= 12 ? 0.55 : 0.2));

    // Build spawn queue for this wave
    this.generateWaveQueue(this.currentWave);
  }

  generateWaveQueue(wave) {
    if (wave === 10) {
      // Dark Core boss: The Dark Lord (TDL)
      this.spawnQueue.push({ type: 'dark_lord', delay: 1.2 });
      for (let i = 0; i < 8; i++) {
        this.spawnQueue.push({ type: i % 2 === 0 ? 'runner' : 'spitter', delay: 1.8 + Math.random() * 0.8 });
      }
      this.spawnQueue.push({ type: 'brute', delay: 2.8 });
      return;
    }

    if (wave === 11) {
      // King Orange follows the Dark Lord immediately as a focused duel.
      this.spawnQueue.push({ type: 'king_orange', delay: 1.4 });
      return;
    }

    if (LATE_WAVE_RECIPES[wave]) {
      this.queueHandcraftedWave(LATE_WAVE_RECIPES[wave]);
      return;
    }

    if (wave === 15) {
      // H4C3R is the true finale; the boss owns its phase hazards so the wave
      // director does not pile an additional horde onto the player.
      this.spawnQueue.push({ type: 'h4c3r', delay: 1.4 });
      return;
    }

    const isBossWave = (wave % 5 === 0);

    if (isBossWave) {
      // Stage 5 Titan Undead Boss Wave
      this.spawnQueue.push({ type: 'titan_boss', delay: 1.0 });
      for (let i = 0; i < 4 + wave; i++) {
        this.spawnQueue.push({ type: i % 2 === 0 ? 'runner' : 'spitter', delay: 1.6 + Math.random() * 0.9 });
      }
      return;
    }

    // Standard Scaling Wave
    const totalZombies = 8 + wave * 4;
    const walkerCount = Math.floor(totalZombies * 0.5);
    const runnerCount = wave >= 2 ? Math.floor(totalZombies * 0.25) : 0;
    const spitterCount = wave >= 3 ? Math.floor(totalZombies * 0.15) : 0;
    const bruteCount = wave >= 4 ? Math.max(1, Math.floor(wave / 3)) : 0;

    for (let i = 0; i < walkerCount; i++) this.spawnQueue.push({ type: 'walker', delay: 0.8 + Math.random() * 1.5 });
    for (let i = 0; i < runnerCount; i++) this.spawnQueue.push({ type: 'runner', delay: 1.0 + Math.random() * 2.0 });
    for (let i = 0; i < spitterCount; i++) this.spawnQueue.push({ type: 'spitter', delay: 1.2 + Math.random() * 2.5 });
    for (let i = 0; i < bruteCount; i++) this.spawnQueue.push({ type: 'brute', delay: 3.0 + Math.random() * 3.0 });

    // Shuffle spawn queue
    this.spawnQueue.sort(() => Math.random() - 0.5);
  }

  queueHandcraftedWave(types) {
    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const baseDelay = type === 'brute' ? 1.65 : (type === 'spitter' ? 1.05 : 0.8);
      this.spawnQueue.push({
        type,
        delay: baseDelay + (i % 3) * 0.12
      });
    }
  }

  update(dt, player, groundY, sketchBlocks, camera, onWaveComplete, platforms = []) {
    if (!this.isWaveActive) return;

    // Handle Spawning
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
      if (this.zombies.length >= this.maxActiveEnemies) {
        // Poll at a low rate while capped rather than immediately replacing an
        // enemy in the same frame it is removed.
        this.spawnTimer = 0.2;
      } else {
        const nextEnemy = this.spawnQueue.shift();
        this.spawnZombie(nextEnemy.type, player, groundY, camera);
        this.spawnTimer = nextEnemy.delay || this.spawnInterval;
      }
    }

    // Update active zombies / bosses
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      z.update(dt, groundY, player, sketchBlocks, camera, platforms, this.zombies);

      if (z.isDead) {
        this.zombies.splice(i, 1);
      }
    }

    // Check if Wave is Cleared
    if (this.isWaveActive && this.spawnQueue.length === 0 && this.zombies.length === 0 && !this.isWaveClearing) {
      this.isWaveClearing = true;
      this.clearTimer = 1.0;
      particles.addTextBanner(player.x, player.y - 70, `★ ALL ENEMIES CLEARED! ★`, '#ffee00');
    }
  }

  spawnZombie(type, player, groundY, camera = null) {
    const spawnX = this.getSafeSpawnX(player);

    const bossConfig = {
      dark_lord: {
        BossClass: DarkLord,
        color: '#ff0033',
        banner: '⚔️ THE DARK LORD HAS ARRIVED! ⚔️'
      },
      king_orange: {
        BossClass: KingOrange,
        color: '#ff8a00',
        banner: '♛ CORRUPTED KING ORANGE REPLAY ♛'
      },
      h4c3r: {
        BossClass: H4C3R,
        color: '#67e8f9',
        banner: '⌁ H4C3R HAS ROOT ACCESS ⌁'
      }
    }[type];

    if (bossConfig) {
      const boss = new bossConfig.BossClass(spawnX, groundY);
      this.zombies.push(boss);
      this.bossZombie = boss;
      audio.playBossRoar();
      camera?.addShake?.(0.8);
      camera?.focusOn?.(spawnX, groundY - 90, 0.7, 0.9);
      camera?.addZoomPunch?.(-0.035);
      particles.addShockwave(spawnX, groundY - 30, 240, bossConfig.color, 12);
      particles.addTextBanner(spawnX, groundY - 100, bossConfig.banner, bossConfig.color);
      return;
    }

    const zombie = new Zombie(spawnX, groundY, type, this.currentWave);
    this.zombies.push(zombie);

    if (type === 'titan_boss') {
      this.bossZombie = zombie;
      audio.playBossRoar();
      camera?.addShake?.(0.6);
      camera?.focusOn?.(spawnX, groundY - 105, 0.65, 0.92);
      camera?.addZoomPunch?.(-0.025);
      particles.addTextBanner(spawnX, groundY - 80, '💀 TITAN UNDEAD SPAWNED! 💀', '#ff2244');
    }

    // Spawn dust puff
    particles.createDust(spawnX, groundY, 8);
    particles.addShockwave(spawnX, groundY - 30, 54, '#64ff7b', 4);
  }

  getSafeSpawnX(player) {
    const leftEdge = -920;
    const rightEdge = 920;
    const playerX = player && Number.isFinite(player.x) ? player.x : 0;
    const leftDistance = Math.abs(playerX - leftEdge);
    const rightDistance = Math.abs(rightEdge - playerX);
    let side = leftDistance === rightDistance
      ? (Math.random() > 0.5 ? 1 : -1)
      : (rightDistance > leftDistance ? 1 : -1);

    const inset = 20 + (this.spawnSerial % 4) * 48 + Math.random() * 22;
    this.spawnSerial++;
    let spawnX = side > 0 ? rightEdge - inset : leftEdge + inset;

    // Fallback for unusual positions: always choose the opposite edge if the
    // first candidate would appear inside immediate melee range.
    if (Math.abs(spawnX - playerX) < 380) {
      side *= -1;
      spawnX = side > 0 ? rightEdge - inset : leftEdge + inset;
    }
    return spawnX;
  }

  getAliveCount() {
    return this.zombies.length + this.spawnQueue.length;
  }

  draw(ctx) {
    for (const z of this.zombies) {
      z.draw(ctx);
    }
  }

  drawScreenIndicators(ctx, camera, viewportWidth, viewportHeight) {
    if (!camera || this.zombies.length === 0) return;
    const groups = { left: { count: 0, y: 0 }, right: { count: 0, y: 0 } };

    for (const zombie of this.zombies) {
      if (zombie.isDead) continue;
      const screen = camera.worldToScreen(zombie.x, zombie.y - 35);
      const group = screen.x < -16 ? groups.left : (screen.x > viewportWidth + 16 ? groups.right : null);
      if (!group) continue;
      group.count++;
      group.y += screen.y;
    }

    ctx.save();
    ctx.font = "900 12px 'Nunito', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [side, group] of Object.entries(groups)) {
      if (!group.count) continue;
      const x = side === 'left' ? 30 : viewportWidth - 30;
      const averageY = group.y / group.count;
      const y = Math.max(145, Math.min(viewportHeight - 125, averageY));
      ctx.fillStyle = 'rgba(13, 18, 27, 0.9)';
      ctx.strokeStyle = '#75ff7b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#75ff7b';
      ctx.beginPath();
      if (side === 'left') {
        ctx.moveTo(x - 10, y); ctx.lineTo(x - 2, y - 7); ctx.lineTo(x - 2, y + 7);
      } else {
        ctx.moveTo(x + 10, y); ctx.lineTo(x + 2, y - 7); ctx.lineTo(x + 2, y + 7);
      }
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(group.count, x, y);
    }
    ctx.restore();
  }
}

export const waves = new WaveDirector();
