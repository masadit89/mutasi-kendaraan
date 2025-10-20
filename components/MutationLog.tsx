import React from 'react';
import { Mutation, MutationStatus, Vehicle } from '../types';
import { HistoryIcon, DownloadIcon, SheetIcon } from './icons';

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
  const sortedMutations = [...mutations].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  
  const getVehicle = (vehicleId: string): Vehicle | undefined => {
    return vehicles.find(v => v.id === vehicleId);
  }

  const exportToCsv = () => {
    const headers = [
      'Nomor Polisi',
      'Merk Kendaraan',
      'Pengemudi',
      'Tujuan',
      'Waktu Mulai',
      'Waktu Selesai',
      'KM Awal',
      'KM Akhir',
      'Jarak Tempuh (km)',
      'Catatan',
      'Status',
    ];

    const escapeCsvCell = (cellData: any): string => {
      if (cellData === undefined || cellData === null) {
        return '""';
      }
      const stringData = String(cellData);
      if (stringData.includes('"') || stringData.includes(',') || stringData.includes('\n') || stringData.includes('\r')) {
        return `"${stringData.replace(/"/g, '""')}"`;
      }
      return `"${stringData}"`;
    };

    const rows = sortedMutations.map((mutation) => {
      const vehicle = getVehicle(mutation.vehicleId);
      return [
        vehicle?.plateNumber ?? '',
        vehicle?.brand ?? '',
        mutation.driver,
        mutation.destination,
        formatDate(mutation.startTime),
        formatDate(mutation.endTime),
        mutation.startKm,
        mutation.endKm,
        mutation.distance,
        mutation.notes,
        mutation.status,
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
  
  const generateSingleReportPdf = (mutation: Mutation) => {
    const vehicle = getVehicle(mutation.vehicleId);
    if (!vehicle || !mutation.endTime || mutation.endKm === undefined || mutation.distance === undefined) {
      alert("Data perjalanan tidak lengkap untuk membuat PDF.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Formulir Laporan Perjalanan Kendaraan', 105, 20, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(20, 28, 190, 28);

    // Trip Details Table
    const tableBody = [
        ['Nomor Polisi', `: ${vehicle.plateNumber}`],
        ['Kendaraan', `: ${vehicle.brand} (${vehicle.year})`],
        ['Pengemudi', `: ${mutation.driver}`],
        ['Tujuan', `: ${mutation.destination}`],
        ['Waktu Mulai', `: ${formatDate(mutation.startTime)}`],
        ['Waktu Selesai', `: ${formatDate(mutation.endTime)}`],
        ['Kilometer Awal', `: ${mutation.startKm} km`],
        ['Kilometer Akhir', `: ${mutation.endKm} km`],
        ['Jarak Tempuh', `: ${mutation.distance} km`],
    ];
    
    (doc as any).autoTable({
        startY: 38,
        body: tableBody,
        theme: 'plain',
        styles: {
            cellPadding: 2,
            fontSize: 11,
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 50 },
            1: { cellWidth: 'auto' },
        },
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;

    // Notes Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Catatan Perjalanan:', 20, finalY + 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const notesText = doc.splitTextToSize(mutation.notes || 'Tidak ada catatan.', 170);
    doc.text(notesText, 22, finalY + 22);
    doc.rect(20, finalY + 18, 170, Math.max(30, notesText.length * 5 + 10)); // Box around notes

    // Signature Section
    const signatureY = finalY + 75;
    doc.setFontSize(11);
    doc.text('Diserahkan oleh,', 30, signatureY);
    doc.text('Diterima oleh,', 140, signatureY);

    doc.line(30, signatureY + 20, 80, signatureY + 20);
    doc.text(mutation.driver, 30, signatureY + 25);
    doc.text('Pengemudi', 30, signatureY + 30);

    doc.line(140, signatureY + 20, 190, signatureY + 20);
    doc.text('(___________________)', 140, signatureY + 25);
    doc.text('Petugas', 140, signatureY + 30);

    // Save the PDF
    const formattedDate = new Date(mutation.endTime).toISOString().split('T')[0];
    doc.save(`Laporan-Perjalanan-${vehicle.plateNumber}-${formattedDate}.pdf`);
  };

  const exportTableToPdf = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
    });

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Laporan Log Perjalanan Kendaraan', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 29);

    const tableHeaders = ["No.", "Kendaraan", "Pengemudi", "Tujuan", "Waktu Mulai", "Waktu Selesai", "Jarak (km)", "Status"];
    const tableRows = sortedMutations.map((mutation, index) => {
      const vehicle = getVehicle(mutation.vehicleId);
      return [
        index + 1,
        vehicle ? `${vehicle.brand} (${vehicle.plateNumber})` : 'N/A',
        mutation.driver,
        mutation.destination,
        formatDate(mutation.startTime),
        formatDate(mutation.endTime),
        mutation.distance ?? '-',
        mutation.status,
      ];
    });

    (doc as any).autoTable({
      startY: 35,
      head: [tableHeaders],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10 } }
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
              <HistoryIcon className="w-7 h-7 text-indigo-600"/>
              Log Perjalanan Kendaraan
          </h2>
          <p className="text-slate-600">Riwayat semua perjalanan yang telah dicatat dalam sistem.</p>
        </div>
        <div className="flex items-center gap-2">
            <button
            onClick={exportToCsv}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
            title="Ekspor ke CSV (Excel/Google Sheets)"
            aria-label="Ekspor ke CSV"
            >
                <SheetIcon className="w-5 h-5" />
                Ekspor CSV
            </button>
            <button
            onClick={exportTableToPdf}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
            title="Ekspor ke PDF"
            aria-label="Ekspor ke PDF"
            >
                <DownloadIcon className="w-5 h-5" />
                Ekspor PDF
            </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
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
              {sortedMutations.map((mutation) => {
                const vehicle = getVehicle(mutation.vehicleId);
                return (
                  <tr key={mutation.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{vehicle ? vehicle.plateNumber : 'N/A'}</td>
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
                        <button
                          onClick={() => generateSingleReportPdf(mutation)}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors duration-200 p-2 rounded-full hover:bg-indigo-100"
                          title="Unduh Laporan PDF Tunggal"
                          aria-label="Unduh Laporan PDF Tunggal"
                        >
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
        {mutations.length === 0 && (
            <p className="text-center py-8 text-sm text-slate-500">Belum ada riwayat perjalanan yang tercatat.</p>
        )}
      </div>
    </div>
  );
};