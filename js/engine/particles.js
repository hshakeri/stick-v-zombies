// Particle and Visual FX Engine for dynamic Alan Becker style animation juice

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.damageTexts = [];
    this.slashArcs = [];
    this.shockwaves = [];
    this.comicPopups = [];
    this.limbDebris = [];
    this.speedlinesTimer = 0;
    this.speedlinesMax = 0;
  }

  triggerSpeedlines(duration = 0.25) {
    this.speedlinesTimer = duration;
    this.speedlinesMax = duration;
  }

  update(dt) {
    if (this.speedlinesTimer > 0) {
      this.speedlinesTimer -= dt;
    }

    // Update general particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.drag) {
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
      }
      if (p.rotSpeed) p.rotation += p.rotSpeed * dt;
    }

    // Update Limb Debris (Bouncing Stick Figure Bones)
    for (let i = this.limbDebris.length - 1; i >= 0; i--) {
      const limb = this.limbDebris[i];
      limb.life -= dt;
      if (limb.life <= 0) {
        this.limbDebris.splice(i, 1);
        continue;
      }
      limb.vy += 950 * dt;
      limb.x += limb.vx * dt;
      limb.y += limb.vy * dt;
      limb.rotation += limb.rotSpeed * dt;
      if (limb.y >= limb.groundY) {
        limb.y = limb.groundY;
        limb.vy = -limb.vy * 0.45;
        limb.vx *= 0.75;
      }
    }

    // Update Comic Action SFX Popups (POW!, KRAK!, SLASH!)
    for (let i = this.comicPopups.length - 1; i >= 0; i--) {
      const c = this.comicPopups[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.comicPopups.splice(i, 1);
        continue;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rotation += c.rotSpeed * dt;
      if (c.scale < 1.0) c.scale = Math.min(1.0, c.scale + dt * 12);
    }

    // Update Floating Damage Texts
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const t = this.damageTexts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.damageTexts.splice(i, 1);
        continue;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vy += 80 * dt; // slight downward gravity
    }

    // Update Slash Arcs
    for (let i = this.slashArcs.length - 1; i >= 0; i--) {
      const arc = this.slashArcs[i];
      arc.life -= dt;
      if (arc.life <= 0) {
        this.slashArcs.splice(i, 1);
      }
    }

    // Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      sw.radius += sw.growSpeed * dt;
    }
  }

  draw(ctx) {
    // 1. Draw Shockwaves
    for (const sw of this.shockwaves) {
      const progress = 1 - sw.life / sw.maxLife;
      const alpha = (1 - progress) * (sw.maxAlpha || 0.8);
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = sw.thickness * (1 - progress);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw Slash Arcs
    for (const arc of this.slashArcs) {
      const progress = 1 - arc.life / arc.maxLife;
      const alpha = 1 - progress;
      ctx.save();
      ctx.translate(arc.x, arc.y);
      ctx.rotate(arc.angle);
      ctx.scale(arc.facing, 1);
      ctx.beginPath();
      ctx.arc(0, 0, arc.radius, -arc.arcAngle / 2, arc.arcAngle / 2);
      ctx.strokeStyle = arc.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = arc.thickness * (1 - progress * 0.5);
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Particles
    for (const p of this.particles) {
      const progress = 1 - p.life / p.maxLife;
      const alpha = p.fade ? (1 - progress) * p.initialAlpha : p.initialAlpha;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(p.x, p.y);
      if (p.rotation) ctx.rotate(p.rotation);

      if (p.type === 'spark' || p.type === 'star') {
        // Comic Impact Star Burst
        ctx.fillStyle = p.color;
        const size = Math.max(1, p.size * (1 - progress * 0.4));
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.3, -size * 0.3);
        ctx.lineTo(size, 0);
        ctx.lineTo(size * 0.3, size * 0.3);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.3, size * 0.3);
        ctx.lineTo(-size, 0);
        ctx.lineTo(-size * 0.3, -size * 0.3);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'line') {
        // Impact Action Line
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.lineWidth || 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-p.vx * 0.04, -p.vy * 0.04);
        ctx.stroke();
      } else if (p.type === 'ink') {
        // Zombie Ink / Blood Drops
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 - progress * 0.2), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'dust') {
        // Movement Dust Puff
        ctx.fillStyle = p.color || '#a0a5ba';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 + progress * 0.8), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'aura') {
        // Awakening Fire / Energy Particle
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Default Circle
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 4. Draw Stick Figure Bone & Limb Debris
    for (const limb of this.limbDebris) {
      const progress = 1 - limb.life / limb.maxLife;
      const alpha = limb.life < 0.4 ? limb.life / 0.4 : 1.0;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(limb.x, limb.y);
      ctx.rotate(limb.rotation);
      ctx.strokeStyle = limb.color;
      ctx.fillStyle = limb.color;
      ctx.lineWidth = limb.width || 4;
      ctx.lineCap = 'round';

      if (limb.isHead) {
        ctx.beginPath();
        ctx.arc(0, 0, limb.radius || 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-limb.length / 2, 0);
        ctx.lineTo(limb.length / 2, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Draw Comic Action SFX Popups (POW!, KRAK!, SMASH!)
    for (const c of this.comicPopups) {
      const progress = 1 - c.life / c.maxLife;
      const alpha = c.life < 0.2 ? c.life / 0.2 : 1.0;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.scale(c.scale, c.scale);

      // 1. Spiky Starburst Comic Badge
      const spikes = 10;
      const outerR = c.size || 38;
      const innerR = outerR * 0.55;
      ctx.fillStyle = c.bgColor || '#ff1744';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / spikes;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Comic Text
      ctx.font = "900 18px 'Bungee', 'Impact', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText(c.text, 0, 0);
      ctx.fillStyle = c.textColor || '#ffee00';
      ctx.fillText(c.text, 0, 0);

      ctx.restore();
    }

    // 6. Draw Floating Damage Numbers
    for (const t of this.damageTexts) {
      const progress = 1 - t.life / t.maxLife;
      const alpha = 1 - Math.pow(progress, 2);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(t.x, t.y);

      // Scale pop effect
      const scale = t.isCrit ? Math.max(1, 1.6 - progress * 0.6) : Math.max(0.8, 1.2 - progress * 0.4);
      ctx.scale(scale, scale);

      ctx.font = t.isCrit ? "bold 22px 'Bungee', cursive" : "bold 16px 'Nunito', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(t.text, 0, 0);

      // Fill
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);

      ctx.restore();
    }

    // 7. Draw Anime Radial Speedlines on Mega Finisher Impacts
    if (this.speedlinesTimer > 0) {
      const alpha = Math.min(0.65, (this.speedlinesTimer / this.speedlinesMax) * 0.7);
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2.5;

      const numLines = 24;
      const centerDist = 240;
      const outerDist = 950;
      for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * centerDist, Math.sin(angle) * centerDist);
        ctx.lineTo(Math.cos(angle) * outerDist, Math.sin(angle) * outerDist);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // --- Particle Spawners ---

  createHitSparks(x, y, count = 8, color = '#ffdd44') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 260;
      this.particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        color,
        life: 0.15 + Math.random() * 0.15,
        maxLife: 0.3,
        initialAlpha: 1.0,
        fade: true,
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 15,
        drag: 0.92
      });

      // Also add action lines
      this.particles.push({
        type: 'line',
        x,
        y,
        vx: Math.cos(angle) * speed * 1.5,
        vy: Math.sin(angle) * speed * 1.5,
        color: '#ffffff',
        lineWidth: 3,
        life: 0.1,
        maxLife: 0.1,
        initialAlpha: 0.9,
        fade: true
      });
    }
  }

  createZombieSplatter(x, y, count = 12, color = '#44ee55') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 280;
      this.particles.push({
        type: 'ink',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        gravity: 450,
        size: 3 + Math.random() * 5,
        color,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        initialAlpha: 0.9,
        fade: true,
        drag: 0.96
      });
    }
  }

  createDust(x, y, count = 5, dir = 0) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * 0.8;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        type: 'dust',
        x: x + (Math.random() - 0.5) * 16,
        y,
        vx: (dir !== 0 ? -dir * speed : Math.cos(angle) * speed),
        vy: -20 - Math.random() * 40,
        gravity: 60,
        size: 4 + Math.random() * 6,
        color: 'rgba(200, 205, 220, 0.4)',
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        initialAlpha: 0.6,
        fade: true
      });
    }
  }

  createAwakeningAura(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'aura',
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 50,
        vy: -100 - Math.random() * 120,
        size: 4 + Math.random() * 8,
        color: Math.random() > 0.3 ? '#ffaa00' : '#ffee33',
        life: 0.3 + Math.random() * 0.25,
        maxLife: 0.55,
        initialAlpha: 0.8,
        fade: true
      });
    }
  }

  addSlashArc(x, y, radius = 60, angle = 0, facing = 1, color = '#ffaa22', thickness = 6) {
    this.slashArcs.push({
      x,
      y,
      radius,
      angle,
      facing,
      arcAngle: Math.PI * 0.7,
      color,
      thickness,
      life: 0.12,
      maxLife: 0.12
    });
  }

  createPencilLeadTrail(x, y, count = 6, facing = 1) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * 1.2 + (facing > 0 ? 0 : Math.PI);
      const speed = 60 + Math.random() * 140;
      this.particles.push({
        type: 'line',
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        color: '#333333',
        lineWidth: 2.5,
        life: 0.16,
        maxLife: 0.16,
        initialAlpha: 0.85,
        fade: true
      });
    }
  }

  addShockwave(x, y, maxRadius = 120, color = '#ff7700', thickness = 8) {
    if (this.shockwaves.length >= 8) this.shockwaves.shift();
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      growSpeed: maxRadius / 0.25,
      thickness,
      color,
      life: 0.25,
      maxLife: 0.25,
      maxAlpha: 0.9
    });
  }

  addDamageText(x, y, amount, isCrit = false, customColor = null) {
    if (this.damageTexts.length >= 25) this.damageTexts.shift();
    let color = '#ffffff';
    let text = typeof amount === 'number' ? `${Math.round(amount)}` : `${amount}`;

    if (customColor) {
      color = customColor;
    } else if (isCrit) {
      color = '#ffea00';
      text = `CRIT! ${Math.round(amount)}`;
    }

    this.damageTexts.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y - 20,
      vx: (Math.random() - 0.5) * 50,
      vy: -120 - (isCrit ? 40 : 0),
      text,
      color,
      isCrit,
      life: 0.7,
      maxLife: 0.7
    });
  }

  addTextBanner(x, y, text, color = '#ff8800') {
    if (this.damageTexts.length >= 25) this.damageTexts.shift();
    this.damageTexts.push({
      x,
      y: y - 40,
      vx: 0,
      vy: -60,
      text,
      color,
      isCrit: true,
      life: 1.2,
      maxLife: 1.2
    });
  }

  addComicPopup(x, y, text = 'POW!', bgColor = '#ff1744', textColor = '#ffee00') {
    if (this.comicPopups.length >= 6) this.comicPopups.shift();
    this.comicPopups.push({
      x,
      y: y - 25,
      vx: (Math.random() - 0.5) * 40,
      vy: -70 - Math.random() * 50,
      rotation: (Math.random() - 0.5) * 0.4,
      rotSpeed: (Math.random() - 0.5) * 0.8,
      scale: 0.2,
      text,
      bgColor,
      textColor,
      size: 42,
      life: 0.55,
      maxLife: 0.55
    });
  }

  createStickLimbExplosion(x, y, groundY = 0, color = '#2e7d32') {
    while (this.limbDebris.length > 20) {
      this.limbDebris.shift();
    }
    // 1. Head circle piece
    this.limbDebris.push({
      x,
      y: y - 30,
      vx: (Math.random() - 0.5) * 350,
      vy: -280 - Math.random() * 220,
      groundY,
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 12,
      isHead: true,
      radius: 9,
      color,
      life: 1.8,
      maxLife: 1.8
    });

    // 2. Torso and 4 limbs
    const lengths = [26, 18, 18, 20, 20];
    for (const len of lengths) {
      this.limbDebris.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y - 20,
        vx: (Math.random() - 0.5) * 420,
        vy: -220 - Math.random() * 260,
        groundY,
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 15,
        isHead: false,
        length: len,
        width: 4.5,
        color,
        life: 1.8,
        maxLife: 1.8
      });
    }
  }
}

export const particles = new ParticleSystem();
