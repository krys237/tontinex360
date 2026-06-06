# Tontinex360 — Mobile App UI Kit

A high-fidelity, interactive recreation of the **Tontinex360 member mobile app**
(React Native / Expo original). Built as plain React + Babel in the browser, wrapped in an
iPhone device frame. This is a **cosmetic prototype** — navigation and data are faked — but
the visuals are pixel-faithful to the production app.

## Run
Open `index.html`. Tap the bottom tab bar to move between screens.

## Screens (recreated from app screenshots + source code)
The app is **mobile-first** for members. Bottom navigation has **5 tabs**:
**Accueil · Tontines · Communauté · Finances · Profil**.

- **Accueil** (`screen-home.jsx`) — greeting, "à jour" status banner, stat tiles, cotisation
  progress, primary CTA, recent activity, no-delay banner.
- **Tontines** (`screen-contribute.jsx`) — the member's tontine view: piggy-bank hero with
  status + next due, three mini-stats, contribution history list.
- **Communauté** (`screen-community.jsx`) — segmented tabs, bureau meeting announcement,
  upcoming events list with attendance buttons.
- **Finances** (`screen-finances.jsx`) — wallet balance hero, quick actions, next payment,
  recent transactions ledger.
- **Profil** (`screen-profile.jsx`) — profile hero (avatar + camera badge, role chip, mini-stats),
  grouped settings rows (Compte, Préférences with a notifications toggle, Mon association,
  Support) and a logout button. Designed on-brand (no reference screenshot existed).

## Architecture
| File | Role |
|------|------|
| `index.html` | Loads React 18, Babel, fonts, then all JSX in order; mounts `<App>` |
| `icons.jsx` | **Inline SVG icon set** (Ionicons-style). Self-contained — see note below |
| `primitives.jsx` | `TX` token object + shared components: `Card`, `Button`, `Chip`, `IconBubble`, `StatTile`, `Avatar`, `ProgressBar`, `SectionHeader`, `HeaderIconBtn` |
| `screen-*.jsx` | One file per screen |
| `app.jsx` | `TabBar`, screen routing, toast, device-frame composition |
| `ios-frame.jsx` | iPhone bezel / status bar / dynamic island / home indicator (starter component) |

Each `*.jsx` file exports its components to `window` (Babel scripts don't share scope).
Load order matters: `icons` → `primitives` → screens → `ios-frame` → `app`.

## Iconography note
The production app uses **Ionicons** via `@expo/vector-icons`. Ionicons' web component
(`<ion-icon>`) fetches each glyph's SVG from a CDN **at runtime**, which fails in sandboxed
iframes and breaks screenshot/PDF export. So this kit ships **faithful inline-SVG
renditions** of the exact Ionicons glyphs used (same filled/outline style), driven by
`currentColor`. To use real Ionicons in a production web context, swap `<Icon name>` for
`<ion-icon name>` and load the Ionicons module.

## Tokens
All colors/shadows/gradients live in the `TX` object at the top of `primitives.jsx`, mirroring
`colors_and_type.css` at the project root. Font is **Poppins** (Google Fonts).
