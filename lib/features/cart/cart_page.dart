import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/cart_item.dart';
import '../../models/product.dart';
import '../../services/contact_service.dart';
import '../../services/firebase_service.dart';
import '../../services/payment/cashplus_service.dart';
import '../../services/payment/stripe_service.dart';
import '../../widgets/glass_panel.dart';
import '../../widgets/section_header.dart';

// ── Payment method enum ───────────────────────────────────────────────────────

enum _PayMethod { cod, cashplus, stripe }

// ── Cart page ─────────────────────────────────────────────────────────────────

class CartPage extends StatelessWidget {
  const CartPage({
    required this.items,
    required this.onIncrement,
    required this.onDecrement,
    required this.onBrowseCatalog,
    super.key,
  });

  final List<CartItem> items;
  final ValueChanged<Product> onIncrement;
  final ValueChanged<Product> onDecrement;
  final VoidCallback onBrowseCatalog;

  @override
  Widget build(BuildContext context) {
    final subtotal    = items.fold<double>(0, (s, i) => s + i.lineTotal);
    const minimum     = 250.0;
    final deliveryFee = items.isEmpty ? 0.0 : subtotal >= 500 ? 0.0 : 35.0;
    final total       = subtotal + deliveryFee;
    final progress    = subtotal == 0 ? 0.0 : (subtotal / minimum).clamp(0.0, 1.0);
    final qualifies   = subtotal >= minimum;

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader(title: 'Order draft'),
            if (items.isEmpty)
              _EmptyCart(onBrowseCatalog: onBrowseCatalog)
            else
              Column(
                children: [
                  _CartLines(
                    items: items,
                    onIncrement: onIncrement,
                    onDecrement: onDecrement,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _OrderSummaryPanel(
                    items:        items,
                    subtotal:     subtotal,
                    deliveryFee:  deliveryFee,
                    total:        total,
                    minimum:      minimum,
                    progress:     progress,
                    qualifies:    qualifies,
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

// ── Empty cart ────────────────────────────────────────────────────────────────

class _EmptyCart extends StatelessWidget {
  const _EmptyCart({required this.onBrowseCatalog});
  final VoidCallback onBrowseCatalog;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GlassPanel(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
        child: Column(
          children: [
            Container(
              width: 86, height: 86,
              decoration: BoxDecoration(
                color: AppColors.saffron.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.shopping_bag_outlined, size: 36, color: AppColors.saffron),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('No order draft yet', style: theme.textTheme.headlineMedium),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Start from the catalog and build a restaurant order.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton.icon(
              onPressed: onBrowseCatalog,
              icon: const Icon(Icons.storefront_rounded),
              label: const Text('Open catalog'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Cart lines ────────────────────────────────────────────────────────────────

class _CartLines extends StatelessWidget {
  const _CartLines({
    required this.items,
    required this.onIncrement,
    required this.onDecrement,
  });
  final List<CartItem> items;
  final ValueChanged<Product> onIncrement;
  final ValueChanged<Product> onDecrement;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: items.map((item) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.md),
        child: _CartLineCard(
          item: item,
          onIncrement: () => onIncrement(item.product),
          onDecrement: () => onDecrement(item.product),
        ),
      )).toList(),
    );
  }
}

class _CartLineCard extends StatelessWidget {
  const _CartLineCard({
    required this.item,
    required this.onIncrement,
    required this.onDecrement,
  });
  final CartItem item;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 58, height: 58,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: item.product.accentColor.withValues(alpha: 0.14),
                ),
                child: Icon(Icons.spa_rounded, color: item.product.accentColor),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.product.name, style: theme.textTheme.titleLarge),
                    Text(item.product.packSize, style: theme.textTheme.bodyMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${item.product.price.toStringAsFixed(0)} MAD each',
                      style: theme.textTheme.labelLarge?.copyWith(
                          color: item.product.accentColor),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              IconButton.filledTonal(onPressed: onDecrement, icon: const Icon(Icons.remove_rounded)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                child: Text('${item.quantity}', style: theme.textTheme.titleLarge),
              ),
              IconButton.filledTonal(onPressed: onIncrement, icon: const Icon(Icons.add_rounded)),
              const Spacer(),
              Text(
                '${item.lineTotal.toStringAsFixed(0)} MAD',
                style: theme.textTheme.titleLarge?.copyWith(fontSize: 24),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Order summary + payment selector ─────────────────────────────────────────

class _OrderSummaryPanel extends StatefulWidget {
  const _OrderSummaryPanel({
    required this.items,
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.minimum,
    required this.progress,
    required this.qualifies,
  });

  final List<CartItem> items;
  final double subtotal, deliveryFee, total, minimum, progress;
  final bool   qualifies;

  @override
  State<_OrderSummaryPanel> createState() => _OrderSummaryPanelState();
}

class _OrderSummaryPanelState extends State<_OrderSummaryPanel> {
  _PayMethod _method   = _PayMethod.cod;
  bool       _loading  = false;

  // ── COD via WhatsApp ──────────────────────────────────────────────────────

  Future<void> _confirmCod() async {
    FirebaseService.trackWhatsAppOrder(widget.subtotal, widget.items.length);
    await ContactService.orderWhatsApp(widget.items);
  }

  // ── CashPlus ──────────────────────────────────────────────────────────────

  Future<void> _confirmCashPlus() async {
    setState(() => _loading = true);
    final orderId = 'ALM-${DateTime.now().millisecondsSinceEpoch}';
    final code = await CashPlusService.generateCode(
      amountMad: widget.total,
      orderId:   orderId,
    );
    setState(() => _loading = false);

    if (!mounted) return;
    if (code == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not generate CashPlus code. Try again.')),
      );
      return;
    }
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CashPlusSheet(code: code),
    );
  }

  // ── Stripe ────────────────────────────────────────────────────────────────

  Future<void> _confirmStripe() async {
    setState(() => _loading = true);
    final orderId = 'ALM-${DateTime.now().millisecondsSinceEpoch}';
    final result = await StripeService.pay(
      amountMad:     widget.total,
      orderId:       orderId,
      customerEmail: 'client@restaurant.ma',
    );
    setState(() => _loading = false);
    if (!mounted) return;

    if (result.isSuccess) {
      FirebaseService.logEvent('stripe_payment_success', {
        'order_id': orderId,
        'total':    widget.total,
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Payment confirmed! ✓ Your order is being prepared.'),
          backgroundColor: AppColors.success,
        ),
      );
    } else if (result.isError) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.message ?? 'Payment failed')),
      );
    }
  }

  Future<void> _onConfirm() async {
    switch (_method) {
      case _PayMethod.cod:       await _confirmCod();
      case _PayMethod.cashplus:  await _confirmCashPlus();
      case _PayMethod.stripe:    await _confirmStripe();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Totals ──────────────────────────────────────────────────────
          Text('Checkout summary', style: theme.textTheme.headlineMedium),
          const SizedBox(height: AppSpacing.lg),
          _SummaryRow(label: 'Subtotal', value: '${widget.subtotal.toStringAsFixed(0)} MAD'),
          const SizedBox(height: AppSpacing.sm),
          _SummaryRow(
            label: widget.deliveryFee == 0 ? 'Delivery' : 'Delivery fee',
            value: widget.deliveryFee == 0
                ? 'Included'
                : '${widget.deliveryFee.toStringAsFixed(0)} MAD',
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: Divider(),
          ),
          _SummaryRow(
            label:    'Total',
            value:    '${widget.total.toStringAsFixed(0)} MAD',
            emphasize: true,
          ),

          // ── Minimum progress ─────────────────────────────────────────────
          const SizedBox(height: AppSpacing.lg),
          Text('Minimum order progress', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
            child: LinearProgressIndicator(
              minHeight: 10,
              value: widget.progress,
              backgroundColor: AppColors.ink.withValues(alpha: 0.06),
              color: widget.qualifies ? AppColors.success : AppColors.warning,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            widget.qualifies
                ? 'Ready — choose a payment method below.'
                : 'Add ${(widget.minimum - widget.subtotal).toStringAsFixed(0)} MAD more to reach the 250 MAD minimum.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: widget.qualifies ? AppColors.success : AppColors.warning,
            ),
          ),

          // ── Payment method selector ───────────────────────────────────────
          if (widget.qualifies) ...[
            const SizedBox(height: AppSpacing.xl),
            Text('Payment method', style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.md),
            _PayMethodTile(
              value: _PayMethod.cod,
              group: _method,
              icon: Icons.local_shipping_rounded,
              color: AppColors.success,
              title: 'Cash on Delivery (COD)',
              subtitle: 'Pay in cash when your order arrives.',
              onChanged: (v) => setState(() => _method = v!),
            ),
            const SizedBox(height: AppSpacing.sm),
            _PayMethodTile(
              value: _PayMethod.cashplus,
              group: _method,
              icon: Icons.pin_rounded,
              color: AppColors.saffron,
              title: 'CashPlus — CP Code',
              subtitle: 'Get a CP code and pay at any CashPlus agent.',
              onChanged: (v) => setState(() => _method = v!),
            ),
            const SizedBox(height: AppSpacing.sm),
            _PayMethodTile(
              value: _PayMethod.stripe,
              group: _method,
              icon: Icons.credit_card_rounded,
              color: AppColors.info,
              title: 'Card (Stripe)',
              subtitle: 'Visa / Mastercard — secure online payment.',
              onChanged: (v) => setState(() => _method = v!),
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _loading ? null : _onConfirm,
                icon: _loading
                    ? const SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(_methodIcon),
                label: Text(_loading ? 'Processing...' : _methodLabel),
              ),
            ),
          ] else ...[
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.add_shopping_cart_rounded),
                label: Text(
                  'Add ${(widget.minimum - widget.subtotal).toStringAsFixed(0)} MAD more',
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  IconData get _methodIcon => switch (_method) {
        _PayMethod.cod      => Icons.chat_rounded,
        _PayMethod.cashplus => Icons.pin_rounded,
        _PayMethod.stripe   => Icons.credit_card_rounded,
      };

  String get _methodLabel => switch (_method) {
        _PayMethod.cod      => 'Order via WhatsApp (COD)',
        _PayMethod.cashplus => 'Get CashPlus CP Code',
        _PayMethod.stripe   => 'Pay by Card',
      };
}

// ── Payment method tile ───────────────────────────────────────────────────────

class _PayMethodTile extends StatelessWidget {
  const _PayMethodTile({
    required this.value,
    required this.group,
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onChanged,
  });

  final _PayMethod value, group;
  final IconData icon;
  final Color color;
  final String title, subtitle;
  final ValueChanged<_PayMethod?> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme    = Theme.of(context);
    final selected = value == group;

    return GestureDetector(
      onTap: () => onChanged(value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: selected
              ? color.withValues(alpha: 0.10)
              : AppColors.white.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(AppSpacing.panelRadius),
          border: Border.all(
            color: selected ? color : AppColors.outline,
            width: selected ? 1.5 : 1,
          ),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        child: Row(
          children: [
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: selected ? color : null,
                      )),
                  Text(subtitle, style: theme.textTheme.bodyMedium),
                ],
              ),
            ),
            // ignore: deprecated_member_use
            Radio<_PayMethod>(
              value: value,
              // ignore: deprecated_member_use
              groupValue: group,
              // ignore: deprecated_member_use
              onChanged: onChanged,
              activeColor: color,
            ),
          ],
        ),
      ),
    );
  }
}

// ── CashPlus bottom sheet ─────────────────────────────────────────────────────

class _CashPlusSheet extends StatelessWidget {
  const _CashPlusSheet({required this.code});
  final CashPlusCode code;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surfaceStrong,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.outline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: AppColors.saffron.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.pin_rounded, color: AppColors.saffron, size: 32),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('Your CashPlus Code', style: theme.textTheme.headlineMedium),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Go to any CashPlus agent and give them this code with the exact amount.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.xl),

            // ── CP Code display ────────────────────────────────────────────
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: code.code));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Code copied to clipboard')),
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.xl,
                  vertical: AppSpacing.lg,
                ),
                decoration: BoxDecoration(
                  color: AppColors.saffron.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(AppSpacing.panelRadius),
                  border: Border.all(color: AppColors.saffron.withValues(alpha: 0.4)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      code.code,
                      style: theme.textTheme.headlineLarge?.copyWith(
                        color: AppColors.saffron,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 3,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    const Icon(Icons.copy_rounded, color: AppColors.saffron, size: 20),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // ── Amount + expiry ────────────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _InfoChip(
                  icon: Icons.payments_rounded,
                  label: '${code.amount.toStringAsFixed(0)} MAD',
                  color: AppColors.success,
                ),
                const SizedBox(width: AppSpacing.sm),
                _InfoChip(
                  icon: Icons.schedule_rounded,
                  label: 'Expires ${code.formattedExpiry}',
                  color: AppColors.warning,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),

            // ── Instructions ───────────────────────────────────────────────
            _Instruction(step: '1', text: 'Go to any CashPlus agent near you'),
            _Instruction(step: '2', text: 'Show the code: ${code.code}'),
            _Instruction(step: '3', text: 'Pay ${code.amount.toStringAsFixed(0)} MAD in cash'),
            _Instruction(step: '4', text: 'Your order ships once payment is confirmed'),
            const SizedBox(height: AppSpacing.xl),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.check_circle_rounded),
                label: const Text('Got it'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: AppSpacing.xs),
          Text(label, style: TextStyle(color: color, fontSize: 13)),
        ],
      ),
    );
  }
}

class _Instruction extends StatelessWidget {
  const _Instruction({required this.step, required this.text});
  final String step, text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(
              color: AppColors.saffron.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(step,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: AppColors.saffron,
                    fontWeight: FontWeight.bold,
                  )),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(child: Text(text, style: theme.textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

// ── Summary row ───────────────────────────────────────────────────────────────

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });
  final String label, value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Expanded(
          child: Text(label,
              style: emphasize
                  ? theme.textTheme.titleMedium
                  : theme.textTheme.bodyMedium),
        ),
        Text(value,
            style: emphasize
                ? theme.textTheme.titleLarge?.copyWith(fontSize: 24)
                : theme.textTheme.titleMedium),
      ],
    );
  }
}
