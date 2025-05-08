"use client"

import { useMemo } from "react"
import type { PortfolioData } from "@/lib/data-processor"

// Define types for metrics
interface MetricsObject {
  totalValue: number
  cashBalance: number
  unrealizedGain: number
  realizedGain: number
  totalReturn: number
  totalCost: number
}

export const useMetrics = () => {
  const calculateMetrics = (
    data: PortfolioData,
    selectedAccount: string,
  ): { positions: MetricsObject; deposits: MetricsObject } => {
    // Default empty metrics object
    const defaultMetrics: MetricsObject = {
      totalValue: 0,
      cashBalance: 0,
      unrealizedGain: 0,
      realizedGain: 0,
      totalReturn: 0,
      totalCost: 0,
    }

    if (!data) return { positions: defaultMetrics, deposits: defaultMetrics }

    // 1. Positions Metrics (excluding AhlyBank and deposits)
    const currentHoldings =
      data.currentHoldings?.filter(
        (h) => h.Account !== "AhlyBank" && (selectedAccount === "all" || h.Account === selectedAccount),
      ) || []

    const closedPositions =
      data.closedPositions?.filter(
        (p) =>
          p.Account !== "AhlyBank" &&
          p["Status Tr"] !== "Open Deposits" &&
          p["Status Tr"] !== "Closed Deposits" &&
          (selectedAccount === "all" || p.Account === selectedAccount),
      ) || []

    const positionsCashBalance =
      selectedAccount === "all"
        ? data.accounts
            ?.filter((acc) => acc.name !== "AhlyBank")
            .reduce((sum, acc) => sum + (acc.summaryMetrics?.cashBalance || 0), 0) || 0
        : selectedAccount !== "AhlyBank"
          ? data.accounts?.find((acc) => acc.name === selectedAccount)?.summaryMetrics?.cashBalance || 0
          : 0

    const positionsMetrics: MetricsObject = {
      totalValue: Math.round(currentHoldings.reduce((sum, h) => sum + h.Value, 0) + positionsCashBalance),
      cashBalance: Math.round(positionsCashBalance),
      unrealizedGain: Math.round(currentHoldings.reduce((sum, h) => sum + (h.UnrealizedGain || 0), 0)),
      realizedGain: Math.round(
        currentHoldings.reduce((sum, h) => sum + (h.RealizedGain || 0), 0) +
          closedPositions.reduce((sum, p) => sum + (p.RealizedGain || 0), 0),
      ),
      totalCost: Math.round(
        currentHoldings.reduce((sum, h) => sum + Math.abs(h.Cost || 0), 0) +
          closedPositions.reduce((sum, p) => sum + Math.abs(p.TotalCost || 0), 0),
      ),
      totalReturn: 0,
    }
    positionsMetrics.totalReturn = positionsMetrics.unrealizedGain + positionsMetrics.realizedGain

    // 2. Deposits Metrics (including AhlyBank)
    const openDepositsTransactions =
      data.transactions?.filter(
        (t) =>
          (t["Status Tr"] === "Open Deposits" || t.Account === "AhlyBank") &&
          (selectedAccount === "all" || t.Account === selectedAccount),
      ) || []

    const ahlyBankCash =
      selectedAccount === "all" || selectedAccount === "AhlyBank"
        ? data.accounts?.find((acc) => acc.name === "AhlyBank")?.summaryMetrics?.cashBalance || 0
        : 0

    const openDeposits =
      data.currentHoldings?.filter(
        (h) =>
          (h["Status Tr"] === "Open Deposits" || h.Account === "AhlyBank") &&
          (selectedAccount === "all" || h.Account === selectedAccount),
      ) || []

    const depositsMetrics: MetricsObject = {
      totalValue: Math.round(openDeposits.reduce((sum, h) => sum + (h.Value || 0), 0) + ahlyBankCash),
      cashBalance: Math.round(ahlyBankCash),
      unrealizedGain: Math.round(openDeposits.reduce((sum, h) => sum + (h.UnrealizedGain || 0), 0)),
      realizedGain: Math.round(
        openDepositsTransactions.reduce((sum, t) => sum + (t.Realized3 || 0), 0) +
          (data.closedPositions
            ?.filter((p) => p["Status Tr"] === "Closed Deposits" && p.Account === "AhlyBank")
            .reduce((sum, p) => sum + (p.RealizedGain || 0), 0) || 0),
      ),
      totalCost: Math.round(openDeposits.reduce((sum, h) => sum + Math.abs(h.TotalCost || 0), 0)),
      totalReturn: 0,
    }
    depositsMetrics.totalReturn = depositsMetrics.unrealizedGain + depositsMetrics.realizedGain

    return { positions: positionsMetrics, deposits: depositsMetrics }
  }

  return (data: PortfolioData, selectedAccount: string) => {
    return useMemo(() => calculateMetrics(data, selectedAccount), [data, selectedAccount])
  }
}
