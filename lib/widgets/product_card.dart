import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';
import '../models/product.dart';
import 'glass_panel.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({
    required this.product,
    required this.onAddToCart,
    super.key,
    this.quantityInCart = 0,
    this.onTap,
  });

  final Product product;
  final VoidCallback onAddToCart;
  final int quantityInCart;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: GlassPanel(
        padding: EdgeInsets.zero,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.white.withValues(alpha: 0.86),
            product.accentColor.withValues(alpha: 0.1),
          ],
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final content = Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Category + cart badge row
                  Row(
                    children: [
                      _TagChip(
                        label: product.category,
                        foregroundColor: product.accentColor,
                        backgroundColor:
                            product.accentColor.withValues(alpha: 0.12),
                      ),
                      const Spacer(),
                      if (quantityInCart > 0)
                        Badge(
                          label: Text('$quantityInCart'),
                          child: const SizedBox(width: 10, height: 10),
                        ),
                      if (!product.isAvailable)
                        const _TagChip(
                          label: 'Out of stock',
                          foregroundColor: AppColors.warning,
                          backgroundColor: Color(0x1A9A621C),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleLarge,
                  ),
                  Text(
                    product.arabicName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: product.accentColor,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    product.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium,
                  ),
                  if (product.heatLevel > 0) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: List.generate(
                        5,
                        (i) => Icon(
                          Icons.local_fire_department_rounded,
                          size: 14,
                          color: i < product.heatLevel
                              ? AppColors.burntOrange
                              : AppColors.ink.withValues(alpha: 0.12),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.sm),
                  SizedBox(
                    height: 28,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: product.tags.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(width: AppSpacing.xs),
                      itemBuilder: (context, index) {
                        final tag = product.tags[index];
                        return _TagChip(
                          label: tag,
                          foregroundColor: AppColors.ink,
                          backgroundColor:
                              AppColors.white.withValues(alpha: 0.68),
                        );
                      },
                    ),
                  ),
                  if (constraints.hasBoundedHeight) const Spacer(),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${product.price.toStringAsFixed(0)} MAD',
                              style: theme.textTheme.titleLarge
                                  ?.copyWith(fontSize: 22),
                            ),
                            Text(
                              product.packSize,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: AppColors.body.withValues(alpha: 0.82),
                              ),
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed:
                            product.isAvailable ? onAddToCart : null,
                        icon: const Icon(Icons.add_rounded),
                        label: const Text('Add'),
                      ),
                    ],
                  ),
                ],
              ),
            );

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(AppSpacing.panelRadius),
                  ),
                  child: SizedBox(
                    height: 140,
                    width: double.infinity,
                    child: product.imageUrl != null
                        ? CachedNetworkImage(
                            imageUrl: product.imageUrl!,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => _ImagePlaceholder(
                              color: product.accentColor,
                            ),
                            errorWidget: (context, url, error) =>
                                _ImagePlaceholder(color: product.accentColor),
                          )
                        : _ImagePlaceholder(color: product.accentColor),
                  ),
                ),
                if (constraints.hasBoundedHeight)
                  Expanded(child: content)
                else
                  content,
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color.withValues(alpha: 0.1),
      child: Center(
        child: Icon(Icons.spa_rounded, color: color, size: 48),
      ),
    );
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({
    required this.label,
    required this.foregroundColor,
    required this.backgroundColor,
  });

  final String label;
  final Color foregroundColor;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        child: Text(
          label,
          style: Theme.of(context)
              .textTheme
              .labelMedium
              ?.copyWith(color: foregroundColor),
        ),
      ),
    );
  }
}
