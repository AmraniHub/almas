import 'package:flutter/material.dart';

import '../core/localization/app_localizations.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';
import '../services/contact_service.dart';

class ContactBar extends StatelessWidget {
  const ContactBar({super.key, this.showTitle = true});

  final bool showTitle;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showTitle) ...[
          Text(l10n.contactTitle, style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
        ],
        Row(
          children: [
            Expanded(
              child: _ContactButton(
                icon: Icons.phone_rounded,
                label: l10n.callLabel,
                color: AppColors.success,
                onTap: ContactService.call,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _ContactButton(
                icon: Icons.chat_rounded,
                label: l10n.whatsappLabel,
                color: const Color(0xFF25D366),
                onTap: () => ContactService.whatsApp(
                  message: l10n.generalWhatsAppMessage,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _ContactButton(
                icon: Icons.place_rounded,
                label: l10n.locationLabel,
                color: AppColors.info,
                onTap: ContactService.directions,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ContactButton extends StatelessWidget {
  const _ContactButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppSpacing.panelRadius),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            vertical: AppSpacing.md,
            horizontal: AppSpacing.sm,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 26),
              const SizedBox(height: AppSpacing.xs),
              Text(
                label,
                style: theme.textTheme.labelMedium?.copyWith(color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
