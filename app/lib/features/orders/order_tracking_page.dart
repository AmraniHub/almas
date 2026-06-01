import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
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
    final l10n = context.l10n;
    final orderSnapshot = order ?? liveOrder;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(orderSnapshot.id, style: theme.textTheme.titleLarge),
        actions: [
          IconButton(
            tooltip: l10n.chatAboutOrderTooltip,
            icon: const Icon(Icons.chat_bubble_rounded),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ChatPage(
                  title: l10n.orderChatTitle(orderSnapshot.id),
                  chatId: orderSnapshot.id,
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
            SectionHeader(
              title: l10n.orderTrackingTitle,
              subtitle: l10n.orderTrackingSubtitle,
            ),
            GlassPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  OrderStageBar(stage: orderSnapshot.stage),
                  const SizedBox(height: AppSpacing.lg),
                  _StatusMessage(stage: orderSnapshot.stage),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            GlassPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.orderSummaryTitle,
                    style: theme.textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _InfoRow(label: l10n.orderIdLabel, value: orderSnapshot.id),
                  _InfoRow(
                    label: l10n.customerLabel,
                    value: l10n.orderCustomerName(orderSnapshot),
                  ),
                  _InfoRow(
                    label: l10n.destinationLabel,
                    value: l10n.orderDestination(orderSnapshot),
                  ),
                  _InfoRow(
                    label: l10n.itemsLabel,
                    value: l10n.productsCount(orderSnapshot.itemCount),
                  ),
                  _InfoRow(
                    label: l10n.totalLabel,
                    value: l10n.formatMad(orderSnapshot.total),
                    emphasize: true,
                  ),
                  _InfoRow(
                    label: l10n.estimatedArrivalLabel,
                    value: l10n.orderEta(orderSnapshot),
                    emphasize: true,
                  ),
                  _InfoRow(
                    label: l10n.paymentLabel,
                    value: l10n.cashOnDeliveryLabel,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            GlassPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.needHelpWithOrder,
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => ContactService.whatsApp(
                            message: l10n.orderInquiryMessage(orderSnapshot.id),
                          ),
                          icon: const Icon(Icons.chat_rounded),
                          label: Text(l10n.whatsappLabel),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: ContactService.call,
                          icon: const Icon(Icons.phone_rounded),
                          label: Text(l10n.callUs),
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
    final l10n = context.l10n;
    final (icon, color) = switch (stage) {
      OrderStage.placed => (
          Icons.pending_actions_rounded,
          AppColors.info,
        ),
      OrderStage.confirmed => (
          Icons.verified_rounded,
          AppColors.success,
        ),
      OrderStage.outForDelivery => (
          Icons.local_shipping_rounded,
          AppColors.saffron,
        ),
      OrderStage.delivered => (
          Icons.check_circle_rounded,
          AppColors.success,
        ),
    };

    return Row(
      children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Text(
            l10n.statusMessage(stage),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: color),
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
