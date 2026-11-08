import 'dart:convert';
import 'dart:typed_data';

import 'native_bridge.dart';

/// Name of the JavaScript channel the page talks to the app through.
const String kBridgeChannel = 'AlmasApp';

/// Script run on every page of the shop once it has loaded.
///
/// Android WebView has no Web Share API, so the site's "share" buttons would
/// fall back to an `<a download>` of a blob, which a WebView cannot save. This
/// gives the page a `navigator.share` that hands the text, link and files to
/// the app (which opens the Android share sheet), and catches any
/// `<a download>` of a blob:/data: URL the same way. The site checks
/// `navigator.share` when the button is pressed, so installing it after load
/// is early enough.
const String kBridgeScript = r'''
(function () {
  if (window.__almasApp) return;
  window.__almasApp = true;
  function send(o) { try { AlmasApp.postMessage(JSON.stringify(o)); } catch (e) {} }
  function toData(blob) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result)); };
      r.onerror = function () { ko(r.error); };
      r.readAsDataURL(blob);
    });
  }
  navigator.canShare = function (d) {
    return !!d && !!(d.url || d.text || d.title || (d.files && d.files.length));
  };
  navigator.share = function (d) {
    d = d || {};
    var files = Array.prototype.slice.call(d.files || []);
    return Promise.all(files.map(function (f) {
      return toData(f).then(function (u) { return { name: f.name || 'almas.png', data: u }; });
    })).then(function (list) {
      send({ t: 'share', title: d.title || '', text: d.text || '', url: d.url || '', files: list });
    });
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (!a) return;
    var h = a.href || '';
    if (h.indexOf('blob:') !== 0 && h.indexOf('data:') !== 0) return;
    e.preventDefault();
    fetch(h).then(function (r) { return r.blob(); }).then(toData).then(function (u) {
      send({ t: 'share', title: '', text: '', url: '', files: [{ name: a.getAttribute('download') || 'almas.png', data: u }] });
    });
  }, true);
})();
''';

/// Run when Android's back button is pressed: the site closes its open layer
/// (cart, search, the assistant, the language menu) on Escape, so the app sends
/// Escape and reports whether anything closed. Returns true when it did, and
/// then back is used up by that.
const String kCloseOverlayScript = r'''
(function () {
  function state() {
    return document.querySelectorAll('[hidden]').length * 1000 - document.querySelectorAll('details[open]').length;
  }
  var before = state();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return state() !== before;
})();
''';

/// A share request decoded from the page.
class ShareRequest {
  ShareRequest({required this.title, required this.text, required this.url, required this.files});

  final String title;
  final String text;
  final String url;
  final List<ShareFile> files;

  /// The message body: the text, then the link if the text does not already carry it.
  String get message {
    final parts = <String>[];
    if (text.isNotEmpty) parts.add(text);
    if (url.isNotEmpty && !text.contains(url)) parts.add(url);
    if (parts.isEmpty && title.isNotEmpty) parts.add(title);
    return parts.join(' ');
  }

  /// Parses a bridge message; null when it is not a share request.
  static ShareRequest? tryParse(String message) {
    final Object? decoded;
    try {
      decoded = jsonDecode(message);
    } on FormatException {
      return null;
    }
    if (decoded is! Map || decoded['t'] != 'share') return null;
    final files = <ShareFile>[];
    for (final f in (decoded['files'] as List? ?? const [])) {
      if (f is! Map) continue;
      final file = ShareFile.fromDataUrl('${f['name'] ?? ''}', '${f['data'] ?? ''}');
      if (file != null) files.add(file);
    }
    return ShareRequest(
      title: '${decoded['title'] ?? ''}',
      text: '${decoded['text'] ?? ''}',
      url: '${decoded['url'] ?? ''}',
      files: files,
    );
  }
}

/// One file from the page, decoded from a `data:<mime>;base64,<data>` URL.
class ShareFile {
  ShareFile({required this.name, required this.mimeType, required this.bytes});

  final String name;
  final String mimeType;
  final List<int> bytes;

  static ShareFile? fromDataUrl(String name, String dataUrl) {
    if (!dataUrl.startsWith('data:')) return null;
    final comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    final header = dataUrl.substring(5, comma);
    if (!header.endsWith(';base64')) return null;
    final mime = header.substring(0, header.length - ';base64'.length);
    try {
      final bytes = base64Decode(dataUrl.substring(comma + 1));
      return ShareFile(name: _safeName(name), mimeType: mime.isEmpty ? 'application/octet-stream' : mime, bytes: bytes);
    } on FormatException {
      return null;
    }
  }

  /// Keeps a file name to letters, digits, dot, dash and underscore.
  static String _safeName(String name) {
    final kept = name.split('').where((c) => RegExp('[A-Za-z0-9._-]').hasMatch(c)).join();
    return kept.isEmpty || kept.startsWith('.') ? 'almas.png' : kept;
  }
}

/// Opens the Android share sheet for [request] (MainActivity writes the files
/// to its cache and hands them over through ShareProvider).
Future<void> shareFromPage(ShareRequest request) async {
  if (request.files.isEmpty && request.message.isEmpty) return;
  await NativeBridge.share(
    text: request.message,
    subject: request.title.isEmpty ? null : request.title,
    files: [
      for (final f in request.files)
        {'name': f.name, 'mime': f.mimeType, 'bytes': Uint8List.fromList(f.bytes)},
    ],
  );
}
