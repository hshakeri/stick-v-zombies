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

function paintPixelMap(ctx, rows, palette) {
  for (let y = 0; y < 16; y++) {
    const row = rows[y];
    for (let x = 0; x < 16; x++) {
      const col = palette[row[x]];
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

export function drawPixelBlock(ctx, kind) {
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
      paintPixelMap(ctx, [
        '2233112233112210',
        '2453101245310120',
        '3564200136421010',
        '1342112213212320',
        '0110245300124531',
        '1221356411235641',
        '2432134223113420',
        '3541001134200110',
        '1320123212101231',
        '0112356400123542',
        '1233466521234652',
        '2454245332123431',
        '1342012123001210',
        '0121124531123420',
        '1232235642234530',
        '0010011210011210'
      ], {
        '0': '#07040e',
        '1': '#120a21',
        '2': '#1f1238',
        '3': '#311b59',
        '4': '#4c1d95',
        '5': '#6d28d9',
        '6': '#a855f7'
      });
      break;
    }
    case 'lava': {
      paintPixelMap(ctx, [
        '1234543210012332',
        '0124654210001243',
        '0013565321012354',
        '1001245432223465',
        '2100123454334564',
        '3210012356545432',
        '4432101246653210',
        '5654210124542100',
        '4653210012331001',
        '3442100001221012',
        '1233211012343223',
        '0124542123456543',
        '0013565334566532',
        '1001245445454321',
        '2100123333232100',
        '2210011221121001'
      ], {
        '0': '#7f1d1d',
        '1': '#9a3412',
        '2': '#c2410c',
        '3': '#ea580c',
        '4': '#f97316',
        '5': '#facc15',
        '6': '#fef08a'
      });
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
      // AvA 8 Outernet Lakeshore: Wet Canyon Slate Cobbles, Moss Tufts & Shallow Water Seams
      fillNoisyPixels(ctx, '#334155', 0.14, 100);
      drawBevelBorder(ctx, '#475569', '#1e293b');
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 7, 16, 2);
      ctx.fillRect(7, 0, 2, 16);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(3, 7, 3, 1);
      ctx.fillRect(11, 8, 3, 1);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillRect(11, 12, 3, 2);
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
      ctx.fillRect(5, 9, 2, 2);
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
      const bandCols = ['#b45309', '#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a', '#ffffff'];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = x + y;
          let idx = 3;
          if (d >= 8 && d <= 10) idx = d === 9 ? 6 : 5;
          else if (d === 7 || d === 11) idx = 4;
          else if (d >= 19 && d <= 21) idx = d === 20 ? 5 : 4;
          else if (d >= 25) idx = 0;
          else if (d >= 15 && d <= 17) idx = 1;
          const n = (hash2D(x, y, 115) - 0.5) * 0.08;
          ctx.fillStyle = shadeHex(bandCols[idx], 1 + n);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      drawBevelBorder(ctx, '#fef9c3', '#92400e');
      ctx.fillStyle = '#fde047';
      ctx.fillRect(1, 1, 14, 1);
      ctx.fillRect(1, 1, 1, 14);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(1, 14, 14, 1);
      ctx.fillRect(14, 1, 1, 14);
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
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = (x + y) % 9;
          const base = d < 2 ? '#fde047' : (d < 5 ? '#fbbf24' : '#f59e0b');
          const n = (hash2D(x, y, 170) - 0.5) * 0.08;
          ctx.fillStyle = shadeHex(base, 1 + n);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      drawBevelBorder(ctx, '#fef9c3', '#92400e');
      ctx.fillStyle = '#78350f';
      for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]]) {
        ctx.fillRect(rx, ry, 1, 1);
      }
      ctx.fillStyle = '#92400e';
      ctx.fillRect(6, 3, 6, 2);
      ctx.fillRect(5, 5, 2, 2);
      ctx.fillRect(10, 5, 2, 3);
      ctx.fillRect(8, 8, 3, 2);
      ctx.fillRect(8, 10, 2, 1);
      ctx.fillRect(8, 12, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 2, 6, 2);
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(9, 4, 2, 3);
      ctx.fillRect(7, 7, 3, 2);
      ctx.fillRect(7, 9, 2, 1);
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
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 16, 16);
      drawBevelBorder(ctx, '#ffffff', '#cbd5e1');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(1, 1, 14, 1);
      ctx.fillRect(1, 14, 14, 1);
      ctx.fillRect(1, 1, 1, 14);
      ctx.fillRect(14, 1, 1, 14);
      ctx.fillStyle = '#dbeafe';
      ctx.fillRect(2, 5, 12, 1);
      ctx.fillRect(2, 10, 12, 1);
      ctx.fillRect(5, 2, 1, 12);
      ctx.fillRect(10, 2, 1, 12);
      ctx.fillStyle = '#64748b';
      for (const [hx, hy] of [[3, 2], [2, 3], [12, 2], [13, 3], [2, 12], [3, 13], [13, 12], [12, 13]]) {
        ctx.fillRect(hx, hy, 1, 1);
      }
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(10, 4, 2, 2);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(9, 5, 2, 2);
      ctx.fillStyle = '#ff7700';
      ctx.fillRect(7, 6, 3, 3);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(5, 8, 3, 3);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(4, 10, 2, 2);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, 11, 1, 1);
      break;
    }
    case 'anvil_iron': {
      fillNoisyPixels(ctx, '#334155', 0.16, 210);
      drawBevelBorder(ctx, '#64748b', '#0f172a');
      break;
    }
    case 'tnt_block': {
      const stickShade = ['#b91c1c', '#f87171', '#dc2626', '#7f1d1d'];
      for (let x = 0; x < 16; x++) {
        const base = stickShade[x % 4];
        for (let y = 0; y < 16; y++) {
          const n = (hash2D(x, y, 220) - 0.5) * 0.1;
          ctx.fillStyle = shadeHex(base, 1 + n);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(0, 0, 16, 1);
      ctx.fillRect(0, 15, 16, 1);
      for (let x = 1; x < 16; x += 4) {
        ctx.fillStyle = '#d6d3d1';
        ctx.fillRect(x, 0, 2, 1);
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(x, 15, 2, 1);
      }
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 5, 16, 6);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 5, 16, 1);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 10, 16, 1);
      // Centered crisp T N T
      ctx.fillStyle = '#111827';
      ctx.fillRect(1, 6, 3, 1);
      ctx.fillRect(2, 7, 1, 3);
      ctx.fillRect(6, 6, 1, 4);
      ctx.fillRect(7, 7, 1, 1);
      ctx.fillRect(8, 8, 1, 1);
      ctx.fillRect(9, 6, 1, 4);
      ctx.fillRect(12, 6, 3, 1);
      ctx.fillRect(13, 7, 1, 3);
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
      fillNoisyPixels(ctx, '#a879a8', 0.1, 235);
      for (let qy = 0; qy < 16; qy += 4) {
        for (let qx = 0; qx < 16; qx += 4) {
          ctx.fillStyle = '#d8b4d8';
          ctx.fillRect(qx, qy, 4, 1);
          ctx.fillRect(qx, qy, 1, 4);
          ctx.fillStyle = '#6b426b';
          ctx.fillRect(qx, qy + 3, 4, 1);
          ctx.fillRect(qx + 3, qy, 1, 4);
          if (((qx + qy) / 4) % 2 === 1) {
            ctx.fillStyle = '#b589b5';
            ctx.fillRect(qx + 1, qy + 1, 2, 2);
          }
        }
      }
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
      paintPixelMap(ctx, [
        '3332033332033320',
        '3442034432034320',
        '2211023321022110',
        '0000101100100001',
        '3320334432033432',
        '4420344321034432',
        '2110221105602211',
        '0015600016510000',
        '3325333201033432',
        '4320344203324431',
        '2110233103422210',
        '0001011056210001',
        '3432033263103342',
        '4431034200013442',
        '2210122103322211',
        '0100001002110010'
      ], {
        '0': '#64748b',
        '1': '#94a3b8',
        '2': '#cbd5e1',
        '3': '#e2e8f0',
        '4': '#f8fafc',
        '5': '#eab308',
        '6': '#fef08a'
      });
      break;
    }
    case 'rocket_corp_floor': {
      fillNoisyPixels(ctx, '#cbd5e1', 0.06, 250);
      drawBevelBorder(ctx, '#f1f5f9', '#64748b');
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
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const sheen = ((x + y) % 7 === 0) ? '#64748b' : '#475569';
          const n = (hash2D(x, y, 252) - 0.5) * 0.06;
          ctx.fillStyle = shadeHex(sheen, 1 + n);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      drawBevelBorder(ctx, '#94a3b8', '#0f172a');
      for (let x = 2; x < 14; x += 4) {
        ctx.fillStyle = '#ff6b00';
        ctx.fillRect(x, 1, 2, 1);
        ctx.fillRect(x, 14, 2, 1);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 2, 1, 2, 1);
        ctx.fillRect(x + 2, 14, 2, 1);
      }
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = '#ff6b00';
      ctx.fillRect(7, 4, 2, 2);
      ctx.fillRect(7, 10, 2, 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(6, 6, 4, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(7, 7, 2, 2);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(5, 9, 2, 2);
      ctx.fillRect(9, 9, 2, 2);
      for (const [bx, by] of [[2, 3], [13, 3], [2, 12], [13, 12]]) {
        ctx.fillRect(bx, by, 1, 1);
      }
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
      paintPixelMap(ctx, [
        '2100122100121001',
        '1231011002310012',
        '0153000123421001',
        '0021010012100120',
        '1000134100010252',
        '2100246201000131',
        '1210123100121000',
        '0001000012342001',
        '0123100123531012',
        '1245201001210023',
        '0123100010001242',
        '0001001231001363',
        '1000012452100131',
        '2101001231010010',
        '1232100010021001',
        '0121001100122100'
      ], {
        '0': '#030b12',
        '1': '#061621',
        '2': '#0b2636',
        '3': '#0e4f68',
        '4': '#06b6d4',
        '5': '#22d3ee',
        '6': '#a5f3fc'
      });
      break;
    }
    case 'deepslate_tiles': {
      fillNoisyPixels(ctx, '#2f3744', 0.1, 265);
      const courses = [
        { y: 0, joints: [7, 15] },
        { y: 4, joints: [3, 11] },
        { y: 8, joints: [6, 14] },
        { y: 12, joints: [2, 10] }
      ];
      for (const { y, joints } of courses) {
        ctx.fillStyle = '#11151c';
        ctx.fillRect(0, y + 3, 16, 1);
        ctx.fillStyle = '#586477';
        ctx.fillRect(0, y, 16, 1);
        for (const jx of joints) {
          ctx.fillStyle = '#11151c';
          ctx.fillRect(jx, y, 1, 4);
          ctx.fillStyle = '#6b788d';
          ctx.fillRect((jx + 1) % 16, y, 1, 3);
          ctx.fillStyle = '#1e242e';
          ctx.fillRect((jx + 15) % 16, y + 1, 1, 2);
        }
      }
      break;
    }
    case 'reinforced_deepslate': {
      fillNoisyPixels(ctx, '#1b222c', 0.12, 270);
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
      paintPixelMap(ctx, [
        '2332123443212332',
        '3443212343101233',
        '2332101221112343',
        '1221222112323442',
        '2343343223432331',
        '3454344312321121',
        '2343223201110012',
        '1121112112221233',
        '1232233223432344',
        '2343345434431233',
        '2332234322320122',
        '1121012111100123',
        '2232123322212343',
        '3443234543323442',
        '2332123432212231',
        '1121011211001121'
      ], {
        '0': '#646c75',
        '1': '#7c858e',
        '2': '#969fa8',
        '3': '#aeb7c0',
        '4': '#c7cfd7',
        '5': '#e2e8f0'
      });
      break;
    }
    case 'pale_oak_log': {
      paintPixelMap(ctx, [
        '1342023431024431',
        '1342023421024321',
        '0231012320123320',
        '0232102310134310',
        '1343101210244210',
        '1443200011243201',
        '1342100021133101',
        '0232101232022102',
        '0233212342012213',
        '1344212443101223',
        '1343201343100012',
        '0232101232010012',
        '0122112331012223',
        '1233212442123433',
        '1344201343123442',
        '1233101232112332'
      ], {
        '0': '#2d3138',
        '1': '#494f59',
        '2': '#68707c',
        '3': '#88919e',
        '4': '#aeb6c2'
      });
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
      paintPixelMap(ctx, [
        '1210210340120121',
        '1201200453021021',
        '0102103564012010',
        '0112034675302110',
        '1221045786401221',
        '1210357898640121',
        '0000124798520000',
        '0011103687401110',
        '0122035798630220',
        '1210046898740011',
        '1201035787530101',
        '0102104676401200',
        '0112103564301210',
        '1221000453001221',
        '1210210340120121',
        '0110220030220110'
      ], {
        '0': '#1f2228',
        '1': '#323640',
        '2': '#4a505c',
        '3': '#9a3412',
        '4': '#c2410c',
        '5': '#ea580c',
        '6': '#f97316',
        '7': '#fb923c',
        '8': '#fde047',
        '9': '#fef9c3'
      });
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
    case 'youtube_floor': {
      fillNoisyPixels(ctx, '#18181b', 0.08, 305);
      drawBevelBorder(ctx, '#27272a', '#09090b');
      ctx.fillStyle = '#ff0033';
      ctx.fillRect(1, 14, 10, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(11, 14, 2, 1);
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(13, 14, 2, 1);
      break;
    }
    case 'chrome_floor': {
      fillNoisyPixels(ctx, '#292a2d', 0.06, 315);
      drawBevelBorder(ctx, '#3c4043', '#171717');
      ctx.fillStyle = '#4285f4';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillStyle = '#ea4335';
      ctx.fillRect(12, 2, 2, 2);
      ctx.fillStyle = '#fbbc05';
      ctx.fillRect(12, 12, 2, 2);
      ctx.fillStyle = '#34a853';
      ctx.fillRect(2, 12, 2, 2);
      break;
    }
    case 'spotify_floor': {
      fillNoisyPixels(ctx, '#121212', 0.07, 325);
      drawBevelBorder(ctx, '#27272a', '#09090b');
      const eqHeights = [4, 9, 6, 11];
      for (let i = 0; i < 4; i++) {
        const bx = 2 + i * 3;
        const bh = eqHeights[i];
        ctx.fillStyle = '#1db954';
        ctx.fillRect(bx, 14 - bh, 2, bh);
        ctx.fillStyle = '#86efac';
        ctx.fillRect(bx, 13 - bh, 2, 1);
      }
      break;
    }
    case 'slides_floor': {
      fillNoisyPixels(ctx, '#f8f9fa', 0.03, 335);
      drawBevelBorder(ctx, '#ffffff', '#dadce0');
      ctx.fillStyle = '#e8eaed';
      ctx.fillRect(0, 7, 16, 1);
      ctx.fillRect(7, 0, 1, 16);
      ctx.fillStyle = '#fbbc04';
      ctx.fillRect(2, 2, 3, 2);
      ctx.fillStyle = '#4285f4';
      ctx.fillRect(12, 12, 2, 2);
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
    case 'youtube': return 'youtube_floor';
    case 'chrome': return 'chrome_floor';
    case 'spotify': return 'spotify_floor';
    case 'slides': return 'slides_floor';
    case 'rocket_corp': return 'rocket_corp_floor';
    case 'zero_day': return 'zero_day_floor';
    case 'trophy': return 'trophy_floor';
    default: return 'desktop_floor';
  }
}
