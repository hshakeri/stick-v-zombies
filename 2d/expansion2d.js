// ============================================================================
// Stick vs Zombies — 2D Full Campaign, Creative Sandbox, Physics & Speech
// Expansion Module (2d/expansion2d.js)
//   - 30-Stage Campaign + 11-Boss Trophy Room (Stages 18–30: Stronghold,
//     The End, Aether, Ancient City + Warden, Pale Garden + Creaking,
//     Minecraft Overworld, YouTube Studio, Google Chrome, Spotify Player,
//     Google Slides, Outside Rocket Corp, Rocket Corp HQ + Mercenaries,
//     Zero-Day + H4C3R)
//   - Prominent Level Selector (Title Screen, Top HUD & Pause Menu)
//   - Full 2D Creative Sandbox Mode (God Mode, 2D Flight, Freeze AI, 8 Weapons,
//     20 Voxel Blocks w/ Destructible TNT Blasting, Boss & Zombie Spawner)
//   - Full Death-Cause Attribution Banner (Game Over Modal + On-Canvas Callout)
//   - Swept Vertical Platform Contact, Floating Island Void Plunge & Lava Burn
//   - Expressive 2D Comic Speech Bubbles & Team/Boss Banter (Zero Three.js!)
//   - Multi-Plane Depth-of-Field (Cached Blurred Far/Mid Planes, Aerial Haze,
//     Platform/Entity Contact Shadows & Fast Foreground Bokeh)
// ============================================================================

import { audio } from '../js/engine/audio.js?v=9.8';
import { input } from '../js/engine/input.js?v=9.8';
import { particles } from '../js/engine/particles.js?v=9.8';
import { Player } from '../js/entities/player.js?v=9.8';
import { waves } from '../js/systems/waves.js?v=9.8';
import { combat } from '../js/systems/combat.js?v=9.8';
import { shop } from '../js/systems/shop.js?v=9.8';
import { projectiles } from '../js/entities/projectiles.js?v=9.8';
import { allies } from '../js/entities/allies.js?v=9.8';
import { speech as speech2d } from '../js/engine/speech.js?v=9.8';
import { save } from '../js/systems/save.js?v=9.8';

import {
  CAMPAIGN_BEATS_3D,
  OVERWORLD_OUTPOST_BLOCKS,
  formatAttackerDeathMessage,
  formatProjectileDeathMessage,
  resolvePlayerDeathCause,
  extendCampaignFor3D
} from '../3d/js/campaign3d.js?v=10.8';
import {
  ISLAND_FLOOR_BOUNDS,
  VOID_FALL_THRESHOLD,
  CREATIVE_BLOCK_SIZE_2D,
  GROUND_CRATER_MAX_Y_DIST,
  isOpenEdgeTheme,
  isLavaSeaTheme,
  resolveSweptVerticalCollision,
  checkPlatformStepOff,
  checkLavaHazard,
  computeSafeGroundCraterBounds,
  mergeOrAppendGroundCrater,
  findContainingGroundHole,
  isPointInGroundHole,
  findSafeGroundPoint
} from '../3d/js/physics3d.js?v=10.4';
import { speech3d } from '../3d/js/speech3d.js?v=10.3';

import {
  CREATIVE_BLOCK_TYPES_2D,
  getBlockPalette2D,
  drawCreativeBlocks2D,
  drawSketchBlocksVoxel2D,
  drawFloatingIslandBody2D,
  drawMinecraftLavaFeatures2D,
  drawExpandedStageBackground2D,
  drawExpandedTrophyIcons2D,
  drawBossFloorTelegraphs2D,
  drawCustomStagePlatforms2D,
  drawGroundCraters2D
} from './arenas2d.js?v=10.6';
import { install2DBossAndWeaponRenderers } from './bosses2d.js?v=10.4';
import { depth2d, DEPTH_PARALLAX } from './depth2d.js?v=10.6';

export const STAGE_OPTIONS_2D = Object.freeze([
  { value: 1, label: '1: Main Desktop' },
  { value: 2, label: '2: Adobe Animate Timeline' },
  { value: 3, label: '3: Downloads & Malware Zone' },
  { value: 4, label: '4: Firewall Security Grid' },
  { value: 5, label: '5: 💀 BSOD — Titan Undead' },
  { value: 6, label: '6: Corrupted Recycle Bin' },
  { value: 7, label: '7: 🔥 Minecraft Nether Core (Lava)' },
  { value: 8, label: '8: Linux Terminal Purge' },
  { value: 9, label: '9: Virabot Nexus' },
  { value: 10, label: '10: 🌊 Showdown Lake — The Dark Lord' },
  { value: 11, label: '11: 👑 Command Realm — King Orange' },
  { value: 12, label: '12: Glitch Browser Tabs' },
  { value: 13, label: '13: ☁️ Cloud Cache Island' },
  { value: 14, label: '14: Root Gateway' },
  { value: 15, label: '15: 🟩 Creeper Clan — Creeper Lord' },
  { value: 16, label: '16: 🐾 Creeper Archive — Giant Cat' },
  { value: 17, label: '17: 🟡 Lucky Dimension — The Lucky Orb' },
  { value: 18, label: '18: 🏰 The Stronghold — End Portal' },
  { value: 19, label: '19: 🐉 The End — Ender Dragon' },
  { value: 20, label: '20: ☁️ The Aether — Golden Skylands' },
  { value: 21, label: '21: 🔊 Ancient City — The Warden' },
  { value: 22, label: '22: 🪵 Pale Garden — The Creaking' },
  { value: 23, label: '23: ⛏️ Minecraft Overworld' },
  { value: 24, label: '24: ▶️ YouTube Studio' },
  { value: 25, label: '25: 🌐 Google Chrome' },
  { value: 26, label: '26: 🎧 Spotify Player' },
  { value: 27, label: '27: 📊 Google Slides' },
  { value: 28, label: '28: 🏢 Outside Rocket Corp' },
  { value: 29, label: '29: 🕶️ Rocket Corp HQ — The Mercenaries' },
  { value: 30, label: '30: ⌁ Zero-Day Mainframe — H4C3R' },
  { value: 31, label: '31: 🏆 Trophy Room Epilogue (11 Bosses)' }
]);

const BOSS_STAGES_2D = new Set([5, 10, 11, 15, 16, 17, 19, 21, 22, 29, 30]);

const EXPANDED_LESSONS_2D = Object.freeze({
  1: 'MOVE · JUMP · Q COMBO · ROLL',
  2: 'CALL RED · CRAWLERS ARE QUICK',
  3: 'H HOOKS SPITTERS',
  4: 'FLANK SHIELDS · HEAVIES REVERSE H',
  6: 'F GRABS · BOOM-BUGS FLASH',
  7: 'WATCH LAVA POOLS & CLIFFS · STAFF PICKUP',
  8: 'AIR CHASE · ALLIES 2–4',
  10: 'FULL METER? PRESS R',
  12: 'STALKERS BLINK · TURN FAST',
  13: 'OPEN CLOUD CLIFFS · WATCH YOUR STEP!',
  15: 'GREEN RING = BLAST · ROLL',
  16: 'PAW LANE = HOLD JUMP',
  17: 'FLOATING LUCKY ISLAND · READ GOLD RINGS',
  18: 'LEAP PORTAL LAVA · RIDE STONE BRIDGE',
  19: 'WATCH SWOOP LANE · DODGE DRAGON BREATH',
  20: 'FLOATING SKY ISLAND · MIND THE CLIFFS!',
  21: 'SONIC BOOM PIERCES · ROLL PAST THE WARDEN',
  22: 'FACE THE CREAKING TO FREEZE IT · WATCH ROOTS',
  23: 'DEFEND VILLAGE · PUNCH TNT TO BLAST BLOCKS!',
  24: 'RIDE TIMELINE SCRUBBER · LEAP RED BUFFER BEAM',
  25: 'HOP BROWSER TABS · CLEAR THE OMNIBOX',
  26: 'RIDE VERTICAL EQUALIZER LIFTS · DROP THE BASS',
  27: 'GRAB GIANT PINK ERASER · CRASH THE SLIDE DECK',
  28: 'LEAP SECURITY LASER · BREACH ROCKET PLAZA',
  29: '4 MERCENARIES · DIVIDE AND CONQUER',
  30: 'FINAL ROOT PATCH · UNLEASH R AWAKENING!'
});

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function map2DSpeakerTo3D(speakerType, anchor) {
  if (anchor && typeof anchor === 'object') {
    if (anchor.type) return anchor.type;
    if (anchor.canDoubleJump !== undefined) return 'orange';
  }
  const raw = String(speakerType || 'orange');
  if (raw.startsWith('player')) return 'orange';
  if (raw.startsWith('ally-')) return raw.slice(5);
  if (raw === 'darkLord') return 'dark_lord';
  if (raw === 'kingOrange') return 'king_orange';
  if (raw === 'creeperLord') return 'creeper_lord';
  if (raw === 'giantCat') return 'giant_cat';
  if (raw === 'luckyOrb') return 'lucky_orb';
  if (raw === 'titan') return 'titan_boss';
  return raw;
}

function inferStyleForSpeaker(speakerKey, priority = 1) {
  if (speakerKey === 'h4c3r' || speakerKey === 'cursor') return 'cyber';
  if (speakerKey.startsWith('mercenary_') || ['agent', 'ballista', 'primal', 'hazard'].includes(speakerKey)) {
    return 'pixel';
  }
  if (
    priority >= 4 ||
    ['titan_boss', 'dark_lord', 'ender_dragon', 'warden_boss', 'creaking_boss'].includes(speakerKey)
  ) {
    return 'shout';
  }
  return 'comic';
}

function ensure2DExpansionDOM() {
  if (typeof document === 'undefined') return;

  // 0. Title Quick-Jump Pills for Stage 10, Stage 18 (Stronghold), Stage 23 (Overworld), Apps (24..27) & Stage 28 (Outside Rocket Corp)
  const quickPills = document.querySelector('.quick-stage-pills');
  if (quickPills) {
    if (!quickPills.querySelector('[data-jump-stage="10"]')) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'quick-stage-btn';
      pill.setAttribute('data-jump-stage', '10');
      pill.textContent = '🌊 10: Showdown Lake (Dark Lord)';
      quickPills.prepend(pill);
    }
    const anchor19 = quickPills.querySelector('[data-jump-stage="19"]');
    if (!quickPills.querySelector('[data-jump-stage="18"]')) {
      const pill18 = document.createElement('button');
      pill18.type = 'button';
      pill18.className = 'quick-stage-btn';
      pill18.setAttribute('data-jump-stage', '18');
      pill18.textContent = '🏰 18: Stronghold';
      if (anchor19) quickPills.insertBefore(pill18, anchor19);
      else quickPills.appendChild(pill18);
    }
    const anchor29 = quickPills.querySelector('[data-jump-stage="29"]') || quickPills.querySelector('[data-jump-stage="27"]');
    const extraPills = [
      { stage: '23', label: '⛏️ 23: Overworld' },
      { stage: '24', label: '▶️ 24: YouTube' },
      { stage: '25', label: '🌐 25: Chrome' },
      { stage: '26', label: '🎧 26: Spotify' },
      { stage: '27', label: '📊 27: Slides' },
      { stage: '28', label: '🏢 28: Outside Rocket Corp' }
    ];
    for (const entry of extraPills) {
      if (!quickPills.querySelector(`[data-jump-stage="${entry.stage}"]`)) {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'quick-stage-btn';
        pill.setAttribute('data-jump-stage', entry.stage);
        pill.textContent = entry.label;
        if (anchor29) quickPills.insertBefore(pill, anchor29);
        else quickPills.appendChild(pill);
      }
    }
  }

  // 0b. Game Over Death Cause Banner inside #gameover-modal
  const goModalBox = document.querySelector('#gameover-modal .modal-box');
  if (goModalBox && !document.getElementById('gameover-death-reason')) {
    const banner = document.createElement('div');
    banner.id = 'gameover-death-reason';
    banner.className = 'gameover-death-banner';
    banner.innerHTML = '<span class="gameover-death-label">💀 HOW YOU DIED</span><span id="gameover-death-text" class="gameover-death-text">The Second Coming was defeated in battle</span>';
    const goCard = goModalBox.querySelector('.go-card');
    if (goCard) goModalBox.insertBefore(banner, goCard);
    else goModalBox.appendChild(banner);
  }

  // 1. HUD Stage Selector inside .wave-badge
  const waveBadge = document.querySelector('.wave-badge');
  if (waveBadge && !document.getElementById('hud-stage-select')) {
    const sel = document.createElement('select');
    sel.id = 'hud-stage-select';
    sel.className = 'stage-select-box hud-stage-select';
    sel.setAttribute('aria-label', 'Jump to stage');
    sel.title = 'Jump to any Stage or Boss';
    waveBadge.appendChild(sel);
  }

  // 2. Pause Modal Stage Selector
  const pauseModalBox = document.querySelector('#pause-modal .modal-box > div:last-child');
  if (pauseModalBox && !document.getElementById('pause-stage-select')) {
    const row = document.createElement('div');
    row.className = 'pause-stage-row';
    const lbl = document.createElement('label');
    lbl.setAttribute('for', 'pause-stage-select');
    lbl.textContent = '🎯 JUMP TO STAGE / BOSS:';
    const sel = document.createElement('select');
    sel.id = 'pause-stage-select';
    sel.className = 'stage-select-box';
    sel.setAttribute('aria-label', 'Jump to stage from pause menu');
    row.appendChild(lbl);
    row.appendChild(sel);
    const resumeBtn = document.getElementById('btn-resume-game');
    if (resumeBtn && resumeBtn.nextSibling) {
      pauseModalBox.insertBefore(row, resumeBtn.nextSibling);
    } else {
      pauseModalBox.prepend(row);
    }
  }

  // 3. HUD Quick Button for Creative Mode
  const quickBtns = document.querySelector('.hud-quick-buttons');
  if (quickBtns && !document.getElementById('btn-creative-toggle')) {
    const btn = document.createElement('button');
    btn.id = 'btn-creative-toggle';
    btn.type = 'button';
    btn.className = 'hud-btn creative-hud-btn';
    btn.title = 'Toggle Creative Sandbox Mode (C)';
    btn.innerHTML = '<span class="hud-btn-icon" aria-hidden="true">🛠️</span><span class="hud-btn-label">Creative: OFF (C)</span>';
    quickBtns.prepend(btn);
  }

  // 4. Collapsible Creative Sandbox Dock inside #hud-overlay
  const hudOverlay = document.getElementById('hud-overlay');
  if (hudOverlay && !document.getElementById('creative-dock')) {
    const dock = document.createElement('div');
    dock.id = 'creative-dock';
    dock.className = 'creative-dock';
    dock.setAttribute('aria-label', 'Creative Sandbox Toolbar');
    dock.innerHTML = `
      <div class="creative-dock-header">
        <span class="creative-dock-title">🛠️ 2D CREATIVE SANDBOX</span>
        <button type="button" id="btn-creative-collapse" class="creative-collapse-btn" title="Minimize / Expand Sandbox Panel">▾</button>
      </div>
      <div id="creative-dock-body" class="creative-dock-body">
        <div class="creative-row creative-toggles-row">
          <button type="button" id="creative-god-btn" class="creative-chip active" title="Invincibility, Infinite Ink & Zero Cooldowns">🛡️ God: ON</button>
          <button type="button" id="creative-fly-btn" class="creative-chip" title="Toggle 2D Flight (W/Up/Space = Up, S/Down = Down, or Double-Tap Space)">✈️ Fly: OFF</button>
          <button type="button" id="creative-freeze-ai-btn" class="creative-chip" title="Freeze or unfreeze enemy AI">⏸️ AI: RUN</button>
        </div>
        <div class="creative-row">
          <label for="creative-weapon-select" class="creative-row-label">⚔️ WEAPON</label>
          <select id="creative-weapon-select" class="creative-select" aria-label="Equip 2D Weapon">
            <option value="pencil">✏️ Giant Pencil</option>
            <option value="staff">🟧 Command Staff (King Orange)</option>
            <option value="eraser">🧽 Giant Pink Eraser</option>
            <option value="toolbar_staff">🕶️ UI Toolbar Staff (Agent)</option>
            <option value="pixel_bazooka">🚀 8-Bit Bazooka (Ballista)</option>
            <option value="stone_spear">🦴 Stone Spear (Primal)</option>
            <option value="hazard_sign">⚠️ High-Voltage Sign (Hazard)</option>
            <option value="vira_blades">🗡️ Dual Vira-Blades (Dark Lord)</option>
          </select>
        </div>
        <div class="creative-row">
          <label for="creative-block-select" class="creative-row-label">🧱 BLOCK</label>
          <select id="creative-block-select" class="creative-select" aria-label="Select 2D Voxel Block">
            <option value="command_block">🟧 Command Block</option>
            <option value="obsidian">⬛ Obsidian</option>
            <option value="gold_block">🟨 Gold Block</option>
            <option value="tnt_block">🧨 TNT Block (Explosive!)</option>
            <option value="lucky_block">❓ Lucky Block</option>
            <option value="grass_block">🟩 Grass Block (Overworld)</option>
            <option value="cobblestone">🪨 Cobblestone</option>
            <option value="stone_bricks">🧱 Stone Bricks (Stronghold)</option>
            <option value="oak_planks">🪵 Oak Planks</option>
            <option value="crafting_table">🛠️ Crafting Table</option>
            <option value="purpur_block">🟪 Purpur Block</option>
            <option value="holystone">☁️ Aether Holystone</option>
            <option value="rocket_corp_wall">🏢 Rocket Corp Panel</option>
            <option value="sculk">🌌 Sculk Block</option>
            <option value="deepslate_tiles">🧱 Deepslate Tiles</option>
            <option value="pale_moss">🌿 Pale Moss Block</option>
            <option value="pale_oak_log">🪵 Pale Oak Log</option>
            <option value="creaking_heart">🧡 Creaking Heart</option>
            <option value="sketch_block">✏️ Sketch Block</option>
            <option value="lava">🔥 Lava Block</option>
          </select>
          <button type="button" id="creative-place-block-btn" class="creative-action-btn" title="Place 2D Voxel Block (Shortcut: V)">➕ [V]</button>
          <button type="button" id="creative-clear-blocks-btn" class="creative-action-btn secondary" title="Clear placed blocks">🗑️</button>
        </div>
        <div class="creative-row">
          <label for="creative-spawn-select" class="creative-row-label">👾 SPAWN</label>
          <select id="creative-spawn-select" class="creative-select" aria-label="Select Boss or Zombie to Spawn">
            <optgroup label="★ STORY BOSSES">
              <option value="creaking_boss">🪵 The Creaking (Pale Garden)</option>
              <option value="warden_boss">🔊 The Warden (Ancient City)</option>
              <option value="ender_dragon">🐉 Ender Dragon</option>
              <option value="mercenary_squad">🕶️ All 4 Mercenaries Squad</option>
              <option value="mercenary_agent">🕶️ Agent (Rocket Corp)</option>
              <option value="mercenary_ballista">🚀 Ballista (Rocket Corp)</option>
              <option value="mercenary_primal">🦴 Primal (Rocket Corp)</option>
              <option value="mercenary_hazard">⚠️ Hazard (Rocket Corp)</option>
              <option value="h4c3r">💻 H4C3R (Zero-Day)</option>
              <option value="king_orange">👑 King Orange</option>
              <option value="dark_lord">😈 The Dark Lord</option>
              <option value="lucky_orb">🟡 The Lucky Orb</option>
              <option value="creeper_lord">🟩 Creeper Lord</option>
              <option value="giant_cat">🐱 Giant Cat</option>
              <option value="titan_boss">👹 Titan Undead</option>
            </optgroup>
            <optgroup label="🧟 ZOMBIES">
              <option value="walker">🧟 Basic Zombie</option>
              <option value="runner">🏃 Runner</option>
              <option value="brute">💪 Brute</option>
              <option value="shieldbearer">🛡️ Shieldbearer</option>
              <option value="crawler">🕷️ Crawler</option>
              <option value="boom_bug">💣 Boom-Bug</option>
              <option value="spitter">🧪 Acid Spitter</option>
              <option value="stalker">🔮 Blink Stalker</option>
              <option value="warden">🛡️ Heavy Warden</option>
            </optgroup>
          </select>
          <button type="button" id="creative-spawn-btn" class="creative-action-btn spawn" title="Spawn selected Boss or Zombie (Shortcut: N)">⚡ [N]</button>
        </div>
        <div class="creative-row creative-actions-grid">
          <button type="button" id="creative-allies-btn" class="creative-action-btn" title="Summon Red, Blue, Yellow, Green, Cursor, TCO & Friendly King Orange!">🤝 All Allies</button>
          <button type="button" id="creative-nuke-btn" class="creative-action-btn danger" title="Obliterate all active enemies">💥 Nuke Enemies</button>
          <button type="button" id="creative-max-shop-btn" class="creative-action-btn" title="Max out all Shop upgrades">⬆️ Max Stats</button>
          <button type="button" id="creative-portal-btn" class="creative-action-btn" title="Unlock the Stage Exit Portal">🚪 Open Exit</button>
        </div>
      </div>
    `;
    const hudTop = hudOverlay.querySelector('.hud-top');
    if (hudTop && hudTop.nextSibling) {
      hudOverlay.insertBefore(dock, hudTop.nextSibling);
    } else {
      hudOverlay.appendChild(dock);
    }
  }
}

export function install2DExpansion(game) {
  if (!game) return null;
  if (game._expansion2DInstalled) return game._expansion2D;
  game._expansion2DInstalled = true;

  install2DBossAndWeaponRenderers();
  extendCampaignFor3D(game.stageManager, waves);
  ensure2DExpansionDOM();

  const stageManager = game.stageManager;

  // Sandbox & Physics State
  const sandbox = {
    enabled: false,
    godMode: true,
    flight: false,
    freezeAI: false,
    selectedWeapon: 'pencil',
    selectedBlock: 'command_block',
    selectedSpawn: 'creaking_boss',
    blocks: [],
    groundHoles: [],
    lastSpaceTapTime: 0,
    lastSafeIslandX: -650,
    lastComboMilestone: 0,
    lowHpCalloutCooldown: 0,
    activeDamagePhase: null,
    lastDamageCause: '',
    lastDeathReason: '',
    prevEnemyYs: new WeakMap()
  };

  function updateDeathBannerDOM(reason) {
    const finalText = reason || 'The Second Coming was defeated in battle';
    if (typeof document === 'undefined') return finalText;
    let banner = document.getElementById('gameover-death-reason');
    if (!banner) {
      ensure2DExpansionDOM();
      banner = document.getElementById('gameover-death-reason');
    }
    const textSpan = document.getElementById('gameover-death-text');
    if (textSpan) {
      textSpan.textContent = finalText;
    } else if (banner) {
      banner.textContent = `💀 HOW YOU DIED: ${finalText}`;
    }
    return finalText;
  }

  function inferCurrent2DDamageCause(player) {
    if (player?._pendingDamageCause) return player._pendingDamageCause;
    if (player?._activeAttacker) return formatAttackerDeathMessage(player._activeAttacker);

    if (sandbox.activeDamagePhase === 'stage_hazards') {
      return stageManager.theme === 'youtube'
        ? 'The Second Coming was vaporized by a YouTube Skip-Ad Laser'
        : 'The Second Coming was vaporized by a Security Laser';
    }

    if (sandbox.activeDamagePhase === 'projectiles') {
      if (projectiles.isUpdatingProjectiles) {
        let bestProj = null;
        let bestDist = Infinity;
        const py = (player?.y || 0) - 30;
        for (const p of projectiles.projectiles || []) {
          if (!p) continue;
          if (p.type === 'doom_laser' && p.hitPlayer) {
            bestProj = p;
            break;
          }
          if (!p.isHostile) continue;
          const d = Math.hypot((p.x || 0) - (player?.x || 0), (p.y || 0) - py);
          if (d < bestDist) {
            bestDist = d;
            bestProj = p;
          }
        }
        if (bestProj) return formatProjectileDeathMessage(bestProj);
      }
      return formatProjectileDeathMessage({ type: 'acid_pool' });
    }

    if (sandbox.activeDamagePhase === 'enemies') {
      let closest = null;
      let bestDist = Infinity;
      for (const z of waves.zombies || []) {
        if (!z || z.isDead) continue;
        const d = Math.hypot(z.x - (player?.x || 0), z.y - (player?.y || 0));
        if (d < bestDist) {
          bestDist = d;
          closest = z;
        }
      }
      if (closest) return formatAttackerDeathMessage(closest);
    }

    return player?.lastDamageCause || sandbox.lastDamageCause || 'The Second Coming was defeated in battle';
  }

  // Zero-alloc 2D Camera Adapter for SpeechBubbleManager3D
  const projOut = { x: 0, y: 0, zDepth: 0, scale: 1, visible: true };
  const cameraAdapter2D = {
    getViewportSize: () => game.camera.getViewportSize(),
    worldToScreen: (wx, wy) => {
      const pt = game.camera.worldToScreen(wx, wy, false);
      const vp = game.camera.getViewportSize();
      projOut.x = pt.x;
      projOut.y = pt.y;
      projOut.zDepth = 0;
      projOut.scale = clamp(game.camera.getEffectiveZoom?.() || 1, 0.85, 1.18);
      projOut.visible = pt.x >= -200 && pt.x <= vp.width + 200 && pt.y >= -200 && pt.y <= vp.height + 200;
      return projOut;
    }
  };

  // Bridge base 2D speech.spawnBubble -> expressive comic speech3d when 2D game is running
  if (!speech2d._bridgedToSpeech3D2D) {
    speech2d._bridgedToSpeech3D2D = true;
    const origSpawnBubble2D = speech2d.spawnBubble.bind(speech2d);
    const origResetSpeech2D = speech2d.reset.bind(speech2d);

    speech2d.spawnBubble = (x, y, text, speakerType = 'player', duration = 1.6, options = {}) => {
      const ok = origSpawnBubble2D(x, y, text, speakerType, duration, options);
      if (game._expansion2DInstalled) {
        const speakerKey = map2DSpeakerTo3D(speakerType, options?.anchor);
        const style = options?.style || inferStyleForSpeaker(speakerKey, options?.priority || 1);
        speech3d.spawnSpeechBubble(speakerKey, text, {
          x,
          y: y - 48,
          z: 0,
          duration,
          style,
          priority: options?.priority ?? 2,
          anchor: options?.anchor || null,
          bypassCooldown: options?.cooldownMs === 0 || Boolean(options?.bypassCooldown)
        });
      }
      return ok;
    };

    speech2d.reset = () => {
      origResetSpeech2D();
      speech3d.reset?.();
    };
  }

  // --------------------------------------------------------------------------
  // Stage Manager Render & Solid-Platform Extensions
  // --------------------------------------------------------------------------
  let suppressCreativeBlocksInPlatformDraw = false;
  const origGetAllSolidPlatforms = stageManager.getAllSolidPlatforms.bind(stageManager);
  stageManager.getAllSolidPlatforms = () => {
    const list = origGetAllSolidPlatforms();
    if (!suppressCreativeBlocksInPlatformDraw) {
      for (let i = 0; i < sandbox.blocks.length; i++) {
        const b = sandbox.blocks[i];
        if (b && !b.broken && b.texKey !== 'lava') {
          list.push(b);
        }
      }
    }
    return list;
  };

  const origDrawPlatforms = stageManager.drawPlatforms.bind(stageManager);
  stageManager.drawPlatforms = (ctx) => {
    suppressCreativeBlocksInPlatformDraw = true;
    try {
      const stageOnlyPlatforms = origGetAllSolidPlatforms();
      depth2d.drawPlatformDepthShadows(ctx, stageOnlyPlatforms);
      if (!drawCustomStagePlatforms2D(stageManager, ctx, stageOnlyPlatforms)) {
        origDrawPlatforms(ctx);
      }
    } finally {
      suppressCreativeBlocksInPlatformDraw = false;
    }
  };

  const origDrawDesktopBackground = stageManager.drawDesktopBackground.bind(stageManager);
  stageManager.drawDesktopBackground = (ctx, groundY) => {
    const renderDepthPlanes = () => {
      if ((stageManager.whiteVoidProgress || 0) >= 0.85) return;
      depth2d.drawBackgroundDepthPlanes(
        ctx,
        stageManager,
        game.camera,
        groundY,
        particles.reducedEffects === true
      );
    };

    const handledCustom = drawExpandedStageBackground2D(stageManager, ctx, groundY, renderDepthPlanes);
    if (handledCustom) {
      const suppressLegacyMotifs = stageManager.theme === 'dark_core' ||
        stageManager.theme === 'stronghold' ||
        stageManager.theme === 'overworld' ||
        stageManager.theme === 'youtube' ||
        stageManager.theme === 'chrome' ||
        stageManager.theme === 'spotify' ||
        stageManager.theme === 'slides' ||
        stageManager.theme === 'rocket_corp_exterior';
      if (!suppressLegacyMotifs) {
        stageManager.drawEnvironmentMotifs(ctx, 0);
      }
      stageManager.drawCampaignSignal(ctx, stageManager.bounds.minX, stageManager.bounds.minY);
      if (!suppressLegacyMotifs) {
        stageManager.drawEnvironmentMotifs(ctx, 1);
      }
      return;
    }

    origDrawDesktopBackground(ctx, groundY);

    // Upgrade Open-Edge Floating Islands (Stage 7 Minecraft Nether, Stage 13 Cloud Cache, Stage 17 Lucky Dimension)
    if (isOpenEdgeTheme(stageManager.theme)) {
      const halfX = ISLAND_FLOOR_BOUNDS.halfX; // 980
      const minY = stageManager.bounds.minY - 1000;
      const wingFill = stageManager.theme === 'minecraft'
        ? '#29151d'
        : (stageManager.theme === 'cloud_cache' ? '#102942' : '#21112d');

      // Mask out the enclosed desktop red side walls & floor line beyond |x| > 980
      ctx.save();
      ctx.fillStyle = wingFill;
      ctx.fillRect(stageManager.bounds.minX - 1600, minY, (-halfX) - (stageManager.bounds.minX - 1600), groundY + 1100 - minY);
      ctx.fillRect(halfX, minY, (stageManager.bounds.maxX + 1600) - halfX, groundY + 1100 - minY);
      ctx.fillRect(-halfX, groundY + 1, halfX * 2, 1050);
      ctx.restore();

      // Render blurred distant Nether fortresses / sky islands / monoliths + aerial haze behind the crisp island
      renderDepthPlanes();

      if (isLavaSeaTheme(stageManager.theme)) {
        drawMinecraftLavaFeatures2D(stageManager, ctx, groundY);
      } else if (stageManager.theme === 'cloud_cache') {
        drawFloatingIslandBody2D(ctx, groundY, '#bae6fd', '#334155', '#7dd3fc', stageManager.stageTime);
      } else if (stageManager.theme === 'lucky_orb') {
        drawFloatingIslandBody2D(ctx, groundY, '#facc15', '#4c1d95', '#fde047', stageManager.stageTime);
      }
    } else {
      // Enclosed desktop, BSOD, firewall, terminal, archive, Zero-Day, and Trophy rooms
      renderDepthPlanes();
    }
  };

  const origDrawDesktopIcons = stageManager.drawDesktopIcons.bind(stageManager);
  stageManager.drawDesktopIcons = (ctx) => {
    if (stageManager.isTrophyRoom && drawExpandedTrophyIcons2D(stageManager, ctx, game.groundY)) {
      return;
    }
    if (!stageManager.isTrophyRoom) {
      const camX = Number.isFinite(game.camera?.x) ? game.camera.x : 0;
      ctx.save();
      ctx.translate(camX * (1 - DEPTH_PARALLAX.ICONS), 0);
      ctx.globalAlpha = 0.86;
      origDrawDesktopIcons(ctx);
      ctx.restore();
      return;
    }
    origDrawDesktopIcons(ctx);
  };

  const origDrawErrorPopups = stageManager.drawErrorPopups.bind(stageManager);
  stageManager.drawErrorPopups = (ctx) => {
    if (!stageManager.errorPopups?.length) return;
    const camX = Number.isFinite(game.camera?.x) ? game.camera.x : 0;
    ctx.save();
    ctx.translate(camX * 0.16, 0);
    ctx.globalAlpha = 0.9;
    origDrawErrorPopups(ctx);
    ctx.restore();
  };

  const origDrawTaskbar = stageManager.drawTaskbar.bind(stageManager);
  stageManager.drawTaskbar = (ctx, groundY) => {
    const nonDesktop = isOpenEdgeTheme(stageManager.theme) ||
      stageManager.theme === 'dark_core' ||
      stageManager.theme === 'stronghold' ||
      stageManager.theme === 'ancient_city' ||
      stageManager.theme === 'pale_garden' ||
      stageManager.theme === 'overworld' ||
      stageManager.theme === 'youtube' ||
      stageManager.theme === 'chrome' ||
      stageManager.theme === 'spotify' ||
      stageManager.theme === 'slides' ||
      stageManager.theme === 'rocket_corp_exterior' ||
      stageManager.theme === 'rocket_corp';
    if (nonDesktop) return;
    origDrawTaskbar(ctx, groundY);
  };

  // --------------------------------------------------------------------------
  // Player Protection, Death-Cause Tracking & Special Creative Weapon Hooks
  // --------------------------------------------------------------------------
  function decoratePlayerInstance(player) {
    if (!player || player._decorated2DExpansion) return player;
    player._decorated2DExpansion = true;

    const origDie = player.die.bind(player);
    player.die = () => {
      if (player.isDead) return;
      const reason = resolvePlayerDeathCause(player, sandbox.lastDamageCause);
      player.lastDeathReason = reason;
      sandbox.lastDeathReason = reason;
      player._pendingDamageCause = null;
      origDie();
      updateDeathBannerDOM(reason);
      particles.addTextBanner(player.x, player.y - 96, `💀 ${reason.toUpperCase()}`, '#fde047');
    };

    const origTakeDamage = player.takeDamage.bind(player);
    player.takeDamage = (amount, knockbackDir = 0, knockbackPower = 300) => {
      if (player.isGodMode || (sandbox.enabled && sandbox.godMode)) {
        player._pendingDamageCause = null;
        return;
      }
      if (!player.isDead && player.iFrames <= 0 && !player.isRolling && !player.isAwakened && amount > 0) {
        const cause = inferCurrent2DDamageCause(player);
        player.lastDamageCause = cause;
        sandbox.lastDamageCause = cause;
      }
      player._pendingDamageCause = null;
      origTakeDamage(amount, knockbackDir, knockbackPower);
    };

    const origExecuteWeaponAttack = player.executeWeaponAttack.bind(player);
    player.executeWeaponAttack = (zombies, camera) => {
      const started = origExecuteWeaponAttack(zombies, camera);
      if (!started) return false;
      const wType = player.weaponType;
      if (wType === 'pixel_bazooka') {
        projectiles.spawnJavelin?.(
          player.x + player.facing * 42,
          player.y - 38,
          player.facing,
          Math.round(75 * (player.damageMultiplier || 1))
        );
        particles.addShockwave(player.x + player.facing * 36, player.y - 38, 54, '#ef4444', 5);
      } else if (wType === 'hazard_sign') {
        particles.addShockwave(player.x + player.facing * 52, player.y - 24, 88, '#facc15', 6);
        particles.createHitSparks(player.x + player.facing * 52, player.y - 28, 8, '#facc15');
      } else if (wType === 'toolbar_staff') {
        particles.createHitSparks(player.x + player.facing * 56, player.y - 36, 7, '#38bdf8');
      } else if (wType === 'vira_blades') {
        particles.addShockwave(player.x + player.facing * 48, player.y - 34, 76, '#ff1744', 6);
      }

      // Check Creative Block hits (ignite TNT, crack Lucky Block, pulse Creaking Heart)
      triggerCreativeBlockStrike(player.x + player.facing * 68, player.y - 30, 95);
      return true;
    };

    const origExecuteLightCombo = player.executeLightCombo.bind(player);
    player.executeLightCombo = (zombies, camera) => {
      const started = origExecuteLightCombo(zombies, camera);
      if (started) {
        triggerCreativeBlockStrike(player.x + player.facing * 52, player.y - 30, 78);
      }
      return started;
    };

    if (sandbox.enabled) {
      player.isGodMode = sandbox.godMode;
      player.isCreativeFlight = sandbox.flight;
      if (sandbox.selectedWeapon) {
        player.weaponType = sandbox.selectedWeapon;
        player.temporaryWeaponTimer = 0;
      }
    }
    return player;
  }

  decoratePlayerInstance(game.player);

  // --------------------------------------------------------------------------
  // Creative Voxel Block Builder Actions (Place, Clear, TNT Detonation, Lucky)
  // --------------------------------------------------------------------------
  function detachEntitiesStandingOn(targetPlatform) {
    if (!targetPlatform) return;
    if (game.player?.standingPlatform === targetPlatform) {
      game.player.standingPlatform = null;
      game.player.isGrounded = false;
    }
    for (const z of waves.zombies || []) {
      if (z && z.standingPlatform === targetPlatform) {
        z.standingPlatform = null;
        z.isGrounded = false;
      }
    }
  }

  function placeCreativeBlock(texKey, options = null) {
    let requestedKey = texKey;
    const sel = typeof document !== 'undefined' ? document.getElementById('creative-block-select') : null;
    if (!requestedKey && sel?.value) {
      sandbox.selectedBlock = sel.value;
    }
    requestedKey = requestedKey || sandbox.selectedBlock;
    const validKey = CREATIVE_BLOCK_TYPES_2D.includes(requestedKey) ? requestedKey : 'command_block';
    if (!options?.silent) {
      sandbox.selectedBlock = validKey;
      if (sel && sel.value !== validKey) {
        sel.value = validKey;
      }
    }
    const player = game.player;
    const grid = CREATIVE_BLOCK_SIZE_2D; // 68
    const snappedX = Number.isFinite(options?.x)
      ? clamp(options.x, -952, 952)
      : clamp(Math.round(((player?.x || 0) + (player?.facing || 1) * 84) / grid) * grid, -952, 952);

    // Stack neatly on top of existing blocks in the same column
    let baseBottomY = Number.isFinite(options?.y)
      ? options.y
      : (player && player.y < game.groundY - 10 ? Math.round(player.y / grid) * grid : game.groundY);
    if (!Number.isFinite(options?.y)) {
      for (let i = 0; i < sandbox.blocks.length; i++) {
        const existing = sandbox.blocks[i];
        if (!existing || existing.broken) continue;
        if (Math.abs(existing.x - snappedX) < grid * 0.6 && existing.y - existing.height <= baseBottomY) {
          baseBottomY = Math.min(baseBottomY, existing.y - existing.height);
        }
      }
    }
    baseBottomY = Math.max(-544, baseBottomY);

    const block = {
      x: snappedX,
      y: baseBottomY,
      z: 0,
      width: grid,
      height: grid,
      depth3d: grid,
      texKey: validKey,
      title: validKey.toUpperCase(),
      appType: 'creative',
      damage: validKey === 'lava' ? 20 : 0,
      fuseTimer: validKey === 'tnt_block' && !options?.armedOnHit ? 2.2 : undefined,
      broken: false
    };
    if (sandbox.blocks.length >= 64) {
      sandbox.blocks.shift();
    }
    sandbox.blocks.push(block);
    if (!options?.silent) {
      audio.playBlockPlace?.();
      particles.createDust(block.x, block.y - grid * 0.5, 6);
      particles.addDamageText(block.x, block.y - grid - 10, validKey.replaceAll('_', ' ').toUpperCase(), false, '#34d399');
    }
    return block;
  }

  function spawnStageVoxelProps() {
    if (stageManager.theme !== 'overworld') return;
    for (let i = 0; i < OVERWORLD_OUTPOST_BLOCKS.length; i++) {
      const spec = OVERWORLD_OUTPOST_BLOCKS[i];
      placeCreativeBlock(spec.texKey, {
        x: spec.x,
        y: game.groundY + (spec.y || 0),
        armedOnHit: Boolean(spec.armedOnHit),
        silent: true
      });
    }
  }

  function clearCreativeBlocks() {
    sandbox.blocks.length = 0;
    sandbox.groundHoles.length = 0;
    if (game.player) {
      game.player._fallingHole2D = null;
      if (game.player.standingPlatform?.appType === 'creative') {
        game.player.standingPlatform = null;
        game.player.isGrounded = false;
      }
    }
  }

  function isOverGroundHole2D(x, margin = 12) {
    if (stageManager.isTrophyRoom || sandbox.groundHoles.length === 0) return false;
    return isPointInGroundHole(x, 0, sandbox.groundHoles, margin, true);
  }

  function carveGroundCrater2D(cx, cy, options = {}) {
    if (stageManager.isTrophyRoom) return null;
    if (cy < game.groundY - GROUND_CRATER_MAX_Y_DIST || cy > game.groundY + 120) return null;

    const crater = computeSafeGroundCraterBounds(cx, 0, {
      entranceX: stageManager.entranceDoor?.x ?? -900,
      exitX: stageManager.exitDoor?.x ?? 900,
      ...options
    });
    if (!crater) return null;

    const merged = mergeOrAppendGroundCrater(sandbox.groundHoles, crater, true);

    // Immediately drop grounded entities whose floor support was just blown open!
    if (game.player && !game.player.standingPlatform && isOverGroundHole2D(game.player.x)) {
      game.player.isGrounded = false;
    }
    for (let i = 0; i < waves.zombies.length; i++) {
      const z = waves.zombies[i];
      if (z && !z.isDead && !z.standingPlatform && !z.isFlying && z.type !== 'ender_dragon' && isOverGroundHole2D(z.x)) {
        z.isGrounded = false;
      }
    }

    particles.createHitSparks(merged.cx, game.groundY - 4, 14, '#a16207');
    particles.createDust(merged.cx, game.groundY, 12);
    return merged;
  }

  // Stamp voxel texKey onto E-key SketchBlocks so they render crisp 16x16 pixel art
  projectiles._afterSpawnSketchBlock2D = (block, type) => {
    if (!block) return;
    if (sandbox.enabled) {
      const sel = typeof document !== 'undefined' ? document.getElementById('creative-block-select') : null;
      const picked = sel?.value || sandbox.selectedBlock;
      block.texKey = CREATIVE_BLOCK_TYPES_2D.includes(picked) ? picked : 'command_block';
    } else {
      block.texKey = type === 'obsidian' ? 'obsidian' : 'sketch_block';
    }
  };
  if (!projectiles._wrappedSpawnSketchBlock2D) {
    projectiles._wrappedSpawnSketchBlock2D = true;
    const origSpawnSketchBlock = projectiles.spawnSketchBlock.bind(projectiles);
    projectiles.spawnSketchBlock = (x, y, type = 'obsidian') => {
      const res = origSpawnSketchBlock(x, y, type);
      const newest = projectiles.sketchBlocks[projectiles.sketchBlocks.length - 1];
      projectiles._afterSpawnSketchBlock2D?.(newest, type);
      return res;
    };
  }

  function blastBlocksInRadius2D(cx, cy, radius = 240, sourceBlock = null) {
    let destroyedCount = 0;

    // 1. Destroy nearby Creative / World Voxel Blocks (and chain-ignite TNT / crack Lucky Blocks!)
    for (let i = 0; i < sandbox.blocks.length; i++) {
      const other = sandbox.blocks[i];
      if (!other || other.broken || other === sourceBlock) continue;
      const otherCenterY = other.y - (other.height || 68) * 0.5;
      const dist = Math.hypot(other.x - cx, otherCenterY - cy);
      if (dist > radius) continue;

      if (other.texKey === 'tnt_block') {
        other.isIgnited = true;
        other.fuseTimer = Math.min(other.fuseTimer ?? 99, 0.25);
        particles.createHitSparks(other.x, otherCenterY, 6, '#f87171');
      } else if (other.texKey === 'lucky_block') {
        detachEntitiesStandingOn(other);
        crackLuckyBlock(other);
        destroyedCount++;
      } else {
        other.broken = true;
        detachEntitiesStandingOn(other);
        const pal = getBlockPalette2D(other.texKey);
        particles.createHitSparks(other.x, otherCenterY, 10, pal.base);
        particles.createHitSparks(other.x, otherCenterY, 4, pal.light);
        particles.createDust(other.x, otherCenterY, 5);
        destroyedCount++;
      }
    }

    // Prune non-source broken blocks immediately so getAllSolidPlatforms & render update right away
    for (let i = sandbox.blocks.length - 1; i >= 0; i--) {
      const b = sandbox.blocks[i];
      if (b && b.broken && b !== sourceBlock) {
        sandbox.blocks.splice(i, 1);
      }
    }

    // 2. Also blow up nearby [E] SketchBlocks so ALL placed blocks in blast radius shatter!
    const sBlocks = projectiles.sketchBlocks || [];
    for (let i = sBlocks.length - 1; i >= 0; i--) {
      const sb = sBlocks[i];
      if (!sb) continue;
      const sbCenterY = sb.y - (sb.height || 60) * 0.5;
      if (Math.hypot(sb.x - cx, sbCenterY - cy) <= radius) {
        detachEntitiesStandingOn(sb);
        const pal = getBlockPalette2D(sb.texKey || 'obsidian');
        particles.createHitSparks(sb.x, sbCenterY, 10, pal.base);
        particles.createDust(sb.x, sbCenterY, 5);
        sBlocks.splice(i, 1);
        destroyedCount++;
      }
    }

    return destroyedCount;
  }

  function detonateTNTBlock(block) {
    if (!block || block.broken) return;
    block.broken = true;
    detachEntitiesStandingOn(block);

    const centerY = block.y - (block.height || 68) * 0.5;
    audio.playFinisherImpact?.();
    game.camera?.addShake?.(0.72);
    particles.addShockwave(block.x, centerY, 240, '#ef4444', 12);
    particles.createHitSparks(block.x, centerY, 22, '#facc15');
    particles.createDust(block.x, centerY, 10);
    particles.addComicPopup(block.x, block.y - 68, 'KA-BOOM!', '#ef4444', '#fde047');

    // Blow up surrounding voxel blocks & SketchBlocks + chain-ignite neighboring TNT!
    blastBlocksInRadius2D(block.x, centerY, 240, block);

    // Carve a destructible crater into the arena ground if TNT detonated near floor level!
    carveGroundCrater2D(block.x, centerY);

    // Damage enemies in blast radius
    for (const z of waves.zombies) {
      if (!z || z.isDead) continue;
      const dist = Math.hypot(z.x - block.x, z.y - block.y);
      if (dist <= 240) {
        const dir = z.x >= block.x ? 1 : -1;
        z.takeDamage?.(220, dir, 720, true);
      }
    }

    // Damage player if caught in TNT blast while God Mode is OFF
    const player = game.player;
    if (player && !player.isDead && !player.isGodMode && !(sandbox.enabled && sandbox.godMode)) {
      const pDist = Math.hypot(player.x - block.x, (player.y - 30) - centerY);
      if (pDist <= 195) {
        const dir = player.x >= block.x ? 1 : -1;
        player._pendingDamageCause = 'The Second Coming was blown up by TNT';
        sandbox.lastDamageCause = 'The Second Coming was blown up by TNT';
        player.takeDamage(42, dir, 580);
      }
    }
  }

  function crackLuckyBlock(block) {
    if (!block || block.broken) return;
    block.broken = true;
    detachEntitiesStandingOn(block);
    audio.playUpgradeBuy?.();
    particles.addShockwave(block.x, block.y - 34, 130, '#facc15', 8);
    particles.createHitSparks(block.x, block.y - 34, 14, '#fde047');

    const roll = Math.floor(Math.abs(block.x + stageManager.stageTime * 10)) % 3;
    if (roll === 0) {
      combat.ink += 250;
      particles.addTextBanner(block.x, block.y - 78, '★ LUCKY JACKPOT: +250 INK! ★', '#fde047');
    } else if (roll === 1) {
      game.player.superMeter = game.player.maxSuper;
      particles.addTextBanner(block.x, block.y - 78, '⚡ LUCKY SURGE: FULL AWAKENING! ⚡', '#38bdf8');
    } else {
      game.player.heal(60);
      for (const z of waves.zombies) {
        if (z && !z.isDead && Math.hypot(z.x - block.x, z.y - block.y) <= 220) {
          z.takeDamage?.(120, z.x >= block.x ? 1 : -1, 560, true);
        }
      }
      particles.addTextBanner(block.x, block.y - 78, '🍀 LUCKY NOVA +60 HP! 🍀', '#34d399');
    }
  }

  function triggerCreativeBlockStrike(hitX, hitY, radius = 85) {
    for (let i = 0; i < sandbox.blocks.length; i++) {
      const b = sandbox.blocks[i];
      if (!b || b.broken) continue;
      const centerY = b.y - b.height * 0.5;
      if (Math.hypot(b.x - hitX, centerY - hitY) <= radius) {
        if (b.texKey === 'tnt_block') {
          b.isIgnited = true;
          b.fuseTimer = Math.min(b.fuseTimer ?? 99, 0.65);
          particles.addDamageText(b.x, b.y - b.height - 12, '🧨 FUSE LIT!', false, '#f87171');
        } else if (b.texKey === 'lucky_block') {
          crackLuckyBlock(b);
        } else if (b.texKey === 'creaking_heart') {
          particles.addShockwave(b.x, centerY, 155, '#f97316', 9);
          particles.createHitSparks(b.x, centerY, 12, '#fde047');
          for (const z of waves.zombies) {
            if (z && !z.isDead && Math.hypot(z.x - b.x, z.y - b.y) <= 175) {
              z.takeDamage?.(85, z.x >= b.x ? 1 : -1, 460, true);
            }
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Creative Sandbox Actions (Spawner, Allies, Nuke, Max Stats, Exit, Toggle)
  // --------------------------------------------------------------------------
  function computeCreativeSpawnX(baseDist = 205, extraOffset = 0) {
    const px = Number.isFinite(game.player?.x) ? game.player.x : 0;
    let dir = (game.player?.facing || 1) >= 0 ? 1 : -1;
    if (px + dir * (baseDist + extraOffset) > 870) dir = -1;
    else if (px + dir * (baseDist + extraOffset) < -870) dir = 1;
    return clamp(px + dir * (baseDist + extraOffset), -870, 870);
  }

  function spawnCreativeEntity(type) {
    let requested = type;
    if (!requested && typeof document !== 'undefined') {
      const sel = document.getElementById('creative-spawn-select');
      if (sel?.value) sandbox.selectedSpawn = sel.value;
    }
    requested = requested || sandbox.selectedSpawn || 'creaking_boss';
    const normalized = requested === 'basic'
      ? 'walker'
      : (requested === 'necromancer' ? 'stalker' : (requested === 'creeking' ? 'creaking_boss' : requested));
    sandbox.selectedSpawn = normalized;

    waves.isWaveActive = true;
    waves.isWaveClearing = false;

    // Keep Creative arena silky-smooth if dozens of mobs are spawned back-to-back
    while (waves.zombies.length >= 28) {
      const idx = waves.zombies.findIndex((z) => z && !z.isBoss);
      waves.zombies.splice(idx >= 0 ? idx : 0, 1);
    }

    const origGetSafeSpawnX = waves.getSafeSpawnX.bind(waves);

    if (normalized === 'mercenary_squad') {
      const mercs = ['mercenary_agent', 'mercenary_ballista', 'mercenary_primal', 'mercenary_hazard'];
      const beforeLen = waves.zombies.length;
      for (let i = 0; i < mercs.length; i++) {
        const targetX = computeCreativeSpawnX(155, i * 68);
        try {
          waves.getSafeSpawnX = () => targetX;
          waves._creativeSpawnX = targetX;
          waves.spawnZombie(mercs[i], game.player, game.groundY, game.camera);
        } finally {
          waves.getSafeSpawnX = origGetSafeSpawnX;
          waves._creativeSpawnX = undefined;
        }
        const spawnedMerc = waves.zombies[waves.zombies.length - 1];
        if (spawnedMerc) {
          spawnedMerc.x = targetX;
          spawnedMerc.facing = targetX >= (game.player?.x || 0) ? -1 : 1;
        }
      }
      const lead = waves.zombies[beforeLen];
      if (lead) {
        particles.addDamageText(lead.x, lead.y - 96, '⚡ SPAWNED: MERCENARY SQUAD', false, '#facc15');
      }
      return waves.zombies.slice(beforeLen);
    }

    const stagger = ((sandbox.spawnSerial = ((sandbox.spawnSerial || 0) + 1) % 4)) * 42;
    const targetX = computeCreativeSpawnX(205, stagger);
    try {
      waves.getSafeSpawnX = () => targetX;
      waves._creativeSpawnX = targetX;
      waves.spawnZombie(normalized, game.player, game.groundY, game.camera);
    } finally {
      waves.getSafeSpawnX = origGetSafeSpawnX;
      waves._creativeSpawnX = undefined;
    }

    const spawned = waves.zombies[waves.zombies.length - 1] || null;
    if (spawned) {
      spawned.x = targetX;
      spawned.facing = targetX >= (game.player?.x || 0) ? -1 : 1;
      const label = (spawned.name || normalized.replaceAll('_', ' ')).toUpperCase();
      particles.addDamageText(
        spawned.x,
        spawned.y - (spawned.height || 64) - 18,
        `⚡ SPAWNED: ${label}`,
        false,
        '#facc15'
      );
    }
    return spawned;
  }

  function summonAllAllies() {
    allies.unlocked.king = true;
    for (const k of Object.keys(allies.cooldowns)) {
      allies.cooldowns[k] = 0;
      allies.recoveryStates[k] = false;
    }
    const roster = ['red', 'blue', 'yellow', 'green', 'cursor', 'chosen', 'king'];
    roster.forEach((allyType, idx) => {
      const offsetX = clamp(game.player.x + (idx - 3) * 55, -900, 900);
      allies.summonAlly(allyType, offsetX, game.groundY, game.player.facing, waves.zombies);
    });
    speech3d.spawnSpeechBubble('orange', 'STICK SQUAD ASSEMBLE!', {
      style: 'comic',
      priority: 4,
      mood: '★',
      anchor: game.player,
      bypassCooldown: true
    });
  }

  function nukeAllEnemies() {
    waves.spawnQueue.length = 0;
    for (let i = waves.zombies.length - 1; i >= 0; i--) {
      const z = waves.zombies[i];
      if (!z || z.isDead) continue;
      if (typeof z.die === 'function') z.die(true);
      else z.isDead = true;
    }
    waves.zombies.length = 0;
    waves.bossZombie = null;
    game.camera?.addShake?.(0.75);
    particles.addShockwave(game.player.x, game.player.y - 36, 360, '#ff3344', 14);
    particles.addTextBanner(game.player.x, game.player.y - 95, '💥 SANDBOX NUKE CLEARED ARENA! 💥', '#ffea00');
  }

  function maxAllStats() {
    for (const upgrade of shop.upgrades) {
      while (upgrade.level < upgrade.maxLevel) {
        upgrade.level++;
        upgrade.apply(game.player);
      }
    }
    game.player.hp = game.player.maxHp;
    game.player.superMeter = game.player.maxSuper;
    combat.ink = Math.max(combat.ink, 9999);
    audio.playUpgradeBuy?.();
    particles.addTextBanner(game.player.x, game.player.y - 90, '⬆️ ALL STATS MAXED! ⬆️', '#34d399');
  }

  function unlockStageExit() {
    waves.spawnQueue.length = 0;
    stageManager.isObjectiveComplete = true;
    stageManager.exitDoor.isOpen = true;
    audio.playDoorUnlock?.();
    particles.addShockwave(stageManager.exitDoor.x, stageManager.exitDoor.y - 45, 130, '#10b981', 8);
    particles.addTextBanner(stageManager.exitDoor.x, stageManager.exitDoor.y - 115, '🚪 EXIT UNLOCKED! 🚪', '#34d399');
  }

  function equipCreativeWeapon(weaponType) {
    sandbox.selectedWeapon = weaponType;
    if (game.player) {
      game.player.weaponType = weaponType;
      game.player.temporaryWeaponTimer = 0;
      particles.addDamageText(
        game.player.x,
        game.player.y - 78,
        `EQUIPPED: ${weaponType.replaceAll('_', ' ').toUpperCase()}`,
        false,
        '#38bdf8'
      );
    }
    if (typeof document !== 'undefined') {
      const sel = document.getElementById('creative-weapon-select');
      if (sel && sel.value !== weaponType) sel.value = weaponType;
    }
  }

  function syncCreativeUI() {
    if (typeof document === 'undefined') return;
    const dock = document.getElementById('creative-dock');
    const hudBtn = document.getElementById('btn-creative-toggle');
    const godBtn = document.getElementById('creative-god-btn');
    const flyBtn = document.getElementById('creative-fly-btn');
    const aiBtn = document.getElementById('creative-freeze-ai-btn');

    if (dock) dock.classList.toggle('active', sandbox.enabled);
    if (hudBtn) {
      hudBtn.classList.toggle('active', sandbox.enabled);
      const lbl = hudBtn.querySelector('.hud-btn-label');
      if (lbl) lbl.textContent = sandbox.enabled ? 'Creative: ON (C)' : 'Creative: OFF (C)';
    }
    if (godBtn) {
      godBtn.classList.toggle('active', sandbox.godMode);
      godBtn.textContent = sandbox.godMode ? '🛡️ God: ON' : '🛡️ God: OFF';
    }
    if (flyBtn) {
      flyBtn.classList.toggle('active', sandbox.flight);
      flyBtn.textContent = sandbox.flight ? '✈️ Fly: ON' : '✈️ Fly: OFF';
    }
    if (aiBtn) {
      aiBtn.classList.toggle('active', sandbox.freezeAI);
      aiBtn.textContent = sandbox.freezeAI ? '⏸️ AI: FROZEN' : '⏸️ AI: RUN';
    }
  }

  function setCreativeMode(enabled) {
    sandbox.enabled = Boolean(enabled);
    if (!sandbox.enabled) {
      sandbox.flight = false;
      sandbox.freezeAI = false;
      if (game.player) {
        game.player.isGodMode = false;
        game.player.isCreativeFlight = false;
      }
    } else if (game.player) {
      game.player.isGodMode = sandbox.godMode;
      game.player.isCreativeFlight = sandbox.flight;
      if (sandbox.godMode) {
        game.player.hp = game.player.maxHp;
        game.player.superMeter = game.player.maxSuper;
        combat.ink = Math.max(combat.ink, 9999);
      }
      speech3d.spawnSpeechBubble('orange', 'CREATIVE SANDBOX ONLINE!', {
        style: 'comic',
        priority: 4,
        mood: '★',
        anchor: game.player,
        bypassCooldown: true
      });
    }
    syncCreativeUI();
    return sandbox.enabled;
  }

  // --------------------------------------------------------------------------
  // Level Selector Sync & Stage Jump
  // --------------------------------------------------------------------------
  function syncStageSelectors() {
    if (typeof document === 'undefined') return;
    const currentVal = String(stageManager.isTrophyRoom ? 31 : stageManager.currentStage);
    for (const id of ['title-stage-select', 'hud-stage-select', 'pause-stage-select']) {
      const sel = document.getElementById(id);
      if (!sel) continue;
      if (sel.options.length !== STAGE_OPTIONS_2D.length) {
        sel.innerHTML = '';
        for (const opt of STAGE_OPTIONS_2D) {
          const el = document.createElement('option');
          el.value = String(opt.value);
          el.textContent = opt.label;
          sel.appendChild(el);
        }
      }
      sel.value = currentVal;
    }
  }

  function jumpToStage(stageValue, options = {}) {
    const requested = Number(stageValue);
    if (!Number.isFinite(requested)) return;
    if (typeof window !== 'undefined') audio.init?.();

    if (options.creative !== undefined) {
      sandbox.enabled = Boolean(options.creative);
    }

    clearCreativeBlocks();

    if (requested === 31) {
      stageManager.isTrophyRoom = false;
      game.enterTrophyRoom();
      decoratePlayerInstance(game.player);
      setCreativeMode(sandbox.enabled);
      syncStageSelectors();
      return;
    }

    const targetStage = clamp(Math.trunc(requested), 1, 30);
    if (game.state === 'TITLE' || options.freshStart) {
      game.startGame({ stage: targetStage, creative: sandbox.enabled });
    } else {
      game.advanceStage(targetStage);
    }
    syncStageSelectors();
  }

  // --------------------------------------------------------------------------
  // Wrap Game Lifecycle Methods (startGame, retryStage, advanceStage, etc.)
  // --------------------------------------------------------------------------
  const origPrepareWeaponPickup = game.prepareWeaponPickup.bind(game);
  game.prepareWeaponPickup = (stage) => {
    origPrepareWeaponPickup(stage === 23 ? 7 : (stage === 27 ? 12 : stage));
  };

  game.getStageLesson = (stage) => EXPANDED_LESSONS_2D[stage] || 'CHAIN MOVES · WATCH RINGS';

  game.showMissionStrip = (stage, prefix = '') => {
    if (typeof document === 'undefined') return;
    const strip = document.getElementById('mission-strip');
    if (!strip) return;
    const beat = stageManager.campaignBeat || CAMPAIGN_BEATS_3D[stage] || {};
    const act = document.getElementById('mission-act');
    const mission = document.getElementById('mission-text');
    const lesson = document.getElementById('mission-lesson');
    const clue = document.getElementById('mission-clue');

    if (act) act.textContent = `${prefix ? `${prefix} · ` : ''}${beat.act || `STAGE ${stage}`}`;
    if (mission) mission.textContent = beat.mission || stageManager.stageName;
    if (clue) {
      const prevClue = stageManager.isTrophyRoom
        ? beat.clue
        : (stage > 1 ? CAMPAIGN_BEATS_3D[stage - 1]?.clue : null);
      clue.textContent = prevClue ? `TRACE // ${prevClue}` : '';
    }
    if (lesson) {
      lesson.textContent = stageManager.isTrophyRoom
        ? 'EXPLORE ALL 11 MONUMENTS · ENTER RESULTS DOOR'
        : game.getStageLesson(stage);
    }
    strip.classList.add('active');
    game.missionStripTimer = stage === 1 || BOSS_STAGES_2D.has(stage) ? 4.0 : 3.5;
    game.missionStripGrace = 0.75;
  };

  game.startGame = (options = {}) => {
    const checkpoint = options.fromCheckpoint ? save.data.checkpoint : null;
    const requestedStage = Number.isFinite(Number(options.stage)) ? Math.trunc(Number(options.stage)) : null;

    if (requestedStage === 31) {
      stageManager.isTrophyRoom = false;
      game.enterTrophyRoom();
      if (options.creative) setCreativeMode(true);
      syncStageSelectors();
      return;
    }

    const stage = requestedStage
      ? clamp(requestedStage, 1, 30)
      : (checkpoint && checkpoint.stage >= 1 && checkpoint.stage <= 30 ? checkpoint.stage : 1);

    clearCreativeBlocks();
    sandbox.lastComboMilestone = 0;
    sandbox.lastDamageCause = '';
    sandbox.lastDeathReason = '';

    game.hideAllModals();
    game.state = 'PLAYING';
    audio.setBGMDucked?.(false);
    game.reportedLayerErrors.clear();
    input.resetHeldInputs();
    projectiles.reset();
    allies.reset(true, false, stage > 11);
    particles.reset();
    speech2d.reset();
    shop.reset();
    combat.resetRun(checkpoint ? checkpoint.ink ?? 50 : 50);

    stageManager.loadStage(stage);
    spawnStageVoxelProps();
    game.player = decoratePlayerInstance(new Player(stageManager.entranceDoor.x + 30, game.groundY));
    game.player.isGrounded = true;
    sandbox.lastSafeIslandX = clamp(game.player.x, -860, 860);

    if (checkpoint && !requestedStage) {
      combat.score = checkpoint.score | 0;
      combat.totalKills = checkpoint.totalKills | 0;
      combat.maxCombo = checkpoint.maxCombo | 0;
      for (const savedUpgrade of checkpoint.upgrades || []) {
        const upgrade = shop.upgrades.find((entry) => entry.id === savedUpgrade.id);
        if (!upgrade) continue;
        const targetLevel = clamp(savedUpgrade.level | 0, 0, upgrade.maxLevel);
        while (upgrade.level < targetLevel) {
          upgrade.level++;
          upgrade.apply(game.player);
        }
      }
      game.player.hp = game.player.maxHp;
    }

    if (options.creative !== undefined) {
      setCreativeMode(Boolean(options.creative));
    } else if (sandbox.enabled) {
      setCreativeMode(true);
    }

    game.player.beginDrawIn?.();
    game.camera.snapTo(game.player);
    waves.startWave(stage);
    game.prepareWeaponPickup(stage);
    game.captureStageCheckpoint();
    game.showMissionStrip(stage, checkpoint && !requestedStage ? 'CONTINUE' : '');
    syncStageSelectors();
  };

  const origRetryStage = game.retryStage.bind(game);
  game.retryStage = () => {
    clearCreativeBlocks();
    sandbox.lastDamageCause = '';
    sandbox.lastDeathReason = '';
    origRetryStage();
    spawnStageVoxelProps();
    decoratePlayerInstance(game.player);
    if (game.player) {
      game.player.lastDamageCause = '';
      game.player.lastDeathReason = '';
      game.player._pendingDamageCause = null;
    }
    if (sandbox.enabled) {
      game.player.weaponType = sandbox.selectedWeapon;
      game.player.isGodMode = sandbox.godMode;
      game.player.isCreativeFlight = sandbox.flight;
    }
    syncStageSelectors();
  };

  game.advanceStage = (nextStage) => {
    const clampedNext = clamp(Math.trunc(Number(nextStage) || 1), 1, 30);
    clearCreativeBlocks();
    sandbox.lastDamageCause = '';
    sandbox.lastDeathReason = '';
    game.hideAllModals();
    game.state = 'PLAYING';
    audio.setBGMDucked?.(false);
    save.recordStageCleared(clampedNext - 1);
    stageManager.loadStage(clampedNext);
    spawnStageVoxelProps();
    projectiles.reset();
    allies.reset(false, true, clampedNext > 11);
    particles.reset();
    speech2d.reset();
    combat.clearArena();

    decoratePlayerInstance(game.player);
    game.player.lastDamageCause = '';
    game.player.lastDeathReason = '';
    game.player._pendingDamageCause = null;
    game.player.x = stageManager.entranceDoor.x + 30;
    game.player.y = game.groundY;
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.pose = 'idle';
    game.player.attackTimer = 0;
    game.player.weaponTimer = 0;
    game.player.activeMove = null;
    game.player.bufferedMove = null;
    game.player.isRolling = false;
    game.player.rollTimer = 0;
    game.player.diveKick = false;
    game.player.isGrounded = true;
    game.player.airJuggleTarget = null;
    game.player.cancelHook?.(true);
    game.player.squashX = 1.0;
    game.player.squashY = 1.0;
    if (game.player.isAwakened) game.player.deactivateAwakening?.();
    game.player.temporaryWeaponTimer = 0;
    game.player.weaponType = sandbox.enabled ? sandbox.selectedWeapon : 'pencil';
    game.player.stageDamageTaken = 0;
    sandbox.lastSafeIslandX = clamp(game.player.x, -860, 860);

    const isBossCheckpoint = BOSS_STAGES_2D.has(clampedNext);
    const baselineHeal = game.player.maxHp * 0.18;
    const bossSafetyHeal = Math.max(0, game.player.maxHp * 0.75 - game.player.hp);
    game.player.heal(isBossCheckpoint ? Math.max(baselineHeal, bossSafetyHeal) : baselineHeal);

    game.player.beginDrawIn?.();
    game.camera.snapTo(game.player);
    waves.startWave(clampedNext);
    game.reportedLayerErrors.clear();
    game.prepareWeaponPickup(clampedNext);
    game.captureStageCheckpoint();
    game.showMissionStrip(clampedNext);
    particles.addTextBanner(
      game.player.x,
      game.player.y - 70,
      `★ STAGE ${clampedNext}: ${stageManager.stageName} ★`,
      '#ffea00'
    );
    if (isBossCheckpoint) {
      particles.addDamageText(game.player.x, game.player.y - 120, 'BOSS CHECKPOINT: HP READY', false, '#34d399');
    }
    syncStageSelectors();
  };

  const origEnterTrophyRoom = game.enterTrophyRoom.bind(game);
  game.enterTrophyRoom = () => {
    clearCreativeBlocks();
    origEnterTrophyRoom();
    decoratePlayerInstance(game.player);
    game.showMissionStrip(30, 'EPILOGUE');
    syncStageSelectors();
  };

  const origGameOver = game.gameOver.bind(game);
  game.gameOver = () => {
    const deathReason = sandbox.lastDeathReason ||
      game.player?.lastDeathReason ||
      resolvePlayerDeathCause(game.player, sandbox.lastDamageCause);
    updateDeathBannerDOM(deathReason);
    origGameOver();
  };

  // Fix HUD boss label so dynamic squad / Creative-spawned bosses show their exact name
  const origSyncHUD = game.syncHUD.bind(game);
  game.syncHUD = () => {
    origSyncHUD();
    const bossLabel = game.getHudElement('boss-name-label');
    if (bossLabel && waves.bossZombie && !waves.bossZombie.isDead && waves.bossZombie.name) {
      bossLabel.innerText = waves.bossZombie.name;
    }
  };

  function wrapEnemyFor2D(z) {
    if (!z || z._wrapped2DEnemyHooks) return;
    z._wrapped2DEnemyHooks = true;

    if (typeof z.update === 'function') {
      const origZUpdate = z.update.bind(z);
      z.update = (zDt, zGroundY, ...rest) => {
        const p = game.player;
        const prevAttacker = p ? p._activeAttacker : null;
        if (p) p._activeAttacker = z;
        const prevZY = z.y;
        try {
          const isFlyingEnemy = Boolean(z.isFlying) || z.type === 'ender_dragon';
          const hole = !isFlyingEnemy && !z.standingPlatform && !stageManager.isTrophyRoom
            ? (findContainingGroundHole(z.x, 0, sandbox.groundHoles, 12, true) || (z.y > zGroundY + 18 ? z._fallingHole2D : null))
            : null;
          const offIsland = isOpenEdgeTheme(stageManager.theme) &&
            !isFlyingEnemy &&
            Math.abs(z.x) > ISLAND_FLOOR_BOUNDS.halfX;
          const offFloor = Boolean(offIsland || hole);
          if (hole) z._fallingHole2D = hole;
          else if (z.y <= zGroundY + 18) z._fallingHole2D = null;

          const res = origZUpdate(zDt, offFloor ? 99999 : zGroundY, ...rest);

          if (offFloor && z.y > prevZY + 120) {
            const safeDt = Math.max(0, Number(zDt) || 0.016);
            z.vy = (z.vy || 0) + 1200 * safeDt;
            z.y = prevZY + z.vy * safeDt;
            z.isGrounded = false;
          }
          if (z._fallingHole2D && z.y > zGroundY + 18) {
            z.x = clamp(z.x, z._fallingHole2D.minX + 14, z._fallingHole2D.maxX - 14);
          }
          return res;
        } finally {
          if (p) p._activeAttacker = prevAttacker;
        }
      };
    }

    if (typeof z.creeperBlast === 'function') {
      const origCreeperBlast = z.creeperBlast.bind(z);
      z.creeperBlast = (targets, cam, radius = 175) => {
        if (game.player) {
          game.player._pendingDamageCause = formatAttackerDeathMessage(z, 'charged explosion');
        }
        blastBlocksInRadius2D(z.x, z.y - 30, radius + 35);
        return origCreeperBlast(targets, cam, radius);
      };
    }

    if (typeof z.boomBurst === 'function') {
      const origBoomBurst = z.boomBurst.bind(z);
      z.boomBurst = (targets, cam) => {
        if (game.player) {
          game.player._pendingDamageCause = formatAttackerDeathMessage(z, 'self-destruct blast');
        }
        blastBlocksInRadius2D(z.x, z.y - 24, 165);
        return origBoomBurst(targets, cam);
      };
    }
  }

  // --------------------------------------------------------------------------
  // Enhanced 2D Update Loop (Creative, Swept CCD, Void Plunge, Lava, Speech3D)
  // --------------------------------------------------------------------------
  game.update = (dt) => {
    game.camera.update(dt, game.player, waves.zombies.length);
    const simDt = game.camera.isHitstopped() ? dt * 0.5 : dt;
    game.hudSyncTimer += simDt;
    game.updateMissionStrip(simDt);

    const player = decoratePlayerInstance(game.player);
    const theme = stageManager.theme;
    const openEdge = isOpenEdgeTheme(theme);
    const activeLavaHazards = stageManager.lavaHazards || [];

    // 1. Creative Sandbox Per-Frame Perks & Flight
    if (sandbox.enabled) {
      player.isGodMode = sandbox.godMode;
      player.isCreativeFlight = sandbox.flight;
      if (sandbox.godMode) {
        player.hp = player.maxHp;
        player.superMeter = player.maxSuper;
        combat.ink = Math.max(combat.ink, 9999);
        player.rollCooldown = 0;
        player.grabCooldown = 0;
        player.hookCooldown = 0;
        player.blockCooldown = 0;
        for (const k of Object.keys(allies.cooldowns)) {
          allies.cooldowns[k] = 0;
          allies.recoveryStates[k] = false;
        }
      }
    }

    // 2. TNT Fuse Countdown (+ Lava Auto-Ignition & Heavy-Attack Ignition)
    for (let i = sandbox.blocks.length - 1; i >= 0; i--) {
      const b = sandbox.blocks[i];
      if (!b || b.broken) {
        sandbox.blocks.splice(i, 1);
        continue;
      }
      if (b.texKey === 'tnt_block' && b.fuseTimer === undefined) {
        const bCenterY = b.y - b.height * 0.5;
        let nearHeat = false;
        for (let h = 0; h < activeLavaHazards.length; h++) {
          const lh = activeLavaHazards[h];
          if (Math.abs(b.x - lh.x) <= (lh.width || 110) * 0.5 + 48 && Math.abs(b.y - lh.y) <= 78) {
            nearHeat = true;
            break;
          }
        }
        if (!nearHeat) {
          for (let j = 0; j < sandbox.blocks.length; j++) {
            const other = sandbox.blocks[j];
            if (other && !other.broken && other.texKey === 'lava' && Math.hypot(other.x - b.x, other.y - b.y) <= 105) {
              nearHeat = true;
              break;
            }
          }
        }
        if (nearHeat) {
          b.fuseTimer = 0.55;
          particles.addDamageText(b.x, b.y - b.height - 12, '🔥 LAVA LIT TNT!', false, '#fb923c');
        } else if (player && !player.isDead && player.attackTimer > 0) {
          const hitX = player.x + (player.facing || 1) * 58;
          const hitY = player.y - 30;
          if (Math.hypot(b.x - hitX, bCenterY - hitY) <= 92) {
            b.fuseTimer = 0.65;
            particles.addDamageText(b.x, b.y - b.height - 12, '🧨 FUSE LIT!', false, '#f87171');
          }
        }
      }
      if (b.fuseTimer !== undefined) {
        b.fuseTimer -= simDt;
        if (b.fuseTimer <= 0) {
          detonateTNTBlock(b);
          const idx = sandbox.blocks.indexOf(b);
          if (idx >= 0) sandbox.blocks.splice(idx, 1);
        }
      }
    }

    const currentPlatforms = stageManager.getAllSolidPlatforms();
    const hostileTargets = game.collectHostileTargets();

    // 3. Player Step-Off, Open-Edge + TNT Ground-Crater Void Grounding & Swept Vertical CCD
    const prevPlayerY = player.y;
    checkPlatformStepOff(player);

    const playerOffIsland = openEdge && Math.abs(player.x) > ISLAND_FLOOR_BOUNDS.halfX;
    const activePlayerHole = !stageManager.isTrophyRoom && !player.standingPlatform
      ? (findContainingGroundHole(player.x, 0, sandbox.groundHoles, 12, true) || (player.y > game.groundY + 18 ? player._fallingHole2D : null))
      : null;
    if (activePlayerHole) player._fallingHole2D = activePlayerHole;
    else if (player.y <= game.groundY + 18) player._fallingHole2D = null;

    const playerOffFloor = playerOffIsland || Boolean(activePlayerHole);
    const effectivePlayerGroundY = playerOffFloor ? 99999 : game.groundY;

    // Suppress KeyV -> SketchBlock double-spawn when Creative Mode is active ([V] places Creative voxel blocks)
    if (sandbox.enabled && (input.keys?.['KeyV'] || input.keysPressed?.['KeyV'])) {
      input.keys['KeyV'] = false;
      input.keysPressed['KeyV'] = false;
      if (!input.keys?.['KeyE'] && !input.keysPressed?.['KeyE'] && !input.touch?.block && !input.touch?.blockPressed) {
        input.actions.block = false;
        input.actions.blockPressed = false;
      }
    }

    try {
      player.update(
        simDt,
        input,
        effectivePlayerGroundY,
        projectiles.sketchBlocks,
        hostileTargets,
        game.camera,
        currentPlatforms
      );
    } catch (e) {
      console.error('Player update error:', e);
    }

    // 2D Creative Flight Override
    if (sandbox.enabled && sandbox.flight && !player.isDead) {
      let flyY = 0;
      if (input.actions.up || input.actions.jump) flyY -= 1;
      if (input.actions.down) flyY += 1;
      if (flyY !== 0) {
        player.vy = flyY * 390;
        player.y = prevPlayerY + player.vy * simDt;
      } else {
        player.vy *= 0.82;
        player.y = prevPlayerY + player.vy * simDt;
      }
      player.y = clamp(player.y, stageManager.bounds.minY + 70, playerOffFloor ? 140 : game.groundY);
      player.isGrounded = !playerOffFloor && player.y >= game.groundY - 1;
      player.canDoubleJump = true;
      player._fallingHole2D = null;
      if (Math.random() < 0.35) {
        particles.createHitSparks(player.x, player.y - 4, 1, '#38bdf8');
      }
    } else {
      if (player._fallingHole2D && player.y > game.groundY + 18) {
        player.x = clamp(player.x, player._fallingHole2D.minX + 14, player._fallingHole2D.maxX - 14);
        player.isWallSliding = false;
      }
      if (prevPlayerY <= game.groundY + 18) {
        // Swept Vertical Collision against all platforms + Creative blocks + Sketch blocks
        const allPlayerSurfaces = projectiles.sketchBlocks?.length
          ? currentPlatforms.concat(projectiles.sketchBlocks)
          : currentPlatforms;
        resolveSweptVerticalCollision(player, allPlayerSurfaces, prevPlayerY, simDt);
      }
    }

    // Prevent fake desktop wall-sliding out in empty air on open-edge islands
    if (openEdge && Math.abs(player.x) > ISLAND_FLOOR_BOUNDS.halfX) {
      player.isWallSliding = false;
    }

    // Record safe respawn spot whenever Orange is safely grounded on solid intact floor
    if (!playerOffFloor && player.isGrounded && !player.standingPlatform && Math.abs(player.x) <= ISLAND_FLOOR_BOUNDS.halfX - 40) {
      sandbox.lastSafeIslandX = clamp(player.x, -860, 860);
    }

    // Resolve Player Void / Lava Sea / TNT Crater Plunge
    if ((playerOffFloor || player.y > game.groundY + 40) && player.y >= VOID_FALL_THRESHOLD && !(sandbox.enabled && sandbox.flight)) {
      const inLavaSea = isLavaSeaTheme(theme);
      const plungeCause = inLavaSea
        ? 'The Second Coming tried to swim in lava'
        : 'The Second Coming fell out of the world';
      particles.addShockwave(player.x, game.groundY + 40, 120, inLavaSea ? '#f97316' : '#a855f7', 9);
      particles.addComicPopup(
        clamp(player.x, -920, 920),
        game.groundY - 50,
        inLavaSea ? 'LAVA PLUNGE!' : 'VOID FALL!',
        inLavaSea ? '#ea580c' : '#9333ea',
        '#ffffff'
      );

      if (!player.isGodMode) {
        player._pendingDamageCause = plungeCause;
        player.lastDamageCause = plungeCause;
        sandbox.lastDamageCause = plungeCause;
        player.hp = Math.max(0, player.hp - 40);
        player.stageDamageTaken += 40;
        audio.playPlayerHurt?.();
      }

      if (player.hp <= 0 && !player.isGodMode) {
        player.die();
      } else {
        const safePt = findSafeGroundPoint(sandbox.lastSafeIslandX, 0, sandbox.groundHoles, {
          ignoreZ: true,
          entranceX: stageManager.entranceDoor?.x ?? -900,
          exitX: stageManager.exitDoor?.x ?? 900
        });
        player._pendingDamageCause = null;
        player._fallingHole2D = null;
        player.x = safePt.x;
        player.y = game.groundY;
        player.vx = 0;
        player.vy = 0;
        player.isGrounded = true;
        player.canDoubleJump = true;
        player.standingPlatform = null;
        player.iFrames = 1.1;
        particles.createDust(player.x, player.y, 10);
      }
    }

    // 4. Stage 7 Floor Lava Hazard Pools & Creative Lava Blocks vs Player
    for (let i = 0; i < activeLavaHazards.length; i++) {
      if (checkLavaHazard(player, activeLavaHazards[i], simDt)) {
        const lavaCause = 'The Second Coming tried to swim in lava';
        player._pendingDamageCause = lavaCause;
        player.lastDamageCause = lavaCause;
        sandbox.lastDamageCause = lavaCause;
        player.iFrames = 0.75; // Normalize 2D iFrames in seconds!
        player.isHurt = true;
        player.hurtTimer = 0.22;
        audio.playPlayerHurt?.();
        particles.createHitSparks(player.x, player.y - 16, 12, '#f97316');
        particles.addComicPopup(player.x, player.y - 54, 'HOT! -20', '#ea580c', '#fde047');
        if (player.hp <= 0) player.die();
        else player._pendingDamageCause = null;
      }
    }
    for (let i = 0; i < sandbox.blocks.length; i++) {
      const b = sandbox.blocks[i];
      if (b && !b.broken && b.texKey === 'lava') {
        if (checkLavaHazard(player, b, simDt)) {
          const lavaBlockCause = 'The Second Coming stepped onto a molten Lava Block';
          player._pendingDamageCause = lavaBlockCause;
          player.lastDamageCause = lavaBlockCause;
          sandbox.lastDamageCause = lavaBlockCause;
          player.iFrames = 0.75;
          player.isHurt = true;
          player.hurtTimer = 0.22;
          audio.playPlayerHurt?.();
          particles.createHitSparks(player.x, player.y - 16, 12, '#f97316');
          particles.addComicPopup(player.x, player.y - 54, 'LAVA! -20', '#ea580c', '#fde047');
          if (player.hp <= 0) player.die();
          else player._pendingDamageCause = null;
        }
      }
    }

    if (player.isDead && player.deathTimer <= 0) {
      game.gameOver();
      return;
    }

    // 5. Enemy Waves Update (with Freeze AI, Attacker Death Tracking, Void Fall & Lava Burn)
    try {
      if (!sandbox.freezeAI) {
        for (const z of waves.zombies) {
          if (z && !z.isDead) {
            sandbox.prevEnemyYs.set(z, z.y);
            wrapEnemyFor2D(z);
          }
        }

        sandbox.activeDamagePhase = 'enemies';
        try {
          waves.update(
            simDt,
            player,
            game.groundY,
            projectiles.sketchBlocks,
            game.camera,
            () => {},
            currentPlatforms,
            allies.getCombatTargets?.() || []
          );
        } finally {
          sandbox.activeDamagePhase = null;
        }

        // Post-step Enemy Swept Platform Contact, Void/Crater Elimination & Lava Burn
        for (let i = waves.zombies.length - 1; i >= 0; i--) {
          const z = waves.zombies[i];
          if (!z || z.isDead) continue;

          const prevZY = sandbox.prevEnemyYs.get(z);
          const zOffIsland = openEdge && Math.abs(z.x) > ISLAND_FLOOR_BOUNDS.halfX;
          const zInHole = Boolean(z._fallingHole2D) || isOverGroundHole2D(z.x);
          if (!zOffIsland && !zInHole && z.y <= game.groundY + 18) {
            resolveSweptVerticalCollision(z, currentPlatforms, prevZY, simDt);
          } else if (z.y >= VOID_FALL_THRESHOLD && z.type !== 'ender_dragon' && !z.isFlying) {
            particles.addShockwave(clamp(z.x, -990, 990), game.groundY + 35, 85, '#38bdf8', 6);
            particles.addComicPopup(clamp(z.x, -960, 960), game.groundY - 35, 'VOID KO!', '#38bdf8', '#ffffff');
            if (typeof z.die === 'function') z.die(true);
            else {
              z.isDead = true;
              combat.registerKill(z);
            }
            waves.zombies.splice(i, 1);
            continue;
          }

          // Enemy Lava Burn
          for (let h = 0; h < activeLavaHazards.length; h++) {
            if (checkLavaHazard(z, activeLavaHazards[h], simDt)) {
              particles.createHitSparks(z.x, z.y - 20, 8, '#f97316');
              particles.addDamageText(z.x, z.y - 50, 20, false, '#fb923c');
              if (z.hp <= 0) {
                if (typeof z.die === 'function') z.die(true);
                else z.isDead = true;
                if (z.isDead) waves.zombies.splice(i, 1);
                break;
              }
            }
          }
          if (z.isDead) continue;
          for (let bIdx = 0; bIdx < sandbox.blocks.length; bIdx++) {
            const b = sandbox.blocks[bIdx];
            if (b && !b.broken && b.texKey === 'lava' && checkLavaHazard(z, b, simDt)) {
              particles.createHitSparks(z.x, z.y - 20, 8, '#f97316');
              particles.addDamageText(z.x, z.y - 50, 20, false, '#fb923c');
              if (z.hp <= 0) {
                if (typeof z.die === 'function') z.die(true);
                else z.isDead = true;
                if (z.isDead) waves.zombies.splice(i, 1);
                break;
              }
            }
          }
        }
      } else {
        // When AI is frozen, still prune enemies killed by the player
        for (let i = waves.zombies.length - 1; i >= 0; i--) {
          if (waves.zombies[i]?.isDead) waves.zombies.splice(i, 1);
        }
      }
    } catch (e) {
      console.error('Waves update error:', e);
    }

    sandbox.activeDamagePhase = 'stage_hazards';
    try {
      stageManager.update(simDt, player, waves, (nextStage) => {
        stageManager.resolveStageExit(
          nextStage,
          () => (stageManager.isTrophyRoom ? game.completeGame() : game.enterTrophyRoom()),
          (st) => game.advanceStage(st)
        );
      }, game.camera);
    } catch (e) {
      console.error('Stage update error:', e);
    } finally {
      sandbox.activeDamagePhase = null;
    }

    sandbox.activeDamagePhase = 'projectiles';
    try {
      const pList = projectiles.projectiles || [];
      for (let i = 0; i < pList.length; i++) {
        const p = pList[i];
        if (p && !p.isHostile && !p.pendingRemoval) {
          triggerCreativeBlockStrike(p.x, p.y, (p.radius || 14) + 38);
        }
      }
      projectiles.update(
        simDt,
        game.groundY,
        hostileTargets,
        player,
        game.camera,
        allies.getCombatTargets?.() || []
      );
    } catch (e) {
      console.error('Projectiles update error:', e);
    } finally {
      sandbox.activeDamagePhase = null;
    }

    try {
      allies.update(simDt, game.groundY, hostileTargets, player, game.camera);
    } catch (e) {
      console.error('Allies update error:', e);
    }

    try {
      combat.update(simDt, player);
    } catch (e) {
      console.error('Combat update error:', e);
    }

    // 6. Combo Milestone & Low-HP Clutch Speech Banter
    if (combat.combo >= 10) {
      const tier = combat.combo >= 30 ? 30 : (combat.combo >= 20 ? 20 : 10);
      if (tier > sandbox.lastComboMilestone) {
        sandbox.lastComboMilestone = tier;
        const line = tier === 30
          ? '30 HIT COMBO! UNSTOPPABLE!'
          : (tier === 20 ? '20 HITS! STICK-TACULAR!' : '10 HIT STREAK! KEEP DRAWING!');
        speech3d.spawnSpeechBubble('orange', line, {
          style: tier >= 20 ? 'shout' : 'comic',
          priority: 4,
          mood: '⚡',
          anchor: player,
          bypassCooldown: true
        });
      }
    } else if (combat.combo < 3) {
      sandbox.lastComboMilestone = 0;
    }

    if (sandbox.lowHpCalloutCooldown > 0) sandbox.lowHpCalloutCooldown -= simDt;
    if (!player.isDead && !player.isGodMode && player.hp > 0 && player.hp <= 28 && sandbox.lowHpCalloutCooldown <= 0) {
      sandbox.lowHpCalloutCooldown = 14;
      speech3d.spawnSpeechBubble('orange', 'LOW HP! NEED BLUE POTION!', {
        style: 'shout',
        priority: 4,
        mood: '💧',
        anchor: player,
        bypassCooldown: true
      });
    }

    try {
      particles.update(simDt);
    } catch (e) {
      console.error('Particles update error:', e);
    }

    try {
      speech2d.update(simDt);
      speech3d.playerRef = player;
      speech3d.update(simDt);
    } catch (e) {
      console.error('Speech update error:', e);
    }

    game.updateWeaponPickup();
  };

  // --------------------------------------------------------------------------
  // Enhanced 2D Render Loop (Creative Blocks, Boss Telegraphs & Comic Speech)
  // --------------------------------------------------------------------------
  game.render = () => {
    try {
      if (game.hudSyncTimer >= 0.05 || game.lastStaticRender === 0 || game.state !== 'PLAYING') {
        game.syncHUD();
        game.hudSyncTimer %= 0.05;
      }
    } catch (error) {
      const signature = `HUD sync:${error?.message || String(error)}`;
      if (!game.reportedErrors.has(signature)) {
        game.reportedErrors.add(signature);
        console.error('HUD sync error:', error);
      }
    }

    const ctx = game.ctx;
    const width = game.canvas.clientWidth || globalThis.window?.innerWidth || 1280;
    const height = game.canvas.clientHeight || globalThis.window?.innerHeight || 720;
    const voidBlend = stageManager.whiteVoidProgress || 0;
    if (voidBlend > 0) {
      const mix = (a, b) => Math.round(a + (b - a) * voidBlend);
      ctx.fillStyle = `rgb(${mix(30, 242)}, ${mix(33, 239)}, ${mix(45, 232)})`;
    } else {
      ctx.fillStyle = '#1e212d';
    }
    ctx.fillRect(0, 0, width, height);

    game.camera.apply(ctx);
    try {
      const crowded = waves.zombies.length >= 8;
      game.renderLayer('background', (layerCtx) => stageManager.draw(layerCtx, game.groundY, crowded));
      if (sandbox.groundHoles.length > 0 && !stageManager.isTrophyRoom) {
        game.renderLayer('ground-craters', (layerCtx) => drawGroundCraters2D(
          layerCtx,
          sandbox.groundHoles,
          game.groundY,
          stageManager.theme,
          stageManager.stageTime
        ));
      }
      game.renderLayer('creative-blocks', (layerCtx) => {
        depth2d.drawPlatformDepthShadows(layerCtx, sandbox.blocks);
        drawCreativeBlocks2D(layerCtx, sandbox.blocks, stageManager.stageTime);
      });
      game.renderLayer('boss-telegraphs', (layerCtx) => drawBossFloorTelegraphs2D(layerCtx, waves.zombies, game.groundY, stageManager.stageTime));
      game.renderLayer('projectiles', (layerCtx) => {
        const savedSketchBlocks = projectiles.sketchBlocks;
        if (savedSketchBlocks?.length) {
          depth2d.drawPlatformDepthShadows(layerCtx, savedSketchBlocks);
          drawSketchBlocksVoxel2D(layerCtx, savedSketchBlocks, stageManager.stageTime);
          projectiles.sketchBlocks = [];
          try {
            projectiles.draw(layerCtx, crowded);
          } finally {
            projectiles.sketchBlocks = savedSketchBlocks;
          }
        } else {
          projectiles.draw(layerCtx, crowded);
        }
      });
      game.renderLayer('ink', (layerCtx) => combat.draw(layerCtx));
      game.renderLayer('depth-shadows', (layerCtx) => depth2d.drawEntityContactShadows(
        layerCtx,
        game.player,
        allies.activeAllies,
        waves.zombies,
        stageManager.getAllSolidPlatforms(),
        game.groundY,
        isOpenEdgeTheme(stageManager.theme)
      ));
      game.renderLayer('enemies', (layerCtx) => waves.draw(layerCtx));
      game.renderLayer('weapon-pickup', (layerCtx) => game.drawWeaponPickup(layerCtx));
      game.renderLayer('allies', (layerCtx) => allies.draw(layerCtx, crowded));
      const playerDrawn = game.renderLayer('player', (layerCtx) => game.player.draw(layerCtx));
      if (!playerDrawn) game.renderLayer('player-fallback', (layerCtx) => game.drawFallbackPlayer(layerCtx));
      game.renderLayer('effects', (layerCtx) => particles.draw(layerCtx));
      game.renderLayer('foreground-depth', (layerCtx) => depth2d.drawForegroundBokeh(
        layerCtx,
        stageManager,
        game.camera,
        game.groundY,
        particles.reducedEffects === true
      ));
    } finally {
      game.camera.restore(ctx);
    }

    game.renderLayer('enemy-guides', (layerCtx) => waves.drawScreenIndicators?.(layerCtx, game.camera, width, height));
    game.renderLayer('stage-guide', (layerCtx) => stageManager.drawScreenGuide?.(layerCtx, game.camera, width, height));
    game.renderLayer('speech', (layerCtx) => speech3d.draw(layerCtx, cameraAdapter2D, width, height));
  };

  // --------------------------------------------------------------------------
  // Bind DOM Controls & Keyboard Shortcuts (C, V, N, Double-Tap Space)
  // --------------------------------------------------------------------------
  if (typeof document !== 'undefined') {
    syncStageSelectors();
    syncCreativeUI();

    const titleSelect = document.getElementById('title-stage-select');
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart && titleSelect) {
      // Capture click on Play Now so if the user chose a stage in the Title Selector, it launches that stage!
      btnStart.addEventListener('click', (ev) => {
        const chosen = Number(titleSelect.value) || 1;
        if (chosen > 1) {
          ev.stopImmediatePropagation();
          audio.init?.();
          jumpToStage(chosen, { freshStart: true, creative: false });
        }
      }, true);
    }

    const btnStartCreative = document.getElementById('btn-start-creative');
    if (btnStartCreative) {
      btnStartCreative.addEventListener('click', () => {
        audio.init?.();
        const chosen = Number(document.getElementById('title-stage-select')?.value) || 1;
        jumpToStage(chosen, { freshStart: true, creative: true });
      });
    }

    for (const id of ['title-stage-select', 'hud-stage-select', 'pause-stage-select']) {
      const sel = document.getElementById(id);
      if (sel) {
        sel.addEventListener('change', () => {
          const val = Number(sel.value);
          sel.blur?.();
          if (!Number.isFinite(val)) return;
          if (id === 'title-stage-select' && game.state === 'TITLE') {
            jumpToStage(val, { freshStart: true });
          } else {
            jumpToStage(val);
          }
        });
      }
    }

    document.querySelectorAll('.quick-stage-btn[data-jump-stage]').forEach((pill) => {
      pill.addEventListener('click', () => {
        const val = Number(pill.getAttribute('data-jump-stage'));
        if (Number.isFinite(val)) jumpToStage(val, { freshStart: game.state === 'TITLE' });
      });
    });

    const hudCreativeBtn = document.getElementById('btn-creative-toggle');
    if (hudCreativeBtn) {
      hudCreativeBtn.addEventListener('click', () => {
        setCreativeMode(!sandbox.enabled);
      });
    }

    const collapseBtn = document.getElementById('btn-creative-collapse');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        const dock = document.getElementById('creative-dock');
        if (!dock) return;
        const collapsed = dock.classList.toggle('collapsed');
        collapseBtn.textContent = collapsed ? '▸' : '▾';
      });
    }

    document.getElementById('creative-god-btn')?.addEventListener('click', () => {
      sandbox.godMode = !sandbox.godMode;
      if (game.player) game.player.isGodMode = sandbox.godMode;
      syncCreativeUI();
    });

    document.getElementById('creative-fly-btn')?.addEventListener('click', () => {
      sandbox.flight = !sandbox.flight;
      if (game.player) game.player.isCreativeFlight = sandbox.flight;
      syncCreativeUI();
    });

    document.getElementById('creative-freeze-ai-btn')?.addEventListener('click', () => {
      sandbox.freezeAI = !sandbox.freezeAI;
      syncCreativeUI();
    });

    document.getElementById('creative-weapon-select')?.addEventListener('change', (e) => {
      equipCreativeWeapon(e.target.value);
      e.target?.blur?.();
    });

    const blockSelectEl = document.getElementById('creative-block-select');
    blockSelectEl?.addEventListener('change', (e) => {
      sandbox.selectedBlock = e.target.value;
      e.target?.blur?.();
    });
    blockSelectEl?.addEventListener('input', (e) => {
      sandbox.selectedBlock = e.target.value;
    });

    document.getElementById('creative-place-block-btn')?.addEventListener('click', (e) => {
      e.currentTarget?.blur?.();
      const sel = document.getElementById('creative-block-select');
      if (sel?.value) sandbox.selectedBlock = sel.value;
      placeCreativeBlock(sandbox.selectedBlock);
    });

    document.getElementById('creative-clear-blocks-btn')?.addEventListener('click', (e) => {
      e.currentTarget?.blur?.();
      clearCreativeBlocks();
    });

    document.getElementById('creative-spawn-select')?.addEventListener('change', (e) => {
      sandbox.selectedSpawn = e.target.value;
      e.target?.blur?.();
    });

    document.getElementById('creative-spawn-btn')?.addEventListener('click', (e) => {
      e.currentTarget?.blur?.();
      const sel = document.getElementById('creative-spawn-select');
      if (sel?.value) sandbox.selectedSpawn = sel.value;
      spawnCreativeEntity(sandbox.selectedSpawn);
    });

    document.getElementById('creative-allies-btn')?.addEventListener('click', () => summonAllAllies());
    document.getElementById('creative-nuke-btn')?.addEventListener('click', () => nukeAllEnemies());
    document.getElementById('creative-max-shop-btn')?.addEventListener('click', () => maxAllStats());
    document.getElementById('creative-portal-btn')?.addEventListener('click', () => unlockStageExit());

    game.canvas?.addEventListener?.('mousedown', () => {
      if (document.activeElement?.tagName === 'SELECT') {
        document.activeElement.blur?.();
      }
    });
  }

  function handleCreativeKeyDown(e) {
    if (!e || e.repeat) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (game.state !== 'PLAYING') return;

    if (e.code === 'KeyC') {
      if (tag === 'SELECT') {
        e.preventDefault?.();
        e.target?.blur?.();
      }
      if (input.keys) input.keys['KeyC'] = false;
      if (input.keysPressed) input.keysPressed['KeyC'] = false;
      if (!input.keys?.['ShiftLeft'] && !input.keys?.['ShiftRight'] && !input.keys?.['KeyL'] && !input.touch?.roll) {
        input.actions.roll = false;
        input.actions.rollPressed = false;
      }
      setCreativeMode(!sandbox.enabled);
    } else if (sandbox.enabled && e.code === 'KeyV') {
      if (tag === 'SELECT') {
        e.preventDefault?.();
        e.target?.blur?.();
      }
      if (input.keys) input.keys['KeyV'] = false;
      if (input.keysPressed) input.keysPressed['KeyV'] = false;
      if (!input.keys?.['KeyE'] && !input.keysPressed?.['KeyE'] && !input.touch?.block && !input.touch?.blockPressed) {
        input.actions.block = false;
        input.actions.blockPressed = false;
      }
      const sel = typeof document !== 'undefined' ? document.getElementById('creative-block-select') : null;
      if (sel?.value) sandbox.selectedBlock = sel.value;
      placeCreativeBlock(sandbox.selectedBlock);
    } else if (sandbox.enabled && e.code === 'KeyN') {
      if (tag === 'SELECT') {
        e.preventDefault?.();
        e.target?.blur?.();
      }
      const sel = typeof document !== 'undefined' ? document.getElementById('creative-spawn-select') : null;
      if (sel?.value) sandbox.selectedSpawn = sel.value;
      spawnCreativeEntity(sandbox.selectedSpawn);
    } else if (sandbox.enabled && e.code === 'Space') {
      if (tag === 'SELECT') {
        e.preventDefault?.();
        e.target?.blur?.();
      }
      const now = performance.now();
      if (now - sandbox.lastSpaceTapTime < 280) {
        sandbox.flight = !sandbox.flight;
        if (game.player) game.player.isCreativeFlight = sandbox.flight;
        syncCreativeUI();
        sandbox.lastSpaceTapTime = 0;
      } else {
        sandbox.lastSpaceTapTime = now;
      }
    }
  }

  if (typeof window !== 'undefined') {
    window._2dCreativeKeyHandler = handleCreativeKeyDown;
    if (!window._bound2DCreativeKeys) {
      window._bound2DCreativeKeys = true;
      window.addEventListener('keydown', (e) => window._2dCreativeKeyHandler?.(e));
    }
  }

  const controller = {
    sandbox,
    speech3d,
    depth2d,
    cameraAdapter2D,
    setCreativeMode,
    equipCreativeWeapon,
    placeCreativeBlock,
    clearCreativeBlocks,
    detonateTNTBlock,
    blastBlocksInRadius2D,
    carveGroundCrater2D,
    isOverGroundHole2D,
    spawnStageVoxelProps,
    crackLuckyBlock,
    spawnCreativeEntity,
    summonAllAllies,
    nukeAllEnemies,
    maxAllStats,
    unlockStageExit,
    jumpToStage,
    syncStageSelectors,
    updateDeathBannerDOM,
    getLastDeathReason: () => sandbox.lastDeathReason || game.player?.lastDeathReason || '',
    handleCreativeKeyDown
  };

  game._expansion2D = controller;
  return controller;
}

if (typeof window !== 'undefined') {
  if (window.__stickGame) {
    install2DExpansion(window.__stickGame);
  } else if (typeof document !== 'undefined' && document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      if (window.__stickGame) install2DExpansion(window.__stickGame);
    });
  }
}
