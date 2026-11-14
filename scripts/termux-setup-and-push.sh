#!/usr/bin/env bash
# ==============================================================================
# En Croissant Tauri v2 Android — Termux to GitHub Actions Automated Setup
# Built for the chess community by neuroflowinfinix (D. Ujjwal)
# Contact: neuroflow_infinix@outlook.in
# ==============================================================================
set -e

KIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK_DIR="$HOME/en-croissant-tauri-android"

echo "=================================================================="
echo "  En Croissant Tauri v2 Android (Rust + Vite) — GitHub Actions    "
echo "  Maintainer: neuroflowinfinix (D. Ujjwal)                        "
echo "=================================================================="

pkg install -y git gh nodejs-lts unzip

rm -rf "$WORK_DIR"
echo "[*] Cloning official franciscoBSalgueiro/en-croissant repository..."
git clone --depth 1 https://github.com/franciscoBSalgueiro/en-croissant.git "$WORK_DIR"

echo "[*] Copying Tauri v2 Android GitHub Actions workflow & Rust patch scripts..."
mkdir -p "$WORK_DIR/.github/workflows" "$WORK_DIR/scripts"
cp "$KIT_DIR/.github/workflows/build-android-apk.yml" "$WORK_DIR/.github/workflows/build-android-apk.yml"
cp "$KIT_DIR/scripts/prepare-tauri-android.mjs" "$WORK_DIR/scripts/prepare-tauri-android.mjs"
cp "$KIT_DIR/scripts/configure-android-gradle-and-engines.mjs" "$WORK_DIR/scripts/configure-android-gradle-and-engines.mjs"
cp "$KIT_DIR/GITHUB_ACTIONS_GUIDE.md" "$WORK_DIR/GITHUB_ACTIONS_GUIDE.md"

# Append maintainer credit to README.md
cat << 'EOF' >> "$WORK_DIR/README.md"

---
### Android Edition (Tauri v2 + Rust + Stockfish 19)
Built for the chess community by **neuroflowinfinix (D. Ujjwal)** — `neuroflow_infinix@outlook.in`
EOF

cd "$WORK_DIR"
git config user.name "neuroflowinfinix"
git config user.email "neuroflow_infinix@outlook.in"
git add .
git commit -m "Add Tauri v2 Android APK build pipeline and Stockfish 19 ARM64 integration"

echo "[*] Checking GitHub CLI (gh) authentication..."
if ! gh auth status >/dev/null 2>&1; then
  echo "[!] Please log in to your GitHub account:"
  gh auth login
fi

REPO_NAME="en-croissant-android"
echo "[*] Creating/pushing to GitHub repository: neuroflowinfinix/$REPO_NAME ..."
gh repo create "$REPO_NAME" --public --source=. --remote=origin --push || (
  git remote set-url origin "https://github.com/neuroflowinfinix/$REPO_NAME.git" 2>/dev/null || git remote add origin "https://github.com/neuroflowinfinix/$REPO_NAME.git"
  git push -u origin HEAD:master --force
)

echo "=================================================================="
echo "  SUCCESS! GitHub Actions is now building your Android APK!       "
echo "  Watch progress or download the APK in Termux with:              "
echo "    cd ~/en-croissant-tauri-android && gh run watch               "
echo "    gh run download --name en-croissant-android-apk               "
echo "=================================================================="
