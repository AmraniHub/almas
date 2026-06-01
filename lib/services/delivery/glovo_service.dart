import 'dart:convert';
import 'package:http/http.dart' as http;

class GlovoOrder {
  const GlovoOrder({
    required this.id,
    required this.trackingUrl,
    required this.estimatedMinutes,
  });

  final String id;
  final String trackingUrl;
  final int estimatedMinutes;

  factory GlovoOrder.fromJson(Map<String, dynamic> json) => GlovoOrder(
        id: (json['id'] ?? '').toString(),
        trackingUrl: (json['tracking_url'] ?? '').toString(),
        estimatedMinutes: json['estimated_delivery_time'] as int? ?? 60,
      );
}

/// Glovo Partners API — same-city express delivery (< 5 kg).
/// Best for urgent small reorders within Glovo-covered Moroccan cities.
/// Not suited for bulk B2B freight — use CODRocket for that.
///
/// Covered cities (Morocco): Casablanca, Rabat, Marrakech, Agadir, Fès, Tanger.
///
/// Setup:
///   1. Apply at https://partners.glovoapp.com → "Become a partner"
///   2. Glovo creates your store in staging for testing
///   3. Replace [_storeId] and [_apiKey] with your production credentials
class GlovoService {
  // TODO: fill in after onboarding at partners.glovoapp.com
  static const _storeId = 'GLOVO_STORE_ID_HERE';
  static const _apiKey  = 'GLOVO_API_KEY_HERE';
  static const _baseUrl = 'https://api.glovoapp.com/b2b/stores/$_storeId';

  static Map<String, String> get _headers => {
        'Authorization': 'Bearer $_apiKey',
        'Content-Type': 'application/json',
        'Glovo-Store-Id': _storeId,
      };

  /// Dispatches an express delivery via Glovo.
  /// Check [supportsCity] before calling — only works in covered cities.
  static Future<GlovoOrder?> createOrder({
    required String pickupAddress,
    required String dropAddress,
    required String customerPhone,
    required String orderDescription,
    required double codAmount,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/orders'),
        headers: _headers,
        body: jsonEncode({
          'pickup': {'address': pickupAddress},
          'delivery': {
            'address': dropAddress,
            'phone': customerPhone,
            'instructions': orderDescription,
          },
          'payment': {'type': 'CASH', 'amount': codAmount},
        }),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        return GlovoOrder.fromJson(
          jsonDecode(response.body) as Map<String, dynamic>,
        );
      }
    } catch (_) {}
    return null;
  }

  /// Returns true if Glovo operates in this Moroccan city.
  static bool supportsCity(String city) {
    const covered = {
      'casablanca', 'rabat', 'marrakech',
      'agadir', 'fès', 'fez', 'tanger', 'tangier',
    };
    return covered.contains(city.toLowerCase().trim());
  }
}
