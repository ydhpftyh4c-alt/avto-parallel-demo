param([string]$Python = '', [switch]$CpuOnly)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectPath
if (-not $Python) {
  $bundledPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
  if (Test-Path -LiteralPath $bundledPython) { $Python = $bundledPython }
  else { $Python = (Get-Command python -ErrorAction Stop).Source }
}
$environmentPath = Join-Path $projectPath '.local-source/retouch-env'
if (-not (Test-Path -LiteralPath (Join-Path $environmentPath 'Scripts/python.exe'))) {
  & $Python -m venv $environmentPath
  if ($LASTEXITCODE -ne 0) { throw 'Cannot create the Python environment. Python 3.12 is recommended.' }
}
$workerPython = Join-Path $environmentPath 'Scripts/python.exe'
$torchIndex = if ($CpuOnly) { 'https://download.pytorch.org/whl/cpu' } else { 'https://download.pytorch.org/whl/cu126' }
& $workerPython -m pip install torch==2.6.0 --index-url $torchIndex
if ($LASTEXITCODE -ne 0) { throw 'PyTorch installation failed.' }
& $workerPython -m pip install numpy==1.26.4 pillow==11.3.0 opencv-python==4.11.0.86 rapidocr-onnxruntime==1.4.4
if ($LASTEXITCODE -ne 0) { throw 'OCR dependencies installation failed.' }
$modelDirectory = Join-Path $projectPath '.local-source/retouch-models'
New-Item -ItemType Directory -Force -Path $modelDirectory | Out-Null
$modelPath = Join-Path $modelDirectory 'big-lama.pt'
$modelHash = '7BA7AA7AC37A4D41FDBBEBA3A2AF7EAD18058552997E3A3CD1A3B2210C9E6B4C'
if (-not (Test-Path -LiteralPath $modelPath)) {
  $partialPath = Join-Path $modelDirectory 'big-lama.pt.part'
  Invoke-WebRequest -Uri 'https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt' -OutFile $partialPath
  if ((Get-FileHash -LiteralPath $partialPath -Algorithm SHA256).Hash -ne $modelHash) { throw 'Model checksum mismatch. Model was not activated.' }
  Move-Item -LiteralPath $partialPath -Destination $modelPath
}
if ((Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash -ne $modelHash) { throw 'Unexpected model checksum.' }
& $workerPython -m pip freeze | Set-Content -LiteralPath (Join-Path $projectPath '.local-source/retouch-installed.txt') -Encoding UTF8
& $workerPython -c 'import torch; from rapidocr_onnxruntime import RapidOCR; RapidOCR(intra_op_num_threads=4,inter_op_num_threads=1); print("CUDA:",torch.cuda.is_available())'
if ($LASTEXITCODE -ne 0) { throw 'Worker dependency check failed.' }
Write-Host 'Photo worker ready. Open http://127.0.0.1:4181/admin/ and select Photos.'
