$one='C:\Users\alexx\OneDrive\Escritorio\CHIPACTLI'
if(Test-Path $one){
  $stamp=Get-Date -Format 'yyyyMMdd_HHmmss'
  Push-Location 'C:\Users\alexx\OneDrive\Escritorio'
  Rename-Item -Path 'CHIPACTLI' -NewName ("CHIPACTLI__ONEDRIVE_DESACTIVADO__"+$stamp)
  Pop-Location
}
