"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploaderProps {
  label: string
  accept?: string
  onChange: (file: File | null) => void
  file: File | null
}

export default function FileUploader({ label, accept, onChange, file }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputId = `file-upload-${label.replace(/\s+/g, "-").toLowerCase()}`

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      if (accept && !accept.includes(droppedFile.type.split("/")[1])) {
        // Invalid file type
        return
      }
      onChange(droppedFile)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onChange(e.target.files[0])
    }
  }

  const handleRemoveFile = () => {
    onChange(null)
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="font-medium">{label}</div>
          {!file ? (
            <div className="relative">
              <label
                htmlFor={inputId}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer",
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-sm text-center text-muted-foreground">
                  <span className="font-medium">Click to upload</span> or drag and drop
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {accept ? `${accept.replace(".", "")} files only` : "Any file type"}
                </div>
              </label>
              <input type="file" id={inputId} className="sr-only" accept={accept} onChange={handleFileChange} />
            </div>
          ) : (
            <div className="border rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center">
                  <span className="text-xs font-medium">{file.name.split(".").pop()?.toUpperCase()}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · {new Date(file.lastModified).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleRemoveFile}>
                <X className="h-4 w-4" />
                <span className="sr-only">Remove file</span>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
