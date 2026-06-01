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
    this.imageUrl,
    this.isAvailable = true,
  });

  final String id;
  final String name;
  final String arabicName;
  final String category;
  final String origin;
  final String description;
  final String packSize;
  final String unitLabel;
  final double price;
  final int heatLevel;
  final List<String> tags;
  final Color accentColor;
  final String? imageUrl;
  final bool isAvailable;

  Product copyWith({
    double? price,
    String? imageUrl,
    bool? isAvailable,
  }) {
    return Product(
      id: id,
      name: name,
      arabicName: arabicName,
      category: category,
      origin: origin,
      description: description,
      packSize: packSize,
      unitLabel: unitLabel,
      price: price ?? this.price,
      heatLevel: heatLevel,
      tags: tags,
      accentColor: accentColor,
      imageUrl: imageUrl ?? this.imageUrl,
      isAvailable: isAvailable ?? this.isAvailable,
    );
  }
}

