import React from 'react';
import { Vehicle, User } from '../types';
import { PlusIcon, SettingsIcon, UserIcon } from './icons';

interface SettingsProps {
    vehicles: Vehicle[];
    onAddVehicle: () => void;
    users: User[];
    onAddUser: () => void;
}

const formatDateSimple = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
};

export const Settings: React.FC<SettingsProps> = ({ vehicles, onAddVehicle, users, onAddUser }) => {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <SettingsIcon className="w-7 h-7 text-indigo-600"/>
                    Pengaturan
                </h2>
            </div>
            
            {/* Vehicle Management */}
            <div>
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <h3 className="text-xl font-semibold text-slate-800">Manajemen Kendaraan</h3>
                    <button 
                        onClick={onAddVehicle}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        <PlusIcon className="w-5 h-5"/>
                        Tambah Kendaraan
                    </button>
                </div>
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nomor Polisi</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Merk & Model</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Servis Terakhir</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ganti Oli</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Cek Aki</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {vehicles.map((vehicle) => (
                                    <tr key={vehicle.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{vehicle.plateNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{vehicle.brand}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDateSimple(vehicle.lastServiceDate)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDateSimple(vehicle.lastOilChangeDate)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDateSimple(vehicle.lastAccuCheckDate)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${vehicle.status === 'Tersedia' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {vehicle.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {vehicles.length === 0 && <p className="text-center py-8 text-sm text-slate-500">Belum ada kendaraan.</p>}
                </div>
            </div>

            {/* User Management */}
            <div>
                 <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <h3 className="text-xl font-semibold text-slate-800">Manajemen Pengguna</h3>
                    <button 
                        onClick={onAddUser}
                        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        <UserIcon className="w-5 h-5"/>
                        Tambah Pengguna
                    </button>
                </div>
                 <div className="bg-white shadow-md rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Username</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.username}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'Admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-sky-100 text-sky-800'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     {users.length === 0 && <p className="text-center py-8 text-sm text-slate-500">Belum ada pengguna.</p>}
                </div>
            </div>
        </div>
    );
};