// Player Entity: The Second Coming (Orange Stick Figure)

import { StickFigureRenderer } from './stickman.js';
import { particles } from '../engine/particles.js';
import { audio } from '../engine/audio.js';
import { projectiles } from './projectiles.js';
import { weapons } from './weapons.js';
import { allies } from './allies.js';
import { combat } from '../systems/combat.js';

export class Player {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;

    // Dimensions
    this.width = 24;
    this.height = 64;
    this.radius = 18;

    // Movement Parameters
    this.speed = 340;
    this.jumpForce = 580;
    this.facing = 1; // 1 = right, -1 = left
    this.isGrounded = false;
    this.isCrouching = false;
    this.isWallSliding = false;
    this.wallDir = 0;

    // Jump Enhancements
    this.canDoubleJump = true;
    this.coyoteTimer = 0;
    this.jumpBuffer = 0;

    // Health & Stats
    this.maxHp = 100;
    this.hp = 100;
    this.isDead = false;
    this.deathTimer = 0;
    this.isHurt = false;
    this.hurtTimer = 0;
    this.iFrames = 0;

    // Stats Upgrades Multipliers
    this.damageMultiplier = 1.0;
    this.lifesteal = 0.0; // % of damage returned as HP
    this.superGainRate = 1.0;

    // Awakening / Super Meter
    this.superMeter = 0; // 0 to 100
    this.maxSuper = 100;
    this.isAwakened = false;
    this.awakenedTimer = 0;
    this.awakenedDuration = 12.0;

    // Dodge Roll
    this.isRolling = false;
    this.rollTimer = 0;
    this.rollDuration = 0.35;
    this.rollCooldown = 0;

    // Block / Anvil Skill Cooldown
    this.blockCooldown = 0;

    // Attack Combo System
    this.comboStep = 0;
    this.comboResetTimer = 0;
    this.attackTimer = 0;
    this.weaponType = 'pencil'; // 'pencil', 'staff', 'eraser'
    this.weaponTimer = 0;
    this.diveKick = false;

    // Pose & Renderer
    this.pose = 'idle';
    this.animTimer = 0;
    this.renderer = new StickFigureRenderer('#ff7700', 5.5, 1.0, true); // Hollow head for Orange!

    // Ghost Trails for Dodge Roll / Awakening
    this.ghostTrails = [];
  }

  update(dt, input, groundY, sketchBlocks, zombies, camera, platforms = []) {
    if (this.isDead) {
      this.deathTimer -= dt;
      this.vy += 900 * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      if (this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.vx = 0;
      }
      return;
    }

    this.platforms = platforms;
    this.animTimer += dt;

    // Update Timers
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) this.isHurt = false;
    }
    if (this.iFrames > 0) this.iFrames -= dt;
    if (this.rollCooldown > 0) this.rollCooldown -= dt;
    if (this.blockCooldown > 0) this.blockCooldown -= dt;
    if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;

    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 0;
    }

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.weaponTimer > 0) this.weaponTimer -= dt;

    // Handle Awakening Mode
    if (this.isAwakened) {
      this.awakenedTimer -= dt;
      particles.createAwakeningAura(this.x, this.y - 30, 2);

      if (this.awakenedTimer <= 0) {
        this.deactivateAwakening();
      }
    }

    // Update and decay Ghost Trails
    for (let i = this.ghostTrails.length - 1; i >= 0; i--) {
      const ghost = this.ghostTrails[i];
      ghost.alpha -= dt * 3.5;
      if (ghost.alpha <= 0) {
        this.ghostTrails.splice(i, 1);
      }
    }

    // Spawn new ghost trail when rolling or awakened or high speed
    if (this.isRolling || this.isAwakened || Math.abs(this.vx) > 350) {
      if (this.ghostTrails.length < 6 && Math.random() > 0.4) {
        this.ghostTrails.push({
          x: this.x,
          y: this.y,
          facing: this.facing,
          pose: this.pose,
          timer: this.animTimer,
          alpha: 0.45
        });
      }
    }

    if (this.isRolling) {
      if (this.rollTimer <= 0) {
        this.isRolling = false;
      }
    } else {
      // 2. Normal Movement & Controls
      this.handleMovement(dt, input, groundY, sketchBlocks);
      this.handleCombatInputs(input, zombies, camera, groundY);
      this.handleSkillsAndAllies(input, groundY, camera, zombies);
    }

    // 3. Apply Physics
    this.applyPhysics(dt, groundY, sketchBlocks);

    // 4. Update Animation Pose if not attacking or rolling
    this.updatePose();
  }

  handleMovement(dt, input, groundY, sketchBlocks) {
    let moveDir = 0;
    if (input.actions.left) moveDir -= 1;
    if (input.actions.right) moveDir += 1;

    // Horizontal Movement
    const maxSpeed = this.speed * (this.isAwakened ? 1.4 : 1.0);
    const accel = this.isGrounded ? 2200 : 1400;
    const friction = this.isGrounded ? 1800 : 600;

    if (moveDir !== 0) {
      this.vx += moveDir * accel * dt;
      this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
      this.facing = moveDir;

      // Dust puff while running
      if (this.isGrounded && Math.random() < 0.15) {
        particles.createDust(this.x, this.y, 2, this.facing);
      }
    } else {
      // Friction deceleration
      if (this.vx > 0) {
        this.vx = Math.max(0, this.vx - friction * dt);
      } else if (this.vx < 0) {
        this.vx = Math.min(0, this.vx + friction * dt);
      }
    }

    // Crouch & Drop Down
    this.isCrouching = input.actions.down && this.isGrounded;

    // Dodge Roll Input
    if (input.actions.rollPressed && this.rollCooldown <= 0) {
      this.isRolling = true;
      this.rollTimer = this.rollDuration;
      this.rollCooldown = 0.65;
      this.iFrames = this.rollDuration + 0.05;
      audio.playDodge();
      particles.createDust(this.x, this.y, 6, this.facing);
      return;
    }

    // Jump Buffering
    if (input.actions.jumpPressed) {
      this.jumpBuffer = 0.15;
    }

    // Execute Jump
    if (this.jumpBuffer > 0) {
      if (this.isGrounded || this.coyoteTimer > 0) {
        // Normal Jump
        this.vy = -this.jumpForce;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBuffer = 0;
        this.canDoubleJump = true;
        audio.playJump();
        particles.createDust(this.x, this.y, 6);
      } else if (this.isWallSliding) {
        // Wall Jump
        this.vy = -this.jumpForce * 0.95;
        this.vx = -this.wallDir * 420;
        this.facing = -this.wallDir;
        this.isWallSliding = false;
        this.jumpBuffer = 0;
        this.canDoubleJump = true;
        audio.playJump();
        particles.createDust(this.x, this.y - 20, 8, this.facing);
      } else if (this.canDoubleJump) {
        // Double Jump (Backflip spin)
        this.vy = -this.jumpForce * 0.88;
        this.canDoubleJump = false;
        this.jumpBuffer = 0;
        audio.playJump();
        particles.createHitSparks(this.x, this.y, 6, '#ffa500');
      }
    }

    // Variable jump height: release early cuts upward velocity
    if (!input.actions.jump && this.vy < -150) {
      this.vy += 900 * dt;
    }
  }

  handleCombatInputs(input, zombies, camera, groundY) {
    // 1. Air Dive Kick (Space/Down + Attack)
    if (!this.isGrounded && input.actions.down && (input.actions.attackPressed || input.actions.weaponPressed)) {
      this.diveKick = true;
      this.vy = 850;
      this.vx = this.facing * 350;
      this.pose = 'dive_kick';
      audio.playWhoosh();
      return;
    }

    // 2. Light Martial Arts Combo Chain (J / Left Click)
    if (input.actions.attackPressed && this.attackTimer <= 0) {
      this.executeLightCombo(zombies, camera);
    }

    // 3. Heavy / Weapon Attack (K / Right Click)
    if (input.actions.weaponPressed && this.weaponTimer <= 0) {
      this.executeWeaponAttack(zombies, camera);
    }

    // 4. Awakening Mode Laser / Screen Blast
    if (this.isAwakened && input.actions.weapon) {
      this.fireAwakeningLaser(zombies, camera);
    }
  }

  executeLightCombo(zombies, camera) {
    this.comboStep = (this.comboStep % 4) + 1;
    this.comboResetTimer = 0.9;
    this.attackTimer = 0.18;

    // Small forward step impulse
    this.vx = this.facing * 140;

    let damage = 22 * (this.damageMultiplier || 1.0);
    let knockback = 380;
    let hitRadius = 95;
    let hitSparkColor = '#ffea00';
    let isCrit = false;

    if (this.comboStep === 1) {
      this.pose = 'attack_jab';
      audio.playPunch('light');
      audio.playPlayerEffort();
    } else if (this.comboStep === 2) {
      this.pose = 'attack_cross';
      audio.playPunch('light');
      audio.playPlayerEffort();
      damage *= 1.4;
      hitRadius = 105;
      knockback = 480;
      this.vx = this.facing * 200;
    } else if (this.comboStep === 3) {
      this.pose = 'attack_kick';
      audio.playWhoosh();
      audio.playPunch('light');
      audio.playPlayerEffort();
      damage *= 1.8;
      hitRadius = 125;
      knockback = 580;
    } else if (this.comboStep === 4) {
      this.pose = 'attack_spin';
      audio.playFinisherImpact();
      audio.playPunch('heavy');
      camera.addShake(0.35);
      damage *= 3.0;
      knockback = 750;
      hitRadius = 145;
      isCrit = true;
      this.iFrames = 0.2; // Hyper-armor on spin finisher
      hitSparkColor = '#ff5533';
      particles.addSlashArc(this.x, this.y - 30, 95, 0, this.facing, '#ffaa00', 8);
    }

    // Hit detection for zombies
    this.checkMeleeHits(zombies, hitRadius, damage, knockback, isCrit, hitSparkColor, camera);
  }

  executeWeaponAttack(zombies, camera) {
    const stats = weapons.getWeaponStats(this.weaponType);
    this.weaponTimer = stats.cooldown || 0.35;
    this.pose = 'weapon_slash';
    this.vx = this.facing * 240;
    this.iFrames = 0.2; // Brief hyper-armor

    audio.playSlash();
    audio.playPlayerEffort();
    camera.addShake(0.3);
    const range = 160; // Wide reach for giant pencil
    particles.addSlashArc(this.x, this.y - 30, range * 0.85, 0, this.facing, '#ff7700', 10);

    const damage = (stats.damage || 45) * (this.damageMultiplier || 1.0) * (this.isAwakened ? 2.0 : 1.0);
    this.checkMeleeHits(zombies, range, damage, 650, true, '#ffaa00', camera);
  }

  fireAwakeningLaser(zombies, camera) {
    camera.addShake(0.15);
    audio.playLaserBeam();

    const beamStartX = this.x + this.facing * 20;
    const beamY = this.y - 48;
    const beamLength = 850;

    particles.addShockwave(beamStartX, beamY, 20, '#ffffff', 4);
    particles.createHitSparks(beamStartX + this.facing * (Math.random() * beamLength), beamY, 4, '#ffee33');

    // Laser Hitscan
    for (const z of zombies) {
      if (z.isDead) continue;
      const isAhead = (this.facing > 0 && z.x > beamStartX && z.x < beamStartX + beamLength) ||
                      (this.facing < 0 && z.x < beamStartX && z.x > beamStartX - beamLength);
      if (isAhead && Math.abs(z.y - beamY) < 70) {
        const dmg = 24 * (this.damageMultiplier || 1.0);
        z.takeDamage(dmg, this.facing, 500, true);
        combat.registerHit(dmg, true);
      }
    }
  }

  checkMeleeHits(zombies, range, damage, knockback, isCrit, sparkColor, camera) {
    if (!zombies || !Array.isArray(zombies)) return;
    let hitAny = false;

    for (const z of zombies) {
      if (z.isDead) continue;

      const dx = z.x - this.x;
      const dy = z.y - this.y;
      // Hit if zombie is in front or within close range
      const isFacingTarget = (this.facing > 0 && dx > -45) || (this.facing < 0 && dx < 45) || Math.abs(dx) < 35;

      if (isFacingTarget && Math.hypot(dx, dy) < range + (z.radius || 20) + 40) {
        hitAny = true;
        z.takeDamage(damage, this.facing, knockback, isCrit);
        combat.registerHit(damage, isCrit);
        particles.createHitSparks(z.x, z.y - (z.height || 50) * 0.5, isCrit ? 12 : 6, sparkColor);

        // Add Awakening Super charge
        this.addSuper(5.0 * this.superGainRate);

        // Lifesteal
        if (this.lifesteal > 0) {
          const healAmount = damage * this.lifesteal;
          this.heal(healAmount);
        }
      }
    }

    if (hitAny && camera) {
      camera.addHitstop(isCrit ? 0.08 : 0.04);
    }
  }

  handleSkillsAndAllies(input, groundY, camera, zombies) {
    // 1. Spawn Sketch Block / Anvil (E)
    if (input.actions.blockPressed && this.blockCooldown <= 0) {
      this.blockCooldown = 3.5;
      projectiles.spawnSketchBlock(this.x + this.facing * 75, this.y - 120, this.facing);
      audio.playBlockPlace();
      audio.playPlayerEffort();
    }

    // 2. Activate Awakening God Mode (R)
    if (input.actions.superPressed && this.superMeter >= this.maxSuper && !this.isAwakened) {
      this.activateAwakening(camera);
    }

    // 3. Summon Stick Allies & Mouse Cursor (1, 2, 3, 4, 5)
    if (input.actions.ally1) allies.summonAlly('red', this.x, groundY, this.facing, zombies);
    if (input.actions.ally2) allies.summonAlly('blue', this.x, groundY, this.facing, zombies);
    if (input.actions.ally3) allies.summonAlly('yellow', this.x, groundY, this.facing, zombies);
    if (input.actions.ally4) allies.summonAlly('green', this.x, groundY, this.facing, zombies);
    if (input.actions.ally5) allies.summonAlly('cursor', this.x, groundY, this.facing, zombies);
  }

  applyPhysics(dt, groundY, sketchBlocks) {
    // Dive Kick Ground Collision
    if (this.diveKick) {
      this.y += this.vy * dt;
      if (this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.diveKick = false;
        audio.playPunch('heavy');
        particles.addShockwave(this.x, groundY, 150, '#ffaa00', 10);
        particles.createDust(this.x, groundY, 14);
      }
      return;
    }

    // Gravity
    const gravity = this.isAwakened ? 600 : 1300;
    this.vy += gravity * dt;

    // Movement integration
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Ground collision
    if (this.y >= groundY) {
      if (!this.isGrounded && this.vy > 100) {
        audio.playLand();
        particles.createDust(this.x, groundY, 4);
      }
      this.y = groundY;
      this.vy = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.12;
      this.canDoubleJump = true;
      this.isWallSliding = false;
    } else {
      this.isGrounded = false;
    }

    // Arena Boundary Clamping and Wall Sliding
    const arenaBound = 1180;
    if (this.x <= -arenaBound) {
      this.x = -arenaBound;
      if (!this.isGrounded && this.vy > 0) {
        if (!this.isWallSliding) audio.playWallKick();
        this.isWallSliding = true;
        this.wallDir = -1;
        this.vy = Math.min(this.vy, 140); // Slide slowly
        if (Math.random() < 0.25) particles.createHitSparks(this.x + 8, this.y - 20, 2, '#ffa500');
      }
    } else if (this.x >= arenaBound) {
      this.x = arenaBound;
      if (!this.isGrounded && this.vy > 0) {
        if (!this.isWallSliding) audio.playWallKick();
        this.isWallSliding = true;
        this.wallDir = 1;
        this.vy = Math.min(this.vy, 140); // Slide slowly
        if (Math.random() < 0.25) particles.createHitSparks(this.x - 8, this.y - 20, 2, '#ffa500');
      }
    } else {
      this.isWallSliding = false;
    }

    // Platforms and Sketch Block collisions (standing on platforms)
    const allPlatforms = [...(sketchBlocks || []), ...(this.platforms || [])];
    if (allPlatforms.length > 0 && this.vy >= 0 && !this.isCrouching) {
      for (const b of allPlatforms) {
        const halfW = (b.width || 60) / 2;
        const bH = b.height || 60;
        const bTop = b.y - bH;
        if (this.x + 12 > b.x - halfW &&
            this.x - 12 < b.x + halfW &&
            this.y >= bTop && this.y <= bTop + 18) {
          if (!this.isGrounded && this.vy > 100) audio.playLand();
          this.y = bTop;
          this.vy = 0;
          this.isGrounded = true;
          this.canDoubleJump = true;
          this.isWallSliding = false;
        }
      }
    }
  }

  updatePose() {
    if (this.isRolling || this.diveKick) return;

    if (this.attackTimer > 0 || this.weaponTimer > 0) {
      // Retain attack pose while attacking
      return;
    }

    if (this.isAwakened) {
      this.pose = 'awakening_god';
      return;
    }

    if (this.isGrounded) {
      if (this.isCrouching) {
        this.pose = 'crouch';
      } else if (Math.abs(this.vx) > 20) {
        this.pose = 'run';
      } else {
        this.pose = 'idle';
      }
    } else {
      if (this.isWallSliding) {
        this.pose = 'wall_slide';
      } else if (this.vy < -50) {
        this.pose = 'jump_rise';
      } else {
        this.pose = 'jump_fall';
      }
    }
  }

  takeDamage(amount, knockbackDir = 0, knockbackPower = 300) {
    if (this.isDead || this.iFrames > 0 || this.isRolling || this.isAwakened) return;

    this.hp = Math.max(0, this.hp - amount);
    this.isHurt = true;
    this.hurtTimer = 0.25;
    this.iFrames = 0.9; // Solid invulnerability frames to prevent spam hits

    // Knockback
    if (knockbackDir !== 0) {
      this.vx = knockbackDir * knockbackPower;
      this.vy = -knockbackPower * 0.4;
    }

    audio.playPlayerHurt();
    audio.playPunch('heavy');
    particles.addDamageText(this.x, this.y - 40, amount, false, '#ff3344');
    particles.createHitSparks(this.x, this.y - 30, 8, '#ff3344');

    if (this.hp <= 0) {
      this.die();
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addSuper(amount) {
    if (this.isAwakened) return;
    this.superMeter = Math.min(this.maxSuper, this.superMeter + amount);
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.hp = 0;
    this.deathTimer = 1.0;
    this.pose = 'hurt';
    this.vy = -320;
    this.vx = -this.facing * 140;
    audio.playZombieDeath();
    particles.createHitSparks(this.x, this.y - 30, 25, '#ff7700');
    particles.addShockwave(this.x, this.y - 20, 100, '#ff7700', 8);
    particles.addTextBanner(this.x, this.y - 60, '💀 DEFEATED! 💀', '#ff2244');
  }

  draw(ctx) {
    if (this.isDead) {
      this.renderer.draw(ctx, {
        x: this.x,
        y: this.y,
        facing: this.facing,
        pose: 'hurt',
        animTimer: this.animTimer,
        isGrounded: this.isGrounded,
        isHurt: true,
        isAwakened: false,
        scale: 1.0,
        alpha: Math.max(0.2, this.deathTimer / 1.0)
      });
      return;
    }

    // Draw Ghost Trails
    for (const ghost of this.ghostTrails) {
      this.renderer.draw(ctx, {
        x: ghost.x,
        y: ghost.y,
        facing: ghost.facing,
        pose: ghost.pose,
        animTimer: ghost.timer,
        isGrounded: true,
        isHurt: false,
        isAwakened: this.isAwakened,
        scale: 1.0,
        alpha: ghost.alpha
      });
    }

    // Flicker when in iFrames
    if (this.iFrames > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
      return;
    }

    // Draw Hero Stick Figure
    this.renderer.draw(ctx, {
      x: this.x,
      y: this.y,
      facing: this.facing,
      pose: this.pose,
      animTimer: this.animTimer,
      isGrounded: this.isGrounded,
      isHurt: this.isHurt,
      isAwakened: this.isAwakened,
      weaponType: this.weaponType,
      scale: 1.0,
      alpha: 1.0
    });

    // Awakening Laser Beam Ray
    if (this.isAwakened && this.pose !== 'roll') {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#ffee00';
      ctx.shadowBlur = 20;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(this.x + this.facing * 16, this.y - 48);
      ctx.lineTo(this.x + this.facing * 850, this.y - 48);
      ctx.stroke();
      ctx.restore();
    }
  }
}
