import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/metric_card.dart';
import '../../widgets/section_header.dart';

class AdminPage extends StatelessWidget {
  const AdminPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final metrics = l10n.adminMetrics;

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(
              title: l10n.ownerConsoleTitle,
              subtitle: l10n.ownerConsoleSubtitle,
            ),
            const _AdminHero(),
            const SizedBox(height: AppSpacing.lg),
            LayoutBuilder(
              builder: (context, constraints) {
                final isCompact = constraints.maxWidth < 740;

                return Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.md,
                  children: [
                    SizedBox(
                      width: isCompact ? constraints.maxWidth : 230,
                      height: 168,
                      child: MetricCard(
                        icon: Icons.notifications_active_rounded,
                        label: metrics[0].label,
                        value: metrics[0].value,
                        accentColor: AppColors.terracotta,
                      ),
                    ),
                    SizedBox(
                      width: isCompact ? constraints.maxWidth : 230,
                      height: 168,
                      child: MetricCard(
                        icon: Icons.payments_rounded,
                        label: metrics[1].label,
                        value: metrics[1].value,
                        accentColor: AppColors.success,
                      ),
                    ),
                    SizedBox(
                      width: isCompact ? constraints.maxWidth : 230,
                      height: 168,
                      child: MetricCard(
                        icon: Icons.route_rounded,
                        label: metrics[2].label,
                        value: metrics[2].value,
                        accentColor: AppColors.info,
                      ),
                    ),
                    SizedBox(
                      width: isCompact ? constraints.maxWidth : 230,
                      height: 168,
                      child: MetricCard(
                        icon: Icons.warning_amber_rounded,
                        label: metrics[3].label,
                        value: metrics[3].value,
                        accentColor: AppColors.warning,
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: AppSpacing.xl),
            LayoutBuilder(
              builder: (context, constraints) {
                final wideLayout = constraints.maxWidth >= 920;

                if (wideLayout) {
                  return const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(flex: 3, child: _IncomingOrdersPanel()),
                      SizedBox(width: AppSpacing.md),
                      Expanded(flex: 2, child: _OpsSidebar()),
                    ],
                  );
                }

                return const Column(
                  children: [
                    _IncomingOrdersPanel(),
                    SizedBox(height: AppSpacing.md),
                    _OpsSidebar(),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _AdminHero extends StatelessWidget {
  const _AdminHero();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wideLayout = constraints.maxWidth >= 820;
          final summary = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.adminHeroTitle,
                style: theme.textTheme.headlineMedium,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.adminHeroSubtitle,
                style: theme.textTheme.bodyLarge,
              ),
            ],
          );

          final heroPills = l10n.adminHeroPills;
          final indicators = Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _AdminPill(
                icon: Icons.flash_on_rounded,
                label: heroPills[0],
                color: AppColors.warning,
              ),
              _AdminPill(
                icon: Icons.done_all_rounded,
                label: heroPills[1],
                color: AppColors.success,
              ),
              _AdminPill(
                icon: Icons.inventory_rounded,
                label: heroPills[2],
                color: AppColors.terracotta,
              ),
            ],
          );

          if (wideLayout) {
            return Row(
              children: [
                Expanded(flex: 3, child: summary),
                const SizedBox(width: AppSpacing.md),
                Expanded(flex: 2, child: indicators),
              ],
            );
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              summary,
              const SizedBox(height: AppSpacing.md),
              indicators,
            ],
          );
        },
      ),
    );
  }
}

class _IncomingOrdersPanel extends StatelessWidget {
  const _IncomingOrdersPanel();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.incomingOrdersTitle,
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          ...l10n.incomingOrders.map(
            (order) => _IncomingOrderRow(
              customer: order.customer,
              amount: order.amount,
              status: order.status,
              accentColor: _accentForStatusIndex(
                l10n.incomingOrders.indexOf(order),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _accentForStatusIndex(int index) => switch (index) {
        0 => AppColors.warning,
        1 => AppColors.info,
        2 => AppColors.success,
        _ => AppColors.terracotta,
      };
}

class _OpsSidebar extends StatelessWidget {
  const _OpsSidebar();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        _StockWatchPanel(),
        SizedBox(height: AppSpacing.md),
        _RoutePanel(),
      ],
    );
  }
}

class _StockWatchPanel extends StatelessWidget {
  const _StockWatchPanel();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final labels = l10n.lowStockLabels;

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.lowStockWatchTitle,
            style: theme.textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.md),
          _StockBar(label: labels[0], fill: 0.24),
          const SizedBox(height: AppSpacing.sm),
          _StockBar(label: labels[1], fill: 0.36),
          const SizedBox(height: AppSpacing.sm),
          _StockBar(label: labels[2], fill: 0.52),
        ],
      ),
    );
  }
}

class _RoutePanel extends StatelessWidget {
  const _RoutePanel();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.driverRoutesTitle,
            style: theme.textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.md),
          ...l10n.driverRoutes.map(
            (route) => _BulletValue(label: route.label, value: route.value),
          ),
        ],
      ),
    );
  }
}

class _AdminPill extends StatelessWidget {
  const _AdminPill({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: AppSpacing.xs),
            Text(label),
          ],
        ),
      ),
    );
  }
}

class _IncomingOrderRow extends StatelessWidget {
  const _IncomingOrderRow({
    required this.customer,
    required this.amount,
    required this.status,
    required this.accentColor,
  });

  final String customer;
  final String amount;
  final String status;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.white.withValues(alpha: 0.58),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: accentColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(customer, style: theme.textTheme.titleMedium),
                    Text(status, style: theme.textTheme.bodyMedium),
                  ],
                ),
              ),
              Text(amount, style: theme.textTheme.titleMedium),
            ],
          ),
        ),
      ),
    );
  }
}

class _StockBar extends StatelessWidget {
  const _StockBar({
    required this.label,
    required this.fill,
  });

  final String label;
  final double fill;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.xs),
        ClipRRect(
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          child: LinearProgressIndicator(
            minHeight: 10,
            value: fill,
            color: fill < 0.3 ? AppColors.warning : AppColors.success,
            backgroundColor: AppColors.ink.withValues(alpha: 0.06),
          ),
        ),
      ],
    );
  }
}

class _BulletValue extends StatelessWidget {
  const _BulletValue({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 10,
            height: 10,
            margin: const EdgeInsets.only(top: 6),
            decoration: const BoxDecoration(
              color: AppColors.olive,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: theme.textTheme.bodyMedium,
                children: [
                  TextSpan(
                    text: '$label: ',
                    style: theme.textTheme.titleMedium,
                  ),
                  TextSpan(text: value),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
