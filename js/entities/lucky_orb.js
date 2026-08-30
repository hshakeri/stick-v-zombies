import { particles } from '../engine/particles.js?v=9.3';
import { audio } from '../engine/audio.js?v=9.3';
import { speech } from '../engine/speech.js?v=9.3';
import { combat } from '../systems/combat.js?v=9.3';
const LEFT = -980;
const RIGHT = 980;
const GOLD = '#ffd43b';
const ORANGE = '#ff8a22';
const CYAN = '#35e6ff';
const MAGENTA = '#ef5cff';
const ATTACK_ORDER = Object.freeze(['roll', 'drop']);
const PHASE_TWO_ORDER = Object.freeze(['roll', 'drop', 'roll']);
const ROLL_HOP_COUNT = 3;
const ROLL_HOP_HEIGHT = 150;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (value) => {
	const t = clamp(value, 0, 1);
	return t * t * (3 - 2 * t);
};
function canHitPlayer(player) {
	return Boolean(player && !player.isDead && !player.isRolling
		&& !player.isAwakened && (player.iFrames || 0) <= 0);
}
export class LuckyOrb {
	constructor(x, y) {
		Object.assign(this, {
			x, y, vx: 0, vy: 0, groundY: y,
			type: 'lucky_orb', name: 'THE LUCKY ORB', hookClass: 'anchor',
			speechOffsetY: -108, bannerOffsetY: -145,
			isBoss: true, isDead: false, isGrounded: true, isHurt: false, isAwakened: false,
			maxHp: 1220, hp: 1220, radius: 46, height: 118, color: GOLD,
			inkReward: 470, scoreReward: 8200,
			phase: 1, state: 'idle', stateTimer: 0, stateDuration: 0,
			actionCooldown: 1.05, attackIndex: 0, attackHit: false,
			animTimer: 0, hurtTimer: 0, freezeTimer: 0, stunTimer: 0, facing: -1,
			rollStartX: x, rollTargetX: x, rollDirection: -1,
			dropResolved: false, camera: null
		});
		this.dropXs = new Float32Array(3);
		this.friendlyHits = new Set();
		this.friendlyTargets = [];
	}
	update(dt, groundY, player, sketchBlocks, camera, platforms = [], enemies = [], friendlyTargets = []) {
		if (this.isDead) return;
		const safeDt = clamp(Number(dt) || 0, 0, 0.05);
		this.animTimer += safeDt;
		this.groundY = groundY;
		this.camera = camera || this.camera;
		this.friendlyTargets = friendlyTargets;
		if (this.phase === 1 && this.hp <= this.maxHp * 0.5) this.beginPhaseTwo(camera);
		this.hurtTimer = Math.max(0, this.hurtTimer - safeDt);
		this.isHurt = this.hurtTimer > 0;
		this.freezeTimer = Math.max(0, this.freezeTimer - safeDt);
		this.stunTimer = Math.max(0, this.stunTimer - safeDt);
		const stepDt = safeDt * (this.freezeTimer > 0 ? 0.72 : 1);
		if (this.stunTimer > 0 && this.state !== 'phase_shift') this.vx = 0;
		else this.updateAI(stepDt, player, camera);
		this.applyPhysics(stepDt, groundY);
	}
	beginPhaseTwo(camera) {
		this.phase = 2;
		this.isAwakened = true;
		this.state = 'phase_shift';
		this.stateDuration = this.stateTimer = 0.82;
		this.vx = 0;
		audio.playAwakening();
		camera?.addShake?.(0.42);
		camera?.addZoomPunch?.(0.05);
		particles.addShockwave(this.x, this.y - 62, 205, MAGENTA, 11);
		particles.addTextBanner(this.x, this.y - 132, 'ODDS: WILD!', MAGENTA);
		speech.shoutBoss(this.x, this.y, 'luckyOrb', 'phase', 1.55, {
			anchor: this, speakerKey: 'luckyOrb:phase', cooldownMs: 0
		});
	}
	updateAI(dt, player, camera) {
		if (!player || player.isDead) {
			this.vx *= Math.pow(0.02, dt * 10);
			return;
		}
		const dx = player.x - this.x;
		if (this.state === 'idle' || this.state === 'recovery') this.facing = dx >= 0 ? 1 : -1;
		switch (this.state) {
			case 'idle':
				this.actionCooldown -= dt;
				if (Math.abs(dx) > 360) this.vx = this.facing * 78;
				else this.vx *= Math.pow(0.025, dt * 10);
				if (this.actionCooldown <= 0) this.chooseAttack(player, camera);
				break;
			case 'phase_shift':
				this.stateTimer -= dt;
				this.vx = 0;
				if (this.stateTimer <= 0) this.recover(0.72);
				break;
			case 'roll_windup':
				this.stateTimer -= dt;
				this.vx = 0;
				if (this.stateTimer <= 0) this.launchRoll(camera);
				break;
			case 'roll_active': {
				this.stateTimer -= dt;
				const progress = clamp(1 - this.stateTimer / this.stateDuration, 0, 1);
				const span = this.rollTargetX - this.rollStartX;
				this.x = this.rollStartX + span * progress;
				const arc = Math.abs(Math.sin(progress * Math.PI * ROLL_HOP_COUNT));
				this.y = this.groundY - ROLL_HOP_HEIGHT * arc;
				const hopIndex = Math.min(ROLL_HOP_COUNT - 1, Math.floor(progress * ROLL_HOP_COUNT));
				if (hopIndex !== this.rollHopIndex) {
					this.rollHopIndex = hopIndex;
					const landingX = this.rollStartX + span * (hopIndex / ROLL_HOP_COUNT);
					particles.emitImpact({
						x: landingX, y: this.groundY - 12, profile: 'light', color: GOLD,
						shockwave: false, seed: 0x10cc + this.attackIndex * 7 + hopIndex
					});
					camera?.addShake?.(0.1);
					this.resolveHopLanding(landingX, player);
				}
				if (this.stateTimer <= 0) {
					this.x = this.rollTargetX;
					this.y = this.groundY;
					particles.emitImpact({
						x: this.x, y: this.groundY - 18, profile: 'medium', color: GOLD,
						shockwave: false, seed: 0x10cc + this.attackIndex
					});
					camera?.addShake?.(0.15);
					this.resolveHopLanding(this.rollTargetX, player);
					this.recover(this.phase === 2 ? 0.54 : 0.68);
				}
				break;
			}
			case 'drop_windup':
				this.stateTimer -= dt;
				this.vx = 0;
				if (this.stateTimer <= 0) {
					this.state = 'drop_active';
					this.stateDuration = this.stateTimer = 0.38;
					this.dropResolved = false;
					audio.playAnvilHit();
				}
				break;
			case 'drop_active':
				this.stateTimer -= dt;
				this.vx = 0;
				if (!this.dropResolved && this.stateTimer <= 0.09) this.resolveDrops(player, camera);
				if (this.stateTimer <= 0) this.recover(this.phase === 2 ? 0.62 : 0.76);
				break;
			case 'recovery':
				this.stateTimer -= dt;
				this.vx *= Math.pow(0.02, dt * 10);
				if (this.stateTimer <= 0) {
					this.state = 'idle';
					this.actionCooldown = this.phase === 2 ? 0.3 : 0.44;
				}
				break;
			default:
				this.state = 'idle';
				this.actionCooldown = 0.6;
		}
	}
	chooseAttack(player, camera) {
		const order = this.phase === 2 ? PHASE_TWO_ORDER : ATTACK_ORDER;
		const attack = order[this.attackIndex % order.length];
		this.attackIndex++;
		if (attack === 'drop') this.startDrops(player, camera);
		else this.startRoll(player, camera);
	}
	startRoll(player, camera) {
		this.state = 'roll_windup';
		this.stateDuration = this.stateTimer = this.phase === 2 ? 0.56 : 0.68;
		this.rollStartX = this.x;
		this.rollDirection = player.x >= this.x ? 1 : -1;
		this.facing = this.rollDirection;
		this.rollTargetX = clamp(player.x + this.rollDirection * 250, LEFT + 55, RIGHT - 55);
		if (Math.abs(this.rollTargetX - this.x) < 260) {
			this.rollTargetX = clamp(player.x - this.rollDirection * 355, LEFT + 55, RIGHT - 55);
			this.rollDirection = Math.sign(this.rollTargetX - this.x) || -this.rollDirection;
			this.facing = this.rollDirection;
		}
		this.attackHit = false;
		this.friendlyHits.clear();
		speech.shoutBoss(this.x, this.y, 'luckyOrb', 'roll', 1.35, {
			anchor: this, speakerKey: 'luckyOrb', cooldownMs: 2800
		});
	}
	launchRoll(camera) {
		this.state = 'roll_active';
		this.stateDuration = this.stateTimer = this.phase === 2 ? 0.42 : 0.52;
		this.rollStartX = this.x;
		this.rollHopIndex = 0;
		audio.playDodge();
		particles.triggerSpeedlines({
			x: (this.rollStartX + this.rollTargetX) * 0.5,
			y: this.groundY - 55,
			duration: 0.24,
			count: 18,
			seed: (0x0b8b ^ this.attackIndex ^ Math.trunc(this.rollStartX)) >>> 0
		});
		camera?.addShake?.(0.18);
	}
	startDrops(player, camera) {
		this.state = 'drop_windup';
		this.stateDuration = this.stateTimer = this.phase === 2 ? 0.7 : 0.82;
		const predicted = clamp(player.x + clamp(player.vx || 0, -260, 260) * 0.2, LEFT + 75, RIGHT - 75);
		this.dropXs[0] = predicted;
		this.dropXs[1] = clamp(predicted - 155, LEFT + 55, RIGHT - 55);
		this.dropXs[2] = clamp(predicted + 155, LEFT + 55, RIGHT - 55);
		this.dropResolved = false;
		this.friendlyHits.clear();
		audio.playDoomLaserCharge();
		speech.shoutBoss(this.x, this.y, 'luckyOrb', 'drop', 1.35, {
			anchor: this, speakerKey: 'luckyOrb', cooldownMs: 2800
		});
		camera?.focusOn?.(predicted, this.groundY - 125, 0.5, 0.95);
	}
	resolveHopLanding(landingX, player) {
		const hitTest = (target) => Math.abs(target.x - landingX) < this.radius + (target.radius || 20) + 12
			&& Math.abs(target.y - this.groundY) < 74;
		if (!this.attackHit && canHitPlayer(player) && hitTest(player)) {
			this.attackHit = true;
			player.takeDamage(this.phase === 2 ? 27 : 23, this.rollDirection, 500);
			particles.createHitSparks(player.x, player.y - 30, 8, GOLD);
		}
		this.hitAllies(hitTest, this.phase === 2 ? 27 : 23, this.rollDirection);
	}
	resolveDrops(player, camera) {
		this.dropResolved = true;
		const radius = 58;
		const grounded = (target) => Math.abs(target.y - this.groundY) < 72;
		for (let i = 0; i < this.dropXs.length; i++) {
			const x = this.dropXs[i];
			const color = i === 0 ? MAGENTA : ORANGE;
			particles.emitImpact({
				x, y: this.groundY - 10, profile: 'medium', color,
				arc: false, seed: 0x1a2b + this.attackIndex * 3 + i
			});
			particles.addShockwave(x, this.groundY - 10, 82, color, 7);
		}
		if (canHitPlayer(player) && grounded(player)) {
			for (const x of this.dropXs) {
				if (Math.abs(player.x - x) < radius + (player.radius || 20)) {
					player.takeDamage(this.phase === 2 ? 25 : 21, player.x >= x ? 1 : -1, 430);
					break;
				}
			}
		}
		this.hitAllies((ally) => {
			if (!grounded(ally)) return false;
			for (const x of this.dropXs) if (Math.abs(ally.x - x) < radius + (ally.radius || 18)) return true;
			return false;
		}, this.phase === 2 ? 25 : 21);
		audio.playBruteStomp();
		camera?.addShake?.(0.28);
	}
	hitAllies(test, damage, fixedDirection = 0) {
		for (const ally of this.friendlyTargets || []) {
			if (!ally || ally.isDead || ally.retreating || ally.isTargetable !== true
					|| this.friendlyHits.has(ally) || !test(ally)) continue;
			this.friendlyHits.add(ally);
			ally.takeDamage(damage, fixedDirection || (ally.x >= this.x ? 1 : -1), 430);
		}
	}
	recover(duration) {
		this.state = 'recovery';
		this.stateDuration = this.stateTimer = duration;
		this.vx = 0;
	}
	applyPhysics(dt, groundY) {
		if (this.state !== 'roll_active') {
			this.x += this.vx * dt;
			this.y = groundY;
		}
		this.vy = 0;
		this.isGrounded = true;
		this.x = clamp(this.x, LEFT, RIGHT);
	}
	applyFreeze(duration = 4) {
		if (this.isDead) return false;
		this.freezeTimer = Math.max(this.freezeTimer, Math.min(0.78, Math.max(0, duration) * 0.19));
		return true;
	}
	applyStun(duration = 3) {
		if (this.isDead) return false;
		this.stunTimer = Math.max(this.stunTimer, Math.min(0.46, Math.max(0, duration) * 0.15));
		return true;
	}
	takeDamage(amount, knockbackDir = 1, knockbackPower = 200, isCrit = false) {
		if (this.isDead || !Number.isFinite(amount) || amount <= 0) return 0;
		const applied = Math.min(this.hp, amount);
		this.hp -= applied;
		this.hurtTimer = 0.13;
		this.isHurt = true;
		if (this.state === 'idle' || this.state === 'recovery') {
			this.vx = knockbackDir * Math.min(92, Math.max(0, knockbackPower) * 0.2);
		}
		particles.addDamageText(this.x, this.y - 98, applied, isCrit, this.phase === 2 ? MAGENTA : ORANGE);
		particles.createHitSparks(this.x, this.y - 62, 6, this.phase === 2 ? MAGENTA : GOLD);
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
		audio.playBossVictoryFanfare();
		audio.playFinisherImpact();
		speech.shoutBoss(this.x, this.y, 'luckyOrb', 'defeat', 1.8, {
			anchor: this, speakerKey: 'luckyOrb:defeat', cooldownMs: 0
		});
		this.camera?.addShake?.(0.72);
		this.camera?.addZoomPunch?.(0.075);
		particles.emitBossExplosion({
			x: this.x, y: this.y - 62, bodyY: this.y, groundY: this.groundY,
			color: GOLD, accent: CYAN, radius: 265,
			stickFigure: false, seed: 0x10cc70
		});
	}
	draw(ctx) {
		if (this.isDead) return;
		this.drawTelegraph(ctx);
		const rolling = this.state === 'roll_active';
		const bob = Math.sin(this.animTimer * 3.6) * 5;
		const cy = this.y - 72 + bob;
		if (rolling) {
			ctx.save();
			ctx.fillStyle = GOLD;
			for (let i = 3; i > 0; i--) {
				ctx.globalAlpha = 0.07 * i;
				ctx.beginPath();
				ctx.ellipse(this.x - this.rollDirection * i * 24, cy, 28 - i * 3, 12, 0, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
		}
		ctx.save();
		ctx.globalAlpha = 0.2;
		ctx.fillStyle = '#000000';
		ctx.beginPath();
		ctx.ellipse(this.x, this.groundY - 3, rolling ? 66 : 48, 9, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
		ctx.save();
		ctx.translate(this.x, cy);
		const charge = this.state === 'roll_windup' ? 1 - this.stateTimer / this.stateDuration : 0;
		const phasePulse = this.state === 'phase_shift' ? 1 + Math.sin(this.animTimer * 22) * 0.1 : 1;
		ctx.scale((rolling ? 1.26 : 1 - charge * 0.16) * phasePulse,
			(rolling ? 0.8 : 1 + charge * 0.1) * phasePulse);
		ctx.rotate(rolling ? 0 : Math.sin(this.animTimer * 1.4) * 0.035);
		for (let i = -1; i <= 1; i++) {
			if (this.phase === 1 && i) continue;
			ctx.save();
			ctx.globalAlpha = this.phase === 2 ? (i ? 0.42 : 0.58) : 0.38;
			ctx.rotate(i * (this.state === 'drop_windup' ? 0.62 : 0.42));
			ctx.fillStyle = '#6f3500'; ctx.fillRect(-4, -48, 8, 116);
			ctx.fillStyle = GOLD; ctx.fillRect(-1, -47, 3, 114);
			ctx.translate(0, -58);
			ctx.rotate(this.animTimer * 2.6);
			this.drawPrize(ctx, 0, 0, 3, 10);
			ctx.restore();
		}
		this.drawFragments(ctx, false);
		ctx.save();
		ctx.rotate(this.animTimer * 0.18);
		ctx.strokeStyle = this.state === 'phase_shift' ? MAGENTA : '#fff2b0';
		ctx.lineWidth = 4;
		for (let i = 0; i < 6; i++) {
			const angle = i * Math.PI / 3;
			const inner = 44;
			const outer = 57 + (i % 2) * 7 + Math.sin(this.animTimer * 5 + i) * 2;
			ctx.beginPath();
			ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
			ctx.lineTo(Math.cos(angle + 0.1) * outer, Math.sin(angle + 0.1) * outer);
			ctx.stroke();
		}
		ctx.restore();
		const cageOpen = this.state === 'phase_shift' ? 9 : charge * 7;
		for (let i = 0; i < 4; i++) {
			const angle = Math.PI / 4 + i * Math.PI / 2 + Math.sin(this.animTimer * 0.8) * 0.025;
			const distance = 45 + cageOpen;
			ctx.save();
			ctx.translate(Math.cos(angle) * distance, Math.sin(angle) * distance);
			ctx.rotate(angle + Math.PI / 4);
			ctx.fillStyle = i % 2 ? ORANGE : GOLD;
			ctx.strokeStyle = this.state === 'phase_shift' ? MAGENTA : '#754100';
			ctx.lineWidth = 3;
			ctx.fillRect(-12, -10, 24, 20); ctx.strokeRect(-12, -10, 24, 20);
			ctx.fillStyle = '#fff1a8'; ctx.fillRect(-8, -6, 7, 6);
			ctx.restore();
		}
		ctx.globalAlpha = this.isHurt ? 0.95 : 0.2;
		ctx.fillStyle = this.isHurt ? '#ffffff' : GOLD;
		ctx.beginPath(); ctx.arc(0, 0, 43, 0, Math.PI * 2); ctx.fill();
		ctx.globalAlpha = 1;
		ctx.fillStyle = this.isHurt ? '#ffffff' : '#ffe895';
		ctx.beginPath(); ctx.arc(0, 0, 31, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#fff9da';
		ctx.beginPath(); ctx.arc(-2, -3, 22, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.beginPath(); ctx.arc(-4, -5, 14, 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
		ctx.beginPath(); ctx.moveTo(-29, 0); ctx.lineTo(-17, 0); ctx.moveTo(17, 0); ctx.lineTo(29, 0); ctx.stroke();
		this.drawFragments(ctx, true);
		ctx.restore();
	}
	drawTelegraph(ctx) {
		const pulse = 0.62 + Math.sin(this.animTimer * 18) * 0.18;
		ctx.save();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = "900 16px 'Bungee',Impact,sans-serif";
		if (this.state === 'roll_windup') {
			const span = this.rollTargetX - this.x;
			ctx.strokeStyle = ORANGE;
			ctx.globalAlpha = pulse * 0.8;
			ctx.lineWidth = 3;
			ctx.setLineDash([9, 8]);
			for (let i = 0; i < ROLL_HOP_COUNT; i++) {
				const fromX = this.x + span * (i / ROLL_HOP_COUNT);
				const toX = this.x + span * ((i + 1) / ROLL_HOP_COUNT);
				const midX = (fromX + toX) * 0.5;
				ctx.beginPath();
				ctx.moveTo(fromX, this.groundY - 8);
				ctx.quadraticCurveTo(midX, this.groundY - ROLL_HOP_HEIGHT, toX, this.groundY - 8);
				ctx.stroke();
			}
			ctx.setLineDash([]);
			ctx.lineWidth = 4;
			for (let i = 1; i <= ROLL_HOP_COUNT; i++) {
				const x = this.x + span * (i / ROLL_HOP_COUNT);
				ctx.globalAlpha = pulse;
				ctx.fillStyle = 'rgba(255,138,34,0.18)';
				ctx.beginPath();
				ctx.ellipse(x, this.groundY, 62, 13, 0, 0, Math.PI * 2);
				ctx.fill(); ctx.stroke();
				ctx.beginPath(); ctx.ellipse(x, this.groundY, 33, 7, 0, 0, Math.PI * 2); ctx.stroke();
			}
			ctx.fillStyle = '#ffffff';
			ctx.fillText('LUCKY BOUNCE!', (this.x + this.rollTargetX) * 0.5, this.groundY - 43);
		} else if (this.state === 'drop_windup' || this.state === 'drop_active') {
			const active = this.state === 'drop_active';
			const progress = active ? 1 - this.stateTimer / this.stateDuration : 0;
			for (let i = 0; i < this.dropXs.length; i++) {
				const x = this.dropXs[i];
				ctx.globalAlpha = active ? 1 : pulse;
				ctx.strokeStyle = i === 0 ? MAGENTA : ORANGE;
				ctx.fillStyle = i === 0 ? 'rgba(239,92,255,0.18)' : 'rgba(255,138,34,0.16)';
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.ellipse(x, this.groundY, 58, 13, 0, 0, Math.PI * 2);
				ctx.fill(); ctx.stroke();
				ctx.beginPath(); ctx.ellipse(x, this.groundY, 31, 7, 0, 0, Math.PI * 2); ctx.stroke();
				if (active) this.drawPrize(ctx, x, this.groundY - 290 + smoothstep(progress) * 260, i);
			}
			if (!active) {
				ctx.fillStyle = '#ffffff';
				ctx.fillText('PRIZE DROP!', this.dropXs[0], this.groundY - 54);
			}
		}
		ctx.restore();
	}
	drawFragments(ctx, front) {
		ctx.save();
		ctx.font = "900 10px 'Bungee', Impact, sans-serif";
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (let i = 0; i < 3; i++) {
			const angle = this.animTimer * 1.25 + i * Math.PI * 2 / 3;
			const depth = Math.sin(angle);
			if ((depth >= 0) !== front) continue;
			const scale = 0.78 + (depth + 1) * 0.14;
			ctx.save();
			ctx.translate(Math.cos(angle) * 75, depth * 29);
			ctx.scale(scale, scale);
			this.drawPrize(ctx, 0, 0, 3, 10);
			ctx.restore();
		}
		ctx.restore();
	}
	drawPrize(ctx, x, y, index, size = 17) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(this.animTimer * (index % 2 ? -2.6 : 2.6));
		ctx.lineWidth = 4;
		if (index === 0) {
			ctx.fillStyle = '#55dfff'; ctx.strokeStyle = '#15465b';
			ctx.beginPath(); ctx.arc(0, 3, size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.fillStyle = '#fff'; ctx.fillRect(-5, -size - 6, 10, 9);
		} else if (index === 1) {
			ctx.fillStyle = '#687080'; ctx.strokeStyle = '#242833';
			ctx.fillRect(-size, -5, size * 2, 14); ctx.strokeRect(-size, -5, size * 2, 14);
			ctx.fillRect(-size - 5, -size, size * 2 + 10, 8);
		} else {
			ctx.fillStyle = index === 2 ? '#ef4b3f' : GOLD;
			ctx.strokeStyle = index === 2 ? '#651512' : '#754100';
			ctx.fillRect(-size, -size, size * 2, size * 2); ctx.strokeRect(-size, -size, size * 2, size * 2);
			ctx.fillStyle = index === 2 ? '#fff4df' : '#4a2600';
			ctx.font = `900 ${Math.round(size * 1.3)}px 'Bungee', Impact, sans-serif`;
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText(index === 2 ? 'T' : '?', 0, 1);
		}
		ctx.restore();
	}
}
