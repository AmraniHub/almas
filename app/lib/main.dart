import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'data/catalog.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Catalog.load();
  runApp(const ProviderScope(child: AlmasApp()));
}
