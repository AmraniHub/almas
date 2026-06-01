import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/product.dart';
import '../../providers/cart_provider.dart';
import '../../services/contact_service.dart';
import '../../widgets/glass_panel.dart';

class ProductDetailPage extends ConsumerWidget {
  const ProductDetailPage({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final quantities = ref.watch(cartProvider);
    final qtyInCart = quantities[product.id] ?? 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            backgroundColor: AppColors.background,
            leading: IconButton(
              onPressed: () => Navigator.of(context).pop(),
              icon: const CircleAvatar(
                backgroundColor: AppColors.white,
                child: Icon(Icons.arrow_back_rounded, color: AppColors.ink),
              ),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: product.imageUrl != null
                  ? CachedNetworkImage(
                      imageUrl: product.imageUrl!,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => _ImageFallback(color: product.accentColor),
                      errorWidget: (_, __, ___) =>
                          _ImageFallback(color: product.accentColor),
                    )
                  : _ImageFallback(color: product.accentColor),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(AppSpacing.md),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                Text(
                  l10n.productName(product),
                  style: theme.textTheme.headlineMedium,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.productSecondaryName(product),
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: product.accentColor,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  children: [
                    _Chip(
                      icon: Icons.place_rounded,
                      label: l10n.productOrigin(product),
                      color: AppColors.body,
                    ),
                    _Chip(
                      icon: Icons.category_rounded,
                      label: l10n.productCategory(product),
                      color: product.accentColor,
                    ),
                    _Chip(
                      icon: Icons.inventory_2_rounded,
                      label: l10n.productPackSize(product),
                      color: AppColors.olive,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                GlassPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.aboutThisProduct,
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        l10n.productDescription(product),
                        style: theme.textTheme.bodyLarge,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                if (product.heatLevel > 0)
                  GlassPanel(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg,
                      vertical: AppSpacing.md,
                    ),
                    child: Row(
                      children: [
                        Text(
                          l10n.heatLevel,
                          style: theme.textTheme.titleMedium,
                        ),
                        const Spacer(),
                        ...List.generate(
                          5,
                          (index) => Icon(
                            Icons.local_fire_department_rounded,
                            size: 20,
                            color: index < product.heatLevel
                                ? AppColors.burntOrange
                                : AppColors.ink.withValues(alpha: 0.12),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: l10n.productTags(product)
                      .map((tag) => Chip(label: Text(tag)))
                      .toList(),
                ),
                const SizedBox(height: AppSpacing.xl),
                GlassPanel(
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  l10n.formatMad(product.price),
                                  style: theme.textTheme.headlineMedium?.copyWith(
                                    color: product.accentColor,
                                  ),
                                ),
                                Text(
                                  l10n.perUnit(
                                    l10n.productUnitLabel(product),
                                  ),
                                  style: theme.textTheme.bodyMedium,
                                ),
                              ],
                            ),
                          ),
                          if (qtyInCart > 0)
                            Row(
                              children: [
                                IconButton.filledTonal(
                                  onPressed: () => ref
                                      .read(cartProvider.notifier)
                                      .decrement(product),
                                  icon: const Icon(Icons.remove_rounded),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: AppSpacing.sm,
                                  ),
                                  child: Text(
                                    '$qtyInCart',
                                    style: theme.textTheme.titleLarge,
                                  ),
                                ),
                                IconButton.filledTonal(
                                  onPressed: () => ref
                                      .read(cartProvider.notifier)
                                      .add(product),
                                  icon: const Icon(Icons.add_rounded),
                                ),
                              ],
                            )
                          else
                            ElevatedButton.icon(
                              onPressed: product.isAvailable
                                  ? () => ref.read(cartProvider.notifier).add(product)
                                  : null,
                              icon: const Icon(Icons.add_shopping_cart_rounded),
                              label: Text(l10n.addToOrder),
                            ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => ContactService.whatsApp(
                            message: l10n.productInquiryMessage(product),
                          ),
                          icon: const Icon(Icons.chat_rounded),
                          label: Text(l10n.askOnWhatsApp),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xxl),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color.withValues(alpha: 0.12),
      child: Center(
        child: Icon(Icons.spa_rounded, color: color, size: 72),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: AppSpacing.xs),
            Text(
              label,
              style: Theme.of(context)
                  .textTheme
                  .labelMedium
                  ?.copyWith(color: color),
            ),
          ],
        ),
      ),
    );
  }
}
