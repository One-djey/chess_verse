import React, { createContext, useContext, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallContextValue {
  /** True if the browser has provided an install prompt and app is not standalone */
  canInstall: boolean;
  /** True if app is running as an installed PWA */
  isStandalone: boolean;
  /** Show the OS install dialog */
  triggerInstall: () => Promise<void>;
  /**
   * Hide the banner for the rest of this session.
   * State lives in React memory — resets on every new browser session automatically.
   */
  dismissForSession: () => void;
  /** Whether the install banner should currently be visible */
  showBanner: boolean;
}

const InstallContext = createContext<InstallContextValue>({
  canInstall: false,
  isStandalone: false,
  triggerInstall: async () => {},
  dismissForSession: () => {},
  showBanner: false,
});

function checkStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    !!(navigator as { standalone?: boolean }).standalone
  );
}

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  // dismissed lives in React state (not localStorage/sessionStorage)
  // → resets to false on every new tab/browser session, persists during SPA navigation
  const [dismissed, setDismissed] = useState(false);
  const standalone = checkStandalone();

  useEffect(() => {
    if (standalone) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [standalone]);

  const triggerInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setPrompt(null);
      setDismissed(true);
    }
  };

  return (
    <InstallContext.Provider value={{
      canInstall: !!prompt && !standalone,
      isStandalone: standalone,
      triggerInstall,
      dismissForSession: () => setDismissed(true),
      showBanner: !!prompt && !standalone && !dismissed,
    }}>
      {children}
    </InstallContext.Provider>
  );
}

export const useInstall = () => useContext(InstallContext);
