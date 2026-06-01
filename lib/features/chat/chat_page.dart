import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../services/contact_service.dart';

// ── Message model ─────────────────────────────────────────────────────────────

class _Msg {
  _Msg({
    required this.text,
    required this.isMe,
    required this.time,
  });
  final String   text;
  final bool     isMe;
  final DateTime time;
}

// ── Quick reply chips ─────────────────────────────────────────────────────────

const _quickRepliesFr = [
  'Je voudrais passer une commande',
  'Quels sont vos délais de livraison ?',
  'Avez-vous du safran en stock ?',
  'Commande minimum ?',
];

const _quickRepliesEn = [
  'I want to place an order',
  'What are your delivery times?',
  'Do you have saffron in stock?',
  'What is the minimum order?',
];

const _quickRepliesAr = [
  'أريد تقديم طلب',
  'ما هي أوقات التسليم؟',
  'هل الزعفران متوفر؟',
  'ما هو الحد الأدنى للطلب؟',
];

const _quickRepliesEs = [
  'Quiero hacer un pedido',
  '¿Cuáles son sus tiempos de entrega?',
  '¿Tienen azafrán en stock?',
  '¿Cuál es el pedido mínimo?',
];

// ── Provider ──────────────────────────────────────────────────────────────────

final _chatProvider = StateProvider.family<List<_Msg>, String>((ref, chatId) => []);

// ── Chat page ─────────────────────────────────────────────────────────────────

class ChatPage extends ConsumerStatefulWidget {
  const ChatPage({
    required this.title,
    required this.chatId,
    super.key,
  });

  final String title;
  final String chatId;

  @override
  ConsumerState<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends ConsumerState<ChatPage> {
  final _ctrl   = TextEditingController();
  final _scroll = ScrollController();
  bool _showQuickReplies = true;

  @override
  void initState() {
    super.initState();
    // Add the welcome message after build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _addWelcome();
    });
  }

  void _addWelcome() {
    final l10n = context.l10n;
    final notifier = ref.read(_chatProvider(widget.chatId).notifier);
    if (notifier.state.isEmpty) {
      notifier.state = [
        _Msg(
          text: l10n.chatGreeting,
          isMe: false,
          time: DateTime.now(),
        ),
      ];
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send([String? quickReply]) {
    final text = (quickReply ?? _ctrl.text).trim();
    if (text.isEmpty) return;

    final notifier = ref.read(_chatProvider(widget.chatId).notifier);
    final now = DateTime.now();

    notifier.state = [
      ...notifier.state,
      _Msg(text: text, isMe: true, time: now),
    ];

    _ctrl.clear();
    setState(() => _showQuickReplies = false);

    // Auto-reply: suggest WhatsApp for real support
    Future.delayed(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      final l10n = context.l10n;
      final reply = _autoReply(text, l10n.languageCode);
      notifier.state = [
        ...notifier.state,
        _Msg(text: reply, isMe: false, time: DateTime.now()),
      ];
      _scrollToBottom();
    });

    _scrollToBottom();
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _autoReply(String message, String lang) {
    final m = message.toLowerCase();

    // Order intent
    if (m.contains('commande') || m.contains('order') || m.contains('طلب') ||
        m.contains('pedido')) {
      return switch (lang) {
        'fr' => 'Pour passer une commande rapidement, utilisez le bouton WhatsApp ci-dessous. Notre équipe traite les commandes de 08h à 18h. 🌿',
        'ar' => 'لتقديم طلبك بسرعة، استخدم زر واتساب أدناه. فريقنا يعالج الطلبات من 8 صباحاً حتى 6 مساءً. 🌿',
        'es' => 'Para hacer un pedido rápidamente, usa el botón de WhatsApp a continuación. Nuestro equipo procesa pedidos de 08h a 18h. 🌿',
        _    => 'To place an order quickly, use the WhatsApp button below. Our team processes orders from 8am to 6pm. 🌿',
      };
    }

    // Delivery time
    if (m.contains('délai') || m.contains('delivery') || m.contains('livraison') ||
        m.contains('توصيل') || m.contains('entrega')) {
      return switch (lang) {
        'fr' => 'Livraison sous 24–48h à Casablanca et Rabat. Autres villes : 2–4 jours. Minimum de commande : 250 MAD.',
        'ar' => 'التوصيل خلال 24-48 ساعة في الدار البيضاء والرباط. المدن الأخرى: 2-4 أيام. الحد الأدنى للطلب: 250 درهم.',
        'es' => 'Entrega en 24-48h en Casablanca y Rabat. Otras ciudades: 2-4 días. Pedido mínimo: 250 MAD.',
        _    => 'Delivery in 24-48h in Casablanca and Rabat. Other cities: 2-4 days. Minimum order: 250 MAD.',
      };
    }

    // Stock/availability
    if (m.contains('stock') || m.contains('disponible') || m.contains('متوفر') ||
        m.contains('disponib')) {
      return switch (lang) {
        'fr' => 'Nos produits sont généralement en stock. Pour vérifier la disponibilité d\'un produit spécifique, contactez-nous sur WhatsApp. 📦',
        'ar' => 'منتجاتنا متوفرة عادةً. للتحقق من توفر منتج معين، تواصل معنا عبر واتساب. 📦',
        'es' => 'Nuestros productos suelen estar en stock. Para verificar disponibilidad de un producto específico, contáctenos por WhatsApp. 📦',
        _    => 'Our products are generally in stock. To check availability of a specific product, contact us on WhatsApp. 📦',
      };
    }

    // Minimum order
    if (m.contains('minimum') || m.contains('min') || m.contains('الحد الأدنى') ||
        m.contains('mínimo')) {
      return switch (lang) {
        'fr' => 'Commande minimum : 250 MAD. Livraison offerte dès 500 MAD. 🎁',
        'ar' => 'الحد الأدنى للطلب: 250 درهم. توصيل مجاني من 500 درهم. 🎁',
        'es' => 'Pedido mínimo: 250 MAD. Envío gratis a partir de 500 MAD. 🎁',
        _    => 'Minimum order: 250 MAD. Free delivery from 500 MAD. 🎁',
      };
    }

    // Default
    return switch (lang) {
      'fr' => 'Merci pour votre message ! Pour une réponse immédiate, contactez-nous directement sur WhatsApp — notre équipe répond en quelques minutes. 👇',
      'ar' => 'شكراً على رسالتك! للحصول على رد فوري، تواصل معنا مباشرةً عبر واتساب. فريقنا يرد في دقائق. 👇',
      'es' => '¡Gracias por su mensaje! Para una respuesta inmediata, contáctenos directamente por WhatsApp — nuestro equipo responde en minutos. 👇',
      _    => 'Thanks for your message! For an immediate response, contact us directly on WhatsApp — our team replies within minutes. 👇',
    };
  }

  List<String> get _quickReplies {
    final lang = context.l10n.languageCode;
    return switch (lang) {
      'fr' => _quickRepliesFr,
      'ar' => _quickRepliesAr,
      'es' => _quickRepliesEs,
      _    => _quickRepliesEn,
    };
  }

  @override
  Widget build(BuildContext context) {
    final theme    = Theme.of(context);
    final l10n     = context.l10n;
    final messages = ref.watch(_chatProvider(widget.chatId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 38, height: 38,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.saffron, AppColors.terracotta],
                ),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.spa_rounded, color: Colors.white, size: 18),
            ),
            const SizedBox(width: AppSpacing.sm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Almas Spices', style: theme.textTheme.titleMedium),
                Row(
                  children: [
                    Container(
                      width: 8, height: 8,
                      margin: const EdgeInsets.only(right: 4),
                      decoration: const BoxDecoration(
                        color: AppColors.success,
                        shape: BoxShape.circle,
                      ),
                    ),
                    Text(
                      l10n.languageCode == 'fr' ? 'En ligne · 08h–18h' :
                      l10n.languageCode == 'ar' ? 'متصل · 08:00–18:00' :
                      l10n.languageCode == 'es' ? 'En línea · 08h–18h' :
                      'Online · 8am–6pm',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.success,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: l10n.whatsAppContactTooltip,
            icon: const Icon(Icons.chat_rounded, color: Color(0xFF25D366)),
            onPressed: () => ContactService.whatsApp(),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Messages ──────────────────────────────────────────────────────
          Expanded(
            child: messages.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md, AppSpacing.md,
                      AppSpacing.md, AppSpacing.sm,
                    ),
                    itemCount: messages.length,
                    itemBuilder: (context, i) => _Bubble(msg: messages[i]),
                  ),
          ),

          // ── Quick reply chips ─────────────────────────────────────────────
          if (_showQuickReplies && messages.isNotEmpty)
            SizedBox(
              height: 44,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                itemCount: _quickReplies.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(width: AppSpacing.sm),
                itemBuilder: (_, i) => ActionChip(
                  label: Text(_quickReplies[i]),
                  onPressed: () => _send(_quickReplies[i]),
                ),
              ),
            ),

          // ── WhatsApp CTA ──────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF25D366),
                side: const BorderSide(color: Color(0xFF25D366)),
              ),
              onPressed: () => ContactService.whatsApp(),
              icon: const Icon(Icons.chat_rounded),
              label: Text(
                l10n.languageCode == 'fr' ? 'Continuer sur WhatsApp pour une réponse immédiate' :
                l10n.languageCode == 'ar' ? 'تواصل عبر واتساب للحصول على رد فوري' :
                l10n.languageCode == 'es' ? 'Continuar en WhatsApp para respuesta inmediata' :
                'Continue on WhatsApp for immediate support',
              ),
            ),
          ),

          // ── Input bar ─────────────────────────────────────────────────────
          SafeArea(
            top: false,
            child: Container(
              color: AppColors.surfaceStrong,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(hintText: l10n.chatInputHint),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  IconButton.filled(
                    onPressed: _send,
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Bubble ────────────────────────────────────────────────────────────────────

class _Bubble extends StatelessWidget {
  const _Bubble({required this.msg});
  final _Msg msg;

  @override
  Widget build(BuildContext context) {
    final theme  = Theme.of(context);
    final isMe   = msg.isMe;

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: EdgeInsets.only(
          top: AppSpacing.xs, bottom: AppSpacing.xs,
          left: isMe ? 48 : 0,
          right: isMe ? 0 : 48,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: isMe ? AppColors.ink : AppColors.white,
          borderRadius: BorderRadius.only(
            topLeft:     const Radius.circular(18),
            topRight:    const Radius.circular(18),
            bottomLeft:  Radius.circular(isMe ? 18 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 18),
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.ink.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment:
              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(
              msg.text,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: isMe ? AppColors.white : AppColors.ink,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '${msg.time.hour.toString().padLeft(2, '0')}:${msg.time.minute.toString().padLeft(2, '0')}',
              style: theme.textTheme.labelMedium?.copyWith(
                color: isMe
                    ? AppColors.white.withValues(alpha: 0.6)
                    : AppColors.body,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
