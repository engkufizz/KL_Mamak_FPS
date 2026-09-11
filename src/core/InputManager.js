/**
 * InputManager - Handles keyboard, mouse inputs, and Pointer Lock API.
 */
export class InputManager {
  constructor(domElement) {
    this.domElement = domElement || document.body;
    this.isLocked = false;
    this.sensitivity = 0.0022;

    this.mouseDelta = { x: 0, y: 0 };
    this.keys = {};
    this.prevKeys = {};

    this.mouseButtons = {
      left: false,
      right: false,
      middle: false
    };
    this.prevMouseButtons = {
      left: false,
      right: false,
      middle: false
    };

    this.wheelDelta = 0;
    this.justPressedKeys = new Set();
    this.justPressedMouse = new Set();
    this.onLockChangeCallbacks = [];

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onPointerlockChange = this._onPointerlockChange.bind(this);
    this._onPointerlockError = this._onPointerlockError.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);

    this.setupListeners();
  }

  setupListeners() {
    document.addEventListener('mousemove', this._onMouseMove, false);
    document.addEventListener('mousedown', this._onMouseDown, false);
    document.addEventListener('mouseup', this._onMouseUp, false);
    document.addEventListener('keydown', this._onKeyDown, false);
    document.addEventListener('keyup', this._onKeyUp, false);
    document.addEventListener('wheel', this._onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this._onPointerlockChange, false);
    document.addEventListener('contextmenu', this._onContextMenu, false);


  }

  requestLock() {
    if (!this.isLocked && this.domElement && typeof this.domElement.requestPointerLock === 'function') {
      try {
        const p = this.domElement.requestPointerLock();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (err) {
        console.warn('PointerLock not supported on this device:', err);
      }
    }
  }

  exitLock() {
    if (this.isLocked && document.exitPointerLock && typeof document.exitPointerLock === 'function') {
      try {
        document.exitPointerLock();
      } catch (err) {}
    }
  }

  onLockChange(callback) {
    this.onLockChangeCallbacks.push(callback);
  }

  _onPointerlockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
    for (const cb of this.onLockChangeCallbacks) {
      cb(this.isLocked);
    }
  }

  _onPointerlockError(e) {
    console.warn('PointerLock Error:', e);
  }

  _onContextMenu(e) {
    e.preventDefault();
  }

  _onMouseMove(e) {
    if (!this.isLocked) return;
    this.mouseDelta.x += e.movementX || 0;
    this.mouseDelta.y += e.movementY || 0;
  }

  _onMouseDown(e) {
    if (e.button === 0) {
      if (!this.mouseButtons.left) this.justPressedMouse.add(0);
      this.mouseButtons.left = true;
    }
    if (e.button === 2) {
      if (!this.mouseButtons.right) this.justPressedMouse.add(2);
      this.mouseButtons.right = true;
    }
    if (e.button === 1) {
      if (!this.mouseButtons.middle) this.justPressedMouse.add(1);
      this.mouseButtons.middle = true;
    }
  }

  _onMouseUp(e) {
    if (e.button === 0) this.mouseButtons.left = false;
    if (e.button === 2) this.mouseButtons.right = false;
    if (e.button === 1) this.mouseButtons.middle = false;
  }

  _onKeyDown(e) {
    if (!this.keys[e.code]) {
      this.justPressedKeys.add(e.code);
    }
    this.keys[e.code] = true;
    if (e.key) {
      if (!this.keys[e.key]) this.justPressedKeys.add(e.key);
      this.keys[e.key] = true;
    }
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
    if (e.key) this.keys[e.key] = false;
  }

  _onWheel(e) {
    this.wheelDelta += Math.sign(e.deltaY);
  }

  // Poll at start of frame
  update() {
    // Reset delta values for next frame accumulation
    const dx = this.mouseDelta.x;
    const dy = this.mouseDelta.y;
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;

    const wd = this.wheelDelta;
    this.wheelDelta = 0;

    return {
      deltaX: dx * this.sensitivity,
      deltaY: dy * this.sensitivity,
      wheel: wd
    };
  }

  // End of frame snapshot for justPressed / justReleased detection
  postUpdate() {
    this.justPressedKeys.clear();
    this.justPressedMouse.clear();
    this.prevKeys = { ...this.keys };
    this.prevMouseButtons = { ...this.mouseButtons };
  }

  isKeyDown(code) {
    return !!this.keys[code];
  }

  isKeyJustPressed(code) {
    return this.justPressedKeys.has(code) || (!!this.keys[code] && !this.prevKeys[code]);
  }

  isMouseDown(btn = 0) {
    if (btn === 0) return this.mouseButtons.left;
    if (btn === 2) return this.mouseButtons.right;
    if (btn === 1) return this.mouseButtons.middle;
    return false;
  }

  isMouseJustPressed(btn = 0) {
    if (this.justPressedMouse.has(btn)) return true;
    if (btn === 0) return this.mouseButtons.left && !this.prevMouseButtons.left;
    if (btn === 2) return this.mouseButtons.right && !this.prevMouseButtons.right;
    if (btn === 1) return this.mouseButtons.middle && !this.prevMouseButtons.middle;
    return false;
  }

  getMovementVector() {
    let forward = 0;
    let right = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) right += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) right -= 1;

    return { forward, right };
  }

  isSprinting() {
    return !!this.keys['ShiftLeft'] || !!this.keys['ShiftRight'];
  }

  isJumping() {
    return !!this.keys['Space'];
  }

  isJumpJustPressed() {
    return this.isKeyJustPressed('Space');
  }

  isReloadJustPressed() {
    return this.isKeyJustPressed('KeyR');
  }

  isWeaponSlotJustPressed() {
    if (this.isKeyJustPressed('Digit1') || this.isKeyJustPressed('1') || this.isKeyJustPressed('Numpad1')) return 0;
    if (this.isKeyJustPressed('Digit2') || this.isKeyJustPressed('2') || this.isKeyJustPressed('Numpad2')) return 1;
    if (this.isKeyJustPressed('Digit3') || this.isKeyJustPressed('3') || this.isKeyJustPressed('Numpad3')) return 2;
    return -1;
  }
}
