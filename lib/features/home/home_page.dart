import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/demo_data.dart';
import '../../providers/cart_provider.dart';
import '../../providers/products_provider.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/order_stage_bar.dart';
import '../../widgets/product_card.dart';
import '../../widgets/section_header.dart';
import '../../widgets/contact_bar.dart';
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
    final cartCount = ref.watch(cartCountProvider);
    final products = ref.watch(productsProvider);
    final featured = products.take(3).toList();

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────────────
            const SectionHeader(
              title: 'Almas Spices',
              subtitle:
                  "Morocco's finest spice supply partner for professional kitchens.",
            ),

            // ── Live order card ──────────────────────────────────────
            _LiveOrderCard(),
            const SizedBox(height: AppSpacing.lg),

            // ── Quick actions ────────────────────────────────────────
            _QuickActionsPanel(
              cartCount: cartCount,
              onGoToCatalog: onGoToCatalog,
              onGoToCart: onGoToCart,
            ),
            const SizedBox(height: AppSpacing.xl),

            // ── Featured products ────────────────────────────────────
            _SectionLabel(label: 'Featured this week'),
            const SizedBox(height: AppSpacing.md),
            ...featured.map(
              (p) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: ProductCard(
                  product: p,
                  quantityInCart: ref.watch(cartProvider)[p.id] ?? 0,
                  onAddToCart: () =>
                      ref.read(cartProvider.notifier).add(p),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ProductDetailPage(product: p),
                    ),
                  ),
                ),
              ),
            ),
            TextButton.icon(
              onPressed: onGoToCatalog,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: const Text('See all products'),
            ),
            const SizedBox(height: AppSpacing.xl),

            // ── Contact bar ──────────────────────────────────────────
            GlassPanel(
              child: ContactBar(),
            ),
            const SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
    );
  }
}

// ── Live order card ────────────────────────────────────────────────────────
class _LiveOrderCard extends StatelessWidget {
  const _LiveOrderCard();

  @override
  Widget build(BuildContext context) {
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
                  'Active order — tap to track',
                  style: theme.textTheme.labelLarge
                      ?.copyWith(color: AppColors.success),
                ),
                const Spacer(),
                const Icon(Icons.chevron_right_rounded,
                    color: AppColors.body, size: 20),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(order.id, style: theme.textTheme.headlineMedium),
            const SizedBox(height: AppSpacing.xs),
            Text(
              '${order.itemCount} items · ${order.total.toStringAsFixed(0)} MAD',
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                const Icon(Icons.place_rounded,
                    size: 16, color: AppColors.body),
                const SizedBox(width: AppSpacing.xxs),
                Expanded(
                  child: Text(order.destination,
                      style: theme.textTheme.bodyMedium),
                ),
                const Icon(Icons.schedule_rounded,
                    size: 16, color: AppColors.body),
                const SizedBox(width: AppSpacing.xxs),
                Text(order.eta, style: theme.textTheme.bodyMedium),
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

// ── Quick actions panel ────────────────────────────────────────────────────
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
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Quick actions', style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onGoToCatalog,
                  icon: const Icon(Icons.storefront_rounded),
                  label: const Text('Browse catalog'),
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
                  label: const Text('View cart'),
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
