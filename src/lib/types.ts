export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  avatar?: string;
}

export interface Condominium {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  totalApartments: number;
  createdAt: string;
}

export interface Resident {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
}

export interface Document {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  uploadedAt: string;
  size: string;
  url?: string;
}

export interface Contract {
  id: string;
  apartmentId: string;
  startDate: string;
  dueDay: number;
  rentValue: number;
  depositPaid: boolean;
  depositValue: number;
  depositDate: string;
  status: 'active' | 'closed';
  endDate?: string;
}

export interface Tenant {
  id: string;
  apartmentId: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  additionalResidents: Resident[];
  documents: Document[];
  contract?: Contract;
  isCurrent: boolean;
  movedInAt: string;
  movedOutAt?: string;
}

export interface PaymentPeriod {
  id: string;
  apartmentId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  value: number;
  status: 'paid' | 'unpaid' | 'overdue';
  paidAt?: string;
  receiptEdited?: boolean;
}

export interface Apartment {
  id: string;
  condominiumId: string;
  number: string;
  floor: number;
  description?: string;
  currentTenantId?: string;
  tenants: Tenant[];
  payments: PaymentPeriod[];
}

export type PaymentStatus = 'paid' | 'unpaid' | 'overdue';
