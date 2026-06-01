# Almas – Google Play Release Checklist

Package: `com.almas.app`  
Privacy policy page: `https://amranihub.github.io/almas/privacy-policy.html`

---

## STEP 1 – Publish Privacy Policy on GitHub Pages

### 1a. Create a GitHub repository

1. Go to https://github.com/new
2. Repository name: `almas`
3. Visibility: **Public** (required for free GitHub Pages)
4. Do NOT add README / .gitignore (we already have them)
5. Click **Create repository**

### 1b. Push the project

Open a terminal in the project folder and run:

```bash
git init
git add .
git commit -m "Initial commit – Almas Flutter app"
git branch -M main
git remote add origin https://github.com/AmraniHub/almas.git
git push -u origin main
```

### 1c. Enable GitHub Pages

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` → Folder: `/docs`
4. Click **Save**
5. Wait ~1 minute, then your privacy policy will be live at:  
   `https://YOUR_GITHUB_USERNAME.github.io/almas/privacy-policy.html`

### 1d. Update the privacy policy contact details

Open `docs/privacy-policy.html` and replace:
- `REPLACE_WITH_SUPPORT_EMAIL` → your real support email (e.g. `support@almas.ma`)

Commit and push the change:

```bash
git add docs/privacy-policy.html
git commit -m "Add support email to privacy policy"
git push
```

---

## STEP 2 – Create a Release Keystore (if you don't have one yet)

Run this once. Store the `.jks` file somewhere safe (outside the project folder).  
**If you lose this keystore you can never update the app on Play.**

```bash
keytool -genkey -v -keystore upload-keystore.jks \
  -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```

Then create `android/key.properties` (already in `.gitignore`, safe):

```
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=upload
storeFile=C:\full\path\to\upload-keystore.jks
```

---

## STEP 3 – Build the Release AAB

```bash
flutter clean
flutter pub get
flutter build appbundle --release
```

Output: `build/app/outputs/bundle/release/app-release.aab`

---

## STEP 4 – Create the App on Google Play Console

1. Go to https://play.google.com/console
2. Click **Create app**
3. Fill in:
   - App name: `Almas`
   - Default language: your language
   - App or game: **App**
   - Free or paid: your choice
4. Click **Create app**

---

## STEP 5 – Store Listing

Use the content from `docs/play-console-submission.md`.

| Field | Value |
|---|---|
| App name | Almas |
| Short description | B2B spice catalog, cart, and restaurant ordering support from Almas. |
| Full description | See `docs/play-console-submission.md` |
| App icon | 512×512 PNG, no rounded corners (Play adds them) |
| Feature graphic | 1024×500 PNG |
| Phone screenshots | At least 2 screenshots (1080×1920 or similar) |

---

## STEP 6 – App Content Answers

All exact answers are in `docs/play-console-submission.md`. Summary:

| Section | Answer |
|---|---|
| Privacy policy URL | `https://YOUR_GITHUB_USERNAME.github.io/almas/privacy-policy.html` |
| Ads | No |
| App access | All functionality available without special access |
| Target audience | 18 and over |
| Content ratings questionnaire | All None / No |
| Data safety | App does not collect or share any required user data types |
| News apps | No |
| COVID-19 | No |

---

## STEP 7 – Release

1. Go to **Production** → **Create new release**
2. Upload `app-release.aab`
3. Enter release name (e.g. `1.0.0`) and release notes
4. Click **Review release** → **Start rollout to Production**

---

## STEP 8 – After Approval

- Save your `upload-keystore.jks` in a secure location (Google Drive, external drive)
- Keep `android/key.properties` locally — never commit it
- For every future update: bump `version` in `pubspec.yaml`, rebuild AAB, upload

---

## Assets Still Needed

- [ ] App icon – 512×512 PNG (`ic_launcher_almas` hi-res export)
- [ ] Feature graphic – 1024×500 PNG
- [ ] Phone screenshots – at least 2 (max 8)
- [ ] Support email address – replace `REPLACE_WITH_SUPPORT_EMAIL` in `docs/privacy-policy.html`
- [ ] Legal/company name – replace `REPLACE_WITH_LEGAL_NAME` in `docs/privacy-policy.md` if needed
