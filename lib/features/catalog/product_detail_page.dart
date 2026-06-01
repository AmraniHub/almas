import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
    final theme = Theme.of(context);
    final quantities = ref.watch(cartProvider);
    final qtyInCart = quantities[product.id] ?? 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // ── Hero image app bar ─────────────────────────────────────
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
                      placeholder: (_, __) => Container(
                        color: product.accentColor.withValues(alpha: 0.12),
                        child: Center(
                          child: Icon(Icons.spa_rounded,
                              color: product.accentColor, size: 72),
                        ),
                      ),
                      errorWidget: (_, __, ___) => Container(
                        color: product.accentColor.withValues(alpha: 0.12),
                        child: Center(
                          child: Icon(Icons.spa_rounded,
                              color: product.accentColor, size: 72),
                        ),
                      ),
                    )
                  : Container(
                      color: product.accentColor.withValues(alpha: 0.12),
                      child: Center(
                        child: Icon(Icons.spa_rounded,
                            color: product.accentColor, size: 72),
                      ),
                    ),
            ),
          ),

          // ── Content ────────────────────────────────────────────────
          SliverPadding(
            padding: const EdgeInsets.all(AppSpacing.md),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // Names
                Text(product.name, style: theme.textTheme.headlineMedium),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  product.arabicName,
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: product.accentColor,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // Origin + category chips
                Wrap(
                  spacing: AppSpacing.sm,
                  children: [
                    _Chip(
                      icon: Icons.place_rounded,
                      label: product.origin,
                      color: AppColors.body,
                    ),
                    _Chip(
                      icon: Icons.category_rounded,
                      label: product.category,
                      color: product.accentColor,
                    ),
                    _Chip(
                      icon: Icons.inventory_2_rounded,
                      label: product.packSize,
                      color: AppColors.olive,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),

                // Description
                GlassPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('About this product',
                          style: theme.textTheme.titleMedium),
                      const SizedBox(height: AppSpacing.sm),
                      Text(product.description,
                          style: theme.textTheme.bodyLarge),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // Heat level
                if (product.heatLevel > 0)
                  GlassPanel(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg,
                      vertical: AppSpacing.md,
                    ),
                    child: Row(
                      children: [
                        Text('Heat level',
                            style: theme.textTheme.titleMedium),
                        const Spacer(),
                        ...List.generate(
                          5,
                          (i) => Icon(
                            Icons.local_fire_department_rounded,
                            size: 20,
                            color: i < product.heatLevel
                                ? AppColors.burntOrange
                                : AppColors.ink.withValues(alpha: 0.12),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: AppSpacing.md),

                // Tags
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: product.tags
                      .map((t) => Chip(label: Text(t)))
                      .toList(),
                ),
                const SizedBox(height: AppSpacing.xl),

                // Price + order controls
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
                                  '${product.price.toStringAsFixed(0)} MAD',
                                  style: theme.textTheme.headlineMedium
                                      ?.copyWith(
                                          color: product.accentColor),
                                ),
                                Text(
                                  'per ${product.unitLabel}',
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
                                      horizontal: AppSpacing.sm),
                                  child: Text('$qtyInCart',
                                      style: theme.textTheme.titleLarge),
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
                                  ? () => ref
                                      .read(cartProvider.notifier)
                                      .add(product)
                                  : null,
                              icon: const Icon(Icons.add_shopping_cart_rounded),
                              label: const Text('Add to order'),
                            ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      // Quick WhatsApp inquiry
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => ContactService.whatsApp(
                            message:
                                'Bonjour Almas, je voudrais me renseigner sur: ${product.name} (${product.arabicName})',
                          ),
                          icon: const Icon(Icons.chat_rounded),
                          label: const Text('Ask on WhatsApp'),
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
