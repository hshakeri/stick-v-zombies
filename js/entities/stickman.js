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
    // Every renderer is drawn synchronously, so one stable skeleton can be
    // reset and reused for each pose without retaining cross-frame state.
    this.boneScratch = createBoneScratch();
  }

  // Draw procedural stick figure based on character state & pose
  draw(ctx, state) {
    const {
      x, y, facing, pose, animTimer, isGrounded, isHurt,
      isAwakened, weaponType, weaponAngle, scale = 1.0, alpha = 1.0,
      squashX = 1.0, squashY = 1.0, leanAngle = 0, actionPhase = null,
      suppressGlow = false
    } = state;

    const hasActionPhase = Number.isFinite(actionPhase);
    const easedActionPhase = hasActionPhase ? smoothstep(actionPhase) : 0;
    const authoredLean = hasActionPhase && (pose === 'weapon_slash' || pose?.startsWith('attack'))
      ? -0.07 + easedActionPhase * 0.15
      : 0;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate((leanAngle + authoredLean) * (facing >= 0 ? 1 : -1));
    ctx.scale(facing * scale * this.scale * squashX, scale * this.scale * squashY);

    // Awakening God Mode Multi-Tier Glow
    if (isAwakened) {
      ctx.shadowColor = '#ffbb00';
      ctx.shadowBlur = 28;
    } else if (this.isZombie && !suppressGlow) {
      ctx.shadowColor = 'rgba(30, 160, 30, 0.45)';
      ctx.shadowBlur = 10;
    } else if (this.isZombie) {
      // Low-cost afterimages and crowded ordinary enemies retain their full
      // silhouette while avoiding expensive per-character blur passes.
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Calculate bone joints based on current pose
    const bones = this.computePoseBones(pose, animTimer, isGrounded, isHurt);
    if (hasActionPhase) applyActionEnvelope(bones, easedActionPhase);

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
      if (!suppressGlow) {
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
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
        // Optional authored action phase gives bosses and future player moves a
        // readable anticipation-to-contact sweep without a keyframe asset.
        angle = hasActionPhase ? -1.12 + easedActionPhase * 2.47 : 1.35;
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
    const bones = this.boneScratch;
    resetBoneScratch(bones);

    if (this.isHunched) {
      bones.neck.x += 8;
      bones.shoulder.x += 8;
      bones.head.x += 14;
      bones.head.y += 4;
    }

    if (isHurt) {
      // Reeling back
      bones.head.x -= 12;
      bones.neck.x -= 8;
      bones.hip.x -= 4;
      setPoint(bones.handL, -18, -35);
      setPoint(bones.handR, -12, -40);
      setPoint(bones.footL, -14, 0);
      setPoint(bones.footR, 4, 0);
      return bones;
    }

    switch (pose) {
      case 'zombie_idle': {
        const bob = Math.sin(timer * 3) * 3;
        bones.head.y += bob;
        bones.neck.x += 8;
        bones.head.x += 12;
        // Arms lunging forward slightly
        setPoint(bones.elbowL, 12, -30 + bob);
        setPoint(bones.handL, 22, -32 + bob);
        setPoint(bones.elbowR, 8, -24 - bob);
        setPoint(bones.handR, 18, -26 - bob);
        break;
      }

      case 'zombie_walk': {
        const t = timer * 8;
        const legSwing = Math.sin(t);
        bones.neck.x += 10;
        bones.head.x += 14;
        bones.head.y += Math.abs(Math.sin(t)) * 2.5;

        // Limbs dragging
        setPoint(bones.kneeL, legSwing * 12, -10);
        setPoint(bones.footL, legSwing * 18, Math.max(-6, -legSwing * 6));
        setPoint(bones.kneeR, -legSwing * 12, -10);
        setPoint(bones.footR, -legSwing * 18, Math.max(-6, legSwing * 6));

        // Both arms raised forward horizontally like classic zombies
        const armBob = Math.sin(timer * 4) * 3;
        setPoint(bones.elbowL, 16, -34 + armBob);
        setPoint(bones.handL, 28, -38 + armBob);
        setPoint(bones.elbowR, 12, -28 - armBob);
        setPoint(bones.handR, 24, -32 - armBob);
        break;
      }

      case 'idle': {
        const bob = Math.sin(timer * 5) * 2;
        bones.head.y += bob;
        bones.neck.y += bob * 0.8;
        setPoint(bones.elbowL, -12, -32 + bob);
        setPoint(bones.handL, -10, -18 + bob);
        setPoint(bones.elbowR, 12, -32 + bob);
        setPoint(bones.handR, 10, -18 + bob);
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
        setPoint(bones.kneeL, legSwing * 16, -12 - Math.max(0, -legSwing * 8));
        setPoint(bones.footL, legSwing * 24, Math.max(-12, -legSwing * 10));

        // Back leg
        setPoint(bones.kneeR, -legSwing * 16, -12 - Math.max(0, legSwing * 8));
        setPoint(bones.footR, -legSwing * 24, Math.max(-12, legSwing * 10));

        // Arms swinging with run
        setPoint(bones.elbowL, armSwing * 16, -30);
        setPoint(bones.handL, armSwing * 24, -20);
        setPoint(bones.elbowR, -armSwing * 16, -30);
        setPoint(bones.handR, -armSwing * 24, -20);
        break;
      }

      case 'jump_rise': {
        bones.head.y -= 4;
        setPoint(bones.kneeL, -10, -15);
        setPoint(bones.footL, -8, -6);
        setPoint(bones.kneeR, 8, -18);
        setPoint(bones.footR, 12, -8);
        setPoint(bones.elbowL, -16, -45);
        setPoint(bones.handL, -18, -58);
        setPoint(bones.elbowR, 16, -45);
        setPoint(bones.handR, 18, -58);
        break;
      }

      case 'jump_fall': {
        setPoint(bones.kneeL, -12, -6);
        setPoint(bones.footL, -10, 4);
        setPoint(bones.kneeR, 6, -4);
        setPoint(bones.footR, 8, 6);
        setPoint(bones.elbowL, -18, -35);
        setPoint(bones.handL, -22, -25);
        setPoint(bones.elbowR, 18, -35);
        setPoint(bones.handR, 22, -25);
        break;
      }

      case 'wall_slide': {
        bones.head.x -= 4;
        setPoint(bones.elbowL, 14, -38);
        setPoint(bones.handL, 20, -40);
        setPoint(bones.elbowR, -8, -28);
        setPoint(bones.handR, -12, -16);
        setPoint(bones.kneeL, 12, -14);
        setPoint(bones.footL, 18, -4);
        setPoint(bones.kneeR, -4, -8);
        setPoint(bones.footR, 0, 0);
        break;
      }

      case 'crouch': {
        bones.head.y += 18;
        bones.neck.y += 14;
        bones.hip.y += 10;
        setPoint(bones.kneeL, -14, -4);
        setPoint(bones.footL, -18, 0);
        setPoint(bones.kneeR, 14, -4);
        setPoint(bones.footR, 18, 0);
        setPoint(bones.elbowL, -14, -16);
        setPoint(bones.handL, -16, -2);
        setPoint(bones.elbowR, 14, -16);
        setPoint(bones.handR, 16, -2);
        break;
      }

      case 'roll': {
        // Dynamic tumbling somersault roll
        const rot = timer * Math.PI * 6;
        const cx = 0;
        const cy = -22;
        const r = 16;
        setPoint(bones.hip, cx + Math.cos(rot + Math.PI) * 8, cy + Math.sin(rot + Math.PI) * 8);
        setPoint(bones.neck, cx + Math.cos(rot) * 12, cy + Math.sin(rot) * 12);
        setPoint(bones.shoulder, bones.neck.x, bones.neck.y);
        setPoint(bones.head, cx + Math.cos(rot) * 20, cy + Math.sin(rot) * 20);
        setPoint(bones.kneeL, cx + Math.cos(rot + 2.2) * r, cy + Math.sin(rot + 2.2) * r);
        setPoint(bones.footL, cx + Math.cos(rot + 2.6) * (r + 4), cy + Math.sin(rot + 2.6) * (r + 4));
        setPoint(bones.kneeR, cx + Math.cos(rot + 3.4) * r, cy + Math.sin(rot + 3.4) * r);
        setPoint(bones.footR, cx + Math.cos(rot + 3.8) * (r + 4), cy + Math.sin(rot + 3.8) * (r + 4));
        setPoint(bones.elbowL, cx + Math.cos(rot + 0.8) * (r - 2), cy + Math.sin(rot + 0.8) * (r - 2));
        setPoint(bones.handL, cx + Math.cos(rot + 1.2) * r, cy + Math.sin(rot + 1.2) * r);
        setPoint(bones.elbowR, cx + Math.cos(rot + 5.2) * (r - 2), cy + Math.sin(rot + 5.2) * (r - 2));
        setPoint(bones.handR, cx + Math.cos(rot + 5.6) * r, cy + Math.sin(rot + 5.6) * r);
        break;
      }

      case 'attack_jab': {
        // Crisp straight left jab
        bones.head.x += 4;
        bones.shoulder.x += 4;
        setPoint(bones.elbowL, 16, -42);
        setPoint(bones.handL, 34, -42); // Lead fist thrust forward
        setPoint(bones.elbowR, -8, -34);
        setPoint(bones.handR, 4, -38); // Guard
        setPoint(bones.footL, 14, 0);
        setPoint(bones.footR, -12, 0);
        break;
      }

      case 'attack_cross': {
        // Heavy straight right cross punch
        bones.head.x += 8;
        bones.neck.x += 10;
        setPoint(bones.elbowL, 2, -38);
        setPoint(bones.handL, 8, -42); // Guard
        setPoint(bones.elbowR, 22, -40);
        setPoint(bones.handR, 44, -38); // Deep cross
        setPoint(bones.kneeL, 10, -10);
        setPoint(bones.footL, 16, 0);
        setPoint(bones.kneeR, -10, -12);
        setPoint(bones.footR, -18, 0);
        break;
      }

      case 'attack_kick': {
        // High martial arts head kick
        bones.head.x -= 10;
        bones.neck.x -= 6;
        setPoint(bones.elbowL, -14, -38);
        setPoint(bones.handL, -8, -46);
        setPoint(bones.elbowR, 10, -32);
        setPoint(bones.handR, 14, -20);
        // Kicking leg thrust high
        setPoint(bones.kneeL, 18, -36);
        setPoint(bones.footL, 42, -48);
        // Plant leg
        setPoint(bones.kneeR, -4, -10);
        setPoint(bones.footR, -6, 0);
        break;
      }

      case 'attack_axe_kick': {
        // Overhead Somersault Axe Kick Slam
        bones.head.x += 14;
        bones.head.y -= 10;
        bones.neck.x += 12;
        bones.hip.x += 6;
        setPoint(bones.elbowL, -16, -48);
        setPoint(bones.handL, -24, -58);
        setPoint(bones.elbowR, 14, -44);
        setPoint(bones.handR, 22, -52);
        // Front axe leg slamming down from above
        setPoint(bones.kneeL, 28, -45);
        setPoint(bones.footL, 38, 8);
        // Plant leg
        setPoint(bones.kneeR, -12, -10);
        setPoint(bones.footR, -16, 0);
        break;
      }

      case 'attack_spin': {
        // 360 Hurricane Spin Kick
        const spin = Math.sin(timer * 20);
        bones.head.y -= 8;
        bones.hip.y -= 12;
        setPoint(bones.kneeL, spin * 28, -30);
        setPoint(bones.footL, spin * 46, -32);
        setPoint(bones.kneeR, -spin * 24, -22);
        setPoint(bones.footR, -spin * 36, -16);
        setPoint(bones.elbowL, -spin * 18, -45);
        setPoint(bones.handL, -spin * 28, -45);
        setPoint(bones.elbowR, spin * 18, -45);
        setPoint(bones.handR, spin * 28, -45);
        break;
      }

      case 'attack_uppercut': {
        // Rising Dragon Uppercut
        bones.head.x += 6;
        bones.head.y -= 14;
        bones.neck.y -= 10;
        setPoint(bones.elbowL, -14, -32);
        setPoint(bones.handL, -12, -20);
        setPoint(bones.elbowR, 16, -55);
        setPoint(bones.handR, 20, -80); // Firing straight up
        setPoint(bones.kneeL, -4, -14);
        setPoint(bones.footL, -6, -4);
        setPoint(bones.kneeR, 12, -24);
        setPoint(bones.footR, 16, -14);
        break;
      }

      case 'attack_drill_thrust': {
        // High-Speed Pencil Corkscrew Drill Thrust
        bones.head.x += 20;
        bones.neck.x += 18;
        bones.hip.x += 10;
        setPoint(bones.elbowL, 14, -36);
        setPoint(bones.handL, 26, -36);
        setPoint(bones.elbowR, 30, -34);
        setPoint(bones.handR, 48, -34); // Both hands driving pencil forward
        setPoint(bones.kneeL, 16, -6);
        setPoint(bones.footL, 24, 0);
        setPoint(bones.kneeR, -14, -8);
        setPoint(bones.footR, -22, 0);
        break;
      }

      case 'attack_vault_kick': {
        // Pencil Ground Vault Dropkick
        bones.head.x += 16;
        bones.head.y += 6;
        setPoint(bones.elbowL, 8, -20);
        setPoint(bones.handL, 14, 0); // Planting pencil into ground
        setPoint(bones.elbowR, -12, -35);
        setPoint(bones.handR, -18, -45);
        // Both legs vaulted forward in dropkick
        setPoint(bones.kneeL, 32, -14);
        setPoint(bones.footL, 50, -10);
        setPoint(bones.kneeR, 28, -22);
        setPoint(bones.footR, 46, -18);
        break;
      }

      case 'attack_air_flurry': {
        // Rapid Mid-Air Lightning Kicks
        const alt = Math.sin(timer * 25);
        bones.head.x += 8;
        setPoint(bones.elbowL, -16, -38);
        setPoint(bones.handL, -22, -30);
        setPoint(bones.elbowR, 12, -38);
        setPoint(bones.handR, 18, -30);
        setPoint(bones.kneeL, 20 + alt * 12, -24);
        setPoint(bones.footL, 42 + alt * 18, -22);
        setPoint(bones.kneeR, 14 - alt * 10, -14);
        setPoint(bones.footR, 28 - alt * 16, -10);
        break;
      }

      case 'attack_slide': {
        // Low Sweeping Slide Kick
        setPoint(bones.head, -16, -26);
        setPoint(bones.neck, -8, -20);
        setPoint(bones.shoulder, bones.neck.x, bones.neck.y);
        setPoint(bones.hip, 0, -10);
        setPoint(bones.elbowL, -18, -14);
        setPoint(bones.handL, -24, -2);
        setPoint(bones.elbowR, 4, -18);
        setPoint(bones.handR, 12, -8);
        // Slide leg extended forward along floor
        setPoint(bones.kneeL, 22, -4);
        setPoint(bones.footL, 40, 0);
        setPoint(bones.kneeR, -8, -6);
        setPoint(bones.footR, -14, 0);
        break;
      }

      case 'dive_kick': {
        // Downward aerodynamic diagonal diving kick
        setPoint(bones.head, 14, -36);
        setPoint(bones.neck, 8, -28);
        setPoint(bones.shoulder, bones.neck.x, bones.neck.y);
        setPoint(bones.hip, -6, -16);
        setPoint(bones.kneeL, 18, -6);
        setPoint(bones.footL, 34, 0);
        setPoint(bones.kneeR, 4, -14);
        setPoint(bones.footR, -4, -20);
        setPoint(bones.elbowL, -14, -24);
        setPoint(bones.handL, -22, -18);
        setPoint(bones.elbowR, -6, -26);
        setPoint(bones.handR, -14, -20);
        break;
      }

      case 'weapon_slash': {
        // Dynamic weapon swing
        bones.head.x += 6;
        setPoint(bones.elbowL, 6, -36);
        setPoint(bones.handL, 16, -38);
        setPoint(bones.elbowR, 18, -32);
        setPoint(bones.handR, 30, -24);
        setPoint(bones.footL, 14, 0);
        setPoint(bones.footR, -12, 0);
        break;
      }

      case 'awakening_god': {
        // Levitating god pose with floating arms
        const float = Math.sin(timer * 6) * 4;
        bones.head.y -= 12 + float;
        bones.neck.y -= 10 + float;
        bones.hip.y -= 8 + float;
        setPoint(bones.elbowL, -24, -44 + float);
        setPoint(bones.handL, -34, -58 + float);
        setPoint(bones.elbowR, 24, -44 + float);
        setPoint(bones.handR, 34, -58 + float);
        setPoint(bones.kneeL, -8, -4 + float);
        setPoint(bones.footL, -6, 8 + float);
        setPoint(bones.kneeR, 8, -4 + float);
        setPoint(bones.footR, 6, 8 + float);
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

function createBoneScratch() {
  return {
    headRadius: 14,
    head: { x: 0, y: -62 },
    neck: { x: 0, y: -45 },
    shoulder: { x: 0, y: -45 },
    hip: { x: 0, y: -20 },
    kneeL: { x: -6, y: -8 },
    footL: { x: -8, y: 0 },
    kneeR: { x: 6, y: -8 },
    footR: { x: 8, y: 0 },
    elbowL: { x: -10, y: -30 },
    handL: { x: -12, y: -15 },
    elbowR: { x: 10, y: -30 },
    handR: { x: 12, y: -15 }
  };
}

function setPoint(point, x, y) {
  point.x = x;
  point.y = y;
  return point;
}

function applyActionEnvelope(bones, phase) {
  // Anticipation pulls the extremities toward the core, contact overshoots,
  // and recovery settles back. The same mutation works across every authored
  // strike and keeps the pose scratch allocation-free.
  const envelope = phase < 0.5
    ? phase / 0.5
    : phase < 0.68
      ? 1 + Math.sin((phase - 0.5) / 0.18 * Math.PI) * 0.12
      : Math.max(0, 1 - (phase - 0.68) / 0.32);
  const reach = 0.72 + envelope * 0.36;
  const lift = 0.86 + envelope * 0.14;
  const hip = bones.hip;
  scalePointFromHip(bones.handL, hip, reach, lift);
  scalePointFromHip(bones.handR, hip, reach, lift);
  scalePointFromHip(bones.footL, hip, reach, lift);
  scalePointFromHip(bones.footR, hip, reach, lift);
  scalePointFromHip(bones.elbowL, hip, reach, lift);
  scalePointFromHip(bones.elbowR, hip, reach, lift);
  scalePointFromHip(bones.kneeL, hip, reach, lift);
  scalePointFromHip(bones.kneeR, hip, reach, lift);
}

function scalePointFromHip(point, hip, reach, lift) {
  point.x = hip.x + (point.x - hip.x) * reach;
  point.y = hip.y + (point.y - hip.y) * lift;
}

function resetBoneScratch(bones) {
  bones.headRadius = 14;
  setPoint(bones.head, 0, -62);
  setPoint(bones.neck, 0, -45);
  setPoint(bones.shoulder, 0, -45);
  setPoint(bones.hip, 0, -20);
  setPoint(bones.kneeL, -6, -8);
  setPoint(bones.footL, -8, 0);
  setPoint(bones.kneeR, 6, -8);
  setPoint(bones.footR, 8, 0);
  setPoint(bones.elbowL, -10, -30);
  setPoint(bones.handL, -12, -15);
  setPoint(bones.elbowR, 10, -30);
  setPoint(bones.handR, 12, -15);
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
