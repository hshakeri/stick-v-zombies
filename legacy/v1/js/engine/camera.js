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

    // Arena Bounds
    this.minX = -1050;
    this.maxX = 1050;
    this.minY = -550;
    this.maxY = -160;
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
      const leadX = target.facing * 70;
      this.targetX = target.x + leadX;
      this.targetY = target.y - 180;

      // Dynamic Zoom based on player speed and zombie count
      const speed = Math.hypot(target.vx || 0, target.vy || 0);
      let desiredZoom = 1.0 - Math.min(speed / 1400, 0.15);
      if (zombieCount > 15) desiredZoom *= 0.92;
      if (target.isAwakened) desiredZoom = 0.95;
      this.targetZoom = Math.max(0.78, Math.min(1.15, desiredZoom));
    }

    // Smooth Lerp tracking
    const lerpSpeed = 6.0;
    this.x += (this.targetX - this.x) * Math.min(1, lerpSpeed * dt);
    this.y += (this.targetY - this.y) * Math.min(1, lerpSpeed * dt);
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, 4.0 * dt);

    // Apply Arena Bounds
    this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
    this.y = Math.max(this.minY, Math.min(this.maxY, this.y));

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
    const dpr = window.devicePixelRatio || 1;
    const cx = (this.canvas.width / dpr) / 2;
    const cy = (this.canvas.height / dpr) / 2;

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
    const dpr = window.devicePixelRatio || 1;
    const cx = (this.canvas.width / dpr) / 2;
    const cy = (this.canvas.height / dpr) / 2;

    const relX = (screenX - cx - this.shakeOffsetX) / this.zoom;
    const relY = (screenY - cy - this.shakeOffsetY) / this.zoom;

    return {
      x: this.x + relX,
      y: this.y + relY
    };
  }

  worldToScreen(worldX, worldY) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    const relX = (worldX - this.x) * this.zoom;
    const relY = (worldY - this.y) * this.zoom;

    return {
      x: cx + this.shakeOffsetX + relX,
      y: cy + this.shakeOffsetY + relY
    };
  }
}
