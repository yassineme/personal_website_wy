'use strict';
const boxes=[...document.querySelectorAll('[data-pin-digit]')];
const form=document.querySelector('#unlock'),button=form.querySelector('button'),error=document.querySelector('#error');
const focus=index=>{const box=boxes[Math.max(0,Math.min(boxes.length-1,index))];box.focus();box.select();};
const unlockIfComplete=()=>{if(!button.disabled&&boxes.every(box=>/^\d$/.test(box.value)))form.requestSubmit();};
function distribute(text,index){
 const digits=String(text||'').replace(/\D/g,'').slice(0,boxes.length);if(!digits)return;
 const start=digits.length===boxes.length?0:index;
 if(start===0&&digits.length===boxes.length)boxes.forEach(box=>{box.value='';});
 [...digits].slice(0,boxes.length-start).forEach((digit,offset)=>{boxes[start+offset].value=digit;});
 focus(Math.min(boxes.length-1,start+digits.length));
 unlockIfComplete();
}
boxes.forEach((box,index)=>{
 box.addEventListener('focus',()=>box.select());
 box.addEventListener('paste',event=>{const text=event.clipboardData?.getData('text');if(text==null)return;event.preventDefault();distribute(text,index);});
 box.addEventListener('beforeinput',event=>{if(!event.inputType?.startsWith('insert')||event.data==null)return;if(event.data.length>1){event.preventDefault();distribute(event.data,index);}else if(/\D/.test(event.data))event.preventDefault();});
 box.addEventListener('input',event=>{const digits=String(event.data?.length>1?event.data:box.value).replace(/\D/g,'');if(digits.length>1)return distribute(digits,index);box.value=digits.slice(-1);if(box.value&&index<boxes.length-1)focus(index+1);unlockIfComplete();});
 box.addEventListener('keydown',event=>{
  if(event.key==='Backspace'&&!box.value&&index>0){event.preventDefault();boxes[index-1].value='';focus(index-1);}
  else if(event.key==='ArrowLeft'){event.preventDefault();focus(index-1);}
  else if(event.key==='ArrowRight'){event.preventDefault();focus(index+1);}
  else if(event.key==='Home'){event.preventDefault();focus(0);}
  else if(event.key==='End'){event.preventDefault();focus(boxes.length-1);}
 });
});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(button.disabled||!form.reportValidity())return;
 button.disabled=true;boxes.forEach(box=>{box.disabled=true;});error.textContent='';
 try{
  const response=await fetch('/api/household?action=unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:boxes.map(box=>box.value).join('')})});
  const result=await response.json();
  if(!response.ok){if(response.status===401)boxes.forEach(box=>{box.value='';});throw Error(result.error||'Unable to unlock.');}
  boxes.forEach(box=>{box.value='';});location.replace('/private-desk');
 }catch(e){error.textContent=e.message;button.disabled=false;boxes.forEach(box=>{box.disabled=false;});focus(Math.max(0,boxes.findIndex(box=>!box.value)));}
});
