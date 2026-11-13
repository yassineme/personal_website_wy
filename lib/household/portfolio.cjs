'use strict';
const isFund=p=>['ETF','Fund'].includes(p.kind);
// A received screenshot date is a record date, not an invented valuation date.
const recordDate=(p,snapshot)=>p.recordedDate||snapshot?.asOfDate;
module.exports={isFund,recordDate};
