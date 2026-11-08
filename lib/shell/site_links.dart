// Pure rules of the shell: which page opens first, which language a page is in,
// and which links stay inside the app. No Flutter imports, so tests run them
// directly.

/// The app's version, sent to the site in the user agent (` AlmasApp/<version>`).
/// test/site_links_test.dart checks it against pubspec.yaml and build.gradle.kts.
const String kAppVersion = '1.2.0';

/// Where the shop lives today.
const String kSiteOrigin = 'https://almas-epices.vercel.app';

/// Hosts whose pages open inside the app (the Vercel address and the future domain).
const Set<String> kSiteHosts = {
  'almas-epices.vercel.app',
  'almas5.com',
  'www.almas5.com',
};

/// The four languages of the site, with the root page of each.
const Map<String, String> kLanguageRoots = {
  'ar': '/',
  'fr': '/fr/',
  'en': '/en/',
  'es': '/es/',
};

/// Shop contacts used by the native offline screen.
const String kShopPhoneDisplay = '06 19 43 40 35';
const String kShopPhoneUri = 'tel:+212619434035';
const String kShopWhatsApp = 'https://wa.me/212627716149';

/// Language of the first launch: the device's language when the site has it,
/// English otherwise.
String languageForLocale(String? languageCode) {
  final code = (languageCode ?? '').toLowerCase();
  if (code == 'ar' || code == 'fr' || code == 'es') return code;
  return 'en';
}

/// Normalises a stored or guessed language; anything unknown becomes English.
String normaliseLanguage(String? lang) =>
    kLanguageRoots.containsKey(lang) ? lang! : 'en';

/// The URL to open for a language: the site's own root page, nothing appended.
String startUrlFor(String lang) => kSiteOrigin + kLanguageRoots[normaliseLanguage(lang)]!;

/// True when [uri] is one of the shop's own pages.
bool isSiteUri(Uri uri) =>
    (uri.scheme == 'https' || uri.scheme == 'http') &&
    kSiteHosts.contains(uri.host.toLowerCase());

/// The language a site page is written in: `/fr/...`, `/en/...`, `/es/...`,
/// everything else is the Arabic site. Null for pages that are not the shop's.
String? languageOfUri(Uri uri) {
  if (!isSiteUri(uri)) return null;
  final segments = uri.pathSegments;
  if (segments.isNotEmpty) {
    final first = segments.first.toLowerCase();
    if (first == 'fr' || first == 'en' || first == 'es') return first;
  }
  return 'ar';
}

/// What to do with a navigation the page asked for.
enum LinkRoute {
  /// Load it in the app's WebView.
  inApp,

  /// Hand it to Android (WhatsApp, the dialer, Waze, Maps, a browser...).
  external,
}

/// Schemes the WebView handles itself (blank frames, inline data, scripts).
const Set<String> _webViewSchemes = {'about', 'data', 'blob', 'javascript'};

/// Decides where a top-level navigation goes. The shop's own pages stay in the
/// app; any other web address and every app scheme (`tel:`, `whatsapp:`,
/// `geo:`, `intent:`, `mailto:`...) leaves it.
LinkRoute routeFor(Uri uri) {
  final scheme = uri.scheme.toLowerCase();
  if (scheme == 'http' || scheme == 'https') {
    return isSiteUri(uri) ? LinkRoute.inApp : LinkRoute.external;
  }
  if (scheme.isEmpty || _webViewSchemes.contains(scheme)) return LinkRoute.inApp;
  return LinkRoute.external;
}

/// The URIs to try, in order, for a link Android would open: for an
/// `intent://host/path#Intent;scheme=x;...;S.browser_fallback_url=...;end`
/// link, the app's own `x://host/path` first and the fallback web page second;
/// for anything else, the link itself.
List<Uri> launchCandidates(Uri uri) {
  if (uri.scheme.toLowerCase() != 'intent') return [uri];
  final raw = uri.toString();
  final hash = raw.indexOf('#Intent;');
  final out = <Uri>[];
  final body = raw.substring('intent:'.length, hash < 0 ? raw.length : hash);
  String? scheme;
  String? fallback;
  if (hash >= 0) {
    for (final part in raw.substring(hash + '#Intent;'.length).split(';')) {
      if (part.startsWith('scheme=')) scheme = part.substring('scheme='.length);
      if (part.startsWith('S.browser_fallback_url=')) {
        fallback = Uri.decodeComponent(part.substring('S.browser_fallback_url='.length));
      }
    }
  }
  if (scheme != null && scheme.isNotEmpty) {
    final target = Uri.tryParse('$scheme:$body');
    if (target != null) out.add(target);
  }
  if (fallback != null) {
    final target = Uri.tryParse(fallback);
    if (target != null && (target.scheme == 'https' || target.scheme == 'http')) out.add(target);
  }
  return out;
}
