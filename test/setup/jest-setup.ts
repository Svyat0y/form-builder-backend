import { getGlobalFixture } from './global-setup';
import {
  generateUserData,
  generateInvalidUserData,
  registerUser,
  loginUser,
  createAuthenticatedUser,
  type UserTestData,
  type InvalidUserData,
  type RegisterResponse,
  type AuthResponse,
} from './test-helpers';

/**
 * Setup that runs for EACH test file
 *
 * Database Cleanup Strategy:
 * - By default, database is NOT cleared automatically
 * - Use clearDatabase() manually when needed for test isolation
 * - This improves test performance by avoiding unnecessary cleanups
 *
 * Why this approach?
 * - Tests use unique emails, so no conflicts
 * - Faster test execution
 * - Can selectively clear when needed
 */

export function getTestFixture() {
  return getGlobalFixture();
}

export {
  generateUserData,
  generateInvalidUserData,
  registerUser,
  loginUser,
  createAuthenticatedUser,
  type UserTestData,
  type InvalidUserData,
  type RegisterResponse,
  type AuthResponse,
};
