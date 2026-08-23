// Dynamic Camera with smooth tracking, zoom, directional screen shake, and hitstop freeze frames

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.zoomPunch = 0;
    this.focusCue = null;

    // CSS reduced-motion rules cannot affect Canvas transforms, so mirror the
    // preference here. Camera motion remains present, just much gentler.
    this.motionScale = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.28 : 1;

    // Screen shake
    this.trauma = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeRotation = 0;

    // Hitstop / Freeze-frame
    this.hitstopTimer = 0;
    this.hitstopCooldown = 0;

    // Arena Bounds. These describe the world edges; the camera center is
    // clamped against the current viewport so blank space never enters frame.
    this.minX = -1100;
    this.maxX = 1100;
    this.minY = -550;
    this.maxY = -70;
  }

  getViewportSize() {
    return {
      width: this.canvas.clientWidth || window.innerWidth || 1280,
      height: this.canvas.clientHeight || window.innerHeight || 720
    };
  }

  getMinimumZoom() {
    const { width } = this.getViewportSize();
    const arenaWidth = Math.max(1, this.maxX - this.minX);
    // Keep both arena walls inside wide displays. A small safety margin also
    // absorbs screen shake without revealing an unpainted canvas edge.
    return Math.max(0.78, width / Math.max(1, arenaWidth - 64));
  }

  getEffectiveZoom() {
    return Math.max(this.getMinimumZoom(), this.zoom + this.zoomPunch);
  }

  getRenderPixelRatio(devicePixelRatio = globalThis.window?.devicePixelRatio || 1, maxBackingPixels = 10_000_000) {
    const { width, height } = this.getViewportSize();
    const budgetRatio = Math.sqrt(maxBackingPixels / Math.max(1, width * height));
    return Math.max(0.75, Math.min(2, devicePixelRatio, budgetRatio));
  }

  getTargetPosition(target) {
    const { height } = this.getViewportSize();
    const leadX = target.facing * 70;
    // Keep the ground near 74% of the screen. This leaves room for the HUD on
    // short landscape screens without making jumps feel vertically cramped.
    // On short landscape screens, lift the ground above the two-row touch pad.
    const groundOffset = height <= 500
      ? Math.max(36, height * 0.1)
      : Math.max(82, Math.min(190, height * 0.24));
    return {
      x: target.x + leadX,
      y: target.y - groundOffset
    };
  }

  clampToArena() {
    const { width } = this.getViewportSize();
    const halfView = width / (2 * Math.max(0.01, this.getEffectiveZoom()));
    const edgeInset = 24;
    const minCenter = this.minX + halfView - edgeInset;
    const maxCenter = this.maxX - halfView + edgeInset;

    if (minCenter > maxCenter) {
      this.x = (this.minX + this.maxX) * 0.5;
    } else {
      this.x = Math.max(minCenter, Math.min(maxCenter, this.x));
    }
    this.y = Math.max(this.minY, Math.min(this.maxY, this.y));
  }

  snapTo(target) {
    if (!target) return;
    const next = this.getTargetPosition(target);
    this.targetX = next.x;
    this.targetY = next.y;
    this.x = next.x;
    this.y = next.y;
    const minimumZoom = this.getMinimumZoom();
    this.zoom = Math.max(1, minimumZoom);
    this.targetZoom = this.zoom;
    this.zoomPunch = 0;
    this.focusCue = null;
    this.trauma = 0;
    this.hitstopTimer = 0;
    this.clampToArena();
  }

  update(dt, target, zombieCount = 0) {
    // Handle Hitstop (freeze-frames on heavy impacts)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
    }
    if (this.hitstopCooldown > 0) {
      this.hitstopCooldown -= dt;
    }

    let desiredZoom = this.targetZoom;
    if (target) {
      // Look slightly ahead based on player velocity / facing direction
      const next = this.getTargetPosition(target);
      this.targetX = next.x;
      this.targetY = next.y;

      // Dynamic zoom based on player speed and reachable crowd pressure. The
      // wave director caps active enemies at 12, so scale smoothly from 7–12.
      const speed = Math.hypot(target.vx || 0, target.vy || 0);
      desiredZoom = 1.0 - Math.min(speed / 1400, 0.15);
      const crowdPressure = clamp01((zombieCount - 6) / 6);
      desiredZoom *= 1 - crowdPressure * 0.08;
      if (target.isAwakened) desiredZoom = 0.95;
    }

    // A short authored focus is useful for boss arrivals and opened exits. It
    // eases back to gameplay framing during its last moments and never pauses
    // input or allocates per-frame effects.
    if (this.focusCue) {
      this.focusCue.remaining -= dt;
      const fadeWindow = Math.min(0.24, this.focusCue.duration * 0.4);
      const strength = clamp01(this.focusCue.remaining / Math.max(0.01, fadeWindow));
      const easedStrength = strength * strength * (3 - 2 * strength);
      this.targetX += (this.focusCue.x - this.targetX) * easedStrength;
      this.targetY += (this.focusCue.y - this.targetY) * easedStrength;
      desiredZoom += (this.focusCue.zoom - desiredZoom) * easedStrength;
      if (this.focusCue.remaining <= 0) this.focusCue = null;
    }
    this.targetZoom = Math.max(this.getMinimumZoom(), Math.min(1.15, desiredZoom));

    // Smooth Lerp tracking
    const lerpSpeed = 6.0;
    this.x += (this.targetX - this.x) * Math.min(1, lerpSpeed * dt);
    this.y += (this.targetY - this.y) * Math.min(1, lerpSpeed * dt);
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, 4.0 * dt);
    this.zoom = Math.max(this.getMinimumZoom(), this.zoom);
    this.zoomPunch += (0 - this.zoomPunch) * Math.min(1, 11 * dt);
    if (Math.abs(this.zoomPunch) < 0.0005) this.zoomPunch = 0;

    // Apply viewport-aware arena bounds.
    this.clampToArena();

    // Screen Shake calculations
    if (this.trauma > 0) {
      const shakePower = Math.pow(this.trauma, 2);
      const angle = Math.random() * Math.PI * 2;
      const maxOffset = 21 * shakePower;
      this.shakeOffsetX = Math.cos(angle) * maxOffset;
      this.shakeOffsetY = Math.sin(angle) * maxOffset;
      this.shakeRotation = (Math.random() * 2 - 1) * 0.018 * shakePower * this.motionScale;

      // Decay trauma
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRotation = 0;
    }
  }

  addShake(amount = 0.3) {
    this.trauma = Math.min(1.0, this.trauma + amount * this.motionScale);
  }

  // Positive values punch in; negative values briefly pull back. The bounded
  // impulse automatically decays in update().
  addZoomPunch(amount = 0.05) {
    if (!Number.isFinite(amount)) return;
    this.zoomPunch = Math.max(-0.08, Math.min(0.1, this.zoomPunch + amount * this.motionScale));
    this.clampToArena();
  }

  focusOn(x, y, duration = 0.7, zoom = 0.92) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const reducedMotion = this.motionScale < 0.5;
    const durationScale = reducedMotion ? 0.55 : 1;
    const safeDuration = Math.max(0.12, Math.min(1.8, (Number(duration) || 0.7) * durationScale));
    const requestedZoom = Math.max(this.getMinimumZoom(), Math.min(1.12, Number(zoom) || 0.92));
    const cueX = reducedMotion
      ? this.targetX + Math.max(-90, Math.min(90, x - this.targetX))
      : x;
    const cueY = reducedMotion
      ? this.targetY + Math.max(-55, Math.min(55, y - this.targetY))
      : y;
    this.focusCue = {
      x: cueX,
      y: cueY,
      duration: safeDuration,
      remaining: safeDuration,
      zoom: reducedMotion
        ? this.targetZoom + (requestedZoom - this.targetZoom) * this.motionScale
        : requestedZoom
    };
    return true;
  }

  addHitstop(duration = 0.05) {
    if (this.hitstopCooldown > 0) return;
    this.hitstopTimer = Math.min(0.06, duration);
    this.hitstopCooldown = 0.18; // Prevents stacking slow-mo freeze
  }

  isHitstopped() {
    return this.hitstopTimer > 0;
  }

  apply(ctx) {
    ctx.save();
    const { width, height } = this.getViewportSize();
    const cx = width / 2;
    const cy = height / 2;

    ctx.translate(cx + this.shakeOffsetX, cy + this.shakeOffsetY);
    if (this.shakeRotation !== 0) {
      ctx.rotate(this.shakeRotation);
    }
    const effectiveZoom = this.getEffectiveZoom();
    ctx.scale(effectiveZoom, effectiveZoom);
    ctx.translate(-this.x, -this.y);
  }

  restore(ctx) {
    ctx.restore();
  }

  screenToWorld(screenX, screenY, includeShake = true) {
    const { width, height } = this.getViewportSize();
    const cx = width / 2;
    const cy = height / 2;
    const effectiveZoom = this.getEffectiveZoom();
    const offsetX = includeShake ? this.shakeOffsetX : 0;
    const offsetY = includeShake ? this.shakeOffsetY : 0;
    const rotation = includeShake ? this.shakeRotation : 0;
    const translatedX = screenX - cx - offsetX;
    const translatedY = screenY - cy - offsetY;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const relX = (translatedX * cos - translatedY * sin) / effectiveZoom;
    const relY = (translatedX * sin + translatedY * cos) / effectiveZoom;

    return {
      x: this.x + relX,
      y: this.y + relY
    };
  }

  worldToScreen(worldX, worldY, includeShake = true) {
    const { width, height } = this.getViewportSize();
    const cx = width / 2;
    const cy = height / 2;
    const effectiveZoom = this.getEffectiveZoom();
    const rotation = includeShake ? this.shakeRotation : 0;
    const rawX = (worldX - this.x) * effectiveZoom;
    const rawY = (worldY - this.y) * effectiveZoom;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const relX = rawX * cos - rawY * sin;
    const relY = rawX * sin + rawY * cos;

    return {
      x: cx + (includeShake ? this.shakeOffsetX : 0) + relX,
      y: cy + (includeShake ? this.shakeOffsetY : 0) + relY
    };
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
