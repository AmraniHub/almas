import 'package:flutter/material.dart';

import '../core/localization/app_localizations.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';
import '../models/product.dart';
import 'glass_panel.dart';

/// One product as a compact row (the catalogue holds 120+ of them): its shelf colour, its name in the user's
/// language with the other name under it, the shop's price per kilo or per piece, and an add button that
/// shows how much is already in the cart (750 g, ×3).
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
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final secondary = l10n.productSecondaryName(product);

    return GestureDetector(
      onTap: onTap,
      child: GlassPanel(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: product.accentColor.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(_iconFor(product.category), color: product.accentColor, size: 26),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.productName(product),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  if (secondary.isNotEmpty)
                    Text(
                      secondary,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(color: product.accentColor),
                    ),
                  const SizedBox(height: 2),
                  Text(
                    l10n.pricePerUnit(product),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Colours set here: the theme painted the + the same dark colour as the button (seen on a phone)
                IconButton.filled(
                  onPressed: product.isAvailable ? onAddToCart : null,
                  icon: const Icon(Icons.add_rounded),
                  tooltip: l10n.addLabel,
                  style: IconButton.styleFrom(
                    backgroundColor: product.accentColor,
                    foregroundColor: Colors.white,
                  ),
                ),
                if (quantityInCart > 0)
                  Text(
                    l10n.amountLabel(product, quantityInCart),
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: product.accentColor,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static IconData _iconFor(String category) => switch (category) {
        'herbs' => Icons.eco_rounded,
        'seeds' => Icons.grain_rounded,
        'pastry' => Icons.cake_rounded,
        'pantry' => Icons.kitchen_rounded,
        'beauty' => Icons.spa_rounded,
        'incense' => Icons.local_fire_department_rounded,
        'blends' => Icons.blender_rounded,
        _ => Icons.restaurant_rounded,
      };
}
