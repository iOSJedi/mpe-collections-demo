import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { SupplierSummary, SupplierDetail, ThreeWayMatchRow } from '@/types'
import { apiFetch } from '@/lib/api'

interface PayableState {
  suppliers: SupplierSummary[]
  selectedSupplier: SupplierDetail | null
  matches: ThreeWayMatchRow[]
  loading: boolean
  error: string | null
}

const initialState: PayableState = {
  suppliers: [],
  selectedSupplier: null,
  matches: [],
  loading: false,
  error: null,
}

export const fetchSuppliers = createAsyncThunk(
  'payable/fetchSuppliers',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/payable')
    if (!res.ok) return rejectWithValue('Failed to fetch suppliers')
    return res.json() as Promise<SupplierSummary[]>
  }
)

export const fetchSupplierDetail = createAsyncThunk(
  'payable/fetchSupplierDetail',
  async (id: number, { rejectWithValue }) => {
    const res = await apiFetch(`/api/payable/${id}`)
    if (!res.ok) return rejectWithValue('Failed to fetch supplier detail')
    return res.json() as Promise<SupplierDetail>
  }
)

export const fetchMatches = createAsyncThunk(
  'payable/fetchMatches',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/payable/matching')
    if (!res.ok) return rejectWithValue('Failed to fetch three-way matches')
    return res.json() as Promise<ThreeWayMatchRow[]>
  }
)

const payableSlice = createSlice({
  name: 'payable',
  initialState,
  reducers: {
    clearSelectedSupplier(state) {
      state.selectedSupplier = null
    },
  },
  extraReducers: (builder) => {
    // fetchSuppliers
    builder.addCase(fetchSuppliers.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchSuppliers.fulfilled, (state, action) => {
      state.loading = false
      state.suppliers = action.payload
    })
    builder.addCase(fetchSuppliers.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // fetchSupplierDetail
    builder.addCase(fetchSupplierDetail.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchSupplierDetail.fulfilled, (state, action) => {
      state.loading = false
      state.selectedSupplier = action.payload
    })
    builder.addCase(fetchSupplierDetail.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // fetchMatches
    builder.addCase(fetchMatches.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchMatches.fulfilled, (state, action) => {
      state.loading = false
      state.matches = action.payload
    })
    builder.addCase(fetchMatches.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })
  },
})

export const { clearSelectedSupplier } = payableSlice.actions
export default payableSlice.reducer
