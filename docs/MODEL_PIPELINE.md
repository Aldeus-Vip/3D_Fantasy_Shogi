# 3Dモデルの組み込み手順

## 1. モデルを作る
1. [prompts/](prompts/) のプロンプトで Firefly の画像を生成
2. 画像を Meshy の **Image to 3D** に入力
3. 人型キャラは Meshy の自動リグ+アニメーションを付けてもよい
4. **GLB** 形式でダウンロード

### Meshy の出力設定
| 項目 | 設定 |
|---|---|
| ポリゴン数 | 下表の目安(三角形ポリゴン数) |
| トポロジー | Triangle(三角形) |
| テクスチャ | 1024px(玉・竜王など大型駒は 2048px も可) |
| 形式 | GLB |

| 駒 | ポリゴン数の目安 |
|---|---|
| 歩・と金 | 約 10,000 |
| 香・桂・銀・金・成駒(小) | 約 15,000 |
| 飛・角・竜王・竜馬・玉 | 約 20,000 |

- 盤上と駒台で最大 約50体を同時に表示するため、合計 100万ポリゴン以下を目安にする
- 高ポリゴンで出力された場合は、Meshy の Remesh 機能で上の数値まで下げる
- スマホ対応時は、これの約半分にする予定

## 2. ファイルを置く
`public/models/<セットID>/` に置く(例: `public/models/dragon/king.glb`)。

| キー | 駒 | 推奨ファイル名 |
|---|---|---|
| K | 玉/王 | king.glb |
| R | 飛車 | rook.glb |
| B | 角行 | bishop.glb |
| G | 金将 | gold.glb |
| S | 銀将 | silver.glb |
| N | 桂馬 | knight.glb |
| L | 香車 | lance.glb |
| P | 歩兵 | pawn.glb |
| +R | 竜王 | rook_promoted.glb |
| +B | 竜馬 | bishop_promoted.glb |
| +S | 成銀 | silver_promoted.glb |
| +N | 成桂 | knight_promoted.glb |
| +L | 成香 | lance_promoted.glb |
| +P | と金 | pawn_promoted.glb |

### テクスチャの縮小(ファイルが重いとき)
Meshy の GLB はテクスチャが 2048px で、1体 約9MB になる。1024px に縮小すると約2MB になる。

```bash
npx @gltf-transform/cli resize 元ファイル.glb public/models/dragon/king.glb --width 1024 --height 1024
```

## 3. セット定義に登録する
`src/sets/index.js` の `models` に追記する。書いた駒だけ実モデルになり、残りは仮モデルのまま動く。

```js
models: {
  K: 'king.glb',
  P: 'pawn.glb',
},
```

## 4. 自動で調整されること
- 大きさ: 駒の種類ごとの高さに自動で拡大縮小
- 位置: 足元が盤面に、中心がマスの中央に来るよう補正
- 向き: モデルの正面は **+Z 方向**(glTF 標準)を前提に、先手/後手で自動回転

## 5. アニメーション(任意)
GLB にクリップが入っていれば、名前で自動判定して再生する(大文字小文字は無視)。

| 場面 | クリップ名に含める語 |
|---|---|
| 待機 | idle |
| 移動 | walk / run / fly |
| 攻撃 | attack |
| 被弾 | hit / damage |
| 消滅 | death / die |
| 召喚 | spawn / appear / land |

クリップがない場合は、プログラム側の簡易演出(跳躍・突進・縮小など)で動く。
