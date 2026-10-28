import { Position } from './position.js';

// 対局の進行(棋譜・千日手・終局判定)を管理する。画面とは独立。
export class Game {
  constructor(start = Position.initial()) {
    this.position = start;
    this.records = []; // { move, before, after, givesCheck, seconds }
    this.keys = [start.toSFEN()];
    this.result = null; // { winner: 0|1|null, reason }
  }

  get turn() {
    return this.position.turn;
  }

  get lastMove() {
    return this.records.length ? this.records[this.records.length - 1].move : null;
  }

  legalMoves() {
    return this.result ? [] : this.position.legalMoves();
  }

  // 合法手なら指して記録を返す。不正なら null。
  play(move, seconds = 0) {
    if (this.result) return null;
    const legal = this.position.legalMoves().find((m) => sameMove(m, move));
    if (!legal) return null;
    const before = this.position;
    const captured = legal.drop ? null : before.get(legal.to[0], legal.to[1]);
    const after = before.applyMove(legal);
    const givesCheck = after.isInCheck(after.turn);
    const record = { move: { ...legal, captured }, before, after, givesCheck, seconds };
    this.records.push(record);
    this.position = after;
    this.keys.push(after.toSFEN());
    this.result = this.judge();
    return record;
  }

  undo() {
    if (!this.records.length) return null;
    const record = this.records.pop();
    this.keys.pop();
    this.position = record.before;
    this.result = null;
    return record;
  }

  resign() {
    this.result = { winner: 1 - this.turn, reason: 'resign' };
    return this.result;
  }

  timeout(owner) {
    this.result = { winner: 1 - owner, reason: 'timeout' };
    return this.result;
  }

  // 入玉宣言。条件を満たせば宣言側の勝ち、満たさなければ負け。
  declareWin() {
    const me = this.turn;
    const ok = this.position.canDeclareWin();
    this.result = { winner: ok ? me : 1 - me, reason: ok ? 'declare' : 'declareFail' };
    return this.result;
  }

  judge() {
    const pos = this.position;
    if (pos.legalMoves().length === 0) {
      return { winner: 1 - pos.turn, reason: 'checkmate' };
    }
    const key = this.keys[this.keys.length - 1];
    const hits = [];
    this.keys.forEach((k, i) => { if (k === key) hits.push(i); });
    if (hits.length >= 4) {
      // 同一局面4回目。区間内の一方の手がすべて王手なら、その側の反則負け。
      const from = hits[0];
      const span = this.records.slice(from);
      for (const owner of [0, 1]) {
        const mine = span.filter((r) => r.before.turn === owner);
        if (mine.length && mine.every((r) => r.givesCheck)) {
          return { winner: 1 - owner, reason: 'perpetualCheck' };
        }
      }
      return { winner: null, reason: 'sennichite' };
    }
    return null;
  }
}

export function sameMove(a, b) {
  if (a.drop !== b.drop) return false;
  if (a.to[0] !== b.to[0] || a.to[1] !== b.to[1]) return false;
  if (a.drop) return a.piece === b.piece;
  return a.from[0] === b.from[0] && a.from[1] === b.from[1] && !!a.promote === !!b.promote;
}
