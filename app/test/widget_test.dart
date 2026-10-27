import 'dart:convert';

import 'package:almas/app.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
    SharedPreferences.setMockInitialValues({});
    await Catalog.load();
  });

  test('the live catalogue from the till replaces the one on screen, with photo addresses; a bad answer does not',
      () async {
    final live = jsonEncode({
      'categories': [
        {'id': 'spices', 'ar': 'التوابل', 'fr': 'Épices', 'en': 'Spices', 'color': '#B5472C'},
      ],
      'products': [
        {'id': 'p13', 'ar': 'الفلفلة حلوة', 'fr': 'Paprika doux', 'en': 'Sweet paprika', 'cat': 'spices',
         'price': 65.0, 'unit': 'kg', 'rank': 1, 'img': 'abc123'},
        {'id': 'p2', 'ar': 'الخرقوم', 'fr': 'Curcuma', 'en': 'Turmeric', 'cat': 'spices', 'price': 70.0, 'unit': 'kg', 'rank': 0},
      ],
    });
    final good = MockClient((req) async {
      expect(req.url.toString(), '${Catalog.cloud}/app/catalog.json');
      return http.Response.bytes(utf8.encode(live), 200);
    });
    expect(await Catalog.refresh(client: good), isTrue);
    final paprika = Catalog.products.firstWhere((p) => p.id == 'p13');
    expect(paprika.price, 65.0);
    expect(paprika.imageUrl, '${Catalog.cloud}/app/img/13.jpg?v=abc123');
    expect(Catalog.products.firstWhere((p) => p.id == 'p2').imageUrl, isNull);

    final broken = MockClient((req) async => http.Response('oops', 200));
    final down = MockClient((req) async => http.Response('', 503));
    expect(await Catalog.refresh(client: broken), isFalse);
    expect(await Catalog.refresh(client: down), isFalse);
    expect(Catalog.products.length, 2, reason: 'what is on screen stays when the cloud answers badly');

    // the next start opens on the last live catalogue, then the built-in one is back for the other tests
    await Catalog.load();
    expect(Catalog.products.length, 2);
    SharedPreferences.setMockInitialValues({});
    await Catalog.load();
    expect(Catalog.products.length, greaterThan(100));
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
