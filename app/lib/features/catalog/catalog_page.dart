import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/catalog.dart';
import '../../models/product.dart';
import '../../services/contact_service.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/product_card.dart';
import '../../widgets/section_header.dart';
import 'product_detail_page.dart';

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
  static const _all = 'All';
  String _selectedCategory = _all;
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final normalizedQuery = _searchQuery.trim().toLowerCase();

    final filteredProducts = widget.products.where((product) {
      final categoryMatches = _selectedCategory == _all || product.category == _selectedCategory;
      final queryMatches = normalizedQuery.isEmpty ||
          l10n.productSearchTerms(product).any(
                (term) => term.toLowerCase().contains(normalizedQuery),
              );
      return categoryMatches && queryMatches;
    }).toList();

    final shelves = [_all, ...Catalog.categories.map((c) => c.id)];

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionHeader(
                title: l10n.productLibraryTitle,
                subtitle: l10n.productLibrarySubtitle,
              ),
              GlassPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      onChanged: (value) => setState(() => _searchQuery = value),
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.search_rounded),
                        hintText: l10n.catalogSearchHint,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    // Tall enough for the Cairo label: at 40 the chip text was cut off on a real phone
                    SizedBox(
                      height: 56,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: shelves.length,
                        separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                        itemBuilder: (context, index) {
                          final shelf = shelves[index];
                          return ChoiceChip(
                            label: Text(l10n.categoryLabel(shelf)),
                            selected: _selectedCategory == shelf,
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            onSelected: (_) => setState(() => _selectedCategory = shelf),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      '${l10n.visibleProducts(filteredProducts.length)} · ${l10n.operationalMinimumOrderNote}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    TextButton.icon(
                      onPressed: () => ContactService.whatsApp(message: l10n.largeQuantityWhatsAppMessage),
                      icon: const Icon(Icons.request_quote_rounded, color: AppColors.olive),
                      label: Text(l10n.askPriceForLargeQuantities),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (filteredProducts.isEmpty)
                GlassPanel(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
                    child: Center(
                      child: Text(
                        l10n.noProductsMatchFilter,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        SliverList.separated(
          itemCount: filteredProducts.length,
          separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
          itemBuilder: (context, index) {
            final product = filteredProducts[index];
            return ProductCard(
              product: product,
              quantityInCart: widget.cartQuantities[product.id] ?? 0,
              onAddToCart: () => widget.onAddToCart(product),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => ProductDetailPage(product: product)),
              ),
            );
          },
        ),
        const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),
      ],
    );
  }
}
