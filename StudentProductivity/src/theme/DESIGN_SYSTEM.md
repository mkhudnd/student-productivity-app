# Student Productivity V2 Design System

The app uses one shared visual system. New screens should not create their own button, card, icon-badge, metric, or section-header language unless a genuinely new component is required.

## Foundation

Use `src/theme/designSystem.js` for:

- spacing
- radii
- typography
- layout measurements
- shadows
- semantic palette values

Avoid hard-coded spacing, font weights, radii and one-off surface colors where a shared token exists.

## Shared UI primitives

Use `src/components/ui.js` for common interface elements:

- `AppIcon`
- `IconButton`
- `Card`
- `PrimaryButton`
- `SecondaryButton`
- `SectionHeader`
- `ScreenIntro`
- `MetricCard`
- `ProgressBar`

Use `ScreenLayout` for screen-safe-area, scrolling and common header behavior. Auth screens should use `AuthScaffold` and `AuthField`.

## Icon rule

Icons are glyphs, not badges.

- Do not put ordinary icons inside colored circles, squares, pills or tinted wrapper views.
- Use `AppIcon` directly when an icon is informational.
- Use `IconButton` when the icon is the action.
- Color may communicate state or emphasis, but the icon should normally sit directly on the surrounding surface.
- A container is acceptable only when the container itself is the control or data component, not merely decoration around an icon.

## Screen hierarchy

The V2 hierarchy is inspired by calm, editorial productivity products:

1. one clear screen title / intro
2. one dominant next-action or status card
3. compact metrics where useful
4. section headers that explain what comes next
5. grouped list/card content with restrained borders and shadows

Primary workflow:

**Today → Plan → Focus → Learn → Progress**

Profile, Settings, deck editing and study setup are secondary destinations and should use the same primitives.

## Color

Student Productivity keeps its own indigo/teal identity.

- Indigo: primary actions, selected state, important navigation
- Teal: positive progress / success
- Warning/error colors: only for semantic state
- Tinted surfaces should be used for content state, not as decorative icon wrappers

## Typography

Poppins is loaded once at the app root. Use `typography.regular`, `typography.semibold` and `typography.bold`; do not rely on raw `fontWeight` for V2 screens.

## Component ownership

If the same pattern appears on two screens, move it into the shared UI layer instead of duplicating styles. Screen-specific styles should describe screen composition, not redefine the design language.
