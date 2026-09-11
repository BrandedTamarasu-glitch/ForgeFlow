#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const CODEX_INVENTORY_SOURCE = 'scripts/forgeflow/installed-codex-inventory.json';

const SCRIPT_EXTENSIONS = new Set(['.js', '.sh']);
const STATIC_FILES = new Set([
  'scripts/forgeflow/agent-identity.d.ts',
  'scripts/forgeflow/vendor/js-yaml/js-yaml.js',
  'scripts/forgeflow/vendor/js-yaml/LICENSE',
  'scripts/forgeflow/vendor/js-yaml/README.md',
  'templates/ship-presentation.html',
  'templates/forgeflow-budget.json',
  'hooks/forgeflow-gate.js',
  'hooks/forgeflow-context-monitor.js',
  'hooks/copilot-hooks.json',
  'hooks/forgeflow-lean-activate.js',
  'hooks/forgeflow-statusline.js',
  'hooks/forgeflow-telemetry.js',
]);
const DASHBOARD_RUNTIME = new Set([
  'services/dashboard/server.js', 'services/dashboard/metrics.js', 'services/dashboard/readiness.js',
  'services/dashboard/tasks.js',
  'services/dashboard/public/dashboard.js', 'services/dashboard/public/dashboard.css',
  'services/dashboard/public/index.html', 'services/dashboard/public/ember.js', 'services/dashboard/public/ember.css',
  'services/dashboard/package.json', 'services/dashboard/package-lock.json',
  'services/agent-chat/session-auth.js', 'services/agent-chat/server.js', 'services/agent-chat/client.js',
  'services/agent-chat/public/index.html', 'services/agent-chat/package.json', 'services/agent-chat/package-lock.json',
]);
const RUNTIME_HELPERS = [
  'scripts/forgeflow/agent-identity.js',
  'scripts/forgeflow/ember-setup.js',
  'scripts/forgeflow/rtk-setup.js',
  'scripts/forgeflow/task-store.js',
  'scripts/forgeflow/task.js',
  'scripts/forgeflow/task-evaluation.js',
  'scripts/forgeflow/task-memory.js',
  'scripts/forgeflow/vault-memory.js',
  'scripts/forgeflow/vault-format.js',
  'scripts/forgeflow/vault-outbox.js',
  'scripts/forgeflow/vault-project.js',
  'scripts/forgeflow/task-maintenance.js',
  'scripts/forgeflow/fleet-environment.js',
  'scripts/forgeflow/advise-context.js',
  'scripts/forgeflow/advise-noisy-command.js',
  'scripts/forgeflow/agent-chat-off.sh',
  'scripts/forgeflow/agent-chat-on.sh',
  'scripts/forgeflow/open-session-dashboard.js',
  'scripts/forgeflow/apply-review-autofix-proposal.js',
  'scripts/forgeflow/build-failure-digest.js',
  'scripts/forgeflow/build-code-topology.js',
  'scripts/forgeflow/build-context-pack.js',
  'scripts/forgeflow/build-context-wave.js',
  'scripts/forgeflow/build-memory-context.js',
  'scripts/forgeflow/build-project-intelligence.js',
  'scripts/forgeflow/build-project-operating-model.js',
  'scripts/forgeflow/build-review-autofix-proposal.js',
  'scripts/forgeflow/build-scope-manifest.js',
  'scripts/forgeflow/capture-command-output.js',
  'scripts/forgeflow/check-agent-drift.js',
  'scripts/forgeflow/check-codex-agent-drift.js',
  'scripts/forgeflow/check-context-contract.js',
  'scripts/forgeflow/check-context-budget.js',
  'scripts/forgeflow/check-implementation-notes.js',
  'scripts/forgeflow/check-project-learnings.js',
  'scripts/forgeflow/check-profile-compliance.js',
  'scripts/forgeflow/check-review-evidence-schema.js',
  'scripts/forgeflow/check-user-profile.js',
  'scripts/forgeflow/classify-review-auto.js',
  'scripts/forgeflow/command-args.js',
  'scripts/forgeflow/command-interface-evidence.js',
  'scripts/forgeflow/command-interface-learning.js',
  'scripts/forgeflow/command-wrapper-contract.js',
  'scripts/forgeflow/compact-command-output.js',
  'scripts/forgeflow/correct-project-learning.js',
  'scripts/forgeflow/context-telemetry.js',
  'scripts/forgeflow/ensure-forgeflow-state.sh',
  'scripts/forgeflow/explain-review-route.js',
  'scripts/forgeflow/file-safety.js',
  'scripts/forgeflow/forgeflow-version.js',
  'scripts/forgeflow/generate-codex-agent-stubs.js',
  'scripts/forgeflow/failure-digest-triage.js',
  'scripts/forgeflow/guidance-contract.js',
  'scripts/forgeflow/health-check.js',
  'scripts/forgeflow/index-memory.js',
  'scripts/forgeflow/install-template.js',
  'scripts/forgeflow/install-manifest.js',
  'scripts/forgeflow/latest-insights-state.js',
  'scripts/forgeflow/memory-retrieval.js',
  'scripts/forgeflow/lean-config.js',
  'scripts/forgeflow/learning-signal-policy.js',
  'scripts/forgeflow/lean-markers.js',
  'scripts/forgeflow/lean-rule-builder.js',
  'scripts/forgeflow/next-action-contract.js',
  'scripts/forgeflow/output-contract.js',
  'scripts/forgeflow/privacy-boundary.js',
  'scripts/forgeflow/project-learning-conflicts.js',
  'scripts/forgeflow/record-agent-feedback.js',
  'scripts/forgeflow/record-command-interface-observation.js',
  'scripts/forgeflow/record-command-interface-learning-outcome.js',
  'scripts/forgeflow/record-first-run-result.js',
  'scripts/forgeflow/record-next-work-outcome.js',
  'scripts/forgeflow/record-pilot-evidence.js',
  'scripts/forgeflow/record-project-learning.js',
  'scripts/forgeflow/record-review-outcome.js',
  'scripts/forgeflow/record-implementation-notes.js',
  'scripts/forgeflow/record-user-profile.js',
  'scripts/forgeflow/render-adoption-pack.js',
  'scripts/forgeflow/render-architecture-docs.js',
  'scripts/forgeflow/render-command-wrapper-batch.js',
  'scripts/forgeflow/render-command-interface-learning-status.js',
  'scripts/forgeflow/render-command-capability-matrix.js',
  'scripts/forgeflow/render-command-index.js',
  'scripts/forgeflow/render-context-retention.js',
  'scripts/forgeflow/render-context-wave-plan.js',
  'scripts/forgeflow/render-dogfood-refresh-plan.js',
  'scripts/forgeflow/render-dogfood-report.js',
  'scripts/forgeflow/render-efficiency-gap-plan.js',
  'scripts/forgeflow/render-first-run-guide.js',
  'scripts/forgeflow/render-first-run-simulator.js',
  'scripts/forgeflow/render-first-useful-win.js',
  'scripts/forgeflow/render-first-task-adoption-loop.js',
  'scripts/forgeflow/render-first-task-report.js',
  'scripts/forgeflow/render-forgeflow-report.js',
  'scripts/forgeflow/render-forgeflow-skills.js',
  'scripts/forgeflow/render-guided-repair.js',
  'scripts/forgeflow/render-insight-injection.js',
  'scripts/forgeflow/render-invocation-hints.js',
  'scripts/forgeflow/render-learning-action-router.js',
  'scripts/forgeflow/render-learning-capture-nudge.js',
  'scripts/forgeflow/render-lean-adapter-drift.js',
  'scripts/forgeflow/render-lean-adapter-smoke.js',
  'scripts/forgeflow/render-lean-adapter-contract.js',
  'scripts/forgeflow/render-lean-audit.js',
  'scripts/forgeflow/render-lean-benchmark.js',
  'scripts/forgeflow/render-lean-benchmark-results.js',
  'scripts/forgeflow/render-lean-benchmark-runner.js',
  'scripts/forgeflow/render-lean-behavior-eval.js',
  'scripts/forgeflow/render-lean-correctness.js',
  'scripts/forgeflow/render-lean-debt.js',
  'scripts/forgeflow/render-lean-decision.js',
  'scripts/forgeflow/render-lean-demo-report.js',
  'scripts/forgeflow/render-lean-eval-pack.js',
  'scripts/forgeflow/render-lean-hook-contract.js',
  'scripts/forgeflow/render-lean-host-adapters.js',
  'scripts/forgeflow/render-lean-host-cli-probes.js',
  'scripts/forgeflow/render-lean-host-command-parity.js',
  'scripts/forgeflow/render-lean-host-packages.js',
  'scripts/forgeflow/render-lean-lab.js',
  'scripts/forgeflow/render-lean-mode.js',
  'scripts/forgeflow/render-lean-openclaw-skill.js',
  'scripts/forgeflow/render-lean-portability-pack.js',
  'scripts/forgeflow/render-lean-prime.js',
  'scripts/forgeflow/render-lean-report.js',
  'scripts/forgeflow/render-lean-review.js',
  'scripts/forgeflow/render-lean-robustness-eval.js',
  'scripts/forgeflow/render-lean-rule-canary.js',
  'scripts/forgeflow/render-lean-session.js',
  'scripts/forgeflow/render-lean-skills.js',
  'scripts/forgeflow/render-lean-status.js',
  'scripts/forgeflow/render-next-work-ranking.js',
  'scripts/forgeflow/render-ownership-map.js',
  'scripts/forgeflow/render-outcome-capture-plan.js',
  'scripts/forgeflow/render-pattern-review.js',
  'scripts/forgeflow/render-post-release-install-verify.js',
  'scripts/forgeflow/render-profile-bootstrap.js',
  'scripts/forgeflow/render-profile-review.js',
  'scripts/forgeflow/render-project-decision-brief.js',
  'scripts/forgeflow/render-research-divergence-eval-results.js',
  'scripts/forgeflow/render-research-divergence-eval.js',
  'scripts/forgeflow/render-research-divergence-advice.js',
  'scripts/forgeflow/render-research-divergence.js',
  'scripts/forgeflow/render-research-divergence-study-judge.js',
  'scripts/forgeflow/render-research-divergence-study.js',
  'scripts/forgeflow/render-review-wave-prep.js',
  'scripts/forgeflow/render-review-auto-evidence.js',
  'scripts/forgeflow/render-release-notes.js',
  'scripts/forgeflow/render-release-readiness.js',
  'scripts/forgeflow/render-release-follow-through.js',
  'scripts/forgeflow/render-release-consumption-rollup.js',
  'scripts/forgeflow/render-release-consumption-loop.js',
  'scripts/forgeflow/render-release-verify.js',
  'scripts/forgeflow/render-support-bundle.js',
  'scripts/forgeflow/render-stale-artifact-plan.js',
  'scripts/forgeflow/render-telemetry-quality.js',
  'scripts/forgeflow/render-update-verify.js',
  'scripts/forgeflow/render-validation-plan.js',
  'scripts/forgeflow/render-workflow-ending-capture.js',
  'scripts/forgeflow/render-workflow-readiness.js',
  'scripts/forgeflow/render-wrapper-drift-plan.js',
  'scripts/forgeflow/render-validation-failure-capture.js',
  'scripts/forgeflow/render-pilot-script.js',
  'scripts/forgeflow/render-ship-presentation.js',
  'scripts/forgeflow/render-evaluation-report.js',
  'scripts/forgeflow/rollup-agent-feedback.js',
  'scripts/forgeflow/rollup-first-run-results.js',
  'scripts/forgeflow/rollup-pattern-learnings.js',
  'scripts/forgeflow/rollup-pilot-evidence.js',
  'scripts/forgeflow/rollup-project-learnings.js',
  'scripts/forgeflow/run-lean-pi-smoke.js',
  'scripts/forgeflow/run-research-divergence-study-codex.js',
  'scripts/forgeflow/run-research-divergence-study.js',
  'scripts/forgeflow/run-review-autofix-sandbox.js',
  'scripts/forgeflow/runtime-drift-snapshot.js',
  'scripts/forgeflow/runtime-helper-contract.js',
  'scripts/forgeflow/runtime-inventory.js',
  'scripts/forgeflow/seed-budget-config.js',
  'scripts/forgeflow/show-code-map.js',
  'scripts/forgeflow/show-project-health-timeline.js',
  'scripts/forgeflow/show-learning-status.js',
  'scripts/forgeflow/show-project-learnings.js',
  'scripts/forgeflow/show-project-trends.js',
  'scripts/forgeflow/show-review-autofix-status.js',
  'scripts/forgeflow/show-user-profile.js',
  'scripts/forgeflow/smoke-check.js',
  'scripts/forgeflow/ship-ci-status.sh',
  'scripts/forgeflow/ship-open-pr.sh',
  'scripts/forgeflow/ship-prepare.sh',
  'scripts/forgeflow/summarize-calibration.js',
  'scripts/forgeflow/summarize-context-telemetry.js',
  'scripts/forgeflow/update-forgeflow.js',
  'scripts/forgeflow/user-profile.js',
];

const CLAUDE_SOURCE_DIRS = ['agents', 'commands', 'forgeflow-patterns', 'hooks', 'project-rules', 'scripts/forgeflow', 'templates', 'services/dashboard', 'services/agent-chat'];
const CODEX_SOURCE_DIRS = ['.codex/agents', '.agents/skills', 'scripts/forgeflow', 'templates', 'forgeflow-patterns', 'services/agent-chat', 'services/dashboard'];


// Exact managed bytes from the release before the role rename. Unknown edits stay local.
const LEGACY_AGENT_FILES = Object.freeze({
  ".codex/agents/aegis.toml": {
    "replacement": ".codex/agents/verifier.toml",
    "sha256": "cb969b4c08b0ec06575f15e1e2d6287a61172a8666b9167c0ded7dc21fe0d60b"
  },
  ".codex/agents/arbiter-consultant.toml": {
    "replacement": ".codex/agents/architect-consultant.toml",
    "sha256": "8594731199dd66c0f126c35228fd6ce94687b045cd76049a2f2b16e422bb72cb"
  },
  ".codex/agents/arbiter-debate-judge.toml": {
    "replacement": ".codex/agents/architect-debate-judge.toml",
    "sha256": "7876c5f8ffbd3c0aeb3354dcd00d3b5d0776a4ce756ae57d8762ea003ab75362"
  },
  ".codex/agents/arbiter-implementer.toml": {
    "replacement": ".codex/agents/architect-implementer.toml",
    "sha256": "bcfd425c4bb6072cdcb1cf701b526f2e861a1a3d3212adfe19e8fa95100bf74b"
  },
  ".codex/agents/arbiter-reviewer.toml": {
    "replacement": ".codex/agents/architect-reviewer.toml",
    "sha256": "1740759246f4ef5ba214ac3970ede415a28517a5615207f37e2e51989b110aef"
  },
  ".codex/agents/atlas-consultant.toml": {
    "replacement": ".codex/agents/coordinator-consultant.toml",
    "sha256": "e86196d06298a8ac1de333d6687875f81ad205be38e47164c56797f48555b33a"
  },
  ".codex/agents/atlas-early.toml": {
    "replacement": ".codex/agents/coordinator-early.toml",
    "sha256": "4e209b47b7bccc826d38c23db5960958fee9a838f4a73b32e0c32fccbfb8bba8"
  },
  ".codex/agents/atlas-implementer.toml": {
    "replacement": ".codex/agents/coordinator-implementer.toml",
    "sha256": "fd9c18f4758b1b72f7beb7072ceb11c976fca85f8f9a12454aa66092a51ccafa"
  },
  ".codex/agents/atlas-presenter.toml": {
    "replacement": ".codex/agents/coordinator-presenter.toml",
    "sha256": "017806c71f6430405a3411dfbb15569c2841c261423f89608fd70c6e102fd9af"
  },
  ".codex/agents/atlas-reviewer.toml": {
    "replacement": ".codex/agents/coordinator-reviewer.toml",
    "sha256": "7ce78b47becce455f2b5b58101d07727cd21e5e2cd6f1c5a0865e35993af5fba"
  },
  ".codex/agents/compass-debate-validator.toml": {
    "replacement": ".codex/agents/product-lead-debate-validator.toml",
    "sha256": "34d478449ad29e686925991917b7279c8c79e533051bcdced79e1ee5c1930073"
  },
  ".codex/agents/compass-discusser.toml": {
    "replacement": ".codex/agents/product-lead-discusser.toml",
    "sha256": "5fb22596785b8d26d88251cceda4c902f6e364ee743d7802a73f5998af7256b9"
  },
  ".codex/agents/compass-planner.toml": {
    "replacement": ".codex/agents/product-lead-planner.toml",
    "sha256": "306f86415b1859cbdbcb1624578586370f46b314e4fbd61bfb39048231fe7a10"
  },
  ".codex/agents/compass-presenter.toml": {
    "replacement": ".codex/agents/product-lead-presenter.toml",
    "sha256": "443cc8f872aec4fb89c373b24ee724b0364adbadc774221235a2115b3c9bf420"
  },
  ".codex/agents/compass-researcher.toml": {
    "replacement": ".codex/agents/product-lead-researcher.toml",
    "sha256": "6f8f79c3eec480f00241a11bf9685ae5f4ab6a40e92eac89f8d7477d08e711de"
  },
  ".codex/agents/compass-reviewer.toml": {
    "replacement": ".codex/agents/product-lead-reviewer.toml",
    "sha256": "011795a2c386c3bade1da2e52dd9927ec0fcec3b0677210db51ff3c36d0f1434"
  },
  ".codex/agents/compass-validator.toml": {
    "replacement": ".codex/agents/product-lead-validator.toml",
    "sha256": "f9ec0c079ce53b6f4b9869352bb95af550e50d4686e8d339e69bdb857ebda19c"
  },
  ".codex/agents/lumen-consultant.toml": {
    "replacement": ".codex/agents/designer-consultant.toml",
    "sha256": "7336aef115d2c59ac8aded02a49f2e8ed2ced24961658cc2cb71ec4766f7986f"
  },
  ".codex/agents/lumen-implementer.toml": {
    "replacement": ".codex/agents/designer-implementer.toml",
    "sha256": "e322621c95d7692f90681d8598ee29bc7d0ef9ef3421db7949c1867d5da944fe"
  },
  ".codex/agents/lumen-reviewer.toml": {
    "replacement": ".codex/agents/designer-reviewer.toml",
    "sha256": "a4c5a2018452a891cec11484ab67c7fc7f15d317db147bcc4d77628e1d1ddec5"
  },
  ".codex/agents/smith-auditor.toml": {
    "replacement": ".codex/agents/builder-auditor.toml",
    "sha256": "e0f030c48492012a9a159d10c8b1ab2351ca48b2c01c246f2cb39d6fe07b7523"
  },
  ".codex/agents/smith-consultant.toml": {
    "replacement": ".codex/agents/builder-consultant.toml",
    "sha256": "c7dbd98036cb10fd230373812b45aaef2979602eeb6e1572b7933d979e3e3381"
  },
  ".codex/agents/smith-implementer.toml": {
    "replacement": ".codex/agents/builder-implementer.toml",
    "sha256": "6e53b73bae781cddcea770b9ed443c9668a17284d875e4c9675eae5e82632dc1"
  },
  ".codex/agents/smith-reviewer.toml": {
    "replacement": ".codex/agents/builder-reviewer.toml",
    "sha256": "119aa4ace7906fdba30d5a27d9843f48a954da638e4f60ef89fdee2136011881"
  },
  ".codex/agents/warden-auditor.toml": {
    "replacement": ".codex/agents/guardian-auditor.toml",
    "sha256": "368514a0dff0dc51cc57909d5894e9cf84efeac2d614087c4b9c8a1458fddb4b"
  },
  ".codex/agents/warden-consultant.toml": {
    "replacement": ".codex/agents/guardian-consultant.toml",
    "sha256": "4ebf8010cf83c780d986cae601ca3741d56161c1fc33bae324f4d9f6ab10b705"
  },
  ".codex/agents/warden-implementer.toml": {
    "replacement": ".codex/agents/guardian-implementer.toml",
    "sha256": "0814abefa254db4a81da1c315d1908a77bfda12edfe9e89ac2e40c301fe67f3a"
  },
  ".codex/agents/warden-reviewer.toml": {
    "replacement": ".codex/agents/guardian-reviewer.toml",
    "sha256": "207e3b928782b18837cf1b8f6fcc3daafbc7873ad3ecadbdb683ed7c9d59d7f4"
  },
  "agents/_shared/arbiter-intelligence.md": {
    "replacement": "agents/_shared/architect-intelligence.md",
    "sha256": "26cb6b11d67f2db000062634ea39f29ce1bcc8a40252770f19f93065cc3ad43b"
  },
  "agents/_shared/lumen-design-principles.md": {
    "replacement": "agents/_shared/designer-design-principles.md",
    "sha256": "a6c48f9d70c223928c51de8caa7940c601357d409d76d1c83d49fdb38e967978"
  },
  "agents/_shared/smith-craft.md": {
    "replacement": "agents/_shared/builder-craft.md",
    "sha256": "19476faa1c02697c3bcf5466a425121b2569994726ad209a8469df69b7ef630f"
  },
  "agents/_shared/warden-security-intelligence.md": {
    "replacement": "agents/_shared/guardian-security-intelligence.md",
    "sha256": "75286673de63b0553183a8ebb9c1852cc4214d48d4e4e98b1da609e2d83c1bed"
  },
  "agents/aegis.md": {
    "replacement": "agents/verifier.md",
    "sha256": "4609590197d56ab7e3a20b92c1f897f1b64ce771433291bba75b9b0f8eb189cd"
  },
  "agents/arbiter-consult.md": {
    "replacement": "agents/architect-consult.md",
    "sha256": "e66a2bc875ad7e4210e932f4efc170d4ab4155f40ea1eab20005afe4d512f0a5"
  },
  "agents/arbiter-implement.md": {
    "replacement": "agents/architect-implement.md",
    "sha256": "9cbdc7a3a982edece013e252f9d3eb04b0d6090fa8f8f29534ae6960a45c3cea"
  },
  "agents/arbiter-review.md": {
    "replacement": "agents/architect-review.md",
    "sha256": "b84b9d85c3c6e97f85a0eaabee5a915c0bf8a78335bfe9047684234696780f60"
  },
  "agents/atlas-consult.md": {
    "replacement": "agents/coordinator-consult.md",
    "sha256": "bc582e6b9d7960e92e83edccb81529f4c21c15719ff3fc7d316cab62915bd049"
  },
  "agents/atlas-early.md": {
    "replacement": "agents/coordinator-early.md",
    "sha256": "41e57d2ae25ceeadd644295f80d9df4ae6dd3f2ab9cdf90a5d6ebc3a3d65d7e0"
  },
  "agents/atlas-implement.md": {
    "replacement": "agents/coordinator-implement.md",
    "sha256": "694caa5a1dedcd0bd7a121edae90f7ae5c24e56fb3ce5d18e46ab6072e2c7807"
  },
  "agents/atlas-present.md": {
    "replacement": "agents/coordinator-present.md",
    "sha256": "85038e6212e4ca2b24588e40c00928cb8c1c8160ce43a26ce827747e7350c731"
  },
  "agents/atlas-review.md": {
    "replacement": "agents/coordinator-review.md",
    "sha256": "d0c67d7991cf2ef7a5229a8df27bb2b592e82b72271c0fa6582e15e8b86c2ab5"
  },
  "agents/compass-discuss.md": {
    "replacement": "agents/product-lead-discuss.md",
    "sha256": "66c73fb4a00a91464175ef2138c3715fe3dff80efa4ca00418ffc12e8e14aeae"
  },
  "agents/compass-implement.md": {
    "replacement": "agents/product-lead-implement.md",
    "sha256": "9ab37cf0450045d6393ab79a9b473311b87ade8ef0e983d5f1633b3f57870897"
  },
  "agents/compass-plan.md": {
    "replacement": "agents/product-lead-plan.md",
    "sha256": "5646fbe96b07f485a8f7b880cf5a3e47f03003f677f2f3e7272aced7aed90ff4"
  },
  "agents/compass-present.md": {
    "replacement": "agents/product-lead-present.md",
    "sha256": "ef389d8e016eba972becfb9edc3820e4b6fe3ec3084c757a282cb15574216f18"
  },
  "agents/compass-research.md": {
    "replacement": "agents/product-lead-research.md",
    "sha256": "ded8eaed0e804689ee4c45e646df6587c0b11b88c97210ed0014dce2bd1272ae"
  },
  "agents/compass-review.md": {
    "replacement": "agents/product-lead-review.md",
    "sha256": "a6e0de987cfc05592b738b0b1c21f29cf6974a9b9ce9c4b8f40dc5452198dd14"
  },
  "agents/lumen-consult.md": {
    "replacement": "agents/designer-consult.md",
    "sha256": "805ea812c3bd77dc4bf25fba4babf38cfd72acf43c0cea0580b5ad59f6e9a55d"
  },
  "agents/lumen-implement.md": {
    "replacement": "agents/designer-implement.md",
    "sha256": "6de74fa96e2cb08ac8e7e0d1152390fee2e40b7ca034ffbbfe1720e3b9d42ff2"
  },
  "agents/lumen-review.md": {
    "replacement": "agents/designer-review.md",
    "sha256": "e4c5a292b49c053c047083a207cf5dc1b1b2c401347f856828a9405cc99b2cfb"
  },
  "agents/smith-audit.md": {
    "replacement": "agents/builder-audit.md",
    "sha256": "a7e714342d4a534968ad3ba1490874d6f188802c3beeb8c61dda83d0f08d952c"
  },
  "agents/smith-consult.md": {
    "replacement": "agents/builder-consult.md",
    "sha256": "d6398407a7ba43504feb795a81fe4cbd98cd36609dff23087272322c1e8defac"
  },
  "agents/smith-implement.md": {
    "replacement": "agents/builder-implement.md",
    "sha256": "d953676b7408a0b903d0c6a517ab0db4d2e1b97bae8580a41d2ce05851426b3f"
  },
  "agents/smith-review.md": {
    "replacement": "agents/builder-review.md",
    "sha256": "76e05e726dfb4444ecf0a9679dc3701cf0a7bccc17f037f5f8f58c07c10b4d72"
  },
  "agents/warden-audit.md": {
    "replacement": "agents/guardian-audit.md",
    "sha256": "17e9b8f3d30e07f6cb3e77acf4cb9e723f8ed15ef60d9c3192f2018f1ed789d8"
  },
  "agents/warden-consult.md": {
    "replacement": "agents/guardian-consult.md",
    "sha256": "cc0f28f04caf16956e7c959c39549788990df510b6e29111471c49219b5e733d"
  },
  "agents/warden-implement.md": {
    "replacement": "agents/guardian-implement.md",
    "sha256": "21feb5bfe0900d5eb685237ea30a15d815e2349d8af0501bf7c9377b341484e0"
  },
  "agents/warden-review.md": {
    "replacement": "agents/guardian-review.md",
    "sha256": "be7d65bf35fb9f18a3044d92c679b6be4316b01d35702dd8fef011d0b3728e93"
  }
});

function legacyAgentCandidates(home, target = 'claude', sources = []) {
  const available = new Set(sources);
  return Object.entries(LEGACY_AGENT_FILES).flatMap(([source, identity]) => {
    const entry = manifestEntry(source, home, target);
    if (!entry || entry.preserve || available.has(source) || !available.has(identity.replacement)) return [];
    assertSafeDestination(entry.destination, home);
    const stat = fs.lstatSync(entry.destination, { throwIfNoEntry: false });
    if (!stat) return [];
    const verified = stat.isFile() && crypto.createHash('sha256').update(fs.readFileSync(entry.destination)).digest('hex') === identity.sha256;
    return [{ source, destination: entry.destination, verified }];
  });
}

function normalizeTarget(target = 'claude') {
  if (!['claude', 'codex'].includes(target)) throw new Error(`Unsupported runtime target: ${target}`);
  return target;
}

function walk(root, dir, files = []) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return files;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const relativePath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(root, relativePath, files);
    else if (entry.isFile()) files.push(relativePath.replace(/\\/g, '/'));
  }
  return files;
}

function codexSourceAllowed(source) {
  if (hasUnsafePathSegment(source)) return false;
  return source === 'hooks/forgeflow-telemetry.js' || DASHBOARD_RUNTIME.has(source) || /^\.codex\/agents\/[^/]+\.toml$/.test(source)
    || /^\.agents\/skills\/[^/]+\/.+/.test(source)
    || (/^(scripts\/forgeflow|templates|forgeflow-patterns|services\/agent-chat)\//.test(source)
      && !source.includes('/node_modules/')
      && !/^scripts\/forgeflow\/test-/.test(source));
}

function managedSources(root, target = 'claude') {
  const normalizedTarget = normalizeTarget(target);
  const dirs = normalizedTarget === 'codex' ? CODEX_SOURCE_DIRS : CLAUDE_SOURCE_DIRS;
  const files = dirs.flatMap((dir) => walk(root, dir));
  if (normalizedTarget === 'codex') {
    if (fs.existsSync(path.join(root, 'hooks', 'forgeflow-telemetry.js'))) files.push('hooks/forgeflow-telemetry.js');
    if (fs.existsSync(path.join(root, '.codex', 'agent-canonical-map.json'))) files.push('.codex/agent-canonical-map.json');
    return [...new Set(files.filter((source) => codexSourceAllowed(source) || source === '.codex/agent-canonical-map.json'))].sort();
  }
  return [...new Set(files.filter(isManagedSource))].sort();
}

function usage() {
  console.error('Usage: install-manifest.js [--source <path>] [--target claude|codex] [--dest <home>] [--json]');
}

function parseArgs(argv) {
  const opts = {
    source: '',
    home: '',
    target: 'claude',
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source') {
      opts.source = argv[++i] || '';
    } else if (arg === '--target') {
      opts.target = argv[++i] || '';
    } else if (arg === '--dest') {
      opts.home = argv[++i] || '';
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }

  opts.target = normalizeTarget(opts.target);

  return opts;
}

function normalize(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function hasUnsafePathSegment(file) {
  return normalize(file).split('/').some((segment) => !segment || segment === '..' || segment === '.');
}

function categoryFor(source) {
  const file = normalize(source);
  if (hasUnsafePathSegment(file)) return '';
  if (/^agents\/[^/]+\.md$/.test(file)) return 'agent';
  if (/^agents\/_shared\/[^/]+\.md$/.test(file)) return 'shared-agent';
  if (/^commands\/[^/]+(?:\/[^/]+)?\.md$/.test(file)) return 'command';
  if (/^skills\/[^/]+\/SKILL\.md$/.test(file)) return 'skill';
  if (/^project-rules\/[^/]+\.md$/.test(file)) return 'project-rule';
  if (/^forgeflow-patterns\/[^/]+\.md$/.test(file)) return 'pattern';
  if (DASHBOARD_RUNTIME.has(file)) return 'runtime-service';
  if (STATIC_FILES.has(file)) return file.split('/')[0].slice(0, -1);
  if (/^scripts\/forgeflow\/(?!test-)[^/]+\.(?:js|sh)$/.test(file)) return 'runtime-script';
  if (RUNTIME_HELPERS.includes(file) && SCRIPT_EXTENSIONS.has(path.extname(file))) return 'runtime-script';
  return '';
}

function isManagedSource(source) {
  return categoryFor(source) !== '';
}

function shouldPreserveDestination(source) {
  const file = normalize(source);
  return /^agents\/custom-[^/]+\.md$/.test(file);
}

function destinationFor(source, home = '~/.claude') {
  const file = normalize(source);
  if (!isManagedSource(file)) return '';
  if (/^agents\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^agents\/_shared\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^commands\/[^/]+(?:\/[^/]+)?\.md$/.test(file)) return path.posix.join(home, file);
  if (/^skills\/[^/]+\/SKILL\.md$/.test(file)) return path.posix.join(home, file);
  if (/^project-rules\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^forgeflow-patterns\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^templates\/[^/]+$/.test(file)) return path.posix.join(home, file);
  if (/^hooks\/[^/]+$/.test(file)) return path.posix.join(home, file);
  if (DASHBOARD_RUNTIME.has(file)) return path.posix.join(home, 'forgeflow', file);
  if (file.startsWith('scripts/forgeflow/vendor/js-yaml/')) return path.posix.join(home, 'forgeflow', file);
  if (/^scripts\/forgeflow\/[^/]+$/.test(file)) {
    return path.posix.join(home, 'forgeflow', file);
  }
  return '';
}

function codexDestinationFor(source, home = '~/.codex') {
  const file = normalize(source);
  if (/^\.codex\/agents\/[^/]+\.toml$/.test(file)) return path.join(home, 'agents', path.basename(file));
  if (/^\.agents\/skills\/[^/]+\/.+/.test(file)) return path.join(home, 'skills', file.replace(/^\.agents\/skills\//, ''));
  if (file === '.codex/agent-canonical-map.json') return path.join(home, 'forgeflow', 'agent-canonical-map.json');
  if (codexSourceAllowed(file)) return path.join(home, 'forgeflow', file);
  return '';
}

function destinationForTarget(source, home, target = 'claude') {
  return normalizeTarget(target) === 'codex'
    ? codexDestinationFor(source, home)
    : destinationFor(source, home);
}

function assertSafeDestination(destination, home) {
  const root = path.resolve(home);
  const target = path.resolve(destination);
  const relativePath = path.relative(root, target);
  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Destination escapes runtime home: ${destination}`);
  }
  let current = root;
  for (const segment of relativePath.split(path.sep)) {
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Refusing symlinked runtime destination path: ${current}`);
    }
    current = path.join(current, segment);
  }
  if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error(`Refusing symlinked runtime destination path: ${current}`);
  }
}

function manifestEntry(source, home = '~/.claude', target = 'claude') {
  const file = normalize(source);
  const normalizedTarget = normalizeTarget(target);
  const category = normalizedTarget === 'codex'
    ? (codexSourceAllowed(file) || file === '.codex/agent-canonical-map.json' ? 'runtime-file' : '')
    : categoryFor(file);
  if (!category) return null;
  return {
    source: file,
    destination: destinationForTarget(file, home, normalizedTarget),
    category,
    preserve: normalizedTarget === 'claude' && shouldPreserveDestination(file),
    executable: normalizedTarget === 'claude'
      ? category === 'runtime-script'
      : file.endsWith('.sh'),
  };
}

// Persist source paths before destination damage can change discovery. Legacy or
// corrupt installs return null and must bootstrap from the upstream tree.
function readCodexInventory(home) {
  const file = codexDestinationFor(CODEX_INVENTORY_SOURCE, home);
  assertSafeDestination(file, home);
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || data.schema_version !== '1' || !Array.isArray(data.sources) || !data.sources.length
      || data.sources.some((source) => typeof source !== 'string' || !manifestEntry(source, home, 'codex'))
      || !data.sources.includes(CODEX_INVENTORY_SOURCE)) return null;
    return [...new Set(data.sources)].sort();
  } catch (err) {
    if (err.code === 'ENOENT' || err instanceof SyntaxError) return null;
    throw err;
  }
}

function codexInventoryContent(sources) {
  return `${JSON.stringify({ schema_version: '1', sources: [...new Set([...sources, CODEX_INVENTORY_SOURCE])].sort() }, null, 2)}\n`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.source) {
    usage();
    process.exit(2);
  }
  const home = opts.home || (opts.target === 'codex' ? '~/.codex' : '~/.claude');
  const entry = manifestEntry(opts.source, home, opts.target);
  if (!entry) {
    process.exit(1);
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
  } else {
    console.log(entry.destination);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  LEGACY_AGENT_FILES,
  legacyAgentCandidates,
  CODEX_INVENTORY_SOURCE,
  codexInventoryContent,
  readCodexInventory,
  RUNTIME_HELPERS,
  STATIC_FILES,
  assertSafeDestination,
  categoryFor,
  codexDestinationFor,
  codexSourceAllowed,
  destinationFor,
  destinationForTarget,
  hasUnsafePathSegment,
  isManagedSource,
  manifestEntry,
  managedSources,
  normalizeTarget,
  shouldPreserveDestination,
};
