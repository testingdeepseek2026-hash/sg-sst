import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:\\Users\\PC\\sg-sst\\server\\data\\sg-sst.db');

// Check if policies table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='policies'").get();
console.log('policies table exists:', tables ? 'yes' : 'no');

// Check policy count
const policyCount = db.prepare('SELECT COUNT(*) as c FROM policies').get();
console.log('policyCount:', policyCount);

db.close();