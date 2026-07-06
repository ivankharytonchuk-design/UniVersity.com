/* ════════════════════════════════════════════════════════════════════════
   globeExperience.js — Region Selection Modal for UniVersity.com

   Fresh build on the PROVEN rendering path: Three.js + the battle-tested
   OrbitControls (the globe stays fixed at the centre, the camera orbits it),
   bright lighting, safe framing, and on-screen error reporting so failures
   are visible instead of silent.

   New filename on purpose → the browser cannot serve a stale cached module.
   ════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { COORDS, regionInfo } from './globeData.js?v=2';

const TEX = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const host = {
    countries: () => (window.ALL_COUNTRIES || []),
    nameOf:    (c) => (typeof window.countryNameByCode === 'function' ? window.countryNameByCode(c) : c.toUpperCase()),
    load:      (c) => { if (typeof window.loadCountry === 'function') window.loadCountry(c); },
    isFav:     (c) => (typeof window.isFavCountry === 'function' ? window.isFavCountry(c) : false),
    toggleFav: (c) => { if (typeof window.toggleFavCountry === 'function') window.toggleFavCountry(c); }
};

const CITIES = [
    ['London','gb'],['Oxford','gb'],['Cambridge','gb'],['Edinburgh','gb'],['Manchester','gb'],
    ['London, Ontario','ca'],['Toronto','ca'],['Vancouver','ca'],['Montréal','ca'],
    ['New York','us'],['Boston','us'],['Los Angeles','us'],['San Francisco','us'],['Chicago','us'],
    ['Madrid','es'],['Barcelona','es'],['Valencia','es'],['Seville','es'],
    ['Paris','fr'],['Lyon','fr'],['Toulouse','fr'],
    ['Berlin','de'],['Munich','de'],['Heidelberg','de'],['Aachen','de'],
    ['Milan','it'],['Bologna','it'],['Rome','it'],
    ['Amsterdam','nl'],['Delft','nl'],['Eindhoven','nl'],['Rotterdam','nl'],
    ['Zürich','ch'],['Lausanne','ch'],['Geneva','ch'],
    ['Stockholm','se'],['Lund','se'],['Uppsala','se'],
    ['Dublin','ie'],['Lisbon','pt'],['Porto','pt'],
    ['Tokyo','jp'],['Kyoto','jp'],['Osaka','jp'],
    ['Seoul','kr'],['Singapore','sg'],['Beijing','cn'],['Shanghai','cn'],['Hong Kong','hk'],
    ['Sydney','au'],['Melbourne','au'],['Auckland','nz']
];

/* ── geo helpers ──────────────────────────────────────────────────────── */
function latLngToVec3(lat, lng, r) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(
        -(r * Math.sin(phi) * Math.cos(theta)),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
    );
}
function vec3ToLatLng(v) {
    const r = v.length();
    const lat = 90 - Math.acos(v.y / r) * 180 / Math.PI;
    let lng = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180;
    while (lng < -180) lng += 360;
    while (lng > 180) lng -= 360;
    return { lat, lng };
}
function haversine(a, b) {
    const toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function nearestCountry(lat, lng) {
    let best = null, bestD = Infinity;
    for (const code in COORDS) {
        const d = haversine({ lat, lng }, COORDS[code]);
        if (d < bestD) { bestD = d; best = code; }
    }
    return best;
}
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ════════════════════════════════════════════════════════════════════════
   EarthGlobe — globe fixed at the origin, camera orbits via OrbitControls.
   ════════════════════════════════════════════════════════════════════════ */
const CAM_DIST = 5.5;          // default framing — globe a touch smaller, with generous margin
const MIN_DIST = 3.3;          // closest zoom that still keeps the whole globe in frame
const MAX_DIST = 8;

class EarthGlobe {
    constructor(canvas, { onPick, theme = 'light', onError }) {
        this.canvas = canvas;
        this.onPick = onPick;
        this.onError = onError;
        this.theme = theme;
        this.flight = null;
        this.idleTimer = null;
        this.pin = null;
        this._init();
    }

    _init() {
        const w = this.canvas.clientWidth || 800;
        const h = this.canvas.clientHeight || 600;

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(w, h, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(35, (w / h) || 1, 0.1, 100);
        this.camera.position.set(0, 0, CAM_DIST);

        // Bright, even lighting so every continent reads clearly.
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.05));
        this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a3350, 0.55));
        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(-1.6, 0.9, 2.2);
        this.scene.add(sun);

        this._buildEarth();
        this._buildAtmosphere();

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.07;
        this.controls.rotateSpeed = 0.5;
        this.controls.enablePan = false;
        this.controls.minDistance = MIN_DIST;
        this.controls.maxDistance = MAX_DIST;
        this.controls.autoRotate = !REDUCED;
        this.controls.autoRotateSpeed = 0.35;
        this.controls.addEventListener('start', () => { this.controls.autoRotate = false; clearTimeout(this.idleTimer); this.flight = null; });
        this.controls.addEventListener('end', () => { clearTimeout(this.idleTimer); this.idleTimer = setTimeout(() => { if (!REDUCED) this.controls.autoRotate = true; }, 3500); });

        this.ray = new THREE.Raycaster();
        this.canvas.addEventListener('pointerdown', this._onDown = (e) => { this._downAt = { x: e.clientX, y: e.clientY, t: Date.now() }; });
        this.canvas.addEventListener('pointerup', this._onUp = (e) => this._pick(e));

        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize);
        this._ro = new ResizeObserver(() => this.resize());
        this._ro.observe(this.canvas);
        requestAnimationFrame(() => this.resize());

        this._loop();
    }

    _buildEarth() {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');

        const mat = new THREE.MeshPhongMaterial({ color: 0x244a73, shininess: 6 });  // visible even before texture
        this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), mat);
        this.scene.add(this.earth);

        loader.load(
            TEX + 'earth_atmos_2048.jpg',
            (tex) => { tex.colorSpace = THREE.SRGBColorSpace; mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; this._ready(); },
            undefined,
            (err) => { console.warn('[globe] earth texture failed', err); this.onError && this.onError('Earth texture failed to load (network/CORS).'); this._ready(); }
        );
        loader.load(TEX + 'earth_specular_2048.jpg', (t) => { mat.specularMap = t; mat.specular = new THREE.Color(0x2a3a5a); mat.needsUpdate = true; });

        // Dark-theme city lights — additive shell.
        const lights = loader.load(TEX + 'earth_lights_2048.png');
        this.nightLights = new THREE.Mesh(
            new THREE.SphereGeometry(1.004, 64, 64),
            new THREE.MeshBasicMaterial({ map: lights, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: this.theme === 'dark' ? 0.6 : 0 })
        );
        this.scene.add(this.nightLights);

        this.pinGroup = new THREE.Group();
        this.scene.add(this.pinGroup);
    }

    _buildAtmosphere() {
        const mat = new THREE.ShaderMaterial({
            transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { glow: { value: new THREE.Color(0x4a90ff) } },
            vertexShader: `varying float vI; void main(){ vec3 n=normalize(normalMatrix*normal); vec3 v=normalize((modelViewMatrix*vec4(position,1.0)).xyz); vI=pow(0.72-dot(n,v),3.0); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
            fragmentShader: `uniform vec3 glow; varying float vI; void main(){ gl_FragColor=vec4(glow,1.0)*clamp(vI,0.0,1.0); }`
        });
        this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.0, 64, 64), mat);
        this.atmosphere.scale.setScalar(1.16);
        this.scene.add(this.atmosphere);
    }

    _ready() { if (!this._readyFired) { this._readyFired = true; this.onReady && this.onReady(); } }

    _pick(e) {
        if (!this._downAt) return;
        const moved = Math.hypot(e.clientX - this._downAt.x, e.clientY - this._downAt.y);
        if (moved > 6 || Date.now() - this._downAt.t > 500) return;   // it was a drag, not a click
        const rect = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        this.ray.setFromCamera(ndc, this.camera);
        const hit = this.ray.intersectObject(this.earth, false)[0];
        if (!hit) return;
        const { lat, lng } = vec3ToLatLng(hit.point.clone());   // globe never rotates → world == local
        const code = nearestCountry(lat, lng);
        if (code) this.onPick(code);
    }

    focus(code, { fly = true } = {}) {
        const co = COORDS[code];
        if (!co) return;
        this._dropPin(co.lat, co.lng);
        if (!fly) return;

        this.controls.autoRotate = false;
        clearTimeout(this.idleTimer);
        const dir = latLngToVec3(co.lat, co.lng, 1).normalize();
        const dist = Math.min(Math.max(this.camera.position.length(), CAM_DIST), CAM_DIST + 0.2);
        const to = dir.multiplyScalar(dist);
        const from = this.camera.position.clone();

        if (REDUCED) { this.camera.position.copy(to); this.camera.lookAt(0, 0, 0); this.controls.update(); this._resumeIdle(); return; }
        this.controls.enabled = false;
        const start = performance.now(), dur = 1100;
        this.flight = (now) => {
            const t = Math.min((now - start) / dur, 1);
            this.camera.position.lerpVectors(from, to, easeInOut(t));
            this.camera.lookAt(0, 0, 0);
            if (t >= 1) { this.flight = null; this.controls.enabled = true; this._resumeIdle(); }
        };
    }

    _resumeIdle() { clearTimeout(this.idleTimer); this.idleTimer = setTimeout(() => { if (!REDUCED) this.controls.autoRotate = true; }, 4000); }

    _dropPin(lat, lng) {
        if (this.pin) { this.pinGroup.remove(this.pin); this.pin = null; }
        const pos = latLngToVec3(lat, lng, 1.0);
        const grp = new THREE.Group();
        grp.position.copy(pos);
        grp.lookAt(0, 0, 0);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.06, 8), new THREE.MeshBasicMaterial({ color: 0xff7a18 }));
        stem.rotation.x = Math.PI / 2; stem.position.z = 0.03; grp.add(stem);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff7a18 }));
        dot.position.z = 0.065; grp.add(dot);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.038, 32), new THREE.MeshBasicMaterial({ color: 0xff7a18, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
        ring.position.z = 0.002; grp.add(ring);
        grp.userData = { ring, born: performance.now(), pos };
        this.pinGroup.add(grp);
        this.pin = grp;
    }

    pinScreen() {
        if (!this.pin) return null;
        const pos = this.pin.userData.pos;
        if (pos.clone().normalize().dot(this.camera.position.clone().normalize()) < 0.08) return null;
        const v = pos.clone().project(this.camera);
        const rect = this.canvas.getBoundingClientRect();
        return { x: (v.x * 0.5 + 0.5) * rect.width, y: (-v.y * 0.5 + 0.5) * rect.height };
    }

    dolly(factor) {
        const d = this.camera.position.length();
        const nd = Math.max(MIN_DIST, Math.min(MAX_DIST, d * factor));
        this.camera.position.multiplyScalar(nd / d);
        this.controls.update();
    }
    reset() {
        this.controls.autoRotate = !REDUCED;
        this.camera.position.set(0, 0, CAM_DIST);
        this.camera.lookAt(0, 0, 0);
        this.controls.update();
    }
    setTheme(theme) { this.theme = theme; if (this.nightLights) this.nightLights.material.opacity = (theme === 'dark' ? 0.6 : 0); }

    resize() {
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        if (!w || !h) return;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    }

    _loop() {
        const tick = (now) => {
            this.raf = requestAnimationFrame(tick);
            if (this.flight) this.flight(now);
            if (this.pin) {
                const age = ((now - this.pin.userData.born) % 1600) / 1600;
                const r = this.pin.userData.ring;
                r.scale.setScalar(1 + age * 2.4);
                r.material.opacity = 0.8 * (1 - age);
            }
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
            if (this.onFrame) this.onFrame();
        };
        this.raf = requestAnimationFrame(tick);
    }

    dispose() {
        cancelAnimationFrame(this.raf);
        clearTimeout(this.idleTimer);
        window.removeEventListener('resize', this._onResize);
        if (this._ro) this._ro.disconnect();
        this.canvas.removeEventListener('pointerdown', this._onDown);
        this.canvas.removeEventListener('pointerup', this._onUp);
        this.controls.dispose();
        this.renderer.dispose();
        this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); } });
    }
}

/* ════════════════════════════════════════════════════════════════════════
   RegionSelectionModal — DOM, search, info card, theme, hearts, globe.
   ════════════════════════════════════════════════════════════════════════ */
class RegionSelectionModal {
    constructor() {
        this.selected = null;
        this.suggestIndex = -1;
        this.theme = (localStorage.getItem('gm_theme') === 'dark') ? 'dark' : 'light';
        this._build();
    }

    _build() {
        const el = document.createElement('div');
        el.className = 'gm__overlay gm--' + this.theme;
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', 'Choose a region to find universities');
        el.innerHTML = this._html();
        document.body.appendChild(el);
        this.el = el;
        this.canvas   = el.querySelector('.gm__canvas');
        this.loading  = el.querySelector('.gm__stage__loading');
        this.fallback = el.querySelector('.gm__fallback');
        this.input    = el.querySelector('#gmSearchInput');
        this.suggest  = el.querySelector('#gmSuggest');
        this.pinLabel = el.querySelector('#gmPinLabel');
        this.info     = el.querySelector('#gmInfo');
        this._wireEvents();
    }

    _html() {
        const quick = ['us', 'gb', 'es', 'de', 'au', 'nl', 'ca', 'jp'];
        const chips = quick.map((c) => `<button class="gm__chip" data-code="${c}"><span class="fi fi-${c}"></span>${host.nameOf(c)}</button>`).join('');
        return `
        <div class="gm__shell">
          <div class="gm__topbtns">
            <button class="gm__iconbtn gm__theme" id="gmTheme" aria-label="Toggle light or dark theme" title="Toggle theme"><i class="fa-solid ${this.theme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i></button>
            <button class="gm__iconbtn gm__close" id="gmClose" aria-label="Close">&times;</button>
          </div>
          <div class="gm__stage">
            <div class="gm__stars"></div>
            <canvas class="gm__canvas" aria-label="Interactive 3D globe. Drag to rotate, scroll to zoom, click a region to select it."></canvas>
            <div class="gm__pin__label" id="gmPinLabel"></div>
            <div class="gm__stage__head">
              <span class="gm__eyebrow"><i class="fa-solid fa-earth-americas"></i> UniVersity · Global</span>
              <h2 class="gm__title">Find universities <em>anywhere on Earth</em></h2>
              <p class="gm__subtitle">Spin the globe or search a country, city or region to begin your journey.</p>
            </div>
            <div class="gm__globe__controls">
              <button class="gm__gc__btn" id="gmZoomIn" aria-label="Zoom in"><i class="fa-solid fa-plus"></i></button>
              <button class="gm__gc__btn" id="gmZoomOut" aria-label="Zoom out"><i class="fa-solid fa-minus"></i></button>
              <button class="gm__gc__btn" id="gmReset" aria-label="Reset view"><i class="fa-solid fa-arrows-rotate"></i></button>
            </div>
            <div class="gm__gc__hint"><i class="fa-solid fa-hand-pointer"></i> Drag to rotate · scroll to zoom · click to pick</div>
            <div class="gm__stage__loading" id="gmLoading"><div class="gm__spinner"></div></div>
            <div class="gm__fallback"><div><i class="fa-solid fa-earth-americas"></i><p id="gmFallbackMsg">Your browser couldn’t start the 3D globe.<br>Use the search on the right to pick a destination.</p></div></div>
          </div>
          <div class="gm__panel">
            <div class="gm__panel__bg" aria-hidden="true">
              <span class="gm__orb gm__orb--1"></span>
              <span class="gm__orb gm__orb--2"></span>
              <span class="gm__orb gm__orb--3"></span>
            </div>
            <div class="gm__panel__head">
              <div class="gm__panel__kicker"><span class="gm__live"></span> Live destination search</div>
              <div class="gm__search">
                <div class="gm__search__box">
                  <i class="fa-solid fa-magnifying-glass"></i>
                  <input id="gmSearchInput" type="text" autocomplete="off" spellcheck="false"
                         role="combobox" aria-expanded="false" aria-controls="gmSuggest" aria-autocomplete="list"
                         placeholder="Search country, city, region, or university destination…">
                  <span class="gm__search__kbd">Esc</span>
                </div>
                <div class="gm__suggest" id="gmSuggest" role="listbox"></div>
              </div>
            </div>
            <div class="gm__quick">
              <div class="gm__quick__label">Popular destinations</div>
              <div class="gm__quick__row">${chips}</div>
            </div>
            <div class="gm__info" id="gmInfo">
              <div class="gm__info__empty" id="gmInfoEmpty">
                <div class="gm__quote">
                  <img src="images/logo2.png" alt="">
                  <p>“The world is a book, and those who do not travel <span>read only one page.”</span></p>
                  <cite>Saint <b>Augustine</b></cite>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }

    _wireEvents() {
        const close = () => this.close();
        this.el.querySelector('#gmClose').addEventListener('click', close);
        this.el.querySelector('#gmTheme').addEventListener('click', () => this._setTheme(this.theme === 'dark' ? 'light' : 'dark'));
        this.el.addEventListener('mousedown', (e) => { if (e.target === this.el) close(); });
        this.el.querySelector('#gmZoomIn').addEventListener('click', () => this.globe && this.globe.dolly(0.82));
        this.el.querySelector('#gmZoomOut').addEventListener('click', () => this.globe && this.globe.dolly(1.22));
        this.el.querySelector('#gmReset').addEventListener('click', () => this.globe && this.globe.reset());
        this.el.querySelectorAll('.gm__chip').forEach((b) => b.addEventListener('click', () => this.select(b.dataset.code)));
        this.input.addEventListener('input', () => this._renderSuggest(this.input.value));
        this.input.addEventListener('focus', () => { if (this.input.value) this._renderSuggest(this.input.value); });
        this.input.addEventListener('keydown', (e) => this._suggestKeys(e));
        this.suggest.addEventListener('mousedown', (e) => {
            const heart = e.target.closest('.gm__fav');
            if (heart) { e.preventDefault(); e.stopPropagation(); host.toggleFav(heart.dataset.fav); this._renderSuggest(this.input.value); return; }
            const row = e.target.closest('.gm__suggest__row');
            if (row) { e.preventDefault(); this.select(row.dataset.code); }
        });
        this._onKey = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._onKey);
    }

    _setTheme(theme) {
        this.theme = theme;
        localStorage.setItem('gm_theme', theme);
        this.el.classList.toggle('gm--dark', theme === 'dark');
        this.el.classList.toggle('gm--light', theme === 'light');
        const icon = this.el.querySelector('#gmTheme i');
        if (icon) icon.className = 'fa-solid ' + (theme === 'dark' ? 'fa-sun' : 'fa-moon');
        if (this.globe) this.globe.setTheme(theme);
    }

    _matches(q) {
        q = q.trim().toLowerCase();
        if (!q) return [];
        const out = [];
        host.countries().forEach((c) => {
            const n = c.name.toLowerCase();
            const i = n.indexOf(q);
            if (i !== -1 || c.code === q) {
                const r = regionInfo(c.code, c.name);
                out.push({ kind: 'country', code: c.code, label: c.name, q, meta: r.curated ? `${r.count} universities · ${r.cont}` : r.cont, rank: (i === 0 ? 0 : 1) });
            }
        });
        CITIES.forEach(([city, code]) => {
            const i = city.toLowerCase().indexOf(q);
            if (i !== -1) out.push({ kind: 'city', code, label: city, q, meta: host.nameOf(code), rank: (i === 0 ? 0 : 2) + 0.5 });
        });
        out.sort((a, b) => a.rank - b.rank || a.label.length - b.label.length);
        return out.slice(0, 8);
    }

    _renderSuggest(q) {
        const hits = this._matches(q);
        this.suggestIndex = -1;
        if (!q.trim()) { this._closeSuggest(); return; }
        if (!hits.length) {
            this.suggest.innerHTML = `<div class="gm__suggest__empty">No destination found for “${q}”</div>`;
        } else {
            this.suggest.innerHTML = hits.map((h) => {
                const hl = h.label.replace(new RegExp('(' + h.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i'), '<b>$1</b>');
                const icon = h.kind === 'country' ? `<span class="fi fi-${h.code}"></span>` : `<span class="gm__suggest__ico"><i class="fa-solid fa-location-dot"></i></span>`;
                const fav = host.isFav(h.code);
                return `<div class="gm__suggest__row" role="option" data-code="${h.code}">
                    ${icon}
                    <div class="gm__suggest__txt"><div class="gm__suggest__name">${hl}</div><div class="gm__suggest__meta">${h.meta}</div></div>
                    <span class="gm__suggest__tag">${h.kind}</span>
                    <button class="gm__fav${fav ? ' is-fav' : ''}" data-fav="${h.code}" tabindex="-1" aria-label="${fav ? 'Saved to your countries' : 'Save to your countries'}" title="${fav ? 'Saved' : 'Save to your countries'}"><i class="fa-${fav ? 'solid' : 'regular'} fa-heart"></i></button>
                </div>`;
            }).join('');
        }
        this.suggest.classList.add('gm--open');
        this.input.setAttribute('aria-expanded', 'true');
    }

    _closeSuggest() { this.suggest.classList.remove('gm--open'); this.suggest.innerHTML = ''; this.input.setAttribute('aria-expanded', 'false'); this.suggestIndex = -1; }

    _suggestKeys(e) {
        const rows = [...this.suggest.querySelectorAll('.gm__suggest__row')];
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!rows.length) return;
            this.suggestIndex = (this.suggestIndex + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
            rows.forEach((r, i) => r.classList.toggle('gm--active', i === this.suggestIndex));
            rows[this.suggestIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            const row = rows[this.suggestIndex] || rows[0];
            if (row) { e.preventDefault(); this.select(row.dataset.code); }
        } else if (e.key === 'Escape') {
            if (this.suggest.classList.contains('gm--open')) { e.stopPropagation(); this._closeSuggest(); }
        }
    }

    select(code) {
        if (!code) return;
        this.selected = code;
        const name = host.nameOf(code);
        this.input.value = name;
        this._closeSuggest();
        if (this.globe) this.globe.focus(code, { fly: true });
        this._renderCard(code, name);
        this._updatePinLabel(code, name);
    }

    _updatePinLabel(code, name) { this.pinLabel.innerHTML = `<span class="fi fi-${code}"></span>${name}`; this.pinLabel.classList.add('gm--show'); }

    _renderCard(code, name) {
        const r = regionInfo(code, name);
        const flagUrl = `https://flagcdn.com/w320/${code}.png`;
        const cities = r.cities.length
            ? `<div class="gm__cities"><div class="gm__cities__label">Top student cities</div><div class="gm__cities__row">${r.cities.map((c) => `<span class="gm__city"><i class="fa-solid fa-location-dot"></i>${c}</span>`).join('')}</div></div>` : '';
        this.info.innerHTML = `
        <div class="gm__card gm--show">
          <div class="gm__card__top">
            <div class="gm__card__flag" style="background-image:url('${flagUrl}')"></div>
            <div class="gm__card__head"><div class="gm__card__name">${name}</div><div class="gm__card__region"><i class="fa-solid fa-earth-americas"></i> ${r.cont}</div></div>
            <button class="gm__card__fav${host.isFav(code) ? ' is-fav' : ''}" id="gmFav" aria-label="Save to your countries" title="Save to your countries"><i class="fa-${host.isFav(code) ? 'solid' : 'regular'} fa-heart"></i></button>
          </div>
          <div class="gm__stats">
            <div class="gm__stat"><div class="gm__stat__k"><i class="fa-solid fa-building-columns"></i> Universities</div><div class="gm__stat__v">${r.count}</div></div>
            <div class="gm__stat"><div class="gm__stat__k"><i class="fa-solid fa-coins"></i> Tuition / year</div><div class="gm__stat__v" style="font-size:15px">${r.fee}</div></div>
          </div>
          <p class="gm__card__sum">${r.sum}</p>
          ${cities}
          <button class="gm__card__cta" id="gmGo">Explore ${name} <i class="fa-solid fa-arrow-right"></i></button>
          <div class="gm__card__hint">Opens the full destination guide</div>
        </div>`;
        const go = this.info.querySelector('#gmGo');
        go.addEventListener('click', () => this._commit(code));
        go.focus({ preventScroll: true });
        const fav = this.info.querySelector('#gmFav');
        fav.addEventListener('click', () => {
            host.toggleFav(code);
            const on = host.isFav(code);
            fav.classList.toggle('is-fav', on);
            fav.querySelector('i').className = 'fa-' + (on ? 'solid' : 'regular') + ' fa-heart';
            fav.title = on ? 'Saved to your countries' : 'Save to your countries';
        });
    }

    _commit(code) { host.load(code); this.close(); }

    open() {
        document.body.classList.add('gm--locked');
        requestAnimationFrame(() => this.el.classList.add('gm--open'));
        this._lastFocus = document.activeElement;
        try {
            this.globe = new EarthGlobe(this.canvas, {
                theme: this.theme,
                onPick: (code) => this.select(code),
                onError: (msg) => { const m = this.el.querySelector('#gmFallbackMsg'); if (m) m.innerHTML = msg + '<br>Use the search on the right instead.'; this.fallback.classList.add('gm--show'); }
            });
            this.globe.onReady = () => this.loading.classList.add('gm--hide');
            this.globe.onFrame = () => this._trackPin();
            setTimeout(() => this.loading.classList.add('gm--hide'), 4000);
        } catch (err) {
            console.warn('[globe] WebGL unavailable:', err);
            this.loading.classList.add('gm--hide');
            const m = this.el.querySelector('#gmFallbackMsg');
            if (m) m.innerHTML = 'Could not start WebGL: ' + (err && err.message ? err.message : err) + '<br>Use the search on the right instead.';
            this.fallback.classList.add('gm--show');
        }
        setTimeout(() => this.input.focus({ preventScroll: true }), 450);
    }

    _trackPin() {
        if (!this.globe) return;
        const p = this.globe.pinScreen();
        if (!p) { this.pinLabel.classList.remove('gm--show'); return; }
        if (this.selected) this.pinLabel.classList.add('gm--show');
        this.pinLabel.style.left = p.x + 'px';
        this.pinLabel.style.top = p.y + 'px';
    }

    close() {
        this.el.classList.remove('gm--open');
        document.body.classList.remove('gm--locked');
        document.removeEventListener('keydown', this._onKey);
        if (this.globe) this.globe.dispose();
        setTimeout(() => { this.el.remove(); if (this._lastFocus && this._lastFocus.focus) this._lastFocus.focus(); }, 480);
        _instance = null;
    }
}

/* ── Public API + host wiring ─────────────────────────────────────────── */
let _instance = null;
export function openRegionModal() {
    if (_instance) return _instance;
    _instance = new RegionSelectionModal();
    _instance.open();
    return _instance;
}
window.openRegionModal = openRegionModal;

function bindLauncher() {
    const input = document.getElementById('csSearchInput');
    if (!input || input.dataset.gmBound) return;
    input.dataset.gmBound = '1';
    input.readOnly = true;
    input.style.cursor = 'pointer';
    const launch = (e) => { e.preventDefault(); input.blur(); openRegionModal(); };
    input.addEventListener('mousedown', launch);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') launch(e); });
}
if (document.readyState !== 'loading') bindLauncher();
else document.addEventListener('DOMContentLoaded', bindLauncher);
document.addEventListener('click', (e) => { if (e.target.closest('#csChangeBtn')) setTimeout(bindLauncher, 60); });
