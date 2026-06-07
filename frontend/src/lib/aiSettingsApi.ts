/**
 * API Methods for AI Settings
 * Extends lib/api.ts with AI settings endpoints
 */

import axios from 'axios';
import api from './api';
import type { DeviceCapabilities, APIKeySettings, ProviderStatus } from './settingsStore';

export const aiSettingsApi = {
  /**
   * Save user's custom API key
   */
  async saveAPIKey(provider: string, apiKey: string, label?: string) {
    try {
      const response = await api.post('/ai-settings/api-key', {
        provider,
        api_key: apiKey,
        label,
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to save API key',
      };
    }
  },

  /**
   * Get saved API key info (masked)
   */
  async getAPIKey() {
    try {
      const response = await api.get('/ai-settings/api-key');
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.response?.data?.detail || 'Failed to fetch API key',
      };
    }
  },

  /**
   * Delete saved API key
   */
  async deleteAPIKey() {
    try {
      const response = await api.delete('/ai-settings/api-key');
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to delete API key',
      };
    }
  },

  /**
   * Test if an API key is valid
   */
  async testAPIKey(provider: string, apiKey: string) {
    try {
      const response = await api.post('/ai-settings/test-key', {
        provider,
        api_key: apiKey,
      });
      return { success: response.data.success, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        data: {
          success: false,
          message: error.response?.data?.detail || 'Connection failed',
        },
      };
    }
  },

  /**
   * Get provider status
   */
  async getProviderStatus(): Promise<ProviderStatus[]> {
    try {
      const response = await api.get('/ai-settings/status');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch provider status:', error);
      return [];
    }
  },

  /**
   * Get device capabilities for local models
   */
  async getDeviceCapabilities(): Promise<DeviceCapabilities | null> {
    try {
      const response = await api.get('/ai-settings/device-capabilities');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch device capabilities:', error);
      return null;
    }
  },

  /**
   * Get generation preferences
   */
  async getPreferences() {
    try {
      const response = await api.get('/ai-settings/preferences');
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to fetch preferences',
      };
    }
  },

  /**
   * Save generation preferences
   */
  async savePreferences(
    preferredProvider: 'backend' | 'custom' | 'local',
    useLocalModels: boolean,
    fallbackStrategy: 'next_available' | 'manual_select'
  ) {
    try {
      const response = await api.post('/ai-settings/preferences', {
        preferred_provider: preferredProvider,
        use_local_models: useLocalModels,
        fallback_strategy: fallbackStrategy,
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to save preferences',
      };
    }
  },

  /**
   * Download a local model (e.g., Gemma 2B)
   */
  async downloadLocalModel(modelName: string) {
    try {
      const response = await api.post('/ai-settings/local-models/download', {
        model_name: modelName,
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to download model',
      };
    }
  },
};
