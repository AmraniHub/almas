import 'dart:convert';
import 'dart:io';

import 'package:almas/shell/offline_view.dart';
import 'package:almas/shell/site_links.dart';
import 'package:almas/shell/strings.dart';
import 'package:almas/shell/web_bridge.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('start page', () {
    test('device language picks the site language, English otherwise', () {
      expect(languageForLocale('ar'), 'ar');
      expect(languageForLocale('fr'), 'fr');
      expect(languageForLocale('es'), 'es');
      expect(languageForLocale('FR'), 'fr');
      expect(languageForLocale('en'), 'en');
      expect(languageForLocale('de'), 'en');
      expect(languageForLocale('zgh'), 'en');
      expect(languageForLocale(null), 'en');
    });

    test('each language opens its own root page, nothing appended', () {
      expect(startUrlFor('ar'), 'https://almas-epices.vercel.app/');
      expect(startUrlFor('fr'), 'https://almas-epices.vercel.app/fr/');
      expect(startUrlFor('en'), 'https://almas-epices.vercel.app/en/');
      expect(startUrlFor('es'), 'https://almas-epices.vercel.app/es/');
      expect(startUrlFor('xx'), 'https://almas-epices.vercel.app/en/');
      for (final lang in kLanguageRoots.keys) {
        final uri = Uri.parse(startUrlFor(lang));
        expect(uri.query, isEmpty);
        expect(uri.fragment, isEmpty);
      }
    });

    test('the language of a visited page is remembered from its path', () {
      expect(languageOfUri(Uri.parse('https://almas-epices.vercel.app/')), 'ar');
      expect(languageOfUri(Uri.parse('https://almas-epices.vercel.app/p/ras-el-hanout/')), 'ar');
      expect(languageOfUri(Uri.parse('https://almas-epices.vercel.app/fr/')), 'fr');
      expect(languageOfUri(Uri.parse('https://almas-epices.vercel.app/fr/p/cumin/')), 'fr');
      expect(languageOfUri(Uri.parse('https://almas-epices.vercel.app/en/merci/')), 'en');
      expect(languageOfUri(Uri.parse('https://www.almas5.com/es/')), 'es');
      expect(languageOfUri(Uri.parse('https://wa.me/212627716149')), isNull);
    });
  });

  group('links', () {
    test('the shop\'s own pages stay in the app', () {
      for (final url in [
        'https://almas-epices.vercel.app/',
        'https://almas-epices.vercel.app/fr/p/cumin/?q=1#top',
        'http://almas-epices.vercel.app/en/',
        'https://ALMAS-EPICES.vercel.app/es/',
        'https://almas5.com/',
        'https://www.almas5.com/fr/',
        'about:blank',
        'blob:https://almas-epices.vercel.app/1234',
        'data:image/png;base64,AAAA',
      ]) {
        expect(routeFor(Uri.parse(url)), LinkRoute.inApp, reason: url);
      }
    });

    test('everything that leaves the shop opens outside the app', () {
      for (final url in [
        'https://wa.me/212627716149?text=salam',
        'https://api.whatsapp.com/send?phone=212627716149',
        'whatsapp://send?phone=212627716149',
        'tel:+212619434035',
        'mailto:hello@example.com',
        'https://waze.com/ul?ll=35.7,-5.8',
        'https://ul.waze.com/ul?ll=35.7,-5.8&navigate=yes',
        'https://www.google.com/maps/dir/?api=1&destination=35.7,-5.8',
        'https://maps.google.com/?q=Almas',
        'https://maps.app.goo.gl/abc',
        'geo:35.7,-5.8',
        'https://www.instagram.com/almasnow25/',
        'https://search.google.com/local/writereview?placeid=x',
        'intent://send/#Intent;scheme=whatsapp;package=com.whatsapp;end',
        'https://example.com/',
        'https://almas-epices.vercel.app.evil.com/',
        'https://vercel.app/',
        'market://details?id=com.whatsapp',
      ]) {
        expect(routeFor(Uri.parse(url)), LinkRoute.external, reason: url);
      }
    });

    test('an intent: link becomes its app link, then its web fallback', () {
      final uri = Uri.parse(
          'intent://send?phone=212627716149#Intent;scheme=whatsapp;package=com.whatsapp;'
          'S.browser_fallback_url=https%3A%2F%2Fwa.me%2F212627716149;end');
      final c = launchCandidates(uri);
      expect(c.map((u) => u.toString()), [
        'whatsapp://send?phone=212627716149',
        'https://wa.me/212627716149',
      ]);
      expect(launchCandidates(Uri.parse('tel:+212619434035')).single.toString(), 'tel:+212619434035');
      // a fallback that is not a web page is never launched
      expect(launchCandidates(Uri.parse('intent://x#Intent;S.browser_fallback_url=javascript%3Aalert(1);end')), isEmpty);
    });
  });

  group('share bridge', () {
    test('a share with a picture is decoded to bytes with a safe name', () {
      final png = [137, 80, 78, 71, 13, 10, 26, 10];
      final msg = jsonEncode({
        't': 'share',
        'title': '',
        'text': 'My order at Almas',
        'url': 'https://almas-epices.vercel.app/?utm_source=share_order',
        'files': [
          {'name': '../almas.png', 'data': 'data:image/png;base64,${base64Encode(png)}'},
        ],
      });
      final r = ShareRequest.tryParse(msg)!;
      expect(r.files.single.bytes, png);
      expect(r.files.single.mimeType, 'image/png');
      expect(r.files.single.name, 'almas.png');
      expect(r.message, 'My order at Almas https://almas-epices.vercel.app/?utm_source=share_order');
    });

    test('a share reaches Android with the picture bytes, its type and the text', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final calls = <MethodCall>[];
      const channel = MethodChannel('almas/native');
      final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(channel, (call) async {
        calls.add(call);
        return true;
      });
      addTearDown(() => messenger.setMockMethodCallHandler(channel, null));

      final png = [137, 80, 78, 71];
      await shareFromPage(ShareRequest.tryParse(jsonEncode({
        't': 'share',
        'text': 'Almas',
        'url': 'https://almas-epices.vercel.app/',
        'files': [
          {'name': 'almas.png', 'data': 'data:image/png;base64,${base64Encode(png)}'},
        ],
      }))!);
      expect(calls.single.method, 'share');
      final args = calls.single.arguments as Map;
      expect(args['text'], 'Almas https://almas-epices.vercel.app/');
      final file = (args['files'] as List).single as Map;
      expect(file['name'], 'almas.png');
      expect(file['mime'], 'image/png');
      expect(file['bytes'], png);

      // an empty request opens nothing
      await shareFromPage(ShareRequest(title: '', text: '', url: '', files: []));
      expect(calls, hasLength(1));
    });

    test('anything that is not a share request is ignored', () {
      expect(ShareRequest.tryParse('not json'), isNull);
      expect(ShareRequest.tryParse('{"t":"other"}'), isNull);
      expect(ShareFile.fromDataUrl('a.png', 'https://x/a.png'), isNull);
      expect(ShareFile.fromDataUrl('a.png', 'data:image/png,plain'), isNull);
    });

    test('the injected script talks to the channel the app listens on', () {
      expect(kBridgeScript, contains('$kBridgeChannel.postMessage'));
      expect(kBridgeScript, contains('navigator.share ='));
      expect(kBridgeScript, contains("closest('a[download]')"));
      // back closes the site's open layer through the site's own Escape handlers
      expect(kCloseOverlayScript, contains("key: 'Escape'"));
    });
  });

  group('release numbers', () {
    test('pubspec, Gradle and the user agent carry the same version', () {
      final pubspec = File('pubspec.yaml').readAsStringSync();
      final version = RegExp(r'^version:\s*(\S+)\+(\d+)\s*$', multiLine: true).firstMatch(pubspec)!;
      final gradle = File('android/app/build.gradle.kts').readAsStringSync();
      expect(version.group(1), kAppVersion);
      expect(RegExp(r'versionName = "([^"]+)"').firstMatch(gradle)!.group(1), kAppVersion);
      expect(RegExp(r'versionCode = (\d+)').firstMatch(gradle)!.group(1), version.group(2));
      expect(RegExp(r'targetSdk = (\d+)').firstMatch(gradle)!.group(1), '36');
      expect(RegExp(r'compileSdk = (\d+)').firstMatch(gradle)!.group(1), '36');
      expect(gradle, contains('applicationId = "com.almas.app"'));
    });
  });

  group('offline screen', () {
    test('every language has every text', () {
      for (final lang in kLanguageRoots.keys) {
        final s = ShellStrings.of(lang);
        for (final t in [s.pressBackAgain, s.offlineTitle, s.offlineBody, s.retry, s.call, s.whatsapp]) {
          expect(t.trim(), isNotEmpty, reason: lang);
        }
      }
      expect(ShellStrings.of('ar').rtl, isTrue);
      expect(ShellStrings.of('fr').rtl, isFalse);
    });

    testWidgets('shows the phone, opens tel: and WhatsApp, retries', (tester) async {
      final opened = <Uri>[];
      var retries = 0;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: OfflineView(
            strings: ShellStrings.of('ar'),
            onRetry: () => retries++,
            onOpen: opened.add,
          ),
        ),
      ));
      expect(find.text('لا يوجد اتصال بالإنترنت'), findsOneWidget);
      expect(find.text(kShopPhoneDisplay), findsOneWidget);
      await tester.tap(find.text(kShopPhoneDisplay));
      await tester.tap(find.text('واتساب'));
      await tester.tap(find.byKey(const Key('offline-retry')));
      expect(opened.map((u) => u.toString()), ['tel:+212619434035', 'https://wa.me/212627716149']);
      expect(retries, 1);
    });
  });
}
