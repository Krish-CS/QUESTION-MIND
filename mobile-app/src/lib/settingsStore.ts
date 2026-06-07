/**
 * settingsStore.ts - Zustand store for AI settings
 * Manages API keys, provider preferences, device capabilities
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DeviceCapabilities {
  platform: string;
  supportsLocalModels: boolean;
  availableMemoryMB: number;
  availableStorageMB: number;
  availableModels: Array<{
    name: string;
    label: string;
    description: string;
    memoryMB: number;
    storageMB: number;
  }>;
}

export interface APIKeySettings {
  provider: string;
  label?: string;
  maskedKey?: string;
  createdAt?: string;
  lastUsed?: string;
}

export interface ProviderStatus {
  name: string;
  status: 'available' | 'limited' | 'unavailable' | 'error';
  configured: boolean;
  canUseCustom: boolean;
  error?: string;
}

export interface AISettingsState {
  // Custom API Key
  customAPIKey: string | null;
  customKeySettings: APIKeySettings | null;
  
  // Preferences
  preferredProvider: 'backend' | 'custom' | 'local';
  useLocalModels: boolean;
  fallbackStrategy: 'next_available' | 'manual_select';
  
  // Device capabilities
  deviceCapabilities: DeviceCapabilities | null;
  
  // Provider status
  providerStatuses: ProviderStatus[];
  
  // UI State
  showApiKeyModal: boolean;
  showProviderSelector: boolean;
  testingKey: boolean;
  keyTestResult: { success: boolean; message: string } | null;
  loadingCapabilities: boolean;
  
  // Actions
  setCustomAPIKey: (key: string) => void;
  removeCustomAPIKey: () => void;
  setPreferredProvider: (provider: 'backend' | 'custom' | 'local') => void;
  setUseLocalModels: (enabled: boolean) => void;
  setFallbackStrategy: (strategy: 'next_available' | 'manual_select') => void;
  setDeviceCapabilities: (caps: DeviceCapabilities) => void;
  setProviderStatuses: (statuses: ProviderStatus[]) => void;
  setShowApiKeyModal: (show: boolean) => void;
  setShowProviderSelector: (show: boolean) => void;
  setTestingKey: (testing: boolean) => void;
  setKeyTestResult: (result: { success: boolean; message: string } | null) => void;
  setLoadingCapabilities: (loading: boolean) => void;
}

// Helper to initialize custom API key and settings on mobile from localStorage
const getInitialAPIKey = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('GROQ_API_KEY') ||
    localStorage.getItem('CEREBRAS_API_KEY') ||
    localStorage.getItem('OPENROUTER_API_KEY') ||
    localStorage.getItem('CUSTOM_API_KEY') ||
    null
  );
};

const getInitialKeySettings = (key: string | null): APIKeySettings | null => {
  if (!key) return null;
  const groq = localStorage.getItem('GROQ_API_KEY');
  const cerebras = localStorage.getItem('CEREBRAS_API_KEY');
  const openrouter = localStorage.getItem('OPENROUTER_API_KEY');

  let provider = 'custom';
  let label = 'Custom Key';
  if (key === groq) { provider = 'groq'; label = 'Groq Key'; }
  else if (key === cerebras) { provider = 'cerebras'; label = 'Cerebras Key'; }
  else if (key === openrouter) { provider = 'openrouter'; label = 'OpenRouter Key'; }

  const maskedKey = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '••••••••';
  return {
    provider,
    label,
    maskedKey,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  };
};

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      customAPIKey: getInitialAPIKey(),
      customKeySettings: getInitialKeySettings(getInitialAPIKey()),
      preferredProvider: 'backend',
      useLocalModels: false,
      fallbackStrategy: 'next_available',
      deviceCapabilities: null,
      providerStatuses: [],
      showApiKeyModal: false,
      showProviderSelector: false,
      testingKey: false,
      keyTestResult: null,
      loadingCapabilities: false,

      setCustomAPIKey: (key: string) => {
        const groq = localStorage.getItem('GROQ_API_KEY');
        const cerebras = localStorage.getItem('CEREBRAS_API_KEY');
        const openrouter = localStorage.getItem('OPENROUTER_API_KEY');

        let provider = 'custom';
        let label = 'Custom Key';
        if (key === groq) { provider = 'groq'; label = 'Groq Key'; }
        else if (key === cerebras) { provider = 'cerebras'; label = 'Cerebras Key'; }
        else if (key === openrouter) { provider = 'openrouter'; label = 'OpenRouter Key'; }

        const maskedKey = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '••••••••';

        set({
          customAPIKey: key,
          customKeySettings: {
            provider,
            label,
            maskedKey,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
          }
        });
      },
      removeCustomAPIKey: () => set({ customAPIKey: null, customKeySettings: null }),
      setPreferredProvider: (provider: 'backend' | 'custom' | 'local') =>
        set({ preferredProvider: provider }),
      setUseLocalModels: (enabled: boolean) => set({ useLocalModels: enabled }),
      setFallbackStrategy: (strategy: 'next_available' | 'manual_select') =>
        set({ fallbackStrategy: strategy }),
      setDeviceCapabilities: (caps: DeviceCapabilities) =>
        set({ deviceCapabilities: caps }),
      setProviderStatuses: (statuses: ProviderStatus[]) =>
        set({ providerStatuses: statuses }),
      setShowApiKeyModal: (show: boolean) => set({ showApiKeyModal: show }),
      setShowProviderSelector: (show: boolean) => set({ showProviderSelector: show }),
      setTestingKey: (testing: boolean) => set({ testingKey: testing }),
      setKeyTestResult: (result: { success: boolean; message: string } | null) =>
        set({ keyTestResult: result }),
      setLoadingCapabilities: (loading: boolean) => set({ loadingCapabilities: loading }),
    }),
    {
      name: 'ai-settings-storage', // localStorage key
      partialize: (state) => ({
        preferredProvider: state.preferredProvider,
        useLocalModels: state.useLocalModels,
        fallbackStrategy: state.fallbackStrategy,
        customKeySettings: state.customKeySettings, // Safely persist masked key details
      }),
    }
  )
);
