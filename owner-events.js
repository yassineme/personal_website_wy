(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('events-data').textContent);
  const events = data.events;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? esc(url.href) : '#'; } catch { return '#'; } };
  const key = 'wy-owner-event-plan-v1';
  let saved = {}, topic = '', city = '', mapReady = false;
  try { const value = JSON.parse(localStorage.getItem(key) || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) saved = value; } catch { $('save-status').textContent = 'Browser storage unavailable; export to keep your plan'; }
  const todayFor = event => new Intl.DateTimeFormat('en-CA', {timeZone: ({'United Kingdom':'Europe/London','Portugal':'Europe/Lisbon','Finland':'Europe/Helsinki'})[event.country] || 'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const day = date => Date.parse(date + 'T00:00:00Z');
  const left = event => event.start ? Math.round((day(event.start) - day(todayFor(event))) / 86400000) : null;
  const past = event => event.end && event.end < todayFor(event);
  const timing = event => !event.start ? 'Date to confirm' : past(event) ? 'Past edition' : left(event) <= 0 ? 'Happening now' : `In ${left(event)} day${left(event) === 1 ? '' : 's'}`;
  const dateText = value => new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'}).format(new Date(value + 'T12:00:00Z'));
  const dates = event => event.start ? `${dateText(event.start)}${event.end !== event.start ? ' – ' + dateText(event.end) : ''}` : 'Next edition unconfirmed';
  const ordered = [...events].sort((a,b) => (a.start || '9999').localeCompare(b.start || '9999') || a.name.localeCompare(b.name));
  $('checked').textContent = dateText(data.checked);
  $('coverage').textContent = `${events.length} events · ${new Set(events.map(e => e.country)).size} countries · 5 interests`;
  $('country').innerHTML += [...new Set(events.map(e => e.country))].sort().map(country => `<option>${esc(country)}</option>`).join('');
  $('topics').innerHTML = ['', 'AI', 'Startup', 'Defence', 'Trading', 'Commodity trading'].map(value => `<button type="button" data-topic="${esc(value)}" aria-pressed="${!value}">${value || 'All interests'}</button>`).join('');
  const normal = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function visible() {
    const query = normal($('event-search').value.trim()), period = $('period').value;
    return ordered.filter(event => (!topic || event.topics.includes(topic)) && (!city || event.city === city) && (!$('country').value || event.country === $('country').value) && (!query || normal([event.name,event.city,event.country,event.note,...event.topics].join(' ')).includes(query)) && (!$('plan').value || saved[event.id] === $('plan').value) && (period === 'all' || period === 'watch' && !event.start || period === 'past' && past(event) || period === 'upcoming' && !past(event) || period === '2027' && event.start?.startsWith('2027') || period === '90' && event.start && !past(event) && left(event) <= 90));
  }
  function planControl(event) { return `<label class="event-plan">My visit<select data-plan="${event.id}" aria-label="Visit plan for ${esc(event.name)}">${[['','Not planned'],['saved','Shortlisted'],['going','Going']].map(([value,label])=>`<option value="${value}" ${saved[event.id]===value?'selected':''}>${label}</option>`).join('')}</select></label>`; }
  function render() {
    const openNotes = new Set([...document.querySelectorAll('.event-row details[open]')].map(node => node.closest('article').id));
    const activePlan = document.activeElement?.dataset.plan;
    const activeCity = document.activeElement?.getAttribute('data-city');
    const list = visible();
    $('result-count').textContent = `${list.length} event${list.length === 1 ? '' : 's'}${city ? ' · ' + city : ''} · ${events.filter(e => saved[e.id]).length} in your plan`;
    $('empty').hidden = !!list.length;
    $('clear-city').hidden = !city;
    $('event-list').innerHTML = list.map(event => `<article class="event-row" id="event-${event.id}"><div class="event-date">${event.start ? esc(dateText(event.start)) : 'Watchlist'}<small>${esc(timing(event))}</small></div><div><div class="tags mono">${event.topics.map(esc).join(' · ')}</div><h3>${esc(event.name)}</h3><p>${esc(event.note)}</p><div class="event-actions"><a href="${safeUrl(event.url)}" target="_blank" rel="noopener noreferrer">Official website ↗</a>${event.ticketUrl ? `<a href="${safeUrl(event.ticketUrl)}" target="_blank" rel="noopener noreferrer">Tickets ↗</a>` : ''}${event.start ? `<button type="button" data-calendar="${event.id}">Add to calendar</button>` : ''}</div></div><div class="event-place"><strong>${esc(event.city)}, ${esc(event.country)}</strong>${event.locationConfirmed === false ? '<span class="watch-label">Reported location · unverified</span>' : ''}<p>${esc(event.venue)}</p><p>${esc(dates(event))}</p><a class="quiet-button" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent((/confirm|unverified|next /i.test(event.venue) ? '' : event.venue + ', ') + event.city + ', ' + event.country)}" target="_blank" rel="noopener noreferrer">Find location ↗</a></div><div class="event-price"><strong>${esc(event.price)}</strong><details><summary>Price &amp; admission notes</summary><p>${esc(event.priceNote)}</p><p>Checked ${esc(dateText(data.checked))} · <a href="${safeUrl(event.source || event.url)}" target="_blank" rel="noopener noreferrer">Official source ↗</a></p></details>${planControl(event)}</div></article>`).join('');
    const next = list.find(event => event.start && !past(event));
    $('next-panel').innerHTML = next ? `<span class="mono muted">${city ? esc(city) + ' / ' : ''}Next on the horizon</span><div class="big-count">${Math.max(0,left(next))}</div><div class="count-caption">${left(next) <= 0 ? 'Happening now' : 'days until the next event'}</div><h2>${esc(next.name)}</h2><p>${esc(next.city)} · ${esc(dates(next))}</p><p>${esc(next.price)}</p><a href="#event-${next.id}">Explore this event ↗</a>` : '<span class="mono muted">On the horizon</span><h2>Room for possibility.</h2><p>No upcoming dated events in this selection. Explore the watchlist or adjust your filters.</p>';
    for (const id of openNotes) { const details = document.getElementById(id)?.querySelector('details'); if (details) details.open = true; }
    if (mapReady) drawPins(list);
    if (activePlan) document.querySelector(`[data-plan="${activePlan}"]`)?.focus({preventScroll:true});
    if (activeCity) [...document.querySelectorAll('[data-city]')].find(node => node.getAttribute('data-city') === activeCity)?.focus({preventScroll:true});
  }
  function savePlan() { try { localStorage.setItem(key, JSON.stringify(saved)); $('save-status').textContent = 'Plan saved in this browser'; } catch { $('save-status').textContent = 'Could not save here; export to keep your plan'; } }
  function icsText(list) {
    const clean = text => String(text).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
    const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//WY//European Events//EN','CALSCALE:GREGORIAN'];
    for (const event of list) { const end = new Date(day(event.end) + 86400000).toISOString().slice(0,10).replace(/-/g,''); lines.push('BEGIN:VEVENT',`UID:${event.id}-${event.start}@wyassine.com`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${event.start.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${end}`,`SUMMARY:${clean(event.name)}`,`LOCATION:${clean(event.venue + ', ' + event.city + ', ' + event.country)}`,`DESCRIPTION:${clean(event.note + '\nTicket: ' + event.price + '\n' + event.priceNote + '\n' + event.url)}`,`URL:${event.url}`,'END:VEVENT'); }
    lines.push('END:VCALENDAR');
    // Fold by UTF-8 bytes to preserve names and conform to RFC 5545.
    return lines.map(line => { let result='',length=0; for (const char of line) { const bytes=new TextEncoder().encode(char).length; if (length+bytes>73) { result+='\r\n '; length=1; } result+=char;length+=bytes; } return result; }).join('\r\n')+'\r\n';
  }
  function download(list) { if (!list.length) { $('save-status').textContent = 'Shortlist a dated event to export a calendar'; return; } const url = URL.createObjectURL(new Blob([icsText(list)],{type:'text/calendar;charset=utf-8'})); const a=document.createElement('a');a.href=url;a.download='european-events.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  $('topics').addEventListener('click', event => { const button=event.target.closest('[data-topic]');if(!button)return;topic=button.dataset.topic;document.querySelectorAll('[data-topic]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));render(); });
  ['event-search','country','period','plan'].forEach(id => $(id).addEventListener(id==='event-search'?'input':'change',render));
  $('clear-city').addEventListener('click',()=>{city='';render();});
  $('event-list').addEventListener('change',event=>{const id=event.target.dataset.plan;if(!id)return;if(event.target.value)saved[id]=event.target.value;else delete saved[id];savePlan();render();});
  $('event-list').addEventListener('click',event=>{const id=event.target.closest('[data-calendar]')?.dataset.calendar;if(id)download(events.filter(item=>item.id===id));});
  $('export-plan').addEventListener('click',()=>download(events.filter(event=>saved[event.id]&&event.start)));
  let projection;
  function drawPins(list) {
    const svg=d3.select('#events-map');svg.selectAll('.city-pin').remove();
    const mapped=list.filter(event=>event.locationConfirmed !== false);
    const cities=[...new Set(mapped.map(event=>event.city))];
    cities.forEach(name=>{const group=mapped.filter(event=>event.city===name),event=group[0],[x,y]=projection(event.coordinates);const pin=svg.append('g').attr('class','city-pin').attr('data-city',name).attr('transform',`translate(${x},${y})`).attr('tabindex',0).attr('role','button').attr('aria-label',`${name}: ${group.length} events. ${city===name?'Clear city filter':'Filter by city'}`).attr('aria-pressed',String(city===name));
      const select=()=>{city=city===name?'':name;render();};pin.on('click',select).on('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});pin.append('title').text(`${name} · ${group.length} events`);pin.append('circle').attr('class','pin-halo').attr('r',14+Math.min(12,group.length*2));pin.append('circle').attr('r',4+Math.min(4,group.length));
      const offsets={Amsterdam:[-12,-12],London:[-12,22],Amsterdam:[-12,-12],Essen:[12,16],Hannover:[12,-7],Paris:[-12,21],Munich:[12,16],Vienna:[12,-8],Lausanne:[-12,18],Helsinki:[12,-8],Barcelona:[12,16],Madrid:[-12,20],Lisbon:[-12,-12],Kielce:[12,-8]};const [dx,dy]=offsets[name]||[12,-8];pin.append('text').attr('x',dx).attr('y',dy).attr('text-anchor',dx<0?'end':'start').text(name);
    });
  }
  render();
  async function loadMap() { try {
    if (!window.d3 || !window.topojson) throw Error('Map library unavailable');
    const response=await fetch('/assets/map-data/countries-110m.json');if(!response.ok)throw Error('Map unavailable');const world=await response.json();
    projection=d3.geoMercator().center([10,50]).scale(700).translate([400,290]).clipExtent([[0,0],[800,540]]);
    const path=d3.geoPath(projection),svg=d3.select('#events-map');svg.append('path').datum(d3.geoGraticule().step([10,10])()).attr('class','map-graticule').attr('d',path);
    svg.append('g').selectAll('path').data(topojson.feature(world,world.objects.countries).features).join('path').attr('class','map-land').attr('d',path);
    mapReady=true;drawPins(visible());
  } catch { $('map-note').textContent='The map could not load. All locations and planning tools remain available in the list below.'; } }
  loadMap();setInterval(render,60000);
})();
