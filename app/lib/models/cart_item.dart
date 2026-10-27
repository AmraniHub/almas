import 'product.dart';

class CartItem {
  const CartItem({
    required this.product,
    required this.quantity,
  });

  final Product product;

  /// Taps on "add": steps of 250 g for a product sold by the kilo, pieces otherwise.
  final int quantity;

  /// Kilos (or pieces) in the cart.
  double get amount => quantity * product.step;

  double get lineTotal => product.price * amount;
}
