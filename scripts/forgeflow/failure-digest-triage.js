const { refreshFailureDigest } = require('./guidance-contract');

const DIGEST_TRIAGE_STATES = Object.freeze({
  USABLE: 'usable',
  STALE: 'stale',
  INVALID: 'invalid',
  RAW_REQUIRED: 'raw-required',
  FIRST_RUN: 'first-run',
  RERUN_NEEDED: 'rerun-needed',
});

function actionForState(state, reason = '') {
  if (state === DIGEST_TRIAGE_STATES.USABLE) {
    return {
      action: 'none',
      command: '',
      reason: 'Failure digest is usable for current triage.',
    };
  }
  if (state === DIGEST_TRIAGE_STATES.RAW_REQUIRED) {
    return {
      action: 'inspect-raw-failure-output',
      command: '',
      reason: reason || 'Digest preserved raw output because compaction was unsafe or inconclusive.',
    };
  }
  if (state === DIGEST_TRIAGE_STATES.RERUN_NEEDED) {
    return refreshFailureDigest({ reason: reason || 'No usable failure digest is available.' });
  }
  if (state === DIGEST_TRIAGE_STATES.FIRST_RUN) {
    return refreshFailureDigest({
      reason: reason || 'No failure digest has been generated yet. Run after the next failed validation command, or paste failing output into /forgeflow-failure-digest.',
    });
  }
  return refreshFailureDigest({ reason: reason || 'Latest failure digest needs to be refreshed.' });
}

function confidenceForDigest(state, digest = {}) {
  if (state === DIGEST_TRIAGE_STATES.USABLE) {
    if ((digest.refs || []).length > 0 && Number(digest.output_lines || 0) > 0) return 'high';
    return 'medium';
  }
  if (state === DIGEST_TRIAGE_STATES.STALE) return 'low';
  if (state === DIGEST_TRIAGE_STATES.RAW_REQUIRED) return 'low';
  return 'none';
}

function usefulnessForState(state) {
  if (state === DIGEST_TRIAGE_STATES.USABLE) return 'usable';
  if (state === DIGEST_TRIAGE_STATES.STALE || state === DIGEST_TRIAGE_STATES.RAW_REQUIRED) return 'limited';
  return 'not-usable';
}

function classifyFailureDigest(digest = {}, freshness = null) {
  let state = DIGEST_TRIAGE_STATES.USABLE;
  let reason = 'Failure digest is current and compact enough for triage.';
  if (!digest || digest.present === false || digest.status === 'missing') {
    if (digest && digest.first_run) {
      state = DIGEST_TRIAGE_STATES.FIRST_RUN;
      reason = 'No failure digest has been generated yet. This is normal before the first captured failure.';
    } else {
      state = DIGEST_TRIAGE_STATES.RERUN_NEEDED;
      reason = 'No latest failure digest artifact is present.';
    }
  } else if (digest.status === 'invalid') {
    state = DIGEST_TRIAGE_STATES.INVALID;
    reason = digest.reason || 'Failure digest is invalid.';
  } else if (digest.raw_required) {
    state = DIGEST_TRIAGE_STATES.RAW_REQUIRED;
    reason = digest.reason || 'Digest preserved raw output because compaction was unsafe or inconclusive.';
  } else if (freshness && freshness.status === 'attention') {
    state = DIGEST_TRIAGE_STATES.STALE;
    reason = 'Latest failure digest is stale for the current checkout.';
  } else if (Number(digest.output_lines || 0) === 0 && Number(digest.input_lines || 0) > 0) {
    state = DIGEST_TRIAGE_STATES.RERUN_NEEDED;
    reason = 'Failure digest has input but no compact signal.';
  }
  return {
    state,
    usefulness: usefulnessForState(state),
    confidence: confidenceForDigest(state, digest),
    reason,
    next_action: actionForState(state, reason),
  };
}

module.exports = {
  DIGEST_TRIAGE_STATES,
  classifyFailureDigest,
};
