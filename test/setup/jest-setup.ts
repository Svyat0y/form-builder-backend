import { getGlobalFixture } from './global-setup';
import {
  generateUserData,
  generateInvalidUserData,
  type UserTestData,
  type InvalidUserData,
} from './test-helpers';

/**
 * Setup that runs before EACH test file
 * But NOT global setup - that's in global-setup.ts
 */

// Clear database before each test
beforeEach(async () => {
  const fixture = getGlobalFixture();
  await fixture.clearDatabase();
});

// Export helpers
export function getTestFixture() {
  return getGlobalFixture();
}

export {
  generateUserData,
  generateInvalidUserData,
  type UserTestData,
  type InvalidUserData,
};
