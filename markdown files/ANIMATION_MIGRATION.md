# Animation Migration Guide & Architecture

## Migration Overview
This guide details the integration of **Framer Motion** into the React application to enhance the UI/UX with professional, subtle motions akin to VS Code. 

### Why Framer Motion?
1. **Declarative APIs**: `motion.div` makes it trivial to animate mounting/unmounting components without messy CSS transitions or custom hooks.
2. **Layout Animations**: The `layout` prop automatically interpolates size and position changes, making lists (like the Editor Tabs) rearrange smoothly.
3. **AnimatePresence**: It allows exit animations when items are removed from the React tree (e.g., closing a tab, collapsing a folder).
4. **Performance**: It uses highly optimized requestAnimationFrame loops and hardware acceleration, preventing jank.

## Where Animations Were Added

### 1. `EditorTabs.tsx`
- **What Changed**: Tabs now animate in when opened and scale out when closed. Switching active tabs triggers smooth layout re-calculations.
- **How**: Used `<AnimatePresence mode="popLayout">` wrapping the tab list. Each tab is a `<motion.div layout>` with defined `initial`, `animate`, and `exit` parameters.
- **Micro-interactions**: The "X" close button uses `whileHover` and `whileTap` for immediate, tactile feedback.

### 2. `FileExplorer.tsx`
- **What Changed**: Expanding and collapsing folders now uses a smooth height interpolation instead of snapping open/closed instantly.
- **How**: Wrapped the recursive child list rendering in `<AnimatePresence initial={false}>` and a `<motion.div>` with `height` animating between `0` and `"auto"`. `overflow` is hidden during the transition.

### 3. `IDELayout.tsx` (Loading Skeleton)
- **What Changed**: The plain text "Loading files..." state was replaced by a staggered, shimmering skeleton UI.
- **How**: Created a small map of `<motion.div>` elements representing file lines, using `animate={{ opacity: [0.5, 1, 0.5] }}` with a repeating transition.

### 4. Global CSS (`index.css` & `ide.css`)
- **What Changed**: A global `--transition-fast` and `--transition-normal` were updated to use a modern, cubic-bezier timing function (`cubic-bezier(0.4, 0, 0.2, 1)`).
- **How**: Updated `:root` variables in `index.css` and added transition layers in `ide.css` for hovering action buttons, sidebar panels, and `.explorer-action-btn`. Added the `Inter` font for modern, clear typography.

## Customizing Animations

To adjust durations globally, modify the variables in `index.css`:
```css
:root {
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
}
```
For Framer Motion components, durations are locally scoped in the `transition` prop. 
```javascript
transition={{ duration: 0.2 }}
```

## Accessibility (prefers-reduced-motion)

Framer Motion automatically respects the user's OS-level accessibility settings for motion. By default, if a user has "prefers reduced motion" enabled, the library will skip animations or revert to minimal functional transitions. To explicitly conditionally disable custom layout animations based on this, you can use the `useReducedMotion` hook:

```javascript
import { useReducedMotion } from "framer-motion"

export const MyComponent = () => {
  const shouldReduceMotion = useReducedMotion()
  return (
    <motion.div animate={{ scale: shouldReduceMotion ? 1 : 1.2 }} />
  )
}
```
In the current implementation, animations are kept physically minimal (max 300ms) to ensure accessibility by default, relying primarily on opacity and subtle scaling.
