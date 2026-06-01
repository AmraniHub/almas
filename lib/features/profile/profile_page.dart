import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../widgets/contact_bar.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/section_header.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader(
              title: 'Restaurant profile',
              subtitle:
                  'Identity, branches, favorites, and service preferences live in a cleaner operational profile.',
            ),
            const _ProfileHero(),
            const SizedBox(height: AppSpacing.lg),
            LayoutBuilder(
              builder: (context, constraints) {
                final wideLayout = constraints.maxWidth >= 920;

                if (wideLayout) {
                  return const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: _BranchPanel()),
                      SizedBox(width: AppSpacing.md),
                      Expanded(child: _FavoritesPanel()),
                    ],
                  );
                }

                return const Column(
                  children: [
                    _BranchPanel(),
                    SizedBox(height: AppSpacing.md),
                    _FavoritesPanel(),
                  ],
                );
              },
            ),
            const SizedBox(height: AppSpacing.md),
            LayoutBuilder(
              builder: (context, constraints) {
                final wideLayout = constraints.maxWidth >= 920;

                if (wideLayout) {
                  return const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: _PreferencesPanel()),
                      SizedBox(width: AppSpacing.md),
                      Expanded(child: _InvoicePanel()),
                    ],
                  );
                }

                return const Column(
                  children: [
                    _PreferencesPanel(),
                    SizedBox(height: AppSpacing.md),
                    _InvoicePanel(),
                  ],
                );
              },
            ),
            const SizedBox(height: AppSpacing.md),
            // Contact Almas section
            GlassPanel(
              child: ContactBar(),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GlassPanel(
      child: Row(
        children: [
          Container(
            width: 84,
            height: 84,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.saffron, AppColors.terracotta],
              ),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.restaurant_menu_rounded,
              color: AppColors.white,
              size: 36,
            ),
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Dar Lalla Kitchen Group',
                  style: theme.textTheme.headlineMedium,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Primary buyer account • Casablanca',
                  style: theme.textTheme.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: const [
                    _ProfilePill(label: '3 branches', color: AppColors.olive),
                    _ProfilePill(label: 'WhatsApp updates', color: AppColors.info),
                    _ProfilePill(label: 'French primary', color: AppColors.saffron),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BranchPanel extends StatelessWidget {
  const _BranchPanel();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Delivery branches',
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          const _InfoTile(
            title: 'Anfa Business Branch',
            subtitle: 'Primary receiving kitchen • 08:00 to 18:00',
          ),
          const _InfoTile(
            title: 'Maarif Catering Lab',
            subtitle: 'Large-batch prep • accepts pallets on Tuesdays',
          ),
          const _InfoTile(
            title: 'Ain Diab Events Unit',
            subtitle: 'Seasonal demand spikes • fast reorder lane enabled',
          ),
        ],
      ),
    );
  }
}

class _FavoritesPanel extends StatelessWidget {
  const _FavoritesPanel();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Favorite bundles',
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          const _InfoTile(
            title: 'Tagine Essentials Kit',
            subtitle: 'Ras el Hanout, turmeric, paprika, preserved lemon salt',
          ),
          const _InfoTile(
            title: 'Tea Service Set',
            subtitle: 'Dried spearmint, saffron, cinnamon, orange blossom notes',
          ),
          const _InfoTile(
            title: 'Grill Line Bundle',
            subtitle: 'Smoked paprika, cumin, harissa base, finishing salt',
          ),
        ],
      ),
    );
  }
}

class _PreferencesPanel extends StatelessWidget {
  const _PreferencesPanel();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Preferences',
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          const _PreferenceRow(
            label: 'Primary language',
            value: 'French with Arabic-ready layout',
          ),
          const _PreferenceRow(
            label: 'Payment flow',
            value: 'Cash on delivery',
          ),
          const _PreferenceRow(
            label: 'Notifications',
            value: 'WhatsApp + push confirmation',
          ),
          const _PreferenceRow(
            label: 'Reorder behavior',
            value: 'Restore last high-volume basket',
          ),
        ],
      ),
    );
  }
}

class _InvoicePanel extends StatelessWidget {
  const _InvoicePanel();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Recent invoices',
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          const _InvoiceTile(
            id: 'INV-2405-18',
            amount: '864 MAD',
            status: 'Delivered',
          ),
          const _InvoiceTile(
            id: 'INV-2405-14',
            amount: '1,120 MAD',
            status: 'Paid',
          ),
          const _InvoiceTile(
            id: 'INV-2405-11',
            amount: '620 MAD',
            status: 'Paid',
          ),
        ],
      ),
    );
  }
}

class _ProfilePill extends StatelessWidget {
  const _ProfilePill({
    required this.label,
    required this.color,
  });

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
        child: Text(label),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.white.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(subtitle, style: theme.textTheme.bodyMedium),
            ],
          ),
        ),
      ),
    );
  }
}

class _PreferenceRow extends StatelessWidget {
  const _PreferenceRow({
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
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.titleMedium,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

class _InvoiceTile extends StatelessWidget {
  const _InvoiceTile({
    required this.id,
    required this.amount,
    required this.status,
  });

  final String id;
  final String amount;
  final String status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(id, style: theme.textTheme.titleMedium),
                Text(status, style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
          Text(amount, style: theme.textTheme.titleMedium),
        ],
      ),
    );
  }
}
