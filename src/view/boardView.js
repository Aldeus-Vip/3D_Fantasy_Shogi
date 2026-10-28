import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HAND_TYPES } from '../shogi/constants.js';
import { MODEL_SETS } from '../sets/index.js';
import { Animator, ease } from './animator.js';
import { Effects } from './effects.js';
import { createPiece, disposePiece, playClip } from './pieceFactory.js';

const key = ([x, y]) => `${x},${y}`;
const toWorld = ([x, y]) => new THREE.Vector3(x - 4, 0, y - 4);
const HAND_SCALE = 0.72;

function handSlotPosition(owner, type) {
  const i = HAND_TYPES.indexOf(type);
  const col = i % 2;
  const row = Math.floor(i / 2);
  const p = new THREE.Vector3(6.1 + col * 1.05, 0.25, 0.9 + row * 1.0);
  return owner === 0 ? p : p.multiplyScalar(-1).setY(0.25);
}

function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class BoardView {
  constructor(container) {
    this.container = container;
    this.animator = new Animator();
    this.boardMeshes = new Map(); // "x,y" → 駒の Object3D
    this.handMeshes = []; // 持ち駒の表示
    this.setIds = ['dragon', 'undead'];
    this.showLabels = true;
    this.shake = 0;
    this.onCameraShake = null;

    this.initRenderer();
    this.initScene();
    this.effects = new Effects(this.scene, this.animator);
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
    window.addEventListener('resize', () => this.resize());
  }

  initRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(r.domElement);
    this.renderer = r;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 12.5, 10.5);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.target.set(0, 0, 0.6);
    this.controls.enableDamping = true;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 26;
    this.controls.maxPolarAngle = 1.3;
    this.resize();
  }

  initScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0b16);
    scene.fog = new THREE.Fog(0x0d0b16, 22, 45);
    this.scene = scene;

    scene.add(new THREE.HemisphereLight(0xbfc8ff, 0x2a1a10, 0.9));
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.2);
    sun.position.set(5, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
    scene.add(sun);
    const rimA = new THREE.PointLight(0x4d7bff, 30, 20);
    rimA.position.set(-8, 4, 6);
    const rimB = new THREE.PointLight(0xff4d6b, 30, 20);
    rimB.position.set(8, 4, -6);
    scene.add(rimA, rimB);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.62;
    ground.receiveShadow = true;
    scene.add(ground);

    // 盤
    const board = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.6, 9.6),
      new THREE.MeshStandardMaterial({ color: 0xd9a95b, roughness: 0.55 }));
    board.position.y = -0.3;
    board.receiveShadow = true;
    scene.add(board);

    const lines = [];
    for (let i = 0; i <= 9; i++) {
      const v = i - 4.5;
      lines.push(-4.5, 0.002, v, 4.5, 0.002, v, v, 0.002, -4.5, v, 0.002, 4.5);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    scene.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x2a1a08 })));
    for (const sx of [-1.5, 1.5]) {
      for (const sz of [-1.5, 1.5]) {
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), new THREE.MeshBasicMaterial({ color: 0x2a1a08 }));
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(sx, 0.003, sz);
        scene.add(dot);
      }
    }

    // マス(クリック判定とハイライト)
    this.tiles = [];
    const tileGeo = new THREE.PlaneGeometry(0.96, 0.96);
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const t = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
        t.rotation.x = -Math.PI / 2;
        t.position.copy(toWorld([x, y])).setY(0.005);
        t.userData = { pick: { kind: 'square', x, y } };
        scene.add(t);
        this.tiles.push(t);
      }
    }

    // 駒台
    this.handSlots = [];
    for (const owner of [0, 1]) {
      const center = handSlotPosition(owner, 'S').setY(-0.15);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 4.2), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.6 }));
      stand.position.copy(center).add(new THREE.Vector3(owner === 0 ? 0.52 : -0.52, 0, 0));
      stand.receiveShadow = true;
      scene.add(stand);
      for (const type of HAND_TYPES) {
        const slot = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24),
          new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0, depthWrite: false }));
        slot.rotation.x = -Math.PI / 2;
        slot.position.copy(handSlotPosition(owner, type)).setY(0.02);
        slot.userData = { pick: { kind: 'hand', owner, type } };
        scene.add(slot);
        this.handSlots.push(slot);
      }
    }

    this.raycaster = new THREE.Raycaster();
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;
    this.animator.update(dt);
    this.effects.update(dt);
    for (const fig of [...this.boardMeshes.values(), ...this.handMeshes]) {
      fig.userData.mixer?.update(dt);
      if (fig.userData.animating) continue;
      const pivot = fig.getObjectByName('pivot');
      const bob = Math.sin(time * 2 + fig.userData.idlePhase);
      pivot.position.y = fig.userData.flying ? 0.25 + bob * 0.06 : 0.1 + bob * 0.012;
    }
    this.controls.update();
    const saved = this.camera.position.clone();
    if (this.shake > 0) {
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0));
      this.shake = Math.max(0, this.shake - dt * 1.2);
    }
    this.renderer.render(this.scene, this.camera);
    this.camera.position.copy(saved);
  }

  // 視点を先手側/後手側に切り替える
  flipCamera(toOwner) {
    const from = this.camera.position.clone();
    const target = this.controls.target.clone();
    const dest = new THREE.Vector3(0, 12.5, toOwner === 0 ? 10.5 : -10.5);
    const destTarget = new THREE.Vector3(0, 0, toOwner === 0 ? 0.6 : -0.6);
    const a0 = Math.atan2(from.x, from.z);
    const da = shortestAngle(a0, Math.atan2(dest.x, dest.z));
    const r0 = Math.hypot(from.x, from.z);
    return new Promise((resolve) => {
      const step = (k) => {
        const a = a0 + da * k;
        const r = r0 + (Math.hypot(dest.x, dest.z) - r0) * k;
        this.camera.position.set(Math.sin(a) * r, from.y + (dest.y - from.y) * k, Math.cos(a) * r);
        this.controls.target.lerpVectors(target, destTarget, k);
      };
      // 視点移動は演出スキップの影響を受けないよう独自に進める
      const start = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / 800);
        step(ease.inOut(t));
        if (t < 1) requestAnimationFrame(tick); else resolve();
      };
      tick();
    });
  }

  pick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const objs = [...this.boardMeshes.values(), ...this.handMeshes, ...this.tiles, ...this.handSlots];
    for (const hit of this.raycaster.intersectObjects(objs, true)) {
      let o = hit.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o) return o.userData.pick;
    }
    return null;
  }

  setShowLabels(show) {
    this.showLabels = show;
    for (const fig of [...this.boardMeshes.values(), ...this.handMeshes]) {
      const label = fig.getObjectByName('label');
      if (label && !fig.userData.isHand) label.visible = show;
    }
  }

  // ---------- 局面との同期 ----------

  makeFigure(piece, square) {
    const fig = createPiece(piece, this.setIds[piece.owner], { showLabel: this.showLabels });
    fig.position.copy(toWorld(square));
    fig.userData.pick = { kind: 'square', x: square[0], y: square[1] };
    this.scene.add(fig);
    return fig;
  }

  // 局面と表示のずれを直す(新規対局・待った・セット変更・演出後)
  sync(position) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const k = key([x, y]);
        const p = position.get(x, y);
        const fig = this.boardMeshes.get(k);
        const d = fig?.userData;
        const same = fig && p && d.piece.type === p.type && d.piece.promoted === p.promoted
          && d.piece.owner === p.owner && d.setId === this.setIds[p.owner];
        if (same) {
          fig.position.copy(toWorld([x, y]));
          fig.rotation.y = p.owner === 0 ? Math.PI : 0;
          fig.scale.setScalar(1);
          fig.userData.pick = { kind: 'square', x, y };
          continue;
        }
        if (fig) {
          disposePiece(fig);
          this.boardMeshes.delete(k);
        }
        if (p) this.boardMeshes.set(k, this.makeFigure(p, [x, y]));
      }
    }
    this.syncHands(position);
  }

  syncHands(position) {
    for (const fig of this.handMeshes) disposePiece(fig);
    this.handMeshes = [];
    for (const owner of [0, 1]) {
      for (const type of HAND_TYPES) {
        const n = position.hands[owner][type];
        if (!n) continue;
        const fig = createPiece({ type, promoted: false, owner }, this.setIds[owner], { showLabel: true });
        fig.scale.setScalar(HAND_SCALE);
        fig.position.copy(handSlotPosition(owner, type)).setY(0);
        fig.userData.pick = { kind: 'hand', owner, type };
        fig.userData.isHand = true;
        const label = fig.getObjectByName('label');
        label.material = label.material.clone();
        label.material.map = countTexture(type, owner, n);
        this.scene.add(fig);
        this.handMeshes.push(fig);
      }
    }
  }

  // ---------- ハイライト ----------

  setHighlights({ selected = null, targets = [], last = [], check = null, handSelected = null } = {}) {
    for (const t of this.tiles) {
      t.material.opacity = 0;
    }
    const paint = (sq, color, opacity) => {
      const t = this.tiles[sq[1] * 9 + sq[0]];
      t.material.color.setHex(color);
      t.material.opacity = opacity;
    };
    last.forEach((sq) => paint(sq, 0xff9a3d, 0.28));
    if (check) paint(check, 0xff2020, 0.5);
    targets.forEach((sq) => paint(sq, 0x3dff8a, 0.42));
    if (selected) paint(selected, 0xffe066, 0.55);
    for (const s of this.handSlots) {
      const p = s.userData.pick;
      s.material.opacity = handSelected && handSelected.owner === p.owner && handSelected.type === p.type ? 0.6 : 0;
    }
  }

  // ---------- 演出 ----------

  async face(fig, angle, duration) {
    const start = fig.rotation.y;
    const d = shortestAngle(start, angle);
    if (Math.abs(d) < 0.01) return;
    await this.animator.tween(duration, (k) => { fig.rotation.y = start + d * k; });
  }

  async travel(fig, from, to, { arc = 0.3, speed = 1 } = {}) {
    const dist = from.distanceTo(to);
    const duration = Math.min(0.25 + dist * 0.12, 0.9) / speed;
    playClip(fig, /walk|run|fly/i, { once: false });
    await this.animator.tween(duration, (k) => {
      fig.position.lerpVectors(from, to, k);
      fig.position.y = Math.sin(k * Math.PI) * arc;
    });
  }

  async playMove(record, level) {
    const { move, after } = record;
    if (level === 'none') {
      this.sync(after);
      return;
    }
    const simple = level === 'simple';
    if (move.drop) {
      await this.playDrop(record, simple);
    } else {
      await this.playBoardMove(record, simple);
    }
    this.sync(after);
  }

  async playDrop({ move, after }, simple) {
    const owner = 1 - after.turn;
    const setColor = MODEL_SETS[this.setIds[owner]].effectColor;
    this.syncHands(after);
    const dest = toWorld(move.to);
    const fig = this.makeFigure({ type: move.piece, promoted: false, owner }, move.to);
    this.boardMeshes.set(key(move.to), fig);
    fig.userData.animating = true;
    if (simple) {
      fig.scale.setScalar(0.01);
      await Promise.all([
        this.animator.tween(0.3, (k) => fig.scale.setScalar(Math.max(k, 0.01)), ease.back),
        this.effects.flash(dest.clone().setY(0.4), setColor, { radius: 0.5, duration: 0.3 }),
      ]);
    } else {
      // 召喚: 魔法陣 → 光の柱 → 上から降臨
      fig.visible = false;
      const circle = this.effects.magicCircle(dest, setColor);
      await circle.opened;
      this.effects.pillar(dest, setColor);
      fig.visible = true;
      fig.scale.setScalar(0.01);
      playClip(fig, /spawn|appear|land/i);
      await this.animator.tween(0.5, (k) => {
        fig.scale.setScalar(Math.max(k, 0.01));
        fig.position.y = (1 - k) * 1.6;
      }, ease.out);
      this.effects.shockwave(dest, setColor);
      this.effects.burst(dest.clone().setY(0.2), setColor, { count: 40, spread: 1.2, up: 1.5 });
      await circle.close();
    }
    fig.userData.animating = false;
  }

  async playBoardMove({ move, before, after }, simple) {
    const owner = before.turn;
    const fig = this.boardMeshes.get(key(move.from));
    if (!fig) return;
    const victim = move.captured ? this.boardMeshes.get(key(move.to)) : null;
    const from = toWorld(move.from);
    const to = toWorld(move.to);
    const dir = to.clone().sub(from);
    const heading = Math.atan2(dir.x, dir.z);
    const forward = owner === 0 ? Math.PI : 0;
    const piece = before.get(move.from[0], move.from[1]);
    const arc = piece.type === 'N' && !piece.promoted ? 1.3 : (fig.userData.flying ? 0.5 : 0.3);
    const speed = simple ? 1.8 : 1;
    fig.userData.animating = true;
    this.boardMeshes.delete(key(move.from));

    if (!simple) await this.face(fig, heading, 0.18);

    if (victim) {
      victim.userData.animating = true;
      const near = to.clone().sub(dir.clone().normalize().multiplyScalar(0.6));
      await this.travel(fig, from, near, { arc, speed });
      await this.attack(fig, victim, owner, simple);
      this.boardMeshes.delete(key(move.to));
      await this.travel(fig, near, to, { arc: 0.1, speed: speed * 1.5 });
    } else {
      await this.travel(fig, from, to, { arc, speed });
    }
    this.boardMeshes.set(key(move.to), fig);

    if (!simple) await this.face(fig, forward, 0.18);
    fig.rotation.y = forward;

    if (move.promote) await this.evolve(fig, after.get(move.to[0], move.to[1]), move.to, simple);
    else fig.userData.animating = false;

    if (move.captured) this.syncHands(after);
  }

  async attack(fig, victim, owner, simple) {
    const pivot = fig.getObjectByName('pivot');
    const hitPos = victim.position.clone().setY(0.6);
    const myColor = MODEL_SETS[this.setIds[owner]].effectColor;
    const victimSet = MODEL_SETS[victim.userData.setId];
    if (simple) {
      await this.effects.flash(hitPos, 0xffffff, { radius: 0.6, duration: 0.2 });
    } else {
      playClip(fig, /attack/i);
      // 溜め → 突進
      await this.animator.tween(0.18, (k) => { pivot.rotation.x = -0.35 * k; });
      await this.animator.tween(0.1, (k) => { pivot.rotation.x = -0.35 + 0.85 * k; pivot.position.z = 0.25 * k; }, ease.in);
      playClip(victim, /hit|damage/i);
      this.shake = 0.18;
      this.effects.flash(hitPos, 0xffffff, { radius: 0.9 });
      this.effects.burst(hitPos, myColor, { count: 50, spread: 2.2, up: 2 });
      this.effects.shockwave(victim.position, myColor);
      await this.animator.tween(0.2, (k) => { pivot.rotation.x = 0.5 * (1 - k); pivot.position.z = 0.25 * (1 - k); });
    }
    // 相手駒の消滅
    playClip(victim, /death|die/i);
    const base = victim.position.clone();
    await this.animator.tween(simple ? 0.2 : 0.45, (k, t) => {
      victim.position.x = base.x + (simple ? 0 : Math.sin(t * 60) * 0.04 * (1 - k));
      victim.scale.setScalar(1 - k);
      victim.position.y = k * 0.4;
    });
    if (!simple) this.effects.burst(base.clone().setY(0.3), victimSet.effectColor, { count: 70, spread: 1.4, up: 3, size: 0.1 });
    disposePiece(victim);
  }

  // 成り: 金の螺旋 → 閃光 → 成駒モデルに入れ替え
  async evolve(fig, promotedPiece, square, simple) {
    const pos = fig.position.clone();
    if (!simple) {
      await this.effects.spiral(pos, 0xffd34d);
    }
    this.effects.flash(pos.clone().setY(0.6), 0xffe9a0, { radius: simple ? 0.6 : 1.2 });
    disposePiece(fig);
    const next = this.makeFigure(promotedPiece, square);
    next.userData.animating = true;
    this.boardMeshes.set(key(square), next);
    await this.animator.tween(simple ? 0.2 : 0.4, (k) => next.scale.setScalar(1.35 - 0.35 * k), ease.out);
    if (!simple) this.effects.burst(pos.clone().setY(0.5), 0xffd34d, { count: 50, spread: 1.6, up: 2.5 });
    next.userData.animating = false;
  }

  async playCheck(kingSquare, level) {
    if (level === 'none' || !kingSquare) return;
    const pos = toWorld(kingSquare);
    if (level === 'full') this.shake = 0.1;
    await this.effects.checkPulse(pos);
  }
}

const countCache = new Map();
function countTexture(type, owner, n) {
  const k = `${type}:${owner}:${n}`;
  if (countCache.has(k)) return countCache.get(k);
  const LABEL = { R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩' };
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = owner === 0 ? 'rgba(20,50,120,0.85)' : 'rgba(120,20,20,0.85)';
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f5e6c0';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#fff8e8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${n > 1 ? 56 : 72}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
  ctx.fillText(LABEL[type], 64, n > 1 ? 54 : 68);
  if (n > 1) {
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(`×${n}`, 64, 100);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  countCache.set(k, tex);
  return tex;
}
