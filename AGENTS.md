# AGENTS.md - Ainomiq App UI Rules

This repository must keep one consistent Ainomiq product style across every dashboard module and automation.

## Visual Direction

- Apple/iOS clean: airy spacing, restrained controls, calm surfaces, crisp typography, obvious hierarchy.
- Future AI luxury: subtle blue light, glassy white surfaces, high-quality shadows, polished motion, never gimmicky.
- Operational clarity first: users should immediately know what they can do, what is loading, what costs credits, and what changed.

## Layout Rules

- Do not create container-in-container-in-container UI. A page may have one main shell, sections inside it, and cards only for repeated items, modals, or genuinely grouped tools.
- For hero or premium sections, use a flat section with one intentional visual card. Do not wrap a large hero in another bordered panel.
- Prefer full-width unframed sections or `clean` panels when the child already has its own surface.
- Keep cards radius between 16px and 28px depending on hierarchy. Do not mix random radii.
- Keep buttons, inputs, dropdowns and pills consistent with the global `.ai-*` classes in `app/globals.css`.

## Interaction Rules

- Every dropdown/popover must close on outside click and Escape.
- Every paid/compute action must show cost before action, loading while running, and clear success/failure feedback after.
- Long async work must show motion or progressive state, never static dead text.
- Feedback/revision flows must preserve previous context and feel iterative, not like a brand-new disconnected action.

## Copy Rules

- Short, direct, useful. No duplicate helper text.
- Avoid explaining obvious UI. Use labels that name the action.
- Use "Nomi's" for Logic Ads credits in visible UI.

## New Automation Checklist

- Use dashboard shell spacing and Ainomiq tokens from `app/globals.css`.
- Use `components/AutomationWorkspaceLayout.tsx` for automation workspaces that need module navigation or settings. The sticky left menu pattern from Logic Ads is the standard for Mail/Socials/Calls/Settings-style navigation.
- Add a clear page header, segmented local nav when needed, and one primary work surface.
- Avoid marketing landing pages inside the app. Build the usable workflow first.
- Use lucide icons where React components are available.
- Before shipping, scan for nested cards, mismatched icons, dead dropdowns, unclear loading states, and text overflow.
