---
name: Cordon
description: Evidence-first repository inspection before local execution.
colors:
  midnight: "oklch(0.132 0.011 265)"
  inspection-surface: "oklch(0.174 0.016 265)"
  raised-surface: "oklch(0.212 0.020 265)"
  rule: "oklch(0.302 0.025 265)"
  primary-ink: "oklch(0.968 0.009 265)"
  secondary-ink: "oklch(0.775 0.024 265)"
  inspection-cobalt: "oklch(0.684 0.181 252)"
  warning-amber: "oklch(0.790 0.148 78)"
  critical-red: "oklch(0.670 0.205 24)"
  safe-mint: "oklch(0.770 0.125 160)"
typography:
  display:
    fontFamily: "IBM Plex Sans Variable, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  body:
    fontFamily: "IBM Plex Sans Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.inspection-cobalt}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  input:
    backgroundColor: "{colors.inspection-surface}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
---

# Design System: Cordon

## Overview

**Creative North Star: “The Evidence Desk”**

Cordon inherits Aptor’s dark editorial-product discipline, IBM Plex typography, four-point rhythm, and hard-edged information hierarchy. Its working surface is cooler and more forensic: cobalt marks inspection and selection, while amber and red are reserved for verified risk states. The interface should feel like a tool a careful engineer can trust at the end of a long workday, not a security-themed spectacle.

Layouts are dense but not cramped. Real repository data, source evidence, rules, and execution paths carry the visual weight. No decorative dashboard metrics are invented.

## Colors

The palette is a cool midnight field with a restrained cobalt inspection signal and explicit semantic risk colors.

- **Midnight:** `oklch(0.132 0.011 265)` — root canvas.
- **Inspection surface:** `oklch(0.174 0.016 265)` — tool panels and rows.
- **Raised surface:** `oklch(0.212 0.020 265)` — selected and expanded states.
- **Inspection cobalt:** `oklch(0.684 0.181 252)` — primary action, focus, and active state only.
- **Warning amber:** `oklch(0.790 0.148 78)` — review-required state.
- **Critical red:** `oklch(0.670 0.205 24)` — high and critical findings.
- **Safe mint:** `oklch(0.770 0.125 160)` — completed low-risk state.

The cobalt accent occupies less than 5% of a normal viewport. Severity is always written as text and never communicated by color alone.

## Typography

**Display and Body Font:** IBM Plex Sans Variable.  
**Code and Evidence Font:** JetBrains Mono Variable.

IBM Plex keeps the Aptor family resemblance and gives product labels a serious engineering cadence. JetBrains Mono is reserved for repository identifiers, hashes, paths, evidence, and numerical scan data.

- Display: 700 weight, fixed product scale, `-0.035em` tracking.
- Headline: 700 weight, 1.375–1.75rem.
- Body: 400 weight, 1rem, 1.6 line-height, 65–75ch for prose.
- Label/data: 500 weight mono, 0.75–0.875rem with tabular figures.

## Elevation

Cordon is flat by default. Depth comes from tonal surface steps, strong rules, and selected-row contrast—not ambient shadows or glows. The primary scan workbench uses one compact hard-offset cobalt shadow as a direct Aptor family cue.

## Components

Buttons and inputs share a 48px minimum height, 6px radius, constant border geometry, and immediate focus rings. Tables collapse into labeled records on narrow screens. Finding rows expose summary evidence first and use native disclosure for the full explanation and recommendation. Loading uses a structured progress ledger rather than a centered spinner.

The header is edge-aligned: brand at the start, operational status at the end. The footer is a single ruled line carrying the safety limitation.

## Do's and Don'ts

### Do:

- **Do** show severity, category, file, line, evidence, and recommended action together.
- **Do** keep deterministic findings visually separate from combined attack-path reasoning.
- **Do** use monospace for code, paths, hashes, URLs, and scan counts.
- **Do** explain that low risk is not a guarantee of safety.

### Don't:

- **Don't** use glassmorphism, excessive gradients, neon cyberpunk visuals, or glowing borders.
- **Don't** use giant marketing headlines, floating decorative cards, fake terminal animations, or generic sparkle icons.
- **Don't** fabricate findings, scan activity, repository metrics, testimonials, or safety guarantees.
- **Don't** communicate severity through red and green alone.
- **Don't** nest bordered cards or use colored side-stripe accents.
