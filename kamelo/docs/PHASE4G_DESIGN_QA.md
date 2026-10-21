# Phase 4G bounded browser QA

19 October 2026. Local production preview `http://127.0.0.1:3001`, synthetic accounts/data only. Approved green account/admin shells, navigation, typography and assets reused. No public page redesign.

Observed account flow: verified owner signs in → account → Privasi & salinan data → downloads JSON summary. A browser download event and usable local file were observed; parsed content matched the signed-in synthetic account, declared its limited scope and omitted password/token fields. Review evidence stores only boolean checks in `browser-download-check.json`, not the downloaded personal payload.

The owner attempts a second open COPY request; the UI reports the duplicate, retains typed text/confirmation and focuses the error. The owner selects CLOSE_ACCOUNT review and submits. Status says Diajukan and explicitly states no automatic closure/deletion. Existing authorized platform admin signs in, selects the Platform ELENIO workspace and opens Support Center → Permintaan privasi. Type/status filters narrow to the same request. Admin records IN_REVIEW with a reference, then RESPONDED with another reference and an explicit non-execution explanation. Account remains usable; requester can read the same response.

| Surface | Viewport | Observed result |
|---|---|---|
| Request/review detail | Desktop | Existing shell, shared history and explicit review-only copy in bounded dialog. |
| Owner request detail | 390 × 844 | Document width 390; dialog width/client/scroll 356; no horizontal overflow. |
| Owner request detail | 320 × 740 | Document width 320; dialog width 286, client/scroll 271; close target 48px. |
| Escape after submission | 320 × 740 | Focus returns to Ajukan permintaan privasi; document width 305 with scrollbar. |
| Admin privacy tab/filter | Desktop | Existing Support Center navigation retained; private queue is separate from organization support. |

Evidence under `artifacts/phase4g`: browser-download-check.json, privacy-owner-desktop.png, privacy-owner-mobile390.png, privacy-owner-mobile320.png, privacy-admin-response.png and privacy-owner-response-final.png. Final build changes only the explicit over-limit download error, followed by the targeted privacy API recheck and final requester response inspection. Temporary viewport override reset and an owner account preview retained.

Browser actions created/reviewed synthetic requests; none deleted data, closed an account or contacted an external person. Backend identity, concurrency, retention preservation and bounds are covered by the 100-group regression and 29 unit tests. This is bounded Chromium QA, not a legal-compliance certification or exhaustive device, WCAG, screen-reader, performance or production acceptance review.
