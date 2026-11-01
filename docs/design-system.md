# QUANTARA design system

The existing landing page is the visual source of truth. `App.css`, `index.css`,
`Auth.css`, and `AuthLayout.tsx` are preserved. The landing component's code is
checked independently of routing in `landing-preservation.json`.

| Element | Existing convention reused by the workspace |
| --- | --- |
| Typography | Browser-verified Inter / Segoe UI body inherited from `index.css`; DM Serif Display editorial headings from `App.css` |
| Primary | Forest `#315b43`, deep ink `#233e2e` |
| Surfaces | Warm white `#fbfcfa`, white, soft sage `#f6f9f5` |
| Accents | Sage `#688d70`, pale green `#eaf2e8`, borders `#e2ebe0` |
| Atmosphere | Existing green grid, blurred sage/peach/lavender auras, translucent panels |
| Shape | Rounded 12–23px panels, pill actions, circular icon treatments |
| Motion | Gentle fade/translate, hover lift; reduced-motion support |
| Charts | Existing forest/sage strokes, pale green area gradients, quiet grid lines |
| Breakpoints | Existing 1150px / 900px / 680px layout approach |

Tailwind CSS v4 remains enabled through `@tailwindcss/vite` and the existing
`@import "tailwindcss"`. Workspace tokens and selectors are scoped to
`.quantara-app`. Its dark theme reuses the landing page's dark SQL/security
surfaces and pale green foregrounds, without changing the public page or auth UI.
