// chat-bridge/profiles.ts — Agent identity data and upstream registration.

import type { AgentId } from './types.js';

// ---------------------------------------------------------------------------
// Agent profile schema
// ---------------------------------------------------------------------------

export interface AgentProfile {
  readonly id: AgentId;
  readonly displayName: string;
  readonly role: string;
  readonly bio: string;
}

import path from 'node:path';
const identity: typeof import('../../scripts/forgeflow/agent-identity.js') = require(path.resolve(__dirname, path.basename(__dirname) === 'dist' ? '../../..' : '../..', 'scripts/forgeflow/agent-identity.js'));
export const AGENT_PROFILES: readonly AgentProfile[] = identity.AGENTS.map(agent => ({
  id: agent.id, displayName: agent.label, role: agent.label, bio: agent.description,
}));

// ---------------------------------------------------------------------------
// Upstream registration
// ---------------------------------------------------------------------------

/**
 * Registers all agent profiles with the agent-chat server via PUT requests.
 * Waits for bounded concurrent requests; logs failures without throwing.
 */
export async function registerProfiles(baseUrl: string): Promise<void> {
  const registrations = AGENT_PROFILES.map(async (profile) => {
    const url = `${baseUrl}/api/profile/${profile.id}`;
    const payload = JSON.stringify({
      name: profile.displayName,
      bio: profile.bio,
      role: profile.role,
    });

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        process.stderr.write(
          `[profiles] Failed to register ${profile.id}: HTTP ${response.status}\n`,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[profiles] Failed to register ${profile.id}: ${message}\n`,
      );
    }
  });

  await Promise.allSettled(registrations);
}
