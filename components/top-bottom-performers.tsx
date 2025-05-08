"use client"
import { useMemo } from "react"
import type { PortfolioData } from "@/lib/data-processor"

interface TopBottomPerformersProps {
  data: PortfolioData
  selectedAccount?: string
}

export default function TopBottomPerformers({ data, selectedAccount = "all" }: TopBottomPerformersProps) {
  // Helper functions
  function formatNumber(value: number, decimals = 0): string {
    return value?.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) ?? "-"
  }

  // Process data with useMemo hooks first, before any conditional returns
  const timeSeries = useMemo(() => {
    return (data?.timeSeriesData?.filter((item) => item.hasQuotes === true) || [])
  }, [data?.timeSeriesData])

  const latestData = useMemo(() => timeSeries.length > 0 ? timeSeries[timeSeries.length - 1] : null, [timeSeries])
  const firstData = useMemo(() => timeSeries.length > 0 ? timeSeries[0] : null, [timeSeries])

  const currentHoldings = useMemo(() => data?.currentHoldings || [], [data?.currentHoldings])
  const filteredCurrentHoldings = useMemo(() => {
    return selectedAccount === "all" ? currentHoldings : currentHoldings.filter((h) => h.Account === selectedAccount)
  }, [currentHoldings, selectedAccount])

  const transactions = useMemo(() => data?.transactions || [], [data?.transactions])
  const filteredTransactions = useMemo(() => {
    const filtered =
      selectedAccount === "all" ? transactions : transactions.filter((t) => t.Account === selectedAccount)

    return filtered?.reduce(
      (sum, t) => (["Deposit", "DEPOSIT"].includes(t.Symbol) ? sum + (Number(t["Cash Impact"]) || 0) : sum),
      0,
    ) || 0
  }, [transactions, selectedAccount])

  const closedPositions = useMemo(() => data?.closedPositions || [], [data?.closedPositions])
  const filteredClosedPositions = useMemo(() => {
    return selectedAccount === "all" ? closedPositions : closedPositions.filter((h) => h.Account === selectedAccount)
  }, [closedPositions, selectedAccount])

  const totalRealizedReturn = useMemo(() => {
    return (
      filteredClosedPositions.reduce((sum, pos) => sum + pos.RealizedGain, 0) +
      filteredCurrentHoldings.reduce((sum, pos) => sum + pos.RealizedGain, 0)
    )
  }, [filteredClosedPositions, filteredCurrentHoldings])

  const totalUnrealizedReturn = useMemo(() => {
    return filteredCurrentHoldings.reduce((sum, pos) => sum + pos.UnrealizedGain, 0)
  }, [filteredCurrentHoldings])

  const absoluteTotalReturn = useMemo(() => totalRealizedReturn + totalUnrealizedReturn, [totalRealizedReturn, totalUnrealizedReturn])

  // Calculate portfolio return using total return over total deposits
  const portfolioReturn = useMemo(() => {
    return filteredTransactions > 0 ? (absoluteTotalReturn / filteredTransactions) * 100 : 0
  }, [absoluteTotalReturn, filteredTransactions])

  // Calculate benchmark return
  const benchmarkReturn = useMemo(() => {
    return latestData && firstData && firstData.egx30 && firstData.egx30 > 0 && latestData.hasQuotes && firstData.hasQuotes
      ? ((latestData.egx30 - firstData.egx30) / firstData.egx30) * 100
      : 0
  }, [latestData, firstData])

  // Alpha (portfolio return minus benchmark return)
  const alpha = useMemo(() => portfolioReturn - benchmarkReturn, [portfolioReturn, benchmarkReturn])

  // Volatility (standard deviation of daily returns)
  const volatility = useMemo(() => {
    if (timeSeries.length < 2) return 0

    const returns = []
    for (let i = 1; i < timeSeries.length; i++) {
      const prevValue = timeSeries[i - 1].totalValue
      const currentValue = timeSeries[i].totalValue
      if (prevValue > 0) {
        returns.push((currentValue - prevValue) / prevValue)
      }
    }

    if (returns.length === 0) return 0

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length
    return Math.sqrt(variance) * Math.sqrt(252) * 100 // Annualized volatility
  }, [timeSeries])

  // Calculate return percentages using total deposits as denominator
  const { totalReturnPct, realizedReturnPct, unrealizedReturnPct } = useMemo(() => {
    return {
      totalReturnPct: filteredTransactions !== 0 ? (absoluteTotalReturn / filteredTransactions) * 100 : 0,
      realizedReturnPct: filteredTransactions !== 0 ? (totalRealizedReturn / filteredTransactions) * 100 : 0,
      unrealizedReturnPct: filteredTransactions !== 0 ? (totalUnrealizedReturn / filteredTransactions) * 100 : 0
    }
  }, [absoluteTotalReturn, totalRealizedReturn, totalUnrealizedReturn, filteredTransactions])

  // Calculate top and bottom performers based on total return percentage
  const performersData = useMemo(() => {
    try {
      return filteredCurrentHoldings
        .filter((h) => h && h.Cost !== 0 && Math.abs(h.Cost) > 0.01) // Filter out positions with zero or near-zero cost
        .map((h) => ({
          ...h,
          returnPct: ((h.UnrealizedGain + h.RealizedGain) / Math.abs(h.Cost)) * 100,
          totalReturn: h.UnrealizedGain + h.RealizedGain,
        }))
    } catch (error) {
      console.error("Error calculating performers data:", error)
      return []
    }
  }, [filteredCurrentHoldings])

  const topPerformers = useMemo(() => {
    return [...performersData].sort((a, b) => b.returnPct - a.returnPct).slice(0, 5)
  }, [performersData])

  const bottomPerformers = useMemo(() => {
    return [...performersData].sort((a, b) => a.returnPct - b.returnPct).slice(0, 5)
  }, [performersData])

  // Early returns for invalid data states
  if (!data) {
    return <div className="p-4 text-center">No portfolio data available</div>
  }

  if (!data.timeSeriesData || !Array.isArray(data.timeSeriesData) || data.timeSeriesData.length === 0) {
    return <div className="p-4 text-center">No performance data available</div>
  }

  if (!data.currentHoldings || !Array.isArray(data.currentHoldings)) {
    return <div className="p-4 text-center">No holdings data available</div>
  }

  // Rest of the component remains the same
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">Performance vs Benchmark</h2>
          <p className="text-sm text-muted-foreground mb-4">How your portfolio compares to the market</p>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Your Portfolio</span>
              </div>
              <span className={portfolioReturn >= 0 ? "text-green-600" : "text-red-600"}>
                {portfolioReturn >= 0 ? "+" : ""}
                {portfolioReturn.toFixed(2)}%
              </span>
            </div>
            {latestData && latestData.egx30 && firstData && firstData.egx30 && (
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span>EGX30 Index</span>
                </div>
                <span className={benchmarkReturn >= 0 ? "text-green-600" : "text-red-600"}>
                  {benchmarkReturn >= 0 ? "+" : ""}
                  {benchmarkReturn.toFixed(2)}%
                </span>
              </div>
            )}

            <div>
              <h3 className="text-lg font-medium mb-1">Alpha</h3>
              <p className={`text-2xl font-bold ${alpha >= 0 ? "text-green-600" : "text-red-600"}`}>
                {alpha >= 0 ? "+" : ""}
                {alpha.toFixed(2)}%
              </p>
              <p className="text-sm text-muted-foreground">outperformance</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">Key Performance Metrics</h2>
          <p className="text-sm text-muted-foreground mb-4">Risk and return indicators</p>
          <div className="mb-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="text-sm font-medium mb-2">Volatility</h3>
              <p className="text-2xl font-bold">{volatility.toFixed(2)}%</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="text-sm font-medium mb-2">Total Return</h3>
              <p className={`text-2xl font-bold ${absoluteTotalReturn >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatNumber(absoluteTotalReturn)}
              </p>
              <p className={`text-sm ${totalReturnPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalReturnPct.toFixed(2)}%
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="text-sm font-medium mb-2">Realized Return</h3>
              <p className={`text-2xl font-bold ${totalRealizedReturn >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatNumber(totalRealizedReturn)}
              </p>
              <p className={`text-sm ${realizedReturnPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {realizedReturnPct.toFixed(2)}%
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="text-sm font-medium mb-2">Unrealized Return</h3>
              <p className={`text-2xl font-bold ${totalUnrealizedReturn >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatNumber(totalUnrealizedReturn)}
              </p>
              <p className={`text-sm ${unrealizedReturnPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {unrealizedReturnPct.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">Top Performers</h2>
          <p className="text-sm text-muted-foreground mb-4">Your best performing positions</p>
          <div className="space-y-2">
            {topPerformers.length > 0 ? (
              topPerformers.map((holding, index) => (
                <div key={index} className="relative h-10 bg-gray-100 rounded-md">
                  <div
                    className="absolute left-0 top-0 h-full bg-green-500 rounded-md"
                    style={{ width: `${Math.min(Math.max(holding.returnPct, 0), 100)}%` }}
                  ></div>
                  <div className="absolute left-0 top-0 h-full w-full px-3 flex justify-between items-center">
                    <span className="font-medium">{holding.Symbol}</span>
                    <span className="font-medium">{holding.returnPct.toFixed(2)}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-4 text-muted-foreground">No positions found</div>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Bottom Performers</h2>
          <p className="text-sm text-muted-foreground mb-4">Your worst performing positions</p>
          <div className="space-y-2">
            {bottomPerformers.length > 0 ? (
              bottomPerformers.map((holding, index) => (
                <div key={index} className="relative h-10 bg-gray-100 rounded-md">
                  <div
                    className="absolute right-0 top-0 h-full bg-red-500 rounded-md"
                    style={{ width: `${Math.min(Math.max(Math.abs(holding.returnPct), 0), 100)}%` }}
                  ></div>
                  <div className="absolute left-0 top-0 h-full w-full px-3 flex justify-between items-center">
                    <span className="font-medium">{holding.Symbol}</span>
                    <span className="font-medium">{holding.returnPct.toFixed(2)}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-4 text-muted-foreground">No positions found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
