/**
 * ApiKeyInput.tsx - Secure input and management for custom API keys
 * Supports Groq, Cerebras, OpenRouter, and other providers
 */

import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, Check, AlertCircle } from 'lucide-react';
import { useAISettingsStore } from '../lib/settingsStore';
import { aiSettingsApi } from '../lib/aiSettingsApi';

interface ApiKeyInputProps {
  provider?: 'groq' | 'cerebras' | 'openrouter' | 'custom';
  onSave?: () => void;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ provider = 'custom', onSave }) => {
  const {
    customAPIKey,
    customKeySettings,
    setCustomAPIKey,
    removeCustomAPIKey,
    testingKey,
    setTestingKey,
    keyTestResult,
    setKeyTestResult,
  } = useAISettingsStore();

  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(provider);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    setSaving(true);
    const result = await aiSettingsApi.saveAPIKey(selectedProvider, apiKey, label);

    if (result.success) {
      setCustomAPIKey(apiKey);
      setApiKey('');
      setLabel('');
      setKeyTestResult(null);
      onSave?.();
    } else {
      alert(`Failed to save: ${result.error}`);
    }

    setSaving(false);
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key first');
      return;
    }

    setTestingKey(true);
    const result = await aiSettingsApi.testAPIKey(selectedProvider, apiKey);
    setKeyTestResult(result.data);
    setTestingKey(false);
  };

  const handleDeleteKey = async () => {
    if (confirm('Are you sure you want to delete your API key?')) {
      const result = await aiSettingsApi.deleteAPIKey();
      if (result.success) {
        removeCustomAPIKey();
        setApiKey('');
        setLabel('');
        setKeyTestResult(null);
      } else {
        alert(`Failed to delete: ${result.error}`);
      }
    }
  };

  const providers = [
    { id: 'groq', name: 'Groq', color: 'text-orange-600', format: 'Starts with gsk-' },
    { id: 'cerebras', name: 'Cerebras', color: 'text-blue-600', format: 'Starts with sk-' },
    { id: 'openrouter', name: 'OpenRouter', color: 'text-purple-600', format: 'Custom format' },
    { id: 'custom', name: 'Other Provider', color: 'text-gray-600', format: 'Any format' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Custom API Key</h3>

      {/* Saved Key Display */}
      {customKeySettings && !apiKey ? (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-green-900 dark:text-green-100">
                ✓ API Key Saved
              </p>
              <p className="text-sm text-green-700 dark:text-green-200 mt-1">
                {customKeySettings.label || customKeySettings.provider}
              </p>
              <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                {customKeySettings.maskedKey}
              </p>
              {customKeySettings.lastUsed && (
                <p className="text-xs text-green-600 dark:text-green-300">
                  Last used: {new Date(customKeySettings.lastUsed).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={() => setApiKey('update')}
              className="text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
            >
              Update
            </button>
          </div>
          <button
            onClick={handleDeleteKey}
            className="mt-3 flex items-center space-x-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
          >
            <Trash2 size={16} />
            <span>Delete Key</span>
          </button>
        </div>
      ) : (
        <>
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id as any)}
                  className={`p-3 border-2 rounded-lg transition text-left ${
                    selectedProvider === p.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <p className={`font-medium ${p.color}`}>{p.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{p.format}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Key Input */}
          <div>
            <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key here"
                className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              🔒 Your API key is encrypted and never shared
            </p>
          </div>

          {/* Label (Optional) */}
          <div>
            <label htmlFor="key-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Label (Optional)
            </label>
            <input
              id="key-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., My Work Key, Project A"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Test Result */}
          {keyTestResult && (
            <div
              className={`p-4 border rounded-lg flex items-start space-x-3 ${
                keyTestResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/40'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40'
              }`}
            >
              {keyTestResult.success ? (
                <>
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100">Key Valid</p>
                    <p className="text-sm text-green-700 dark:text-green-200">{keyTestResult.message}</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-100">Test Failed</p>
                    <p className="text-sm text-red-700 dark:text-red-200">{keyTestResult.message}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleTestKey}
              disabled={!apiKey.trim() || testingKey}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {testingKey ? 'Testing...' : 'Test Key'}
            </button>
            <button
              onClick={handleSaveKey}
              disabled={!apiKey.trim() || saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Saving...' : 'Save Key'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
