'use strict';
const crypto = require('node:crypto');

function enhancePinEntry() {
  const boxes = [...document.querySelectorAll('[data-pin-digit]')];
  if (boxes.length !== 8) return;
  const focus = index => {
    boxes[Math.max(0, Math.min(7, index))].focus();
    boxes[Math.max(0, Math.min(7, index))].select();
  };
  const distribute = (text, index) => {
    const digits = String(text || '').replace(/\D/g, '').slice(0, 8);
    if (!digits) return;
    const start = digits.length === 8 ? 0 : index;
    [...digits].slice(0, 8 - start).forEach((digit, offset) => {boxes[start + offset].value = digit;});
    focus(Math.min(7, start + digits.length));
  };
  boxes.forEach((box, index) => {
    box.addEventListener('focus', () => box.select());
    box.addEventListener('paste', event => {
      const text = event.clipboardData?.getData('text');
      if (text == null) return;
      event.preventDefault();
      distribute(text, index);
    });
    box.addEventListener('beforeinput', event => {
      if (!event.inputType?.startsWith('insert') || event.data == null) return;
      if (event.data.length > 1) {
        event.preventDefault();
        distribute(event.data, index);
      } else if (/\D/.test(event.data)) event.preventDefault();
    });
    box.addEventListener('input', event => {
      const value = event.data?.length > 1 ? event.data : box.value;
      const digits = String(value).replace(/\D/g, '');
      if (digits.length > 1) return distribute(digits, index);
      box.value = digits.slice(-1);
      if (box.value && index < 7) focus(index + 1);
    });
    box.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !box.value && index > 0) {
        event.preventDefault();boxes[index - 1].value = '';focus(index - 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();focus(index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();focus(index + 1);
      } else if (event.key === 'Home') {
        event.preventDefault();focus(0);
      } else if (event.key === 'End') {
        event.preventDefault();focus(7);
      }
    });
  });
}

const PIN_SCRIPT = '(' + enhancePinEntry.toString() + ')();';
const PIN_SCRIPT_HASH = "'sha256-" + crypto.createHash('sha256').update(PIN_SCRIPT).digest('base64') + "'";
module.exports = {PIN_SCRIPT, PIN_SCRIPT_HASH};
