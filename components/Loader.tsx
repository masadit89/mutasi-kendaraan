import React from 'react';

export const Loader: React.FC<{ message?: string }> = ({ message = "Memuat data..." }) => {
  return (
    <div className="absolute inset-0 bg-slate-100 bg-opacity-80 flex flex-col justify-center items-center z-50">
      <div className="w-12 h-12 border-4 border-t-indigo-600 border-r-slate-300 border-b-slate-300 border-l-slate-300 rounded-full animate-spin"></div>
      <p className="mt-4 text-slate-600 font-semibold">{message}</p>
    </div>
  );
};
