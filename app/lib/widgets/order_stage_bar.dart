import 'package:flutter/material.dart';

import '../core/localization/app_localizations.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';
import '../models/order_snapshot.dart';

class OrderStageBar extends StatelessWidget {
  const OrderStageBar({
    required this.stage,
    super.key,
  });

  final OrderStage stage;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final activeIndex = OrderStage.values.indexOf(stage);

    return Column(
      children: [
        Row(
          children: List.generate(
            OrderStage.values.length * 2 - 1,
            (index) {
              if (index.isOdd) {
                final connectorIndex = index ~/ 2;
                final isActive = connectorIndex < activeIndex;

                return Expanded(
                  child: Container(
                    height: 2,
                    margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                    color: isActive
                        ? AppColors.success
                        : AppColors.ink.withValues(alpha: 0.08),
                  ),
                );
              }

              final stageIndex = index ~/ 2;
              final isActive = stageIndex <= activeIndex;

              return Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isActive ? AppColors.success : AppColors.white,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isActive
                        ? AppColors.success
                        : AppColors.ink.withValues(alpha: 0.12),
                  ),
                ),
                child: Icon(
                  isActive ? Icons.check_rounded : Icons.circle_outlined,
                  size: 18,
                  color: isActive ? AppColors.white : AppColors.body,
                ),
              );
            },
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: OrderStage.values
              .map(
                (value) => Expanded(
                  child: Text(
                    l10n.orderStageLabel(value),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: value == stage
                          ? AppColors.ink
                          : AppColors.body.withValues(alpha: 0.74),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}
