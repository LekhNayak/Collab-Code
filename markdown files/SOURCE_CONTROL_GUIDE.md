# Source Control Guide: Colab Code

When using Colab Code, standard `git` commands in the built-in terminal might not always behave exactly as they do on your local machine. This is because your workspace is hosted inside an isolated server container that manages file states and web configurations differently.

To solve this, **Colab Code has a built-in "Source Control" visual interface** (similar to VS Code) that safely handles Git operations behind the scenes via a dedicated set of APIs!

This guide will explain exactly how to use the built-in Source Control tab to get your work done.

---

## 📥 1. Cloning / Importing a Repository

If you want to start working on an existing GitHub repository, **do not try to type `git clone ...` in the terminal.**

Instead, use the built-in **Hub** interface:
1. Go to the main **Hub / Dashboard** page (the home screen after you log in).
2. Look for the **"Import Project"** or **"Clone Repository"** button.
3. Paste your GitHub repository URL (e.g., `https://github.com/username/my-repo.git`).
4. Click Import.

Colab Code will automatically create a new Workspace container for you, run the clone securely in the backend, and drop you directly into the fully loaded IDE workspace!

Repositories can only be cloned into a new, empty workspace. Cloning from the Source Control panel into a room that already has files is refused, so it can't mix two projects together.

---

## 🛤️ 2. Tracking Changes (Status)

Once you are in your IDE Workspace, if you modify or create any files, you can track them in the **Source Control Panel**.

1. Click on the **Source Control icon** (the branch/fork symbol ᛘ) in the left-hand activity bar.
2. The panel will automatically refresh and show you a list of **Changes** (files that have been modified, added, or deleted).

*(Behind the scenes, the IDE is securely running `git status` on the server and formatting the results for you visually.)*

You don't need to press `Ctrl+S` before using Source Control: your edits are saved automatically, and status, staging, commit and push always save anything still pending first, so they include what you just typed.

> **Note:** On the free hosting plan the server's disk can be wiped when it restarts. Your files are restored automatically, but the repository's commit history (`.git`) is not — push your commits to GitHub to keep them.

---

## ➕ 3. Staging Files (Adding)

Before you can commit changes, you must "stage" them.

1. In the **Source Control Panel**, hover over a file in the "Changes" list.
2. Click the **`+` (Plus)** icon that appears next to the file name to stage that specific file.
3. To stage **all** changes at once, click the **`+` (Plus)** icon at the very top of the Changes section.

Your files will move from "Changes" to a new section called "Staged Changes" (this is the equivalent of running `git add`).

---

## 📝 4. Committing Changes

Once your changes are staged:

1. Look for the **Message input box** at the top of the Source Control panel.
2. Type a clear, descriptive message (e.g., `"Update API endpoints"`).
3. Click the **Commit** button (or press `Ctrl+Enter` / `Cmd+Enter` while focused in the box).

*(This is the equivalent of running `git commit -m "Update API endpoints"`).*

---

## ☁️ 5. Pushing and Pulling

To sync your code with GitHub (or your remote provider), you will need to push and pull your commits.

1. Click the **`...` (Three Dots / More Actions)** menu located at the top right of the Source Control panel.
2. Select **Pull** to fetch and merge the latest changes from the remote repository (`git pull`).
3. Select **Push** to send all of your local commits up to the remote repository (`git push`).

> **🔒 Note on Authentication:** If your repository is private or requires authorization to push, the system may prompt you for a GitHub Personal Access Token (PAT). GitHub requires PATs instead of passwords for external apps.

---

## 🌿 6. Managing Branches

You can easily switch branches or create new ones without touching the terminal:

1. Look at the very bottom-left of the IDE interface (the **Status Bar**).
2. You will see the name of your current branch (e.g., `main` or `master` with an icon next to it).
3. **Click on the branch name.**
4. A dropdown menu will appear at the top of the editor.
5. From here, you can:
    * Select an existing branch to switch to it (`git checkout`).
    * Click **"Create new branch..."** to type a new branch name and instantly switch to it (`git checkout -b new-branch-name`).

---

### Why use the UI instead of the Terminal?
* **Security & Auth:** The visual interface binds securely to Colab Code's backend APIs (`/git/*`), which safely manage authentication tokens, CORS headers, and file system permissions. 
* **State Management:** When you use the visual UI, the React frontend instantly knows the state of your files and triggers real-time updates across the file tree, collaborative cursors, and editor tabs. Remote terminal commands can bypass this state, leading to out-of-sync UI bugs!
