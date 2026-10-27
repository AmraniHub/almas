import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../data/catalog.dart';
import '../../models/cart_item.dart';
import '../../models/order_snapshot.dart';
import '../../models/product.dart';

class AppLocalizations {
  AppLocalizations(this.locale);

  final Locale locale;

  static const supportedLocales = [
    Locale('en'),
    Locale('fr'),
    Locale('ar'),
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

  bool get isFrench => languageCode == 'fr';
  bool get isArabic => languageCode == 'ar';
  bool get isEnglish => !isFrench && !isArabic;

  String get appTitle => 'Almas';
  String get appBrandName => _pick(
        english: 'Almas Spices & Herbs',
        french: 'Almas Épices & Herbes',
        arabic: 'معشبة ألماس',
      );

  String get homeTab => _pick(
        english: 'Home',
        french: 'Accueil',
        arabic: 'الرئيسية',
      );

  String get catalogTab => _pick(
        english: 'Catalog',
        french: 'Catalogue',
        arabic: 'الكتالوج',
      );

  String get cartTab => _pick(
        english: 'Cart',
        french: 'Panier',
        arabic: 'السلة',
      );

  String get opsTab => _pick(
        english: 'Ops',
        french: 'Opérations',
        arabic: 'العمليات',
      );

  String get profileTab => _pick(
        english: 'Shop & you',
        french: 'Boutique',
        arabic: 'المحل',
      );

  String get chatWithAlmas => _pick(
        english: 'Chat with Almas',
        french: 'Discuter avec Almas',
        arabic: 'الدردشة مع ألماس',
      );

  String get homeTitle => appBrandName;
  String get homeSubtitle => _pick(
        english:
            'Spices and herbs from our shop in Ksar Sghir, for homes, restaurants, hotels and wedding venues.',
        french:
            'Épices et herbes de notre boutique à Ksar Sghir, pour la maison, les restaurants, les hôtels et les salles de fêtes.',
        arabic: 'توابل وأعشاب من محلنا في القصر الصغير، للبيت والمطاعم والفنادق وقاعات الأفراح.',
      );

  String get featuredThisWeek => _pick(
        english: 'Most ordered',
        french: 'Les plus demandés',
        arabic: 'الأكثر طلبا',
      );

  String get forBusinessesTitle => _pick(
        english: 'Restaurants, hotels, wedding venues',
        french: 'Restaurants, hôtels, salles de fêtes',
        arabic: 'المطاعم والفنادق وقاعات الأفراح',
      );

  String get forBusinessesBody => _pick(
        english:
            'Order by the kilo with your business name and address. For large quantities, ask us for a price on WhatsApp.',
        french:
            'Commandez au kilo avec le nom et l\'adresse de votre établissement. Pour les grandes quantités, demandez-nous un prix sur WhatsApp.',
        arabic:
            'اطلب بالكيلو باسم مؤسستك وعنوانها. وللكميات الكبيرة، اطلب منا الثمن عبر واتساب.',
      );

  String get askPriceForLargeQuantities => _pick(
        english: 'Ask a price for large quantities',
        french: 'Demander un prix (grandes quantités)',
        arabic: 'اطلب ثمن الكميات الكبيرة',
      );

  String get largeQuantityWhatsAppMessage => _pick(
        english: 'Hello Almas, I run a business and would like a price for large quantities of: ',
        french: 'Bonjour Almas, je représente un établissement et je voudrais un prix pour de grandes quantités de : ',
        arabic: 'السلام عليكم ألماس، عندي مؤسسة وبغيت الثمن ديال كميات كبيرة من: ',
      );

  String get yourDetailsTitle => _pick(
        english: 'Your details',
        french: 'Vos coordonnées',
        arabic: 'معلوماتك',
      );

  String get yourDetailsSubtitle => _pick(
        english: 'Saved on this phone when you order, so the next order is faster. They only go to the shop inside your WhatsApp order.',
        french: 'Enregistrées sur ce téléphone quand vous commandez, pour aller plus vite la prochaine fois. Elles ne partent à la boutique que dans votre commande WhatsApp.',
        arabic: 'كتتسجل فهاد التليفون ملي كتطلب، باش الطلب الجاي يكون أسرع. وما كتوصل للمحل غير داخل الطلب ديالك فواتساب.',
      );

  String get noSavedDetails => _pick(
        english: 'Nothing saved yet. Your name, phone and address are kept here after your first order.',
        french: 'Rien d\'enregistré pour l\'instant. Votre nom, téléphone et adresse seront gardés ici après votre première commande.',
        arabic: 'ما كاين حتى معلومة. الاسم والتليفون والعنوان كيتسجلو هنا من بعد أول طلب.',
      );

  String get shopLocation => _pick(
        english: 'Ksar Sghir, near Tangier',
        french: 'Ksar Sghir, près de Tanger',
        arabic: 'القصر الصغير، قرب طنجة',
      );

  String get locationLabel => _pick(
        english: 'Location',
        french: 'Itinéraire',
        arabic: 'الموقع',
      );

  String pricePerUnit(Product product) => product.soldByKilo
      ? _pick(
          english: '${formatMad(product.price)} / kg',
          french: '${formatMad(product.price)} le kilo',
          arabic: '${formatMad(product.price)} للكيلو',
        )
      : _pick(
          english: '${formatMad(product.price)} each',
          french: '${formatMad(product.price)} la pièce',
          arabic: '${formatMad(product.price)} للحبة',
        );

  /// How much of a product a cart line holds: 750 g, 1.5 kg, or ×3.
  String amountLabel(Product product, int steps) {
    if (!product.soldByKilo) {
      return '×$steps';
    }
    final kilos = steps * product.step;
    if (kilos < 1) {
      return _pick(
        english: '${(kilos * 1000).round()} g',
        french: '${(kilos * 1000).round()} g',
        arabic: '${(kilos * 1000).round()} غ',
      );
    }
    final text = kilos == kilos.roundToDouble() ? kilos.toStringAsFixed(0) : kilos.toString();
    return _pick(english: '$text kg', french: '$text kg', arabic: '$text كلغ');
  }

  String get seeAllProducts => _pick(
        english: 'See all products',
        french: 'Voir tous les produits',
        arabic: 'عرض كل المنتجات',
      );

  String get activeOrderTapToTrack => _pick(
        english: 'Active order - tap to track',
        french: 'Commande active - appuyez pour suivre',
        arabic: 'طلب نشط - اضغط للتتبع',
      );

  String orderItemsAndTotal(int itemCount, double total) => _pick(
        english: '$itemCount items · ${formatMad(total)}',
        french: '$itemCount articles · ${formatMad(total)}',
        arabic: '$itemCount عناصر · ${formatMad(total)}',
      );

  String get quickActions => _pick(
        english: 'Quick actions',
        french: 'Actions rapides',
        arabic: 'إجراءات سريعة',
      );

  String get browseCatalog => _pick(
        english: 'Browse catalog',
        french: 'Parcourir le catalogue',
        arabic: 'تصفح الكتالوج',
      );

  String get viewCart => _pick(
        english: 'View cart',
        french: 'Voir le panier',
        arabic: 'عرض السلة',
      );

  String get productLibraryTitle => _pick(
        english: 'Our products',
        french: 'Nos produits',
        arabic: 'منتجاتنا',
      );

  String get productLibrarySubtitle => _pick(
        english:
            "The shop's products at the shop's prices. Spices and herbs are sold by the kilo, in steps of 250 g.",
        french:
            'Les produits de la boutique, aux prix de la boutique. Épices et herbes au kilo, par 250 g.',
        arabic:
            'منتجات المحل بثمن المحل. التوابل والأعشاب بالكيلو، و250 غرام في كل مرة.',
      );

  String get catalogSearchHint => _pick(
        english: 'Search cumin, ras el hanout, henna...',
        french: 'Rechercher cumin, ras el hanout, henné...',
        arabic: 'ابحث: الكمون، راس الحانوت، الحناء...',
      );

  String visibleProducts(int matchCount) => _pick(
        english: '$matchCount products',
        french: '$matchCount produits',
        arabic: '$matchCount منتج',
      );

  String get cashOnDeliveryDefault => _pick(
        english: 'Order on WhatsApp',
        french: 'Commande sur WhatsApp',
        arabic: 'الطلب عبر واتساب',
      );

  String get moroccoDeliveryZone => _pick(
        english: 'Shop in Ksar Sghir',
        french: 'Boutique à Ksar Sghir',
        arabic: 'المحل في القصر الصغير',
      );

  String get operationalMinimumOrderNote => _pick(
        english: 'Large quantities for businesses: ask us for a price on WhatsApp.',
        french: 'Grandes quantités pour les professionnels : demandez-nous un prix sur WhatsApp.',
        arabic: 'كميات كبيرة للمحترفين: اطلب منا الثمن عبر واتساب.',
      );

  String get noProductsMatchFilter => _pick(
        english: 'No products match this filter yet.',
        french: 'Aucun produit ne correspond encore a ce filtre.',
        arabic: 'لا توجد منتجات تطابق هذا الفلتر حاليا.',
      );

  String get orderDraftTitle => _pick(
        english: 'Your order',
        french: 'Votre commande',
        arabic: 'طلبك',
      );

  String get orderDraftSubtitle => _pick(
        english:
            'Your order goes to the shop on WhatsApp. We confirm the price, the delivery and the time with you.',
        french:
            "Votre commande part à la boutique sur WhatsApp. Nous confirmons avec vous le prix, la livraison et l'heure.",
        arabic:
            'طلبك كيوصل للمحل عبر واتساب، ونأكدو معاك الثمن والتوصيل والوقت.',
      );

  String get noOrderDraftYet => _pick(
        english: 'Your cart is empty',
        french: 'Votre panier est vide',
        arabic: 'السلة فارغة',
      );

  String get emptyCartSubtitle => _pick(
        english:
            'Add products from the catalogue, then send the order to the shop.',
        french:
            'Ajoutez des produits du catalogue, puis envoyez la commande à la boutique.',
        arabic:
            'زيد المنتجات من الكتالوج، ومن بعد صيفط الطلب للمحل.',
      );

  String get openCatalog => _pick(
        english: 'Open catalog',
        french: 'Ouvrir le catalogue',
        arabic: 'فتح الكتالوج',
      );

  String get madEach => _pick(
        english: 'MAD each',
        french: 'MAD l\'unite',
        arabic: 'درهم للوحدة',
      );

  String get checkoutSummary => _pick(
        english: 'Checkout summary',
        french: 'Resume de commande',
        arabic: 'ملخص الطلب',
      );

  String get checkoutSummarySubtitle => _pick(
        english:
            'You pay on delivery or at the shop. Delivery is agreed with you on WhatsApp.',
        french:
            'Vous payez à la livraison ou à la boutique. La livraison se convient avec vous sur WhatsApp.',
        arabic:
            'الخلاص عند الاستلام أو فالمحل. والتوصيل كنتافقو عليه معاك فواتساب.',
      );

  String get subtotalLabel => _pick(
        english: 'Subtotal',
        french: 'Sous-total',
        arabic: 'المجموع الفرعي',
      );

  String get deliveryLabel => _pick(
        english: 'Delivery',
        french: 'Livraison',
        arabic: 'التوصيل',
      );

  String get deliveryFeeLabel => _pick(
        english: 'Delivery fee',
        french: 'Frais de livraison',
        arabic: 'رسوم التوصيل',
      );

  String get includedLabel => _pick(
        english: 'Agreed on WhatsApp',
        french: 'À convenir sur WhatsApp',
        arabic: 'يُتفق عليه عبر واتساب',
      );

  String get totalDueOnDelivery => _pick(
        english: 'Products total',
        french: 'Total des produits',
        arabic: 'مجموع المنتجات',
      );

  String get minimumOrderProgress => _pick(
        english: 'Minimum order progress',
        french: 'Progression du minimum de commande',
        arabic: 'تقدم الحد الأدنى للطلب',
      );

  String get eligibleForConfirmation => _pick(
        english: 'Ready to send to the shop.',
        french: 'Prête à être envoyée à la boutique.',
        arabic: 'جاهز للإرسال إلى المحل.',
      );

  String addMoreToReachMinimum(double amount) => _pick(
        english: 'Add ${formatMad(amount)} more to reach the minimum order.',
        french: 'Ajoutez encore ${formatMad(amount)} pour atteindre la commande minimum.',
        arabic: 'أضف ${formatMad(amount)} أخرى للوصول إلى الحد الأدنى للطلب.',
      );

  String get orderConfirmationReady => _pick(
        english: 'Order confirmation is ready for backend integration.',
        french: 'La confirmation de commande est prete pour l\'integration backend.',
        arabic: 'تأكيد الطلب جاهز للربط مع الخلفية.',
      );

  String get placeCashOrder => _pick(
        english: 'Send the order to the shop',
        french: 'Envoyer la commande à la boutique',
        arabic: 'صيفط الطلب للمحل',
      );

  // ── Checkout / delivery details ────────────────────────────────────────
  String get checkoutDetailsTitle => _pick(
        english: 'Delivery details',
        french: 'Détails de livraison',
        arabic: 'تفاصيل التوصيل',
      );

  String get checkoutDetailsSubtitle => _pick(
        english:
            'Confirm where we deliver and who to contact. We send your order to Almas on WhatsApp for confirmation.',
        french:
            'Confirmez le lieu de livraison et le contact. Nous envoyons votre commande à Almas sur WhatsApp pour confirmation.',
        arabic:
            'أكد مكان التوصيل وجهة الاتصال. نرسل طلبك إلى ألماس عبر واتساب للتأكيد.',
      );

  String get businessNameLabel => _pick(
        english: 'Restaurant / hotel name',
        french: 'Nom du restaurant / hôtel',
        arabic: 'اسم المطعم / الفندق',
      );

  String get phoneFieldLabel => _pick(
        english: 'Phone number',
        french: 'Numéro de téléphone',
        arabic: 'رقم الهاتف',
      );

  String get deliveryAddressLabel => _pick(
        english: 'Delivery address',
        french: 'Adresse de livraison',
        arabic: 'عنوان التوصيل',
      );

  String get orderNotesLabel => _pick(
        english: 'Notes for Almas (optional)',
        french: 'Notes pour Almas (facultatif)',
        arabic: 'ملاحظات لألماس (اختياري)',
      );

  String get orderNotesHint => _pick(
        english: 'Delivery time, floor, contact person…',
        french: 'Heure de livraison, étage, personne à contacter…',
        arabic: 'وقت التوصيل، الطابق، الشخص المسؤول…',
      );

  String get requiredFieldError => _pick(
        english: 'Required',
        french: 'Obligatoire',
        arabic: 'مطلوب',
      );

  String get confirmOrderOnWhatsApp => _pick(
        english: 'Confirm order on WhatsApp',
        french: 'Confirmer sur WhatsApp',
        arabic: 'تأكيد الطلب عبر واتساب',
      );

  String get orderSentSuccess => _pick(
        english: 'Order sent! Almas will confirm on WhatsApp.',
        french: 'Commande envoyée ! Almas confirmera sur WhatsApp.',
        arabic: 'تم إرسال الطلب! سيؤكد ألماس عبر واتساب.',
      );

  String get orderSendFailed => _pick(
        english: 'Could not open WhatsApp. Please call us instead.',
        french: 'Impossible d\'ouvrir WhatsApp. Appelez-nous plutôt.',
        arabic: 'تعذر فتح واتساب. يرجى الاتصال بنا بدلاً من ذلك.',
      );

  /// Builds the full itemized order message sent to Almas on WhatsApp.
  String buildOrderMessage({
    required String businessName,
    required String phone,
    required String address,
    required String notes,
    required List<CartItem> items,
    required double subtotal,
    required double deliveryFee,
    required double total,
  }) {
    final buffer = StringBuffer();
    buffer.writeln(_pick(
      english: '🌿 *New Almas order*',
      french: '🌿 *Nouvelle commande Almas*',
      arabic: '🌿 *طلب جديد من ألماس*',
    ));
    buffer.writeln();
    buffer.writeln(
      '${_pick(english: '🏢 Business', french: '🏢 Établissement', arabic: '🏢 المنشأة')}: $businessName',
    );
    buffer.writeln(
      '${_pick(english: '📞 Phone', french: '📞 Téléphone', arabic: '📞 الهاتف')}: $phone',
    );
    buffer.writeln(
      '${_pick(english: '📍 Address', french: '📍 Adresse', arabic: '📍 العنوان')}: $address',
    );
    if (notes.trim().isNotEmpty) {
      buffer.writeln(
        '${_pick(english: '📝 Notes', french: '📝 Notes', arabic: '📝 ملاحظات')}: ${notes.trim()}',
      );
    }
    buffer.writeln();
    buffer.writeln(
      '${_pick(english: '🛒 Items', french: '🛒 Articles', arabic: '🛒 المنتجات')}:',
    );
    // The shop reads the till's Arabic names, so every line carries it, with the customer's name for it
    for (final item in items) {
      final name = isArabic ? item.product.arabicName : '${item.product.arabicName} (${productName(item.product)})';
      buffer.writeln(
        '• ${amountLabel(item.product, item.quantity)} $name — ${formatMad(item.lineTotal)}',
      );
    }
    buffer.writeln();
    buffer.writeln('$subtotalLabel: ${formatMad(subtotal)}');
    buffer.writeln(
      '${_pick(english: 'Delivery', french: 'Livraison', arabic: 'التوصيل')}: ${deliveryFee == 0 ? includedLabel : formatMad(deliveryFee)}',
    );
    buffer.writeln('*$totalDueOnDelivery: ${formatMad(total)}*');
    return buffer.toString();
  }

  String get orderTrackingTitle => _pick(
        english: 'Order tracking',
        french: 'Suivi de commande',
        arabic: 'تتبع الطلب',
      );

  String get orderTrackingSubtitle => _pick(
        english: 'Real-time status of your current order.',
        french: 'Statut en temps reel de votre commande en cours.',
        arabic: 'حالة طلبك الحالية في الوقت الفعلي.',
      );

  String orderChatTitle(String orderId) => _pick(
        english: 'Order $orderId',
        french: 'Commande $orderId',
        arabic: 'الطلب $orderId',
      );

  String get chatAboutOrderTooltip => _pick(
        english: 'Chat about this order',
        french: 'Discuter a propos de cette commande',
        arabic: 'الدردشة حول هذا الطلب',
      );

  String get orderSummaryTitle => _pick(
        english: 'Order summary',
        french: 'Resume de commande',
        arabic: 'ملخص الطلب',
      );

  String get orderIdLabel => _pick(
        english: 'Order ID',
        french: 'Numero de commande',
        arabic: 'رقم الطلب',
      );

  String get customerLabel => _pick(
        english: 'Customer',
        french: 'Client',
        arabic: 'العميل',
      );

  String get destinationLabel => _pick(
        english: 'Destination',
        french: 'Destination',
        arabic: 'الوجهة',
      );

  String get itemsLabel => _pick(
        english: 'Items',
        french: 'Articles',
        arabic: 'العناصر',
      );

  String productsCount(int count) => _pick(
        english: '$count products',
        french: '$count produits',
        arabic: '$count منتجات',
      );

  String get totalLabel => _pick(
        english: 'Total',
        french: 'Total',
        arabic: 'الإجمالي',
      );

  String get estimatedArrivalLabel => _pick(
        english: 'Estimated arrival',
        french: 'Arrivee estimee',
        arabic: 'وقت الوصول المتوقع',
      );

  String get paymentLabel => _pick(
        english: 'Payment',
        french: 'Paiement',
        arabic: 'الدفع',
      );

  String get cashOnDeliveryLabel => _pick(
        english: 'Cash on delivery',
        french: 'Paiement a la livraison',
        arabic: 'الدفع عند الاستلام',
      );

  String get needHelpWithOrder => _pick(
        english: 'Need help with this order?',
        french: 'Besoin d\'aide pour cette commande ?',
        arabic: 'هل تحتاج مساعدة بخصوص هذا الطلب؟',
      );

  String get callUs => _pick(
        english: 'Call us',
        french: 'Appelez-nous',
        arabic: 'اتصل بنا',
      );

  String get contactTitle => _pick(
        english: 'Contact Almas',
        french: 'Contacter Almas',
        arabic: 'التواصل مع ألماس',
      );

  String get callLabel => _pick(
        english: 'Call',
        french: 'Appel',
        arabic: 'اتصال',
      );

  String get whatsappLabel => 'WhatsApp';

  String get websiteLabel => _pick(
        english: 'Website',
        french: 'Site web',
        arabic: 'الموقع',
      );

  String get restaurantProfileTitle => _pick(
        english: 'Restaurant profile',
        french: 'Profil restaurant',
        arabic: 'ملف المطعم',
      );

  String get restaurantProfileSubtitle => _pick(
        english:
            'Identity, branches, favorites, and service preferences live in a cleaner operational profile.',
        french:
            'Identite, succursales, favoris et preferences de service sont reunis dans un profil plus clair.',
        arabic:
            'الهوية والفروع والمفضلات وتفضيلات الخدمة مجتمعة في ملف تشغيلي أوضح.',
      );

  String get profileAccountName => _pick(
        english: 'Dar Lalla Kitchen Group',
        french: 'Groupe Cuisine Dar Lalla',
        arabic: 'مجموعة مطابخ دار للا',
      );

  String get profileAccountSubtitle => _pick(
        english: 'Primary buyer account - Casablanca',
        french: 'Compte acheteur principal - Casablanca',
        arabic: 'حساب المشتري الرئيسي - الدار البيضاء',
      );

  List<String> get profileHeroPills => [
        _pick(english: '3 branches', french: '3 sites', arabic: '3 فروع'),
        _pick(
          english: 'WhatsApp updates',
          french: 'Mises a jour WhatsApp',
          arabic: 'تحديثات واتساب',
        ),
        _pick(
          english: 'Multi-language ready',
          french: 'Pret pour plusieurs langues',
          arabic: 'جاهز لعدة لغات',
        ),
      ];

  String get deliveryBranchesTitle => _pick(
        english: 'Delivery branches',
        french: 'Sites de livraison',
        arabic: 'فروع التوصيل',
      );

  String get favoriteBundlesTitle => _pick(
        english: 'Favorite bundles',
        french: 'Lots favoris',
        arabic: 'الباقات المفضلة',
      );

  String get preferencesTitle => _pick(
        english: 'Preferences',
        french: 'Preferences',
        arabic: 'التفضيلات',
      );

  String get recentInvoicesTitle => _pick(
        english: 'Recent invoices',
        french: 'Factures recentes',
        arabic: 'الفواتير الأخيرة',
      );

  List<LocalizedInfoItem> get profileBranches => switch (languageCode) {
        'fr' => const [
            LocalizedInfoItem(
              title: 'Agence Anfa Business',
              subtitle: 'Cuisine principale de reception - 08:00 a 18:00',
            ),
            LocalizedInfoItem(
              title: 'Laboratoire Traiteur Maarif',
              subtitle: 'Preparation grand volume - palettes acceptees le mardi',
            ),
            LocalizedInfoItem(
              title: 'Unite Evenementielle Ain Diab',
              subtitle: 'Pics saisonniers - voie de recomande rapide activee',
            ),
          ],
        'ar' => const [
            LocalizedInfoItem(
              title: 'فرع أنفا للأعمال',
              subtitle: 'مطبخ الاستلام الرئيسي - من 08:00 إلى 18:00',
            ),
            LocalizedInfoItem(
              title: 'مختبر التموين المعاريف',
              subtitle: 'تحضير بكميات كبيرة - استقبال الطبليات يوم الثلاثاء',
            ),
            LocalizedInfoItem(
              title: 'وحدة عين الذياب للفعاليات',
              subtitle: 'ذروة موسمية - تم تفعيل مسار إعادة الطلب السريع',
            ),
          ],
        _ => const [
            LocalizedInfoItem(
              title: 'Anfa Business Branch',
              subtitle: 'Primary receiving kitchen - 08:00 to 18:00',
            ),
            LocalizedInfoItem(
              title: 'Maarif Catering Lab',
              subtitle: 'Large-batch prep - accepts pallets on Tuesdays',
            ),
            LocalizedInfoItem(
              title: 'Ain Diab Events Unit',
              subtitle: 'Seasonal demand spikes - fast reorder lane enabled',
            ),
          ],
      };

  List<LocalizedInfoItem> get favoriteBundles => switch (languageCode) {
        'fr' => const [
            LocalizedInfoItem(
              title: 'Kit Essentiels Tagine',
              subtitle:
                  'Ras el Hanout, curcuma, paprika, sel au citron confit',
            ),
            LocalizedInfoItem(
              title: 'Set Service de The',
              subtitle:
                  'Menthe sechee, safran, cannelle et notes de fleur d\'oranger',
            ),
            LocalizedInfoItem(
              title: 'Lot Ligne Grill',
              subtitle:
                  'Paprika fume, cumin, base harissa et sel de finition',
            ),
          ],
        'ar' => const [
            LocalizedInfoItem(
              title: 'باقة أساسيات الطاجين',
              subtitle:
                  'رأس الحانوت والكركم والبابريكا وملح الليمون المصبر',
            ),
            LocalizedInfoItem(
              title: 'مجموعة خدمة الشاي',
              subtitle:
                  'نعناع مجفف وزعفران وقرفة ولمسات من زهر البرتقال',
            ),
            LocalizedInfoItem(
              title: 'باقة خط الشواء',
              subtitle:
                  'بابريكا مدخنة وكمون وخلطة هريسة وملح للتشطيب',
            ),
          ],
        _ => const [
            LocalizedInfoItem(
              title: 'Tagine Essentials Kit',
              subtitle:
                  'Ras el Hanout, turmeric, paprika, preserved lemon salt',
            ),
            LocalizedInfoItem(
              title: 'Tea Service Set',
              subtitle:
                  'Dried spearmint, saffron, cinnamon, orange blossom notes',
            ),
            LocalizedInfoItem(
              title: 'Grill Line Bundle',
              subtitle:
                  'Smoked paprika, cumin, harissa base, finishing salt',
            ),
          ],
      };

  List<LocalizedKeyValue> get profilePreferences => [
        LocalizedKeyValue(
          label: _pick(
            english: 'Application language',
            french: 'Langue de l\'application',
            arabic: 'لغة التطبيق',
          ),
          value: _pick(
            english: 'Follows your phone language automatically',
            french: 'Suit automatiquement la langue du telephone',
            arabic: 'تتبع لغة الهاتف تلقائيا',
          ),
        ),
        LocalizedKeyValue(
          label: _pick(
            english: 'Payment flow',
            french: 'Mode de paiement',
            arabic: 'طريقة الدفع',
          ),
          value: cashOnDeliveryLabel,
        ),
        LocalizedKeyValue(
          label: _pick(
            english: 'Notifications',
            french: 'Notifications',
            arabic: 'الإشعارات',
          ),
          value: _pick(
            english: 'WhatsApp + order confirmations',
            french: 'WhatsApp + confirmations de commande',
            arabic: 'واتساب + تأكيدات الطلب',
          ),
        ),
        LocalizedKeyValue(
          label: _pick(
            english: 'Reorder behavior',
            french: 'Comportement de recomande',
            arabic: 'سلوك إعادة الطلب',
          ),
          value: _pick(
            english: 'Restore last high-volume basket',
            french: 'Restaurer le dernier panier grand volume',
            arabic: 'استعادة آخر سلة كبيرة الحجم',
          ),
        ),
      ];

  List<LocalizedInvoiceItem> get recentInvoices => [
        LocalizedInvoiceItem(
          id: 'INV-2405-18',
          amount: '864 MAD',
          status: deliveredStatus,
        ),
        LocalizedInvoiceItem(
          id: 'INV-2405-14',
          amount: '1,120 MAD',
          status: paidStatus,
        ),
        LocalizedInvoiceItem(
          id: 'INV-2405-11',
          amount: '620 MAD',
          status: paidStatus,
        ),
      ];

  String get deliveredStatus => _pick(
        english: 'Delivered',
        french: 'Livree',
        arabic: 'تم التسليم',
      );

  String get paidStatus => _pick(
        english: 'Paid',
        french: 'Payee',
        arabic: 'مدفوعة',
      );

  String get ownerConsoleTitle => _pick(
        english: 'Owner console',
        french: 'Console dirigeant',
        arabic: 'لوحة المالك',
      );

  String get ownerConsoleSubtitle => _pick(
        english:
            'A focused operations layer for orders, delivery cash, and stock pressure without burying key signals.',
        french:
            'Une couche operationnelle ciblee pour les commandes, l\'encaissement a la livraison et la pression stock sans cacher les signaux essentiels.',
        arabic:
            'طبقة تشغيلية مركزة للطلبات ونقد التوصيل وضغط المخزون دون إخفاء الإشارات المهمة.',
      );

  String get adminHeroTitle => _pick(
        english: 'Control tower for the day\'s spice flow',
        french: 'Tour de controle du flux d\'epices du jour',
        arabic: 'برج تحكم لتدفق التوابل خلال اليوم',
      );

  String get adminHeroSubtitle => _pick(
        english:
            'Incoming COD orders, low-stock risk, and driver cash collection stay in a single visual rhythm.',
        french:
            'Les commandes COD, le risque de rupture et la collecte des chauffeurs restent dans un meme rythme visuel.',
        arabic:
            'طلبات الدفع عند الاستلام ومخاطر نقص المخزون وتحصيل السائقين تظهر في إيقاع بصري واحد.',
      );

  List<String> get adminHeroPills => [
        _pick(
          english: '2 urgent confirmations',
          french: '2 confirmations urgentes',
          arabic: 'تأكيدان عاجلان',
        ),
        _pick(
          english: '96% on-time',
          french: '96 % a l\'heure',
          arabic: '96% في الوقت',
        ),
        _pick(
          english: 'Mint low by tonight',
          french: 'Menthe faible ce soir',
          arabic: 'النعناع منخفض قبل المساء',
        ),
      ];

  List<LocalizedMetricItem> get adminMetrics => [
        LocalizedMetricItem(
          label: _pick(
            english: 'New orders this morning',
            french: 'Nouvelles commandes ce matin',
            arabic: 'طلبات جديدة هذا الصباح',
          ),
          value: '12',
        ),
        LocalizedMetricItem(
          label: _pick(
            english: 'Cash collected today',
            french: 'Encaisse aujourd\'hui',
            arabic: 'المبالغ المحصلة اليوم',
          ),
          value: '13.4k',
        ),
        LocalizedMetricItem(
          label: _pick(
            english: 'Active delivery routes',
            french: 'Tournees actives',
            arabic: 'مسارات التوصيل النشطة',
          ),
          value: '4',
        ),
        LocalizedMetricItem(
          label: _pick(
            english: 'Low stock watchlist',
            french: 'Produits en alerte stock',
            arabic: 'قائمة مراقبة نقص المخزون',
          ),
          value: '3',
        ),
      ];

  String get incomingOrdersTitle => _pick(
        english: 'Incoming orders',
        french: 'Commandes entrantes',
        arabic: 'الطلبات الواردة',
      );

  List<LocalizedOrderLine> get incomingOrders => switch (languageCode) {
        'fr' => const [
            LocalizedOrderLine(
              customer: 'La Table Verte',
              amount: '860 MAD',
              status: 'Besoin de confirmation',
            ),
            LocalizedOrderLine(
              customer: 'Mina Seafood Bar',
              amount: '1,240 MAD',
              status: 'Assigner un chauffeur',
            ),
            LocalizedOrderLine(
              customer: 'Dar Bahia Events',
              amount: '620 MAD',
              status: 'Preparee',
            ),
            LocalizedOrderLine(
              customer: 'Atelier Couscous',
              amount: '410 MAD',
              status: 'En attente du minimum',
            ),
          ],
        'ar' => const [
            LocalizedOrderLine(
              customer: 'لا تابل فيرت',
              amount: '860 MAD',
              status: 'بحاجة إلى تأكيد',
            ),
            LocalizedOrderLine(
              customer: 'مينا سي فود بار',
              amount: '1,240 MAD',
              status: 'تعيين سائق',
            ),
            LocalizedOrderLine(
              customer: 'دار بهاية للفعاليات',
              amount: '620 MAD',
              status: 'تم التجهيز',
            ),
            LocalizedOrderLine(
              customer: 'أتيليه كسكس',
              amount: '410 MAD',
              status: 'بانتظار استكمال الحد الأدنى',
            ),
          ],
        _ => const [
            LocalizedOrderLine(
              customer: 'La Table Verte',
              amount: '860 MAD',
              status: 'Needs confirmation',
            ),
            LocalizedOrderLine(
              customer: 'Mina Seafood Bar',
              amount: '1,240 MAD',
              status: 'Assign driver',
            ),
            LocalizedOrderLine(
              customer: 'Dar Bahia Events',
              amount: '620 MAD',
              status: 'Packed',
            ),
            LocalizedOrderLine(
              customer: 'Atelier Couscous',
              amount: '410 MAD',
              status: 'Waiting on minimum uplift',
            ),
          ],
      };

  String get lowStockWatchTitle => _pick(
        english: 'Low stock watch',
        french: 'Surveillance faible stock',
        arabic: 'مراقبة المخزون المنخفض',
      );

  List<String> get lowStockLabels => [
        productNameById('dried_mint'),
        productNameById('smoked_paprika'),
        productNameById('saffron_threads'),
      ];

  String get driverRoutesTitle => _pick(
        english: 'Driver routes',
        french: 'Tournees chauffeurs',
        arabic: 'مسارات السائقين',
      );

  List<LocalizedKeyValue> get driverRoutes => switch (languageCode) {
        'fr' => const [
            LocalizedKeyValue(label: 'Yassine', value: 'Boucle Anfa - 1,800 MAD'),
            LocalizedKeyValue(label: 'Salma', value: 'Rabat Nord - 940 MAD'),
            LocalizedKeyValue(label: 'Omar', value: 'Mohammedia - 620 MAD'),
          ],
        'ar' => const [
            LocalizedKeyValue(label: 'ياسين', value: 'جولة أنفا - 1,800 MAD'),
            LocalizedKeyValue(label: 'سلمى', value: 'الرباط الشمالية - 940 MAD'),
            LocalizedKeyValue(label: 'عمر', value: 'المحمدية - 620 MAD'),
          ],
        _ => const [
            LocalizedKeyValue(label: 'Yassine', value: 'Anfa loop - 1,800 MAD'),
            LocalizedKeyValue(label: 'Salma', value: 'Rabat North - 940 MAD'),
            LocalizedKeyValue(label: 'Omar', value: 'Mohammedia - 620 MAD'),
          ],
      };

  String get chatGreeting => _pick(
        english: 'Hello! How can I help you today? 🌿',
        french: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ? 🌿',
        arabic: 'مرحبا! كيف يمكنني مساعدتك اليوم؟ 🌿',
      );

  String get callAlmasTooltip => _pick(
        english: 'Call Almas',
        french: 'Appeler Almas',
        arabic: 'الاتصال بألماس',
      );

  String get openWhatsAppTooltip => _pick(
        english: 'Open WhatsApp',
        french: 'Ouvrir WhatsApp',
        arabic: 'فتح واتساب',
      );

  String get chatInputHint => _pick(
        english: 'Write a message...',
        french: 'Ecrire un message...',
        arabic: 'اكتب رسالة...',
      );

  String get aboutThisProduct => _pick(
        english: 'About this product',
        french: 'A propos de ce produit',
        arabic: 'حول هذا المنتج',
      );

  String get heatLevel => _pick(
        english: 'Heat level',
        french: 'Niveau de piquant',
        arabic: 'مستوى الحدة',
      );

  String perUnit(String unitLabel) => _pick(
        english: 'per $unitLabel',
        french: 'par $unitLabel',
        arabic: 'لكل $unitLabel',
      );

  String get addToOrder => _pick(
        english: 'Add to order',
        french: 'Ajouter a la commande',
        arabic: 'أضف إلى الطلب',
      );

  String get askOnWhatsApp => _pick(
        english: 'Ask on WhatsApp',
        french: 'Demander sur WhatsApp',
        arabic: 'اسأل عبر واتساب',
      );

  String get addLabel => _pick(
        english: 'Add',
        french: 'Ajouter',
        arabic: 'إضافة',
      );

  String get outOfStock => _pick(
        english: 'Out of stock',
        french: 'Rupture de stock',
        arabic: 'غير متوفر',
      );

  String get generalWhatsAppMessage => _pick(
        english: 'Hello Almas 👋 I would like to place an order.',
        french: 'Bonjour Almas 👋 Je souhaite passer une commande.',
        arabic: 'مرحبا ألماس 👋 أود تقديم طلب.',
      );

  String orderInquiryMessage(String orderId) => _pick(
        english: 'Hello Almas, I would like more information about order $orderId.',
        french: 'Bonjour Almas, je voudrais des informations sur ma commande $orderId.',
        arabic: 'مرحبا ألماس، أود الحصول على معلومات حول طلبي $orderId.',
      );

  String productInquiryMessage(Product product) {
    final localizedName = productName(product);
    final secondaryName = productSecondaryName(product);

    return _pick(
      english:
          'Hello Almas, I would like information about $localizedName${secondaryName.isNotEmpty ? ' ($secondaryName)' : ''}.',
      french:
          'Bonjour Almas, je voudrais des informations sur $localizedName${secondaryName.isNotEmpty ? ' ($secondaryName)' : ''}.',
      arabic:
          'مرحبا ألماس، أود الاستفسار عن $localizedName${secondaryName.isNotEmpty ? ' ($secondaryName)' : ''}.',
    );
  }

  String statusMessage(OrderStage stage) => switch (stage) {
        OrderStage.placed => _pick(
            english:
                'Your order has been placed and is waiting for confirmation from Almas.',
            french:
                'Votre commande a ete enregistree et attend la confirmation d\'Almas.',
            arabic: 'تم تسجيل طلبك وهو الآن بانتظار تأكيد ألماس.',
          ),
        OrderStage.confirmed => _pick(
            english:
                'Order confirmed! Your products are being prepared for dispatch.',
            french:
                'Commande confirmee ! Vos produits sont en preparation pour l\'expedition.',
            arabic: 'تم تأكيد الطلب! يجري الآن تجهيز منتجاتك للإرسال.',
          ),
        OrderStage.outForDelivery => _pick(
            english:
                'Your order is on the way! The driver will arrive soon.',
            french:
                'Votre commande est en route ! Le chauffeur arrive bientot.',
            arabic: 'طلبك في الطريق! سيصل السائق قريباً.',
          ),
        OrderStage.delivered => _pick(
            english:
                'Delivered successfully. Thank you for ordering from Almas!',
            french:
                'Livree avec succes. Merci d\'avoir commande chez Almas !',
            arabic: 'تم التسليم بنجاح. شكرا لطلبك من ألماس!',
          ),
      };

  String orderStageLabel(OrderStage stage) => switch (stage) {
        OrderStage.placed => _pick(
            english: 'Placed',
            french: 'Creee',
            arabic: 'تم الطلب',
          ),
        OrderStage.confirmed => _pick(
            english: 'Confirmed',
            french: 'Confirmee',
            arabic: 'مؤكد',
          ),
        OrderStage.outForDelivery => _pick(
            english: 'Delivery',
            french: 'Livraison',
            arabic: 'التوصيل',
          ),
        OrderStage.delivered => _pick(
            english: 'Delivered',
            french: 'Livree',
            arabic: 'تم التسليم',
          ),
      };

  /// 'All', or one of the shop's shelves from the catalogue file, in the user's language.
  String categoryLabel(String category) {
    if (category == 'All') {
      return _pick(english: 'All', french: 'Tous', arabic: 'الكل');
    }
    final c = Catalog.category(category);
    if (c == null) {
      return category;
    }
    return _pick(english: c.english, french: c.french, arabic: c.arabic);
  }

  /// The name in the user's language: the till's Arabic name, or its French / English name.
  String productName(Product product) => _pick(
        english: product.name,
        french: product.frenchName ?? product.name,
        arabic: product.arabicName,
      );

  /// The other name under it (the Arabic one, or the French one in Arabic), empty when it says the same.
  String productSecondaryName(Product product) {
    final other = isArabic ? product.frenchName ?? product.name : product.arabicName;
    return other == productName(product) ? '' : other;
  }

  String productCategory(Product product) => categoryLabel(product.category);

  String productOrigin(Product product) => '';

  String productDescription(Product product) => '';

  /// Under the price: "per kg" or "per piece".
  String productPackSize(Product product) => product.soldByKilo
      ? _pick(english: 'per kg', french: 'le kilo', arabic: 'للكيلو')
      : _pick(english: 'per piece', french: 'la pièce', arabic: 'للحبة');

  String productUnitLabel(Product product) => productPackSize(product);

  List<String> productTags(Product product) => const [];

  Iterable<String> productSearchTerms(Product product) sync* {
    yield product.name;
    yield product.arabicName;
    if (product.frenchName != null) yield product.frenchName!;
    yield productCategory(product);
  }

  String orderCustomerName(OrderSnapshot order) => switch (order.id) {
        'ALM-2405' => _pick(
            english: 'Dar Lalla Kitchen',
            french: 'Cuisine Dar Lalla',
            arabic: 'مطابخ دار للا',
          ),
        _ => order.customerName,
      };

  String orderDestination(OrderSnapshot order) => switch (order.id) {
        'ALM-2405' => _pick(
            english: 'Anfa Business Branch',
            french: 'Agence Anfa Business',
            arabic: 'فرع أنفا للأعمال',
          ),
        _ => order.destination,
      };

  String orderEta(OrderSnapshot order) => switch (order.id) {
        'ALM-2405' => _pick(
            english: 'Today, 16:40',
            french: 'Aujourd\'hui, 16:40',
            arabic: 'اليوم، 16:40',
          ),
        _ => order.eta,
      };

  /// 90 MAD, 22.50 MAD (a quarter kilo can land on half a dirham), 90 درهم in Arabic.
  String formatMad(num amount) {
    final text = amount == amount.roundToDouble() ? amount.toStringAsFixed(0) : amount.toStringAsFixed(2);
    return isArabic ? '$text درهم' : '$text MAD';
  }

  String productNameById(String productId) =>
      _productCopy(productId).nameFor(languageCode, fallback: productId);

  String _pick({
    required String english,
    required String french,
    required String arabic,
  }) {
    return switch (languageCode) {
      'fr' => french,
      'ar' => arabic,
      _ => english,
    };
  }
}

class LocalizedInfoItem {
  const LocalizedInfoItem({
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;
}

class LocalizedMetricItem {
  const LocalizedMetricItem({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;
}

class LocalizedKeyValue {
  const LocalizedKeyValue({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;
}

class LocalizedOrderLine {
  const LocalizedOrderLine({
    required this.customer,
    required this.amount,
    required this.status,
  });

  final String customer;
  final String amount;
  final String status;
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

class _LocalizedProductCopy {
  const _LocalizedProductCopy({
    required this.nameFr,
    required this.nameAr,
    required this.originFr,
    required this.originAr,
    required this.descriptionFr,
    required this.descriptionAr,
    required this.packSizeFr,
    required this.packSizeAr,
    required this.unitLabelFr,
    required this.unitLabelAr,
    required this.tagsFr,
    required this.tagsAr,
  });

  final String nameFr;
  final String nameAr;
  final String originFr;
  final String originAr;
  final String descriptionFr;
  final String descriptionAr;
  final String packSizeFr;
  final String packSizeAr;
  final String unitLabelFr;
  final String unitLabelAr;
  final List<String> tagsFr;
  final List<String> tagsAr;

  String nameFor(String languageCode, {required String fallback}) => switch (languageCode) {
        'fr' => nameFr,
        'ar' => nameAr,
        _ => fallback,
      };

  String originFor(String languageCode, {required String fallback}) =>
      switch (languageCode) {
        'fr' => originFr,
        'ar' => originAr,
        _ => fallback,
      };

  String descriptionFor(String languageCode, {required String fallback}) =>
      switch (languageCode) {
        'fr' => descriptionFr,
        'ar' => descriptionAr,
        _ => fallback,
      };

  String packSizeFor(String languageCode, {required String fallback}) =>
      switch (languageCode) {
        'fr' => packSizeFr,
        'ar' => packSizeAr,
        _ => fallback,
      };

  String unitLabelFor(String languageCode, {required String fallback}) =>
      switch (languageCode) {
        'fr' => unitLabelFr,
        'ar' => unitLabelAr,
        _ => fallback,
      };

  List<String> tagsFor(String languageCode, {required List<String> fallback}) =>
      switch (languageCode) {
        'fr' => tagsFr,
        'ar' => tagsAr,
        _ => fallback,
      };
}

_LocalizedProductCopy _productCopy(String productId) => switch (productId) {
      'saffron_threads' => const _LocalizedProductCopy(
          nameFr: 'Filaments de Safran Royal',
          nameAr: 'زعفران ملكي',
          originFr: 'Taliouine, Maroc',
          originAr: 'تالوين، المغرب',
          descriptionFr:
              'Arome floral profond avec une finale miel propre, ideal pour riz signature, fruits de mer et patisserie fine.',
          descriptionAr:
              'عبير زهري عميق مع لمسة عسلية نقية، مثالي لأطباق الأرز البحرية والحلويات الراقية.',
          packSizeFr: 'Boite metal 10 g',
          packSizeAr: 'علبة 10 غ',
          unitLabelFr: 'boite',
          unitLabelAr: 'علبة',
          tagsFr: ['Premium', 'Rotation rapide'],
          tagsAr: ['فاخر', 'سريع الحركة'],
        ),
      'ras_el_hanout' => const _LocalizedProductCopy(
          nameFr: 'Ras el Hanout Atlas',
          nameAr: 'رأس الحانوت الأطلسي',
          originFr: 'Marrakech, Maroc',
          originAr: 'مراكش، المغرب',
          descriptionFr:
              'Melange maison complexe pour tajines et viandes roties avec douceur chaude, zeste d\'agrumes et poivre subtil.',
          descriptionAr:
              'خلطة منزلية متعددة الطبقات للطواجن واللحوم المشوية مع حلاوة دافئة وقشر حمضيات وفلفل خفيف.',
          packSizeFr: 'Sachet 500 g',
          packSizeAr: 'كيس 500 غ',
          unitLabelFr: 'sachet',
          unitLabelAr: 'كيس',
          tagsFr: ['Choix chef', 'Pret pour lots'],
          tagsAr: ['اختيار الشيف', 'جاهز للباقات'],
        ),
      'smoked_paprika' => const _LocalizedProductCopy(
          nameFr: 'Paprika Fume',
          nameAr: 'بابريكا مدخنة',
          originFr: 'Ligne chef',
          originAr: 'خط الشيف',
          descriptionFr:
              'Couleur rouge dense et fumee douce pour grills, sauces et melanges maison.',
          descriptionAr:
              'لون أحمر كثيف ودخان حلو للشوايات والصلصات وخلطات التتبيل المنزلية.',
          packSizeFr: 'Sac 1 kg',
          packSizeAr: 'كيس 1 كلغ',
          unitLabelFr: 'sac',
          unitLabelAr: 'كيس',
          tagsFr: ['Boost couleur', 'BBQ'],
          tagsAr: ['تعزيز اللون', 'شواء'],
        ),
      'black_cumin' => const _LocalizedProductCopy(
          nameFr: 'Graines de Cumin Noir',
          nameAr: 'حبة البركة',
          originFr: 'Reseau fournisseurs Fes',
          originAr: 'شبكة موردي فاس',
          descriptionFr:
              'Graines terreuses et poivrees pour pains, sauces laitieres et huiles de finition.',
          descriptionAr:
              'حبوب ترابية وفلفلية للخبز والصلصات اللبنية وزيوت اللمسة الأخيرة.',
          packSizeFr: 'Pot 750 g',
          packSizeAr: 'مرطبان 750 غ',
          unitLabelFr: 'pot',
          unitLabelAr: 'مرطبان',
          tagsFr: ['Boulangerie', 'Base pantry'],
          tagsAr: ['مخبز', 'أساس المخزن'],
        ),
      'dried_mint' => const _LocalizedProductCopy(
          nameFr: 'Menthe Verte Sechee',
          nameAr: 'نعناع مجفف',
          originFr: 'Fermes de Meknes',
          originAr: 'مزارع مكناس',
          descriptionFr:
              'Fraicheur vegetale pour service the, marinades et sauces au yaourt.',
          descriptionAr:
              'انتعاش عشبي لخدمة الشاي والتتبيلات والصلصات المبنية على الزبادي.',
          packSizeFr: 'Sachet 400 g',
          packSizeAr: 'كيس 400 غ',
          unitLabelFr: 'sachet',
          unitLabelAr: 'كيس',
          tagsFr: ['The', 'Finale fraiche'],
          tagsAr: ['شاي', 'لمسة منعشة'],
        ),
      'turmeric_gold' => const _LocalizedProductCopy(
          nameFr: 'Curcuma Gold',
          nameAr: 'كركم ذهبي',
          originFr: 'Qualite premium importee',
          originAr: 'درجة ممتازة مستوردة',
          descriptionFr:
              'Curcuma riche en curcumine avec couleur doree intense pour soupes, sauces et menus bien-etre.',
          descriptionAr:
              'كركم غني بالكركمين ولون ذهبي قوي للشوربات والصلصات وقوائم العافية.',
          packSizeFr: 'Sac 1 kg',
          packSizeAr: 'كيس 1 كلغ',
          unitLabelFr: 'sac',
          unitLabelAr: 'كيس',
          tagsFr: ['Couleur intense', 'Populaire'],
          tagsAr: ['لون قوي', 'شائع'],
        ),
      'harissa_base' => const _LocalizedProductCopy(
          nameFr: 'Base Harissa',
          nameAr: 'خلطة هريسة أساسية',
          originFr: 'Ligne chef',
          originAr: 'خط الشيف',
          descriptionFr:
              'Base equilibree piment, ail et carvi pour une harissa reguliere en quelques minutes.',
          descriptionAr:
              'قاعدة متوازنة من الفلفل والثوم والكروية تمنح المطابخ نكهة هريسة ثابتة خلال دقائق.',
          packSizeFr: 'Sachet 650 g',
          packSizeAr: 'كيس 650 غ',
          unitLabelFr: 'sachet',
          unitLabelAr: 'كيس',
          tagsFr: ['Piquant', 'Gain de temps'],
          tagsAr: ['حار', 'توفير الوقت'],
        ),
      'preserved_lemon_salt' => const _LocalizedProductCopy(
          nameFr: 'Sel au Citron Confit',
          nameAr: 'ملح الليمون المصبر',
          originFr: 'Atelier finition Tanger',
          originAr: 'غرفة التشطيب بطنجة',
          descriptionFr:
              'Sel d\'agrumes saumure pour poisson, frites, salades et dressage final.',
          descriptionAr:
              'ملح حمضي مملح للأسماك والبطاطس المقلية ومحطات السلطات واللمسة النهائية.',
          packSizeFr: 'Pot 300 g',
          packSizeAr: 'مرطبان 300 غ',
          unitLabelFr: 'pot',
          unitLabelAr: 'مرطبان',
          tagsFr: ['Signature', 'Finition'],
          tagsAr: ['مميز', 'تشطيب'],
        ),
      _ => const _LocalizedProductCopy(
          nameFr: '',
          nameAr: '',
          originFr: '',
          originAr: '',
          descriptionFr: '',
          descriptionAr: '',
          packSizeFr: '',
          packSizeAr: '',
          unitLabelFr: '',
          unitLabelAr: '',
          tagsFr: [],
          tagsAr: [],
        ),
    };

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) =>
      AppLocalizations.supportedLocales.any(
        (supportedLocale) =>
            supportedLocale.languageCode == locale.languageCode,
      );

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(AppLocalizations(locale));
  }

  @override
  bool shouldReload(covariant LocalizationsDelegate<AppLocalizations> old) =>
      false;
}

extension AppLocalizationsContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
