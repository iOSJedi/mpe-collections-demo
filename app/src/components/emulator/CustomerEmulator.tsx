'use client'

import { useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store'
import {
  closeEmulator,
  setSelectedCustomer,
  setActiveTab,
} from '@/store/slices/emulatorSlice'
import type { CustomerSummary } from '@/types'
import { apiFetch } from '@/lib/api'
import { EmulatorInvoices } from './EmulatorInvoices'
import { EmulatorQR } from './EmulatorQR'
import { EmulatorUpload } from './EmulatorUpload'
import { EmulatorHistory } from './EmulatorHistory'
import { EmulatorModeSwitcher } from './EmulatorModeSwitcher'
import { SupplierEmulator } from './SupplierEmulator'

const TABS = [
  { id: 'invoices', label: 'Invoices' },
  { id: 'qr', label: 'QR' },
  { id: 'upload', label: 'Upload' },
  { id: 'history', label: 'History' },
] as const

type TabId = typeof TABS[number]['id']

function typeBadgeClass(type: string): string {
  return type === 'TENANT'
    ? 'bg-blue-100 text-blue-700 border border-blue-200'
    : 'bg-purple-100 text-purple-700 border border-purple-200'
}

export function CustomerEmulator() {
  const dispatch = useAppDispatch()
  const { isOpen, mode, selectedCustomerId, activeTab, selectedInvoiceId } = useAppSelector(
    (s) => s.emulator
  )

  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [search, setSearch] = useState('')
  const [customersLoading, setCustomersLoading] = useState(false)

  // Fetch customers once on mount
  const fetchCustomers = useCallback(() => {
    setCustomersLoading(true)
    apiFetch('/api/receivable?limit=200')
      .then((res) => res.json())
      .then((data) => {
        setCustomers(Array.isArray(data) ? data : [])
        setCustomersLoading(false)
      })
      .catch(() => setCustomersLoading(false))
  }, [])

  useEffect(() => {
    if (isOpen && customers.length === 0) {
      fetchCustomers()
    }
  }, [isOpen, customers.length, fetchCustomers])

  const selectedCustomer = customers.find((c) => c.customer_id === selectedCustomerId) ?? null

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.account_number.toLowerCase().includes(search.toLowerCase())
  )

  const handleTabChange = (tab: TabId) => {
    dispatch(setActiveTab(tab))
  }

  return (
    <>
      {/* Backdrop (subtle) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Popover panel */}
      <div
        className={`
          fixed bottom-10 right-4 z-50
          w-[375px] h-[740px]
          bg-white rounded-xl border border-border shadow-2xl
          flex flex-col overflow-hidden
          transition-all duration-300 ease-out
          ${isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-8 pointer-events-none'
          }
        `}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0"
          style={{ backgroundColor: '#C5A930' }}
        >
          <span className="text-sm font-semibold text-white tracking-wide">
            {mode === 'supplier' ? 'Supplier Emulator' : 'Customer Emulator'}
          </span>
          <button
            onClick={() => dispatch(closeEmulator())}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Close emulator"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <EmulatorModeSwitcher />

        {mode === 'supplier' ? (
          /* Supplier mode */
          <SupplierEmulator />
        ) : (
          /* Payer mode */
          <>
            {/* Customer Selector */}
            <div className="px-3 py-2.5 border-b border-border shrink-0 space-y-2">
              <input
                type="text"
                placeholder="Search customer name or account…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#C5A930]"
              />
              <select
                value={selectedCustomerId ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  dispatch(setSelectedCustomer(val ? Number(val) : null))
                  setSearch('')
                }}
                className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#C5A930]"
              >
                <option value="">
                  {customersLoading ? 'Loading customers…' : '— Select a customer —'}
                </option>
                {filteredCustomers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.name} ({c.account_number})
                  </option>
                ))}
              </select>

              {/* Customer info strip */}
              {selectedCustomer && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeBadgeClass(selectedCustomer.type)}`}
                  >
                    {selectedCustomer.type === 'TENANT' ? 'Tenant' : 'Property Manager'}
                  </span>
                  {selectedCustomer.property_name && (
                    <span className="text-muted-foreground truncate max-w-[140px]">
                      {selectedCustomer.property_name}
                    </span>
                  )}
                  <span className="text-muted-foreground font-mono">
                    {selectedCustomer.account_number}
                  </span>
                </div>
              )}
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-border shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex-1 py-2 text-xs font-medium transition-colors
                    ${activeTab === tab.id
                      ? 'border-b-2 text-[#C5A930]'
                      : 'text-muted-foreground hover:text-foreground'
                    }
                  `}
                  style={activeTab === tab.id ? { borderBottomColor: '#C5A930' } : {}}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {!selectedCustomerId ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground text-center px-4">
                  Select a customer above to begin emulating their portal experience.
                </div>
              ) : (
                <>
                  {activeTab === 'invoices' && (
                    <EmulatorInvoices customerId={selectedCustomerId} />
                  )}
                  {activeTab === 'qr' && (
                    <EmulatorQR invoiceId={selectedInvoiceId} />
                  )}
                  {activeTab === 'upload' && (
                    <EmulatorUpload
                      customerId={selectedCustomerId}
                      invoiceId={selectedInvoiceId}
                    />
                  )}
                  {activeTab === 'history' && (
                    <EmulatorHistory customerId={selectedCustomerId} />
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
