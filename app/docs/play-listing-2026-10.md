# Almas — Google Play listing (October 2026)

Drafted from what the app really does in version 1.2.0: the shop's own catalogue and prices, orders sent to the shop on WhatsApp, no account, payment on delivery or at the shop. Nothing here promises card payment, delivery zones or prices the app does not have.

Status: **draft, not saved in Play Console and not sent for review.** It goes to review only after the owner has checked the app on his phone.

## Store settings
- Category: Shopping (unchanged)
- Contact email: amranialabs@gmail.com (unchanged)
- Contact phone: +212 619 434 035 (to confirm: is this the shop's number?)
- Website: none (almas.ma is not ours and is removed from the app)

## English (default)
**Title (30):** Almas Spices & Herbs

**Short description (80):** Spices & herbs by the kilo for homes, restaurants, hotels and wedding venues.

**Full description:**

Almas Spices & Herbs (معشبة ألماس) is a spice and herb shop in Ksar Sghir, near Tangier. The app puts the shop's catalogue and prices on your phone and sends your order straight to the shop on WhatsApp.

For your home
Paprika, turmeric, cumin, ginger, black pepper, ras el hanout, herbs for tea, henna, ghassoul, rose water, orange blossom water and more, at the shop's prices.

For restaurants, hotels, caterers and wedding venues
Order by the kilo under your business name and address. For large quantities, ask the shop for a price on WhatsApp in one tap.

What you can do
• Browse more than 120 products by shelf: spices, blends, herbs, seeds and dried fruit, pastry, pantry, henna and beauty, incense and musk
• See each price per kilo or per piece
• Add products in steps of 250 g
• Send your order to the shop on WhatsApp, with your name, phone and address
• Call the shop, or open its location for directions
• Use the app in Arabic, French or English

No account and no password. You pay on delivery or at the shop; delivery is agreed with you on WhatsApp.

## Français
**Titre :** Almas Épices & Herbes

**Description courte :** Épices et herbes au kilo pour la maison, restaurants, hôtels et salles de fêtes.

**Description complète :**

Almas Épices & Herbes (معشبة ألماس) est une boutique d'épices et d'herbes à Ksar Sghir, près de Tanger. L'application met le catalogue et les prix de la boutique sur votre téléphone et envoie votre commande directement à la boutique sur WhatsApp.

Pour la maison
Paprika, curcuma, cumin, gingembre, poivre noir, ras el hanout, herbes à infusion, henné, ghassoul, eau de rose, eau de fleur d'oranger et plus encore, aux prix de la boutique.

Pour les restaurants, hôtels, traiteurs et salles de fêtes
Commandez au kilo au nom et à l'adresse de votre établissement. Pour les grandes quantités, demandez un prix à la boutique sur WhatsApp en un geste.

Ce que vous pouvez faire
• Parcourir plus de 120 produits par rayon : épices, mélanges, herbes, graines et fruits secs, pâtisserie, épicerie, henné et beauté, encens et musc
• Voir chaque prix au kilo ou à la pièce
• Ajouter les produits par 250 g
• Envoyer votre commande à la boutique sur WhatsApp, avec votre nom, téléphone et adresse
• Appeler la boutique ou ouvrir son itinéraire
• Utiliser l'application en arabe, français ou anglais

Sans compte ni mot de passe. Vous payez à la livraison ou à la boutique ; la livraison se convient avec vous sur WhatsApp.

## العربية
**الاسم:** معشبة ألماس – توابل وأعشاب

**الوصف القصير:** توابل وأعشاب بالكيلو للبيت والمطاعم والفنادق وقاعات الأفراح.

**الوصف الكامل:**

معشبة ألماس محل للتوابل والأعشاب في القصر الصغير، قرب طنجة. التطبيق كيحط منتجات المحل وأثمنتو فتليفونك، وكيصيفط الطلب ديالك مباشرة للمحل عبر واتساب.

للبيت
الفلفلة الحلوة، الخرقوم، الكمون، السكنجبير، الإبزار، راس الحانوت، أعشاب الأتاي، الحناء، الغاسول، ماء الورد، ماء الزهر وبزاف ديال المنتجات، بثمن المحل.

للمطاعم والفنادق والممونين وقاعات الأفراح
اطلب بالكيلو باسم مؤسستك وعنوانها. وللكميات الكبيرة، اطلب الثمن من المحل عبر واتساب بضغطة وحدة.

شنو تقدر دير
• تصفح أكثر من 120 منتج حسب الصنف: توابل، خلطات، أعشاب، حبوب وفواكه جافة، حلويات، بقالة، حناء وتجميل، بخور ومسك
• تشوف الثمن ديال كل منتج بالكيلو ولا بالحبة
• تزيد المنتجات بـ 250 غرام فكل مرة
• تصيفط الطلب للمحل عبر واتساب، بالاسم والتليفون والعنوان
• تعيط للمحل ولا تفتح الموقع ديالو فالخريطة
• تستعمل التطبيق بالعربية ولا الفرنسية ولا الإنجليزية

بلا حساب وبلا كلمة سر. الخلاص عند الاستلام ولا فالمحل، والتوصيل كنتافقو عليه معاك فواتساب.

## Before production (not listing text)
- Data safety: version 1.2.0 sends nothing to any server (no analytics, no account). It keeps the customer's name, phone and address on the phone, and the customer shares them with the shop through WhatsApp. Re-answer the form for this version.
- Privacy policy: replace the placeholder email in docs/privacy-policy.html, republish, re-check the URL in Play.
- Version: 1.2.0+12 clashes with the build already uploaded with versionCode 12: the release build must use 13 or higher.
- Signing: the upload key's key.properties is missing; the owner enters the keystore passwords himself before the release build.
