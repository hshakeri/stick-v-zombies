import { particles } from '../../js/engine/particles.js?v=9.8';
import { audio } from '../../js/engine/audio.js?v=9.8';
import { speech3d as speech } from './speech3d.js?v=10.3';
import { combat } from '../../js/systems/combat.js?v=9.8';
import { projectiles } from '../../js/entities/projectiles.js?v=9.8';
import { CAMPAIGN_BEATS } from '../../js/systems/stages.js?v=9.8';
import { WAVE_RECIPES } from '../../js/systems/waves.js?v=9.8';

const LEFT = -960;
const RIGHT = 960;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
let activeWaveDirector = null;

function canHitPlayer(player) {
  return Boolean(
    player &&
    !player.isDead &&
    !player.isRolling &&
    !player.isAwakened &&
    (player.iFrames || 0) <= 0
  );
}

// ============================================================================
// 1. ENDER DRAGON BOSS (Stage 18: The End)
// ============================================================================
export class EnderDragonBoss {
  constructor(x, y) {
    Object.assign(this, {
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      groundY: y,
      type: 'ender_dragon',
      name: 'ENDER DRAGON',
      hookClass: 'anchor',
      speechOffsetY: -135,
      bannerOffsetY: -165,
      isBoss: true,
      isDead: false,
      isGrounded: false,
      isHurt: false,
      isAwakened: false,
      maxHp: 1380,
      hp: 1380,
      radius: 62,
      height: 145,
      color: '#d946ef',
      inkReward: 520,
      scoreReward: 9500,
      phase: 1,
      state: 'idle',
      stateTimer: 0,
      stateDuration: 0,
      actionCooldown: 0.95,
      actionKind: null,
      attackIndex: 0,
      attackHit: false,
      animTimer: 0,
      hurtTimer: 0,
      freezeTimer: 0,
      stunTimer: 0,
      facing: -1,
      rollStartX: x,
      rollTargetX: x,
      rollDirection: -1,
      dropResolved: false,
      camera: null
    });
    this.dropXs = new Float32Array(3);
    this.friendlyHits = new Set();
    this.friendlyTargets = [];
  }

  getActionRenderPhase() {
    if (!this.stateDuration || this.stateDuration <= 0) return 0;
    return clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
  }

  update(dt, groundY, player, sketchBlocks, camera, platforms = [], enemies = [], friendlyTargets = []) {
    if (this.isDead) return;
    const safeDt = clamp(Number(dt) || 0, 0, 0.05);
    this.animTimer += safeDt;
    this.groundY = groundY;
    this.camera = camera || this.camera;
    this.friendlyTargets = friendlyTargets;

    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.isAwakened = true;
      this.state = 'phase_shift';
      this.stateDuration = this.stateTimer = 0.8;
      this.vx = 0;
      audio.playAwakening();
      camera?.addShake?.(0.5);
      particles.addShockwave(this.x, this.y - 75, 250, '#d946ef', 12);
      particles.addTextBanner(this.x, this.y - 140, 'DRAGON FURY!', '#e879f9');
      speech.spawnSpeechBubble(this, 'DRAGON FURY OVERDRIVE!', {
        style: 'shout',
        trauma: 1.0,
        priority: 5,
        mood: '💀',
        anchor: this
      });
      speech.triggerBanter([
        { speaker: 'orange', text: 'NOT SO FAST, OVERGROWN LIZARD!', delay: 0.3, options: { style: 'comic', priority: 3, mood: '⚡' } }
      ]);
    }

    this.hurtTimer = Math.max(0, this.hurtTimer - safeDt);
    this.isHurt = this.hurtTimer > 0;
    this.freezeTimer = Math.max(0, this.freezeTimer - safeDt);
    this.stunTimer = Math.max(0, this.stunTimer - safeDt);

    const stepDt = safeDt * (this.freezeTimer > 0 ? 0.7 : 1);
    if (this.stunTimer > 0 && this.state !== 'phase_shift') {
      this.vx = 0;
    } else {
      this.updateAI(stepDt, player, camera);
    }

    if (this.state !== 'swoop_active') {
      this.x += this.vx * stepDt;
    }
    this.y = groundY;
    this.x = clamp(this.x, LEFT, RIGHT);
  }

  updateAI(dt, player, camera) {
    if (!player || player.isDead) {
      this.vx *= 0.9;
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
        // Hover-glide toward optimal range
        if (Math.abs(dx) > 320) this.vx = this.facing * 135;
        else if (Math.abs(dx) < 150) this.vx = -this.facing * 90;
        else this.vx *= 0.88;

        if (this.actionCooldown <= 0) {
          const useBreath = (this.attackIndex % 2 === 1);
          this.attackIndex++;
          if (useBreath) this.startDragonBreath(player, camera);
          else this.startSwoop(player, camera);
        }
        break;
      }
      case 'phase_shift': {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.recover(0.55);
        break;
      }
      case 'swoop_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'dragon_swoop';
        if (this.stateTimer <= 0) {
          this.state = 'swoop_active';
          this.stateDuration = this.stateTimer = this.phase === 2 ? 0.48 : 0.58;
          this.rollStartX = this.x;
          audio.playWhoosh();
          camera?.addShake?.(0.25);
        }
        break;
      }
      case 'swoop_active': {
        this.stateTimer -= dt;
        this.actionKind = 'dragon_swoop';
        const progress = clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
        this.x = this.rollStartX + (this.rollTargetX - this.rollStartX) * progress;

        if (!this.attackHit && canHitPlayer(player)) {
          if (Math.abs(player.x - this.x) < this.radius + (player.radius || 20) + 18 &&
              Math.abs(player.y - this.groundY) < 95) {
            this.attackHit = true;
            player.takeDamage(this.phase === 2 ? 28 : 22, this.rollDirection, 540);
            particles.createHitSparks(player.x, player.y - 35, 10, '#e879f9');
          }
        }
        if (this.stateTimer <= 0) {
          particles.addShockwave(this.x, this.groundY - 20, 120, '#d946ef', 8);
          camera?.addShake?.(0.22);
          this.recover(this.phase === 2 ? 0.52 : 0.68);
        }
        break;
      }
      case 'breath_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'dragon_breath';
        if (this.stateTimer <= 0) {
          this.state = 'breath_active';
          this.stateDuration = this.stateTimer = 0.42;
          this.dropResolved = false;
        }
        break;
      }
      case 'breath_active': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'dragon_breath';
        if (!this.dropResolved && this.stateTimer <= 0.18) {
          this.resolveDragonBreath(player, camera);
        }
        if (this.stateTimer <= 0) {
          this.recover(this.phase === 2 ? 0.55 : 0.72);
        }
        break;
      }
      case 'recovery': {
        this.stateTimer -= dt;
        this.vx *= 0.85;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.actionCooldown = this.phase === 2 ? 0.35 : 0.52;
        }
        break;
      }
      default:
        this.state = 'idle';
    }
  }

  startSwoop(player, camera) {
    this.state = 'swoop_windup';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.55 : 0.68;
    this.rollStartX = this.x;
    this.rollDirection = player.x >= this.x ? 1 : -1;
    this.facing = this.rollDirection;
    this.rollTargetX = clamp(player.x + this.rollDirection * 280, LEFT + 60, RIGHT - 60);
    if (Math.abs(this.rollTargetX - this.x) < 280) {
      this.rollTargetX = clamp(player.x - this.rollDirection * 380, LEFT + 60, RIGHT - 60);
      this.rollDirection = Math.sign(this.rollTargetX - this.x) || 1;
      this.facing = this.rollDirection;
    }
    this.attackHit = false;
    speech.spawnBubble(this.x, this.y - 120, 'VOID SWOOP!', 'enderDragon:swoop', 1.2, {
      anchor: this,
      cooldownMs: 2500
    });
    camera?.addShake?.(0.15);
  }

  startDragonBreath(player, camera) {
    this.state = 'breath_windup';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.64 : 0.76;
    const base = clamp(player.x, LEFT + 80, RIGHT - 80);
    this.dropXs[0] = base;
    this.dropXs[1] = clamp(base - 170, LEFT + 60, RIGHT - 60);
    this.dropXs[2] = clamp(base + 170, LEFT + 60, RIGHT - 60);
    this.dropResolved = false;
    audio.playDoomLaserCharge?.();
    speech.spawnBubble(this.x, this.y - 120, 'DRAGON BREATH!', 'enderDragon:breath', 1.25, {
      anchor: this,
      cooldownMs: 2500
    });
    camera?.addShake?.(0.18);
  }

  resolveDragonBreath(player, camera) {
    this.dropResolved = true;
    const blastRadius = 72;
    for (let i = 0; i < this.dropXs.length; i++) {
      const bx = this.dropXs[i];
      particles.addShockwave(bx, this.groundY - 12, 95, '#d946ef', 8);
      particles.createHitSparks(bx, this.groundY - 24, 12, '#e879f9');
    }
    if (canHitPlayer(player) && Math.abs(player.y - this.groundY) < 75) {
      for (const bx of this.dropXs) {
        if (Math.abs(player.x - bx) < blastRadius + (player.radius || 20)) {
          player.takeDamage(this.phase === 2 ? 26 : 20, player.x >= bx ? 1 : -1, 450);
          break;
        }
      }
    }
    audio.playBruteStomp?.();
    camera?.addShake?.(0.32);
  }

  recover(duration) {
    this.state = 'recovery';
    this.stateDuration = this.stateTimer = duration;
    this.actionKind = null;
    this.vx = 0;
  }

  applyFreeze(duration = 4) {
    if (this.isDead) return false;
    this.freezeTimer = Math.max(this.freezeTimer, Math.min(0.75, duration * 0.18));
    return true;
  }

  applyStun(duration = 3) {
    if (this.isDead) return false;
    this.stunTimer = Math.max(this.stunTimer, Math.min(0.45, duration * 0.15));
    return true;
  }

  takeDamage(amount, knockbackDir = 1, knockbackPower = 200, isCrit = false) {
    if (this.isDead || !Number.isFinite(amount) || amount <= 0) return 0;
    const applied = Math.min(this.hp, amount);
    this.hp -= applied;
    this.hurtTimer = 0.13;
    this.isHurt = true;
    if (this.state === 'idle' || this.state === 'recovery') {
      this.vx = knockbackDir * Math.min(85, Math.max(0, knockbackPower) * 0.18);
    }
    particles.addDamageText(this.x, this.y - 115, applied, isCrit, '#e879f9');
    particles.createHitSparks(this.x, this.y - 75, 6, '#d946ef');
    if (this.hp <= 0) this.die();
    return applied;
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.hp = 0;
    this.vx = 0;
    this.state = 'defeated';
    combat.registerKill(this);
    audio.playBossVictoryFanfare?.();
    audio.playFinisherImpact?.();
    speech.triggerBanter([
      { speaker: 'ender_dragon', text: 'THE END... IS SILENT.', delay: 0, options: { style: 'shout', priority: 5, mood: '💀', anchor: this } },
      { speaker: 'orange', text: 'RESTORE KEY SECURED!', delay: 0.25, options: { style: 'comic', priority: 3, mood: '★' } }
    ]);
    this.camera?.addShake?.(0.78);
    this.camera?.addZoomPunch?.(0.08);
    particles.emitBossExplosion({
      x: this.x,
      y: this.y - 75,
      bodyY: this.y,
      groundY: this.groundY,
      color: '#d946ef',
      accent: '#f5d0fe',
      radius: 280,
      stickFigure: false,
      seed: 0x3d0e4d
    });
  }

  draw() {}
}

// ============================================================================
// 2. AVA SEASON 3 MERCENARIES (Stage 20: Rocket Corp HQ — Right Before H4C3R)
//    - Agent (Sunglasses + UI Toolbar Staff)
//    - Ballista (8-Bit Pixel Commando + Pixel Bazooka)
//    - Primal (Prehistoric Caveman + Stone Spear)
//    - Hazard (Caution-Sign Pictogram + High-Voltage Sign)
// ============================================================================
const MERCENARY_PROFILES = Object.freeze({
  mercenary_agent: {
    name: 'AGENT',
    color: '#1e293b',
    scale: 1.24,
    weaponType: 'toolbar_staff',
    maxHp: 460,
    speed: 235,
    introLine: 'TARGET LOCATED.',
    attackLine: 'PAUSE. CONTAIN.',
    defeatLine: 'SIGNAL LOST...'
  },
  mercenary_ballista: {
    name: 'BALLISTA',
    color: '#e2e8f0',
    scale: 1.22,
    weaponType: 'pixel_bazooka',
    maxHp: 430,
    speed: 215,
    introLine: '8-BIT LOCKED ON!',
    attackLine: 'PIXEL BARRAGE!',
    defeatLine: 'GAME OVER?!'
  },
  mercenary_primal: {
    name: 'PRIMAL',
    color: '#92400e',
    scale: 1.32,
    weaponType: 'stone_spear',
    maxHp: 520,
    speed: 250,
    introLine: 'ROOOAAAR!!',
    attackLine: 'HUNT! SPEAR!',
    defeatLine: 'GRRAAAH...'
  },
  mercenary_hazard: {
    name: 'HAZARD',
    color: '#111827',
    scale: 1.22,
    weaponType: 'hazard_sign',
    maxHp: 430,
    speed: 225,
    introLine: '⚠ CAUTION: DANGER!',
    attackLine: '⚠ HIGH VOLTAGE!',
    defeatLine: '⚠ SYSTEM FAULT!'
  }
});

export class MercenaryBoss {
  constructor(x, y, type = 'mercenary_agent', index = 0) {
    const profile = MERCENARY_PROFILES[type] || MERCENARY_PROFILES.mercenary_agent;
    Object.assign(this, {
      x,
      y,
      z: (index - 1.5) * 42,
      vx: 0,
      vy: 0,
      groundY: y,
      type,
      name: `${profile.name} // ROCKET CORP`,
      shortName: profile.name,
      color: profile.color,
      scale: profile.scale,
      weaponType: profile.weaponType,
      hookClass: 'heavy',
      speechOffsetY: -96,
      bannerOffsetY: -130,
      isBoss: true,
      isMercenary: true,
      isDead: false,
      isGrounded: true,
      isHurt: false,
      isAwakened: false,
      maxHp: profile.maxHp,
      hp: profile.maxHp,
      speed: profile.speed,
      radius: 26,
      height: 86,
      inkReward: 160,
      scoreReward: 2600,
      pose: 'idle',
      state: 'idle',
      stateTimer: 0,
      stateDuration: 0,
      // Stagger initial attack cooldowns across the 4 mercenaries so attacks feel rhythmic and fair
      actionCooldown: 0.75 + index * 0.65,
      actionKind: null,
      attackIndex: index,
      attackHit: false,
      animTimer: index * 0.9,
      hurtTimer: 0,
      freezeTimer: 0,
      stunTimer: 0,
      facing: -1,
      leapStartX: x,
      leapTargetX: x,
      rollTargetX: x,
      profile,
      camera: null
    });
  }

  getActionRenderPhase() {
    if (!this.stateDuration || this.stateDuration <= 0) return 0;
    return clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
  }

  update(dt, groundY, player, sketchBlocks, camera, platforms = [], enemies = []) {
    if (this.isDead) return;
    const safeDt = clamp(Number(dt) || 0, 0, 0.05);
    // Hazard animates in snappy 2-frame sign-pictogram steps!
    if (this.type === 'mercenary_hazard') {
      this._rawTimer = (this._rawTimer || 0) + safeDt;
      this.animTimer = Math.floor(this._rawTimer * 6) / 6;
    } else {
      this.animTimer += safeDt;
    }
    this.groundY = groundY;
    this.camera = camera || this.camera;

    this.hurtTimer = Math.max(0, this.hurtTimer - safeDt);
    this.isHurt = this.hurtTimer > 0;
    this.freezeTimer = Math.max(0, this.freezeTimer - safeDt);
    this.stunTimer = Math.max(0, this.stunTimer - safeDt);

    const stepDt = safeDt * (this.freezeTimer > 0 ? 0.65 : 1);
    if (this.stunTimer > 0) {
      this.vx = 0;
      this.pose = 'hurt';
    } else {
      this.updateAI(stepDt, player, camera);
    }

    if (this.state !== 'lunge_active') {
      this.x += this.vx * stepDt;
      this.y = groundY;
    }
    this.x = clamp(this.x, LEFT, RIGHT);
  }

  updateAI(dt, player, camera) {
    if (!player || player.isDead) {
      this.vx *= 0.85;
      this.pose = 'idle';
      return;
    }
    const dx = player.x - this.x;
    const absDx = Math.abs(dx);

    if (this.state === 'idle' || this.state === 'recovery') {
      this.facing = dx >= 0 ? 1 : -1;
    }

    switch (this.state) {
      case 'idle': {
        this.actionCooldown -= dt;
        const preferredDist = (this.type === 'mercenary_ballista' || this.type === 'mercenary_hazard') ? 270 : 140;
        if (absDx > preferredDist + 45) {
          this.vx = this.facing * this.speed;
          this.pose = 'run';
        } else if (absDx < preferredDist - 60) {
          this.vx = -this.facing * (this.speed * 0.65);
          this.pose = 'run';
        } else {
          this.vx *= 0.82;
          this.pose = this.type === 'mercenary_primal' ? 'crouch' : 'idle';
        }

        if (this.actionCooldown <= 0) {
          this.startSignatureAttack(player, camera);
        }
        break;
      }
      case 'lunge_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.pose = this.type === 'mercenary_primal' ? 'crouch' : 'weapon_slash';
        this.actionKind = 'mercenary_lunge';
        if (this.stateTimer <= 0) {
          this.state = 'lunge_active';
          this.stateDuration = this.stateTimer = 0.36;
          this.leapStartX = this.x;
          audio.playWhoosh();
        }
        break;
      }
      case 'lunge_active': {
        this.stateTimer -= dt;
        const p = clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
        this.x = this.leapStartX + (this.leapTargetX - this.leapStartX) * p;
        if (this.type === 'mercenary_primal') {
          this.y = this.groundY - Math.sin(p * Math.PI) * 135;
          this.pose = p < 0.5 ? 'jump_rise' : 'attack_axe_kick';
        } else {
          this.y = this.groundY;
          this.pose = 'weapon_slash';
        }

        if (!this.attackHit && canHitPlayer(player)) {
          if (Math.abs(player.x - this.x) < 58 && Math.abs(player.y - this.y) < 75) {
            this.attackHit = true;
            const dmg = this.type === 'mercenary_primal' ? 22 : 18;
            player.takeDamage(dmg, this.facing, 420);
            particles.createHitSparks(player.x, player.y - 35, 8, '#ff6b00');
          }
        }

        if (this.stateTimer <= 0) {
          this.y = this.groundY;
          if (this.type === 'mercenary_primal') {
            particles.addShockwave(this.x, this.groundY - 8, 95, '#d97706', 7);
            camera?.addShake?.(0.2);
          }
          this.recover(0.65);
        }
        break;
      }
      case 'ranged_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.pose = 'attack_cross';
        this.actionKind = 'mercenary_ranged';
        if (this.stateTimer <= 0) {
          this.fireSignatureRanged(player, camera);
          this.recover(0.75);
        }
        break;
      }
      case 'recovery': {
        this.stateTimer -= dt;
        this.vx *= 0.82;
        this.pose = 'idle';
        this.actionKind = null;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.actionCooldown = 1.15 + (this.attackIndex % 3) * 0.25;
        }
        break;
      }
      default:
        this.state = 'idle';
    }
  }

  startSignatureAttack(player, camera) {
    this.attackIndex++;
    this.attackHit = false;
    this.facing = player.x >= this.x ? 1 : -1;

    speech.spawnBubble(this.x, this.y - 95, this.profile.attackLine, `${this.type}:atk`, 1.15, {
      anchor: this,
      cooldownMs: 3400
    });

    const useRanged = (this.type === 'mercenary_ballista' || this.type === 'mercenary_hazard')
      ? (this.attackIndex % 3 !== 0)
      : (this.type === 'mercenary_agent' && this.attackIndex % 2 === 0);

    if (useRanged) {
      this.state = 'ranged_windup';
      this.stateDuration = this.stateTimer = 0.52;
      this.rollTargetX = clamp(player.x, LEFT + 60, RIGHT - 60);
    } else {
      this.state = 'lunge_windup';
      this.stateDuration = this.stateTimer = 0.54;
      this.leapStartX = this.x;
      this.leapTargetX = clamp(player.x + this.facing * 90, LEFT + 50, RIGHT - 50);
    }
  }

  fireSignatureRanged(player, camera) {
    if (this.type === 'mercenary_ballista') {
      // Ballista fires an 8-bit pixel projectile volley
      projectiles.spawnSpit?.(this.x + this.facing * 24, this.y - 44, player.x, player.y - 34);
      particles.addShockwave(this.x + this.facing * 28, this.y - 44, 48, '#ef4444', 5);
      audio.playPunch?.('heavy');
    } else if (this.type === 'mercenary_hazard') {
      // Hazard triggers a high-voltage Caution ground burst at rollTargetX
      const hx = this.rollTargetX;
      particles.addShockwave(hx, this.groundY - 10, 88, '#facc15', 8);
      particles.createHitSparks(hx, this.groundY - 25, 10, '#facc15');
      if (canHitPlayer(player) && Math.abs(player.x - hx) < 76 && Math.abs(player.y - this.groundY) < 70) {
        player.takeDamage(19, player.x >= hx ? 1 : -1, 380);
      }
      camera?.addShake?.(0.18);
    } else {
      // Agent fires a fast UI toolbar cursor bolt
      projectiles.spawnSpit?.(this.x + this.facing * 24, this.y - 46, player.x, player.y - 36);
      particles.createHitSparks(this.x + this.facing * 24, this.y - 46, 6, '#38bdf8');
    }
  }

  recover(duration) {
    this.state = 'recovery';
    this.stateDuration = this.stateTimer = duration;
    this.vx = 0;
  }

  applyFreeze(duration = 4) {
    if (this.isDead) return false;
    this.freezeTimer = Math.max(this.freezeTimer, Math.min(0.85, duration * 0.22));
    return true;
  }

  applyStun(duration = 3) {
    if (this.isDead) return false;
    this.stunTimer = Math.max(this.stunTimer, Math.min(0.55, duration * 0.18));
    return true;
  }

  takeDamage(amount, knockbackDir = 1, knockbackPower = 200, isCrit = false) {
    if (this.isDead || !Number.isFinite(amount) || amount <= 0) return 0;
    const applied = Math.min(this.hp, amount);
    this.hp -= applied;
    this.hurtTimer = 0.14;
    this.isHurt = true;
    this.vx = knockbackDir * Math.min(130, Math.max(0, knockbackPower) * 0.25);
    particles.addDamageText(this.x, this.y - 88, applied, isCrit, '#ff6b00');
    particles.createHitSparks(this.x, this.y - 48, 6, '#38bdf8');
    if (this.hp <= 0) this.die();
    return applied;
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.hp = 0;
    this.vx = 0;
    this.state = 'defeated';
    combat.registerKill(this);
    audio.playFinisherImpact?.();
    const aliveMercs = (activeWaveDirector?.zombies || []).filter((z) => z.isMercenary && !z.isDead && z !== this);
    if (aliveMercs.length > 0) {
      const comrade = aliveMercs[0];
      const retortText = comrade.type === 'mercenary_ballista' ? 'AGENT DOWN! RETARGETING!' :
                         comrade.type === 'mercenary_primal' ? 'FALLEN COMRADE! CHARGE!' :
                         comrade.type === 'mercenary_hazard' ? '⚠ CASUALTY DETECTED! ESCALATING!' :
                         'SQUAD MEMBER LOST. REGROUPING.';
      speech.triggerBanter([
        { speaker: this.type, text: this.profile.defeatLine, delay: 0, options: { style: 'pixel', priority: 3, anchor: this } },
        { speaker: comrade.type, text: retortText, delay: 0.25, options: { style: 'pixel', priority: 3, anchor: comrade } }
      ]);
    } else {
      speech.triggerBanter([
        { speaker: this.type, text: this.profile.defeatLine, delay: 0, options: { style: 'pixel', priority: 3, anchor: this } },
        { speaker: 'orange', text: 'ROCKET CORP DEFANGED!', delay: 0.25, options: { style: 'comic', priority: 3, mood: '★' } }
      ]);
    }
    this.camera?.addShake?.(0.45);
    particles.emitBossExplosion({
      x: this.x,
      y: this.y - 48,
      bodyY: this.y,
      groundY: this.groundY,
      color: '#ff6b00',
      accent: '#38bdf8',
      radius: 175,
      stickFigure: true,
      seed: 0x7c04 + this.attackIndex
    });
  }

  draw() {}
}

// ============================================================================
// 3. 3D CAMPAIGN EXTENSION (Stages 18: The End, 19: The Aether, 20: Rocket Corp, 21: H4C3R)
// ============================================================================
export const CAMPAIGN_BEATS_3D = Object.freeze({
  ...CAMPAIGN_BEATS,
  17: Object.freeze({
    act: 'V - ROOT OF LUCK',
    mission: 'OUTLUCK THE LUCKY ORB',
    clearText: 'ORB SENT HOME!',
    clue: 'VOID RIFT: THE END',
    bossLabel: 'THE LUCKY ORB',
    allyReaction: Object.freeze({ ally: 'yellow', line: 'LUCK RAN OUT!' })
  }),
  18: Object.freeze({
    act: 'VI - DIMENSIONS BEYOND',
    mission: 'SLAY THE ENDER DRAGON',
    clearText: 'THE END LIBERATED!',
    clue: 'SKY PORTAL: THE AETHER',
    bossLabel: 'ENDER DRAGON',
    allyReaction: Object.freeze({ ally: 'red', line: 'DRAGON DOWN! BIG EGG!' })
  }),
  19: Object.freeze({
    act: 'VI - DIMENSIONS BEYOND',
    mission: 'CROSS THE AETHER SKYLANDS',
    clearText: 'AETHER BRIDGE CLEAR!',
    clue: 'SIGNAL LOCKED: ROCKET CORP HQ',
    bossLabel: null,
    allyReaction: Object.freeze({ ally: 'blue', line: 'GOLDEN TREES! SHINY!' })
  }),
  20: Object.freeze({
    act: 'VII - ROCKET CORP CONTAINMENT',
    mission: 'DEFEAT THE MERCENARIES',
    clearText: 'THE BOX BREACHED!',
    clue: 'FINAL TRACE: ROOT://H4C3R',
    bossLabel: 'AGENT · BALLISTA · PRIMAL · HAZARD',
    allyReaction: Object.freeze({ ally: 'chosen', line: 'NOT GOING BACK IN THE BOX.' })
  }),
  21: Object.freeze({
    act: 'VIII - ZERO-DAY FINALE',
    mission: 'LOG OUT H4C3R',
    clearText: 'SYSTEM RESTORED!',
    clue: 'RESTORE KEY COMPLETE',
    bossLabel: 'H4C3R',
    allyReaction: Object.freeze({ ally: 'green', line: 'FINAL BOSS MUSIC!' })
  })
});

export function extendCampaignFor3D(stageManager, waveDirector) {
  if (stageManager._extendedFor3D) return;
  stageManager._extendedFor3D = true;

  const origLoadStage = stageManager.loadStage.bind(stageManager);
  const origEnterTrophy = stageManager.enterTrophyRoom.bind(stageManager);
  const origGetBeat = stageManager.getCampaignBeat.bind(stageManager);

  stageManager.maxStage = 21;
  stageManager.lavaHazards = stageManager.currentStage === 7 ? [
    { x: -360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 },
    { x: 360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 }
  ] : [];

  const origBuildStage7 = stageManager.buildStage7Minecraft?.bind(stageManager);
  if (origBuildStage7) {
    stageManager.buildStage7Minecraft = () => {
      origBuildStage7();
      stageManager.lavaHazards = [
        { x: -360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 },
        { x: 360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 }
      ];
    };
  }

  stageManager.getCampaignBeat = (stageNum = stageManager.currentStage) => {
    const stage = Math.max(1, Math.min(21, Math.trunc(Number(stageNum)) || 1));
    return CAMPAIGN_BEATS_3D[stage] || origGetBeat(stage);
  };

  stageManager.loadStage = (stageNum) => {
    const numericStage = Number.isFinite(stageNum) ? Math.trunc(stageNum) : 1;
    const stage = Math.max(1, Math.min(21, numericStage));

    if (stage <= 17) {
      origLoadStage(stage);
      stageManager.maxStage = 21;
      stageManager.campaignBeat = CAMPAIGN_BEATS_3D[stage];
      if (stage === 7) {
        stageManager.lavaHazards = [
          { x: -360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 },
          { x: 360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 }
        ];
      } else {
        stageManager.lavaHazards = [];
      }
      return;
    }

    if (stage === 21) {
      // Stage 21 is Zero-Day Mainframe (H4C3R), built from original stage 18
      origLoadStage(18);
      stageManager.currentStage = 21;
      stageManager.maxStage = 21;
      stageManager.campaignBeat = CAMPAIGN_BEATS_3D[21];
      stageManager.lavaHazards = [];
      return;
    }

    // Reset common state via stage 1 then customize for Stages 18, 19, 20
    origLoadStage(1);
    stageManager.currentStage = stage;
    stageManager.maxStage = 21;
    stageManager.campaignBeat = CAMPAIGN_BEATS_3D[stage];
    stageManager.platforms = [];
    stageManager.movingPlatforms = [];
    stageManager.desktopIcons = [];
    stageManager.laserHazards = [];
    stageManager.lavaHazards = [];
    stageManager.errorPopups = [];

    if (stage === 18) {
      // STAGE 18: THE END (Ender Dragon Boss)
      stageManager.stageName = 'The End';
      stageManager.theme = 'the_end';
      stageManager.platforms = [
        { x: -620, y: -170, width: 240, height: 22, title: 'Obsidian_Pillar_W', appType: 'minecraft' },
        { x: 0, y: -270, width: 300, height: 24, title: 'End_Crystal_Altar', appType: 'minecraft' },
        { x: 620, y: -170, width: 240, height: 22, title: 'Obsidian_Pillar_E', appType: 'minecraft' }
      ];
      stageManager.desktopIcons = [
        { x: -780, y: -130, label: 'End_Crystal', icon: '❖', color: '#e879f9' },
        { x: -280, y: -330, label: 'Chorus_Fruit', icon: '✦', color: '#c084fc' },
        { x: 280, y: -330, label: 'Dragon_Egg', icon: '🥚', color: '#d946ef' },
        { x: 780, y: -130, label: 'End_Portal', icon: '▣', color: '#38bdf8' }
      ];
    } else if (stage === 19) {
      // STAGE 19: THE AETHER (Golden Skylands)
      stageManager.stageName = 'The Aether';
      stageManager.theme = 'aether';
      stageManager.platforms = [
        { x: -640, y: -165, width: 240, height: 22, title: 'Holystone_Shrine', appType: 'cloud' },
        { x: -210, y: -285, width: 230, height: 22, title: 'Valkyrie_Temple', appType: 'cloud' },
        { x: 240, y: -285, width: 230, height: 22, title: 'Golden_Oak_Isle', appType: 'cloud' },
        { x: 650, y: -165, width: 240, height: 22, title: 'Gravitite_Altar', appType: 'cloud' }
      ];
      stageManager.movingPlatforms = [
        {
          x: 0,
          y: -185,
          width: 210,
          height: 20,
          title: 'Gold_Aercloud',
          appType: 'cloud',
          minX: -320,
          maxX: 320,
          speed: 135,
          dir: 1
        }
      ];
      stageManager.desktopIcons = [
        { x: -800, y: -120, label: 'Glowstone_Gate', icon: '☀', color: '#ffd43b' },
        { x: -320, y: -360, label: 'Ambrosium', icon: '✦', color: '#facc15' },
        { x: 320, y: -360, label: 'Valkyrie_Lance', icon: '⚔', color: '#38d9a9' },
        { x: 800, y: -120, label: 'Sky_Bridge', icon: '☁', color: '#7dd3fc' }
      ];
    } else if (stage === 20) {
      // STAGE 20: ROCKET CORP HQ (Mercenaries Boss Squad: Agent, Ballista, Primal, Hazard)
      stageManager.stageName = 'Rocket Corp HQ';
      stageManager.theme = 'rocket_corp';
      stageManager.platforms = [
        { x: -620, y: -175, width: 250, height: 22, title: 'Containment_Box_01', appType: 'cmd' },
        { x: 0, y: -290, width: 320, height: 24, title: 'Rocket_Corp_Bridge', appType: 'cmd' },
        { x: 620, y: -175, width: 250, height: 22, title: 'Memory_Scanner.sys', appType: 'cmd' }
      ];
      stageManager.laserHazards = [
        { x: -180, y: -38, width: 360, height: 10, timer: 0, cycleDuration: 3.0, activeDuration: 1.5, damage: 22 }
      ];
      stageManager.desktopIcons = [
        { x: -820, y: -130, label: 'AGENT // UI', icon: '🕶', color: '#94a3b8' },
        { x: -340, y: -340, label: 'BALLISTA // 8BIT', icon: '🎮', color: '#f87171' },
        { x: 340, y: -340, label: 'PRIMAL // SPEAR', icon: '🦴', color: '#fbbf24' },
        { x: 820, y: -130, label: 'HAZARD // SIGN', icon: '⚠', color: '#facc15' }
      ];
    }
  };

  stageManager.enterTrophyRoom = () => {
    origEnterTrophy();
    stageManager.maxStage = 21;
    stageManager.currentStage = 21;
    stageManager.lavaHazards = [];
    stageManager.desktopIcons = [
      { x: -840, y: -105, label: 'TITAN', icon: 'T', color: '#8cff66' },
      { x: -630, y: -105, label: 'DARK LORD', icon: 'DL', color: '#ff3344' },
      { x: -420, y: -105, label: 'KING FREED', icon: 'KO', color: '#ff8a22' },
      { x: -210, y: -105, label: 'CREEPER LORD', icon: 'CL', color: '#9be34b' },
      { x: 0, y: -105, label: 'GIANT CAT', icon: 'CAT', color: '#ffb15f' },
      { x: 210, y: -105, label: 'LUCKY ORB', icon: '●', color: '#ffe06b' },
      { x: 420, y: -105, label: 'ENDER DRAGON', icon: 'ED', color: '#e879f9' },
      { x: 630, y: -105, label: 'MERCENARIES', icon: 'RC', color: '#ff6b00' },
      { x: 840, y: -105, label: 'H4C3R', icon: 'H4', color: '#67e8f9' }
    ];
  };

  // Extend WaveDirector for Stages 18, 19, 20, 21
  activeWaveDirector = waveDirector;
  const origGenerateWaveQueue = waveDirector.generateWaveQueue.bind(waveDirector);
  const origSpawnZombie = waveDirector.spawnZombie.bind(waveDirector);
  const origWaveUpdate = waveDirector.update.bind(waveDirector);

  const AETHER_RECIPE = Object.freeze({
    total: 16,
    bossHelpers: 0,
    packs: Object.freeze([
      Object.freeze({ gap: 0.95, enemies: Object.freeze(['stalker', 'spitter', 'runner', 'shieldbearer']) }),
      Object.freeze({ gap: 1.05, enemies: Object.freeze(['warden', 'stalker', 'boom_bug', 'spitter']) }),
      Object.freeze({ gap: 1.1, enemies: Object.freeze(['brute', 'stalker', 'runner', 'boom_bug']) }),
      Object.freeze({ gap: 1.2, enemies: Object.freeze(['warden', 'shieldbearer', 'spitter', 'boom_bug']) })
    ])
  });

  waveDirector.generateWaveQueue = (wave) => {
    const stage = Math.max(1, Math.min(21, Math.trunc(Number(wave)) || 1));
    if (stage <= 17) {
      origGenerateWaveQueue(stage);
      return;
    }
    if (stage === 18) {
      // Stage 18: The End — Ender Dragon Boss
      waveDirector.usesAuthoredRecipe = true;
      waveDirector.spawnQueue.push({ type: 'ender_dragon', delay: 1.1, packIndex: 0, bossHealthGate: null });
      return;
    }
    if (stage === 19) {
      // Stage 19: The Aether — Skylands Wave
      waveDirector.queueWaveRecipe(AETHER_RECIPE);
      return;
    }
    if (stage === 20) {
      // Stage 20: Rocket Corp HQ — All 4 Mercenaries from AvA Season 3!
      waveDirector.usesAuthoredRecipe = true;
      const mercs = ['mercenary_agent', 'mercenary_ballista', 'mercenary_primal', 'mercenary_hazard'];
      mercs.forEach((type, idx) => {
        waveDirector.spawnQueue.push({
          type,
          delay: idx === mercs.length - 1 ? 1.1 : 0.25,
          packIndex: 0,
          bossHealthGate: null
        });
      });
      return;
    }
    if (stage === 21) {
      // Stage 21: Zero-Day Mainframe — H4C3R
      waveDirector.queueWaveRecipe(WAVE_RECIPES[18]);
    }
  };

  waveDirector.spawnZombie = (type, player, groundY, camera = null) => {
    if (type === 'ender_dragon') {
      const spawnX = waveDirector.getSafeSpawnX(player);
      const boss = new EnderDragonBoss(spawnX, groundY);
      waveDirector.zombies.push(boss);
      waveDirector.bossZombie = boss;
      audio.playBossRoar?.();
      camera?.addShake?.(0.85);
      particles.addShockwave(spawnX, groundY - 40, 260, '#d946ef', 12);
      particles.addTextBanner(spawnX, groundY - 125, '🐉 ENDER DRAGON // THE END 🐉', '#e879f9');
      speech.triggerBanter([
        { speaker: boss, text: 'WHO DARES ENTER THE END?', delay: 0, options: { style: 'shout', priority: 5, mood: '💀', anchor: boss } },
        { speaker: 'orange', text: 'WE HAVE A PENCIL, DRAGON!', delay: 0.35, options: { style: 'comic', priority: 3, mood: '!' } }
      ]);
      return;
    }

    if (type.startsWith('mercenary_')) {
      const mercOrder = ['mercenary_agent', 'mercenary_ballista', 'mercenary_primal', 'mercenary_hazard'];
      const idx = Math.max(0, mercOrder.indexOf(type));
      const offsets = [-520, -240, 260, 540];
      const spawnX = clamp(offsets[idx] || waveDirector.getSafeSpawnX(player), LEFT + 60, RIGHT - 60);
      const merc = new MercenaryBoss(spawnX, groundY, type, idx);
      waveDirector.zombies.push(merc);
      waveDirector.bossZombie = merc;
      audio.playBossRoar?.();
      camera?.addShake?.(0.45);
      particles.addShockwave(spawnX, groundY - 25, 160, '#ff6b00', 8);
      if (idx === 0) {
        particles.addTextBanner(0, groundY - 135, '▲ ROCKET CORP // THE MERCENARIES ▲', '#ff6b00');
        speech.triggerBanter([
          { speaker: 'agent', text: 'Agent online. Target in sight.', delay: 0, options: { style: 'pixel', priority: 2, anchor: merc } },
          { speaker: 'ballista', text: 'Ballista ready. Heavy rockets armed.', delay: 0.25, options: { style: 'pixel', priority: 2 } },
          { speaker: 'primal', text: 'Primal ready. Axes sharpened!', delay: 0.5, options: { style: 'pixel', priority: 2 } },
          { speaker: 'hazard', text: 'Hazard ready. Bio-mines deployed.', delay: 0.75, options: { style: 'pixel', priority: 2 } }
        ]);
      } else {
        speech.spawnBubble(spawnX, groundY - 95, merc.profile.introLine, `${type}:intro`, 1.45, {
          anchor: merc,
          cooldownMs: 0
        });
      }
      return;
    }

    if (type === 'dark_lord') {
      origSpawnZombie(type, player, groundY, camera);
      const boss = waveDirector.bossZombie;
      speech.triggerBanter([
        { speaker: 'dark_lord', text: 'BACKUP ONLINE. OLD FIGHT, NEW DOOM.', delay: 0, options: { style: 'shout', priority: 4, mood: '💀', anchor: boss } },
        { speaker: 'orange', text: 'BACKUP? MEET MY ERASER!', delay: 0.35, options: { style: 'comic', priority: 3, mood: '⚡' } }
      ]);
      return;
    }

    if (type === 'king_orange') {
      origSpawnZombie(type, player, groundY, camera);
      const boss = waveDirector.bossZombie;
      speech.triggerBanter([
        { speaker: 'king_orange', text: 'REPLAY LOADED. THIS IS ONLY A COPY.', delay: 0, options: { style: 'comic', priority: 4, mood: '!', anchor: boss } },
        { speaker: 'orange', text: 'WE ARE BREAKING THE LOOP, KING!', delay: 0.35, options: { style: 'comic', priority: 3, mood: '★' } }
      ]);
      return;
    }

    if (type === 'h4c3r') {
      origSpawnZombie(type, player, groundY, camera);
      const boss = waveDirector.bossZombie;
      speech.triggerBanter([
        { speaker: 'h4c3r', text: 'WELCOME TO MY SCREEN. ROOT ACCESS: GRANTED.', delay: 0, options: { style: 'cyber', priority: 5, mood: '⚡', sound: true, anchor: boss } },
        { speaker: 'orange', text: 'YOUR ROOT PRIVILEGES ARE ABOUT TO BE REVOKED!', delay: 0.35, options: { style: 'comic', priority: 3, mood: '!' } }
      ]);
      return;
    }

    origSpawnZombie(type, player, groundY, camera);
  };

  waveDirector.update = (dt, player, groundY, sketchBlocks, camera, onWaveComplete, platforms = [], friendlyTargets = []) => {
    origWaveUpdate(dt, player, groundY, sketchBlocks, camera, onWaveComplete, platforms, friendlyTargets);

    // If in Stage 20 (Rocket Corp Mercenaries), synthesize combined squad health on waveDirector.bossZombie
    const aliveMercs = waveDirector.zombies.filter((z) => z.isMercenary && !z.isDead);
    if (aliveMercs.length > 0) {
      const totalHp = aliveMercs.reduce((sum, m) => sum + m.hp, 0);
      const totalMaxHp = 460 + 430 + 520 + 430; // Combined max HP of Agent + Ballista + Primal + Hazard
      const names = aliveMercs.map((m) => m.shortName).join(' · ');
      const lead = aliveMercs[0];
      waveDirector.bossZombie = {
        ...lead,
        x: lead.x,
        y: lead.y,
        z: lead.z,
        type: lead.type,
        state: lead.state,
        isDead: false,
        hp: totalHp,
        maxHp: totalMaxHp,
        name: `MERCENARIES (${aliveMercs.length}/4): ${names}`
      };
    }
  };
}
