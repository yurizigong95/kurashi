# くらしの手帳：ファイルを確かめてから、GitHub に上げて公開する
# 使い方：tools フォルダの「公開.bat」をダブルクリック
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if(-not (Test-Path (Join-Path $root '.git'))){
  Write-Host 'このフォルダはまだ GitHub とつながっていません。Claude に「GitHubにつないで」と頼んでください。' -ForegroundColor Red
  exit 1
}

& (Join-Path $PSScriptRoot 'check-files.ps1')
if($LASTEXITCODE){ exit 1 }

$ErrorActionPreference = 'Continue'
git add -A
git diff --cached --quiet
if($LASTEXITCODE){
  $build = (Get-Content (Join-Path $root 'files.json') -Raw -Encoding UTF8 | ConvertFrom-Json).build
  $msgFile = Join-Path $root '.git\PUBLISH_MSG'
  [IO.File]::WriteAllText($msgFile, "更新 $build", (New-Object System.Text.UTF8Encoding($false)))
  git commit -q -F $msgFile
  if($LASTEXITCODE){ Write-Host '記録（コミット）に失敗しました。' -ForegroundColor Red; exit 1 }
}

Write-Host ''
Write-Host 'GitHub に送っています…（はじめての時は、ブラウザでGitHubのログインが出ます）'
git push -q origin main
if($LASTEXITCODE){
  Write-Host ''
  Write-Host '送れませんでした。' -ForegroundColor Red
  Write-Host 'GitHub のページから別にアップロードした場合は、Claude に「公開が失敗した」と伝えてください。' -ForegroundColor Red
  exit 1
}
Write-Host ''
Write-Host '公開しました。1〜3分ほどで、次のURLに反映されます。' -ForegroundColor Green
Write-Host '  https://yurizigong95.github.io/kurashi/'
Write-Host 'スマホ・iPad・パソコンのアプリを開き直してください。'
