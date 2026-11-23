param([string[]]$Looks)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$urls = @{}
foreach ($f in Get-ChildItem anim\results\*.json) {
  $j = Get-Content $f.FullName -Raw | ConvertFrom-Json
  foreach ($r in $j.results) { if ($r.success) { $urls[$r.asset_id.Substring(4)] = $r.image_url_public } }
}
New-Item -ItemType Directory -Force anim\strips | Out-Null
foreach ($look in $Looks) {
  $strip = "anim\strips\$look.jpg"
  if (-not (Test-Path $strip)) { curl.exe -sSL --ssl-no-revoke --retry 3 -o $strip $urls[$look] }
  $out = uv run python E:\seele_workspace\skills\sprite-generator\scripts\run_pipeline.py process-sheet --strip $strip --count 6 --action-class one_shot --name "atk_$look" --work-dir "anim\work2\$look" --output-dir "anim\out2\$look" --cell 896 2>&1 | Out-String
  $rep = "anim\out2\$look\pipeline_report.json"
  if (Test-Path $rep) { $r = Get-Content $rep -Raw | ConvertFrom-Json; Write-Output ("$look status=" + $r.status + " fail=" + ($r.fail_gates -join ',') + " review=" + ($r.review_gates -join ',')) }
  else { Write-Output "$look NO REPORT"; Write-Output $out.Substring([Math]::Max(0, $out.Length - 1500)) }
}

