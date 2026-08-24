import { StickFigureRenderer } from './stickman.js?v=8.4';
import { particles } from '../engine/particles.js?v=8.4';
import { audio } from '../engine/audio.js?v=8.4';
import { projectiles } from './projectiles.js?v=8.4';
import { weapons } from './weapons.js?v=8.4';
import { allies } from './allies.js?v=8.4';
import { combat } from '../systems/combat.js?v=8.4';
import { speech } from '../engine/speech.js?v=8.4';

const defineMove = (move) => Object.freeze(move);

export const MOVE_DEFINITIONS = Object.freeze({
  combo: Object.freeze([
    defineMove({ id: 'combo_1', duration: 0.18, contactTime: 0.07, range: 95, damage: 22, knockback: 380, impactTier: 'light', movementImpulse: 150, pose: 'attack_jab' }),
    defineMove({ id: 'combo_2', duration: 0.20, contactTime: 0.08, range: 105, damage: 30, knockback: 460, impactTier: 'light', movementImpulse: 220, pose: 'attack_cross' }),
    defineMove({ id: 'combo_3', duration: 0.23, contactTime: 0.10, range: 125, damage: 37, knockback: 560, impactTier: 'medium', movementImpulse: 235, pose: 'attack_kick', launch: true }),
    defineMove({ id: 'combo_4', duration: 0.27, contactTime: 0.13, range: 135, damage: 48, knockback: 650, impactTier: 'medium', movementImpulse: 190, pose: 'attack_axe_kick', bounce: true }),
    defineMove({ id: 'combo_5', duration: 0.34, contactTime: 0.16, range: 155, damage: 75, knockback: 800, impactTier: 'heavy', movementImpulse: 250, pose: 'attack_spin', crit: true, wallRebound: true })
  ]),
  uppercut: defineMove({ id: 'uppercut', duration: 0.32, contactTime: 0.12, range: 110, damage: 42, knockback: 580, impactTier: 'medium', movementImpulse: 180, verticalImpulse: -560, pose: 'attack_uppercut', crit: true, launch: true }),
  airFlurry: defineMove({ id: 'air_flurry', duration: 0.22, contactTime: 0.075, range: 115, damage: 28, knockback: 380, impactTier: 'light', movementImpulse: 220, verticalImpulse: -60, pose: 'attack_air_flurry' }),
  slide: defineMove({ id: 'slide', duration: 0.28, contactTime: 0.10, range: 130, damage: 38, knockback: 600, impactTier: 'medium', movementImpulse: 520, pose: 'attack_slide', crit: true, bounce: true }),
  airChase: defineMove({ id: 'air_chase', duration: 0.35, contactTime: 0.14, range: 90, damage: 65, knockback: 450, impactTier: 'heavy', movementImpulse: 120, verticalImpulse: -180, pose: 'attack_air_flurry', crit: true, meteor: true }),
  grab: defineMove({ id: 'grab', duration: 0.35, contactTime: 0.14, range: 135, damage: 85, knockback: 420, impactTier: 'heavy', movementImpulse: 220, pose: 'attack_spin', crit: true }),
  javelin: defineMove({ id: 'javelin', duration: 0.45, contactTime: 0.16, range: 0, damage: 95, knockback: 0, impactTier: 'medium', movementImpulse: -120, pose: 'attack_drill_thrust' })
});

export const ATTACK_BUFFER_SECONDS = 0.12;

export class Player {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;

    this.width = 24;
    this.height = 64;
    this.radius = 18;

    this.speed = 340;
    this.jumpForce = 580;
    this.facing = 1; // 1 = right, -1 = left
    this.isGrounded = false;
    this.isCrouching = false;
    this.isWallSliding = false;
    this.wallDir = 0;

    this.canDoubleJump = true;
    this.coyoteTimer = 0;
    this.jumpBuffer = 0;

    this.maxHp = 100;
    this.hp = 100;
    this.isDead = false;
    this.deathTimer = 0;
    this.isHurt = false;
    this.hurtTimer = 0;
    this.iFrames = 0;

    this.damageMultiplier = 1.0;
    this.lifesteal = 0.0; // % of damage returned as HP
    this.superGainRate = 1.0;

    this.superMeter = 0; // 0 to 100
    this.maxSuper = 100;
    this.isAwakened = false;
    this.awakenedTimer = 0;
    this.awakenedDuration = 12.0;
    this.awakeningAuraTimer = 0;
    this.laserTickTimer = 0;
    this.isFiringLaser = false;

    this.isRolling = false;
    this.rollTimer = 0;
    this.rollDuration = 0.35;
    this.rollCooldown = 0;

    this.blockCooldown = 0;

    this.hookCooldown = 0;
    this.hookRange = 420;
    this.hookVisualTimer = 0;
    this.hookVisualDuration = 0.44;
    this.hookLines = [];
    this.hookMode = 'idle';
    this.hookCastFacing = this.facing;
    this.hookPullTarget = null;
    this.hookPullTimer = 0;
    this.hookSafeDistance = 0;
    this.hookFocusTriggered = false;

    this.comboStep = 0;
    this.comboResetTimer = 0;
    this.attackTimer = 0;
    this.weaponType = 'pencil'; // 'pencil', 'staff', 'eraser'
    this.temporaryWeaponTimer = 0;
    this.weaponTimer = 0;
    this.diveKick = false;
    this.activeMove = null;
    this.bufferedMove = null;
    this.movePhase = 'idle';
    this.moveProgress = 0;
    this.simTime = 0;
    this.standingPlatform = null;
    this.standingPlatformX = 0;
    this.standingPlatformY = 0;

    this.pose = 'idle';
    this.animTimer = 0;
    this.squashX = 1.0;
    this.squashY = 1.0;
    this.leanAngle = 0;
    this.renderer = new StickFigureRenderer('#ff7700', 5.5, 1.0, true); // Hollow head for Orange!

    this.ghostTrails = [];
    this.ghostTrailTimer = 0;
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
    this.currentZombies = zombies;
    this.currentCamera = camera;
    this.simTime += dt;
    this.animTimer += dt;
    this.isFiringLaser = false;

    this.squashX += (1.0 - this.squashX) * Math.min(1, 14.0 * dt);
    this.squashY += (1.0 - this.squashY) * Math.min(1, 14.0 * dt);

    const targetLean = this.isGrounded ? (this.vx / 450) * 0.16 : (this.vx / 600) * 0.08;
    this.leanAngle += (targetLean - this.leanAngle) * Math.min(1, 12.0 * dt);

    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) this.isHurt = false;
    }
    if (this.iFrames > 0) this.iFrames -= dt;
    if (this.rollCooldown > 0) this.rollCooldown -= dt;
    if (this.blockCooldown > 0) this.blockCooldown -= dt;
    if (this.hookCooldown > 0) this.hookCooldown -= dt;
    if (this.hookVisualTimer > 0) {
      this.hookVisualTimer -= dt;
      if (this.hookVisualTimer <= 0) {
        this.hookLines.length = 0;
        this.hookMode = 'idle';
      }
    }
    if (this.laserTickTimer > 0) this.laserTickTimer -= dt;
    if (this.ghostTrailTimer > 0) this.ghostTrailTimer -= dt;
    if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    if (this.temporaryWeaponTimer > 0) {
      this.temporaryWeaponTimer = Math.max(0, this.temporaryWeaponTimer - dt);
      if (this.temporaryWeaponTimer === 0 && this.weaponType !== 'pencil') {
        this.weaponType = 'pencil';
        particles.addDamageText(this.x, this.y - 72, 'PENCIL RESTORED', false, '#ffb347');
      }
    }
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 0;
    }

    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.weaponTimer > 0) this.weaponTimer = Math.max(0, this.weaponTimer - dt);
    this.updateActiveMove(dt);

    if (this.isAwakened) {
      this.awakenedTimer -= dt;
      this.awakeningAuraTimer -= dt;
      if (this.awakeningAuraTimer <= 0) {
        this.awakeningAuraTimer = 0.05;
        particles.createAwakeningAura(this.x, this.y - 30, 1);
      }

      if (this.awakenedTimer <= 0) {
        this.deactivateAwakening();
      }
    }

    for (let i = this.ghostTrails.length - 1; i >= 0; i--) {
      const ghost = this.ghostTrails[i];
      ghost.alpha -= dt * 3.5;
      if (ghost.alpha <= 0) {
        this.ghostTrails.splice(i, 1);
      }
    }

    if (this.isRolling || this.isAwakened || Math.abs(this.vx) > 350) {
      if (this.ghostTrails.length < 4 && this.ghostTrailTimer <= 0) {
        this.ghostTrailTimer = 0.055;
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

    if (this.diveKick) {
      this.diveKickTimer = (this.diveKickTimer || 0.5) - dt;
      if (this.diveKickTimer <= 0 || this.isGrounded) {
        this.diveKick = false;
        this.diveKickTimer = 0;
        this.pose = 'idle';
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
      if (input.actions.attackPressed || input.actions.weaponPressed) {
        this.executeSlideSweep(zombies, camera);
      }
    } else {
      this.handleMovement(dt, input, groundY, sketchBlocks);
      this.handleCombatInputs(input, zombies, camera, groundY);
      this.handleSkillsAndAllies(input, groundY, camera, zombies);
    }

    this.updateReverseHookPull(dt);

    this.applyPhysics(dt, groundY, sketchBlocks);

    this.updatePose();
  }

  handleMovement(dt, input, groundY, sketchBlocks) {
    let moveDir = 0;
    if (input.actions.left) moveDir -= 1;
    if (input.actions.right) moveDir += 1;

    const maxSpeed = this.speed * (this.isAwakened ? 1.4 : 1.0);
    const accel = this.isGrounded ? 2200 : 1400;
    const friction = this.isGrounded ? 1800 : 600;

    if (moveDir !== 0) {
      this.vx += moveDir * accel * dt;
      this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
      this.facing = moveDir;

      if (this.isGrounded && Math.random() < 0.15) {
        particles.createDust(this.x, this.y, 2, this.facing);
      }
    } else {
      if (this.vx > 0) {
        this.vx = Math.max(0, this.vx - friction * dt);
      } else if (this.vx < 0) {
        this.vx = Math.min(0, this.vx + friction * dt);
      }
    }

    this.isCrouching = input.actions.down && this.isGrounded;

    if (input.actions.rollPressed && this.rollCooldown <= 0) {
      this.isRolling = true;
      this.rollTimer = this.rollDuration;
      this.rollCooldown = 0.65;
      this.iFrames = this.rollDuration + 0.05;
      audio.playDodge();
      particles.createDust(this.x, this.y, 6, this.facing);
      return;
    }

    if (input.actions.jumpPressed) {
      this.jumpBuffer = 0.15;
    }

    if (this.jumpBuffer > 0) {
      if (this.isGrounded || this.coyoteTimer > 0) {
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

    if (!input.actions.jump && this.vy < -150) {
      this.vy += 900 * dt;
    }
  }

  bufferCombatMove(kind) {
    this.bufferedMove = { kind, life: ATTACK_BUFFER_SECONDS };
  }

  beginMove(definition, zombies, camera, options = {}) {
    if (!definition || this.activeMove || this.isDead || this.isHurt) return false;
    this.activeMove = {
      definition,
      elapsed: 0,
      hitApplied: false,
      targets: Array.isArray(zombies) ? zombies : [],
      camera,
      action: options.action || 'melee',
      target: options.target || null,
      damageScale: options.damageScale || 1,
      rangeOverride: options.rangeOverride || 0,
      stun: options.stun || 0,
      sparkColor: options.sparkColor || '#ffcc33'
    };
    this.movePhase = 'anticipation';
    this.moveProgress = 0;
    this.pose = definition.pose;
    if (options.weapon) this.weaponTimer = definition.duration;
    else this.attackTimer = definition.duration;
    return true;
  }

  updateActiveMove(dt) {
    if (this.bufferedMove) {
      this.bufferedMove.life = Math.max(0, this.bufferedMove.life - dt);
      if (this.bufferedMove.life <= 0) this.bufferedMove = null;
    }
    const move = this.activeMove;
    if (!move) {
      this.movePhase = 'idle';
      this.moveProgress = 0;
      if (this.bufferedMove && !this.isHurt && !this.isDead) {
        const buffered = this.bufferedMove;
        this.bufferedMove = null;
        if (buffered.kind === 'attack' && this.attackTimer <= 0) this.executeLightCombo(this.currentZombies, this.currentCamera);
        else if (buffered.kind === 'weapon' && this.weaponTimer <= 0) this.executeWeaponAttack(this.currentZombies, this.currentCamera);
        else if (buffered.kind === 'uppercut' && this.attackTimer <= 0) this.executeRisingUppercut(this.currentZombies, this.currentCamera);
      }
      return;
    }

    const def = move.definition;
    move.elapsed = Math.min(def.duration, move.elapsed + dt);
    this.moveProgress = def.duration > 0 ? move.elapsed / def.duration : 1;
    if (move.elapsed < def.contactTime) this.movePhase = 'anticipation';
    else if (move.elapsed < Math.min(def.duration, def.contactTime + 0.055)) this.movePhase = 'contact';
    else this.movePhase = 'recovery';

    if (!move.hitApplied && move.elapsed >= def.contactTime) {
      move.hitApplied = true;
      this.applyMoveContact(move);
    }

    if (move.elapsed >= def.duration) {
      const wasWeapon = move.action === 'weapon' || move.action === 'javelin';
      this.activeMove = null;
      this.movePhase = 'idle';
      this.moveProgress = 0;
      if (wasWeapon) this.weaponTimer = 0;
      else this.attackTimer = 0;
    }
  }

  applyTargetAssist(targets, range) {
    let target = null;
    let bestForward = Infinity;
    for (const candidate of targets || []) {
      if (!candidate || candidate.isDead) continue;
      const forward = this.facing * (candidate.x - this.x);
      const vertical = Math.abs(candidate.y - this.y);
      if (forward <= 18 || Math.hypot(forward, vertical) > 100 || forward >= bestForward) continue;
      target = candidate;
      bestForward = forward;
    }
    if (!target) return;
    const desired = Math.max(36, range * 0.72);
    const step = Math.min(36, Math.max(0, bestForward - desired));
    this.x = Math.max(-1075, Math.min(1075, this.x + this.facing * step));
  }

  applyMoveContact(move) {
    const def = move.definition;
    if (move.action !== 'javelin' && move.action !== 'grab') {
      this.applyTargetAssist(move.targets, move.rangeOverride || def.range);
    }
    this.vx = this.facing * (def.movementImpulse || 0);
    if (Number.isFinite(def.verticalImpulse)) {
      this.vy = def.id === 'air_flurry' ? Math.min(this.vy, def.verticalImpulse) : def.verticalImpulse;
      this.isGrounded = false;
    }

    if (move.action === 'javelin') {
      projectiles.spawnJavelin(this.x + this.facing * 40, this.y - 30, this.facing, def.damage);
      particles.emitImpact?.('medium', this.x + this.facing * 34, this.y - 30, { color: '#ffb347', direction: this.facing });
      return;
    }
    if (move.action === 'grab') {
      this.resolveGrabContact(move.target, move.camera);
      return;
    }
    if (move.action === 'airChase') {
      const target = move.target;
      if (!target || target.isDead) return;
      const damage = def.damage * this.damageMultiplier;
      const appliedDamage = target.takeDamage(damage, this.facing, def.knockback, true) ?? damage;
      target.vy = 850;
      combat.registerHit(appliedDamage, true);
      particles.emitImpact?.('heavy', target.x, target.y - 25, { color: '#ffdd00', direction: this.facing });
      this.addSuper(5 * this.superGainRate * Math.min(1, appliedDamage / damage));
      return;
    }

    const damage = def.damage * this.damageMultiplier * move.damageScale;
    this.checkMeleeHits(
      move.targets,
      move.rangeOverride || def.range,
      damage,
      def.knockback,
      Boolean(def.crit),
      move.sparkColor,
      move.camera,
      Boolean(def.launch),
      { impactTier: def.impactTier, bounce: def.bounce, wallRebound: def.wallRebound, stun: move.stun }
    );
    if (def.id === 'combo_5') speech.shout(this.x, this.y, 'playerAttack', null, 1.25, { anchor: this });
  }

  handleCombatInputs(input, zombies, camera, groundY) {
    if (this.isAwakened && (input.actions.weapon || input.actions.attack)) {
      this.isFiringLaser = true;
      if (this.laserTickTimer <= 0) {
        this.laserTickTimer = 0.12;
        this.fireAwakeningLaser(zombies, camera);
      }
      return;
    }

    if (input.actions.hookPressed && this.hookCooldown <= 0) {
      if (this.executeVectorHook(zombies, camera)) return;
    }

    if (input.actions.grabPressed || (input.actions.attackPressed && input.actions.weaponPressed)) {
      if (this.executeGrabAndThrow(zombies, camera)) {
        return;
      }
    }

    if (input.actions.down && input.actions.weaponPressed && this.weaponTimer <= 0) {
      if (this.activeMove) this.bufferCombatMove('weapon');
      else this.executeJavelinThrow(zombies, camera);
      return;
    }

    if (!this.isGrounded && (input.actions.jumpPressed || input.actions.attackPressed) && this.airJuggleTarget && !this.airJuggleTarget.isDead) {
      this.executeAirChase(zombies, camera);
      return;
    }

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
      if (Math.random() < 0.4) speech.shout(this.x, this.y, 'playerAttack', null, 1.45, { anchor: this });
      return;
    }

    if (input.actions.up && input.actions.attackPressed && this.attackTimer <= 0 && !this.activeMove) {
      this.executeRisingUppercut(zombies, camera);
      return;
    }

    if (!this.isGrounded && input.actions.attackPressed && this.attackTimer <= 0 && !this.activeMove) {
      this.executeAirFlurry(zombies, camera);
      return;
    }

    if (this.isRolling && (input.actions.attackPressed || input.actions.weaponPressed)) {
      this.executeSlideSweep(zombies, camera);
      return;
    }

    if (input.actions.attackPressed) {
      if (!this.activeMove && this.attackTimer <= 0) this.executeLightCombo(zombies, camera);
      else this.bufferCombatMove(input.actions.up ? 'uppercut' : 'attack');
    }

    if (input.actions.weaponPressed) {
      if (!this.activeMove && this.weaponTimer <= 0) this.executeWeaponAttack(zombies, camera);
      else this.bufferCombatMove('weapon');
    }

  }

  executeVectorHook(zombies, camera) {
    if (this.isDead || this.isHurt || this.isRolling || this.isAwakened) return false;

    const candidates = (Array.isArray(zombies) ? zombies : []).filter((zombie) => {
      if (!zombie || zombie.isDead || !Number.isFinite(zombie.x) || !Number.isFinite(zombie.y)) return false;
      const forwardDistance = this.facing * (zombie.x - this.x);
      const verticalDistance = Math.abs((zombie.y - (zombie.height || 50) * 0.4) - (this.y - 32));
      return forwardDistance >= 24
        && forwardDistance <= this.hookRange + (zombie.radius || 0)
        && verticalDistance <= 110;
    });

    const anchors = candidates
      .filter((zombie) => zombie.isBoss || zombie.hookClass === 'anchor')
      .sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x));
    const pullables = anchors.length === 0
      ? candidates.filter((zombie) => zombie.hookClass === 'pullable' && typeof zombie.applyHookPull === 'function')
      : [];

    this.attackTimer = Math.max(this.attackTimer, 0.22);
    this.pose = 'attack_cross';
    this.hookVisualTimer = this.hookVisualDuration;
    this.hookCastFacing = this.facing;
    this.hookLines.length = 0;
    this.hookPullTarget = null;
    this.hookPullTimer = 0;
    this.hookSafeDistance = 0;
    this.hookFocusTriggered = false;
    audio.playGrabThrow();
    camera?.addZoomPunch?.(-0.02);

    if (anchors.length > 0) {
      const anchor = anchors[0];
      this.hookMode = 'anchor';
      this.hookPullTarget = anchor;
      this.hookPullTimer = 0.38;
      this.hookSafeDistance = (anchor.radius || 30) + 58;
      this.hookCooldown = 4;
      this.hookLines.push({ target: anchor, x: anchor.x, y: anchor.y - (anchor.height || 70) * 0.45 });
      if (Number.isFinite(anchor.attackCooldown)) {
        anchor.attackCooldown = Math.max(anchor.attackCooldown, 0.35);
      }
      if (Number.isFinite(anchor.actionCooldown)) {
        anchor.actionCooldown = Math.max(anchor.actionCooldown, 0.35);
      }
      camera?.addShake?.(0.22);
      camera?.addZoomPunch?.(0.03);
      particles.addComicPopup(anchor.x, anchor.y - (anchor.height || 70) * 0.72, 'TOO HEAVY!', '#ff3344', '#ffffff');
      return true;
    }

    if (pullables.length > 0) {
      this.hookMode = 'pull';
      this.hookPullTarget = null;
      this.hookPullTimer = 0;
      this.hookCooldown = 4;
      pullables.sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x));
      for (const zombie of pullables) {
        zombie.applyHookPull(this, 0.34, 76);
        if (this.hookLines.length < 8) {
          this.hookLines.push({ target: zombie, x: zombie.x, y: zombie.y - (zombie.height || 50) * 0.45 });
        }
      }
      camera?.addShake?.(0.12);
      camera?.addZoomPunch?.(0.025);
      particles.addComicPopup(this.x + this.facing * 95, this.y - 70, 'REEL IN!', '#00d9ff', '#ffffff');
      return true;
    }

    this.hookMode = 'miss';
    this.hookCooldown = 1;
    this.hookLines.push({ target: null, x: this.x + this.facing * this.hookRange, y: this.y - 32 });
    particles.addComicPopup(this.x + this.facing * 120, this.y - 58, 'WHIFF!', '#8fa3b8', '#ffffff');
    return true;
  }

  updateReverseHookPull(dt) {
    if (this.hookPullTimer <= 0) return;
    if (this.isRolling || this.isAwakened) {
      this.hookPullTimer = 0;
      this.hookPullTarget = null;
      return;
    }

    const target = this.hookPullTarget;
    if (!target || target.isDead || !Number.isFinite(target.x)) {
      this.hookPullTimer = 0;
      this.hookPullTarget = null;
      return;
    }

    this.hookPullTimer = Math.max(0, this.hookPullTimer - dt);
    const dx = target.x - this.x;
    const distance = Math.abs(dx);
    if (distance <= this.hookSafeDistance) {
      this.hookPullTimer = 0;
      this.hookPullTarget = null;
      this.vx *= 0.35;
      return;
    }

    const direction = dx >= 0 ? 1 : -1;
    if (!this.hookFocusTriggered && this.hookPullTimer <= 0.24) {
      this.hookFocusTriggered = true;
      this.currentCamera?.focusOn?.((this.x + target.x) * 0.5, (this.y + target.y) * 0.5, 0.24, 0.96);
    }
    this.facing = direction;
    this.vx = direction * Math.min(660, Math.max(360, distance * 2.5));
    this.pose = 'attack_cross';
    if (this.hookPullTimer <= 0) {
      this.hookPullTarget = null;
      this.hookSafeDistance = 0;
    }
  }

  cancelHook(resetCooldown = false) {
    this.hookVisualTimer = 0;
    this.hookLines.length = 0;
    this.hookMode = 'idle';
    this.hookPullTarget = null;
    this.hookPullTimer = 0;
    this.hookFocusTriggered = false;
    if (resetCooldown) this.hookCooldown = 0;
  }

  executeGrabAndThrow(zombies, camera) {
    if (this.activeMove || this.isDead || this.isHurt) return false;
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

    this.facing = target.x >= this.x ? 1 : -1;
    audio.playGrabThrow();
    return this.beginMove(MOVE_DEFINITIONS.grab, zombies, camera, { action: 'grab', target });
  }

  resolveGrabContact(target, camera) {
    if (!target || target.isDead) return;
    if (target.isBoss) {
      this.iFrames = 0.25;
      audio.playFinisherImpact();
      target.takeDamage(85 * this.damageMultiplier, this.facing, 420, true);
      combat.registerHit(85 * this.damageMultiplier, true);
      particles.emitImpact?.('heavy', target.x, target.y - 30, { color: '#ff7700', direction: this.facing });
      particles.addComicPopup(target.x, target.y - 60, 'PROCESS BREAK!', '#ff6600', '#ffffff');
      if (camera) {
        camera.addShake(0.34);
        camera.addHitstop(0.05);
        camera.addZoomPunch?.(0.045);
      }
      return;
    }

    this.squashX = 1.4;
    this.squashY = 0.7;

    audio.playSlash();
    audio.playFinisherImpact();
    audio.playBassDrop();
    if (camera) {
      camera.addShake(0.48);
      camera.addHitstop(0.05);
      camera.addZoomPunch?.(0.07);
    }
    particles.emitImpact?.('heavy', target.x, target.y - 25, {
      color: target.color || '#66dd77',
      direction: this.facing,
      seed: (target.x * 31) | 0
    });

    particles.createStickLimbExplosion(target.x, target.y, 0, target.color);

    const ripBanners = ['DECOMPILED!', 'UNZIPPED!', 'FILE SPLIT!', 'MOVE TO TRASH!'];
    const bannerText = ripBanners[Math.abs(((target.x || 0) * 17 + this.simTime * 10) | 0) % ripBanners.length];
    particles.addComicPopup(this.x + this.facing * 60, this.y - 45, bannerText, '#ff0033', '#ffffff');

    target.die(true);
    projectiles.spawnThrownZombie(this.x + this.facing * 40, this.y - 30, this.facing, 140);
    speech.shout(this.x, this.y, 'playerAttack', null, 1.25, { anchor: this });
  }

  executeJavelinThrow(zombies, camera) {
    if (this.activeMove || this.isDead || this.isHurt) return false;
    this.squashX = 0.8;
    this.squashY = 1.25;
    audio.playSlash();
    return this.beginMove(MOVE_DEFINITIONS.javelin, zombies, camera, { action: 'javelin', weapon: true });
  }

  executeAirChase(zombies, camera) {
    if (this.activeMove || this.isDead || this.isHurt) return false;
    const target = this.airJuggleTarget;
    this.airJuggleTarget = null;
    if (!target || target.isDead || typeof target.x !== 'number') return false;

    audio.playFlashStep();
    audio.playBassDrop();
    particles.addComicPopup(target.x, target.y - 30, 'AIR CHASE!', '#00e5ff', '#ffffff');

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
    if (this.ghostTrails.length > 4) this.ghostTrails.splice(0, this.ghostTrails.length - 4);

    this.x = target.x - this.facing * 25;
    this.y = target.y - 30;
    camera?.focusOn?.((this.x + target.x) * 0.5, (this.y + target.y) * 0.5, 0.28, 0.94);
    camera?.addShake?.(0.24);
    camera?.addZoomPunch?.(0.045);
    return this.beginMove(MOVE_DEFINITIONS.airChase, zombies, camera, { action: 'airChase', target });
  }

  executeRisingUppercut(zombies, camera) {
    if (this.activeMove || this.isDead || this.isHurt) return false;
    this.squashX = 0.82;
    this.squashY = 1.28;
    audio.playWhoosh();
    return this.beginMove(MOVE_DEFINITIONS.uppercut, zombies, camera, { sparkColor: '#ffee00' });
  }

  executeAirFlurry(zombies, camera) {
    if (this.activeMove || this.isDead || this.isHurt) return false;
    audio.playWhoosh();
    return this.beginMove(MOVE_DEFINITIONS.airFlurry, zombies, camera, { sparkColor: '#ffaa00' });
  }

  executeSlideSweep(zombies, camera) {
    if (this.activeMove || this.isDead || this.isHurt) return false;
    this.isRolling = false;
    this.squashX = 1.35;
    this.squashY = 0.72;
    audio.playSlash();
    particles.createDust(this.x, this.y, 8, this.facing);
    return this.beginMove(MOVE_DEFINITIONS.slide, zombies, camera, { sparkColor: '#ffaa00' });
  }

  executeLightCombo(zombies, camera) {
    if (this.activeMove || this.isDead || this.isHurt) return false;
    this.comboStep = (this.comboStep % 5) + 1;
    this.comboResetTimer = 0.95;
    const definition = MOVE_DEFINITIONS.combo[this.comboStep - 1];
    if (this.comboStep >= 4) {
      this.squashX = this.comboStep === 5 ? 1.35 : 1.22;
      this.squashY = this.comboStep === 5 ? 0.72 : 0.82;
    }
    if (this.comboStep === 5) this.iFrames = 0.25;
    audio.playWhoosh();
    audio.playPlayerEffort();
    return this.beginMove(definition, zombies, camera, {
      sparkColor: this.comboStep === 5 ? '#ff3344' : '#ffea00'
    });
  }

  executeWeaponAttack(zombies, camera) {
    if (this.activeMove || this.isDead || this.isHurt) return false;
    const stats = weapons.getWeaponStats(this.weaponType);
    let damageScale = this.isAwakened ? 2 : 1;
    let range = stats.range || 160;
    let pose = 'weapon_slash';
    let impulse = 240;
    let duration = stats.cooldown || 0.38;
    let contactTime = Math.min(duration * 0.45, 0.17);

    if (this.comboStep === 1) {
      pose = 'attack_vault_kick';
      impulse = 420;
      range = Math.max(range, 140);
      damageScale *= 1.5;
      duration = 0.32;
      contactTime = 0.13;
      this.comboStep = 0;
    } else if (this.comboStep === 2) {
      pose = 'attack_drill_thrust';
      impulse = 360;
      range = Math.max(range, 150);
      damageScale *= 1.8;
      duration = 0.35;
      contactTime = 0.14;
      this.comboStep = 0;
    }
    if (this.weaponType === 'staff') {
      range += 65;
      duration = Math.min(duration, 0.29);
      contactTime = 0.105;
    }
    const stun = this.weaponType === 'eraser' ? 0.65 : 0;
    const definition = defineMove({
      id: `weapon_${this.weaponType}`,
      duration,
      contactTime,
      range,
      damage: stats.damage || 35,
      knockback: stats.knockback || 650,
      impactTier: this.weaponType === 'eraser' ? 'heavy' : 'medium',
      movementImpulse: impulse,
      pose,
      crit: true
    });
    this.iFrames = 0.2;
    audio.playSlash();
    audio.playPlayerEffort();
    return this.beginMove(definition, zombies, camera, {
      action: 'weapon', weapon: true, damageScale, stun,
      sparkColor: this.weaponType === 'eraser' ? '#e7f4ff' : '#ffaa00'
    });
  }

  fireAwakeningLaser(zombies, camera) {
    camera.addShake(0.15);
    audio.playLaserBeam();

    const beamStartX = this.x + this.facing * 20;
    const beamY = this.y - 48;
    const beamLength = 850;

    particles.addShockwave(beamStartX, beamY, 20, '#ffffff', 4);
    particles.createHitSparks(beamStartX + this.facing * (Math.random() * beamLength), beamY, 4, '#ffee33');

    for (const z of zombies) {
      if (z.isDead) continue;
      const isAhead = (this.facing > 0 && z.x > beamStartX && z.x < beamStartX + beamLength) ||
                      (this.facing < 0 && z.x < beamStartX && z.x > beamStartX - beamLength);
      if (isAhead && Math.abs(z.y - beamY) < 70) {
        const dmg = 24 * (this.damageMultiplier || 1.0);
        const appliedDamage = z.takeDamage(dmg, this.facing, 500, true) ?? dmg;
        combat.registerHit(appliedDamage, true);
      }
    }
  }

  checkMeleeHits(zombies, range, damage, knockback, isCrit, sparkColor, camera, isUppercut = false, options = {}) {
    if (!zombies || !Array.isArray(zombies)) return false;
    let hitAny = false;

    for (const z of zombies) {
      if (z.isDead) continue;

      const dx = z.x - this.x;
      const dy = z.y - this.y;
      const isFacingTarget = (this.facing > 0 && dx > -45) || (this.facing < 0 && dx < 45) || Math.abs(dx) < 35;

      if (isFacingTarget && Math.hypot(dx, dy) < range + (z.radius || 20) + 40) {
        hitAny = true;
        const appliedDamage = z.takeDamage(damage, this.facing, knockback, isCrit) ?? damage;
        combat.registerHit(appliedDamage, isCrit);
        const impactY = z.y - (z.height || 50) * 0.5;
        if (particles.emitImpact) {
          particles.emitImpact(options.impactTier || (isCrit ? 'heavy' : 'light'), z.x, impactY, {
            color: sparkColor,
            direction: this.facing,
            seed: ((z.x || 0) * 37 + this.comboStep * 101) | 0
          });
        } else {
          particles.createHitSparks(z.x, impactY, isCrit ? 12 : 4, sparkColor);
        }

        if (isUppercut && !z.isBoss) {
          z.vy = -720;
          this.airJuggleTarget = z;
        }
        if (options.bounce && !z.isBoss) z.vy = Math.min(z.vy || 0, -380);
        if (options.wallRebound && !z.isBoss && Math.abs(z.x) >= 990) {
          z.vx = -Math.sign(z.x) * Math.abs(knockback * 0.62);
          z.vy = Math.min(z.vy || 0, -300);
        }
        if (options.stun > 0) z.stunTimer = Math.max(z.stunTimer || 0, options.stun);

        if (isCrit || damage >= 40) {
          const words = ['POW!', 'KRAK!', 'SLASH!', 'SMASH!', 'WHAM!', 'ORA!'];
          particles.addComicPopup(z.x, z.y - 30, words[Math.floor(Math.random() * words.length)], '#ff0044', '#ffee00');
          if (options.impactTier !== 'heavy') {
            particles.triggerSpeedlines({
              x: z.x,
              y: impactY,
              duration: Math.min(0.3, isCrit ? 0.26 : 0.2),
              count: isCrit ? 18 : 12,
              seed: ((z.x || 0) * 53 + combat.combo * 17) | 0
            });
          }
          audio.playBassDrop();
        }

        this.addSuper(5.0 * this.superGainRate * Math.min(1, appliedDamage / damage));

        if (this.lifesteal > 0) {
          const healAmount = appliedDamage * this.lifesteal;
          this.heal(healAmount);
        }
      }
    }

    if (hitAny && camera) {
      const tier = options.impactTier || (isCrit ? 'heavy' : 'light');
      camera.addHitstop(tier === 'heavy' ? 0.05 : (tier === 'medium' ? 0.025 : 0.012));
      if (tier === 'heavy') camera.addZoomPunch?.(0.035);
    }
    return hitAny;
  }

  handleSkillsAndAllies(input, groundY, camera, zombies) {
    if (input.actions.blockPressed && this.blockCooldown <= 0) {
      this.blockCooldown = 3.5;
      if (input.actions.down || !this.isGrounded) {
        projectiles.spawnAnvil(this.x + this.facing * 85, groundY, weapons.anvilDamage);
      } else {
        projectiles.spawnSketchBlock(this.x + this.facing * 75, groundY, 'obsidian');
      }
      audio.playBlockPlace();
      audio.playPlayerEffort();
    }

    if (input.actions.superPressed && this.superMeter >= this.maxSuper && !this.isAwakened) {
      this.activateAwakening(camera);
    }

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
    audio.playAwakening();
    if (camera) {
      camera.addShake(0.6);
      camera.addZoomPunch?.(0.08);
    }
    particles.addShockwave(this.x, this.y - 30, 200, '#ffee00', 12);
    particles.triggerSpeedlines({
      x: this.x,
      y: this.y - 30,
      duration: 0.3,
      count: 24,
      boss: true,
      seed: ((this.x * 31) ^ (this.y * 17) ^ 0xa11e) | 0
    });
    particles.addTextBanner(this.x, this.y - 80, '⚡ GOD MODE AWAKENED! ⚡', '#ffee00');
    speech.shout(this.x, this.y, 'playerAwakened', null, 2.4, { anchor: this, priority: 3 });
  }

  deactivateAwakening() {
    this.isAwakened = false;
    this.awakenedTimer = 0;
    particles.createDust(this.x, this.y, 8);
  }

  applyPhysics(dt, groundY, sketchBlocks) {
    if (this.standingPlatform && this.isGrounded && (this.platforms || []).includes(this.standingPlatform)) {
      this.x += this.standingPlatform.x - this.standingPlatformX;
      this.y += this.standingPlatform.y - this.standingPlatformY;
      this.standingPlatformX = this.standingPlatform.x;
      this.standingPlatformY = this.standingPlatform.y;
    } else if (!this.isGrounded) {
      this.standingPlatform = null;
    }

    const gravity = this.isAwakened ? 600 : 1300;
    if (!this.diveKick) {
      this.vy += gravity * dt;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y >= groundY) {
      if (this.diveKick) {
        this.diveKick = false;
        this.pose = 'idle';
        audio.playPunch('heavy');
        particles.addShockwave(this.x, groundY, 150, '#ffaa00', 10);
        particles.createDust(this.x, groundY, 14);
        this.applyGroundSlamDamage(this.currentZombies, 150, 48);
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
      this.standingPlatform = null;
    } else {
      this.isGrounded = false;
    }

    const arenaBound = 1075;
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

    if (this.vy >= 0 && !this.isCrouching) {
      const platformGroups = [sketchBlocks || [], this.platforms || []];
      for (const group of platformGroups) {
        for (const b of group) {
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
            this.applyGroundSlamDamage(this.currentZombies, 125, 42);
          } else if (!this.isGrounded && this.vy > 100) {
            audio.playLand();
          }
          this.y = bTop;
          this.vy = 0;
          this.isGrounded = true;
          this.canDoubleJump = true;
          this.isWallSliding = false;
          if ((this.platforms || []).includes(b)) {
            this.standingPlatform = b;
            this.standingPlatformX = b.x;
            this.standingPlatformY = b.y;
          } else {
            this.standingPlatform = null;
          }
        }
        }
      }
    }
  }

  applyGroundSlamDamage(zombies, radius, baseDamage) {
    if (!Array.isArray(zombies)) return;
    for (const z of zombies) {
      if (z.isDead || Math.hypot(z.x - this.x, z.y - this.y) > radius + (z.radius || 20)) continue;
      const direction = z.x >= this.x ? 1 : -1;
      const damage = baseDamage * this.damageMultiplier;
      const appliedDamage = z.takeDamage(damage, direction, 620, true) ?? damage;
      combat.registerHit(appliedDamage, true);
      particles.createHitSparks(z.x, z.y - 25, 8, '#ffaa00');
    }
    if (this.currentCamera) this.currentCamera.addShake(0.35);
  }

  updatePose() {
    if (this.isRolling || this.diveKick) return;

    if (this.attackTimer > 0 || this.weaponTimer > 0) {
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

  equipTemporaryWeapon(type, duration = 18) {
    if (!['staff', 'eraser'].includes(type)) return false;
    this.weaponType = type;
    this.temporaryWeaponTimer = Math.max(0, duration);
    const label = type === 'staff' ? 'STAFF SWEEP!' : 'ERASER STUN!';
    particles.addTextBanner(this.x, this.y - 82, `${label} 18s`, type === 'staff' ? '#ffd166' : '#dff4ff');
    audio.playUpgradeBuy?.();
    return true;
  }

  resetStageCombat(fullHeal = false) {
    if (fullHeal) this.hp = this.maxHp;
    this.isDead = false;
    this.deathTimer = 0;
    this.isHurt = false;
    this.hurtTimer = 0;
    this.iFrames = 0;
    this.superMeter = 0;
    this.isAwakened = false;
    this.awakenedTimer = 0;
    this.isFiringLaser = false;
    this.comboStep = 0;
    this.comboResetTimer = 0;
    this.attackTimer = 0;
    this.weaponTimer = 0;
    this.activeMove = null;
    this.bufferedMove = null;
    this.movePhase = 'idle';
    this.moveProgress = 0;
    this.isRolling = false;
    this.rollTimer = 0;
    this.rollCooldown = 0;
    this.blockCooldown = 0;
    this.laserTickTimer = 0;
    this.diveKick = false;
    this.jumpBuffer = 0;
    this.coyoteTimer = 0;
    this.canDoubleJump = true;
    this.isCrouching = false;
    this.isWallSliding = false;
    this.wallDir = 0;
    this.airJuggleTarget = null;
    this.ghostTrails.length = 0;
    this.ghostTrailTimer = 0;
    this.cancelHook(true);
    this.pose = 'idle';
    this.vx = 0;
    this.vy = 0;
    this.squashX = 1;
    this.squashY = 1;
    this.standingPlatform = null;
  }

  takeDamage(amount, knockbackDir = 0, knockbackPower = 300) {
    if (this.isDead || this.iFrames > 0 || this.isRolling || this.isAwakened) return;

    this.hp = Math.max(0, this.hp - amount);
    this.isHurt = true;
    this.hurtTimer = 0.25;
    this.iFrames = 0.9; // Solid invulnerability frames to prevent spam hits

    if (knockbackDir !== 0) {
      this.vx = knockbackDir * knockbackPower;
      this.vy = -knockbackPower * 0.4;
    }

    audio.playPlayerHurt();
    audio.playPunch('heavy');
    particles.addDamageText(this.x, this.y - 40, amount, false, '#ff3344');
    particles.createHitSparks(this.x, this.y - 30, 8, '#ff3344');
    if (Math.random() < 0.45) {
      speech.shout(this.x, this.y, 'playerHurt', null, 1.6, { anchor: this });
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

    for (const ghost of this.ghostTrails) {
      this.renderer.draw(ctx, {
        x: ghost.x,
        y: ghost.y,
        facing: ghost.facing,
        pose: ghost.pose,
        animTimer: ghost.timer,
        isGrounded: true,
        isHurt: false,
        isAwakened: false,
        scale: 1.0,
        alpha: ghost.alpha
      });
    }

    this.drawHookPreview(ctx);
    this.drawVectorHook(ctx);

    if (this.iFrames > 0 && Math.floor(this.simTime / 0.05) % 2 === 0) {
      return;
    }

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
      leanAngle: this.leanAngle,
      actionPhase: this.activeMove ? this.moveProgress : null
    });

    if (this.isAwakened && this.isFiringLaser && this.pose !== 'roll') {
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

  drawHookPreview(ctx) {
    if (this.hookCooldown > 0 || this.hookVisualTimer > 0 || this.isDead || this.isAwakened) return;
    const targets = this.currentZombies || [];
    let anchor = null;
    const pullables = [];
    for (const target of targets) {
      if (!target || target.isDead) continue;
      const forward = this.facing * (target.x - this.x);
      const vertical = Math.abs((target.y - (target.height || 50) * 0.4) - (this.y - 32));
      if (forward < 24 || forward > this.hookRange + (target.radius || 0) || vertical > 110) continue;
      if (target.isBoss || target.hookClass === 'anchor') {
        if (!anchor || forward < this.facing * (anchor.x - this.x)) anchor = target;
      } else if (target.hookClass === 'pullable' && pullables.length < 8) {
        pullables.push(target);
      }
    }
    const previews = anchor ? [anchor] : pullables;
    if (previews.length === 0) return;
    ctx.save();
    ctx.globalAlpha = 0.48 + Math.sin(this.simTime * 7) * 0.12;
    ctx.strokeStyle = anchor ? '#ff4057' : '#25ddff';
    ctx.lineWidth = 2;
    for (const target of previews) {
      const y = target.y - (target.height || 50) * 0.5;
      const r = (target.radius || 18) + 9;
      ctx.beginPath();
      ctx.arc(target.x, y, r, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.arc(target.x, y, r, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawVectorHook(ctx) {
    if (this.hookVisualTimer <= 0 || this.hookLines.length === 0) return;

    const alpha = Math.max(0, Math.min(1, this.hookVisualTimer / this.hookVisualDuration));
    const startX = this.x + this.hookCastFacing * 14;
    const startY = this.y - 38;
    const color = this.hookMode === 'anchor'
      ? '#ff4057'
      : (this.hookMode === 'miss' ? '#90a4b8' : '#25ddff');

    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha * 1.4);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = this.hookMode === 'anchor' ? 5 : 3;
    ctx.setLineDash(this.hookMode === 'anchor' ? [12, 5] : [8, 6]);

    for (const line of this.hookLines) {
      const target = line.target;
      const endX = target && Number.isFinite(target.x) ? target.x : line.x;
      const endY = target && Number.isFinite(target.y)
        ? target.y - (target.height || 50) * 0.45
        : line.y;
      const sag = Math.min(34, Math.abs(endX - startX) * 0.08);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo((startX + endX) * 0.5, Math.max(startY, endY) + sag, endX, endY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(endX, endY, this.hookMode === 'anchor' ? 9 : 7, -Math.PI * 0.35, Math.PI * 1.15);
      ctx.stroke();
      ctx.setLineDash(this.hookMode === 'anchor' ? [12, 5] : [8, 6]);
    }

    ctx.restore();
  }
}
