import { StickFigureRenderer } from './stickman.js?v=9.8';
import { particles } from '../engine/particles.js?v=9.8';
import { audio } from '../engine/audio.js?v=9.8';
import { projectiles } from './projectiles.js?v=9.8';
import { combat } from '../systems/combat.js?v=9.8';
import { speech } from '../engine/speech.js?v=9.8';
export class DarkLord {
  constructor(x, y) {
	this.x = x;
	this.y = y;
	this.groundY = y;
	this.vx = 0;
	this.vy = 0;
	this.type = 'dark_lord';
	this.name = 'THE DARK LORD (TDL)';
	this.isBoss = true;
	this.maxHp = 950;
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
	this.phase = 1;
	this.state = 'idle';
	this.stateTimer = 0;
	this.actionCooldown = 1.0;
	this.isAwakened = false;
	this.freezeTimer = 0;
	this.stunTimer = 0;
	this.comboStep = 0;
	this.teleportTargetX = 0;
	this.doomLaserFired = false;
	this.auraParticleTimer = 0;
	this.chargeFxTimer = 0;
	this.meteorFxTimer = 0;
	this.meteorTargetX = x;
	this.camera = null;
	this.bladeContactTimer = 0;
	this.inkReward = 350;
	this.scoreReward = 5000;
	this.renderer = new StickFigureRenderer(this.color, this.strokeWidth, this.scale, true);
	this.renderer.glowColor = '#ff0033';
  }
  update(dt, groundY, player, sketchBlocks, camera, platforms = [], enemies = [], friendlyTargets = []) {
	if (this.isDead) return;
	this.groundY = groundY;
	this.camera = camera || this.camera;
	this.animTimer += dt;
	this.bladeContactTimer = Math.max(0, this.bladeContactTimer - dt);
	this.platforms = platforms;
	this.friendlyTargets = friendlyTargets;
	this.auraParticleTimer -= dt;
	if ((this.isAwakened || this.state === 'doom_laser') && this.auraParticleTimer <= 0) {
	  this.auraParticleTimer = 0.08;
	  particles.createHitSparks(
		this.x + (Math.random() - 0.5) * 30,
		this.y - 30 + (Math.random() - 0.5) * 40,
		1,
		'#ff0033'
	  );
	}
	if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
	  this.phase = 2;
	  this.isAwakened = true;
	  audio.playBossRoar();
	  audio.setIntensity(1.0);
	  if (camera) camera.addShake(0.8);
	  particles.addShockwave(this.x, this.y - 30, 260, '#ff0033', 14);
	  particles.addTextBanner(this.x, this.y - 80, '⚠️ VIRABOT OVERCHARGE! ⚠️', '#ff0033');
	  speech.shoutBoss(this.x, this.y, 'darkLord', 'phase', 1.55, {
		anchor: this,
		speakerKey: 'darkLord:phase',
		repeatKey: 'darkLord:phase',
		cooldownMs: 0
	  });
	}
	if (this.hurtTimer > 0) {
	  this.hurtTimer -= dt;
	  if (this.hurtTimer <= 0) this.isHurt = false;
	}
	this.chatterTimer = (this.chatterTimer ?? 5) - dt;
	if (this.chatterTimer <= 0 && this.state === 'idle') {
	  this.sayCorpus('default', 1.3);
	  this.chatterTimer = 7 + Math.random() * 4;
	}
	const frozen = this.freezeTimer > 0;
	const stunned = this.stunTimer > 0;
	this.freezeTimer = Math.max(0, this.freezeTimer - dt);
	this.stunTimer = Math.max(0, this.stunTimer - dt);
	const stepDt = dt * (frozen ? 0.68 : 1);
	if (stunned) { this.pose = 'hurt'; this.vx = 0; }
	else this.updateAI(stepDt, groundY, player, camera, sketchBlocks);
	this.applyPhysics(stepDt, groundY, sketchBlocks);
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
	if (this.state === 'idle' || this.state === 'walk') {
	  this.facing = dx >= 0 ? 1 : -1;
	}
	if (this.actionCooldown > 0) {
	  this.actionCooldown -= dt;
	}
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
		  this.x = this.teleportTargetX;
		  this.facing = player.x >= this.x ? 1 : -1;
		  audio.playTeleportZap();
		  particles.createHitSparks(this.x, this.y - 35, 16, '#ff0033');
		  particles.addShockwave(this.x, this.y - 20, 80, '#ff0033', 6);
		  if (Math.random() < 0.6) {
			this.startBladeCombo(player, camera);
		  } else {
			this.startEnergyWaves(player, camera);
		  }
		}
		break;
	  }
	  case 'blade_windup': {
		this.stateTimer -= dt;
		this.pose = 'attack_cross';
		this.vx = 0;
		if (this.stateTimer <= 0) this.beginBladeCombo(player, camera);
		break;
	  }
	  case 'blade_combo': {
		this.stateTimer -= dt;
		this.pose = 'weapon_slash';
		if (this.stateTimer <= 0) {
		  this.comboStep++;
		  if (this.comboStep <= 3) {
			this.executeBladeSlash(this.comboStep, player, camera);
		  } else {
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
			projectiles.spawnDarkEnergyWave(this.x + this.facing * 30, this.y - 35, this.facing, 24, this);
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
	  case 'energy_windup': {
		this.stateTimer -= dt;
		this.pose = 'attack_cross';
		this.vx = 0;
		if (this.stateTimer <= 0) this.beginEnergyWaves(player, camera);
		break;
	  }
	  case 'summon_virabots': {
		this.stateTimer -= dt;
		this.pose = 'awakening_god';
		this.vx = 0;
		if (this.stateTimer <= 0) {
		  const count = this.isAwakened ? 3 : 2;
		  for (let i = 0; i < count; i++) {
			const side = i % 2 === 0 ? 1 : -1;
			projectiles.spawnViraBot(this.x + side * (60 + i * 30), this.y, side, this);
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
		this.chargeFxTimer -= dt;
		if (this.stateTimer > 1.2 && this.chargeFxTimer <= 0) {
		  this.chargeFxTimer = 0.08;
		  particles.createHitSparks(this.x + this.facing * 25, this.y - 45, 2, '#ff0033');
		}
		if (!this.doomLaserFired && this.stateTimer <= 1.3) {
		  this.doomLaserFired = true;
		  projectiles.spawnDarkDoomLaser(this.x + this.facing * 20, this.y - 20, this.facing, 1.2, 35, this);
		}
		if (this.stateTimer <= 0) {
		  this.state = 'idle';
		  this.actionCooldown = 2.2;
		}
		break;
	  }
	  case 'meteor_windup': {
		this.stateTimer -= dt;
		this.pose = 'crouch';
		this.vx = 0;
		if (this.stateTimer <= 0) {
		  this.state = 'meteor_rise';
		  this.stateTimer = 0.5;
		  this.pose = 'jump_rise';
		  audio.playJump();
		}
		break;
	  }
	  case 'meteor_rise': {
		this.stateTimer -= dt;
		this.pose = 'jump_rise';
		this.vy = -750;
		this.vx = (player.x - this.x) * 0.8;
		if (this.stateTimer <= 0 || this.y < -550) {
		  this.state = 'meteor_slam';
		  this.x = this.meteorTargetX;
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
		this.meteorFxTimer -= dt;
		if (this.meteorFxTimer <= 0) {
		  this.meteorFxTimer = 0.07;
		  particles.createHitSparks(this.x, this.y, 2, '#ff0033');
		}
		if (this.y >= groundY) {
		  this.y = groundY;
		  this.vy = 0;
		  audio.playBruteStomp();
		  audio.playFinisherImpact();
		  if (camera) camera.addShake(0.7);
		  const impact = particles.emitImpact({
			x: this.x,
			y: groundY - 12,
			profile: 'heavy',
			color: '#ff0033',
			arc: false,
			shockwaveRadius: 240,
			shockwaveThickness: 14
		  });
		  camera?.addHitstop?.(impact.hitstop);
		  particles.triggerSpeedlines({
			x: this.x,
			y: groundY - 50,
			duration: 0.26,
			boss: true,
			seed: 0x0d4a11
		  });
		  if (player && !player.isRolling && !player.isAwakened) {
			const hitDist = Math.hypot(player.x - this.x, player.y - groundY);
			if (hitDist < 200) {
			  player.takeDamage(32, player.x >= this.x ? 1 : -1, 600);
			}
		  }
		  for (const ally of this.friendlyTargets || []) {
			if (!ally || ally.isDead || ally.retreating || ally.isTargetable !== true) continue;
			if (Math.hypot(ally.x - this.x, ally.y - groundY) < 200) {
			  ally.takeDamage(32, ally.x >= this.x ? 1 : -1, 600);
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
	  this.startDoomLaser(player);
	} else if (this.phase === 2 && roll < 0.55) {
	  this.startMeteorPlunge(player);
	} else if (roll < 0.35) {
	  this.startTeleport(player);
	} else if (roll < 0.65) {
	  this.startEnergyWaves(player);
	} else if (roll < 0.85) {
	  this.state = 'summon_virabots';
	  this.stateTimer = 0.6;
	  audio.playViraBotSpawn();
	  this.sayCorpus('summon');
	} else {
	  this.state = 'walk';
	  this.actionCooldown = 1.5;
	}
  }
  startTeleport(player) {
	this.state = 'teleport';
	this.stateTimer = 0.25;
	audio.playTeleportZap();
	particles.createHitSparks(this.x, this.y - 35, 14, '#ff0033');
	const side = Math.random() > 0.5 ? 1 : -1;
	this.teleportTargetX = Math.max(-900, Math.min(900, player.x + side * (85 + Math.random() * 40)));
  }
  startBladeCombo(player, camera) {
	this.state = 'blade_windup';
	this.stateTimer = 0.22;
	this.vx = 0;
	this.pose = 'attack_cross';
	this.sayEvent('YOUR TURN.', 'blade');
	camera?.addZoomPunch?.(-0.018);
  }
  beginBladeCombo(player, camera) {
	this.state = 'blade_combo';
	this.comboStep = 1;
	this.executeBladeSlash(1, player, camera);
  }
  executeBladeSlash(step, player, camera) {
	this.stateTimer = 0.26;
	this.bladeContactTimer = 0.075;
	audio.playDarkBladeSlash();
	this.vx = this.facing * 220;
	const damage = (20 + step * 6);
	const range = 110;
	particles.addSlashArc(this.x, this.y - 30, range * 0.85, 0, this.facing, '#ff0033', 10);
	if (camera) camera.addShake(0.2);
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
	this.state = 'energy_windup';
	this.stateTimer = 0.36;
	this.comboStep = 0;
	this.vx = 0;
	this.sayEvent('THREE FOR YOU.', 'waves');
	camera?.addZoomPunch?.(-0.025);
  }
  beginEnergyWaves(player, camera) {
	this.state = 'energy_waves';
	this.comboStep = 0;
	this.stateTimer = 0.1;
  }
  startDoomLaser(player) {
	this.state = 'doom_laser';
	this.stateTimer = 2.0;
	this.doomLaserFired = false;
	this.chargeFxTimer = 0;
	this.y -= 35;
	this.vy = 0;
	audio.playDoomLaserCharge();
	particles.addTextBanner(this.x, this.y - 70, '⚡ DOOM LASER! ⚡', '#ff0033');
	this.sayEvent('JUMP. NOW.', 'doom');
  }
  startMeteorPlunge(player) {
	const predictedX = player.x + Math.max(-180, Math.min(180, player.vx || 0)) * 0.18;
	this.meteorTargetX = Math.max(-920, Math.min(920, predictedX));
	this.meteorFxTimer = 0;
	this.state = 'meteor_windup';
	this.stateTimer = 0.42;
	this.vx = 0;
	audio.playDoomLaserCharge();
	this.sayEvent('LOOK UP.', 'meteor');
  }
  sayEvent(text, eventKey) {
	speech.spawnBubble(this.x, this.y, text, 'darkLord', 1.35, {
	  anchor: this,
	  priority: 4,
	  speakerKey: 'darkLord',
	  eventKey,
	  cooldownMs: 1200
	});
  }
  sayCorpus(eventName, duration = 1.35) {
	speech.shoutBoss(this.x, this.y, 'darkLord', eventName, duration, {
	  anchor: this,
	  speakerKey: 'darkLord',
	  repeatKey: `darkLord:${eventName}`,
	  cooldownMs: 1200
	});
  }
  applyPhysics(dt, groundY, sketchBlocks) {
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
	this.x = Math.max(-980, Math.min(980, this.x));
  }
  takeDamage(amount, knockbackDir = 1, knockbackPower = 200, isCrit = false) {
	if (this.isDead || !Number.isFinite(amount) || amount <= 0) return 0;
	const applied = Math.min(this.hp, amount);
	this.hp -= applied;
	this.isHurt = true;
	this.hurtTimer = 0.15;
	this.vx = knockbackDir * (knockbackPower * 0.35);
	particles.addDamageText(this.x, this.y - this.height * 0.8, applied, isCrit, '#ff2244');
	particles.createHitSparks(this.x, this.y - this.height * 0.5, 6, '#ff0033');
	if (Math.random() < 0.15 && this.state === 'idle') {
	  this.startTeleport({ x: this.x + (Math.random() - 0.5) * 300 });
	}
	if (Math.random() < 0.14) this.sayCorpus('hurt', 1.2);
	if (this.hp <= 0) {
	  this.die();
	}
	return applied;
  }
  applyFreeze(duration = 4) {
	if (this.isDead) return false;
	this.freezeTimer = Math.max(this.freezeTimer, Math.min(0.8, Math.max(0, duration) * 0.2));
	return true;
  }
  applyStun(duration = 3) {
	if (this.isDead) return false;
	this.stunTimer = Math.max(this.stunTimer, Math.min(0.5, Math.max(0, duration) * 0.16));
	return true;
  }
  die() {
	if (this.isDead) return;
	this.isDead = true;
	this.hp = 0;
	projectiles.clearByOwner(this);
	combat.registerKill(this);
	audio.playBossVictoryFanfare();
	audio.playFinisherImpact();
	speech.shoutBoss(this.x, this.y, 'darkLord', 'defeat', 1.8, {
	  anchor: this, speakerKey: 'darkLord', repeatKey: 'darkLord:defeat', cooldownMs: 0
	});
	this.camera?.addShake?.(0.78);
	this.camera?.addZoomPunch?.(0.075);
	particles.emitBossExplosion({
	  x: this.x, y: this.y - 38, bodyY: this.y, groundY: this.groundY,
	  color: '#ff0033', accent: '#fff0a6', radius: 250,
	  stickFigure: true, seed: 0xd4a410
	});
  }
  draw(ctx) {
	if (this.isDead) return;
	this.drawTelegraph(ctx);
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
	  actionPhase: this.getActionPhase(),
	  scale: 1.0,
	  alpha: 1.0
	});
  }
  getActionPhase() {
	if (this.state === 'blade_windup') return 0;
	if (this.state === 'blade_combo' && this.bladeContactTimer > 0) return 0.55;
	if (this.state === 'blade_combo') return Math.max(0, Math.min(1, 1 - this.stateTimer / 0.26));
	if (this.state === 'energy_windup') return 0;
	if (this.state === 'energy_waves') return Math.max(0, Math.min(1, 1 - this.stateTimer / 0.22));
	return null;
  }
  drawTelegraph(ctx) {
	const recovering = this.state === 'idle' && this.actionCooldown > 0;
	const meteorState = this.state === 'meteor_windup'
	  || this.state === 'meteor_rise'
	  || this.state === 'meteor_slam';
	ctx.save();
	if (this.state === 'blade_windup') {
	  const progress = 1 - this.stateTimer / 0.22;
	  ctx.strokeStyle = `rgba(255, 50, 78, ${0.35 + progress * 0.6})`;
	  ctx.lineWidth = 5;
	  ctx.setLineDash([10, 7]);
	  ctx.strokeRect(this.facing > 0 ? this.x + 20 : this.x - 135, this.y - 92, 115, 92);
	} else if (this.state === 'blade_combo') {
	  const progress = Math.max(0, Math.min(1, 1 - this.stateTimer / 0.26));
	  ctx.globalAlpha = 0.75 - progress * 0.3;
	  ctx.strokeStyle = '#ffffff';
	  ctx.lineWidth = 6;
	  ctx.strokeRect(this.facing > 0 ? this.x + 18 : this.x - 132, this.y - 90, 114, 90);
	} else if (this.state === 'energy_windup') {
	  const progress = 1 - this.stateTimer / 0.36;
	  ctx.strokeStyle = `rgba(255, 35, 70, ${0.35 + progress * 0.6})`;
	  ctx.lineWidth = 4;
	  ctx.setLineDash([12, 8]);
	  for (let lane = -1; lane <= 1; lane++) {
		const y = this.y - 35 + lane * 34;
		ctx.beginPath();
		ctx.moveTo(this.x + this.facing * 28, y);
		ctx.lineTo(this.x + this.facing * 620, y);
		ctx.stroke();
	  }
	} else if (this.state === 'summon_virabots') {
	  const progress = Math.max(0, Math.min(1, 1 - this.stateTimer / 0.6));
	  ctx.globalAlpha = 0.45 + progress * 0.45;
	  ctx.strokeStyle = '#ff3355';
	  ctx.lineWidth = 4;
	  ctx.setLineDash([7, 6]);
	  const count = this.isAwakened ? 3 : 2;
	  for (let i = 0; i < count; i++) {
		const side = i % 2 === 0 ? 1 : -1;
		ctx.beginPath();
		ctx.ellipse(this.x + side * (60 + i * 30), this.y, 24 + progress * 10, 7, 0, 0, Math.PI * 2);
		ctx.stroke();
	  }
	} else if (this.state === 'teleport') {
	  ctx.globalAlpha = 0.72;
	  ctx.strokeStyle = '#ff3355';
	  ctx.lineWidth = 3;
	  ctx.setLineDash([5, 6]);
	  ctx.strokeRect(this.teleportTargetX - 32, this.y - 92, 64, 92);
	} else if (this.state === 'doom_laser') {
	  const active = this.doomLaserFired;
	  const pulse = 0.55 + Math.sin(this.animTimer * 18) * 0.2;
	  ctx.globalAlpha = active ? 0.92 : pulse;
	  ctx.strokeStyle = active ? '#ffffff' : '#ff3355';
	  ctx.lineWidth = active ? 7 : 3;
	  ctx.setLineDash(active ? [] : [14, 10]);
	  ctx.beginPath();
	  ctx.moveTo(this.x + this.facing * 24, this.y - 20);
	  ctx.lineTo(this.x + this.facing * 1100, this.y - 20);
	  ctx.stroke();
	}
	if (meteorState) {
	  const pulse = 0.62 + Math.sin(this.animTimer * 20) * 0.22;
	  ctx.globalAlpha = pulse;
	  ctx.strokeStyle = '#ff3355';
	  ctx.fillStyle = 'rgba(255, 25, 55, 0.11)';
	  ctx.lineWidth = this.state === 'meteor_slam' ? 7 : 4;
	  ctx.setLineDash(this.state === 'meteor_slam' ? [] : [9, 7]);
	  ctx.beginPath();
	  ctx.ellipse(this.meteorTargetX, 0, 92, 18, 0, 0, Math.PI * 2);
	  ctx.fill();
	  ctx.stroke();
	  ctx.beginPath();
	  ctx.moveTo(this.meteorTargetX, -250);
	  ctx.lineTo(this.meteorTargetX, -18);
	  ctx.stroke();
	}
	if (recovering) {
	  const recovery = Math.max(0, Math.min(1, this.actionCooldown / 2.2));
	  ctx.globalAlpha = 0.28 + recovery * 0.22;
	  ctx.strokeStyle = '#ff6680';
	  ctx.lineWidth = 2.5;
	  ctx.setLineDash([4, 7]);
	  ctx.beginPath();
	  ctx.ellipse(this.x, this.y, 38 + recovery * 12, 8, 0, 0, Math.PI * 2);
	  ctx.stroke();
	  ctx.setLineDash([]);
	  ctx.fillStyle = '#ffd7df';
	  ctx.font = '800 12px monospace';
	  ctx.textAlign = 'center';
	  ctx.fillText('OPEN!', this.x, this.y - 108);
	}
	ctx.restore();
  }
}
