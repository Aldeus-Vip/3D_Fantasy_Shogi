// 持ち時間。mode: 'none' | 'sudden'(切れ負け)| 'byoyomi'(持ち時間 + 秒読み)
export class Clock {
  constructor({ mode = 'none', mainSeconds = 600, byoyomi = 30 } = {}) {
    this.mode = mode;
    this.byoyomi = byoyomi;
    this.remain = [mainSeconds, mainSeconds];
    this.inByoyomi = [false, false];
    this.byoyomiLeft = [byoyomi, byoyomi];
    this.running = null; // 計測中の手番
    this.startedAt = 0;
    this.onTimeout = null;
  }

  get enabled() {
    return this.mode !== 'none';
  }

  start(owner) {
    this.running = owner;
    this.startedAt = performance.now();
    this.moveUsed = 0;
    this.byoyomiLeft[owner] = this.byoyomi;
  }

  // 計測を止め、この手の消費秒数を返す
  stop() {
    if (this.running === null) return this.moveUsed ?? 0;
    this.tick();
    this.running = null;
    return this.moveUsed;
  }

  // 経過時間を反映。切れたら onTimeout を呼ぶ。
  tick() {
    const owner = this.running;
    if (owner === null) return 0;
    const now = performance.now();
    const used = (now - this.startedAt) / 1000;
    this.startedAt = now;
    this.moveUsed += used;
    if (!this.enabled) return used;
    if (!this.inByoyomi[owner]) {
      this.remain[owner] -= used;
      if (this.remain[owner] <= 0) {
        if (this.mode === 'byoyomi') {
          this.inByoyomi[owner] = true;
          this.byoyomiLeft[owner] += this.remain[owner];
          this.remain[owner] = 0;
        } else {
          this.remain[owner] = 0;
          this.running = null;
          this.onTimeout?.(owner);
        }
      }
    } else {
      this.byoyomiLeft[owner] -= used;
    }
    if (this.inByoyomi[owner] && this.byoyomiLeft[owner] <= 0) {
      this.byoyomiLeft[owner] = 0;
      this.running = null;
      this.onTimeout?.(owner);
    }
    return used;
  }

  display(owner, byoyomiLabel = '秒読み') {
    if (!this.enabled) return '';
    const fmt = (s) => {
      const v = Math.max(0, Math.ceil(s));
      return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
    };
    if (this.inByoyomi[owner]) return `${byoyomiLabel} ${Math.max(0, Math.ceil(this.byoyomiLeft[owner]))}`;
    return fmt(this.remain[owner]);
  }
}
