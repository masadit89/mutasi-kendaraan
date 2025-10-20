import React from 'react';
import { Vehicle, User, Role } from '../types';
import { PlusIcon, SettingsIcon, UserIcon, EditIcon, TrashIcon, KeyIcon } from './icons';

interface SettingsProps {
    vehicles: Vehicle[];
    onAddVehicle: () => void;
    onEditVehicle: (vehicle: Vehicle) => void;
    onDeleteVehicle: (vehicleId: string) => void;
    users: User[];
    onAddUser: () => void;
    currentUser: User | null;
    onEditUser: (user: User) => void;
    onChangePassword: (user: User) => void;
    onDeleteUser: (userId: string) => void;
}

const formatDateSimple = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
};

export const Settings: React.FC<SettingsProps> = ({ vehicles, onAddVehicle, onEditVehicle, onDeleteVehicle, users, onAddUser, currentUser, onEditUser, onChangePassword, onDeleteUser }) => {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <SettingsIcon className="w-7 h-7 text-green-600"/>
                    Pengaturan
                </h2>
            </div>
            
            {/* Vehicle Management */}
            <div>
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <h3 className="text-xl font-semibold text-slate-800">Manajemen Kendaraan</h3>
                    <button 
                        onClick={onAddVehicle}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        <PlusIcon className="w-5 h-5"/>
                        Tambah Kendaraan
                    </button>
                </div>
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-green-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nomor Polisi</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Merk & Model</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Servis Terakhir</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ganti Oli</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Cek Aki</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => onEditVehicle(vehicle)} className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-100 rounded-full transition-colors" title="Edit Kendaraan">
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => onDeleteVehicle(vehicle.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors" title="Hapus Kendaraan">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
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
                            <thead className="bg-green-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Username</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.username} {user.id === currentUser?.id && <span className="text-xs text-green-600 font-semibold">(Anda)</span>}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'Admin' ? 'bg-green-100 text-green-800' : 'bg-sky-100 text-sky-800'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => onEditUser(user)} className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-100 rounded-full transition-colors" title="Edit Pengguna">
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => onChangePassword(user)} className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-100 rounded-full transition-colors" title="Ganti Password">
                                                    <KeyIcon className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => onDeleteUser(user.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Hapus Pengguna" disabled={user.id === currentUser?.id}>
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
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