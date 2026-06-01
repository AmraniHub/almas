import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../services/contact_service.dart';
import '../../widgets/almas_logo.dart';

class _Message {
  _Message({
    required this.text,
    required this.isMe,
    required this.time,
  });

  final String text;
  final bool isMe;
  final DateTime time;
}

final _chatMessagesProvider = StateProvider.family<List<_Message>, String>(
  (ref, chatId) => [],
);

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
  final TextEditingController _ctrl = TextEditingController();
  final ScrollController _scroll = ScrollController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final notifier = ref.read(_chatMessagesProvider(widget.chatId).notifier);
    if (notifier.state.isEmpty) {
      notifier.state = [
        _Message(
          text: context.l10n.chatGreeting,
          isMe: false,
          time: DateTime.now().subtract(const Duration(minutes: 10)),
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

  void _send() {
    final text = _ctrl.text.trim();
    if (text.isEmpty) {
      return;
    }

    final notifier = ref.read(_chatMessagesProvider(widget.chatId).notifier);
    notifier.state = [
      ...notifier.state,
      _Message(text: text, isMe: true, time: DateTime.now()),
    ];
    _ctrl.clear();

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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final messages = ref.watch(_chatMessagesProvider(widget.chatId));
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            const AlmasLogo(size: 40, padding: EdgeInsets.all(4)),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.title, style: theme.textTheme.titleLarge),
                  Text(l10n.appBrandName, style: theme.textTheme.bodyMedium),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: l10n.callAlmasTooltip,
            icon: const Icon(Icons.phone_rounded),
            onPressed: ContactService.call,
          ),
          IconButton(
            tooltip: l10n.openWhatsAppTooltip,
            icon: const Icon(Icons.chat_rounded),
            onPressed: () => ContactService.whatsApp(
              message: l10n.generalWhatsAppMessage,
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: messages.length,
              itemBuilder: (context, index) {
                final message = messages[index];
                return _Bubble(message: message);
              },
            ),
          ),
          SafeArea(
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
                      decoration: InputDecoration(
                        hintText: l10n.chatInputHint,
                      ),
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

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final _Message message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isMe = message.isMe;

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: EdgeInsets.only(
          top: AppSpacing.xs,
          bottom: AppSpacing.xs,
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
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(isMe ? 18 : 4),
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
              message.text,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: isMe ? AppColors.white : AppColors.ink,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '${message.time.hour.toString().padLeft(2, '0')}:${message.time.minute.toString().padLeft(2, '0')}',
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
