'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {createStore}=require('../lib/household/store.cjs'),{validateCredential}=require('../lib/household/google-client.cjs'),{connect}=require('../lib/household/sync.cjs');
async function main(){
 const file=process.argv[2];if(!file)throw Error('Usage: npm run connect:household -- "/absolute/path/to/service-account.json"\nSee HOUSEHOLD-DASHBOARD.md for the Google setup steps. Do not paste private keys into chat.');
 const stat=await fs.stat(file);if(!stat.isFile()||stat.size>65536)throw Error('Choose a Google service-account JSON file under 64 KB.');
 const credentials=validateCredential(JSON.parse(await fs.readFile(file,'utf8'))),store=createStore(path.resolve(__dirname,'../.household'));
 console.log('Checking the configured workbook. Setup adds private property, asset and meter register tabs and metadata columns. Existing plan amounts are not overwritten.');
 await connect({store,credentials});console.log('Google Sheets read/write is connected. Refresh the dashboard to load the latest status. The key is stored encrypted in the ignored local private directory.');
}
main().catch(error=>{console.error(error.provider||error.status||/^Usage:|^Choose |^Local plan|^Only part|^Unexpected|^Google returned|^The local/.test(error.message)?error.message:'Connection setup failed. Check the JSON credential, workbook sharing and Sheets API activation. No connection was confirmed.');process.exitCode=1;});
