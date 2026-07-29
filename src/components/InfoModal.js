'use client';

import { useState, useEffect } from 'react';

const modalContent = {
  privacy: {
    title: 'Privacy Policy',
    content: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <p className="text-xs text-slate-400"><strong>Last Updated: July 27, 2026</strong></p>
        <p>At HOMETRACKER, your family's privacy and data security are the absolute core of our values. We recognize that location data is highly sensitive, and we are committed to protecting it through rigorous encryption, strict data-handling policies, and an absolute promise never to monetize your private data.</p>
        
        <h3 className="text-slate-800 font-bold mt-4 text-base">1. Information We Collect</h3>
        <p>To provide real-time location sharing and accurate predictive ETAs, we collect and process the following information:</p>
        <ul className="list-disc pl-5 space-y-1 mt-1 text-xs">
          <li><strong>Geolocation Data:</strong> High-precision GPS coordinates, heading, altitude, and velocity from your mobile device.</li>
          <li><strong>Device Telemetry:</strong> Battery status, network connectivity state (Wi-Fi, cellular), and operating system version.</li>
          <li><strong>Account Information:</strong> Account names, email addresses, profile icons, and unique cryptographically generated Family Codes.</li>
        </ul>

        <h3 className="text-slate-800 font-bold mt-4 text-base">2. How We Use & Share Your Data</h3>
        <p>Your information is used solely to calculate and display real-time tracking, predict travel times to your Home Base, and send status notifications to your circle. </p>
        <ul className="list-disc pl-5 space-y-1 mt-1 text-xs">
          <li><strong>Strictly Private Circles:</strong> Your location is only visible to authenticated members of your family circle who have joined using your unique Family Code.</li>
          <li><strong>Zero Third-Party Sharing:</strong> We do not sell, rent, trade, or share your location data or personal information with any third-party advertisers, data brokers, or marketing networks.</li>
        </ul>

        <h3 className="text-slate-800 font-bold mt-4 text-base">3. Encryption & Data Security</h3>
        <p>We implement industry-leading security practices to keep your data safe:</p>
        <ul className="list-disc pl-5 space-y-1 mt-1 text-xs">
          <li><strong>In Transit:</strong> All data transmitted between our mobile applications, web interfaces, and backend servers is encrypted using Secure Sockets Layer (SSL) / Transport Layer Security (TLS 1.3).</li>
          <li><strong>At Rest:</strong> Sensitive databases, including user account credentials and configuration files, are encrypted using AES-256 standard encryption.</li>
        </ul>

        <h3 className="text-slate-800 font-bold mt-4 text-base">4. Data Retention & Pruning</h3>
        <p>We do not store historical location logs indefinitely. Real-time coordinate updates are immediately processed to update your family circle and calculate ETAs. Historical path points are automatically pruned and permanently deleted from our servers within 24 hours of generation.</p>

        <h3 className="text-slate-800 font-bold mt-4 text-base">5. Child Privacy Compliance (COPPA)</h3>
        <p>HOMETRACKER is designed to protect children. We require parental consent during account setup, and children's profiles are strictly anonymous to anyone outside their verified family circle.</p>
      </div>
    )
  },
  terms: {
    title: 'Terms of Service',
    content: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <p className="text-xs text-slate-400"><strong>Last Updated: July 27, 2026</strong></p>
        <p>Welcome to HOMETRACKER. By creating an account, installing our software, or accessing our online platform, you agree to comply with and be bound by the following Terms of Service. Please read them carefully.</p>
        
        <h3 className="text-slate-800 font-bold mt-4 text-base">1. User Eligibility and Consent</h3>
        <p>HOMETRACKER is a tool designed for family safety and real-time coordination. By registering a Child account or sharing a Family Code, you represent and warrant that you are the parent or legal guardian of any minor using the service, or that you have obtained explicit parental consent.</p>

        <h3 className="text-slate-800 font-bold mt-4 text-base">2. Acceptable & Authorized Use</h3>
        <p>You agree to use this service exclusively for legitimate, personal, and non-commercial family coordination. You must not:</p>
        <ul className="list-disc pl-5 space-y-1 mt-1 text-xs">
          <li>Install or use HOMETRACKER to track any individual without their active, informed consent.</li>
          <li>Modify, reverse engineer, or exploit any part of our APIs, location broadcast protocols, or application binaries.</li>
          <li>Share your Family Code with unauthorized parties or use it to stalk, harass, or compromise the safety of others.</li>
        </ul>

        <h3 className="text-slate-800 font-bold mt-4 text-base">3. Disclaimer of Uptime & Accuracy</h3>
        <p>HOMETRACKER relies on third-party satellite networks, commercial mapping APIs, cellular providers, and device-level operating systems. Because of this:</p>
        <ul className="list-disc pl-5 space-y-1 mt-1 text-xs">
          <li>We do not guarantee 100% uptime, nor do we warrant that location reporting or ETA calculations will always be precise or instantaneous.</li>
          <li><strong>Emergency Disclaimer:</strong> HOMETRACKER is NOT an emergency response service. It should not be used as a primary communications channel during critical safety crises, natural disasters, or medical emergencies.</li>
        </ul>

        <h3 className="text-slate-800 font-bold mt-4 text-base">4. Subscription Policies & Account Safety</h3>
        <p>You are solely responsible for maintaining the confidentiality of your credentials and Family Codes. Standard data charges may apply from your mobile carrier. If premium subscription features are purchased, they will renew automatically unless cancelled in your account settings.</p>
      </div>
    )
  },
  'how-it-works': {
    title: 'How It Works',
    content: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <p>HOMETRACKER connects families in real-time, removing the anxiety of commute times and eliminating the need for constant "Where are you?" texts.</p>
        
        <div className="border-l-4 border-[#5621bf] pl-4 py-1 my-3 bg-slate-50">
          <p className="font-semibold text-slate-900">Our core tracking philosophy is: Invite-only, Battery-optimized, and Fully Automated.</p>
        </div>

        <ol className="list-decimal pl-5 space-y-4 mt-2">
          <li>
            <strong>Circle Initialization:</strong>
            <p className="text-xs mt-1 text-slate-500">A parent creates a private circle and designates a "Home Base" (e.g., your home address). The app immediately generates a secure, randomly initialized Family Code.</p>
          </li>
          <li>
            <strong>Circle Integration:</strong>
            <p className="text-xs mt-1 text-slate-500">Other family members install the app on their devices, choose their roles, and input the Family Code. Once validated, they are securely joined to the encrypted family circle.</p>
          </li>
          <li>
            <strong>Real-Time Location Broadcasts:</strong>
            <p className="text-xs mt-1 text-slate-500">When family members are away from Home Base, their devices broadcast coordinate telemetry using background service cycles. Our system calculates the optimal route to Home Base based on current traffic and travel conditions.</p>
          </li>
          <li>
            <strong>Predictive ETA Engine:</strong>
            <p className="text-xs mt-1 text-slate-500">Rather than just showing raw coordinates on a map, HOMETRACKER continuously updates a precise time-to-arrival (ETA) for each member, automatically factoring in detours, delays, or pedestrian vs. driving modes.</p>
          </li>
        </ol>
      </div>
    )
  },
  safety: {
    title: 'Privacy & Safety',
    content: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <p>Your family's safety is our primary focus. We have engineered HOMETRACKER with deep security safeguards to ensure your location data remains private and protected.</p>

        <h3 className="text-slate-800 font-bold mt-4 text-base">Key Security Protections</h3>
        
        <div className="grid grid-cols-1 gap-4 mt-2">
          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
              <i className="fa-solid fa-shield-halved text-indigo-600 text-sm" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-xs block">Cryptographic Isolation</span>
              <span className="text-xs text-slate-600">Your family circle runs on an isolated virtual ring. Only individuals with your unique, randomized Family Code can connect. There is no public directory of circles or members.</span>
            </div>
          </div>

          <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
              <i className="fa-solid fa-mobile-screen-button text-purple-600 text-sm" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-xs block">Device-Level Visibility Control</span>
              <span className="text-xs text-slate-600">Every member has immediate visibility and control. Devices display persistent notifications when location tracking services are active, preventing any stealth tracking or unauthorized background access.</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <i className="fa-solid fa-ban text-emerald-600 text-sm" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-xs block">Strict Commercial Separation</span>
              <span className="text-xs text-slate-600">We do not sell user data to advertising companies, analytics companies, or insurance providers. We monetize purely through premium features and voluntary upgrades.</span>
            </div>
          </div>
        </div>

        <h3 className="text-slate-800 font-bold mt-4 text-base">Best Safety Practices</h3>
        <ul className="list-disc pl-5 space-y-2 mt-1 text-xs">
          <li><strong>Never post Family Codes publicly:</strong> Keep your Family Code offline and share it only in person or through encrypted direct messaging apps.</li>
          <li><strong>Rotate codes if compromised:</strong> If you suspect someone has obtained your code maliciously, generate a new code in settings immediately to boot unauthorized members.</li>
          <li><strong>Designate accurate base points:</strong> Position your Home Base marker precisely to ensure the geofenced ETA calculations trigger correctly when family members enter or exit.</li>
        </ul>
      </div>
    )
  },
  tips: {
    title: 'Tips & Tricks',
    content: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <p>Maximize the performance, accuracy, and battery efficiency of your HOMETRACKER experience with these optimizations.</p>

        <h3 className="text-slate-800 font-bold mt-4 text-base flex items-center gap-2">
          <i className="fa-solid fa-location-crosshairs text-slate-800 text-sm" />
          Optimizing Location Accuracy
        </h3>
        <p>To prevent location "drift" or lag, apply the following device settings:</p>
        <ul className="list-disc pl-5 space-y-1 mt-1 text-xs">
          <li><strong>Enable Wi-Fi:</strong> Keep Wi-Fi toggled on. Even if not connected to a network, your device uses nearby Wi-Fi beacons to speed up GPS lock-on times and reduce power use.</li>
          <li><strong>Configure "Always Allow" Access:</strong> For background tracking to work smoothly, set location permissions to "Always Allow" (on iOS) or "Allow all the time" (on Android).</li>
          <li><strong>Enable Precise Location:</strong> Ensure the "Use Precise Location" toggle is switched on in system settings for HOMETRACKER.</li>
        </ul>

        <h3 className="text-slate-800 font-bold mt-4 text-base flex items-center gap-2">
          <i className="fa-solid fa-battery-three-quarters text-slate-800 text-sm" />
          Battery Optimization Hacks
        </h3>
        <p>GPS tracking is resource-intensive, but HOMETRACKER is built to conserve energy:</p>
        <ul className="list-disc pl-5 space-y-1 mt-1 text-xs">
          <li><strong>Smart Motion Detection:</strong> The app automatically enters a low-power hibernation state when a device is stationary, resuming updates only when motion is detected.</li>
          <li><strong>Exclude from Battery Saver:</strong> On Android, disable "Battery Optimization" for HOMETRACKER so the system doesn't abruptly kill the background process.</li>
        </ul>

        <h3 className="text-slate-800 font-bold mt-4 text-base flex items-center gap-2">
          <i className="fa-solid fa-clock text-slate-800 text-sm" />
          Automated Curfews & ETA Alerts
        </h3>
        <ul className="list-disc pl-5 space-y-1 mt-1 text-xs">
          <li><strong>Set Target Times:</strong> Parents can set a target dinner or curfew time. HOMETRACKER will notify children when they need to start heading home to beat the traffic and arrive on time.</li>
          <li><strong>Establish Geofenced Zones:</strong> Add common transit checkpoints (like school or soccer practice) to receive instant notifications when kids safely arrive or leave.</li>
        </ul>
      </div>
    )
  }
};

export default function InfoModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('privacy'); // default

  useEffect(() => {
    const handleOpen = (e) => {
      if (e.detail && modalContent[e.detail]) {
        setType(e.detail);
        setIsOpen(true);
      }
    };

    window.addEventListener('open-info-modal', handleOpen);
    return () => window.removeEventListener('open-info-modal', handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentContent = modalContent[type];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative w-[92vw] sm:max-w-lg bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white flex flex-col max-h-[85vh] my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white rounded-t-2xl sm:rounded-t-3xl">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            {currentContent.title}
          </h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scroll">
          {currentContent.content}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 shrink-0 rounded-b-2xl sm:rounded-b-3xl">
          <button 
            onClick={() => setIsOpen(false)}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-sm shadow-[0_10px_20px_-10px_rgba(86,33,191,0.3)] transition-all transform active:scale-95 cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
