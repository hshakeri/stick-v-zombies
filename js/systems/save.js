const SAVE_KEY = 'svz.save.v1';
const defaultData = () => ({
  version: 1,
  settings: { audio: true, splatter: true },
  highestStageCleared: 0,
  checkpoint: null,
  best: { score: 0, maxCombo: 0, kills: 0, stageRanks: {}, endlessWave: 0 },
  unlocks: { endless: false, bossRush: false }
});
function resolveStorage() {
  try {
	if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch (e) { /* access itself can throw when storage is blocked */ }
  return null;
}
export class SaveSystem {
  constructor(storage = resolveStorage()) {
	this.storage = storage;
	this.data = defaultData();
	this.writeTimer = null;
	this.load();
  }
  get isAvailable() {
	return this.storage !== null;
  }
  load() {
	if (!this.storage) return this.data;
	try {
	  const raw = this.storage.getItem(SAVE_KEY);
	  if (raw) {
		const parsed = JSON.parse(raw);
		if (parsed && parsed.version === 1) {
		  const base = defaultData();
		  this.data = {
			...base,
			...parsed,
			settings: { ...base.settings, ...(parsed.settings || {}) },
			best: { ...base.best, ...(parsed.best || {}) },
			unlocks: { ...base.unlocks, ...(parsed.unlocks || {}) }
		  };
		}
	  }
	} catch (e) {
	  this.data = defaultData();
	}
	return this.data;
  }
  write() {
	if (!this.storage) return;
	if (this.writeTimer) clearTimeout(this.writeTimer);
	this.writeTimer = setTimeout(() => this.flush(), 400);
	this.writeTimer.unref?.();
  }
  flush() {
	if (this.writeTimer) {
	  clearTimeout(this.writeTimer);
	  this.writeTimer = null;
	}
	if (!this.storage) return;
	try {
	  this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
	} catch (e) { /* quota exceeded or blocked — keep playing without saves */ }
  }
  getSetting(key, fallback) {
	return this.data.settings[key] ?? fallback;
  }
  setSetting(key, value) {
	this.data.settings[key] = value;
	this.write();
  }
  setCheckpoint(checkpoint) {
	this.data.checkpoint = checkpoint
	  ? {
		  stage: checkpoint.stage,
		  ink: checkpoint.ink,
		  score: checkpoint.score,
		  totalKills: checkpoint.totalKills,
		  maxCombo: checkpoint.maxCombo,
		  upgrades: (checkpoint.upgrades || []).map((u) => ({ id: u.id, level: u.level }))
		}
	  : null;
	this.write();
  }
  clearCheckpoint() {
	this.data.checkpoint = null;
	this.write();
  }
  recordStageCleared(stage) {
	if (Number.isFinite(stage) && stage > this.data.highestStageCleared) {
	  this.data.highestStageCleared = stage;
	  this.write();
	}
  }
  recordRun(score = 0, maxCombo = 0, kills = 0) {
	const best = this.data.best;
	best.score = Math.max(best.score, score | 0);
	best.maxCombo = Math.max(best.maxCombo, maxCombo | 0);
	best.kills = Math.max(best.kills, kills | 0);
	this.write();
  }
  recordStageRank(stage, rank) {
	const order = { S: 3, A: 2, B: 1, C: 0 };
	const current = this.data.best.stageRanks[stage];
	if (current === undefined || (order[rank] ?? 0) > (order[current] ?? 0)) {
	  this.data.best.stageRanks[stage] = rank;
	  this.write();
	}
  }
  recordVictory() {
	this.data.unlocks.endless = true;
	this.data.unlocks.bossRush = true;
	this.data.highestStageCleared = Math.max(this.data.highestStageCleared, 16);
	this.data.checkpoint = null;
	this.write();
  }
}
export const save = new SaveSystem();