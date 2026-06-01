import 'dart:convert';

import 'package:http/http.dart' as http;

// Firebase imports — uncomment after running: flutterfire configure
// import 'package:cloud_firestore/cloud_firestore.dart';
// import 'package:firebase_analytics/firebase_analytics.dart';

import '../models/cart_item.dart';

/// Shared Firestore schema constants used by App, Website, and CRM.
/// Every collection/field name lives here — change once, applies everywhere.
abstract final class AlmasFirestore {
  static const String orders          = 'orders';
  static const String products        = 'products';
  static const String customers       = 'customers';
  static const String analyticsEvents = 'analytics_events';

  // Order field names
  static const String fieldSource      = 'source';     // 'app' | 'website' | 'crm'
  static const String fieldStatus      = 'status';     // see OrderStatus
  static const String fieldItems       = 'items';
  static const String fieldSubtotal    = 'subtotal';
  static const String fieldDeliveryFee = 'delivery_fee';
  static const String fieldTotal       = 'total';
  static const String fieldPhone       = 'phone';
  static const String fieldCity        = 'city';
  static const String fieldAddress     = 'address';
  static const String fieldNotes       = 'notes';
  static const String fieldCreatedAt   = 'created_at';
  static const String fieldUpdatedAt   = 'updated_at';
}

abstract final class OrderStatus {
  static const String draft           = 'draft';
  static const String placed          = 'placed';
  static const String confirmed       = 'confirmed';
  static const String outForDelivery  = 'out_for_delivery';
  static const String delivered       = 'delivered';
  static const String cancelled       = 'cancelled';
}

/// Represents an order ready to be sent to Firestore / CODRocket / WhatsApp.
class AlmasOrder {
  const AlmasOrder({
    required this.id,
    required this.items,
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.phone,
    required this.city,
    required this.address,
    this.notes = '',
    this.status = OrderStatus.placed,
    this.source = 'app',
  });

  final String id;
  final List<CartItem> items;
  final double subtotal;
  final double deliveryFee;
  final double total;
  final String phone;
  final String city;
  final String address;
  final String notes;
  final String status;
  final String source;

  Map<String, dynamic> toFirestore() => {
        AlmasFirestore.fieldSource: source,
        AlmasFirestore.fieldStatus: status,
        AlmasFirestore.fieldItems: items.map((i) => {
              'product_id':   i.product.id,
              'product_name': i.product.name,
              'quantity':     i.quantity,
              'unit_price':   i.product.price,
              'line_total':   i.lineTotal,
            }).toList(),
        AlmasFirestore.fieldSubtotal:    subtotal,
        AlmasFirestore.fieldDeliveryFee: deliveryFee,
        AlmasFirestore.fieldTotal:       total,
        AlmasFirestore.fieldPhone:       phone,
        AlmasFirestore.fieldCity:        city,
        AlmasFirestore.fieldAddress:     address,
        AlmasFirestore.fieldNotes:       notes,
        AlmasFirestore.fieldCreatedAt:   DateTime.now().toIso8601String(),
        AlmasFirestore.fieldUpdatedAt:   DateTime.now().toIso8601String(),
      };
}

/// Firebase service for the Almas app.
///
/// SETUP (one-time):
///   1. Create Firebase project at https://console.firebase.google.com
///   2. Enable Firestore in "Native mode"
///   3. Run: flutterfire configure
///   4. Add google-services.json to android/app/
///   5. Uncomment Firebase imports in pubspec.yaml and this file
///   6. Call FirebaseService.init() from main()
///
/// When Firebase is not configured, all methods are no-ops (demo mode).
class FirebaseService {
  static bool _initialized = false;

  static Future<void> init() async {
    // Uncomment after flutterfire configure:
    // await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    // _initialized = true;
    // debugPrint('[Firebase] Initialized — live mode');
    _initialized = false; // demo mode until configured
  }

  /// Writes a new order document to Firestore /orders/{id}.
  /// Also logs an analytics event 'order_placed'.
  static Future<String?> createOrder(AlmasOrder order) async {
    if (!_initialized) return null;

    // Uncomment after flutterfire configure:
    // final ref = FirebaseFirestore.instance
    //     .collection(AlmasFirestore.orders)
    //     .doc(order.id);
    // await ref.set(order.toFirestore());
    // await logEvent('order_placed', {
    //   'order_id': order.id,
    //   'total': order.total,
    //   'item_count': order.items.length,
    //   'city': order.city,
    //   'source': order.source,
    // });
    // return order.id;
    return null;
  }

  /// Updates the status field of an existing order.
  static Future<void> updateOrderStatus(String orderId, String status) async {
    if (!_initialized) return;

    // Uncomment after flutterfire configure:
    // await FirebaseFirestore.instance
    //     .collection(AlmasFirestore.orders)
    //     .doc(orderId)
    //     .update({
    //   AlmasFirestore.fieldStatus:    status,
    //   AlmasFirestore.fieldUpdatedAt: FieldValue.serverTimestamp(),
    // });
  }

  /// Fetches live product catalog from Firestore.
  /// Returns null if Firebase isn't initialized — caller falls back to demo data.
  static Future<List<Map<String, dynamic>>?> fetchProducts() async {
    if (!_initialized) return null;

    // Uncomment after flutterfire configure:
    // final snapshot = await FirebaseFirestore.instance
    //     .collection(AlmasFirestore.products)
    //     .where('is_available', isEqualTo: true)
    //     .get();
    // return snapshot.docs.map((d) => d.data()).toList();
    return null;
  }

  /// Logs a custom analytics event.
  static Future<void> logEvent(
    String name,
    Map<String, Object> parameters,
  ) async {
    if (!_initialized) return;

    // Uncomment after flutterfire configure:
    // await FirebaseAnalytics.instance.logEvent(
    //   name: name,
    //   parameters: parameters,
    // );
    // Also write to Firestore for CRM dashboard queries:
    // await FirebaseFirestore.instance
    //     .collection(AlmasFirestore.analyticsEvents)
    //     .add({
    //   'event':     name,
    //   'source':    'app',
    //   'payload':   parameters,
    //   'timestamp': FieldValue.serverTimestamp(),
    // });
  }

  /// Tracks a product view event.
  static Future<void> trackProductView(String productId, String productName) =>
      logEvent('product_view', {
        'product_id':   productId,
        'product_name': productName,
        'source':       'app',
      });

  /// Tracks an add-to-cart event.
  static Future<void> trackAddToCart(String productId, double price) =>
      logEvent('add_to_cart', {
        'product_id': productId,
        'price':      price,
        'currency':   'MAD',
      });

  /// Tracks when the user opens the WhatsApp checkout.
  static Future<void> trackCheckoutStart(double cartTotal, int itemCount) =>
      logEvent('begin_checkout', {
        'value':      cartTotal,
        'currency':   'MAD',
        'item_count': itemCount,
      });
}
