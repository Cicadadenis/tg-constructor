/**
 * Side-effect bootstrap — load blockRegistry then seal NodeManifestRegistry.
 * Import this once at server startup (after blockRegistry is available).
 */

import { blockDefinitions } from '../blockRegistry.js';
import { primeNodeManifestRegistry } from './nodeManifestRegistry.mjs';

primeNodeManifestRegistry(blockDefinitions);
