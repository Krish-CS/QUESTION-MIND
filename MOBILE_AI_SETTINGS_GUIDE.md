# Mobile App - React Native AI Settings Implementation

## 📱 Architecture Overview

The AI Settings feature needs to be consistent across:
- **Web Frontend** (React + TypeScript) ✅ Created
- **Backend** (Python FastAPI) ✅ Created  
- **Mobile App** (React Native + Capacitor)

Since both web and mobile use React, they share:
- `lib/settingsStore.ts` (Zustand - works in React Native)
- `lib/aiSettingsApi.ts` (Axios - works in React Native)

Only the UI components need to be ported to React Native using Tailwind CSS for native (via NativeWind).

## 🔄 Shared Code (No Porting Needed)

```typescript
// These files work in BOTH web and mobile
mobile-app/src/lib/settingsStore.ts     → use from shared
mobile-app/src/lib/aiSettingsApi.ts     → use from shared
```

Or import from shared folder:

```typescript
// mobile-app/src/pages/Settings.tsx
import { useAISettingsStore } from '../../shared/types'; // Could be centralized
```

## 🎨 React Native Component Equivalents

### 1. ProviderSelector.tsx (React Native)

```typescript
/**
 * mobile-app/src/components/ProviderSelector.tsx
 * React Native version with NativeWind styling
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { RadioButton } from 'react-native-paper';
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
    const load = async () => {
      if (!deviceCapabilities) {
        setLoadingCapabilities(true);
        const caps = await aiSettingsApi.getDeviceCapabilities();
        if (caps) {
          setDeviceCapabilities(caps);
        }
        setLoadingCapabilities(false);
      }
    };
    load();
  }, []);

  const canUseLocal = deviceCapabilities?.supportsLocalModels && useLocalModels;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900">
      <View className="p-4">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Question Generation Provider
        </Text>

        {/* Backend Keys */}
        <TouchableOpacity
          onPress={() => setPreferredProvider('backend')}
          className="mb-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <View className="flex-row items-center">
            <RadioButton
              value="backend"
              status={preferredProvider === 'backend' ? 'checked' : 'unchecked'}
              onPress={() => setPreferredProvider('backend')}
            />
            <View className="flex-1 ml-3">
              <Text className="font-medium text-gray-900 dark:text-white">
                Use Backend Keys
              </Text>
              <Text className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Use Groq, Cerebras, NVIDIA, and OpenRouter
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                ✓ Reliable ✓ No setup • Requires internet
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Custom Key */}
        <TouchableOpacity
          onPress={() => setPreferredProvider('custom')}
          className="mb-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <View className="flex-row items-center">
            <RadioButton
              value="custom"
              status={preferredProvider === 'custom' ? 'checked' : 'unchecked'}
              onPress={() => setPreferredProvider('custom')}
            />
            <View className="flex-1 ml-3">
              <Text className="font-medium text-gray-900 dark:text-white">
                Use Custom API Key
              </Text>
              <Text className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Use your own Groq, Cerebras, or OpenRouter key
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                ✓ Custom limits ✓ Your API credits • Requires internet
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Local Model */}
        <TouchableOpacity
          disabled={!deviceCapabilities?.supportsLocalModels}
          onPress={() => setPreferredProvider('local')}
          className={`p-4 border rounded-lg ${
            deviceCapabilities?.supportsLocalModels
              ? 'border-gray-200 dark:border-gray-700'
              : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800'
          }`}
        >
          <View className="flex-row items-center">
            <RadioButton
              value="local"
              disabled={!deviceCapabilities?.supportsLocalModels}
              status={preferredProvider === 'local' ? 'checked' : 'unchecked'}
              onPress={() => setPreferredProvider('local')}
            />
            <View className="flex-1 ml-3">
              <Text className="font-medium text-gray-900 dark:text-white">
                Use Local Model
              </Text>
              <Text className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {deviceCapabilities?.supportsLocalModels
                  ? 'Run Gemma 2B offline on your device'
                  : 'Not supported on this device'}
              </Text>
              {deviceCapabilities?.supportsLocalModels && (
                <Text className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  ✓ Offline ✓ No API needed • Slower ({deviceCapabilities.availableMemoryMB}MB available)
                </Text>
              )}
            </View>
          </View>

          {/* Model list */}
          {deviceCapabilities?.supportsLocalModels && (
            <View className="mt-3 p-2 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
              <Text className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Available Models:
              </Text>
              {deviceCapabilities.availableModels.map((model) => (
                <View key={model.name} className="flex-row justify-between mb-1">
                  <Text className="text-xs text-gray-600 dark:text-gray-400">
                    {model.label}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-500">
                    {model.memoryMB}MB • {model.storageMB}MB
                  </Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>

        {/* Pro Tip */}
        <View className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-lg">
          <Text className="text-sm font-medium text-blue-900 dark:text-blue-100">
            💡 Pro Tip: If your provider fails, the system automatically tries the next available provider
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
```

### 2. ApiKeyInput.tsx (React Native)

```typescript
/**
 * mobile-app/src/components/ApiKeyInput.tsx
 * React Native version with secure text input
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Eye, EyeOff, Trash2, Check, AlertCircle } from 'lucide-react-native';
import { useAISettingsStore } from '../lib/settingsStore';
import { aiSettingsApi } from '../lib/aiSettingsApi';

export const ApiKeyInput: React.FC = () => {
  const {
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
  const [selectedProvider, setSelectedProvider] = useState('groq');

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }

    setSaving(true);
    const result = await aiSettingsApi.saveAPIKey(selectedProvider, apiKey, label);

    if (result.success) {
      setCustomAPIKey(apiKey);
      setApiKey('');
      setLabel('');
      Alert.alert('Success', 'API key saved securely');
    } else {
      Alert.alert('Error', `Failed to save: ${result.error}`);
    }

    setSaving(false);
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key first');
      return;
    }

    setTestingKey(true);
    const result = await aiSettingsApi.testAPIKey(selectedProvider, apiKey);
    setKeyTestResult(result.data);
    setTestingKey(false);
  };

  const handleDeleteKey = async () => {
    Alert.alert(
      'Delete API Key',
      'Are you sure you want to delete your saved API key?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Delete',
          onPress: async () => {
            const result = await aiSettingsApi.deleteAPIKey();
            if (result.success) {
              removeCustomAPIKey();
              Alert.alert('Success', 'API key deleted');
            } else {
              Alert.alert('Error', `Failed: ${result.error}`);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900 p-4">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Custom API Key
      </Text>

      {customKeySettings && !apiKey ? (
        <View className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 rounded-lg mb-4">
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="font-medium text-green-900 dark:text-green-100">
                ✓ API Key Saved
              </Text>
              <Text className="text-sm text-green-700 dark:text-green-200 mt-2">
                {customKeySettings.label || customKeySettings.provider}
              </Text>
              <Text className="text-xs text-green-600 dark:text-green-300 mt-1">
                {customKeySettings.maskedKey}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleDeleteKey}
            className="mt-3 flex-row items-center space-x-2"
          >
            <Trash2 size={16} className="text-red-600 dark:text-red-400" />
            <Text className="text-sm font-medium text-red-600 dark:text-red-400">
              Delete Key
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Provider Selection */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Provider
            </Text>
            <View className="flex-row space-x-2">
              {['groq', 'cerebras', 'openrouter'].map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setSelectedProvider(p)}
                  className={`flex-1 p-3 rounded-lg border-2 ${
                    selectedProvider === p
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <Text className="text-xs font-medium text-center capitalize">
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Key Input */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key
            </Text>
            <View className="relative flex-row items-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
              <TextInput
                secureTextEntry={!showKey}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="Paste your API key"
                className="flex-1 px-4 py-2 text-gray-900 dark:text-white"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowKey(!showKey)}
                className="px-3"
              >
                {showKey ? (
                  <EyeOff size={20} className="text-gray-500 dark:text-gray-400" />
                ) : (
                  <Eye size={20} className="text-gray-500 dark:text-gray-400" />
                )}
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              🔒 Your API key is encrypted and never shared
            </Text>
          </View>

          {/* Label */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Label (Optional)
            </Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="e.g., My Work Key"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholderTextColor="#999"
            />
          </View>

          {/* Test Result */}
          {keyTestResult && (
            <View
              className={`p-4 rounded-lg mb-4 flex-row items-start space-x-3 ${
                keyTestResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40'
              }`}
            >
              {keyTestResult.success ? (
                <>
                  <Check size={20} className="text-green-600 dark:text-green-400 mt-0.5" />
                  <View>
                    <Text className="font-medium text-green-900 dark:text-green-100">
                      Key Valid
                    </Text>
                    <Text className="text-sm text-green-700 dark:text-green-200 mt-1">
                      {keyTestResult.message}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <AlertCircle size={20} className="text-red-600 dark:text-red-400 mt-0.5" />
                  <View>
                    <Text className="font-medium text-red-900 dark:text-red-100">
                      Test Failed
                    </Text>
                    <Text className="text-sm text-red-700 dark:text-red-200 mt-1">
                      {keyTestResult.message}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Actions */}
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={handleTestKey}
              disabled={!apiKey.trim() || testingKey}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              {testingKey ? (
                <ActivityIndicator color="#666" />
              ) : (
                <Text className="text-center font-medium text-gray-700 dark:text-gray-300">
                  Test Key
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSaveKey}
              disabled={!apiKey.trim() || saving}
              className="flex-1 px-4 py-3 bg-blue-600 rounded-lg"
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-center font-medium text-white">
                  Save Key
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
};
```

### 3. Settings.tsx (React Native)

```typescript
/**
 * mobile-app/src/pages/Settings.tsx
 * Main settings page for mobile
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { ChevronLeft, RefreshCw } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { ProviderSelector } from '../components/ProviderSelector';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { useAISettingsStore } from '../lib/settingsStore';
import { aiSettingsApi } from '../lib/aiSettingsApi';

export const Settings: React.FC = () => {
  const navigation = useNavigation();
  const { deviceCapabilities, useLocalModels, setUseLocalModels } = useAISettingsStore();

  const [providerStatuses, setProviderStatuses] = useState([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');

  useEffect(() => {
    const loadStatuses = async () => {
      setLoadingStatuses(true);
      const statuses = await aiSettingsApi.getProviderStatus();
      setProviderStatuses(statuses);
      setLoadingStatuses(false);
    };
    loadStatuses();
  }, []);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <View className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 pt-4 pb-3 px-4">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="flex-row items-center space-x-2 mb-2"
        >
          <ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" />
          <View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              AI Settings
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              Manage your AI provider preferences
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View className="flex-row border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <TouchableOpacity
          onPress={() => setActiveTab('general')}
          className={`flex-1 py-3 border-b-2 ${
            activeTab === 'general'
              ? 'border-blue-500'
              : 'border-transparent'
          }`}
        >
          <Text
            className={`text-center font-medium ${
              activeTab === 'general'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            General
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('advanced')}
          className={`flex-1 py-3 border-b-2 ${
            activeTab === 'advanced'
              ? 'border-blue-500'
              : 'border-transparent'
          }`}
        >
          <Text
            className={`text-center font-medium ${
              activeTab === 'advanced'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Advanced
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 p-4">
        {activeTab === 'general' && (
          <View className="space-y-6">
            {/* Provider Selector */}
            <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <ProviderSelector />
            </View>

            {/* API Key Input */}
            <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <ApiKeyInput />
            </View>

            {/* Provider Status */}
            <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  Provider Status
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setLoadingStatuses(true);
                    aiSettingsApi.getProviderStatus().then((statuses) => {
                      setProviderStatuses(statuses);
                      setLoadingStatuses(false);
                    });
                  }}
                >
                  <RefreshCw
                    size={20}
                    className={`text-gray-600 dark:text-gray-400 ${
                      loadingStatuses ? 'animate-spin' : ''
                    }`}
                  />
                </TouchableOpacity>
              </View>

              {providerStatuses.map((provider) => (
                <View
                  key={provider.name}
                  className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 mb-2 flex-row items-center justify-between"
                >
                  <View>
                    <Text className="font-medium text-gray-900 dark:text-white">
                      {provider.name}
                    </Text>
                    <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {provider.error || 'Ready'}
                    </Text>
                  </View>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      provider.status === 'available'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium capitalize ${
                        provider.status === 'available'
                          ? 'text-green-800 dark:text-green-300'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {provider.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'advanced' && (
          <View className="space-y-6">
            {/* Local Models */}
            <View className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Local Models
              </Text>

              {deviceCapabilities?.supportsLocalModels ? (
                <View className="space-y-3">
                  <View className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900/40 flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="font-medium text-blue-900 dark:text-blue-100">
                        ✓ Device Supports Local Models
                      </Text>
                      <Text className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                        Available: {deviceCapabilities.availableMemoryMB}MB
                      </Text>
                    </View>
                    <Switch
                      value={useLocalModels}
                      onValueChange={setUseLocalModels}
                    />
                  </View>
                </View>
              ) : (
                <View className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-900/40">
                  <Text className="font-medium text-yellow-900 dark:text-yellow-100">
                    ⚠ Device Limitations
                  </Text>
                  <Text className="text-sm text-yellow-700 dark:text-yellow-200 mt-2">
                    Your device doesn't have enough resources for local models.
                    Use backend or custom API keys.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default Settings;
```

## 🔗 Integration Steps for Mobile

### Step 1: Add Settings Route

```typescript
// mobile-app/src/App.tsx or your navigation config
import { Settings } from './pages/Settings';

// In your route navigator:
<Stack.Screen
  name="Settings"
  component={Settings}
  options={{ headerShown: false }}
/>
```

### Step 2: Add to Sidebar/Tab Navigation

```typescript
// mobile-app/src/components/Navigation.tsx or similar
import { SettingsIcon } from 'react-native-heroicons/solid';

const navigation = [
  { name: 'Home', screen: 'Home', icon: HomeIcon },
  { name: 'Questions', screen: 'Questions', icon: DocumentIcon },
  { name: 'Settings', screen: 'Settings', icon: SettingsIcon },
];
```

### Step 3: Secure Storage for API Keys

Install secure storage:

```bash
npm install react-native-secure-storage
# or
npm install @react-native-community/hooks
```

Update store to use secure storage:

```typescript
// mobile-app/src/lib/settingsStore.ts
import SecureStorage from 'react-native-secure-storage';

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({...}),
    {
      name: 'ai-settings-storage',
      storage: {
        async getItem(key) {
          return await SecureStorage.getItem(key);
        },
        async setItem(key, value) {
          await SecureStorage.setItem(key, value);
        },
        async removeItem(key) {
          await SecureStorage.removeItem(key);
        },
      },
    }
  )
);
```

### Step 4: Fingerprint/Face Recognition

```typescript
// mobile-app/src/utils/biometrics.ts
import * as LocalAuthentication from 'expo-local-authentication';

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    return await LocalAuthentication.authenticateAsync({
      disableDeviceFallback: false,
    });
  } catch (error) {
    return false;
  }
}
```

## 📱 Platform-Specific Considerations

### Android (Chaquopy Integration)

For Android, API key storage can also use the KeyStore:

```kotlin
// android/app/src/main/java/com/questionmind/utils/SecureKeystore.kt
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object SecureKeystore {
    fun saveAPIKey(key: String) {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        
        val prefs = EncryptedSharedPreferences.create(
            context,
            "api_keys",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        
        prefs.edit().putString("custom_api_key", key).apply()
    }
}
```

### iOS

Use Keychain for secure storage:

```swift
// ios/Runner/SecureKeychain.swift
import Security

class SecureKeychain {
    static func save(key: String, value: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: value.data(using: .utf8)!,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
}
```

## 🎯 Mobile Testing Checklist

- [ ] Provider selector works on small screens
- [ ] API key input is properly masked
- [ ] Biometric authentication works for accessing saved keys
- [ ] Secure storage encrypts sensitive data
- [ ] Network requests work with mobile VPNs
- [ ] Offline provider selection works
- [ ] Local model detection works on Android
- [ ] Memory/storage checks are accurate
- [ ] Settings persist after app restart
- [ ] All provider tests pass
- [ ] Error messages are readable on mobile
- [ ] Components work in light and dark mode

## 📋 Feature Parity Checklist

| Feature | Web | Mobile | Backend | Status |
|---------|-----|--------|---------|--------|
| Provider Selector | ✅ | 🔄 | - | Needs porting |
| API Key Input | ✅ | 🔄 | - | Needs porting |
| API Key Testing | ✅ | 🔄 | ✅ | In progress |
| Provider Status | ✅ | 🔄 | ✅ | Needs porting |
| Local Model Support | ✅ | 🔄 | ✅ | Needs porting |
| Device Capabilities | ✅ | 🔄 | ✅ | Needs porting |
| Secure Storage | - | 🔄 | ✅ | Needs porting |
| Biometric Auth | - | 🔄 | - | Mobile only |

---

## 🚀 Next: After Implementation

1. Test web frontend Settings page
2. Test backend API endpoints
3. Port components to React Native
4. Add secure storage to mobile
5. Test on Android/iOS devices
6. Add Chaquopy integration for local models on Android
7. Update question generation to use new settings
8. Add comprehensive error handling
