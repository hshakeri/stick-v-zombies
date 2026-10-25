// ============================================================================
// 3D Speech Bubble Manager & Expressive Comic Visual Engine
// Features F1.1 - F1.6: 3D Depth Tracking, Frustum Culling, Visual Variants,
// Speaker Avatar Badges, Mood Indicators, and Dynamic Micro-Animations.
// ============================================================================

import {
  speech as speech2d,
  SpeechBubbleManager,
  MAX_SPEECH_BUBBLES,
  BOSS_SPEECH_EVENTS,
  SPEECH_CORPUS
} from '../../js/engine/speech.js?v=9.8';
import { audio } from '../../js/engine/audio.js?v=9.8';

const to3DX = (x) => x / 34;
const to3DY = (y) => -y / 34;
const to3DZ = (z) => z / 34;

export const MAX_ACTIVE_BUBBLES_3D = 3;
export const MAX_SPEECH_CHARS_3D = 24;
export const MAX_SPEECH_LINES_3D = 2;
export const CAMERA_REF_DISTANCE = 35.0;

export function wrapSpeechText3D(text, maxChars = MAX_SPEECH_CHARS_3D, maxLines = MAX_SPEECH_LINES_3D) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\r?\n/);
  const lines = [];
  let truncated = false;

  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p];
    const rawWords = para.split(/\s+/).filter(Boolean);
    const words = [];
    for (const w of rawWords) {
      if (w.length <= maxChars) {
        words.push(w);
      } else {
        for (let i = 0; i < w.length; i += maxChars) {
          words.push(w.slice(i, i + maxChars));
        }
      }
    }

    let line = '';
    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const word = words[wIdx];
      const candidate = line ? (line + ' ' + word) : word;
      if (line && candidate.length > maxChars) {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
      } else {
        line = candidate;
      }
    }
    if (line) {
      if (lines.length < maxLines) {
        lines.push(line);
      } else {
        truncated = true;
      }
    }
    if (lines.length >= maxLines) {
      if (p < paragraphs.length - 1) truncated = true;
      break;
    }
  }

  if (lines.length > maxLines) {
    truncated = true;
    lines.length = maxLines;
  }

  if (truncated && lines.length > 0) {
    const lastIdx = lines.length - 1;
    let last = lines[lastIdx];
    if (last.length >= maxChars) {
      last = last.slice(0, maxChars - 1).trimEnd();
    }
    lines[lastIdx] = last + '…';
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > maxChars) {
      lines[i] = lines[i].slice(0, maxChars - 1) + '…';
    }
  }

  return lines;
}

export const BUBBLE_STYLES = Object.freeze(['comic', 'shout', 'cyber', 'pixel']);
export const MOOD_INDICATORS = Object.freeze(['!', '⚡', '💧', '💀', '★', '?', '🎵']);

export const SPEAKER_BADGES = Object.freeze({
  orange: '🟠 ORANGE',
  player: '🟠 ORANGE',
  playerAttack: '🟠 ORANGE',
  playerHurt: '🟠 ORANGE',
  playerAwakened: '🟠 ORANGE',
  red: '🔴 RED',
  'ally-red': '🔴 RED',
  blue: '🔵 BLUE',
  'ally-blue': '🔵 BLUE',
  yellow: '🟡 YELLOW',
  'ally-yellow': '🟡 YELLOW',
  green: '🟢 GREEN',
  'ally-green': '🟢 GREEN',
  cursor: '🖱️ CURSOR',
  'ally-cursor': '🖱️ CURSOR',
  chosen: '⭐ CHOSEN',
  'ally-chosen': '⭐ CHOSEN',
  king: '👑 KING',
  'ally-king': '👑 KING',
  king_orange: '👑 KING ORANGE',
  kingOrange: '👑 KING ORANGE',
  agent: '🕶️ AGENT',
  ballista: '🚀 BALLISTA',
  primal: '🪓 PRIMAL',
  hazard: '☣️ HAZARD',
  titan: '🗿 TITAN',
  dark_lord: '⚔️ DARK LORD',
  darkLord: '⚔️ DARK LORD',
  creeper_lord: '🧨 CREEPER LORD',
  creeperLord: '🧨 CREEPER LORD',
  giant_cat: '🐾 GIANT CAT',
  giantCat: '🐾 GIANT CAT',
  lucky_orb: '🔮 LUCKY ORB',
  luckyOrb: '🔮 LUCKY ORB',
  ender_dragon: '🐉 ENDER DRAGON',
  enderDragon: '🐉 ENDER DRAGON',
  warden_boss: '🔊 THE WARDEN',
  the_warden: '🔊 THE WARDEN',
  'THE WARDEN': '🔊 THE WARDEN',
  creaking_boss: '🪵 THE CREAKING',
  the_creaking: '🪵 THE CREAKING',
  creaking: '🪵 THE CREAKING',
  creeking: '🪵 THE CREAKING',
  the_creeking: '🪵 THE CREAKING',
  'THE CREAKING': '🪵 THE CREAKING',
  h4c3r: '👾 H4C3R',
  virabot: '👾 VIRABOT',
  zombie: '🧟 ZOMBIE',
  zombieGroan: '🧟 ZOMBIE'
});

export const BANTER_CHAINS = Object.freeze({
  // --------------------------------------------------------------------------
  // F2.2: ROCKET CORP MERCENARIES (STAGE 22 & ARENA)
  // --------------------------------------------------------------------------
  merc_squad_rollcall: [
    { speaker: 'agent', text: 'TARGET LOCATED.', delay: 0.0, options: { style: 'pixel', badge: '🕶️ AGENT', mood: '!', priority: 4, duration: 1.6 } },
    { speaker: 'ballista', text: '8-BIT LOCKED ON!', delay: 0.6, options: { style: 'pixel', badge: '🚀 BALLISTA', mood: '⚡', priority: 4, duration: 1.6 } },
    { speaker: 'primal', text: 'ROOOAAAR! HUNT!', delay: 1.2, options: { style: 'pixel', badge: '🪓 PRIMAL', mood: '!', priority: 4, duration: 1.6 } },
    { speaker: 'hazard', text: '⚠ PERIMETER SEALED!', delay: 1.8, options: { style: 'pixel', badge: '☣️ HAZARD', mood: '💀', priority: 4, duration: 1.6 } }
  ],

  merc_squad_contract: [
    { speaker: 'agent', text: 'BOUNTY IN SIGHT.', delay: 0.0, options: { style: 'pixel', badge: '🕶️ AGENT', mood: '!', priority: 4, duration: 1.6 } },
    { speaker: 'ballista', text: 'MAX REWARD: OURS!', delay: 0.6, options: { style: 'pixel', badge: '🚀 BALLISTA', mood: '★', priority: 4, duration: 1.6 } },
    { speaker: 'primal', text: 'SMASH TO PIXELS!', delay: 1.2, options: { style: 'pixel', badge: '🪓 PRIMAL', mood: '⚡', priority: 4, duration: 1.6 } },
    { speaker: 'hazard', text: '⚠ BIO-GRID READY!', delay: 1.8, options: { style: 'pixel', badge: '☣️ HAZARD', mood: '💀', priority: 4, duration: 1.6 } }
  ],

  merc_tactic_agent_ballista: [
    { speaker: 'agent', text: 'PAUSE! LOCK GRID!', delay: 0.0, options: { style: 'pixel', badge: '🕶️ AGENT', mood: '!', priority: 4, duration: 1.5 } },
    { speaker: 'ballista', text: 'ROCKET SALVO AWAY!', delay: 0.6, options: { style: 'pixel', badge: '🚀 BALLISTA', mood: '⚡', priority: 4, duration: 1.5 } }
  ],

  merc_tactic_hazard_primal: [
    { speaker: 'hazard', text: '⚠ BIO-GAS SPREAD!', delay: 0.0, options: { style: 'pixel', badge: '☣️ HAZARD', mood: '💀', priority: 4, duration: 1.5 } },
    { speaker: 'primal', text: 'SPEAR THROUGH SMOKE!', delay: 0.6, options: { style: 'pixel', badge: '🪓 PRIMAL', mood: '!', priority: 4, duration: 1.5 } }
  ],

  merc_tactic_ballista_hazard: [
    { speaker: 'ballista', text: 'PIXEL BARRAGE!', delay: 0.0, options: { style: 'pixel', badge: '🚀 BALLISTA', mood: '⚡', priority: 4, duration: 1.5 } },
    { speaker: 'hazard', text: '⚠ HIGH VOLTAGE COMBO!', delay: 0.6, options: { style: 'pixel', badge: '☣️ HAZARD', mood: '⚡', priority: 4, duration: 1.5 } }
  ],

  merc_tactic_primal_agent: [
    { speaker: 'primal', text: 'HUNT! CORNER HIM!', delay: 0.0, options: { style: 'pixel', badge: '🪓 PRIMAL', mood: '!', priority: 4, duration: 1.5 } },
    { speaker: 'agent', text: 'CONTAINMENT ZONE.', delay: 0.6, options: { style: 'pixel', badge: '🕶️ AGENT', mood: '!', priority: 4, duration: 1.5 } }
  ],

  merc_vs_chosen: [
    { speaker: 'agent', text: 'CONTAIN THE CHOSEN!', delay: 0.0, options: { style: 'pixel', badge: '🕶️ AGENT', mood: '!', priority: 4, duration: 1.5 } },
    { speaker: 'chosen', text: 'NOT IN THE BOX.', delay: 0.6, options: { style: 'comic', badge: '⭐ CHOSEN', mood: '★', priority: 4, duration: 1.5 } },
    { speaker: 'ballista', text: 'HE BROKE MY TARGET?!', delay: 1.2, options: { style: 'pixel', badge: '🚀 BALLISTA', mood: '?', priority: 4, duration: 1.5 } }
  ],

  merc_vs_orange: [
    { speaker: 'agent', text: 'ORANGE: ANOMALY.', delay: 0.0, options: { style: 'pixel', badge: '🕶️ AGENT', mood: '!', priority: 4, duration: 1.5 } },
    { speaker: 'orange', text: 'JUST WATCH ME DRAW!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } },
    { speaker: 'hazard', text: '⚠ CAUTION: HE FAST!', delay: 1.2, options: { style: 'pixel', badge: '☣️ HAZARD', mood: '💧', priority: 4, duration: 1.5 } }
  ],

  merc_casualty_agent: [
    { speaker: 'agent', text: 'SIGNAL LOST...', delay: 0.0, options: { style: 'pixel', badge: '🕶️ AGENT', mood: '💀', priority: 4, duration: 1.5 } },
    { speaker: 'ballista', text: 'AGENT DOWN?! RETRY!', delay: 0.6, options: { style: 'pixel', badge: '🚀 BALLISTA', mood: '💧', priority: 4, duration: 1.5 } },
    { speaker: 'hazard', text: '⚠ SYSTEM FAULT!', delay: 1.2, options: { style: 'pixel', badge: '☣️ HAZARD', mood: '💀', priority: 4, duration: 1.5 } }
  ],

  merc_casualty_primal: [
    { speaker: 'primal', text: 'GRRAAAH... WEAK...', delay: 0.0, options: { style: 'pixel', badge: '🪓 PRIMAL', mood: '💀', priority: 4, duration: 1.5 } },
    { speaker: 'agent', text: 'RECALCULATING ODDS.', delay: 0.6, options: { style: 'pixel', badge: '🕶️ AGENT', mood: '!', priority: 4, duration: 1.5 } }
  ],

  merc_casualty_ballista: [
    { speaker: 'ballista', text: 'GAME OVER?!', delay: 0.0, options: { style: 'pixel', badge: '🚀 BALLISTA', mood: '💀', priority: 4, duration: 1.5 } },
    { speaker: 'primal', text: 'NO BARRAGE?! ROAR!', delay: 0.6, options: { style: 'pixel', badge: '🪓 PRIMAL', mood: '!', priority: 4, duration: 1.5 } }
  ],

  merc_casualty_hazard: [
    { speaker: 'hazard', text: '⚠ SYSTEM FAULT!', delay: 0.0, options: { style: 'pixel', badge: '☣️ HAZARD', mood: '💀', priority: 4, duration: 1.5 } },
    { speaker: 'agent', text: 'HAZARD COMPROMISED.', delay: 0.6, options: { style: 'pixel', badge: '🕶️ AGENT', mood: '💧', priority: 4, duration: 1.5 } }
  ],

  // --------------------------------------------------------------------------
  // F2.3: ORANGE & ALLIES TEAM BANTER
  // --------------------------------------------------------------------------
  team_orange_red_1: [
    { speaker: 'red', text: 'DIBS ON THE HORDE!', delay: 0.0, options: { style: 'comic', badge: '🔴 RED', mood: '!', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'LEAVE SOME FOR ME!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 2, duration: 1.5 } }
  ],

  team_orange_red_2: [
    { speaker: 'orange', text: 'NEED A SLAM HERE!', delay: 0.0, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 2, duration: 1.5 } },
    { speaker: 'red', text: 'BONK INCOMING!', delay: 0.6, options: { style: 'comic', badge: '🔴 RED', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  team_orange_red_3: [
    { speaker: 'red', text: 'MY FISTS NEED RAM!', delay: 0.0, options: { style: 'comic', badge: '🔴 RED', mood: '⚡', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'SAVE YOUR REBOOTS!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '💧', priority: 2, duration: 1.5 } }
  ],

  team_orange_blue_1: [
    { speaker: 'blue', text: 'POTION BREWED! DRINK!', delay: 0.0, options: { style: 'comic', badge: '🔵 BLUE', mood: '!', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'TASTES LIKE PIXELS!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 2, duration: 1.5 } }
  ],

  team_orange_blue_clutch: [
    { speaker: 'orange', text: 'HP CRITICAL, BLUE!', delay: 0.0, options: { style: 'shout', badge: '🟠 ORANGE', mood: '💧', priority: 3, duration: 1.5 } },
    { speaker: 'blue', text: 'HEAL SPLASH! CHUG IT!', delay: 0.6, options: { style: 'comic', badge: '🔵 BLUE', mood: '⚡', priority: 3, duration: 1.5 } }
  ],

  team_orange_blue_2: [
    { speaker: 'blue', text: 'SIDE EFFECT: WINNING.', delay: 0.0, options: { style: 'comic', badge: '🔵 BLUE', mood: '★', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'FEELING OVERCLOCKED!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  team_orange_yellow_1: [
    { speaker: 'yellow', text: 'REDSTONE TURRET SET!', delay: 0.0, options: { style: 'comic', badge: '🟡 YELLOW', mood: '⚡', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'LIGHT THEM UP!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 2, duration: 1.5 } }
  ],

  team_orange_yellow_2: [
    { speaker: 'orange', text: 'HOLD THE FLANK!', delay: 0.0, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 2, duration: 1.5 } },
    { speaker: 'yellow', text: 'LOGIC BOMB ARMED!', delay: 0.6, options: { style: 'comic', badge: '🟡 YELLOW', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  team_orange_yellow_3: [
    { speaker: 'yellow', text: 'I MADE A BUTTON.', delay: 0.0, options: { style: 'comic', badge: '🟡 YELLOW', mood: '?', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'DONT PRESS IT YET!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 2, duration: 1.5 } }
  ],

  team_orange_green_1: [
    { speaker: 'green', text: 'DROP THE BLOCK BEAT!', delay: 0.0, options: { style: 'comic', badge: '🟢 GREEN', mood: '🎵', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'RHYTHM OF VICTORY!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 2, duration: 1.5 } }
  ],

  team_orange_green_2: [
    { speaker: 'orange', text: 'STUN THE HORDE!', delay: 0.0, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 2, duration: 1.5 } },
    { speaker: 'green', text: 'BASS, MEET BRAINS!', delay: 0.6, options: { style: 'comic', badge: '🟢 GREEN', mood: '🎵', priority: 2, duration: 1.5 } }
  ],

  team_orange_green_3: [
    { speaker: 'green', text: 'ENCORE? ALWAYS.', delay: 0.0, options: { style: 'comic', badge: '🟢 GREEN', mood: '🎵', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'MAKE IT LOUD!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  team_orange_cursor_1: [
    { speaker: 'cursor', text: 'CLICK. DRAG. YEET.', delay: 0.0, options: { style: 'cyber', badge: '🖱️ CURSOR', mood: '!', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'STRAIGHT TO TRASH!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 2, duration: 1.5 } }
  ],

  team_orange_cursor_2: [
    { speaker: 'orange', text: 'CLEAR THE SKY!', delay: 0.0, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 2, duration: 1.5 } },
    { speaker: 'cursor', text: 'RIGHT-CLICK: PURGE.', delay: 0.6, options: { style: 'cyber', badge: '🖱️ CURSOR', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  team_orange_cursor_3: [
    { speaker: 'cursor', text: 'SELECTION EXPANDED.', delay: 0.0, options: { style: 'cyber', badge: '🖱️ CURSOR', mood: '⚡', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'MAXIMUM EDIT!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 2, duration: 1.5 } }
  ],

  team_orange_chosen_1: [
    { speaker: 'chosen', text: 'CHOSEN. BACK.', delay: 0.0, options: { style: 'comic', badge: '⭐ CHOSEN', mood: '★', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'LETS FINISH THIS!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  team_orange_chosen_2: [
    { speaker: 'orange', text: 'TAKE THE BOSS!', delay: 0.0, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 2, duration: 1.5 } },
    { speaker: 'chosen', text: 'ALREADY DONE.', delay: 0.6, options: { style: 'comic', badge: '⭐ CHOSEN', mood: '★', priority: 2, duration: 1.5 } }
  ],

  team_orange_chosen_3: [
    { speaker: 'chosen', text: 'NO BOX CAN HOLD US.', delay: 0.0, options: { style: 'comic', badge: '⭐ CHOSEN', mood: '★', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'THE CANVAS IS OURS!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 2, duration: 1.5 } }
  ],

  team_orange_king_1: [
    { speaker: 'king', text: 'MY TURN TO HELP.', delay: 0.0, options: { style: 'comic', badge: '👑 KING ORANGE', mood: '★', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'ROYAL COVER FIRE!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  team_orange_king_2: [
    { speaker: 'orange', text: 'BLOCK WALL INCOMING!', delay: 0.0, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 2, duration: 1.5 } },
    { speaker: 'king', text: 'BLOCKS: EXECUTE!', delay: 0.6, options: { style: 'comic', badge: '👑 KING ORANGE', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  team_orange_king_3: [
    { speaker: 'king', text: 'LOOP IS BROKEN.', delay: 0.0, options: { style: 'comic', badge: '👑 KING ORANGE', mood: '★', priority: 2, duration: 1.5 } },
    { speaker: 'orange', text: 'WE WRITE THE FUTURE!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 2, duration: 1.5 } }
  ],

  team_allies_assemble: [
    { speaker: 'orange', text: 'STICK SQUAD: ASSEMBLE!', delay: 0.0, options: { style: 'shout', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.6 } },
    { speaker: 'red', text: 'DIBS ON FRONT LINE!', delay: 0.6, options: { style: 'comic', badge: '🔴 RED', mood: '!', priority: 3, duration: 1.5 } },
    { speaker: 'blue', text: 'POTIONS FOR ALL!', delay: 1.2, options: { style: 'comic', badge: '🔵 BLUE', mood: '⚡', priority: 3, duration: 1.5 } },
    { speaker: 'green', text: 'DROP THE BLOCK BEAT!', delay: 1.8, options: { style: 'comic', badge: '🟢 GREEN', mood: '🎵', priority: 3, duration: 1.5 } }
  ],

  // --------------------------------------------------------------------------
  // F2.4: BOSS TRASH-TALK EXCHANGES
  // --------------------------------------------------------------------------
  boss_ender_dragon_intro: [
    { speaker: 'ender_dragon', text: 'THE END OBEYS ME!', delay: 0.0, options: { style: 'shout', badge: '🐉 ENDER DRAGON', mood: '!', priority: 5, duration: 1.6, trauma: 0.8 } },
    { speaker: 'orange', text: 'NOT THIS CANVAS!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_ender_dragon_phase: [
    { speaker: 'ender_dragon', text: 'ROOOAAAR! VOID SWOOP!', delay: 0.0, options: { style: 'shout', badge: '🐉 ENDER DRAGON', mood: '⚡', priority: 5, duration: 1.6, trauma: 1.0 } },
    { speaker: 'red', text: 'DUCK THE PURPLE FIRE!', delay: 0.6, options: { style: 'comic', badge: '🔴 RED', mood: '💧', priority: 4, duration: 1.5 } }
  ],

  boss_ender_dragon_defeat: [
    { speaker: 'ender_dragon', text: 'THE END... SHATTERS...', delay: 0.0, options: { style: 'shout', badge: '🐉 ENDER DRAGON', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'VOID PORTAL OPEN!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_warden_intro: [
    { speaker: 'warden_boss', text: '*SNIFF... SOUND LOCKED!*', delay: 0.0, options: { style: 'shout', badge: '🔊 THE WARDEN', mood: '💀', priority: 5, duration: 1.6, trauma: 0.9 } },
    { speaker: 'orange', text: 'SHHH! DONT STEP ON SCULK!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '💧', priority: 4, duration: 1.5 } }
  ],

  boss_warden_phase: [
    { speaker: 'warden_boss', text: 'SONIC BOOM! ROOOAAAR!', delay: 0.0, options: { style: 'shout', badge: '🔊 THE WARDEN', mood: '⚡', priority: 5, duration: 1.6, trauma: 1.0 } },
    { speaker: 'green', text: 'MY NOTE BLOCKS WOKE IT!', delay: 0.6, options: { style: 'comic', badge: '🟢 GREEN', mood: '🎵', priority: 4, duration: 1.5 } }
  ],

  boss_warden_defeat: [
    { speaker: 'warden_boss', text: '*HEARTBEAT... SILENT...*', delay: 0.0, options: { style: 'shout', badge: '🔊 THE WARDEN', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'ANCIENT CITY SILENCED!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_creaking_intro: [
    { speaker: 'creaking_boss', text: '*CREEAAAK... DONT BLINK!*', delay: 0.0, options: { style: 'shout', badge: '🪵 THE CREAKING', mood: '💀', priority: 5, duration: 1.6, trauma: 0.85 } },
    { speaker: 'orange', text: 'EYES ON THE SPOOKY TREE!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 4, duration: 1.5 } }
  ],

  boss_creaking_phase: [
    { speaker: 'creaking_boss', text: 'RESIN HEART OVERDRIVE!', delay: 0.0, options: { style: 'shout', badge: '🪵 THE CREAKING', mood: '⚡', priority: 5, duration: 1.6, trauma: 1.0 } },
    { speaker: 'yellow', text: 'WATCH THE ORANGE ROOTS!', delay: 0.6, options: { style: 'comic', badge: '🟡 YELLOW', mood: '⚡', priority: 4, duration: 1.5 } }
  ],

  boss_creaking_defeat: [
    { speaker: 'creaking_boss', text: '*HEART... SHATTERED...*', delay: 0.0, options: { style: 'shout', badge: '🪵 THE CREAKING', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'PALE GARDEN CLEARED!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_h4c3r_intro: [
    { speaker: 'h4c3r', text: 'ROOT ACCESS GRANTED.', delay: 0.0, options: { style: 'cyber', badge: '👾 H4C3R', mood: '!', priority: 5, duration: 1.6 } },
    { speaker: 'cursor', text: 'ACCESS: REVOKED.', delay: 0.6, options: { style: 'cyber', badge: '🖱️ CURSOR', mood: '⚡', priority: 4, duration: 1.5 } }
  ],

  boss_h4c3r_phase: [
    { speaker: 'h4c3r', text: 'ZERO-DAY DASH ONLINE!', delay: 0.0, options: { style: 'cyber', badge: '👾 H4C3R', mood: '⚡', priority: 5, duration: 1.6, trauma: 0.7 } },
    { speaker: 'orange', text: 'PATCHING YOUR GLITCH!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_h4c3r_root: [
    { speaker: 'h4c3r', text: 'PERMISSION: DENIED.', delay: 0.0, options: { style: 'cyber', badge: '👾 H4C3R', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'yellow', text: 'OVERRIDING LOGIC!', delay: 0.6, options: { style: 'comic', badge: '🟡 YELLOW', mood: '⚡', priority: 4, duration: 1.5 } }
  ],

  boss_h4c3r_defeat: [
    { speaker: 'h4c3r', text: 'SESSION TERMINATED...', delay: 0.0, options: { style: 'cyber', badge: '👾 H4C3R', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'SYSTEM RESTORED!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_dark_lord_intro: [
    { speaker: 'dark_lord', text: 'OLD FIGHT. NEW DOOM.', delay: 0.0, options: { style: 'shout', badge: '⚔️ DARK LORD', mood: '💀', priority: 5, duration: 1.6, trauma: 0.7 } },
    { speaker: 'chosen', text: 'NOT THIS TIME.', delay: 0.6, options: { style: 'comic', badge: '⭐ CHOSEN', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_dark_lord_summon: [
    { speaker: 'dark_lord', text: 'VIRABOTS, FETCH!', delay: 0.0, options: { style: 'shout', badge: '⚔️ DARK LORD', mood: '⚡', priority: 5, duration: 1.6 } },
    { speaker: 'green', text: 'NOTE BLAST: DEFENSE!', delay: 0.6, options: { style: 'comic', badge: '🟢 GREEN', mood: '🎵', priority: 4, duration: 1.5 } }
  ],

  boss_dark_lord_phase: [
    { speaker: 'dark_lord', text: 'POWER: OVERCLOCKED!', delay: 0.0, options: { style: 'shout', badge: '⚔️ DARK LORD', mood: '⚡', priority: 5, duration: 1.6, trauma: 0.9 } },
    { speaker: 'orange', text: 'SUPER AWAKENING: ON!', delay: 0.6, options: { style: 'shout', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_dark_lord_defeat: [
    { speaker: 'dark_lord', text: 'BACKUP DELETED... NO!', delay: 0.0, options: { style: 'shout', badge: '⚔️ DARK LORD', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'SHADOW PURGED!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_titan_intro: [
    { speaker: 'titan', text: 'TITAN.EXE AWAKE.', delay: 0.0, options: { style: 'shout', badge: '🗿 TITAN', mood: '!', priority: 5, duration: 1.6, trauma: 0.8 } },
    { speaker: 'orange', text: 'BIG FILE, HARD CRASH!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_titan_phase: [
    { speaker: 'titan', text: 'RAGE: OVERCLOCKED!', delay: 0.0, options: { style: 'shout', badge: '🗿 TITAN', mood: '⚡', priority: 5, duration: 1.6, trauma: 1.0 } },
    { speaker: 'red', text: 'MY FISTS HIT HARDER!', delay: 0.6, options: { style: 'comic', badge: '🔴 RED', mood: '⚡', priority: 4, duration: 1.5 } }
  ],

  boss_titan_defeat: [
    { speaker: 'titan', text: 'TITAN... SLEEPS...', delay: 0.0, options: { style: 'shout', badge: '🗿 TITAN', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'PROCESS KILLED!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_creeper_lord_intro: [
    { speaker: 'creeper_lord', text: 'CROWN ONLINE. RISE!', delay: 0.0, options: { style: 'shout', badge: '🧨 CREEPER LORD', mood: '!', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'WHO GAVE YOU A CROWN?!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '?', priority: 4, duration: 1.5 } }
  ],

  boss_creeper_lord_blast: [
    { speaker: 'creeper_lord', text: 'HISS... CROWN BOOM!', delay: 0.0, options: { style: 'shout', badge: '🧨 CREEPER LORD', mood: '💀', priority: 5, duration: 1.6, trauma: 0.8 } },
    { speaker: 'blue', text: 'SHIELD UP! FROZEN!', delay: 0.6, options: { style: 'comic', badge: '🔵 BLUE', mood: '💧', priority: 4, duration: 1.5 } }
  ],

  boss_creeper_lord_defeat: [
    { speaker: 'creeper_lord', text: 'REPLAY DISARMED...', delay: 0.0, options: { style: 'shout', badge: '🧨 CREEPER LORD', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'FUSE DISARMED!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_giant_cat_intro: [
    { speaker: 'giant_cat', text: 'GIANT REPLAY: AWAKE!', delay: 0.0, options: { style: 'shout', badge: '🐾 GIANT CAT', mood: '!', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'WHERES THE CATNIP?!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '?', priority: 4, duration: 1.5 } }
  ],

  boss_giant_cat_pounce: [
    { speaker: 'giant_cat', text: 'ZOOMIES! PAWS INCOMING!', delay: 0.0, options: { style: 'shout', badge: '🐾 GIANT CAT', mood: '⚡', priority: 5, duration: 1.6, trauma: 0.7 } },
    { speaker: 'red', text: 'OUTTA THE WAY, CHONK!', delay: 0.6, options: { style: 'comic', badge: '🔴 RED', mood: '!', priority: 4, duration: 1.5 } }
  ],

  boss_giant_cat_defeat: [
    { speaker: 'giant_cat', text: 'CATNAP RESTORED...', delay: 0.0, options: { style: 'shout', badge: '🐾 GIANT CAT', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'GO TAKE A 10-HOUR NAP!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_lucky_orb_intro: [
    { speaker: 'lucky_orb', text: 'CHANCE ENGINE: ON.', delay: 0.0, options: { style: 'shout', badge: '🔮 LUCKY ORB', mood: '?', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'FEELING UNLUCKY, ORB?', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 4, duration: 1.5 } }
  ],

  boss_lucky_orb_roll: [
    { speaker: 'lucky_orb', text: 'BAD ROLL! BOUNCE THIS!', delay: 0.0, options: { style: 'shout', badge: '🔮 LUCKY ORB', mood: '⚡', priority: 5, duration: 1.6 } },
    { speaker: 'yellow', text: 'ODDS ARE AGAINST YOU!', delay: 0.6, options: { style: 'comic', badge: '🟡 YELLOW', mood: '⚡', priority: 4, duration: 1.5 } }
  ],

  boss_lucky_orb_defeat: [
    { speaker: 'lucky_orb', text: 'LUCK RAN OUT! 0x00', delay: 0.0, options: { style: 'shout', badge: '🔮 LUCKY ORB', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'JACKPOT TO THE HERO!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_king_orange_intro: [
    { speaker: 'king_orange', text: 'THE LOOP COMMANDS ME!', delay: 0.0, options: { style: 'shout', badge: '👑 KING ORANGE', mood: '!', priority: 5, duration: 1.6, trauma: 0.8 } },
    { speaker: 'orange', text: 'WE WILL BREAK THE LOOP!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_king_orange_phase: [
    { speaker: 'king_orange', text: 'LOOP SPEED: DOUBLE!', delay: 0.0, options: { style: 'shout', badge: '👑 KING ORANGE', mood: '⚡', priority: 5, duration: 1.6, trauma: 0.9 } },
    { speaker: 'orange', text: 'FASTER THAN THE LOOP!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '⚡', priority: 4, duration: 1.5 } }
  ],

  boss_king_orange_defeat: [
    { speaker: 'king_orange', text: 'LOOP BROKEN... TEAM?', delay: 0.0, options: { style: 'shout', badge: '👑 KING ORANGE', mood: '💀', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'WELCOME TO THE SQUAD!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 4, duration: 1.5 } }
  ],

  boss_king_orange_command: [
    { speaker: 'king_orange', text: 'BLOCKS: EXECUTE!', delay: 0.0, options: { style: 'shout', badge: '👑 KING ORANGE', mood: '⚡', priority: 5, duration: 1.6 } },
    { speaker: 'orange', text: 'WATCH OUT FOR BLOCKS!', delay: 0.6, options: { style: 'comic', badge: '🟠 ORANGE', mood: '!', priority: 4, duration: 1.5 } }
  ],

  boss_virabot_swarm: [
    { speaker: 'virabot', text: 'INFECT. EXE REPLICATE.', delay: 0.0, options: { style: 'cyber', badge: '👾 VIRABOT', mood: '💀', priority: 3, duration: 1.5 } },
    { speaker: 'cursor', text: 'SELECT -> TRASH.', delay: 0.6, options: { style: 'cyber', badge: '🖱️ CURSOR', mood: '⚡', priority: 3, duration: 1.5 } }
  ],

  // --------------------------------------------------------------------------
  // F2.5: ZOMBIE COMEDY LINES & ALLY RETORTS
  // --------------------------------------------------------------------------
  zombie_retort_brains: [
    { speaker: 'zombie', text: 'BRAINS.PNG...', delay: 0.0, options: { style: 'comic', badge: '🧟 ZOMBIE', mood: '💀', priority: 1, duration: 1.4 } },
    { speaker: 'orange', text: '404: FILE NOT FOUND!', delay: 0.5, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 2, duration: 1.5 } }
  ],

  zombie_retort_ram: [
    { speaker: 'zombie', text: 'NEED MORE RAM...', delay: 0.0, options: { style: 'comic', badge: '🧟 ZOMBIE', mood: '💧', priority: 1, duration: 1.4 } },
    { speaker: 'red', text: 'DOWNLOAD A FIST!', delay: 0.5, options: { style: 'comic', badge: '🔴 RED', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  zombie_retort_undelete: [
    { speaker: 'zombie', text: 'UNDELETE ME PLS...', delay: 0.0, options: { style: 'comic', badge: '🧟 ZOMBIE', mood: '?', priority: 1, duration: 1.4 } },
    { speaker: 'cursor', text: 'TRASH ALREADY EMPTIED.', delay: 0.5, options: { style: 'cyber', badge: '🖱️ CURSOR', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  zombie_retort_cache: [
    { speaker: 'zombie', text: 'CACHE MISS... BRRR...', delay: 0.0, options: { style: 'comic', badge: '🧟 ZOMBIE', mood: '💧', priority: 1, duration: 1.4 } },
    { speaker: 'yellow', text: 'CACHE PURGED, GHOUL!', delay: 0.5, options: { style: 'comic', badge: '🟡 YELLOW', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  zombie_retort_update: [
    { speaker: 'zombie', text: 'BAD UPDATE APPLIED...', delay: 0.0, options: { style: 'comic', badge: '🧟 ZOMBIE', mood: '💀', priority: 1, duration: 1.4 } },
    { speaker: 'orange', text: 'ROLLBACK INCOMING!', delay: 0.5, options: { style: 'comic', badge: '🟠 ORANGE', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  zombie_retort_buffer: [
    { speaker: 'zombie', text: 'BUFFER OVERFLOWWWW...', delay: 0.0, options: { style: 'comic', badge: '🧟 ZOMBIE', mood: '💀', priority: 1, duration: 1.4 } },
    { speaker: 'chosen', text: 'STACK EMPTY.', delay: 0.5, options: { style: 'comic', badge: '⭐ CHOSEN', mood: '★', priority: 2, duration: 1.5 } }
  ],

  zombie_retort_lag: [
    { speaker: 'zombie', text: 'FRAME DROP... LAG...', delay: 0.0, options: { style: 'comic', badge: '🧟 ZOMBIE', mood: '💧', priority: 1, duration: 1.4 } },
    { speaker: 'green', text: '60 FPS DROPKICK!', delay: 0.5, options: { style: 'comic', badge: '🟢 GREEN', mood: '🎵', priority: 2, duration: 1.5 } }
  ],

  zombie_retort_folder: [
    { speaker: 'zombie', text: 'WRONG FOLDER... UH OH...', delay: 0.0, options: { style: 'comic', badge: '🧟 ZOMBIE', mood: '?', priority: 1, duration: 1.4 } },
    { speaker: 'king', text: 'ROYAL EVICTION!', delay: 0.5, options: { style: 'comic', badge: '👑 KING ORANGE', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  zombie_retort_heap: [
    { speaker: 'zombie', text: 'OUT OF HEAP MEMORY...', delay: 0.0, options: { style: 'comic', badge: '🧟 ZOMBIE', mood: '💧', priority: 1, duration: 1.4 } },
    { speaker: 'blue', text: 'GARBAGE COLLECTED!', delay: 0.5, options: { style: 'comic', badge: '🔵 BLUE', mood: '⚡', priority: 2, duration: 1.5 } }
  ],

  zombie_retort_corrupt: [
    { speaker: 'zombie', text: 'SECTOR CORRUPTED...', delay: 0.0, options: { style: 'comic', badge: '🧟 ZOMBIE', mood: '💀', priority: 1, duration: 1.4 } },
    { speaker: 'orange', text: 'CLEAN REFORMAT!', delay: 0.5, options: { style: 'comic', badge: '🟠 ORANGE', mood: '★', priority: 2, duration: 1.5 } }
  ]
});

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

export class SpeechBubbleManager3D extends SpeechBubbleManager {
  constructor(options = {}) {
    const clock = typeof options === 'function' ? options : (options?.clock || (() => globalThis.performance?.now?.() ?? 0));
    super(clock);
    const opts = typeof options === 'object' && options !== null ? options : {};
    this.maxActiveBubbles = opts.maxActiveBubbles || MAX_ACTIVE_BUBBLES_3D;
    this.maxBubbles = this.maxActiveBubbles;
    this.maxBanterQueue = opts.maxBanterQueue || 4;
    this.refDistance = opts.refDistance || CAMERA_REF_DISTANCE;
    this.activeBubbles = [];
    this.banterQueue = [];
    this.bubblePool = [];
    this.maxBubblePool = opts.maxBubblePool || 8;
    this.speakerCooldowns = new Map();
    this.cooldownWindow = 0.3; // 300ms cooldown per speaker
    this.nextId = 1;
    this.soundTriggered = [];
    this._scratchPos = null;
    this._camDir = null;
    this._toPoint = null;
    this._scratchScreen = { x: 0, y: 0, zDepth: 0, scale: 1, visible: true };
    this.playerRef = null;
  }

  _recycleBubble(bubble) {
    if (!bubble || typeof bubble !== 'object') return;
    if (this.bubblePool.length >= this.maxBubblePool) return;
    bubble.speaker = null;
    bubble.anchor = null;
    bubble.lines = null;
    bubble.text = '';
    bubble.badge = null;
    bubble.badgeLabel = '';
    bubble.mood = null;
    bubble.visible = false;
    this.bubblePool.push(bubble);
  }

  dismissBubble(bubbleOrId) {
    if (!bubbleOrId) return false;
    const idx = this.activeBubbles.findIndex(b => b === bubbleOrId || b.id === bubbleOrId);
    if (idx !== -1) {
      const removed = this.activeBubbles.splice(idx, 1)[0];
      this._recycleBubble(removed);
      return true;
    }
    return false;
  }

  get bubbles() {
    return this.activeBubbles;
  }

  set bubbles(val) {
    this.activeBubbles = val;
  }

  resolveStyle(speakerType, options = {}) {
    if (options.style && BUBBLE_STYLES.includes(options.style)) return options.style;
    const s = String(speakerType || '').toLowerCase();
    if (s === 'h4c3r' || s === 'virabot' || s === 'terminal') return 'cyber';
    if (s.includes('dragon') || s.includes('warden') || s.includes('creaking') || s.includes('creeking') ||
        s.includes('titan') || s.includes('dark_lord') || s.includes('darklord') ||
        s.includes('cat') || s.includes('creeper') || s.includes('orb') || s.includes('boss') ||
        s.includes('roar') || s.includes('shout') || s.includes('boom') || s.includes('nuke') ||
        s.includes('slam') || s.includes('clutch')) {
      return 'shout';
    }
    if (s.includes('pixel') || s.includes('minecraft') || s.includes('block') ||
        s.includes('agent') || s.includes('ballista') || s.includes('primal') || s.includes('hazard')) {
      return 'pixel';
    }
    return 'comic';
  }

  resolveBadge(speakerType) {
    return this._getSpeakerBadge(speakerType);
  }

  _getSpeakerBadge(speakerId) {
    if (SPEAKER_BADGES[speakerId]) return SPEAKER_BADGES[speakerId];
    const normalized = String(speakerId || '').toLowerCase().replace(/[-\s]+/g, '_').replace(/^ally_/, '').replace(/^mercenary_/, '');
    if (SPEAKER_BADGES[normalized]) return SPEAKER_BADGES[normalized];
    return String(speakerId).toUpperCase();
  }

  _getSpeakerPriority(speakerId) {
    const s = String(speakerId || '').replace(/^ally-/, '').replace(/^mercenary_/, '');
    if (
      s === 'campaign' || s === 'h4c3r' || s === 'ender_dragon' || s === 'enderDragon' ||
      s === 'warden_boss' || s === 'the_warden' || s === 'THE WARDEN' ||
      s === 'creaking_boss' || s === 'the_creaking' || s === 'creaking' || s === 'creeking' || s === 'the_creeking' || s === 'THE CREAKING' ||
      s === 'titan'
    ) return 5;
    if (s === 'dark_lord' || s === 'darkLord' || s === 'king_orange' || s === 'kingOrange' || s === 'creeper_lord' || s === 'creeperLord' || s === 'giant_cat' || s === 'giantCat' || s === 'lucky_orb' || s === 'luckyOrb') return 4;
    if (s === 'orange_awakened' || s === 'playerAwakened') return 3;
    if (['red', 'blue', 'yellow', 'green', 'agent', 'ballista', 'primal', 'hazard', 'cursor', 'chosen', 'king', 'virabot'].includes(s)) return 2;
    return 1;
  }

  resolveMood(speakerType, text = '', options = {}) {
    if (options.mood && MOOD_INDICATORS.includes(options.mood)) return options.mood;
    const str = String(text).toUpperCase();
    if (str.includes('DEFEAT') || str.includes('DEATH') || str.includes('DELETE') || str.includes('KABOOM') || str.includes('NUKE')) return '💀';
    if (str.includes('CRIT') || str.includes('SHOCK') || str.includes('LIGHTNING') || str.includes('BONK') || str.includes('COMBO') || str.includes('SLAM')) return '⚡';
    if (speakerType === 'playerHurt' || speakerType?.includes?.('Hurt') || str.includes('OW') || str.includes('CLUTCH') || str.includes('NAP')) return '💧';
    if (str.includes('FULL') || str.includes('LIMIT') || str.includes('CHOSEN') || str.includes('STAR') || str.includes('STAGE COMPLETE') || str.includes('HOUSE')) return '★';
    if (str.includes('?') || str.includes('HUH') || str.includes('WHAT') || str.includes('LUCKY')) return '?';
    if (speakerType === 'ally-green' || str.includes('BEAT') || str.includes('BASS') || str.includes('ENCORE') || str.includes('SONG')) return '🎵';
    if (str.includes('!') || str.includes('ROAR') || str.includes('BOOM') || str.includes('SWOOP') || str.includes('READY')) return '!';
    return null;
  }

  _getSpeakerPosition(speaker) {
    if (speaker && typeof speaker === 'object') {
      return {
        x: Number.isFinite(speaker.x) ? speaker.x : 0,
        y: Number.isFinite(speaker.y) ? speaker.y : 0,
        z: Number.isFinite(speaker.z) ? speaker.z : (Number.isFinite(speaker.z3d) ? speaker.z3d * 34 : 0)
      };
    }
    if (typeof speaker === 'string' && (speaker === 'orange' || speaker === 'player' || speaker.startsWith('player')) && this.playerRef) {
      return {
        x: Number.isFinite(this.playerRef.x) ? this.playerRef.x : 0,
        y: (Number.isFinite(this.playerRef.y) ? this.playerRef.y : 0) - 30,
        z: Number.isFinite(this.playerRef.z) ? this.playerRef.z : (Number.isFinite(this.playerRef.z3d) ? this.playerRef.z3d * 34 : 0)
      };
    }
    return { x: 0, y: 0, z: 0 };
  }

  getBadgeBounds(bubble) {
    if (!bubble?.badge) return null;
    const badgeStr = String(bubble.badge);
    const label = bubble.badgeLabel || (badgeStr.startsWith('[') ? badgeStr : `[${badgeStr.toUpperCase()}]`);
    const bw = bubble.badgeWidth || (label.length * 6 + 12);
    const bh = 14;
    const w = bubble.width || 100;
    const h = bubble.height || 42;
    const x = -w / 2 + 4;
    const y = -h / 2 - 9;
    return { x, y, width: bw, height: bh, right: x + bw };
  }

  getMoodBounds(bubble) {
    if (!bubble?.mood) return null;
    const w = bubble.width || 100;
    const h = bubble.height || 42;
    const r = 10;
    const x = w / 2 - 14;
    const y = -h / 2 - 3;
    return { x, y, radius: r, left: x - r, right: x + r };
  }

  spawnSpeechBubble(speaker, text, options = {}) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return null;
    }
    const cleanText = text.trim();
    const speakerId = typeof speaker === 'string'
      ? speaker
      : (speaker?.id || speaker?.name || speaker?.type || options.speakerType || 'speaker');
    const priority = options.priority ?? this._getSpeakerPriority(speakerId);

    // Cooldown check for same speaker (unless bypassed by banter queue)
    const now = Date.now();
    const lastSpoken = this.speakerCooldowns.get(speakerId) || 0;
    if (now - lastSpoken < this.cooldownWindow * 1000 && !options.bypassCooldown) {
      return null;
    }

    // Active bubble cap (<= 3) and priority preemption check FIRST
    let evicted = null;
    if (this.activeBubbles.length >= this.maxActiveBubbles) {
      let minIdx = 0;
      let minPriority = this.activeBubbles[0].priority;
      for (let i = 1; i < this.activeBubbles.length; i++) {
        if (this.activeBubbles[i].priority < minPriority) {
          minPriority = this.activeBubbles[i].priority;
          minIdx = i;
        }
      }
      if (priority < minPriority) {
        return null; // Reject early: 0 pool pop, 0 allocations, 0 sound chirp, 0 cooldown update
      }
      evicted = this.activeBubbles.splice(minIdx, 1)[0];
    }

    // Admission confirmed: record cooldown
    this.speakerCooldowns.set(speakerId, now);

    const style = options.style || this.resolveStyle(speakerId, options) || 'comic';
    const lines = wrapSpeechText3D(cleanText, MAX_SPEECH_CHARS_3D, MAX_SPEECH_LINES_3D);
    const totalDisplayChars = lines.reduce((acc, l) => acc + l.length, 0);

    const baseW = (style === 'cyber') ? 120 : ((style === 'shout') ? 110 : 100);
    const baseH = (style === 'cyber') ? 50 : 42;

    const maxLineLen = lines.length > 0 ? Math.max(...lines.map(l => l.length)) : 0;
    const charW = (style === 'cyber' || style === 'pixel') ? 8.0 : 8.5;
    const textW = Math.round(maxLineLen * charW) + 28;

    const rawBadge = options.badge || this._getSpeakerBadge(speakerId);
    const badgeStr = rawBadge ? String(rawBadge) : '';
    const badgeLabel = badgeStr ? (badgeStr.startsWith('[') ? badgeStr : `[${badgeStr.toUpperCase()}]`) : '';
    const badgeW = badgeLabel ? (badgeLabel.length * 6 + 12) : 0;

    const moodIndicator = options.mood || null;
    const hasMood = Boolean(moodIndicator);
    const moodW = hasMood ? 20 : 0;
    const headerClearance = (badgeW > 0 && hasMood)
      ? (badgeW + moodW + 24)
      : (badgeW > 0 ? badgeW + 16 : (hasMood ? moodW + 16 : 0));

    const bubbleWidth = Math.max(baseW, textW, headerClearance);
    const bubbleHeight = (lines.length > 1) ? (baseH + 12) : baseH;

    // Pop from pool (if pool > 0)
    const bubble = (this.bubblePool.length > 0) ? this.bubblePool.pop() : {};

    // If an active bubble was evicted to make room, recycle it into pool now!
    if (evicted) {
      this._recycleBubble(evicted);
    }

    bubble.id = this.nextId++;
    bubble.speaker = speaker;
    bubble.speakerId = speakerId;
    bubble.speakerType = speakerId;
    bubble.text = cleanText;
    bubble.lines = lines;
    bubble.totalDisplayChars = totalDisplayChars;
    bubble.style = style;
    bubble.badge = rawBadge;
    bubble.badgeLabel = badgeLabel;
    bubble.badgeWidth = badgeW;
    bubble.mood = moodIndicator;
    bubble.width = bubbleWidth;
    bubble.height = bubbleHeight;
    bubble.priority = priority;
    bubble.duration = options.duration || 2.5;
    bubble.life = options.duration || 2.5;
    bubble.maxLife = options.duration || 2.5;
    bubble.elapsed = 0;
    bubble.sound = !!options.sound;
    bubble.springProgress = 0;
    bubble.springScale = 0;
    bubble.springVelocity = 0;
    bubble.trauma = options.trauma !== undefined ? options.trauma : ((style === 'shout') ? 0.8 : 0);
    bubble.typewriterChars = 0;
    bubble.revealedChars = 0;
    bubble.visible = true;
    bubble.screenX = 0;
    bubble.screenY = 0;
    bubble.depthScale = 1;
    bubble.hoverTimer = Math.random() * Math.PI * 2;
    bubble.seed = Math.floor(Math.random() * 100000);
    bubble.anchor = (typeof speaker === 'object' && speaker !== null) ? speaker : (options.anchor || null);
    bubble.anchorOffsetX = Number.isFinite(options.anchorOffsetX) ? options.anchorOffsetX : 0;
    bubble.anchorOffsetY = Number.isFinite(options.anchorOffsetY)
      ? options.anchorOffsetY
      : (typeof speaker === 'object' && Number.isFinite(speaker?.speechOffsetY) ? speaker.speechOffsetY : -44);
    bubble.anchorOffsetZ = Number.isFinite(options.anchorOffsetZ) ? options.anchorOffsetZ : 0;
    bubble.x = (typeof speaker === 'object' && Number.isFinite(speaker?.x)) ? speaker.x : (Number.isFinite(options.x) ? options.x : 0);
    bubble.y = (typeof speaker === 'object' && Number.isFinite(speaker?.y)) ? speaker.y : (Number.isFinite(options.y) ? options.y : 0);
    bubble.z = (typeof speaker === 'object' && Number.isFinite(speaker?.z))
      ? speaker.z
      : (Number.isFinite(options.z) ? options.z : (typeof speaker === 'object' && Number.isFinite(speaker?.z3d) ? speaker.z3d * 34 : 0));

    // Dispatch sound only for admitted bubble
    if (bubble.sound) {
      this.soundTriggered.push({ id: bubble.id, speaker: speakerId, text: cleanText });
    }
    if (options.sound !== false) {
      audio.playSpeechChirp?.();
    }

    this.activeBubbles.push(bubble);
    return bubble;
  }

  spawnBubble(x, y, text, speakerType = 'playerAttack', duration = 1.45, options = {}) {
    const z = options.z !== undefined ? options.z : (options.anchor?.z ?? 0);
    const speaker = options.anchor || { x, y, z, id: speakerType };
    const bubble = this.spawnSpeechBubble(speaker, text, {
      ...options,
      speakerType,
      duration,
      z
    });
    return Boolean(bubble);
  }

  triggerBanter(dialogueChain, options = {}) {
    if (!Array.isArray(dialogueChain) || dialogueChain.length === 0) return 0;
    let added = 0;

    // Optional preemption of lower-priority pending chatter when high-priority banter arrives
    const chainPriority = options.priority ?? (dialogueChain[0]?.priority ?? dialogueChain[0]?.options?.priority ?? 0);
    if (options.preemptQueue || chainPriority >= 4) {
      this.banterQueue = this.banterQueue.filter(item => (item.options?.priority ?? 1) >= 4);
    }

    for (let i = 0; i < dialogueChain.length; i++) {
      const item = dialogueChain[i];
      if (!item || !item.text || typeof item.text !== 'string') continue;

      if (this.banterQueue.length >= this.maxBanterQueue) {
        if (options.evictFifo) {
          this.banterQueue.shift();
        } else {
          break;
        }
      }

      // Merge flat properties and nested options
      const itemOpts = item.options || {};
      const beatPriority = item.priority ?? itemOpts.priority ?? options.priority ?? this._getSpeakerPriority(item.speaker);
      const beatStyle = item.style || itemOpts.style || options.style || this.resolveStyle(item.speaker, itemOpts);
      const beatBadge = item.badge || itemOpts.badge || this._getSpeakerBadge(item.speaker);
      const beatMood = item.mood || itemOpts.mood || this.resolveMood(item.speaker, item.text, itemOpts);

      const resolvedOptions = {
        ...itemOpts,
        style: beatStyle,
        badge: beatBadge,
        mood: beatMood,
        priority: beatPriority,
        duration: item.duration || itemOpts.duration || 2.5,
        sound: item.sound !== undefined ? item.sound : itemOpts.sound,
        trauma: item.trauma !== undefined ? item.trauma : itemOpts.trauma,
        anchor: item.anchor || itemOpts.anchor || null,
        anchorOffsetX: item.anchorOffsetX ?? itemOpts.anchorOffsetX ?? 0,
        anchorOffsetY: item.anchorOffsetY ?? itemOpts.anchorOffsetY,
        anchorOffsetZ: item.anchorOffsetZ ?? itemOpts.anchorOffsetZ ?? 0,
        x: item.x ?? itemOpts.x,
        y: item.y ?? itemOpts.y,
        z: item.z ?? itemOpts.z,
        bypassCooldown: true
      };

      const delay = Number.isFinite(item.delay) ? item.delay : 0;
      this.banterQueue.push({
        id: this.nextId++,
        speaker: item.speaker,
        text: item.text,
        delay: delay,
        timer: delay,
        options: resolvedOptions
      });
      added++;
    }
    return added;
  }

  triggerNamedBanter(chainKey, options = {}) {
    const chain = BANTER_CHAINS[chainKey];
    if (!chain) return 0;
    if (options.anchor || options.priority !== undefined) {
      const beats = [];
      for (let i = 0; i < chain.length; i++) {
        const beat = chain[i];
        const isNonPlayer = beat.speaker !== 'orange' && beat.speaker !== 'player';
        const shouldAttachAnchor = options.anchor && (
          isNonPlayer || (!chain.some(b => b.speaker !== 'orange' && b.speaker !== 'player') && i === 0)
        );
        beats.push({
          ...beat,
          options: {
            ...beat.options,
            ...(shouldAttachAnchor ? { anchor: options.anchor } : {}),
            ...(options.priority !== undefined ? { priority: options.priority } : {})
          }
        });
      }
      return this.triggerBanter(beats, options);
    }
    return this.triggerBanter(chain, options);
  }

  triggerSquadBanter(squadMembers = ['agent', 'ballista', 'primal', 'hazard'], options = {}) {
    return this.triggerNamedBanter('merc_squad_rollcall', options);
  }

  triggerTeamBanter(allyType, context = 'summon', options = {}) {
    const keyMap = {
      red: ['team_orange_red_1', 'team_orange_red_2', 'team_orange_red_3'],
      blue: ['team_orange_blue_1', 'team_orange_blue_2', 'team_orange_blue_clutch'],
      yellow: ['team_orange_yellow_1', 'team_orange_yellow_2', 'team_orange_yellow_3'],
      green: ['team_orange_green_1', 'team_orange_green_2', 'team_orange_green_3'],
      cursor: ['team_orange_cursor_1', 'team_orange_cursor_2', 'team_orange_cursor_3'],
      chosen: ['team_orange_chosen_1', 'team_orange_chosen_2', 'team_orange_chosen_3'],
      chosen_one: ['team_orange_chosen_1', 'team_orange_chosen_2', 'team_orange_chosen_3'],
      king: ['team_orange_king_1', 'team_orange_king_2', 'team_orange_king_3'],
      king_orange: ['team_orange_king_1', 'team_orange_king_2', 'team_orange_king_3']
    };
    const normalized = String(allyType || '')
      .toLowerCase()
      .replace(/^ally[-_]/, '')
      .replace(/-/g, '_')
      .trim();
    const candidates = keyMap[normalized];
    if (!candidates || candidates.length === 0) return 0;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    return this.triggerNamedBanter(choice, options);
  }

  triggerBossTrashTalk(bossName, eventName = 'intro', options = {}) {
    const rawBoss = String(bossName || '')
      .replace(/^boss[_-]/i, '')
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/[-\s]+/g, '_')
      .replace(/__+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^the_/, '')
      .replace(/_boss$/, '');
    const normalizedBoss = rawBoss === 'creeking' ? 'creaking' : rawBoss;
    const normalizedEvent = String(eventName || 'intro')
      .toLowerCase()
      .replace(/[-\s]+/g, '_')
      .replace(/^_+|_+$/g, '');
    let candidateKey = `boss_${normalizedBoss}_${normalizedEvent}`;
    if (!BANTER_CHAINS[candidateKey] && normalizedEvent === 'default') {
      const fallbackKey = `boss_${normalizedBoss}_intro`;
      if (BANTER_CHAINS[fallbackKey]) candidateKey = fallbackKey;
    }
    if (BANTER_CHAINS[candidateKey]) {
      return this.triggerNamedBanter(candidateKey, options);
    }
    return 0;
  }

  triggerRandomZombieRetort(options = {}) {
    const keys = [
      'zombie_retort_brains', 'zombie_retort_ram', 'zombie_retort_undelete',
      'zombie_retort_cache', 'zombie_retort_update', 'zombie_retort_buffer',
      'zombie_retort_lag', 'zombie_retort_folder', 'zombie_retort_heap',
      'zombie_retort_corrupt'
    ];
    const choice = keys[Math.floor(Math.random() * keys.length)];
    return this.triggerNamedBanter(choice, options);
  }

  triggerZombieComedy(anchor = null, options = {}) {
    const opts = anchor ? { ...options, anchor } : options;
    return this.triggerRandomZombieRetort(opts);
  }

  shout(x, y, category = 'playerAttack', subKey = null, duration = 1.45, options = {}) {
    if (category === 'zombieGroan') {
      const anchor = options.anchor || { x, y };
      const added = this.triggerZombieComedy(anchor, options);
      if (added > 0) return true;
    }
    // F3.1: Intercept player attack shout during grab finisher execution
    if (category === 'playerAttack' && this.playerRef?.activeMove?.action === 'grab') {
      const bubble = this.onCombatEvent('grab', { anchor: options.anchor || this.playerRef });
      if (bubble) return true;
    }
    return super.shout(x, y, category, subKey, duration, options);
  }

  shoutBoss(x, y, bossName, eventName = 'default', duration = 1.6, options = {}) {
    const rawBoss = String(bossName || '')
      .replace(/^boss[_-]/i, '')
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/[-\s]+/g, '_')
      .replace(/__+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^the_/, '')
      .replace(/_boss$/, '');
    const normalizedBoss = rawBoss === 'creeking' ? 'creaking' : rawBoss;
    const normalizedEvent = String(eventName || 'default')
      .toLowerCase()
      .replace(/[-\s]+/g, '_')
      .replace(/^_+|_+$/g, '');
    let chainKey = `boss_${normalizedBoss}_${normalizedEvent}`;
    if (!BANTER_CHAINS[chainKey] && normalizedEvent === 'default') {
      const fallbackKey = `boss_${normalizedBoss}_intro`;
      if (BANTER_CHAINS[fallbackKey]) chainKey = fallbackKey;
    }
    if (BANTER_CHAINS[chainKey]) {
      const added = this.triggerNamedBanter(chainKey, {
        anchor: options.anchor || { x, y },
        priority: options.priority ?? 5
      });
      if (added > 0) return true;
    }
    return super.shoutBoss(x, y, bossName, eventName, duration, options);
  }

  update(dt = 0.016, player = null) {
    if (!Number.isFinite(dt)) dt = 0.016;
    if (dt < 0) dt = 0.004;
    if (player) this.playerRef = player;

    // 1. Advance banter queue timers
    for (let i = 0; i < this.banterQueue.length; i++) {
      this.banterQueue[i].timer -= dt;
    }

    // 2. Spawn ready banter items in strict forward FIFO monotonic order
    let bIdx = 0;
    while (bIdx < this.banterQueue.length) {
      const item = this.banterQueue[bIdx];
      if (item.timer <= 0) {
        // Zero-allocation reuse of prepared options object
        item.options.bypassCooldown = true;
        this.spawnSpeechBubble(item.speaker, item.text, item.options);
        this.banterQueue.splice(bIdx, 1);
      } else {
        bIdx++;
      }
    }

    // 3. Advance active bubble lifetimes and micro-animations
    for (let i = this.activeBubbles.length - 1; i >= 0; i--) {
      const b = this.activeBubbles[i];
      b.elapsed += dt;
      if (b.elapsed >= b.duration) {
        const expired = this.activeBubbles.splice(i, 1)[0];
        this._recycleBubble(expired);
        continue;
      }

      // A. Damped spring pop-in (transitions from 0 to 1 with spring overshoot)
      b.springProgress = Math.min(1, b.elapsed / 0.25);
      const t = b.springProgress;
      b.springScale = t >= 1 ? 1 : Math.max(0, 1 - Math.exp(-6 * t) * Math.cos(12 * t));

      // B. Trauma shake decay
      if (b.trauma > 0) {
        b.trauma = Math.max(0, b.trauma - dt * 1.5);
      }

      // C. Typewriter text reveal (reveals characters sequentially at 35 chars/sec)
      b.typewriterChars = Math.min(b.text.length, Math.floor(b.elapsed * 35));
      b.revealedChars = b.typewriterChars;
    }
  }

  getScreenAnchor(bubble, cameraAdapter) {
    if (!bubble) return this._scratchScreen;
    const anchor = bubble.anchor || ((typeof bubble.speaker === 'string' && (bubble.speaker === 'orange' || bubble.speaker === 'player' || bubble.speaker.startsWith('player'))) ? this.playerRef : null);
    const worldX = (Number.isFinite(anchor?.x) ? anchor.x : (Number.isFinite(bubble.x) ? bubble.x : 0)) + (bubble.anchorOffsetX || 0);
    const worldY = (Number.isFinite(anchor?.y) ? anchor.y : (Number.isFinite(bubble.y) ? bubble.y : 0)) + (bubble.anchorOffsetY !== undefined ? bubble.anchorOffsetY : (anchor?.speechOffsetY ?? -44));
    let worldZ = (Number.isFinite(anchor?.z) ? anchor.z : (Number.isFinite(bubble.z) ? bubble.z : 0)) + (bubble.anchorOffsetZ || 0);
    if (!Number.isFinite(worldZ) && Number.isFinite(anchor?.z3d)) {
      worldZ = anchor.z3d * 34;
    }

    if (cameraAdapter?.worldToScreen) {
      return cameraAdapter.worldToScreen(worldX, worldY, worldZ);
    }
    this._scratchScreen.x = worldX;
    this._scratchScreen.y = worldY;
    this._scratchScreen.zDepth = 16.0;
    this._scratchScreen.visible = true;
    this._scratchScreen.scale = 1.0;
    return this._scratchScreen;
  }

  projectBubble(wx, wy, wz, cameraAdapter, width = 1280, height = 720, camera3D = null, target = null) {
    const out = target || { x: 0, y: 0, zDepth: 0, scale: 1, visible: true };
    out.visible = true;

    const safeWx = Number.isFinite(wx) ? wx : 0;
    const safeWy = Number.isFinite(wy) ? wy : 0;
    const safeWz = Number.isFinite(wz) ? wz : 0;

    if (cameraAdapter?.worldToScreen) {
      const proj = cameraAdapter.worldToScreen(safeWx, safeWy, safeWz);
      out.x = Number.isFinite(proj?.x) ? proj.x : 0;
      out.y = Number.isFinite(proj?.y) ? proj.y : 0;
      out.zDepth = Number.isFinite(proj?.zDepth) ? proj.zDepth : 0;
      if (proj?.visible !== undefined) out.visible = Boolean(proj.visible);
      if (Number.isFinite(proj?.scale)) {
        out.scale = proj.scale;
      } else {
        const dist = Math.max(0.1, Math.abs(out.zDepth || 16));
        out.scale = Math.max(0.65, Math.min(1.35, this.refDistance / dist));
      }
      out.scale = Number.isFinite(out.scale) ? out.scale : 1.0;
      return out;
    } else if (camera3D) {
      if (!this._scratchPos && camera3D.position?.clone) {
        this._scratchPos = camera3D.position.clone();
        this._camDir = camera3D.position.clone();
        this._toPoint = camera3D.position.clone();
      }
      this._scratchPos.set(to3DX(safeWx), to3DY(safeWy), to3DZ(safeWz));
      const camDist = this._scratchPos.distanceTo(camera3D.position);

      camera3D.getWorldDirection(this._camDir);
      this._toPoint.subVectors(this._scratchPos, camera3D.position);
      if (this._camDir.dot(this._toPoint) <= 0) {
        out.visible = false;
      }

      this._scratchPos.project(camera3D);
      if (this._scratchPos.z > 1.0) {
        out.visible = false;
      }

      out.x = (this._scratchPos.x * 0.5 + 0.5) * width;
      out.y = (-this._scratchPos.y * 0.5 + 0.5) * height;
      out.zDepth = this._scratchPos.z;

      // Inverse distance depth scaling: clamp(refDist / dist, 0.65, 1.35)
      out.scale = Math.max(0.65, Math.min(1.35, this.refDistance / Math.max(0.1, camDist)));
      out.x = Number.isFinite(out.x) ? out.x : width / 2;
      out.y = Number.isFinite(out.y) ? out.y : height / 2;
      out.zDepth = Number.isFinite(out.zDepth) ? out.zDepth : 0;
      out.scale = Number.isFinite(out.scale) ? out.scale : 1.0;
      return out;
    }

    const dist = Math.sqrt(safeWx * safeWx + safeWy * safeWy + (safeWz + 35) * (safeWz + 35));
    out.scale = Math.max(0.65, Math.min(1.35, this.refDistance / Math.max(1, dist * 0.05)));
    out.scale = Number.isFinite(out.scale) ? out.scale : 1.0;
    out.x = Number.isFinite(out.x) ? out.x : width / 2;
    out.y = Number.isFinite(out.y) ? out.y : height / 2;
    return out;
  }

  draw(ctx, cameraAdapter = null, width = 1280, height = 720, camera3D = null) {
    if (!ctx) return;
    const vpWidth = width || cameraAdapter?.getViewportSize?.()?.width || ctx.canvas?.clientWidth || ctx.canvas?.width || 1280;
    const vpHeight = height || cameraAdapter?.getViewportSize?.()?.height || ctx.canvas?.clientHeight || ctx.canvas?.height || 720;

    for (let i = 0; i < this.activeBubbles.length; i++) {
      const b = this.activeBubbles[i];
      const anchor = b.anchor || ((typeof b.speaker === 'string' && (b.speaker === 'orange' || b.speaker === 'player' || b.speaker.startsWith('player'))) ? this.playerRef : null);
      const worldX = (Number.isFinite(anchor?.x) ? anchor.x : (Number.isFinite(b.x) ? b.x : 0)) + (b.anchorOffsetX || 0);
      const worldY = (Number.isFinite(anchor?.y) ? anchor.y : (Number.isFinite(b.y) ? b.y : 0)) + (b.anchorOffsetY !== undefined ? b.anchorOffsetY : (anchor?.speechOffsetY ?? -44));
      let worldZ = (Number.isFinite(anchor?.z) ? anchor.z : (Number.isFinite(b.z) ? b.z : 0)) + (b.anchorOffsetZ || 0);
      if (!Number.isFinite(worldZ) && Number.isFinite(anchor?.z3d)) {
        worldZ = anchor.z3d * 34;
      }
      const screen = this.projectBubble(worldX, worldY, worldZ, cameraAdapter, vpWidth, vpHeight, camera3D, this._scratchScreen);
      b.screenX = Number.isFinite(screen.x) ? screen.x : 0;
      b.screenY = Number.isFinite(screen.y) ? screen.y : 0;
      b.depthScale = Number.isFinite(screen.scale) ? screen.scale : 1.0;
      b.visible = Boolean(screen.visible);

      if (!b.visible) continue;

      ctx.save?.();

      // Apply trauma shake jitter
      let jitterX = 0;
      let jitterY = 0;
      if (b.trauma > 0) {
        const shakeMag = b.trauma * b.trauma * (b.style === 'shout' ? 8.0 : 4.5);
        const t = (b.elapsed || 0) * 45;
        jitterX = (Math.sin(t * 1.3) + Math.cos(t * 0.9)) * shakeMag * 0.5;
        jitterY = (Math.cos(t * 1.5) + Math.sin(t * 1.1)) * shakeMag * 0.5;
      }

      // Subtle comic hover float
      const hoverY = Math.sin((b.elapsed || 0) * 3.2 + (b.id || 0)) * 2.2;

      const scaleA = Number.isFinite(b.springScale) ? b.springScale : 1.0;
      const scaleB = Number.isFinite(b.depthScale) ? b.depthScale : 1.0;
      const totalScale = Number.isFinite(scaleA * scaleB) ? scaleA * scaleB : 1.0;

      const posX = (Number.isFinite(screen.x) ? screen.x : 0) + (Number.isFinite(jitterX) ? jitterX : 0);
      const posY = (Number.isFinite(screen.y) ? screen.y : 0) + (Number.isFinite(jitterY) ? jitterY : 0) + (Number.isFinite(hoverY) ? hoverY : 0);

      ctx.translate?.(posX, posY);
      ctx.scale?.(totalScale, totalScale);

      // Draw bubble procedural frame
      this._drawVariantBubble(ctx, b);

      // Draw speaker avatar badge
      if (b.badge) {
        this._drawBadge(ctx, b.badge, b);
      }

      // Draw mood indicator
      if (b.mood) {
        this._drawMood(ctx, b.mood, b);
      }

      // Draw dialogue text
      ctx.font = b.style === 'cyber'
        ? "700 13px 'Courier New', monospace"
        : (b.style === 'pixel' ? "bold 13px 'Trebuchet MS', monospace" : "bold 14px 'Trebuchet MS', sans-serif");
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const lineList = (b.lines && b.lines.length > 0) ? b.lines : [b.text];
      const lineHeight = (b.style === 'cyber' || b.style === 'pixel') ? 16 : 17;
      const startY = lineList.length === 1 ? 0 : -((lineList.length - 1) * lineHeight) / 2;

      let remainingChars = b.typewriterChars;
      for (let lineIdx = 0; lineIdx < lineList.length; lineIdx++) {
        const fullLine = lineList[lineIdx];
        let lineText = '';
        let isCurrentTypingLine = false;

        if (remainingChars >= fullLine.length) {
          lineText = fullLine;
          remainingChars -= fullLine.length;
        } else if (remainingChars > 0) {
          lineText = fullLine.slice(0, remainingChars);
          isCurrentTypingLine = true;
          remainingChars = 0;
        } else if (lineIdx === 0 && b.typewriterChars === 0) {
          isCurrentTypingLine = true;
        }

        const lineY = startY + lineIdx * lineHeight;

        if (b.style === 'cyber') {
          ctx.fillStyle = '#00f5ff';
          const isTyping = b.typewriterChars < b.text.length;
          const cursor = (isTyping && isCurrentTypingLine && Math.floor((b.elapsed || 0) * 6) % 2 === 0) ? '█' : '';
          if (lineText || cursor) {
            ctx.fillText?.(lineText + cursor, 0, lineY);
          }
        } else if (lineText) {
          if (b.style === 'shout') {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3.5;
            ctx.strokeText?.(lineText, 0, lineY);
            ctx.fillStyle = '#ffffff';
            ctx.fillText?.(lineText, 0, lineY);
          } else if (b.style === 'pixel') {
            ctx.fillStyle = '#111111';
            ctx.fillText?.(lineText, 1, lineY + 1);
            ctx.fillStyle = '#fef08a';
            ctx.fillText?.(lineText, 0, lineY);
          } else {
            ctx.fillStyle = '#111111';
            ctx.strokeText?.(lineText, 0, lineY);
            ctx.fillText?.(lineText, 0, lineY);
          }
        }
      }

      ctx.restore?.();
    }
  }

  _drawVariantBubble(ctx, bubble) {
    ctx.beginPath?.();
    switch (bubble.style) {
      case 'shout': {
        // 16-point perimeter starburst polygon
        const w = bubble.width || 110;
        const h = bubble.height || 55;
        const rx1 = w / 2 + 6;
        const rx2 = w / 2 - 10;
        const ry1 = h / 2 + 6;
        const ry2 = h / 2 - 8;
        const points = 16;
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const px = Math.cos(angle) * (i % 2 === 0 ? rx1 : rx2);
          const py = Math.sin(angle) * (i % 2 === 0 ? ry1 : ry2);
          if (i === 0) ctx.moveTo?.(px, py);
          else ctx.lineTo?.(px, py);
        }
        ctx.closePath?.();
        ctx.fillStyle = '#18040a';
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 4;
        ctx.fill?.();
        ctx.stroke?.();

        // Zigzag lightning tail
        const tailY = ry1 - 10;
        ctx.beginPath?.();
        ctx.moveTo?.(-10, tailY);
        ctx.lineTo?.(6, tailY + 10);
        ctx.lineTo?.(-4, tailY + 20);
        ctx.lineTo?.(8, tailY + 34);
        ctx.lineTo?.(2, tailY + 20);
        ctx.lineTo?.(12, tailY + 10);
        ctx.lineTo?.(6, tailY);
        ctx.closePath?.();
        ctx.fillStyle = '#ff1744';
        ctx.fill?.();
        ctx.stroke?.();
        break;
      }
      case 'cyber': {
        // 45° chamfered tech box
        const w = bubble.width || 120;
        const h = bubble.height || 50;
        const c = 8;
        const x = -w / 2;
        const y = -h / 2;
        ctx.beginPath?.();
        ctx.moveTo?.(x + c, y);
        ctx.lineTo?.(x + w - c, y);
        ctx.lineTo?.(x + w, y + c);
        ctx.lineTo?.(x + w, y + h - c);
        ctx.lineTo?.(x + w - c, y + h);
        ctx.lineTo?.(x + c, y + h);
        ctx.lineTo?.(x, y + h - c);
        ctx.lineTo?.(x, y + c);
        ctx.closePath?.();
        ctx.fillStyle = 'rgba(1, 14, 23, 0.95)';
        ctx.strokeStyle = '#00f5ff';
        ctx.lineWidth = 2.5;
        ctx.fill?.();
        ctx.stroke?.();

        // Horizontal scanlines
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.12)';
        ctx.lineWidth = 1;
        for (let sy = y + 5; sy < y + h - 4; sy += 6) {
          ctx.beginPath?.();
          ctx.moveTo?.(x + 6, sy);
          ctx.lineTo?.(x + w - 6, sy);
          ctx.stroke?.();
        }

        // Corner bracket reticles
        ctx.strokeStyle = '#00f5ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath?.();
        ctx.moveTo?.(x + 4, y + 12);
        ctx.lineTo?.(x + 4, y + 4);
        ctx.lineTo?.(x + 12, y + 4);
        ctx.stroke?.();

        ctx.beginPath?.();
        ctx.moveTo?.(x + w - 12, y + 4);
        ctx.lineTo?.(x + w - 4, y + 4);
        ctx.lineTo?.(x + w - 4, y + 12);
        ctx.stroke?.();

        // Stepped circuit trace tail
        ctx.beginPath?.();
        ctx.moveTo?.(0, y + h);
        ctx.lineTo?.(0, y + h + 10);
        ctx.lineTo?.(14, y + h + 10);
        ctx.lineTo?.(14, y + h + 22);
        ctx.strokeStyle = '#00f5ff';
        ctx.lineWidth = 2;
        ctx.stroke?.();
        break;
      }
      case 'pixel': {
        // 4px stepped voxel perimeter
        const w = bubble.width || 100;
        const h = bubble.height || 42;
        const p = 4;
        const x = -w / 2;
        const y = -h / 2;
        ctx.beginPath?.();
        ctx.moveTo?.(x + p * 2, y);
        ctx.lineTo?.(x + w - p * 2, y);
        ctx.lineTo?.(x + w - p, y);
        ctx.lineTo?.(x + w - p, y + p);
        ctx.lineTo?.(x + w, y + p);
        ctx.lineTo?.(x + w, y + h - p * 2);
        ctx.lineTo?.(x + w - p, y + h - p * 2);
        ctx.lineTo?.(x + w - p, y + h - p);
        ctx.lineTo?.(x + w - p * 2, y + h - p);
        ctx.lineTo?.(x + w - p * 2, y + h);
        ctx.lineTo?.(x + p * 2, y + h);
        ctx.lineTo?.(x + p, y + h);
        ctx.lineTo?.(x + p, y + h - p);
        ctx.lineTo?.(x, y + h - p);
        ctx.lineTo?.(x, y + p * 2);
        ctx.lineTo?.(x + p, y + p * 2);
        ctx.lineTo?.(x + p, y + p);
        ctx.lineTo?.(x + p * 2, y + p);
        ctx.closePath?.();
        ctx.fillStyle = '#240d3d';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.5;
        ctx.fill?.();
        ctx.stroke?.();

        // Staircase pixel tail (3 stepped voxel cubes)
        let curX = -4;
        let curY = y + h;
        for (let s = 0; s < 3; s++) {
          ctx.fillRect?.(curX, curY, p, p);
          ctx.strokeRect?.(curX, curY, p, p);
          curX += p;
          curY += p;
        }
        break;
      }
      case 'comic':
      default: {
        // Comic variant: organic rounded rectangle + double accent borders + tail
        const w = bubble.width || 100;
        const h = bubble.height || 42;
        const r = 10;
        const x = -w / 2;
        const y = -h / 2;

        ctx.beginPath?.();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect?.(x, y, w, h, r);
        } else {
          ctx.rect?.(x, y, w, h);
        }
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 3.5;
        ctx.fill?.();
        ctx.stroke?.();

        // Inner accent border in speaker color
        const accentColor = (SPEAKER_BADGES[bubble.speakerId]?.color) || '#ff8a00';
        ctx.beginPath?.();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect?.(x + 3, y + 3, w - 6, h - 6, 7);
        } else {
          ctx.rect?.(x + 3, y + 3, w - 6, h - 6);
        }
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.5;
        ctx.stroke?.();

        // Triangular pointer tail
        ctx.beginPath?.();
        ctx.moveTo?.(-10, y + h - 1);
        ctx.lineTo?.(0, y + h + 16);
        ctx.lineTo?.(10, y + h - 1);
        ctx.closePath?.();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2;
        ctx.fill?.();
        ctx.stroke?.();
        break;
      }
    }
  }

  _drawBadge(ctx, badge, bubble = null) {
    if (!badge) return;
    const badgeStr = String(badge);
    const label = bubble?.badgeLabel || (badgeStr.startsWith('[') ? badgeStr : `[${badgeStr.toUpperCase()}]`);
    ctx.save?.();
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const bw = label.length * 6 + 12;
    const bh = 14;
    const w = (typeof bubble === 'object' && bubble !== null ? bubble.width : (typeof bubble === 'number' ? bubble : Math.max(100, bw + 48))) || 100;
    const h = (typeof bubble === 'object' && bubble !== null ? bubble.height : 42) || 42;

    const bx = -w / 2 + 4;
    const by = -h / 2 - 9;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.5;
    ctx.beginPath?.();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect?.(bx, by, bw, bh, 4);
    } else {
      ctx.rect?.(bx, by, bw, bh);
    }
    ctx.fill?.();
    ctx.stroke?.();

    ctx.fillStyle = '#ff8a00';
    ctx.fillText?.(label, bx + 3, by + bh / 2);
    ctx.restore?.();
  }

  _drawMood(ctx, mood, bubble = null) {
    if (!mood) return;
    ctx.save?.();
    const w = (typeof bubble === 'object' && bubble !== null ? bubble.width : (typeof bubble === 'number' ? bubble : 100)) || 100;
    const h = (typeof bubble === 'object' && bubble !== null ? bubble.height : 42) || 42;
    const r = 10;
    const mx = w / 2 - 14;
    const my = -h / 2 - 3;

    ctx.beginPath?.();
    ctx.arc?.(mx, my, r, 0, Math.PI * 2);
    ctx.fillStyle = mood === '💀' ? '#1f2937' : (mood === '⚡' ? '#fef08a' : (mood === '!' ? '#fecaca' : '#ffffff'));
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.5;
    ctx.fill?.();
    ctx.stroke?.();

    ctx.font = "900 11px sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText?.(mood, mx, my);
    ctx.restore?.();
  }

  onCombatEvent(eventType, detail = {}) {
    const payload = (detail && typeof detail === 'object') ? detail : {};
    const anchor = payload.anchor || this.playerRef;
    switch (eventType) {
      case 'combo': {
        const hits = payload.hits || 0;
        if (hits >= 30) {
          const text = payload.text || '30 COMBO! GODLIKE!';
          return this.spawnSpeechBubble('orange', text, {
            style: 'shout',
            mood: '⚡',
            priority: payload.priority ?? 3,
            trauma: payload.trauma ?? 0.75,
            anchor
          });
        } else if (hits >= 20) {
          const text = payload.text || '20 COMBO! UNSTOPPABLE!';
          return this.spawnSpeechBubble('orange', text, {
            style: 'comic',
            mood: '!',
            priority: payload.priority ?? 2,
            anchor
          });
        } else if (hits >= 10) {
          const text = payload.text || '10 HITS! COMBO STREAK!';
          return this.spawnSpeechBubble('orange', text, {
            style: 'comic',
            mood: '⚡',
            priority: payload.priority ?? 1,
            anchor
          });
        }
        break;
      }
      case 'grab': {
        const grabTexts = ['SLAM DUNK!', 'SEISMIC SLAM!', 'KNOCKOUT SLAM!'];
        const text = payload.text || grabTexts[0];
        return this.spawnSpeechBubble('orange', text, {
          style: 'shout',
          mood: '⚡',
          priority: payload.priority ?? 3,
          trauma: payload.trauma ?? 0.85,
          anchor
        });
      }
      case 'low_hp': {
        const text = payload.text || 'CLUTCH TIME!\nNOT GIVING UP!';
        return this.spawnSpeechBubble('orange', text, {
          style: 'shout',
          mood: '💧',
          priority: payload.priority ?? 3,
          trauma: payload.trauma ?? 0.7,
          anchor
        });
      }
      case 'stage_clear': {
        const text = payload.text || 'STAGE COMPLETE!';
        return this.spawnSpeechBubble('orange', text, {
          style: 'comic',
          mood: '★',
          priority: payload.priority ?? 3,
          anchor
        });
      }
      case 'stage_start': {
        const stageNum = payload.stage || 1;
        const text = payload.text || (stageNum === 1 ? 'DRAW FAST, HIT HARD!' : `STAGE ${stageNum}! READY!`);
        return this.spawnSpeechBubble('orange', text, {
          style: 'comic',
          mood: '!',
          priority: payload.priority ?? 2,
          anchor
        });
      }
    }
    return null;
  }

  onCreativeAction(actionType, detail = {}) {
    const payload = (detail && typeof detail === 'object') ? detail : {};
    const speaker = payload.speaker || 'orange';
    const anchor = payload.anchor || null;
    const bubbleOpts = { anchor, x: payload.x, y: payload.y, z: payload.z };

    switch (actionType) {
      case 'flight': {
        const isEnabled = payload.enabled !== false;
        const text = isEnabled ? 'FLIGHT MODE: ON!\nGRAVITY: OFF!' : 'FLIGHT MODE: OFF!\nBACK TO EARTH!';
        return this.spawnSpeechBubble(speaker, text, {
          ...bubbleOpts,
          style: payload.style || 'cyber',
          mood: payload.mood || (isEnabled ? '★' : '⚡'),
          priority: payload.priority ?? 3,
          duration: 2.0
        });
      }
      case 'god_mode': {
        const isGod = payload.enabled !== false;
        const text = isGod ? 'GOD MODE: ON!\nINVINCIBLE!' : 'GOD MODE: OFF!\nMORTAL AGAIN!';
        return this.spawnSpeechBubble(speaker, text, {
          ...bubbleOpts,
          style: payload.style || (isGod ? 'shout' : 'comic'),
          mood: payload.mood || (isGod ? '⚡' : '💧'),
          priority: payload.priority ?? 3,
          duration: 2.0
        });
      }
      case 'tnt_place': {
        return this.spawnSpeechBubble(speaker, 'TNT PLACED!\nDON\'T STAND NEAR!', {
          ...bubbleOpts,
          style: payload.style || 'pixel',
          mood: payload.mood || '!',
          priority: payload.priority ?? 2,
          duration: 2.0
        });
      }
      case 'tnt_detonate': {
        return this.spawnSpeechBubble(speaker, 'KABOOM! BOOM!\nCHAIN REACTION!', {
          ...bubbleOpts,
          style: 'shout',
          mood: '💀',
          trauma: payload.trauma ?? 0.9,
          priority: payload.priority ?? 3,
          duration: 2.2
        });
      }
      case 'lucky_open':
      case 'lucky_block_open': {
        return this.spawnSpeechBubble(speaker, 'JACKPOT!\nWHAT\'S INSIDE?', {
          ...bubbleOpts,
          style: payload.style || 'comic',
          mood: payload.mood || '★',
          priority: payload.priority ?? 3,
          duration: 2.0
        });
      }
      case 'lucky_block': {
        if (payload.open || payload.opened) {
          return this.spawnSpeechBubble(speaker, 'JACKPOT!\nWHAT\'S INSIDE?', {
            ...bubbleOpts,
            style: payload.style || 'comic',
            mood: payload.mood || '★',
            priority: payload.priority ?? 3,
            duration: 2.0
          });
        }
        return this.spawnSpeechBubble(speaker, 'FEELING LUCKY?\nMYSTERY BOX!', {
          ...bubbleOpts,
          style: payload.style || 'pixel',
          mood: payload.mood || '?',
          priority: payload.priority ?? 2,
          duration: 2.0
        });
      }
      case 'weapon_switch': {
        const w = String(payload.weapon || 'weapon').toLowerCase();
        const WEAPON_CONFIGS = {
          // 8 Prompt Weapons (distinct styles: comic, cyber, shout)
          fists: { text: 'BARE FISTS!\nHAND TO HAND!', style: 'comic', mood: '!', priority: 2, trauma: 0 },
          sword: { text: 'DIAMOND SWORD!\nSLICE!', style: 'comic', mood: '★', priority: 2, trauma: 0 },
          bow: { text: 'VOXEL BOW!\nSNIPER SHOT!', style: 'comic', mood: '★', priority: 2, trauma: 0 },
          pistol: { text: 'CYBER PISTOL!\nLOCK & LOAD!', style: 'cyber', mood: '⚡', priority: 2, trauma: 0 },
          shotgun: { text: 'BOOMSTICK SHOTGUN!\nSPREAD!', style: 'shout', mood: '💀', priority: 3, trauma: 0.8 },
          minigun: { text: 'MINIGUN ROTATING!\nBRRRRT!', style: 'shout', mood: '⚡', priority: 3, trauma: 1.0 },
          rocket: { text: 'ROCKET LAUNCHER!\nFIRE!', style: 'shout', mood: '💀', priority: 3, trauma: 0.9 },
          laser: { text: 'ION LASER!\n1.21 GW!', style: 'cyber', mood: '⚡', priority: 2, trauma: 0 },

          // Creative Dock Weapons & Katana
          pencil: { text: 'GIANT PENCIL!\nSKETCH DOOM!', style: 'comic', mood: '★', priority: 2, trauma: 0 },
          staff: { text: 'COMMAND STAFF!\nOVERPOWERED!', style: 'shout', mood: '⚡', priority: 3, trauma: 0.8 },
          eraser: { text: 'PINK ERASER!\nRUBBED OUT!', style: 'comic', mood: '💧', priority: 2, trauma: 0 },
          toolbar_staff: { text: 'TOOLBAR STAFF!\nAGENT HACK!', style: 'cyber', mood: '⚡', priority: 3, trauma: 0 },
          pixel_bazooka: { text: 'PIXEL BAZOOKA!\nBARRAGE!', style: 'shout', mood: '💀', priority: 3, trauma: 0.9 },
          stone_spear: { text: 'STONE SPEAR!\nPRIMAL HUNT!', style: 'comic', mood: '!', priority: 2, trauma: 0 },
          hazard_sign: { text: 'HAZARD SIGN!\nHIGH VOLTAGE!', style: 'cyber', mood: '⚡', priority: 2, trauma: 0 },
          vira_blades: { text: 'DUAL VIRA-BLADES!\nDARK!', style: 'shout', mood: '💀', priority: 3, trauma: 0.8 },
          katana: { text: 'DIAMOND KATANA!\nDRAWN!', style: 'comic', mood: '⚡', priority: 2, trauma: 0 }
        };

        const cfg = WEAPON_CONFIGS[w] || {
          text: `EQUIPPED: ${w.toUpperCase()}!`,
          style: 'comic',
          mood: '⚡',
          priority: 2,
          trauma: 0
        };

        return this.spawnSpeechBubble(speaker, cfg.text, {
          ...bubbleOpts,
          style: cfg.style,
          mood: cfg.mood,
          priority: cfg.priority,
          trauma: cfg.trauma,
          duration: 1.6
        });
      }
      case 'spawn_entity': {
        const ent = String(payload.entity || 'enemy').toLowerCase();
        const BOSS_SET = new Set([
          'ender_dragon', 'warden_boss', 'creaking_boss', 'creeking',
          'mercenary_squad', 'mercenary_agent', 'mercenary_ballista',
          'mercenary_primal', 'mercenary_hazard', 'h4c3r', 'king_orange',
          'dark_lord', 'lucky_orb', 'creeper_lord', 'giant_cat', 'titan_boss', 'boss'
        ]);
        const isBoss = BOSS_SET.has(ent) || ent.includes('boss') || ent.includes('lord') || ent.includes('dragon') || ent.includes('titan') || ent.includes('mercenary') || ent.includes('h4c3r') || ent.includes('king');

        const ALLY_SET = new Set(['red', 'blue', 'yellow', 'green', 'cursor', 'chosen', 'chosen_one', 'king', 'ally']);
        const isAlly = ALLY_SET.has(ent) || ent.startsWith('ally');

        if (isBoss) {
          return this.spawnSpeechBubble(speaker, '[BOSS SUMMONED!]', {
            ...bubbleOpts,
            style: 'shout',
            mood: '💀',
            priority: payload.priority ?? 4,
            trauma: payload.trauma ?? 0.8,
            duration: 1.8
          });
        } else if (isAlly) {
          return this.spawnSpeechBubble(speaker, 'ALLY ARRIVED! READY!', {
            ...bubbleOpts,
            style: 'comic',
            mood: '★',
            priority: payload.priority ?? 3,
            duration: 1.6
          });
        } else {
          return this.spawnSpeechBubble(speaker, `SPAWNED: ${String(payload.entity || 'ENEMY').toUpperCase()}!`, {
            ...bubbleOpts,
            style: 'pixel',
            mood: '!',
            priority: payload.priority ?? 2,
            duration: 1.5
          });
        }
      }
      case 'summon_allies': {
        return this.spawnSpeechBubble(speaker, 'ALLIES ASSEMBLE!\nFULL SQUAD!', {
          ...bubbleOpts,
          style: 'comic',
          mood: '★',
          priority: payload.priority ?? 4,
          duration: 1.8
        });
      }
      case 'nuke_enemies': {
        return this.spawnSpeechBubble(speaker, '[TACTICAL NUKE INCOMING!]', {
          ...bubbleOpts,
          style: 'shout',
          mood: '💀',
          priority: payload.priority ?? 4,
          trauma: payload.trauma ?? 1.0,
          duration: 2.0
        });
      }
    }
    return actionType;
  }

  reset() {
    super.reset?.();
    for (let i = 0; i < this.activeBubbles.length; i++) {
      this._recycleBubble(this.activeBubbles[i]);
    }
    this.activeBubbles.length = 0;
    this.banterQueue.length = 0;
    this.speakerCooldowns.clear();
    this.soundTriggered.length = 0;
    if (speech2d && speech2d !== this && Array.isArray(speech2d.bubbles)) {
      speech2d.bubbles.length = 0;
    }
  }

  getActiveBubbles() {
    return this.activeBubbles;
  }

  getBanterQueue() {
    return this.banterQueue;
  }
}

// Singleton Export
export const speech3d = new SpeechBubbleManager3D();
export const speech = speech3d;
export { SpeechBubbleManager3D as Speech3DManager };

// Bridge the 2D speech singleton in 3D runtime:
if (speech2d && typeof speech2d.spawnBubble === 'function') {
  speech2d.spawnBubble = (x, y, text, speakerType, duration, options) => {
    return speech3d.spawnBubble(x, y, text, speakerType, duration, options);
  };
  speech2d.shout = (x, y, category, subKey, duration, options) => {
    return speech3d.shout(x, y, category, subKey, duration, options);
  };
  speech2d.shoutBoss = (x, y, bossName, eventName, duration, options) => {
    return speech3d.shoutBoss(x, y, bossName, eventName, duration, options);
  };
  speech2d.reset = () => speech3d.reset();
  speech2d.update = (dt, player) => speech3d.update(dt, player);
  speech2d.draw = (ctx, cam, w, h, cam3d) => speech3d.draw(ctx, cam, w, h, cam3d);
  try {
    Object.defineProperty(speech2d, 'bubbles', {
      get: () => speech3d.activeBubbles,
      set: (v) => { speech3d.activeBubbles = v; },
      configurable: true
    });
  } catch (err) {
    // Ignore if not reconfigurable
  }
}

export default speech3d;
