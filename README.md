# モンコレ計算機 v18.11

ZIP の中身を、既存の `index.html` があるフォルダーへ上書きします。GitHub Pages のプロジェクトのサブディレクトリでも動作します。ブラウザの保存済み編成と設定JSONは以前の版から引き継げます。

## キャラを追加・修正する

1. `assets/data/characters.json` の `characters` に同じカテゴリの行を参考に追加します。`id` は保存済み編成が使う固定値です。通常は `category` を `normal` にして図鑑番号 `no` を指定すると、Lv1のHP・攻撃力を `normalGrowth` から計算します。伝説と幻は `legend` または `illusion` を指定し、`hp` と `attack` にLv1・無凸・無変異の値を実数で入力します。
2. 特性を持つキャラは `character` に `traits` のキーを指定します。既存の特性は再利用できます。新しい種類の効果は計算処理にも追加してください。`modelId` は画像モデルに対応するラベルがある場合に指定します。追加した名前とステータスはOCRの候補と攻撃力照合にも使われます。新しい絵柄の学習は別途必要です。
3. GitHub Pages はJSONを直接読み込みます。ダブルクリック用の配布版も更新するときは、Node.jsで下記を実行し、生成された `characters.local.js` も同梱してください。

```sh
node scripts/sync-catalog.mjs
node scripts/sync-catalog.mjs --check
node --test scripts/calculator.test.cjs
```

## 主な修正先

| 修正内容 | ファイル |
|---|---|
| ステージ画面とデザイン | `index.html`、`assets/css/style.css` |
| キャラの基礎値・変異・固有特性の数値 | `assets/data/characters.json` |
| Lv・凸・ペア編成のステータス計算 | `assets/js/characters.js` |
| 戦闘・ステージ報酬の補正 | `assets/js/simulation.js` |
| 編成入力・保存・ランキング表示 | `assets/js/stage.js` |
| 画像読み取り・判定 | `assets/js/image-import.js`、`assets/js/party-consensus.js` など |
| ボス画面 | `boss/index.html`、`assets/css/boss.css` |

画像解析には初回に外部のOCRなどのライブラリを読み込みます。画像モデルも含めて動作を確認するときは、このフォルダーで `python -m http.server 8000 --bind 127.0.0.1` を実行し、ブラウザで `http://127.0.0.1:8000/` を開きます。
