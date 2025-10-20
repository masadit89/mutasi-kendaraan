export enum VehicleStatus {
  AVAILABLE = 'Tersedia',
  IN_USE = 'Dalam Perjalanan',
}

export enum MutationStatus {
  ONGOING = 'Berlangsung',
  COMPLETED = 'Selesai',
}

export enum Role {
  ADMIN = 'Admin',
  OPERATOR = 'Operator',
}

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this should be a hash.
  role: Role;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  brand: string;
  year: number;
  color: string;
  status: VehicleStatus;
  lastServiceDate: string; // ISO string
  lastOilChangeDate: string; // ISO string
  lastAccuCheckDate: string; // ISO string
}

export interface Mutation {
  id: string;
  vehicleId: string;
  driver: string;
  destination: string;
  startTime: string; // ISO string
  startKm: number;
  driverPhoto?: string; // base64 data URL
  endTime?: string; // ISO string
  endKm?: number;
  distance?: number;
  notes?: string;
  status: MutationStatus;
}