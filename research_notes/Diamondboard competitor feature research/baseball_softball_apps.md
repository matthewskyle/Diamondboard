# Baseball/Softball Coaching Whiteboard and Defensive-Situation Apps: Competitor Inventory (as of Nov 2026)

Research date: 2026-11-23. Method: web search plus fetches of App Store listings and developer sites (about 20 tool calls). The Apple listing pages often returned 404 to the fetcher, so some data comes from search snippets, as flagged inline. Google Play listings were not fetched, so Android ratings are a gap.

## Which apps exist in this niche, and what does each offer?

### Takeaway
The niche splits into four groups. (1) Hand-drawn whiteboards: Baseball Board ($4.99), Baseball Board - Tactics (freemium), Pitch MetRx whiteboard, Baseball Blueprint Clipboard, and the abandoned Baseball WhiteBoard. (2) Animated defensive playbooks and libraries: Simple Fielding, Dugout Edge Digital Chalkboard, InMotion Playbooks, Softball Instincts, X's & O's, DiamondPlay. (3) Quiz and "game IQ" trainers: The Baseball Mind, BASIQs, Freeze Baseball, Thinking Baseball. (4) Multi-sport tactic boards that don't cover baseball (TacticalPad). The closest direct competitor to Diamondboard is **Simple Fielding**: a free, account-free, browser-based youth baseball and softball defense whiteboard with 80+ plays, step builder, link sharing, lessons, and softball slap and look-back content, whose native iOS app is "coming soon."

### Cited Findings

**Names in the brief that could not be found**
- I could not find any app named "Diamond Chalk." A search returned only unrelated apps (chartIT game charting by Diamond Scouting Ltd, Diamond: Baseball Stats, Diamond Coach Pro at $7.49 for roster, drills and scheduling, DiamondTrax, Dominate the Diamond) — [search results incl. chartIT](https://apps.apple.com/app/id1545479626), [Diamond Coach Pro](https://apps.apple.com/us/app/id6747611350)
- Searches for "Coach Tube," "Pro Baseball Whiteboard," and "Baseball Situations" apps returned no matching apps. See Gaps.

**1. Simple Fielding** (simplefielding.com, open repo github.com/mrthames/simple-fielding). This is the closest direct competitor.
- Platform: browser on iPad, phone, or laptop with no download. iPhone/iPad and Google Play apps are listed as "coming soon" — [simplefielding.com](https://simplefielding.com/)
- Price: free, with no ads, accounts, subscriptions, or tracking. Funded by a "buy me a coffee" link — [simplefielding.com](https://simplefielding.com/)
- Core model: drag the ball from home to where it is hit, and all nine fielders move to their jobs. A play engine works out each job from the situation rather than using fixed canned plays — [simplefielding.com](https://simplefielding.com/), [GitHub](https://github.com/mrthames/simple-fielding)
- Situation setup: runners, outs, batter (righty, lefty, softball slapper), and infield depth. Hit types: ground ball, liner, fly, pop-up, bunt — [simplefielding.com](https://simplefielding.com/)
- Library: the site says 80+ ready-made plays. The repo says 86 plays in 11 groups, some limited to softball or the 90 ft field. Groups cover singles through triples, foul pops, bunts, steals, leads and pickoffs, infield-in, passed balls, and rundowns — [simplefielding.com](https://simplefielding.com/), [GitHub](https://github.com/mrthames/simple-fielding)
- Animation: 2D with flight arcs, throws, scrubbing, replay, and chalk-line paths. Each level plays at its own pace. Playback is also available in 3D, and a "ride along" view shows the play from any player's perspective — [GitHub](https://github.com/mrthames/simple-fielding), [simplefielding.com](https://simplefielding.com/)
- Roles are color-coded on screen: who fields the ball, cutoff or relay, base cover, backup — [simplefielding.com](https://simplefielding.com/)
- Notes and explanations: tap a player to see their job in plain language and where to look. Single-player focus mode. Guide pages for all nine positions, plus written articles on cutoffs, backups, bunt defense, pop-up priority, rundowns, and practice planning — [simplefielding.com](https://simplefielding.com/)
- Learning: an "Ask first" pause stops at the hit so players can answer "where do you go?" Fielding Lessons are separate baseball and softball courses by position, from T-ball and 8U up. The player drags himself to a spot, is graded on direction, then watches the play. Lessons also cover calling outs and sportsmanship — [simplefielding.com](https://simplefielding.com/)
- Custom plays: a step-by-step builder (including mistakes and endings), runner lead and steal settings, and a whiteboard mode to freeze, move, and draw with finger or Apple Pencil — [simplefielding.com](https://simplefielding.com/), [GitHub](https://github.com/mrthames/simple-fielding)
- Field and level variants: baseball levels are Little League (60 ft, no leadoffs), 50/70 (leadoffs allowed), 13U–14U, HS, college, and pro. Softball runs from 8U coach pitch through college. Outfield shapes cover every MLB park, famous historic parks, and the LLWS stadiums — [simplefielding.com](https://simplefielding.com/), [GitHub](https://github.com/mrthames/simple-fielding)
- Softball-specific content: slapper and slap defense, the look-back rule, delayed steal, dropped third strike — [simplefielding.com](https://simplefielding.com/)
- Sharing and team: share any play as a link. Plays save on the device. A local roster puts players' names and numbers on the field. Projector/TV mode for team walk-throughs — [simplefielding.com](https://simplefielding.com/)
- Tech: plain HTML/CSS/JS with SVG, no framework or build step. Tests use node:test and Playwright on GitHub Actions. License is PolyForm Noncommercial 1.0.0. The repo shows 82 commits, 0 stars, and no last-commit date. The content does not say whether it is a PWA or works offline — [GitHub](https://github.com/mrthames/simple-fielding)

**2. Dugout Edge Digital Chalkboard** (dugoutedge.com/chalkboard)
- Free, no account needed, and still labeled "Beta." It runs in any browser with touch or mouse — [Dugout Edge](https://www.dugoutedge.com/chalkboard)
- Drag all nine fielders and add runners. Animation offers full-sequence Play and a frame-by-frame step-through, with ball paths for grounders, liners, and flies, runner lines, and animated fielder positioning — [Dugout Edge](https://www.dugoutedge.com/chalkboard)
- 50+ prebuilt plays: nobody on, runners on 1B/2B/3B, multiple runners, bunt defense, pickoffs, rundowns — [Dugout Edge](https://www.dugoutedge.com/chalkboard)
- Softball: the page says the same plays apply. Softball coaches build custom plays in Free Draw — [Dugout Edge](https://www.dugoutedge.com/chalkboard)
- Separate Baseball IQ and Softball IQ quiz tools with random situations — [Dugout Edge](https://www.dugoutedge.com/chalkboard)
- Saving custom plays, playbooks, roster, and schedule require a Premium account (price not listed). No file export or notes are mentioned — [Dugout Edge](https://www.dugoutedge.com/chalkboard)

**3. Baseball Board** (Sean Farrell, iPad, $4.99, App Store id6751254549)
- Drag-and-drop magnets for each defensive position, optional movement arrows, and text boxes. Exports PNG or PDF (added in v4.0). Requires iPadOS 17.6+. The listing shows about 2–3 ratings. *Source is search snippets; the listing page itself returned 404 to the fetcher* — [App Store via search](https://apps.apple.com/us/app/baseball-board/id6751254549), [support site](https://sites.google.com/view/baseballboard/home), [AppAdvice](https://appadvice.com/app/baseball-board/6751254549)
- No animation or play library is mentioned in the snippets — same sources.

**4. Baseball Board - Tactics** (zhenyu song / Zach Song, App Store id6763575410)
- Free with ads. IAP: Remove Ads yearly $2.99, Remove Ads $6.99. A one-time Pro Lifetime purchase removes ads and unlocks the full drill library — [App Store](https://apps.apple.com/app/id6763575410)
- iOS/iPadOS 15.5+, Mac (M1), visionOS. 14 languages. Version 2.1.0 is dated "October 25" (likely 2026, given the app ID range). Not enough ratings to show a score — [App Store](https://apps.apple.com/app/id6763575410)
- Step animation: tap Play to animate player movement step by step, **with a note on each step that changes as the play runs.** This is the closest match to Diamondboard's per-step coaching notes — [App Store](https://apps.apple.com/app/id6763575410)
- Drawing: arrows, lines, and zones in straight, curved, wavy, solid, or dashed styles. Text notes on the board — [App Store](https://apps.apple.com/app/id6763575410)
- Library: 40 animated drills with coaching notes, filterable by category, level, and group size. Formations cover shifts, base running, bunt defense, cut-offs, and pitcher coverage. Six ready practice sessions, practice plans, session history, and squad rosters with photos and attendance — [App Store](https://apps.apple.com/app/id6763575410)
- Export to PNG, PDF, or **video**. Share a board as a **browser link that needs no app**. AirPlay to TV — [App Store](https://apps.apple.com/app/id6763575410)
- Works offline, no account required (optional Apple/Google sign-in for sync), undo/redo up to 50 steps, Apple Pencil, iPad keyboard shortcuts, dark theme. Softball is not mentioned — [App Store](https://apps.apple.com/app/id6763575410)

**5. X's & O's** (xsandos.team)
- Baseball only. iOS/iPadOS 15.6+ on iPhone, iPad, and iPod touch. Android and web are not mentioned — [xsandos.team](https://xsandos.team/)
- Real-time play animation showing movement, timing, and positioning. Coaches place fielders and runners and organize plays into playbooks by situation or game — [xsandos.team](https://xsandos.team/)
- Coaches send plays to each player's phone in the app. Players watch animated breakdowns for their own position. Multiple teams, each with a roster and playbooks — [xsandos.team](https://xsandos.team/)
- Pricing, prebuilt library, quizzes, offline use, and export are not stated — [xsandos.team](https://xsandos.team/)

**6. InMotion Playbooks** (inmotionplaybooks.com)
- Softball membership: 300+ animated defensive rotations ("entire animated defensive playbook"), plus video library and drills. $9.95/month or $74.95/year. A separate baseball membership exists. Team, league, and academy discounts are offered — [InMotion softball membership](https://inmotionplaybooks.com/softball-membership-page/)
- The Facebook page says it now works on mobile devices — [Facebook](https://www.facebook.com/InMotionplaybooks/)
- Older "InMotion Baseball/Softball Playbook" iOS apps appear only on download mirrors. They are likely legacy apps — [soft112 baseball](https://baseball-digital-playbook-90-bases-ios.soft112.com/), [soft112 softball](https://inmotion-softball-digital-playbook-ios.soft112.com/)

**7. Softball Instincts** (coach.softballinstincts.com)
- Web login on phone, tablet, or computer. 70+ prebuilt plays: cutoffs, relays, double cuts, bunt defense, first-and-third, bases loaded, rundowns, pickoffs, pop-up priorities — [Softball Instincts](https://coach.softballinstincts.com/)
- Move, Draw, Erase, and Marker tools. Screen-record play breakdowns. Videos can be attached to plays on the higher plan — [Softball Instincts](https://coach.softballinstincts.com/)
- Pricing: Coach + Player $297/yr ($147 founding rate). Just Coach $147/yr ($97 founding rate). 7-day trial. The FAQ's trial-charge amount is inconsistent with the listed prices — [Softball Instincts](https://coach.softballinstincts.com/)
- Shares view-only plays with up to 15 players or parents per team, plus assistant coaches. Aimed at 8U–14U, rec through HS and travel. Slap plays are not mentioned — [Softball Instincts](https://coach.softballinstincts.com/)

**8. Pitch MetRx Coach's Whiteboard**
- A feature inside the Pitch MetRx subscription ($15/month or $99/year, 14-day trial), alongside pitch charting and wristband play-call cards — [Pitch MetRx](https://www.pitchmetrx.com/coaches-whiteboard/)
- One-tap switch between baseball and softball fields. Drag defense, runners, and batter. Movement "tracers" draw colored paths as you drag. Animation and save/share are not mentioned — [Pitch MetRx](https://www.pitchmetrx.com/coaches-whiteboard/)

**9. Baseball Blueprint** (App Store id969900832)
- Free. iPhone/iPad, with a Google Play link. 116+ drills with video and 38+ defensive strategies (the search snippet says "135+ drills and strategies") — [Baseball Blueprint](https://baseballblueprint.com/m/), [App Store](https://apps.apple.com/us/app/baseball-blueprint/id969900832)
- A Clipboard tool for drawing and saving diagrams. Share by email, text, Facebook, or Twitter. No animation is mentioned. Last update is unknown. A separate Softball Blueprint company sells desktop software for animated plays with PDF playbook export — [Baseball Blueprint](https://baseballblueprint.com/m/), [Softball Blueprint](https://www.softballblueprints.com/)

**10. DiamondPlay** (diamondplayapp.com)
- Describes itself as animated defensive playbooks, team board, practice, and game day for youth baseball and softball. The site content didn't load, so details are unverified — [search snippet](https://www.diamondplayapp.com/)

**11. Bravara free softball tools**
- A free softball playmaker and a library of 22 animated fastpitch plays, aimed at iPad use at practice and on game day (search snippet only) — [Bravara](https://bravara.com/softball-coaching-tools)

**Quiz and IQ apps (overlap with the planned Position Study and Quiz)**
- **The Baseball Mind**: 1,100+ defensive situations across all 9 positions, at three difficulty levels (Medium and Hard add runners, outs, score, and inning). Field diagrams show the play after you answer. Free Daily Challenge (3 per day), Smart Practice that resurfaces misses, and Baseball IQ trivia. "Coach Rules" is coming soon. Free plus Premium (price not listed), ad-free, COPPA-aware. iPhone, Android, and web. Ages 6+, with 12 progression levels from Tee Ball to Hall of Fame. "Team tools on the way." Softball is not mentioned — [thebaseballmind.com](https://www.thebaseballmind.com/)
- **BASIQs Softball** (and Baseball): free app with a paid Coaches' Console. Version 1.3.0 is dated 11/24/2021, so it is **likely abandoned or stagnant**. 3.3★ from 66 ratings. 7,000+ animated defensive situations, MC/TF questions, coach-made custom games, team codes, and leaderboards. Complaints: repetitive questions after about 10 minutes, wrong or duplicate answers, sign-up friction with a child's birthday and email, a 2024 blank green screen bug, slow developer responses — [App Store](https://apps.apple.com/us/app/basiqs-softball/id1034912896), [basiqs.com](https://basiqs.com/)
- **Freeze Baseball**: $1.99 one-time, with no subscription, ads, or IAP. iOS and Android. Random situation (outs, runners, hit zone): the ball travels, the play freezes, and the player drags all 9 defenders to their targets. A "Why" panel shows each position's role and explanation. Progress tracking is stored locally. Built for 10U–12U. No bunt, steal, or passed-ball drills yet. Softball is not mentioned — [freezebaseball.com](https://freezebaseball.com/)
- **Thinking Baseball**: claims 8,000+ defensive scenarios for all positions. Whether it animates is not stated (search snippet) — [thinkingbaseball.com](https://thinkingbaseball.com/)

**Generic and abandoned boards**
- **Baseball WhiteBoard** (Ron DiNapoli): free. Last update v2.5 on Aug 1, 2017, so it is **abandoned**. 1.0★ from 1 rating. Drag players and ball, 3 pens, trailing lines, iCloud save, AirPrint. Complaints about poor navigation, no tutorial, and no custom text — [App Store](https://apps.apple.com/app/id317282434)
- **TacticalPad Coach's Whiteboard** (Temma Software): 4.7★ from 1.2K ratings. Updated Jan 2026. $24.99/yr. Animated plays, 3D, video export, rosters, cloud sync. **Does not list baseball or softball.** A 2023 review asked for undo. Useful as a polish benchmark, not a direct competitor — [App Store](https://apps.apple.com/app/id512949303)
- PlayBook - Coach Tactic Board appears to be basketball-court oriented, not baseball — [App Store](https://apps.apple.com/us/app/playbook-coach-tactic-board/id1603572641)

### Inferences
- Simple Fielding has nearly the same positioning as Diamondboard (free, privacy-first, browser-based, iPad-focused, baseball and softball) and already ships things Diamondboard plans to build (link sharing, lessons and quiz, position views). If its native app ships first, it is the main threat. Diamondboard's edge would come from being an installable offline PWA, its library organized by position, per-step coaching notes, and polish.
- Baseball Board - Tactics is the closest "coach whiteboard" match in interaction model: step animation, per-step notes, undo, offline, link share, video export.
- Few dedicated, actively maintained baseball whiteboard apps exist on the App Store. Most new entrants are web-first (Simple Fielding, Dugout Edge, Softball Instincts) or subscription content libraries (InMotion).

### Gaps
- No app found named "Diamond Chalk," "Pro Baseball Whiteboard," "Baseball Defense," "Baseball Situations / Infield Situations," "CoachMe," or "Baseball Blackboard," and none from Baseball Rebellion or CoachTube. They may not exist under those names, may be delisted, or may be too obscure to index.
- No Google Play ratings were collected. Ratings and review counts for X's & O's, Baseball Blueprint, The Baseball Mind, Freeze Baseball, and Baseball Board could not be fetched (404s or not shown).
- DiamondPlay and Bravara details are unverified because their pages did not load.

## What do competitors do that Diamondboard does not, and vice versa?

### Takeaway
Competitors lead on **sharing and export** (links, PNG, PDF, video, sending plays to players' phones), **learning modes** (quizzes, "ask first" pauses, graded lessons), **field and level variants** (Little League, 50/70, softball fastpitch, slapper, MLB park outlines), **team rosters**, and **presentation** (projector mode, AirPlay, 3D or first-person views). Diamondboard's distinctive combination is: free with no account, offline-installable PWA, autosave and undo, a large position-organized library (~150 plays, larger than Simple Fielding's 86 and Dugout Edge's 50+, smaller than InMotion's 300+ softball rotations), and per-step coaching notes in a whiteboard. Only Baseball Board - Tactics clearly has per-step notes.

### Cited Findings
- Link sharing that needs no app: Simple Fielding, Baseball Board - Tactics — [simplefielding.com](https://simplefielding.com/), [App Store](https://apps.apple.com/app/id6763575410)
- Video export: Baseball Board - Tactics, TacticalPad. PNG/PDF export: Baseball Board, Baseball Board - Tactics. PDF playbook export: Softball Blueprint — [App Store id6763575410](https://apps.apple.com/app/id6763575410), [TacticalPad](https://apps.apple.com/app/id512949303), [Baseball Board support](https://sites.google.com/view/baseballboard/home), [Softball Blueprint](https://www.softballblueprints.com/)
- Push to players' devices or view-only player access: X's & O's, Softball Instincts (15 per team), BASIQs coach games — [xsandos.team](https://xsandos.team/), [Softball Instincts](https://coach.softballinstincts.com/), [BASIQs](https://apps.apple.com/us/app/basiqs-softball/id1034912896)
- Position-specific animated breakdowns: X's & O's. Single-player focus and position job text: Simple Fielding — [xsandos.team](https://xsandos.team/), [simplefielding.com](https://simplefielding.com/)
- Quizzes and lessons: Simple Fielding lessons, Dugout Edge IQ quizzes, The Baseball Mind, BASIQs, Freeze Baseball — sources above
- Situation engine (drag the ball and all 9 move automatically) instead of canned plays: Simple Fielding — [GitHub](https://github.com/mrthames/simple-fielding)
- Level and field variants plus softball slap and look-back content: Simple Fielding. One-tap baseball/softball field switch: Pitch MetRx — [simplefielding.com](https://simplefielding.com/), [Pitch MetRx](https://www.pitchmetrx.com/coaches-whiteboard/)
- Rosters, attendance, and practice plans: Baseball Board - Tactics. Rosters: Simple Fielding, X's & O's, TacticalPad — sources above
- Projector mode: Simple Fielding. AirPlay: Baseball Board - Tactics. 3D: Simple Fielding, TacticalPad — sources above
- Styled lines (curved, wavy, dashed), zones, text labels, Apple Pencil, keyboard shortcuts: Baseball Board - Tactics — [App Store](https://apps.apple.com/app/id6763575410)
- Undo is a known pain point in competitors: a TacticalPad reviewer asked for it. Baseball Board - Tactics advertises 50-step undo/redo — [TacticalPad](https://apps.apple.com/app/id512949303), [App Store](https://apps.apple.com/app/id6763575410)
- Paywalls on saving: Dugout Edge saves only on Premium. Softball Instincts costs $97–$297/yr. InMotion costs $74.95/yr. Pitch MetRx costs $99/yr — sources above

### Inferences
- Must-have gaps to consider before Feb 2027: share-by-link (planned), image or PDF export, a softball field variant and slap/bunt plays, and youth field dimensions (Little League 60 ft vs 50/70). These are table stakes among the strongest competitors.
- Differentiators worth stressing: offline install with no account (only Baseball Board - Tactics also claims offline), free saving without a paywall (unlike Dugout Edge), and a position-organized library with coaching notes per step.
- The planned Position Study and Quiz will compete with Simple Fielding's "ask first" pause and graded lessons and with Freeze Baseball's drag-to-position game. A drag-to-place quiz is the proven interaction.

### Gaps
- I could not confirm whether Simple Fielding works offline or as a PWA, or whether X's & O's has a prebuilt library or pricing.

## App Store ratings, update recency, and recurring praise/complaints

### Takeaway
The category has thin review data. Most dedicated baseball boards show fewer than 5 ratings or too few to display, which means low adoption and an open market. Among apps with data, the recurring complaints are abandonment and bugs, repetitive quiz content, sign-up friction, and missing undo or text.

### Cited Findings
- Baseball Board - Tactics: too few ratings to show a score. v2.1.0 dated Oct 25 — [App Store](https://apps.apple.com/app/id6763575410)
- Baseball Board ($4.99): about 2–3 ratings (search snippet) — [App Store](https://apps.apple.com/us/app/baseball-board/id6751254549)
- BASIQs Softball: 3.3★ / 66. Last update Nov 24, 2021 (stagnant). Praise: it surfaces weak areas and kids enjoy it. Complaints: repetition, wrong answers, account friction, a launch bug, slow support — [App Store](https://apps.apple.com/us/app/basiqs-softball/id1034912896)
- Baseball WhiteBoard: 1.0★ / 1. Last update 2017 (abandoned). Complaints: navigation, no tutorial, no custom text — [App Store](https://apps.apple.com/app/id317282434)
- TacticalPad (multi-sport benchmark): 4.7★ / 1.2K. Updated Jan 2026. Praised as "most detailed and visually appealing." Complaints: cross-device purchase unlock, no undo, risky file deletion — [App Store](https://apps.apple.com/app/id512949303)
- Dugout Edge is still "Beta." Simple Fielding's native apps are "coming soon." The Baseball Mind's team tools are "on the way." These are 2025–2026 web-first entrants still maturing — [Dugout Edge](https://www.dugoutedge.com/chalkboard), [simplefielding.com](https://simplefielding.com/), [thebaseballmind.com](https://www.thebaseballmind.com/)

### Inferences
- With no dominant, well-reviewed baseball whiteboard on the App Store, a polished, reliable app with clear onboarding could stand out. Onboarding and tutorials and the ability to add text labels address documented complaints.
- Avoid BASIQs-style account friction for kids. Diamondboard's no-account model fits COPPA-sensitive youth use, which The Baseball Mind also emphasizes.

### Gaps
- No Google Play review data, YouTube demos, or forum reviews were gathered within the tool budget.
- Exact last-update dates for X's & O's, Baseball Blueprint, Freeze Baseball, The Baseball Mind, and Baseball Board were not retrieved.
