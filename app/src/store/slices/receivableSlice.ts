import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { CustomerSummary, CustomerDetail, PaymentSummary } from '@/types'

interface ReceivableState {
  customers: CustomerSummary[]
  selectedCustomer: CustomerDetail | null
  payments: PaymentSummary[]
  loading: boolean
  error: string | null
}

const initialState: ReceivableState = {
  customers: [],
  selectedCustomer: null,
  payments: [],
  loading: false,
  error: null,
}

export const fetchCustomers = createAsyncThunk(
  'receivable/fetchCustomers',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/receivable')
    if (!res.ok) return rejectWithValue('Failed to fetch customers')
    return res.json() as Promise<CustomerSummary[]>
  }
)

export const fetchCustomerDetail = createAsyncThunk(
  'receivable/fetchCustomerDetail',
  async (id: number, { rejectWithValue }) => {
    const res = await fetch(`/api/receivable/${id}`)
    if (!res.ok) return rejectWithValue('Failed to fetch customer detail')
    return res.json() as Promise<CustomerDetail>
  }
)

export const fetchPayments = createAsyncThunk(
  'receivable/fetchPayments',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/receivable/payments')
    if (!res.ok) return rejectWithValue('Failed to fetch payments')
    return res.json() as Promise<PaymentSummary[]>
  }
)

const receivableSlice = createSlice({
  name: 'receivable',
  initialState,
  reducers: {
    clearSelectedCustomer(state) {
      state.selectedCustomer = null
    },
  },
  extraReducers: (builder) => {
    // fetchCustomers
    builder.addCase(fetchCustomers.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchCustomers.fulfilled, (state, action) => {
      state.loading = false
      state.customers = action.payload
    })
    builder.addCase(fetchCustomers.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // fetchCustomerDetail
    builder.addCase(fetchCustomerDetail.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchCustomerDetail.fulfilled, (state, action) => {
      state.loading = false
      state.selectedCustomer = action.payload
    })
    builder.addCase(fetchCustomerDetail.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // fetchPayments
    builder.addCase(fetchPayments.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchPayments.fulfilled, (state, action) => {
      state.loading = false
      state.payments = action.payload
    })
    builder.addCase(fetchPayments.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })
  },
})

export const { clearSelectedCustomer } = receivableSlice.actions
export default receivableSlice.reducer
