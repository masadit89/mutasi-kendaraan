
import React from 'react';
import { Vehicle, VehicleStatus } from '../types';
import { CarIcon, AlertTriangleIcon, ToolIcon } from './icons';

interface MaintenanceAlert {
  vehicle: Vehicle;
  reason: string;
}

const MaintenanceAlerts: React.FC<{ alerts: MaintenanceAlert[]; onUpdateMaintenance: (vehicle: Vehicle) => void; }> = ({ alerts, onUpdateMaintenance }) => {
    if (alerts.length === 0) {
        return null;
    }

    const alertsByVehicle = alerts.reduce((acc, alert) => {
        if (!acc[alert.vehicle.id]) {
            acc[alert.vehicle.id] = { vehicle: alert.vehicle, reasons: [] };
        }
        acc[alert.vehicle.id].reasons.push(alert.reason);
        return acc;
    }, {} as Record<string, { vehicle: Vehicle, reasons: string[] }>);

    return (
        <div className="mb-6 bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg shadow-sm">
            <div className="flex">
                <div className="py-1">
                    <AlertTriangleIcon className="h-6 w-6 text-orange-500 mr-4" />
                </div>
                <div className="w-full">
                    <h3 className="font-bold text-orange-800">Peringatan Perawatan Kendaraan</h3>
                    <ul className="mt-2 text-sm text-orange-700 space-y-2">
                        {Object.values(alertsByVehicle).map(({ vehicle, reasons }) => (
                            <li key={vehicle.id} className="flex justify-between items-center">
                                <span>
                                  <span className="font-semibold">{vehicle.brand} ({vehicle.plateNumber}):</span> {reasons.join(' ')}
                                </span>
                                <button 
                                  onClick={() => onUpdateMaintenance(vehicle)}
                                  className="flex items-center gap-1.5 text-xs bg-orange-400 hover:bg-orange-500 text-orange-900 font-semibold px-2 py-1 rounded-md transition-colors"
                                  aria-label={`Perbarui data perawatan untuk ${vehicle.brand}`}
                                >
                                  <ToolIcon className="w-3 h-3"/>
                                  Perbarui
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};


interface VehicleListProps {
  vehicles: Vehicle[];
  onVehicleSelect: (vehicle: Vehicle) => void;
  maintenanceAlerts: MaintenanceAlert[];
  onOpenMaintenanceModal: (vehicle: Vehicle) => void;
}

const VehicleButton: React.FC<{ vehicle: Vehicle; onSelect: () => void; }> = ({ vehicle, onSelect }) => {
    const isAvailable = vehicle.status === VehicleStatus.AVAILABLE;
    
    const baseClasses = "w-full h-32 md:h-40 rounded-lg flex flex-col items-center justify-center p-4 text-white font-bold text-center shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4";
    const statusClasses = isAvailable 
        ? 'bg-green-500 hover:bg-green-600 focus:ring-green-300' 
        : 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-300';

    return (
        <button 
            onClick={onSelect}
            className={`${baseClasses} ${statusClasses}`}
        >
            <CarIcon className="w-8 h-8 md:w-10 md:h-10 mb-2"/>
            <span className="text-lg md:text-xl">{vehicle.brand}</span>
            <span className="text-sm font-normal opacity-90">{vehicle.plateNumber}</span>
        </button>
    );
};


export const VehicleList: React.FC<VehicleListProps> = ({ vehicles, onVehicleSelect, maintenanceAlerts, onOpenMaintenanceModal }) => {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
        <MaintenanceAlerts alerts={maintenanceAlerts} onUpdateMaintenance={onOpenMaintenanceModal} />

        <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Dashboard Operasional</h2>
            <p className="text-slate-600">Pilih kendaraan untuk memulai atau menyelesaikan perjalanan.</p>
        </div>
        
        {vehicles.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {vehicles.map(vehicle => (
                    <VehicleButton 
                        key={vehicle.id} 
                        vehicle={vehicle} 
                        onSelect={() => onVehicleSelect(vehicle)}
                    />
                ))}
            </div>
        ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <CarIcon className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-2 text-sm font-medium text-slate-900">Belum ada kendaraan</h3>
                <p className="mt-1 text-sm text-slate-500">Silakan tambahkan kendaraan di menu Pengaturan.</p>
            </div>
        )}
    </div>
  );
};