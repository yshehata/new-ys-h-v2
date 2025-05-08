"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PerformanceChart from "./performance-chart-v2"
import TopBottomPerformers from "./top-bottom-performers"
import type { PortfolioData, TimeSeriesDataPoint } from "@/lib/data-processor"

interface PerformanceProps {
  data: PortfolioData
  selectedAccount?: string
}

interface TimeRangeOption {
  value: string
  label: string
}

const timeRangeOptions: TimeRangeOption[] = [
  { value: "all", label: "All Time" },
  { value: "ytd", label: "Year to Date" },
  { value: "1y", label: "1 Year" },
  { value: "6m", label: "6 Months" },
  { value: "3m", label: "3 Months" },
  { value: "1m", label: "1 Month" },
]

export default function Performance({ data, selectedAccount = "all" }: PerformanceProps) {
  const [timeRange, setTimeRange] = useState("all")
  const [mainTab, setMainTab] = useState("performance")
  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesDataPoint | null>(null)

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Format numbers
  function formatNumber(value: number, decimals = 0): string {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }

  // Fixed tooltip content component
  const FixedTooltipContent = ({ data }: { data: TimeSeriesDataPoint | null }) => {
    if (!data) return null;
    return (
      <div className="grid grid-cols-7 gap-4 mt-4 bg-muted p-4 rounded-lg">
        <div>
          <h4 className="text-sm font-medium">Date</h4>
          <p className="text-base">{data.date ? formatDate(new Date(data.date).getTime()) : "-"}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-[#8884d8]">Total Value</h4>
          <p className="text-base">{data.totalValue ? formatNumber(data.totalValue) : "-"}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-[#82ca9d]">Cash Value</h4>
          <p className="text-base">{data.cashValue ? formatNumber(data.cashValue) : "-"}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-[#ffc658]">Equity Value</h4>
          <p className="text-base">{data.equityValue ? formatNumber(data.equityValue) : "-"}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-[#ff8042]">Realized Return</h4>
          <p className="text-base">{data.realizedGain ? formatNumber(data.realizedGain) : "-"}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-[#ff0000]">Unrealized Return</h4>
          <p className="text-base">{data.unrealizedGain ? formatNumber(data.unrealizedGain) : "-"}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-[#e91e63]">EGX30</h4>
          <p className="text-base">{data.egx30 ? formatNumber(data.egx30) : "-"}</p>
        </div>
      </div>
    );
  };

  return (
    <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
      <TabsList className="grid grid-cols-2">
        <TabsTrigger value="performance">Performance Chart</TabsTrigger>
        <TabsTrigger value="topbottom">Top/Bottom Performers</TabsTrigger>
      </TabsList>
      <TabsContent value="performance">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Portfolio Performance</CardTitle>
              <CardDescription>Tracking multiple metrics over time</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  {timeRangeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <PerformanceChart
                data={data}
                selectedAccount={selectedAccount}
                timeRange={timeRange}
                onHover={setHoveredPoint}
              />
            </div>
            <FixedTooltipContent data={hoveredPoint} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="topbottom">
        <TopBottomPerformers data={data} selectedAccount={selectedAccount} />
      </TabsContent>
    </Tabs>
  )
}
