import 'dart:convert';
import 'package:http/http.dart' as http;

class CodRocketShipment {
  const CodRocketShipment({
    required this.id,
    required this.trackingCode,
    required this.status,
  });

  final String id;
  final String trackingCode;
  final String status;

  factory CodRocketShipment.fromJson(Map<String, dynamic> json) =>
      CodRocketShipment(
        id: (json['id'] ?? '').toString(),
        trackingCode: (json['tracking_code'] ?? '').toString(),
        status: (json['status'] ?? 'pending').toString(),
      );
}

/// CODRocket — Moroccan COD delivery management platform.
/// Connects to OzonExpress, Cathedis, Tawssil, Ameex and other local couriers
/// through a single API key.
///
/// Setup:
///   1. Create merchant account at https://codrocket.com
///   2. Settings → API → Generate token
///   3. Replace [_apiToken] below with your token
class CodRocketService {
  static const _baseUrl  = 'https://app.codrocket.com/api/v1';
  // TODO: replace with your CODRocket API token
  static const _apiToken = 'CODROCKET_API_TOKEN_HERE';

  static Map<String, String> get _headers => {
        'Authorization': 'Bearer $_apiToken',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

  /// Creates a new COD shipment. Returns the shipment or null on failure.
  static Future<CodRocketShipment?> createShipment({
    required String customerName,
    required String phone,
    required String city,
    required String address,
    required double codAmount,
    String? notes,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/orders'),
        headers: _headers,
        body: jsonEncode({
          'customer_name': customerName,
          'phone': phone,
          'city': city,
          'address': address,
          'cod_amount': codAmount,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        }),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] as Map<String, dynamic>? ?? body;
        return CodRocketShipment.fromJson(data);
      }
    } catch (_) {}
    return null;
  }

  /// Returns current delivery status string, or null on failure.
  static Future<String?> getStatus(String trackingCode) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/orders/$trackingCode'),
        headers: _headers,
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] as Map<String, dynamic>? ?? body;
        return data['status'] as String?;
      }
    } catch (_) {}
    return null;
  }
}
