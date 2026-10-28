import * as THREE from 'three';
import { ease } from './animator.js';

let circleTexture = null;
function magicCircleTexture() {
  if (circleTexture) return circleTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.translate(128, 128);
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 4;
  for (const r of [120, 100, 54]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 六芒星
  ctx.lineWidth = 3;
  for (const off of [0, Math.PI / 3]) {
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = off + (i / 3) * Math.PI * 2 - Math.PI / 2;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 100, Math.sin(a) * 100);
    }
    ctx.stroke();
  }
  // ルーン文字風の記号
  ctx.font = 'bold 18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
  for (let i = 0; i < runes.length; i++) {
    const a = (i / runes.length) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.fillText(runes[i], 0, -110);
    ctx.restore();
  }
  circleTexture = new THREE.CanvasTexture(c);
  return circleTexture;
}

let dotTexture = null;
function softDot() {
  if (dotTexture) return dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  dotTexture = new THREE.CanvasTexture(c);
  return dotTexture;
}

function additive(color, opacity = 1, extra = {}) {
  return { color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, ...extra };
}

export class Effects {
  constructor(scene, animator) {
    this.scene = scene;
    this.animator = animator;
    this.spinners = new Set(); // 演出の待ち時間と無関係に回り続けるもの
  }

  update(dt) {
    for (const m of this.spinners) m.rotation.z += dt * 1.5;
  }

  add(obj) {
    this.scene.add(obj);
    return obj;
  }

  remove(obj) {
    obj.removeFromParent();
    obj.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose(); // テクスチャは共有なので破棄しない
    });
  }

  // 粒子の飛散。spread=横の広がり, up=上向き速度
  burst(pos, color, { count = 60, spread = 2, up = 2.5, size = 0.12, duration = 0.9, gravity = 4 } = {}) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const v = [];
    for (let i = 0; i < count; i++) {
      p.set([pos.x, pos.y, pos.z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * spread;
      v.push([Math.cos(a) * s, Math.random() * up, Math.sin(a) * s]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const material = new THREE.PointsMaterial({ size, map: softDot(), ...additive(color) });
    const pts = this.add(new THREE.Points(geo, material));
    return this.animator.tween(duration, (_, t) => {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] = pos.x + v[i][0] * t;
        arr[i * 3 + 1] = pos.y + v[i][1] * t - 0.5 * gravity * t * t;
        arr[i * 3 + 2] = pos.z + v[i][2] * t;
      }
      geo.attributes.position.needsUpdate = true;
      material.opacity = 1 - t;
    }, ease.linear).then(() => this.remove(pts));
  }

  // 光の玉が一瞬広がる(打撃・閃光)
  flash(pos, color, { radius = 0.6, duration = 0.35 } = {}) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial(additive(color)));
    m.position.copy(pos);
    this.add(m);
    return this.animator.tween(duration, (k) => {
      m.scale.setScalar(0.1 + radius * k);
      m.material.opacity = 1 - k;
    }, ease.out).then(() => this.remove(m));
  }

  // 地面を走る衝撃波リング
  shockwave(pos, color, { radius = 1.2, duration = 0.5 } = {}) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial(additive(color, 1, { side: THREE.DoubleSide })));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, 0.03, pos.z);
    this.add(m);
    return this.animator.tween(duration, (k) => {
      m.scale.setScalar(0.1 + radius * k);
      m.material.opacity = 1 - k;
    }, ease.out).then(() => this.remove(m));
  }

  // 召喚用の魔法陣。close() を呼ぶまで回り続ける。
  magicCircle(pos, color, { size = 1.1 } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial(additive(color, 0, { map: magicCircleTexture(), side: THREE.DoubleSide })));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, 0.04, pos.z);
    this.add(m);
    this.spinners.add(m);
    const open = this.animator.tween(0.35, (k) => {
      m.material.opacity = k;
      m.scale.setScalar(0.3 + 0.7 * k);
    }, ease.out);
    return {
      opened: open,
      close: () => this.animator.tween(0.4, (k) => { m.material.opacity = 1 - k; }).then(() => {
        this.spinners.delete(m);
        this.remove(m);
      }),
    };
  }

  // 光の柱
  pillar(pos, color, { height = 3, duration = 0.8 } = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, height, 24, 1, true),
      new THREE.MeshBasicMaterial(additive(color, 0, { side: THREE.DoubleSide })));
    m.position.set(pos.x, height / 2, pos.z);
    this.add(m);
    return this.animator.tween(duration, (_, t) => {
      const k = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      m.material.opacity = 0.7 * k;
      m.scale.set(0.5 + 0.5 * k, 1, 0.5 + 0.5 * k);
    }, ease.linear).then(() => this.remove(m));
  }

  // 螺旋状に昇る光の粒(成り)
  spiral(pos, color, { count = 40, duration = 1.0, height = 1.6 } = {}) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const material = new THREE.PointsMaterial({ size: 0.14, map: softDot(), ...additive(color) });
    const pts = this.add(new THREE.Points(geo, material));
    return this.animator.tween(duration, (_, t) => {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        const f = i / count;
        const a = f * Math.PI * 6 + t * 8;
        const r = 0.45 * (1 - t * 0.6);
        arr[i * 3] = pos.x + Math.cos(a) * r;
        arr[i * 3 + 1] = (f * height) * Math.min(1, t * 2);
        arr[i * 3 + 2] = pos.z + Math.sin(a) * r;
      }
      geo.attributes.position.needsUpdate = true;
      material.opacity = t < 0.8 ? 1 : (1 - t) / 0.2;
    }, ease.linear).then(() => this.remove(pts));
  }

  // 王手: 玉の足元で赤く脈打つ
  checkPulse(pos) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 40),
      new THREE.MeshBasicMaterial(additive(0xff2020, 0, { side: THREE.DoubleSide })));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, 0.05, pos.z);
    this.add(m);
    return this.animator.tween(1.2, (_, t) => {
      const k = Math.sin(t * Math.PI * 3);
      m.material.opacity = Math.abs(k);
      m.scale.setScalar(1 + 0.3 * Math.abs(k));
    }, ease.linear).then(() => this.remove(m));
  }
}
