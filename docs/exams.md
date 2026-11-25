# Exams

[Back to the README](../README.md)

## For proctors

Proctors need the `ADMIN` role. See [User roles](setup.md#user-roles).

1. Go to **`/admin`**.
2. Enter a title and click **Create room**. You get a code like `EX-551D74DE`.
3. Share the code with students.
4. Click an exam card to open the **live monitor** (`/exam/:id/monitor`):
   - Each student's code appears in a read-only editor as they type. It follows whichever file they have open and shows its name.
   - The event console logs joins, tab switches, fullscreen exits, code runs and paste alerts, and can be filtered by type or student.
   - **Block**, **Unblock** or **Remove** individual students.
   - The top row counts students, blocked students, tab switches and paste alerts.

## For students

1. Go to **`/take-exam`** from the Hub.
2. Enter the exam code and a display name.
3. The editor opens in exam mode, with these rules:

| Rule | What happens |
|---|---|
| Fullscreen | Leaving it shows a blocking overlay and logs the event |
| Switching tabs | Shows a warning with the count. The third one blocks the student automatically. |
| Switching windows (Alt+Tab) | Shows the overlay when the window loses focus |
| Keyboard shortcuts | Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Tab, F11, F12, Alt+F4 and the DevTools shortcuts are blocked where the browser allows it |
| Copy and paste | More than 20 characters is logged. More than 50 is blocked as well. |

Each student works in an isolated workspace (`EX-XXXXXXXX__userId`) and can't see anyone else's code. If the exam has an end time, a countdown is shown, and screen readers hear it at 30, 10, 5 and 1 minute left.

> Browser rules can be worked around by a determined student. They make cheating visible and inconvenient, and the event log is there for a person to judge.

## Codes

| Prefix | Example | Used for |
|---|---|---|
| `CR-` | `CR-7f3a9c2e` | Collab rooms |
| `EX-` | `EX-551D74DE` | Exams. Always uppercase. |
| `CT-` | `CT-D4BE22CD` | Contests |
