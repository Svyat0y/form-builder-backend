import { E2ETestFixture } from './e2e-setup';

/**
 * REAL global setup - runs ONCE before ALL tests
 * Uses global object to share data between test processes
 */
export default async function globalSetup(): Promise<void> {
  console.log('🌍 GLOBAL SETUP: Starting (runs ONCE before all tests)...');

  const fixture = new E2ETestFixture();
  await fixture.setup();

  // Store fixture in global object - accessible in all test processes
  (global as any).__E2E_FIXTURE__ = fixture;

  console.log('✅ GLOBAL SETUP: Completed');
}

export function getGlobalFixture(): E2ETestFixture {
  const fixture = (global as any).__E2E_FIXTURE__;

  if (!fixture) {
    throw new Error(
      'Global fixture not initialized. ' +
        'Make sure globalSetup completed successfully.',
    );
  }

  return fixture;
}

export async function globalTeardown(): Promise<void> {
  console.log('🌍 GLOBAL TEARDOWN: Starting (runs ONCE after all tests)...');

  const fixture = (global as any).__E2E_FIXTURE__;

  if (fixture) {
    await fixture.teardown();
    delete (global as any).__E2E_FIXTURE__;
  }

  console.log('✅ GLOBAL TEARDOWN: Completed');
}
