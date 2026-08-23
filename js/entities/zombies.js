// Stick Zombie Horde Entities (Walker, Runner, Spitter, Brute, Titan Boss)

import { StickFigureRenderer } from './stickman.js';
import { particles } from '../engine/particles.js';
import { audio } from '../engine/audio.js';
import { projectiles } from './projectiles.js';
import { combat } from '../systems/combat.js';
import { speech } from '../engine/speech.js';

export class Zombie {
  constructor(x, y, type = 'walker', wave = 1) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.type = type;
    this.wave = wave;

    this.facing = 1;
    this.pose = 'idle';
    this.animTimer = Math.random() * 5;
    this.isDead = false;
    this.isHurt = false;
    this.hurtTimer = 0;

    // Attack Windup and Interrupt System
    this.windupTimer = 0;
    this.attackCooldown = 0;
    this.stateTimer = 0;

    // Status modifiers
    this.freezeTimer = 0;
    this.stunTimer = 0;
    this.isGrounded = false;

    // Stats configuration per type
    this.initStats(type, wave);

    // Renderer
    this.renderer = new StickFigureRenderer(this.color, this.strokeWidth, this.scale);
    this.renderer.isHunched = true;
    this.renderer.isZombie = true;
  }

  initStats(type, wave) {
    const waveScale = 1 + (wave - 1) * 0.12;

    switch (type) {
      case 'runner':
        this.maxHp = Math.round(32 * waveScale);
        this.hp = this.maxHp;
        this.speed = 210;
        this.damage = 10;
        this.radius = 16;
        this.height = 40;
        this.color = '#388e3c'; // Decayed agile green
        this.strokeWidth = 4;
        this.scale = 0.85;
        this.inkReward = 8;
        this.scoreReward = 75;
        break;

      case 'spitter':
        this.maxHp = Math.round(45 * waveScale);
        this.hp = this.maxHp;
        this.speed = 95;
        this.damage = 15;
        this.radius = 18;
        this.height = 55;
        this.color = '#00796b'; // Toxic teal green
        this.strokeWidth = 5;
        this.scale = 1.0;
        this.inkReward = 12;
        this.scoreReward = 100;
        this.preferredDist = 280;
        break;

      case 'brute':
        this.maxHp = Math.round(160 * waveScale);
        this.hp = this.maxHp;
        this.speed = 80;
        this.damage = 24;
        this.radius = 32;
        this.height = 80;
        this.color = '#1b5e20'; // Dark hulking forest green
        this.strokeWidth = 8;
        this.scale = 1.45;
        this.inkReward = 30;
        this.scoreReward = 300;
        break;

      case 'titan_boss':
        this.maxHp = Math.round(750 * waveScale);
        this.hp = this.maxHp;
        this.speed = 90;
        this.damage = 32;
        this.radius = 50;
        this.height = 120;
        this.color = '#0a2e0e'; // Deep nightmare dark green
        this.strokeWidth = 12;
        this.scale = 2.2;
        this.inkReward = 120;
        this.scoreReward = 2000;
        this.isBoss = true;
        this.bossPhase = 1;
        break;

      case 'walker':
      default:
        this.maxHp = Math.round(45 * waveScale);
        this.hp = this.maxHp;
        this.speed = 110;
        this.damage = 12;
        this.radius = 18;
        this.height = 58;
        this.color = '#2e7d32'; // Deep decayed zombie green
        this.strokeWidth = 5;
        this.scale = 1.0;
        this.inkReward = 10;
        this.scoreReward = 100;
        break;
    }
  }

  update(dt, groundY, player, sketchBlocks, camera, platforms = [], zombies = []) {
    if (this.isDead) return;

    this.platforms = platforms;
    this.animTimer += dt;
    this.stateTimer += dt;

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
    if (this.freezeTimer > 0) this.freezeTimer -= dt;

    // 1. Check Hit Stun
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      this.pose = 'idle';
      this.vx *= 0.88; // Decelerate from knockback
      if (this.hurtTimer <= 0) this.isHurt = false;

      // Apply physics during hit stun and skip attacking
      this.applyPhysics(dt, groundY, sketchBlocks);
      return;
    }

    // 2. Check Stun (from Green Ally)
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.pose = 'idle';
      this.vx = 0;
      this.applyPhysics(dt, groundY, sketchBlocks);
      return;
    }

    const currentSpeed = this.speed * (this.freezeTimer > 0 ? 0.45 : 1.0);

    // 3. AI Behaviors
    if (player && !player.isDead) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);

      this.facing = dx >= 0 ? 1 : -1;

      // Handle Attack Windup
      if (this.windupTimer > 0) {
        this.windupTimer -= dt;
        this.vx = 0;
        this.pose = 'attack_jab'; // Raising arms to strike
        if (this.windupTimer <= 0) {
          // Windup complete -> execute strike
          if (dist < 60) {
            this.bitePlayer(player);
          }
        }
        this.applyPhysics(dt, groundY, sketchBlocks);
        return;
      }

      if (this.type === 'walker') {
        // Standard Zombie: Approach, telegraph windup, then bite
        if (dist > 45) {
          this.vx = this.facing * currentSpeed;
          this.pose = 'zombie_walk';
        } else {
          this.vx = 0;
          if (this.attackCooldown <= 0) {
            // Start 0.28s windup so player can react and interrupt!
            this.windupTimer = 0.28;
            this.pose = 'attack_jab';
          } else {
            this.pose = 'zombie_idle';
          }
        }
      } else if (this.type === 'runner') {
        // Agile Runner
        if (dist > 180) {
          this.vx = this.facing * currentSpeed;
          this.pose = 'run';
        } else if (dist > 50 && this.isGrounded && this.attackCooldown <= 0) {
          // Leap attack
          this.vy = -450;
          this.vx = this.facing * (currentSpeed * 1.5);
          this.isGrounded = false;
          this.pose = 'jump_rise';
          this.attackCooldown = 1.8;
          audio.playRunnerScreech();
          audio.playWhoosh();
        } else if (dist <= 50) {
          this.vx = 0;
          if (this.attackCooldown <= 0) {
            this.windupTimer = 0.22;
            this.pose = 'attack_kick';
          } else {
            this.pose = 'zombie_idle';
          }
        }
      } else if (this.type === 'spitter') {
        // Ranged Spitter
        if (dist < this.preferredDist - 60) {
          this.vx = -this.facing * (currentSpeed * 0.8);
          this.pose = 'zombie_walk';
        } else if (dist > this.preferredDist + 80) {
          this.vx = this.facing * currentSpeed;
          this.pose = 'zombie_walk';
        } else {
          this.vx = 0;
          if (this.attackCooldown <= 0) {
            this.spitAcid(player);
          } else {
            this.pose = 'zombie_idle';
          }
        }
      } else if (this.type === 'brute') {
        // Heavy Brute
        if (dist > 80) {
          this.vx = this.facing * currentSpeed;
          this.pose = 'zombie_walk';
        } else {
          this.vx = 0;
          if (this.attackCooldown <= 0) {
            this.bruteSlam(player, camera);
          } else {
            this.pose = 'zombie_idle';
          }
        }
      } else if (this.type === 'titan_boss') {
        // Boss AI
        this.updateBossAI(dt, dist, player, camera);
      }

      // Horde Flocking / Separation Force (Prevents single-file smearing)
      if (zombies && Array.isArray(zombies)) {
        for (const other of zombies) {
          if (other !== this && !other.isDead && !other.isBoss) {
            const sepDx = this.x - other.x;
            const sepDist = Math.abs(sepDx);
            const minDist = (this.radius + other.radius) + 10;
            if (sepDist < minDist && Math.abs(this.y - other.y) < 35) {
              const pushForce = (minDist - sepDist) * 4.0;
              this.vx += (sepDx >= 0 ? 1 : -1) * pushForce;
            }
          }
        }
      }
    } else {
      this.vx = 0;
      this.pose = 'idle';
    }

    // Apply Physics & Collisions
    this.applyPhysics(dt, groundY, sketchBlocks);
  }

  updateBossAI(dt, dist, player, camera) {
    const currentSpeed = this.speed * (this.freezeTimer > 0 ? 0.45 : 1.0);

    if (this.hp < this.maxHp * 0.5 && this.bossPhase === 1) {
      this.bossPhase = 2;
      this.speed *= 1.3;
      audio.playBossRoar();
      particles.addTextBanner(this.x, this.y - 120, 'TITAN ENRAGED!', '#ff1133');
      camera.addShake(0.7);
    }

    if (dist > 120) {
      this.vx = this.facing * currentSpeed;
      this.pose = 'run';
    } else {
      this.vx = 0;
      this.pose = 'attack_cross';
      if (this.attackCooldown <= 0) {
        this.titanSmash(player, camera);
      }
    }
  }

  applyPhysics(dt, groundY, sketchBlocks) {
    // Gravity
    this.vy += 950 * dt;
    if (this.hurtTimer > 0) {
      this.vx *= Math.pow(0.88, dt * 60);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Ground collision
    if (this.y >= groundY) {
      this.y = groundY;
      this.vy = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // Sketch Block and Platform collisions
    const allPlatforms = [...(sketchBlocks || []), ...(this.platforms || [])];
    if (allPlatforms.length > 0 && this.vy >= 0) {
      for (const b of allPlatforms) {
        const halfW = (b.width || 60) / 2;
        const bH = b.height || 60;
        const bTop = b.y - bH;
        if (this.x + this.radius > b.x - halfW &&
            this.x - this.radius < b.x + halfW &&
            this.y >= bTop && this.y <= bTop + 18) {
          this.y = bTop;
          this.vy = 0;
          this.isGrounded = true;
        }
      }
    }
  }

  bitePlayer(player) {
    this.attackCooldown = 1.2;
    audio.playZombieGroan();
    player.takeDamage(this.damage, this.facing, 250);
  }

  spitAcid(player) {
    this.attackCooldown = 2.4;
    audio.playSpitterSpit();
    const dx = player.x - this.x;
    const dy = (player.y - 30) - (this.y - 40);
    const dist = Math.hypot(dx, dy);
    const speed = 420;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed - 120;

    projectiles.spawnAcidBlob(this.x + this.facing * 20, this.y - 40, vx, vy);
  }

  bruteSlam(player, camera) {
    this.attackCooldown = 2.6;
    audio.playBruteStomp();
    camera.addShake(0.4);
    particles.addShockwave(this.x + this.facing * 40, this.y, 140, '#228833', 10);

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist < 150) {
      player.takeDamage(this.damage, this.facing, 500);
    }
  }

  titanSmash(player, camera) {
    this.attackCooldown = 2.2;
    audio.playBossRoar();
    camera.addShake(0.8);
    particles.addShockwave(this.x + this.facing * 50, this.y, 240, '#ff2244', 16);
    particles.createHitSparks(this.x, this.y, 25, '#ff3344');

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist < 220) {
      player.takeDamage(this.damage, this.facing, 700);
    }
  }

  takeDamage(amount, knockbackDir = 1, knockbackPower = 380, isCrit = false) {
    if (this.isDead) return;

    this.hp -= amount;
    this.isHurt = true;
    this.hurtTimer = 0.32; // Hit-stun duration
    this.windupTimer = 0; // Interrupt any pending attack immediately!
    this.attackCooldown = Math.max(this.attackCooldown, 0.5); // Delay next attack

    // Apply knockback
    this.vx = knockbackDir * knockbackPower;
    this.vy = -Math.min(knockbackPower * 0.35, 220);

    particles.addDamageText(this.x, this.y - this.height * 0.8, amount, isCrit);
    particles.createZombieSplatter(this.x, this.y - this.height * 0.5, 8, this.color);

    if (this.hp <= 0) {
      this.die();
    }
  }

  applyFreeze(duration = 4.0) {
    this.freezeTimer = Math.max(this.freezeTimer, duration);
  }

  applyStun(duration = 3.0) {
    this.stunTimer = Math.max(this.stunTimer, duration);
  }

  die(isFinisher = false) {
    this.isDead = true;
    this.hp = 0;
    combat.registerKill(this);
    audio.playZombieDeath();
    particles.createZombieSplatter(this.x, this.y - this.height * 0.5, 24, this.color);
    particles.addShockwave(this.x, this.y - 20, 60, this.color, 4);
    particles.createStickLimbExplosion(this.x, this.y, 0, this.color);

    if (Math.random() < 0.38) {
      speech.shout(this.x, this.y - 10, 'zombieGroan', null, 1.35, {
        anchor: this,
        anchorOffsetY: -54
      });
    }
  }

  draw(ctx) {
    if (this.isDead) return;

    // Freeze overlay
    const isFrozen = this.freezeTimer > 0;
    const isStunned = this.stunTimer > 0;

    // Draw stick zombie
    this.renderer.draw(ctx, {
      x: this.x,
      y: this.y,
      facing: this.facing,
      pose: this.isHurt ? 'idle' : this.pose,
      animTimer: this.animTimer,
      isGrounded: this.isGrounded,
      isHurt: this.isHurt,
      isAwakened: false,
      scale: 1.0,
      alpha: 1.0
    });

    // Spitter: Bubbling toxic acid vapor
    if (this.type === 'spitter') {
      ctx.fillStyle = '#64dd17';
      ctx.shadowColor = '#76ff03';
      ctx.shadowBlur = 8;
      const bubbleY = this.y - 35 + Math.sin(this.animTimer * 6) * 3;
      ctx.beginPath();
      ctx.arc(this.x + this.facing * 8, bubbleY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'brute') {
      // Brute: Heavy fist spikes
      ctx.fillStyle = '#37474f';
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x + this.facing * 16, this.y - 20, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Stunned stars above head
    if (isStunned) {
      ctx.fillStyle = '#ffea00';
      const angle = this.animTimer * 6;
      ctx.beginPath();
      ctx.arc(this.x + Math.cos(angle) * 16, this.y - this.height - 12 + Math.sin(angle) * 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Health bar above head for all non-boss damaged zombies
    if (this.type !== 'titan_boss' && this.hp < this.maxHp && this.hp > 0) {
      const barWidth = Math.max(44, 40 * this.scale);
      const barHeight = 5;
      const barY = this.y - this.height - 14;

      // Background border
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(this.x - barWidth / 2 - 1, barY - 1, barWidth + 2, barHeight + 2);

      // Red damage underfill
      ctx.fillStyle = '#d50000';
      ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);

      // Green active HP fill
      ctx.fillStyle = isFrozen ? '#00e5ff' : '#00e676';
      const fillW = Math.max(0, barWidth * (this.hp / this.maxHp));
      ctx.fillRect(this.x - barWidth / 2, barY, fillW, barHeight);
    }
  }
}
