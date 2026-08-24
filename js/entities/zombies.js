// Stick Zombie Horde Entities (Walker, Runner, Spitter, Brute, Titan Boss)

import { StickFigureRenderer } from './stickman.js?v=8.2';
import { particles } from '../engine/particles.js?v=8.2';
import { audio } from '../engine/audio.js?v=8.2';
import { projectiles } from './projectiles.js?v=8.2';
import { combat } from '../systems/combat.js?v=8.2';
import { speech } from '../engine/speech.js?v=8.2';

const HOOK_PULL_ARENA_BOUND = 1060;
const ZOMBIE_ARENA_BOUND = 1060;

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
    this.windupTarget = null;
    this.attackCooldown = 0;
    this.stateTimer = 0;
    this.actionPhase = 'idle';
    this.actionKind = null;
    this.actionTimer = 0;
    this.actionDuration = 0;
    this.actionHitApplied = false;

    // Status modifiers
    this.freezeTimer = 0;
    this.stunTimer = 0;
    this.isGrounded = false;
    this.hookPullTimer = 0;
    this.hookPullSource = null;
    this.hookPullSide = 1;
    this.hookPullStopDistance = 76;
    this.leapActive = false;
    this.glitchHopCooldown = 0.35 + Math.random() * 0.5;
    this.combatTargets = [];

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
        this.hookClass = 'immune';
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
        this.hookClass = 'pullable';
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
        this.hookClass = 'anchor';
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
        this.hookClass = 'anchor';
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
        this.hookClass = 'pullable';
        break;
    }
  }

  update(dt, groundY, player, sketchBlocks, camera, platforms = [], zombies = [], friendlyTargets = []) {
    if (this.isDead) return;

    this.platforms = platforms;
    this.animTimer += dt;
    this.stateTimer += dt;

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
    if (this.freezeTimer > 0) this.freezeTimer -= dt;
    if (this.glitchHopCooldown > 0) this.glitchHopCooldown -= dt;

    // The hook owns movement for a few frames so ordinary AI cannot overwrite
    // the pull velocity before physics integration.
    if (this.hookPullTimer > 0) {
      this.updateHookPull(dt, groundY, sketchBlocks);
      return;
    }

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

    // 3. AI Behaviors. Nearby vulnerable allies can intercept attention, but
    // distant summons never drag a zombie away from Orange across the arena.
    const combatTargets = this.getCombatTargets(player, friendlyTargets);
    const target = this.type === 'titan_boss'
      ? (this.isValidCombatTarget(player) ? player : null)
      : this.selectCombatTarget(player, friendlyTargets);

    if (this.actionPhase !== 'idle') {
      this.updateHeavyAction(dt, combatTargets, camera);
      this.applyPhysics(dt, groundY, sketchBlocks);
      return;
    }

    // Ordinary enemies can make one cheap physics hop toward a nearby target
    // on a platform. This closes the permanent safe-ledge exploit without a
    // pathfinder, extra entities, or a new attack to teach the player.
    if (target && this.tryGlitchHop(target, currentSpeed)) {
      this.applyPhysics(dt, groundY, sketchBlocks);
      return;
    }

    // A runner's leap has a physical contact hitbox. It can collide with the
    // ally that blocks its path even if the jump originally started at Orange;
    // the collision is spatial, not a mid-air target snap.
    if (this.type === 'runner' && this.leapActive) {
      let contactTarget = null;
      let nearestContact = 54;
      for (const candidate of combatTargets) {
        if (!this.isValidCombatTarget(candidate)) continue;
        const contactDistance = Math.hypot(candidate.x - this.x, candidate.y - this.y);
        if (contactDistance < nearestContact) {
          contactTarget = candidate;
          nearestContact = contactDistance;
        }
      }
      if (contactTarget) {
        this.leapActive = false;
        this.attackCooldown = Math.max(this.attackCooldown, 1.2);
        audio.playZombieGroan();
        contactTarget.takeDamage(this.damage, contactTarget.x >= this.x ? 1 : -1, 320);
        this.applyPhysics(dt, groundY, sketchBlocks);
        return;
      }
      if (this.isGrounded) this.leapActive = false;
    }

    // Finish only the attack that was visibly telegraphed. If that ally has
    // already retreated, the bite misses instead of snapping onto Orange.
    if (this.windupTimer > 0) {
      this.windupTimer -= dt;
      this.vx = 0;
      this.pose = 'attack_jab';
      if (this.windupTimer <= 0) {
        const strikeTarget = this.windupTarget;
        this.windupTarget = null;
        if (this.isValidCombatTarget(strikeTarget)
            && Math.hypot(strikeTarget.x - this.x, strikeTarget.y - this.y) < 60) {
          this.biteTarget(strikeTarget);
        }
      }
      this.applyPhysics(dt, groundY, sketchBlocks);
      return;
    }

    if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);

      this.facing = dx >= 0 ? 1 : -1;

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
            this.windupTarget = target;
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
          // A low, fast arc crosses the target's body instead of harmlessly
          // sailing over it, while still leaving a readable jump silhouette.
          this.vy = -320;
          this.vx = this.facing * (currentSpeed * 1.5);
          this.isGrounded = false;
          this.leapActive = true;
          this.pose = 'jump_rise';
          this.attackCooldown = 1.8;
          audio.playRunnerScreech();
          audio.playWhoosh();
        } else if (dist <= 50) {
          this.vx = 0;
          if (this.attackCooldown <= 0) {
            this.windupTimer = 0.22;
            this.windupTarget = target;
            this.pose = 'attack_kick';
          } else {
            this.pose = 'zombie_idle';
          }
        }
      } else if (this.type === 'spitter') {
        // Ranged Spitter
        const retreatBlocked = (this.x <= -ZOMBIE_ARENA_BOUND + 8 && this.facing > 0)
          || (this.x >= ZOMBIE_ARENA_BOUND - 8 && this.facing < 0);
        if (dist < this.preferredDist - 60 && !retreatBlocked) {
          this.vx = -this.facing * (currentSpeed * 0.8);
          this.pose = 'zombie_walk';
        } else if (dist > this.preferredDist + 80) {
          this.vx = this.facing * currentSpeed;
          this.pose = 'zombie_walk';
        } else {
          this.vx = 0;
          if (this.attackCooldown <= 0) {
            this.spitAcid(target);
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
            this.beginHeavyAction('brute_slam');
          } else {
            this.pose = 'zombie_idle';
          }
        }
      } else if (this.type === 'titan_boss') {
        // Boss AI
        this.updateBossAI(dt, dist, target, camera, combatTargets);
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

  updateBossAI(dt, dist, target, camera, combatTargets = [target]) {
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
        this.beginHeavyAction('titan_smash');
      }
    }
  }

  beginHeavyAction(kind) {
    if (this.actionPhase !== 'idle') return false;
    const isTitan = kind === 'titan_smash';
    this.actionKind = isTitan ? 'titan_smash' : 'brute_slam';
    this.actionPhase = 'windup';
    this.actionDuration = isTitan ? 0.75 : 0.55;
    this.actionTimer = this.actionDuration;
    this.actionHitApplied = false;
    this.vx = 0;
    this.pose = 'attack_cross';
    // This sound is deliberately restrained; the ground ring carries the
    // warning while the impact sounds remain reserved for the active frame.
    audio.playWhoosh();
    return true;
  }

  updateHeavyAction(dt, combatTargets, camera) {
    if (this.actionPhase === 'idle') return false;
    const actionDt = dt * (this.freezeTimer > 0 ? 0.45 : 1);
    this.vx = 0;

    if (this.actionPhase === 'windup') {
      this.pose = 'attack_cross';
      this.actionTimer = Math.max(0, this.actionTimer - actionDt);
      if (this.actionTimer <= 0) {
        this.actionPhase = 'active';
        this.actionDuration = 0.1;
        this.actionTimer = this.actionDuration;
        if (!this.actionHitApplied) {
          this.actionHitApplied = true;
          if (this.actionKind === 'titan_smash') this.titanSmash(combatTargets, camera);
          else this.bruteSlam(combatTargets, camera);
        }
      }
      return true;
    }

    if (this.actionPhase === 'active') {
      this.pose = 'attack_cross';
      this.actionTimer = Math.max(0, this.actionTimer - actionDt);
      if (this.actionTimer <= 0) {
        this.actionPhase = 'recovery';
        this.actionDuration = this.actionKind === 'titan_smash' ? 0.65 : 0.45;
        this.actionTimer = this.actionDuration;
      }
      return true;
    }

    this.pose = 'zombie_idle';
    this.actionTimer = Math.max(0, this.actionTimer - actionDt);
    if (this.actionTimer <= 0) {
      const recoveryCooldown = this.actionKind === 'titan_smash' ? 1.1 : 1.4;
      this.actionPhase = 'idle';
      this.actionKind = null;
      this.actionDuration = 0;
      this.actionHitApplied = false;
      this.attackCooldown = Math.max(this.attackCooldown, recoveryCooldown);
    }
    return true;
  }

  cancelHeavyAction(cooldown = 0.65) {
    if (this.actionPhase === 'idle') return false;
    this.actionPhase = 'idle';
    this.actionKind = null;
    this.actionTimer = 0;
    this.actionDuration = 0;
    this.actionHitApplied = false;
    this.attackCooldown = Math.max(this.attackCooldown, cooldown);
    return true;
  }

  isValidCombatTarget(target) {
    if (!target || target.isDead || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return false;
    if (target.isAlly) return target.isTargetable === true && target.retreating !== true;
    return true;
  }

  getCombatTargets(player, friendlyTargets = []) {
    const targets = this.combatTargets;
    targets.length = 0;
    if (this.isValidCombatTarget(player)) targets.push(player);
    for (const ally of friendlyTargets || []) {
      if (this.isValidCombatTarget(ally)) targets.push(ally);
    }
    return targets;
  }

  selectCombatTarget(player, friendlyTargets = []) {
    const playerIsValid = this.isValidCombatTarget(player);
    let target = playerIsValid ? player : null;
    let bestScore = playerIsValid ? Math.hypot(player.x - this.x, player.y - this.y) : Infinity;

    for (const ally of friendlyTargets || []) {
      if (!this.isValidCombatTarget(ally)) continue;
      const distance = Math.hypot(ally.x - this.x, ally.y - this.y);
      // A small aggro bias makes the interception legible without letting a
      // summon drag enemies across the arena. Calling on the wrong side still
      // matters, but an ally near Orange is not ignored over a few pixels.
      const score = distance - 55;
      if (distance <= 340 && score < bestScore) {
        target = ally;
        bestScore = score;
      }
    }
    return target;
  }

  tryGlitchHop(target, currentSpeed) {
    if (this.isBoss || !this.isGrounded || this.glitchHopCooldown > 0 || !target) return false;
    const dx = target.x - this.x;
    const rise = this.y - target.y;
    if (rise <= 70 || Math.abs(dx) > 260 || Math.abs(dx) < 28) return false;

    this.facing = dx >= 0 ? 1 : -1;
    this.vy = this.type === 'brute' ? -500 : -540;
    this.vx = this.facing * Math.max(125, currentSpeed * (this.type === 'runner' ? 1.05 : 0.9));
    this.isGrounded = false;
    this.leapActive = false;
    this.pose = 'jump_rise';
    this.glitchHopCooldown = 1.65 + (this.animTimer % 0.45);
    particles.createDust(this.x, this.y, 3, -this.facing);
    return true;
  }

  applyHookPull(source, duration = 0.34, stopDistance = 76) {
    if (this.isDead || this.hookClass !== 'pullable' || !source) return false;
    this.hookPullSource = source;
    this.hookPullSide = source.facing >= 0 ? 1 : -1;
    this.hookPullTimer = Math.max(this.hookPullTimer, duration);
    this.hookPullStopDistance = Math.max(58, stopDistance);
    this.windupTimer = 0;
    this.windupTarget = null;
    this.attackCooldown = Math.max(this.attackCooldown, duration + 0.3);
    if (Math.abs(this.x - source.x) <= this.hookPullStopDistance) {
      // The hook gathers; it must never push an enemy that is already in the
      // intended melee pocket farther away from Orange.
      this.hookPullTimer = 0;
      this.hookPullSource = null;
      this.vx = 0;
    }
    return true;
  }

  updateHookPull(dt, groundY, sketchBlocks) {
    const source = this.hookPullSource;
    if (!source || source.isDead || !Number.isFinite(source.x)) {
      this.hookPullTimer = 0;
      this.hookPullSource = null;
      this.vx *= 0.3;
      this.applyPhysics(dt, groundY, sketchBlocks);
      return;
    }

    this.hookPullTimer = Math.max(0, this.hookPullTimer - dt);
    const destinationX = Math.max(
      -HOOK_PULL_ARENA_BOUND,
      Math.min(HOOK_PULL_ARENA_BOUND, source.x + this.hookPullSide * this.hookPullStopDistance)
    );
    const dx = destinationX - this.x;
    const distance = Math.abs(dx);
    this.facing = dx >= 0 ? 1 : -1;
    this.pose = 'zombie_walk';
    if (distance <= 12) {
      this.hookPullTimer = 0;
      this.hookPullSource = null;
      this.vx *= 0.2;
    } else {
      this.vx = this.facing * Math.min(760, Math.max(360, distance * 4));
    }
    if (this.hookPullTimer <= 0) {
      this.attackCooldown = Math.max(this.attackCooldown, 0.3);
      this.hookPullSource = null;
    }
    this.applyPhysics(dt, groundY, sketchBlocks);
  }

  applyPhysics(dt, groundY, sketchBlocks) {
    // Gravity
    this.vy += 950 * dt;
    if (this.hurtTimer > 0) {
      this.vx *= Math.pow(0.88, dt * 60);
    }
    const previousY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Clamp every ordinary enemy and Titan to the painted arena so knockback
    // and retreat behavior cannot strand the last target offscreen.
    if (this.x <= -ZOMBIE_ARENA_BOUND) {
      this.x = -ZOMBIE_ARENA_BOUND;
      if (this.vx < 0) this.vx = 0;
    } else if (this.x >= ZOMBIE_ARENA_BOUND) {
      this.x = ZOMBIE_ARENA_BOUND;
      if (this.vx > 0) this.vx = 0;
    }

    // Sketch Block and Platform collisions. Check the swept vertical crossing
    // before the ground so a low frame rate cannot tunnel through a ledge.
    let landedOnPlatform = false;
    if (this.vy >= 0) {
      landedOnPlatform = this.landOnPlatformCollection(sketchBlocks, previousY)
        || this.landOnPlatformCollection(this.platforms, previousY);
    }

    // Ground collision
    if (!landedOnPlatform && this.y >= groundY) {
      this.y = groundY;
      this.vy = 0;
      this.isGrounded = true;
    } else if (!landedOnPlatform) {
      this.isGrounded = false;
    }
  }

  landOnPlatformCollection(platforms, previousY) {
    if (!platforms || platforms.length === 0) return false;
    for (const platform of platforms) {
      const halfW = (platform.width || 60) / 2;
      const top = platform.y - (platform.height || 60);
      if (this.x + this.radius > platform.x - halfW
          && this.x - this.radius < platform.x + halfW
          && previousY <= top + 5
          && this.y >= top) {
        this.y = top;
        this.vy = 0;
        this.isGrounded = true;
        return true;
      }
    }
    return false;
  }

  biteTarget(target) {
    this.attackCooldown = 1.2;
    audio.playZombieGroan();
    target.takeDamage(this.damage, this.facing, 250);
  }

  spitAcid(target) {
    this.attackCooldown = 2.4;
    audio.playSpitterSpit();
    const dx = target.x - this.x;
    const dy = (target.y - (target.height || 60) * 0.5) - (this.y - 40);
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 420;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed - 120;

    projectiles.spawnAcidBlob(this.x + this.facing * 20, this.y - 40, vx, vy);
  }

  bruteSlam(targets, camera) {
    audio.playBruteStomp();
    camera?.addShake?.(0.4);
    particles.addShockwave(this.x + this.facing * 40, this.y, 140, '#228833', 10);

    for (const target of targets || []) {
      if (!this.isValidCombatTarget(target)) continue;
      const dist = Math.hypot(target.x - this.x, target.y - this.y);
      if (dist < 150) target.takeDamage(this.damage, target.x >= this.x ? 1 : -1, 500);
    }
  }

  titanSmash(targets, camera) {
    audio.playBossRoar();
    camera?.addShake?.(0.8);
    particles.addShockwave(this.x + this.facing * 50, this.y, 240, '#ff2244', 16);
    particles.createHitSparks(this.x, this.y, 25, '#ff3344');

    for (const target of targets || []) {
      if (!this.isValidCombatTarget(target)) continue;
      const dist = Math.hypot(target.x - this.x, target.y - this.y);
      if (dist < 220) target.takeDamage(this.damage, target.x >= this.x ? 1 : -1, 700);
    }
  }

  takeDamage(amount, knockbackDir = 1, knockbackPower = 380, isCrit = false) {
    if (this.isDead) return;

    this.hp -= amount;
    this.isHurt = true;
    this.hurtTimer = 0.32; // Hit-stun duration
    this.windupTimer = 0; // Interrupt any pending attack immediately!
    this.windupTarget = null;
    this.cancelHeavyAction(0.65);
    this.leapActive = false;
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
    this.windupTimer = 0;
    this.windupTarget = null;
    this.cancelHeavyAction(0.65);
    this.leapActive = false;
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

  draw(ctx, crowded = false) {
    if (this.isDead) return;

    // Freeze overlay
    const isFrozen = this.freezeTimer > 0;
    const isStunned = this.stunTimer > 0;

    this.drawHeavyTelegraph(ctx);

    // In a packed ordinary horde the per-stick green glow is expensive and
    // visually muddy. Bosses and any heavy currently communicating an action
    // keep it, while the renderer preserves the full zombie silhouette.
    const suppressOrdinaryGlow = crowded === true && !this.isBoss && this.actionPhase === 'idle';
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
      alpha: 1.0,
      actionPhase: this.getActionRenderPhase(),
      combatActionPhase: this.actionPhase,
      suppressGlow: suppressOrdinaryGlow
    });

    this.drawTypeSilhouette(ctx, suppressOrdinaryGlow);

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

  getActionRenderPhase() {
    if (this.actionPhase === 'windup' && this.actionDuration > 0) {
      return Math.max(0, Math.min(1, 1 - this.actionTimer / this.actionDuration));
    }
    if (this.actionPhase === 'active') return 1;
    if (this.actionPhase === 'recovery' && this.actionDuration > 0) {
      return Math.max(0, Math.min(1, this.actionTimer / this.actionDuration));
    }
    return null;
  }

  drawHeavyTelegraph(ctx) {
    if (this.actionPhase !== 'windup' || this.actionDuration <= 0) return;
    const isTitan = this.actionKind === 'titan_smash';
    const radius = isTitan ? 220 : 150;
    const color = isTitan ? '#ff2244' : '#70ff66';
    const progress = Math.max(0, Math.min(1, 1 - this.actionTimer / this.actionDuration));
    const pulse = 0.75 + Math.sin(this.animTimer * 15) * 0.15;

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.07 + progress * 0.11;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y - 2, radius, Math.max(18, radius * 0.11), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = Math.min(1, (0.48 + progress * 0.46) * pulse);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = isTitan ? 16 : 10;
    ctx.lineWidth = isTitan ? 6 : 4;
    ctx.setLineDash([16, 9]);
    ctx.beginPath();
    ctx.ellipse(this.x, this.y - 2, radius, Math.max(18, radius * 0.11), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // A tightening center arc gives young players an immediate countdown cue
    // even when the outer danger ring reaches beyond the camera edge.
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(this.x, this.y - 5, isTitan ? 43 : 31, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.restore();
  }

  drawTypeSilhouette(ctx, suppressOrdinaryGlow = false) {
    if (this.type === 'walker') return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (this.type === 'runner') {
      // A sharp rear fin and long ankle streak make runners readable even when
      // the horde is compressed into overlapping stick figures.
      ctx.fillStyle = '#8cff64';
      ctx.strokeStyle = '#102d16';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, -37);
      ctx.lineTo(-27, -31);
      ctx.lineTo(-10, -23);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#b8ff99';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -13); ctx.lineTo(-25, -5);
      ctx.moveTo(-5, -7); ctx.lineTo(-20, 1);
      ctx.stroke();
    } else if (this.type === 'spitter') {
      // A swollen back tank and forward nozzle distinguish the ranged enemy
      // from a walker before the first acid shot is fired.
      ctx.fillStyle = '#163f36';
      ctx.strokeStyle = '#76ff03';
      ctx.lineWidth = 2.5;
      if (!suppressOrdinaryGlow) {
        ctx.shadowColor = '#64dd17';
        ctx.shadowBlur = 7;
      }
      ctx.beginPath();
      ctx.ellipse(-10, -34, 11, 16, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(7, -39); ctx.lineTo(20, -35); ctx.lineTo(9, -31);
      ctx.stroke();
      ctx.fillStyle = '#b2ff59';
      const bubble = Math.sin(this.animTimer * 6) * 3;
      ctx.beginPath();
      ctx.arc(-12, -53 + bubble, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'brute') {
      // Wide shoulder plates and square fists preserve the brute's mass when
      // the underlying stick limbs overlap other enemies.
      ctx.fillStyle = '#26382c';
      ctx.strokeStyle = '#b8d8bf';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-27, -54); ctx.lineTo(-10, -66); ctx.lineTo(-2, -51);
      ctx.moveTo(27, -54); ctx.lineTo(10, -66); ctx.lineTo(2, -51);
      ctx.stroke();
      ctx.fillRect(13, -28, 15, 14);
      ctx.strokeRect(13, -28, 15, 14);
      ctx.fillRect(-28, -28, 15, 14);
      ctx.strokeRect(-28, -28, 15, 14);
    } else if (this.type === 'titan_boss') {
      // Horns, armored shoulders, and a bright core give Titan a unique boss
      // silhouette without introducing a bitmap or additional draw pass.
      ctx.fillStyle = '#07150a';
      ctx.strokeStyle = '#ff4866';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-18, -96); ctx.lineTo(-34, -116); ctx.lineTo(-8, -105);
      ctx.moveTo(18, -96); ctx.lineTo(34, -116); ctx.lineTo(8, -105);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-44, -72); ctx.lineTo(-17, -88); ctx.lineTo(-5, -66);
      ctx.moveTo(44, -72); ctx.lineTo(17, -88); ctx.lineTo(5, -66);
      ctx.stroke();
      ctx.fillStyle = '#ff1744';
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -65); ctx.lineTo(9, -53); ctx.lineTo(0, -41); ctx.lineTo(-9, -53);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
