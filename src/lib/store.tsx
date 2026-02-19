import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Apartment, Condominium, Document, PaymentPeriod, Tenant, Contract, User } from './types';
import { mockApartments, mockCondominiums, mockUser, generatePaymentPeriods } from './mock-data';

interface AppState {
  user: User;
  condominiums: Condominium[];
  apartments: Apartment[];
  selectedYear: number;
  selectedMonth: number | null;
  isAuthenticated: boolean;
}

type Action =
  | { type: 'LOGIN' }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'SET_YEAR'; payload: number }
  | { type: 'SET_MONTH'; payload: number | null }
  | { type: 'ADD_CONDOMINIUM'; payload: Condominium }
  | { type: 'UPDATE_CONDOMINIUM'; payload: Condominium }
  | { type: 'DELETE_CONDOMINIUM'; payload: string }
  | { type: 'ADD_APARTMENT'; payload: Apartment }
  | { type: 'UPDATE_APARTMENT'; payload: Apartment }
  | { type: 'DELETE_APARTMENT'; payload: string }
  | { type: 'UPDATE_TENANT'; payload: { apartmentId: string; tenant: Tenant } }
  | { type: 'ADD_TENANT'; payload: { apartmentId: string; tenant: Tenant } }
  | { type: 'DELETE_TENANT'; payload: { apartmentId: string; tenantId: string } }
  | { type: 'CLOSE_CONTRACT'; payload: { apartmentId: string; tenantId: string; endDate: string } }
  | { type: 'ADD_DOCUMENT'; payload: { apartmentId: string; tenantId: string; document: Document } }
  | { type: 'DELETE_DOCUMENT'; payload: { apartmentId: string; tenantId: string; documentId: string } }
  | { type: 'UPDATE_CONTRACT'; payload: { apartmentId: string; contract: Contract } }
  | { type: 'UPDATE_PAYMENT'; payload: { apartmentId: string; payment: PaymentPeriod } }
  | { type: 'ADD_PAYMENT_PERIOD'; payload: { apartmentId: string; tenantId: string } };

const initialState: AppState = {
  user: mockUser,
  condominiums: mockCondominiums,
  apartments: mockApartments,
  selectedYear: 2026,
  selectedMonth: null,
  isAuthenticated: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, isAuthenticated: true };
    case 'LOGOUT':
      return { ...state, isAuthenticated: false };
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.payload } };
    case 'SET_YEAR':
      return { ...state, selectedYear: action.payload };
    case 'SET_MONTH':
      return { ...state, selectedMonth: action.payload };

    case 'ADD_CONDOMINIUM':
      return { ...state, condominiums: [...state.condominiums, action.payload] };
    case 'UPDATE_CONDOMINIUM':
      return {
        ...state,
        condominiums: state.condominiums.map(c => c.id === action.payload.id ? action.payload : c),
      };
    case 'DELETE_CONDOMINIUM':
      return {
        ...state,
        condominiums: state.condominiums.filter(c => c.id !== action.payload),
        apartments: state.apartments.filter(a => a.condominiumId !== action.payload),
      };

    case 'ADD_APARTMENT':
      return { ...state, apartments: [...state.apartments, action.payload] };
    case 'UPDATE_APARTMENT':
      return {
        ...state,
        apartments: state.apartments.map(a => a.id === action.payload.id ? action.payload : a),
      };
    case 'DELETE_APARTMENT':
      return { ...state, apartments: state.apartments.filter(a => a.id !== action.payload) };

    case 'UPDATE_TENANT':
      return {
        ...state,
        apartments: state.apartments.map(a => {
          if (a.id !== action.payload.apartmentId) return a;
          return {
            ...a,
            tenants: a.tenants.map(t => t.id === action.payload.tenant.id ? action.payload.tenant : t),
          };
        }),
      };

    case 'ADD_TENANT': {
      const tenant = action.payload.tenant;
      const newPayments = tenant.contract
        ? generatePaymentPeriods(action.payload.apartmentId, tenant.id, tenant.contract, 2026)
        : [];
      return {
        ...state,
        apartments: state.apartments.map(a => {
          if (a.id !== action.payload.apartmentId) return a;
          return {
            ...a,
            currentTenantId: tenant.id,
            tenants: [...a.tenants, tenant],
            payments: [...a.payments, ...newPayments],
          };
        }),
      };
    }

    case 'DELETE_TENANT':
      return {
        ...state,
        apartments: state.apartments.map(a => {
          if (a.id !== action.payload.apartmentId) return a;
          const isCurrentTenant = a.currentTenantId === action.payload.tenantId;
          return {
            ...a,
            currentTenantId: isCurrentTenant ? undefined : a.currentTenantId,
            tenants: a.tenants.filter(t => t.id !== action.payload.tenantId),
            payments: a.payments.filter(p => p.tenantId !== action.payload.tenantId),
          };
        }),
      };

    case 'CLOSE_CONTRACT':
      return {
        ...state,
        apartments: state.apartments.map(a => {
          if (a.id !== action.payload.apartmentId) return a;
          return {
            ...a,
            currentTenantId: undefined,
            tenants: a.tenants.map(t => {
              if (t.id !== action.payload.tenantId) return t;
              return {
                ...t,
                isCurrent: false,
                movedOutAt: action.payload.endDate,
                contract: t.contract ? { ...t.contract, status: 'closed', endDate: action.payload.endDate } : t.contract,
              };
            }),
          };
        }),
      };

    case 'ADD_DOCUMENT':
      return {
        ...state,
        apartments: state.apartments.map(a => {
          if (a.id !== action.payload.apartmentId) return a;
          return {
            ...a,
            tenants: a.tenants.map(t => {
              if (t.id !== action.payload.tenantId) return t;
              return { ...t, documents: [...t.documents, action.payload.document] };
            }),
          };
        }),
      };

    case 'DELETE_DOCUMENT':
      return {
        ...state,
        apartments: state.apartments.map(a => {
          if (a.id !== action.payload.apartmentId) return a;
          return {
            ...a,
            tenants: a.tenants.map(t => {
              if (t.id !== action.payload.tenantId) return t;
              return { ...t, documents: t.documents.filter(d => d.id !== action.payload.documentId) };
            }),
          };
        }),
      };

    case 'UPDATE_CONTRACT': {
      const contract = action.payload.contract;
      return {
        ...state,
        apartments: state.apartments.map(a => {
          if (a.id !== action.payload.apartmentId) return a;
          const updatedTenants = a.tenants.map(t => {
            if (t.contract?.id !== contract.id) return t;
            return { ...t, contract };
          });
          const newPayments = generatePaymentPeriods(a.id, contract.id, contract, 2026);
          const otherPayments = a.payments.filter(p => {
            const tenant = updatedTenants.find(t => t.id === p.tenantId);
            return !tenant || tenant.contract?.id !== contract.id;
          });
          return { ...a, tenants: updatedTenants, payments: [...otherPayments, ...newPayments] };
        }),
      };
    }

    case 'UPDATE_PAYMENT':
      return {
        ...state,
        apartments: state.apartments.map(a => {
          if (a.id !== action.payload.apartmentId) return a;
          return {
            ...a,
            payments: a.payments.map(p => p.id === action.payload.payment.id ? action.payload.payment : p),
          };
        }),
      };

    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
