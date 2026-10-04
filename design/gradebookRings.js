/* ════════════════════════════════════════════════════════════════════
   Gradebook — the average card, with a black hole.
   Left: the average (counting up), the one thing to know, an IB diploma
   bar and a readiness meter. Right: a Schwarzschild black hole, ray-traced
   on the GPU the way the film Interstellar did it — every pixel follows a
   light ray backwards through the curved space around the hole. In the
   ray's own plane light obeys Binet's equation for Schwarzschild,
       u'' + u = (3/2)·u²      (u = 1/r, units: Schwarzschild radius = 1)
   marched in fixed steps of angle, so the accretion disk shows up above
   and below the shadow, the photon ring hugs the shadow, and background
   stars are smeared into arcs around it.
   The disk is a thin Novikov–Thorne disk from the innermost stable orbit
   (3 r_s) outwards: blackbody colour from its temperature profile,
   relativistic Doppler beaming and gravitational redshift (the side coming
   towards you is brighter and bluer), turbulence that shears with
   Keplerian speed and a few hot spots whose lensed images run around the
   photon ring.
   Your subjects orbit just outside the disk. Their rings and mark widgets
   are drawn where the light actually reaches you: each point of each orbit
   is found by solving for the ray that lands on it (Newton's method on the
   same equation), so the far side of every orbit lifts over the shadow.
   A lit trail on each orbit is the mark (a full orbit = full marks); the
   lime tick is what your dream university asks for. Hover a mark for the
   details, click it for the marks table; hover the shadow or the photon
   ring for what they are.
   Frame rate: capped at 60 fps, resolution adapts if frames run late,
   paused whenever the card is off-screen, covered by a modal, the tab is
   hidden or another page is open; one still frame under prefers-reduced-motion.
   Data comes from mainPage.js through window.gbSnapshot().
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var stage = document.getElementById('gkStage'), tab = document.getElementById('tabGradebook'), card = document.getElementById('gkCard');
    if (!stage || !tab || !card) return;
    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function num(v) { var r = Math.round(v * 10) / 10; return r % 1 ? r.toFixed(1) : String(r); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    /* ── The scene (units: Schwarzschild radius r_s = 1) ────────────── */
    var CAM_D = 24, CAM_EL = 13 * Math.PI / 180;          // camera distance and height above the disk plane
    var DISK_IN = 3.0, DISK_OUT = 6.6;                    // innermost stable orbit → outer edge
    var RING_IN = 7.4, RING_OUT = 11.2;                   // where the subjects orbit
    var SPEED = 3.0;                                      // r_s/c per second: inner disk ≈ 15 s a turn
    var B_CRIT = 1.5 * Math.sqrt(3);                      // critical impact parameter (shadow edge), 2.598 r_s
    var MAX_RINGS = 7, SAMPLES = 144;

    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function norm(a) { var l = Math.sqrt(dot(a, a)); return [a[0] / l, a[1] / l, a[2] / l]; }
    var CAM = [0, CAM_D * Math.sin(CAM_EL), CAM_D * Math.cos(CAM_EL)];
    var FWD = norm([-CAM[0], -CAM[1], -CAM[2]]), RIGHT = norm(cross(FWD, [0, 1, 0])), UP = cross(RIGHT, FWD);

    /* Viewport in CSS px: black hole centre (cx, cy) and k = tan(angle) per px. */
    var VP = { W: 0, H: 0, cx: 0, cy: 0, k: 1 };
    function layoutView() {
        var W = stage.clientWidth, H = stage.clientHeight, narrow = W < 420 || (window.matchMedia && window.matchMedia('(max-width: 640px)').matches);
        VP.W = W; VP.H = H;
        VP.cx = W * 0.5;
        VP.cy = H * (narrow ? 0.46 : 0.45);
        // fit the widest orbit (±11.2 r_s plus a mark widget) inside the stage, the lensed halo above it and the caption below
        var unitsPx = Math.max(6, Math.min((W - VP.cx - 26) / 12.4, (VP.cx - 26) / 12.4, (VP.cy - 12) / 8.2, (H - VP.cy - 46) / 4.6));
        VP.k = 1 / (unitsPx * CAM_D);
        stage.style.setProperty('--cx', VP.cx + 'px'); stage.style.setProperty('--cy', VP.cy + 'px');
    }
    function rayDir(sx, sy) {
        var dx = (sx - VP.cx) * VP.k, dy = (VP.cy - sy) * VP.k;
        return norm([FWD[0] + RIGHT[0] * dx + UP[0] * dy, FWD[1] + RIGHT[1] * dx + UP[1] * dy, FWD[2] + RIGHT[2] * dx + UP[2] * dy]);
    }
    function project(p) {
        var rel = sub(p, CAM), Z = dot(rel, FWD);
        return { x: VP.cx + dot(rel, RIGHT) / (Z * VP.k), y: VP.cy - dot(rel, UP) / (Z * VP.k), z: Z };
    }

    /* The same march the shader runs (Binet's equation in the ray's plane, fixed angular step).
       Returns where the ray first crosses the disk plane, or null if the hole swallows it. */
    var DP = 0.028, CD = Math.cos(DP), SD = Math.sin(DP), R0 = Math.sqrt(dot(CAM, CAM)), E1 = [CAM[0] / R0, CAM[1] / R0, CAM[2] / R0];
    function firstCrossing(sx, sy) {
        var dir = rayDir(sx, sy), nn = cross(E1, dir), nl = Math.sqrt(dot(nn, nn));
        if (nl < 1e-9) return null;
        var n = [nn[0] / nl, nn[1] / nl, nn[2] / nl], e2 = cross(n, E1), vr = dot(dir, E1), vt = dot(dir, e2);
        var dp = DP * Math.min(1, Math.max(.06, vt * 20)), cd = Math.cos(dp), sd = Math.sin(dp);
        var u = 1 / R0, du = -u * vr / Math.max(vt, 1e-4), f = -u + 1.5 * u * u, c = 1, s = 0, y0 = E1[1];
        for (var i = 0; i < 700; i++) {
            var u1 = u + du * dp + .5 * f * dp * dp, f1 = -u1 + 1.5 * u1 * u1, du1 = du + .5 * (f + f1) * dp;
            var c1 = c * cd - s * sd, s1 = s * cd + c * sd, y1 = c1 * E1[1] + s1 * e2[1];
            if (y0 * y1 < 0) {
                var t = y0 / (y0 - y1), uh = u + (u1 - u) * t, ch = c + (c1 - c) * t, sh = s + (s1 - s) * t, L = Math.sqrt(ch * ch + sh * sh), rh = 1 / uh;
                ch /= L; sh /= L;
                return { x: rh * (ch * E1[0] + sh * e2[0]), z: rh * (ch * E1[2] + sh * e2[2]) };
            }
            if (u1 > 1) return null;
            if (u1 < .025 && du1 < 0) return null;
            u = u1; du = du1; f = f1; c = c1; s = s1; y0 = y1;
        }
        return null;
    }
    // Screen point whose light comes from (tx, 0, tz): Newton's method on firstCrossing.
    function solve(tx, tz, guess) {
        var s = guess ? { x: guess.x, y: guess.y } : project([tx, 0, tz]), E = 0.6;
        for (var it = 0; it < 12; it++) {
            var h = firstCrossing(s.x, s.y); if (!h) return null;
            var ex = h.x - tx, ez = h.z - tz;
            if (ex * ex + ez * ez < 2e-4) return s;
            var hx = firstCrossing(s.x + E, s.y), hy = firstCrossing(s.x, s.y + E); if (!hx || !hy) return null;
            var j00 = (hx.x - h.x) / E, j01 = (hy.x - h.x) / E, j10 = (hx.z - h.z) / E, j11 = (hy.z - h.z) / E, det = j00 * j11 - j01 * j10;
            if (Math.abs(det) < 1e-12) return null;
            var mx = (j11 * ex - j01 * ez) / det, my = (-j10 * ex + j00 * ez) / det, m = Math.sqrt(mx * mx + my * my);
            if (m > 30) { mx *= 30 / m; my *= 30 / m; }
            s.x -= mx; s.y -= my;
        }
        var hf = firstCrossing(s.x, s.y);
        return hf && (hf.x - tx) * (hf.x - tx) + (hf.z - tz) * (hf.z - tz) < 4e-3 ? s : null;
    }
    // One table per orbit: the lensed screen position of SAMPLES points around it.
    function buildTable(R) {
        var out = [], prev = null;
        for (var j = 0; j < SAMPLES; j++) {
            var ph = j / SAMPLES * Math.PI * 2, tx = R * Math.cos(ph), tz = R * Math.sin(ph);
            var pr = project([tx, 0, tz]);
            // warm start from the neighbour; else the flat projection; else (behind the hole) just above the
            // shadow, where the Einstein-ring image of a point straight behind it sits: b ≈ √(2R)
            var s = (prev && solve(tx, tz, prev)) || solve(tx, tz, null) || solve(tx, tz, { x: pr.x, y: VP.cy - (Math.sqrt(2 * R) + .4) / (CAM_D * VP.k) });
            out.push(s ? { x: s.x, y: s.y, z: pr.z, ok: true } : { x: 0, y: 0, z: pr.z, ok: false });
            if (s) prev = s;
        }
        // Drop isolated jumps (Newton landing on the wrong image): a point whose two neighbours sit close
        // together while it sits far from both. Lensing can stretch an orbit, but never like that.
        for (var pass = 1; pass <= 2; pass++) out.forEach(function (pt, q) {
            if (!pt.ok) return;
            var L = out[(q + SAMPLES - pass) % SAMPLES], Rr = out[(q + pass) % SAMPLES];
            if (!L.ok || !Rr.ok) return;
            var dLR = Math.hypot(L.x - Rr.x, L.y - Rr.y) / (pass + 1), dl = Math.hypot(pt.x - L.x, pt.y - L.y) / pass, dr = Math.hypot(pt.x - Rr.x, pt.y - Rr.y) / pass;
            if (dl > 3 * dLR + 4 && dr > 3 * dLR + 4) pt.ok = false;
        });
        var gaps = [];
        for (var q = 0; q < SAMPLES; q++) { var A = out[q], Bq = out[(q + 1) % SAMPLES]; if (A.ok && Bq.ok) gaps.push(Math.hypot(Bq.x - A.x, Bq.y - A.y)); }
        gaps.sort(function (x, y) { return x - y; });
        out.gap = Math.max(24, (gaps.length ? gaps[Math.floor(gaps.length * .98)] : 12) * 2.5);   // only a real break exceeds this
        return out;
    }
    function lookup(tab, ph) {
        var f = ((ph / (Math.PI * 2)) % 1 + 1) % 1 * SAMPLES, i = Math.floor(f), t = f - i, a = tab[i % SAMPLES], b = tab[(i + 1) % SAMPLES];
        if (!a.ok || !b.ok) return a.ok && t < .5 ? a : b.ok && t >= .5 ? b : null;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }

    /* ── GPU renderer ────────────────────────────────────────────────── */
    var VERT = 'attribute vec2 aP;void main(){gl_Position=vec4(aP,0.,1.);}';
    var FRAG = [
        'precision highp float;',
        'uniform vec2 uC;uniform float uK;uniform vec3 uCam,uF,uR,uU;uniform float uT;',
        'const float RIN=' + DISK_IN.toFixed(2) + ';const float ROUT=' + DISK_OUT.toFixed(2) + ';',
        'float h21(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}',
        'float h31(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}',
        // value noise, periodic in x (so it wraps seamlessly around the disk)
        'float vn(vec2 p,float per){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);float i0=mod(i.x,per),i1=mod(i.x+1.,per);',
        ' return mix(mix(h21(vec2(i0,i.y)),h21(vec2(i1,i.y)),u.x),mix(h21(vec2(i0,i.y+1.)),h21(vec2(i1,i.y+1.)),u.x),u.y);}',
        'float fbm(vec2 p,float per){float s=0.,a=.55;for(int o=0;o<3;o++){s+=a*vn(p,per);p=vec2(p.x*2.,p.y*2.03);per*=2.;a*=.5;}return s/.9625;}',
        // turbulence that rotates with Keplerian speed; two phases cross-fade so the shear never winds up
        'float turb(float a,float rh){float om=sqrt(.5/(rh*rh*rh));float P=34.;float f1=fract(uT/P),f2=fract(uT/P+.5);float w=abs(2.*f1-1.);float y=log(rh)*7.;',
        ' float n1=fbm(vec2((a-om*f1*P)*3.8197,y),24.);float n2=fbm(vec2((a-om*f2*P)*3.8197+11.,y+5.3),24.);return mix(n1,n2,w);}',
        // three hot spots on Keplerian orbits — their lensed images run around the photon ring
        'float spots(vec2 xz){float e=0.;for(int j=0;j<3;j++){float r=j==0?3.5:(j==1?4.6:5.7);float ph=j==0?0.:(j==1?2.3:4.4);',
        ' float an=ph+sqrt(.5/(r*r*r))*uT;vec2 d=xz-r*vec2(cos(an),sin(an));e+=exp(-dot(d,d)*3.5)*(j==0?1.5:1.);}return e;}',
        // blackbody colour of a temperature in kelvin (linear RGB)
        'vec3 bb(float t){t=clamp(t,1000.,40000.)/100.;float r=t<=66.?1.:clamp(1.292936*pow(t-60.,-.1332047),0.,1.);',
        ' float g=t<=66.?clamp(.3900816*log(t)-.6318414,0.,1.):clamp(1.1298909*pow(t-60.,-.0755148),0.,1.);',
        ' float b=t>=66.?1.:(t<=19.?0.:clamp(.5432068*log(t-10.)-1.1962541,0.,1.));return pow(vec3(r,g,b),vec3(2.2));}',
        'vec3 stars(vec3 d){vec3 c=vec3(0.);for(int l=0;l<2;l++){float sc=l==0?70.:150.;vec3 q=d*sc;vec3 id=floor(q);vec3 f=fract(q)-.5;float h=h31(id+float(l)*31.7);',
        ' if(h>.982){vec3 o=vec3(h31(id+1.3),h31(id+2.9),h31(id+4.1))-.5;float s=smoothstep(.26,0.,length(f-o*.5));float b=(h-.982)/.018;',
        ' c+=s*s*b*b*mix(vec3(1.,.82,.66),vec3(.72,.82,1.),h31(id+7.7))*(l==0?.55:.3);}}',
        ' float nb=fbm(vec2(atan(d.z,d.x)*3.8197,d.y*6.),24.);return c+vec3(.02,.028,.055)*nb*nb*.9;}',
        'vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}',
        // Each ray lives in a plane through the hole; in that plane light obeys Binet's equation for
        // Schwarzschild, u'' + u = 1.5 u² (u = 1/r, r_s = 1). March it in fixed steps of angle (so the
        // error varies smoothly from pixel to pixel — no banding), test each step for the disk plane,
        // and once it's far out finish the last sliver of bending analytically.
        'vec3 trace(vec3 dir){',
        ' float r0=length(uCam);vec3 e1=uCam/r0;vec3 nn=cross(e1,dir);float nl=length(nn);',
        ' vec3 col=vec3(0.);float tr=1.,glow=0.;bool hole=true;vec3 sky=dir;',
        ' if(nl>1e-6){',
        '  vec3 e2=cross(nn/nl,e1);float vr=dot(dir,e1),vt=dot(dir,e2);',
        '  float u=1./r0,du=-u*vr/max(vt,1e-4),f=-u+1.5*u*u,c=1.,s=0.,y0=e1.y;',
        '  float DP=.028*clamp(vt*20.,.06,1.);float cd=cos(DP),sd=sin(DP);',
        '  for(int i=0;i<340;i++){',
        '   float u1=u+du*DP+.5*f*DP*DP;float f1=-u1+1.5*u1*u1;float du1=du+.5*(f+f1)*DP;',
        '   float c1=c*cd-s*sd,s1=s*cd+c*sd;float y1=c1*e1.y+s1*e2.y;',
        // a warm haze hugging the disk, lensed like everything else — a physical-looking bloom
        '   float r=1./u;vec3 pp=r*(c*e1+s*e2);float ds=r*DP*sqrt(1.+du*du/(u*u));float rr=length(pp.xz);',
        '   glow+=tr*ds*exp(-pp.y*pp.y*5.)*smoothstep(ROUT+3.,ROUT-1.,rr)*smoothstep(1.6,RIN,rr);',
        '   if(y0*y1<0.){',
        '    float t=y0/(y0-y1);float uh=mix(u,u1,t),dh=mix(du,du1,t);vec2 cs=normalize(vec2(mix(c,c1,t),mix(s,s1,t)));',
        '    float rh=1./uh;vec3 er=cs.x*e1+cs.y*e2,ep=-cs.y*e1+cs.x*e2;vec3 hp=rh*er;',
        '    if(rh>RIN-.2&&rh<ROUT+1.2){',
        '     vec3 ph=-normalize(-dh*er+uh*ep);',                                                 // direction the light travels, towards us
        '     float an=atan(hp.z,hp.x);float n=turb(an,rh);float x=RIN/rh;',
        '     float T=pow(x,.75)*pow(max(1.-sqrt(x),0.),.25)*2.05;',                           // Novikov–Thorne temperature, peak = 1
        '     float be=min(sqrt(.5/max(rh-1.,.55)),.92);float ga=inversesqrt(1.-be*be);',         // orbital speed seen by a static observer
        '     vec3 vel=vec3(-hp.z,0.,hp.x)/rh;',
        '     float g=sqrt(max(1.-1./rh,.02))/(ga*(1.-be*dot(vel,ph)));',                         // Doppler × gravitational shift
        '     float ed=smoothstep(RIN-.05,RIN+.3,rh)*(1.-smoothstep(ROUT-1.6,ROUT+.9,rh+(n-.5)*1.6));',
        '     float hs=spots(hp.xz);float den=ed*(.28+1.15*n*n)+hs*ed;',
        '     col+=tr*bb(5000.*T*g*(1.+.25*hs))*T*T*T*T*pow(g,3.)*den*2.6;',                    // beaming ∝ g³
        '     tr*=1.-clamp(ed*(.62+.45*n),0.,.96);if(tr<.02)break;}}',
        '   if(u1>1.)break;',                                                                        // inside r_s: gone
        '   if(u1<.025&&du1<0.){float dl=u1/(-du1);float ci=c1*cos(dl)-s1*sin(dl),si=s1*cos(dl)+c1*sin(dl);sky=ci*e1+si*e2;hole=false;break;}',
        '   u=u1;du=du1;f=f1;c=c1;s=s1;y0=y1;}',
        ' }',
        ' if(!hole)col+=tr*(stars(normalize(sky))+vec3(.0033,.0048,.016));',
        ' col+=glow*vec3(1.,.5,.2)*.055;return col;}',
        // Most pixels need one ray. Along the shadow's edge and the photon ring the picture changes
        // within a pixel, so there we take four rays and average them (no jagged edge).
        'void main(){',
        ' vec2 d=gl_FragCoord.xy-uC;vec3 dir=normalize(uF+(uR*d.x+uU*d.y)*uK);',
        ' float b=length(cross(uCam,dir));vec3 col;',
        ' float e=abs(b-2.598);',
        ' if(e<.24){col=vec3(0.);for(int j=0;j<3;j++)for(int k=0;k<3;k++){vec2 o=(vec2(float(k),float(j))-1.)/3.;col+=trace(normalize(uF+(uR*(d.x+o.x)+uU*(d.y+o.y))*uK));}col/=9.;}',   // the photon ring itself: 9 rays
        ' else if(e<.6){col=vec3(0.);for(int k=0;k<4;k++){vec2 o=vec2(k==1||k==3?.25:-.25,k>=2?.25:-.25);col+=trace(normalize(uF+(uR*(d.x+o.x)+uU*(d.y+o.y))*uK));}col*=.25;}',
        ' else col=trace(dir);',
        ' gl_FragColor=vec4(pow(aces(col*1.25),vec3(.4545)),1.);}'
    ].join('\n');

    var glc, rc, dc, gl = null, prog, U = {}, scale = 1, glOk = false;
    function initGL() {
        try {
            gl = glc.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
            if (!gl) return false;
            var hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
            if (!hp || !hp.precision) return false;
            var mk = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[gradebook] shader:', gl.getShaderInfoLog(s)); return null; } return s; };
            var vs = mk(gl.VERTEX_SHADER, VERT), fs = mk(gl.FRAGMENT_SHADER, FRAG);
            if (!vs || !fs) return false;
            prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
            gl.useProgram(prog);
            var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            var loc = gl.getAttribLocation(prog, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            ['uC', 'uK', 'uCam', 'uF', 'uR', 'uU', 'uT'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
            gl.uniform3fv(U.uCam, CAM); gl.uniform3fv(U.uF, FWD); gl.uniform3fv(U.uR, RIGHT); gl.uniform3fv(U.uU, UP);
            return true;
        } catch (e) { return false; }
    }
    function baseScale() { return Math.min(window.devicePixelRatio || 1, 1.5); }   // the disk is soft light; rings and marks are drawn crisp on top
    function sizeGL() {
        if (!glOk) return;
        var s = baseScale() * scale, w = Math.max(1, Math.round(VP.W * s)), h = Math.max(1, Math.round(VP.H * s));
        if (glc.width !== w || glc.height !== h) { glc.width = w; glc.height = h; }
        gl.viewport(0, 0, w, h);
        var px = w / VP.W;
        gl.uniform2f(U.uC, VP.cx * px, (VP.H - VP.cy) * px);
        gl.uniform1f(U.uK, VP.k / px);
    }
    function drawGL(t) { if (!glOk) return; gl.uniform1f(U.uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); }

    /* ── Subjects: orbits, trails, marks ─────────────────────────────── */
    var snap = null, subs = [], total = 0, ghost = false, tables = [], radii = [], orbit = [], tablesFor = '';
    var chipsEl, tipEl, hotChip = -1, holdRings = false;
    function hexRgb(h) { var m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h || ''); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [142, 160, 216]; }
    function ringRadius(i, n) { return n > 1 ? RING_IN + (RING_OUT - RING_IN) * i / (n - 1) : (RING_IN + RING_OUT) / 2; }
    function omega(R) { return Math.sqrt(0.5 / (R * R * R)) * SPEED; }   // Keplerian angular speed, rad/s on screen
    var buildJob = 0;
    function rebuildTables() {
        var n = orbit.length, key = n + '|' + VP.W + 'x' + VP.H;
        if (key === tablesFor) return;
        tablesFor = key; tables = []; radii = [];
        for (var i = 0; i < n; i++) radii.push(ringRadius(i, n));
        var job = ++buildJob, i2 = 0;
        (function next() {                                     // one orbit per slice, so the page never stalls
            if (job !== buildJob) return;
            if (i2 >= n) { stage.classList.add('is-mapped'); paintRings(); placeChips(); return; }
            tables[i2] = buildTable(radii[i2]); i2++;
            setTimeout(next, 0);
        }());
    }

    // Where each trail starts now; its head (the mark) is f·2π further along.
    var ringClock = 0;
    function startAngle(i) { var o = orbit[i]; return o.s0 + omega(radii[i]) * ringClock; }

    function paintRings() {
        var ctx = rc.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = Math.round(VP.W * dpr), h = Math.round(VP.H * dpr);
        if (rc.width !== w || rc.height !== h) { rc.width = w; rc.height = h; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, VP.W, VP.H);
        if (!tables.length) return;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        orbit.forEach(function (o, i) {
            var tab = tables[i]; if (!tab) return;
            var rgb = o.rgb;
            // the whole orbit, faint
            ctx.beginPath(); var pen = false;
            for (var j = 0, prevPt = null; j <= SAMPLES; j++) {
                var pt = tab[j % SAMPLES];
                if (!pt.ok || (prevPt && Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y) > tab.gap)) pen = false;
                if (!pt.ok) { prevPt = null; continue; }
                if (pen) ctx.lineTo(pt.x, pt.y); else { ctx.moveTo(pt.x, pt.y); pen = true; }
                prevPt = pt;
            }
            ctx.strokeStyle = ghost ? 'rgba(200,210,255,.16)' : 'rgba(238,241,255,.13)'; ctx.lineWidth = 1; ctx.setLineDash(ghost ? [2, 4] : []); ctx.stroke(); ctx.setLineDash([]);
            if (ghost) return;
            // the trail: brighter towards its head; the approaching (right) side a touch brighter, like the disk
            var s = startAngle(i), len = o.f * Math.PI * 2, steps = Math.max(8, Math.round(o.f * 72)), last = null;
            for (var k = 1; k <= steps; k++) {
                var a0 = s + len * (k - 1) / steps, a1 = s + len * k / steps, p0 = lookup(tab, a0), p1 = lookup(tab, a1);
                if (!p0 || !p1) continue;
                var u = k / steps, dep = clamp(CAM_D / p1.z, .7, 1.35), beam = 1 + .28 * Math.cos(a1);
                ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (clamp((.12 + .88 * Math.pow(u, 1.7)) * beam, 0, 1)).toFixed(3) + ')';
                ctx.lineWidth = (1.1 + 1.9 * u) * dep;
                ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
                last = p1;
            }
            if (last) {                                          // a soft glow where the trail ends
                var g = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 14);
                g.addColorStop(0, 'rgba(' + rgb.join(',') + ',.55)'); g.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(last.x, last.y, 14, 0, Math.PI * 2); ctx.fill();
            }
            // the dream university's bar on this orbit
            if (o.g != null) {
                var ga = s + o.g * Math.PI * 2, gp = lookup(tab, ga), gq = lookup(tab, ga + .02);
                if (gp && gq) {
                    var tx = gq.x - gp.x, ty = gq.y - gp.y, tl = Math.sqrt(tx * tx + ty * ty) || 1, nx = -ty / tl * 5, ny = tx / tl * 5;
                    ctx.strokeStyle = o.met ? 'rgba(198,243,107,.95)' : 'rgba(198,243,107,.75)'; ctx.lineWidth = 2;
                    ctx.shadowColor = 'rgba(198,243,107,.9)'; ctx.shadowBlur = 6;
                    ctx.beginPath(); ctx.moveTo(gp.x - nx, gp.y - ny); ctx.lineTo(gp.x + nx, gp.y + ny); ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }
        });
    }

    function placeChips() {
        if (!chipsEl) return;
        chipsEl.querySelectorAll('.gkx-chip').forEach(function (el) {
            var i = +el.getAttribute('data-i'), o = orbit[i], tab = tables[i];
            if (!o || !tab) { el.style.opacity = '0'; return; }
            var p = lookup(tab, startAngle(i) + o.f * Math.PI * 2);
            if (!p) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }
            var dep = clamp(CAM_D / p.z, .78, 1.18), far = p.z > CAM_D;
            el.style.opacity = far ? '.82' : '1'; el.style.pointerEvents = '';
            el.style.zIndex = String(i === hotChip ? 50 : Math.round(40 - p.z));
            el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + (dep * (i === hotChip ? 1.12 : 1)).toFixed(3) + ')';
            if (i === hotChip) positionTip(el, 0);
        });
    }

    function buildChips() {
        chipsEl.innerHTML = ghost ? '' : orbit.map(function (o, i) {
            var s = o.s;
            return '<button type="button" class="gkx-chip' + (o.met ? ' is-met' : '') + '" data-i="' + i + '" style="--c:' + esc(s.color || '#8ea0d8') + ';--fl:' + (i * .7).toFixed(1) + 's" aria-label="' + esc(s.name + ': ' + num(s.avg) + ' ' + snap.hint) + '">' +
                '<span class="gkx-chip__in"><i aria-hidden="true"></i><b>' + num(s.avg) + '</b></span></button>';
        }).join('');
    }

    /* ── Hover details ───────────────────────────────────────────────── */
    function tipFor(i) {
        var o = orbit[i], s = o.s, h = snap.hint, rows = [];
        var status = snap.req == null ? '' : o.met
            ? '<span class="gkx-tip__st is-ok"><i class="fa-solid fa-check" aria-hidden="true"></i> Clears the ' + esc(snap.aim) + ' bar' + (s.avg - snap.req >= .05 ? ' by ' + num(s.avg - snap.req) : '') + '</span>'
            : '<span class="gkx-tip__st">+' + num(snap.req - s.avg) + ' to reach ' + esc(snap.aim) + ' (~' + num(snap.req) + ')</span>';
        if (s.goal != null) rows.push('<span>Your goal</span><b>' + num(s.goal) + '</b>');
        if (s.exams) rows.push('<span>Exam marks</span><b>' + s.marks + ' of ' + s.exams + '</b>');
        if (s.best != null) rows.push('<span>Best · latest</span><b>' + num(s.best) + ' · ' + num(s.latest) + '</b>');
        rows.push('<span>Of full marks</span><b>' + Math.round(o.f * 100) + '%</b>');
        return '<p class="gkx-tip__name"><i style="background:' + esc(s.color || '#8ea0d8') + '"></i>' + esc(s.name) + '</p>' +
            '<p class="gkx-tip__mark"><b>' + num(s.avg) + '</b><small>' + esc(h) + '</small></p>' + status +
            '<div class="gkx-tip__rows">' + rows.map(function (r) { return '<div>' + r + '</div>'; }).join('') + '</div>' +
            '<p class="gkx-tip__hint">Click for the marks table</p>';
    }
    // Pick the best of above / below / right / left: inside the card, and clear of the black hole's shadow.
    function positionTip(anchor, side) {
        var cr = card.getBoundingClientRect(), sr = stage.getBoundingClientRect(), ar = anchor.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight, G = 12, M = 8;
        var ax = ar.left - cr.left, ay = ar.top - cr.top, aw = ar.width, ah = ar.height, sd = side || 0;
        var hx = sr.left - cr.left + VP.cx, hy = sr.top - cr.top + VP.cy, hr = B_CRIT / (CAM_D * VP.k) * 1.35;
        var cands = [
            [ax + aw / 2 - tw / 2, ay - th - G - sd * .2, 0],
            [ax + aw / 2 - tw / 2, ay + ah + G + sd * .2, 1],
            [ax + aw + sd + G, ay + ah / 2 - th / 2, 2],
            [ax - sd - G - tw, ay + ah / 2 - th / 2, 3]
        ].map(function (c) {
            var x = c[0], y = c[1], out = Math.max(0, M - x) + Math.max(0, x + tw - (cr.width - M)) + Math.max(0, M - y) + Math.max(0, y + th - (cr.height - M));
            var nx = clamp(hx, x, x + tw), ny = clamp(hy, y, y + th), over = Math.max(0, hr - Math.hypot(hx - nx, hy - ny));
            return { x: x, y: y, score: out * 40 + over * 12 + c[2] * 3 };
        }).sort(function (a, b) { return a.score - b.score; });
        var best = cands[0];
        tipEl.style.transform = 'translate(' + clamp(best.x, M, cr.width - tw - M).toFixed(1) + 'px,' + clamp(best.y, M, cr.height - th - M).toFixed(1) + 'px)';
    }
    var tipSide = 0;
    function showTip(html, anchor, kind, side) {
        tipEl.className = 'gkx-tip' + (kind ? ' gkx-tip--' + kind : '');
        tipEl.innerHTML = html; tipEl.hidden = false;
        tipSide = side || 0;
        positionTip(anchor, tipSide);
        requestAnimationFrame(function () { tipEl.classList.add('is-on'); });
    }
    function hideTip() { tipEl.classList.remove('is-on'); tipEl.hidden = true; }
    function setHot(i) {
        hotChip = i; holdRings = i >= 0;
        chipsEl.querySelectorAll('.gkx-chip').forEach(function (c) { c.classList.toggle('is-hot', +c.getAttribute('data-i') === i); });
        if (i >= 0) showTip(tipFor(i), chipsEl.querySelector('.gkx-chip[data-i="' + i + '"]'), 'subject'); else hideTip();
        placeChips();
    }
    // The shadow and the photon ring explain themselves.
    var feature = '';
    var FEATURES = {
        horizon: '<p class="gkx-tip__name">Event horizon</p><p class="gkx-tip__txt">The black disk is the hole’s shadow: light that comes closer than about 2.6 r<sub>s</sub> spirals in and never leaves. The event horizon is inside it, and the singularity at the very centre.</p>',
        ring: '<p class="gkx-tip__name">Photon ring</p><p class="gkx-tip__txt">At 1.5 r<sub>s</sub> light can orbit the hole. Rays that skim that sphere loop round and show you thin, bent images of the whole disk — the bright edge around the shadow.</p>'
    };
    var anchorEl = document.createElement('i'); anchorEl.className = 'gkx-anchor';
    function onMove(e) {
        if (hotChip >= 0) return;
        var r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, rs = B_CRIT / (CAM_D * VP.k), d = Math.hypot(x - VP.cx, y - VP.cy);
        var f = d < rs * .86 ? 'horizon' : d < rs * 1.16 ? 'ring' : '';
        if (f === feature) return;
        feature = f;
        if (!f) { hideTip(); return; }
        anchorEl.style.left = VP.cx + 'px'; anchorEl.style.top = VP.cy + 'px';
        showTip(FEATURES[f], anchorEl, 'info', rs * 1.1);                        // beside the shadow, never over it
    }

    /* ── Stars being drawn in, forever ───────────────────────────────
       A few dozen stars on tilted orbits spiral slowly inwards along
       logarithmic spirals, speeding up as they close in (Keplerian), their
       trails stretching. Each fades out before it reaches the rings and is
       reborn far out, so the stream never stops and nothing ever falls in. */
    var DUST = [], DUST_N = 30, R_FAR = 23, R_NEAR = 8.6;
    (function () {
        var seed = 11, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (var i = 0; i < DUST_N; i++) DUST.push({ inc: (rnd() - .5) * 1.5, node: rnd() * Math.PI * 2, ph: rnd() * Math.PI * 2, k0: rnd(), v: .016 + rnd() * .012, size: .55 + rnd() * .95, warm: rnd() });
    }());
    function dustPoint(d, k) {
        var r = R_FAR * Math.pow(R_NEAR / R_FAR, k), phi = d.ph + 3 * (Math.pow(R_FAR / r, 1.5) - 1);
        var x = r * Math.cos(phi), z = r * Math.sin(phi), y = 0;
        var ci = Math.cos(d.inc), si = Math.sin(d.inc), cn = Math.cos(d.node), sn = Math.sin(d.node);
        var y1 = -z * si, z1 = z * ci;                                          // tilt the orbit about its node line
        return project([x * cn - z1 * sn, y1, x * sn + z1 * cn]);
    }
    var dustClock = 0;
    function paintDust() {
        if (!dc || !VP.W) return;
        var ctx = dc.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(VP.W * dpr), h = Math.round(VP.H * dpr);
        if (dc.width !== w || dc.height !== h) { dc.width = w; dc.height = h; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, VP.W, VP.H);
        var rs = B_CRIT / (CAM_D * VP.k);
        ctx.lineCap = 'round';
        DUST.forEach(function (d) {
            var k = (d.k0 + dustClock * d.v) % 1;
            var a = Math.min(1, k / .14) * Math.min(1, (1 - k) / .22);           // fade in far out, fade out before the rings
            if (a <= .01) return;
            var p = dustPoint(d, k), q = dustPoint(d, Math.max(0, k - (.004 + .012 * k)));
            if (p.z > CAM_D && Math.hypot(p.x - VP.cx, p.y - VP.cy) < rs * 1.2) return;   // behind the shadow
            var col = d.warm > .6 ? '255,226,190' : '214,226,255', al = a * (.35 + .5 * k);
            var g = ctx.createLinearGradient(q.x, q.y, p.x, p.y);
            g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',' + al.toFixed(3) + ')');
            ctx.strokeStyle = g; ctx.lineWidth = d.size * .7;
            ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
            ctx.fillStyle = 'rgba(' + col + ',' + Math.min(1, al * 1.4).toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(p.x, p.y, d.size * .75, 0, Math.PI * 2); ctx.fill();
        });
    }

    /* ── Its name and mass, in quiet grey ──────────────────────────────
       Gargantua, after the film. Its mass follows your average — one point
       is a billion Suns — with the Schwarzschild radius that goes with it
       (r_s = 2GM/c² ≈ 2.95 km per solar mass). */
    function paintId() {
        var el = $('gkHoleId'); if (!el) return;
        if (!snap || snap.avg == null) { el.innerHTML = '<span>Gargantua</span><small>mass unknown · add marks</small>'; return; }
        var bn = Math.round(snap.avg * 10) / 10, massTxt = bn >= 1000 ? (Math.round(bn / 100) / 10) + ' trillion' : num(bn) + ' billion';
        var au = bn * 1e9 * 2.953 / 1.496e8, auTxt = au >= 100 ? Math.round(au).toLocaleString('en-GB') : au.toFixed(1);
        el.innerHTML = '<span>Gargantua</span><small>' + massTxt + ' M<sub>☉</sub> · r<sub>s</sub> ≈ ' + auTxt + ' AU</small>';
        el.title = 'Its mass follows your average: one point = a billion Suns (' + (bn * 1.989).toFixed(1) + ' × 10³⁹ kg)';
    }

    /* ── Left column: average, note, IB bar, readiness ─────────────── */
    var shownAvg = null, countRaf = 0;
    function countTo(el, from, to) {
        cancelAnimationFrame(countRaf);
        if (REDUCED || from == null || from === to) { el.textContent = num(to); return; }
        var t0 = 0;
        countRaf = requestAnimationFrame(function step(t) {
            if (!t0) t0 = t;
            var k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3);
            el.textContent = num(from + (to - from) * e);
            if (k < 1) countRaf = requestAnimationFrame(step);
        });
    }
    function paintLeft(fresh) {
        var avgBox = $('gkAvg'), ibBox = $('gkIb'), rdBox = $('gkReady'), sc = $('gkScale');
        if (sc) sc.textContent = snap && snap.avg != null ? '· ' + snap.label.replace(/\s*\(.*\)/, '') : '';
        if (!snap || snap.avg == null) { avgBox.innerHTML = ''; ibBox.hidden = true; rdBox.hidden = true; shownAvg = null; return; }
        var noteEl = $('gbNote'), note = noteEl ? noteEl.textContent : '', good = !!(noteEl && noteEl.classList.contains('is-good'));
        if (!avgBox.querySelector('.gk-avg__num')) {
            avgBox.innerHTML = '<div class="gk-avg__row"><b class="gk-avg__num"></b><span class="gk-avg__of"></span></div><p class="gk-pill"><i aria-hidden="true"></i><span></span></p>';
        }
        countTo(avgBox.querySelector('.gk-avg__num'), fresh ? 0 : shownAvg, snap.avg);
        shownAvg = snap.avg;
        avgBox.querySelector('.gk-avg__of').textContent = snap.hint;
        var pill = avgBox.querySelector('.gk-pill');
        pill.hidden = !note;
        pill.className = 'gk-pill' + (good ? ' is-good' : '');
        pill.querySelector('span').textContent = note;
        if (snap.ib) {
            ibBox.hidden = false;
            ibBox.innerHTML =
                '<div class="gk-ibx__hd"><small>IB diploma</small><small>' + (snap.ib.n < 6 ? 'estimated from ' + snap.ib.n + ' subject' + (snap.ib.n === 1 ? '' : 's') : 'best six subjects') + '</small></div>' +
                '<div class="gk-ibx__row"><b>' + snap.ib.pts + '</b><span>/ 42</span><em title="Theory of Knowledge and the Extended Essay add up to 3 points">+ up to 3 core</em></div>' +
                '<div class="gk-ibx__bar" style="--v:' + snap.ib.pts + '" role="img" aria-label="' + snap.ib.pts + ' of 45 diploma points"><i class="gk-ibx__fill"></i><i class="gk-ibx__core"></i></div>';
        } else ibBox.hidden = true;
        if (snap.ready != null && snap.aimName) {
            var on = Math.round(snap.ready / 5), col = snap.ready >= 70 ? 'var(--gk-lime)' : snap.ready >= 40 ? '#ffd36e' : '#ff9a85', segs = '';
            for (var k = 0; k < 20; k++) segs += '<i' + (k < on ? ' class="on"' : '') + ' style="--k:' + k + '"></i>';
            rdBox.hidden = false;
            rdBox.style.setProperty('--rc', col);
            rdBox.innerHTML = '<div class="gk-ready__hd"><small title="' + esc(snap.aimName) + '">Ready for <b>' + esc(snap.aim || snap.aimName) + '</b></small><b class="gk-ready__pct">' + snap.ready + '%</b></div>' +
                '<div class="gk-ready__segs" role="img" aria-label="' + snap.ready + '% ready">' + segs + '</div>';
        } else if (!snap.aimName) {
            rdBox.hidden = false;
            rdBox.style.removeProperty('--rc');
            rdBox.innerHTML = '<p class="gk-ready__hint"><i class="fa-solid fa-bullseye" aria-hidden="true"></i> Pick a dream university below to see how ready you are.</p>';
        } else rdBox.hidden = true;
    }

    /* ── Caption under the hole ─────────────────────────────────────── */
    function paintCaption() {
        var mid = $('gkMid'), cap = $('gkCap');
        if (ghost) { mid.innerHTML = 'Your subjects will orbit here'; cap.textContent = 'Add marks and each subject becomes an orbit — a full orbit is full marks'; return; }
        if (snap.req != null) {
            var met = orbit.filter(function (o) { return o.met; }).length;
            mid.innerHTML = '<b>' + met + '<small>/' + orbit.length + '</small></b> subjects clear the ' + esc(snap.aim) + ' bar';
            cap.innerHTML = '<i class="gk-cap__spoke" aria-hidden="true"></i>' + esc(snap.aim) + ' asks ~' + num(snap.req) + ' ' + esc(snap.hint) + ' · a full orbit is full marks' + (total > MAX_RINGS ? ' · +' + (total - MAX_RINGS) + ' more' : '');
        } else {
            mid.innerHTML = '<b>' + total + '</b> subject' + (total === 1 ? '' : 's') + ' in orbit';
            cap.textContent = 'A full orbit is full marks · hover a mark for details' + (total > MAX_RINGS ? ' · +' + (total - MAX_RINGS) + ' more' : '');
        }
    }

    /* ── Build the stage ─────────────────────────────────────────────── */
    stage.innerHTML =
        '<div class="gk-hole__view"><canvas class="gk-hole__gl" aria-hidden="true"></canvas><canvas class="gk-hole__dust" aria-hidden="true"></canvas><canvas class="gk-hole__rings" aria-hidden="true"></canvas>' +
            '<div class="gk-bh" aria-hidden="true" hidden><i class="gk-bh__glow"></i><i class="gk-bh__disk gk-bh__disk--back"></i><i class="gk-bh__lens"></i><i class="gk-bh__core"></i><i class="gk-bh__disk gk-bh__disk--front"></i></div></div>' +
        '<div class="gk-hole__id" id="gkHoleId"></div>' +
        '<div class="gk-hole__chips" id="gkChips"></div>' +
        '<div class="gk-rings__cap"><p class="gk-rings__mid" id="gkMid"></p><p class="gk-rings__legend" id="gkCap"></p></div>';
    stage.appendChild(anchorEl);
    glc = stage.querySelector('.gk-hole__gl'); rc = stage.querySelector('.gk-hole__rings'); dc = stage.querySelector('.gk-hole__dust'); chipsEl = $('gkChips');
    tipEl = document.createElement('div'); tipEl.className = 'gkx-tip'; tipEl.id = 'gkTip'; tipEl.hidden = true; tipEl.setAttribute('role', 'tooltip');
    card.appendChild(tipEl);
    glOk = initGL();
    stage.classList.toggle('is-gl', glOk);
    if (!glOk) stage.querySelector('.gk-bh').hidden = false;        // no WebGL: the CSS black hole stands in
    glc.addEventListener('webglcontextlost', function (e) { e.preventDefault(); glOk = false; stage.classList.remove('is-gl'); stage.querySelector('.gk-bh').hidden = false; });
    glc.addEventListener('webglcontextrestored', function () { glOk = initGL(); if (glOk) { stage.classList.add('is-gl'); stage.querySelector('.gk-bh').hidden = true; sizeGL(); } });

    // A quiet star field across the whole card (fixed positions, so it never jumps).
    (function () {
        if (card.querySelector('.gk-stars')) return;
        var seed = 7, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }, h = '';
        for (var i = 0; i < 38; i++) h += '<i style="left:' + (rnd() * 100).toFixed(1) + '%;top:' + (rnd() * 100).toFixed(1) + '%;--z:' + (rnd() < .18 ? 2 : 1) + 'px;--tw:' + (2.5 + rnd() * 4).toFixed(1) + 's;--dl:-' + (rnd() * 6).toFixed(1) + 's"></i>';
        var sky = document.createElement('div'); sky.className = 'gk-stars'; sky.setAttribute('aria-hidden', 'true'); sky.innerHTML = h;
        card.insertBefore(sky, card.firstChild);
    }());

    chipsEl.addEventListener('pointerover', function (e) { var c = e.target.closest('.gkx-chip'); if (c && +c.getAttribute('data-i') !== hotChip) { feature = ''; setHot(+c.getAttribute('data-i')); } });
    chipsEl.addEventListener('pointerout', function (e) { var c = e.target.closest('.gkx-chip'); if (c && !c.contains(e.relatedTarget)) setHot(-1); });
    chipsEl.addEventListener('focusin', function (e) { var c = e.target.closest('.gkx-chip'); if (c) setHot(+c.getAttribute('data-i')); });
    chipsEl.addEventListener('focusout', function () { setHot(-1); });
    chipsEl.addEventListener('click', function (e) {
        var c = e.target.closest('.gkx-chip'); if (!c) return;
        var o = orbit[+c.getAttribute('data-i')];
        if (o && typeof window.gbOpenSubject === 'function') { setHot(-1); window.gbOpenSubject(o.s.id); }
    });
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', function () { if (feature) { feature = ''; hideTip(); } });

    /* ── Render loop ─────────────────────────────────────────────────── */
    var raf = 0, lastT = 0, lastDraw = 0, diskClock = 40, onScreen = true, ema = 16.7, slow = 0, fast = 0, frame = 0, glEvery = 1;
    function live() { return onScreen && tab.style.display !== 'none' && !document.hidden; }
    // Something opened on top (a modal, drawer or menu)? Then nobody can see the
    // hole, so stop tracing it — the realistic-options modal used to crawl because
    // the hole kept rendering (and being blurred) underneath it. Checked by hit-testing
    // the middle of the stage; while covered, a slow poll wakes the loop back up.
    var coverT = 0;
    function covered() {
        var r = stage.getBoundingClientRect(), x = r.left + r.width * .6, y = r.top + r.height / 2;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
        var hit = document.elementFromPoint(x, y);
        return !!hit && !card.contains(hit);
    }
    function waitUncovered() {
        clearTimeout(coverT);
        coverT = setTimeout(function () { if (!live()) return; if (covered()) waitUncovered(); else start(); }, 350);
    }
    function loop(now) {
        raf = 0;
        if (!live()) { lastT = 0; return; }
        if (frame % 20 === 0 && covered()) { lastT = 0; frame++; waitUncovered(); return; }
        raf = requestAnimationFrame(loop);
        if (lastT) ema += ((now - lastT) - ema) * .05;
        lastT = now;
        if (now - lastDraw < 15.5) return;                  // 60 fps is plenty — also on 120 Hz screens
        var dt = lastDraw ? Math.min(.1, (now - lastDraw) / 1000) : 0; lastDraw = now;
        diskClock += dt * SPEED;
        if (!holdRings) ringClock += dt;
        frame++;
        if (frame % glEvery === 0) drawGL(diskClock);
        dustClock += dt; paintDust();
        if (frame % 2 === 0 || holdRings) paintRings();
        placeChips();
        // keep it smooth: drop resolution when frames run late, recover when there's headroom
        if (ema > 21) {
            if (++slow > 45) { slow = 0; if (scale > .55) { scale = Math.max(.55, scale * .85); sizeGL(); } else if (glEvery < 4) glEvery *= 2; }   // then draw the disk every 2nd/4th frame
        } else slow = 0;
        if (ema < 17.5) { if (++fast > 300) { fast = 0; if (glEvery > 1) glEvery /= 2; else if (scale < 1) { scale = Math.min(1, scale * 1.12); sizeGL(); } } } else fast = 0;
    }
    function start() {
        if (REDUCED) { drawGL(diskClock); paintDust(); paintRings(); placeChips(); return; }
        if (!raf && live()) { lastT = 0; lastDraw = 0; raf = requestAnimationFrame(loop); }
    }

    function relayout() {
        layoutView();
        sizeGL();
        tablesFor = '';
        rebuildTables();
        if (REDUCED) start();
    }
    var roT = 0;
    if ('ResizeObserver' in window) new ResizeObserver(function () { clearTimeout(roT); roT = setTimeout(relayout, 120); }).observe(stage);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; if (onScreen) start(); }).observe(stage);
    document.addEventListener('visibilitychange', start);

    /* ── Data ───────────────────────────────────────────────────────── */
    function render(fresh) {
        snap = typeof window.gbSnapshot === 'function' ? window.gbSnapshot() : null;
        subs = snap ? snap.subjects.filter(function (s) { return s.avg != null; }) : [];
        total = subs.length; ghost = !subs.length;
        stage.classList.toggle('is-ghost', ghost);
        var max = ghost ? 1 : snap.max, req = !ghost && snap.req != null ? snap.req : null, shown = ghost ? [0, 1, 2, 3, 4] : subs.slice(0, MAX_RINGS), n = shown.length;
        var prev = orbit;
        orbit = shown.map(function (s, i) {
            if (ghost) return { s: { id: 'g' + i }, f: 0, g: null, met: false, rgb: [142, 160, 216], s0: 0 };
            var f = clamp(s.avg / max, 0, 1);
            // heads start fanned out across the front of the hole (φ = π/2 faces the camera), then orbit
            var old = prev[i] && prev[i].s.id === s.id ? prev[i] : null;
            var s0 = old ? old.s0 : Math.PI / 2 + (i - (n - 1) / 2) * .62 - f * Math.PI * 2 - omega(ringRadius(i, n)) * ringClock;
            return { s: s, f: f, g: req != null ? clamp(req / max, 0, 1) : null, met: req != null && s.avg >= req - 1e-9, rgb: hexRgb(s.color), s0: s0 };
        });
        if (fresh || !chipsEl.children.length || chipsEl.children.length !== (ghost ? 0 : n) || chipsEl.getAttribute('data-key') !== shown.map(function (s) { return s.id; }).join()) {
            buildChips(); chipsEl.setAttribute('data-key', shown.map(function (s) { return s.id; }).join());
        } else {
            orbit.forEach(function (o, i) { var c = chipsEl.querySelector('.gkx-chip[data-i="' + i + '"]'); if (c) { c.classList.toggle('is-met', o.met); c.querySelector('b').textContent = num(o.s.avg); } });
        }
        if (!VP.W) layoutView();
        rebuildTables();
        paintRings(); paintDust(); placeChips(); paintCaption(); paintLeft(fresh); paintId();
        if (fresh) { stage.classList.remove('is-in'); void stage.offsetWidth; stage.classList.add('is-in'); }
    }
    window.gbCardRender = function () { render(false); };

    // Replay the entrance each time the tab opens, and run only while it's open.
    var wasHidden = tab.style.display === 'none';
    new MutationObserver(function () {
        var hidden = tab.style.display === 'none';
        if (wasHidden && !hidden) { relayout(); render(true); start(); }
        wasHidden = hidden;
    }).observe(tab, { attributes: true, attributeFilter: ['style'] });

    layoutView(); sizeGL();
    render(true);
    start();
})();
