import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/demo_data.dart';
import '../../models/order_snapshot.dart';
import '../../services/contact_service.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/order_stage_bar.dart';
import '../../widgets/section_header.dart';
import '../chat/chat_page.dart';

class OrderTrackingPage extends StatelessWidget {
  const OrderTrackingPage({this.order, super.key});

  final OrderSnapshot? order;

  @override
  Widget build(BuildContext context) {
    final o = order ?? liveOrder;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(o.id, style: theme.textTheme.titleLarge),
        actions: [
          IconButton(
            tooltip: 'Chat about this order',
            icon: const Icon(Icons.chat_bubble_rounded),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ChatPage(
                  title: 'Order ${o.id}',
                  chatId: o.id,
                ),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader(
              title: 'Order tracking',
              subtitle: 'Real-time status of your current order.',
            ),

            // Stage bar
            GlassPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  OrderStageBar(stage: o.stage),
                  const SizedBox(height: AppSpacing.lg),
                  _StatusMessage(stage: o.stage),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Order summary
            GlassPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Order summary', style: theme.textTheme.titleLarge),
                  const SizedBox(height: AppSpacing.md),
                  _InfoRow(label: 'Order ID', value: o.id),
                  _InfoRow(label: 'Customer', value: o.customerName),
                  _InfoRow(label: 'Destination', value: o.destination),
                  _InfoRow(label: 'Items', value: '${o.itemCount} products'),
                  _InfoRow(
                    label: 'Total',
                    value: '${o.total.toStringAsFixed(0)} MAD',
                    emphasize: true,
                  ),
                  _InfoRow(
                    label: 'Estimated arrival',
                    value: o.eta,
                    emphasize: true,
                  ),
                  _InfoRow(label: 'Payment', value: 'Cash on delivery'),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Contact actions
            GlassPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Need help with this order?',
                      style: theme.textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => ContactService.whatsApp(
                            message:
                                'Bonjour Almas, je voudrais des informations sur ma commande ${o.id}.',
                          ),
                          icon: const Icon(Icons.chat_rounded),
                          label: const Text('WhatsApp'),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: ContactService.call,
                          icon: const Icon(Icons.phone_rounded),
                          label: const Text('Call us'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusMessage extends StatelessWidget {
  const _StatusMessage({required this.stage});
  final OrderStage stage;

  @override
  Widget build(BuildContext context) {
    final (icon, message, color) = switch (stage) {
      OrderStage.placed => (
          Icons.pending_actions_rounded,
          'Your order has been placed and is waiting for confirmation from Almas.',
          AppColors.info,
        ),
      OrderStage.confirmed => (
          Icons.verified_rounded,
          'Order confirmed! Your products are being prepared for dispatch.',
          AppColors.success,
        ),
      OrderStage.outForDelivery => (
          Icons.local_shipping_rounded,
          'Your order is on the way! The driver will arrive soon.',
          AppColors.saffron,
        ),
      OrderStage.delivered => (
          Icons.check_circle_rounded,
          'Delivered successfully. Thank you for ordering from Almas!',
          AppColors.success,
        ),
    };

    return Row(
      children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Text(
            message,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: color),
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });
  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: theme.textTheme.bodyMedium),
          ),
          Text(
            value,
            style: emphasize
                ? theme.textTheme.titleMedium
                : theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}
