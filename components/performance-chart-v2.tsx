"use client"

import { useState, useEffect } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import type { PortfolioData } from "@/lib/data-processor"

interface ChartDataPoint {
  date: number
  totalValue: number
  cashValue: number
  equityValue: number
  realizedReturn: number
  unrealizedReturn: number
  egx30?: number
  realizedGain: number
  unrealizedGain: number
  accountValues?: { [key: string]: number }
}

interface PerformanceChartProps {
  data: PortfolioData
  selectedAccount?: string
  timeRange: string
  onHover?: (dataPoint: ChartDataPoint | null) => void
}

export default function PerformanceChart({
  data,
  selectedAccount = "all",
  timeRange: _timeRange,
  onHover,
}: PerformanceChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Format value for display
  const formatValue = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Process chart data
  useEffect(() => {
    if (!data || !data.timeSeriesData || !Array.isArray(data.timeSeriesData)) {
      setChartData([])
      return
    }

    const filteredData = data.timeSeriesData.filter((d) => {
      if (selectedAccount === "all") return true
      return d.accountValues && d.accountValues[selectedAccount] !== undefined
    })

    const sortedData = [...filteredData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const processedData: ChartDataPoint[] = sortedData.map((d) => ({
      date: new Date(d.date).getTime(),
      totalValue: d.totalValue,
      cashValue: d.cashValue,
      equityValue: d.equityValue,
      realizedReturn: d.realizedGain,
      unrealizedReturn: d.unrealizedGain,
      egx30: d.egx30,
      realizedGain: d.realizedGain,
      unrealizedGain: d.unrealizedGain,
      accountValues: d.accountValues,
    }))

    setChartData(processedData)
  }, [data, selectedAccount])

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    useEffect(() => {
      if (active && payload && payload.length && typeof label === "number") {
        const dataPoint = payload[0].payload as ChartDataPoint
        onHover?.(dataPoint)
      } else {
        onHover?.(null)
      }
    }, [active, payload, label, onHover])

    if (active && payload && payload.length && typeof label === "number") {
      const dataPoint = payload[0].payload as ChartDataPoint

      return (
        <div className="bg-background border rounded-md p-3 shadow-md">
          <p className="font-medium">{formatDate(label)}</p>
          <div className="space-y-1 mt-2">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm">
                  {entry.name}: {typeof entry.value === "number" ? formatValue(entry.value) : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  if (!chartData.length) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center h-[400px]">
          <p className="text-muted-foreground">
            No performance data available for the selected account and time range.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDate} type="number" domain={["auto", "auto"]} />
              <YAxis tickFormatter={formatValue} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="totalValue"
                stroke="#8884d8"
                name="Total Value"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 8 }}
              />
              <Line
                type="monotone"
                dataKey="cashValue"
                stroke="#82ca9d"
                name="Cash Value"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="equityValue"
                stroke="#ffc658"
                name="Equity Value"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="realizedReturn"
                stroke="#ff8042"
                name="Realized Return"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="unrealizedReturn"
                stroke="#ff0000"
                name="Unrealized Return"
                strokeWidth={2}
                dot={false}
              />
              {chartData[0]?.egx30 !== undefined && (
                <Line type="monotone" dataKey="egx30" stroke="#e91e63" name="EGX30" strokeWidth={2} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
