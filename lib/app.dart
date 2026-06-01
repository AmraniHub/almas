import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/localization/app_localizations.dart';
import 'core/theme/app_theme.dart';
import 'features/shell/almas_shell.dart';

class AlmasApp extends StatelessWidget {
  const AlmasApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Almas',
      debugShowCheckedModeBanner: false,
      theme: AlmasTheme.light(),

      // ── Localization ───────────────────────────────────────────────────────
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: [
        AppLocalizations.delegate,
        ...GlobalMaterialLocalizations.delegates,
      ],

      // Auto-detect the device language. Falls back to English for anything
      // not in supportedLocales (e.g. German → English).
      // French is kept as secondary fallback for Moroccan market.
      localeResolutionCallback: (deviceLocale, supportedLocales) {
        if (deviceLocale == null) return const Locale('en');

        // Exact language code match
        for (final supported in supportedLocales) {
          if (supported.languageCode == deviceLocale.languageCode) {
            return supported;
          }
        }

        // Spanish speakers not covered by exact match (e.g. 'es-419') → ES
        if (deviceLocale.languageCode == 'es') return const Locale('es');

        // Default to English for any other language
        return const Locale('en');
      },

      home: const AlmasShell(),
    );
  }
}

