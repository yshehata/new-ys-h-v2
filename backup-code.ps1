# Script to backup essential code files
# Creates a RAR archive with current date and time in the parent directory

$date = Get-Date -Format 'yyyy-MM-dd-HHmm'
& 'C:\Program Files\WinRAR\WinRAR.exe' a -r -ep "..\$date-New_YSh_code.rar" ".\app\*" ".\components\*" ".\lib\*" ".\package.json" ".\tsconfig.json" ".\tailwind.config.ts"

Write-Host "Backup created: ..\Backup\$date-New_YSh_code.rar" 