"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Holding, PortfolioData } from "@/lib/data-processor"

interface CurrentHoldingsProps {
  data: PortfolioData
  selectedAccount?: string
}

export default function CurrentHoldings({ data, selectedAccount = "all" }: CurrentHoldingsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState<keyof Holding>("Symbol")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Fallback: use top-level currentHoldings, or first account's currentHoldings, or empty array
  const holdings = data.currentHoldings ?? data.accounts?.[0]?.currentHoldings ?? [];
  // Filter holdings based on search term and selected account
  const filteredHoldings = holdings.filter(
    (holding) =>
      (holding.Symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        holding.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        holding.Sector.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (selectedAccount === "all" || holding.Account === selectedAccount),
  );

  // Aggregate holdings by symbol when viewing all accounts
  const aggregatedHoldings = selectedAccount === "all"
    ? Object.values(filteredHoldings.reduce((acc, holding) => {
        if (!acc[holding.Symbol]) {
          acc[holding.Symbol] = {
            ...holding,
            Quantity: 0,
            Value: 0,
            Cost: 0,
            UnrealizedGain: 0,
          };
        }
        acc[holding.Symbol].Quantity += holding.Quantity;
        acc[holding.Symbol].Value += holding.Value;
        acc[holding.Symbol].Cost += holding.Cost;
        acc[holding.Symbol].UnrealizedGain += holding.UnrealizedGain;
        // Recalculate average cost and unrealized gain percentage
        acc[holding.Symbol].AvgCost = acc[holding.Symbol].Cost / acc[holding.Symbol].Quantity;
        acc[holding.Symbol].UnrealizedGainPct = (acc[holding.Symbol].UnrealizedGain / acc[holding.Symbol].Cost) * 100;
        return acc;
      }, {} as { [key: string]: Holding }))
    : filteredHoldings;

  if (!holdings.length) {
    return <div className="p-4">No holdings data available.</div>;
  }

  // Sort holdings
  const sortedHoldings = [...aggregatedHoldings].sort((a, b) => {
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

  // Format currency - 2 decimals only for price and avg cost, 0 decimals for others
  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }

  // Calculate metrics for the selected account or all accounts
  const accountHoldings =
    selectedAccount === "all"
      ? holdings
      : holdings.filter((holding) => holding.Account === selectedAccount);

  const holdingsValue = accountHoldings.reduce((sum, holding) => sum + holding.Value, 0)
  const holdingsCost = accountHoldings.reduce((sum, holding) => sum + holding.Cost, 0)
  const unrealizedGain = accountHoldings.reduce((sum, holding) => sum + holding.UnrealizedGain, 0)
  const realizedGain = accountHoldings.reduce((sum, holding) => sum + holding.RealizedGain, 0)

  // Fallback: use top-level summaryMetrics, or first account's summaryMetrics, or default values
  const summaryMetrics = data.summaryMetrics ?? data.accounts?.[0]?.summaryMetrics ?? {
    totalValue: 0,
    cashBalance: 0,
    equityValue: 0,
    realizedGain: 0,
    unrealizedGain: 0,
  };
  const cashBalance = summaryMetrics.cashBalance;

  // Calculate total portfolio value (holdings + cash)
  const portfolioTotalValue = holdingsValue + cashBalance

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Current Holdings</CardTitle>
          <CardDescription>Your active portfolio positions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Total Value</h3>
              <p className="text-2xl font-bold">{formatNumber(portfolioTotalValue)}</p>
              <p className="text-xs text-muted-foreground">Holdings + Cash</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Cash Balance</h3>
              <p className="text-2xl font-bold">{formatNumber(cashBalance)}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Unrealized Gain/Loss</h3>
              <p className={`text-2xl font-bold ${unrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatNumber(unrealizedGain)}
              </p>
              <p className={`text-sm ${unrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}>
                {holdingsCost > 0 ? `${((unrealizedGain / holdingsCost) * 100).toFixed(2)}%` : "0.00%"}
              </p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Realized Gain/Loss</h3>
              <p className={`text-2xl font-bold ${realizedGain >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatNumber(realizedGain)}
              </p>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search holdings..."
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
                    <Button variant="ghost" onClick={() => handleSort("Sector")}>
                      Sector
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
                    <Button variant="ghost" onClick={() => handleSort("TotalReturn")}>
                      Total Return
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHoldings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-4">
                      No holdings found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedHoldings.map((holding) => (
                    <TableRow key={holding.Symbol}>
                      <TableCell className="font-medium">{holding.Symbol}</TableCell>
                      <TableCell>{holding.Name}</TableCell>
                      <TableCell>{holding.Sector}</TableCell>
                      <TableCell className="text-right">{formatNumber(holding.Quantity)}</TableCell>
                      <TableCell className="text-right">{formatNumber(holding.AvgCost, 2)}</TableCell>
                      <TableCell className="text-right">{formatNumber(holding.Price, 2)}</TableCell>
                      <TableCell className="text-right">{formatNumber(holding.Value)}</TableCell>
                      <TableCell className="text-right">{formatNumber(holding.Cost)}</TableCell>
                      <TableCell
                        className={`text-right ${holding.UnrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatNumber(holding.UnrealizedGain)}
                        <br />
                        <span className="text-xs">
                          {`(${formatNumber(holding.UnrealizedGainPct, 2)}%)`}
                        </span>
                      </TableCell>
                      <TableCell
                        className={`text-right ${holding.TotalReturn >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatNumber(holding.TotalReturn)}
                        <br />
                        <span className="text-xs">
                          {`(${formatNumber(holding.TotalReturnPct, 2)}%)`}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {/* Add totals row */}
                <TableRow className="font-bold bg-muted">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedHoldings.reduce((sum, h) => sum + h.Quantity, 0))}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedHoldings.reduce((sum, h) => sum + h.Value, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedHoldings.reduce((sum, h) => sum + h.Cost, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedHoldings.reduce((sum, h) => sum + h.UnrealizedGain, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sortedHoldings.reduce((sum, h) => sum + h.TotalReturn, 0))}
                    <br />
                    <span className="text-xs">
                      {formatNumber(
                        (sortedHoldings.reduce((sum, h) => sum + h.TotalReturn, 0) / 
                         Math.abs(sortedHoldings.reduce((sum, h) => sum + h.Cost, 0))) * 100,
                        2
                      )}%
                    </span>
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
