import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';

class AlmasLogo extends StatelessWidget {
  const AlmasLogo({
    super.key,
    this.size = 56,
    this.padding = const EdgeInsets.all(AppSpacing.xs),
    this.backgroundColor,
  });

  final double size;
  final EdgeInsetsGeometry padding;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.white.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(size * 0.28),
      ),
      child: Image.asset(
        'assets/branding/almas_logo.png',
        fit: BoxFit.contain,
      ),
    );
  }
}
