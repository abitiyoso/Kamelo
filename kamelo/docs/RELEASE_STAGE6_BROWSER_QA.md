# Recovered application browser verification

20 October 2026; existing stage 5 production build, restored UTF-8 PostgreSQL copy on 55433, loopback preview 3002. Email disabled, no workers and no live provider commands. No application visual source changed.

The existing recovered owner signed in through `/login`. The dashboard loaded real restored property, occupancy, cash/debt totals and existing intelligence cards. Navigation to Keuangan worked and the receipt archive expanded to show 24 documents with current states, private print/download links and pagination. No receipt was issued, reviewed, refunded or deleted in the browser.

Finance was checked at 390 × 844 and 320 × 844. Document client/scroll widths were 375/375 and 305/305 respectively (scrollbar excluded), so there was no document-level horizontal overflow. Console error capture was empty. The temporary viewport override was reset. This is a targeted recovery UI check; it is not final customer UAT, an exhaustive accessibility audit or a redesign.

- [Restored dashboard](../artifacts/release-stage6/restored-dashboard.png)
- [Restored finance archive](../artifacts/release-stage6/restored-finance.png)
- [Finance at 390 px](../artifacts/release-stage6/restored-finance-390.png)
- [Finance at 320 px](../artifacts/release-stage6/restored-finance-320.png)
- [Browser metrics](../artifacts/release-stage6/browser.json)

API recovery/security/load evidence is in [RELEASE_STAGE6.md](RELEASE_STAGE6.md). Approved identity, photos, layout and navigation were retained.

21 October continuation: after normal PostgreSQL recovery and manual preview restart, the existing owner signed in again and the dashboard loaded current-date balances. See the [post-restart screenshot](../artifacts/release-stage6/restored-dashboard-restarted.png). Earlier responsive and API measurements remain dated 20 October; no new comprehensive test run is implied.
