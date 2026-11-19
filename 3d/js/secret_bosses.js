// ============================================================================
// Stick vs Zombies — Secret Bosses: Victim (AvA S3) & Herobrine (AvM S3)
// Zero Three.js — Shared by 2D Canvas & 3D Voxel Editions!
// ============================================================================

import { particles } from '../../js/engine/particles.js?v=9.8';
import { audio } from '../../js/engine/audio.js?v=9.8';
import { combat } from '../../js/systems/combat.js?v=9.8';
import { projectiles } from '../../js/entities/projectiles.js?v=9.8';
import { speech3d as speech } from './speech3d.js?v=10.3';

const LEFT = -950;
const RIGHT = 950;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function canHitTarget(target) {
  return Boolean(
    target &&
    !target.isDead &&
    !target.isRolling &&
    !target.isAwakened &&
    (target.iFrames || 0) <= 0
  );
}

// ============================================================================
// 1. HEROBRINE BOSS (Possessed Red — Glowing White Eyes, Blink Strike & Lightning)
// ============================================================================
export class HerobrineBoss {
  constructor(x, y) {
    Object.assign(this, {
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      groundY: y,
      type: 'herobrine_boss',
      name: 'HEROBRINE (POSSESSED)',
      hookClass: 'anchor',
      speechOffsetY: -125,
      bannerOffsetY: -155,
      isBoss: true,
      isSecretBoss: true,
      isDead: false,
      isGrounded: true,
      isHurt: false,
      isAwakened: false,
      maxHp: 1450,
      hp: 1450,
      radius: 30,
      height: 86,
      color: '#dc2626',
      accentColor: '#ffffff',
      inkReward: 650,
      scoreReward: 12000,
      phase: 1,
      state: 'idle',
      pose: 'idle',
      stateTimer: 0,
      stateDuration: 0,
      actionCooldown: 0.9,
      actionKind: null,
      attackIndex: 0,
      attackHit: false,
      animTimer: 0,
      hurtTimer: 0,
      freezeTimer: 0,
      stunTimer: 0,
      facing: -1,
      blinkAlpha: 1.0,
      blinkTargetX: x,
      pillarsResolved: false,
      camera: null
    });
    this.pillarXs = new Float32Array(3);
  }

  getActionRenderPhase() {
    if (!this.stateDuration || this.stateDuration <= 0) return 0;
    return clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
  }

  update(dt, groundY, player, sketchBlocks, camera) {
    if (this.isDead) return;
    const safeDt = clamp(Number(dt) || 0, 0, 0.05);
    this.animTimer += safeDt;
    this.groundY = groundY;
    this.camera = camera || this.camera;

    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.isAwakened = true;
      this.state = 'phase_shift';
      this.stateDuration = this.stateTimer = 0.8;
      this.vx = 0;
      this.pose = 'awakening_god';
      audio.playAwakening?.();
      camera?.addShake?.(0.65);
      particles.addShockwave(this.x, this.y - 45, 260, '#ffffff', 12);
      particles.addShockwave(this.x, this.y - 45, 190, '#c084fc', 10);
      particles.addTextBanner(this.x, this.y - 135, '👁️ HEROBRINE UNLEASHED! 👁️', '#ffffff');
      speech.spawnSpeechBubble(this, 'YOU CANNOT DELETE A LEGEND.', {
        style: 'shout',
        badge: '👁️ HEROBRINE',
        mood: '⚡',
        priority: 5,
        trauma: 1.0,
        anchor: this,
        bypassCooldown: true
      });
    }

    this.hurtTimer = Math.max(0, this.hurtTimer - safeDt);
    this.isHurt = this.hurtTimer > 0;
    this.freezeTimer = Math.max(0, this.freezeTimer - safeDt);
    this.stunTimer = Math.max(0, this.stunTimer - safeDt);

    const stepDt = safeDt * (this.freezeTimer > 0 ? 0.65 : 1);
    if (this.stunTimer > 0 && this.state !== 'phase_shift') {
      this.vx = 0;
      this.pose = 'hurt';
      this.blinkAlpha = 1.0;
    } else {
      this.updateAI(stepDt, player, camera);
    }

    this.x = clamp(this.x + this.vx * stepDt, LEFT, RIGHT);
    this.y = groundY;
  }

  updateAI(dt, player, camera) {
    if (!player || player.isDead) {
      this.vx *= 0.88;
      this.pose = 'idle';
      this.blinkAlpha = 1.0;
      return;
    }
    const dx = player.x - this.x;
    if (this.state === 'idle' || this.state === 'recovery') {
      this.facing = dx >= 0 ? 1 : -1;
      this.actionKind = null;
      this.blinkAlpha = Math.min(1, this.blinkAlpha + dt * 6);
    }

    switch (this.state) {
      case 'idle': {
        this.actionCooldown -= dt;
        if (Math.abs(dx) > 260) {
          this.vx = this.facing * (this.phase === 2 ? 240 : 180);
          this.pose = 'run';
        } else if (Math.abs(dx) < 110) {
          this.vx = -this.facing * 120;
          this.pose = 'run';
        } else {
          this.vx *= 0.85;
          this.pose = 'idle';
        }

        if (this.actionCooldown <= 0) {
          const mod = this.attackIndex % 3;
          this.attackIndex++;
          if (mod === 0) this.startBlinkStrike(player, camera);
          else if (mod === 1) this.startLightningPillars(player, camera);
          else this.startEnderBolts(player, camera);
        }
        break;
      }
      case 'phase_shift': {
        this.stateTimer -= dt;
        this.blinkAlpha = 1.0;
        if (this.stateTimer <= 0) this.recover(0.45);
        break;
      }
      case 'blink_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'herobrine_blink';
        this.blinkAlpha = Math.max(0.12, this.stateTimer / Math.max(0.01, this.stateDuration));
        this.pose = 'crouch';
        if (this.stateTimer <= 0) {
          // Teleport behind player with clean brief reveal before slash
          const behindX = clamp(player.x - (player.facing || 1) * 76, LEFT + 50, RIGHT - 50);
          particles.createHitSparks(this.x, this.y - 40, 12, '#ffffff');
          this.x = behindX;
          this.facing = player.x >= this.x ? 1 : -1;
          this.blinkAlpha = 1.0;
          this.state = 'blink_strike';
          this.stateDuration = this.stateTimer = 0.34;
          this.attackHit = false;
          this.pose = 'attack_cross';
          audio.playFlashStep?.();
          particles.addShockwave(this.x, this.y - 36, 95, '#ffffff', 8);
        }
        break;
      }
      case 'blink_strike': {
        this.stateTimer -= dt;
        this.actionKind = 'herobrine_blink';
        this.pose = 'attack_cross';
        this.vx = this.facing * 260;
        if (!this.attackHit && this.stateTimer <= 0.22 && canHitTarget(player)) {
          if (Math.abs(player.x - this.x) < 115 && Math.abs(player.y - this.groundY) < 90) {
            this.attackHit = true;
            player._pendingDamageCause = 'The Second Coming was erased by Herobrine\'s Blink Strike';
            player.takeDamage(this.phase === 2 ? 26 : 20, this.facing, 560);
            particles.createHitSparks(player.x, player.y - 35, 14, '#ffffff');
            camera?.addShake?.(0.35);
          }
        }
        if (this.stateTimer <= 0) this.recover(this.phase === 2 ? 0.48 : 0.65);
        break;
      }
      case 'pillars_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'herobrine_pillars';
        this.pose = 'awakening_god';
        if (this.stateTimer <= 0) {
          this.state = 'pillars_active';
          this.stateDuration = this.stateTimer = 0.4;
          this.pillarsResolved = false;
        }
        break;
      }
      case 'pillars_active': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'herobrine_pillars';
        this.pose = 'awakening_god';
        if (!this.pillarsResolved && this.stateTimer <= 0.22) {
          this.resolveLightningPillars(player, camera);
        }
        if (this.stateTimer <= 0) this.recover(this.phase === 2 ? 0.52 : 0.72);
        break;
      }
      case 'bolts_cast': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.pose = 'attack_uppercut';
        this.actionKind = 'herobrine_bolts';
        if (!this.attackHit && this.stateTimer <= 0.25) {
          this.attackHit = true;
          const count = this.phase === 2 ? 4 : 3;
          for (let i = 0; i < count; i++) {
            const spread = (i - (count - 1) * 0.5) * 85;
            projectiles.spawnViraDart?.(
              this.x + this.facing * 26,
              this.y - 54,
              this.facing * (410 + i * 35),
              spread - 35,
              this.phase === 2 ? 18 : 14
            );
          }
          audio.playSlash?.();
          particles.createHitSparks(this.x + this.facing * 28, this.y - 54, 12, '#e9d5ff');
        }
        if (this.stateTimer <= 0) this.recover(this.phase === 2 ? 0.48 : 0.65);
        break;
      }
      case 'recovery': {
        this.stateTimer -= dt;
        this.vx *= 0.85;
        this.pose = 'idle';
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.actionCooldown = this.phase === 2 ? 0.34 : 0.54;
        }
        break;
      }
      default:
        this.state = 'idle';
    }
  }

  startBlinkStrike(player, camera) {
    this.state = 'blink_windup';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.45 : 0.58;
    this.attackHit = false;
    speech.spawnSpeechBubble(this, 'BLINK... BEHIND YOU.', {
      style: 'shout',
      badge: '👁️ HEROBRINE',
      mood: '⚡',
      priority: 4,
      anchor: this
    });
    camera?.addShake?.(0.14);
  }

  startLightningPillars(player, camera) {
    this.state = 'pillars_windup';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.62 : 0.78;
    const base = clamp(player.x, LEFT + 90, RIGHT - 90);
    this.pillarXs[0] = base;
    this.pillarXs[1] = clamp(base - 175, LEFT + 60, RIGHT - 60);
    this.pillarXs[2] = clamp(base + 175, LEFT + 60, RIGHT - 60);
    this.pillarsResolved = false;
    audio.playDoomLaserCharge?.();
    camera?.addShake?.(0.18);
  }

  resolveLightningPillars(player, camera) {
    this.pillarsResolved = true;
    for (let i = 0; i < this.pillarXs.length; i++) {
      const px = this.pillarXs[i];
      particles.addShockwave(px, this.groundY - 12, 115, '#ffffff', 9);
      particles.createHitSparks(px, this.groundY - 45, 14, '#c084fc');
    }
    if (canHitTarget(player)) {
      for (const px of this.pillarXs) {
        if (Math.abs(player.x - px) < 68) {
          player._pendingDamageCause = 'The Second Coming was smote by Herobrine\'s Lightning Pillar';
          player.takeDamage(this.phase === 2 ? 25 : 19, player.x >= px ? 1 : -1, 480);
          break;
        }
      }
    }
    audio.playFinisherImpact?.();
    camera?.addShake?.(0.38);
  }

  startEnderBolts(player, camera) {
    this.state = 'bolts_cast';
    this.stateDuration = this.stateTimer = 0.45;
    this.attackHit = false;
    camera?.addShake?.(0.15);
  }

  recover(dur) {
    this.state = 'recovery';
    this.stateDuration = this.stateTimer = dur;
    this.actionKind = null;
    this.blinkAlpha = 1.0;
  }

  applyFreeze(dur = 3.5) {
    if (this.isDead) return false;
    this.freezeTimer = Math.max(this.freezeTimer, dur * 0.65);
    return true;
  }

  applyStun(dur = 1.5) {
    if (this.isDead) return false;
    this.stunTimer = Math.max(this.stunTimer, dur * 0.55);
    return true;
  }

  takeDamage(amount, knockbackDir = 1, knockbackPower = 240, isCrit = false) {
    if (this.isDead) return 0;
    const dmg = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - dmg);
    this.hurtTimer = 0.14;
    this.isHurt = true;
    this.x = clamp(this.x + Math.sign(knockbackDir || 1) * Math.min(24, knockbackPower * 0.04), LEFT, RIGHT);
    particles.addDamageText(this.x, this.y - 78, dmg, isCrit, isCrit ? '#ffea00' : '#ffffff');
    if (this.hp <= 0) this.die();
    return dmg;
  }

  die(silent = false) {
    if (this.isDead) return;
    this.isDead = true;
    this.hp = 0;
    combat.registerKill(this);
    if (!silent) {
      audio.playFinisherImpact?.();
      particles.addShockwave(this.x, this.y - 45, 290, '#ffffff', 14);
      particles.addTextBanner(this.x, this.y - 135, '👁️ HEROBRINE BANISHED! 👁️', '#e9d5ff');
      speech.spawnSpeechBubble(this, 'THE EYES... FADE...', {
        style: 'shout',
        badge: '👁️ HEROBRINE',
        mood: '💀',
        priority: 5,
        anchor: this,
        bypassCooldown: true
      });
    }
  }

  draw(ctx, crowded = false) {
    if (this.isDead) return;
    const t = this.animTimer || 0;
    const dir = this.facing >= 0 ? 1 : -1;

    ctx.save();
    // Lightning Pillar Telegraphs / Bolts
    if (this.state === 'pillars_windup' || this.state === 'pillars_active') {
      const active = this.state === 'pillars_active';
      for (let i = 0; i < this.pillarXs.length; i++) {
        const px = this.pillarXs[i];
        ctx.save();
        ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.85)' : 'rgba(192, 132, 252, 0.24)';
        ctx.fillRect(px - (active ? 26 : 42), this.groundY - (active ? 540 : 18), active ? 52 : 84, active ? 540 : 18);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = active ? 4 : 2;
        ctx.strokeRect(px - (active ? 26 : 42), this.groundY - (active ? 540 : 18), active ? 52 : 84, active ? 540 : 18);
        ctx.restore();
      }
    }

    ctx.globalAlpha = clamp(this.blinkAlpha ?? 1, 0.12, 1);
    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);

    if (!crowded) {
      ctx.shadowColor = this.phase === 2 ? '#e9d5ff' : '#ffffff';
      ctx.shadowBlur = this.phase === 2 ? 26 : 16;
    }

    const bob = Math.sin(t * 7) * 3;
    // Possessed Red stickman silhouette
    ctx.strokeStyle = this.isHurt ? '#ffffff' : '#dc2626';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Legs
    ctx.moveTo(0, -26 + bob); ctx.lineTo(-14, 0);
    ctx.moveTo(0, -26 + bob); ctx.lineTo(14, 0);
    // Spine
    ctx.moveTo(0, -26 + bob); ctx.lineTo(0, -58 + bob);
    // Arms
    const armLift = this.pose === 'awakening_god' ? -22 : 0;
    ctx.moveTo(0, -54 + bob); ctx.lineTo(-22, -38 + bob + armLift);
    ctx.moveTo(0, -54 + bob); ctx.lineTo(26, -42 + bob + armLift);
    ctx.stroke();

    // Solid crimson head
    ctx.fillStyle = this.isHurt ? '#ffffff' : '#dc2626';
    ctx.beginPath();
    ctx.arc(0, -74 + bob, 16, 0, Math.PI * 2);
    ctx.fill();

    // Iconic blazing white Herobrine eyes!
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 14;
    ctx.fillRect(2, -78 + bob, 6, 4);
    ctx.fillRect(10, -78 + bob, 5, 4);

    ctx.restore();
  }
}

// ============================================================================
// 2. VICTIM BOSS (AvA Season 3 CEO of Rocket Corp — The Box, Pause Lasso & Clones)
// ============================================================================
export class VictimBoss {
  constructor(x, y) {
    Object.assign(this, {
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      groundY: y,
      type: 'victim_boss',
      name: 'VICTIM (ROCKET CORP CEO)',
      hookClass: 'anchor',
      speechOffsetY: -125,
      bannerOffsetY: -155,
      isBoss: true,
      isSecretBoss: true,
      isDead: false,
      isGrounded: true,
      isHurt: false,
      isAwakened: false,
      maxHp: 1520,
      hp: 1520,
      radius: 30,
      height: 86,
      color: '#64748b',
      accentColor: '#38bdf8',
      inkReward: 700,
      scoreReward: 13000,
      phase: 1,
      state: 'idle',
      pose: 'idle',
      stateTimer: 0,
      stateDuration: 0,
      actionCooldown: 0.9,
      actionKind: null,
      attackIndex: 0,
      attackHit: false,
      animTimer: 0,
      hurtTimer: 0,
      freezeTimer: 0,
      stunTimer: 0,
      facing: -1,
      boxWallSpan: 280,
      lassoTargetX: x,
      camera: null
    });
    this.clones = [];
  }

  getActionRenderPhase() {
    if (!this.stateDuration || this.stateDuration <= 0) return 0;
    return clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
  }

  update(dt, groundY, player, sketchBlocks, camera) {
    if (this.isDead) return;
    const safeDt = clamp(Number(dt) || 0, 0, 0.05);
    this.animTimer += safeDt;
    this.groundY = groundY;
    this.camera = camera || this.camera;

    // Update Victim's wireframe clones
    for (let i = this.clones.length - 1; i >= 0; i--) {
      const c = this.clones[i];
      c.life -= safeDt;
      c.x = clamp(c.x + c.vx * safeDt, LEFT, RIGHT);
      if (!c.hasHit && canHitTarget(player) && Math.abs(player.x - c.x) < 42 && Math.abs(player.y - groundY) < 64) {
        c.hasHit = true;
        player._pendingDamageCause = 'The Second Coming was overwhelmed by Victim\'s Wireframe Clone';
        player.takeDamage(14, Math.sign(c.vx) || 1, 340);
        particles.createHitSparks(c.x, groundY - 34, 8, '#94a3b8');
        c.life = 0;
      }
      if (c.life <= 0) this.clones.splice(i, 1);
    }

    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.isAwakened = true;
      this.state = 'phase_shift';
      this.stateDuration = this.stateTimer = 0.8;
      this.vx = 0;
      this.pose = 'awakening_god';
      audio.playAwakening?.();
      camera?.addShake?.(0.65);
      particles.addShockwave(this.x, this.y - 45, 270, '#38bdf8', 12);
      particles.addTextBanner(this.x, this.y - 135, '🕶️ WELCOME TO THE BOX! 🕶️', '#94a3b8');
      speech.spawnSpeechBubble(this, 'IN THE BOX, I OWN EVERY FRAME.', {
        style: 'pixel',
        badge: '🕵️ VICTIM',
        mood: '!',
        priority: 5,
        trauma: 1.0,
        anchor: this,
        bypassCooldown: true
      });
    }

    this.hurtTimer = Math.max(0, this.hurtTimer - safeDt);
    this.isHurt = this.hurtTimer > 0;
    this.freezeTimer = Math.max(0, this.freezeTimer - safeDt);
    this.stunTimer = Math.max(0, this.stunTimer - safeDt);

    const stepDt = safeDt * (this.freezeTimer > 0 ? 0.68 : 1);
    if (this.stunTimer > 0 && this.state !== 'phase_shift') {
      this.vx = 0;
      this.pose = 'hurt';
    } else {
      this.updateAI(stepDt, player, camera);
    }

    this.x = clamp(this.x + this.vx * stepDt, LEFT, RIGHT);
    this.y = groundY;
  }

  updateAI(dt, player, camera) {
    if (!player || player.isDead) {
      this.vx *= 0.88;
      this.pose = 'idle';
      return;
    }
    const dx = player.x - this.x;
    if (this.state === 'idle' || this.state === 'recovery') {
      this.facing = dx >= 0 ? 1 : -1;
      this.actionKind = null;
    }

    switch (this.state) {
      case 'idle': {
        this.actionCooldown -= dt;
        if (Math.abs(dx) > 280) {
          this.vx = this.facing * (this.phase === 2 ? 210 : 160);
          this.pose = 'run';
        } else if (Math.abs(dx) < 120) {
          this.vx = -this.facing * 120;
          this.pose = 'run';
        } else {
          this.vx *= 0.85;
          this.pose = 'idle';
        }

        if (this.actionCooldown <= 0) {
          const mod = this.attackIndex % 3;
          this.attackIndex++;
          if (mod === 0) this.startCloneSwarm(player, camera);
          else if (mod === 1) this.startPauseLasso(player, camera);
          else this.startBoxCrush(player, camera);
        }
        break;
      }
      case 'phase_shift': {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.recover(0.45);
        break;
      }
      case 'clone_cast': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.pose = 'attack_cross';
        this.actionKind = 'victim_clones';
        if (!this.attackHit && this.stateTimer <= 0.25) {
          this.attackHit = true;
          const count = this.phase === 2 ? 3 : 2;
          for (let i = 0; i < count; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const spawnX = clamp(this.x + side * (75 + i * 55), LEFT + 40, RIGHT - 40);
            const dir = player.x >= spawnX ? 1 : -1;
            this.clones.push({
              x: spawnX,
              y: this.groundY,
              vx: dir * (this.phase === 2 ? 420 : 340),
              life: 2.2,
              hasHit: false
            });
            particles.createHitSparks(spawnX, this.groundY - 36, 8, '#94a3b8');
          }
          audio.playFlashStep?.();
        }
        if (this.stateTimer <= 0) this.recover(this.phase === 2 ? 0.5 : 0.7);
        break;
      }
      case 'lasso_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.pose = 'weapon_slash';
        this.actionKind = 'victim_lasso';
        if (this.stateTimer <= 0) {
          this.state = 'lasso_snap';
          this.stateDuration = this.stateTimer = 0.35;
          if (canHitTarget(player) && Math.abs(player.x - this.lassoTargetX) < 82 && Math.abs(player.y - this.groundY) < 95) {
            player._pendingDamageCause = 'The Second Coming was trapped in Victim\'s UI Pause Box';
            player.takeDamage(this.phase === 2 ? 22 : 16, player.x >= this.x ? 1 : -1, 420);
            particles.addComicPopup(player.x, player.y - 68, '⏸️ PAUSED!', '#38bdf8', '#ffffff');
          }
          particles.addShockwave(this.lassoTargetX, this.groundY - 30, 120, '#38bdf8', 9);
          audio.playMouseClick?.();
          camera?.addShake?.(0.28);
        }
        break;
      }
      case 'lasso_snap': {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.recover(this.phase === 2 ? 0.45 : 0.65);
        break;
      }
      case 'box_crush_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.pose = 'awakening_god';
        this.actionKind = 'victim_box';
        this.boxWallSpan = 260;
        if (this.stateTimer <= 0) {
          this.state = 'box_crush_active';
          this.stateDuration = this.stateTimer = 0.42;
          this.attackHit = false;
        }
        break;
      }
      case 'box_crush_active': {
        this.stateTimer -= dt;
        this.pose = 'attack_cross';
        this.actionKind = 'victim_box';
        const prog = clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
        this.boxWallSpan = 260 * (1 - prog * 0.85);
        if (!this.attackHit && prog >= 0.65 && canHitTarget(player)) {
          if (Math.abs(player.x - this.x) < 165 && Math.abs(player.y - this.groundY) < 95) {
            this.attackHit = true;
            player._pendingDamageCause = 'The Second Coming was crushed inside Victim\'s Containment Box';
            player.takeDamage(this.phase === 2 ? 28 : 22, player.x >= this.x ? 1 : -1, 580);
            particles.addShockwave(this.x, this.groundY - 36, 175, '#94a3b8', 11);
            audio.playFinisherImpact?.();
            camera?.addShake?.(0.45);
          }
        }
        if (this.stateTimer <= 0) this.recover(this.phase === 2 ? 0.52 : 0.72);
        break;
      }
      case 'recovery': {
        this.stateTimer -= dt;
        this.vx *= 0.85;
        this.pose = 'idle';
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.actionCooldown = this.phase === 2 ? 0.36 : 0.56;
        }
        break;
      }
      default:
        this.state = 'idle';
    }
  }

  startCloneSwarm(player, camera) {
    this.state = 'clone_cast';
    this.stateDuration = this.stateTimer = 0.52;
    this.attackHit = false;
    speech.spawnSpeechBubble(this, 'CLONE. DUPLICATE. OVERRUN.', {
      style: 'pixel',
      badge: '🕵️ VICTIM',
      mood: '!',
      priority: 4,
      anchor: this
    });
    camera?.addShake?.(0.14);
  }

  startPauseLasso(player, camera) {
    this.state = 'lasso_windup';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.58 : 0.74;
    this.lassoTargetX = clamp(player.x, LEFT + 70, RIGHT - 70);
    audio.playMouseClick?.();
    camera?.addShake?.(0.12);
  }

  startBoxCrush(player, camera) {
    this.state = 'box_crush_windup';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.58 : 0.72;
    this.boxWallSpan = 260;
    camera?.addShake?.(0.16);
  }

  recover(dur) {
    this.state = 'recovery';
    this.stateDuration = this.stateTimer = dur;
    this.actionKind = null;
  }

  applyFreeze(dur = 3.5) {
    if (this.isDead) return false;
    this.freezeTimer = Math.max(this.freezeTimer, dur * 0.7);
    return true;
  }

  applyStun(dur = 1.5) {
    if (this.isDead) return false;
    this.stunTimer = Math.max(this.stunTimer, dur * 0.6);
    return true;
  }

  takeDamage(amount, knockbackDir = 1, knockbackPower = 240, isCrit = false) {
    if (this.isDead) return 0;
    const dmg = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - dmg);
    this.hurtTimer = 0.14;
    this.isHurt = true;
    this.x = clamp(this.x + Math.sign(knockbackDir || 1) * Math.min(22, knockbackPower * 0.04), LEFT, RIGHT);
    particles.addDamageText(this.x, this.y - 78, dmg, isCrit, isCrit ? '#ffea00' : '#e2e8f0');
    if (this.hp <= 0) this.die();
    return dmg;
  }

  die(silent = false) {
    if (this.isDead) return;
    this.isDead = true;
    this.hp = 0;
    this.clones.length = 0;
    combat.registerKill(this);
    if (!silent) {
      audio.playFinisherImpact?.();
      particles.addShockwave(this.x, this.y - 45, 290, '#38bdf8', 14);
      particles.addTextBanner(this.x, this.y - 135, '🕵️ VICTIM DEFEATED — THE BOX FALLS! 🕵️', '#38bdf8');
      speech.spawnSpeechBubble(this, 'THE BOX... SHATTERED...', {
        style: 'pixel',
        badge: '🕵️ VICTIM',
        mood: '💀',
        priority: 5,
        anchor: this,
        bypassCooldown: true
      });
    }
  }

  draw(ctx, crowded = false) {
    if (this.isDead) return;
    const t = this.animTimer || 0;
    const dir = this.facing >= 0 ? 1 : -1;

    ctx.save();
    // Draw UI Pause Lasso target box
    if (this.state === 'lasso_windup' || this.state === 'lasso_snap') {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = this.state === 'lasso_snap' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.fillRect(this.lassoTargetX - 65, this.groundY - 96, 130, 96);
      ctx.strokeRect(this.lassoTargetX - 65, this.groundY - 96, 130, 96);
      ctx.restore();
    }

    // Draw Box Compression Walls
    if (this.state === 'box_crush_windup' || this.state === 'box_crush_active') {
      ctx.save();
      ctx.fillStyle = 'rgba(100, 116, 139, 0.55)';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      const span = this.boxWallSpan || 200;
      ctx.fillRect(this.x - span - 24, this.groundY - 120, 24, 120);
      ctx.strokeRect(this.x - span - 24, this.groundY - 120, 24, 120);
      ctx.fillRect(this.x + span, this.groundY - 120, 24, 120);
      ctx.strokeRect(this.x + span, this.groundY - 120, 24, 120);
      ctx.restore();
    }

    // Draw Wireframe Clones
    for (const c of this.clones) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 54, 11, 0, Math.PI * 2);
      ctx.moveTo(c.x, c.y - 43); ctx.lineTo(c.x, c.y - 20);
      ctx.moveTo(c.x, c.y - 36); ctx.lineTo(c.x + Math.sign(c.vx) * 22, c.y - 34);
      ctx.moveTo(c.x, c.y - 20); ctx.lineTo(c.x - 10, c.y);
      ctx.moveTo(c.x, c.y - 20); ctx.lineTo(c.x + 10, c.y);
      ctx.stroke();
      ctx.restore();
    }

    // Victim Main Body (Hollow-headed Slate Grey Stickman — AvA 1 / Season 3 icon!)
    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);
    if (!crowded) {
      ctx.shadowColor = this.phase === 2 ? '#38bdf8' : 'rgba(148, 163, 184, 0.55)';
      ctx.shadowBlur = 16;
    }

    const bob = Math.sin(t * 5) * 2.5;
    ctx.strokeStyle = this.isHurt ? '#ffffff' : '#94a3b8';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -24 + bob); ctx.lineTo(-14, 0);
    ctx.moveTo(0, -24 + bob); ctx.lineTo(14, 0);
    ctx.moveTo(0, -24 + bob); ctx.lineTo(0, -56 + bob);
    ctx.moveTo(0, -50 + bob); ctx.lineTo(-18, -32 + bob);
    ctx.moveTo(0, -50 + bob); ctx.lineTo(24, -36 + bob);
    ctx.stroke();

    // Hollow grey head (classic AvA Victim silhouette!)
    ctx.beginPath();
    ctx.arc(0, -72 + bob, 16, 0, Math.PI * 2);
    ctx.stroke();

    // Rocket Corp glowing cyan UI reticle around chest
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -48 + bob, 20, 14);

    ctx.restore();
  }
}
