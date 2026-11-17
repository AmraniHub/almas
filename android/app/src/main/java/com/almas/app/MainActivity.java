package com.almas.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessaging;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.MethodChannel;

/**
 * The shell's native helpers for lib/shell/native_bridge.dart: microphone permission, network state, share sheet,
 * and the shop's notifications (token, permission, topics, the page a tapped notification opens).
 */
public class MainActivity extends FlutterActivity {
    private static final String CHANNEL = "almas/native";
    private static final int MIC_REQUEST = 4101;
    private static final int PUSH_REQUEST = 4102;

    private MethodChannel.Result pendingMic;
    private MethodChannel.Result pendingPush;
    private MethodChannel channel;
    /** the page of a tapped notification, until the page side takes it */
    private String pendingLink;

    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        pendingLink = linkOf(getIntent());
        Push.channels(this);
    }

    @Override
    protected void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String link = linkOf(intent);
        if (link == null) return;
        if (channel != null) channel.invokeMethod("openLink", link);
        else pendingLink = link;
    }

    private static String linkOf(Intent i) {
        if (i == null || !i.hasExtra(Push.EXTRA_LINK)) return null;
        String l = i.getStringExtra(Push.EXTRA_LINK);
        return l == null ? "" : l; // "" = a notification without a page: the shop's home
    }

    @Override
    public void configureFlutterEngine(@NonNull FlutterEngine flutterEngine) {
        super.configureFlutterEngine(flutterEngine);
        channel = new MethodChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), CHANNEL);
        channel.setMethodCallHandler((call, result) -> {
                    switch (call.method) {
                        case "requestMicrophone":
                            requestMicrophone(result);
                            break;
                        case "takeLink":
                            result.success(pendingLink);
                            pendingLink = null;
                            break;
                        case "pushPermission":
                            pushPermission(Boolean.TRUE.equals(call.argument("ask")), result);
                            break;
                        case "pushToken":
                            try {
                                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(t ->
                                        result.success(t.isSuccessful() ? t.getResult() : null));
                            } catch (Exception e) {
                                result.success(null);
                            }
                            break;
                        case "pushTopics":
                            try {
                                // not String.valueOf(call.argument(..)): Java picks valueOf(char[]) and the cast fails
                                Object lang = call.argument("lang");
                                Push.topics(this, lang == null ? "" : lang.toString());
                                result.success(true);
                            } catch (Exception e) {
                                android.util.Log.w("AlmasPush", "topics failed", e);
                                result.success(false);
                            }
                            break;
                        case "isOnline":
                            result.success(isOnline());
                            break;
                        case "share":
                            try {
                                share(call.argument("text"), call.argument("subject"), call.argument("files"));
                                result.success(true);
                            } catch (Exception e) {
                                result.error("share", e.getMessage(), null);
                            }
                            break;
                        default:
                            result.notImplemented();
                    }
                });
    }

    private void requestMicrophone(MethodChannel.Result result) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            result.success(true);
            return;
        }
        if (pendingMic != null) {
            // a request is already on screen; this one is refused rather than queued
            result.success(false);
            return;
        }
        pendingMic = result;
        requestPermissions(new String[] {Manifest.permission.RECORD_AUDIO}, MIC_REQUEST);
    }

    /** "granted" or "denied"; with ask, Android 13+ shows its question first (Android itself never asks twice after a no). */
    private void pushPermission(boolean ask, MethodChannel.Result result) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        boolean on = nm == null || nm.areNotificationsEnabled();
        if (Build.VERSION.SDK_INT < 33 || on || !ask) {
            result.success(on ? "granted" : "denied");
            return;
        }
        if (pendingPush != null) {
            result.success("denied");
            return;
        }
        pendingPush = result;
        requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, PUSH_REQUEST);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (requestCode == PUSH_REQUEST && pendingPush != null) {
            pendingPush.success(granted ? "granted" : "denied");
            pendingPush = null;
            return;
        }
        if (requestCode != MIC_REQUEST || pendingMic == null) return;
        pendingMic.success(granted);
        pendingMic = null;
    }

    /**
     * Opens the Android share sheet. files: list of {name, mime, bytes}; each is written to
     * cache/share and handed over through ShareProvider with a read grant.
     */
    private void share(String text, String subject, List<Map<String, Object>> files) throws IOException {
        Intent send;
        if (files == null || files.isEmpty()) {
            send = new Intent(Intent.ACTION_SEND).setType("text/plain");
        } else {
            File dir = new File(getCacheDir(), ShareProvider.DIR);
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("cannot create " + dir);
            ArrayList<Uri> uris = new ArrayList<>();
            String type = null;
            for (Map<String, Object> f : files) {
                String name = String.valueOf(f.get("name"));
                String mime = String.valueOf(f.get("mime"));
                byte[] bytes = (byte[]) f.get("bytes");
                if (bytes == null || name.isEmpty() || name.startsWith(".") || name.contains("/")) continue;
                try (FileOutputStream out = new FileOutputStream(new File(dir, name))) {
                    out.write(bytes);
                }
                uris.add(ShareProvider.uriFor(name));
                type = type == null || type.equals(mime) ? mime : "*/*";
            }
            if (uris.isEmpty()) throw new IOException("no file to share");
            if (uris.size() == 1) {
                send = new Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris.get(0));
            } else {
                send = new Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
            }
            send.setType(type);
            ClipData clip = ClipData.newRawUri(null, uris.get(0));
            for (int i = 1; i < uris.size(); i++) clip.addItem(new ClipData.Item(uris.get(i)));
            send.setClipData(clip);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
        if (subject != null && !subject.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, subject);
        Intent chooser = Intent.createChooser(send, null);
        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(chooser);
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }
}
