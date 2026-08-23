// Compact comic speech bubbles. The figures are mostly visual performers, so
// their voices are deliberately tiny punchlines rather than paragraphs.

import { audio } from './audio.js';

// Curated, original micro-lines based on each character's gameplay role. Keep
// entries short enough to read during a fast fight and safe for younger players.
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

  darkLord: [
    'RUN, LITTLE FILE.',
    'VIRABOTS, FETCH!',
    'I OWN THIS SCREEN.',
    'NO ESCAPE KEY.'
  ],

  kingOrange: [
    'THE STAFF IS MINE.',
    'CHECKMATE, ORANGE.',
    "KNEEL. OR DON'T.",
    'POWER NEEDS A CROWN.'
  ],

  h4c3r: [
    'ACCESS GRANTED.',
    'PATCH THIS.',
    'I AM ROOT.',
    'YOUR TURN EXPIRED.'
  ]
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function bubblePriority(speakerType) {
  if (speakerType === 'h4c3r' || speakerType === 'kingOrange' || speakerType === 'darkLord') return 4;
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
    h4c3r: ['#001b20', '#00f5ff', '#c5fcff', '#8cff00'],
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

function measureWidth(ctx, text) {
  const metrics = ctx.measureText?.(text);
  return Number.isFinite(metrics?.width) ? metrics.width : String(text).length * 8;
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

  // The corpus is intentionally short; this is a defensive fallback for any
  // future caller that passes a longer line.
  if (lines.length > 2) {
    lines[1] = `${lines.slice(1).join(' ').slice(0, 20).trimEnd()}…`;
    lines.length = 2;
  }
  return lines.length ? lines : ['…'];
}

export class SpeechBubbleManager {
  constructor(clock = () => Date.now()) {
    this.bubbles = [];
    this.lastShoutTimes = new Map();
    this.clock = clock;
    this.maxBubbles = 3;
  }

  reset() {
    this.bubbles.length = 0;
    this.lastShoutTimes.clear();
  }

  // Spawn a world-anchored line that will be laid out in stable screen space.
  spawnBubble(x, y, text, speakerType = 'playerAttack', duration = 1.45, options = {}) {
    const speakerKey = options.speakerKey || speakerType;
    const cooldownMs = options.cooldownMs ?? ({
      playerAttack: 1400,
      playerHurt: 1500,
      zombieGroan: 900,
      darkLord: 1700,
      kingOrange: 1700,
      h4c3r: 1700
    }[speakerType] || 320);
    const now = this.clock();
    const lastShout = this.lastShoutTimes.get(speakerKey);
    if (lastShout !== undefined && now - lastShout < cooldownMs) return false;

    const priority = options.priority ?? bubblePriority(speakerType);
    const existingIndex = this.bubbles.findIndex((bubble) => bubble.speakerKey === speakerKey);
    if (existingIndex >= 0) this.bubbles.splice(existingIndex, 1);

    if (this.bubbles.length >= this.maxBubbles) {
      let replacementIndex = 0;
      for (let i = 1; i < this.bubbles.length; i++) {
        if (this.bubbles[i].priority < this.bubbles[replacementIndex].priority) replacementIndex = i;
      }
      if (this.bubbles[replacementIndex].priority > priority) return false;
      this.bubbles.splice(replacementIndex, 1);
    }

    this.lastShoutTimes.set(speakerKey, now);
    audio.playSpeechChirp?.();

    const safeDuration = clamp(Number(duration) || 1.45, 0.9, 2.4);
    this.bubbles.push({
      x,
      y,
      text: String(text),
      speakerType,
      speakerKey,
      priority,
      anchor: options.anchor || null,
      anchorOffsetX: options.anchorOffsetX || 0,
      anchorOffsetY: options.anchorOffsetY ?? -44,
      life: safeDuration,
      maxLife: safeDuration,
      popScale: 0.86,
      riseOffset: 12
    });
    return true;
  }

  // Sample a role-specific one-liner from the compact corpus.
  shout(x, y, category = 'playerAttack', subKey = null, duration = 1.45, options = {}) {
    let pool = SPEECH_CORPUS[category];
    if (subKey && pool && pool[subKey]) pool = pool[subKey];
    if (!Array.isArray(pool) || pool.length === 0) return false;

    const text = pool[Math.floor(Math.random() * pool.length)];
    const speakerType = category === 'allies' && subKey ? `ally-${subKey}` : category;
    return this.spawnBubble(x, y, text, speakerType, duration, {
      ...options,
      speakerKey: options.speakerKey || `${category}:${subKey || 'default'}`
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

    // Excluding shake keeps words legible while the tail still follows the
    // character's real world position and the camera's pan/zoom.
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

    // Match the HUD's CSS breakpoints without forcing a DOM layout read every
    // frame. Short landscape moves the hotbar to the top; narrow touch screens
    // reserve a deeper bottom band for both the hotbar and virtual controls.
    if (coarsePointer && height <= 500 && width > 500) {
      safeTop = Math.max(safeTop, 142);
      safeBottom = Math.min(safeBottom, height - 118);
    } else if (coarsePointer && width <= 500 && height <= 500) {
      safeTop = Math.max(safeTop, height * 0.46);
      safeBottom = Math.min(safeBottom, height - 118);
    } else if (coarsePointer && width <= 500) {
      safeBottom = Math.min(safeBottom, height - 290);
    }

    // At tablet widths the HUD becomes a two-row grid and its boss bar sits
    // below the player/score cards. Mirror that CSS breakpoint without a
    // forced getBoundingClientRect layout read on every animation frame.
    if (width <= 860) {
      safeTop = Math.max(safeTop, height <= 500 ? 158 : 180);
    }

    // Extremely small embedded views may not have a full bubble-height gap.
    // Preserve a centered readable strip rather than producing inverted clamps.
    if (safeBottom - safeTop < 72) {
      const middle = height * 0.54;
      safeTop = Math.max(8, middle - 36);
      safeBottom = Math.min(height - 8, middle + 36);
    }
    const maxTextWidth = Math.max(96, Math.min(184, width - 48));
    const placed = [];

    ctx.save();
    ctx.font = "800 14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    for (const bubble of this.bubbles) {
      const speaker = this.getScreenAnchor(bubble, camera);
      const lines = wrapText(ctx, bubble.text, maxTextWidth);
      const textWidth = Math.max(...lines.map((line) => measureWidth(ctx, line)));
      const bubbleW = Math.min(width - 20, Math.max(68, textWidth + 24));
      const bubbleH = lines.length * 17 + 16;
      const halfW = bubbleW / 2;
      const halfH = bubbleH / 2;

      const centerX = clamp(speaker.x, halfW + 10, width - halfW - 10);
      const desiredY = clamp(speaker.y - 44 + bubble.riseOffset, safeTop + halfH, safeBottom - halfH);

      // Evaluate a fixed set of lanes against every prior bubble. Sequential
      // nudges can dodge bubble B and land back on bubble A when three allies
      // speak together; this keeps all three readable at constant cost.
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
      const [bgColor, borderColor, textColor, accentColor] = bubblePalette(bubble.speakerType);
      const speakerBelow = speaker.y >= centerY;
      const tailBaseY = speakerBelow ? halfH - 1 : -halfH + 1;
      const tailTipY = speakerBelow ? halfH + 11 : -halfH - 11;
      const tailX = clamp(speaker.x - centerX, -halfW + 14, halfW - 14);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(centerX, centerY);
      ctx.scale(bubble.popScale, bubble.popScale);

      // Tail first so the body covers its inner seam.
      ctx.beginPath();
      ctx.moveTo(tailX - 7, tailBaseY);
      ctx.lineTo(tailX, tailTipY);
      ctx.lineTo(tailX + 7, tailBaseY);
      ctx.closePath();
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2.5;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.beginPath();
      addRoundedRect(ctx, -halfW + 4, -halfH + 4, bubbleW, bubbleH, 7);
      ctx.fill();

      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      addRoundedRect(ctx, -halfW, -halfH, bubbleW, bubbleH, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = accentColor;
      ctx.fillRect(-halfW + 4, -halfH + 4, 4, 4);
      ctx.fillRect(halfW - 8, -halfH + 4, 4, 4);

      ctx.fillStyle = textColor;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      const firstLineY = -((lines.length - 1) * 17) / 2;
      lines.forEach((line, index) => {
        const lineY = firstLineY + index * 17;
        ctx.strokeText(line, 0, lineY);
        ctx.fillText(line, 0, lineY);
      });

      ctx.restore();
    }
    ctx.restore();
  }
}

export const speech = new SpeechBubbleManager();
