import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../models/order_snapshot.dart';
import '../../models/product.dart';

/// Supported locales. The app auto-selects based on the device locale.
/// Falls back to English when the device language is not supported.
class AppLocalizations {
  AppLocalizations(this.locale);

  final Locale locale;

  static const supportedLocales = [
    Locale('en'), // English
    Locale('fr'), // French  (primary Moroccan business language)
    Locale('ar'), // Arabic  (RTL — MaterialApp handles direction automatically)
    Locale('es'), // Spanish
  ];

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  static AppLocalizations of(BuildContext context) {
    final localizations =
        Localizations.of<AppLocalizations>(context, AppLocalizations);
    assert(localizations != null, 'AppLocalizations not found in context.');
    return localizations!;
  }

  String get languageCode => locale.languageCode;

  bool get isFrench  => languageCode == 'fr';
  bool get isArabic  => languageCode == 'ar';
  bool get isSpanish => languageCode == 'es';
  bool get isEnglish => !isFrench && !isArabic && !isSpanish;

  // ── App identity ──────────────────────────────────────────────────────────

  String get appTitle     => 'Almas';
  String get appBrandName => 'Almas Spices';

  // ── Navigation tabs ───────────────────────────────────────────────────────

  String get homeTab => _pick(
        english: 'Home',
        french:  'Accueil',
        arabic:  'الرئيسية',
        spanish: 'Inicio',
      );

  String get catalogTab => _pick(
        english: 'Catalog',
        french:  'Catalogue',
        arabic:  'الكتالوج',
        spanish: 'Catálogo',
      );

  String get cartTab => _pick(
        english: 'Cart',
        french:  'Panier',
        arabic:  'السلة',
        spanish: 'Carrito',
      );

  String get profileTab => _pick(
        english: 'Profile',
        french:  'Profil',
        arabic:  'الملف الشخصي',
        spanish: 'Perfil',
      );

  String get whatsAppContactTooltip => _pick(
        english: 'Contact on WhatsApp',
        french:  'Contacter sur WhatsApp',
        arabic:  'التواصل عبر واتساب',
        spanish: 'Contactar por WhatsApp',
      );

  // ── Home ──────────────────────────────────────────────────────────────────

  String get homeTitle    => appBrandName;
  String get homeSubtitle => _pick(
        english: "Morocco's finest spice supply partner for professional kitchens.",
        french:  'Votre partenaire marocain en épices premium pour les cuisines professionnelles.',
        arabic:  'شريككم المغربي في التوابل الفاخرة للمطابخ الاحترافية.',
        spanish: 'Su socio marroquí en especias premium para cocinas profesionales.',
      );

  String get featuredThisWeek => _pick(
        english: 'Featured this week',
        french:  'À la une cette semaine',
        arabic:  'منتجات هذا الأسبوع',
        spanish: 'Destacados esta semana',
      );

  String get seeAllProducts => _pick(
        english: 'See all products',
        french:  'Voir tous les produits',
        arabic:  'عرض كل المنتجات',
        spanish: 'Ver todos los productos',
      );

  String get activeOrderTapToTrack => _pick(
        english: 'Active order – tap to track',
        french:  'Commande active – appuyez pour suivre',
        arabic:  'طلب نشط – اضغط للتتبع',
        spanish: 'Pedido activo – toca para rastrear',
      );

  String orderItemsAndTotal(int itemCount, double total) => _pick(
        english: '$itemCount items · ${formatMad(total)}',
        french:  '$itemCount articles · ${formatMad(total)}',
        arabic:  '$itemCount عناصر · ${formatMad(total)}',
        spanish: '$itemCount artículos · ${formatMad(total)}',
      );

  String get browseCatalog => _pick(
        english: 'Browse catalog',
        french:  'Parcourir le catalogue',
        arabic:  'تصفح الكتالوج',
        spanish: 'Explorar catálogo',
      );

  String get viewCart => _pick(
        english: 'View cart',
        french:  'Voir le panier',
        arabic:  'عرض السلة',
        spanish: 'Ver carrito',
      );

  // ── Catalog ───────────────────────────────────────────────────────────────

  String get productLibraryTitle => _pick(
        english: 'Product library',
        french:  'Bibliothèque produits',
        arabic:  'مكتبة المنتجات',
        spanish: 'Catálogo de productos',
      );

  String get catalogSearchHint => _pick(
        english: 'Search saffron, mint, blends...',
        french:  'Rechercher safran, menthe, mélanges...',
        arabic:  'ابحث عن الزعفران أو النعناع أو الخلطات...',
        spanish: 'Buscar azafrán, menta, mezclas...',
      );

  String visibleProducts(int matchCount) => _pick(
        english: '$matchCount products visible',
        french:  '$matchCount produits affichés',
        arabic:  '$matchCount منتجات ظاهرة',
        spanish: '$matchCount productos visibles',
      );

  String get cashOnDeliveryDefault => _pick(
        english: 'Cash on delivery default',
        french:  'Paiement à la livraison par défaut',
        arabic:  'الدفع عند الاستلام هو الافتراضي',
        spanish: 'Pago contra entrega por defecto',
      );

  String get moroccoDeliveryZone => _pick(
        english: 'Morocco delivery zone',
        french:  'Zone de livraison Maroc',
        arabic:  'منطقة التوصيل داخل المغرب',
        spanish: 'Zona de entrega Marruecos',
      );

  String get minimumOrderNote => _pick(
        english: 'Min. order 250 MAD',
        french:  'Commande min. 250 MAD',
        arabic:  'الحد الأدنى للطلب 250 درهم',
        spanish: 'Pedido mín. 250 MAD',
      );

  String get noProductsFound => _pick(
        english: 'No products found',
        french:  'Aucun produit trouvé',
        arabic:  'لا توجد منتجات',
        spanish: 'No se encontraron productos',
      );

  String get noProductsFoundSubtitle => _pick(
        english: 'Try a different keyword or reset the category filter.',
        french:  'Essayez un autre mot-clé ou réinitialisez le filtre de catégorie.',
        arabic:  'جرب كلمة أخرى أو أعد ضبط فلتر الفئة.',
        spanish: 'Prueba otra palabra clave o restablece el filtro de categoría.',
      );

  String get resetFilters => _pick(
        english: 'Reset filters',
        french:  'Réinitialiser les filtres',
        arabic:  'إعادة ضبط الفلاتر',
        spanish: 'Restablecer filtros',
      );

  // ── Cart ──────────────────────────────────────────────────────────────────

  String get orderDraftTitle => _pick(
        english: 'Order draft',
        french:  'Brouillon de commande',
        arabic:  'مسودة الطلب',
        spanish: 'Borrador de pedido',
      );

  String get noOrderDraftYet => _pick(
        english: 'No order draft yet',
        french:  'Aucun brouillon de commande',
        arabic:  'لا توجد مسودة طلب بعد',
        spanish: 'Aún no hay borrador de pedido',
      );

  String get emptyCartSubtitle => _pick(
        english: 'Start from the catalog and build a restaurant order with reusable staples and signature blends.',
        french:  'Commencez par le catalogue et composez une commande restaurant avec essentiels et mélanges signature.',
        arabic:  'ابدأ من الكتالوج وأنشئ طلب مطعم يضم الأساسيات المتكررة والخلطات المميزة.',
        spanish: 'Comienza desde el catálogo y construye un pedido de restaurante con los básicos y mezclas exclusivas.',
      );

  String get openCatalog => _pick(
        english: 'Open catalog',
        french:  'Ouvrir le catalogue',
        arabic:  'فتح الكتالوج',
        spanish: 'Abrir catálogo',
      );

  String get madEach => _pick(
        english: 'MAD each',
        french:  'MAD l\'unité',
        arabic:  'درهم للوحدة',
        spanish: 'MAD c/u',
      );

  String get checkoutSummary => _pick(
        english: 'Checkout summary',
        french:  'Résumé de commande',
        arabic:  'ملخص الطلب',
        spanish: 'Resumen del pedido',
      );

  String get subtotalLabel => _pick(
        english: 'Subtotal',
        french:  'Sous-total',
        arabic:  'المجموع الفرعي',
        spanish: 'Subtotal',
      );

  String get deliveryLabel => _pick(
        english: 'Delivery',
        french:  'Livraison',
        arabic:  'التوصيل',
        spanish: 'Envío',
      );

  String get deliveryFeeLabel => _pick(
        english: 'Delivery fee',
        french:  'Frais de livraison',
        arabic:  'رسوم التوصيل',
        spanish: 'Coste de envío',
      );

  String get includedLabel => _pick(
        english: 'Included',
        french:  'Inclus',
        arabic:  'مشمول',
        spanish: 'Incluido',
      );

  String get totalDueOnDelivery => _pick(
        english: 'Total due on delivery',
        french:  'Total à payer à la livraison',
        arabic:  'الإجمالي المستحق عند الاستلام',
        spanish: 'Total a pagar al recibir',
      );

  String get minimumOrderProgress => _pick(
        english: 'Minimum order progress',
        french:  'Progression du minimum de commande',
        arabic:  'تقدم الحد الأدنى للطلب',
        spanish: 'Progreso del pedido mínimo',
      );

  String get readyToOrder => _pick(
        english: 'Ready to order — confirm via WhatsApp.',
        french:  'Prêt à commander — confirmez via WhatsApp.',
        arabic:  'جاهز للطلب — أكد عبر واتساب.',
        spanish: 'Listo para pedir — confirma por WhatsApp.',
      );

  String addMoreToReachMinimum(double amount) => _pick(
        english: 'Add ${formatMad(amount)} more to reach the 250 MAD minimum.',
        french:  'Ajoutez encore ${formatMad(amount)} pour atteindre le minimum de 250 MAD.',
        arabic:  'أضف ${formatMad(amount)} أخرى للوصول إلى الحد الأدنى 250 درهم.',
        spanish: 'Agrega ${formatMad(amount)} más para llegar al mínimo de 250 MAD.',
      );

  String get orderViaWhatsApp => _pick(
        english: 'Order via WhatsApp',
        french:  'Commander via WhatsApp',
        arabic:  'الطلب عبر واتساب',
        spanish: 'Pedir por WhatsApp',
      );

  String addMoreLabel(double amount) => _pick(
        english: 'Add ${formatMad(amount)} more',
        french:  'Ajoutez ${formatMad(amount)}',
        arabic:  'أضف ${formatMad(amount)} أخرى',
        spanish: 'Agrega ${formatMad(amount)} más',
      );

  // ── Order tracking ────────────────────────────────────────────────────────

  String get orderTrackingTitle => _pick(
        english: 'Order tracking',
        french:  'Suivi de commande',
        arabic:  'تتبع الطلب',
        spanish: 'Seguimiento del pedido',
      );

  String get orderTrackingSubtitle => _pick(
        english: 'Real-time status of your current order.',
        french:  'Statut en temps réel de votre commande en cours.',
        arabic:  'حالة طلبك الحالية في الوقت الفعلي.',
        spanish: 'Estado en tiempo real de tu pedido actual.',
      );

  String orderChatTitle(String orderId) => _pick(
        english: 'Order $orderId',
        french:  'Commande $orderId',
        arabic:  'الطلب $orderId',
        spanish: 'Pedido $orderId',
      );

  String get needHelpWithOrder => _pick(
        english: 'Need help with this order?',
        french:  'Besoin d\'aide pour cette commande ?',
        arabic:  'هل تحتاج مساعدة بخصوص هذا الطلب؟',
        spanish: '¿Necesitas ayuda con este pedido?',
      );

  // ── Profile ───────────────────────────────────────────────────────────────

  String get restaurantProfileTitle => _pick(
        english: 'Restaurant profile',
        french:  'Profil restaurant',
        arabic:  'ملف المطعم',
        spanish: 'Perfil del restaurante',
      );

  String get deliveryBranchesTitle => _pick(
        english: 'Delivery branches',
        french:  'Sites de livraison',
        arabic:  'فروع التوصيل',
        spanish: 'Sucursales de entrega',
      );

  String get favoriteBundlesTitle => _pick(
        english: 'Favorite bundles',
        french:  'Lots favoris',
        arabic:  'الباقات المفضلة',
        spanish: 'Paquetes favoritos',
      );

  String get preferencesTitle => _pick(
        english: 'Preferences',
        french:  'Préférences',
        arabic:  'التفضيلات',
        spanish: 'Preferencias',
      );

  String get recentInvoicesTitle => _pick(
        english: 'Recent invoices',
        french:  'Factures récentes',
        arabic:  'الفواتير الأخيرة',
        spanish: 'Facturas recientes',
      );

  List<LocalizedKeyValue> get profilePreferences => [
        LocalizedKeyValue(
          label: _pick(
            english: 'App language',
            french:  'Langue de l\'application',
            arabic:  'لغة التطبيق',
            spanish: 'Idioma de la app',
          ),
          value: _pick(
            english: 'Follows your phone language automatically',
            french:  'Suit automatiquement la langue du téléphone',
            arabic:  'تتبع لغة الهاتف تلقائياً',
            spanish: 'Sigue automáticamente el idioma del teléfono',
          ),
        ),
        LocalizedKeyValue(
          label: _pick(
            english: 'Payment flow',
            french:  'Mode de paiement',
            arabic:  'طريقة الدفع',
            spanish: 'Forma de pago',
          ),
          value: cashOnDeliveryLabel,
        ),
        LocalizedKeyValue(
          label: _pick(
            english: 'Notifications',
            french:  'Notifications',
            arabic:  'الإشعارات',
            spanish: 'Notificaciones',
          ),
          value: _pick(
            english: 'WhatsApp + order confirmations',
            french:  'WhatsApp + confirmations de commande',
            arabic:  'واتساب + تأكيدات الطلب',
            spanish: 'WhatsApp + confirmaciones de pedido',
          ),
        ),
        LocalizedKeyValue(
          label: _pick(
            english: 'Reorder behavior',
            french:  'Comportement de récommande',
            arabic:  'سلوك إعادة الطلب',
            spanish: 'Comportamiento de reorden',
          ),
          value: _pick(
            english: 'Restore last high-volume basket',
            french:  'Restaurer le dernier panier grand volume',
            arabic:  'استعادة آخر سلة كبيرة الحجم',
            spanish: 'Restaurar la última cesta de gran volumen',
          ),
        ),
      ];

  // ── Contact ───────────────────────────────────────────────────────────────

  String get contactTitle => _pick(
        english: 'Contact Almas',
        french:  'Contacter Almas',
        arabic:  'التواصل مع ألماس',
        spanish: 'Contactar Almas',
      );

  String get whatsappLabel => 'WhatsApp';

  String get websiteLabel => _pick(
        english: 'Website',
        french:  'Site web',
        arabic:  'الموقع',
        spanish: 'Sitio web',
      );

  String get cashOnDeliveryLabel => _pick(
        english: 'Cash on delivery',
        french:  'Paiement à la livraison',
        arabic:  'الدفع عند الاستلام',
        spanish: 'Pago contra entrega',
      );

  // ── Product detail ────────────────────────────────────────────────────────

  String get aboutThisProduct => _pick(
        english: 'About this product',
        french:  'À propos de ce produit',
        arabic:  'حول هذا المنتج',
        spanish: 'Acerca de este producto',
      );

  String get heatLevel => _pick(
        english: 'Heat level',
        french:  'Niveau de piquant',
        arabic:  'مستوى الحدة',
        spanish: 'Nivel de picante',
      );

  String perUnit(String unitLabel) => _pick(
        english: 'per $unitLabel',
        french:  'par $unitLabel',
        arabic:  'لكل $unitLabel',
        spanish: 'por $unitLabel',
      );

  String get addToOrder => _pick(
        english: 'Add to order',
        french:  'Ajouter à la commande',
        arabic:  'أضف إلى الطلب',
        spanish: 'Agregar al pedido',
      );

  String get addLabel => _pick(
        english: 'Add',
        french:  'Ajouter',
        arabic:  'إضافة',
        spanish: 'Agregar',
      );

  String get outOfStock => _pick(
        english: 'Out of stock',
        french:  'Rupture de stock',
        arabic:  'غير متوفر',
        spanish: 'Sin existencias',
      );

  String get askOnWhatsApp => _pick(
        english: 'Ask on WhatsApp',
        french:  'Demander sur WhatsApp',
        arabic:  'اسأل عبر واتساب',
        spanish: 'Preguntar por WhatsApp',
      );

  // ── Chat ──────────────────────────────────────────────────────────────────

  String get chatGreeting => _pick(
        english: 'Hello! How can I help you today? 🌿',
        french:  'Bonjour ! Comment puis-je vous aider aujourd\'hui ? 🌿',
        arabic:  'مرحبا! كيف يمكنني مساعدتك اليوم؟ 🌿',
        spanish: '¡Hola! ¿En qué puedo ayudarte hoy? 🌿',
      );

  String get chatInputHint => _pick(
        english: 'Write a message...',
        french:  'Écrire un message...',
        arabic:  'اكتب رسالة...',
        spanish: 'Escribe un mensaje...',
      );

  // ── Order stage labels ────────────────────────────────────────────────────

  String orderStageLabel(OrderStage stage) => switch (stage) {
        OrderStage.placed => _pick(
            english: 'Placed',
            french:  'Créée',
            arabic:  'تم الطلب',
            spanish: 'Recibido',
          ),
        OrderStage.confirmed => _pick(
            english: 'Confirmed',
            french:  'Confirmée',
            arabic:  'مؤكد',
            spanish: 'Confirmado',
          ),
        OrderStage.outForDelivery => _pick(
            english: 'Delivery',
            french:  'Livraison',
            arabic:  'التوصيل',
            spanish: 'En reparto',
          ),
        OrderStage.delivered => _pick(
            english: 'Delivered',
            french:  'Livrée',
            arabic:  'تم التسليم',
            spanish: 'Entregado',
          ),
      };

  String statusMessage(OrderStage stage) => switch (stage) {
        OrderStage.placed => _pick(
            english: 'Your order has been placed and is waiting for confirmation from Almas.',
            french:  'Votre commande a été enregistrée et attend la confirmation d\'Almas.',
            arabic:  'تم تسجيل طلبك وهو الآن بانتظار تأكيد ألماس.',
            spanish: 'Tu pedido ha sido recibido y está esperando confirmación de Almas.',
          ),
        OrderStage.confirmed => _pick(
            english: 'Order confirmed! Your products are being prepared for dispatch.',
            french:  'Commande confirmée ! Vos produits sont en préparation pour l\'expédition.',
            arabic:  'تم تأكيد الطلب! يجري الآن تجهيز منتجاتك للإرسال.',
            spanish: '¡Pedido confirmado! Tus productos están siendo preparados para el envío.',
          ),
        OrderStage.outForDelivery => _pick(
            english: 'Your order is on the way! The driver will arrive soon.',
            french:  'Votre commande est en route ! Le chauffeur arrive bientôt.',
            arabic:  'طلبك في الطريق! سيصل السائق قريباً.',
            spanish: '¡Tu pedido está en camino! El repartidor llegará pronto.',
          ),
        OrderStage.delivered => _pick(
            english: 'Delivered successfully. Thank you for ordering from Almas!',
            french:  'Livrée avec succès. Merci d\'avoir commandé chez Almas !',
            arabic:  'تم التسليم بنجاح. شكراً لطلبك من ألماس!',
            spanish: 'Entregado con éxito. ¡Gracias por pedir en Almas!',
          ),
      };

  // ── Invoice statuses ──────────────────────────────────────────────────────

  String get deliveredStatus => _pick(
        english: 'Delivered',
        french:  'Livrée',
        arabic:  'تم التسليم',
        spanish: 'Entregado',
      );

  String get paidStatus => _pick(
        english: 'Paid',
        french:  'Payée',
        arabic:  'مدفوعة',
        spanish: 'Pagado',
      );

  // ── Category labels ───────────────────────────────────────────────────────

  String categoryLabel(String category) => switch (category) {
        'All'       => _pick(english: 'All',       french: 'Tous',       arabic: 'الكل',         spanish: 'Todo'),
        'Signature' => _pick(english: 'Signature', french: 'Signature',  arabic: 'مميز',          spanish: 'Exclusivo'),
        'Blends'    => _pick(english: 'Blends',    french: 'Mélanges',   arabic: 'خلطات',         spanish: 'Mezclas'),
        'Ground'    => _pick(english: 'Ground',    french: 'Moulues',    arabic: 'مطحونة',        spanish: 'Molidas'),
        'Whole'     => _pick(english: 'Whole',     french: 'Entières',   arabic: 'حبوب كاملة',    spanish: 'Enteras'),
        'Herbs'     => _pick(english: 'Herbs',     french: 'Herbes',     arabic: 'أعشاب',         spanish: 'Hierbas'),
        _           => category,
      };

  // ── WhatsApp messages ─────────────────────────────────────────────────────

  String get generalWhatsAppMessage => _pick(
        english: 'Hello Almas 👋 I would like to place an order.',
        french:  'Bonjour Almas 👋 Je souhaite passer une commande.',
        arabic:  'مرحبا ألماس 👋 أود تقديم طلب.',
        spanish: 'Hola Almas 👋 Me gustaría hacer un pedido.',
      );

  String orderInquiryMessage(String orderId) => _pick(
        english: 'Hello Almas, I would like more information about order $orderId.',
        french:  'Bonjour Almas, je voudrais des informations sur ma commande $orderId.',
        arabic:  'مرحبا ألماس، أود الحصول على معلومات حول طلبي $orderId.',
        spanish: 'Hola Almas, me gustaría más información sobre el pedido $orderId.',
      );

  String productInquiryMessage(Product product) {
    final name = productName(product);
    return _pick(
      english: 'Hello Almas, I would like information about $name.',
      french:  'Bonjour Almas, je voudrais des informations sur $name.',
      arabic:  'مرحبا ألماس، أود الاستفسار عن $name.',
      spanish: 'Hola Almas, me gustaría información sobre $name.',
    );
  }

  // ── Number formatting ─────────────────────────────────────────────────────

  String formatMad(num amount) => '${amount.toStringAsFixed(0)} MAD';

  // ── Product i18n ──────────────────────────────────────────────────────────

  String productName(Product product) {
    if (isEnglish) return product.name;
    return _productCopy(product.id).nameFor(languageCode, fallback: product.name);
  }

  String productSecondaryName(Product product) {
    if (isArabic) return product.name;
    return product.arabicName;
  }

  String productCategory(Product product) => categoryLabel(product.category);

  String productOrigin(Product product) {
    if (isEnglish) return product.origin;
    return _productCopy(product.id).originFor(languageCode, fallback: product.origin);
  }

  String productDescription(Product product) {
    if (isEnglish) return product.description;
    return _productCopy(product.id).descriptionFor(languageCode, fallback: product.description);
  }

  String productPackSize(Product product) {
    if (isEnglish) return product.packSize;
    return _productCopy(product.id).packSizeFor(languageCode, fallback: product.packSize);
  }

  String productUnitLabel(Product product) {
    if (isEnglish) return product.unitLabel;
    return _productCopy(product.id).unitLabelFor(languageCode, fallback: product.unitLabel);
  }

  List<String> productTags(Product product) {
    if (isEnglish) return product.tags;
    return _productCopy(product.id).tagsFor(languageCode, fallback: product.tags);
  }

  String productNameById(String productId) =>
      _productCopy(productId).nameFor(languageCode, fallback: productId);

  // ── Internal helpers ──────────────────────────────────────────────────────

  String _pick({
    required String english,
    required String french,
    required String arabic,
    required String spanish,
  }) {
    return switch (languageCode) {
      'fr' => french,
      'ar' => arabic,
      'es' => spanish,
      _    => english,
    };
  }
}

// ── Data classes ──────────────────────────────────────────────────────────────

class LocalizedInfoItem {
  const LocalizedInfoItem({required this.title, required this.subtitle});
  final String title;
  final String subtitle;
}

class LocalizedKeyValue {
  const LocalizedKeyValue({required this.label, required this.value});
  final String label;
  final String value;
}

class LocalizedInvoiceItem {
  const LocalizedInvoiceItem({
    required this.id,
    required this.amount,
    required this.status,
  });
  final String id;
  final String amount;
  final String status;
}

// ── Product copy ──────────────────────────────────────────────────────────────

class _LocalizedProductCopy {
  const _LocalizedProductCopy({
    required this.nameFr,    required this.nameAr,    required this.nameEs,
    required this.originFr,  required this.originAr,  required this.originEs,
    required this.descFr,    required this.descAr,    required this.descEs,
    required this.packFr,    required this.packAr,    required this.packEs,
    required this.unitFr,    required this.unitAr,    required this.unitEs,
    required this.tagsFr,    required this.tagsAr,    required this.tagsEs,
  });

  final String nameFr, nameAr, nameEs;
  final String originFr, originAr, originEs;
  final String descFr, descAr, descEs;
  final String packFr, packAr, packEs;
  final String unitFr, unitAr, unitEs;
  final List<String> tagsFr, tagsAr, tagsEs;

  String nameFor(String lc, {required String fallback}) =>
      switch (lc) { 'fr' => nameFr, 'ar' => nameAr, 'es' => nameEs, _ => fallback };

  String originFor(String lc, {required String fallback}) =>
      switch (lc) { 'fr' => originFr, 'ar' => originAr, 'es' => originEs, _ => fallback };

  String descriptionFor(String lc, {required String fallback}) =>
      switch (lc) { 'fr' => descFr, 'ar' => descAr, 'es' => descEs, _ => fallback };

  String packSizeFor(String lc, {required String fallback}) =>
      switch (lc) { 'fr' => packFr, 'ar' => packAr, 'es' => packEs, _ => fallback };

  String unitLabelFor(String lc, {required String fallback}) =>
      switch (lc) { 'fr' => unitFr, 'ar' => unitAr, 'es' => unitEs, _ => fallback };

  List<String> tagsFor(String lc, {required List<String> fallback}) =>
      switch (lc) { 'fr' => tagsFr, 'ar' => tagsAr, 'es' => tagsEs, _ => fallback };
}

_LocalizedProductCopy _productCopy(String id) => switch (id) {
      'saffron_threads' => const _LocalizedProductCopy(
          nameFr: 'Filaments de Safran Royal',        nameAr: 'زعفران ملكي',               nameEs: 'Hebras de Azafrán Real',
          originFr: 'Taliouine, Maroc',               originAr: 'تالوين، المغرب',           originEs: 'Taliouine, Marruecos',
          descFr: 'Arôme floral profond avec finale miel, idéal pour riz signature, fruits de mer et pâtisserie fine.',
          descAr: 'عبير زهري عميق مع لمسة عسلية نقية، مثالي لأطباق الأرز البحرية والحلويات الراقية.',
          descEs: 'Aroma floral profundo con acabado de miel, ideal para arroz, mariscos y repostería fina.',
          packFr: 'Boîte métal 10 g',  packAr: 'علبة 10 غ',  packEs: 'Lata 10 g',
          unitFr: 'boîte',             unitAr: 'علبة',        unitEs: 'lata',
          tagsFr: ['Premium', 'Rotation rapide'],  tagsAr: ['فاخر', 'سريع الحركة'],  tagsEs: ['Premium', 'Alta rotación'],
        ),
      'ras_el_hanout' => const _LocalizedProductCopy(
          nameFr: 'Ras el Hanout Atlas',              nameAr: 'رأس الحانوت الأطلسي',        nameEs: 'Ras el Hanout Atlas',
          originFr: 'Marrakech, Maroc',               originAr: 'مراكش، المغرب',            originEs: 'Marrakech, Marruecos',
          descFr: 'Mélange maison pour tajines et viandes rôties avec douceur chaude, zeste d\'agrumes et poivre subtil.',
          descAr: 'خلطة منزلية متعددة الطبقات للطواجن واللحوم المشوية مع حلاوة دافئة وقشر حمضيات وفلفل خفيف.',
          descEs: 'Mezcla de la casa para tajines y carnes asadas con dulzor cálido, ralladura de cítricos y pimienta sutil.',
          packFr: 'Sachet 500 g',  packAr: 'كيس 500 غ',  packEs: 'Bolsa 500 g',
          unitFr: 'sachet',        unitAr: 'كيس',         unitEs: 'bolsa',
          tagsFr: ['Choix chef', 'Prêt pour lots'],  tagsAr: ['اختيار الشيف', 'جاهز للباقات'],  tagsEs: ['Elección del chef', 'Apto para lotes'],
        ),
      'smoked_paprika' => const _LocalizedProductCopy(
          nameFr: 'Paprika Fumé',                     nameAr: 'بابريكا مدخنة',              nameEs: 'Pimentón Ahumado',
          originFr: 'Ligne chef',                     originAr: 'خط الشيف',                 originEs: 'Línea chef',
          descFr: 'Couleur rouge dense et fumée douce pour grills, sauces et mélanges maison.',
          descAr: 'لون أحمر كثيف ودخان حلو للشوايات والصلصات وخلطات التتبيل المنزلية.',
          descEs: 'Color rojo intenso y humo suave para parrillas, salsas y mezclas caseras.',
          packFr: 'Sac 1 kg',  packAr: 'كيس 1 كلغ',  packEs: 'Bolsa 1 kg',
          unitFr: 'sac',       unitAr: 'كيس',          unitEs: 'bolsa',
          tagsFr: ['Boost couleur', 'BBQ'],  tagsAr: ['تعزيز اللون', 'شواء'],  tagsEs: ['Potencia color', 'BBQ'],
        ),
      'black_cumin' => const _LocalizedProductCopy(
          nameFr: 'Graines de Cumin Noir',            nameAr: 'حبة البركة',                 nameEs: 'Semillas de Comino Negro',
          originFr: 'Réseau fournisseurs Fès',         originAr: 'شبكة موردي فاس',           originEs: 'Red de proveedores de Fez',
          descFr: 'Graines terreuses et poivrées pour pains, sauces laitières et huiles de finition.',
          descAr: 'حبوب ترابية وفلفلية للخبز والصلصات اللبنية وزيوت اللمسة الأخيرة.',
          descEs: 'Semillas terrosas y especiadas para panes, salsas lácteas y aceites de acabado.',
          packFr: 'Pot 750 g',  packAr: 'مرطبان 750 غ',  packEs: 'Tarro 750 g',
          unitFr: 'pot',        unitAr: 'مرطبان',           unitEs: 'tarro',
          tagsFr: ['Boulangerie', 'Base pantry'],  tagsAr: ['مخبز', 'أساس المخزن'],  tagsEs: ['Panadería', 'Despensa básica'],
        ),
      'dried_mint' => const _LocalizedProductCopy(
          nameFr: 'Menthe Verte Séchée',              nameAr: 'نعناع مجفف',                 nameEs: 'Menta Verde Seca',
          originFr: 'Fermes de Meknès',               originAr: 'مزارع مكناس',              originEs: 'Granjas de Meknès',
          descFr: 'Fraîcheur végétale pour service thé, marinades et sauces au yaourt.',
          descAr: 'انتعاش عشبي لخدمة الشاي والتتبيلات والصلصات المبنية على الزبادي.',
          descEs: 'Frescor herbal para servicio de té, marinadas y salsas de yogur.',
          packFr: 'Sachet 400 g',  packAr: 'كيس 400 غ',  packEs: 'Bolsa 400 g',
          unitFr: 'sachet',         unitAr: 'كيس',         unitEs: 'bolsa',
          tagsFr: ['Thé', 'Finale fraîche'],  tagsAr: ['شاي', 'لمسة منعشة'],  tagsEs: ['Té', 'Acabado fresco'],
        ),
      'turmeric_gold' => const _LocalizedProductCopy(
          nameFr: 'Curcuma Gold',                     nameAr: 'كركم ذهبي',                  nameEs: 'Cúrcuma Dorada',
          originFr: 'Qualité premium importée',        originAr: 'درجة ممتازة مستوردة',      originEs: 'Calidad premium importada',
          descFr: 'Curcuma riche en curcumine avec couleur dorée intense pour soupes, sauces et menus bien-être.',
          descAr: 'كركم غني بالكركمين ولون ذهبي قوي للشوربات والصلصات وقوائم العافية.',
          descEs: 'Cúrcuma rica en curcumina con color dorado intenso para sopas, salsas y menús saludables.',
          packFr: 'Sac 1 kg',  packAr: 'كيس 1 كلغ',  packEs: 'Bolsa 1 kg',
          unitFr: 'sac',       unitAr: 'كيس',          unitEs: 'bolsa',
          tagsFr: ['Couleur intense', 'Populaire'],  tagsAr: ['لون قوي', 'شائع'],  tagsEs: ['Color intenso', 'Popular'],
        ),
      'harissa_base' => const _LocalizedProductCopy(
          nameFr: 'Base Harissa',                     nameAr: 'خلطة هريسة أساسية',          nameEs: 'Base de Harissa',
          originFr: 'Ligne chef',                     originAr: 'خط الشيف',                 originEs: 'Línea chef',
          descFr: 'Base équilibrée piment, ail et carvi pour une harissa régulière en quelques minutes.',
          descAr: 'قاعدة متوازنة من الفلفل والثوم والكروية تمنح المطابخ نكهة هريسة ثابتة خلال دقائق.',
          descEs: 'Base equilibrada de guindilla, ajo y alcaravea para una harissa consistente en minutos.',
          packFr: 'Sachet 650 g',  packAr: 'كيس 650 غ',  packEs: 'Bolsa 650 g',
          unitFr: 'sachet',         unitAr: 'كيس',         unitEs: 'bolsa',
          tagsFr: ['Piquant', 'Gain de temps'],  tagsAr: ['حار', 'توفير الوقت'],  tagsEs: ['Picante', 'Ahorra tiempo'],
        ),
      'preserved_lemon_salt' => const _LocalizedProductCopy(
          nameFr: 'Sel au Citron Confit',             nameAr: 'ملح الليمون المصبر',         nameEs: 'Sal de Limón Confitado',
          originFr: 'Atelier finition Tanger',         originAr: 'غرفة التشطيب بطنجة',      originEs: 'Taller de acabado de Tánger',
          descFr: 'Sel d\'agrumes saumuré pour poisson, frites, salades et dressage final.',
          descAr: 'ملح حمضي مملح للأسماك والبطاطس المقلية ومحطات السلطات واللمسة النهائية.',
          descEs: 'Sal cítrica en salmuera para pescado, patatas fritas, ensaladas y acabado final.',
          packFr: 'Pot 300 g',  packAr: 'مرطبان 300 غ',  packEs: 'Tarro 300 g',
          unitFr: 'pot',        unitAr: 'مرطبان',           unitEs: 'tarro',
          tagsFr: ['Signature', 'Finition'],  tagsAr: ['مميز', 'تشطيب'],  tagsEs: ['Exclusivo', 'Acabado'],
        ),
      _ => const _LocalizedProductCopy(
          nameFr: '',    nameAr: '',    nameEs: '',
          originFr: '',  originAr: '',  originEs: '',
          descFr: '',    descAr: '',    descEs: '',
          packFr: '',    packAr: '',    packEs: '',
          unitFr: '',    unitAr: '',    unitEs: '',
          tagsFr: [],    tagsAr: [],    tagsEs: [],
        ),
    };

// ── Delegate ──────────────────────────────────────────────────────────────────

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => AppLocalizations.supportedLocales
      .any((s) => s.languageCode == locale.languageCode);

  @override
  Future<AppLocalizations> load(Locale locale) =>
      SynchronousFuture(AppLocalizations(locale));

  @override
  bool shouldReload(covariant LocalizationsDelegate<AppLocalizations> old) =>
      false;
}

// ── Context extension ─────────────────────────────────────────────────────────

extension AppLocalizationsContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
