'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';

function WaveBackground({ animated = false }) {
  const animClass = animated ? 'wave-animated' : '';
  return (
    <div className="wave-bg-container">
      <svg className={`animated-wave animated-wave-1 ${animClass}`} viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M-200,300 C200,100 500,500 900,200 C1300,-100 1600,400 2000,150 L2000,900 L-200,900 Z" fill="url(#wg1)" />
        <defs><linearGradient id="wg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e2f0ff" stopOpacity="0.8"/><stop offset="50%" stopColor="#d8c5ff" stopOpacity="0.4"/><stop offset="100%" stopColor="#5621bf" stopOpacity="0.18"/></linearGradient></defs>
      </svg>
      <svg className={`animated-wave animated-wave-2 ${animClass}`} viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M-200,200 C300,400 600,100 1100,350 C1500,500 1800,200 2100,450 L2100,900 L-200,900 Z" fill="url(#wg2)" />
        <defs><linearGradient id="wg2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#5621bf" stopOpacity="0.22"/><stop offset="60%" stopColor="#e2f0ff" stopOpacity="0.6"/><stop offset="100%" stopColor="#fdfdfd" stopOpacity="0.1"/></linearGradient></defs>
      </svg>
    </div>
  );
}

export default function HomePage() {
  useEffect(() => {
    // Check if user is already logged in
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          window.location.href = '/dashboard';
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col justify-between overflow-hidden">
      {/* Top Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#e2f0ff]/60 via-purple-100/30 to-transparent blur-3xl -z-10 pointer-events-none" />

      {/* Animated Wave Background */}
      <WaveBackground animated={true} />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-4 lg:py-5 flex items-center justify-between z-20 shrink-0">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
          <Image src="/logo.png" alt="HOMETRACKER Logo" width={40} height={40} className="w-7 h-7 sm:w-10 sm:h-10 object-contain group-hover:scale-105 transition-transform duration-300" />
          <span className="font-extrabold text-lg sm:text-2xl tracking-tight text-slate-900">
            HOME<span className="text-[#5621bf]">TRACKER</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 font-semibold text-sm text-slate-600">
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'how-it-works'}))} className="hover:text-[#5621bf] transition-colors">How It Works</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'safety'}))} className="hover:text-[#5621bf] transition-colors">Privacy &amp; Safety</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'tips'}))} className="hover:text-[#5621bf] transition-colors">Tips &amp; Tricks</button>
        </nav>
      </header>

      {/* Main Hero */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-1 sm:py-4 my-auto flex-1 flex flex-col justify-center overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center my-auto max-h-full">
          {/* Left Column */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left z-10 w-full">
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] mb-3 sm:mb-5 lg:mb-6">
              Know where they are. <br />
              <span className="bg-gradient-to-r from-[#5621bf] via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Know when they&apos;re home.
              </span>
            </h1>

            <p className="text-sm sm:text-lg lg:text-xl text-slate-600 font-medium max-w-2xl leading-relaxed mb-4 sm:mb-8">
              Create your private family circle in seconds. HOMETRACKER combines smart predictive routing so you always know{' '}
              <span className="text-slate-900 font-bold underline decoration-[#e2f0ff] decoration-4">
                exactly how late the kids will be home
              </span>.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mb-2 sm:mb-8">
              <Link
                href="/auth"
                className="px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-base sm:text-lg shadow-[0_20px_40px_-15px_rgba(86,33,191,0.25)] hover:shadow-purple-500/30 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 sm:gap-3 group"
              >
                <span>Create your family</span>
                <i className="fa-solid fa-arrow-right text-xs sm:text-sm group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Right Column */}
          <div className="hidden lg:flex lg:col-span-5 justify-center items-center">
            <Image src="/hero_preview.png" alt="HOMETRACKER Preview" width={420} height={500} className="w-full max-w-[420px] max-h-[60vh] h-auto object-contain" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold text-slate-500 border-t border-[#e8e8e8]/60 z-20 shrink-0">
        <div>© 2026 <span className="font-extrabold text-slate-800">HOMETRACKER Inc.</span> All rights reserved.</div>
        <div className="flex items-center gap-4 sm:gap-6">
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'privacy'}))} className="hover:text-[#5621bf] transition-colors">Privacy Policy</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'terms'}))} className="hover:text-[#5621bf] transition-colors">Terms of Service</button>
        </div>
      </footer>
    </div>
  );
}
