import * as THREE from 'three';

export interface FarmPlotBounds {
  id: string;
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  isPaddy?: boolean;
}

export const CROP_PLOTS: FarmPlotBounds[] = [
  { id: 'corn-row', cx: 7.8, cz: 7.6, halfW: 2.7, halfD: 2.3 },
  { id: 'wheat-patch', cx: 9.2, cz: 1.0, halfW: 3.1, halfD: 2.3 },
  { id: 'sunflowers', cx: -9.2, cz: 6.2, halfW: 2.4, halfD: 2.0 },
  { id: 'tomatoes', cx: -3.8, cz: 6.8, halfW: 2.1, halfD: 1.8 },
  { id: 'pumpkins', cx: -4.4, cz: 1.6, halfW: 2.2, halfD: 1.8 },
  { id: 'carrot-rows', cx: 2.8, cz: 2.0, halfW: 2.0, halfD: 1.6 },
  { id: 'strawberries', cx: -9.2, cz: 1.2, halfW: 1.9, halfD: 1.6 },
  { id: 'lavender', cx: -14.2, cz: 5.2, halfW: 2.0, halfD: 1.6 },
  { id: 'rice-paddy', cx: 5.2, cz: -4.4, halfW: 2.3, halfD: 1.9, isPaddy: true },
];

export const POND_CENTER = { x: 11.2, z: -5.8, rx: 3.3, rz: 2.6 };

export interface FarmTarget3D {
  hotspotId: string;
  position: [number, number, number];
  labelOffsetY: number;
  highlightRadius: number;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Center-line X of the winding dirt path as a function of Z */
export function pathCenterX(z: number): number {
  return Math.sin(z * 0.14) * 2.1 - 0.5;
}

/** Distance to the winding dirt path */
export function pathDistance(x: number, z: number): number {
  return Math.abs(x - pathCenterX(z));
}

/** Deterministic rolling valley elevation at any world (x, z) */
export function groundHeightAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);

  // Outer valley rim hills rise gently beyond r > 15
  const rimFactor = smoothstep(14.0, 38.0, dist);
  const backRidgeBoost = z < -11 ? smoothstep(-11, -34, z) * 3.8 : 0;

  // Low-frequency organic undulations
  const n1 = Math.sin(x * 0.11 + 0.7) * Math.cos(z * 0.1 - 0.4);
  const n2 = Math.sin(x * 0.24 - z * 0.19) * 0.45;
  const n3 = Math.cos(x * 0.07 + z * 0.09) * 0.8;

  let h = (n1 * 0.45 + n2 * 0.25 + n3 * 0.35) * smoothstep(8.0, 22.0, dist);
  h += rimFactor * (4.8 + n1 * 2.1 + n2 * 0.9) + backRidgeBoost;

  // Flatten farmstead pad (farmhouse & barn)
  const houseDist = Math.hypot((x + 11.2) / 6.5, (z + 6.5) / 6.8);
  const houseFlat = 1 - smoothstep(0.75, 1.35, houseDist);
  h = h * (1 - houseFlat) + 0.18 * houseFlat;

  // Flatten each crop plot slightly above surrounding meadow
  for (const plot of CROP_PLOTS) {
    const dx = Math.abs(x - plot.cx) / (plot.halfW + 0.8);
    const dz = Math.abs(z - plot.cz) / (plot.halfD + 0.8);
    const boxDist = Math.max(dx, dz);
    if (boxDist < 1.35) {
      const f = 1 - smoothstep(0.8, 1.35, boxDist);
      const targetH = plot.isPaddy ? -0.14 : 0.1;
      h = h * (1 - f) + targetH * f;
    }
  }

  // Smooth pond depression
  const pondNorm = Math.hypot((x - POND_CENTER.x) / POND_CENTER.rx, (z - POND_CENTER.z) / POND_CENTER.rz);
  if (pondNorm < 1.45) {
    const basin = 1 - smoothstep(0.35, 1.4, pondNorm);
    h -= basin * 0.95;
  }

  return h;
}

export const FARM_TARGETS_3D: Record<string, FarmTarget3D> = {
  'big-tree': {
    hotspotId: 'big-tree',
    position: [-15.2, groundHeightAt(-15.2, -2.2), -2.2],
    labelOffsetY: 5.4,
    highlightRadius: 2.8,
    cameraPos: [-9.2, 6.2, 5.2],
    cameraTarget: [-15.2, 2.2, -2.2],
  },
  'forest-hills': {
    hotspotId: 'forest-hills',
    position: [6.0, groundHeightAt(6.0, -21.0), -21.0],
    labelOffsetY: 5.2,
    highlightRadius: 4.5,
    cameraPos: [4.5, 9.8, -8.5],
    cameraTarget: [6.0, 3.6, -21.0],
  },
  'pine-trees': {
    hotspotId: 'pine-trees',
    position: [-17.5, groundHeightAt(-17.5, -14.5), -14.5],
    labelOffsetY: 5.0,
    highlightRadius: 3.6,
    cameraPos: [-11.5, 7.6, -4.5],
    cameraTarget: [-17.5, 2.8, -14.5],
  },
  'background-tree': {
    hotspotId: 'background-tree',
    position: [-1.8, groundHeightAt(-1.8, -14.8), -14.8],
    labelOffsetY: 4.4,
    highlightRadius: 2.3,
    cameraPos: [2.2, 5.2, -7.2],
    cameraTarget: [-1.8, 2.1, -14.8],
  },
  'mid-tree': {
    hotspotId: 'mid-tree',
    position: [12.4, groundHeightAt(12.4, -11.4), -11.4],
    labelOffsetY: 4.9,
    highlightRadius: 2.6,
    cameraPos: [7.8, 5.8, -3.5],
    cameraTarget: [12.4, 2.2, -11.4],
  },
  'apple-tree': {
    hotspotId: 'apple-tree',
    position: [-4.6, groundHeightAt(-4.6, -4.8), -4.8],
    labelOffsetY: 3.8,
    highlightRadius: 2.0,
    cameraPos: [-1.4, 4.2, 1.2],
    cameraTarget: [-4.6, 1.7, -4.8],
  },
  'solar-panels': {
    hotspotId: 'solar-panels',
    position: [-10.4, groundHeightAt(-10.4, -4.4) + 3.0, -3.6],
    labelOffsetY: 1.8,
    highlightRadius: 1.8,
    cameraPos: [-6.8, 6.2, 2.8],
    cameraTarget: [-10.4, 2.9, -4.0],
  },
  'wheat-patch': {
    hotspotId: 'wheat-patch',
    position: [9.2, groundHeightAt(9.2, 1.0), 1.0],
    labelOffsetY: 2.1,
    highlightRadius: 3.1,
    cameraPos: [9.4, 4.6, 8.2],
    cameraTarget: [9.2, 0.7, 1.0],
  },
  'carrot-rows': {
    hotspotId: 'carrot-rows',
    position: [2.8, groundHeightAt(2.8, 2.0), 2.0],
    labelOffsetY: 1.6,
    highlightRadius: 2.2,
    cameraPos: [3.2, 3.8, 7.2],
    cameraTarget: [2.8, 0.4, 2.0],
  },
  'pumpkin-patch': {
    hotspotId: 'pumpkin-patch',
    position: [-4.4, groundHeightAt(-4.4, 1.6), 1.6],
    labelOffsetY: 1.6,
    highlightRadius: 2.3,
    cameraPos: [-4.0, 3.8, 6.8],
    cameraTarget: [-4.4, 0.4, 1.6],
  },
  sunflowers: {
    hotspotId: 'sunflowers',
    position: [-9.2, groundHeightAt(-9.2, 6.2), 6.2],
    labelOffsetY: 2.6,
    highlightRadius: 2.5,
    cameraPos: [-7.2, 4.4, 12.2],
    cameraTarget: [-9.2, 1.1, 6.2],
  },
  cows: {
    hotspotId: 'cows',
    position: [3.4, groundHeightAt(3.4, -9.8), -9.8],
    labelOffsetY: 2.2,
    highlightRadius: 3.2,
    cameraPos: [3.4, 4.8, -2.5],
    cameraTarget: [3.4, 0.9, -9.8],
  },
  'meadow-grass': {
    hotspotId: 'meadow-grass',
    position: [7.6, groundHeightAt(7.6, -10.8), -10.8],
    labelOffsetY: 1.8,
    highlightRadius: 2.8,
    cameraPos: [6.8, 4.8, -3.8],
    cameraTarget: [7.6, 0.6, -10.8],
  },
  tomatoes: {
    hotspotId: 'tomatoes',
    position: [-3.8, groundHeightAt(-3.8, 6.8), 6.8],
    labelOffsetY: 2.2,
    highlightRadius: 2.2,
    cameraPos: [-3.2, 3.9, 12.0],
    cameraTarget: [-3.8, 0.8, 6.8],
  },
  lavender: {
    hotspotId: 'lavender',
    position: [-14.2, groundHeightAt(-14.2, 5.2), 5.2],
    labelOffsetY: 1.7,
    highlightRadius: 2.1,
    cameraPos: [-11.8, 3.9, 10.8],
    cameraTarget: [-14.2, 0.6, 5.2],
  },
  'corn-row': {
    hotspotId: 'corn-row',
    position: [7.8, groundHeightAt(7.8, 7.6), 7.6],
    labelOffsetY: 2.9,
    highlightRadius: 2.9,
    cameraPos: [7.4, 4.9, 14.4],
    cameraTarget: [7.8, 1.2, 7.6],
  },
  wildflowers: {
    hotspotId: 'wildflowers',
    position: [1.8, groundHeightAt(1.8, 9.6), 9.6],
    labelOffsetY: 1.7,
    highlightRadius: 2.7,
    cameraPos: [2.4, 3.6, 15.2],
    cameraTarget: [1.8, 0.5, 9.6],
  },
  strawberries: {
    hotspotId: 'strawberries',
    position: [-9.2, groundHeightAt(-9.2, 1.2), 1.2],
    labelOffsetY: 1.5,
    highlightRadius: 2.0,
    cameraPos: [-8.6, 3.6, 6.2],
    cameraTarget: [-9.2, 0.4, 1.2],
  },
  'rice-paddy': {
    hotspotId: 'rice-paddy',
    position: [5.2, groundHeightAt(5.2, -4.4), -4.4],
    labelOffsetY: 1.7,
    highlightRadius: 2.4,
    cameraPos: [4.2, 4.2, 1.8],
    cameraTarget: [5.2, 0.2, -4.4],
  },
  'farm-pond': {
    hotspotId: 'farm-pond',
    position: [11.2, -0.35, -5.8],
    labelOffsetY: 1.8,
    highlightRadius: 3.1,
    cameraPos: [10.8, 4.8, 1.2],
    cameraTarget: [11.2, -0.1, -5.8],
  },
};

/** Detect software WebGL rasterizers (SwiftShader / llvmpipe / Softpipe) to tune expensive passes */
export function detectSoftwareWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|softpipe|Software Rasterizer/i.test(renderer);
  } catch {
    return false;
  }
}

export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// =========================================================================
// Procedural Canvas Textures (Cached Singletons)
// =========================================================================
let cachedStoneTex: THREE.CanvasTexture | null = null;
let cachedSoilTex: THREE.CanvasTexture | null = null;
let cachedWoodTex: THREE.CanvasTexture | null = null;
let cachedRoofTex: THREE.CanvasTexture | null = null;
let cachedBarkTex: THREE.CanvasTexture | null = null;

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function getStoneWallTexture(): THREE.CanvasTexture {
  if (cachedStoneTex) return cachedStoneTex;
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = '#C9C0AE';
  ctx.fillRect(0, 0, 256, 256);

  const stoneColors = ['#D8D0BE', '#BEB5A2', '#CBC3B2', '#B1A896', '#DED7C8'];
  const rows = 8;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    let x = (r % 2) * -22;
    while (x < 256) {
      const w = 36 + ((r * 17 + x * 13) % 28);
      ctx.fillStyle = stoneColors[(r * 5 + Math.abs(x)) % stoneColors.length];
      ctx.beginPath();
      ctx.roundRect(x + 2, r * rowH + 2, w - 4, rowH - 4, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(92, 84, 70, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      x += w;
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(2, 1.5);
  cachedStoneTex = tex;
  return tex;
}

export function getSoilRowTexture(): THREE.CanvasTexture {
  if (cachedSoilTex) return cachedSoilTex;
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = '#6D492D';
  ctx.fillRect(0, 0, 256, 256);

  // Horizontal plowed furrow stripes
  for (let y = 0; y < 256; y += 24) {
    const g = ctx.createLinearGradient(0, y, 0, y + 24);
    g.addColorStop(0, '#4E331D');
    g.addColorStop(0.45, '#7A5233');
    g.addColorStop(0.75, '#664328');
    g.addColorStop(1, '#4A2F1B');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, 256, 24);
  }
  // Soil crumbs
  for (let i = 0; i < 360; i++) {
    const px = (i * 73) % 256;
    const py = (i * 137) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(42,26,14,0.28)' : 'rgba(155,112,72,0.22)';
    ctx.fillRect(px, py, 2.5, 2.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(2, 2);
  cachedSoilTex = tex;
  return tex;
}

export function getWoodPlankTexture(): THREE.CanvasTexture {
  if (cachedWoodTex) return cachedWoodTex;
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = '#9C6A42';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = y % 64 === 0 ? 'rgba(120, 78, 46, 0.25)' : 'rgba(70, 44, 24, 0.14)';
    ctx.fillRect(0, y, 256, 31);
    ctx.fillStyle = 'rgba(48, 28, 14, 0.45)';
    ctx.fillRect(0, y + 31, 256, 1.5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedWoodTex = tex;
  return tex;
}

export function getRoofShingleTexture(): THREE.CanvasTexture {
  if (cachedRoofTex) return cachedRoofTex;
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = '#B84232';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 20) {
    for (let x = (y % 40 === 0 ? 0 : -14); x < 256; x += 28) {
      ctx.fillStyle = ((x + y) % 56 === 0) ? '#A43627' : '#C64D3C';
      ctx.fillRect(x + 1, y + 1, 26, 18);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(3, 2);
  cachedRoofTex = tex;
  return tex;
}

export function getBarkTexture(): THREE.CanvasTexture {
  if (cachedBarkTex) return cachedBarkTex;
  const [canvas, ctx] = makeCanvas(128);
  ctx.fillStyle = '#6D4C34';
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 6) {
    ctx.fillStyle = x % 12 === 0 ? '#573B26' : '#7D583D';
    ctx.fillRect(x, 0, 3, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedBarkTex = tex;
  return tex;
}
