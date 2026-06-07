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

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      customAPIKey: null,
      customKeySettings: null,
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

      setCustomAPIKey: (key: string) => set({ customAPIKey: key }),
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
        // Don't persist actual API key to localStorage
      }),
    }
  )
);
