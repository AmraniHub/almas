import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../services/contact_service.dart';

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

// Per-chat local message store (replaced by Firestore in production)
final _chatMessagesProvider = StateProvider.family<List<_Message>, String>(
  (ref, chatId) => [
    _Message(
      text: 'Bonjour! Comment puis-je vous aider aujourd\'hui? 🌿',
      isMe: false,
      time: DateTime.now().subtract(const Duration(minutes: 10)),
    ),
  ],
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
  void dispose() {
    _ctrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send() {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    final notifier = ref.read(
      _chatMessagesProvider(widget.chatId).notifier,
    );
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
    final messages = ref.watch(_chatMessagesProvider(widget.chatId));
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.title, style: theme.textTheme.titleLarge),
            Text('Almas Spices', style: theme.textTheme.bodyMedium),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Call Almas',
            icon: const Icon(Icons.phone_rounded),
            onPressed: ContactService.call,
          ),
          IconButton(
            tooltip: 'Open WhatsApp',
            icon: const Icon(Icons.chat_rounded),
            onPressed: () => ContactService.whatsApp(),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Messages list ──────────────────────────────────────────
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: messages.length,
              itemBuilder: (context, index) {
                final msg = messages[index];
                return _Bubble(message: msg);
              },
            ),
          ),

          // ── Input bar ──────────────────────────────────────────────
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
                      decoration: const InputDecoration(
                        hintText: 'Write a message...',
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
