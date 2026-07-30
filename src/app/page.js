'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';

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

function AnimatedHamburger({ isOpen }) {
  const topRef = useRef(null);
  const midRef = useRef(null);
  const botRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      gsap.to(topRef.current, { y: 6, rotation: 45, transformOrigin: "50% 50%", duration: 0.3, ease: "power2.inOut" });
      gsap.to(midRef.current, { opacity: 0, duration: 0.3, ease: "power2.inOut" });
      gsap.to(botRef.current, { y: -6, rotation: -45, transformOrigin: "50% 50%", duration: 0.3, ease: "power2.inOut" });
    } else {
      gsap.to(topRef.current, { y: 0, rotation: 0, transformOrigin: "50% 50%", duration: 0.3, ease: "power2.inOut" });
      gsap.to(midRef.current, { opacity: 1, duration: 0.3, ease: "power2.inOut" });
      gsap.to(botRef.current, { y: 0, rotation: 0, transformOrigin: "50% 50%", duration: 0.3, ease: "power2.inOut" });
    }
  }, [isOpen]);

  return (
    <div className="relative w-5 h-[14px] flex flex-col justify-between items-center">
      <div ref={topRef} className="w-full h-[2px] bg-current rounded-full" />
      <div ref={midRef} className="w-full h-[2px] bg-current rounded-full" />
      <div ref={botRef} className="w-full h-[2px] bg-current rounded-full" />
    </div>
  );
}

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState('yearly'); // 'yearly' | 'monthly'
  const [subPlanMonths, setSubPlanMonths] = useState(12); // 3 | 6 | 12
  const [showPaymentInfoModal, setShowPaymentInfoModal] = useState(false);
  const [modal, setModal] = useState(null);
  const [copyIcon, setCopyIcon] = useState('fa-regular fa-copy');
  const [passwordInput, setPasswordInput] = useState('');
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  const accountMenuRef = useRef(null);
  const isParent = user?.role === 'parent';

  useEffect(() => {
    // Check if user is logged in (Do NOT auto redirect)
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.maintenanceMode && data.user?.role !== 'admin') {
          setIsMaintenanceMode(true);
        }
        
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoadingSession(false);
      });
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Hide header when reaching the pricing section
  useEffect(() => {
    const handleScroll = () => {
      const pricingSection = document.getElementById('pricing');
      if (pricingSection) {
        const rect = pricingSection.getBoundingClientRect();
        // Hide if the top of the pricing section comes near the top of the viewport
        if (rect.top <= 100) {
          setIsHeaderHidden(true);
        } else {
          setIsHeaderHidden(false);
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isMaintenanceMode) {
    return (
      <div className="min-h-screen min-h-dvh flex flex-col relative overflow-hidden bg-slate-50 items-center justify-center p-6 text-center">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#e2f0ff]/60 via-purple-100/30 to-transparent blur-3xl -z-10 pointer-events-none" />
        <WaveBackground />
        
        <header className="absolute top-0 w-full px-6 py-4 flex items-center justify-center sm:justify-start z-20">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <Image src="/logo.png" alt="HOMETRACKER Logo" width={36} height={36} className="w-8 h-8 object-contain" />
            <span className="font-extrabold text-lg tracking-tight text-slate-900">HOME<span className="text-[#5621bf]">TRACKER</span></span>
          </Link>
        </header>

        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
          <div className="w-20 h-20 bg-purple-100 text-[#5621bf] rounded-3xl flex items-center justify-center mx-auto shadow-sm">
            <i className="fa-solid fa-person-digging text-4xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">We are busy!</h2>
            <p className="text-sm font-semibold text-slate-500 mt-2 leading-relaxed">
              HomeTracker is currently undergoing scheduled maintenance to bring you new features and improvements. 
              <br /><br />
              Please check back later!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const fallbackCopyTextToClipboard = (text) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch (err) {
      console.error('Fallback copy error:', err);
    }
  };

  const handleCopyCode = () => {
    const code = user?.family_code || '';
    if (!code) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(code).catch(() => fallbackCopyTextToClipboard(code));
    } else {
      fallbackCopyTextToClipboard(code);
    }

    setCopyIcon('fa-solid fa-check text-[#5621bf]');
    setTimeout(() => setCopyIcon('fa-regular fa-copy'), 2000);
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error', e);
    }
    setUser(null);
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
  };

  const handleLeaveCircle = () => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    setModal({
      type: 'warning',
      title: 'Leave Family Circle?',
      message: 'Are you sure you want to leave? Your account will NOT be deleted, but you will need a new family code to join again.',
      confirmText: 'Leave Circle',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/circle/member/leave', { method: 'POST' });
          if (res.ok) {
            setUser((prev) => (prev ? { ...prev, family_code: '' } : null));
            setModal({ type: 'success', title: 'Left Circle', message: 'You have left the family circle.' });
          } else {
            const data = await res.json();
            setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to leave circle.' });
          }
        } catch (e) {
          setModal({ type: 'error', title: 'Error', message: e.message });
        }
      },
    });
  };

  const handleDeleteCircle = () => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    setModal({
      type: 'warning',
      title: 'Disband Family Circle?',
      message: 'Are you sure you want to disband this family circle? All members will be disconnected.',
      confirmText: 'Disband Circle',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/circle/delete', { method: 'POST' });
          if (res.ok) {
            setUser((prev) => (prev ? { ...prev, family_code: '' } : null));
            setModal({ type: 'success', title: 'Circle Disbanded', message: 'The family circle has been deleted.' });
          } else {
            const data = await res.json();
            setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to delete circle.' });
          }
        } catch (e) {
          setModal({ type: 'error', title: 'Error', message: e.message });
        }
      },
    });
  };

  const handleDeleteAccount = () => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    setPasswordInput('');
    setModal({
      type: 'warning',
      title: 'Delete Account',
      message: 'This action is permanent and cannot be undone. Please enter your password to confirm.',
      confirmText: 'Delete Forever',
      isPasswordPrompt: true,
      onConfirm: async (pass) => {
        try {
          const res = await fetch('/api/auth/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass }),
          });
          const data = await res.json();
          if (res.ok) {
            setUser(null);
            setModal({ type: 'success', title: 'Account Deleted', message: 'Your account has been deleted.' });
          } else {
            setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to delete account.' });
          }
        } catch (e) {
          setModal({ type: 'error', title: 'Error', message: e.message });
        }
      },
    });
  };

  const scrollToPricing = () => {
    if (user && isParent) {
      window.location.href = '/dashboard?action=request_pro';
    } else if (user) {
      window.location.href = '/dashboard';
    } else {
      const el = document.getElementById('pricing');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative overflow-x-hidden scroll-smooth">
      {/* Top Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#e2f0ff]/60 via-purple-100/30 to-transparent blur-3xl -z-10 pointer-events-none" />

      {/* Animated Wave Background */}
      <WaveBackground animated={true} />

      {/* Hero Section Container */}
      <div className="min-h-screen min-h-dvh flex flex-col justify-between relative">
        {/* Header */}
        <div className={`fixed top-0 left-0 right-0 z-[1001] w-full bg-white shadow-sm border-b border-slate-200 transition-transform duration-300 ${isHeaderHidden ? '-translate-y-full' : 'translate-y-0'}`}>
          <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
            <Image src="/logo.png" alt="HOMETRACKER Logo" width={44} height={44} className="w-8 h-8 sm:w-11 sm:h-11 object-contain group-hover:scale-105 transition-transform duration-300" />
            <span className="font-extrabold text-lg sm:text-2xl tracking-tight text-slate-900">
              HOME<span className="text-[#5621bf]">TRACKER</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-7 font-semibold text-sm text-slate-600">
            <button type="button" onClick={scrollToPricing} className="hover:text-[#5621bf] transition-colors cursor-pointer">Pro Membership</button>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'how-it-works'}))} className="hover:text-[#5621bf] transition-colors cursor-pointer">How It Works</button>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'safety'}))} className="hover:text-[#5621bf] transition-colors cursor-pointer">Privacy &amp; Safety</button>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'tips'}))} className="hover:text-[#5621bf] transition-colors cursor-pointer">Tips &amp; Tricks</button>
          </nav>

          {/* Desktop User Account / CTA Button */}
          <div className="hidden md:flex items-center gap-3">
            {loadingSession ? (
              <div className="w-32 h-10 bg-slate-200/60 animate-pulse rounded-xl" />
            ) : user ? (
              <div className="flex items-center gap-3 relative" ref={accountMenuRef}>
                <Link
                  href="/dashboard"
                  className="px-4 py-2.5 rounded-xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-sm shadow-md shadow-purple-500/20 hover:shadow-purple-500/30 transition-all flex items-center gap-2"
                >
                  <span>{user?.role === 'admin' ? 'Open Dashboard' : 'Open Map'}</span>
                </Link>

                {/* Account Menu Trigger (Matches Dashboard profile trigger) */}
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className="h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm hover:shadow-md hover:border-[#5621bf]/30 transition-all duration-200 active:scale-98 cursor-pointer"
                  aria-expanded={accountMenuOpen}
                >
                  <div className="w-7 h-7 rounded-full avatar-gradient text-white flex items-center justify-center text-[10px] font-black shadow-sm shrink-0">
                    {(user?.name || 'U').substring(0, 2).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-xs font-extrabold text-slate-900 truncate max-w-[100px]">
                    {user?.name}
                  </span>
                  <i className={`fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 ${accountMenuOpen ? 'rotate-180 text-[#5621bf]' : ''}`} />
                </button>

                {/* Account Dropdown Menu (Matches Dashboard profile dropdown) */}
                {accountMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white/95 backdrop-blur-xl rounded-2xl p-3 sm:p-4 shadow-2xl border border-slate-200/90 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Profile Header */}
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-full avatar-gradient text-white flex items-center justify-center text-sm font-black shadow-sm shrink-0">
                        {(user?.name || 'U').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-900 truncate">{user?.name}</p>
                        <p className="text-xs font-medium text-slate-500 truncate">{user?.email}</p>
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          user?.role === 'admin'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : isParent
                            ? 'bg-[#5621bf]/10 text-[#5621bf]'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {user?.role === 'admin' ? 'Admin Account' : isParent ? 'Parent Account' : 'Child / Teen Account'}
                        </span>
                      </div>
                    </div>

                    {/* Family Code row */}
                    {user?.family_code && (
                      <div className="py-2.5 px-3 my-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-extrabold uppercase text-slate-400">Family Code</p>
                          <p className="text-xs font-black text-[#5621bf] tracking-widest">{user?.family_code}</p>
                        </div>
                        <button onClick={handleCopyCode} className="text-xs font-bold text-slate-500 hover:text-[#5621bf] p-1 transition flex items-center gap-1 cursor-pointer">
                          <i className={copyIcon} />
                        </button>
                      </div>
                    )}

                    {/* Menu Actions */}
                    <div className="pt-1 space-y-1">
                      <Link
                        href="/dashboard"
                        onClick={() => setAccountMenuOpen(false)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#5621bf] font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
                      >
                        <span className="flex items-center gap-2">{user?.role === 'admin' ? 'Go to Admin Dashboard' : 'Go to Family Map'}</span>
                        <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
                      </Link>

                      <button
                        type="button"
                        onClick={scrollToPricing}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
                      >
                        <span className="flex items-center gap-2">Pro Membership</span>
                        <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
                      </button>

                      {!isParent && user?.family_code && (
                        <button
                          type="button"
                          onClick={handleLeaveCircle}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-600 font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
                        >
                          <span className="flex items-center gap-2">Leave Family Circle</span>
                          <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
                        </button>
                      )}

                      {isParent && user?.family_code && (
                        <button
                          type="button"
                          onClick={handleDeleteCircle}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
                        >
                          <span className="flex items-center gap-2">Disband Family Circle</span>
                          <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
                      >
                        <span className="flex items-center gap-2">Sign Out</span>
                        <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs transition-colors duration-150 group cursor-pointer"
                      >
                        <span className="flex items-center gap-2">Delete Account</span>
                        <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth"
                className="px-5 py-2.5 rounded-xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-sm shadow-md shadow-purple-500/20 hover:shadow-purple-500/30 transition-all flex items-center gap-2"
              >
                <span>Create or Join a Family</span>
              </Link>
            )}
          </div>

          {/* Hamburger Menu Button */}
          <button 
            type="button" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 border border-slate-200/80 text-slate-700 hover:text-[#5621bf] hover:border-purple-300 transition-all cursor-pointer shadow-sm active:scale-95"
            aria-label="Toggle menu"
          >
            <AnimatedHamburger isOpen={mobileMenuOpen} />
          </button>
          </header>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[1000] md:hidden flex flex-col bg-white/95 backdrop-blur-2xl animate-in fade-in slide-in-from-top-4 duration-300 pt-[60px] sm:pt-[76px]">
            {/* Main Menu Body */}
            <div className="flex-1 flex flex-col items-center justify-between px-6 pb-6 pt-4 overflow-y-auto">
              <div className="w-full max-w-xs flex flex-col items-center gap-4">
                {user ? (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-3.5 rounded-xl bg-[#5621bf] text-white font-extrabold text-base text-center shadow-lg flex items-center justify-center mb-2 transition-transform active:scale-95"
                  >
                    <span>{user?.role === 'admin' ? 'Open Dashboard' : 'Open Map'}</span>
                  </Link>
                ) : (
                  <Link
                    href="/auth"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-3.5 rounded-xl bg-[#5621bf] text-white font-extrabold text-base text-center shadow-lg flex items-center justify-center mb-2 transition-transform active:scale-95"
                  >
                    <span>Create or Join a Family</span>
                  </Link>
                )}

                {/* Main Useful App Links */}
                <div className="w-full flex flex-col items-center gap-4 py-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      scrollToPricing();
                    }} 
                    className="text-base font-extrabold text-slate-800 hover:text-[#5621bf] active:scale-95 transition-all cursor-pointer"
                  >
                    Pro Membership
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'how-it-works'}));
                    }} 
                    className="text-base font-extrabold text-slate-800 hover:text-[#5621bf] active:scale-95 transition-all cursor-pointer"
                  >
                    How It Works
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'tips'}));
                    }} 
                    className="text-base font-extrabold text-slate-800 hover:text-[#5621bf] active:scale-95 transition-all cursor-pointer"
                  >
                    Tips &amp; Tricks
                  </button>
                </div>

                {user && (
                  <div className="flex flex-col items-center gap-2.5 w-full pt-2 border-t border-slate-100">
                    {!isParent && user?.family_code && (
                      <button
                        type="button"
                        onClick={handleLeaveCircle}
                        className="text-xs font-bold text-slate-600 hover:text-[#5621bf] active:scale-95 transition-all cursor-pointer"
                      >
                        Leave Family Circle
                      </button>
                    )}
                    {isParent && user?.family_code && (
                      <button
                        type="button"
                        onClick={handleDeleteCircle}
                        className="text-xs font-bold text-slate-600 hover:text-[#5621bf] active:scale-95 transition-all cursor-pointer"
                      >
                        Disband Family Circle
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 active:scale-95 transition-all cursor-pointer"
                    >
                      Sign Out
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className="text-xs font-bold text-slate-500 hover:text-rose-600 active:scale-95 transition-all cursor-pointer"
                    >
                      Delete Account
                    </button>
                  </div>
                )}
              </div>

              {/* Separated Legal & Policy Section */}
              <div className="mt-8 pt-4 border-t border-slate-200/80 w-full max-w-xs flex flex-col items-center gap-2 text-center shrink-0">
                <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Legal &amp; Policy</p>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'privacy'}))}
                    className="hover:text-[#5621bf] transition-colors cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'terms'}))}
                    className="hover:text-[#5621bf] transition-colors cursor-pointer"
                  >
                    Terms of Service
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'safety'}))}
                    className="hover:text-[#5621bf] transition-colors cursor-pointer"
                  >
                    Privacy &amp; Safety
                  </button>
                </div>
                <p className="text-[10px] font-medium text-slate-400 mt-1">© 2026 HOMETRACKER Inc.</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Hero */}
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 my-auto flex-1 flex flex-col justify-center min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center my-auto">
            {/* Left Column */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left z-10 w-full">
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] mb-3 sm:mb-5 lg:mb-6">
                Know when <span className="text-[#5621bf]">they&apos;re home.</span>
              </h1>

              <p className="text-sm sm:text-lg lg:text-xl text-slate-600 font-medium max-w-2xl leading-relaxed mb-4 sm:mb-8">
                Create your private family circle in seconds. HOMETRACKER combines smart predictive routing so you always know{' '}
                <span className="text-slate-900 font-bold underline decoration-[#5621bf] decoration-4 underline-offset-4">
                  exactly how late the kids will be home
                </span>.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mb-2 sm:mb-8">
                {user ? (
                  <Link
                    href="/dashboard"
                    className="px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-base sm:text-lg shadow-[0_20px_40px_-15px_rgba(86,33,191,0.25)] hover:shadow-purple-500/30 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 sm:gap-3"
                  >
                    <span>{user?.role === 'admin' ? 'Open Dashboard' : 'Open Map'}</span>
                  </Link>
                ) : (
                  <Link
                    href="/auth"
                    className="px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-base sm:text-lg shadow-[0_20px_40px_-15px_rgba(86,33,191,0.25)] hover:shadow-purple-500/30 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 sm:gap-3"
                  >
                    <span>Create your family</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={scrollToPricing}
                  className="px-6 py-3.5 rounded-xl sm:rounded-2xl bg-white/90 hover:bg-white border border-slate-200 text-slate-700 font-extrabold text-base sm:text-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Pro Membership</span>
                </button>
              </div>
            </div>

            {/* Right Column */}
            <div className="hidden lg:flex lg:col-span-5 justify-center items-center">
              <Image src="/hero_preview.png" alt="HOMETRACKER Preview" width={420} height={500} className="w-full max-w-[420px] max-h-[60vh] h-auto object-contain drop-shadow-xl" />
            </div>
          </div>
        </main>
      </div>

      {/* ============================================================ */}
      {/* FULL-SCREEN PRO BETA PROGRAM SECTION                          */}
      {/* ============================================================ */}
      <section id="pricing" className="min-h-screen min-h-dvh w-full flex flex-col justify-center items-center py-10 sm:py-14 px-4 sm:px-6 relative bg-gradient-to-b from-transparent via-purple-50/40 to-slate-50 border-t border-purple-100/60 z-20">
        <div className="w-full max-w-7xl mx-auto flex flex-col items-center my-auto">
          {/* Section Title */}
          <div className="text-center max-w-3xl mb-6 sm:mb-8">
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mt-3 mb-3">
              HomeTracker Pro <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[#5621bf] to-indigo-600 bg-clip-text text-transparent">
                Membership
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium">
              We provide Pro features to selected family circles who help improve the platform. Instead of paying, Pro members contribute simple monthly feedback that shapes our product roadmap.
            </p>
          </div>

          {/* Program Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-5xl items-stretch">
            {/* Free Tier Card */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900">HomeTracker Basic</h3>
                  <span className="px-1 text-slate-700 font-extrabold text-xs">
                    Free Forever
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mb-4">
                  Essential location tracking for small families getting started with safety monitoring.
                </p>

                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900">Free</span>
                  <span className="text-sm font-bold text-slate-400"> forever</span>
                </div>

                <div className="space-y-2.5 mb-6 opacity-80">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-500 font-medium">
                    <span className="w-4 h-4 rounded-full bg-slate-300 shrink-0 flex items-center justify-center text-white text-[9px] font-black">!</span>
                    <span>Limited to 4 Family Members</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-500 font-medium">
                    <span className="w-4 h-4 rounded-full bg-slate-300 shrink-0 flex items-center justify-center text-white text-[9px] font-black">!</span>
                    <span>Only 2 Saved Locations (Cannot add more)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-500 font-medium">
                    <span className="w-4 h-4 rounded-full bg-slate-300 shrink-0 flex items-center justify-center text-white text-[9px] font-black">!</span>
                    <span>No Custom Schedules (1 Static Alert)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-500 font-medium">
                    <span className="w-4 h-4 rounded-full bg-slate-300 shrink-0 flex items-center justify-center text-white text-[9px] font-black">!</span>
                    <span>No Live Traffic or Predictive ETAs</span>
                  </div>
                </div>
              </div>

              <Link
                href={user ? "/dashboard" : "/auth"}
                className="w-full py-3.5 sm:py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-sm sm:text-base text-center transition-colors flex items-center justify-center gap-2"
              >
                <span>{user ? "Current Free Plan" : "Get Started Free"}</span>
              </Link>
            </div>

            {/* Pro Tier Card */}
            <div className={`bg-gradient-to-b from-white via-purple-50/40 to-white rounded-3xl border-2 p-5 sm:p-6 flex flex-col justify-between shadow-xl relative overflow-hidden transform lg:-translate-y-2 ${
              user && !isParent ? 'border-slate-300 bg-slate-50/50 shadow-none opacity-85' : 'border-[#5621bf] shadow-purple-500/15'
            }`}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                    HomeTracker Pro Membership
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPaymentInfoModal(true)}
                    className="w-7 h-7 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#5621bf] flex items-center justify-center transition cursor-pointer border border-purple-200/80 shadow-xs"
                    title="View Program Rules & Policy"
                  >
                    <i className="fa-solid fa-circle-info text-sm" />
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 font-medium mb-4">
                  Lifetime Pro access for selected family circles who contribute monthly product feedback &amp; usage insights.
                </p>

                <div className="p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200/80 mb-5">
                  <div className="flex items-center gap-2 text-xs font-black text-[#5621bf] uppercase tracking-wider mb-1">
                    <i className="fa-solid fa-infinity" /> Lifetime Access via Feedback
                  </div>
                  <p className="text-[11px] text-purple-900 font-semibold leading-relaxed">
                    No payment required. Approved members retain all Pro features permanently as long as they complete a quick monthly review.
                  </p>
                </div>

                <div className="space-y-2.5 mb-6">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-900 font-bold">
                    <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-black bg-[#5621bf]">✓</span>
                    <span>Up to 10 Family Members per Circle</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-900 font-bold">
                    <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-black bg-[#5621bf]">✓</span>
                    <span>Unlimited Saved Places (Friends, Sports, Work)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-900 font-bold">
                    <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-black bg-[#5621bf]">✓</span>
                    <span>Dynamic Live Traffic &amp; Predictive ETAs</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-900 font-bold">
                    <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-black bg-[#5621bf]">✓</span>
                    <span>Custom Weekend &amp; Member Curfew Schedules</span>
                  </div>
                </div>
              </div>

              {user && !isParent ? (
                <div className="w-full flex flex-col items-center gap-1.5">
                  <div className="w-full py-3.5 sm:py-4 rounded-2xl bg-slate-200 text-slate-400 font-extrabold text-xs sm:text-sm text-center border border-slate-300 cursor-not-allowed pointer-events-none select-none">
                    Only Parent Accounts Can Request Pro Access
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 text-center">
                    Child &amp; Teen profiles cannot submit Pro applications.
                  </span>
                </div>
              ) : user?.pro_status === 'approved' ? (
                <div className="w-full flex flex-col items-center gap-1.5">
                  <div className="w-full py-3.5 sm:py-4 rounded-2xl bg-purple-100 text-[#5621bf] font-extrabold text-sm sm:text-base text-center border border-purple-200 cursor-default select-none flex items-center justify-center gap-2">
                    <i className="fa-solid fa-shield-halved" /> You are a Pro Member
                  </div>
                </div>
              ) : (
                <Link
                  href={user ? "/dashboard?action=request_pro" : "/auth"}
                  className="w-full py-3.5 sm:py-4 rounded-2xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-sm sm:text-base text-center shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-[#ffffff] fa-paper-plane text-sm" />
                  <span>{user ? "Request HomeTracker Pro Access" : "Apply for Pro Membership"}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold text-slate-500 border-t border-[#e8e8e8]/60 z-20 shrink-0">
        <div>© 2026 <span className="font-extrabold text-slate-800">HOMETRACKER Inc.</span> All rights reserved.</div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'privacy'}))} className="hover:text-[#5621bf] transition-colors cursor-pointer">Privacy Policy</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'terms'}))} className="hover:text-[#5621bf] transition-colors cursor-pointer">Terms of Service</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'safety'}))} className="hover:text-[#5621bf] transition-colors cursor-pointer">Privacy &amp; Safety</button>
        </div>
      </footer>

      {/* HomeTracker Pro Membership Policy Modal */}
      {showPaymentInfoModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowPaymentInfoModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>

            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-[#5621bf] flex items-center justify-center mx-auto text-xl mb-2">
                <i className="fa-solid fa-shield-halved" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Pro Membership Rules</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                HomeTracker Pro is provided to selected users who help improve the platform. Instead of paying, Pro members contribute feedback.
              </p>
            </div>

            {/* Program Rules Summary */}
            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 space-y-2">
              <div className="flex items-center gap-2 font-black text-xs text-[#5621bf] uppercase tracking-wider">
                <i className="fa-solid fa-infinity" /> Lifetime Access Guarantee
              </div>
              <p className="text-xs text-purple-950 leading-relaxed font-semibold">
                HomeTracker Pro members receive lifetime access in exchange for helping improve the platform through monthly feedback. Approved accounts keep all features permanently unless access is revoked.
              </p>
            </div>

            {/* Rules Breakdown */}
            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-[#5621bf] flex items-center justify-center shrink-0 mt-0.5">
                  <i className="fa-solid fa-paper-plane text-xs" />
                </div>
                <div>
                  <p className="font-extrabold text-slate-900">Application &amp; Manual Review</p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Users submit a request form explaining their family setup and how HomeTracker helps them. Applications are reviewed manually by our admin team.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-[#5621bf] flex items-center justify-center shrink-0 mt-0.5">
                  <i className="fa-solid fa-comments text-xs" />
                </div>
                <div>
                  <p className="font-extrabold text-slate-900">Monthly Product Review Requirement</p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Every Pro user completes a quick monthly survey. Your map is temporarily paused when a review is due until completed.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="fa-solid fa-triangle-exclamation text-slate-600 text-sm" />
                </div>
                <div>
                  <p className="font-extrabold text-slate-900">Access &amp; Quality Guidelines</p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    All feedback submissions are reviewed. If a user repeatedly submits incomplete or fake feedback, Pro access may be revoked after notice.
                  </p>
                </div>
              </div>
            </div>

            {user?.pro_status === 'approved' ? (
              <div className="w-full py-3 rounded-2xl bg-purple-100 text-[#5621bf] font-extrabold text-xs border border-purple-200 cursor-default flex items-center justify-center gap-1.5">
                <i className="fa-solid fa-shield-halved text-xs" /> You are already a Pro Member
              </div>
            ) : (
              <Link
                href={user ? "/dashboard?action=request_pro" : "/auth"}
                onClick={() => setShowPaymentInfoModal(false)}
                className="w-full py-3 rounded-2xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-paper-plane text-xs text-white" /> {user ? "Request Pro Access in Dashboard" : "Apply for Pro Membership"}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Action Modal Dialog */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-xl ${
              modal.type === 'error' ? 'bg-rose-100 text-rose-600' :
              modal.type === 'warning' ? 'bg-purple-100 text-purple-600' :
              'bg-blue-100 text-blue-600'
            }`}>
              <i className={`fa-solid ${
                modal.type === 'error' ? 'fa-triangle-exclamation' :
                modal.type === 'warning' ? 'fa-circle-exclamation' :
                'fa-circle-check'
              }`} />
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-1">{modal.title}</h3>
            <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">{modal.message}</p>

            {modal.isPasswordPrompt && (
              <input
                type="password"
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#5621bf] mb-4"
              />
            )}

            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {modal.onConfirm && (
                <button
                  type="button"
                  onClick={() => {
                    const confirmFn = modal.onConfirm;
                    const pass = passwordInput;
                    setModal(null);
                    confirmFn(pass);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-colors shadow-md cursor-pointer ${
                    modal.type === 'error' || modal.isPasswordPrompt ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#5621bf] hover:bg-[#431799]'
                  }`}
                >
                  {modal.confirmText || 'Confirm'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

