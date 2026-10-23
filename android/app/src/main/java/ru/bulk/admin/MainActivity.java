package ru.bulk.admin;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.content.ClipData;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Iterator;

/**
 * Бульк Админ: оболочка для веб-админки.
 * Админка встроена в приложение, а при каждом запуске приложение сверяет версию с сайтом:
 * если вышла новая - скачивает её (файлы проверяются по sha256) и открывает уже новую.
 * Без интернета открывается последняя скачанная или встроенная версия.
 */
public class MainActivity extends Activity {
    static final String SITE = "https://vitalya2078-cloud.github.io/bulk/admin/";
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/admin/index.html";

    WebView web;
    View splash;
    TextView status;
    ProgressBar bar;
    final Handler ui = new Handler(Looper.getMainLooper());
    long pausedAt = 0;
    volatile boolean checking = false;
    // выбор файла для страницы (вложения рассылок): без своего WebChromeClient WebView кнопку выбора файла игнорирует
    static final int PICK_FILE = 41;
    ValueCallback<Uri[]> filePick;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        resetCacheOnAppUpdate();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#08090C"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#08090C"));
        web.setVisibility(View.INVISIBLE);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true); // файлы из галереи приходят как content://
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.addJavascriptInterface(new Bridge(), "BulkApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        splash = buildSplash();
        root.addView(splash, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        checkAndLoad(true);
    }

    View buildSplash() {
        float d = getResources().getDisplayMetrics().density;
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(Color.parseColor("#08090C"));
        box.setClickable(true);

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_fg);
        box.addView(icon, new LinearLayout.LayoutParams((int) (120 * d), (int) (120 * d)));

        TextView title = new TextView(this);
        title.setText("Бульк · Админ");
        title.setTextColor(Color.parseColor("#E9ECF2"));
        title.setTextSize(18);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        box.addView(title);

        status = new TextView(this);
        status.setText("Проверяю обновления");
        status.setTextColor(Color.parseColor("#5A6170"));
        status.setTextSize(12);
        status.setTypeface(Typeface.MONOSPACE);
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, (int) (10 * d), 0, (int) (14 * d));
        box.addView(status);

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setIndeterminate(true);
        bar.setProgressTintList(ColorStateList.valueOf(Color.parseColor("#C4F13B")));
        bar.setIndeterminateTintList(ColorStateList.valueOf(Color.parseColor("#C4F13B")));
        bar.setProgressBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#1E222C")));
        box.addView(bar, new LinearLayout.LayoutParams((int) (180 * d), (int) (6 * d)));
        return box;
    }

    void setStatus(final String t, final int pct) {
        ui.post(() -> {
            status.setText(t);
            if (pct < 0) bar.setIndeterminate(true);
            else { bar.setIndeterminate(false); bar.setMax(100); bar.setProgress(pct); }
        });
    }

    /** Новая версия самого приложения - забываем скачанную админку, берём встроенную (она свежее). */
    void resetCacheOnAppUpdate() {
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            SharedPreferences p = getSharedPreferences("bulk", MODE_PRIVATE);
            long code = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
            if (p.getLong("app_code", -1) != code) {
                deleteDir(new File(getFilesDir(), "admin"));
                p.edit().putLong("app_code", code).apply();
            }
        } catch (Exception ignored) { }
    }

    /** Проверка обновления, потом открытие админки. first - первый запуск (показываем заставку). */
    void checkAndLoad(final boolean first) {
        if (checking) return;
        checking = true;
        if (!first) { splash.setVisibility(View.VISIBLE); setStatus("Проверяю обновления", -1); }
        new Thread(() -> {
            boolean updated = false;
            try { updated = update(); } catch (Throwable ignored) { }
            final boolean u = updated;
            ui.post(() -> {
                checking = false;
                if (first || u) {
                    web.loadUrl(START);
                } else {
                    splash.setVisibility(View.GONE);
                }
            });
        }).start();
    }

    /** true - скачана новая версия. */
    boolean update() throws Exception {
        String localV = localVersion();
        JSONObject remote;
        try {
            remote = new JSONObject(new String(get(SITE + "bundle.json?t=" + System.currentTimeMillis(), 4000, null, 0), "UTF-8"));
        } catch (Exception e) {
            setStatus("Нет связи · открываю сохранённую версию", -1);
            return false;
        }
        String v = remote.getString("v");
        if (v.equals(localV)) return false;

        JSONObject files = remote.getJSONObject("files");
        long total = 0;
        for (Iterator<String> it = files.keys(); it.hasNext(); ) total += files.getJSONObject(it.next()).getLong("size");
        File tmp = new File(getFilesDir(), "admin_new");
        deleteDir(tmp);
        tmp.mkdirs();
        long[] done = {0};
        try {
            for (Iterator<String> it = files.keys(); it.hasNext(); ) {
                String name = it.next();
                if (!name.matches("[A-Za-z0-9._-]+")) throw new Exception("bad name");
                JSONObject f = files.getJSONObject(name);
                String sha = f.getString("sha256");
                byte[] data = get(SITE + name + "?v=" + sha.substring(0, 12), 8000, done, total);
                if (data.length != f.getLong("size") || !sha.equals(sha256(data))) throw new Exception("broken " + name);
                write(new File(tmp, name), data);
            }
            write(new File(tmp, "bundle.json"), remote.toString().getBytes("UTF-8"));
        } catch (Exception e) {
            deleteDir(tmp);
            setStatus("Обновление не скачалось · открываю прежнюю", -1);
            return false;
        }
        File cur = new File(getFilesDir(), "admin");
        File old = new File(getFilesDir(), "admin_old");
        deleteDir(old);
        if (cur.exists() && !cur.renameTo(old)) { deleteDir(tmp); return false; }
        if (!tmp.renameTo(cur)) { old.renameTo(cur); return false; }
        deleteDir(old);
        setStatus("Обновлено", 100);
        return true;
    }

    String localVersion() {
        try {
            File f = new File(getFilesDir(), "admin/bundle.json");
            byte[] b = f.exists() ? read(new FileInputStream(f)) : read(getAssets().open("admin/bundle.json"));
            return new JSONObject(new String(b, "UTF-8")).getString("v");
        } catch (Exception e) { return ""; }
    }

    byte[] get(String url, int timeout, long[] done, long total) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(timeout);
        c.setReadTimeout(timeout);
        c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        try {
            if (c.getResponseCode() != 200) throw new Exception("http " + c.getResponseCode());
            InputStream in = c.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                if (done != null && total > 0) {
                    done[0] += n;
                    setStatus("Скачиваю обновление · " + (done[0] / 1024) + " из " + (total / 1024) + " КБ", (int) Math.min(100, done[0] * 100 / total));
                }
            }
            in.close();
            return out.toByteArray();
        } finally { c.disconnect(); }
    }

    static String sha256(byte[] b) throws Exception {
        byte[] h = MessageDigest.getInstance("SHA-256").digest(b);
        StringBuilder sb = new StringBuilder();
        for (byte x : h) sb.append(String.format("%02x", x));
        return sb.toString();
    }
    static byte[] read(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toByteArray();
    }
    static void write(File f, byte[] b) throws Exception {
        FileOutputStream o = new FileOutputStream(f);
        o.write(b);
        o.close();
    }
    static void deleteDir(File d) {
        if (d == null || !d.exists()) return;
        File[] l = d.listFiles();
        if (l != null) for (File f : l) { if (f.isDirectory()) deleteDir(f); else f.delete(); }
        d.delete();
    }

    static String mime(String name) {
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".js")) return "text/javascript";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".json")) return "application/json";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }

    class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String path = u.getPath() == null ? "" : u.getPath();
            if (!path.startsWith("/admin/")) return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
            String name = path.substring(7);
            if (name.isEmpty()) name = "index.html";
            if (!name.matches("[A-Za-z0-9._-]+")) return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
            try {
                File f = new File(new File(getFilesDir(), "admin"), name);
                InputStream in = f.exists() ? new FileInputStream(f) : getAssets().open("admin/" + name);
                return new WebResourceResponse(mime(name), "utf-8", in);
            } catch (Exception e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost())) return false;
            openExternal(u.toString());
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            web.setVisibility(View.VISIBLE);
            splash.animate().alpha(0f).setDuration(180).withEndAction(() -> { splash.setVisibility(View.GONE); splash.setAlpha(1f); }).start();
        }
    }

    /** Открывает галерею или файлы телефона, когда страница просит выбрать файл. */
    class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (filePick != null) filePick.onReceiveValue(null);
            filePick = callback;
            String[] types = params.getAcceptTypes();
            java.util.ArrayList<String> mimes = new java.util.ArrayList<>();
            if (types != null) for (String t : types) for (String x : t.split(",")) { x = x.trim(); if (x.contains("/")) mimes.add(x); }
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            if (mimes.size() == 1) i.setType(mimes.get(0));
            else { i.setType("*/*"); if (!mimes.isEmpty()) i.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toArray(new String[0])); }
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(Intent.createChooser(i, "Выбери файл"), PICK_FILE);
            } catch (Exception e) {
                filePick = null;
                callback.onReceiveValue(null);
                return false;
            }
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == PICK_FILE) {
            ValueCallback<Uri[]> cb = filePick;
            filePick = null;
            if (cb == null) return;
            Uri[] res = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null && clip.getItemCount() > 0) {
                    res = new Uri[clip.getItemCount()];
                    for (int k = 0; k < clip.getItemCount(); k++) res[k] = clip.getItemAt(k).getUri();
                } else if (data.getData() != null) {
                    res = new Uri[] { data.getData() };
                }
            }
            cb.onReceiveValue(res);
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception ignored) { }
    }

    /** То, что видит страница как window.BulkApp */
    class Bridge {
        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v != null) v.vibrate(VibrationEffect.createOneShot(Math.max(5, Math.min(ms, 200)), VibrationEffect.DEFAULT_AMPLITUDE));
            } catch (Exception ignored) { }
        }
        @JavascriptInterface
        public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }
        @JavascriptInterface
        public String device() {
            String m = Build.MODEL == null ? "" : Build.MODEL;
            String b = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
            if (!m.toLowerCase().startsWith(b.toLowerCase())) m = b.substring(0, Math.min(1, b.length())).toUpperCase() + b.substring(Math.min(1, b.length())) + " " + m;
            return m.trim();
        }
        @JavascriptInterface
        public void open(String url) {
            if (url != null && (url.startsWith("https://") || url.startsWith("http://") || url.startsWith("tg://"))) ui.post(() -> openExternal(url));
        }
    }

    @Override
    public void onBackPressed() {
        if (splash.getVisibility() == View.VISIBLE) { super.onBackPressed(); return; }
        web.evaluateJavascript("(window.onAppBack && window.onAppBack()) ? 1 : 0", (r) -> {
            if (!"1".equals(r)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        pausedAt = SystemClock.elapsedRealtime();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // приложение долго лежало в фоне - при возвращении тоже проверяем обновление
        if (pausedAt > 0 && SystemClock.elapsedRealtime() - pausedAt > 10 * 60 * 1000) checkAndLoad(false);
        pausedAt = 0;
    }
}
