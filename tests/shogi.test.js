import { describe, it, expect } from 'vitest';
import { Position } from '../src/shogi/position.js';
import { Game } from '../src/shogi/game.js';
import { toKIF } from '../src/shogi/kif.js';
import { SENTE, GOTE } from '../src/shogi/constants.js';

// 筋・段(1始まり) → 内部座標
const sq = (file, rank) => [9 - file, rank - 1];
const mv = (f1, r1, f2, r2, promote = false) => ({ from: sq(f1, r1), to: sq(f2, r2), drop: false, promote });
const drop = (piece, f, r) => ({ from: null, to: sq(f, r), piece, drop: true, promote: false });

describe('Position', () => {
  it('初期局面の合法手は30手', () => {
    expect(Position.initial().legalMoves()).toHaveLength(30);
  });

  it('SFEN を往復できる', () => {
    const sfen = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b -';
    expect(Position.initial().toSFEN()).toBe(sfen);
    const s2 = '4k4/9/9/9/9/9/9/9/4K4 w 2Pr';
    expect(Position.fromSFEN(s2).toSFEN()).toBe(s2);
  });

  it('二歩は打てない', () => {
    const pos = Position.fromSFEN('4k4/9/9/9/9/9/4P4/9/4K4 b P');
    const drops = pos.legalMoves().filter((m) => m.drop && m.piece === 'P');
    expect(drops.some((m) => m.to[0] === sq(5, 5)[0])).toBe(false);
    expect(drops.some((m) => m.to[0] === sq(4, 5)[0])).toBe(true);
  });

  it('行き所のない駒は打てない・成りが強制される', () => {
    const pos = Position.fromSFEN('4k4/9/9/9/9/9/9/9/K8 b PLN');
    const drops = pos.legalMoves().filter((m) => m.drop);
    expect(drops.some((m) => m.piece === 'P' && m.to[1] === 0)).toBe(false);
    expect(drops.some((m) => m.piece === 'L' && m.to[1] === 0)).toBe(false);
    expect(drops.some((m) => m.piece === 'N' && m.to[1] <= 1)).toBe(false);

    const p2 = Position.fromSFEN('k8/4P4/9/9/9/9/9/9/8K b -');
    const pawn = p2.legalMoves().filter((m) => m.piece === 'P');
    expect(pawn).toHaveLength(1);
    expect(pawn[0].promote).toBe(true);
  });

  it('打ち歩詰めは反則', () => {
    // 後手玉 1一・後手桂 2一、先手金 2三 … 1二歩打で詰むので打てない
    const pos = Position.fromSFEN('7nk/9/7G1/9/9/9/9/9/K8 b P');
    const uchi = pos.legalMoves().find((m) => m.drop && m.piece === 'P'
      && m.to[0] === sq(1, 2)[0] && m.to[1] === sq(1, 2)[1]);
    expect(uchi).toBeUndefined();
  });

  it('突き歩詰めは反則ではない', () => {
    const pos = Position.fromSFEN('7nk/9/7GP/9/9/9/9/9/K8 b -');
    const g = new Game(pos);
    expect(g.play(mv(1, 3, 1, 2, false))).not.toBeNull();
    expect(g.result).toEqual({ winner: SENTE, reason: 'checkmate' });
  });

  it('王手を放置する手は指せない', () => {
    const pos = Position.fromSFEN('4k4/9/9/9/4r4/9/9/9/3GK4 b -');
    const moves = pos.legalMoves();
    expect(moves.every((m) => !(m.piece === 'G' && m.to[0] === sq(6, 8)[0] && m.to[1] === sq(6, 8)[1]))).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('入玉宣言(27点法)', () => {
    const ok = Position.fromSFEN('LLLLKSSSS/GGNNNPPPP/9/9/9/9/9/9/4k4 b RBP');
    expect(ok.canDeclareWin()).toBe(true);
    const ng = Position.fromSFEN('4K4/9/9/9/9/9/9/9/4k4 b RB');
    expect(ng.canDeclareWin()).toBe(false);
  });
});

describe('Game', () => {
  it('頭金で詰み', () => {
    const g = new Game(Position.fromSFEN('4k4/9/4P4/9/9/9/9/9/4K4 b G'));
    g.play(drop('G', 5, 2));
    expect(g.result).toEqual({ winner: SENTE, reason: 'checkmate' });
  });

  it('同一局面4回で千日手', () => {
    const g = new Game();
    const cycle = [mv(2, 8, 3, 8), mv(8, 2, 7, 2), mv(3, 8, 2, 8), mv(7, 2, 8, 2)];
    for (let i = 0; i < 3; i++) cycle.forEach((m) => g.play(m));
    expect(g.result).toEqual({ winner: null, reason: 'sennichite' });
  });

  it('連続王手の千日手は王手側の負け', () => {
    // 先手飛車が 5筋/4筋 を往復して王手し続け、後手玉も 5一/4一 を往復する
    const g = new Game(Position.fromSFEN('4k4/9/9/9/9/9/9/9/K4R3 b -'));
    const cycle = [mv(4, 9, 5, 9), mv(5, 1, 4, 1), mv(5, 9, 4, 9), mv(4, 1, 5, 1)];
    for (let i = 0; i < 3; i++) cycle.forEach((m) => g.play(m));
    expect(g.result).toEqual({ winner: GOTE, reason: 'perpetualCheck' });
  });

  it('待ったで1手戻せる', () => {
    const g = new Game();
    g.play(mv(7, 7, 7, 6));
    g.undo();
    expect(g.position.toSFEN()).toBe(Position.initial().toSFEN());
  });

  it('KIF を出力できる', () => {
    const g = new Game();
    g.play(mv(7, 7, 7, 6), 3);
    g.play(mv(3, 3, 3, 4), 5);
    g.play(mv(8, 8, 2, 2, true), 2);
    g.play(mv(3, 1, 2, 2), 1);
    g.resign();
    const kif = toKIF(g, { startedAt: new Date(2026, 9, 28, 12, 0, 0) });
    expect(kif).toContain('   1 ７六歩(77)');
    expect(kif).toContain('   3 ２二角成(88)');
    expect(kif).toContain('   4 同　銀(31)');
    expect(kif).toContain('   5 投了');
  });
});
