'use strict';
const stageButtons = [...document.querySelectorAll('[data-stage]')];
const panels = [...document.querySelectorAll('.stage-panel')];
function showStage(stage) {
  for (const button of stageButtons) button.setAttribute('aria-pressed', String(button.dataset.stage === stage));
  for (const panel of panels) panel.hidden = panel.id !== `stage-${stage}`;
}
for (const button of stageButtons) button.addEventListener('click', () => showStage(button.dataset.stage));
showStage('plan');
document.querySelector('.stage-controls').hidden = false;
const host = document.getElementById('host');
function updateHost() {
  const target = host.value === 'claude' ? 'claude' : 'codex';
  document.getElementById('install-code').textContent = `node scripts/forgeflow/install-template.js --target ${target} --dry-run --json\nnode scripts/forgeflow/install-template.js --target ${target}`;
  document.getElementById('first-command').textContent = target === 'claude' ? '/consult' : '$consult';
}
host.addEventListener('change', updateHost);
updateHost();
for (const button of document.querySelectorAll('[data-copy]')) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    const status = document.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(document.getElementById(button.dataset.copy).textContent);
      status.textContent = 'Commands copied.';
    } catch {
      status.textContent = 'Copy is unavailable here. Select the commands above to copy them manually.';
    }
  });
}
