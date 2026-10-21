# Phase 4C bounded browser QA

18 October 2026. Production preview on `http://127.0.0.1:3001`, disposable synthetic data only. Existing approved green v5.3 admin/owner shells, logo, typography and navigation are retained. The public landing/showcase were not redesigned.

Observed administrator flow: existing QA admin signs in → chooses the already authorized Platform ELENIO workspace → searches organization customers → opens Customer 360 → inspects billing profile, aggregate finance and invoice history. Invoice amounts and ledger history originate from the isolated API fixtures. An ordinary organization context does not render the platform customer database.

The initial invoice table clipped the detail action in a narrow dialog. The final layout puts the action beside the invoice identifier and renders labeled vertical invoice rows on mobile. Expired service periods now explicitly say **Masa berlaku berakhir**, while existing legacy indefinite terms say the end date is not recorded. Payment status and entitlement remain distinct.

| Surface | Viewport | Observed result |
|---|---|---|
| Customer directory / detail | 1440 × 900 | Existing shell/KPIs/table and readable bounded dialog. Search narrowed the synthetic customer set. |
| Customer detail / invoices | 390 × 844 | Document width 390; modal width 356; client/scroll width 341. No horizontal modal/document overflow. |
| Invoices | 320 × 740 | Document width 320; modal width 286; client/scroll width 271. Long email/identifiers wrap. |
| Invoice detail action | 320 × 740 | 44px high, about 103px wide; action remains visible in its invoice row. |
| Directory after Escape | 320 × 740 | Document width 305 with scrollbar; focus returns to the invoking Detail button. |

Evidence under `artifacts/phase4c`: `customers-desktop.png`, `customer-detail-desktop.png`, `customer-detail-mobile.png`, `invoices-mobile.png`, `invoices-mobile-320.png`, plus final invoice-detail focus and owner-settings captures. Mobile captures precede only the final focus-navigation refinement with unchanged layout. Final browser checks confirm direct focus to the chosen invoice and the owner's own billing view.

Financial recording, refunds, corrections and entitlement activation were exercised only as synthetic API tests. No browser action executed a real payment/refund or expanded access. This is bounded Chromium QA, not a full device, WCAG, localization, performance or production acceptance certification.
