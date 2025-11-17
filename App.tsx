


import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { VehicleList } from './components/VehicleList';
import { MutationLog } from './components/MutationLog';
import { Settings } from './components/Settings';
import { Modal } from './components/Modal';
import { Vehicle, Mutation, VehicleStatus, MutationStatus, User, Role } from './types';
import { GoogleGenAI } from "@google/genai";
import { CameraIcon, CarIcon, UserIcon, XIcon, EyeIcon, EyeOffIcon, AlertTriangleIcon } from './components/icons';
import { ApiConfigModal } from './components/ApiConfigModal';
import { Loader } from './components/Loader';
import { GOOGLE_SCRIPT_URL } from './config';
import { ReportViewer } from './components/ReportViewer';
import { ConfirmationDialog } from './components/ConfirmationDialog';

type View = 'dashboard' | 'logs' | 'settings';
type ModalType = null | 'start-trip' | 'end-trip' | 'add-vehicle' | 'add-user' | 'update-maintenance' | 'edit-user' | 'change-password' | 'edit-vehicle' | 'view-ongoing-trip';
interface MaintenanceAlert { vehicle: Vehicle; reason: string; }
type MaintenanceType = 'service' | 'oil' | 'accu';

type AddVehicleFormData = Omit<Vehicle, 'id' | 'status' | 'lastServiceDate' | 'lastOilChangeDate' | 'lastAccuCheckDate'> & {
    lastServiceDate: string; // YYYY-MM-DD format from input
    lastOilChangeDate: string;
    lastAccuCheckDate: string;
};

// New state interface for confirmation dialog
interface ConfirmationDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}


function App() {
  // Data state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUser = sessionStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  // App logic state
  const isConfigured = GOOGLE_SCRIPT_URL && (GOOGLE_SCRIPT_URL as string) !== "MASUKKAN_URL_SCRIPT_ANDA_DI_SINI";
  const [isLoading, setIsLoading] = useState(isConfigured);
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedMutation, setSelectedMutation] = useState<Mutation | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlert[]>([]);
  const [viewImageSrc, setViewImageSrc] = useState<string | null>(null);
  
  const [confirmationState, setConfirmationState] = useState<ConfirmationDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });


  const SERVICE_INTERVAL_MONTHS = 6;
  const OIL_CHANGE_INTERVAL_MONTHS = 3;
  const ACCU_CHECK_INTERVAL_MONTHS = 12;

  // Generic API call helper
  const callApi = async (action: 'ADD_DATA' | 'UPDATE_DATA' | 'DELETE_DATA', payload: any) => {
    if (!isConfigured) throw new Error("Aplikasi belum dikonfigurasi. Harap edit file config.ts");
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST', redirect: 'follow', mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });
    if (!response.ok) throw new Error(`API call failed: ${response.statusText}`);
    const result = await response.json();
    if (result.error) throw new Error(`API Error: ${result.error}`);
    if (!result.success) throw new Error(`API Error: ${result.message || 'Unknown error'}`);
    return result.data;
  };

  const fetchData = useCallback(async () => {
    if (!isConfigured) return;
    
    setIsLoading(true);
    setError(null);
    setIsInitialSetup(false);
    try {
      // Use no-cache to ensure fresh data is fetched every time
      const response = await fetch(GOOGLE_SCRIPT_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error("Failed to fetch data from Google Sheet.");
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      setVehicles(data.vehicles || []);
      setMutations(data.mutations || []);

      if (!data.users || data.users.length === 0) {
          const defaultAdmin: User = {
              id: 'u0',
              username: 'admin',
              password: 'password',
              role: Role.ADMIN
          };
          setUsers([defaultAdmin]);
          setIsInitialSetup(true);
      } else {
          setUsers(data.users);
      }

    } catch (err: any) {
      setError(`Gagal memuat data: ${err.message}. Periksa URL di file config.ts dan koneksi Anda.`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('reportId');
    if (idFromUrl) {
      setReportId(idFromUrl);
    }

    if (isConfigured) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [isConfigured, fetchData]);


  useEffect(() => {
      const alerts: MaintenanceAlert[] = [];
      const now = new Date();
      vehicles.forEach(vehicle => {
          if(!vehicle.lastServiceDate || !vehicle.lastOilChangeDate || !vehicle.lastAccuCheckDate) return;
          const lastService = new Date(vehicle.lastServiceDate);
          if (new Date(new Date(vehicle.lastServiceDate).setMonth(lastService.getMonth() + SERVICE_INTERVAL_MONTHS)) < now) {
              alerts.push({ vehicle, reason: `Jadwal servis rutin terlewat.` });
          }
          const lastOilChange = new Date(vehicle.lastOilChangeDate);
          if (new Date(new Date(vehicle.lastOilChangeDate).setMonth(lastOilChange.getMonth() + OIL_CHANGE_INTERVAL_MONTHS)) < now) {
              alerts.push({ vehicle, reason: `Waktunya ganti oli.` });
          }
          const lastAccuCheck = new Date(vehicle.lastAccuCheckDate);
          if (new Date(new Date(vehicle.lastAccuCheckDate).setMonth(lastAccuCheck.getMonth() + ACCU_CHECK_INTERVAL_MONTHS)) < now) {
              alerts.push({ vehicle, reason: `Waktunya pemeriksaan aki.` });
          }
      });
      setMaintenanceAlerts(alerts);
  }, [vehicles]);

  const handleLogin = (username: string, password: string): boolean => {
      const user = users.find(u => u.username === username && u.password === password);
      if (user) {
          sessionStorage.setItem('currentUser', JSON.stringify(user));
          setCurrentUser(user);
          setLoginError(null);
          return true;
      } else {
          setLoginError("Username atau password salah.");
          return false;
      }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    setCurrentUser(null);
    setActiveView('dashboard');
  };

  const handleVehicleSelect = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    if (vehicle.status === VehicleStatus.AVAILABLE) {
      setActiveModal('start-trip');
    } else {
      const ongoingMutation = [...mutations].reverse().find(m => m.vehicleId === vehicle.id && m.status === MutationStatus.ONGOING);
      if (ongoingMutation) {
        setSelectedMutation(ongoingMutation);
        setActiveModal('view-ongoing-trip');
      } else {
        // Data inconsistency: Vehicle is IN_USE but no ONGOING mutation found.
        // Allow user to fix this state.
        setSelectedMutation(null);
        setActiveModal('view-ongoing-trip'); 
      }
    }
  };
  
  const handleOpenMaintenanceModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setActiveModal('update-maintenance');
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedVehicle(null);
    setSelectedMutation(null);
    setSelectedUser(null);
  };

  const handleStartTrip = async (formData: { driver: string; destination: string; startKm: string; driverPhoto: string; }) => {
    if (!selectedVehicle) return;
    
    setMutationMessage('Sedang menyimpan data...');

    const newMutation: Mutation = {
      id: `m${Date.now()}`,
      vehicleId: selectedVehicle.id,
      driver: formData.driver,
      destination: formData.destination,
      driverPhoto: formData.driverPhoto,
      startKm: parseInt(formData.startKm, 10),
      startTime: new Date().toISOString(),
      status: MutationStatus.ONGOING
    };
    
    const updatedVehicle = { ...selectedVehicle, status: VehicleStatus.IN_USE };
    
    try {
      await callApi('ADD_DATA', { sheetName: 'Mutations', data: newMutation });
      await callApi('UPDATE_DATA', { sheetName: 'Vehicles', data: { id: selectedVehicle.id, status: VehicleStatus.IN_USE } });
      setMutations(prev => [...prev, newMutation]);
      setVehicles(prev => prev.map(v => v.id === selectedVehicle.id ? updatedVehicle : v));
      closeModal();
    } catch (err) {
      alert(`Gagal memulai perjalanan: ${err}`);
    } finally {
      setMutationMessage(null);
    }
  };

  const handleEndTrip = async (formData: { endKm: number; notes: string; }) => {
    if (!selectedMutation || !selectedVehicle) return;

    setMutationMessage('Menyelesaikan perjalanan...');

    try {
      // Handle data recovery case for inconsistent data
      if (selectedMutation.id.startsWith('temp_')) {
          const recoveredMutation: Mutation = {
              ...selectedMutation,
              id: `m${Date.now()}`, // Generate a new permanent ID
              endKm: formData.endKm,
              notes: `[PEMULIHAN DATA] ${formData.notes || 'Tidak ada catatan.'}`,
              endTime: new Date().toISOString(),
              distance: formData.endKm > selectedMutation.startKm ? formData.endKm - selectedMutation.startKm : 0,
              status: MutationStatus.COMPLETED,
          };

          const vehiclePayload = { id: selectedVehicle.id, status: VehicleStatus.AVAILABLE };
          await callApi('ADD_DATA', { sheetName: 'Mutations', data: recoveredMutation });
          await callApi('UPDATE_DATA', { sheetName: 'Vehicles', data: vehiclePayload });

          alert("Data berhasil disimpan");
          setMutations(prev => [...prev, recoveredMutation]);
          setVehicles(prev => prev.map(v => v.id === selectedVehicle.id ? { ...v, status: VehicleStatus.AVAILABLE } : v));
          closeModal();
          return;
      }

      // Original logic for normal trip ending
      const distance = formData.endKm - selectedMutation.startKm;
      const endTime = new Date().toISOString();

      const mutationPayload = {
        id: selectedMutation.id,
        endKm: formData.endKm,
        notes: formData.notes,
        endTime: endTime,
        distance: distance > 0 ? distance : 0,
        status: MutationStatus.COMPLETED
      };
      
      const vehiclePayload = { 
        id: selectedVehicle.id, 
        status: VehicleStatus.AVAILABLE 
      };

      await callApi('UPDATE_DATA', { sheetName: 'Mutations', data: mutationPayload });
      await callApi('UPDATE_DATA', { sheetName: 'Vehicles', data: vehiclePayload });

      const fullUpdatedMutation = { ...selectedMutation, ...mutationPayload };
      const fullUpdatedVehicle = { ...selectedVehicle, status: VehicleStatus.AVAILABLE };

      alert("Data berhasil disimpan");
      setMutations(prev => prev.map(m => m.id === selectedMutation.id ? fullUpdatedMutation : m));
      setVehicles(prev => prev.map(v => v.id === selectedVehicle.id ? fullUpdatedVehicle : v));
      closeModal();
    } catch (err) {
      alert(`Gagal menyelesaikan perjalanan: ${err}`);
    } finally {
        setMutationMessage(null);
    }
  };
  
  const handleCreateVehicle = async (formData: AddVehicleFormData) => {
    setMutationMessage('Menambahkan kendaraan...');
    try {
        const newVehicle: Vehicle = {
            id: `v${Date.now()}`,
            plateNumber: formData.plateNumber,
            brand: formData.brand,
            year: formData.year,
            color: formData.color,
            status: VehicleStatus.AVAILABLE,
            lastServiceDate: new Date(formData.lastServiceDate).toISOString(),
            lastOilChangeDate: new Date(formData.lastOilChangeDate).toISOString(),
            lastAccuCheckDate: new Date(formData.lastAccuCheckDate).toISOString(),
        };
        await callApi('ADD_DATA', { sheetName: 'Vehicles', data: newVehicle });
        setVehicles(prev => [...prev, newVehicle]);
        closeModal();
    } catch (err) {
        alert(`Gagal menambah kendaraan: ${err}`);
    } finally {
        setMutationMessage(null);
    }
  };
  
  const handleCreateUser = async (formData: Omit<User, 'id'>) => {
    setMutationMessage('Menambahkan pengguna...');
    try {
        const newUser: User = { id: `u${Date.now()}`, ...formData };
        if(isInitialSetup) { // If it's the first user, replace the temporary admin
            await callApi('ADD_DATA', { sheetName: 'Users', data: newUser });
            setUsers([newUser]);
            setIsInitialSetup(false);
        } else {
            await callApi('ADD_DATA', { sheetName: 'Users', data: newUser });
            setUsers(prev => [...prev, newUser]);
        }
        closeModal();
    } catch (err) {
        alert(`Gagal menambah pengguna: ${err}`);
    } finally {
        setMutationMessage(null);
    }
  };

  const handleUpdateMaintenance = async (vehicleId: string, type: MaintenanceType) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    
    setMutationMessage('Memperbarui data perawatan...');
    try {
        const today = new Date().toISOString();
        let updatePayload: { id: string, lastServiceDate?: string, lastOilChangeDate?: string, lastAccuCheckDate?: string } = { id: vehicleId };
        let stateUpdateKey: 'lastServiceDate' | 'lastOilChangeDate' | 'lastAccuCheckDate' = 'lastServiceDate';

        if (type === 'service') {
            updatePayload.lastServiceDate = today;
            stateUpdateKey = 'lastServiceDate';
        }
        if (type === 'oil') {
            updatePayload.lastOilChangeDate = today;
            stateUpdateKey = 'lastOilChangeDate';
        }
        if (type === 'accu') {
            updatePayload.lastAccuCheckDate = today;
            stateUpdateKey = 'lastAccuCheckDate';
        }
        await callApi('UPDATE_DATA', { sheetName: 'Vehicles', data: updatePayload });
        setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, [stateUpdateKey]: today } : v));
        closeModal();
    } catch (err) {
      alert(`Gagal memperbarui perawatan: ${err}`);
    } finally {
        setMutationMessage(null);
    }
  };

  const handleOpenEditUserModal = (user: User) => {
    setSelectedUser(user);
    setActiveModal('edit-user');
  };

  const handleOpenChangePasswordModal = (user: User) => {
    setSelectedUser(user);
    setActiveModal('change-password');
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      alert("Anda tidak dapat menghapus akun Anda sendiri.");
      return;
    }

    const onConfirmDelete = async () => {
      setMutationMessage('Menghapus pengguna...');
      try {
        await callApi('DELETE_DATA', { sheetName: 'Users', id: userId });
        setUsers(prev => prev.filter(u => u.id !== userId));
      } catch (err) {
        alert(`Gagal menghapus pengguna: ${err}`);
      } finally {
          setMutationMessage(null);
          setConfirmationState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
      }
    };

    setConfirmationState({
      isOpen: true,
      title: 'Konfirmasi Hapus Pengguna',
      message: 'Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat diurungkan.',
      onConfirm: onConfirmDelete,
    });
  };


  const handleUpdateUser = async (userId: string, formData: { username: string; role: Role; }) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    setMutationMessage('Memperbarui pengguna...');
    try {
        const payload = { id: userId, ...formData };
        await callApi('UPDATE_DATA', { sheetName: 'Users', data: payload });
        const updatedUser = { ...user, ...formData };
        setUsers(prev => prev.map(u => (u.id === userId ? updatedUser : u)));
        closeModal();
    } catch (err) {
        alert(`Gagal memperbarui pengguna: ${err}`);
    } finally {
        setMutationMessage(null);
    }
  };

  const handleChangePassword = async (userId: string, newPassword: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    setMutationMessage('Mengganti password...');
    try {
        const payload = { id: userId, password: newPassword };
        await callApi('UPDATE_DATA', { sheetName: 'Users', data: payload });
        const updatedUser = { ...user, password: newPassword };
        setUsers(prev => prev.map(u => (u.id === userId ? updatedUser : u)));
        
        if (currentUser?.id === userId) {
            sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
            setCurrentUser(updatedUser);
        }
        
        closeModal();
    } catch (err) {
        alert(`Gagal mengganti password: ${err}`);
    } finally {
        setMutationMessage(null);
    }
  };

  const handleOpenEditVehicleModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setActiveModal('edit-vehicle');
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    const vehicleToDelete = vehicles.find(v => v.id === vehicleId);
    if (vehicleToDelete?.status === VehicleStatus.IN_USE) {
        alert("Tidak dapat menghapus kendaraan yang sedang dalam perjalanan.");
        return;
    }

    const onConfirmDelete = async () => {
      setMutationMessage('Menghapus kendaraan...');
      try {
        await callApi('DELETE_DATA', { sheetName: 'Vehicles', id: vehicleId });
        setVehicles(prev => prev.filter(v => v.id !== vehicleId));
      } catch (err) {
        alert(`Gagal menghapus kendaraan: ${err}`);
      } finally {
          setMutationMessage(null);
          setConfirmationState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
      }
    };
    
    setConfirmationState({
      isOpen: true,
      title: 'Konfirmasi Hapus Kendaraan',
      message: `Apakah Anda yakin ingin menghapus kendaraan ${vehicleToDelete?.brand} (${vehicleToDelete?.plateNumber})? Tindakan ini tidak dapat diurungkan.`,
      onConfirm: onConfirmDelete,
    });
  };

  const handleUpdateVehicle = async (updatedVehicleData: Vehicle) => {
      setMutationMessage('Memperbarui kendaraan...');
      try {
          await callApi('UPDATE_DATA', { sheetName: 'Vehicles', data: updatedVehicleData });
          setVehicles(prev => prev.map(v => (v.id === updatedVehicleData.id ? updatedVehicleData : v)));
          closeModal();
      } catch (err) {
          alert(`Gagal memperbarui kendaraan: ${err}`);
      } finally {
          setMutationMessage(null);
      }
  };


  const generateAINotes = async (mutation: Mutation | null): Promise<string> => {
    if (!mutation) return "Informasi perjalanan tidak ditemukan.";
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const vehicle = vehicles.find(v => v.id === mutation.vehicleId);
        const prompt = `Buatkan ringkasan dan catatan singkat untuk perjalanan kendaraan dengan detail berikut. Gunakan Bahasa Indonesia.
        Kendaraan: ${vehicle?.brand} (${vehicle?.plateNumber})
        Pengemudi: ${mutation.driver}
        Tujuan: ${mutation.destination}
        Waktu Mulai: ${new Date(mutation.startTime).toLocaleString('id-ID')}
        KM Awal: ${mutation.startKm}
        Perjalanan ini akan berakhir. Buatkan template untuk kolom catatan pada log perjalanan. Sertakan placeholder untuk isu yang mungkin ditemui atau kejadian penting selama perjalanan (contoh: [Kondisi Ban], [Performa Mesin], [Catatan Lainnya]). Jaga agar tetap profesional dan ringkas.`;
        
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text;
    } catch (error) {
        console.error("Error generating AI notes:", error);
        return "Gagal membuat catatan. Silakan periksa koneksi atau kunci API Anda.";
    }
  };

  const handleProceedToEndTrip = () => {
    if (!selectedMutation && selectedVehicle) {
        // Create a temporary mutation object for the recovery process
        const tempMutation: Mutation = {
            id: `temp_${selectedVehicle.id}_${Date.now()}`,
            vehicleId: selectedVehicle.id,
            driver: 'N/A (Data Hilang)',
            destination: 'N/A (Data Hilang)',
            startTime: new Date().toISOString(), // Fallback
            startKm: 0, // Fallback, user will input end KM
            status: MutationStatus.ONGOING,
        };
        setSelectedMutation(tempMutation);
    }
    setActiveModal('end-trip');
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <VehicleList vehicles={vehicles} onVehicleSelect={handleVehicleSelect} maintenanceAlerts={maintenanceAlerts} onOpenMaintenanceModal={handleOpenMaintenanceModal} onRefresh={fetchData} />;
      case 'logs':
        return <MutationLog mutations={mutations} vehicles={vehicles} onRefresh={fetchData} />;
      case 'settings':
        if (currentUser?.role === Role.ADMIN) {
          return <Settings 
            vehicles={vehicles} 
            onAddVehicle={() => setActiveModal('add-vehicle')} 
            onEditVehicle={handleOpenEditVehicleModal}
            onDeleteVehicle={handleDeleteVehicle}
            users={users} 
            onAddUser={() => setActiveModal('add-user')} 
            currentUser={currentUser}
            onEditUser={handleOpenEditUserModal}
            onChangePassword={handleOpenChangePasswordModal}
            onDeleteUser={handleDeleteUser}
            isSubmitting={!!mutationMessage}
          />;
        }
        return <div className="p-8 text-center text-slate-500">Anda tidak memiliki hak akses untuk halaman ini.</div>;
      default:
        return null;
    }
  };

  if (!isConfigured) {
      return <ApiConfigModal />;
  }
  
  if (isLoading) {
      return (
          <div className="flex h-screen items-center justify-center">
              <Loader message={reportId ? "Memuat Laporan..." : "Menghubungkan ke Google Sheets..."} />
          </div>
      );
  }

  if (reportId) {
    return <ReportViewer reportId={reportId} mutations={mutations} vehicles={vehicles} onViewImage={setViewImageSrc} />;
  }

  if (error) {
      return (
          <div className="flex h-screen items-center justify-center p-4">
              <div className="text-center bg-white p-8 rounded-lg shadow-lg max-w-lg">
                  <h2 className="text-xl font-bold text-red-600 mb-4">Terjadi Kesalahan</h2>
                  <p className="text-slate-600 mb-6">{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="bg-green-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-green-700"
                  >
                    Coba Lagi
                  </button>
                  <p className="text-xs text-slate-500 mt-4">Pastikan URL di file <code className="bg-slate-200 p-1 rounded">config.ts</code> sudah benar.</p>
              </div>
          </div>
      );
  }

  if (!currentUser) {
      return <LoginScreen onLogin={handleLogin} error={loginError} isInitialSetup={isInitialSetup} />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar 
        activeView={activeView} 
        onNavigate={setActiveView}
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {mutationMessage && <Loader message={mutationMessage} />}
        <Header onMenuClick={() => setSidebarOpen(true)} currentUser={currentUser} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {renderContent()}
        </main>
        
        {activeModal === 'start-trip' && selectedVehicle && (
            <Modal isOpen={true} onClose={closeModal} title={`Mulai Perjalanan - ${selectedVehicle.plateNumber}`}>
                <StartTripForm vehicle={selectedVehicle} onSubmit={handleStartTrip} onCancel={closeModal} isSubmitting={!!mutationMessage} />
            </Modal>
        )}
        
        {activeModal === 'view-ongoing-trip' && selectedVehicle && (
            <Modal isOpen={true} onClose={closeModal} title={`Perjalanan Berlangsung - ${selectedVehicle.plateNumber}`}>
                <ViewOngoingTrip 
                    mutation={selectedMutation}
                    onEndTrip={handleProceedToEndTrip} 
                    onCancel={closeModal} 
                    onViewImage={setViewImageSrc}
                />
            </Modal>
        )}

        {activeModal === 'end-trip' && selectedMutation && selectedVehicle && (
            <Modal isOpen={true} onClose={closeModal} title={`Selesaikan Perjalanan - ${selectedVehicle.plateNumber}`}>
                <EndTripForm mutation={selectedMutation} onSubmit={handleEndTrip} onCancel={closeModal} onGenerateNotes={() => generateAINotes(selectedMutation)} onViewImage={setViewImageSrc} isSubmitting={!!mutationMessage} />
            </Modal>
        )}
        
        {activeModal === 'add-vehicle' && (
             <Modal isOpen={true} onClose={closeModal} title="Tambah Kendaraan Baru">
                <AddVehicleForm onSubmit={handleCreateVehicle} onCancel={closeModal} isSubmitting={!!mutationMessage} />
            </Modal>
        )}
        {activeModal === 'edit-vehicle' && selectedVehicle && (
            <Modal isOpen={true} onClose={closeModal} title={`Edit Kendaraan - ${selectedVehicle.plateNumber}`}>
                <EditVehicleForm 
                    vehicle={selectedVehicle} 
                    onSubmit={handleUpdateVehicle} 
                    onCancel={closeModal} 
                    isSubmitting={!!mutationMessage}
                />
            </Modal>
        )}
        {activeModal === 'add-user' && (
             <Modal isOpen={true} onClose={closeModal} title="Tambah Pengguna Baru">
                <AddUserForm onSubmit={handleCreateUser} onCancel={closeModal} isSubmitting={!!mutationMessage} />
            </Modal>
        )}
        {activeModal === 'update-maintenance' && selectedVehicle && (
            <Modal isOpen={true} onClose={closeModal} title={`Perbarui Perawatan - ${selectedVehicle.brand}`}>
                <UpdateMaintenanceForm 
                  vehicle={selectedVehicle} 
                  onUpdate={handleUpdateMaintenance} 
                  onCancel={closeModal} 
                  isSubmitting={!!mutationMessage}
                />
            </Modal>
        )}
        {activeModal === 'edit-user' && selectedUser && (
            <Modal isOpen={true} onClose={closeModal} title={`Edit Pengguna - ${selectedUser.username}`}>
                <EditUserForm user={selectedUser} onSubmit={handleUpdateUser} onCancel={closeModal} isSubmitting={!!mutationMessage} />
            </Modal>
        )}
        {activeModal === 'change-password' && selectedUser && (
            <Modal isOpen={true} onClose={closeModal} title={`Ganti Password - ${selectedUser.username}`}>
                <ChangePasswordForm user={selectedUser} onSubmit={handleChangePassword} onCancel={closeModal} isSubmitting={!!mutationMessage} />
            </Modal>
        )}
        {viewImageSrc && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4 transition-opacity duration-300"
              onClick={() => setViewImageSrc(null)}
            >
                <img src={viewImageSrc} alt="Tampilan foto" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}/>
                <button onClick={() => setViewImageSrc(null)} className="absolute top-4 right-4 text-white p-2 bg-black/50 rounded-full hover:bg-black/75 transition-colors">
                    <XIcon className="h-6 w-6" />
                </button>
            </div>
        )}
        <ConfirmationDialog
            isOpen={confirmationState.isOpen}
            onClose={() => setConfirmationState({ ...confirmationState, isOpen: false })}
            onConfirm={confirmationState.onConfirm}
            title={confirmationState.title}
            message={confirmationState.message}
            isSubmitting={!!mutationMessage}
        />
      </div>
    </div>
  );
}

const LoginScreen: React.FC<{ onLogin: (u: string, p: string) => boolean; error: string | null; isInitialSetup: boolean; }> = ({ onLogin, error, isInitialSetup }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setTimeout(() => {
            if(!onLogin(username, password)) {
              setIsLoading(false);
            }
        }, 500);
    };

    return (
        <div 
            className="min-h-screen flex flex-col justify-center items-center p-4 bg-cover bg-center relative"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=2070&auto=format&fit=crop')" }}
        >
            <div className="absolute inset-0 bg-black bg-opacity-50"></div>
            <div className="relative max-w-md w-full mx-auto z-10">
                <div className="flex justify-center items-center mb-6">
                    <img src="https://gembiralokazoo.com/storage/about/HontizxOKlzXRY3IuUlY6wGXZUqtYW5VRMkrgTxt.png" alt="Gembira Loka Zoo Logo" className="h-20 w-auto object-contain" />
                </div>
                
                <div className="bg-white p-8 rounded-lg shadow-lg">
                     <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Sistem Mutasi Kendaraan</h1>
                     <p className="text-center text-slate-500 mb-6">Silakan masuk untuk melanjutkan</p>
                    {isInitialSetup && (
                        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm p-4 rounded-md mb-6">
                            <p><span className="font-bold">Setup Awal:</span> Sheet pengguna Anda kosong.</p>
                            <p>Gunakan kredensial berikut untuk login pertama kali:</p>
                            <p className="mt-2">Username: <code className="bg-slate-200 text-slate-800 p-1 rounded">admin</code></p>
                            <p>Password: <code className="bg-slate-200 text-slate-800 p-1 rounded">password</code></p>
                            <p className="mt-2 text-xs">Penting: Segera ganti password ini di menu Pengaturan setelah login.</p>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-slate-700">Username</label>
                            <input type="text" name="username" id="username" value={username} onChange={e => setUsername(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                            <div className="relative mt-1">
                                <input 
                                    type={isPasswordVisible ? 'text' : 'password'} 
                                    name="password" 
                                    id="password" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    required 
                                    className="block w-full px-3 py-2 pr-10 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setIsPasswordVisible(!isPasswordVisible)} 
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-700"
                                    aria-label={isPasswordVisible ? "Sembunyikan password" : "Tampilkan password"}
                                >
                                    {isPasswordVisible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <div>
                            <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400">
                                {isLoading ? 'Memproses...' : 'Masuk'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
             <p className="absolute bottom-4 text-xs text-white/60 z-10">Copyright &copy; {new Date().getFullYear()} Bison</p>
        </div>
    );
};

const StartTripForm: React.FC<{ vehicle: Vehicle, onSubmit: (data: { driver: string; destination: string; startKm: string; driverPhoto: string; }) => void, onCancel: () => void, isSubmitting: boolean }> = ({ onSubmit, onCancel, isSubmitting }) => {
    const [formData, setFormData] = useState({ driver: '', destination: '', startKm: '' });
    const [driverPhoto, setDriverPhoto] = useState<string | null>(null);
    
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [canSwitchCamera, setCanSwitchCamera] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const startCamera = async () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            setCameraError(null);

            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            try {
                const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
                }
                setStream(newStream);
            } catch (err) {
                console.error("Error starting camera with facingMode:", err);
                try {
                    console.log("Falling back to default camera...");
                    const fallbackConstraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
                    const newStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                    if (videoRef.current) {
                        videoRef.current.srcObject = newStream;
                    }
                    setStream(newStream);
                } catch (fallbackErr) {
                    console.error("Fallback camera also failed:", fallbackErr);
                    setCameraError("Gagal memulai kamera. Pastikan izin telah diberikan.");
                }
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [facingMode]);

    useEffect(() => {
        const checkCameraCapabilities = async () => {
            try {
                // Dummy request to ensure permissions are active
                const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                if (videoDevices.length > 1) {
                    setCanSwitchCamera(true);
                }
                // Stop the dummy stream
                tempStream.getTracks().forEach(track => track.stop());
            } catch (err) {
                console.error("Could not enumerate devices:", err);
            }
        };
        checkCameraCapabilities();
    }, []);

    const handleSwitchCamera = () => {
        if (canSwitchCamera) {
            setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
        }
    };

    const capturePhoto = (): string | null => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.8);
        }
        return null;
    };
    
    const handleCaptureDriverPhoto = () => setDriverPhoto(capturePhoto());

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const updatedValue = name === 'startKm' ? value.replace(/[^0-9]/g, '') : value;
        setFormData(prev => ({ ...prev, [name]: updatedValue }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!driverPhoto) {
            alert("Harap ambil foto pengemudi.");
            return;
        }
        onSubmit({ ...formData, driverPhoto });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="driver" className="block text-sm font-medium text-slate-700">Nama Pengemudi</label>
                        <input type="text" name="driver" id="driver" value={formData.driver} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                    </div>
                    <div>
                        <label htmlFor="destination" className="block text-sm font-medium text-slate-700">Tujuan</label>
                        <input type="text" name="destination" id="destination" value={formData.destination} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                    </div>
                    <div>
                        <label htmlFor="startKm" className="block text-sm font-medium text-slate-700">Kilometer Awal</label>
                        <input type="text" inputMode="numeric" pattern="[0-9]*" name="startKm" id="startKm" value={formData.startKm} onChange={handleChange} required placeholder="0" className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Foto Pengemudi</label>
                        <div className="w-24 h-24 bg-slate-200 rounded-md overflow-hidden flex items-center justify-center">
                            {driverPhoto ? <img src={driverPhoto} alt="Driver" className="w-full h-full object-cover"/> : <UserIcon className="w-12 h-12 text-slate-400"/>}
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Kamera</label>
                    <div className="w-full aspect-video bg-slate-900 rounded-md overflow-hidden flex items-center justify-center relative">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" muted></video>
                        {cameraError && <p className="absolute text-white text-xs text-center p-2 bg-black/50">{cameraError}</p>}
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>
                    {canSwitchCamera && (
                        <button type="button" onClick={handleSwitchCamera} className="text-xs text-green-600 hover:underline">Ganti Kamera</button>
                    )}
                    <div className="pt-2">
                         <button type="button" onClick={handleCaptureDriverPhoto} className="w-full text-sm bg-slate-700 text-white font-semibold px-3 py-2 rounded-lg hover:bg-slate-800 disabled:bg-slate-400">
                           Ambil Foto Pengemudi
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300" disabled={isSubmitting}>Batal</button>
                <button 
                    type="submit" 
                    className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[200px] transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Menyimpan...</span>
                        </>
                    ) : (
                        'Mulai Perjalanan'
                    )}
                </button>
            </div>
        </form>
    );
}

const PhotoGrid: React.FC<{ photos: string[], onView: (src: string) => void, title: string }> = ({ photos, onView, title }) => (
  <div>
      <h4 className="font-semibold text-slate-700 mb-2">{title}</h4>
      {photos && photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {photos.map((photo, index) => (
                  <button key={index} onClick={() => onView(photo)} className="focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg">
                      <img src={photo} alt={`Kondisi Kendaraan ${index + 1}`} className="w-full h-24 object-cover rounded-lg shadow-sm cursor-pointer hover:opacity-80 transition-opacity" />
                  </button>
              ))}
          </div>
      ) : (
          <p className="text-xs text-slate-400">Tidak ada foto.</p>
      )}
  </div>
);

const ViewOngoingTrip: React.FC<{ mutation: Mutation | null, onEndTrip: () => void, onCancel: () => void, onViewImage: (src: string) => void }> = ({ mutation, onEndTrip, onCancel, onViewImage }) => {
    if (!mutation) {
        return (
            <div>
                <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 text-red-800 space-y-2">
                    <div className="flex items-center gap-2">
                       <AlertTriangleIcon className="h-6 w-6 text-red-500" />
                       <h3 className="text-lg font-semibold">Data Perjalanan Tidak Ditemukan</h3>
                    </div>
                    <p className="text-sm">
                        Kendaraan ini berstatus "Dalam Perjalanan", tetapi detail perjalanan aktif tidak dapat ditemukan. Hal ini mungkin disebabkan oleh kesalahan data.
                    </p>
                    <p className="text-sm">
                        Anda dapat melanjutkan untuk menyelesaikan perjalanan ini. Tindakan ini akan membuat catatan perjalanan baru untuk memperbaiki status kendaraan.
                    </p>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300">Tutup</button>
                    <button type="button" onClick={onEndTrip} className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700">Selesaikan Perjalanan</button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Detail Perjalanan</h3>
                <div className="flex items-start space-x-4">
                    <button onClick={() => mutation.driverPhoto && onViewImage(mutation.driverPhoto)} className="focus:outline-none focus:ring-2 focus:ring-green-500 rounded-full">
                         {mutation.driverPhoto ? (
                            <img src={mutation.driverPhoto} alt={mutation.driver} className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md cursor-pointer" />
                        ) : (
                            <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center">
                                <UserIcon className="w-10 h-10 text-slate-400" />
                            </div>
                        )}
                    </button>
                    <div className="text-sm space-y-1.5 text-slate-600">
                        <p><strong className="font-medium text-slate-800">Pengemudi:</strong> {mutation.driver}</p>
                        <p><strong className="font-medium text-slate-800">Tujuan:</strong> {mutation.destination}</p>
                        <p><strong className="font-medium text-slate-800">Waktu Mulai:</strong> {new Date(mutation.startTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        <p><strong className="font-medium text-slate-800">KM Awal:</strong> {mutation.startKm} km</p>
                    </div>
                </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300">Tutup</button>
                <button type="button" onClick={onEndTrip} className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700">Selesaikan Perjalanan</button>
            </div>
        </div>
    );
};

const EndTripForm: React.FC<{ mutation: Mutation, onSubmit: (data: any) => void, onCancel: () => void, onGenerateNotes: () => Promise<string>, onViewImage: (src: string) => void, isSubmitting: boolean }> = ({ mutation, onSubmit, onCancel, onGenerateNotes, onViewImage, isSubmitting }) => {
    const [formData, setFormData] = useState({ endKm: mutation.startKm, notes: '' });
    const [isGenerating, setIsGenerating] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleGenerateNotes = async () => {
        setIsGenerating(true);
        const generatedNotes = await onGenerateNotes();
        setFormData(prev => ({ ...prev, notes: generatedNotes }));
        setIsGenerating(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.endKm >= mutation.startKm) {
            onSubmit(formData);
        } else {
            alert("Kilometer akhir harus lebih besar atau sama dengan kilometer awal.");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-2 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Detail Perjalanan</h3>
                <div className="flex items-start space-x-4">
                     <button onClick={() => mutation.driverPhoto && onViewImage(mutation.driverPhoto)} className="focus:outline-none focus:ring-2 focus:ring-green-500 rounded-full">
                        {mutation.driverPhoto ? (
                            <img src={mutation.driverPhoto} alt={mutation.driver} className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md cursor-pointer" />
                        ) : (
                            <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center">
                                <UserIcon className="w-10 h-10 text-slate-400" />
                            </div>
                        )}
                    </button>
                    <div className="text-sm space-y-1.5 text-slate-600">
                        <p><strong className="font-medium text-slate-800">Pengemudi:</strong> {mutation.driver}</p>
                        <p><strong className="font-medium text-slate-800">Tujuan:</strong> {mutation.destination}</p>
                        <p><strong className="font-medium text-slate-800">Waktu Mulai:</strong> {new Date(mutation.startTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        <p><strong className="font-medium text-slate-800">KM Awal:</strong> {mutation.startKm} km</p>
                    </div>
                </div>
            </div>

            <div>
                <label htmlFor="endKm" className="block text-sm font-medium text-slate-700">Kilometer Akhir</label>
                <input type="number" name="endKm" id="endKm" value={formData.endKm} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
            <div>
                <div className="flex justify-between items-center">
                    <label htmlFor="notes" className="block text-sm font-medium text-slate-700">Catatan Perjalanan</label>
                    <button type="button" onClick={handleGenerateNotes} disabled={isGenerating} className="text-xs text-green-600 hover:underline mb-1 disabled:opacity-50 disabled:cursor-wait">
                        {isGenerating ? 'Membuat...' : 'Buat catatan dengan AI'}
                    </button>
                </div>
                <textarea name="notes" id="notes" value={formData.notes} onChange={handleChange} rows={4} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" placeholder={isGenerating ? 'AI sedang menulis catatan...' : 'Tulis catatan atau buat dengan AI...'}></textarea>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300">Batal</button>
                <button 
                    type="submit" 
                    className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[200px] transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
                    disabled={isSubmitting || isGenerating}
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Menyimpan...</span>
                        </>
                    ) : (
                        'Selesaikan Perjalanan'
                    )}
                </button>
            </div>
        </form>
    )
}

const AddVehicleForm: React.FC<{ onSubmit: (data: AddVehicleFormData) => void, onCancel: () => void, isSubmitting: boolean }> = ({ onSubmit, onCancel, isSubmitting }) => {
    const todayISO = new Date().toISOString().split('T')[0];
    const [formData, setFormData] = useState({
        plateNumber: '',
        brand: '',
        year: new Date().getFullYear(),
        color: '',
        lastServiceDate: todayISO,
        lastOilChangeDate: todayISO,
        lastAccuCheckDate: todayISO,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) || 0 : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.plateNumber && formData.brand && formData.year > 1900 && formData.color) {
            onSubmit(formData);
        } else {
            alert("Harap isi semua kolom dengan benar.");
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="plateNumber" className="block text-sm font-medium text-slate-700">Nomor Polisi</label>
                <input type="text" name="plateNumber" id="plateNumber" value={formData.plateNumber} onChange={handleChange} placeholder="Contoh: B 1234 ABC" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
            <div>
                <label htmlFor="brand" className="block text-sm font-medium text-slate-700">Merk & Model</label>
                <input type="text" name="brand" id="brand" value={formData.brand} onChange={handleChange} placeholder="Contoh: Toyota Avanza" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                  <label htmlFor="year" className="block text-sm font-medium text-slate-700">Tahun</label>
                  <input type="number" name="year" id="year" value={formData.year} onChange={handleChange} placeholder="Tahun" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
               <div>
                  <label htmlFor="color" className="block text-sm font-medium text-slate-700">Warna</label>
                  <input type="text" name="color" id="color" value={formData.color} onChange={handleChange} placeholder="Warna" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-200 space-y-4">
                <h3 className="text-md font-semibold text-slate-800">Data Perawatan Awal</h3>
                <p className="text-xs text-slate-500 -mt-3">Masukkan tanggal terakhir perawatan dilakukan untuk kendaraan ini.</p>
                <div>
                    <label htmlFor="lastServiceDate" className="block text-sm font-medium text-slate-700">Tanggal Servis Terakhir</label>
                    <input type="date" name="lastServiceDate" id="lastServiceDate" value={formData.lastServiceDate} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="lastOilChangeDate" className="block text-sm font-medium text-slate-700">Tanggal Ganti Oli Terakhir</label>
                    <input type="date" name="lastOilChangeDate" id="lastOilChangeDate" value={formData.lastOilChangeDate} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="lastAccuCheckDate" className="block text-sm font-medium text-slate-700">Tanggal Cek Aki Terakhir</label>
                    <input type="date" name="lastAccuCheckDate" id="lastAccuCheckDate" value={formData.lastAccuCheckDate} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed">Batal</button>
                <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[170px] transition-colors disabled:bg-green-400 disabled:cursor-not-allowed">
                     {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Menyimpan...</span>
                        </>
                    ) : (
                        'Simpan Kendaraan'
                    )}
                </button>
            </div>
        </form>
    );
};

const EditVehicleForm: React.FC<{ vehicle: Vehicle, onSubmit: (data: Vehicle) => void, onCancel: () => void, isSubmitting: boolean }> = ({ vehicle, onSubmit, onCancel, isSubmitting }) => {
    const [formData, setFormData] = useState({
        ...vehicle,
        year: vehicle.year || new Date().getFullYear(),
        lastServiceDate: new Date(vehicle.lastServiceDate).toISOString().split('T')[0],
        lastOilChangeDate: new Date(vehicle.lastOilChangeDate).toISOString().split('T')[0],
        lastAccuCheckDate: new Date(vehicle.lastAccuCheckDate).toISOString().split('T')[0],
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) || 0 : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.plateNumber && formData.brand && formData.year > 1900 && formData.color) {
            const submissionData: Vehicle = {
                ...formData,
                year: Number(formData.year),
                lastServiceDate: new Date(formData.lastServiceDate).toISOString(),
                lastOilChangeDate: new Date(formData.lastOilChangeDate).toISOString(),
                lastAccuCheckDate: new Date(formData.lastAccuCheckDate).toISOString(),
            };
            onSubmit(submissionData);
        } else {
            alert("Harap isi semua kolom dengan benar.");
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="plateNumber" className="block text-sm font-medium text-slate-700">Nomor Polisi</label>
                <input type="text" name="plateNumber" id="plateNumber" value={formData.plateNumber} onChange={handleChange} placeholder="Contoh: B 1234 ABC" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
            <div>
                <label htmlFor="brand" className="block text-sm font-medium text-slate-700">Merk & Model</label>
                <input type="text" name="brand" id="brand" value={formData.brand} onChange={handleChange} placeholder="Contoh: Toyota Avanza" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                  <label htmlFor="year" className="block text-sm font-medium text-slate-700">Tahun</label>
                  <input type="number" name="year" id="year" value={formData.year} onChange={handleChange} placeholder="Tahun" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
               <div>
                  <label htmlFor="color" className="block text-sm font-medium text-slate-700">Warna</label>
                  <input type="text" name="color" id="color" value={formData.color} onChange={handleChange} placeholder="Warna" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-200 space-y-4">
                <h3 className="text-md font-semibold text-slate-800">Data Perawatan</h3>
                <p className="text-xs text-slate-500 -mt-3">Perbarui tanggal terakhir perawatan dilakukan untuk kendaraan ini.</p>
                <div>
                    <label htmlFor="lastServiceDate" className="block text-sm font-medium text-slate-700">Tanggal Servis Terakhir</label>
                    <input type="date" name="lastServiceDate" id="lastServiceDate" value={formData.lastServiceDate} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="lastOilChangeDate" className="block text-sm font-medium text-slate-700">Tanggal Ganti Oli Terakhir</label>
                    <input type="date" name="lastOilChangeDate" id="lastOilChangeDate" value={formData.lastOilChangeDate} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="lastAccuCheckDate" className="block text-sm font-medium text-slate-700">Tanggal Cek Aki Terakhir</label>
                    <input type="date" name="lastAccuCheckDate" id="lastAccuCheckDate" value={formData.lastAccuCheckDate} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed">Batal</button>
                <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[200px] transition-colors disabled:bg-green-400 disabled:cursor-not-allowed">
                     {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Menyimpan...</span>
                        </>
                    ) : (
                        'Simpan Perubahan'
                    )}
                </button>
            </div>
        </form>
    );
};

const AddUserForm: React.FC<{ onSubmit: (data: any) => void, onCancel: () => void, isSubmitting: boolean }> = ({ onSubmit, onCancel, isSubmitting }) => {
    const [formData, setFormData] = useState({ username: '', password: '', role: Role.OPERATOR });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.username && formData.password) {
            onSubmit(formData);
        } else {
            alert("Harap isi semua kolom.");
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Username" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Password" required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            <select name="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm bg-white">
                <option value={Role.OPERATOR}>Operator</option>
                <option value={Role.ADMIN}>Admin</option>
            </select>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed">Batal</button>
                <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[180px] transition-colors disabled:bg-green-400 disabled:cursor-not-allowed">
                     {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Menyimpan...</span>
                        </>
                    ) : (
                        'Simpan Pengguna'
                    )}
                </button>
            </div>
        </form>
    );
};

const UpdateMaintenanceForm: React.FC<{ vehicle: Vehicle, onUpdate: (vehicleId: string, type: MaintenanceType) => void, onCancel: () => void, isSubmitting: boolean }> = ({ vehicle, onUpdate, onCancel, isSubmitting }) => {
    
    const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-600">Pilih jenis perawatan yang telah selesai dilakukan. Tanggal akan diperbarui ke hari ini.</p>
            <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">Servis Rutin Terakhir:</span>
                    <span className="text-slate-500">{formatDate(vehicle.lastServiceDate)}</span>
                </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">Ganti Oli Terakhir:</span>
                    <span className="text-slate-500">{formatDate(vehicle.lastOilChangeDate)}</span>
                </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">Pengecekan Aki Terakhir:</span>
                    <span className="text-slate-500">{formatDate(vehicle.lastAccuCheckDate)}</span>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={() => onUpdate(vehicle.id, 'service')} disabled={isSubmitting} className="w-full bg-green-100 text-green-700 font-semibold px-4 py-2 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Tandai Servis Selesai
                </button>
                 <button onClick={() => onUpdate(vehicle.id, 'oil')} disabled={isSubmitting} className="w-full bg-orange-100 text-orange-700 font-semibold px-4 py-2 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Tandai Ganti Oli Selesai
                </button>
                 <button onClick={() => onUpdate(vehicle.id, 'accu')} disabled={isSubmitting} className="w-full bg-teal-100 text-teal-700 font-semibold px-4 py-2 rounded-lg hover:bg-teal-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Tandai Cek Aki Selesai
                </button>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed">Tutup</button>
            </div>
        </div>
    )
};

const EditUserForm: React.FC<{ user: User, onSubmit: (userId: string, data: any) => void, onCancel: () => void, isSubmitting: boolean }> = ({ user, onSubmit, onCancel, isSubmitting }) => {
    const [formData, setFormData] = useState({ username: user.username, role: user.role });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.username) {
            onSubmit(user.id, formData);
        } else {
            alert("Username tidak boleh kosong.");
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700">Username</label>
                <input type="text" name="username" id="username" value={formData.username} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
            <div>
                <label htmlFor="role" className="block text-sm font-medium text-slate-700">Role</label>
                <select name="role" id="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm bg-white">
                    <option value={Role.OPERATOR}>Operator</option>
                    <option value={Role.ADMIN}>Admin</option>
                </select>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed">Batal</button>
                <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[200px] transition-colors disabled:bg-green-400 disabled:cursor-not-allowed">
                     {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Menyimpan...</span>
                        </>
                    ) : (
                        'Simpan Perubahan'
                    )}
                </button>
            </div>
        </form>
    );
};

const ChangePasswordForm: React.FC<{ user: User, onSubmit: (userId: string, newPassword: string) => void, onCancel: () => void, isSubmitting: boolean }> = ({ user, onSubmit, onCancel, isSubmitting }) => {
    const [newPassword, setNewPassword] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length >= 6) {
            onSubmit(user.id, newPassword);
        } else {
            alert("Password minimal harus 6 karakter.");
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">Password Baru</label>
                <input type="password" name="newPassword" id="newPassword" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed">Batal</button>
                <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center min-w-[200px] transition-colors disabled:bg-green-400 disabled:cursor-not-allowed">
                     {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Menyimpan...</span>
                        </>
                    ) : (
                        'Simpan Password'
                    )}
                </button>
            </div>
        </form>
    );
};

export default App;