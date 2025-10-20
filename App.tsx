import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { VehicleList } from './components/VehicleList';
import { MutationLog } from './components/MutationLog';
import { Settings } from './components/Settings';
import { Modal } from './components/Modal';
import { Vehicle, Mutation, VehicleStatus, MutationStatus, User, Role } from './types';
import { GoogleGenAI } from "@google/genai";
import { CameraIcon, CarIcon, UserIcon } from './components/icons';
import { ApiConfigModal } from './components/ApiConfigModal';
import { Loader } from './components/Loader';
import { GOOGLE_SCRIPT_URL } from './config';
import { ReportViewer } from './components/ReportViewer';

type View = 'dashboard' | 'logs' | 'settings';
type ModalType = null | 'start-trip' | 'end-trip' | 'add-vehicle' | 'add-user' | 'update-maintenance' | 'edit-user' | 'change-password' | 'edit-vehicle';
interface MaintenanceAlert { vehicle: Vehicle; reason: string; }
type MaintenanceType = 'service' | 'oil' | 'accu';

type AddVehicleFormData = Omit<Vehicle, 'id' | 'status' | 'lastServiceDate' | 'lastOilChangeDate' | 'lastAccuCheckDate'> & {
    lastServiceDate: string; // YYYY-MM-DD format from input
    lastOilChangeDate: string;
    lastAccuCheckDate: string;
};

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
  const [isMutating, setIsMutating] = useState(false);
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

  const SERVICE_INTERVAL_MONTHS = 6;
  const OIL_CHANGE_INTERVAL_MONTHS = 3;
  const ACCU_CHECK_INTERVAL_MONTHS = 12;

  // Generic API call helper
  const callApi = async (action: 'ADD_DATA' | 'UPDATE_DATA' | 'DELETE_DATA', payload: any) => {
    if (!isConfigured) throw new Error("Aplikasi belum dikonfigurasi. Harap edit file config.ts");
    setIsMutating(true);
    try {
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
    } finally {
      setIsMutating(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('reportId');
    if (idFromUrl) {
      setReportId(idFromUrl);
    }

    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setIsInitialSetup(false);
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
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
    };
    fetchData();
  }, [isConfigured]);


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
      const ongoingMutation = mutations.find(m => m.vehicleId === vehicle.id && m.status === MutationStatus.ONGOING);
      setSelectedMutation(ongoingMutation || null);
      setActiveModal('end-trip');
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
    
    const newMutation: Mutation = {
      id: `m${Date.now()}`,
      vehicleId: selectedVehicle.id,
      ...formData,
      startKm: parseInt(formData.startKm, 10),
      startTime: new Date().toISOString(),
      status: MutationStatus.ONGOING
    };
    
    const updatedVehicle = { ...selectedVehicle, status: VehicleStatus.IN_USE };
    
    try {
      await callApi('ADD_DATA', { sheetName: 'Mutations', data: newMutation });
      await callApi('UPDATE_DATA', { sheetName: 'Vehicles', data: updatedVehicle });
      setMutations(prev => [...prev, newMutation]);
      setVehicles(prev => prev.map(v => v.id === selectedVehicle.id ? updatedVehicle : v));
      closeModal();
    } catch (err) {
      alert(`Gagal memulai perjalanan: ${err}`);
    }
  };

  const handleEndTrip = async (formData: { endKm: number; notes: string; }) => {
    if (!selectedMutation || !selectedVehicle) return;

    const distance = formData.endKm - selectedMutation.startKm;

    const updatedMutation: Mutation = {
      ...selectedMutation,
      ...formData,
      endTime: new Date().toISOString(),
      distance: distance > 0 ? distance : 0,
      status: MutationStatus.COMPLETED
    };
    const updatedVehicle = { ...selectedVehicle, status: VehicleStatus.AVAILABLE };

    try {
      await callApi('UPDATE_DATA', { sheetName: 'Mutations', data: updatedMutation });
      await callApi('UPDATE_DATA', { sheetName: 'Vehicles', data: updatedVehicle });
      setMutations(prev => prev.map(m => m.id === selectedMutation.id ? updatedMutation : m));
      setVehicles(prev => prev.map(v => v.id === selectedVehicle.id ? updatedVehicle : v));
      closeModal();
    } catch (err) {
      alert(`Gagal menyelesaikan perjalanan: ${err}`);
    }
  };
  
  const handleCreateVehicle = async (formData: AddVehicleFormData) => {
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
    try {
        await callApi('ADD_DATA', { sheetName: 'Vehicles', data: newVehicle });
        setVehicles(prev => [...prev, newVehicle]);
        closeModal();
    } catch (err) {
        alert(`Gagal menambah kendaraan: ${err}`);
    }
  };
  
  const handleCreateUser = async (formData: Omit<User, 'id'>) => {
    const newUser: User = { id: `u${Date.now()}`, ...formData };
    try {
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
    }
  };

  const handleUpdateMaintenance = async (vehicleId: string, type: MaintenanceType) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    const today = new Date().toISOString();
    let updatedVehicle: Vehicle = { ...vehicle };

    if (type === 'service') updatedVehicle.lastServiceDate = today;
    if (type === 'oil') updatedVehicle.lastOilChangeDate = today;
    if (type === 'accu') updatedVehicle.lastAccuCheckDate = today;

    try {
      await callApi('UPDATE_DATA', { sheetName: 'Vehicles', data: updatedVehicle });
      setVehicles(prev => prev.map(v => v.id === vehicleId ? updatedVehicle : v));
      closeModal();
    } catch (err) {
      alert(`Gagal memperbarui perawatan: ${err}`);
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
    if (window.confirm("Apakah Anda yakin ingin menghapus pengguna ini?")) {
      try {
        await callApi('DELETE_DATA', { sheetName: 'Users', id: userId });
        setUsers(prev => prev.filter(u => u.id !== userId));
      } catch (err) {
        alert(`Gagal menghapus pengguna: ${err}`);
      }
    }
  };

  const handleUpdateUser = async (userId: string, formData: { username: string; role: Role; }) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const updatedUser = { ...user, ...formData };
    try {
      await callApi('UPDATE_DATA', { sheetName: 'Users', data: updatedUser });
      setUsers(prev => prev.map(u => (u.id === userId ? updatedUser : u)));
      closeModal();
    } catch (err) {
      alert(`Gagal memperbarui pengguna: ${err}`);
    }
  };

  const handleChangePassword = async (userId: string, newPassword: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const updatedUser = { ...user, password: newPassword };
    try {
      await callApi('UPDATE_DATA', { sheetName: 'Users', data: updatedUser });
      setUsers(prev => prev.map(u => (u.id === userId ? updatedUser : u)));
      
      // If the current user changes their own password, update the session storage
      if (currentUser?.id === userId) {
          sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
          setCurrentUser(updatedUser);
      }
      
      closeModal();
    } catch (err) {
      alert(`Gagal mengganti password: ${err}`);
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

    if (window.confirm("Apakah Anda yakin ingin menghapus kendaraan ini? Tindakan ini tidak dapat diurungkan.")) {
      try {
        await callApi('DELETE_DATA', { sheetName: 'Vehicles', id: vehicleId });
        setVehicles(prev => prev.filter(v => v.id !== vehicleId));
      } catch (err) {
        alert(`Gagal menghapus kendaraan: ${err}`);
      }
    }
  };

  const handleUpdateVehicle = async (updatedVehicleData: Vehicle) => {
      try {
          await callApi('UPDATE_DATA', { sheetName: 'Vehicles', data: updatedVehicleData });
          setVehicles(prev => prev.map(v => (v.id === updatedVehicleData.id ? updatedVehicleData : v)));
          closeModal();
      } catch (err) {
          alert(`Gagal memperbarui kendaraan: ${err}`);
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

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <VehicleList vehicles={vehicles} onVehicleSelect={handleVehicleSelect} maintenanceAlerts={maintenanceAlerts} onOpenMaintenanceModal={handleOpenMaintenanceModal} />;
      case 'logs':
        return <MutationLog mutations={mutations} vehicles={vehicles} />;
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
    return <ReportViewer reportId={reportId} mutations={mutations} vehicles={vehicles} />;
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
        {isMutating && <Loader message="Menyimpan perubahan..." />}
        <Header onMenuClick={() => setSidebarOpen(true)} currentUser={currentUser} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {renderContent()}
        </main>
        
        {activeModal === 'start-trip' && selectedVehicle && (
            <Modal isOpen={true} onClose={closeModal} title={`Mulai Perjalanan - ${selectedVehicle.plateNumber}`}>
                <StartTripForm vehicle={selectedVehicle} onSubmit={handleStartTrip} onCancel={closeModal} />
            </Modal>
        )}
        
        {activeModal === 'end-trip' && selectedMutation && selectedVehicle && (
            <Modal isOpen={true} onClose={closeModal} title={`Selesaikan Perjalanan - ${selectedVehicle.plateNumber}`}>
                <EndTripForm mutation={selectedMutation} onSubmit={handleEndTrip} onCancel={closeModal} onGenerateNotes={() => generateAINotes(selectedMutation)} />
            </Modal>
        )}
        
        {activeModal === 'add-vehicle' && (
             <Modal isOpen={true} onClose={closeModal} title="Tambah Kendaraan Baru">
                <AddVehicleForm onSubmit={handleCreateVehicle} onCancel={closeModal} />
            </Modal>
        )}
        {activeModal === 'edit-vehicle' && selectedVehicle && (
            <Modal isOpen={true} onClose={closeModal} title={`Edit Kendaraan - ${selectedVehicle.plateNumber}`}>
                <EditVehicleForm 
                    vehicle={selectedVehicle} 
                    onSubmit={handleUpdateVehicle} 
                    onCancel={closeModal} 
                />
            </Modal>
        )}
        {activeModal === 'add-user' && (
             <Modal isOpen={true} onClose={closeModal} title="Tambah Pengguna Baru">
                <AddUserForm onSubmit={handleCreateUser} onCancel={closeModal} />
            </Modal>
        )}
        {activeModal === 'update-maintenance' && selectedVehicle && (
            <Modal isOpen={true} onClose={closeModal} title={`Perbarui Perawatan - ${selectedVehicle.brand}`}>
                <UpdateMaintenanceForm 
                  vehicle={selectedVehicle} 
                  onUpdate={handleUpdateMaintenance} 
                  onCancel={closeModal} 
                />
            </Modal>
        )}
        {activeModal === 'edit-user' && selectedUser && (
            <Modal isOpen={true} onClose={closeModal} title={`Edit Pengguna - ${selectedUser.username}`}>
                <EditUserForm user={selectedUser} onSubmit={handleUpdateUser} onCancel={closeModal} />
            </Modal>
        )}
        {activeModal === 'change-password' && selectedUser && (
            <Modal isOpen={true} onClose={closeModal} title={`Ganti Password - ${selectedUser.username}`}>
                <ChangePasswordForm user={selectedUser} onSubmit={handleChangePassword} onCancel={closeModal} />
            </Modal>
        )}
      </div>
    </div>
  );
}

const LoginScreen: React.FC<{ onLogin: (u: string, p: string) => boolean; error: string | null; isInitialSetup: boolean; }> = ({ onLogin, error, isInitialSetup }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
                            <input type="password" name="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
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

const StartTripForm: React.FC<{ vehicle: Vehicle, onSubmit: (data: { driver: string; destination: string; startKm: string; driverPhoto: string; }) => void, onCancel: () => void }> = ({ onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({ driver: '', destination: '', startKm: '' });
    const [photo, setPhoto] = useState<string | null>(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        let stream: MediaStream | null = null;
        
        const startCamera = async () => {
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                    setIsCameraOn(true);
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                alert("Tidak dapat mengakses kamera. Pastikan Anda telah memberikan izin.");
            }
        };
        startCamera();

        return () => { // Cleanup on component unmount
            stream?.getTracks().forEach(track => track.stop());
        };
    }, []);
    
    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, canvas.width, canvas.height);
            setPhoto(canvas.toDataURL('image/jpeg'));
            video.srcObject && (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            setIsCameraOn(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // Allow only numbers for startKm, but keep it as a string for input control
        const updatedValue = name === 'startKm' ? value.replace(/[^0-9]/g, '') : value;
        setFormData(prev => ({ ...prev, [name]: updatedValue }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!photo) {
            alert("Harap ambil foto pengemudi.");
            return;
        }
        const startKmNumber = parseInt(formData.startKm, 10);
        if (formData.driver && formData.destination && !isNaN(startKmNumber) && formData.startKm.length > 0) {
            onSubmit({
              driver: formData.driver,
              destination: formData.destination,
              startKm: formData.startKm, // Send as string to preserve leading zeros if needed, parse in handler
              driverPhoto: photo
            });
        } else {
            alert("Harap isi semua kolom dengan benar. Pastikan Kilometer Awal adalah angka yang valid.");
        }
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
                </div>
                <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Foto Pengemudi</label>
                    <div className="w-full aspect-square bg-slate-200 rounded-md overflow-hidden flex items-center justify-center">
                        {photo ? <img src={photo} alt="Driver" className="w-full h-full object-cover"/> : <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>}
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>
                    {isCameraOn && !photo && (
                        <button type="button" onClick={handleCapture} className="mt-2 w-full flex items-center justify-center gap-2 bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-800">
                            <CameraIcon className="w-5 h-5"/> Ambil Foto
                        </button>
                    )}
                </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300">Batal</button>
                <button type="submit" className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700">Mulai Perjalanan</button>
            </div>
        </form>
    )
}

const EndTripForm: React.FC<{ mutation: Mutation, onSubmit: (data: any) => void, onCancel: () => void, onGenerateNotes: () => Promise<string> }> = ({ mutation, onSubmit, onCancel, onGenerateNotes }) => {
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
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Detail Perjalanan</h3>
                <div className="flex items-start space-x-4">
                    {mutation.driverPhoto ? (
                        <img src={mutation.driverPhoto} alt={mutation.driver} className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md" />
                    ) : (
                        <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center">
                            <UserIcon className="w-10 h-10 text-slate-400" />
                        </div>
                    )}
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
                <button type="submit" className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700">Selesaikan Perjalanan</button>
            </div>
        </form>
    )
}

const AddVehicleForm: React.FC<{ onSubmit: (data: AddVehicleFormData) => void, onCancel: () => void }> = ({ onSubmit, onCancel }) => {
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
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300">Batal</button>
                <button type="submit" className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700">Simpan Kendaraan</button>
            </div>
        </form>
    );
};

const EditVehicleForm: React.FC<{ vehicle: Vehicle, onSubmit: (data: Vehicle) => void, onCancel: () => void }> = ({ vehicle, onSubmit, onCancel }) => {
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
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300">Batal</button>
                <button type="submit" className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700">Simpan Perubahan</button>
            </div>
        </form>
    );
};

const AddUserForm: React.FC<{ onSubmit: (data: any) => void, onCancel: () => void }> = ({ onSubmit, onCancel }) => {
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
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300">Batal</button>
                <button type="submit" className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700">Simpan Pengguna</button>
            </div>
        </form>
    );
};

const UpdateMaintenanceForm: React.FC<{ vehicle: Vehicle, onUpdate: (vehicleId: string, type: MaintenanceType) => void, onCancel: () => void }> = ({ vehicle, onUpdate, onCancel }) => {
    
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
                <button onClick={() => onUpdate(vehicle.id, 'service')} className="w-full bg-green-100 text-green-700 font-semibold px-4 py-2 rounded-lg hover:bg-green-200 transition-colors">
                    Tandai Servis Selesai
                </button>
                 <button onClick={() => onUpdate(vehicle.id, 'oil')} className="w-full bg-orange-100 text-orange-700 font-semibold px-4 py-2 rounded-lg hover:bg-orange-200 transition-colors">
                    Tandai Ganti Oli Selesai
                </button>
                 <button onClick={() => onUpdate(vehicle.id, 'accu')} className="w-full bg-teal-100 text-teal-700 font-semibold px-4 py-2 rounded-lg hover:bg-teal-200 transition-colors">
                    Tandai Cek Aki Selesai
                </button>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300">Tutup</button>
            </div>
        </div>
    )
};

const EditUserForm: React.FC<{ user: User, onSubmit: (userId: string, data: any) => void, onCancel: () => void }> = ({ user, onSubmit, onCancel }) => {
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
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300">Batal</button>
                <button type="submit" className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700">Simpan Perubahan</button>
            </div>
        </form>
    );
};

const ChangePasswordForm: React.FC<{ user: User, onSubmit: (userId: string, newPassword: string) => void, onCancel: () => void }> = ({ user, onSubmit, onCancel }) => {
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
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300">Batal</button>
                <button type="submit" className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700">Simpan Password</button>
            </div>
        </form>
    );
};

export default App;