// The Dark Lord (TDL) - Ultimate Wave 10 Boss Entity (Alan Becker AvA Lore)

import { StickFigureRenderer } from './stickman.js';
import { particles } from '../engine/particles.js';
import { audio } from '../engine/audio.js';
import { projectiles } from './projectiles.js';
import { combat } from '../systems/combat.js';

export class DarkLord {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;

    // Boss Identity & Stats
    this.type = 'dark_lord';
    this.name = 'THE DARK LORD (TDL)';
    this.isBoss = true;
    this.maxHp = 300;
    this.hp = this.maxHp;
    this.speed = 190;
    this.radius = 28;
    this.height = 70;
    this.color = '#ff1133';
    this.strokeWidth = 6;
    this.scale = 1.25;

    this.facing = -1;
    this.pose = 'idle';
    this.animTimer = 0;
    this.isDead = false;
    this.isHurt = false;
    this.hurtTimer = 0;
    this.isGrounded = true;

    // Multi-Phase State Machine
    this.phase = 1; // 1 = Standard, 2 = Enraged ViraBot Overcharge (<50% HP)
    this.state = 'idle'; // 'idle', 'teleport', 'blade_combo', 'energy_waves', 'summon_virabots', 'doom_laser', 'meteor_rise', 'meteor_slam'
    this.stateTimer = 0;
    this.actionCooldown = 1.0;
    this.isAwakened = false;

    // Attack Step Sub-state
    this.comboStep = 0;
    this.teleportTargetX = 0;

    // Rewards
    this.inkReward = 350;
    this.scoreReward = 5000;

    // Visual Renderer (Red Hollow Head with Vira-Blades)
    this.renderer = new StickFigureRenderer(this.color, this.strokeWidth, this.scale, true);
    this.renderer.glowColor = '#ff0033';
  }

  update(dt, groundY, player, sketchBlocks, camera, platforms = []) {
    if (this.isDead) return;

    this.animTimer += dt;
    this.platforms = platforms;

    // Check Phase 2 Transition (< 50% HP)
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.isAwakened = true;
      audio.playBossRoar();
      audio.setIntensity(1.0);
      if (camera) camera.addShake(0.8);
      particles.addShockwave(this.x, this.y - 30, 260, '#ff0033', 14);
      particles.addTextBanner(this.x, this.y - 80, '⚠️ VIRABOT OVERCHARGE! ⚠️', '#ff0033');
    }

    // Hit-Stun Decay
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) this.isHurt = false;
    }

    // State Execution
    this.updateAI(dt, groundY, player, camera, sketchBlocks);

    // Apply Physics
    this.applyPhysics(dt, groundY, sketchBlocks);
  }

  updateAI(dt, groundY, player, camera, sketchBlocks) {
    if (!player || player.isDead) {
      this.pose = 'idle';
      this.vx = 0;
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Default Facing
    if (this.state === 'idle' || this.state === 'walk') {
      this.facing = dx >= 0 ? 1 : -1;
    }

    // Cooldown countdown
    if (this.actionCooldown > 0) {
      this.actionCooldown -= dt;
    }

    // State Machine
    switch (this.state) {
      case 'idle': {
        this.pose = 'idle';
        this.vx *= Math.pow(0.01, dt * 10);

        if (this.actionCooldown <= 0) {
          this.chooseNextAttack(dist, player);
        }
        break;
      }

      case 'walk': {
        this.pose = 'run';
        this.vx = this.facing * (this.speed * (this.isAwakened ? 1.3 : 1.0));

        if (dist < 110) {
          this.startBladeCombo(player, camera);
        } else if (this.actionCooldown <= 0) {
          this.chooseNextAttack(dist, player);
        }
        break;
      }

      case 'teleport': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.vy = 0;

        if (this.stateTimer <= 0) {
          // Reappear at target
          this.x = this.teleportTargetX;
          this.facing = player.x >= this.x ? 1 : -1;
          audio.playTeleportZap();
          particles.createHitSparks(this.x, this.y - 35, 16, '#ff0033');
          particles.addShockwave(this.x, this.y - 20, 80, '#ff0033', 6);

          // Follow up with attack
          if (Math.random() < 0.6) {
            this.startBladeCombo(player, camera);
          } else {
            this.startEnergyWaves(player, camera);
          }
        }
        break;
      }

      case 'blade_combo': {
        this.stateTimer -= dt;
        this.pose = 'weapon_slash';

        if (this.stateTimer <= 0) {
          this.comboStep++;
          if (this.comboStep <= 3) {
            // Next strike in combo
            this.executeBladeSlash(this.comboStep, player, camera);
          } else {
            // Combo Finished
            this.state = 'idle';
            this.actionCooldown = this.isAwakened ? 0.6 : 1.2;
          }
        }
        break;
      }

      case 'energy_waves': {
        this.stateTimer -= dt;
        this.pose = 'weapon_slash';

        if (this.stateTimer <= 0) {
          this.comboStep++;
          if (this.comboStep <= 3) {
            // Fire crescent wave
            projectiles.spawnDarkEnergyWave(this.x + this.facing * 30, this.y - 35, this.facing, 24);
            particles.addSlashArc(this.x, this.y - 30, 90, 0, this.facing, '#ff0033', 8);
            if (camera) camera.addShake(0.2);
            this.stateTimer = 0.22;
          } else {
            this.state = 'idle';
            this.actionCooldown = 1.4;
          }
        }
        break;
      }

      case 'summon_virabots': {
        this.stateTimer -= dt;
        this.pose = 'awakening_god';
        this.vx = 0;

        if (this.stateTimer <= 0) {
          // Spawn 2-3 ViraBots
          const count = this.isAwakened ? 3 : 2;
          for (let i = 0; i < count; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            projectiles.spawnViraBot(this.x + side * (60 + i * 30), this.y, side);
          }
          particles.addTextBanner(this.x, this.y - 70, 'VIRABOT SWARM!', '#ff0044');
          this.state = 'idle';
          this.actionCooldown = 2.0;
        }
        break;
      }

      case 'doom_laser': {
        this.stateTimer -= dt;
        this.pose = 'awakening_god';
        this.vx = 0;

        // Charging particles gathering
        if (this.stateTimer > 1.2) {
          particles.createHitSparks(this.x + this.facing * 25, this.y - 45, 3, '#ff0033');
        }

        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.actionCooldown = 2.2;
        }
        break;
      }

      case 'meteor_rise': {
        this.stateTimer -= dt;
        this.pose = 'jump_rise';
        this.vy = -750;
        this.vx = (player.x - this.x) * 0.8;

        if (this.stateTimer <= 0 || this.y < -550) {
          // Reached peak -> plunge
          this.state = 'meteor_slam';
          this.x = player.x + (Math.random() - 0.5) * 40;
          this.y = -550;
          this.vy = 1200;
          this.vx = 0;
          this.pose = 'dive_kick';
          audio.playWhoosh();
        }
        break;
      }

      case 'meteor_slam': {
        this.pose = 'dive_kick';
        particles.createHitSparks(this.x, this.y, 4, '#ff0033');

        if (this.y >= groundY) {
          // Crash impact on ground!
          this.y = groundY;
          this.vy = 0;
          audio.playBruteStomp();
          audio.playFinisherImpact();
          if (camera) camera.addShake(0.7);

          particles.addShockwave(this.x, groundY, 240, '#ff0033', 14);
          particles.createHitSparks(this.x, groundY - 20, 25, '#ff0033');

          // Ground damage to player
          if (player && !player.isRolling && !player.isAwakened) {
            const hitDist = Math.hypot(player.x - this.x, player.y - groundY);
            if (hitDist < 200) {
              player.takeDamage(32, player.x >= this.x ? 1 : -1, 600);
            }
          }

          this.state = 'idle';
          this.actionCooldown = 1.6;
        }
        break;
      }
    }
  }

  chooseNextAttack(dist, player) {
    const roll = Math.random();

    if (this.phase === 2 && roll < 0.3) {
      // Phase 2: Doom Laser Beam
      this.startDoomLaser(player);
    } else if (this.phase === 2 && roll < 0.55) {
      // Phase 2: Meteor Plunge
      this.state = 'meteor_rise';
      this.stateTimer = 0.5;
      audio.playJump();
    } else if (roll < 0.35) {
      // Teleport Ambush
      this.startTeleport(player);
    } else if (roll < 0.65) {
      // Triple Crescent Energy Waves
      this.startEnergyWaves(player);
    } else if (roll < 0.85) {
      // Summon ViraBots
      this.state = 'summon_virabots';
      this.stateTimer = 0.6;
      audio.playViraBotSpawn();
    } else {
      // Walk towards player for melee combo
      this.state = 'walk';
      this.actionCooldown = 1.5;
    }
  }

  startTeleport(player) {
    this.state = 'teleport';
    this.stateTimer = 0.25;
    audio.playTeleportZap();
    particles.createHitSparks(this.x, this.y - 35, 14, '#ff0033');

    // Teleport behind or beside player
    const side = Math.random() > 0.5 ? 1 : -1;
    this.teleportTargetX = Math.max(-900, Math.min(900, player.x + side * (85 + Math.random() * 40)));
  }

  startBladeCombo(player, camera) {
    this.state = 'blade_combo';
    this.comboStep = 1;
    this.executeBladeSlash(1, player, camera);
  }

  executeBladeSlash(step, player, camera) {
    this.stateTimer = 0.26;
    audio.playDarkBladeSlash();
    this.vx = this.facing * 220;

    const damage = (20 + step * 6);
    const range = 110;

    particles.addSlashArc(this.x, this.y - 30, range * 0.85, 0, this.facing, '#ff0033', 10);
    if (camera) camera.addShake(0.2);

    // Hit detection with player
    if (player && !player.isRolling && !player.isAwakened) {
      const dx = player.x - this.x;
      const dy = (player.y - 30) - (this.y - 35);
      const isAhead = (this.facing > 0 && dx > -30) || (this.facing < 0 && dx < 30);

      if (isAhead && Math.hypot(dx, dy) < range + 25) {
        player.takeDamage(damage, this.facing, 450);
        particles.createHitSparks(player.x, player.y - 30, 8, '#ff0033');
      }
    }
  }

  startEnergyWaves(player, camera) {
    this.state = 'energy_waves';
    this.comboStep = 0;
    this.stateTimer = 0.1;
  }

  startDoomLaser(player) {
    this.state = 'doom_laser';
    this.stateTimer = 2.0;
    this.y -= 35; // Hover in air
    this.vy = 0;
    audio.playDoomLaserCharge();
    particles.addTextBanner(this.x, this.y - 70, '⚡ DOOM LASER! ⚡', '#ff0033');

    setTimeout(() => {
      if (!this.isDead && this.state === 'doom_laser') {
        projectiles.spawnDarkDoomLaser(this.x + this.facing * 20, this.y - 45, this.facing, 1.2, 50);
      }
    }, 700);
  }

  applyPhysics(dt, groundY, sketchBlocks) {
    // Skip ground pinning if hovering during laser or soaring in meteor rise
    if (this.state !== 'doom_laser' && this.state !== 'meteor_rise') {
      this.vy += 950 * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;

      if (this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.isGrounded = true;
      }
    } else {
      this.x += this.vx * dt;
    }

    // Arena boundary clamp
    this.x = Math.max(-980, Math.min(980, this.x));
  }

  takeDamage(amount, knockbackDir = 1, knockbackPower = 200, isCrit = false) {
    if (this.isDead) return;

    this.hp = Math.max(0, this.hp - amount);
    this.isHurt = true;
    this.hurtTimer = 0.15; // Shorter hit stun for boss resistance

    // Boss knockback resistance
    this.vx = knockbackDir * (knockbackPower * 0.35);

    particles.addDamageText(this.x, this.y - this.height * 0.8, amount, isCrit, '#ff2244');
    particles.createHitSparks(this.x, this.y - this.height * 0.5, 6, '#ff0033');

    // Teleport counter chance when heavily combo'd
    if (Math.random() < 0.15 && this.state === 'idle') {
      this.startTeleport({ x: this.x + (Math.random() - 0.5) * 300 });
    }

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.isDead = true;
    this.hp = 0;
    combat.registerKill(this);
    audio.playBossVictoryFanfare();
    audio.playZombieDeath();

    particles.createHitSparks(this.x, this.y - 35, 50, '#ff0033');
    particles.addShockwave(this.x, this.y - 20, 200, '#ff0033', 14);
    particles.addTextBanner(this.x, this.y - 90, '★ THE DARK LORD DEFEATED! ★', '#ffee00');
  }

  draw(ctx) {
    if (this.isDead) return;

    // Dark crimson aura particles
    if (this.isAwakened || this.state === 'doom_laser') {
      if (Math.random() < 0.6) {
        particles.createHitSparks(this.x + (Math.random() - 0.5) * 30, this.y - 30 + (Math.random() - 0.5) * 40, 1, '#ff0033');
      }
    }

    // Draw Dark Lord Stick Figure with Dual Vira-Blades
    this.renderer.draw(ctx, {
      x: this.x,
      y: this.y,
      facing: this.facing,
      pose: this.pose,
      animTimer: this.animTimer,
      isGrounded: this.isGrounded,
      isHurt: this.isHurt,
      isAwakened: this.isAwakened,
      weaponType: 'vira_blades',
      scale: 1.0,
      alpha: 1.0
    });
  }
}
