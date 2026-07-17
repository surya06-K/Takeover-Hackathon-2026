'use client';

import { AccessibilityProvider } from './AccessibilityProvider';
import OnboardingGuide from './OnboardingGuide';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AccessibilityProvider>
      {children}
      <OnboardingGuide />
    </AccessibilityProvider>
  );
}
