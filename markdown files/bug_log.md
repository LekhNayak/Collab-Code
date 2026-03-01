# Resolved Bugs & Issues Log

This log chronicles the bugs and issues that have been addressed across the collaborative IDE platform conversations.

## 1. Authentication Middleware Token Bug ("Authentication required. No token provided.")
- **Issue:** The main backend authentication middleware failed to successfully parse JWT tokens from incoming connections, blocking users from starting new collaborative sessions entirely.
- **Root Cause:** A mismatch/misconfiguration in how the middleware intercepted the `Authorization` headers before passing the request context forward.
- **Resolution:** Updated the authentication middleware pipeline to accurately parse headers, ensuring proper extraction and validation of tokens.

## 2. Login/Signup Flow Performance Bottleneck
- **Issue:** Logging into the application or going through signup took an excessively long time, impacting the user experience heavily. 
- **Focus Area:** Improved the efficiency of SSO (Single Sign-On) mechanics and the local database verification queries to dramatically speed up user sign-in latency.
- **Resolution:** Optimized how sign-up logic and initial session handshakes were orchestrated on the server side to minimize blockages.

## 3. Server-Side Missing API Route Logging
- **Issue:** Debugging backend issues in development was difficult because the server silently executed API calls.
- **Resolution:** Embedded explicit API console request logging across the `/packages/server` environment explicitly to allow the developer to seamlessly track incoming API routes and view failure payloads.

## 4. Frontend Typescript & Unused Import Linting Errors
- **Issue:** The repository failed to build (`npm run build`) cleanly due to multiple unresolved linting problems.
- **Cases Resolved:** 
  - Framer Motion typing error in `Hub.tsx` related to the `ease` variable needing to be an `as const` tuple.
  - An unused and abandoned `BrutalCard` component import floating inside `Room.tsx`.
  - Missing typing directives (`any`) on the Admin dashboard component (`AdminDashboard.tsx`).
- **Resolution:** Patched all problematic components ensuring strict type coverage and cleaning up imports from `Room.tsx`. 

## 5. Phantom CSS Line Clamp Compatibility
- **Issue:** The `ide.css` style file utilized an outdated `line-clamp` attribute around block constraints but failed to use standard CSS properties.
- **Resolution:** Located line 1823 in `ide.css` and updated to a modern implementation that defines correct web standards for CSS line clamps and box bindings.

## 6. Exam Room Lifespan Management (No Deletion)
- **Issue:** The backend did not have a mechanic for the user to delete "Exam Rooms" after creating them, resulting in server-bloat and UI confusion.
- **Resolution:** Shipped a localized `/delete` REST endpoint specific to the exam environment, and additionally coupled it with a new red Delete button onto the Exam Room UI cards for one-click termination.

## 7. Hub Page Layout & Mobile Overflow Cutoff
- **Issue:** After designing the visual aesthetic of the main `Hub.tsx` navigation menu, the layout pushed the 4 interaction cards permanently offscreen on smaller vertical window heights.
- **Resolution:**
  - Transitioned the entire wrapper to `overflow-y-auto` allowing the user to naturally scroll when dimensions clipped.
  - Dynamically altered the column layouts to collapse gracefully (2x2 to a smaller 4-column variant based on breakpoint).

## 8. Imported Repository State Overwrite Bug (Flashing Text)
- **Issue:** When a user successfully imported a new GitHub project, clicking on files inside the project tree resulted in the immediate flashing of lines then total erasure of all text contents.
- **Root Cause:** A Yjs (Collaborative layer) Websocket synchronization race condition. When the file loaded locally, a split-second later the WebSocket sent down an "Empty Session State" signal for that file and aggressively overwrote the local text buffer.
- **Resolution:** Patched `Editor.tsx` by attaching an `on('sync')` listener. During the initial synchronization handshake, the editor intercepts the blank payload, explicitly populates the local disk content into the remote Yjs document memory bank, and correctly broadcasts the code content.
