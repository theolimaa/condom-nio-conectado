import { Apartment, Condominium, Document, PaymentPeriod, Tenant, Contract } from './types';

// Helper to generate periods from a contract start date
export function generatePaymentPeriods(
  apartmentId: string,
  tenantId: string,
  contract: Contract,
  currentYear: number
): PaymentPeriod[] {
  const periods: PaymentPeriod[] = [];
  const start = new Date(contract.startDate);
  const today = new Date('2026-07-15');

  for (let i = 0; i < 24; i++) {
    const periodStart = new Date(start);
    periodStart.setMonth(periodStart.getMonth() + i);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);

    const dueDate = new Date(periodStart);
    dueDate.setDate(contract.dueDay);
    if (dueDate < periodStart) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    const periodYear = periodStart.getFullYear();
    if (periodYear > 2027) break;

    let status: 'paid' | 'unpaid' | 'overdue' = 'unpaid';
    let paidAt: string | undefined;

    if (dueDate < today) {
      if (Math.random() > 0.25) {
        status = 'paid';
        const paidDate = new Date(dueDate);
        paidDate.setDate(paidDate.getDate() - Math.floor(Math.random() * 5));
        paidAt = paidDate.toISOString().split('T')[0];
      } else {
        status = 'overdue';
      }
    }

    periods.push({
      id: `payment-${apartmentId}-${i}`,
      apartmentId,
      tenantId,
      startDate: periodStart.toISOString().split('T')[0],
      endDate: periodEnd.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      value: contract.rentValue,
      status,
      paidAt,
    });
  }

  return periods;
}

export const mockCondominiums: Condominium[] = [
  {
    id: 'cond-1',
    name: 'Residencial Alfa',
    address: 'Rua das Flores, 123',
    city: 'Fortaleza',
    state: 'CE',
    totalApartments: 12,
    createdAt: '2026-01-01',
  },
  {
    id: 'cond-2',
    name: 'Edifício Bela Vista',
    address: 'Av. Atlântica, 456',
    city: 'Fortaleza',
    state: 'CE',
    totalApartments: 8,
    createdAt: '2026-02-15',
  },
  {
    id: 'cond-3',
    name: 'Condomínio Solar',
    address: 'Rua da Paz, 789',
    city: 'Fortaleza',
    state: 'CE',
    totalApartments: 6,
    createdAt: '2026-03-10',
  },
];

const tenant1: Tenant = {
  id: 'tenant-1',
  apartmentId: 'apt-101',
  name: 'Carlos Eduardo Silva',
  cpf: '123.456.789-00',
  phone: '(85) 99999-1111',
  email: 'carlos.silva@email.com',
  additionalResidents: [
    { id: 'res-1', name: 'Maria Silva', cpf: '987.654.321-00', phone: '(85) 99999-2222', email: 'maria.silva@email.com' },
  ],
  documents: [
    { id: 'doc-1', tenantId: 'tenant-1', name: 'CNH Carlos Eduardo.pdf', type: 'pdf', uploadedAt: '2026-01-15', size: '2.3 MB' },
    { id: 'doc-2', tenantId: 'tenant-1', name: 'Contrato Assinado.pdf', type: 'pdf', uploadedAt: '2026-01-15', size: '1.1 MB' },
    { id: 'doc-3', tenantId: 'tenant-1', name: 'Comprovante de Renda.jpg', type: 'image', uploadedAt: '2026-01-14', size: '850 KB' },
  ],
  contract: {
    id: 'contract-1',
    apartmentId: 'apt-101',
    startDate: '2026-01-15',
    dueDay: 15,
    rentValue: 1500,
    depositPaid: true,
    depositValue: 1500,
    depositDate: '2026-01-10',
    status: 'active',
  },
  isCurrent: true,
  movedInAt: '2026-01-15',
};

const tenant2: Tenant = {
  id: 'tenant-2',
  apartmentId: 'apt-102',
  name: 'Ana Paula Rocha',
  cpf: '222.333.444-55',
  phone: '(85) 98888-3333',
  email: 'ana.rocha@email.com',
  additionalResidents: [],
  documents: [
    { id: 'doc-4', tenantId: 'tenant-2', name: 'RG Ana Paula.pdf', type: 'pdf', uploadedAt: '2026-02-01', size: '1.5 MB' },
  ],
  contract: {
    id: 'contract-2',
    apartmentId: 'apt-102',
    startDate: '2026-02-01',
    dueDay: 1,
    rentValue: 1800,
    depositPaid: true,
    depositValue: 3600,
    depositDate: '2026-01-28',
    status: 'active',
  },
  isCurrent: true,
  movedInAt: '2026-02-01',
};

const formerTenant1: Tenant = {
  id: 'former-tenant-1',
  apartmentId: 'apt-101',
  name: 'José Pereira Lima',
  cpf: '555.666.777-88',
  phone: '(85) 97777-4444',
  email: 'jose.lima@email.com',
  additionalResidents: [],
  documents: [
    { id: 'doc-old-1', tenantId: 'former-tenant-1', name: 'CNH José.pdf', type: 'pdf', uploadedAt: '2024-03-01', size: '900 KB' },
  ],
  contract: {
    id: 'contract-old-1',
    apartmentId: 'apt-101',
    startDate: '2024-03-01',
    dueDay: 1,
    rentValue: 1300,
    depositPaid: false,
    depositValue: 0,
    depositDate: '',
    status: 'closed',
    endDate: '2025-12-31',
  },
  isCurrent: false,
  movedInAt: '2024-03-01',
  movedOutAt: '2025-12-31',
};

const tenant3: Tenant = {
  id: 'tenant-3',
  apartmentId: 'apt-103',
  name: 'Bruno Costa Fernandes',
  cpf: '333.444.555-66',
  phone: '(85) 96666-5555',
  email: 'bruno.fernandes@email.com',
  additionalResidents: [
    { id: 'res-2', name: 'Fernanda Costa', cpf: '111.222.333-44', phone: '(85) 96666-6666', email: 'fernanda.costa@email.com' },
    { id: 'res-3', name: 'Pedro Costa', cpf: '777.888.999-00', phone: '(85) 96666-7777', email: 'pedro.costa@email.com' },
  ],
  documents: [
    { id: 'doc-5', tenantId: 'tenant-3', name: 'Contrato Bruno.pdf', type: 'pdf', uploadedAt: '2026-03-01', size: '1.8 MB' },
    { id: 'doc-6', tenantId: 'tenant-3', name: 'Comprovante Renda Bruno.pdf', type: 'pdf', uploadedAt: '2026-03-01', size: '620 KB' },
  ],
  contract: {
    id: 'contract-3',
    apartmentId: 'apt-103',
    startDate: '2026-03-01',
    dueDay: 5,
    rentValue: 2200,
    depositPaid: true,
    depositValue: 2200,
    depositDate: '2026-02-25',
    status: 'active',
  },
  isCurrent: true,
  movedInAt: '2026-03-01',
};

const tenant4: Tenant = {
  id: 'tenant-4',
  apartmentId: 'apt-201',
  name: 'Luciana Martins Souza',
  cpf: '444.555.666-77',
  phone: '(85) 95555-8888',
  email: 'luciana.souza@email.com',
  additionalResidents: [],
  documents: [],
  contract: {
    id: 'contract-4',
    apartmentId: 'apt-201',
    startDate: '2026-01-01',
    dueDay: 10,
    rentValue: 1200,
    depositPaid: true,
    depositValue: 1200,
    depositDate: '2025-12-20',
    status: 'active',
  },
  isCurrent: true,
  movedInAt: '2026-01-01',
};

function buildApartmentPayments(apt: { id: string }, tenants: Tenant[]): PaymentPeriod[] {
  const all: PaymentPeriod[] = [];
  for (const t of tenants) {
    if (t.contract) {
      const periods = generatePaymentPeriods(apt.id, t.id, t.contract, 2026);
      all.push(...periods);
    }
  }
  return all;
}

export const mockApartments: Apartment[] = [
  {
    id: 'apt-101',
    condominiumId: 'cond-1',
    number: '101',
    floor: 1,
    description: 'Apartamento 2 quartos, sala, cozinha, banheiro social',
    currentTenantId: 'tenant-1',
    tenants: [tenant1, formerTenant1],
    payments: buildApartmentPayments({ id: 'apt-101' }, [tenant1, formerTenant1]),
  },
  {
    id: 'apt-102',
    condominiumId: 'cond-1',
    number: '102',
    floor: 1,
    description: 'Apartamento 3 quartos, 2 banheiros, varanda',
    currentTenantId: 'tenant-2',
    tenants: [tenant2],
    payments: buildApartmentPayments({ id: 'apt-102' }, [tenant2]),
  },
  {
    id: 'apt-103',
    condominiumId: 'cond-1',
    number: '103',
    floor: 1,
    description: 'Apartamento 2 quartos',
    currentTenantId: 'tenant-3',
    tenants: [tenant3],
    payments: buildApartmentPayments({ id: 'apt-103' }, [tenant3]),
  },
  {
    id: 'apt-201',
    condominiumId: 'cond-1',
    number: '201',
    floor: 2,
    description: 'Apartamento 1 quarto, studio',
    currentTenantId: 'tenant-4',
    tenants: [tenant4],
    payments: buildApartmentPayments({ id: 'apt-201' }, [tenant4]),
  },
  {
    id: 'apt-202',
    condominiumId: 'cond-1',
    number: '202',
    floor: 2,
    description: 'Apartamento 2 quartos',
    tenants: [],
    payments: [],
  },
  {
    id: 'apt-203',
    condominiumId: 'cond-1',
    number: '203',
    floor: 2,
    description: 'Apartamento 3 quartos, suíte',
    tenants: [],
    payments: [],
  },
  {
    id: 'apt-bv-01',
    condominiumId: 'cond-2',
    number: '01',
    floor: 1,
    description: 'Sala comercial',
    tenants: [],
    payments: [],
  },
  {
    id: 'apt-bv-02',
    condominiumId: 'cond-2',
    number: '02',
    floor: 1,
    description: 'Apartamento 1 quarto',
    tenants: [],
    payments: [],
  },
  {
    id: 'apt-sol-01',
    condominiumId: 'cond-3',
    number: '01',
    floor: 1,
    description: 'Casa térrea 3 quartos',
    tenants: [],
    payments: [],
  },
];

export const mockUser = {
  id: 'user-1',
  name: 'Roberto Almeida',
  email: 'roberto@imoveis.com',
  phone: '(85) 99000-0001',
  cpf: '000.111.222-33',
  avatar: '',
};
