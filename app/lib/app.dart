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
      onGenerateTitle: (context) => context.l10n.appTitle,
      debugShowCheckedModeBanner: false,
      theme: AlmasTheme.light(),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        ...GlobalMaterialLocalizations.delegates,
        GlobalCupertinoLocalizations.delegate,
      ],
      localeResolutionCallback: (deviceLocale, supportedLocales) {
        if (deviceLocale == null) {
          return const Locale('en');
        }

        final languageCode = deviceLocale.languageCode.toLowerCase();
        for (final supportedLocale in supportedLocales) {
          if (supportedLocale.languageCode == languageCode) {
            return supportedLocale;
          }
        }

        return const Locale('en');
      },
      home: const AlmasShell(),
    );
  }
}
