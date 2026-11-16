package org.encroissant.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String EC_MAIN_DIR = "/storage/emulated/0/EnCroissant";
    private boolean askedAllFilesPermission = false;
    private boolean bridgeRegistered = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        } catch (Exception ignored) {}
        requestStorageAccessAndCreateDirs();
        configureDesktopWebView();
    }

    @Override
    public void onStart() {
        super.onStart();
        configureDesktopWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        ensureEnCroissantDirectoriesAndAssets();
    }

    private void configureDesktopWebView() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                WebSettings ws = webView.getSettings();
                ws.setUseWideViewPort(true);
                ws.setLoadWithOverviewMode(true);
                ws.setJavaScriptEnabled(true);
                ws.setDomStorageEnabled(true);
                ws.setDatabaseEnabled(true);
                ws.setAllowFileAccess(true);
                ws.setAllowContentAccess(true);
                ws.setSupportZoom(true);
                ws.setBuiltInZoomControls(true);
                ws.setDisplayZoomControls(false);
                ws.setMediaPlaybackRequiresUserGesture(false);
                if (!bridgeRegistered) {
                    webView.addJavascriptInterface(new AndroidStorageBridge(), "AndroidBridge");
                    bridgeRegistered = true;
                    webView.reload();
                }
            }
        } catch (Exception ignored) {}
    }

    private void requestStorageAccessAndCreateDirs() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager() && !askedAllFilesPermission) {
                    askedAllFilesPermission = true;
                    Toast.makeText(this, "Grant All Files Access so En Croissant can create /storage/emulated/0/EnCroissant", Toast.LENGTH_LONG).show();
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                }
            } else {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this, new String[]{
                        Manifest.permission.READ_EXTERNAL_STORAGE,
                        Manifest.permission.WRITE_EXTERNAL_STORAGE
                    }, 1001);
                }
            }
        } catch (Exception ignored) {}
        ensureEnCroissantDirectoriesAndAssets();
    }

    private File resolveWritableRoot() {
        File mainRoot = new File(EC_MAIN_DIR);
        if (mainRoot.exists() || mainRoot.mkdirs()) {
            return mainRoot;
        }
        File fallback = new File(getExternalFilesDir(null), "EnCroissant");
        if (!fallback.exists()) fallback.mkdirs();
        return fallback;
    }

    private void copyDirectoryRecursive(File src, File dst) {
        if (src == null || !src.exists()) return;
        if (src.isDirectory()) {
            if (!dst.exists()) dst.mkdirs();
            File[] children = src.listFiles();
            if (children != null) {
                for (File child : children) {
                    copyDirectoryRecursive(child, new File(dst, child.getName()));
                }
            }
        } else if (src.isFile()) {
            if (!dst.exists() || dst.length() < src.length()) {
                try (InputStream in = new FileInputStream(src);
                     FileOutputStream out = new FileOutputStream(dst)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                    }
                } catch (Exception ignored) {}
            }
        }
    }

    private void ensureEnCroissantDirectoriesAndAssets() {
        try {
            File root = resolveWritableRoot();
            File fallback = new File(getExternalFilesDir(null), "EnCroissant");
            if (root.getAbsolutePath().equals(EC_MAIN_DIR) && fallback.exists()) {
                copyDirectoryRecursive(fallback, root);
            }
            String[] subdirs = new String[]{"db", "engines", "puzzles", "documents", "config"};
            for (String sub : subdirs) {
                File d = new File(root, sub);
                if (!d.exists()) d.mkdirs();
            }
            String[] engineAssets = new String[]{
                "stockfish-19-lite-single.js",
                "stockfish-19-lite-single.wasm",
                "stockfish-19-asm.js",
                "stockfish-18-lite-single.js",
                "stockfish-18-lite-single.wasm",
                "stockfish-18-asm.js",
                "stockfish-19-fast.js",
                "lozza.js"
            };
            File enginesDir = new File(root, "engines");
            for (String assetName : engineAssets) {
                File outFile = new File(enginesDir, assetName);
                if (!outFile.exists() || outFile.length() == 0) {
                    try (InputStream in = getAssets().open("public/engines/" + assetName);
                         FileOutputStream out = new FileOutputStream(outFile)) {
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            out.write(buf, 0, n);
                        }
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception ignored) {}
    }

    private File mapPath(String rawPath) {
        File root = resolveWritableRoot();
        if (rawPath == null || rawPath.isEmpty()) return root;
        if (rawPath.startsWith(EC_MAIN_DIR)) {
            String rel = rawPath.substring(EC_MAIN_DIR.length());
            return rel.isEmpty() ? root : new File(root, rel);
        }
        if (rawPath.startsWith("/data/")) {
            String rel = rawPath.substring("/data/".length());
            return new File(root, rel);
        }
        return new File(rawPath);
    }

    public class AndroidStorageBridge {
        @JavascriptInterface
        public String getRootDir() {
            return resolveWritableRoot().getAbsolutePath();
        }

        @JavascriptInterface
        public boolean exists(String path) {
            try {
                return mapPath(path).exists();
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean mkdir(String path) {
            try {
                File f = mapPath(path);
                return f.exists() || f.mkdirs();
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean appendTextFile(String path, String content) {
            try {
                File f = mapPath(path);
                File parent = f.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();
                try (FileOutputStream fos = new FileOutputStream(f, true)) {
                    fos.write((content != null ? content : "").getBytes(StandardCharsets.UTF_8));
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean writeTextFile(String path, String content) {
            try {
                File f = mapPath(path);
                File parent = f.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();
                try (FileOutputStream fos = new FileOutputStream(f)) {
                    fos.write((content != null ? content : "").getBytes(StandardCharsets.UTF_8));
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String readTextFile(String path) {
            try {
                File f = mapPath(path);
                if (!f.exists() || !f.isFile()) return "";
                try (FileInputStream fis = new FileInputStream(f);
                     ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = fis.read(buf)) > 0) {
                        bos.write(buf, 0, n);
                    }
                    return bos.toString("UTF-8");
                }
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String listFiles(String path) {
            try {
                File dir = mapPath(path);
                JSONArray arr = new JSONArray();
                if (dir.exists() && dir.isDirectory()) {
                    File[] children = dir.listFiles();
                    if (children != null) {
                        for (File c : children) {
                            JSONObject obj = new JSONObject();
                            obj.put("name", c.getName());
                            obj.put("isFile", c.isFile());
                            obj.put("isDirectory", c.isDirectory());
                            arr.put(obj);
                        }
                    }
                }
                return arr.toString();
            } catch (Exception e) {
                return "[]";
            }
        }

        @JavascriptInterface
        public boolean deleteFile(String path) {
            try {
                File f = mapPath(path);
                return f.exists() && f.delete();
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void openFolder(final String path) {
            runOnUiThread(() -> {
                try {
                    ensureEnCroissantDirectoriesAndAssets();
                    File target = mapPath(path);
                    if (target.isFile() && target.getParentFile() != null) {
                        target = target.getParentFile();
                    }
                    if (!target.exists()) target.mkdirs();
                    Toast.makeText(MainActivity.this, "Opening folder: " + target.getAbsolutePath(), Toast.LENGTH_LONG).show();

                    String rel = target.getAbsolutePath().replace("/storage/emulated/0/", "");
                    Uri docUri = Uri.parse("content://com.android.externalstorage.documents/document/primary:" + Uri.encode(rel));
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(docUri, DocumentsContract.Document.MIME_TYPE_DIR);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    try {
                        startActivity(intent);
                        return;
                    } catch (Exception ignored) {}

                    Intent fallbackIntent = new Intent(Intent.ACTION_GET_CONTENT);
                    fallbackIntent.setType("*/*");
                    fallbackIntent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, docUri);
                    fallbackIntent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivity(Intent.createChooser(fallbackIntent, "En Croissant Folder: " + target.getAbsolutePath()));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Folder stored at: /storage/emulated/0/EnCroissant", Toast.LENGTH_LONG).show();
                }
            });
        }
    }
}
