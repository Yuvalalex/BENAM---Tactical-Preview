#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════
# BENAM APK Build Script — Portable & Production-Ready
# ═══════════════════════════════════════════════════

# Auto-detect project root (directory where this script lives)
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

# Environment
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"

# Build type: debug (default) or release
BUILD_TYPE="${1:-debug}"

echo "╔══════════════════════════════════════╗"
echo "║  BENAM APK Build — $BUILD_TYPE       ║"
echo "╚══════════════════════════════════════╝"

echo "[1/5] Build web assets with Vite -> www"
cd "$ROOT_DIR"
if [ -f "node_modules/.bin/vite" ]; then
  echo "   Running Vite build..."
  npx vite build
else
  echo "   Vite not found, falling back to direct copy..."
  cp -f "$ROOT_DIR/index.html" "$ROOT_DIR/www/index.html"
  cp -f "$ROOT_DIR/manifest.json" "$ROOT_DIR/www/manifest.json"
  cp -f "$ROOT_DIR/sw.js" "$ROOT_DIR/www/sw.js"
  rsync -a --delete "$ROOT_DIR/js/" "$ROOT_DIR/www/js/"
  rsync -a --delete "$ROOT_DIR/icons/" "$ROOT_DIR/www/icons/"
fi

echo "[2/5] Sync www -> android/app/src/main/assets/public"
rsync -a --delete \
	--exclude 'cordova.js' \
	--exclude 'cordova_plugins.js' \
	"$ROOT_DIR/www/" \
	"$ANDROID_DIR/app/src/main/assets/public/"

echo "[3/5] Auto-increment versionCode"
GRADLE_FILE="$ANDROID_DIR/app/build.gradle"
if [ -f "$GRADLE_FILE" ]; then
  CURRENT_VC=$(grep -oP 'versionCode\s+\K\d+' "$GRADLE_FILE" 2>/dev/null || echo "1")
  NEW_VC=$((CURRENT_VC + 1))
  sed -i.bak "s/versionCode $CURRENT_VC/versionCode $NEW_VC/" "$GRADLE_FILE"
  rm -f "${GRADLE_FILE}.bak"
  echo "   versionCode: $CURRENT_VC -> $NEW_VC"
fi

if [ "$BUILD_TYPE" = "release" ]; then
  echo "[4/5] Build release APK"
  cd "$ANDROID_DIR"
  ./gradlew --stop 2>/dev/null || true
  ./gradlew clean assembleRelease --info 2>&1 | tee /tmp/gradle_build.log

  APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
  UNSIGNED_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release-unsigned.apk"
  OUTPUT="${APK_PATH}"
  [ ! -f "$OUTPUT" ] && OUTPUT="${UNSIGNED_PATH}"

  echo "[5/5] Copy APK to workspace root"
  cp -f "$OUTPUT" "$ROOT_DIR/BENAM-release.apk"
  echo "✓ Release APK: $ROOT_DIR/BENAM-release.apk"
else
  echo "[4/5] Build debug APK"
  cd "$ANDROID_DIR"
  ./gradlew --stop 2>/dev/null || true
  ./gradlew clean assembleDebug --info 2>&1 | tee /tmp/gradle_build.log

  echo "[5/5] Copy APK to workspace root"
  cp -f "$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk" "$ROOT_DIR/BENAM-debug.apk"
  echo "✓ Debug APK: $ROOT_DIR/BENAM-debug.apk"
fi

echo "GRADLE_EXIT:0"
