import Papa from "papaparse"

// Define types for our data
export interface Transaction {
  TransID: string
  "Status Tr": string
  Symbol: string
  Account: string
  Date: string
  TransSubType: string
  Qty: number
  "Avg. Cost": number
  "Net Price": number
  "Net Amount": number
  "Cash sign": number
  "Cash Impact": number
  "Cash \nBalance": number
  TransTypeSerial: string
  "Qty sign": number
  "Qty Change": number
  "Qty Balance": number
  "Cost sign": number
  "Cost change": number
  "Cost balance": string
  Realized3: number
  "Cost after Realizd": number
  Symbolid: string
  Sh_name_eng: string
  Db: number
  [key: string]: any
}

export interface TransactionType {
  TransTypeSerial: string
  TransType: string
  "Qty sign": string
  "Cash sign": string
  "Cost sign": string
  "Recogniz Profit": string
  [key: string]: any
}

export interface Symbol {
  Symbol: string
  Sh_name_eng: string
  Sector: string
  "Symbol Group": string
  [key: string]: any
}

export interface Quote {
  Date: string
  Close: number
  Symbol: string
  [key: string]: any
}

export interface Holding {
  Symbol: string
  Name: string
  Sector: string
  Account: string
  Status?: string
  "Status Tr"?: string
  Quantity: number
  AvgCost: number
  Price: number
  Value: number
  Cost: number
  TotalCost: number
  UnrealizedGain: number
  UnrealizedGainPct: number
  RealizedGain: number
  RealizedGainPct?: number
  TotalReturn: number
  TotalReturnPct: number
  Db?: number
  cashBalance: number
}

// Modify the PortfolioData interface to include latestQuotes
export interface PortfolioData {
  accounts: {
    name: string
    currentHoldings: Holding[]
    closedPositions: Holding[]
    timeSeriesData: any[]
    summaryMetrics: {
      totalValue: number
      cashBalance: number
      equityValue: number
      realizedGain: number
      unrealizedGain: number
    }
  }[]
  currentHoldings: Holding[]
  closedPositions: Holding[]
  timeSeriesData: any[]
  transactions: Transaction[]
  summaryMetrics: {
    totalValue: number
    cashBalance: number
    equityValue: number
    realizedGain: number
    unrealizedGain: number
  }
  quotes?: Quote[]
  latestQuotes?: Map<string, Quote> // Add this line
}

export interface TimeSeriesDataPoint {
  date: string
  totalValue: number
  cashValue: number
  equityValue: number
  egx30: number
  realizedGain: number
  unrealizedGain: number
  accountValues: Record<string, number>
  hasQuotes?: boolean
}

// Parse CSV data
function parseCSV(csvText: string): any[] {
  try {
    const result = Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    })
    return result.data
  } catch (error) {
    console.error("Error parsing CSV:", error)
    return []
  }
}

// Standardize date format to YYYY-MM-DD
function standardizeDate(dateStr: string): string {
  try {
    // Try different date formats
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0]
    }

    // Try MM/DD/YYYY format
    const parts = dateStr.split(/[/-]/)
    if (parts.length === 3) {
      // Try different arrangements of parts
      const arrangements = [
        `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`, // MM/DD/YYYY
        `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`, // DD/MM/YYYY
      ]

      for (const arrangement of arrangements) {
        const parsed = new Date(arrangement)
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split("T")[0]
        }
      }
    }

    console.warn(`Could not standardize date: ${dateStr}`)
    return dateStr
  } catch (error) {
    console.error(`Error standardizing date ${dateStr}:`, error)
    return dateStr
  }
}

// Process all portfolio data
export async function processPortfolioData(
  transactionsText: string,
  symbolsText: string,
  quotesText: string,
  logFunction: (message: string) => void,
  selectedAccount: string,
): Promise<PortfolioData> {
  try {
    // Validate input parameters
    if (!transactionsText || !symbolsText || !quotesText) {
      const error = new Error("Missing required CSV data")
      logFunction("Error: Missing required CSV data")
      console.error(error)
      throw error
    }

    // Parse CSV files
    logFunction("Parsing transactions data...")
    const transactions = parseCSV(transactionsText) as Transaction[]

    logFunction("Parsing symbols data...")
    const symbols = parseCSV(symbolsText) as Symbol[]

    logFunction("Parsing quotes data...")
    const quotes = parseCSV(quotesText) as Quote[]

    // Standardize dates in transactions and quotes
    transactions.forEach((t) => {
      if (t.Date) {
        t.Date = standardizeDate(t.Date)
      }
    })

    quotes.forEach((q) => {
      if (q.Date) {
        q.Date = standardizeDate(q.Date)
      }
    })

    // Log date ranges
    if (transactions.length > 0) {
      const transactionDates = transactions
        .map((t) => t.Date)
        .filter(Boolean)
        .sort()
      logFunction(`Transaction date range: ${transactionDates[0]} to ${transactionDates[transactionDates.length - 1]}`)
    }

    if (quotes.length > 0) {
      const quoteDates = quotes
        .map((q) => q.Date)
        .filter(Boolean)
        .sort()
      logFunction(`Quote date range: ${quoteDates[0]} to ${quoteDates[quoteDates.length - 1]}`)
    }

    // Create lookup maps for faster access
    const symbolMap = new Map<string, Symbol>()
    symbols.forEach((symbol) => {
      symbolMap.set(symbol.Symbol, symbol)
    })

    // Get latest quotes for each symbol
    const latestQuotes = new Map<string, Quote>()
    quotes.forEach((quote) => {
      const existing = latestQuotes.get(quote.Symbol)
      if (!existing || new Date(quote.Date) > new Date(existing.Date)) {
        latestQuotes.set(quote.Symbol, quote)
      }
    })

    // Create a set of dates that have quotes
    const quoteDates = new Set<string>()
    quotes.forEach((quote) => {
      if (quote.Date) {
        quoteDates.add(quote.Date)
      }
    })

    // Get unique accounts and group transactions by account in a single pass
    const accountTransactionsMap = new Map<string, Transaction[]>()
    transactions.forEach((t) => {
      const account = t.Account?.trim()
      if (account && account !== "all" && account !== "All Accounts") {
        if (!accountTransactionsMap.has(account)) {
          accountTransactionsMap.set(account, [])
        }
        accountTransactionsMap.get(account)!.push(t)
      }
    })

    const uniqueAccounts = Array.from(accountTransactionsMap.keys()).sort()
    logFunction(`Found ${uniqueAccounts.length} unique accounts: ${uniqueAccounts.join(", ")}`)

    // Process data for each account
    const accountsData = await Promise.all(
      uniqueAccounts.map(async (account) => {
        const accountTransactions = accountTransactionsMap.get(account) || []

        // Split transactions by status in a single pass
        const transactionsByStatus = accountTransactions.reduce(
          (acc, t) => {
            const status = t["Status Tr"]
            if (status === "Open Items") {
              acc.open.push(t)
            } else if (
              status === "YTD Clear" ||
              status === "PYD Clear" ||
              status === "Cleared-RE" ||
              status === "Cleared" ||
              status === "Clered -RE" ||
              status === "Time Deposit" // Include Time Deposit status for unrealized gain calculation
            ) {
              acc.closed.push(t)
            }
            return acc
          },
          { open: [] as Transaction[], closed: [] as Transaction[] },
        )

        // Process holdings
        const currentHoldings = processHoldings(transactionsByStatus.open, symbolMap, latestQuotes, "Open Items", false)
        const closedPositions = processHoldings(transactionsByStatus.closed, symbolMap, latestQuotes, undefined, true)

        // Include Time Deposit positions in unrealized gain calculation
        const timeDepositPositions = accountTransactions
          .filter((t) => t["Status Tr"] === "Time Deposit")
          .reduce((acc, t) => {
            const key = `${t.Symbol}-${t.Account}`
            if (!acc.has(key)) {
              acc.set(key, [])
            }
            acc.get(key)!.push(t)
            return acc
          }, new Map<string, Transaction[]>())

        const timeDepositHoldings = processHoldings(
          Array.from(timeDepositPositions.values()).flat(),
          symbolMap,
          latestQuotes,
          "Time Deposit",
          false,
        )

        // Process time series data
        const timeSeriesData = processTimeSeriesData(
          accountTransactions,
          quotes,
          quoteDates,
          account,
          latestQuotes, // Pass latestQuotes to use for missing prices
        )

        // Calculate metrics for this account
        const cashBalance = accountTransactions.reduce((total, t) => total + (Number(t["Cash Impact"]) || 0), 0)
        const equityValue = currentHoldings.reduce((sum, h) => sum + h.Value, 0)

        // Include Time Deposit positions in unrealized gain calculation
        const unrealizedGain =
          currentHoldings.reduce((sum, h) => sum + h.UnrealizedGain, 0) +
          timeDepositHoldings.reduce((sum, h) => sum + h.UnrealizedGain, 0)

        const realizedGain = closedPositions.reduce((sum, h) => sum + h.RealizedGain, 0)

        return {
          name: account,
          currentHoldings,
          closedPositions,
          timeSeriesData,
          summaryMetrics: {
            totalValue: equityValue + cashBalance,
            cashBalance,
            equityValue,
            realizedGain,
            unrealizedGain,
          },
        }
      }),
    )

    // Handle "all" accounts view
    let allCurrentHoldings: Holding[] = []
    let allClosedPositions: Holding[] = []
    let allTimeSeriesData: any[] = []
    let totalCashBalance = 0,
      totalEquityValue = 0,
      totalRealizedGain = 0,
      totalUnrealizedGain = 0

    if (selectedAccount === "all") {
      // Aggregate all accounts data
      allCurrentHoldings = accountsData.flatMap((acc) => acc.currentHoldings)
      allClosedPositions = accountsData.flatMap((acc) => acc.closedPositions)
      allTimeSeriesData = mergeTimeSeriesData(accountsData.map((acc) => acc.timeSeriesData))

      // Sum up metrics from all accounts
      totalCashBalance = accountsData.reduce((sum, acc) => sum + acc.summaryMetrics.cashBalance, 0)
      totalEquityValue = accountsData.reduce((sum, acc) => sum + acc.summaryMetrics.equityValue, 0)
      totalRealizedGain = accountsData.reduce((sum, acc) => sum + acc.summaryMetrics.realizedGain, 0)
      totalUnrealizedGain = accountsData.reduce((sum, acc) => sum + acc.summaryMetrics.unrealizedGain, 0)
    } else {
      // Use data from selected account
      const selectedAccountData = accountsData.find((acc) => acc.name === selectedAccount)
      if (selectedAccountData) {
        allCurrentHoldings = selectedAccountData.currentHoldings
        allClosedPositions = selectedAccountData.closedPositions
        allTimeSeriesData = selectedAccountData.timeSeriesData
        totalCashBalance = selectedAccountData.summaryMetrics.cashBalance
        totalEquityValue = selectedAccountData.summaryMetrics.equityValue
        totalRealizedGain = selectedAccountData.summaryMetrics.realizedGain
        totalUnrealizedGain = selectedAccountData.summaryMetrics.unrealizedGain
      } else {
        // Fallback to empty data if account not found
        allCurrentHoldings = []
        allClosedPositions = []
        allTimeSeriesData = []
        totalCashBalance = 0
        totalEquityValue = 0
        totalRealizedGain = 0
        totalUnrealizedGain = 0
      }
    }

    // Return complete portfolio data
    return {
      accounts: accountsData,
      currentHoldings: allCurrentHoldings,
      closedPositions: allClosedPositions,
      timeSeriesData: allTimeSeriesData,
      transactions: transactions,
      quotes: quotes,
      latestQuotes: latestQuotes,
      summaryMetrics: {
        totalValue: totalEquityValue + totalCashBalance,
        cashBalance: totalCashBalance,
        equityValue: totalEquityValue,
        realizedGain: totalRealizedGain,
        unrealizedGain: totalUnrealizedGain,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logFunction(`Error in processPortfolioData: ${errorMessage}`)
    console.error("Error processing portfolio data:", error)

    if (error instanceof Error && error.stack) {
      logFunction(`Stack trace: ${error.stack}`)
    }

    // Return empty data structure to prevent app from crashing
    return {
      accounts: [],
      currentHoldings: [],
      closedPositions: [],
      timeSeriesData: [],
      transactions: [],
      summaryMetrics: {
        totalValue: 0,
        cashBalance: 0,
        equityValue: 0,
        realizedGain: 0,
        unrealizedGain: 0,
      },
    }
  }
}

// Helper function to merge time series data from multiple accounts
export function mergeTimeSeriesData(timeSeriesDataArray: any[][]): any[] {
  if (timeSeriesDataArray.length === 0) return []

  // Get all unique dates
  const allDates = new Set<string>()
  timeSeriesDataArray.forEach((series) => {
    series.forEach((entry) => allDates.add(entry.date))
  })

  // Sort dates
  const sortedDates = Array.from(allDates).sort()

  // Merge data for each date
  return sortedDates.map((date) => {
    const mergedEntry = {
      date,
      cashValue: 0,
      equityValue: 0,
      totalValue: 0,
      realizedGain: 0,
      unrealizedGain: 0,
      egx30: 0,
      hasQuotes: false,
      accountValues: {} as Record<string, number>,
    }

    timeSeriesDataArray.forEach((series, index) => {
      const entry = series.find((e) => e.date === date)
      if (entry) {
        mergedEntry.cashValue += entry.cashValue || 0
        mergedEntry.equityValue += entry.equityValue || 0
        mergedEntry.totalValue += entry.totalValue || 0
        mergedEntry.realizedGain += entry.realizedGain || 0
        mergedEntry.unrealizedGain += entry.unrealizedGain || 0
        mergedEntry.egx30 = entry.egx30 || mergedEntry.egx30 // Use any non-zero value
        mergedEntry.hasQuotes = mergedEntry.hasQuotes || entry.hasQuotes

        // Store individual account values
        if (entry.account) {
          mergedEntry.accountValues[entry.account] = entry.totalValue
        }
      }
    })

    return mergedEntry
  })
}

// Process holdings using the corrected calculation method for closed positions
function processHoldings(
  transactions: Transaction[],
  symbolMap: Map<string, Symbol>,
  latestQuotes: Map<string, Quote>,
  statusType?: string,
  includeZeroQuantity = false,
): Holding[] {
  try {
    const holdings: Holding[] = []
    // Group transactions by symbol AND account
    const symbolAccountGroups = new Map<string, Transaction[]>()

    // Calculate total cash balance
    const cashBalance = transactions.reduce((total, t) => {
      // Only include cash impact from non-Time Deposit transactions
      if (t["Status Tr"] !== "Time Deposit") {
        return total + (Number(t["Cash Impact"]) || 0)
      }
      return total
    }, 0)

    transactions.forEach((transaction) => {
      const symbol = transaction.Symbol
      const account = transaction.Account || "Unknown"
      const key = `${symbol}-${account}`

      if (!symbolAccountGroups.has(key)) {
        symbolAccountGroups.set(key, [])
      }
      symbolAccountGroups.get(key)!.push(transaction)
    })

    // Process each symbol-account group
    symbolAccountGroups.forEach((transactions, key) => {
      const [symbol, account] = key.split("-")
      // Sort transactions by date
      transactions.sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime())

      // Calculate totals using the new approach
      let quantity = 0
      let totalDebit = 0
      let costChangeSum = 0
      let cumulativeRealizedReturn = 0
      let openCost = 0 // Will be costChangeSum + cumulativeRealizedReturn

      transactions.forEach((transaction) => {
        // Qty Change already includes the sign effect
        quantity += Number(transaction["Qty Change"]) || 0

        // Sum up total debit (Db) for total cost
        totalDebit += Number(transaction.Db) || 0

        // Keep track of cost changes and realized gains
        costChangeSum += Number(transaction["Cost change"]) || 0
        cumulativeRealizedReturn += Number(transaction.Realized3) || 0
      })

      // Calculate OpenCost as per DAX formula
      openCost = costChangeSum + cumulativeRealizedReturn

      // Get symbol information
      const symbolInfo = symbolMap.get(symbol) || {
        Symbol: symbol,
        Sh_name_eng: symbol,
        Sector: "Unknown",
      }

      // Get latest quote
      const quote = latestQuotes.get(symbol)
      const price = quote ? quote.Close : 0

      // Calculate value and returns
      const value = quantity * price

      // For closed positions, Total Return should equal Realized Gain
      // For open positions, add unrealized gain
      const unrealizedGain = includeZeroQuantity ? 0 : value - openCost
      const totalReturn = includeZeroQuantity ? cumulativeRealizedReturn : cumulativeRealizedReturn + unrealizedGain

      // Calculate percentages using absolute total debit
      const absDebit = Math.abs(totalDebit)
      const totalReturnPct = absDebit !== 0 ? (totalReturn / absDebit) * 100 : 0
      const unrealizedGainPct = absDebit !== 0 ? (unrealizedGain / absDebit) * 100 : 0
      const realizedGainPct = absDebit !== 0 ? (cumulativeRealizedReturn / absDebit) * 100 : 0

      // Normalize status name
      let displayStatus = statusType
      if (statusType === "Cleared-RE" || statusType === "Clered -RE") {
        displayStatus = "Cleared"
      }

      if (includeZeroQuantity || Math.abs(quantity) > 0.0001) {
        const holding: Holding = {
          Symbol: symbol,
          Account: account,
          Name: symbolInfo.Sh_name_eng || symbol,
          Sector: symbolInfo.Sector || "Unknown",
          Status: displayStatus || transactions[0]["Status Tr"],
          Quantity: quantity,
          Cost: openCost, // Use OpenCost here
          TotalCost: costChangeSum, // This is the total cost without realized return
          AvgCost: Math.abs(quantity) > 0.0001 ? Math.abs(openCost / quantity) : 0,
          Price: price,
          Value: value,
          UnrealizedGain: unrealizedGain,
          UnrealizedGainPct: unrealizedGainPct,
          RealizedGain: cumulativeRealizedReturn,
          RealizedGainPct: realizedGainPct,
          TotalReturn: totalReturn,
          TotalReturnPct: totalReturnPct,
          Db: totalDebit, // Add the aggregated Db field
          cashBalance,
        }

        holdings.push(holding)
      }
    })

    return holdings.map((holding) => ({
      ...holding,
      cashBalance, // Add cash balance to each holding
    }))
  } catch (error) {
    console.error("Error processing holdings:", error)
    return []
  }
}

// Process time series data for performance chart
function processTimeSeriesData(
  transactions: Transaction[],
  quotes: Quote[],
  quoteDates: Set<string>,
  selectedAccount = "all",
  latestQuotes: Map<string, Quote> = new Map(),
): any[] {
  try {
    console.log(`Processing time series data for account: ${selectedAccount}`)
    console.log(`Transactions: ${transactions.length}, Quotes: ${quotes.length}`)

    // Log the date range of quotes
    if (quotes.length > 0) {
      const quoteDates = quotes
        .map((q) => q.Date)
        .filter(Boolean)
        .sort()
      console.log(`Quotes date range: ${quoteDates[0]} to ${quoteDates[quoteDates.length - 1]}`)

      // Count quotes by date to check distribution
      const quotesByDate = quotes.reduce(
        (acc, q) => {
          if (!q.Date) return acc
          acc[q.Date] = (acc[q.Date] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      const dateCount = Object.keys(quotesByDate).length
      console.log(`Quotes cover ${dateCount} unique dates`)
    }

    // Filter transactions by account if a specific account is selected
    const accountTransactions =
      selectedAccount === "all" ? transactions : transactions.filter((t) => t.Account === selectedAccount)

    console.log(`Filtered transactions for account ${selectedAccount}: ${accountTransactions.length}`)

    // Get all unique dates from transactions
    const transactionDates = new Set<string>()
    accountTransactions.forEach((t) => {
      if (t.Date) {
        transactionDates.add(t.Date)
      }
    })
    console.log(`Unique transaction dates: ${transactionDates.size}`)

    // Get all unique dates from quotes
    const uniqueQuoteDates = new Set<string>()
    quotes.forEach((q) => {
      if (q.Date) {
        uniqueQuoteDates.add(q.Date)
      }
    })
    console.log(`Unique quote dates: ${uniqueQuoteDates.size}`)

    // Combine all dates
    const allDates = new Set<string>([...transactionDates, ...uniqueQuoteDates])
    console.log(`Total unique dates: ${allDates.size}`)

    // Create a map for EGX30 values by date
    const egx30Map = new Map<string, number>()
    quotes.forEach((q) => {
      if (q.Symbol === "EGX30" && q.Date && q.Close > 0) {
        egx30Map.set(q.Date, q.Close)
      }
    })
    console.log(`EGX30 dates: ${egx30Map.size}`)

    // Create a map for quotes by date and symbol
    const quotesByDateAndSymbol = new Map<string, Map<string, number>>()
    quotes.forEach((q) => {
      if (q.Date && q.Symbol) {
        if (!quotesByDateAndSymbol.has(q.Date)) {
          quotesByDateAndSymbol.set(q.Date, new Map<string, number>())
        }
        quotesByDateAndSymbol.get(q.Date)!.set(q.Symbol, q.Close)
      }
    })

    // Get all symbols that need prices
    const symbolsSet = new Set<string>()
    accountTransactions.forEach((t) => {
      if (t.Symbol && !["Deposit", "DEPOSIT", "Cash", "CASH", "Expenses", "EXPENSES", ""].includes(t.Symbol)) {
        symbolsSet.add(t.Symbol)
      }
    })
    console.log(`Unique symbols that need prices: ${symbolsSet.size}`)

    // Sort dates
    const sortedDates = Array.from(allDates).sort()
    console.log(`First date: ${sortedDates[0]}, Last date: ${sortedDates[sortedDates.length - 1]}`)

    // Initialize time series data
    const timeSeriesData: any[] = []

    // Track portfolio state over time
    let cashBalance = 0
    const holdings = new Map<
      string,
      {
        quantity: number
        costChangeSum: number
        cumulativeRealizedReturn: number
        totalDebit: number
        lastKnownPrice: number // Add lastKnownPrice to track the last valid price for each symbol
      }
    >()
    let totalRealizedGain = 0

    // Track time deposit positions separately
    const timeDepositHoldings = new Map<
      string,
      {
        quantity: number
        costChangeSum: number
        cumulativeRealizedReturn: number
        totalDebit: number
        lastKnownPrice: number
      }
    >()

    // Process each date
    let lastValidEquityValue = 0
    let lastValidEgx30Value = 0
    let lastValidUnrealizedGain = 0
    let lastValidTotalValue = 0
    let dataPointsWithQuotes = 0

    sortedDates.forEach((date) => {
      // Get transactions for this date
      const dateTransactions = accountTransactions.filter((t) => t.Date === date)

      // Process transactions
      dateTransactions.forEach((transaction) => {
        cashBalance += Number(transaction["Cash Impact"]) || 0

        const realizedGainChange = Number(transaction.Realized3) || 0
        totalRealizedGain += realizedGainChange

        if (
          transaction.Symbol &&
          !["Deposit", "DEPOSIT", "Cash", "CASH", "Expenses", "EXPENSES", ""].includes(transaction.Symbol)
        ) {
          const symbol = transaction.Symbol
          const qtyChange = Number(transaction["Qty Change"]) || 0
          const costChange = Number(transaction["Cost change"]) || 0
          const debitChange = Number(transaction.Db) || 0
          const status = transaction["Status Tr"]

          // Determine if this is a time deposit transaction
          const isTimeDeposit = status === "Time Deposit"
          const holdingsMap = isTimeDeposit ? timeDepositHoldings : holdings

          const currentHolding = holdingsMap.get(symbol) || {
            quantity: 0,
            costChangeSum: 0,
            cumulativeRealizedReturn: 0,
            totalDebit: 0,
            lastKnownPrice: 0,
          }

          currentHolding.quantity += qtyChange
          currentHolding.costChangeSum += costChange
          currentHolding.cumulativeRealizedReturn += realizedGainChange
          currentHolding.totalDebit += debitChange

          if (Math.abs(currentHolding.quantity) < 0.0001) {
            holdingsMap.delete(symbol)
          } else {
            holdingsMap.set(symbol, currentHolding)
          }
        }
      })

      // Calculate equity value and unrealized gain
      let equityValue = 0
      let unrealizedGain = 0
      let timeDepositUnrealizedGain = 0
      let hasAllPrices = true
      const missingSymbols = []

      // Get quotes for this date
      const datePrices = quotesByDateAndSymbol.get(date)

      // Process regular holdings
      holdings.forEach((holding, symbol) => {
        let price = 0

        if (datePrices && datePrices.has(symbol) && datePrices.get(symbol)! > 0) {
          // Use price from this date if available
          price = datePrices.get(symbol)!
          holding.lastKnownPrice = price // Update last known price
        } else if (holding.lastKnownPrice > 0) {
          // Use last known price if we have one
          price = holding.lastKnownPrice
          hasAllPrices = false
          missingSymbols.push(symbol)
        } else if (latestQuotes.has(symbol)) {
          // Use latest quote as fallback
          price = latestQuotes.get(symbol)!.Close
          holding.lastKnownPrice = price // Update last known price
          hasAllPrices = false
          missingSymbols.push(symbol)
        }

        if (price > 0) {
          const value = holding.quantity * price
          equityValue += value

          // Calculate OpenCost and unrealized gain
          const openCost = holding.costChangeSum + holding.cumulativeRealizedReturn
          const symbolUnrealizedGain = value - openCost
          unrealizedGain += symbolUnrealizedGain
        } else {
          hasAllPrices = false
          missingSymbols.push(symbol)
        }
      })

      // Process time deposit holdings
      timeDepositHoldings.forEach((holding, symbol) => {
        let price = 0

        if (datePrices && datePrices.has(symbol) && datePrices.get(symbol)! > 0) {
          price = datePrices.get(symbol)!
          holding.lastKnownPrice = price
        } else if (holding.lastKnownPrice > 0) {
          price = holding.lastKnownPrice
        } else if (latestQuotes.has(symbol)) {
          price = latestQuotes.get(symbol)!.Close
          holding.lastKnownPrice = price
        }

        if (price > 0) {
          const value = holding.quantity * price
          equityValue += value

          // Calculate OpenCost and unrealized gain for time deposits
          const openCost = holding.costChangeSum + holding.cumulativeRealizedReturn
          const symbolUnrealizedGain = value - openCost
          timeDepositUnrealizedGain += symbolUnrealizedGain
        }
      })

      // If we don't have all prices or equity value is zero, use the last valid values
      if ((!hasAllPrices || equityValue === 0) && lastValidEquityValue > 0) {
        equityValue = lastValidEquityValue
        unrealizedGain = lastValidUnrealizedGain
      } else if (equityValue > 0) {
        lastValidEquityValue = equityValue
        lastValidUnrealizedGain = unrealizedGain
      }

      // Get EGX30 value for this date
      const egx30Value = egx30Map.get(date)
      const hasValidEGX30 = egx30Value !== undefined && egx30Value > 0

      if (hasValidEGX30) {
        lastValidEgx30Value = egx30Value!
      }

      // Calculate total unrealized gain (regular + time deposit)
      const totalUnrealizedGain = unrealizedGain + timeDepositUnrealizedGain

      // Update last valid unrealized gain if we have a valid value
      if (totalUnrealizedGain !== 0) {
        lastValidUnrealizedGain = totalUnrealizedGain
      }

      // Determine if we have quotes for this date
      const hasQuotes = datePrices && datePrices.size > 0

      if (hasQuotes) {
        dataPointsWithQuotes++
      }

      const totalValue = equityValue + cashBalance
      if (totalValue === 0 && lastValidTotalValue > 0) {
        // Use last valid total value to prevent drops
        timeSeriesData.push({
          date,
          cashValue: cashBalance,
          equityValue: lastValidEquityValue,
          totalValue: lastValidTotalValue,
          realizedGain: totalRealizedGain,
          unrealizedGain: lastValidUnrealizedGain,
          egx30: hasValidEGX30 ? egx30Value : lastValidEgx30Value,
          hasQuotes: hasQuotes,
          account: selectedAccount,
        })
      } else {
        lastValidTotalValue = totalValue
        timeSeriesData.push({
          date,
          cashValue: cashBalance,
          equityValue: equityValue,
          totalValue: totalValue,
          realizedGain: totalRealizedGain,
          unrealizedGain: totalUnrealizedGain,
          egx30: hasValidEGX30 ? egx30Value : lastValidEgx30Value,
          hasQuotes: hasQuotes,
          account: selectedAccount,
        })
      }
    })

    // Log date range information
    if (timeSeriesData.length > 0) {
      const firstDate = timeSeriesData[0].date
      const lastDate = timeSeriesData[timeSeriesData.length - 1].date
      console.log(`Time series data for ${selectedAccount} spans from ${firstDate} to ${lastDate}`)
      console.log(`Total data points: ${timeSeriesData.length}`)
      console.log(`Data points with quotes: ${dataPointsWithQuotes}`)
    }

    return timeSeriesData
  } catch (error) {
    console.error("Error processing time series data:", error)
    return []
  }
}

// Add these functions to your data-processor.ts file

export function exportProcessedData(portfolioData: PortfolioData): string {
  try {
    // Convert the entire portfolio data object to a JSON string
    const exportData = JSON.stringify(portfolioData)
    return exportData
  } catch (error) {
    console.error("Error exporting data:", error)
    return ""
  }
}

export function importProcessedData(jsonData: string): PortfolioData | null {
  try {
    // Parse the JSON string back to a portfolio data object
    const portfolioData = JSON.parse(jsonData) as PortfolioData
    return portfolioData
  } catch (error) {
    console.error("Error importing data:", error)
    return null
  }
}
