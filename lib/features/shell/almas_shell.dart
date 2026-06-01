import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../providers/cart_provider.dart';
import '../../providers/products_provider.dart';
import '../../widgets/ambient_background.dart';
import '../admin/admin_page.dart';
import '../cart/cart_page.dart';
import '../catalog/catalog_page.dart';
import '../chat/chat_page.dart';
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
  void _goToCart()    => setState(() => _selectedIndex = 2);

  Widget _padded(Widget child) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.md, AppSpacing.md, 0,
        ),
        child: child,
      );

  @override
  Widget build(BuildContext context) {
    final products      = ref.watch(productsProvider);
    final quantities    = ref.watch(cartProvider);
    final cartItems     = ref.watch(cartItemsProvider);
    final cartCount     = ref.watch(cartCountProvider);
    final cartNotifier  = ref.read(cartProvider.notifier);

    final pages = [
      _padded(HomePage(
        onGoToCatalog: _goToCatalog,
        onGoToCart: _goToCart,
      )),
      _padded(CatalogPage(
        products: products,
        cartQuantities: quantities,
        onAddToCart: cartNotifier.add,
      )),
      _padded(CartPage(
        items: cartItems,
        onIncrement: cartNotifier.add,
        onDecrement: cartNotifier.decrement,
        onBrowseCatalog: _goToCatalog,
      )),
      _padded(const AdminPage()),
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
      // Chat FAB — always visible, opens general chat
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => const ChatPage(
              title: 'Chat with Almas',
              chatId: 'general',
            ),
          ),
        ),
        tooltip: 'Chat with Almas',
        backgroundColor: const Color(0xFF25D366), // WhatsApp green
        child: const Icon(Icons.chat_rounded, color: Colors.white),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.grid_view_rounded),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.storefront_rounded),
            label: 'Catalog',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: cartCount > 0,
              label: Text('$cartCount'),
              child: const Icon(Icons.shopping_bag_rounded),
            ),
            label: 'Cart',
          ),
          const NavigationDestination(
            icon: Icon(Icons.hub_rounded),
            label: 'Ops',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_rounded),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
