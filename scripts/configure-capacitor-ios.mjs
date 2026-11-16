#!/usr/bin/env node
/**
 * Configures the Capacitor iOS/iPadOS project for iPadOS 15.0+ (IPHONEOS_DEPLOYMENT_TARGET = 15.0):
 * 1. Updates `ios/App/Podfile` to `platform :ios, '15.0'` and configures `post_install` to set
 *    `IPHONEOS_DEPLOYMENT_TARGET = '15.0'` and disable code-signing requirements on Pod targets.
 * 2. Updates `ios/App/App.xcodeproj/project.pbxproj` to `IPHONEOS_DEPLOYMENT_TARGET = 15.0` and
 *    universal `TARGETED_DEVICE_FAMILY = "1,2"` (iPhone + iPad native full-screen resolution).
 * 3. Configures `ios/App/App/Info.plist` for iPadOS landscape orientation, Split View / Stage Manager,
 *    and iPadOS Files app integration (`UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace`).
 *
 * Built for the chess community by neuroflowinfinix (D. Ujjwal) — neuroflow_infinix@outlook.in
 */

import fs from 'fs';
import path from 'path';

const CAP_DIR = process.cwd();
const iosAppDir = path.join(CAP_DIR, 'ios', 'App');

function log(msg) {
  console.log(`[Configure-Capacitor-iPadOS] ${msg}`);
}

// 1. Update ios/App/Podfile for iPadOS 15.0+ and unsigned CI build compatibility
const podfilePath = path.join(iosAppDir, 'Podfile');
if (fs.existsSync(podfilePath)) {
  let podfile = fs.readFileSync(podfilePath, 'utf8');
  podfile = podfile.replace(/platform\s*:ios\s*,\s*['"][^'"]+['"]/, "platform :ios, '15.0'");
  const postInstallHook = `post_install do |installer|
  assertDeploymentTarget(installer)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
      config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
      config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
      config.build_settings['CODE_SIGN_IDENTITY'] = ''
      config.build_settings['EXPANDED_CODE_SIGN_IDENTITY'] = ''
    end
  end
end`;
  if (podfile.includes('post_install do |installer|')) {
    podfile = podfile.replace(/post_install do \|installer\|[\s\S]*?end\s*$/, postInstallHook + '\n');
  } else {
    podfile += '\n' + postInstallHook + '\n';
  }
  fs.writeFileSync(podfilePath, podfile, 'utf8');
  log('Configured ios/App/Podfile with platform :ios, 15.0 and unsigned CI Pod settings');
}

// 2. Update ios/App/App.xcodeproj/project.pbxproj
const pbxprojPath = path.join(iosAppDir, 'App.xcodeproj', 'project.pbxproj');
if (fs.existsSync(pbxprojPath)) {
  let pbx = fs.readFileSync(pbxprojPath, 'utf8');
  pbx = pbx.replace(/IPHONEOS_DEPLOYMENT_TARGET\s*=\s*[0-9.]+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;\n\t\t\t\tCODE_SIGNING_ALLOWED = NO;\n\t\t\t\tCODE_SIGNING_REQUIRED = NO;\n\t\t\t\tCODE_SIGN_IDENTITY = "";');
  pbx = pbx.replace(/TARGETED_DEVICE_FAMILY\s*=\s*"?[0-9,]+"?;/g, 'TARGETED_DEVICE_FAMILY = "1,2";');
  fs.writeFileSync(pbxprojPath, pbx, 'utf8');
  log('Configured project.pbxproj with IPHONEOS_DEPLOYMENT_TARGET = 15.0 and TARGETED_DEVICE_FAMILY = "1,2"');
}

// 3. Configure ios/App/App/Info.plist for iPadOS Landscape + Files App sharing
const infoPlistPath = path.join(iosAppDir, 'App', 'Info.plist');
if (fs.existsSync(infoPlistPath)) {
  let plist = fs.readFileSync(infoPlistPath, 'utf8');
  const additions = `
	<key>UIFileSharingEnabled</key>
	<true/>
	<key>LSSupportsOpeningDocumentsInPlace</key>
	<true/>
	<key>UIRequiresFullScreen</key>
	<false/>
	<key>UISupportedInterfaceOrientations~ipad</key>
	<array>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
	</array>`;
  if (!plist.includes('UIFileSharingEnabled')) {
    plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `${additions}\n</dict>\n</plist>\n`);
    fs.writeFileSync(infoPlistPath, plist, 'utf8');
    log('Configured Info.plist with iPadOS Landscape orientations and Files App sharing');
  }
}
