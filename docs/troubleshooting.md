# Troubleshooting

[Back to the README](../README.md)

**"Cannot connect to API" or CORS errors**
- Check the server is running on the port in `VITE_API_URL`.
- Check that `FRONTEND_URL` includes your frontend's origin. `http://localhost:5173` and `5174` are always allowed.

**WebSocket connection fails**
- `VITE_WS_URL` must point to the same server as the API. HTTP and WebSocket share one port.

**Database errors on the first request (Neon)**
- Neon's free tier suspends after inactivity, and the first request times out while it wakes (about 30 seconds). Retry it.

**`terminating connection due to administrator command` (`E57P01`) in the server log**
- Harmless. Neon closed idle connections when it suspended the database. Prisma reconnects on the next request.

**"Column does not exist" errors**
- The database is out of sync with `schema.prisma`. Run `npx prisma db push` in `packages/server`.

**An admin can't create exams, or gets 403**
- Check the user's `role` is `ADMIN` in the database, then log out and back in. The role is only written into the token at login.

**"Room not found" for an exam code**
- Exam codes are uppercase (`EX-XXXXXXXX`). Check for extra spaces.

**A tab keeps showing the unsaved dot**
- The server hasn't stored the latest change yet. If it doesn't clear in a few seconds, look for `[Collab] Failed to save` in the server log. Usually the database is unreachable. Saves are retried automatically, and if only the database write failed, the change is already on disk.

**"Binary or non-UTF-8 file" or "File is too large to open in the editor"**
- The editor opens UTF-8 text files up to 5 MB. Other files can be downloaded and are never modified.

**"Could not connect to the collaboration server" when opening a file**
- The WebSocket didn't open within a minute. A sleeping Render instance can take that long. Check `VITE_WS_URL` and `VITE_API_URL`, then click the file again.

**Files are back but git history is gone after a Render restart**
- Expected on the free plan. See [What the free plan keeps](deployment.md#what-the-free-plan-keeps).

**Push or pull is rejected**
- Update your GitHub username and token in the Source control panel. The token needs the `repo` scope.

**Contest submissions made locally get odd verdicts or `IE`**
- Another server on the same database may be judging them with different code. Give local development its own database.

**Code execution fails**
- Without `PISTON_URL`, the server must be able to reach `https://wandbox.org`.
- With `PISTON_URL`, check Piston is running and has the runtime installed.
