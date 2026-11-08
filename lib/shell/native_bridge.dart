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
