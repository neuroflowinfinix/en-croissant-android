# Building the Original En Croissant (Rust + Tauri v2) for Android via GitHub Actions

> **Built for the chess community by neuroflowinfinix (D. Ujjwal)** (`neuroflow_infinix@outlook.in`)
> **Upstream Repository:** [franciscoBSalgueiro/en-croissant](https://github.com/franciscoBSalgueiro/en-croissant)

## How GitHub Actions Works (First-Time Overview)

Instead of compiling Rust, C++, and Android Gradle on your phone (which takes gigabytes of RAM and NDK toolchains), **GitHub Actions** gives you a free, high-powered cloud Linux server (`ubuntu-24.04` with 16 GB RAM, 4 CPUs, Rust, Java 17, and the Android NDK) every time you push code to your GitHub repository.

When you push the `.github/workflows/build-android-apk.yml` file to your GitHub repository, GitHub automatically:
1. Boots an Ubuntu 24.04 cloud server.
2. Uses the exact [franciscoBSalgueiro/en-croissant](https://github.com/franciscoBSalgueiro/en-croissant) Rust backend (`src-tauri`) and React/Mantine/Chessground frontend (`src/`).
3. Runs `scripts/prepare-tauri-android.mjs` to add the Tauri v2 Android JNI entry point (`#[cfg_attr(mobile, tauri::mobile_entry_point)]`) and `[lib] crate-type = ["staticlib", "cdylib", "rlib"]`.
4. Bundles both the **official Stockfish 19 Android ARM64 native binary** (`libstockfish.so`) and **`nmrugg/stockfish.js` v19.0.1 WASM**.
5. Compiles and signs **`en-croissant-v0.16.1-android-arm64.apk`** (compatible with Android 9 / API 28+) and attaches it directly to your GitHub repository's **Actions Artifacts** and **Releases** page!

## Step-by-Step Instructions in Termux (From Beginning to APK Download)

### Step 1: Extract This Kit in Termux

Download `en-croissant-tauri-android-github-actions.zip` into your Android `Download` folder, open **Termux**, and run:

```bash
pkg update -y && pkg install -y git gh nodejs-lts unzip
rm -rf ~/ec-tauri-kit
mkdir -p ~/ec-tauri-kit
unzip -o /storage/emulated/0/Download/en-croissant-tauri-android-github-actions.zip -d ~/ec-tauri-kit
```

### Step 2: Run the One-Command Setup & GitHub Push Script

```bash
bash ~/ec-tauri-kit/en-croissant-tauri-android/scripts/termux-setup-and-push.sh
```

**What this script does automatically:**
1. Clones the official `https://github.com/franciscoBSalgueiro/en-croissant.git` into `~/en-croissant-tauri-android`.
2. Copies `.github/workflows/build-android-apk.yml` and the two Tauri Android adaptation scripts (`scripts/prepare-tauri-android.mjs` and `scripts/configure-android-gradle-and-engines.mjs`) into the cloned repository.
3. Adds your attribution (`neuroflowinfinix (D. Ujjwal)` — `neuroflow_infinix@outlook.in`) to `README.md`.
4. Prompts you to log in via `gh auth login` (if you aren't already logged in to GitHub CLI in Termux), creates a public repository named `neuroflowinfinix/en-croissant-android`, and pushes the code to start the GitHub Actions build.

### Step 3: Watch the Build & Download the Signed `.apk`

You can watch the build live or download the finished `.apk` in two ways:

- **Option A — In Your Phone Browser:**
  Open `https://github.com/neuroflowinfinix/en-croissant-android/actions` (or `/releases`) in Chrome on your phone. Once the workflow turns green (~10–14 minutes), tap **Releases** (or the workflow run's **Artifacts** section) to download `en-croissant-v0.16.1-android-arm64.apk`.
- **Option B — Directly Inside Termux (`gh` CLI):**
  ```bash
  cd ~/en-croissant-tauri-android
  gh run watch
  gh run download --name en-croissant-android-apk --dir /storage/emulated/0/Download/
  ```
  This saves `en-croissant-v0.16.1-android-arm64.apk` straight into your phone's `Download` folder ready to install!
