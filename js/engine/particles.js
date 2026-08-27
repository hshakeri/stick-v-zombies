export const IMPACT_PROFILES = Object.freeze({
  light: Object.freeze({
	sparks: 4,
	arcRadius: 0,
	arcThickness: 0,
	shockwaveRadius: 0,
	shockwaveThickness: 0,
	hitstop: 0.012,
	shake: 0.08,
	zoomPunch: 0.01
  }),
  medium: Object.freeze({
	sparks: 8,
	arcRadius: 68,
	arcThickness: 5.5,
	shockwaveRadius: 0,
	shockwaveThickness: 0,
	hitstop: 0.025,
	shake: 0.18,
	zoomPunch: 0.025
  }),
  heavy: Object.freeze({
	sparks: 14,
	arcRadius: 98,
	arcThickness: 8,
	shockwaveRadius: 160,
	shockwaveThickness: 10,
	hitstop: 0.05,
	shake: 0.42,
	zoomPunch: 0.05
  })
});
export const SPLATTER_LIMITS = Object.freeze({ droplets: 48, stains: 12 });
const CRIMSON_SPLATTER_COLORS = Object.freeze(['#d11f3f', '#a70f32', '#741329']);
export class ParticleSystem {
  constructor() {
	this.particles = [];
	this.damageTexts = [];
	this.slashArcs = [];
	this.shockwaves = [];
	this.comicPopups = [];
	this.limbDebris = [];
	this.splatterDroplets = [];
	this.splatterStains = [];
	this.splatterEnabled = true;
	this.speedlinesTimer = 0;
	this.speedlinesMax = 0;
	this.speedlineEffect = null;
	this.speedlineSequence = 0;
	this.normalParticleBudget = 320;
	this.lowParticleBudget = 220;
	this.loadProfile = 'auto';
	this.maxParticles = this.normalParticleBudget;
	this.maxSlashArcs = 12;
	this.maxShockwaves = 8;
	this.maxComicPopups = 6;
	this.maxDamageTexts = 25;
	this.maxLimbDebris = 24;
	this.maxSplatterDroplets = SPLATTER_LIMITS.droplets;
	this.maxSplatterStains = SPLATTER_LIMITS.stains;
  }
  reset() {
	this.particles.length = 0;
	this.damageTexts.length = 0;
	this.slashArcs.length = 0;
	this.shockwaves.length = 0;
	this.comicPopups.length = 0;
	this.limbDebris.length = 0;
	this.splatterDroplets.length = 0;
	this.splatterStains.length = 0;
	this.speedlinesTimer = 0;
	this.speedlinesMax = 0;
	this.speedlineEffect = null;
	this.speedlineSequence = 0;
  }
  setSplatterEnabled(enabled = true) {
	this.splatterEnabled = Boolean(enabled);
	if (!this.splatterEnabled) {
	  this.splatterDroplets.length = 0;
	  this.splatterStains.length = 0;
	}
	return this.splatterEnabled;
  }
  setReducedEffects(enabled = false) {
	this.reducedEffects = Boolean(enabled);
	if (this.reducedEffects) {
	  this.speedlinesTimer = 0;
	  this.speedlineEffect = null;
	}
	return this.reducedEffects;
  }
  setLoadProfile(profile = 'normal') {
	if (profile === 'auto') {
	  this.loadProfile = 'auto';
	  return this.maxParticles;
	}
	const lowLoadBudget = profile === true || profile === 'low' || profile === 'constrained';
	this.loadProfile = lowLoadBudget ? 'low' : 'normal';
	this.maxParticles = lowLoadBudget ? this.lowParticleBudget : this.normalParticleBudget;
	trimOldest(this.particles, this.maxParticles);
	return this.maxParticles;
  }
  triggerSpeedlines(options = 0.25) {
	if (this.reducedEffects) return null;
	const config = typeof options === 'object' && options !== null
	  ? options
	  : { duration: options };
	const duration = clamp(Number(config.duration) || 0.25, 0.05, 0.3);
	const boss = config.boss === true || config.profile === 'boss';
	const maxLines = boss ? 24 : 18;
	const lineCount = Math.round(clamp(Number(config.lineCount ?? config.count) || maxLines, 8, maxLines));
	const x = Number.isFinite(config.x) ? config.x : 0;
	const y = Number.isFinite(config.y) ? config.y : 0;
	const centerDist = clamp(Number(config.centerDist) || (boss ? 205 : 180), 60, 360);
	const outerDist = clamp(
	  Number(config.outerDist) || (boss ? 920 : 760),
	  centerDist + 100,
	  1100
	);
	const suppliedSeed = Number.isFinite(config.seed) ? Math.trunc(config.seed) : null;
	const seed = suppliedSeed ?? hashSpeedlineSeed(x, y, this.speedlineSequence++);
	const random = seededRandom(seed);
	const angles = [];
	for (let i = 0; i < lineCount; i++) {
	  angles.push((i / lineCount) * Math.PI * 2 + (random() - 0.5) * 0.075);
	}
	this.speedlinesTimer = duration;
	this.speedlinesMax = duration;
	this.speedlineEffect = { x, y, centerDist, outerDist, angles, boss, seed };
	return this.speedlineEffect;
  }
  update(dt) {
	if (this.speedlinesTimer > 0) {
	  this.speedlinesTimer -= dt;
	}
	for (let i = this.particles.length - 1; i >= 0; i--) {
	  const p = this.particles[i];
	  p.life -= dt;
	  if (p.life <= 0) {
		this.particles.splice(i, 1);
		continue;
	  }
	  p.x += p.vx * dt;
	  p.y += p.vy * dt;
	  if (p.gravity) p.vy += p.gravity * dt;
	  if (p.drag) {
		p.vx *= Math.pow(p.drag, dt * 60);
		p.vy *= Math.pow(p.drag, dt * 60);
	  }
	  if (p.rotSpeed) p.rotation += p.rotSpeed * dt;
	}
	if (!this.splatterEnabled) {
	  this.splatterDroplets.length = 0;
	  this.splatterStains.length = 0;
	} else {
	  for (let i = this.splatterDroplets.length - 1; i >= 0; i--) {
		const droplet = this.splatterDroplets[i];
		droplet.life -= dt;
		if (droplet.life <= 0) {
		  this.splatterDroplets.splice(i, 1);
		  continue;
		}
		droplet.x += droplet.vx * dt;
		droplet.y += droplet.vy * dt;
		if (!droplet.landed) {
		  droplet.vy += droplet.gravity * dt;
		  if (droplet.y >= droplet.groundY) {
			droplet.y = droplet.groundY;
			droplet.vx *= 0.12;
			droplet.vy = 0;
			droplet.landed = true;
			droplet.life = Math.min(droplet.life, 0.12);
		  }
		}
	  }
	  for (let i = this.splatterStains.length - 1; i >= 0; i--) {
		const stain = this.splatterStains[i];
		stain.life -= dt;
		if (stain.life <= 0) {
		  this.splatterStains.splice(i, 1);
		}
	  }
	}
	for (let i = this.limbDebris.length - 1; i >= 0; i--) {
	  const limb = this.limbDebris[i];
	  limb.life -= dt;
	  if (limb.life <= 0) {
		this.limbDebris.splice(i, 1);
		continue;
	  }
	  limb.vy += 950 * dt;
	  limb.x += limb.vx * dt;
	  limb.y += limb.vy * dt;
	  limb.rotation += limb.rotSpeed * dt;
	  if (limb.y >= limb.groundY) {
		limb.y = limb.groundY;
		limb.vy = -limb.vy * 0.45;
		limb.vx *= 0.75;
	  }
	}
	for (let i = this.comicPopups.length - 1; i >= 0; i--) {
	  const c = this.comicPopups[i];
	  c.life -= dt;
	  if (c.life <= 0) {
		this.comicPopups.splice(i, 1);
		continue;
	  }
	  c.x += c.vx * dt;
	  c.y += c.vy * dt;
	  c.rotation += c.rotSpeed * dt;
	  if (c.scale < 1.0) c.scale = Math.min(1.0, c.scale + dt * 12);
	}
	for (let i = this.damageTexts.length - 1; i >= 0; i--) {
	  const t = this.damageTexts[i];
	  t.life -= dt;
	  if (t.life <= 0) {
		this.damageTexts.splice(i, 1);
		continue;
	  }
	  t.x += t.vx * dt;
	  t.y += t.vy * dt;
	  t.vy += 80 * dt;
	}
	for (let i = this.slashArcs.length - 1; i >= 0; i--) {
	  const arc = this.slashArcs[i];
	  arc.life -= dt;
	  if (arc.life <= 0) {
		this.slashArcs.splice(i, 1);
	  }
	}
	for (let i = this.shockwaves.length - 1; i >= 0; i--) {
	  const sw = this.shockwaves[i];
	  sw.life -= dt;
	  if (sw.life <= 0) {
		this.shockwaves.splice(i, 1);
		continue;
	  }
	  sw.radius += sw.growSpeed * dt;
	}
	if (this.particles.length > this.maxParticles) {
	  this.particles.splice(0, this.particles.length - this.maxParticles);
	}
	trimOldest(this.slashArcs, this.maxSlashArcs);
	trimOldest(this.shockwaves, this.maxShockwaves);
	trimOldest(this.comicPopups, this.maxComicPopups);
	trimOldest(this.damageTexts, this.maxDamageTexts);
	trimOldest(this.limbDebris, this.maxLimbDebris);
  }
  draw(ctx) {
	if (this.splatterEnabled && this.splatterStains.length > 0) {
	  ctx.save();
	  for (const stain of this.splatterStains) {
		const progress = 1 - stain.life / stain.maxLife;
		const appear = Math.min(1, progress * 10);
		ctx.globalAlpha = 0.48 * appear * Math.min(1, stain.life * 2.5);
		ctx.fillStyle = stain.color;
		ctx.beginPath();
		ctx.ellipse(stain.x, stain.y, stain.rx * appear, stain.ry * appear, 0, 0, Math.PI * 2);
		ctx.fill();
	  }
	  ctx.restore();
	}
	for (const sw of this.shockwaves) {
	  const progress = 1 - sw.life / sw.maxLife;
	  const alpha = (1 - progress) * (sw.maxAlpha || 0.8);
	  ctx.save();
	  ctx.beginPath();
	  ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
	  ctx.strokeStyle = sw.color;
	  ctx.globalAlpha = alpha;
	  ctx.lineWidth = sw.thickness * (1 - progress);
	  ctx.stroke();
	  ctx.restore();
	}
	for (const arc of this.slashArcs) {
	  const progress = 1 - arc.life / arc.maxLife;
	  const alpha = 1 - progress;
	  ctx.save();
	  ctx.translate(arc.x, arc.y);
	  ctx.rotate(arc.angle);
	  ctx.scale(arc.facing, 1);
	  ctx.beginPath();
	  ctx.arc(0, 0, arc.radius, -arc.arcAngle / 2, arc.arcAngle / 2);
	  ctx.strokeStyle = arc.color;
	  ctx.globalAlpha = alpha;
	  ctx.lineWidth = arc.thickness * (1 - progress * 0.5);
	  ctx.lineCap = 'round';
	  ctx.stroke();
	  ctx.restore();
	}
	for (const p of this.particles) {
	  const progress = 1 - p.life / p.maxLife;
	  const alpha = p.fade ? (1 - progress) * p.initialAlpha : p.initialAlpha;
	  ctx.save();
	  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
	  ctx.translate(p.x, p.y);
	  if (p.rotation) ctx.rotate(p.rotation);
	  if (p.type === 'spark' || p.type === 'star') {
		ctx.fillStyle = p.color;
		const size = Math.max(1, p.size * (1 - progress * 0.4));
		ctx.beginPath();
		ctx.moveTo(0, -size);
		ctx.lineTo(size * 0.3, -size * 0.3);
		ctx.lineTo(size, 0);
		ctx.lineTo(size * 0.3, size * 0.3);
		ctx.lineTo(0, size);
		ctx.lineTo(-size * 0.3, size * 0.3);
		ctx.lineTo(-size, 0);
		ctx.lineTo(-size * 0.3, -size * 0.3);
		ctx.closePath();
		ctx.fill();
	  } else if (p.type === 'line') {
		ctx.strokeStyle = p.color;
		ctx.lineWidth = p.lineWidth || 2;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(-p.vx * 0.04, -p.vy * 0.04);
		ctx.stroke();
	  } else if (p.type === 'ink') {
		ctx.fillStyle = p.color;
		ctx.beginPath();
		ctx.arc(0, 0, p.size * (1 - progress * 0.2), 0, Math.PI * 2);
		ctx.fill();
	  } else if (p.type === 'dust') {
		ctx.fillStyle = p.color || '#a0a5ba';
		ctx.beginPath();
		ctx.arc(0, 0, p.size * (1 + progress * 0.8), 0, Math.PI * 2);
		ctx.fill();
	  } else if (p.type === 'aura') {
		ctx.fillStyle = p.color;
		ctx.beginPath();
		ctx.arc(0, 0, p.size * (1 - progress), 0, Math.PI * 2);
		ctx.fill();
	  } else {
		ctx.fillStyle = p.color;
		ctx.beginPath();
		ctx.arc(0, 0, p.size, 0, Math.PI * 2);
		ctx.fill();
	  }
	  ctx.restore();
	}
	if (this.splatterEnabled && this.splatterDroplets.length > 0) {
	  ctx.save();
	  for (const droplet of this.splatterDroplets) {
		const lifeRatio = Math.max(0, Math.min(1, droplet.life / droplet.maxLife));
		const size = droplet.size * (0.72 + lifeRatio * 0.28);
		ctx.globalAlpha = 0.9 * Math.min(1, lifeRatio * 3);
		ctx.fillStyle = droplet.color;
		if (droplet.pixel) {
		  ctx.fillRect(droplet.x - size * 0.5, droplet.y - size * 0.5, size, size);
		} else {
		  ctx.beginPath();
		  ctx.moveTo(droplet.x, droplet.y - size);
		  ctx.lineTo(droplet.x + size * 0.72, droplet.y);
		  ctx.lineTo(droplet.x, droplet.y + size);
		  ctx.lineTo(droplet.x - size * 0.72, droplet.y);
		  ctx.closePath();
		  ctx.fill();
		}
	  }
	  ctx.restore();
	}
	for (const limb of this.limbDebris) {
	  const progress = 1 - limb.life / limb.maxLife;
	  const alpha = limb.life < 0.4 ? limb.life / 0.4 : 1.0;
	  ctx.save();
	  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
	  ctx.translate(limb.x, limb.y);
	  ctx.rotate(limb.rotation);
	  ctx.strokeStyle = limb.color;
	  ctx.fillStyle = limb.color;
	  ctx.lineWidth = limb.width || 4;
	  ctx.lineCap = 'round';
	  if (limb.isShard) {
		const size = limb.size || 8;
		ctx.strokeStyle = limb.outline || '#ffffff';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, -size);
		ctx.lineTo(size * 0.82, size * 0.2);
		ctx.lineTo(0, size * 0.62);
		ctx.lineTo(-size * 0.72, size * 0.12);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	  } else if (limb.isHead) {
		ctx.beginPath();
		ctx.arc(0, 0, limb.radius || 9, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
	  } else {
		ctx.beginPath();
		ctx.moveTo(-limb.length / 2, 0);
		ctx.lineTo(limb.length / 2, 0);
		ctx.stroke();
	  }
	  ctx.restore();
	}
	for (const c of this.comicPopups) {
	  const progress = 1 - c.life / c.maxLife;
	  const alpha = c.life < 0.2 ? c.life / 0.2 : 1.0;
	  ctx.save();
	  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
	  ctx.translate(c.x, c.y);
	  ctx.rotate(c.rotation);
	  ctx.scale(c.scale, c.scale);
	  const spikes = 10;
	  const outerR = c.size || 38;
	  const innerR = outerR * 0.55;
	  ctx.fillStyle = c.bgColor || '#ff1744';
	  ctx.strokeStyle = '#000000';
	  ctx.lineWidth = 3;
	  ctx.beginPath();
	  for (let i = 0; i < spikes * 2; i++) {
		const r = i % 2 === 0 ? outerR : innerR;
		const angle = (i * Math.PI) / spikes;
		const px = Math.cos(angle) * r;
		const py = Math.sin(angle) * r;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	  }
	  ctx.closePath();
	  ctx.fill();
	  ctx.stroke();
	  ctx.font = "900 18px 'Bungee', Impact, Haettenschweiler, 'Arial Narrow Bold', 'Arial Black', sans-serif";
	  ctx.textAlign = 'center';
	  ctx.textBaseline = 'middle';
	  ctx.strokeStyle = '#000000';
	  ctx.lineWidth = 5;
	  ctx.strokeText(c.text, 0, 0);
	  ctx.fillStyle = c.textColor || '#ffee00';
	  ctx.fillText(c.text, 0, 0);
	  ctx.restore();
	}
	for (const t of this.damageTexts) {
	  const progress = 1 - t.life / t.maxLife;
	  const alpha = 1 - Math.pow(progress, 2);
	  ctx.save();
	  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
	  ctx.translate(t.x, t.y);
	  const scale = t.isCrit ? Math.max(1, 1.6 - progress * 0.6) : Math.max(0.8, 1.2 - progress * 0.4);
	  ctx.scale(scale, scale);
	  ctx.font = t.isCrit
		? "900 22px 'Bungee', Impact, Haettenschweiler, 'Arial Narrow Bold', 'Arial Black', sans-serif"
		: "bold 16px 'Trebuchet MS', sans-serif";
	  ctx.textAlign = 'center';
	  ctx.textBaseline = 'middle';
	  ctx.strokeStyle = '#000000';
	  ctx.lineWidth = 4;
	  ctx.strokeText(t.text, 0, 0);
	  ctx.fillStyle = t.color;
	  ctx.fillText(t.text, 0, 0);
	  ctx.restore();
	}
	if (this.speedlinesTimer > 0) {
	  const alpha = Math.min(0.65, (this.speedlinesTimer / this.speedlinesMax) * 0.7);
	  const effect = this.speedlineEffect || {
		x: 0,
		y: 0,
		centerDist: 180,
		outerDist: 760,
		angles: DEFAULT_SPEEDLINE_ANGLES
	  };
	  ctx.save();
	  ctx.translate(effect.x, effect.y);
	  ctx.strokeStyle = '#ffffff';
	  ctx.globalAlpha = alpha;
	  ctx.lineWidth = effect.boss ? 2.7 : 2.25;
	  for (const angle of effect.angles) {
		ctx.beginPath();
		ctx.moveTo(Math.cos(angle) * effect.centerDist, Math.sin(angle) * effect.centerDist);
		ctx.lineTo(Math.cos(angle) * effect.outerDist, Math.sin(angle) * effect.outerDist);
		ctx.stroke();
	  }
	  ctx.restore();
	}
  }
  emitImpact(options = {}, legacyX = 0, legacyY = 0, legacyOptions = {}) {
	const config = typeof options === 'string'
	  ? {
		  ...(legacyOptions && typeof legacyOptions === 'object' ? legacyOptions : {}),
		  profile: options,
		  x: legacyX,
		  y: legacyY
		}
	  : (typeof options === 'object' && options !== null ? options : {});
	const profileName = IMPACT_PROFILES[config.profile] ? config.profile : 'light';
	const profile = IMPACT_PROFILES[profileName];
	const x = Number.isFinite(config.x) ? config.x : 0;
	const y = Number.isFinite(config.y) ? config.y : 0;
	const facing = (config.facing ?? config.direction) === -1 ? -1 : 1;
	const color = config.color || '#ffdd44';
	this.createHitSparks(x, y, profile.sparks, color);
	if (config.arc !== false && profile.arcRadius > 0) {
	  this.addSlashArc(
		x,
		y,
		Number(config.arcRadius) || profile.arcRadius,
		Number(config.angle) || 0,
		facing,
		config.arcColor || color,
		Number(config.arcThickness) || profile.arcThickness
	  );
	}
	if (config.shockwave !== false && profile.shockwaveRadius > 0) {
	  this.addShockwave(
		x,
		y,
		Number(config.shockwaveRadius) || profile.shockwaveRadius,
		config.shockwaveColor || color,
		Number(config.shockwaveThickness) || profile.shockwaveThickness
	  );
	}
	if (profileName === 'heavy' && config.speedlines !== false) {
	  this.triggerSpeedlines({
		x,
		y,
		duration: Math.min(0.3, Number(config.duration) || 0.26),
		count: config.boss ? 24 : 18,
		boss: config.boss === true,
		seed: Number.isFinite(config.seed) ? config.seed : undefined
	  });
	}
	return {
	  profile: profileName,
	  sparks: profile.sparks,
	  hitstop: profile.hitstop,
	  shake: profile.shake,
	  zoomPunch: profile.zoomPunch
	};
  }
  emitBossExplosion(options = {}) {
	const x = Number.isFinite(options.x) ? options.x : 0;
	const y = Number.isFinite(options.y) ? options.y : 0;
	const groundY = Number.isFinite(options.groundY) ? options.groundY : y + 60;
	const bodyY = Number.isFinite(options.bodyY) ? options.bodyY : groundY;
	const radius = clamp(Number(options.radius) || 230, 160, 300);
	const color = options.color || '#ff5533';
	const accent = options.accent || '#fff4b0';
	const seed = Number.isFinite(options.seed)
	  ? Math.trunc(options.seed)
	  : hashSpeedlineSeed(x, y, this.speedlineSequence++);
	const random = seededRandom(seed);
	const shardCount = this.reducedEffects ? 6 : 10;
	this.emitImpact({
	  x, y, profile: 'heavy', color: accent, arc: false, boss: true, seed,
	  shockwaveColor: color, shockwaveRadius: radius, shockwaveThickness: 15
	});
	this.addShockwave(x, y, radius * 0.68, accent, 8);
	this.addComicPopup(x, y - 135, 'KABOOM!', color, '#fffbe8');
	if (options.stickFigure) this.createStickLimbExplosion(x, bodyY, groundY, color);
	while (this.limbDebris.length > this.maxLimbDebris - shardCount) this.limbDebris.shift();
	for (let i = 0; i < shardCount; i++) {
	  const angle = (i / shardCount) * Math.PI * 2 + (random() - 0.5) * 0.35;
	  const speed = 180 + random() * 300;
	  const life = 1.15 + random() * 0.5;
	  this.limbDebris.push({
		x: x + (random() - 0.5) * 18,
		y: y + (random() - 0.5) * 18,
		vx: Math.cos(angle) * speed,
		vy: Math.sin(angle) * speed - 190,
		groundY,
		rotation: random() * Math.PI,
		rotSpeed: (random() - 0.5) * 18,
		isShard: true,
		size: 6 + random() * 8,
		color: i % 3 === 0 ? '#ffffff' : (i % 2 ? accent : color),
		outline: color,
		life,
		maxLife: life
	  });
	}
	return { shards: shardCount, stickPieces: options.stickFigure ? 6 : 0, seed };
  }
  configureForCanvas(canvas) {
	if (this.loadProfile !== 'auto') return this.maxParticles;
	const width = Number(canvas?.width);
	const height = Number(canvas?.height);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
	  return this.maxParticles;
	}
	this.maxParticles = width * height >= 7_500_000
	  ? this.lowParticleBudget
	  : this.normalParticleBudget;
	trimOldest(this.particles, this.maxParticles);
	return this.maxParticles;
  }
  createHitSparks(x, y, count = 8, color = '#ffdd44') {
	if (this.reducedEffects) count = Math.max(1, Math.ceil(count / 2));
	for (let i = 0; i < count; i++) {
	  const angle = Math.random() * Math.PI * 2;
	  const speed = 120 + Math.random() * 260;
	  this.particles.push({
		type: 'spark',
		x,
		y,
		vx: Math.cos(angle) * speed,
		vy: Math.sin(angle) * speed,
		size: 5 + Math.random() * 6,
		color,
		life: 0.15 + Math.random() * 0.15,
		maxLife: 0.3,
		initialAlpha: 1.0,
		fade: true,
		rotation: Math.random() * Math.PI,
		rotSpeed: (Math.random() - 0.5) * 15,
		drag: 0.92
	  });
	  this.particles.push({
		type: 'line',
		x,
		y,
		vx: Math.cos(angle) * speed * 1.5,
		vy: Math.sin(angle) * speed * 1.5,
		color: '#ffffff',
		lineWidth: 3,
		life: 0.1,
		maxLife: 0.1,
		initialAlpha: 0.9,
		fade: true
	  });
	}
	trimOldest(this.particles, this.maxParticles);
  }
  createZombieSplatter(x, y, count = 12, color = '#44ee55') {
	for (let i = 0; i < count; i++) {
	  const angle = Math.random() * Math.PI * 2;
	  const speed = 80 + Math.random() * 280;
	  this.particles.push({
		type: 'ink',
		x,
		y,
		vx: Math.cos(angle) * speed,
		vy: Math.sin(angle) * speed - 60,
		gravity: 450,
		size: 3 + Math.random() * 5,
		color,
		life: 0.4 + Math.random() * 0.4,
		maxLife: 0.8,
		initialAlpha: 0.9,
		fade: true,
		drag: 0.96
	  });
	}
	trimOldest(this.particles, this.maxParticles);
  }
  emitSplatter(x, y, options = {}) {
	if (!this.splatterEnabled) return { droplets: 0, stains: 0 };
	const defeat = options.defeat === true || options.profile === 'defeat';
	const dropletCount = Math.round(clamp(Number(options.count ?? (defeat ? 22 : 8)), 0, defeat ? 32 : 16));
	const stainCount = options.stains === false
	  ? 0
	  : Math.round(clamp(Number(options.stains ?? (defeat ? 3 : 1)), 0, defeat ? 4 : 2));
	const groundY = Number.isFinite(options.groundY) ? options.groundY : y + (defeat ? 44 : 36);
	const force = clamp(Number(options.force) || 1, 0.5, 1.75);
	const direction = Number.isFinite(options.direction) ? Math.sign(options.direction) : 0;
	const customColor = typeof options.color === 'string' ? options.color : null;
	const random = Number.isFinite(options.seed)
	  ? seededRandom(Math.trunc(options.seed))
	  : Math.random;
	for (let i = 0; i < dropletCount; i++) {
	  const angle = -Math.PI + random() * Math.PI;
	  const speed = ((defeat ? 145 : 90) + random() * (defeat ? 260 : 150)) * force;
	  const life = (defeat ? 0.42 : 0.3) + random() * (defeat ? 0.34 : 0.24);
	  this.splatterDroplets.push({
		x: x + (random() - 0.5) * (defeat ? 18 : 10),
		y: y + (random() - 0.5) * 8,
		vx: Math.cos(angle) * speed + direction * speed * 0.42,
		vy: Math.sin(angle) * speed - (defeat ? 36 : 18),
		gravity: defeat ? 610 : 560,
		groundY,
		size: (defeat ? 2.8 : 2.2) + random() * (defeat ? 4.5 : 3.1),
		color: customColor || CRIMSON_SPLATTER_COLORS[Math.floor(random() * 3)],
		life,
		maxLife: life,
		pixel: random() < 0.58,
		landed: false
	  });
	}
	trimOldest(this.splatterDroplets, this.maxSplatterDroplets);
	for (let i = 0; i < stainCount; i++) {
	  const life = (defeat ? 1.8 : 1.1) + random() * (defeat ? 0.8 : 0.65);
	  const spread = defeat ? 62 : 34;
	  this.splatterStains.push({
		x: x + (random() - 0.5) * spread + direction * spread * 0.22,
		y: groundY + 1,
		rx: (defeat ? 10 : 7) + random() * (defeat ? 16 : 8),
		ry: 2 + random() * (defeat ? 3 : 2),
		color: customColor || CRIMSON_SPLATTER_COLORS[1 + Math.floor(random() * 2)],
		life,
		maxLife: life
	  });
	}
	trimOldest(this.splatterStains, this.maxSplatterStains);
	return { droplets: dropletCount, stains: stainCount };
  }
  createDust(x, y, count = 5, dir = 0) {
	for (let i = 0; i < count; i++) {
	  const angle = Math.PI + (Math.random() - 0.5) * 0.8;
	  const speed = 40 + Math.random() * 80;
	  this.particles.push({
		type: 'dust',
		x: x + (Math.random() - 0.5) * 16,
		y,
		vx: (dir !== 0 ? -dir * speed : Math.cos(angle) * speed),
		vy: -20 - Math.random() * 40,
		gravity: 60,
		size: 4 + Math.random() * 6,
		color: 'rgba(200, 205, 220, 0.4)',
		life: 0.25 + Math.random() * 0.2,
		maxLife: 0.45,
		initialAlpha: 0.6,
		fade: true
	  });
	}
	trimOldest(this.particles, this.maxParticles);
  }
  createAwakeningAura(x, y, count = 3) {
	for (let i = 0; i < count; i++) {
	  this.particles.push({
		type: 'aura',
		x: x + (Math.random() - 0.5) * 30,
		y: y + (Math.random() - 0.5) * 60,
		vx: (Math.random() - 0.5) * 50,
		vy: -100 - Math.random() * 120,
		size: 4 + Math.random() * 8,
		color: Math.random() > 0.3 ? '#ffaa00' : '#ffee33',
		life: 0.3 + Math.random() * 0.25,
		maxLife: 0.55,
		initialAlpha: 0.8,
		fade: true
	  });
	}
	trimOldest(this.particles, this.maxParticles);
  }
  addSlashArc(x, y, radius = 60, angle = 0, facing = 1, color = '#ffaa22', thickness = 6) {
	if (this.slashArcs.length >= this.maxSlashArcs) this.slashArcs.shift();
	this.slashArcs.push({
	  x,
	  y,
	  radius,
	  angle,
	  facing,
	  arcAngle: Math.PI * 0.7,
	  color,
	  thickness,
	  life: 0.12,
	  maxLife: 0.12
	});
  }
  createPencilLeadTrail(x, y, count = 6, facing = 1) {
	for (let i = 0; i < count; i++) {
	  const angle = (Math.random() - 0.5) * 1.2 + (facing > 0 ? 0 : Math.PI);
	  const speed = 60 + Math.random() * 140;
	  this.particles.push({
		type: 'line',
		x: x + (Math.random() - 0.5) * 20,
		y: y + (Math.random() - 0.5) * 20,
		vx: Math.cos(angle) * speed,
		vy: Math.sin(angle) * speed - 20,
		color: '#333333',
		lineWidth: 2.5,
		life: 0.16,
		maxLife: 0.16,
		initialAlpha: 0.85,
		fade: true
	  });
	}
	trimOldest(this.particles, this.maxParticles);
  }
  addShockwave(x, y, maxRadius = 120, color = '#ff7700', thickness = 8) {
	if (this.shockwaves.length >= this.maxShockwaves) this.shockwaves.shift();
	this.shockwaves.push({
	  x,
	  y,
	  radius: 10,
	  growSpeed: maxRadius / 0.25,
	  thickness,
	  color,
	  life: 0.25,
	  maxLife: 0.25,
	  maxAlpha: 0.9
	});
  }
  addDamageText(x, y, amount, isCrit = false, customColor = null) {
	if (this.damageTexts.length >= this.maxDamageTexts) this.damageTexts.shift();
	let color = '#ffffff';
	let text = typeof amount === 'number' ? `${Math.round(amount)}` : `${amount}`;
	if (customColor) {
	  color = customColor;
	} else if (isCrit) {
	  color = '#ffea00';
	  text = `CRIT! ${Math.round(amount)}`;
	}
	this.damageTexts.push({
	  x: x + (Math.random() - 0.5) * 20,
	  y: y - 20,
	  vx: (Math.random() - 0.5) * 50,
	  vy: -120 - (isCrit ? 40 : 0),
	  text,
	  color,
	  isCrit,
	  life: 0.7,
	  maxLife: 0.7
	});
  }
  addTextBanner(x, y, text, color = '#ff8800') {
	if (this.damageTexts.length >= this.maxDamageTexts) this.damageTexts.shift();
	let bannerY = y - 40;
	let collided = true;
	while (collided) {
	  collided = false;
	  for (const existing of this.damageTexts) {
		if (existing.isBanner && Math.abs(existing.x - x) < 340 && Math.abs(existing.y - bannerY) < 44) {
		  bannerY = existing.y + 46;
		  collided = true;
		}
	  }
	}
	this.damageTexts.push({
	  x,
	  y: bannerY,
	  vx: 0,
	  vy: -60,
	  text,
	  color,
	  isCrit: true,
	  isBanner: true,
	  life: 1.2,
	  maxLife: 1.2
	});
  }
  addComicPopup(x, y, text = 'POW!', bgColor = '#ff1744', textColor = '#ffee00') {
	if (this.comicPopups.length >= this.maxComicPopups) this.comicPopups.shift();
	this.comicPopups.push({
	  x,
	  y: y - 25,
	  vx: (Math.random() - 0.5) * 40,
	  vy: -70 - Math.random() * 50,
	  rotation: (Math.random() - 0.5) * 0.4,
	  rotSpeed: (Math.random() - 0.5) * 0.8,
	  scale: 0.2,
	  text,
	  bgColor,
	  textColor,
	  size: 42,
	  life: 0.55,
	  maxLife: 0.55
	});
  }
  createStickLimbExplosion(x, y, groundY = 0, color = '#2e7d32') {
	const incomingPieces = 6;
	while (this.limbDebris.length > this.maxLimbDebris - incomingPieces) {
	  this.limbDebris.shift();
	}
	this.limbDebris.push({
	  x,
	  y: y - 30,
	  vx: (Math.random() - 0.5) * 350,
	  vy: -280 - Math.random() * 220,
	  groundY,
	  rotation: 0,
	  rotSpeed: (Math.random() - 0.5) * 12,
	  isHead: true,
	  radius: 9,
	  color,
	  life: 1.8,
	  maxLife: 1.8
	});
	const lengths = [26, 18, 18, 20, 20];
	for (const len of lengths) {
	  this.limbDebris.push({
		x: x + (Math.random() - 0.5) * 16,
		y: y - 20,
		vx: (Math.random() - 0.5) * 420,
		vy: -220 - Math.random() * 260,
		groundY,
		rotation: Math.random() * Math.PI,
		rotSpeed: (Math.random() - 0.5) * 15,
		isHead: false,
		length: len,
		width: 4.5,
		color,
		life: 1.8,
		maxLife: 1.8
	  });
	}
  }
}
const DEFAULT_SPEEDLINE_ANGLES = Array.from(
  { length: 18 },
  (_, index) => (index / 18) * Math.PI * 2
);
function trimOldest(list, maxLength) {
  if (list.length > maxLength) list.splice(0, list.length - maxLength);
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function hashSpeedlineSeed(x, y, sequence) {
  const ix = Math.trunc(x * 10);
  const iy = Math.trunc(y * 10);
  return ((ix * 73856093) ^ (iy * 19349663) ^ (sequence * 83492791) ^ 0x9e3779b9) >>> 0;
}
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
	state = (state + 0x6d2b79f5) >>> 0;
	let value = state;
	value = Math.imul(value ^ (value >>> 15), value | 1);
	value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
	return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export const particles = new ParticleSystem();