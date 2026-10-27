import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/cart_item.dart';
import '../../models/product.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/section_header.dart';
import 'checkout_sheet.dart';

class CartPage extends StatelessWidget {
  const CartPage({
    required this.items,
    required this.onIncrement,
    required this.onDecrement,
    required this.onBrowseCatalog,
    required this.onOrderSent,
    super.key,
  });

  final List<CartItem> items;
  final ValueChanged<Product> onIncrement;
  final ValueChanged<Product> onDecrement;
  final VoidCallback onBrowseCatalog;
  final VoidCallback onOrderSent;

  @override
  Widget build(BuildContext context) {
    final subtotal = items.fold<double>(
      0,
      (sum, item) => sum + item.lineTotal,
    );
    // The shop has set no minimum and no delivery price: delivery is agreed on WhatsApp (shown as such)
    const minimumOrder = 0.0;
    const deliveryFee = 0.0;
    final total = subtotal + deliveryFee;
    final progress = subtotal == 0
        ? 0.0
        : (subtotal / minimumOrder).clamp(0.0, 1.0);

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(
              title: context.l10n.orderDraftTitle,
              subtitle: context.l10n.orderDraftSubtitle,
            ),
            if (items.isEmpty)
              _EmptyCart(onBrowseCatalog: onBrowseCatalog)
            else
              LayoutBuilder(
                builder: (context, constraints) {
                  final wideLayout = constraints.maxWidth >= 920;

                  if (wideLayout) {
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 3,
                          child: _CartLines(
                            items: items,
                            onIncrement: onIncrement,
                            onDecrement: onDecrement,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          flex: 2,
                          child: _OrderSummaryPanel(
                            items: items,
                            subtotal: subtotal,
                            deliveryFee: deliveryFee,
                            total: total,
                            minimumOrder: minimumOrder,
                            progress: progress,
                            onOrderSent: onOrderSent,
                          ),
                        ),
                      ],
                    );
                  }

                  return Column(
                    children: [
                      _CartLines(
                        items: items,
                        onIncrement: onIncrement,
                        onDecrement: onDecrement,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _OrderSummaryPanel(
                        items: items,
                        subtotal: subtotal,
                        deliveryFee: deliveryFee,
                        total: total,
                        minimumOrder: minimumOrder,
                        progress: progress,
                        onOrderSent: onOrderSent,
                      ),
                    ],
                  );
                },
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
    final l10n = context.l10n;
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
              l10n.noOrderDraftYet,
              style: theme.textTheme.headlineMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.emptyCartSubtitle,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton.icon(
              onPressed: onBrowseCatalog,
              icon: const Icon(Icons.storefront_rounded),
              label: Text(l10n.openCatalog),
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
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wideLayout = constraints.maxWidth >= 620;
          final detailBlock = Row(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: item.product.accentColor.withValues(alpha: 0.14),
                ),
                child: Icon(
                  Icons.spa_rounded,
                  color: item.product.accentColor,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.productName(item.product),
                      style: theme.textTheme.titleLarge,
                    ),
                    if (l10n.productSecondaryName(item.product).isNotEmpty)
                      Text(
                        l10n.productSecondaryName(item.product),
                        style: theme.textTheme.bodyMedium,
                      ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.pricePerUnit(item.product),
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: item.product.accentColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );

          final quantityControls = Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton.filledTonal(
                onPressed: onDecrement,
                icon: const Icon(Icons.remove_rounded),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                child: Text(
                  l10n.amountLabel(item.product, item.quantity),
                  style: theme.textTheme.titleLarge,
                ),
              ),
              IconButton.filledTonal(
                onPressed: onIncrement,
                icon: const Icon(Icons.add_rounded),
              ),
            ],
          );

          final totalLabel = Text(
            l10n.formatMad(item.lineTotal),
            style: theme.textTheme.titleLarge?.copyWith(fontSize: 24),
          );

          if (wideLayout) {
            return Row(
              children: [
                Expanded(flex: 3, child: detailBlock),
                const SizedBox(width: AppSpacing.md),
                quantityControls,
                const SizedBox(width: AppSpacing.lg),
                totalLabel,
              ],
            );
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              detailBlock,
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  quantityControls,
                  const Spacer(),
                  totalLabel,
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _OrderSummaryPanel extends StatelessWidget {
  const _OrderSummaryPanel({
    required this.items,
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.minimumOrder,
    required this.progress,
    required this.onOrderSent,
  });

  final List<CartItem> items;
  final double subtotal;
  final double deliveryFee;
  final double total;
  final double minimumOrder;
  final double progress;
  final VoidCallback onOrderSent;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final qualifiesForMinimum = subtotal >= minimumOrder;

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.checkoutSummary,
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.checkoutSummarySubtitle,
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.lg),
          _SummaryRow(
            label: l10n.subtotalLabel,
            value: l10n.formatMad(subtotal),
          ),
          const SizedBox(height: AppSpacing.sm),
          _SummaryRow(
            label: deliveryFee == 0 ? l10n.deliveryLabel : l10n.deliveryFeeLabel,
            value: deliveryFee == 0
                ? l10n.includedLabel
                : l10n.formatMad(deliveryFee),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: Divider(),
          ),
          _SummaryRow(
            label: l10n.totalDueOnDelivery,
            value: l10n.formatMad(total),
            emphasize: true,
          ),
          if (minimumOrder > 0) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              l10n.minimumOrderProgress,
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
              child: LinearProgressIndicator(
                minHeight: 10,
                value: progress,
                backgroundColor: AppColors.ink.withValues(alpha: 0.06),
                color: qualifiesForMinimum
                    ? AppColors.success
                    : AppColors.warning,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(
            qualifiesForMinimum
                ? l10n.eligibleForConfirmation
                : l10n.addMoreToReachMinimum(minimumOrder - subtotal),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: qualifiesForMinimum
                  ? AppColors.success
                  : AppColors.warning,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: qualifiesForMinimum
                  ? () => showCheckoutSheet(
                        context,
                        items: items,
                        subtotal: subtotal,
                        deliveryFee: deliveryFee,
                        total: total,
                        onOrderSent: onOrderSent,
                      )
                  : null,
              icon: const Icon(Icons.check_circle_outline_rounded),
              label: Text(l10n.placeCashOrder),
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
