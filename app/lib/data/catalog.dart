import 'dart:convert';

import 'package:flutter/services.dart';

import '../models/product.dart';

/// A shelf of the shop, as the catalogue file names it in three languages.
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

/// The shop's real catalogue, read once at start-up from assets/catalog/products.json
/// (built from the till with tool/build_catalog.py, so the prices are the till's).
abstract final class Catalog {
  static List<CatalogCategory> categories = const [];
  static List<Product> products = const [];

  static Future<void> load() async {
    final data = jsonDecode(await rootBundle.loadString('assets/catalog/products.json'))
        as Map<String, dynamic>;
    categories = [
      for (final c in data['categories'] as List)
        CatalogCategory(
          id: c['id'] as String,
          arabic: c['ar'] as String,
          french: c['fr'] as String,
          english: c['en'] as String,
          color: Color(int.parse((c['color'] as String).substring(1), radix: 16) | 0xFF000000),
        ),
    ];
    final colors = {for (final c in categories) c.id: c.color};
    products = [
      for (final p in data['products'] as List)
        Product.fromCatalog(p as Map<String, dynamic>, colors[p['cat']] ?? const Color(0xFFB5472C)),
    ];
  }

  static CatalogCategory? category(String id) {
    for (final c in categories) {
      if (c.id == id) return c;
    }
    return null;
  }
}
