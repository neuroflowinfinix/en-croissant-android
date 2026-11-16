#!/usr/bin/env node
/**
 * Configures the generated Capacitor Android project in /tmp/cap-apk/android:
 * 1. Writes android/local.properties with sdk.dir.
 * 2. Updates AndroidManifest.xml with sensorLandscape, legacy external storage, and storage permissions
 *    without duplicating any existing XML attributes on <activity> or <application>.
 * 3. Copies scripts/MainActivity.java into android/app/src/main/java/org/encroissant/app/MainActivity.java.
 * 4. Sets minSdkVersion = 28 in android/variables.gradle and disables release lint vital aborts in app/build.gradle.
 *
 * Built for the chess community by neuroflowinfinix (D. Ujjwal) — neuroflow_infinix@outlook.in
 */

import fs from 'fs';
import path from 'path';

const WORKSPACE = process.env.GITHUB_WORKSPACE || process.cwd();
const ANDROID_DIR = path.resolve('/tmp/cap-apk/android');
const SDK_ROOT = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '/usr/local/lib/android/sdk';

// 1. Write local.properties
fs.writeFileSync(path.join(ANDROID_DIR, 'local.properties'), `sdk.dir=${SDK_ROOT}\n`, 'utf8');

// 2. Patch AndroidManifest.xml cleanly (never duplicating existing attributes)
const manifestPath = path.join(ANDROID_DIR, 'app/src/main/AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let txt = fs.readFileSync(manifestPath, 'utf8');
  if (!txt.includes('android:screenOrientation')) {
    txt = txt.replace(
      'android:name=".MainActivity"',
      'android:name=".MainActivity"\n            android:screenOrientation="sensorLandscape"'
    );
  }
  if (!txt.includes('android:requestLegacyExternalStorage')) {
    txt = txt.replace(
      '<application',
      '<application\n        android:requestLegacyExternalStorage="true"\n        android:usesCleartextTraffic="true"'
    );
  }
  const perms = [
    '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />',
    '    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />',
    '    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />',
    '</manifest>',
  ].join('\n');
  if (!txt.includes('MANAGE_EXTERNAL_STORAGE')) {
    txt = txt.replace('</manifest>', perms);
  }
  fs.writeFileSync(manifestPath, txt, 'utf8');
}

// 3. Copy MainActivity.java
const destJavaDir = path.join(ANDROID_DIR, 'app/src/main/java/org/encroissant/app');
fs.mkdirSync(destJavaDir, { recursive: true });
fs.copyFileSync(
  path.join(WORKSPACE, 'scripts/MainActivity.java'),
  path.join(destJavaDir, 'MainActivity.java')
);

// 4. Set minSdkVersion = 28 in variables.gradle
const varsPath = path.join(ANDROID_DIR, 'variables.gradle');
if (fs.existsSync(varsPath)) {
  let vars = fs.readFileSync(varsPath, 'utf8');
  vars = vars.replace(/minSdkVersion\s*=\s*\d+/g, 'minSdkVersion = 28');
  fs.writeFileSync(varsPath, vars, 'utf8');
}

// 5. Disable lintVitalRelease aborts on ScopedStorage / SetJavaScriptEnabled in app/build.gradle
const appGradlePath = path.join(ANDROID_DIR, 'app/build.gradle');
if (fs.existsSync(appGradlePath)) {
  let gradleTxt = fs.readFileSync(appGradlePath, 'utf8');
  if (!gradleTxt.includes('checkReleaseBuilds')) {
    gradleTxt += `\nandroid {\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }\n}\n`;
    fs.writeFileSync(appGradlePath, gradleTxt, 'utf8');
  }
}

console.log('[Configure-Capacitor-Android] Configured AndroidManifest.xml, MainActivity.java, app/build.gradle, and minSdkVersion 28.');
