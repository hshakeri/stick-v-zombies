// Input handling engine with keyboard, arrow keys, left-side combat keys (Q, W, E, R, Shift), touch, and gamepad

class InputManager {
  constructor() {
    this.keys = {};
    this.keysPressed = {}; // True only for single frame on keydown
    this.mouse = {
      x: 0,
      y: 0,
      worldX: 0,
      worldY: 0,
      leftDown: false,
      rightDown: false,
      leftPressed: false,
      rightPressed: false
    };

    // Touch Virtual Buttons state
    this.touch = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      attack: false,
      attackPressed: false,
      weapon: false,
      weaponPressed: false,
      roll: false,
      rollPressed: false,
      block: false,
      blockPressed: false,
      super: false,
      superPressed: false
    };

    // Virtual action states
    this.actions = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      attack: false,
      attackPressed: false,
      weapon: false,
      weaponPressed: false,
      roll: false,
      rollPressed: false,
      block: false,
      blockPressed: false,
      super: false,
      superPressed: false,
      ally1: false,
      ally2: false,
      ally3: false,
      ally4: false,
      shop: false,
      pause: false
    };

    this.canvas = null;
    this.camera = null;
  }

  init(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;

    // Keyboard Listeners
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (!this.keys[code]) {
        this.keysPressed[code] = true;
      }
      this.keys[code] = true;

      // Prevent scrolling with Space/Arrows
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse Listeners
    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
      this.updateMouseWorld();
    });

    window.addEventListener('mousedown', (e) => {
      // Ensure game window always keeps keyboard focus
      window.focus();
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
        document.activeElement.blur();
      }

      if (e.target !== this.canvas && !this.canvas.contains(e.target)) return;
      if (e.button === 0) { // Left click
        this.mouse.leftDown = true;
        this.mouse.leftPressed = true;
      } else if (e.button === 2) { // Right click
        this.mouse.rightDown = true;
        this.mouse.rightPressed = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.leftDown = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });

    window.addEventListener('contextmenu', (e) => {
      if (e.target === this.canvas || this.canvas.contains(e.target)) {
        e.preventDefault();
      }
    });

    // Touch and HUD Buttons
    this.initTouchControls();
  }

  updateMouseWorld() {
    if (this.camera) {
      const worldPos = this.camera.screenToWorld(this.mouse.x, this.mouse.y);
      this.mouse.worldX = worldPos.x;
      this.mouse.worldY = worldPos.y;
    }
  }

  initTouchControls() {
    const bindBtn = (id, actionName) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const start = (e) => {
        e.preventDefault();
        btn.blur();
        window.focus();
        this.touch[actionName] = true;
        this.touch[actionName + 'Pressed'] = true;
      };
      const end = (e) => {
        e.preventDefault();
        btn.blur();
        this.touch[actionName] = false;
      };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
    };

    // Mobile virtual buttons
    bindBtn('vbtn-left', 'left');
    bindBtn('vbtn-right', 'right');
    bindBtn('vbtn-up', 'up');
    bindBtn('vbtn-down', 'down');
    bindBtn('vbtn-jump', 'jump');
    bindBtn('vbtn-attack', 'attack');
    bindBtn('vbtn-weapon', 'weapon');
    bindBtn('vbtn-super', 'super');
    bindBtn('vbtn-roll', 'roll');
    bindBtn('vbtn-block', 'block');

    // Bottom HUD skill slot buttons (clickable on desktop and touch)
    bindBtn('skill-punch', 'attack');
    bindBtn('skill-pencil', 'weapon');
    bindBtn('skill-grab', 'grab');
    bindBtn('skill-roll', 'roll');
    bindBtn('skill-block', 'block');
    bindBtn('skill-super', 'super');
  }

  update() {
    this.updateMouseWorld();

    // Movement: Arrow Keys or A/D
    this.actions.left = !!(this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touch.left);
    this.actions.right = !!(this.keys['ArrowRight'] || this.keys['KeyD'] || this.touch.right);
    this.actions.up = !!(this.keys['ArrowUp'] || this.touch.up);
    this.actions.down = !!(this.keys['ArrowDown'] || this.keys['KeyS'] || this.touch.down);

    // Jump: Space or ArrowUp or touch
    this.actions.jump = !!(this.keys['Space'] || this.keys['ArrowUp'] || this.touch.jump);
    this.actions.jumpPressed = !!(this.keysPressed['Space'] || this.keysPressed['ArrowUp'] || this.touch.jumpPressed);

    // Martial Arts Attack (Q, J, Left Mouse Click, or Z)
    this.actions.attack = !!(this.keys['KeyQ'] || this.keys['KeyJ'] || this.keys['KeyZ'] || this.mouse.leftDown || this.touch.attack);
    this.actions.attackPressed = !!(this.keysPressed['KeyQ'] || this.keysPressed['KeyJ'] || this.keysPressed['KeyZ'] || this.mouse.leftPressed || this.touch.attackPressed);

    // Giant Pencil / Weapon Attack (W, K, Right Mouse Click, or X)
    this.actions.weapon = !!(this.keys['KeyW'] || this.keys['KeyK'] || this.keys['KeyX'] || this.mouse.rightDown || this.touch.weapon);
    this.actions.weaponPressed = !!(this.keysPressed['KeyW'] || this.keysPressed['KeyK'] || this.keysPressed['KeyX'] || this.mouse.rightPressed || this.touch.weaponPressed);

    // Dodge Roll (Shift, L, C)
    this.actions.roll = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyL'] || this.keys['KeyC'] || this.touch.roll);
    this.actions.rollPressed = !!(this.keysPressed['ShiftLeft'] || this.keysPressed['ShiftRight'] || this.keysPressed['KeyL'] || this.keysPressed['KeyC'] || this.touch.rollPressed);

    // Block / Anvil Spawn (E, V)
    this.actions.block = !!(this.keys['KeyE'] || this.keys['KeyV'] || this.touch.block);
    this.actions.blockPressed = !!(this.keysPressed['KeyE'] || this.keysPressed['KeyV'] || this.touch.blockPressed);

    // Grab & Throw (F, G)
    this.actions.grab = !!(this.keys['KeyF'] || this.keys['KeyG']);
    this.actions.grabPressed = !!(this.keysPressed['KeyF'] || this.keysPressed['KeyG']);

    // Awakening Super (R)
    this.actions.super = !!(this.keys['KeyR'] || this.touch.super);
    this.actions.superPressed = !!(this.keysPressed['KeyR'] || this.touch.superPressed);

    // Allies (1, 2, 3, 4, 5)
    this.actions.ally1 = !!this.keysPressed['Digit1'];
    this.actions.ally2 = !!this.keysPressed['Digit2'];
    this.actions.ally3 = !!this.keysPressed['Digit3'];
    this.actions.ally4 = !!this.keysPressed['Digit4'];
    this.actions.ally5 = !!this.keysPressed['Digit5'];

    // UI triggers
    this.actions.shop = !!this.keysPressed['KeyB'];
    this.actions.pause = !!(this.keysPressed['Escape'] || this.keysPressed['KeyP']);

    // Gamepad support polling
    this.pollGamepad();
  }

  pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (!gamepads || !gamepads[0]) return;
    const gp = gamepads[0];

    // Left Stick / D-Pad
    if (gp.axes[0] < -0.3 || (gp.buttons[14] && gp.buttons[14].pressed)) this.actions.left = true;
    if (gp.axes[0] > 0.3 || (gp.buttons[15] && gp.buttons[15].pressed)) this.actions.right = true;
    if (gp.axes[1] < -0.3 || (gp.buttons[12] && gp.buttons[12].pressed)) this.actions.up = true;
    if (gp.axes[1] > 0.3 || (gp.buttons[13] && gp.buttons[13].pressed)) this.actions.down = true;

    // Face buttons: A = Jump, X = Attack (Q), Y = Weapon (W), B = Roll
    if (gp.buttons[0] && gp.buttons[0].pressed) this.actions.jumpPressed = true;
    if (gp.buttons[2] && gp.buttons[2].pressed) this.actions.attackPressed = true;
    if (gp.buttons[3] && gp.buttons[3].pressed) this.actions.weaponPressed = true;
    if (gp.buttons[1] && gp.buttons[1].pressed) this.actions.rollPressed = true;
    if (gp.buttons[5] && gp.buttons[5].pressed) this.actions.blockPressed = true; // RB
    if (gp.buttons[7] && gp.buttons[7].pressed) this.actions.superPressed = true; // RT
  }

  // Clear single-frame "Pressed" events at end of update cycle
  endFrame() {
    this.keysPressed = {};
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
    this.touch.jumpPressed = false;
    this.touch.attackPressed = false;
    this.touch.weaponPressed = false;
    this.touch.rollPressed = false;
    this.touch.blockPressed = false;
    this.touch.superPressed = false;
    this.actions.jumpPressed = false;
    this.actions.attackPressed = false;
    this.actions.weaponPressed = false;
    this.actions.rollPressed = false;
    this.actions.blockPressed = false;
    this.actions.superPressed = false;
    this.actions.grabPressed = false;
    this.actions.ally1 = false;
    this.actions.ally2 = false;
    this.actions.ally3 = false;
    this.actions.ally4 = false;
    this.actions.ally5 = false;
    this.actions.shop = false;
    this.actions.pause = false;
  }
}

export const input = new InputManager();
