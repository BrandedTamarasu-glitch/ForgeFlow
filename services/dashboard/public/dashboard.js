/* Read-only dashboard: independent data snapshots and an authenticated same-origin feed. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const VERDICTS = ['APPROVE', 'CONDITIONAL APPROVE', 'REVISE', 'BLOCK'];
  const COLORS = ['#9ccead', '#a5bbdc', '#dfc783', '#ec9b90'];
  const resources = {
    metrics: { data: null, pending: false, updated: null },
    readiness: { data: null, pending: false, updated: null }
  };
  let selectedProject = '', selectedWindow = '12';
  const count = value => Number.isFinite(value) && value >= 0 ? value : 0;
  const formatTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function statusPill(status) {
    return node('span', status || 'unknown', `status-pill ${String(status || 'unknown').toLowerCase().replace(/[^a-z0-9-]/g, '-')}`);
  }
  async function refreshResource(name) {
    const resource = resources[name];
    if (resource.pending) return;
    resource.pending = true;
    const status = $(name === 'metrics' ? 'metrics-status' : 'readiness-refresh-status');
    status.textContent = resource.data ? `Refreshing · last updated ${formatTime(resource.updated)}` : 'Loading…';
    status.className = 'resource-status';
    $('refresh-dashboard').disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`/api/${name}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || (name === 'metrics' ? !Array.isArray(data.projects) || !Array.isArray(data.verdicts) : !Array.isArray(data.cards))) throw new Error('Invalid response');
      resource.data = data;
      resource.updated = Date.now();
      if (name === 'metrics') renderMetrics(); else renderReadiness(data);
      status.textContent = `Updated ${formatTime(resource.updated)}`;
    } catch (error) {
      const reason = error.name === 'AbortError' ? 'Request timed out' : error.message;
      status.className = `resource-status ${resource.data ? 'stale' : 'error'}`;
      status.textContent = resource.data ? `Stale · last updated ${formatTime(resource.updated)}. Refresh failed: ${reason}.` : `Unavailable · ${reason}. Use Refresh data to retry.`;
      if (!resource.data && name === 'readiness') {
        $('readiness-status').replaceWith(Object.assign(statusPill('unavailable'), { id: 'readiness-status' }));
        $('readiness-state').textContent = 'Launched-project readiness unavailable';
        $('health-summary').textContent = 'Saved project evidence could not be read. Live activity and metrics load independently.';
      } else if (!resource.data && name === 'metrics') {
        $('chart-empty').textContent = 'Weekly history is unavailable. Refresh data to try again.';
      }
    } finally {
      clearTimeout(timeout);
      resource.pending = false;
      $('refresh-dashboard').disabled = Object.values(resources).some(item => item.pending);
    }
  }
  function renderMetrics() {
    const data = resources.metrics.data;
    if (!data) return;
    const select = $('project-select');
    if (selectedProject && !data.projects.some(project => project.project === selectedProject)) selectedProject = '';
    const all = node('option', 'All projects'); all.value = '';
    select.replaceChildren(all, ...data.projects.map(project => {
      const option = node('option', project.project); option.value = project.project; return option;
    }));
    select.value = selectedProject;
    const projects = data.projects.filter(project => !selectedProject || project.project === selectedProject);
    const totals = VERDICTS.map(verdict => projects.reduce((sum, project) => sum + count(project.verdicts?.arbiter?.[verdict]), 0));
    ['approve', 'conditional', 'revise', 'block'].forEach((key, index) => { $(`stat-${key}`).textContent = totals[index].toLocaleString(); });
    $('stat-autofix').textContent = projects.reduce((sum, project) => sum + count(project.auto_fix?.rounds), 0).toLocaleString();
    $('stat-context').textContent = `${selectedProject || 'All projects'} · all-time totals${totals.some(total => total > 0) ? '' : ' · no review verdicts recorded; complete a ForgeFlow review and record its verdict'}`;
    $('parse-warning').hidden = !count(data.parse_warnings);
    $('parse-warning-count').textContent = `${count(data.parse_warnings)} unrecognized telemetry record(s) skipped. Totals may be incomplete.`;
    renderTrend();
  }
  function renderTrend() {
    const data = resources.metrics.data;
    if (!data) return;
    // Windows count recorded ISO weeks, never calendar days or selected-project data.
    const sorted = [...data.verdicts].sort((a, b) => String(a.week).localeCompare(String(b.week)));
    const weeks = selectedWindow === 'all' ? sorted : sorted.slice(-Number(selectedWindow));
    const marks = $('chart-marks'); marks.replaceChildren();
    const tbody = $('verdict-table-body'); tbody.replaceChildren();
    $('chart-empty').hidden = weeks.length > 0;
    $('trend-chart').toggleAttribute('hidden', weeks.length === 0);
    $('chart-empty').textContent = 'No weekly verdicts recorded yet. Complete a ForgeFlow review and record its verdict to start this history. Planning and activity updates do not create review outcomes.';
    $('chart-scope-note').textContent = `All projects · ${selectedWindow === 'all' ? 'all available' : `latest ${selectedWindow} recorded`} weeks`;
    document.querySelectorAll('[data-window]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.window === selectedWindow)));
    const max = Math.max(1, ...weeks.map(week => VERDICTS.reduce((sum, verdict) => sum + count(week.arbiter?.[verdict]), 0)));
    const svg = (tag, attributes, text) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
      if (text !== undefined) element.textContent = text;
      marks.append(element); return element;
    };
    const width = 580, height = 126, left = 35, bottom = 145;
    for (let step = 0; step <= 2; step++) {
      const value = Math.ceil(max * step / 2), y = bottom - value / max * height;
      svg('line', { x1: left, x2: left + width, y1: y, y2: y, stroke: '#354035', 'stroke-dasharray': step ? '3 5' : 'none' });
      svg('text', { x: left - 8, y: y + 3, 'text-anchor': 'end' }, value);
    }
    const cell = width / Math.max(weeks.length, 1), barWidth = Math.min(28, cell * .55);
    weeks.forEach((week, index) => {
      const row = node('tr'); const heading = node('th', week.week); heading.scope = 'row'; row.append(heading);
      let stack = 0;
      VERDICTS.forEach((verdict, series) => {
        const value = count(week.arbiter?.[verdict]); row.append(node('td', value));
        if (value) {
          const rect = svg('rect', { x: left + cell * (index + .5) - barWidth / 2, y: bottom - (stack + value) / max * height, width: barWidth, height: value / max * height, fill: COLORS[series], rx: 1 });
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); title.textContent = `${week.week} · ${verdict}: ${value}`; rect.append(title);
        }
        stack += value;
      });
      tbody.append(row);
      const stride = Math.max(1, Math.ceil(weeks.length / 6));
      if ((index % stride === 0 && index <= weeks.length - 1 - stride) || index === weeks.length - 1) svg('text', { x: left + cell * (index + .5), y: 168, 'text-anchor': 'middle' }, String(week.week));
    });
  }
  function renderReadiness(data) {
    $('readiness-status').replaceWith(Object.assign(statusPill(data.status), { id: 'readiness-status' }));
    $('readiness-state').textContent = `${data.project || 'Launched project'} · launched-project readiness`;
    const healthy = new Set(['ready', 'pass', 'current', 'injected', 'present']);
    const severity = card => ['attention', 'info', 'ok'].includes(card.severity) ? card.severity : healthy.has(card.status) ? 'ok' : 'attention';
    const attention = data.cards.filter(card => severity(card) === 'attention');
    const informational = data.cards.filter(card => severity(card) === 'info');
    $('health-summary').replaceChildren();
    if (!data.cards.length) $('health-summary').textContent = 'No saved readiness evidence yet.';
    else {
      $('health-summary').append(node('strong', `${attention.length} of ${data.cards.length} checks need attention. `));
      $('health-summary').append(document.createTextNode(attention.length ? attention.slice(0, 2).map(card => card.label || card.id).join(' · ') : 'No actionable issues in saved evidence.'));
    }
    if (informational.length) $('health-summary').append(node('p', `${informational.length} informational check(s), including optional or not-yet-recorded evidence.`, 'scope'));
    const cards = $('readiness-cards');
    cards.replaceChildren(...data.cards.map(item => {
      const article = node('article', undefined, 'readiness-card');
      const header = node('header'); header.append(node('strong', item.label || item.id || 'Readiness item'), statusPill(item.status));
      article.append(header, node('p', item.summary || 'No summary available.'));
      if (severity(item) === 'info') article.append(node('p', 'Informational evidence · not an actionable issue', 'scope'));
      if (Array.isArray(item.details) && item.details.length) {
        const list = node('ul'); item.details.forEach(detail => list.append(node('li', String(detail)))); article.append(list);
      }
      if (item.next) article.append(node('code', item.next));
      return article;
    }));
    cards.hidden = false;
    const steps = Array.isArray(data.lean_prime_steps) ? data.lean_prime_steps : [];
    $('readiness-lean-prime-list').replaceChildren(...steps.map(item => {
      const li = node('li'); li.append(statusPill(item.status), node('span', item.label || item.id));
      if (item.reason) li.append(node('p', item.reason, 'scope'));
      if (item.next) li.append(node('code', item.next)); return li;
    }));
    $('readiness-lean-prime').hidden = !steps.length;
    $('readiness-next').hidden = !data.next;
    $('readiness-next-command').textContent = data.next || '';
    $('readiness-copy-status').textContent = '';
    $('readiness-boundary').textContent = data.boundary || '';
    $('readiness-boundary').hidden = !data.boundary;
  }
  function initChat() {
    let entries = [], ws, retryTimer, retryDelay = 1000, stopped = false;
    const activitySeen = new Map();
    let activityRoom = null;
    function activityEntries(snapshot) {
      if (!snapshot || !Array.isArray(snapshot.agents)) return [];
      if (snapshot.room !== activityRoom) { activitySeen.clear(); activityRoom = snapshot.room; }
      const states = new Set(['idle', 'planning', 'researching', 'implementing', 'reviewing', 'testing', 'waiting', 'failed', 'complete']);
      return snapshot.agents.flatMap(agent => {
        if (!agent || typeof agent.agent !== 'string' || !states.has(agent.state) || !Number.isFinite(agent.updated_at)) return [];
        const label = typeof agent.label === 'string' ? agent.label : '';
        const signature = JSON.stringify([agent.state, label, agent.updated_at]);
        if (activitySeen.get(agent.agent) === signature) return [];
        activitySeen.set(agent.agent, signature);
        return [{ agent: agent.agent, level: 'phase', message: `${agent.state}${label ? ` · ${label}` : ''}`, timestamp: agent.updated_at }];
      });
    }
    const messages = $('chat-messages');
    const dispatch = (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail }));
    function setStatus(state, text) {
      $('ws-dot').className = `ws-dot ${state}`;
      $('ws-label').textContent = text;
      dispatch('forgeflow:connection', state === 'connected');
    }
    function normalize(value) {
      if (typeof value === 'string') return { agent: 'System', level: 'message', message: value, timestamp: null };
      if (!value || typeof value !== 'object' || typeof value.message !== 'string') return null;
      return { agent: typeof value.agent === 'string' ? value.agent : 'System', level: typeof value.level === 'string' ? value.level : 'message', message: value.message, timestamp: value.timestamp || null };
    }
    function renderFeed(follow = false) {
      const previousScroll = messages.scrollTop;
      const filter = $('chat-filter').value;
      const filtered = entries.filter(entry => filter === 'all' || entry.level === filter);
      messages.replaceChildren(...filtered.map(entry => {
        const article = node('article', undefined, 'chat-message chat-msg');
        const meta = node('div', undefined, 'chat-meta'); const time = node('time', entry.timestamp ? formatTime(entry.timestamp) : 'Time unavailable');
        if (entry.timestamp && !Number.isNaN(new Date(entry.timestamp).getTime())) time.dateTime = new Date(entry.timestamp).toISOString();
        meta.append(node('span', entry.agent, 'chat-agent'), node('span', entry.level, 'chat-level'), time);
        article.append(meta, node('p', entry.message, 'chat-msg-body')); return article;
      }));
      if (!filtered.length) messages.append(node('p', entries.length ? 'No messages match this filter.' : 'No activity reported yet. Workflow phases and agent messages will appear here when ForgeFlow reports them.', 'empty-state'));
      $('chat-count').textContent = `${filtered.length} message${filtered.length === 1 ? '' : 's'} · latest 100 retained`;
      messages.scrollTop = follow ? messages.scrollHeight : previousScroll;
    }
    $('chat-filter').addEventListener('change', () => renderFeed());
    $('chat-latest').addEventListener('click', () => { messages.scrollTop = messages.scrollHeight; });
    function connect() {
      if (stopped) return;
      setStatus('connecting', 'Connecting…');
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/chat`);
      const timeout = setTimeout(() => { if (ws.readyState === WebSocket.CONNECTING) ws.close(); }, 5000);
      ws.addEventListener('open', () => { clearTimeout(timeout); retryDelay = 1000; setStatus('connected', 'Connected · current room'); });
      ws.addEventListener('message', event => {
        let payload;
        try { payload = JSON.parse(event.data); } catch { payload = event.data; }
        dispatch('forgeflow:chat', payload);
        const follow = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 48;
        if (payload?.type === 'init') {
          activitySeen.clear();
          entries = [...(Array.isArray(payload.history) ? payload.history : []).map(normalize).filter(Boolean), ...activityEntries(payload.activity)]
            .sort((a, b) => (new Date(a.timestamp).getTime() || 0) - (new Date(b.timestamp).getTime() || 0)).slice(-100);
          renderFeed(follow); // History never enters the announcement region, including reconnects.
          return;
        }
        if (payload?.type === 'activity') {
          const updates = activityEntries(payload);
          if (!updates.length) return;
          entries = [...entries, ...updates].slice(-100); renderFeed(follow);
          if (['all', 'phase'].includes($('chat-filter').value)) $('chat-announcement').textContent = updates.map(entry => `${entry.agent}, ${entry.message}`).join('. ');
          return;
        }
        if (payload?.type === 'lifecycle' && payload.event === 'history-cleared') { entries = []; renderFeed(); return; }
        const entry = normalize(payload);
        if (!entry) return;
        entries.push(entry); entries = entries.slice(-100); renderFeed(follow);
        if ($('chat-filter').value === 'all' || $('chat-filter').value === entry.level) $('chat-announcement').textContent = `${entry.agent}, ${entry.level}: ${entry.message}`;
      });
      ws.addEventListener('close', () => {
        clearTimeout(timeout);
        if (stopped) return;
        setStatus('error', `Disconnected · retrying in ${Math.round(retryDelay / 1000)}s`);
        retryTimer = setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 30000);
      });
      ws.addEventListener('error', () => setStatus('error', 'Activity unavailable · reconnecting'));
    }
    window.addEventListener('pagehide', () => { stopped = true; clearTimeout(retryTimer); if (ws) ws.close(); }, { once: true });
    connect();
  }
  $('project-select').addEventListener('change', event => { selectedProject = event.target.value; renderMetrics(); });
  document.querySelectorAll('[data-window]').forEach(button => button.addEventListener('click', () => { selectedWindow = button.dataset.window; renderTrend(); }));
  $('refresh-dashboard').addEventListener('click', () => { void refreshResource('metrics'); void refreshResource('readiness'); });
  $('readiness-copy-command').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('readiness-next-command').textContent); $('readiness-copy-status').textContent = 'Copied'; }
    catch { $('readiness-copy-status').textContent = 'Copy unavailable. Select the command and copy manually.'; }
  });
  document.querySelector('.health-details-link').addEventListener('click', () => { $('readiness-details').querySelector('details').open = true; });
  initChat(); // Live work starts immediately, independently of API latency or failure.
  void refreshResource('metrics');
  void refreshResource('readiness');
})();
