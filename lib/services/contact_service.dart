import 'package:url_launcher/url_launcher.dart';

/// Central contact config — update these with real Almas numbers/URLs.
abstract final class AlmasContact {
  static const String phoneNumber   = '+212600000000';   // TODO: real number
  static const String whatsappNumber = '212600000000';   // without +
  static const String website       = 'https://almas.ma';
  static const String defaultWhatsAppMsg =
      'Bonjour Almas 👋 Je souhaite passer une commande.';
}

class ContactService {
  static Future<void> call() async {
    final uri = Uri(scheme: 'tel', path: AlmasContact.phoneNumber);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  static Future<void> whatsApp({String? message}) async {
    final text = Uri.encodeComponent(
      message ?? AlmasContact.defaultWhatsAppMsg,
    );
    final uri = Uri.parse(
      'https://wa.me/${AlmasContact.whatsappNumber}?text=$text',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  static Future<void> website() async {
    final uri = Uri.parse(AlmasContact.website);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  static Future<void> waze({
    required double lat,
    required double lng,
  }) async {
    final wazeUri = Uri.parse('waze://?ll=$lat,$lng&navigate=yes');
    if (await canLaunchUrl(wazeUri)) {
      await launchUrl(wazeUri);
    } else {
      // Fallback: Google Maps
      final mapsUri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng',
      );
      if (await canLaunchUrl(mapsUri)) {
        await launchUrl(mapsUri, mode: LaunchMode.externalApplication);
      }
    }
  }
}
