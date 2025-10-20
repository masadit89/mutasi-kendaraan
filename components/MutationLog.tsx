import React, { useState, useMemo } from 'react';
import { Mutation, MutationStatus, Vehicle } from '../types';
import { HistoryIcon, DownloadIcon, SheetIcon, SearchIcon } from './icons';
import { generateSingleReportPdf } from '../utils';

// Add type declaration for jsPDF libraries loaded from CDN
declare global {
    interface Window {
        jspdf: any;
    }
}

interface MutationLogProps {
  mutations: Mutation[];
  vehicles: Vehicle[];
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const MutationLog: React.FC<MutationLogProps> = ({ mutations, vehicles }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchDriver, setSearchDriver] = useState('');

  const getVehicle = (vehicleId: string): Vehicle | undefined => {
    return vehicles.find(v => v.id === vehicleId);
  }
  
  const filteredMutations = useMemo(() => {
    return [...mutations]
        .filter(mutation => {
            // Hanya tampilkan perjalanan yang sudah selesai di log
            if (mutation.status !== MutationStatus.COMPLETED) {
                return false;
            }

            const driverMatch = !searchDriver || mutation.driver.toLowerCase().includes(searchDriver.toLowerCase());

            const dateMatch = (!startDate && !endDate) || (() => {
                const startTime = new Date(mutation.startTime).getTime();
                const startFilter = startDate ? new Date(startDate).getTime() : 0;
                const endFilter = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
                return startTime >= startFilter && startTime <= endFilter;
            })();

            return driverMatch && dateMatch;
        })
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [mutations, startDate, endDate, searchDriver]);

  const hasAnyMutations = mutations.length > 0;
  const hasCompletedMutations = useMemo(() => mutations.some(m => m.status === MutationStatus.COMPLETED), [mutations]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSearchDriver('');
  };
  
  const exportToCsv = () => {
    const headers = [
      'Nomor Polisi', 'Merk Kendaraan', 'Pengemudi', 'Tujuan', 'Waktu Mulai', 'Waktu Selesai',
      'KM Awal', 'KM Akhir', 'Jarak Tempuh (km)', 'Catatan', 'Status',
    ];

    const escapeCsvCell = (cellData: any): string => {
      const stringData = String(cellData ?? '');
      if (stringData.includes('"') || stringData.includes(',') || stringData.includes('\n') || stringData.includes('\r')) {
        return `"${stringData.replace(/"/g, '""')}"`;
      }
      return `"${stringData}"`;
    };

    const rows = filteredMutations.map((mutation) => {
      const vehicle = getVehicle(mutation.vehicleId);
      return [
        vehicle?.plateNumber, vehicle?.brand, mutation.driver, mutation.destination,
        formatDate(mutation.startTime), formatDate(mutation.endTime),
        mutation.startKm, mutation.endKm, mutation.distance, mutation.notes, mutation.status,
      ].map(escapeCsvCell).join(',');
    });

    const csvString = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'laporan_mutasi_kendaraan.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleGenerateSinglePdf = async (mutation: Mutation) => {
    const vehicle = getVehicle(mutation.vehicleId);
    if(vehicle) {
        await generateSingleReportPdf(mutation, vehicle);
    } else {
        alert("Kendaraan untuk laporan ini tidak ditemukan.");
    }
  }

  const exportTableToPdf = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Laporan Log Perjalanan Kendaraan', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 29);
    const tableHeaders = ["No.", "Kendaraan", "Pengemudi", "Tujuan", "Waktu Mulai", "Waktu Selesai", "Jarak (km)", "Status"];
    const tableRows = filteredMutations.map((mutation, index) => {
      const vehicle = getVehicle(mutation.vehicleId);
      return [
        index + 1, vehicle ? `${vehicle.brand} (${vehicle.plateNumber})` : 'N/A', mutation.driver,
        mutation.destination, formatDate(mutation.startTime), formatDate(mutation.endTime),
        mutation.distance ?? '-', mutation.status,
      ];
    });
    (doc as any).autoTable({
      startY: 35, head: [tableHeaders], body: tableRows, theme: 'grid',
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8 }, columnStyles: { 0: { cellWidth: 10 } }
    });
    const pageCount = (doc as any).internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text('Halaman ' + String(i) + ' dari ' + String(pageCount), doc.internal.pageSize.width - 28, doc.internal.pageSize.height - 10);
    }
    doc.save('laporan_mutasi_kendaraan.pdf');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <HistoryIcon className="w-7 h-7 text-green-600"/>
              Log Perjalanan Kendaraan
          </h2>
          <p className="text-slate-600">Riwayat semua perjalanan yang telah dicatat dalam sistem.</p>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={exportToCsv} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200" title="Ekspor ke CSV (Excel/Google Sheets)" aria-label="Ekspor ke CSV">
                <SheetIcon className="w-5 h-5" /> Ekspor CSV
            </button>
            <button onClick={exportTableToPdf} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200" title="Ekspor ke PDF" aria-label="Ekspor ke PDF">
                <DownloadIcon className="w-5 h-5" /> Ekspor PDF
            </button>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
            <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
            <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <label htmlFor="searchDriver" className="block text-sm font-medium text-slate-700 mb-1">Cari Pengemudi</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <SearchIcon className="h-5 w-5 text-slate-400" />
              </span>
              <input type="text" id="searchDriver" value={searchDriver} onChange={e => setSearchDriver(e.target.value)} placeholder="Ketik nama pengemudi..." className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
          </div>
          <button onClick={handleResetFilters} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors h-10">Reset Filter</button>
        </div>
      </div>


      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-green-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Kendaraan</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Pengemudi</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Foto Pengemudi</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Waktu Mulai</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Waktu Selesai</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Jarak (km)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredMutations.map((mutation) => {
                const vehicle = getVehicle(mutation.vehicleId);
                return (
                  <tr key={mutation.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        <a 
                            href={`/?reportId=${mutation.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-800 hover:underline"
                            title="Lihat Laporan Detail"
                        >
                            {vehicle ? vehicle.plateNumber : 'N/A'}
                        </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{mutation.driver}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        {mutation.driverPhoto ? (
                            <img src={mutation.driverPhoto} alt={mutation.driver} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                            <span className="text-xs text-slate-400">No Photo</span>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(mutation.startTime)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(mutation.endTime)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{mutation.distance ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${mutation.status === MutationStatus.COMPLETED ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {mutation.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      {mutation.status === MutationStatus.COMPLETED && (
                        <button onClick={() => handleGenerateSinglePdf(mutation)} className="text-green-600 hover:text-green-900 transition-colors duration-200 p-2 rounded-full hover:bg-green-100" title="Unduh Laporan PDF Tunggal" aria-label="Unduh Laporan PDF Tunggal">
                          <DownloadIcon className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredMutations.length === 0 && (
            <p className="text-center py-8 text-sm text-slate-500">
                {!hasAnyMutations
                    ? "Belum ada riwayat perjalanan yang tercatat."
                    : !hasCompletedMutations
                    ? "Belum ada riwayat perjalanan yang selesai."
                    : "Tidak ada data yang cocok dengan filter Anda."
                }
            </p>
        )}
      </div>
    </div>
  );
};
