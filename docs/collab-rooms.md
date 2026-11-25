# Collab rooms

[Back to the README](../README.md)

A collab room is a shared workspace with a code like `CR-7f3a9c2e`. Exams and contests have their own rules and don't use any of this.

## Creating and joining

1. Go to **`/collab`**, name the session if you like, and choose what newcomers can do: **Can view**, **Can comment** or **Can edit**. There's no default, so the creator always decides.
2. Share the link or the room code.
3. The first time someone opens it, they ask to join and wait. The owner or a co-owner accepts or declines them in the **Collaborators** panel, or accepts everyone at once.
4. Once accepted, they walk straight back in on later visits. Someone who was removed or declined has to ask again, and comes back with the role newcomers currently get.

## Roles

| | Owner | Co-owner | Can edit | Can comment | Can view |
|---|:-:|:-:|:-:|:-:|:-:|
| See the code and comments | Yes | Yes | Yes | Yes | Yes |
| Post comments | Yes | Yes | Yes | Yes | No |
| Edit files | Yes | Yes | Yes | No | No |
| Accept or decline requests | Yes | Yes | No | No | No |
| Change roles of, or remove, people below them | Yes | Yes | No | No | No |
| Delete comments by people below them | Yes | Yes | No | No | No |
| Make or remove co-owners | Yes | No | No | No | No |
| Set the role newcomers get | Yes | No | No | No | No |

Nobody can change their own role, and the owner's role can't be changed. A co-owner can't act on another co-owner, unless they're acting as owner (below).

Roles limit changes to files and comments. They don't stop anyone in the room from running code or using the terminal's read-only commands.

## When the owner leaves

Someone always holds the owner's powers while a manager is connected:

- While the owner is connected, it's the owner.
- Otherwise it's the earliest-promoted co-owner who is connected. There's an 8 second grace period, so a page refresh doesn't hand the room over.
- If neither is connected, the room keeps working but is unmanaged. People keep their roles and requests wait.

Nothing is rewritten when this happens, so the owner is the owner again the moment they return. If the owner leaves while others are online and there's no co-owner, the app warns them first.

## Comments

Each room has one thread, shown in the **Comments** panel. It belongs to the room as a whole, not to lines of code. Comments are limited to 2,000 characters and the latest 200 are shown.

## How it's enforced

Rules live in `packages/server/src/collab/rooms.ts`.

- **REST:** every `/git` request for a room checks that the person was let in, and that they may edit if the request changes files.
- **Document WebSocket:** updates from people who can't edit are dropped. The check runs on every message, so a new role applies without reconnecting. Removing someone closes their connection.
- **Control WebSocket** (`?mode=collab-control`): carries presence, requests, roles and comments. People who are still waiting can open only this one.

Rooms created before roles existed stay open until someone opens them through the join flow. That person becomes the owner.
