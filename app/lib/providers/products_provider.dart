import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/demo_data.dart';
import '../models/product.dart';

// Currently returns demo data.
// TODO: swap to Firestore stream after Firebase setup:
//   final productsProvider = StreamProvider<List<Product>>((ref) =>
//     FirestoreService.productsStream());
final productsProvider = Provider<List<Product>>((ref) => demoProducts);
