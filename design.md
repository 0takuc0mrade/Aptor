# Design — Aptor

A locked design system for Aptor’s end-user application. Every role page uses
the same typography, colour, interaction, and privacy vocabulary while its
layout follows the work that role actually performs.

## Genre

Editorial product UI with the hand-set energy of an independent zine. The
interface is dark, precise, and task-led, but its composition can feel cropped,
offset, and deliberately printed rather than corporate. It never uses
cryptography as decoration.

## Macrostructure family

- Marketing pages: cinematic Marquee Hero with bottom-left product copy, a
  restrained broadcast rail over moving media, and direct role entry.
- App pages: Narrative Workflow with an offset studio composition. Stage order
  is real and role-specific; page arrangements vary to fit credential issuance,
  proof generation, or proof inspection.
- Content pages: Long Document, typography only.

## Theme

- `--color-paper`: `oklch(0.1365 0.0090 285.1)`
- `--color-paper-2`: `oklch(0.1760 0.0123 285.1)`
- `--color-paper-3`: `oklch(0.2089 0.0177 284.8)`
- `--color-ink`: `oklch(0.9737 0.0095 299.2)`
- `--color-neutral`: `oklch(0.7686 0.0229 297.3)`
- `--color-muted`: `oklch(0.5820 0.0261 296.4)`
- `--color-rule`: `oklch(0.2877 0.0236 288.3)`
- `--color-accent`: `oklch(0.6232 0.2207 290.7)`
- `--color-accent-secondary`: `oklch(0.6188 0.2049 268)`
- `--color-focus`: `oklch(0.7984 0.1129 294)`

## Typography

- Display: IBM Plex Sans Variable, weight 700, normal.
- Body: IBM Plex Sans Variable, weight 400.
- Mono: JetBrains Mono Variable, weight 500; reserved for system state,
  sequence identifiers, and the wordmark.
- Display tracking: `-0.035em`.
- Product headings use a fixed rem scale rather than fluid display type.
- Large sequence numerals and redaction bars provide the zine-like display
  register without introducing another font family.

## Spacing

Four-point named scale. Values live in `tokens.css`; application CSS references
tokens rather than raw spacing values.

## Motion

- State feedback only: colour and one-pixel press movement.
- Easings: exponential `--ease-out`, `--ease-in`, and `--ease-in-out`.
- No page-load choreography or decorative scroll animation.
- Reduced motion: state changes are effectively instant and remain legible.

## Art direction

- Flat colour only. Violet and cobalt behave like spot inks.
- Redaction bars are the recurring visual signature: they mean “information
  deliberately withheld,” never generic decoration.
- Oversized cropped stage words (`ISSUE`, `HOLD`, `VERIFY`) behave like poster
  typography and always name the active role’s real place in the trust path.
- Primary workflow sheets may use a tight hard-offset spot-ink shadow and a
  sub-degree rotation to suggest hand registration without imitating damaged
  paper.
- Panels may shift vertically off the shared baseline on desktop, but reading
  order and mobile flow stay conventional.
- No grain filters, torn-paper effects, doodles, stickers, or fake print damage.
- Landing media is poster-first and may become a muted HLS loop. Translucency is
  restricted to navigation placed over that moving media; it is functional
  separation, not a glass-card motif.

## Microinteractions stance

- Silent success.
- Focus feedback is immediate; pointer hover is secondary.
- Disabled workflow actions always include an adjacent reason.
- Role switching uses colour, position, and `aria-current`, never colour alone.

## CTA voice

- Primary: compact solid violet, 6 px radius, specific verb.
- Secondary: transparent surface with a visible rule and specific verb.
- Planned actions are disabled and paired with an implementation-status note.

## Per-page allowances

- App pages do not use decorative enrichment; product structure carries them.
- Issuer may emphasize ordered review and issuance stages.
- Professional may use an asymmetric vault/request workspace.
- Verifier may use a requirements builder beside a result inspection surface.

## What pages MUST share

- Aptor wordmark and active-role navigation.
- Midnight/violet/cobalt palette and semantic state colours.
- IBM Plex Sans + JetBrains Mono typography.
- Button, status, privacy-boundary, empty-state, and focus vocabulary.
- Honest foundation-state copy with no fabricated credentials or results.

## What pages MAY differ on

- Grid proportions and panel order.
- Which workflow stage receives the most visual weight.
- Empty-state structure appropriate to each role.

## Exports

### tokens.css

The canonical implementation is in `tokens.css` at the repository root.

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(0.1365 0.009 285.1);
  --color-paper-2: oklch(0.176 0.0123 285.1);
  --color-paper-3: oklch(0.2089 0.0177 284.8);
  --color-ink: oklch(0.9737 0.0095 299.2);
  --color-neutral: oklch(0.7686 0.0229 297.3);
  --color-muted: oklch(0.582 0.0261 296.4);
  --color-rule: oklch(0.2877 0.0236 288.3);
  --color-accent: oklch(0.6232 0.2207 290.7);
  --color-focus: oklch(0.7984 0.1129 294);
  --font-display: "IBM Plex Sans Variable", ui-sans-serif, sans-serif;
  --font-body: "IBM Plex Sans Variable", ui-sans-serif, sans-serif;
  --font-outlier: "JetBrains Mono Variable", ui-monospace, monospace;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2.5rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --radius-card: 0.75rem;
  --radius-input: 0.375rem;
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(0.1365 0.009 285.1)", "$type": "color" },
    "ink": { "$value": "oklch(0.9737 0.0095 299.2)", "$type": "color" },
    "accent": { "$value": "oklch(0.6232 0.2207 290.7)", "$type": "color" },
    "focus": { "$value": "oklch(0.7984 0.1129 294)", "$type": "color" }
  },
  "font": {
    "display": {
      "$value": "IBM Plex Sans Variable, sans-serif",
      "$type": "fontFamily"
    },
    "body": {
      "$value": "IBM Plex Sans Variable, sans-serif",
      "$type": "fontFamily"
    },
    "outlier": {
      "$value": "JetBrains Mono Variable, monospace",
      "$type": "fontFamily"
    }
  },
  "space": {
    "md": { "$value": "1rem", "$type": "dimension" },
    "lg": { "$value": "1.5rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 0.1365 0.009 285.1;
  --foreground: 0.9737 0.0095 299.2;
  --primary: 0.6232 0.2207 290.7;
  --primary-foreground: 0.9737 0.0095 299.2;
  --muted: 0.2089 0.0177 284.8;
  --muted-foreground: 0.7686 0.0229 297.3;
  --border: 0.2877 0.0236 288.3;
  --input: 0.2877 0.0236 288.3;
  --ring: 0.7984 0.1129 294;
  --radius: 0.75rem;
}
```
