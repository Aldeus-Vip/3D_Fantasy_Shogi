import { SENTE, GOTE, HAND_TYPES, PROMOTABLE } from './constants.js';

// 座標: x = 0..8(左→右 = 9筋→1筋), y = 0..8(上→下 = 一段→九段)
// 先手の「前」は y が減る方向。

const KING_STEPS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const GOLD_STEPS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
const SILVER_STEPS = [[-1, -1], [0, -1], [1, -1], [-1, 1], [1, 1]];
const KNIGHT_STEPS = [[-1, -2], [1, -2]];
const PAWN_STEPS = [[0, -1]];
const ORTHO = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

function movement(piece) {
  const { type, promoted } = piece;
  if (promoted) {
    if (type === 'R') return { steps: DIAG, slides: ORTHO };
    if (type === 'B') return { steps: ORTHO, slides: DIAG };
    return { steps: GOLD_STEPS, slides: [] };
  }
  switch (type) {
    case 'K': return { steps: KING_STEPS, slides: [] };
    case 'G': return { steps: GOLD_STEPS, slides: [] };
    case 'S': return { steps: SILVER_STEPS, slides: [] };
    case 'N': return { steps: KNIGHT_STEPS, slides: [] };
    case 'P': return { steps: PAWN_STEPS, slides: [] };
    case 'L': return { steps: [], slides: [[0, -1]] };
    case 'R': return { steps: [], slides: ORTHO };
    case 'B': return { steps: [], slides: DIAG };
  }
  throw new Error(`unknown piece type ${type}`);
}

const inside = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 9;

export function inPromotionZone(owner, y) {
  return owner === SENTE ? y <= 2 : y >= 6;
}

// これ以上動けない段(行き所のない駒)かどうか
export function mustPromote(type, owner, y) {
  const rank = owner === SENTE ? y : 8 - y; // 敵陣奥からの距離(0 = 最奥)
  if (type === 'P' || type === 'L') return rank === 0;
  if (type === 'N') return rank <= 1;
  return false;
}

function emptyHand() {
  return Object.fromEntries(HAND_TYPES.map((t) => [t, 0]));
}

const SFEN_INITIAL = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b -';

export class Position {
  constructor() {
    this.board = new Array(81).fill(null);
    this.hands = [emptyHand(), emptyHand()];
    this.turn = SENTE;
  }

  static initial() {
    return Position.fromSFEN(SFEN_INITIAL);
  }

  // SFEN の盤面・手番・持ち駒部分を読む(手数は無視)
  static fromSFEN(sfen) {
    const [boardPart, turnPart = 'b', handPart = '-'] = sfen.trim().split(/\s+/);
    const pos = new Position();
    const rows = boardPart.split('/');
    if (rows.length !== 9) throw new Error('invalid sfen board');
    rows.forEach((row, y) => {
      let x = 0;
      let promoted = false;
      for (const ch of row) {
        if (ch === '+') { promoted = true; continue; }
        if (/\d/.test(ch)) { x += Number(ch); continue; }
        const type = ch.toUpperCase();
        const owner = ch === type ? SENTE : GOTE;
        pos.set(x, y, { type, promoted, owner });
        promoted = false;
        x += 1;
      }
    });
    pos.turn = turnPart === 'w' ? GOTE : SENTE;
    if (handPart !== '-') {
      const re = /(\d*)([RBGSNLPrbgsnlp])/g;
      let m;
      while ((m = re.exec(handPart))) {
        const n = m[1] ? Number(m[1]) : 1;
        const type = m[2].toUpperCase();
        const owner = m[2] === type ? SENTE : GOTE;
        pos.hands[owner][type] += n;
      }
    }
    return pos;
  }

  toSFEN() {
    const rows = [];
    for (let y = 0; y < 9; y++) {
      let row = '';
      let empty = 0;
      for (let x = 0; x < 9; x++) {
        const p = this.get(x, y);
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        const ch = p.owner === SENTE ? p.type : p.type.toLowerCase();
        row += (p.promoted ? '+' : '') + ch;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    let hand = '';
    for (const owner of [SENTE, GOTE]) {
      for (const t of HAND_TYPES) {
        const n = this.hands[owner][t];
        if (!n) continue;
        const ch = owner === SENTE ? t : t.toLowerCase();
        hand += (n > 1 ? n : '') + ch;
      }
    }
    return `${rows.join('/')} ${this.turn === SENTE ? 'b' : 'w'} ${hand || '-'}`;
  }

  get(x, y) {
    return this.board[y * 9 + x];
  }

  set(x, y, piece) {
    this.board[y * 9 + x] = piece;
  }

  clone() {
    const pos = new Position();
    pos.board = this.board.map((p) => (p ? { ...p } : null));
    pos.hands = this.hands.map((h) => ({ ...h }));
    pos.turn = this.turn;
    return pos;
  }

  findKing(owner) {
    for (let i = 0; i < 81; i++) {
      const p = this.board[i];
      if (p && p.type === 'K' && p.owner === owner) return [i % 9, Math.floor(i / 9)];
    }
    return null;
  }

  // (x, y) の駒が利いているマス
  targetsFrom(x, y) {
    const piece = this.get(x, y);
    const dir = piece.owner === SENTE ? 1 : -1;
    const { steps, slides } = movement(piece);
    const out = [];
    for (const [dx, dy] of steps) {
      const tx = x + dx * dir;
      const ty = y + dy * dir;
      if (!inside(tx, ty)) continue;
      const t = this.get(tx, ty);
      if (!t || t.owner !== piece.owner) out.push([tx, ty]);
    }
    for (const [dx, dy] of slides) {
      let tx = x + dx * dir;
      let ty = y + dy * dir;
      while (inside(tx, ty)) {
        const t = this.get(tx, ty);
        if (t) {
          if (t.owner !== piece.owner) out.push([tx, ty]);
          break;
        }
        out.push([tx, ty]);
        tx += dx * dir;
        ty += dy * dir;
      }
    }
    return out;
  }

  isAttacked(x, y, byOwner) {
    for (let i = 0; i < 81; i++) {
      const p = this.board[i];
      if (!p || p.owner !== byOwner) continue;
      const targets = this.targetsFrom(i % 9, Math.floor(i / 9));
      if (targets.some(([tx, ty]) => tx === x && ty === y)) return true;
    }
    return false;
  }

  isInCheck(owner) {
    const k = this.findKing(owner);
    return k ? this.isAttacked(k[0], k[1], 1 - owner) : false;
  }

  // 王手放置などを考慮しない手の一覧
  pseudoMoves() {
    const me = this.turn;
    const moves = [];
    for (let i = 0; i < 81; i++) {
      const p = this.board[i];
      if (!p || p.owner !== me) continue;
      const x = i % 9;
      const y = Math.floor(i / 9);
      for (const [tx, ty] of this.targetsFrom(x, y)) {
        const base = { from: [x, y], to: [tx, ty], piece: p.type, drop: false };
        const canPromote = !p.promoted && PROMOTABLE.has(p.type)
          && (inPromotionZone(me, y) || inPromotionZone(me, ty));
        if (canPromote) moves.push({ ...base, promote: true });
        if (!mustPromote(p.type, me, ty) || p.promoted) moves.push({ ...base, promote: false });
      }
    }
    for (const type of HAND_TYPES) {
      if (!this.hands[me][type]) continue;
      for (let y = 0; y < 9; y++) {
        if (mustPromote(type, me, y)) continue;
        for (let x = 0; x < 9; x++) {
          if (this.get(x, y)) continue;
          if (type === 'P' && this.hasUnpromotedPawnOnFile(me, x)) continue; // 二歩
          moves.push({ from: null, to: [x, y], piece: type, drop: true, promote: false });
        }
      }
    }
    return moves;
  }

  hasUnpromotedPawnOnFile(owner, x) {
    for (let y = 0; y < 9; y++) {
      const p = this.get(x, y);
      if (p && p.owner === owner && p.type === 'P' && !p.promoted) return true;
    }
    return false;
  }

  // 合法手の一覧。skipUchifuzume は打ち歩詰め判定の内部で使う。
  legalMoves({ skipUchifuzume = false } = {}) {
    const me = this.turn;
    return this.pseudoMoves().filter((m) => {
      const next = this.applyMove(m);
      if (next.isInCheck(me)) return false;
      if (!skipUchifuzume && m.drop && m.piece === 'P' && next.isInCheck(1 - me)
        && next.legalMoves({ skipUchifuzume: true }).length === 0) {
        return false; // 打ち歩詰め
      }
      return true;
    });
  }

  // 手を指した後の新しい局面を返す(this は変更しない)
  applyMove(move) {
    const next = this.clone();
    const me = this.turn;
    const [tx, ty] = move.to;
    if (move.drop) {
      next.hands[me][move.piece] -= 1;
      next.set(tx, ty, { type: move.piece, promoted: false, owner: me });
    } else {
      const [fx, fy] = move.from;
      const moving = next.get(fx, fy);
      const captured = next.get(tx, ty);
      if (captured) next.hands[me][captured.type] += 1;
      next.set(fx, fy, null);
      next.set(tx, ty, { ...moving, promoted: moving.promoted || move.promote });
    }
    next.turn = 1 - me;
    return next;
  }

  // 入玉宣言法(27点法)の条件を満たしているか
  canDeclareWin() {
    const me = this.turn;
    const king = this.findKing(me);
    if (!king || !inPromotionZone(me, king[1])) return false;
    if (this.isInCheck(me)) return false;
    let count = 0;
    let points = 0;
    for (let i = 0; i < 81; i++) {
      const p = this.board[i];
      if (!p || p.owner !== me || p.type === 'K') continue;
      if (!inPromotionZone(me, Math.floor(i / 9))) continue;
      count += 1;
      points += p.type === 'R' || p.type === 'B' ? 5 : 1;
    }
    for (const t of HAND_TYPES) {
      points += this.hands[me][t] * (t === 'R' || t === 'B' ? 5 : 1);
    }
    return count >= 10 && points >= (me === SENTE ? 28 : 27);
  }
}
