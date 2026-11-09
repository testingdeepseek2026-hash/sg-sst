const { execSync } = require('child_process');

// Get all node processes with command line
function getNodeProcesses() {
  const out = execSync('C:/Windows/System32/tasklist.exe /NH /FO CSV /FI "IMAGENAME eq node.exe"', { encoding: 'utf8' });
  const lines = out.trim().split('\n').filter(l => l);
  const procs = [];
  for (const line of lines) {
    // tasklist CSV: "node.exe","PID","SessionName","Session#","MemUsage"
    const parts = line.split(',').map(s => s.replace(/^"/,'').replace(/"$/,''));
    if (parts.length >= 5) {
      procs.push({ name: parts[0], pid: parts[1], session: parts[2], mem: parts[4] });
    }
  }
  return procs;
}

// Find what's listening
function getListeners() {
  const out = execSync('C:/Windows/System32/netstat.exe -ano', { encoding: 'utf8' });
  const lines = out.trim().split('\n');
  const listen = [];
  for (const line of lines) {
    if (line.includes('LISTENING')) {
      const parts = line.trim().split(/\s+/);
      // TCP    0.0.0.0:8080    0.0.0.0:0    LISTENING    1234
      const local = parts[1];
      const pid = parts[parts.length - 1];
      const port = local.split(':').pop();
      listen.push({ port, pid, local });
    }
  }
  return listen;
}

const nodes = getNodeProcesses();
const listeners = getListeners();
console.log('=== NODE PROCESSES (top 25) ===');
nodes.slice(0, 25).forEach(p => console.log(p.pid.padStart(6), p.name.padEnd(12), p.mem));

console.log('\n=== LISTENING PORTS ===');
listeners.forEach(l => console.log('port', l.port.padStart(6), 'pid', l.pid));

// Find listeners on 5173-5176 and 4000
const targetPorts = [4000, 5173, 5174, 5175, 5176];
const interesting = listeners.filter(l => targetPorts.includes(Number(l.port)));
console.log('\n=== INTERESTING LISTENERS ===');
interesting.forEach(l => console.log('port', l.port, 'pid', l.pid));
