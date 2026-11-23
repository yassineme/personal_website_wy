const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('New labels follow publication dates and expire after 14 calendar days without canvas', () => {
  const labels = ['2026-11-23', '2026-11-10', '2026-11-09', '2026-11-24',
    '2026-10-25', 'invalid', '2026-02-30'].map(published => ({
    dataset: { published }, hidden: true
  }));
  const handlers = {};
  let now = new Date(2026, 10, 23, 12).getTime();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
  }
  vm.runInNewContext(readFileSync(require.resolve('../blog-new-labels.js'), 'utf8'), {
    Date: Clock,
    document: {
      querySelectorAll: () => labels,
      getElementById: () => null,
      addEventListener: (event, handler) => { handlers[event] = handler; },
      hidden: false
    },
    window: { addEventListener: (event, handler) => { handlers[event] = handler; } }
  });
  assert.deepEqual(labels.map(label => label.hidden), [false, false, true, true, true, true, true]);
  now = new Date(2026, 11, 7, 12).getTime();
  handlers.visibilitychange();
  assert.deepEqual(labels.map(label => label.hidden), [true, true, true, false, true, true, true]);
  now = new Date(2026, 11, 8, 12).getTime();
  handlers.pageshow();
  assert.ok(labels.every(label => label.hidden));
});

test('the checked-in blog labels retain original publication dates', () => {
  const html = readFileSync(require.resolve('../blog.html'), 'utf8');
  const posts = JSON.parse(readFileSync(require.resolve('../content/posts.json'), 'utf8'));
  const labels = [...html.matchAll(/class="journal-new" data-published="([^"]+)" hidden>New<\/span>/g)];
  assert.equal(labels.length, posts.length + 1);
  assert.deepEqual(labels.slice(1).map(match => match[1]), posts.map(post => post.date_published));
  assert.equal(labels[0][1], posts.find(post => post.featured).date_published);
});

test('homepage label uses the newest original publication and shares the expiry script', () => {
  const home = readFileSync(require.resolve('../index.html'), 'utf8');
  const blog = readFileSync(require.resolve('../blog.html'), 'utf8');
  const posts = JSON.parse(readFileSync(require.resolve('../content/posts.json'), 'utf8'));
  const latest = posts.map(post => post.date_published).sort().at(-1);
  assert.ok(home.includes(`class="journal-new mono" data-published="${latest}" hidden>New</span>`));
  for (const page of [home, blog]) assert.match(page, /src="\/?blog-new-labels\.js" defer/);
});
