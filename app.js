/* NextStep Web — app logic.
 *
 * Handled here (see README for the reasoning):
 *   - Draft persistence in localStorage, keystroke-debounced
 *   - Refresh / Back preserves the whole state (input, loading, result, calm)
 *   - Cross-tab sync via BroadcastChannel('nextstep')
 *   - Progressive loading (1s / 5s / 15s milestones)
 *   - Screen-reader announces the SUMMARY, not per-token
 *   - Idempotent submit (double-tap while pending is ignored)
 *   - Calm mode is a separate view, not "priority cards in different colors"
 *   - Priority signaled by rank number + stripe + card tag — NOT by color alone
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const STORAGE_KEY = "nextstep:state:v1";
  const CHANNEL = "nextstep";
  const channel = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL) : null;

  /* ============================ state ============================ */
  const initialState = () => ({
    view: "input",        // input | loading | result | calm | error
    draft: "",
    situation_id: null,
    submitted_at: null,
    assessment: null,
    error: null,
    /* the client is authoritative on this: the LAST-WRITER-WINS timestamp for
       cross-tab reconciliation. When another tab writes newer state we adopt it. */
    updated_at: 0,
  });
  let state = load() || initialState();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function save(broadcast = true) {
    state.updated_at = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    if (broadcast && channel) channel.postMessage({ type: "sync", state });
  }
  function reset() {
    state = initialState();
    save();
  }

  /* ============================ views ============================ */
  const views = {
    input: $("#view-input"),
    loading: $("#view-loading"),
    result: $("#view-result"),
    calm: $("#view-calm"),
    error: $("#view-error"),
  };
  function show(name) {
    for (const [k, el] of Object.entries(views)) el.hidden = (k !== name);
    document.body.dataset.mode = (name === "calm") ? "calm" : "idle";
    state.view = name;
    // move focus to the new view's heading
    const h = views[name].querySelector("h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: false }); }
  }

  /* ============================ rendering ============================ */
  function announce(text) {
    // aria-live polite announcement of the SUMMARY only — not per-token.
    const region = $("#a11y-live");
    region.textContent = "";
    // clear then set on next tick so AT re-reads
    setTimeout(() => { region.textContent = text; }, 30);
  }

  function renderScenarioButtons() {
    const wrap = $("#scenario-buttons");
    wrap.innerHTML = "";
    for (const sc of NextStepAPI.scenarios) {
      const b = document.createElement("button");
      b.className = "scenario-chip"; b.type = "button";
      b.innerHTML = `<strong>${sc.label}</strong><small>${escapeHtml(sc.text.slice(0, 90))}${sc.text.length > 90 ? "…" : ""}</small>`;
      b.addEventListener("click", () => {
        $("#situation-text").value = sc.text;
        state.draft = sc.text; save();
        $("#form-situation").requestSubmit();
      });
      wrap.appendChild(b);
    }
  }

  function renderResult(a) {
    // calm mode branches early
    if (a.calm_mode) return renderCalm(a);

    $("#summary").innerHTML =
      `<p>${escapeHtml(a.summary)}</p>` +
      (a.notes_to_user ? `<p class="tiny-help">${escapeHtml(a.notes_to_user)}</p>` : "");

    // uncertainty banner
    const u = $("#uncertainty-bar");
    if (a.uncertainty >= 0.5 || (a.risk_flags || []).includes("contradiction")) {
      u.hidden = false;
      u.textContent = a.uncertainty >= 0.5
        ? "Uncertainty is high — treat the ranking as a starting point, not a verdict."
        : "I noticed a contradiction — see the top priority below.";
    } else { u.hidden = true; }

    // priorities
    const list = $("#priorities");
    list.innerHTML = "";
    // group by rank — mark ties honestly
    const rankGroups = new Map();
    for (const p of a.priorities) {
      if (!rankGroups.has(p.rank)) rankGroups.set(p.rank, []);
      rankGroups.get(p.rank).push(p);
    }
    for (const [rank, group] of [...rankGroups.entries()].sort((a, b) => a[0] - b[0])) {
      for (const p of group) {
        const isTied = group.length > 1;
        list.appendChild(priorityCard(p, isTied));
      }
    }

    // clarification questions — from missing_info
    const clarify = $("#clarify"); const clarifyH = $("#clarify-h");
    clarify.innerHTML = "";
    if ((a.missing_info || []).length) {
      clarify.hidden = false; clarifyH.hidden = false;
      for (const q of a.missing_info) clarify.appendChild(clarifyItem(q));
    } else { clarify.hidden = true; clarifyH.hidden = true; }

    // recovery-mode subtle badge
    if (a.recovery_mode) {
      const banner = document.createElement("p");
      banner.className = "tiny-help";
      banner.style.marginTop = "var(--s-3)";
      banner.textContent = "Recovery mode — I've paused proposing new actions.";
      $("#summary").appendChild(banner);
    }

    show("result");
    announce(a.summary + (a.priorities[0] ? ". Top priority: " + a.priorities[0].title : ""));
  }

  function priorityCard(p, isTied) {
    const el = document.createElement("article");
    el.className = "card"; el.setAttribute("role", "listitem");
    el.dataset.rank = isTied ? "tied" : String(Math.min(3, p.rank));
    const badgeRank = isTied ? "tied" : String(Math.min(3, p.rank));
    const needsClarify = !p.action;
    el.innerHTML = `
      <div class="rank-badge" data-rank="${badgeRank}" aria-hidden="true">
        <span class="rank-num">${p.rank}</span>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(p.title)}</h3>
        <p class="why">${escapeHtml(p.why)}</p>
        <p class="action">${p.action ? escapeHtml(p.action) : "<em>I need one thing clarified before I can suggest an action for this.</em>"}</p>
        ${isTied ? `<span class="card-tag" data-kind="tied">tied for #${p.rank}</span>` : ""}
        ${needsClarify ? `<span class="card-tag" data-kind="needs-clarify">needs clarification</span>` : ""}
      </div>`;
    return el;
  }

  function clarifyItem(q) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="q-text">${escapeHtml(q)}</span>
                    <button class="q-skip" type="button">skip</button>`;
    li.querySelector(".q-skip").addEventListener("click", () => li.remove());
    return li;
  }

  function renderCalm(a) {
    $("#calm-note").textContent = a.notes_to_user || "";
    $("#calm-action").textContent = a.priorities[0]?.action || "";
    show("calm");
    announce("Calm mode. " + (a.notes_to_user || ""));
  }

  function renderError(msg) {
    $("#error-body").textContent = msg;
    show("error");
    announce("There was a problem: " + msg);
  }

  /* ============================ loading progress ============================ */
  function setProgressStep(step) {
    const map = { read: "#p-read", think: "#p-think", priorities: "#p-priorities" };
    const order = ["read", "think", "priorities"];
    const idx = order.indexOf(step);
    order.forEach((s, i) => {
      const li = $(map[s]);
      if (!li) return;
      li.classList.remove("active", "done");
      if (i < idx) li.classList.add("done");
      else if (i === idx) li.classList.add("active");
    });
    if (step === "think") {
      const p = $("#partial");
      p.hidden = false; p.setAttribute("aria-hidden", "false");
    }
    if (step === "read") $("#loading-heading").textContent = "Reading what you wrote…";
    else if (step === "think") $("#loading-heading").textContent = "Working out what matters…";
    else if (step === "priorities") $("#loading-heading").textContent = "Ordering priorities…";
  }

  /* ============================ submission ============================ */
  let pending = false;

  async function handleSubmit(text) {
    if (pending) return; // idempotent double-tap protection
    pending = true;
    const situation_id = "sit_" + hashLite(text) + "_" + Date.now().toString(36);
    state = { ...state, view: "loading", draft: text, situation_id,
              submitted_at: Date.now(), assessment: null, error: null };
    save();
    show("loading"); setProgressStep("read");

    try {
      const a = await NextStepAPI.assess({
        text, situation_id,
        onProgress: (step, partial) => {
          setProgressStep(step);
          if (partial && partial.partial_summary) {
            $("#partial").textContent = partial.partial_summary;
          }
        }
      });
      state.assessment = a; save();
      renderResult(a);
    } catch (e) {
      state.error = friendlyError(e); save();
      renderError(state.error);
    } finally { pending = false; }
  }

  function friendlyError(e) {
    // The blocker: '"Something went wrong" is not acceptable here.'
    const m = e && e.message;
    if (m === "upstream_unavailable")
      return "The AI service didn't respond in time. Your situation is saved. Try again — or step away and come back; refreshing will not lose what you wrote.";
    if (m === "backend_unreachable")
      return "The Agent backend at " + (NextStepAPI.backend.url || "?") + " isn't reachable. Make sure `uvicorn nextstep_agent.api:app --reload` is running, or remove ?real=1 from the URL to use the mock.";
    if (m && m.startsWith("backend_status_"))
      return "The backend returned an error (" + m.replace("backend_status_", "HTTP ") + "). Your situation is saved; try again in a moment.";
    return "Something interrupted the response. Your situation is saved, and nothing was sent anywhere. Try again in a moment.";
  }

  /* ============================ wiring ============================ */
  function init() {
    // URL knobs for demoing:
    //   ?fast=1     -> 2s mock latency
    //   ?slow=1     -> 25s mock latency
    //   ?err=1      -> force mock error
    //   ?real=1     -> hit the real Agent FastAPI at http://localhost:8000
    //   ?api=<url>  -> point at a custom backend URL
    const params = new URLSearchParams(location.search);
    if (params.get("fast")) NextStepAPI.chaos.latency_ms = 2000;
    if (params.get("slow")) NextStepAPI.chaos.latency_ms = 25000;
    if (params.get("err"))  NextStepAPI.chaos.force_error = true;
    if (params.get("real")) NextStepAPI.backend.url = "http://localhost:8000";
    if (params.get("api"))  NextStepAPI.backend.url = params.get("api");
    if (NextStepAPI.backend.url) {
      const el = document.querySelector("#draft-status");
      if (el) el.textContent = "Live backend: " + NextStepAPI.backend.url;
    }

    // scenario picker
    renderScenarioButtons();

    // draft persistence
    const ta = $("#situation-text");
    if (state.draft) ta.value = state.draft;
    let debounce;
    ta.addEventListener("input", (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.draft = e.target.value; save();
        $("#draft-status").textContent = "Draft saved locally.";
      }, 250);
      $("#draft-status").textContent = "…";
    });

    // form
    $("#form-situation").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      handleSubmit(text);
    });

    // result actions
    $("#btn-update").addEventListener("click", () => {
      // keep the assessment as prior; go back to input with prompt
      ta.value = "";
      $("#draft-status").textContent = "What changed?";
      show("input");
    });
    $("#btn-worse").addEventListener("click", () => {
      ta.value = "It got worse — ";
      show("input");
      ta.focus();
    });
    $("#btn-calm-continue").addEventListener("click", () => {
      // give the user a way OUT of calm mode when they're ready
      if (state.assessment) {
        state.assessment.calm_mode = false; save();
        renderResult(state.assessment);
      } else show("input");
    });

    // error actions
    $("#btn-retry").addEventListener("click", () => {
      const text = state.draft || $("#situation-text").value.trim();
      if (text) handleSubmit(text);
    });
    $("#btn-back").addEventListener("click", () => show("input"));

    // new situation
    $("#btn-new").addEventListener("click", () => {
      if (state.assessment || state.draft) {
        // gentle confirm inline -- no window.confirm (jarring)
        $("#draft-status").textContent = "Cleared. Ready when you are.";
      }
      reset();
      $("#situation-text").value = "";
      show("input");
    });

    // hydrate view from prior state
    if (state.view === "loading" && state.submitted_at &&
        (Date.now() - state.submitted_at) < 60000) {
      // resume the in-flight request
      const text = state.draft || $("#situation-text").value;
      if (text) { handleSubmit(text); return; }
    }
    if (state.view === "result" && state.assessment) { renderResult(state.assessment); return; }
    if (state.view === "calm" && state.assessment) { renderCalm(state.assessment); return; }
    if (state.view === "error" && state.error) { renderError(state.error); return; }
    show("input");

    // cross-tab sync
    if (channel) {
      channel.addEventListener("message", (ev) => {
        const msg = ev.data;
        if (!msg || msg.type !== "sync") return;
        if (msg.state.updated_at > state.updated_at) {
          state = msg.state;
          // don't broadcast back
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
          // gentle rehydrate without focus jump
          if (state.view === "result" && state.assessment) renderResult(state.assessment);
          else if (state.view === "calm" && state.assessment) renderCalm(state.assessment);
          else if (state.view === "input") { $("#situation-text").value = state.draft || ""; show("input"); }
          announce("This situation was updated in another tab.");
        }
      });
    }
  }

  /* ============================ helpers ============================ */
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }
  function hashLite(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(36).slice(0, 8);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
