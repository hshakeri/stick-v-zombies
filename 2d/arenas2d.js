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
  command_block: { base: '#c87d4b', dark: '#78421e', light: '#e7a16c', border: '#3b2110', accent: '#38bdf8' },
  obsidian: { base: '#160e26', dark: '#08040f', light: '#3b1f5e', border: '#090512', accent: '#7e22ce' },
  gold_block: { base: '#eab308', dark: '#a16207', light: '#fef08a', border: '#713f12', accent: '#ffffff' },
  tnt_block: { base: '#dc2626', dark: '#991b1b', light: '#ef4444', border: '#450a0a', accent: '#f8fafc' },
  lucky_block: { base: '#f59e0b', dark: '#b45309', light: '#fef08a', border: '#78350f', accent: '#ffffff' },
  purpur_block: { base: '#a87ca8', dark: '#6b426b', light: '#d8b4d8', border: '#4a254a', accent: '#f5d0fe' },
  holystone: { base: '#cbd5e1', dark: '#64748b', light: '#f1f5f9', border: '#475569', accent: '#facc15' },
  rocket_corp_wall: { base: '#475569', dark: '#1e293b', light: '#94a3b8', border: '#0f172a', accent: '#ff6b00' },
  sculk: { base: '#06141f', dark: '#02080d', light: '#0d3b4c', border: '#042f3e', accent: '#22d3ee' },
  deepslate_tiles: { base: '#272c35', dark: '#11151a', light: '#3f4756', border: '#090b0e', accent: '#52525b' },
  pale_moss: { base: '#9ea6ae', dark: '#6e767f', light: '#c5ccd3', border: '#4b525a', accent: '#cfd6dc' },
  pale_oak_log: { base: '#6e747d', dark: '#494e56', light: '#9aa1ab', border: '#2f3339', accent: '#f97316' },
  creaking_heart: { base: '#3b3f46', dark: '#23262b', light: '#686d75', border: '#181a1f', accent: '#f97316' },
  sketch_block: { base: '#f8fafc', dark: '#cbd5e1', light: '#ffffff', border: '#1e293b', accent: '#ff7700' },
  lava: { base: '#ea580c', dark: '#9a3412', light: '#facc15', border: '#7c2d12', accent: '#fef08a' }
});

export function getBlockPalette2D(texKey) {
  return BLOCK_PALETTES[texKey] || BLOCK_PALETTES.obsidian;
}

const VOXEL_SPRITE_CACHE_2D = new Map();

function hashTexel2D(tx, ty, seed = 1) {
  let h = Math.imul(tx * 374761393 + ty * 668265263 + seed * 1442695041, 0x9E3779B1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85EBCA6B);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967295;
}

function shadeHex2D(hex, factor) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((num & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

// Paints an authentic 16x16 Minecraft / AvM / AvA pixel-art voxel face into [ox, oy, size, size]
export function paintVoxelBlockPixels2D(ctx, texKey, ox = 0, oy = 0, size = 64) {
  const p = size / 16;
  const px = (tx, ty, tw = 1, th = 1, col = null) => {
    if (col) ctx.fillStyle = col;
    ctx.fillRect(ox + tx * p, oy + ty * p, tw * p, th * p);
  };
  const fillNoise = (baseHex, variance, seed) => {
    for (let ty = 0; ty < 16; ty++) {
      for (let tx = 0; tx < 16; tx++) {
        const n = (hashTexel2D(tx, ty, seed) - 0.5) * 2 * variance;
        px(tx, ty, 1, 1, shadeHex2D(baseHex, 1 + n));
      }
    }
  };
  const bevel = (lightHex, darkHex) => {
    px(0, 0, 16, 1, lightHex);
    px(0, 0, 1, 16, lightHex);
    px(0, 15, 16, 1, darkHex);
    px(15, 0, 1, 16, darkHex);
  };
  const paintMap = (rows, palette) => {
    for (let ty = 0; ty < 16; ty++) {
      const row = rows[ty];
      for (let tx = 0; tx < 16; tx++) {
        const col = palette[row[tx]];
        if (col) px(tx, ty, 1, 1, col);
      }
    }
  };

  switch (texKey) {
    case 'command_block': {
      fillNoise('#c87d4b', 0.14, 110);
      bevel('#e7a16c', '#78421e');
      // Metallic plate seams & corner bolts
      px(7, 1, 2, 3, '#9c592d');
      px(7, 12, 2, 3, '#9c592d');
      px(1, 7, 3, 2, '#9c592d');
      px(12, 7, 3, 2, '#9c592d');
      for (const [bx, by] of [[2, 2], [13, 2], [2, 13], [13, 13]]) {
        px(bx, by, 1, 1, '#5c3116');
      }
      // Chamfered octagonal dark-slate control housing
      px(5, 3, 6, 10, '#3b2a1e');
      px(3, 5, 10, 6, '#3b2a1e');
      px(4, 4, 8, 8, '#261b13');
      // Iconic multicolor Command Block pixel buttons
      px(5, 5, 2, 2, '#ffaa33');
      px(9, 5, 2, 2, '#5ce1e6');
      px(5, 9, 2, 2, '#ff5757');
      px(9, 9, 2, 2, '#7ed957');
      px(7, 7, 2, 2, '#fef08a');
      break;
    }
    case 'obsidian': {
      // Authentic Minecraft volcanic obsidian: interlocking dark-indigo/black glass boulders + violet/amethyst glints
      paintMap([
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
    case 'gold_block': {
      // Authentic Minecraft Block of Gold: lustrous diagonal metallic bullion sheen + beveled ingot rim
      const bandCols = ['#b45309', '#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a', '#ffffff'];
      for (let ty = 0; ty < 16; ty++) {
        for (let tx = 0; tx < 16; tx++) {
          const d = tx + ty;
          let idx = 2;
          if (d >= 8 && d <= 10) idx = d === 9 ? 6 : 5;
          else if (d === 7 || d === 11) idx = 4;
          else if (d >= 19 && d <= 21) idx = d === 20 ? 5 : 4;
          else if (d >= 25) idx = 0;
          else if (d >= 15 && d <= 17) idx = 1;
          else idx = 3;
          const n = (hashTexel2D(tx, ty, 115) - 0.5) * 0.08;
          px(tx, ty, 1, 1, shadeHex2D(bandCols[idx], 1 + n));
        }
      }
      bevel('#fef9c3', '#92400e');
      px(1, 1, 14, 1, '#fde047');
      px(1, 1, 1, 14, '#fde047');
      px(1, 14, 14, 1, '#b45309');
      px(14, 1, 1, 14, '#b45309');
      break;
    }
    case 'tnt_block': {
      // 4 cylindrical bundled dynamite sticks ([0..3], [4..7], [8..11], [12..15])
      const stickShade = ['#b91c1c', '#f87171', '#dc2626', '#7f1d1d'];
      for (let tx = 0; tx < 16; tx++) {
        const baseCol = stickShade[tx % 4];
        for (let ty = 0; ty < 16; ty++) {
          const n = (hashTexel2D(tx, ty, 220) - 0.5) * 0.1;
          px(tx, ty, 1, 1, shadeHex2D(baseCol, 1 + n));
        }
      }
      // Top & bottom gunpowder crimp bands + fuse cords
      px(0, 0, 16, 1, '#450a0a');
      px(0, 15, 16, 1, '#450a0a');
      for (let tx = 1; tx < 16; tx += 4) {
        px(tx, 0, 2, 1, '#d6d3d1');
        px(tx, 15, 2, 1, '#7f1d1d');
      }
      // Crisp centered white paper wrapper + symmetric T N T pixel lettering
      px(0, 5, 16, 6, '#f8fafc');
      px(0, 5, 16, 1, '#e2e8f0');
      px(0, 10, 16, 1, '#cbd5e1');
      // Left 'T' (x = 1..3)
      px(1, 6, 3, 1, '#111827');
      px(2, 7, 1, 3, '#111827');
      // Center 'N' (x = 6..9)
      px(6, 6, 1, 4, '#111827');
      px(7, 7, 1, 1, '#111827');
      px(8, 8, 1, 1, '#111827');
      px(9, 6, 1, 4, '#111827');
      // Right 'T' (x = 12..14)
      px(12, 6, 3, 1, '#111827');
      px(13, 7, 1, 3, '#111827');
      break;
    }
    case 'lucky_block': {
      // Lustrous amber-gold Lucky Block with corner rivets and bold shadowed '?'
      for (let ty = 0; ty < 16; ty++) {
        for (let tx = 0; tx < 16; tx++) {
          const d = (tx + ty) % 9;
          const base = d < 2 ? '#fde047' : (d < 5 ? '#fbbf24' : '#f59e0b');
          const n = (hashTexel2D(tx, ty, 170) - 0.5) * 0.08;
          px(tx, ty, 1, 1, shadeHex2D(base, 1 + n));
        }
      }
      bevel('#fef9c3', '#92400e');
      for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]]) {
        px(rx, ry, 1, 1, '#78350f');
      }
      // Drop shadow for '?'
      px(6, 3, 6, 2, '#92400e');
      px(5, 5, 2, 2, '#92400e');
      px(10, 5, 2, 3, '#92400e');
      px(8, 8, 3, 2, '#92400e');
      px(8, 10, 2, 1, '#92400e');
      px(8, 12, 2, 2, '#92400e');
      // Crisp white '?'
      px(5, 2, 6, 2, '#ffffff');
      px(4, 4, 2, 2, '#ffffff');
      px(9, 4, 2, 3, '#ffffff');
      px(7, 7, 3, 2, '#ffffff');
      px(7, 9, 2, 1, '#ffffff');
      px(7, 11, 2, 2, '#ffffff');
      break;
    }
    case 'purpur_block': {
      // Authentic Minecraft Purpur Block: 4x4 grid of 4x4 End City chorus-lavender tiles
      fillNoise('#a879a8', 0.1, 235);
      for (let qy = 0; qy < 16; qy += 4) {
        for (let qx = 0; qx < 16; qx += 4) {
          px(qx, qy, 4, 1, '#d8b4d8');
          px(qx, qy, 1, 4, '#d8b4d8');
          px(qx, qy + 3, 4, 1, '#6b426b');
          px(qx + 3, qy, 1, 4, '#6b426b');
          if (((qx + qy) / 4) % 2 === 1) {
            px(qx + 1, qy + 1, 2, 2, '#b589b5');
          }
        }
      }
      break;
    }
    case 'holystone': {
      // Authentic Aether Mossy Holystone: organic interlocking pale cobblestones + golden ambrosium moss seams
      paintMap([
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
    case 'rocket_corp_wall': {
      // AvA Rocket Corp ("The Box") Brushed-Titanium Containment Armor & Rocket Chevron
      for (let ty = 0; ty < 16; ty++) {
        for (let tx = 0; tx < 16; tx++) {
          const sheen = ((tx + ty) % 7 === 0) ? '#64748b' : '#475569';
          const n = (hashTexel2D(tx, ty, 252) - 0.5) * 0.06;
          px(tx, ty, 1, 1, shadeHex2D(sheen, 1 + n));
        }
      }
      bevel('#94a3b8', '#0f172a');
      // Top & bottom orange/slate containment hazard trim
      for (let tx = 2; tx < 14; tx += 4) {
        px(tx, 1, 2, 1, '#ff6b00');
        px(tx + 2, 1, 2, 1, '#1e293b');
        px(tx, 14, 2, 1, '#ff6b00');
        px(tx + 2, 14, 2, 1, '#1e293b');
      }
      // Recessed center octagon & Rocket Corp cursor-arrow glyph
      px(3, 3, 10, 10, '#1e293b');
      px(4, 4, 8, 8, '#0f172a');
      px(7, 4, 2, 2, '#ff6b00');
      px(6, 6, 4, 4, '#f8fafc');
      px(7, 7, 2, 2, '#38bdf8');
      px(5, 9, 2, 2, '#cbd5e1');
      px(9, 9, 2, 2, '#cbd5e1');
      px(7, 10, 2, 2, '#ff6b00');
      for (const [bx, by] of [[2, 3], [13, 3], [2, 12], [13, 12]]) {
        px(bx, by, 1, 1, '#cbd5e1');
      }
      break;
    }
    case 'sculk': {
      // Authentic Minecraft Deep Dark Sculk: organic abyssal biomass + scattered non-collinear soul-cyan stars
      paintMap([
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
      // Authentic Minecraft Deepslate Tiles: 4 staggered courses of chiseled slate tiles
      fillNoise('#2f3744', 0.1, 265);
      const courses = [
        { y: 0, joints: [7, 15] },
        { y: 4, joints: [3, 11] },
        { y: 8, joints: [6, 14] },
        { y: 12, joints: [2, 10] }
      ];
      for (const { y, joints } of courses) {
        // Horizontal mortar shadow at bottom of 4px tile course
        px(0, y + 3, 16, 1, '#11151c');
        // Chiseled top highlight across course
        px(0, y, 16, 1, '#586477');
        for (const jx of joints) {
          // Vertical mortar joint
          px(jx, y, 1, 4, '#11151c');
          // Left-edge chiseled highlight on next tile
          const nx = (jx + 1) % 16;
          px(nx, y, 1, 3, '#6b788d');
          // Right-edge shadow before joint
          const sx = (jx + 15) % 16;
          px(sx, y + 1, 1, 2, '#1e242e');
        }
      }
      break;
    }
    case 'pale_moss': {
      // Authentic Pale Garden Pale Moss Block: organic velvety silver-ash lichen tufts & hollows
      paintMap([
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
      // Authentic Pale Oak Bark: interlocking jagged vertical ash-grey bark ridges & gnarled fissures
      paintMap([
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
    case 'creaking_heart': {
      // Authentic Creaking Heart: split dark Pale Oak bark clasping branching glowing amber resin veins
      paintMap([
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
    case 'sketch_block': {
      // Animator vs. Animation Hand-Drawn Flash/Paper Sketch Block with blueprint grid & orange pencil glyph
      px(0, 0, 16, 16, '#f8fafc');
      // Crisp outer white rim so block pops on dark arenas + hand-drawn double charcoal ink frame
      bevel('#ffffff', '#cbd5e1');
      px(1, 1, 14, 1, '#0f172a');
      px(1, 14, 14, 1, '#0f172a');
      px(1, 1, 1, 14, '#0f172a');
      px(14, 1, 1, 14, '#0f172a');
      // Subtle cyan animation blueprint grid lines inside paper
      px(2, 5, 12, 1, '#dbeafe');
      px(2, 10, 12, 1, '#dbeafe');
      px(5, 2, 1, 12, '#dbeafe');
      px(10, 2, 1, 12, '#dbeafe');
      // Hand-drawn graphite corner cross-hatch ticks
      for (const [hx, hy] of [[3, 2], [2, 3], [12, 2], [13, 3], [2, 12], [3, 13], [13, 12], [12, 13]]) {
        px(hx, hy, 1, 1, '#64748b');
      }
      // Diagonal Animator Pencil & Orange emblem in center
      px(10, 4, 2, 2, '#f43f5e'); // pink eraser
      px(9, 5, 2, 2, '#94a3b8');  // ferrule
      px(7, 6, 3, 3, '#ff7700');  // orange barrel
      px(5, 8, 3, 3, '#fb923c');  // lower barrel
      px(4, 10, 2, 2, '#fde68a'); // wood cone
      px(4, 11, 1, 1, '#0f172a'); // graphite tip
      break;
    }
    case 'lava': {
      // Authentic Minecraft Molten Lava: curving bright yellow/white magma rivers around dark crust islands
      paintMap([
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
    default: {
      fillNoise('#334155', 0.14, 999);
      bevel('#64748b', '#1e293b');
      break;
    }
  }
}

export function getCreativeBlockSprite2D(texKey, createCanvas = null) {
  const validKey = BLOCK_PALETTES[texKey] ? texKey : 'obsidian';
  if (!createCanvas && VOXEL_SPRITE_CACHE_2D.has(validKey)) {
    return VOXEL_SPRITE_CACHE_2D.get(validKey);
  }

  let canvas = null;
  if (typeof createCanvas === 'function') {
    canvas = createCanvas(64, 64);
  } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
  } else if (typeof globalThis.OffscreenCanvas === 'function') {
    canvas = new globalThis.OffscreenCanvas(64, 64);
  }

  if (!canvas) return null;
  const sctx = canvas.getContext?.('2d');
  if (!sctx) return null;

  sctx.save?.();
  if ('imageSmoothingEnabled' in sctx) sctx.imageSmoothingEnabled = false;
  sctx.clearRect?.(0, 0, 64, 64);
  paintVoxelBlockPixels2D(sctx, validKey, 0, 0, 64);
  sctx.restore?.();

  if (!createCanvas) {
    VOXEL_SPRITE_CACHE_2D.set(validKey, canvas);
  }
  return canvas;
}

export function drawCreativeBlockSingle2D(ctx, block, stageTime = 0) {
  const w = block.width || 68;
  const h = block.height || 68;
  const x = Math.round(block.x - w * 0.5);
  const y = Math.round(block.y - h);
  const rawKey = block.texKey || (block.type === 'obsidian' ? 'obsidian' : 'sketch_block');
  const key = BLOCK_PALETTES[rawKey] ? rawKey : 'obsidian';
  const pal = getBlockPalette2D(key);

  ctx.save();

  // TNT active fuse flash (classic Minecraft white ignition blink)
  const fuseFlash = key === 'tnt_block' && block.fuseTimer !== undefined && Math.floor(block.fuseTimer * 10) % 2 === 0;
  if (fuseFlash) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.restore();
    return;
  }

  // Crisp outer 2px voxel casing rim so 64x64 (16x16 x 4px) interior maps 1:1 with zero blur
  ctx.fillStyle = pal.border;
  ctx.fillRect(x, y, w, h);

  const innerX = x + 2;
  const innerY = y + 2;
  const innerW = Math.max(16, w - 4);
  const innerH = Math.max(16, h - 4);

  const sprite = getCreativeBlockSprite2D(key);
  if (sprite) {
    const prevSmooth = ctx.imageSmoothingEnabled;
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, innerX, innerY, innerW, innerH);
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = prevSmooth;
  } else {
    paintVoxelBlockPixels2D(ctx, key, innerX, innerY, Math.min(innerW, innerH));
  }

  // Lightweight live pixel-grid pulse accents on emissive blocks (scaled for both 68px & 60px blocks)
  const sx = innerW / 64;
  const sy = innerH / 64;
  if (key === 'creaking_heart') {
    const pulse = 0.22 + (Math.sin(stageTime * 5.5) * 0.5 + 0.5) * 0.35;
    ctx.fillStyle = `rgba(254, 240, 138, ${pulse})`;
    ctx.fillRect(innerX + 24 * sx, innerY + 20 * sy, 16 * sx, 20 * sy);
  } else if (key === 'sculk') {
    const pulse = 0.16 + (Math.sin(stageTime * 4.2 + block.x * 0.03) * 0.5 + 0.5) * 0.32;
    ctx.fillStyle = `rgba(165, 243, 252, ${pulse})`;
    ctx.fillRect(innerX + 16 * sx, innerY + 20 * sy, 8 * sx, 4 * sy);
    ctx.fillRect(innerX + 48 * sx, innerY + 44 * sy, 8 * sx, 4 * sy);
  } else if (key === 'lava') {
    const pulse = 0.18 + (Math.sin(stageTime * 4.8 + block.x * 0.04) * 0.5 + 0.5) * 0.28;
    ctx.fillStyle = `rgba(254, 240, 138, ${pulse})`;
    ctx.fillRect(innerX + 16 * sx, innerY + 8 * sy, 12 * sx, 8 * sy);
    ctx.fillRect(innerX + 36 * sx, innerY + 44 * sy, 16 * sx, 8 * sy);
  } else if (key === 'command_block') {
    const blink = Math.floor(stageTime * 3.5) % 4;
    const ledOffsets = [[20, 20], [36, 20], [20, 36], [36, 36]];
    const [lx, ly] = ledOffsets[blink];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(innerX + lx * sx, innerY + ly * sy, 8 * sx, 8 * sy);
  }

  ctx.restore();
}

export function drawCreativeBlocks2D(ctx, blocks, stageTime = 0) {
  if (!Array.isArray(blocks) || blocks.length === 0) return;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b && !b.broken) drawCreativeBlockSingle2D(ctx, b, stageTime);
  }
}

export function drawSketchBlocksVoxel2D(ctx, sketchBlocks, stageTime = 0) {
  if (!Array.isArray(sketchBlocks) || sketchBlocks.length === 0) return;
  for (let i = 0; i < sketchBlocks.length; i++) {
    const b = sketchBlocks[i];
    if (!b) continue;
    const w = b.width || 60;
    const h = b.height || 60;
    const left = Math.round(b.x - w * 0.5);
    const top = Math.round(b.y - h);
    const perimeter = (w + h) * 2;
    const age = b.maxLife !== undefined ? b.maxLife - b.life : 25;
    const drawIn = Math.min(1, age / 0.25);
    const eraseOut = Math.min(1, Math.max(0, b.life ?? 25) / 0.3);
    const reveal = Math.min(drawIn, eraseOut);

    if (reveal >= 1) {
      drawCreativeBlockSingle2D(ctx, b, stageTime);
    } else {
      ctx.save();
      ctx.globalAlpha = Math.max(0.25, reveal);
      drawCreativeBlockSingle2D(ctx, b, stageTime);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash?.([perimeter]);
      ctx.lineDashOffset = perimeter * (1 - reveal);
      ctx.strokeRect(left, top, w, h);
      ctx.setLineDash?.([]);
      ctx.lineDashOffset = 0;
      ctx.restore();
    }

    if (b.hp !== undefined && b.maxHp && b.hp < b.maxHp) {
      ctx.save();
      ctx.fillStyle = '#ff3344';
      ctx.fillRect(b.x - 20, top - 10, 40, 4);
      ctx.fillStyle = '#44ee44';
      ctx.fillRect(b.x - 20, top - 10, 40 * (b.hp / b.maxHp), 4);
      ctx.restore();
    }
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
export function drawExpandedStageBackground2D(stageManager, ctx, groundY, onSkyPainted = null) {
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

    onSkyPainted?.();

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
    onSkyPainted?.();

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
    onSkyPainted?.();

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
    onSkyPainted?.();

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
    onSkyPainted?.();
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

  if (theme === 'dark_core') {
    ctx.save();

    // 1. AvA 8 Outernet Sky Gradient (Cerulean Daylight -> Sunlit Horizon Mist)
    const skyGrad = ctx.createLinearGradient(0, backdropMinY, 0, groundY - 105);
    skyGrad.addColorStop(0, '#082f49');
    skyGrad.addColorStop(0.32, '#0284c7');
    skyGrad.addColorStop(0.72, '#38bdf8');
    skyGrad.addColorStop(1, '#bae6fd');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(backdropMinX, backdropMinY, backdropMaxX - backdropMinX, (groundY - 100) - backdropMinY);

    // Drifting Outernet Cumulus Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    for (let i = 0; i < 7; i++) {
      const cx = -980 + (((i * 330 + t * (10 + (i % 3) * 4)) % 2100) + 2100) % 2100;
      const cy = minY + 85 + (i % 3) * 62;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 88 + (i % 2) * 26, 22 + (i % 3) * 5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 42, cy + 6, 52, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 46, cy + 5, 58, 17, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crimson ViraBot Launch Spire / Sky-Rift rising behind TDL's Cliffside Base
    const beamPulse = 0.2 + Math.sin(t * 5.2) * 0.06;
    ctx.fillStyle = `rgba(255, 23, 68, ${beamPulse})`;
    ctx.fillRect(418, backdropMinY, 64, groundY - backdropMinY);
    ctx.fillStyle = 'rgba(255, 59, 92, 0.42)';
    ctx.fillRect(442, backdropMinY, 16, groundY - backdropMinY);

    // Blit cached blurred Far & Mid Outernet bay mountains + lake mist haze
    onSkyPainted?.();

    // 2. Left Towering Waterfall Bluff & Battle-Scarred Canyon Rock (x: -1020 .. -180)
    const leftCliffTop = groundY - 435;
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(minX - 60, groundY - 96);
    ctx.lineTo(minX - 60, leftCliffTop + 34);
    ctx.lineTo(-760, leftCliffTop);
    ctx.lineTo(-235, leftCliffTop + 14);
    ctx.lineTo(-175, groundY - 96);
    ctx.closePath();
    ctx.fill();

    // Sunlit slate facets & stratified canyon ledges on Left Cliff
    ctx.fillStyle = '#475569';
    ctx.fillRect(-940, leftCliffTop + 38, 290, 92);
    ctx.fillRect(-610, leftCliffTop + 56, 195, 130);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-820, leftCliffTop + 150, 360, 18);
    ctx.fillRect(-590, leftCliffTop + 245, 210, 16);

    // Lush Emerald Outernet Grass Cap + Pine Trees atop Left Bluff
    ctx.fillStyle = '#15803d';
    ctx.fillRect(minX - 40, leftCliffTop + 4, 795, 22);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(minX - 40, leftCliffTop, 785, 10);
    for (const px of [-835, -705, -535]) {
      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.moveTo(px, leftCliffTop - 68);
      ctx.lineTo(px + 28, leftCliffTop + 2);
      ctx.lineTo(px - 28, leftCliffTop + 2);
      ctx.closePath();
      ctx.fill();
    }

    // Scorched TCO vs. TDL Impact Crater punched into Left Cliff Wall
    const craterX = -665;
    const craterY = groundY - 225;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(craterX, craterY, 56, 44, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(craterX - 48, craterY - 12);
    ctx.lineTo(craterX, craterY);
    ctx.lineTo(craterX + 52, craterY + 18);
    ctx.moveTo(craterX - 18, craterY - 38);
    ctx.lineTo(craterX + 8, craterY + 36);
    ctx.stroke();

    // 3. Right Cliff Bluff, Wrecked Dark Lord Shack & Subterranean ViraBot Bunker (x: +185 .. +1020)
    const rightCliffTop = groundY - 392;
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(185, groundY - 96);
    ctx.lineTo(245, rightCliffTop + 18);
    ctx.lineTo(790, rightCliffTop);
    ctx.lineTo(maxX + 60, rightCliffTop + 28);
    ctx.lineTo(maxX + 60, groundY - 96);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.fillRect(265, rightCliffTop + 42, 220, 96);
    ctx.fillRect(610, rightCliffTop + 52, 285, 118);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(240, rightCliffTop + 4, 780, 20);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(245, rightCliffTop, 775, 10);

    // The Dark Lord's Wrecked Wooden Cliffside Shack (from AvA 8 Opening Clash!)
    const shackX = 450;
    const shackBaseY = rightCliffTop + 2;
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2.5;
    ctx.fillRect(shackX - 66, shackBaseY - 64, 132, 64);
    ctx.strokeRect(shackX - 66, shackBaseY - 64, 132, 64);
    // Horizontal timber planks
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5;
    for (let py = shackBaseY - 48; py < shackBaseY - 8; py += 16) {
      ctx.beginPath();
      ctx.moveTo(shackX - 64, py);
      ctx.lineTo(shackX + 64, py);
      ctx.stroke();
    }
    // Broken pitched roof with TCO crash breach in center rafters
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(shackX - 78, shackBaseY - 62);
    ctx.lineTo(shackX - 18, shackBaseY - 98);
    ctx.lineTo(shackX - 6, shackBaseY - 74);
    ctx.lineTo(shackX + 16, shackBaseY - 94);
    ctx.lineTo(shackX + 78, shackBaseY - 62);
    ctx.closePath();
    ctx.fill();
    // Glowing red ViraBot lab monitor visible inside broken shack window & doorway
    ctx.fillStyle = '#18181b';
    ctx.fillRect(shackX - 16, shackBaseY - 44, 26, 44);
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(shackX + 22, shackBaseY - 46, 26, 22);

    // Exposed Subterranean ViraBot Bunker Bay & Glowing Red Canister Pods inside Right Cliff
    const bayX = 450;
    const bayTop = groundY - 222;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.fillRect(bayX - 96, bayTop, 192, 92);
    ctx.strokeRect(bayX - 96, bayTop, 192, 92);
    for (let c = -1; c <= 1; c++) {
      const podX = bayX + c * 54;
      const podGlow = 0.62 + Math.sin(t * 6 + c * 1.4) * 0.25;
      ctx.fillStyle = `rgba(255, 23, 68, ${podGlow})`;
      ctx.fillRect(podX - 15, bayTop + 16, 30, 60);
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(podX - 15, bayTop + 16, 30, 60);
      // Dormant ViraBot spider core silhouette inside canister
      ctx.fillStyle = '#18181b';
      ctx.fillRect(podX - 6, bayTop + 40, 12, 12);
    }

    // 4. Shimmering Outernet Lake Cove (groundY - 102 down to foreground)
    const lakeTop = groundY - 102;
    const lakeGrad = ctx.createLinearGradient(0, lakeTop, 0, groundY + 260);
    lakeGrad.addColorStop(0, '#0284c7');
    lakeGrad.addColorStop(0.28, '#0ea5e9');
    lakeGrad.addColorStop(0.55, '#0369a1');
    lakeGrad.addColorStop(1, '#082f49');
    ctx.fillStyle = lakeGrad;
    ctx.fillRect(backdropMinX, lakeTop, backdropMaxX - backdropMinX, backdropMaxY - lakeTop);

    // Crimson ViraBot reflection shimmer on right side of lake water
    ctx.fillStyle = 'rgba(255, 23, 68, 0.16)';
    ctx.fillRect(320, lakeTop + 8, 260, 88);

    // 5. Roaring Plunging Waterfall & Billowing Plunge-Pool Mist (x = -360)
    const fallX = -360;
    const fallTop = leftCliffTop + 16;
    const fallH = (lakeTop + 14) - fallTop;
    ctx.fillStyle = 'rgba(125, 211, 252, 0.84)';
    ctx.fillRect(fallX - 48, fallTop, 96, fallH);
    ctx.fillStyle = 'rgba(224, 242, 254, 0.92)';
    ctx.fillRect(fallX - 28, fallTop, 56, fallH);

    // Animated rushing vertical waterfall streaks
    ctx.fillStyle = '#ffffff';
    for (let s = 0; s < 9; s++) {
      const sx = fallX - 38 + s * 9.5;
      const sy = fallTop + ((t * 270 + s * 53) % Math.max(1, fallH - 42));
      ctx.fillRect(sx, sy, 3.5, 36);
    }

    // Churning whitewater plunge foam & mist clouds where waterfall hits the lake
    for (let m = -2; m <= 2; m++) {
      const mx = fallX + m * 28 + Math.sin(t * 3.8 + m) * 6;
      const mr = 22 + (2 - Math.abs(m)) * 8 + Math.cos(t * 4.5 + m) * 3;
      ctx.fillStyle = 'rgba(240, 249, 255, 0.78)';
      ctx.beginPath();
      ctx.arc(mx, lakeTop + 8, mr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Animated horizontal sunlit water ripples across the lake cove
    ctx.fillStyle = 'rgba(224, 242, 254, 0.52)';
    for (let r = 0; r < 18; r++) {
      const rx = -880 + (r * 108) + Math.sin(t * 2.4 + r * 0.9) * 18;
      const ry = lakeTop + 16 + (r % 5) * 17;
      ctx.fillRect(rx, ry, 54 + (r % 3) * 18, 3);
    }

    // 6. Rocky Lakeshore Causeway & Stepping Boulders along groundY (Combat Floor!)
    // White shoreline surf foam lapping against the stones
    const surfShift = Math.sin(t * 3.2) * 4;
    ctx.fillStyle = 'rgba(224, 242, 254, 0.82)';
    ctx.fillRect(minX, groundY - 5 + surfShift * 0.3, maxX - minX, 8);

    // Wet slate shoreline bank + mossy stepping stones spanning [minX, maxX]
    ctx.fillStyle = '#334155';
    ctx.fillRect(minX, groundY, maxX - minX, 24);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(minX, groundY + 16, maxX - minX, 12);
    for (let bx = minX + 20; bx < maxX - 30; bx += 92) {
      ctx.fillStyle = ((bx / 92) & 1) === 0 ? '#475569' : '#64748b';
      ctx.beginPath();
      ctx.ellipse(bx + 36, groundY + 8, 42, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(bx + 14, groundY - 2, 44, 5);
    }

    //Foreground shimmering lake water ripples below the rocky bank
    ctx.fillStyle = 'rgba(186, 230, 253, 0.36)';
    for (let f = -8; f <= 8; f++) {
      const fx = f * 120 + Math.cos(t * 2.1 + f) * 22;
      ctx.fillRect(fx - 38, groundY + 42 + (Math.abs(f) % 3) * 18, 76, 3.5);
    }

    // Natural framing canyon cliff borders at minX and maxX
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(minX - 24, minY, 28, groundY - minY + 28);
    ctx.fillRect(maxX - 4, minY, 28, groundY - minY + 28);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(minX, groundY);
    ctx.lineTo(maxX, groundY);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('OUTERNET://THE_SHOWDOWN_LAKE — DEFEAT THE DARK LORD', minX + 60, minY + 58);
    ctx.restore();
    return true;
  }

  if (theme === 'youtube') {
    ctx.save();
    paintFullVoid('#0f0f0f');
    onSkyPainted?.();

    // 1. Top YouTube Masthead Navigation Bar
    ctx.fillStyle = '#18181b';
    ctx.fillRect(minX, minY, maxX - minX, 62);
    ctx.fillStyle = '#27272a';
    ctx.fillRect(minX, minY + 61, maxX - minX, 2);

    // YouTube Red Play Pill + Brand Wordmark
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(minX + 54, minY + 15, 48, 32);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(minX + 73, minY + 23);
    ctx.lineTo(minX + 73, minY + 39);
    ctx.lineTo(minX + 88, minY + 31);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('YouTube', minX + 112, minY + 38);

    // Center Search Bar + Magnifying Button
    ctx.fillStyle = '#121212';
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 2;
    ctx.fillRect(-310, minY + 14, 560, 34);
    ctx.strokeRect(-310, minY + 14, 560, 34);
    ctx.fillStyle = '#27272a';
    ctx.fillRect(250, minY + 14, 62, 34);
    ctx.strokeRect(250, minY + 14, 62, 34);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '13px monospace';
    ctx.fillText('Stick vs Zombies - Official Fight (1080p60)', -292, minY + 36);
    ctx.fillStyle = '#e4e4e7';
    ctx.fillText('🔍', 272, minY + 36);

    // Live Stream Indicator Pill on Right
    const livePulse = 0.65 + Math.sin(t * 5.2) * 0.3;
    ctx.fillStyle = `rgba(255, 0, 51, ${livePulse})`;
    ctx.fillRect(maxX - 188, minY + 16, 126, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('● LIVE 1080p60', maxX - 174, minY + 35);

    // 2. Left Creator Studio Award Plaques (Silver, Gold, Red Diamond)
    const plaques = [
      { y: groundY - 395, frame: '#cbd5e1', gem: '#f8fafc', label: '100K SILVER' },
      { y: groundY - 285, frame: '#facc15', gem: '#fef08a', label: '1M GOLD' },
      { y: groundY - 175, frame: '#ff0033', gem: '#38bdf8', label: '10M DIAMOND' }
    ];
    for (let i = 0; i < plaques.length; i++) {
      const pl = plaques[i];
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = pl.frame;
      ctx.lineWidth = 2.5;
      ctx.fillRect(-900, pl.y, 165, 86);
      ctx.strokeRect(-900, pl.y, 165, 86);
      ctx.fillStyle = pl.frame;
      ctx.fillRect(-848, pl.y + 18, 60, 38);
      ctx.fillStyle = pl.gem;
      ctx.beginPath();
      ctx.moveTo(-824, pl.y + 27);
      ctx.lineTo(-824, pl.y + 47);
      ctx.lineTo(-806, pl.y + 37);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e4e4e7';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(pl.label, -872, pl.y + 74);
    }

    // 3. Central 16:9 Cinema Video Player Frame
    const vidX = -430;
    const vidY = groundY - 425;
    const vidW = 860;
    const vidH = 330;
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 3;
    ctx.fillRect(vidX, vidY, vidW, vidH);
    ctx.strokeRect(vidX, vidY, vidW, vidH);

    // Subtle Theater Ambient Glow + Center Play Emblem
    const playScale = 1 + Math.sin(t * 3.4) * 0.05;
    ctx.save();
    ctx.translate(0, vidY + vidH * 0.46);
    ctx.scale(playScale, playScale);
    ctx.fillStyle = 'rgba(255, 0, 51, 0.88)';
    ctx.fillRect(-62, -42, 124, 84);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-62, -42, 124, 84);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-16, -22);
    ctx.lineTo(-16, 22);
    ctx.lineTo(26, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Video Player Scrubbing Timeline & Controls
    const scrubRatio = 0.52 + Math.sin(t * 0.85) * 0.32;
    const scrubW = Math.round((vidW - 36) * scrubRatio);
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(vidX + 18, vidY + vidH - 32, vidW - 36, 6);
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(vidX + 18, vidY + vidH - 32, scrubW, 6);
    ctx.beginPath();
    ctx.arc(vidX + 18 + scrubW, vidY + vidH - 29, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e4e4e7';
    ctx.font = '11px monospace';
    ctx.fillText('▶  ❚❚   🔊   04:20 / 10:01', vidX + 22, vidY + vidH - 10);
    ctx.fillText('⚙ HD  ▭  ⛶', vidX + vidW - 118, vidY + vidH - 10);

    // Below-Video Title, Channel Avatar & Subscribe CTA Bar
    ctx.fillStyle = '#f4f4f5';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Animation vs. YouTube — Stick vs Zombies Arena', vidX + 4, groundY - 68);
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(72, groundY - 56, 152, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('🔔 SUBSCRIBE 10M', 84, groundY - 37);
    ctx.fillStyle = '#27272a';
    ctx.fillRect(238, groundY - 56, 190, 30);
    ctx.fillStyle = '#e4e4e7';
    ctx.fillText('👍 999K  |  ↗ SHARE', 252, groundY - 37);

    // 4. Right Sidebar "Up Next" Thumbnail Queue
    const thumbs = [
      { y: groundY - 415, accent: '#38bdf8', title: 'AvA 8: Lake Showdown', dur: '14:22' },
      { y: groundY - 300, accent: '#22c55e', title: 'Minecraft vs Zombies', dur: '09:45' },
      { y: groundY - 185, accent: '#facc15', title: 'Chrome & Spotify Mix', dur: '06:18' }
    ];
    for (let i = 0; i < thumbs.length; i++) {
      const th = thumbs[i];
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 2;
      ctx.fillRect(475, th.y, 150, 84);
      ctx.strokeRect(475, th.y, 150, 84);
      ctx.fillStyle = th.accent;
      ctx.fillRect(483, th.y + 8, 42, 42);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(574, th.y + 62, 46, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText(th.dur, 580, th.y + 74);
      ctx.fillStyle = '#e4e4e7';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(th.title, 636, th.y + 32);
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText('Alan-Style Arena • 8.2M', 636, th.y + 54);
    }

    // 5. Combat Floor Deck + Glowing Red Progress Scrub Line
    ctx.fillStyle = '#18181b';
    ctx.fillRect(minX, groundY, maxX - minX, 320);
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(minX, groundY - 3, maxX - minX, 6);
    ctx.fillStyle = '#27272a';
    ctx.fillRect(minX - 24, minY, 24, groundY - minY + 40);
    ctx.fillRect(maxX, minY, 24, groundY - minY + 40);
    ctx.restore();
    return true;
  }

  if (theme === 'chrome') {
    ctx.save();
    paintFullVoid('#202124');
    onSkyPainted?.();

    // 1. Top Multi-Tab Browser Strip + Traffic Lights + Omnibox URL Bar
    ctx.fillStyle = '#292a2d';
    ctx.fillRect(minX, minY, maxX - minX, 44);
    const lights = ['#ff5f56', '#ffbd2e', '#27c93f'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = lights[i];
      ctx.beginPath();
      ctx.arc(minX + 38 + i * 22, minY + 22, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const tabs = [
      { x: minX + 120, label: '🌐 Stick Arena', color: '#4285f4', active: true },
      { x: minX + 360, label: '🦖 chrome://dino', color: '#ea4335', active: false },
      { x: minX + 600, label: '🕶 Incognito Tab', color: '#fbbc05', active: false },
      { x: minX + 840, label: '⚙ DevTools [F12]', color: '#34a853', active: false }
    ];
    for (let i = 0; i < tabs.length; i++) {
      const tb = tabs[i];
      ctx.fillStyle = tb.active ? '#35363a' : '#202124';
      ctx.fillRect(tb.x, minY + 8, 226, 36);
      ctx.fillStyle = tb.color;
      ctx.fillRect(tb.x, minY + 8, 226, 4);
      ctx.fillStyle = '#e8eaed';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(tb.label, tb.x + 14, minY + 30);
      ctx.fillStyle = '#9aa0a6';
      ctx.fillText('×', tb.x + 204, minY + 30);
    }

    // Omnibox Toolbar
    ctx.fillStyle = '#35363a';
    ctx.fillRect(minX, minY + 44, maxX - minX, 46);
    ctx.fillStyle = '#202124';
    ctx.strokeStyle = '#5f6368';
    ctx.lineWidth = 1.5;
    ctx.fillRect(minX + 140, minY + 52, maxX - minX - 280, 30);
    ctx.strokeRect(minX + 140, minY + 52, maxX - minX - 280, 30);
    ctx.fillStyle = '#9aa0a6';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('←   →   ↻', minX + 34, minY + 72);
    ctx.fillStyle = '#8ab4f8';
    ctx.font = '13px monospace';
    ctx.fillText('🔒 https://chrome.google.com/stick-vs-zombies/arena', minX + 162, minY + 72);
    ctx.fillStyle = '#fbbc05';
    ctx.fillText('★', maxX - 168, minY + 72);

    // 2. Central 4-Color Google Chrome Spinning Ring Emblem
    const ringY = groundY - 268;
    const ringColors = ['#ea4335', '#fbbc05', '#34a853'];
    ctx.save();
    ctx.translate(0, ringY);
    ctx.rotate(t * 0.35);
    for (let s = 0; s < 3; s++) {
      const a0 = (s * Math.PI * 2) / 3 - Math.PI * 0.75;
      const a1 = a0 + (Math.PI * 2) / 3 + 0.03;
      ctx.fillStyle = ringColors[s];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 88, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4285f4';
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Iconic Chrome Offline T-Rex Dino Runner Horizon (groundY - 92..groundY)
    const desertY = groundY - 28;
    ctx.strokeStyle = '#5f6368';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(minX + 60, desertY);
    ctx.lineTo(maxX - 60, desertY);
    ctx.stroke();

    // Retro Score Readout
    const scoreTick = String(4820 + Math.floor(t * 14) % 90000).padStart(5, '0');
    ctx.fillStyle = '#9aa0a6';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`NO INTERNET // HI 99999  ${scoreTick}`, 470, groundY - 108);

    // Pixel Desert Cacti
    const cactusXs = [-520, -140, 410, 740];
    for (let i = 0; i < cactusXs.length; i++) {
      const cx = cactusXs[i];
      ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(cx - 6, desertY - 46, 12, 46);
      ctx.fillRect(cx - 18, desertY - 34, 12, 8);
      ctx.fillRect(cx - 18, desertY - 44, 8, 14);
      ctx.fillRect(cx + 6, desertY - 28, 12, 8);
      ctx.fillRect(cx + 10, desertY - 40, 8, 16);
    }

    // Animated Pixel Chrome Offline T-Rex Dino (hopping & running!)
    const dinoX = -740;
    const dinoHop = Math.abs(Math.sin(t * 4.2)) * 18;
    const dy = desertY - dinoHop;
    ctx.fillStyle = '#bdc1c6';
    ctx.fillRect(dinoX, dy - 56, 30, 20);      // Snout & head
    ctx.fillRect(dinoX - 10, dy - 38, 28, 24); // Torso
    ctx.fillRect(dinoX - 22, dy - 32, 12, 12); // Tail
    ctx.fillRect(dinoX + 18, dy - 30, 8, 6);   // Tiny T-Rex arm!
    const legSwap = Math.floor(t * 10) % 2;
    ctx.fillRect(dinoX - 6, dy - 14, 7, legSwap === 0 ? 14 : 9);
    ctx.fillRect(dinoX + 8, dy - 14, 7, legSwap === 1 ? 14 : 9);
    ctx.fillStyle = '#202124';
    ctx.fillRect(dinoX + 8, dy - 51, 5, 5);    // Dino pixel eye

    // 4. Combat Floor = Chrome Downloads Bar with 4-Color Google Stripe
    ctx.fillStyle = '#292a2d';
    ctx.fillRect(minX, groundY, maxX - minX, 320);
    const spanQuarter = (maxX - minX) * 0.25;
    const gCols = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];
    for (let q = 0; q < 4; q++) {
      ctx.fillStyle = gCols[q];
      ctx.fillRect(minX + q * spanQuarter, groundY - 3, spanQuarter + 1, 6);
    }
    ctx.fillStyle = '#35363a';
    ctx.fillRect(minX + 60, groundY + 12, 240, 26);
    ctx.fillRect(minX + 320, groundY + 12, 240, 26);
    ctx.fillStyle = '#e8eaed';
    ctx.font = '11px monospace';
    ctx.fillText('⬇ stick_arena_setup.exe', minX + 76, groundY + 29);
    ctx.fillText('⬇ chrome_dino_mod.zip', minX + 336, groundY + 29);
    ctx.restore();
    return true;
  }

  if (theme === 'spotify') {
    ctx.save();
    const bgGrad = ctx.createLinearGradient(0, minY, 0, groundY);
    bgGrad.addColorStop(0, '#07361a');
    bgGrad.addColorStop(0.45, '#121212');
    bgGrad.addColorStop(1, '#09090b');
    paintFullVoid(bgGrad);
    onSkyPainted?.();

    // 1. Left "Your Library" Sidebar Panel
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;
    ctx.fillRect(minX + 24, minY + 24, 340, groundY - minY - 40);
    ctx.strokeRect(minX + 24, minY + 24, 340, groundY - minY - 40);

    // Spotify Brand Green Circle + Sound Waves
    ctx.fillStyle = '#1db954';
    ctx.beginPath();
    ctx.arc(minX + 68, minY + 64, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 3;
    for (let w = 0; w < 3; w++) {
      ctx.beginPath();
      ctx.moveTo(minX + 57 + w * 2, minY + 58 + w * 6);
      ctx.lineTo(minX + 79 - w * 2, minY + 60 + w * 6);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Spotify', minX + 98, minY + 71);

    const playlists = [
      '🏠  Home',
      '🔍  Search',
      '📚  Your Library',
      '💚  Liked Songs • 412',
      '🔥  Stick Fight BPM 175',
      '⚡  Boss Rush Synthwave',
      '🎧  Animator Lo-Fi Beats'
    ];
    ctx.font = 'bold 13px monospace';
    for (let i = 0; i < playlists.length; i++) {
      ctx.fillStyle = i === 4 ? '#1db954' : '#b3b3b3';
      ctx.fillText(playlists[i], minX + 48, minY + 124 + i * 38);
    }

    // 2. Center Spinning Vinyl LP & Playlist Header
    const vinylX = -150;
    const vinylY = groundY - 355;
    ctx.save();
    ctx.translate(vinylX, vinylY);
    ctx.rotate(t * 1.9);
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#1db954';
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#86efac';
    ctx.fillRect(-3, -64, 6, 18);
    ctx.restore();

    ctx.fillStyle = '#1db954';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('VERIFIED PLAYLIST • STAGE 24', -56, vinylY - 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('STICK VS ZOMBIES OST', -56, vinylY - 4);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '13px monospace';
    ctx.fillText('DJ Second Coming • 27 Tracks • 175 BPM Bass Drop', -56, vinylY + 24);

    // 3. Live Animated 24-Bar #1DB954 Audio Spectrum Equalizer across Main Stage
    const eqCount = 24;
    const eqStartX = -540;
    const eqStep = 58;
    for (let i = 0; i < eqCount; i++) {
      const waveA = Math.sin(t * 7.4 + i * 0.58) * 0.5 + 0.5;
      const waveB = Math.cos(t * 4.9 - i * 0.33) * 0.5 + 0.5;
      const barH = Math.round(34 + (waveA * 0.65 + waveB * 0.35) * 165);
      const bx = eqStartX + i * eqStep;
      ctx.fillStyle = 'rgba(29, 185, 84, 0.78)';
      ctx.fillRect(bx, groundY - 12 - barH, 38, barH);
      ctx.fillStyle = '#86efac';
      ctx.fillRect(bx, groundY - 18 - barH, 38, 6);
    }

    // 4. Combat Floor = Spotify "Now Playing" Transport Footer Bar
    ctx.fillStyle = '#18181b';
    ctx.fillRect(minX, groundY, maxX - minX, 320);
    ctx.fillStyle = '#1db954';
    ctx.fillRect(minX, groundY - 3, maxX - minX, 6);

    // Transport Controls & Progress Readout
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, groundY + 26, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-5, groundY + 19, 4, 14);
    ctx.fillRect(2, groundY + 19, 4, 14);
    ctx.fillStyle = '#b3b3b3';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('🔀   ⏮', -95, groundY + 31);
    ctx.fillText('⏭   🔁', 34, groundY + 31);
    ctx.fillStyle = '#1db954';
    ctx.fillText('♫ NOW PLAYING: BASS DROP ARENA', minX + 54, groundY + 31);
    ctx.fillText('🔊 ████████░░ 85%', maxX - 240, groundY + 31);
    ctx.restore();
    return true;
  }

  if (theme === 'slides') {
    ctx.save();
    paintFullVoid('#e8eaed');
    onSkyPainted?.();

    // 1. Top Google Slides Gold Ribbon & Toolbar
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(minX, minY, maxX - minX, 82);
    ctx.fillStyle = '#dadce0';
    ctx.fillRect(minX, minY + 81, maxX - minX, 2);

    // Gold Google Slides Document Icon
    ctx.fillStyle = '#fbbc04';
    ctx.fillRect(minX + 44, minY + 16, 36, 46);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(minX + 51, minY + 30, 22, 18);
    ctx.fillStyle = '#202124';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Stick_vs_Zombies_Strategy_Deck.slides', minX + 94, minY + 36);
    ctx.fillStyle = '#5f6368';
    ctx.font = '12px monospace';
    ctx.fillText('File  Edit  View  Insert  Slide  Format  Arrange  Tools', minX + 94, minY + 56);

    // Formatting Strip + Yellow [ ▶ Slideshow ] CTA Button
    ctx.fillStyle = '#f1f3f4';
    ctx.fillRect(-120, minY + 46, 520, 26);
    ctx.fillStyle = '#3c4043';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('+  ↶  ↷  |  Arial  18pt  |  B   I   U   A   🔗   ⊞', -104, minY + 64);

    ctx.fillStyle = '#fbbc04';
    ctx.fillRect(maxX - 216, minY + 20, 158, 38);
    ctx.fillStyle = '#202124';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('▶ SLIDESHOW', maxX - 188, minY + 44);

    // 2. Left Vertical Slide Filmstrip (Slides 1..4)
    ctx.fillStyle = '#f8f9fa';
    ctx.strokeStyle = '#dadce0';
    ctx.lineWidth = 2;
    ctx.fillRect(minX + 22, minY + 96, 250, groundY - minY - 110);
    ctx.strokeRect(minX + 22, minY + 96, 250, groundY - minY - 110);

    for (let s = 0; s < 4; s++) {
      const sy = minY + 114 + s * 96;
      const active = s === 1;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = active ? '#fbbc04' : '#bdc1c6';
      ctx.lineWidth = active ? 3.5 : 1.5;
      ctx.fillRect(minX + 58, sy, 190, 78);
      ctx.strokeRect(minX + 58, sy, 190, 78);
      ctx.fillStyle = active ? '#d97706' : '#5f6368';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(String(s + 1), minX + 36, sy + 44);
      ctx.fillStyle = active ? '#fbbc04' : '#e8eaed';
      ctx.fillRect(minX + 68, sy + 10, 170, 12);
      ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(minX + 68, sy + 30, 110, 6);
      ctx.fillRect(minX + 68, sy + 44, 140, 6);
    }

    // 3. Central 16:9 Crisp White Presentation Slide Canvas
    const slideX = -590;
    const slideY = groundY - 438;
    const slideW = 1420;
    const slideH = 408;

    // Soft Drop Shadow + Crisp White Slide Sheet
    ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.fillRect(slideX + 10, slideY + 10, slideW, slideH);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.fillRect(slideX, slideY, slideW, slideH);
    ctx.strokeRect(slideX, slideY, slideW, slideH);

    // Slide Gold Accent Header Bar
    ctx.fillStyle = '#fbbc04';
    ctx.fillRect(slideX, slideY, slideW, 16);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SLIDE 02: HOW TO DEFEAT ZOMBIES (Q4 REPORT)', slideX + 42, slideY + 58);

    // Left Editable Text Box with Blue Free-Transform Handles (□)
    const boxX = slideX + 44;
    const boxY = slideY + 86;
    const boxW = 610;
    const boxH = 265;
    ctx.strokeStyle = '#4285f4';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    const handles = [
      [boxX, boxY], [boxX + boxW * 0.5, boxY], [boxX + boxW, boxY],
      [boxX, boxY + boxH * 0.5], [boxX + boxW, boxY + boxH * 0.5],
      [boxX, boxY + boxH], [boxX + boxW * 0.5, boxY + boxH], [boxX + boxW, boxY + boxH]
    ];
    for (let h = 0; h < handles.length; h++) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(handles[h][0] - 5, handles[h][1] - 5, 10, 10);
      ctx.strokeRect(handles[h][0] - 5, handles[h][1] - 5, 10, 10);
    }
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('• 1. Build Voxel Cover [V / B]', boxX + 26, boxY + 54);
    ctx.fillText('• 2. Equip Giant Pink Eraser', boxX + 26, boxY + 106);
    ctx.fillText('• 3. Launch Air Juggle Combos', boxX + 26, boxY + 158);
    ctx.fillText('• 4. Breach Rocket Corp Next →', boxX + 26, boxY + 210);

    // Right Column: Live Animated 4-Color Google Bar Chart
    const chartX = slideX + 740;
    const chartBaseY = slideY + 350;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chartX, slideY + 95);
    ctx.lineTo(chartX, chartBaseY);
    ctx.lineTo(chartX + 590, chartBaseY);
    ctx.stroke();

    const bars = [
      { label: 'INK', color: '#4285f4', baseH: 135 },
      { label: 'COMBO', color: '#ea4335', baseH: 185 },
      { label: 'SPEED', color: '#fbbc04', baseH: 155 },
      { label: 'VICTORY', color: '#34a853', baseH: 225 }
    ];
    for (let b = 0; b < bars.length; b++) {
      const br = bars[b];
      const pulseH = br.baseH + Math.round(Math.sin(t * 2.8 + b * 1.1) * 14);
      const bx = chartX + 46 + b * 134;
      ctx.fillStyle = br.color;
      ctx.fillRect(bx, chartBaseY - pulseH, 84, pulseH);
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(br.label, bx + 12, chartBaseY + 22);
    }

    // 4. Combat Floor = Speaker Notes & Ruler Deck
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(minX, groundY, maxX - minX, 320);
    ctx.fillStyle = '#fbbc04';
    ctx.fillRect(minX, groundY - 3, maxX - minX, 6);
    ctx.fillStyle = '#5f6368';
    ctx.font = '13px monospace';
    ctx.fillText('Speaker notes: Watch out for incoming waves while presenting Slide 02!', -310, groundY + 28);
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
    theme !== 'youtube' &&
    theme !== 'chrome' &&
    theme !== 'spotify' &&
    theme !== 'slides' &&
    theme !== 'rocket_corp' &&
    theme !== 'dark_core'
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
    } else if (theme === 'youtube') {
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);
      const progW = p.axis ? p.width - 4 : Math.round((p.width - 4) * 0.72);
      ctx.fillStyle = '#ff0033';
      ctx.fillRect(p.x - halfW + 2, topY + 2, progW, 5);
      ctx.beginPath();
      ctx.arc(p.x - halfW + 2 + progW, topY + 4.5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f4f5';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`▶ ${p.title || 'YouTube'}`, p.x - halfW + 10, topY + 17);
    } else if (theme === 'chrome') {
      const accent = p.accent || '#4285f4';
      ctx.fillStyle = '#35363a';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);
      ctx.fillStyle = accent;
      ctx.fillRect(p.x - halfW + 2, topY + 2, p.width - 4, 4);
      ctx.beginPath();
      ctx.arc(p.x - halfW + 12, topY + 13, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8eaed';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(p.title || 'Tab', p.x - halfW + 22, topY + 17);
      ctx.fillStyle = '#9aa0a6';
      ctx.fillText('×', p.x + halfW - 14, topY + 17);
    } else if (theme === 'spotify') {
      const isLift = p.axis === 'y';
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = '#1db954';
      ctx.lineWidth = isLift ? 2.5 : 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);
      ctx.fillStyle = '#1db954';
      ctx.fillRect(p.x - halfW + 2, topY + 2, p.width - 4, 5);
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`♫ ${p.title || 'Track'}`, p.x - halfW + 10, topY + 17);
    } else if (theme === 'slides') {
      const borderCol = p.axis ? '#fbbc04' : '#4285f4';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);
      // 4 Free-Transform corner handles (□)
      const corners = [
        [p.x - halfW, topY],
        [p.x + halfW, topY],
        [p.x - halfW, p.y],
        [p.x + halfW, p.y]
      ];
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(corners[c][0] - 3.5, corners[c][1] - 3.5, 7, 7);
        ctx.strokeRect(corners[c][0] - 3.5, corners[c][1] - 3.5, 7, 7);
      }
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(p.title || 'Slide_Box', p.x - halfW + 10, topY + 15);
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
    } else if (theme === 'dark_core') {
      // AvA 8 Showdown Lake: Craggy Outernet Canyon Ledges & Vira-Ruptured Floating Boulders
      const isRupturedSlab = Boolean(p.axis);
      ctx.fillStyle = isRupturedSlab ? '#1e293b' : '#334155';
      ctx.strokeStyle = isRupturedSlab ? '#ff1744' : '#0f172a';
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);

      // Tapered rocky underside crag
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(p.x - halfW + 12, p.y);
      ctx.lineTo(p.x - halfW * 0.45, p.y + 12);
      ctx.lineTo(p.x + halfW * 0.48, p.y + 10);
      ctx.lineTo(p.x + halfW - 12, p.y);
      ctx.closePath();
      ctx.fill();

      if (isRupturedSlab) {
        // Pulsing crimson ViraBot energy veins under levitating canyon rock
        const glow = 0.55 + Math.sin(t * 6 + p.x * 0.02) * 0.3;
        ctx.fillStyle = `rgba(255, 23, 68, ${glow})`;
        ctx.fillRect(p.x - halfW + 10, topY + 3, p.width - 20, 4);
      } else {
        // Lush emerald Outernet grass turf cap + battle scorch scar on center crag
        ctx.fillStyle = '#15803d';
        ctx.fillRect(p.x - halfW + 1, topY + 1, p.width - 2, 7);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(p.x - halfW + 2, topY + 1, p.width - 4, 4);
        if (Math.abs(p.x) < 40) {
          ctx.fillStyle = '#ff1744';
          ctx.fillRect(p.x - 26, topY + 3, 52, 3);
        }
      }
    }
    ctx.restore();
  }
  return true;
}

