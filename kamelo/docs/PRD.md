# MASTER PRODUCT REQUIREMENTS DOCUMENT
# Kamelo by ELENIO
## Simple Property Management & Smart IoT
### A Product by ELENIO

**Document Version:** 2.2 — Master PRD with owner-first positioning and tenant-workflow amendments  
**Document Status:** Ready for Development  
**Development Agent:** OpenAI Codex  
**Product Category:** Affordable Property Management SaaS  
**Primary Market:** Indonesia  
**Target Platform:** Responsive Web Application / PWA-ready  
**Primary Language:** Bahasa Indonesia  
**Currency:** Indonesian Rupiah (IDR)  
**Timezone:** Asia/Jakarta

---

# FINAL BRANDING & PRODUCT AMENDMENT — 13 OCTOBER 2026

The later [landing refinement request](LANDING_REFINEMENT_DIRECTION.md) supersedes earlier acquisition presentation below. Use hero **Tagihan belum masuk. Kamar kosong. Semua masih menunggu Anda?**, two CTA priorities **Coba Demo Owner / Mulai Gratis**, and a complete local-only reminder trial. Consolidate into hero, three owner pains, workflows/owner-tenant paths, concise structured LEO, Smart Stay/Room, configured prices, FAQ/closing CTA. Preserve original assets and PMS/auth/API/data. Public fixture-only owner and resident examples must never use customer bearer tokens or write backend data; preserve property context and label read-only destinations accordingly. Target 35–45% shorter mobile length through reduced repetition, with keyboard/mobile/reduced-motion checks and honest capability labels. See [refinement evidence](LANDING_REFINEMENT_REPORT.md).

## Latest governing commercial direction

The subsequent [owner-first continuation direction](OWNER_POSITIONING_DIRECTION.md), preserved verbatim, supersedes earlier generic homepage headlines and positioning below. Product name and original ELENIO/LEO assets remain unchanged. Positioning is **Dari Masalah Properti, Jadi Tindakan Nyata**, for owners of kos, guest houses and small hotels. The homepage leads with unpaid invoices, repetitive staff follow-up and unnecessary AC/electricity use, followed by impact, real workflows, LEO, Smart Stay, optional Smart/CCTV/Video Analytics, configured pricing and conversion.

Use the approved hero **Punya Properti, Tapi Semua Masalah Masih Anda yang Urus?**, with registration CTA **Mulai Gratis**, workflow anchor **Lihat Cara Kerja**, and **Diskusi Smart Property** opening the approved ELENIO WhatsApp 081933328899 with a consultation draft. No automatic message is sent. Provide a Kos/Guest House & Hotel example selector without splitting the application architecture.

Current capabilities must be marked accurately. Core workflows are available; digital access/device controls are simulation; full Smart Stay/Wi-Fi, maintenance tickets/tasks, actual AI Agent, CCTV and Video Analytics are unavailable and labeled Segera Hadir. The LEO homepage interaction is a deterministic read-only sample based on the same demo data, not an AI deployment. Live electricity automation requires compatible installed hardware, verified vacancy, authorized non-essential loads and manual override; software occupancy alone must never be treated as physical vacancy. No measured savings, ROI, customer case studies, testimonials or competitor exclusivity claims may be invented.

Preserve `lib/plans.ts` Free/Starter/Plus prices and limits. The proposed Ultimate price is not a configured entitlement and must not become an activatable package silently. Hardware/installation are separate initial costs; Smart/CCTV/AI services require separate recurring pricing and limits. Current imagery remains licensed illustrative stock until authorized Indonesian photography is available. Current interface screenshots use labeled demo data. Original functional requirements remain below; implementation coverage is tracked in IMPLEMENTATION_STATUS.md.

The approved [final branding direction](BRANDING_DIRECTION.md), preserved verbatim from the user's supplied document, governs product naming, positioning, visuals, photography, and marketing copy. The functional requirements below remain the target specification. This amendment adds the user's latest tenant, dashboard, and smart-access requirements without removing existing business rules, database integrity, subscription limits, permissions, or test requirements. Requirements describe intended behavior; verified implementation coverage is tracked separately in [implementation status](IMPLEMENTATION_STATUS.md).

## Official identity and product groups

- Official product name: **Kamelo by ELENIO**. Kamelo is a clean typographic product name, attributed to the existing official ELENIO logo. Do not create a Kamelo logo, custom K icon, doorway mark, or decorative product symbol. Preserve the supplied ELENIO logo exactly, including shape, colors, typography, proportions, and details.
- Primary tagline: **"Urus Properti Jadi Gampang."**
- Landing headline: **"Kelola Kos & Hotel Tanpa Ribet."**
- Supporting copy: **"Dari kamar kosong, data penghuni, sampai tagihan bulanan. Semua lebih mudah dengan Kamelo."**
- CTAs: **"Mulai Gratis"** and **"Lihat Demo"**.
- **Kamelo Core** covers the independent property-management application. **Kamelo Smart** is an optional smart-device add-on; initial registration must not require a Tuya account.
- Preserve the ELENIO Light design system, Plus Jakarta Sans headings and Inter body text, authentic licensed photography, selective original-reference LEO Stay use, and the five primary portal modules. Use varied, meaningful icons with accessible labels and colors; avoid decorative clutter.
- Customer-facing names change without unnecessary renaming of tables, migrations, database names, cookies, internal technical identifiers, or existing records.

## Tenant invoice portal and payment evidence

1. An authorized manager can create a tenant link for one issued invoice. Store only the token hash, scope access to that invoice and its stay, expire links after 14 days, and revoke previous links when a new one is created. A link is a bearer credential and must not reveal another tenant's data.
2. The tenant can view the invoice, payments and balance, submit payment evidence, and read review status without obtaining an owner/staff account. The portal is not a payment gateway.
3. Accept JPEG, PNG, or PDF evidence up to 5 MB, validating actual file signatures, declared type, amount, payment date, and invoice balance. Keep uploaded files in private storage outside `public/`; serve files only through a scoped authorized endpoint. Do not expose storage keys, token hashes, or local paths.
4. New evidence is `PENDING`; uploading never marks an invoice paid. Only the owner or staff explicitly allowed to record payments may review it. Approval requires confirmation that funds were received and records exactly one payment transaction; repeated approval must not duplicate money. Rejection requires a reason, visible to the tenant.
5. Reject evidence for draft/void invoices, future payment dates, overpayments, duplicate pending/approved evidence, and excessive pending uploads. Recheck balance and authorization inside the transaction to preserve concurrent-payment integrity. Audit uploads and review outcomes without including file contents or access PINs.

## Individual due dates and manual reminders

1. Each kos stay has its own billing day (1–31) and rental rate; different tenants can have different due dates. Owners can edit the tenant name/phone and active stay billing settings. Changes apply to future invoice generation and must not silently rewrite previously issued invoices or payments.
2. Recurring monthly invoices retain the stay's configured day, clamp to the last calendar day for shorter months, and remain unique per stay/month. Generation remains an explicit action until a verified scheduler is implemented.
3. Manual WhatsApp reminders include the issued invoice balance, due date, and an authorized tenant invoice/upload link. Creating a new link rotates any earlier link for that invoice. The operator reviews and sends the prepared message in WhatsApp; opening a link is never reported as automatic sending or delivery.

## Dashboard trends and practical insights

1. Show an accessible six-month payment graph and explicit up/down/unchanged indicators, with values and dates also available as text. Icons must be distinct by purpose, with color as a supporting cue rather than the only signal.
2. Compare received payments from the first of this month through today against the same elapsed days of the previous month, clamped to that month's last day. Label both periods. If the previous period is zero, do not display an invented percentage change or misleading infinite growth.
3. Show current occupancy, all-history overdue issued balances/counts, and the collection rate for the cohort of invoices issued this month. The cohort's denominator is that month's issued invoice value; the numerator is payments recorded against those invoices through today. Exclude draft/void invoices and label no-data states.
4. Keep these operational insights factual and independent of invoice pagination; do not imply profit, forecasts, accounting assurance, or measured historical occupancy growth where no historical snapshot exists.

## Optional digital room access — simulation first

1. Support an explicitly labeled mock smart lock mapped to a room, with optional automated access simulation. Eligible kos access follows an active stay and its date range; hotel access additionally requires check-in. Check-out, stay end, disabled automation, or changed mapping requests revocation.
2. Access has scheduled, pending, active, or revoked states. Only a supported online mock device confirmation can mark access active. Offline/unconfirmed changes remain pending, preserve last confirmed device state, and do not reveal a credential as active.
3. Generate a six-digit demonstration PIN for each device/stay pair, store it encrypted with AES-256-GCM, and never place it in audit metadata or device-state JSON. Reveal it only through an authorized link with access permission, for that stay, valid dates, enabled mapping, online device, and confirmed active simulation state.
4. `TenantLink.includeAccess` is set only for links created by an owner or appropriately permitted staff. An invoice-only link must never expose smart-access data. Payment status does not determine access; do not introduce payment-based lockouts.
5. Local encryption keys stay in the private `.local-secrets/` directory. A hosted instance requires a protected 32-byte `DATA_ENCRYPTION_KEY`; private proof files require persistent storage and backups. Do not confuse the PIN encryption facility with a completed Tuya credential vault.
6. All current smart-lock behavior is simulation. It does not unlock physical hardware or provision a real Tuya lock. Real integration requires verified compatible devices, authorized provider functions, protected credentials, supported access methods, confirmed outcomes, and live acceptance tests. Never guess device capabilities or enable automatic physical unlocking from these mocks.
7. Date transitions are reconciled during relevant application operations and authorized access refreshes; a continuously running scheduler is a separate implementation requirement before promising unattended time-based hardware behavior.

## Additional acceptance checks

Verify tenant-token expiry/rotation/isolation, scoped proof downloads, file-size/signature/type validation, proof review permission, repeated approval and concurrent balances, separate tenant billing days including month end, immutable issued invoices after tenant edits, manual reminder links, equal-period comparisons including zero baselines, all-history overdue totals, and mock lock scheduling/check-in/check-out/remapping/offline behavior. Verify encrypted PIN storage, no unauthorized credential disclosure, no payment-based access change, and Core operation without Tuya. Passing evidence for a previous release does not count as validation of this amendment.

---

# 1. EXECUTIVE SUMMARY

## 1.1 Product Vision

Kamelo by ELENIO adalah aplikasi berbasis web untuk membantu pemilik kos, guest house, dan hotel kecil mengelola kegiatan operasional sehari-hari secara lebih mudah.

Aplikasi menggabungkan:

- Pengelolaan kamar.
- Data penghuni dan tamu.
- Reservasi sederhana.
- Pembuatan tagihan.
- Pencatatan pembayaran.
- Dashboard bisnis.
- Integrasi perangkat pintar Tuya sebagai fitur opsional.

Produk ditujukan untuk pemilik properti dengan sekitar 5–50 kamar yang selama ini mengelola operasional menggunakan buku catatan, Excel, dan WhatsApp.

**Product Positioning:**

"Urus Properti Jadi Gampang."

**Product Promise:**

Pemilik kos atau hotel kecil dapat mengetahui kondisi kamar, tagihan, dan pemasukan dari satu aplikasi yang mudah digunakan.

## 1.2 Product Objectives

1. Memudahkan pemilik properti melakukan pencatatan operasional.
2. Mengurangi administrasi manual.
3. Memudahkan pemantauan kamar kosong dan terisi.
4. Memudahkan penagihan dan pencatatan pembayaran.
5. Memberikan gambaran pemasukan secara sederhana.
6. Memungkinkan pelanggan menggunakan smart devices tanpa membangun sistem IoT sendiri.
7. Mendorong adopsi melalui pendaftaran mandiri dan harga terjangkau.

## 1.3 Non-Goals

Produk ini bukan:

- Enterprise Hotel Management System.
- Full accounting atau ERP.
- OTA booking marketplace.
- Sistem manajemen properti komersial yang kompleks.
- Platform AI canggih dengan berbagai fitur yang tidak diperlukan pelanggan kecil.

**Core Design Principle:**

Simplicity over complexity.

---

# 2. TARGET MARKET & CUSTOMER PERSONAS

## 2.1 Target Segments

| Segment | Typical Property Size | Primary Needs |
|---|---|---|
| Kos sederhana | 5–20 kamar | Penghuni, tagihan, kamar |
| Kos eksklusif | 10–50 kamar | Operasional, pembayaran, smart devices |
| Guest house | 5–30 kamar | Booking, check-in/out, pembayaran |
| Budget hotel | 10–40 kamar | Reservasi, okupansi, pemasukan |
| Multi-property owner | 2–3 lokasi kecil | Monitoring beberapa lokasi |

## 2.2 Persona A — Pemilik Kos

- Mengelola 15 kamar.
- Belum mempunyai staf IT.
- Menggunakan WhatsApp dan Excel.
- Membutuhkan daftar penghuni dan tagihan.
- Sering menggunakan smartphone.

Primary JTBD:

"Saya ingin cepat tahu siapa yang belum bayar dan kamar mana yang masih kosong."

## 2.3 Persona B — Pengelola Guest House

- Mengelola 12 kamar.
- Menerima reservasi melalui WhatsApp atau telepon.
- Membutuhkan pencatatan check-in/check-out.
- Ingin menghindari pemesanan kamar ganda.

Primary JTBD:

"Saya ingin tahu kamar yang tersedia dan mencatat tamu tanpa sistem hotel yang rumit."

## 2.4 Persona C — Pemilik Kos Eksklusif

- Mengelola 30 kamar ber-AC.
- Memiliki beberapa smart devices.
- Ingin mengontrol perangkat dari dashboard.
- Membutuhkan laporan pembayaran dan okupansi.

Primary JTBD:

"Saya ingin mengelola kos lebih efisien dan mengontrol perangkat tanpa harus datang ke lokasi."

---

# 3. PRODUCT DIFFERENTIATION

Kamelo by ELENIO menggabungkan dua lapisan layanan.

## 3.1 Kamelo Core — Property Management

Fitur utama yang tersedia tanpa perangkat IoT:

- Room management.
- Tenant/guest management.
- Reservation.
- Billing.
- Payment recording.
- Basic reporting.

## 3.2 Kamelo Smart — Optional Smart Property

Fitur tambahan untuk pemilik properti yang memiliki perangkat Tuya kompatibel:

- Smart AC.
- Smart light.
- Smart switch.
- Smart plug.
- Compatible smart lock.
- Device monitoring and control.

**Important:**

IoT bukan syarat penggunaan aplikasi.

Jangan meminta pengguna membeli smart devices saat mendaftar.

---

# 4. BUSINESS MODEL

## 4.1 Freemium Subscription

Rancangan harga awal untuk validasi pasar:

| Plan | Free | Starter | Plus |
|---|---|---|---|
| Harga/bulan | Rp0 | Rp49.000 | Rp99.000 |
| Total kamar | 5 | 20 | 50 |
| Jumlah properti | 1 | 1 | 3 |
| Akun pengguna | 1 | 2 | 5 |
| Kamar & tamu | Yes | Yes | Yes |
| Catat pembayaran | Yes | Yes | Yes |
| Tagihan berulang | No | Yes | Yes |
| Pengingat WA manual | Yes | Yes | Yes |
| Dashboard dasar | Yes | Yes | Yes |
| Multi-properti | No | No | Yes |
| IoT | Add-on | Add-on | Add-on |

Harga adalah hipotesis bisnis dan belum merupakan tarif final.

Implementation:

- Plan prices configurable.
- Room limits configurable.
- Feature access configurable.
- No hardcoded business assumptions in UI components.

## 4.2 Subscription Experience

New accounts start on Free.

A new user can:

1. Register.
2. Create up to 5 rooms.
3. Add tenants or guests.
4. Create basic invoices.
5. Record payments.
6. Use the application without a credit card.

When reaching the room limit:

Display:

"Kamar sudah mencapai batas paket Gratis. Upgrade untuk menambah kamar."

CTA:

"Lihat Paket"

Users with more than 5 rooms should see the appropriate plan before bulk creation; do not silently discard or partially import rooms.

For MVP:

- Upgrade requests can be handled by platform admin.
- No real payment gateway required.
- Do not pretend a payment has been completed.
- Subscription status must be recorded and auditable.

On downgrade or expiration:

- Never delete property, guest, invoice, or payment data.
- Historical data remains accessible.
- Essential access to existing financial records must remain available.
- Apply documented restrictions to additional rooms, users, and paid features.
- Provide clear notifications about plan changes.

## 4.3 Optional IoT Add-on

IoT has independent pricing and feature entitlement.

Do not publish a fixed IoT price until:

- Tuya Cloud cost is validated.
- Device compatibility is validated.
- Infrastructure cost is calculated.
- Support/maintenance cost is estimated.

Initial integration may be enabled through assisted onboarding.

Do not require complex cloud developer setup from everyday property owners.

## 4.4 Customer Acquisition Funnel

Landing Page → Register → Create Property → Create Rooms → Add Tenant/Guest → Create Invoice → Regular Usage → Upgrade → Optional IoT.

The core activation event is the first successful invoice created for a real room.

---

# 5. BRAND ARCHITECTURE

## 5.1 Master Brand

Parent Company: ELENIO

Product: Kamelo by ELENIO

Brand Attribution: by ELENIO

Do not create an unrelated corporate brand.

## 5.2 Official Brand Assets

Use existing ELENIO design references:

- `Logo Default.png`
- `Logo White.png`
- `Logo Color White.png`
- `Icon Only.png`
- `Icon Only White.png`
- `Icon App Default.png`
- `Icon App Color White.png`
- `Icon App Logo White.png`
- `Visual Languange.jpeg`
- `alternative Visual Languange.jpeg`
- `Social and identity.jpeg`

These names refer to supplied brand assets; the files must be copied or attached into the Codex working repository before use.

Do not assume images uploaded into ChatGPT are automatically present in the Codex repository.

**Absolute Logo Rule:**

- Never redesign the original logo.
- Never regenerate the wordmark using AI.
- Never modify logo colors or letterforms.
- Never stretch or distort the original logo.
- Never substitute a similar-looking logo.
- Only scale, position, and select suitable supplied official logo variants.

Use Kamelo as a clean typographic product name with the existing official ELENIO logo attribution. Do not create a dedicated Kamelo logo, custom K icon, doorway mark, or decorative product symbol.

## 5.3 Product Branding Approach

Kamelo should feel like a sub-product of ELENIO.

Visual personality:

- Friendly.
- Trustworthy.
- Clean.
- Practical.
- Modern.
- Affordable.
- Approachable.

Avoid:

- Luxury hotel branding.
- Excessive corporate enterprise visual styling.
- Cyberpunk and futuristic interfaces.
- Overuse of gradients.
- Overly playful children's app styling.

---

# 6. MASCOT SYSTEM — LEO STAY

## 6.1 Concept

Mascot Name: LEO Stay

Parent Mascot: LEO by ELENIO

LEO Stay is a hospitality-themed derivative of the original ELENIO mascot.

It should immediately look like the same character.

## 6.2 Design Requirements

Preserve:

- Original mascot silhouette.
- Character proportions.
- Head and face structure.
- Eye design.
- Original primary colors.
- Visual personality.

Optional hospitality elements:

- Small room access card.
- Room key.
- Friendly welcoming gesture.
- Simple check-in pose.

Do not:

- Invent a different mascot.
- Turn the mascot into a house.
- Replace it with a generic robot.
- Change the original character design significantly.

The original LEO character reference is mandatory for producing mascot artwork.

If that file is missing, Codex must use a neutral placeholder and explicitly request the original asset. Do not fabricate a replacement.

## 6.3 Required Mascot Variants

- Welcome
- Onboarding
- Success
- Empty State
- Help

Asset filenames:

- `leo-stay-welcome.png`
- `leo-stay-onboarding.png`
- `leo-stay-success.png`
- `leo-stay-empty.png`
- `leo-stay-help.png`

Use a transparent background where possible.

## 6.4 Mascot Usage Rules

Mascot appears in:

- Landing page, selectively.
- First login welcome.
- Property onboarding.
- Successful setup.
- Empty states.
- Contextual assistance.

Mascot should not appear prominently on every dashboard page.

LEO Stay is a visual assistant, not an AI chatbot in MVP.

---

# 7. COMPLETE DESIGN SYSTEM

## 7.1 Design Style

**ELENIO Light — Friendly PropTech SaaS**

This design style combines:

- ELENIO official brand identity.
- Modern SaaS UI.
- Authentic Indonesian property photography.
- Minimal and friendly operational interface.

Visual benchmark:

A polished application that small Indonesian business owners can use comfortably.

Not a command center, complicated ERP, or luxury booking website.

## 7.2 Color System

Use official ELENIO colors wherever specified in provided assets.

Suggested fallback UI tokens (not a replacement for official brand values):

- Primary Blue: `#086AF5`
- Dark Navy: `#091A43`
- Main Background: `#FFFFFF`
- Secondary Background: `#F5F8FC`
- Light Blue: `#DCEEFF`
- Border: `#E2E8F0`
- Text Secondary: `#64748B`
- Success: `#20936B`
- Warning: `#D99516`
- Error: `#DC4545`

Use centralized design tokens or CSS variables.

## 7.3 Typography

Preferred:

- Headings: Plus Jakarta Sans.
- Body: Inter.

Fallback to system fonts if necessary.

Guidelines:

- Body size: 14–16px.
- Clear hierarchy.
- Readable financial numbers.
- Large, legible status labels.
- Avoid excessively small typography.

## 7.4 Components

- Cards: 12–16px radius.
- Buttons: 10–12px radius.
- Input fields: clear visible borders.
- Subtle shadows.
- Spacious form layouts.
- Lucide icons.
- Consistent loading, success, and error states.
- Touch-friendly controls.
- Accessible labels and keyboard interactions.

## 7.5 Desktop Layout

- Sidebar: approximately 224–240px.
- Topbar with property selector.
- Main content maximum width approximately 1280px.
- Consistent spacing.
- Sticky actions only when beneficial.
- Clear hierarchy and minimal decorative elements.

## 7.6 Mobile Layout

Mobile usability is a top priority.

Implement:

- Compact navigation.
- Responsive room cards.
- Full-width important actions.
- Easily accessible payment actions.
- Minimal horizontal scrolling.
- Readable invoices.
- Forms suitable for small screens.

Main operational tasks should work without a desktop computer.

## 7.7 Design Language Restrictions

Do not use:

- Glassmorphism.
- Neon glowing borders.
- Excessive floating cards.
- Dashboard animations without purpose.
- Futuristic 3D cities.
- AI-generated abstract office imagery.
- Dark background for all application pages.
- Complicated charts that confuse nontechnical users.

---

# 8. REAL PHOTOGRAPHY REQUIREMENTS

## 8.1 General Direction

The public website should use substantial authentic photography.

Target approximately 60% visual storytelling and 40% concise written content across the landing page, while maintaining readability and appropriate whitespace.

The portal itself should remain functional and less image-heavy.

## 8.2 Required Photography Categories

1. Modern Indonesian kos bedrooms.
2. Simple furnished rooms.
3. Budget hotels.
4. Guest houses.
5. Small reception areas.
6. Property corridors.
7. Property managers using smartphones/laptops.
8. Real compatible IoT devices installed in rooms.

## 8.3 Photography Standards

- Genuine licensed photographs.
- Natural daylight.
- Realistic Indonesian or Southeast Asian environments.
- Affordable to mid-market properties.
- Consistent neutral color grading.
- Warm, welcoming atmosphere.
- Real furniture and real building details.

Avoid:

- Luxury resorts.
- Five-star hotel lobbies.
- AI-generated fake property photos.
- Watermarked images.
- Overly staged stock photography.
- Repeated stock images across multiple sections.

## 8.4 Image Sourcing

Priority:

1. User-provided property photography.
2. Approved licensed stock photography.
3. Verified reusable photos from suitable sources such as Pexels or Unsplash.

For each selected image:

- Confirm suitable usage rights.
- Save local optimized copies in the repository.
- Keep source/license records.
- Add alt text.
- Use responsive image dimensions.
- Avoid hotlinking unstable third-party image URLs.
- Do not claim stock photography represents actual Kamelo customers.

Recommended directories:

- `/public/images/properties/`
- `/public/images/features/`
- `/public/images/mascot/`
- `/public/brand/`

Use WebP or AVIF where appropriate.

## 8.5 Application Screenshots

Product screenshots on the landing page must reflect the actual application design.

Do not create misleading UI images depicting features that do not exist.

Use demo data and clearly label product previews when appropriate.

---

# 9. PUBLIC LANDING PAGE REQUIREMENTS

Route: `/`

The landing page must be accessible without authentication.

## 9.1 Navigation

Header:

- Product name.
- by ELENIO attribution.
- Fitur.
- Cara Kerja.
- Harga.
- Masuk.
- Mulai Gratis.

Use a clean sticky navigation.

## 9.2 Hero

Headline:

**"Kelola Kos & Hotel Tanpa Ribet."**

Supporting copy:

"Dari kamar kosong, data penghuni, sampai tagihan bulanan. Semua lebih mudah dengan Kamelo."

Primary CTA:

"Mulai Gratis"

Secondary CTA:

"Lihat Demo"

Supporting text:

"Gratis hingga 5 kamar. Tanpa kartu kredit."

Visual concept:

- Large real photograph of a modern kos or guest house.
- Actual dashboard preview presented alongside the photograph.
- Small LEO Stay welcome illustration.
- Subtle ELENIO-inspired shapes.
- Plenty of whitespace.

Do not let the mascot dominate the hero.

## 9.3 Problem Section

Headline:

"Masih Repot Urus Kos Sendiri?"

Four problems:

**Lupa Siapa yang Belum Bayar**

Tagihan sering tercecer di chat atau catatan.

**Bingung Kamar Mana yang Kosong**

Sulit memantau ketersediaan kamar.

**Data Penghuni Berantakan**

Catatan tersebar di beberapa tempat.

**Perangkat Listrik Tidak Terkontrol**

Sulit mengetahui atau mengontrol perangkat pintar ketika tidak berada di lokasi.

Use suitable real property images, not generic illustrations.

## 9.4 Feature Section

Headline:

"Semua Urusan Properti, Satu Aplikasi."

Four feature blocks:

**Kelola Kamar**
Pantau kamar kosong, terisi, dan reservasi.

**Kelola Penghuni**
Simpan data penghuni atau tamu dengan rapi.

**Kelola Tagihan**
Buat tagihan, catat pembayaran, dan pantau yang belum bayar.

**Kamelo Smart · Opsional**
Tambahkan perangkat Tuya yang kompatibel melalui integrasi yang terverifikasi. Demo menggunakan perangkat simulasi.

Use alternating imagery and concise content.

## 9.5 Why Us Section

Headline:

"Kenapa Pakai Kamelo?"

Benefits:

1. Mudah dipakai, bahkan jika belum pernah menggunakan aplikasi manajemen properti.
2. Bisa mulai gratis.
3. Data kamar, penghuni, dan pembayaran tidak lagi terpencar.
4. Bisa digunakan lewat HP, untuk kos maupun guest house.
5. Bisa berkembang menjadi smart property dengan integrasi Tuya opsional.

Do not create fake customer testimonials or unsupported performance claims.

## 9.6 How It Works

Three steps:

**1. Daftar Gratis**

Buat akun tanpa kartu kredit.

**2. Tambahkan Properti dan Kamar**

Masukkan nama dan jumlah kamar.

**3. Mulai Kelola**

Mulai mencatat penghuni, reservasi, dan tagihan.

Provide actual UI preview for each step.

## 9.7 Interactive Demo

Visitors may open a read-only product demo.

Demo modes:

- Kos
- Hotel / Guest House

The demo should display realistic sample rooms, occupancy, invoices, and optional simulated devices.

Demo access must not expose any real user or customer data.

No registration required to view the public demo.

### Kamelo Smart Section

Headline: **"Properti Biasa, Bisa Jadi Lebih Pintar."**

Description: **"Punya AC, lampu, atau smart lock pintar? Hubungkan perangkat Tuya yang kompatibel ke Kamelo Smart."**

Use authentic photographs of compatible installed devices when available, and clearly label the current demonstration as simulation. Explain that supported and verified smart-lock access can follow stay dates, while real-device activation requires compatibility verification and authorized integration. Keep IoT optional; never imply the mock controls physical hardware.

## 9.8 Pricing

Show Free, Starter, Plus.

Use the configured plan prices and limits.

Mark Smart IoT as optional.

Each pricing CTA must work:

- Free → Register.
- Starter → Register or upgrade flow.
- Plus → Register or upgrade flow.

If automated paid subscription is not yet available, present an honest request-upgrade workflow rather than a fake payment screen.

## 9.9 FAQ

Include:

- Apakah cocok untuk kos kecil?
- Apakah harus punya smart device?
- Apakah aplikasi bisa dibuka dari HP?
- Apakah data saya aman?
- Apakah bisa punya beberapa properti?
- Bagaimana cara upgrade paket?
- Apakah perlu kartu kredit?

## 9.10 Final CTA

Headline:

"Urus Properti Jadi Gampang."

Button:

"Mulai Gratis"

Supporting photograph:

Warm, realistic guest house or kos environment.

## 9.11 Footer

- Kamelo by ELENIO.
- Existing official ELENIO logo for parent-brand attribution.
- elenio.id.
- WhatsApp Business: 081933328899.
- Privacy Policy.
- Terms of Service.

---

# 10. AUTHENTICATION & ONBOARDING

## 10.1 Authentication

Required:

- Register with email and password.
- Login.
- Logout.
- Forgot/reset password.
- Email verification if configured.
- Secure session management.

Registration fields:

- Full name.
- Email.
- WhatsApp number.
- Password.

Use proper password hashing and validation.

Do not require credit card information.

## 10.2 First-Time Onboarding

Target completion: approximately 5 minutes for a basic property setup.

### Step 1 — Select Property Type

Options:

- Kos
- Hotel / Guest House

Use large selectable cards.

### Step 2 — Basic Property Information

Fields:

- Nama Properti (required).
- Jenis Properti (required).
- Kota (optional).
- Jumlah Kamar (required).
- Tarif Dasar (optional).

### Step 3 — Automatic Room Setup

Generate room numbers:

01, 02, 03, etc.

For properties with multiple floors, offer optional floor numbering later.

Enforce subscription room limits.

If requested rooms exceed the current plan limit, show upgrade options before creation. Do not create incomplete room sets without telling the user.

### Step 4 — Welcome Dashboard

Show LEO Stay:

"Properti berhasil dibuat! Yuk, tambahkan penghuni pertama."

Suggested actions:

- Tambah Penghuni.
- Buat Tagihan.
- Lihat Kamar.

Users may skip tenant setup and return later.

## 10.3 Onboarding Restrictions

Do not require:

- Tuya setup.
- Business legal documents.
- Manual creation of every room.
- Bank connection.
- Payment gateway.
- Complex tax settings.
- Complete tenant information during registration.

## 10.4 Optional Excel/CSV Import

Provide a simple import utility for existing room and occupant data.

Required behavior:

- Download template.
- Upload CSV/XLSX.
- Preview parsed rows.
- Validate required columns.
- Check duplicate room numbers.
- Check plan capacity.
- Show row-level errors.
- Confirm before import.
- Avoid partially importing invalid data without explicit user approval.

This is a secondary feature and must not block basic onboarding.

---

# 11. APPLICATION NAVIGATION

Authenticated app route: `/app`

Five primary modules:

1. Dashboard
2. Kamar & Tamu
3. Tagihan
4. Smart IoT
5. Pengaturan

Secondary pages such as reports, room details, bookings, staff, and subscriptions should be nested under the relevant primary module rather than creating a large sidebar.

## 11.1 Dashboard

Route: `/app/dashboard`

Required KPI cards:

- Total Kamar.
- Kamar Terisi.
- Kamar Kosong.
- Pemasukan Diterima Bulan Ini.
- Tagihan Belum Dibayar.

For hotel mode also show:

- Check-in Hari Ini.
- Check-out Hari Ini.
- Reservasi Mendatang.

Components:

- KPI cards.
- Simple room status chart.
- Basic monthly payment trend.
- Recent invoices.
- Recent room activity.
- Property selector.

Financial definitions:

**Pemasukan Diterima** = recorded valid payments.

**Tagihan Belum Dibayar** = unpaid invoice balances.

**Total Tagihan** = invoices issued, not necessarily collected cash.

Do not label revenue as profit because expense accounting is not part of MVP.

## 11.2 Kamar & Tamu

Routes:

- `/app/rooms`
- `/app/rooms/[roomId]`
- `/app/guests`
- `/app/bookings`

Features:

- Add room.
- Edit room.
- View room.
- Filter room.
- Search room.
- Add tenant.
- Add guest.
- Reservation.
- Check-in/check-out.
- View room history.

### Room Fields

- Room ID.
- Organization ID.
- Property ID.
- Room number.
- Room name (optional).
- Room type.
- Floor (optional).
- Default rate.
- Operational status.
- Notes.

Room occupancy must be derived from valid reservations/occupancies where practical.

Do not use payment status as a substitute for occupancy status.

### Room Display States

- Kosong.
- Dipesan.
- Terisi.
- Perlu Dibersihkan (hotel mode).
- Perawatan.

Payment indicators may be displayed separately:

- Sudah Bayar.
- Belum Bayar.
- Jatuh Tempo.

### Kos Mode

Fields:

- Tenant name.
- WhatsApp number.
- Start date.
- Optional end date.
- Monthly rent.
- Billing day.
- Active/inactive occupancy.

Support active occupancy and historical occupancy.

A room may have only one current active tenant occupancy, unless an explicit shared-room model is added in the future.

For partial first-month rentals, allow a manually adjusted first invoice. Automatic proration is not required for MVP.

### Hotel Mode

Fields:

- Guest name.
- WhatsApp number.
- Check-in date.
- Check-out date.
- Room.
- Nightly rate.
- Booking status.

Booking statuses:

- Draft.
- Confirmed.
- Checked In.
- Checked Out.
- Cancelled.
- No Show.

Calculate nights from check-in/check-out dates.

Do not allow checkout date to equal or precede check-in date.

Prevent overlapping valid reservations for the same room and date range.

Back-to-back reservations are allowed when the prior checkout date equals the next check-in date, subject to room readiness.

### Room Detail Page

Show:

1. Room information.
2. Current tenant/guest.
3. Stay or rental details.
4. Current invoice/payment status.
5. Mapped IoT devices (if enabled).
6. Recent activities.

The room detail should be the main connection between PMS and IoT.

## 11.3 Tagihan

Route: `/app/billing`

Required features:

- Create invoice.
- Edit draft invoice.
- Issue invoice.
- Record payment.
- View partial payments.
- View outstanding balance.
- Mark overdue based on due date.
- Download/print invoice.
- Share reminder via WhatsApp.
- Void invoice with authorization and audit record.

Invoice fields:

- Invoice number.
- Property.
- Room.
- Occupancy/booking reference.
- Customer name.
- Invoice date.
- Due date.
- Items.
- Total.
- Amount paid.
- Remaining balance.
- Status.

Statuses:

- Draft.
- Unpaid.
- Partially Paid.
- Paid.
- Overdue.
- Void.

### Invoice Items

Support:

- Room rent.
- Additional charge.
- Discount.
- Other manually entered items.

Optional deposits must be tracked separately from earned room revenue if implemented; do not automatically classify refundable deposits as revenue.

### Payment Recording

Fields:

- Payment date.
- Amount.
- Method.
- Reference number (optional).
- Notes.

Methods:

- Cash.
- Bank transfer.
- QRIS manual record.
- Other.

QRIS manual record does not mean the application has confirmed a payment with a payment provider.

Require explicit confirmation before recording payment.

Prevent payments exceeding outstanding balance unless a deliberately supported advance-payment mechanism exists.

### Monthly Recurring Billing

For Kos Mode:

- Generate next monthly invoice.
- Preserve original billing-day configuration.
- Support months with fewer calendar days using a defined last-day fallback.
- Avoid duplicate invoice creation.
- Support manual adjustments.

Use idempotent recurring invoice generation with database constraints.

### WhatsApp Reminder

Use an authorized WhatsApp deep link with a prefilled message.

Example:

"Halo Bapak/Ibu, kami ingin mengingatkan tagihan kamar 05 sebesar Rp1.500.000 yang jatuh tempo tanggal 10 Oktober. Terima kasih."

Opening WhatsApp is not equivalent to sending a message automatically.

Do not store a false "sent" delivery status.

## 11.4 Smart IoT

Route: `/app/iot`

Smart IoT is optional and may be unavailable under a subscription without IoT entitlement.

### Supported Device Categories

Initial:

- AC controllers/IR controllers.
- Smart switches.
- Smart plugs.
- Smart lights.
- Compatible smart locks.

### Device Setup

Flow:

1. Open Smart IoT.
2. View introductory explanation.
3. Choose available connection/setup process.
4. Complete supported authorized Tuya connection, or request assisted setup.
5. Synchronize compatible devices.
6. Assign devices to rooms.
7. Display supported control functions.

Do not promise that all consumer Tuya accounts can be linked through the same flow. The integration method depends on actual Tuya services and approved linking capabilities.

### Device List

Show:

- Friendly device name.
- Property.
- Room.
- Device category.
- Online/offline status.
- Last successful sync.
- Supported controls.

### Supported UI Controls

AC:
- Power.
- Temperature.
- Mode, only when supported.

Light:
- On/off.
- Brightness, if supported.

Smart Plug:
- On/off.
- Power/energy data, if supported.

Smart Lock:
- Supported lock state or access functions only.

Do not assume smart locks support remote unlock or temporary passwords.

### Command Handling

- Authorize user and property.
- Validate device entitlement.
- Validate command against capabilities.
- Send command through backend.
- Display pending state.
- Confirm provider result.
- Update state when confirmed.
- Log success or failure.
- Provide retry when appropriate.

Never optimistically claim a successful command without confirmation.

### Mock Mode

Provide simulated Tuya devices for:

- Product demo.
- Development.
- Automated tests.

Mock devices must be clearly marked "Simulasi".

Mock mode must not be confused with live Tuya integration.

### IoT Security

- Backend-only secrets.
- Encrypted credentials where applicable.
- Role-based control.
- Device-to-property authorization.
- Rate limiting for control commands.
- Auditable sensitive actions.
- Secure device mapping.
- Error handling for offline devices.
- Safe retries and command timeouts.

No advanced rules engine in MVP.

## 11.5 Pengaturan

Route: `/app/settings`

Subsections:

- Profil Akun.
- Informasi Properti.
- Pengaturan Kamar.
- Pengguna & Staf.
- Langganan.
- Smart IoT.
- Keamanan.

Support:

- Edit organization/property details.
- Change basic defaults.
- View subscription.
- Request plan upgrade.
- Invite/manage staff within plan limits.
- Configure allowed integration settings.
- Logout.

---

# 12. USER ROLES & PERMISSIONS

## 12.1 Property Owner

Can:

- Manage owned properties.
- Manage rooms.
- Manage occupants.
- Manage bookings.
- Manage invoices.
- Record payments.
- View financial reports.
- Manage staff.
- Configure supported IoT integrations.
- Change subscription settings.

## 12.2 Property Staff

Can:

- View assigned properties.
- Manage authorized room operations.
- Record check-in/check-out.
- View operational invoices.
- Record payments if granted permission.
- Use authorized IoT controls.

Cannot:

- View properties outside assignment.
- Access Tuya credentials.
- Change subscription.
- Manage platform tenants.
- View unrelated customer data.

## 12.3 Platform Admin

Platform-level administration is separate from customer access.

Can:

- Manage subscription plans.
- Activate approved subscriptions.
- View tenant account status.
- Manage service-level configurations.
- Assist with integration onboarding.

Platform-admin access to customer personal data must be minimized and appropriately audited.

---

# 13. CORE USER JOURNEYS

## Journey A — New Kos Owner

1. Opens landing page.
2. Clicks "Mulai Gratis".
3. Registers.
4. Selects "Kos".
5. Enters property name.
6. Creates 5 rooms under Free.
7. Adds first tenant.
8. Creates first invoice.
9. Records payment.
10. Checks dashboard.

**Expected result:** Basic operations work without technical training.

## Journey B — Kos with 20 Rooms

1. Registers or logs in.
2. Selects 20 rooms.
3. Sees Starter eligibility and upgrade requirement.
4. Activates appropriate plan.
5. Bulk-creates rooms.
6. Adds occupants.
7. Uses recurring billing.
8. Checks unpaid invoices monthly.

**Expected result:** Room limits are transparent and all room records are created consistently.

## Journey C — Small Hotel Check-in

1. Staff opens booking page.
2. Selects room and stay dates.
3. System checks availability.
4. Staff enters guest details.
5. Confirms reservation.
6. Guest arrives and checks in.
7. Invoice is generated.
8. Payment is recorded.
9. Guest checks out.
10. Room is marked for cleaning before becoming available if required.

**Expected result:** No double-booking and accurate night calculations.

## Journey D — Owner with Tuya Devices

1. Owner uses PMS normally.
2. Opens Smart IoT.
3. Selects integration setup.
4. Connects through a supported Tuya method or assisted setup.
5. Synchronizes devices.
6. Maps AC to Room 05.
7. Views compatible controls.
8. Sends on/off command.
9. Sees confirmed state or actionable error.

**Expected result:** Optional IoT adds functionality without complicating core PMS.

## Journey E — Overdue Payment

1. Invoice due date passes without full payment.
2. System calculates overdue status.
3. Owner sees unpaid amount on dashboard.
4. Owner opens the invoice.
5. Clicks "Ingatkan via WhatsApp".
6. WhatsApp opens with prefilled text.
7. Owner manually sends message.
8. Payment is later recorded.
9. Dashboard updates.

**Expected result:** Payment workflow is simple and does not fabricate automated delivery.

---

# 14. DATA MODEL

Use PostgreSQL and relational schema.

## 14.1 User

- id
- fullName
- email
- phone
- passwordHash or authProviderReference
- createdAt
- updatedAt

## 14.2 Organization

- id
- name
- ownerUserId
- subscriptionId
- createdAt
- updatedAt

## 14.3 Property

- id
- organizationId
- name
- type (`KOS`, `HOTEL`, `GUESTHOUSE`)
- city
- addressOptional
- timezone
- createdAt
- updatedAt

## 14.4 PropertyMembership

- id
- propertyId
- userId
- role
- permissions
- createdAt

## 14.5 Room

- id
- propertyId
- roomNumber
- roomName
- roomTypeId
- floor
- defaultRate
- operationalStatus
- notes
- createdAt
- updatedAt

Unique room number per property.

## 14.6 Guest

- id
- organizationId
- fullName
- phone
- emailOptional
- notes
- createdAt

Only collect personal information necessary to operate the service.

Avoid requiring identity-document uploads in MVP.

## 14.7 Occupancy

- id
- propertyId
- roomId
- guestId
- startDate
- endDate
- monthlyRate
- billingDay
- status
- createdAt
- updatedAt

Use for kos tenancy lifecycle.

## 14.8 Reservation

- id
- propertyId
- roomId
- guestId
- checkInDate
- checkOutDate
- nightlyRate
- status
- createdAt
- updatedAt

Use for hotel/guest house workflows.

## 14.9 Invoice

- id
- organizationId
- propertyId
- roomId
- occupancyIdOptional
- reservationIdOptional
- invoiceNumber
- invoiceDate
- dueDate
- totalAmount
- status
- createdAt
- updatedAt

## 14.10 InvoiceItem

- id
- invoiceId
- description
- quantity
- unitPrice
- lineTotal

## 14.11 Payment

- id
- organizationId
- invoiceId
- paymentDate
- amount
- method
- referenceOptional
- notes
- recordedBy
- createdAt

## 14.12 SubscriptionPlan

- id
- name
- monthlyPrice
- roomLimit
- propertyLimit
- userLimit
- featureEntitlements
- isActive

## 14.13 Subscription

- id
- organizationId
- planId
- status
- startDate
- endDateOptional
- updatedAt

## 14.14 IoTConnection

- id
- organizationId
- provider
- connectionStatus
- encryptedCredentialReference
- lastSyncAt
- createdAt

## 14.15 IoTDevice

- id
- organizationId
- connectionId
- providerDeviceId
- name
- category
- capabilities
- onlineStatus
- lastSeenAt

## 14.16 RoomDeviceMapping

- id
- roomId
- deviceId
- createdAt

## 14.17 DeviceCommandLog

- id
- deviceId
- userId
- commandType
- commandPayload
- status
- requestedAt
- completedAt
- errorMessageOptional

Do not expose secrets or sensitive access codes in logs.

## 14.18 AuditLog

- id
- organizationId
- actorUserId
- action
- targetType
- targetId
- timestamp
- safeMetadata

## 14.19 Database Invariants

- Every customer-owned record must be isolated by organization.
- Property permissions must be enforced server-side.
- Rooms cannot exceed plan limits during creation.
- Active occupancy conflicts must be prevented.
- Booking conflicts must be prevented.
- Invoice numbers must be unique within their defined organization scope.
- Payments must have valid positive amounts.
- Paid amount must not exceed invoice balance unless explicit advance-payment support exists.
- Invoice creation for recurring periods must be idempotent.
- Financial amounts must use safe integer IDR or appropriate fixed-point decimal types.
- Database schema must support future migrations without deleting customer data.

## 14.20 TenantLink — amendment

- Invoice relation, unique token hash, expiry, revocation, creation time, and separately authorized `includeAccess`.
- Default validity: 14 days; replacement revokes previous invoice links.
- Token scope never grants general account or property access.

## 14.21 PaymentProof — amendment

- Invoice relation; amount/date/method/reference; pending/approved/rejected status.
- Private storage key, actual MIME type, byte count, and content hash; file bytes remain private outside the database/public assets.
- Reviewer, review note/time, and optional unique linked payment.
- Transactional approval with receipt confirmation records a payment once; upload alone never confirms funds.

## 14.22 SmartAccess — amendment

- Unique device/stay pair; provider; scheduled/pending/active/revoked status; validity dates; revocation timestamp.
- Authenticated AES-256-GCM ciphertext for the simulation PIN; never plain text in audit or device state.
- Device room/property scope, stay status/dates, automation, online state, confirmed simulation, and tenant-link authority must all be checked before credential disclosure.
- Existing device records gain an explicit kind and optional automation flag without renaming or deleting prior data.

---

# 15. APPLICATION ROUTES

## Public

- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/demo`
- `/pricing`
- `/privacy`
- `/terms`

## Scoped Tenant Routes — amendment

- `/tenant/[token]`: bearer link limited to one invoice and its separately permitted stay access.
- `/api/tenant/[token]`: scoped, noncached invoice/proof status read.
- `/api/tenant/[token]/proof`: bounded authenticated-by-link evidence upload.
- `/api/proofs/[id]`: authorized private evidence download; never a static public file path.

`/pricing` may render the pricing component from the landing page or provide a dedicated lightweight view.

## Onboarding

- `/onboarding`
- `/onboarding/property`
- `/onboarding/rooms`
- `/onboarding/complete`

## Authenticated

- `/app/dashboard`
- `/app/rooms`
- `/app/rooms/[id]`
- `/app/guests`
- `/app/bookings`
- `/app/billing`
- `/app/billing/[id]`
- `/app/iot`
- `/app/settings`
- `/app/settings/property`
- `/app/settings/team`
- `/app/settings/subscription`

## Platform Admin

- `/admin`
- `/admin/organizations`
- `/admin/subscriptions`

Admin routes must be restricted to verified platform administrators and separated from customer roles.

---

# 16. TECHNICAL STACK

Inspect the existing repository before selecting technologies.

If no established stack exists:

### Frontend
- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Lucide icons.
- Recharts.

### Backend
- Next.js server-side services and API routes.
- Zod validation.
- Auth.js or equivalent secure authentication.
- Clear service and repository layers.

### Database
- PostgreSQL.
- Prisma ORM.
- Versioned migrations.

### Integrations
- Tuya Cloud APIs via server-side adapter.
- WhatsApp deep links for manual reminders.
- Optional transactional email for account verification/reset.

### Deployment
- Docker-compatible.
- Environment-based configuration.
- Managed PostgreSQL compatible.
- No need for microservices or Kubernetes.

### Engineering Principles

- Modular monolith.
- Reusable UI components.
- Server-side business rules.
- Typed data models.
- Clear separation of customer data and demo data.
- Security-first access control.
- No overengineering.

---

# 17. TUYA INTEGRATION ARCHITECTURE

Create an interface named `IoTProvider`.

Core methods:

- `listDevices()`
- `getDeviceStatus(deviceId)`
- `getDeviceCapabilities(deviceId)`
- `sendDeviceCommand(deviceId, command)`
- `syncDevices()`

Provide:

1. `MockTuyaProvider`
2. `TuyaCloudProvider`

Use the official Tuya API documentation relevant to the selected integration services.

Do not guess cloud regions, device commands, datapoints, or smart-lock compatibility.

### Integration Rules

- Keep secrets server-side.
- Encrypt stored credentials appropriately.
- Support actual capability discovery.
- Handle rate limits and authentication errors.
- Track last sync time.
- Handle offline devices.
- Distinguish requested commands from confirmed device states.
- Do not expose developer credentials to property customers.
- Use permitted Tuya connection flows.

### Technical Delivery Requirement

The first release must work completely with MockTuyaProvider.

Live Tuya integration is activated only after:

- Credentials are configured.
- API permissions are verified.
- Real devices are available.
- Device functions are confirmed.
- End-to-end tests pass.

---

# 18. SECURITY & PRIVACY

## 18.1 Authentication

- Secure password hashing.
- Session expiry.
- Password reset tokens.
- Login rate limiting.
- Protected private routes.

## 18.2 Authorization

- Enforce organization and property boundaries on every backend request.
- Never trust only the frontend to restrict access.
- Check role permissions for sensitive actions.

## 18.3 Personal Data

- Minimize guest and tenant data.
- Protect contact information.
- Restrict data access by role.
- Support appropriate retention and deletion policies.
- Provide privacy notice and service terms suitable for applicable Indonesian requirements.

## 18.4 Financial Integrity

- Audit manual payment recording.
- Protect issued invoices from unauthorized editing.
- Use void/correction workflows where necessary.
- Avoid silently deleting financial records.

## 18.5 IoT Security

- Encrypt credentials.
- Protect device commands.
- Rate-limit sensitive controls.
- Record significant actions.
- Do not expose temporary lock credentials in public URLs or logs.
- Avoid unsafe automatic remote-unlock flows.

---

# 19. NON-FUNCTIONAL REQUIREMENTS

## 19.1 Performance

- Optimize landing page Core Web Vitals.
- Lazy-load below-the-fold photographs.
- Keep hero image optimized and responsive.
- Paginate large operational lists.
- Avoid unnecessary client-side JavaScript.
- Target responsive interactions under typical mobile network conditions.

## 19.2 Accessibility

Target WCAG 2.2 AA where practical.

Requirements:

- Keyboard navigation.
- Sufficient text contrast.
- Form labels and errors.
- Visible focus states.
- Meaningful image alt text.
- Touch-friendly controls.

## 19.3 Reliability

- Persistent data storage.
- Proper database migrations.
- Graceful service errors.
- Clear integration offline states.
- No silent financial data loss.
- Backup/restore procedures documented.

## 19.4 Localization

- Bahasa Indonesia UI.
- IDR currency formatting.
- Indonesian date formatting.
- Asia/Jakarta default timezone.
- Phone number validation supporting Indonesian formats.
- Consistent local-date handling for room bookings.

---

# 20. ANALYTICS & BUSINESS METRICS

Track meaningful product events.

### Acquisition

- Landing page visitors.
- Registration starts.
- Registration completions.

### Activation

- Property created.
- First room created.
- First tenant/guest added.
- First invoice issued.

### Engagement

- Active properties.
- Active owners.
- Monthly invoices.
- Payments recorded.

### Monetization

- Upgrade requests.
- Free-to-paid conversion.
- Active paid subscriptions.
- Monthly recurring revenue.
- IoT add-on adoption.

### Retention

- Active users after 7 and 30 days.
- Property activity after 30 days.
- Subscription cancellation.

Do not expose analytics details unnecessarily in the customer dashboard.

---

# 21. DEMO DATA SPECIFICATION

Provide two demo properties.

## Demo Kos

Name: Kos Melati

- 20 rooms.
- 16 occupied.
- 4 available.
- Several paid invoices.
- Several unpaid invoices.
- A small number of simulated smart devices.

## Demo Guest House

Name: Guest House Harmoni

- 12 rooms.
- Sample upcoming reservations.
- Today's arrivals.
- Today's departures.
- Sample guest bills.
- Simulated smart lighting.

All demo data must be clearly labeled.

Use Indonesian sample names and realistic IDR values.

Do not include real personal information.

Use repeatable database seed scripts.

---

# 22. REQUIRED UI STATES

Every operational page must account for:

1. Loading.
2. Empty data.
3. Success.
4. Validation error.
5. Authorization denied.
6. Network/service error.
7. Subscription limit reached.
8. Optional integration unavailable.

Examples:

**Empty room list:**

"Belum ada kamar. Tambahkan kamar pertama untuk mulai mengelola properti."

**No invoices:**

"Belum ada tagihan. Buat tagihan pertama untuk mulai mencatat pembayaran."

**No IoT connection:**

"Belum menghubungkan perangkat pintar. Kamelo tetap bisa digunakan tanpa IoT."

**Device offline:**

"Perangkat sedang offline. Periksa koneksi perangkat sebelum mencoba kembali."

Use LEO Stay selectively for onboarding and empty/success states.

---

# 23. OUT OF SCOPE — DO NOT IMPLEMENT IN MVP

- Full enterprise hotel PMS.
- OTA/channel manager integration.
- Payment gateway.
- Automatic WhatsApp API sending.
- Sophisticated general ledger/accounting.
- Tax calculation engine.
- Payroll.
- Restaurant POS.
- AI chatbot.
- Advanced AI analytics.
- Automatic smart energy optimization.
- Complex smart-home automation.
- Unverified smart-lock access provisioning.
- Native Android/iOS apps.
- Franchise management.
- Extensive housekeeping management.
- Dynamic room pricing.

Do not introduce these modules without a new requirement.

---

# 24. IMPLEMENTATION MILESTONES

## M1 — Foundation, Branding & Landing Page

Deliver:

- Project setup.
- Design tokens.
- Official ELENIO logo usage.
- Landing page.
- Real photography.
- Mascot asset integration/placeholder.
- Responsive navigation.
- Pricing.
- FAQ.
- Demo entry point.

## M2 — Authentication & Onboarding

Deliver:

- Registration/login.
- Password reset.
- Database setup.
- Organization creation.
- Property setup.
- Automatic room creation.
- Free plan assignment.
- Welcome dashboard.

## M3 — Core PMS

Deliver:

- Room management.
- Tenant/guest management.
- Kos occupancy.
- Hotel reservation.
- Check-in/check-out.
- Dashboard operational KPIs.

## M4 — Billing

Deliver:

- Invoice.
- Invoice items.
- Manual payments.
- Recurring kos billing.
- Unpaid/overdue tracking.
- WhatsApp reminder deep links.
- Financial dashboard.

## M5 — Subscription

Deliver:

- Free/Starter/Plus configuration.
- Plan-based room limits.
- Property limits.
- User limits.
- Upgrade request.
- Admin activation.
- Feature entitlements.

## M6 — Tuya IoT

Deliver:

- Mock provider.
- IoT dashboard.
- Device mapping.
- Device status.
- Supported controls.
- Provider adapter.
- Conditional live Tuya integration.
- Command history.

## M7 — Production Readiness

Deliver:

- Mobile optimization.
- UI/UX QA.
- Security checks.
- Booking/billing tests.
- Integration tests.
- Performance optimization.
- Documentation.
- Deployment configuration.

Do not skip validation between milestones.

---

# 25. ACCEPTANCE CRITERIA

## Landing Page

- Public visitors can access homepage without login.
- Real photographic assets load correctly.
- Official ELENIO logo is unmodified.
- Copy is in natural Indonesian.
- Main CTAs navigate correctly.
- Demo is accessible.
- Mobile layout works.

## Onboarding

- User can register successfully.
- User can create a property.
- User can automatically create rooms within plan limits.
- Invalid input is handled.
- Onboarding can be completed without Tuya configuration.

## PMS

- Rooms can be created and edited.
- Tenant occupancy records persist.
- Hotel reservations persist.
- Conflicting bookings are rejected.
- Check-in/check-out changes status correctly.
- Room status reflects actual occupancy and readiness.

## Billing

- Invoices can be created.
- Invoice amounts calculate correctly.
- Payments update invoice balances.
- Partial payments work.
- Recurring invoices do not duplicate.
- Overdue status is accurate.
- WhatsApp reminder opens correctly.
- Financial data appears accurately on dashboard.

## Subscription

- Free limit is enforced.
- Paid limits are enforced.
- Admin can activate plans.
- Data is not deleted on downgrade.
- Feature entitlements are applied server-side.

## IoT

- Mock devices work in demo.
- Real integration is optional.
- Device mapping works.
- Commands are validated.
- Unsupported functions are hidden.
- Offline/error states work.
- Live device commands are auditable.

## Security

- Unauthorized access is rejected.
- Users cannot access another organization's data.
- Staff can access only assigned properties.
- Credentials are not exposed.
- Sensitive operations are auditable.

---

# 26. TEST PLAN

Use automated tests for critical domain logic.

### Required Unit Tests

- Invoice totals.
- Partial payment calculations.
- Recurring monthly billing.
- Month-end billing dates.
- Booking night calculations.
- Room status derivation.
- Subscription limits.
- IoT capability validation.

### Required Integration Tests

- User registration and property creation.
- Tenant onboarding.
- Booking conflict prevention.
- Invoice/payment persistence.
- Staff permission enforcement.
- Organization data isolation.
- Mock Tuya command lifecycle.

### Required E2E Scenarios

**Scenario A**

Register → Create 5 rooms → Add tenant → Create invoice → Record payment → Verify dashboard.

**Scenario B**

Activate Starter → Create 20 rooms → Generate recurring billing → Verify room and plan limits.

**Scenario C**

Create hotel booking → Attempt conflicting booking → Reject conflict → Check in → Check out.

**Scenario D**

Map mock Tuya device → Send control → Confirm result → Verify audit log.

**Scenario E**

Attempt to access another organization's property → Access denied.

Do not consider the project complete solely because pages render without errors.

---

# 27. REPOSITORY & DOCUMENTATION

Suggested documentation files:

- `README.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/TUYA_INTEGRATION.md`
- `docs/BRAND_ASSETS.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `.env.example`

Provide:

- Local installation instructions.
- Environment variable instructions.
- Database migration commands.
- Seed/demo data commands.
- Test commands.
- Build commands.
- Deployment instructions.
- Missing asset/integration dependencies.
- Known limitations.

Do not commit secrets or API credentials.

---

# 28. DEVELOPMENT WORKFLOW FOR CODEX

## Step 1 — Repository Inspection

Before implementation:

- Inspect repository structure.
- Identify existing framework.
- Inspect current pages.
- Identify existing components and authentication.
- Identify database and environment configuration.
- Identify available official brand assets.
- Identify mascot source files.

Do not overwrite working functionality without reason.

## Step 2 — Gap Analysis

Compare the current repository against this PRD.

Classify features:

- Existing and working.
- Existing but incomplete.
- Missing.
- Blocked by external assets/credentials.

Create a concise implementation checklist.

## Step 3 — Execute Milestones

Implement milestone by milestone.

For each milestone:

1. Implement functional requirements.
2. Run relevant validation.
3. Fix errors.
4. Document changes.
5. Update implementation status.

Prefer working vertical slices over creating dozens of empty pages.

## Step 4 — Asset Handling

If official ELENIO logos are provided, use the exact assets.

If official LEO mascot artwork is provided, create or integrate the approved LEO Stay variants without losing the original character identity.

If image-generation capabilities are unavailable, use image placeholders and record the missing deliverables.

Select genuine licensed photographs for public pages.

Do not use fake testimonials or fabricated customer photographs.

## Step 5 — Quality Review

Verify:

- UX simplicity.
- Navigation clarity.
- Database correctness.
- Authorization.
- Responsive behavior.
- Functional forms.
- Correct billing calculations.
- Clear integration states.

---

# 29. FINAL MASTER INSTRUCTION TO CODEX

You are the lead full-stack engineer and product-minded UI/UX developer implementing Kamelo by ELENIO, a lightweight property management SaaS by ELENIO.

Use this PRD as the single source of truth.

The product is intended for small Indonesian boarding houses, guest houses, and budget hotels.

It must be affordable, straightforward, mobile-friendly, and immediately useful to nontechnical property owners.

**Critical requirements:**

1. Preserve the existing repository and working features.
2. Follow the official ELENIO brand identity strictly.
3. Never modify or regenerate the original ELENIO logo.
4. Implement LEO Stay only as a faithful derivative of the existing LEO mascot.
5. Build a polished, image-rich public landing page with authentic licensed property photography.
6. Use a light, clean, friendly SaaS design system.
7. Build fast self-service registration and property onboarding.
8. Implement a functional multi-tenant PMS with persistent database storage.
9. Keep the primary portal navigation limited to five modules.
10. Support both monthly kos operations and daily hotel/guest house bookings.
11. Implement accurate billing, payment records, and financial dashboards.
12. Use a configurable freemium subscription model.
13. Keep Tuya IoT completely optional and capability-driven.
14. Clearly distinguish simulated integrations from real ones.
15. Protect tenant/customer data and device operations.
16. Implement responsive interfaces suitable for smartphones.
17. Do not add enterprise functionality outside the approved MVP scope.
18. Do not build static screens that pretend to be functional.
19. Validate functionality with tests.
20. Deliver in milestones and document what works and what remains blocked.

**Definition of Success:**

A nontechnical property owner can register, set up a small property, manage rooms and occupants, create invoices, record payments, and monitor basic operations without training.

Owners who need smart-property functionality can later integrate supported Tuya devices without migrating to a different platform.

The result must be a real, working, maintainable SaaS application—not a visual-only demonstration.

**Start by inspecting the repository, mapping gaps against this PRD, and implementing Milestone 1. Continue through the defined milestones while validating each stage.**
