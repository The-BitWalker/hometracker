'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error('[NEXT_DASHBOARD_ERROR_BOUNDARY]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center font-sans">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl border border-slate-200 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="w-16 h-16 bg-purple-100 text-[#5621bf] rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-xs">
          <i className="fa-solid fa-[#5621bf] fa-[#5621bf] fa-rotate text-2xl" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Dashboard Loading Exception</h2>
          <p className="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">
            {error?.message || 'We encountered an error loading your dashboard data.'}
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-3 bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer"
          >
            Reload Dashboard
          </button>
          <Link
            href="/auth"
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition active:scale-95 flex items-center justify-center"
          >
            Re-authenticate
          </Link>
        </div>
      </div>
    </div>
  );
}
