import { audio } from '../engine/audio.js?v=8.7';
import { particles } from '../engine/particles.js?v=8.7';
export class CombatSystem {
  constructor() {
    this.score = 0;
    this.ink = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.stageMaxCombo = 0;
    this.comboTimer = 0;
    this.comboDuration = 3.2; // seconds before combo resets
    this.totalKills = 0;
    this.inkDrops = [];
    this.simTime = 0;
  }
  resetRun(startingInk = 0) {
    this.score = 0;
    this.ink = startingInk;
    this.combo = 0;
    this.maxCombo = 0;
    this.stageMaxCombo = 0;
    this.comboTimer = 0;
    this.totalKills = 0;
    this.inkDrops.length = 0;
    this.simTime = 0;
  }
  clearArena() {
    this.resetCombo();
    this.stageMaxCombo = 0;
    this.inkDrops.length = 0;
  }
  update(dt, player) {
    this.simTime += Math.max(0, Math.min(Number(dt) || 0, 0.1));
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.resetCombo();
      }
    }
    for (let i = this.inkDrops.length - 1; i >= 0; i--) {
      const drop = this.inkDrops[i];
      drop.life -= dt;
      if (player && !player.isDead) {
        const dx = player.x - drop.x;
        const dy = (player.y - 30) - drop.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 180) {
          const pullSpeed = 450;
          drop.vx += (dx / dist) * pullSpeed * dt;
          drop.vy += (dy / dist) * pullSpeed * dt;
        }
        if (dist < 28) {
          this.addInk(drop.value);
          this.addScore(drop.value * 10);
          audio.playInkPickup();
          particles.createHitSparks(drop.x, drop.y, 4, '#44ddff');
          this.inkDrops.splice(i, 1);
          continue;
        }
      }
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.vy += 250 * dt; // gravity
      if (drop.y > 0) {
        drop.y = 0;
        drop.vy = 0;
        drop.vx *= 0.9;
      }
      if (drop.life <= 0) {
        this.inkDrops.splice(i, 1);
      }
    }
  }
  registerHit(amount, isCrit = false) {
    this.registerStrike(amount, 1, isCrit);
  }
  registerStrike(totalApplied, hitCount = 1, isCrit = false) {
    this.combo++;
    this.comboTimer = this.comboDuration;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }
    if (this.combo > this.stageMaxCombo) {
      this.stageMaxCombo = this.combo;
    }
    const multiplier = 1 + Math.floor(this.combo / 10) * 0.25;
    const crowdBonus = 1 + 0.08 * Math.max(0, hitCount - 1);
    this.addScore(Math.round(totalApplied * multiplier * crowdBonus));
    if (this.combo % 10 === 0) {
      audio.playComboMilestone(this.combo);
    }
  }
  registerKill(zombie) {
    this.totalKills++;
    const multiplier = 1 + Math.floor(this.combo / 10) * 0.25;
    this.addScore(Math.round(zombie.scoreReward * multiplier));
    this.spawnInkDrop(zombie.x, zombie.y - 30, zombie.inkReward);
  }
  spawnInkDrop(x, y, value) {
    if (this.inkDrops.length >= 32) this.inkDrops.shift();
    this.inkDrops.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 120,
      vy: -150 - Math.random() * 100,
      value,
      life: 15.0
    });
  }
  addScore(pts) {
    this.score += pts;
  }
  addInk(amount) {
    this.ink += amount;
  }
  spendInk(amount) {
    if (this.ink >= amount) {
      this.ink -= amount;
      return true;
    }
    return false;
  }
  resetCombo() {
    this.combo = 0;
    this.comboTimer = 0;
  }
  getRankTitle() {
    // Thresholds tuned for strike-count combos (one swing = one strike).
    if (this.combo >= 30) return { rank: 'SSS', title: 'GODLIKE STICKMAN!' };
    if (this.combo >= 22) return { rank: 'S', title: 'STICK-TACULAR!' };
    if (this.combo >= 15) return { rank: 'A', title: 'ANIMATOR POWER!' };
    if (this.combo >= 8) return { rank: 'B', title: 'BRUTAL CHAIN!' };
    if (this.combo >= 4) return { rank: 'C', title: 'COMBO RUNNER!' };
    return { rank: 'D', title: 'NICE HIT' };
  }
  draw(ctx) {
    for (const drop of this.inkDrops) {
      ctx.save();
      ctx.translate(drop.x, drop.y);
      const bob = Math.sin(this.simTime * 8 + drop.x) * 3;
      ctx.fillStyle = '#44ddff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -8 + bob);
      ctx.quadraticCurveTo(6, 0 + bob, 6, 4 + bob);
      ctx.arc(0, 4 + bob, 6, 0, Math.PI);
      ctx.quadraticCurveTo(-6, 0 + bob, 0, -8 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
export const combat = new CombatSystem();
