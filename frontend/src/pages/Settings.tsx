/**
 * Settings.tsx - AI Settings Page
 * Manage API keys, provider preferences, device capabilities
 */

import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProviderSelector } from '../components/ProviderSelector';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { useAISettingsStore } from '../lib/settingsStore';
import { aiSettingsApi } from '../lib/aiSettingsApi';
import type { ProviderStatus } from '../lib/settingsStore';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { deviceCapabilities, useLocalModels, setUseLocalModels } = useAISettingsStore();

  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');

  // Load provider status on mount
  useEffect(() => {
    const loadStatuses = async () => {
      setLoadingStatuses(true);
      const statuses = await aiSettingsApi.getProviderStatus();
      setProviderStatuses(statuses);
      setLoadingStatuses(false);
    };

    loadStatuses();
  }, []);

  const handleRefresh = async () => {
    setLoadingStatuses(true);
    const statuses = await aiSettingsApi.getProviderStatus();
    setProviderStatuses(statuses);
    setLoadingStatuses(false);
  };

  const handleDownloadLocalModel = async (modelName: string) => {
    const result = await aiSettingsApi.downloadLocalModel(modelName);
    if (result.success) {
      alert(`Downloading ${modelName}... Check back later for progress.`);
    } else {
      alert(`Failed to download: ${result.error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <ArrowLeft size={24} className="text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                AI Settings
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage your AI provider preferences and API keys
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === 'advanced'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Advanced
          </button>
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-8">
            {/* Provider Selector */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <ProviderSelector />
            </div>

            {/* Custom API Key */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <ApiKeyInput />
            </div>

            {/* Provider Status */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Provider Status
                </h3>
                <button
                  onClick={handleRefresh}
                  disabled={loadingStatuses}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
                >
                  <RefreshCw size={20} className={loadingStatuses ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="space-y-3">
                {providerStatuses.length === 0 && !loadingStatuses && (
                  <p className="text-gray-600 dark:text-gray-400">
                    No providers configured. Add a custom API key above to get started.
                  </p>
                )}

                {providerStatuses.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {provider.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {provider.error ? provider.error : 'Ready'}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        provider.status === 'available'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : provider.status === 'limited'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {provider.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="space-y-8">
            {/* Local Models */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Local Models
              </h3>

              {deviceCapabilities?.supportsLocalModels ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/40">
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        ✓ Device Supports Local Models
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                        Available Memory: {deviceCapabilities.availableMemoryMB}MB
                      </p>
                    </div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useLocalModels}
                        onChange={(e) => setUseLocalModels(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Enable
                      </span>
                    </label>
                  </div>

                  {useLocalModels && (
                    <div className="space-y-2 mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Download Models:
                      </p>
                      {deviceCapabilities.availableModels.map((model) => (
                        <div
                          key={model.name}
                          className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {model.label}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {model.description} • {model.memoryMB}MB
                            </p>
                          </div>
                          <button
                            onClick={() => handleDownloadLocalModel(model.name)}
                            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-900/40">
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">
                    ⚠ Device Does Not Support Local Models
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-200 mt-2">
                    Your device doesn't have enough memory or storage to run local models.
                    You can still use backend or custom API keys.
                  </p>
                </div>
              )}
            </div>

            {/* Advanced Options */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Advanced Options
              </h3>

              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <input
                    type="checkbox"
                    id="retry-other"
                    className="mt-1"
                    defaultChecked
                  />
                  <div className="flex-1">
                    <label htmlFor="retry-other" className="font-medium text-gray-900 dark:text-white">
                      Automatically Retry Other Providers
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      If your preferred provider fails, automatically try other available providers
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <input
                    type="checkbox"
                    id="verbose-errors"
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="verbose-errors" className="font-medium text-gray-900 dark:text-white">
                      Show Detailed Error Messages
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Display provider errors and debugging information (useful for troubleshooting)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* API Rate Limits Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-900/40">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                API Rate Limits
              </h3>
              <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <p>
                  <strong>Backend Keys:</strong> Shared across all users, limited to 100 req/min
                </p>
                <p>
                  <strong>Custom Key:</strong> Your own limits based on your API plan
                </p>
                <p>
                  <strong>Local Model:</strong> No rate limits, but slower responses
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
