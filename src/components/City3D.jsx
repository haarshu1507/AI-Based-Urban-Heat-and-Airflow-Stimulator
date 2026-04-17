import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ZoomIn, ZoomOut, RotateCcw, RotateCw } from 'lucide-react';

const GRID_SIZE = 15;

/** North-up: row GRID_SIZE−1 = north, matching map overlay + GridCanvas. */
function gridRowToWorldZ(r) {
  return (GRID_SIZE - 1 - r) - GRID_SIZE / 2 + 0.5;
}

const createBuildingTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e2834';
  ctx.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 4; c++) {
      const lit = Math.random() > 0.35;
      ctx.fillStyle = lit ? '#fef08a' : '#1e293b';
      ctx.shadowColor = lit ? '#fde047' : 'transparent';
      ctx.shadowBlur = lit ? 8 : 0;
      ctx.fillRect(8 + c * 30, 6 + r * 24, 18, 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  return tex;
};

const BUILDING_TEX = createBuildingTexture();

function hslToHeatColor(norm) {
  const hue = ((1 - norm) * 240) / 360;
  return new THREE.Color().setHSL(hue, 1, 0.5);
}

function hslToAirflowColor(flowStr) {
  const norm = Math.min(1, flowStr / 5);
  const hue = (norm * 120) / 360;
  return new THREE.Color().setHSL(hue, 1, 0.35);
}

function getTileColor(r, c, viewMode, heatData, airflowData, grid) {
  if (grid?.[r]?.[c]?.type === 'empty') {
    return new THREE.Color(0x000000);
  }
  if (viewMode === 'airflow' && airflowData?.[r]?.[c] !== undefined) {
    return hslToAirflowColor(airflowData[r][c]);
  }
  const hInfo = heatData?.normalizedGrid?.[r]?.[c];
  if (hInfo) return hslToHeatColor(hInfo.norm);
  return new THREE.Color(0x1e293b);
}

function getTileGlow(r, c, viewMode, heatData, airflowData) {
  if (viewMode === 'airflow' && airflowData?.[r]?.[c] !== undefined) {
    const n = Math.min(1, airflowData[r][c] / 5);
    return 0.03 + n * 0.16;
  }
  const hInfo = heatData?.normalizedGrid?.[r]?.[c];
  if (hInfo) return 0.03 + hInfo.norm * 0.16;
  return 0.04;
}

/** 3D tiles: heatmap-colored like 2D; white grid via GridHelper. */
const TILE_STYLE_3D = {
  tileWidth: 0.88,
  tileHeight: 0.048,
  tileY: -0.024,
  roughness: 0.52,
  metalness: 0.02,
};

const SKY_HEX = 0xa8d4ec;
const GROUND_HEX = 0xc4e8b0;

const City3D = ({
  grid,
  onCellClick,
  viewMode = '3D',
  heatData,
  airflowData,
  highlightedCells = [],
}) => {
  const frameRef = useRef(null);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const cityGroupRef = useRef(null);
  const tilesGroupRef = useRef(null);
  const controlsRef = useRef(null);
  const controlsApiRef = useRef(null);
  const tileMeshesRef = useRef(null);
  const waterMeshesRef = useRef([]);
  const clockRef = useRef(new THREE.Clock());
  const onCellClickRef = useRef(onCellClick);
  const rafRef = useRef(0);
  const aliveRef = useRef(false);
  const cleanupThreeRef = useRef(null);
  const aiHighlightKeysRef = useRef(new Set());
  /** After WebGL scene exists; grid/city effects must re-run (first run often saw null refs). */
  const [threeReady, setThreeReady] = useState(false);

  useEffect(() => {
    onCellClickRef.current = onCellClick;
  }, [onCellClick]);

  useEffect(() => {
    aiHighlightKeysRef.current = new Set(
      (highlightedCells ?? []).map(([r, c]) => `${r},${c}`)
    );
  }, [highlightedCells]);

  const handleCamAction = useCallback((action) => {
    const c = controlsApiRef.current;
    const cam = cameraRef.current;
    if (!c || !cam) return;
    switch (action) {
      case 'zoomin':
        cam.position.multiplyScalar(0.85);
        break;
      case 'zoomout':
        cam.position.multiplyScalar(1.15);
        break;
      case 'left':
        c.setAzimuthalAngle(c.getAzimuthalAngle() + 0.3);
        break;
      case 'right':
        c.setAzimuthalAngle(c.getAzimuthalAngle() - 0.3);
        break;
      case 'reset':
        c.reset();
        cam.position.set(0, 14, 18);
        c.target.set(0, 0, 0);
        break;
      default:
        break;
    }
    c.update();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const disposeScene = (scene) => {
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
    };

    const initThree = (width, height) => {
      cleanupThreeRef.current?.();
      cleanupThreeRef.current = null;
      waterMeshesRef.current = [];
      controlsApiRef.current = null;

      aliveRef.current = true;
      clockRef.current = new THREE.Clock();

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(SKY_HEX);
      scene.fog = new THREE.Fog(SKY_HEX, 55, 220);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
      camera.position.set(0, 14, 18);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      mount.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      scene.add(new THREE.AmbientLight(0xffffff, 0.58));
      scene.add(new THREE.HemisphereLight(0xe8f4fc, GROUND_HEX, 0.52));

      const dirLight = new THREE.DirectionalLight(0xfff8f0, 1.05);
      dirLight.position.set(-22, 36, -16);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(2048, 2048);
      dirLight.shadow.bias = -0.00015;
      dirLight.shadow.normalBias = 0.02;
      dirLight.shadow.camera.near = 2;
      dirLight.shadow.camera.far = 90;
      dirLight.shadow.camera.left = -18;
      dirLight.shadow.camera.right = 18;
      dirLight.shadow.camera.top = 18;
      dirLight.shadow.camera.bottom = -18;
      scene.add(dirLight);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(44, 44),
        new THREE.MeshStandardMaterial({ color: GROUND_HEX, roughness: 0.92, metalness: 0 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.08;
      ground.receiveShadow = true;
      scene.add(ground);

      const gridLines = new THREE.GridHelper(15, 15, 0xffffff, 0xffffff);
      gridLines.position.y = 0.003;
      const gridMat = gridLines.material;
      if (Array.isArray(gridMat)) {
        gridMat.forEach((m) => {
          m.transparent = true;
          m.opacity = 0.55;
        });
      } else {
        gridMat.transparent = true;
        gridMat.opacity = 0.55;
      }
      scene.add(gridLines);

      const tilesGroup = new THREE.Group();
      scene.add(tilesGroup);
      tilesGroupRef.current = tilesGroup;

      const tileGeo = new THREE.BoxGeometry(
        TILE_STYLE_3D.tileWidth,
        TILE_STYLE_3D.tileHeight,
        TILE_STYLE_3D.tileWidth
      );
      const tileMeshes = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        tileMeshes[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
          const mat = new THREE.MeshStandardMaterial({
            color: 0xbef0a0,
            roughness: TILE_STYLE_3D.roughness,
            metalness: TILE_STYLE_3D.metalness,
            emissive: 0x223311,
            emissiveIntensity: 0.04,
          });
          const mesh = new THREE.Mesh(tileGeo, mat);
          const x = c - GRID_SIZE / 2 + 0.5;
          const z = gridRowToWorldZ(r);
          mesh.position.set(x, TILE_STYLE_3D.tileY, z);
          mesh.receiveShadow = true;
          mesh.userData = { r, c };
          tilesGroup.add(mesh);
          tileMeshes[r][c] = mesh;
        }
      }
      tileMeshesRef.current = tileMeshes;

      const cityGroup = new THREE.Group();
      scene.add(cityGroup);
      cityGroupRef.current = cityGroup;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 8;
      controls.maxDistance = 36;
      controls.maxPolarAngle = Math.PI / 2.15;
      controls.target.set(0, 0, 0);
      controlsRef.current = controls;
      controlsApiRef.current = controls;

      const pulseCyan = new THREE.Color(0x22d3ee);

      const animate = () => {
        if (!aliveRef.current) return;
        rafRef.current = requestAnimationFrame(animate);
        const t = clockRef.current.getElapsedTime();
        waterMeshesRef.current.forEach(({ mesh, bx, bz }) => {
          mesh.position.y = 0.02 + Math.sin(t * 2 + bx * 3 + bz * 5) * 0.015;
        });

        const keys = aiHighlightKeysRef.current;
        const tiles = tileMeshesRef.current;
        if (keys.size > 0 && tiles) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 5.5);
          keys.forEach((key) => {
            const [r, c] = key.split(',').map(Number);
            const mesh = tiles[r]?.[c];
            const u = mesh?.userData;
            const mat = mesh?.material;
            if (!mat || u?.emissiveBase == null) return;
            mat.emissive.copy(u.emissiveBase);
            mat.emissive.lerp(pulseCyan, pulse * 0.58);
            mat.emissiveIntensity = u.emissiveIntBase + pulse * 0.48;
          });
        }

        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      let isDragging = false;
      let mouseDownPos = { x: 0, y: 0 };

      const onPointerDown = (event) => {
        isDragging = false;
        mouseDownPos = { x: event.clientX, y: event.clientY };
      };

      const onPointerMove = (event) => {
        if (
          Math.abs(event.clientX - mouseDownPos.x) > 5 ||
          Math.abs(event.clientY - mouseDownPos.y) > 5
        ) {
          isDragging = true;
        }
      };

      const onPointerUp = (event) => {
        if (isDragging || !onCellClickRef.current || !tileMeshesRef.current) return;

        const rect = renderer.domElement.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;

        mouse.x = (px / rect.width) * 2 - 1;
        mouse.y = -(py / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(tilesGroup.children, false);
        if (intersects.length > 0) {
          const { r, c } = intersects[0].object.userData;
          if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
            onCellClickRef.current(r, c);
          }
        }
      };

      const domElement = renderer.domElement;
      domElement.addEventListener('pointerdown', onPointerDown);
      domElement.addEventListener('pointermove', onPointerMove);
      domElement.addEventListener('pointerup', onPointerUp);

      const onWinResize = () => {
        if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        if (w < 2 || h < 2) return;
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      };
      window.addEventListener('resize', onWinResize);

      cleanupThreeRef.current = () => {
        aliveRef.current = false;
        setThreeReady(false);
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize', onWinResize);
        domElement.removeEventListener('pointerdown', onPointerDown);
        domElement.removeEventListener('pointermove', onPointerMove);
        domElement.removeEventListener('pointerup', onPointerUp);
        controls.dispose();
        renderer.dispose();
        if (mount.contains(domElement)) {
          mount.removeChild(domElement);
        }
        disposeScene(scene);
        sceneRef.current = null;
        rendererRef.current = null;
        cameraRef.current = null;
        cityGroupRef.current = null;
        tilesGroupRef.current = null;
        tileMeshesRef.current = null;
        controlsRef.current = null;
        controlsApiRef.current = null;
        waterMeshesRef.current = [];
      };

      setThreeReady(true);
    };

    const tryInit = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w >= 2 && h >= 2 && !rendererRef.current) {
        initThree(w, h);
      }
    };

    // Defer resize work out of the observer tick to avoid
    // "ResizeObserver loop completed with undelivered notifications" (Chrome)
    // when setSize/layout invalidates the observed element in the same frame.
    let resizeObsRaf = 0;
    const applyResize = () => {
      resizeObsRaf = 0;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w < 2 || h < 2) return;
      if (!rendererRef.current) {
        initThree(w, h);
      } else if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    };

    const ro = new ResizeObserver(() => {
      if (resizeObsRaf) cancelAnimationFrame(resizeObsRaf);
      resizeObsRaf = requestAnimationFrame(applyResize);
    });

    ro.observe(mount);
    requestAnimationFrame(tryInit);

    return () => {
      cancelAnimationFrame(resizeObsRaf);
      ro.disconnect();
      cleanupThreeRef.current?.();
      cleanupThreeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const tiles = tileMeshesRef.current;
    if (!tiles) return;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const mesh = tiles[r][c];
        const mat = mesh?.material;
        if (!mat) continue;
        if (viewMode === '3D') {
          const col = getTileColor(r, c, 'heatmap', heatData, airflowData, grid);
          const norm = heatData?.normalizedGrid?.[r]?.[c]?.norm ?? 0.5;
          mat.color.copy(col);
          mat.emissive.copy(col);
          mat.emissiveIntensity = 0.06 + norm * 0.22;
          mat.roughness = TILE_STYLE_3D.roughness;
          mat.metalness = TILE_STYLE_3D.metalness;
          mesh.userData.emissiveBase = mat.emissive.clone();
          mesh.userData.emissiveIntBase = mat.emissiveIntensity;
          continue;
        }
        const col = getTileColor(r, c, viewMode, heatData, airflowData, grid);
        const glow = getTileGlow(r, c, viewMode, heatData, airflowData);
        mat.color.copy(col);
        mat.emissive.copy(col);
        mat.emissiveIntensity = glow;
        mat.roughness = 0.45;
        mat.metalness = 0.05;
        mesh.userData.emissiveBase = mat.emissive.clone();
        mesh.userData.emissiveIntBase = mat.emissiveIntensity;
      }
    }
  }, [viewMode, heatData, airflowData, grid, threeReady, highlightedCells]);

  useEffect(() => {
    const group = cityGroupRef.current;
    if (!threeReady || !group) return;

    waterMeshesRef.current = [];

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
    }

    /** Suburban house: low footprint + warm walls + pyramid roof (readable vs towers). */
    const addHouse3D = (hx, hz) => {
      const g = new THREE.Group();
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0xd4a574,
        roughness: 0.78,
        metalness: 0.02,
      });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 });
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x7c2d12,
        roughness: 0.72,
        metalness: 0.04,
      });
      const w = 0.5;
      const d = 0.46;
      const wallH = 0.24;
      const y0 = 0.02;
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      walls.position.set(0, y0 + wallH / 2, 0);
      walls.castShadow = true;
      walls.receiveShadow = true;
      g.add(walls);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.02), trimMat);
      door.position.set(0.12, y0 + 0.09, d / 2 + 0.01);
      door.castShadow = true;
      g.add(door);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.37, 0.18, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, y0 + wallH + 0.09, 0);
      roof.castShadow = true;
      g.add(roof);
      g.position.set(hx, 0, hz);
      group.add(g);
    };

    /** Office tower: lit windows, modest height (was ~3.5–5.3 units). */
    const addSkyscraper3D = (sx, sz, height) => {
      const g = new THREE.Group();
      const mats = [
        new THREE.MeshStandardMaterial({ map: BUILDING_TEX, roughness: 0.42, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ map: BUILDING_TEX, roughness: 0.42, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ color: 0x2f3d4e, roughness: 0.62, metalness: 0.14 }),
        new THREE.MeshStandardMaterial({ color: 0x2f3d4e, roughness: 0.62 }),
        new THREE.MeshStandardMaterial({ map: BUILDING_TEX, roughness: 0.42, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ map: BUILDING_TEX, roughness: 0.42, metalness: 0.1 }),
      ];
      const padH = 0.022;
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, padH, 0.82),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.75, metalness: 0.08 })
      );
      pad.position.set(0, padH / 2, 0);
      pad.receiveShadow = true;
      g.add(pad);
      const y0 = padH;
      const footW = 0.48;
      const main = new THREE.Mesh(new THREE.BoxGeometry(footW, height, footW), mats);
      main.position.set(0, y0 + height / 2, 0);
      main.castShadow = true;
      main.receiveShadow = true;
      g.add(main);
      if (height > 0.88) {
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(footW * 0.72, height * 0.12, footW * 0.72),
          new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.22 })
        );
        cap.position.set(0, y0 + height + height * 0.06, 0);
        cap.castShadow = true;
        g.add(cap);
      }
      g.position.set(sx, 0, sz);
      group.add(g);
    };

    /** Factory: wide low hall + chimney + accent tanks (not a glass tower). */
    const addIndustry3D = (ix, iz) => {
      const g = new THREE.Group();
      const y0 = 0.02;
      const concrete = new THREE.MeshStandardMaterial({
        color: 0x8a8580,
        roughness: 0.88,
        metalness: 0.12,
      });
      const rust = new THREE.MeshStandardMaterial({
        color: 0x6b4423,
        roughness: 0.82,
        metalness: 0.18,
      });
      const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.92 });
      const windowStrip = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
        roughness: 0.4,
      });
      const hallW = 0.76;
      const hallD = 0.52;
      const hallH = 0.34;
      const hall = new THREE.Mesh(new THREE.BoxGeometry(hallW, hallH, hallD), concrete);
      hall.position.set(0, y0 + hallH / 2, 0);
      hall.castShadow = true;
      hall.receiveShadow = true;
      g.add(hall);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(hallW * 0.85, 0.06, 0.04), windowStrip);
      strip.position.set(0, y0 + hallH * 0.55, hallD / 2 + 0.02);
      strip.castShadow = true;
      g.add(strip);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.2, 10), rust);
      tank.position.set(-hallW * 0.28, y0 + hallH + 0.1, -hallD * 0.15);
      tank.castShadow = true;
      g.add(tank);
      const chimneyH = 0.68;
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, chimneyH, 8), dark);
      chimney.position.set(hallW * 0.32, y0 + hallH + chimneyH / 2 - 0.02, -hallD * 0.2);
      chimney.castShadow = true;
      g.add(chimney);
      g.position.set(ix, 0, iz);
      group.add(g);
    };

    const addConeTree = (tx, tz, scale = 1) => {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055 * scale, 0.075 * scale, 0.17 * scale, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
      );
      trunk.position.set(tx, 0.085 * scale, tz);
      trunk.castShadow = true;
      group.add(trunk);
      const layers = [
        { rad: 0.32 * scale, h: 0.46 * scale, y: 0.38 * scale, col: 0x1a5c30 },
        { rad: 0.24 * scale, h: 0.35 * scale, y: 0.64 * scale, col: 0x247a3e },
        { rad: 0.16 * scale, h: 0.26 * scale, y: 0.86 * scale, col: 0x349e52 },
      ];
      layers.forEach((L) => {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(L.rad, L.h, 6),
          new THREE.MeshStandardMaterial({ color: L.col, roughness: 0.78, flatShading: true })
        );
        cone.position.set(tx, L.y, tz);
        cone.castShadow = true;
        group.add(cone);
      });
    };

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const type = grid[r][c].type;
        if (type === 'empty') continue;

        const x = c - GRID_SIZE / 2 + 0.5;
        const z = gridRowToWorldZ(r);

        if (type === 'house') {
          addHouse3D(x, z);
        } else if (type === 'industry') {
          addIndustry3D(x, z);
        } else if (type === 'skyscraper') {
          const ht = 0.82 + (Math.sin(r * 12.345 + c * 67.89) * 0.5 + 0.5) * 0.52;
          addSkyscraper3D(x, z, ht);
        } else if (type === 'park') {
          addConeTree(x, z, 1.04);
        } else if (type === 'forest') {
          const groundMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.95, 0.95),
            new THREE.MeshStandardMaterial({ color: 0x3d8b4a, roughness: 0.88 })
          );
          groundMesh.rotation.x = -Math.PI / 2;
          groundMesh.position.set(x, 0.025, z);
          groundMesh.receiveShadow = true;
          group.add(groundMesh);
          addConeTree(x, z, 1.24);
        } else if (type === 'water') {
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.93, 0.93),
            new THREE.MeshStandardMaterial({
              color: 0x8bd4f2,
              transparent: true,
              opacity: 0.82,
              roughness: 0.12,
              metalness: 0.15,
            })
          );
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(x, 0.022, z);
          mesh.receiveShadow = true;
          group.add(mesh);
          waterMeshesRef.current.push({ mesh, bx: x, bz: z });
        } else if (type === 'road') {
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.95, 0.95),
            new THREE.MeshStandardMaterial({ color: 0x4a5f4a, roughness: 0.88 })
          );
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(x, 0.032, z);
          mesh.receiveShadow = true;
          group.add(mesh);
        }
      }
    }
  }, [grid, threeReady]);

  const camBtnLight =
    'flex h-9 w-9 items-center justify-center rounded-md border border-slate-300/90 bg-white text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.94]';

  return (
    <div
      ref={frameRef}
      className="relative h-full min-h-[480px] w-full min-w-0 overflow-hidden rounded-2xl border border-sky-200/40 bg-sky-100/20 shadow-[0_16px_48px_rgba(15,40,60,0.2)] md:h-[600px] lg:h-[680px]"
      aria-label="3D city view"
    >
      <div className="absolute left-4 top-4 z-20 flex w-[5.25rem] flex-col gap-2 rounded-xl border border-slate-200/95 bg-white/95 p-2 shadow-[0_8px_28px_rgba(0,0,0,0.12)] backdrop-blur-sm">
        <div className="flex gap-1.5">
          <button type="button" onClick={() => handleCamAction('zoomin')} className={camBtnLight} title="Zoom in">
            <ZoomIn size={18} strokeWidth={2.25} className="text-slate-800" aria-hidden />
          </button>
          <button type="button" onClick={() => handleCamAction('zoomout')} className={camBtnLight} title="Zoom out">
            <ZoomOut size={18} strokeWidth={2.25} className="text-slate-800" aria-hidden />
          </button>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => handleCamAction('left')} className={camBtnLight} title="Orbit left">
            <RotateCcw size={18} strokeWidth={2.25} className="text-slate-800" aria-hidden />
          </button>
          <button type="button" onClick={() => handleCamAction('right')} className={camBtnLight} title="Orbit right">
            <RotateCw size={18} strokeWidth={2.25} className="text-slate-800" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => handleCamAction('reset')}
          className="w-full rounded-md border border-rose-200 bg-rose-50/90 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-red-600 shadow-sm transition hover:bg-rose-100"
          title="Reset view"
        >
          Reset
        </button>
      </div>

      <div ref={mountRef} className="absolute inset-0 h-full min-h-[200px] w-full" />
    </div>
  );
};

export default City3D;
