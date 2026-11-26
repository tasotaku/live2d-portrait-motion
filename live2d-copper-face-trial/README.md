# 銅色ボブの Live2D 試作

新規の立ち絵と表情差分に、前回の目・口の Cubism リグを合わせた比較用モデル。

- [瞬き・口の開閉](./index.html) で、左右の目を個別に調整し、動作と字幕付きの無音会話を再生できる。
- [口パク比較](./vowel-comparison.html) で、同じ音声と開き量を使って、開閉だけの口パクと母音で横幅も変わる口パクを同時再生できる。
- [頭と上半身の比較](./vowel-comparison.html?body=1) で、同じ瞬きと口パクに頭の傾き、肩と胸の上下を加えた版を見比べられる。

## 編集と書き出し

- `copper-face.cmo3` を Cubism Editor で開く。目は `ParamEyeLOpen` と `ParamEyeROpen`、口は `ParamMouthOpenY` と `ParamMouthForm` で操作する。
- `portrait.png` と `expressions.png` が生成素材。`artwork-prompt.txt` に両方の生成指示がある。
- `node assemble.mjs` で５つのパーツ分け PSD を書き出す。依存は隣の `live2d-face-rig-v1` と共通。Cubism でレイヤーを差し替え、`MouthPlacement` で顔に合わせた基準位置を編集できる。
- Cubism から SDK 用ファイルを書き出した後、`node ../live2d-face-rig-v1/make-motion.mjs --copper` でモーション４種を書き出し、モデル設定に登録する。比較用の２種には同じ開閉と瞬きが入り、`vowels.motion3.json` には口形のキーも入る。
- `copper-performance.cmo3` では `ParamAngleZ` で頭を傾け、`ParamBreath` で肩と胸を動かす。人物の輪郭と服の縁に沿って背景を分けた。目・口・前髪は頭と一緒に動き、背景の窓枠と本棚は固定される。
- 体を動かす版の PSD は `node ../live2d-painted-face-trial/assemble-performance.mjs --copper` で生成する。Cubism から SDK 用ファイルを `copper-performance` 名で書き出し、`node ../live2d-face-rig-v1/make-motion.mjs --performance --copper` で会話モーションを登録する。会話中の傾きと呼吸の曲線は紫髪の試作と共通。

目は閉じ目差分のまぶたを土台に使い、目元に重なる前髪は前面に配置した。唇が上下する間、口内の歯と舌は同じ位置にあり、開口マスクから見える範囲が変わる。開きが8%から2%になる間、閉じたまつ毛の線がやや急に濃くなる。
