/* dictionaryLoader.js — drop-in loader for GitHub Pages or local.
   Loads big words_dictionary.json (JSON array, JSON object, or newline text)
   and merges a tiny local words.txt for fast UI.

   Usage in index.html (before your game logic):
     <script src="./dictionaryLoader.js"></script>
     <script>
       window.addEventListener('DOMContentLoaded', async () => {
         await DictionaryLoader.load();
         console.log('Dictionary ready:', DictionaryLoader.ready, 'size:', DictionaryLoader.size);
       });
     </script>

   Validate a word anywhere:
     const ok = DictionaryLoader.has('apple');
*/
(function attachDictionaryLoader(global) {
  const Dict = { set: new Set(), size: 0, ready: false };

  function addText(text) {
    text.split(/\r?\n/).forEach(line => {
      const w = String(line || '').trim().toLowerCase();
      if (w && /^[a-z][a-z'-]*[a-z]$/.test(w)) Dict.set.add(w);
    });
    Dict.size = Dict.set.size;
  }

  function addJSON(body) {
    const data = JSON.parse(body);
    if (Array.isArray(data)) data.forEach(w => Dict.set.add(String(w).toLowerCase()));
    else if (data && typeof data === 'object') Object.keys(data).forEach(k => Dict.set.add(k.toLowerCase()));
    Dict.size = Dict.set.size;
  }

  function baseURL() {
    const p = location.pathname;
    return p.endsWith('/') ? p : p.replace(/\/[^/]*$/, '/');
  }

  async function fetchText(url) {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
    return res.text();
  }

  async function load(opts = {}) {
    const { urlOverride } = opts;

    // 0) Tiny seed so UI appears fast
    for (const u of [ baseURL() + 'words.txt', baseURL() + 'public/words.txt' ]) {
      try { addText(await fetchText(u)); break; } catch {}
    }

    // 1) Choose big dictionary URL
    let bigURL = urlOverride || (baseURL() + 'words_dictionary.json');
    let triedRootFirst = true;

    async function fetchBig() {
      try {
        const body = await fetchText(bigURL);
        try { addJSON(body); } catch { addText(body); }
        Dict.ready = true;
        return;
      } catch (e1) {
        if (triedRootFirst) {
          triedRootFirst = false;
          bigURL = baseURL() + 'public/words_dictionary.json';
        } else {
          bigURL = baseURL() + 'words_dictionary.json';
        }
        const body2 = await fetchText(bigURL);
        try { addJSON(body2); } catch { addText(body2); }
        Dict.ready = true;
      }
    }

    try { await fetchBig(); }
    catch (e) {
      console.warn('Dictionary load failed:', e && e.message ? e.message : e);
      Dict.ready = Dict.set.size > 0;
    }

    return { size: Dict.size, ready: Dict.ready };
  }

  function has(word) {
    const s = String(word || '').trim().toLowerCase();
    if (!s) return false;
    if (Dict.set.has(s)) return true;
    if (/'s$/.test(s) && Dict.set.has(s.replace(/'s$/, ''))) return true;
    const noHyphen = s.replace(/-/g, '');
    if (noHyphen !== s && Dict.set.has(noHyphen)) return true;
    return false;
  }

  global.DictionaryLoader = {
    load, has,
    get size() { return Dict.size; },
    get ready() { return Dict.ready; }
  };
})(window);
