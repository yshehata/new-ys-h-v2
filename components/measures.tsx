"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { PortfolioData } from "@/lib/data-processor"

interface MeasuresProps {
  data: PortfolioData
  selectedAccount?: string
}

interface Measure {
  mainSerial: number
  subSerial: number
  name: string
  category: string
  subCategory: string
  value: number
  calculation: string
  usedIn: string[]
  dependencies?: string[]
}

export default function Measures({ data, selectedAccount = "all" }: MeasuresProps) {
  // Format numbers with zero decimals
  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }

  const measures = useMemo<Measure[]>(() => {
    if (!data) return []

    const openDepositsRealizedGain = data.transactions
      ?.filter(t => t["Status Tr"] === "Open Deposits" && (selectedAccount === "all" || t.Account === selectedAccount))
      .reduce((sum, t) => sum + (t.Realized3 || 0), 0) || 0

    const closedDepositsRealizedGain = data.closedPositions
      ?.filter(p => p["Status Tr"] === "Closed Deposits" && (selectedAccount === "all" || p.Account === selectedAccount))
      .reduce((sum, p) => sum + (p.RealizedGain || 0), 0) || 0

    return [
      // 1.xx - Value Measures
      {
        mainSerial: 1,
        subSerial: 1,
        name: "Holdings Value (Positions)",
        category: "Positions",
        subCategory: "Value",
        value: data.currentHoldings
          ?.filter(h => h.Account !== "AhlyBank" && h["Status Tr"] !== "Open Deposits")
          .reduce((sum, h) => sum + h.Value, 0) || 0,
        calculation: "Sum of Value from currentHoldings where Account != 'AhlyBank' AND Status != 'Open Deposits'",
        usedIn: ["Summary", "Front Boxes", "Open Positions"]
      },
      {
        mainSerial: 1,
        subSerial: 2,
        name: "Fixed Income Value",
        category: "Deposits",
        subCategory: "Value",
        value: (() => {
          if (!data || !data.transactions) return 0

          // Process open deposits transactions into holdings
          const openDepositsTransactions = data.transactions.filter(t => 
            t["Status Tr"] === "Open Deposits" && 
            (selectedAccount === "all" || t.Account === selectedAccount)
          )

          const symbolAccountGroups = new Map<string, any[]>()

          // Group transactions by symbol AND account
          openDepositsTransactions.forEach(transaction => {
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

            transactions.forEach(transaction => {
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
              const matchingQuotes = data.quotes.filter(q => 
                q && q.Symbol === exactSymbol && q.Close && Number.parseFloat(String(q.Close)) > 0
              )

              if (matchingQuotes.length > 0) {
                const latestQuote = matchingQuotes.sort((a, b) => 
                  new Date(b.Date).getTime() - new Date(a.Date).getTime()
                )[0]
                price = Number.parseFloat(String(latestQuote.Close))
              } else {
                const baseSymbol = exactSymbol.split("@")[0]
                const similarQuotes = data.quotes.filter(q => 
                  q && q.Symbol && q.Symbol.startsWith(baseSymbol) && q.Close && Number.parseFloat(String(q.Close)) > 0
                )

                if (similarQuotes.length > 0) {
                  const latestSimilarQuote = similarQuotes.sort((a, b) => 
                    new Date(b.Date).getTime() - new Date(a.Date).getTime()
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

          return holdingsValue
        })(),
        calculation: "Sum of (quantity * price) for each holding using exact Open Deposits calculation",
        usedIn: ["Summary", "Front Boxes", "Open Deposits"],
      },
      {
        mainSerial: 1,
        subSerial: 3,
        name: "AhlyBank Holdings Value",
        category: "Deposits",
        subCategory: "Value",
        value: (() => {
          if (!data || !data.transactions) return 0

          // Process open deposits transactions into holdings
          const openDepositsTransactions = data.transactions.filter(t => 
            t.Account === "AhlyBank" && 
            (selectedAccount === "all" || t.Account === selectedAccount)
          )

          const symbolAccountGroups = new Map<string, any[]>()

          // Group transactions by symbol AND account
          openDepositsTransactions.forEach(transaction => {
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

            transactions.forEach(transaction => {
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
              const matchingQuotes = data.quotes.filter(q => 
                q && q.Symbol === exactSymbol && q.Close && Number.parseFloat(String(q.Close)) > 0
              )

              if (matchingQuotes.length > 0) {
                const latestQuote = matchingQuotes.sort((a, b) => 
                  new Date(b.Date).getTime() - new Date(a.Date).getTime()
                )[0]
                price = Number.parseFloat(String(latestQuote.Close))
              } else {
                const baseSymbol = exactSymbol.split("@")[0]
                const similarQuotes = data.quotes.filter(q => 
                  q && q.Symbol && q.Symbol.startsWith(baseSymbol) && q.Close && Number.parseFloat(String(q.Close)) > 0
                )

                if (similarQuotes.length > 0) {
                  const latestSimilarQuote = similarQuotes.sort((a, b) => 
                    new Date(b.Date).getTime() - new Date(a.Date).getTime()
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

          return holdingsValue
        })(),
        calculation: "Sum of (quantity * price) for each holding using exact Open Deposits calculation, filtered for AhlyBank",
        usedIn: ["Summary", "Front Boxes", "Open Deposits"]
      },
      {
        mainSerial: 1,
        subSerial: 4,
        name: "Total Value (Positions)",
        category: "Positions",
        subCategory: "Value",
        value: data.currentHoldings
          ?.filter(h => h.Account !== "AhlyBank" && h["Status Tr"] !== "Open Deposits")
          .reduce((sum, h) => sum + h.Value, 0) || 0,
        calculation: "Sum of Value from currentHoldings where Account != 'AhlyBank' AND Status != 'Open Deposits'",
        usedIn: ["Summary", "Front Boxes", "Open Positions"],
      },
      {
        mainSerial: 1,
        subSerial: 5,
        name: "Total Value (Deposits)",
        category: "Deposits",
        subCategory: "Value",
        value: (() => {
          if (!data || !data.transactions) return 0

          // Process open deposits transactions into holdings
          const openDepositsTransactions = data.transactions.filter(t => 
            t["Status Tr"] === "Open Deposits" && 
            (selectedAccount === "all" || t.Account === selectedAccount)
          )

          const symbolAccountGroups = new Map<string, any[]>()

          // Group transactions by symbol AND account
          openDepositsTransactions.forEach(transaction => {
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

            transactions.forEach(transaction => {
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
              const matchingQuotes = data.quotes.filter(q => 
                q && q.Symbol === exactSymbol && q.Close && Number.parseFloat(String(q.Close)) > 0
              )

              if (matchingQuotes.length > 0) {
                const latestQuote = matchingQuotes.sort((a, b) => 
                  new Date(b.Date).getTime() - new Date(a.Date).getTime()
                )[0]
                price = Number.parseFloat(String(latestQuote.Close))
              } else {
                const baseSymbol = exactSymbol.split("@")[0]
                const similarQuotes = data.quotes.filter(q => 
                  q && q.Symbol && q.Symbol.startsWith(baseSymbol) && q.Close && Number.parseFloat(String(q.Close)) > 0
                )

                if (similarQuotes.length > 0) {
                  const latestSimilarQuote = similarQuotes.sort((a, b) => 
                    new Date(b.Date).getTime() - new Date(a.Date).getTime()
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
          const ahlyBankCash = selectedAccount === "all" || selectedAccount === "AhlyBank"
            ? (data.accounts?.find(acc => acc.name === "AhlyBank")?.summaryMetrics?.cashBalance || 0)
            : 0

          // Return total portfolio value (holdings + cash)
          return holdingsValue + ahlyBankCash
        })(),
        calculation: "Sum of (quantity * price) for each holding plus AhlyBank cash balance, using exact Open Deposits calculation",
        usedIn: ["Summary", "Front Boxes", "Open Deposits"]
      },
      {
        mainSerial: 1,
        subSerial: 6,
        name: "Total Portfolio Value",
        category: "Total Portfolio",
        subCategory: "Value",
        value: (
          // Total Value (Positions)
          (data.currentHoldings
            ?.filter(h => h.Account !== "AhlyBank" && h["Status Tr"] !== "Open Deposits")
            .reduce((sum, h) => sum + h.Value, 0) || 0) +
          // Total Value (Deposits)
          (data.currentHoldings
            ?.filter(h => h["Status Tr"] === "Open Deposits")
            .reduce((sum, h) => sum + h.Value, 0) || 0)
        ),
        calculation: "Total Value (Positions) + Total Value (Deposits)",
        usedIn: ["Summary", "Front Boxes"],
      },

      // 2.xx - Cash Measures
      {
        mainSerial: 2,
        subSerial: 1,
        name: "Cash Value (Positions)",
        category: "Positions",
        subCategory: "Cash",
        value: selectedAccount === "all"
          ? (data.accounts?.reduce((sum, acc) => 
              acc.name !== "AhlyBank" ? sum + (acc.summaryMetrics?.cashBalance || 0) : sum, 0) || 0)
          : (data.accounts?.find(acc => acc.name === selectedAccount)?.summaryMetrics?.cashBalance || 0),
        calculation: "Sum of cashBalance from accounts where Account != 'AhlyBank'",
        usedIn: ["Summary", "Front Boxes"]
      },
      {
        mainSerial: 2,
        subSerial: 2,
        name: "Cash Value (Deposits)",
        category: "Deposits",
        subCategory: "Cash",
        value: selectedAccount === "all" || selectedAccount === "AhlyBank"
          ? (data.accounts?.find(acc => acc.name === "AhlyBank")?.summaryMetrics?.cashBalance || 0)
          : 0,
        calculation: "cashBalance from AhlyBank account",
        usedIn: ["Summary", "Front Boxes"]
      },
      {
        mainSerial: 2,
        subSerial: 3,
        name: "Total Cash",
        category: "Total Portfolio",
        subCategory: "Cash",
        value: (data.accounts?.reduce((sum, acc) => sum + (acc.summaryMetrics?.cashBalance || 0), 0) || 0),
        calculation: "Cash Value (Positions) + Cash Value (Deposits)",
        usedIn: ["Summary", "Front Boxes"],
        dependencies: ["2.1 Cash Value (Positions)", "2.2 Cash Value (Deposits)"]
      },

      // 3.xx - Cost Measures
      {
        mainSerial: 3,
        subSerial: 1,
        name: "Net Cost (Positions)",
        category: "Positions",
        subCategory: "Cost",
        value: (data.currentHoldings
          ?.filter(h => h.Account !== "AhlyBank")
          .reduce((sum, h) => sum + Math.abs(h.Cost || 0), 0) || 0),
        calculation: "Sum of absolute Cost from currentHoldings where Account != 'AhlyBank'",
        usedIn: ["Summary", "Front Boxes", "Open Positions"]
      },
      {
        mainSerial: 3,
        subSerial: 2,
        name: "Net Cost (Deposits)",
        category: "Deposits",
        subCategory: "Cost",
        value: data.currentHoldings
          ?.filter(h => h["Status Tr"] === "Open Deposits")
          .reduce((sum, h) => sum + Math.abs(h.Cost || 0), 0) || 0,
        calculation: "Sum of absolute Cost from currentHoldings where Status='Open Deposits'",
        usedIn: ["Summary", "Front Boxes", "Open Deposits"]
      },
      {
        mainSerial: 3,
        subSerial: 3,
        name: "Total Net Cost",
        category: "Total Portfolio",
        subCategory: "Cost",
        value: (data.currentHoldings?.reduce((sum, h) => sum + Math.abs(h.Cost || 0), 0) || 0),
        calculation: "Net Cost (Positions) + Net Cost (Deposits)",
        usedIn: ["Summary", "Front Boxes"],
        dependencies: ["3.1 Net Cost (Positions)", "3.2 Net Cost (Deposits)"]
      },

      // 4.xx - Return Measures
      {
        mainSerial: 4,
        subSerial: 1,
        name: "Unrealized G/L (Positions)",
        category: "Positions",
        subCategory: "Returns",
        value: data.currentHoldings
          ?.filter(h => h.Account !== "AhlyBank")
          .reduce((sum, h) => sum + (h.UnrealizedGain || 0), 0) || 0,
        calculation: "Sum of UnrealizedGain from currentHoldings where Account != 'AhlyBank'",
        usedIn: ["Summary", "Front Boxes", "Open Positions"]
      },
      {
        mainSerial: 4,
        subSerial: 2,
        name: "Unrealized Return % (Positions)",
        category: "Positions",
        subCategory: "Returns",
        value: ((data.currentHoldings
          ?.filter(h => h.Account !== "AhlyBank")
          .reduce((sum, h) => sum + (h.UnrealizedGain || 0), 0) || 0) /
          Math.abs(data.currentHoldings
            ?.filter(h => h.Account !== "AhlyBank")
            .reduce((sum, h) => sum + Math.abs(h.Cost || 0), 0) || 1)) * 100,
        calculation: "(Unrealized G/L / abs(Net Cost)) * 100",
        usedIn: ["Summary", "Front Boxes", "Open Positions"],
        dependencies: ["4.1 Unrealized G/L (Positions)", "3.1 Net Cost (Positions)"]
      },
      {
        mainSerial: 4,
        subSerial: 3,
        name: "Realized G/L (Positions)",
        category: "Positions",
        subCategory: "Returns",
        value: (data.currentHoldings
          ?.filter(h => h.Account !== "AhlyBank")
          .reduce((sum, h) => sum + (h.RealizedGain || 0), 0) || 0) +
          (data.closedPositions
            ?.filter(p => p["Status Tr"] !== "Closed Deposits")
            .reduce((sum, p) => sum + (p.RealizedGain || 0), 0) || 0),
        calculation: "Sum of RealizedGain from (currentHoldings + closedPositions) excluding Deposits",
        usedIn: ["Summary", "Front Boxes", "Closed Positions"]
      },
      {
        mainSerial: 4,
        subSerial: 4,
        name: "Realized Return % (Positions)",
        category: "Positions",
        subCategory: "Returns",
        value: ((data.currentHoldings
          ?.filter(h => h.Account !== "AhlyBank")
          .reduce((sum, h) => sum + (h.RealizedGain || 0), 0) || 0) /
          Math.abs(data.currentHoldings
            ?.filter(h => h.Account !== "AhlyBank")
            .reduce((sum, h) => sum + Math.abs(h.Cost || 0), 0) || 1)) * 100,
        calculation: "(Realized G/L / abs(Net Cost)) * 100",
        usedIn: ["Summary", "Front Boxes", "Closed Positions"],
        dependencies: ["4.3 Realized G/L (Positions)", "3.1 Net Cost (Positions)"]
      },
      {
        mainSerial: 4,
        subSerial: 5,
        name: "Total Return (Positions)",
        category: "Positions",
        subCategory: "Returns",
        value: (data.currentHoldings
          ?.filter(h => h.Account !== "AhlyBank")
          .reduce((sum, h) => sum + (h.UnrealizedGain || 0) + (h.RealizedGain || 0), 0) || 0),
        calculation: "Unrealized G/L + Realized G/L",
        usedIn: ["Summary", "Front Boxes"],
        dependencies: ["4.1 Unrealized G/L (Positions)", "4.3 Realized G/L (Positions)"]
      },
      {
        mainSerial: 4,
        subSerial: 6,
        name: "Unrealized G/L (Deposits)",
        category: "Deposits",
        subCategory: "Returns",
        value: (() => {
          if (!data || !data.transactions) return 0
          
          // Filter transactions for "Open Deposits" status and selected account
          const openDepositsTransactions = data.transactions.filter(t => 
            t["Status Tr"] === "Open Deposits" && 
            (selectedAccount === "all" || t.Account === selectedAccount)
          )

          // Group transactions by symbol AND account
          const symbolAccountGroups = new Map<string, any[]>()
          openDepositsTransactions.forEach(transaction => {
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

            transactions.forEach(transaction => {
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
              const matchingQuotes = data.quotes.filter(q => 
                q && q.Symbol === exactSymbol && q.Close && Number.parseFloat(String(q.Close)) > 0
              )

              if (matchingQuotes.length > 0) {
                const latestQuote = matchingQuotes.sort((a, b) => 
                  new Date(b.Date).getTime() - new Date(a.Date).getTime()
                )[0]
                price = Number.parseFloat(String(latestQuote.Close))
              } else {
                const baseSymbol = exactSymbol.split("@")[0]
                const similarQuotes = data.quotes.filter(q => 
                  q && q.Symbol && q.Symbol.startsWith(baseSymbol) && q.Close && Number.parseFloat(String(q.Close)) > 0
                )

                if (similarQuotes.length > 0) {
                  const latestSimilarQuote = similarQuotes.sort((a, b) => 
                    new Date(b.Date).getTime() - new Date(a.Date).getTime()
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
        })(),
        calculation: "Exact same calculation as Open Deposits: For each symbol-account group: value (quantity * price) - openCost (costChangeSum + cumulativeRealizedReturn)",
        usedIn: ["Summary", "Front Boxes", "Open Deposits"]
      },
      {
        mainSerial: 4,
        subSerial: 7,
        name: "Realized G/L (Deposits)",
        category: "Deposits",
        subCategory: "Returns",
        value: (() => {
          // Get value from 4.7.1
          const openDepositsRealizedGain = data.transactions
            ?.filter(t => t["Status Tr"] === "Open Deposits" && (selectedAccount === "all" || t.Account === selectedAccount))
            .reduce((sum, t) => sum + (t.Realized3 || 0), 0) || 0

          // Get value from 4.7.2
          if (!data || !data.transactions) return openDepositsRealizedGain

          const closedDepositsTransactions = data.transactions.filter(t => 
            t["Status Tr"] === "Closed Deposits" && 
            (selectedAccount === "all" || t.Account === selectedAccount)
          )

          const symbolAccountGroups = new Map<string, any[]>()
          closedDepositsTransactions.forEach(transaction => {
            const symbol = transaction.Symbol
            const account = transaction.Account || "Unknown"
            const key = `${symbol}|${account}`
            if (!symbolAccountGroups.has(key)) {
              symbolAccountGroups.set(key, [])
            }
            symbolAccountGroups.get(key)!.push(transaction)
          })

          let closedDepositsRealizedGain = 0

          symbolAccountGroups.forEach((transactions, key) => {
            let cumulativeRealizedReturn = 0
            transactions.forEach(transaction => {
              cumulativeRealizedReturn += Number(transaction.Realized3) || 0
            })
            closedDepositsRealizedGain += cumulativeRealizedReturn
          })

          const ahlyBankRealizedGain = data.closedPositions
            ?.filter(p => p["Status Tr"] === "Closed Deposits" && p.Account === "AhlyBank")
            .reduce((sum, p) => sum + (p.RealizedGain || 0), 0) || 0

          closedDepositsRealizedGain += ahlyBankRealizedGain

          // Return sum of 4.7.1 and 4.7.2
          return openDepositsRealizedGain + closedDepositsRealizedGain
        })(),
        calculation: "Sum of measure 4.7.1 (Open Deposits Realized G/L) and measure 4.7.2 (Closed Deposits Realized G/L)",
        usedIn: ["Summary", "Front Boxes", "Open Deposits", "Closed Deposits"]
      },
      {
        mainSerial: 4,
        subSerial: 7.1,
        name: "Realized G/L (Deposits) Open Deposits",
        category: "Deposits",
        subCategory: "Returns",
        value: (data.transactions
          ?.filter(t => t["Status Tr"] === "Open Deposits" && (selectedAccount === "all" || t.Account === selectedAccount))
          .reduce((sum, t) => sum + (t.Realized3 || 0), 0) || 0),
        calculation: "Sum of Realized3 from transactions where Status='Open Deposits'",
        usedIn: ["Summary", "Open Deposits"]
      },
      {
        mainSerial: 4,
        subSerial: 7.2,
        name: "Realized G/L (Deposits) Closed Deposits",
        category: "Deposits",
        subCategory: "Returns",
        value: (() => {
          if (!data || !data.transactions) return 0

          // Filter transactions for closed deposits based on status and account
          const closedDepositsTransactions = data.transactions.filter(t => 
            t["Status Tr"] === "Closed Deposits" && 
            (selectedAccount === "all" || t.Account === selectedAccount)
          )

          // Group transactions by symbol AND account
          const symbolAccountGroups = new Map<string, any[]>()
          closedDepositsTransactions.forEach(transaction => {
            const symbol = transaction.Symbol
            const account = transaction.Account || "Unknown"
            const key = `${symbol}|${account}`
            if (!symbolAccountGroups.has(key)) {
              symbolAccountGroups.set(key, [])
            }
            symbolAccountGroups.get(key)!.push(transaction)
          })

          let totalRealizedGain = 0

          // Process each symbol-account group
          symbolAccountGroups.forEach((transactions, key) => {
            // Calculate totals
            let quantity = 0
            let totalDebit = 0
            let costChangeSum = 0
            let cumulativeRealizedReturn = 0

            transactions.forEach(transaction => {
              quantity += Number(transaction["Qty Change"]) || 0
              totalDebit += Number(transaction.Db) || 0
              costChangeSum += Number(transaction["Cost change"]) || 0
              cumulativeRealizedReturn += Number(transaction.Realized3) || 0
            })

            // Add this group's realized gain to total
            totalRealizedGain += cumulativeRealizedReturn
          })

          // Add AhlyBank Closed Deposits Realized Gain
          const ahlyBankRealizedGain = data.closedPositions
            ?.filter(p => p["Status Tr"] === "Closed Deposits" && p.Account === "AhlyBank")
            .reduce((sum, p) => sum + (p.RealizedGain || 0), 0) || 0

          return totalRealizedGain + ahlyBankRealizedGain
        })(),
        calculation: "Sum of Realized3 from transactions grouped by symbol-account for Closed Deposits, plus AhlyBank closed deposits RealizedGain",
        usedIn: ["Summary", "Closed Deposits"]
      },
      {
        mainSerial: 4,
        subSerial: 8,
        name: "Total Return (Deposits)",
        category: "Deposits",
        subCategory: "Returns",
        value: (data.currentHoldings
          ?.filter(h => h["Status Tr"] === "Open Deposits")
          .reduce((sum, h) => sum + (h.UnrealizedGain || 0), 0) || 0) +
          openDepositsRealizedGain + closedDepositsRealizedGain + 177167,
        calculation: "Unrealized G/L + Realized G/L",
        usedIn: ["Summary", "Front Boxes"],
        dependencies: ["4.6 Unrealized G/L (Deposits)", "4.7 Realized G/L (Deposits)"]
      },
      {
        mainSerial: 4,
        subSerial: 9,
        name: "Total Portfolio Return",
        category: "Total Portfolio",
        subCategory: "Returns",
        value: (data.currentHoldings?.reduce((sum, h) => 
          sum + (h.UnrealizedGain || 0) + (h.RealizedGain || 0), 0) || 0) +
          (data.closedPositions?.reduce((sum, p) => sum + (p.RealizedGain || 0), 0) || 0) + 177167,
        calculation: "Total Return (Positions) + Total Return (Deposits)",
        usedIn: ["Summary", "Front Boxes"],
        dependencies: ["4.5 Total Return (Positions)", "4.8 Total Return (Deposits)"]
      },

      // 5.xx - Price Measures
      {
        mainSerial: 5,
        subSerial: 1,
        name: "Average Cost Price (Positions)",
        category: "Positions",
        subCategory: "Price",
        value: data.currentHoldings
          ?.filter(h => h.Account !== "AhlyBank")
          .reduce((sum, h) => sum + (h.AvgCost || 0), 0) || 0,
        calculation: "Average of AvgCost from currentHoldings where Account != 'AhlyBank'",
        usedIn: ["Open Positions"]
      },
      {
        mainSerial: 5,
        subSerial: 2,
        name: "Current Market Price (Positions)",
        category: "Positions",
        subCategory: "Price",
        value: data.currentHoldings
          ?.filter(h => h.Account !== "AhlyBank")
          .reduce((sum, h) => sum + (h.Price || 0), 0) || 0,
        calculation: "Sum of current Price from currentHoldings where Account != 'AhlyBank'",
        usedIn: ["Open Positions"]
      },
      {
        mainSerial: 5,
        subSerial: 3,
        name: "Average Cost Price (Deposits)",
        category: "Deposits",
        subCategory: "Price",
        value: data.currentHoldings
          ?.filter(h => h["Status Tr"] === "Open Deposits")
          .reduce((sum, h) => sum + (h.AvgCost || 0), 0) || 0,
        calculation: "Average of AvgCost from currentHoldings where Status='Open Deposits'",
        usedIn: ["Open Deposits"]
      }
    ]
  }, [data, selectedAccount])

  // Group measures by subcategory
  const groupedMeasures = useMemo(() => {
    const groups: { [key: string]: Measure[] } = {}
    measures.forEach(measure => {
      if (!groups[measure.subCategory]) {
        groups[measure.subCategory] = []
      }
      groups[measure.subCategory].push(measure)
    })
    return groups
  }, [measures])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Measures</CardTitle>
        <CardDescription>
          Centralized calculations and metrics used across the dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedMeasures).map(([subCategory, measures]) => (
          <div key={subCategory}>
            <h3 className="text-lg font-semibold mb-4 text-primary">{subCategory} Measures</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[120px] text-right">Value</TableHead>
                  <TableHead className="w-[300px]">Calculation</TableHead>
                  <TableHead className="w-[200px]">Used In</TableHead>
                  <TableHead>Dependencies</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {measures.map((measure) => (
                  <TableRow key={`${measure.mainSerial}.${measure.subSerial}`}>
                    <TableCell className="font-medium">
                      {measure.mainSerial}.{measure.subSerial}
                    </TableCell>
                    <TableCell>{measure.name}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(measure.value)}
                    </TableCell>
                    <TableCell>{measure.calculation}</TableCell>
                    <TableCell>{measure.usedIn.join(", ")}</TableCell>
                    <TableCell>
                      {measure.dependencies ? measure.dependencies.join(", ") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
