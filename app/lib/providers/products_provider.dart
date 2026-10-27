import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/catalog.dart';
import '../models/product.dart';

/// The shop's catalogue on screen: the one loaded at start-up, then the till's live one once it arrives.
class ProductsNotifier extends Notifier<List<Product>> {
  @override
  List<Product> build() => Catalog.products;

  /// Fetch the live catalogue (prices and photos from the till); the screen updates only if it changed.
  Future<void> refresh() async {
    if (await Catalog.refresh()) {
      state = Catalog.products;
    }
  }
}

final productsProvider = NotifierProvider<ProductsNotifier, List<Product>>(ProductsNotifier.new);
