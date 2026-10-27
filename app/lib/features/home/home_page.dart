import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/cart_provider.dart';
import '../../providers/products_provider.dart';
import '../../widgets/almas_logo.dart';
import '../../widgets/contact_bar.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/product_card.dart';
import '../../widgets/section_header.dart';
import '../catalog/product_detail_page.dart';
import '../../services/contact_service.dart';

class HomePage extends ConsumerWidget {
  const HomePage({
    required this.onGoToCatalog,
    required this.onGoToCart,
    super.key,
  });

  final VoidCallback onGoToCatalog;
  final VoidCallback onGoToCart;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final cartCount = ref.watch(cartCountProvider);
    final products = ref.watch(productsProvider);
    final featured = products.take(5).toList(); // the catalogue lists the best sellers first

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AlmasLogo(size: 72),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: SectionHeader(
                    title: l10n.homeTitle,
                    subtitle: l10n.homeSubtitle,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            const _ForBusinessesCard(),
            const SizedBox(height: AppSpacing.lg),
            _QuickActionsPanel(
              cartCount: cartCount,
              onGoToCatalog: onGoToCatalog,
              onGoToCart: onGoToCart,
            ),
            const SizedBox(height: AppSpacing.xl),
            _SectionLabel(label: l10n.featuredThisWeek),
            const SizedBox(height: AppSpacing.md),
            ...featured.map(
              (product) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: ProductCard(
                  product: product,
                  quantityInCart: ref.watch(cartProvider)[product.id] ?? 0,
                  onAddToCart: () => ref.read(cartProvider.notifier).add(product),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ProductDetailPage(product: product),
                    ),
                  ),
                ),
              ),
            ),
            TextButton.icon(
              onPressed: onGoToCatalog,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: Text(l10n.seeAllProducts),
            ),
            const SizedBox(height: AppSpacing.xl),
            const GlassPanel(child: ContactBar()),
            const SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
    );
  }
}

class _QuickActionsPanel extends StatelessWidget {
  const _QuickActionsPanel({
    required this.cartCount,
    required this.onGoToCatalog,
    required this.onGoToCart,
  });

  final int cartCount;
  final VoidCallback onGoToCatalog;
  final VoidCallback onGoToCart;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.quickActions, style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onGoToCatalog,
                  icon: const Icon(Icons.storefront_rounded),
                  label: Text(l10n.browseCatalog),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onGoToCart,
                  icon: Badge(
                    isLabelVisible: cartCount > 0,
                    label: Text('$cartCount'),
                    child: const Icon(Icons.shopping_bag_rounded),
                  ),
                  label: Text(l10n.viewCart),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(label, style: Theme.of(context).textTheme.titleLarge);
  }
}

class _ForBusinessesCard extends StatelessWidget {
  const _ForBusinessesCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.restaurant_menu_rounded, color: AppColors.terracotta),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: Text(l10n.forBusinessesTitle, style: theme.textTheme.titleLarge)),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(l10n.forBusinessesBody, style: theme.textTheme.bodyLarge),
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton.icon(
            onPressed: () => ContactService.whatsApp(message: l10n.largeQuantityWhatsAppMessage),
            icon: const Icon(Icons.request_quote_rounded),
            label: Text(l10n.askPriceForLargeQuantities),
          ),
        ],
      ),
    );
  }
}
