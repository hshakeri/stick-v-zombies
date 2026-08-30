class InputManager {
  constructor() {
	this.keys = {};
	this.keysPressed = {};
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
	  grab: false,
	  grabPressed: false,
	  hook: false,
	  hookPressed: false,
	  super: false,
	  superPressed: false
	};
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
	  grab: false,
	  grabPressed: false,
	  hook: false,
	  hookPressed: false,
	  super: false,
	  superPressed: false,
	  ally1: false,
	  ally2: false,
	  ally3: false,
	  ally4: false,
	  ally5: false,
	  ally6: false,
	  shop: false,
	  pause: false
	};
	this.canvas = null;
	this.camera = null;
	this.gamepadButtonStates = [];
  }
  init(canvas, camera) {
	this.canvas = canvas;
	this.camera = camera;
	window.addEventListener('keydown', (e) => {
	  const code = e.code;
	  if (!this.keys[code]) {
		this.keysPressed[code] = true;
	  }
	  this.keys[code] = true;
	  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
		e.preventDefault();
	  }
	});
	window.addEventListener('keyup', (e) => {
	  this.keys[e.code] = false;
	});
	window.addEventListener('blur', () => {
	  this.resetHeldInputs();
	});
	window.addEventListener('mousemove', (e) => {
	  const rect = this.canvas.getBoundingClientRect();
	  this.mouse.x = e.clientX - rect.left;
	  this.mouse.y = e.clientY - rect.top;
	  this.updateMouseWorld();
	});
	window.addEventListener('mousedown', (e) => {
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
	  btn.addEventListener('touchcancel', end, { passive: false });
	  btn.addEventListener('mousedown', start);
	  btn.addEventListener('mouseup', end);
	  btn.addEventListener('mouseleave', end);
	};
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
	bindBtn('vbtn-grab', 'grab');
	bindBtn('vbtn-hook', 'hook');
	bindBtn('skill-punch', 'attack');
	bindBtn('skill-pencil', 'weapon');
	bindBtn('skill-grab', 'grab');
	bindBtn('skill-hook', 'hook');
	bindBtn('skill-roll', 'roll');
	bindBtn('skill-block', 'block');
	bindBtn('skill-super', 'super');
  }
  update() {
	this.updateMouseWorld();
	this.actions.left = !!(this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touch.left);
	this.actions.right = !!(this.keys['ArrowRight'] || this.keys['KeyD'] || this.touch.right);
	this.actions.up = !!(this.keys['ArrowUp'] || this.touch.up);
	this.actions.down = !!(this.keys['ArrowDown'] || this.keys['KeyS'] || this.touch.down);
	this.actions.jump = !!(this.keys['Space'] || this.keys['ArrowUp'] || this.touch.jump);
	this.actions.jumpPressed = !!(this.keysPressed['Space'] || this.keysPressed['ArrowUp'] || this.touch.jumpPressed);
	this.actions.attack = !!(this.keys['KeyQ'] || this.keys['KeyJ'] || this.keys['KeyZ'] || this.mouse.leftDown || this.touch.attack);
	this.actions.attackPressed = !!(this.keysPressed['KeyQ'] || this.keysPressed['KeyJ'] || this.keysPressed['KeyZ'] || this.mouse.leftPressed || this.touch.attackPressed);
	this.actions.weapon = !!(this.keys['KeyW'] || this.keys['KeyK'] || this.keys['KeyX'] || this.mouse.rightDown || this.touch.weapon);
	this.actions.weaponPressed = !!(this.keysPressed['KeyW'] || this.keysPressed['KeyK'] || this.keysPressed['KeyX'] || this.mouse.rightPressed || this.touch.weaponPressed);
	this.actions.roll = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyL'] || this.keys['KeyC'] || this.touch.roll);
	this.actions.rollPressed = !!(this.keysPressed['ShiftLeft'] || this.keysPressed['ShiftRight'] || this.keysPressed['KeyL'] || this.keysPressed['KeyC'] || this.touch.rollPressed);
	this.actions.block = !!(this.keys['KeyE'] || this.keys['KeyV'] || this.touch.block);
	this.actions.blockPressed = !!(this.keysPressed['KeyE'] || this.keysPressed['KeyV'] || this.touch.blockPressed);
	this.actions.grab = !!(this.keys['KeyF'] || this.keys['KeyG'] || this.touch.grab);
	this.actions.grabPressed = !!(this.keysPressed['KeyF'] || this.keysPressed['KeyG'] || this.touch.grabPressed);
	this.actions.hook = !!(this.keys['KeyH'] || this.touch.hook);
	this.actions.hookPressed = !!(this.keysPressed['KeyH'] || this.touch.hookPressed);
	this.actions.super = !!(this.keys['KeyR'] || this.touch.super);
	this.actions.superPressed = !!(this.keysPressed['KeyR'] || this.touch.superPressed);
	this.actions.ally1 = !!this.keysPressed['Digit1'];
	this.actions.ally2 = !!this.keysPressed['Digit2'];
	this.actions.ally3 = !!this.keysPressed['Digit3'];
	this.actions.ally4 = !!this.keysPressed['Digit4'];
	this.actions.ally5 = !!this.keysPressed['Digit5'];
	this.actions.ally6=!!(this.keysPressed.Digit6||this.keysPressed.Numpad6);
	this.actions.shop = !!this.keysPressed['KeyB'];
	this.actions.pause = !!(this.keysPressed['Escape'] || this.keysPressed['KeyP']);
	this.pollGamepad();
  }
  pollGamepad() {
	const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
	if (!gamepads || !gamepads[0]) {
	  this.gamepadButtonStates = [];
	  return;
	}
	const gp = gamepads[0];
	const isPressed = (index) => !!(gp.buttons[index] && gp.buttons[index].pressed);
	const wasPressed = (index) => !!this.gamepadButtonStates[index];
	if (gp.axes[0] < -0.3 || (gp.buttons[14] && gp.buttons[14].pressed)) this.actions.left = true;
	if (gp.axes[0] > 0.3 || (gp.buttons[15] && gp.buttons[15].pressed)) this.actions.right = true;
	if (gp.axes[1] < -0.3 || (gp.buttons[12] && gp.buttons[12].pressed)) this.actions.up = true;
	if (gp.axes[1] > 0.3 || (gp.buttons[13] && gp.buttons[13].pressed)) this.actions.down = true;
	const heldBindings = [
	  [0, 'jump'],
	  [2, 'attack'],
	  [3, 'weapon'],
	  [1, 'roll'],
	  [5, 'block'],
	  [4, 'grab'],
	  [6, 'hook'],
	  [7, 'super']
	];
	for (const [index, action] of heldBindings) {
	  const pressed = isPressed(index);
	  if (pressed) this.actions[action] = true;
	  if (pressed && !wasPressed(index)) this.actions[`${action}Pressed`] = true;
	}
	this.gamepadButtonStates = gp.buttons.map(button => !!button.pressed);
  }
  resetHeldInputs() {
	this.keys = {};
	this.keysPressed = {};
	this.mouse.leftDown = false;
	this.mouse.rightDown = false;
	this.mouse.leftPressed = false;
	this.mouse.rightPressed = false;
	for (const key of Object.keys(this.touch)) this.touch[key] = false;
	this.gamepadButtonStates = [];
  }
  endFrame() {
	this.keysPressed = {};
	this.mouse.leftPressed = false;
	this.mouse.rightPressed = false;
	this.touch.jumpPressed = false;
	this.touch.attackPressed = false;
	this.touch.weaponPressed = false;
	this.touch.rollPressed = false;
	this.touch.blockPressed = false;
	this.touch.grabPressed = false;
	this.touch.hookPressed = false;
	this.touch.superPressed = false;
	this.actions.jumpPressed = false;
	this.actions.attackPressed = false;
	this.actions.weaponPressed = false;
	this.actions.rollPressed = false;
	this.actions.blockPressed = false;
	this.actions.superPressed = false;
	this.actions.grabPressed = false;
	this.actions.hookPressed = false;
	this.actions.ally1 = false;
	this.actions.ally2 = false;
	this.actions.ally3 = false;
	this.actions.ally4 = false;
	this.actions.ally5 = false;
	this.actions.ally6 = false;
	this.actions.shop = false;
	this.actions.pause = false;
  }
}
export const input = new InputManager();
