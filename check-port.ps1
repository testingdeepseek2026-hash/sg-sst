$ErrorActionPreference = "Stop"
$port = $args[0]
try {
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
    if ($c) {
        Write-Host ("PORT {0} LISTENING PID={1}" -f $port, $c.OwningProcess)
    } else {
        Write-Host ("PORT {0} no is listening" -f $port)
    }
} catch {
    # Try any state
    try {
        $c = Get-NetTCPConnection -LocalPort $port -ErrorAction Stop
        if ($c) {
            Write-Host ("PORT {0} ANY-STATE PID={1} State={2}" -f $port, $c.OwningProcess, $c.State)
        } else {
            Write-Host ("PORT {0} no entry" -f $port)
        }
    } catch {
        Write-Host ("PORT {0} error: {1}" -f $port, $_.Exception.Message)
    }
}
