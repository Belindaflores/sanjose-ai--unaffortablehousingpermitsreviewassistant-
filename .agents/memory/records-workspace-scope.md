---
name: Housing-focused records workspace
description: Primary staff pages share a database-backed housing-focused population; private applicant records and official source totals remain separate.
---

Primary staff Overview, Applications, Application Records, Analytics, search, filters, and record details must all use one database-backed demonstration population. It prioritizes San José housing production and affordable/below-market-rate housing. Official source populations and private applicant submissions are separate.

**Why:** The user explicitly requested a database architecture audit after the preview redesign and required all primary staff pages to read the database, replacing both runtime fixtures and the former split-population summaries. The screener focuses on housing availability and San José's unaffordable housing crisis; its synthetic examples are not official filings.

**How to apply:** Keep seeding explicit and additive; never rebuild or silently substitute fixture records in API reads. Calculate all primary staff metrics from persisted records. Preserve the separate existing intake review/history workflow and applicant-owned work rather than deleting them to unify the demonstration pages. Clearly disclose synthetic examples in every category and distinguish official source totals from workspace rows.

Staff presentation must not repeat record-category summary cards, category counts, or synthetic-population totals across tabs, and must not show the “Prototype Submissions” category label anywhere.

**Why:** The user explicitly wants staff pages focused on actions, review status, workload, and details, without deleting any underlying demonstration records.

**How to apply:** Keep every persisted record searchable and visible under All, including records whose category label is hidden. Show only All, City Housing Permits, and County Public Data in the Application Records category dropdown, without totals. Official City dataset population information belongs only on Application Records, not other staff tabs.