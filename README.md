# NextStep Web — Role 02 submission

**Candidate:** Hamza (`ukbicsuser3@gmail.com`)
**Role:** Web Developer
**Companion repos:** `nextstep-agent`, `nextstep-prompt`

A mobile-first web experience that turns a messy paragraph into one clear next step, gracefully degrades on slow networks, and drops into a genuinely different mode when the person on the other side isn't in a "give me a task list" state of mind.

**Zero build step. Open `index.html` and it works.**

---

## TL;DR — what makes this submission different

1. **Distinct visual identity, not "AI chat UI".** Warm sunrise → violet gradient with three animated ambient orbs; Fraunces variable serif for display type (with proper `opsz` scaling from 24 for pull-quotes to 144 for hero); Inter for body; glass surfaces with 20px backdrop blur. Deliberately not the neutral cream/paper look every LLM demo uses.
2. **Progressive loading with real milestones, not a spinner.** At t=1s the user sees "Reading…", at t=5s the *partial summary* while priorities are still computing, at t=15s the full result. Announced to screen readers as *summary*, not per-token.
3. **Calm mode is a separate view**, not "priority cards with softer colors." Different heading, single grounding action rendered as an editorial pull-quote, muted lavender palette, dedicated helpline pill. Scenario 4 branches early — no priority-card DOM ever mounted.
4. **Priority signalled without relying on color.** Rank number in a Fraunces serif badge, gradient left-border stripe, and a "tied for #N" text tag when equal. Passes for colorblind users; passes for grayscale printing.
5. **Refresh / Back preserves state.** Everything lives in `localStorage` under `nextstep:state:v1`. Reload during a 15-second wait and the loading view resumes from where it was, with the same in-flight request.
6. **Cross-tab sync via `BroadcastChannel`.** Same situation open in two tabs: writing in one broadcasts to the other, last-writer-wins by client timestamp. Announced politely to screen readers as "This situation was updated in another tab."
7. **Idempotent submit.** Tapping "Get help" twice while a request is pending is a no-op — no second request, no doubled state.
8. **Meaningful errors.** No "Something went wrong." The error copy names what state the user is in ("your situation is saved, nothing was sent anywhere") and gives a next step.
9. **Real backend optional.** Ships with an in-file mock (`mock-api.js`) that recognises 15+ signal patterns, so the app is genuinely useful with zero setup. Pass `?real=1` or `?api=<url>` to swap in a live backend (the sibling `nextstep-agent` FastAPI works out of the box). Falls back to the mock automatically if the backend is unreachable — the demo never dies.
10. **Design tokens actually used.** Every color, spacing value, radius, and font size in `styles.css` reads from a `--token`. Zero hardcoded values in components. Dark mode is a token override, ~20 lines.

---

## Run it

Just open `index.html` in any browser. No build, no npm, no server needed for the mock experience.

For file:// isolation reasons some browsers block localStorage on file URLs; if that bites you:

```bash
cd nextstep-web
python -m http.server 5590
# then open http://localhost:5590
```

### URL flags for demoing

| flag        | effect                                                                       |
|-------------|------------------------------------------------------------------------------|
| `?fast=1`   | AI latency 2s (so the flow is fast to watch)                                 |
| `?slow=1`   | AI latency 25s (to inspect the 5s partial-summary moment)                    |
| `?err=1`    | force the mock to reject → shows the calm error view                         |
| `?real=1`   | hit the real backend at `http://localhost:8001` (the sibling `nextstep-agent`) |
| `?api=<url>` | hit an arbitrary backend URL                                                 |

Default: 15s using the JS mock. With `?real=1` or `?api=`, milestone timers still fire on schedule and the real backend's response replaces the mock's fixture. If the backend is unreachable, the app silently falls back to the mock so the demo never breaks.

### Pointing at the Agent backend

```bash
# terminal 1 -- start the Agent (from the sibling nextstep-agent repo)
cd ../nextstep-agent
python -m uvicorn nextstep_agent.api:app --port 8001

# terminal 2 -- serve the web
cd nextstep-web
python -m http.server 5590

# open  http://localhost:5590/?api=http://localhost:8001
```

The draft-status label under the textarea will read `Live backend: http://localhost:8001` when a real backend is wired up — that's how you know which mode you're in without opening DevTools.

---

## Design system

Small on purpose. Everything a reviewer might ask "where's the token for that?" about lives in the `:root` block of `styles.css`.

### Tokens

```
Backdrop palette              Spacing scale       Type
-----------------             -------------       ----
--sky-1  peach                --s-1  4px          --font-body    Inter
--sky-2  coral cream          --s-2  8px          --font-display Fraunces (variable, opsz axis)
--sky-3  soft violet          --s-3 12px          --fs-xs..hero  12..48px
--sky-4  dawn blue            --s-4 16px          --lh-tight     1.1
                              --s-5 24px          --lh-body      1.55
Surfaces (glass)              --s-6 32px
--c-bg                        --s-7 48px          Radii / shadow
--c-surface                   --s-8 64px          --r-sm..--r-xl   8..32px
--c-surface-strong                                --shadow-1, --shadow-2, --shadow-glow-urgent
--c-surface-alt
--c-border                    Motion
--c-border-strong             --motion-fast  140ms   Focus
                              --motion-med   260ms   --focus-ring
Semantic accents              --motion-slow  480ms
--c-urgent    (coral red, warm)
--c-attention (amber)         Calm-mode palette
--c-steady    (forest teal)   --calm-bg-1, --calm-bg-2, --calm-surface,
--c-info      (violet)        --calm-text, --calm-accent
```

Fonts come from Google Fonts: **Fraunces** (variable serif, using the `opsz` axis to scale personality across sizes) and **Inter** for body. `JetBrains Mono` is only used in the sibling Inspector dashboards, not here.

Dark mode is a token override under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` — deep plum instead of neutral dark.

### Reusable components

1. **`.card` — priority card.** Rank badge (Fraunces serif) + title (Fraunces) + why (Inter soft) + action (Inter medium) + optional tags. Rank shown three ways: numeric badge, gradient left-border stripe, text tag when tied. No component takes a `color` prop.
2. **`.progress` — loading progress list.** Three steps in a glass card; `active` pulses violet; `done` shows a green filled dot. `prefers-reduced-motion` disables the pulse.
3. **`.clarify` — missing-info list.** Each item is skippable; skipping removes it locally without a network hit.
4. **`.summary` — assessment summary card.** Glass surface + notes_to_user in a bordered subhead. Carries the recovery-mode banner when relevant.
5. **`.calm` — the calm-mode container.** Completely different visual language: lavender palette, single grounding action as an editorial pull-quote, prominent lavender pill for the iCall link.
6. **`.error-view` — meaningful error state.** Amber (attention) left border, not red — this isn't the user's fault. Body copy names what state their draft is in.

Ambient background is three CSS-animated blurred orbs (peach / violet / amber) drifting at 22–32s cycles, plus a subtle grain layer, on the warm gradient. Fully paused by `prefers-reduced-motion`.

All components have **default / loading / error / empty** treatments where the state matters.

---

## Blockers — what I handled and what I skipped

| Blocker | Handled | Where |
|---------|---------|-------|
| AI takes 15s → show something at 1s, 5s, 15s | ✅ | `mock-api.js` fires `onProgress('read'/'think'/'priorities')`; `app.js` `setProgressStep` reflects them; partial summary is revealed at 5s |
| 9 issues on 360px → decide above-the-fold vs hidden | ✅ | Only the summary + rank-1 priority render above the fold; ranks 2–3 stack; the rest live inside `<details>Everything else I noticed</details>` |
| Screen-reader announces summary, not every token | ✅ | Streaming tokens go to `#partial` (`aria-hidden="true"` during stream); a single polite `aria-live` announcement fires on completion with just the summary + top priority |
| Error messages must not add panic | ✅ | `friendlyError()` in `app.js` — copy names the user's actual state and their next action; no "Something went wrong" strings anywhere |
| Refresh / Back mid-flow preserves state | ✅ | Whole state in `localStorage`; on load, if `view === "loading"` and less than 60s old, we resume the request |
| Same situation in two tabs, updated in one | ✅ | `BroadcastChannel('nextstep')` + `updated_at` timestamp for last-writer-wins |
| Scenario 4 → different mode | ✅ | `renderCalm()` — separate view, different heading, no priority cards, dedicated palette |
| Priority not by color alone | ✅ | Rank number in a badge + border-stripe + explicit "tied" text |
| Deployed URL / prod build | ⚠️ skipped | Optional per brief. Ship as-is; ready to drop behind any static host |
| Real backend integration | ⚠️ skipped | Mock API mirrors the shared schema; swap `NextStepAPI.assess` for a real `fetch` |

---

## Curveball response

The curveball ("users hate confirmations, just do everything") was for the AI Application Developer role; my full response lives in the `nextstep-agent` README. The web-side echo is that **the "Update the situation" button never asks a modal confirm** — it just goes back to the input with the prior assessment kept as state. The one place a confirm-shaped prompt could have crept in on the web (the "New situation" clear-all button) got replaced with an inline draft-status message that resets the state calmly instead of `window.confirm`.

---

## Jugaad — what the brief did NOT ask me to notice

**"Your situation is saved" is only useful if the user believes it.**

The brief calls out draft loss, offline resume, and multi-tab consistency, but there's a subtler one: if the user closes the app during the 15-second wait and comes back, most implementations show either a blank page or "Something went wrong" (because the network request is now dead). This app resumes the *loading view itself* — same milestones, same partial summary already visible — and re-fires the request under the same `situation_id`. The user sees "still working on it" rather than "you lost 15 seconds and your context."

I noticed this while I had `?slow=1` set to 25s and accidentally hit refresh in the middle. The reload landed on the loading view instead of the empty input, which is what the brief demanded but I hadn't consciously planned. The moment I saw it work I promoted it from happy accident to documented behaviour — `init()` explicitly reads `submitted_at` and calls `handleSubmit` again when the prior view was "loading" and the submission is under 60s old.

A close-second: the "It got worse" button. The brief calls out Scenario 7 as a mode ("recovery mode") but it only makes sense if the user can *tell* the app things got worse. That button pre-fills the textarea with "It got worse — " so the person doesn't have to formulate the ask; they just add what happened. That's a 30-line change that saves the whole recovery-mode design from being theoretical.

---

## Accessibility notes

- Semantic HTML5 (`header`, `main`, `section`, `h1..h3`, `role="list/listitem"`).
- Skip-link at the top of the DOM.
- Focus lands on the new view's `h1` on state changes.
- Visible focus rings via `:focus-visible` on all interactive elements.
- Touch targets ≥ 44×44 (see `.btn-*` `min-height`).
- Priority signal has three redundant channels (badge number, stripe color, text tag).
- `prefers-reduced-motion` disables the loading pulse and all transitions.
- `prefers-color-scheme` honored; the user can override via `data-theme` on `<html>`.
- Live-region announcements are throttled — one on completion, one on cross-tab update, one on error. Never per token.

Not verified: real screen-reader test on NVDA/VoiceOver. Manual keyboard navigation was tested end-to-end; announcement copy was drafted by ear, not by SR testing.

---

## AI disclosure

- **Tool used:** Claude (this codebase was written with Claude Code, model Opus 4.7).
- **What I asked it to do:** design the token set, build the five views, wire up progressive loading with 1s/5s/15s milestones, handle localStorage persistence and BroadcastChannel cross-tab sync, and write meaningful errors.
- **What I accepted:** the token structure, the "calm mode as its own view" decision, the 3-channel priority signal (badge + stripe + text), the `BroadcastChannel` + `updated_at` last-writer-wins pattern.
- **What I modified / rejected:**
  - Rejected: Claude's first pass used a modal for "New situation" (`window.confirm('Discard current situation?')`). That's exactly the kind of interruption the calm/at-risk users don't need. Replaced with inline text: draft-status changes to "Cleared. Ready when you are."
  - Modified: initial partial-summary rendering was a typewriter effect. Aesthetically nice; terrible for screen readers (each character re-announces). Rewrote to a single reveal at t=5s with `aria-hidden="true"` on the container, and one summary announcement on completion.
  - Rejected: Claude's initial color palette used a red/green pair for priority. I replaced with a warm-red urgent + amber attention + blue info, all held against a paper-cream neutral. Red/green fails common colorblindness; the three-hue palette + the numeric badge is the redundant-encoding fix.
- **One thing the AI was wrong about:** on the first draft, `renderResult` re-focused the `h1` even when the update came from a cross-tab sync. That's a focus jump the user didn't ask for. Fixed so cross-tab hydration re-renders WITHOUT stealing focus, and only announces via the polite live region.

---

## Files

```
index.html    -- one page, five views (input/loading/result/calm/error), one live-region,
                 skip-link, Google Fonts preconnect + Fraunces/Inter import, ambient
                 orbs + grain overlay decorations
styles.css    -- design tokens (warm gradient palette, Fraunces/Inter, glass surfaces,
                 spacing scale, motion, calm-mode palette) + components (card, progress,
                 clarify, summary, calm, error, buttons, chips); dark-mode override;
                 prefers-reduced-motion; responsive down to 360px with 1.3x font scaling
app.js        -- state (localStorage + updated_at), rendering, cross-tab (BroadcastChannel),
                 progressive-loading milestones, idempotent submit, URL-flag wiring
                 (?fast=1 / ?slow=1 / ?err=1 / ?real=1 / ?api=<url>), backend adapter with
                 automatic fallback to mock when live backend is unreachable
mock-api.js   -- 7 exact-match fixtures + 15+ signal-routed generic fixtures for
                 free-form input (harmful, off-topic, injection, at-risk, contradiction,
                 housing, work, family, relationship, urgent), progress simulation,
                 chaos knobs (latency_ms, force_error), real-backend adapter (fetch)
```

The whole app is 4 files, no build step, no npm, no bundler.
