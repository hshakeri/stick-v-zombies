// ============================================================================
// Stick vs Zombies — Pure 2D Canvas Boss & Weapon Renderers
//   - EnderDragonBoss (Stage 18: The End)
//   - WardenBoss      (Stage 20: Ancient City)
//   - CreakingBoss    (Stage 21: Pale Garden — Gaze-Freeze & Resin Heart-Tether)
//   - MercenaryBoss   (Stage 22: Rocket Corp — Agent, Ballista, Primal, Hazard)
//   - 8-Weapon Armory stats & 2D StickFigureRenderer weapon visuals
// ============================================================================

import { StickFigureRenderer } from '../js/entities/stickman.js?v=9.8';
import { weapons } from '../js/entities/weapons.js?v=9.8';
import {
  EnderDragonBoss,
  WardenBoss,
  CreakingBoss,
  MercenaryBoss
} from '../3d/js/campaign3d.js?v=10.5';

const EXTRA_WEAPON_STATS = Object.freeze({
  toolbar_staff: {
    name: 'UI Toolbar Staff (Agent)',
    damage: 46,
    range: 185,
    knockback: 580,
    slashArc: Math.PI * 1.15,
    cooldown: 0.3
  },
  pixel_bazooka: {
    name: '8-Bit Pixel Bazooka (Ballista)',
    damage: 58,
    range: 195,
    knockback: 680,
    slashArc: Math.PI * 0.9,
    cooldown: 0.38
  },
  stone_spear: {
    name: 'Prehistoric Stone Spear (Primal)',
    damage: 52,
    range: 190,
    knockback: 620,
    slashArc: Math.PI * 0.85,
    cooldown: 0.33
  },
  hazard_sign: {
    name: 'High-Voltage Caution Sign (Hazard)',
    damage: 50,
    range: 165,
    knockback: 640,
    slashArc: Math.PI,
    cooldown: 0.35
  },
  vira_blades: {
    name: 'Dual Vira-Blades (The Dark Lord)',
    damage: 64,
    range: 175,
    knockback: 640,
    slashArc: Math.PI * 1.35,
    cooldown: 0.26
  }
});

let installed2DBosses = false;

export function install2DBossAndWeaponRenderers() {
  if (installed2DBosses) return;
  installed2DBosses = true;

  // 1. Extend WeaponManager.getWeaponStats for Creative & Mercenary weapons
  const origGetWeaponStats = weapons.getWeaponStats.bind(weapons);
  weapons.getWeaponStats = (type, level = 1) => {
    if (EXTRA_WEAPON_STATS[type]) {
      const base = EXTRA_WEAPON_STATS[type];
      return {
        ...base,
        damage: base.damage * (type === 'toolbar_staff' ? 1 : (weapons.pencilSharpness || 1))
      };
    }
    return origGetWeaponStats(type, level);
  };

  // 2. Extend StickFigureRenderer.prototype.drawWeapon for Mercenary weapons
  const origDrawWeapon = StickFigureRenderer.prototype.drawWeapon;
  StickFigureRenderer.prototype.drawWeapon = function drawExpandedWeapon2D(ctx, handPos, weaponType, angle, isAwakened) {
    if (
      weaponType !== 'toolbar_staff' &&
      weaponType !== 'pixel_bazooka' &&
      weaponType !== 'stone_spear' &&
      weaponType !== 'hazard_sign'
    ) {
      return origDrawWeapon.call(this, ctx, handPos, weaponType, angle, isAwakened);
    }

    ctx.save();
    ctx.translate(handPos.x, handPos.y);
    ctx.rotate(angle);

    if (weaponType === 'toolbar_staff') {
      // Agent's Adobe UI Toolbar Staff
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.fillRect(-4, -76, 8, 136);
      ctx.strokeRect(-4, -76, 8, 136);
      // Floating glowing cyan UI Tool Icons at the tip
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-11, -96, 22, 20);
      ctx.fillStyle = '#020617';
      ctx.fillRect(-7, -92, 5, 12);
      ctx.fillRect(2, -92, 5, 12);
    } else if (weaponType === 'pixel_bazooka') {
      // Ballista's 8-Bit Stepped Pixel Bazooka
      ctx.fillStyle = '#334155';
      ctx.fillRect(-10, -68, 20, 74);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-12, -68, 24, 14);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-8, -42, 16, 8);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(6, -18, 10, 14);
    } else if (weaponType === 'stone_spear') {
      // Primal's Wooden Shaft + Chipped Flint Spearhead
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-3.5, -66, 7, 132);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-5, -68, 10, 7);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(-10, -68);
      ctx.lineTo(10, -68);
      ctx.lineTo(0, -98);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'hazard_sign') {
      // Hazard's High-Voltage Caution Triangle Signpost
      ctx.fillStyle = '#475569';
      ctx.fillRect(-3, -58, 6, 114);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -96);
      ctx.lineTo(22, -56);
      ctx.lineTo(-22, -56);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.fillRect(-2, -80, 4, 12);
      ctx.fillRect(-2, -64, 4, 4);
    }

    ctx.restore();
  };

  // 3. EnderDragonBoss 2D Canvas Renderer
  EnderDragonBoss.prototype.draw = function drawEnderDragon2D(ctx, crowded = false) {
    if (this.isDead) return;
    const t = this.animTimer || 0;
    const isSwoop = this.state === 'swoop_active';
    const hoverOffset = isSwoop
      ? -36 - Math.sin(this.getActionRenderPhase() * Math.PI) * 24
      : -98 + Math.sin(t * 4.2) * 12;
    const drawX = this.x;
    const drawY = this.y + hoverOffset;
    const dir = this.facing >= 0 ? 1 : -1;
    const wingFlap = Math.sin(t * (this.phase === 2 ? 12 : 8.5)) * 38;

    ctx.save();
    // Ground shadow
    ctx.fillStyle = 'rgba(15, 5, 28, 0.42)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.groundY - 2, 64, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(drawX, drawY);
    ctx.scale(dir, 1);

    if (this.phase === 2 && !crowded) {
      ctx.shadowColor = '#d946ef';
      ctx.shadowBlur = 22;
    }

    // Back Wing
    ctx.fillStyle = 'rgba(126, 34, 206, 0.52)';
    ctx.strokeStyle = '#4c1d95';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(-58, -62 - wingFlap * 0.7);
    ctx.lineTo(-104, -22 - wingFlap * 0.5);
    ctx.lineTo(-42, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Articulated 4-Segment Whipping Tail + Purple Spine Plates
    for (let s = 1; s <= 4; s++) {
      const tx = -36 - s * 22;
      const ty = 4 + Math.sin(t * 6 - s * 0.7) * (4 + s * 2.5);
      ctx.fillStyle = this.isHurt ? '#ffffff' : '#18181b';
      ctx.fillRect(tx, ty - 7 + s, 20, 14 - s * 1.6);
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(tx + 5, ty - 12 + s, 8, 5);
    }

    // Armored Obsidian Body
    ctx.fillStyle = this.isHurt ? '#ffffff' : '#0f0a19';
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2.5;
    ctx.fillRect(-42, -18, 78, 34);
    ctx.strokeRect(-42, -18, 78, 34);
    for (let p = -30; p <= 18; p += 16) {
      ctx.fillStyle = '#d946ef';
      ctx.fillRect(p, -25, 10, 7);
    }

    // Front Bat Wing
    ctx.fillStyle = 'rgba(192, 132, 252, 0.55)';
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(4, -10);
    ctx.lineTo(-34, -74 + wingFlap);
    ctx.lineTo(-96, -34 + wingFlap * 0.8);
    ctx.lineTo(-24, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Neck & Snapping Dragon Head
    ctx.fillStyle = this.isHurt ? '#ffffff' : '#18181b';
    ctx.fillRect(28, -14, 24, 18);
    ctx.fillRect(46, -24, 34, 22);
    // Horns
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(48, -33, 12, 9);
    // Glowing Magenta Eyes
    ctx.fillStyle = '#f0abfc';
    ctx.fillRect(64, -18, 9, 5);

    // Lower Jaw (opens wide during Dragon's Breath)
    const jawDrop = (this.state === 'breath_windup' || this.state === 'breath_active') ? 12 : 3;
    ctx.fillStyle = '#27272a';
    ctx.fillRect(50, -2 + jawDrop * 0.6, 28, 9);

    if (this.state === 'breath_windup' || this.state === 'breath_active') {
      ctx.fillStyle = '#e879f9';
      ctx.beginPath();
      ctx.arc(82, -2, 12 + Math.sin(t * 24) * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // 4. WardenBoss 2D Canvas Renderer (Stage 20: Ancient City)
  WardenBoss.prototype.draw = function drawWardenBoss2D(ctx, crowded = false) {
    if (this.isDead) return;
    const t = this.animTimer || 0;
    const dir = this.facing >= 0 ? 1 : -1;
    const walk = Math.abs(this.vx) > 10 || this.state === 'charge_active' ? Math.sin(t * 9) * 14 : 0;
    const heartPulse = 0.72 + Math.sin(t * (this.phase === 2 ? 12 : 6.5)) * 0.28;

    ctx.save();
    // Sonic Boom Beam + 5 Concentric Cyan Rings in world space!
    if (this.state === 'sonic_active') {
      ctx.save();
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 10;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(this.x + dir * 24, this.y - 78);
      ctx.lineTo(this.x + dir * 740, this.y - 78);
      ctx.stroke();

      ctx.lineWidth = 4;
      for (let r = 1; r <= 5; r++) {
        const rx = this.x + dir * (r * 135);
        ctx.beginPath();
        ctx.ellipse(rx, this.y - 78, 14, 34 + r * 5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);

    if ((this.phase === 2 || this.state === 'sonic_windup') && !crowded) {
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 18;
    }

    // Thick Sculk Legs
    ctx.fillStyle = this.isHurt ? '#ffffff' : '#082635';
    ctx.strokeStyle = '#0e7490';
    ctx.lineWidth = 2.5;
    ctx.fillRect(-24 + walk * 0.6, -42, 20, 42);
    ctx.strokeRect(-24 + walk * 0.6, -42, 20, 42);
    ctx.fillRect(6 - walk * 0.6, -42, 20, 42);
    ctx.strokeRect(6 - walk * 0.6, -42, 20, 42);

    // Hulking Torso + Bone Ribcage + Pulsing Cyan Soul Heart
    ctx.fillStyle = this.isHurt ? '#ffffff' : '#061e2b';
    ctx.fillRect(-30, -102, 62, 62);
    ctx.strokeRect(-30, -102, 62, 62);

    // Pulsing Soul Heart Core
    ctx.fillStyle = `rgba(34, 211, 238, ${heartPulse})`;
    ctx.fillRect(-14, -88, 30, 32);
    ctx.fillStyle = '#cffafe';
    ctx.fillRect(-7, -80, 16, 16);

    // Bone-white Ribs framing the Soul Heart
    ctx.fillStyle = '#d6d3c4';
    for (let ry = -92; ry <= -62; ry += 14) {
      ctx.fillRect(-26, ry, 14, 6);
      ctx.fillRect(14, ry, 14, 6);
    }

    // Heavy Gorilla-Like Sculk Arms with Bone Knuckles
    const slamLift = this.state === 'slam_windup' ? -36 : (this.state === 'slam_active' ? 18 : 0);
    ctx.fillStyle = this.isHurt ? '#ffffff' : '#0b3142';
    ctx.fillRect(16 - walk * 0.5, -96 + slamLift, 20, 66);
    ctx.strokeRect(16 - walk * 0.5, -96 + slamLift, 20, 66);
    ctx.fillStyle = '#d6d3c4';
    ctx.fillRect(16 - walk * 0.5, -36 + slamLift, 20, 9);

    // Wide Blind Sculk Head + Roaring Mouth + Vibrating Cyan Sculk Tendrils
    ctx.fillStyle = this.isHurt ? '#ffffff' : '#082635';
    ctx.fillRect(-26, -138, 56, 38);
    ctx.strokeRect(-26, -138, 56, 38);
    // Gaping mouth (no eyes!)
    const roarOpen = (this.state === 'sonic_windup' || this.state === 'sonic_active' || this.phase === 2) ? 16 : 9;
    ctx.fillStyle = '#02080d';
    ctx.fillRect(-6, -122, 28, roarOpen);
    ctx.fillStyle = '#d6d3c4';
    ctx.fillRect(-4, -122, 6, 4);
    ctx.fillRect(12, -122, 6, 4);

    // Vibrating Bioluminescent Sculk Tendril Ears
    const vib = Math.sin(t * 28) * (this.state === 'sonic_windup' || this.phase === 2 ? 6 : 2.5);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-24, -126);
    ctx.quadraticCurveTo(-48, -142 + vib, -54, -120 - vib);
    ctx.moveTo(28, -126);
    ctx.quadraticCurveTo(50, -144 - vib, 56, -122 + vib);
    ctx.stroke();

    ctx.restore();
  };

  // 5. CreakingBoss 2D Canvas Renderer (Stage 21: Pale Garden)
  CreakingBoss.prototype.draw = function drawCreakingBoss2D(ctx, crowded = false) {
    if (this.isDead) return;
    const isStatue = this.actionKind === 'creaking_statue';
    const rawT = this.animTimer || 0;
    // Quantized jerky wooden puppet steps when unobserved; frozen at 0 when watched!
    const puppetT = isStatue ? 0 : Math.floor(rawT * 9) / 9;
    const stride = isStatue ? 0 : (Math.abs(this.vx) > 12 || this.state === 'blink_active' ? Math.sin(puppetT * 12) * 16 : 0);
    const dir = this.facing >= 0 ? 1 : -1;

    ctx.save();

    // 1. Resin Heart-Tether Particle Stream to Center Pale Oak Shrine (0, groundY - 165)
    const showTether = this.isHurt || this.actionKind === 'creaking_surge' || this.state === 'phase_shift' || this.isAwakened;
    if (showTether) {
      const shrineX = 0;
      const shrineY = (this.groundY || 0) - 165;
      const chestX = this.x;
      const chestY = this.y - 78;

      ctx.save();
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.72)';
      ctx.lineWidth = this.actionKind === 'creaking_surge' ? 4.5 : 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(chestX, chestY);
      ctx.lineTo(shrineX, shrineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Streaming Orange Resin Orbs along the tether
      for (let p = 0; p < 6; p++) {
        const u = ((rawT * 2.4 + p / 6) % 1);
        const px = chestX + (shrineX - chestX) * u;
        const py = chestY + (shrineY - chestY) * u + Math.sin(u * Math.PI * 2 + rawT * 8) * 5;
        ctx.fillStyle = p % 2 === 0 ? '#f97316' : '#fde047';
        ctx.fillRect(px - 4, py - 4, 8, 8);
      }
      ctx.restore();
    }

    // 2. Pale Root Snare Spikes erupting during roots_active
    if (this.state === 'roots_active' && this.dropXs) {
      ctx.save();
      for (let k = 0; k < this.dropXs.length; k++) {
        const rx = this.dropXs[k];
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx - 22, this.groundY);
        ctx.lineTo(rx - 6, this.groundY - 62);
        ctx.lineTo(rx + 8, this.groundY - 46);
        ctx.lineTo(rx + 22, this.groundY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);

    if (this.phase === 2 && !crowded) {
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 16;
    }

    const barkBase = this.isHurt ? '#ffffff' : (isStatue ? '#94a3b8' : '#b8bec6');
    const barkDark = '#475569';

    // Asymmetrical Pale Oak Stilt Legs (left leg thin & knotted, right leg thicker & crooked)
    ctx.fillStyle = barkBase;
    ctx.strokeStyle = barkDark;
    ctx.lineWidth = 2.2;
    ctx.fillRect(-18 + stride, -54, 11, 54);
    ctx.strokeRect(-18 + stride, -54, 11, 54);
    ctx.fillRect(6 - stride, -58, 14, 58);
    ctx.strokeRect(6 - stride, -58, 14, 58);
    // Glowing orange resin sap seam on right leg
    ctx.fillStyle = '#f97316';
    ctx.fillRect(11 - stride, -40, 4, 18);

    // Crooked Wooden Puppet Trunk + Glowing Orange Resin Heart Core
    ctx.save();
    ctx.rotate(isStatue ? 0 : 0.09);
    ctx.fillStyle = barkBase;
    ctx.fillRect(-17, -104, 34, 50);
    ctx.strokeRect(-17, -104, 34, 50);

    // Vertical bark grain striations
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-10, -100, 3, 42);
    ctx.fillRect(7, -100, 3, 42);

    // Resin Heart Core in chest cavity
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(-7, -86, 15, 18);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-3, -81, 7, 8);

    // Asymmetrical Lanky Branch Arms (one long dragging claw, one high crooked branch)
    const slashSwing = this.state === 'blink_active' ? -24 : stride * 0.7;
    ctx.fillStyle = barkBase;
    ctx.fillRect(14, -98 + slashSwing * 0.4, 11, 66);
    ctx.strokeRect(14, -98 + slashSwing * 0.4, 11, 66);
    ctx.fillRect(-26, -108 - slashSwing * 0.4, 10, 52);
    ctx.strokeRect(-26, -108 - slashSwing * 0.4, 10, 52);

    // Crooked 3-Prong Pale Oak Crown Head + 3 Vertically-Staggered Glowing Orange Eyes!
    ctx.save();
    ctx.translate(2, -124);
    ctx.rotate(isStatue ? -0.14 : -0.14 + Math.sin(puppetT * 7) * 0.06);
    ctx.fillStyle = barkBase;
    ctx.fillRect(-18, -22, 36, 40);
    ctx.strokeRect(-18, -22, 36, 40);

    // 3 Asymmetrical Crown Prongs
    ctx.fillRect(-18, -38, 9, 16);
    ctx.strokeRect(-18, -38, 9, 16);
    ctx.fillRect(-3, -46, 10, 24);
    ctx.strokeRect(-3, -46, 10, 24);
    ctx.fillRect(10, -34, 8, 12);
    ctx.strokeRect(10, -34, 8, 12);

    // 3 Signature Vertically-Staggered Glowing Orange Eyes!
    const eyes = [
      { ex: -6, ey: -12 },
      { ex: 8, ey: -4 },
      { ex: -1, ey: 6 }
    ];
    for (let e = 0; e < eyes.length; e++) {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(eyes[e].ex - 4, eyes[e].ey - 3.5, 8, 7);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(eyes[e].ex - 1.5, eyes[e].ey - 1.5, 3.5, 3.5);
    }
    ctx.restore();
    ctx.restore();

    // Gaze-Freeze Bark Statue Indicator
    if (isStatue) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('👁 FROZEN', 0, -172);
    }

    ctx.restore();
  };

  // 6. MercenaryBoss 2D Canvas Renderer (Stage 22: Rocket Corp HQ)
  const agentRenderer = new StickFigureRenderer('#1e293b', 5.8, 1.22, false);
  const primalRenderer = new StickFigureRenderer('#92400e', 6.5, 1.28, false);
  primalRenderer.isHunched = true;

  MercenaryBoss.prototype.draw = function drawMercenaryBoss2D(ctx, crowded = false) {
    if (this.isDead) return;
    const dir = this.facing >= 0 ? 1 : -1;
    const t = this.animTimer || 0;

    if (this.type === 'mercenary_ballista') {
      // BALLISTA: Pure 8-Bit Stepped Pixel-Art Stick Soldier!
      const step = Math.abs(this.vx) > 15 ? (Math.floor(t * 10) % 2 === 0 ? 10 : -10) : 0;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(dir, 1);

      const pxColor = this.isHurt ? '#ffffff' : '#e2e8f0';
      // Pixel Legs (stepped blocks)
      ctx.fillStyle = pxColor;
      ctx.fillRect(-12 + step, -26, 8, 26);
      ctx.fillRect(4 - step, -26, 8, 26);
      // Pixel Torso
      ctx.fillRect(-8, -56, 16, 30);
      // Red 8-Bit Tactical Vest Accent
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-8, -50, 16, 10);
      // Square 8-Bit Pixel Head + Red Pixel Headband
      ctx.fillStyle = pxColor;
      ctx.fillRect(-13, -82, 26, 24);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-14, -76, 28, 6);
      ctx.fillRect(-22, -74, 8, 5);
      // Pixel Visor Eyes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(2, -70, 8, 5);

      // 8-Bit Pixel Bazooka on Shoulder
      ctx.fillStyle = '#334155';
      ctx.fillRect(-18, -62, 54, 14);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(26, -64, 12, 18);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(6, -58, 10, 6);

      ctx.restore();
      return;
    }

    if (this.type === 'mercenary_hazard') {
      // HAZARD: Flat Warning-Sign Pictogram Stickman (2-frame snappy pose + floating head & triangle torso)
      const snap = Math.floor((this._rawTimer || t) * 5) % 2;
      const legSpread = Math.abs(this.vx) > 15 ? (snap === 0 ? 15 : 5) : 10;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(dir, 1);

      ctx.strokeStyle = '#facc15';
      ctx.fillStyle = this.isHurt ? '#ffffff' : '#111827';
      ctx.lineWidth = 3;

      // Crisp Pictogram Legs (detached gap from torso like a wet-floor / high-voltage sign!)
      ctx.beginPath();
      ctx.moveTo(-5, -28);
      ctx.lineTo(-legSpread, -2);
      ctx.moveTo(5, -28);
      ctx.lineTo(legSpread, -2);
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#facc15';
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = this.isHurt ? '#ffffff' : '#111827';
      ctx.stroke();

      // Pictogram Tapered Sign Torso
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(-15, -60);
      ctx.lineTo(15, -60);
      ctx.lineTo(9, -31);
      ctx.lineTo(-9, -31);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Floating Detached Pictogram Circle Head
      ctx.beginPath();
      ctx.arc(0, -76, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pictogram Arm holding High-Voltage Caution Triangle Sign
      StickFigureRenderer.prototype.drawWeapon.call(
        agentRenderer,
        ctx,
        { x: 18, y: -46 },
        'hazard_sign',
        snap === 0 ? 0.55 : 0.85,
        false
      );

      ctx.restore();
      return;
    }

    if (this.type === 'mercenary_primal') {
      // PRIMAL: Muscular Hunched Hunter + Fur Pelt + Stone Spear
      primalRenderer.draw(ctx, {
        x: this.x,
        y: this.y,
        facing: dir,
        pose: this.pose || 'idle',
        animTimer: t,
        isGrounded: this.isGrounded,
        isHurt: this.isHurt,
        isAwakened: false,
        weaponType: 'stone_spear',
        scale: 1.0,
        alpha: 1.0
      });
      // Fur Pelt Sash & Bone Clasp overlay
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(dir, 1);
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(-10, -54);
      ctx.lineTo(14, -48);
      ctx.lineTo(10, -24);
      ctx.lineTo(-12, -30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(2, -55, 8, 5);
      ctx.restore();
      return;
    }

    // AGENT: Dark Charcoal Stickman + Pitch-Black Wrap-Around Sunglasses + UI Toolbar Staff
    agentRenderer.draw(ctx, {
      x: this.x,
      y: this.y,
      facing: dir,
      pose: this.pose || 'idle',
      animTimer: t,
      isGrounded: this.isGrounded,
      isHurt: this.isHurt,
      isAwakened: false,
      weaponType: 'toolbar_staff',
      scale: 1.0,
      alpha: 1.0
    });

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);
    const bob = this.pose === 'run' ? Math.abs(Math.sin(t * 14)) * 3 : Math.sin(t * 5) * 2;
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4;
    ctx.fillRect(-4, -81 + bob, 20, 7);
    ctx.strokeRect(-4, -81 + bob, 20, 7);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(2, -80 + bob);
    ctx.lineTo(6, -75 + bob);
    ctx.stroke();
    ctx.restore();
  };
}
