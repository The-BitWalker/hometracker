'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// ============================================================
// Utility functions
// ============================================================
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateTravelTimeMins(distanceKm) {
  if (!distanceKm || distanceKm <= 0.05) return 0;
  return Math.ceil(((distanceKm * 1.3) / 30) * 60) + 2;
}

// ============================================================
// Custom Modal Component
// ============================================================
function CustomModal({ modal, onClose }) {
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
        </div>
        <button onClick={onClose} className="w-full py-2.5 bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-xs rounded-xl shadow-md transition active:scale-95">
          Got it
        </button>
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
  const [copyIcon, setCopyIcon] = useState('fa-regular fa-copy');

  // Form state
  const [homeAddress, setHomeAddress] = useState('');
  const [targetTime, setTargetTime] = useState('');

  // Map
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const routeLinesRef = useRef([]);

  // GPS
  const watchIdRef = useRef(null);
  const liveGPSRef = useRef({ lat: null, lng: null });

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

  // ---- Refresh Data ----
  const refreshData = useCallback(async () => {
    if (!user) return;

    try {
      const [homeRes, membersRes] = await Promise.all([
        fetch('/api/circle/home').then((r) => r.json()),
        fetch('/api/circle/members').then((r) => r.json()),
      ]);

      if (homeRes.home) setHome(homeRes.home);
      if (membersRes.members) setMembers(membersRes.members);
    } catch (e) {
      console.error('Refresh error:', e);
    }
  }, [user]);

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
        navigator.geolocation.getCurrentPosition(() => {}, () => {});
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
        .bindPopup(`<div class="p-1 font-bold text-center"><p class="text-xs text-purple-900">🏠 Home</p><p class="text-[10px] text-slate-500">${home.home_address || 'Home'}</p></div>`)
        .addTo(map);
      markersRef.current.home = marker;
      bounds.push([home.home_lat, home.home_lng]);
    }

    // Member markers (children only)
    members.forEach((member) => {
      if (member.role === 'child' && member.current_lat && member.current_lng) {
        const initials = (member.name || 'C').substring(0, 2).toUpperCase();
        const memberIcon = L.divIcon({
          className: 'custom-pin-wrap',
          html: `<div class="custom-map-pin pin-member w-9 h-9"><span class="text-xs">${initials}</span></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        let distKm = 0, travelMins = 0;
        if (home?.home_lat) {
          distKm = calculateDistanceKm(member.current_lat, member.current_lng, home.home_lat, home.home_lng);
          travelMins = calculateTravelTimeMins(distKm);
        }

        const marker = L.marker([member.current_lat, member.current_lng], { icon: memberIcon })
          .bindPopup(`<div class="p-1 text-center font-bold"><p class="text-xs text-slate-900">${member.name}</p><p class="text-[10px] text-[#5621bf] mt-1">${distKm.toFixed(1)} km to Home (~${travelMins} min)</p></div>`)
          .addTo(map);
        markersRef.current[member.id] = marker;
        bounds.push([member.current_lat, member.current_lng]);

        if (home?.home_lat) {
          const line = L.polyline([[member.current_lat, member.current_lng], [home.home_lat, home.home_lng]], {
            color: '#3b82f6', weight: 3, dashArray: '5, 8', opacity: 0.7,
          }).addTo(map);
          routeLinesRef.current.push(line);
        }
      }
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [50, 50] });
    else if (bounds.length === 1) map.setView(bounds[0], 14);
  }, [home, members]);

  // ---- Actions ----
  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/auth';
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user?.family_code || '').catch(() => {});
    setCopyIcon('fa-solid fa-check text-emerald-500');
    setTimeout(() => setCopyIcon('fa-regular fa-copy'), 2000);
  };

  const handleSaveAddress = async () => {
    if (!homeAddress.trim()) { setModal({ type: 'warning', title: 'Invalid Address', message: 'Please enter a valid home address.' }); return; }
    try {
      const res = await fetch('/api/circle/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_address: homeAddress.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setModal({ type: 'success', title: 'Home Base Saved 🎉', message: 'Our Home address has been updated successfully!' });
        setShowSettings(false);
        await refreshData();
      } else {
        setModal({ type: 'error', title: 'Error', message: data.error });
      }
    } catch (e) {
      setModal({ type: 'error', title: 'Error', message: e.message });
    }
  };

  const handleSaveTime = async () => {
    if (!targetTime) { setModal({ type: 'warning', title: 'Select Time', message: 'Please select a time to be home.' }); return; }
    try {
      const res = await fetch('/api/circle/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_home_time: targetTime }),
      });
      if (res.ok) {
        setModal({ type: 'success', title: 'Time Saved ⏰', message: 'Time to be Home has been updated for your family!' });
        setShowSettings(false);
        await refreshData();
      }
    } catch (e) {
      setModal({ type: 'error', title: 'Error', message: e.message });
    }
  };

  const handleDismissTip = () => {
    if (user?.id) localStorage.setItem('ht_tip_dismissed_' + user.id, 'true');
    setShowTip(false);
  };

  const centerMapOnHome = () => {
    if (home?.home_lat && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([home.home_lat, home.home_lng], 14, { duration: 1 });
    }
  };

  // ---- Departure Calculation (children only) ----
  let travelTimeText = '-- min';
  let leaveByText = '--:--';
  let calcSubtitle = 'Waiting for Home location setup.';
  
  // Create state to store GPS position for rendering
  const [currentGPS, setCurrentGPS] = useState({ lat: null, lng: null });

  useEffect(() => {
    // Keep state synced with the ref for rendering purposes if it's a child
    if (user?.role === 'child') {
      const interval = setInterval(() => {
        if (liveGPSRef.current.lat !== currentGPS.lat || liveGPSRef.current.lng !== currentGPS.lng) {
          setCurrentGPS({ lat: liveGPSRef.current.lat, lng: liveGPSRef.current.lng });
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [user, currentGPS.lat, currentGPS.lng]);

  if (user?.role === 'child' && home?.home_lat) {
    const userLat = currentGPS.lat;
    const userLng = currentGPS.lng;

    if (userLat) {
      const distKm = calculateDistanceKm(userLat, userLng, home.home_lat, home.home_lng);
      const travelMins = calculateTravelTimeMins(distKm);
      travelTimeText = `${travelMins} min`;

      if (home.target_home_time) {
        const [tH, tM] = home.target_home_time.split(':').map(Number);
        const targetDate = new Date();
        targetDate.setHours(tH, tM, 0, 0);
        const leaveDate = new Date(targetDate.getTime() - travelMins * 60000);
        leaveByText = `${String(leaveDate.getHours()).padStart(2, '0')}:${String(leaveDate.getMinutes()).padStart(2, '0')}`;
        calcSubtitle = `Leave by ${leaveByText} to reach Home by ${home.target_home_time} (${distKm.toFixed(1)} km away).`;
      } else {
        calcSubtitle = `${distKm.toFixed(1)} km from Home. Time to be home not set by parent yet.`;
      }
    }
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

  return (
    <div className="fixed inset-0 flex flex-col justify-between overflow-hidden">
      <CustomModal modal={modal} onClose={() => setModal(null)} />

      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#e2f0ff]/60 via-purple-100/30 to-transparent blur-3xl -z-10 pointer-events-none" />
      <WaveBackground />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between z-20 shrink-0">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
          <Image src="/logo.png" alt="HOMETRACKER Logo" width={36} height={36} className="w-7 h-7 sm:w-9 sm:h-9 object-contain group-hover:scale-105 transition-transform duration-300" />
          <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900">HOME<span className="text-[#5621bf]">TRACKER</span></span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm">
            <div className="w-6 h-6 rounded-full avatar-gradient text-white flex items-center justify-center text-[10px] font-black">{(user?.name || 'U').substring(0, 2).toUpperCase()}</div>
            <span className="text-xs font-bold text-slate-800">{user?.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${isParent ? 'bg-[#5621bf]/10 text-[#5621bf]' : 'bg-amber-100 text-amber-800'}`}>
              {isParent ? 'Parent' : 'Child / Teen'}
            </span>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-600 font-extrabold text-xs transition-all duration-200 active:scale-95">
            <i className="fa-solid fa-right-from-bracket text-[11px]" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 my-auto flex-1 flex flex-col justify-center items-center z-10 min-h-0 overflow-hidden py-1 sm:py-2">
        <div className="w-full h-full max-h-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-0 overflow-hidden">

          {/* LEFT PANEL */}
          <div className="lg:col-span-5 flex flex-col min-h-0 h-full overflow-hidden">
            <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05),0_0_0_1px_#e8e8e8] flex-1 flex flex-col min-h-0 card-scroll custom-scroll space-y-4">

              {/* Welcome */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Welcome Back</p>
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Welcome, {user?.name}!</h1>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-extrabold uppercase text-slate-400">Family Code</p>
                  <button onClick={handleCopyCode} className="inline-flex items-center gap-1 text-xs font-black text-[#5621bf] bg-[#5621bf]/10 px-2.5 py-1 rounded-lg hover:bg-[#5621bf]/20 transition">
                    <span>{user?.family_code}</span>
                    <i className={`${copyIcon} text-[10px]`} />
                  </button>
                </div>
              </div>

              {/* Home Address Card */}
              <div className="bg-gradient-to-br from-[#e2f0ff]/50 via-purple-50/30 to-white p-3.5 rounded-xl border border-[#5621bf]/20 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#5621bf] flex items-center gap-1.5">
                    <i className="fa-solid fa-house text-sm" /> Our Home Address
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${homeIsSet ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {homeIsSet ? 'Set' : 'Not Set'}
                    </span>
                    {isParent && (
                      <button onClick={() => setShowSettings(!showSettings)} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#5621bf] text-slate-700 hover:text-[#5621bf] text-xs font-extrabold transition flex items-center gap-1 shadow-sm">
                        <i className="fa-solid fa-gear text-[#5621bf]" /> Settings
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white/90 p-3 rounded-xl border border-[#5621bf]/10 space-y-2 text-xs font-semibold text-slate-700 shadow-sm">
                  <p className="break-words font-bold text-slate-900">{home?.home_address || 'Home address not set yet.'}</p>
                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                    <span className="text-slate-500 font-extrabold">Time to be Home:</span>
                    <span className="font-black text-[#5621bf] bg-[#5621bf]/10 px-2.5 py-0.5 rounded-lg">{home?.target_home_time || 'Not set by parent'}</span>
                  </div>
                </div>

                {/* Settings Drawer (Parent) */}
                {isParent && (showSettings || !homeIsSet) && (
                  <div className="space-y-2.5 pt-1">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold uppercase text-slate-500">Home Address</label>
                      <div className="relative">
                        <i className="fa-solid fa-location-dot absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input type="text" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)}
                          placeholder="e.g. 742 Evergreen Terrace, Springfield"
                          className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 focus:border-[#5621bf] outline-none bg-white" />
                      </div>
                      <button onClick={handleSaveAddress} className="w-full py-2 bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-xs rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 mt-1">
                        <i className="fa-solid fa-floppy-disk" /> Save Home Address
                      </button>
                    </div>
                    <div className="pt-2 border-t border-purple-100 space-y-1">
                      <label className="block text-[10px] font-extrabold uppercase text-slate-500">Time to be Home (Curfew)</label>
                      <div className="flex items-center gap-2">
                        <input type="time" value={targetTime} onChange={(e) => setTargetTime(e.target.value)}
                          className="flex-1 py-2 px-2.5 text-xs font-bold rounded-lg border border-slate-300 bg-white outline-none" />
                        <button onClick={handleSaveTime} className="px-3.5 py-2 bg-[#5621bf] hover:bg-[#431799] text-white text-xs font-extrabold rounded-lg transition active:scale-95 shrink-0">
                          Save Time
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Departure Calculator (Children Only) */}
              {!isParent && (
                <div className="bg-amber-50/90 border border-amber-200 p-3.5 rounded-xl space-y-2 shrink-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <i className="fa-solid fa-clock text-amber-600" /> Time to Head Home
                  </span>
                  <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-amber-200 text-center">
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase">Travel Time to Home</p>
                      <p className="text-base font-black text-slate-900 mt-0.5">{travelTimeText}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase">Leave for Home By</p>
                      <p className="text-base font-black text-amber-600 mt-0.5">{leaveByText}</p>
                    </div>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500 text-center">{calcSubtitle}</p>
                </div>
              )}

              {/* Tip Card (Children, once per account) */}
              {showTip && (
                <div className="bg-gradient-to-r from-[#5621bf]/10 via-blue-50 to-purple-50 p-3 rounded-xl border border-[#5621bf]/20 flex items-center justify-between gap-2 text-xs font-bold text-slate-700 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <i className="fa-solid fa-lightbulb text-amber-500 text-base shrink-0" />
                    <span>Keep HOMETRACKER open while traveling so your family sees your live location!</span>
                  </div>
                  <button onClick={handleDismissTip} className="text-slate-400 hover:text-slate-700 p-1 transition shrink-0">
                    <i className="fa-solid fa-xmark text-sm" />
                  </button>
                </div>
              )}

              {/* Family Members */}
              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 shrink-0">
                  <i className="fa-solid fa-users text-[#5621bf]" /> Family Members
                </h3>
                <div className="space-y-2 flex-1 overflow-y-auto custom-scroll min-h-[120px] pr-1">
                  {members.length === 0 ? (
                    <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200/80 border-dashed text-slate-400 text-xs font-semibold">
                      No family members found in this circle.
                    </div>
                  ) : (
                    members.map((member) => {
                      const mp = member.role === 'parent';
                      let distText = mp ? 'Home Anchor' : 'Location unknown';
                      let travelText = '';
                      if (!mp && member.current_lat && home?.home_lat) {
                        const dist = calculateDistanceKm(member.current_lat, member.current_lng, home.home_lat, home.home_lng);
                        const mins = calculateTravelTimeMins(dist);
                        distText = `${dist.toFixed(1)} km away`;
                        travelText = `~${mins} min travel time`;
                      }
                      return (
                        <div key={member.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full ${mp ? 'bg-[#5621bf]' : 'bg-blue-500'} text-white flex items-center justify-center text-xs font-black shrink-0`}>
                              {(member.name || 'M').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-black text-slate-900">{member.name}</h4>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${mp ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{member.role}</span>
                              </div>
                              <p className="text-[10px] font-semibold text-slate-400">{distText}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-extrabold text-[#5621bf]">{travelText || '--'}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT MAP */}
          <div className="lg:col-span-7 flex flex-col gap-3 min-h-[350px] lg:min-h-0 h-full relative">
            <div className="glass-panel rounded-2xl p-2 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05),0_0_0_1px_#e8e8e8] flex-1 flex flex-col min-h-0 relative overflow-hidden">
              <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
                <button onClick={centerMapOnHome} className="px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-800 text-xs font-extrabold shadow-sm hover:bg-white transition flex items-center gap-1.5">
                  <i className="fa-solid fa-house text-[#5621bf]" /> Center Home
                </button>
              </div>
              <div ref={mapRef} id="leaflet-map" />
              <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 text-[10px] font-extrabold text-slate-700">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#5621bf]" /> Home</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Family Members</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-[10px] font-semibold text-slate-500 border-t border-[#e8e8e8]/60 z-20 shrink-0">
        <div>© 2026 <span className="font-extrabold text-slate-800">HOMETRACKER Inc.</span> All rights reserved.</div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'privacy'}))} className="hover:text-[#5621bf] transition">Privacy Policy</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-info-modal', {detail: 'terms'}))} className="hover:text-[#5621bf] transition">Terms of Service</button>
        </div>
      </footer>
    </div>
  );
}
