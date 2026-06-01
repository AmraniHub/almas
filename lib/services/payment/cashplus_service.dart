import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// CashPlus payment service — Moroccan cash-at-agent payment network.
///
/// How it works for customers:
///   1. App generates a CP code (e.g. CP-8471-2930)
///   2. Customer goes to any CashPlus agent (present in every city/town in Morocco)
///   3. Customer gives the CP code and pays cash
///   4. Merchant receives the funds electronically within minutes
///
/// SETUP:
///   1. Contact CashPlus at https://cashplus.ma → "Devenir partenaire"
///   2. Get your merchant credentials (merchantId + apiKey)
///   3. Replace [_merchantId] and [_apiKey] below
///
/// API docs: https://docs.cashplus.ma (requires merchant account)
class CashPlusService {
  // TODO: replace with your CashPlus merchant credentials
  static const String _merchantId  = 'CASHPLUS_MERCHANT_ID';
  static const String _apiKey      = 'CASHPLUS_API_KEY';
  static const String _baseUrl     = 'https://api.cashplus.ma/v1';

  /// Generates a CashPlus payment code for [amountMad].
  /// Returns a [CashPlusCode] with the CP code and expiry, or null on failure.
  static Future<CashPlusCode?> generateCode({
    required double amountMad,
    required String orderId,
    Duration validity = const Duration(hours: 48),
  }) async {
    // ── Demo mode (no merchant credentials) ──────────────────────────────
    if (_merchantId == 'CASHPLUS_MERCHANT_ID') {
      return _demoCode(amountMad: amountMad, orderId: orderId);
    }

    // ── Live mode ─────────────────────────────────────────────────────────
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/payment-codes'),
        headers: {
          'Authorization': 'Bearer $_apiKey',
          'Content-Type':  'application/json',
          'X-Merchant-Id': _merchantId,
        },
        body: jsonEncode({
          'merchant_id': _merchantId,
          'amount':      amountMad,
          'currency':    'MAD',
          'reference':   orderId,
          'validity_hours': validity.inHours,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return CashPlusCode(
          code:      json['code'] as String,
          amount:    amountMad,
          orderId:   orderId,
          expiresAt: DateTime.now().add(validity),
          status:    CashPlusStatus.pending,
        );
      }
      debugPrint('[CashPlus] generateCode HTTP ${response.statusCode}: ${response.body}');
    } catch (e) {
      debugPrint('[CashPlus] generateCode error: $e');
    }
    return null;
  }

  /// Checks if a CP code has been paid.
  static Future<CashPlusStatus> checkStatus(String cpCode) async {
    if (_merchantId == 'CASHPLUS_MERCHANT_ID') {
      return CashPlusStatus.pending; // demo mode
    }
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/payment-codes/$cpCode/status'),
        headers: {
          'Authorization': 'Bearer $_apiKey',
          'X-Merchant-Id': _merchantId,
        },
      );
      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return switch (json['status'] as String?) {
          'paid'     => CashPlusStatus.paid,
          'expired'  => CashPlusStatus.expired,
          'cancelled'=> CashPlusStatus.cancelled,
          _          => CashPlusStatus.pending,
        };
      }
    } catch (e) {
      debugPrint('[CashPlus] checkStatus error: $e');
    }
    return CashPlusStatus.pending;
  }

  // ── Demo code generator ───────────────────────────────────────────────────

  static CashPlusCode _demoCode({
    required double amountMad,
    required String orderId,
  }) {
    final rng  = Random();
    final part1 = (1000 + rng.nextInt(9000)).toString();
    final part2 = (1000 + rng.nextInt(9000)).toString();
    return CashPlusCode(
      code:      'CP-$part1-$part2',
      amount:    amountMad,
      orderId:   orderId,
      expiresAt: DateTime.now().add(const Duration(hours: 48)),
      status:    CashPlusStatus.pending,
    );
  }
}

// ── Data classes ──────────────────────────────────────────────────────────────

enum CashPlusStatus { pending, paid, expired, cancelled }

class CashPlusCode {
  const CashPlusCode({
    required this.code,
    required this.amount,
    required this.orderId,
    required this.expiresAt,
    required this.status,
  });

  final String         code;
  final double         amount;
  final String         orderId;
  final DateTime       expiresAt;
  final CashPlusStatus status;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  String get formattedExpiry {
    final d = expiresAt;
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')} à ${d.hour}h${d.minute.toString().padLeft(2, '0')}';
  }
}
