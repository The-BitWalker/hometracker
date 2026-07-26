'use client';

import { useState, useEffect } from 'react';

const modalContent = {
  privacy: {
    title: 'Privacy Policy',
    content: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <p><strong>Last Updated: July 2026</strong></p>
        <p>At HOMETRACKER, your family's privacy is our top priority. We do not sell your location data to third parties. All location data is encrypted in transit and at rest.</p>
        <h3 className="text-slate-800 font-bold mt-4">1. Information We Collect</h3>
        <p>We collect GPS coordinates, device information, and account details only to provide the HOMETRACKER service to your private family circle.</p>
        <h3 className="text-slate-800 font-bold mt-4">2. How We Use Your Information</h3>
        <p>Your location is only shared with authenticated members of your family circle. We use location data to calculate ETA to your home base.</p>
        <h3 className="text-slate-800 font-bold mt-4">3. Data Retention</h3>
        <p>Location history is not permanently stored. We only keep the most recent location points necessary for real-time tracking.</p>
      </div>
    )
  },
  terms: {
    title: 'Terms of Service',
    content: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <p><strong>Last Updated: July 2026</strong></p>
        <p>By using HOMETRACKER, you agree to these terms. This service is intended for personal, family use only.</p>
        <h3 className="text-slate-800 font-bold mt-4">1. User Responsibilities</h3>
        <p>You must not use this app to track individuals without their consent. The service relies on GPS, which may not always be accurate.</p>
        <h3 className="text-slate-800 font-bold mt-4">2. Service Limitations</h3>
        <p>HOMETRACKER is not a replacement for emergency services. We do not guarantee 100% uptime or precise location accuracy.</p>
        <h3 className="text-slate-800 font-bold mt-4">3. Account Security</h3>
        <p>You are responsible for keeping your Family Code and password secure. Do not share your Family Code outside your immediate family.</p>
      </div>
    )
  },
  'how-it-works': {
    title: 'How It Works',
    content: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <p>HOMETRACKER is designed to be simple and battery-efficient.</p>
        <ol className="list-decimal pl-5 space-y-3 mt-2">
          <li><strong>Parents create a circle:</strong> Sign up as a Parent, set your Home Base address, and get a secure Family Code.</li>
          <li><strong>Kids join:</strong> Kids download the app, select "Child", and enter the Family Code.</li>
          <li><strong>Real-time ETA:</strong> Kids broadcast their location while out. The app calculates the exact time they will arrive home based on real-time traffic.</li>
          <li><strong>Peace of Mind:</strong> Parents see exactly how far away the kids are, and kids don't have to constantly text "I'm on my way".</li>
        </ol>
      </div>
    )
  },
  safety: {
    title: 'Privacy & Safety',
    content: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <p>Safety is built into the core of HOMETRACKER.</p>
        <ul className="list-disc pl-5 space-y-3 mt-2">
          <li><strong>Invite-Only:</strong> No one can join your circle without your secure, randomly generated Family Code.</li>
          <li><strong>Encrypted Connections:</strong> All data sent between devices and our servers uses industry-standard TLS encryption.</li>
          <li><strong>No Creepy Ads:</strong> We make money from premium features, not by selling your family's data.</li>
          <li><strong>Transparent Tracking:</strong> Kids always know when their location is being shared.</li>
        </ul>
      </div>
    )
  },
  tips: {
    title: 'Tips & Tricks',
    content: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <h3 className="text-slate-800 font-bold">Improve Location Accuracy</h3>
        <p>Make sure Wi-Fi is turned on (even if not connected to a network) as it helps your device pinpoint its location faster.</p>
        <h3 className="text-slate-800 font-bold mt-4">Save Battery</h3>
        <p>Leave the app open in the background. The app is optimized to only send location updates when significant movement is detected.</p>
        <h3 className="text-slate-800 font-bold mt-4">Setting Curfews</h3>
        <p>Parents can set a "Target Home Time" in the settings. The app will automatically calculate when the kids need to leave their current location to make it home on time.</p>
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

  if (!isOpen) return null;

  const currentContent = modalContent[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            {currentContent.title}
          </h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {currentContent.content}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 shrink-0">
          <button 
            onClick={() => setIsOpen(false)}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-sm shadow-[0_10px_20px_-10px_rgba(86,33,191,0.3)] transition-all transform active:scale-95"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
