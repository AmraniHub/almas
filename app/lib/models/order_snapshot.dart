enum OrderStage {
  placed,
  confirmed,
  outForDelivery,
  delivered,
}

class OrderSnapshot {
  const OrderSnapshot({
    required this.id,
    required this.customerName,
    required this.destination,
    required this.eta,
    required this.itemCount,
    required this.total,
    required this.stage,
  });

  final String id;
  final String customerName;
  final String destination;
  final String eta;
  final int itemCount;
  final double total;
  final OrderStage stage;
}

