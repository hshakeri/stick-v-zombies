import { StickFigureRenderer } from './stickman.js?v=9.6';
import { particles } from '../engine/particles.js?v=9.6';
import { audio } from '../engine/audio.js?v=9.6';
import { projectiles } from './projectiles.js?v=9.6';
import { combat } from '../systems/combat.js?v=9.6';
import { speech } from '../engine/speech.js?v=9.6';
const HOOK_PULL_ARENA_BOUND = 1060;
const ZOMBIE_ARENA_BOUND = 1060;
const ZOMBIE_STATS = Object.freeze({
	walker: [45, 110, 12, 18, 58, '#2e7d32', 5, 1, 10, 100, 'pullable'],
	runner: [32, 210, 10, 16, 40, '#388e3c', 4, .85, 8, 75, 'immune'],
	spitter: [45, 95, 15, 18, 55, '#00796b', 5, 1, 12, 100, 'pullable'],
	crawler: [24, 185, 8, 14, 31, '#5f8f2f', 4, .62, 6, 60, 'pullable'],
	shieldbearer: [110, 76, 15, 25, 68, '#315f3a', 7, 1.16, 20, 220, 'pullable', '', 1],
	stalker: [60, 235, 16, 16, 42, '#b620e0', 4, .9, 16, 180, 'immune', 'runner'],
	warden: [260, 70, 24, 30, 84, '#3d6b52', 8, 1.5, 40, 420, 'anchor', 'brute', 1],
	boom_bug: [52, 105, 18, 22, 45, '#75661f', 6, .88, 14, 140, 'pullable'],
	brute: [160, 80, 24, 32, 80, '#1b5e20', 8, 1.45, 30, 300, 'anchor'],
	titan_boss: [750, 90, 32, 50, 120, '#0a2e0e', 12, 2.2, 120, 2000, 'anchor', '', 0, 1],
	creeper_lord: [440, 92, 30, 58, 152, '#91c94d', 10, 2.3, 150, 2600, 'anchor', '', 0, 1],
	giant_cat: [480, 116, 32, 72, 128, '#e88932', 10, 2.4, 180, 3000, 'anchor', '', 0, 1]
});
const box=(c,x,y,w,h)=>{c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);};
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
	this.windupTimer = 0;
	this.windupTarget = null;
	this.attackCooldown = 0;
	this.stateTimer = 0;
	this.actionPhase = 'idle';
	this.actionKind = null;
	this.actionTimer = 0;
	this.actionDuration = 0;
	this.actionHitApplied = false;
	this.bossMoveIndex = 0;
	this.actionHitTargets = null;
	this.freezeTimer = 0;
	this.stunTimer = 0;
	this.isGrounded = false;
	this.hookPullTimer = 0;
	this.hookPullSource = null;
	this.hookPullSide = 1;
	this.hookPullStopDistance = 76;
	this.leapActive = false;
	this.crawlerDashTimer = 0;
	this.shieldFlashTimer = 0;
	this.glitchHopCooldown = 0.35 + Math.random() * 0.5;
	this.gaitScale = 0.92 + Math.random() * 0.16;
	this.squashX = 1.0;
	this.squashY = 1.0;
	this.combatTargets = [];
	this.arenaGroundY = Number.isFinite(y) ? Math.max(0, y) : 0;
	this.sketchBlocks = [];
	this.platforms = [];
	this.initStats(type, wave);
	this.renderer = new StickFigureRenderer(this.color, this.strokeWidth, this.scale);
	this.renderer.isHunched = true;
	this.renderer.isZombie = true;
  }
  initStats(type, wave) {
	const waveScale = 1 + (wave - 1) * 0.12;
	const damageScale = Math.min(1.6, 1 + (wave - 1) * 0.045);
	const speedScale = Math.min(1.18, 1 + (wave - 1) * 0.015);
	const stats = ZOMBIE_STATS[type] || ZOMBIE_STATS.walker;
	[this.maxHp, this.speed, this.damage, this.radius, this.height, this.color,
	  this.strokeWidth, this.scale, this.inkReward, this.scoreReward, this.hookClass] = stats;
	this.maxHp = Math.round(this.maxHp * waveScale);
	this.hp = this.maxHp;
	this.behavior = stats[11] || type;
	this.hasShield = stats[12] === 1;
	this.isBoss = stats[13] === 1;
	if (this.isBoss) this.bossPhase = 1;
	if (type === 'creeper_lord' || type === 'giant_cat') {
	  this.attackCooldown = 1.1;
	  this.speechOffsetY = type === 'creeper_lord' ? -235 : -205;
	  this.bannerOffsetY = type === 'creeper_lord' ? -260 : -225;
	}
	if (type === 'spitter') this.preferredDist = 280;
	if (!this.isBoss) {
	  this.damage = Math.round(this.damage * damageScale);
	  this.speed = Math.round(this.speed * speedScale);
	}
  }
  update(dt, groundY, player, sketchBlocks, camera, platforms = [], zombies = [], friendlyTargets = []) {
	if (this.isDead) return;
	if (this.isBoss) this.camera = camera || this.camera;
	this.platforms = platforms;
	this.sketchBlocks = sketchBlocks;
	if (Number.isFinite(groundY)) this.arenaGroundY = groundY;
	this.animTimer += dt;
	this.stateTimer += dt;
	this.squashX += (1.0 - this.squashX) * Math.min(1, 14.0 * dt);
	this.squashY += (1.0 - this.squashY) * Math.min(1, 14.0 * dt);
	if (this.attackCooldown > 0) {
	  this.attackCooldown -= dt;
	}
	if (this.shieldFlashTimer > 0) this.shieldFlashTimer -= dt;
	if (this.freezeTimer > 0) this.freezeTimer -= dt;
	if (this.glitchHopCooldown > 0) this.glitchHopCooldown -= dt;
	if (this.hookPullTimer > 0) {
	  this.updateHookPull(dt, groundY, sketchBlocks);
	  return;
	}
	if (this.hurtTimer > 0) {
	  this.hurtTimer -= dt;
	  if (this.hurtTimer <= 0) this.isHurt = false;
	  if (!this.isBoss) {
		this.pose = 'idle';
		this.vx *= 0.88;
		this.applyPhysics(dt, groundY, sketchBlocks);
		return;
	  }
	}
	if (this.stunTimer > 0) {
	  this.stunTimer -= dt;
	  this.pose = 'idle';
	  this.vx = 0;
	  this.applyPhysics(dt, groundY, sketchBlocks);
	  return;
	}
	const currentSpeed = this.speed * this.gaitScale * (this.freezeTimer > 0 ? 0.45 : 1.0);
	const combatTargets = this.getCombatTargets(player, friendlyTargets);
	const target = this.isBoss
	  ? (this.isValidCombatTarget(player) ? player : null)
	  : this.selectCombatTarget(player, friendlyTargets);
	if (this.actionPhase !== 'idle') {
	  this.updateHeavyAction(dt, combatTargets, camera);
	  this.applyPhysics(dt, groundY, sketchBlocks);
	  return;
	}
	if (this.behavior === 'crawler' && this.crawlerDashTimer > 0) {
	  this.crawlerDashTimer = Math.max(0, this.crawlerDashTimer - dt);
	  this.pose = 'attack_slide';
	  this.vx = this.facing * this.speed * 2.65;
	  let dashTarget = null;
	  let nearestDashTarget = 39;
	  for (const candidate of combatTargets) {
		if (!this.isValidCombatTarget(candidate)) continue;
		const contactDistance = Math.hypot(candidate.x - this.x, candidate.y - this.y);
		if (contactDistance < nearestDashTarget) {
		  dashTarget = candidate;
		  nearestDashTarget = contactDistance;
		}
	  }
	  if (dashTarget) {
		this.crawlerDashTimer = 0;
		this.vx *= 0.25;
		audio.playZombieGroan();
		dashTarget.takeDamage(this.damage, dashTarget.x >= this.x ? 1 : -1, 230);
	  }
	  this.applyPhysics(dt, groundY, sketchBlocks);
	  return;
	}
	if (target && this.tryGlitchHop(target, currentSpeed)) {
	  this.applyPhysics(dt, groundY, sketchBlocks);
	  return;
	}
	if (this.behavior === 'runner' && this.leapActive) {
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
	  if (this.behavior === 'walker') {
		if (dist > 45) {
		  this.vx = this.facing * currentSpeed;
		  this.pose = 'zombie_walk';
		} else {
		  this.vx = 0;
		  if (this.attackCooldown <= 0) {
			this.windupTimer = 0.28;
			this.windupTarget = target;
			this.pose = 'attack_jab';
		  } else {
			this.pose = 'zombie_idle';
		  }
		}
	  } else if (this.behavior === 'crawler') {
		if (dist > 175) {
		  const scuttle = 0.88 + Math.sin(this.animTimer * 17) * 0.12;
		  this.vx = this.facing * currentSpeed * scuttle;
		  this.pose = 'run';
		} else if (dist > 48 && this.isGrounded && this.attackCooldown <= 0) {
		  this.crawlerDashTimer = 0.22;
		  this.attackCooldown = 1.35;
		  this.vx = this.facing * currentSpeed * 2.65;
		  this.pose = 'attack_slide';
		  audio.playRunnerScreech();
		  particles.createDust(this.x, this.y, 3, -this.facing);
		} else if (dist > 48) {
		  this.vx = this.facing * currentSpeed;
		  this.pose = 'run';
		} else {
		  this.vx = 0;
		  if (this.attackCooldown <= 0) {
			this.windupTimer = 0.18;
			this.windupTarget = target;
			this.pose = 'attack_jab';
		  } else {
			this.pose = 'zombie_idle';
		  }
		}
	  } else if (this.behavior === 'runner') {
		if (dist > 180) {
		  this.vx = this.facing * currentSpeed;
		  this.pose = 'run';
		} else if (dist > 50 && this.isGrounded && this.attackCooldown <= 0) {
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
	  } else if (this.behavior === 'spitter') {
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
	  } else if (this.behavior === 'brute') {
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
	  } else if (this.behavior === 'shieldbearer') {
		if (dist > 53) {
		  this.vx = this.facing * currentSpeed;
		  this.pose = 'zombie_walk';
		} else {
		  this.vx = 0;
		  if (this.attackCooldown <= 0) {
			this.windupTimer = 0.34;
			this.windupTarget = target;
			this.pose = 'attack_jab';
		  } else {
			this.pose = 'zombie_idle';
		  }
		}
	  } else if (this.behavior === 'boom_bug') {
		if (dist > 128) {
		  this.vx = this.facing * currentSpeed;
		  this.pose = 'zombie_walk';
		} else {
		  this.vx = 0;
		  if (this.attackCooldown <= 0) this.beginHeavyAction('boom_burst');
		  else this.pose = 'zombie_idle';
		}
	  } else if (this.behavior === 'titan_boss') {
		this.updateBossAI(dt, dist, target, camera, combatTargets);
	  } else if (this.behavior === 'creeper_lord' || this.behavior === 'giant_cat') {
		this.updateClanBossAI(dist, target, camera, combatTargets);
	  }
	  if (zombies && Array.isArray(zombies)) {
		for (const other of zombies) {
		  if (other !== this && !other.isDead && !other.isBoss) {
			const sepDx = this.x - other.x;
			const sepDist = Math.abs(sepDx);
			const minDist = (this.radius + other.radius) + 14;
			if (sepDist < minDist && Math.abs(this.y - other.y) < 35) {
			  const pushForce = (minDist - sepDist) * 9.0;
			  this.vx += (sepDx >= 0 ? 1 : (sepDx < 0 ? -1 : (this.animTimer > other.animTimer ? 1 : -1))) * pushForce;
			}
		  }
		}
	  }
	} else {
	  this.vx = 0;
	  this.pose = 'idle';
	}
	this.applyPhysics(dt, groundY, sketchBlocks);
  }
  updateBossAI(dt, dist, target, camera, combatTargets = [target]) {
	const currentSpeed = this.speed * (this.freezeTimer > 0 ? 0.45 : 1.0);
	if (this.hp < this.maxHp * 0.5 && this.bossPhase === 1) {
	  this.bossPhase = 2;
	  this.speed *= 1.3;
	  audio.playBossRoar();
	  particles.addTextBanner(this.x, this.y - 120, 'TITAN ENRAGED!', '#ff1133');
	  camera?.addShake?.(0.7);
	  speech.shoutBoss(this.x, this.y, 'titan', 'phase', 1.55, {
		anchor: this, speakerKey: 'titan', repeatKey: 'titan:phase', cooldownMs: 0
	  });
	}
	if (dist > 120) {
	  if (dist > 300 && this.attackCooldown <= 0 && this.isGrounded && target) {
		this.beginHeavyAction('titan_leap', target.x);
		return;
	  }
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
  updateClanBossAI(dist, target, camera, combatTargets = [target]) {
	const cat = this.type === 'giant_cat';
	const speechKey = cat ? 'giantCat' : 'creeperLord';
	if (this.hp < this.maxHp * .5 && this.bossPhase === 1) {
	  this.bossPhase = 2;
	  this.speed *= 1.18;
	  this.attackCooldown = Math.min(this.attackCooldown, .3);
	  audio.playBossRoar();
	  particles.addTextBanner(this.x, this.y + this.bannerOffsetY,
		cat ? 'CHONK MODE: ON!' : 'CLAN POWER: DOUBLE!', cat ? '#ff9b3d' : '#d7ff5f');
	  camera?.focusOn?.(this.x, this.y - this.height * .55, .48, 1.04);
	  camera?.addShake?.(.38);
	  speech.shoutBoss(this.x, this.y, speechKey, 'phase', 1.45, {
		anchor: this, speakerKey: speechKey, repeatKey: `${speechKey}:phase`, cooldownMs: 0
	  });
	}
	if (!target) return;
	if (this.attackCooldown <= 0) {
	  const alternate = this.bossMoveIndex++ % 2 === 0;
	  const move = cat
		? (dist > 150 || alternate ? 'cat_pounce' : 'cat_swipe')
		: (dist > 250 || alternate ? 'creeper_leap' : 'creeper_blast');
	  this.beginHeavyAction(move, target.x);
	  return;
	}
	const stopDistance = cat ? 115 : 165;
	if (dist > stopDistance) {
	  this.vx = this.facing * this.speed * (this.freezeTimer > 0 ? .45 : 1);
	  this.pose = cat ? 'run' : 'zombie_walk';
	} else {
	  this.vx = 0;
	  this.pose = 'zombie_idle';
	}
  }
  beginHeavyAction(kind, targetX = null) {
	if (this.actionPhase !== 'idle') return false;
	const isTitan = kind === 'titan_smash';
	const isLeap = kind === 'titan_leap' || kind === 'creeper_leap';
	const isBoomBug = kind === 'boom_burst';
	const clanMove = kind === 'creeper_blast' || kind === 'creeper_leap'
	  || kind === 'cat_swipe' || kind === 'cat_pounce';
	this.actionKind = clanMove ? kind : (isTitan ? 'titan_smash' : (isLeap ? 'titan_leap' : (isBoomBug ? 'boom_burst' : 'brute_slam')));
	this.actionPhase = 'windup';
	this.actionDuration = isTitan ? .75 : (kind === 'creeper_blast' ? .78
	  : (kind === 'creeper_leap' || kind === 'cat_pounce' ? .68
	  : (kind === 'cat_swipe' ? .58 : (isLeap ? .6 : (isBoomBug ? .7 : .55)))));
	this.actionTimer = this.actionDuration;
	this.actionHitApplied = false;
	this.actionHitTargets = clanMove ? new WeakSet() : null;
	if (isLeap || kind === 'cat_pounce') {
	  let endX = Number.isFinite(targetX) ? targetX : this.x;
	  if (kind === 'cat_pounce') {
		const dx = endX - this.x;
		endX = this.x + Math.sign(dx || this.facing) * Math.min(Math.abs(dx), (this.bossPhase === 2 ? 1120 : 960) * .34);
	  }
	  this.leapTargetX = Math.max(-ZOMBIE_ARENA_BOUND, Math.min(ZOMBIE_ARENA_BOUND, endX));
	}
	this.vx = 0;
	this.pose = 'attack_cross';
	this.squashX = 0.92;
	this.squashY = 1.08;
	audio.playWhoosh();
	return true;
  }
  updateHeavyAction(dt, combatTargets, camera) {
	if (this.actionPhase === 'idle') return false;
	const actionDt = dt * (this.freezeTimer > 0 ? 0.45 : 1);
	if (this.actionPhase !== 'leap' && this.actionPhase !== 'dash') this.vx = 0;
	if (this.actionPhase === 'windup') {
	  this.pose = 'attack_cross';
	  this.actionTimer = Math.max(0, this.actionTimer - actionDt);
	  if (this.actionTimer <= 0) {
		if (this.actionKind === 'titan_leap' || this.actionKind === 'creeper_leap') {
		  this.actionPhase = 'leap';
		  this.actionDuration = 2.0;
		  this.actionTimer = this.actionDuration;
		  const gravity = 950;
		  const launchVy = this.actionKind === 'creeper_leap' ? -560 : -620;
		  const airTime = (2 * Math.abs(launchVy)) / gravity;
		  this.vy = launchVy;
		  this.vx = (this.leapTargetX - this.x) / Math.max(0.35, airTime);
		  this.isGrounded = false;
		  this.pose = 'jump_rise';
		  audio.playBossRoar();
		  return true;
		}
		if (this.actionKind === 'cat_pounce') {
		  this.actionPhase = 'dash';
		  this.facing = this.leapTargetX >= this.x ? 1 : -1;
		  this.actionDuration = Math.max(.08, Math.abs(this.leapTargetX - this.x) / (this.bossPhase === 2 ? 1120 : 960));
		  this.actionTimer = this.actionDuration;
		  this.vx = 0;
		  this.pose = 'run';
		  audio.playWhoosh();
		  speech.shoutBoss(this.x, this.y, 'giantCat', 'pounce', 1.1, {
			anchor: this, speakerKey: 'giantCat', repeatKey: 'giantCat:pounce'
		  });
		  return true;
		}
		this.actionPhase = 'active';
		this.actionDuration = 0.1;
		this.actionTimer = this.actionDuration;
		if (!this.actionHitApplied) {
		  this.actionHitApplied = true;
		  if (this.actionKind === 'titan_smash') this.titanSmash(combatTargets, camera);
		  else if (this.actionKind === 'boom_burst') this.boomBurst(combatTargets, camera);
		  else if (this.actionKind === 'creeper_blast') this.creeperBlast(combatTargets, camera, 225);
		  else if (this.actionKind === 'cat_swipe') this.catSwipe(combatTargets, camera);
		  else this.bruteSlam(combatTargets, camera);
		}
	  }
	  return true;
	}
	if (this.actionPhase === 'leap') {
	  this.pose = this.vy < 0 ? 'jump_rise' : 'jump_fall';
	  this.actionTimer = Math.max(0, this.actionTimer - actionDt);
	  const shouldLand = (this.isGrounded && this.actionTimer < this.actionDuration - 0.1) || this.actionTimer <= 0;
	  if (shouldLand) {
		if (!this.actionHitApplied) {
		  this.actionHitApplied = true;
		  if (this.actionKind === 'creeper_leap') this.creeperBlast(combatTargets, camera, 175);
		  else this.titanLand(combatTargets, camera);
		}
		this.vx = 0;
		this.actionPhase = 'recovery';
		this.actionDuration = 0.5;
		this.actionTimer = this.actionDuration;
	  }
	  return true;
	}
	if (this.actionPhase === 'dash') {
	  this.pose = 'run';
	  const speed = (this.bossPhase === 2 ? 1120 : 960) * (this.freezeTimer > 0 ? .45 : 1);
	  const fromX = this.x;
	  const remaining = Math.max(0, (this.leapTargetX - fromX) * this.facing);
	  const travel = Math.min(remaining, speed * dt);
	  const toX = fromX + this.facing * travel;
	  this.vx = (toX - fromX) / Math.max(dt, .0001);
	  for (const target of combatTargets || []) {
		if (!this.isValidCombatTarget(target) || this.actionHitTargets?.has(target)) continue;
		if (target.isGrounded === false) {
		  this.actionHitTargets?.add(target);
		  continue;
		}
		const sweptX = Math.max(Math.min(fromX, toX), Math.min(Math.max(fromX, toX), target.x));
		if (Math.abs(target.x - sweptX) <= this.radius + (target.radius || 18)
			&& Math.abs(target.y - this.y) < 105) {
		  this.actionHitTargets?.add(target);
		  target.takeDamage(this.damage, this.facing, 680);
		  particles.emitImpact?.('heavy', target.x, target.y - 42, {
			color: '#ff9b3d', direction: this.facing, seed: ((target.x * 31) ^ 0xca7) | 0
		  });
		}
	  }
	  this.actionTimer = Math.max(0, this.actionTimer - actionDt);
	  if (this.actionTimer <= 0 || travel >= remaining) {
		this.actionPhase = 'recovery';
		this.actionDuration = .42;
		this.actionTimer = this.actionDuration;
	  }
	  return true;
	}
	if (this.actionPhase === 'active') {
	  this.pose = 'attack_cross';
	  this.actionTimer = Math.max(0, this.actionTimer - actionDt);
	  if (this.actionTimer <= 0) {
		this.actionPhase = 'recovery';
		this.actionDuration = this.actionKind === 'titan_smash' ? 0.65
		  : (this.actionKind === 'boom_burst' ? 0.3 : 0.45);
		this.actionTimer = this.actionDuration;
	  }
	  return true;
	}
	this.pose = 'zombie_idle';
	this.actionTimer = Math.max(0, this.actionTimer - actionDt);
	if (this.actionTimer <= 0) {
	  const recoveryCooldown = this.actionKind === 'titan_smash' ? 1.1
		: (this.actionKind === 'titan_leap' ? 1.5 : (this.actionKind === 'boom_burst' ? 1.8
		: (this.isBoss ? (this.bossPhase === 2 ? .82 : 1.12) : 1.4)));
	  this.actionPhase = 'idle';
	  this.actionKind = null;
	  this.actionDuration = 0;
	  this.actionHitApplied = false;
	  this.actionHitTargets = null;
	  this.attackCooldown = Math.max(this.attackCooldown, recoveryCooldown);
	}
	return true;
  }
  titanLand(targets, camera) {
	audio.playBruteStomp();
	camera?.addShake?.(0.6);
	particles.addShockwave(this.x, this.y, 200, '#ff8830', 13);
	particles.createDust(this.x, this.y, 10);
	for (const target of targets || []) {
	  if (!this.isValidCombatTarget(target)) continue;
	  const dist = Math.hypot(target.x - this.x, target.y - this.y);
	  if (dist < 180) target.takeDamage(26, target.x >= this.x ? 1 : -1, 620);
	}
  }
  cancelHeavyAction(cooldown = 0.65) {
	if (this.actionPhase === 'idle') return false;
	this.actionPhase = 'idle';
	this.actionKind = null;
	this.actionTimer = 0;
	this.actionDuration = 0;
	this.actionHitApplied = false;
	this.actionHitTargets = null;
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
	this.vy = this.behavior === 'brute' ? -500 : -540;
	this.vx = this.facing * Math.max(125, currentSpeed * (this.behavior === 'runner' ? 1.05 : 0.9));
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
	this.vy += 950 * dt;
	if (this.hurtTimer > 0) {
	  this.vx *= Math.pow(0.88, dt * 60);
	}
	const previousY = this.y;
	const impactVy = this.vy;
	const wasAirborne = !this.isGrounded;
	this.x += this.vx * dt;
	this.y += this.vy * dt;
	if (this.x <= -ZOMBIE_ARENA_BOUND) {
	  this.x = -ZOMBIE_ARENA_BOUND;
	  if (this.vx < 0) this.vx = 0;
	} else if (this.x >= ZOMBIE_ARENA_BOUND) {
	  this.x = ZOMBIE_ARENA_BOUND;
	  if (this.vx > 0) this.vx = 0;
	}
	let landedOnPlatform = false;
	if (this.vy >= 0) {
	  landedOnPlatform = this.landOnPlatformCollection(sketchBlocks, previousY)
		|| this.landOnPlatformCollection(this.platforms, previousY);
	}
	if (!landedOnPlatform && this.y >= groundY) {
	  this.y = groundY;
	  this.vy = 0;
	  this.isGrounded = true;
	} else if (!landedOnPlatform) {
	  this.isGrounded = false;
	}
	if (wasAirborne && this.isGrounded && impactVy > 320) {
	  this.squashX = Math.min(1.3, 1 + impactVy / 2400);
	  this.squashY = Math.max(0.74, 1 - impactVy / 2800);
	}
  }
  getSplatterGroundY() {
	let surfaceY = Number.isFinite(this.arenaGroundY) ? this.arenaGroundY : this.y;
	for (const collection of [this.sketchBlocks, this.platforms]) {
	  if (!Array.isArray(collection)) continue;
	  for (const platform of collection) {
		const halfW = (platform.width || 60) / 2;
		const top = platform.y - (platform.height || 60);
		if (this.x + this.radius > platform.x - halfW
			&& this.x - this.radius < platform.x + halfW
			&& top >= this.y - 5 && top < surfaceY) surfaceY = top;
	  }
	}
	return surfaceY;
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
  creeperBlast(targets, camera, radius) {
	audio.playBruteStomp();
	camera?.addShake?.(.55);
	particles.addShockwave(this.x, this.y - 8, radius, '#b8ff54', 13);
	particles.emitImpact?.('heavy', this.x, this.y - 55, {
	  color: '#dfff70', direction: this.facing, seed: ((this.x * 41) ^ 0xc133) | 0
	});
	for (const target of targets || []) {
	  if (!this.isValidCombatTarget(target)) continue;
	  if (Math.hypot(target.x - this.x, target.y - this.y) < radius) {
		target.takeDamage(this.damage, target.x >= this.x ? 1 : -1, 620);
	  }
	}
	speech.shoutBoss(this.x, this.y, 'creeperLord', 'blast', 1.15, {
	  anchor: this, speakerKey: 'creeperLord', repeatKey: 'creeperLord:blast'
	});
  }
  catSwipe(targets, camera) {
	audio.playWhoosh();
	camera?.addShake?.(.25);
	particles.addSlashArc(this.x + this.facing * 72, this.y - 52, 105, 0, this.facing, '#ffd2a1', 9);
	for (const target of targets || []) {
	  if (!this.isValidCombatTarget(target)) continue;
	  const dx = (target.x - this.x) * this.facing;
	  if (dx > -25 && dx < 185 && Math.abs(target.y - this.y) < 120) {
		target.takeDamage(this.damage, this.facing, 560);
	  }
	}
	speech.shoutBoss(this.x, this.y, 'giantCat', 'pounce', 1.1, {
	  anchor: this, speakerKey: 'giantCat', repeatKey: 'giantCat:swipe'
	});
  }
  boomBurst(targets, camera) {
	audio.playWindowsError();
	audio.playBruteStomp();
	camera?.addShake?.(0.24);
	particles.emitImpact?.('heavy', this.x, this.y - 22, {
	  color: '#ff9f1c',
	  direction: this.facing,
	  seed: ((this.x * 29) ^ (this.y * 13) ^ 0xb00) | 0,
	  speedlines: false
	});
	particles.addComicPopup(this.x, this.y - 28, 'BOOM!', '#ff6d00', '#fff4b0');
	particles.emitSplatter(this.x, this.y - 24, {
	  profile: 'defeat', groundY: this.getSplatterGroundY(), direction: this.facing, stains: 2,
	  seed: ((this.x * 43) ^ (this.animTimer * 1000) ^ 0xb00b) | 0
	});
	for (const target of targets || []) {
	  if (!this.isValidCombatTarget(target)) continue;
	  const dist = Math.hypot(target.x - this.x, target.y - this.y);
	  if (dist < 125) target.takeDamage(this.damage, target.x >= this.x ? 1 : -1, 410);
	}
	this.hp = 0;
	this.isDead = true;
	combat.registerKill(this);
	this.actionPhase = 'idle';
	this.actionKind = null;
	particles.createStickLimbExplosion(this.x, this.y, 0, this.color);
  }
  takeDamage(amount, knockbackDir = 1, knockbackPower = 380, isCrit = false) {
	if (this.isDead) return 0;
	if (this.hasShield) {
	  const direction = Math.sign(knockbackDir) || 1;
	  const hitShieldFront = direction === -this.facing;
	  const isHeavyHit = amount >= 60 || knockbackPower >= 700;
	  if (hitShieldFront && !isHeavyHit) {
		const lightHit = amount <= 40 && knockbackPower < 600;
		amount = Math.max(1, Math.round(amount * (lightHit ? 0.22 : 0.52)));
		knockbackPower *= lightHit ? 0.18 : 0.38;
		this.shieldFlashTimer = 0.18;
		particles.emitImpact?.('light', this.x + this.facing * 22, this.y - 35, {
		  color: '#9ee7ff',
		  direction: -this.facing,
		  seed: ((this.x * 19) ^ (this.animTimer * 100)) | 0
		});
	  }
	}
	amount = Math.min(this.hp, Math.max(0, amount));
	this.hp -= amount;
	this.isHurt = true;
	this.hurtTimer = this.isBoss ? .1 : .32;
	if (!this.isBoss) {
	  this.windupTimer = 0;
	  this.windupTarget = null;
	  this.cancelHeavyAction(.65);
	  this.leapActive = false;
	  this.crawlerDashTimer = 0;
	  this.attackCooldown = Math.max(this.attackCooldown, .5);
	}
	if (this.type === 'stalker' && this.hp > 0 && this.stunTimer <= 0 && this.freezeTimer <= 0
		&& (Math.abs((this.animTimer * 997) | 0) % 10) < 4) {
	  const blinkX = this.x - knockbackDir * 200;
	  particles.createHitSparks(this.x, this.y - 20, 6, '#e07bff');
	  this.x = Math.max(-ZOMBIE_ARENA_BOUND, Math.min(ZOMBIE_ARENA_BOUND, blinkX));
	  this.facing = knockbackDir >= 0 ? 1 : -1;
	  this.vx = 0;
	  this.vy = 0;
	  this.hurtTimer = 0.12;
	  particles.createHitSparks(this.x, this.y - 20, 8, '#e07bff');
	  particles.createDust(this.x, this.y, 4, this.facing);
	} else if (this.isBoss) {
	  this.vx += knockbackDir * Math.min(55, knockbackPower * .08);
	} else {
	  this.vx = knockbackDir * knockbackPower;
	  this.vy = -Math.min(knockbackPower * 0.35, 220);
	}
	particles.addDamageText(this.x, this.y - this.height * 0.8, amount, isCrit);
	particles.createZombieSplatter(this.x, this.y - this.height * 0.5, 8, this.color);
	particles.emitSplatter(this.x, this.y - this.height * 0.45, {
	  profile: 'hit',
	  groundY: this.getSplatterGroundY(),
	  direction: knockbackDir,
	  count: isCrit ? 11 : Math.max(4, Math.min(8, Math.ceil(amount / 6))),
	  seed: ((this.x * 31) ^ (this.animTimer * 1000)) | 0
	});
	if (this.hp <= 0) {
	  this.die();
	}
	return amount;
  }
  applyFreeze(duration = 4.0) {
	const applied = this.isBoss ? Math.min(1.6, Math.max(0, duration) * 0.4) : duration;
	this.freezeTimer = Math.max(this.freezeTimer, applied);
  }
  applyStun(duration = 3.0) {
	const applied = this.isBoss ? Math.min(1.2, Math.max(0, duration) * 0.3) : duration;
	this.stunTimer = Math.max(this.stunTimer, applied);
	this.windupTimer = 0;
	this.windupTarget = null;
	this.cancelHeavyAction(0.65);
	this.leapActive = false;
	this.crawlerDashTimer = 0;
  }
  die(isFinisher = false) {
	if (this.isDead) return;
	this.isDead = true;
	this.hp = 0;
	combat.registerKill(this);
	const bossKey = this.type === 'titan_boss' ? 'titan'
	  : (this.type === 'creeper_lord' ? 'creeperLord' : (this.type === 'giant_cat' ? 'giantCat' : null));
	if (bossKey) {
	  speech.shoutBoss(this.x, this.y, bossKey, 'defeat', 1.8, {
		anchor: this, speakerKey: bossKey, repeatKey: `${bossKey}:defeat`, cooldownMs: 0
	  });
	}
	if (this.isBoss) audio.playFinisherImpact();
	else audio.playZombieDeath();
	particles.createZombieSplatter(this.x, this.y - this.height * 0.5, 24, this.color);
	particles.emitSplatter(this.x, this.y - this.height * 0.45, {
	  profile: 'defeat',
	  groundY: this.getSplatterGroundY(),
	  direction: this.vx,
	  seed: ((this.x * 47) ^ (this.animTimer * 1000) ^ 0xdead) | 0
	});
	if (this.isBoss) {
	  this.camera?.addShake?.(0.78);
	  this.camera?.addZoomPunch?.(0.075);
	  const clanLord = this.type === 'creeper_lord';
	  const cat = this.type === 'giant_cat';
	  particles.emitBossExplosion({
		x: this.x, y: this.y - 54, bodyY: this.y, groundY: this.getSplatterGroundY(),
		color: cat ? '#e88932' : (clanLord ? '#a9e45d' : '#39ff62'),
		accent: cat ? '#fff2d5' : '#fff3a0', radius: cat ? 300 : 270,
		stickFigure: !cat && !clanLord,
		seed: ((this.x * 47) ^ (cat ? 0xca7 : (clanLord ? 0xc133 : 0x717a))) | 0
	  });
	} else {
	  particles.addShockwave(this.x, this.y - 20, 60, this.color, 4);
	  particles.createStickLimbExplosion(this.x, this.y, 0, this.color);
	}
	if (!this.isBoss && Math.random() < 0.38) {
	  speech.shout(this.x, this.y - 10, 'zombieGroan', null, 1.35, {
		anchor: this,
		anchorOffsetY: -54
	  });
	}
  }
  draw(ctx, crowded = false) {
	if (this.isDead) return;
	const isFrozen = this.freezeTimer > 0;
	const isStunned = this.stunTimer > 0;
	this.drawHeavyTelegraph(ctx);
	const suppressOrdinaryGlow = crowded === true && !this.isBoss && this.actionPhase === 'idle';
	if (this.type === 'creeper_lord' || this.type === 'giant_cat') {
	  this.drawClanBoss(ctx, isFrozen);
	} else this.renderer.draw(ctx, {
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
	  squashX: this.squashX,
	  squashY: this.squashY,
	  actionPhase: this.getActionRenderPhase(),
	  combatActionPhase: this.actionPhase,
	  suppressGlow: suppressOrdinaryGlow
	});
	if (this.type !== 'creeper_lord' && this.type !== 'giant_cat') {
	  this.drawTypeSilhouette(ctx, suppressOrdinaryGlow);
	}
	if (isStunned) {
	  ctx.fillStyle = '#ffea00';
	  const angle = this.animTimer * 6;
	  ctx.beginPath();
	  ctx.arc(this.x + Math.cos(angle) * 16, this.y - this.height - 12 + Math.sin(angle) * 6, 4, 0, Math.PI * 2);
	  ctx.fill();
	}
	if (!this.isBoss && this.hp < this.maxHp && this.hp > 0) {
	  const barWidth = Math.max(44, 40 * this.scale);
	  const barHeight = 5;
	  const barY = this.y - this.height - 14;
	  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
	  ctx.fillRect(this.x - barWidth / 2 - 1, barY - 1, barWidth + 2, barHeight + 2);
	  ctx.fillStyle = '#d50000';
	  ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);
	  ctx.fillStyle = isFrozen ? '#00e5ff' : '#00e676';
	  const fillW = Math.max(0, barWidth * (this.hp / this.maxHp));
	  ctx.fillRect(this.x - barWidth / 2, barY, fillW, barHeight);
	}
  }
  drawClanBoss(ctx, isFrozen = false) {
	const c=ctx;
	const cat = this.type === 'giant_cat';
	const bob=this.isGrounded?Math.sin(this.animTimer*(cat?4:2.4))*2:-5;
	const action = this.getActionRenderPhase() || 0;
	c.save();
	c.translate(this.x,this.y+bob);
	c.scale(this.facing * this.squashX, this.squashY);
	c.globalAlpha = this.isHurt ? .76 : 1;
	c.lineJoin = 'miter';
	c.lineCap = 'square';
	c.fillStyle = 'rgba(0,0,0,.28)';
	c.beginPath();
	c.ellipse(0, 2, cat ? 78 : 55, 12, 0, 0, Math.PI * 2);
	c.fill();
	if (cat) {
	  const lean=this.actionKind==='cat_pounce'?action*15:0;
	  c.translate(lean,0);
	  c.strokeStyle = '#74351d';
	  c.lineWidth = 15;
	  c.beginPath(); c.moveTo(-54, -62); c.lineTo(-96, -76); c.lineTo(-96, -119); c.lineTo(-76, -132); c.stroke();
	  const fur=isFrozen?'#a8edff':'#c96a29';
	  const face=isFrozen?'#c9f5ff':'#e88932';
	  c.fillStyle = fur;
	  c.strokeStyle = '#572817';
	  c.lineWidth = 5;
	  box(c,-72,-78,136,67);
	  box(c,-55,-47,37,46);
	  c.fillStyle = face;
	  c.beginPath(); c.moveTo(-42,-139); c.lineTo(-34,-171); c.lineTo(-8,-145); c.lineTo(38,-145); c.lineTo(58,-169); c.lineTo(65,-134); c.closePath(); c.fill(); c.stroke();
	  c.fillStyle = '#a94f24'; c.fillRect(-48,-139,17,77);
	  c.fillStyle=face; box(c,-32,-148,100,85);
	  c.fillStyle = '#7b351e';
	  c.fillRect(-16,-148,14,18); c.fillRect(16,-148,14,20); c.fillRect(-51,-74,22,19); c.fillRect(-2,-78,18,15);
	  c.fillStyle = '#4fba42';
	  c.fillRect(35, -127, 24, 21);
	  c.fillStyle = '#142113';
	  c.fillRect(47, -122, 9, 13);
	  c.fillStyle='#fff0d7'; box(c,57,-107,31,31);
	  c.fillStyle = '#ef8fa5'; c.fillRect(79,-98,13,14);
	  c.strokeStyle = '#7b1520'; c.lineWidth = 7;
	  c.beginPath(); c.moveTo(-55, -62); c.lineTo(61, -62); c.stroke();
	  const paw=this.actionKind==='cat_swipe'?38+action*58:38;
	  c.fillStyle=fur; box(c,paw,-48,52,32);
	  c.fillStyle='#fff4df'; box(c,-55,-21,37,22); box(c,paw+27,-39,25,23);
	} else {
	  const lean=this.actionKind==='creeper_leap'?action*8:0;
	  c.translate(lean,0);
	  c.strokeStyle = '#9a7438'; c.lineWidth = 9; c.beginPath(); c.moveTo(48,-2); c.lineTo(92,-164); c.lineTo(78,-184); c.moveTo(92,-164); c.lineTo(112,-157); c.stroke();
	  c.strokeStyle = '#493117'; c.lineWidth = 4; c.beginPath(); c.moveTo(60,-51); c.lineTo(57,-64); c.moveTo(58,-110); c.lineTo(57,-125); c.stroke();
	  c.fillStyle = '#6d4724'; c.strokeStyle = '#3e2919'; c.lineWidth = 5;
	  box(c,-39,-116,78,103);
	  c.fillStyle = '#c9983f';
	  for (let y=-104;y<-30;y+=25) { c.fillRect(-27+((y/25)&1)*17,y,12,12); c.fillRect(13-((y/25)&1)*13,y+8,10,10); }
	  c.strokeStyle = '#d3a64b'; c.lineWidth = 8; c.beginPath(); c.moveTo(-35,-104); c.lineTo(-59,-76); c.lineTo(-54,-42); c.moveTo(35,-104); c.lineTo(56,-83); c.lineTo(57,-59); c.stroke();
	  const moss=isFrozen?'#b9efff':'#a8d867';
	  c.fillStyle = moss; c.strokeStyle = '#213b1e'; c.lineWidth = 5;
	  box(c,-49,-28,43,29); box(c,12,-28,43,29);
	  c.fillStyle = '#668a45'; c.fillRect(-48,-171,18,68);
	  c.fillStyle=moss; box(c,-31,-177,79,70);
	  c.fillStyle = '#7ba755'; c.fillRect(-21,-168,13,9); c.fillRect(31,-124,13,10);
	  c.fillStyle = '#172016'; c.fillRect(-20,-150,17,22); c.fillRect(18,-150,17,22); c.fillRect(0,-129,18,13); c.fillRect(17,-117,18,10);
	  c.fillStyle=moss; box(c,30,-137,31,29);
	  c.fillStyle = '#211819'; c.fillRect(-34,-182,88,14);
	  c.fillStyle = '#a6291f'; c.fillRect(-27,-178,16,7); c.fillRect(12,-178,16,7);
	  c.strokeStyle = '#edc85a'; c.lineWidth = 7; c.beginPath();
	  for (let i=0;i<7;i++) { c.moveTo(-28+i*13,-181); c.lineTo(-72+i*19,-218+Math.abs(i-2)*5); }
	  c.stroke();
	}
	c.restore();
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
	const isLeap = this.actionKind === 'titan_leap' || this.actionKind === 'creeper_leap';
	const isBoomBug = this.actionKind === 'boom_burst';
	const isCreeper = this.actionKind === 'creeper_blast' || this.actionKind === 'creeper_leap';
	const isCatSwipe = this.actionKind === 'cat_swipe';
	const isCatPounce = this.actionKind === 'cat_pounce';
	const radius = isTitan ? 220 : (this.actionKind === 'creeper_blast' ? 225
	  : (isLeap ? (isCreeper ? 175 : 180) : (isBoomBug ? 125 : (isCatSwipe ? 185 : 150))));
	const color = isTitan ? '#ff2244' : (isCreeper ? '#c9ff55'
	  : (isCatSwipe || isCatPounce ? '#ff9b3d' : (isLeap ? '#ff8830' : (isBoomBug ? '#ff9f1c' : '#70ff66'))));
	const anchorX = isLeap ? this.leapTargetX : (isCatSwipe ? this.x + this.facing * 90 : this.x);
	const progress = Math.max(0, Math.min(1, 1 - this.actionTimer / this.actionDuration));
	const pulse = 0.75 + Math.sin(this.animTimer * 15) * 0.15;
	ctx.save();
	if (isCatPounce) {
	  const pad = this.radius + 18;
	  const left = Math.min(this.x, this.leapTargetX) - pad;
	  const width = Math.max(28, Math.abs(this.leapTargetX - this.x)) + pad * 2;
	  ctx.fillStyle = color; ctx.globalAlpha = .08 + progress * .12;
	  ctx.fillRect(left, this.y - 33, width, 38);
	  ctx.globalAlpha = Math.min(1, (.5 + progress * .45) * pulse);
	  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.setLineDash([15, 9]);
	  ctx.strokeRect(left, this.y - 33, width, 38); ctx.setLineDash([]);
	  ctx.beginPath(); ctx.arc(this.leapTargetX, this.y - 14, 18 + progress * 18, 0, Math.PI * 2); ctx.stroke();
	  ctx.restore();
	  return;
	}
	ctx.fillStyle = color;
	ctx.globalAlpha = 0.07 + progress * 0.11;
	ctx.beginPath();
	ctx.ellipse(anchorX, this.y - 2, radius, Math.max(18, radius * 0.11), 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = Math.min(1, (0.48 + progress * 0.46) * pulse);
	ctx.strokeStyle = color;
	ctx.shadowColor = color;
	ctx.shadowBlur = (isTitan || isLeap) ? 16 : (isBoomBug ? 13 : 10);
	ctx.lineWidth = (isTitan || isLeap) ? 6 : (isBoomBug ? 5 : 4);
	ctx.setLineDash([16, 9]);
	ctx.beginPath();
	ctx.ellipse(anchorX, this.y - 2, radius, Math.max(18, radius * 0.11), 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.globalAlpha = 0.9;
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.arc(anchorX, this.y - 5, (isTitan || isLeap) ? 43 : (isBoomBug ? 35 : 31), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
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
	if (this.type === 'crawler') {
	  ctx.fillStyle = '#29451e';
	  ctx.strokeStyle = '#a8e063';
	  ctx.lineWidth = 2.5;
	  ctx.beginPath();
	  ctx.moveTo(-18, -18); ctx.lineTo(-8, -29); ctx.lineTo(9, -27);
	  ctx.lineTo(20, -16); ctx.lineTo(8, -9); ctx.lineTo(-10, -10);
	  ctx.closePath();
	  ctx.fill();
	  ctx.stroke();
	  ctx.beginPath();
	  ctx.moveTo(-9, -12); ctx.lineTo(-20, -2);
	  ctx.moveTo(-2, -10); ctx.lineTo(-8, 1);
	  ctx.moveTo(7, -10); ctx.lineTo(12, 1);
	  ctx.moveTo(13, -13); ctx.lineTo(25, -4);
	  ctx.stroke();
	  if (this.crawlerDashTimer > 0) {
		ctx.globalAlpha = 0.65;
		ctx.strokeStyle = '#cfff91';
		ctx.beginPath();
		ctx.moveTo(-22, -20); ctx.lineTo(-43, -20);
		ctx.moveTo(-20, -13); ctx.lineTo(-35, -10);
		ctx.stroke();
	  }
	} else if (this.type === 'runner') {
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
	} else if (this.type === 'shieldbearer') {
	  const flash = this.shieldFlashTimer > 0;
	  ctx.fillStyle = flash ? '#d7f7ff' : '#263845';
	  ctx.strokeStyle = flash ? '#ffffff' : '#8fd7e8';
	  ctx.lineWidth = flash ? 4.5 : 3;
	  if (flash && !suppressOrdinaryGlow) {
		ctx.shadowColor = '#9ee7ff';
		ctx.shadowBlur = 14;
	  }
	  ctx.beginPath();
	  ctx.moveTo(13, -59);
	  ctx.lineTo(35, -52);
	  ctx.lineTo(33, -24);
	  ctx.quadraticCurveTo(28, -10, 15, -4);
	  ctx.quadraticCurveTo(4, -14, 5, -37);
	  ctx.closePath();
	  ctx.fill();
	  ctx.stroke();
	  ctx.strokeStyle = flash ? '#60eaff' : '#557988';
	  ctx.lineWidth = 2;
	  ctx.beginPath();
	  ctx.moveTo(12, -48); ctx.lineTo(28, -43);
	  ctx.moveTo(12, -35); ctx.lineTo(28, -30);
	  ctx.stroke();
	} else if (this.type === 'stalker') {
	  const flicker = 0.55 + Math.abs(Math.sin(this.animTimer * 9)) * 0.4;
	  ctx.globalAlpha = flicker;
	  ctx.fillStyle = '#e07bff';
	  ctx.fillRect(-16, -40, 12 + ((this.animTimer * 13) | 0) % 9, 3);
	  ctx.fillRect(2, -26, 9 + ((this.animTimer * 17) | 0) % 7, 3);
	  ctx.fillStyle = '#7b2bd6';
	  ctx.fillRect(-10, -12, 14, 3);
	  ctx.globalAlpha = 1;
	} else if (this.type === 'warden') {
	  const flash = this.shieldFlashTimer > 0;
	  ctx.fillStyle = flash ? '#d7f7ff' : '#1d3327';
	  ctx.strokeStyle = flash ? '#ffffff' : '#8fe8b0';
	  ctx.lineWidth = flash ? 5 : 3.5;
	  if (flash && !suppressOrdinaryGlow) {
		ctx.shadowColor = '#9effc8';
		ctx.shadowBlur = 14;
	  }
	  ctx.beginPath();
	  ctx.moveTo(16, -76);
	  ctx.lineTo(44, -66);
	  ctx.lineTo(42, -22);
	  ctx.quadraticCurveTo(36, -4, 19, 2);
	  ctx.quadraticCurveTo(6, -12, 7, -46);
	  ctx.closePath();
	  ctx.fill();
	  ctx.stroke();
	  ctx.strokeStyle = flash ? '#8affc4' : '#4f7a5f';
	  ctx.lineWidth = 2.5;
	  ctx.beginPath();
	  ctx.moveTo(15, -62); ctx.lineTo(36, -55);
	  ctx.moveTo(15, -46); ctx.lineTo(36, -39);
	  ctx.moveTo(15, -30); ctx.lineTo(36, -23);
	  ctx.stroke();
	} else if (this.type === 'boom_bug') {
	  const charging = this.actionKind === 'boom_burst' && this.actionPhase === 'windup';
	  const progress = charging && this.actionDuration > 0
		? Math.max(0, Math.min(1, 1 - this.actionTimer / this.actionDuration))
		: 0;
	  const pulse = charging ? 0.75 + Math.sin(this.animTimer * 22) * 0.2 : 0.6;
	  ctx.fillStyle = charging ? '#ff6d00' : '#463e18';
	  ctx.strokeStyle = '#ffd166';
	  ctx.lineWidth = 3;
	  if (charging && !suppressOrdinaryGlow) {
		ctx.shadowColor = '#ff6d00';
		ctx.shadowBlur = 9 + progress * 8;
	  }
	  ctx.beginPath();
	  ctx.ellipse(-5, -30, 18 + progress * 3, 20 + progress * 3, -0.2, 0, Math.PI * 2);
	  ctx.fill();
	  ctx.stroke();
	  ctx.globalAlpha = pulse;
	  ctx.fillStyle = '#fff3bf';
	  ctx.beginPath();
	  ctx.moveTo(-5, -43); ctx.lineTo(2, -26); ctx.lineTo(-2, -26);
	  ctx.lineTo(2, -16); ctx.lineTo(-12, -31); ctx.lineTo(-7, -31);
	  ctx.closePath();
	  ctx.fill();
	} else if (this.type === 'titan_boss') {
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
