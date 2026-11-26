# Live2D 立ち絵モーション

2人のオリジナルキャラクターで、瞬き・口パクと、頭の傾きや肩・胸の動きをブラウザで確認できます。

## 別のPCで起動する

Git、Python 3.8 以上、WebGL が使えるブラウザ、CDN へのインターネット接続が必要です。Windows の PowerShell で次を実行します。

```powershell
git clone https://github.com/tasotaku/live2d-portrait-motion.git
cd live2d-portrait-motion
python bootstrap.py install
python bootstrap.py check
python bootstrap.py serve
```

サーバーを起動したままブラウザで [デモ一覧](http://127.0.0.1:8767/) を開きます。「瞬き・口の開閉」では顔を個別に操作でき、「頭と上半身の動きの比較」では同じ口パクに頭・肩・胸の動きを加えた版を見比べられます。母音による口の横幅の違いは、比較ページの切り替えリンクから確認できます。

- ポート 8767 を使用中なら `python bootstrap.py serve --port 8768` を実行し、表示された URL を開きます。サーバーは自分の PC からだけ接続できます。
- 更新時は `git pull` の後に `install` と `check` を再実行します。`check` はモデル設定と参照ファイル、およびローカル HTTP 配信を検証します。ブラウザでの描画には `cubism.live2d.com` と `cdn.jsdelivr.net` への接続が必要です。
- macOS / Linux では上の `python` を `python3` に置き換えます。macOS / Linux での実機動作は未確認です。

## 会話デモの音声

`install` が 5.75 秒の無音 WAV を `live2d-painted-face-trial/conversation-voice.wav` に生成します。既定の会話デモは無音で、同じタイミングで字幕・口パク・体の動きが再生されます。ローカルの WAV を使う場合は同じパスに配置してください。既存ファイルは再実行時にも保持されます。

## モデルを編集する

- キャラクター別のディレクトリに編集用 `.cmo3` と、ブラウザで使う `.model3.json`・`.moc3`・テクスチャを置いています。編集には [Live2D Cubism Editor](https://www.live2d.com/cubism/download/editor/) を使います。
- 別の立ち絵に応用するときは、素材の生成、パーツ分け、瞬き、口パクの基準をまとめた [AI向けの制作プロンプト](live2d-face-rig-v1/eye-mouth-rig-prompt.md) を使えます。
- PSD を再生成するときだけ Node.js と npm が必要です。ルートで `npm ci --prefix live2d-face-rig-v1` を実行してから、各キャラクターの `assemble.mjs` を `node` で実行します。
- ブラウザは Cubism Core を公式 CDN から、PixiJS と pixi-live2d-display を jsDelivr から読み込みます。体の動きを設計する際の参考は [Live2D 公式サンプル「桃瀬ひより」](https://www.live2d.com/learn/sample/momose-hiyori/) です。
