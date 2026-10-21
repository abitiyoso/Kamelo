# Phase 3 — bounded browser and visual QA

18 October 2026. Production QA build at loopback port 3001; disposable database at port 55432. All accounts and records in these captures are synthetic. This report supplements the Phase 1/2 source comparisons; it does not claim exhaustive pixel parity for every prototype dialog.

## Preserved visual system

The existing approved v5.3 forest green workspace, sidebar order, mobile navigation, typography, logo and property/room photographs are reused. New verification/invitation/workspace routes use the approved split photographic authentication frame. Public Landing v7 and Showcase v6 source/assets were not redesigned. Byte-manifest unit tests for all seven backoffice and fourteen public assets pass.

## Browser evidence

| View | Coverage | Evidence |
| --- | --- | --- |
| Resident desktop, 1440×900 | Existing-account login opens `/resident`; only selected stay's bill; invoice detail and pending proof are visible, with no fictitious confirmed payment. | `artifacts/phase3/resident-billing-desktop.png` |
| Owner desktop, 1440×900 | `/app/team` shows real invitation history, staff/tenant scope choices and explicit grants, inside the approved shell. Checkbox CSS inherited a column layout from old forms; final scoped row alignment is corrected. | `artifacts/phase3/owner-invitations-desktop.png` |
| Owner mobile, 390×844 | `/app/account` shows actual profile, verified email and honest phone/provider and local-email states. Profile controls fit the viewport; mobile More/account/logout navigation works. | `artifacts/phase3/account-mobile.png` |
| Workspace picker, desktop/mobile | Account → picker → already-granted organization → dashboard works. Desktop retains the approved photo/green split; mobile retains a single compact column. | `artifacts/phase3/workspaces-desktop.png`, `workspaces-mobile.png` |

The browser DOM measured mobile innerWidth 390, clientWidth 375 (scrollbar space), and document scrollWidth 375 on the account view: no horizontal overflow. Normal viewport screenshots were used; a transient scaled screenshot immediately after viewport resizing was discarded, then the settled viewport was inspected. The temporary viewport override was reset after testing.

API tests, rather than browser UI actions, cover password/email mutation, verification, invitation permission creation/accept/revoke, proof upload/file isolation and mail-worker concurrency. This avoids making new credentials or security grants through browser actions on any real account. No external mailbox, physical device or third-party account was changed.

Remaining visual coverage: large organization/team lists, multiple simultaneously active tenant contexts, every expiry/error-state screenshot, cross-browser/device coverage and production inbox rendering still require staging review. Missing business modules retain their honest unavailable states pending Phase 4.
