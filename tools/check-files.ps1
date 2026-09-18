# くらしの手帳：アップロードの前に、ファイルがそろっているか調べて files.json を作る
# 使い方：tools フォルダの「チェック.bat」をダブルクリック
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$need = New-Object System.Collections.Generic.SortedSet[string]
$html = [IO.File]::ReadAllText((Join-Path $root 'index.html'), [Text.Encoding]::UTF8)
foreach($m in [regex]::Matches($html, '(?:src|href)="((?:js|css)/[^"?#]+)"')){ [void]$need.Add($m.Groups[1].Value) }
$sw = [IO.File]::ReadAllText((Join-Path $root 'sw.js'), [Text.Encoding]::UTF8)
foreach($m in [regex]::Matches($sw, "'\./([^']+)'")){
  $p = $m.Groups[1].Value
  if($p -and -not $p.StartsWith('__') -and $p -ne 'files.json'){ [void]$need.Add($p) }
}
[void]$need.Add('sw.js'); [void]$need.Add('index.html')
$missing = @()
foreach($f in $need){ if(-not (Test-Path (Join-Path $root $f))){ $missing += $f } }
$sha = [Security.Cryptography.SHA256]::Create()
$utf8 = New-Object System.Text.UTF8Encoding($false)
$list = @()
foreach($f in $need){
  $full = Join-Path $root $f
  if(-not (Test-Path $full)){ continue }
  $item = [ordered]@{ path = $f }
  if($f -notmatch '\.(png|jpg|jpeg|gif|ico|webp)$'){
    $text = [IO.File]::ReadAllText($full, [Text.Encoding]::UTF8) -replace "`r", ''
    $bytes = $utf8.GetBytes($text)
    $hex = -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
    $item.sha256 = $hex.Substring(0, 16)
  }
  $list += New-Object PSObject -Property $item
}
$build = ''
$core = [IO.File]::ReadAllText((Join-Path $root 'js\core.js'), [Text.Encoding]::UTF8)
$bm = [regex]::Match($core, "APP_BUILD = '([^']+)'")
if($bm.Success){ $build = $bm.Groups[1].Value }
$obj = [ordered]@{ build = $build; made = (Get-Date).ToString('yyyy-MM-dd HH:mm'); files = $list }
$json = $obj | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText((Join-Path $root 'files.json'), $json, $utf8)
Write-Host ''
Write-Host "くらしの手帳 $build のファイルを調べました（$($need.Count)件）"
if($missing.Count){
  Write-Host '見つからないファイルがあります：' -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  Write-Host 'このままアップロードすると、アプリが開かないことがあります。' -ForegroundColor Red
  exit 1
}else{
  Write-Host 'ぜんぶそろっています。files.json を作りました。' -ForegroundColor Green
  Write-Host 'kurashi フォルダの中身をまるごと GitHub にアップロードしてください（files.json も）。'
}