import React, { useState } from 'react';
import { ServerIcon } from './icons'; 

interface ApiConfigModalProps {
  // No props needed anymore
}

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        if(typeof children === 'string') {
            navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    return (
        <pre className="bg-slate-800 text-white p-4 rounded-md text-xs overflow-x-auto relative">
            <button onClick={handleCopy} className="absolute top-2 right-2 bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold px-2 py-1 rounded">
                {copied ? 'Disalin!' : 'Salin'}
            </button>
            <code>{children}</code>
        </pre>
    );
};

export const ApiConfigModal: React.FC<ApiConfigModalProps> = () => {
  const appsScriptCode = `
const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();
const VEHICLES_SHEET = SPREADSHEET.getSheetByName("Vehicles");
const MUTATIONS_SHEET = SPREADSHEET.getSheetByName("Mutations");
const USERS_SHEET = SPREADSHEET.getSheetByName("Users");

const sheetToJSON = (sheet) => {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => h.toString().trim());
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      let value = row[i];
      if (typeof value === 'string') {
        if (!isNaN(value) && !isNaN(parseFloat(value)) && value.trim() !== '') {
            value = Number(value);
        } else if (value.toLowerCase() === 'true') {
            value = true;
        } else if (value.toLowerCase() === 'false') {
            value = false;
        }
      }
      obj[header] = value;
    });
    return obj;
  });
};

const findRowById = (sheet, id) => {
  if (!sheet || sheet.getLastRow() < 2) return -1;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
  const rowIndex = ids.findIndex(cellId => cellId.toString() === id.toString());
  return rowIndex === -1 ? -1 : rowIndex + 2;
};

function doGet(e) {
  try {
    const vehicles = sheetToJSON(VEHICLES_SHEET);
    const mutations = sheetToJSON(MUTATIONS_SHEET);
    const users = sheetToJSON(USERS_SHEET);
    return ContentService
      .createTextOutput(JSON.stringify({ vehicles, mutations, users }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const requestData = JSON.parse(e.postData.contents);
    const { action, payload } = requestData;
    let result = { success: false, message: "Invalid action" };
    
    const getHeaders = (sheet) => sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().trim());

    switch (action) {
      case 'ADD_DATA': {
        const { sheetName, data } = payload;
        const sheet = SPREADSHEET.getSheetByName(sheetName);
        if (sheet) {
          const headers = getHeaders(sheet);
          const newRow = headers.map(header => data[header] === undefined ? "" : data[header]);
          sheet.appendRow(newRow);
          result = { success: true, data };
        } else {
           result.message = "Sheet not found: " + sheetName;
        }
        break;
      }
      case 'UPDATE_DATA': {
        const { sheetName, data } = payload;
        const sheet = SPREADSHEET.getSheetByName(sheetName);
        if (sheet) {
          const rowIndex = findRowById(sheet, data.id);
          if (rowIndex !== -1) {
            const headers = getHeaders(sheet);
            const updatedRow = headers.map(header => data[header] !== undefined ? data[header] : sheet.getRange(rowIndex, headers.indexOf(header) + 1).getValue());
            sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);
            result = { success: true, data };
          } else {
            result.message = "Row not found with id: " + data.id;
          }
        } else {
           result.message = "Sheet not found: " + sheetName;
        }
        break;
      }
      case 'DELETE_DATA': {
         const { sheetName, id } = payload;
         const sheet = SPREADSHEET.getSheetByName(sheetName);
         if(sheet){
            const rowIndex = findRowById(sheet, id);
            if (rowIndex !== -1) {
              sheet.deleteRow(rowIndex);
              result = { success: true, data: { id }};
            } else {
              result.message = "Row not found with id: " + id;
            }
         } else {
            result.message = "Sheet not found: " + sheetName;
         }
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message, stack: err.stack })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
`.trim();

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-80 z-50 flex justify-center items-start p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8 transform transition-all">
        <div className="p-6 border-b">
            <div className="flex items-center">
                <div className="p-3 bg-indigo-100 rounded-full mr-4">
                    <ServerIcon className="w-6 h-6 text-indigo-600"/>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Konfigurasi Database Google Sheets</h2>
                    <p className="text-slate-500">Ikuti langkah-langkah di bawah untuk menghubungkan aplikasi.</p>
                </div>
            </div>
        </div>
        
        <div className="p-6 text-slate-700 text-sm max-h-[70vh] overflow-y-auto space-y-6">
            <div>
                <h3 className="font-bold text-lg mb-2">Langkah 1: Siapkan Google Sheet Anda</h3>
                 <ol className="list-decimal list-inside space-y-2 pl-4">
                    <li>Buka <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Google Sheets</a> dan buat spreadsheet baru. Beri nama "Database Mutasi Kendaraan".</li>
                    <li>Buat tiga sheet (tab) dengan nama persis: <code className="bg-slate-200 p-1 rounded">Vehicles</code>, <code className="bg-slate-200 p-1 rounded">Mutations</code>, dan <code className="bg-slate-200 p-1 rounded">Users</code>.</li>
                    <li>Salin header berikut ke baris pertama di setiap sheet yang sesuai.</li>
                </ol>
                <div className="mt-4 space-y-2 text-xs">
                    <p><b>Headers untuk 'Vehicles':</b> <code className="bg-slate-100 p-1 rounded">id, plateNumber, brand, year, color, status, lastServiceDate, lastOilChangeDate, lastAccuCheckDate</code></p>
                    <p><b>Headers untuk 'Mutations':</b> <code className="bg-slate-100 p-1 rounded">id, vehicleId, driver, destination, startTime, startKm, driverPhoto, endTime, endKm, distance, notes, status</code></p>
                    <p><b>Headers untuk 'Users':</b> <code className="bg-slate-100 p-1 rounded">id, username, password, role</code></p>
                </div>
            </div>

             <div>
                <h3 className="font-bold text-lg mb-2">Langkah 2: Buat & Deploy Apps Script</h3>
                 <ol className="list-decimal list-inside space-y-2 pl-4">
                    <li>Di Google Sheet Anda, buka `Extensions` &gt; `Apps Script`.</li>
                    <li>Hapus kode contoh dan salin semua kode di bawah ini ke editor.</li>
                 </ol>
                 <div className="mt-4">
                    <CodeBlock>{appsScriptCode}</CodeBlock>
                 </div>
                 <ol className="list-decimal list-inside space-y-2 pl-4 mt-4" start={3}>
                    <li>Klik ikon **Save project**.</li>
                    <li>Klik **Deploy** &gt; **New deployment**.</li>
                    <li>Pilih Tipe: **Web app**.</li>
                    <li>Konfigurasi: Description: `API Kendaraan`, Execute as: `Me`, Who has access: `Anyone`.</li>
                    <li>Klik **Deploy**, lalu **Authorize access**. Ikuti petunjuk untuk memberi izin (termasuk klik "Advanced" dan "Go to... (unsafe)").</li>
                    <li>Salin **Web app URL** yang muncul setelah deployment berhasil.</li>
                </ol>
            </div>
             <div>
                <h3 className="font-bold text-lg mb-2">Langkah 3: Hubungkan Aplikasi</h3>
                <p className="mb-2">Setelah Anda menyalin URL Web App, Anda perlu memasukkannya ke dalam file konfigurasi aplikasi.</p>
                 <div className="mt-4 p-4 border rounded-lg bg-slate-50">
                    <p className="font-semibold text-slate-800">Aksi yang Diperlukan:</p>
                    <ol className="list-decimal list-inside space-y-2 mt-2 pl-4">
                        <li>Buka file bernama <code className="bg-slate-200 p-1 rounded text-xs">config.ts</code> di dalam folder proyek Anda.</li>
                        <li>
                           Ganti teks placeholder <code className="bg-slate-200 p-1 rounded text-xs">"MASUKKAN_URL_SCRIPT_ANDA_DI_SINI"</code> dengan URL yang telah Anda salin.
                        </li>
                        <li>Simpan file tersebut.</li>
                        <li>Muat ulang (refresh) halaman ini di browser Anda. Aplikasi akan terhubung secara otomatis.</li>
                    </ol>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};