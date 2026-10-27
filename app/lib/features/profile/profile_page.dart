import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../services/contact_service.dart';
import '../../services/customer_profile_service.dart';
import '../../widgets/almas_logo.dart';
import '../../widgets/contact_bar.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/section_header.dart';

/// "Profile": the customer's own details as the checkout saved them on this phone (nothing leaves the phone
/// except in the WhatsApp order they send), and the shop itself: where it is and how to reach it.
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  CustomerProfile _profile = const CustomerProfile();

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    final profile = await CustomerProfileService.load();
    if (mounted) setState(() => _profile = profile);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return RefreshIndicator(
      onRefresh: _reload,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(title: l10n.yourDetailsTitle, subtitle: l10n.yourDetailsSubtitle),
            GlassPanel(
              child: _profile.businessName.isEmpty && _profile.phone.isEmpty && _profile.address.isEmpty
                  ? Text(l10n.noSavedDetails, style: theme.textTheme.bodyLarge)
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Line(icon: Icons.storefront_rounded, text: _profile.businessName),
                        _Line(icon: Icons.phone_rounded, text: _profile.phone),
                        _Line(icon: Icons.place_rounded, text: _profile.address),
                      ],
                    ),
            ),
            const SizedBox(height: AppSpacing.lg),
            GlassPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const AlmasLogo(size: 56),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(l10n.appBrandName, style: theme.textTheme.titleLarge),
                            Text(l10n.shopLocation, style: theme.textTheme.bodyMedium),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const ContactBar(showTitle: false),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            GlassPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.forBusinessesTitle, style: theme.textTheme.titleLarge),
                  const SizedBox(height: AppSpacing.sm),
                  Text(l10n.forBusinessesBody, style: theme.textTheme.bodyLarge),
                  const SizedBox(height: AppSpacing.sm),
                  TextButton.icon(
                    onPressed: () => ContactService.whatsApp(message: l10n.largeQuantityWhatsAppMessage),
                    icon: const Icon(Icons.request_quote_rounded, color: AppColors.olive),
                    label: Text(l10n.askPriceForLargeQuantities),
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

class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    if (text.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.body),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyLarge)),
        ],
      ),
    );
  }
}
