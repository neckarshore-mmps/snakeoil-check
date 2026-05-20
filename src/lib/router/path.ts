import type { RouteContext } from './types';

/**
 * Path-Selection: Gateway (shared keys) vs Direct (BYOK customer keys).
 *
 * Phase-2 MVP: always 'gateway'. BYOK direct-path is Phase-3+.
 *
 * Defensive: if tier is 'sub-byok' but byok_config is missing, fall back
 * to 'gateway' to prevent crashes (config-load-failure edge case).
 */
export function decidePath(context: RouteContext): 'gateway' | 'direct' {
  if (context.byok_config != null) {
    return 'direct';
  }
  return 'gateway';
}
