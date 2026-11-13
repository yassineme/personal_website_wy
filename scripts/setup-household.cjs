'use strict';
const path=require('node:path'),{createStore}=require('../lib/household/store.cjs');
async function hiddenPin(){
 if(!process.stdin.isTTY)throw Error('Run this command in an interactive terminal.');
 process.stdout.write('New private workspace PIN (8–16 digits; input hidden): ');process.stdin.setRawMode(true);process.stdin.resume();let value='';
 return new Promise((resolve,reject)=>{const onData=chunk=>{for(const c of chunk.toString()){if(c==='\u0003'){cleanup();reject(Error('Cancelled.'));return;}if(c==='\r'||c==='\n'){cleanup();resolve(value);return;}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(/[0-9]/.test(c)&&value.length<16)value+=c;}};const cleanup=()=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};process.stdin.on('data',onData);});
}
async function main(){const store=createStore(path.resolve(__dirname,'../.household'));await store.config();const pin=await hiddenPin();await store.rotate(pin);console.log('PIN updated. Existing sessions are revoked; financial data was preserved.');}
if(require.main===module)main().catch(e=>{console.error(e.code==='ENOENT'?'Import a private starting snapshot before setting the PIN.':e.message);process.exitCode=1;});
