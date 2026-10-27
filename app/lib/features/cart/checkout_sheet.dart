import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/cart_item.dart';
import '../../services/contact_service.dart';
import '../../services/customer_profile_service.dart';

/// Opens the checkout bottom sheet where the buyer confirms delivery details
/// and sends the full itemized order to Almas on WhatsApp.
Future<void> showCheckoutSheet(
  BuildContext context, {
  required List<CartItem> items,
  required double subtotal,
  required double deliveryFee,
  required double total,
  required VoidCallback onOrderSent,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _CheckoutSheet(
      items: items,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: total,
      onOrderSent: onOrderSent,
    ),
  );
}

class _CheckoutSheet extends StatefulWidget {
  const _CheckoutSheet({
    required this.items,
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.onOrderSent,
  });

  final List<CartItem> items;
  final double subtotal;
  final double deliveryFee;
  final double total;
  final VoidCallback onOrderSent;

  @override
  State<_CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<_CheckoutSheet> {
  final _formKey = GlobalKey<FormState>();
  final _businessCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _prefill();
  }

  Future<void> _prefill() async {
    final profile = await CustomerProfileService.load();
    if (!mounted) return;
    setState(() {
      _businessCtrl.text = profile.businessName;
      _phoneCtrl.text = profile.phone;
      _addressCtrl.text = profile.address;
    });
  }

  @override
  void dispose() {
    _businessCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _sending = true);

    final profile = CustomerProfile(
      businessName: _businessCtrl.text,
      phone: _phoneCtrl.text,
      address: _addressCtrl.text,
    );
    await CustomerProfileService.save(profile);

    final message = l10n.buildOrderMessage(
      businessName: profile.businessName.trim(),
      phone: profile.phone.trim(),
      address: profile.address.trim(),
      notes: _notesCtrl.text,
      items: widget.items,
      subtotal: widget.subtotal,
      deliveryFee: widget.deliveryFee,
      total: widget.total,
    );

    final launched = await ContactService.whatsApp(message: message);

    if (!mounted) return;

    if (launched) {
      widget.onOrderSent();
      navigator.pop();
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.orderSentSuccess)),
      );
    } else {
      setState(() => _sending = false);
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.orderSendFailed)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.md,
        right: AppSpacing.md,
        top: AppSpacing.sm,
        bottom: bottomInset + AppSpacing.lg,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.checkoutDetailsTitle, style: theme.textTheme.headlineMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(l10n.checkoutDetailsSubtitle, style: theme.textTheme.bodyMedium),
              const SizedBox(height: AppSpacing.lg),
              _Field(
                controller: _businessCtrl,
                label: l10n.businessNameLabel,
                icon: Icons.storefront_rounded,
                textInputAction: TextInputAction.next,
                requiredError: l10n.requiredFieldError,
              ),
              const SizedBox(height: AppSpacing.md),
              _Field(
                controller: _phoneCtrl,
                label: l10n.phoneFieldLabel,
                icon: Icons.phone_rounded,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                requiredError: l10n.requiredFieldError,
              ),
              const SizedBox(height: AppSpacing.md),
              _Field(
                controller: _addressCtrl,
                label: l10n.deliveryAddressLabel,
                icon: Icons.place_rounded,
                textInputAction: TextInputAction.next,
                requiredError: l10n.requiredFieldError,
                maxLines: 2,
              ),
              const SizedBox(height: AppSpacing.md),
              _Field(
                controller: _notesCtrl,
                label: l10n.orderNotesLabel,
                hint: l10n.orderNotesHint,
                icon: Icons.sticky_note_2_rounded,
                textInputAction: TextInputAction.done,
                maxLines: 2,
                optional: true,
              ),
              const SizedBox(height: AppSpacing.md),
              _TotalRow(label: l10n.totalDueOnDelivery, value: l10n.formatMad(widget.total)),
              const SizedBox(height: AppSpacing.lg),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF25D366),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                  ),
                  onPressed: _sending ? null : _submit,
                  icon: _sending
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.chat_rounded),
                  label: Text(l10n.confirmOrderOnWhatsApp),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.icon,
    this.hint,
    this.keyboardType,
    this.textInputAction,
    this.requiredError,
    this.maxLines = 1,
    this.optional = false,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final String? requiredError;
  final int maxLines;
  final bool optional;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      maxLines: maxLines,
      textCapitalization: TextCapitalization.sentences,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon),
      ),
      validator: optional
          ? null
          : (value) =>
              (value == null || value.trim().isEmpty) ? requiredError : null,
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Expanded(child: Text(label, style: theme.textTheme.titleMedium)),
        Text(
          value,
          style: theme.textTheme.titleLarge?.copyWith(fontSize: 24),
        ),
      ],
    );
  }
}
