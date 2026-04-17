# The Martian Call — Server (DEMO)

> *"In the face of overwhelming odds, I'm left with only one option — I'm gonna have to science the shit out of this."*
> — Mark Watney, The Martian (2015)


Inspired by that scene where a guy stuck on Mars rotates a broken antenna, encodes a message in HEX, and just... hopes someone picks it up.


The backend that keeps transmitting even after you close the tab.

## What does this do?

This is the NestJS server behind [The Martian Call](../the-martian-call/README.md) — a slow, atmospheric messaging app inspired by *The Martian (2015)*.

The server's job is pretty specific:

- Authenticate users via Google OAuth, hand back a JWT
- Track which continent each operator is stationed on and where their antenna is pointing
- When someone sends a message, schedule its delivery with `setTimeout` — not a cron, not a queue, just a good old timer
- When the timer fires, figure out which continents are in range and emit `signal:received` to the right WebSocket rooms
- If a recipient was offline, write a `signal_log` entry so they see a missed signal banner on next login
- On server restart, recover any in-flight transmissions by re-querying `status = 'transmitting'` rows — no message gets lost

That last one is the fun part. The message keeps travelling whether or not anyone is watching.

## Stack

- **NestJS** — persistent process (not serverless)
- **TypeScript** strict
- **Prisma** + PostgreSQL
- **Passport.js** + JWT — Google OAuth + socket auth
- **socket.io** — WebSocket gateway for real-time delivery
- **Zod** — env validation
- Deployed on **Render**

---

*The server keeps transmitting. It doesn't care if you're watching.*
