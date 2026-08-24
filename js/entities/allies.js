import { StickFigureRenderer } from './stickman.js?v=8.5';
import { particles } from '../engine/particles.js?v=8.5';
import { audio } from '../engine/audio.js?v=8.5';
import { projectiles } from './projectiles.js?v=8.5';
import { speech } from '../engine/speech.js?v=8.5';
const ALLY_ARENA_BOUND = 1030;
const ALLY_READY_TIME = 0.55;
const ALLY_EFFECT_RADIUS = Object.freeze({
  red: 220,
  blue: 520,
  yellow: 600,
  green: 480
});
const ALLY_COLORS = Object.freeze({
  red: '#ff3344',
  blue: '#2299ff',
  yellow: '#ffcc00',
  green: '#33dd66'
});
export class AllyManager {
  constructor() {
    this.unlocked = {
      red: true,
      blue: true,
      yellow: true,
      green: true,
      cursor: true
    };
    this.cooldowns = {
      red: 0,
      blue: 0,
      yellow: 0,
      green: 0,
      cursor: 0
    };
    this.maxCooldowns = {
      red: 10,
      blue: 12,
      yellow: 14,
      green: 12,
      cursor: 8
    };
    this.recoveryStates = {
      red: false,
      blue: false,
      yellow: false,
      green: false,
      cursor: false
    };
    this.activeAllies = [];
    this.turrets = [];
    this.activeCursors = [];
    this.combatTargets = [];
    this.summonTargets = [];
    this.renderers = {
      red: new StickFigureRenderer('#ff3344', 5, 1.0, false),
      blue: new StickFigureRenderer('#2299ff', 5, 1.0, false),
      yellow: new StickFigureRenderer('#ffcc00', 5, 1.0, false),
      green: new StickFigureRenderer('#33dd66', 5, 1.0, false)
    };
  }
  reset(resetUpgrades = false, preserveRecovery = false) {
    const savedRecovery = {};
    if (preserveRecovery) {
      for (const key of Object.keys(this.cooldowns)) {
        savedRecovery[key] = this.recoveryStates[key] ? this.cooldowns[key] : 0;
      }
    }
    this.activeAllies.length = 0;
    this.turrets.length = 0;
    this.activeCursors.length = 0;
    this.combatTargets.length = 0;
    this.summonTargets.length = 0;
    for (const key of Object.keys(this.cooldowns)) {
      this.cooldowns[key] = savedRecovery[key] || 0;
      this.recoveryStates[key] = this.cooldowns[key] > 0;
    }
    if (resetUpgrades) {
      Object.assign(this.maxCooldowns, {
        red: 10,
        blue: 12,
        yellow: 14,
        green: 12,
        cursor: 8
      });
    }
  }
  update(dt, groundY, zombies, player, camera) {
    for (const key of Object.keys(this.cooldowns)) {
      if (this.cooldowns[key] > 0) {
        this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
        if (this.cooldowns[key] === 0) this.recoveryStates[key] = false;
      }
    }
    for (let i = this.activeAllies.length - 1; i >= 0; i--) {
      const ally = this.activeAllies[i];
      ally.timer += dt;
      ally.life -= dt;
      if (ally.hurtTimer > 0) {
        ally.hurtTimer -= dt;
        if (ally.hurtTimer <= 0) ally.isHurt = false;
      }
      if (!ally.retreating && ally.y >= groundY - 120) ally.isTargetable = true;
      if (ally.retreating) {
        ally.isTargetable = false;
        ally.y -= 1050 * dt;
        ally.pose = ally.isHurt ? 'hurt' : 'jump_rise';
        if (ally.life <= 0) this.activeAllies.splice(i, 1);
        continue;
      }
      if (ally.type === 'red') {
        if (!ally.hasActed && ally.y < groundY) {
          ally.y = Math.min(groundY, ally.y + 1400 * dt);
        }
        if (!ally.hasActed && ally.y >= groundY) {
          ally.y = groundY;
          ally.readyTimer += dt;
          ally.pose = 'idle';
          if (ally.readyTimer >= ALLY_READY_TIME) {
            ally.pose = 'attack_cross';
            ally.hasActed = true;
            camera.addShake(0.7);
            camera.addZoomPunch?.(0.055);
            audio.playPunch('heavy');
            particles.addShockwave(ally.x, groundY, 240, '#ff3344', 14);
            particles.createHitSparks(ally.x, groundY, 24, '#ff5533');
            for (const z of zombies) {
              if (!z.isDead && Math.abs(z.x - ally.x) < ALLY_EFFECT_RADIUS.red) {
                z.takeDamage(140, ally.x < z.x ? 1 : -1, 800, true);
              }
            }
            speech.shout(ally.x, ally.y, 'allies', 'red', 1.35, {
              anchor: ally,
              priority: 2
            });
            this.beginReturn(ally);
          }
        } else if (ally.hasActed && ally.timer > 1.2) {
          this.beginReturn(ally);
          ally.y -= 1000 * dt;
          ally.pose = 'jump_rise';
        }
      } else if (ally.type === 'blue') {
        if (!ally.hasActed && ally.y < groundY) {
          ally.y = Math.min(groundY, ally.y + 900 * dt);
        }
        if (!ally.hasActed && ally.y >= groundY) {
          ally.y = groundY;
          ally.readyTimer += dt;
          ally.pose = 'idle';
          if (ally.readyTimer >= ALLY_READY_TIME) {
            ally.hasActed = true;
            audio.playUpgradeBuy();
            if (player) {
              player.heal(45);
              particles.addDamageText(player.x, player.y - 40, '+45 HP', false, '#33ff88');
            }
            for (const z of zombies) {
              if (!z.isDead
                  && Math.hypot(z.x - ally.x, z.y - ally.y) <= ALLY_EFFECT_RADIUS.blue
                  && typeof z.applyFreeze === 'function') {
                z.applyFreeze(6.0); // Slow for 6 seconds
                particles.createHitSparks(z.x, z.y - 30, 8, '#2299ff');
              }
            }
            particles.addTextBanner(ally.x, ally.y - 50, 'POTION SPLASH!', '#2299ff');
            speech.shout(ally.x, ally.y, 'allies', 'blue', 1.35, {
              anchor: ally,
              priority: 2
            });
            this.beginReturn(ally);
          }
        } else if (ally.timer > 1.4) {
          this.beginReturn(ally);
          ally.y -= 900 * dt;
        }
      } else if (ally.type === 'yellow') {
        if (!ally.hasActed && ally.y < groundY) {
          ally.y = Math.min(groundY, ally.y + 900 * dt);
        }
        if (!ally.hasActed && ally.y >= groundY) {
          ally.y = groundY;
          ally.readyTimer += dt;
          ally.pose = 'idle';
          if (ally.readyTimer >= ALLY_READY_TIME) {
            ally.hasActed = true;
            audio.playBlockPlace();
            const turret = {
              x: ally.x,
              y: groundY,
              fireTimer: 0,
              duration: 12.0,
              maxDuration: 12.0,
              range: 600,
              damage: 26,
              hitsRemaining: 3,
              maxHits: 3,
              hurtTimer: 0,
              isAlly: true,
              isTurret: true,
              isDead: false,
              isTargetable: true,
              retreating: false,
              radius: 20,
              height: 42
            };
            turret.takeDamage = (amount, knockbackDir = 0) => this.damageTurret(turret, amount, knockbackDir);
            this.turrets.push(turret);
            particles.addTextBanner(ally.x, ally.y - 50, 'REDSTONE TURRET ACTIVE!', '#ffcc00');
            speech.shout(ally.x, ally.y, 'allies', 'yellow', 1.35, {
              anchor: ally,
              priority: 2
            });
            this.beginReturn(ally);
          }
        } else if (ally.timer > 1.2) {
          this.beginReturn(ally);
          ally.y -= 900 * dt;
        }
      } else if (ally.type === 'green') {
        if (!ally.hasActed && ally.y < groundY) {
          ally.y = Math.min(groundY, ally.y + 900 * dt);
        }
        if (!ally.hasActed && ally.y >= groundY) {
          ally.y = groundY;
          ally.readyTimer += dt;
          ally.pose = 'idle';
          if (ally.readyTimer >= ALLY_READY_TIME) {
            ally.hasActed = true;
            audio.playWaveStart();
            projectiles.spawnMusicNoteWave(
              ally.x,
              groundY - 30,
              ally.facing,
              ALLY_EFFECT_RADIUS.green,
              groundY
            );
            projectiles.spawnMusicNoteWave(
              ally.x,
              groundY - 30,
              -ally.facing,
              ALLY_EFFECT_RADIUS.green,
              groundY
            );
            for (const z of zombies) {
              if (!z.isDead
                  && Math.hypot(z.x - ally.x, z.y - ally.y) <= ALLY_EFFECT_RADIUS.green
                  && typeof z.applyStun === 'function') {
                z.applyStun(4.0);
              }
            }
            particles.addTextBanner(ally.x, ally.y - 50, 'SONIC NOTE WAVE!', '#33dd66');
            camera.addZoomPunch?.(0.025);
            speech.shout(ally.x, ally.y, 'allies', 'green', 1.35, {
              anchor: ally,
              priority: 2
            });
            this.beginReturn(ally);
          }
        } else if (ally.timer > 1.4) {
          this.beginReturn(ally);
          ally.y -= 900 * dt;
        }
      }
      if (ally.life <= 0) {
        this.activeAllies.splice(i, 1);
      }
    }
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const turret = this.turrets[i];
      turret.duration -= dt;
      turret.fireTimer -= dt;
      turret.hurtTimer = Math.max(0, turret.hurtTimer - dt);
      if (turret.isDead || turret.duration <= 0) {
        turret.isDead = true;
        turret.isTargetable = false;
        particles.createDust(turret.x, turret.y, 8);
        this.turrets.splice(i, 1);
        continue;
      }
      if (turret.fireTimer <= 0 && zombies) {
        let closestZombie = null;
        let minDist = turret.range;
        for (const z of zombies) {
          if (z.isDead) continue;
          const dist = Math.hypot(z.x - turret.x, z.y - (turret.y - 30));
          if (dist < minDist) {
            minDist = dist;
            closestZombie = z;
          }
        }
        if (closestZombie) {
          turret.fireTimer = 0.25; // Rapid fire
          audio.playSlash();
          const facing = closestZombie.x > turret.x ? 1 : -1;
          projectiles.spawnThrownPencil(turret.x, turret.y - 30, facing, turret.damage);
          particles.createHitSparks(turret.x, turret.y - 30, 4, '#ffcc00');
        }
      }
    }
    for (let i = this.activeCursors.length - 1; i >= 0; i--) {
      const c = this.activeCursors[i];
      c.timer += dt;
      c.life -= dt;
      const tx = c.targetZombie && !c.targetZombie.isDead ? c.targetZombie.x : c.startX;
      const ty = c.targetZombie && !c.targetZombie.isDead ? c.targetZombie.y - 30 : c.startY;
      if (c.timer < 0.25) {
        const p = c.timer / 0.25;
        c.x = c.startX + (tx - 40 - c.startX) * p;
        c.y = c.startY + (ty - 50 - c.startY) * p;
        c.dragX = c.x;
        c.dragY = c.y;
      } else if (c.timer < 0.65) {
        const p = (c.timer - 0.25) / 0.4;
        c.x = tx - 40 + 80 * p;
        c.y = ty - 50 + 80 * p;
        c.isSelecting = true;
      } else if (!c.hasDeleted) {
        c.hasDeleted = true;
        c.isSelecting = false;
        c.showMenu = true;
        audio.playMouseClick();
        audio.playRecycleBinDelete();
        camera.addShake(0.5);
        camera.addZoomPunch?.(0.045);
        if (c.targetZombie && !c.targetZombie.isDead) {
          const isBoss = !!c.targetZombie.isBoss;
          c.targetZombie.takeDamage(isBoss ? 90 : 9999, 1, 0, true);
          particles.createHitSparks(tx, ty, 20, '#00d2ff');
          particles.addShockwave(tx, ty, 140, '#0099ff', 10);
          particles.addTextBanner(tx, ty - 60, isBoss ? '⚠️ [PROCESS INTERRUPTED]' : '🗑️ [FILE DELETED]', '#00d2ff');
        } else {
          for (const z of zombies) {
            if (!z.isDead && Math.abs(z.x - c.x) < 140) {
              z.takeDamage(z.isBoss ? 90 : 9999, 1, 0, true);
              particles.createHitSparks(z.x, z.y - 30, 20, '#00d2ff');
              particles.addTextBanner(z.x, z.y - 60, '🗑️ [FILE DELETED]', '#00d2ff');
              break;
            }
          }
        }
        speech.shout(c.x, c.y, 'allies', 'cursor', 1.25, {
          anchor: c,
          anchorOffsetY: -12,
          priority: 2
        });
      } else if (c.timer > 0.95) {
        c.showMenu = false;
        c.x += 800 * dt;
        c.y -= 700 * dt;
      }
      if (c.life <= 0) {
        this.activeCursors.splice(i, 1);
      }
    }
  }
  beginReturn(ally) {
    if (!ally || ally.retreating) return;
    ally.retreating = true;
    ally.isTargetable = false;
    ally.pose = 'jump_rise';
  }
  damageTurret(turret, amount = 1) {
    if (!turret || turret.isDead || turret.isTargetable !== true) return false;
    turret.hitsRemaining = Math.max(0, turret.hitsRemaining - 1);
    turret.hurtTimer = 0.16;
    particles.createHitSparks(turret.x, turret.y - 24, 7, '#ffcc00');
    audio.playBlockPlace();
    if (turret.hitsRemaining <= 0) {
      turret.isDead = true;
      turret.isTargetable = false;
      turret.duration = 0;
      particles.addComicPopup(turret.x, turret.y - 48, 'SHORT CIRCUIT!', '#ffcc00', '#ffffff');
    }
    return true;
  }
  injureAlly(ally, amount = 1, knockbackDir = 0) {
    if (!ally || ally.retreating || ally.isTargetable !== true) return false;
    ally.isHurt = true;
    ally.hurtTimer = 0.45;
    ally.retreating = true;
    ally.isTargetable = false;
    ally.life = Math.min(ally.life, 0.72);
    ally.x += Math.sign(knockbackDir || 0) * Math.min(18, Math.max(0, Number(amount) || 0));
    this.cooldowns[ally.type] = Math.max(
      this.cooldowns[ally.type] || 0,
      (this.maxCooldowns[ally.type] || 10) + 4
    );
    this.recoveryStates[ally.type] = true;
    const color = ALLY_COLORS[ally.type] || '#ffffff';
    audio.playPlayerHurt();
    particles.createHitSparks(ally.x, ally.y - 30, 9, color);
    particles.addComicPopup(ally.x, ally.y - 65, 'FALL BACK!', color, '#ffffff');
    speech.shout(ally.x, ally.y, 'allyHurt', ally.type, 1.25, {
      anchor: ally,
      priority: 3,
      cooldownMs: 0
    });
    return true;
  }
  getCombatTargets() {
    this.combatTargets.length = 0;
    for (const ally of this.activeAllies) {
      if (ally.isAlly === true
          && ally.isTargetable === true
          && ally.retreating !== true
          && ally.life > 0) {
        this.combatTargets.push(ally);
      }
    }
    for (const turret of this.turrets) {
      if (!turret.isDead && turret.isTargetable === true && turret.duration > 0) {
        this.combatTargets.push(turret);
      }
    }
    return this.combatTargets;
  }
  draw(ctx, crowded = false) {
    for (const t of this.turrets) {
      ctx.save();
      if (t.hurtTimer > 0) {
        ctx.globalAlpha = 0.6 + Math.sin(t.hurtTimer * 80) * 0.25;
      }
      ctx.fillStyle = '#444';
      ctx.fillRect(t.x - 14, t.y - 20, 28, 20);
      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 25, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#777';
      ctx.fillRect(t.x - 4, t.y - 32, 8, 12);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(t.x - 15, t.y - 40, 30 * (t.duration / t.maxDuration), 4);
      for (let hit = 0; hit < t.maxHits; hit++) {
        ctx.fillStyle = hit < t.hitsRemaining ? '#fff06a' : '#4c4652';
        ctx.fillRect(t.x - 14 + hit * 10, t.y - 48, 7, 4);
      }
      ctx.restore();
    }
    for (const ally of this.activeAllies) {
      if (!ally.retreating && !ally.hasActed && ally.readyTimer > 0) {
        const color = ALLY_COLORS[ally.type] || '#ffffff';
        const effectRadius = ALLY_EFFECT_RADIUS[ally.type] || 220;
        const progress = Math.min(1, ally.readyTimer / ALLY_READY_TIME);
        ctx.save();
        ctx.globalAlpha = 0.24 + progress * 0.28;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 9]);
        ctx.beginPath();
        ctx.ellipse(ally.x, ally.y - 2, effectRadius, Math.max(22, effectRadius * 0.075), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.82;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(ally.x, ally.y - 3, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
        ctx.restore();
      }
      const renderer = this.renderers[ally.type];
      if (renderer) {
        renderer.draw(ctx, {
          x: ally.x,
          y: ally.y,
          facing: ally.facing,
          pose: ally.pose || 'idle',
          animTimer: ally.timer,
          isGrounded: true,
          isHurt: ally.isHurt === true,
          isAwakened: false,
          scale: 1.0,
          alpha: 1.0
        });
      }
    }
    for (const c of this.activeCursors) {
      ctx.save();
      if (c.isSelecting) {
        const boxX = Math.min(c.dragX, c.x);
        const boxY = Math.min(c.dragY, c.y);
        const boxW = Math.abs(c.x - c.dragX);
        const boxH = Math.abs(c.y - c.dragY);
        ctx.fillStyle = 'rgba(0, 120, 215, 0.25)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(boxX, boxY, boxW, boxH);
      }
      if (c.showMenu) {
        const menuX = c.x > ALLY_ARENA_BOUND - 100 ? c.x - 100 : c.x + 15;
        const menuY = c.y - 20;
        ctx.fillStyle = '#f0f0f0';
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;
        ctx.fillRect(menuX, menuY, 85, 55);
        ctx.strokeRect(menuX, menuY, 85, 55);
        ctx.fillStyle = '#333';
        ctx.font = "10px sans-serif";
        ctx.fillText("Open", menuX + 8, menuY + 14);
        ctx.fillText("Copy", menuX + 8, menuY + 28);
        ctx.fillStyle = '#0078d7';
        ctx.fillRect(menuX + 1, menuY + 34, 83, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("🗑️ Delete", menuX + 8, menuY + 46);
      }
      ctx.translate(c.x, c.y);
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = crowded ? 0 : 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 24);
      ctx.lineTo(6, 18);
      ctx.lineTo(13, 26);
      ctx.lineTo(17, 23);
      ctx.lineTo(10, 15);
      ctx.lineTo(18, 15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
  summonAlly(type, targetX, targetY, facing = 1, zombies = []) {
    if (!this.unlocked[type] || this.cooldowns[type] > 0) {
      if (this.cooldowns[type] > 0) {
        audio.createNoiseBurst(0.05, 0.1, 800);
      }
      return false;
    }
    this.cooldowns[type] = this.maxCooldowns[type];
    this.recoveryStates[type] = false;
    audio.playWhoosh();
    if (type === 'cursor') {
      let targetZombie = null;
      let minDist = 9999;
      const summonTargets = this.summonTargets;
      summonTargets.length = 0;
      for (const zombie of zombies || []) summonTargets.push(zombie);
      projectiles.collectHostileTargets?.(summonTargets);
      if (summonTargets.length > 0) {
        targetZombie = summonTargets.find((z) => !z.isDead && z.isBoss) || null;
        if (!targetZombie) {
          for (const z of summonTargets) {
            if (z.isDead) continue;
            const dist = Math.abs(z.x - targetX);
            if (z.type === 'brute' || z.type === 'titan_boss') {
              targetZombie = z; // prioritize big ordinary enemies
              break;
            }
            if (dist < minDist) {
              minDist = dist;
              targetZombie = z;
            }
          }
        }
      }
      const desiredCursorX = targetZombie ? targetZombie.x + 180 : targetX + 200;
      const spawnX = Math.max(-ALLY_ARENA_BOUND, Math.min(ALLY_ARENA_BOUND, desiredCursorX));
      const spawnY = targetZombie ? targetZombie.y - 250 : targetY - 250;
      this.activeCursors.push({
        startX: spawnX,
        startY: spawnY,
        x: spawnX,
        y: spawnY,
        dragX: spawnX,
        dragY: spawnY,
        targetZombie,
        isSelecting: false,
        showMenu: false,
        hasDeleted: false,
        timer: 0,
        life: 1.6
      });
      return true;
    }
    const spawnY = type === 'red' ? targetY - 450 : targetY - 300;
    const desiredSpawnX = targetX + (type === 'red' ? 60 : 45) * facing;
    const spawnX = Math.max(-ALLY_ARENA_BOUND, Math.min(ALLY_ARENA_BOUND, desiredSpawnX));
    const ally = {
      type,
      x: spawnX,
      y: spawnY,
      facing,
      pose: type === 'red' ? 'dive_kick' : 'jump_rise',
      timer: 0,
      readyTimer: 0,
      life: 2.5,
      hasActed: false,
      isAlly: true,
      isDead: false,
      isTargetable: false,
      retreating: false,
      isHurt: false,
      hurtTimer: 0,
      radius: 18,
      height: 62
    };
    ally.takeDamage = (amount, knockbackDir = 0) => this.injureAlly(ally, amount, knockbackDir);
    this.activeAllies.push(ally);
    return true;
  }
}
export const allies = new AllyManager();
