"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Holding, PortfolioData } from "@/lib/data-processor"

interface ExtendedHolding extends Holding {
  Proceeds?: number;
}

interface ClosedPositionsProps {
  data: PortfolioData
  selectedAccount?: string
}

export default function ClosedPositions({ data, selectedAccount = "all" }: ClosedPositionsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState<keyof ExtendedHolding>("Symbol")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isDebugMode, setIsDebugMode] = useState(false)

  // Fallback: use top-level closedPositions, or first account's closedPositions, or empty array
  const closedPositions = data.closedPositions ?? data.accounts?.[0]?.closedPositions ?? []

  // Debug log to check status values
  useEffect(() => {
    const uniqueStatuses = [...new Set(closedPositions.map((p) => p.Status))]
    console.log("Unique status values in closed positions:", uniqueStatuses)
    console.log(
      "RE positions count:",
      closedPositions.filter((p) => p.Status === "Cleared" || p.Status === "Cleared-RE" || p.Status === "Clered -RE")
        .length,
    )
  }, [closedPositions])

  // Calculate status counts
  const calculateStatusCounts = () => {
    // Filter by account first if an account is selected
    const accountFiltered =
      selectedAccount === "all" ? closedPositions : closedPositions.filter((p) => p.Account === selectedAccount)

    const ytdPositions = accountFiltered.filter((p) => p.Status === "YTD Clear")
    const pydPositions = accountFiltered.filter((p) => p.Status === "PYD Clear")
    const rePositions = accountFiltered.filter(
      (p) => p.Status === "Cleared" || p.Status === "Cleared-RE" || p.Status === "Clered -RE",
    )

    // Count unique symbols for each status type
    const ytdSymbols = new Set(ytdPositions.map((p) => p.Symbol))
    const pydSymbols = new Set(pydPositions.map((p) => p.Symbol))
    const reSymbols = new Set(rePositions.map((p) => p.Symbol))

    // For "all", get unique symbols across all status types
    const allSymbols = new Set([
      ...ytdPositions.map((p) => p.Symbol),
      ...pydPositions.map((p) => p.Symbol),
      ...rePositions.map((p) => p.Symbol),
    ])

    return {
      allCount: allSymbols.size,
      ytdCount: ytdSymbols.size,
      pydCount: pydSymbols.size,
      reCount: reSymbols.size,
    }
  }

  const { allCount, ytdCount, pydCount, reCount } = calculateStatusCounts()

  // Get the positions to display based on filter
  const getFilteredPositions = () => {
    // First filter by account if selected
    const accountFiltered =
      selectedAccount === "all" ? closedPositions : closedPositions.filter((p) => p.Account === selectedAccount)

    // Then filter by search term
    const searchFiltered = accountFiltered.filter(
      (position) =>
        position.Symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        position.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        position.Sector.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    // Then filter by status
    let statusFiltered = searchFiltered
    if (statusFilter !== "all") {
      // Debug the status values
      console.log("Status filter:", statusFilter)
      console.log("Status values in data:", [...new Set(searchFiltered.map((p) => p.Status))])

      // Handle "RE" tab specially to match "Cleared" status
      if (statusFilter === "Cleared") {
        statusFiltered = searchFiltered.filter(
          (position) =>
            position.Status === "Cleared" || position.Status === "Cleared-RE" || position.Status === "Clered -RE",
        )
      } else {
        statusFiltered = searchFiltered.filter((position) => position.Status === statusFilter)
      }
    }

    // Aggregate positions by symbol and status when viewing all accounts
    return selectedAccount === "all"
      ? Object.values(
          statusFiltered.reduce(
            (acc, position) => {
              const key = `${position.Symbol}-${position.Status}`
              if (!acc[key]) {
                acc[key] = {
                  ...position,
                  Quantity: 0,
                  Cost: 0,
                  RealizedGain: 0,
                  TotalCost: 0,
                  Db: 0,
                } as Required<ExtendedHolding>
              }
              const entry = acc[key] as Required<ExtendedHolding>
              entry.Quantity += position.Quantity
              entry.Cost += position.Cost
              entry.TotalCost += position.TotalCost
              entry.RealizedGain += position.RealizedGain || 0
              entry.Db += position.Db || 0
              // Recalculate realized gain percentage using TotalCost
              entry.RealizedGainPct = entry.TotalCost !== 0 ? (entry.RealizedGain / Math.abs(entry.TotalCost)) * 100 : 0
              return acc
            },
            {} as { [key: string]: ExtendedHolding },
          ),
        )
      : statusFiltered
  }

  const filteredPositions = getFilteredPositions()

  // Calculate totals from the filtered positions for the summary boxes
  const calculateMetrics = () => {
    const totalValue = filteredPositions.reduce((sum, position) => sum + (position.Value || 0), 0)
    const totalCost = filteredPositions.reduce((sum, position) => sum + Math.abs(position.TotalCost || 0), 0)
    const unrealizedGain = filteredPositions.reduce((sum, position) => sum + (position.UnrealizedGain || 0), 0)
    const realizedGain = filteredPositions.reduce((sum, position) => sum + (position.RealizedGain || 0), 0)
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

  const metrics = calculateMetrics()

  // Sort positions
  const sortedPositions = [...filteredPositions].sort((a, b) => {
    if (sortColumn === "Proceeds") {
      const aProceeds = Math.abs(a.TotalCost) + (a.RealizedGain || 0)
      const bProceeds = Math.abs(b.TotalCost) + (b.RealizedGain || 0)
      return sortDirection === "asc" ? aProceeds - bProceeds : bProceeds - aProceeds
    }

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
  const handleSort = (column: keyof ExtendedHolding) => {
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

  // Get unique status values
  const uniqueStatuses = [...new Set(closedPositions.map((p) => p.Status))]

  return (
    <div className="space-y-4">
      {isDebugMode && (
        <Card className="bg-yellow-50">
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>Information about statuses found in data</CardDescription>
          </CardHeader>
          <CardContent>
            <h3 className="font-bold mb-2">Unique Status Values:</h3>
            <ul className="list-disc pl-5">
              {uniqueStatuses.map((status, index) => (
                <li key={index}>
                  "{status}" - {closedPositions.filter((p) => p.Status === status).length} positions
                </li>
              ))}
            </ul>
            <h3 className="font-bold mt-4 mb-2">Filter Counts:</h3>
            <ul className="list-disc pl-5">
              <li>YTD Clear: {closedPositions.filter((p) => p.Status === "YTD Clear").length}</li>
              <li>PYD Clear: {closedPositions.filter((p) => p.Status === "PYD Clear").length}</li>
              <li>
                Cleared:{" "}
                {
                  closedPositions.filter(
                    (p) => p.Status === "Cleared" || p.Status === "Cleared-RE" || p.Status === "Clered -RE",
                  ).length
                }
              </li>
              <li>Total: {closedPositions.length}</li>
            </ul>
            <Button onClick={() => setIsDebugMode(false)} variant="outline" className="mt-4">
              Hide Debug Info
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Closed Positions</CardTitle>
          <CardDescription>Positions that have been fully closed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Total Value</h3>
              <p className="text-2xl font-bold">{formatNumber(metrics.totalValue)}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Total Cost</h3>
              <p className="text-2xl font-bold">{formatNumber(metrics.totalCost)}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Unrealized Gain/Loss</h3>
              <p className={`text-2xl font-bold ${metrics.unrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatNumber(metrics.unrealizedGain)}
              </p>
              <p className={`text-sm ${metrics.unrealizedGainPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {metrics.unrealizedGainPct.toFixed(2)}%
              </p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Realized Gain/Loss</h3>
              <p className={`text-2xl font-bold ${metrics.realizedGain >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatNumber(metrics.realizedGain)}
              </p>
              <p className={`text-sm ${metrics.realizedGainPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {metrics.realizedGainPct.toFixed(2)}%
              </p>
            </div>
          </div>

          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="all">All ({allCount})</TabsTrigger>
              <TabsTrigger value="YTD Clear">YTD ({ytdCount})</TabsTrigger>
              <TabsTrigger value="PYD Clear">PYD ({pydCount})</TabsTrigger>
              <TabsTrigger value="Cleared">RE ({reCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center py-4">
            <Input
              placeholder="Search symbols, names, or sectors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
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
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort("Account")}>
                      Account
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("TotalCost")}>
                      Purchase Cost
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("RealizedGain")}>
                      Realized G/L
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("Proceeds")}>
                      Proceeds
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort("RealizedGainPct")}>
                      Return %
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPositions.map((position, index) => {
                  const proceeds = Math.abs(position.TotalCost) + (position.RealizedGain || 0)
                  return (
                    <TableRow key={`${position.Symbol}-${position.Account}-${index}`}>
                      <TableCell className="font-medium">{position.Symbol}</TableCell>
                      <TableCell>{position.Name}</TableCell>
                      <TableCell>{position.Sector}</TableCell>
                      <TableCell>{position.Account}</TableCell>
                      <TableCell className="text-right">{formatNumber(Math.abs(position.TotalCost))}</TableCell>
                      <TableCell
                        className={`text-right ${
                          position.RealizedGain >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatNumber(position.RealizedGain || 0)}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(proceeds)}</TableCell>
                      <TableCell
                        className={`text-right ${
                          (position.RealizedGainPct || 0) >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatNumber(position.RealizedGainPct || 0, 2)}%
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
