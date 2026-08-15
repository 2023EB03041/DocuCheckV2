import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Loader2, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { saveGuestSession } from '../utils/guestSession';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

const GuestLogin = ({ onSignIn }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const destination = location.state?.from || '/account';

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [methodId, setMethodId] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(''); // 'send' or 'verify'
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const requestCode = async () => {
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError('Please enter a valid email address.');
      return;
    }

    setBusy('send');
    setError('');
    try {
      const res = await axios.post(`${API_URL}/guest/login/request`, { email: address });
      setMethodId(res.data.methodId || '');
      setCodeSent(true);
      setCode('');
      setNotice(res.data.message || '');
      setResendIn(res.data.resendInSeconds || 60);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) setCodeSent(true);
      setResendIn(err.response?.data?.resendInSeconds ?? resendIn);
      setError(err.response?.data?.message || "We couldn't send the code. Please try again in a moment.");
    } finally {
      setBusy('');
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6 || busy) return;

    setBusy('verify');
    setError('');
    try {
      const res = await axios.post(`${API_URL}/guest/login/verify`, { methodId, code });
      const session = { token: res.data.token, email: res.data.email };
      saveGuestSession(session);
      onSignIn?.(session);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't confirm that code. Please try again.");
      setBusy('');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#1a365d] rounded-full flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="w-8 h-8 text-[#d4af37]" />
          </div>
          <h2 className="text-3xl font-serif text-[#1a365d]">Guest Sign In</h2>
          <p className="text-gray-500 mt-2 text-sm">
            {codeSent
              ? 'Enter the code we just emailed you.'
              : 'Your email address is your account — no password needed.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 mb-6 rounded-sm text-sm border border-red-100 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                readOnly={codeSent}
                autoComplete="email"
                className={`w-full pl-12 pr-4 py-3 border rounded-sm outline-none focus:border-[#d4af37] ${
                  codeSent ? 'bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200' : 'bg-gray-50 border-gray-200'
                }`}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !codeSent) requestCode(); }}
              />
            </div>
          </div>

          {!codeSent ? (
            <button
              type="button"
              onClick={requestCode}
              disabled={busy === 'send'}
              className="w-full bg-[#1a365d] text-white py-4 rounded-sm font-bold tracking-widest uppercase text-sm hover:bg-[#2a4365] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy === 'send' ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending code</> : 'Email me a code'}
            </button>
          ) : (
            <>
              {notice && <p className="text-xs text-gray-600 bg-[#1a365d]/5 border border-[#1a365d]/15 rounded p-3">{notice}</p>}

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">6-Digit Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000000"
                  className="w-full text-center font-mono text-xl tracking-[0.4em] indent-[0.4em] px-4 py-3 bg-white border border-gray-300 rounded-sm outline-none focus:border-[#d4af37]"
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, '').substring(0, 6)); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') verifyCode(); }}
                />
              </div>

              <button
                type="button"
                onClick={verifyCode}
                disabled={code.length !== 6 || busy === 'verify'}
                className="w-full bg-[#1a365d] text-white py-4 rounded-sm font-bold tracking-widest uppercase text-sm hover:bg-[#2a4365] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy === 'verify' ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in</> : 'Sign in'}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setCodeSent(false); setCode(''); setError(''); setNotice(''); }}
                  className="font-bold uppercase tracking-wider text-gray-500 hover:text-[#1a365d] flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Change email
                </button>
                <button
                  type="button"
                  onClick={requestCode}
                  disabled={resendIn > 0 || busy === 'send'}
                  className="font-bold uppercase tracking-wider text-[#1a365d] hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuestLogin;
