// Procedural Stick Figure Skeleton and Animation Renderer (Alan Becker / The Second Coming Style)

export class StickFigureRenderer {
  constructor(color = '#ff7700', strokeWidth = 5, scale = 1.0, isHollowHead = false) {
    this.color = color;
    this.strokeWidth = strokeWidth;
    this.scale = scale;
    this.glowColor = null;
    this.isHunched = false; // For zombies
    this.isZombie = false; // For undead stickmen
    this.isHollowHead = isHollowHead; // true for The Second Coming (Orange), false for Red/Blue/Yellow/Green
  }

  // Draw procedural stick figure based on character state & pose
  draw(ctx, state) {
    const {
      x, y, facing, pose, animTimer, isGrounded, isHurt,
      isAwakened, weaponType, weaponAngle, scale = 1.0, alpha = 1.0,
      squashX = 1.0, squashY = 1.0, leanAngle = 0
    } = state;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(leanAngle * (facing >= 0 ? 1 : -1));
    ctx.scale(facing * scale * this.scale * squashX, scale * this.scale * squashY);

    // Awakening God Mode Multi-Tier Glow
    if (isAwakened) {
      ctx.shadowColor = '#ffbb00';
      ctx.shadowBlur = 28;
    } else if (this.isZombie) {
      ctx.shadowColor = 'rgba(30, 160, 30, 0.45)';
      ctx.shadowBlur = 10;
    }

    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Calculate bone joints based on current pose
    const bones = this.computePoseBones(pose, animTimer, isGrounded, isHurt);

    // 1. Draw Legs (back leg then front leg)
    this.drawLimb(ctx, bones.hip, bones.kneeL, bones.footL);
    this.drawLimb(ctx, bones.hip, bones.kneeR, bones.footR);

    // 2. Draw Torso / Curved Spine (Alan Becker dynamic spine flex)
    ctx.beginPath();
    ctx.moveTo(bones.hip.x, bones.hip.y);
    if (this.isHunched) {
      ctx.quadraticCurveTo(bones.hip.x + 12, (bones.hip.y + bones.neck.y) * 0.5, bones.neck.x, bones.neck.y);
    } else if (pose === 'run' || pose === 'jump_rise') {
      ctx.quadraticCurveTo((bones.hip.x + bones.neck.x) * 0.5 + 4, (bones.hip.y + bones.neck.y) * 0.5, bones.neck.x, bones.neck.y);
    } else if (pose === 'attack_kick' || pose === 'dive_kick') {
      ctx.quadraticCurveTo((bones.hip.x + bones.neck.x) * 0.5 - 5, (bones.hip.y + bones.neck.y) * 0.5, bones.neck.x, bones.neck.y);
    } else {
      ctx.lineTo(bones.neck.x, bones.neck.y);
    }
    ctx.stroke();

    // 3. Draw Arms (back arm then front arm)
    this.drawLimb(ctx, bones.shoulder, bones.elbowL, bones.handL);
    this.drawLimb(ctx, bones.shoulder, bones.elbowR, bones.handR);

    // 4. Draw Head (Hollow Ring for Orange, Solid Filled for Allies and Zombies)
    ctx.beginPath();
    ctx.arc(bones.head.x, bones.head.y, bones.headRadius, 0, Math.PI * 2);
    if (this.isHollowHead) {
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.stroke();
    }

    // Facial expressions (Eyes / Angry Brow / God Eyes / Zombie Eyes)
    if (isAwakened) {
      // Radiant Glowing Eyes with Divine Spark
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(bones.head.x + 4, bones.head.y - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(bones.head.x + 5, bones.head.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.isZombie) {
      // Menacing Glowing Red Zombie Eyes
      ctx.fillStyle = '#ff1122';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(bones.head.x + 4, bones.head.y - 3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // Glowing Eye Slit Pupil
      ctx.fillStyle = '#ffee33';
      ctx.beginPath();
      ctx.arc(bones.head.x + 5, bones.head.y - 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Snarl Fangs
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bones.head.x + 2, bones.head.y + 4);
      ctx.lineTo(bones.head.x + 6, bones.head.y + 3);
      ctx.moveTo(bones.head.x + 4, bones.head.y + 3);
      ctx.lineTo(bones.head.x + 4, bones.head.y + 6);
      ctx.stroke();
    } else if (isHurt) {
      // Hurt 'X' Eyes
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bones.head.x + 2, bones.head.y - 4);
      ctx.lineTo(bones.head.x + 6, bones.head.y);
      ctx.moveTo(bones.head.x + 6, bones.head.y - 4);
      ctx.lineTo(bones.head.x + 2, bones.head.y);
      ctx.stroke();
    } else if (pose.startsWith('attack') || pose === 'weapon_slash' || pose === 'dive_kick') {
      // Determined / Fierce Combat Eyebrow & Focused Slits
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(bones.head.x + 1, bones.head.y - 4);
      ctx.lineTo(bones.head.x + 7, bones.head.y - 1);
      ctx.stroke();
    }

    // 5. Draw Active Weapon
    if (weaponType) {
      let angle = weaponAngle !== undefined ? weaponAngle : -0.6;
      if (pose === 'weapon_slash') {
        angle = 1.35; // Swept forward during slash
      } else if (pose.startsWith('attack')) {
        angle = -1.1; // Held back during punches
      }
      this.drawWeapon(ctx, bones.handR, weaponType, angle, isAwakened);
      if (weaponType === 'vira_blades') {
        this.drawWeapon(ctx, bones.handL, weaponType, -angle * 0.85, isAwakened);
      }
    }

    ctx.restore();
  }

  drawLimb(ctx, start, mid, end) {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(mid.x, mid.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  drawWeapon(ctx, handPos, weaponType, angle, isAwakened) {
    ctx.save();
    ctx.translate(handPos.x, handPos.y);
    ctx.rotate(angle);

    if (weaponType === 'pencil') {
      // Giant Alan Becker Pencil with 3D Facet Shading
      // Wooden Body Left Side (Highlight)
      ctx.fillStyle = isAwakened ? '#fff176' : '#ffb74d';
      ctx.fillRect(-7, -68, 4, 68);
      // Wooden Body Middle (Base)
      ctx.fillStyle = isAwakened ? '#ffee33' : '#ff9800';
      ctx.fillRect(-3, -68, 6, 68);
      // Wooden Body Right Side (Shadow)
      ctx.fillStyle = isAwakened ? '#fbc02d' : '#e65100';
      ctx.fillRect(3, -68, 4, 68);

      // Pencil Wood Grain Lines
      ctx.strokeStyle = isAwakened ? '#f57f17' : '#bf360c';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-3, -68); ctx.lineTo(-3, 0);
      ctx.moveTo(3, -68); ctx.lineTo(3, 0);
      ctx.stroke();

      // Sharpened Wooden Cone (Cedar Wood Texture)
      ctx.fillStyle = '#ffcc80';
      ctx.beginPath();
      ctx.moveTo(-7, -68);
      ctx.lineTo(7, -68);
      ctx.lineTo(0, -92);
      ctx.closePath();
      ctx.fill();

      // Sharp Dark Graphite Lead Tip
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.moveTo(-3.5, -78);
      ctx.lineTo(3.5, -78);
      ctx.lineTo(0, -92);
      ctx.closePath();
      ctx.fill();

      // Graphite Tip Specular Shine
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-0.5, -84, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Silver Metal Ferrule with Crimp Bands
      ctx.fillStyle = '#b0bec5';
      ctx.fillRect(-7, 0, 14, 8);
      ctx.fillStyle = '#78909c';
      ctx.fillRect(-7, 3, 14, 2);

      // Pink Rubber Eraser
      ctx.fillStyle = '#ff80ab';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-7, 8, 14, 14, [0, 0, 4, 4]) : ctx.fillRect(-7, 8, 14, 14);
      ctx.fill();
    } else if (weaponType === 'staff') {
      // Red Martial Arts Staff / Fighting Stick
      ctx.fillStyle = isAwakened ? '#ffee33' : '#d32f2f';
      ctx.fillRect(-4.5, -70, 9, 140);
      // Gold Trim Bands
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-5.5, -70, 11, 12);
      ctx.fillRect(-5.5, 58, 11, 12);
      ctx.fillRect(-5.5, -6, 11, 12); // Center grip band
      // Center Grip Wrap pattern
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-5.5, -4); ctx.lineTo(5.5, 4);
      ctx.moveTo(-5.5, 0); ctx.lineTo(5.5, 8);
      ctx.stroke();
    } else if (weaponType === 'eraser') {
      // Giant Pink Eraser with bevel
      ctx.fillStyle = '#ff80ab';
      ctx.fillRect(-18, -44, 36, 54);
      ctx.fillStyle = '#f50057';
      ctx.fillRect(14, -44, 4, 54);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-18, -44, 36, 54);
    } else if (weaponType === 'vira_blades') {
      // The Dark Lord's Dual Red Vira-Blades (AvA Lore)
      ctx.fillStyle = '#111111';
      ctx.fillRect(-3, -12, 6, 22);
      ctx.fillStyle = '#ff0033';
      ctx.fillRect(-7, -12, 14, 5);

      // Blazing Crimson Energy Plasma Blade
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#ff1744';
      ctx.beginPath();
      ctx.moveTo(-5, -12);
      ctx.lineTo(5, -12);
      ctx.lineTo(1.5, -84);
      ctx.lineTo(-1.5, -84);
      ctx.closePath();
      ctx.fill();

      // Pure White Energy Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-2, -12);
      ctx.lineTo(2, -12);
      ctx.lineTo(0.8, -78);
      ctx.lineTo(-0.8, -78);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  computePoseBones(pose, timer, isGrounded, isHurt) {
    const headRadius = 14;
    const neckBase = { x: 0, y: -45 };
    const hipBase = { x: 0, y: -20 };
    const headBase = { x: 0, y: -62 };

    if (this.isHunched) {
      neckBase.x += 8;
      headBase.x += 14;
      headBase.y += 4;
    }

    const bones = {
      headRadius,
      head: { ...headBase },
      neck: { ...neckBase },
      shoulder: { ...neckBase },
      hip: { ...hipBase },
      kneeL: { x: -6, y: -8 },
      footL: { x: -8, y: 0 },
      kneeR: { x: 6, y: -8 },
      footR: { x: 8, y: 0 },
      elbowL: { x: -10, y: -30 },
      handL: { x: -12, y: -15 },
      elbowR: { x: 10, y: -30 },
      handR: { x: 12, y: -15 }
    };

    if (isHurt) {
      // Reeling back
      bones.head.x -= 12;
      bones.neck.x -= 8;
      bones.hip.x -= 4;
      bones.handL = { x: -18, y: -35 };
      bones.handR = { x: -12, y: -40 };
      bones.footL = { x: -14, y: 0 };
      bones.footR = { x: 4, y: 0 };
      return bones;
    }

    switch (pose) {
      case 'zombie_idle': {
        const bob = Math.sin(timer * 3) * 3;
        bones.head.y += bob;
        bones.neck.x += 8;
        bones.head.x += 12;
        // Arms lunging forward slightly
        bones.elbowL = { x: 12, y: -30 + bob };
        bones.handL = { x: 22, y: -32 + bob };
        bones.elbowR = { x: 8, y: -24 - bob };
        bones.handR = { x: 18, y: -26 - bob };
        break;
      }

      case 'zombie_walk': {
        const t = timer * 8;
        const legSwing = Math.sin(t);
        bones.neck.x += 10;
        bones.head.x += 14;
        bones.head.y += Math.abs(Math.sin(t)) * 2.5;

        // Limbs dragging
        bones.kneeL = { x: legSwing * 12, y: -10 };
        bones.footL = { x: legSwing * 18, y: Math.max(-6, -legSwing * 6) };
        bones.kneeR = { x: -legSwing * 12, y: -10 };
        bones.footR = { x: -legSwing * 18, y: Math.max(-6, legSwing * 6) };

        // Both arms raised forward horizontally like classic zombies
        const armBob = Math.sin(timer * 4) * 3;
        bones.elbowL = { x: 16, y: -34 + armBob };
        bones.handL = { x: 28, y: -38 + armBob };
        bones.elbowR = { x: 12, y: -28 - armBob };
        bones.handR = { x: 24, y: -32 - armBob };
        break;
      }

      case 'idle': {
        const bob = Math.sin(timer * 5) * 2;
        bones.head.y += bob;
        bones.neck.y += bob * 0.8;
        bones.elbowL = { x: -12, y: -32 + bob };
        bones.handL = { x: -10, y: -18 + bob };
        bones.elbowR = { x: 12, y: -32 + bob };
        bones.handR = { x: 10, y: -18 + bob };
        break;
      }

      case 'run': {
        const t = timer * 14;
        const legSwing = Math.sin(t);
        const armSwing = Math.cos(t);

        bones.neck.x += 6;
        bones.head.x += 8;
        bones.head.y += Math.abs(Math.sin(t)) * 3;

        // Front leg
        bones.kneeL = { x: legSwing * 16, y: -12 - Math.max(0, -legSwing * 8) };
        bones.footL = { x: legSwing * 24, y: Math.max(-12, -legSwing * 10) };

        // Back leg
        bones.kneeR = { x: -legSwing * 16, y: -12 - Math.max(0, legSwing * 8) };
        bones.footR = { x: -legSwing * 24, y: Math.max(-12, legSwing * 10) };

        // Arms swinging with run
        bones.elbowL = { x: armSwing * 16, y: -30 };
        bones.handL = { x: armSwing * 24, y: -20 };
        bones.elbowR = { x: -armSwing * 16, y: -30 };
        bones.handR = { x: -armSwing * 24, y: -20 };
        break;
      }

      case 'jump_rise': {
        bones.head.y -= 4;
        bones.kneeL = { x: -10, y: -15 };
        bones.footL = { x: -8, y: -6 };
        bones.kneeR = { x: 8, y: -18 };
        bones.footR = { x: 12, y: -8 };
        bones.elbowL = { x: -16, y: -45 };
        bones.handL = { x: -18, y: -58 };
        bones.elbowR = { x: 16, y: -45 };
        bones.handR = { x: 18, y: -58 };
        break;
      }

      case 'jump_fall': {
        bones.kneeL = { x: -12, y: -6 };
        bones.footL = { x: -10, y: 4 };
        bones.kneeR = { x: 6, y: -4 };
        bones.footR = { x: 8, y: 6 };
        bones.elbowL = { x: -18, y: -35 };
        bones.handL = { x: -22, y: -25 };
        bones.elbowR = { x: 18, y: -35 };
        bones.handR = { x: 22, y: -25 };
        break;
      }

      case 'wall_slide': {
        bones.head.x -= 4;
        bones.elbowL = { x: 14, y: -38 };
        bones.handL = { x: 20, y: -40 };
        bones.elbowR = { x: -8, y: -28 };
        bones.handR = { x: -12, y: -16 };
        bones.kneeL = { x: 12, y: -14 };
        bones.footL = { x: 18, y: -4 };
        bones.kneeR = { x: -4, y: -8 };
        bones.footR = { x: 0, y: 0 };
        break;
      }

      case 'crouch': {
        bones.head.y += 18;
        bones.neck.y += 14;
        bones.hip.y += 10;
        bones.kneeL = { x: -14, y: -4 };
        bones.footL = { x: -18, y: 0 };
        bones.kneeR = { x: 14, y: -4 };
        bones.footR = { x: 18, y: 0 };
        bones.elbowL = { x: -14, y: -16 };
        bones.handL = { x: -16, y: -2 };
        bones.elbowR = { x: 14, y: -16 };
        bones.handR = { x: 16, y: -2 };
        break;
      }

      case 'roll': {
        // Full 360 ball roll
        const rot = timer * Math.PI * 4;
        bones.head = { x: Math.cos(rot) * 16, y: -20 + Math.sin(rot) * 16 };
        bones.kneeL = { x: Math.cos(rot + 2) * 14, y: -20 + Math.sin(rot + 2) * 14 };
        bones.footL = { x: Math.cos(rot + 2.5) * 18, y: -20 + Math.sin(rot + 2.5) * 18 };
        bones.kneeR = { x: Math.cos(rot + 3.5) * 14, y: -20 + Math.sin(rot + 3.5) * 14 };
        bones.footR = { x: Math.cos(rot + 4) * 18, y: -20 + Math.sin(rot + 4) * 18 };
        bones.handL = { x: Math.cos(rot + 1) * 16, y: -20 + Math.sin(rot + 1) * 16 };
        bones.handR = { x: Math.cos(rot + 5) * 16, y: -20 + Math.sin(rot + 5) * 16 };
        break;
      }

      case 'attack_jab': {
        // Crisp straight left jab
        bones.head.x += 4;
        bones.shoulder.x += 4;
        bones.elbowL = { x: 16, y: -42 };
        bones.handL = { x: 34, y: -42 }; // Lead fist thrust forward
        bones.elbowR = { x: -8, y: -34 };
        bones.handR = { x: 4, y: -38 }; // Guard
        bones.footL = { x: 14, y: 0 };
        bones.footR = { x: -12, y: 0 };
        break;
      }

      case 'attack_cross': {
        // Heavy straight right cross punch
        bones.head.x += 8;
        bones.neck.x += 10;
        bones.elbowL = { x: 2, y: -38 };
        bones.handL = { x: 8, y: -42 }; // Guard
        bones.elbowR = { x: 22, y: -40 };
        bones.handR = { x: 44, y: -38 }; // Deep cross
        bones.kneeL = { x: 10, y: -10 };
        bones.footL = { x: 16, y: 0 };
        bones.kneeR = { x: -10, y: -12 };
        bones.footR = { x: -18, y: 0 };
        break;
      }

      case 'attack_kick': {
        // High martial arts head kick
        bones.head.x -= 10;
        bones.neck.x -= 6;
        bones.elbowL = { x: -14, y: -38 };
        bones.handL = { x: -8, y: -46 };
        bones.elbowR = { x: 10, y: -32 };
        bones.handR = { x: 14, y: -20 };
        // Kicking leg thrust high
        bones.kneeL = { x: 18, y: -36 };
        bones.footL = { x: 42, y: -48 };
        // Plant leg
        bones.kneeR = { x: -4, y: -10 };
        bones.footR = { x: -6, y: 0 };
        break;
      }

      case 'attack_axe_kick': {
        // Overhead Somersault Axe Kick Slam
        bones.head.x += 14;
        bones.head.y -= 10;
        bones.neck.x += 12;
        bones.hip.x += 6;
        bones.elbowL = { x: -16, y: -48 };
        bones.handL = { x: -24, y: -58 };
        bones.elbowR = { x: 14, y: -44 };
        bones.handR = { x: 22, y: -52 };
        // Front axe leg slamming down from above
        bones.kneeL = { x: 28, y: -45 };
        bones.footL = { x: 38, y: 8 };
        // Plant leg
        bones.kneeR = { x: -12, y: -10 };
        bones.footR = { x: -16, y: 0 };
        break;
      }

      case 'attack_spin': {
        // 360 Hurricane Spin Kick
        const spin = Math.sin(timer * 20);
        bones.head.y -= 8;
        bones.hip.y -= 12;
        bones.kneeL = { x: spin * 28, y: -30 };
        bones.footL = { x: spin * 46, y: -32 };
        bones.kneeR = { x: -spin * 24, y: -22 };
        bones.footR = { x: -spin * 36, y: -16 };
        bones.elbowL = { x: -spin * 18, y: -45 };
        bones.handL = { x: -spin * 28, y: -45 };
        bones.elbowR = { x: spin * 18, y: -45 };
        bones.handR = { x: spin * 28, y: -45 };
        break;
      }

      case 'attack_uppercut': {
        // Rising Dragon Uppercut
        bones.head.x += 6;
        bones.head.y -= 14;
        bones.neck.y -= 10;
        bones.elbowL = { x: -14, y: -32 };
        bones.handL = { x: -12, y: -20 };
        bones.elbowR = { x: 16, y: -55 };
        bones.handR = { x: 20, y: -80 }; // Firing straight up
        bones.kneeL = { x: -4, y: -14 };
        bones.footL = { x: -6, y: -4 };
        bones.kneeR = { x: 12, y: -24 };
        bones.footR = { x: 16, y: -14 };
        break;
      }

      case 'attack_drill_thrust': {
        // High-Speed Pencil Corkscrew Drill Thrust
        bones.head.x += 20;
        bones.neck.x += 18;
        bones.hip.x += 10;
        bones.elbowL = { x: 14, y: -36 };
        bones.handL = { x: 26, y: -36 };
        bones.elbowR = { x: 30, y: -34 };
        bones.handR = { x: 48, y: -34 }; // Both hands driving pencil forward
        bones.kneeL = { x: 16, y: -6 };
        bones.footL = { x: 24, y: 0 };
        bones.kneeR = { x: -14, y: -8 };
        bones.footR = { x: -22, y: 0 };
        break;
      }

      case 'attack_vault_kick': {
        // Pencil Ground Vault Dropkick
        bones.head.x += 16;
        bones.head.y += 6;
        bones.elbowL = { x: 8, y: -20 };
        bones.handL = { x: 14, y: 0 }; // Planting pencil into ground
        bones.elbowR = { x: -12, y: -35 };
        bones.handR = { x: -18, y: -45 };
        // Both legs vaulted forward in dropkick
        bones.kneeL = { x: 32, y: -14 };
        bones.footL = { x: 50, y: -10 };
        bones.kneeR = { x: 28, y: -22 };
        bones.footR = { x: 46, y: -18 };
        break;
      }

      case 'attack_air_flurry': {
        // Rapid Mid-Air Lightning Kicks
        const alt = Math.sin(timer * 25);
        bones.head.x += 8;
        bones.elbowL = { x: -16, y: -38 };
        bones.handL = { x: -22, y: -30 };
        bones.elbowR = { x: 12, y: -38 };
        bones.handR = { x: 18, y: -30 };
        bones.kneeL = { x: 20 + alt * 12, y: -24 };
        bones.footL = { x: 42 + alt * 18, y: -22 };
        bones.kneeR = { x: 14 - alt * 10, y: -14 };
        bones.footR = { x: 28 - alt * 16, y: -10 };
        break;
      }

      case 'attack_slide': {
        // Low Sweeping Slide Kick
        bones.head.x -= 8;
        bones.head.y += 18;
        bones.neck.y += 16;
        bones.hip.y += 14;
        bones.elbowL = { x: -16, y: 4 };
        bones.handL = { x: -20, y: 12 };
        bones.elbowR = { x: 8, y: -10 };
        bones.handR = { x: 16, y: -6 };
        // Slide leg extended forward along floor
        bones.kneeL = { x: 28, y: 6 };
        bones.footL = { x: 48, y: 8 };
        bones.kneeR = { x: -12, y: 2 };
        bones.footR = { x: -18, y: 6 };
        break;
      }

      case 'dive_kick': {
        // Downward diagonal diving kick
        bones.head.x += 16;
        bones.head.y += 12;
        bones.neck.x += 12;
        bones.kneeL = { x: 26, y: 16 };
        bones.footL = { x: 44, y: 32 };
        bones.kneeR = { x: 4, y: -6 };
        bones.footR = { x: -10, y: -14 };
        bones.elbowL = { x: -14, y: -30 };
        bones.handL = { x: -24, y: -20 };
        bones.elbowR = { x: -8, y: -34 };
        bones.handR = { x: -16, y: -24 };
        break;
      }

      case 'weapon_slash': {
        // Dynamic weapon swing
        bones.head.x += 6;
        bones.elbowL = { x: 6, y: -36 };
        bones.handL = { x: 16, y: -38 };
        bones.elbowR = { x: 18, y: -32 };
        bones.handR = { x: 30, y: -24 };
        bones.footL = { x: 14, y: 0 };
        bones.footR = { x: -12, y: 0 };
        break;
      }

      case 'awakening_god': {
        // Levitating god pose with floating arms
        const float = Math.sin(timer * 6) * 4;
        bones.head.y -= 12 + float;
        bones.neck.y -= 10 + float;
        bones.hip.y -= 8 + float;
        bones.elbowL = { x: -24, y: -44 + float };
        bones.handL = { x: -34, y: -58 + float };
        bones.elbowR = { x: 24, y: -44 + float };
        bones.handR = { x: 34, y: -58 + float };
        bones.kneeL = { x: -8, y: -4 + float };
        bones.footL = { x: -6, y: 8 + float };
        bones.kneeR = { x: 8, y: -4 + float };
        bones.footR = { x: 6, y: 8 + float };
        break;
      }

      default: {
        // Fallback to idle
        bones.head.y += Math.sin(timer * 4) * 2;
        break;
      }
    }

    return bones;
  }
}
