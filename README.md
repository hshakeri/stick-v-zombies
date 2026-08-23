# ⚔️ Orange Stickman vs. Zombies: The Second Coming

[![Play on GitHub Pages](https://img.shields.io/badge/Play_Online-GitHub_Pages-brightgreen?style=for-the-badge&logo=github)](https://hshakeri.github.io/stick-v-zombies/)

A lightweight 2D action arena game inspired by Alan Becker's *Animator vs. Animation* and *Animation vs. Minecraft*. Play as **The Second Coming** (the orange stick figure), chaining martial arts, pencil attacks, sketch tools, and ally assists across ten desktop-themed stages.

> **Unofficial fan project:** This game is a non-commercial tribute made for fun and learning. It is not affiliated with or endorsed by Alan Becker, Mojang, or Microsoft. All referenced characters and properties belong to their respective owners.

---

## 🎮 Play Online

Play directly in your browser without installing anything:
👉 **[https://hshakeri.github.io/stick-v-zombies/](https://hshakeri.github.io/stick-v-zombies/)**

Or run locally via any HTTP server:
```bash
python3 -m http.server 8088
# Open http://localhost:8088 in your browser
```

---

## ⌨️ Controls (Keyboard & Touch Supported!)

### Movement
| Action | Key / Input | Notes |
| :--- | :--- | :--- |
| **Move Left / Right** | `←` / `→` or `A` / `D` | Instant direction turning & sprint momentum |
| **Jump / Double Jump / Wall Jump** | `↑` or `Space` | Double jump in air, wall kick off arena sides |
| **Crouch / Drop Down** | `↓` or `S` | Drop through sketch platforms or duck |
| **Dodge Roll** | `Shift` or `L` | Full invulnerability frames (i-frames) with ghost trails |

### Combat & Skills (Left Side of Keyboard)
| Action | Key / Input | Notes |
| :--- | :--- | :--- |
| **Martial Arts Combo / Air Chase** | `Q`, `J`, or left click | 5-hit chain with an uppercut launcher and airborne follow-up |
| **Giant Pencil Slash** | `W`, `K`, or right click | Sweeping pencil slash; use `↓` + `W` for an EX javelin |
| **Rising Dragon** | `↑` + `Q` | Launches nearby enemies into an aerial combo |
| **Dive Kick / Ground Slam** | In mid-air: `↓` + `Q` / `W` | Plummets down and explodes into a shockwave on landing |
| **Grab & Throw** | `F`, `G`, or `Q` + `W` | Grabs a nearby zombie and turns it into a crowd-clearing projectile |
| **Sketch Block / Anvil Drop** | `E`; `↓` + `E` or airborne `E` | Places a ground block, or drops an upgraded anvil from above |
| **Roll Follow-up** | `Shift` / `L`, then `Q` or `W` | Converts a dodge into a low slide sweep |
| **⚡ AWAKENING GOD MODE** | `R` (when meter is 100%) | Enter Awakening, then hold `W` or `Q` for the beam |
| **Summon Stick Allies** | `1`, `2`, `3`, `4` | Red (Meteor), Blue (Heal/Freeze), Yellow (Turret), Green (Stun) |
| **Summon Animator Cursor** | `5` | The cursor deletes a regular zombie or heavily damages a boss |
| **Open Upgrades Shop** | `B` | Spend collected Ink to upgrade stats and unlock allies |
| **Pause Game** | `Esc` or `P` | Pause menu |

---

## 🖥️ Desktop Stages & Boss Progression

Ten computer-desktop stages with obstacles, platforms, a clear **Start Door**, and an **Exit Door** guide:
- **Stage 1: Main Desktop**: File explorer windows, Notepad platforms, desktop shortcut icons (`Recycle Bin`, `Minecraft.exe`).
- **Stage 2: Adobe Animate Workspace**: Moving Timeline Scrubber platforms, layer tracks, and drawing laser pointer hazards.
- **Stage 3: Downloads & Malware Zone**: Vertical download elevators, corrupted files, and Error 404 popup dialog hazards.
- **Stage 4: Firewall Security Grid**: Timed security laser barriers, packet scanners, and rapid runner swarms.
- **Stage 5: Blue Screen of Death (BSOD)**: The Titan Undead boss fight on an ominous glowing blue error screen.
- **Stage 6: Corrupted Recycle Bin**: Discarded script windows and hazardous shredder platforms.
- **Stage 7: Minecraft Nether Core**: Obsidian and netherrack platforms with lava hazards.
- **Stage 8: Terminal Cyber Matrix**: Hacker command-line terminal grids and cyber laser traps.
- **Stage 9: ViraBot Infestation Nexus**: Virus incubators and malware conduits crawling with minion spiders.
- **Stage 10: The Dark Core (TDL's Domain)**: A multi-phase boss encounter with **The Dark Lord (TDL)**, followed by a real victory screen rather than an endless stage loop.

---

## 🧟 Stick Zombie Types

1. **Shambler Walkers**: Decaying green stick figures that swarm in packs and lunge to bite.
2. **Agile Runners**: Four-legged fast sprinters that leap through the air to ambush you.
3. **Toxic Spitters**: Ranged zombies that maintain their distance and launch hazardous acid puddles.
4. **Heavy Brutes**: Massive armored tank zombies that smash the ground causing shockwaves.
5. **The Titan Undead (Boss)**: A multi-phase giant boss with enrage phases, seismic stomps, and minion swarms.

---

## 🛒 Animator Workshop Upgrades

Defeated zombies drop **Ink** (✒️) which can be spent between waves in the Upgrade Shop:
- **Max Health**: Boost HP capacity and heal to full.
- **Martial Power**: Increase damage for all punches, kicks, and weapon attacks.
- **Agility & Speed**: Boost movement speed and jump height.
- **Awakening Affinity**: Charge your God Mode meter faster.
- **Ink Vampirism**: Restore HP with every strike landed.
- **Heavy Iron Anvil**: Increase anvil drop damage and shockwave radius.
- **Unlock Allies**: Recruit Red, Blue, Yellow, and Green to fight by your side!

---

## 🎨 Visual & Audio Features
- **100% Procedural Web Audio Synthesizer**: Crunchy punch impacts, whooshes, monster snarls, laser beams, and dynamic battle music.
- **Responsive Canvas Framing**: Resolution-independent camera coordinates, capped pixel density, safe arena bounds, and compact portrait/landscape HUD layouts.
- **Readable Stick Animation**: Procedural skeleton poses, silhouettes, anticipation, afterimages, and motion lines.
- **Combat Juice**: Hitstop impact frames, dynamic camera tracking and screen shake, comic star sparks, and stylized floating damage popups.
- **Lightweight Rendering**: Canvas 2D vectors and Web Audio only, with bounded particles and throttled continuous effects.

---

## ✅ Development Checks

The repository includes zero-dependency regression tests for canvas state safety, one-shot impacts, safe spawning, particle and pixel budgets, responsive camera framing, replay resets, and the final victory path.

```bash
npm test
```
