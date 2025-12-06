<h1 align="center">
  tilr - Tile Animation Generator
</h1>

<p align="center">
  <img src="./img/tilr.png" alt="Logo" width="600" style="margin: 20px auto;">
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-brightgreen">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D18-blue">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Node.js%20%7C%20Browser-lightgrey">
  <img alt="Status" src="https://img.shields.io/badge/status-active-success">
</p>

<p align="center">
  <a href="./README.md">English</a> |
  <b>日本語</b>
</p>

---

## 目次

- [概要](#概要)
- [使用技術](#使用技術)
- [前提条件](#前提条件)
- [インストール](#インストール)
- [使用方法](#使用方法)
  - [CLI](#cli)
  - [プログラマティック API](#プログラマティック-api)
  - [デコーダー](#デコーダー)
- [出力形式](#出力形式)
- [パイプライン](#パイプライン)
- [ビューア](#ビューア)
- [ドキュメント](#ドキュメント)
- [コントリビューション](#コントリビューション)
- [ライセンス](#ライセンス)

---

## 概要

| original                   | tile animation                        |
| -------------------------- | ------------------------------------- |
| ![original](./img/ebe.gif) | ![tile animation](./img/ebe-tilr.gif) |

Tile Animation Generator は、動画をタイル調のアニメーションに変換するツールです。動画からシルエットを抽出し、レトロなピクセルアート風のモザイクアニメーションとして Web ブラウザ上で再生できます。

ユニークなビジュアルエフェクトの作成、アーティスティックなプレゼンテーション、プロジェクトにノスタルジックなピクセル感を加えたい場合に最適です。

**おまけ**: 効率的な CADF バイナリ形式により 94.8% のサイズ削減を実現し、軽量で高速なアニメーション配信が可能です。

---

## 使用技術

| 技術      | バージョン | 説明               |
| --------- | ---------- | ------------------ |
| Node.js   | >= 18      | ランタイム環境     |
| ffmpeg    | 最新       | 動画フレーム抽出   |
| Jimp      | ^1.6.0     | 画像処理           |
| Commander | ^13.1.0    | CLI フレームワーク |

---

## 前提条件

- **Node.js 18** 以上が必要です。
- **ffmpeg** がシステムにインストールされている必要があります。

### 対応動画形式

ffmpeg がデコードできる全ての動画形式に対応しています。

| 形式 | 拡張子          |
| ---- | --------------- |
| MP4  | `.mp4`          |
| WebM | `.webm`         |
| AVI  | `.avi`          |
| MOV  | `.mov`          |
| MKV  | `.mkv`          |
| FLV  | `.flv`          |
| WMV  | `.wmv`          |
| MPEG | `.mpeg`, `.mpg` |

> **注意**: インストールされている ffmpeg がサポートする形式であれば動作します。

### ffmpeg のインストール

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
# https://ffmpeg.org/download.html からダウンロードしてください。
```

---

## インストール

```bash
npm install tilr
```

または、リポジトリをクローンしてください。

```bash
git clone https://github.com/sahksas/tilr.git
cd tilr
npm install
```

---

## 使用方法

### CLI

**基本的な使用法:**

```bash
npx tilr video.mp4 -o ./output
```

**オプション付き:**

```bash
npx tilr video.mp4 -o ./output \
  --fps 15 \
  --tile-size 8 \
  --chunk-size 60 \
  --verbose
```

**ヘルプを表示:**

```bash
npx tilr --help
```

#### CLI オプション

| オプション                  | デフォルト   | 説明                       |
| --------------------------- | ------------ | -------------------------- |
| `-o, --output <dir>`        | `./<動画名>` | 出力ディレクトリ           |
| `--fps <number>`            | `15`         | フレームレート             |
| `--tile-size <number>`      | `8`          | タイルサイズ（ピクセル）   |
| `--chunk-size <number>`     | `60`         | チャンクあたりのフレーム数 |
| `--brightness-min <number>` | `10`         | 明るさの下限値             |
| `--brightness-max <number>` | `120`        | 明るさの上限値             |
| `--green-ratio <number>`    | `1.5`        | 緑色比率の閾値             |
| `-v, --verbose`             | `false`      | 詳細ログを有効化           |

### プログラマティック API

```javascript
import { generateTileAnimation } from "tilr";

const result = await generateTileAnimation({
  inputVideo: "./video.mp4",
  outputDir: "./output",
  fps: 15,
  tileSize: 8,
  chunkSize: 60,
});

console.log(`${result.totalChunks} チャンクを生成しました`);
console.log(`サイズ削減率: ${result.stats.reduction}%`);
```

### デコーダー

デコーダーは Node.js とブラウザの両方で動作します。

```javascript
import { decodeCADF } from "tilr/decoder";

// Node.js
import fs from "fs";
const buffer = fs.readFileSync("./output/frames-001.bin");
const frames = decodeCADF(buffer);

// ブラウザ
const response = await fetch("./frames-001.bin");
const arrayBuffer = await response.arrayBuffer();
const frames = decodeCADF(arrayBuffer);

// 結果: frames[0] = { frame: 0, coordinates: [[x, y], ...], totalPoints: 14250 }
```

---

## 出力形式

### ディレクトリ構造

```
output/
├── frames-001.bin   # CADF バイナリチャンク 1
├── frames-002.bin   # CADF バイナリチャンク 2
├── ...
└── config.json      # メタデータ
```

### バイナリ形式（CADF）

CADF（CAT Diff Format）は、最大効率のための差分エンコーディングを使用します。

- **最初のフレーム**: 完全な座標データを格納します。
- **以降のフレーム**: 前フレームとの差分のみを格納します。

| 指標               | 値    |
| ------------------ | ----- |
| JSON → CADF 削減率 | 94.8% |
| Brotli 圧縮後      | 98.3% |

---

## パイプライン

生成プロセスは 4 つのステップで構成されています。

1. **フレーム抽出** - ffmpeg を使用して動画からフレームを抽出します。
2. **シルエット抽出** - Jimp を使用してタイル座標を検出します。
3. **チャンク分割** - 管理しやすいチャンクにデータを分割します。
4. **バイナリ変換** - ラウンドトリップ検証付きで CADF にエンコードします。

---

## ビューア

組み込みビューアを使用して、生成されたアニメーションをプレビューできます。

```bash
# CLI を使用
npx tilr view ./output

# または手動で http-server を使用
npx http-server ./output -p 8080
# ブラウザで http://localhost:8080/viewer/ を開いてください。
```

**ビューアの機能:**

- アニメーションの再生/一時停止
- フレームのシーク
- タイルサイズ、色、背景の調整

---

## ドキュメント

- [バイナリ形式仕様](./docs/binary-format.md) - CADF 形式の詳細ドキュメントです。
- [生成パイプライン](./docs/pipeline.md) - パイプラインアーキテクチャと設定についてのドキュメントです。

---

## コントリビューション

コントリビューションを歓迎します。以下の手順に従ってください。

1. リポジトリをフォークします。
2. フィーチャーブランチを作成します。 (`git checkout -b feature/amazing-feature`)
3. 変更をコミットします。 (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュします。 (`git push origin feature/amazing-feature`)
5. プルリクエストを作成します。

---

## ライセンス

このプロジェクトは MIT ライセンスの下でライセンスされています。詳細は [LICENSE](LICENSE) ファイルを参照してください。
