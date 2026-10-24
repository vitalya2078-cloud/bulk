package ru.bulk.game;

import android.app.Activity;
import android.app.Dialog;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.InputStream;
import java.security.SecureRandom;

/**
 * Бульк: игра целиком внутри приложения.
 * Все файлы игры лежат в APK (assets/www) и отдаются странице с адреса
 * https://appassets.androidplatform.net/ - игра работает без интернета.
 * С интернетом: сохранение в базе, топы, ковен, почта и вход через ВКонтакте
 * (прогресс из мини-приложения ВК подтягивается на телефон).
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";
    // вход через ВК: приложение игры во ВКонтакте, код подтверждения обменивает наш сервер
    static final String VK_APP = "54828995";
    static final String VK_REDIRECT = "https://oauth.vk.com/blank.html";

    WebView web;
    final Handler ui = new Handler(Looper.getMainLooper());
    static final int PICK_FILE = 41;
    ValueCallback<Uri[]> filePick;
    Dialog login;
    String loginState;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#24163A"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#24163A"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true); // вложения в поддержку приходят как content://
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " BulkApp/" + version());
        web.addJavascriptInterface(new Bridge(), "BulkApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        if (b != null) web.restoreState(b);
        else web.loadUrl(START);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    String version() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
    }

    static String mime(String name) {
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".js")) return "text/javascript";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".json")) return "application/json";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".webp")) return "image/webp";
        if (name.endsWith(".jpg")) return "image/jpeg";
        if (name.endsWith(".mp3")) return "audio/mpeg";
        if (name.endsWith(".woff2")) return "font/woff2";
        if (name.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }

    static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
    }

    class Client extends WebViewClient {
        /** Файлы игры - из APK. Всё остальное (база, ВК) - как обычно, через интернет. */
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String path = u.getPath() == null ? "/" : u.getPath();
            if (path.equals("/")) path = "/index.html";
            String name = path.substring(1);
            if (!name.matches("[A-Za-z0-9._/-]+") || name.contains("..") || name.startsWith("/")) return notFound();
            try {
                InputStream in = getAssets().open("www/" + name);
                WebResourceResponse r = new WebResourceResponse(mime(name), "utf-8", in);
                java.util.HashMap<String, String> h = new java.util.HashMap<>();
                h.put("Cache-Control", "no-cache");
                r.setResponseHeaders(h);
                return r;
            } catch (Exception e) {
                return notFound();
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost())) return false;
            openExternal(u.toString());
            return true;
        }
    }

    /** Выбор файла для поддержки (скриншот ошибки). */
    class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (filePick != null) filePick.onReceiveValue(null);
            filePick = callback;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("image/*");
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(Intent.createChooser(i, "Выбери картинку"), PICK_FILE);
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

    // ---------- вход через ВКонтакте ----------
    // Окно со страницей входа ВК. После входа ВК отправляет на blank.html с одноразовым кодом;
    // код уходит в игру, а игра меняет его на сервере на подтверждённый номер игрока ВК.
    void openLogin() {
        if (login != null) return;
        byte[] rnd = new byte[12];
        new SecureRandom().nextBytes(rnd);
        StringBuilder st = new StringBuilder();
        for (byte x : rnd) st.append(String.format("%02x", x));
        loginState = st.toString();
        String url = "https://oauth.vk.com/authorize?client_id=" + VK_APP
                + "&display=mobile&redirect_uri=" + Uri.encode(VK_REDIRECT)
                + "&response_type=code&v=5.199&state=" + loginState;

        login = new Dialog(this, android.R.style.Theme_Material_NoActionBar);
        FrameLayout box = new FrameLayout(this);
        box.setBackgroundColor(Color.WHITE);
        final WebView w = new WebView(this);
        w.getSettings().setJavaScriptEnabled(true);
        w.getSettings().setDomStorageEnabled(true);
        w.setWebViewClient(new WebViewClient() {
            boolean done = false;
            boolean check(String u) {
                if (done || u == null || !u.startsWith(VK_REDIRECT)) return false;
                done = true;
                Uri p = Uri.parse(u.replace('#', u.contains("?") ? '&' : '?'));
                JSONObject r = new JSONObject();
                try {
                    String code = p.getQueryParameter("code"), state = p.getQueryParameter("state");
                    if (code != null && loginState != null && loginState.equals(state)) r.put("code", code);
                    else r.put("error", p.getQueryParameter("error") != null ? p.getQueryParameter("error") : "no_code");
                } catch (Exception ignored) { }
                finishLogin(r);
                return true;
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return check(req.getUrl().toString());
            }
            @Override
            public void onPageStarted(WebView view, String u, android.graphics.Bitmap icon) {
                if (check(u)) view.stopLoading();
            }
        });
        box.addView(w, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        TextView close = new TextView(this);
        close.setText("✕");
        close.setTextSize(22);
        close.setTextColor(Color.parseColor("#555555"));
        close.setGravity(Gravity.CENTER);
        float d = getResources().getDisplayMetrics().density;
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams((int) (48 * d), (int) (48 * d), Gravity.TOP | Gravity.END);
        box.addView(close, lp);
        close.setOnClickListener((v) -> cancelLogin());
        login.setContentView(box);
        login.setOnCancelListener((dlg) -> cancelLogin());
        Window win = login.getWindow();
        if (win != null) win.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
        login.show();
        w.loadUrl(url);
    }

    void cancelLogin() {
        JSONObject r = new JSONObject();
        try { r.put("error", "cancel"); } catch (Exception ignored) { }
        finishLogin(r);
    }

    void finishLogin(final JSONObject r) {
        ui.post(() -> {
            if (login == null) return;
            try { login.dismiss(); } catch (Exception ignored) { }
            login = null;
            loginState = null;
            web.evaluateJavascript("window.__vkLoginDone && window.__vkLoginDone(" + r.toString() + ")", null);
        });
    }

    /** То, что видит игра как window.BulkApp */
    class Bridge {
        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v == null) return;
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.max(5, Math.min(ms, 200)), VibrationEffect.DEFAULT_AMPLITUDE));
                else v.vibrate(Math.max(5, Math.min(ms, 200)));
            } catch (Exception ignored) { }
        }
        @JavascriptInterface
        public String version() { return MainActivity.this.version(); }
        @JavascriptInterface
        public void open(String url) {
            if (url != null && (url.startsWith("https://") || url.startsWith("http://"))) ui.post(() -> openExternal(url));
        }
        @JavascriptInterface
        public void vkLogin() { ui.post(MainActivity.this::openLogin); }
        /** Выход: забыть вход ВК в окне входа (следующий вход спросит логин заново). */
        @JavascriptInterface
        public void vkLogout() {
            ui.post(() -> { try { CookieManager.getInstance().removeAllCookies(null); } catch (Exception ignored) { } });
        }
        @JavascriptInterface
        public void exit() { ui.post(() -> moveTaskToBack(true)); }
    }

    @Override
    public void onBackPressed() {
        // «Назад» в игре: закрыть окно, вернуться на главный экран; на главном - свернуть игру
        if (web.canGoBack()) web.goBack();
        else moveTaskToBack(true);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (login != null) { try { login.dismiss(); } catch (Exception ignored) { } login = null; }
        super.onDestroy();
    }
}
