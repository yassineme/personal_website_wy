// Receiver for the private Website Submissions spreadsheet; standalone or sheet-bound.
// Nothing here serves its rows publicly.
var TARGET_SPREADSHEET_ID = '1xmwmDzMNpPYr8urnHLEWz0zPD0Qh-0bajSTsdP53hts';
var SUBMISSION_HEADERS = ['Received at','Request type','Name','Email','Message','Review status','Owner notes','Notification status','Notified at','Request ID','Source','Notification attempts','Last attempt at','Auto-reply status','Auto-replied at','Auto-reply attempts','Auto-reply last attempt at'];
var REQUEST_TYPES = {pin:'PIN request',pdf:'PDF request',enquiry:'Enquiry'};
var REQUEST_VIEWS = {'Enquiries':'Enquiry','PIN requests':'PIN request','PDF requests':'PDF request'};

function settings_() {
  var p=PropertiesService.getScriptProperties().getProperties();
  p.SPREADSHEET_ID=p.SPREADSHEET_ID||TARGET_SPREADSHEET_ID;
  if(!p.SPREADSHEET_ID || !/^[a-f0-9]{64}$/.test(p.WEBSITE_FORMS_SECRET||'') || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(p.OWNER_EMAIL||''))throw Error('Setup is incomplete');
  if(p.OWNER_NOTIFICATION_EMAIL && (p.OWNER_NOTIFICATION_EMAIL.length>254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(p.OWNER_NOTIFICATION_EMAIL)))throw Error('Invalid notification address');
  return p;
}
function json_(value) {return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function hex_(bytes) {return bytes.map(function(byte){return ('0'+((byte+256)%256).toString(16)).slice(-2);}).join('');}
function same_(left,right) {if(left.length!==right.length)return false;var difference=0;for(var i=0;i<left.length;i++)difference|=left.charCodeAt(i)^right.charCodeAt(i);return difference===0;}
function text_(value) {return /^[\s]*[=+\-@]/.test(value)?"'"+value:value;}
function submission_(event,config) {
  var raw=event && event.postData && event.postData.contents;
  if(typeof raw!=='string'||raw.length>24000)throw Error('Invalid request');
  var envelope=JSON.parse(raw);
  if(typeof envelope.payload!=='string'||envelope.payload.length>16000||!/^[a-f0-9]{64}$/.test(envelope.signature||''))throw Error('Invalid signature');
  var expected=hex_(Utilities.computeHmacSha256Signature(envelope.payload,config.WEBSITE_FORMS_SECRET));
  if(!same_(expected,envelope.signature))throw Error('Invalid signature');
  var data=JSON.parse(Utilities.newBlob(Utilities.base64Decode(envelope.payload)).getDataAsString('UTF-8'));
  if(data.version!==1 || !Number.isInteger(data.timestamp) || Math.abs(Date.now()/1000-data.timestamp)>300 || !/^[a-f0-9]{64}$/.test(data.id||'') || !Object.prototype.hasOwnProperty.call(REQUEST_TYPES,data.kind))throw Error('Invalid submission');
  if(typeof data.name!=='string'||!data.name.trim()||data.name.length>80||/[\r\n\x00-\x1f]/.test(data.name))throw Error('Invalid name');
  if(typeof data.email!=='string'||data.email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email))throw Error('Invalid email');
  if(typeof data.message!=='string'||data.message.length>1000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(data.message)||data.kind==='enquiry'&&!data.message.trim())throw Error('Invalid message');
  if(data.source!==(data.kind==='enquiry'?'/contact':'/digital-cv'))throw Error('Invalid source');
  return data;
}
function sheet_(config) {
  var sheet=SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName('Submissions');
  if(!sheet || sheet.getRange(1,1,1,SUBMISSION_HEADERS.length).getValues()[0].join('\t')!==SUBMISSION_HEADERS.join('\t'))throw Error('Spreadsheet headers do not match');
  return sheet;
}

// Health response only. This endpoint never returns submission content or configuration.
function doGet() {return json_({ok:true,service:'website-submissions',version:1});}
function doPost(event) {
  var lock;
  try {
    var config=settings_(),data=submission_(event,config);
    lock=LockService.getScriptLock();if(!lock.tryLock(5000))return json_({ok:false,error:'Please retry later'});
    var sheet=sheet_(config),last=sheet.getLastRow();
    var existing=last>1?sheet.getRange(2,10,last-1,1).createTextFinder(data.id).matchEntireCell(true).findNext():null;
    if(existing)return json_({ok:true,stored:true,id:data.id,notification:'queued'});
    // A persistent daily guard protects storage and notification quota, across server instances.
    var props=PropertiesService.getScriptProperties(),day=new Date().toISOString().slice(0,10),counter=JSON.parse(props.getProperty('DAILY_SUBMISSIONS')||'{}');
    if(counter.day!==day)counter={day:day,count:0};
    if(counter.count>=200)return json_({ok:false,error:'Please retry later'});
    var row=last+1;
    if(row>sheet.getMaxRows()){
      sheet.insertRowsAfter(sheet.getMaxRows(),100);
      var book=SpreadsheetApp.openById(config.SPREADSHEET_ID);
      Object.keys(REQUEST_VIEWS).forEach(function(name){var view=book.getSheetByName(name);if(view && view.getMaxRows()<sheet.getMaxRows())view.insertRowsAfter(view.getMaxRows(),sheet.getMaxRows()-view.getMaxRows());});
      var validation=SpreadsheetApp.newDataValidation().requireValueInList(['New','Reviewing','Approved','Declined','Replied'],true).setAllowInvalid(false).build();
      sheet.getRange(row,6,100,1).setDataValidation(validation);
    }
    sheet.getRange(row,1,1,SUBMISSION_HEADERS.length).setValues([[new Date(),REQUEST_TYPES[data.kind],text_(data.name),text_(data.email),text_(data.message),'New','','Pending','',data.id,data.source,0,'','Pending','',0,'']]);
    sheet.getRange(row,1).setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.getRange(row,9).setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.getRange(row,13).setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.getRange(row,15).setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.getRange(row,17).setNumberFormat('yyyy-mm-dd hh:mm');
    counter.count++;props.setProperty('DAILY_SUBMISSIONS',JSON.stringify(counter));
    SpreadsheetApp.flush();
    return json_({ok:true,stored:true,id:data.id,notification:'queued'});
  } catch(error) {
    // Do not return visitor data, file IDs, keys or Google errors to the caller.
    return json_({ok:false,error:'Submission could not be saved'});
  } finally {if(lock)lock.releaseLock();}
}

// Plain-text acknowledgements deliberately exclude submitted messages, links, PINs and PDFs.
// Edit this function locally to change the three visitor email templates.
function autoReply_(values,config) {
  var request=String(values[1]),subject,body;
  if(request==='Enquiry') {
    subject='Thank you for getting in touch';
    body='Thank you for your message. I have received your enquiry and will review it before replying personally.';
  } else if(request==='PIN request') {
    subject='Your digital CV access request has been received';
    body='Thank you for your interest in my digital CV. I have received your PIN request and will review it before following up personally. This acknowledgement does not grant access or contain a PIN.';
  } else if(request==='PDF request') {
    subject='Your résumé PDF request has been received';
    body='Thank you for your interest in my résumé. I have received your PDF request and will review it before following up personally. This acknowledgement does not include a résumé attachment.';
  } else throw Error('Unknown request type');
  return {to:String(values[3]),replyTo:config.OWNER_EMAIL,name:'Yassine W. Medjati',subject:subject,
    body:body+'\n\nYou can reply to this email if you would like to add anything.\n\nBest regards,\nYassine W. Medjati\n\nAutomatic acknowledgement · Reference: '+values[9]};
}
function ownerNotification_(values,config) {
  return {to:config.OWNER_NOTIFICATION_EMAIL||config.OWNER_EMAIL,replyTo:String(values[3]),name:'Website requests',
    subject:String(values[1])+' — '+String(values[2]).replace(/[\r\n]/g,' ').slice(0,80),
    body:'A new '+values[1]+' was saved from your website.\n\nName: '+values[2]+'\nEmail: '+values[3]+'\n\nMessage:\n'+(values[4]||'(No message supplied)')+'\n\nReview it in your private spreadsheet:\nhttps://docs.google.com/spreadsheets/d/'+config.SPREADSHEET_ID+'/edit\n\nReply to this email to contact the visitor. Review status is manual; changing it does not email the visitor. The automatic acknowledgement contains no PIN, PDF or attachment.\n\nRequest ID: '+values[9]};
}

// Independent queues: an uncertain owner delivery never causes a repeated visitor reply.
function sendPendingNotifications() {
  var config=settings_(),lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try {
    var sheet=sheet_(config),last=sheet.getLastRow();if(last<2)return;
    var rows=sheet.getRange(2,1,last-1,SUBMISSION_HEADERS.length).getValues();
    var quota=Math.min(20,MailApp.getRemainingDailyQuota());
    var deadline=Date.now()+4*60*1000,stop=false;
    for(var i=0;i<rows.length && !stop;i++) {
      var values=rows[i],row=i+2;
      // status, sent-at, attempts, last-attempt column indexes (zero-based)
      var channels=[{status:7,sent:8,attempts:11,last:12,build:ownerNotification_},
                    {status:13,sent:14,attempts:15,last:16,build:autoReply_}];
      for(var j=0;j<channels.length;j++) {
        if(Date.now()>deadline){stop=true;break;}
        var channel=channels[j],state=values[channel.status];
        if(state==='Sending') {
          var attempted=new Date(values[channel.last]).getTime();
          if(!attempted || !Number.isFinite(attempted) || Date.now()-attempted>10*60*1000)sheet.getRange(row,channel.status+1).setValue('Needs review');
          continue;
        }
        if(state!=='Pending'||quota<=0)continue;
        if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(values[3])) || !Object.keys(REQUEST_TYPES).some(function(key){return REQUEST_TYPES[key]===values[1];})) {
          sheet.getRange(row,channel.status+1).setValue('Needs review');continue;
        }
        sheet.getRange(row,channel.status+1).setValue('Sending');
        sheet.getRange(row,channel.attempts+1).setValue(Number(values[channel.attempts]||0)+1);
        sheet.getRange(row,channel.last+1).setValue(new Date());
        SpreadsheetApp.flush();
        try {
          MailApp.sendEmail(channel.build(values,config));
          quota--;
          sheet.getRange(row,channel.status+1,1,2).setValues([['Sent',new Date()]]);
          SpreadsheetApp.flush();
        } catch(error) {
          // A provider timeout may still have delivered the email; require inspection.
          sheet.getRange(row,channel.status+1).setValue('Needs review');stop=true;break;
        }
      }
    }
    SpreadsheetApp.flush();
  } finally {lock.releaseLock();}
}

function viewFormula_(type) {return '=IFNA(FILTER(Submissions!A2:Q,Submissions!B2:B="'+type+'"),"")';}
function guideRows_() {return [
  ['Website submissions','Owner guide'],
  ['Submissions','Master record for enquiries, PIN requests and PDF requests. Edit Review status and Owner notes here.'],
  ['Request views','Enquiries, PIN requests and PDF requests are automatic views. Edit only the master Submissions tab; do not type over view formulas.'],
  ['Emails','Each new request queues an owner notification and a separate visitor acknowledgement. Timer checks every five minutes after installation.'],
  ['Personal replies','Reply to the owner notification to reach the visitor. Visitor replies to acknowledgements go to OWNER_EMAIL.'],
  ['CV access','PINs and PDFs are shared manually after your review. Changing Review status never sends an email or grants access.'],
  ['Delivery states','Pending: queued. Sending: in progress. Sent: Google accepted the send, not proof of inbox delivery. Needs review: uncertain; inspect before retrying. Skipped: historical row.'],
  ['Retry','Check delivery first. In the standalone script, set RETRY_REQUEST_ID to the row’s Request ID, then run retryOwnerNotificationById or retryAutoReplyById.'],
  ['Limits','Both emails use Google recipient quota. Pending mail waits when quota is exhausted; at most 20 emails per run. New submissions capped at 200/day.'],
  ['Privacy','Keep sharing Restricted. Store keys in Script Properties and server settings, never in cells. No CV PIN, PDF, cookies or IP address is recorded.'],
  ['Bookings','Cal.com appointments and email links do not submit to this receiver. The PIN unlock form authenticates access; it does not create an enquiry.'],
  ['Setup','Tabs are prepared. Configure Script Properties, authorize the script, deploy the receiver and run installNotifications to enable delivery.']
];}
function styleSheet_(sheet) {
  sheet.setFrozenRows(1);sheet.setFrozenColumns(2);
  sheet.getRange(1,1,1,SUBMISSION_HEADERS.length).setFontFamily('Arial').setFontWeight('bold').setFontColor('#eeece7').setBackground('#0b0c0c').setWrap(true);
  sheet.setRowHeight(1,48);
  var widths=[155,125,180,240,360,135,280,155,155,440,140,155,165,155,155,155,175];
  widths.forEach(function(width,index){sheet.setColumnWidth(index+1,width);});
  sheet.getRange(2,1,Math.max(1,sheet.getMaxRows()-1),SUBMISSION_HEADERS.length).setVerticalAlignment('top');
  sheet.getRange(2,5,Math.max(1,sheet.getMaxRows()-1),1).setWrap(true);
  sheet.getRange(2,7,Math.max(1,sheet.getMaxRows()-1),1).setWrap(true);
  [1,9,13,15,17].forEach(function(column){sheet.getRange(2,column,Math.max(1,sheet.getMaxRows()-1),1).setNumberFormat('yyyy-mm-dd hh:mm');});
}
function setupSheet() {
  // Safe to prepare tabs without a signing secret, email permission or timer.
  var id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')||TARGET_SPREADSHEET_ID;
  var lock=LockService.getScriptLock();lock.waitLock(5000);
  try {
    var book=SpreadsheetApp.openById(id),sheet=book.getSheetByName('Submissions');
    // Validate existing named tabs before modifying them.
    if(sheet && sheet.getLastRow()>0) {
      var headers=sheet.getRange(1,1,1,SUBMISSION_HEADERS.length).getValues()[0];
      var legacy=headers.slice(0,13).join('\t')===SUBMISSION_HEADERS.slice(0,13).join('\t') && headers.slice(13).every(function(value){return value==='';});
      if(!legacy && headers.join('\t')!==SUBMISSION_HEADERS.join('\t'))throw Error('Existing Submissions headers differ; nothing was overwritten');
    }
    Object.keys(REQUEST_VIEWS).forEach(function(name){
      var view=book.getSheetByName(name);
      if(view && view.getLastRow()>0 && (view.getRange(1,1,1,SUBMISSION_HEADERS.length).getValues()[0].join('\t')!==SUBMISSION_HEADERS.join('\t') || view.getLastRow()>1 && view.getRange(2,1).getFormula()!==viewFormula_(REQUEST_VIEWS[name])))throw Error('Existing '+name+' tab differs; nothing was overwritten');
    });
    var guide=book.getSheetByName('Guide');
    if(guide && guide.getLastRow()>0 && guide.getRange(1,1).getValue()!=='Website submissions')throw Error('Existing Guide tab differs; nothing was overwritten');
    sheet=sheet||book.insertSheet('Submissions');
    if(legacy && sheet.getLastRow()>1) {
      // Historical rows must not suddenly email past visitors after this upgrade.
      sheet.getRange(2,14,sheet.getLastRow()-1,4).setValues(Array.from({length:sheet.getLastRow()-1},function(){return ['Skipped','',0,''];}));
    }
    sheet.getRange(1,1,1,SUBMISSION_HEADERS.length).setValues([SUBMISSION_HEADERS]);
    styleSheet_(sheet);
    var statuses=SpreadsheetApp.newDataValidation().requireValueInList(['New','Reviewing','Approved','Declined','Replied'],true).setAllowInvalid(false).build();
    sheet.getRange(2,6,Math.max(1,sheet.getMaxRows()-1),1).setDataValidation(statuses);
    if(sheet.getFilter())sheet.getFilter().remove();
    sheet.getRange(1,1,sheet.getMaxRows(),SUBMISSION_HEADERS.length).createFilter();
    Object.keys(REQUEST_VIEWS).forEach(function(name){
      var view=book.getSheetByName(name)||book.insertSheet(name);
      if(view.getMaxRows()<sheet.getMaxRows())view.insertRowsAfter(view.getMaxRows(),sheet.getMaxRows()-view.getMaxRows());
      view.getRange(1,1,1,SUBMISSION_HEADERS.length).setValues([SUBMISSION_HEADERS]);
      view.getRange(2,1).setFormula(viewFormula_(REQUEST_VIEWS[name]));styleSheet_(view);
    });
    guide=guide||book.insertSheet('Guide');
    var guideRows=guideRows_();guide.getRange(1,1,guideRows.length,2).setValues(guideRows).setWrap(true).setVerticalAlignment('top').setFontFamily('Arial');
    guide.getRange(1,1,1,2).setBackground('#0b0c0c').setFontColor('#eeece7').setFontWeight('bold');
    guide.setColumnWidth(1,180);guide.setColumnWidth(2,700);guide.setFrozenRows(1);guide.setRowHeights(1,guideRows.length,60);
    book.setSpreadsheetTimeZone('Europe/Berlin');SpreadsheetApp.flush();return book.getUrl();
  } finally {lock.releaseLock();}
}
function installNotifications() {
  var config=settings_();sheet_(config);
  if(!ScriptApp.getProjectTriggers().some(function(trigger){return trigger.getHandlerFunction()==='sendPendingNotifications';}))ScriptApp.newTrigger('sendPendingNotifications').timeBased().everyMinutes(5).create();
}
function onOpen() {
  if(!SpreadsheetApp.getActiveSpreadsheet())return; // Menus are available only in a bound project.
  SpreadsheetApp.getUi().createMenu('Website submissions').addItem('Prepare sheets','setupSheet').addItem('Enable emails','installNotifications').addItem('Send pending emails now','sendPendingNotifications').addItem('Retry selected owner notification','retrySelectedNotification').addItem('Retry selected auto-reply','retrySelectedAutoReply').addToUi();
}
function retrySelectedEmail_(column) {
  var config=settings_(),book=SpreadsheetApp.getActiveSpreadsheet(),range=book.getActiveRange();
  if(book.getId()!==config.SPREADSHEET_ID || range.getSheet().getName()!=='Submissions' || range.getNumRows()!==1 || range.getRow()<2)throw Error('Select one row in Submissions');
  var lock=LockService.getScriptLock();lock.waitLock(5000);
  try{var status=range.getSheet().getRange(range.getRow(),column);if(status.getValue()!=='Needs review')throw Error('Only an email needing review can be retried');status.setValue('Pending');SpreadsheetApp.flush();}finally{lock.releaseLock();}
}
function retrySelectedNotification() {retrySelectedEmail_(8);}
function retrySelectedAutoReply() {retrySelectedEmail_(14);}

// Standalone projects do not have access to the selection in the Sheet's UI.
// Explicit request IDs keep retries attached to the right person if rows move.
function retryEmailById_(column) {
  var config=settings_(),id=config.RETRY_REQUEST_ID||'';
  if(!/^[a-f0-9]{64}$/.test(id))throw Error('Set RETRY_REQUEST_ID to the exact Request ID from Submissions');
  var lock=LockService.getScriptLock();lock.waitLock(5000);
  try {
    var sheet=sheet_(config),last=sheet.getLastRow();
    var match=last>1?sheet.getRange(2,10,last-1,1).createTextFinder(id).matchEntireCell(true).findNext():null;
    if(!match)throw Error('Request ID was not found');
    var status=sheet.getRange(match.getRow(),column);
    if(status.getValue()!=='Needs review')throw Error('Only an email needing review can be retried');
    status.setValue('Pending');SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().deleteProperty('RETRY_REQUEST_ID');
  } finally {lock.releaseLock();}
}
function retryOwnerNotificationById() {retryEmailById_(8);}
function retryAutoReplyById() {retryEmailById_(14);}
