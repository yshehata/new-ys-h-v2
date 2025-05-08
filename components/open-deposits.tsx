"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Search } from "lucide-react"
import type { PortfolioData, Transaction } from "@/lib/data-processor"

interface OpenDepositsProps {
  data: PortfolioData
  selectedAccount?: string
}

export default function OpenDeposits({ data, selectedAccount = "all" }: OpenDepositsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "ascending" | "descending" }>({
    key: "Symbol",
    direction: "ascending",
  })
  const [showDebug, setShowDebug] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  // Add debug info
  const addDebugInfo = (message: string) => {
    setDebugInfo((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  // Process open deposits transactions into holdings
  const openDeposits = useMemo(() => {
    if (!data || !data.transactions) return []

    // Filter for open deposits and by account if specified
    const openDepositsTransactions = data.transactions.filter(
      (t) => t["Status Tr"] === "Open Deposits" && (selectedAccount === "all" || t.Account === selectedAccount),
    )

    addDebugInfo(`Found ${openDepositsTransactions.length} open deposits transactions`)

    const holdings = []
    const symbolAccountGroups = new Map<string, Transaction[]>()

    // Group transactions by symbol AND account
    openDepositsTransactions.forEach((transaction) => {
      const symbol = transaction.Symbol
      const account = transaction.Account || "Unknown"
      const key = `${symbol}|${account}`

      if (!symbolAccountGroups.has(key)) {
        symbolAccountGroups.set(key, [])
      }
      symbolAccountGroups.get(key)?.push(transaction)
    })

    addDebugInfo(`Grouped into ${symbolAccountGroups.size} symbol-account groups`)

    // Process each symbol-account group
    symbolAccountGroups.forEach((transactions, key) => {
      const [symbol, account] = key.split("|")

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

      // Calculate OpenCost
      const openCost = costChangeSum + cumulativeRealizedReturn
      const exactSymbol = transactions[0].Symbol

      // Get price from quotes
      let price = 0
      let priceSource = "default"

      // Try to get price from latestQuotes first
      if (data.latestQuotes && data.latestQuotes.has(exactSymbol)) {
        const quote = data.latestQuotes.get(exactSymbol)
        if (quote && quote.Close && Number(quote.Close) > 0) {
          price = Number(quote.Close)
          priceSource = "latestQuotes"
          addDebugInfo(`Found price ${price} for ${exactSymbol} in latestQuotes`)
        }
      }

      // If not found in latestQuotes, try to find in quotes array
      if (price === 0 && data.quotes && Array.isArray(data.quotes)) {
        const matchingQuotes = data.quotes.filter(
          (q) => q && q.Symbol === exactSymbol && q.Close && Number(q.Close) > 0,
        )

        if (matchingQuotes.length > 0) {
          // Sort by date descending to get the latest quote
          const latestQuote = matchingQuotes.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())[0]

          price = Number(latestQuote.Close)
          priceSource = "quotes array"
          addDebugInfo(`Found price ${price} for ${exactSymbol} in quotes array (from ${matchingQuotes.length} quotes)`)
        }
      }

      // If still no price, use Net Price from transaction
      if (price === 0) {
        price = Number(transactions[0]["Net Price"]) || 1.0
        priceSource = "transaction Net Price"
        addDebugInfo(`Using Net Price ${price} for ${exactSymbol} from transaction`)
      }

      const value = quantity * price
      const unrealizedGain = value - openCost

      if (Math.abs(quantity) > 0.0001) {
        holdings.push({
          Symbol: exactSymbol,
          Name: transactions[0].Sh_name_eng || "",
          Account: account,
          Quantity: quantity,
          AvgCost: quantity !== 0 ? openCost / quantity : 0,
          Price: price,
          PriceSource: priceSource,
          Value: value,
          Cost: openCost,
          UnrealizedGain: unrealizedGain,
          UnrealizedGainPct: openCost !== 0 ? (unrealizedGain / Math.abs(openCost)) * 100 : 0,
          RealizedGain: cumulativeRealizedReturn,
        })
      }
    })

    addDebugInfo(`Processed ${holdings.length} open deposit holdings`)
    return holdings
  }, [data, selectedAccount])

  // Calculate cash balance for AhlyBank
  const cashBalance = useMemo(() => {
    if (!data || !data.transactions) return 0

    // Filter for AhlyBank transactions
    const ahlyBankTransactions = data.transactions.filter(
      (t) => t.Account === "AhlyBank" && (selectedAccount === "all" || t.Account === selectedAccount),
    )

    // Sum up all Cash Impact values
    const totalCashImpact = ahlyBankTransactions.reduce((sum, t) => sum + Number(t["Cash Impact"] || 0), 0)

    addDebugInfo(
      `Calculated AhlyBank cash balance: ${totalCashImpact} from ${ahlyBankTransactions.length} transactions`,
    )
    return totalCashImpact
  }, [data, selectedAccount])

  // Calculate total metrics
  const metrics = useMemo(() => {
    const totalValue = openDeposits.reduce((sum, h) => sum + h.Value, 0) + cashBalance
    const totalUnrealizedGain = openDeposits.reduce((sum, h) => sum + h.UnrealizedGain, 0)
    const totalRealizedGain = openDeposits.reduce((sum, h) => sum + h.RealizedGain, 0)

    return {
      totalValue,
      cashBalance,
      unrealizedGain: totalUnrealizedGain,
      unrealizedGainPct: totalValue > 0 ? (totalUnrealizedGain / totalValue) * 100 : 0,
      realizedGain: totalRealizedGain,
    }
  }, [openDeposits, cashBalance])

  // Handle sorting
  const handleSort = (key: string) => {
    setSortConfig((prevConfig) => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === "ascending" ? "descending" : "ascending",
    }))
  }

  // Filter and sort deposits
  const filteredAndSortedDeposits = useMemo(() => {
    let filtered = [...openDeposits]

    // Apply search filter
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (deposit) =>
          deposit.Symbol.toLowerCase().includes(lowerCaseSearchTerm) ||
          deposit.Name.toLowerCase().includes(lowerCaseSearchTerm) ||
          deposit.Account.toLowerCase().includes(lowerCaseSearchTerm),
      )
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1
        }
        return 0
      })
    }

    return filtered
  }, [openDeposits, searchTerm, sortConfig])

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Format percentage values
  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalValue)}</div>
            <p className="text-xs text-muted-foreground">Deposits + Cash</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.cashBalance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unrealized Gain/Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.unrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}>
              {metrics.unrealizedGain >= 0 ? "" : "-"}
              {formatCurrency(Math.abs(metrics.unrealizedGain))}
            </div>
            <p className="text-xs text-muted-foreground">{formatPercentage(metrics.unrealizedGainPct)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Realized Gain/Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.realizedGain >= 0 ? "text-green-600" : "text-red-600"}`}>
              {metrics.realizedGain >= 0 ? "" : "-"}
              {formatCurrency(Math.abs(metrics.realizedGain))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <CardTitle>Open Deposits</CardTitle>
              <CardDescription>Your active fixed income deposits</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search deposits..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)}>
                {showDebug ? "Hide Debug" : "Show Debug"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showDebug && (
            <div className="mb-4 p-2 bg-slate-100 rounded-md text-xs font-mono overflow-auto max-h-40">
              <h4 className="font-bold mb-1">Debug Information:</h4>
              {debugInfo.map((info, index) => (
                <div key={index}>{info}</div>
              ))}
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("Symbol")}
                    >
                      Symbol
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("Name")}
                    >
                      Name
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("Account")}
                    >
                      Account
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("Quantity")}
                    >
                      Quantity
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("AvgCost")}
                    >
                      Avg Cost
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("Price")}
                    >
                      Price
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("Value")}
                    >
                      Value
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("Cost")}
                    >
                      Cost
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("UnrealizedGain")}
                    >
                      Unrealized G/L
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("UnrealizedGainPct")}
                    >
                      %
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedDeposits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      No open deposits data available
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedDeposits.map((deposit, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{deposit.Symbol}</TableCell>
                      <TableCell>{deposit.Name}</TableCell>
                      <TableCell>{deposit.Account}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deposit.Quantity)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deposit.AvgCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deposit.Price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deposit.Value)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(deposit.Cost)}</TableCell>
                      <TableCell
                        className={`text-right ${deposit.UnrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatCurrency(deposit.UnrealizedGain)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${deposit.UnrealizedGainPct >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatPercentage(deposit.UnrealizedGainPct)}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
