"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

interface DebugPanelProps {
  messages: string[]
}

export default function DebugPanel({ messages }: DebugPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Debug Information</CardTitle>
          <div className="flex space-x-2">
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? "Expand" : "Collapse"}
            </Button>
            {messages.length > 0 && (
              <Button variant="destructive" size="icon" className="h-7 w-7">
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Clear logs</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          <div className="bg-muted p-3 rounded-md max-h-[300px] overflow-y-auto font-mono text-xs">
            {messages.length === 0 ? (
              <div className="text-muted-foreground italic">No debug information available</div>
            ) : (
              <div className="space-y-1">
                {messages.map((message, index) => (
                  <div key={index} className="whitespace-pre-wrap">
                    {message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
