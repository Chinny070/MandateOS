$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ExpectedRpc = "https://studio.genlayer.com/api"
$ExpectedApproval = "I_APPROVE_MANDATEOS_STUDIONET_DEPLOYMENT"

if ($env:MANDATEOS_DEPLOYMENT_APPROVED -cne $ExpectedApproval) {
  throw "Deployment is gated. This script may run only after separate explicit user approval is supplied by the authorized execution flow."
}
if ([string]::IsNullOrWhiteSpace($env:MANDATEOS_PROJECT_ID)) {
  throw "Set MANDATEOS_PROJECT_ID to the exact project ID approved for the ProjectVault constructor."
}

$Branch = (& git -C $RepoRoot branch --show-current).Trim()
if ($Branch -ne "codex/onchain-governance") { throw "Refusing deployment from branch '$Branch'." }
if ((& git -C $RepoRoot status --porcelain).Trim()) { throw "Refusing deployment from a dirty working tree." }

$CliVersion = (& genlayer --version).Trim()
if ($LASTEXITCODE -ne 0 -or $CliVersion -ne "0.39.1") {
  throw "Expected the locally verified GenLayer CLI 0.39.1 script runner; found '$CliVersion'. Re-audit the toolchain before use."
}
$NetworkInfo = (& genlayer network info 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $NetworkInfo -notmatch "alias:\s*'studionet'" -or
    $NetworkInfo -notmatch "chainId:\s*'61999'" -or $NetworkInfo -notmatch [regex]::Escape($ExpectedRpc)) {
  throw "Configured GenLayer CLI network does not match StudioNet / chain 61999 / the approved RPC."
}
$FeeProfile = Join-Path $RepoRoot "deployments/studionet-fee-profile.json"
if (-not (Test-Path -LiteralPath $FeeProfile)) {
  throw "A measured deploy fee profile with provenance matching the current contract sources is missing. No transaction submitted."
}

Push-Location $RepoRoot
try {
  & genlayer deploy --rpc $ExpectedRpc
  $CliExit = $LASTEXITCODE
  $RecordPath = Join-Path $RepoRoot "deployments/studionet-deployment-record.json"
  if (-not (Test-Path -LiteralPath $RecordPath)) { throw "Deployment journal was not created; stop and inspect account activity before any retry." }
  $Record = Get-Content -LiteralPath $RecordPath -Raw | ConvertFrom-Json
  if ($CliExit -ne 0 -or $Record.status -ne "DEPLOYED_VERIFIED") {
    throw "Deployment did not reach journal status DEPLOYED_VERIFIED (status: $($Record.status)). Do not retry; inspect the existing transaction IDs."
  }
  if (-not $Record.contracts.core.transaction_id -or -not $Record.contracts.vault.transaction_id -or
      -not $Record.contracts.core.contract_address -or -not $Record.contracts.vault.contract_address) {
    throw "Finalized deployment journal is incomplete. Stop and reconcile before further activity."
  }
  Write-Output "Both deployment receipts finalized successfully. Use the journal for addresses, hashes, source digests and fee reconciliation."
}
finally { Pop-Location }
