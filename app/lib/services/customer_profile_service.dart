import 'package:shared_preferences/shared_preferences.dart';

/// The buyer's delivery identity, reused to pre-fill checkout so restaurants
/// and hotels can place repeat orders in seconds.
class CustomerProfile {
  const CustomerProfile({
    this.businessName = '',
    this.phone = '',
    this.address = '',
  });

  final String businessName;
  final String phone;
  final String address;

  bool get isComplete =>
      businessName.trim().isNotEmpty &&
      phone.trim().isNotEmpty &&
      address.trim().isNotEmpty;
}

/// Persists the buyer's delivery details locally (no backend, no account).
class CustomerProfileService {
  static const _kName = 'customer_business_name';
  static const _kPhone = 'customer_phone';
  static const _kAddress = 'customer_address';

  static Future<CustomerProfile> load() async {
    final prefs = await SharedPreferences.getInstance();
    return CustomerProfile(
      businessName: prefs.getString(_kName) ?? '',
      phone: prefs.getString(_kPhone) ?? '',
      address: prefs.getString(_kAddress) ?? '',
    );
  }

  static Future<void> save(CustomerProfile profile) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kName, profile.businessName.trim());
    await prefs.setString(_kPhone, profile.phone.trim());
    await prefs.setString(_kAddress, profile.address.trim());
  }
}
