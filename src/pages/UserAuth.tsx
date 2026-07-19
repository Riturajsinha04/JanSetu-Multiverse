import { useState } from 'react';
import { Mail, Lock, Shield, LogIn, AlertTriangle, Loader, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLang } from '../lib/langContext';

interface UserAuthProps {
  onAuthSuccess: () => void;
  onBack: () => void;
}

export default function UserAuth({ onAuthSuccess }: UserAuthProps) {
  const { T } = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const uname = username.trim().toLowerCase();
    const pass = password;

    // 1. Check local authentication bypass first
    if (uname === 'citizen' && pass === '123456') {
      localStorage.setItem('jansetu_local_auth', 'citizen');
      setLoading(false);
      onAuthSuccess();
      return;
    }

    if (uname === 'admin' && pass === '123456') {
      localStorage.setItem('jansetu_local_auth', 'admin');
      setLoading(false);
      onAuthSuccess();
      return;
    }

    // 2. Fallback to Supabase
    let email = username.trim();
    if (!email.includes('@')) {
      email = `${email.toLowerCase()}@jansetu.com`;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      onAuthSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : T.auth_error_failed;
      if (msg.includes('Invalid login')) setError(T.auth_error_credentials);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handlePrefill(uname: string) {
    setUsername(uname);
    setPassword('123456');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px] space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center shadow-md">
              <span className="text-white font-black text-xl">JS</span>
            </div>
            <div className="text-left">
              <div className="font-extrabold text-3xl text-gray-900 leading-none">JanSetu</div>
              <div className="text-[10px] text-orange-500 font-bold tracking-widest mt-1">MULTIVERSE</div>
            </div>
          </div>
          <p className="text-gray-500 text-sm">Sign in to access the civic intelligence platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[32px] border border-gray-200 overflow-hidden shadow-sm">
          {/* Card Header */}
          <div className="bg-orange-500 py-4 px-8 flex items-center gap-2">
            <Shield size={16} className="text-white" />
            <span className="text-white font-bold text-xs uppercase tracking-wider">SECURE LOGIN</span>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              {loading ? (
                <><Loader size={17} className="animate-spin" /> {T.auth_signing_in}</>
              ) : (
                <><LogIn size={17} /> Sign In</>
              )}
            </button>
          </form>
        </div>

        {/* Demo Credentials Box */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">DEMO CREDENTIALS</div>
          
          <button 
            onClick={() => handlePrefill('citizen')}
            className="w-full flex items-center gap-3 mb-3 pb-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <User size={15} className="text-blue-500" />
            </div>
            <div>
              <span className="text-sm font-bold text-gray-700">Citizen: </span>
              <span className="text-sm text-gray-500">ID: citizen / Pass: 123456</span>
            </div>
          </button>

          <button 
            onClick={() => handlePrefill('admin')}
            className="w-full flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
              <Shield size={15} className="text-purple-500" />
            </div>
            <div>
              <span className="text-sm font-bold text-gray-700">Admin: </span>
              <span className="text-sm text-gray-500">ID: admin / Pass: 123456</span>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 font-semibold">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          Secured with local authentication
        </div>
      </div>
    </div>
  );
}
