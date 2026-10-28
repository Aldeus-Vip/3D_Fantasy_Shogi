const DICT = {
  ja: {
    title: '3D ファンタジー将棋',
    sente: '先手',
    gote: '後手',
    turn: '{side}の番',
    newGame: '新規対局',
    undo: '待った',
    resign: '投了',
    declare: '入玉宣言',
    saveKif: '棋譜保存',
    flip: '視点切替',
    settings: '設定',
    skip: '演出スキップ',
    fast: '早送り',
    start: '対局開始',
    cancel: 'キャンセル',
    close: '閉じる',
    ok: 'OK',
    modelSet: 'モデルセット',
    timeControl: '持ち時間',
    timeNone: 'なし',
    timeSudden: '切れ負け',
    timeByoyomi: '秒読み',
    mainMinutes: '持ち時間(分)',
    byoyomiSeconds: '秒読み(秒)',
    effects: '演出',
    effectsFull: 'フル',
    effectsSimple: '簡易',
    effectsNone: 'なし',
    labels: '駒の漢字表示',
    sfxVolume: '効果音',
    bgmVolume: 'BGM',
    language: '言語',
    promoteQ: '成りますか?',
    promote: '成る',
    noPromote: '成らない',
    confirmResign: '{side}が投了します。よろしいですか?',
    confirmDeclare: '{side}が入玉宣言をします。条件を満たさない場合は負けになります。よろしいですか?',
    check: '王手!',
    winner: '{side}の勝ち',
    draw: '引き分け',
    reason_checkmate: '詰み',
    reason_resign: '投了',
    reason_timeout: '時間切れ',
    reason_sennichite: '千日手',
    reason_perpetualCheck: '連続王手の千日手(反則)',
    reason_declare: '入玉宣言',
    reason_declareFail: '入玉宣言の条件不足(反則)',
    byoyomiLabel: '秒読み',
    help: 'クリックで駒を選択 → 光ったマスへ移動。駒台の駒を選ぶと打てます。ドラッグで視点回転。',
  },
  en: {
    title: '3D Fantasy Shogi',
    sente: 'Black',
    gote: 'White',
    turn: "{side}'s turn",
    newGame: 'New Game',
    undo: 'Undo',
    resign: 'Resign',
    declare: 'Declare Win',
    saveKif: 'Save KIF',
    flip: 'Flip View',
    settings: 'Settings',
    skip: 'Skip',
    fast: 'Fast',
    start: 'Start',
    cancel: 'Cancel',
    close: 'Close',
    ok: 'OK',
    modelSet: 'Model Set',
    timeControl: 'Time Control',
    timeNone: 'None',
    timeSudden: 'Sudden Death',
    timeByoyomi: 'Byoyomi',
    mainMinutes: 'Main time (min)',
    byoyomiSeconds: 'Byoyomi (sec)',
    effects: 'Effects',
    effectsFull: 'Full',
    effectsSimple: 'Simple',
    effectsNone: 'Off',
    labels: 'Show kanji labels',
    sfxVolume: 'SFX',
    bgmVolume: 'BGM',
    language: 'Language',
    promoteQ: 'Promote?',
    promote: 'Promote',
    noPromote: 'Keep',
    confirmResign: '{side} resigns. Are you sure?',
    confirmDeclare: '{side} declares an entering-king win. If the conditions are not met, {side} loses. Continue?',
    check: 'Check!',
    winner: '{side} wins',
    draw: 'Draw',
    reason_checkmate: 'Checkmate',
    reason_resign: 'Resignation',
    reason_timeout: 'Time out',
    reason_sennichite: 'Repetition (Sennichite)',
    reason_perpetualCheck: 'Perpetual check (foul)',
    reason_declare: 'Entering-king declaration',
    reason_declareFail: 'Invalid declaration (foul)',
    byoyomiLabel: 'Byoyomi',
    help: 'Click a piece, then a highlighted square. Click a piece on your stand to drop it. Drag to rotate the view.',
  },
};

let lang = 'ja';

export function setLang(l) {
  lang = DICT[l] ? l : 'ja';
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}

export function getLang() {
  return lang;
}

export function t(k, vars = {}) {
  let s = DICT[lang][k] ?? DICT.ja[k] ?? k;
  for (const [name, v] of Object.entries(vars)) s = s.replaceAll(`{${name}}`, v);
  return s;
}
