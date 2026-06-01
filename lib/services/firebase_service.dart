import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_analytics/firebase_analytics.dart';

import '../models/cart_item.dart';

// ── Shared schema constants (App + Website + CRM must use same names) ─────────

abstract final class AlmasFirestore {
  static const String orders          = 'orders';
  static const String products        = 'products';
  static const String customers       = 'customers';
  static const String analyticsEvents = 'analytics_events';

  static const String fieldSource      = 'source';
  static const String fieldStatus      = 'status';
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

// ── Order model ───────────────────────────────────────────────────────────────

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
    this.notes  = '',
    this.status = OrderStatus.placed,
    this.source = 'app',
  });

  final String         id;
  final List<CartItem> items;
  final double         subtotal;
  final double         deliveryFee;
  final double         total;
  final String         phone;
  final String         city;
  final String         address;
  final String         notes;
  final String         status;
  final String         source;

  Map<String, dynamic> toFirestore() => {
        AlmasFirestore.fieldSource:      source,
        AlmasFirestore.fieldStatus:      status,
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
        AlmasFirestore.fieldCreatedAt:   FieldValue.serverTimestamp(),
        AlmasFirestore.fieldUpdatedAt:   FieldValue.serverTimestamp(),
      };
}

// ── Firebase service ──────────────────────────────────────────────────────────

class FirebaseService {
  static FirebaseFirestore get _db       => FirebaseFirestore.instance;
  static FirebaseAnalytics get _analytics => FirebaseAnalytics.instance;

  static Future<void> init() async {
    // Firebase.initializeApp() is called in main.dart before this.
    // Persistence is enabled by default on Android.
    debugPrint('[Firebase] Ready — project: ${_db.app.options.projectId}');
  }

  // ── Orders ──────────────────────────────────────────────────────────────────

  /// Saves a new order to Firestore /orders/{id}.
  /// Also fires an analytics event and tracks via GA4.
  static Future<String?> createOrder(AlmasOrder order) async {
    try {
      final ref = _db.collection(AlmasFirestore.orders).doc(order.id);
      await ref.set(order.toFirestore());

      await logEvent('order_placed', {
        'order_id':   order.id,
        'total':      order.total,
        'item_count': order.items.length,
        'city':       order.city,
        'source':     'app',
      });

      debugPrint('[Firebase] Order ${order.id} saved');
      return order.id;
    } catch (e) {
      debugPrint('[Firebase] createOrder error: $e');
      return null;
    }
  }

  /// Updates order status — called when CRM confirms / dispatches.
  static Future<void> updateOrderStatus(String orderId, String status) async {
    try {
      await _db.collection(AlmasFirestore.orders).doc(orderId).update({
        AlmasFirestore.fieldStatus:    status,
        AlmasFirestore.fieldUpdatedAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('[Firebase] updateOrderStatus error: $e');
    }
  }

  /// Streams real-time order status updates for the order tracking page.
  static Stream<DocumentSnapshot<Map<String, dynamic>>> orderStream(
      String orderId) {
    return _db.collection(AlmasFirestore.orders).doc(orderId).snapshots();
  }

  // ── Products ─────────────────────────────────────────────────────────────────

  /// Fetches live product catalog. Falls back to demo data if Firestore is empty.
  static Future<List<Map<String, dynamic>>?> fetchProducts() async {
    try {
      final snapshot = await _db
          .collection(AlmasFirestore.products)
          .where('is_available', isEqualTo: true)
          .get();
      if (snapshot.docs.isEmpty) return null; // use demo data
      return snapshot.docs.map((d) => {'id': d.id, ...d.data()}).toList();
    } catch (e) {
      debugPrint('[Firebase] fetchProducts error: $e');
      return null;
    }
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  /// Logs to both Firebase Analytics (GA4) and Firestore (for CRM dashboards).
  static Future<void> logEvent(
    String name,
    Map<String, Object> parameters,
  ) async {
    try {
      // GA4
      await _analytics.logEvent(name: name, parameters: parameters);

      // Firestore — lets CRM query events by source / date / type
      await _db.collection(AlmasFirestore.analyticsEvents).add({
        'event':     name,
        'source':    'app',
        'payload':   parameters,
        'timestamp': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('[Firebase] logEvent error: $e');
    }
  }

  static Future<void> trackProductView(
          String productId, String productName) =>
      logEvent('product_view', {
        'product_id':   productId,
        'product_name': productName,
        'source':       'app',
      });

  static Future<void> trackAddToCart(String productId, double price) =>
      logEvent('add_to_cart', {
        'product_id': productId,
        'price':      price,
        'currency':   'MAD',
      });

  static Future<void> trackCheckoutStart(
          double cartTotal, int itemCount) =>
      logEvent('begin_checkout', {
        'value':      cartTotal,
        'currency':   'MAD',
        'item_count': itemCount,
      });

  static Future<void> trackWhatsAppOrder(
          double cartTotal, int itemCount) =>
      logEvent('whatsapp_order_sent', {
        'value':      cartTotal,
        'currency':   'MAD',
        'item_count': itemCount,
        'source':     'app',
      });
}
