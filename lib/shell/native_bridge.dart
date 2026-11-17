import 'package:flutter/services.dart';

/// What the shell asks Android directly (MainActivity.java): the microphone
/// permission, whether any network is up, and the share sheet.
class NativeBridge {
  static const MethodChannel _channel = MethodChannel('almas/native');

  /// Asks for RECORD_AUDIO when the page wants the microphone. True when granted.
  static Future<bool> requestMicrophone() async {
    try {
      return await _channel.invokeMethod<bool>('requestMicrophone') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// Opens the Android share sheet with [text] and the given files
  /// (each `{name, mime, bytes}`). Throws a PlatformException when Android refuses.
  static Future<void> share({
    required String text,
    String? subject,
    List<Map<String, Object>> files = const [],
  }) async {
    await _channel.invokeMethod<bool>('share', {
      'text': text,
      'subject': subject,
      'files': files,
    });
  }

  /// The page of the notification the app was opened from ('' = the shop's home), once; null when none.
  static Future<String?> takeLink() async {
    try {
      return await _channel.invokeMethod<String>('takeLink');
    } on PlatformException {
      return null;
    } on MissingPluginException {
      return null;
    }
  }

  /// Calls [onLink] when a notification is tapped while the app is already open.
  static void listenForLinks(void Function(String link) onLink) {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'openLink' && call.arguments is String) onLink(call.arguments as String);
      return null;
    });
  }

  /// 'granted' or 'denied'. With [ask], Android 13+ shows its permission question first.
  static Future<String> pushPermission({bool ask = false}) async {
    try {
      return await _channel.invokeMethod<String>('pushPermission', {'ask': ask}) ?? 'denied';
    } on PlatformException {
      return 'denied';
    } on MissingPluginException {
      return 'denied';
    }
  }

  /// This phone's Firebase token (what the shop sends to), or null when Firebase is not reachable yet.
  static Future<String?> pushToken() async {
    try {
      return await _channel.invokeMethod<String>('pushToken');
    } on PlatformException {
      return null;
    } on MissingPluginException {
      return null;
    }
  }

  /// Listen to the shop's messages for everyone and for [lang] (ar, fr, en, es).
  static Future<void> pushTopics(String lang) async {
    try {
      await _channel.invokeMethod<bool>('pushTopics', {'lang': lang});
    } on PlatformException {
      // retried on the next page
    } on MissingPluginException {
      // not on Android
    }
  }

  /// False only when Android reports no network with internet capability.
  /// When the answer is unknown the page is simply tried.
  static Future<bool> isOnline() async {
    try {
      return await _channel.invokeMethod<bool>('isOnline') ?? true;
    } on PlatformException {
      return true;
    } on MissingPluginException {
      return true;
    }
  }
}
