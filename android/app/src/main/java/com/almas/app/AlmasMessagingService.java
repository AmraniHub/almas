package com.almas.app;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Firebase hands the shop's messages over here, even when the app is closed. The back office sends data only
 * (kind, title, body, link, id), so the app draws the notification itself with the shop's icon and channel.
 * A message typed in the Firebase console carries a notification block instead; it is shown the same way.
 */
public class AlmasMessagingService extends FirebaseMessagingService {
    @Override
    public void onNewToken(@NonNull String token) {
        Push.tokenChanged(this); // the page hands the new token to the shop the next time the app opens
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> d = message.getData();
        String title = d.get("title");
        String body = d.get("body");
        if ((title == null || title.isEmpty()) && message.getNotification() != null) {
            title = message.getNotification().getTitle();
            body = message.getNotification().getBody();
        }
        Push.show(this, d.get("kind"), title, body == null ? "" : body, d.get("link"), d.get("id"));
    }
}
