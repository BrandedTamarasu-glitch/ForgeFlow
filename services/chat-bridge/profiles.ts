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

export const AGENT_PROFILES: readonly AgentProfile[] = [
  { id: 'compass',   displayName: 'Compass',             role: 'Product Manager',    bio: 'Requirements, validation tests, accessibility, final quality gate' },
  { id: 'fc',      displayName: 'Smith',  role: 'Backend Architect',  bio: 'Database design, code quality, business logic, SOLID principles' },
  { id: 'warden',   displayName: 'Warden',             role: 'Security Engineer',  bio: 'Auth, validation, API hardening, efficiency, code reuse' },
  { id: 'lumen',  displayName: 'Lumen',   role: 'UX/UI Designer',     bio: 'Frontend, accessibility, microservices connectivity' },
  { id: 'atlas', displayName: 'Atlas',           role: 'Program Manager',    bio: 'Coordination, persistent memory, creative challenge' },
  { id: 'arbiter',   displayName: 'Arbiter',             role: 'Lead Architect',     bio: 'Forgeflow director, conflict resolution, synthesis, verdicts' },
] as const;

// ---------------------------------------------------------------------------
// Upstream registration
// ---------------------------------------------------------------------------

/**
 * Registers all agent profiles with the agent-chat server via PUT requests.
 * Fire-and-forget: logs errors to stderr but never throws.
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
