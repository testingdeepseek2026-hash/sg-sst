@echo off
set SEED=true
set PORT=4000
node dist/index.js > server_out.log 2>&1
