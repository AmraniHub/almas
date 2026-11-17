import java.util.Properties

plugins {
    id("com.android.application")
    // reads android/app/google-services.json (gitignored): the Firebase project that delivers the notifications
    id("com.google.gms.google-services")
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")

if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use(keystoreProperties::load)
}

android {
    namespace = "com.almas.app"
    compileSdk = 36
    // the installed NDK (28.2): AGP needs it to strip libflutter.so in release, else the bundle ships debug symbols
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.almas.app"
        minSdk = flutter.minSdkVersion
        targetSdk = 36
        versionCode = 15
        versionName = "1.3.0"
    }

    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            isMinifyEnabled   = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }
}

dependencies {
    // notifications from the shop (order status, offers); the version already in the offline Gradle cache
    implementation("com.google.firebase:firebase-messaging:24.1.0")
}

flutter {
    source = "../.."
}
