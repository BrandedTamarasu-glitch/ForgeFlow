#!/usr/bin/env node
const { PROFILES, normalizeProfile } = require('./lean-config');

const STOP_PHRASES = ['normal mode', 'stop lean', 'lean off'];

function instructionLines(profile = 'balanced') {
  const normalized = normalizeProfile(profile) || 'balanced';
  if (normalized === 'off') return ['Forgeflow lean guidance is off for this project.'];
  const definition = PROFILES[normalized] || PROFILES.balanced;
  const lines = [
    `FORGEFLOW LEAN SESSION ACTIVE - profile: ${normalized}`,
    '',
    definition.behavior,
    definition.guidance,
    '',
    'Before custom code, check: current need, stdlib, native platform, installed dependencies, project patterns, then minimum custom code.',
    'Prefer deletion, direct code, and fewer files when current requirements allow it.',
    'For complex requests, take the smallest safe path and name the fuller path only when the user needs it.',
    '',
    'Do not simplify away security, accessibility, trust-boundary validation, data-loss prevention, explicit requirements, calibration/tuning knobs, or one focused check for non-trivial logic.',
    'Use implementation notes or lean markers for known ceilings and upgrade triggers.',
    'This guidance is advisory; current user instructions, code evidence, tests, and review findings win.',
  ];
  if (normalized === 'lite') {
    lines.splice(5, 0, 'Lite mode: build what was asked, but name the smaller alternative in one concise line.');
  }
  return lines;
}

function buildLeanRule(profile = 'balanced') {
  return instructionLines(profile).join('\n');
}

function buildPortableRule({ profile = 'balanced', heading = '# Forgeflow Lean Agent Rules', source = 'generated' } = {}) {
  const normalized = normalizeProfile(profile) || 'balanced';
  return [
    heading,
    '',
    `Profile: ${normalized}`,
    `Source: ${source}`,
    '',
    'Lean guidance is advisory. It does not edit settings, install hooks, mutate context, change routing, commit, push, or call the network.',
    '',
    buildLeanRule(normalized),
    '',
  ].join('\n');
}

module.exports = {
  STOP_PHRASES,
  buildLeanRule,
  buildPortableRule,
  instructionLines,
};
