// Projectiles, spawned Sketch Blocks, Anvils, and Hazards

import { particles } from '../engine/particles.js';
import { audio } from '../engine/audio.js';

export class ProjectileManager {
  constructor() {
    this.projectiles = [];
    this.sketchBlocks = [];
    this.hazards = [];
  }

  update(dt, groundY, zombies, player, camera) {
    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.rotation !== undefined && p.rotSpeed) p.rotation += p.rotSpeed * dt;

      // Handle ground collision
      if (p.y >= groundY && p.vy > 0) {
        if (p.type === 'acid') {
          // Splash acid puddle
          this.hazards.push({
            x: p.x,
            y: groundY,
            radius: 35,
            damage: 8,
            duration: 3.5,
            maxDuration: 3.5,
            tickTimer: 0,
            color: '#44ee55'
          });
          particles.createZombieSplatter(p.x, groundY, 10, '#33dd44');
          audio.createNoiseBurst(0.1, 0.2, 500);
          this.projectiles.splice(i, 1);
          continue;
        } else if (p.type === 'anvil') {
          // Heavy Anvil Impact
          p.y = groundY;
          p.vy = 0;
          audio.playAnvilHit();
          camera.addShake(0.5);
          particles.addShockwave(p.x, groundY, 160, '#cccccc', 10);
          particles.createHitSparks(p.x, groundY, 15, '#ffffff');

          // Damage zombies in impact radius
          for (const z of zombies) {
            if (!z.isDead && Math.abs(z.x - p.x) < 140 && Math.abs(z.y - groundY) < 60) {
              z.takeDamage(p.damage, p.x < z.x ? 1 : -1, 700, true);
            }
          }

          // Anvil stays briefly as obstacle then despawns
          p.life = Math.min(p.life, 2.0);
          p.isLanded = true;
        }
      }

      // Virabot Minion AI
      if (p.type === 'virabot') {
        if (p.y >= groundY) {
          p.y = groundY;
          p.vy = 0;
        }

        if (player && !player.isDead) {
          const dx = player.x - p.x;
          p.facing = dx >= 0 ? 1 : -1;
          p.vx = p.facing * 120;

          // Leap attack
          if (Math.abs(dx) < 140 && Math.random() < 0.02 && p.y >= groundY) {
            p.vy = -320;
            p.vx = p.facing * 240;
          }

          // Shoot homing virus dart
          p.shootTimer -= dt;
          if (p.shootTimer <= 0) {
            p.shootTimer = 2.2 + Math.random() * 1.5;
            const dy = (player.y - 30) - p.y;
            const dist = Math.hypot(dx, dy) || 1;
            this.spawnViraDart(p.x, p.y - 8, (dx / dist) * 380, (dy / dist) * 380, 14);
            audio.createNoiseBurst(0.08, 0.25, 2500);
          }
        }
      }

      // Doom Laser Beam Continuous Damage
      if (p.type === 'doom_laser') {
        if (player && !player.isDead && !player.isRolling && !player.isAwakened) {
          const inBeamX = p.facing > 0 ? (player.x >= p.x && player.x <= p.x + 1800) : (player.x <= p.x && player.x >= p.x - 1800);
          if (inBeamX && Math.abs((player.y - 30) - p.y) < p.beamWidth + 15) {
            player.takeDamage(p.damage * dt * 2.5, p.facing, 450);
            particles.createHitSparks(player.x, p.y, 4, '#ff0033');
            camera.addShake(0.15);
          }
        }
        continue;
      }

      // Check collision with Player (for hostile projectiles like Acid, Dark Waves, Virabots)
      if (p.isHostile && player && !player.isRolling && !player.isAwakened) {
        const dist = Math.hypot(p.x - player.x, p.y - (player.y - 30));
        if (dist < p.radius + 20) {
          player.takeDamage(p.damage, p.vx > 0 ? 1 : -1);
          particles.createHitSparks(p.x, p.y, 8, '#ff0033');
          if (p.type !== 'virabot') {
            this.projectiles.splice(i, 1);
            continue;
          }
        }
      }

      // Check collision with Zombies (for friendly projectiles like Thrown Pencil / Note)
      if (!p.isHostile && zombies) {
        for (const z of zombies) {
          if (z.isDead) continue;
          const dist = Math.hypot(p.x - z.x, p.y - (z.y - 30));
          if (dist < p.radius + z.radius) {
            z.takeDamage(p.damage, p.vx > 0 ? 1 : -1, p.knockback || 300, p.isCrit);
            particles.createHitSparks(p.x, p.y, 8, p.sparkColor || '#ffaa00');

            if (p.pierce > 0) {
              p.pierce--;
            } else {
              this.projectiles.splice(i, 1);
              break;
            }
          }
        }
      }
    }

    // 2. Update Ground Hazards (Acid Puddles)
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.duration -= dt;
      h.tickTimer -= dt;

      if (h.duration <= 0) {
        this.hazards.splice(i, 1);
        continue;
      }

      // Damage player if standing in acid
      if (player && !player.isRolling && h.tickTimer <= 0) {
        if (Math.abs(player.x - h.x) < h.radius && Math.abs(player.y - h.y) < 20) {
          player.takeDamage(h.damage, 0);
          h.tickTimer = 0.5; // Tick every half second
        }
      }
    }

    // 3. Update Sketch Blocks
    for (let i = this.sketchBlocks.length - 1; i >= 0; i--) {
      const b = this.sketchBlocks[i];
      b.life -= dt;
      if (b.hp <= 0 || b.life <= 0) {
        particles.createDust(b.x, b.y, 10);
        this.sketchBlocks.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // 1. Draw Hazards (Acid pools)
    for (const h of this.hazards) {
      const progress = 1 - h.duration / h.maxDuration;
      const alpha = (1 - progress * 0.5) * 0.7;
      ctx.save();
      ctx.fillStyle = h.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.radius, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bubbles
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(h.x + Math.sin(Date.now() * 0.01) * (h.radius * 0.5), h.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw Sketch Blocks
    for (const b of this.sketchBlocks) {
      ctx.save();
      ctx.fillStyle = b.type === 'obsidian' ? '#1c1b29' : '#8d6e63';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - b.width / 2, b.y - b.height, b.width, b.height);
      ctx.fillRect(b.x - b.width / 2, b.y - b.height, b.width, b.height);

      // Block Sketch Texture Grid
      ctx.strokeStyle = b.type === 'obsidian' ? '#443366' : '#5d4037';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x - b.width / 2 + 4, b.y - b.height + 4, b.width - 8, b.height - 8);

      // HP Bar above block if damaged
      if (b.hp < b.maxHp) {
        ctx.fillStyle = '#ff3344';
        ctx.fillRect(b.x - 20, b.y - b.height - 10, 40, 4);
        ctx.fillStyle = '#44ee44';
        ctx.fillRect(b.x - 20, b.y - b.height - 10, 40 * (b.hp / b.maxHp), 4);
      }

      ctx.restore();
    }

    // 3. Draw Projectiles
    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation !== undefined) ctx.rotate(p.rotation);

      if (p.type === 'acid') {
        // Toxic Acid Glob
        ctx.fillStyle = '#44ee44';
        ctx.shadowColor = '#44ee44';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'anvil') {
        // Minecraft Giant Iron Anvil
        ctx.fillStyle = '#4f545c';
        ctx.strokeStyle = '#202225';
        ctx.lineWidth = 3;
        // Base
        ctx.fillRect(-24, -10, 48, 10);
        ctx.strokeRect(-24, -10, 48, 10);
        // Pillar
        ctx.fillRect(-12, -26, 24, 16);
        ctx.strokeRect(-12, -26, 24, 16);
        // Top Hammer Head
        ctx.fillRect(-32, -44, 64, 18);
        ctx.strokeRect(-32, -44, 64, 18);
      } else if (p.type === 'pencil_spear') {
        // Flying Thrown Pencil Spear
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(-30, -4, 60, 8);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.moveTo(30, -4);
        ctx.lineTo(44, 0);
        ctx.lineTo(30, 4);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'dark_wave') {
        // Red Crescent Dark Energy Slices
        ctx.fillStyle = '#ff1133';
        ctx.shadowColor = '#ff0033';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.quadraticCurveTo(p.radius * 0.2, 0, 0, -p.radius * 0.4);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'vira_dart') {
        // Homing / Glitchy Red Virus Dart
        ctx.fillStyle = '#ff0044';
        ctx.shadowColor = '#ff0022';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'virabot') {
        // Mini ViraBot Spider Minion
        ctx.fillStyle = '#1a0005';
        ctx.strokeStyle = '#ff0033';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff0033';
        ctx.shadowBlur = 8;
        // Body Sphere
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Red glowing eye
        ctx.fillStyle = '#ff1133';
        ctx.beginPath();
        ctx.arc(p.facing * 3, -2, 3, 0, Math.PI * 2);
        ctx.fill();
        // 4 Spidery Legs
        const legT = Date.now() * 0.02;
        ctx.beginPath();
        ctx.moveTo(-6, 4); ctx.lineTo(-14, 12 + Math.sin(legT) * 4);
        ctx.moveTo(6, 4); ctx.lineTo(14, 12 - Math.sin(legT) * 4);
        ctx.moveTo(-4, -4); ctx.lineTo(-12, -10 + Math.cos(legT) * 3);
        ctx.moveTo(4, -4); ctx.lineTo(12, -10 - Math.cos(legT) * 3);
        ctx.stroke();
      }
    }

    // 4. Draw Doom Laser Beams
    for (const p of this.projectiles) {
      if (p.type === 'doom_laser') {
        ctx.save();
        ctx.strokeStyle = '#ff0033';
        ctx.lineWidth = p.beamWidth;
        ctx.shadowColor = '#ff2244';
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.facing * 1800, p.y);
        ctx.stroke();

        // Inner White Core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = p.beamWidth * 0.35;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // --- Spawning Methods ---

  spawnDarkEnergyWave(x, y, facing, damage = 25) {
    audio.playDarkBladeSlash();
    this.projectiles.push({
      type: 'dark_wave',
      x,
      y,
      vx: facing * 700,
      vy: 0,
      radius: 24,
      damage,
      isHostile: true,
      life: 2.0
    });
  }

  spawnViraDart(x, y, vx, vy, damage = 18) {
    this.projectiles.push({
      type: 'vira_dart',
      x,
      y,
      vx,
      vy,
      radius: 8,
      damage,
      isHostile: true,
      life: 3.5
    });
  }

  spawnViraBot(x, y, facing = 1) {
    audio.playViraBotSpawn();
    particles.createHitSparks(x, y, 12, '#ff0033');
    this.projectiles.push({
      type: 'virabot',
      x,
      y: y - 20,
      vx: facing * (160 + Math.random() * 80),
      vy: -180,
      gravity: 450,
      facing,
      radius: 14,
      damage: 15,
      hp: 35,
      shootTimer: 1.5 + Math.random() * 1.5,
      isHostile: true,
      life: 18.0
    });
  }

  spawnDarkDoomLaser(x, y, facing, duration = 1.2, damage = 45) {
    audio.playDoomLaserFire();
    this.projectiles.push({
      type: 'doom_laser',
      x,
      y,
      facing,
      beamWidth: 32,
      damage,
      duration,
      isHostile: true,
      life: duration
    });
  }

  spawnAcidBlob(x, y, vx, vy) {
    this.projectiles.push({
      type: 'acid',
      x,
      y,
      vx,
      vy,
      gravity: 500,
      radius: 9,
      damage: 18,
      isHostile: true,
      life: 3.0
    });
  }

  spawnAnvil(x, targetY, damage = 180) {
    audio.playWhoosh();
    this.projectiles.push({
      type: 'anvil',
      x,
      y: targetY - 450, // Spawn high above
      vx: 0,
      vy: 120,
      gravity: 1600, // Drops fast and heavy
      radius: 35,
      damage,
      isHostile: false,
      isLanded: false,
      life: 4.0
    });
  }

  spawnSketchBlock(x, y, type = 'obsidian') {
    audio.playBlockPlace();
    particles.createDust(x, y, 6);
    this.sketchBlocks.push({
      x,
      y,
      width: 60,
      height: 60,
      type,
      hp: type === 'obsidian' ? 200 : 100,
      maxHp: type === 'obsidian' ? 200 : 100,
      life: 25.0 // Lasts 25 seconds
    });
  }

  spawnThrownPencil(x, y, facing, damage = 45) {
    audio.playWhoosh();
    this.projectiles.push({
      type: 'pencil_spear',
      x,
      y,
      vx: facing * 900,
      vy: -30,
      gravity: 100,
      rotation: facing > 0 ? 0 : Math.PI,
      radius: 18,
      damage,
      pierce: 3,
      isHostile: false,
      life: 1.5
    });
  }

  spawnMusicNoteWave(x, y, facing) {
    for (let i = -2; i <= 2; i++) {
      this.projectiles.push({
        type: 'music_note',
        x,
        y: y + i * 20,
        vx: facing * (450 + Math.random() * 100),
        vy: i * 60,
        radius: 20,
        damage: 25,
        sparkColor: '#33ffaa',
        pierce: 2,
        isHostile: false,
        life: 1.2
      });
    }
  }
}

export const projectiles = new ProjectileManager();
