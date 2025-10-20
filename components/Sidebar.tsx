import React from 'react';
import { HomeIcon, HistoryIcon, SettingsIcon, LogoutIcon } from './icons';
import { User, Role } from '../types';

type View = 'dashboard' | 'logs' | 'settings';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLogout: () => void;
}

const NavLink: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
      isActive
        ? 'bg-green-600 text-white shadow-lg'
        : 'text-green-100 hover:bg-green-700 hover:text-white'
    }`}
  >
    {icon}
    <span className="font-semibold">{label}</span>
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, isOpen, onClose, currentUser, onLogout }) => {
  const handleNavigate = (view: View) => {
    onNavigate(view);
    onClose();
  };

  return (
    <>
      <aside
        className={`fixed md:relative top-0 left-0 z-50 w-64 h-full bg-green-800 text-white p-4 flex-shrink-0 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="flex-grow">
            <div className="flex justify-center items-center mb-8 px-2">
                <img src="https://gembiralokazoo.com/storage/about/HontizxOKlzXRY3IuUlY6wGXZUqtYW5VRMkrgTxt.png" alt="Gembira Loka Zoo Logo" className="w-40 h-auto" />
            </div>

            <nav className="space-y-2">
            <NavLink
                icon={<HomeIcon className="w-6 h-6" />}
                label="Dashboard"
                isActive={activeView === 'dashboard'}
                onClick={() => handleNavigate('dashboard')}
            />
            <NavLink
                icon={<HistoryIcon className="w-6 h-6" />}
                label="Log Perjalanan"
                isActive={activeView === 'logs'}
                onClick={() => handleNavigate('logs')}
            />
            {currentUser?.role === Role.ADMIN && (
                <NavLink
                    icon={<SettingsIcon className="w-6 h-6" />}
                    label="Pengaturan"
                    isActive={activeView === 'settings'}
                    onClick={() => handleNavigate('settings')}
                />
            )}
            </nav>
        </div>
        <div className="mt-auto">
             <button
                onClick={onLogout}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 text-green-100 hover:bg-orange-600 hover:text-white"
            >
                <LogoutIcon className="w-6 h-6" />
                <span className="font-semibold">Keluar</span>
            </button>
            <p className="text-center text-xs text-green-300/50 pt-4">
                Copyright &copy; {new Date().getFullYear()} Bison
            </p>
        </div>
      </aside>
      {/* Overlay for mobile view */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        ></div>
      )}
    </>
  );
};