import React, { useEffect, useState, useRef } from 'react';
import { Mutation, Vehicle } from '../types';
import { CarIcon, DownloadIcon, UserIcon } from './icons';
import { generateSingleReportPdf } from '../utils';


// Add QRCode to global window scope for TypeScript
declare global {
    interface Window {
        QRCode: any;
    }
}

interface ReportViewerProps {
    reportId: string;
    mutations: Mutation[];
    vehicles: Vehicle[];
}

const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
};

export const ReportViewer: React.FC<ReportViewerProps> = ({ reportId, mutations, vehicles }) => {
    const [mutation, setMutation] = useState<Mutation | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const qrcodeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const foundMutation = mutations.find(m => m.id === reportId);
        if (foundMutation) {
            setMutation(foundMutation);
            const foundVehicle = vehicles.find(v => v.id === foundMutation.vehicleId);
            if (foundVehicle) {
                setVehicle(foundVehicle);
            }
        }
    }, [reportId, mutations, vehicles]);

    useEffect(() => {
        if (mutation && vehicle && qrcodeRef.current) {
            // Clear previous QR code if any
            qrcodeRef.current.innerHTML = '';
            // The URL for the QR code will trigger an automatic download on the officer's device
            const pdfUrl = `${window.location.origin}/?reportId=${mutation.id}&download=true`;
            new window.QRCode(qrcodeRef.current, {
                text: pdfUrl,
                width: 160,
                height: 160,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : window.QRCode.CorrectLevel.H
            });
        }
        
        // Auto-download logic
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('download') === 'true' && mutation && vehicle) {
            generateSingleReportPdf(mutation, vehicle);
        }

    }, [mutation, vehicle]);


    if (!mutation || !vehicle) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-100 p-4">
                <div className="text-center bg-white p-8 rounded-lg shadow-md">
                    <h2 className="text-xl font-bold text-red-600">Laporan Tidak Ditemukan</h2>
                    <p className="text-slate-600 mt-2">Laporan dengan ID yang diberikan tidak dapat ditemukan atau data tidak lengkap.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-slate-100 p-4 sm:p-8 flex justify-center">
            <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl p-6 sm:p-8">
                {/* Header */}
                <header className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b-2 border-slate-200 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Laporan Perjalanan Kendaraan</h1>
                        <p className="text-slate-500">No. Laporan: {mutation.id}</p>
                    </div>
                    <div className="flex items-center space-x-2 mt-4 sm:mt-0 p-3 bg-green-50 rounded-lg">
                        <CarIcon className="w-8 h-8 text-green-700"/>
                        <div>
                           <p className="font-bold text-lg text-green-800">{vehicle.brand}</p>
                           <p className="text-sm text-green-600">{vehicle.plateNumber}</p>
                        </div>
                    </div>
                </header>

                {/* Body */}
                <main className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left: Details */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="flex items-center space-x-4">
                             {mutation.driverPhoto ? (
                                <img src={mutation.driverPhoto} alt={mutation.driver} className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg" />
                            ) : (
                                <div className="h-24 w-24 rounded-full bg-slate-200 flex items-center justify-center">
                                    <UserIcon className="w-12 h-12 text-slate-400" />
                                </div>
                            )}
                            <div>
                               <p className="text-sm text-slate-500">Pengemudi</p>
                               <p className="text-2xl font-semibold text-slate-800">{mutation.driver}</p>
                               <p className="text-md text-slate-600">Tujuan: {mutation.destination}</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <p className="font-semibold text-slate-600">Waktu Mulai</p>
                                <p className="text-slate-800">{formatDate(mutation.startTime)}</p>
                            </div>
                             <div className="bg-slate-50 p-4 rounded-lg">
                                <p className="font-semibold text-slate-600">Waktu Selesai</p>
                                <p className="text-slate-800">{formatDate(mutation.endTime)}</p>
                            </div>
                             <div className="bg-slate-50 p-4 rounded-lg">
                                <p className="font-semibold text-slate-600">Kilometer Awal</p>
                                <p className="text-slate-800 font-mono">{mutation.startKm} km</p>
                            </div>
                             <div className="bg-slate-50 p-4 rounded-lg">
                                <p className="font-semibold text-slate-600">Kilometer Akhir</p>
                                <p className="text-slate-800 font-mono">{mutation.endKm ?? '-'} km</p>
                            </div>
                             <div className="col-span-full bg-green-50 p-4 rounded-lg">
                                <p className="font-semibold text-green-700">Total Jarak Tempuh</p>
                                <p className="text-2xl font-bold text-green-800 font-mono">{mutation.distance ?? '-'} km</p>
                            </div>
                        </div>

                        <div>
                           <h4 className="font-semibold text-slate-700 mb-2">Catatan Perjalanan</h4>
                           <div className="p-4 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm whitespace-pre-wrap min-h-[80px]">
                               {mutation.notes || 'Tidak ada catatan.'}
                           </div>
                        </div>
                    </div>

                    {/* Right: QR Code & Actions */}
                    <aside className="flex flex-col items-center justify-start space-y-4 pt-6 md:border-l md:pl-8 md:pt-0">
                       <h4 className="font-bold text-slate-800 text-center">Verifikasi Laporan</h4>
                       <p className="text-xs text-slate-500 text-center">Pindai QR code ini untuk mengunduh laporan perjalanan dalam format PDF sebagai bukti verifikasi.</p>
                        <div ref={qrcodeRef} className="p-3 bg-white border rounded-lg shadow-md"></div>
                        <button 
                            onClick={async () => await generateSingleReportPdf(mutation, vehicle)}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                        >
                            <DownloadIcon className="w-5 h-5"/>
                            Unduh Laporan PDF
                        </button>
                    </aside>
                </main>
            </div>
        </div>
    );
};
