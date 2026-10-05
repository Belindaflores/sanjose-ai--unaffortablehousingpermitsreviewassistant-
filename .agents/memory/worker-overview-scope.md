---
name: Worker overview creation scope
description: Staff Overview header is for review; applicant application creation remains available.
---

The City Worker Overview header must not offer applicant submission creation. Permit applicants must retain the New application / Start a new application feature.

**Why:** The user stated that city workers review and process applications, while permit applicants create submissions. The requested change was expressly limited to the staff Overview's top-right header.

**How to apply:** Use portal-role conditional rendering for the header action. Preserve Open review queue, metrics, dashboard cards, navigation, applicant-facing features, and the application creation route/form. Do not extend this header-only change to other controls without an explicit request.