[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $DatabaseUrl,

    [Parameter(Mandatory = $true)]
    [string] $DatabaseUsername
)

$ErrorActionPreference = 'Stop'

if (-not $DatabaseUrl.StartsWith('jdbc:postgresql://')) {
    throw 'DatabaseUrl must start with jdbc:postgresql://.'
}
$databaseUri = $null
if (-not [Uri]::TryCreate($DatabaseUrl.Substring(5), [UriKind]::Absolute, [ref] $databaseUri)) {
    throw 'DatabaseUrl is not a valid JDBC PostgreSQL URL.'
}
if ($databaseUri.UserInfo) {
    throw 'Remove embedded credentials from DatabaseUrl. Supply the username separately and use the password prompt.'
}
foreach ($queryPart in $databaseUri.Query.TrimStart('?').Split('&')) {
    $queryKey = [Uri]::UnescapeDataString(($queryPart.Split('=')[0])).ToLowerInvariant()
    if ($queryKey -in @('user', 'username', 'password')) {
        throw 'Remove user, username, and password query parameters from DatabaseUrl.'
    }
}
if ([string]::IsNullOrWhiteSpace($DatabaseUsername)) {
    throw 'DatabaseUsername must not be empty.'
}
foreach ($override in @('SPRING_DATASOURCE_URL', 'SPRING_DATASOURCE_USERNAME', 'SPRING_DATASOURCE_PASSWORD',
        'SPRING_FLYWAY_URL', 'SPRING_FLYWAY_USER', 'SPRING_FLYWAY_PASSWORD')) {
    if ([Environment]::GetEnvironmentVariable($override, 'Process')) {
        throw "Remove the conflicting $override environment variable before using this launcher."
    }
}

$logDirectory = Join-Path $PSScriptRoot 'target'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logPath = Join-Path $logDirectory 'local-startup.log'
Set-Content -LiteralPath $logPath -Value 'Starting backend with process-only database credentials.'
$previousEnvironment = @{}
foreach ($name in @('DATABASE_URL', 'DATABASE_USERNAME', 'DATABASE_PASSWORD')) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

$securePassword = $null
$mlProcess = $null
$previousMlToken = $env:ML_SERVICE_TOKEN
$databasePassword = $null
$passwordPointer = [IntPtr]::Zero
$exitCode = 1
Push-Location $PSScriptRoot
try {
    # Start the private statistical service before adding database credentials.
    $mlDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'ml-service'
    $mlPython = Join-Path $mlDirectory '.venv\Scripts\python.exe'
    if ((Test-Path -LiteralPath $mlPython) -and -not $env:ML_SERVICE_URL) {
        if (-not $env:ML_SERVICE_TOKEN) {
            $tokenBytes = New-Object byte[] 32
            $random = [Security.Cryptography.RandomNumberGenerator]::Create()
            $random.GetBytes($tokenBytes)
            $random.Dispose()
            $env:ML_SERVICE_TOKEN = [Convert]::ToBase64String($tokenBytes)
        }
        $env:OPENBLAS_NUM_THREADS = '1'
        $env:OMP_NUM_THREADS = '1'
        $mlProcess = Start-Process -FilePath $mlPython -ArgumentList '-m uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 1 --limit-concurrency 4' -WorkingDirectory $mlDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'ml-stdout.log') -RedirectStandardError (Join-Path $logDirectory 'ml-stderr.log')
        Write-Host 'Python statistical service starting privately on 127.0.0.1:8001.'
    }
    Write-Host 'Enter your newly rotated Neon password below. Input is hidden; do not enter it in chat.'
    $securePassword = Read-Host 'Neon password' -AsSecureString
    if ($securePassword.Length -eq 0) {
        throw 'A nonempty Neon password is required.'
    }
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $databasePassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $passwordPointer = [IntPtr]::Zero

    $env:DATABASE_URL = $DatabaseUrl
    $env:DATABASE_USERNAME = $DatabaseUsername
    $env:DATABASE_PASSWORD = $databasePassword
    Write-Host 'Database variables set for this process and its children. Starting Spring Boot on port 8080.'
    # Native tools may write warnings to stderr without failing. Use Maven's exit code.
    $ErrorActionPreference = 'Continue'
    & .\mvnw.cmd spring-boot:run 2>&1 | ForEach-Object {
        $safeLine = $_.ToString().Replace($databasePassword, '[REDACTED]')
        Write-Host $safeLine
        Add-Content -LiteralPath $logPath -Value $safeLine -ErrorAction Stop
    }
    $exitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = 'Stop'
    foreach ($name in $previousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
    }
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    if ($null -ne $securePassword) { $securePassword.Dispose() }
    $databasePassword = $null
    if ($null -ne $mlProcess -and -not $mlProcess.HasExited) { Stop-Process -Id $mlProcess.Id -ErrorAction SilentlyContinue }
    $env:ML_SERVICE_TOKEN = $previousMlToken
    Pop-Location
}
exit $exitCode
