# Stage 3 browser verification

20 October 2026. Browser checks use synthetic QA accounts on loopback port 3001, disposable PostgreSQL on 55432 and MAIL_DRIVER=sink. No real email, external device command, access grant or monetary transfer was performed through the browser.

- Owner: existing Tagihan & Pembayaran navigation opens the automatic-reminder card; confirmed save returns a successful status; run returns zero when cooldown excludes existing sources. Schedule controls retain saved Jakarta hour/lead/interval/channel values. Expandable history displays sink versus portal state, and page two remains expanded after asynchronous loading.
- Tenant: original balance and service cards remain before the new reminder card. The new card initially shows three historical reminders; expanding history and moving to page two shows separate earlier rows. Periksa tagihan saya opens existing Tagihan Saya. No reminder claims to prove payment or receipt/read delivery.
- Owner and tenant: 390 px document client/scroll widths both 375; 320 px widths both 305 (15 px scrollbar). No document horizontal overflow. Checkbox controls remain 18×18; numeric controls and labels wrap within the card. Existing invoice table retains its internal horizontal scroll.
- Console warnings/errors: none in the final recorded check.

Visual issues found and corrected during the check: inherited form CSS separated checkbox text from its control; loading initially collapsed owner history on page changes; a twenty-row tenant history before balance cards crowded the home page. Labels now use explicit horizontal alignment, owner pagination keeps its disclosure open, and tenant history starts with three entries after the original home cards.

Evidence in `artifacts/reminder-stage3/`: owner-schedule.png, owner-history-page2.png, owner-mobile-390.png, owner-mobile-320.png, tenant-home.png, tenant-history-page2.png, tenant-mobile-390.png, tenant-mobile-320.png and browser-metrics.json. Build/typecheck, 49 unit tests, 23 API suites including 17 reminder groups and QA-only old-row preservation evidence accompany these images. Images show synthetic historical fixtures; the final finance amounts are not customer records.

These checks cover the new flows and responsive layouts. They do not establish a full accessibility audit, load test, live inbox delivery, production worker supervision or final production UAT.
