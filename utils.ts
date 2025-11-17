import { Mutation, Vehicle } from './types';

// Add type declaration for jsPDF and QRCode libraries loaded from CDN
declare global {
    interface Window {
        jspdf: any;
        QRCode: any;
    }
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

// Helper to fetch an image from a URL and convert it to a base64 string
const imageUrlToBase64 = async (url: string): Promise<string> => {
    try {
        // Using a proxy might be necessary if CORS issues persist with Google Drive URLs.
        // For simplicity, we'll try a direct fetch first.
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`Could not convert image URL to base64: ${url}`, error);
        // Return a placeholder or handle the error as needed
        return ''; 
    }
};


export const generateSingleReportPdf = async (mutation: Mutation, vehicle: Vehicle) => {
    if (!vehicle || !mutation.endTime || mutation.endKm === undefined || mutation.distance === undefined) {
        alert("Data perjalanan tidak lengkap untuk membuat PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // --- QR Code Generation ---
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px'; // Hide it off-screen
    document.body.appendChild(tempDiv);

    let qrCodeDataUrl = '';
    try {
        const reportUrl = `${window.location.origin}/?reportId=${mutation.id}`;
        new window.QRCode(tempDiv, {
            text: reportUrl,
            width: 128,
            height: 128,
            correctLevel: window.QRCode.CorrectLevel.H
        });
        
        // Wait for the QR code to be rendered to the canvas
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const canvas = tempDiv.querySelector('canvas');
        if (canvas) {
            qrCodeDataUrl = canvas.toDataURL('image/png');
        } else {
            throw new Error("Canvas for QR Code not found.");
        }
    } catch (error) {
        console.error("Failed to generate QR Code:", error);
        alert("Gagal membuat QR Code untuk PDF.");
        document.body.removeChild(tempDiv);
        return;
    } finally {
        if (document.body.contains(tempDiv)) {
            document.body.removeChild(tempDiv);
        }
    }


    // --- PDF Document Generation ---

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
        startY: 35,
        body: tableBody,
        theme: 'plain',
        styles: { cellPadding: 2, fontSize: 11 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { cellWidth: 85 } },
        margin: { left: 20 },
    });
    const tableFinalY = (doc as any).lastAutoTable.finalY;

    // Driver Photo
    let photoFinalY = 35;
    if (mutation.driverPhoto) {
        const driverPhotoBase64 = await imageUrlToBase64(mutation.driverPhoto);
        if (driverPhotoBase64) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Foto Pengemudi:', 150, 40);
            doc.addImage(driverPhotoBase64, 'JPEG', 150, 45, 40, 40);
            doc.rect(150, 45, 40, 40); // Photo border
            photoFinalY = 45 + 40;
        }
    }

    let nextSectionY = Math.max(tableFinalY, photoFinalY) + 10;

    // Notes Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Catatan Perjalanan:', 20, nextSectionY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const notesText = doc.splitTextToSize(mutation.notes || 'Tidak ada catatan.', 170);
    const notesHeight = Math.max(25, notesText.length * 5 + 10);
    doc.rect(20, nextSectionY + 3, 170, notesHeight);
    doc.text(notesText, 22, nextSectionY + 7);
    nextSectionY += notesHeight + 10;

    // Signature Section
    let signatureY = nextSectionY;
    if (signatureY > 220) { // If not enough space, add new page for signatures
        doc.addPage();
        signatureY = 30;
    }
    
    doc.setFontSize(11);
    doc.text('Diserahkan oleh,', 30, signatureY);
    doc.text('Diterima & Diverifikasi oleh,', 140, signatureY);
    
    // Driver signature
    doc.line(30, signatureY + 20, 80, signatureY + 20);
    doc.text(mutation.driver, 30, signatureY + 25);
    doc.text('Pengemudi', 30, signatureY + 30);

    // Officer QR Code Verification
    if (qrCodeDataUrl) {
        doc.addImage(qrCodeDataUrl, 'PNG', 140, signatureY + 3, 25, 25);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('Pindai untuk Verifikasi', 140, signatureY + 32);
    } else {
        doc.line(140, signatureY + 20, 190, signatureY + 20); // Fallback line
    }
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text('Petugas', 140, signatureY + 38);

    const formattedDate = new Date(mutation.endTime).toISOString().split('T')[0];
    doc.save(`Laporan-Perjalanan-${vehicle.plateNumber}-${formattedDate}.pdf`);
};
