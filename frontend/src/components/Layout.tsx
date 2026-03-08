import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Settings,
  FileQuestion,
  CheckCircle,
  LogOut,
  Menu,
  X,
  Brain,
  Moon,
  Sun,
  BarChart3,
} from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/logo.png';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isHOD = user?.role === 'HOD';

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ...(isHOD ? [{ path: '/overview', icon: BarChart3, label: 'Overview' }] : []),
    { path: '/subjects', icon: BookOpen, label: 'Subjects' },
    { path: '/syllabus', icon: FileText, label: 'Syllabus' },
    { path: '/patterns', icon: Settings, label: 'Patterns' },
    { path: '/question-banks', icon: FileQuestion, label: 'Question Banks' },
    ...(isHOD ? [{ path: '/approvals', icon: CheckCircle, label: 'Approvals' }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-pink-100 dark:border-pink-900 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>



          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-10 w-auto object-contain" />
          </Link>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-pink-50 via-purple-50 to-orange-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-950 border-r-4 border-pink-300 dark:border-pink-600 transform transition-transform duration-300 z-40 shadow-2xl shadow-pink-200/50 dark:shadow-purple-900/50 flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b-2 border-pink-300 dark:border-pink-600 flex items-center justify-between bg-gradient-to-br from-pink-100 via-purple-100 to-orange-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 flex-shrink-0">
          <Link to="/" className="flex items-center justify-center w-full group">
            <img src={logo} alt="Logo" className="h-16 w-auto object-contain transition-transform duration-300 group-hover:scale-105" />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={toggleTheme}
            className="hidden lg:flex p-2.5 bg-gradient-to-br from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 text-white rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
                  ${isActive
                    ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 text-white shadow-lg transform scale-105 ring-2 ring-pink-300 dark:ring-pink-500'
                    : 'text-purple-700 dark:text-pink-300 hover:bg-gradient-to-r hover:from-pink-100 hover:to-purple-100 dark:hover:from-purple-800 dark:hover:to-pink-800 hover:text-purple-900 dark:hover:text-pink-100 border border-transparent hover:scale-102 hover:shadow-md'
                  }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
                <span className="font-bold">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t-2 border-pink-300 dark:border-pink-600 bg-gradient-to-r from-pink-100/90 via-purple-100/90 to-orange-100/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-slate-900 text-white dark:bg-slate-800 flex items-center justify-center font-bold text-lg shadow-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize font-semibold">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white dark:bg-slate-800 rounded-xl font-semibold hover:bg-slate-800 dark:hover:bg-slate-700 transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-72'} relative z-10 pt-16 lg:pt-0`}>
        <div className="p-6 lg:p-10">
          {children}
        </div>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}


