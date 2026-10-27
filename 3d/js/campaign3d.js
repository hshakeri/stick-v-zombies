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
            player._pendingDamageCause = 'The Second Coming was launched by Ender Dragon';
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
          player._pendingDamageCause = "The Second Coming was roasted in Ender Dragon's Breath";
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
            player._pendingDamageCause = formatAttackerDeathMessage(this);
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
      const lastProj = projectiles.projectiles?.[projectiles.projectiles.length - 1];
      if (lastProj) lastProj.deathCause = "The Second Coming was blown up by Ballista's 8-Bit Bazooka";
      particles.addShockwave(this.x + this.facing * 28, this.y - 44, 48, '#ef4444', 5);
      audio.playPunch?.('heavy');
    } else if (this.type === 'mercenary_hazard') {
      // Hazard triggers a high-voltage Caution ground burst at rollTargetX
      const hx = this.rollTargetX;
      particles.addShockwave(hx, this.groundY - 10, 88, '#facc15', 8);
      particles.createHitSparks(hx, this.groundY - 25, 10, '#facc15');
      if (canHitPlayer(player) && Math.abs(player.x - hx) < 76 && Math.abs(player.y - this.groundY) < 70) {
        player._pendingDamageCause = 'The Second Coming was electrocuted by Hazard';
        player.takeDamage(19, player.x >= hx ? 1 : -1, 380);
      }
      camera?.addShake?.(0.18);
    } else {
      // Agent fires a fast UI toolbar cursor bolt
      projectiles.spawnSpit?.(this.x + this.facing * 24, this.y - 46, player.x, player.y - 36);
      const lastProj = projectiles.projectiles?.[projectiles.projectiles.length - 1];
      if (lastProj) lastProj.deathCause = 'The Second Coming was paused & erased by Agent';
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
// 3. THE WARDEN BOSS (Stage 20: Ancient City / Deep Dark)
// ============================================================================
export class WardenBoss {
  constructor(x, y) {
    Object.assign(this, {
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      groundY: y,
      type: 'warden_boss',
      name: 'THE WARDEN',
      hookClass: 'anchor',
      speechOffsetY: -135,
      bannerOffsetY: -165,
      isBoss: true,
      isDead: false,
      isGrounded: true,
      isHurt: false,
      isAwakened: false,
      maxHp: 1520,
      hp: 1520,
      radius: 54,
      height: 138,
      color: '#06b6d4',
      inkReward: 560,
      scoreReward: 10500,
      phase: 1,
      pose: 'idle',
      state: 'idle',
      stateTimer: 0,
      stateDuration: 0,
      actionCooldown: 0.9,
      actionKind: null,
      attackIndex: 0,
      attackHit: false,
      sonicResolved: false,
      dropResolved: false,
      animTimer: 0,
      hurtTimer: 0,
      freezeTimer: 0,
      stunTimer: 0,
      facing: -1,
      rollStartX: x,
      rollTargetX: x,
      rollDirection: -1,
      camera: null
    });
    this.dropXs = new Float32Array(3);
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
      this.stateDuration = this.stateTimer = 0.85;
      this.vx = 0;
      audio.playAwakening?.();
      camera?.addShake?.(0.6);
      particles.addShockwave(this.x, this.y - 68, 280, '#06b6d4', 12);
      particles.addTextBanner(this.x, this.y - 145, '🔊 DARKNESS SURGE // HEARTBEAT MAX! 🔊', '#22d3ee');
      speech.spawnSpeechBubble(this, '*ROOOAAAR! SCULK OVERDRIVE!*', {
        style: 'shout',
        trauma: 1.0,
        priority: 5,
        mood: '💀',
        anchor: this
      });
      speech.triggerBanter([
        { speaker: 'green', text: 'MY NOTE BLOCKS WOKE IT UP!', delay: 0.35, options: { style: 'comic', priority: 3, mood: '🎵' } }
      ]);
    }

    this.hurtTimer = Math.max(0, this.hurtTimer - safeDt);
    this.isHurt = this.hurtTimer > 0;
    this.freezeTimer = Math.max(0, this.freezeTimer - safeDt);
    this.stunTimer = Math.max(0, this.stunTimer - safeDt);

    const stepDt = safeDt * (this.freezeTimer > 0 ? 0.68 : 1);
    if (this.stunTimer > 0 && this.state !== 'phase_shift') {
      this.vx = 0;
    } else {
      this.updateAI(stepDt, player, camera);
    }

    if (this.state !== 'charge_active') {
      this.x += this.vx * stepDt;
    }
    this.y = groundY;
    this.isGrounded = true;
    this.x = clamp(this.x, LEFT, RIGHT);
    this.pose = Math.abs(this.vx) > 15 || this.state === 'charge_active' ? 'zombie_walk' : 'idle';
  }

  updateAI(dt, player, camera) {
    if (!player || player.isDead) {
      this.vx *= 0.85;
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
        const stalkSpeed = this.phase === 2 ? 128 : 98;
        if (Math.abs(dx) > 170) this.vx = this.facing * stalkSpeed;
        else if (Math.abs(dx) < 85) this.vx = -this.facing * 55;
        else this.vx *= 0.82;

        if (this.actionCooldown <= 0) {
          const moveSlot = this.attackIndex % 3;
          this.attackIndex++;
          if (moveSlot === 0) this.startSonicBoom(player, camera);
          else if (moveSlot === 1) this.startSeismicSlam(player, camera);
          else this.startCharge(player, camera);
        }
        break;
      }
      case 'phase_shift': {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.recover(0.5);
        break;
      }
      case 'sonic_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'warden_sonic';
        if (this.stateTimer <= 0) {
          this.state = 'sonic_active';
          this.stateDuration = this.stateTimer = 0.46;
          this.sonicResolved = false;
        }
        break;
      }
      case 'sonic_active': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'warden_sonic';
        if (!this.sonicResolved && this.stateTimer <= 0.28) {
          this.resolveSonicBoom(player, camera);
        }
        if (this.stateTimer <= 0) {
          this.recover(this.phase === 2 ? 0.48 : 0.66);
        }
        break;
      }
      case 'slam_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'warden_slam';
        if (this.stateTimer <= 0) {
          this.state = 'slam_active';
          this.stateDuration = this.stateTimer = 0.4;
          this.dropResolved = false;
        }
        break;
      }
      case 'slam_active': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'warden_slam';
        if (!this.dropResolved && this.stateTimer <= 0.22) {
          this.resolveSeismicSlam(player, camera);
        }
        if (this.stateTimer <= 0) {
          this.recover(this.phase === 2 ? 0.5 : 0.68);
        }
        break;
      }
      case 'charge_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'warden_charge';
        if (this.stateTimer <= 0) {
          this.state = 'charge_active';
          this.stateDuration = this.stateTimer = this.phase === 2 ? 0.44 : 0.54;
          this.rollStartX = this.x;
          audio.playBruteStomp?.();
          camera?.addShake?.(0.28);
        }
        break;
      }
      case 'charge_active': {
        this.stateTimer -= dt;
        this.actionKind = 'warden_charge';
        const progress = clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
        this.x = this.rollStartX + (this.rollTargetX - this.rollStartX) * progress;

        if (!this.attackHit && canHitPlayer(player)) {
          const inX = Math.abs(player.x - this.x) < this.radius + (player.radius || 20) + 18;
          const inY = Math.abs(player.y - this.groundY) < 95;
          const inZ = Math.abs((player.z || 0) - (this.z || 0)) <= 165;
          if (inX && inY && inZ) {
            this.attackHit = true;
            player._pendingDamageCause = 'The Second Coming was crushed by The Warden';
            player.takeDamage(this.phase === 2 ? 32 : 26, this.rollDirection, 580);
            particles.createHitSparks(player.x, player.y - 38, 12, '#22d3ee');
          }
        }
        if (this.stateTimer <= 0) {
          particles.addShockwave(this.x, this.groundY - 18, 135, '#06b6d4', 9);
          camera?.addShake?.(0.26);
          this.recover(this.phase === 2 ? 0.48 : 0.64);
        }
        break;
      }
      case 'recovery': {
        this.stateTimer -= dt;
        this.vx *= 0.82;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.actionCooldown = this.phase === 2 ? 0.36 : 0.55;
        }
        break;
      }
      default:
        this.state = 'idle';
    }
  }

  startSonicBoom(player, camera) {
    this.state = 'sonic_windup';
    this.actionKind = 'warden_sonic';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.54 : 0.68;
    this.facing = player.x >= this.x ? 1 : -1;
    this.sonicResolved = false;
    audio.playDoomLaserCharge?.();
    speech.spawnBubble(this.x, this.y - 125, '🔊 *RIBS CLICKING... SONIC BOOM!*', 'warden:sonic', 1.25, {
      anchor: this,
      cooldownMs: 2400
    });
    camera?.addShake?.(0.2);
  }

  resolveSonicBoom(player, camera) {
    this.sonicResolved = true;
    const beamRange = 760;
    for (let i = 1; i <= 4; i++) {
      const rx = clamp(this.x + this.facing * (i * 175), LEFT + 30, RIGHT - 30);
      particles.addShockwave(rx, this.groundY - 62, 85 + i * 16, '#22d3ee', 8);
      particles.createHitSparks(rx, this.groundY - 62, 8, '#67e8f9');
    }
    if (canHitPlayer(player)) {
      const relX = (player.x - this.x) * this.facing;
      const inX = relX >= -25 && relX <= beamRange;
      const inY = player.y >= this.groundY - 175 && player.y <= this.groundY + 45;
      const inZ = Math.abs((player.z || 0) - (this.z || 0)) <= 185;
      if (inX && inY && inZ) {
        player._pendingDamageCause = "The Second Coming was obliterated by The Warden's Sonic Boom";
        player.takeDamage(this.phase === 2 ? 34 : 28, this.facing, 620);
        particles.createHitSparks(player.x, player.y - 40, 14, '#67e8f9');
      }
    }
    audio.playFinisherImpact?.();
    camera?.addShake?.(0.42);
  }

  startSeismicSlam(player, camera) {
    this.state = 'slam_windup';
    this.actionKind = 'warden_slam';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.52 : 0.64;
    const base = clamp(player.x, LEFT + 80, RIGHT - 80);
    this.dropXs[0] = base;
    this.dropXs[1] = clamp(base - 165, LEFT + 60, RIGHT - 60);
    this.dropXs[2] = clamp(base + 165, LEFT + 60, RIGHT - 60);
    this.dropResolved = false;
    speech.spawnBubble(this.x, this.y - 125, '*SCULK SEISMIC SLAM!*', 'warden:slam', 1.2, {
      anchor: this,
      cooldownMs: 2400
    });
    camera?.addShake?.(0.18);
  }

  resolveSeismicSlam(player, camera) {
    this.dropResolved = true;
    const blastRadius = 76;
    for (let i = 0; i < this.dropXs.length; i++) {
      const bx = this.dropXs[i];
      particles.addShockwave(bx, this.groundY - 14, 105, '#06b6d4', 9);
      particles.createHitSparks(bx, this.groundY - 26, 12, '#67e8f9');
    }
    if (canHitPlayer(player) && Math.abs(player.y - this.groundY) < 82) {
      const inZ = Math.abs((player.z || 0) - (this.z || 0)) <= 185;
      if (inZ) {
        for (const bx of this.dropXs) {
          if (Math.abs(player.x - bx) < blastRadius + (player.radius || 20)) {
            player._pendingDamageCause = "The Second Coming was shattered by The Warden's Sculk Slam";
            player.takeDamage(this.phase === 2 ? 30 : 24, player.x >= bx ? 1 : -1, 480);
            break;
          }
        }
      }
    }
    audio.playBruteStomp?.();
    camera?.addShake?.(0.38);
  }

  startCharge(player, camera) {
    this.state = 'charge_windup';
    this.actionKind = 'warden_charge';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.46 : 0.58;
    this.rollStartX = this.x;
    this.rollDirection = player.x >= this.x ? 1 : -1;
    this.facing = this.rollDirection;
    this.rollTargetX = clamp(player.x + this.rollDirection * 260, LEFT + 60, RIGHT - 60);
    if (Math.abs(this.rollTargetX - this.x) < 240) {
      this.rollTargetX = clamp(player.x - this.rollDirection * 360, LEFT + 60, RIGHT - 60);
      this.rollDirection = Math.sign(this.rollTargetX - this.x) || 1;
      this.facing = this.rollDirection;
    }
    this.attackHit = false;
    speech.spawnBubble(this.x, this.y - 125, '*SNIFF... SOUND LOCKED!*', 'warden:charge', 1.2, {
      anchor: this,
      cooldownMs: 2400
    });
    camera?.addShake?.(0.16);
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
    const applied = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - applied);
    this.hurtTimer = 0.14;
    this.isHurt = true;
    this.vx += knockbackDir * Math.min(95, knockbackPower * 0.16);
    particles.addDamageText(this.x, this.y - 125, applied, isCrit);
    particles.createHitSparks(this.x, this.y - 75, isCrit ? 12 : 7, '#22d3ee');
    audio.playHit?.(isCrit);
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
    speech.triggerBanter([
      { speaker: 'warden_boss', text: '*HEARTBEAT... FADING...*', delay: 0, options: { style: 'shout', priority: 5, mood: '💀', anchor: this } },
      { speaker: 'orange', text: 'SHHH... ANCIENT CITY SILENCED!', delay: 0.3, options: { style: 'comic', priority: 3, mood: '★' } }
    ]);
    this.camera?.addShake?.(0.75);
    particles.emitBossExplosion({
      x: this.x,
      y: this.y - 68,
      bodyY: this.y,
      groundY: this.groundY,
      color: '#06b6d4',
      accent: '#d6d3c4',
      radius: 225,
      stickFigure: false,
      seed: 0x9c20
    });
  }

  draw() {}
}

// ============================================================================
// 4. THE CREAKING BOSS (Stage 21: Pale Garden — Asymmetric Puppet & Gaze-Freeze)
// ============================================================================
export class CreakingBoss {
  constructor(x, y) {
    Object.assign(this, {
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      groundY: y,
      type: 'creaking_boss',
      name: 'THE CREAKING',
      hookClass: 'anchor',
      speechOffsetY: -136,
      bannerOffsetY: -166,
      isBoss: true,
      isDead: false,
      isGrounded: true,
      isHurt: false,
      isAwakened: false,
      isObserved: false,
      maxHp: 1480,
      hp: 1480,
      radius: 44,
      height: 136,
      color: '#f97316',
      inkReward: 600,
      scoreReward: 11500,
      phase: 1,
      pose: 'idle',
      state: 'idle',
      stateTimer: 0,
      stateDuration: 0,
      actionCooldown: 1.05,
      actionKind: null,
      attackIndex: 0,
      attackHit: false,
      surgeResolved: false,
      dropResolved: false,
      animTimer: 0,
      hurtTimer: 0,
      freezeTimer: 0,
      stunTimer: 0,
      facing: -1,
      rollStartX: x,
      rollTargetX: x,
      rollDirection: -1,
      camera: null
    });
    this.dropXs = new Float32Array(3);
    this.friendlyTargets = [];
  }

  getActionRenderPhase() {
    if (!this.stateDuration || this.stateDuration <= 0) return 0;
    return clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
  }

  checkPlayerGaze(player) {
    if (!player || player.isDead) return false;
    const dx = this.x - player.x;
    if (Math.abs(dx) < 12) return true;
    const playerFacing = Math.sign(player.facing || 1) || 1;
    return Math.sign(dx) === playerFacing;
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
      this.isObserved = false;
      this.state = 'phase_shift';
      this.actionKind = 'creaking_surge';
      this.stateDuration = this.stateTimer = 0.85;
      this.vx = 0;
      audio.playAwakening?.();
      camera?.addShake?.(0.58);
      particles.addShockwave(this.x, this.y - 68, 270, '#f97316', 12);
      particles.addTextBanner(this.x, this.y - 145, '🔶 CREAKING HEART // RESIN OVERDRIVE! 🔶', '#fb923c');
      speech.spawnSpeechBubble(this, '*CREEAAAK! THE GARDEN AWAKENS!*', {
        style: 'shout',
        trauma: 1.0,
        priority: 5,
        mood: '💀',
        anchor: this
      });
      speech.triggerBanter([
        { speaker: 'yellow', text: 'ITS HEART IS GLOWING ORANGE!', delay: 0.35, options: { style: 'comic', priority: 3, mood: '⚡' } }
      ]);
    }

    this.hurtTimer = Math.max(0, this.hurtTimer - safeDt);
    this.isHurt = this.hurtTimer > 0;
    this.freezeTimer = Math.max(0, this.freezeTimer - safeDt);
    this.stunTimer = Math.max(0, this.stunTimer - safeDt);

    const stepDt = safeDt * (this.freezeTimer > 0 ? 0.68 : 1);
    if (this.stunTimer > 0 && this.state !== 'phase_shift') {
      this.vx = 0;
    } else {
      this.updateAI(stepDt, player, camera);
    }

    if (this.state !== 'blink_active') {
      this.x += this.vx * stepDt;
    }
    this.y = groundY;
    this.isGrounded = true;
    this.x = clamp(this.x, LEFT, RIGHT);
    if (this.actionKind === 'creaking_statue') {
      this.pose = 'idle';
    } else {
      this.pose = Math.abs(this.vx) > 15 || this.state === 'blink_active' ? 'zombie_walk' : 'idle';
    }
  }

  updateAI(dt, player, camera) {
    if (!player || player.isDead) {
      this.vx *= 0.85;
      this.isObserved = false;
      return;
    }
    const dx = player.x - this.x;
    if (this.state === 'recovery') {
      this.facing = dx >= 0 ? 1 : -1;
      this.actionKind = null;
      this.isObserved = false;
    }

    switch (this.state) {
      case 'idle': {
        this.facing = dx >= 0 ? 1 : -1;
        this.isObserved = this.checkPlayerGaze(player);

        if (this.isObserved) {
          // Gaze-Freeze ("Don't Blink"): freezes into a rigid Pale Oak statue when watched!
          this.vx = 0;
          this.actionKind = 'creaking_statue';
          this.actionCooldown -= dt * 0.75;
        } else {
          // Unobserved: stalks rapidly with jerky wooden puppet steps!
          this.actionKind = null;
          this.actionCooldown -= dt * 1.15;
          const stalkSpeed = this.phase === 2 ? 320 : 255;
          if (Math.abs(dx) > 95) this.vx = this.facing * stalkSpeed;
          else if (Math.abs(dx) < 55) this.vx = -this.facing * 65;
          else this.vx *= 0.78;
        }

        if (this.actionCooldown <= 0) {
          this.isObserved = false;
          const moveSlot = this.attackIndex % 3;
          this.attackIndex++;
          if (moveSlot === 0) this.startBlinkAmbush(player, camera);
          else if (moveSlot === 1) this.startRootSnare(player, camera);
          else this.startResinSurge(player, camera);
        }
        break;
      }
      case 'phase_shift': {
        this.stateTimer -= dt;
        this.actionKind = 'creaking_surge';
        if (this.stateTimer <= 0) this.recover(0.5);
        break;
      }
      case 'blink_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'creaking_blink';
        if (this.stateTimer <= 0) {
          this.state = 'blink_active';
          this.stateDuration = this.stateTimer = this.phase === 2 ? 0.34 : 0.42;
          this.rollStartX = this.x;
          particles.createHitSparks(this.x, this.groundY - 68, 10, '#cbd5e1');
          particles.createHitSparks(this.x, this.groundY - 72, 8, '#f97316');
          audio.playBruteStomp?.();
          camera?.addShake?.(0.24);
        }
        break;
      }
      case 'blink_active': {
        this.stateTimer -= dt;
        this.actionKind = 'creaking_blink';
        const progress = clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
        this.x = this.rollStartX + (this.rollTargetX - this.rollStartX) * progress;

        if (!this.attackHit && canHitPlayer(player)) {
          const inX = Math.abs(player.x - this.x) < this.radius + (player.radius || 20) + 22;
          const inY = Math.abs(player.y - this.groundY) < 95;
          const inZ = Math.abs((player.z || 0) - (this.z || 0)) <= 170;
          if (inX && inY && inZ) {
            this.attackHit = true;
            player._pendingDamageCause = 'The Second Coming blinked and was ambushed by The Creaking';
            player.takeDamage(this.phase === 2 ? 32 : 26, this.rollDirection, 540);
            particles.createHitSparks(player.x, player.y - 38, 12, '#f97316');
          }
        }
        if (this.stateTimer <= 0) {
          particles.addShockwave(this.x, this.groundY - 16, 125, '#f97316', 8);
          camera?.addShake?.(0.24);
          this.recover(this.phase === 2 ? 0.46 : 0.62);
        }
        break;
      }
      case 'roots_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'creaking_roots';
        if (this.stateTimer <= 0) {
          this.state = 'roots_active';
          this.stateDuration = this.stateTimer = 0.4;
          this.dropResolved = false;
        }
        break;
      }
      case 'roots_active': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'creaking_roots';
        if (!this.dropResolved && this.stateTimer <= 0.22) {
          this.resolveRootSnare(player, camera);
        }
        if (this.stateTimer <= 0) {
          this.recover(this.phase === 2 ? 0.48 : 0.65);
        }
        break;
      }
      case 'surge_windup': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'creaking_surge';
        if (this.stateTimer <= 0) {
          this.state = 'surge_active';
          this.stateDuration = this.stateTimer = 0.44;
          this.surgeResolved = false;
        }
        break;
      }
      case 'surge_active': {
        this.stateTimer -= dt;
        this.vx = 0;
        this.actionKind = 'creaking_surge';
        if (!this.surgeResolved && this.stateTimer <= 0.26) {
          this.resolveResinSurge(player, camera);
        }
        if (this.stateTimer <= 0) {
          this.recover(this.phase === 2 ? 0.5 : 0.68);
        }
        break;
      }
      case 'recovery': {
        this.stateTimer -= dt;
        this.vx *= 0.82;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.actionCooldown = this.phase === 2 ? 0.42 : 0.64;
        }
        break;
      }
      default:
        this.state = 'idle';
    }
  }

  startBlinkAmbush(player, camera) {
    this.state = 'blink_windup';
    this.actionKind = 'creaking_blink';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.46 : 0.58;
    this.rollStartX = this.x;
    this.rollDirection = player.x >= this.x ? 1 : -1;
    this.facing = this.rollDirection;
    this.rollTargetX = clamp(player.x + this.rollDirection * 140, LEFT + 60, RIGHT - 60);
    if (Math.abs(this.rollTargetX - this.x) < 180) {
      this.rollTargetX = clamp(player.x - this.rollDirection * 260, LEFT + 60, RIGHT - 60);
      this.rollDirection = Math.sign(this.rollTargetX - this.x) || 1;
      this.facing = this.rollDirection;
    }
    this.attackHit = false;
    speech.spawnBubble(this.x, this.y - 126, '🪵 *CREAK... DON\'T BLINK!*', 'creaking:blink', 1.2, {
      anchor: this,
      cooldownMs: 2400
    });
    camera?.addShake?.(0.16);
  }

  startRootSnare(player, camera) {
    this.state = 'roots_windup';
    this.actionKind = 'creaking_roots';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.5 : 0.62;
    const base = clamp(player.x, LEFT + 80, RIGHT - 80);
    this.dropXs[0] = base;
    this.dropXs[1] = clamp(base - 160, LEFT + 60, RIGHT - 60);
    this.dropXs[2] = clamp(base + 160, LEFT + 60, RIGHT - 60);
    this.dropResolved = false;
    speech.spawnBubble(this.x, this.y - 126, '*PALE ROOTS... SNARE!*', 'creaking:roots', 1.2, {
      anchor: this,
      cooldownMs: 2400
    });
    camera?.addShake?.(0.18);
  }

  resolveRootSnare(player, camera) {
    this.dropResolved = true;
    const blastRadius = 76;
    for (let i = 0; i < this.dropXs.length; i++) {
      const bx = this.dropXs[i];
      particles.addShockwave(bx, this.groundY - 14, 102, '#f97316', 9);
      particles.createHitSparks(bx, this.groundY - 26, 12, '#cbd5e1');
    }
    if (canHitPlayer(player) && Math.abs(player.y - this.groundY) < 82) {
      const inZ = Math.abs((player.z || 0) - (this.z || 0)) <= 185;
      if (inZ) {
        for (const bx of this.dropXs) {
          if (Math.abs(player.x - bx) < blastRadius + (player.radius || 20)) {
            player._pendingDamageCause = "The Second Coming was snared by The Creaking's Pale Roots";
            player.takeDamage(this.phase === 2 ? 30 : 24, player.x >= bx ? 1 : -1, 470);
            break;
          }
        }
      }
    }
    audio.playBruteStomp?.();
    camera?.addShake?.(0.36);
  }

  startResinSurge(player, camera) {
    this.state = 'surge_windup';
    this.actionKind = 'creaking_surge';
    this.stateDuration = this.stateTimer = this.phase === 2 ? 0.52 : 0.65;
    this.facing = player.x >= this.x ? 1 : -1;
    this.surgeResolved = false;
    audio.playDoomLaserCharge?.();
    speech.spawnBubble(this.x, this.y - 126, '🧡 *CREAKING HEART SURGE!*', 'creaking:surge', 1.25, {
      anchor: this,
      cooldownMs: 2400
    });
    camera?.addShake?.(0.2);
  }

  resolveResinSurge(player, camera) {
    this.surgeResolved = true;
    particles.addShockwave(this.x, this.groundY - 64, 155, '#f97316', 10);
    particles.addShockwave(0, this.groundY - 110, 120, '#fb923c', 7);
    particles.createHitSparks(this.x, this.groundY - 68, 12, '#fde047');

    projectiles.spawnSpit?.(this.x + this.facing * 26, this.y - 72, player.x, player.y - 36);
    const p1 = projectiles.projectiles?.[projectiles.projectiles.length - 1];
    if (p1) p1.deathCause = "The Second Coming was struck by The Creaking's Resin Bolt";
    if (this.phase === 2) {
      projectiles.spawnSpit?.(this.x + this.facing * 26, this.y - 96, player.x + this.facing * 90, player.y - 64);
      const p2 = projectiles.projectiles?.[projectiles.projectiles.length - 1];
      if (p2) p2.deathCause = "The Second Coming was struck by The Creaking's Resin Bolt";
    }

    if (canHitPlayer(player)) {
      const inX = Math.abs(player.x - this.x) < 145;
      const inY = Math.abs(player.y - this.groundY) < 95;
      const inZ = Math.abs((player.z || 0) - (this.z || 0)) <= 185;
      if (inX && inY && inZ) {
        player._pendingDamageCause = "The Second Coming was overwhelmed by The Creaking's Heart Surge";
        player.takeDamage(this.phase === 2 ? 31 : 25, this.facing, 520);
        particles.createHitSparks(player.x, player.y - 38, 12, '#f97316');
      }
    }
    audio.playFinisherImpact?.();
    camera?.addShake?.(0.38);
  }

  recover(duration) {
    this.state = 'recovery';
    this.stateDuration = this.stateTimer = duration;
    this.actionKind = null;
    this.isObserved = false;
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
    const barkScale = this.actionKind === 'creaking_statue' && !isCrit ? 0.65 : 1;
    const applied = Math.max(1, Math.round(amount * barkScale));
    this.hp = Math.max(0, this.hp - applied);
    this.hurtTimer = 0.16;
    this.isHurt = true;
    if (this.actionKind !== 'creaking_statue') {
      this.vx += knockbackDir * Math.min(90, knockbackPower * 0.15);
    }
    particles.addDamageText(this.x, this.y - 126, applied, isCrit);
    particles.createHitSparks(this.x, this.y - 78, isCrit ? 12 : 7, '#f97316');
    audio.playHit?.(isCrit);
    if (this.hp <= 0) this.die();
    return applied;
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.hp = 0;
    this.vx = 0;
    this.isObserved = false;
    this.state = 'defeated';
    combat.registerKill(this);
    audio.playFinisherImpact?.();
    speech.triggerBanter([
      { speaker: 'creaking_boss', text: '*CREAKING HEART... SHATTERED...*', delay: 0, options: { style: 'shout', priority: 5, mood: '💀', anchor: this } },
      { speaker: 'orange', text: 'NO MORE PEEKABOO TREES!', delay: 0.3, options: { style: 'comic', priority: 3, mood: '★' } }
    ]);
    this.camera?.addShake?.(0.75);
    particles.emitBossExplosion({
      x: this.x,
      y: this.y - 68,
      bodyY: this.y,
      groundY: this.groundY,
      color: '#f97316',
      accent: '#cbd5e1',
      radius: 225,
      stickFigure: false,
      seed: 0xc2ea
    });
  }

  draw() {}
}

// ============================================================================
// 5. 3D CAMPAIGN EXTENSION (18: Stronghold, 19: The End .. 28: Outside Rocket Corp, 29: Rocket Corp, 30: H4C3R)
// ============================================================================
export const CAMPAIGN_BEATS_3D = Object.freeze({
  ...CAMPAIGN_BEATS,
  10: Object.freeze({
    act: 'II - THE SHOWDOWN (AVA 8)',
    mission: 'DEFEAT THE DARK LORD AT THE LAKE',
    clearText: 'SHOWDOWN WON!',
    clue: 'VIRABOT LAB SECURED',
    bossLabel: 'THE DARK LORD',
    allyReaction: Object.freeze({ ally: 'chosen', line: 'THE SHOWDOWN IS OVER.' })
  }),
  17: Object.freeze({
    act: 'V - ROOT OF LUCK',
    mission: 'OUTLUCK THE LUCKY ORB',
    clearText: 'ORB SENT HOME!',
    clue: 'SUBTERRANEAN VAULT: THE STRONGHOLD',
    bossLabel: 'THE LUCKY ORB',
    allyReaction: Object.freeze({ ally: 'yellow', line: 'LUCK RAN OUT!' })
  }),
  18: Object.freeze({
    act: 'VI - DIMENSIONS BEYOND',
    mission: 'LIGHT THE STRONGHOLD END PORTAL',
    clearText: 'END PORTAL IGNITED!',
    clue: 'VOID RIFT OPEN: THE END',
    bossLabel: null,
    allyReaction: Object.freeze({ ally: 'red', line: 'ALL TWELVE EYES OF ENDER ARE LIT!' })
  }),
  19: Object.freeze({
    act: 'VI - DIMENSIONS BEYOND',
    mission: 'SLAY THE ENDER DRAGON',
    clearText: 'THE END LIBERATED!',
    clue: 'SKY PORTAL: THE AETHER',
    bossLabel: 'ENDER DRAGON',
    allyReaction: Object.freeze({ ally: 'red', line: 'DRAGON DOWN! BIG EGG!' })
  }),
  20: Object.freeze({
    act: 'VI - DIMENSIONS BEYOND',
    mission: 'CROSS THE AETHER SKYLANDS',
    clearText: 'AETHER BRIDGE CLEAR!',
    clue: 'DEEP DARK RIFT: ANCIENT CITY',
    bossLabel: null,
    allyReaction: Object.freeze({ ally: 'blue', line: 'GOLDEN TREES! SHINY!' })
  }),
  21: Object.freeze({
    act: 'VI - DIMENSIONS BEYOND',
    mission: 'SILENCE THE WARDEN',
    clearText: 'ANCIENT CITY SILENCED!',
    clue: 'MISTY GROVE: PALE GARDEN',
    bossLabel: 'THE WARDEN',
    allyReaction: Object.freeze({ ally: 'green', line: 'NO MORE NOTE BLOCKS DOWN HERE!' })
  }),
  22: Object.freeze({
    act: 'VI - DIMENSIONS BEYOND',
    mission: 'SHATTER THE CREAKING',
    clearText: 'CREAKING HEART SHATTERED!',
    clue: 'SUNLIGHT AHEAD: MINECRAFT OVERWORLD',
    bossLabel: 'THE CREAKING',
    allyReaction: Object.freeze({ ally: 'yellow', line: 'KEEP EYES ON THE TREE!' })
  }),
  23: Object.freeze({
    act: 'VI - MINECRAFT EXPANSION',
    mission: 'DEFEND THE OVERWORLD VILLAGE',
    clearText: 'OVERWORLD SECURED!',
    clue: 'APP GAUNTLET: YOUTUBE.COM',
    bossLabel: null,
    allyReaction: Object.freeze({ ally: 'blue', line: 'FRESH AIR! WATCH FOR CREEPERS & TNT!' })
  }),
  24: Object.freeze({
    act: 'VII - DESKTOP APP GAUNTLET',
    mission: 'SURVIVE THE VIRAL STREAM',
    clearText: 'STREAM MONETIZED!',
    clue: 'NEW TAB OPENED: CHROME://ARENA',
    bossLabel: null,
    allyReaction: Object.freeze({ ally: 'green', line: 'SMASH THAT SUBSCRIBE BUTTON!' })
  }),
  25: Object.freeze({
    act: 'VII - DESKTOP APP GAUNTLET',
    mission: 'CLEAR THE BROWSER TABS',
    clearText: 'CACHE PURGED!',
    clue: 'AUDIO STREAM: SPOTIFY.EXE',
    bossLabel: null,
    allyReaction: Object.freeze({ ally: 'yellow', line: 'WATCH THE RAM USAGE!' })
  }),
  26: Object.freeze({
    act: 'VII - DESKTOP APP GAUNTLET',
    mission: 'RIDE THE BASS DROP',
    clearText: 'PLAYLIST MASTERED!',
    clue: 'DECK LOADED: GOOGLE SLIDES',
    bossLabel: null,
    allyReaction: Object.freeze({ ally: 'green', line: 'THIS BEAT DROPS HARD!' })
  }),
  27: Object.freeze({
    act: 'VII - DESKTOP APP GAUNTLET',
    mission: 'CRASH THE PRESENTATION',
    clearText: 'SLIDE DECK PRESENTED!',
    clue: 'PERIMETER CHECKPOINT: OUTSIDE ROCKET CORP',
    bossLabel: null,
    allyReaction: Object.freeze({ ally: 'blue', line: 'NEXT SLIDE, PLEASE!' })
  }),
  28: Object.freeze({
    act: 'VIII - ROCKET CORP CONTAINMENT',
    mission: 'BREACH THE ROCKET CORP GATES',
    clearText: 'PERIMETER BREACHED!',
    clue: 'ENTERING FACILITY: ROCKET CORP HQ',
    bossLabel: null,
    allyReaction: Object.freeze({ ally: 'chosen', line: 'THAT TOWER... THEY ARE INSIDE.' })
  }),
  29: Object.freeze({
    act: 'VIII - ROCKET CORP CONTAINMENT',
    mission: 'DEFEAT THE MERCENARIES',
    clearText: 'THE BOX BREACHED!',
    clue: 'FINAL TRACE: ROOT://H4C3R',
    bossLabel: 'AGENT · BALLISTA · PRIMAL · HAZARD',
    allyReaction: Object.freeze({ ally: 'chosen', line: 'NOT GOING BACK IN THE BOX.' })
  }),
  30: Object.freeze({
    act: 'IX - ZERO-DAY FINALE',
    mission: 'LOG OUT H4C3R',
    clearText: 'SYSTEM RESTORED!',
    clue: 'RESTORE KEY COMPLETE',
    bossLabel: 'H4C3R',
    allyReaction: Object.freeze({ ally: 'green', line: 'FINAL BOSS MUSIC!' })
  })
});

export const OVERWORLD_OUTPOST_BLOCKS = Object.freeze([
  Object.freeze({ x: 272, y: 0, z: 0, texKey: 'cobblestone', armedOnHit: false }),
  Object.freeze({ x: 272, y: -68, z: 0, texKey: 'oak_planks', armedOnHit: false }),
  Object.freeze({ x: 340, y: 0, z: 0, texKey: 'tnt_block', armedOnHit: true }),
  Object.freeze({ x: 408, y: 0, z: 0, texKey: 'grass_block', armedOnHit: false }),
  Object.freeze({ x: 408, y: -68, z: 0, texKey: 'crafting_table', armedOnHit: false })
]);

export function formatAttackerDeathMessage(attacker) {
  if (!attacker || typeof attacker !== 'object') {
    return 'The Second Coming was defeated in battle';
  }
  const type = String(attacker.type || '').toLowerCase();
  const action = String(attacker.actionKind || attacker.state || '').toLowerCase();
  switch (type) {
    case 'boom_bug':
      return 'The Second Coming was blown up by Boom-Bug';
    case 'creeper_lord':
      return 'The Second Coming was blown up by Creeper Lord';
    case 'warden_boss':
      if (action.includes('sonic')) return "The Second Coming was obliterated by The Warden's Sonic Boom";
      if (action.includes('slam')) return "The Second Coming was shattered by The Warden's Sculk Slam";
      return 'The Second Coming was crushed by The Warden';
    case 'creaking_boss':
      if (action.includes('root')) return "The Second Coming was snared by The Creaking's Pale Roots";
      if (action.includes('surge')) return "The Second Coming was overwhelmed by The Creaking's Heart Surge";
      return 'The Second Coming blinked and was ambushed by The Creaking';
    case 'ender_dragon':
      if (action.includes('breath')) return "The Second Coming was roasted in Ender Dragon's Breath";
      return 'The Second Coming was launched by Ender Dragon';
    case 'mercenary_agent':
      return 'The Second Coming was paused & erased by Agent';
    case 'mercenary_ballista':
      return "The Second Coming was blown up by Ballista's 8-Bit Bazooka";
    case 'mercenary_primal':
      return 'The Second Coming was speared by Primal';
    case 'mercenary_hazard':
      return 'The Second Coming was electrocuted by Hazard';
    case 'titan_boss':
      return 'The Second Coming was smashed by Titan Undead';
    case 'dark_lord':
      return 'The Second Coming was struck down by The Dark Lord';
    case 'king_orange':
      return "The Second Coming was blasted by King Orange's Command Staff";
    case 'giant_cat':
      return 'The Second Coming was swiped off the desktop by Giant Cat';
    case 'lucky_orb':
      return 'The Second Coming was crushed by The Lucky Orb';
    case 'h4c3r':
      return 'The Second Coming was deleted from the system by H4C3R';
    case 'brute':
      return 'The Second Coming was ground-slammed by Brute Zombie';
    case 'warden':
      return 'The Second Coming was battered by Warden Zombie';
    case 'runner':
      return 'The Second Coming was blitzed by Runner Zombie';
    case 'crawler':
      return 'The Second Coming was ambushed by Crawler';
    case 'shieldbearer':
      return 'The Second Coming was bashed by Shieldbearer';
    case 'stalker':
      return 'The Second Coming was backstabbed by Glitch Stalker';
    case 'spitter':
      return 'The Second Coming was corroded by Acid Spitter';
    case 'walker':
      return 'The Second Coming was slain by Basic Zombie';
    default: {
      const label = attacker.name || (type ? type.replaceAll('_', ' ') : 'a hostile bug');
      return `The Second Coming was slain by ${label}`;
    }
  }
}

function formatSingleProjectileDeathMessage(p) {
  if (!p || typeof p !== 'object') return 'The Second Coming was shot down by hostile fire';
  if (p.deathCause) return String(p.deathCause);
  const pType = String(p.type || '').toLowerCase();
  if (pType === 'doom_laser') return "The Second Coming was vaporized by The Dark Lord's Doom Laser";
  if (pType === 'dragon_breath') return "The Second Coming was roasted in Ender Dragon's Breath";
  if (pType === 'acid_pool') return 'The Second Coming melted in Acid Spitter venom';
  if (pType === 'acid_blob' || p.spawnsAcidPool) return 'The Second Coming was melted by an Acid Spitter glob';
  if (pType === 'virabot') return 'The Second Coming was corrupted by a ViraBot';
  if (pType === 'energy_orb' || pType === 'command_bolt') {
    return "The Second Coming was blasted by King Orange's Command Bolt";
  }
  return 'The Second Coming was shot down by hostile fire';
}

export function formatProjectileDeathMessage(projOrPlayer, projectilesMgr, stageTheme = 'desktop') {
  if (!projectilesMgr && projOrPlayer && typeof projOrPlayer === 'object' && ('type' in projOrPlayer || 'deathCause' in projOrPlayer || 'spawnsAcidPool' in projOrPlayer)) {
    return formatSingleProjectileDeathMessage(projOrPlayer);
  }
  const player = projOrPlayer;
  if (projectilesMgr) {
    const px = player?.x || 0;
    const py = (player?.y || 0) - 30;
    const activeProjs = projectilesMgr.projectiles || [];
    for (let i = 0; i < activeProjs.length; i++) {
      const p = activeProjs[i];
      if (!p) continue;
      if (p.type === 'doom_laser') {
        return "The Second Coming was vaporized by The Dark Lord's Doom Laser";
      }
      if (!p.isHostile) continue;
      if (Math.hypot((p.x || 0) - px, (p.y || 0) - py) <= (p.radius || 20) + 95) {
        return formatSingleProjectileDeathMessage(p);
      }
    }
    const hazards = projectilesMgr.hazards || [];
    for (let i = 0; i < hazards.length; i++) {
      const h = hazards[i];
      if (h && Math.abs((player?.x || 0) - (h.x || 0)) <= (h.radius || 60) + 30) {
        return 'The Second Coming melted in Acid Spitter venom';
      }
    }
  }
  return stageTheme === 'virabot' || stageTheme === 'dark_core'
    ? 'The Second Coming was corrupted by a ViraBot'
    : 'The Second Coming was shot down by hostile fire';
}

export function resolvePlayerDeathCause(player, fallbackOrOptions = '') {
  if (player?._pendingDamageCause) {
    const msg = String(player._pendingDamageCause);
    player._pendingDamageCause = null;
    return msg;
  }
  if (player?.lastDeathReason) {
    return String(player.lastDeathReason);
  }
  if (player?._activeAttacker) {
    return formatAttackerDeathMessage(player._activeAttacker);
  }
  if (typeof fallbackOrOptions === 'string') {
    if (player?.lastDamageCause) return String(player.lastDamageCause);
    if (fallbackOrOptions) return fallbackOrOptions;
    return 'The Second Coming was defeated in battle';
  }
  const {
    phase = null,
    stageTheme = 'desktop',
    projectilesMgr = null,
    wavesMgr = null
  } = fallbackOrOptions || {};
  if (phase === 'stage_hazards') {
    if (stageTheme === 'youtube') {
      return 'The Second Coming was vaporized by a YouTube Skip-Ad Laser';
    }
    return 'The Second Coming was vaporized by a Security Laser';
  }
  if (phase === 'projectiles') {
    return formatProjectileDeathMessage(player, projectilesMgr, stageTheme);
  }
  if (wavesMgr?.zombies?.length) {
    let nearest = null;
    let bestDist = 360;
    const px = player?.x || 0;
    const py = player?.y || 0;
    for (let i = 0; i < wavesMgr.zombies.length; i++) {
      const z = wavesMgr.zombies[i];
      if (!z || z.isDead) continue;
      const d = Math.hypot((z.x || 0) - px, (z.y || 0) - py);
      if (d < bestDist) {
        bestDist = d;
        nearest = z;
      }
    }
    if (nearest) return formatAttackerDeathMessage(nearest);
    if (wavesMgr.bossZombie && !wavesMgr.bossZombie.isDead) {
      return formatAttackerDeathMessage(wavesMgr.bossZombie);
    }
  }
  if (player?.lastDamageCause) return String(player.lastDamageCause);
  return 'The Second Coming was defeated in battle';
}

export function extendCampaignFor3D(stageManager, waveDirector) {
  if (stageManager._extendedFor3D) return;
  stageManager._extendedFor3D = true;

  const origLoadStage = stageManager.loadStage.bind(stageManager);
  const origEnterTrophy = stageManager.enterTrophyRoom ? stageManager.enterTrophyRoom.bind(stageManager) : () => {};
  const origGetBeat = stageManager.getCampaignBeat ? stageManager.getCampaignBeat.bind(stageManager) : (s) => CAMPAIGN_BEATS_3D[s] || {};

  stageManager.maxStage = 30;
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
    const stage = Math.max(1, Math.min(30, Math.trunc(Number(stageNum)) || 1));
    return CAMPAIGN_BEATS_3D[stage] || origGetBeat(stage);
  };

  stageManager.loadStage = (stageNum) => {
    const numericStage = Number.isFinite(stageNum) ? Math.trunc(stageNum) : 1;
    const stage = Math.max(1, Math.min(30, numericStage));

    if (stage <= 17) {
      origLoadStage(stage);
      stageManager.maxStage = 30;
      stageManager.campaignBeat = CAMPAIGN_BEATS_3D[stage];
      if (stage === 7) {
        stageManager.lavaHazards = [
          { x: -360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 },
          { x: 360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 }
        ];
      } else {
        stageManager.lavaHazards = [];
      }
      if (stage === 10) {
        stageManager.stageName = 'Outernet Lake (AvA 8 Showdown)';
        if (stageManager.platforms?.[0]) stageManager.platforms[0].title = 'Waterfall_Cliff_Ledge';
        if (stageManager.platforms?.[1]) stageManager.platforms[1].title = 'Shack_Bluff_Overlook';
        if (stageManager.platforms?.[2]) stageManager.platforms[2].title = 'Showdown_Canyon_Crag';
        if (stageManager.movingPlatforms?.[0]) stageManager.movingPlatforms[0].title = 'Ruptured_Boulder_W';
        if (stageManager.movingPlatforms?.[1]) stageManager.movingPlatforms[1].title = 'Ruptured_Boulder_E';
      }
      return;
    }

    if (stage === 30) {
      // Stage 30 is Zero-Day Mainframe (H4C3R), built from original stage 18
      origLoadStage(18);
      stageManager.currentStage = 30;
      stageManager.maxStage = 30;
      stageManager.campaignBeat = CAMPAIGN_BEATS_3D[30];
      stageManager.lavaHazards = [];
      return;
    }

    // Reset common state via stage 1 then customize for Stages 18..29
    origLoadStage(1);
    stageManager.currentStage = stage;
    stageManager.maxStage = 30;
    stageManager.campaignBeat = CAMPAIGN_BEATS_3D[stage];
    stageManager.platforms = [];
    stageManager.movingPlatforms = [];
    stageManager.desktopIcons = [];
    stageManager.laserHazards = [];
    stageManager.lavaHazards = [];
    stageManager.errorPopups = [];

    if (stage === 18) {
      // STAGE 18: THE STRONGHOLD (Subterranean Stone-Brick Fortress & End Portal Room before The End!)
      stageManager.stageName = 'The Stronghold';
      stageManager.theme = 'stronghold';
      stageManager.platforms = [
        { x: -620, y: -165, width: 245, height: 22, title: 'Stronghold_Library_W', appType: 'stronghold' },
        { x: 0, y: -275, width: 310, height: 24, title: 'End_Portal_Sanctum', appType: 'stronghold' },
        { x: 620, y: -165, width: 245, height: 22, title: 'Iron_Prison_Walk_E', appType: 'stronghold' }
      ];
      stageManager.movingPlatforms = [
        {
          x: 0,
          y: -150,
          width: 195,
          height: 20,
          title: 'Stone_Brick_Bridge',
          appType: 'stronghold',
          minX: -320,
          maxX: 320,
          speed: 125,
          dir: 1,
          axis: 'x'
        }
      ];
      stageManager.lavaHazards = [
        { x: 0, y: 0, z: 0, width: 165, height: 10, depth3d: 185, damage: 20 }
      ];
      stageManager.desktopIcons = [
        { x: -800, y: -125, label: 'Eye_of_Ender', icon: '👁', color: '#2dd4bf' },
        { x: -320, y: -340, label: 'Stronghold_Tome', icon: '📖', color: '#facc15' },
        { x: 320, y: -340, label: 'Silverfish_Cage', icon: '⛓', color: '#94a3b8' },
        { x: 800, y: -125, label: 'Portal_Frame', icon: '▣', color: '#34d399' }
      ];
    } else if (stage === 19) {
      // STAGE 19: THE END (Ender Dragon Boss)
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
    } else if (stage === 20) {
      // STAGE 20: THE AETHER (Golden Skylands)
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
          dir: 1,
          axis: 'x'
        }
      ];
      stageManager.desktopIcons = [
        { x: -800, y: -120, label: 'Glowstone_Gate', icon: '☀', color: '#ffd43b' },
        { x: -320, y: -360, label: 'Ambrosium', icon: '✦', color: '#facc15' },
        { x: 320, y: -360, label: 'Valkyrie_Lance', icon: '⚔', color: '#38d9a9' },
        { x: 800, y: -120, label: 'Sky_Bridge', icon: '☁', color: '#7dd3fc' }
      ];
    } else if (stage === 21) {
      // STAGE 21: ANCIENT CITY (Deep Dark — The Warden Boss)
      stageManager.stageName = 'Ancient City';
      stageManager.theme = 'ancient_city';
      stageManager.platforms = [
        { x: -620, y: -170, width: 250, height: 22, title: 'Deepslate_Catwalk_W', appType: 'minecraft' },
        { x: 0, y: -285, width: 320, height: 24, title: 'Sculk_Portal_Altar', appType: 'minecraft' },
        { x: 620, y: -170, width: 250, height: 22, title: 'Deepslate_Catwalk_E', appType: 'minecraft' }
      ];
      stageManager.movingPlatforms = [
        {
          x: 0,
          y: -165,
          width: 200,
          height: 20,
          title: 'Soul_Lantern_Bridge',
          appType: 'minecraft',
          minX: -290,
          maxX: 290,
          speed: 115,
          dir: 1,
          axis: 'x'
        }
      ];
      stageManager.desktopIcons = [
        { x: -800, y: -130, label: 'Sculk_Sensor', icon: '〰', color: '#22d3ee' },
        { x: -310, y: -340, label: 'Sculk_Shrieker', icon: '🔊', color: '#67e8f9' },
        { x: 310, y: -340, label: 'Echo_Shard', icon: '❖', color: '#06b6d4' },
        { x: 800, y: -130, label: 'Soul_Lantern', icon: '🕯', color: '#38bdf8' }
      ];
    } else if (stage === 22) {
      // STAGE 22: PALE GARDEN (Haunted Monochrome Grove — The Creaking Boss)
      stageManager.stageName = 'Pale Garden';
      stageManager.theme = 'pale_garden';
      stageManager.platforms = [
        { x: -620, y: -170, width: 250, height: 22, title: 'Pale_Oak_Bough_W', appType: 'minecraft' },
        { x: 0, y: -285, width: 320, height: 24, title: 'Creaking_Heart_Canopy', appType: 'minecraft' },
        { x: 620, y: -170, width: 250, height: 22, title: 'Pale_Oak_Bough_E', appType: 'minecraft' }
      ];
      stageManager.movingPlatforms = [
        {
          x: 0,
          y: -165,
          width: 205,
          height: 20,
          title: 'Hanging_Moss_Bough',
          appType: 'minecraft',
          minX: -295,
          maxX: 295,
          speed: 120,
          dir: 1,
          axis: 'x'
        }
      ];
      stageManager.desktopIcons = [
        { x: -800, y: -130, label: 'Creaking_Heart', icon: '🧡', color: '#f97316' },
        { x: -310, y: -340, label: 'Open_Eyeblossom', icon: '👁', color: '#fb923c' },
        { x: 310, y: -340, label: 'Resin_Clump', icon: '❖', color: '#facc15' },
        { x: 800, y: -130, label: 'Pale_Hanging_Moss', icon: '🌿', color: '#cbd5e1' }
      ];
    } else if (stage === 23) {
      // STAGE 23: MINECRAFT OVERWORLD (Sunlit Plains, Oak Village, Crafting Outpost & TNT Quarry)
      stageManager.stageName = 'Minecraft Overworld';
      stageManager.theme = 'overworld';
      stageManager.platforms = [
        { x: -580, y: -160, width: 235, height: 22, title: 'Oak_Canopy_West', appType: 'overworld' },
        { x: 0, y: -255, width: 295, height: 24, title: 'Village_Blacksmith_Roof', appType: 'overworld' },
        { x: 580, y: -160, width: 235, height: 22, title: 'Birch_Hill_Overlook', appType: 'overworld' }
      ];
      stageManager.movingPlatforms = [
        {
          x: -220,
          y: -135,
          width: 175,
          height: 20,
          title: 'Minecart_Rail_Track',
          appType: 'overworld',
          minX: -360,
          maxX: 360,
          speed: 132,
          dir: 1,
          axis: 'x'
        }
      ];
      stageManager.desktopIcons = [
        { x: -800, y: -125, label: 'Grass_Block', icon: '🌱', color: '#4ade80' },
        { x: -320, y: -340, label: 'Crafting_Table', icon: '🛠️', color: '#d97706' },
        { x: 320, y: -340, label: 'TNT_Quarry', icon: '🧨', color: '#ef4444' },
        { x: 800, y: -125, label: 'Diamond_Pick', icon: '⛏️', color: '#38bdf8' }
      ];
    } else if (stage === 24) {
      // STAGE 24: YOUTUBE STUDIO (Animation vs. YouTube — Viral Player Arena)
      stageManager.stageName = 'YouTube Studio';
      stageManager.theme = 'youtube';
      stageManager.platforms = [
        { x: -640, y: -165, width: 250, height: 22, title: 'Up_Next_Queue_01', appType: 'youtube' },
        { x: 0, y: -275, width: 330, height: 24, title: '1080p_60fps_Player', appType: 'youtube' },
        { x: 640, y: -165, width: 250, height: 22, title: 'Subscribe_Bell_CTA', appType: 'youtube' }
      ];
      stageManager.movingPlatforms = [
        {
          x: 0,
          y: -155,
          width: 215,
          height: 20,
          title: 'Timeline_Scrubber',
          appType: 'youtube',
          minX: -340,
          maxX: 340,
          speed: 145,
          dir: 1,
          axis: 'x'
        }
      ];
      stageManager.laserHazards = [
        { x: -190, y: -36, width: 380, height: 10, timer: 0, cycleDuration: 3.4, activeDuration: 1.35, damage: 18 }
      ];
      stageManager.desktopIcons = [
        { x: -800, y: -125, label: 'Play_Button', icon: '▶', color: '#ff0033' },
        { x: -320, y: -340, label: '10M_Diamond', icon: '💎', color: '#38bdf8' },
        { x: 320, y: -340, label: 'Live_Chat', icon: '💬', color: '#f8fafc' },
        { x: 800, y: -125, label: 'Skip_Ad_5s', icon: '⏭', color: '#facc15' }
      ];
    } else if (stage === 25) {
      // STAGE 25: GOOGLE CHROME (Multi-Tab Browser & Offline Dino Arena)
      stageManager.stageName = 'Google Chrome';
      stageManager.theme = 'chrome';
      stageManager.platforms = [
        { x: -660, y: -160, width: 240, height: 22, title: 'Tab_01_Search', appType: 'chrome', accent: '#4285f4' },
        { x: -220, y: -275, width: 235, height: 22, title: 'Omnibox_URL_Bar', appType: 'chrome', accent: '#ea4335' },
        { x: 230, y: -275, width: 235, height: 22, title: 'Incognito_Window', appType: 'chrome', accent: '#fbbc05' },
        { x: 660, y: -160, width: 240, height: 22, title: 'DevTools_Console', appType: 'chrome', accent: '#34a853' }
      ];
      stageManager.movingPlatforms = [
        {
          x: 0,
          y: -165,
          width: 210,
          height: 20,
          title: 'Download_Bar_Chip',
          appType: 'chrome',
          accent: '#4285f4',
          minX: -330,
          maxX: 330,
          speed: 150,
          dir: 1,
          axis: 'x'
        }
      ];
      stageManager.desktopIcons = [
        { x: -810, y: -125, label: 'Offline_Dino', icon: '🦖', color: '#9aa0a6' },
        { x: -330, y: -345, label: 'Bookmarks_Bar', icon: '★', color: '#fbbc05' },
        { x: 330, y: -345, label: 'Extensions', icon: '🧩', color: '#34a853' },
        { x: 810, y: -125, label: 'New_Tab (+)', icon: '🌐', color: '#4285f4' }
      ];
    } else if (stage === 26) {
      // STAGE 26: SPOTIFY PLAYER (Equalizer Spectrum & Vinyl Turntable Arena)
      stageManager.stageName = 'Spotify Player';
      stageManager.theme = 'spotify';
      stageManager.platforms = [
        { x: -640, y: -165, width: 245, height: 22, title: 'Liked_Songs_Queue', appType: 'spotify' },
        { x: 0, y: -290, width: 320, height: 24, title: 'Now_Playing_Vinyl', appType: 'spotify' },
        { x: 640, y: -165, width: 245, height: 22, title: 'Bass_Boost_Mixer', appType: 'spotify' }
      ];
      stageManager.movingPlatforms = [
        {
          x: -290,
          y: -175,
          width: 175,
          height: 20,
          title: 'Equalizer_Bass_W',
          appType: 'spotify',
          minY: -265,
          maxY: -115,
          speed: 118,
          dir: -1,
          axis: 'y'
        },
        {
          x: 290,
          y: -215,
          width: 175,
          height: 20,
          title: 'Equalizer_Treble_E',
          appType: 'spotify',
          minY: -265,
          maxY: -115,
          speed: 126,
          dir: 1,
          axis: 'y'
        }
      ];
      stageManager.desktopIcons = [
        { x: -810, y: -125, label: 'Shuffle_Mode', icon: '🔀', color: '#1db954' },
        { x: -330, y: -350, label: 'Stick_Beats_FM', icon: '🎧', color: '#4ade80' },
        { x: 330, y: -350, label: 'Audio_Spectrum', icon: 'ılı', color: '#1db954' },
        { x: 810, y: -125, label: 'Loop_Track', icon: '🔁', color: '#86efac' }
      ];
    } else if (stage === 27) {
      // STAGE 27: GOOGLE SLIDES (Presentation Deck & Live Chart Arena)
      stageManager.stageName = 'Google Slides';
      stageManager.theme = 'slides';
      stageManager.platforms = [
        { x: -650, y: -160, width: 245, height: 22, title: 'Slide_01_Title_Card', appType: 'slides' },
        { x: -220, y: -275, width: 235, height: 22, title: 'Bullet_Points_Box', appType: 'slides' },
        { x: 230, y: -275, width: 235, height: 22, title: 'Q4_Zombie_Chart', appType: 'slides' },
        { x: 650, y: -160, width: 245, height: 22, title: 'Speaker_Notes_Deck', appType: 'slides' }
      ];
      stageManager.movingPlatforms = [
        {
          x: 0,
          y: -165,
          width: 215,
          height: 20,
          title: 'Slide_Transition_Box',
          appType: 'slides',
          minX: -320,
          maxX: 320,
          speed: 140,
          dir: 1,
          axis: 'x'
        }
      ];
      stageManager.desktopIcons = [
        { x: -810, y: -125, label: 'Slideshow_F5', icon: '📊', color: '#fbbc04' },
        { x: -330, y: -345, label: 'Text_Box_Tool', icon: 'T', color: '#ea4335' },
        { x: 330, y: -345, label: 'Shape_Insert', icon: '◇', color: '#4285f4' },
        { x: 810, y: -125, label: 'Laser_Pointer', icon: '✦', color: '#34a853' }
      ];
    } else if (stage === 28) {
      // STAGE 28: OUTSIDE ROCKET CORP (Outernet Perimeter Plaza & Towering Rocket Corp HQ Exterior!)
      stageManager.stageName = 'Outside Rocket Corp';
      stageManager.theme = 'rocket_corp_exterior';
      stageManager.platforms = [
        { x: -630, y: -165, width: 245, height: 22, title: 'Security_Gatehouse_W', appType: 'rocket_ext' },
        { x: 0, y: -280, width: 320, height: 24, title: 'Rocket_Plaza_Overpass', appType: 'rocket_ext' },
        { x: 630, y: -165, width: 245, height: 22, title: 'Armored_Transport_Bay', appType: 'rocket_ext' }
      ];
      stageManager.movingPlatforms = [
        {
          x: 0,
          y: -160,
          width: 205,
          height: 20,
          title: 'Patrol_Hover_Drone',
          appType: 'rocket_ext',
          minX: -330,
          maxX: 330,
          speed: 142,
          dir: 1,
          axis: 'x'
        }
      ];
      stageManager.laserHazards = [
        { x: 180, y: -38, width: 300, height: 10, timer: 0, cycleDuration: 3.2, activeDuration: 1.4, damage: 20 }
      ];
      stageManager.desktopIcons = [
        { x: -810, y: -125, label: 'Checkpoint_01', icon: '🚧', color: '#facc15' },
        { x: -330, y: -345, label: 'Rocket_Tower', icon: '🏢', color: '#ff6b00' },
        { x: 330, y: -345, label: 'Searchlight', icon: '🔦', color: '#38bdf8' },
        { x: 810, y: -125, label: 'Mercenary_Van', icon: '🚐', color: '#94a3b8' }
      ];
    } else if (stage === 29) {
      // STAGE 29: ROCKET CORP HQ (Mercenaries Boss Squad: Agent, Ballista, Primal, Hazard)
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
    stageManager.maxStage = 30;
    stageManager.currentStage = 30;
    stageManager.lavaHazards = [];
    stageManager.desktopIcons = [
      { x: -900, y: -105, label: 'TITAN', icon: 'T', color: '#8cff66' },
      { x: -720, y: -105, label: 'DARK LORD', icon: 'DL', color: '#ff3344' },
      { x: -540, y: -105, label: 'KING FREED', icon: 'KO', color: '#ff8a22' },
      { x: -360, y: -105, label: 'CREEPER LORD', icon: 'CL', color: '#9be34b' },
      { x: -180, y: -105, label: 'GIANT CAT', icon: 'CAT', color: '#ffb15f' },
      { x: 0, y: -105, label: 'LUCKY ORB', icon: '●', color: '#ffe06b' },
      { x: 180, y: -105, label: 'ENDER DRAGON', icon: 'ED', color: '#e879f9' },
      { x: 360, y: -105, label: 'THE WARDEN', icon: 'WD', color: '#22d3ee' },
      { x: 540, y: -105, label: 'THE CREAKING', icon: 'CK', color: '#f97316' },
      { x: 720, y: -105, label: 'MERCENARIES', icon: 'RC', color: '#ff6b00' },
      { x: 900, y: -105, label: 'H4C3R', icon: 'H4', color: '#67e8f9' }
    ];
  };

  // Extend WaveDirector for Stages 18..30
  activeWaveDirector = waveDirector;
  const origGenerateWaveQueue = waveDirector.generateWaveQueue.bind(waveDirector);
  const origSpawnZombie = waveDirector.spawnZombie.bind(waveDirector);
  const origWaveUpdate = waveDirector.update.bind(waveDirector);

  const STRONGHOLD_RECIPE = Object.freeze({
    total: 16,
    bossHelpers: 0,
    packs: Object.freeze([
      Object.freeze({ gap: 0.92, enemies: Object.freeze(['crawler', 'stalker', 'walker', 'shieldbearer']) }),
      Object.freeze({ gap: 1.02, enemies: Object.freeze(['crawler', 'spitter', 'stalker', 'runner']) }),
      Object.freeze({ gap: 1.1, enemies: Object.freeze(['brute', 'crawler', 'shieldbearer', 'boom_bug']) }),
      Object.freeze({ gap: 1.18, enemies: Object.freeze(['warden', 'stalker', 'spitter', 'boom_bug']) })
    ])
  });

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

  const OVERWORLD_RECIPE = Object.freeze({
    total: 16,
    bossHelpers: 0,
    packs: Object.freeze([
      Object.freeze({ gap: 0.92, enemies: Object.freeze(['walker', 'runner', 'boom_bug', 'spitter']) }),
      Object.freeze({ gap: 1.02, enemies: Object.freeze(['shieldbearer', 'boom_bug', 'walker', 'runner']) }),
      Object.freeze({ gap: 1.1, enemies: Object.freeze(['brute', 'spitter', 'boom_bug', 'crawler']) }),
      Object.freeze({ gap: 1.18, enemies: Object.freeze(['warden', 'boom_bug', 'shieldbearer', 'runner']) })
    ])
  });

  const YOUTUBE_RECIPE = Object.freeze({
    total: 16,
    bossHelpers: 0,
    packs: Object.freeze([
      Object.freeze({ gap: 0.95, enemies: Object.freeze(['runner', 'spitter', 'stalker', 'crawler']) }),
      Object.freeze({ gap: 1.05, enemies: Object.freeze(['shieldbearer', 'spitter', 'boom_bug', 'runner']) }),
      Object.freeze({ gap: 1.1, enemies: Object.freeze(['brute', 'stalker', 'spitter', 'boom_bug']) }),
      Object.freeze({ gap: 1.15, enemies: Object.freeze(['warden', 'runner', 'shieldbearer', 'boom_bug']) })
    ])
  });

  const CHROME_RECIPE = Object.freeze({
    total: 16,
    bossHelpers: 0,
    packs: Object.freeze([
      Object.freeze({ gap: 0.92, enemies: Object.freeze(['runner', 'crawler', 'stalker', 'runner']) }),
      Object.freeze({ gap: 1.02, enemies: Object.freeze(['spitter', 'shieldbearer', 'crawler', 'boom_bug']) }),
      Object.freeze({ gap: 1.1, enemies: Object.freeze(['warden', 'stalker', 'runner', 'spitter']) }),
      Object.freeze({ gap: 1.18, enemies: Object.freeze(['brute', 'shieldbearer', 'boom_bug', 'stalker']) })
    ])
  });

  const SPOTIFY_RECIPE = Object.freeze({
    total: 16,
    bossHelpers: 0,
    packs: Object.freeze([
      Object.freeze({ gap: 0.95, enemies: Object.freeze(['stalker', 'runner', 'boom_bug', 'spitter']) }),
      Object.freeze({ gap: 1.05, enemies: Object.freeze(['warden', 'runner', 'stalker', 'boom_bug']) }),
      Object.freeze({ gap: 1.1, enemies: Object.freeze(['brute', 'spitter', 'shieldbearer', 'runner']) }),
      Object.freeze({ gap: 1.2, enemies: Object.freeze(['warden', 'boom_bug', 'stalker', 'shieldbearer']) })
    ])
  });

  const SLIDES_RECIPE = Object.freeze({
    total: 17,
    bossHelpers: 0,
    packs: Object.freeze([
      Object.freeze({ gap: 0.95, enemies: Object.freeze(['walker', 'spitter', 'shieldbearer', 'runner']) }),
      Object.freeze({ gap: 1.05, enemies: Object.freeze(['stalker', 'brute', 'crawler', 'spitter']) }),
      Object.freeze({ gap: 1.1, enemies: Object.freeze(['warden', 'shieldbearer', 'boom_bug', 'stalker']) }),
      Object.freeze({ gap: 1.2, enemies: Object.freeze(['brute', 'warden', 'spitter', 'boom_bug', 'runner']) })
    ])
  });

  const ROCKET_EXTERIOR_RECIPE = Object.freeze({
    total: 18,
    bossHelpers: 0,
    packs: Object.freeze([
      Object.freeze({ gap: 0.9, enemies: Object.freeze(['shieldbearer', 'runner', 'spitter', 'runner']) }),
      Object.freeze({ gap: 1.0, enemies: Object.freeze(['warden', 'stalker', 'shieldbearer', 'boom_bug']) }),
      Object.freeze({ gap: 1.08, enemies: Object.freeze(['brute', 'spitter', 'stalker', 'runner', 'boom_bug']) }),
      Object.freeze({ gap: 1.16, enemies: Object.freeze(['warden', 'brute', 'shieldbearer', 'spitter', 'stalker']) })
    ])
  });

  waveDirector.generateWaveQueue = (wave) => {
    const stage = Math.max(1, Math.min(30, Math.trunc(Number(wave)) || 1));
    if (stage <= 17) {
      origGenerateWaveQueue(stage);
      return;
    }
    if (stage === 18) {
      // Stage 18: The Stronghold — Silverfish, Endermen-Stalkers & Vault Sentries
      waveDirector.queueWaveRecipe(STRONGHOLD_RECIPE);
      return;
    }
    if (stage === 19) {
      // Stage 19: The End — Ender Dragon Boss
      waveDirector.usesAuthoredRecipe = true;
      waveDirector.spawnQueue.push({ type: 'ender_dragon', delay: 1.1, packIndex: 0, bossHealthGate: null });
      return;
    }
    if (stage === 20) {
      // Stage 20: The Aether — Skylands Wave
      waveDirector.queueWaveRecipe(AETHER_RECIPE);
      return;
    }
    if (stage === 21) {
      // Stage 21: Ancient City — The Warden Boss
      waveDirector.usesAuthoredRecipe = true;
      waveDirector.spawnQueue.push({ type: 'warden_boss', delay: 1.1, packIndex: 0, bossHealthGate: null });
      return;
    }
    if (stage === 22) {
      // Stage 22: Pale Garden — The Creaking Boss
      waveDirector.usesAuthoredRecipe = true;
      waveDirector.spawnQueue.push({ type: 'creaking_boss', delay: 1.1, packIndex: 0, bossHealthGate: null });
      return;
    }
    if (stage === 23) {
      // Stage 23: Minecraft Overworld — Village Raid & Creeper/TNT Wave
      waveDirector.queueWaveRecipe(OVERWORLD_RECIPE);
      return;
    }
    if (stage === 24) {
      // Stage 24: YouTube Studio — Viral Stream Wave
      waveDirector.queueWaveRecipe(YOUTUBE_RECIPE);
      return;
    }
    if (stage === 25) {
      // Stage 25: Google Chrome — Multi-Tab Browser Wave
      waveDirector.queueWaveRecipe(CHROME_RECIPE);
      return;
    }
    if (stage === 26) {
      // Stage 26: Spotify Player — Bass Drop Wave
      waveDirector.queueWaveRecipe(SPOTIFY_RECIPE);
      return;
    }
    if (stage === 27) {
      // Stage 27: Google Slides — Presentation Deck Wave
      waveDirector.queueWaveRecipe(SLIDES_RECIPE);
      return;
    }
    if (stage === 28) {
      // Stage 28: Outside Rocket Corp — Perimeter Security Checkpoint Wave
      waveDirector.queueWaveRecipe(ROCKET_EXTERIOR_RECIPE);
      return;
    }
    if (stage === 29) {
      // Stage 29: Rocket Corp HQ — All 4 Mercenaries from AvA Season 3!
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
    if (stage === 30) {
      // Stage 30: Zero-Day Mainframe — H4C3R
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

    if (type === 'warden_boss') {
      const spawnX = waveDirector.getSafeSpawnX(player);
      const boss = new WardenBoss(spawnX, groundY);
      waveDirector.zombies.push(boss);
      waveDirector.bossZombie = boss;
      audio.playBossRoar?.();
      camera?.addShake?.(0.92);
      particles.addShockwave(spawnX, groundY - 35, 275, '#06b6d4', 12);
      particles.addTextBanner(spawnX, groundY - 130, '🔊 THE WARDEN // ANCIENT CITY 🔊', '#22d3ee');
      speech.triggerBanter([
        { speaker: 'warden_boss', text: '*SNIFF... HEARTBEAT DETECTED!*', delay: 0, options: { style: 'shout', priority: 5, mood: '💀', anchor: boss } },
        { speaker: 'orange', text: 'SHHH! NOBODY MAKE A SOUND!', delay: 0.35, options: { style: 'comic', priority: 3, mood: '💧' } }
      ]);
      return;
    }

    if (type === 'creaking_boss') {
      const spawnX = waveDirector.getSafeSpawnX(player);
      const boss = new CreakingBoss(spawnX, groundY);
      waveDirector.zombies.push(boss);
      waveDirector.bossZombie = boss;
      audio.playBossRoar?.();
      camera?.addShake?.(0.86);
      particles.addShockwave(spawnX, groundY - 35, 265, '#f97316', 12);
      particles.addTextBanner(spawnX, groundY - 130, '🪵 THE CREAKING // PALE GARDEN 🪵', '#fb923c');
      speech.triggerBanter([
        { speaker: 'creaking_boss', text: '*CREEAAAK... DON\'T BLINK...*', delay: 0, options: { style: 'shout', priority: 5, mood: '💀', anchor: boss } },
        { speaker: 'orange', text: 'EYES ON THE SPOOKY TREE!', delay: 0.35, options: { style: 'comic', priority: 3, mood: '!' } }
      ]);
      return;
    }

    if (type.startsWith('mercenary_')) {
      const mercOrder = ['mercenary_agent', 'mercenary_ballista', 'mercenary_primal', 'mercenary_hazard'];
      const idx = Math.max(0, mercOrder.indexOf(type));
      const offsets = [-520, -240, 260, 540];
      const spawnX = Number.isFinite(waveDirector._creativeSpawnX)
        ? waveDirector._creativeSpawnX
        : clamp(offsets[idx] || waveDirector.getSafeSpawnX(player), LEFT + 60, RIGHT - 60);
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

    // If in Stage 26 (Rocket Corp Mercenaries), synthesize combined squad health on waveDirector.bossZombie
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
