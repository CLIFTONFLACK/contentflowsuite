'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../ga-consent.js');

const ID = 'G-72BTWXNBSD';
const OFF = 'ga-disable-' + ID;
const LIVE = 'flow.getbrian.xyz';

test('tracks the real hosts and nothing that merely looks like them', () => {
  for (const h of ["flow.getbrian.xyz", "FLOW.GetBrian.XYZ"]) assert.equal(a.isTrackedHost(h), true, h);
  for (const h of ["getbrian.xyz", "www.getbrian.xyz", "x.flow.getbrian.xyz", "flow.getbrian.xyz.evil.com", "notflow.getbrian.xyz", "flow.getbrian.xyzz", "contentflowsuite.vercel.app", "localhost", ""]) assert.equal(a.isTrackedHost(h), false, String(h));
});

test('the banner shows on tracked hosts and localhost only', () => {
  assert.equal(a.showsBanner(LIVE), true);
  assert.equal(a.showsBanner('localhost'), true);
  assert.equal(a.showsBanner('127.0.0.1'), true);
  assert.equal(a.showsBanner('some-branch.vercel.app'), false);
});

test('excluded paths never load the tag or show the banner; lookalikes are not excluded', () => {
  for (const p of []) assert.equal(a.isExcludedPath(p), true, p);
  for (const p of ["/", "/anything", "/privacy"]) assert.equal(a.isExcludedPath(p), false, p);
});

test('only an exact stored choice counts', () => {
  assert.equal(a.parseConsent('granted'), 'granted');
  assert.equal(a.parseConsent('denied'), 'denied');
  for (const v of [null, undefined, '', 'true', 'GRANTED', 'granted ', '1']) assert.equal(a.parseConsent(v), null, String(v));
});

test('recognises the real gtag cookie names, not lookalikes', () => {
  for (const n of ['_ga', '_ga_72BTWXNBSD', '_gid', '_gat', '_gat_gtag_G_72BTWXNBSD']) assert.equal(a.isGaCookieName(n), true, n);
  for (const n of ['gb_consent', 'session', '_gaps', 'ga', 'x_ga', '_gatekeeper', '_gatx']) assert.equal(a.isGaCookieName(n), false, n);
});

test('clearGaCookies expires GA cookies and leaves others alone', () => {
  const writes = [];
  const doc = {
    get cookie() { return '_ga=GA1.1.1; _ga_72BTWXNBSD=GS1; keep_me=1; gb_consent=granted'; },
    set cookie(v) { writes.push(v); }
  };
  a.clearGaCookies(doc, 'flow.getbrian.xyz');
  const names = [...new Set(writes.map((w) => w.split('=')[0]))].sort();
  assert.deepEqual(names, ['_ga', '_ga_72BTWXNBSD']);
  assert.ok(writes.every((w) => w.includes('expires=Thu, 01 Jan 1970')));
  assert.ok(writes.some((w) => w.includes('domain=.flow.getbrian.xyz')), 'the host is covered');
  const PARENT = 'getbrian.xyz';
  if (PARENT) assert.ok(writes.every((w) => !w.includes('domain=' + PARENT) && !w.includes('domain=.' + PARENT)), 'the shared parent domain is left alone');
});

// ---- init(): a minimal fake browser --------------------------------------

function fakeBrowser({ hostname = LIVE, pathname = '/', stored = null, storageThrows = false, href, referrer = '' }) {
  const scripts = [];
  const styles = [];
  const body = { children: [], appendChild(n) { n.parentNode = body; body.children.push(n); return n; } };
  const mk = (tag) => {
    const n = { tag, className: '', textContent: '', children: [], listeners: {}, parentNode: null };
    n.appendChild = (c) => { c.parentNode = n; n.children.push(c); return c; };
    n.setAttribute = () => {};
    n.addEventListener = (ev, fn) => { n.listeners[ev] = fn; };
    n.click = () => n.listeners.click && n.listeners.click();
    return n;
  };
  const doc = {
    cookie: '',
    referrer,
    body,
    head: { appendChild(n) { (n.tag === 'style' ? styles : scripts).push(n); return n; } },
    createElement: mk,
    createTextNode: (t) => ({ tag: '#text', textContent: t, children: [] }),
    getElementById: (id) => styles.find((s) => s.id === id) || null
  };
  body.removeChild = (n) => { body.children = body.children.filter((c) => c !== n); n.parentNode = null; };
  const store = new Map(stored ? [['gb_consent', stored]] : []);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const working = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), clear: () => store.clear() };
  const url = href || ('https://' + hostname + pathname);
  const win = {
    document: doc,
    location: { hostname, pathname, href: url, origin: new URL(url).origin },
    localStorage: storageThrows ? blocked : working,
    handlers: {},
    addEventListener(ev, fn) { win.handlers[ev] = fn; }
  };
  const find = (cls) => {
    const out = [];
    const walk = (n) => {
      n.children.forEach((c) => {
        if (String(c.className).split(' ').includes(cls)) out.push(c);
        walk(c);
      });
    };
    walk(body);
    return out;
  };
  return { win, scripts, styles, body, find, store };
}

// JSON round trip: objects created inside a vm context carry another realm's prototypes.
const calls = (b) => JSON.parse(JSON.stringify((b.win.dataLayer || []).map((x) => Array.from(x))));

test('first visit on the live host: banner shows, no tag is requested', () => {
  const b = fakeBrowser({});
  a.init(b.win);
  assert.equal(b.find('gbc').length, 1);
  assert.equal(b.scripts.length, 0);
  assert.equal(b.win.dataLayer, undefined);
  assert.equal(b.win[OFF], true);
  assert.equal(b.styles.length, 1, 'banner styles are injected by the script');
});

test('Accept loads gtag.js once with consent v2 signals and a clean address; Decline afterwards switches it off', () => {
  const b = fakeBrowser({ href: 'https://' + LIVE + '/?token=SECRET&utm_source=mail#frag', referrer: 'https://' + LIVE + '/private?x=1' });
  a.init(b.win);
  b.find('gbc__btn')[1].click(); // Accept
  assert.equal(b.scripts.length, 1);
  assert.match(b.scripts[0].src, new RegExp('googletagmanager\\.com/gtag/js\\?id=' + ID + '$'));
  assert.equal(b.store.get('gb_consent'), 'granted');
  assert.equal(b.win[OFF], false);
  const c = calls(b);
  assert.deepEqual(c[0].slice(0, 2), ['consent', 'default']);
  assert.equal(c[0][2].ad_storage, 'denied');
  assert.equal(c[0][2].ad_personalization, 'denied');
  assert.equal(c[0][2].analytics_storage, 'granted');
  const cfg = c.find((x) => x[0] === 'config');
  assert.equal(cfg[1], ID);
  assert.equal(cfg[2].page_location, 'https://' + LIVE + '/?utm_source=mail');
  assert.equal(cfg[2].page_referrer, '', 'same-site referrers are blanked');
  assert.equal(cfg[2].allow_google_signals, false);
  assert.equal(cfg[2].allow_ad_personalization_signals, false);
  assert.equal(b.find('gbc').length, 0, 'banner closed');
  assert.equal(b.find('gbc__chip').length, 1, 'chip offered');

  b.find('gbc__chip')[0].click(); // reopen
  b.find('gbc__btn')[0].click(); // Decline
  assert.equal(b.store.get('gb_consent'), 'denied');
  assert.equal(b.win[OFF], true);
  assert.equal(b.scripts.length, 1, 'no second script');
  const last = calls(b).pop();
  assert.deepEqual(last, ['consent', 'update', { analytics_storage: 'denied' }]);
});

test('an external referrer is reduced to its origin', () => {
  const b = fakeBrowser({ referrer: 'https://news.example.org/story/private-id?token=abc#x' });
  a.init(b.win);
  b.find('gbc__btn')[1].click();
  assert.equal(calls(b).find((x) => x[0] === 'config')[2].page_referrer, 'https://news.example.org');
  assert.equal(calls(b).find((x) => x[0] === 'config')[2].cookie_domain, LIVE, 'cookies are host-only');
});

test('a stored Accept loads the tag on the next visit without asking again', () => {
  const b = fakeBrowser({ stored: 'granted' });
  a.init(b.win);
  assert.equal(b.find('gbc').length, 0);
  assert.equal(b.scripts.length, 1);
});

test('a stored Decline loads nothing and shows only the chip', () => {
  const b = fakeBrowser({ stored: 'denied' });
  a.init(b.win);
  assert.equal(b.scripts.length, 0);
  assert.equal(b.find('gbc').length, 0);
  assert.equal(b.find('gbc__chip').length, 1);
});

test('localhost shows the banner but never loads the tag, even after Accept', () => {
  const b = fakeBrowser({ hostname: 'localhost' });
  a.init(b.win);
  assert.equal(b.find('gbc').length, 1);
  b.find('gbc__btn')[1].click();
  assert.equal(b.scripts.length, 0);
});

test('preview hosts and excluded paths do nothing at all', () => {
  const preview = fakeBrowser({ hostname: 'my-branch-abc.vercel.app', stored: 'granted' });
  a.init(preview.win);
  assert.equal(preview.scripts.length, 0);
  assert.equal(preview.body.children.length, 0);
  for (const p of [].slice(0, 2)) {
    const x = fakeBrowser({ pathname: p, stored: 'granted' });
    a.init(x.win);
    assert.equal(x.scripts.length, 0, p);
    assert.equal(x.body.children.length, 0, p);
  }
});

test('with storage blocked the banner is still dismissable and nothing is assumed before a choice', () => {
  const b = fakeBrowser({ storageThrows: true });
  a.init(b.win);
  assert.equal(b.scripts.length, 0);
  assert.equal(b.find('gbc').length, 1);
  b.find('gbc__btn')[1].click();
  assert.equal(b.find('gbc').length, 0);
  assert.equal(b.scripts.length, 1);
});

test('storage cleared in another tab switches the tag off and asks again', () => {
  const b = fakeBrowser({ stored: 'granted' });
  a.init(b.win);
  assert.equal(b.win[OFF], false);
  b.store.clear();
  b.win.handlers.storage({ key: null });
  assert.equal(b.win[OFF], true);
  assert.equal(b.find('gbc').length, 1, 'banner is back');
  assert.deepEqual(calls(b).pop(), ['consent', 'update', { analytics_storage: 'denied' }]);
});

test('another tab accepting loads the tag here too; unrelated storage keys are ignored', () => {
  const b = fakeBrowser({});
  a.init(b.win);
  b.win.handlers.storage({ key: 'something_else' });
  assert.equal(b.scripts.length, 0);
  b.store.set('gb_consent', 'granted');
  b.win.handlers.storage({ key: 'gb_consent' });
  assert.equal(b.scripts.length, 1);
  assert.equal(b.find('gbc').length, 0, 'banner closed');
});

test('the banner links to the privacy policy only where the site has one', () => {
  const b = fakeBrowser({});
  a.init(b.win);
  const links = b.find('gbc__link');
  const expected = null;
  assert.equal(links.length, expected ? 1 : 0);
  if (expected) assert.equal(links[0].href, expected);
});
