import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/metric_card.dart';
import '../../widgets/section_header.dart';

class AdminPage extends StatelessWidget {
  const AdminPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader(
              title: 'Owner console',
              subtitle:
                  'A focused operations layer for orders, delivery cash, and stock pressure without burying key signals.',
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
                      child: const MetricCard(
                        icon: Icons.notifications_active_rounded,
                        label: 'New orders this morning',
                        value: '12',
                        accentColor: AppColors.terracotta,
                      ),
                    ),
                    SizedBox(
                      width: isCompact ? constraints.maxWidth : 230,
                      height: 168,
                      child: const MetricCard(
                        icon: Icons.payments_rounded,
                        label: 'Cash collected today',
                        value: '13.4k',
                        accentColor: AppColors.success,
                      ),
                    ),
                    SizedBox(
                      width: isCompact ? constraints.maxWidth : 230,
                      height: 168,
                      child: const MetricCard(
                        icon: Icons.route_rounded,
                        label: 'Active delivery routes',
                        value: '4',
                        accentColor: AppColors.info,
                      ),
                    ),
                    SizedBox(
                      width: isCompact ? constraints.maxWidth : 230,
                      height: 168,
                      child: const MetricCard(
                        icon: Icons.warning_amber_rounded,
                        label: 'Low stock watchlist',
                        value: '3',
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
    final theme = Theme.of(context);

    return GlassPanel(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wideLayout = constraints.maxWidth >= 820;
          final summary = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Control tower for the day’s spice flow',
                style: theme.textTheme.headlineMedium,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Incoming COD orders, low-stock risk, and driver cash collection stay in a single visual rhythm.',
                style: theme.textTheme.bodyLarge,
              ),
            ],
          );

          final indicators = Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: const [
              _AdminPill(
                icon: Icons.flash_on_rounded,
                label: '2 urgent confirmations',
                color: AppColors.warning,
              ),
              _AdminPill(
                icon: Icons.done_all_rounded,
                label: '96% on-time',
                color: AppColors.success,
              ),
              _AdminPill(
                icon: Icons.inventory_rounded,
                label: 'Mint low by tonight',
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
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Incoming orders',
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          const _IncomingOrderRow(
            customer: 'La Table Verte',
            amount: '860 MAD',
            status: 'Needs confirmation',
            accentColor: AppColors.warning,
          ),
          const _IncomingOrderRow(
            customer: 'Mina Seafood Bar',
            amount: '1,240 MAD',
            status: 'Assign driver',
            accentColor: AppColors.info,
          ),
          const _IncomingOrderRow(
            customer: 'Dar Bahia Events',
            amount: '620 MAD',
            status: 'Packed',
            accentColor: AppColors.success,
          ),
          const _IncomingOrderRow(
            customer: 'Atelier Couscous',
            amount: '410 MAD',
            status: 'Waiting on minimum uplift',
            accentColor: AppColors.terracotta,
          ),
        ],
      ),
    );
  }
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
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Low stock watch',
            style: theme.textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.md),
          const _StockBar(label: 'Dried Spearmint', fill: 0.24),
          const SizedBox(height: AppSpacing.sm),
          const _StockBar(label: 'Smoked Paprika', fill: 0.36),
          const SizedBox(height: AppSpacing.sm),
          const _StockBar(label: 'Royal Saffron Threads', fill: 0.52),
        ],
      ),
    );
  }
}

class _RoutePanel extends StatelessWidget {
  const _RoutePanel();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Driver routes',
            style: theme.textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.md),
          const _BulletValue(label: 'Yassine', value: 'Anfa loop • 1,800 MAD'),
          const _BulletValue(label: 'Salma', value: 'Rabat North • 940 MAD'),
          const _BulletValue(label: 'Omar', value: 'Mohammedia • 620 MAD'),
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

