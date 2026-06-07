import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Loader2, Brain } from 'lucide-react';
import logo from '../assets/logo.png';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authApi.login(email, password);
      setAuth(response.data.user, response.data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-orange-50 dark:from-slate-950 dark:via-slate-900 dark:to-black flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">


        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img src={logo} alt="Logo" className="h-24 w-auto object-contain hover:scale-105 transition-transform duration-300" />
          </div>
        </div>

        {/* Form */}
        <div className="card dark:!bg-slate-900 p-8">
          <h2 className="text-2xl font-bold gradient-text text-center mb-2">Sign in</h2>
          <p className="text-sm text-purple-600 dark:text-pink-300 text-center mb-6 font-medium">Welcome back! Please enter your details. 👋</p>

          {error && (
            <div className="mt-4 mb-4 rounded-xl border-2 border-rose-300 bg-gradient-to-r from-rose-100 to-red-100 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-700 dark:from-rose-900 dark:to-red-950 dark:text-rose-100">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-purple-600 dark:text-pink-300 font-medium">
            <p>Don't have an account?</p>
            <Link
              to="/register"
              className="font-bold text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300 transition-colors"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}






