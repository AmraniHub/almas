import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'brand.dart';
import 'native_bridge.dart';
import 'offline_view.dart';
import 'site_links.dart';
import 'strings.dart';
import 'web_bridge.dart';

const String _prefLanguage = 'almas.lang';

/// Main-frame errors that mean "no network" rather than a broken page.
const Set<WebResourceErrorType> _networkErrors = {
  WebResourceErrorType.hostLookup,
  WebResourceErrorType.connect,
  WebResourceErrorType.timeout,
  WebResourceErrorType.io,
  WebResourceErrorType.unknown,
};

/// The whole app: the shop's website, full screen, with native back, external
/// links, microphone permission, sharing, a splash and an offline screen.
class ShellPage extends StatefulWidget {
  const ShellPage({super.key});

  @override
  State<ShellPage> createState() => _ShellPageState();
}

class _ShellPageState extends State<ShellPage> {
  WebViewController? _controller;
  SharedPreferences? _prefs;
  String _lang = 'en';
  String _target = startUrlFor('en');
  bool _painted = false;
  bool _offline = false;
  DateTime? _lastBack;
  Timer? _splashSafety;
  bool _earlyBridgeDone = false;

  ShellStrings get _strings => ShellStrings.of(_lang);

  @override
  void initState() {
    super.initState();
    unawaited(_start());
  }

  @override
  void dispose() {
    _splashSafety?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    _prefs = await SharedPreferences.getInstance();
    final stored = _prefs!.getString(_prefLanguage);
    _lang = stored != null
        ? normaliseLanguage(stored)
        : languageForLocale(PlatformDispatcher.instance.locale.languageCode);
    _target = startUrlFor(_lang);

    final controller = WebViewController();
    await controller.setJavaScriptMode(JavaScriptMode.unrestricted);
    await controller.setBackgroundColor(Brand.cream);
    await controller.enableZoom(false);
    await controller.addJavaScriptChannel(kBridgeChannel, onMessageReceived: _onBridgeMessage);
    await controller.setNavigationDelegate(NavigationDelegate(
      onNavigationRequest: _onNavigationRequest,
      onProgress: (p) {
        if (p >= 80) _markPainted();
        // on a slow link the page is usable long before it "finishes"; the
        // share bridge is idempotent, so it also goes in as soon as most has loaded
        if (p >= 70 && !_earlyBridgeDone) {
          _earlyBridgeDone = true;
          unawaited(_injectBridge());
        }
      },
      onPageStarted: (_) => _earlyBridgeDone = false,
      onPageFinished: _onPageFinished,
      onWebResourceError: _onWebResourceError,
    ));

    final platform = controller.platform;
    if (platform is AndroidWebViewController) {
      await AndroidWebViewController.enableDebugging(kDebugMode);
      await platform.setTextZoom(100);
      await platform.setMediaPlaybackRequiresUserGesture(true);
      await platform.setOverScrollMode(WebViewOverScrollMode.ifContentScrolls);
      await platform.setHorizontalScrollBarEnabled(false);
      await platform.setOnPlatformPermissionRequest(_onPermissionRequest);
      final ua = await platform.getUserAgent();
      await platform.setUserAgent('${ua ?? ''} AlmasApp/$kAppVersion'.trim());
    } else {
      await controller.setUserAgent('AlmasApp/$kAppVersion');
    }

    if (!mounted) return;
    setState(() => _controller = controller);
    await _load(_target);
  }

  Future<void> _load(String url) async {
    _target = url;
    if (!await NativeBridge.isOnline()) {
      _showOffline();
      return;
    }
    if (!mounted) return;
    setState(() {
      _offline = false;
      _painted = false;
    });
    _splashSafety?.cancel();
    _splashSafety = Timer(const Duration(seconds: 12), _markPainted);
    await _controller?.loadRequest(Uri.parse(url));
  }

  void _showOffline() {
    if (!mounted) return;
    _splashSafety?.cancel();
    setState(() {
      _offline = true;
      _painted = true;
    });
  }

  void _markPainted() {
    if (_painted || !mounted) return;
    setState(() => _painted = true);
  }

  FutureOr<NavigationDecision> _onNavigationRequest(NavigationRequest request) {
    final uri = Uri.tryParse(request.url);
    if (uri == null || !request.isMainFrame) return NavigationDecision.navigate;
    if (routeFor(uri) == LinkRoute.inApp) return NavigationDecision.navigate;
    unawaited(_openExternally(uri));
    return NavigationDecision.prevent;
  }

  Future<void> _openExternally(Uri uri) async {
    for (final candidate in launchCandidates(uri)) {
      try {
        if (await launchUrl(candidate, mode: LaunchMode.externalApplication)) return;
      } on PlatformException {
        // no app for this one; try the next candidate
      }
    }
  }

  Future<void> _injectBridge() async {
    final controller = _controller;
    if (controller == null) return;
    final current = Uri.tryParse(await controller.currentUrl() ?? '');
    if (current == null || !isSiteUri(current)) return;
    try {
      await controller.runJavaScript(kBridgeScript);
    } on PlatformException {
      // the page went away mid-injection; the next page gets it
    }
  }

  Future<void> _onPageFinished(String url) async {
    _markPainted();
    final uri = Uri.tryParse(url);
    if (uri == null || !isSiteUri(uri)) return;
    await _injectBridge();
    final lang = languageOfUri(uri);
    if (lang != null && lang != _prefs?.getString(_prefLanguage)) {
      await _prefs?.setString(_prefLanguage, lang);
    }
    if (lang != null && lang != _lang && mounted) setState(() => _lang = lang);
  }

  void _onWebResourceError(WebResourceError error) {
    if (error.isForMainFrame != true) return;
    if (!_networkErrors.contains(error.errorType)) return;
    final failed = error.url;
    if (failed != null) {
      final uri = Uri.tryParse(failed);
      if (uri != null && isSiteUri(uri)) _target = failed;
    }
    _showOffline();
  }

  Future<void> _onPermissionRequest(PlatformWebViewPermissionRequest request) async {
    final onlyMic = request.types.isNotEmpty &&
        request.types.every((t) => t == WebViewPermissionResourceType.microphone);
    if (onlyMic && await NativeBridge.requestMicrophone()) {
      await request.grant();
    } else {
      await request.deny();
    }
  }

  Future<void> _onBridgeMessage(JavaScriptMessage message) async {
    final current = Uri.tryParse(await _controller?.currentUrl() ?? '');
    if (current == null || !isSiteUri(current)) return; // only the shop's own pages may share
    final request = ShareRequest.tryParse(message.message);
    if (request == null) return;
    try {
      await shareFromPage(request);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(_strings.shareFailed)));
    }
  }

  /// Asks the page to close its open layer (cart, search, assistant, language
  /// menu). True when something closed.
  Future<bool> _closeOverlay(WebViewController controller) async {
    try {
      final result = await controller.runJavaScriptReturningResult(kCloseOverlayScript);
      return result == true || result.toString() == 'true';
    } on PlatformException {
      return false;
    }
  }

  Future<void> _onBack() async {
    final controller = _controller;
    if (!_offline && controller != null) {
      if (await _closeOverlay(controller)) return;
      if (await controller.canGoBack()) {
        await controller.goBack();
        return;
      }
    }
    final now = DateTime.now();
    if (_lastBack != null && now.difference(_lastBack!) < const Duration(seconds: 2)) {
      await SystemNavigator.pop();
      return;
    }
    _lastBack = now;
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(
          _strings.pressBackAgain,
          textDirection: _strings.rtl ? TextDirection.rtl : TextDirection.ltr,
          textAlign: TextAlign.center,
        ),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        backgroundColor: Brand.ink,
      ));
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Brand.cream,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Brand.cream,
        systemNavigationBarIconBrightness: Brightness.dark,
        systemNavigationBarDividerColor: Brand.cream,
      ),
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) unawaited(_onBack());
        },
        child: Scaffold(
          backgroundColor: Brand.cream,
          body: Stack(
            fit: StackFit.expand,
            children: [
              if (controller != null)
                SafeArea(child: WebViewWidget(controller: controller)),
              if (_offline)
                OfflineView(
                  strings: _strings,
                  onRetry: () => unawaited(_load(_target)),
                  onOpen: (uri) => unawaited(_openExternally(uri)),
                ),
              IgnorePointer(
                ignoring: _painted,
                child: AnimatedOpacity(
                  opacity: _painted ? 0 : 1,
                  duration: const Duration(milliseconds: 380),
                  curve: Curves.easeOut,
                  child: const ColoredBox(
                    color: Brand.cream,
                    child: Center(child: AlmasMark(size: 120)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
