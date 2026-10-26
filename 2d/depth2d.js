// ============================================================================
// Stick vs Zombies — 2D Depth-of-Field, Multi-Plane Parallax, Aerial Haze,
// Contact Shadows & Foreground Bokeh Module (2d/depth2d.js)
//
// Performance Architecture (60fps Zero-Lag Guarantee):
//   - Far Horizon Plane (0.28x parallax, 3.2px blur) and Mid-Distance Plane
//     (0.56x parallax, 1.4px blur) are rasterized & blurred ONCE per stage
//     into downsampled offscreen <canvas> buffers (0.5x / 0.65x scale).
//   - Per-frame cost is just 2 ctx.drawImage() blits + cached linear haze
//     gradient + lightweight contact ellipses + pre-blurred 64x64 bokeh sprites
//     (ZERO per-frame ctx.filter calls and ZERO per-frame allocations!).
// ============================================================================

import { isOpenEdgeTheme } from '../3d/js/physics3d.js?v=10.3';

export const DEPTH_PARALLAX = Object.freeze({
  FAR: 0.28,
  MID: 0.56,
  ICONS: 0.76,
  ACTION: 1.0,
  FOREGROUND: 1.28
});

const THEME_DEPTH_PROFILES = Object.freeze({
  desktop: {
    farTint: '#7dd3fc',
    midTint: '#38bdf8',
    hazeTop: 'rgba(5, 43, 95, 0)',
    hazeMid: 'rgba(14, 68, 138, 0.16)',
    hazeBottom: 'rgba(8, 47, 98, 0.34)',
    bokehTint: '#bae6fd',
    motif: 'windows'
  },
  animate: {
    farTint: '#94a3b8',
    midTint: '#cbd5e1',
    hazeTop: 'rgba(45, 47, 58, 0)',
    hazeMid: 'rgba(30, 32, 42, 0.18)',
    hazeBottom: 'rgba(20, 22, 30, 0.34)',
    bokehTint: '#fde68a',
    motif: 'windows'
  },
  bsod: {
    farTint: '#93c5fd',
    midTint: '#dbeafe',
    hazeTop: 'rgba(0, 71, 179, 0)',
    hazeMid: 'rgba(30, 64, 175, 0.18)',
    hazeBottom: 'rgba(10, 36, 114, 0.36)',
    bokehTint: '#bfdbfe',
    motif: 'monoliths'
  },
  firewall: {
    farTint: '#fb7185',
    midTint: '#f43f5e',
    hazeTop: 'rgba(17, 24, 39, 0)',
    hazeMid: 'rgba(127, 29, 29, 0.16)',
    hazeBottom: 'rgba(69, 10, 10, 0.34)',
    bokehTint: '#fda4af',
    motif: 'towers'
  },
  terminal: {
    farTint: '#4ade80',
    midTint: '#22c55e',
    hazeTop: 'rgba(5, 17, 8, 0)',
    hazeMid: 'rgba(6, 78, 59, 0.16)',
    hazeBottom: 'rgba(2, 44, 34, 0.34)',
    bokehTint: '#86efac',
    motif: 'towers'
  },
  root_gateway: {
    farTint: '#34d399',
    midTint: '#10b981',
    hazeTop: 'rgba(2, 13, 8, 0)',
    hazeMid: 'rgba(6, 95, 70, 0.16)',
    hazeBottom: 'rgba(4, 47, 46, 0.35)',
    bokehTint: '#6ee7b7',
    motif: 'towers'
  },
  minecraft: {
    farTint: '#f97316',
    midTint: '#b91c1c',
    hazeTop: 'rgba(41, 21, 29, 0)',
    hazeMid: 'rgba(124, 45, 18, 0.22)',
    hazeBottom: 'rgba(234, 88, 12, 0.32)',
    bokehTint: '#fdba74',
    motif: 'nether'
  },
  dark_core: {
    farTint: '#7dd3fc',
    midTint: '#38bdf8',
    hazeTop: 'rgba(12, 74, 110, 0)',
    hazeMid: 'rgba(56, 189, 248, 0.16)',
    hazeBottom: 'rgba(186, 230, 253, 0.28)',
    bokehTint: '#e0f2fe',
    motif: 'ava8_lake'
  },
  cloud_cache: {
    farTint: '#e0f2fe',
    midTint: '#7dd3fc',
    hazeTop: 'rgba(16, 41, 66, 0)',
    hazeMid: 'rgba(56, 189, 248, 0.16)',
    hazeBottom: 'rgba(186, 230, 253, 0.28)',
    bokehTint: '#e0f2fe',
    motif: 'sky_isles'
  },
  creeper_clan: {
    farTint: '#a3e635',
    midTint: '#84cc16',
    hazeTop: 'rgba(16, 29, 24, 0)',
    hazeMid: 'rgba(54, 83, 20, 0.18)',
    hazeBottom: 'rgba(26, 46, 5, 0.34)',
    bokehTint: '#bef264',
    motif: 'nether'
  },
  lucky_orb: {
    farTint: '#fde047',
    midTint: '#c084fc',
    hazeTop: 'rgba(33, 17, 45, 0)',
    hazeMid: 'rgba(88, 28, 135, 0.18)',
    hazeBottom: 'rgba(234, 179, 8, 0.22)',
    bokehTint: '#fef08a',
    motif: 'monoliths'
  },
  the_end: {
    farTint: '#c084fc',
    midTint: '#7e22ce',
    hazeTop: 'rgba(7, 3, 18, 0)',
    hazeMid: 'rgba(88, 28, 135, 0.2)',
    hazeBottom: 'rgba(168, 85, 247, 0.28)',
    bokehTint: '#e879f9',
    motif: 'end_isles'
  },
  aether: {
    farTint: '#ffffff',
    midTint: '#fde047',
    hazeTop: 'rgba(2, 132, 199, 0)',
    hazeMid: 'rgba(254, 243, 199, 0.2)',
    hazeBottom: 'rgba(255, 255, 255, 0.34)',
    bokehTint: '#fef08a',
    motif: 'sky_isles'
  },
  ancient_city: {
    farTint: '#22d3ee',
    midTint: '#155e75',
    hazeTop: 'rgba(3, 9, 16, 0)',
    hazeMid: 'rgba(8, 51, 68, 0.26)',
    hazeBottom: 'rgba(6, 182, 212, 0.22)',
    bokehTint: '#67e8f9',
    motif: 'cavern'
  },
  pale_garden: {
    farTint: '#cbd5e1',
    midTint: '#94a3b8',
    hazeTop: 'rgba(18, 22, 28, 0)',
    hazeMid: 'rgba(100, 116, 139, 0.22)',
    hazeBottom: 'rgba(203, 213, 225, 0.28)',
    bokehTint: '#fdba74',
    motif: 'pale_forest'
  },
  youtube: {
    farTint: '#ff0033',
    midTint: '#f87171',
    hazeTop: 'rgba(15, 15, 15, 0)',
    hazeMid: 'rgba(69, 10, 10, 0.16)',
    hazeBottom: 'rgba(24, 24, 27, 0.30)',
    bokehTint: '#fca5a5',
    motif: 'youtube_ui'
  },
  chrome: {
    farTint: '#4285f4',
    midTint: '#34a853',
    hazeTop: 'rgba(32, 33, 36, 0)',
    hazeMid: 'rgba(30, 58, 138, 0.14)',
    hazeBottom: 'rgba(23, 37, 84, 0.24)',
    bokehTint: '#93c5fd',
    motif: 'chrome_tabs'
  },
  spotify: {
    farTint: '#1db954',
    midTint: '#4ade80',
    hazeTop: 'rgba(10, 14, 12, 0)',
    hazeMid: 'rgba(6, 78, 59, 0.18)',
    hazeBottom: 'rgba(5, 46, 22, 0.30)',
    bokehTint: '#86efac',
    motif: 'spotify_eq'
  },
  slides: {
    farTint: '#fbbc04',
    midTint: '#f59e0b',
    hazeTop: 'rgba(248, 249, 250, 0)',
    hazeMid: 'rgba(254, 243, 199, 0.14)',
    hazeBottom: 'rgba(226, 232, 240, 0.22)',
    bokehTint: '#fde047',
    motif: 'slides_deck'
  },
  rocket_corp: {
    farTint: '#64748b',
    midTint: '#38bdf8',
    hazeTop: 'rgba(15, 23, 42, 0)',
    hazeMid: 'rgba(30, 41, 59, 0.24)',
    hazeBottom: 'rgba(15, 23, 42, 0.38)',
    bokehTint: '#38bdf8',
    motif: 'facility'
  },
  zero_day: {
    farTint: '#67e8f9',
    midTint: '#22d3ee',
    hazeTop: 'rgba(7, 10, 18, 0)',
    hazeMid: 'rgba(8, 145, 178, 0.14)',
    hazeBottom: 'rgba(6, 78, 99, 0.28)',
    bokehTint: '#a5f3fc',
    motif: 'towers'
  },
  trophy: {
    farTint: '#fde047',
    midTint: '#60a5fa',
    hazeTop: 'rgba(3, 26, 59, 0)',
    hazeMid: 'rgba(30, 58, 138, 0.16)',
    hazeBottom: 'rgba(250, 204, 21, 0.16)',
    bokehTint: '#fef08a',
    motif: 'monoliths'
  }
});

// World-space span covered by cached depth buffers
const WORLD_SPAN_W = 2800;
const WORLD_SPAN_H = 820;

// Deterministic foreground bokeh descriptors (12 motes, zero runtime allocs)
const FOREGROUND_MOTES = Object.freeze(
  Array.from({ length: 12 }, (_, i) => Object.freeze({
    baseX: -1180 + i * 212 + ((i * 73) % 65),
    baseY: -440 + ((i * 139) % 410),
    size: 28 + (i % 4) * 14,
    speedX: 11 + (i % 3) * 6,
    bobAmp: 8 + (i % 3) * 5,
    phase: i * 1.37,
    alpha: 0.075 + (i % 3) * 0.028
  }))
);

export function getDepthProfile2D(theme) {
  return THEME_DEPTH_PROFILES[theme] || THEME_DEPTH_PROFILES.desktop;
}

function defaultBufferFactory(width, height) {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  if (typeof globalThis.OffscreenCanvas === 'function') {
    return new globalThis.OffscreenCanvas(width, height);
  }
  return null;
}

function paintDepthMotifSilhouettes(ctx, motif, profile, stageSeed, isMidLayer) {
  const tint = isMidLayer ? profile.midTint : profile.farTint;
  const count = isMidLayer ? 9 : 13;
  const stepX = WORLD_SPAN_W / count;
  const groundLocalY = WORLD_SPAN_H - 150;

  ctx.save();
  ctx.globalAlpha = isMidLayer ? 0.24 : 0.18;

  for (let i = 0; i < count; i++) {
    const hash = ((stageSeed * 37 + i * 97) & 0xffff);
    const cx = 90 + i * stepX + ((hash % 54) - 27);
    const w = (isMidLayer ? 130 : 175) + (hash % 85);
    const h = (isMidLayer ? 190 : 285) + ((hash >> 3) % 165);

    if (motif === 'pale_forest') {
      // Distant blurred Pale Oak trunks & misty canopies
      ctx.fillStyle = isMidLayer ? '#64748b' : '#475569';
      const trunkW = isMidLayer ? 28 : 38;
      ctx.fillRect(cx - trunkW * 0.5, groundLocalY - h, trunkW, h + 40);
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.ellipse(cx, groundLocalY - h, w * 0.62, 48, 0, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        // Distant soft-blurred Eyeblossom orange glimmer
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(cx + 18, groundLocalY - 14, isMidLayer ? 6 : 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (motif === 'cavern') {
      // Distant Deep Dark hanging stalactites & ruined Deepslate arches
      ctx.fillStyle = isMidLayer ? '#0f172a' : '#082f49';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.38, 0);
      ctx.lineTo(cx, 120 + (hash % 150));
      ctx.lineTo(cx + w * 0.38, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillRect(cx - w * 0.34, groundLocalY - h * 0.72, w * 0.68, h * 0.72 + 40);
      ctx.fillStyle = tint;
      ctx.fillRect(cx - 12, groundLocalY - h * 0.52, 24, 10);
    } else if (motif === 'sky_isles' || motif === 'end_isles') {
      // Distant floating sky islands & outer End monoliths
      const isleY = 170 + ((hash >> 2) % 270);
      ctx.fillStyle = motif === 'end_isles' ? '#3b0764' : tint;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.55, isleY);
      ctx.lineTo(cx + w * 0.55, isleY);
      ctx.lineTo(cx + w * 0.22, isleY + 58 + (hash % 36));
      ctx.lineTo(cx - w * 0.2, isleY + 48 + (hash % 28));
      ctx.closePath();
      ctx.fill();
      if (motif === 'end_isles' && i % 2 === 0) {
        ctx.fillStyle = '#c084fc';
        ctx.fillRect(cx - 14, isleY - 95, 28, 95);
      }
    } else if (motif === 'nether') {
      // Distant Nether Fortress bridge arches & basalt columns
      ctx.fillStyle = isMidLayer ? '#450a0a' : '#7c2d12';
      ctx.fillRect(cx - w * 0.42, groundLocalY - h * 0.85, w * 0.84, 34);
      ctx.fillRect(cx - 24, groundLocalY - h * 0.85, 48, h + 120);
      if (i % 3 === 1) {
        // Distant glowing lavafall ribbon
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(cx + w * 0.25, 40, 14, WORLD_SPAN_H - 80);
      }
    } else if (motif === 'ava8_lake') {
      // Distant blurred Outernet mountain peaks, bay bluffs & secondary misty waterfalls
      ctx.fillStyle = isMidLayer ? '#334155' : '#475569';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.72, groundLocalY + 25);
      ctx.lineTo(cx - w * 0.18, groundLocalY - h * 0.85);
      ctx.lineTo(cx + w * 0.24, groundLocalY - h * 0.78);
      ctx.lineTo(cx + w * 0.72, groundLocalY + 25);
      ctx.closePath();
      ctx.fill();
      // Emerald bluff turf crown
      ctx.fillStyle = isMidLayer ? '#15803d' : '#16a34a';
      ctx.fillRect(cx - w * 0.2, groundLocalY - h * 0.84, w * 0.44, 14);
      if (i % 3 === 1) {
        // Distant misty cascade ribbon plunging into the bay
        ctx.fillStyle = tint;
        ctx.fillRect(cx - 7, groundLocalY - h * 0.8, 14, h * 0.82);
      }
    } else if (motif === 'youtube_ui') {
      // Distant blurred 16:9 video recommendation cards & glowing Play button badges
      const cardY = 125 + ((hash >> 2) % 290);
      const cardW = w * 0.92;
      const cardH = Math.round(cardW * 0.56);
      ctx.fillStyle = isMidLayer ? '#27272a' : '#18181b';
      ctx.fillRect(cx - cardW * 0.5, cardY, cardW, cardH);
      ctx.fillStyle = '#ff0033';
      ctx.fillRect(cx - cardW * 0.5, cardY + cardH - 5, cardW * 0.65, 5);
      ctx.fillRect(cx - 16, cardY + cardH * 0.5 - 11, 32, 22);
    } else if (motif === 'chrome_tabs') {
      // Distant blurred multi-tab browser windows accented with Google's 4 brand colors
      const googlePalette = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];
      const accent = googlePalette[i % 4];
      const winY = 115 + ((hash >> 2) % 295);
      const winH = 95 + (hash % 75);
      ctx.fillStyle = isMidLayer ? '#3c4043' : '#292a2d';
      ctx.fillRect(cx - w * 0.48, winY, w * 0.96, winH);
      ctx.fillStyle = accent;
      ctx.fillRect(cx - w * 0.48, winY, w * 0.52, 14);
    } else if (motif === 'spotify_eq') {
      // Distant blurred #1db954 equalizer spectrum columns & floating vinyl halos
      const bars = 4;
      const barW = Math.max(12, Math.floor((w * 0.68) / bars) - 5);
      for (let b = 0; b < bars; b++) {
        const bh = 70 + (((hash + b * 43) % 190));
        ctx.fillStyle = b % 2 === 0 ? '#1db954' : tint;
        ctx.fillRect(cx - w * 0.34 + b * (barW + 6), groundLocalY - bh, barW, bh + 20);
      }
      if (i % 3 === 0) {
        ctx.beginPath();
        ctx.arc(cx, 185 + (hash % 110), isMidLayer ? 34 : 46, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (motif === 'slides_deck') {
      // Distant blurred 16:9 presentation slide cards & gold header ribbons
      const slideY = 120 + ((hash >> 2) % 280);
      const slideW = w * 0.94;
      const slideH = Math.round(slideW * 0.56);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(cx - slideW * 0.5, slideY, slideW, slideH);
      ctx.fillStyle = '#fbbc04';
      ctx.fillRect(cx - slideW * 0.5, slideY, slideW, 13);
      ctx.fillStyle = '#4285f4';
      ctx.fillRect(cx - slideW * 0.3, slideY + slideH - 36, 16, 26);
      ctx.fillStyle = '#ea4335';
      ctx.fillRect(cx - slideW * 0.08, slideY + slideH - 46, 16, 36);
      ctx.fillStyle = '#34a853';
      ctx.fillRect(cx + slideW * 0.14, slideY + slideH - 30, 16, 20);
    } else if (motif === 'facility') {
      // Distant Rocket Corp industrial testing bays & glowing cyan conduits
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - w * 0.4, groundLocalY - h * 0.88, w * 0.8, h * 0.88 + 30);
      ctx.strokeStyle = tint;
      ctx.lineWidth = 4;
      ctx.strokeRect(cx - w * 0.32, groundLocalY - h * 0.72, w * 0.64, h * 0.45);
    } else if (motif === 'windows') {
      // Out-of-focus distant OS application windows receding into desktop depth
      const winY = 120 + ((hash >> 2) % 310);
      const winH = 95 + (hash % 75);
      ctx.fillStyle = tint;
      ctx.fillRect(cx - w * 0.48, winY, w * 0.96, winH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - w * 0.48, winY, w * 0.96, 14);
    } else {
      // Distant towers / spires / monoliths
      ctx.fillStyle = tint;
      ctx.fillRect(cx - w * 0.34, groundLocalY - h * 0.82, w * 0.68, h * 0.82 + 40);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - w * 0.2, groundLocalY - h * 0.72, w * 0.4, 8);
    }
  }

  ctx.restore();
}

export class Depth2DRenderer {
  constructor(options = {}) {
    this.createCanvas = options.createCanvas || defaultBufferFactory;
    this.cachedKey = '';
    this.farCanvas = null;
    this.midCanvas = null;
    this.bokehCache = new Map();
    this.hazeGradCache = { ctx: null, theme: '', groundY: NaN, grad: null };
  }

  invalidate() {
    this.cachedKey = '';
  }

  ensureStageBuffers(stageManager) {
    const stageKey = `${stageManager.currentStage}:${stageManager.theme}:${stageManager.isTrophyRoom ? 1 : 0}`;
    if (this.cachedKey === stageKey && this.farCanvas && this.midCanvas) {
      return true;
    }

    const farScale = 0.45;
    const midScale = 0.6;
    const farW = Math.round(WORLD_SPAN_W * farScale);
    const farH = Math.round(WORLD_SPAN_H * farScale);
    const midW = Math.round(WORLD_SPAN_W * midScale);
    const midH = Math.round(WORLD_SPAN_H * midScale);

    if (!this.farCanvas) this.farCanvas = this.createCanvas(farW, farH);
    if (!this.midCanvas) this.midCanvas = this.createCanvas(midW, midH);
    if (!this.farCanvas || !this.midCanvas) {
      return false;
    }

    const profile = getDepthProfile2D(stageManager.theme);
    const seed = (stageManager.currentStage || 1) * 13 + (stageManager.isTrophyRoom ? 99 : 0);

    this._bakeBlurredPlane(this.farCanvas, farScale, 3.4, profile, seed, false);
    this._bakeBlurredPlane(this.midCanvas, midScale, 1.5, profile, seed + 7, true);
    this.cachedKey = stageKey;
    return true;
  }

  _bakeBlurredPlane(canvas, scale, blurPx, profile, seed, isMidLayer) {
    const bctx = canvas.getContext?.('2d');
    if (!bctx) return;

    bctx.save();
    bctx.setTransform?.(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, canvas.width, canvas.height);
    bctx.scale(scale, scale);

    if ('filter' in bctx) {
      bctx.filter = `blur(${blurPx}px)`;
      paintDepthMotifSilhouettes(bctx, profile.motif, profile, seed, isMidLayer);
      bctx.filter = 'none';
    } else {
      // Multi-tap soft kernel fallback for environments without Canvas2D filter
      const offsets = [
        [-blurPx, 0],
        [blurPx, 0],
        [0, -blurPx],
        [0, blurPx],
        [0, 0]
      ];
      for (let i = 0; i < offsets.length; i++) {
        bctx.save();
        bctx.globalAlpha = 0.26;
        bctx.translate(offsets[i][0], offsets[i][1]);
        paintDepthMotifSilhouettes(bctx, profile.motif, profile, seed, isMidLayer);
        bctx.restore();
      }
    }

    bctx.restore();
  }

  _getBokehSprite(tint) {
    let sprite = this.bokehCache.get(tint);
    if (sprite !== undefined) return sprite;

    const canvas = this.createCanvas(64, 64);
    if (!canvas) {
      this.bokehCache.set(tint, null);
      return null;
    }
    const sctx = canvas.getContext?.('2d');
    if (!sctx) {
      this.bokehCache.set(tint, null);
      return null;
    }

    sctx.clearRect(0, 0, 64, 64);
    const grad = sctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, tint);
    grad.addColorStop(0.45, tint);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    sctx.globalAlpha = 0.85;
    sctx.fillStyle = grad;
    sctx.beginPath();
    sctx.arc(32, 32, 30, 0, Math.PI * 2);
    sctx.fill();

    this.bokehCache.set(tint, canvas);
    return canvas;
  }

  drawBackgroundDepthPlanes(ctx, stageManager, camera, groundY, reducedEffects = false) {
    const theme = stageManager.theme;
    const profile = getDepthProfile2D(theme);
    const camX = Number.isFinite(camera?.x) ? camera.x : 0;
    const camY = Number.isFinite(camera?.y) ? camera.y : -140;
    const openEdge = isOpenEdgeTheme(theme);
    const minX = stageManager.bounds?.minX ?? -1000;
    const maxX = stageManager.bounds?.maxX ?? 1000;
    const minY = stageManager.bounds?.minY ?? -620;

    const hasBuffers = this.ensureStageBuffers(stageManager);

    ctx.save();
    // Clip enclosed rooms cleanly above groundY so blurred far buildings never bleed onto the floor line
    if (!openEdge && typeof ctx.beginPath === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect(minX + 2, minY - 300, (maxX - minX) - 4, (groundY - 3) - (minY - 300));
      ctx.clip();
    }

    const farShiftX = camX * (1 - DEPTH_PARALLAX.FAR);
    const farShiftY = (camY + 180) * 0.42;
    const destY = groundY - (WORLD_SPAN_H - 150);

    if (hasBuffers) {
      // Plane 1: Deep-blurred Far Horizon (0.28x camera speed)
      ctx.drawImage(
        this.farCanvas,
        -WORLD_SPAN_W * 0.5 + farShiftX,
        destY + farShiftY,
        WORLD_SPAN_W,
        WORLD_SPAN_H
      );

      // Plane 2: Soft-blurred Mid-Distance (0.56x camera speed)
      if (!reducedEffects) {
        const midShiftX = camX * (1 - DEPTH_PARALLAX.MID);
        const midShiftY = (camY + 180) * 0.22;
        ctx.drawImage(
          this.midCanvas,
          -WORLD_SPAN_W * 0.5 + midShiftX,
          destY + midShiftY,
          WORLD_SPAN_W,
          WORLD_SPAN_H
        );
      }
    } else {
      // Headless / no-DOM lightweight fallback
      ctx.save();
      ctx.translate(-WORLD_SPAN_W * 0.5 + farShiftX, destY + farShiftY);
      paintDepthMotifSilhouettes(ctx, profile.motif, profile, stageManager.currentStage || 1, false);
      ctx.restore();
    }

    // Plane 3: Atmospheric Aerial Perspective Haze Veil near the horizon
    let hazeGrad = this.hazeGradCache.grad;
    if (
      this.hazeGradCache.ctx !== ctx ||
      this.hazeGradCache.theme !== theme ||
      this.hazeGradCache.groundY !== groundY
    ) {
      hazeGrad = ctx.createLinearGradient(0, minY, 0, groundY + (openEdge ? 220 : 0));
      hazeGrad.addColorStop(0, profile.hazeTop);
      hazeGrad.addColorStop(0.58, profile.hazeMid);
      hazeGrad.addColorStop(1, profile.hazeBottom);
      this.hazeGradCache.ctx = ctx;
      this.hazeGradCache.theme = theme;
      this.hazeGradCache.groundY = groundY;
      this.hazeGradCache.grad = hazeGrad;
    }
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(minX - 1200, minY - 200, (maxX - minX) + 2400, (groundY - minY) + (openEdge ? 460 : 200));

    ctx.restore();
  }

  drawPlatformDepthShadows(ctx, platforms) {
    if (!Array.isArray(platforms) || platforms.length === 0) return;
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.30)';
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (!p || p.broken) continue;
      const halfW = (p.width || 68) * 0.5;
      const topY = p.y - (p.height || 20);
      ctx.fillRect(p.x - halfW + 7, topY + 7, p.width || 68, p.height || 20);
    }
    ctx.restore();
  }

  drawEntityContactShadows(ctx, player, allyList, enemyList, platforms, groundY, openEdge = false) {
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.34)';

    const castShadow = (ent, baseRadius) => {
      if (!ent || ent.isDead) return;
      if (openEdge && Math.abs(ent.x) > 980 && ent.y > groundY + 4) return;

      // Nearest supporting surface directly beneath the entity (smallest topY >= ent.y - 4)
      let bestSurfaceY = openEdge && Math.abs(ent.x) > 980 ? Infinity : groundY;
      if (Array.isArray(platforms)) {
        for (let i = 0; i < platforms.length; i++) {
          const p = platforms[i];
          if (!p || p.broken) continue;
          const halfW = (p.width || 68) * 0.5;
          const topY = p.y - (p.height || 20);
          if (ent.x >= p.x - halfW && ent.x <= p.x + halfW && topY >= ent.y - 4 && topY < bestSurfaceY) {
            bestSurfaceY = topY;
          }
        }
      }
      if (!Number.isFinite(bestSurfaceY)) return;

      const elevation = Math.max(0, bestSurfaceY - ent.y);
      if (elevation > 420) return;

      const shrink = Math.max(0.32, 1 - elevation / 440);
      const rx = baseRadius * shrink;
      const ry = Math.max(2.5, rx * 0.24);
      ctx.globalAlpha = 0.36 * shrink;
      ctx.beginPath();
      ctx.ellipse(ent.x, bestSurfaceY + 1.5, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    if (Array.isArray(enemyList)) {
      for (let i = 0; i < enemyList.length; i++) {
        const z = enemyList[i];
        castShadow(z, z?.isBoss ? 42 : 20);
      }
    }
    if (Array.isArray(allyList)) {
      for (let i = 0; i < allyList.length; i++) {
        castShadow(allyList[i], 18);
      }
    }
    if (player) {
      castShadow(player, 22);
    }

    ctx.restore();
  }

  drawForegroundBokeh(ctx, stageManager, camera, groundY, reducedEffects = false) {
    if (reducedEffects || stageManager.crowdedRender) return;
    if ((stageManager.whiteVoidProgress || 0) > 0.55) return;

    const profile = getDepthProfile2D(stageManager.theme);
    const sprite = this._getBokehSprite(profile.bokehTint);
    const camX = Number.isFinite(camera?.x) ? camera.x : 0;
    const camY = Number.isFinite(camera?.y) ? camera.y : -140;
    const t = stageManager.stageTime || 0;

    // Foreground moves FASTER than camera (1.28x parallax -> -0.28 * camX world offset)
    const foreShiftX = camX * (1 - DEPTH_PARALLAX.FOREGROUND);
    const foreShiftY = (camY + 160) * -0.16;

    ctx.save();
    for (let i = 0; i < FOREGROUND_MOTES.length; i++) {
      const m = FOREGROUND_MOTES[i];
      const wrappedX = -1300 + ((((m.baseX + t * m.speedX) + 1300) % 2600) + 2600) % 2600;
      const wx = wrappedX + foreShiftX;
      const wy = groundY + m.baseY + Math.sin(t * 1.4 + m.phase) * m.bobAmp + foreShiftY;

      ctx.globalAlpha = m.alpha;
      if (sprite) {
        ctx.drawImage(sprite, wx - m.size, wy - m.size, m.size * 2, m.size * 2);
      } else {
        ctx.fillStyle = profile.bokehTint;
        ctx.beginPath();
        ctx.arc(wx, wy, m.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

export const depth2d = new Depth2DRenderer();
