// モデルセット定義。
// models に GLB のパスを書くと、その駒は実モデルで表示される。
// 書かれていない駒は仮モデル(プリミティブ図形)で表示される。
// キー: K R B G S N L P(通常駒)/ +R +B +S +N +L +P(成駒)
// 置き場所: public/models/<セットID>/<ファイル名>.glb

export const MODEL_SETS = {
  dragon: {
    id: 'dragon',
    name: { ja: 'ドラゴン', en: 'Dragon' },
    style: 'dragon',
    colors: { body: 0xb8322a, accent: 0xf2b134, dark: 0x3a1410, eye: 0xffe066 },
    effectColor: 0xff7a2a,
    models: {},
  },
  undead: {
    id: 'undead',
    name: { ja: 'アンデッド', en: 'Undead' },
    style: 'undead',
    colors: { body: 0xe8e2cf, accent: 0x6b4fa8, dark: 0x22202a, eye: 0x7dffcf },
    effectColor: 0x7dffcf,
    models: {},
  },
  demon: {
    id: 'demon',
    name: { ja: 'デーモン', en: 'Demon' },
    style: 'demon',
    colors: { body: 0x5a1a2e, accent: 0xff4d1a, dark: 0x1a0a10, eye: 0xffb31a },
    effectColor: 0xd62bff,
    models: {},
  },
};

export const SET_IDS = Object.keys(MODEL_SETS);

// 陣営カラー(台座の色)。同じセット同士でも敵味方が分かるようにする。
export const TEAM_COLORS = [0x2f7bff, 0xff3b3b];
