#!/usr/bin/env node

async function publicIp() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.ip || null;
  } catch {
    return null;
  }
}

console.log(JSON.stringify({
  ok: true,
  node: process.version,
  egress_ip: await publicIp(),
  cwd: process.cwd(),
}, null, 2));
