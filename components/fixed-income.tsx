"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Holding, PortfolioData } from "@/lib/data-processor"

interface FixedIncomeProps {
  data: PortfolioData
  selectedAccount?: string
}

export default function FixedIncome({ data, selectedAccount = "all" }: FixedIncomeProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState<keyof Holding>("Symbol")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [depositType, setDepositType] = useState<string>("open")

  // Get all transactions
  const transactions = data.transactions || []

  // Process fixed income data similar to Current Holdings
  const processFixedIncomeData = useMemo(() => {
    // Filter transactions for deposits based on status and account
    const openDepositsTransactions = transactions.filter(
      (t) => t["Status Tr"] === "Open Deposits" && (selectedAccount === "all" || t.Account === selectedAccount),
    )

    const closedDepositsTransactions = transactions.filter(
      (t) => t["Status Tr"] === "Closed Deposits" && (selectedAccount === "all" || t.Account === selectedAccount),
    )

    // Group transactions by symbol
    const groupTransactionsBySymbol = (transactions) => {
      const symbolGroups = {}

      transactions.forEach((transaction) => {
        const symbol = transaction.Symbol
        const account = transaction.Account
        const key = `${symbol}-${account}`

        if (!symbolGroups[key]) {
          symbolGroups[key] = []
        }

        symbolGroups[key].push(transaction)
      })

      return symbolGroups
    }

    // Process holdings similar to Current Holdings
    const processHoldings = (transactions) => {
      const holdings = []
      const symbolGroups = groupTransactionsBySymbol(transactions)

      Object.entries(symbolGroups).forEach(([key, transactions]) => {
        const [symbol, account] = key.split("-")

        // Calculate totals
        let quantity = 0
        let totalDebit = 0
        let costChangeSum = 0
        let cumulativeRealizedReturn = 0
        let openCost = 0

        transactions.forEach((transaction) => {
          quantity += Number(transaction["Qty Change"]) || 0
          totalDebit += Number(transaction.Db) || 0
          costChangeSum += Number(transaction["Cost change"]) || 0
          cumulativeRealizedReturn += Number(transaction.Realized3) || 0
        })

        // Calculate OpenCost
        openCost = costChangeSum + cumulativeRealizedReturn

        // Get symbol information
        const symbolInfo = {
          Symbol: symbol,
          Sh_name_eng: transactions[0].Sh_name_eng || symbol,
          Sector: "Fixed Income",
        }

        // Calculate value and returns
        const price = transactions[0]["Net Price"] || 0
        const value = quantity * price

        const unrealizedGain = value - openCost
        const totalReturn = cumulativeRealizedReturn + unrealizedGain

        // Calculate percentages
        const absDebit = Math.abs(totalDebit)
        const totalReturnPct = absDebit !== 0 ? (totalReturn / absDebit) * 100 : 0
        const unrealizedGainPct = absDebit !== 0 ? (unrealizedGain / absDebit) * 100 : 0
        const realizedGainPct = absDebit !== 0 ? (cumulativeRealizedReturn / absDebit) * 100 : 0

        const holding = {
          Symbol: symbol,
          Account: account,
          Name: symbolInfo.Sh_name_eng,
          Sector: symbolInfo.Sector,
          Status: transactions[0]["Status Tr"],
          Quantity: quantity,
          Cost: openCost,
          TotalCost: costChangeSum,
          AvgCost: Math.abs(quantity) > 0.0001 ? Math.abs(openCost / quantity) : 0,
          Price: price,
          Value: value,
          UnrealizedGain: unrealizedGain,
          UnrealizedGainPct: unrealizedGainPct,
          RealizedGain: cumulativeRealizedReturn,
          RealizedGainPct: realizedGainPct,
          TotalReturn: totalReturn,
          TotalReturnPct: totalReturnPct,
          Db: totalDebit,
        }

        holdings.push(holding)
      })

      return holdings
    }

    const openDepositHoldings = processHoldings(openDepositsTransactions)
    const closedDepositHoldings = processHoldings(closedDepositsTransactions)

    // Calculate summary metrics
    const calculateSummaryMetrics = (holdings) => {
      const totalValue = holdings.reduce((sum, h) => sum + h.Value, 0)
      const totalCost = holdings.reduce((sum, h) => sum + h.Cost, 0)
      const unrealizedGain = holdings.reduce((sum, h) => sum + h.UnrealizedGain, 0)
      const realizedGain = holdings.reduce((sum, h) => sum + h.RealizedGain, 0)
      const totalReturn = unrealizedGain + realizedGain

      return {
        totalValue,
        totalCost,
        unrealizedGain,
        realizedGain,
        totalReturn,
        unrealizedGainPct: totalCost !== 0 ? (unrealizedGain / totalCost) * 100 : 0,
        realizedGainPct: totalCost !== 0 ? (realizedGain / totalCost) * 100 : 0,
        totalReturnPct: totalCost !== 0 ? (totalReturn / totalCost) * 100 : 0,
      }
    }

    const openMetrics = calculateSummaryMetrics(openDepositHoldings)
    const closedMetrics = calculateSummaryMetrics(closedDepositHoldings)

    // Combined metrics for all deposits
    const allHoldings = [...openDepositHoldings, ...closedDepositHoldings]
    const combinedMetrics = calculateSummaryMetrics(allHoldings)

    return {
      openDepositHoldings,
      closedDepositHoldings,
      openMetrics,
      closedMetrics,
      combinedMetrics,
    }
  }, [transactions, selectedAccount])

  const { openDepositHoldings, closedDepositHoldings, openMetrics, closedMetrics, combinedMetrics } =
    processFixedIncomeData

  // Get the current deposits based on tab selection
  const currentDeposits = depositType === "open" ? openDepositHoldings : closedDepositHoldings
  const currentMetrics = depositType === "open" ? openMetrics : closedMetrics

  // Filter deposits based on search term
  const filteredDeposits = currentDeposits.filter(
    (deposit) =>
      deposit.Symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deposit.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deposit.Account.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Sort deposits
  const sortedDeposits = [...filteredDeposits].sort((a, b) => {
    const aValue = a[sortColumn]
    const bValue = b[sortColumn]

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    }

    // String comparison
    const aString = String(aValue || "").toLowerCase()
    const bString = String(bValue || "").toLowerCase()
    return sortDirection === "asc" ? aString.localeCompare(bString) : bString.localeCompare(aString)
  })

  // Handle sort
  const handleSort = (column: keyof Holding) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  // Format currency
  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Fixed Income</CardTitle>
          <CardDescription>Your fixed income deposits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Total Value</h3>
              <p className="text-2xl font-bold">{formatNumber(currentMetrics.totalValue)}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Total Cost</h3>
              <p className="text-2xl font-bold">{formatNumber(currentMetrics.totalCost)}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Unrealized Gain/Loss</h3>
              <p
                className={`text-2xl font-bold ${currentMetrics.unrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {formatNumber(currentMetrics.unrealizedGain)}
              </p>
              <p className={`text-sm ${currentMetrics.unrealizedGainPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {currentMetrics.unrealizedGainPct.toFixed(2)}%
              </p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Realized Gain/Loss</h3>
              <p
                className={`text-2xl font-bold ${currentMetrics.realizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {formatNumber(currentMetrics.realizedGain)}
              </p>
              <p className={`text-sm ${currentMetrics.realizedGainPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {currentMetrics.realizedGainPct.toFixed(2)}%
              </p>
            </div>
          </div>

          <Tabs value={depositType} onValueChange={setDepositType} className="mb-4">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="open">Open Deposits ({openDepositHoldings.length})</TabsTrigger>
              <TabsTrigger value="closed">Closed Deposits ({closedDepositHoldings.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search deposits..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">
                    <Button variant="ghost" onClick={() => handleSort("Symbol")}>
                      Symbol
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort("Name")}>
                      Name
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort("Account")}>
                      Account
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("Quantity")}>
                      Quantity
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("AvgCost")}>
                      Avg Cost
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("Price")}>
                      Price
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("Value")}>
                      Value
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("Cost")}>
                      Cost
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("UnrealizedGain")}>
                      Unreal. G/L
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("RealizedGain")}>
                      Real. G/L
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("TotalReturn")}>
                      Total Return
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDeposits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-4">
                      No deposits found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedDeposits.map((deposit) => (
                    <TableRow key={`${deposit.Symbol}-${deposit.Account}`}>
                      <TableCell className="font-medium">{deposit.Symbol}</TableCell>
                      <TableCell>{deposit.Name}</TableCell>
                      <TableCell>{deposit.Account}</TableCell>
                      <TableCell className="text-right">{formatNumber(deposit.Quantity)}</TableCell>
                      <TableCell className="text-right">{formatNumber(deposit.AvgCost, 2)}</TableCell>
                      <TableCell className="text-right">{formatNumber(deposit.Price, 2)}</TableCell>
                      <TableCell className="text-right">{formatNumber(deposit.Value)}</TableCell>
                      <TableCell className="text-right">{formatNumber(deposit.Cost)}</TableCell>
                      <TableCell
                        className={`text-right ${deposit.UnrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatNumber(deposit.UnrealizedGain)}
                        <br />
                        <span className="text-xs">{`(${formatNumber(deposit.UnrealizedGainPct, 2)}%)`}</span>
                      </TableCell>
                      <TableCell
                        className={`text-right ${deposit.RealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatNumber(deposit.RealizedGain)}
                        <br />
                        <span className="text-xs">{`(${formatNumber(deposit.RealizedGainPct, 2)}%)`}</span>
                      </TableCell>
                      <TableCell
                        className={`text-right ${deposit.TotalReturn >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatNumber(deposit.TotalReturn)}
                        <br />
                        <span className="text-xs">{`(${formatNumber(deposit.TotalReturnPct, 2)}%)`}</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {/* Add totals row */}
                <TableRow className="font-bold bg-muted">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedDeposits.reduce((sum, d) => sum + d.Quantity, 0))}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedDeposits.reduce((sum, d) => sum + d.Value, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedDeposits.reduce((sum, d) => sum + d.Cost, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedDeposits.reduce((sum, d) => sum + d.UnrealizedGain, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedDeposits.reduce((sum, d) => sum + d.RealizedGain, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedDeposits.reduce((sum, d) => sum + d.TotalReturn, 0))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
