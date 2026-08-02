'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

function WaveBackground() {
  return (
    <div className="wave-bg-container">
      <svg className="animated-wave animated-wave-1 wave-animated" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M-200,300 C200,100 500,500 900,200 C1300,-100 1600,400 2000,150 L2000,900 L-200,900 Z" fill="url(#wga1)" />
        <defs><linearGradient id="wga1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e2f0ff" stopOpacity="0.8"/><stop offset="50%" stopColor="#d8c5ff" stopOpacity="0.4"/><stop offset="100%" stopColor="#5621bf" stopOpacity="0.18"/></linearGradient></defs>
      </svg>
      <svg className="animated-wave animated-wave-2 wave-animated" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M-200,200 C300,400 600,100 1100,350 C1500,500 1800,200 2100,450 L2100,900 L-200,900 Z" fill="url(#wga2)" />
        <defs><linearGradient id="wga2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#5621bf" stopOpacity="0.22"/><stop offset="60%" stopColor="#e2f0ff" stopOpacity="0.6"/><stop offset="100%" stopColor="#fdfdfd" stopOpacity="0.1"/></linearGradient></defs>
      </svg>
    </div>
  );
}

// Helper function to format Family Code with auto-capslock and automatic dash after HT
function formatFamilyCode(input) {
  if (!input) return '';
  let clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return '';
  if (/^\d+$/.test(clean) || (/^[A-Z0-9]+$/.test(clean) && !clean.startsWith('HT'))) {
    clean = 'HT' + clean;
  }
  if (clean.length > 2) {
    return clean.slice(0, 2) + '-' + clean.slice(2, 8);
  }
  return clean;
}

export default function AuthPage() {
  const [tab, setTab] = useState('signin');
  const [role, setRole] = useState('parent');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'error'|'success'|'warning', message: '' }

  // Form fields
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Field errors
  const [errors, setErrors] = useState({});

  // Auto-redirect if already logged in
  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) window.location.href = '/dashboard';
      })
      .catch(() => {});
  }, []);

  const showAlert = (type, message) => setAlert({ type, message });
  const hideAlert = () => setAlert(null);

  const setFieldError = (field, message) => setErrors((prev) => ({ ...prev, [field]: message }));
  const clearFieldError = (field) => setErrors((prev) => ({ ...prev, [field]: null }));

  // Validation
  const validateEmail = () => {
    if (!email.trim()) { setFieldError('email', 'Email address is required.'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setFieldError('email', 'Please enter a valid email address.'); return false; }
    clearFieldError('email');
    return true;
  };

  const validatePassword = () => {
    if (!password) { setFieldError('password', 'Password is required.'); return false; }
    if (tab === 'signup') {
      if (password.length < 8) { setFieldError('password', 'Password must be at least 8 characters.'); return false; }
      const weak = ['123456', '12345678', '123456789', 'password', 'qwerty', '111111', 'abc123', 'password1'];
      if (weak.includes(password.toLowerCase())) { setFieldError('password', 'This password is too common.'); return false; }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) { setFieldError('password', 'Password must contain letters and numbers.'); return false; }
    }
    clearFieldError('password');
    return true;
  };

  const validateFullname = () => {
    if (tab !== 'signup') return true;
    if (!fullname.trim()) { setFieldError('fullname', 'Full name is required.'); return false; }
    clearFieldError('fullname');
    return true;
  };

  const validateFamilyCode = () => {
    if (tab !== 'signup' || role !== 'child') return true;
    if (!familyCode.trim()) { setFieldError('familyCode', 'Parent Family Code is required.'); return false; }
    if (familyCode.trim().length < 4) { setFieldError('familyCode', 'Please enter a valid family code (e.g. HT-8921).'); return false; }
    clearFieldError('familyCode');
    return true;
  };

  const validateTerms = () => {
    if (tab !== 'signup') return true;
    if (!acceptedTerms) { setFieldError('terms', 'You must agree to the Terms of Service to create an account.'); return false; }
    clearFieldError('terms');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    hideAlert();

    const emailOk = validateEmail();
    const passOk = validatePassword();
    const nameOk = validateFullname();
    const codeOk = validateFamilyCode();
    const termsOk = validateTerms();

    if (!emailOk || !passOk || !nameOk || !codeOk || !termsOk) {
      showAlert('error', 'Please correct the highlighted errors.');
      return;
    }

    setLoading(true);

    try {
      if (tab === 'signin') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        const data = await res.json();

        if (!res.ok) {
          showAlert('error', data.error || 'Login failed.');
          setLoading(false);
          return;
        }

        showAlert('success', 'Login successful! Redirecting...');
        setTimeout(() => { window.location.href = '/dashboard'; }, 600);
      } else {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fullname.trim(),
            email: email.trim().toLowerCase(),
            password,
            role,
            familyCode: role === 'child' ? familyCode.trim().toUpperCase() : undefined,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          showAlert('error', data.error || 'Signup failed.');
          setLoading(false);
          return;
        }

        showAlert('success', 'Account created! Redirecting...');
        setTimeout(() => { window.location.href = '/dashboard'; }, 600);
      }
    } catch (err) {
      console.error(err);
      showAlert('error', 'Network error. Please check your connection.');
      setLoading(false);
    }
  };

  const switchTab = (newTab) => {
    setTab(newTab);
    hideAlert();
    setErrors({});
  };

  return (
    <div className="min-h-screen min-h-dvh flex flex-col justify-between relative overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#e2f0ff]/60 via-purple-100/30 to-transparent blur-3xl -z-10 pointer-events-none" />
      <WaveBackground />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-20 shrink-0">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
          <Image src="/logo.png" alt="HOMETRACKER Logo" width={44} height={44} className="w-8 h-8 sm:w-11 sm:h-11 object-contain group-hover:scale-105 transition-transform duration-300" />
          <span className="font-extrabold text-lg sm:text-2xl tracking-tight text-slate-900">
            HOME<span className="text-[#5621bf]">TRACKER</span>
          </span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 my-auto flex-1 flex flex-col justify-center items-center z-10 min-h-0">
        <div className="w-full max-w-lg glass-panel-landing rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05),0_0_0_1px_#e8e8e8] border border-slate-200/80 relative my-auto">

          {/* Alert Banner */}
          {alert && (
            <div className={`mb-3 sm:mb-4 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
              alert.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
              alert.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <i className={`fa-solid ${alert.type === 'error' ? 'fa-circle-exclamation' : alert.type === 'success' ? 'fa-circle-check' : 'fa-circle-info'} text-sm`} />
              <span>{alert.message}</span>
            </div>
          )}

          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl mb-3 sm:mb-5">
            <button
              type="button"
              onClick={() => switchTab('signin')}
              className={`flex-1 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 ${
                tab === 'signin' ? 'text-[#5621bf] bg-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-right-to-bracket mr-1 sm:mr-1.5" /> Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTab('signup')}
              className={`flex-1 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 ${
                tab === 'signup' ? 'text-[#5621bf] bg-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-user-plus mr-1 sm:mr-1.5" /> Create Account
            </button>
          </div>

          {/* Animated Tab Content */}
          <div key={tab} className="auth-tab-content">

          {/* Title */}
          <div className="text-center mb-3 sm:mb-5">
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {tab === 'signin' ? 'Welcome Back' : 'Create Your Account'}
            </h1>
            <p className="text-slate-500 font-medium text-xs sm:text-sm mt-0.5 sm:mt-1">
              {tab === 'signin' ? 'Sign in to track your family in real-time' : 'Start your private family location circle'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4" noValidate>
            {/* Full Name (Sign Up) */}
            {tab === 'signup' && (
              <div>
                <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <i className="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs sm:text-sm" />
                  <input type="text" value={fullname} onChange={(e) => setFullname(e.target.value)} onBlur={validateFullname}
                    placeholder="e.g. Sarah Miller"
                    className={`w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 rounded-xl border ${errors.fullname ? 'border-rose-500' : 'border-[#e8e8e8] focus:border-[#5621bf]'} focus:ring-2 focus:ring-[#5621bf]/20 outline-none transition-all text-xs sm:text-sm font-semibold text-slate-800 bg-white`} />
                </div>
                {errors.fullname && <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.fullname}</p>}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs sm:text-sm" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={validateEmail}
                  placeholder="name@example.com"
                  className={`w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 rounded-xl border ${errors.email ? 'border-rose-500' : 'border-[#e8e8e8] focus:border-[#5621bf]'} focus:ring-2 focus:ring-[#5621bf]/20 outline-none transition-all text-xs sm:text-sm font-semibold text-slate-800 bg-white`} />
              </div>
              {errors.email && <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700">Password</label>
              </div>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs sm:text-sm" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} onBlur={validatePassword}
                  placeholder="••••••••"
                  className={`w-full pl-10 sm:pl-11 pr-10 sm:pr-11 py-2.5 sm:py-3 rounded-xl border ${errors.password ? 'border-rose-500' : 'border-[#e8e8e8] focus:border-[#5621bf]'} focus:ring-2 focus:ring-[#5621bf]/20 outline-none transition-all text-xs sm:text-sm font-semibold text-slate-800 bg-white`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs sm:text-sm`} />
                </button>
              </div>
              {errors.password && <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.password}</p>}
            </div>

            {/* Role Selector (Sign Up) */}
            {tab === 'signup' && (
              <div className="pt-0.5">
                <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Select Account Role</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div onClick={() => setRole('parent')}
                    className={`border-2 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center group ${
                      role === 'parent' ? 'role-card-active border-[#5621bf] bg-[#e2f0ff]/30' : 'border-[#e8e8e8] bg-white hover:border-slate-300'
                    }`}>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl ${role === 'parent' ? 'bg-[#5621bf] text-white' : 'bg-slate-100 text-slate-700'} flex items-center justify-center text-sm sm:text-lg mb-1.5 shadow-sm group-hover:scale-105 transition-transform`}>
                      <i className="fa-solid fa-user-shield" />
                    </div>
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">Parent</span>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 mt-0.5">Manage family &amp; view live ETAs</span>
                  </div>
                  <div onClick={() => setRole('child')}
                    className={`border-2 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center group ${
                      role === 'child' ? 'role-card-active border-[#5621bf] bg-[#e2f0ff]/30' : 'border-[#e8e8e8] bg-white hover:border-slate-300'
                    }`}>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl ${role === 'child' ? 'bg-[#5621bf] text-white' : 'bg-slate-100 text-slate-700'} flex items-center justify-center text-sm sm:text-lg mb-1.5 shadow-sm group-hover:scale-105 transition-transform`}>
                      <i className="fa-solid fa-child" />
                    </div>
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">Child / Teen</span>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 mt-0.5">Share live GPS &amp; ETA check-ins</span>
                  </div>
                </div>
              </div>
            )}

            {/* Family Code (Child Sign Up) */}
            {tab === 'signup' && role === 'child' && (
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200">
                <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#5621bf] mb-1">Parent&apos;s Family Code</label>
                <div className="relative">
                  <i className="fa-solid fa-key absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs sm:text-sm" />
                  <input type="text" value={familyCode}
                    onChange={(e) => setFamilyCode(formatFamilyCode(e.target.value))}
                    onBlur={validateFamilyCode}
                    placeholder="e.g. HT-7K9M2P" maxLength={9}
                    className={`w-full pl-10 sm:pl-11 pr-4 py-2 rounded-xl border ${errors.familyCode ? 'border-rose-500' : 'border-[#e8e8e8] focus:border-[#5621bf]'} focus:ring-2 focus:ring-[#5621bf]/20 outline-none uppercase tracking-widest text-xs sm:text-sm font-extrabold text-slate-800 bg-white`} />
                </div>
                {errors.familyCode && <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.familyCode}</p>}
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-1">Ask your parent for the family code generated on their account.</p>
              </div>
            )}

            {/* Parent Notice (Parent Sign Up) */}
            {tab === 'signup' && role === 'parent' && (
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 italic">A unique Family Invite Code will automatically be generated for your kids.</p>
            )}

            {/* Terms (Sign Up) */}
            {tab === 'signup' && (
              <div className="pt-0.5">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      if (e.target.checked) clearFieldError('terms');
                    }}
                    className="w-4 h-4 mt-0.5 accent-[#5621bf] purple-checkbox rounded border-slate-300 focus:ring-2 focus:ring-[#5621bf]/30 cursor-pointer shrink-0"
                  />
                  <label htmlFor="terms" className="text-[11px] sm:text-xs font-semibold text-slate-600 cursor-pointer leading-tight">
                    I agree to the <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'terms'}))} className="text-[#5621bf] font-bold hover:underline">Terms of Service</button> &amp; <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'privacy'}))} className="text-[#5621bf] font-bold hover:underline">Privacy Policy</button> <span className="text-rose-500 font-bold">*</span>
                  </label>
                </div>
                {errors.terms && <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.terms}</p>}
              </div>
            )}

            {/* Submit Button */}
            <button type="submit" disabled={loading}
              className={`w-full py-3 sm:py-3.5 px-6 rounded-xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-sm sm:text-base shadow-[0_20px_40px_-15px_rgba(86,33,191,0.25)] hover:shadow-purple-500/30 transition-all duration-300 transform active:scale-[0.99] flex items-center justify-center gap-2 mt-2 sm:mt-4 ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}>
              <span>{tab === 'signin' ? 'Sign In' : 'Create Account'}</span>
              {loading && <i className="fa-solid fa-circle-notch fa-spin" />}
            </button>
          </form>
          </div>{/* end auth-tab-content */}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold text-slate-500 border-t border-[#e8e8e8]/60 z-20 shrink-0">
        <div className="flex items-center flex-wrap gap-1">
          <span>© 2026 <span className="font-extrabold text-slate-800">HOMETRACKER Inc.</span> All rights reserved.</span>
          <span className="hidden sm:inline mx-1">|</span>
          <span>Made by <a href="https://nielscoert.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-[#5621bf] transition-colors font-bold">Niels Coert</a></span>
          <a href="https://github.com/the-bitwalker" target="_blank" rel="noopener noreferrer" className="ml-1 text-slate-400 hover:text-[#5621bf] transition-colors" title="GitHub">
            <i className="fa-brands fa-github text-sm"></i>
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'privacy'}))} className="hover:text-[#5621bf] transition-colors cursor-pointer">Privacy Policy</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'terms'}))} className="hover:text-[#5621bf] transition-colors cursor-pointer">Terms of Service</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'safety'}))} className="hover:text-[#5621bf] transition-colors cursor-pointer">Privacy &amp; Safety</button>
        </div>
      </footer>
    </div>
  );
}
