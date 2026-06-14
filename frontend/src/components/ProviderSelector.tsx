/**
 * ProviderSelector.tsx - Radio button selector for AI provider preference
 * Options: Backend Keys, Custom Key, Local Model
 */

import React, { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { useAISettingsStore } from '../lib/settingsStore';
import { aiSettingsApi } from '../lib/aiSettingsApi';

export const ProviderSelector: React.FC = () => {
  const {
    preferredProvider,
    setPreferredProvider,
    useLocalModels,
    setUseLocalModels,
    deviceCapabilities,
    setDeviceCapabilities,
    loadingCapabilities,
    setLoadingCapabilities,
  } = useAISettingsStore();

  useEffect(() => {
    // Load device capabilities on mount
    const load = async () => {
      setLoadingCapabilities(true);
      const caps = await aiSettingsApi.getDeviceCapabilities();
      if (caps) {
        setDeviceCapabilities(caps);
      }
      setLoadingCapabilities(false);
    };

    if (!deviceCapabilities) {
      load();
    }
  }, []);

  const handleProviderChange = (provider: 'backend' | 'custom' | 'local') => {
    setPreferredProvider(provider);
  };

  const canUseLocal = deviceCapabilities?.supportsLocalModels && useLocalModels;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Question Generation Provider
      </h3>

      {/* Backend Keys Option */}
      <label className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition">
        <input
          type="radio"
          name="provider"
          value="backend"
          checked={preferredProvider === 'backend'}
          onChange={() => handleProviderChange('backend')}
          className="mt-1 w-4 h-4"
        />
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-white">Use Backend Keys</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use Groq, Cerebras, NVIDIA, and OpenRouter keys configured by the system
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            ✓ Reliable ✓ No setup • Requires internet
          </p>
        </div>
      </label>

      {/* Custom Key Option */}
      <label className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition">
        <input
          type="radio"
          name="provider"
          value="custom"
          checked={preferredProvider === 'custom'}
          onChange={() => handleProviderChange('custom')}
          className="mt-1 w-4 h-4"
        />
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-white">Use Custom API Key</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use your own Groq, Cerebras, or OpenRouter key with custom rate limits
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            ✓ Custom limits ✓ Your API credits • Requires internet
          </p>
        </div>
      </label>



      {/* Fallback Strategy */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-lg">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          💡 Pro Tip: If your selected provider fails, the system automatically tries the next available provider
        </p>
      </div>
    </div>
  );
};
