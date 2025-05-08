"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PortfolioData, Transaction } from "@/lib/data-processor"
import { useMetrics } from "../hooks/useMetrics"

interface SummaryProps {
  data: PortfolioData
  selectedAccount?: string
}

interface ProcessedHolding {
  Symbol: string
  Account: string
  Value: number
  Cost: number
  TotalCost: number
  UnrealizedGain: number
  RealizedGain: number
}

export default function Summary({ data, selectedAccount = "all" }: SummaryProps) {
  const metricsCalculator = useMetrics()
  const { positions: positionsMetrics, deposits: depositsMetrics } = metricsCalculator(data, selectedAccount)

  // Format numbers with zero decimals
  const formatNumber = (value: number) => {
    return Math.round(value).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }

  // Calculate metrics for the summary view
  const portfolioMetrics = useMemo(() => {
    // Calculate realized gain for deposits
    const realizedGain = Math.round(
      (data.transactions
        ?.filter(
          (t) => t["Status Tr"] === "Open Deposits" && (selectedAccount === "all" || t.Account === selectedAccount),
        )
        .reduce((sum, t) => sum + (t.Realized3 || 0), 0) || 0) +
        (data.closedPositions
          ?.filter(
            (p) => p["Status Tr"] === "Closed Deposits" && (selectedAccount === "all" || p.Account === selectedAccount),
          )
          .reduce((sum, p) => sum + (p.RealizedGain || 0), 0) || 0) +
        (data.closedPositions
          ?.filter((p) => p["Status Tr"] === "Closed Deposits" && p.Account === "AhlyBank")
          .reduce((sum, p) => sum + (p.RealizedGain || 0), 0) || 0),
    )

    // Calculate returns
    const positionsReturn = positionsMetrics.unrealizedGain + positionsMetrics.realizedGain
    const depositsReturn = depositsMetrics.unrealizedGain + realizedGain

    return {
      totalValue: positionsMetrics.totalValue + depositsMetrics.totalValue,
      cashBalance: positionsMetrics.cashBalance + depositsMetrics.cashBalance,
      totalCost: positionsMetrics.totalCost + depositsMetrics.totalCost,
      unrealizedGain: positionsMetrics.unrealizedGain + depositsMetrics.unrealizedGain,
      realizedGain: positionsMetrics.realizedGain + realizedGain,
      totalReturn: positionsReturn + depositsReturn,
      depositsRealizedGain: realizedGain,
      depositsReturn: depositsReturn,
    }
  }, [data, selectedAccount, positionsMetrics, depositsMetrics])

  // Process open deposits transactions into holdings
  const processOpenDeposits = (transactions: Transaction[]): ProcessedHolding[] => {
    const holdings: ProcessedHolding[] = []
    const symbolAccountGroups = new Map<string, Transaction[]>()

    // Group transactions by symbol AND account
    transactions.forEach((transaction: Transaction) => {
      const symbol = transaction.Symbol
      const account = transaction.Account || "Unknown"
      const key = `${symbol}|${account}`

      if (!symbolAccountGroups.has(key)) {
        symbolAccountGroups.set(key, [])
      }
      symbolAccountGroups.get(key)?.push(transaction)
    })

    // Process each symbol-account group
    symbolAccountGroups.forEach((transactions: Transaction[], key: string) => {
      const [symbol, account] = key.split("|")

      let quantity = 0
      let totalDebit = 0
      let costChangeSum = 0
      let cumulativeRealizedReturn = 0

      transactions.forEach((transaction: Transaction) => {
        quantity += Number(transaction["Qty Change"]) || 0
        totalDebit += Number(transaction.Db) || 0
        costChangeSum += Number(transaction["Cost change"]) || 0
        cumulativeRealizedReturn += Number(transaction.Realized3) || 0
      })

      const openCost = costChangeSum + cumulativeRealizedReturn
      const exactSymbol = transactions[0].Symbol

      // Get price from quotes
      let price = 0
      if (data.latestQuotes && data.latestQuotes.has(exactSymbol)) {
        const quote = data.latestQuotes.get(exactSymbol)
        price = quote ? Number(quote.Close) : 0
      } else if (data.quotes && Array.isArray(data.quotes)) {
        const matchingQuotes = data.quotes.filter(
          (q) => q && q.Symbol === exactSymbol && q.Close && Number(q.Close) > 0,
        )

        if (matchingQuotes.length > 0) {
          const latestQuote = matchingQuotes.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())[0]
          price = Number(latestQuote.Close)
        } else {
          price = Number(transactions[0]["Net Price"]) || 1.0
        }
      } else {
        price = Number(transactions[0]["Net Price"]) || 1.0
      }

      const value = quantity * price
      const unrealizedGain = value - openCost

      if (Math.abs(quantity) > 0.0001) {
        holdings.push({
          Symbol: exactSymbol,
          Account: account,
          Value: value,
          Cost: openCost,
          TotalCost: costChangeSum,
          UnrealizedGain: unrealizedGain,
          RealizedGain: cumulativeRealizedReturn,
        })
      }
    })

    return holdings
  }

  // Helper function for percentage calculations
  const calculatePercentage = (value: number, total: number) => {
    if (!total) return 0
    return ((value / total) * 100).toFixed(1)
  }

  // Helper function for gain percentage calculations
  const calculateGainPercentage = (gain: number, cost: number) => {
    if (!cost) return 0
    return ((gain / cost) * 100).toFixed(1)
  }

  // Add the exact calculation from measure 4.6
  const unrealizedGainZr4_6 = (() => {
    if (!data || !data.transactions) return 0

    // Filter transactions for "Open Deposits" status and selected account
    const openDepositsTransactions = data.transactions.filter(
      (t) => t["Status Tr"] === "Open Deposits" && (selectedAccount === "all" || t.Account === selectedAccount),
    )

    // Group transactions by symbol AND account
    const symbolAccountGroups = new Map<string, any[]>()
    openDepositsTransactions.forEach((transaction) => {
      const symbol = transaction.Symbol
      const account = transaction.Account || "Unknown"
      const key = `${symbol}|${account}`
      if (!symbolAccountGroups.has(key)) {
        symbolAccountGroups.set(key, [])
      }
      symbolAccountGroups.get(key)!.push(transaction)
    })

    let totalUnrealizedGain = 0

    // Process each symbol-account group
    symbolAccountGroups.forEach((transactions, key) => {
      // Calculate totals
      let quantity = 0
      let costChangeSum = 0
      let cumulativeRealizedReturn = 0

      transactions.forEach((transaction) => {
        quantity += Number(transaction["Qty Change"]) || 0
        costChangeSum += Number(transaction["Cost change"]) || 0
        cumulativeRealizedReturn += Number(transaction.Realized3) || 0
      })

      // Calculate OpenCost exactly as in Open Deposits
      const openCost = costChangeSum + cumulativeRealizedReturn

      // Get price using same logic as Open Deposits
      let price = 0
      const exactSymbol = transactions[0].Symbol

      if (data.latestQuotes && data.latestQuotes.has(exactSymbol)) {
        price = Number.parseFloat(String(data.latestQuotes.get(exactSymbol)!.Close))
      } else if (data.quotes && Array.isArray(data.quotes)) {
        const matchingQuotes = data.quotes.filter(
          (q) => q && q.Symbol === exactSymbol && q.Close && Number.parseFloat(String(q.Close)) > 0,
        )

        if (matchingQuotes.length > 0) {
          const latestQuote = matchingQuotes.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())[0]
          price = Number.parseFloat(String(latestQuote.Close))
        } else {
          const baseSymbol = exactSymbol.split("@")[0]
          const similarQuotes = data.quotes.filter(
            (q) =>
              q && q.Symbol && q.Symbol.startsWith(baseSymbol) && q.Close && Number.parseFloat(String(q.Close)) > 0,
          )

          if (similarQuotes.length > 0) {
            const latestSimilarQuote = similarQuotes.sort(
              (a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime(),
            )[0]
            price = Number.parseFloat(String(latestSimilarQuote.Close))
          } else {
            price = Number.parseFloat(String(transactions[0]["Net Price"])) || 1.0
          }
        }
      } else {
        price = Number.parseFloat(String(transactions[0]["Net Price"])) || 1.0
      }

      const value = quantity * price
      const unrealizedGain = value - openCost

      if (Math.abs(quantity) > 0.0001) {
        totalUnrealizedGain += unrealizedGain
      }
    })

    return totalUnrealizedGain
  })()

  // Add the exact calculation from measure 1.5
  const totalValueDepositsZr1_5 = (() => {
    if (!data || !data.transactions) return 0

    // Process open deposits transactions into holdings
    const openDepositsTransactions = data.transactions.filter(
      (t) => t["Status Tr"] === "Open Deposits" && (selectedAccount === "all" || t.Account === selectedAccount),
    )

    const symbolAccountGroups = new Map<string, any[]>()

    // Group transactions by symbol AND account
    openDepositsTransactions.forEach((transaction) => {
      const symbol = transaction.Symbol
      const account = transaction.Account || "Unknown"
      const key = `${symbol}|${account}`

      if (!symbolAccountGroups.has(key)) {
        symbolAccountGroups.set(key, [])
      }
      symbolAccountGroups.get(key)!.push(transaction)
    })

    let holdingsValue = 0

    // Process each symbol-account group
    symbolAccountGroups.forEach((transactions, key) => {
      let quantity = 0
      let totalDebit = 0
      let costChangeSum = 0
      let cumulativeRealizedReturn = 0

      transactions.forEach((transaction) => {
        quantity += Number(transaction["Qty Change"]) || 0
        totalDebit += Number(transaction.Db) || 0
        costChangeSum += Number(transaction["Cost change"]) || 0
        cumulativeRealizedReturn += Number(transaction.Realized3) || 0
      })

      const exactSymbol = transactions[0].Symbol

      // Get price using same logic as Open Deposits
      let price = 0
      if (data.latestQuotes && data.latestQuotes.has(exactSymbol)) {
        price = Number.parseFloat(String(data.latestQuotes.get(exactSymbol)!.Close))
      } else if (data.quotes && Array.isArray(data.quotes)) {
        const matchingQuotes = data.quotes.filter(
          (q) => q && q.Symbol === exactSymbol && q.Close && Number.parseFloat(String(q.Close)) > 0,
        )

        if (matchingQuotes.length > 0) {
          const latestQuote = matchingQuotes.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())[0]
          price = Number.parseFloat(String(latestQuote.Close))
        } else {
          const baseSymbol = exactSymbol.split("@")[0]
          const similarQuotes = data.quotes.filter(
            (q) =>
              q && q.Symbol && q.Symbol.startsWith(baseSymbol) && q.Close && Number.parseFloat(String(q.Close)) > 0,
          )

          if (similarQuotes.length > 0) {
            const latestSimilarQuote = similarQuotes.sort(
              (a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime(),
            )[0]
            price = Number.parseFloat(String(latestSimilarQuote.Close))
          } else {
            price = Number.parseFloat(String(transactions[0]["Net Price"])) || 1.0
          }
        }
      } else {
        price = Number.parseFloat(String(transactions[0]["Net Price"])) || 1.0
      }

      const value = quantity * price

      if (Math.abs(quantity) > 0.0001) {
        holdingsValue += value
      }
    })

    // Calculate cash balance for AhlyBank
    const ahlyBankCash =
      selectedAccount === "all" || selectedAccount === "AhlyBank"
        ? data.accounts?.find((acc) => acc.name === "AhlyBank")?.summaryMetrics?.cashBalance || 0
        : 0

    // Return total portfolio value (holdings + cash)
    return holdingsValue + ahlyBankCash
  })()

  return (
    <div className="space-y-6">
      {/* Positions Metrics (Open + Closed) - First Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value (Positions)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(positionsMetrics.totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Holdings + Cash ({calculatePercentage(positionsMetrics.totalValue, portfolioMetrics.totalValue)}%)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance (Positions)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(positionsMetrics.cashBalance)}</div>
            <p className="text-xs text-muted-foreground">
              Regular Accounts ({calculatePercentage(positionsMetrics.cashBalance, portfolioMetrics.totalValue)}%)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unrealized G/L (Positions)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${positionsMetrics.unrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatNumber(positionsMetrics.unrealizedGain)}
            </div>
            <p className="text-xs text-muted-foreground">
              {calculateGainPercentage(positionsMetrics.unrealizedGain, positionsMetrics.totalCost)}% of Cost
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Realized G/L (Positions)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${positionsMetrics.realizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatNumber(positionsMetrics.realizedGain)}
            </div>
            <p className="text-xs text-muted-foreground">
              {calculateGainPercentage(positionsMetrics.realizedGain, positionsMetrics.totalCost)}% of Cost
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return (Positions)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${(positionsMetrics.unrealizedGain + positionsMetrics.realizedGain) >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatNumber(positionsMetrics.unrealizedGain + positionsMetrics.realizedGain)}
            </div>
            <p className="text-xs text-muted-foreground">
              {calculateGainPercentage(
                positionsMetrics.unrealizedGain + positionsMetrics.realizedGain,
                positionsMetrics.totalCost,
              )}
              % of Cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deposits Metrics (Open + Closed) - Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value (Deposits) zr1.5</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalValueDepositsZr1_5)}</div>
            <p className="text-xs text-muted-foreground">
              Fixed Income ({calculatePercentage(totalValueDepositsZr1_5, portfolioMetrics.totalValue)}%)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance (Deposits)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(depositsMetrics.cashBalance)}</div>
            <p className="text-xs text-muted-foreground">
              AhlyBank ({calculatePercentage(depositsMetrics.cashBalance, portfolioMetrics.totalValue)}%)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unrealized G/L (Deposits) Zr4.6</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${unrealizedGainZr4_6 >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatNumber(unrealizedGainZr4_6)}
            </div>
            <p className="text-xs text-muted-foreground">
              {calculateGainPercentage(unrealizedGainZr4_6, depositsMetrics.totalCost)}% of Cost
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Realized G/L (Deposits)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${portfolioMetrics.depositsRealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatNumber(portfolioMetrics.depositsRealizedGain)}
            </div>
            <p className="text-xs text-muted-foreground">
              {calculateGainPercentage(portfolioMetrics.depositsRealizedGain, depositsMetrics.totalCost)}% of Cost
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return (Deposits)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${portfolioMetrics.depositsReturn >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatNumber(portfolioMetrics.depositsReturn)}
            </div>
            <p className="text-xs text-muted-foreground">
              {calculateGainPercentage(portfolioMetrics.depositsReturn, depositsMetrics.totalCost)}% of Cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Total Portfolio Metrics - Third Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(portfolioMetrics.totalValue)}</div>
            <p className="text-xs text-muted-foreground">Total Portfolio (100%)</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(portfolioMetrics.cashBalance)}</div>
            <p className="text-xs text-muted-foreground">
              All Cash ({calculatePercentage(portfolioMetrics.cashBalance, portfolioMetrics.totalValue)}%)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Unrealized G/L</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${portfolioMetrics.unrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatNumber(portfolioMetrics.unrealizedGain)}
            </div>
            <p className="text-xs text-muted-foreground">
              {calculateGainPercentage(portfolioMetrics.unrealizedGain, portfolioMetrics.totalCost)}% of Cost
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Realized G/L</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${portfolioMetrics.realizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatNumber(portfolioMetrics.realizedGain)}
            </div>
            <p className="text-xs text-muted-foreground">
              {calculateGainPercentage(portfolioMetrics.realizedGain, portfolioMetrics.totalCost)}% of Cost
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio Return</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${portfolioMetrics.totalReturn >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatNumber(portfolioMetrics.totalReturn)}
            </div>
            <p className="text-xs text-muted-foreground">
              {calculateGainPercentage(portfolioMetrics.totalReturn, portfolioMetrics.totalCost)}% of Cost
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
