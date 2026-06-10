param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$LogDir = Join-Path $RepoRoot "logs"
$LogPath = Join-Path $LogDir "daily-telegram.log"

function Write-RunLog {
    param([string]$Message)
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogPath -Encoding UTF8 -Value "[$stamp] $Message"
}

function Read-DotEnv {
    param([string[]]$Paths)
    $values = @{}
    foreach ($path in $Paths) {
        if (-not (Test-Path $path)) {
            continue
        }
        foreach ($line in Get-Content -Encoding UTF8 $path) {
            $trimmed = $line.Trim()
            if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
                continue
            }
            $name, $rawValue = $trimmed.Split("=", 2)
            $value = $rawValue.Trim().Trim('"').Trim("'")
            $values[$name.Trim()] = $value
        }
    }
    return $values
}

function Value-OrDefault {
    param(
        $Value,
        [string]$Suffix = ""
    )
    if ($null -eq $Value -or "$Value" -eq "") {
        return "暂无"
    }
    return "$(Repair-Text $Value)$Suffix"
}

function Format-Number {
    param(
        $Value,
        [int]$Decimals = 0,
        [string]$Suffix = ""
    )
    if ($null -eq $Value -or "$Value" -eq "") {
        return "暂无"
    }
    return ("{0:N$Decimals}$Suffix" -f [double]$Value)
}

function Repair-Text {
    param($Value)
    if ($null -eq $Value) {
        return $null
    }
    $text = "$Value"
    if ($text -notmatch "[ÃÂåèéäç]") {
        return $text
    }
    try {
        $latin1 = [System.Text.Encoding]::GetEncoding(28591)
        return [System.Text.Encoding]::UTF8.GetString($latin1.GetBytes($text))
    }
    catch {
        return $text
    }
}

function Format-Minutes {
    param($Minutes)
    if ($null -eq $Minutes) {
        return "暂无"
    }
    $total = [int][math]::Round([double]$Minutes)
    $hours = [math]::Floor($total / 60)
    $mins = $total % 60
    if ($hours -gt 0) {
        return "$hours 小时 $mins 分钟"
    }
    return "$mins 分钟"
}

function Format-LocalTime {
    param($Iso)
    if ($null -eq $Iso -or "$Iso" -eq "") {
        return "暂无"
    }
    try {
        $chinaTz = [TimeZoneInfo]::FindSystemTimeZoneById("China Standard Time")
        $dto = [DateTimeOffset]::Parse("$Iso", [Globalization.CultureInfo]::InvariantCulture)
        return [TimeZoneInfo]::ConvertTime($dto, $chinaTz).ToString("MM-dd HH:mm")
    }
    catch {
        return "$Iso"
    }
}

function Format-Percent {
    param($Value)
    if ($null -eq $Value) {
        return "暂无"
    }
    return ("{0:N1}%" -f [double]$Value)
}

function Build-Message {
    param($Summary)

    $sleep = $Summary.sleep
    $activity = $Summary.activity
    $workouts = @($Summary.workouts)
    $advice = @($Summary.advice)

    $sleepLines = @(
        "总时长：$(Format-Minutes $sleep.total_sleep_min)（$(Value-OrDefault $sleep.level)）",
        "时间：$(Format-LocalTime $sleep.start_time) → $(Format-LocalTime $sleep.end_time)",
        "效率：$(Format-Percent $sleep.efficiency_pct)",
        "清醒：$(Format-Minutes $sleep.awake_min)",
        "核心：$(Format-Minutes $sleep.core_min)",
        "深睡：$(Format-Minutes $sleep.deep_min)",
        "REM：$(Format-Minutes $sleep.rem_min)",
        "呼吸：$(Value-OrDefault $sleep.respiratory_rate ' 次/分钟')"
    )

    $standText = if ($null -ne $activity.stand_minutes) {
        Format-Minutes $activity.stand_minutes
    }
    elseif ($null -ne $activity.stand_hours) {
        "$(Value-OrDefault $activity.stand_hours ' 小时')"
    }
    else {
        "暂无"
    }

    $activityLines = @(
        "步数：$(Value-OrDefault $activity.steps ' 步')",
        "活动：$(Value-OrDefault $activity.active_minutes ' 分钟')",
        "活动能量：$(Format-Number $activity.active_calories 0 ' kcal')",
        "站立：$standText",
        "距离：$(Format-Number $activity.distance_km 2 ' km')"
    )

    if ($workouts.Count -gt 0) {
        $workoutLines = $workouts | ForEach-Object {
            "- $(Value-OrDefault $_.sport_type)：$(Format-Minutes $_.duration_min)，$(Format-Number $_.calories 0 ' kcal')"
        }
    }
    else {
        $workoutLines = @("- 暂无训练记录")
    }

    if ($advice.Count -gt 0) {
        $adviceLines = for ($i = 0; $i -lt [math]::Min($advice.Count, 4); $i++) {
            "$($i + 1). $(Repair-Text $advice[$i])"
        }
    }
    else {
        $adviceLines = @("暂无建议")
    }

    $message = @"
【每日健康简报】$($Summary.date)

睡眠（昨晚）
$($sleepLines -join "`n")

运动（昨日）
$($activityLines -join "`n")

训练
$($workoutLines -join "`n")

建议
$($adviceLines -join "`n")
"@

    if ($message.Length -gt 3900) {
        return $message.Substring(0, 3900) + "`n…"
    }
    return $message
}

try {
    $envValues = Read-DotEnv @(
        (Join-Path $RepoRoot ".env"),
        (Join-Path $RepoRoot ".env.jarvis.local")
    )

    $apiKey = $envValues["API_KEY"]
    $headers = @{}
    if ($apiKey) {
        $headers["X-API-Key"] = $apiKey
    }

    $summary = $null
    $lastError = $null
    foreach ($baseUrl in @("http://localhost:8000", "http://127.0.0.1:8000")) {
        try {
            $summary = Invoke-RestMethod -Uri "$baseUrl/api/apple/daily-summary" -Headers $headers -TimeoutSec 20
            break
        }
        catch {
            $lastError = $_.Exception.Message
        }
    }
    if ($null -eq $summary) {
        throw "health API unavailable: $lastError"
    }

    $text = Build-Message $summary
    if ($DryRun) {
        $text
        exit 0
    }

    $token = $envValues["TELEGRAM_BOT_TOKEN"]
    $chatId = $envValues["TELEGRAM_CHAT_ID"]
    if (-not $token -or -not $chatId) {
        throw "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing"
    }

    $url = "https://api.telegram.org/bot$token/sendMessage"
    $result = Invoke-RestMethod -Method Post -Uri $url -TimeoutSec 30 -Body @{
        chat_id = $chatId
        text = $text
        disable_web_page_preview = "true"
    }
    if (-not $result.ok) {
        throw "Telegram rejected message"
    }
    Write-RunLog "sent daily health summary date=$($summary.date)"
}
catch {
    Write-RunLog "ERROR: $($_.Exception.Message)"
    throw
}
