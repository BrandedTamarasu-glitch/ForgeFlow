#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

if (process.argv.length < 4) {
  console.error('Usage: render-ship-presentation.js <summary.json> <output.html>');
  process.exit(1);
}

const summaryPath = path.resolve(process.argv[2]);
const outputPath = path.resolve(process.argv[3]);
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderList(items, emptyText) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<li>${escapeHtml(emptyText)}</li>`;
  }
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n');
}

function renderFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return '<li class="file-modified">No changed files detected</li>';
  }
  return files.map((file) => {
    const status = file.status === 'A' ? 'file-added' : file.status === 'D' ? 'file-deleted' : 'file-modified';
    return `<li class="${status}">${escapeHtml(file.path)}</li>`;
  }).join('\n');
}

function implementationNotes(summary) {
  return summary.implementationNotes || summary.implementation_notes || {};
}

function noteSections(notes) {
  return [
    ['Decisions', notes.decisions],
    ['Spec Gaps', notes.spec_gaps || notes.specGaps],
    ['Tradeoffs', notes.tradeoffs],
    ['Deviations', notes.deviations],
    ['Follow-ups', notes.follow_ups || notes.followUps],
    ['Validation Notes', notes.validation_notes || notes.validationNotes],
  ].filter(([, items]) => Array.isArray(items) && items.length > 0);
}

function renderImplementationNotes(notes) {
  const sections = noteSections(notes);
  if (sections.length === 0) return '';
  return `<section>
          <h2>Implementation Notes</h2>
          <div class="card">
            ${sections.map(([label, items]) => `<h3>${escapeHtml(label)}</h3>\n<ul>${renderList(items, 'No notes recorded.')}</ul>`).join('\n')}
          </div>
        </section>`;
}

const renderedImplementationNotes = renderImplementationNotes(implementationNotes(summary));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(summary.title || 'Release Summary')}</title>
  <style>
    :root {
      --bg: #f4efe6;
      --paper: #fbf7f0;
      --ink: #1e1a16;
      --muted: #6f6459;
      --accent: #a04d2f;
      --accent-2: #2d5d50;
      --line: #d9cec1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Iowan Old Style", serif;
      background:
        radial-gradient(circle at top left, rgba(160, 77, 47, 0.10), transparent 30%),
        linear-gradient(180deg, #efe6d8 0%, var(--bg) 100%);
      color: var(--ink);
      padding: 32px 16px;
    }
    .page {
      max-width: 860px;
      margin: 0 auto;
      background: var(--paper);
      border: 1px solid var(--line);
      box-shadow: 0 24px 60px rgba(0,0,0,0.08);
      padding: 32px;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 12px;
      color: var(--accent);
      margin-bottom: 12px;
    }
    h1 {
      font-size: clamp(32px, 5vw, 52px);
      line-height: 1.05;
      margin: 0 0 12px;
    }
    .meta {
      color: var(--muted);
      font-size: 14px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1.3fr 0.9fr;
      gap: 24px;
    }
    section { margin-bottom: 24px; }
    h2 {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      color: var(--muted);
      margin: 0 0 10px;
    }
    h3 {
      margin: 14px 0 6px;
      font-size: 14px;
      color: var(--accent-2);
    }
    h3:first-child { margin-top: 0; }
    p, li { font-size: 16px; line-height: 1.65; }
    ul { margin: 0; padding-left: 18px; }
    .card {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.55);
      padding: 16px 18px;
    }
    .small { color: var(--muted); font-size: 14px; }
    .verdict {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(45, 93, 80, 0.12);
      color: var(--accent-2);
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .files { list-style: none; padding-left: 0; }
    .files li::before {
      content: "•";
      color: var(--accent);
      display: inline-block;
      width: 1em;
      margin-left: -1em;
    }
    @media (max-width: 720px) {
      .page { padding: 20px; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="eyebrow">Forgeflow Shipping Brief</div>
    <h1>${escapeHtml(summary.title || 'Release Summary')}</h1>
    <div class="meta">
      ${escapeHtml(summary.branch || 'unknown branch')} -> ${escapeHtml(summary.baseBranch || 'main')}
      | ${escapeHtml(summary.generatedAt || '')}
    </div>
    <div class="grid">
      <div>
        <section>
          <h2>Summary</h2>
          <p>${escapeHtml(summary.summary || 'Summary pending.')}</p>
        </section>
        <section>
          <h2>Capabilities</h2>
          <ul>${renderList(summary.capabilities, 'No capability summary provided.')}</ul>
        </section>
        <section>
          <h2>Impact</h2>
          <div class="card">${escapeHtml(summary.impact || 'Impact summary pending.')}</div>
        </section>
        <section>
          <h2>Files Changed</h2>
          <ul class="files">${renderFiles(summary.files)}</ul>
        </section>
      </div>
      <div>
        <section>
          <h2>Review Gate</h2>
          <div class="card">
            <div class="verdict">${escapeHtml(summary.reviewGate || 'unknown')}</div>
            <p class="small" style="margin-top: 12px;">${escapeHtml(summary.reviewGateNote || 'No review gate note available.')}</p>
          </div>
        </section>
        <section>
          <h2>Tests</h2>
          <div class="card">
            <ul>${renderList(summary.tests, 'No test results recorded.')}</ul>
          </div>
        </section>
        <section>
          <h2>Risks Mitigated</h2>
          <div class="card">
            <ul>${renderList(summary.risksMitigated, 'No mitigated risks recorded.')}</ul>
          </div>
        </section>
        ${renderedImplementationNotes}
        <section>
          <h2>Notes</h2>
          <div class="card">
            <ul>${renderList(summary.notes, 'No additional notes.')}</ul>
          </div>
        </section>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');
