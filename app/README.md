# Almas

`Almas` is a design-led Flutter storefront for restaurant buyers ordering premium spices and herbs in Morocco.

## Current scope

- Premium customer experience with a differentiated brand system
- Product discovery, cart drafting, order tracking, admin snapshot, and profile screens
- Mock data only, ready for Firebase or another backend later

## Design direction

- Warm editorial palette inspired by saffron, terracotta, olive, and parchment
- High-contrast typography pairing for premium positioning
- Layered glass panels, ambient gradients, and dense but readable operational layouts

## Next implementation steps

1. Connect authentication and customer profiles
2. Replace demo data with Firestore collections
3. Add real localization resources for Arabic and French
4. Wire checkout, notifications, and invoice generation

## Bootstrap after Flutter install

Run these commands from the project root once `flutter` is available on `PATH`:

```powershell
flutter create --platforms=android,web .
flutter pub get
flutter test
flutter analyze
```

## Android Studio Gradle workflow

If you want Android Studio to show `Sync Project with Gradle Files`, open:

`C:\Users\Elamr\Music\APPS\Android Apps\Almas\android`

Notes:

- The Gradle Android project now lives under `android/`.
- `android/local.properties` already points `sdk.dir` to your local Android SDK.
- You still need to install Flutter and update `flutter.sdk` in `android/local.properties` to your real Flutter SDK path before Gradle sync can complete successfully.
