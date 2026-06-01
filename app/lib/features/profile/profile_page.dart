import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../widgets/almas_logo.dart';
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
            SectionHeader(
              title: context.l10n.restaurantProfileTitle,
              subtitle: context.l10n.restaurantProfileSubtitle,
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
            const GlassPanel(
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
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: Row(
        children: [
          Container(
            width: 84,
            height: 84,
            padding: const EdgeInsets.all(AppSpacing.xs),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.saffron, AppColors.terracotta],
              ),
              shape: BoxShape.circle,
            ),
            child: const ClipOval(
              child: AlmasLogo(
                size: 68,
                padding: EdgeInsets.all(AppSpacing.xs),
                backgroundColor: AppColors.white,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.profileAccountName,
                  style: theme.textTheme.headlineMedium,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.profileAccountSubtitle,
                  style: theme.textTheme.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: l10n.profileHeroPills
                      .map(
                        (label) => _ProfilePill(
                          label: label,
                          color: _pillColorForIndex(
                            l10n.profileHeroPills.indexOf(label),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _pillColorForIndex(int index) => switch (index) {
        0 => AppColors.olive,
        1 => AppColors.info,
        _ => AppColors.saffron,
      };
}

class _BranchPanel extends StatelessWidget {
  const _BranchPanel();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.deliveryBranchesTitle,
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          ...l10n.profileBranches.map(
            (branch) => _InfoTile(
              title: branch.title,
              subtitle: branch.subtitle,
            ),
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
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.favoriteBundlesTitle,
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          ...l10n.favoriteBundles.map(
            (bundle) => _InfoTile(
              title: bundle.title,
              subtitle: bundle.subtitle,
            ),
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
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.preferencesTitle,
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          ...l10n.profilePreferences.map(
            (preference) => _PreferenceRow(
              label: preference.label,
              value: preference.value,
            ),
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
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.recentInvoicesTitle,
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          ...l10n.recentInvoices.map(
            (invoice) => _InvoiceTile(
              id: invoice.id,
              amount: invoice.amount,
              status: invoice.status,
            ),
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
