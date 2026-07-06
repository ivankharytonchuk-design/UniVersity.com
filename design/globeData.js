/* ════════════════════════════════════════════════════════════════════════
   globeData.js — geographic + study-destination dataset for the globe modal.

   COORDS:  ISO-2 (lowercase) → { lat, lng }  approximate country centroid,
            used to place pins on the 3D globe and to map a click → nearest
            country.  Covers every code in ALL_COUNTRIES plus gb / us / ca.

   REGION:  curated study-destination info shown in the info card. A subset is
            hand-written; the rest fall back to a sensible generated summary so
            every country on Earth still feels "supported".
   ════════════════════════════════════════════════════════════════════════ */

export const COORDS = {
    // — Europe —
    gb:{lat:54.0,lng:-2.4}, ie:{lat:53.2,lng:-8.0}, fr:{lat:46.6,lng:2.4},
    de:{lat:51.2,lng:10.4}, es:{lat:40.2,lng:-3.7}, it:{lat:42.8,lng:12.6},
    pt:{lat:39.6,lng:-8.0}, nl:{lat:52.2,lng:5.3}, be:{lat:50.6,lng:4.6},
    ch:{lat:46.8,lng:8.2}, at:{lat:47.6,lng:14.1}, se:{lat:60.1,lng:15.6},
    no:{lat:61.0,lng:8.5}, dk:{lat:56.0,lng:9.5}, fi:{lat:64.0,lng:26.0},
    is:{lat:64.9,lng:-19.0}, pl:{lat:52.1,lng:19.4}, cz:{lat:49.8,lng:15.5},
    sk:{lat:48.7,lng:19.7}, hu:{lat:47.2,lng:19.5}, ro:{lat:45.9,lng:24.9},
    bg:{lat:42.7,lng:25.5}, gr:{lat:39.0,lng:22.0}, hr:{lat:45.1,lng:15.5},
    si:{lat:46.1,lng:14.8}, rs:{lat:44.0,lng:21.0}, ua:{lat:49.0,lng:31.4},
    ee:{lat:58.7,lng:25.5}, lv:{lat:56.9,lng:24.9}, lt:{lat:55.2,lng:23.9},
    lu:{lat:49.8,lng:6.1}, mt:{lat:35.9,lng:14.4}, cy:{lat:35.0,lng:33.0},
    tr:{lat:39.0,lng:35.2}, ru:{lat:61.5,lng:90.0}, by:{lat:53.7,lng:27.9},
    md:{lat:47.2,lng:28.4}, al:{lat:41.2,lng:20.1}, ba:{lat:43.9,lng:17.7},
    mk:{lat:41.6,lng:21.7}, me:{lat:42.7,lng:19.4},
    // — Asia / Middle East —
    cn:{lat:35.9,lng:104.2}, jp:{lat:36.2,lng:138.3}, kr:{lat:36.5,lng:127.9},
    in:{lat:22.6,lng:79.0}, sg:{lat:1.35,lng:103.8}, hk:{lat:22.3,lng:114.2},
    my:{lat:4.2,lng:101.9}, th:{lat:15.1,lng:101.0}, vn:{lat:16.0,lng:107.8},
    id:{lat:-2.5,lng:118.0}, ph:{lat:12.9,lng:121.8}, tw:{lat:23.7,lng:120.9},
    pk:{lat:30.4,lng:69.3}, bd:{lat:23.7,lng:90.4}, lk:{lat:7.9,lng:80.8},
    np:{lat:28.4,lng:84.1}, kz:{lat:48.0,lng:67.0}, ae:{lat:24.0,lng:54.0},
    sa:{lat:24.0,lng:45.0}, qa:{lat:25.3,lng:51.2}, il:{lat:31.4,lng:35.0},
    jo:{lat:31.2,lng:36.5}, lb:{lat:33.9,lng:35.9}, ir:{lat:32.4,lng:53.7},
    // — Africa —
    eg:{lat:26.8,lng:30.8}, ma:{lat:31.8,lng:-7.1}, tn:{lat:34.0,lng:9.6},
    dz:{lat:28.0,lng:1.7}, za:{lat:-29.0,lng:24.0}, ng:{lat:9.1,lng:8.7},
    ke:{lat:0.2,lng:37.9}, gh:{lat:7.9,lng:-1.0}, et:{lat:9.1,lng:40.5},
    tz:{lat:-6.4,lng:34.9}, ug:{lat:1.4,lng:32.3},
    // — Americas / Oceania —
    us:{lat:39.5,lng:-98.4}, ca:{lat:56.1,lng:-106.3}, br:{lat:-10.8,lng:-52.9},
    ar:{lat:-38.4,lng:-63.6}, cl:{lat:-35.7,lng:-71.5}, co:{lat:4.6,lng:-74.3},
    mx:{lat:23.6,lng:-102.5}, pe:{lat:-9.2,lng:-75.0}, uy:{lat:-32.5,lng:-55.8},
    ec:{lat:-1.8,lng:-78.2}, cr:{lat:9.7,lng:-83.8}, pa:{lat:8.5,lng:-80.1},
    au:{lat:-25.3,lng:133.8}, nz:{lat:-41.0,lng:172.8}
};

/* Curated study-destination intelligence for the marquee countries. */
export const REGION = {
    gb:{ count:160, fee:'£11,000–£38,000', cont:'Europe', cities:['London','Oxford','Edinburgh','Manchester'],
        sum:'Home to some of the oldest and most prestigious universities on Earth, with a 2-year post-study Graduate Route visa.' },
    us:{ count:'4,000+', fee:'$10,000–$60,000', cont:'North America', cities:['Boston','New York','California','Chicago'],
        sum:'The largest and most diverse higher-education system in the world — from Ivy League research powerhouses to public state universities.' },
    ca:{ count:220, fee:'CA$7,000–$35,000', cont:'North America', cities:['Toronto','Vancouver','Montréal','Waterloo'],
        sum:'World-class education with generous post-graduation work permits and a clear path to permanent residency.' },
    es:{ count:89, fee:'€1,000–€12,000', cont:'Europe', cities:['Madrid','Barcelona','Valencia','Seville'],
        sum:'Affordable EU tuition, Mediterranean lifestyle and a fast-growing hub for English-taught business and engineering programmes.' },
    fr:{ count:250, fee:'€2,800–€15,000', cont:'Europe', cities:['Paris','Lyon','Toulouse','Bordeaux'],
        sum:'Low public-university fees, elite Grandes Écoles and a 12-month job-search permit in the heart of Europe.' },
    de:{ count:400, fee:'€0–€3,000', cont:'Europe', cities:['Berlin','Munich','Heidelberg','Aachen'],
        sum:'Tuition-free public universities, a global engineering reputation and an 18-month post-study residence permit.' },
    it:{ count:97, fee:'€900–€4,000', cont:'Europe', cities:['Milan','Bologna','Rome','Padua'],
        sum:'Where the modern university was born — low fees, income-based scholarships and a deep cultural heritage.' },
    nl:{ count:60, fee:'€8,000–€20,000', cont:'Europe', cities:['Amsterdam','Delft','Eindhoven','Utrecht'],
        sum:'One of Europe’s largest ranges of English-taught degrees and a 1-year "orientation" job-search permit.' },
    ch:{ count:42, fee:'CHF 1,000–€4,000', cont:'Europe', cities:['Zürich','Lausanne','Geneva','Basel'],
        sum:'Home to ETH Zürich and EPFL — extremely low tuition for outstanding research, set against the Alps.' },
    se:{ count:50, fee:'SEK 80,000–145,000', cont:'Europe', cities:['Stockholm','Lund','Uppsala','Gothenburg'],
        sum:'Innovation-driven, free for EU students, with a 12-month permit to find work after graduating.' },
    ie:{ count:34, fee:'€10,000–€25,000', cont:'Europe', cities:['Dublin','Cork','Galway','Limerick'],
        sum:'English-speaking EU member with a thriving tech sector and up to 2 years of post-study stay-back.' },
    pt:{ count:50, fee:'€1,000–€7,000', cont:'Europe', cities:['Lisbon','Porto','Coimbra','Braga'],
        sum:'Sunny, affordable and increasingly English-friendly, with one of the lowest costs of living in Western Europe.' },
    au:{ count:43, fee:'AU$20,000–$45,000', cont:'Oceania', cities:['Sydney','Melbourne','Brisbane','Perth'],
        sum:'Seven universities in the global top 100 and post-study work rights of up to 4 years.' },
    nz:{ count:8, fee:'NZ$22,000–$35,000', cont:'Oceania', cities:['Auckland','Wellington','Christchurch','Dunedin'],
        sum:'All eight universities rank in the global top 3% — safe, scenic and welcoming to international students.' },
    jp:{ count:120, fee:'¥535,800–¥1,200,000', cont:'Asia', cities:['Tokyo','Kyoto','Osaka','Sendai'],
        sum:'A leader in technology and research with generous MEXT scholarships and a growing number of English programmes.' },
    kr:{ count:60, fee:'₩4M–₩12M', cont:'Asia', cities:['Seoul','Busan','Daejeon','Incheon'],
        sum:'High-tech campuses, strong government scholarships and a vibrant student culture in the heart of East Asia.' },
    sg:{ count:6, fee:'S$17,000–$50,000', cont:'Asia', cities:['Singapore'],
        sum:'A compact powerhouse — NUS and NTU rank among the very best in Asia, taught entirely in English.' },
    cn:{ count:300, fee:'¥20,000–¥60,000', cont:'Asia', cities:['Beijing','Shanghai','Hangzhou','Shenzhen'],
        sum:'Rapidly rising research universities, abundant scholarships and the fastest-growing science output in the world.' }
};

/* Continent guess for countries without a curated entry — keeps the card honest. */
const CONTINENT = {
    eu:['gb','ie','fr','de','es','it','pt','nl','be','ch','at','se','no','dk','fi','is','pl','cz','sk','hu','ro','bg','gr','hr','si','rs','ua','ee','lv','lt','lu','mt','cy','by','md','al','ba','mk','me'],
    as:['cn','jp','kr','in','sg','hk','my','th','vn','id','ph','tw','pk','bd','lk','np','kz','ae','sa','qa','il','jo','lb','ir','tr','ru'],
    af:['eg','ma','tn','dz','za','ng','ke','gh','et','tz','ug'],
    na:['us','ca','mx','cr','pa'],
    sa:['br','ar','cl','co','pe','uy','ec'],
    oc:['au','nz']
};
const CONT_NAME = { eu:'Europe', as:'Asia', af:'Africa', na:'North America', sa:'South America', oc:'Oceania' };

export function continentOf(code) {
    for (const k in CONTINENT) if (CONTINENT[k].indexOf(code) !== -1) return CONT_NAME[k];
    return 'World';
}

/* Build the info-card model for ANY country — curated where we have it,
   gracefully generated where we don't. `name` comes from the host app. */
export function regionInfo(code, name) {
    const r = REGION[code];
    if (r) return { name, code, count:r.count, fee:r.fee, cont:r.cont, cities:r.cities, sum:r.sum, curated:true };
    return {
        name, code,
        count: '—',
        fee: 'Varies',
        cont: continentOf(code),
        cities: [],
        sum: `Explore universities, tuition, visa guidance and student life across ${name}. Select it to open the full destination guide.`,
        curated: false
    };
}
