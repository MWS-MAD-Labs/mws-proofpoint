# ProofPoint Engineering Constitution

**Version:** 1.0.0  
**Ratified:** 2026-07-31  
**Last amended:** 2026-07-31

## 1. ProofPoint Identity, MWS Design Authority

ProofPoint MUST remain a distinct product while its complete user experience aligns with the [MWS Heart & Purpose UI Kit](https://ui-kit.mws.web.id/). The MWS UI Kit is the authoritative reference for typography, spacing, radii, elevation, interaction states, component composition, responsive behavior, motion, and accessibility.

ProofPoint MUST use Truth Navy (`#1F2A44`) as its principal brand and primary action color. The existing ProofPoint waveform mark in `src/app/icon.tsx` is the approved product logo and MUST be used consistently, including application icon and print identity. MWS logos, crests, or logo derivatives MUST NOT be committed to or distributed from this repository. Alignment with MWS MUST be expressed through the design system, never by displaying an MWS logo.

**Rationale:** ProofPoint belongs to the MWS product ecosystem but requires a clear identity centered on truth, evidence, and trust.

## 2. Semantic Design Tokens Are Mandatory

All visual properties MUST use centralized semantic design tokens rather than page-level color decisions. The token system MUST cover brand and action colors, text hierarchy, surfaces, borders, focus indicators, status states, typography, spacing, radii, shadows, motion, charts, and print presentation.

Truth Navy MUST drive primary actions, active navigation, selected states, links and focus treatments, evidence emphasis, primary data visualization, and product identity. Supporting MWS colors MUST be used according to meaning:

- Goodness Sage: success, completion, and growth
- Happiness Gold: warning, attention, and celebration
- Compassion Rose: destructive actions, errors, and wellbeing
- Millennia Sky: information, calm secondary emphasis, and reflection
- Deep Charcoal: primary readable text

Raw hexadecimal colors and direct framework palette utilities MUST NOT be introduced in feature code where a semantic token applies. Official third-party brand artwork is exempt when its colors are required.

**Rationale:** Semantic tokens prevent visual drift across themes, components, print, and future features.

## 3. Complete System Consistency

Every user-visible surface MUST conform to the same design language, including authentication, dashboards, appraisals, assessments, strategic planning, observations, administration, forms, dialogs, tables, navigation, states, notifications, charts, reports, print output, metadata, icons, themes, and responsive layouts.

A feature is not complete if it introduces an isolated visual style, unmapped color, inconsistent interaction, or inaccessible state. Shared primitives MUST be corrected before local exceptions are created. Duplicating a shared component solely to change appearance is prohibited.

**Rationale:** Total alignment is a system-wide requirement, not a primary-color substitution.

## 4. Component and Architecture Standards

ProofPoint MUST retain its established Next.js, TypeScript, Tailwind CSS, Radix UI, and shadcn-style architecture unless an approved architectural change replaces it. Design implementation MUST preserve semantic CSS variables as the integration boundary, map Tailwind utilities to semantic tokens, prefer shared components, keep business logic separate from presentation primitives, preserve server/client boundaries, and avoid a competing styling framework.

New dependencies MUST provide a material capability unavailable from the existing stack. Intentional deviations from the MWS UI Kit MUST be documented.

**Rationale:** Alignment should simplify the system rather than create parallel component libraries.

## 5. UX and Accessibility

All workflows MUST preserve ProofPoint’s evidence-first principle: **No Evidence, No Score.** Evidence, status, ownership, required actions, and approval state MUST be immediately understandable.

User-facing changes MUST meet WCAG 2.1 AA contrast, support keyboard operation, show visible focus, use semantic elements and accessible names, avoid color-only meaning, provide understandable validation, respect reduced motion, remain usable at mobile widths and 200% zoom, and work in light and dark themes.

Motion MUST clarify state or hierarchy and MUST NOT block tasks or delay feedback.

**Rationale:** Visual consistency succeeds only when it improves clarity, trust, and access.

## 6. Quality and Testing Standards

Every change MUST pass the repository’s build and lint checks. Shared component, token, theme, or layout changes MUST be validated against representative authentication, dashboard, appraisal, administrative, and strategic-planning workflows in light and dark themes and mobile and desktop viewports. Keyboard navigation and affected print output MUST also be checked.

Design-system work MUST audit direct palette utilities, unapproved hexadecimal colors, duplicate styles, missing semantic states, MWS logo assets or references, and stale icon metadata. Automated behavior tests SHOULD cover regression-prone contracts; visual regression tests SHOULD be added when infrastructure permits.

No change may claim total alignment while known inconsistent surfaces remain undocumented.

**Rationale:** System-wide standards require repeatable verification rather than subjective spot checks.

## 7. Performance and Resilience

Design alignment MUST NOT materially degrade performance. Implementations MUST avoid unnecessarily large assets, duplicate fonts, layout shifts, excessive effects, and interaction-blocking animation. Images and icons MUST be optimized, and interfaces MUST remain understandable when optional media fails. Core Web Vitals SHOULD be evaluated when shared layout, fonts, or major visual components change.

**Rationale:** A polished interface that is slow or unstable does not meet the MWS quality standard.

## 8. Security, Privacy, and Observability

Visual and component changes MUST preserve authentication, authorization, and evidence-access boundaries. User-facing errors MUST be actionable without exposing secrets, internal paths, storage keys, stack traces, or sensitive personal data. Important workflow failures SHOULD produce structured server diagnostics without credentials or evidence contents.

External assets, fonts, and services MUST be assessed for privacy, availability, and deployment impact. Critical UI SHOULD NOT depend on an uncontrolled third-party host.

**Rationale:** Design consistency must not weaken ProofPoint’s trust or confidentiality.

## 9. Governance

This constitution supersedes local styling preferences and undocumented visual conventions. User-visible pull requests MUST identify the semantic tokens or shared components used, validation performed across themes and responsive states, accessibility checks, and any intentional UI Kit deviation.

Exceptions MUST include a reason, owner, and removal or review condition. Amendments require a rationale, affected-artifact review, migration plan for incompatible changes, semantic version update, and amendment date.

- **Major:** removes or fundamentally redefines a principle
- **Minor:** adds or materially expands mandatory requirements
- **Patch:** clarifies language without changing obligations

Compliance MUST be reviewed whenever shared design tokens, branding, component foundations, or the MWS UI Kit materially changes.
