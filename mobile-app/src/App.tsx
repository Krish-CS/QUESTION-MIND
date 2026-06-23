import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './lib/store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Overview from './pages/Overview';
import Subjects from './pages/Subjects';
import Syllabus from './pages/Syllabus';
import Patterns from './pages/Patterns';
import QuestionBanks from './pages/QuestionBanks';
import QuickChecks from './pages/QuickChecks';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import GlobalLoader from './components/GlobalLoader';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { RefreshCw, WifiOff } from 'lucide-react';
import { downloadExcel } from './lib/api';

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
  const { loadFromStorage, user } = useAuthStore();
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

      // Monkey-patch anchor click to intercept and trigger native downloads
      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function(this: HTMLAnchorElement) {
        if (this.href && this.href.startsWith('blob:')) {
          const filename = this.download || 'download.xlsx';
          const url = this.href;
          (async () => {
            try {
              const res = await fetch(url);
              const blob = await res.blob();
              await downloadExcel(blob, filename);
            } catch (e) {
              console.error('Failed native download intercept:', e);
            }
          })();
          return;
        }
        originalClick.call(this);
      };
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

  const isAdmin = user?.role === 'ADMIN';

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
      
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          duration: 4000, 
          style: { 
            background: 'linear-gradient(to right, #4c1d95, #701a75)', // Deep purple to dark pink gradient
            color: '#fff',
            border: '1px solid #d946ef', // Fuchsia border
            boxShadow: '0 4px 14px 0 rgba(217, 70, 239, 0.39)',
            fontWeight: '600'
          },
          success: {
            iconTheme: {
              primary: '#fdf4ff', // Light fuchsia
              secondary: '#d946ef', // Fuchsia
            },
          },
          error: {
            iconTheme: {
              primary: '#fff1f2', // Light rose
              secondary: '#f43f5e', // Rose
            },
          }
        }} 
      />
      
      <GlobalLoader />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    {isAdmin ? (
                      <>
                        <Route path="/admin" element={<AdminDashboard />} />
                        <Route path="*" element={<Navigate to="/admin" replace />} />
                      </>
                    ) : (
                      <>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/overview" element={<Overview />} />
                        <Route path="/subjects" element={<Subjects />} />
                        <Route path="/syllabus" element={<Syllabus />} />
                        <Route path="/patterns" element={<Patterns />} />
                        <Route path="/question-banks" element={<QuestionBanks />} />
                        <Route path="/quick-checks" element={<QuickChecks />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </>
                    )}
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

