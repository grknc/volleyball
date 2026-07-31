import { defineConfig } from 'vitest/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Only when running the real-DB integration suite (`npm run test:db`, which
// sets RUN_DB_TESTS=1 via cross-env) do we load .env/.env.local into
// process.env. This lets weekResetService.integration.test.ts compare
// TEST_DATABASE_URL against the real DATABASE_URL and refuse to run if they
// match — guarding against an operator accidentally pointing the destructive
// integration suite at the real database.
//
// `npm test` never sets RUN_DB_TESTS, so this block is a complete no-op for
// every other test run: process.env is left exactly as the shell provided it.
function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue; // shell env / earlier file always wins
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

if (process.env.RUN_DB_TESTS === '1') {
  // .env.local takes precedence over .env, matching standard dotenv convention.
  loadEnvFile(resolve(process.cwd(), '.env.local'));
  loadEnvFile(resolve(process.cwd(), '.env'));
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
