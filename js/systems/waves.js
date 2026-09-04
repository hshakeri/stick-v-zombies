import { Zombie } from '../entities/zombies.js?v=9.7';
import { DarkLord } from '../entities/dark_lord.js?v=9.7';
import { KingOrange } from '../entities/king_orange.js?v=9.7';
import { H4C3R } from '../entities/h4c3r.js?v=9.7';
import { LuckyOrb } from '../entities/lucky_orb.js?v=9.7';
import { audio } from '../engine/audio.js?v=9.7';
import { particles } from '../engine/particles.js?v=9.7';
import { speech } from '../engine/speech.js?v=9.7';
const BOSS_WAVES = new Set([5, 10, 11, 15, 16, 17, 18]);
const BOSS_SPAWNS = Object.freeze({
	titan_boss: [null, '#ff2244', '💀 TITAN UNDEAD 💀', 'titan', 105],
	dark_lord: [DarkLord, '#ff0033', '⚔️ DARK LORD // BACKUP ⚔️', 'darkLord', 90],
	king_orange: [KingOrange, '#ff8a00', '♛ KING ORANGE // REPLAY ♛', 'kingOrange', 90],
	creeper_lord: [null, '#b8ef58', '♛ CREEPER LORD // REPLAY ♛', 'creeperLord', 118],
	giant_cat: [null, '#ff9b3d', '🐾 GIANT CAT // REPLAY 🐾', 'giantCat', 96],
	lucky_orb: [LuckyOrb, '#ffd43b', '✦ THE LUCKY ORB ✦', 'luckyOrb', 90],
	h4c3r: [H4C3R, '#67e8f9', '⌁ H4C3R HAS ROOT ACCESS ⌁', 'h4c3r', 90]
});
export const ABSOLUTE_ACTIVE_ENEMY_CAP = 12;
export const NORMAL_ACTIVE_ENEMY_CAP = 8;
export const MIN_RECIPE_PACK_SIZE = 3;
export const MAX_RECIPE_PACK_SIZE = 5;
export const MAX_BOSS_HELPERS = 4;
export const WAVE_RECIPE_TOTALS = Object.freeze({
  1: 6, 2: 9, 3: 12, 4: 14, 5: 4,
  6: 15, 7: 15, 8: 16, 9: 17, 10: 5,
  11: 1, 12: 15, 13: 17, 14: 20, 15: 1, 16: 1, 17: 1, 18: 1
});
const makePack = (gap, enemies) => {
  if (gap < 0.9 || gap > 1.2) throw new RangeError('Wave pack gaps must stay between 0.9s and 1.2s.');
  if (enemies.length < MIN_RECIPE_PACK_SIZE || enemies.length > MAX_RECIPE_PACK_SIZE) {
	throw new RangeError('Ordinary wave packs must contain 3-5 enemies.');
  }
  return Object.freeze({ gap, enemies: Object.freeze([...enemies]) });
};
const makeSoloBossPack = (gap, bossType) => {
  if (gap < 0.9 || gap > 1.2) throw new RangeError('Boss pack gaps must stay between 0.9s and 1.2s.');
  return Object.freeze({
	gap,
	bossOnly: true,
	enemies: Object.freeze([bossType])
  });
};
const makeRecipe = (expectedTotal, packs, bossHelpers = 0) => {
  const total = packs.reduce((sum, pack) => sum + pack.enemies.length, 0);
  if (total !== expectedTotal) throw new RangeError(`Wave recipe expected ${expectedTotal} enemies, received ${total}.`);
  if (bossHelpers > MAX_BOSS_HELPERS) throw new RangeError('Boss helper cap exceeded.');
  return Object.freeze({ total, bossHelpers, packs: Object.freeze([...packs]) });
};
const RECIPE_PACKS = [
	[[1.1,'walker walker walker'],[1.15,'walker walker walker']],
	[[1.05,'walker crawler runner crawler'],[1.15,'walker runner crawler walker crawler']],
	[[.95,'walker spitter crawler runner'],[1.05,'crawler walker spitter crawler'],[1.15,'runner spitter crawler spitter']],
	[[.9,'runner walker crawler spitter crawler'],[1.05,'runner brute walker shieldbearer crawler'],[1.15,'runner spitter walker shieldbearer']],
	[[1.2,'titan_boss runner spitter runner']],
	[[.95,'walker spitter crawler runner crawler'],[1.05,'shieldbearer runner spitter boom_bug crawler'],[1.15,'brute walker boom_bug spitter crawler']],
	[[.9,'crawler runner crawler spitter boom_bug'],[1.05,'brute shieldbearer crawler runner walker'],[1.2,'crawler spitter boom_bug brute crawler']],
	[[.9,'spitter runner crawler boom_bug'],[1,'walker shieldbearer spitter crawler'],[1.1,'runner brute crawler boom_bug'],[1.2,'spitter runner shieldbearer crawler']],
	[[.9,'runner spitter crawler boom_bug crawler'],[1,'runner brute shieldbearer spitter'],[1.1,'crawler runner boom_bug shieldbearer'],[1.2,'brute crawler spitter boom_bug']],
	[[1.2,'dark_lord runner spitter runner brute']],
	[[1.2,'!king_orange']],
	[[.9,'stalker crawler spitter crawler boom_bug'],[1.05,'stalker shieldbearer runner warden crawler'],[1.2,'crawler spitter boom_bug shieldbearer stalker']],
	[[.9,'spitter stalker crawler boom_bug brute'],[1,'runner warden spitter crawler'],[1.1,'crawler boom_bug stalker brute'],[1.2,'shieldbearer spitter crawler boom_bug']],
	[[.9,'stalker spitter crawler boom_bug shieldbearer'],[1,'crawler warden stalker shieldbearer boom_bug'],[1.1,'walker crawler spitter boom_bug brute'],[1.2,'runner warden crawler spitter boom_bug']],
	[[1.2,'!creeper_lord']],[[1.2,'!giant_cat']],[[1.2,'!lucky_orb']],[[1.2,'!h4c3r']]
];
export const WAVE_RECIPES = Object.freeze(Object.fromEntries(RECIPE_PACKS.map((packs, index) => {
	const stage = index + 1;
	const authored = packs.map(([gap, source]) => source[0] === '!'
		? makeSoloBossPack(gap, source.slice(1)) : makePack(gap, source.split(' ')));
	return [stage, makeRecipe(WAVE_RECIPE_TOTALS[stage], authored, stage === 5 ? 3 : (stage === 10 ? 4 : 0))];
})));
export class WaveDirector {
  constructor() {
	this.currentWave = 1;
	this.zombies = [];
	this.spawnQueue = [];
	this.spawnTimer = 0;
	this.spawnInterval = 1.2;
	this.isWaveActive = false;
	this.isWaveClearing = false;
	this.clearTimer = 0;
	this.bossZombie = null;
	this.spawnSerial = 0;
	this.maxActiveEnemies = ABSOLUTE_ACTIVE_ENEMY_CAP;
	this.usesAuthoredRecipe = false;
  }
  startWave(waveNumber = 1) {
	this.currentWave = waveNumber;
	this.zombies = [];
	this.spawnQueue = [];
	this.isWaveActive = true;
	this.isWaveClearing = false;
	this.bossZombie = null;
	this.spawnTimer = 1.15;
	this.spawnSerial = 0;
	this.usesAuthoredRecipe = false;
	audio.playWaveStart();
	audio.setMusicAct?.(this.currentWave <= 5 ? 1 : (this.currentWave <= 10 ? 2 : (this.currentWave <= 14 ? 3 : 4)));
	audio.setIntensity(BOSS_WAVES.has(this.currentWave) ? 0.95 : (this.currentWave >= 12 ? 0.55 : 0.2));
	this.generateWaveQueue(this.currentWave);
  }
  generateWaveQueue(wave) {
	const stage = Math.max(1, Math.min(18, Math.trunc(Number(wave)) || 1));
	this.queueWaveRecipe(WAVE_RECIPES[stage]);
  }
  queueWaveRecipe(recipe) {
	if (!recipe?.packs) return;
	this.usesAuthoredRecipe = true;
	recipe.packs.forEach((pack, packIndex) => {
	  pack.enemies.forEach((type, enemyIndex) => {
		const isPackTail = enemyIndex === pack.enemies.length - 1;
		const helperIndex = this.currentWave === 10 && type !== 'dark_lord' ? enemyIndex : -1;
		this.spawnQueue.push({
		  type,
		  delay: isPackTail ? pack.gap : 0.18,
		  packIndex,
		  bossHealthGate: helperIndex >= 0 ? (helperIndex <= 2 ? 0.72 : 0.42) : null
		});
	  });
	});
  }
  update(dt, player, groundY, sketchBlocks, camera, onWaveComplete, platforms = [], friendlyTargets = []) {
	if (!this.isWaveActive) return;
	this.spawnTimer -= dt;
	if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
	  const activeBudget = Math.min(
		ABSOLUTE_ACTIVE_ENEMY_CAP,
		this.usesAuthoredRecipe && !BOSS_WAVES.has(this.currentWave)
		  ? NORMAL_ACTIVE_ENEMY_CAP
		  : ABSOLUTE_ACTIVE_ENEMY_CAP,
		Math.max(1, Math.trunc(Number(this.maxActiveEnemies)) || ABSOLUTE_ACTIVE_ENEMY_CAP)
	  );
	  const queuedEnemy = this.spawnQueue[0];
	  const bossRatio = this.bossZombie && this.bossZombie.maxHp > 0
		? this.bossZombie.hp / this.bossZombie.maxHp
		: 0;
	  const waitingForBossGate = Number.isFinite(queuedEnemy.bossHealthGate)
		&& bossRatio > queuedEnemy.bossHealthGate;
	  if (waitingForBossGate || this.zombies.length >= activeBudget) {
		this.spawnTimer = 0.2;
	  } else {
		const nextEnemy = this.spawnQueue.shift();
		this.spawnZombie(nextEnemy.type, player, groundY, camera);
		this.spawnTimer = nextEnemy.delay || this.spawnInterval;
	  }
	}
	for (let i = this.zombies.length - 1; i >= 0; i--) {
	  const z = this.zombies[i];
	  z.update(dt, groundY, player, sketchBlocks, camera, platforms, this.zombies, friendlyTargets);
	  if (z.isDead) {
		if (z.isBoss) camera?.focusOn?.(z.x, z.y - Math.max(48, (z.height || 80) * 0.5), 0.8, 1.06);
		this.zombies.splice(i, 1);
	  }
	}
	if (this.isWaveActive && this.spawnQueue.length === 0 && this.zombies.length === 0 && !this.isWaveClearing) {
	  this.isWaveClearing = true;
	  this.clearTimer = 1.0;
	}
  }
  spawnZombie(type, player, groundY, camera = null) {
	const spawnX = this.getSafeSpawnX(player);
	const bossConfig = BOSS_SPAWNS[type];
	if (bossConfig) {
	  const [BossClass, color, banner, speechKey, focusY] = bossConfig;
	  const boss = BossClass ? new BossClass(spawnX, groundY) : new Zombie(spawnX, groundY, type, this.currentWave);
	  this.zombies.push(boss);
	  this.bossZombie = boss;
	  audio.playBossRoar();
	  camera?.addShake?.(0.8);
	  camera?.focusOn?.(spawnX, groundY - focusY, 0.7, 0.9);
	  camera?.addZoomPunch?.(-0.035);
	  particles.addShockwave(spawnX, groundY - 30, 240, color, 12);
	  particles.addTextBanner(spawnX, groundY + (boss.bannerOffsetY ?? -100), banner, color);
	  speech.shoutBoss(spawnX, groundY, speechKey, 'intro', 1.55, {
		anchor: boss,
		speakerKey: speechKey,
		repeatKey: `${speechKey}:intro`,
		cooldownMs: 0
	  });
	  return;
	}
	const zombie = new Zombie(spawnX, groundY, type, this.currentWave);
	this.zombies.push(zombie);
	particles.createDust(spawnX, groundY, 8);
	particles.addShockwave(spawnX, groundY - 30, 54, '#64ff7b', 4);
  }
  getSafeSpawnX(player) {
	const leftEdge = -920;
	const rightEdge = 920;
	const playerX = player && Number.isFinite(player.x) ? player.x : 0;
	const leftDistance = Math.abs(playerX - leftEdge);
	const rightDistance = Math.abs(rightEdge - playerX);
	let side = leftDistance === rightDistance
	  ? (Math.random() > 0.5 ? 1 : -1)
	  : (rightDistance > leftDistance ? 1 : -1);
	const inset = 20 + (this.spawnSerial % 4) * 48 + Math.random() * 22;
	this.spawnSerial++;
	let spawnX = side > 0 ? rightEdge - inset : leftEdge + inset;
	if (Math.abs(spawnX - playerX) < 380) {
	  side *= -1;
	  spawnX = side > 0 ? rightEdge - inset : leftEdge + inset;
	}
	return spawnX;
  }
  getAliveCount() {
	return this.zombies.length + this.spawnQueue.length;
  }
  draw(ctx) {
	const crowded = this.zombies.length >= NORMAL_ACTIVE_ENEMY_CAP;
	for (const z of this.zombies) {
	  z.draw(ctx, crowded);
	}
  }
  drawScreenIndicators(ctx, camera, viewportWidth, viewportHeight) {
	if (!camera || this.zombies.length === 0) return;
	const groups = { left: { count: 0, y: 0 }, right: { count: 0, y: 0 } };
	for (const zombie of this.zombies) {
	  if (zombie.isDead) continue;
	  const screen = camera.worldToScreen(zombie.x, zombie.y - 35);
	  const group = screen.x < -16 ? groups.left : (screen.x > viewportWidth + 16 ? groups.right : null);
	  if (!group) continue;
	  group.count++;
	  group.y += screen.y;
	}
	ctx.save();
	ctx.font = "900 12px 'Trebuchet MS', sans-serif";
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const [side, group] of Object.entries(groups)) {
	  if (!group.count) continue;
	  const x = side === 'left' ? 30 : viewportWidth - 30;
	  const averageY = group.y / group.count;
	  const y = Math.max(145, Math.min(viewportHeight - 125, averageY));
	  ctx.fillStyle = 'rgba(13, 18, 27, 0.9)';
	  ctx.strokeStyle = '#75ff7b';
	  ctx.lineWidth = 2;
	  ctx.beginPath();
	  ctx.arc(x, y, 20, 0, Math.PI * 2);
	  ctx.fill();
	  ctx.stroke();
	  ctx.fillStyle = '#75ff7b';
	  ctx.beginPath();
	  if (side === 'left') {
		ctx.moveTo(x - 10, y); ctx.lineTo(x - 2, y - 7); ctx.lineTo(x - 2, y + 7);
	  } else {
		ctx.moveTo(x + 10, y); ctx.lineTo(x + 2, y - 7); ctx.lineTo(x + 2, y + 7);
	  }
	  ctx.fill();
	  ctx.fillStyle = '#ffffff';
	  ctx.fillText(group.count, x, y);
	}
	ctx.restore();
  }
}
export const waves = new WaveDirector();
