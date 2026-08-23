// Stick Figure Allies (Red, Blue, Yellow, Green) and The Animator's Mouse Cursor Pointer

import { StickFigureRenderer } from './stickman.js';
import { particles } from '../engine/particles.js';
import { audio } from '../engine/audio.js';
import { projectiles } from './projectiles.js';

export class AllyManager {
  constructor() {
    // Unlocked by default so player can summon friends anytime!
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

    this.activeAllies = [];
    this.turrets = [];
    this.activeCursors = [];

    // Renderers for allies (Solid filled heads for Red, Blue, Yellow, Green!)
    this.renderers = {
      red: new StickFigureRenderer('#ff3344', 5, 1.0, false),
      blue: new StickFigureRenderer('#2299ff', 5, 1.0, false),
      yellow: new StickFigureRenderer('#ffcc00', 5, 1.0, false),
      green: new StickFigureRenderer('#33dd66', 5, 1.0, false)
    };
  }

  update(dt, groundY, zombies, player, camera) {
    // Decrease cooldowns
    for (const key of Object.keys(this.cooldowns)) {
      if (this.cooldowns[key] > 0) {
        this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
      }
    }

    // 1. Update Active Stick Figure Allies
    for (let i = this.activeAllies.length - 1; i >= 0; i--) {
      const ally = this.activeAllies[i];
      ally.timer += dt;
      ally.life -= dt;

      if (ally.type === 'red') {
        // Red dives down fast and executes explosive ground slam
        if (ally.y < groundY) {
          ally.y += 1400 * dt;
          if (ally.y >= groundY) {
            ally.y = groundY;
            ally.pose = 'attack_cross';
            // Slam shockwave
            camera.addShake(0.7);
            audio.playPunch('heavy');
            particles.addShockwave(ally.x, groundY, 240, '#ff3344', 14);
            particles.createHitSparks(ally.x, groundY, 24, '#ff5533');

            // Damage and launch all nearby zombies
            for (const z of zombies) {
              if (!z.isDead && Math.abs(z.x - ally.x) < 220) {
                z.takeDamage(140, ally.x < z.x ? 1 : -1, 800, true);
              }
            }
          }
        } else {
          // Stay briefly then jump away
          if (ally.timer > 1.2) {
            ally.y -= 1000 * dt;
            ally.pose = 'jump_rise';
          }
        }
      } else if (ally.type === 'blue') {
        // Blue drops in, throws healing potions to player and freeze webs
        if (ally.timer < 0.35 && ally.y < groundY) {
          ally.y += 900 * dt;
        } else if (!ally.hasActed) {
          ally.hasActed = true;
          audio.playUpgradeBuy();
          // Heal player
          if (player) {
            player.heal(45);
            particles.addDamageText(player.x, player.y - 40, '+45 HP', false, '#33ff88');
          }
          // Slow down all zombies on screen
          for (const z of zombies) {
            if (!z.isDead) {
              z.applyFreeze(6.0); // Slow for 6 seconds
              particles.createHitSparks(z.x, z.y - 30, 8, '#2299ff');
            }
          }
          particles.addTextBanner(ally.x, ally.y - 50, 'POTION SPLASH!', '#2299ff');
        } else if (ally.timer > 1.4) {
          ally.y -= 900 * dt;
        }
      } else if (ally.type === 'yellow') {
        // Yellow drops in, quickly builds a redstone turret, then teleports out
        if (ally.timer < 0.3 && ally.y < groundY) {
          ally.y += 900 * dt;
        } else if (!ally.hasActed) {
          ally.hasActed = true;
          audio.playBlockPlace();
          this.turrets.push({
            x: ally.x,
            y: groundY,
            fireTimer: 0,
            duration: 18.0,
            maxDuration: 18.0,
            range: 600,
            damage: 26
          });
          particles.addTextBanner(ally.x, ally.y - 50, 'REDSTONE TURRET ACTIVE!', '#ffcc00');
        } else if (ally.timer > 1.2) {
          ally.y -= 900 * dt;
        }
      } else if (ally.type === 'green') {
        // Green plays music staff wave
        if (ally.timer < 0.3 && ally.y < groundY) {
          ally.y += 900 * dt;
        } else if (!ally.hasActed) {
          ally.hasActed = true;
          audio.playWaveStart();
          projectiles.spawnMusicNoteWave(ally.x, groundY - 30, ally.facing);
          projectiles.spawnMusicNoteWave(ally.x, groundY - 30, -ally.facing);
          // Stun all zombies
          for (const z of zombies) {
            if (!z.isDead) {
              z.applyStun(4.0);
            }
          }
          particles.addTextBanner(ally.x, ally.y - 50, 'SONIC NOTE WAVE!', '#33dd66');
        } else if (ally.timer > 1.4) {
          ally.y -= 900 * dt;
        }
      }

      if (ally.life <= 0) {
        this.activeAllies.splice(i, 1);
      }
    }

    // 2. Update Redstone Turrets
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const turret = this.turrets[i];
      turret.duration -= dt;
      turret.fireTimer -= dt;

      if (turret.duration <= 0) {
        particles.createDust(turret.x, turret.y, 8);
        this.turrets.splice(i, 1);
        continue;
      }

      // Auto-target closest zombie
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

    // 3. Update Animator Mouse Cursor Allies
    for (let i = this.activeCursors.length - 1; i >= 0; i--) {
      const c = this.activeCursors[i];
      c.timer += dt;
      c.life -= dt;

      // Track target position
      const tx = c.targetZombie && !c.targetZombie.isDead ? c.targetZombie.x : c.startX;
      const ty = c.targetZombie && !c.targetZombie.isDead ? c.targetZombie.y - 30 : c.startY;

      if (c.timer < 0.25) {
        // Phase 1: Fly in to top-left of target
        const p = c.timer / 0.25;
        c.x = c.startX + (tx - 40 - c.startX) * p;
        c.y = c.startY + (ty - 50 - c.startY) * p;
        c.dragX = c.x;
        c.dragY = c.y;
      } else if (c.timer < 0.65) {
        // Phase 2: Drag blue selection box over zombie
        const p = (c.timer - 0.25) / 0.4;
        c.x = tx - 40 + 80 * p;
        c.y = ty - 50 + 80 * p;
        c.isSelecting = true;
      } else if (!c.hasDeleted) {
        // Phase 3: Right click -> Delete!
        c.hasDeleted = true;
        c.isSelecting = false;
        c.showMenu = true;
        audio.playMouseClick();
        audio.playRecycleBinDelete();
        camera.addShake(0.5);

        // Vaporize target zombie
        if (c.targetZombie && !c.targetZombie.isDead) {
          c.targetZombie.takeDamage(9999, 1, 0, true);
          particles.createHitSparks(tx, ty, 20, '#00d2ff');
          particles.addShockwave(tx, ty, 140, '#0099ff', 10);
          particles.addTextBanner(tx, ty - 60, '🗑️ [FILE DELETED]', '#00d2ff');
        } else {
          // Fallback: Delete closest zombie
          for (const z of zombies) {
            if (!z.isDead && Math.abs(z.x - c.x) < 140) {
              z.takeDamage(9999, 1, 0, true);
              particles.createHitSparks(z.x, z.y - 30, 20, '#00d2ff');
              particles.addTextBanner(z.x, z.y - 60, '🗑️ [FILE DELETED]', '#00d2ff');
              break;
            }
          }
        }
      } else if (c.timer > 0.95) {
        // Phase 4: Zoom away
        c.showMenu = false;
        c.x += 800 * dt;
        c.y -= 700 * dt;
      }

      if (c.life <= 0) {
        this.activeCursors.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // 1. Draw Turrets
    for (const t of this.turrets) {
      ctx.save();
      // Turret base
      ctx.fillStyle = '#444';
      ctx.fillRect(t.x - 14, t.y - 20, 28, 20);
      // Redstone wire / torch
      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 25, 6, 0, Math.PI * 2);
      ctx.fill();
      // Barrel
      ctx.fillStyle = '#777';
      ctx.fillRect(t.x - 4, t.y - 32, 8, 12);
      // Duration bar
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(t.x - 15, t.y - 40, 30 * (t.duration / t.maxDuration), 4);
      ctx.restore();
    }

    // 2. Draw Active Allies
    for (const ally of this.activeAllies) {
      const renderer = this.renderers[ally.type];
      if (renderer) {
        renderer.draw(ctx, {
          x: ally.x,
          y: ally.y,
          facing: ally.facing,
          pose: ally.pose || 'idle',
          animTimer: ally.timer,
          isGrounded: true,
          isHurt: false,
          isAwakened: false,
          scale: 1.0,
          alpha: 1.0
        });
      }
    }

    // 3. Draw Active Animator Mouse Cursors & Selection Boxes
    for (const c of this.activeCursors) {
      ctx.save();

      // Drag Selection Box
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

      // Context Menu Popup ("Delete")
      if (c.showMenu) {
        const menuX = c.x + 15;
        const menuY = c.y - 20;
        ctx.fillStyle = '#f0f0f0';
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;
        ctx.fillRect(menuX, menuY, 85, 55);
        ctx.strokeRect(menuX, menuY, 85, 55);

        // Menu items
        ctx.fillStyle = '#333';
        ctx.font = "10px sans-serif";
        ctx.fillText("Open", menuX + 8, menuY + 14);
        ctx.fillText("Copy", menuX + 8, menuY + 28);

        // Highlighted Delete Bar
        ctx.fillStyle = '#0078d7';
        ctx.fillRect(menuX + 1, menuY + 34, 83, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("🗑️ Delete", menuX + 8, menuY + 46);
      }

      // Draw OS Mouse Pointer Arrow
      ctx.translate(c.x, c.y);
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
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

  // --- Summon Methods ---

  summonAlly(type, targetX, targetY, facing = 1, zombies = []) {
    if (!this.unlocked[type] || this.cooldowns[type] > 0) {
      if (this.cooldowns[type] > 0) {
        audio.createNoiseBurst(0.05, 0.1, 800);
      }
      return false;
    }

    this.cooldowns[type] = this.maxCooldowns[type];
    audio.playWhoosh();

    if (type === 'cursor') {
      // Find highest threat living zombie
      let targetZombie = null;
      let minDist = 9999;
      if (zombies && zombies.length > 0) {
        for (const z of zombies) {
          if (z.isDead) continue;
          const dist = Math.abs(z.x - targetX);
          if (z.type === 'brute' || z.type === 'titan_boss') {
            targetZombie = z; // prioritize big zombies
            break;
          }
          if (dist < minDist) {
            minDist = dist;
            targetZombie = z;
          }
        }
      }

      const spawnX = targetZombie ? targetZombie.x + 180 : targetX + 200;
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

    this.activeAllies.push({
      type,
      x: targetX + (type === 'red' ? 60 * facing : -40 * facing),
      y: spawnY,
      facing,
      pose: type === 'red' ? 'dive_kick' : 'jump_rise',
      timer: 0,
      life: 2.5,
      hasActed: false
    });

    return true;
  }
}

export const allies = new AllyManager();
