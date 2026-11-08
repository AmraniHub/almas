import 'package:flutter/material.dart';

import 'shell/brand.dart';
import 'shell/shell_page.dart';

/// Almas: the shop's website in a native shell. Every screen, price and order
/// comes from https://almas-epices.vercel.app, so there is one catalogue only.
class AlmasApp extends StatelessWidget {
  const AlmasApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Almas',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Brand.saffron, surface: Brand.cream),
        scaffoldBackgroundColor: Brand.cream,
        useMaterial3: true,
      ),
      home: const ShellPage(),
    );
  }
}
