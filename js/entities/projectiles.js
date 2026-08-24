
import { particles } from '../engine/particles.js?v=8.4';
import { audio } from '../engine/audio.js?v=8.4';
import { combat } from '../systems/combat.js?v=8.4';

const MAX_PROJECTILES = 64;
const MAX_HOSTILE_PROJECTILES = 32;
const MAX_ACID_POOLS = 12;
const MAX_SKETCH_BLOCKS = 8;
const MAX_VIRABOTS = 4;
const PROJECTILE_ARENA_BOUND = 1060;

function sweptCircleTime(startX, startY, endX, endY, targetX, targetY, radius) {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSq = segmentX * segmentX + segmentY * segmentY;
  let t = 0;
  if (lengthSq > 0.0001) {
    t = ((targetX - startX) * segmentX + (targetY - startY) * segmentY) / lengthSq;
    t = Math.max(0, Math.min(1, t));
  }
  const closestX = startX + segmentX * t;
  const closestY = startY + segmentY * t;
  const dx = targetX - closestX;
  const dy = targetY - closestY;
  return dx * dx + dy * dy <= radius * radius ? t : Infinity;
}

function sweptCircleHit(startX, startY, endX, endY, targetX, targetY, radius) {
  return Number.isFinite(sweptCircleTime(startX, startY, endX, endY, targetX, targetY, radius));
}

export class ProjectileManager {
  constructor() {
    this.projectiles = [];
    this.sketchBlocks = [];
    this.hazards = [];
    this.isUpdatingProjectiles = false;
    this.boundCombatTargets = null;
    this.simTime = 0;
  }

  reset() {
    for (const projectile of this.projectiles) this.retireProjectile(projectile);
    this.projectiles.length = 0;
    this.sketchBlocks.length = 0;
    this.hazards.length = 0;
    this.isUpdatingProjectiles = false;
    this.boundCombatTargets = null;
    this.simTime = 0;
  }

  retireProjectile(projectile) {
    if (!projectile || projectile.type !== 'virabot') return;
    projectile.isDead = true;
    projectile.isTargetable = false;
    projectile.hp = 0;
    this.detachCombatTarget(projectile);
  }

  detachCombatTarget(target) {
    if (!target || !Array.isArray(this.boundCombatTargets)) return;
    const index = this.boundCombatTargets.indexOf(target);
    if (index >= 0) this.boundCombatTargets.splice(index, 1);
  }

  removeProjectileAt(index) {
    if (index < 0 || index >= this.projectiles.length) return null;
    const projectile = this.projectiles[index];
    this.retireProjectile(projectile);
    this.projectiles.splice(index, 1);
    return projectile;
  }

  countHostileProjectiles() {
    let count = 0;
    for (const projectile of this.projectiles) {
      if (projectile.isHostile && !projectile.pendingRemoval) count++;
    }
    return count;
  }

  countVirabots() {
    let count = 0;
    for (const projectile of this.projectiles) {
      if (projectile.type === 'virabot' && !projectile.isDead && !projectile.pendingRemoval) count++;
    }
    return count;
  }

  findEvictionIndex(hostileOnly = false) {
    for (let i = 0; i < this.projectiles.length; i++) {
      const projectile = this.projectiles[i];
      if ((!hostileOnly || projectile.isHostile) && !projectile.critical) return i;
    }
    return -1;
  }

  addProjectile(projectile) {
    if (!projectile) return false;

    if (projectile.isHostile && this.countHostileProjectiles() >= MAX_HOSTILE_PROJECTILES) {
      if (this.isUpdatingProjectiles) return false;
      const hostileIndex = this.findEvictionIndex(true);
      if (hostileIndex < 0) return false;
      this.removeProjectileAt(hostileIndex);
    }

    if (this.projectiles.length >= MAX_PROJECTILES) {
      if (this.isUpdatingProjectiles) return false;
      const evictionIndex = this.findEvictionIndex(false);
      if (evictionIndex < 0) return false;
      this.removeProjectileAt(evictionIndex);
    }

    this.projectiles.push(projectile);
    if (projectile.type === 'virabot' && Array.isArray(this.boundCombatTargets)
        && !this.boundCombatTargets.includes(projectile)) {
      this.boundCombatTargets.push(projectile);
    }
    return true;
  }

  enforceProjectileCaps() {
    while (this.countHostileProjectiles() > MAX_HOSTILE_PROJECTILES) {
      let index = this.findEvictionIndex(true);
      if (index < 0) index = this.projectiles.findIndex((projectile) => projectile.isHostile);
      if (index < 0) break;
      this.removeProjectileAt(index);
    }
    while (this.projectiles.length > MAX_PROJECTILES) {
      let index = this.findEvictionIndex(false);
      if (index < 0) index = 0;
      this.removeProjectileAt(index);
    }
  }

  syncCombatTargets(targets) {
    if (!Array.isArray(targets)) return [];
    this.boundCombatTargets = targets;

    for (let i = targets.length - 1; i >= 0; i--) {
      const target = targets[i];
      if (target?.isProjectileCombatant
          && (target.isDead || !this.projectiles.includes(target))) {
        targets.splice(i, 1);
      }
    }
    for (const projectile of this.projectiles) {
      if (projectile.type === 'virabot' && !projectile.isDead
          && !projectile.pendingRemoval && !targets.includes(projectile)) {
        targets.push(projectile);
      }
    }
    return targets;
  }

  getCombatTargets(targets = []) {
    return this.syncCombatTargets(targets);
  }

  collectHostileTargets(targets = []) {
    if (!Array.isArray(targets)) return [];
    for (const projectile of this.projectiles) {
      if (projectile.type === 'virabot' && !projectile.isDead
          && !projectile.pendingRemoval && !targets.includes(projectile)) {
        targets.push(projectile);
      }
    }
    return targets;
  }

  addAcidPool(pool) {
    if (this.hazards.length >= MAX_ACID_POOLS) this.hazards.splice(0, 1);
    this.hazards.push(pool);
  }

  clearByOwner(owner) {
    if (!owner) return;
    if (this.isUpdatingProjectiles) {
      for (const projectile of this.projectiles) {
        if (projectile.owner === owner) projectile.pendingRemoval = true;
      }
      for (const hazard of this.hazards) {
        if (hazard.owner === owner) hazard.pendingRemoval = true;
      }
      return;
    }

    this.removeEffectsWhere((effect) => effect.owner === owner);
  }

  clearHostileEffects() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].isHostile) this.removeProjectileAt(i);
    }
    this.hazards.length = 0;
  }

  removeEffectsWhere(predicate) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (predicate(this.projectiles[i])) this.removeProjectileAt(i);
    }
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      if (predicate(this.hazards[i])) this.hazards.splice(i, 1);
    }
  }

  update(dt, groundY, zombies, player, camera, friendlyTargets = []) {
    this.simTime += Math.max(0, Math.min(Number(dt) || 0, 0.1));
    this.enforceProjectileCaps();
    this.syncCombatTargets(zombies);

    this.isUpdatingProjectiles = true;
    try {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.life -= dt;
        if (p.pendingRemoval || p.life <= 0) {
          this.removeProjectileAt(i);
          continue;
        }

      if (p.isLanded) continue;

      if (!Number.isFinite(p.vx)) p.vx = 0;
      if (!Number.isFinite(p.vy)) p.vy = 0;

      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.rotation !== undefined && p.rotSpeed) p.rotation += p.rotSpeed * dt;

      if (p.y >= groundY && p.vy > 0) {
        if (p.type === 'acid') {
          this.addAcidPool({
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
          this.removeProjectileAt(i);
          continue;
        } else if (p.type === 'anvil') {
          p.y = groundY;
          p.vy = 0;
          audio.playAnvilHit();
          camera.addShake(0.5);
          particles.addShockwave(p.x, groundY, 160, '#cccccc', 10);
          particles.createHitSparks(p.x, groundY, 15, '#ffffff');

          for (const z of zombies) {
            if (!z.isDead && Math.abs(z.x - p.x) < 140 && Math.abs(z.y - groundY) < 60) {
              z.takeDamage(p.damage, p.x < z.x ? 1 : -1, 700, true);
            }
          }

          p.life = Math.min(p.life, 2.0);
          p.isLanded = true;
          continue;
        } else if (p.type === 'thrown_zombie') {
          p.y = groundY;
          p.vy = -Math.abs(p.vy) * 0.45;
          p.vx *= 0.82;
          audio.playPunch('heavy');
          particles.createDust(p.x, groundY, 8);
          particles.createZombieSplatter(p.x, groundY, 8, '#2e7d32');
          if (camera) camera.addShake(0.25);
        }
      }

      if (p.type === 'virabot') {
        this.updateViraBot(p, dt, groundY, player, friendlyTargets);
      }

      if (p.type === 'doom_laser') {
        if (player && !player.isDead && !player.isRolling && !player.isAwakened) {
          const inBeamX = p.facing > 0 ? (player.x >= p.x && player.x <= p.x + 1800) : (player.x <= p.x && player.x >= p.x - 1800);
          const inBeamY = Math.abs((player.y - 30) - p.y) < p.beamWidth + 15;
          if (!p.hitPlayer && player.iFrames <= 0 && inBeamX && inBeamY) {
            p.hitPlayer = true;
            player.takeDamage(p.damage, p.facing, 450);
            particles.createHitSparks(player.x, p.y, 4, '#ff0033');
            camera.addShake(0.15);
          }
        }
        if (!p.hitAllies) p.hitAllies = new Set();
        for (const ally of friendlyTargets || []) {
          if (!ally || ally.isDead || ally.retreating || ally.isTargetable !== true || p.hitAllies.has(ally)) continue;
          const ahead = p.facing > 0 ? ally.x >= p.x && ally.x <= p.x + 1800 : ally.x <= p.x && ally.x >= p.x - 1800;
          if (ahead && Math.abs((ally.y - (ally.height || 60) * 0.5) - p.y) < p.beamWidth + 15) {
            p.hitAllies.add(ally);
            ally.takeDamage(p.damage, p.facing, 450);
          }
        }
        continue;
      }

      if (p.isHostile) {
        const canContact = p.type !== 'virabot' || p.contactCooldown <= 0;
        let hitTarget = null;
        let hitTime = Infinity;
        if (canContact && player && !player.isRolling && !player.isAwakened) {
          const targetY = player.y - 30;
          const collisionTime = sweptCircleTime(
            p.prevX,
            p.prevY,
            p.x,
            p.y,
            player.x,
            targetY,
            p.radius + 20
          );
          if (collisionTime < hitTime) {
            hitTarget = player;
            hitTime = collisionTime;
          }
        }
        if (canContact) {
          for (const ally of friendlyTargets || []) {
            if (!ally || ally.isTargetable !== true || ally.retreating || ally.isDead) continue;
            const targetY = ally.y - (ally.height || 60) * 0.5;
            const collisionTime = sweptCircleTime(
              p.prevX,
              p.prevY,
              p.x,
              p.y,
              ally.x,
              targetY,
              p.radius + (ally.radius || 18)
            );
            if (collisionTime < hitTime) {
              hitTarget = ally;
              hitTime = collisionTime;
            }
          }
        }
        if (hitTarget) {
          hitTarget.takeDamage(p.damage, p.vx > 0 ? 1 : -1);
          particles.createHitSparks(p.x, p.y, 8, '#ff0033');
          if (p.type === 'virabot') {
            p.contactCooldown = 0.9;
            p.vx *= -0.45;
          } else {
            this.removeProjectileAt(i);
            continue;
          }
        }
      }

        if (!p.isHostile && zombies) {
          if (!p.hitZombies) p.hitZombies = new Set();
          for (const z of zombies) {
            if (z.isDead || p.hitZombies.has(z)) continue;
            if (p.effectRadius > 0) {
              const effectDx = z.x - p.effectOriginX;
              const effectDy = z.y - p.effectOriginY;
              if (effectDx * effectDx + effectDy * effectDy > p.effectRadius * p.effectRadius) continue;
            }
            const targetY = z.y - (z.height || 60) * 0.5;
            if (sweptCircleHit(
              p.prevX,
              p.prevY,
              p.x,
              p.y,
              z.x,
              targetY,
              p.radius + (z.radius || 18)
            )) {
              p.hitZombies.add(z);
              z.takeDamage(p.damage, p.vx > 0 ? 1 : -1, p.knockback || 300, p.isCrit);
              particles.createHitSparks(p.x, p.y, 8, p.sparkColor || '#ffaa00');

              if (p.pierce > 0) {
                p.pierce--;
              } else {
                this.removeProjectileAt(i);
                break;
              }
            }
          }
        }
      }
    } finally {
      this.isUpdatingProjectiles = false;
      this.removeEffectsWhere((effect) => effect.pendingRemoval === true);
    }

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.duration -= dt;
      h.tickTimer -= dt;

      if (h.duration <= 0) {
        this.hazards.splice(i, 1);
        continue;
      }

      if (h.tickTimer <= 0) {
        let hitTarget = false;
        if (player && !player.isRolling
            && Math.abs(player.x - h.x) < h.radius && Math.abs(player.y - h.y) < 20) {
          player.takeDamage(h.damage, 0);
          hitTarget = true;
        }
        for (const ally of friendlyTargets || []) {
          if (!ally || ally.isTargetable !== true || ally.retreating || ally.isDead) continue;
          if (Math.abs(ally.x - h.x) < h.radius + (ally.radius || 18)
              && Math.abs(ally.y - h.y) < 24) {
            ally.takeDamage(h.damage, ally.x >= h.x ? 1 : -1);
            hitTarget = true;
          }
        }
        if (hitTarget) h.tickTimer = 0.5;
      }
    }

    for (let i = this.sketchBlocks.length - 1; i >= 0; i--) {
      const b = this.sketchBlocks[i];
      b.life -= dt;
      if (b.hp <= 0 || b.life <= 0) {
        particles.createDust(b.x, b.y, 10);
        this.sketchBlocks.splice(i, 1);
      }
    }
  }

  updateViraBot(bot, dt, groundY, player, friendlyTargets = []) {
    if (!bot || bot.isDead) return;

    bot.contactCooldown = Math.max(0, bot.contactCooldown - dt);
    bot.hurtTimer = Math.max(0, bot.hurtTimer - dt);
    bot.freezeTimer = Math.max(0, bot.freezeTimer - dt);
    bot.stunTimer = Math.max(0, bot.stunTimer - dt);

    if (bot.y >= groundY) {
      bot.y = groundY;
      bot.vy = 0;
      bot.isGrounded = true;
    } else {
      bot.isGrounded = false;
    }

    if (bot.hookPullTimer > 0) {
      bot.hookPullTimer = Math.max(0, bot.hookPullTimer - dt);
      const source = bot.hookPullSource;
      if (!source || source.isDead || !Number.isFinite(source.x)) {
        bot.hookPullTimer = 0;
        bot.hookPullSource = null;
        bot.vx *= 0.25;
      } else {
        const destination = Math.max(
          -PROJECTILE_ARENA_BOUND,
          Math.min(PROJECTILE_ARENA_BOUND, source.x + bot.hookPullSide * bot.hookPullStopDistance)
        );
        const dx = destination - bot.x;
        if (Math.abs(dx) <= 10) {
          bot.hookPullTimer = 0;
          bot.hookPullSource = null;
          bot.vx = 0;
        } else {
          bot.facing = dx >= 0 ? 1 : -1;
          bot.vx = bot.facing * Math.min(700, Math.max(340, Math.abs(dx) * 4));
        }
      }
      bot.x = Math.max(-PROJECTILE_ARENA_BOUND, Math.min(PROJECTILE_ARENA_BOUND, bot.x));
      return;
    }

    if (bot.stunTimer > 0) {
      bot.vx = 0;
      return;
    }
    if (bot.hurtTimer > 0) {
      bot.vx *= 0.88;
      return;
    }

    let target = player && !player.isDead ? player : null;
    let bestScore = target ? Math.hypot(target.x - bot.x, target.y - bot.y) : Infinity;
    for (const ally of friendlyTargets || []) {
      if (!ally || ally.isDead || ally.retreating || ally.isTargetable !== true) continue;
      const distance = Math.hypot(ally.x - bot.x, ally.y - bot.y);
      const score = distance - 45;
      if (distance <= 320 && score < bestScore) {
        target = ally;
        bestScore = score;
      }
    }

    if (!target) {
      bot.vx *= 0.8;
      return;
    }

    const dx = target.x - bot.x;
    const targetY = target.y - (target.height || 60) * 0.5;
    const dy = targetY - (bot.y - bot.height * 0.5);
    const speedScale = bot.freezeTimer > 0 ? 0.45 : 1;
    bot.facing = dx >= 0 ? 1 : -1;
    bot.vx = bot.facing * 120 * speedScale;

    if (Math.abs(dx) < 140 && Math.random() < 0.02 && bot.isGrounded) {
      bot.vy = -320;
      bot.vx = bot.facing * 240 * speedScale;
      bot.isGrounded = false;
    }

    bot.shootTimer -= dt * speedScale;
    if (bot.shootTimer <= 0) {
      bot.shootTimer = 2.2 + Math.random() * 1.5;
      const distance = Math.hypot(dx, dy) || 1;
      if (this.spawnViraDart(bot.x, bot.y - 12, (dx / distance) * 380, (dy / distance) * 380, 14, bot.owner)) {
        audio.createNoiseBurst(0.08, 0.25, 2500);
      }
    }

    const beforeClamp = bot.x;
    bot.x = Math.max(-PROJECTILE_ARENA_BOUND, Math.min(PROJECTILE_ARENA_BOUND, bot.x));
    if (bot.x !== beforeClamp
        && ((bot.x <= -PROJECTILE_ARENA_BOUND && bot.vx < 0)
          || (bot.x >= PROJECTILE_ARENA_BOUND && bot.vx > 0))) {
      bot.vx = 0;
    }
  }

  damageViraBot(bot, amount, knockbackDir = 1, knockbackPower = 300, isCrit = false) {
    if (!bot || bot.isDead) return false;
    bot.hp -= Math.max(0, Number(amount) || 0);
    bot.hurtTimer = 0.22;
    bot.vx = Math.sign(knockbackDir || 1) * Math.min(520, Math.max(0, Number(knockbackPower) || 0));
    bot.vy = -Math.min(180, Math.max(0, Number(knockbackPower) || 0) * 0.3);
    particles.addDamageText(bot.x, bot.y - bot.height, amount, isCrit);
    particles.createHitSparks(bot.x, bot.y - 14, isCrit ? 10 : 6, '#ff3355');
    if (bot.hp <= 0) this.killViraBot(bot);
    return true;
  }

  killViraBot(bot) {
    if (!bot || bot.isDead) return false;
    bot.isDead = true;
    bot.isTargetable = false;
    bot.hp = 0;
    bot.pendingRemoval = true;
    combat.registerKill(bot);
    audio.playZombieDeath();
    particles.createZombieSplatter(bot.x, bot.y - 12, 14, bot.color);
    particles.addShockwave(bot.x, bot.y - 12, 48, '#ff1744', 4);
    return true;
  }

  draw(ctx, crowded = false) {
    for (const h of this.hazards) {
      const progress = 1 - h.duration / h.maxDuration;
      const alpha = (1 - progress * 0.5) * 0.7;
      ctx.save();
      ctx.fillStyle = h.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.radius, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(h.x + Math.sin(this.simTime * 10) * (h.radius * 0.5), h.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const b of this.sketchBlocks) {
      ctx.save();
      ctx.fillStyle = b.type === 'obsidian' ? '#1c1b29' : '#8d6e63';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - b.width / 2, b.y - b.height, b.width, b.height);
      ctx.fillRect(b.x - b.width / 2, b.y - b.height, b.width, b.height);

      ctx.strokeStyle = b.type === 'obsidian' ? '#443366' : '#5d4037';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x - b.width / 2 + 4, b.y - b.height + 4, b.width - 8, b.height - 8);

      if (b.hp < b.maxHp) {
        ctx.fillStyle = '#ff3344';
        ctx.fillRect(b.x - 20, b.y - b.height - 10, 40, 4);
        ctx.fillStyle = '#44ee44';
        ctx.fillRect(b.x - 20, b.y - b.height - 10, 40 * (b.hp / b.maxHp), 4);
      }

      ctx.restore();
    }

    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation !== undefined) ctx.rotate(p.rotation);

      if (p.type === 'acid') {
        ctx.fillStyle = '#44ee44';
        ctx.shadowColor = '#44ee44';
        ctx.shadowBlur = crowded ? 0 : 10;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'anvil') {
        ctx.fillStyle = '#4f545c';
        ctx.strokeStyle = '#202225';
        ctx.lineWidth = 3;
        ctx.fillRect(-24, -10, 48, 10);
        ctx.strokeRect(-24, -10, 48, 10);
        ctx.fillRect(-12, -26, 24, 16);
        ctx.strokeRect(-12, -26, 24, 16);
        ctx.fillRect(-32, -44, 64, 18);
        ctx.strokeRect(-32, -44, 64, 18);
      } else if (p.type === 'pencil_spear') {
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
        ctx.fillStyle = '#ff1133';
        ctx.shadowColor = '#ff0033';
        ctx.shadowBlur = crowded ? 0 : 16;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.quadraticCurveTo(p.radius * 0.2, 0, 0, -p.radius * 0.4);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'king_block') {
        const blockColors = {
          gold: ['#f4c542', '#fff19a', '#9b6500'],
          obsidian: ['#241c35', '#8f62bd', '#0c0714'],
          netherite: ['#4f4852', '#a89ead', '#201d22']
        };
        const palette = blockColors[p.material] || blockColors.gold;
        const size = p.radius * 1.5;
        ctx.shadowColor = palette[1];
        ctx.shadowBlur = crowded ? 0 : 12;
        ctx.fillStyle = palette[0];
        ctx.strokeStyle = palette[2];
        ctx.lineWidth = 3;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = palette[1];
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-size * 0.31, -size * 0.31, size * 0.62, size * 0.62);
      } else if (p.type === 'vira_dart') {
        ctx.fillStyle = '#ff0044';
        ctx.shadowColor = '#ff0022';
        ctx.shadowBlur = crowded ? 0 : 12;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'virabot') {
        ctx.fillStyle = '#1a0005';
        ctx.strokeStyle = p.freezeTimer > 0 ? '#55ddff' : '#ff0033';
        ctx.lineWidth = 2;
        ctx.shadowColor = p.stunTimer > 0 ? '#ffee33' : ctx.strokeStyle;
        ctx.shadowBlur = crowded ? 0 : 8;
        ctx.beginPath();
        ctx.arc(0, -13, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ff1133';
        ctx.beginPath();
        ctx.arc(p.facing * 3, -15, 3, 0, Math.PI * 2);
        ctx.fill();
        const legT = this.simTime * 20;
        ctx.beginPath();
        ctx.moveTo(-6, -9); ctx.lineTo(-14, -1 + Math.sin(legT) * 4);
        ctx.moveTo(6, -9); ctx.lineTo(14, -1 - Math.sin(legT) * 4);
        ctx.moveTo(-5, -6); ctx.lineTo(-11, 4 - Math.sin(legT) * 3);
        ctx.moveTo(5, -6); ctx.lineTo(11, 4 + Math.sin(legT) * 3);
        ctx.stroke();
        if (p.hp < p.maxHp) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#4b0714';
          ctx.fillRect(-15, -34, 30, 4);
          ctx.fillStyle = '#ff3355';
          ctx.fillRect(-15, -34, 30 * Math.max(0, p.hp / p.maxHp), 4);
        }
      } else if (p.type === 'music_note') {
        ctx.fillStyle = '#66ff99';
        ctx.strokeStyle = '#062d1b';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#33ffaa';
        ctx.shadowBlur = crowded ? 0 : 12;
        ctx.font = "bold 30px sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText('♪', 0, 0);
        ctx.fillText('♪', 0, 0);
      } else if (p.type === 'javelin') {
        ctx.shadowColor = '#ffbb00';
        ctx.shadowBlur = crowded ? 0 : 18;
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(-45, -5, 90, 10);
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.moveTo(45, -8);
        ctx.lineTo(68, 0);
        ctx.lineTo(45, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-35, -2, 70, 4);
      } else if (p.type === 'thrown_zombie') {
        ctx.strokeStyle = '#2e7d32';
        ctx.fillStyle = '#2e7d32';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-16, -16); ctx.lineTo(16, 16);
        ctx.moveTo(-16, 16); ctx.lineTo(16, -16);
        ctx.stroke();
      }
      ctx.restore();
    }

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

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = p.beamWidth * 0.35;
        ctx.stroke();
        ctx.restore();
      }
    }
  }


  spawnDarkEnergyWave(x, y, facing, damage = 25, owner = null) {
    audio.playDarkBladeSlash();
    return this.addProjectile({
      type: 'dark_wave',
      owner,
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

  spawnKingBlock(x, y, facing, material = 'gold', damage = 14, owner = 'king_orange') {
    return this.addProjectile({
      type: 'king_block',
      owner,
      material,
      x,
      y,
      vx: facing * (material === 'obsidian' ? 470 : 520),
      vy: 0,
      rotation: 0,
      rotSpeed: facing * (material === 'obsidian' ? 2.6 : 4.2),
      radius: material === 'obsidian' ? 21 : 18,
      damage,
      isHostile: true,
      life: 3
    });
  }

  spawnViraDart(x, y, vx, vy, damage = 18, owner = null) {
    return this.addProjectile({
      type: 'vira_dart',
      owner,
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

  spawnViraBot(x, y, facing = 1, owner = null) {
    if (this.countVirabots() >= MAX_VIRABOTS) return false;
    const bot = {
      type: 'virabot',
      owner,
      x,
      y: y - 20,
      vx: facing * (160 + Math.random() * 80),
      vy: -180,
      gravity: 450,
      facing,
      radius: 14,
      height: 30,
      damage: 15,
      hp: 35,
      maxHp: 35,
      color: '#ff1744',
      inkReward: 14,
      scoreReward: 140,
      shootTimer: 1.5 + Math.random() * 1.5,
      contactCooldown: 0,
      hurtTimer: 0,
      freezeTimer: 0,
      stunTimer: 0,
      hookPullTimer: 0,
      hookPullSource: null,
      hookPullSide: facing >= 0 ? 1 : -1,
      hookPullStopDistance: 70,
      hookClass: 'pullable',
      isGrounded: false,
      isBoss: false,
      isDead: false,
      isTargetable: true,
      isProjectileCombatant: true,
      isHostile: true,
      life: 18.0
    };
    bot.update = () => {};
    bot.draw = () => {};
    bot.takeDamage = (amount, knockbackDir = 1, knockbackPower = 300, isCrit = false) =>
      this.damageViraBot(bot, amount, knockbackDir, knockbackPower, isCrit);
    bot.die = () => this.killViraBot(bot);
    bot.applyFreeze = (duration = 4) => {
      bot.freezeTimer = Math.max(bot.freezeTimer, duration);
    };
    bot.applyStun = (duration = 3) => {
      bot.stunTimer = Math.max(bot.stunTimer, duration);
    };
    bot.applyHookPull = (source, duration = 0.34, stopDistance = 70) => {
      if (bot.isDead || !source) return false;
      bot.hookPullSource = source;
      bot.hookPullSide = source.facing >= 0 ? 1 : -1;
      bot.hookPullStopDistance = Math.max(56, stopDistance);
      bot.hookPullTimer = Math.max(bot.hookPullTimer, duration);
      bot.stunTimer = 0;
      return true;
    };
    const didSpawn = this.addProjectile(bot);
    if (didSpawn) {
      audio.playViraBotSpawn();
      particles.createHitSparks(x, y, 12, '#ff0033');
    }
    return didSpawn;
  }

  spawnDarkDoomLaser(x, y, facing, duration = 1.2, damage = 45, owner = null) {
    audio.playDoomLaserFire();
    return this.addProjectile({
      type: 'doom_laser',
      owner,
      x,
      y,
      facing,
      beamWidth: 32,
      damage,
      duration,
      isHostile: true,
      critical: true,
      hitPlayer: false,
      life: duration
    });
  }

  spawnAcidBlob(x, y, vx, vy) {
    return this.addProjectile({
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
    return this.addProjectile({
      type: 'anvil',
      x,
      y: targetY - 450, // Spawn high above
      vx: 0,
      vy: 120,
      gravity: 1600, // Drops fast and heavy
      radius: 35,
      damage,
      isHostile: false,
      critical: true,
      isLanded: false,
      life: 4.0
    });
  }

  spawnSketchBlock(x, y, type = 'obsidian') {
    audio.playBlockPlace();
    particles.createDust(x, y, 6);
    if (this.sketchBlocks.length >= MAX_SKETCH_BLOCKS) {
      const oldest = this.sketchBlocks.shift();
      if (oldest) particles.createDust(oldest.x, oldest.y, 6);
    }
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
    return this.addProjectile({
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

  spawnMusicNoteWave(x, y, facing, effectRadius = 480, effectOriginY = y + 30) {
    let spawned = false;
    for (let i = -2; i <= 2; i++) {
      spawned = this.addProjectile({
        type: 'music_note',
        x,
        y: y + i * 20,
        vx: facing * (450 + Math.random() * 100),
        vy: i * 60,
        radius: 20,
        damage: 25,
        effectOriginX: x,
        effectOriginY,
        effectRadius,
        sparkColor: '#33ffaa',
        pierce: 2,
        isHostile: false,
        life: 1.2
      }) || spawned;
    }
    return spawned;
  }

  spawnJavelin(x, y, facing, damage = 85) {
    audio.playSlash();
    audio.playBassDrop();
    particles.triggerSpeedlines({ x, y, duration: 0.2, count: 18, seed: ((x * 29) ^ (y * 17)) | 0 });
    particles.addComicPopup(x + facing * 80, y, 'KRAK!', '#ff5500', '#ffffff');
    return this.addProjectile({
      type: 'javelin',
      x,
      y,
      vx: facing * 1350,
      vy: 0,
      rotation: facing > 0 ? 0 : Math.PI,
      radius: 24,
      damage,
      pierce: 99, // Pierces all enemies
      isHostile: false,
      critical: true,
      isCrit: true,
      sparkColor: '#ffaa00',
      knockback: 750,
      life: 1.4
    });
  }

  spawnThrownZombie(x, y, facing, damage = 110) {
    audio.playGrabThrow();
    audio.playBassDrop();
    particles.triggerSpeedlines({ x, y, duration: 0.25, count: 18, seed: ((x * 31) ^ (y * 19)) | 0 });
    particles.addComicPopup(x + facing * 60, y - 20, 'STRIKE!!', '#ff0055', '#ffff00');
    return this.addProjectile({
      type: 'thrown_zombie',
      x,
      y,
      vx: facing * 920,
      vy: -140,
      gravity: 550,
      rotSpeed: facing * 18,
      rotation: 0,
      radius: 28,
      damage,
      pierce: 10,
      isHostile: false,
      critical: true,
      isCrit: true,
      sparkColor: '#44ee55',
      knockback: 850,
      life: 2.0
    });
  }
}

export const projectiles = new ProjectileManager();
