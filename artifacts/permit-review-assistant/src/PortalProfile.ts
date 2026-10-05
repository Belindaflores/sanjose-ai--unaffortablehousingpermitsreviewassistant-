import { createContext, useContext } from 'react';
import type { PortalUser } from '@workspace/api-client-react';

// Keep context identity outside component modules so Fast Refresh never replaces
// the provider and consumer with different instances.
export const ProfileContext = createContext<PortalUser | null>(null);

export function usePortalProfile() {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error('A signed-in portal profile is required.');
  return profile;
}