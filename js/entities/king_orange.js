import { StickFigureRenderer } from './stickman.js?v=9.5';
import { particles } from '../engine/particles.js?v=9.5';
import { audio } from '../engine/audio.js?v=9.5';
import { projectiles } from './projectiles.js?v=9.5';
import { combat } from '../systems/combat.js?v=9.5';
import { speech } from '../engine/speech.js?v=9.5';
const ARENA_LEFT = -980;
const ARENA_RIGHT = 980;
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function playerCanBeHit(player) {
  return player && !player.isDead && !player.isRolling && !player.isAwakened;
}
export class KingOrange {
  constructor(x, y) {
	this.x = x;
	this.y = y;
	this.groundY = y;
	this.vx = 0;
	this.vy = 0;
	this.type = 'king_orange';
	this.name = 'KING ORANGE // REPLAY';
	this.isBoss = true;
	this.isCorruptedReplay = true;
	this.projectileOwner = 'king_orange';
	this.maxHp = 1180;
	this.hp = this.maxHp;
	this.speed = 155;
	this.radius = 30;
	this.height = 84;
	this.color = '#cc6600';
	this.strokeWidth = 6;
	this.scale = 1.22;
	this.inkReward = 420;
	this.scoreReward = 7200;
	this.facing = -1;
	this.pose = 'idle';
	this.animTimer = 0;
	this.isGrounded = true;
	this.isDead = false;
	this.isHurt = false;
	this.hurtTimer = 0;
	this.freezeTimer = 0;
	this.stunTimer = 0;
	this.freezeResistance = 0.88;
	this.stunResistance = 0.94;
	this.phase = 1;
	this.state = 'idle';
	this.stateTimer = 0;
	this.actionCooldown = 0.9;
	this.attackIndex = 0;
	this.attackHit = false;
	this.volleyTimer = 0;
	this.volleyShots = 0;
	this.commandXs = [];
	this.singularityTick = 0;
	this.auraTimer = 0;
	this.camera = null;
	this.renderer = new StickFigureRenderer(this.color, this.strokeWidth, this.scale, false);
  }
  update(dt, groundY, player, sketchBlocks, camera, platforms = [], enemies = [], friendlyTargets = []) {
	if (this.isDead) return;
	this.groundY = groundY;
	this.camera = camera || this.camera;
	this.animTimer += dt;
	this.platforms = platforms;
	this.friendlyTargets = friendlyTargets;
	this.auraTimer -= dt;
	if (this.hurtTimer > 0) {
	  this.hurtTimer -= dt;
	  if (this.hurtTimer <= 0) this.isHurt = false;
	}
	if (this.freezeTimer > 0) this.freezeTimer -= dt;
	if (this.stunTimer > 0) this.stunTimer -= dt;
	this.chatterTimer = (this.chatterTimer ?? 5) - dt;
	if (this.chatterTimer <= 0 && this.state === 'idle') {
	  this.sayCorpus('default', 1.3);
	  this.chatterTimer = 7 + Math.random() * 4;
	}
	this.updatePhase(camera);
	const statusScale = this.stunTimer > 0 ? 0.62 : (this.freezeTimer > 0 ? 0.76 : 1);
	const stepDt = dt * statusScale;
	this.updateAI(stepDt, groundY, player, camera);
	this.applyPhysics(stepDt, groundY, sketchBlocks);
	if (this.phase >= 2 && this.auraTimer <= 0) {
	  this.auraTimer = 0.16;
	  particles.createHitSparks(
		this.x + Math.sin(this.animTimer * 7) * 22,
		this.y - 45 + Math.cos(this.animTimer * 5) * 22,
		1,
		this.phase === 3 ? '#d94cff' : '#ffb020'
	  );
	}
  }
  updatePhase(camera) {
	const ratio = this.hp / this.maxHp;
	if (this.phase === 1 && ratio <= 0.66) {
	  this.phase = 2;
	  this.state = 'recovery';
	  this.stateTimer = 0.75;
	  this.vx = 0;
	  audio.playBossRoar();
	  camera?.addShake?.(0.42);
	  camera?.addZoomPunch?.(0.05);
	  particles.addShockwave(this.x, this.y - 38, 190, '#ffb020', 10);
	  particles.addTextBanner(this.x, this.y - 105, 'COMMAND BLOCK ONLINE', '#ffcc33');
	  this.sayCorpus('phase', 1.55);
	} else if (this.phase === 2 && ratio <= 0.33) {
	  this.phase = 3;
	  this.state = 'recovery';
	  this.stateTimer = 0.9;
	  this.vx = 0;
	  audio.playAwakening();
	  camera?.addShake?.(0.55);
	  camera?.addZoomPunch?.(0.07);
	  particles.addShockwave(this.x, this.y - 52, 240, '#d94cff', 12);
	  particles.addTextBanner(this.x, this.y - 112, 'REPLAY SINGULARITY!', '#ef74ff');
	  this.sayCorpus('phase', 1.55);
	}
  }
  updateAI(dt, groundY, player, camera) {
	if (!player || player.isDead) {
	  this.pose = 'idle';
	  this.vx *= Math.pow(0.02, dt);
	  return;
	}
	const dx = player.x - this.x;
	const dist = Math.abs(dx);
	if (this.state === 'idle' || this.state === 'recovery') {
	  this.facing = dx >= 0 ? 1 : -1;
	}
	switch (this.state) {
	  case 'idle': {
		this.pose = dist > 250 ? 'run' : 'idle';
		this.actionCooldown -= dt;
		if (dist > 290) {
		  this.vx = this.facing * this.speed;
		} else if (dist < 130) {
		  this.vx = -this.facing * this.speed * 0.55;
		} else {
		  this.vx *= Math.pow(0.02, dt);
		}
		if (this.actionCooldown <= 0) this.chooseAttack(player);
		break;
	  }
	  case 'gold_windup': {
		this.pose = 'attack_cross';
		this.vx = 0;
		this.stateTimer -= dt;
		if (this.stateTimer <= 0) {
		  this.state = 'gold_dash';
		  this.stateTimer = 0.24;
		  this.attackHit = false;
		  this.vx = this.facing * 610;
		  audio.playWhoosh();
		  particles.addSlashArc(this.x, this.y - 42, 105, 0, this.facing, '#ffd34d', 8);
		}
		break;
	  }
	  case 'gold_dash': {
		this.pose = 'weapon_slash';
		this.stateTimer -= dt;
		if (!this.attackHit && playerCanBeHit(player)) {
		  const hitX = Math.abs(player.x - this.x) < 82;
		  const hitY = Math.abs((player.y - 30) - (this.y - 38)) < 64;
		  if (hitX && hitY) {
			this.attackHit = true;
			player.takeDamage(15, this.facing, 390);
			camera?.addShake?.(0.2);
			camera?.addHitstop?.(0.035);
			particles.createHitSparks(player.x, player.y - 30, 7, '#ffd34d');
		  }
		}
		if (this.stateTimer <= 0) this.beginRecovery(0.45);
		break;
	  }
	  case 'slam_windup': {
		this.pose = 'awakening_god';
		this.vx = 0;
		this.stateTimer -= dt;
		if (this.stateTimer <= 0) {
		  const impactX = this.x + this.facing * 58;
		  audio.playBruteStomp();
		  camera?.addShake?.(0.46);
		  camera?.addHitstop?.(0.05);
		  particles.addShockwave(impactX, groundY, 175, '#8b8f98', 11);
		  particles.createDust(impactX, groundY, 12);
		  if (playerCanBeHit(player)) {
			const dxToImpact = Math.abs(player.x - impactX);
			const playerHeight = groundY - player.y;
			if (dxToImpact < 155 && playerHeight < 62) {
			  player.takeDamage(20, player.x >= impactX ? 1 : -1, 500);
			}
		  }
		  this.hitAllies((ally) => Math.abs(ally.x - impactX) < 155 && groundY - ally.y < 62, 20, impactX);
		  this.beginRecovery(0.58);
		}
		break;
	  }
	  case 'volley_windup': {
		this.pose = 'awakening_god';
		this.vx = 0;
		this.stateTimer -= dt;
		if (this.stateTimer <= 0) {
		  this.state = 'volley';
		  this.stateTimer = this.phase === 1 ? 0.55 : 0.78;
		  this.volleyTimer = 0;
		  this.volleyShots = this.phase === 1 ? 2 : 3;
		}
		break;
	  }
	  case 'volley': {
		this.pose = 'weapon_slash';
		this.vx = 0;
		this.stateTimer -= dt;
		this.volleyTimer -= dt;
		if (this.volleyShots > 0 && this.volleyTimer <= 0) {
		  this.facing = player.x >= this.x ? 1 : -1;
		  const shotNumber = (this.phase === 1 ? 2 : 3) - this.volleyShots;
		  const highLane = shotNumber % 2 === 1;
		  const shotY = groundY - (highLane ? 98 : 34);
		  projectiles.spawnKingBlock(
			this.x + this.facing * 42,
			shotY,
			this.facing,
			highLane ? 'gold' : 'obsidian',
			highLane ? 12 : 14,
			this.projectileOwner
		  );
		  this.volleyShots--;
		  this.volleyTimer = 0.22;
		  audio.playBlockPlace();
		}
		if (this.stateTimer <= 0 && this.volleyShots <= 0) this.beginRecovery(0.5);
		break;
	  }
	  case 'command_windup': {
		this.pose = 'awakening_god';
		this.vx = 0;
		this.stateTimer -= dt;
		if (this.stateTimer <= 0) {
		  this.state = 'command_active';
		  this.stateTimer = 0.34;
		  this.attackHit = false;
		  audio.playBlockPlace();
		  camera?.addShake?.(0.32);
		  for (const x of this.commandXs) {
			particles.createDust(x, groundY, 7);
		  }
		  this.hitAllies((ally) => this.commandXs.some((x) => Math.abs(ally.x - x) < 42), 17);
		}
		break;
	  }
	  case 'command_active': {
		this.pose = 'weapon_slash';
		this.stateTimer -= dt;
		if (!this.attackHit && playerCanBeHit(player)) {
		  const inColumn = this.commandXs.some((x) => Math.abs(player.x - x) < 42);
		  if (inColumn) {
			this.attackHit = true;
			player.takeDamage(17, player.x >= this.x ? 1 : -1, 350);
			particles.createHitSparks(player.x, player.y - 35, 6, '#ffb020');
		  }
		}
		if (this.stateTimer <= 0) this.beginRecovery(0.62);
		break;
	  }
	  case 'singularity_windup': {
		this.pose = 'awakening_god';
		this.vx = 0;
		this.stateTimer -= dt;
		if (this.stateTimer <= 0) {
		  this.state = 'singularity';
		  this.stateTimer = 1.8;
		  this.singularityTick = 0;
		  audio.playDoomLaserFire();
		  camera?.addShake?.(0.28);
		  camera?.addZoomPunch?.(-0.06);
		}
		break;
	  }
	  case 'singularity': {
		this.pose = 'awakening_god';
		this.vx = 0;
		this.stateTimer -= dt;
		this.singularityTick -= dt;
		const pullDx = this.x - player.x;
		const pullDist = Math.abs(pullDx);
		if (pullDist < 520) {
		  const pull = (1 - pullDist / 520) * 175;
		  player.vx += Math.sign(pullDx || 1) * pull * dt;
		}
		if (this.singularityTick <= 0) {
		  let hit = false;
		  if (pullDist < 82 && playerCanBeHit(player)) {
			player.takeDamage(8, player.x >= this.x ? 1 : -1, 230);
			particles.createHitSparks(player.x, player.y - 30, 4, '#d94cff');
			hit = true;
		  }
		  hit = this.hitAllies((ally) => Math.abs(ally.x - this.x) < 82, 8) || hit;
		  if (hit) this.singularityTick = 0.55;
		}
		if (this.stateTimer <= 0) this.beginRecovery(0.85);
		break;
	  }
	  case 'recovery': {
		this.pose = 'idle';
		this.vx *= Math.pow(0.015, dt);
		this.stateTimer -= dt;
		if (this.stateTimer <= 0) {
		  this.state = 'idle';
		  this.actionCooldown = this.phase === 3 ? 0.48 : 0.65;
		}
		break;
	  }
	}
  }
  chooseAttack(player) {
	const phaseMoves = this.phase === 1
	  ? ['gold', 'volley', 'slam']
	  : this.phase === 2
		? ['command', 'gold', 'volley', 'slam']
		: ['singularity', 'command', 'gold', 'volley', 'slam'];
	const move = phaseMoves[this.attackIndex % phaseMoves.length];
	this.attackIndex++;
	this.facing = player.x >= this.x ? 1 : -1;
	this.vx = 0;
	if (move === 'gold') {
	  this.state = 'gold_windup';
	  this.stateTimer = 0.58;
	  audio.playDarkBladeSlash();
	  this.sayEvent('CHECK.', 'gold-dash');
	} else if (move === 'volley') {
	  this.state = 'volley_windup';
	  this.stateTimer = 0.62;
	  audio.playDoomLaserCharge();
	  this.sayEvent('HIGH. LOW.', 'volley');
	} else if (move === 'slam') {
	  this.state = 'slam_windup';
	  this.stateTimer = 0.72;
	  audio.playWhoosh();
	} else if (move === 'command') {
	  this.state = 'command_windup';
	  this.stateTimer = 0.78;
	  const escapeSide = player.x >= this.x ? 1 : -1;
	  this.commandXs = [
		clamp(player.x, ARENA_LEFT + 60, ARENA_RIGHT - 60),
		clamp(player.x + escapeSide * 145, ARENA_LEFT + 60, ARENA_RIGHT - 60)
	  ];
	  audio.playDoomLaserCharge();
	  this.sayCorpus('command');
	} else {
	  this.state = 'singularity_windup';
	  this.stateTimer = 0.95;
	  audio.playDoomLaserCharge();
	  particles.addTextBanner(this.x, this.y - 104, 'RUN FROM THE VOID!', '#ef74ff');
	  this.sayEvent('COME CLOSER.', 'singularity');
	}
  }
  hitAllies(test, damage, originX = this.x) {
	let hit = false;
	for (const ally of this.friendlyTargets || []) {
	  if (!ally || ally.isDead || ally.retreating || ally.isTargetable !== true || !test(ally)) continue;
	  ally.takeDamage(damage, ally.x >= originX ? 1 : -1);
	  hit = true;
	}
	return hit;
  }
  sayEvent(text, eventKey) {
	speech.spawnBubble(this.x, this.y, text, 'kingOrange', 1.35, {
	  anchor: this,
	  priority: 4,
	  speakerKey: 'kingOrange',
	  eventKey,
	  cooldownMs: 1400
	});
  }
  sayCorpus(eventName, duration = 1.35) {
	speech.shoutBoss(this.x, this.y, 'kingOrange', eventName, duration, {
	  anchor: this,
	  speakerKey: 'kingOrange',
	  repeatKey: `kingOrange:${eventName}`,
	  cooldownMs: 1400
	});
  }
  beginRecovery(duration) {
	this.state = 'recovery';
	this.stateTimer = duration;
	this.vx = 0;
  }
  applyPhysics(dt, groundY, sketchBlocks) {
	this.vy += 950 * dt;
	this.x += this.vx * dt;
	this.y += this.vy * dt;
	if (this.y >= groundY) {
	  this.y = groundY;
	  this.vy = 0;
	  this.isGrounded = true;
	} else {
	  this.isGrounded = false;
	}
	this.x = clamp(this.x, ARENA_LEFT, ARENA_RIGHT);
  }
  applyFreeze(duration = 4) {
	this.freezeTimer = Math.max(this.freezeTimer, Math.min(0.72, duration * (1 - this.freezeResistance)));
  }
  applyStun(duration = 3) {
	this.stunTimer = Math.max(this.stunTimer, Math.min(0.32, duration * (1 - this.stunResistance)));
  }
  takeDamage(amount, knockbackDir = 1, knockbackPower = 200, isCrit = false) {
	if (this.isDead || !Number.isFinite(amount) || amount <= 0) return 0;
	const applied = Math.min(this.hp, amount);
	this.hp -= applied;
	this.isHurt = true;
	this.hurtTimer = 0.14;
	this.vx += knockbackDir * knockbackPower * 0.2;
	particles.addDamageText(this.x, this.y - this.height * 0.78, applied, isCrit, '#ff9a32');
	particles.createHitSparks(this.x, this.y - 44, 5, '#ff9a32');
	if (this.hp <= 0) this.die();
	return applied;
  }
  die() {
	if (this.isDead) return;
	this.isDead = true;
	this.hp = 0;
	this.vx = 0;
	projectiles.clearByOwner(this.projectileOwner);
	combat.registerKill(this);
	audio.playBossVictoryFanfare();
	audio.playFinisherImpact();
	speech.shoutBoss(this.x, this.y, 'kingOrange', 'defeat', 1.8, {
	  anchor: this, speakerKey: 'kingOrange', repeatKey: 'kingOrange:defeat', cooldownMs: 0
	});
	this.camera?.addShake?.(0.8);
	this.camera?.addZoomPunch?.(0.08);
	particles.emitBossExplosion({
	  x: this.x, y: this.y - 42, bodyY: this.y, groundY: this.groundY,
	  color: '#ff9a32', accent: '#d94cff', radius: 260,
	  stickFigure: true, seed: 0x4b1a60
	});
  }
  draw(ctx) {
	if (this.isDead) return;
	this.drawTelegraph(ctx);
	const awakened = this.phase === 3 || this.state.startsWith('singularity');
	this.renderer.draw(ctx, {
	  x: this.x,
	  y: this.y,
	  facing: this.facing,
	  pose: this.isHurt ? 'idle' : this.pose,
	  animTimer: this.animTimer,
	  isGrounded: this.isGrounded,
	  isHurt: this.isHurt,
	  isAwakened: awakened,
	  scale: 1,
	  alpha: 1
	});
	this.drawCrown(ctx);
	this.drawStaff(ctx);
	this.drawReplayGlitches(ctx);
  }
  drawTelegraph(ctx) {
	ctx.save();
	if (this.state === 'gold_windup') {
	  const progress = 1 - this.stateTimer / 0.58;
	  ctx.strokeStyle = `rgba(255, 211, 77, ${0.35 + progress * 0.55})`;
	  ctx.lineWidth = 5;
	  ctx.setLineDash([12, 8]);
	  ctx.strokeRect(
		this.facing > 0 ? this.x + 22 : this.x - 225,
		this.y - 76,
		203,
		76
	  );
	} else if (this.state === 'slam_windup') {
	  const progress = 1 - this.stateTimer / 0.72;
	  ctx.strokeStyle = `rgba(195, 201, 210, ${0.35 + progress * 0.6})`;
	  ctx.lineWidth = 5;
	  ctx.beginPath();
	  ctx.ellipse(this.x + this.facing * 58, this.y, 155 * progress, 18, 0, 0, Math.PI * 2);
	  ctx.stroke();
	} else if (this.state === 'volley_windup') {
	  const pulse = 0.55 + Math.sin(this.animTimer * 18) * 0.25;
	  ctx.strokeStyle = `rgba(255, 176, 32, ${pulse})`;
	  ctx.lineWidth = 4;
	  ctx.beginPath();
	  ctx.arc(this.x + this.facing * 34, this.y - 62, 25, 0, Math.PI * 2);
	  ctx.stroke();
	  ctx.setLineDash([7, 7]);
	  for (const laneY of [this.y - 34, this.y - 98]) {
		const startX = this.x + this.facing * 60;
		const endX = this.x + this.facing * 310;
		ctx.strokeRect(endX - 18, laneY - 18, 36, 36);
		ctx.beginPath();
		ctx.moveTo(startX, laneY);
		ctx.lineTo(endX, laneY);
		ctx.stroke();
	  }
	} else if (this.state === 'command_windup') {
	  const progress = 1 - this.stateTimer / 0.78;
	  for (const x of this.commandXs) {
		ctx.fillStyle = `rgba(255, 151, 24, ${0.08 + progress * 0.18})`;
		ctx.strokeStyle = `rgba(255, 194, 77, ${0.45 + progress * 0.5})`;
		ctx.lineWidth = 4;
		ctx.setLineDash([8, 7]);
		ctx.fillRect(x - 42, this.y - 310, 84, 310);
		ctx.strokeRect(x - 42, this.y - 310, 84, 310);
	  }
	} else if (this.state === 'command_active') {
	  for (const x of this.commandXs) this.drawCommandColumn(ctx, x);
	} else if (this.state === 'singularity_windup' || this.state === 'singularity') {
	  const active = this.state === 'singularity';
	  const radius = active
		? 52 + Math.sin(this.animTimer * 10) * 7
		: 18 + (1 - this.stateTimer / 0.95) * 34;
	  ctx.fillStyle = '#10051b';
	  ctx.strokeStyle = active ? '#ef74ff' : '#ba68c8';
	  ctx.lineWidth = 6;
	  ctx.shadowColor = '#d94cff';
	  ctx.shadowBlur = 20;
	  ctx.beginPath();
	  ctx.arc(this.x, this.y - 86, radius, 0, Math.PI * 2);
	  ctx.fill();
	  ctx.stroke();
	  ctx.shadowBlur = 0;
	  ctx.strokeStyle = 'rgba(239, 116, 255, 0.65)';
	  ctx.lineWidth = 3;
	  for (let ring = 1; ring <= 2; ring++) {
		ctx.beginPath();
		ctx.arc(this.x, this.y - 86, radius + ring * 20, this.animTimer * ring, this.animTimer * ring + Math.PI * 1.4);
		ctx.stroke();
	  }
	} else if (this.state === 'recovery') {
	  const progress = Math.max(0, Math.min(1, this.stateTimer / 0.9));
	  ctx.globalAlpha = 0.5 + Math.sin(this.animTimer * 11) * 0.12;
	  ctx.strokeStyle = '#7dffb3';
	  ctx.fillStyle = '#d9ffe7';
	  ctx.lineWidth = 3;
	  ctx.setLineDash([5, 7]);
	  ctx.beginPath();
	  ctx.ellipse(this.x, this.y, 46 + progress * 12, 9, 0, 0, Math.PI * 2);
	  ctx.stroke();
	  ctx.setLineDash([]);
	  ctx.font = '800 12px monospace';
	  ctx.textAlign = 'center';
	  ctx.fillText('OPEN!', this.x, this.y - 112);
	}
	ctx.restore();
  }
  drawCommandColumn(ctx, x) {
	ctx.save();
	ctx.fillStyle = '#3f2c52';
	ctx.strokeStyle = '#ffb020';
	ctx.lineWidth = 3;
	ctx.shadowColor = '#ff8a00';
	ctx.shadowBlur = 12;
	for (let y = this.y - 32; y > this.y - 310; y -= 34) {
	  ctx.fillRect(x - 30, y - 30, 60, 30);
	  ctx.strokeRect(x - 30, y - 30, 60, 30);
	}
	ctx.restore();
  }
  drawCrown(ctx) {
	const glitch = this.phase === 3 ? Math.sin(this.animTimer * 31) * 2 : 0;
	ctx.save();
	ctx.translate(this.x + glitch, this.y - 98);
	ctx.fillStyle = '#ffd54a';
	ctx.strokeStyle = '#7a4700';
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.moveTo(-19, 10);
	ctx.lineTo(-17, -10);
	ctx.lineTo(-6, 1);
	ctx.lineTo(0, -15);
	ctx.lineTo(7, 1);
	ctx.lineTo(18, -10);
	ctx.lineTo(19, 10);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.restore();
  }
  drawStaff(ctx) {
	let angle = -0.42;
	if (this.state.endsWith('windup')) {
	  const duration = {
		gold_windup: 0.58,
		slam_windup: 0.72,
		volley_windup: 0.62,
		command_windup: 0.78,
		singularity_windup: 0.95
	  }[this.state] || 0.7;
	  const progress = smoothstep(1 - this.stateTimer / duration);
	  angle = -0.42 + (-1.02 + 0.42) * progress;
	}
	if (this.state === 'gold_dash' || this.state === 'command_active' || this.state === 'volley') {
	  const activeDuration = this.state === 'gold_dash' ? 0.24 : (this.state === 'command_active' ? 0.34 : 0.78);
	  const progress = smoothstep(1 - this.stateTimer / activeDuration);
	  angle = -1.02 + (1.14 + 1.02) * progress;
	}
	ctx.save();
	ctx.translate(this.x + this.facing * 14, this.y - 35);
	ctx.scale(this.facing, 1);
	ctx.rotate(angle);
	ctx.strokeStyle = '#b326b8';
	ctx.lineWidth = 8;
	ctx.lineCap = 'round';
	ctx.shadowColor = this.phase === 3 ? '#ef74ff' : '#ff8a00';
	ctx.shadowBlur = 12;
	ctx.beginPath();
	ctx.moveTo(0, 54);
	ctx.lineTo(0, -62);
	ctx.stroke();
	const coreColor = this.phase === 1 ? '#ffd34d' : (this.phase === 2 ? '#ff8a00' : '#d94cff');
	ctx.fillStyle = coreColor;
	ctx.strokeStyle = '#fff4c2';
	ctx.lineWidth = 2;
	ctx.fillRect(-13, -82, 26, 26);
	ctx.strokeRect(-13, -82, 26, 26);
	ctx.shadowBlur = 0;
	ctx.strokeStyle = 'rgba(60, 26, 70, 0.8)';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(-13, -69); ctx.lineTo(13, -69);
	ctx.moveTo(0, -82); ctx.lineTo(0, -56);
	ctx.stroke();
	ctx.restore();
  }
  drawReplayGlitches(ctx) {
	const intensity = this.phase * 0.65;
	ctx.save();
	ctx.globalAlpha = 0.28;
	for (let i = 0; i < this.phase + 1; i++) {
	  const wave = Math.sin(this.animTimer * (9 + i * 2) + i * 2.1);
	  ctx.fillStyle = i % 2 === 0 ? '#ff9a32' : '#d94cff';
	  ctx.fillRect(this.x + wave * 26 - 12, this.y - 72 + i * 19, 24 + intensity * 7, 3);
	}
	ctx.restore();
  }
}
function smoothstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}
