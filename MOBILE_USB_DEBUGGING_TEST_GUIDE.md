# Mobile App Installation & USB Debugging Testing Guide

## 📱 Mobile App Architecture

**App Details:**
- Package ID: `com.krishacademia.questionmind`
- App Name: Question Mind
- Framework: React + TypeScript + Capacitor 6.0
- Target: Android (primary), iOS (secondary)
- Build System: Vite + Gradle

---

## 🔧 Prerequisites

Before starting, install on your development machine:

### Windows/macOS/Linux

1. **Node.js 18+**
   ```bash
   node --version  # Should be v18.0.0 or higher
   npm --version
   ```

2. **Java Development Kit (JDK) 17+**
   ```bash
   java -version
   javac -version
   ```

3. **Android Studio** (includes SDK and emulator)
   - Download: https://developer.android.com/studio
   - Install with: Android SDK 31+, Build Tools 34+

4. **Capacitor CLI**
   ```bash
   npm install -g @capacitor/cli
   ```

5. **Gradle** (usually included with Android Studio)
   ```bash
   gradle --version
   ```

### Android Device Setup

1. **Enable Developer Mode:**
   - Settings → About Phone → tap "Build Number" 7 times
   - Settings → Developer options → enable "USB Debugging"
   - Settings → Developer options → enable "Install via USB"

2. **Install ADB (Android Debug Bridge):**
   ```bash
   # Windows (via Android Studio)
   "C:\Users\YOUR_USER\AppData\Local\Android\Sdk\platform-tools\adb.exe" version
   
   # macOS
   brew install android-platform-tools
   adb version
   
   # Linux
   sudo apt-get install android-tools-adb
   adb version
   ```

---

## 🚀 Quick Start (USB Install & Test)

### Step 1: Connect Android Device via USB

```bash
# Connect phone via USB cable

# Verify connection
adb devices
# Should output:
# List of attached devices
# YOUR_DEVICE_SERIAL    device
```

**Troubleshooting:**
- If not showing: Try different USB port or cable
- If "unauthorized": Tap "Allow" on phone when prompted
- If "offline": Unplug and reconnect

### Step 2: Build the Mobile App

```bash
cd mobile-app

# Install dependencies
npm install

# Build for production
npm run build

# This creates dist/ folder with optimized code
```

### Step 3: Sync with Capacitor

```bash
# Update Android native project
npx cap sync android
# This copies dist/ to Android and updates dependencies
```

### Step 4: Install on Connected Device

```bash
# Option A: Build and run in one command
npm run mobile:run-android

# Option B: Build manually then run
npm run build
npx cap run android
# Select your device from the list
```

**Expected Output:**
```
Copying web app from dist to android/app/src/main/assets/public
Updating Android native project...
✓ Android sync complete

 ► Building Android app...

Choose a target device:
 1) EMULATOR (sdk_gphone64)
 2) YOUR_DEVICE (hardware device)

Select a device: 2
Installing APK on YOUR_DEVICE...
✓ Successfully installed Question Mind app on device
```

### Step 5: Launch and Test

```bash
# Check logs in real-time
adb logcat | grep questionmind

# Or use Android Studio's Logcat view
```

---

## 🔍 USB Debugging & Inspection

### Real-Time App Logging

```bash
# View all logs
adb logcat

# Filter for your app only
adb logcat | grep "com.krishacademia.questionmind"

# Filter by log level (Info, Warning, Error)
adb logcat *:W  # Warnings and errors only

# Save logs to file
adb logcat > app_logs.txt

# Clear existing logs
adb logcat -c
```

### Debug JavaScript

**Option 1: Android Studio**
```
Android Studio → View → Tool Windows → Logcat
Filter: com.krishacademia.questionmind
```

**Option 2: Chrome DevTools**
```bash
# On Windows, enable USB debugging in Chrome
# 1. Open Chrome on dev machine
# 2. Go to chrome://inspect/#devices
# 3. Enable "Discover USB devices"
# 4. Connect Android device via USB with debugging enabled
# 5. You should see "Question Mind" app listed
# 6. Click "Inspect" to open DevTools
```

**Option 3: Capacitor Live Reload (Development)**
```bash
# Terminal 1: Start Capacitor with live reload
npx cap run android --livereload --external

# Terminal 2: Start dev server
npm run dev

# App will reload whenever you save changes in mobile-app/src
```

### Inspect Files on Device

```bash
# Connect to device shell
adb shell

# Navigate to app data
cd /data/data/com.krishacademia.questionmind

# List directories
ls -la
# Should see:
# - cache/
# - databases/
# - files/
# - shared_prefs/

# Exit shell
exit
```

### Pull Files from Device

```bash
# Download entire app data
adb pull /data/data/com.krishacademia.questionmind ./device_data

# Download specific file
adb pull /data/data/com.krishacademia.questionmind/databases/app.db ./app.db

# List files without pulling
adb shell ls /data/data/com.krishacademia.questionmind/databases/
```

### Push Files to Device

```bash
# Upload a test file
adb push local_file.txt /data/data/com.krishacademia.questionmind/files/

# Note: You may need root access or use device's writable directories
```

---

## 🧪 Testing Scenarios

### Test 1: Basic App Installation & Launch

**Steps:**
1. Run `npm run mobile:run-android`
2. App should launch on device
3. Should see login screen
4. Check logs: `adb logcat | grep "App initialized"`

**Expected:**
- App loads without crashes
- No red error boxes
- Network requests appear in logs

### Test 2: Authentication Flow

**Steps:**
1. Enter test credentials
2. Click "Login"
3. Check network requests

**Logs to Monitor:**
```bash
adb logcat | grep "auth\|login\|token"
```

**Success Indicators:**
- No 403/401 errors
- Token stored in localStorage
- Dashboard loads

### Test 3: Question Generation

**Steps:**
1. Login successfully
2. Navigate to Dashboard
3. Select a subject
4. Click "Generate Questions"
5. Monitor logs

**Debug Logs:**
```bash
# Watch for API calls
adb logcat | grep "api\|http\|axios"

# Watch for Pyodide errors (if using Pyodide)
adb logcat | grep "pyodide\|wasm"
```

**Expected:**
- Questions load and display
- Custom API key is used (if configured)
- Proper fallback if custom key fails

### Test 4: Settings & API Keys

**Steps:**
1. Go to Settings → AI Settings
2. Add a custom Groq API key
3. Test key
4. Save
5. Generate questions using custom key

**Debug:**
```bash
adb logcat | grep "api-key\|groq\|test-key"

# Check stored preferences
adb shell "run-as com.krishacademia.questionmind cat /data/data/com.krishacademia.questionmind/shared_prefs/ai-settings-storage.xml"
```

**Success:**
- Key saved securely
- Questions use custom key
- Fallback works if key fails

### Test 5: Local Model Support (Chaquopy)

**Steps:**
1. Go to Settings → AI Settings → Advanced
2. Check device capabilities
3. If Gemma2B available, download it
4. Select "Use Local Model"
5. Generate questions offline

**Debug:**
```bash
# Watch model loading
adb logcat | grep "chaquopy\|local.*model\|gemma"

# Check if Python environment initialized
adb logcat | grep "python\|pyi"
```

### Test 6: Network Resilience

**Steps:**
1. Enable Airplane Mode on device
2. Try to generate questions
3. Should show offline error gracefully
4. Disable Airplane Mode
5. Try again

**Debug:**
```bash
adb logcat | grep "network\|connection\|offline"
```

### Test 7: Performance

**Steps:**
1. Open Chrome DevTools (see section above)
2. Record Performance timeline
3. Generate questions
4. Stop recording
5. Analyze metrics

**Check:**
- First Contentful Paint: < 2s
- Time to Interactive: < 3s
- Question load: < 5s

---

## 🐛 Common Issues & Fixes

### Issue 1: "adb: command not found"

**Fix:**
```bash
# Add to PATH
# Windows: Set environment variable
setx PATH "%PATH%;C:\Users\YOUR_USER\AppData\Local\Android\Sdk\platform-tools"

# macOS/Linux: Add to shell profile
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
```

### Issue 2: "Device not authorized"

**Fix:**
```bash
# 1. Disconnect device
adb disconnect

# 2. On device: Settings → Apps → Show system apps
#    → Find "USB Debugging" → Clear cache
# 3. Disconnect USB cable, wait 5 seconds
# 4. Reconnect and tap "Allow" on device
# 5. Verify
adb devices
```

### Issue 3: APK Installation Fails

**Fix:**
```bash
# Check existing installation
adb shell pm list packages | grep questionmind

# Uninstall previous version
adb uninstall com.krishacademia.questionmind

# Try install again
npm run mobile:run-android
```

### Issue 4: App Crashes on Launch

**Fix:**
```bash
# View crash logs
adb logcat | grep "FATAL\|Exception\|Error"

# Clear app data and reinstall
adb shell pm clear com.krishacademia.questionmind
npm run mobile:run-android
```

### Issue 5: API Calls Return 401/Network Errors

**Fix:**
```bash
# Check backend is running
curl http://localhost:8000/health

# Check if device can reach backend
adb shell ping 10.0.2.2  # Android emulator bridge IP
adb shell ping YOUR_COMPUTER_IP

# Update API endpoint in capacitor.config.ts if needed
# Change from localhost to your machine IP
```

### Issue 6: Settings Not Persisting

**Fix:**
```bash
# Check localStorage
adb shell "run-as com.krishacademia.questionmind cat /data/data/com.krishacademia.questionmind/shared_prefs/ai-settings-storage.xml"

# Clear app data
adb shell pm clear com.krishacademia.questionmind

# Reinstall and test
npm run mobile:run-android
```

### Issue 7: Gradle Build Fails with "Unsupported class file major version 65" or "invalid source release: 21"

**Fix:**
These errors occur when using newer Capacitor plugins (like `@capacitor/share@8.x`) that target Java 21 on a computer running JDK 17, or when older Gradle wrappers fail to parse new Bouncy Castle cache JARs.
1. **Upgrade Gradle Wrapper to 8.7** in `mobile-app/android/gradle/wrapper/gradle-wrapper.properties`:
   ```properties
   distributionUrl=https\://services.gradle.org/distributions/gradle-8.7-all.zip
   ```
2. **Force Java 17 Compatibility** for all subprojects by adding compile options overrides to `mobile-app/android/build.gradle`:
   ```groovy
   allprojects {
       tasks.withType(JavaCompile) {
           sourceCompatibility = JavaVersion.VERSION_17
           targetCompatibility = JavaVersion.VERSION_17
       }
   }
   subprojects {
       afterEvaluate { project ->
           if (project.extensions.findByName('android') != null) {
               project.android {
                   compileOptions {
                       sourceCompatibility = JavaVersion.VERSION_17
                       targetCompatibility = JavaVersion.VERSION_17
                   }
               }
           }
       }
   }
   ```

---

## 📊 Testing Checklist

Use this to verify all features work:

- [ ] **Installation:**
  - [ ] `npm run mobile:run-android` completes without errors
  - [ ] App appears on device
  - [ ] App icon shows "Question Mind"

- [ ] **Authentication:**
  - [ ] Can login with test account
  - [ ] Can logout
  - [ ] JWT token stored securely

- [ ] **Dashboard:**
  - [ ] All menu items visible
  - [ ] Subject list loads
  - [ ] Syllabus loads
  - [ ] Question bank loads

- [ ] **Settings:**
  - [ ] Settings page accessible
  - [ ] Provider selector works
  - [ ] Can save API key
  - [ ] Can test API key
  - [ ] Settings persist after restart

- [ ] **Question Generation:**
  - [ ] Can generate questions (default backend)
  - [ ] Can generate with custom API key
  - [ ] Fallback works if custom key fails
  - [ ] Questions display correctly
  - [ ] Questions are formatted properly

- [ ] **Offline Support:**
  - [ ] Device capabilities detected
  - [ ] Local model option shows if available
  - [ ] Can download local model
  - [ ] Can generate offline if model available

- [ ] **Error Handling:**
  - [ ] Proper error messages show
  - [ ] Fallback options displayed
  - [ ] No crash on network error
  - [ ] Can retry after error

- [ ] **Performance:**
  - [ ] App launches in < 3s
  - [ ] Settings page loads in < 1s
  - [ ] Question generation completes in < 30s
  - [ ] No memory leaks (use Chrome DevTools)

- [ ] **Logging:**
  - [ ] No console errors in logcat
  - [ ] API calls logged correctly
  - [ ] Provider selection logged

---

## 🔄 Workflow: Continuous Testing During Development

**Terminal 1: Start Dev Server**
```bash
cd mobile-app
npm run dev
```

**Terminal 2: Start Capacitor with Live Reload**
```bash
cd mobile-app
npx cap run android --livereload --external
```

**Terminal 3: Monitor Logs**
```bash
adb logcat | grep "questionmind\|ERROR\|WARNING"
```

**Workflow:**
1. Make changes to `mobile-app/src/`
2. Save file → auto-rebuild via Vite
3. Device auto-reloads app
4. See changes immediately
5. Check logs for errors

---

## 📱 Multiple Device Testing

```bash
# Connect multiple devices
adb devices
# List of attached devices
# DEVICE_1    device
# DEVICE_2    device

# Specify device for commands
ADB_SERIAL=DEVICE_1 adb logcat
ADB_SERIAL=DEVICE_2 adb logcat

# Or set environment variable
$env:ADB_SERIAL = "DEVICE_1"
adb logcat

# Reset to first device
$env:ADB_SERIAL = ""
adb devices
```

---

## 🎯 Advanced: Profiling & Optimization

### Memory Profiling

```bash
# Check memory usage
adb shell "dumpsys meminfo com.krishacademia.questionmind"

# Monitor real-time
adb shell "watch -n 1 'dumpsys meminfo com.krishacademia.questionmind | head -20'"
```

### CPU Profiling

```bash
# Record CPU trace
adb shell am trace-ipc start
# Perform actions on app
adb shell am trace-ipc stop --output=/data/trace.bin
adb pull /data/trace.bin
# Open in Android Studio Profiler
```

### Network Inspection

```bash
# Use Fiddler or Charles Proxy
# OR use Android Studio Network Profiler
# Android Studio → Tools → Profiler → Network tab
```

---

## ✅ Success Indicators

When testing is complete, you should see:

1. ✅ App installs without errors
2. ✅ No crash on startup
3. ✅ All pages load
4. ✅ API calls work
5. ✅ Settings persist
6. ✅ Custom API keys work
7. ✅ Fallback strategy works
8. ✅ Error messages are helpful
9. ✅ Logs show no errors
10. ✅ Performance is acceptable

---

## 📞 Quick Commands Reference

```bash
# Basic
adb devices              # List devices
adb shell               # Connect to device shell
adb logcat              # View logs
adb logcat -c           # Clear logs

# Install/Uninstall
adb install app.apk                    # Install APK
adb uninstall com.krishacademia.questionmind  # Uninstall
adb shell pm list packages             # List installed apps

# File Operations
adb push local /data/remote                 # Push file
adb pull /data/remote local                 # Pull file
adb shell ls /data/data/com.krishacademia.questionmind  # List app data

# Device Info
adb shell getprop ro.build.version.release  # Android version
adb shell getprop ro.serialno               # Device serial
adb shell df                                # Disk space

# Development
npm run build                   # Build web
npx cap sync android           # Sync with native
npm run mobile:run-android     # Build and run
npx cap run android --livereload  # Live reload
```

---

## 🚀 Next Steps After Testing

1. **Pass all tests in checklist above**
2. **Run on multiple devices** (different Android versions)
3. **Test on emulator** with `npx cap open android` and Android Studio
4. **Performance optimization** if needed
5. **Beta release** to early testers
6. **Address feedback** and iterate
7. **Prepare for production release**

---

**Status:** Ready to test  
**Last Updated:** May 31, 2026
