#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log(`
╔══════════════════════════════════════════════════════════╗
║                SG-SST - Inicializador                      ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Este script inicializará el proyecto con datos semilla ║
║  y lo pondrá en marcha para pruebas.                     ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);

// Verificar que estamos en el directorio correcto
if (!fs.existsSync(path.join(__dirname, 'package.json'))) {
    console.error('❌ Error: package.json no encontrado. Ejecuta este script desde la carpeta raíz del proyecto.');
    process.exit(1);
}

console.log('✅ Directorio correcto detectado');

// Limpiar build anteriores
console.log('\n1. Limpiando builds anteriores...');
['dist', 'web/dist', 'server/dist'].forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`   - ${dir} eliminado`);
    }
});

// Instalar dependencias si node_modules no existe
console.log('\n2. Verificando dependencias...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('   Instalando dependencias...');
    const install = spawn('pnpm', ['install'], { stdio: 'inherit' });
    install.on('close', (code) => {
        if (code !== 0) {
            console.error('❌ Error al instalar dependencias');
            process.exit(1);
        }
        iniciarServidor();
    });
} else {
    console.log('   Dependencias ya instaladas');
    iniciarServidor();
}

function iniciarServidor() {
    console.log('\n3. Inicializando con SEED=true...');
    
    const env = { ...process.env, SEED: 'true' };
    
    const dev = spawn('pnpm', ['run', 'dev'], {
        cwd: __dirname,
        env: env,
        stdio: 'inherit'
    });
    
    dev.on('close', (code) => {
        if (code !== 0) {
            console.error(`\n❌ El proceso terminó con código: ${code}`);
        }
    });
    
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                    LISTO PARA PRUEBAS                    ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  URLs:                                                   ║
║    - Frontend:  http://localhost:5173                     ║
║    - Backend:   http://localhost:4000                     ║
║    - Health:    http://localhost:4000/api/health            ║
║                                                          ║
║  Credenciales:                                           ║
║    - admin@sg-sst.local / Admin1234!                      ║
║    - trabajador@sg-sst.local / Trab1234!                  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

Presiona Ctrl+C para detener el servidor.
`);
}

// Manejar cierre con Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n👋 Servidor detenido. ¡Hasta luego!');
    process.exit(0);
});