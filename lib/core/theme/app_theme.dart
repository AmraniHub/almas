import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';
import 'app_spacing.dart';

abstract final class AlmasTheme {
  static ThemeData light() {
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.ink,
      onPrimary: AppColors.white,
      secondary: AppColors.terracotta,
      onSecondary: AppColors.white,
      error: Color(0xFFB3261E),
      onError: AppColors.white,
      surface: AppColors.surface,
      onSurface: AppColors.ink,
    );

    final baseTextTheme = GoogleFonts.cairoTextTheme();
    final displayStyle = GoogleFonts.cormorantGaramond(
      color: AppColors.ink,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.2,
    );

    final textTheme = baseTextTheme.copyWith(
      displayLarge: displayStyle.copyWith(fontSize: 54, height: 0.95),
      displayMedium: displayStyle.copyWith(fontSize: 42, height: 1),
      headlineLarge: displayStyle.copyWith(fontSize: 34, height: 1.05),
      headlineMedium: displayStyle.copyWith(fontSize: 28, height: 1.1),
      titleLarge: GoogleFonts.cairo(
        color: AppColors.ink,
        fontSize: 20,
        fontWeight: FontWeight.w700,
      ),
      titleMedium: GoogleFonts.cairo(
        color: AppColors.ink,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
      bodyLarge: GoogleFonts.cairo(
        color: AppColors.body,
        fontSize: 16,
        height: 1.55,
        fontWeight: FontWeight.w500,
      ),
      bodyMedium: GoogleFonts.cairo(
        color: AppColors.body,
        fontSize: 14,
        height: 1.5,
        fontWeight: FontWeight.w500,
      ),
      labelLarge: GoogleFonts.cairo(
        color: AppColors.ink,
        fontSize: 14,
        fontWeight: FontWeight.w700,
      ),
      labelMedium: GoogleFonts.cairo(
        color: AppColors.body,
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.4,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      textTheme: textTheme,
      scaffoldBackgroundColor: AppColors.background,
      dividerColor: AppColors.outline,
      iconTheme: const IconThemeData(color: AppColors.ink),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 82,
        labelTextStyle: WidgetStatePropertyAll(textTheme.labelMedium),
        backgroundColor: AppColors.surfaceStrong.withValues(alpha: 0.85),
        surfaceTintColor: Colors.transparent,
        indicatorColor: AppColors.ink.withValues(alpha: 0.08),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.white.withValues(alpha: 0.7),
        hintStyle: textTheme.bodyMedium?.copyWith(
          color: AppColors.body.withValues(alpha: 0.75),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.panelRadius),
          borderSide: BorderSide(color: AppColors.outline.withValues(alpha: 0.6)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.panelRadius),
          borderSide: BorderSide(color: AppColors.outline.withValues(alpha: 0.6)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.panelRadius),
          borderSide: const BorderSide(color: AppColors.ink, width: 1.2),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.white.withValues(alpha: 0.7),
        selectedColor: AppColors.ink,
        disabledColor: AppColors.outline,
        secondarySelectedColor: AppColors.ink,
        side: BorderSide(color: AppColors.outline.withValues(alpha: 0.6)),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        labelStyle: textTheme.labelLarge!,
        secondaryLabelStyle: textTheme.labelLarge!.copyWith(
          color: AppColors.white,
        ),
        brightness: Brightness.light,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.ink,
          foregroundColor: AppColors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          side: BorderSide(color: AppColors.ink.withValues(alpha: 0.12)),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      badgeTheme: const BadgeThemeData(
        backgroundColor: AppColors.terracotta,
        textColor: AppColors.white,
      ),
    );
  }
}
