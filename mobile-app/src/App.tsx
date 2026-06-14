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
import { Network } from '@capacitor/network';
import { RefreshCw, WifiOff } from 'lucide-react';

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
  const [isOnline, setIsOnline] = useState(true); // Default true until first check
  const [isRetrying, setIsRetrying] = useState(false);
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
    const checkNetwork = async () => {
      const status = await Network.getStatus();
      setIsOnline(status.connected);
    };
    checkNetwork();

    const networkListener = Network.addListener('networkStatusChange', status => {
      setIsOnline(status.connected);
    });

    return () => {
      networkListener.then(listener => listener.remove());
    };
  }, []);

  const retryConnection = async () => {
    setIsRetrying(true);
    const status = await Network.getStatus();
    setIsOnline(status.connected);
    setIsRetrying(false);
  };

  useEffect(() => {
    loadFromStorage();

    let backListenerPromise: Promise<any> | null = null;

    if (Capacitor.isNativePlatform()) {
      LocalNotifications.addListener('localNotificationActionPerformed', async (notificationAction) => {
        const extra = notificationAction.notification.extra;
        if (notificationAction.actionId === 'tap' && extra && extra.filePath) {
          try {
            await FileOpener.openFile({ 
              path: extra.filePath,
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
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

  if (!isOnline) {
    return (
      <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-pink-50 px-6 dark:bg-slate-950">
        <div className="modal-content w-full max-w-sm rounded-lg border-2 border-pink-200 bg-white p-7 text-center shadow-2xl shadow-pink-200/60 dark:border-purple-800 dark:bg-slate-900 dark:shadow-black/50">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-purple-100 text-pink-600 dark:from-pink-950 dark:to-purple-950 dark:text-pink-300">
            <WifiOff size={32} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">No internet connection</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Question Mind needs an active internet connection. Connect to Wi-Fi or mobile data, then try again.
          </p>
          <button
            type="button"
            onClick={retryConnection}
            disabled={isRetrying}
            className="btn btn-primary mt-6 w-full justify-center"
          >
            <RefreshCw size={18} className={isRetrying ? 'animate-spin' : ''} aria-hidden="true" />
            {isRetrying ? 'Checking connection' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

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
            preload="auto"
            style={{ pointerEvents: 'none' }}
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
