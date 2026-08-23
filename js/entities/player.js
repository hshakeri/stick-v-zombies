import { StickFigureRenderer } from './stickman.js';
import { particles } from '../engine/particles.js';
import { audio } from '../engine/audio.js';
import { projectiles } from './projectiles.js';
import { weapons } from './weapons.js';
import { allies } from './allies.js';
import { combat } from '../systems/combat.js';
import { speech } from '../engine/speech.js';

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
    this.squashX = 1.0;
    this.squashY = 1.0;
    this.leanAngle = 0;
    this.renderer = new StickFigureRenderer('#ff7700', 5.5, 1.0, true); // Hollow head for Orange!

    // Ghost Trails for Dodge Roll / Awakening
    this.ghostTrails = [];
    this.airJuggleTarget = null;
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

    // Smooth Squash & Stretch elastic recovery
    this.squashX += (1.0 - this.squashX) * Math.min(1, 14.0 * dt);
    this.squashY += (1.0 - this.squashY) * Math.min(1, 14.0 * dt);

    // Dynamic sprint lean angle
    const targetLean = this.isGrounded ? (this.vx / 450) * 0.16 : (this.vx / 600) * 0.08;
    this.leanAngle += (targetLean - this.leanAngle) * Math.min(1, 12.0 * dt);

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

    if (this.rollTimer > 0) {
      this.rollTimer -= dt;
      if (this.rollTimer <= 0) {
        this.isRolling = false;
      }
    }

    if (this.isRolling) {
      this.vx = this.facing * 480;
      this.pose = 'roll';
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
        this.squashX = 0.82;
        this.squashY = 1.22;
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
        this.squashX = 0.85;
        this.squashY = 1.20;
        audio.playJump();
        particles.createDust(this.x, this.y - 20, 8, this.facing);
      } else if (this.canDoubleJump) {
        // Double Jump (Backflip spin)
        this.vy = -this.jumpForce * 0.88;
        this.canDoubleJump = false;
        this.jumpBuffer = 0;
        this.squashX = 0.80;
        this.squashY = 1.26;
        audio.playJump();
        particles.addShockwave(this.x, this.y - 20, 50, '#ffa500', 4);
        particles.createHitSparks(this.x, this.y, 8, '#ffa500');
      }
    }

    // Variable jump height: release early cuts upward velocity
    if (!input.actions.jump && this.vy < -150) {
      this.vy += 900 * dt;
    }
  }

  handleCombatInputs(input, zombies, camera, groundY) {
    // 1. Zombie Vector Grab & Bowling Throw (F / G or Q+W in melee range)
    if (input.actions.grabPressed || (input.actions.attackPressed && input.actions.weaponPressed)) {
      if (this.executeGrabAndThrow(zombies, camera)) {
        return;
      }
    }

    // 2. EX Charged Pencil Javelin (Down + W / Weapon)
    if (input.actions.down && input.actions.weaponPressed && this.weaponTimer <= 0) {
      this.executeJavelinThrow(zombies, camera);
      return;
    }

    // 3. Air-Chase Flash Step (Jump or Attack during Airborne Juggle)
    if (!this.isGrounded && (input.actions.jumpPressed || input.actions.attackPressed) && this.airJuggleTarget && !this.airJuggleTarget.isDead) {
      this.executeAirChase(zombies, camera);
      return;
    }

    // 4. Air Dive Kick (Mid-air + Down + Attack/Weapon)
    if (!this.isGrounded && input.actions.down && (input.actions.attackPressed || input.actions.weaponPressed)) {
      this.diveKick = true;
      this.vy = 880;
      this.vx = this.facing * 380;
      this.pose = 'dive_kick';
      this.squashX = 0.85;
      this.squashY = 1.25;
      audio.playWhoosh();
      audio.playBassDrop();
      particles.addComicPopup(this.x, this.y - 15, 'DIVE!', '#ff3300', '#ffff00');
      if (Math.random() < 0.4) speech.shout(this.x, this.y, 'playerAttack');
      return;
    }

    // 5. Rising Dragon Uppercut (Up + Attack)
    if (input.actions.up && input.actions.attackPressed && this.attackTimer <= 0) {
      this.executeRisingUppercut(zombies, camera);
      return;
    }

    // 6. Mid-Air Flurry Kicks (In mid-air + Attack)
    if (!this.isGrounded && input.actions.attackPressed && this.attackTimer <= 0) {
      this.executeAirFlurry(zombies, camera);
      return;
    }

    // 7. Dodge Roll Follow-up Slide Sweep (Rolling + Attack/Weapon)
    if (this.isRolling && (input.actions.attackPressed || input.actions.weaponPressed)) {
      this.executeSlideSweep(zombies, camera);
      return;
    }

    // 8. Light Martial Arts Combo Chain (Q / J / Left Click)
    if (input.actions.attackPressed && this.attackTimer <= 0) {
      this.executeLightCombo(zombies, camera);
    }

    // 9. Heavy / Hybrid Weapon Attack (W / K / Right Click)
    if (input.actions.weaponPressed && this.weaponTimer <= 0) {
      this.executeWeaponAttack(zombies, camera);
    }

    // 10. Awakening Mode Laser / Screen Blast
    if (this.isAwakened && input.actions.weapon) {
      this.fireAwakeningLaser(zombies, camera);
    }
  }

  executeGrabAndThrow(zombies, camera) {
    if (!zombies || !Array.isArray(zombies)) return false;
    let target = null;
    let minDist = 135; // Generous grab range

    for (const z of zombies) {
      if (z.isDead) continue;
      const dist = Math.hypot(z.x - this.x, z.y - this.y);
      if (dist < minDist) {
        minDist = dist;
        target = z;
      }
    }

    if (!target) return false;

    // Turn toward target
    this.facing = target.x >= this.x ? 1 : -1;

    // Grab & Rip Apart execution
    this.attackTimer = 0.35;
    this.pose = 'attack_spin';
    this.vx = this.facing * 220;
    this.squashX = 1.4;
    this.squashY = 0.7;

    // Audio & Camera Shake Juice
    audio.playSlash();
    audio.playFinisherImpact();
    audio.playBassDrop();
    audio.playGrabThrow();
    if (camera) {
      camera.addShake(0.65);
      camera.addHitstop(0.12);
    }
    particles.triggerSpeedlines(0.35);

    // 1. Violent Blood Ink Fountain & Shockwaves
    particles.addShockwave(target.x, target.y - 20, 160, '#ff1133', 12);
    particles.createZombieSplatter(target.x, target.y - 25, 45, target.color);

    // 2. RIP APART: Exploding severed stick limbs & torso flying in all directions
    particles.createStickLimbExplosion(target.x, target.y, 0, target.color);

    // 3. Severed head launched high into the air
    particles.limbDebris.push({
      x: target.x,
      y: target.y - 45,
      vx: this.facing * (450 + Math.random() * 250),
      vy: -400 - Math.random() * 250,
      groundY: 0,
      rotation: 0,
      rotSpeed: this.facing * 25,
      isHead: true,
      radius: 11,
      color: target.color,
      life: 2.2,
      maxLife: 2.2
    });

    // 4. Comic Onomatopoeia Banner
    const ripBanners = ['RIPPED APART!!', 'BRUTAL TEAR!!', 'FATALITY!!', 'DISMEMBERED!!'];
    const bannerText = ripBanners[Math.floor(Math.random() * ripBanners.length)];
    particles.addComicPopup(this.x + this.facing * 60, this.y - 45, bannerText, '#ff0033', '#ffffff');

    // 5. Instantly kill target and spawn lower body bowling projectile that wipes out enemy lines
    target.die(true);
    projectiles.spawnThrownZombie(this.x + this.facing * 40, this.y - 30, this.facing, 140);
    speech.shout(this.x, this.y, 'playerAttack');
    return true;
  }

  executeJavelinThrow(zombies, camera) {
    this.weaponTimer = 0.45;
    this.pose = 'attack_drill_thrust';
    this.vx = -this.facing * 120; // Recoil step
    this.squashX = 0.8;
    this.squashY = 1.25;
    audio.playSlash();
    audio.playBassDrop();
    camera.addShake(0.35);
    particles.triggerSpeedlines(0.22);
    particles.addComicPopup(this.x + this.facing * 60, this.y - 30, 'KRAK!', '#ff6600', '#ffffff');
    projectiles.spawnJavelin(this.x + this.facing * 40, this.y - 30, this.facing, 95);
    speech.shout(this.x, this.y, 'playerAttack');
  }

  executeAirChase(zombies, camera) {
    const target = this.airJuggleTarget;
    this.airJuggleTarget = null;
    this.attackTimer = 0.35;

    // Flash-step teleport right beside airborne target
    audio.playFlashStep();
    audio.playBassDrop();
    particles.triggerSpeedlines(0.25);
    particles.addComicPopup(target.x, target.y - 30, 'AIR RAVE!!', '#00e5ff', '#ffffff');

    // Spawn afterimages
    for (let i = 0; i < 3; i++) {
      this.ghostTrails.push({
        x: this.x + (target.x - this.x) * (i / 3),
        y: this.y + (target.y - this.y) * (i / 3),
        facing: this.facing,
        pose: 'attack_air_flurry',
        timer: this.animTimer,
        alpha: 0.8
      });
    }

    this.x = target.x - this.facing * 25;
    this.y = target.y - 30;
    this.vy = -180;
    this.vx = this.facing * 120;
    this.pose = 'attack_air_flurry';
    camera.addShake(0.35);

    // Multi-hit aerial damage and launch meteor slam
    const damage = 65 * (this.damageMultiplier || 1.0);
    target.takeDamage(damage, this.facing, 450, true);
    target.vy = 850; // Slam zombie to floor!
    particles.createHitSparks(target.x, target.y, 14, '#ffdd00');
    speech.shout(this.x, this.y, 'playerAttack');
  }

  executeRisingUppercut(zombies, camera) {
    this.attackTimer = 0.32;
    this.pose = 'attack_uppercut';
    this.vy = -560; // Launch airborne
    this.vx = this.facing * 180;
    this.isGrounded = false;
    this.squashX = 0.82;
    this.squashY = 1.28;
    audio.playFinisherImpact();
    audio.playBassDrop();
    camera.addShake(0.3);
    particles.triggerSpeedlines(0.18);
    particles.addShockwave(this.x, this.y - 20, 60, '#ffbb00', 6);
    particles.addSlashArc(this.x, this.y - 40, 80, -Math.PI / 2, this.facing, '#ffea00', 8);
    particles.addComicPopup(this.x + this.facing * 30, this.y - 50, 'SHORYU!', '#ffaa00', '#ffffff');
    speech.shout(this.x, this.y, 'playerAttack');

    const damage = 42 * (this.damageMultiplier || 1.0);
    this.checkMeleeHits(zombies, 110, damage, 580, true, '#ffee00', camera, true);
  }

  executeAirFlurry(zombies, camera) {
    this.attackTimer = 0.22;
    this.pose = 'attack_air_flurry';
    this.vy = Math.min(this.vy, -60); // Brief float suspension
    this.vx = this.facing * 220;
    audio.playWhoosh();
    audio.playPunch('light');
    particles.createHitSparks(this.x + this.facing * 35, this.y - 25, 6, '#ffaa00');

    const damage = 28 * (this.damageMultiplier || 1.0);
    this.checkMeleeHits(zombies, 115, damage, 380, false, '#ffaa00', camera);
  }

  executeSlideSweep(zombies, camera) {
    this.isRolling = false;
    this.attackTimer = 0.28;
    this.pose = 'attack_slide';
    this.vx = this.facing * 520;
    this.squashX = 1.35;
    this.squashY = 0.72;
    audio.playSlash();
    particles.createDust(this.x, this.y, 8, this.facing);
    particles.addSlashArc(this.x, this.y - 8, 90, 0, this.facing, '#ff7700', 8);
    speech.shout(this.x, this.y, 'playerAttack');

    const damage = 38 * (this.damageMultiplier || 1.0);
    this.checkMeleeHits(zombies, 130, damage, 600, true, '#ffaa00', camera);
  }

  executeLightCombo(zombies, camera) {
    this.comboStep = (this.comboStep % 5) + 1;
    this.comboResetTimer = 0.95;
    this.attackTimer = 0.18;

    this.vx = this.facing * 150;

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
      damage *= 1.35;
      hitRadius = 105;
      knockback = 460;
      this.vx = this.facing * 220;
    } else if (this.comboStep === 3) {
      this.pose = 'attack_kick';
      audio.playWhoosh();
      audio.playPunch('light');
      audio.playPlayerEffort();
      damage *= 1.7;
      hitRadius = 125;
      knockback = 560;
    } else if (this.comboStep === 4) {
      this.pose = 'attack_axe_kick';
      audio.playPunch('heavy');
      camera.addShake(0.25);
      damage *= 2.2;
      hitRadius = 135;
      knockback = 650;
      this.squashX = 1.25;
      this.squashY = 0.8;
      particles.addSlashArc(this.x, this.y - 20, 85, Math.PI / 3, this.facing, '#ff9900', 8);
    } else if (this.comboStep === 5) {
      this.pose = 'attack_spin';
      audio.playFinisherImpact();
      audio.playPunch('heavy');
      camera.addShake(0.4);
      damage *= 3.4;
      knockback = 800;
      hitRadius = 155;
      isCrit = true;
      this.iFrames = 0.25; // Hyper-armor on spin finisher
      hitSparkColor = '#ff3344';
      particles.addSlashArc(this.x, this.y - 30, 110, 0, this.facing, '#ff5522', 10);
      particles.addShockwave(this.x, this.y - 25, 120, '#ff7700', 8);

      // Trigger hilarious 80s speech shout on combo finisher!
      speech.shout(this.x, this.y, 'playerAttack');
    }

    this.checkMeleeHits(zombies, hitRadius, damage, knockback, isCrit, hitSparkColor, camera);
  }

  executeWeaponAttack(zombies, camera) {
    const stats = weapons.getWeaponStats(this.weaponType);
    const baseDamage = (stats.damage || 45) * (this.damageMultiplier || 1.0) * (this.isAwakened ? 2.0 : 1.0);

    // Hybrid Branching Weapon Cancels
    if (this.comboStep === 1) {
      // Branch 1: Pencil Vault Dropkick
      this.weaponTimer = 0.32;
      this.pose = 'attack_vault_kick';
      this.vx = this.facing * 420;
      this.vy = -180;
      this.isGrounded = false;
      this.comboStep = 0;
      audio.playSlash();
      audio.playPlayerEffort();
      camera.addShake(0.3);
      particles.addSlashArc(this.x, this.y - 25, 130, 0, this.facing, '#ffaa00', 9);
      speech.shout(this.x, this.y, 'playerAttack');
      this.checkMeleeHits(zombies, 140, baseDamage * 1.5, 680, true, '#ffbb00', camera);
      return;
    } else if (this.comboStep === 2) {
      // Branch 2: Pencil Drill Corkscrew Thrust
      this.weaponTimer = 0.35;
      this.pose = 'attack_drill_thrust';
      this.vx = this.facing * 360;
      this.comboStep = 0;
      audio.playSlash();
      audio.playFinisherImpact();
      camera.addShake(0.35);
      particles.createPencilLeadTrail(this.x + this.facing * 45, this.y - 30, 12, this.facing);
      speech.shout(this.x, this.y, 'playerAttack');
      this.checkMeleeHits(zombies, 150, baseDamage * 1.8, 720, true, '#ffcc00', camera);
      return;
    }

    // Standard Heavy Weapon Slash
    this.weaponTimer = stats.cooldown || 0.35;
    this.pose = 'weapon_slash';
    this.vx = this.facing * 240;
    this.iFrames = 0.2;

    audio.playSlash();
    audio.playPlayerEffort();
    camera.addShake(0.3);
    const range = 160;
    particles.addSlashArc(this.x, this.y - 30, range * 0.85, 0, this.facing, '#ff7700', 10);
    if (this.weaponType === 'pencil') {
      particles.createPencilLeadTrail(this.x + this.facing * 40, this.y - 30, 8, this.facing);
    }
    if (Math.random() < 0.3) {
      speech.shout(this.x, this.y, 'playerAttack');
    }

    this.checkMeleeHits(zombies, range, baseDamage, 650, true, '#ffaa00', camera);
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

  checkMeleeHits(zombies, range, damage, knockback, isCrit, sparkColor, camera, isUppercut = false) {
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

        // Uppercut launches enemy high into the air for Air-Chase juggles
        if (isUppercut) {
          z.vy = -720;
          this.airJuggleTarget = z;
        }

        // Trigger comic action badge and speedlines on big impacts
        if (isCrit || damage >= 40) {
          const words = ['POW!', 'KRAK!', 'SLASH!', 'SMASH!', 'WHAM!', 'ORA!'];
          particles.addComicPopup(z.x, z.y - 30, words[Math.floor(Math.random() * words.length)], '#ff0044', '#ffee00');
          particles.triggerSpeedlines(0.22);
          audio.playBassDrop();
        }

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

  activateAwakening(camera) {
    this.isAwakened = true;
    this.awakenedTimer = this.awakenedDuration;
    this.superMeter = 0;
    audio.playSuperActivate();
    if (camera) camera.addShake(0.6);
    particles.addShockwave(this.x, this.y - 30, 200, '#ffee00', 12);
    particles.addTextBanner(this.x, this.y - 80, '⚡ GOD MODE AWAKENED! ⚡', '#ffee00');
    speech.shout(this.x, this.y, 'playerAwakened', null, 3.0);
  }

  deactivateAwakening() {
    this.isAwakened = false;
    this.awakenedTimer = 0;
    particles.createDust(this.x, this.y, 8);
  }

  applyPhysics(dt, groundY, sketchBlocks) {
    // Gravity
    const gravity = this.isAwakened ? 600 : 1300;
    if (!this.diveKick) {
      this.vy += gravity * dt;
    }

    // Movement integration
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Ground collision
    if (this.y >= groundY) {
      if (this.diveKick) {
        this.diveKick = false;
        this.pose = 'idle';
        audio.playPunch('heavy');
        particles.addShockwave(this.x, groundY, 150, '#ffaa00', 10);
        particles.createDust(this.x, groundY, 14);
      } else if (!this.isGrounded && this.vy > 100) {
        audio.playLand();
        particles.createDust(this.x, groundY, 4);
        this.squashX = Math.min(1.35, 1.0 + (this.vy / 1600));
        this.squashY = Math.max(0.72, 1.0 - (this.vy / 2000));
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
        if (this.x + 14 > b.x - halfW &&
            this.x - 14 < b.x + halfW &&
            this.y >= bTop && this.y <= bTop + 24) {
          if (this.diveKick) {
            this.diveKick = false;
            this.pose = 'idle';
            audio.playPunch('heavy');
            particles.addShockwave(this.x, bTop, 120, '#ffaa00', 8);
          } else if (!this.isGrounded && this.vy > 100) {
            audio.playLand();
          }
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
    if (Math.random() < 0.45) {
      speech.shout(this.x, this.y, 'playerHurt', null, 2.0);
    }

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
      alpha: 1.0,
      squashX: this.squashX,
      squashY: this.squashY,
      leanAngle: this.leanAngle
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
