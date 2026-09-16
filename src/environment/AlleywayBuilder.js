import * as THREE from 'three';

export class AlleywayBuilder {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.colliders = [];
    this.neonLights = [];
    this.spawnPoints = [];

    this.wallTexture = this.generateBrickTexture();
    this.zincTexture = this.generateZincTexture();
    this.tileTexture = this.generateTileTexture();

    this.buildGround();
    this.buildShophouses();
    this.buildAwnings();
    this.buildOverheadConduits();
    this.buildMultilingualNeonSigns();
    this.buildAirConditioners();
    this.buildStreetLamps();
    this.buildSpawnLedges();
  }

  generateBrickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Weathered pre-war aged plaster/brick base
    ctx.fillStyle = '#3a4049';
    ctx.fillRect(0, 0, 512, 512);

    // Brick pattern
    const rows = 32;
    const cols = 16;
    const rh = 512 / rows;
    const cw = 512 / cols;

    ctx.strokeStyle = '#23272d';
    ctx.lineWidth = 2;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (cw / 2);
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + offset;
        const y = r * rh;
        // Brick color variation
        const shade = Math.floor(58 + Math.random() * 32);
        ctx.fillStyle = `rgb(${shade + 10}, ${shade + 2}, ${shade - 2})`;
        ctx.fillRect(x + 1, y + 1, cw - 2, rh - 2);
      }
    }

    // Grime, rain water stain streaks
    for (let i = 0; i < 20; i++) {
      const sx = Math.random() * 512;
      const sw = 10 + Math.random() * 30;
      const grad = ctx.createLinearGradient(sx, 0, sx, 512);
      grad.addColorStop(0, 'rgba(15, 18, 22, 0.6)');
      grad.addColorStop(0.8, 'rgba(20, 24, 28, 0.35)');
      grad.addColorStop(1, 'rgba(15, 20, 18, 0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx, 0, sw, 512);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  generateZincTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#58626e';
    ctx.fillRect(0, 0, 256, 256);

    // Corrugated ridges
    for (let x = 0; x < 256; x += 12) {
      const grad = ctx.createLinearGradient(x, 0, x + 12, 0);
      grad.addColorStop(0, '#3a424b');
      grad.addColorStop(0.5, '#8592a1');
      grad.addColorStop(1, '#3a424b');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 12, 256);
    }

    // Rust spots
    for (let i = 0; i < 15; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 256;
      ctx.fillStyle = 'rgba(135, 60, 25, 0.45)';
      ctx.beginPath();
      ctx.arc(rx, ry, 8 + Math.random() * 15, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  generateTileTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2d3742';
    ctx.fillRect(0, 0, 256, 256);

    // Classic colonial 5-foot walkway geometric tiles
    const size = 32;
    for (let y = 0; y < 256; y += size) {
      for (let x = 0; x < 256; x += size) {
        const isAlt = ((x / size) + (y / size)) % 2 === 0;
        ctx.fillStyle = isAlt ? '#465668' : '#2a343e';
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

        // Floral / diamond center motif
        if (isAlt) {
          ctx.fillStyle = '#f2a64b';
          ctx.beginPath();
          ctx.arc(x + size / 2, y + size / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  buildGround() {
    // Wet asphalt / puddle floor plane
    const groundGeom = new THREE.PlaneGeometry(36, 50, 64, 64);
    groundGeom.rotateX(-Math.PI / 2);

    // Placeholder material will be swapped by PuddleReflection
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111315,
      roughness: 0.2,
      metalness: 0.1
    });

    this.groundMesh = new THREE.Mesh(groundGeom, groundMat);
    this.groundMesh.position.set(0, 0, 0);
    this.groundMesh.receiveShadow = true;
    this.group.add(this.groundMesh);

    // Five-foot way ("Kaki Lima") tiled sidewalks on both flanks
    const sidewalkGeom = new THREE.BoxGeometry(4.0, 0.22, 50);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: this.tileTexture,
      roughness: 0.35,
      metalness: 0.1
    });
    this.tileTexture.repeat.set(2, 25);

    const leftSidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
    leftSidewalk.position.set(-14, 0.11, 0);
    this.group.add(leftSidewalk);

    const rightSidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
    rightSidewalk.position.set(14, 0.11, 0);
    this.group.add(rightSidewalk);
  }

  buildShophouses() {
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.wallTexture,
      roughness: 0.85,
      metalness: 0.15
    });
    this.wallTexture.repeat.set(4, 3);

    // Shophouse facades: Left wall (X = -16), Right wall (X = +16), Back wall (Z = -25), Front gate (Z = +25)
    const buildingHeight = 18;
    const alleyLength = 50;

    // Left Facade
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(2, buildingHeight, alleyLength), wallMat);
    leftWall.position.set(-17, buildingHeight / 2, 0);
    this.group.add(leftWall);
    this.colliders.push(new THREE.Box3().setFromObject(leftWall));

    // Right Facade
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(2, buildingHeight, alleyLength), wallMat);
    rightWall.position.set(17, buildingHeight / 2, 0);
    this.group.add(rightWall);
    this.colliders.push(new THREE.Box3().setFromObject(rightWall));

    // Back Facade (behind Mamak stall)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(36, buildingHeight, 2), wallMat);
    backWall.position.set(0, buildingHeight / 2, -25);
    this.group.add(backWall);
    this.colliders.push(new THREE.Box3().setFromObject(backWall));

    // Front Exit Alley Gate (enclosed alley combat zone)
    const frontWallLeft = new THREE.Mesh(new THREE.BoxGeometry(13, buildingHeight, 2), wallMat);
    frontWallLeft.position.set(-11.5, buildingHeight / 2, 25);
    this.group.add(frontWallLeft);
    this.colliders.push(new THREE.Box3().setFromObject(frontWallLeft));

    const frontWallRight = new THREE.Mesh(new THREE.BoxGeometry(13, buildingHeight, 2), wallMat);
    frontWallRight.position.set(11.5, buildingHeight / 2, 25);
    this.group.add(frontWallRight);
    this.colliders.push(new THREE.Box3().setFromObject(frontWallRight));

    // Grate Gate at front (choke point)
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4, wireframe: true });
    const gateMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 0.4), gateMat);
    gateMesh.position.set(0, 4, 25);
    this.group.add(gateMesh);
    this.colliders.push(new THREE.Box3().setFromObject(gateMesh));

    // Arched Windows & Louvre Shutters along upper stories
    const shutterMat = new THREE.MeshStandardMaterial({ color: 0x1c2b28, roughness: 0.7 });
    const windowGlassMat = new THREE.MeshStandardMaterial({ color: 0x05080c, roughness: 0.1, metalness: 0.9 });

    for (let side of [-1, 1]) {
      const wx = side * 15.8;
      for (let story = 0; story < 2; story++) {
        const wy = 7.5 + story * 5.0;
        for (let wz = -20; wz <= 20; wz += 7) {
          // Window frame
          const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 1.8), windowGlassMat);
          winFrame.position.set(wx, wy, wz);
          this.group.add(winFrame);

          // Shutter wings
          const shutterLeft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.5, 0.8), shutterMat);
          shutterLeft.position.set(wx, wy, wz - 1.05);
          this.group.add(shutterLeft);

          const shutterRight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.5, 0.8), shutterMat);
          shutterRight.position.set(wx, wy, wz + 1.05);
          this.group.add(shutterRight);
        }
      }
    }
  }

  buildAwnings() {
    const awningMat = new THREE.MeshStandardMaterial({
      map: this.zincTexture,
      metalness: 0.85,
      roughness: 0.4
    });
    this.zincTexture.repeat.set(4, 1);

    // Left and right zinc awnings over the five-foot ways
    const leftAwning = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 42), awningMat);
    leftAwning.position.set(-14.2, 4.2, 0);
    leftAwning.rotation.z = -0.15; // Sloped down towards street
    this.group.add(leftAwning);

    const rightAwning = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 42), awningMat);
    rightAwning.position.set(14.2, 4.2, 0);
    rightAwning.rotation.z = 0.15;
    this.group.add(rightAwning);
  }

  buildOverheadConduits() {
    // Tangled industrial electrical cables spanning across the alley
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x111317 });

    for (let i = 0; i < 9; i++) {
      const z = -20 + i * 5.2;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-15.8, 8.5 + (Math.random() - 0.5) * 1.5, z),
        new THREE.Vector3(0, 6.2 + (Math.random() - 0.5) * 1.0, z + (Math.random() - 0.5) * 1.5),
        new THREE.Vector3(15.8, 8.5 + (Math.random() - 0.5) * 1.5, z)
      );

      const tubeGeom = new THREE.TubeGeometry(curve, 20, 0.045, 6, false);
      const cable = new THREE.Mesh(tubeGeom, cableMat);
      this.group.add(cable);
    }
  }

  createWallNeonTexture(scriptLine1, scriptLine2, colorHex, frameColor = '#22272e') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Translucent dark backing box
    ctx.fillStyle = '#080a0e';
    ctx.fillRect(0, 0, 512, 256);

    // Outer neon glow border
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 8;
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 30;
    ctx.strokeRect(12, 12, 488, 232);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 40;
    ctx.shadowColor = colorHex;
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(scriptLine1, 256, scriptLine2 ? 80 : 128);

    if (scriptLine2) {
      ctx.fillStyle = colorHex;
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText(scriptLine2, 256, 175);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  buildMultilingualNeonSigns() {
    // Authentic multilingual neon signage in Malay, Chinese, and Tamil
    const signsData = [
      // Left Wall Signs
      {
        line1: 'TEH TARIK',
        line2: 'RM 2.50 · PANAS / AIS',
        color: 0xffaa00,
        hex: '#ffaa00',
        pos: [-15.8, 5.2, -6],
        rot: [0, Math.PI / 2, 0],
        size: [4.2, 2.0]
      },
      {
        line1: '吉隆坡 炒面',
        line2: 'KL FRIED NOODLES · 印度煎饼',
        color: 0xff2266,
        hex: '#ff2266',
        pos: [-15.8, 5.5, 6],
        rot: [0, Math.PI / 2, 0],
        size: [4.6, 2.2]
      },
      {
        line1: 'தேநீர் கடை',
        line2: 'ரொட்டி · சுடச்சுட',
        color: 0x9933ff,
        hex: '#9933ff',
        pos: [-15.8, 5.0, 15],
        rot: [0, Math.PI / 2, 0],
        size: [4.0, 2.0]
      },
      // Right Wall Signs
      {
        line1: 'ROTI CANAI BANJIR',
        line2: 'KUAH KARI KAW KAW',
        color: 0xff3311,
        hex: '#ff3311',
        pos: [15.8, 5.2, -8],
        rot: [0, -Math.PI / 2, 0],
        size: [4.4, 2.1]
      },
      {
        line1: 'MEE GORENG BASAH',
        line2: 'TELUR MATA · PEDAS',
        color: 0x00e5ff,
        hex: '#00e5ff',
        pos: [15.8, 5.4, 4],
        rot: [0, -Math.PI / 2, 0],
        size: [4.5, 2.2]
      },
      {
        line1: 'CYBER-STREET KL',
        line2: 'SECTOR 23 · BAHAYA',
        color: 0x00ff88,
        hex: '#00ff88',
        pos: [15.8, 5.0, 13],
        rot: [0, -Math.PI / 2, 0],
        size: [4.2, 2.0]
      }
    ];

    signsData.forEach(s => {
      const tex = this.createWallNeonTexture(s.line1, s.line2, s.hex);
      const signMat = new THREE.MeshStandardMaterial({
        map: tex,
        emissive: new THREE.Color(s.color),
        emissiveMap: tex,
        emissiveIntensity: 1.8,
        roughness: 0.1
      });

      const signMesh = new THREE.Mesh(new THREE.BoxGeometry(s.size[0], s.size[1], 0.25), signMat);
      signMesh.position.set(...s.pos);
      signMesh.rotation.set(...s.rot);
      this.group.add(signMesh);

      // Localized point light illuminating wet asphalt and shophouse facade
      const signLight = new THREE.PointLight(s.color, 3.4, 16, 1.1);
      signLight.position.set(s.pos[0] * 0.9, s.pos[1], s.pos[2]);
      this.group.add(signLight);
      this.neonLights.push(signLight);
    });
  }

  buildAirConditioners() {
    const acMat = new THREE.MeshStandardMaterial({ color: 0x5a636e, roughness: 0.6, metalness: 0.5 });
    const acGeom = new THREE.BoxGeometry(1.4, 0.9, 0.7);

    const positions = [
      [-15.6, 6.8, -12],
      [-15.6, 6.8, 0],
      [-15.6, 11.5, 8],
      [15.6, 6.8, -14],
      [15.6, 6.8, 2],
      [15.6, 11.5, -5]
    ];

    positions.forEach(pos => {
      const ac = new THREE.Mesh(acGeom, acMat);
      ac.position.set(...pos);
      this.group.add(ac);
    });
  }

  buildStreetLamps() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.8, roughness: 0.3 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff8ee });

    const lampPositions = [
      [-12.2, 0, -14],
      [12.2, 0, -14],
      [-12.2, 0, 0],
      [12.2, 0, 0],
      [-12.2, 0, 14],
      [12.2, 0, 14]
    ];

    lampPositions.forEach(([lx, ly, lz]) => {
      // Iron pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.8, 8), poleMat);
      pole.position.set(lx, 2.4, lz);
      this.group.add(pole);

      // Curved arm over street
      const arm = new THREE.Mesh(new THREE.BoxGeometry(lx < 0 ? 1.4 : -1.4, 0.08, 0.08), poleMat);
      arm.position.set(lx + (lx < 0 ? 0.7 : -0.7), 4.75, lz);
      this.group.add(arm);

      // Lamp hood
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.25, 8), poleMat);
      hood.position.set(lx + (lx < 0 ? 1.3 : -1.3), 4.65, lz);
      this.group.add(hood);

      // Glowing glass bulb
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), lampGlowMat);
      bulb.position.set(lx + (lx < 0 ? 1.3 : -1.3), 4.5, lz);
      this.group.add(bulb);

      // Bright warm streetlight illuminating the alley floor & shophouses
      const streetLight = new THREE.PointLight(0xfff0da, 7.5, 28, 1.1);
      streetLight.position.set(lx + (lx < 0 ? 1.3 : -1.3), 4.3, lz);
      this.group.add(streetLight);
      this.neonLights.push(streetLight);
    });
  }

  buildSpawnLedges() {
    // Rooftop ledges and dark alley spawn positions for enemy horde
    this.spawnPoints = [
      // High zinc rooftop jump spawns
      { pos: new THREE.Vector3(-14, 4.4, -18), type: 'roof' },
      { pos: new THREE.Vector3(14, 4.4, -18), type: 'roof' },
      { pos: new THREE.Vector3(-14, 4.4, 12), type: 'roof' },
      { pos: new THREE.Vector3(14, 4.4, 12), type: 'roof' },
      // Alley grilles & gate ground spawns
      { pos: new THREE.Vector3(-4, 0, 24), type: 'ground' },
      { pos: new THREE.Vector3(4, 0, 24), type: 'ground' },
      { pos: new THREE.Vector3(0, 0, 24.5), type: 'ground' },
      { pos: new THREE.Vector3(-12, 0, -22), type: 'ground' },
      { pos: new THREE.Vector3(12, 0, -22), type: 'ground' }
    ];
  }

  getColliders() {
    return this.colliders;
  }

  getSpawnPoints() {
    return this.spawnPoints;
  }

  setQuality(quality) {
    // In performance mode, cull 7 auxiliary sign point lights to drastically reduce forward fragment shader load on Orange Pi
    const enableSignLights = (quality !== 'performance');
    for (let i = 0; i < this.neonLights.length; i++) {
      this.neonLights[i].visible = enableSignLights;
    }
  }
}
