import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { WorklistItem, DocumentRecord, EscalationRecord } from '@/types'

interface CollectionsState {
  worklist: WorklistItem[]
  documents: DocumentRecord[]
  escalations: EscalationRecord[]
  loading: boolean
  error: string | null
}

const initialState: CollectionsState = {
  worklist: [],
  documents: [],
  escalations: [],
  loading: false,
  error: null,
}

export const fetchWorklist = createAsyncThunk(
  'collections/fetchWorklist',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/collections/worklist')
    if (!res.ok) return rejectWithValue('Failed to fetch worklist')
    return res.json() as Promise<WorklistItem[]>
  }
)

export const fetchDocuments = createAsyncThunk(
  'collections/fetchDocuments',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/documents')
    if (!res.ok) return rejectWithValue('Failed to fetch documents')
    return res.json() as Promise<DocumentRecord[]>
  }
)

export const fetchEscalations = createAsyncThunk(
  'collections/fetchEscalations',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/escalations')
    if (!res.ok) return rejectWithValue('Failed to fetch escalations')
    return res.json() as Promise<EscalationRecord[]>
  }
)

const collectionsSlice = createSlice({
  name: 'collections',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // fetchWorklist
    builder.addCase(fetchWorklist.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchWorklist.fulfilled, (state, action) => {
      state.loading = false
      state.worklist = action.payload
    })
    builder.addCase(fetchWorklist.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // fetchDocuments
    builder.addCase(fetchDocuments.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchDocuments.fulfilled, (state, action) => {
      state.loading = false
      state.documents = action.payload
    })
    builder.addCase(fetchDocuments.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // fetchEscalations
    builder.addCase(fetchEscalations.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchEscalations.fulfilled, (state, action) => {
      state.loading = false
      state.escalations = action.payload
    })
    builder.addCase(fetchEscalations.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })
  },
})

export default collectionsSlice.reducer
