import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/demo_data.dart';
import '../../providers/cart_provider.dart';
import '../../providers/products_provider.dart';
import '../../widgets/almas_logo.dart';
import '../../widgets/contact_bar.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/order_stage_bar.dart';
import '../../widgets/product_card.dart';
import '../../widgets/section_header.dart';
import '../catalog/product_detail_page.dart';
import '../orders/order_tracking_page.dart';

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
    final featured = products.take(3).toList();

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
            const _LiveOrderCard(),
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

class _LiveOrderCard extends StatelessWidget {
  const _LiveOrderCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final order = liveOrder;

    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => OrderTrackingPage(order: order),
        ),
      ),
      child: GlassPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: const BoxDecoration(
                    color: AppColors.success,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  l10n.activeOrderTapToTrack,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: AppColors.success,
                  ),
                ),
                const Spacer(),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.body,
                  size: 20,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(order.id, style: theme.textTheme.headlineMedium),
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.orderItemsAndTotal(order.itemCount, order.total),
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                const Icon(Icons.place_rounded, size: 16, color: AppColors.body),
                const SizedBox(width: AppSpacing.xxs),
                Expanded(
                  child: Text(
                    l10n.orderDestination(order),
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
                const Icon(Icons.schedule_rounded, size: 16, color: AppColors.body),
                const SizedBox(width: AppSpacing.xxs),
                Text(
                  l10n.orderEta(order),
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            OrderStageBar(stage: order.stage),
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
