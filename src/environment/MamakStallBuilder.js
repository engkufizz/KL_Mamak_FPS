import * as THREE from 'three';

export class MamakStallBuilder {
  constructor(scene) {
    this.scene = scene;
    this.stallGroup = new THREE.Group();
    this.scene.add(this.stallGroup);

    this.fans = [];
    this.signLights = [];

    this.buildStallStructure();
    this.buildStainlessCart();
    this.buildHangingFans();
  }

  // Create canvas texture with authentic Malaysian mamak text and glowing borders
  createNeonSignTexture(textLine1, textLine2, colorHex, bgColor = '#0a0d12', scriptType = 'latin') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 340;
    const ctx = canvas.getContext('2d');

    // Dark weather-resistant acrylic signboard background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Weathered metallic frame
    ctx.strokeStyle = '#2a3038';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Neon tube inner glow frame
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 6;
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 25;
    ctx.strokeRect(26, 26, canvas.width - 52, canvas.height - 52);

    // Typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 35;
    ctx.fillStyle = '#ffffff';

    if (textLine2) {
      ctx.font = '900 68px "Impact", "Arial Black", sans-serif';
      ctx.fillText(textLine1, canvas.width / 2, 115);

      ctx.fillStyle = colorHex;
      ctx.font = 'bold 52px "Arial", sans-serif';
      ctx.fillText(textLine2, canvas.width / 2, 220);
    } else {
      ctx.font = '900 84px "Impact", "Arial Black", sans-serif';
      ctx.fillText(textLine1, canvas.width / 2, 170);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  buildStallStructure() {
    // Zinc awning roof over stall
    const zincGeom = new THREE.BoxGeometry(18, 0.25, 10);
    const zincMat = new THREE.MeshStandardMaterial({
      color: 0x3a424a,
      roughness: 0.5,
      metalness: 0.75
    });
    const zincRoof = new THREE.Mesh(zincGeom, zincMat);
    zincRoof.position.set(0, 4.8, -12);
    zincRoof.rotation.x = 0.12; // Slight forward slope for rain runoff
    this.stallGroup.add(zincRoof);

    // Iron support poles
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.7, metalness: 0.6 });
    const poleGeom = new THREE.CylinderGeometry(0.12, 0.12, 5.0, 8);

    const polePositions = [
      [-8.5, 2.5, -7.5],
      [8.5, 2.5, -7.5],
      [-8.5, 2.5, -16.5],
      [8.5, 2.5, -16.5]
    ];

    polePositions.forEach(pos => {
      const pole = new THREE.Mesh(poleGeom, poleMat);
      pole.position.set(...pos);
      this.stallGroup.add(pole);
    });

    // Main Overhead Mamak Signboard: "MAJU TEKUN 24 JAM"
    const mainSignTex = this.createNeonSignTexture('RESTORAN MAJU TEKUN', 'MAMAK 24 JAM · NASI KANDAR', '#00ffcc');
    const mainSignMat = new THREE.MeshStandardMaterial({
      map: mainSignTex,
      emissive: new THREE.Color(0x00e6b8),
      emissiveMap: mainSignTex,
      emissiveIntensity: 1.8,
      roughness: 0.2
    });
    const mainSign = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 0.4), mainSignMat);
    mainSign.position.set(0, 5.5, -7.2);
    this.stallGroup.add(mainSign);

    // Point lights under the awning for authentic warm/cyan mamak glow
    const warmLight = new THREE.PointLight(0xffb042, 5.8, 18, 1.1);
    warmLight.position.set(-3, 3.8, -11);
    this.stallGroup.add(warmLight);

    const cyanLight = new THREE.PointLight(0x00e8ff, 5.0, 18, 1.1);
    cyanLight.position.set(3, 3.8, -11);
    this.stallGroup.add(cyanLight);

    this.signLights.push(warmLight, cyanLight);
  }

  buildStainlessCart() {
    // Stainless Steel Roti Canai Cart
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.92,
      roughness: 0.18
    });

    const cartBase = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.4, 2.2), steelMat);
    cartBase.position.set(-3.5, 0.7, -13);
    this.stallGroup.add(cartBase);

    // Flat black iron hot griddle for roti canai
    const griddleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35, metalness: 0.85 });
    const griddle = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.6), griddleMat);
    griddle.position.set(-4.2, 1.45, -13);
    this.stallGroup.add(griddle);

    // Glass food display case (nasi kandar dishes / roti display)
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xaaddee,
      metalness: 0.1,
      roughness: 0.05,
      transparent: true,
      opacity: 0.45
    });
    const displayCase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.8), glassMat);
    displayCase.position.set(-2.2, 1.95, -13);
    this.stallGroup.add(displayCase);

    // Food trays with warm curry colors inside display
    const curryColors = [0xb83a00, 0x946505, 0x8a1c14];
    curryColors.forEach((col, i) => {
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.15, 0.45),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })
      );
      tray.position.set(-2.7 + i * 0.55, 1.5, -13);
      this.stallGroup.add(tray);
    });

    // Drink Station (Teh Tarik Dispenser & Stainless Urns)
    const drinkBase = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.3, 1.8), steelMat);
    drinkBase.position.set(3.2, 0.65, -13);
    this.stallGroup.add(drinkBase);

    // Cylindrical hot water boilers
    const boilerMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.95, roughness: 0.12 });
    const boiler1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16), boilerMat);
    boiler1.position.set(2.4, 1.75, -13);
    this.stallGroup.add(boiler1);

    const boiler2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16), boilerMat);
    boiler2.position.set(3.4, 1.75, -13);
    this.stallGroup.add(boiler2);
  }

  buildHangingFans() {
    // Hanging ceiling fans with spinning blades
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x1f2429, roughness: 0.6, metalness: 0.4 });
    const fanPositions = [
      [-3.0, 4.1, -11.0],
      [3.0, 4.1, -11.0]
    ];

    fanPositions.forEach(pos => {
      const fanGroup = new THREE.Group();
      fanGroup.position.set(...pos);

      // Rod
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), fanMat);
      rod.position.y = 0.4;
      fanGroup.add(rod);

      // Motor hub
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12), fanMat);
      fanGroup.add(hub);

      // Blades
      const bladesGroup = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.22), fanMat);
        blade.position.set(Math.cos(angle) * 0.7, 0, Math.sin(angle) * 0.7);
        blade.rotation.y = -angle;
        blade.rotation.z = 0.08;
        bladesGroup.add(blade);
      }
      fanGroup.add(bladesGroup);

      this.stallGroup.add(fanGroup);
      this.fans.push(bladesGroup);
    });
  }

  update(delta) {
    // Rotate ceiling fan blades
    for (const blades of this.fans) {
      blades.rotation.y += delta * 4.5;
    }
  }
}
