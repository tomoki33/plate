# App Review への返信（Guideline 2.1 — Information Needed）

App Store Connect の「アプリの審査」の返信欄と、バージョン画面「審査に関する情報」のメモ欄の両方に貼る。
画面録画は、TestFlight の**最終ビルド**で、実機・最新 iOS で撮って添付する。

```
Thank you for the review. Here is the information requested.

1. Screen recording
Attached. It was recorded on a physical iPhone running the latest iOS with the TestFlight build (see build number selected in this version). It starts from launching the app and shows: first launch -> "Start without signing in" -> onboarding -> today's target -> logging a meal (search / catalog / text estimate) -> logging a workout -> logging weight -> weekly review -> Settings -> Sign in with Apple -> AI photo estimate -> cloud backup -> restore -> account deletion.

2. Purpose and target audience
PLATE is a Japanese-language app for people who do regular strength training (about 3-5 sessions a week). Today they use one app to log workouts and another to track food, and neither knows about the other. PLATE combines them: it distributes the week's calorie budget across days according to the training schedule (more on hard training days, less on rest days) and shows the day's calorie and protein/fat/carb (PFC) targets. Users log workouts, meals, and body weight, and get a weekly review. All figures are guidance only, not medical advice (stated in the app and the Terms).

3. How to access the main features
No account or credentials are needed for the main features. Sign-in is optional and uses the reviewer's own Apple ID (no demo account needed).
- Launch the app -> tap "ログインせずに始める" (Start without signing in) -> answer the short onboarding -> the Today screen appears with today's targets.
- Log a meal: Today -> add meal -> tabs "マイセット (My sets) / 検索 (Search) / ざっくり (Rough) / AI". In the AI tab, typing text estimates foods without signing in; estimating from a PHOTO requires signing in with Apple (the app shows a "login required" message with a Login button when not signed in). The user always confirms the estimate before it is saved.
- Log a workout: Training tab -> choose a menu -> record sets.
- Log weight: Today -> weight row. Review tab shows the weekly summary.
- Sign in: Settings -> Login -> Sign in with Apple. This enables AI photo estimation and cloud backup/restore on a new device.
- Account deletion: after signing in, Settings -> bottom of the screen -> "アカウントを削除" (also under Settings -> Export/Backup/Delete).
The app is free. There are no in-app purchases and no paid content in this version.

4. External services used
- Supabase (hosted Postgres, Auth, Storage): sign-in and optional cloud backup of the user's own records and meal photos. Data is protected by row-level security so only the user can read it.
- Google Gemini API, called only through our own Supabase Edge Function (signed-in users only): estimates foods and amounts from a meal photo or text. We do not store the photo or text after the estimate.
- Sign in with Apple: the only login method.
- Apple HealthKit: read-only access to body weight and body fat percentage, only if the user allows it.
- MEXT "Standard Tables of Food Composition in Japan (8th revision)": public government data, bundled in the app for nutrition values, with attribution in the app.
- Vercel: hosts our static website (privacy policy, terms, support page) at https://plate-site-ashen.vercel.app
- Expo / EAS: build and over-the-air JavaScript updates.
The app includes the RevenueCat SDK, but it is not configured or used in this version (no purchases).

5. Regional differences
The app is Japanese-language only and is distributed in Japan only. It behaves the same for all users. The bundled food data is Japanese food composition data.

6. Regulated industry / third-party material
Not applicable. The app is not a medical device and gives no medical advice or diagnosis. There is no user-generated content shared with other users, so reporting/blocking is not applicable in this version (there are no social or sharing features).
```
