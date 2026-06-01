import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import 'products_provider.dart';

class CartNotifier extends Notifier<Map<String, int>> {
  @override
  Map<String, int> build() => {};

  void add(Product product) {
    state = {...state, product.id: (state[product.id] ?? 0) + 1};
  }

  void decrement(Product product) {
    final current = state[product.id] ?? 0;
    if (current <= 1) {
      final next = Map<String, int>.from(state)..remove(product.id);
      state = next;
    } else {
      state = {...state, product.id: current - 1};
    }
  }

  void clear() => state = {};

  void reorder(List<CartItem> items) {
    state = {for (final item in items) item.product.id: item.quantity};
  }
}

final cartProvider =
    NotifierProvider<CartNotifier, Map<String, int>>(CartNotifier.new);

// Derived: list of CartItems
final cartItemsProvider = Provider<List<CartItem>>((ref) {
  final quantities = ref.watch(cartProvider);
  final products = ref.watch(productsProvider);
  return products
      .where((p) => (quantities[p.id] ?? 0) > 0)
      .map((p) => CartItem(product: p, quantity: quantities[p.id]!))
      .toList();
});

// Derived: total item count for badge
final cartCountProvider = Provider<int>((ref) {
  return ref.watch(cartProvider).values.fold(0, (a, b) => a + b);
});
