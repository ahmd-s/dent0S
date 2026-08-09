/**
 * lib/rbac.js — backward-compatible facade over authorization-engine.js
 */

export {
  ROLES,
  canAccessRoute,
  hasPermission,
  canManageBilling,
  canEditInvoiceDate,
  canAccessClinical,
  canViewClinical,
  canEditClinical,
  canManageInventory,
  canManageStaff,
  canAccessSettings,
  canDeleteInventory,
  shouldFilterPatientClinicalFields,
  getPatientAllowedFields,
  filterPatientFields,
  canViewPatientClinicalData,
} from '@/lib/authorization-engine'
