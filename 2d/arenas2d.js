// ============================================================================
// Stick vs Zombies — 2D Expanded Arenas, Floating Islands, Lava Hazards,
// 15-Block Voxel Builder Renderer & Boss Telegraph Overlays
// ============================================================================

import {
  ISLAND_FLOOR_BOUNDS,
  isOpenEdgeTheme
} from '../3d/js/physics3d.js?v=10.3';

export const CREATIVE_BLOCK_TYPES_2D = Object.freeze([
  'command_block',
  'obsidian',
  'gold_block',
  'tnt_block',
  'lucky_block',
  'purpur_block',
  'holystone',
  'rocket_corp_wall',
  'sculk',
  'deepslate_tiles',
  'pale_moss',
  'pale_oak_log',
  'creaking_heart',
  'sketch_block',
  'lava'
]);

const BLOCK_PALETTES = Object.freeze({
  command_block: { base: '#c97a4b', dark: '#8d4c28', light: '#f4a261', border: '#5c2e14', accent: '#38bdf8' },
  obsidian: { base: '#1a1026', dark: '#0d0714', light: '#3b1f5e', border: '#4c1d95', accent: '#a855f7' },
  gold_block: { base: '#facc15', dark: '#ca8a04', light: '#fef08a', border: '#854d0e', accent: '#ffffff' },
  tnt_block: { base: '#dc2626', dark: '#991b1b', light: '#f87171', border: '#450a0a', accent: '#f8fafc' },
  lucky_block: { base: '#f59e0b', dark: '#b45309', light: '#fde047', border: '#78350f', accent: '#ffffff' },
  purpur_block: { base: '#a875a8', dark: '#7e4e7e', light: '#d8b4d8', border: '#581c87', accent: '#f5d0fe' },
  holystone: { base: '#cbd5e1', dark: '#94a3b8', light: '#f1f5f9', border: '#64748b', accent: '#fde047' },
  rocket_corp_wall: { base: '#334155', dark: '#1e293b', light: '#64748b', border: '#0f172a', accent: '#ff6b00' },
  sculk: { base: '#061a23', dark: '#030d14', light: '#0d3b4c', border: '#0891b2', accent: '#22d3ee' },
  deepslate_tiles: { base: '#27272a', dark: '#18181b', light: '#3f3f46', border: '#09090b', accent: '#52525b' },
  pale_moss: { base: '#aeb6bf', dark: '#85929e', light: '#d5dbdb', border: '#5d6d7e', accent: '#f97316' },
  pale_oak_log: { base: '#b8bec6', dark: '#7f8c8d', light: '#dfe4ea', border: '#4b5563', accent: '#94a3b8' },
  creaking_heart: { base: '#4a4e54', dark: '#2c3036', light: '#6c727a', border: '#1f2328', accent: '#f97316' },
  sketch_block: { base: '#f8fafc', dark: '#cbd5e1', light: '#ffffff', border: '#1e293b', accent: '#ff7700' },
  lava: { base: '#ea580c', dark: '#b91c1c', light: '#facc15', border: '#7c2d12', accent: '#fef08a' }
});

export function getBlockPalette2D(texKey) {
  return BLOCK_PALETTES[texKey] || BLOCK_PALETTES.obsidian;
}

export function drawCreativeBlockSingle2D(ctx, block, stageTime = 0) {
  const w = block.width || 68;
  const h = block.height || 68;
  const x = block.x - w * 0.5;
  const y = block.y - h;
  const key = block.texKey || 'obsidian';
  const pal = getBlockPalette2D(key);

  ctx.save();

  // TNT active fuse flash
  const fuseFlash = key === 'tnt_block' && block.fuseTimer !== undefined && Math.floor(block.fuseTimer * 10) % 2 === 0;
  ctx.fillStyle = fuseFlash ? '#ffffff' : pal.base;
  ctx.fillRect(x, y, w, h);

  // Top highlight & bottom bevel
  ctx.fillStyle = fuseFlash ? '#fee2e2' : pal.light;
  ctx.fillRect(x + 2, y + 2, w - 4, 8);
  ctx.fillStyle = pal.dark;
  ctx.fillRect(x + 2, y + h - 10, w - 4, 8);

  // Block-specific 2D pixel details
  if (key === 'command_block') {
    ctx.fillStyle = pal.dark;
    ctx.fillRect(x + 12, y + 12, w - 24, h - 24);
    ctx.fillStyle = Math.floor(stageTime * 4) % 2 === 0 ? '#38bdf8' : '#fb923c';
    ctx.fillRect(x + w * 0.5 - 8, y + h * 0.5 - 8, 16, 16);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(x + w * 0.5 - 3, y + h * 0.5 - 3, 6, 6);
  } else if (key === 'tnt_block' && !fuseFlash) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + 2, y + h * 0.34, w - 4, h * 0.32);
    ctx.fillStyle = '#111827';
    ctx.font = "900 13px 'Bungee', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', block.x, y + h * 0.5 + 1);
  } else if (key === 'lucky_block') {
    ctx.fillStyle = '#ffffff';
    ctx.font = "900 26px 'Bungee', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', block.x, y + h * 0.5 + 2);
  } else if (key === 'sculk') {
    const pulse = 0.55 + Math.sin(stageTime * 5 + block.x * 0.03) * 0.35;
    ctx.fillStyle = `rgba(34, 211, 238, ${pulse})`;
    for (let i = 0; i < 5; i++) {
      const px = x + 10 + ((i * 19) % (w - 20));
      const py = y + 12 + ((i * 23) % (h - 24));
      ctx.fillRect(px, py, 6, 6);
    }
  } else if (key === 'deepslate_tiles' || key === 'purpur_block' || key === 'holystone') {
    ctx.strokeStyle = pal.dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.5);
    ctx.lineTo(x + w, y + h * 0.5);
    ctx.moveTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.5, y + h * 0.5);
    ctx.moveTo(x + w * 0.25, y + h * 0.5);
    ctx.lineTo(x + w * 0.25, y + h);
    ctx.moveTo(x + w * 0.75, y + h * 0.5);
    ctx.lineTo(x + w * 0.75, y + h);
    ctx.stroke();
  } else if (key === 'pale_oak_log') {
    ctx.fillStyle = pal.dark;
    for (let sx = x + 10; sx < x + w - 8; sx += 12) {
      ctx.fillRect(sx, y + 4, 4, h - 8);
    }
  } else if (key === 'pale_moss') {
    ctx.fillStyle = '#d5dbdb';
    ctx.fillRect(x + 4, y + 4, w - 8, 12);
    // Tiny Open Eyeblossom accent
    ctx.fillStyle = '#f97316';
    ctx.fillRect(block.x - 4, y + 6, 8, 5);
  } else if (key === 'creaking_heart') {
    const pulse = 0.7 + Math.sin(stageTime * 6) * 0.3;
    ctx.fillStyle = pal.dark;
    for (let sx = x + 8; sx < x + w - 8; sx += 14) {
      ctx.fillRect(sx, y + 4, 4, h - 8);
    }
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 14 * pulse;
    ctx.fillStyle = '#f97316';
    ctx.fillRect(block.x - 12, y + h * 0.5 - 12, 24, 24);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(block.x - 6, y + h * 0.5 - 6, 12, 12);
  } else if (key === 'rocket_corp_wall') {
    ctx.fillStyle = '#ff6b00';
    ctx.beginPath();
    ctx.moveTo(block.x, y + 14);
    ctx.lineTo(block.x + 14, y + h - 14);
    ctx.lineTo(block.x - 14, y + h - 14);
    ctx.closePath();
    ctx.fill();
  } else if (key === 'lava') {
    const wave = Math.sin(stageTime * 5 + block.x * 0.04) * 5;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x + 6, y + 10 + wave, w - 12, 10);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(x + 10, y + 34 - wave * 0.6, w - 20, 12);
  } else if (key === 'sketch_block') {
    ctx.strokeStyle = '#ff7700';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    ctx.setLineDash([]);
  } else if (key === 'obsidian') {
    ctx.fillStyle = '#7e22ce';
    ctx.fillRect(x + 12, y + 16, 8, 8);
    ctx.fillRect(x + w - 22, y + h - 22, 8, 8);
  } else if (key === 'gold_block') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 10, y + 10, 12, 5);
    ctx.fillRect(x + 10, y + 10, 5, 12);
  }

  ctx.shadowBlur = 0;
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

export function drawCreativeBlocks2D(ctx, blocks, stageTime = 0) {
  if (!Array.isArray(blocks) || blocks.length === 0) return;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b && !b.broken) drawCreativeBlockSingle2D(ctx, b, stageTime);
  }
}

// ----------------------------------------------------------------------------
// Floating Island Underside & Cliff Helper
// ----------------------------------------------------------------------------
export function drawFloatingIslandBody2D(ctx, groundY, topFill, bodyFill, trimStroke, stageTime = 0) {
  const halfX = ISLAND_FLOOR_BOUNDS.halfX; // 980
  ctx.save();

  // Tapered craggy floating island cliff mass below groundY
  ctx.fillStyle = bodyFill;
  ctx.beginPath();
  ctx.moveTo(-halfX, groundY);
  ctx.lineTo(halfX, groundY);
  ctx.lineTo(halfX - 48, groundY + 75);
  ctx.lineTo(halfX - 190, groundY + 150);
  ctx.lineTo(420, groundY + 215);
  ctx.lineTo(140, groundY + 250);
  ctx.lineTo(0, groundY + 285);
  ctx.lineTo(-160, groundY + 245);
  ctx.lineTo(-450, groundY + 210);
  ctx.lineTo(-halfX + 180, groundY + 145);
  ctx.lineTo(-halfX + 45, groundY + 72);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = trimStroke;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Top turf / stone cap strip spanning [-980, +980]
  ctx.fillStyle = topFill;
  ctx.fillRect(-halfX, groundY - 4, halfX * 2, 22);
  ctx.strokeStyle = trimStroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-halfX, groundY);
  ctx.lineTo(halfX, groundY);
  ctx.stroke();

  // Subtle void-drop edge beacons at x = -980 and x = +980
  const pulse = 0.45 + Math.sin(stageTime * 5) * 0.25;
  ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;
  ctx.fillRect(-halfX - 4, groundY - 22, 8, 22);
  ctx.fillRect(halfX - 4, groundY - 22, 8, 22);

  ctx.restore();
}

// ----------------------------------------------------------------------------
// Stage 7 (Minecraft Nether Core): Lava Sea & Glowing Lava Hazard Pools
// ----------------------------------------------------------------------------
export function drawMinecraftLavaFeatures2D(stageManager, ctx, groundY) {
  const t = stageManager.stageTime || 0;
  const halfX = ISLAND_FLOOR_BOUNDS.halfX;
  const seaMinX = stageManager.bounds.minX - 1600;
  const seaMaxX = stageManager.bounds.maxX + 1600;

  ctx.save();

  // 1. Deep Bubbling Lava Sea below the Nether Fortress Island
  const lavaTop = groundY + 135;
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(seaMinX, lavaTop, seaMaxX - seaMinX, 900);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(seaMinX, lavaTop, seaMaxX - seaMinX, 42);

  ctx.fillStyle = '#facc15';
  for (let i = -18; i <= 18; i++) {
    const wx = i * 145 + Math.sin(t * 2.2 + i) * 24;
    const wy = lavaTop + 6 + Math.cos(t * 3.4 + i * 1.7) * 4;
    ctx.fillRect(wx - 42, wy, 84, 7);
  }

  // Open lava sea channels immediately outside the island cliffs (|x| > 980)
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(seaMinX, groundY + 18, (-halfX) - seaMinX, lavaTop - groundY);
  ctx.fillRect(halfX, groundY + 18, seaMaxX - halfX, lavaTop - groundY);

  // Nether Fortress Bridge Island (-980..+980)
  drawFloatingIslandBody2D(ctx, groundY, '#581c28', '#2b1019', '#fb923c', t);

  // 2. Floor Lava Hazard Pools (x = -360, x = +360)
  const hazards = stageManager.lavaHazards || [];
  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i];
    const hw = (h.width || 160) * 0.5;
    const lx = h.x - hw;
    const ly = (h.y || groundY) - 6;

    // Obsidian basin lip
    ctx.fillStyle = '#18181b';
    ctx.fillRect(lx - 6, ly - 2, h.width + 12, 22);

    // Molten magma fill
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = stageManager.crowdedRender ? 0 : 16;
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(lx, ly + 2, h.width, 14);

    // Bright convection veins
    const shift = Math.sin(t * 5 + i * 2) * 14;
    ctx.fillStyle = '#fde047';
    ctx.fillRect(lx + 16 + shift, ly + 4, 38, 6);
    ctx.fillRect(lx + h.width - 58 - shift * 0.7, ly + 6, 34, 5);

    // Rising magma bubble
    const pop = (t * 2.4 + i * 0.5) % 1;
    ctx.beginPath();
    ctx.arc(h.x + Math.sin(t * 3 + i) * 28, ly + 4 - pop * 18, 4 * (1 - pop * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ----------------------------------------------------------------------------
// Bespoke 2D Stage Themes (Stages 18, 19, 20, 21, 22 + 11-Boss Trophy Room)
// ----------------------------------------------------------------------------
export function drawExpandedStageBackground2D(stageManager, ctx, groundY) {
  const theme = stageManager.theme;
  const minX = stageManager.bounds.minX;
  const maxX = stageManager.bounds.maxX;
  const minY = stageManager.bounds.minY;
  const t = stageManager.stageTime || 0;
  const backdropMinX = minX - 1600;
  const backdropMaxX = maxX + 1600;
  const backdropMinY = minY - 1000;
  const backdropMaxY = groundY + 1100;

  const paintFullVoid = (color) => {
    ctx.fillStyle = color;
    ctx.fillRect(backdropMinX, backdropMinY, backdropMaxX - backdropMinX, backdropMaxY - backdropMinY);
  };

  if (theme === 'the_end') {
    ctx.save();
    paintFullVoid('#070312');

    // Starry End Void & Nebula bands
    ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
    ctx.fillRect(backdropMinX, minY + 60, backdropMaxX - backdropMinX, 140);
    ctx.fillRect(backdropMinX, minY + 290, backdropMaxX - backdropMinX, 110);

    for (let i = 0; i < 42; i++) {
      const sx = -1250 + ((i * 197) % 2500);
      const sy = minY - 120 + ((i * 131) % 920);
      const twinkle = 0.35 + Math.sin(t * 3 + i) * 0.3;
      ctx.fillStyle = i % 3 === 0 ? `rgba(232, 121, 249, ${twinkle})` : `rgba(248, 250, 252, ${twinkle})`;
      ctx.fillRect(sx, sy, i % 4 === 0 ? 4 : 2.5, i % 4 === 0 ? 4 : 2.5);
    }

    // 6 Towering Obsidian Pillars + End Crystals
    const pillarXs = [-780, -500, -240, 240, 500, 780];
    const pillarHs = [340, 420, 370, 390, 440, 350];
    for (let i = 0; i < pillarXs.length; i++) {
      const px = pillarXs[i];
      const ph = pillarHs[i];
      const pw = i % 2 === 0 ? 64 : 74;
      const topY = groundY - ph;

      // Obsidian shaft
      ctx.fillStyle = '#12091c';
      ctx.strokeStyle = '#581c87';
      ctx.lineWidth = 2;
      ctx.fillRect(px - pw * 0.5, topY, pw, ph);
      ctx.strokeRect(px - pw * 0.5, topY, pw, ph);

      // Iron cage on pillars 1 & 4
      if (i === 1 || i === 4) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 22, topY - 38, 44, 38);
      }

      // Floating Magenta End Crystal
      const cy = topY - 22 + Math.sin(t * 4 + i) * 5;
      ctx.save();
      ctx.translate(px, cy);
      ctx.rotate(t * 1.8 + i);
      ctx.fillStyle = '#e879f9';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-10, -10, 20, 20);
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.restore();

      // Crystal Void Beam toward center sky
      ctx.strokeStyle = 'rgba(217, 70, 239, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, cy);
      ctx.lineTo(0, minY + 95);
      ctx.stroke();
    }

    // Central Bedrock Fountain & Dragon Egg Pedestal
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.fillRect(-85, groundY - 24, 170, 24);
    ctx.strokeRect(-85, groundY - 24, 170, 24);
    ctx.fillStyle = '#020617';
    ctx.fillRect(-68, groundY - 20, 136, 10);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-14, groundY - 82, 28, 60);
    // Dragon Egg
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#d946ef';
    ctx.beginPath();
    ctx.ellipse(0, groundY - 96, 14, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pale-Yellow End Stone Floating Island
    drawFloatingIslandBody2D(ctx, groundY, '#e5de9e', '#b8af72', '#fef08a', t);

    ctx.fillStyle = '#f5d0fe';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('DIMENSION://THE_END — ENDER DRAGON LAIR', minX + 60, minY + 58);
    ctx.restore();
    return true;
  }

  if (theme === 'aether') {
    ctx.save();
    const grad = ctx.createLinearGradient(0, minY - 300, 0, groundY + 600);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(0.55, '#7dd3fc');
    grad.addColorStop(1, '#fef3c7');
    paintFullVoid(grad);

    // Drifting White & Gold Aerclouds
    for (let i = 0; i < 10; i++) {
      const cx = -1100 + (((i * 260 + t * (18 + (i % 3) * 8)) % 2400) + 2400) % 2400 - 100;
      const cy = minY + 80 + (i % 4) * 145;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(253, 224, 71, 0.52)' : 'rgba(255, 255, 255, 0.65)';
      ctx.fillRect(cx - 65, cy, 130, 26);
      ctx.fillRect(cx - 42, cy - 14, 84, 16);
    }

    // Valkyrie Marble Temple Columns & Golden Oak Trees
    const treeXs = [-760, -360, 360, 760];
    for (let i = 0; i < treeXs.length; i++) {
      const tx = treeXs[i];
      // Trunk
      ctx.fillStyle = '#92400e';
      ctx.fillRect(tx - 11, groundY - 165, 22, 165);
      // Golden Oak Canopy
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(tx - 58, groundY - 235, 116, 78);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(tx - 42, groundY - 262, 84, 42);
    }

    // Center Valkyrie Marble Archway
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.fillRect(-110, groundY - 190, 26, 190);
    ctx.fillRect(84, groundY - 190, 26, 190);
    ctx.fillRect(-124, groundY - 214, 248, 26);
    ctx.strokeRect(-124, groundY - 214, 248, 26);
    // Glowing Ambrosium Torch Gem
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, groundY - 201, 9, 0, Math.PI * 2);
    ctx.fill();

    // Floating Aether Sky-Island (Teal-Gold Grass + Holystone)
    drawFloatingIslandBody2D(ctx, groundY, '#38d9a9', '#cbd5e1', '#facc15', t);

    ctx.fillStyle = '#0c4a6e';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('DIMENSION://THE_AETHER — GOLDEN SKYLANDS', minX + 60, minY + 58);
    ctx.restore();
    return true;
  }

  if (theme === 'ancient_city') {
    ctx.save();
    paintFullVoid('#030910');

    // Deep Dark Cavern grid & ruined Deepslate pillars
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.14)';
    ctx.lineWidth = 1;
    for (let x = minX; x <= maxX; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x, groundY);
      ctx.stroke();
    }

    const pillarXs = [-820, -520, 520, 820];
    for (let i = 0; i < pillarXs.length; i++) {
      const px = pillarXs[i];
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 2;
      ctx.fillRect(px - 32, minY + 90, 64, groundY - (minY + 90));
      ctx.strokeRect(px - 32, minY + 90, 64, groundY - (minY + 90));

      // Hanging Cyan Soul Lantern
      const swing = Math.sin(t * 2.5 + i) * 5;
      ctx.strokeStyle = '#52525b';
      ctx.beginPath();
      ctx.moveTo(px, groundY - 250);
      ctx.lineTo(px + swing, groundY - 215);
      ctx.stroke();
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(px + swing - 7, groundY - 215, 14, 16);
    }

    // Monumental Center Reinforced Deepslate Portal (x = 0)
    const portalW = 340;
    const portalH = 225;
    const portalTop = groundY - portalH;
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#d6d3c4'; // Bone-like Reinforced Deepslate trim
    ctx.lineWidth = 5;
    ctx.fillRect(-portalW * 0.5, portalTop, portalW, portalH);
    ctx.strokeRect(-portalW * 0.5, portalTop, portalW, portalH);

    // Inner Pulsing Cyan Sculk / Soul Veil
    const veilAlpha = 0.22 + Math.sin(t * 3.8) * 0.1;
    ctx.fillStyle = `rgba(6, 182, 212, ${veilAlpha})`;
    ctx.fillRect(-portalW * 0.5 + 28, portalTop + 28, portalW - 56, portalH - 52);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-portalW * 0.5 + 28, portalTop + 28, portalW - 56, portalH - 52);

    // Flanking Soul Fire Braziers
    for (const bx of [-215, 215]) {
      ctx.fillStyle = '#27272a';
      ctx.fillRect(bx - 18, groundY - 38, 36, 38);
      const flameH = 22 + Math.sin(t * 9 + bx) * 6;
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.moveTo(bx - 14, groundY - 38);
      ctx.lineTo(bx, groundY - 38 - flameH);
      ctx.lineTo(bx + 14, groundY - 38);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a5f3fc';
      ctx.fillRect(bx - 5, groundY - 48, 10, 10);
    }

    // Sculk Floor Veins & Wiggling Sculk Sensors
    ctx.fillStyle = '#04131c';
    ctx.fillRect(minX, groundY, maxX - minX, 340);
    for (let x = minX + 40; x < maxX - 40; x += 85) {
      const glow = 0.4 + Math.sin(t * 4 + x * 0.02) * 0.3;
      ctx.fillStyle = `rgba(34, 211, 238, ${glow})`;
      ctx.fillRect(x, groundY + 4, 24, 5);
    }
    for (const sx of [-680, -370, 370, 680]) {
      ctx.fillStyle = '#083344';
      ctx.fillRect(sx - 16, groundY - 10, 32, 10);
      const wiggle = Math.sin(t * 8 + sx) * 4;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx - 10, groundY - 10);
      ctx.lineTo(sx - 12 + wiggle, groundY - 24);
      ctx.moveTo(sx + 10, groundY - 10);
      ctx.lineTo(sx + 12 - wiggle, groundY - 24);
      ctx.stroke();
    }

    // Enclosed Deepslate Perimeter Walls
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(minX, groundY);
    ctx.lineTo(maxX, groundY);
    ctx.stroke();
    ctx.strokeStyle = '#0891b2';
    ctx.beginPath();
    ctx.moveTo(minX, minY);
    ctx.lineTo(minX, groundY);
    ctx.moveTo(maxX, minY);
    ctx.lineTo(maxX, groundY);
    ctx.stroke();

    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('DEEP_DARK://ANCIENT_CITY — SILENCE REQUIRED', minX + 60, minY + 58);
    ctx.restore();
    return true;
  }

  if (theme === 'pale_garden') {
    ctx.save();
    const grad = ctx.createLinearGradient(0, minY - 200, 0, groundY + 200);
    grad.addColorStop(0, '#12161c');
    grad.addColorStop(0.65, '#1f252e');
    grad.addColorStop(1, '#2c333d');
    paintFullVoid(grad);

    // Drifting Haunted Silver Mist Banks
    for (let i = 0; i < 7; i++) {
      const mx = -1150 + (((i * 340 + t * (14 + (i % 3) * 6)) % 2500) + 2500) % 2500 - 120;
      const my = groundY - 90 - (i % 3) * 85;
      ctx.fillStyle = 'rgba(203, 213, 225, 0.08)';
      ctx.fillRect(mx - 140, my, 280, 34);
    }

    // 6 Twisted Pale Oak Trees + Swaying Pale Hanging Moss
    const oakXs = [-840, -560, -300, 300, 560, 840];
    for (let i = 0; i < oakXs.length; i++) {
      const ox = oakXs[i];
      const lean = (i % 2 === 0 ? -1 : 1) * 14;
      // Pale grey-white trunk
      ctx.fillStyle = '#94a3b8';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox - 20, groundY);
      ctx.lineTo(ox - 14 + lean, groundY - 255);
      ctx.lineTo(ox + 14 + lean, groundY - 255);
      ctx.lineTo(ox + 20, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Desaturated Pale Oak Canopy
      ctx.fillStyle = '#64748b';
      ctx.fillRect(ox - 78 + lean, groundY - 310, 156, 62);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(ox - 56 + lean, groundY - 332, 112, 30);

      // Swaying Pale Hanging Moss curtains
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      const sway = Math.sin(t * 2.2 + i) * 6;
      for (let m = -2; m <= 2; m++) {
        const mx = ox + lean + m * 26;
        const mh = 42 + ((i + Math.abs(m)) % 3) * 20;
        ctx.beginPath();
        ctx.moveTo(mx, groundY - 248);
        ctx.lineTo(mx + sway, groundY - 248 + mh);
        ctx.stroke();
      }
    }

    // Center Ancient Pale Oak & Suspended Creaking Heart Shrine (x = 0)
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.fillRect(-68, groundY - 250, 38, 250);
    ctx.fillRect(30, groundY - 250, 38, 250);
    ctx.fillRect(-84, groundY - 274, 168, 32);
    ctx.strokeRect(-84, groundY - 274, 168, 32);

    // Rotating Resin Ring + Pulsing Orange Creaking Heart at (0, groundY - 165)
    const heartY = groundY - 165;
    const pulse = 0.82 + Math.sin(t * 6.5) * 0.18;
    ctx.save();
    ctx.translate(0, heartY);
    ctx.rotate(t * 1.4);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.72)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-26, -26, 52, 52);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = stageManager.crowdedRender ? 0 : 22 * pulse;
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(-16 * pulse, heartY - 18 * pulse, 32 * pulse, 36 * pulse);
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(-10 * pulse, heartY - 12 * pulse, 20 * pulse, 24 * pulse);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-5, heartY - 5, 10, 10);
    ctx.restore();

    // Pale Moss Floor + Glowing Orange Open Eyeblossoms
    ctx.fillStyle = '#475569';
    ctx.fillRect(minX, groundY, maxX - minX, 340);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(minX, groundY, maxX - minX, 12);

    const blossomXs = [-910, -700, -440, -180, 180, 440, 700, 910];
    for (let i = 0; i < blossomXs.length; i++) {
      const bx = blossomXs[i];
      ctx.fillStyle = '#64748b';
      ctx.fillRect(bx - 5, groundY - 12, 10, 12);
      const blink = Math.sin(t * 3.5 + i * 1.9) > -0.82;
      if (blink) {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(bx, groundY - 14, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(bx - 1.5, groundY - 16, 3, 4);
      }
    }

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(minX, groundY);
    ctx.lineTo(maxX, groundY);
    ctx.stroke();
    ctx.strokeStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(minX, minY);
    ctx.lineTo(minX, groundY);
    ctx.moveTo(maxX, minY);
    ctx.lineTo(maxX, groundY);
    ctx.stroke();

    ctx.fillStyle = '#fdba74';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('BIOME://PALE_GARDEN — KEEP EYES ON THE CREAKING', minX + 60, minY + 58);
    ctx.restore();
    return true;
  }

  if (theme === 'rocket_corp') {
    ctx.save();
    paintFullVoid('#0f172a');

    // Brushed Steel Facility Panels & Structural I-Beams
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(minX, minY, maxX - minX, groundY - minY);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 2;
    for (let x = minX; x <= maxX; x += 140) {
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x, groundY);
      ctx.stroke();
    }

    // Upper VIP Observation Window + Victim's Dark-Grey Silhouette
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.fillRect(-260, minY + 70, 520, 96);
    ctx.strokeRect(-260, minY + 70, 520, 96);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.fillRect(-254, minY + 76, 508, 84);
    // Victim Silhouette watching from above
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, minY + 114, 9, 0, Math.PI * 2);
    ctx.moveTo(0, minY + 123);
    ctx.lineTo(0, minY + 154);
    ctx.moveTo(-11, minY + 134);
    ctx.lineTo(11, minY + 134);
    ctx.stroke();

    // Giant Rocket Corp Orange Triangle-Delta Emblem
    ctx.strokeStyle = '#ff6b00';
    ctx.fillStyle = 'rgba(255, 107, 0, 0.14)';
    ctx.lineWidth = 5;
    for (const ex of [-440, 440]) {
      ctx.beginPath();
      ctx.moveTo(ex, minY + 92);
      ctx.lineTo(ex + 46, minY + 168);
      ctx.lineTo(ex - 46, minY + 168);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Centerpiece: "THE BOX" Darkened Glass Containment Chamber
    const boxW = 280;
    const boxH = 195;
    const boxTop = groundY - boxH;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.fillRect(-boxW * 0.5, boxTop, boxW, boxH);
    ctx.strokeRect(-boxW * 0.5, boxTop, boxW, boxH);

    // Cyan Containment Emitters on all 4 corners + Horizontal Scanline
    const scanY = boxTop + ((t * 65) % boxH);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.fillRect(-boxW * 0.5 + 4, scanY, boxW - 8, 3);
    ctx.fillStyle = '#38bdf8';
    for (const [cx, cy] of [
      [-boxW * 0.5, boxTop],
      [boxW * 0.5 - 12, boxTop],
      [-boxW * 0.5, groundY - 12],
      [boxW * 0.5 - 12, groundY - 12]
    ]) {
      ctx.fillRect(cx, cy, 12, 12);
    }

    // Cyan Stasis Tubes & Parked Hover-Bikes
    for (const tx of [-780, 780]) {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.fillRect(tx - 32, groundY - 165, 64, 165);
      ctx.strokeRect(tx - 32, groundY - 165, 64, 165);
      ctx.fillStyle = '#334155';
      ctx.fillRect(tx - 38, groundY - 175, 76, 14);
      ctx.fillRect(tx - 38, groundY - 14, 76, 14);
    }
    for (const bx of [-470, 470]) {
      const hover = Math.sin(t * 5 + bx) * 3;
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#ff6b00';
      ctx.lineWidth = 2;
      ctx.fillRect(bx - 36, groundY - 28 + hover, 72, 14);
      ctx.strokeRect(bx - 36, groundY - 28 + hover, 72, 14);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(bx - 28, groundY - 12 + hover, 56, 4);
    }

    // Industrial Floor + Yellow/Black Hazard Chevron Stripes
    ctx.fillStyle = '#090d16';
    ctx.fillRect(minX - 400, groundY, maxX - minX + 800, 400);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(minX, groundY, maxX - minX, 26);
    for (let x = minX; x < maxX; x += 48) {
      ctx.fillStyle = ((x / 48) & 1) === 0 ? '#facc15' : '#111827';
      ctx.fillRect(x, groundY + 2, 24, 10);
    }

    ctx.strokeStyle = '#ff6b00';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(minX, minY);
    ctx.lineTo(minX, groundY);
    ctx.moveTo(maxX, minY);
    ctx.lineTo(maxX, groundY);
    ctx.stroke();

    ctx.fillStyle = '#ff6b00';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('FACILITY://ROCKET_CORP_HQ — CONTAINMENT SECTOR "THE BOX"', minX + 60, minY + 58);
    ctx.restore();
    return true;
  }

  return false;
}

// ----------------------------------------------------------------------------
// 11-Boss Trophy Room Pedestal Renderer (Clean Spacing Across -900..+900)
// ----------------------------------------------------------------------------
export function drawExpandedTrophyIcons2D(stageManager, ctx, groundY) {
  const icons = stageManager.desktopIcons || [];
  if (!stageManager.isTrophyRoom || icons.length === 0) return false;
  const t = stageManager.stageTime || 0;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i];
    const w = 132;
    const h = 68;
    const top = icon.y - 54;
    const color = icon.color || '#ffd54a';

    // Golden spotlight cone
    ctx.fillStyle = 'rgba(255, 213, 74, 0.06)';
    ctx.beginPath();
    ctx.moveTo(icon.x - 24, top - 90);
    ctx.lineTo(icon.x + 24, top - 90);
    ctx.lineTo(icon.x + w * 0.55, groundY);
    ctx.lineTo(icon.x - w * 0.55, groundY);
    ctx.closePath();
    ctx.fill();

    // Marble/Gold Pedestal Base reaching groundY
    ctx.fillStyle = '#071c3d';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillRect(icon.x - 36, top + h, 72, Math.max(8, groundY - (top + h)));
    ctx.strokeRect(icon.x - 36, top + h, 72, Math.max(8, groundY - (top + h)));

    // Plaque Frame
    ctx.fillStyle = 'rgba(3, 15, 38, 0.94)';
    ctx.fillRect(icon.x - w * 0.5, top, w, h);
    ctx.strokeRect(icon.x - w * 0.5, top, w, h);

    // Floating Boss Crest
    const bob = Math.sin(t * 3 + i * 0.7) * 2.5;
    ctx.fillStyle = color;
    ctx.font = "900 18px 'Bungee', Impact, sans-serif";
    ctx.fillText(icon.icon, icon.x, icon.y - 25 + bob);

    ctx.fillStyle = '#fff1a8';
    ctx.font = "bold 9.5px 'Trebuchet MS', sans-serif";
    ctx.fillText(icon.label, icon.x, icon.y + 4);
  }

  ctx.restore();
  return true;
}

// ----------------------------------------------------------------------------
// 2D Floor Telegraph Rings & Danger Lanes for Expanded Campaign Bosses
// ----------------------------------------------------------------------------
export function drawBossFloorTelegraphs2D(ctx, zombies, groundY, stageTime = 0) {
  if (!Array.isArray(zombies) || zombies.length === 0) return;
  const pulse = 0.45 + Math.sin(stageTime * 16) * 0.25;

  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z || z.isDead) continue;

    // 1. Drop / Root / Breath / Seismic Slam multi-circle floor telegraphs
    if (
      (z.state === 'breath_windup' || z.state === 'slam_windup' || z.state === 'roots_windup') &&
      z.dropXs
    ) {
      const color = z.type === 'ender_dragon' ? '#e879f9' : (z.type === 'warden_boss' ? '#22d3ee' : '#f97316');
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 3;
      for (let k = 0; k < z.dropXs.length; k++) {
        const bx = z.dropXs[k];
        ctx.globalAlpha = pulse * 0.25;
        ctx.beginPath();
        ctx.ellipse(bx, groundY - 4, 72, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(bx, groundY - 4, 72, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Horizontal Lane Telegraphs (Swoop, Warden Sonic Boom, Warden Charge, Creaking Blink)
    if (
      z.state === 'swoop_windup' ||
      z.state === 'charge_windup' ||
      z.state === 'blink_windup' ||
      z.state === 'sonic_windup'
    ) {
      const color = z.type === 'ender_dragon'
        ? '#d946ef'
        : (z.type === 'warden_boss' ? '#22d3ee' : '#f97316');
      const startX = z.x;
      const endX = z.state === 'sonic_windup'
        ? z.x + (z.facing || 1) * 760
        : (z.rollTargetX ?? (z.x + (z.facing || 1) * 280));
      const left = Math.min(startX, endX);
      const width = Math.max(40, Math.abs(endX - startX));
      const laneY = z.state === 'sonic_windup' ? groundY - 72 : groundY - 18;

      ctx.save();
      ctx.globalAlpha = pulse * 0.32;
      ctx.fillStyle = color;
      ctx.fillRect(left, laneY, width, z.state === 'sonic_windup' ? 32 : 16);
      ctx.globalAlpha = 0.88;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(left, laneY, width, z.state === 'sonic_windup' ? 32 : 16);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 3. Mercenary Hazard High-Voltage Target Ring
    if (z.type === 'mercenary_hazard' && z.state === 'ranged_windup') {
      ctx.save();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(z.rollTargetX, groundY - 4, 74, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "900 14px 'Bungee', Impact, sans-serif";
      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'center';
      ctx.fillText('⚠', z.rollTargetX, groundY - 22);
      ctx.restore();
    }
  }
}

export function drawCustomStagePlatforms2D(stageManager, ctx, platforms) {
  const theme = stageManager.theme;
  if (
    theme !== 'the_end' &&
    theme !== 'aether' &&
    theme !== 'ancient_city' &&
    theme !== 'pale_garden' &&
    theme !== 'rocket_corp'
  ) {
    return false;
  }

  const t = stageManager.stageTime || 0;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (!p || p.appType === 'creative') continue;
    const halfW = p.width * 0.5;
    const topY = p.y - p.height;

    ctx.save();
    if (theme === 'the_end') {
      ctx.fillStyle = '#2d123f';
      ctx.strokeStyle = '#d946ef';
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(p.x - halfW + 2, topY + 2, p.width - 4, 5);
    } else if (theme === 'aether') {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(p.x - halfW + 2, topY + 2, p.width - 4, 5);
    } else if (theme === 'ancient_city') {
      ctx.fillStyle = '#09151d';
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);
      const pulse = 0.55 + Math.sin(t * 4 + p.x * 0.02) * 0.35;
      ctx.fillStyle = `rgba(34, 211, 238, ${pulse})`;
      for (let sx = p.x - halfW + 14; sx < p.x + halfW - 14; sx += 28) {
        ctx.fillRect(sx, topY + 3, 12, 4);
      }
    } else if (theme === 'pale_garden') {
      ctx.fillStyle = '#474d54';
      ctx.strokeStyle = '#aeb6bf';
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);
      ctx.fillStyle = '#cfd6dc';
      ctx.fillRect(p.x - halfW + 2, topY + 2, p.width - 4, 6);
      // Hanging pale moss strands below bough
      ctx.strokeStyle = 'rgba(195, 204, 212, 0.72)';
      ctx.lineWidth = 2;
      for (let mx = p.x - halfW + 18; mx < p.x + halfW - 14; mx += 34) {
        const sway = Math.sin(t * 1.8 + mx * 0.05) * 4;
        ctx.beginPath();
        ctx.moveTo(mx, p.y);
        ctx.lineTo(mx + sway, p.y + 18 + ((Math.abs(mx) | 0) % 10));
        ctx.stroke();
      }
    } else if (theme === 'rocket_corp') {
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#ff6b00';
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);
      ctx.fillStyle = '#ff6b00';
      for (let cx = p.x - halfW + 8; cx < p.x + halfW - 14; cx += 24) {
        ctx.fillRect(cx, topY + 3, 12, 4);
      }
    }
    ctx.restore();
  }
  return true;
}

