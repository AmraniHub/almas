import 'package:flutter/material.dart';

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.arabicName,
    required this.category,
    required this.origin,
    required this.description,
    required this.packSize,
    required this.unitLabel,
    required this.price,
    required this.heatLevel,
    required this.tags,
    required this.accentColor,
    this.frenchName,
    this.soldByKilo = false,
    this.imageUrl,
    this.isAvailable = true,
  });

  /// One product of the shop's catalogue (assets/catalog/products.json, built from the till by
  /// tool/build_catalog.py): the till's Arabic name and price, a French and English name, and the unit.
  factory Product.fromCatalog(Map<String, dynamic> json, Color accentColor) {
    final kilo = json['unit'] == 'kg';
    return Product(
      id: json['id'] as String,
      name: json['en'] as String,
      arabicName: json['ar'] as String,
      frenchName: json['fr'] as String,
      category: json['cat'] as String,
      origin: '',
      description: '',
      packSize: kilo ? 'kg' : 'piece',
      unitLabel: kilo ? 'kg' : 'piece',
      price: (json['price'] as num).toDouble(),
      heatLevel: 0,
      tags: const [],
      accentColor: accentColor,
      soldByKilo: kilo,
    );
  }

  final String id;
  final String name;
  final String arabicName;
  final String? frenchName;
  final String category;
  final String origin;
  final String description;
  final String packSize;
  final String unitLabel;

  /// The shop's price: per kilo when [soldByKilo], otherwise per piece.
  final double price;
  final int heatLevel;
  final List<String> tags;
  final Color accentColor;

  /// Sold by weight: the cart counts steps of 250 g instead of pieces.
  final bool soldByKilo;
  final String? imageUrl;
  final bool isAvailable;

  /// What one tap on "add" puts in the cart: 0.25 kg, or one piece.
  double get step => soldByKilo ? 0.25 : 1;

  Product copyWith({
    double? price,
    String? imageUrl,
    bool? isAvailable,
  }) {
    return Product(
      id: id,
      name: name,
      arabicName: arabicName,
      frenchName: frenchName,
      category: category,
      origin: origin,
      description: description,
      packSize: packSize,
      unitLabel: unitLabel,
      price: price ?? this.price,
      heatLevel: heatLevel,
      tags: tags,
      accentColor: accentColor,
      soldByKilo: soldByKilo,
      imageUrl: imageUrl ?? this.imageUrl,
      isAvailable: isAvailable ?? this.isAvailable,
    );
  }
}
