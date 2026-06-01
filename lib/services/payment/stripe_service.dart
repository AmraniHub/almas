import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:http/http.dart' as http;

/// Stripe payment service for Almas.
///
/// SETUP:
///   1. Create account at https://dashboard.stripe.com
///   2. Get your keys from Stripe Dashboard → Developers → API keys
///   3. Replace [publishableKey] and [_secretKey] below
///   4. Deploy the backend function at [_backendUrl] (or use your own server)
///      to create PaymentIntents securely. Never call Stripe API from mobile
///      with the secret key — always use a backend.
///
/// The backend endpoint POST /create-payment-intent should accept:
///   { "amount": 28000, "currency": "mad", "order_id": "ALM-001" }
/// and return: { "client_secret": "pi_xxx_secret_xxx" }
class StripeService {
  // TODO: replace with your Stripe publishable key
  static const String publishableKey = 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY';

  // TODO: replace with your backend URL that creates PaymentIntents
  // Never put your Stripe secret key in the mobile app
  static const String _backendUrl = 'https://your-backend.vercel.app';

  // Secret key intentionally omitted — must live on backend only, never in mobile

  /// Call once at app startup (before runApp is fine).
  static void init() {
    Stripe.publishableKey = publishableKey;
    Stripe.merchantIdentifier = 'merchant.ma.almas';
  }

  /// Launches the Stripe Payment Sheet for [amountMad].
  /// Returns true if payment succeeded, false if cancelled or failed.
  static Future<StripeResult> pay({
    required double amountMad,
    required String orderId,
    required String customerEmail,
  }) async {
    try {
      // 1. Create PaymentIntent on your backend
      final clientSecret = await _createPaymentIntent(
        amountMad: amountMad,
        orderId: orderId,
      );
      if (clientSecret == null) {
        return StripeResult.error('Could not connect to payment server.');
      }

      // 2. Initialize the payment sheet
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'Almas Spices',
          billingDetails: BillingDetails(email: customerEmail),
          style: ThemeMode.light,
          appearance: const PaymentSheetAppearance(
            colors: PaymentSheetAppearanceColors(
              primary: Color(0xFFD39A30), // AppColors.saffron
            ),
          ),
        ),
      );

      // 3. Present the payment sheet
      await Stripe.instance.presentPaymentSheet();
      return StripeResult.success(clientSecret);

    } on StripeException catch (e) {
      if (e.error.code == FailureCode.Canceled) {
        return StripeResult.cancelled();
      }
      return StripeResult.error(e.error.localizedMessage ?? 'Payment failed');
    } catch (e) {
      return StripeResult.error('Unexpected error: $e');
    }
  }

  static Future<String?> _createPaymentIntent({
    required double amountMad,
    required String orderId,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_backendUrl/create-payment-intent'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'amount':   (amountMad * 100).toInt(), // Stripe uses centimes
          'currency': 'mad',
          'order_id': orderId,
        }),
      );
      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return json['client_secret'] as String?;
      }
    } catch (e) {
      debugPrint('[Stripe] createPaymentIntent error: $e');
    }
    return null;
  }
}

enum StripeStatus { success, cancelled, error }

class StripeResult {
  const StripeResult._({required this.status, this.clientSecret, this.message});

  final StripeStatus status;
  final String?      clientSecret;
  final String?      message;

  factory StripeResult.success(String clientSecret) =>
      StripeResult._(status: StripeStatus.success, clientSecret: clientSecret);

  factory StripeResult.cancelled() =>
      StripeResult._(status: StripeStatus.cancelled);

  factory StripeResult.error(String message) =>
      StripeResult._(status: StripeStatus.error, message: message);

  bool get isSuccess   => status == StripeStatus.success;
  bool get isCancelled => status == StripeStatus.cancelled;
  bool get isError     => status == StripeStatus.error;
}
