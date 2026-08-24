import { particles } from '../engine/particles.js?v=8.5';
import { audio } from '../engine/audio.js?v=8.5';
import { speech } from '../engine/speech.js?v=8.5';
import { combat } from '../systems/combat.js?v=8.5';

const LEFT = -980;
const RIGHT = 980;
const GOLD = '#ffd43b';
const ORANGE = '#ff8a22';
const CYAN = '#35e6ff';
const MAGENTA = '#ef5cff';
const ATTACK_ORDER = Object.freeze(['roll', 'drop']);
const PHASE_TWO_ORDER = Object.freeze(['roll', 'drop', 'roll']);
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
				const previousX = this.x;
				const progress = 1 - this.stateTimer / this.stateDuration;
				this.x = this.rollStartX + (this.rollTargetX - this.rollStartX) * smoothstep(progress);
				this.resolveRollHits(player, previousX);
				if (this.stateTimer <= 0) {
					this.x = this.rollTargetX;
					particles.emitImpact({
						x: this.x, y: this.groundY - 18, profile: 'medium', color: GOLD,
						shockwave: false, seed: 0x10cc + this.attackIndex
					});
					camera?.addShake?.(0.15);
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
		speech.shoutBoss(this.x, this.y, 'luckyOrb', 'roll', 1.35, { anchor: this });
	}

	launchRoll(camera) {
		this.state = 'roll_active';
		this.stateDuration = this.stateTimer = this.phase === 2 ? 0.28 : 0.34;
		this.rollStartX = this.x;
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
		speech.shoutBoss(this.x, this.y, 'luckyOrb', 'drop', 1.35, { anchor: this });
		camera?.focusOn?.(predicted, this.groundY - 125, 0.5, 0.95);
	}

	resolveRollHits(player, previousX) {
		const hitTest = (target) => {
			const closestX = clamp(target.x, Math.min(previousX, this.x), Math.max(previousX, this.x));
			const centerY = target.y - (target.height || 60) * 0.5;
			return Math.abs(target.x - closestX) < this.radius + (target.radius || 20)
				&& Math.abs(centerY - (this.y - 58)) < 74;
		};
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
		if (this.state !== 'roll_active') this.x += this.vx * dt;
		this.y = groundY;
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
		speech.shoutBoss(this.x, this.y, 'luckyOrb', 'defeat', 1.8, {
			anchor: this, speakerKey: 'luckyOrb:defeat', cooldownMs: 0
		});
		this.camera?.addShake?.(0.72);
		this.camera?.addZoomPunch?.(0.075);
		particles.emitImpact({
			x: this.x, y: this.y - 62, profile: 'heavy', color: GOLD,
			arc: false, shockwaveColor: MAGENTA, shockwaveRadius: 225,
			shockwaveThickness: 14, boss: true, seed: 0x10cc70
		});
		particles.addTextBanner(this.x, this.y - 128, '★ ORB SENT HOME! ★', CYAN);
	}

	draw(ctx) {
		if (this.isDead) return;
		this.drawTelegraph(ctx);
		const bob = Math.sin(this.animTimer * 3.6) * 4;
		const cy = this.y - 64 + bob;
		ctx.save();
		ctx.translate(this.x, cy);
		ctx.rotate(this.state === 'roll_active'
			? this.rollDirection * (1 - this.stateTimer / this.stateDuration) * Math.PI * 5
			: Math.sin(this.animTimer * 1.4) * 0.07);
		ctx.globalAlpha = this.isHurt ? 0.72 : 1;
		ctx.strokeStyle = this.phase === 2 ? MAGENTA : '#8b4d00';
		ctx.fillStyle = this.isHurt ? '#ffffff' : GOLD;
		ctx.lineWidth = 8;
		ctx.beginPath();
		ctx.arc(0, 0, 46, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#181220';
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 4;
		ctx.fillRect(-20, -22, 40, 44);
		ctx.strokeRect(-20, -22, 40, 44);
		ctx.fillStyle = '#ffffff';
		ctx.font = "900 34px 'Arial Black', Impact, sans-serif";
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('?', 0, 0);
		ctx.restore();
		this.drawOrbiters(ctx, cy);
	}

	drawTelegraph(ctx) {
		const pulse = 0.62 + Math.sin(this.animTimer * 18) * 0.18;
		ctx.save();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = "900 16px 'Arial Black', Impact, sans-serif";
		if (this.state === 'roll_windup') {
			ctx.globalAlpha = pulse;
			ctx.strokeStyle = ORANGE;
			ctx.lineWidth = 5;
			ctx.setLineDash([13, 8]);
			ctx.strokeRect(Math.min(this.x, this.rollTargetX) - 48, this.groundY - 112,
				Math.abs(this.rollTargetX - this.x) + 96, 116);
			ctx.fillStyle = '#ffffff';
			ctx.fillText('ROLL!', (this.x + this.rollTargetX) * 0.5, this.groundY - 128);
		} else if (this.state === 'drop_windup' || this.state === 'drop_active') {
			const active = this.state === 'drop_active';
			const progress = active ? 1 - this.stateTimer / this.stateDuration : 0;
			for (let i = 0; i < this.dropXs.length; i++) {
				const x = this.dropXs[i];
				ctx.globalAlpha = active ? 1 : pulse;
				ctx.strokeStyle = i === 0 ? MAGENTA : ORANGE;
				ctx.lineWidth = 4;
				ctx.setLineDash(active ? [] : [9, 7]);
				ctx.beginPath();
				ctx.ellipse(x, this.groundY, 58, 13, 0, 0, Math.PI * 2);
				ctx.stroke();
				if (active) this.drawPrize(ctx, x, this.groundY - 290 + smoothstep(progress) * 260, i);
			}
			if (!active) {
				ctx.fillStyle = '#ffffff';
				ctx.fillText('PRIZE DROP!', this.dropXs[0], this.groundY - 54);
			}
		}
		ctx.restore();
	}

	drawOrbiters(ctx, y) {
		ctx.save();
		ctx.translate(this.x, y);
		ctx.lineWidth = 2;
		for (let i = 0; i < 2; i++) {
			ctx.strokeStyle = i ? MAGENTA : CYAN;
			ctx.beginPath();
			ctx.ellipse(0, 0, 61 + i * 7, 19 + i * 3,
				this.animTimer * (i ? -1.2 : 1.5) + i * Math.PI * 0.5, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.font = '900 10px Impact, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (let i = 0; i < 3; i++) {
			const angle = this.animTimer * 1.25 + i * Math.PI * 2 / 3;
			const x = Math.cos(angle) * 72;
			const cubeY = Math.sin(angle) * 27;
			ctx.fillStyle = i === 0 ? MAGENTA : GOLD;
			ctx.fillRect(x - 7, cubeY - 7, 14, 14);
			ctx.fillStyle = '#181220';
			ctx.fillText('?', x, cubeY);
		}
		ctx.restore();
	}

	drawPrize(ctx, x, y, index) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(this.animTimer * (index % 2 ? -2.6 : 2.6));
		ctx.fillStyle = index === 0 ? MAGENTA : GOLD;
		ctx.strokeStyle = '#25172b';
		ctx.lineWidth = 5;
		ctx.fillRect(-17, -17, 34, 34);
		ctx.strokeRect(-17, -17, 34, 34);
		ctx.fillStyle = '#ffffff';
		ctx.font = "900 23px 'Arial Black', Impact, sans-serif";
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('?', 0, 0);
		ctx.restore();
	}
}
