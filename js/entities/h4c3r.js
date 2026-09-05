import { StickFigureRenderer } from './stickman.js?v=9.8';
import { particles } from '../engine/particles.js?v=9.8';
import { audio } from '../engine/audio.js?v=9.8';
import { projectiles } from './projectiles.js?v=9.8';
import { combat } from '../systems/combat.js?v=9.8';
import { speech } from '../engine/speech.js?v=9.8';
import { stages } from '../systems/stages.js?v=9.8';
const ARENA_MIN_X = -980;
const ARENA_MAX_X = 980;
const CYAN = '#00f5ff';
const LIME = '#8cff00';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const smoothstep = (amount) => {
  const t = clamp(amount, 0, 1);
  return t * t * (3 - 2 * t);
};
export class H4C3R {
  constructor(x, y) {
	this.x = x;
	this.y = y;
	this.vx = 0;
	this.vy = 0;
	this.type = 'h4c3r';
	this.name = 'H4C3R';
	this.isBoss = true;
	this.maxHp = 1350;
	this.hp = this.maxHp;
	this.speed = 155;
	this.radius = 30;
	this.height = 76;
	this.color = '#89939c';
	this.strokeWidth = 6;
	this.scale = 1.28;
	this.facing = -1;
	this.pose = 'idle';
	this.animTimer = 0;
	this.isDead = false;
	this.isHurt = false;
	this.hurtTimer = 0;
	this.isGrounded = true;
	this.isAwakened = false;
	this.phase = 1;
	this.state = 'idle';
	this.stateTimer = 0;
	this.stateDuration = 0;
	this.actionCooldown = 1.15;
	this.attackIndex = 0;
	this.attackHit = false;
	this.freezeTimer = 0;
	this.stunTimer = 0;
	this.dashStartX = x;
	this.dashTargetX = x;
	this.dashDirection = -1;
	this.safeGapX = 0;
	this.safeGapHalf = 145;
	this.beamY = y - 30;
	this.auraTimer = 0;
	this.groundY = y;
	this.camera = null;
	this.friendlyHits = [];
	this.inkReward = 500;
	this.scoreReward = 9000;
	this.renderer = new StickFigureRenderer(this.color, this.strokeWidth, this.scale, true);
	this.renderer.glowColor = CYAN;
  }
  update(dt, groundY, player, sketchBlocks, camera, platforms = [], enemies = [], friendlyTargets = []) {
	if (this.isDead) return;
	const safeDt = clamp(Number(dt) || 0, 0, 0.05);
	this.animTimer += safeDt;
	this.groundY = groundY;
	this.platforms = platforms;
	this.camera = camera || this.camera;
	this.friendlyTargets = friendlyTargets;
	if (this.phase === 1 && this.hp <= this.maxHp * 0.55) {
	  this.beginPhaseTwo(camera);
	}
	if (this.hurtTimer > 0) {
	  this.hurtTimer -= safeDt;
	  if (this.hurtTimer <= 0) this.isHurt = false;
	}
	if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - safeDt);
	this.chatterTimer = (this.chatterTimer ?? 5) - safeDt;
	if (this.chatterTimer <= 0 && this.state === 'idle') {
	  this.sayCorpus('default', 1.3);
	  this.chatterTimer = 7 + Math.random() * 4;
	}
	this.auraTimer -= safeDt;
	if ((this.isAwakened || this.isTelegraphing()) && this.auraTimer <= 0) {
	  this.auraTimer = this.isAwakened ? 0.1 : 0.16;
	  particles.createHitSparks(
		this.x + (Math.random() - 0.5) * 34,
		this.y - 40 + (Math.random() - 0.5) * 52,
		1,
		this.isAwakened ? LIME : CYAN
	  );
	}
	const timeScale = this.freezeTimer > 0 ? (this.phase === 2 ? 0.68 : 0.56) : 1;
	const stepDt = safeDt * timeScale;
	if (this.stunTimer > 0 && this.state !== 'phase_shift') {
	  this.stunTimer = Math.max(0, this.stunTimer - safeDt);
	  this.pose = 'hurt';
	  this.vx = 0;
	} else {
	  this.updateAI(stepDt, player, camera);
	}
	this.applyPhysics(stepDt, groundY);
  }
  beginPhaseTwo(camera) {
	this.phase = 2;
	this.isAwakened = true;
	this.state = 'phase_shift';
	this.stateTimer = 0.9;
	this.stateDuration = 0.9;
	this.attackHit = false;
	this.vx = 0;
	this.clearOwnedProjectiles();
	audio.playBossRoar();
	audio.setIntensity(1);
	camera?.addShake?.(0.65);
	camera?.addZoomPunch?.(0.075);
	camera?.focusOn?.(this.x, this.y - 75, 0.75, 1.06);
	particles.addShockwave(this.x, this.y - 34, 220, CYAN, 12);
	particles.addTextBanner(this.x, this.y - 105, 'FIREWALL: OFFLINE', LIME);
	this.sayCorpus('phase', 1.55);
	stages.beginWhiteVoid?.();
	audio.setWhiteVoid?.(true);
  }
  updateAI(dt, player, camera) {
	if (!player || player.isDead) {
	  this.pose = 'idle';
	  this.vx *= Math.pow(0.04, dt * 10);
	  return;
	}
	const dx = player.x - this.x;
	if (this.state === 'idle' || this.state === 'recover') this.facing = dx >= 0 ? 1 : -1;
	if (this.actionCooldown > 0) this.actionCooldown -= dt;
	switch (this.state) {
	  case 'idle': {
		this.pose = Math.abs(this.vx) > 20 ? 'run' : 'idle';
		if (Math.abs(dx) > 310 && this.actionCooldown > 0.25) {
		  this.vx = this.facing * this.speed * 0.45;
		} else {
		  this.vx *= Math.pow(0.025, dt * 10);
		}
		if (this.actionCooldown <= 0) this.chooseNextAttack(player, camera);
		break;
	  }
	  case 'phase_shift': {
		this.stateTimer -= dt;
		this.pose = 'awakening_god';
		this.vx = 0;
		if (this.stateTimer <= 0) this.startRecovery(0.78);
		break;
	  }
	  case 'packet_telegraph': {
		this.stateTimer -= dt;
		this.pose = 'crouch';
		this.vx = 0;
		this.facing = this.dashDirection;
		if (this.stateTimer <= 0) this.launchPacketDash(camera);
		break;
	  }
	  case 'packet_dash': {
		this.stateTimer -= dt;
		this.pose = 'run';
		const progress = 1 - this.stateTimer / this.stateDuration;
		const previousX = this.x;
		this.x = lerp(this.dashStartX, this.dashTargetX, smoothstep(progress));
		this.resolveDashHit(player, previousX);
		if (this.stateTimer <= 0) {
		  this.x = this.dashTargetX;
		  particles.addShockwave(this.x, this.y - 30, 85, CYAN, 6);
		  camera?.addShake?.(0.16);
		  this.startRecovery(this.phase === 2 ? 0.62 : 0.78);
		}
		break;
	  }
	  case 'bracket_telegraph': {
		this.stateTimer -= dt;
		this.pose = 'awakening_god';
		this.vx = 0;
		if (this.stateTimer <= 0) {
		  this.state = 'bracket_wall';
		  this.stateDuration = this.stateTimer = 0.2;
		  this.attackHit = false;
		  this.friendlyHits.length = 0;
		  audio.playLaserZap();
		  camera?.addShake?.(0.28);
		  camera?.addZoomPunch?.(0.035);
		}
		break;
	  }
	  case 'bracket_wall': {
		this.stateTimer -= dt;
		this.pose = 'awakening_god';
		this.vx = 0;
		this.resolveBracketHit(player);
		if (this.stateTimer <= 0) this.startRecovery(this.phase === 2 ? 0.72 : 0.88);
		break;
	  }
	  case 'terminal_telegraph': {
		this.stateTimer -= dt;
		this.pose = 'awakening_god';
		this.vx = 0;
		if (this.stateTimer <= 0) {
		  this.state = 'terminal_beam';
		  this.stateDuration = this.stateTimer = 0.32;
		  this.attackHit = false;
		  this.friendlyHits.length = 0;
		  audio.playDoomLaserFire();
		  camera?.addShake?.(0.34);
		  camera?.addZoomPunch?.(0.055);
		}
		break;
	  }
	  case 'terminal_beam': {
		this.stateTimer -= dt;
		this.pose = 'awakening_god';
		this.vx = 0;
		this.resolveBeamHit(player);
		if (this.stateTimer <= 0) this.startRecovery(0.92);
		break;
	  }
	  case 'recover': {
		this.stateTimer -= dt;
		this.pose = 'crouch';
		this.vx *= Math.pow(0.02, dt * 10);
		if (this.stateTimer <= 0) {
		  this.state = 'idle';
		  this.actionCooldown = this.phase === 2 ? 0.3 : 0.42;
		}
		break;
	  }
	  default:
		this.state = 'idle';
		this.actionCooldown = 0.6;
	}
  }
  chooseNextAttack(player, camera) {
	const phaseOneOrder = ['packet', 'bracket', 'packet'];
	const phaseTwoOrder = ['terminal', 'packet', 'bracket'];
	const order = this.phase === 2 ? phaseTwoOrder : phaseOneOrder;
	const attack = order[this.attackIndex % order.length];
	this.attackIndex++;
	if (attack === 'terminal') this.startTerminalBeam(player, camera);
	else if (attack === 'bracket') this.startBracketWall(player, camera);
	else this.startPacketDash(player, camera);
  }
  startPacketDash(player, camera) {
	const dx = player.x - this.x;
	const direction = dx === 0 ? (this.facing || 1) : Math.sign(dx);
	this.state = 'packet_telegraph';
	this.stateDuration = this.stateTimer = this.phase === 2 ? 0.52 : 0.62;
	this.dashStartX = this.x;
	this.dashDirection = direction;
	this.facing = direction;
	this.dashTargetX = clamp(player.x + direction * 245, ARENA_MIN_X + 45, ARENA_MAX_X - 45);
	if (Math.abs(this.dashTargetX - this.dashStartX) < 230) {
	  this.dashTargetX = clamp(player.x - direction * 330, ARENA_MIN_X + 45, ARENA_MAX_X - 45);
	  this.dashDirection = Math.sign(this.dashTargetX - this.dashStartX) || -direction;
	  this.facing = this.dashDirection;
	}
	this.vx = 0;
	this.attackHit = false;
	audio.playTeleportZap();
	camera?.addZoomPunch?.(-0.025);
	this.sayCorpus('select');
  }
  launchPacketDash(camera) {
	this.state = 'packet_dash';
	this.stateDuration = this.stateTimer = this.phase === 2 ? 0.23 : 0.28;
	this.dashStartX = this.x;
	this.attackHit = false;
	audio.playTeleportZap();
	particles.triggerSpeedlines({
	  x: (this.dashStartX + this.dashTargetX) * 0.5,
	  y: this.y - 34,
	  duration: 0.28,
	  lineCount: 18,
	  seed: (Math.trunc(this.dashStartX) ^ Math.trunc(this.dashTargetX) ^ this.attackIndex) >>> 0
	});
	camera?.addShake?.(0.2);
	camera?.addZoomPunch?.(0.035);
  }
  startBracketWall(player, camera) {
	this.state = 'bracket_telegraph';
	this.stateDuration = this.stateTimer = this.phase === 2 ? 0.72 : 0.86;
	this.safeGapHalf = this.phase === 2 ? 125 : 150;
	const predictedX = player.x + clamp(player.vx || 0, -240, 240) * 0.22;
	this.safeGapX = clamp(predictedX, ARENA_MIN_X + this.safeGapHalf + 50, ARENA_MAX_X - this.safeGapHalf - 50);
	this.attackHit = false;
	this.vx = 0;
	audio.playDoomLaserCharge();
	camera?.addZoomPunch?.(-0.055);
	camera?.focusOn?.(this.safeGapX, this.groundY - 115, 0.5, 0.91);
	this.sayEvent('FIND THE GAP.', 'bracket');
  }
  startTerminalBeam(player, camera) {
	this.state = 'terminal_telegraph';
	this.stateDuration = this.stateTimer = 0.9;
	this.facing = player.x >= this.x ? 1 : -1;
	this.beamY = clamp(player.y - 30, this.groundY - 165, this.groundY - 22);
	this.attackHit = false;
	this.vx = 0;
	audio.playDoomLaserCharge();
	camera?.focusOn?.((this.x + player.x) * 0.5, this.groundY - 105, 0.58, 0.94);
	camera?.addZoomPunch?.(-0.035);
	this.sayCorpus('root');
  }
  sayEvent(text, eventKey) {
	speech.spawnBubble(this.x, this.y, text, 'h4c3r', 1.35, {
	  anchor: this,
	  priority: 4,
	  speakerKey: 'h4c3r',
	  eventKey,
	  cooldownMs: 1400
	});
  }
  sayCorpus(eventName, duration = 1.35) {
	speech.shoutBoss(this.x, this.y, 'h4c3r', eventName, duration, {
	  anchor: this,
	  speakerKey: 'h4c3r',
	  repeatKey: `h4c3r:${eventName}`,
	  cooldownMs: 1400
	});
  }
  startRecovery(duration) {
	this.state = 'recover';
	this.stateTimer = this.stateDuration = duration;
	this.attackHit = false;
	this.vx = 0;
  }
  resolveDashHit(player, previousX = this.x) {
	if (this.attackHit || !this.canHitPlayer(player)) return;
	const closestX = clamp(player.x, Math.min(previousX, this.x), Math.max(previousX, this.x));
	const dx = player.x - closestX;
	const dy = (player.y - 30) - (this.y - 34);
	if (Math.abs(dx) < 72 && Math.abs(dy) < 78) {
	  this.attackHit = true;
	  player.takeDamage(this.phase === 2 ? 25 : 21, this.dashDirection, 460);
	  particles.createHitSparks(player.x, player.y - 30, 9, CYAN);
	}
  }
  resolveBracketHit(player) {
	if (this.attackHit) return;
	this.attackHit = true;
	if (this.canHitPlayer(player) && Math.abs(player.x - this.safeGapX) > this.safeGapHalf) {
	  const direction = player.x < this.safeGapX ? -1 : 1;
	  player.takeDamage(this.phase === 2 ? 29 : 24, direction, 390);
	  particles.createHitSparks(player.x, player.y - 35, 10, CYAN);
	}
	for (const ally of this.friendlyTargets || []) {
	  if (!ally || ally.isDead || ally.retreating || ally.isTargetable !== true) continue;
	  if (Math.abs(ally.x - this.safeGapX) > this.safeGapHalf) {
		ally.takeDamage(this.phase === 2 ? 29 : 24, ally.x < this.safeGapX ? -1 : 1, 390);
	  }
	}
  }
  resolveBeamHit(player) {
	if (!this.attackHit && this.canHitPlayer(player)) {
	  const playerCenterY = player.y - 30;
	  const isAhead = this.facing > 0 ? player.x >= this.x - 24 : player.x <= this.x + 24;
	  if (isAhead && Math.abs(playerCenterY - this.beamY) < 38) {
		this.attackHit = true;
		player.takeDamage(32, this.facing, 500);
		particles.createHitSparks(player.x, this.beamY, 12, CYAN);
	  }
	}
	for (const ally of this.friendlyTargets || []) {
	  if (!ally || ally.isDead || ally.retreating || ally.isTargetable !== true || this.friendlyHits.includes(ally)) continue;
	  const centerY = ally.y - (ally.height || 60) * 0.5;
	  const ahead = this.facing > 0 ? ally.x >= this.x - 24 : ally.x <= this.x + 24;
	  if (!ahead || Math.abs(centerY - this.beamY) >= 38) continue;
	  this.friendlyHits.push(ally);
	  ally.takeDamage(32, this.facing, 500);
	}
  }
  canHitPlayer(player) {
	return Boolean(player && !player.isDead && !player.isRolling && !player.isAwakened && (player.iFrames || 0) <= 0);
  }
  applyPhysics(dt, groundY) {
	const dashIsPositionDriven = this.state === 'packet_dash';
	if (!dashIsPositionDriven) this.x += this.vx * dt;
	this.vy += 950 * dt;
	this.y += this.vy * dt;
	if (this.y >= groundY) {
	  this.y = groundY;
	  this.vy = 0;
	  this.isGrounded = true;
	} else {
	  this.isGrounded = false;
	}
	this.x = clamp(this.x, ARENA_MIN_X, ARENA_MAX_X);
  }
  applyFreeze(duration = 4) {
	if (this.isDead) return false;
	const resistance = this.phase === 2 ? 0.14 : 0.2;
	this.freezeTimer = Math.max(this.freezeTimer, Math.min(0.9, Math.max(0, duration) * resistance));
	return true;
  }
  applyStun(duration = 3) {
	if (this.isDead) return false;
	const resistance = this.phase === 2 ? 0.12 : 0.17;
	this.stunTimer = Math.max(this.stunTimer, Math.min(0.58, Math.max(0, duration) * resistance));
	return true;
  }
  takeDamage(amount, knockbackDir = 1, knockbackPower = 200, isCrit = false) {
	if (this.isDead || !Number.isFinite(amount) || amount <= 0) return 0;
	const applied = Math.min(this.hp, amount);
	this.hp -= applied;
	this.isHurt = true;
	this.hurtTimer = 0.12;
	if (this.state === 'idle' || this.state === 'recover') {
	  this.vx = knockbackDir * Math.min(95, Math.max(0, knockbackPower) * 0.22);
	}
	particles.addDamageText(this.x, this.y - this.height * 0.8, applied, isCrit, CYAN);
	particles.createHitSparks(this.x, this.y - this.height * 0.52, 6, this.phase === 2 ? LIME : CYAN);
	if (this.hp <= 0) this.die();
	return applied;
  }
  clearOwnedProjectiles() {
	projectiles.clearByOwner(this);
  }
  die() {
	if (this.isDead) return;
	this.isDead = true;
	this.hp = 0;
	this.state = 'defeated';
	this.clearOwnedProjectiles();
	combat.registerKill(this);
	stages.endWhiteVoid?.();
	audio.setWhiteVoid?.(false);
	audio.playBossVictoryFanfare();
	audio.playFinisherImpact();
	speech.shoutBoss(this.x, this.y, 'h4c3r', 'defeat', 1.8, {
	  anchor: this, speakerKey: 'h4c3r', repeatKey: 'h4c3r:defeat', cooldownMs: 0
	});
	this.camera?.addShake?.(0.85);
	this.camera?.addZoomPunch?.(0.09);
	particles.emitBossExplosion({
	  x: this.x, y: this.y - 42, bodyY: this.y, groundY: this.groundY,
	  color: CYAN, accent: LIME, radius: 280,
	  stickFigure: true, seed: 0x48344352
	});
  }
  isTelegraphing() {
	return this.state === 'packet_telegraph'
	  || this.state === 'bracket_telegraph'
	  || this.state === 'terminal_telegraph';
  }
  draw(ctx) {
	if (this.isDead) return;
	const voidInk = (stages.whiteVoidProgress || 0) > 0.6;
	this.renderer.color = voidInk ? '#16181d' : this.color;
	this.renderer.glowColor = voidInk ? null : CYAN;
	this.drawAttackLayer(ctx);
	this.drawDashDecoys(ctx);
	this.renderer.draw(ctx, {
	  x: this.x,
	  y: this.y,
	  facing: this.facing,
	  pose: this.pose === 'hurt' ? 'idle' : this.pose,
	  animTimer: this.animTimer,
	  isGrounded: this.isGrounded,
	  isHurt: this.isHurt || this.stunTimer > 0,
	  isAwakened: false,
	  weaponType: null,
	  scale: 1,
	  alpha: 1
	});
	this.drawFaceHud(ctx, this.x, this.y, 1);
	this.drawSelectionBox(ctx, this.x, this.y - 40, 72, 96, this.isTelegraphing() ? 0.9 : 0.36);
  }
  drawDashDecoys(ctx) {
	if (this.state !== 'packet_dash') return;
	const direction = this.dashDirection || this.facing;
	for (let i = 2; i >= 1; i--) {
	  const alpha = 0.24 / i;
	  const x = this.x - direction * i * 58;
	  this.renderer.draw(ctx, {
		x,
		y: this.y,
		facing: this.facing,
		pose: 'run',
		animTimer: this.animTimer - i * 0.04,
		isGrounded: true,
		isHurt: false,
		isAwakened: false,
		weaponType: null,
		scale: 1,
		alpha
	  });
	}
  }
  drawAttackLayer(ctx) {
	if (this.state === 'packet_telegraph') this.drawPacketTelegraph(ctx);
	if (this.state === 'bracket_telegraph' || this.state === 'bracket_wall') this.drawBracketWall(ctx);
	if (this.state === 'terminal_telegraph' || this.state === 'terminal_beam') this.drawTerminalBeam(ctx);
	if (this.state === 'recover') this.drawRecoveryCue(ctx);
  }
  drawRecoveryCue(ctx) {
	const progress = Math.max(0, Math.min(1, this.stateTimer / 0.92));
	const pulse = 0.58 + Math.sin(this.animTimer * 12) * 0.12;
	ctx.save();
	ctx.globalAlpha = pulse;
	ctx.strokeStyle = LIME;
	ctx.fillStyle = '#dfffc2';
	ctx.lineWidth = 3;
	ctx.setLineDash([5, 7]);
	ctx.beginPath();
	ctx.ellipse(this.x, this.groundY, 48 + progress * 12, 9, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.font = '800 12px monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('PUNISH_', this.x, this.y - 114);
	ctx.restore();
  }
  drawPacketTelegraph(ctx) {
	const pulse = 0.55 + Math.sin(this.animTimer * 18) * 0.2;
	ctx.save();
	ctx.globalAlpha = pulse;
	ctx.strokeStyle = CYAN;
	ctx.lineWidth = 3;
	ctx.setLineDash([12, 9]);
	ctx.beginPath();
	ctx.moveTo(this.x, this.y - 32);
	ctx.lineTo(this.dashTargetX, this.y - 32);
	ctx.stroke();
	ctx.setLineDash([]);
	this.drawSelectionBox(ctx, this.dashTargetX, this.y - 34, 70, 92, 1);
	ctx.restore();
  }
  drawBracketWall(ctx) {
	const isActive = this.state === 'bracket_wall';
	const leftEdge = this.safeGapX - this.safeGapHalf;
	const rightEdge = this.safeGapX + this.safeGapHalf;
	const top = this.groundY - 310;
	const bottom = this.groundY + 8;
	const pulse = 0.52 + Math.sin(this.animTimer * 16) * 0.18;
	ctx.save();
	ctx.globalAlpha = isActive ? 0.28 : pulse * 0.16;
	ctx.fillStyle = CYAN;
	ctx.fillRect(ARENA_MIN_X, top, Math.max(0, leftEdge - ARENA_MIN_X), bottom - top);
	ctx.fillRect(rightEdge, top, Math.max(0, ARENA_MAX_X - rightEdge), bottom - top);
	ctx.globalAlpha = isActive ? 1 : pulse;
	ctx.strokeStyle = isActive ? '#ffffff' : CYAN;
	ctx.lineWidth = isActive ? 9 : 5;
	this.drawBracket(ctx, leftEdge, top, bottom, -1);
	this.drawBracket(ctx, rightEdge, top, bottom, 1);
	ctx.fillStyle = LIME;
	ctx.font = '700 18px monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('SAFE', this.safeGapX, top + 42);
	ctx.strokeStyle = LIME;
	ctx.lineWidth = 2;
	ctx.setLineDash([7, 7]);
	ctx.strokeRect(leftEdge + 10, top + 14, this.safeGapHalf * 2 - 20, bottom - top - 28);
	ctx.restore();
  }
  drawBracket(ctx, x, top, bottom, side) {
	ctx.beginPath();
	ctx.moveTo(x + side * 28, top);
	ctx.lineTo(x, top);
	ctx.lineTo(x, bottom);
	ctx.lineTo(x + side * 28, bottom);
	ctx.stroke();
  }
  drawTerminalBeam(ctx) {
	const active = this.state === 'terminal_beam';
	const beamEnd = this.facing > 0 ? ARENA_MAX_X + 80 : ARENA_MIN_X - 80;
	const pulse = 0.55 + Math.sin(this.animTimer * 20) * 0.25;
	const terminalX = this.x + this.facing * 42;
	const terminalY = this.y - 126;
	ctx.save();
	ctx.strokeStyle = CYAN;
	ctx.fillStyle = 'rgba(0, 20, 26, 0.88)';
	ctx.lineWidth = 3;
	ctx.fillRect(terminalX - 54, terminalY - 24, 108, 48);
	ctx.strokeRect(terminalX - 54, terminalY - 24, 108, 48);
	ctx.fillStyle = LIME;
	ctx.font = '700 12px monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(active ? '> EXECUTE_' : '> AIMING_', terminalX, terminalY);
	ctx.globalAlpha = active ? 1 : pulse;
	ctx.strokeStyle = active ? '#ffffff' : CYAN;
	ctx.shadowColor = CYAN;
	ctx.shadowBlur = active ? 24 : 10;
	ctx.lineWidth = active ? 28 : 3;
	ctx.setLineDash(active ? [] : [13, 10]);
	ctx.beginPath();
	ctx.moveTo(this.x + this.facing * 24, this.beamY);
	ctx.lineTo(beamEnd, this.beamY);
	ctx.stroke();
	if (active) {
	  ctx.strokeStyle = CYAN;
	  ctx.lineWidth = 12;
	  ctx.stroke();
	  ctx.strokeStyle = '#ffffff';
	  ctx.lineWidth = 4;
	  ctx.stroke();
	}
	ctx.restore();
  }
  drawFaceHud(ctx, x, y, alpha) {
	const headY = y - 79;
	const eyeX = x + this.facing * 6;
	const scan = Math.sin(this.animTimer * 7) * 5;
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = CYAN;
	ctx.fillStyle = this.isAwakened ? LIME : CYAN;
	ctx.shadowColor = CYAN;
	ctx.shadowBlur = 9;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(eyeX - 8, headY);
	ctx.lineTo(eyeX + 8, headY);
	ctx.moveTo(eyeX, headY - 8);
	ctx.lineTo(eyeX, headY + 8);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(eyeX, headY, 3, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha *= 0.45;
	ctx.beginPath();
	ctx.moveTo(x - 18, headY + scan);
	ctx.lineTo(x + 18, headY + scan);
	ctx.stroke();
	ctx.restore();
  }
  drawSelectionBox(ctx, x, y, width, height, alpha = 0.5) {
	const halfW = width * 0.5;
	const halfH = height * 0.5;
	const corner = 13;
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = CYAN;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(x - halfW, y - halfH + corner); ctx.lineTo(x - halfW, y - halfH); ctx.lineTo(x - halfW + corner, y - halfH);
	ctx.moveTo(x + halfW - corner, y - halfH); ctx.lineTo(x + halfW, y - halfH); ctx.lineTo(x + halfW, y - halfH + corner);
	ctx.moveTo(x + halfW, y + halfH - corner); ctx.lineTo(x + halfW, y + halfH); ctx.lineTo(x + halfW - corner, y + halfH);
	ctx.moveTo(x - halfW + corner, y + halfH); ctx.lineTo(x - halfW, y + halfH); ctx.lineTo(x - halfW, y + halfH - corner);
	ctx.stroke();
	ctx.restore();
  }
}
