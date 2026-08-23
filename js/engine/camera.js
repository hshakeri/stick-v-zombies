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
    const halfView = width / (2 * Math.max(0.01, this.zoom));
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

    if (target) {
      // Look slightly ahead based on player velocity / facing direction
      const next = this.getTargetPosition(target);
      this.targetX = next.x;
      this.targetY = next.y;

      // Dynamic Zoom based on player speed and zombie count
      const speed = Math.hypot(target.vx || 0, target.vy || 0);
      let desiredZoom = 1.0 - Math.min(speed / 1400, 0.15);
      if (zombieCount > 15) desiredZoom *= 0.92;
      if (target.isAwakened) desiredZoom = 0.95;
      this.targetZoom = Math.max(this.getMinimumZoom(), Math.min(1.15, desiredZoom));
    }

    // Smooth Lerp tracking
    const lerpSpeed = 6.0;
    this.x += (this.targetX - this.x) * Math.min(1, lerpSpeed * dt);
    this.y += (this.targetY - this.y) * Math.min(1, lerpSpeed * dt);
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, 4.0 * dt);
    this.zoom = Math.max(this.getMinimumZoom(), this.zoom);

    // Apply viewport-aware arena bounds.
    this.clampToArena();

    // Screen Shake calculations
    if (this.trauma > 0) {
      const shakePower = Math.pow(this.trauma, 2);
      const angle = Math.random() * Math.PI * 2;
      const maxOffset = 25 * shakePower;
      this.shakeOffsetX = Math.cos(angle) * maxOffset;
      this.shakeOffsetY = Math.sin(angle) * maxOffset;
      this.shakeRotation = (Math.random() * 2 - 1) * 0.04 * shakePower;

      // Decay trauma
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRotation = 0;
    }
  }

  addShake(amount = 0.3) {
    this.trauma = Math.min(1.0, this.trauma + amount);
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
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  restore(ctx) {
    ctx.restore();
  }

  screenToWorld(screenX, screenY) {
    const { width, height } = this.getViewportSize();
    const cx = width / 2;
    const cy = height / 2;

    const relX = (screenX - cx - this.shakeOffsetX) / this.zoom;
    const relY = (screenY - cy - this.shakeOffsetY) / this.zoom;

    return {
      x: this.x + relX,
      y: this.y + relY
    };
  }

  worldToScreen(worldX, worldY) {
    const { width, height } = this.getViewportSize();
    const cx = width / 2;
    const cy = height / 2;

    const relX = (worldX - this.x) * this.zoom;
    const relY = (worldY - this.y) * this.zoom;

    return {
      x: cx + this.shakeOffsetX + relX,
      y: cy + this.shakeOffsetY + relY
    };
  }
}
