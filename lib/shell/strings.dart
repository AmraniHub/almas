// The few native texts of the shell, in the site's four languages.
// Arabic is Modern Standard Arabic.

class ShellStrings {
  const ShellStrings({
    required this.pressBackAgain,
    required this.offlineTitle,
    required this.offlineBody,
    required this.retry,
    required this.call,
    required this.whatsapp,
    required this.shareFailed,
    required this.rtl,
  });

  final String pressBackAgain;
  final String offlineTitle;
  final String offlineBody;
  final String retry;
  final String call;
  final String whatsapp;
  final String shareFailed;
  final bool rtl;

  static ShellStrings of(String lang) => _all[lang] ?? _all['en']!;

  static const Map<String, ShellStrings> _all = {
    'ar': ShellStrings(
      pressBackAgain: 'اضغط زر الرجوع مرة أخرى للخروج',
      offlineTitle: 'لا يوجد اتصال بالإنترنت',
      offlineBody:
          'تعذّر تحميل المتجر. تحقّق من اتصالك ثم أعد المحاولة، أو تواصل معنا مباشرة بالهاتف أو عبر واتساب.',
      retry: 'إعادة المحاولة',
      call: 'اتصل بنا',
      whatsapp: 'واتساب',
      shareFailed: 'تعذّرت المشاركة',
      rtl: true,
    ),
    'fr': ShellStrings(
      pressBackAgain: 'Appuyez de nouveau sur Retour pour quitter',
      offlineTitle: 'Pas de connexion Internet',
      offlineBody:
          "La boutique n'a pas pu se charger. Vérifiez votre connexion puis réessayez, ou contactez-nous directement par téléphone ou sur WhatsApp.",
      retry: 'Réessayer',
      call: 'Appeler',
      whatsapp: 'WhatsApp',
      shareFailed: 'Le partage a échoué',
      rtl: false,
    ),
    'en': ShellStrings(
      pressBackAgain: 'Press back again to exit',
      offlineTitle: 'No internet connection',
      offlineBody:
          "The shop couldn't load. Check your connection and try again, or contact us directly by phone or on WhatsApp.",
      retry: 'Try again',
      call: 'Call us',
      whatsapp: 'WhatsApp',
      shareFailed: 'Sharing failed',
      rtl: false,
    ),
    'es': ShellStrings(
      pressBackAgain: 'Pulse atrás otra vez para salir',
      offlineTitle: 'Sin conexión a Internet',
      offlineBody:
          'No se pudo cargar la tienda. Compruebe su conexión e inténtelo de nuevo, o contáctenos directamente por teléfono o por WhatsApp.',
      retry: 'Reintentar',
      call: 'Llamar',
      whatsapp: 'WhatsApp',
      shareFailed: 'No se pudo compartir',
      rtl: false,
    ),
  };
}
