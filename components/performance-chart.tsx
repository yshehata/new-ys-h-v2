"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent } from "@/components/ui/card"
import type { PortfolioData } from "@/lib/data-processor"
import type { ApexOptions } from "apexcharts"

// Import ApexCharts dynamically to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

interface PerformanceChartProps {
  data: PortfolioData
  selectedAccount?: string
  timeRange: string
  onHover?: (dataPoint: any) => void
}

interface SeriesData {
  name: string;
  data: { x: number; y: number | null }[];
  type: string;
}

export default function PerformanceChart({ data, selectedAccount = "all", timeRange, onHover }: PerformanceChartProps) {
  const [chartData, setChartData] = useState<any[]>([])
  const [series, setSeries] = useState<SeriesData[]>([])
  const [chartOptions, setChartOptions] = useState<ApexOptions>({})

  useEffect(() => {
    if (!data || !data.timeSeriesData || !Array.isArray(data.timeSeriesData)) {
      return
    }

    const filteredData = data.timeSeriesData.filter((d) => {
      if (selectedAccount === "all") return true
      return d.accountValues && d.accountValues[selectedAccount] !== undefined
    })

    const sortedData = [...filteredData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const processedData = sortedData.map((d) => {
      const date = new Date(d.date).getTime()
      return {
        date,
        totalValue: d.totalValue,
        cashValue: d.cashValue,
        equityValue: d.equityValue,
        realizedReturn: d.realizedGain,
        unrealizedReturn: d.unrealizedGain,
        egx30: d.egx30
      }
    })

    const newSeries: SeriesData[] = [
      {
        name: "Total Value",
        data: processedData.map((d) => ({ x: d.date, y: d.totalValue })),
        type: "line"
      },
      {
        name: "Cash Value",
        data: processedData.map((d) => ({ x: d.date, y: d.cashValue })),
        type: "line"
      },
      {
        name: "Equity Value",
        data: processedData.map((d) => ({ x: d.date, y: d.equityValue })),
        type: "line"
      },
      {
        name: "Realized Return",
        data: processedData.map((d) => ({ x: d.date, y: d.realizedReturn })),
        type: "line"
      },
      {
        name: "Unrealized Return",
        data: processedData.map((d) => ({ x: d.date, y: d.unrealizedReturn })),
        type: "line"
      },
      {
        name: "EGX30",
        data: processedData.map((d) => ({ x: d.date, y: d.egx30 })),
        type: "line"
      }
    ]

    const options: ApexOptions = {
      chart: {
        type: 'line',
        height: 350,
        toolbar: {
          show: false
        },
        animations: {
          enabled: false
        }
      },
      tooltip: {
        enabled: true,
        shared: true,
        intersect: false,
        fixed: {
          enabled: true,
          position: 'topCenter',
          offsetY: 30
        },
        y: {
          formatter: (value: number) => {
            return value.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })
          }
        }
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'left',
        showForSingleSeries: true
      },
      colors: ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#ff0000", "#e91e63"],
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: "smooth",
        width: [3, 2, 2, 2, 2, 2],
        dashArray: [0, 0, 0, 0, 0, 0]
      },
      grid: {
        borderColor: "#e7e7e7",
        row: {
          colors: ["#f3f3f3", "transparent"],
          opacity: 0.5
        }
      },
      markers: {
        size: 0
      },
      xaxis: {
        type: "datetime",
        title: {
          text: "Date"
        },
        labels: {
          datetimeFormatter: {
            year: "yyyy",
            month: "MMM 'yy",
            day: "dd MMM",
            hour: "HH:mm"
          }
        }
      },
      yaxis: {
        labels: {
          formatter: (value: number) => {
            return value.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })
          }
        }
      }
    }

    setChartData(processedData)
    setSeries(newSeries)
    setChartOptions(options)
  }, [data, selectedAccount, timeRange])

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
          {typeof window !== "undefined" && (
            <ReactApexChart options={chartOptions} series={series} type="line" height={400} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
