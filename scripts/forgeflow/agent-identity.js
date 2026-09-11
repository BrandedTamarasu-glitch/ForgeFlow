/* Shared agent identities for Node and browser consumers. No runtime dependencies. */
(function exposeAgentIdentity(root) {
  'use strict';
  const AGENTS = Object.freeze([
    { id: 'builder', label: 'Builder', slug: 'builder', aliases: ['smith', 'fc'], description: 'Backend, data models, and code quality' },
    { id: 'guardian', label: 'Guardian', slug: 'guardian', aliases: ['warden'], description: 'Security, system boundaries, and safe integration' },
    { id: 'designer', label: 'Designer', slug: 'designer', aliases: ['lumen'], description: 'Frontend, user experience, accessibility, and connectivity' },
    { id: 'coordinator', label: 'Coordinator', slug: 'coordinator', aliases: ['atlas'], description: 'Scope, project memory, and handoffs' },
    { id: 'architect', label: 'Architect', slug: 'architect', aliases: ['arbiter'], description: 'Technical synthesis, implementation briefs, and verdicts' },
    { id: 'product_lead', label: 'Product Lead', slug: 'product-lead', aliases: ['compass'], description: 'Requirements, planning, and acceptance validation' },
    { id: 'verifier', label: 'Verifier', slug: 'verifier', aliases: ['aegis'], description: 'Independent verification of high-risk findings' },
  ].map((agent) => Object.freeze({ ...agent, aliases: Object.freeze(agent.aliases) })));
  const MODES = Object.freeze({
    audit: 'Audit', auditor: 'Audit', consult: 'Consultation', consultant: 'Consultation',
    discuss: 'Discussion', discusser: 'Discussion', early: 'Requirements and planning',
    implement: 'Implementation', implementer: 'Implementation', plan: 'Planning', planner: 'Planning',
    present: 'Presentation', presenter: 'Presentation', research: 'Research', researcher: 'Research',
    review: 'Review', reviewer: 'Review', validate: 'Validation', validator: 'Validation',
    verify: 'Finding verification', 'debate-judge': 'Debate verdict', 'debate-validator': 'Debate validation',
  });
  function matchAgent(value) {
    if (typeof value !== 'string') return null;
    const name = value.trim().toLowerCase();
    for (const agent of AGENTS) {
      for (const alias of [agent.id, agent.slug, agent.label.toLowerCase(), ...agent.aliases]) {
        if (name === alias) return { agent, suffix: '', separator: name.includes('-') ? '-' : '_' };
        for (const separator of ['-', '_']) {
          if (!name.startsWith(alias + separator)) continue;
          const suffix = name.slice(alias.length + 1);
          if (Object.prototype.hasOwnProperty.call(MODES, suffix.replace(/_/g, '-'))) return { agent, suffix, separator };
        }
      }
    }
    return null;
  }
  function normalizeAgentId(value) { return matchAgent(value)?.agent.id || null; }
  function normalizeAgentName(value) {
    const match = matchAgent(value);
    if (!match) return value;
    const base = match.separator === '-' ? match.agent.slug : match.agent.id;
    return match.suffix ? `${base}${match.separator}${match.suffix}` : base;
  }
  function getAgent(value) { return matchAgent(value)?.agent || null; }
  function formatAgentLabel(value, activityLabel) {
    const label = getAgent(value)?.label || String(value ?? '');
    const context = typeof activityLabel === 'string' ? activityLabel.trim() : '';
    return context ? `${label} · ${context}` : label;
  }
  const ROLE_ACTIVITIES = {
    builder: { review: 'Backend review', implement: 'Backend implementation', consult: 'Backend design', audit: 'Systems audit' },
    guardian: { review: 'Security review', implement: 'Security implementation', consult: 'Security design', audit: 'Security audit' },
    designer: { review: 'Frontend review', implement: 'Frontend implementation', consult: 'Interface design' },
    coordinator: { review: 'Coverage check', implement: 'Implementation coordination', consult: 'Scope and handoffs' },
    architect: { review: 'Final verdict', implement: 'Integration check', consult: 'Technical brief' },
    product_lead: { review: 'Acceptance check', validate: 'Acceptance check', discuss: 'Requirements', plan: 'Planning', research: 'Research', implement: 'Acceptance check' },
    verifier: { verify: 'Finding verification' },
  };
  function roleActivityLabel(value) {
    const match = matchAgent(value);
    if (!match) return null;
    if (match.agent.id === 'verifier') return 'Finding verification';
    if (!match.suffix) return null;
    const mode = match.suffix.replace(/_/g, '-');
    const phase = ({ auditor: 'audit', consultant: 'consult', implementer: 'implement', reviewer: 'review', validator: 'validate', discusser: 'discuss', planner: 'plan', researcher: 'research', presenter: 'present' })[mode] || mode;
    return ROLE_ACTIVITIES[match.agent.id][phase] || MODES[mode];
  }
  const api = Object.freeze({ AGENTS, normalizeAgentId, normalizeAgentName, getAgent, formatAgentLabel, roleActivityLabel });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ForgeflowAgentIdentity = api;
})(typeof globalThis === 'object' ? globalThis : this);
