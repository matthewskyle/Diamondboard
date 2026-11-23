# Learning modes, sharing, iOS PWA platform, monetization, accessibility for Diamondboard (client-only PWA)

Research date: 2026-11-23. Most sources are from 2025–2026. Some come from search-result summaries rather than full-page reads; these are marked "(summary)". Fetched pages: firt.dev iOS PWA notes and the Baseball IQ Pro App Store listing.

## 1. Learning modes (Position Study, Quiz): how competitors do it and what learning science supports

### Takeaway
Baseball "IQ" apps already sell large banks of generic situational quizzes, with daily limits, daily challenges, progress tracking and coach/organization tiers. No app found combines a team's *own* animated playbook with quizzes on those plays. Diamondboard's clearest gap is "tap/drag where you go on this play", built from the plays the coach already has. Spaced, retrieval-based practice is the most strongly evidence-backed way to design it.

### Cited Findings
- **Baseball IQ Pro** (iPhone/iPad, free with in-app purchases): about 8,200 situational questions organized by position and topic (hitting, fielding, baserunning, pitching, catching, cutoffs, rundowns, rules). Free users get 3 games a day. It has daily challenges, progress tracking, an "AI Coach", team joins and assigned drills. In-app prices are $4.99/month, $19.99/year (Pro), Coach Standard $99.99, Coach Unlimited $249.99, Organization Starter $49.99, Organization Pro $99.99 and Organization Unlimited $199.99. Rated 4.8 from only 6 ratings, so it is new. — [App Store](https://apps.apple.com/app/id6759932185)
- **Sports Scenarios**: a quiz-style app on positions and game situations. A recent update added baseball base-running questions and a leaderboard. (summary) — [App Store](https://apps.apple.com/us/app/-/id6744585415)
- **Dead Red Sports**: a digital playbook for baseball/softball coaches with "player study" materials so players can learn signs and plays away from the field, licensed per team per season. (summary; the fetched page returned only a login portal title) — [deadredsports.leagueapps.com](https://deadredsports.leagueapps.com/)
- **Solis Baseball Positions**: teaches youth players position names and abbreviations. Few ratings. (summary) — [App Store](https://apps.apple.com/us/app/id1476105094)
- **Baseball Academics** (older): the player picks one of nine defensive positions and decides where to throw on batted balls. (summary) — [Engadget tag page](https://www.engadget.com/tag/fielding/)
- **X's & O's**: animated plays that coaches share with players. (summary) — [App Store](https://apps.apple.com/app/id6477894734)
- **Baseball Board**: a $4.99 iPad diagram tool for building and sharing plays. A newer version adds shifts and base-running plays. (summary) — [App Store](https://apps.apple.com/app/id6751254549)
- The search found no product that quizzes players on the team's own playbook. This is my reading of the search results, not an exhaustive market scan. — [search results above; e.g. App Store listings](https://apps.apple.com/app/id6759932185)
- **Retrieval practice:** the Adesope, Trevisan & Sundararajan (2017) meta-analysis in *Review of Educational Research* found practice tests beat restudying and other non-testing conditions, with test format among the moderators. (summary) — [WSU summary PDF "Rethinking the use of tests"](https://education.wsu.edu/documents/2018/01/rethinking-use-tests.pdf/)
- **Spaced retrieval:** a meta-analysis in *Educational Psychology Review* (29 studies) found a strong benefit of spaced over massed retrieval practice (g = 0.74 in subset 1). — [Springer](https://link.springer.com/10.1007/s10648-021-09595-9) (summary)
- **Spacing in math learning:** a small-to-medium effect of spaced versus massed practice (g = 0.28; 27 studies, 53 effect sizes). — [Springer](https://link.springer.com/10.1007/s10648-020-09572-8) (summary; I am not certain which of the two Springer links holds which result)
- A *Nature Reviews Psychology* review of spacing and retrieval is at [nature.com](https://www.nature.com/articles/s44159-022-00089-1) (not read in full).
- **Worked examples** (studying a solved example) can improve learning compared with more practice trials, especially early on. The review citing this refers to van Gog & Sweller (2015) and Yeo & Fazio (2019). — [PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10950551) (summary)

### Inferences
- **Suggested flow per play and position:** (1) Study mode: animate the play step by step with coaching notes, highlighting the selected position. This is the worked example. (2) Quiz mode: freeze at step N and ask "drag your player to where he goes." Score by distance to the target zone, then replay the correct move as feedback. (3) Bring missed plays back after expanding intervals, for example a simple Leitner box scheme (1, 3, 7, 14 days) stored in IndexedDB. All of this runs on the device and needs no backend.
- Streaks and per-position progress bars are common motivation tools (Duolingo pattern). I found no 2025–2026 sources specific to these features in this pass. Retrieval and spacing are what carry the learning effect, so a streak only helps to the extent it gets players to come back for spaced sessions.
- **Coach-assigned quizzes without a backend:** encode a "quiz assignment" in a share link (play IDs, position, due date). The player opens it and progress stays on the player's device. The coach cannot see results unless the player sends back a results link or screenshot. This is a real limitation to set expectations about; it is also privacy-friendly (see COPPA below).
- Diamondboard's library of about 150 plays by position is a structural advantage over generic question banks. The quiz content comes from plays the coach already uses.

### Gaps
- I did not verify how Diamond Chalk, Football IQ or Hoops IQ score answers (tap versus drag, tolerance zones). Their listings were not fetched.
- No effect size for Cepeda et al. 2006. No direct comparison of worked examples with retrieval practice for motor or tactical sport learning.
- No sources on whether streaks help or hurt youth athletes' learning.

## 2. Sharing without a backend (URL encoding, QR, Web Share, PNG/PDF/video export, files, COPPA)

### Takeaway
All the pieces exist in iOS Safari: CompressionStream (16.4+) for compact URL-fragment play links, the Web Share API with files (Share Level 2, iOS 15+), canvas/SVG to PNG export, and MediaRecorder MP4 output. Canvas recording is the riskiest piece and must be tested on real devices. A client-only design that never collects data lowers COPPA exposure, but the amended COPPA Rule has been fully in force since April 22, 2026.

### Cited Findings
- **CompressionStream:** supported in Safari and iOS Safari from 16.4 (released 2023-03-27), so it is available in every browser. — [caniuse](https://caniuse.com/mdn-api_compressionstream); [web.dev](https://web.dev/blog/compressionstreams?authuser=8); [web-features](https://web-platform-dx.github.io/web-features-explorer/features/compression-streams)
- Early Safari 16.4 builds had bugs: invalid output when compressing larger buffers, and "Extra bytes past the end" errors on decompression. These were reported as fixed afterward, but I did not confirm in which build. — [WebKit bug 254021](https://bugs.webkit.org/show_bug.cgi?id=254021); [WebKit bug 256330](https://bugs.webkit.org/show_bug.cgi?id=256330)
- **Web Share:** supported since iOS 12.1; Web Share Level 2 (files) since iOS 15.0. — [firt.dev iOS PWA notes](https://firt.dev/notes/pwa-ios/). web.dev lists `navigator.canShare()` in Safari from 14. Sharing requires HTTPS and a user gesture. web.dev recommends checking `canShare({files})` first and falling back to a download. — [web.dev Web Share](https://web.dev/articles/web-share); [web.dev share files pattern](https://web.dev/patterns/files/share-files)
- The list of permitted shareable file types (image, PDF, audio, video, text) that web.dev cites is Chromium's. I found no official WebKit list. — [web.dev](https://web.dev/articles/web-share)
- **MediaRecorder:** shipped in Safari 14.1 (macOS) and iOS 14.5, writing `video/mp4`. — [WebKit blog: MediaRecorder API](https://webkit.org/blog/11353/mediarecorder-api/). A third-party guide reports Safari 18.4 added fragmented MP4 and HEVC/AV1 where hardware supports them. (summary; secondary source) — [api.video tutorial](https://api.video/blog/tutorials/building-record-a-video-the-mediarecorder-api/)
- **Canvas captureStream:** caniuse lists iOS Safari support from 11 through 26.x. — [caniuse](https://caniuse.com/wf-capture-stream-canvas). However, older WebKit bugs report blank video when recording a canvas stream (2018, and Safari 15 in 2021). — [WebKit bug 181663](https://bugs.webkit.org/show_bug.cgi?id=181663); [WebKit bug 229611](https://bugs.webkit.org/show_bug.cgi?id=229611). A March 2025 bug reports MediaRecorder problems with `video/mp4` codec variants in the iOS 18.4 beta; I could not confirm whether it was fixed. — [WebKit bug 290002](https://bugs.webkit.org/show_bug.cgi?id=290002)
- iOS does not support Screen Capture (getDisplayMedia), so recording the screen from inside the web app is not possible. — [firt.dev](https://firt.dev/notes/pwa-ios/)
- **COPPA:** the FTC's amended COPPA Rule was published 2025-04-22 and took effect 2025-06-23. The general compliance deadline was 2026-04-22, and the FTC is prioritizing enforcement. The proposed ed-tech/school-authorization provisions were not adopted. — [Federal Register](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule); [Hunton (Apr 2026)](https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches); [Davis Polk](https://www.davispolk.com/index%2Ephp/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect); [Latham](https://www.lw.com/en/insights/2025/05/ftc-publishes-updates-to-coppa-rule)

### Inferences
- **Share-link design:** serialize the play (tokens, steps, notes) as compact JSON, compress it with `CompressionStream('deflate-raw')`, base64url-encode it, and put it in `location.hash`. The fragment is never sent to the server, which helps privacy and suits GitHub Pages. Add a version byte for schema migration. Feature-detect the API and bundle a small fallback (for example pako or fflate) for Brave/Safari edge cases.
- **QR code:** generate it client-side from the same link so a coach can show it on the iPad and players scan it in the dugout. Long links make dense QR codes. QR byte capacity is 2,953 at the lowest error correction, which is a general spec figure not verified in this pass. Keep shared plays small, or offer a `.diamondboard.json` file share as a fallback.
- **Video export:** feature-detect with `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')`. Render the SVG field to an offscreen canvas each frame, then `canvas.captureStream(30)` into MediaRecorder. Share the resulting MP4 with `navigator.share({files})` or download it. Treat video as a stretch goal; put an animated GIF or PNG-per-step export behind it as the fallback. It needs a Playwright WebKit test plus manual testing on a real device.
- **PDF export:** the simplest route is a print stylesheet plus `window.print()` (iOS offers "Save to Files/PDF"). A JS PDF library is the alternative.
- **COPPA posture:** because Diamondboard collects nothing (no accounts, analytics or server), shared links carry only play diagrams. Avoid putting player names in plays by default, or warn about it. Avoid third-party analytics and ad SDKs. A short privacy page stating "no data leaves your device" is advisable. This is not legal advice; whether COPPA applies depends on whether personal information is collected from children under 13.

### Gaps
- **URL length limits:** no source found for practical limits in iMessage, Safari or QR code links. Commonly cited figures (Safari handles very long URLs; iMessage link previews may truncate) are unverified. This needs a device test.
- Current confirmation that canvas → MediaRecorder → MP4 works on iOS 26 was not found. caniuse says it is supported, but the bug history urges caution.
- Whether iOS Safari's `canShare` accepts `application/json` or custom file types is unverified. It may only accept "known" types, so a test is needed.

## 3. iOS PWA platform constraints, 2025–2026

### Takeaway
Since Safari/iOS 17, Home Screen web apps get the same large quota as Safari (an origin can use up to about 60% of disk) and can request persistent storage, which WebKit grants by heuristics favoring installed apps. Since iOS 26, any site added to the Home Screen opens as a web app by default. Web Push works only for installed apps (16.4+; Declarative Web Push 18.4+). Brave on iOS still appears not to offer its own "Add to Home Screen", so users install via Safari. Storage is not shared between Safari and the installed app.

### Cited Findings
- **Quota parity (Safari 17 / iOS 17):** a standalone web app has the same origin and overall quota as the browser. Use `navigator.storage.persist()` / `persisted()`. WebKit grants persistence based on heuristics such as whether the site is opened as a Home Screen web app. Persistent-mode origins are excluded from eviction. — [WebKit blog: Updates to Storage Policy](https://webkit.org/?p=14403)
- **Quota figures:** MDN says the origin quota is about 60% of disk for browser apps (and Home Screen apps), the overall cap is 80% of disk for browsers, and 20% for other apps displaying web content. Before Safari 17 the initial origin quota was 1 GiB. — [MDN Storage quotas](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **7-day cap:** the ITP 7-day cap on script-writable storage applies to Safari browsing. WebKit says it does not apply to the main domain of Home Screen web apps. Sources are older and partly contested. — [iTnews 2020](https://www.itnews.com.au/news/apple-cops-flak-for-deleting-local-browser-storage-after-7-days-539833); [Apple dev forums](https://developer.apple.com/forums/thread/710157)
- **firt.dev support table:** Persistent Storage since 15.2; Storage quota API since 17; OPFS since 15.2 (writable streams since 26.0). Storage is not shared between the browser and the installed app. Login cookies are copied to the installed app since 17.2. — [firt.dev](https://firt.dev/notes/pwa-ios/)
- **Push:** Web Push since 16.4 and Declarative Web Push since 18.4, installed apps only. App Badging since 16.4 (installed only). Background Sync and Periodic Sync are not supported. — [firt.dev](https://firt.dev/notes/pwa-ios/); [WebKit: Meet Declarative Web Push](https://webkit.org/?p=16535); [WWDC25 session 235](https://developer.apple.com/videos/play/wwdc2025/235); [WebKit: Web Push for Web Apps on iOS](https://webkit.org/?p=13878)
- **iOS 26:** every site added to the Home Screen opens as a web app by default, even without a manifest. The user can toggle this off. A manifest's icons are still used, and SVG manifest icons are supported since 26.0. There is no `beforeinstallprompt`. Manifest `display` supports only `browser` and `standalone`; `orientation` is not supported. Screen Wake Lock is available in installed apps since 18.4. Pointer Events since 13.2. The Fullscreen API works on iPad only. — [firt.dev](https://firt.dev/notes/pwa-ios/)
- **Third-party browsers:** since iOS 16.4, apps can be installed from non-Safari browsers if the browser opts in. — [firt.dev](https://firt.dev/notes/pwa-ios/). Brave community threads say Brave iOS lacks a native "Add to Home Screen" for standalone web apps. The workaround is to copy the link into Safari. One unverified Sept 2026 comment claims a change. — [Brave community](https://community.brave.app/t/add-to-home-screen-as-pwa-standalone-web-app-on-ios/650126); [Brave community](https://community.brave.app/t/brave-ios-pwa-feature/648355.md)
- **EU:** Apple planned to remove Home Screen web apps in the EU with iOS 17.4 (Feb 2024), then reversed on March 1, 2024. They remain WebKit-based. — [MacRumors](https://www.macrumors.com/2024/03/01/apple-walks-back-decision-to-disable-eu-web-apps/); [9to5Mac](https://9to5mac.com/2024/02/15/ios-17-4-web-apps-european-union/)

### Inferences
- **On first launch in standalone mode,** call `navigator.storage.persist()` and show the result in settings. Also offer "Export all my plays" (a JSON file through Web Share or download) as the user's real backup, since a user deleting the Home Screen icon wipes its storage.
- **Install education:** detect Brave or non-standalone Safari (`navigator.standalone`, `display-mode: standalone`) and show "Open in Safari → Share → Add to Home Screen" instructions. Warn that plays saved in the browser tab will not appear in the installed app, because storage is separate. A share/export link can move them.
- Push is possible but needs a push server (VAPID), which conflicts with "no backend". Skip it, or use it only for local reminders if supported. Quiz reminders would need a server.
- **Apple Pencil:** use Pointer Events (`pointerType === 'pen'`, pressure). Set `touch-action: none` on the field so Safari does not pan or zoom while dragging.
- **Visual viewport and keyboard:** the step-notes text field on iPhone should use the `visualViewport` resize events to keep the field above the keyboard (general practice; no 2025–26 source fetched).

### Gaps
- No 2025–2026 source confirms the current EU status of standalone web apps (only the 2024 reversal).
- Brave iOS install status is not confirmed by an official Brave source.
- No authoritative source on whether persistence requests are auto-granted for installed apps on iOS 26 (WebKit describes heuristics only).
- Visual viewport and keyboard handling for iOS 26 was not researched in depth.

## 4. Monetization without the App Store; Capacitor wrapper and Apple rules; competitor prices

### Takeaway
Pricing in the category runs from a $4.99 one-time iPad app to about $20/year player IQ subscriptions to $100–$300/year coach and organization tiers. A client-only PWA can sell through Lemon Squeezy or Stripe and unlock features with an offline-verifiable signed license token (Ed25519 via WebCrypto, Safari 17+). Calling Lemon Squeezy's license API directly from the browser may hit CORS. A plain web wrapper on the App Store risks Guideline 4.2 rejection. US-storefront apps may link out to external purchases since May 2025.

### Cited Findings
- **Competitor prices:**
  - Baseball IQ Pro: $4.99/mo, $19.99/yr; coach $99.99–$249.99; org $49.99–$199.99. — [App Store](https://apps.apple.com/app/id6759932185)
  - Baseball Board: $4.99 (summary). — [App Store](https://apps.apple.com/app/id6751254549)
  - GameChanger: Plus $39.99/yr ($9.99/mo), Premium $99.99/yr (summary). — [GameChanger help](https://help.gc.com/hc/en-us/articles/28521445314957)
  - StrikeZone Pro: $29.99/mo or $299.99/yr (summary). — [App Store](https://apps.apple.com/app/id6739788294)
  - FastDraw (FastModel): Premium $199.99/yr, Essentials $149.99/yr (summary). — [FastModel](https://fastmodelsports.com/pages/hub-b)
  - PlayBook – Coach Tactic Board: subscription or lifetime tiers at $9.99, $69.99 and $299.99 (summary). — [App Store](https://apps.apple.com/app/id1603572641)
  - Hudl club baseball/softball pricing pages exist but were not read. — [Hudl](https://www.hudl.com/pricing/club/baseball)
- **Lemon Squeezy License API:** separate activate, validate and deactivate endpoints. Activation returns an instance ID to store; the docs recommend periodic validation; requests need `Accept: application/json`. — [LS docs: License API](https://docs.lemonsqueezy.com/api/license-api); [LS validating tutorial](https://docs.lemonsqueezy.com/guides/tutorials/license-keys). A Figma plugin developer reported calls from a `null` origin blocked by CORS (a single report). — [Figma forum](https://forum.figma.com/ask-the-community-7/cors-issues-with-create-figma-plugin-using-lemonsqueezy-for-license-management-37919)
- **Ed25519 in WebCrypto:** supported from Safari 17.0 and iOS Safari 17 (sign/export per caniuse). — [caniuse sign](https://caniuse.com/mdn-api_subtlecrypto_sign_ed25519); [caniuse verify](https://caniuse.com/mdn-api_subtlecrypto_verify_ed25519); [WICG issue](https://github.com/WICG/webcrypto-secure-curves/issues/20)
- **App Store 4.2 / 4.2.2:** developers report rejection of web-wrapped and Capacitor apps as "not sufficiently different from browsing the web," even with added native features. — [Apple forums 4.2 thread](https://developer.apple.com/forums/thread/835422); [Apple forums (Capacitor/PWA)](https://developer.apple.com/forums/thread/829592); [MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- **US external links:** after the April 30, 2025 Epic v. Apple injunction, Apple updated guideline 3.1.1(a) on May 1, 2025. US-storefront apps may include buttons, external links or other calls to action for outside purchase without an entitlement. This applies only to the US storefront. — [MacRumors](https://www.macrumors.com/2025/05/01/apple-updates-u-s-app-review-guidelines-epic/); [9to5Mac](https://9to5mac.com/2025/05/01/apple-app-store-guidelines-external-links/); [AppleInsider](https://appleinsider.com/articles/25/05/02/apples-app-store-guidelines-updated-to-reflect-court-order-over-external-purchases)

### Inferences
- **Recommended model:** a free core whiteboard plus a generous library sample, with a one-time "Coach Pro" unlock (roughly $9.99–$29.99) and an optional "Team pack" license (one purchase, N devices: the coach shares a code with players). This undercuts $100+/yr coach tiers and fits a no-backend app, because there is no recurring server cost to justify a subscription.
- **Client-only licensing:** at checkout, a small serverless webhook signs `{product, seats, email-hash, issuedAt}` with an Ed25519 private key. The PWA bundles only the public key and verifies offline with `crypto.subtle.verify('Ed25519', …)`. This needs one tiny serverless function; otherwise use Lemon Squeezy's license key and validate it from the browser if CORS allows (test it first). Any client-side check can be bypassed by a determined user; for a $10–30 coaching app that is an acceptable trade-off.
- **Capacitor:** to be accepted, an App Store build would need real native value (Pencil, file import, offline video export, widgets). It would also have to decide between IAP and a US-only external link. Treat it as post-launch; the PWA alone avoids the 15–30% commission.

### Gaps
- No pricing found for Diamond Chalk, Playmaker, Hudl Sideline or CoachTube baseball courses.
- No confirmation from Lemon Squeezy docs on browser CORS for the License API.
- Whether Lemon Squeezy (acquired by Stripe in 2024; general knowledge, not verified here) remains the recommended merchant of record was not checked. Stripe Payment Links plus a webhook is the alternative.
- The status of Apple's appeal of the injunction as of late 2026 was not checked.

## 5. Accessibility and Spanish-language support

### Takeaway
I found no category-specific sources in this pass. The recommendations below come from general platform knowledge and are flagged as unsourced.

### Cited Findings
- Pointer Events are supported in iOS Safari since 13.2, and touch events since 2.0. This makes a single pointer-handling path feasible for finger, Pencil and mouse. — [firt.dev](https://firt.dev/notes/pwa-ios/)

### Inferences
- Draggable SVG tokens need keyboard and VoiceOver alternatives: a selected token moved with arrow keys or a "move to" list, `aria-label`s like "Shortstop, step 2", and quiz answers available by choosing from a list as well as by dragging (WCAG 2.2 SC 2.5.7 "Dragging Movements" requires a single-pointer alternative to dragging; this is general knowledge, not fetched here).
- **Colour:** do not rely on red/blue team colours alone. Add position letters or shapes.
- **Spanish:** many youth and amateur baseball/softball players in the US and Latin America speak Spanish. Externalize strings early (react-i18next or a small dictionary), give each library play's names and notes `en`/`es` fields, and respect `navigator.language`. Baseball Spanish vocabulary (for example "jardinero central", "relevo", "doble matanza") should be reviewed by a native-speaking coach.

### Gaps
- No sources fetched on Spanish-speaking coach demographics, competitor localization, or WCAG drag requirements. A dedicated pass is needed if this matters for launch.
