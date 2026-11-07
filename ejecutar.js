#!/usr/bin/env node

// Script simple para inicializar y ejecutar SG-SST

const { spawn } = require('child_process');
const process = global.process;

console.log(`
╔════════════════════════════════════════════════════════════╗
║              🚀 SG-SST - Inicializador Rápido              ║
╠════════════════════════════════════════════════════════════╣
║  Iniciando proyecto con datos semilla...                  ║
╚════════════════════════════════════════════════════════════╝
`);

// Ejecutar con SEED=true
const proc = spawn('pnpm', ['run', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env, SEED: 'true' }
});

proc.on('close', (code) => {
    if (code === 0) {
        console.log('\n✅ Servidor detenido correctamente');
    } else {
        console.log(`\n❌ Proceso terminó con código: ${code}`);
    }
});

// Mensaje de advertencia
setTimeout(() => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    📊 DATOS PARA PRUEBAS                  ║
╠════════════════════════════════════════════════════════════╣
║                                                          ║
║  🔗 URLs:                                                 ║
║    • Frontend:  http://localhost:5173                     ║
║    • Backend:   http://localhost:4000                     ║
║    • Health:    http://localhost:4000/api/health          ║
║                                                          ║
║  🔐 Credenciales de prueba:                               ║
║    • Email: admin@sg-sst.local                           ║
║    • Pass:  Admin1234!                                    ║
║                                                          ║
╚════════════════════════════════════════════════════════════╝

Para detener: Presiona Ctrl+C
`);
}, 3000);