# Contests

[Back to the README](../README.md)

Any registered user can organize a contest from the **Contests** card on the Hub.

- [For organizers](#for-organizers)
- [For participants](#for-participants)
- [Judging](#judging)
- [SQL problems](#sql-problems)

## For organizers

1. Go to **`/contests`**, give the contest a title and click **Create**.
2. On the manage page (`/contests/:id/manage`):
   - **Settings:** description (markdown, shown in the lobby), duration, allowed languages, whether the leaderboard is live or hidden until the end, and optional proctoring (fullscreen and a tab-switch limit, the same rules as [exams](exams.md)).
   - **Problems:** title, markdown statement with preview, points, time limit, and a memory limit on Piston. **Add problem** makes a code problem and **Add SQL problem** an SQL one. The type can be switched until the problem has tests.
   - **Test cases:** add them one by one, or bulk-upload a `.zip`, files or a folder paired by name (`1.in` + `1.out`, `input/1.txt` + `output/1.txt`, `input01.txt` + `output01.txt`). Tests marked **sample** are shown to participants and the rest stay hidden.
   - Starting, ending, deleting and rejudging ask for confirmation.
3. **Schedule** a start time or **Start now**. While it runs you can add 15 minutes or **End now**.
4. Share the `CT-XXXXXXXX` code. **Try it** opens the contest as a participant would see it. Your own submissions are judged but never ranked, so you can check your test data with a reference solution.
5. The **monitor** (`/contests/:id/monitor`) shows the live leaderboard, participants (block, unblock, remove), every submission with its code, an activity log, and read-only views of participants' code as they type. Click a leaderboard row to watch someone.

## For participants

1. Open the code from **`/contests`**, or go to `/c/CT-XXXXXXXX`, and click **Join contest**. The lobby counts down to the start and problems unlock by themselves.
2. Pick a problem and a language: Python, C++, C, Java, JavaScript, TypeScript, Go or Rust, depending on what the organizer allows. Code is saved automatically, one file per problem and language.
3. **Run samples**, or run with **custom input**. These aren't scored. **Submit** judges the code on every test, and each verdict appears as it finishes.
4. Score per problem is points × tests passed ÷ total tests. Your best submission per problem counts, and ties go to whoever reached their score first.

## Judging

| Verdict | Meaning |
|---|---|
| `AC` | Accepted |
| `WA` | Wrong answer |
| `TLE` | Time limit exceeded |
| `MLE` | Memory limit exceeded (Piston, and SQL problems) |
| `RE` | Runtime error |
| `CE` | Compile error |
| `OLE` | Output limit exceeded |
| `PARTIAL` | Overall, when only some tests pass |
| `IE` | The judge couldn't run the code. Never counted. |

- Output is compared line by line, ignoring trailing spaces and trailing blank lines.
- The queue is the `Submission` table, so a restart never loses one. Anything interrupted is judged again.
- **Wandbox (default):** free, but it accepts only about 10 runs per minute per IP for the whole server. Time limits are approximate, since compile and network time are included. Good for trying contests out. Keep tests few.
- **Piston (recommended for real contests):** set `PISTON_URL`. The sandbox enforces time and memory limits. On the Piston host, raise `PISTON_OUTPUT_MAX_SIZE` (the default allows only 1 KB of output) and set `PISTON_RUN_TIMEOUT` to the longest time limit you want, then set `PISTON_MAX_RUN_MS` on this server to match.
- Every server connected to the same database judges from the same queue. Run the same version everywhere, and give local development its own database. Otherwise a deployed server running older code can misjudge local submissions.

## SQL problems

**For organizers:** write the **schema** (`CREATE TABLE …`, shown to participants) and a hidden **reference query**. Each test case is a **dataset** of `INSERT` statements. Its expected result is computed by running the reference query on it, and shown as a table when you save the test. A schema, dataset or reference query that fails is rejected with the SQLite error, and changing the schema or the reference recomputes every test. Bulk upload takes one `.sql` file per test, or a `.zip` of them.

**For participants:** write one query in `/A.sql`. The last `SELECT` is the answer. The statement shows the schema, each sample's tables and its expected result. **Custom data** runs the query on the schema plus your own `INSERT`s.

**Comparison:** by value, ignoring column names. `1`, `1.0` and `'1'` are equal, numbers match within 0.0001%, and `NULL` only equals `NULL`. Rows may come in any order unless the problem says **Row order matters**.

**Dialect:** SQLite, plus common MySQL functions added by the server: `CONCAT` with MySQL's NULL rule, `LEFT`/`RIGHT`, `LPAD`/`RPAD`, `LOCATE`, `SUBSTRING_INDEX`, `MOD`, `TRUNCATE`, `GREATEST`/`LEAST`, `NOW`, `CURDATE`, `YEAR`/`MONTH`/`DAY`, `DATEDIFF`, `DATE_FORMAT`, `ADDDATE`/`SUBDATE`, `REGEXP`, `REGEXP_LIKE`/`REGEXP_REPLACE`, `FROM DUAL` and more.

Organizers may write the schema in MySQL syntax. `AUTO_INCREMENT`, `SERIAL`, `ENUM(...)`, `ENGINE=…`/`CHARSET=…`, `KEY idx (...)`, column `COMMENT`s and `SET NAMES` lines are converted.

Still different from MySQL: `5 / 2` is `2` (integer division), text `=` is case-sensitive, and `INTERVAL`, `GROUP_CONCAT(… SEPARATOR …)`, `DIV`, `<=>` and `@variables` aren't supported. The arena lists this under **SQL dialect notes**.

**Engine:** SQLite (sql.js, WebAssembly) in a pool of worker threads, so SQL judging takes milliseconds and never uses Wandbox or Piston. Every run gets a fresh in-memory database with no file system or network access. Time limits go up to 5 s. A query past its limit is stopped (`TLE`), more than 32 MB of memory is `MLE`, and more than 10,000 rows or 1 MB of result is `OLE`.
