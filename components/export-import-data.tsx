"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import type { PortfolioData } from "@/lib/data-processor"
import { processPortfolioData } from "@/lib/data-processor"

interface ExportImportProps {
  portfolioData: PortfolioData
  transactionsText: string
  symbolsText: string
  quotesText: string
  onDataImport: (data: PortfolioData) => void
}

export function ExportImportData({
  portfolioData,
  transactionsText,
  symbolsText,
  quotesText,
  onDataImport,
}: ExportImportProps) {
  // Function to handle data export
  const handleExport = () => {
    try {
      // Export the raw CSVs as text
      const jsonData = JSON.stringify(
        {
          transactionsText,
          symbolsText,
          quotesText,
        },
        null,
        2,
      )

      // Create a blob with the data
      const blob = new Blob([jsonData], { type: "application/json" })
      const url = URL.createObjectURL(blob)

      // Create a link and trigger download
      const a = document.createElement("a")
      a.href = url

      // Get the latest quote date from timeSeriesData
      let exportDate = ""
      if (portfolioData.timeSeriesData && portfolioData.timeSeriesData.length > 0) {
        const dates = portfolioData.timeSeriesData.map((entry) => entry.date).filter(Boolean)
        const sortedDates = [...dates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        if (sortedDates[0]) {
          exportDate = sortedDates[0]
        }
      }

      // Fallback to today's date if no time series data
      if (!exportDate) {
        const today = new Date()
        const yyyy = today.getFullYear()
        const mm = String(today.getMonth() + 1).padStart(2, "0")
        const dd = String(today.getDate()).padStart(2, "0")
        exportDate = `${yyyy}-${mm}-${dd}`
      }

      a.download = `Portfolio Data ${exportDate}.json`
      document.body.appendChild(a)
      a.click()

      // Clean up
      URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Data Exported Successfully",
        description: "Your portfolio data has been exported to a JSON file.",
      })
    } catch (error) {
      console.error("Export failed:", error)
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data.",
        variant: "destructive",
      })
    }
  }

  // Function to handle data import
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const jsonData = e.target?.result as string
          const importedData = JSON.parse(jsonData)

          // Validate the data structure
          if (!importedData.transactionsText || !importedData.symbolsText || !importedData.quotesText) {
            toast({
              title: "Import Failed",
              description: "The imported file is missing raw data.",
              variant: "destructive",
            })
            return
          }

          // Re-process the data using processPortfolioData
          const processed = await processPortfolioData(
            importedData.transactionsText,
            importedData.symbolsText,
            importedData.quotesText,
            () => {},
            "all",
          )
          onDataImport(processed)
          toast({
            title: "Data Imported Successfully",
            description: "Your portfolio data has been imported.",
          })
        } catch (error) {
          console.error("Error reading imported data:", error)
          toast({
            title: "Import Failed",
            description: "The file could not be processed.",
            variant: "destructive",
          })
        }
      }

      reader.readAsText(file)
    } catch (error) {
      console.error("Import failed:", error)
      toast({
        title: "Import Failed",
        description: "There was an error importing your data.",
        variant: "destructive",
      })
    }

    // Reset the file input
    event.target.value = ""
  }

  return (
    <div className="flex gap-4 mb-6">
      <Button onClick={handleExport} variant="outline">
        Export Portfolio Data
      </Button>

      <div className="relative">
        <Button variant="outline" className="cursor-pointer">
          Import Portfolio Data
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept=".json"
            onChange={handleImport}
          />
        </Button>
      </div>
    </div>
  )
}
