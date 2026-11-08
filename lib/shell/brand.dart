import 'package:flutter/material.dart';

/// Brand colours, the same as the site's header and the launcher icon.
class Brand {
  static const Color cream = Color(0xFFF7F0E7);
  static const Color ink = Color(0xFF211A16);
  static const Color saffron = Color(0xFFD39A30);
  static const Color terracotta = Color(0xFFA14E33);
  static const Color whatsapp = Color(0xFF1F9E57);
}

/// The shop's logo (the same picture as the website and the launcher icon) on a
/// white rounded tile, for the splash and the offline screen.
class AlmasMark extends StatelessWidget {
  const AlmasMark({super.key, this.size = 120});

  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        padding: EdgeInsets.all(size * 0.08),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(size * 0.24),
          boxShadow: const [BoxShadow(color: Color(0x33211A16), blurRadius: 24, offset: Offset(0, 10))],
        ),
        child: Image.asset('assets/logo.png', fit: BoxFit.contain, filterQuality: FilterQuality.medium),
      );
}
