
import { particles } from '../engine/particles.js?v=8.4';
import { audio } from '../engine/audio.js?v=8.4';
import { projectiles } from '../entities/projectiles.js?v=8.4';

const freezeBeat = (beat) => Object.freeze({
  ...beat,
  ...(beat.allyReaction ? { allyReaction: Object.freeze({ ...beat.allyReaction }) } : {})
});

export const CAMPAIGN_BEATS = Object.freeze({
  1: freezeBeat({
    act: 'I - BUG ON THE LOOSE',
    mission: 'STOP THE DESKTOP BUG',
    clearText: 'TRAIL FOUND!',
    clue: 'RESTORE.KEY WAS SPLIT',
    bossLabel: null,
    allyReaction: { ally: 'red', line: 'BUGS NEED BONKS!' }
  }),
  2: freezeBeat({
    act: 'I - BUG ON THE LOOSE',
    mission: 'FOLLOW THE BAD FRAMES',
    clearText: 'FRAMES REPAIRED!',
    clue: 'THE BUG SKIPPED AHEAD',
    bossLabel: null,
    allyReaction: { ally: 'green', line: 'FOUND THE BAD BEAT!' }
  }),
  3: freezeBeat({
    act: 'I - BUG ON THE LOOSE',
    mission: 'CHECK THE FAKE DOWNLOAD',
    clearText: 'DOWNLOAD TRACED!',
    clue: 'USER: H4C3R?',
    bossLabel: null,
    allyReaction: { ally: 'blue', line: 'POTION THIEF!' }
  }),
  4: freezeBeat({
    act: 'I - BUG ON THE LOOSE',
    mission: 'OPEN THE FIREWALL',
    clearText: 'FIREWALL OPEN!',
    clue: 'KEY SIGNAL IN CRASH DUMP',
    bossLabel: null,
    allyReaction: { ally: 'red', line: 'KNOCK KNOCK!' }
  }),
  5: freezeBeat({
    act: 'I - BUG ON THE LOOSE',
    mission: 'DEFEAT THE TITAN',
    clearText: 'RESTORE KEY 1/3!',
    clue: 'NEXT TRACE: RECYCLE BIN',
    bossLabel: 'TITAN UNDEAD',
    allyReaction: { ally: 'yellow', line: 'ONE KEY, TWO TO GO!' }
  }),
  6: freezeBeat({
    act: 'II - DELETED TRAIL',
    mission: 'UNDELETE THE TRAIL',
    clearText: 'TRACE RESTORED!',
    clue: 'OLD BATTLES WERE COPIED',
    bossLabel: null,
    allyReaction: { ally: 'cursor', line: 'UNDELETE COMPLETE.' }
  }),
  7: freezeBeat({
    act: 'II - DELETED TRAIL',
    mission: 'CROSS THE BLOCK BACKUP',
    clearText: 'BACKUP CLEAN!',
    clue: 'REMOTE CODE BELOW',
    bossLabel: null,
    allyReaction: { ally: 'yellow', line: 'BLOCKS? MY THING.' }
  }),
  8: freezeBeat({
    act: 'II - DELETED TRAIL',
    mission: 'RUN THE CLEANUP',
    clearText: 'REMOTE USER FOUND!',
    clue: 'H4C3R IS CONNECTED',
    bossLabel: null,
    allyReaction: { ally: 'cursor', line: 'USER TRACE LOCKED.' }
  }),
  9: freezeBeat({
    act: 'II - DELETED TRAIL',
    mission: 'SHUT THE VIRABOT NEXUS',
    clearText: 'NEXUS OFFLINE!',
    clue: 'DARK BACKUP ACTIVE',
    bossLabel: null,
    allyReaction: { ally: 'blue', line: 'THAT CODE LOOKS SICK.' }
  }),
  10: freezeBeat({
    act: 'II - DELETED TRAIL',
    mission: 'CLEAR THE DARK BACKUP',
    clearText: 'RESTORE KEY 2/3!',
    clue: 'A REPLAY HOLDS PIECE 3',
    bossLabel: 'DARK LORD // BACKUP',
    allyReaction: { ally: 'red', line: 'BACKUP: BONKED.' }
  }),
  11: freezeBeat({
    act: 'III - REPLAY TRAP',
    mission: "FREE THE KING'S REPLAY",
    clearText: 'RESTORE KEY 3/3!',
    clue: 'TRACE: ROOT://H4C3R',
    bossLabel: 'KING ORANGE // REPLAY',
    allyReaction: { ally: 'yellow', line: 'THAT WAS A COPY!' }
  }),
  12: freezeBeat({
    act: 'III - REPLAY TRAP',
    mission: 'CHASE THE FAKE TABS',
    clearText: 'RIGHT TAB FOUND!',
    clue: 'TRACE MOVED TO CLOUD',
    bossLabel: null,
    allyReaction: { ally: 'cursor', line: 'WRONG TAB. AGAIN.' }
  }),
  13: freezeBeat({
    act: 'III - REPLAY TRAP',
    mission: 'SYNC THE ROOT TRACE',
    clearText: 'TRACE LOCKED!',
    clue: 'ROOT GATE LOCATED',
    bossLabel: null,
    allyReaction: { ally: 'green', line: 'CLOUDS HAVE BAD WIFI.' }
  }),
  14: freezeBeat({
    act: 'III - REPLAY TRAP',
    mission: 'BREAK THE ROOT GATE',
    clearText: 'MAINFRAME OPEN!',
    clue: 'H4C3R IS INSIDE',
    bossLabel: null,
    allyReaction: { ally: 'red', line: 'FINAL DOOR. BIG BONK.' }
  }),
  15: freezeBeat({
    act: 'III - REPLAY TRAP',
    mission: 'LOG OUT H4C3R',
    clearText: 'SYSTEM RESTORED!',
    clue: 'RESTORE KEY COMPLETE',
    bossLabel: 'H4C3R',
    allyReaction: { ally: 'green', line: 'FINAL BOSS MUSIC!' }
  })
});

export const MAX_ENVIRONMENT_DECORATIONS = 24;

const ENVIRONMENT_COLORS = Object.freeze({
  desktop: '#7d8caf', animate: '#9299bd', downloads: '#62c4ff', firewall: '#ff4f64',
  bsod: '#d5ecff', recycle: '#75d6da', minecraft: '#ff682c', terminal: '#45ff82',
  virabot: '#ff397b', dark_core: '#ff234d', command_realm: '#ffb340',
  browser_glitch: '#5ce1ff', cloud_cache: '#a6e3ff', root_gateway: '#42ff8a',
  zero_day: '#74edff'
});

function createEnvironmentDecorations(stage, theme) {
  const color = ENVIRONMENT_COLORS[theme] || ENVIRONMENT_COLORS.desktop;
  const decorations = Array.from({ length: MAX_ENVIRONMENT_DECORATIONS }, (_, index) => Object.freeze({
    layer: index % 2,
    x: -1020 + ((index * 347 + stage * 89) % 2040),
    y: -625 + ((index * 173 + stage * 61) % 470),
    size: 2 + ((index * 5 + stage) % 7),
    speed: 0.12 + ((index + stage) % 5) * 0.025,
    phase: ((index * 37 + stage * 13) % 360) * Math.PI / 180,
    shape: (index + stage) % 3,
    color
  }));
  return Object.freeze(decorations);
}

function strokeGridPath(ctx, minX, maxX, minY, maxY, stepX, stepY = stepX) {
  ctx.beginPath();
  for (let x = minX; x <= maxX; x += stepX) {
    ctx.moveTo(x, minY);
    ctx.lineTo(x, maxY);
  }
  for (let y = minY; y <= maxY; y += stepY) {
    ctx.moveTo(minX, y);
    ctx.lineTo(maxX, y);
  }
  ctx.stroke();
}

export class StageManager {
  constructor() {
    this.currentStage = 1;
    this.maxStage = 15;
    this.stageName = 'Main Desktop';
    this.theme = 'desktop'; // 'desktop', 'animate', 'downloads', 'firewall', 'bsod'

    this.bounds = {
      minX: -1100,
      maxX: 1100,
      minY: -700,
      maxY: 100,
      groundY: 0
    };

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };
    this.platforms = [];
    this.movingPlatforms = [];
    this.desktopIcons = [];
    this.laserHazards = [];
    this.errorPopups = [];

    this.isObjectiveComplete = false;
    this.doorTransitionTimer = 0;
    this.exitFocusTimer = -1;
    this.stageTime = 0;
    this.campaignBeat = CAMPAIGN_BEATS[1];
    this.environmentDecorations = Object.freeze([]);
    this.solidPlatformsScratch = [];

    this.loadStage(1);
  }

  loadStage(stageNum) {
    this.maxStage = 15;
    const numericStage = Number.isFinite(stageNum) ? Math.trunc(stageNum) : 1;
    const stage = Math.max(1, Math.min(this.maxStage, numericStage));
    this.currentStage = stage;
    this.isObjectiveComplete = false;
    this.exitDoor.isOpen = false;
    this.doorTransitionTimer = 0;
    this.exitFocusTimer = -1;
    this.stageTime = 0;
    this.campaignBeat = CAMPAIGN_BEATS[stage];

    this.platforms = [];
    this.movingPlatforms = [];
    this.desktopIcons = [];
    this.laserHazards = [];
    this.errorPopups = [];

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
      case 11:
        this.buildStage11CommandThrone();
        break;
      case 12:
        this.buildStage12GlitchBrowser();
        break;
      case 13:
        this.buildStage13CloudCache();
        break;
      case 14:
        this.buildStage14RootGateway();
        break;
      case 15:
        this.buildStage15ZeroDayMainframe();
        break;
    }

    this.environmentDecorations = createEnvironmentDecorations(stage, this.theme);
  }

  getCampaignBeat(stageNum = this.currentStage) {
    const stage = Math.max(1, Math.min(this.maxStage, Math.trunc(Number(stageNum)) || 1));
    return CAMPAIGN_BEATS[stage];
  }

  resolveStageExit(nextStage, onComplete, onAdvance) {
    if (this.currentStage >= this.maxStage) {
      if (onComplete) onComplete();
      return 'complete';
    }
    if (onAdvance) onAdvance(nextStage);
    return 'advance';
  }


  buildStage1Desktop() {
    this.stageName = 'Main Desktop';
    this.theme = 'desktop';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -650, y: -160, width: 220, height: 20, title: 'Notepad.exe - Notes.txt', appType: 'notepad' },
      { x: -350, y: -280, width: 200, height: 20, title: 'Calculator.exe', appType: 'calc' },
      { x: 0, y: -180, width: 260, height: 22, title: 'File Explorer - C:/Users/Alan', appType: 'folder' },
      { x: 380, y: -280, width: 220, height: 20, title: 'Paint.exe - Drawing', appType: 'paint' },
      { x: 680, y: -160, width: 200, height: 20, title: 'Command_Prompt.cmd', appType: 'cmd' }
    ];

    this.desktopIcons = [
      { x: -850, y: -80, label: 'Recycle Bin', icon: '🗑️' },
      { x: -850, y: -200, label: 'My Computer', icon: '💻' },
      { x: -850, y: -320, label: 'Chrome.exe', icon: '🌐' },
      { x: -500, y: -420, label: 'Minecraft.exe', icon: '⛏️' },
      { x: 200, y: -420, label: 'Stickman_v2.fla', icon: '🎬' },
      { x: 850, y: -80, label: 'Exit_Portal.exe', icon: '🚪' },
      { x: 850, y: -200, label: 'Secret_Folder', icon: '📁' }
    ];

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

    this.platforms = [
      { x: -700, y: -180, width: 200, height: 20, title: 'Toolbox - Brush & Pencil', appType: 'tools' },
      { x: -250, y: -160, width: 240, height: 20, title: 'Layer 1: Stick Animation', appType: 'layer' },
      { x: 250, y: -160, width: 240, height: 20, title: 'Layer 2: Zombie Horde', appType: 'layer' },
      { x: 700, y: -200, width: 200, height: 20, title: 'Color Swatches Palette', appType: 'palette' }
    ];

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

    this.platforms = [
      { x: -680, y: -180, width: 220, height: 20, title: 'Download_1: Cheats.zip (98%)', appType: 'download' },
      { x: -280, y: -240, width: 190, height: 20, title: 'Corrupted_Script.js', appType: 'glitch' },
      { x: 280, y: -240, width: 190, height: 20, title: 'Free_RAM_Installer.exe', appType: 'malware' },
      { x: 680, y: -180, width: 220, height: 20, title: 'Download_2: Patch.iso (100%)', appType: 'download' }
    ];

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

  buildStage11CommandThrone() {
    this.stageName = 'King Orange: Corrupted Replay';
    this.theme = 'command_realm';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -560, y: -170, width: 260, height: 24, title: 'GOLD_BLOCK_RAMPART', appType: 'command' },
      { x: 0, y: -310, width: 340, height: 26, title: 'COMMAND_BLOCK_THRONE', appType: 'command' },
      { x: 560, y: -170, width: 260, height: 24, title: 'NETHERITE_RAMPART', appType: 'command' }
    ];

    this.desktopIcons = [
      { x: -850, y: -115, label: 'gold_block.dat', icon: '🟨' },
      { x: 850, y: -115, label: 'command_block.exe', icon: '🟧' }
    ];
  }

  buildStage12GlitchBrowser() {
    this.stageName = 'Glitch Browser Run';
    this.theme = 'browser_glitch';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -620, y: -165, width: 250, height: 22, title: 'Tab: definitely_safe.exe', appType: 'browser' },
      { x: 0, y: -270, width: 300, height: 22, title: '404_REALITY_NOT_FOUND', appType: 'browser' },
      { x: 620, y: -165, width: 250, height: 22, title: 'Tab: close_me_now.js', appType: 'browser' }
    ];

    this.movingPlatforms.push({
      x: 0, y: -390, width: 190, height: 20, title: 'Loading… 99%', appType: 'browser',
      minX: -300, maxX: 300, speed: 150, dir: 1, axis: 'x'
    });

    this.errorPopups.push({
      x: -360, y: -120, width: 150, height: 72, title: '⚠ POP-UP', msg: 'You won a zombie!'
    });
    this.errorPopups.push({
      x: 380, y: -120, width: 150, height: 72, title: 'COOKIE ERROR', msg: 'Brains accepted.'
    });
  }

  buildStage13CloudCache() {
    this.stageName = 'Corrupted Cloud Cache';
    this.theme = 'cloud_cache';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -650, y: -150, width: 220, height: 22, title: 'CACHE_SHARD_A', appType: 'cloud' },
      { x: -220, y: -280, width: 190, height: 22, title: 'SYNC_CONFLICT_01', appType: 'cloud' },
      { x: 220, y: -280, width: 190, height: 22, title: 'SYNC_CONFLICT_02', appType: 'cloud' },
      { x: 650, y: -150, width: 220, height: 22, title: 'CACHE_SHARD_B', appType: 'cloud' }
    ];

    this.movingPlatforms.push({
      x: 0, y: -165, width: 180, height: 20, title: 'Cloud Sync', appType: 'cloud',
      minY: -370, maxY: -120, speed: 115, dir: -1, axis: 'y'
    });

    this.desktopIcons = [
      { x: -850, y: -105, label: 'backup_old.zip', icon: '☁️' },
      { x: 850, y: -105, label: 'sync_failed.log', icon: '⚡' }
    ];
  }

  buildStage14RootGateway() {
    this.stageName = 'Root Access Gateway';
    this.theme = 'root_gateway';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -590, y: -185, width: 250, height: 22, title: 'AUTH_GATE_LEFT', appType: 'terminal' },
      { x: 0, y: -310, width: 320, height: 24, title: 'sudo ./open_root --please', appType: 'terminal' },
      { x: 590, y: -185, width: 250, height: 22, title: 'AUTH_GATE_RIGHT', appType: 'terminal' }
    ];

    this.laserHazards.push({
      x: -470, y: -95, width: 260, height: 9, timer: 0,
      cycleDuration: 3.2, activeDuration: 1.15, damage: 20
    });
    this.laserHazards.push({
      x: 210, y: -95, width: 260, height: 9, timer: 1.6,
      cycleDuration: 3.2, activeDuration: 1.15, damage: 20
    });
  }

  buildStage15ZeroDayMainframe() {
    this.stageName = 'Zero-Day Mainframe';
    this.theme = 'zero_day';

    this.entranceDoor = { x: -950, y: 0, width: 60, height: 90 };
    this.exitDoor = { x: 950, y: 0, width: 60, height: 90, isOpen: false };

    this.platforms = [
      { x: -570, y: -180, width: 260, height: 24, title: 'FREE_TRANSFORM_LEFT', appType: 'zero_day' },
      { x: 0, y: -325, width: 360, height: 26, title: 'ROOT://H4C3R/CONTROL', appType: 'zero_day' },
      { x: 570, y: -180, width: 260, height: 24, title: 'FREE_TRANSFORM_RIGHT', appType: 'zero_day' }
    ];

    this.desktopIcons = [
      { x: -850, y: -110, label: 'memory.scan', icon: '◫' },
      { x: 850, y: -110, label: 'root.key', icon: '⌘' }
    ];
  }

  update(dt, player, wavesDirector, onStageExit, camera = null) {
    const safeDt = Math.max(0, Math.min(Number(dt) || 0, 0.1));
    this.stageTime += safeDt;

    if (this.exitFocusTimer > 0) {
      this.exitFocusTimer -= safeDt;
      if (this.exitFocusTimer <= 0) {
        this.exitFocusTimer = -1;
        camera?.focusOn?.(this.exitDoor.x, this.exitDoor.y - 45, 0.45, 0.96);
        camera?.addZoomPunch?.(0.03);
      }
    }

    for (const p of this.movingPlatforms) {
      if (p.axis === 'x') {
        p.x += p.speed * p.dir * safeDt;
        if (p.x >= p.maxX) { p.x = p.maxX; p.dir = -1; }
        else if (p.x <= p.minX) { p.x = p.minX; p.dir = 1; }
      } else if (p.axis === 'y') {
        p.y += p.speed * p.dir * safeDt;
        if (p.y >= p.maxY) { p.y = p.maxY; p.dir = -1; }
        else if (p.y <= p.minY) { p.y = p.minY; p.dir = 1; }
      }
    }

    for (const laser of this.laserHazards) {
      laser.timer = (laser.timer + safeDt) % laser.cycleDuration;
      const isActive = laser.timer < laser.activeDuration;

      if (isActive && !laser.wasActive) {
        laser.hookedHitTargets = new WeakSet();
      } else if (!isActive) {
        laser.hookedHitTargets = null;
      }
      laser.wasActive = isActive;

      if (!this.isObjectiveComplete && isActive && player && (player.iFrames || 0) <= 0 && !player.isRolling && !player.isAwakened) {
        if (player.x >= laser.x - 20 && player.x <= laser.x + laser.width + 20 &&
            Math.abs(player.y - 30 - laser.y) < 25) {
          audio.playLaserZap();
          player.takeDamage(laser.damage, player.x < laser.x + laser.width / 2 ? -1 : 1, 350);
          particles.createHitSparks(player.x, laser.y, 8, '#ff2244');
        }
      }

      if (!this.isObjectiveComplete && this.theme === 'firewall' && isActive && Array.isArray(player?.currentZombies)) {
        let zappedHookTarget = false;
        for (const zombie of player.currentZombies) {
          if (!zombie || zombie.isDead || zombie.hookPullTimer <= 0 || typeof zombie.takeDamage !== 'function') continue;
          if (laser.hookedHitTargets?.has(zombie)) continue;

          const radius = Number(zombie.radius) || 18;
          const height = Number(zombie.height) || 58;
          const overlapsLane = zombie.x + radius >= laser.x && zombie.x - radius <= laser.x + laser.width;
          const beamTop = laser.y - laser.height / 2;
          const beamBottom = laser.y + laser.height / 2;
          const hookSweepTop = zombie.y - height - 48;
          const hookSweepBottom = zombie.y + 8;
          if (!overlapsLane || beamBottom < hookSweepTop || beamTop > hookSweepBottom) continue;

          laser.hookedHitTargets?.add(zombie);
          const knockbackDirection = zombie.x < laser.x + laser.width / 2 ? -1 : 1;
          zombie.takeDamage(laser.damage, knockbackDirection, 360, true);
          particles.createHitSparks(zombie.x, laser.y, 8, '#ffea00');
          zappedHookTarget = true;
        }
        if (zappedHookTarget) audio.playLaserZap();
      }
    }

    const allEnemiesDefeated = wavesDirector && wavesDirector.isWaveActive &&
                               wavesDirector.spawnQueue.length === 0 &&
                               wavesDirector.zombies.length === 0;

    if (allEnemiesDefeated && !this.isObjectiveComplete) {
      this.isObjectiveComplete = true;
      this.exitDoor.isOpen = true;
      projectiles.clearHostileEffects?.();
      audio.playDoorUnlock();
      const clearText = this.campaignBeat?.clearText || 'STAGE CLEAR!';
      const clearX = Number.isFinite(player?.x) ? player.x : 0;
      const clearY = Number.isFinite(player?.y) ? player.y - 86 : -86;
      particles.addTextBanner(clearX, clearY, `★ ${clearText} ★`, '#ffee00');
      particles.addTextBanner(this.exitDoor.x, this.exitDoor.y - 120, '★ EXIT DOOR OPEN! ★', '#33ff88');
      particles.addShockwave(this.exitDoor.x, this.exitDoor.y - 45, 120, '#33ff88', 8);
      if (this.currentStage === this.maxStage) {
        this.exitFocusTimer = 0.9;
      } else {
        camera?.focusOn?.(this.exitDoor.x, this.exitDoor.y - 45, 0.45, 0.96);
        camera?.addZoomPunch?.(0.03);
      }
    }

    if (this.exitDoor.isOpen && player && !player.isDead) {
      const distToExit = Math.hypot(player.x - this.exitDoor.x, player.y - this.exitDoor.y);
      if (distToExit < 60) {
        this.doorTransitionTimer += safeDt;
        particles.createAwakeningAura(this.exitDoor.x, this.exitDoor.y - 45, 2);

        if (this.doorTransitionTimer > 0.4) {
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
    const output = this.solidPlatformsScratch;
    output.length = 0;
    for (const platform of this.platforms) output.push(platform);
    for (const platform of this.movingPlatforms) output.push(platform);
    return output;
  }


  draw(ctx, groundY, crowded = false) {
    this.crowdedRender = crowded;
    this.drawDesktopBackground(ctx, groundY);

    this.drawDesktopIcons(ctx);

    this.drawErrorPopups(ctx);

    this.drawDoors(ctx, groundY);

    this.drawPlatforms(ctx);

    this.drawLaserHazards(ctx);

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
      paintBackdrop('#2d2f3a');

      ctx.strokeStyle = 'rgba(70, 75, 95, 0.4)';
      ctx.lineWidth = 1;
      strokeGridPath(ctx, minX, maxX, minY, maxY, 50);
      ctx.fillStyle = '#1e2029';
      ctx.fillRect(minX, minY, maxX - minX, 24);
      ctx.fillStyle = '#888ea6';
      ctx.font = "10px monospace";
      for (let x = minX; x <= maxX; x += 100) {
        ctx.fillText(`${x}`, x + 5, minY + 16);
      }
    } else if (this.theme === 'bsod') {
      paintBackdrop('#0047b3');

      ctx.fillStyle = '#ffffff';
      ctx.font = "14px monospace";
      ctx.fillText(":( A problem has been detected and the OS has been shut down.", minX + 60, minY + 80);
      ctx.fillText("TECHNICAL INFORMATION:", minX + 60, minY + 120);
      ctx.fillText("*** STOP: 0x000000D1 (0x0000000C, 0x00000002, 0x00000000, 0xF86B5A89)", minX + 60, minY + 145);
      ctx.fillText("*** ALAN_BECKER_STICKMAN_SYS - ADDRESS F86B5A89 BASE AT F86B4000", minX + 60, minY + 170);
      ctx.fillText(">>> DEFEAT THE TITAN UNDEAD TO REBOOT SYSTEM <<<", minX + 60, minY + 210);
    } else if (this.theme === 'firewall') {
      paintBackdrop('#111827');
      ctx.strokeStyle = '#ff3344';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.2;
      strokeGridPath(ctx, minX, maxX, minY, maxY, 60);
      ctx.globalAlpha = 1.0;
    } else if (this.theme === 'downloads') {
      paintBackdrop('#17243a');
      for (let y = minY + 70; y < maxY - 40; y += 95) {
        ctx.fillStyle = 'rgba(72, 137, 205, 0.12)';
        ctx.fillRect(minX + 55, y, maxX - minX - 110, 28);
        ctx.fillStyle = 'rgba(46, 204, 113, 0.22)';
        const progress = 0.3 + ((y - minY) % 260) / 400;
        ctx.fillRect(minX + 62, y + 7, (maxX - minX - 124) * progress, 14);
      }
    } else if (this.theme === 'recycle') {
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
      paintBackdrop('#180a24');
      const pulse = 0.35 + Math.sin(this.stageTime * 3) * 0.08;
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
      paintBackdrop('#140005');

      ctx.strokeStyle = 'rgba(255, 0, 50, 0.25)';
      ctx.lineWidth = 1;
      strokeGridPath(ctx, minX, maxX, minY, maxY, 50);

      ctx.fillStyle = '#ff1133';
      ctx.font = "bold 14px monospace";
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = this.crowdedRender ? 0 : 12;
      ctx.fillText(">>> CRITICAL THREAT: THE_DARK_LORD.EXE HAS CORRUPTED THE CORE <<<", minX + 60, minY + 80);
      ctx.fillText(">>> SYSTEM INTEGRITY: 0% | VIRABOT POWER LEVEL: MAXIMUM <<<", minX + 60, minY + 110);
      ctx.fillText(">>> DEFEAT THE DARK LORD TO OPEN THE OUTERNET PATH <<<", minX + 60, minY + 140);
    } else if (this.theme === 'command_realm') {
      paintBackdrop('#241306');
      ctx.strokeStyle = 'rgba(255, 157, 35, 0.26)';
      ctx.lineWidth = 2;
      strokeGridPath(ctx, minX, maxX, minY, maxY, 80);
      ctx.fillStyle = 'rgba(255, 192, 66, 0.18)';
      for (let i = 0; i < 12; i++) {
        const x = minX + 90 + i * 180;
        const y = minY + 110 + (i % 3) * 145;
        ctx.fillRect(x, y, 38, 38);
        ctx.strokeRect(x + 7, y + 7, 24, 24);
      }
      ctx.fillStyle = '#ffb13b';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('ARCHIVE://KING_ORANGE — CORRUPTED REPLAY', minX + 60, minY + 70);
      ctx.fillText('REPLAY // NOT THE REAL KING', minX + 60, minY + 100);
    } else if (this.theme === 'browser_glitch') {
      paintBackdrop('#10192d');
      ctx.fillStyle = '#202c47';
      ctx.fillRect(minX, minY + 34, maxX - minX, 58);
      for (let i = 0; i < 8; i++) {
        const x = minX + 25 + i * 280;
        ctx.fillStyle = i % 2 ? '#2d3a58' : '#334767';
        ctx.fillRect(x, minY + 48, 245, 34);
        ctx.fillStyle = i % 3 === 0 ? '#ff5f56' : '#6ee7ff';
        ctx.fillRect(x + 12, minY + 62, 8, 8);
      }
      ctx.strokeStyle = 'rgba(83, 212, 255, 0.2)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 10; i++) {
        const y = minY + 130 + i * 55;
        const skew = (i % 2 ? 1 : -1) * 80;
        ctx.beginPath();
        ctx.moveTo(minX + 40, y);
        ctx.lineTo(maxX - 40, y + skew);
        ctx.stroke();
      }
    } else if (this.theme === 'cloud_cache') {
      paintBackdrop('#102942');
      ctx.fillStyle = 'rgba(150, 220, 255, 0.1)';
      ctx.strokeStyle = 'rgba(133, 216, 255, 0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const x = minX + 70 + i * 190;
        const y = minY + 90 + (i % 4) * 130;
        ctx.beginPath();
        ctx.ellipse(x, y, 68, 25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.setLineDash([10, 14]);
      for (let y = minY + 145; y < maxY; y += 130) {
        ctx.beginPath(); ctx.moveTo(minX + 40, y); ctx.lineTo(maxX - 40, y); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = '#b9e9ff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('CLOUD_SYNC: CONFLICTS DETECTED', minX + 60, minY + 55);
    } else if (this.theme === 'root_gateway') {
      paintBackdrop('#020d08');
      ctx.strokeStyle = 'rgba(55, 255, 128, 0.19)';
      ctx.lineWidth = 1;
      strokeGridPath(ctx, minX, maxX, minY, maxY, 64);
      ctx.fillStyle = 'rgba(52, 255, 123, 0.32)';
      ctx.font = '13px monospace';
      const commands = ['sudo unlock --root', 'AUTH FAILED', 'retrying…', 'port 31337 open'];
      for (let i = 0; i < 12; i++) {
        ctx.fillText(commands[i % commands.length], minX + 55 + (i % 3) * 720, minY + 65 + Math.floor(i / 3) * 120);
      }
    } else if (this.theme === 'zero_day') {
      paintBackdrop('#070a12');
      ctx.fillStyle = 'rgba(102, 232, 255, 0.08)';
      for (let y = minY; y < maxY; y += 34) {
        ctx.fillRect(minX, y, maxX - minX, 2);
      }
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.38)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      for (let i = 0; i < 6; i++) {
        const width = 170 + (i % 3) * 70;
        const height = 95 + (i % 2) * 45;
        const x = minX + 90 + i * 350;
        const y = minY + 90 + (i % 3) * 150;
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = '#d8fbff';
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.fillRect(x + width - 4, y + height - 4, 8, 8);
      }
      ctx.setLineDash([]);
      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('ROOT ACCESS GRANTED TO: H4C3R', minX + 60, minY + 58);
      ctx.fillText('FREE_TRANSFORM.sys ACTIVE', minX + 60, minY + 84);
    } else if (this.theme === 'terminal') {
      paintBackdrop('#051108');
      ctx.strokeStyle = 'rgba(50, 255, 100, 0.2)';
      ctx.lineWidth = 1;
      strokeGridPath(ctx, minX, maxX, minY, maxY, 50);
      ctx.fillStyle = '#33ff77';
      ctx.font = "14px monospace";
      ctx.fillText("root@desktop:~$ ./firewall_purge --force", minX + 60, minY + 80);
    } else {
      paintBackdrop('#262c3e');

      ctx.strokeStyle = 'rgba(55, 62, 85, 0.6)';
      ctx.lineWidth = 1;
      strokeGridPath(ctx, minX, maxX, minY, maxY, 60);
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    this.drawEnvironmentMotifs(ctx, 0);
    this.drawCampaignSignal(ctx, minX, minY);
    this.drawEnvironmentMotifs(ctx, 1);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(minX, groundY);
    ctx.lineTo(maxX, groundY);
    ctx.stroke();

    ctx.strokeStyle = '#ff3344';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(minX, minY); ctx.lineTo(minX, groundY);
    ctx.moveTo(maxX, minY); ctx.lineTo(maxX, groundY);
    ctx.stroke();

    ctx.restore();
  }

  drawEnvironmentMotifs(ctx, layer) {
    const decorations = this.environmentDecorations || [];
    const driftRange = this.bounds.maxX - this.bounds.minX + 120;
    const driftStart = this.bounds.minX - 60;

    ctx.save();
    ctx.globalAlpha = layer === 0 ? 0.1 : 0.18;
    ctx.fillStyle = decorations[0]?.color || ENVIRONMENT_COLORS.desktop;
    ctx.strokeStyle = decorations[0]?.color || ENVIRONMENT_COLORS.desktop;
    ctx.lineWidth = layer === 0 ? 1 : 1.5;
    ctx.beginPath();

    for (const motif of decorations) {
      if (motif.layer !== layer) continue;
      const drift = this.stageTime * motif.speed * (layer === 0 ? 16 : 28);
      const wrappedX = driftStart + (((motif.x - driftStart + drift) % driftRange) + driftRange) % driftRange;
      const y = motif.y + Math.sin(this.stageTime * motif.speed * 4 + motif.phase) * (layer === 0 ? 5 : 9);

      if (motif.shape === 0) {
        ctx.fillRect(wrappedX, y, motif.size, motif.size);
      } else if (motif.shape === 1) {
        ctx.moveTo(wrappedX - motif.size, y);
        ctx.lineTo(wrappedX, y - motif.size);
        ctx.lineTo(wrappedX + motif.size, y);
      } else {
        ctx.moveTo(wrappedX - motif.size, y);
        ctx.lineTo(wrappedX + motif.size, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  drawCampaignSignal(ctx, minX, minY) {
    const beat = this.campaignBeat;
    if (!beat) return;

    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(beat.act, this.bounds.maxX - 48, minY + 48);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fillText(`MISSION // ${beat.mission}`, this.bounds.maxX - 48, minY + 69);

    if (beat.bossLabel) {
      ctx.fillStyle = this.currentStage === 15 ? '#67e8f9' : '#ffc857';
      ctx.fillText(`TARGET // ${beat.bossLabel}`, this.bounds.maxX - 48, minY + 90);
    }

    if (this.currentStage === 3 || this.currentStage === 8 || this.currentStage === 14) {
      ctx.fillStyle = '#67e8f9';
      ctx.fillText(`TRACE // ${beat.clue}`, this.bounds.maxX - 48, minY + 111);
    }
    ctx.restore();
  }

  drawDesktopIcons(ctx) {
    for (const icon of this.desktopIcons) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.fillRect(icon.x - 30, icon.y - 40, 60, 50);
      ctx.strokeRect(icon.x - 30, icon.y - 40, 60, 50);

      ctx.font = "24px sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon.icon, icon.x, icon.y - 15);

      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 10px 'Nunito', sans-serif";
      ctx.fillText(icon.label, icon.x, icon.y + 20);
      ctx.restore();
    }
  }

  drawErrorPopups(ctx) {
    for (const pop of this.errorPopups) {
      ctx.save();
      ctx.fillStyle = '#ece9d8';
      ctx.strokeStyle = '#0055ea';
      ctx.lineWidth = 2;
      ctx.fillRect(pop.x - pop.width / 2, pop.y - pop.height / 2, pop.width, pop.height);
      ctx.strokeRect(pop.x - pop.width / 2, pop.y - pop.height / 2, pop.width, pop.height);

      ctx.fillStyle = '#0055ea';
      ctx.fillRect(pop.x - pop.width / 2, pop.y - pop.height / 2, pop.width, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText(pop.title, pop.x - pop.width / 2 + 6, pop.y - pop.height / 2 + 13);

      ctx.fillStyle = '#000000';
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(pop.msg, pop.x, pop.y + 12);
      ctx.restore();
    }
  }

  drawDoors(ctx, groundY) {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.fillRect(this.entranceDoor.x - 30, groundY - this.entranceDoor.height, 60, this.entranceDoor.height);
    ctx.strokeRect(this.entranceDoor.x - 30, groundY - this.entranceDoor.height, 60, this.entranceDoor.height);
    ctx.fillStyle = '#38bdf8';
    ctx.font = "900 11px Impact, Haettenschweiler, 'Arial Narrow Bold', 'Arial Black', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText("START", this.entranceDoor.x, groundY - this.entranceDoor.height - 8);
    ctx.restore();

    ctx.save();
    const isOpen = this.exitDoor.isOpen;
    ctx.fillStyle = isOpen ? '#022c22' : '#3f1118';
    ctx.strokeStyle = isOpen ? '#10b981' : '#ef4444';
    ctx.lineWidth = 4;
    ctx.fillRect(this.exitDoor.x - 32, groundY - this.exitDoor.height, 64, this.exitDoor.height);
    ctx.strokeRect(this.exitDoor.x - 32, groundY - this.exitDoor.height, 64, this.exitDoor.height);

    if (isOpen) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(this.exitDoor.x - 24, groundY - this.exitDoor.height + 8, 48, this.exitDoor.height - 16);

      const time = this.stageTime * 6;
      ctx.fillStyle = '#6ee7b7';
      for (let i = 0; i < 4; i++) {
        const vy = (groundY - this.exitDoor.height + 14) + ((time * 25 + i * 15) % (this.exitDoor.height - 28));
        ctx.beginPath();
        ctx.arc(this.exitDoor.x + Math.sin(time + i) * 12, vy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      const bounce = Math.sin(this.stageTime * 8) * 8;
      ctx.fillStyle = '#ffea00';
      ctx.font = "900 13px Impact, Haettenschweiler, 'Arial Narrow Bold', 'Arial Black', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText("⬇ ENTER EXIT ⬇", this.exitDoor.x, groundY - this.exitDoor.height - 16 + bounce);
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.font = "900 11px Impact, Haettenschweiler, 'Arial Narrow Bold', 'Arial Black', sans-serif";
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

      if (p.appType === 'dark_core') {
        ctx.fillStyle = '#180006';
        ctx.strokeStyle = '#ff0033';
        ctx.shadowColor = '#ff0033';
        ctx.shadowBlur = this.crowdedRender ? 0 : 12;
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

      ctx.fillStyle = p.appType === 'dark_core' ? '#3b000d' : (p.appType === 'bsod' ? '#003399' : '#334155');
      ctx.fillRect(p.x - halfW, topY, p.width, 9);

      const ctrlY = topY + 4.5;
      ctx.fillStyle = '#ff5f56';
      ctx.beginPath(); ctx.arc(p.x + halfW - 20, ctrlY, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffbd2e';
      ctx.beginPath(); ctx.arc(p.x + halfW - 13, ctrlY, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#27c93f';
      ctx.beginPath(); ctx.arc(p.x + halfW - 6, ctrlY, 2.4, 0, Math.PI * 2); ctx.fill();

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
        ctx.fillStyle = '#ff2244';
        ctx.shadowColor = '#ff2244';
        ctx.shadowBlur = 14;
        ctx.fillRect(laser.x, laser.y - laser.height / 2, laser.width, laser.height);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(laser.x, laser.y - 2, laser.width, 4);
      } else {
        ctx.strokeStyle = 'rgba(255, 68, 68, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(laser.x, laser.y);
        ctx.lineTo(laser.x + laser.width, laser.y);
        ctx.stroke();
      }

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
    ctx.fillStyle = '#0b0d13';
    ctx.fillRect(minX, groundY, maxX - minX, 1000);

    ctx.fillStyle = '#11131c';
    ctx.strokeStyle = '#2d3147';
    ctx.lineWidth = 2;
    ctx.fillRect(this.bounds.minX, groundY, this.bounds.maxX - this.bounds.minX, 42);
    ctx.strokeRect(this.bounds.minX, groundY, this.bounds.maxX - this.bounds.minX, 42);

    ctx.fillStyle = '#0078d7';
    ctx.fillRect(this.bounds.minX + 10, groundY + 6, 80, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 12px 'Nunito', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText("🪟 START", this.bounds.minX + 50, groundY + 25);

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

    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 12px monospace";
    ctx.textAlign = 'right';
    const elapsedSeconds = Math.floor(this.stageTime);
    const runMinutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const runSeconds = String(elapsedSeconds % 60).padStart(2, '0');
    const clearedThrough = this.currentStage - (this.isObjectiveComplete ? 0 : 1);
    const keyPieces = clearedThrough < 5 ? 0 : (clearedThrough < 10 ? 1 : (clearedThrough < 11 ? 2 : 3));
    ctx.fillText(`KEY ${keyPieces}/3 | RUN ${runMinutes}:${runSeconds}`, this.bounds.maxX - 20, groundY + 25);

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
