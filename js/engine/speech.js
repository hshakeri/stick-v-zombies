import { audio } from './audio.js?v=8.8';
export const MAX_SPEECH_CHARS = 24;
export const MAX_SPEECH_LINES = 2;
export const MAX_SPEECH_BUBBLES = 3;
export const BOSS_SPEECH_EVENTS = Object.freeze({
  titan: Object.freeze(['default', 'intro', 'phase', 'defeat']),
  darkLord: Object.freeze(['default', 'intro', 'summon', 'phase', 'hurt', 'defeat']),
  kingOrange: Object.freeze(['default', 'intro', 'command', 'phase', 'defeat']),
  luckyOrb: Object.freeze(['default', 'intro', 'roll', 'drop', 'phase', 'defeat']),
  h4c3r: Object.freeze(['default', 'intro', 'select', 'phase', 'root', 'defeat'])
});
export const SPEECH_CORPUS = {
  playerAttack: [
    'PENCIL TIME!',
    'UNDO THIS!',
    'FRAME PERFECT!',
    'BONK.EXE!',
    'NOT TODAY, BUG!',
    'SAVE THIS!'
  ],
  playerAwakened: [
    'FULL POWER!',
    'LIGHTS ON!',
    'LIMITS: OFF!',
    'BRIGHT IDEA!'
  ],
  playerHurt: [
    'OW. BAD FRAME!',
    'WHO MOVED THAT?',
    'INPUT LAG!',
    'STILL STANDING!'
  ],
  zombieGroan: [
    'BRAINS.PNG...',
    'NEED RAM...',
    'UNDELETE ME?',
    'BAD UPDATE!',
    'CACHE MISS...',
    'WRONG FOLDER!'
  ],
  allies: {
    red: [
      'DIBS!',
      'I BROUGHT FISTS!',
      'CATCH ME!',
      'BONK FIRST!'
    ],
    blue: [
      "POTION O'CLOCK!",
      'DRINK THIS. MAYBE.',
      'SIDE EFFECT: WINNING.',
      'I BREWED THAT.'
    ],
    yellow: [
      'I MADE A BUTTON.',
      'REDSTONE SAYS HI.',
      'LOGIC BOMB!',
      'ONE MORE REPEATER.'
    ],
    green: [
      'DROP THE BLOCK BEAT!',
      'ZOMBIES: OFF-BEAT.',
      'ENCORE? NOPE.',
      'BASS, MEET BRAINS.'
    ],
    cursor: [
      'CLICK. DRAG. YEET.',
      "YOU'RE SELECTED.",
      'MOVE TO TRASH.',
      'RIGHT-CLICK REGRET.'
    ]
  },
  allyHurt: {
    red: ['TACTICAL NAP!', 'RED NEEDS A REBOOT!'],
    blue: ['POTION DOWN!', 'BREW BREAK!'],
    yellow: ['REBOOTING LOGIC!', 'CIRCUIT BREAK!'],
    green: ['ENCORE LATER!', 'BASS BREAK!']
  },
  titan: {
    default: ['BIG PROCESS. NO EXIT.', 'CRASH. EVERYTHING.'],
    intro: ['TITAN.EXE AWAKE.', 'SYSTEM SMASH TIME.'],
    phase: ['RAGE: OVERCLOCKED.', 'ERROR: NO MERCY.'],
    defeat: ['TITAN... SLEEPS.', 'PROCESS KILLED.']
  },
  darkLord: {
    default: ['RUN, LITTLE FILE.', 'VIRABOTS, FETCH!', 'NO ESCAPE KEY.'],
    intro: ['BACKUP ONLINE.', 'OLD FIGHT. NEW DOOM.'],
    summon: ['SWARM, GO!', 'VIRABOTS, FETCH!'],
    phase: ['POWER: MAX.', 'BACKUP OVERCLOCKED.'],
    hurt: ['CORRUPTED, NOT WEAK.', 'THAT FRAME WAS MINE.'],
    defeat: ['BACKUP DELETED.', 'NOT... AGAIN.']
  },
  kingOrange: {
    default: ['LOOP COMMAND: FIGHT.', 'REPLAYING ATTACK.', 'THE LOOP COMMANDS ME.'],
    intro: ['REPLAY LOADED.', 'THIS IS ONLY A COPY.'],
    command: ['BLOCKS: EXECUTE!', 'COMMAND STACK: GO!'],
    phase: ['LOOP SPEED: DOUBLE.', 'REWIND. TRY AGAIN.'],
    defeat: ['REPLAY RELEASED.', 'BREAK... THE LOOP.']
  },
  luckyOrb: {
    default: ['ROLL AGAIN?', 'LUCK: LOADED.'],
    intro: ['CHANCE ENGINE: ON.', 'FEELING LUCKY?'],
    roll: ['BAD ROLL!', 'BOUNCE THIS!'],
    drop: ['PICK A SAFE SPOT.', 'JACKPOT INCOMING!'],
    phase: ['ODDS: DOUBLED.', 'REROLLING!'],
    defeat: ['ORB SENT HOME.', 'LUCK RAN OUT!']
  },
  h4c3r: {
    default: ['ACCESS GRANTED.', 'PATCH THIS.', 'I AM ROOT.'],
    intro: ['WELCOME TO MY SCREEN.', 'RESTORE KEY DETECTED.'],
    select: ['CLICK. DRAG. DELETE.', 'YOU ARE SELECTED.'],
    phase: ['NEW PHASE DEPLOYED.', 'PATCH REJECTED.'],
    root: ['ROOT OWNS THIS CANVAS.', 'PERMISSION: DENIED.'],
    defeat: ['SESSION TERMINATED.', 'LOGGING... OUT?']
  }
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function bubblePriority(speakerType) {
  if (speakerType === 'campaign') return 5;
  if (speakerType === 'h4c3r' || speakerType === 'luckyOrb' || speakerType === 'kingOrange' || speakerType === 'darkLord' || speakerType === 'titan') return 4;
  if (speakerType === 'playerAwakened') return 3;
  if (speakerType.startsWith('ally-')) return 2;
  if (speakerType === 'playerAttack' || speakerType === 'playerHurt') return 1;
  return 0;
}
function bubblePalette(speakerType) {
  const palettes = {
    playerAwakened: ['#fff8cf', '#ff8a00', '#7a3100', '#ffe100'],
    zombieGroan: ['#162719', '#76ff03', '#d7ffb4', '#00e676'],
    darkLord: ['#190008', '#ff294d', '#ff8ba0', '#ff1744'],
    kingOrange: ['#2b1600', '#ff9800', '#ffe0a3', '#ffd54f'],
    luckyOrb: ['#2b1900', '#ffd43b', '#fff6bd', '#ef5cff'],
    h4c3r: ['#001b20', '#00f5ff', '#c5fcff', '#8cff00'],
    titan: ['#120a02', '#ff5252', '#ffd0d0', '#ff1744'],
    campaign: ['#081c24', '#67e8f9', '#e6fdff', '#ffe100'],
    'ally-red': ['#fff4f4', '#ff3344', '#66101a', '#ff3344'],
    'ally-blue': ['#f2f8ff', '#2299ff', '#073b68', '#2299ff'],
    'ally-yellow': ['#fffbe5', '#e2ae00', '#503d00', '#ffcc00'],
    'ally-green': ['#effff3', '#23b84c', '#074a1b', '#33dd66'],
    'ally-cursor': ['#edfaff', '#00bde8', '#003d4b', '#00d2ff']
  };
  return palettes[speakerType] || ['#ffffff', '#111111', '#111111', '#ffea00'];
}
function addRoundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, radius);
  else ctx.rect(x, y, width, height);
}
// Deterministic wobble for hand-inked bubble outlines (same idea as the
// stick-figure line boil: re-seeded on a slow clock, never per frame).
function wobbleHash(seed) {
  let h = Math.imul(seed | 0, 0x9E3779B1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85EBCA6B);
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
function addWobblyBubblePath(ctx, x, y, width, height, seed) {
  const per = 10; // sample points per edge pair
  const pts = [];
  for (let i = 0; i < per; i++) pts.push([x + (width * i) / per, y]);
  for (let i = 0; i < per / 2; i++) pts.push([x + width, y + (height * i) / (per / 2)]);
  for (let i = 0; i < per; i++) pts.push([x + width - (width * i) / per, y + height]);
  for (let i = 0; i < per / 2; i++) pts.push([x, y + height - (height * i) / (per / 2)]);
  for (let i = 0; i < pts.length; i++) {
    pts[i][0] += wobbleHash(seed + i * 97) * 1.6;
    pts[i][1] += wobbleHash(seed + i * 97 + 41) * 1.6;
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= pts.length; i++) {
    const current = pts[i % pts.length];
    const previous = pts[i - 1];
    ctx.quadraticCurveTo(previous[0], previous[1], (previous[0] + current[0]) / 2, (previous[1] + current[1]) / 2);
  }
  ctx.closePath();
}
function measureWidth(ctx, text) {
  const metrics = ctx.measureText?.(text);
  return Number.isFinite(metrics?.width) ? metrics.width : String(text).length * 8;
}
function normalizeSpeechText(text) {
  const compact = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!compact) return '…';
  if (compact.length <= MAX_SPEECH_CHARS) return compact;
  return `${compact.slice(0, MAX_SPEECH_CHARS - 1).trimEnd()}…`;
}
function resolveSpeechPool(category, eventName) {
  const categoryPool = SPEECH_CORPUS[category];
  if (Array.isArray(categoryPool)) return categoryPool;
  if (!categoryPool || typeof categoryPool !== 'object') return null;
  if (eventName && Array.isArray(categoryPool[eventName])) return categoryPool[eventName];
  return Array.isArray(categoryPool.default) ? categoryPool.default : null;
}
function compareLayoutPriority(a, b) {
  return (b.priority - a.priority) ||
    (Number(b.leader) - Number(a.leader)) ||
    (b.leaderTick - a.leaderTick);
}
function wrapText(ctx, text, maxWidth) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureWidth(ctx, candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length > MAX_SPEECH_LINES) {
    lines[1] = `${lines.slice(1).join(' ').slice(0, 20).trimEnd()}…`;
    lines.length = MAX_SPEECH_LINES;
  }
  return lines.length ? lines : ['…'];
}
export class SpeechBubbleManager {
  constructor(clock = () => globalThis.performance?.now?.() ?? 0) {
    this.bubbles = [];
    this.lastShoutTimes = new Map();
    this.lastLineBySpeaker = new Map();
    this.clock = clock;
    this.maxBubbles = MAX_SPEECH_BUBBLES;
    this.leaderTick = 0;
    this.layoutScratch = [];
    this.placedScratch = [];
  }
  reset() {
    this.bubbles.length = 0;
    this.lastShoutTimes.clear();
    this.lastLineBySpeaker.clear();
    this.leaderTick = 0;
    this.layoutScratch.length = 0;
    this.placedScratch.length = 0;
  }
  spawnBubble(x, y, text, speakerType = 'playerAttack', duration = 1.45, options = {}) {
    const speakerKey = options.speakerKey || speakerType;
    const cooldownMs = options.cooldownMs ?? ({
      playerAttack: 1400,
      playerHurt: 1500,
      zombieGroan: 900,
      titan: 1700,
      darkLord: 1700,
      kingOrange: 1700,
      luckyOrb: 1600,
      h4c3r: 1700
    }[speakerType] || 320);
    const now = this.clock();
    const lastShout = this.lastShoutTimes.get(speakerKey);
    if (lastShout !== undefined && now - lastShout < cooldownMs) return false;
    const priority = options.priority ?? bubblePriority(speakerType);
    const leader = options.leader === true;
    const incomingRank = priority * 2 + (leader ? 1 : 0);
    const existingIndex = this.bubbles.findIndex((bubble) => bubble.speakerKey === speakerKey);
    if (existingIndex >= 0) this.bubbles.splice(existingIndex, 1);
    if (this.bubbles.length >= this.maxBubbles) {
      let replacementIndex = 0;
      for (let i = 1; i < this.bubbles.length; i++) {
        const candidateRank = this.bubbles[i].priority * 2 + (this.bubbles[i].leader ? 1 : 0);
        const replacementRank = this.bubbles[replacementIndex].priority * 2 + (this.bubbles[replacementIndex].leader ? 1 : 0);
        if (candidateRank < replacementRank ||
            (candidateRank === replacementRank && this.bubbles[i].leaderTick < this.bubbles[replacementIndex].leaderTick)) {
          replacementIndex = i;
        }
      }
      const replacement = this.bubbles[replacementIndex];
      const replacementRank = replacement.priority * 2 + (replacement.leader ? 1 : 0);
      if (replacementRank > incomingRank) return false;
      this.bubbles.splice(replacementIndex, 1);
    }
    this.lastShoutTimes.set(speakerKey, now);
    audio.playSpeechChirp?.();
    const safeDuration = clamp(Number(duration) || 1.45, 0.9, 2.4);
    this.bubbles.push({
      x,
      y,
      text: normalizeSpeechText(text),
      speakerType,
      speakerKey,
      priority,
      leader,
      leaderTick: ++this.leaderTick,
      anchor: options.anchor || null,
      anchorOffsetX: options.anchorOffsetX || 0,
      anchorOffsetY: options.anchorOffsetY ?? options.anchor?.speechOffsetY ?? -44,
      life: safeDuration,
      maxLife: safeDuration,
      popScale: 0.86,
      riseOffset: 12
    });
    return true;
  }
  shout(x, y, category = 'playerAttack', subKey = null, duration = 1.45, options = {}) {
    const pool = resolveSpeechPool(category, subKey);
    if (!Array.isArray(pool) || pool.length === 0) return false;
    const isAllyLine = (category === 'allies' || category === 'allyHurt') && subKey;
    const speakerType = isAllyLine ? `ally-${subKey}` : category;
    const isBossLine = Object.hasOwn(BOSS_SPEECH_EVENTS, category);
    const speakerKey = options.speakerKey || (isAllyLine ? `${category}:${subKey}` : `${category}:default`);
    const repeatKey = options.repeatKey || speakerKey;
    const lastLine = this.lastLineBySpeaker.get(repeatKey);
    const choices = pool.length > 1 ? pool.filter((line) => line !== lastLine) : pool;
    const text = choices[Math.floor(Math.random() * choices.length)];
    const didSpawn = this.spawnBubble(x, y, text, speakerType, duration, {
      ...options,
      speakerKey,
      priority: options.priority ?? (isBossLine ? 4 : undefined)
    });
    if (didSpawn) this.lastLineBySpeaker.set(repeatKey, text);
    return didSpawn;
  }
  shoutBoss(x, y, bossName, eventName = 'default', duration = 1.6, options = {}) {
    if (!Object.hasOwn(BOSS_SPEECH_EVENTS, bossName)) return false;
    const supportedEvents = BOSS_SPEECH_EVENTS[bossName];
    const event = supportedEvents.includes(eventName) ? eventName : 'default';
    return this.shout(x, y, bossName, event, duration, {
      ...options,
      priority: options.priority ?? 4,
      leader: options.leader ?? (event === 'intro' || event === 'defeat')
    });
  }
  update(dt) {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const bubble = this.bubbles[i];
      bubble.life -= dt;
      bubble.popScale += (1 - bubble.popScale) * Math.min(1, dt * 14);
      bubble.riseOffset += (0 - bubble.riseOffset) * Math.min(1, dt * 8);
      if (bubble.life <= 0) this.bubbles.splice(i, 1);
    }
  }
  getScreenAnchor(bubble, camera) {
    const anchor = bubble.anchor;
    const worldX = (Number.isFinite(anchor?.x) ? anchor.x : bubble.x) + bubble.anchorOffsetX;
    const worldY = (Number.isFinite(anchor?.y) ? anchor.y : bubble.y) + bubble.anchorOffsetY;
    if (camera?.worldToScreen) return camera.worldToScreen(worldX, worldY, false);
    return { x: worldX, y: worldY };
  }
  draw(ctx, camera = null, viewportWidth = null, viewportHeight = null) {
    if (this.bubbles.length === 0) return;
    const cameraSize = camera?.getViewportSize?.();
    const width = viewportWidth || cameraSize?.width || ctx.canvas?.clientWidth || ctx.canvas?.width || 1280;
    const height = viewportHeight || cameraSize?.height || ctx.canvas?.clientHeight || ctx.canvas?.height || 720;
    let safeTop = clamp(height * 0.15, 54, 112);
    let safeBottom = height - (height <= 500 ? 104 : 82);
    const coarsePointer = globalThis.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches === true;
    if (coarsePointer && height <= 500 && width > 500) {
      safeTop = Math.max(safeTop, 142);
      safeBottom = Math.min(safeBottom, height - 118);
    } else if (coarsePointer && width <= 500 && height <= 500) {
      safeTop = Math.max(safeTop, height * 0.46);
      safeBottom = Math.min(safeBottom, height - 118);
    } else if (coarsePointer && width <= 500) {
      safeBottom = Math.min(safeBottom, height - 290);
    }
    if (width <= 1080) {
      safeBottom = Math.min(safeBottom, height - 122);
    }
    if (width <= 860) {
      safeTop = Math.max(safeTop, height <= 500 ? 158 : 180);
    }
    if (safeBottom - safeTop < 72) {
      const middle = height * 0.54;
      safeTop = Math.max(8, middle - 36);
      safeBottom = Math.min(height - 8, middle + 36);
    }
    const maxTextWidth = Math.max(96, Math.min(184, width - 48));
    const placed = this.placedScratch;
    placed.length = 0;
    const layoutOrder = this.layoutScratch;
    layoutOrder.length = 0;
    for (const bubble of this.bubbles) layoutOrder.push(bubble);
    layoutOrder.sort(compareLayoutPriority);
    ctx.save();
    ctx.font = "700 14px 'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const bubble of layoutOrder) {
      const speaker = this.getScreenAnchor(bubble, camera);
      const lines = wrapText(ctx, bubble.text, maxTextWidth);
      const textWidth = Math.max(...lines.map((line) => measureWidth(ctx, line)));
      const bubbleW = Math.min(width - 20, Math.max(68, textWidth + 24));
      const bubbleH = lines.length * 17 + 16;
      const halfW = bubbleW / 2;
      const halfH = bubbleH / 2;
      const preferredX = speaker.x;
      const preferredY = speaker.y - 44 + bubble.riseOffset;
      const centerX = clamp(preferredX, halfW + 10, width - halfW - 10);
      const desiredY = clamp(preferredY, safeTop + halfH, safeBottom - halfH);
      const laneStep = bubbleH + 9;
      const candidates = [0, -1, 1, -2, 2].map((lane) =>
        clamp(desiredY + lane * laneStep, safeTop + halfH, safeBottom - halfH)
      );
      const overlapCount = (candidateY) => placed.reduce((count, prior) => {
        const overlapsX = Math.abs(centerX - prior.x) < halfW + prior.w / 2 + 8;
        const overlapsY = Math.abs(candidateY - prior.y) < halfH + prior.h / 2 + 6;
        return count + (overlapsX && overlapsY ? 1 : 0);
      }, 0);
      const clearLane = candidates.find((candidateY) => overlapCount(candidateY) === 0);
      const centerY = clearLane ?? candidates.reduce((best, candidateY) =>
        overlapCount(candidateY) < overlapCount(best) ? candidateY : best
      , candidates[0]);
      placed.push({ x: centerX, y: centerY, w: bubbleW, h: bubbleH });
      const alpha = bubble.life < 0.24 ? clamp(bubble.life / 0.24, 0, 1) : 1;
      // Comic-book paint: every bubble is white with a wobbling black ink
      // outline and black text; the speaker keeps their identity through
      // the accent keyline and the tail pointing at them.
      const accentColor = bubblePalette(bubble.speakerType)[1];
      const bgColor = '#ffffff';
      const borderColor = '#16181d';
      const textColor = '#101318';
      const wobbleSeed = Math.floor((bubble.maxLife - bubble.life) * 10) * 47 + bubble.leaderTick * 13;
      const speakerBelow = speaker.y >= centerY;
      const tailBaseY = speakerBelow ? halfH - 1 : -halfH + 1;
      const tailTipY = speakerBelow ? halfH + 11 : -halfH - 11;
      const tailX = clamp(speaker.x - centerX, -halfW + 14, halfW - 14);
      const layoutDisplacement = Math.hypot(centerX - preferredX, centerY - preferredY);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(centerX, centerY);
      ctx.scale(bubble.popScale, bubble.popScale);
      if (layoutDisplacement > 24) {
        const speakerLocalX = speaker.x - centerX;
        const speakerLocalY = speaker.y - centerY;
        const leaderDx = speakerLocalX - tailX;
        const leaderDy = speakerLocalY - tailTipY;
        const leaderDistance = Math.hypot(leaderDx, leaderDy) || 1;
        const leaderLength = Math.min(48, Math.max(16, leaderDistance - 10));
        ctx.beginPath();
        ctx.moveTo(tailX, tailTipY);
        ctx.lineTo(
          tailX + leaderDx / leaderDistance * leaderLength,
          tailTipY + leaderDy / leaderDistance * leaderLength
        );
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.25;
        ctx.globalAlpha = alpha * 0.72;
        ctx.stroke();
        ctx.globalAlpha = alpha;
      }
      ctx.beginPath();
      ctx.moveTo(tailX - 7, tailBaseY);
      ctx.lineTo(tailX + wobbleHash(wobbleSeed + 5) * 2, tailTipY);
      ctx.lineTo(tailX + 7, tailBaseY);
      ctx.closePath();
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2.5;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      addWobblyBubblePath(ctx, -halfW, -halfH, bubbleW, bubbleH, wobbleSeed);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = alpha * 0.85;
      ctx.beginPath();
      addRoundedRect(ctx, -halfW + 3.5, -halfH + 3.5, bubbleW - 7, bubbleH - 7, 6);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = textColor;
      const firstLineY = -((lines.length - 1) * 17) / 2;
      lines.forEach((line, index) => {
        const lineY = firstLineY + index * 17;
        ctx.fillText(line, 0, lineY);
      });
      ctx.restore();
    }
    ctx.restore();
  }
}
export const speech = new SpeechBubbleManager();
