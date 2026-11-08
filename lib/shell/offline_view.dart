import 'package:flutter/material.dart';

import 'brand.dart';
import 'site_links.dart';
import 'strings.dart';

/// Shown instead of the site when the first page cannot load: the shop's
/// phone, WhatsApp and a retry.
class OfflineView extends StatelessWidget {
  const OfflineView({
    super.key,
    required this.strings,
    required this.onRetry,
    required this.onOpen,
  });

  final ShellStrings strings;
  final VoidCallback onRetry;
  final void Function(Uri uri) onOpen;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Directionality(
      textDirection: strings.rtl ? TextDirection.rtl : TextDirection.ltr,
      child: ColoredBox(
        color: Brand.cream,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const AlmasMark(size: 96),
                    const SizedBox(height: 20),
                    Text(
                      strings.offlineTitle,
                      textAlign: TextAlign.center,
                      style: text.headlineSmall?.copyWith(color: Brand.ink, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      strings.offlineBody,
                      textAlign: TextAlign.center,
                      style: text.bodyLarge?.copyWith(color: Brand.ink.withValues(alpha: 0.78), height: 1.5),
                    ),
                    const SizedBox(height: 28),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        key: const Key('offline-retry'),
                        onPressed: onRetry,
                        icon: const Icon(Icons.refresh),
                        label: Text(strings.retry),
                        style: FilledButton.styleFrom(
                          backgroundColor: Brand.ink,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: const StadiumBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => onOpen(Uri.parse(kShopPhoneUri)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Brand.ink,
                          side: const BorderSide(color: Brand.saffron, width: 1.5),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: const StadiumBorder(),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.call, size: 20),
                            const SizedBox(width: 8),
                            Text(strings.call),
                            const SizedBox(width: 8),
                            // the number always reads left to right, even in Arabic
                            Directionality(
                              textDirection: TextDirection.ltr,
                              child: Text(
                                kShopPhoneDisplay,
                                style: const TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () => onOpen(Uri.parse(kShopWhatsApp)),
                        icon: const Icon(Icons.chat_bubble_outline),
                        label: Text(strings.whatsapp),
                        style: FilledButton.styleFrom(
                          backgroundColor: Brand.whatsapp,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: const StadiumBorder(),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
