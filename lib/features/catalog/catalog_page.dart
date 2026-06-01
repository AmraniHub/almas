import 'package:flutter/material.dart';

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
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _clearSearch() {
    _searchCtrl.clear();
    setState(() => _searchQuery = '');
  }

  void _resetFilters() {
    _searchCtrl.clear();
    setState(() {
      _searchQuery = '';
      _selectedCategory = demoCategories.first;
    });
  }

  @override
  Widget build(BuildContext context) {
    final filteredProducts = widget.products.where((product) {
      final categoryMatches = _selectedCategory == demoCategories.first ||
          product.category == _selectedCategory;
      final normalizedQuery = _searchQuery.trim().toLowerCase();
      final queryMatches = normalizedQuery.isEmpty ||
          product.name.toLowerCase().contains(normalizedQuery) ||
          product.category.toLowerCase().contains(normalizedQuery) ||
          product.tags.any((tag) => tag.toLowerCase().contains(normalizedQuery));

      return categoryMatches && queryMatches;
    }).toList();

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader(title: 'Product library'),
            GlassPanel(
              child: Column(
                children: [
                  TextField(
                    controller: _searchCtrl,
                    onChanged: (value) => setState(() => _searchQuery = value),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: 'Search saffron, mint, blends...',
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear_rounded),
                              onPressed: _clearSearch,
                              tooltip: 'Clear search',
                            )
                          : null,
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
                              label: Text(category),
                              selected: _selectedCategory == category,
                              onSelected: (_) => setState(
                                () => _selectedCategory = category,
                              ),
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
            if (filteredProducts.isEmpty)
              _EmptyCatalog(onReset: _resetFilters)
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: filteredProducts.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 1,
                  mainAxisSpacing: AppSpacing.md,
                  mainAxisExtent: 500,
                ),
                itemBuilder: (context, index) {
                  final product = filteredProducts[index];
                  return ProductCard(
                    product: product,
                    quantityInCart: widget.cartQuantities[product.id] ?? 0,
                    onAddToCart: () => widget.onAddToCart(product),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _EmptyCatalog extends StatelessWidget {
  const _EmptyCatalog({required this.onReset});

  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GlassPanel(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
        child: Column(
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.saffron.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.search_off_rounded,
                size: 32,
                color: AppColors.saffron,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('No products found', style: theme.textTheme.headlineMedium),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Try a different keyword or reset the category filter.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.lg),
            OutlinedButton.icon(
              onPressed: onReset,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Reset filters'),
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
    final theme = Theme.of(context);

    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.md,
      children: [
        _InsightPill(
          icon: Icons.inventory_2_rounded,
          label: '$matchCount products visible',
          accentColor: AppColors.olive,
        ),
        const _InsightPill(
          icon: Icons.payments_rounded,
          label: 'Cash on delivery default',
          accentColor: AppColors.terracotta,
        ),
        const _InsightPill(
          icon: Icons.place_rounded,
          label: 'Morocco delivery zone filtered',
          accentColor: AppColors.saffron,
        ),
        Text(
          'Operational note: minimum order 250 MAD.',
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
