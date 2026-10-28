import { KIF_NAMES, KIF_PROMOTED_NAMES } from './constants.js';

const ZEN_DIGITS = '０１２３４５６７８９';
const KANJI_DIGITS = '〇一二三四五六七八九';

// 内部座標 → 筋・段(1始まり)
export function toFileRank([x, y]) {
  return [9 - x, y + 1];
}

export function formatMove(record, prevRecord) {
  const { move, before } = record;
  const [file, rank] = toFileRank(move.to);
  const prevTo = prevRecord ? prevRecord.move.to : null;
  const dest = prevTo && prevTo[0] === move.to[0] && prevTo[1] === move.to[1]
    ? '同　'
    : ZEN_DIGITS[file] + KANJI_DIGITS[rank];
  if (move.drop) return `${dest}${KIF_NAMES[move.piece]}打`;
  const piece = before.get(move.from[0], move.from[1]);
  const name = piece.promoted ? KIF_PROMOTED_NAMES[piece.type] : KIF_NAMES[piece.type];
  let suffix = '';
  if (move.promote) suffix = '成';
  else if (!piece.promoted && canPromoteHere(record)) suffix = '不成';
  const [ff, fr] = toFileRank(move.from);
  return `${dest}${name}${suffix}(${ff}${fr})`;
}

function canPromoteHere({ move, before }) {
  // 成れたのに成らなかった場合のみ「不成」を付ける
  return before.legalMoves().some((m) => !m.drop
    && m.from[0] === move.from[0] && m.from[1] === move.from[1]
    && m.to[0] === move.to[0] && m.to[1] === move.to[1] && m.promote);
}

const RESULT_TEXT = {
  checkmate: '詰み',
  resign: '投了',
  timeout: '切れ負け',
  sennichite: '千日手',
  perpetualCheck: '反則負け',
  declare: '入玉勝ち',
  declareFail: '反則負け',
};

function pad(n, w) {
  return String(n).padStart(w, ' ');
}

function clock(sec) {
  const s = Math.floor(sec);
  return `${pad(Math.floor(s / 60), 2)}:${String(s % 60).padStart(2, '0')}`;
}

function total(sec) {
  const s = Math.floor(sec);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  return `${h}:${m}:${String(s % 60).padStart(2, '0')}`;
}

export function toKIF(game, { senteName = '先手', goteName = '後手', startedAt = new Date() } = {}) {
  const d = startedAt;
  const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} `
    + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  const lines = [
    '# ---- 3D Fantasy Shogi 棋譜ファイル ----',
    `開始日時：${date}`,
    '手合割：平手',
    `先手：${senteName}`,
    `後手：${goteName}`,
    '手数----指手---------消費時間--',
  ];
  const totals = [0, 0];
  game.records.forEach((r, i) => {
    const owner = r.before.turn;
    totals[owner] += r.seconds;
    const text = formatMove(r, game.records[i - 1]);
    lines.push(`${pad(i + 1, 4)} ${text.padEnd(12, '　')} (${clock(r.seconds)}/${total(totals[owner])})`);
  });
  if (game.result) {
    lines.push(`${pad(game.records.length + 1, 4)} ${RESULT_TEXT[game.result.reason]}`);
  }
  return `${lines.join('\n')}\n`;
}
