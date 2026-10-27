import 'package:almas/app.dart';
import 'package:almas/core/localization/app_localizations.dart';
import 'package:almas/data/catalog.dart';
import 'package:almas/models/cart_item.dart';
import 'package:almas/widgets/product_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await Catalog.load();
  });

  test('the catalogue is the shop\'s: real names and till prices, by the kilo or the piece', () {
    expect(Catalog.categories.length, 8);
    expect(Catalog.products.length, greaterThan(100));
    final ginger = Catalog.products.firstWhere((p) => p.id == 'p1');
    expect(ginger.arabicName, 'سكنجبر');
    expect(ginger.frenchName, 'Gingembre moulu');
    expect(ginger.soldByKilo, isTrue);
    expect(ginger.step, 0.25);
    expect(Catalog.products.any((p) => p.arabicName.contains('البواسير')), isFalse,
        reason: 'no remedy is sold in the app');
  });

  test('a cart line counts 250 g steps and the WhatsApp order carries the till\'s Arabic name', () {
    final ginger = Catalog.products.firstWhere((p) => p.id == 'p1'); // 90 MAD / kg
    final item = CartItem(product: ginger, quantity: 3); // 750 g
    expect(item.amount, 0.75);
    expect(item.lineTotal, 67.5);
    final en = AppLocalizations(const Locale('en'));
    expect(en.amountLabel(ginger, 3), '750 g');
    expect(en.amountLabel(ginger, 6), '1.5 kg');
    expect(en.formatMad(67.5), '67.50 MAD');
    expect(en.pricePerUnit(ginger), '90 MAD / kg');
    final ar = AppLocalizations(const Locale('ar'));
    expect(ar.formatMad(90), '90 درهم');
    final message = en.buildOrderMessage(
      businessName: 'Hotel Test', phone: '0600000000', address: 'Ksar Sghir', notes: '',
      items: [item], subtotal: item.lineTotal, deliveryFee: 0, total: item.lineTotal,
    );
    expect(message, contains('750 g سكنجبر (Ground ginger)'));
    expect(message, contains('Agreed on WhatsApp'));
  });

  testWidgets('home, then the catalogue with a real product, then 250 g of it in the cart', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: AlmasApp()));
    await tester.pumpAndSettle();

    expect(find.text('Almas Spices & Herbs'), findsOneWidget);
    expect(find.text('Most ordered'), findsOneWidget);
    expect(find.text('Restaurants, hotels, wedding venues'), findsOneWidget);

    await tester.tap(find.text('Catalog'));
    await tester.pumpAndSettle();
    expect(find.text('Our products'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'ginger');
    await tester.pumpAndSettle();
    expect(find.text('Ground ginger'), findsWidgets);

    final gingerRow = find.ancestor(of: find.text('Ground ginger').last, matching: find.byType(ProductCard));
    await tester.tap(find.descendant(of: gingerRow, matching: find.byIcon(Icons.add_rounded)));
    await tester.pumpAndSettle();
    expect(find.text('250 g'), findsWidgets);
  });
}
