# DentOS — Design.md

## Status of This Document
Reflects the current, real UI as verified in the repo (`tailwind.config.js`, `app/globals.css`, shadcn/ui setup) and observed in the product demo video. This is not a redesign spec — it documents what exists so new work stays visually consistent.

## System
- **Component library:** shadcn/ui, "new-york" style, built on Radix UI primitives.
- **Styling:** Tailwind CSS 3.4, using CSS custom properties (HSL-based variables) rather than hardcoded hex values — colors are defined as `hsl(var(--token))` and themed via `next-themes` (light/dark).
- **Icons:** Lucide React.
- **Do not introduce a second component library or a different theming approach** (see Rules.md).

## Observed Visual Language (from live product)
- **Sidebar:** dark background, persistent left navigation, clinic name + logged-in user/role shown at the bottom.
- **Primary action color:** teal/green (used for primary buttons like "New Appointment," "Book," "Save Changes," status badges like "Paid"/"Completed").
- **Status color conventions observed:**
  - Green — Paid, Completed, positive states
  - Orange/amber — Pending, In Production, warnings
  - Red — Urgent, Allergy alerts, destructive actions
  - Blue — informational badges, links
- **Cards/panels:** white background, light borders, rounded corners, consistent with default shadcn card styling.
- **Typography:** clean sans-serif, standard Tailwind type scale — no custom font loading observed beyond the default stack.

## Key Screens (for reference/consistency when building new ones)
- Dashboard: metric cards row (Patients Seen Today, Revenue Collected, Pending Payments, Follow-ups Due, Awaiting Lab Acceptance, Overdue Cases) + "Today's Appointment Queue" table + "Pending Follow-ups" panel.
- Patient profile: tabs (Visit History, Appointments, Documents, Lab Cases, AI Summary), allergy alert banner in red when present.
- Billing: summary totals row + filterable/searchable invoice table with status badges and per-row actions.
- Lab case detail: two-column layout — vendor contact/actions on the left, case details/attachments/status timeline/audit log on the right.

## Rule for New UI Work
Match existing patterns above by default. If a new screen needs a genuinely new pattern (e.g., the eventual Super Admin panel), flag it as a new pattern explicitly rather than silently diverging from the established look.