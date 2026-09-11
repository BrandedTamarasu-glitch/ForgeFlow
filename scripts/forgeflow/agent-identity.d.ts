export type CanonicalAgentId = 'builder' | 'guardian' | 'designer' | 'coordinator' | 'architect' | 'product_lead' | 'verifier';
export interface AgentIdentity {
  readonly id: CanonicalAgentId;
  readonly label: string;
  readonly slug: string;
  readonly aliases: readonly string[];
  readonly description: string;
}
export const AGENTS: readonly AgentIdentity[];
export function normalizeAgentId(value: unknown): CanonicalAgentId | null;
export function normalizeAgentName(value: string): string;
export function getAgent(value: unknown): AgentIdentity | null;
export function formatAgentLabel(value: string, activityLabel?: string): string;
export function roleActivityLabel(value: unknown): string | null;
export as namespace ForgeflowAgentIdentity;
