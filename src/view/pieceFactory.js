import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MODEL_SETS, TEAM_COLORS } from '../sets/index.js';
import { modelKey, pieceLabel } from '../shogi/constants.js';

// 駒の大きさ(玉が最大、歩が最小)
const HEIGHT = { K: 1.15, R: 1.05, B: 1.05, G: 0.95, S: 0.9, N: 0.85, L: 0.85, P: 0.72 };

const loader = new GLTFLoader();
const gltfCache = new Map(); // url → gltf | null(読み込み失敗)

// セットの GLB をすべて読み込む。失敗した駒は仮モデルになる。
export async function preloadSet(setId) {
  const set = MODEL_SETS[setId];
  const jobs = Object.values(set.models).map(async (file) => {
    const url = `models/${setId}/${file}`;
    if (gltfCache.has(url)) return;
    try {
      gltfCache.set(url, await loader.loadAsync(url));
    } catch (e) {
      console.warn(`model load failed: ${url}`, e);
      gltfCache.set(url, null);
    }
  });
  await Promise.all(jobs);
}

const matCache = new Map();
function mat(color, { emissive = 0x000000, emissiveIntensity = 0, metalness = 0.1, roughness = 0.6 } = {}) {
  const key = [color, emissive, emissiveIntensity, metalness, roughness].join(':');
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, metalness, roughness }));
  }
  return matCache.get(key);
}

function mesh(geo, material, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = []) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

// 将棋駒の五角形の台座(尖った側 = 前 = +z)
function createBase(owner) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.42);
  s.lineTo(0.3, 0.26);
  s.lineTo(0.38, -0.38);
  s.lineTo(-0.38, -0.38);
  s.lineTo(-0.3, 0.26);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  const base = mesh(geo, mat(TEAM_COLORS[owner], { metalness: 0.3, roughness: 0.4, emissive: TEAM_COLORS[owner], emissiveIntensity: 0.25 }),
    [0, 0.09, 0], [Math.PI / 2, 0, 0]);
  base.receiveShadow = true;
  base.name = 'base';
  return base;
}

function wing(color, side, size) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.42 * size, 0.28 * size);
  s.lineTo(0.36 * size, -0.05 * size);
  s.lineTo(0.22 * size, -0.12 * size);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  const m = mesh(geo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.7 }));
  m.scale.x = side;
  m.rotation.y = side * 0.5;
  m.name = 'wing';
  return m;
}

function buildDragon(g, c, type) {
  g.add(mesh(new THREE.CapsuleGeometry(0.17, 0.22, 4, 12), mat(c.body), [0, 0.38, 0]));
  g.add(mesh(new THREE.SphereGeometry(0.12, 12, 10), mat(c.accent), [0, 0.36, 0.09]));
  g.add(mesh(new THREE.SphereGeometry(0.14, 14, 12), mat(c.body), [0, 0.68, 0.02]));
  g.add(mesh(new THREE.ConeGeometry(0.08, 0.2, 8), mat(c.body), [0, 0.66, 0.17], [Math.PI / 2, 0, 0]));
  for (const sx of [-1, 1]) {
    g.add(mesh(new THREE.ConeGeometry(0.035, 0.16, 6), mat(c.accent), [sx * 0.07, 0.8, -0.04], [-0.5, 0, sx * -0.3]));
    g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(c.eye, { emissive: c.eye, emissiveIntensity: 1.2 }), [sx * 0.06, 0.71, 0.12]));
    const w = wing(c.dark, sx, type === 'R' ? 1.5 : 1);
    w.position.set(sx * 0.1, 0.5, -0.1);
    g.add(w);
  }
  g.add(mesh(new THREE.ConeGeometry(0.07, 0.35, 8), mat(c.body), [0, 0.22, -0.25], [-Math.PI / 2 - 0.4, 0, 0]));
}

function buildUndead(g, c) {
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6), mat(c.body), [0, 0.38, 0]));
  for (let i = 0; i < 3; i++) {
    g.add(mesh(new THREE.TorusGeometry(0.11 - i * 0.015, 0.018, 6, 14), mat(c.body), [0, 0.48 - i * 0.07, 0], [Math.PI / 2, 0, 0]));
  }
  g.add(mesh(new THREE.ConeGeometry(0.2, 0.42, 12, 1, true), mat(c.accent, { roughness: 0.9 }), [0, 0.3, -0.02]));
  g.add(mesh(new THREE.SphereGeometry(0.15, 14, 12), mat(c.body), [0, 0.7, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.14, 0.06, 0.1), mat(c.body), [0, 0.6, 0.05]));
  for (const sx of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(c.dark), [sx * 0.055, 0.72, 0.11]));
    g.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), mat(c.eye, { emissive: c.eye, emissiveIntensity: 2 }), [sx * 0.055, 0.72, 0.135]));
  }
}

function buildDemon(g, c, type) {
  g.add(mesh(new THREE.CapsuleGeometry(0.16, 0.24, 4, 12), mat(c.body), [0, 0.38, 0]));
  g.add(mesh(new THREE.SphereGeometry(0.14, 14, 12), mat(c.body), [0, 0.7, 0]));
  for (const sx of [-1, 1]) {
    const horn = mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 10, Math.PI * 0.8), mat(c.accent, { metalness: 0.4 }),
      [sx * 0.12, 0.8, 0], [0, Math.PI / 2, sx > 0 ? 0 : Math.PI]);
    g.add(horn);
    g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(c.eye, { emissive: c.eye, emissiveIntensity: 1.6 }), [sx * 0.055, 0.72, 0.12]));
    const w = wing(c.dark, sx, type === 'R' ? 1.4 : 0.9);
    w.position.set(sx * 0.1, 0.52, -0.1);
    g.add(w);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.4, 6), mat(c.dark), [0, 0.22, -0.22], [-1.1, 0, 0]));
}

// 駒の種類ごとの持ち物(どのセットでも共通)
function addTypeProps(g, c, type) {
  const gold = mat(0xf2c94c, { metalness: 0.8, roughness: 0.25, emissive: 0x6b4b00, emissiveIntensity: 0.4 });
  switch (type) {
    case 'K': {
      g.add(mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.06, 12, 1, true), gold, [0, 0.86, 0]));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(mesh(new THREE.ConeGeometry(0.025, 0.08, 5), gold, [Math.sin(a) * 0.1, 0.92, Math.cos(a) * 0.1]));
      }
      break;
    }
    case 'B':
      g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 6), mat(c.dark), [0.22, 0.42, 0.05]));
      g.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), mat(c.accent, { emissive: c.accent, emissiveIntensity: 1.5 }), [0.22, 0.82, 0.05]));
      break;
    case 'G':
      g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16), gold, [-0.2, 0.42, 0.08], [Math.PI / 2, 0, 0.3]));
      break;
    case 'S':
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), mat(0xaaaaaa, { metalness: 0.7 }), [0.2, 0.42, 0.05]));
      g.add(mesh(new THREE.ConeGeometry(0.03, 0.1, 6), mat(0xdddddd, { metalness: 0.9, roughness: 0.2 }), [0.2, 0.82, 0.05]));
      break;
    case 'L':
      g.add(mesh(new THREE.ConeGeometry(0.05, 0.5, 8), mat(0xcccccc, { metalness: 0.8, roughness: 0.2 }), [0.15, 0.4, 0.3], [Math.PI / 2, 0, 0]));
      break;
    case 'N':
      g.rotation.x = 0.25; // 前傾姿勢(跳躍の構え)
      break;
    default:
      break;
  }
}

const STYLE_BUILDERS = { dragon: buildDragon, undead: buildUndead, demon: buildDemon };

function buildPlaceholder(set, type, promoted) {
  const g = new THREE.Group();
  STYLE_BUILDERS[set.style](g, set.colors, type);
  addTypeProps(g, set.colors, type);
  if (promoted) {
    // 成駒: 金色のオーラリング
    const ring = mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.85 }), [0, 0.5, 0], [Math.PI / 2, 0, 0]);
    ring.name = 'aura';
    g.add(ring);
  }
  return g;
}

function buildFromGLTF(gltf, targetHeight) {
  const root = cloneSkinned(gltf.scene);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 1e-6);
  root.scale.setScalar(scale);
  const center = box.getCenter(new THREE.Vector3());
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  const wrap = new THREE.Group();
  wrap.add(root);
  return { object: wrap, root };
}

const labelCache = new Map();
function labelTexture(text, owner) {
  const key = `${text}:${owner}`;
  if (labelCache.has(key)) return labelCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = owner === 0 ? 'rgba(20,50,120,0.85)' : 'rgba(120,20,20,0.85)';
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#f5e6c0';
  ctx.stroke();
  ctx.fillStyle = '#fff8e8';
  ctx.font = 'bold 72px "Hiragino Mincho ProN", "Yu Mincho", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(key, tex);
  return tex;
}

// 駒1体を作る。setId は持ち主のセット(取った駒も自分のセットで表示 = C3)
export function createPiece(piece, setId, { showLabel = true } = {}) {
  const set = MODEL_SETS[setId];
  const { type, promoted, owner } = piece;
  const height = HEIGHT[type] * (promoted ? 1.1 : 1);

  const root = new THREE.Group();
  root.add(createBase(owner));

  const pivot = new THREE.Group(); // アニメーション用(上下動・傾き)
  pivot.name = 'pivot';
  pivot.position.y = 0.1;
  root.add(pivot);

  const file = set.models[modelKey(type, promoted)];
  const gltf = file ? gltfCache.get(`models/${setId}/${file}`) : null;
  let mixer = null;
  let clips = [];
  if (gltf) {
    const { object, root: modelRoot } = buildFromGLTF(gltf, height);
    pivot.add(object);
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(modelRoot);
      clips = gltf.animations;
      const idle = clips.find((c) => /idle/i.test(c.name));
      if (idle) mixer.clipAction(idle).play();
    }
  } else {
    const body = buildPlaceholder(set, type, promoted);
    body.scale.setScalar(height);
    pivot.add(body);
  }

  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(pieceLabel(piece), owner), depthTest: false }));
  label.scale.setScalar(0.34);
  label.position.y = height + 0.35;
  label.renderOrder = 10;
  label.visible = showLabel;
  label.name = 'label';
  root.add(label);

  // 先手は奥(-z)、後手は手前(+z)を向く
  root.rotation.y = owner === 0 ? Math.PI : 0;
  root.userData = {
    piece: { ...piece }, setId, height, mixer, clips,
    idlePhase: Math.random() * Math.PI * 2,
    flying: type === 'R' || (type === 'B' && promoted),
  };
  return root;
}

// GLB にアニメーションクリップがあれば再生する(名前の正規表現で探す)
export function playClip(figure, pattern, { once = true } = {}) {
  const { mixer, clips } = figure.userData;
  if (!mixer) return null;
  const clip = clips.find((c) => pattern.test(c.name));
  if (!clip) return null;
  const action = mixer.clipAction(clip);
  action.reset();
  if (once) {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
  }
  action.play();
  return action;
}

export function disposePiece(figure) {
  figure.removeFromParent();
  figure.userData.mixer?.stopAllAction();
}
