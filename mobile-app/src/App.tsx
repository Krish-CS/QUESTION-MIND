import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './lib/store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Overview from './pages/Overview';
import Subjects from './pages/Subjects';
import Syllabus from './pages/Syllabus';
import Patterns from './pages/Patterns';
import QuestionBanks from './pages/QuestionBanks';
import Approvals from './pages/Approvals';
import Settings from './pages/Settings';
import GlobalLoader from './components/GlobalLoader';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { loadFromStorage } = useAuthStore();
  const [showSplash, setShowSplash] = useState(() => {
    // Play splash screen once per session
    return !sessionStorage.getItem('splash_shown');
  });
  const [isFading, setIsFading] = useState(false);

  const handleVideoEnd = () => {
    setIsFading(true);
    setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem('splash_shown', 'true');
    }, 500); // 500ms transition
  };

  useEffect(() => {
    loadFromStorage();

    let backListenerPromise: Promise<any> | null = null;

    if (Capacitor.isNativePlatform()) {
      LocalNotifications.addListener('localNotificationActionPerformed', async (notificationAction) => {
        const extra = notificationAction.notification.extra;
        if (notificationAction.actionId === 'tap' && extra && extra.filePath) {
          try {
            await FileOpener.openFile({ path: extra.filePath });
          } catch (e) {
            console.error('Error opening file:', e);
          }
        }
      });

      // Handle global native hardware back button
      backListenerPromise = CapApp.addListener('backButton', () => {
        // If there is history to go back to (idx > 0), navigate back.
        // Otherwise, exit the app natively.
        if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      });
    }

    return () => {
      if (Capacitor.isNativePlatform()) {
        LocalNotifications.removeAllListeners();
        if (backListenerPromise) {
          backListenerPromise.then((h) => h.remove());
        }
      }
    };
  }, [loadFromStorage]);

  useEffect(() => {
    if (showSplash) {
      // Automatic fallback in case video is blocked or stuck
      const timer = setTimeout(() => {
        setIsFading(true);
        setTimeout(() => {
          setShowSplash(false);
          sessionStorage.setItem('splash_shown', 'true');
        }, 500);
      }, 5000); // Max 5 seconds
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  return (
    <>
      {showSplash && (
        <div 
          className={`fixed inset-0 z-[10000] flex items-center justify-center bg-black transition-opacity duration-500 ${
            isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <video
            src="/assets/splash_screen_video.mp4"
            autoPlay
            playsInline
            onEnded={handleVideoEnd}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <GlobalLoader />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/overview" element={<Overview />} />
                    <Route path="/subjects" element={<Subjects />} />
                    <Route path="/syllabus" element={<Syllabus />} />
                    <Route path="/patterns" element={<Patterns />} />
                    <Route path="/question-banks" element={<QuestionBanks />} />
                    <Route path="/approvals" element={<Approvals />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}
