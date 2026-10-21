# Phase 4A bounded browser QA

18 October 2026. Local production preview `http://127.0.0.1:3001`, disposable synthetic data only. Existing approved green backoffice shell, logo, typography and navigation are retained. Public landing/showcase were not redesigned.

Observed owner directory search narrowed 54 profiles to the two Lifecycle fixtures. Budi's detail dialog showed a real agreed contract, revision 2, period/rent and Rp500,000 held deposit. Contract tab selection, mobile dialog scrolling and Escape dismissal worked; Escape restored focus to the invoking Detail button. Deposit copy explicitly distinguishes liability recording from bank movement and rent payment.

| Surface | Viewport | Observed result |
|---|---|---|
| Directory | 1440 × 900 | Search/table/KPIs and existing navigation fit. |
| Contract detail | 1440 × 900 | Readable modal with bounded internal scroll. |
| Contract/deposit detail | 390 × 844 | Document width 390; modal width 356, client/scroll width 341; no horizontal modal/document overflow. |
| Deposit detail | 320 × 740 | Document width 320; modal width 286, client/scroll width 271; no horizontal modal/document overflow. |
| Directory after final build | 320 × 740 | Document width 305 with scrollbar; table remains within its scroll container. |

Captures in `artifacts/phase4`: `residents-desktop.png`, `contracts-desktop.png`, `contracts-mobile.png`, `deposit-mobile-320.png`, `residents-mobile-320.png`. Desktop directory and contract screenshots were refreshed on the final build; mobile captures precede the client-only future-stay label/selection refinements, with unchanged layout. The final desktop search visibly showed Mendatang for the returning fixture.

This is bounded Chromium browser review, not full device/WCAG/performance certification. Contract acceptance and deposit writes were tested with synthetic HTTP/API scenarios, not executed as legal/financial actions through browser UI. Tenant authorization/projections, transfer contexts and ended-stay history were verified by the API suite; tenant visual review is not claimed for this increment.
