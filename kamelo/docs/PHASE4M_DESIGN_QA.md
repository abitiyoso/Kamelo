# Phase 4M — Browser and design QA

20 October 2026, disposable QA app localhost:3001 and PostgreSQL:55432. Existing green backoffice/resident design components were reused. Landing v7, Showcase v6, navigation and branding were not redesigned.

## Verified journey

1. Resident opens Tagihan and the explicitly shared historical balance.
2. Resident uploads a synthetic PDF for Rp50,000 with reference BROWSER-UI-PROOF-002. Pending status appears; remaining balance stays Rp400,000.
3. Owner opens Keuangan, the source batch and receivable, then inspects the matching proof. Existing sharing was read only during browser QA.
4. Owner selects approval/new receipt, enters a review note and explicitly confirms. Saved status appears, cash increases exactly Rp50,000 and remaining debt becomes Rp350,000.
5. Resident reauthenticates in STAY context and sees the approved evidence and review note. Repeated selection of the same detail now refreshes while preserving its content.

Browser tabs share the session cookie. Refreshing a resident API view while signed in with an owner context correctly denies access; reselecting the resident context restores the permitted view. No security-sensitive sharing grants were created through the browser.

## Responsive and usability checks

Desktop evidence captures pending and approved states. Mobile checks at 390 x 844 and 320 x 720 show wrapped content and fixed navigation without document horizontal overflow. Proof history has a bounded scrolling region and twenty-row pagination. Upload feedback precedes history, refreshed detail remains visible, and feedback/detail focus makes the result easier to find.

| Evidence                                           | Purpose                                         |
| -------------------------------------------------- | ----------------------------------------------- |
| `../artifacts/phase4m/tenant-proof-pending.png`    | Pending evidence and unchanged balance          |
| `../artifacts/phase4m/owner-proof-approved.png`    | Owner decision and saved result                 |
| `../artifacts/phase4m/tenant-proof-approved.png`   | Resident approved proof and review note         |
| `../artifacts/phase4m/tenant-proof-mobile-390.png` | 390 px resident layout                          |
| `../artifacts/phase4m/tenant-proof-mobile-320.png` | 320 px resident layout                          |
| `../artifacts/phase4m/browser-metrics.json`        | Actual DOM widths and cash/balance observations |

Owner mobile proof review was not separately exercised in this pass. Automated API regression covers shared-account isolation, revoked access, private downloads, upload constraints, exact retries, rejection/resubmission, existing-receipt linking, correction flags, immutable history and concurrent collection. Automated/build logs are stored beside screenshots. These checks do not substitute for production UAT, accessibility certification or live bank/provider validation.
