// chat-bridge/verbosity.ts — Pure verbosity filtering.
// A message passes if its rank is at or below the current threshold.

import type { VerbosityLevel } from './types.js';
import { VERBOSITY_RANK } from './types.js';

export function shouldPass(messageLevel: VerbosityLevel, threshold: VerbosityLevel): boolean {
  return VERBOSITY_RANK[messageLevel] <= VERBOSITY_RANK[threshold];
}
