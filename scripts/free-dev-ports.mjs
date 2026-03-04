import { execSync } from 'node:child_process';

const ports = [3000, 3001];

function killPidWindows(pid) {
  if (!pid || Number.isNaN(Number(pid))) return false;
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getListeningPidsWindows(port) {
  try {
    const output = execSync(`netstat -ano -p tcp | findstr ":${port}"`, { encoding: 'utf8' });
    const lines = String(output || '').split(/\r?\n/);
    const pids = new Set();

    for (const lineRaw of lines) {
      const line = lineRaw.trim();
      if (!line || !line.toUpperCase().includes('LISTENING')) continue;
      const parts = line.split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid)) pids.add(pid);
    }

    return [...pids];
  } catch {
    return [];
  }
}

function freePortsWindows() {
  const killed = [];

  for (const port of ports) {
    const pids = getListeningPidsWindows(port);
    for (const pid of pids) {
      if (killPidWindows(pid)) {
        killed.push({ port, pid });
      }
    }
  }

  return killed;
}

if (process.platform === 'win32') {
  const killed = freePortsWindows();
  if (killed.length === 0) {
    console.log('ℹ️  Puertos dev libres (3000/3001).');
  } else {
    for (const item of killed) {
      console.log(`🧹 Liberado puerto ${item.port} (PID ${item.pid})`);
    }
  }
} else {
  console.log('ℹ️  Script de liberación de puertos implementado para Windows.');
}
