import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/product.dart';

/// A shelf of the shop, as the catalogue names it in three languages.
class CatalogCategory {
  const CatalogCategory({
    required this.id,
    required this.arabic,
    required this.french,
    required this.english,
    required this.color,
  });

  final String id;
  final String arabic;
  final String french;
  final String english;
  final Color color;
}

/// The shop's catalogue. The till publishes it online with its current prices and the product photos
/// (Aronium shop/agent/app_feed.py, through the shop's cloud copy); the app opens on the last one it saw (or the
/// one built into it, assets/catalog/products.json) and then fetches the live one, so prices and photos follow
/// the till without an app update, and the app still works without internet.
abstract final class Catalog {
  static const String cloud = 'https://aronium-shop.amrani4online.workers.dev';
  static const String _cacheKey = 'catalog_json';

  static List<CatalogCategory> categories = const [];
  static List<Product> products = const [];

  /// The last catalogue this phone saw, else the one built into the app. Fast, offline.
  static Future<void> load() async {
    String? saved;
    try {
      saved = (await SharedPreferences.getInstance()).getString(_cacheKey);
    } catch (_) {
      saved = null;
    }
    if (saved != null && _apply(saved)) return;
    _apply(await rootBundle.loadString('assets/catalog/products.json'));
  }

  /// The live catalogue from the till; true when it changed what the app shows. Never throws.
  static Future<bool> refresh({http.Client? client}) async {
    try {
      final c = client ?? http.Client();
      final r = await c.get(Uri.parse('$cloud/app/catalog.json')).timeout(const Duration(seconds: 10));
      if (r.statusCode != 200) return false;
      final text = utf8.decode(r.bodyBytes);
      if (!_apply(text)) return false;
      try {
        await (await SharedPreferences.getInstance()).setString(_cacheKey, text);
      } catch (_) {
        // the live catalogue still shows; it just will not be the one the app opens on next time
      }
      return true;
    } catch (_) {
      return false; // no internet, the cloud is down, or an odd answer: keep what is on screen
    }
  }

  /// Puts a catalogue JSON on screen; false (and nothing changed) if it is not a usable one.
  static bool _apply(String text) {
    try {
      final data = jsonDecode(text) as Map<String, dynamic>;
      final cats = [
        for (final c in data['categories'] as List)
          CatalogCategory(
            id: c['id'] as String,
            arabic: c['ar'] as String,
            french: c['fr'] as String,
            english: c['en'] as String,
            color: Color(int.parse((c['color'] as String).substring(1), radix: 16) | 0xFF000000),
          ),
      ];
      final colors = {for (final c in cats) c.id: c.color};
      final items = [
        for (final p in data['products'] as List)
          Product.fromCatalog(p as Map<String, dynamic>, colors[p['cat']] ?? const Color(0xFFB5472C),
              imageBase: '$cloud/app/img'),
      ];
      if (cats.isEmpty || items.isEmpty) return false;
      categories = cats;
      products = items;
      return true;
    } catch (_) {
      return false;
    }
  }

  static CatalogCategory? category(String id) {
    for (final c in categories) {
      if (c.id == id) return c;
    }
    return null;
  }
}
