'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[NEXT_GLOBAL_ERROR_BOUNDARY]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-50 font-sans min-h-screen flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-xs">
            <i className="fa-solid fa-triangle-exclamation" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Application Error</h2>
            <p className="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">
              {error?.message || 'A critical error occurred while executing the request.'}
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="w-full py-3 bg-[#5621bf] hover:bg-[#431799] text-white font-extrabold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
