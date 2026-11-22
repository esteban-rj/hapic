param([string]$YouTubeClientJson = $env:HAPIC_YOUTUBE_CLIENT_JSON, [switch]$LiteLLM)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker no está disponible. Instala e inicia Docker Desktop antes de continuar.' }
docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0) { throw 'El motor Docker no responde.' }
$env:HAPIC_HOST_DATA_DIR = (Join-Path $taskRoot '.hapic').Replace('\','/')
New-Item -ItemType Directory -Force -Path $env:HAPIC_HOST_DATA_DIR | Out-Null
$composeFiles = @('-f', 'compose.yaml')
if ($YouTubeClientJson) {
    if (-not (Test-Path -LiteralPath $YouTubeClientJson -PathType Leaf)) { throw 'No se encuentra el JSON OAuth de Google. Indica la ruta del archivo privado.' }
    $env:HAPIC_YOUTUBE_CLIENT_JSON = (Resolve-Path -LiteralPath $YouTubeClientJson).Path.Replace('\','/')
    $composeFiles += @('-f', 'compose.youtube.yaml')
}
if ($LiteLLM) { $composeFiles += @('-f', 'compose.litellm.yaml') }
docker compose @composeFiles up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Compose no pudo iniciar Hapic.' }
Write-Host 'Hapic: http://127.0.0.1:8000'
