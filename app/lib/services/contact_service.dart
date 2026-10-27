import 'package:url_launcher/url_launcher.dart';

/// The shop's real contact details: Almas Spices & Herbs (معشبة ألماس), Ksar Sghir.
abstract final class AlmasContact {
  static const String phoneNumber = '+212619434035';
  static const String whatsappNumber = '212619434035'; // without +

  /// The shop's own Google Maps place (its Business Profile), not a guessed pin.
  static const String mapsUrl = 'https://maps.google.com/?cid=5907200103412499017';
  static const String defaultWhatsAppMsg = 'Hello Almas 👋 I would like to place an order.';
}

class ContactService {
  static Future<void> call() async {
    final uri = Uri(scheme: 'tel', path: AlmasContact.phoneNumber);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  /// Opens WhatsApp to Almas with an optional pre-filled [message].
  /// Returns `true` if a WhatsApp/browser target was launched.
  static Future<bool> whatsApp({String? message}) async {
    final text = Uri.encodeComponent(
      message ?? AlmasContact.defaultWhatsAppMsg,
    );
    final uri = Uri.parse(
      'https://wa.me/${AlmasContact.whatsappNumber}?text=$text',
    );
    // Some devices report canLaunchUrl == false even when a handler exists,
    // so fall back to attempting the launch directly before giving up.
    if (await canLaunchUrl(uri)) {
      return launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }

  /// The shop on Google Maps, ready for directions.
  static Future<void> directions() async {
    final uri = Uri.parse(AlmasContact.mapsUrl);
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      // no maps app and no browser: nothing to open
    }
  }
}
