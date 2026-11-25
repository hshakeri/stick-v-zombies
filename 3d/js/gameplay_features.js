// ============================================================================
// Stick vs Zombies — Mega Gameplay Features Engine (Zero Three.js — 2D & 3D!)
//   1. Unlockable Boss Weapons & Hot-Swap Arsenal (Key T / HUD Chip)
//   2. Playable Stickman Character Select (8 Fighters w/ Unique Passives)
//   3. Boss Rush Mode (13 Bosses), Endless Horde Mode (Mutators) & Stage Ranks
//   4. Tag-Team Ally Combo Synergies (Purple+King, Blue+Yellow, Red+Green, TCO+Orange)
//   5. Interactive Stage Toys (Slime Pads, Minecart, YouTube Pause, Spotify Skip,
//      Slides Wipe & Interactive Trophy Room Rematch)
//   6. Combat Depth: Perfect Dodge ("FRAME PERFECT!"), Rare Loot Drops & 1-of-3 Perks
//   7. Secret Boss Integration (Herobrine & Victim) + Local 2P Co-op & 1v1 Versus
// ============================================================================

import { StickFigureRenderer } from '../../js/entities/stickman.js?v=9.8';
import { particles } from '../../js/engine/particles.js?v=9.8';
import { audio } from '../../js/engine/audio.js?v=9.8';
import { combat } from '../../js/systems/combat.js?v=9.8';
import { save } from '../../js/systems/save.js?v=9.8';
import { projectiles } from '../../js/entities/projectiles.js?v=9.8';
import { speech3d } from './speech3d.js?v=10.3';
import { drawPurpleElytraWings2D } from './purple_ally.js?v=11.0';
import { HerobrineBoss, VictimBoss } from './secret_bosses.js?v=10.9';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const ARENA_BOUND = 960;

// ============================================================================
// 1. UNLOCKABLE BOSS WEAPONS & HOT-SWAP ARSENAL
// ============================================================================
export const BOSS_WEAPON_CATALOG = Object.freeze([
  { id: 'pencil', name: 'Giant Pencil', icon: '✏️', source: 'Starter', color: '#ff9800' },
  { id: 'vira_blades', name: 'Dual Vira-Blades', icon: '🗡️', source: 'The Dark Lord', color: '#ff1744' },
  { id: 'staff', name: 'Command Staff', icon: '🟧', source: 'King Orange', color: '#f97316' },
  { id: 'eraser', name: 'Giant Pink Eraser', icon: '🧽', source: 'Lucky Orb / Slides', color: '#f472b6' },
  { id: 'toolbar_staff', name: 'UI Toolbar Staff', icon: '🕶️', source: 'Agent (Mercenaries)', color: '#38bdf8' },
  { id: 'pixel_bazooka', name: '8-Bit Bazooka', icon: '🚀', source: 'Ballista (Mercenaries)', color: '#ef4444' },
  { id: 'stone_spear', name: 'Stone Spear', icon: '🦴', source: 'Primal (Mercenaries)', color: '#d97706' },
  { id: 'hazard_sign', name: 'High-Voltage Sign', icon: '⚠️', source: 'Hazard (Mercenaries)', color: '#facc15' }
]);

const BOSS_TO_WEAPONS = Object.freeze({
  dark_lord: ['vira_blades'],
  king_orange: ['staff'],
  lucky_orb: ['eraser'],
  mercenary_agent: ['toolbar_staff'],
  mercenary_ballista: ['pixel_bazooka'],
  mercenary_primal: ['stone_spear'],
  mercenary_hazard: ['hazard_sign'],
  victim_boss: ['toolbar_staff', 'pixel_bazooka', 'stone_spear', 'hazard_sign'],
  herobrine_boss: ['vira_blades', 'staff']
});

// ============================================================================
// 2. PLAYABLE STICKMAN CHARACTER ROSTER
// ============================================================================
export const PLAYABLE_CHARACTERS = Object.freeze([
  {
    id: 'orange',
    name: 'Orange (TSC)',
    badge: '🟠',
    color: '#ff7700',
    isHollowHead: true,
    hasCrown: false,
    hasElytra: false,
    passive: 'Balanced Hero • +15% Awakening Charge',
    hpBonus: 0,
    speedBonus: 0,
    damageMult: 1.0,
    superGainBonus: 0.15,
    starterWeapon: 'pencil'
  },
  {
    id: 'purple',
    name: 'Purple (Elytra)',
    badge: '🟣',
    color: '#9333ea',
    isHollowHead: false,
    hasCrown: false,
    hasElytra: true,
    passive: 'Hold SPACE in mid-air to Glide with Elytra!',
    hpBonus: 0,
    speedBonus: 25,
    damageMult: 1.0,
    superGainBonus: 0,
    starterWeapon: 'pencil'
  },
  {
    id: 'chosen',
    name: 'The Chosen One',
    badge: '⚫',
    color: '#111111',
    isHollowHead: true,
    hasCrown: false,
    hasElytra: false,
    passive: 'Fire Dash Roll burns foes • High Speed',
    hpBonus: 10,
    speedBonus: 45,
    damageMult: 1.08,
    superGainBonus: 0.1,
    starterWeapon: 'pencil'
  },
  {
    id: 'red',
    name: 'Red (Brawler)',
    badge: '🔴',
    color: '#ff3344',
    isHollowHead: false,
    hasCrown: false,
    hasElytra: false,
    passive: '+25 HP • +18% Damage • Slam Shockwaves',
    hpBonus: 25,
    speedBonus: 0,
    damageMult: 1.18,
    superGainBonus: 0,
    starterWeapon: 'pencil'
  },
  {
    id: 'blue',
    name: 'Blue (Alchemist)',
    badge: '🔵',
    color: '#2299ff',
    isHollowHead: false,
    hasCrown: false,
    hasElytra: false,
    passive: 'Passive HP Regen • Chilling Frost Strikes',
    hpBonus: 15,
    speedBonus: 0,
    damageMult: 1.0,
    superGainBonus: 0,
    starterWeapon: 'pencil'
  },
  {
    id: 'yellow',
    name: 'Yellow (Engineer)',
    badge: '🟡',
    color: '#ffcc00',
    isHollowHead: false,
    hasCrown: false,
    hasElytra: false,
    passive: 'Faster Blocks/Anvils • Electric Zap Hits',
    hpBonus: 0,
    speedBonus: 15,
    damageMult: 1.05,
    superGainBonus: 0,
    starterWeapon: 'pencil'
  },
  {
    id: 'green',
    name: 'Green (Virtuoso)',
    badge: '🟢',
    color: '#33dd66',
    isHollowHead: false,
    hasCrown: false,
    hasElytra: false,
    passive: 'Fast Sprint • Sonic Stun Combo Finishers',
    hpBonus: 0,
    speedBonus: 40,
    damageMult: 1.02,
    superGainBonus: 0,
    starterWeapon: 'pencil'
  },
  {
    id: 'king',
    name: 'King Orange',
    badge: '👑',
    color: '#cc6600',
    isHollowHead: false,
    hasCrown: true,
    hasElytra: false,
    passive: '+30 HP • Starts with Command Staff!',
    hpBonus: 30,
    speedBonus: -10,
    damageMult: 1.12,
    superGainBonus: 0,
    starterWeapon: 'staff'
  }
]);

export function getCharacterDef(id) {
  return PLAYABLE_CHARACTERS.find((c) => c.id === id) || PLAYABLE_CHARACTERS[0];
}

// ============================================================================
// 3. BOSS RUSH ROSTER, ENDLESS MUTATORS & ROGUELIKE PERKS
// ============================================================================
export const BOSS_RUSH_ROSTER = Object.freeze([
  { round: 1, stage: 5, bossType: 'titan_boss', label: 'TITAN UNDEAD' },
  { round: 2, stage: 10, bossType: 'dark_lord', label: 'THE DARK LORD' },
  { round: 3, stage: 11, bossType: 'king_orange', label: 'KING ORANGE' },
  { round: 4, stage: 15, bossType: 'creeper_lord', label: 'CREEPER LORD' },
  { round: 5, stage: 16, bossType: 'giant_cat', label: 'GIANT CAT' },
  { round: 6, stage: 17, bossType: 'lucky_orb', label: 'THE LUCKY ORB' },
  { round: 7, stage: 19, bossType: 'ender_dragon', label: 'ENDER DRAGON' },
  { round: 8, stage: 21, bossType: 'warden_boss', label: 'THE WARDEN' },
  { round: 9, stage: 22, bossType: 'creaking_boss', label: 'THE CREAKING' },
  { round: 10, stage: 31, bossType: 'mercenary_squad', label: 'ROCKET CORP MERCENARIES' },
  { round: 11, stage: 32, bossType: 'h4c3r', label: 'H4C3R' },
  { round: 12, stage: 25, bossType: 'herobrine_boss', label: 'SECRET: HEROBRINE' },
  { round: 13, stage: 31, bossType: 'victim_boss', label: 'SECRET FINALE: VICTIM' }
]);

export const ENDLESS_MUTATORS = Object.freeze([
  { id: 'standard', name: 'STANDARD HORDE', icon: '🧟', desc: 'Classic escalating zombie waves.' },
  { id: 'low_gravity', name: 'LOW GRAVITY', icon: '🌙', desc: 'Floaty moon jumps & huge air juggles!' },
  { id: 'turbo_horde', name: 'TURBO HORDE', icon: '⚡', desc: 'Enemies rush faster • +50% Bonus Score!' },
  { id: 'tnt_rain', name: 'TNT RAIN', icon: '🧨', desc: 'Explosive TNT drops into the arena!' },
  { id: 'heavy_squad', name: 'HEAVY BRIGADE', icon: '🛡️', desc: 'Armored Brutes, Shields & Wardens!' },
  { id: 'ink_jackpot', name: 'INK JACKPOT', icon: '✒️', desc: '2× Ink drops & extra rare power-ups!' }
]);

export const ENDLESS_ARENA_ROTATION = Object.freeze([1, 7, 10, 18, 20, 23, 24, 25, 26, 28, 30, 31]);

export const ROGUELIKE_PERKS = Object.freeze([
  { id: 'explosive_dive', icon: '💥', name: 'Explosive Dive Kick', desc: 'Dive kicks & heavy landings erupt in a fiery 110-damage shockwave!' },
  { id: 'chain_lightning', icon: '⚡', name: 'Chain-Lightning Strikes', desc: 'Weapon attacks arc lightning bolts to 2 nearby enemies (+38 dmg)!' },
  { id: 'tnt_grab', icon: '🧨', name: 'TNT Grab-Throws', desc: 'Grabbed zombies detonate in a massive blast hitting the whole crowd!' },
  { id: 'double_ally', icon: '🤝', name: 'Squad Overdrive', desc: 'Cuts ALL ally cooldowns by 35% & boosts summon shockwaves!' },
  { id: 'vampiric_combo', icon: '🩸', name: 'Vampiric Combos', desc: 'Every 5 combo hits restores +8 HP and +6% Awakening!' },
  { id: 'mega_awakening', icon: '🌟', name: 'Overclocked Awakening', desc: 'Awakening fills 35% faster and lasts +3.5 seconds longer!' },
  { id: 'slime_boots', icon: '🟩', name: 'Slime Bounce Boots', desc: '+110 Jump Force & bouncing landings shock nearby zombies!' },
  { id: 'golden_magnet', icon: '🧲', name: 'Jackpot Magnet', desc: 'Doubles rare Power-Up drop rate & awards +50% bonus Ink!' }
]);

export const P2_KEY_CODES = Object.freeze([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3',
  'Slash', 'Period', 'Comma'
]);

export const TROPHY_MONUMENT_BOSSES = Object.freeze([
  { x: -860, stage: 5, bossType: 'titan_boss', label: 'Titan Undead' },
  { x: -685, stage: 10, bossType: 'dark_lord', label: 'The Dark Lord' },
  { x: -510, stage: 11, bossType: 'king_orange', label: 'King Orange' },
  { x: -335, stage: 15, bossType: 'creeper_lord', label: 'Creeper Lord' },
  { x: -160, stage: 16, bossType: 'giant_cat', label: 'Giant Cat' },
  { x: 15, stage: 17, bossType: 'lucky_orb', label: 'The Lucky Orb' },
  { x: 190, stage: 19, bossType: 'ender_dragon', label: 'Ender Dragon' },
  { x: 365, stage: 21, bossType: 'warden_boss', label: 'The Warden' },
  { x: 540, stage: 22, bossType: 'creaking_boss', label: 'The Creaking' },
  { x: 715, stage: 31, bossType: 'mercenary_squad', label: 'Rocket Corp Mercenaries' },
  { x: 890, stage: 32, bossType: 'h4c3r', label: 'H4C3R' }
]);

export function computeStageRank(elapsedSeconds = 30, damageTaken = 0, maxCombo = 0) {
  let score = 100;
  if (damageTaken > 0) score -= Math.min(55, damageTaken * 0.55);
  if (elapsedSeconds > 45) score -= Math.min(25, (elapsedSeconds - 45) * 0.45);
  score += Math.min(22, maxCombo * 1.1);
  if (score >= 92 && damageTaken <= 20) return { rank: 'S', title: 'ANIMATOR LEGEND!', color: '#facc15' };
  if (score >= 76) return { rank: 'A', title: 'FRAME MASTER!', color: '#38bdf8' };
  if (score >= 56) return { rank: 'B', title: 'SOLID REEL!', color: '#34d399' };
  return { rank: 'C', title: 'CLEARED!', color: '#cbd5e1' };
}

// ============================================================================
// SECRET BOSS SPAWNER HOOK (Installs herobrine_boss & victim_boss into waves)
// ============================================================================
export function installSecretBossesOnWaves(waves) {
  if (!waves || waves._secretBossesInstalled) return;
  waves._secretBossesInstalled = true;

  const origSpawnZombie = waves.spawnZombie.bind(waves);
  waves.spawnZombie = (type, player, groundY, camera) => {
    if (type !== 'herobrine_boss' && type !== 'victim_boss') {
      return origSpawnZombie(type, player, groundY, camera);
    }
    const spawnX = Number.isFinite(waves._creativeSpawnX)
      ? waves._creativeSpawnX
      : clamp((player?.x || 0) + ((player?.x || 0) > 0 ? -360 : 360), -860, 860);
    const boss = type === 'herobrine_boss'
      ? new HerobrineBoss(spawnX, groundY)
      : new VictimBoss(spawnX, groundY);
    waves.zombies.push(boss);
    waves.bossZombie = boss;
    audio.playBossRoar?.();
    camera?.addShake?.(0.55);
    particles.addShockwave(boss.x, boss.y - 45, 210, boss.accentColor || '#ffffff', 12);
    particles.addTextBanner(
      boss.x,
      boss.y - 140,
      type === 'herobrine_boss' ? '👁️ SECRET BOSS: HEROBRINE! 👁️' : '🕵️ SECRET BOSS: VICTIM! 🕵️',
      boss.accentColor || '#ffffff'
    );
    speech3d.spawnSpeechBubble(
      boss,
      type === 'herobrine_boss' ? 'HEROBRINE HAS ENTERED THE CANVAS.' : 'WELCOME TO ROCKET CORP.',
      {
        style: type === 'herobrine_boss' ? 'shout' : 'pixel',
        badge: type === 'herobrine_boss' ? '👁️ HEROBRINE' : '🕵️ VICTIM',
        mood: '💀',
        priority: 5,
        trauma: 0.9,
        anchor: boss,
        bypassCooldown: true
      }
    );
    return boss;
  };
}

// ============================================================================
// MAIN MEGA FEATURES CONTROLLER (Instantiated once per 2D or 3D Game!)
// ============================================================================
export class MegaFeaturesController {
  constructor(options = {}) {
    this.is3D = Boolean(options.is3D);
    this.mode = 'campaign'; // 'campaign' | 'boss_rush' | 'endless' | 'versus'
    this.selectedCharacter = save.data?.selectedCharacter || 'orange';
    this.p2Character = save.data?.p2Character || 'purple';

    // 1. Unlockable Boss Weapons
    const savedWeapons = Array.isArray(save.data?.unlockedWeapons) ? save.data.unlockedWeapons : ['pencil'];
    this.unlockedWeapons = new Set(['pencil', ...savedWeapons]);

    // 2. Boss Rush & Endless & Rank state
    this.bossRushIndex = 0;
    this.bossRushTimer = 0;
    this.bossRushActive = false;
    this.bossRushComplete = false;
    this.endlessWave = 0;
    this.endlessMutator = ENDLESS_MUTATORS[0];
    this.endlessTntTimer = 4.0;
    this.stageElapsed = 0;
    this.stageRankAwardedFor = -1;
    this.lastStageRank = null;

    // 3. Tag-Team Synergy cooldowns
    this.synergyCooldowns = { purple_king: 0, blue_yellow: 0, red_green: 0, tco_orange: 0 };
    this.triggeredSynergies = [];

    // 4. Interactive Stage Toys
    this.stageToys = [];
    this.videoPauseTimer = 0;
    this.slideWipeX = null;
    this.nearbyTrophyBoss = null;

    // 5. Combat Depth: Perfect Dodge, Loot Drops, Roguelike Perks
    this.lootDrops = [];
    this.activePerks = new Set();
    this.perkPickerOpen = false;
    this.perkOfferings = [];
    this.pendingPerkBossRound = -1;
    this.prevComboForVamp = 0;
    this.prevRollState = false;
    this.prevDeadEnemies = new WeakSet();
    this.perfectDodgeCount = 0;
    this.goldenShieldTimer = 0;
    this.fireworkBoostTimer = 0;

    // 6. Player 2 (Local Co-op & 1v1 Versus)
    this.p2 = this.createP2State();
    this.p2Keys = Object.create(null);
    this.p2KeysPressed = Object.create(null);
    this.p2Renderer = new StickFigureRenderer('#9333ea', 5.4, 1.0, false);
    this.versusP1Wins = 0;
    this.versusP2Wins = 0;
    this.versusRound = 1;
    this.versusRoundResetTimer = 0;
    this.versusWinner = null;

    // Player 1 overlay renderer helper
    this.playerCrownColor = '#ffd54a';
  }

  createP2State() {
    const ch = getCharacterDef(this.p2Character);
    return {
      active: false,
      mode: 'coop',
      characterId: ch.id,
      x: -780,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      hp: 100 + ch.hpBonus,
      maxHp: 100 + ch.hpBonus,
      pose: 'idle',
      animTimer: 0,
      attackTimer: 0,
      attackHit: false,
      weaponTimer: 0,
      rollTimer: 0,
      rollCooldown: 0,
      iFrames: 0,
      hurtTimer: 0,
      isHurt: false,
      isDead: false,
      respawnTimer: 0,
      isGrounded: true,
      canDoubleJump: true,
      isElytraGliding: false,
      wingSpread: 0.18,
      pitchAngle: 0,
      radius: 20,
      height: 64,
      weaponType: ch.starterWeapon || 'pencil'
    };
  }

  // --------------------------------------------------------------------------
  // 1. WEAPON ARSENAL METHODS
  // --------------------------------------------------------------------------
  getUnlockedWeaponList(isCreative = false) {
    if (isCreative) return BOSS_WEAPON_CATALOG.map((w) => w.id);
    const list = [];
    for (const w of BOSS_WEAPON_CATALOG) {
      if (this.unlockedWeapons.has(w.id)) list.push(w.id);
    }
    return list.length > 0 ? list : ['pencil'];
  }

  unlockWeapon(weaponId, announcePos = null) {
    const meta = BOSS_WEAPON_CATALOG.find((w) => w.id === weaponId);
    if (!meta) return false;
    const isNew = !this.unlockedWeapons.has(weaponId);
    this.unlockedWeapons.add(weaponId);
    if (save.data) {
      save.data.unlockedWeapons = [...this.unlockedWeapons];
      save.flush?.();
    }
    if (isNew && announcePos) {
      audio.playUpgradeBuy?.();
      particles.addTextBanner(
        announcePos.x || 0,
        (announcePos.y || 0) - 115,
        `🔓 WEAPON UNLOCKED: ${meta.icon} ${meta.name.toUpperCase()}! [PRESS T]`,
        meta.color
      );
    }
    return isNew;
  }

  unlockWeaponsForBoss(bossType, pos = null) {
    const grants = BOSS_TO_WEAPONS[bossType];
    if (!grants) return [];
    const unlockedNow = [];
    for (const wId of grants) {
      if (this.unlockWeapon(wId, pos)) unlockedNow.push(wId);
    }
    return unlockedNow;
  }

  cycleWeapon(player, isCreative = false, dir = 1) {
    if (!player) return 'pencil';
    const list = this.getUnlockedWeaponList(isCreative);
    if (list.length <= 1) {
      particles.addDamageText(player.x, player.y - 78, 'DEFEAT BOSSES TO UNLOCK WEAPONS!', false, '#fbbf24');
      return player.weaponType || 'pencil';
    }
    const idx = list.indexOf(player.weaponType);
    const nextIdx = (idx < 0 ? 0 : (idx + dir + list.length) % list.length);
    const nextId = list[nextIdx];
    player.weaponType = nextId;
    player.temporaryWeaponTimer = 0;
    const meta = BOSS_WEAPON_CATALOG.find((w) => w.id === nextId) || BOSS_WEAPON_CATALOG[0];
    audio.playMouseClick?.();
    particles.addDamageText(player.x, player.y - 78, `${meta.icon} ${meta.name.toUpperCase()}`, false, meta.color);
    return nextId;
  }

  // --------------------------------------------------------------------------
  // 2. PLAYABLE CHARACTER SELECT METHODS
  // --------------------------------------------------------------------------
  setCharacter(charId, player = null) {
    const def = getCharacterDef(charId);
    this.selectedCharacter = def.id;
    if (save.data) {
      save.data.selectedCharacter = def.id;
      save.flush?.();
    }
    if (player) this.applyCharacterToPlayer(player);
    return def;
  }

  applyCharacterToPlayer(player) {
    if (!player) return null;
    const def = getCharacterDef(this.selectedCharacter);
    player.characterId = def.id;
    player.hasCrown = def.hasCrown;
    player.hasElytra = def.hasElytra;
    player.isElytraGliding = false;
    player.wingSpread = 0.18;
    player.pitchAngle = 0;

    // Reset baseline from character bonuses cleanly once per player instance
    if (!player._charBaseRecorded) {
      player._charBaseRecorded = true;
      player._baseMaxHp = player.maxHp;
      player._baseSpeed = player.speed;
      player._baseDmgMult = player.damageMultiplier;
      player._baseSuperGain = player.superGainRate;
    }
    const prevBonusHp = player._appliedCharHpBonus || 0;
    player.maxHp = Math.max(60, player.maxHp - prevBonusHp + def.hpBonus);
    player.hp = Math.min(player.maxHp, player.hp + Math.max(0, def.hpBonus - prevBonusHp));
    player._appliedCharHpBonus = def.hpBonus;

    const prevBonusSpd = player._appliedCharSpeedBonus || 0;
    player.speed = player.speed - prevBonusSpd + def.speedBonus;
    player._appliedCharSpeedBonus = def.speedBonus;

    const prevDmgMult = player._appliedCharDmgMult || 1.0;
    player.damageMultiplier = (player.damageMultiplier / prevDmgMult) * def.damageMult;
    player._appliedCharDmgMult = def.damageMult;

    const prevSuperBonus = player._appliedCharSuperBonus || 0;
    player.superGainRate = player.superGainRate - prevSuperBonus + def.superGainBonus;
    player._appliedCharSuperBonus = def.superGainBonus;

    // Update 2D StickFigureRenderer appearance
    if (player.renderer) {
      player.renderer.color = def.color;
      player.renderer.isHollowHead = def.isHollowHead;
    }

    // King Orange unlocks & starts with the Command Staff!
    if (def.starterWeapon === 'staff') {
      this.unlockedWeapons.add('staff');
      if (player._charStarterApplied !== def.id || !player.weaponType || player.weaponType === 'pencil') {
        player.weaponType = 'staff';
      }
    } else if (player._charStarterApplied === 'king' && player.weaponType === 'staff' && !save.data?.unlockedWeapons?.includes('staff')) {
      player.weaponType = 'pencil';
    }
    player._charStarterApplied = def.id;
    return def;
  }

  updateCharacterPassives(player, dt, input, zombies, camera, groundY) {
    if (!player || player.isDead) return;
    const def = getCharacterDef(this.selectedCharacter);

    // Purple: Hold SPACE in mid-air while descending to glide with Elytra!
    if (def.hasElytra) {
      const wantsGlide = !player.isGrounded && !player.isCreativeFlight && !player.diveKick && Boolean(input?.actions?.jump) && player.vy > 35;
      if (wantsGlide) {
        player.isElytraGliding = true;
        player.vy = Math.min(player.vy, 115);
        const dir = input.actions.right ? 1 : (input.actions.left ? -1 : (player.facing || 1));
        player.facing = dir;
        player.vx = clamp(player.vx + dir * 640 * dt, -520, 520);
        player.pose = 'elytra_glide';
        player.wingSpread = Math.min(1.0, (player.wingSpread || 0.2) + dt * 7);
        player.pitchAngle = clamp(Math.atan2(player.vy, Math.max(90, Math.abs(player.vx))), -0.35, 0.45);
        if (Math.random() < 0.35) {
          particles.createHitSparks(player.x - player.facing * 18, player.y - 26, 1, '#e9d5ff');
        }
      } else {
        player.isElytraGliding = false;
        player.wingSpread = Math.max(0.18, (player.wingSpread || 0.18) - dt * 6);
        player.pitchAngle = (player.pitchAngle || 0) * Math.max(0, 1 - dt * 12);
      }
    }

    // Chosen One: Fire Dash burns enemies passed during Dodge Roll!
    if (def.id === 'chosen' && player.isRolling) {
      if (Math.random() < 0.5) particles.createHitSparks(player.x, player.y - 26, 2, '#f97316');
      player._fireDashTick = (player._fireDashTick || 0) - dt;
      if (player._fireDashTick <= 0) {
        player._fireDashTick = 0.12;
        for (const z of zombies || []) {
          if (!z || z.isDead) continue;
          if (Math.abs(z.x - player.x) < 62 && Math.abs(z.y - player.y) < 70) {
            z.takeDamage?.(24, player.facing, 320, false);
            particles.createHitSparks(z.x, z.y - 30, 5, '#ff5500');
          }
        }
      }
    }

    // Blue: Gentle Alchemist HP regen
    if (def.id === 'blue' && player.hp > 0 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 2.5 * dt);
    }

    // Yellow: Faster Sketch Block/Anvil cooldown
    if (def.id === 'yellow' && player.blockCooldown > 2.2) {
      player.blockCooldown = 2.2;
    }

    // Firework Rocket boost timer
    if (this.fireworkBoostTimer > 0) {
      this.fireworkBoostTimer = Math.max(0, this.fireworkBoostTimer - dt);
      if (Math.random() < 0.5) particles.createHitSparks(player.x - player.facing * 14, player.y - 28, 2, '#f43f5e');
    }

    // Golden Apple Shield timer
    if (this.goldenShieldTimer > 0) {
      this.goldenShieldTimer = Math.max(0, this.goldenShieldTimer - dt);
      player.iFrames = Math.max(player.iFrames || 0, 0.15);
    }

    // Perk: Vampiric Combos (every 5th combo hit heals +8 HP)
    if (this.activePerks.has('vampiric_combo')) {
      const tier = Math.floor((combat.combo || 0) / 5);
      if (tier > this.prevComboForVamp) {
        this.prevComboForVamp = tier;
        player.heal?.(8);
        player.addSuper?.(6);
        particles.addDamageText(player.x, player.y - 54, '+8 HP 🩸', false, '#f43f5e');
      } else if ((combat.combo || 0) < 5) {
        this.prevComboForVamp = 0;
      }
    }

    // Perk: Slime Bounce Boots landing shockwave
    if (this.activePerks.has('slime_boots') && player.isGrounded && !player._wasGroundedPerk && (player._peakAirVy || 0) > 420) {
      particles.addShockwave(player.x, groundY, 125, '#4ade80', 7);
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        if (Math.abs(z.x - player.x) <= 135 && Math.abs(z.y - groundY) < 70) {
          z.takeDamage?.(35, z.x >= player.x ? 1 : -1, 440, false);
        }
      }
    }
    player._peakAirVy = player.isGrounded ? 0 : Math.max(player._peakAirVy || 0, player.vy || 0);
    player._wasGroundedPerk = player.isGrounded;
  }

  onPlayerMeleeOrWeaponHit(player, zombies, camera, isWeapon = false) {
    if (!player) return;
    const def = getCharacterDef(this.selectedCharacter);

    // Perfect Dodge Counter bonus!
    if (player.perfectCounterReady) {
      player.perfectCounterReady = false;
      const nearby = (zombies || []).filter((z) => z && !z.isDead && Math.abs(z.x - player.x) < 170);
      for (const z of nearby.slice(0, 3)) {
        z.takeDamage?.(55 * (player.damageMultiplier || 1), player.facing, 560, true);
        particles.createHitSparks(z.x, z.y - 32, 10, '#00f5ff');
      }
      if (nearby.length > 0) {
        particles.addComicPopup(player.x + player.facing * 50, player.y - 68, 'COUNTER CRIT!', '#00f5ff', '#ffffff');
      }
    }

    // Blue passive: chill hit zombies
    if (def.id === 'blue') {
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        if (Math.abs(z.x - player.x) < 145 && z.hurtTimer > 0) {
          z.applyFreeze?.(2.0);
        }
      }
    }

    // Yellow passive: electric zap spark
    if (def.id === 'yellow') {
      const target = (zombies || []).find((z) => z && !z.isDead && Math.abs(z.x - player.x) < 185);
      if (target) {
        target.takeDamage?.(14, player.facing, 180, false);
        particles.createHitSparks(target.x, target.y - 34, 5, '#facc15');
      }
    }

    // Green passive: combo finisher sonic pulse
    if (def.id === 'green' && player.comboStep === 5) {
      particles.addShockwave(player.x, player.y - 24, 180, '#33dd66', 8);
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        if (Math.abs(z.x - player.x) < 190) z.applyStun?.(1.6);
      }
    }

    // Red passive OR Explosive Dive Kick perk
    if ((def.id === 'red' || this.activePerks.has('explosive_dive')) && player.diveKick) {
      particles.addShockwave(player.x, player.y - 12, 185, '#ff3344', 11);
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        if (Math.abs(z.x - player.x) < 195) {
          z.takeDamage?.(this.activePerks.has('explosive_dive') ? 95 : 42, z.x >= player.x ? 1 : -1, 540, true);
        }
      }
    }

    // Chain-Lightning Strikes perk
    if (isWeapon && this.activePerks.has('chain_lightning')) {
      const targets = (zombies || [])
        .filter((z) => z && !z.isDead && Math.abs(z.x - player.x) < 320)
        .sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))
        .slice(0, 2);
      for (const z of targets) {
        z.takeDamage?.(38, z.x >= player.x ? 1 : -1, 220, true);
        particles.createHitSparks(z.x, z.y - 36, 8, '#38bdf8');
      }
    }

    // TNT Grab-Throws perk
    if (this.activePerks.has('tnt_grab') && player.activeMove?.action === 'grab') {
      particles.addShockwave(player.x + player.facing * 60, player.y - 24, 210, '#ef4444', 11);
      particles.addComicPopup(player.x + player.facing * 60, player.y - 68, 'TNT GRAB!', '#ef4444', '#fde047');
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        if (Math.abs(z.x - (player.x + player.facing * 60)) < 210) {
          z.takeDamage?.(85, z.x >= player.x ? 1 : -1, 560, true);
        }
      }
    }
  }

  drawPlayerCharacterOverlay2D(ctx, player) {
    if (!player || player.isDead) return;
    if (player.hasElytra) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.scale((player.facing >= 0 ? 1 : -1), 1);
      drawPurpleElytraWings2D(ctx, {
        pose: player.isElytraGliding ? 'elytra_glide' : player.pose,
        wingSpread: player.wingSpread ?? 0.2,
        timer: player.animTimer || 0
      }, false);
      ctx.restore();
    }
    if (player.hasCrown) {
      ctx.save();
      ctx.fillStyle = this.playerCrownColor;
      ctx.fillRect(player.x - 13, player.y - 84, 26, 6);
      ctx.fillRect(player.x - 11, player.y - 92, 5, 8);
      ctx.fillRect(player.x - 2.5, player.y - 96, 5, 12);
      ctx.fillRect(player.x + 6, player.y - 92, 5, 8);
      ctx.restore();
    }
    if (this.goldenShieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(player.x, player.y - 34, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // 4. TAG-TEAM ALLY COMBO SYNERGIES
  // --------------------------------------------------------------------------
  updateAllySynergies(dt, allies, player, zombies, camera, groundY) {
    for (const k of Object.keys(this.synergyCooldowns)) {
      if (this.synergyCooldowns[k] > 0) this.synergyCooldowns[k] = Math.max(0, this.synergyCooldowns[k] - dt);
    }
    const active = allies?.activeAllies || [];
    const hasType = (t) => active.find((a) => a && a.type === t && !a.isDead && !a.retreating);

    // 1. Purple + King Orange -> SKY COMMAND DIVE!
    const purple = hasType('purple');
    const king = hasType('king');
    if (purple && king && purple.hasActed && this.synergyCooldowns.purple_king <= 0) {
      this.synergyCooldowns.purple_king = 6.0;
      this.triggeredSynergies.push('purple_king');
      camera?.addShake?.(0.55);
      audio.playAwakening?.();
      particles.addShockwave(purple.x, groundY - 24, 300, '#f59e0b', 13);
      particles.addTextBanner(purple.x, groundY - 105, '⚡ TAG-TEAM: SKY COMMAND DIVE! ⚡', '#fde047');
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        if (Math.abs(z.x - purple.x) <= 320) {
          z.takeDamage?.(90, purple.facing || 1, 680, true);
        }
      }
    }

    // 2. Blue + Yellow Turret -> FROST TURRET OVERCLOCK!
    const blue = hasType('blue');
    const turrets = allies?.turrets || [];
    if (blue && turrets.length > 0 && this.synergyCooldowns.blue_yellow <= 0) {
      this.synergyCooldowns.blue_yellow = 7.0;
      this.triggeredSynergies.push('blue_yellow');
      for (const t of turrets) {
        t.isFrostTurret = true;
        t.duration = Math.max(t.duration, 10.0);
        particles.addShockwave(t.x, t.y - 24, 150, '#38bdf8', 9);
      }
      particles.addTextBanner(blue.x, groundY - 96, '❄️ TAG-TEAM: FROST TURRET! ❄️', '#38bdf8');
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        z.applyFreeze?.(4.5);
      }
    }

    // 3. Red + Green -> BASS METEOR DUNK!
    const red = hasType('red');
    const green = hasType('green');
    if (red && green && this.synergyCooldowns.red_green <= 0) {
      this.synergyCooldowns.red_green = 6.5;
      this.triggeredSynergies.push('red_green');
      camera?.addShake?.(0.65);
      audio.playFinisherImpact?.();
      particles.addShockwave(red.x, groundY - 18, 290, '#33dd66', 12);
      particles.addTextBanner(red.x, groundY - 102, '🎵 TAG-TEAM: BASS METEOR DUNK! 🎵', '#4ade80');
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        if (Math.abs(z.x - red.x) <= 310) {
          z.takeDamage?.(85, z.x >= red.x ? 1 : -1, 740, true);
          if (!z.isBoss && typeof z.vy === 'number') z.vy = -420;
        }
      }
    }

    // 4. The Chosen One + Awakened Orange -> TWIN HOLLOW BEAM!
    const chosen = hasType('chosen');
    if (chosen && player?.isAwakened && this.synergyCooldowns.tco_orange <= 0) {
      this.synergyCooldowns.tco_orange = 7.5;
      this.triggeredSynergies.push('tco_orange');
      camera?.addShake?.(0.75);
      audio.playAwakening?.();
      particles.addShockwave(player.x + player.facing * 240, player.y - 36, 420, '#ff3344', 15);
      particles.addTextBanner(player.x, player.y - 115, '🔥 TAG-TEAM: TWIN HOLLOW BEAM! 🔥', '#ffea00');
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        if ((z.x - player.x) * player.facing >= -60 && Math.abs(z.x - player.x) <= 680) {
          z.takeDamage?.(160, player.facing, 860, true);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. INTERACTIVE STAGE TOYS & LIVE APP MECHANICS + TROPHY ROOM REMATCH
  // --------------------------------------------------------------------------
  spawnStageToys(stageManager, groundY = 0) {
    this.stageToys.length = 0;
    this.videoPauseTimer = 0;
    this.slideWipeX = null;
    this.nearbyTrophyBoss = null;
    if (!stageManager) return;

    const theme = stageManager.theme;
    if (theme === 'overworld') {
      this.stageToys.push(
        { id: 'slime_l', kind: 'slime_pad', x: -520, y: groundY, width: 88, height: 22, bounceCooldown: 0 },
        { id: 'slime_r', kind: 'slime_pad', x: 520, y: groundY, width: 88, height: 22, bounceCooldown: 0 },
        { id: 'minecart', kind: 'minecart', x: -160, y: groundY, vx: 0, width: 66, height: 42, activeTimer: 0, hitCooldown: 0 }
      );
    } else if (theme === 'lucky_orb') {
      this.stageToys.push(
        { id: 'slime_lucky_l', kind: 'slime_pad', x: -420, y: groundY, width: 88, height: 22, bounceCooldown: 0 },
        { id: 'slime_lucky_r', kind: 'slime_pad', x: 420, y: groundY, width: 88, height: 22, bounceCooldown: 0 }
      );
    } else if (theme === 'youtube') {
      this.stageToys.push({
        id: 'yt_pause',
        kind: 'app_pause_btn',
        x: 0,
        y: groundY,
        width: 78,
        height: 54,
        cooldown: 0,
        label: '⏸️ PAUSE'
      });
    } else if (theme === 'spotify') {
      this.stageToys.push({
        id: 'sp_skip',
        kind: 'app_skip_btn',
        x: 0,
        y: groundY,
        width: 78,
        height: 54,
        cooldown: 0,
        label: '⏭️ SKIP'
      });
    } else if (theme === 'slides') {
      this.stageToys.push({
        id: 'sl_present',
        kind: 'app_present_btn',
        x: 0,
        y: groundY,
        width: 96,
        height: 54,
        cooldown: 0,
        label: '▶ PRESENT'
      });
    }
  }

  triggerStageToy(toy, actor, zombies, camera, groundY = 0) {
    if (!toy || (toy.cooldown || 0) > 0) return false;

    if (toy.kind === 'minecart') {
      const dir = (actor?.facing || 1) >= 0 ? 1 : -1;
      toy.vx = dir * 640;
      toy.activeTimer = 2.4;
      audio.playBlockPlace?.();
      particles.addComicPopup(toy.x, toy.y - 54, 'CHOO CHOO!', '#facc15', '#111827');
      return true;
    }

    if (toy.kind === 'app_pause_btn') {
      toy.cooldown = 9.0;
      this.videoPauseTimer = 3.5;
      audio.playMouseClick?.();
      camera?.addShake?.(0.28);
      particles.addTextBanner(toy.x, groundY - 120, '⏸️ VIDEO PAUSED — ENEMIES FROZEN! ⏸️', '#ef4444');
      for (const z of zombies || []) {
        if (z && !z.isDead) z.applyFreeze?.(3.5);
      }
      return true;
    }

    if (toy.kind === 'app_skip_btn') {
      toy.cooldown = 8.0;
      audio.playWaveStart?.();
      camera?.addShake?.(0.5);
      particles.addShockwave(toy.x, groundY - 30, 520, '#22c55e', 14);
      particles.addTextBanner(toy.x, groundY - 120, '⏭️ NEXT TRACK — BASS DROP! ⏭️', '#4ade80');
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        z.takeDamage?.(55, z.x >= toy.x ? 1 : -1, 680, true);
        z.applyStun?.(2.5);
      }
      return true;
    }

    if (toy.kind === 'app_present_btn') {
      toy.cooldown = 9.0;
      this.slideWipeX = -960;
      audio.playSlash?.();
      camera?.addShake?.(0.45);
      particles.addTextBanner(toy.x, groundY - 120, '📊 SLIDE TRANSITION WIPE! 📊', '#facc15');
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        z.takeDamage?.(75, 1, 780, true);
      }
      return true;
    }
    return false;
  }

  updateStageToys(dt, player, zombies, camera, stageManager, groundY, onTrophyRematch = null) {
    if (this.videoPauseTimer > 0) this.videoPauseTimer = Math.max(0, this.videoPauseTimer - dt);
    if (this.slideWipeX !== null) {
      this.slideWipeX += 1950 * dt;
      if (this.slideWipeX > 1050) this.slideWipeX = null;
    }

    // Interactive Trophy Room Boss Rematch Detection
    if (stageManager?.isTrophyRoom && player) {
      let nearest = null;
      let bestDist = 85;
      for (const m of TROPHY_MONUMENT_BOSSES) {
        const d = Math.abs(player.x - m.x);
        if (d < bestDist) {
          bestDist = d;
          nearest = m;
        }
      }
      this.nearbyTrophyBoss = nearest;
      if (nearest && player._trophyRematchTriggered && typeof onTrophyRematch === 'function') {
        player._trophyRematchTriggered = false;
        onTrophyRematch(nearest);
      }
    } else {
      this.nearbyTrophyBoss = null;
    }

    for (const toy of this.stageToys) {
      if (toy.cooldown > 0) toy.cooldown = Math.max(0, toy.cooldown - dt);
      if (toy.bounceCooldown > 0) toy.bounceCooldown = Math.max(0, toy.bounceCooldown - dt);

      if (toy.kind === 'slime_pad') {
        // Bounce Player
        if (player && !player.isDead && toy.bounceCooldown <= 0 &&
            Math.abs(player.x - toy.x) < toy.width * 0.56 &&
            Math.abs(player.y - toy.y) < 28 && (player.vy || 0) >= -30) {
          player.vy = -780;
          player.isGrounded = false;
          player.canDoubleJump = true;
          toy.bounceCooldown = 0.25;
          audio.playWhoosh?.();
          particles.addComicPopup(toy.x, toy.y - 44, 'BOING!', '#4ade80', '#052e16');
          particles.createHitSparks(toy.x, toy.y - 12, 8, '#86efac');
        }
        // Bounce Zombies too!
        for (const z of zombies || []) {
          if (!z || z.isDead || z.isBoss) continue;
          if (Math.abs(z.x - toy.x) < toy.width * 0.5 && Math.abs(z.y - toy.y) < 24 && (z.vy || 0) >= 0) {
            z.vy = -620;
            z.isGrounded = false;
          }
        }
      } else if (toy.kind === 'minecart') {
        if (toy.activeTimer > 0) {
          toy.activeTimer = Math.max(0, toy.activeTimer - dt);
          toy.x += toy.vx * dt;
          if (toy.x > 780) { toy.x = 780; toy.vx = -Math.abs(toy.vx) * 0.85; }
          if (toy.x < -780) { toy.x = -780; toy.vx = Math.abs(toy.vx) * 0.85; }
          toy.vx *= Math.pow(0.985, dt * 60);
          if (Math.abs(toy.vx) > 90) {
            for (const z of zombies || []) {
              if (!z || z.isDead) continue;
              if (Math.abs(z.x - toy.x) < 52 && Math.abs(z.y - toy.y) < 62) {
                z.takeDamage?.(120, Math.sign(toy.vx) || 1, 680, true);
                particles.createHitSparks(z.x, z.y - 30, 8, '#facc15');
              }
            }
          }
        }
        // Launch minecart if player attacks near it or runs into it hard
        if (player && !player.isDead && Math.abs(player.x - toy.x) < 66 && Math.abs(player.y - toy.y) < 56) {
          if (player.attackTimer > 0 || player.weaponTimer > 0 || Math.abs(player.vx) > 260) {
            if (Math.abs(toy.vx) < 180) {
              this.triggerStageToy(toy, player, zombies, camera, groundY);
            }
          }
        }
      } else if (toy.kind.startsWith('app_')) {
        // Trigger App Interactive Button when struck!
        if (player && !player.isDead && toy.cooldown <= 0 &&
            (player.attackTimer > 0 || player.weaponTimer > 0) &&
            Math.abs(player.x - toy.x) < 92 && Math.abs(player.y - toy.y) < 88) {
          this.triggerStageToy(toy, player, zombies, camera, groundY);
        }
      }
    }
  }

  drawStageToys2D(ctx, stageTime = 0, groundY = 0) {
    // Slide Wipe Curtain
    if (this.slideWipeX !== null) {
      ctx.save();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.fillRect(this.slideWipeX - 180, groundY - 560, 180, 560);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.slideWipeX, groundY - 560);
      ctx.lineTo(this.slideWipeX, groundY);
      ctx.stroke();
      ctx.restore();
    }

    // Trophy Room Rematch Prompt
    if (this.nearbyTrophyBoss) {
      const m = this.nearbyTrophyBoss;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.fillRect(m.x - 108, groundY - 178, 216, 30);
      ctx.strokeRect(m.x - 108, groundY - 178, 216, 30);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`[E] REMATCH: ${m.label.toUpperCase()}`, m.x, groundY - 159);
      ctx.restore();
    }

    for (const toy of this.stageToys) {
      ctx.save();
      if (toy.kind === 'slime_pad') {
        const squash = toy.bounceCooldown > 0 ? 1.2 : 1.0 + Math.sin(stageTime * 5) * 0.05;
        ctx.translate(toy.x, toy.y);
        ctx.scale(squash, 1 / squash);
        ctx.fillStyle = 'rgba(74, 222, 128, 0.82)';
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 3;
        ctx.fillRect(-toy.width / 2, -toy.height, toy.width, toy.height);
        ctx.strokeRect(-toy.width / 2, -toy.height, toy.width, toy.height);
        ctx.fillStyle = 'rgba(187, 247, 208, 0.7)';
        ctx.fillRect(-toy.width * 0.3, -toy.height + 5, toy.width * 0.6, 6);
      } else if (toy.kind === 'minecart') {
        ctx.translate(toy.x, toy.y);
        ctx.fillStyle = '#64748b';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.fillRect(-30, -34, 60, 26);
        ctx.strokeRect(-30, -34, 60, 26);
        ctx.fillStyle = '#334155';
        ctx.fillRect(-24, -28, 48, 12);
        // Wheels
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-18, -6, 7, 0, Math.PI * 2);
        ctx.arc(18, -6, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (toy.kind.startsWith('app_')) {
        const ready = (toy.cooldown || 0) <= 0;
        const accent = toy.kind === 'app_pause_btn' ? '#ef4444' : (toy.kind === 'app_skip_btn' ? '#22c55e' : '#facc15');
        ctx.translate(toy.x, toy.y);
        ctx.fillStyle = ready ? '#0f172a' : '#1e293b';
        ctx.strokeStyle = ready ? accent : '#475569';
        ctx.lineWidth = 3;
        ctx.fillRect(-toy.width / 2, -toy.height, toy.width, toy.height);
        ctx.strokeRect(-toy.width / 2, -toy.height, toy.width, toy.height);
        ctx.fillStyle = ready ? '#ffffff' : '#94a3b8';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ready ? toy.label : `${Math.ceil(toy.cooldown)}s`, 0, -toy.height / 2 + 4);
      }
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // 6. PERFECT DODGE, RARE LOOT DROPS & ROGUELIKE PERKS
  // --------------------------------------------------------------------------
  checkPerfectDodge(player, zombies, projManager, stageManager, camera) {
    if (!player || player.isDead) {
      this.prevRollState = false;
      return false;
    }
    const startedRoll = player.isRolling && !this.prevRollState;
    this.prevRollState = Boolean(player.isRolling);
    if (!startedRoll) return false;

    let nearDanger = false;
    for (const p of projManager?.projectiles || []) {
      if (p && p.isHostile && Math.hypot((p.x || 0) - player.x, (p.y || 0) - (player.y - 30)) < 155) {
        nearDanger = true;
        break;
      }
    }
    if (!nearDanger) {
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        if (Math.hypot(z.x - player.x, z.y - player.y) < 155) {
          nearDanger = true;
          break;
        }
      }
    }
    if (!nearDanger) {
      for (const l of stageManager?.laserHazards || []) {
        if (l && l.timer < l.activeDuration && Math.abs(player.x - (l.x + l.width * 0.5)) < l.width * 0.5 + 80) {
          nearDanger = true;
          break;
        }
      }
    }

    if (!nearDanger) return false;

    this.perfectDodgeCount++;
    player.perfectCounterReady = true;
    player.addSuper?.(18);
    audio.playFlashStep?.();
    camera?.addHitstop?.(0.05);
    camera?.addZoomPunch?.(0.055);
    particles.addShockwave(player.x, player.y - 28, 120, '#00f5ff', 8);
    particles.addComicPopup(player.x, player.y - 72, 'FRAME PERFECT!', '#00f5ff', '#0f172a');
    return true;
  }

  spawnLootDrop(x, y, forceKind = null) {
    if (this.lootDrops.length >= 6) this.lootDrops.shift();
    const kinds = ['golden_apple', 'firework_rocket', 'lucky_dice', 'glitch_bomb'];
    const kind = forceKind || kinds[Math.floor(Math.random() * kinds.length)];
    this.lootDrops.push({
      kind,
      x: clamp(x, -900, 900),
      y: y - 24,
      vy: -160,
      life: 14.0,
      bobPhase: Math.random() * Math.PI * 2
    });
  }

  handleEnemyDefeated(z, groundY = 0) {
    if (!z || this.prevDeadEnemies.has(z)) return false;
    this.prevDeadEnemies.add(z);
    if (this.activePerks.has('golden_magnet') && Number.isFinite(z.inkReward)) {
      combat.ink += Math.round(z.inkReward * 0.5);
    }
    if (z.isBoss) {
      this.unlockWeaponsForBoss(z.type, z);
      this.spawnLootDrop(z.x - 36, groundY, 'golden_apple');
      this.spawnLootDrop(z.x + 36, groundY, 'lucky_dice');
    } else {
      const dropChance = (this.activePerks.has('golden_magnet') || this.endlessMutator?.id === 'ink_jackpot') ? 0.36 : 0.18;
      if (Math.random() < dropChance) {
        this.spawnLootDrop(z.x, groundY);
      }
    }
    return true;
  }

  installKillHook(getGroundY = () => 0) {
    combat._activeMegaController = this;
    combat._activeMegaGroundY = getGroundY;
    if (combat._megaKillHookInstalled) return;
    combat._megaKillHookInstalled = true;
    const origRegisterKill = combat.registerKill.bind(combat);
    combat.registerKill = (enemy) => {
      const res = origRegisterKill(enemy);
      const ctrl = combat._activeMegaController;
      if (ctrl && enemy) {
        const gY = typeof combat._activeMegaGroundY === 'function' ? combat._activeMegaGroundY() : 0;
        ctrl.handleEnemyDefeated(enemy, gY);
      }
      return res;
    };
  }

  updateLootDrops(dt, player, zombies, allies, groundY, camera) {
    // Check newly defeated enemies to trigger loot drops + Boss Weapon Unlocks
    for (const z of zombies || []) {
      if (z && z.isDead) {
        this.handleEnemyDefeated(z, groundY);
      }
    }

    for (let i = this.lootDrops.length - 1; i >= 0; i--) {
      const d = this.lootDrops[i];
      d.life -= dt;
      d.bobPhase += dt * 4.5;
      if (d.y < groundY - 20) {
        d.vy += 650 * dt;
        d.y = Math.min(groundY - 20, d.y + d.vy * dt);
      }
      if (d.life <= 0) {
        this.lootDrops.splice(i, 1);
        continue;
      }

      if (player && !player.isDead && Math.hypot(player.x - d.x, (player.y - 30) - d.y) < 58) {
        this.collectLootDrop(d, player, zombies, allies, camera, groundY);
        this.lootDrops.splice(i, 1);
      }
    }
  }

  collectLootDrop(drop, player, zombies, allies, camera, groundY) {
    audio.playUpgradeBuy?.();
    if (drop.kind === 'golden_apple') {
      player.heal?.(40);
      this.goldenShieldTimer = 3.5;
      particles.addTextBanner(player.x, player.y - 84, '🍎 GOLDEN APPLE! +40 HP + SHIELD', '#facc15');
    } else if (drop.kind === 'firework_rocket') {
      this.fireworkBoostTimer = 3.5;
      player.vx = (player.facing || 1) * 650;
      particles.addShockwave(player.x, player.y - 28, 220, '#f43f5e', 11);
      particles.addTextBanner(player.x, player.y - 84, '🎆 FIREWORK BOOST! 🎆', '#fb7185');
      for (const z of zombies || []) {
        if (z && !z.isDead && Math.abs(z.x - player.x) <= 230) {
          z.takeDamage?.(120, player.facing || 1, 680, true);
        }
      }
    } else if (drop.kind === 'lucky_dice') {
      const roll = Math.floor(Math.random() * 3);
      if (roll === 0) {
        combat.ink += 120;
        particles.addTextBanner(player.x, player.y - 84, '🎲 LUCKY DICE: +120 INK!', '#facc15');
      } else if (roll === 1) {
        player.superMeter = player.maxSuper;
        particles.addTextBanner(player.x, player.y - 84, '🎲 LUCKY DICE: FULL AWAKENING!', '#38bdf8');
      } else {
        const allyPick = ['red', 'purple', 'chosen'][Math.floor(Math.random() * 3)];
        if (allies?.cooldowns) allies.cooldowns[allyPick] = 0;
        allies?.summonAlly?.(allyPick, player.x, groundY, player.facing, zombies);
        particles.addTextBanner(player.x, player.y - 84, `🎲 LUCKY DICE: FREE ${allyPick.toUpperCase()}!`, '#c084fc');
      }
    } else if (drop.kind === 'glitch_bomb') {
      camera?.addShake?.(0.45);
      particles.addShockwave(drop.x, groundY - 24, 290, '#38bdf8', 12);
      particles.addTextBanner(drop.x, groundY - 88, '⚡ GLITCH BOMB DETONATED! ⚡', '#38bdf8');
      for (const z of zombies || []) {
        if (z && !z.isDead && Math.abs(z.x - drop.x) <= 300) {
          z.takeDamage?.(95, z.x >= drop.x ? 1 : -1, 520, true);
          z.applyStun?.(2.5);
        }
      }
    }
  }

  drawLootDrops2D(ctx) {
    const iconMap = {
      golden_apple: { icon: '🍎', color: '#facc15' },
      firework_rocket: { icon: '🎆', color: '#f43f5e' },
      lucky_dice: { icon: '🎲', color: '#c084fc' },
      glitch_bomb: { icon: '⚡', color: '#38bdf8' }
    };
    for (const d of this.lootDrops) {
      const meta = iconMap[d.kind] || iconMap.golden_apple;
      const bob = Math.sin(d.bobPhase) * 5;
      ctx.save();
      ctx.translate(d.x, d.y + bob);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.icon, 0, 1);
      ctx.restore();
    }
  }

  rollPerkChoices(count = 3) {
    const pool = ROGUELIKE_PERKS.filter((p) => !this.activePerks.has(p.id));
    const source = pool.length >= count ? [...pool] : [...ROGUELIKE_PERKS];
    const picked = [];
    while (picked.length < count && source.length > 0) {
      const idx = Math.floor(Math.random() * source.length);
      picked.push(source.splice(idx, 1)[0]);
    }
    this.perkOfferings = picked;
    return picked;
  }

  applyPerk(perkId, player, allies) {
    const perk = ROGUELIKE_PERKS.find((p) => p.id === perkId);
    if (!perk) return false;
    this.activePerks.add(perkId);
    if (perkId === 'double_ally' && allies?.maxCooldowns) {
      for (const k of Object.keys(allies.maxCooldowns)) {
        allies.maxCooldowns[k] = Math.max(4, allies.maxCooldowns[k] * 0.65);
      }
    } else if (perkId === 'mega_awakening' && player) {
      player.superGainRate = (player.superGainRate || 1) + 0.35;
      player.awakenedDuration = (player.awakenedDuration || 8) + 3.5;
    } else if (perkId === 'slime_boots' && player) {
      player.jumpForce = (player.jumpForce || 580) + 110;
    }
    audio.playUpgradeBuy?.();
    if (player) {
      particles.addTextBanner(player.x, player.y - 96, `✨ PERK: ${perk.icon} ${perk.name.toUpperCase()}!`, '#facc15');
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // 7. LOCAL 2-PLAYER CO-OP & 1V1 STICKMAN VERSUS
  // --------------------------------------------------------------------------
  startP2Mode(mode = 'coop', player1 = null, groundY = 0) {
    const ch = getCharacterDef(this.p2Character);
    this.p2 = this.createP2State();
    this.p2.active = true;
    this.p2.mode = mode;
    this.p2.x = mode === 'versus' ? 320 : clamp((player1?.x || -780) + 80, -900, 900);
    this.p2.y = groundY;
    this.p2.facing = mode === 'versus' ? -1 : 1;
    this.p2Renderer = new StickFigureRenderer(ch.color, 5.4, 1.0, ch.isHollowHead);
    if (mode === 'versus') {
      this.mode = 'versus';
      this.versusP1Wins = 0;
      this.versusP2Wins = 0;
      this.versusRound = 1;
      this.versusWinner = null;
      this.versusRoundResetTimer = 0;
      if (player1) {
        player1.x = -320;
        player1.y = groundY;
        player1.facing = 1;
        player1.hp = player1.maxHp;
        player1.isDead = false;
      }
    }
    return this.p2;
  }

  stopP2Mode() {
    this.p2.active = false;
    if (this.mode === 'versus') this.mode = 'campaign';
  }

  handleP2KeyDown(code) {
    if (!this.p2Keys[code]) this.p2KeysPressed[code] = true;
    this.p2Keys[code] = true;
  }

  handleP2KeyUp(code) {
    this.p2Keys[code] = false;
  }

  endP2Frame() {
    for (const k of Object.keys(this.p2KeysPressed)) this.p2KeysPressed[k] = false;
  }

  // Decouple Arrow keys from P1 when P2 is active so 2 players share 1 keyboard seamlessly!
  isolateP1InputsForCoop(input) {
    if (!this.p2.active || !input?.keys) return;
    input.actions.left = Boolean(input.keys.KeyA || input.touch?.left);
    input.actions.right = Boolean(input.keys.KeyD || input.touch?.right);
    input.actions.up = Boolean(input.touch?.up);
    input.actions.down = Boolean(input.keys.KeyS || input.touch?.down);
    input.actions.jump = Boolean(input.keys.Space || input.touch?.jump);
    input.actions.jumpPressed = Boolean(input.keysPressed?.Space || input.touch?.jumpPressed);
  }

  updateP2(dt, player1, zombies, groundY, platforms = [], camera = null) {
    const p2 = this.p2;
    if (!p2.active) return;

    p2.animTimer += dt;
    if (p2.iFrames > 0) p2.iFrames = Math.max(0, p2.iFrames - dt);
    if (p2.hurtTimer > 0) {
      p2.hurtTimer = Math.max(0, p2.hurtTimer - dt);
      if (p2.hurtTimer <= 0) p2.isHurt = false;
    }
    if (p2.rollCooldown > 0) p2.rollCooldown = Math.max(0, p2.rollCooldown - dt);
    if (p2.attackTimer > 0) p2.attackTimer = Math.max(0, p2.attackTimer - dt);
    if (p2.weaponTimer > 0) p2.weaponTimer = Math.max(0, p2.weaponTimer - dt);

    // Versus Round Reset Handling
    if (p2.mode === 'versus' && this.versusRoundResetTimer > 0) {
      this.versusRoundResetTimer -= dt;
      if (this.versusRoundResetTimer <= 0 && !this.versusWinner) {
        this.versusRound++;
        p2.x = 320; p2.y = groundY; p2.vx = 0; p2.vy = 0; p2.hp = p2.maxHp; p2.isDead = false; p2.facing = -1;
        if (player1) {
          player1.x = -320; player1.y = groundY; player1.vx = 0; player1.vy = 0;
          player1.hp = player1.maxHp; player1.isDead = false; player1.facing = 1;
        }
        particles.addTextBanner(0, groundY - 110, `⚔️ ROUND ${this.versusRound} — FIGHT! ⚔️`, '#facc15');
      }
      return;
    }

    // Co-op auto-revive if P2 is downed
    if (p2.isDead) {
      if (p2.mode === 'coop') {
        p2.respawnTimer -= dt;
        if (p2.respawnTimer <= 0) {
          p2.isDead = false;
          p2.hp = p2.maxHp;
          p2.x = clamp((player1?.x || 0) + 60, -880, 880);
          p2.y = groundY - 120;
          p2.iFrames = 1.5;
          particles.addTextBanner(p2.x, groundY - 90, '✨ PLAYER 2 REVIVED! ✨', '#c084fc');
        }
      }
      return;
    }

    const ch = getCharacterDef(p2.characterId);
    const left = Boolean(this.p2Keys.ArrowLeft);
    const right = Boolean(this.p2Keys.ArrowRight);
    const jumpPressed = Boolean(this.p2KeysPressed.ArrowUp || this.p2KeysPressed.Numpad0);
    const jumpHeld = Boolean(this.p2Keys.ArrowUp || this.p2Keys.Numpad0);
    const atkPressed = Boolean(this.p2KeysPressed.Numpad1 || this.p2KeysPressed.Slash);
    const wpnPressed = Boolean(this.p2KeysPressed.Numpad2 || this.p2KeysPressed.Period);
    const rollPressed = Boolean(this.p2KeysPressed.Numpad3 || this.p2KeysPressed.Comma);

    if (rollPressed && p2.rollCooldown <= 0) {
      p2.rollTimer = 0.28;
      p2.rollCooldown = 0.7;
      p2.iFrames = 0.32;
      audio.playDodge?.();
    }

    if (p2.rollTimer > 0) {
      p2.rollTimer = Math.max(0, p2.rollTimer - dt);
      p2.vx = p2.facing * 500;
      p2.pose = 'roll';
    } else {
      const moveDir = (right ? 1 : 0) - (left ? 1 : 0);
      const maxSpd = 360 + (ch.speedBonus || 0);
      if (moveDir !== 0) {
        p2.facing = moveDir;
        p2.vx = clamp(p2.vx + moveDir * 2200 * dt, -maxSpd, maxSpd);
      } else {
        p2.vx *= Math.pow(0.75, dt * 60);
        if (Math.abs(p2.vx) < 8) p2.vx = 0;
      }

      if (jumpPressed) {
        if (p2.isGrounded) {
          p2.vy = -590;
          p2.isGrounded = false;
          p2.canDoubleJump = true;
          audio.playJump?.();
        } else if (p2.canDoubleJump) {
          p2.vy = -540;
          p2.canDoubleJump = false;
          audio.playJump?.();
        }
      }

      // P2 Combat Attacks
      if ((atkPressed || wpnPressed) && p2.attackTimer <= 0 && p2.weaponTimer <= 0) {
        const isHeavy = wpnPressed;
        if (isHeavy) {
          p2.weaponTimer = 0.34;
          p2.pose = 'weapon_slash';
          audio.playSlash?.();
        } else {
          p2.attackTimer = 0.22;
          p2.pose = 'attack_cross';
          audio.playPunch?.('heavy');
        }
        const dmg = (isHeavy ? 42 : 26) * (ch.damageMult || 1);
        const reach = isHeavy ? 145 : 105;

        if (p2.mode === 'versus' && player1 && !player1.isDead) {
          if (Math.abs(player1.x - (p2.x + p2.facing * 45)) <= reach && Math.abs(player1.y - p2.y) <= 78) {
            player1._pendingDamageCause = 'Player 2 won the 1v1 Stickman Duel!';
            player1.takeDamage(dmg, p2.facing, isHeavy ? 520 : 340);
            particles.createHitSparks(player1.x, player1.y - 32, 10, ch.color);
            camera?.addShake?.(0.24);
          }
        } else {
          for (const z of zombies || []) {
            if (!z || z.isDead) continue;
            if (Math.abs(z.x - (p2.x + p2.facing * 48)) <= reach && Math.abs(z.y - p2.y) <= 84) {
              z.takeDamage?.(dmg, p2.facing, isHeavy ? 580 : 380, isHeavy);
              combat.registerHit?.(dmg, isHeavy);
              particles.createHitSparks(z.x, z.y - 32, 8, ch.color);
            }
          }
        }
      }
    }

    // P2 Elytra Glide if Purple!
    if (ch.hasElytra && !p2.isGrounded && jumpHeld && p2.vy > 35) {
      p2.isElytraGliding = true;
      p2.vy = Math.min(p2.vy, 110);
      p2.wingSpread = Math.min(1.0, p2.wingSpread + dt * 7);
      p2.pose = 'elytra_glide';
    } else {
      p2.isElytraGliding = false;
      p2.wingSpread = Math.max(0.18, p2.wingSpread - dt * 6);
    }

    // P2 Physics
    p2.vy += 1250 * dt;
    p2.x = clamp(p2.x + p2.vx * dt, -ARENA_BOUND, ARENA_BOUND);
    p2.y += p2.vy * dt;
    if (p2.y >= groundY) {
      p2.y = groundY;
      p2.vy = 0;
      p2.isGrounded = true;
      p2.canDoubleJump = true;
    } else {
      p2.isGrounded = false;
    }

    // Simple platform landing for P2
    if (p2.vy >= 0) {
      for (const plat of platforms || []) {
        const hw = (plat.width || 60) * 0.5;
        const pTop = plat.y - (plat.height || 20);
        if (p2.x >= plat.x - hw && p2.x <= plat.x + hw && p2.y >= pTop && p2.y <= pTop + 20) {
          p2.y = pTop;
          p2.vy = 0;
          p2.isGrounded = true;
          p2.canDoubleJump = true;
        }
      }
    }

    if (p2.rollTimer <= 0 && p2.attackTimer <= 0 && p2.weaponTimer <= 0 && !p2.isElytraGliding) {
      if (!p2.isGrounded) p2.pose = p2.vy < 0 ? 'jump_rise' : 'jump_fall';
      else p2.pose = Math.abs(p2.vx) > 25 ? 'run' : 'idle';
    }

    // In 1v1 Versus, check P1 attacks hitting P2!
    if (p2.mode === 'versus' && player1 && !player1.isDead && p2.iFrames <= 0) {
      if ((player1.attackTimer > 0 || player1.weaponTimer > 0) &&
          Math.abs(p2.x - (player1.x + player1.facing * 52)) < 115 &&
          Math.abs(p2.y - player1.y) < 82) {
        const p1Dmg = (player1.weaponTimer > 0 ? 34 : 20) * (player1.damageMultiplier || 1);
        this.damageP2(p1Dmg, player1.facing, 440);
        camera?.addShake?.(0.24);
      }
    }

    // In 1v1 Versus, check Round KO!
    if (p2.mode === 'versus' && !this.versusWinner) {
      if (p2.hp <= 0 || (player1 && player1.hp <= 0)) {
        if (p2.hp <= 0) {
          p2.isDead = true;
          this.versusP1Wins++;
          particles.addTextBanner(0, groundY - 120, `🏆 P1 WINS ROUND ${this.versusRound}! (${this.versusP1Wins}-${this.versusP2Wins})`, '#ff9800');
        } else {
          this.versusP2Wins++;
          particles.addTextBanner(0, groundY - 120, `🏆 P2 WINS ROUND ${this.versusRound}! (${this.versusP1Wins}-${this.versusP2Wins})`, '#c084fc');
        }
        if (this.versusP1Wins >= 2 || this.versusP2Wins >= 2) {
          this.versusWinner = this.versusP1Wins >= 2 ? 'P1' : 'P2';
          particles.addTextBanner(0, groundY - 165, `👑 ${this.versusWinner} WINS THE DUEL! 👑`, '#facc15');
        } else {
          this.versusRoundResetTimer = 2.0;
        }
      }
    }
  }

  damageP2(amount, kbDir = 1, kbPower = 300) {
    const p2 = this.p2;
    if (!p2.active || p2.isDead || p2.iFrames > 0) return false;
    p2.hp = Math.max(0, p2.hp - Math.round(amount));
    p2.isHurt = true;
    p2.hurtTimer = 0.22;
    p2.iFrames = 0.55;
    p2.vx = Math.sign(kbDir || 1) * kbPower;
    p2.vy = -180;
    audio.playPlayerHurt?.();
    particles.addDamageText(p2.x, p2.y - 48, Math.round(amount), false, '#c084fc');
    particles.createHitSparks(p2.x, p2.y - 32, 8, '#c084fc');
    if (p2.hp <= 0) {
      p2.isDead = true;
      p2.respawnTimer = 5.0;
    }
    return true;
  }

  drawP22D(ctx) {
    const p2 = this.p2;
    if (!p2.active || p2.isDead) return;
    const ch = getCharacterDef(p2.characterId);
    if (ch.hasElytra) {
      ctx.save();
      ctx.translate(p2.x, p2.y);
      ctx.scale(p2.facing >= 0 ? 1 : -1, 1);
      drawPurpleElytraWings2D(ctx, { pose: p2.pose, wingSpread: p2.wingSpread, timer: p2.animTimer }, true);
      ctx.restore();
    }
    this.p2Renderer.draw(ctx, {
      x: p2.x,
      y: p2.y,
      facing: p2.facing,
      pose: p2.pose,
      animTimer: p2.animTimer,
      isGrounded: p2.isGrounded,
      isHurt: p2.isHurt,
      weaponType: p2.weaponTimer > 0 ? p2.weaponType : null
    });
    if (ch.hasCrown) {
      ctx.save();
      ctx.fillStyle = '#ffd54a';
      ctx.fillRect(p2.x - 13, p2.y - 84, 26, 6);
      ctx.fillRect(p2.x - 11, p2.y - 92, 5, 8);
      ctx.fillRect(p2.x - 2.5, p2.y - 96, 5, 12);
      ctx.fillRect(p2.x + 6, p2.y - 92, 5, 8);
      ctx.restore();
    }
    // Overhead P2 tag + mini HP bar
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(p2.x - 24, p2.y - 104, 48, 8);
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(p2.x - 23, p2.y - 103, 46 * Math.max(0, p2.hp / p2.maxHp), 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('P2', p2.x, p2.y - 109);
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // BOSS RUSH & ENDLESS MODE LIFECYCLE HELPERS
  // --------------------------------------------------------------------------
  beginBossRush(jumpToStageFn, waves, player, groundY, camera) {
    this.mode = 'boss_rush';
    this.bossRushIndex = 0;
    this.bossRushTimer = 0;
    this.bossRushActive = true;
    this.bossRushComplete = false;
    this.activePerks.clear();
    this.loadBossRushRound(0, jumpToStageFn, waves, player, groundY, camera);
  }

  loadBossRushRound(index, jumpToStageFn, waves, playerOrGetter, groundY, camera) {
    const entry = BOSS_RUSH_ROSTER[index];
    if (!entry) return false;
    this.bossRushIndex = index;
    jumpToStageFn(entry.stage, { freshStart: index === 0, creative: false, suppressModeReset: true });
    const player = typeof playerOrGetter === 'function' ? playerOrGetter() : playerOrGetter;
    waves.spawnQueue.length = 0;
    waves.zombies.length = 0;
    waves.bossZombie = null;
    waves.isWaveActive = true;
    waves.isWaveClearing = false;
    if (entry.bossType === 'mercenary_squad') {
      for (const m of ['mercenary_agent', 'mercenary_ballista', 'mercenary_primal', 'mercenary_hazard']) {
        waves.spawnZombie(m, player, groundY, camera);
      }
    } else {
      waves.spawnZombie(entry.bossType, player, groundY, camera);
    }
    particles.addTextBanner(
      player?.x || 0,
      groundY - 125,
      `🔥 BOSS RUSH ${index + 1}/${BOSS_RUSH_ROSTER.length}: ${entry.label} 🔥`,
      '#f97316'
    );
    return true;
  }

  beginEndlessHorde(jumpToStageFn, waves, playerOrGetter, groundY, camera) {
    this.mode = 'endless';
    this.endlessWave = 1;
    this.endlessMutator = ENDLESS_MUTATORS[0];
    this.endlessTntTimer = 4.0;
    this.activePerks.clear();
    jumpToStageFn(ENDLESS_ARENA_ROTATION[0], { freshStart: true, creative: false, suppressModeReset: true });
    const player = typeof playerOrGetter === 'function' ? playerOrGetter() : playerOrGetter;
    this.populateEndlessWave(1, waves, player, groundY, camera);
  }

  populateEndlessWave(waveNum, waves, player, groundY, camera) {
    this.endlessWave = waveNum;
    const mutIdx = waveNum <= 1 ? 0 : ((Math.floor((waveNum - 1) / 2) % (ENDLESS_MUTATORS.length - 1)) + 1);
    this.endlessMutator = ENDLESS_MUTATORS[mutIdx];
    waves.spawnQueue.length = 0;
    waves.isWaveActive = true;
    waves.isWaveClearing = false;
    waves.spawnTimer = 0.15;

    const total = Math.min(26, 6 + waveNum * 2);
    const pool = this.endlessMutator.id === 'heavy_squad'
      ? ['brute', 'shieldbearer', 'warden', 'boom_bug']
      : ['walker', 'runner', 'spitter', 'crawler', 'brute', 'boom_bug', 'stalker'];
    for (let i = 0; i < total; i++) {
      waves.spawnQueue.push({
        type: pool[(i + waveNum) % pool.length],
        delay: i % 3 === 0 ? 0.75 : 0.28
      });
    }
    if (waveNum % 5 === 0) {
      const miniBosses = ['titan_boss', 'dark_lord', 'king_orange', 'herobrine_boss', 'victim_boss'];
      waves.spawnQueue.push({
        type: miniBosses[(Math.floor(waveNum / 5) - 1) % miniBosses.length],
        delay: 1.0
      });
    }
    if (save.data?.best && waveNum > (save.data.best.endlessWave || 0)) {
      save.data.best.endlessWave = waveNum;
      save.data.unlocks.endless = true;
      save.flush?.();
    }
    particles.addTextBanner(
      player?.x || 0,
      groundY - 115,
      `♾️ ENDLESS WAVE ${waveNum} — ${this.endlessMutator.icon} ${this.endlessMutator.name}`,
      '#38bdf8'
    );
  }

  updateGameModes(dt, stageManager, waves, player, groundY, camera, callbacks = {}) {
    this.stageElapsed += dt;

    // Stage Clear Rank Card in Campaign Mode
    if (this.mode === 'campaign' && stageManager?.exitDoor?.isOpen && !stageManager.isTrophyRoom &&
        this.stageRankAwardedFor !== stageManager.currentStage) {
      this.stageRankAwardedFor = stageManager.currentStage;
      const rankInfo = computeStageRank(
        this.stageElapsed,
        player?.stageDamageTaken || 0,
        combat.stageMaxCombo || 0
      );
      this.lastStageRank = rankInfo;
      if (save.data?.best?.stageRanks) {
        const order = { S: 4, A: 3, B: 2, C: 1 };
        const prev = save.data.best.stageRanks[stageManager.currentStage];
        if (!prev || (order[rankInfo.rank] || 0) > (order[prev] || 0)) {
          save.data.best.stageRanks[stageManager.currentStage] = rankInfo.rank;
          save.flush?.();
        }
      }
      particles.addTextBanner(
        player?.x || 0,
        groundY - 125,
        `🏅 STAGE ${stageManager.currentStage} CLEAR — RANK ${rankInfo.rank}! (${rankInfo.title})`,
        rankInfo.color
      );
      callbacks.onStageRank?.(stageManager.currentStage, rankInfo);
      // Offer 1-of-3 Roguelike Perk after clearing a Boss Stage!
      const bossStages = new Set([5, 10, 11, 15, 16, 17, 19, 21, 22, 31]);
      if (bossStages.has(stageManager.currentStage) && this.pendingPerkBossRound !== stageManager.currentStage) {
        this.pendingPerkBossRound = stageManager.currentStage;
        callbacks.onOfferPerks?.(this.rollPerkChoices(3));
      }
    }

    // Boss Rush progression
    if (this.mode === 'boss_rush' && this.bossRushActive && !this.bossRushComplete) {
      this.bossRushTimer += dt;
      if (waves.spawnQueue.length === 0 && waves.zombies.every((z) => !z || z.isDead)) {
        if (this.bossRushIndex + 1 < BOSS_RUSH_ROSTER.length) {
          player?.heal?.(Math.round((player.maxHp || 100) * 0.5));
          combat.ink += 120;
          this.loadBossRushRound(this.bossRushIndex + 1, callbacks.jumpToStage, waves, player, groundY, camera);
        } else {
          this.bossRushComplete = true;
          this.bossRushActive = false;
          if (save.data) {
            save.data.unlocks.bossRush = true;
            const prevBest = save.data.best.bossRushTime || Infinity;
            if (this.bossRushTimer < prevBest) save.data.best.bossRushTime = Number(this.bossRushTimer.toFixed(2));
            save.flush?.();
          }
          particles.addTextBanner(
            player?.x || 0,
            groundY - 140,
            `🏆 BOSS RUSH CLEARED IN ${this.bossRushTimer.toFixed(1)}s! 🏆`,
            '#facc15'
          );
          callbacks.onBossRushComplete?.(this.bossRushTimer);
        }
      }
    }

    // Endless Horde progression & mutators
    if (this.mode === 'endless') {
      if (this.endlessMutator?.id === 'low_gravity' && player && !player.isGrounded && player.vy > 0) {
        player.vy -= 480 * dt;
      } else if (this.endlessMutator?.id === 'turbo_horde') {
        for (const z of zombiesSpeedTargets(waves.zombies)) {
          z.x = clamp(z.x + (z.vx || 0) * dt * 0.35, -ARENA_BOUND, ARENA_BOUND);
        }
      } else if (this.endlessMutator?.id === 'tnt_rain') {
        this.endlessTntTimer -= dt;
        if (this.endlessTntTimer <= 0) {
          this.endlessTntTimer = 4.2;
          callbacks.onSpawnRainTNT?.(clamp((player?.x || 0) + (Math.random() - 0.5) * 420, -820, 820));
        }
      }

      if (waves.spawnQueue.length === 0 && waves.zombies.every((z) => !z || z.isDead)) {
        const nextWave = this.endlessWave + 1;
        player?.heal?.(25);
        if (nextWave % 3 === 1 && callbacks.jumpToStage) {
          const nextStage = ENDLESS_ARENA_ROTATION[Math.floor((nextWave - 1) / 3) % ENDLESS_ARENA_ROTATION.length];
          callbacks.jumpToStage(nextStage, { freshStart: false, creative: false, suppressModeReset: true });
        }
        this.populateEndlessWave(nextWave, waves, player, groundY, camera);
        if (nextWave % 3 === 0) {
          callbacks.onOfferPerks?.(this.rollPerkChoices(3));
        }
      }
    }
  }
}

function zombiesSpeedTargets(list) {
  return (list || []).filter((z) => z && !z.isDead);
}

// ============================================================================
// SHARED UI MOUNTING (Character Select, Mode Buttons, Perk Picker & HUD Chip)
// ============================================================================
export function mountMegaFeaturesUI(controller, hooks = {}) {
  if (typeof document === 'undefined') return null;

  // 1. Main Menu Mode Buttons (Boss Rush, Endless Horde, 2P Co-op, 1v1 Versus)
  const titleActions = document.querySelector('#title-screen .title-actions');
  if (titleActions && !document.getElementById('btn-boss-rush')) {
    const modeButtons = [
      { id: 'btn-boss-rush', label: '🔥 BOSS RUSH (13 BOSSES)', cls: 'secondary-btn mega-mode-btn boss-rush-btn' },
      { id: 'btn-endless-mode', label: '♾️ ENDLESS HORDE', cls: 'secondary-btn mega-mode-btn endless-btn' },
      { id: 'btn-coop-2p', label: '👥 2P CO-OP', cls: 'secondary-btn mega-mode-btn coop-btn' },
      { id: 'btn-versus-1v1', label: '⚔️ 1V1 VERSUS', cls: 'secondary-btn mega-mode-btn versus-btn' }
    ];
    for (const mb of modeButtons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = mb.id;
      btn.className = mb.cls;
      btn.textContent = mb.label;
      titleActions.appendChild(btn);
    }
  }

  // 2. Secret Boss Quick-Jump Pills inside .quick-stage-pills
  const quickPills = document.querySelector('.quick-stage-pills');
  if (quickPills && !quickPills.querySelector('[data-secret-boss="herobrine_boss"]')) {
    const hb = document.createElement('button');
    hb.type = 'button';
    hb.className = 'quick-stage-btn secret-boss-pill';
    hb.setAttribute('data-secret-boss', 'herobrine_boss');
    hb.textContent = '👁️ SECRET: Herobrine';
    quickPills.appendChild(hb);

    const vb = document.createElement('button');
    vb.type = 'button';
    vb.className = 'quick-stage-btn secret-boss-pill';
    vb.setAttribute('data-secret-boss', 'victim_boss');
    vb.textContent = '🕵️ SECRET: Victim';
    quickPills.appendChild(vb);
  }

  // 3. Playable Character Select Bar on Main Menu (inserted right above .level-selector-banner)
  const titleScreen = document.getElementById('title-screen');
  const levelBanner = document.querySelector('#title-screen .level-selector-banner');
  if (titleScreen && !document.getElementById('character-select-banner')) {
    const banner = document.createElement('div');
    banner.id = 'character-select-banner';
    banner.className = 'character-select-banner';
    const pillsHtml = PLAYABLE_CHARACTERS.map((c) => `
      <button type="button" class="char-pick-btn ${c.id === controller.selectedCharacter ? 'active' : ''}" data-char-id="${c.id}" title="${c.passive}" style="--char-color: ${c.color};">
        <span class="char-pick-dot" style="background:${c.isHollowHead ? 'transparent' : c.color}; border-color:${c.color};"></span>
        <span>${c.name}</span>
      </button>
    `).join('');
    const currentDef = getCharacterDef(controller.selectedCharacter);
    banner.innerHTML = `
      <div class="char-select-header">
        <span class="char-select-title">🎭 CHOOSE YOUR FIGHTER:</span>
        <span id="char-passive-desc" class="char-passive-desc">${currentDef.badge} ${currentDef.passive}</span>
      </div>
      <div class="char-pick-grid">${pillsHtml}</div>
    `;
    if (levelBanner) titleScreen.insertBefore(banner, levelBanner);
    else titleScreen.appendChild(banner);
  }

  // 4. Add Secret Bosses to Creative Spawn Dropdown if present
  const spawnSelect = document.getElementById('creative-spawn-select');
  if (spawnSelect && !spawnSelect.querySelector('option[value="herobrine_boss"]')) {
    const firstOptgroup = spawnSelect.querySelector('optgroup') || spawnSelect;
    const optH = document.createElement('option');
    optH.value = 'herobrine_boss';
    optH.textContent = '👁️ Herobrine (Secret Boss)';
    const optV = document.createElement('option');
    optV.value = 'victim_boss';
    optV.textContent = '🕵️ Victim — Rocket Corp CEO (Secret Boss)';
    firstOptgroup.prepend(optV);
    firstOptgroup.prepend(optH);
  }

  // 5. HUD Weapon Hot-Swap Chip (Key T) + Mode Status Pill inside .hud-skills / .hud-center
  const hudSkills = document.querySelector('.hud-skills');
  if (hudSkills && !document.getElementById('hud-weapon-chip')) {
    const chip = document.createElement('div');
    chip.id = 'hud-weapon-chip';
    chip.className = 'skill-slot ready weapon-swap-slot';
    chip.title = 'Cycle Unlocked Boss Weapons (Press T)';
    chip.innerHTML = '<div class="skill-icon" id="hud-weapon-icon">✏️</div><div class="skill-key">T</div>';
    hudSkills.appendChild(chip);
  }

  const hudCenter = document.querySelector('.hud-center');
  if (hudCenter && !document.getElementById('hud-mode-badge')) {
    const badge = document.createElement('div');
    badge.id = 'hud-mode-badge';
    badge.className = 'hud-mode-badge';
    badge.style.display = 'none';
    hudCenter.appendChild(badge);
  }

  // 6. Between-Boss 1-of-3 Roguelike Perk Picker Modal
  const container = document.getElementById('game-container') || document.body;
  if (container && !document.getElementById('perk-picker-modal')) {
    const modal = document.createElement('div');
    modal.id = 'perk-picker-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box perk-modal-box">
        <div class="modal-title" style="color:#facc15;">✨ BOSS DEFEATED — CHOOSE A POWER PERK!</div>
        <p style="color:#cbd5e1;font-size:13px;margin:6px 0 14px;">Pick 1 upgrade for the rest of your run (or press 1 / 2 / 3):</p>
        <div id="perk-cards-grid" class="perk-cards-grid"></div>
      </div>
    `;
    container.appendChild(modal);
  }

  // Bind all event handlers cleanly
  const syncCharUI = (charId) => {
    const def = getCharacterDef(charId);
    document.querySelectorAll('.char-pick-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-char-id') === def.id);
    });
    const desc = document.getElementById('char-passive-desc');
    if (desc) desc.textContent = `${def.badge} ${def.passive}`;
  };

  document.querySelectorAll('.char-pick-btn[data-char-id]').forEach((btn) => {
    if (btn._charBound) return;
    btn._charBound = true;
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-char-id');
      controller.setCharacter(id, hooks.getPlayer?.());
      syncCharUI(id);
      hooks.onCharacterChanged?.(id);
    });
  });

  const bindOnce = (id, fn) => {
    const el = document.getElementById(id);
    if (el && !el._megaBound) {
      el._megaBound = true;
      el.addEventListener('click', fn);
    }
  };

  bindOnce('btn-boss-rush', () => hooks.onStartBossRush?.());
  bindOnce('btn-endless-mode', () => hooks.onStartEndless?.());
  bindOnce('btn-coop-2p', () => hooks.onStartCoop?.());
  bindOnce('btn-versus-1v1', () => hooks.onStartVersus?.());
  bindOnce('hud-weapon-chip', () => hooks.onCycleWeapon?.());

  document.querySelectorAll('[data-secret-boss]').forEach((btn) => {
    if (btn._secretBound) return;
    btn._secretBound = true;
    btn.addEventListener('click', () => {
      hooks.onLaunchSecretBoss?.(btn.getAttribute('data-secret-boss'));
    });
  });

  const showPerkModal = (perks) => {
    const modal = document.getElementById('perk-picker-modal');
    const grid = document.getElementById('perk-cards-grid');
    if (!modal || !grid) return;
    controller.perkPickerOpen = true;
    grid.innerHTML = '';
    perks.forEach((p, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'perk-choice-card';
      card.innerHTML = `
        <div class="perk-choice-key">[${i + 1}]</div>
        <div class="perk-choice-icon">${p.icon}</div>
        <div class="perk-choice-name">${p.name}</div>
        <div class="perk-choice-desc">${p.desc}</div>
      `;
      card.addEventListener('click', () => {
        modal.classList.remove('active');
        controller.perkPickerOpen = false;
        hooks.onPickPerk?.(p.id);
      });
      grid.appendChild(card);
    });
    modal.classList.add('active');
  };

  const syncMegaHUD = (player, isCreative = false) => {
    const wIcon = document.getElementById('hud-weapon-icon');
    const wChip = document.getElementById('hud-weapon-chip');
    if (wIcon && player) {
      const meta = BOSS_WEAPON_CATALOG.find((w) => w.id === player.weaponType) || BOSS_WEAPON_CATALOG[0];
      if (wIcon.textContent !== meta.icon) wIcon.textContent = meta.icon;
      const unlockedCount = controller.getUnlockedWeaponList(isCreative).length;
      if (wChip) wChip.title = `Weapon: ${meta.name} (${unlockedCount}/8 Unlocked — Press T to Swap)`;
    }

    const modeBadge = document.getElementById('hud-mode-badge');
    if (modeBadge) {
      let text = '';
      if (controller.mode === 'boss_rush') {
        text = `🔥 BOSS RUSH ${controller.bossRushIndex + 1}/${BOSS_RUSH_ROSTER.length} • ⏱️ ${controller.bossRushTimer.toFixed(1)}s`;
      } else if (controller.mode === 'endless') {
        text = `♾️ ENDLESS WAVE ${controller.endlessWave} • ${controller.endlessMutator.icon} ${controller.endlessMutator.name}`;
      } else if (controller.mode === 'versus') {
        text = `⚔️ 1V1 VERSUS • P1 ${controller.versusP1Wins} - ${controller.versusP2Wins} P2 (ROUND ${controller.versusRound})`;
      } else if (controller.p2.active) {
        text = `👥 2P CO-OP • P2 HP: ${Math.ceil(controller.p2.hp)}/${controller.p2.maxHp}`;
      }
      if (text) {
        modeBadge.style.display = '';
        if (modeBadge.textContent !== text) modeBadge.textContent = text;
      } else if (modeBadge.style.display !== 'none') {
        modeBadge.style.display = 'none';
      }
    }
  };

  return { showPerkModal, syncMegaHUD, syncCharUI };
}
