import * as THREE from '../lib/three.module.min.js';

const TEXTURE_CACHE = new Map();

function hash2D(x, y, seed = 1) {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 1442695041, 0x9E3779B1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85EBCA6B);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967295;
}

function shadeHex(hex, factor) {
  const num = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((num & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

export function getVoxelTexture(kind, repeatX = 1, repeatY = 1) {
  const key = `${kind}:${repeatX}:${repeatY}`;
  if (TEXTURE_CACHE.has(key)) return TEXTURE_CACHE.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  drawPixelBlock(ctx, kind);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  TEXTURE_CACHE.set(key, tex);
  return tex;
}

function fillNoisyPixels(ctx, baseHex, variance = 0.14, seed = 1) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = (hash2D(x, y, seed) - 0.5) * 2 * variance;
      ctx.fillStyle = shadeHex(baseHex, 1 + n);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawBevelBorder(ctx, lightHex, darkHex) {
  ctx.fillStyle = lightHex;
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
  ctx.fillStyle = darkHex;
  ctx.fillRect(0, 15, 16, 1);
  ctx.fillRect(15, 0, 1, 16);
}

function drawPixelBlock(ctx, kind) {
  switch (kind) {
    case 'desktop_floor': {
      fillNoisyPixels(ctx, '#1e3a5f', 0.12, 10);
      drawBevelBorder(ctx, '#2b548a', '#10223b');
      ctx.fillStyle = 'rgba(103, 232, 249, 0.18)';
      ctx.fillRect(2, 2, 12, 1);
      break;
    }
    case 'animate_floor': {
      fillNoisyPixels(ctx, '#2d3142', 0.1, 20);
      drawBevelBorder(ctx, '#434963', '#1b1e29');
      ctx.fillStyle = '#ff7700';
      ctx.fillRect(7, 0, 2, 3);
      ctx.fillRect(7, 13, 2, 3);
      break;
    }
    case 'downloads_floor': {
      fillNoisyPixels(ctx, '#1b354f', 0.14, 30);
      drawBevelBorder(ctx, '#2b5780', '#0e1d2b');
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(3, 7, 10, 2);
      break;
    }
    case 'firewall_floor': {
      fillNoisyPixels(ctx, '#1f1924', 0.14, 40);
      drawBevelBorder(ctx, '#ff3344', '#0f0b12');
      ctx.fillStyle = '#ff3344';
      ctx.fillRect(7, 7, 2, 2);
      break;
    }
    case 'bsod_floor': {
      fillNoisyPixels(ctx, '#0047b3', 0.09, 50);
      drawBevelBorder(ctx, '#38bdf8', '#002666');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(4, 9, 2, 2);
      ctx.fillRect(9, 4, 2, 7);
      break;
    }
    case 'recycle_floor': {
      fillNoisyPixels(ctx, '#1d3640', 0.15, 60);
      drawBevelBorder(ctx, '#4db6ac', '#0d1b21');
      break;
    }
    case 'netherrack': {
      fillNoisyPixels(ctx, '#6e262b', 0.25, 70);
      for (let i = 0; i < 18; i++) {
        const x = (i * 5) % 15;
        const y = (i * 9) % 15;
        ctx.fillStyle = i % 2 === 0 ? '#4a1519' : '#8f353b';
        ctx.fillRect(x, y, 2, 1);
      }
      break;
    }
    case 'obsidian': {
      fillNoisyPixels(ctx, '#171026', 0.2, 75);
      ctx.fillStyle = '#3b235e';
      ctx.fillRect(3, 4, 3, 2);
      ctx.fillRect(10, 11, 3, 2);
      drawBevelBorder(ctx, '#2f1d4f', '#090611');
      break;
    }
    case 'lava': {
      fillNoisyPixels(ctx, '#ff5500', 0.22, 78);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(2, 3, 5, 3);
      ctx.fillRect(9, 10, 4, 3);
      ctx.fillStyle = '#ffee55';
      ctx.fillRect(3, 4, 2, 1);
      ctx.fillRect(10, 11, 2, 1);
      break;
    }
    case 'terminal_floor': {
      fillNoisyPixels(ctx, '#081c10', 0.12, 80);
      drawBevelBorder(ctx, '#22c55e', '#030d07');
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(3, 3, 2, 5);
      ctx.fillRect(8, 8, 4, 2);
      break;
    }
    case 'virabot_floor': {
      fillNoisyPixels(ctx, '#210d2b', 0.18, 90);
      drawBevelBorder(ctx, '#f43f5e', '#110517');
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(6, 6, 4, 4);
      break;
    }
    case 'dark_core_floor': {
      fillNoisyPixels(ctx, '#1f030b', 0.18, 100);
      drawBevelBorder(ctx, '#ff0033', '#0a0003');
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(0, 7, 16, 2);
      ctx.fillRect(7, 0, 2, 16);
      break;
    }
    case 'command_block': {
      fillNoisyPixels(ctx, '#c87d4b', 0.14, 110);
      drawBevelBorder(ctx, '#e7a16c', '#78421e');
      ctx.fillStyle = '#9c592d';
      ctx.fillRect(7, 1, 2, 3);
      ctx.fillRect(7, 12, 2, 3);
      ctx.fillRect(1, 7, 3, 2);
      ctx.fillRect(12, 7, 3, 2);
      ctx.fillStyle = '#5c3116';
      ctx.fillRect(2, 2, 1, 1);
      ctx.fillRect(13, 2, 1, 1);
      ctx.fillRect(2, 13, 1, 1);
      ctx.fillRect(13, 13, 1, 1);
      // Chamfered octagonal dark-slate control housing + multicolor buttons
      ctx.fillStyle = '#3b2a1e';
      ctx.fillRect(5, 3, 6, 10);
      ctx.fillRect(3, 5, 10, 6);
      ctx.fillStyle = '#261b13';
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = '#ffaa33';
      ctx.fillRect(5, 5, 2, 2);
      ctx.fillStyle = '#5ce1e6';
      ctx.fillRect(9, 5, 2, 2);
      ctx.fillStyle = '#ff5757';
      ctx.fillRect(5, 9, 2, 2);
      ctx.fillStyle = '#7ed957';
      ctx.fillRect(9, 9, 2, 2);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(7, 7, 2, 2);
      break;
    }
    case 'gold_block': {
      fillNoisyPixels(ctx, '#eab308', 0.12, 115);
      drawBevelBorder(ctx, '#fef08a', '#a16207');
      ctx.fillStyle = '#fde047';
      ctx.fillRect(2, 2, 12, 1);
      ctx.fillRect(2, 2, 1, 12);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(2, 13, 12, 1);
      ctx.fillRect(13, 2, 1, 12);
      ctx.fillStyle = '#fef08a';
      for (let i = 3; i <= 11; i++) {
        ctx.fillRect(i, 14 - i, 2, 1);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 4, 2, 2);
      break;
    }
    case 'browser_floor': {
      fillNoisyPixels(ctx, '#172542', 0.14, 120);
      drawBevelBorder(ctx, '#38bdf8', '#0d1526');
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(5, 2, 2, 2);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(8, 2, 2, 2);
      break;
    }
    case 'cloud_floor': {
      fillNoisyPixels(ctx, '#d8f3ff', 0.08, 130);
      drawBevelBorder(ctx, '#ffffff', '#7dd3fc');
      break;
    }
    case 'creeper_moss': {
      fillNoisyPixels(ctx, '#5c8c38', 0.22, 150);
      drawBevelBorder(ctx, '#8cd156', '#33521d');
      ctx.fillStyle = '#3b5e21';
      ctx.fillRect(3, 4, 3, 3);
      ctx.fillRect(10, 4, 3, 3);
      ctx.fillRect(6, 7, 4, 5);
      ctx.fillRect(4, 10, 2, 4);
      ctx.fillRect(10, 10, 2, 4);
      break;
    }
    case 'cat_wool': {
      fillNoisyPixels(ctx, '#d97724', 0.16, 160);
      ctx.fillStyle = '#9c4a13';
      ctx.fillRect(0, 3, 16, 2);
      ctx.fillRect(0, 10, 16, 2);
      drawBevelBorder(ctx, '#f59e0b', '#7c370b');
      break;
    }
    case 'lucky_block': {
      fillNoisyPixels(ctx, '#facc15', 0.14, 170);
      drawBevelBorder(ctx, '#fef08a', '#b45309');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 3, 6, 2);
      ctx.fillRect(9, 5, 2, 3);
      ctx.fillRect(7, 7, 2, 3);
      ctx.fillRect(7, 11, 2, 2);
      break;
    }
    case 'zero_day_floor': {
      fillNoisyPixels(ctx, '#0b1324', 0.12, 180);
      drawBevelBorder(ctx, '#00f5ff', '#04070e');
      ctx.fillStyle = '#8cff00';
      ctx.fillRect(2, 2, 3, 1);
      ctx.fillRect(2, 2, 1, 3);
      ctx.fillRect(11, 13, 3, 1);
      ctx.fillRect(13, 11, 1, 3);
      break;
    }
    case 'white_void_floor': {
      fillNoisyPixels(ctx, '#f2efe8', 0.03, 185);
      drawBevelBorder(ctx, '#ffffff', '#cbd5e1');
      break;
    }
    case 'trophy_floor': {
      fillNoisyPixels(ctx, '#122b54', 0.1, 190);
      drawBevelBorder(ctx, '#ffd54a', '#09162e');
      ctx.fillStyle = 'rgba(255, 213, 74, 0.35)';
      ctx.fillRect(6, 6, 4, 4);
      break;
    }
    case 'sketch_block': {
      fillNoisyPixels(ctx, '#f8fafc', 0.08, 200);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 16, 2);
      ctx.fillRect(0, 14, 16, 2);
      ctx.fillRect(0, 0, 2, 16);
      ctx.fillRect(14, 0, 2, 16);
      ctx.fillStyle = '#ff7700';
      ctx.fillRect(4, 4, 8, 8);
      break;
    }
    case 'anvil_iron': {
      fillNoisyPixels(ctx, '#334155', 0.16, 210);
      drawBevelBorder(ctx, '#64748b', '#0f172a');
      break;
    }
    case 'tnt_block': {
      const stickCols = ['#dc2626', '#ef4444', '#b91c1c', '#991b1b'];
      for (let x = 0; x < 16; x++) {
        const base = stickCols[x % 4];
        for (let y = 0; y < 16; y++) {
          const n = (hash2D(x, y, 220) - 0.5) * 0.14;
          ctx.fillStyle = shadeHex(base, 1 + n);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(0, 0, 16, 1);
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(0, 15, 16, 1);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 5, 16, 6);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 10, 16, 1);
      // Crisp 1-pixel T N T
      ctx.fillStyle = '#111827';
      ctx.fillRect(1, 6, 3, 1);
      ctx.fillRect(2, 7, 1, 3);
      ctx.fillRect(5, 6, 1, 4);
      ctx.fillRect(6, 7, 1, 1);
      ctx.fillRect(7, 8, 1, 1);
      ctx.fillRect(8, 6, 1, 4);
      ctx.fillRect(11, 6, 3, 1);
      ctx.fillRect(12, 7, 1, 3);
      break;
    }
    case 'end_stone': {
      fillNoisyPixels(ctx, '#dce39c', 0.14, 230);
      for (let i = 0; i < 14; i++) {
        const x = (i * 7 + 2) % 14;
        const y = (i * 5 + 1) % 14;
        ctx.fillStyle = i % 2 === 0 ? '#b5bc76' : '#eaefb4';
        ctx.fillRect(x, y, 2, 2);
      }
      drawBevelBorder(ctx, '#eef2be', '#9ca362');
      break;
    }
    case 'purpur_block': {
      fillNoisyPixels(ctx, '#a87ca8', 0.12, 235);
      drawBevelBorder(ctx, '#c79ec7', '#785278');
      ctx.fillStyle = '#916391';
      ctx.fillRect(0, 7, 16, 2);
      ctx.fillRect(7, 0, 2, 16);
      break;
    }
    case 'end_portal': {
      fillNoisyPixels(ctx, '#06030f', 0.12, 238);
      const starCols = ['#e879f9', '#38bdf8', '#c084fc', '#ffffff'];
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = starCols[i % starCols.length];
        ctx.fillRect((i * 5 + 3) % 15, (i * 9 + 2) % 15, 1, 1);
      }
      break;
    }
    case 'aether_grass': {
      fillNoisyPixels(ctx, '#38d9a9', 0.14, 240);
      drawBevelBorder(ctx, '#63e6be', '#12b886');
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(3, 4, 2, 1);
      ctx.fillRect(11, 9, 2, 1);
      ctx.fillStyle = '#96f2d7';
      ctx.fillRect(6, 12, 3, 1);
      break;
    }
    case 'holystone': {
      fillNoisyPixels(ctx, '#cbd5e1', 0.14, 245);
      drawBevelBorder(ctx, '#f1f5f9', '#64748b');
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(4, 5, 2, 2);
      ctx.fillRect(10, 10, 2, 2);
      break;
    }
    case 'rocket_corp_floor': {
      fillNoisyPixels(ctx, '#cbd5e1', 0.06, 250);
      drawBevelBorder(ctx, '#f1f5f9', '#64748b');
      // Modular "The Box" lab tile grid cross-seam and corner rivets
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, 7, 16, 1);
      ctx.fillRect(7, 0, 1, 16);
      ctx.fillStyle = '#475569';
      ctx.fillRect(2, 2, 1, 1);
      ctx.fillRect(13, 2, 1, 1);
      ctx.fillRect(2, 13, 1, 1);
      ctx.fillRect(13, 13, 1, 1);
      break;
    }
    case 'rocket_corp_wall': {
      fillNoisyPixels(ctx, '#475569', 0.08, 252);
      drawBevelBorder(ctx, '#94a3b8', '#1e293b');
      // Gridded "The Box" containment chamber square sub-panels
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 7, 16, 2);
      ctx.fillRect(7, 0, 2, 16);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(2, 2, 4, 4);
      ctx.fillRect(10, 2, 4, 4);
      ctx.fillRect(2, 10, 4, 4);
      ctx.fillRect(10, 10, 4, 4);
      break;
    }
    case 'rocket_corp_hazard': {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#111827';
      for (let x = -16; x < 32; x += 6) {
        for (let y = 0; y < 16; y++) {
          const sx = x + y;
          if (sx >= 0 && sx < 16) {
            ctx.fillRect(sx, y, 3, 1);
          }
        }
      }
      break;
    }
    case 'sculk': {
      fillNoisyPixels(ctx, '#06141f', 0.18, 260);
      drawBevelBorder(ctx, '#0d3b4c', '#02080d');
      const pulseCols = ['#06b6d4', '#22d3ee', '#67e8f9', '#0e7490'];
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = pulseCols[i % pulseCols.length];
        ctx.fillRect((i * 5 + 2) % 14 + 1, (i * 9 + 3) % 14 + 1, 1, 1);
      }
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(3, 4, 2, 1);
      ctx.fillRect(10, 11, 2, 1);
      break;
    }
    case 'deepslate_tiles': {
      fillNoisyPixels(ctx, '#222831', 0.14, 265);
      drawBevelBorder(ctx, '#39424e', '#11151a');
      // Offset dark slate tile mortar lines & subtle fracture
      ctx.fillStyle = '#11151a';
      ctx.fillRect(0, 7, 16, 1);
      ctx.fillRect(7, 0, 1, 8);
      ctx.fillRect(3, 8, 1, 8);
      ctx.fillRect(11, 8, 1, 8);
      ctx.fillStyle = '#334155';
      ctx.fillRect(2, 2, 3, 1);
      ctx.fillRect(6, 10, 3, 1);
      break;
    }
    case 'reinforced_deepslate': {
      fillNoisyPixels(ctx, '#1b222c', 0.12, 270);
      // Bone-ivory reinforced top & bottom bands + glowing cyan sculk runes
      ctx.fillStyle = '#d6d3c4';
      ctx.fillRect(0, 0, 16, 3);
      ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#a8a29e';
      ctx.fillRect(3, 1, 2, 2);
      ctx.fillRect(11, 1, 2, 2);
      ctx.fillRect(3, 13, 2, 2);
      ctx.fillRect(11, 13, 2, 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(2, 6, 3, 4);
      ctx.fillRect(11, 6, 3, 4);
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(3, 7, 1, 2);
      ctx.fillRect(12, 7, 1, 2);
      break;
    }
    case 'pale_moss': {
      fillNoisyPixels(ctx, '#9aa1a8', 0.14, 275);
      drawBevelBorder(ctx, '#b8bec5', '#70777f');
      // Soft desaturated lichen patches & eerie silver moss tufts
      ctx.fillStyle = '#c4cad0';
      ctx.fillRect(3, 3, 3, 2);
      ctx.fillRect(10, 9, 3, 2);
      ctx.fillStyle = '#7b828a';
      ctx.fillRect(6, 12, 4, 1);
      ctx.fillRect(11, 4, 2, 2);
      break;
    }
    case 'pale_oak_log': {
      fillNoisyPixels(ctx, '#686d75', 0.15, 280);
      // Vertical pale ash bark grooves + subtle amber resin sap fleck
      ctx.fillStyle = '#494e56';
      ctx.fillRect(2, 0, 2, 16);
      ctx.fillRect(7, 0, 2, 16);
      ctx.fillRect(12, 0, 2, 16);
      ctx.fillStyle = '#878d96';
      ctx.fillRect(5, 2, 1, 12);
      ctx.fillRect(10, 3, 1, 10);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(7, 6, 2, 2);
      break;
    }
    case 'pale_oak_leaves': {
      fillNoisyPixels(ctx, '#888e96', 0.2, 285);
      drawBevelBorder(ctx, '#a8aeb6', '#5e646c');
      ctx.fillStyle = '#535860';
      ctx.fillRect(3, 4, 2, 2);
      ctx.fillRect(10, 6, 2, 2);
      ctx.fillRect(6, 11, 2, 2);
      break;
    }
    case 'creaking_heart': {
      fillNoisyPixels(ctx, '#474b52', 0.16, 290);
      drawBevelBorder(ctx, '#686d75', '#2b2e33');
      // Blazing orange Resin Heart core nested inside dark Pale Oak fissures
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(5, 5, 6, 6);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(6, 6, 4, 4);
      // Bark ribs clamping across the glowing heart
      ctx.fillStyle = '#2b2e33';
      ctx.fillRect(3, 7, 3, 2);
      ctx.fillRect(10, 7, 3, 2);
      break;
    }
    case 'resin_block': {
      fillNoisyPixels(ctx, '#ea580c', 0.16, 295);
      drawBevelBorder(ctx, '#fdba74', '#9a3412');
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(3, 3, 4, 3);
      ctx.fillRect(9, 9, 4, 3);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(4, 4, 2, 1);
      break;
    }
    default: {
      fillNoisyPixels(ctx, '#334155', 0.14, 999);
      drawBevelBorder(ctx, '#64748b', '#1e293b');
      break;
    }
  }
}

export function getThemeFloorTextureKey(theme, isWhiteVoid = false) {
  if (isWhiteVoid) return 'white_void_floor';
  switch (theme) {
    case 'desktop': return 'desktop_floor';
    case 'animate': return 'animate_floor';
    case 'downloads': return 'downloads_floor';
    case 'firewall': return 'firewall_floor';
    case 'bsod': return 'bsod_floor';
    case 'recycle': return 'recycle_floor';
    case 'minecraft': return 'netherrack';
    case 'terminal':
    case 'root_gateway': return 'terminal_floor';
    case 'virabot': return 'virabot_floor';
    case 'dark_core': return 'dark_core_floor';
    case 'command_realm': return 'command_block';
    case 'browser_glitch': return 'browser_floor';
    case 'cloud_cache': return 'cloud_floor';
    case 'creeper_clan': return 'creeper_moss';
    case 'lucky_orb': return 'lucky_block';
    case 'the_end': return 'end_stone';
    case 'aether': return 'aether_grass';
    case 'ancient_city': return 'sculk';
    case 'pale_garden': return 'pale_moss';
    case 'rocket_corp': return 'rocket_corp_floor';
    case 'zero_day': return 'zero_day_floor';
    case 'trophy': return 'trophy_floor';
    default: return 'desktop_floor';
  }
}
