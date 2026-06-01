import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

class AmbientBackground extends StatelessWidget {
  const AmbientBackground({super.key});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        fit: StackFit.expand,
        children: const [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.surfaceStrong,
                  AppColors.background,
                  AppColors.backgroundDeep,
                ],
              ),
            ),
          ),
          _GlowOrb(
            alignment: Alignment.topRight,
            color: AppColors.saffron,
            size: 280,
            horizontalOffset: 70,
            verticalOffset: -30,
          ),
          _GlowOrb(
            alignment: Alignment.centerLeft,
            color: AppColors.terracotta,
            size: 220,
            horizontalOffset: -120,
            verticalOffset: 120,
          ),
          _GlowOrb(
            alignment: Alignment.bottomRight,
            color: AppColors.eucalyptus,
            size: 260,
            horizontalOffset: 80,
            verticalOffset: 120,
          ),
        ],
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({
    required this.alignment,
    required this.color,
    required this.size,
    required this.horizontalOffset,
    required this.verticalOffset,
  });

  final Alignment alignment;
  final Color color;
  final double size;
  final double horizontalOffset;
  final double verticalOffset;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: Transform.translate(
        offset: Offset(horizontalOffset, verticalOffset),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                color.withValues(alpha: 0.26),
                color.withValues(alpha: 0.06),
                color.withValues(alpha: 0),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

