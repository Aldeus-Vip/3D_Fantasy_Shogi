# 3D Fantasy Shogi

Dragon・骸骨・悪魔などのファンタジーキャラクター(3Dモデル)を駒として、将棋のルールで対戦するゲーム。
Web(Three.js)で動作します。

## 遊び方(開発環境)
```bash
npm install
npm run dev      # http://localhost:5173 で起動
npm test         # 将棋ルールのテスト
npm run build    # dist/ に公開用ファイルを出力
```

## 操作
- 駒をクリック → 緑に光ったマスをクリックで移動
- 駒台の駒をクリック → 盤上の空きマスに打つ
- ドラッグで視点回転、ホイールで拡大縮小
- 演出中は「演出スキップ」ボタン or スペースキーで飛ばせる

## 実装済み(v0.1)
| 区分 | 内容 |
|---|---|
| ルール | 全駒の動き・成り(強制/任意)・持ち駒・二歩・打ち歩詰め・行き所のない駒・王手放置禁止・詰み判定・千日手・連続王手の千日手・入玉宣言(27点法) |
| 対戦 | ローカル2人対戦、待った、投了、棋譜保存(KIF) |
| 持ち時間 | なし / 切れ負け / 秒読み |
| モデル | セット選択(Dragon / Undead / Demon)、先手後手で別セット可、GLB 差し替え対応(未配置の駒は仮モデル) |
| 演出 | 移動・駒取り(攻撃 → 消滅)・駒打ち(魔法陣 → 光の柱 → 降臨)・成り(進化)・王手 |
| 設定 | 演出の強さ(フル/簡易/なし)、早送り、漢字ラベル表示、効果音・BGM 音量、日本語/英語 |

## ドキュメント
| ファイル | 内容 |
|---|---|
| [docs/CONCEPT.md](docs/CONCEPT.md) | 基本構想 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 決定事項(未決定事項への回答) |
| [docs/MODEL_SETS.md](docs/MODEL_SETS.md) | モデルセット候補と駒の割り当て |
| [docs/MODEL_PIPELINE.md](docs/MODEL_PIPELINE.md) | 3Dモデルの作成 → ゲームへの組み込み手順 |
| [docs/prompts/dragon.md](docs/prompts/dragon.md) | Dragonセットの Firefly / Meshy 用プロンプト |

## フォルダ構成
```
src/
  shogi/     将棋ルール(画面と独立。テスト対象)
  view/      3D表示・演出(Three.js)
  sets/      モデルセット定義
  game/      持ち時間
  audio/     効果音・BGM(WebAudio で合成)
  ui/        多言語テキスト
public/models/<セットID>/   GLB モデル置き場
tests/       ルールのテスト
```
