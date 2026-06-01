import 'package:url_launcher/url_launcher.dart';

import '../models/cart_item.dart';

/// Central Almas contact & business config.
/// Update these values with real info before releasing to Play Store.
abstract final class AlmasContact {
  // ── Contact ──────────────────────────────────────────────────────────────
  static const String phoneNumber    = '+212522000000'; // TODO: real landline
  static const String whatsappNumber = '212600000000';  // TODO: real WhatsApp (no +)
  static const String website        = 'https://almas.ma';
  static const String email          = 'contact@almas.ma';
  static const String instagram      = 'https://instagram.com/almas.spices';

  // ── Business hours ───────────────────────────────────────────────────────
  static const String hoursWeekday   = 'Lun–Ven  08:00–18:00';
  static const String hoursSaturday  = 'Sam       08:00–14:00';

  // ── Location ─────────────────────────────────────────────────────────────
  static const double warehouseLat   = 33.5731;  // Casablanca — update if needed
  static const double warehouseLng   = -7.5898;

  // ── WhatsApp default messages ─────────────────────────────────────────────
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

  /// Opens WhatsApp with a pre-filled order summary message.
  /// Used by the cart checkout button as a functional order flow
  /// until backend/CODRocket integration is wired up.
  static Future<void> orderWhatsApp(List<CartItem> items) async {
    final buffer = StringBuffer()
      ..writeln('🧾 *Nouvelle commande Almas*\n');
    for (final item in items) {
      buffer.writeln(
        '• ${item.product.name} × ${item.quantity} = ${item.lineTotal.toStringAsFixed(0)} MAD',
      );
    }
    final subtotal = items.fold<double>(0, (s, i) => s + i.lineTotal);
    final delivery = subtotal >= 500 ? 'Incluse ✓' : '35 MAD';
    final total    = subtotal + (subtotal >= 500 ? 0 : 35);
    buffer
      ..writeln()
      ..writeln('Sous-total : ${subtotal.toStringAsFixed(0)} MAD')
      ..writeln('Livraison  : $delivery')
      ..writeln('*Total COD : ${total.toStringAsFixed(0)} MAD*')
      ..writeln()
      ..writeln('💳 Paiement espèces à la livraison');
    await whatsApp(message: buffer.toString());
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
