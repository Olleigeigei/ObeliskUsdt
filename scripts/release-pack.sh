#!/usr/bin/env sh
# 构建并打包 npm 发布产物（仅含 package.json files 白名单）
# @author Telegram @okgeceo
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[release-pack] tsc build..."
npm run build

OUT_DIR="$ROOT/package/obeliskusdt"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo "[release-pack] npm pack..."
PACK_FILE="$(npm pack --pack-destination "$OUT_DIR" | tail -n 1)"
echo "[release-pack] 产物: $OUT_DIR/$PACK_FILE"

echo "[release-pack] 完成"
