"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import type { PortfolioData } from "@/lib/data-processor"

interface AllocationProps {
  data: PortfolioData
  selectedAccount?: string
}

export default function Allocation({ data, selectedAccount = "all" }: AllocationProps) {
  const [activeTab, setActiveTab] = useState("sector")

  // Process data for sector allocation
  const sectorData = useMemo(() => {
    if (!data || !data.currentHoldings) return []

    const filteredHoldings = data.currentHoldings.filter(
      (h) => (selectedAccount === "all" || h.Account === selectedAccount) && h.Account !== "AhlyBank",
    )

    const sectorMap = new Map<string, number>()
    let totalValue = 0

    filteredHoldings.forEach((holding) => {
      const sector = holding.Sector || "Unknown"
      const value = holding.Value || 0
      totalValue += value

      if (sectorMap.has(sector)) {
        sectorMap.set(sector, sectorMap.get(sector)! + value)
      } else {
        sectorMap.set(sector, value)
      }
    })

    // Convert to array and calculate percentages
    return Array.from(sectorMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [data, selectedAccount])

  // Process data for account allocation
  const accountData = useMemo(() => {
    if (!data || !data.accounts) return []

    const accountMap = new Map<string, number>()
    let totalValue = 0

    data.accounts.forEach((account) => {
      if (selectedAccount !== "all" && account.name !== selectedAccount) return

      const value = account.summaryMetrics.totalValue
      totalValue += value

      if (accountMap.has(account.name)) {
        accountMap.set(account.name, accountMap.get(account.name)! + value)
      } else {
        accountMap.set(account.name, value)
      }
    })

    // Convert to array and calculate percentages
    return Array.from(accountMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [data, selectedAccount])

  // Process data for asset type allocation (Stocks vs Fixed Income)
  const assetTypeData = useMemo(() => {
    if (!data || !data.currentHoldings) return []

    // Calculate stocks value (excluding AhlyBank)
    const stocksValue = data.currentHoldings
      .filter(
        (h) =>
          h.Account !== "AhlyBank" &&
          h["Status Tr"] !== "Open Deposits" &&
          h["Status Tr"] !== "Closed Deposits" &&
          (selectedAccount === "all" || h.Account === selectedAccount),
      )
      .reduce((sum, h) => sum + (h.Value || 0), 0)

    // Calculate fixed income value (including AhlyBank)
    const fixedIncomeValue = data.currentHoldings
      .filter(
        (h) =>
          (h["Status Tr"] === "Open Deposits" || h.Account === "AhlyBank") &&
          (selectedAccount === "all" || h.Account === selectedAccount),
      )
      .reduce((sum, h) => sum + (h.Value || 0), 0)

    // Add AhlyBank cash balance
    const ahlyBankCash =
      selectedAccount === "all" || selectedAccount === "AhlyBank"
        ? data.accounts?.find((acc) => acc.name === "AhlyBank")?.summaryMetrics?.cashBalance || 0
        : 0

    const totalFixedIncomeValue = fixedIncomeValue + ahlyBankCash
    const totalValue = stocksValue + totalFixedIncomeValue

    return [
      {
        name: "Stocks",
        value: stocksValue,
        percentage: totalValue > 0 ? (stocksValue / totalValue) * 100 : 0,
      },
      {
        name: "Fixed Income",
        value: totalFixedIncomeValue,
        percentage: totalValue > 0 ? (totalFixedIncomeValue / totalValue) * 100 : 0,
      },
    ].sort((a, b) => b.value - a.value)
  }, [data, selectedAccount])

  // Colors for the charts
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#A4DE6C",
    "#8884D8",
    "#82CA9D",
    "#FCCDE5",
    "#FB8072",
    "#BC80BD",
    "#BEBADA",
    "#80B1D3",
    "#FDB462",
    "#B3DE69",
    "#FCCDE5",
  ]

  // Custom tooltip for the charts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm">{`Value: ${formatCurrency(payload[0].value)}`}</p>
          <p className="text-sm">{`Percentage: ${payload[0].payload.percentage.toFixed(2)}%`}</p>
        </div>
      )
    }
    return null
  }

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Allocation</CardTitle>
          <CardDescription>
            Breakdown of your portfolio by{" "}
            {activeTab === "sector" ? "sector" : activeTab === "account" ? "account" : "asset type"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sector">By Sector</TabsTrigger>
              <TabsTrigger value="account">By Account</TabsTrigger>
              <TabsTrigger value="assetType">Stocks/Fixed Income</TabsTrigger>
            </TabsList>

            <TabsContent value="sector" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                      >
                        {sectorData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-4">Sector Breakdown</h3>
                  <div className="space-y-2">
                    {sectorData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>{formatCurrency(item.value)}</span>
                          <span className="text-muted-foreground">({item.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="account" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={accountData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                      >
                        {accountData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-4">Account Breakdown</h3>
                  <div className="space-y-2">
                    {accountData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>{formatCurrency(item.value)}</span>
                          <span className="text-muted-foreground">({item.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="assetType" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={assetTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                      >
                        <Cell fill="#0088FE" /> {/* Stocks */}
                        <Cell fill="#00C49F" /> {/* Fixed Income */}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-4">Asset Type Breakdown</h3>
                  <div className="space-y-2">
                    {assetTypeData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: index === 0 ? "#0088FE" : "#00C49F" }}
                          ></div>
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>{formatCurrency(item.value)}</span>
                          <span className="text-muted-foreground">({item.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
