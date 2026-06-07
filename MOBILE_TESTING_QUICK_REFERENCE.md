# Mobile App Testing - Quick Reference Card

## ⚡ 30-Second Quick Start

```bash
# Terminal 1: Connect phone via USB, enable Developer Mode & USB Debugging
adb devices  # Should show your device

# Terminal 2: From project root
cd mobile-app
npm install
npm run mobile:run-android

# Done! App is installing on your phone now 🚀
```

## 📱 After App Installs

**Test these immediately:**

```bash
# 1. Check app launches
adb logcat | grep questionmind

# 2. Test login (Watch logs while you login on phone)
adb logcat | grep "auth|login"

# 3. Generate a question
adb logcat | grep "generate|question"

# 4. Add custom API key in Settings
adb logcat | grep "api-key"

# 5. Check for errors
adb logcat | grep "ERROR|EXCEPTION"
```

---

## 🧪 Testing Scripts (Easiest Way)

Run from project root:

```powershell
# First time setup
.\mobile-app-test.ps1 setup

# Check if devices connected
.\mobile-app-test.ps1 check-adb

# Build and install
.\mobile-app-test.ps1 install

# View live logs
.\mobile-app-test.ps1 logs

# Test authentication
.\mobile-app-test.ps1 test-auth

# Test settings/API keys
.\mobile-app-test.ps1 test-settings

# Test question generation
.\mobile-app-test.ps1 test-generation

# Run ALL tests (recommended!)
.\mobile-app-test.ps1 full-test

# Development mode with live reload
.\mobile-app-test.ps1 dev-mode
```

---

## 🔍 Common Debug Scenarios

### App won't install
```bash
# Clear previous version
adb uninstall com.krishacademia.questionmind

# Reinstall
npm run mobile:run-android
```

### App crashes on launch
```bash
# See the crash
adb logcat | grep "FATAL\|Exception\|Crash"

# Check backend is running
curl http://localhost:8000/health
```

### API calls fail
```bash
# Check what errors
adb logcat | grep "api\|http\|401\|404\|500"

# If "connection refused":
adb shell ping 10.0.2.2  # Emulator test
adb shell ping YOUR_PC_IP  # Device test
```

### Settings not saving
```bash
# Check storage
adb shell "run-as com.krishacademia.questionmind cat /data/data/com.krishacademia.questionmind/shared_prefs/ai-settings-storage.xml"

# Clear and retry
adb shell pm clear com.krishacademia.questionmind
```

### Custom API key not working
```bash
# Check logs during generation
adb logcat | grep "custom\|groq\|fallback"

# Verify key in logcat (shouldn't show actual key, only that it was used)
adb logcat | grep "provider.*custom"
```

### Gradle fails with bytecode/Java version errors (major version 65 / invalid source release: 21)
- Verify `distributionUrl` in `gradle-wrapper.properties` is set to Gradle `8.7`.
- Verify root `build.gradle` has Java 17 compile overrides (`sourceCompatibility = JavaVersion.VERSION_17`) in `allprojects` and `subprojects`.

---

## 📊 Full Test Checklist

- [ ] Install completes successfully
- [ ] App launches without crashing
- [ ] Login works
- [ ] Dashboard loads all pages
- [ ] Generate questions works
- [ ] Settings page accessible
- [ ] Can add custom API key
- [ ] Can test API key
- [ ] Custom key works for generation
- [ ] Fallback happens if key fails
- [ ] Error messages are clear
- [ ] No "ERROR" in logcat
- [ ] Settings persist after restart
- [ ] Local model option shows (if device supports)

---

## 🆘 If Something Breaks

**Quick fixes in order:**

```bash
# 1. Clear app data
adb shell pm clear com.krishacademia.questionmind

# 2. Uninstall
adb uninstall com.krishacademia.questionmind

# 3. Verify device connected
adb devices

# 4. Rebuild from scratch
cd mobile-app
npm install
npm run build
npx cap sync android
npm run mobile:run-android

# 5. Check backend running
curl http://localhost:8000/health

# 6. Review full logs
adb logcat > full_logs.txt
# Then open full_logs.txt and search for ERROR
```

---

## 📞 Commands at a Glance

| What | Command |
|------|---------|
| List devices | `adb devices` |
| View logs | `adb logcat` |
| Stop app | `adb shell am force-stop com.krishacademia.questionmind` |
| Restart app | `adb shell monkey -p com.krishacademia.questionmind -c android.intent.category.LAUNCHER 1` |
| Uninstall | `adb uninstall com.krishacademia.questionmind` |
| Pull files | `adb pull /data/data/com.krishacademia.questionmind ./data` |
| Device shell | `adb shell` |
| Inspect element (Chrome) | `chrome://inspect/#devices` |

---

## ✅ Success = All Green

If you see this, you're done testing:

```
✅ App installs
✅ No red errors
✅ Login works
✅ Questions generate
✅ Settings save
✅ Custom API key works
✅ Logs show no errors
✅ Runs < 3 seconds
```

---

## 🎯 What's Next?

1. ✅ Test on your device (follow this guide)
2. ✅ Test on multiple devices if possible
3. ✅ Test on emulator: `npx cap open android`
4. ✅ Run performance tests
5. 📦 Ready for beta!

See `MOBILE_USB_DEBUGGING_TEST_GUIDE.md` for detailed information.
