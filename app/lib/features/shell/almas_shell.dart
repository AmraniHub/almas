import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/cart_provider.dart';
import '../../providers/products_provider.dart';
import '../../widgets/ambient_background.dart';
import '../cart/cart_page.dart';
import '../catalog/catalog_page.dart';
import '../../services/contact_service.dart';
import '../home/home_page.dart';
import '../profile/profile_page.dart';

class AlmasShell extends ConsumerStatefulWidget {
  const AlmasShell({super.key});

  @override
  ConsumerState<AlmasShell> createState() => _AlmasShellState();
}

class _AlmasShellState extends ConsumerState<AlmasShell> {
  int _selectedIndex = 0;

  void _goToCatalog() => setState(() => _selectedIndex = 1);
  void _goToCart() => setState(() => _selectedIndex = 2);

  Widget _padded(Widget child) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.md,
          AppSpacing.md,
          0,
        ),
        child: child,
      );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final products = ref.watch(productsProvider);
    final quantities = ref.watch(cartProvider);
    final cartItems = ref.watch(cartItemsProvider);
    final cartCount = ref.watch(cartCountProvider);
    final cartNotifier = ref.read(cartProvider.notifier);

    final pages = [
      _padded(
        HomePage(
          onGoToCatalog: _goToCatalog,
          onGoToCart: _goToCart,
        ),
      ),
      _padded(
        CatalogPage(
          products: products,
          cartQuantities: quantities,
          onAddToCart: cartNotifier.add,
        ),
      ),
      _padded(
        CartPage(
          items: cartItems,
          onIncrement: cartNotifier.add,
          onDecrement: cartNotifier.decrement,
          onBrowseCatalog: _goToCatalog,
          onOrderSent: cartNotifier.clear,
        ),
      ),
      _padded(const ProfilePage()),
    ];

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          const AmbientBackground(),
          SafeArea(
            bottom: false,
            child: IndexedStack(
              index: _selectedIndex,
              sizing: StackFit.expand,
              children: pages,
            ),
          ),
        ],
      ),
      // The shop answers on WhatsApp: the button opens it (it used to open an in-app chat that replied by itself)
      floatingActionButton: FloatingActionButton(
        onPressed: () => ContactService.whatsApp(message: l10n.generalWhatsAppMessage),
        tooltip: l10n.chatWithAlmas,
        backgroundColor: const Color(0xFF25D366),
        child: const Icon(Icons.chat_rounded, color: Colors.white),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) => setState(() => _selectedIndex = index),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.grid_view_rounded),
            label: l10n.homeTab,
          ),
          NavigationDestination(
            icon: const Icon(Icons.storefront_rounded),
            label: l10n.catalogTab,
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: cartCount > 0,
              label: Text('$cartCount'),
              child: const Icon(Icons.shopping_bag_rounded),
            ),
            label: l10n.cartTab,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_rounded),
            label: l10n.profileTab,
          ),
        ],
      ),
    );
  }
}
