import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/cart_item.dart';
import '../../models/product.dart';
import '../../services/contact_service.dart';
import '../../services/firebase_service.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/section_header.dart';

class CartPage extends StatelessWidget {
  const CartPage({
    required this.items,
    required this.onIncrement,
    required this.onDecrement,
    required this.onBrowseCatalog,
    super.key,
  });

  final List<CartItem> items;
  final ValueChanged<Product> onIncrement;
  final ValueChanged<Product> onDecrement;
  final VoidCallback onBrowseCatalog;

  @override
  Widget build(BuildContext context) {
    final subtotal = items.fold<double>(
      0,
      (sum, item) => sum + item.lineTotal,
    );
    const minimumOrder = 250.0;
    final deliveryFee = items.isEmpty ? 0.0 : subtotal >= 500 ? 0.0 : 35.0;
    final total = subtotal + deliveryFee;
    final progress = subtotal == 0
        ? 0.0
        : (subtotal / minimumOrder).clamp(0.0, 1.0);

    final qualifies = subtotal >= minimumOrder;

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader(title: 'Order draft'),
            if (items.isEmpty)
              _EmptyCart(onBrowseCatalog: onBrowseCatalog)
            else
              Column(
                children: [
                  _CartLines(
                    items: items,
                    onIncrement: onIncrement,
                    onDecrement: onDecrement,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _OrderSummaryPanel(
                    subtotal: subtotal,
                    deliveryFee: deliveryFee,
                    total: total,
                    minimumOrder: minimumOrder,
                    progress: progress,
                    onConfirm: qualifies
                        ? () {
                            FirebaseService.trackWhatsAppOrder(
                              subtotal, items.length);
                            ContactService.orderWhatsApp(items);
                          }
                        : null,
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart({
    required this.onBrowseCatalog,
  });

  final VoidCallback onBrowseCatalog;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GlassPanel(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
        child: Column(
          children: [
            Container(
              width: 86,
              height: 86,
              decoration: BoxDecoration(
                color: AppColors.saffron.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.shopping_bag_outlined,
                size: 36,
                color: AppColors.saffron,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'No order draft yet',
              style: theme.textTheme.headlineMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Start from the catalog and build a restaurant order with reusable staples and signature blends.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton.icon(
              onPressed: onBrowseCatalog,
              icon: const Icon(Icons.storefront_rounded),
              label: const Text('Open catalog'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CartLines extends StatelessWidget {
  const _CartLines({
    required this.items,
    required this.onIncrement,
    required this.onDecrement,
  });

  final List<CartItem> items;
  final ValueChanged<Product> onIncrement;
  final ValueChanged<Product> onDecrement;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: items
          .map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: _CartLineCard(
                item: item,
                onIncrement: () => onIncrement(item.product),
                onDecrement: () => onDecrement(item.product),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _CartLineCard extends StatelessWidget {
  const _CartLineCard({
    required this.item,
    required this.onIncrement,
    required this.onDecrement,
  });

  final CartItem item;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: item.product.accentColor.withValues(alpha: 0.14),
                ),
                child: Icon(Icons.spa_rounded, color: item.product.accentColor),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.product.name, style: theme.textTheme.titleLarge),
                    Text(item.product.packSize, style: theme.textTheme.bodyMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${item.product.price.toStringAsFixed(0)} MAD each',
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: item.product.accentColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              IconButton.filledTonal(
                onPressed: onDecrement,
                icon: const Icon(Icons.remove_rounded),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                child: Text('${item.quantity}', style: theme.textTheme.titleLarge),
              ),
              IconButton.filledTonal(
                onPressed: onIncrement,
                icon: const Icon(Icons.add_rounded),
              ),
              const Spacer(),
              Text(
                '${item.lineTotal.toStringAsFixed(0)} MAD',
                style: theme.textTheme.titleLarge?.copyWith(fontSize: 24),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OrderSummaryPanel extends StatelessWidget {
  const _OrderSummaryPanel({
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.minimumOrder,
    required this.progress,
    required this.onConfirm,
  });

  final double subtotal;
  final double deliveryFee;
  final double total;
  final double minimumOrder;
  final double progress;
  final VoidCallback? onConfirm; // null = below minimum, button disabled

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final qualifies = subtotal >= minimumOrder;

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Checkout summary', style: theme.textTheme.headlineMedium),
          const SizedBox(height: AppSpacing.lg),
          _SummaryRow(
            label: 'Subtotal',
            value: '${subtotal.toStringAsFixed(0)} MAD',
          ),
          const SizedBox(height: AppSpacing.sm),
          _SummaryRow(
            label: deliveryFee == 0 ? 'Delivery' : 'Delivery fee',
            value: deliveryFee == 0
                ? 'Included'
                : '${deliveryFee.toStringAsFixed(0)} MAD',
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: Divider(),
          ),
          _SummaryRow(
            label: 'Total due on delivery',
            value: '${total.toStringAsFixed(0)} MAD',
            emphasize: true,
          ),
          const SizedBox(height: AppSpacing.lg),
          Text('Minimum order progress', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
            child: LinearProgressIndicator(
              minHeight: 10,
              value: progress,
              backgroundColor: AppColors.ink.withValues(alpha: 0.06),
              color: qualifies ? AppColors.success : AppColors.warning,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            qualifies
                ? 'Ready to order — free delivery on this basket.'
                : 'Add ${(minimumOrder - subtotal).toStringAsFixed(0)} MAD more to reach the 250 MAD minimum.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: qualifies ? AppColors.success : AppColors.warning,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onConfirm,
              icon: const Icon(Icons.chat_rounded),
              label: Text(
                qualifies
                    ? 'Order via WhatsApp'
                    : 'Add ${(minimumOrder - subtotal).toStringAsFixed(0)} MAD more',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: emphasize
                ? theme.textTheme.titleMedium
                : theme.textTheme.bodyMedium,
          ),
        ),
        Text(
          value,
          style: emphasize
              ? theme.textTheme.titleLarge?.copyWith(fontSize: 24)
              : theme.textTheme.titleMedium,
        ),
      ],
    );
  }
}

