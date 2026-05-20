import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
};

// withWorkflow() enables "use workflow" / "use step" directive transforms
// at build-time. Required for Vercel Workflow SDK (workflow@4.2.4).
// See: src/lib/workflow/snake-oil-check.ts
export default withWorkflow(config);
