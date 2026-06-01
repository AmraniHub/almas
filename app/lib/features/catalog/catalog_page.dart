import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/demo_data.dart';
import '../../models/product.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/product_card.dart';
import '../../widgets/section_header.dart';

class CatalogPage extends StatefulWidget {
  const CatalogPage({
    required this.products,
    required this.cartQuantities,
    required this.onAddToCart,
    super.key,
  });

  final List<Product> products;
  final Map<String, int> cartQuantities;
  final ValueChanged<Product> onAddToCart;

  @override
  State<CatalogPage> createState() => _CatalogPageState();
}

class _CatalogPageState extends State<CatalogPage> {
  String _selectedCategory = demoCategories.first;
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final normalizedQuery = _searchQuery.trim().toLowerCase();

    final filteredProducts = widget.products.where((product) {
      final categoryMatches = _selectedCategory == demoCategories.first ||
          product.category == _selectedCategory;
      final queryMatches = normalizedQuery.isEmpty ||
          l10n.productSearchTerms(product).any(
            (term) => term.toLowerCase().contains(normalizedQuery),
          );

      return categoryMatches && queryMatches;
    }).toList();

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(
              title: l10n.productLibraryTitle,
              subtitle: l10n.productLibrarySubtitle,
            ),
            GlassPanel(
              child: Column(
                children: [
                  TextField(
                    onChanged: (value) {
                      setState(() {
                        _searchQuery = value;
                      });
                    },
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: l10n.catalogSearchHint,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: demoCategories
                          .map(
                            (category) => ChoiceChip(
                              label: Text(l10n.categoryLabel(category)),
                              selected: _selectedCategory == category,
                              onSelected: (_) {
                                setState(() {
                                  _selectedCategory = category;
                                });
                              },
                            ),
                          )
                          .toList(),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _CatalogInsightStrip(matchCount: filteredProducts.length),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                final crossAxisCount = width >= 1100
                    ? 3
                    : width >= 700
                        ? 2
                        : 1;
                final productCardExtent = crossAxisCount == 1 ? 500.0 : 480.0;

                if (filteredProducts.isEmpty) {
                  return GlassPanel(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.xl,
                      ),
                      child: Center(
                        child: Text(
                          l10n.noProductsMatchFilter,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                    ),
                  );
                }

                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: filteredProducts.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossAxisCount,
                    crossAxisSpacing: AppSpacing.md,
                    mainAxisSpacing: AppSpacing.md,
                    mainAxisExtent: productCardExtent,
                  ),
                  itemBuilder: (context, index) {
                    final product = filteredProducts[index];

                    return ProductCard(
                      product: product,
                      quantityInCart: widget.cartQuantities[product.id] ?? 0,
                      onAddToCart: () => widget.onAddToCart(product),
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _CatalogInsightStrip extends StatelessWidget {
  const _CatalogInsightStrip({
    required this.matchCount,
  });

  final int matchCount;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.md,
      children: [
        _InsightPill(
          icon: Icons.inventory_2_rounded,
          label: l10n.visibleProducts(matchCount),
          accentColor: AppColors.olive,
        ),
        _InsightPill(
          icon: Icons.payments_rounded,
          label: l10n.cashOnDeliveryDefault,
          accentColor: AppColors.terracotta,
        ),
        _InsightPill(
          icon: Icons.place_rounded,
          label: l10n.moroccoDeliveryZone,
          accentColor: AppColors.saffron,
        ),
        Text(
          l10n.operationalMinimumOrderNote,
          style: theme.textTheme.bodyMedium,
        ),
      ],
    );
  }
}

class _InsightPill extends StatelessWidget {
  const _InsightPill({
    required this.icon,
    required this.label,
    required this.accentColor,
  });

  final IconData icon;
  final String label;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: accentColor),
            const SizedBox(width: AppSpacing.xs),
            Text(label),
          ],
        ),
      ),
    );
  }
}
