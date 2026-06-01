import 'package:almas/app.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders Almas shell and navigates to catalog', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: AlmasApp(),
      ),
    );

    expect(find.text('Almas Spices'), findsOneWidget);
    expect(find.text('Featured this week'), findsOneWidget);

    await tester.tap(find.text('Catalog'));
    await tester.pumpAndSettle();

    expect(find.text('Product library'), findsOneWidget);
  });
}
