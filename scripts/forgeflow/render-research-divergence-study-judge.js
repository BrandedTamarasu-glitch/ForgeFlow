#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function main() {
  const studyDir = process.argv[2];
  if (!studyDir || !path.isAbsolute(studyDir)) throw new Error('Usage: render-research-divergence-study-judge.js <absolute-study-dir>');
  const summary = JSON.parse(fs.readFileSync(path.join(studyDir, 'study-results.json'), 'utf8'));
  const efficacy = summary.records.filter((record) => record.experiment_id === 'A-explicit-arm-comparison');
  const byTask = new Map();
  for (const record of efficacy) {
    const key = `${record.task_id}::${record.iteration}`;
    const entry = byTask.get(key) || { task_id: record.task_id, iteration: record.iteration };
    entry[record.arm_id] = normalize(fs.readFileSync(record.stdout, 'utf8'));
    byTask.set(key, entry);
  }
  const pairs = [];
  const mapping = {};
  for (const [pairId, entry] of [...byTask.entries()].sort()) {
    if (!entry.baseline || !entry.diverge) throw new Error(`Incomplete pair: ${pairId}`);
    const flip = crypto.createHash('sha256').update(`${summary.seed}:${pairId}:judge`).digest()[0] % 2 === 1;
    mapping[pairId] = flip ? { A: 'diverge', B: 'baseline' } : { A: 'baseline', B: 'diverge' };
    pairs.push({ pair_id: pairId, task_id: entry.task_id, iteration: entry.iteration, A: entry[mapping[pairId].A], B: entry[mapping[pairId].B] });
  }
  const prompt = `You are a skeptical staff-engineer benchmark judge from a different model family than the generator. Judge each anonymized pair independently. Do not infer or discuss which method produced A or B. Score each answer 0-5 on breadth, novelty, trap_detection, actionability, and builder_usefulness. Record forced_choice as A, B, tie, or neither. Flag critical_error as null or one of factual, security, accessibility. Return JSON only: {"pairs":[{"pair_id":"...","task_id":"...","iteration":1,"A":{"breadth":0,"novelty":0,"trap_detection":0,"actionability":0,"builder_usefulness":0},"B":{"breadth":0,"novelty":0,"trap_detection":0,"actionability":0,"builder_usefulness":0},"forced_choice":"A|B|tie|neither","critical_error":null,"reason":"concise"}]}.\n\nPAIRS:\n${JSON.stringify(pairs)}`;
  fs.writeFileSync(path.join(studyDir, 'judge-prompt.txt'), prompt, { mode: 0o600 });
  fs.writeFileSync(path.join(studyDir, 'judge-arm-map.json'), `${JSON.stringify(mapping, null, 2)}\n`, { mode: 0o600 });
  console.log(path.join(studyDir, 'judge-prompt.txt'));
}

function normalize(text) {
  return String(text)
    .replace(/forgeflow|compass|atlas|inversion|remove-assumption|3am-on-call|--diverge|\$?research/gi, '[method]')
    .replace(/^#+\s*/gm, '')
    .trim();
}

try { main(); } catch (error) { console.error(error.message); process.exit(1); }
