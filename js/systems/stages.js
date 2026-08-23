// Stage Progression, Desktop Level Generator, Obstacle Courses, and Door Portals

import { particles } from '../engine/particles.js';
import { audio } from '../engine/audio.js';

export class StageManager {
  constructor() {
    this.currentStage = 1;
    this.maxStage = 10;
    this.stageName = 'Main Desktop';
    this.theme = 'desktop'; // 'desktop', 'animate', 'downloads', 'firewall', 'bsod'

    // Arena World Boundaries
    this.bounds = {
      minX: -1100,
      maxX: 1100,
      minY: -700,
      maxY: 100,
      groundY: 0
    };

    // Stage Entities
    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };
    this.platforms = [];
    this.movingPlatforms = [];
    this.desktopIcons = [];
    this.laserHazards = [];
    this.errorPopups = [];

    // Objective state
    this.isObjectiveComplete = false;
    this.doorTransitionTimer = 0;

    // Build Stage 1 on init
    this.loadStage(1);
  }

  loadStage(stageNum) {
    this.currentStage = stageNum;
    this.isObjectiveComplete = false;
    this.exitDoor.isOpen = false;
    this.doorTransitionTimer = 0;

    // Reset collections
    this.platforms = [];
    this.movingPlatforms = [];
    this.desktopIcons = [];
    this.laserHazards = [];
    this.errorPopups = [];

    this.maxStage = 10;
    const stage = ((stageNum - 1) % 10) + 1;

    switch (stage) {
      case 1:
        this.buildStage1Desktop();
        break;
      case 2:
        this.buildStage2Animate();
        break;
      case 3:
        this.buildStage3Downloads();
        break;
      case 4:
        this.buildStage4Firewall();
        break;
      case 5:
        this.buildStage5BSOD();
        break;
      case 6:
        this.buildStage6Recycle();
        break;
      case 7:
        this.buildStage7Minecraft();
        break;
      case 8:
        this.buildStage8Terminal();
        break;
      case 9:
        this.buildStage9VirabotNexus();
        break;
      case 10:
        this.buildStage10DarkCore();
        break;
    }
  }

  resolveStageExit(nextStage, onComplete, onAdvance) {
    if (this.currentStage >= this.maxStage) {
      if (onComplete) onComplete();
      return 'complete';
    }
    if (onAdvance) onAdvance(nextStage);
    return 'advance';
  }

  // --- STAGE BUILDERS ---

  buildStage1Desktop() {
    this.stageName = 'Main Desktop';
    this.theme = 'desktop';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    // Desktop App Windows as Platforms
    this.platforms = [
      { x: -650, y: -160, width: 220, height: 20, title: 'Notepad.exe - Notes.txt', appType: 'notepad' },
      { x: -350, y: -280, width: 200, height: 20, title: 'Calculator.exe', appType: 'calc' },
      { x: 0, y: -180, width: 260, height: 22, title: 'File Explorer - C:/Users/Alan', appType: 'folder' },
      { x: 380, y: -280, width: 220, height: 20, title: 'Paint.exe - Drawing', appType: 'paint' },
      { x: 680, y: -160, width: 200, height: 20, title: 'Command_Prompt.cmd', appType: 'cmd' }
    ];

    // Desktop Shortcut Icons
    this.desktopIcons = [
      { x: -850, y: -80, label: 'Recycle Bin', icon: '🗑️' },
      { x: -850, y: -200, label: 'My Computer', icon: '💻' },
      { x: -850, y: -320, label: 'Chrome.exe', icon: '🌐' },
      { x: -500, y: -420, label: 'Minecraft.exe', icon: '⛏️' },
      { x: 200, y: -420, label: 'Stickman_v2.fla', icon: '🎬' },
      { x: 850, y: -80, label: 'Exit_Portal.exe', icon: '🚪' },
      { x: 850, y: -200, label: 'Secret_Folder', icon: '📁' }
    ];

    // 1 Horizontal moving platform (Media Player)
    this.movingPlatforms.push({
      x: -100,
      y: -360,
      width: 180,
      height: 18,
      title: 'Media_Player.exe',
      appType: 'media',
      minX: -260,
      maxX: 260,
      speed: 120,
      dir: 1,
      axis: 'x'
    });
  }

  buildStage2Animate() {
    this.stageName = 'Adobe Animate Timeline';
    this.theme = 'animate';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    // Timeline Scrubber & Canvas Tool Platforms
    this.platforms = [
      { x: -700, y: -180, width: 200, height: 20, title: 'Toolbox - Brush & Pencil', appType: 'tools' },
      { x: -250, y: -160, width: 240, height: 20, title: 'Layer 1: Stick Animation', appType: 'layer' },
      { x: 250, y: -160, width: 240, height: 20, title: 'Layer 2: Zombie Horde', appType: 'layer' },
      { x: 700, y: -200, width: 200, height: 20, title: 'Color Swatches Palette', appType: 'palette' }
    ];

    // Moving Timeline Scrubbers (Horizontal and Vertical)
    this.movingPlatforms.push({
      x: 0,
      y: -320,
      width: 220,
      height: 20,
      title: 'Timeline Frame [ 48 ]',
      appType: 'timeline',
      minX: -220,
      maxX: 220,
      speed: 160,
      dir: 1,
      axis: 'x'
    });

    this.movingPlatforms.push({
      x: -480,
      y: -240,
      width: 150,
      height: 18,
      title: 'Audio Track 1',
      appType: 'timeline',
      minY: -380,
      maxY: -140,
      speed: 100,
      dir: 1,
      axis: 'y'
    });

    // Drawing Laser Hazards (Timed security pointer beams)
    this.laserHazards.push({
      x: -120,
      y: -240,
      width: 240,
      height: 8,
      timer: 0,
      cycleDuration: 3.5,
      activeDuration: 1.6,
      damage: 15
    });

    this.desktopIcons = [
      { x: -850, y: -120, label: 'Keyframes.fla', icon: '🎞️' },
      { x: 850, y: -120, label: 'Export_Movie.exe', icon: '🎬' },
      { x: 0, y: -480, label: 'V-Cam Tool', icon: '📹' }
    ];
  }

  buildStage3Downloads() {
    this.stageName = 'Downloads & Malware Zone';
    this.theme = 'downloads';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    // Download bars and corrupted archive platforms
    this.platforms = [
      { x: -680, y: -180, width: 220, height: 20, title: 'Download_1: Cheats.zip (98%)', appType: 'download' },
      { x: -280, y: -240, width: 190, height: 20, title: 'Corrupted_Script.js', appType: 'glitch' },
      { x: 280, y: -240, width: 190, height: 20, title: 'Free_RAM_Installer.exe', appType: 'malware' },
      { x: 680, y: -180, width: 220, height: 20, title: 'Download_2: Patch.iso (100%)', appType: 'download' }
    ];

    // Vertical Download Elevator
    this.movingPlatforms.push({
      x: 0,
      y: -200,
      width: 200,
      height: 20,
      title: 'Cloud_Sync_Elevator',
      appType: 'cloud',
      minY: -420,
      maxY: -120,
      speed: 130,
      dir: 1,
      axis: 'y'
    });

    // Error 404 Popup Dialogs that act as bouncy/hazardous popups
    this.errorPopups.push({
      x: -460,
      y: -140,
      width: 140,
      height: 70,
      title: '⚠️ WARNING',
      msg: 'Malware Detected!'
    });

    this.errorPopups.push({
      x: 460,
      y: -140,
      width: 140,
      height: 70,
      title: '❌ ERROR 404',
      msg: 'Zombie File Found!'
    });

    this.desktopIcons = [
      { x: -850, y: -100, label: 'Trojan.bat', icon: '☣️' },
      { x: -850, y: -220, label: 'Antivirus.exe', icon: '🛡️' },
      { x: 850, y: -100, label: 'Quarantine', icon: '🔒' }
    ];
  }

  buildStage4Firewall() {
    this.stageName = 'Firewall Security Grid';
    this.theme = 'firewall';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -700, y: -200, width: 220, height: 20, title: 'Firewall_Node_A', appType: 'security' },
      { x: -300, y: -300, width: 200, height: 20, title: 'Port 8080 Bridge', appType: 'security' },
      { x: 300, y: -300, width: 200, height: 20, title: 'SSL Certificate Vault', appType: 'security' },
      { x: 700, y: -200, width: 220, height: 20, title: 'Firewall_Node_B', appType: 'security' }
    ];

    // Fast moving security scanners
    this.movingPlatforms.push({
      x: 0,
      y: -220,
      width: 180,
      height: 20,
      title: 'Packet Scanner',
      appType: 'scanner',
      minX: -260,
      maxX: 260,
      speed: 180,
      dir: 1,
      axis: 'x'
    });

    // Timed Firewall Lasers
    this.laserHazards.push({
      x: -500,
      y: -100,
      width: 200,
      height: 10,
      timer: 0,
      cycleDuration: 3.0,
      activeDuration: 1.5,
      damage: 20
    });

    this.laserHazards.push({
      x: 300,
      y: -100,
      width: 200,
      height: 10,
      timer: 1.5,
      cycleDuration: 3.0,
      activeDuration: 1.5,
      damage: 20
    });
  }

  buildStage5BSOD() {
    this.stageName = 'Blue Screen of Death (BSOD)';
    this.theme = 'bsod';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    // Big Boss Arena layout with elevated crash dump platforms
    this.platforms = [
      { x: -550, y: -180, width: 240, height: 22, title: '*** STOP: 0x0000007B (MEMORY DUMP)', appType: 'bsod' },
      { x: 550, y: -180, width: 240, height: 22, title: '*** CRASH_DUMP: SYSTEM_OVERHEAT', appType: 'bsod' },
      { x: 0, y: -300, width: 300, height: 22, title: 'FATAL EXCEPTION: TITAN_UNDEAD.EXE', appType: 'bsod' }
    ];

    this.movingPlatforms.push({
      x: -250,
      y: -160,
      width: 160,
      height: 18,
      title: 'Memory Stack A',
      appType: 'bsod',
      minY: -320,
      maxY: -120,
      speed: 120,
      dir: 1,
      axis: 'y'
    });

    this.movingPlatforms.push({
      x: 250,
      y: -160,
      width: 160,
      height: 18,
      title: 'Memory Stack B',
      appType: 'bsod',
      minY: -320,
      maxY: -120,
      speed: 120,
      dir: -1,
      axis: 'y'
    });
  }

  buildStage6Recycle() {
    this.stageName = 'Corrupted Recycle Bin';
    this.theme = 'recycle';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -500, y: -160, width: 220, height: 22, title: 'Corrupted_Script.js', appType: 'explorer' },
      { x: 500, y: -160, width: 220, height: 22, title: 'Deleted_Save.dat', appType: 'explorer' },
      { x: 0, y: -280, width: 280, height: 24, title: 'Recycle_Bin_Master_Dump', appType: 'explorer' }
    ];

    this.movingPlatforms.push({
      x: -220, y: -180, width: 140, height: 18, title: 'Shredder Bar L', appType: 'scanner',
      minY: -300, maxY: -100, speed: 130, dir: 1, axis: 'y'
    });
    this.movingPlatforms.push({
      x: 220, y: -180, width: 140, height: 18, title: 'Shredder Bar R', appType: 'scanner',
      minY: -300, maxY: -100, speed: 130, dir: -1, axis: 'y'
    });
  }

  buildStage7Minecraft() {
    this.stageName = 'Minecraft Nether Core';
    this.theme = 'minecraft';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -600, y: -140, width: 220, height: 24, title: 'Obsidian Platform West', appType: 'paint' },
      { x: 600, y: -140, width: 220, height: 24, title: 'Obsidian Platform East', appType: 'paint' },
      { x: -200, y: -260, width: 180, height: 24, title: 'Nether Fortress Pillar', appType: 'paint' },
      { x: 200, y: -260, width: 180, height: 24, title: 'Nether Fortress Pillar', appType: 'paint' }
    ];

    this.movingPlatforms.push({
      x: 0, y: -340, width: 200, height: 20, title: 'Floating Netherrack', appType: 'paint',
      minX: -250, maxX: 250, speed: 140, dir: 1, axis: 'x'
    });
  }

  buildStage8Terminal() {
    this.stageName = 'Terminal Cyber Matrix';
    this.theme = 'terminal';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -550, y: -180, width: 240, height: 20, title: 'root@matrix:~# ./killall', appType: 'terminal' },
      { x: 550, y: -180, width: 240, height: 20, title: 'root@matrix:~# sudo firewall', appType: 'terminal' },
      { x: 0, y: -290, width: 320, height: 22, title: 'BUFFER_OVERFLOW_SHIELD.SYS', appType: 'terminal' }
    ];

    this.laserHazards.push({
      x: -400, y: -100, width: 180, height: 10, timer: 0, cycleDuration: 2.6, activeDuration: 1.3, damage: 22
    });
    this.laserHazards.push({
      x: 220, y: -100, width: 180, height: 10, timer: 1.3, cycleDuration: 2.6, activeDuration: 1.3, damage: 22
    });
  }

  buildStage9VirabotNexus() {
    this.stageName = 'ViraBot Infestation Nexus';
    this.theme = 'virabot';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -500, y: -160, width: 240, height: 22, title: 'VIRUS_INCUBATOR_ALPHA', appType: 'bsod' },
      { x: 500, y: -160, width: 240, height: 22, title: 'VIRUS_INCUBATOR_BETA', appType: 'bsod' },
      { x: 0, y: -300, width: 320, height: 22, title: 'MALWARE_CONDUIT_CENTRAL', appType: 'bsod' }
    ];

    this.movingPlatforms.push({
      x: -240, y: -200, width: 150, height: 18, title: 'Infected Node L', appType: 'scanner',
      minY: -340, maxY: -120, speed: 150, dir: 1, axis: 'y'
    });
    this.movingPlatforms.push({
      x: 240, y: -200, width: 150, height: 18, title: 'Infected Node R', appType: 'scanner',
      minY: -340, maxY: -120, speed: 150, dir: -1, axis: 'y'
    });
  }

  buildStage10DarkCore() {
    this.stageName = "The Dark Core (TDL's Domain)";
    this.theme = 'dark_core';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    // Ultimate Boss Arena Layout
    this.platforms = [
      { x: -560, y: -170, width: 250, height: 24, title: 'VIRABOT_NEXUS_ALPHA [CRITICAL]', appType: 'dark_core' },
      { x: 560, y: -170, width: 250, height: 24, title: 'VIRABOT_NEXUS_OMEGA [CRITICAL]', appType: 'dark_core' },
      { x: 0, y: -310, width: 360, height: 26, title: 'DARK_SINGULARITY_CORE (TDL)', appType: 'dark_core' }
    ];

    this.movingPlatforms.push({
      x: -260, y: -180, width: 160, height: 20, title: 'Crimson Surge L', appType: 'dark_core',
      minY: -340, maxY: -100, speed: 160, dir: 1, axis: 'y'
    });
    this.movingPlatforms.push({
      x: 260, y: -180, width: 160, height: 20, title: 'Crimson Surge R', appType: 'dark_core',
      minY: -340, maxY: -100, speed: 160, dir: -1, axis: 'y'
    });
  }

  update(dt, player, wavesDirector, onStageExit) {
    // 1. Update Moving Platforms
    for (const p of this.movingPlatforms) {
      if (p.axis === 'x') {
        p.x += p.speed * p.dir * dt;
        if (p.x >= p.maxX) { p.x = p.maxX; p.dir = -1; }
        else if (p.x <= p.minX) { p.x = p.minX; p.dir = 1; }
      } else if (p.axis === 'y') {
        p.y += p.speed * p.dir * dt;
        if (p.y >= p.maxY) { p.y = p.maxY; p.dir = -1; }
        else if (p.y <= p.minY) { p.y = p.minY; p.dir = 1; }
      }
    }

    // 2. Update Laser Hazards
    for (const laser of this.laserHazards) {
      laser.timer = (laser.timer + dt) % laser.cycleDuration;
      const isActive = laser.timer < laser.activeDuration;

      // Damage player if walking into active laser beam
      if (isActive && player && !player.isRolling && !player.isAwakened) {
        if (player.x >= laser.x - 20 && player.x <= laser.x + laser.width + 20 &&
            Math.abs(player.y - 30 - laser.y) < 25) {
          audio.playLaserZap();
          player.takeDamage(laser.damage, player.x < laser.x + laser.width / 2 ? -1 : 1, 350);
          particles.createHitSparks(player.x, laser.y, 8, '#ff2244');
        }
      }
    }

    // 3. Check Objective / Exit Door Unlock
    const allEnemiesDefeated = wavesDirector && wavesDirector.isWaveActive &&
                               wavesDirector.spawnQueue.length === 0 &&
                               wavesDirector.zombies.length === 0;

    if (allEnemiesDefeated && !this.isObjectiveComplete) {
      this.isObjectiveComplete = true;
      this.exitDoor.isOpen = true;
      audio.playDoorUnlock();
      particles.addTextBanner(this.exitDoor.x, this.exitDoor.y - 120, '★ EXIT DOOR OPEN! ★', '#33ff88');
      particles.addShockwave(this.exitDoor.x, this.exitDoor.y - 45, 120, '#33ff88', 8);
    }

    // 4. Check if player enters Exit Door
    if (this.exitDoor.isOpen && player && !player.isDead) {
      const distToExit = Math.hypot(player.x - this.exitDoor.x, player.y - this.exitDoor.y);
      if (distToExit < 60) {
        this.doorTransitionTimer += dt;
        particles.createAwakeningAura(this.exitDoor.x, this.exitDoor.y - 45, 2);

        if (this.doorTransitionTimer > 0.4) {
          // Transition to next stage
          this.doorTransitionTimer = -999;
          this.exitDoor.isOpen = false;
          audio.playDoorEnter();
          if (onStageExit) {
            onStageExit(this.currentStage + 1);
          }
        }
      } else {
        if (this.doorTransitionTimer > 0) this.doorTransitionTimer = 0;
      }
    }
  }

  getAllSolidPlatforms() {
    return [...this.platforms, ...this.movingPlatforms];
  }

  // --- RENDERING ---

  draw(ctx, groundY) {
    // 1. Draw Desktop Wallpaper & Grid Background
    this.drawDesktopBackground(ctx, groundY);

    // 2. Draw Desktop Icons
    this.drawDesktopIcons(ctx);

    // 3. Draw Error Popups
    this.drawErrorPopups(ctx);

    // 4. Draw Doors (Entrance & Exit)
    this.drawDoors(ctx, groundY);

    // 5. Draw Platforms & Moving Windows
    this.drawPlatforms(ctx);

    // 6. Draw Laser Hazards
    this.drawLaserHazards(ctx);

    // 7. Draw Windows Taskbar at bottom
    this.drawTaskbar(ctx, groundY);
  }

  drawDesktopBackground(ctx, groundY) {
    const minX = this.bounds.minX;
    const maxX = this.bounds.maxX;
    const minY = this.bounds.minY;
    const maxY = groundY;
    const backdropMinX = minX - 1600;
    const backdropMaxX = maxX + 1600;
    const backdropMinY = minY - 1000;

    ctx.save();

    const paintBackdrop = (color) => {
      ctx.fillStyle = color;
      ctx.fillRect(
        backdropMinX,
        backdropMinY,
        backdropMaxX - backdropMinX,
        maxY - backdropMinY
      );
    };

    if (this.theme === 'animate') {
      // Dark Charcoal Flash/Animate Workspace
      paintBackdrop('#2d2f3a');

      // Grid Lines
      ctx.strokeStyle = 'rgba(70, 75, 95, 0.4)';
      ctx.lineWidth = 1;
      for (let x = minX; x <= maxX; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
      }
      for (let y = minY; y <= maxY; y += 50) {
        ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
      }
      // Ruler at top
      ctx.fillStyle = '#1e2029';
      ctx.fillRect(minX, minY, maxX - minX, 24);
      ctx.fillStyle = '#888ea6';
      ctx.font = "10px monospace";
      for (let x = minX; x <= maxX; x += 100) {
        ctx.fillText(`${x}`, x + 5, minY + 16);
      }
    } else if (this.theme === 'bsod') {
      // Blue Screen of Death (BSOD) Wallpaper
      paintBackdrop('#0047b3');

      // BSOD Crash Dump Text
      ctx.fillStyle = '#ffffff';
      ctx.font = "14px monospace";
      ctx.fillText(":( A problem has been detected and the OS has been shut down.", minX + 60, minY + 80);
      ctx.fillText("TECHNICAL INFORMATION:", minX + 60, minY + 120);
      ctx.fillText("*** STOP: 0x000000D1 (0x0000000C, 0x00000002, 0x00000000, 0xF86B5A89)", minX + 60, minY + 145);
      ctx.fillText("*** ALAN_BECKER_STICKMAN_SYS - ADDRESS F86B5A89 BASE AT F86B4000", minX + 60, minY + 170);
      ctx.fillText(">>> DEFEAT THE TITAN UNDEAD TO REBOOT SYSTEM <<<", minX + 60, minY + 210);
    } else if (this.theme === 'firewall') {
      // Neon Security Grid
      paintBackdrop('#111827');
      ctx.strokeStyle = '#ff3344';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.2;
      for (let x = minX; x <= maxX; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
      }
      for (let y = minY; y <= maxY; y += 60) {
        ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    } else if (this.theme === 'downloads') {
      // Download manager / quarantine zone with readable transfer lanes.
      paintBackdrop('#17243a');
      for (let y = minY + 70; y < maxY - 40; y += 95) {
        ctx.fillStyle = 'rgba(72, 137, 205, 0.12)';
        ctx.fillRect(minX + 55, y, maxX - minX - 110, 28);
        ctx.fillStyle = 'rgba(46, 204, 113, 0.22)';
        const progress = 0.3 + ((y - minY) % 260) / 400;
        ctx.fillRect(minX + 62, y + 7, (maxX - minX - 124) * progress, 14);
      }
    } else if (this.theme === 'recycle') {
      // Recycle-bin interior: cool metal panels and descending data scraps.
      paintBackdrop('#172b35');
      ctx.strokeStyle = 'rgba(117, 214, 218, 0.18)';
      ctx.lineWidth = 2;
      for (let x = minX; x <= maxX; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x + 180, maxY); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(139, 233, 236, 0.22)';
      ctx.font = '18px monospace';
      for (let i = 0; i < 18; i++) {
        ctx.fillText(i % 2 ? '01' : '{}', minX + 80 + i * 118, minY + 70 + (i % 4) * 110);
      }
    } else if (this.theme === 'minecraft') {
      // Original voxel-like Nether-inspired data cavern. Large tiles keep the
      // reference legible without loading any bitmap assets.
      paintBackdrop('#29151d');
      const tile = 80;
      for (let y = minY; y < maxY; y += tile) {
        for (let x = minX; x < maxX; x += tile) {
          const alternate = ((x / tile + y / tile) & 1) === 0;
          ctx.fillStyle = alternate ? 'rgba(128, 47, 54, 0.18)' : 'rgba(49, 25, 58, 0.2)';
          ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        }
      }
      ctx.fillStyle = 'rgba(255, 88, 20, 0.34)';
      ctx.fillRect(minX, minY + 95, maxX - minX, 12);
    } else if (this.theme === 'virabot') {
      // Infection nexus: a sparse pulsing network instead of particle spam.
      paintBackdrop('#180a24');
      const pulse = 0.35 + Math.sin(Date.now() * 0.003) * 0.08;
      ctx.strokeStyle = `rgba(255, 35, 104, ${pulse})`;
      ctx.fillStyle = 'rgba(255, 35, 104, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const x = minX + 80 + i * 135;
        const y = minY + 90 + (i % 5) * 105;
        ctx.moveTo(x, y); ctx.lineTo(x + 115, y + ((i % 3) - 1) * 80);
        ctx.moveTo(x + 6, y); ctx.arc(x, y, 7, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.fill();
    } else if (this.theme === 'dark_core') {
      // The Dark Core - Corrupted Red Cyber Void (TDL Boss Arena)
      paintBackdrop('#140005');

      // Crimson Glitch Grid
      ctx.strokeStyle = 'rgba(255, 0, 50, 0.25)';
      ctx.lineWidth = 1;
      for (let x = minX; x <= maxX; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
      }
      for (let y = minY; y <= maxY; y += 50) {
        ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
      }

      // Warning matrix text
      ctx.fillStyle = '#ff1133';
      ctx.font = "bold 14px monospace";
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 12;
      ctx.fillText(">>> CRITICAL THREAT: THE_DARK_LORD.EXE HAS CORRUPTED THE CORE <<<", minX + 60, minY + 80);
      ctx.fillText(">>> SYSTEM INTEGRITY: 0% | VIRABOT POWER LEVEL: MAXIMUM <<<", minX + 60, minY + 110);
      ctx.fillText(">>> DEFEAT THE DARK LORD TO RESTORE THE DESKTOP <<<", minX + 60, minY + 140);
    } else if (this.theme === 'terminal') {
      // Hacker Terminal Green Grid
      paintBackdrop('#051108');
      ctx.strokeStyle = 'rgba(50, 255, 100, 0.2)';
      ctx.lineWidth = 1;
      for (let x = minX; x <= maxX; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
      }
      for (let y = minY; y <= maxY; y += 50) {
        ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
      }
      ctx.fillStyle = '#33ff77';
      ctx.font = "14px monospace";
      ctx.fillText("root@desktop:~$ ./firewall_purge --force", minX + 60, minY + 80);
    } else {
      // Classic Desktop Theme (Slate / Windows blue)
      paintBackdrop('#262c3e');

      // Desktop grid
      ctx.strokeStyle = 'rgba(55, 62, 85, 0.6)';
      ctx.lineWidth = 1;
      for (let x = minX; x <= maxX; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
      }
      for (let y = minY; y <= maxY; y += 60) {
        ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
      }
    }

    // Ground Line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(minX, groundY);
    ctx.lineTo(maxX, groundY);
    ctx.stroke();

    // Boundary walls
    ctx.strokeStyle = '#ff3344';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(minX, minY); ctx.lineTo(minX, groundY);
    ctx.moveTo(maxX, minY); ctx.lineTo(maxX, groundY);
    ctx.stroke();

    ctx.restore();
  }

  drawDesktopIcons(ctx) {
    for (const icon of this.desktopIcons) {
      ctx.save();
      // Icon Box
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.fillRect(icon.x - 30, icon.y - 40, 60, 50);
      ctx.strokeRect(icon.x - 30, icon.y - 40, 60, 50);

      // Emoji / Icon Glyph
      ctx.font = "24px sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon.icon, icon.x, icon.y - 15);

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 10px 'Nunito', sans-serif";
      ctx.fillText(icon.label, icon.x, icon.y + 20);
      ctx.restore();
    }
  }

  drawErrorPopups(ctx) {
    for (const pop of this.errorPopups) {
      ctx.save();
      // Window Body
      ctx.fillStyle = '#ece9d8';
      ctx.strokeStyle = '#0055ea';
      ctx.lineWidth = 2;
      ctx.fillRect(pop.x - pop.width / 2, pop.y - pop.height / 2, pop.width, pop.height);
      ctx.strokeRect(pop.x - pop.width / 2, pop.y - pop.height / 2, pop.width, pop.height);

      // Title bar
      ctx.fillStyle = '#0055ea';
      ctx.fillRect(pop.x - pop.width / 2, pop.y - pop.height / 2, pop.width, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText(pop.title, pop.x - pop.width / 2 + 6, pop.y - pop.height / 2 + 13);

      // Message
      ctx.fillStyle = '#000000';
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(pop.msg, pop.x, pop.y + 12);
      ctx.restore();
    }
  }

  drawDoors(ctx, groundY) {
    // 1. Entrance Door (Start Portal)
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.fillRect(this.entranceDoor.x - 30, groundY - this.entranceDoor.height, 60, this.entranceDoor.height);
    ctx.strokeRect(this.entranceDoor.x - 30, groundY - this.entranceDoor.height, 60, this.entranceDoor.height);
    ctx.fillStyle = '#38bdf8';
    ctx.font = "bold 11px 'Bungee', cursive";
    ctx.textAlign = 'center';
    ctx.fillText("START", this.entranceDoor.x, groundY - this.entranceDoor.height - 8);
    ctx.restore();

    // 2. Exit Door (Goal Portal)
    ctx.save();
    const isOpen = this.exitDoor.isOpen;
    ctx.fillStyle = isOpen ? '#022c22' : '#3f1118';
    ctx.strokeStyle = isOpen ? '#10b981' : '#ef4444';
    ctx.lineWidth = 4;
    ctx.fillRect(this.exitDoor.x - 32, groundY - this.exitDoor.height, 64, this.exitDoor.height);
    ctx.strokeRect(this.exitDoor.x - 32, groundY - this.exitDoor.height, 64, this.exitDoor.height);

    // Glowing Interactive Vortex if open
    if (isOpen) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(this.exitDoor.x - 24, groundY - this.exitDoor.height + 8, 48, this.exitDoor.height - 16);

      // Swirling inner cyber vortex
      const time = Date.now() * 0.006;
      ctx.fillStyle = '#6ee7b7';
      for (let i = 0; i < 4; i++) {
        const vy = (groundY - this.exitDoor.height + 14) + ((time * 25 + i * 15) % (this.exitDoor.height - 28));
        ctx.beginPath();
        ctx.arc(this.exitDoor.x + Math.sin(time + i) * 12, vy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bouncing Guide Arrow above door
      const bounce = Math.sin(Date.now() * 0.008) * 8;
      ctx.fillStyle = '#ffea00';
      ctx.font = "bold 13px 'Bungee', cursive";
      ctx.textAlign = 'center';
      ctx.fillText("⬇ ENTER EXIT ⬇", this.exitDoor.x, groundY - this.exitDoor.height - 16 + bounce);
    } else {
      // Locked Icon
      ctx.fillStyle = '#ef4444';
      ctx.font = "bold 11px 'Bungee', cursive";
      ctx.textAlign = 'center';
      ctx.fillText("🔒 LOCKED", this.exitDoor.x, groundY - this.exitDoor.height - 8);
    }
    ctx.restore();
  }

  drawPlatforms(ctx) {
    const allPlatforms = this.getAllSolidPlatforms();
    for (const p of allPlatforms) {
      ctx.save();
      const halfW = p.width / 2;
      const topY = p.y - p.height;

      // Window Platform Body
      if (p.appType === 'dark_core') {
        ctx.fillStyle = '#180006';
        ctx.strokeStyle = '#ff0033';
        ctx.shadowColor = '#ff0033';
        ctx.shadowBlur = 12;
      } else if (p.appType === 'bsod') {
        ctx.fillStyle = '#002277';
        ctx.strokeStyle = '#38bdf8';
      } else {
        ctx.fillStyle = 'rgba(26, 29, 44, 0.94)';
        ctx.strokeStyle = '#475569';
      }

      ctx.lineWidth = 2;
      ctx.fillRect(p.x - halfW, topY, p.width, p.height);
      ctx.strokeRect(p.x - halfW, topY, p.width, p.height);

      // Window Titlebar Header (Top 8px)
      ctx.fillStyle = p.appType === 'dark_core' ? '#3b000d' : (p.appType === 'bsod' ? '#003399' : '#334155');
      ctx.fillRect(p.x - halfW, topY, p.width, 9);

      // Authentic Traffic-Light Window Controls [ Red | Yellow | Green ]
      const ctrlY = topY + 4.5;
      ctx.fillStyle = '#ff5f56';
      ctx.beginPath(); ctx.arc(p.x + halfW - 20, ctrlY, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffbd2e';
      ctx.beginPath(); ctx.arc(p.x + halfW - 13, ctrlY, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#27c93f';
      ctx.beginPath(); ctx.arc(p.x + halfW - 6, ctrlY, 2.4, 0, Math.PI * 2); ctx.fill();

      // Title Text
      ctx.fillStyle = p.appType === 'dark_core' ? '#ff6688' : (p.appType === 'bsod' ? '#ffffff' : '#94a3b8');
      ctx.font = "bold 9px 'Nunito', sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText(p.title, p.x - halfW + 8, topY + 7);
      ctx.restore();
    }
  }

  drawLaserHazards(ctx) {
    for (const laser of this.laserHazards) {
      const isActive = laser.timer < laser.activeDuration;
      ctx.save();
      if (isActive) {
        // Lethal Red Security Beam
        ctx.fillStyle = '#ff2244';
        ctx.shadowColor = '#ff2244';
        ctx.shadowBlur = 14;
        ctx.fillRect(laser.x, laser.y - laser.height / 2, laser.width, laser.height);

        // Core white ray
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(laser.x, laser.y - 2, laser.width, 4);
      } else {
        // Warning Dotted Laser Line
        ctx.strokeStyle = 'rgba(255, 68, 68, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(laser.x, laser.y);
        ctx.lineTo(laser.x + laser.width, laser.y);
        ctx.stroke();
      }

      // Emitter nodes at left and right
      ctx.fillStyle = '#444';
      ctx.fillRect(laser.x - 8, laser.y - 8, 8, 16);
      ctx.fillRect(laser.x + laser.width, laser.y - 8, 8, 16);
      ctx.restore();
    }
  }

  drawTaskbar(ctx, groundY) {
    const minX = this.bounds.minX - 500;
    const maxX = this.bounds.maxX + 500;

    ctx.save();
    // Solid Ground Substrate foundation below groundY
    ctx.fillStyle = '#0b0d13';
    ctx.fillRect(minX, groundY, maxX - minX, 1000);

    // Windows Taskbar bar
    ctx.fillStyle = '#11131c';
    ctx.strokeStyle = '#2d3147';
    ctx.lineWidth = 2;
    ctx.fillRect(this.bounds.minX, groundY, this.bounds.maxX - this.bounds.minX, 42);
    ctx.strokeRect(this.bounds.minX, groundY, this.bounds.maxX - this.bounds.minX, 42);

    // Start Button
    ctx.fillStyle = '#0078d7';
    ctx.fillRect(this.bounds.minX + 10, groundY + 6, 80, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 12px 'Nunito', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText("🪟 START", this.bounds.minX + 50, groundY + 25);

    // Active Taskbar App Tabs
    const tabs = ['Stick_vs_Zombies.exe', 'Animation_v2.fla', 'Zombies_Horde.cmd'];
    tabs.forEach((tab, i) => {
      const tx = this.bounds.minX + 100 + i * 160;
      ctx.fillStyle = i === 0 ? '#262a3e' : '#181a26';
      ctx.fillRect(tx, groundY + 6, 150, 28);
      ctx.fillStyle = '#a5accb';
      ctx.font = "11px 'Nunito', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(tab, tx + 75, groundY + 23);
    });

    // Right System Tray Clock
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 12px monospace";
    ctx.textAlign = 'right';
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.fillText(`🔊 100% | 📅 ${timeStr}`, this.bounds.maxX - 20, groundY + 25);

    ctx.restore();
  }

  drawScreenGuide(ctx, camera, viewportWidth, viewportHeight) {
    if (!this.exitDoor.isOpen || !camera) return;
    const screen = camera.worldToScreen(this.exitDoor.x, this.exitDoor.y - 50);
    if (screen.x >= 24 && screen.x <= viewportWidth - 24) return;

    const isLeft = screen.x < 0;
    const x = isLeft ? 54 : viewportWidth - 54;
    const y = Math.max(120, Math.min(viewportHeight - 118, screen.y));
    ctx.save();
    ctx.fillStyle = 'rgba(2, 44, 34, 0.94)';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect?.(x - 34, y - 16, 68, 32, 10);
    if (ctx.roundRect) {
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x - 34, y - 16, 68, 32);
      ctx.strokeRect(x - 34, y - 16, 68, 32);
    }
    ctx.fillStyle = '#d1fae5';
    ctx.font = "900 11px 'Nunito', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isLeft ? '◀ EXIT' : 'EXIT ▶', x, y);
    ctx.restore();
  }
}

export const stages = new StageManager();
