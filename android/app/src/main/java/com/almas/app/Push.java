package com.almas.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.google.firebase.messaging.FirebaseMessaging;

import java.util.Locale;

/**
 * Notifications from the shop (cloud/worker.js sends them through Firebase): two channels, the notification itself,
 * and the topics this phone listens to. "all" reaches everyone; "lang_ar" (fr, en, es) follows the site language
 * the customer last used, so the shop can write to each language in its own words.
 */
final class Push {
    static final String CH_ORDERS = "orders";
    static final String CH_NEWS = "news";
    static final String EXTRA_LINK = "almas_link";
    private static final String[] LANGS = {"ar", "fr", "en", "es"};
    private static final String PREFS = "almas_push";

    private Push() {}

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        boolean ar = "ar".equals(Locale.getDefault().getLanguage());
        NotificationChannel orders = new NotificationChannel(CH_ORDERS, ar ? "طلباتي" : "My orders", NotificationManager.IMPORTANCE_HIGH);
        orders.setDescription(ar ? "حالة طلباتك من معشبة ألماس" : "The status of your Almas orders");
        NotificationChannel news = new NotificationChannel(CH_NEWS, ar ? "عروض وأخبار" : "Offers and news", NotificationManager.IMPORTANCE_DEFAULT);
        news.setDescription(ar ? "عروض المتجر ومنتجات جديدة" : "Offers and new products from the shop");
        nm.createNotificationChannel(orders);
        nm.createNotificationChannel(news);
    }

    /** Shows one notification; a tap opens the app on [link] (a page of the shop) or its home page. */
    static void show(Context c, String kind, String title, String body, String link, String ref) {
        if (title == null || title.isEmpty()) return;
        channels(c);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        boolean order = "order".equals(kind);
        int id = ((order ? "order:" + ref : "news:" + title + body)).hashCode();
        Intent open = new Intent(c, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra(EXTRA_LINK, link == null ? "" : link)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(c, order ? CH_ORDERS : CH_NEWS)
                : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat_almas)
                .setColor(0xFFA14E33)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(tap);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(order ? Notification.PRIORITY_HIGH : Notification.PRIORITY_DEFAULT);
        try {
            nm.notify(id, b.build());
        } catch (SecurityException e) {
            // notifications switched off for the app: nothing to show
        }
    }

    /** Listens to "all" and to this language's topic only. Repeated calls with the same language do nothing. */
    static void topics(Context c, String lang) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (lang.equals(p.getString("lang", ""))) return;
        FirebaseMessaging fm = FirebaseMessaging.getInstance();
        fm.subscribeToTopic("all");
        for (String l : LANGS) {
            if (l.equals(lang)) fm.subscribeToTopic("lang_" + l);
            else fm.unsubscribeFromTopic("lang_" + l);
        }
        p.edit().putString("lang", lang).apply();
    }

    /** A new token means a fresh Firebase registration: topics must be joined again. */
    static void tokenChanged(Context c) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("lang").apply();
    }
}
