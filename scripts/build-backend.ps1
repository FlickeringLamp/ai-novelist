#!/usr/bin/env pwsh
# 构建后端便携 Python 环境

param([string]$PythonVersion = "3.13.9")
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OutputDir = "$ProjectRoot\dist\portable"

Write-Host "=== 构建后端便携环境 ===" -ForegroundColor Green
Write-Host "Python 版本: $PythonVersion" -ForegroundColor Cyan

# 清理
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# 下载 Python
$PythonUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$PythonZip = "$OutputDir\python.zip"
Write-Host "[1/4] 下载 Python..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $PythonUrl -OutFile $PythonZip -UseBasicParsing

# 解压
Write-Host "[2/4] 解压 Python..." -ForegroundColor Yellow
Expand-Archive -Path $PythonZip -DestinationPath "$OutputDir\python" -Force
Remove-Item $PythonZip

# 配置 .pth 文件
$pthFile = Get-ChildItem "$OutputDir\python" -Filter "python*._pth" | Select-Object -First 1
if ($pthFile) {
    (Get-Content $pthFile.FullName) -replace '^#import site', 'import site' | Set-Content $pthFile.FullName
}

# 安装 pip
Write-Host "[3/4] 安装 pip..." -ForegroundColor Yellow
$GetPip = "$OutputDir\get-pip.py"
Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $GetPip -UseBasicParsing
& "$OutputDir\python\python.exe" $GetPip --no-warn-script-location --quiet
Remove-Item $GetPip

# 配置 VS 环境
Write-Host "[3.5/4] 配置编译环境..." -ForegroundColor Yellow
$vsPaths = @(
    "${env:ProgramFiles}\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat",
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
)
foreach ($path in $vsPaths) {
    if (Test-Path $path) {
        cmd /c "`"$path`" && set" | ForEach-Object {
            if ($_ -match "^(.+?)=(.+)$") {
                [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
            }
        }
        $env:DISTUTILS_USE_SDK = "1"
        Write-Host "  已配置: $path"
        break
    }
}

# 安装依赖
Write-Host "[4/4] 安装依赖..." -ForegroundColor Yellow
& "$OutputDir\python\python.exe" -m pip install `
    --target="$OutputDir\python\Lib\site-packages" `
    scikit-build-core cmake setuptools wheel --quiet

& "$OutputDir\python\python.exe" -m pip install `
    --target="$OutputDir\python\Lib\site-packages" `
    -r "$ProjectRoot\backend\requirements.txt" --quiet

# 复制项目文件
Copy-Item "$ProjectRoot\main.py" $OutputDir
Copy-Item -Recurse "$ProjectRoot\backend" $OutputDir
Copy-Item -Recurse "$ProjectRoot\static" $OutputDir
Copy-Item "$ProjectRoot\.env.example" $OutputDir

# 创建启动脚本
@"
@echo off
set PYTHONPATH=%~dp0python\Lib\site-packages
%~dp0python\python.exe %~dp0main.py
"@ | Set-Content "$OutputDir\启动.bat" -Encoding UTF8

$size = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
Write-Host ""
Write-Host "=== 后端构建完成 ===" -ForegroundColor Green
Write-Host "输出: $OutputDir" -ForegroundColor Cyan
Write-Host "大小: $size MB" -ForegroundColor Cyan
