'use client'

import { useState } from 'react'
import { Play, Loader2, CheckCircle2 } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store'
import { setRunningTask, setTaskResult } from '@/store/slices/analyticsSlice'
import { apiFetch } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AnalysisTask } from '@/types'

const BRANCHES = [
  { value: 'all', label: 'All branches' },
  { value: 'BR-001', label: 'SM City Batangas' },
  { value: 'BR-002', label: 'SM City Lipa' },
  { value: 'BR-003', label: 'Robinsons Place Lipa' },
  { value: 'BR-004', label: 'Bay City Mall Balayan' },
  { value: 'BR-005', label: 'ICM Calapan' },
  { value: 'BR-006', label: 'Batangas Town Center' },
  { value: 'BR-007', label: 'Lipa De La Salle Area' },
]

const CATEGORIES = [
  { value: 'all', label: 'All categories' },
  { value: 'Canned Goods', label: 'Canned Goods' },
  { value: 'Beverages', label: 'Beverages' },
  { value: 'Snacks', label: 'Snacks' },
  { value: 'Dairy', label: 'Dairy' },
  { value: 'Personal Care', label: 'Personal Care' },
  { value: 'Household', label: 'Household' },
  { value: 'Condiments', label: 'Condiments' },
  { value: 'Frozen Foods', label: 'Frozen Foods' },
]

const ANALYSIS_TASKS: AnalysisTask[] = [
  {
    id: 'basket_analysis',
    name: 'Basket Analysis',
    description: 'Discover frequently co-purchased products using FP-Growth algorithm',
    last_run: null,
    last_summary: null,
    parameters: [
      {
        key: 'branch',
        label: 'Branch',
        type: 'select',
        options: BRANCHES,
      },
      {
        key: 'transaction_type',
        label: 'Transaction Type',
        type: 'select',
        options: [
          { value: 'all', label: 'All' },
          { value: 'retail', label: 'Retail' },
          { value: 'wholesale', label: 'Wholesale' },
        ],
      },
    ],
  },
  {
    id: 'customer_segmentation',
    name: 'Customer Segmentation',
    description: 'Segment customers by purchase behavior using RFM analysis and K-Means clustering',
    last_run: null,
    last_summary: null,
    parameters: [
      {
        key: 'customer_type',
        label: 'Customer Type',
        type: 'select',
        options: [
          { value: 'all', label: 'All' },
          { value: 'retail', label: 'Retail' },
          { value: 'wholesale', label: 'Wholesale' },
        ],
      },
    ],
  },
  {
    id: 'churn_risk',
    name: 'Churn Risk Refresh',
    description: 'Score all customers for churn probability using logistic regression',
    last_run: null,
    last_summary: null,
    parameters: [],
  },
  {
    id: 'credit_risk',
    name: 'Credit Risk Refresh',
    description: 'Update credit risk scores for all wholesale buyers',
    last_run: null,
    last_summary: null,
    parameters: [],
  },
  {
    id: 'demand_forecast',
    name: 'Demand Forecast',
    description: 'Forecast demand for the next 30 days using Prophet',
    last_run: null,
    last_summary: null,
    parameters: [
      {
        key: 'branch',
        label: 'Branch',
        type: 'select',
        options: BRANCHES,
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: CATEGORIES,
      },
    ],
  },
]

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AnalysisCard({ task }: { task: AnalysisTask }) {
  const dispatch = useAppDispatch()
  const { runningTask, lastResults } = useAppSelector((state) => state.analytics)
  const [params, setParams] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    for (const p of task.parameters) {
      if (p.options && p.options.length > 0) {
        defaults[p.key] = p.options[0].value
      }
    }
    return defaults
  })
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isRunning = runningTask === task.id
  const isAnyRunning = runningTask !== null
  const lastResult = lastResults[task.id]

  async function handleRun() {
    setSuccessMessage(null)
    dispatch(setRunningTask(task.id))

    try {
      const res = await apiFetch('/api/ml/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [task.id], params }),
      })

      if (!res.ok) {
        throw new Error('Request failed')
      }

      const data = await res.json()
      const summary =
        data?.body?.summary?.[task.id] ??
        data?.summary?.[task.id] ??
        'Analysis completed successfully'

      dispatch(setTaskResult({ task: task.id, summary }))
      setSuccessMessage(summary)

      // Clear success message after 10 seconds
      setTimeout(() => setSuccessMessage(null), 10000)
    } catch (err) {
      console.error(`Error running ${task.id}:`, err)
      dispatch(setTaskResult({ task: task.id, summary: 'Analysis failed — check logs' }))
    } finally {
      dispatch(setRunningTask(null))
    }
  }

  return (
    <Card className="bg-white shadow-sm flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{task.name}</CardTitle>
        <CardDescription>{task.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Last run info */}
        <div className="text-xs text-muted-foreground">
          {lastResult ? (
            <>
              <span className="font-medium">Last run:</span>{' '}
              {formatTimestamp(lastResult.timestamp)}
            </>
          ) : (
            <span>Never run</span>
          )}
        </div>

        {/* Last result summary */}
        {lastResult && !successMessage && (
          <div className="text-sm bg-muted/50 rounded-md p-3">
            {lastResult.summary}
          </div>
        )}

        {/* Success toast */}
        {successMessage && (
          <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Parameters */}
        {task.parameters.length > 0 && (
          <div className="space-y-3">
            {task.parameters.map((param) => (
              <div key={param.key}>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  {param.label}
                </label>
                <Select
                  value={params[param.key] ?? ''}
                  onValueChange={(val) =>
                    setParams((prev) => ({ ...prev, [param.key]: val }))
                  }
                  disabled={isAnyRunning}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {param.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {/* Run button */}
        <div className="mt-auto pt-2">
          {isRunning ? (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Running {task.name} — this may take 15-30 seconds...</span>
            </div>
          ) : (
            <Button
              onClick={handleRun}
              disabled={isAnyRunning}
              size="sm"
              className="w-full"
            >
              <Play className="h-4 w-4" />
              Run Analysis
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AnalyticsPanel() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Run ML analyses on demand or view last results
        </p>
      </div>

      {/* Grid of analysis cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {ANALYSIS_TASKS.map((task) => (
          <AnalysisCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}
