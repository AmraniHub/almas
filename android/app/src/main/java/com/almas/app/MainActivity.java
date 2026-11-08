package com.almas.app;

import android.Manifest;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;

import androidx.annotation.NonNull;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.MethodChannel;

/** The shell's native helpers for lib/shell/native_bridge.dart: microphone permission, network state, share sheet. */
public class MainActivity extends FlutterActivity {
    private static final String CHANNEL = "almas/native";
    private static final int MIC_REQUEST = 4101;

    private MethodChannel.Result pendingMic;

    @Override
    public void configureFlutterEngine(@NonNull FlutterEngine flutterEngine) {
        super.configureFlutterEngine(flutterEngine);
        new MethodChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), CHANNEL)
                .setMethodCallHandler((call, result) -> {
                    switch (call.method) {
                        case "requestMicrophone":
                            requestMicrophone(result);
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

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != MIC_REQUEST || pendingMic == null) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
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
