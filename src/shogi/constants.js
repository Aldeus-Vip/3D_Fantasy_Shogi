// 先手 = 0(画面手前), 後手 = 1(画面奥)
export const SENTE = 0;
export const GOTE = 1;

// K:玉 R:飛 B:角 G:金 S:銀 N:桂 L:香 P:歩
export const PIECE_TYPES = ['K', 'R', 'B', 'G', 'S', 'N', 'L', 'P'];
export const HAND_TYPES = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
export const PROMOTABLE = new Set(['R', 'B', 'S', 'N', 'L', 'P']);

// 盤上表示用の一文字ラベル
export const LABELS = {
  K: ['玉', '王'],
  R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩',
};
export const PROMOTED_LABELS = { R: '竜', B: '馬', S: '全', N: '圭', L: '杏', P: 'と' };

// 棋譜(KIF)用の駒名
export const KIF_NAMES = { K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩' };
export const KIF_PROMOTED_NAMES = { R: '龍', B: '馬', S: '成銀', N: '成桂', L: '成香', P: 'と' };

export function pieceLabel(piece) {
  if (piece.promoted) return PROMOTED_LABELS[piece.type];
  if (piece.type === 'K') return LABELS.K[piece.owner];
  return LABELS[piece.type];
}

// モデル参照キー(成駒は '+R' のように表記)
export function modelKey(type, promoted) {
  return promoted ? `+${type}` : type;
}
