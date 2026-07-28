'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';

// ============================================================
// Constants
// ============================================================
const AT_HOME_THRESHOLD_KM = 0.1; // 100 meters

// Helper: Check if current time falls within 4-hour curfew window
function checkIsPastCurfew(targetHomeTime) {
  if (!targetHomeTime) return false;
  const [curfewH, curfewM] = targetHomeTime.split(':').map(Number);
  if (isNaN(curfewH) || isNaN(curfewM)) return false;
  const curfewMinutes = curfewH * 60 + curfewM;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const windowEnd = (curfewMinutes + 4 * 60) % 1440;
  if (curfewMinutes < windowEnd) {
    return currentMinutes >= curfewMinutes && currentMinutes < windowEnd;
  } else {
    return currentMinutes >= curfewMinutes || currentMinutes < windowEnd;
  }
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
  useEffect(() => { setInputValue(''); }, [modal]);

  if (!modal) return null;
  const iconBgClass = modal.type === 'error' ? 'bg-rose-100 text-rose-600' : modal.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600';
  const iconClass = modal.type === 'error' ? 'fa-circle-exclamation' : modal.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check';
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4 text-center border border-white/60">
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
            <button onClick={() => { modal.onConfirm(inputValue); onClose(); }} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer">
              {modal.confirmText || 'Confirm'}
            </button>
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
  
  const [notifications, setNotifications] = useState([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      // Await it so any newly-created notifications are picked up by the fetch below.
      await fetch('/api/notifications/check').catch(() => {});

      const [homeRes, membersRes, notifRes] = await Promise.all([
        fetch('/api/circle/home').then((r) => r.json()),
        fetch('/api/circle/members').then((r) => r.json()),
        fetch('/api/notifications').then((r) => r.json()),
      ]);

      if (homeRes.home) setHome(homeRes.home);
      if (membersRes.members) setMembers(membersRes.members);
      if (notifRes.notifications) setNotifications(notifRes.notifications);
    } catch (e) {
      console.error('Refresh error:', e);
    }
  }, [user]);

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

    // Member markers (children only)
    members.forEach((member) => {
      if (member.role === 'child' && member.current_lat && member.current_lng) {
        const initials = (member.name || 'C').substring(0, 2).toUpperCase();
        const distKm = home?.home_lat ? calculateDistanceKm(member.current_lat, member.current_lng, home.home_lat, home.home_lng) : 999;
        const isAtHome = distKm <= AT_HOME_THRESHOLD_KM;
        const isPastCurfew = !isAtHome && checkIsPastCurfew(home?.target_home_time);

        const memberIcon = L.divIcon({
          className: 'custom-pin-wrap',
          html: `<div class="custom-map-pin ${isAtHome ? 'pin-home' : isPastCurfew ? 'pin-curfew' : 'pin-member'} w-9 h-9"><span class="text-xs">${initials}</span></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const eta = etaCache[member.id];
        let popupText;
        if (isAtHome) {
          popupText = `<div class="p-1 text-center font-bold"><p class="text-xs text-slate-900">${member.name}</p><p class="text-[10px] text-emerald-600 mt-1 font-extrabold">At Home</p></div>`;
        } else if (isPastCurfew) {
          popupText = `<div class="p-1 text-center font-bold"><p class="text-xs text-slate-900">${member.name}</p><p class="text-[10px] text-rose-600 mt-1 font-black">⚠️ Past Curfew (${home.target_home_time})</p>${eta ? `<p class="text-[9px] text-slate-500 mt-0.5">${eta.distance_km} km &middot; ~${eta.duration_min} min</p>` : ''}</div>`;
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
  }, [home, members, etaCache]);

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
      navigator.clipboard.writeText(code).catch(() => fallbackCopyTextToClipboard(code));
    } else {
      fallbackCopyTextToClipboard(code);
    }

    setCopyIcon('fa-solid fa-check text-emerald-500');
    setTimeout(() => setCopyIcon('fa-regular fa-copy'), 2000);
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
        setModal({ type: 'error', title: 'Error', message: data.error || 'Failed to join family.' });
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
        className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm hover:shadow-md hover:border-[#5621bf]/30 transition-all duration-200 active:scale-98 cursor-pointer relative"
        aria-expanded={showNotificationsMenu}
        aria-haspopup="true"
      >
        <i className="fa-solid fa-bell text-slate-500 text-sm group-hover:text-[#5621bf] transition-colors" />
        {unreadNotifications.length > 0 && (
          <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_0_2px_rgba(255,255,255,1)]" />
        )}
      </button>

      {/* Dropdown Menu */}
      <div ref={notificationDropdownRef} style={{ display: 'none', opacity: 0, visibility: 'hidden' }} className="absolute right-[-52px] sm:right-0 mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 z-50 origin-top-right overflow-hidden flex-col max-h-[400px]">
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

  const renderProfileDropdown = () => (
    <div className="relative" ref={profileMenuRef}>
      <button
        onClick={() => setShowProfileMenu(!showProfileMenu)}
        onMouseEnter={hoverScaleIn}
        onMouseLeave={hoverScaleOut}
        className="h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm hover:shadow-md hover:border-[#5621bf]/30 transition-all duration-200 active:scale-98 cursor-pointer"
        aria-expanded={showProfileMenu}
        aria-haspopup="true"
      >
        <div className="w-7 h-7 rounded-full avatar-gradient text-white flex items-center justify-center text-[10px] font-black shadow-sm shrink-0">
          {(user?.name || 'U').substring(0, 2).toUpperCase()}
        </div>
        <span className="hidden sm:block text-xs font-extrabold text-slate-900 truncate max-w-[100px]">
          {user?.name}
        </span>
        <i className={`fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 ${showProfileMenu ? 'rotate-180 text-[#5621bf]' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <div ref={profileDropdownRef} style={{ display: 'none', opacity: 0, visibility: 'hidden' }} className="absolute right-0 mt-2 w-64 sm:w-72 bg-white/95 backdrop-blur-xl rounded-2xl p-3 sm:p-4 shadow-2xl border border-slate-200/90 z-50">
          {/* Profile Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full avatar-gradient text-white flex items-center justify-center text-sm font-black shadow-sm shrink-0">
              {(user?.name || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs font-medium text-slate-500 truncate">{user?.email}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${isParent ? 'bg-[#5621bf]/10 text-[#5621bf]' : 'bg-amber-100 text-amber-800'}`}>
                {isParent ? 'Parent Account' : 'Child / Teen Account'}
              </span>
            </div>
          </div>

          {/* Family Code row */}
          <div className="py-2.5 px-3 my-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase text-slate-400">Family Code</p>
              <p className="text-xs font-black text-[#5621bf] tracking-widest">{user?.family_code || '--'}</p>
            </div>
            {user?.family_code && (
              <button onClick={handleCopyCode} className="text-xs font-bold text-slate-500 hover:text-[#5621bf] p-1 transition flex items-center gap-1 cursor-pointer">
                <i className={copyIcon} />
              </button>
            )}
          </div>

          {/* Menu Actions */}
          <div className="pt-1 space-y-1">
            {!isParent && user?.family_code && (
              <button
                onClick={handleLeaveCircle}
                onMouseEnter={hoverScaleIn}
                onMouseLeave={hoverScaleOut}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-600 font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
              >
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-person-walking-arrow-right text-sm group-hover:-translate-x-0.5 transition-transform" />
                  Leave Family Circle
                </span>
                <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
              </button>
            )}
            <button
              onClick={handleSignOut}
              onMouseEnter={hoverScaleIn}
              onMouseLeave={hoverScaleOut}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold text-xs transition-colors duration-150 group cursor-pointer mb-1"
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-right-from-bracket text-sm group-hover:-translate-x-0.5 transition-transform" />
                Sign Out
              </span>
              <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
            </button>
            <button
              onClick={handleDeleteAccount}
              onMouseEnter={hoverScaleIn}
              onMouseLeave={hoverScaleOut}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs transition-colors duration-150 group cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-trash-can text-sm group-hover:-translate-y-0.5 transition-transform" />
                Delete Account
              </span>
              <i className="fa-solid fa-chevron-right text-[10px] opacity-60" />
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

    if (isAtHome) {
      childStatus = { isAtHome: true, text: "You're Home", subtitle: 'You are within range of your Home Base.' };
    } else if (selfEta) {
      let leaveByText = '';
      let subtitle = `${selfEta.distance_km} km from Home by bike (~${selfEta.duration_min} min).`;
      if (home.target_home_time) {
        const [tH, tM] = home.target_home_time.split(':').map(Number);
        const targetDate = new Date();
        targetDate.setHours(tH, tM, 0, 0);
        const leaveDate = new Date(targetDate.getTime() - selfEta.duration_min * 60000);
        leaveByText = `${String(leaveDate.getHours()).padStart(2, '0')}:${String(leaveDate.getMinutes()).padStart(2, '0')}`;
        subtitle = `Leave by ${leaveByText} to arrive by ${home.target_home_time}.`;
      }
      childStatus = { isAtHome: false, travelMin: selfEta.duration_min, leaveBy: leaveByText, subtitle, distKm: selfEta.distance_km };
    } else {
      childStatus = { isAtHome: false, travelMin: '--', leaveBy: '', subtitle: `${dist.toFixed(1)} km from Home. Calculating route...`, distKm: dist.toFixed(1) };
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
  const homeIsSet = home?.home_address;

  // ---- Helper: get member status info ----
  const getMemberStatus = (member) => {
    if (member.role === 'parent') return { label: 'Home', color: 'text-slate-500', badge: null };
    if (!member.current_lat || !home?.home_lat) return { label: 'Location unknown', color: 'text-slate-400', badge: null };

    const dist = calculateDistanceKm(member.current_lat, member.current_lng, home.home_lat, home.home_lng);
    if (dist <= AT_HOME_THRESHOLD_KM) {
      return { label: 'At Home', color: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', isHome: true };
    }

    const isPastCurfew = checkIsPastCurfew(home?.target_home_time);
    const eta = etaCache[member.id];

    if (isPastCurfew) {
      return {
        label: 'Past Curfew',
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

  if (user && !user.family_code) {
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

  return (
    <div className="min-h-screen min-h-dvh flex flex-col relative overflow-x-hidden">
      <CustomModal modal={modal} onClose={() => setModal(null)} />

      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#e2f0ff]/60 via-purple-100/30 to-transparent blur-3xl -z-10 pointer-events-none" />
      <WaveBackground />

      {renderToast()}

      {/* ===== Header ===== */}
      <header className="w-full px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2 group">
            <Image src="/logo.png" alt="HOMETRACKER Logo" width={36} height={36} className="w-7 h-7 sm:w-9 sm:h-9 object-contain group-hover:scale-105 transition-transform duration-300" />
            <span className="font-extrabold text-sm sm:text-lg tracking-tight text-slate-900">
              HOME<span className="text-[#5621bf]">TRACKER</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Center Home button */}
          {homeIsSet && (
            <button onClick={centerMapOnHome} onMouseEnter={hoverScaleIn} onMouseLeave={hoverScaleOut} className="h-9 sm:h-10 px-2 sm:px-3 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 text-xs font-bold shadow-sm hover:bg-white transition flex items-center gap-1 sm:gap-1.5 cursor-pointer">
              <i className="fa-solid fa-house text-[#5621bf] text-[11px]" />
              <span className="hidden sm:inline">Center Home</span>
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
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Members</span>
          </div>
        </div>

        {/* INFO PANEL (bottom on mobile, left sidebar on desktop) */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col min-h-0 lg:order-1 lg:border-r lg:border-slate-200/60 bg-white/70 lg:bg-white/50 backdrop-blur-sm">
          <div className="flex-1 overflow-y-auto custom-scroll p-3 sm:p-4 space-y-3">

            {/* Child status banner */}
            {!isParent && childStatus && (
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

            {/* Home info (compact) */}
            <div className="p-3 rounded-xl bg-white/80 border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-house text-[#5621bf] text-sm" />
                  <span className="text-xs font-black text-slate-900 truncate">{home?.home_address || 'No Home set'}</span>
                </div>
                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${homeIsSet ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                  {homeIsSet ? 'Set' : 'Not Set'}
                </span>
              </div>
              {home?.target_home_time && (
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <i className="fa-solid fa-clock text-[10px]" />
                  <span>Curfew: <span className="font-black text-[#5621bf]">{home.target_home_time}</span></span>
                </div>
              )}
            </div>

            {/* Settings panel (parent) */}
            {isParent && (
              <div className="rounded-xl bg-slate-50/90 border border-slate-200 overflow-hidden">
                <button 
                  onClick={() => setShowSettings(!showSettings)} 
                  className="w-full flex items-center justify-between p-3 cursor-pointer select-none"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <i className="fa-solid fa-gear text-[#5621bf]" /> Family Settings
                  </p>
                  <i className={`fa-solid fa-chevron-down text-slate-400 text-[10px] transition-transform duration-300 ${showSettings ? 'rotate-180 text-[#5621bf]' : ''}`} />
                </button>
                
                <div ref={settingsContentRef} className="overflow-hidden" style={{ height: showSettings ? 'auto' : 0, opacity: showSettings ? 1 : 0 }}>
                  <div className="px-3 pb-3 space-y-3">
                    {/* Home Address */}
                    <div className="space-y-1.5 border-t border-slate-200 pt-3">
                      <label className="block text-[10px] font-extrabold uppercase text-slate-500">Home Address</label>
                      <div className="relative">
                        <i className="fa-solid fa-location-dot absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input type="text" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)}
                          placeholder="e.g. 742 Evergreen Terrace, Springfield"
                          className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 focus:border-[#5621bf] outline-none bg-white" />
                      </div>
                    </div>
                    {/* Curfew */}
                    <div className="pt-1 space-y-1.5">
                      <label className="block text-[10px] font-extrabold uppercase text-slate-500">Curfew Time</label>
                      <input type="time" value={targetTime} onChange={(e) => setTargetTime(e.target.value)}
                        className="w-full py-2 px-3 text-xs font-bold rounded-lg border border-slate-300 focus:border-[#5621bf] outline-none bg-white" />
                    </div>
                    {/* Save Settings Button */}
                    <div className="pt-2">
                      <button 
                        onClick={handleSaveSettings} 
                        disabled={!homeAddress.trim() || !targetTime}
                        className={`w-full py-2.5 font-extrabold text-xs rounded-lg transition flex items-center justify-center gap-1.5 ${!homeAddress.trim() || !targetTime ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#5621bf] hover:bg-[#431799] text-white active:scale-95 cursor-pointer shadow-md'}`}>
                        <i className="fa-solid fa-floppy-disk" /> Save Family Settings
                      </button>
                    </div>
                    {/* Delete Circle */}
                    <div className="pt-3 mt-1 border-t border-rose-100 space-y-1.5">
                      <button onClick={handleDeleteCircle} className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs rounded-lg transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-rose-200">
                        <i className="fa-solid fa-trash-can" /> Delete Family Circle
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Family Members */}
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <i className="fa-solid fa-users text-[#5621bf] text-[11px]" /> Family ({members.length})
              </p>
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold">
                              <i className="fa-solid fa-house-chimney text-[8px]" /> At Home
                            </span>
                          ) : status.isPastCurfew ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black animate-pulse">
                              <i className="fa-solid fa-triangle-exclamation text-[8px]" /> Past Curfew
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
    </div>
  );
}
