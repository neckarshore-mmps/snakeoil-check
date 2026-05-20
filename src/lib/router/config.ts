const VALID_PROVIDERS = ['anthropic', 'openai', 'google'] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

interface ModelConfig {
  provider: Provider;
  model_id: string;
}

interface RouterConfig {
  tier1: ModelConfig;
  tier2: ModelConfig;
  freeshot: ModelConfig;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseProvider(value: string, context: string): Provider {
  if (!VALID_PROVIDERS.includes(value as Provider)) {
    throw new Error(
      `Invalid provider "${value}" for ${context}. Must be one of: ${VALID_PROVIDERS.join(', ')}`,
    );
  }
  return value as Provider;
}

export function loadRouterConfig(): RouterConfig {
  const tier1Provider = parseProvider(requireEnv('ROUTER_TIER1_PROVIDER'), 'TIER1');
  const tier1Model = requireEnv('ROUTER_TIER1_MODEL');
  const tier2Provider = parseProvider(requireEnv('ROUTER_TIER2_PROVIDER'), 'TIER2');
  const tier2Model = requireEnv('ROUTER_TIER2_MODEL');
  const freeshotProvider = parseProvider(requireEnv('ROUTER_FREESHOT_PROVIDER'), 'FREESHOT');
  const freeshotModel = requireEnv('ROUTER_FREESHOT_MODEL');

  return {
    tier1: { provider: tier1Provider, model_id: tier1Model },
    tier2: { provider: tier2Provider, model_id: tier2Model },
    freeshot: { provider: freeshotProvider, model_id: freeshotModel },
  };
}
