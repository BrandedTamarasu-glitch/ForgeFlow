/* Ember uses explicit activity snapshots. Chat prose never changes its state. */
(function () {
  'use strict';
  const identity = typeof module !== 'undefined' && module.exports ? require('../../../scripts/forgeflow/agent-identity') : ForgeflowAgentIdentity;
  const STATES = {
    idle: ['Idle', 'Ready for the next idea.', 'A little polishing. A little daydreaming. The forge is ready.'],
    planning: ['Planning', 'First, a good blueprint.', 'Ember lays out the pieces before the first hammer strike.'],
    researching: ['Researching', 'Following a bright idea.', 'Looking closely, gathering clues, and finding the right material.'],
    implementing: ['Implementing', 'Something is taking shape.', 'A steady hammer, a warm forge, and work in progress.'],
    reviewing: ['Reviewing', 'Checking every edge.', 'Ember inspects the work for rough edges and loose connections.'],
    testing: ['Testing', 'Into the test rig.', 'Checking that the finished pieces hold together.'],
    waiting: ['Waiting', 'A hand over here?', 'The work is waiting for input. Ember keeps the forge warm.'],
    failed: ['Failed', 'This needs another look.', 'A check or task reported a failure. The details are below.'],
    complete: ['Complete', 'A job well forged.', 'The workflow explicitly reported that its work is complete.'],
    offline: ['Offline', 'Waiting for the forge.', 'Connect the local activity service to see live work. You can still try every animation.']
  };
  const PRIORITY = ['failed', 'waiting', 'testing', 'reviewing', 'implementing', 'researching', 'planning', 'complete', 'idle'];
  const STALE_MS = 90000;
  function deriveActivity(snapshot, connected, now = Date.now()) {
    if (!connected) return { state: 'offline', label: 'Activity service disconnected', agents: [] };
    if (!snapshot || !Array.isArray(snapshot.agents)) return { state: 'waiting', label: 'Waiting for the first activity snapshot', agents: [] };
    const agents = snapshot.agents.filter(a => a && PRIORITY.includes(a.state) && typeof a.agent === 'string' && Number.isFinite(a.updated_at));
    if (!agents.length) return { state: 'idle', label: 'Connected · no work reported', agents };
    const fresh = agents.filter(a => now - a.updated_at <= STALE_MS);
    const candidates = fresh.length ? fresh : agents;
    const chosen = [...candidates].sort((a, b) => PRIORITY.indexOf(a.state) - PRIORITY.indexOf(b.state) || b.updated_at - a.updated_at)[0];
    const stale = now - chosen.updated_at > STALE_MS && !['idle', 'complete', 'failed'].includes(chosen.state);
    return { state: stale ? 'waiting' : chosen.state, stale, label: stale ? `No recent update · last reported ${chosen.state}` : (chosen.label || `${identity.formatAgentLabel(chosen.agent)} · ${STATES[chosen.state][0]}`), agents };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { deriveActivity, STALE_MS };
  if (typeof document === 'undefined') return;
  const root = document.getElementById('ember');
  if (!root) return;
  root.innerHTML = `
    <div class="ember-workshop"><span class="ember-plaque">FORGEFLOW / WORKSHOP 01</span>
    <svg viewBox="70 15 450 300" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ember-copper" x2=".8" y2="1"><stop stop-color="#edb47c"/><stop offset=".5" stop-color="#b97549"/><stop offset="1" stop-color="#75462f"/></linearGradient>
        <linearGradient id="ember-steel" x2="0" y2="1"><stop stop-color="#828d7b"/><stop offset="1" stop-color="#384b43"/></linearGradient>
        <radialGradient id="ember-light"><stop stop-color="#ffb64b" stop-opacity=".3"/><stop offset="1" stop-color="#ffb64b" stop-opacity="0"/></radialGradient>
      </defs>
      <path d="M107 228V88h48m278-39h25v154M122 92v115m313-139h19" fill="none" stroke="#354039" stroke-width="5"/>
      <g fill="none" stroke="#435047" stroke-width="1"><path d="M102 259h394M130 269h56m104 0h154M319 85h48v38h-48z"/><path d="M327 99h29m-29 7h19"/></g>
      <ellipse cx="305" cy="267" rx="190" ry="24" fill="#080e0c" opacity=".5"/>
      <ellipse cx="350" cy="245" rx="154" ry="63" fill="url(#ember-light)"/>
      <!-- Chimney, firebox, and bellows. -->
      <path d="M380 75h37v86h-37z" fill="#303e36" stroke="#61705a" stroke-width="2"/>
      <path d="M376 75h45v9h-45zm4 28h37m-37 27h37" fill="#52614e" stroke="#788168"/>
      <path d="M364 156l16-19h37l17 19v77h-70z" fill="#4d5140" stroke="#8a7956" stroke-width="2"/>
      <path d="M361 159h76v10h-76zM357 228h83v13h-83z" fill="#927348" stroke="#b28c57"/>
      <path d="M376 221v-29a22 22 0 0144 0v29z" fill="#211c16" stroke="#b17f42" stroke-width="3"/>
      <g class="ember-flame"><path d="M379 219c-9-20 10-23 9-39 13 9 10 17 14 18 6-8 3-13 8-19 0 20 19 22 7 40z" fill="#df7737"/><path d="M389 219c-9-10 9-18 8-28 12 10 6 18 12 28z" fill="#ffd485"/></g>
      <path d="M376 222h46m-43 5h39" stroke="#e6a257" stroke-width="3"/>
      <path d="M369 241v20m60-20v20" stroke="#857554" stroke-width="8"/>
      <path d="M436 195l29-10v35l-29-8" fill="#65432f" stroke="#b48154" stroke-width="2"/><path d="M448 191v25m9-28v29" stroke="#b48154"/>
      <!-- Anvil and stump. -->
      <path d="M291 232h55l5 34h-65z" fill="#644b32" stroke="#94734c" stroke-width="2"/>
      <path d="M300 239l-3 21m32-20l6 20m-22-18v20" stroke="#a18053" opacity=".45"/>
      <path d="M274 208h78l-14 13h-10v7h14v7h-50v-7h13v-7h-13z" fill="url(#ember-steel)" stroke="#9aa48d" stroke-width="2"/>
      <path d="M299 202h29l5 6h-38z" fill="#e7a762"/>
      <g class="ember-prop ember-blueprint"><path d="M276 200l50-8 26 17-54 8z" fill="#486b68" stroke="#9dbbb0"/><path d="M293 202l26-4 16 10-29 4zM300 199l18 12m-23-5l31-5" fill="none" stroke="#c0dad0"/></g>
      <g class="ember-prop ember-test-rig"><path d="M282 210v-25h58v25" fill="none" stroke="#a4895e" stroke-width="4"/><rect x="300" y="178" width="29" height="13" rx="3" fill="#35443c" stroke="#b09968"/><circle class="ember-indicator" cx="308" cy="184" r="3" fill="#f6ca75"/><circle class="ember-indicator" cx="320" cy="184" r="3" fill="#b7de99"/></g>
      <path class="ember-prop ember-crack" d="M309 201l8 3-6 3 10 3" fill="none" stroke="#5b2b1e" stroke-width="3"/>
      <!-- Ember's boots and articulated body. -->
      <path d="M189 221v26m38-26v26" stroke="#64715f" stroke-width="12"/>
      <path d="M183 242h18v17h-32v-6q0-11 14-11zm36 0h17q15 0 15 11v6h-32z" fill="#886040" stroke="#c79260" stroke-width="2"/>
      <path d="M172 257h28m22 0h26" stroke="#e1b680" stroke-width="2"/>
      <g class="ember-body">
        <rect x="163" y="168" width="20" height="46" rx="7" fill="#4b5949" stroke="#8e9473" stroke-width="2"/>
        <path d="M197 143v18h25v-18" fill="#6b7761" stroke="#b4b596" stroke-width="3"/>
        <g class="ember-left-arm"><path d="M181 166l-20 22 8 20" fill="none" stroke="#8e9b80" stroke-width="11" stroke-linecap="round"/><circle cx="162" cy="187" r="7" fill="#b48255" stroke="#e2af78" stroke-width="2"/><path d="M163 205l11 7-5 8-11-7z" fill="#b48255" stroke="#e2af78" stroke-width="2"/></g>
        <path d="M184 157h46q17 0 17 18l-5 41q-1 12-15 12h-35q-14 0-15-12l-4-41q0-18 11-18z" fill="url(#ember-copper)" stroke="#edbc85" stroke-width="2"/>
        <path d="M184 163l6 58h41l6-57" fill="none" stroke="#5a4030" stroke-width="5"/>
        <circle cx="210" cy="193" r="22" fill="#4c4030" stroke="#e0ad72" stroke-width="3"/>
        <circle class="ember-core" cx="210" cy="193" r="16" fill="#f7b55d"/>
        <path d="M200 180v26m10-29v32m10-29v26" stroke="#6b482d" stroke-width="4"/>
        <g fill="#efc695"><circle cx="184" cy="176" r="2"/><circle cx="237" cy="176" r="2"/><circle cx="189" cy="215" r="2"/><circle cx="231" cy="215" r="2"/></g>
        <g class="ember-head">
          <path d="M208 91V77l9-7" fill="none" stroke="#899781" stroke-width="4"/><circle cx="218" cy="69" r="5" fill="#ffd080"/>
          <rect x="167" y="111" width="13" height="24" rx="6" fill="#6e7c64" stroke="#a9b297" stroke-width="2"/><rect x="244" y="111" width="13" height="24" rx="6" fill="#6e7c64" stroke="#a9b297" stroke-width="2"/>
          <rect x="175" y="92" width="75" height="56" rx="20" fill="url(#ember-copper)" stroke="#f1c18d" stroke-width="2"/>
          <path d="M184 103q24-15 56 0" fill="none" stroke="#ffe0a5" stroke-width="2" opacity=".65"/>
          <rect x="183" y="108" width="59" height="30" rx="12" fill="#1c302b" stroke="#704f34" stroke-width="2"/>
          <g class="ember-eyes" fill="#ffd389"><rect x="194" y="117" width="9" height="12" rx="4"/><rect x="222" y="117" width="9" height="12" rx="4"/></g>
          <path d="M210 130q3 3 6 0" fill="none" stroke="#cdaa71" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M185 97l4-2m45 48l5-1" stroke="#71492f" stroke-width="2"/>
        </g>
        <g class="ember-arm">
          <path d="M246 169l18 21 22-8" fill="none" stroke="#91a084" stroke-width="11" stroke-linecap="round"/>
          <circle cx="246" cy="169" r="9" fill="#936640" stroke="#e3b079" stroke-width="2"/><circle cx="246" cy="169" r="3" fill="#3f4d40"/>
          <circle cx="264" cy="190" r="7" fill="#a8754a" stroke="#e3b079" stroke-width="2"/>
          <g class="ember-tool-hammer"><path d="M286 191l6-36" stroke="#c09863" stroke-width="7" stroke-linecap="round"/><path d="M276 142l35 5-2 17-36-5z" fill="url(#ember-steel)" stroke="#bbc1a6" stroke-width="2"/><path d="M279 145l-2 12m29-7l-1 10" stroke="#56654f" stroke-width="3"/></g>
          <path class="ember-prop ember-pencil" d="M286 177l7 22 3 5 0-6-7-22z" fill="#ffcf72"/>
          <g class="ember-prop ember-lens"><path d="M285 182l9-14" stroke="#d4b07b" stroke-width="6"/><circle cx="300" cy="157" r="15" fill="#96c3b42b" stroke="#d4b07b" stroke-width="4"/><path d="M292 155q1-6 7-6" fill="none" stroke="#c9e6d4" stroke-width="2"/></g>
          <g class="ember-prop ember-trophy"><path d="M282 172h19l-3-22h-13z" fill="#c5984d"/><path d="M283 139h19v10q0 12-10 12t-9-12z" fill="#ffce7a" stroke="#fff0b8" stroke-width="2"/><path d="M283 142h-6v6q0 7 8 7m17-13h6v6q0 7-8 7" fill="none" stroke="#e9b962" stroke-width="3"/></g>
          <path d="M281 176l10-3 4 12-11 3z" fill="#c38b56" stroke="#f1c18d" stroke-width="2"/>
        </g>
      </g>
      <g class="ember-sparks" fill="#ffd186"><circle class="ember-spark" cx="386" cy="199" r="2"/><circle class="ember-spark" cx="407" cy="202" r="1.5"/><circle class="ember-spark" cx="315" cy="205" r="2"/></g>
      <g class="ember-sleep" fill="#c4c8aa" font-family="monospace"><text x="253" y="93" font-size="12">z</text><text x="266" y="77" font-size="16">z</text></g>
    </svg><span class="ember-coordinate">EMBER · MODEL 01</span></div>
    <div class="ember-controls">
      <div class="ember-topline"><span class="ember-eyebrow">YOUR FORGE COMPANION</span><span class="ember-source">OFFLINE</span></div>
      <h2></h2><p class="ember-description"></p><div class="ember-readout" role="status" aria-live="polite" aria-atomic="true"></div>
      <div class="ember-mode-row"><button type="button" class="ember-pause" aria-pressed="false">Pause motion</button><button type="button" class="ember-live-button ember-hidden">Return to live</button></div>
      <details class="ember-preview-disclosure"><summary>Animation studio</summary><span class="ember-preview-label" id="ember-preview-label">Try an animation</span><div class="ember-preview" role="group" aria-labelledby="ember-preview-label"></div>
      <p class="ember-preview-note">Previews only change Ember’s pose. Live activity continues to arrive.</p></details>
      <details><summary>Live activity details</summary><ul class="ember-agents"></ul></details>
    </div>`;
  let snapshot = null, connected = false, preview = null, idleSince = Date.now(), lastState = null;
  let paused = false;
  try { paused = localStorage.getItem('forgeflow.ember.paused') === 'true'; } catch (_) { /* Storage may be disabled. */ }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const select = s => root.querySelector(s);
  const pauseButton = select('.ember-pause');
  function setText(selector, text) { const element = select(selector); if (element.textContent !== text) element.textContent = text; }
  const buttons = Object.keys(STATES).map(state => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = STATES[state][0]; button.dataset.previewState = state;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => { preview = state; render(); });
    select('.ember-preview').append(button); return button;
  });
  function render() {
    const live = deriveActivity(snapshot, connected);
    const state = preview || live.state;
    if (lastState !== state) { idleSince = Date.now(); lastState = state; }
    root.dataset.state = state;
    root.dataset.idle = state === 'idle' ? (Date.now() - idleSince > 45000 ? 'dozing' : Math.floor((Date.now() - idleSince) / 12000) % 2 ? 'polishing' : 'watching') : '';
    root.dataset.paused = String(paused); root.dataset.hidden = String(document.hidden);
    setText('.ember-source', preview ? 'PREVIEW' : connected ? 'LIVE' : 'OFFLINE');
    setText('h2', !preview && live.stale ? 'Waiting for an update.' : STATES[state][1]);
    setText('.ember-description', !preview && live.stale ? 'The last activity report is over 90 seconds old. Ember will pick up when the next update arrives.' : STATES[state][2]);
    setText('.ember-readout', preview ? `${STATES[state][0]} preview · live status: ${STATES[live.state][0]}` : `${STATES[state][0]} · ${live.label}`);
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.disabled = motion.matches;
    pauseButton.textContent = motion.matches ? 'Reduced motion enabled' : paused ? 'Resume motion' : 'Pause motion';
    select('.ember-live-button').classList.toggle('ember-hidden', !preview);
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.previewState === preview));
    const list = select('.ember-agents');
    const entries = live.agents.map(a => `${identity.formatAgentLabel(a.agent)}: ${STATES[a.state][0]}${a.label ? ` · ${a.label}` : ''} · ${new Date(a.updated_at).toLocaleTimeString()}`);
    if (!entries.length) entries.push(connected ? 'No agent activity reported yet.' : 'Activity service disconnected.');
    const signature = JSON.stringify(entries);
    if (list.dataset.entries !== signature) {
      list.replaceChildren(...entries.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
      list.dataset.entries = signature;
    }
  }
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem('forgeflow.ember.paused', String(paused)); } catch (_) { /* Optional preference. */ }
    render();
  });
  select('.ember-live-button').addEventListener('click', () => { preview = null; render(); });
  window.addEventListener('forgeflow:connection', event => { connected = event.detail === true; snapshot = null; render(); });
  window.addEventListener('forgeflow:chat', event => {
    const data = event.detail;
    if (data?.type === 'init') snapshot = data.activity || null;
    else if (data?.type === 'activity') snapshot = data;
    else return;
    render();
  });
  motion.addEventListener('change', render);
  document.addEventListener('visibilitychange', render);
  const timer = setInterval(() => { if (!document.hidden) render(); }, 3000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  render();
})();
