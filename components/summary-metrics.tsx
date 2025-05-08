import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SummaryMetricsProps {
  data: {
    summaryMetrics: {
      equityValue: number
      cashBalance: number
      totalValue: number
      unrealizedGain: number
      realizedGain: number
    }
    fixedIncomeValue?: number
    fixedIncomeCash?: number
  }
}

export default function SummaryMetrics({ data }: SummaryMetricsProps) {
  const formatNumber = (value: number) => {
    const roundedValue = Math.round(value)
    return roundedValue.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  }

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
      {/* First Column */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Holdings Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.summaryMetrics.equityValue)}</div>
            <p className="text-xs text-muted-foreground">Holdings + Cash</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance (Positions)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.summaryMetrics.cashBalance)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Second Column */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fixed Income Value zzz</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.fixedIncomeValue || 0)}</div>
            <p className="text-xs text-muted-foreground">Total Deposits Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Fixed Inc</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.fixedIncomeCash || 0)}</div>
            <p className="text-xs text-muted-foreground">AhlyBank Deposits</p>
          </CardContent>
        </Card>
      </div>

      {/* Third Column */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grand Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.summaryMetrics.totalValue)}</div>
            <p className="text-xs text-muted-foreground">Portfolio Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data.summaryMetrics.cashBalance + (data.fixedIncomeCash || 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Returns Section */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unrealized Gain/Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${82935 >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatNumber(82935)}
            </div>
            <p className="text-xs text-muted-foreground">8.82%</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Realized Gain/Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${577671 >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatNumber(577671)}
            </div>
            <p className="text-xs text-muted-foreground">31.35%</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gain/Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(82935 + 577671) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatNumber(82935 + 577671)}
            </div>
            <p className="text-xs text-muted-foreground">Realized + Unrealized</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
