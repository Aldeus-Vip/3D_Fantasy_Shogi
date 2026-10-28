// Promise ベースの簡易トゥイーン。update(dt) を毎フレーム呼ぶ。
export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  back: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
};

export class Animator {
  constructor() {
    this.tweens = new Set();
    this.speed = 1;
    this.skipping = false; // true の間は全トゥイーンが即完了する
  }

  tween(duration, onUpdate, easing = ease.inOut) {
    return new Promise((resolve) => {
      const tw = { t: 0, duration: Math.max(duration, 1e-6), onUpdate, easing, resolve };
      if (this.skipping) {
        onUpdate(1, 1);
        resolve();
        return;
      }
      this.tweens.add(tw);
    });
  }

  wait(duration) {
    return this.tween(duration, () => {});
  }

  get busy() {
    return this.tweens.size > 0;
  }

  // 実行中の演出をすべて最後まで飛ばす
  skip() {
    this.skipping = true;
    this.finishAll();
  }

  endSkip() {
    this.skipping = false;
  }

  finishAll() {
    for (const tw of [...this.tweens]) {
      this.tweens.delete(tw);
      tw.onUpdate(1, 1);
      tw.resolve();
    }
  }

  update(dt) {
    if (this.skipping) {
      this.finishAll();
      return;
    }
    for (const tw of [...this.tweens]) {
      tw.t = Math.min(1, tw.t + (dt * this.speed) / tw.duration);
      tw.onUpdate(tw.easing(tw.t), tw.t);
      if (tw.t >= 1) {
        this.tweens.delete(tw);
        tw.resolve();
      }
    }
  }
}
