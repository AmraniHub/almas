import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/catalog.dart';
import '../models/product.dart';

/// The shop's real catalogue (loaded in main() from assets/catalog/products.json).
final productsProvider = Provider<List<Product>>((ref) => Catalog.products);
