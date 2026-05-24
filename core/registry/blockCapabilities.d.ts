export interface BlockCapabilities {
  triggers?: readonly string[];
  actions?: readonly string[];
  async: boolean;
  outputs: readonly string[];
}

export const BLOCK_CAPABILITIES_VERSION: "1.0";

export const blockCapabilitiesByType: Readonly<Record<string, BlockCapabilities>>;

export function getBlockCapabilities(blockType: string): BlockCapabilities;

export function hasBlockCapabilities(blockType: string): boolean;

export function isAllowedSourcePort(
  blockType: string,
  sourcePortId: string | null | undefined,
): boolean;

export function executionTriggerForSource(
  blockType: string,
  sourcePortId?: string | null,
): "next" | "callback" | "state";

export function assertBlockCapabilitiesRegistered(blockType: string): void;

export function attachCapabilitiesToDefinition<T extends { type: string }>(
  definition: T,
): T & { nodeCapabilities: BlockCapabilities };
