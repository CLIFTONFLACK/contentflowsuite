/* Google Analytics 4 behind a cookie choice (self-contained, no dependencies).
   GA4 property "GetBrian - ContentFlowSuite" (G-72BTWXNBSD).

   Basic Consent Mode: gtag.js is not requested at all until the visitor accepts, so nothing
   goes to Google before consent. The choice lives in localStorage (key gb_consent) on this
   device, with an in-memory fallback if storage is blocked. Declining or withdrawing switches
   the tag off and deletes the _ga cookies. Consent Mode v2 signals: analytics granted, the
   three advertising signals always denied; Google signals and ad personalisation off. The
   address sent to Google has no query string (except utm_*) and no fragment, and the referrer
   is blank for same-site referrers and origin-only for external ones; cookies are host-only.

   Only flow.getbrian.xyz report. Preview hosts never load the tag; localhost shows the banner so it
   can be built against but does not load the tag either.

   Loaded with `defer`. Also requirable from node for tests. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.init(root);
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var GA_ID = 'G-72BTWXNBSD';
  var KEY = 'gb_consent';
  var PRIVACY = null;

  /** The only hosts that report to this property. */
  function isTrackedHost(hostname) {
    var h = String(hostname || '').toLowerCase();
    return h === 'flow.getbrian.xyz';
  }

  /** The banner shows where it can take effect, plus localhost for development. */
  function showsBanner(hostname) {
    var h = String(hostname || '').toLowerCase();
    return isTrackedHost(h) || h === 'localhost' || h === '127.0.0.1';
  }

  /** Pages that never load the tag or show the banner. */
  function isExcludedPath(pathname) {
    var p = String(pathname || '');
    return false;
  }

  function parseConsent(raw) {
    return raw === 'granted' || raw === 'denied' ? raw : null;
  }

  /** gtag.js sets _ga, _ga_<container>, _gid and _gat / _gat_*. */
  function isGaCookieName(name) {
    return name === '_ga' || name === '_gid' || name.indexOf('_ga_') === 0 || name === '_gat' || name.indexOf('_gat_') === 0;
  }

  /** Expire GA cookies on this host only: the tag uses a host-only cookie_domain, so it never writes
      to the shared parent domain and withdrawing here must not delete a sibling site's cookies. */
  function clearGaCookies(doc, hostname) {
    var gone = 'expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    doc.cookie.split(';').forEach(function (pair) {
      var name = pair.split('=')[0].trim();
      if (!name || !isGaCookieName(name)) return;
      doc.cookie = name + '=; ' + gone + '; domain=.' + hostname;
      doc.cookie = name + '=; ' + gone + '; domain=' + hostname;
      doc.cookie = name + '=; ' + gone;
    });
  }

  var CSS =
    '.gbc{position:fixed;z-index:2147483000;left:16px;right:16px;bottom:16px;max-width:448px;box-sizing:border-box;' +
    'padding:20px 20px max(20px,env(safe-area-inset-bottom));background:#fff;color:#14172b;border:1px solid rgba(20,23,43,.18);' +
    'border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);font:400 15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '@media(min-width:640px){.gbc{left:auto}}' +
    '.gbc *{box-sizing:border-box}' +
    '.gbc__title{margin:0 0 4px;font-size:17px;font-weight:700;color:#8a6520}' +
    '.gbc__text{margin:0;color:#454a64}' +
    '.gbc__link{color:#14172b;text-decoration:underline;text-underline-offset:2px}' +
    '.gbc__row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}' +
    '.gbc__btn{min-height:48px;padding:0 16px;border-radius:999px;font:600 16px/1 inherit;cursor:pointer;border:1px solid #8a6520;background:#fff;color:#8a6520}' +
    '.gbc__btn:hover{background:#f3f4f6}' +
    '.gbc__btn--yes{background:#ba8b32;border-color:#ba8b32;color:#14172b}' +
    '.gbc__btn--yes:hover{background:#a87b2a}' +
    '.gbc__chip{position:fixed;z-index:2147482000;left:12px;bottom:12px;min-height:44px;padding:0 16px;border-radius:999px;' +
    'background:#fff;color:#454a64;border:1px solid rgba(20,23,43,.18);box-shadow:0 2px 8px rgba(0,0,0,.12);font:500 12px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer}' +
    '.gbc__chip:hover{color:#14172b}' +
    '.gbc__btn:focus-visible,.gbc__chip:focus-visible,.gbc__link:focus-visible{outline:2px solid #35629f;outline-offset:2px}' +
    '@media(prefers-reduced-motion:reduce){.gbc *{transition:none!important}}';

  function init(win) {
    var doc = win.document;
    var loc = win.location;
    var host = loc.hostname;
    if (!showsBanner(host) || isExcludedPath(loc.pathname)) return;

    var memory = null;
    var loaded = false;
    var banner = null;
    var chip = null;

    function read() {
      try {
        return parseConsent(win.localStorage.getItem(KEY)) || memory;
      } catch (e) {
        return memory; // never consent unless the visitor chose it this page view
      }
    }

    function write(value) {
      memory = value;
      try {
        win.localStorage.setItem(KEY, value);
      } catch (e) {
        /* storage blocked: memory carries the choice for this page view */
      }
    }

    function gtagUpdate(value) {
      if (typeof win.gtag === 'function') win.gtag('consent', 'update', { analytics_storage: value });
    }

    function cleanLocation() {
      var u = new URL(loc.href);
      Array.from(u.searchParams.keys()).forEach(function (k) {
        if (!/^utm_/i.test(k)) u.searchParams.delete(k);
      });
      u.hash = '';
      return u.toString();
    }

    function cleanReferrer() {
      try {
        var r = new URL(doc.referrer);
        if (r.origin !== loc.origin) return r.origin;
      } catch (e) { /* no referrer */ }
      return '';
    }

    function loadTag() {
      if (loaded || !isTrackedHost(host)) return;
      loaded = true;
      win.dataLayer = win.dataLayer || [];
      win.gtag = function () { win.dataLayer.push(arguments); };
      win.gtag('consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      win.gtag('js', new Date());
      win.gtag('config', GA_ID, {
        page_location: cleanLocation(),
        page_referrer: cleanReferrer(),
        cookie_domain: host,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
      var s = doc.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
      doc.head.appendChild(s);
    }

    function apply(consent) {
      win['ga-disable-' + GA_ID] = consent !== 'granted';
      if (consent === 'granted') {
        if (loaded) gtagUpdate('granted'); else loadTag();
      } else if (consent === 'denied') {
        gtagUpdate('denied');
        clearGaCookies(doc, host);
      }
    }

    function el(tag, className, text) {
      var n = doc.createElement(tag);
      if (className) n.className = className;
      if (text) n.textContent = text;
      return n;
    }

    function ensureStyles() {
      if (doc.getElementById && doc.getElementById('gbc-css')) return;
      var st = el('style');
      st.id = 'gbc-css';
      st.textContent = CSS;
      doc.head.appendChild(st);
    }

    function closeBanner() {
      if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
      banner = null;
    }

    function choose(value) {
      write(value);
      closeBanner();
      apply(value);
      renderChip();
    }

    function openBanner() {
      if (banner) return;
      ensureStyles();
      if (chip && chip.parentNode) chip.parentNode.removeChild(chip);
      chip = null;
      banner = el('section', 'gbc');
      banner.setAttribute('aria-label', 'Cookie choice');
      banner.appendChild(el('h2', 'gbc__title', 'Cookies'));
      var text = el('p', 'gbc__text',
        'Can we use Google Analytics cookies to see which pages people visit? No ads and nothing is sold. ' +
        'We remember your choice on this device, and you can change it any time with the “Cookie settings” button.');
      if (PRIVACY) {
        text.appendChild(doc.createTextNode(' '));
        var more = el('a', 'gbc__link', 'Privacy policy');
        more.href = PRIVACY;
        text.appendChild(more);
      }
      banner.appendChild(text);
      var row = el('div', 'gbc__row');
      var decline = el('button', 'gbc__btn', 'Decline');
      var accept = el('button', 'gbc__btn gbc__btn--yes', 'Accept');
      decline.type = accept.type = 'button';
      decline.addEventListener('click', function () { choose('denied'); });
      accept.addEventListener('click', function () { choose('granted'); });
      row.appendChild(decline);
      row.appendChild(accept);
      banner.appendChild(row);
      doc.body.appendChild(banner);
    }

    function renderChip() {
      if (chip || banner || read() === null) return;
      ensureStyles();
      chip = el('button', 'gbc__chip', 'Cookie settings');
      chip.type = 'button';
      chip.addEventListener('click', openBanner);
      doc.body.appendChild(chip);
    }

    // Another tab changed or removed the choice.
    win.addEventListener('storage', function (e) {
      if (e.key !== null && e.key !== KEY) return; // a null key means storage was cleared
      memory = null; // storage works (it just fired), so it is the source of truth again
      var now = read();
      win['ga-disable-' + GA_ID] = now !== 'granted';
      if (now) {
        closeBanner();
        apply(now);
        renderChip();
      } else {
        gtagUpdate('denied');
        clearGaCookies(doc, host);
        openBanner();
      }
    });

    var current = read();
    win['ga-disable-' + GA_ID] = current !== 'granted';
    if (current === null) openBanner();
    else {
      apply(current);
      renderChip();
    }
  }

  return {
    GA_ID: GA_ID,
    isTrackedHost: isTrackedHost,
    showsBanner: showsBanner,
    isExcludedPath: isExcludedPath,
    parseConsent: parseConsent,
    isGaCookieName: isGaCookieName,
    clearGaCookies: clearGaCookies,
    init: init
  };
});
