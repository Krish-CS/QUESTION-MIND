/**
 * Settings.tsx - AI Settings Page
 * Manage API keys, provider preferences, device capabilities
 */

import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Settings2, Cpu } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-pink-100 dark:border-pink-900/50">
        <div className="w-full max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-pink-50 dark:hover:bg-pink-950/30 rounded-xl transition-colors text-pink-600 dark:text-pink-400 flex-shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-orange-500 bg-clip-text text-transparent leading-tight">
                AI Settings
              </h1>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5 font-medium truncate">
                Manage AI provider preferences and API keys
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-2xl mx-auto px-4 py-5">

        {/* ── Tabs — full-width equal split ─────────────────────────────── */}
        <div className="flex w-full border-b border-pink-100 dark:border-pink-900/40 mb-6">
          {(['general', 'advanced'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const Icon = tab === 'general' ? Settings2 : Cpu;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold
                            transition-colors relative capitalize
                            ${isActive
                              ? 'text-pink-600 dark:text-pink-400'
                              : 'text-slate-500 dark:text-slate-400 hover:text-pink-500 dark:hover:text-pink-400'
                            }`}
              >
                <Icon size={16} />
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {/* Active underline indicator */}
                {isActive && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── General Tab ───────────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <div className="space-y-5">

            {/* Provider Selector */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-pink-100 dark:border-pink-900/30 p-5 shadow-sm">
              <ProviderSelector />
            </div>

            {/* Custom API Key */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-pink-100 dark:border-pink-900/30 p-5 shadow-sm">
              <ApiKeyInput />
            </div>

            {/* Provider Status */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-pink-100 dark:border-pink-900/30 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Provider Status
                </h3>
                <button
                  onClick={handleRefresh}
                  disabled={loadingStatuses}
                  className="p-2 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30 rounded-xl transition-colors disabled:opacity-50"
                  aria-label="Refresh provider status"
                >
                  <RefreshCw size={18} className={loadingStatuses ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="space-y-2.5">
                {loadingStatuses && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
                    Checking providers…
                  </p>
                )}
                {providerStatuses.length === 0 && !loadingStatuses && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
                    No providers configured. Add a custom API key above to get started.
                  </p>
                )}
                {providerStatuses.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-pink-100/40 dark:border-pink-900/20"
                  >
                    <div className="min-w-0 mr-3">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {provider.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {provider.error ? provider.error : 'Ready'}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        provider.status === 'available'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900'
                          : provider.status === 'limited'
                          ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
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

        {/* ── Advanced Tab ──────────────────────────────────────────────── */}
        {activeTab === 'advanced' && (
          <div className="space-y-5">

            {/* Local Models */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-pink-100 dark:border-pink-900/30 p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                Local Models
              </h3>

              {deviceCapabilities?.supportsLocalModels ? (
                <div className="space-y-3">
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                    <div className="min-w-0 mr-3">
                      <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">
                        ✓ Device Supports Local Models
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Available Memory: {deviceCapabilities.availableMemoryMB}MB
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={useLocalModels}
                        onChange={(e) => setUseLocalModels(e.target.checked)}
                        className="rounded text-pink-600 focus:ring-pink-500 w-4 h-4"
                      />
                      <span className="text-sm font-semibold text-pink-600 dark:text-pink-400">
                        Enable
                      </span>
                    </label>
                  </div>

                  {useLocalModels && (
                    <div className="space-y-2 mt-1 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-pink-100/50 dark:border-pink-950/40">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                        Download Models:
                      </p>
                      {deviceCapabilities.availableModels.map((model) => (
                        <div
                          key={model.name}
                          className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-pink-100/40 dark:border-pink-900/20"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                              {model.label}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {model.description} · {model.memoryMB}MB
                            </p>
                          </div>
                          <button
                            onClick={() => handleDownloadLocalModel(model.name)}
                            className="flex-shrink-0 px-3 py-1.5 text-xs bg-gradient-to-r from-pink-500 to-purple-600 active:scale-95 transition-transform text-white rounded-lg font-semibold shadow shadow-pink-500/20"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40">
                  <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                    ⚠ Device Does Not Support Local Models
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5 leading-relaxed">
                    Your device doesn't have enough memory or storage to run local models.
                    You can still use backend or custom API keys.
                  </p>
                </div>
              )}
            </div>

            {/* Advanced Options */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-pink-100 dark:border-pink-900/30 p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                Advanced Options
              </h3>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-pink-100/30 dark:border-pink-900/20 cursor-pointer">
                  <input
                    type="checkbox"
                    id="retry-other"
                    className="mt-0.5 rounded text-pink-600 focus:ring-pink-500 w-4 h-4 flex-shrink-0"
                    defaultChecked
                  />
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                      Automatically Retry Other Providers
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      If your preferred provider fails, automatically try other available providers
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-pink-100/30 dark:border-pink-900/20 cursor-pointer">
                  <input
                    type="checkbox"
                    id="verbose-errors"
                    className="mt-0.5 rounded text-pink-600 focus:ring-pink-500 w-4 h-4 flex-shrink-0"
                  />
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                      Show Detailed Error Messages
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Display provider errors and debugging information (useful for troubleshooting)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* API Rate Limits Info */}
            <div className="bg-gradient-to-br from-pink-500/5 to-purple-500/5 dark:from-pink-950/10 dark:to-purple-950/10 p-5 rounded-2xl border-2 border-pink-200/60 dark:border-pink-900/40">
              <h3 className="text-base font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-3">
                API Rate Limits
              </h3>
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                <p>
                  <strong className="text-pink-600 dark:text-pink-400">Backend Keys: </strong>
                  Shared across all users, limited to 100 req/min
                </p>
                <p>
                  <strong className="text-pink-600 dark:text-pink-400">Custom Key: </strong>
                  Your own limits based on your API plan
                </p>
                <p>
                  <strong className="text-pink-600 dark:text-pink-400">Local Model: </strong>
                  No rate limits, but slower responses
                </p>
              </div>
            </div>

          </div>
        )}

        {/* Bottom spacer for mobile nav bar */}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default Settings;
