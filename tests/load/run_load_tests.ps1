param(
    [string]$BaseUrl = "https://yovi.13.63.89.84.sslip.io/api"
)

$ResultsDir = "tests\load\results"
$Timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "Target : $BaseUrl"
Write-Host "Results: $ResultsDir"

New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

function Run-Test {
    param([string]$Name, [string]$Script)

    $JsonOutput = "$ResultsDir\${Name}_${Timestamp}.json"
    $LogOutput  = "$ResultsDir\${Name}_${Timestamp}.txt"

    Write-Host "Running: $Name"

    k6 run --out "json=$JsonOutput" -e BASE_URL="$BaseUrl" $Script 2>&1 | Tee-Object -FilePath $LogOutput

    Write-Host "Done: $Name"
}

Run-Test -Name "register"   -Script "tests\load\register.js"
Run-Test -Name "login"      -Script "tests\load\login.js"
Run-Test -Name "start_game" -Script "tests\load\start_game.js"

Write-Host "All tests completed. Results in: $ResultsDir"