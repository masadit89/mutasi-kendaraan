import React from 'react';
import { MenuIcon, UserIcon } from './icons';
import { User } from '../types';

interface HeaderProps {
    onMenuClick: () => void;
    currentUser: User | null;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, currentUser }) => {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
            <button 
                onClick={onMenuClick}
                className="p-2 text-slate-500 rounded-full hover:bg-slate-100 hover:text-slate-800 md:hidden"
                aria-label="Buka menu"
            >
                <MenuIcon className="h-6 w-6"/>
            </button>
            <h1 className="text-lg font-bold text-slate-900 hidden md:block">
                Sistem Mutasi Kendaraan
            </h1>
        </div>
        {currentUser && (
            <div className="flex items-center space-x-3">
                <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{currentUser.username}</p>
                    <p className="text-xs text-slate-500">{currentUser.role}</p>
                </div>
                <div className="p-2 bg-slate-100 rounded-full">
                    <UserIcon className="w-5 h-5 text-slate-600"/>
                </div>
            </div>
        )}
      </div>
    </header>
  );
};
