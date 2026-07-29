'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';

// ============================================================
// Constants
// ============================================================
const AT_HOME_THRESHOLD_KM = 0.1; // 100 meters

// Helper: Get active curfew violations for a member across all locations
function getActiveCurfewViolations(memberLat, memberLng, home, extraLocations, customCurfews, isPlusCircle) {
  const violations = [];
  if (!memberLat || !memberLng) return violations;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentDay = now.getDay(); // 0-6 (Sun-Sat)

  const checkRule = (rule, locLat, locLng, locName, isHomeLoc) => {
    if (!rule || !rule.time) return;
    if (rule.days && rule.days.length > 0 && !rule.days.includes(currentDay)) return;

    const [h, m] = rule.time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return;

    const curfewMinutes = h * 60 + m;
    const windowEnd = (curfewMinutes + 4 * 60) % 1440;
    
    let inWindow = false;
    if (curfewMinutes < windowEnd) {
      inWindow = currentMinutes >= curfewMinutes && currentMinutes < windowEnd;
    } else {
      inWindow = currentMinutes >= curfewMinutes || currentMinutes < windowEnd;
    }

    if (inWindow) {
      const dist = calculateDistanceKm(memberLat, memberLng, locLat, locLng);
      if (dist > AT_HOME_THRESHOLD_KM) {
        violations.push({ locationName: locName, time: rule.time, isHome: isHomeLoc });
      }
    }
  };

  if (isPlusCircle && customCurfews && Object.keys(customCurfews).length > 0) {
    if (customCurfews['home'] && home?.home_lat) {
      customCurfews['home'].forEach(rule => checkRule(rule, home.home_lat, home.home_lng, 'Home', true));
    }
    if (extraLocations && extraLocations.length > 0) {
      extraLocations.forEach(loc => {
        if (customCurfews[loc.id] && loc.lat) {
          customCurfews[loc.id].forEach(rule => checkRule(rule, loc.lat, loc.lng, loc.name, false));
        }
      });
    }
  } else {
    if (home?.target_home_time && home?.home_lat) {
      const basicRule = { time: home.target_home_time, days: [] };
      checkRule(basicRule, home.home_lat, home.home_lng, 'Home', true);
    }
  }
  
  return violations;
}

// Helper: Get formatted text for today's curfew for a specific location
function getTodayCurfewText(locId, homeTargetTime, customCurfews, isPlusCircle) {
  if (!isPlusCircle || !customCurfews || !customCurfews[locId]) {
    if (locId === 'home') return homeTargetTime || 'Not set';
    return 'Not set';
  }
  
  const currentDay = new Date().getDay();
  const rules = customCurfews[locId];
  if (!rules || rules.length === 0) {
    if (locId === 'home') return homeTargetTime || 'Not set';
    return 'Not set';
  }
  
  // Find rule for today (or rule with no specific days assigned)
  const todayRule = rules.find(r => !r.days || r.days.length === 0 || r.days.includes(currentDay));
  if (todayRule && todayRule.time) {
    return todayRule.time;
  }
  
  return 'No curfew today';
}

// ============================================================
// Utility: Haversine distance (used for quick threshold checks)
// ============================================================
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Utility: Format Family Code with auto capslock & auto dash after HT
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

// ============================================================
// Custom Modal Component
// ============================================================
function CustomModal({ modal, onClose }) {
  const [inputValue, setInputValue] = useState('');
  const [isHoldingConfirm, setIsHoldingConfirm] = useState(false);
  const confirmTimeoutRef = useRef(null);
  
  useEffect(() => { setInputValue(''); }, [modal]);

  if (!modal) return null;
  const iconBgClass = modal.type === 'error' ? 'bg-rose-100 text-rose-600' : modal.type === 'warning' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600';
  const iconClass = modal.type === 'error' ? 'fa-circle-exclamation' : modal.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check';
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4 text-center border border-white/60 max-h-[90vh] overflow-y-auto my-auto">
        <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl ${iconBgClass}`}>
          <i className={`fa-solid ${iconClass}`} />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight">{modal.title}</h3>
          <p className="text-xs font-semibold text-slate-600 mt-1 leading-relaxed">{modal.message}</p>
          {modal.input && (
            <div className="mt-3">
              <input 
                type={modal.input.type || 'text'} 
                placeholder={modal.input.placeholder} 
                value={inputValue} 
                onChange={(e) => setInputValue(e.target.value)} 
                className="w-full py-2 px-3 text-xs font-bold rounded-lg border border-slate-300 focus:border-[#5621bf] outline-none" 
              />
            </div>
          )}
        </div>
        {modal.onConfirm ? (
          <div className="flex gap-2 mt-2">
            <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition active:scale-95 cursor-pointer">
              Cancel
            </button>
            {modal.requireHold ? (
              <button 
                onPointerDown={() => {
                  setIsHoldingConfirm(true);
                  confirmTimeoutRef.current = setTimeout(() => {
                    setIsHoldingConfirm(false);
                    if (modal.onConfirm) {
                      modal.onConfirm(inputValue);
                      onClose();
                    }
                  }, 2000);
                }}
                onPointerUp={() => {
                  setIsHoldingConfirm(false);
                  clearTimeout(confirmTimeoutRef.current);
                }}
                onPointerLeave={() => {
                  setIsHoldingConfirm(false);
                  clearTimeout(confirmTimeoutRef.current);
                }}
                className="flex-1 py-2.5 bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer relative overflow-hidden select-none"
              >
                <div className={`absolute left-0 top-0 h-full bg-rose-800/30 transition-all ease-linear ${isHoldingConfirm ? 'w-full duration-[2000ms]' : 'w-0 duration-200'}`} />
                <span className="relative z-10">{isHoldingConfirm ? 'Hold to confirm...' : (modal.confirmText || 'Confirm')}</span>
              </button>
            ) : (
              <button onClick={() => { modal.onConfirm(inputValue); onClose(); }} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer">
                {modal.confirmText || 'Confirm'}
              </button>
            )}
          </div>
        ) : (
          <button onClick={onClose} className="w-full py-2.5 bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer">
            Got it
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Wave Background (static — no animation for performance)
// ============================================================
function WaveBackground() {
  return (
    <div className="wave-bg-container">
      <svg className="animated-wave animated-wave-1" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M-200,300 C200,100 500,500 900,200 C1300,-100 1600,400 2000,150 L2000,900 L-200,900 Z" fill="url(#wgd1)" />
        <defs><linearGradient id="wgd1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e2f0ff" stopOpacity="0.8" /><stop offset="50%" stopColor="#d8c5ff" stopOpacity="0.4" /><stop offset="100%" stopColor="#5621bf" stopOpacity="0.18" /></linearGradient></defs>
      </svg>
      <svg className="animated-wave animated-wave-2" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M-200,200 C300,400 600,100 1100,350 C1500,500 1800,200 2100,450 L2100,900 L-200,900 Z" fill="url(#wgd2)" />
        <defs><linearGradient id="wgd2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#5621bf" stopOpacity="0.22" /><stop offset="60%" stopColor="#e2f0ff" stopOpacity="0.6" /><stop offset="100%" stopColor="#fdfdfd" stopOpacity="0.1" /></linearGradient></defs>
      </svg>
    </div>
  );
}

// ============================================================
// Address Input with Autocomplete / Recommendations
// ============================================================
function AddressInputWithAutocomplete({ value, onChange, placeholder, className }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    onChange(newVal);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (newVal.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newVal.trim())}&limit=5`,
          { headers: { 'User-Agent': 'HOMETRACKER/1.0' } }
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSuggestions(data);
          setShowDropdown(true);
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
      } catch (err) {
        console.warn('Autocomplete fetch error:', err);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleSelectSuggestion = (displayName) => {
    onChange(displayName);
    setSuggestions([]);
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
        placeholder={placeholder}
        className={className}
      />
      {loading && (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
          <i className="fa-solid fa-spinner animate-spin" />
        </div>
      )}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[999] overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSuggestion(item.display_name)}
              className="w-full text-left px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-purple-50 hover:text-[#5621bf] border-b border-slate-100 last:border-b-0 transition-colors flex items-start gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-location-dot text-slate-400 text-xs mt-0.5 shrink-0" />
              <span className="truncate">{item.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Dashboard Page
// ============================================================
export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [home, setHome] = useState(null);
  const [members, setMembers] = useState([]);
  const [modal, setModal] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [copyIcon, setCopyIcon] = useState('fa-regular fa-copy');

  // ETA cache: { memberId: { distance_km, duration_min, timestamp } }
  const [etaCache, setEtaCache] = useState({});

  // Form state
  const [homeAddress, setHomeAddress] = useState('');
  const [targetTime, setTargetTime] = useState('');

  // Extra Locations state
  const [extraLocations, setExtraLocations] = useState([]);
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');

  // Subscription & Pro Beta Program State
  const [subscription, setSubscription] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPaymentInfoModal, setShowPaymentInfoModal] = useState(false);

  // Pro Beta Application Modal State
  const [showProRequestModal, setShowProRequestModal] = useState(false);
  const [proReqFamilySize, setProReqFamilySize] = useState(4);
  const [proReqWhyPro, setProReqWhyPro] = useState('');
  const [proReqProblems, setProReqProblems] = useState('');
  const [proReqFeatures, setProReqFeatures] = useState('');
  const [submittingProReq, setSubmittingProReq] = useState(false);

  // Monthly Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [fbTimesUsed, setFbTimesUsed] = useState('10-25 times');
  const [fbMembersUsed, setFbMembersUsed] = useState(4);
  const [fbSituations, setFbSituations] = useState('');
  const [fbWorkedWell, setFbWorkedWell] = useState('');
  const [fbProblems, setFbProblems] = useState('');
  const [fbImprovement, setFbImprovement] = useState('');
  const [fbRecScore, setFbRecScore] = useState(10);
  const [submittingFb, setSubmittingFb] = useState(false);
  const [sendingSurveyRemind, setSendingSurveyRemind] = useState(false);
  const [surveyRemindSent, setSurveyRemindSent] = useState(false);
  const [sendingUpgradeRemind, setSendingUpgradeRemind] = useState(false);
  const [upgradeRemindSent, setUpgradeRemindSent] = useState(false);

  // Admin Management Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTab, setAdminTab] = useState('stats'); // 'stats' | 'requests' | 'users' | 'feedback'
  const [adminStats, setAdminStats] = useState(null);
  const [adminRequests, setAdminRequests] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminFeedbackList, setAdminFeedbackList] = useState([]);
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [adminSettings, setAdminSettings] = useState({});
  const [savingAdminSettings, setSavingAdminSettings] = useState(false);
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [collapsedRequests, setCollapsedRequests] = useState(false);
  const [collapsedFeedback, setCollapsedFeedback] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState(null);

  // Handle URL action parameter (e.g. ?action=request_pro)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'request_pro') {
        if (!subscription?.is_plus && user?.role === 'parent') {
          setShowProRequestModal(true);
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [subscription, user]);

  // Editing location state
  const [editingLocId, setEditingLocId] = useState(null); // 'home' or location id
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editTargetTime, setEditTargetTime] = useState('');
  const [editCustomCurfews, setEditCustomCurfews] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [notifications, setNotifications] = useState([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const unreadNotifications = notifications.filter(n => n.is_read === 0);
  
  const [joinCode, setJoinCode] = useState('');

  // Map & Profile refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const routeLinesRef = useRef([]);

  const profileMenuRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const notificationMenuRef = useRef(null);
  const notificationDropdownRef = useRef(null);
  const settingsContentRef = useRef(null);
  const toastRef = useRef(null);

  // Hover Animation Helpers
  const hoverScaleIn = (e) => gsap.to(e.currentTarget, { scale: 1.03, duration: 0.2, ease: 'power1.out' });
  const hoverScaleOut = (e) => gsap.to(e.currentTarget, { scale: 1, duration: 0.2, ease: 'power1.out' });

  // GPS
  const watchIdRef = useRef(null);
  const liveGPSRef = useRef({ lat: null, lng: null });

  // Menus click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target)) {
        setShowNotificationsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Lock body scroll when any modal is open
  const isAnyModalOpen = Boolean(
    modal ||
      showProRequestModal ||
      showSettings ||
      showTip ||
      showFeedbackModal ||
      showAdminModal ||
      showPaymentInfoModal ||
      (subscription?.is_plus && subscription?.feedback_due && !user?.is_deactivated && !subscription?.user_is_deactivated) ||
      (user?.is_deactivated || subscription?.user_is_deactivated)
  );

  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);

  // Settings Accordion Animation
  useEffect(() => {
    if (settingsContentRef.current) {
      if (showSettings) {
        gsap.to(settingsContentRef.current, { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' });
      } else {
        gsap.to(settingsContentRef.current, { height: 0, opacity: 0, duration: 0.3, ease: 'power2.out' });
      }
    }
  }, [showSettings]);

  // GSAP Animations for Dropdowns
  useEffect(() => {
    if (profileDropdownRef.current) {
      if (showProfileMenu) {
        gsap.to(profileDropdownRef.current, { autoAlpha: 1, scale: 1, y: 0, duration: 0.2, ease: "power2.out", display: "block" });
      } else {
        gsap.to(profileDropdownRef.current, { autoAlpha: 0, scale: 0.95, y: -10, duration: 0.2, ease: "power2.in", display: "none" });
      }
    }
  }, [showProfileMenu]);

  useEffect(() => {
    if (notificationDropdownRef.current) {
      if (showNotificationsMenu) {
        gsap.to(notificationDropdownRef.current, { autoAlpha: 1, scale: 1, y: 0, duration: 0.2, ease: "power2.out", display: "flex" });
      } else {
        gsap.to(notificationDropdownRef.current, { autoAlpha: 0, scale: 0.95, y: -10, duration: 0.2, ease: "power2.in", display: "none" });
      }
    }
  }, [showNotificationsMenu]);

  useEffect(() => {
    if (toastRef.current) {
      if (unreadNotifications.length > 0) {
        gsap.to(toastRef.current, { y: 0, autoAlpha: 1, duration: 0.5, ease: "bounce.out", display: 'flex' });
      } else {
        gsap.to(toastRef.current, { y: -50, autoAlpha: 0, duration: 0.3, ease: "power2.in", display: 'none' });
      }
    }
  }, [unreadNotifications.length]);
  // Force open settings if home is not set
  useEffect(() => {
    if (user?.role === 'parent' && home && !home.home_address) {
      setShowSettings(true);
    }
  }, [user, home]);

  // ---- Auth Check ----
  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          window.location.href = '/auth';
          return;
        }
        
        if (data.maintenanceMode && data.user?.role !== 'admin') {
          setIsMaintenanceMode(true);
        }

        setUser(data.user);
        setLoading(false);

        // Show tip once per account for children
        if (data.user.role === 'child') {
          const dismissed = localStorage.getItem('ht_tip_dismissed_' + data.user.id);
          if (!dismissed) setShowTip(true);
        }
      })
      .catch(() => {
        window.location.href = '/auth';
      });
  }, []);

  // ---- Fetch OSRM ETA for a member ----
  const fetchEta = useCallback(async (memberId, memberLat, memberLng, homeLat, homeLng) => {
    // Check cache — reuse if less than 30s old
    const cached = etaCache[memberId];
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached;
    }

    try {
      const res = await fetch(`/api/directions?olat=${memberLat}&olng=${memberLng}&dlat=${homeLat}&dlng=${homeLng}`);
      const data = await res.json();
      const entry = { distance_km: data.distance_km, duration_min: data.duration_min, geometry: data.geometry, timestamp: Date.now() };
      setEtaCache((prev) => ({ ...prev, [memberId]: entry }));
      return entry;
    } catch (e) {
      console.warn('ETA fetch failed:', e);
      return null;
    }
  }, [etaCache]);

  // ---- Refresh Data ----
  const refreshData = useCallback(async () => {
    if (!user) return;

    try {
      // First, trigger server-side notification evaluation for all child members.
      await fetch('/api/notifications/check').catch(() => {});

      const [homeRes, membersRes, notifRes, locRes, subRes] = await Promise.all([
        fetch('/api/circle/home').then((r) => r.json()),
        fetch('/api/circle/members').then((r) => r.json()),
        fetch('/api/notifications').then((r) => r.json()),
        fetch('/api/circle/locations').then((r) => r.json()),
        fetch('/api/circle/subscription').then((r) => r.json()).catch(() => ({ subscription_tier: 'basic' })),
      ]);

      if (homeRes.home) setHome(homeRes.home);
      if (membersRes.members) setMembers(membersRes.members);
      if (notifRes.notifications) setNotifications(notifRes.notifications);
      if (locRes.locations) setExtraLocations(locRes.locations);
      
      if (subRes && !subRes.error) {
        setSubscription(subRes);
        
        // Downgrade cleanup check
        const isPlus = subRes.is_plus || user?.pro_status === 'approved' || 
                       (subRes.subscription_tier && subRes.subscription_tier.toLowerCase() !== 'basic' && subRes.subscription_tier.toLowerCase() !== 'free');
                       
        const hasExtraLocs = locRes.locations && locRes.locations.length > 1;
        const hasCustomCurfews = subRes.custom_curfews && Object.keys(subRes.custom_curfews).length > 0;
        
        if (!isPlus && (hasExtraLocs || hasCustomCurfews)) {
           fetch('/api/circle/downgrade-cleanup', { method: 'POST' }).then(() => {
             Promise.all([
               fetch('/api/circle/locations').then(r => r.json()),
               fetch('/api/circle/subscription').then(r => r.json()).catch(() => ({ subscription_tier: 'basic' }))
             ]).then(([newLoc, newSub]) => {
               if (newLoc.locations) setExtraLocations(newLoc.locations);
               if (newSub && !newSub.error) setSubscription(newSub);
             });
           }).catch(console.error);
        }
      }
    } catch (e) {
      console.error('Refresh error:', e);
    }
  }, [user]);

  // ---- Fetch Subscription, Home, Members & Locations on User Ready ----
  useEffect(() => {
    if (user) {
      refreshData();
      const interval = setInterval(refreshData, 15000);
      return () => clearInterval(interval);
    }
  }, [user, refreshData]);

  // ---- Submit Pro Beta Request ----
  const handleSubmitProRequest = async (e) => {
    e?.preventDefault();
    if (user?.role !== 'parent') {
      setModal({ type: 'warning', title: 'Parent Account Required', message: 'Only parent accounts can apply for HomeTracker Pro access.' });
      return;
    }

    if (!proReqWhyPro.trim() || !proReqProblems.trim() || !proReqFeatures.trim()) {
      setModal({ type: 'error', title: 'Incomplete Form', message: 'Please answer all required questions in the application form.' });
      return;
    }

    setSubmittingProReq(true);
    try {
      const res = await fetch('/api/circle/subscription/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family_size: proReqFamilySize,
          why_pro: proReqWhyPro,
          problems_to_solve: proReqProblems,
          valuable_features: proReqFeatures,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowProRequestModal(false);
        setModal({
          type: 'success',
          title: 'Application Submitted!',
          message: 'Your HomeTracker Pro application has been submitted for admin review. You will be notified once reviewed.',
        });
        await refreshData();
      } else {
        setModal({ type: 'error', title: 'Submission Failed', message: data.error || 'Failed to submit application.' });
      }
    } catch (err) {
      setModal({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSubmittingProReq(false);
    }
  };

  // ---- Submit Monthly Pro Feedback ----
  const handleSubmitFeedback = async (e) => {
    e?.preventDefault();
    if (!fbSituations.trim() || !fbWorkedWell.trim() || !fbProblems.trim() || !fbImprovement.trim()) {
      setModal({ type: 'error', title: 'Incomplete Form', message: 'Please share what worked well, what could be improved, and other details requested.' });
      return;
    }

    setSubmittingFb(true);
    try {
      const res = await fetch('/api/circle/subscription/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          times_used: fbTimesUsed,
          members_used: fbMembersUsed,
          usage_situations: fbSituations,
          worked_well: fbWorkedWell,
          problems_encountered: fbProblems,
          features_to_improve: fbImprovement,
          recommendation_score: fbRecScore,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowFeedbackModal(false);
        setModal({
          type: 'success',
          title: 'Feedback Submitted!',
          message: 'Thank you for your monthly feedback! Your active feedback helps maintain your lifetime Pro access.',
        });
        await refreshData();
      } else {
        setModal({ type: 'error', title: 'Submission Error', message: data.error || 'Failed to submit feedback.' });
      }
    } catch (err) {
      setModal({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSubmittingFb(false);
    }
  };

  // ---- Admin Panel Data Fetching ----
  const fetchAdminData = useCallback(async (tab = adminTab, query = adminUserSearch) => {
    if (user?.role !== 'admin') return;
    setLoadingAdminData(true);
    try {
      if (tab === 'stats') {
        const [statsData, settingsData] = await Promise.all([
          fetch('/api/admin/stats').then((r) => r.ok ? r.json() : {}).catch(() => ({})),
          fetch('/api/admin/settings').then((r) => r.ok ? r.json() : {}).catch(() => ({}))
        ]);
        
        if (statsData.stats) setAdminStats(statsData.stats);
        if (settingsData.settings) setAdminSettings(settingsData.settings);
      } else if (tab === 'requests') {
        const res = await fetch('/api/admin/requests').then((r) => r.json());
        if (res.requests) setAdminRequests(res.requests);
      } else if (tab === 'users') {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`).then((r) => r.json());
        if (res.users) setAdminUsers(res.users);
      } else if (tab === 'feedback') {
        const res = await fetch('/api/admin/feedback').then((r) => r.json());
        if (res.feedback) setAdminFeedbackList(res.feedback);
      }
    } catch (err) {
      console.error('Admin data fetch error:', err);
    } finally {
      setLoadingAdminData(false);
    }
  }, [user, adminTab, adminUserSearch]);

  const handleAdminActionRequest = async (requestId, action) => {
    try {
      const res = await fetch('/api/admin/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action, notes: adminNoteInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminNoteInput('');
        setModal({ type: 'success', title: 'Action Completed', message: data.message });
        await fetchAdminData('requests');
        await fetchAdminData('stats');
        await refreshData();
      } else {
        setModal({ type: 'error', title: 'Action Failed', message: data.error });
      }
    } catch (err) {
      setModal({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleUpdateSurveyInterval = async (intervalMode) => {
    setSavingAdminSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting_key: 'survey_interval_mode', setting_value: intervalMode }),
      });
      if (res.ok) {
        setAdminSettings(prev => ({ ...prev, survey_interval_mode: intervalMode }));
        setModal({ type: 'success', title: 'Settings Updated', message: 'Survey interval updated successfully.' });
      } else {
        setModal({ type: 'error', title: 'Error', message: 'Failed to update settings.' });
      }
    } catch (err) {
      setModal({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSavingAdminSettings(false);
    }
  };

  const handleToggleMaintenanceMode = async (enable) => {
    setSavingAdminSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting_key: 'maintenance_mode', setting_value: enable ? 'true' : 'false' }),
      });
      if (res.ok) {
        setAdminSettings(prev => ({ ...prev, maintenance_mode: enable ? 'true' : 'false' }));
        setModal({ type: 'success', title: 'Maintenance Mode Updated', message: `Maintenance mode has been ${enable ? 'enabled' : 'disabled'}.` });
      } else {
        setModal({ type: 'error', title: 'Error', message: 'Failed to update maintenance mode.' });
      }
    } catch (err) {
      setModal({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSavingAdminSettings(false);
    }
  };

  const handleForceSurvey = async () => {
    setModal({
      type: 'warning',
      title: 'Force Monthly Survey',
      message: 'This will reset the survey history, immediately forcing all active Pro users to submit a new survey. Are you sure?',
      confirmText: 'Yes, Force Now',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/force-survey', { method: 'POST' });
          const data = await res.json();
          if (res.ok) {
            setModal({ type: 'success', title: 'Surveys Forced', message: data.message });
          } else {
            setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to force surveys.' });
          }
        } catch (err) {
          setModal({ type: 'error', title: 'Error', message: err.message });
        }
      }
    });
  };

  const handleClearAllProRequests = async () => {
    try {
      const res = await fetch('/api/admin/requests', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setModal({ type: 'success', title: 'Applications Cleared', message: data.message });
        await fetchAdminData('requests');
        await fetchAdminData('stats');
      } else {
        setModal({ type: 'error', title: 'Action Failed', message: data.error });
      }
    } catch (err) {
      setModal({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleClearAllFeedback = async () => {
    try {
      const res = await fetch('/api/admin/feedback', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setModal({ type: 'success', title: 'Reviews Cleared', message: data.message });
        await fetchAdminData('feedback');
        await fetchAdminData('stats');
      } else {
        setModal({ type: 'error', title: 'Action Failed', message: data.error });
      }
    } catch (err) {
      setModal({ type: 'error', title: 'Error', message: err.message });
    }
  };



  const handleRemindParentSurvey = async () => {
    try {
      setSendingSurveyRemind(true);
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remind_parent_survey' }),
      });
      const data = await res.json();
      setSendingSurveyRemind(false);
      if (res.ok) {
        setSurveyRemindSent(true);
        setTimeout(() => setSurveyRemindSent(false), 5000);
      } else {
        setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to send reminder.' });
      }
    } catch (err) {
      setSendingSurveyRemind(false);
      setModal({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleRemindParentUpgrade = async () => {
    try {
      setSendingUpgradeRemind(true);
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remind_parent_upgrade' }),
      });
      const data = await res.json();
      setSendingUpgradeRemind(false);
      if (res.ok) {
        setUpgradeRemindSent(true);
        setTimeout(() => setUpgradeRemindSent(false), 5000);
      } else {
        setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to send reminder.' });
      }
    } catch (err) {
      setSendingUpgradeRemind(false);
      setModal({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleAdminUserAction = async (userId, action) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action, reason: adminNoteInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminNoteInput('');
        setModal({ type: 'success', title: 'User Updated', message: data.message });
        await fetchAdminData('users');
        await fetchAdminData('stats');
        await refreshData();
      } else {
        setModal({ type: 'error', title: 'Action Failed', message: data.error });
      }
    } catch (err) {
      setModal({ type: 'error', title: 'Error', message: err.message });
    }
  };

  // ---- Fetch ETAs when members/home change ----
  useEffect(() => {
    if (!home?.home_lat || members.length === 0) return;

    members.forEach((member) => {
      if (member.role === 'child' && member.current_lat && member.current_lng) {
        const dist = calculateDistanceKm(member.current_lat, member.current_lng, home.home_lat, home.home_lng);
        // Only fetch ETA if not "at home"
        if (dist > AT_HOME_THRESHOLD_KM) {
          fetchEta(member.id, member.current_lat, member.current_lng, home.home_lat, home.home_lng);
        }
      }
    });
  }, [members, home, fetchEta]);

  // ---- Init Map & Data ----
  useEffect(() => {
    if (!user || loading) return;

    // Load Leaflet CSS + JS dynamically
    const loadLeaflet = async () => {
      if (window.L) return;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    };

    const init = async () => {
      await refreshData();
      await loadLeaflet();

      if (!mapInstanceRef.current && mapRef.current && window.L) {
        const L = window.L;
        const map = L.map(mapRef.current, { zoomControl: false }).setView([51.5074, -0.1278], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        mapInstanceRef.current = map;
      }

      // Request location permission for everyone
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(() => { }, () => { });
      }

      // Start location watch for children
      if (user.role === 'child' && navigator.geolocation) {
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = navigator.geolocation.watchPosition(
          async (pos) => {
            liveGPSRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            try {
              await fetch('/api/location/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              });
            } catch (e) {
              console.warn('Location push error:', e);
            }
          },
          (err) => console.warn('Geo error:', err),
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
        );
      }
    };

    init();

    // Poll every 5 seconds
    const interval = setInterval(refreshData, 5000);
    return () => {
      clearInterval(interval);
      if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current);
    };
  }, [user, loading, refreshData]);

  // ---- Update Map Markers ----
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;

    const L = window.L;

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};
    routeLinesRef.current.forEach((l) => map.removeLayer(l));
    routeLinesRef.current = [];

    const bounds = [];

    // Home marker
    if (home?.home_lat) {
      const homeIcon = L.divIcon({
        className: 'custom-pin-wrap',
        html: '<div class="custom-map-pin pin-home w-9 h-9"><i class="fa-solid fa-house text-base"></i></div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const marker = L.marker([home.home_lat, home.home_lng], { icon: homeIcon })
        .bindPopup(`<div class="p-1 font-bold text-center"><p class="text-xs text-purple-900"><i class="fa-solid fa-house text-sm"></i> Home</p><p class="text-[10px] text-slate-500">${home.home_address || 'Home'}</p></div>`)
        .addTo(map);
      markersRef.current.home = marker;
      bounds.push([home.home_lat, home.home_lng]);
    }

    // Extra locations markers
    extraLocations.forEach((loc) => {
      if (loc.lat && loc.lng) {
        const extraIcon = L.divIcon({
          className: 'custom-pin-wrap',
          html: '<div class="custom-map-pin pin-extra w-9 h-9"><i class="fa-solid fa-location-dot text-base"></i></div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const marker = L.marker([loc.lat, loc.lng], { icon: extraIcon })
          .bindPopup(`<div class="p-1 font-bold text-center"><p class="text-xs text-teal-800"><i class="fa-solid fa-location-dot text-sm"></i> ${loc.name}</p><p class="text-[10px] text-slate-500">${loc.address}</p></div>`)
          .addTo(map);
        markersRef.current[`loc_${loc.id}`] = marker;
        bounds.push([loc.lat, loc.lng]);
      }
    });

    // Member markers (children only)
    members.forEach((member) => {
      if (member.role === 'child' && member.current_lat && member.current_lng) {
        const initials = (member.name || 'C').substring(0, 2).toUpperCase();
        const distKm = home?.home_lat ? calculateDistanceKm(member.current_lat, member.current_lng, home.home_lat, home.home_lng) : 999;
        const isAtHome = distKm <= AT_HOME_THRESHOLD_KM;
        const isPlusCircleMap = subscription?.is_plus || user?.pro_status === 'approved' || (subscription?.subscription_tier && subscription?.subscription_tier.toLowerCase() !== 'basic' && subscription?.subscription_tier.toLowerCase() !== 'free');
        const violations = getActiveCurfewViolations(member.current_lat, member.current_lng, home, extraLocations, subscription?.custom_curfews, isPlusCircleMap);
        const isPastCurfew = violations.length > 0;

        const memberIcon = L.divIcon({
          className: 'custom-pin-wrap',
          html: `<div class="custom-map-pin ${isAtHome ? 'pin-home' : isPastCurfew ? 'pin-curfew' : 'pin-member'} w-9 h-9"><span class="text-xs">${initials}</span></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const eta = etaCache[member.id];
        const extraLoc = extraLocations.find(
          (loc) => loc.lat && loc.lng && calculateDistanceKm(member.current_lat, member.current_lng, loc.lat, loc.lng) <= AT_HOME_THRESHOLD_KM
        );

        let popupText;
        if (distKm < 0.1) {
          popupText = `<div class="p-1 text-center font-bold"><p class="text-xs text-slate-900">${member.name}</p><p class="text-[10px] text-[#5621bf] mt-1 font-extrabold">At Home</p></div>`;
        } else if (extraLoc) {
          popupText = `<div class="p-1 text-center font-bold"><p class="text-xs text-slate-900">${member.name}</p><p class="text-[10px] text-[#5621bf] mt-1 font-extrabold">📍 At ${extraLoc.name}</p>${eta ? `<p class="text-[9px] text-slate-500 mt-0.5">${eta.distance_km} km from Home &middot; ~${eta.duration_min} min</p>` : `<p class="text-[9px] text-slate-500 mt-0.5">${distKm.toFixed(1)} km from Home</p>`}</div>`;
        } else if (isPastCurfew) {
          const v = violations[0];
          popupText = `<div class="p-1 text-center font-bold"><p class="text-xs text-slate-900">${member.name}</p><p class="text-[10px] text-rose-600 mt-1 font-black">⚠️ Past Curfew (${v.locationName} @ ${v.time})</p>${eta ? `<p class="text-[9px] text-slate-500 mt-0.5">${eta.distance_km} km &middot; ~${eta.duration_min} min</p>` : ''}</div>`;
        } else if (eta) {
          popupText = `<div class="p-1 text-center font-bold"><p class="text-xs text-slate-900">${member.name}</p><p class="text-[10px] text-[#5621bf] mt-1">${eta.distance_km} km &middot; ~${eta.duration_min} min by bike</p></div>`;
        } else {
          popupText = `<div class="p-1 text-center font-bold"><p class="text-xs text-slate-900">${member.name}</p><p class="text-[10px] text-slate-400 mt-1">${distKm.toFixed(1)} km away</p></div>`;
        }

        const marker = L.marker([member.current_lat, member.current_lng], { icon: memberIcon })
          .bindPopup(popupText)
          .addTo(map);
        markersRef.current[member.id] = marker;
        bounds.push([member.current_lat, member.current_lng]);

        if (home?.home_lat && !isAtHome) {
          let line;
          if (eta?.geometry && Array.isArray(eta.geometry) && eta.geometry.length > 0) {
            const latLngs = eta.geometry.map((pt) => [pt[1], pt[0]]);
            line = L.polyline(latLngs, {
              color: '#5621bf', weight: 4, opacity: 0.8,
            }).addTo(map);
          } else {
            line = L.polyline([[member.current_lat, member.current_lng], [home.home_lat, home.home_lng]], {
              color: '#3b82f6', weight: 3, dashArray: '5, 8', opacity: 0.7,
            }).addTo(map);
          }
          routeLinesRef.current.push(line);
        }
      }
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [50, 50] });
    else if (bounds.length === 1) map.setView(bounds[0], 14);
  }, [home, members, extraLocations, etaCache, subscription, user]);

  // ---- Actions ----
  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/auth';
  };



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
      navigator.clipboard.writeText(inviteLink);
      setCopyIcon('fa-solid fa-check text-[#5621bf]');
      setTimeout(() => setCopyIcon('fa-regular fa-copy'), 2000);
    } else {
      fallbackCopyTextToClipboard(code);
      setCopyIcon('fa-solid fa-check text-[#5621bf]');
      setTimeout(() => setCopyIcon('fa-regular fa-copy'), 2000);
    }
  };

  const handleLeaveCircle = () => {
    setModal({
      type: 'error',
      title: 'Leave Family Circle?',
      message: 'Are you sure you want to leave? Your account will NOT be deleted, but you will need a new family code to join again.',
      confirmText: 'Leave Circle',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/circle/member/leave', { method: 'POST' });
          if (res.ok) {
            setUser(prev => ({...prev, family_code: ''}));
            setHome(null);
            setMembers([]);
            setModal({ type: 'success', title: 'Left Circle', message: 'You have left the family circle.' });
          } else setModal({ type: 'error', title: 'Error', message: 'Failed to leave circle.' });
        } catch(e) {
          setModal({ type: 'error', title: 'Error', message: 'Failed to leave circle.' });
        }
      }
    });
  };

  const handleKickMember = (member) => {
    setModal({
      type: 'warning',
      title: 'Kick Member?',
      message: `Are you sure you want to remove ${member.name} from the family circle? Their account will NOT be deleted, but they will be removed from this circle.`,
      confirmText: 'Kick Member',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/circle/member/kick', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: member.id })
          });
          if (res.ok) await refreshData();
          else setModal({ type: 'error', title: 'Error', message: 'Failed to kick member.' });
        } catch(e) {
          setModal({ type: 'error', title: 'Error', message: 'Failed to kick member.' });
        }
      }
    });
  };

  const handleDeleteCircle = () => {
    setModal({
      type: 'error',
      title: 'Delete Family Circle?',
      message: 'This will remove ALL members, clear your home base, and generate a new family code. This action cannot be undone.',
      confirmText: 'Delete Everything',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/circle/delete', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            setUser(prev => ({...prev, family_code: data.new_family_code}));
            setHome(null);
            setMembers([]);
            setModal({ type: 'success', title: 'Circle Deleted', message: 'Your family circle has been disbanded and you have a new family code.' });
          } else setModal({ type: 'error', title: 'Error', message: 'Failed to delete circle.' });
        } catch(e) {
          setModal({ type: 'error', title: 'Error', message: 'Failed to delete circle.' });
        }
      }
    });
  };

  const handleSaveSettings = async () => {
    if (!homeAddress.trim() || !targetTime) {
      setModal({ type: 'warning', title: 'Incomplete', message: 'Please enter both an address and a curfew time.' });
      return;
    }
    try {
      const res = await fetch('/api/circle/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_address: homeAddress.trim(), target_home_time: targetTime }),
      });
      
      // Attempt to read JSON, fallback if empty response
      let data;
      try { data = await res.json(); } catch(e) { data = {}; }
      
      if (res.ok) {
        setModal({ type: 'success', title: 'Settings Saved', message: 'Family settings updated successfully.' });
        setShowSettings(false);
        await refreshData();
      } else {
        setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to save settings.' });
      }
    } catch (e) {
      setModal({ type: 'error', title: 'Error', message: e.message });
    }
  };

  const handleAddLocation = async () => {
    if (!newLocName.trim() || !newLocAddress.trim()) {
      setModal({ type: 'warning', title: 'Incomplete', message: 'Please enter both a location name and address.' });
      return;
    }

    const totalSavedCount = (homeIsSet ? 1 : 0) + extraLocations.length;
    const isPlusCircle = subscription?.is_plus || user?.pro_status === 'approved' || (subscription?.subscription_tier && subscription?.subscription_tier.toLowerCase() !== 'basic' && subscription?.subscription_tier.toLowerCase() !== 'free');
    const maxAllowed = isPlusCircle ? 50 : 2;
    if (totalSavedCount >= maxAllowed) {
      setModal({
        type: 'warning',
        title: isPlusCircle ? 'Limit Reached' : 'Location Limit Reached (Free Tier)',
        message: isPlusCircle
          ? `Maximum of ${maxAllowed} locations reached.`
          : 'Free Tier circles can save up to 2 places (Home Base + 1 Saved Location). Upgrade to HomeTracker Plus for unlimited saved places!',
        confirmText: isPlusCircle ? undefined : 'Upgrade to Plus',
        onConfirm: isPlusCircle ? undefined : () => setShowUpgradeModal(true),
      });
      return;
    }

    try {
      const res = await fetch('/api/circle/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLocName.trim(), address: newLocAddress.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        setModal({ type: 'success', title: 'Location Added', message: `Added "${newLocName.trim()}" to saved locations.` });
        setNewLocName('');
        setNewLocAddress('');
        await refreshData();
      } else {
        if (data.error && data.error.includes('Limit')) {
          setModal({
            type: 'warning',
            title: 'Location Limit Reached',
            message: data.error,
            confirmText: 'Upgrade to Plus',
            onConfirm: () => setShowUpgradeModal(true),
          });
        } else {
          setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to add location.' });
        }
      }
    } catch (e) {
      setModal({ type: 'error', title: 'Error', message: e.message });
    }
  };

  const handleDeleteLocation = (loc) => {
    setModal({
      type: 'warning',
      title: 'Remove Location?',
      message: `Are you sure you want to remove "${loc.name}"?`,
      confirmText: 'Remove Location',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/circle/locations', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: loc.id }),
          });
          if (res.ok) {
            await refreshData();
          } else {
            setModal({ type: 'error', title: 'Error', message: 'Failed to remove location.' });
          }
        } catch (e) {
          setModal({ type: 'error', title: 'Error', message: e.message });
        }
      },
    });
  };

  const flyToLocation = (lat, lng, markerKey) => {
    if (lat && lng && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 15, { duration: 1 });
      if (markerKey && markersRef.current[markerKey]) {
        markersRef.current[markerKey].openPopup();
      }
    }
  };

  const startEditLocation = (locId, currentName, currentAddress, currentCurfew) => {
    setEditingLocId(locId);
    setEditName(currentName || '');
    setEditAddress(currentAddress || '');
    setEditTargetTime(currentCurfew || home?.target_home_time || '20:00');
    setEditCustomCurfews(subscription?.custom_curfews?.[locId] || []);
  };

  const handleSaveLocationEdit = async (locId) => {
    if (!editAddress.trim()) {
      setModal({ type: 'warning', title: 'Incomplete', message: 'Address cannot be empty.' });
      return;
    }

    try {
      if (locId === 'home') {
        const res = await fetch('/api/circle/home', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            home_address: editAddress.trim(),
            target_home_time: editTargetTime || '20:00',
          }),
        });
        if (res.ok) {
          // If Pro user, also save custom curfews
          if (isPlusCircle) {
            const updatedCurfews = { ...(subscription?.custom_curfews || {}) };
            updatedCurfews['home'] = editCustomCurfews;
            await fetch('/api/circle/curfews', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ custom_curfews: updatedCurfews }),
            });
          }
          setEditingLocId(null);
          setModal({ type: 'success', title: 'Home Base Updated', message: 'Home address and curfew time updated successfully.' });
          await refreshData();
        } else {
          setModal({ type: 'error', title: 'Error', message: 'Failed to update Home Base.' });
        }
      } else {
        if (!editName.trim()) {
          setModal({ type: 'warning', title: 'Incomplete', message: 'Location name cannot be empty.' });
          return;
        }
        const res = await fetch('/api/circle/locations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: locId, name: editName.trim(), address: editAddress.trim() }),
        });
        if (res.ok) {
          // If Pro user, also save custom curfews
          if (isPlusCircle) {
            const updatedCurfews = { ...(subscription?.custom_curfews || {}) };
            updatedCurfews[locId] = editCustomCurfews;
            await fetch('/api/circle/curfews', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ custom_curfews: updatedCurfews }),
            });
          }
          setEditingLocId(null);
          setModal({ type: 'success', title: 'Location Updated', message: 'Location address updated successfully.' });
          await refreshData();
        } else {
          setModal({ type: 'error', title: 'Error', message: 'Failed to update location.' });
        }
      }
    } catch (e) {
      setModal({ type: 'error', title: 'Error', message: e.message });
    }
  };

  const handleJoinCircle = async () => {
    if (!joinCode || joinCode.trim().length < 4) {
      setModal({ type: 'warning', title: 'Invalid Code', message: 'Please enter a valid family code.' });
      return;
    }
    try {
      const res = await fetch('/api/circle/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_code: joinCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(prev => ({ ...prev, family_code: data.family_code, role: data.role }));
        setModal({ type: 'success', title: 'Joined Family', message: 'You have successfully joined the family circle!' });
        await refreshData();
      } else {
        if (data.error && (data.error.includes('limit reached') || data.error.includes('full'))) {
          setModal({
            type: 'warning',
            title: 'Family Circle Full',
            message: data.error,
          });
        } else {
          setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to join family.' });
        }
      }
    } catch (e) {
      setModal({ type: 'error', title: 'Error', message: e.message });
    }
  };

  const handleCreateCircle = async () => {
    try {
      const res = await fetch('/api/circle/create', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setUser(prev => ({ ...prev, family_code: data.family_code, role: data.role }));
        setModal({ type: 'success', title: 'Family Created', message: `Your new family circle code is ${data.family_code}` });
        await refreshData();
      } else {
        setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to create family.' });
      }
    } catch (e) {
      setModal({ type: 'error', title: 'Error', message: e.message });
    }
  };

  const handleDismissNotifications = async () => {
    if (notifications.length === 0) return;
    const ids = notifications.map(n => n.id);
    setNotifications([]);
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: ids }),
      });
    } catch(e) { console.error('Failed to mark read', e); }
  };

  const confirmDeleteAccount = async (password) => {
    try {
      const res = await fetch('/api/auth/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = '/auth';
      } else {
        setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to delete account.' });
      }
    } catch(e) {
      setModal({ type: 'error', title: 'Error', message: e.message });
    }
  };

  const handleDeleteAccount = () => {
    setModal({
      type: 'warning',
      title: 'Delete Account',
      message: 'This action is permanent and cannot be undone. Please enter your password to confirm.',
      confirmText: 'Delete Forever',
      requireHold: true,
      input: {
        type: 'password',
        placeholder: 'Password',
        value: '',
        onChange: () => {}
      },
      onConfirm: (password) => confirmDeleteAccount(password)
    });
  };

  const renderNotificationDropdown = () => (
    <div className="relative" ref={notificationMenuRef}>
      <button
        onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
        onMouseEnter={hoverScaleIn}
        onMouseLeave={hoverScaleOut}
        className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm hover:shadow-md hover:border-[#5621bf]/30 transition-all duration-200 active:scale-98 cursor-pointer relative shrink-0"
        aria-expanded={showNotificationsMenu}
        aria-haspopup="true"
      >
        <i className="fa-solid fa-bell text-slate-500 text-xs sm:text-sm group-hover:text-[#5621bf] transition-colors" />
        {unreadNotifications.length > 0 && (
          <span className="absolute top-1.5 right-2 sm:top-2 sm:right-2.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-rose-500 shadow-[0_0_0_2px_rgba(255,255,255,1)]" />
        )}
      </button>

      {/* Dropdown Menu */}
      <div ref={notificationDropdownRef} style={{ display: 'none', opacity: 0, visibility: 'hidden' }} className="absolute -right-4 sm:right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-24px)] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 z-[1001] origin-top sm:origin-top-right overflow-hidden flex-col max-h-[400px]">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-black text-slate-900">Notifications</h3>
          {unreadNotifications.length > 0 && (
            <button onClick={handleDismissNotifications} className="text-[10px] font-bold text-[#5621bf] hover:text-[#431799] transition-colors cursor-pointer bg-[#5621bf]/10 px-2 py-1 rounded-md">
              Mark all read
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs font-semibold">
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`p-3 rounded-xl flex items-start gap-3 transition-colors ${n.is_read ? 'bg-transparent' : 'bg-rose-50/50'}`}>
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.is_read ? 'bg-slate-300' : 'bg-rose-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs ${n.is_read ? 'font-medium text-slate-600' : 'font-bold text-slate-900'}`}>{n.message}</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderAdvancedCurfewEditor = () => {
    if (!isPlusCircle) return null;
    
    const handleAddCurfewRule = () => {
      setEditCustomCurfews([...(editCustomCurfews || []), { time: '20:00', days: [] }]);
    };

    const handleUpdateCurfewRule = (index, field, value) => {
      const updated = [...(editCustomCurfews || [])];
      
      if (field === 'days' || field === 'time') {
        const checkDays = field === 'days' ? value : (updated[index].days || []);
        const checkTime = field === 'time' ? value : (updated[index].time || '20:00');

        // Prevent exact day + time overlap globally across ALL locations and the current location's rules
        for (const day of checkDays) {
          // 1. Check current location rules
          const conflictingLocal = updated.findIndex((r, i) => i !== index && r.days && r.days.includes(day) && r.time === checkTime);
          if (conflictingLocal !== -1) {
            setModal({
              type: 'warning',
              title: 'Curfew Overlap',
              message: 'Curfew times cannot overlap! This exact time is already assigned to another rule in this location on the same day.'
            });
            return;
          }
          
          // 2. Check other locations
          const allCurfews = subscription?.custom_curfews || {};
          let conflictOther = false;
          for (const locKey of Object.keys(allCurfews)) {
            if (locKey === editingLocId) continue;
            const otherRules = allCurfews[locKey] || [];
            if (otherRules.some(r => r.days && r.days.includes(day) && r.time === checkTime)) {
              conflictOther = true;
              break;
            }
          }
          if (conflictOther) {
            setModal({
              type: 'warning',
              title: 'Curfew Overlap',
              message: 'Curfew times cannot overlap! This exact time is already assigned to a curfew in another location on the same day.'
            });
            return;
          }
        }
      }
      
      updated[index][field] = value;
      setEditCustomCurfews(updated);
    };

    const handleRemoveCurfewRule = (index) => {
      setEditCustomCurfews((editCustomCurfews || []).filter((_, i) => i !== index));
    };

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="pt-3 border-t border-purple-200/50 mt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-black uppercase text-[#5621bf]">Advanced Curfews (Pro)</label>
          <button type="button" onClick={handleAddCurfewRule} className="text-[9px] font-extrabold px-2 py-1 rounded-md bg-purple-100 text-[#5621bf] hover:bg-purple-200 cursor-pointer shadow-sm transition">
            <i className="fa-solid fa-plus text-[8px]" /> Add Rule
          </button>
        </div>
        
        {(!editCustomCurfews || editCustomCurfews.length === 0) ? (
          <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl text-center">
            <p className="text-[10px] font-semibold text-purple-400">No advanced curfews set. Uses basic curfew.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {editCustomCurfews.map((rule, idx) => (
              <div key={idx} className="bg-white p-2.5 rounded-xl border border-purple-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fa-solid fa-clock text-purple-300 text-xs" />
                  <input 
                    type="time" 
                    value={rule.time || '20:00'} 
                    onChange={(e) => handleUpdateCurfewRule(idx, 'time', e.target.value)} 
                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#5621bf]" 
                  />
                  <button type="button" onClick={() => handleRemoveCurfewRule(idx)} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition cursor-pointer">
                    <i className="fa-solid fa-trash-can text-xs" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {daysOfWeek.map((d, dIdx) => {
                    const isActive = rule.days && rule.days.includes(dIdx);
                    return (
                      <button 
                        key={dIdx} 
                        type="button"
                        onClick={() => {
                          const currentDays = rule.days || [];
                          const newDays = isActive ? currentDays.filter(x => x !== dIdx) : [...currentDays, dIdx];
                          handleUpdateCurfewRule(idx, 'days', newDays);
                        }} 
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border transition-colors cursor-pointer flex-1 text-center ${isActive ? 'bg-[#5621bf] text-white border-[#5621bf]' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderProfileDropdown = () => (
    <div className="relative" ref={profileMenuRef}>
      <button
        onClick={() => setShowProfileMenu(!showProfileMenu)}
        onMouseEnter={hoverScaleIn}
        onMouseLeave={hoverScaleOut}
        className="h-8 sm:h-10 flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm hover:shadow-md hover:border-[#5621bf]/30 transition-all duration-200 active:scale-98 cursor-pointer shrink-0"
        aria-expanded={showProfileMenu}
        aria-haspopup="true"
      >
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full avatar-gradient text-white flex items-center justify-center text-[9px] sm:text-[10px] font-black shadow-sm shrink-0">
          {(user?.name || 'U').substring(0, 2).toUpperCase()}
        </div>
        <span className="hidden md:block text-xs font-extrabold text-slate-900 truncate max-w-[100px]">
          {user?.name}
        </span>
        <i className={`fa-solid fa-chevron-down text-[8px] sm:text-[9px] text-slate-400 transition-transform duration-200 ${showProfileMenu ? 'rotate-180 text-[#5621bf]' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <div ref={profileDropdownRef} style={{ display: 'none', opacity: 0, visibility: 'hidden' }} className="absolute -right-2 sm:right-0 mt-2 w-64 sm:w-72 max-w-[calc(100vw-24px)] bg-white/95 backdrop-blur-xl rounded-2xl p-3 sm:p-4 shadow-2xl border border-slate-200/90 z-[1001] max-h-[85vh] origin-top sm:origin-top-right overflow-y-auto">
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
                  : 'bg-purple-100 text-purple-800'
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
            <a
              href="/"
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#5621bf] font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
            >
              <span className="flex items-center gap-2">Go to Main Page</span>
              <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
            </a>

            {isParent && !subscription?.is_plus && (
              <a
                href="/#pricing"
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
              >
                <span className="flex items-center gap-2">Subscription Plans</span>
                <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
              </a>
            )}

            {!isParent && user?.family_code && (
              <button
                onClick={handleLeaveCircle}
                onMouseEnter={hoverScaleIn}
                onMouseLeave={hoverScaleOut}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-600 font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
              >
                <span className="flex items-center gap-2">Leave Family Circle</span>
                <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
              </button>
            )}
            {isParent && user?.family_code && (
              <button
                onClick={handleDeleteCircle}
                onMouseEnter={hoverScaleIn}
                onMouseLeave={hoverScaleOut}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
              >
                <span className="flex items-center gap-2">Disband Family Circle</span>
                <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
              </button>
            )}
            <button
              onClick={handleSignOut}
              onMouseEnter={hoverScaleIn}
              onMouseLeave={hoverScaleOut}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
            >
              <span className="flex items-center gap-2">Sign Out</span>
              <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
            </button>
            <button
              onClick={handleDeleteAccount}
              onMouseEnter={hoverScaleIn}
              onMouseLeave={hoverScaleOut}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs transition-colors duration-150 group cursor-pointer"
            >
              <span className="flex items-center gap-2">Delete Account</span>
              <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
            </button>
          </div>

          {/* Legal Links */}
          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-center gap-3 text-[10px] font-semibold text-slate-500">
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
          </div>
        </div>
    </div>
  );

  const handleDismissTip = () => {
    if (user?.id) localStorage.setItem('ht_tip_dismissed_' + user.id, 'true');
    setShowTip(false);
  };

  const centerMapOnHome = () => {
    if (home?.home_lat && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([home.home_lat, home.home_lng], 14, { duration: 1 });
    }
  };

  const focusMemberOnMap = (member) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (member.role === 'parent' && home?.home_lat) {
      map.flyTo([home.home_lat, home.home_lng], 16, { duration: 1 });
      markersRef.current.home?.openPopup();
    } else if (member.current_lat && member.current_lng) {
      map.flyTo([member.current_lat, member.current_lng], 16, { duration: 1 });
      markersRef.current[member.id]?.openPopup();
    }
  };

  // ---- Child departure calculation ----
  const [currentGPS, setCurrentGPS] = useState({ lat: null, lng: null });

  useEffect(() => {
    if (user?.role === 'child') {
      const interval = setInterval(() => {
        if (liveGPSRef.current.lat !== currentGPS.lat || liveGPSRef.current.lng !== currentGPS.lng) {
          setCurrentGPS({ lat: liveGPSRef.current.lat, lng: liveGPSRef.current.lng });
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [user, currentGPS.lat, currentGPS.lng]);

  // Also fetch own ETA for child
  useEffect(() => {
    if (user?.role === 'child' && currentGPS.lat && home?.home_lat) {
      const dist = calculateDistanceKm(currentGPS.lat, currentGPS.lng, home.home_lat, home.home_lng);
      if (dist > AT_HOME_THRESHOLD_KM) {
        fetchEta('self', currentGPS.lat, currentGPS.lng, home.home_lat, home.home_lng);
      }
    }
  }, [user, currentGPS, home, fetchEta]);

  let childStatus = null;
  if (user?.role === 'child' && home?.home_lat && currentGPS.lat) {
    const dist = calculateDistanceKm(currentGPS.lat, currentGPS.lng, home.home_lat, home.home_lng);
    const isAtHome = dist <= AT_HOME_THRESHOLD_KM;
    const selfEta = etaCache['self'];

    const extraLoc = extraLocations.find(
      (loc) => loc.lat && loc.lng && calculateDistanceKm(currentGPS.lat, currentGPS.lng, loc.lat, loc.lng) <= AT_HOME_THRESHOLD_KM
    );

    if (isAtHome) {
      childStatus = { isAtHome: true, text: "You're Home", subtitle: 'You are within range of your Home Base.' };
    } else {
      let leaveByText = '';
      const travelMins = selfEta ? selfEta.duration_min : Math.max(2, Math.ceil(((dist * 1.4) / 12) * 60 + 2));
      const distText = selfEta ? selfEta.distance_km : dist.toFixed(1);

      let subtitle = extraLoc
        ? `You are at ${extraLoc.name}. ~${travelMins} min travel (${distText} km from Home).`
        : `${distText} km from Home (~${travelMins} min travel).`;

      // Handle curfew violation text
      const violations = getActiveCurfewViolations(selfEta ? undefined : home.home_lat, selfEta ? undefined : home.home_lng, home, extraLocations, subscription?.custom_curfews, isPlusCircle);
      // Wait, we need the member's current location to check violations
      // Since childStatus computation doesn't have the member's current_lat easily available here without re-fetching, 
      // but wait, this is child's own status so they are the current user. Let's assume we fetch violations for the user
      // if we have their location, but the backend handles `childStatus` checking differently. Let's fix this part safely.
      
      let earliestViolation = null;
      if (user?.role === 'child') {
        const curViolations = getActiveCurfewViolations(childStatus?.current_lat || 0, childStatus?.current_lng || 0, home, extraLocations, subscription?.custom_curfews, isPlusCircle);
        if (curViolations.length > 0) earliestViolation = curViolations[0];
      }

      if (home.target_home_time && typeof home.target_home_time === 'string' && home.target_home_time.includes(':')) {
        const parts = home.target_home_time.split(':').map(Number);
        const tH = isNaN(parts[0]) ? null : parts[0];
        const tM = isNaN(parts[1]) ? null : parts[1];

        if (tH !== null && tM !== null) {
          const isPastCurfewNow = earliestViolation ? true : false;
          // Fallback to basic curfew check if we don't have location yet
          let basicPastCurfew = false;
          if (!earliestViolation) {
            // Re-implement the basic time check just for the warning if no location available
            const curfewMinutes = tH * 60 + tM;
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const windowEnd = (curfewMinutes + 4 * 60) % 1440;
            if (curfewMinutes < windowEnd) {
              basicPastCurfew = currentMinutes >= curfewMinutes && currentMinutes < windowEnd;
            } else {
              basicPastCurfew = currentMinutes >= curfewMinutes || currentMinutes < windowEnd;
            }
          }

          if (isPastCurfewNow || basicPastCurfew) {
            const locName = earliestViolation ? earliestViolation.locationName : 'Home';
            const curTime = earliestViolation ? earliestViolation.time : home.target_home_time;
            leaveByText = 'IMMEDIATELY';
            subtitle = `Past Curfew (${locName} @ ${curTime})! ${extraLoc ? `You are at ${extraLoc.name}, ` : ''}${distText} km away (~${travelMins} min). Leave immediately!`;
          } else {
            const curfewDate = new Date();
            curfewDate.setHours(tH, tM, 0, 0);
            const safeTravelMins = typeof travelMins === 'number' && !isNaN(travelMins) ? travelMins : 10;
            const leaveTimestamp = curfewDate.getTime() - safeTravelMins * 60000;

            if (!isNaN(leaveTimestamp)) {
              if (Date.now() >= leaveTimestamp) {
                leaveByText = 'NOW';
                subtitle = `Leave NOW to arrive on time for your ${home.target_home_time} curfew! (${distText} km away)`;
              } else {
                const leaveDate = new Date(leaveTimestamp);
                const hrs = leaveDate.getHours();
                const mins = leaveDate.getMinutes();
                if (!isNaN(hrs) && !isNaN(mins)) {
                  const lH = String(hrs).padStart(2, '0');
                  const lM = String(mins).padStart(2, '0');
                  leaveByText = `${lH}:${lM}`;
                  subtitle = `${extraLoc ? `You are at ${extraLoc.name}. ` : ''}Leave by ${leaveByText} to arrive on time for ${home.target_home_time} curfew (${distText} km away).`;
                }
              }
            }
          }
        }
      }
      childStatus = {
        isAtHome: false,
        isAtExtraLocation: !!extraLoc,
        extraLocName: extraLoc?.name,
        travelMin: travelMins,
        leaveBy: leaveByText,
        subtitle,
        distKm: distText,
      };
    }
  } else if (user?.role === 'child') {
    childStatus = { isAtHome: false, travelMin: '--', leaveBy: '', subtitle: home?.home_lat ? 'Waiting for GPS signal...' : 'Waiting for parent to set Home Base.', distKm: '--' };
  }

  // ---- Loading Screen ----
  if (loading) {
    return (
      <div id="loading-screen" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fdfdfd]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center">
            <Image src="/logo.png" alt="HOMETRACKER Logo" width={56} height={56} className="w-14 h-14 object-contain" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-slate-900">HOME<span className="text-[#5621bf]">TRACKER</span></span>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-2 h-2 rounded-full bg-[#5621bf] animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 rounded-full bg-[#5621bf] animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2 h-2 rounded-full bg-[#5621bf] animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
          <p className="text-xs font-semibold text-slate-400 mt-1">Loading family map&hellip;</p>
        </div>
      </div>
    );
  }

  const isParent = user?.role === 'parent';
  const isAdmin = user?.role === 'admin';
  const isChild = user?.role === 'child';
  const homeIsSet = home?.home_address;
  const totalSavedLocations = (homeIsSet ? 1 : 0) + extraLocations.length;
  const isPlusCircle = subscription?.is_plus || user?.pro_status === 'approved' || (subscription?.subscription_tier && subscription?.subscription_tier.toLowerCase() !== 'basic' && subscription?.subscription_tier.toLowerCase() !== 'free');
  const maxLocationsAllowed = isPlusCircle ? 50 : 2;

  // ---- Helper: get member status info ----
  const getMemberStatus = (member) => {
    if (member.role === 'parent') return { label: 'Home', color: 'text-slate-500', badge: null };
    if (!member.current_lat || !home?.home_lat) return { label: 'Location unknown', color: 'text-slate-400', badge: null };

    const dist = calculateDistanceKm(member.current_lat, member.current_lng, home.home_lat, home.home_lng);
    if (dist <= AT_HOME_THRESHOLD_KM) {
      return { label: 'At Home', color: 'text-[#5621bf]', badge: 'bg-purple-100 text-[#5621bf]', isHome: true };
    }

    // Check if at an extra saved location
    const extraLoc = extraLocations.find(
      (loc) => loc.lat && loc.lng && calculateDistanceKm(member.current_lat, member.current_lng, loc.lat, loc.lng) <= AT_HOME_THRESHOLD_KM
    );

    const violations = getActiveCurfewViolations(member.current_lat, member.current_lng, home, extraLocations, subscription?.custom_curfews, isPlusCircle);
    const eta = etaCache[member.id];

    if (extraLoc) {
      // Check if they have a curfew violation for this specific extra location
      // Wait, if they are AT the location, getActiveCurfewViolations won't flag it as a violation for THAT location,
      // but it could flag it for Home if they are supposed to be at Home.
      if (violations.length > 0) {
        const v = violations[0];
        return {
          label: `Past Curfew (${v.locationName})`,
          color: 'text-rose-600',
          sublabel: `Should be at ${v.locationName} @ ${v.time}`,
          badge: 'bg-rose-100 text-rose-700 font-black',
          isPastCurfew: true,
        };
      }
      return {
        label: `At ${extraLoc.name}`,
        color: 'text-[#5621bf]',
        sublabel: eta ? `~${eta.duration_min} min from Home (${eta.distance_km} km)` : `${dist.toFixed(1)} km from Home`,
        badge: 'bg-purple-100 text-[#5621bf] font-extrabold border border-purple-200/60',
        isExtraLocation: true,
        locationName: extraLoc.name,
      };
    }

    if (violations.length > 0) {
      const v = violations[0];
      return {
        label: `Past Curfew (${v.locationName})`,
        color: 'text-rose-600',
        sublabel: eta ? `~${eta.duration_min} min away (${eta.distance_km} km)` : `${dist.toFixed(1)} km away`,
        badge: 'bg-rose-100 text-rose-700 font-black',
        isPastCurfew: true,
      };
    }

    if (eta) {
      return { label: `~${eta.duration_min} min`, color: 'text-[#5621bf]', sublabel: `${eta.distance_km} km by bike`, badge: null };
    }

    return { label: `${dist.toFixed(1)} km away`, color: 'text-slate-500', badge: null };
  };

  const renderToast = () => (
    <div ref={toastRef} style={{ display: 'none', opacity: 0, visibility: 'hidden' }} className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white border border-rose-100 px-4 py-3 rounded-2xl shadow-[0_10px_40px_-10px_rgba(244,63,94,0.3)] z-[9999] items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
          <i className="fa-solid fa-bell text-rose-500 text-lg"></i>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-black text-slate-900 text-sm">New Notification</span>
          <span className="text-xs text-slate-500 font-medium whitespace-normal break-words leading-relaxed">{unreadNotifications[0]?.message}</span>
        </div>
      </div>
      <button onClick={handleDismissNotifications} className="w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center transition-colors shrink-0">
        <i className="fa-solid fa-xmark text-slate-400"></i>
      </button>
    </div>
  );

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

  if (user && user.role !== 'admin' && (!user.family_code || user.family_code === 'ADMIN_GLOBAL')) {
    return (
      <div className="min-h-screen min-h-dvh flex flex-col relative overflow-hidden bg-slate-50 items-center justify-center p-6">
        <CustomModal modal={modal} onClose={() => setModal(null)} />
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#e2f0ff]/60 via-purple-100/30 to-transparent blur-3xl -z-10 pointer-events-none" />
        <WaveBackground />
        
        {renderToast()}

        {/* Header */}
        <header className="absolute top-0 w-full px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between z-20">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2 group shrink-0">
            <Image src="/logo.png" alt="HOMETRACKER Logo" width={36} height={36} className="w-7 h-7 sm:w-9 sm:h-9 object-contain group-hover:scale-105 transition-transform duration-300" />
            <span className="font-extrabold text-sm sm:text-lg tracking-tight text-slate-900">
              HOME<span className="text-[#5621bf]">TRACKER</span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {renderNotificationDropdown()}
            {renderProfileDropdown()}
          </div>
        </header>

        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-center mt-12">
          <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-house-crack text-3xl"></i>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">You don't belong to a Family Circle</h2>
          <p className="text-xs text-slate-500 mb-8 font-medium leading-relaxed">
            It looks like you've been removed or left your family circle. To continue using HomeTracker, you must either join an existing family or create a new one.
          </p>
          
          <div className="space-y-4">
            {!isParent && (
              <>
                <div className="relative">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(formatFamilyCode(e.target.value))}
                    placeholder="Enter Family Code (e.g. HT-7K9M2P)"
                    maxLength={9}
                    className="w-full py-3 px-4 text-sm font-extrabold text-center rounded-xl border border-slate-300 focus:border-[#5621bf] outline-none uppercase tracking-widest bg-white"
                  />
                </div>
                <button onClick={handleJoinCircle} onMouseEnter={hoverScaleIn} onMouseLeave={hoverScaleOut} className="w-full py-3 bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-sm rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-right-to-bracket"></i> Join Family
                </button>
              </>
            )}

            {isParent && (
              <button onClick={handleCreateCircle} onMouseEnter={hoverScaleIn} onMouseLeave={hoverScaleOut} className="w-full py-3 bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-sm rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2">
                <i className="fa-solid fa-plus"></i> Create New Family
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (user && user.role === 'admin') {
    return (
      <div className="min-h-screen min-h-dvh flex flex-col bg-slate-50 relative">
        <CustomModal modal={modal} onClose={() => setModal(null)} />
        {renderToast()}

        {/* Clean Header */}
        <header className="w-full px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between z-20 shrink-0 shadow-xs">
          <Link href="/" className="flex items-center gap-2 group">
            <Image src="/logo.png" alt="HOMETRACKER Logo" width={36} height={36} className="w-8 h-8 object-contain" />
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              HOME<span className="text-[#5621bf]">TRACKER</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {renderNotificationDropdown()}
            {renderProfileDropdown()}
          </div>
        </header>

        {/* Admin Dashboard Full Page Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          {/* Dashboard Title Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-slate-900">HomeTracker Admin Panel</h1>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Manage user accounts, family circles, Pro applications, and monthly product reviews.</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200 flex gap-1.5 sm:gap-2 overflow-x-auto shadow-xs custom-scroll">
            <button
              onClick={() => { setAdminTab('stats'); fetchAdminData('stats'); }}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-xl font-extrabold text-[11px] sm:text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                adminTab === 'stats' ? 'bg-[#5621bf] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <i className="fa-solid fa-chart-pie" /> Overview Stats
            </button>

            <button
              onClick={() => { setAdminTab('requests'); fetchAdminData('requests'); }}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-xl font-extrabold text-[11px] sm:text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                adminTab === 'requests' ? 'bg-[#5621bf] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <i className="fa-solid fa-paper-plane" /> Pro Requests
              {adminStats?.pending_requests > 0 && (
                <span className="bg-[#5621bf] text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {adminStats.pending_requests}
                </span>
              )}
            </button>

            <button
              onClick={() => { setAdminTab('users'); fetchAdminData('users'); }}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-xl font-extrabold text-[11px] sm:text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                adminTab === 'users' ? 'bg-[#5621bf] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <i className="fa-solid fa-users" /> User Governance
            </button>

            <button
              onClick={() => { setAdminTab('feedback'); fetchAdminData('feedback'); }}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-xl font-extrabold text-[11px] sm:text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                adminTab === 'feedback' ? 'bg-[#5621bf] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <i className="fa-solid fa-comments" /> Monthly Reviews
            </button>
          </div>

          {/* Tab Body Content */}
          <div className="bg-white p-3.5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 sm:space-y-6">
            {loadingAdminData && (
              <div className="flex justify-center items-center py-12 text-[#5621bf]">
                <i className="fa-solid fa-spinner animate-spin text-3xl" />
              </div>
            )}

            {/* 1. OVERVIEW STATS TAB */}
            {!loadingAdminData && adminTab === 'stats' && adminStats && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-0.5 sm:space-y-1">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400">Total Users</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900">{adminStats.total_users}</p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-0.5 sm:space-y-1">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400">Free Users</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-700">{adminStats.free_users}</p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-purple-50 border border-purple-200 text-center space-y-0.5 sm:space-y-1">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-[#5621bf]">Pro Members</p>
                    <p className="text-xl sm:text-2xl font-black text-[#5621bf]">{adminStats.pro_users}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 shadow-xs text-center space-y-1">
                      <p className="text-[10px] font-black uppercase text-purple-800">Pending Requests</p>
                      <p className="text-2xl font-black text-purple-900">{adminStats.pending_requests}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-xs text-center space-y-1">
                      <p className="text-[10px] font-black uppercase text-indigo-800">Feedback Reviews</p>
                      <p className="text-2xl font-black text-indigo-900">{adminStats.total_feedback}</p>
                    </div>
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-0.5 sm:space-y-1">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400">Family Circles</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900">{adminStats.total_circles}</p>
                  </div>
                </div>

                <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm border-b border-slate-200 pb-2">Global System Settings</h4>
                  
                  {adminSettings && (
                    <div className="space-y-4">
                      {/* Survey Interval */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div>
                          <p className="text-sm font-bold text-slate-800">Monthly Survey Interval</p>
                          <p className="text-xs font-medium text-slate-500 max-w-lg mt-0.5">Choose how often Pro members are prompted for the feedback survey. Testing mode runs every minute.</p>
                        </div>
                        <select 
                          value={adminSettings?.survey_interval_mode || 'test_mode'}
                          onChange={(e) => handleUpdateSurveyInterval(e.target.value)}
                          disabled={savingAdminSettings}
                          className="px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#5621bf] focus:ring-2 focus:ring-purple-100 rounded-xl text-xs font-bold text-slate-700 shadow-sm outline-none cursor-pointer w-full sm:w-auto min-w-[220px] transition-all"
                        >
                          <option value="test_mode">Test Mode (1 Minute)</option>
                          <option value="first_of_next_month">Production (1st of Next Month)</option>
                        </select>
                      </div>

                      {/* Maintenance Mode */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div>
                          <p className="text-sm font-bold text-slate-800">Maintenance Mode</p>
                          <p className="text-xs font-medium text-slate-500 max-w-lg mt-0.5">Suspend the site for all non-admins. Displays a "We are busy" landing page.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={adminSettings?.maintenance_mode === 'true'}
                            onChange={(e) => handleToggleMaintenanceMode(e.target.checked)}
                            disabled={savingAdminSettings}
                          />
                          <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-purple-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5621bf]"></div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/60 border border-purple-200/80 space-y-2.5 sm:space-y-3">
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <i className="fa-solid fa-shield-halved text-[#5621bf]" /> Pro Governance Principles
                  </h4>
                  <ul className="text-[11px] sm:text-xs text-slate-600 space-y-1.5 sm:space-y-2 leading-relaxed">
                    <li>• <strong>Community Partnership:</strong> Pro members receive lifetime access in exchange for active monthly product feedback.</li>
                    <li>• <strong>Fair Evaluation:</strong> Review why applicants want Pro access and their intended family setup.</li>
                    <li>• <strong>Quality Enforcement:</strong> Users who repeatedly submit empty or fake feedback can have Pro access revoked by Admins.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* 2. PRO REQUESTS TAB */}
            {!loadingAdminData && adminTab === 'requests' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm">Pro Applications ({adminRequests.length})</h4>
                  {adminRequests.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCollapsedRequests(!collapsedRequests)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <i className={`fa-solid ${collapsedRequests ? 'fa-chevron-down' : 'fa-chevron-up'} text-[10px]`} />
                        {collapsedRequests ? 'Expand All' : 'Collapse All'}
                      </button>
                      <button
                        onClick={handleClearAllProRequests}
                        className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <i className="fa-solid fa-trash-can text-[10px]" /> Clear All Applications
                      </button>
                    </div>
                  )}
                </div>

                {adminRequests.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-semibold">
                    No Pro applications found.
                  </div>
                ) : (
                  adminRequests.map((req) => (
                    <div key={req.id} className="p-3.5 sm:p-5 rounded-2xl bg-slate-50/60 border border-slate-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-black text-slate-900">{req.user_name}</span>
                          <span className="text-[11px] text-slate-500 font-semibold">({req.email})</span>
                          <span className="text-[10px] sm:text-xs font-black text-[#5621bf] bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg">
                            Code: {req.family_code}
                          </span>
                        </div>
                        <span className={`self-start sm:self-auto px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase ${
                          req.status === 'approved' ? 'bg-purple-100 text-purple-800' :
                          req.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-900'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      {!collapsedRequests && (
                        <>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 space-y-0.5">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase">Family Size</span>
                          <p className="font-bold text-slate-800">{req.family_size} Members</p>
                        </div>
                        <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 space-y-0.5 sm:col-span-2">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase">Why Pro Wanted</span>
                          <p className="font-medium text-slate-800 leading-snug">{req.why_pro}</p>
                        </div>
                        <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 space-y-0.5 sm:col-span-3">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase">Problems To Solve</span>
                          <p className="font-medium text-slate-800 leading-snug">{req.problems_to_solve}</p>
                        </div>
                      </div>

                      {req.status === 'pending' && (
                        <div className="pt-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                          <input
                            type="text"
                            placeholder="Admin Notes / Rationale (optional)..."
                            value={selectedReqId === req.id ? adminNoteInput : ''}
                            onChange={(e) => {
                              setSelectedReqId(req.id);
                              setAdminNoteInput(e.target.value);
                            }}
                            className="w-full sm:flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:border-[#5621bf] outline-none bg-white"
                          />
                          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                            <button
                              onClick={() => handleAdminActionRequest(req.id, 'reject')}
                              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold text-xs transition cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleAdminActionRequest(req.id, 'approve')}
                              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-xs shadow-sm transition cursor-pointer"
                            >
                              Approve Pro Access
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 3. USER MANAGEMENT TAB */}
            {!loadingAdminData && adminTab === 'users' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search name, email, family code..."
                    value={adminUserSearch}
                    onChange={(e) => setAdminUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchAdminData('users', adminUserSearch)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:border-[#5621bf] outline-none bg-white"
                  />
                  <button
                    onClick={() => fetchAdminData('users', adminUserSearch)}
                    className="px-4 py-2 rounded-xl bg-[#5621bf] text-white font-extrabold text-xs shadow-xs hover:bg-[#431799] cursor-pointer shrink-0"
                  >
                    Search
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto custom-scroll shadow-xs">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-3">User</th>
                        <th className="p-3">Role / Code</th>
                        <th className="p-3">Pro Status</th>
                        <th className="p-3">Circle Tier</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-extrabold text-slate-900">
                            <div>{u.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{u.email}</div>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-700">{u.role}</span>
                            <div className="text-[10px] text-[#5621bf] font-mono font-bold">{u.family_code}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              u.pro_status === 'approved' ? 'bg-purple-100 text-purple-800' :
                              u.pro_status === 'requested' ? 'bg-amber-100 text-amber-800' :
                              u.pro_status === 'revoked' ? 'bg-rose-100 text-rose-800' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {u.pro_status || 'none'}
                            </span>
                          </td>
                          <td className="p-3 font-black text-[#5621bf]">
                            {u.subscription_tier === 'plus' ? 'PRO PLUS' : 'BASIC'}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {u.role !== 'admin' && (
                                u.pro_status === 'approved' ? (
                                  <button
                                    onClick={() => handleAdminUserAction(u.id, 'revoke_pro')}
                                    className="px-2.5 py-1 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-black cursor-pointer"
                                  >
                                    Revoke Pro
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleAdminUserAction(u.id, 'grant_pro')}
                                    className="px-2.5 py-1 rounded-xl bg-[#5621bf] hover:bg-[#431799] text-white text-[10px] font-black cursor-pointer shadow-xs"
                                    title="Grants Pro to the Parent account so the entire family circle receives Pro access"
                                  >
                                    {u.role === 'parent' ? 'Grant Circle Pro' : 'Grant Circle Pro (via Parent)'}
                                  </button>
                                )
                              )}

                              {u.role !== 'admin' && (
                                <button
                                  onClick={() => handleAdminUserAction(u.id, 'set_role_admin')}
                                  className="px-2.5 py-1 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-black cursor-pointer shadow-xs flex items-center gap-1"
                                  title="Promote to Admin & strip family circle"
                                >
                                  <i className="fa-solid fa-user-shield text-[9px]" /> Make Admin
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. MONTHLY FEEDBACK TAB */}
            {!loadingAdminData && adminTab === 'feedback' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm">Monthly Feedback Reviews ({adminFeedbackList.length})</h4>
                  {adminFeedbackList.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCollapsedFeedback(!collapsedFeedback)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <i className={`fa-solid ${collapsedFeedback ? 'fa-chevron-down' : 'fa-chevron-up'} text-[10px]`} />
                        {collapsedFeedback ? 'Expand All' : 'Collapse All'}
                      </button>
                      <button
                        onClick={handleClearAllFeedback}
                        className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <i className="fa-solid fa-trash-can text-[10px]" /> Clear All Reviews
                      </button>
                    </div>
                  )}
                </div>

                {adminFeedbackList.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-semibold">
                    No monthly feedback submissions found.
                  </div>
                ) : (
                  adminFeedbackList.map((fb) => (
                    <div key={fb.id} className="p-3.5 sm:p-5 rounded-2xl bg-slate-50/60 border border-slate-200 space-y-2 sm:space-y-2.5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 pb-2">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <span className="font-black text-slate-900 text-xs sm:text-sm">{fb.user_name}</span>
                          <span className="text-[11px] text-slate-400">({fb.user_email})</span>
                          <span className="text-[10px] sm:text-xs font-extrabold text-[#5621bf] bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg">
                            Month: {fb.month_year}
                          </span>
                        </div>
                        <span className="self-start sm:self-auto text-[10px] sm:text-xs font-black text-slate-700 bg-slate-200 px-2.5 py-0.5 rounded-full">
                          Score: {fb.recommendation_score}/10
                        </span>
                      </div>

                      {!collapsedFeedback && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs pt-1">
                          <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-emerald-800 block mb-0.5">What Worked Well</span>
                            <p className="font-medium text-slate-800 leading-snug">{fb.worked_well}</p>
                          </div>

                          <div className="p-2.5 sm:p-3 rounded-xl bg-purple-50/70 border border-purple-100">
                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-purple-800 block mb-0.5">Feature Improvements / Ideas</span>
                            <p className="font-medium text-slate-800 leading-snug">{fb.features_to_improve}</p>
                          </div>

                          {fb.problems_encountered && (
                            <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50/70 border border-amber-100 sm:col-span-2">
                              <span className="text-[9px] sm:text-[10px] font-black uppercase text-amber-800 block mb-0.5">Bugs / Issues Reported</span>
                              <p className="font-medium text-slate-800 leading-snug">{fb.problems_encountered}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh flex flex-col relative overflow-x-hidden">
<CustomModal modal={modal} onClose={() => setModal(null)} />

      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#e2f0ff]/60 via-purple-100/30 to-transparent blur-3xl -z-10 pointer-events-none" />
      <WaveBackground />

      {renderToast()}

      {/* ===== Header ===== */}
      <header className="w-full px-2 sm:px-6 py-2 sm:py-3 flex items-center justify-between z-[1000] shrink-0 relative bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="flex items-center gap-1 sm:gap-4 shrink-0">
          <Link href="/" className="flex items-center gap-1 sm:gap-2 group">
            <Image src="/logo.png" alt="HOMETRACKER Logo" width={36} height={36} className="w-6 h-6 sm:w-9 sm:h-9 object-contain group-hover:scale-105 transition-transform duration-300" />
            <span className="hidden min-[340px]:inline font-extrabold text-xs sm:text-lg tracking-tight text-slate-900">
              HOME<span className="text-[#5621bf]">TRACKER</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {user?.role === 'admin' && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onClick={() => {
                  setShowAdminModal(true);
                  setAdminTab('stats');
                  fetchAdminData('stats');
                }}
                className="h-8 sm:h-10 px-2 sm:px-3 rounded-xl bg-[#5621bf] hover:bg-[#431799] text-white text-[10px] sm:text-xs font-extrabold shadow-sm transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
                title="Master Admin Dashboard"
              >
                <i className="fa-solid fa-user-gear text-white text-xs" />
                <span className="hidden sm:inline">Admin Panel</span>
              </button>

              <button
                onClick={() => {
                  setShowAdminModal(true);
                  setAdminTab('requests');
                  fetchAdminData('requests');
                }}
                className="h-8 sm:h-10 px-2 sm:px-3 rounded-xl bg-white/90 border border-slate-200 text-slate-700 text-[10px] sm:text-xs font-extrabold hover:border-[#5621bf] hover:text-[#5621bf] shadow-sm transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
                title="Pro Applications"
              >
                <i className="fa-solid fa-paper-plane text-xs text-[#5621bf]" />
                <span className="hidden md:inline">Applications</span>
              </button>

              <button
                onClick={() => {
                  setShowAdminModal(true);
                  setAdminTab('users');
                  fetchAdminData('users');
                }}
                className="h-8 sm:h-10 px-2 sm:px-3 rounded-xl bg-white/90 border border-slate-200 text-slate-700 text-[10px] sm:text-xs font-extrabold hover:border-[#5621bf] hover:text-[#5621bf] shadow-sm transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
                title="User & Circle Governance"
              >
                <i className="fa-solid fa-users-gear text-xs text-[#5621bf]" />
                <span className="hidden md:inline">Users &amp; Circles</span>
              </button>

              <button
                onClick={() => {
                  setShowAdminModal(true);
                  setAdminTab('feedback');
                  fetchAdminData('feedback');
                }}
                className="h-8 sm:h-10 px-2 sm:px-3 rounded-xl bg-white/90 border border-slate-200 text-slate-700 text-[10px] sm:text-xs font-extrabold hover:border-[#5621bf] hover:text-[#5621bf] shadow-sm transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
                title="Monthly Feedback Submissions"
              >
                <i className="fa-solid fa-comments text-xs text-[#5621bf]" />
                <span className="hidden md:inline">Reviews</span>
              </button>
            </div>
          )}

          {/* Subscription Tier Badge */}
          <button
            onClick={() => {
              if (!isPlusCircle) {
                setShowProRequestModal(true);
              } else {
                setShowPaymentInfoModal(true);
              }
            }}
            className={`h-8 sm:h-10 px-2 sm:px-3 rounded-xl border text-[10px] sm:text-xs font-black shadow-sm transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 ${
              isPlusCircle
                ? 'bg-[#5621bf] text-white border-purple-400'
                : 'bg-white/80 backdrop-blur-sm text-slate-700 border-slate-200 hover:bg-white'
            }`}
            title={isPlusCircle ? 'HomeTracker Pro Member' : 'HomeTracker Basic Member'}
          >
            <i className={`fa-solid ${isPlusCircle ? 'fa-shield-halved text-white' : 'fa-shield text-[#5621bf]'} text-xs`} />
            <span className="truncate">{isPlusCircle ? 'PRO' : 'BASIC'}</span>
            <span className="hidden sm:inline"> MEMBER</span>
          </button>

          {/* Center Home button */}
          {homeIsSet && (
            <button 
              onClick={centerMapOnHome} 
              onMouseEnter={hoverScaleIn} 
              onMouseLeave={hoverScaleOut} 
              className="h-8 sm:h-10 px-2 sm:px-3 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 text-[10px] sm:text-xs font-bold shadow-sm hover:bg-white transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
              title="Center Map on Home"
            >
              <i className="fa-solid fa-house text-[#5621bf] text-xs sm:text-[11px]" />
              <span className="hidden md:inline">Center Home</span>
            </button>
          )}

          {renderNotificationDropdown()}
          {/* Profile Dropdown */}
          {renderProfileDropdown()}
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 relative z-10">

        {/* MAP (always on top on mobile, right on desktop) */}
        <div className="w-full lg:flex-1 h-[55vh] sm:h-[50vh] lg:h-auto relative shrink-0 lg:order-2">
          <div className="absolute inset-0 lg:static lg:h-full">
            <div ref={mapRef} id="leaflet-map" className="w-full h-full" style={{ borderRadius: 0 }} />
          </div>
          {/* Map legend */}
          <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 text-[10px] font-extrabold text-slate-700">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#5621bf]" /> Home</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0d9488]" /> Extra</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Members</span>
          </div>
        </div>

        {/* INFO PANEL (bottom on mobile, left sidebar on desktop) */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col min-h-0 lg:order-1 lg:border-r lg:border-slate-200/60 bg-white/70 lg:bg-white/50 backdrop-blur-sm">
          <div className="flex-1 overflow-y-auto custom-scroll p-3 sm:p-4 space-y-3">



            {/* Child status banner */}
            {isChild && childStatus && (
              <div className={`p-3 rounded-xl border ${childStatus.isAtHome ? 'bg-emerald-50/90 border-emerald-200' : 'bg-amber-50/90 border-amber-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${childStatus.isAtHome ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      <i className={`fa-solid ${childStatus.isAtHome ? 'fa-house-chimney' : 'fa-route'} text-base`} />
                    </div>
                    <div>
                      <p className={`text-sm font-black ${childStatus.isAtHome ? 'text-emerald-800' : 'text-slate-900'}`}>
                        {childStatus.isAtHome ? "You're Home" : `${childStatus.travelMin} min`}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500">{childStatus.subtitle}</p>
                    </div>
                  </div>
                  {!childStatus.isAtHome && childStatus.leaveBy && (
                    <div className="text-right">
                      <p className="text-[9px] font-extrabold uppercase text-slate-400">Leave by</p>
                      <p className="text-sm font-black text-amber-600">{childStatus.leaveBy}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tip Card (Children, once per account) */}
            {showTip && (
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-[#5621bf]/10 via-blue-50 to-purple-50 border border-[#5621bf]/20 flex items-center gap-2.5 text-xs font-bold text-slate-700">
                <i className="fa-solid fa-lightbulb text-amber-500 text-sm shrink-0" />
                <span className="flex-1">Keep HOMETRACKER open while traveling so your family sees your live location.</span>
                <button onClick={handleDismissTip} className="text-slate-400 hover:text-slate-700 p-1 transition shrink-0 cursor-pointer">
                  <i className="fa-solid fa-xmark text-xs" />
                </button>
              </div>
            )}

            {/* Saved Family Locations */}
            <div className="p-3 rounded-xl bg-white/80 border border-slate-200/80 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <i className="fa-solid fa-map-location-dot text-[#5621bf]" /> Saved Locations
                </p>
                <span className={`text-[10px] font-black ${totalSavedLocations >= maxLocationsAllowed ? 'text-slate-500' : 'text-[#5621bf]'}`}>
                  {totalSavedLocations} / {maxLocationsAllowed} Locations
                </span>
              </div>

              <div className="space-y-2">
                {/* Home Location */}
                <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100/90 transition shadow-xs">
                  {editingLocId === 'home' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-purple-900">Edit Home Base & Curfew</span>
                        <button onClick={() => setEditingLocId(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer">Cancel</button>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Home Address</label>
                        <AddressInputWithAutocomplete
                          value={editAddress}
                          onChange={setEditAddress}
                          placeholder="Search or enter Home Address"
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-purple-300 focus:border-[#5621bf] outline-none bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Curfew Time</label>
                        <input 
                          type="time" 
                          value={editTargetTime} 
                          onChange={(e) => setEditTargetTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-purple-300 focus:border-[#5621bf] outline-none bg-white"
                        />
                      </div>
                      
                      {renderAdvancedCurfewEditor()}

                      <div className="flex justify-end gap-1.5 pt-1">
                        <button 
                          onClick={() => handleSaveLocationEdit('home')}
                          className="px-3 py-1.5 bg-[#5621bf] hover:bg-[#431799] text-white text-xs font-extrabold rounded-lg shadow-sm cursor-pointer"
                        >
                          Save Home Base
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div 
                        onClick={() => flyToLocation(home?.home_lat, home?.home_lng, 'home')}
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#5621bf] text-white flex items-center justify-center text-xs shrink-0 shadow-sm">
                          <i className="fa-solid fa-house" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black text-slate-900 truncate">Home Base</p>
                            <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">Primary</span>
                          </div>
                          <p className="text-[10px] font-semibold text-slate-500 truncate">{home?.home_address || 'Click edit to set address'}</p>
                          <p className="text-[9px] font-extrabold text-[#5621bf] mt-0.5 flex items-center gap-1">
                            <i className="fa-solid fa-clock text-[8px]" /> Curfew: {getTodayCurfewText('home', home?.target_home_time, subscription?.custom_curfews, isPlusCircle)}
                          </p>
                        </div>
                      </div>
                      {isParent && (
                        <div className="relative group/hint shrink-0 ml-1">
                          <button 
                            onClick={() => startEditLocation('home', 'Home Base', home?.home_address, home?.target_home_time)}
                            className="w-7 h-7 rounded-lg hover:bg-purple-200/50 text-slate-400 hover:text-[#5621bf] flex items-center justify-center transition cursor-pointer"
                            title="Edit Home Address & Curfew Time"
                          >
                            <i className="fa-solid fa-pen-to-square text-xs" />
                          </button>
                          <div className="absolute right-0 bottom-full mb-1 hidden group-hover/hint:block whitespace-nowrap bg-slate-900 text-white text-[9px] font-extrabold px-2 py-1 rounded-md shadow-lg z-20 pointer-events-none">
                            Edit Home Address & Curfew Time
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Extra Locations */}
                {extraLocations.map((loc) => (
                  <div key={loc.id} className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-100/90 transition shadow-xs">
                    {editingLocId === loc.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-teal-900">Edit Location</span>
                          <button onClick={() => setEditingLocId(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer">Cancel</button>
                        </div>
                        <input 
                          type="text" 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Location Name (e.g. School)"
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-teal-300 focus:border-[#0d9488] outline-none bg-white"
                        />
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-400">Location Name</label>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 focus:border-[#5621bf] outline-none bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400">Address</label>
                          <AddressInputWithAutocomplete
                            value={editAddress}
                            onChange={setEditAddress}
                            placeholder="Location Address"
                            className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 focus:border-[#5621bf] outline-none bg-white"
                          />
                        </div>
                        
                        {renderAdvancedCurfewEditor()}

                        <div className="flex justify-end gap-1.5 pt-2">
                          <button 
                            onClick={() => handleSaveLocationEdit(loc.id)}
                            className="px-3 py-1 bg-[#5621bf] hover:bg-[#431799] text-white text-xs font-extrabold rounded-lg shadow-sm cursor-pointer"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div 
                          onClick={() => flyToLocation(loc.lat, loc.lng, `loc_${loc.id}`)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-500 text-white flex items-center justify-center text-xs shrink-0 shadow-sm">
                            <i className="fa-solid fa-location-dot" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-slate-900 truncate">{loc.name}</p>
                            <p className="text-[10px] font-semibold text-slate-500 truncate">{loc.address}</p>
                            <p className="text-[9px] font-extrabold text-teal-700 mt-0.5 flex items-center gap-1">
                              <i className="fa-solid fa-clock text-[8px]" /> Curfew: {getTodayCurfewText(loc.id, null, subscription?.custom_curfews, isPlusCircle)}
                            </p>
                          </div>
                        </div>
                        {isParent && (
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            <div className="relative group/hint">
                              <button 
                                onClick={() => startEditLocation(loc.id, loc.name, loc.address)}
                                className="w-7 h-7 rounded-lg hover:bg-slate-200/50 text-slate-400 hover:text-[#5621bf] flex items-center justify-center transition cursor-pointer"
                                title="Change Address"
                              >
                                <i className="fa-solid fa-pen-to-square text-xs" />
                              </button>
                              <div className="absolute right-0 bottom-full mb-1 hidden group-hover/hint:block whitespace-nowrap bg-slate-900 text-white text-[9px] font-extrabold px-2 py-1 rounded-md shadow-lg z-20 pointer-events-none">
                                Change Address
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteLocation(loc)}
                              className="w-7 h-7 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove location"
                            >
                              <i className="fa-solid fa-trash-can text-xs" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Location Form (Parent Only - checks subscription limit) */}
              {isParent && (
                totalSavedLocations < maxLocationsAllowed ? (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    {showAddForm ? (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-600">Add Extra Location</span>
                          <button onClick={() => setShowAddForm(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer">Cancel</button>
                        </div>
                        <input 
                          type="text" 
                          value={newLocName} 
                          onChange={(e) => setNewLocName(e.target.value)}
                          placeholder="Name (e.g. School, Work, Gym)"
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 focus:border-[#5621bf] outline-none bg-white"
                        />
                        <AddressInputWithAutocomplete
                          value={newLocAddress}
                          onChange={setNewLocAddress}
                          placeholder="Search or enter Address (e.g. 100 Main St)"
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 focus:border-[#5621bf] outline-none bg-white"
                        />
                        <button
                          onClick={() => { handleAddLocation(); setShowAddForm(false); }}
                          disabled={!newLocName.trim() || !newLocAddress.trim()}
                          className={`w-full py-2 font-extrabold text-xs rounded-lg transition flex items-center justify-center gap-1.5 ${!newLocName.trim() || !newLocAddress.trim() ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#5621bf] hover:bg-[#431799] text-white active:scale-95 cursor-pointer shadow-sm'}`}
                        >
                          <i className="fa-solid fa-plus" /> Save New Location
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="w-full py-2 border border-dashed border-slate-300 hover:border-[#5621bf] bg-slate-50/50 hover:bg-slate-50 text-slate-600 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-plus" /> Add Location (e.g. School)
                      </button>
                    )}
                  </div>
                ) : (
                  !isPlusCircle && isParent && (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setShowProRequestModal(true)}
                        className="w-full py-2 bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 border border-slate-300 text-slate-700 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-paper-plane text-slate-500" /> Location Limit Reached — Request Pro Access
                      </button>
                    </div>
                  )
                )
              )}
            </div>

            {/* Family Members */}
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <i className="fa-solid fa-users text-[#5621bf] text-[11px]" /> Family ({members.length})
              </p>

              {/* Monthly Feedback Due Banner for Pro Members */}
              {subscription?.is_plus && subscription?.feedback_due && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950 via-[#5621bf] to-purple-900 text-white shadow-md space-y-2">
                  <div className="flex items-center justify-between font-black text-xs">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-comments text-purple-300" />
                      <span>Monthly Pro Review Due</span>
                    </span>
                    <span className="text-[9px] text-purple-200 font-black uppercase">
                      Required
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-100 font-medium leading-snug">
                    Share your experience &amp; usage insights for this month to maintain your lifetime Pro access!
                  </p>
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="w-full py-2 bg-purple-100 hover:bg-white text-[#5621bf] font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    <i className="fa-solid fa-pen-nib" /> Start Quick Review
                  </button>
                </div>
              )}

              {/* Application Pending Banner */}
              {!subscription?.is_plus && subscription?.pro_status === 'requested' && isParent && (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 text-xs font-semibold space-y-1 shadow-xs">
                  <div className="flex items-center justify-between font-black">
                    <span className="flex items-center gap-1.5 text-[#5621bf]">
                      <i className="fa-solid fa-hourglass-half text-purple-600" />
                      <span>Pro Application Under Review</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-900 leading-tight">
                    Your Pro application is currently being reviewed by our admin team. You will receive a notification upon decision.
                  </p>
                </div>
              )}

              {/* Free Tier Apply Banner */}
              {!isPlusCircle && subscription?.pro_status !== 'requested' && isParent && (
                <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200/90 text-purple-900 text-xs font-semibold space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between font-black">
                    <span className="flex items-center gap-1.5 text-[#5621bf]">
                      <i className="fa-solid fa-sparkles text-[#5621bf]" />
                      <span>HomeTracker Pro Membership</span>
                    </span>
                    <button
                      onClick={() => setShowPaymentInfoModal(true)}
                      className="text-[10px] font-black text-[#5621bf] underline cursor-pointer"
                    >
                      Rules
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-snug">
                    Apply for lifetime Pro access in exchange for monthly product feedback!
                  </p>
                  <button
                    onClick={() => setShowProRequestModal(true)}
                    className="w-full py-1.5 bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-[11px] rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-paper-plane text-xs text-white" /> Request Pro Access
                  </button>
                </div>
              )}
              {members.length === 0 ? (
                <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200/80 border-dashed text-slate-400 text-xs font-semibold">
                  No family members found.
                </div>
              ) : (
                members.map((member) => {
                  const mp = member.role === 'parent';
                  const status = getMemberStatus(member);
                  return (
                    <div key={member.id} onClick={() => focusMemberOnMap(member)} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/80 border border-slate-200/60 shadow-sm group hover:border-[#5621bf]/40 hover:shadow-md transition-all cursor-pointer">
                      <div className={`w-8 h-8 rounded-full ${mp ? 'bg-[#5621bf]' : 'bg-blue-500'} text-white flex items-center justify-center text-[10px] font-black shrink-0`}>
                        {(member.name || 'M').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-slate-900 truncate">{member.name}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold ${mp ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{member.role}</span>
                        </div>
                        {status.sublabel && <p className="text-[10px] font-semibold text-slate-400">{status.sublabel}</p>}
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div className="min-w-[60px]">
                          {status.isHome ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#5621bf]">
                              <i className="fa-solid fa-house-chimney text-[8px]" /> At Home
                            </span>
                          ) : status.isExtraLocation ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#5621bf]">
                              <i className="fa-solid fa-location-dot text-[8px]" /> {status.label}
                            </span>
                          ) : status.isPastCurfew ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 animate-pulse">
                              <i className="fa-solid fa-triangle-exclamation text-[8px]" /> {status.label}
                            </span>
                          ) : (
                            <p className={`text-xs font-extrabold ${status.color}`}>{status.label}</p>
                          )}
                        </div>

                        {isParent && !mp && (
                          <button onClick={(e) => { e.stopPropagation(); handleKickMember(member); }} className="w-6 h-6 rounded-md bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer shrink-0" title="Remove Member">
                            <i className="fa-solid fa-xmark text-xs" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/* 1. HOMETRACKER PRO BETA REQUEST MODAL                         */}
      {/* ============================================================ */}
      {showProRequestModal && !subscription?.is_plus && isParent && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 relative space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <button
              onClick={() => setShowProRequestModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>

            <div className="text-center">
              <h3 className="text-2xl font-black text-slate-900 mt-2">Request HomeTracker Pro Access</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Apply for lifetime Pro access for your family circle in exchange for monthly product feedback.
              </p>
            </div>

            {/* Explanatory Callout Banner */}
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-950 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-xs text-[#5621bf]">
                <i className="fa-solid fa-hand-holding-heart text-sm" />
                <span>Community Partnership Model</span>
              </div>
              <p className="text-[11px] text-purple-900 font-semibold leading-relaxed">
                HomeTracker Pro is currently provided to selected families who help improve the platform. Instead of paying, Pro members contribute monthly feedback and usage insights.
              </p>
            </div>

            {/* Request Form */}
            <form onSubmit={handleSubmitProRequest} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-black text-slate-700 mb-1">
                  Family Size (Members using phones)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={proReqFamilySize}
                  onChange={(e) => setProReqFamilySize(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold focus:border-[#5621bf] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">
                  Why do you want HomeTracker Pro access? <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={proReqWhyPro}
                  onChange={(e) => setProReqWhyPro(e.target.value)}
                  placeholder="Tell us about your family and how HomeTracker fits into your daily routine..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium focus:border-[#5621bf] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">
                  What specific problems do you want HomeTracker to solve? <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={proReqProblems}
                  onChange={(e) => setProReqProblems(e.target.value)}
                  placeholder="e.g. Knowing when kids arrive at school, traffic ETAs, evening curfews..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium focus:border-[#5621bf] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">
                  Which Pro features are most valuable to your family?
                </label>
                <input
                  type="text"
                  value={proReqFeatures}
                  onChange={(e) => setProReqFeatures(e.target.value)}
                  placeholder="e.g. Dynamic ETAs, 10 member limit, 50 places, 30-day trail"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium focus:border-[#5621bf] outline-none"
                />
              </div>

              {/* Rules Footer */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-500 leading-relaxed">
                <span className="font-bold text-slate-700 block mb-0.5">📜 Pro Access Rules:</span>
                HomeTracker Pro members receive lifetime access in exchange for monthly feedback. All feedback submissions are reviewed. If a user repeatedly submits incomplete or fake feedback, Pro access may be revoked after notification.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProRequestModal(false)}
                  className="w-1/3 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingProReq}
                  className="w-2/3 py-3 rounded-2xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {submittingProReq ? (
                    <i className="fa-solid fa-spinner animate-spin text-sm" />
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane text-xs text-white" /> Submit Pro Application
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. DEACTIVATED MEMBER (PRO REVOKED / CAPACITY EXCEEDED) MODAL*/}
      {/* ============================================================ */}
      {(user?.is_deactivated || subscription?.user_is_deactivated) && (
        <div className="fixed inset-0 z-[9999999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-2xl border-2 border-rose-500/80 relative space-y-5 text-center max-h-[90vh] overflow-y-auto my-auto">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-3xl shadow-sm">
              <i className="fa-solid fa-user-slash" />
            </div>
            <span className="px-3.5 py-1 rounded-full bg-rose-100 text-rose-950 text-[10px] font-black uppercase tracking-wider">
              Circle Capacity Limit
            </span>
            <h3 className="text-2xl font-black text-slate-900">
              Access <span className="text-rose-600 underline decoration-rose-400 decoration-4 underline-offset-4">Paused</span>
            </h3>
            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              Your family circle returned to the Basic Plan (4 members limit). Because your circle exceeds 4 members, your slot has been temporarily paused.
            </p>

            {/* 1-Week Grace Window Callout */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 text-left space-y-2 text-xs text-purple-950 font-medium shadow-xs">
              <div className="font-black text-purple-900 flex items-center gap-1.5 text-xs">
                <i className="fa-solid fa-link text-purple-600" /> Linked to Circle: <span className="font-mono bg-purple-100 px-1.5 py-0.5 rounded text-purple-900">{user?.family_code || subscription?.family_code}</span>
              </div>
              <p className="text-[11px] text-purple-800 leading-relaxed">
                You remain linked to your family circle! If your circle parent upgrades back to <strong>HomeTracker Pro within 1 week (7 days)</strong>, your active membership will be automatically restored without losing any history.
              </p>
              <div className="mt-1 px-3 py-1.5 rounded-xl bg-purple-200/70 text-purple-950 font-black text-[11px] flex items-center gap-1.5">
                <i className="fa-solid fa-clock text-purple-700" />
                Grace Period: Rejoin automatically upon Pro upgrade
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleRemindParentUpgrade}
                disabled={sendingUpgradeRemind}
                className="w-full py-3 px-4 rounded-2xl bg-[#5621bf] hover:bg-[#431799] text-white font-black text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-bolt text-amber-300" />
                {upgradeRemindSent ? 'Upgrade Reminder Sent to Parent!' : sendingUpgradeRemind ? 'Sending Reminder...' : 'Remind Parent to Upgrade to Pro'}
              </button>
              <button
                type="button"
                onClick={refreshData}
                className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-rotate-right" /> Check Status / Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. BLOCKING MONTHLY PRO FEEDBACK REVIEW OVERLAY               */}
      {/* ============================================================ */}
      {subscription?.is_plus && subscription?.feedback_due && !user?.is_deactivated && !subscription?.user_is_deactivated && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          {user?.role === 'parent' ? (
            /* PARENT FEEDBACK FORM */
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-5 sm:p-8 max-w-lg w-full shadow-2xl border-2 border-[#5621bf] relative space-y-4 max-h-[90vh] overflow-y-auto my-auto">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-2xl mb-2 shadow-sm">
                  <i className="fa-solid fa-lock" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-amber-100 text-amber-950 text-[10px] font-black uppercase tracking-wider">
                  Parent Action Required
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-2">
                  Monthly Review <span className="underline decoration-[#5621bf] decoration-4 underline-offset-4">Required</span>
                </h3>
                <p className="text-xs text-slate-600 font-semibold mt-1 leading-relaxed">
                  Your family circle map is temporarily blocked until your monthly product review is submitted. Share your usage feedback below to unblock access &amp; preserve lifetime Pro access.
                </p>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black text-slate-700 mb-1">Times used this month?</label>
                    <select
                      value={fbTimesUsed}
                      onChange={(e) => setFbTimesUsed(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-200/90 font-bold focus:border-[#5621bf] focus:ring-2 focus:ring-[#5621bf]/20 outline-none bg-slate-50/50"
                    >
                      <option value="1-5 times">1-5 times</option>
                      <option value="5-15 times">5-15 times</option>
                      <option value="15-30 times">15-30 times</option>
                      <option value="Daily (30+ times)">Daily (30+ times)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-black text-slate-700 mb-1">Members using app?</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={fbMembersUsed}
                      onChange={(e) => setFbMembersUsed(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-200/90 font-bold focus:border-[#5621bf] focus:ring-2 focus:ring-[#5621bf]/20 outline-none bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-black text-slate-700 mb-1">What situations did you use HomeTracker for?</label>
                  <input
                    type="text"
                    value={fbSituations}
                    onChange={(e) => setFbSituations(e.target.value)}
                    placeholder="e.g. School dismissal check, weekend curfews, road trip tracking..."
                    className="w-full px-3 py-2.5 rounded-2xl border border-slate-200/90 font-medium focus:border-[#5621bf] focus:ring-2 focus:ring-[#5621bf]/20 outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-700 mb-1">
                    What worked well this month? <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={fbWorkedWell}
                    onChange={(e) => setFbWorkedWell(e.target.value)}
                    placeholder="Share features or UI aspects that performed great for your family..."
                    className="w-full px-3 py-2.5 rounded-2xl border border-slate-200/90 font-medium focus:border-[#5621bf] focus:ring-2 focus:ring-[#5621bf]/20 outline-none bg-slate-50/50"
                    required
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-700 mb-1">Did any feature fail or behave unexpectedly?</label>
                  <textarea
                    rows={2}
                    value={fbProblems}
                    onChange={(e) => setFbProblems(e.target.value)}
                    placeholder="Describe any bugs, delayed notifications, or unexpected behaviors..."
                    className="w-full px-3 py-2.5 rounded-2xl border border-slate-200/90 font-medium focus:border-[#5621bf] focus:ring-2 focus:ring-[#5621bf]/20 outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-700 mb-1">
                    What new feature or improvement would help your family most? <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={fbImprovement}
                    onChange={(e) => setFbImprovement(e.target.value)}
                    placeholder="Your feature requests directly enter our engineering sprint..."
                    className="w-full px-3 py-2.5 rounded-2xl border border-slate-200/90 font-medium focus:border-[#5621bf] focus:ring-2 focus:ring-[#5621bf]/20 outline-none bg-slate-50/50"
                    required
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-700 mb-1">How likely are you to recommend HomeTracker (1-10)?</label>
                  <div className="flex gap-1 justify-between">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setFbRecScore(score)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border ${
                          fbRecScore === score
                            ? 'bg-[#5621bf] text-white border-[#5621bf]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingFb}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#5621bf] to-indigo-600 hover:from-[#431799] hover:to-indigo-700 text-white font-black text-sm shadow-lg shadow-purple-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {submittingFb ? (
                    <i className="fa-solid fa-spinner animate-spin text-sm" />
                  ) : (
                    <>
                      <i className="fa-solid fa-unlock text-xs text-purple-300" /> Submit Review &amp; Unblock Circle
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* CHILD / TEEN WAITING MODAL */
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-2xl border-2 border-purple-500/80 relative space-y-5 text-center max-h-[90vh] overflow-y-auto my-auto">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 text-[#5621bf] flex items-center justify-center mx-auto text-3xl shadow-sm animate-pulse">
                <i className="fa-solid fa-hourglass-half" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                Monthly Review <span className="text-[#5621bf] underline decoration-purple-400 decoration-4 underline-offset-4">Pending</span>
              </h3>
              <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                Your family circle's monthly HomeTracker Pro survey is currently active. Only parent accounts can complete this review. Please ask your circle parent to complete the review to unblock access!
              </p>
              <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200/80 text-left space-y-1.5 text-xs text-purple-900 font-medium">
                <div className="font-black text-purple-950 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-info text-[#5621bf]" /> Instructions:
                </div>
                <p className="text-[11px] text-purple-800">
                  1. Remind your circle parent to open HomeTracker on their device.
                </p>
                <p className="text-[11px] text-purple-800">
                  2. Once your parent submits the 1-minute feedback survey, your circle features will unblock automatically.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRemindParentSurvey}
                  disabled={sendingSurveyRemind}
                  className="w-full py-3 px-4 rounded-2xl bg-[#5621bf] hover:bg-[#431799] text-white font-black text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-paper-plane" />
                  {surveyRemindSent ? 'Reminder Sent to Parent!' : sendingSurveyRemind ? 'Sending Reminder...' : 'Remind Parent to Complete Survey'}
                </button>
                <button
                  type="button"
                  onClick={refreshData}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-rotate-right" /> Check Status / Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Non-blocking feedback modal fallback */}
      {showFeedbackModal && !subscription?.feedback_due && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 relative space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <button
              onClick={() => setShowFeedbackModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>

            <div className="text-center">
              <h3 className="text-2xl font-black text-slate-900 mt-2">
                Monthly Product <span className="underline decoration-[#5621bf] decoration-2 underline-offset-4">Review</span>
              </h3>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-black text-slate-700 mb-1">What worked well this month? *</label>
                <textarea
                  rows={2}
                  value={fbWorkedWell}
                  onChange={(e) => setFbWorkedWell(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium focus:border-[#5621bf] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-black text-slate-700 mb-1">Feature improvements or ideas? *</label>
                <textarea
                  rows={2}
                  value={fbImprovement}
                  onChange={(e) => setFbImprovement(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium focus:border-[#5621bf] outline-none"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="w-1/3 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submittingFb}
                  className="w-2/3 py-3 rounded-2xl bg-[#5621bf] text-white font-black text-xs shadow-md transition cursor-pointer"
                >
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. ADMIN MANAGEMENT CONTROL PANEL MODAL                      */}
      {/* ============================================================ */}
      {showAdminModal && user?.role === 'admin' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[88vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden relative">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#5621bf] text-white flex items-center justify-center text-base shadow-sm">
                  <i className="fa-solid fa-user-gear" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                    <span>HomeTracker Admin System</span>
                    <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                      Admin
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300 font-semibold">Pro Access Governance &amp; Community Product Reviews</p>
                </div>
              </div>

              <button
                onClick={() => setShowAdminModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Clean Navigation Tabs */}
            <div className="bg-slate-100/80 px-6 py-2 border-b border-slate-200 flex gap-2 overflow-x-auto shrink-0">
              <button
                onClick={() => { setAdminTab('stats'); fetchAdminData('stats'); }}
                className={`px-4 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  adminTab === 'stats' ? 'bg-[#5621bf] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <i className="fa-solid fa-chart-pie" /> Overview Stats
              </button>

              <button
                onClick={() => { setAdminTab('requests'); fetchAdminData('requests'); }}
                className={`px-4 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  adminTab === 'requests' ? 'bg-[#5621bf] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <i className="fa-solid fa-paper-plane" /> Pro Requests
                {adminStats?.pending_requests > 0 && (
                  <span className="bg-[#5621bf] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {adminStats.pending_requests}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setAdminTab('users'); fetchAdminData('users'); }}
                className={`px-4 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  adminTab === 'users' ? 'bg-[#5621bf] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <i className="fa-solid fa-users" /> User &amp; Circle Management
              </button>

              <button
                onClick={() => { setAdminTab('feedback'); fetchAdminData('feedback'); }}
                className={`px-4 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  adminTab === 'feedback' ? 'bg-[#5621bf] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <i className="fa-solid fa-comments" /> Monthly Reviews
              </button>
            </div>

            {/* Tab Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 custom-scroll">
              {loadingAdminData && (
                <div className="flex justify-center items-center py-12 text-[#5621bf]">
                  <i className="fa-solid fa-spinner animate-spin text-3xl" />
                </div>
              )}

              {/* 1. OVERVIEW STATS TAB */}
              {!loadingAdminData && adminTab === 'stats' && adminStats && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400">Total Users</p>
                      <p className="text-2xl font-black text-slate-900">{adminStats.total_users}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400">Free Users</p>
                      <p className="text-2xl font-black text-slate-700">{adminStats.free_users}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 shadow-xs text-center space-y-1">
                      <p className="text-[10px] font-black uppercase text-[#5621bf]">Pro Members</p>
                      <p className="text-2xl font-black text-[#5621bf]">{adminStats.pro_users}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 shadow-xs text-center space-y-1">
                      <p className="text-[10px] font-black uppercase text-purple-800">Pending Requests</p>
                      <p className="text-2xl font-black text-purple-900">{adminStats.pending_requests}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-xs text-center space-y-1">
                      <p className="text-[10px] font-black uppercase text-indigo-800">Feedback Reviews</p>
                      <p className="text-2xl font-black text-indigo-900">{adminStats.total_feedback}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400">Family Circles</p>
                      <p className="text-2xl font-black text-slate-900">{adminStats.total_circles}</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-50 via-white to-purple-50 border border-purple-200/80 space-y-3 shadow-xs">
                    <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                      <i className="fa-solid fa-shield-halved text-[#5621bf]" />
                      <span className="underline decoration-[#5621bf] decoration-2 underline-offset-4">Pro Governance Principles</span>
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                      <li>• <strong>Community Partnership:</strong> Pro members receive lifetime access in exchange for active monthly product feedback.</li>
                      <li>• <strong>Fair Evaluation:</strong> Review why applicants want Pro access and their intended family setup.</li>
                      <li>• <strong>Quality Enforcement:</strong> Users who repeatedly submit empty or fake feedback can have Pro access revoked by Admins.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 2. PRO REQUESTS TAB */}
              {!loadingAdminData && adminTab === 'requests' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 text-sm border-b-2 border-[#5621bf] pb-1">
                      Pro Applications ({adminRequests.length})
                    </h4>
                  </div>

                  {adminRequests.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs font-semibold">
                      No Pro applications found.
                    </div>
                  ) : (
                    adminRequests.map((req) => (
                      <div key={req.id} className="p-5 rounded-3xl bg-white border border-purple-100 space-y-3 shadow-xs hover:border-[#5621bf]/40 transition-all">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div>
                            <span className="text-sm font-black text-slate-900">{req.user_name}</span>
                            <span className="text-xs text-slate-400 font-semibold ml-2">({req.email})</span>
                            <span className="text-xs font-black text-[#5621bf] bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-lg ml-2">
                              Code: {req.family_code}
                            </span>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                            req.status === 'approved' ? 'bg-purple-100 text-purple-800' :
                            req.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-900'
                          }`}>
                            {req.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Family Size</span>
                            <p className="font-bold text-slate-800">{req.family_size} Members</p>
                          </div>
                          <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1 sm:col-span-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Why Pro Wanted</span>
                            <p className="font-medium text-slate-800">{req.why_pro}</p>
                          </div>
                          <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1 sm:col-span-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Problems To Solve</span>
                            <p className="font-medium text-slate-800">{req.problems_to_solve}</p>
                          </div>
                        </div>

                        {req.status === 'pending' && (
                          <div className="pt-2 flex flex-col sm:flex-row gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Admin Notes / Rationale (optional)..."
                              value={selectedReqId === req.id ? adminNoteInput : ''}
                              onChange={(e) => {
                                setSelectedReqId(req.id);
                                setAdminNoteInput(e.target.value);
                              }}
                              className="w-full sm:flex-1 px-3.5 py-2 rounded-2xl border border-slate-300 text-xs font-medium focus:border-[#5621bf] outline-none"
                            />
                            <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                              <button
                                onClick={() => handleAdminActionRequest(req.id, 'reject')}
                                className="flex-1 sm:flex-none px-4 py-2 rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold text-xs transition cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleAdminActionRequest(req.id, 'approve')}
                                className="flex-1 sm:flex-none px-4 py-2 rounded-2xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-xs shadow-md transition cursor-pointer"
                              >
                                Approve Lifetime Pro Access
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 3. USER MANAGEMENT TAB */}
              {!loadingAdminData && adminTab === 'users' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search users by name, email, family code..."
                      value={adminUserSearch}
                      onChange={(e) => setAdminUserSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchAdminData('users', adminUserSearch)}
                      className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-300 text-xs font-semibold focus:border-[#5621bf] outline-none bg-white shadow-xs"
                    />
                    <button
                      onClick={() => fetchAdminData('users', adminUserSearch)}
                      className="px-5 py-2.5 rounded-2xl bg-[#5621bf] text-white font-extrabold text-xs shadow-md hover:bg-[#431799] cursor-pointer"
                    >
                      Search
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-purple-50/80 text-purple-900 font-black uppercase text-[10px] border-b border-purple-100">
                        <tr>
                          <th className="p-3.5">User</th>
                          <th className="p-3.5">Role / Code</th>
                          <th className="p-3.5">Pro Status</th>
                          <th className="p-3.5">Circle Tier</th>
                          <th className="p-3.5">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {adminUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-purple-50/30 transition-colors">
                            <td className="p-3.5 font-extrabold text-slate-900">
                              <div>{u.name}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{u.email}</div>
                            </td>
                            <td className="p-3.5">
                              <span className="font-bold text-slate-700">{u.role}</span>
                              <div className="text-[10px] text-[#5621bf] font-mono font-bold">{u.family_code}</div>
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                u.pro_status === 'approved' ? 'bg-purple-100 text-purple-800' :
                                u.pro_status === 'requested' ? 'bg-amber-100 text-amber-800' :
                                u.pro_status === 'revoked' ? 'bg-rose-100 text-rose-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {u.pro_status || 'none'}
                              </span>
                            </td>
                            <td className="p-3.5 font-black text-[#5621bf]">
                              {u.subscription_tier === 'plus' ? 'PRO PLUS' : 'BASIC'}
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {u.pro_status === 'approved' ? (
                                  <button
                                    onClick={() => handleAdminUserAction(u.id, 'revoke_pro')}
                                    className="px-2.5 py-1 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-black cursor-pointer"
                                  >
                                    Revoke Pro
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleAdminUserAction(u.id, 'grant_pro')}
                                    className="px-2.5 py-1 rounded-xl bg-[#5621bf] hover:bg-[#431799] text-white text-[10px] font-black cursor-pointer shadow-xs"
                                  >
                                    Grant Pro
                                  </button>
                                )}

                                {u.role !== 'admin' && (
                                  <button
                                    onClick={() => handleAdminUserAction(u.id, 'set_role_admin')}
                                    className="px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-black cursor-pointer shadow-xs flex items-center gap-1"
                                    title="Promote to Admin & strip family circle"
                                  >
                                    <i className="fa-solid fa-user-shield text-[9px]" /> Make Admin
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. MONTHLY FEEDBACK TAB */}
              {!loadingAdminData && adminTab === 'feedback' && (
                <div className="space-y-4">
                  <h4 className="font-black text-slate-900 text-sm border-b-2 border-[#5621bf] pb-1">
                    Monthly Feedback Reviews ({adminFeedbackList.length})
                  </h4>

                  {adminFeedbackList.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs font-semibold">
                      No monthly feedback submissions found.
                    </div>
                  ) : (
                    adminFeedbackList.map((fb) => (
                      <div key={fb.id} className="p-5 rounded-3xl bg-white border border-purple-100 space-y-2.5 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div>
                            <span className="font-black text-slate-900 text-sm">{fb.user_name}</span>
                            <span className="text-xs text-slate-400 ml-2">({fb.user_email})</span>
                            <span className="text-xs font-extrabold text-[#5621bf] bg-purple-50 px-2.5 py-0.5 rounded-lg ml-2">
                              Month: {fb.month_year}
                            </span>
                          </div>
                          <span className="text-xs font-black text-purple-600 bg-purple-50 border border-purple-200 px-3 py-0.5">
                            Score: {fb.recommendation_score}/10
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                          <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-100">
                            <span className="text-[10px] font-black uppercase text-purple-800 block mb-0.5">What Worked Well</span>
                            <p className="font-medium text-slate-800 leading-relaxed">{fb.worked_well}</p>
                          </div>

                          <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                            <span className="text-[10px] font-black uppercase text-indigo-800 block mb-0.5">Feature Improvements / Ideas</span>
                            <p className="font-medium text-slate-800 leading-relaxed">{fb.features_to_improve}</p>
                          </div>

                          {fb.problems_encountered && (
                            <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200 sm:col-span-2">
                              <span className="text-[10px] font-black uppercase text-slate-800 block mb-0.5">Bugs / Issues Reported</span>
                              <p className="font-medium text-slate-800 leading-relaxed">{fb.problems_encountered}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pro Beta Rules Info Modal */}
      {showPaymentInfoModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 relative space-y-4 max-h-[90vh] overflow-y-auto my-auto">
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
              <h3 className="text-xl font-black text-slate-900">
                Pro Membership <span className="underline decoration-[#5621bf] decoration-2 underline-offset-4">Rules</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                HomeTracker Pro is provided to selected users who help improve the platform through monthly feedback reviews.
              </p>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-[#5621bf] flex items-center justify-center shrink-0 mt-0.5">
                  <i className="fa-solid fa-paper-plane text-xs" />
                </div>
                <div>
                  <p className="font-extrabold text-slate-900">Application &amp; Manual Review</p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Users submit a request form explaining their family setup. Applications are reviewed manually by our admin team.
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

            {isParent && !isPlusCircle && subscription?.pro_status !== 'requested' && (
              <button
                onClick={() => { setShowPaymentInfoModal(false); setShowProRequestModal(true); }}
                className="w-full py-3 rounded-2xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-paper-plane text-xs text-white" /> Request Pro Access
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
