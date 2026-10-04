/* ════════════════════════════════════════════════════════════════════
   Housing data — researched October 2026 (sources listed per country).

   Per country:
     pressure   1 (easy) … 5 (crisis) — how hard it is to find a room
     routes     the realistic ways students find a home, best first:
                price key (dorm | pbsa | room | studio), when to start (months
                before move-in), how to apply, who gets it, what to expect
     platforms  where to search — ids from PLATFORMS below; each is
                "protected" (payment held until after you move in), "official"
                (public / university), "moderated" (vetted listings, you pay
                the landlord) or "open" (marketplace — the most scams)
     timeline   steps relative to move-in (m = months before) or fixed dates
                in the academic year (on: 'MM-DD')
     deposit, docs, rights, scams, sources

   City rents: cities in data/app_data.js (CG2_DATA.accCosts) are used
   directly; the other cities have researched ranges in CITY_RENT below.
   Every price on the page is a typical range, not a quote.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    // where to search — url(city, dates) builds a link straight to live listings
    function slug(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
    function low(s) { return slug(s).toLowerCase(); }
    var HA_COUNTRY = { gb: 'United-Kingdom', us: 'United-States', ch: 'Switzerland', nl: 'Netherlands', se: 'Sweden', de: 'Germany', fr: 'France', it: 'Italy', es: 'Spain', ie: 'Ireland', dk: 'Denmark', fi: 'Finland', be: 'Belgium', pt: 'Portugal' };
    var WG = { Berlin: 'Berlin.8', Munich: 'Muenchen.90', Hamburg: 'Hamburg.55', Heidelberg: 'Heidelberg.59', Frankfurt: 'Frankfurt-am-Main.41', Cologne: 'Koeln.73', Dresden: 'Dresden.27' };
    var SPOTAHOME = ['madrid', 'barcelona', 'valencia', 'sevilla', 'granada', 'london', 'paris', 'lyon', 'berlin', 'munich', 'hamburg', 'frankfurt', 'cologne', 'milan', 'rome', 'turin', 'bologna', 'florence', 'lisbon', 'porto', 'dublin', 'brussels'];
    var UNIPLACES = ['lisbon', 'porto', 'coimbra', 'braga', 'aveiro', 'madrid', 'barcelona', 'valencia', 'sevilla', 'granada', 'salamanca', 'milan', 'rome', 'turin', 'bologna', 'florence', 'paris', 'lyon', 'london'];
    var US_STATE = { Boston: 'ma', 'New York': 'ny', 'San Francisco': 'ca', 'Los Angeles': 'ca', Chicago: 'il', Austin: 'tx', Seattle: 'wa' };
    var DAFT = { Dublin: 'dublin-city', Cork: 'cork-city', Galway: 'galway-city', Limerick: 'limerick-city' };

    var PLATFORMS = {
        housinganywhere: { name: 'HousingAnywhere', host: 'housinganywhere.com', kind: 'protected', best: 'Rooms & studios you can book from abroad',
            note: 'Your first month is held until 48 hours after you move in — if the place isn\'t as described you can cancel for a full refund.',
            url: function (c, d) { return HA_COUNTRY[c.cc] ? 'https://housinganywhere.com/s/' + slug(c.name) + '--' + HA_COUNTRY[c.cc] + '?moveIn=' + d.in + '&moveOut=' + d.out : null; } },
        spotahome: { name: 'Spotahome', host: 'spotahome.com', kind: 'protected', best: 'Video-checked rooms and flats',
            note: 'Their staff film every place; 24-hour guarantee after move-in if it doesn\'t match the listing.',
            url: function (c, d) { return SPOTAHOME.indexOf(low(c.name)) !== -1 ? 'https://www.spotahome.com/s/' + low(c.name) + '?moveIn=' + d.in + '&moveOut=' + d.out : null; } },
        uniplaces: { name: 'Uniplaces', host: 'uniplaces.com', kind: 'protected', best: 'Student rooms — strongest in Portugal, Spain and Italy',
            note: 'You pay through the site; refunds depend on the listing\'s cancellation policy (the service fee isn\'t refundable).',
            url: function (c, d) { return UNIPLACES.indexOf(low(c.name)) !== -1 ? 'https://www.uniplaces.com/accommodation/' + low(c.name) + '?move-in=' + d.in + '&move-out=' + d.out : null; } },
        kamernet: { name: 'Kamernet', host: 'kamernet.nl', kind: 'moderated', best: 'The biggest room site in the Netherlands',
            note: 'Paid subscription (about €34 for 30 days) to message landlords. Safer than Facebook, but fakes still slip through.',
            url: function (c) { return 'https://kamernet.nl/en/for-rent/rooms-' + low(c.name); } },
        wggesucht: { name: 'WG-Gesucht', host: 'wg-gesucht.de', kind: 'moderated', best: 'Rooms in shared flats (WGs) in Germany',
            note: 'Free and huge. You write to the flatmates and usually do a "WG casting" (often by video).',
            url: function (c) { return WG[c.name] ? 'https://www.wg-gesucht.de/en/wg-zimmer-in-' + WG[c.name] + '.0.1.0.html' : 'https://www.wg-gesucht.de/en/'; } },
        wunderflats: { name: 'Wunderflats', host: 'wunderflats.com', kind: 'protected', best: 'Furnished flats, no SCHUFA needed',
            note: 'Pricier, but landlords are verified and you can sign remotely — handy for your first months.',
            url: function (c) { return 'https://wunderflats.com/en/furnished-apartments/' + low(c.name); } },
        spareroom: { name: 'SpareRoom', host: 'spareroom.co.uk', kind: 'moderated', best: 'UK flatshares', note: 'Large UK flatshare site; never pay before viewing and signing.',
            url: function (c) { return 'https://www.spareroom.co.uk/flatshare/' + low(c.name); } },
        rightmove: { name: 'Rightmove Student', host: 'rightmove.co.uk', kind: 'moderated', best: 'Student houses through letting agents',
            note: 'Listings come from registered agents; check the deposit is protected.', url: function () { return 'https://www.rightmove.co.uk/student-accommodation.html'; } },
        unite: { name: 'Unite Students', host: 'unitestudents.com', kind: 'official', best: 'The UK\'s largest private student halls', note: 'Bills included; no UK guarantor route available.',
            url: function (c) { return 'https://www.unitestudents.com/student-accommodation/' + low(c.name); } },
        iq: { name: 'iQ Student', host: 'iqstudentaccommodation.com', kind: 'official', best: 'Private student halls (UK)', note: 'Bills included, 44–51 week contracts.', url: function () { return 'https://www.iqstudentaccommodation.com/'; } },
        housinghand: { name: 'Housing Hand', host: 'housinghand.com', kind: 'official', best: 'A UK guarantor if you don\'t have one', note: 'Accepted by 4,000+ UK providers; no UK credit history needed.', url: function () { return 'https://www.housinghand.com/'; } },
        crous: { name: 'CROUS', host: 'trouverunlogement.lescrous.fr', kind: 'official', best: 'Public student residences in France', note: 'Cheapest option; international students get the complementary phase (from early July).', url: function () { return 'https://trouverunlogement.lescrous.fr/'; } },
        visale: { name: 'Visale', host: 'visale.fr', kind: 'official', best: 'A free state guarantor in France', note: 'Replaces a French guarantor for students 18–30 — most landlords accept it.', url: function () { return 'https://www.visale.fr/'; } },
        studapart: { name: 'Studapart', host: 'studapart.com', kind: 'protected', best: 'Student rooms and studios in France', note: 'Partnered with many French universities; offers its own guarantee.', url: function () { return 'https://www.studapart.com/en/'; } },
        leboncoin: { name: 'Leboncoin', host: 'leboncoin.fr', kind: 'open', best: 'Private landlords (French)', note: 'Real bargains but also many fake ads — never pay before visiting.', url: function () { return 'https://www.leboncoin.fr/'; } },
        idealista: { name: 'idealista', host: 'idealista.com', kind: 'moderated', best: 'Rooms and flats in Spain, Italy and Portugal', note: 'The biggest property site in Southern Europe; you deal with the landlord directly.',
            url: function (c) { return c.cc === 'it' ? 'https://www.idealista.it/en/' : c.cc === 'pt' ? 'https://www.idealista.pt/en/' : 'https://www.idealista.com/en/'; } },
        badi: { name: 'Badi', host: 'badi.com', kind: 'moderated', best: 'Flatmates in Spain (app)', note: 'Room-matching app popular in Madrid and Barcelona.', url: function () { return 'https://www.badi.com/en/'; } },
        resa: { name: 'RESA residences', host: 'resa.es', kind: 'official', best: 'Private student residences in Spain', note: 'All-inclusive rooms, often with meals.', url: function () { return 'https://www.resa.es/en/'; } },
        immobiliare: { name: 'Immobiliare.it', host: 'immobiliare.it', kind: 'moderated', best: 'Italy\'s main rental site', note: 'Check the contract type (transitorio for students).', url: function () { return 'https://www.immobiliare.it/en/'; } },
        camplus: { name: 'Camplus', host: 'camplus.it', kind: 'official', best: 'Student residences across Italy', note: 'Furnished, community events, pricier than DSU dorms.', url: function () { return 'https://www.camplus.it/en/'; } },
        subito: { name: 'Subito / Facebook groups', host: 'subito.it', kind: 'open', best: 'Private ads', note: 'Where most Italian rental scams start — stolen photos, landlord "abroad".', url: function () { return 'https://www.subito.it/'; } },
        daft: { name: 'Daft.ie', host: 'daft.ie', kind: 'moderated', best: 'Ireland\'s main rental and room site', note: 'Very few listings in term time — act fast, but verify everything.',
            url: function (c) { return 'https://www.daft.ie/sharing/' + (DAFT[c.name] || low(c.name)); } },
        yugo: { name: 'Yugo', host: 'yugo.com', kind: 'official', best: 'Private student halls (IE, UK, ES…)', note: 'Bills included; book early — they sell out.', url: function () { return 'https://yugo.com/en-gb'; } },
        sssb: { name: 'SSSB', host: 'sssb.se', kind: 'official', best: 'Stockholm student housing queue', note: 'Join the queue the day you\'re admitted — you earn one credit day per day.', url: function () { return 'https://www.sssb.se/en/'; } },
        afb: { name: 'AF Bostäder', host: 'afbostader.se', kind: 'official', best: 'Student housing in Lund', note: 'Queue-based; apply as soon as you\'re admitted.', url: function () { return 'https://www.afbostader.se/en/'; } },
        sgs: { name: 'SGS Studentbostäder', host: 'sgs.se', kind: 'official', best: 'Student housing in Gothenburg', note: 'Queue points from the day you register.', url: function () { return 'https://www.sgs.se/en'; } },
        blocket: { name: 'Blocket Bostad', host: 'blocket.se', kind: 'moderated', best: 'Second-hand rentals in Sweden', note: 'Most student flats are second-hand sublets — ask for the first-hand tenant\'s permission.', url: function () { return 'https://www.blocket.se/'; } },
        kkik: { name: 'KKIK', host: 'kollegierneskontor.dk', kind: 'official', best: 'Copenhagen student halls (kollegier)', note: 'Register for free the moment you\'re admitted — internationals get a distance bonus.', url: function () { return 'https://www.kollegierneskontor.dk/'; } },
        findroommate: { name: 'Findroommate', host: 'findroommate.dk', kind: 'moderated', best: 'Rooms in Denmark', note: 'Paid messaging; Danish police warn of fake rooms in August.', url: function () { return 'https://www.findroommate.dk/'; } },
        boligportal: { name: 'BoligPortal', host: 'boligportal.dk', kind: 'moderated', best: 'Denmark\'s biggest rental site', note: 'Subscription renews automatically — cancel when you\'re done.', url: function () { return 'https://www.boligportal.dk/en/'; } },
        hoas: { name: 'HOAS', host: 'hoas.fi', kind: 'official', best: 'Student housing in Helsinki & Espoo', note: 'Shared flats come fast (days–weeks); studios can take 6–12 months.', url: function () { return 'https://hoas.fi/en/'; } },
        toas: { name: 'TOAS', host: 'toas.fi', kind: 'official', best: 'Student housing in Tampere', note: 'Shorter queues than Helsinki.', url: function () { return 'https://www.toas.fi/en/'; } },
        tys: { name: 'TYS', host: 'tys.fi', kind: 'official', best: 'Student housing in Turku', note: 'Apply once you have your study place.', url: function () { return 'https://www.tys.fi/en/'; } },
        vuokraovi: { name: 'Vuokraovi', host: 'vuokraovi.com', kind: 'moderated', best: 'Finland\'s main rental site', note: 'Mostly whole flats.', url: function () { return 'https://www.vuokraovi.com/'; } },
        kotwijs: { name: 'Kotwijs', host: 'kuleuven.be', kind: 'official', best: 'Leuven\'s university room database', note: 'Every listed kot has the city\'s quality label.', url: function () { return 'https://www.kuleuven.be/kotwijs'; } },
        mykot: { name: 'MyKot', host: 'mykot.be', kind: 'official', best: '4,500+ checked student rooms in Brussels', note: 'Run by Brik; every room is checked for safety first.', url: function () { return 'https://www.mykot.be/'; } },
        kotatgent: { name: 'Kotatgent', host: 'kotatgent.be', kind: 'official', best: 'Ghent\'s student room database', note: 'Run by the city with the universities.', url: function () { return 'https://www.kotatgent.be/'; } },
        woko: { name: 'WOKO', host: 'woko.ch', kind: 'official', best: 'Zurich\'s student housing cooperative', note: 'Rooms CHF 409–927; the only place it\'s OK to pay before viewing.', url: function () { return 'https://www.woko.ch/en/'; } },
        juwo: { name: 'JUWO', host: 'juwo.ch', kind: 'official', best: 'Flats for students and young people (Zurich)', note: 'Waiting list — register early.', url: function () { return 'https://www.juwo.ch/'; } },
        wgzimmer: { name: 'WGZimmer', host: 'wgzimmer.ch', kind: 'moderated', best: 'Flatshares in Switzerland', note: 'Big Swiss flatshare board.', url: function () { return 'https://www.wgzimmer.ch/en/'; } },
        flatfox: { name: 'Flatfox', host: 'flatfox.ch', kind: 'moderated', best: 'Swiss rentals incl. student rooms', note: 'Listings straight from property managers.', url: function () { return 'https://flatfox.ch/en/search/'; } },
        fmel: { name: 'FMEL', host: 'fmel.ch', kind: 'official', best: 'Student housing in Lausanne (EPFL / UNIL)', note: 'Foundation-run rooms near campus.', url: function () { return 'https://www.fmel.ch/en/'; } },
        duwo: { name: 'DUWO', host: 'duwo.nl', kind: 'official', best: 'Student housing in Delft, Leiden, Amsterdam', note: 'Many universities book international rooms through DUWO.', url: function () { return 'https://www.duwo.nl/en/'; } },
        ssh: { name: 'SSH', host: 'sshxl.nl', kind: 'official', best: 'Student housing in Utrecht, Rotterdam, Groningen…', note: 'Short-stay rooms for internationals.', url: function () { return 'https://www.sshxl.nl/en/'; } },
        roomnl: { name: 'ROOM.nl', host: 'room.nl', kind: 'official', best: 'Student rooms in the Amsterdam region', note: 'Waiting-time based — register as early as possible.', url: function () { return 'https://www.room.nl/en/'; } },
        zillow: { name: 'Zillow', host: 'zillow.com', kind: 'moderated', best: 'Off-campus apartments (US)', note: 'Huge; fake rentals copied from real listings are common — tour first.',
            url: function (c) { return US_STATE[c.name] ? 'https://www.zillow.com/' + low(c.name) + '-' + US_STATE[c.name] + '/rentals/' : 'https://www.zillow.com/'; } },
        apartments: { name: 'Apartments.com', host: 'apartments.com', kind: 'moderated', best: 'US apartment listings', note: 'Filter by distance to campus.',
            url: function (c) { return US_STATE[c.name] ? 'https://www.apartments.com/' + low(c.name) + '-' + US_STATE[c.name] + '/' : 'https://www.apartments.com/'; } },
        domria: { name: 'DOM.RIA', host: 'dom.ria.com', kind: 'moderated', best: 'Rentals in Ukraine', note: 'Owner and agent listings — agents usually charge 50–100% of the first month.', url: function () { return 'https://dom.ria.com/en/'; } },
        lun: { name: 'LUN', host: 'lun.ua', kind: 'moderated', best: 'Flats in Ukraine, with building info', note: 'Useful to check the building and the area.', url: function () { return 'https://www.lun.ua/'; } },
        olx: { name: 'OLX', host: 'olx.ua', kind: 'open', best: 'Private ads in Ukraine', note: 'Lots of real offers and lots of fakes — always view in person.', url: function () { return 'https://www.olx.ua/uk/nedvizhimost/'; } }
    };

    // monthly rent ranges (local currency) for cities without CG2_DATA: room in a shared flat, studio
    var CITY_RENT = {
        Amsterdam: { room: [750, 1100], studio: [1100, 1600] }, Rotterdam: { room: [600, 850], studio: [900, 1250] }, Utrecht: { room: [650, 900], studio: [950, 1300] },
        Delft: { room: [550, 800], studio: [850, 1150] }, Groningen: { room: [450, 650], studio: [700, 950] }, Leiden: { room: [600, 850], studio: [900, 1250] },
        Stockholm: { room: [5000, 7500], studio: [8000, 12000] }, Uppsala: { room: [4000, 6000], studio: [6500, 9000] }, Gothenburg: { room: [4500, 6500], studio: [7000, 10000] },
        Lund: { room: [4000, 5800], studio: [6000, 8500] }, 'Linköping': { room: [3800, 5500], studio: [5500, 8000] },
        Copenhagen: { room: [4500, 7000], studio: [7000, 11000] }, Aarhus: { room: [3500, 5500], studio: [5500, 8000] }, Odense: { room: [3000, 4800], studio: [5000, 7000] }, Aalborg: { room: [2800, 4500], studio: [4500, 6500] },
        Dublin: { room: [850, 1200], studio: [1500, 2100] }, Cork: { room: [650, 900], studio: [1100, 1500] }, Galway: { room: [600, 900], studio: [1100, 1500] }, Limerick: { room: [550, 800], studio: [1000, 1350] },
        Helsinki: { room: [450, 700], studio: [700, 1000] }, Espoo: { room: [450, 650], studio: [700, 950] }, Tampere: { room: [350, 550], studio: [550, 800] }, Turku: { room: [350, 550], studio: [550, 800] },
        Brussels: { room: [450, 700], studio: [700, 1000] }, Leuven: { room: [400, 600], studio: [650, 850] }, Ghent: { room: [400, 600], studio: [600, 850] }, Antwerp: { room: [400, 600], studio: [600, 850] }
    };

    var C = {
        gb: {
            cur: '£', pressure: 4, mood: 'Tight in London, Bristol, Edinburgh and St Andrews — fine almost everywhere else if you apply on time.',
            dorm: [600, 1150], dormName: 'University halls',
            routes: [
                { id: 'halls', icon: 'fa-building-columns', price: 'dorm', name: 'University halls', start: 7, late: 2,
                  what: 'University-run rooms with bills included. Most universities guarantee first-years a place if they apply by the deadline (often in June).',
                  how: 'Apply in the university accommodation portal as soon as you hold an offer (firm or insurance).', who: 'First-years and international students get priority.',
                  pros: ['Guaranteed for most first-years', 'Bills, Wi-Fi and contents insurance included', 'Easiest way to make friends'], cons: ['Contracts of 40–51 weeks', 'Popular halls fill early'] },
                { id: 'pbsa', icon: 'fa-building', price: 'pbsa', name: 'Private student halls', start: 9, late: 1,
                  what: 'Purpose-built student blocks run by companies like Unite Students, iQ, Vita or Scape. Bills included, gyms and study rooms.',
                  how: 'Book on the provider\'s site. Booking opens in autumn for the next year; the best-value rooms go January–April.', who: 'Anyone with a place at a nearby university.',
                  pros: ['Some (Unite, Vita) don\'t need a UK guarantor', 'Book entirely online from abroad'], cons: ['Pricier than university halls', 'Long fixed contracts (42–51 weeks)'] },
                { id: 'shared', icon: 'fa-people-roof', price: 'room', name: 'Room in a shared house', start: 3, late: 0,
                  what: 'Most students move to a shared house in year two. Search SpareRoom or letting agents on Rightmove.',
                  how: 'View in person or on a live video call, sign an Assured Shorthold Tenancy, then pay.', who: 'Usually needs a UK guarantor — or Housing Hand, or rent paid upfront.',
                  pros: ['Cheapest per month', 'Choose your own housemates'], cons: ['Guarantor needed', 'Bills often extra'] }
            ],
            platforms: ['unite', 'iq', 'housinganywhere', 'spotahome', 'uniplaces', 'spareroom', 'rightmove', 'housinghand'],
            timeline: [
                { m: 9, t: 'Private halls open their bookings', d: 'Many international students book between January and April — the best-value rooms go first.' },
                { m: 6, t: 'Apply for university halls with your offer', d: 'Deadlines for a guaranteed place are usually in June (LSE: 9 June 2026). Apply the week you accept your offer.' },
                { m: 3, t: 'Sort a guarantor', d: 'No UK guarantor? Housing Hand (from £42 a month over 8 months) or a provider that doesn\'t need one.' },
                { m: 1, t: 'Check your deposit is protected', d: 'Private landlords must put it in TDS, DPS or mydeposits within 30 days.' },
                { m: 0, t: 'Move in and photograph everything', d: 'Your inventory photos are how you get the deposit back.' }
            ],
            deposit: 'Private tenancies in England: deposit capped at 5 weeks\' rent and it must be protected in a government scheme (TDS, DPS or mydeposits) within 30 days. Halls usually take a booking fee instead.',
            docs: ['Passport and visa / CAS', 'Offer letter', 'A UK guarantor — or Housing Hand, or rent upfront', 'Bank statement (proof of funds)'],
            rights: ['Your deposit must be protected — if not, you can claim up to 3× its value', 'You get a written tenancy and the deposit scheme\'s details', 'Landlords need a gas safety certificate'],
            scams: 'UK students lost over £1m to rental fraud in 2023 (NFIB). Fake listings peak around freshers\' season; report to Action Fraud.',
            sources: [['LSE — book halls', 'https://www.lse.ac.uk/student-life/accommodation/apply'], ['How & when to book (2026/27)', 'https://www.mystudenthalls.com/news/how-to-book-student-accommodation/'], ['Housing Hand', 'https://housinghand.com/who-we-support/students'], ['Unite Students — avoiding scams', 'https://www.unitestudents.com/the-common-room/category/parents-and-guardians/how-to-avoid-uni-accommodation-scams-a-guide-for-uk-students']]
        },
        nl: {
            cur: '€', pressure: 5, mood: 'One of Europe\'s worst student housing shortages — popular rooms get 50+ replies within hours.',
            dorm: [450, 750], dormName: 'University / student housing',
            routes: [
                { id: 'uni', icon: 'fa-building-columns', price: 'dorm', name: 'Through your university', start: 7, late: 3,
                  what: 'Universities reserve rooms for international first-years with housing corporations (DUWO, SSH, ROOM.nl).', how: 'Apply in the university\'s housing portal by its deadline (some close in March, others in May).',
                  who: 'International first-years, limited places — not guaranteed.', pros: ['Furnished, legal contract', 'No scams'], cons: ['Limited — many miss out', 'Often only 1 year'] },
                { id: 'shared', icon: 'fa-people-roof', price: 'room', name: 'Room in a student house', start: 6, late: 0,
                  what: 'Rooms on Kamernet or HousingAnywhere, often in a house of 4–8 students.', how: 'Register on Kamernet in January–February; message fast and attend viewings (or "hospiteeravonden").',
                  who: 'Anyone — competition is fierce.', pros: ['Cheaper than studios', 'Living with Dutch students'], cons: ['Very competitive', 'Check you can register at the address (inschrijving)'] },
                { id: 'studio', icon: 'fa-door-closed', price: 'studio', name: 'Studio', start: 4, late: 1, what: 'Your own studio from a corporation or private landlord.', how: 'Pararius, HousingAnywhere or the corporations\' waiting lists.', who: 'Usually needs proof of income or a guarantor.', pros: ['Privacy'], cons: ['Expensive', 'Long waiting lists'] }
            ],
            platforms: ['housinganywhere', 'kamernet'],
            timeline: [
                { m: 8, t: 'Register on Kamernet and the corporations', d: 'January–February for September. Some waiting lists count the days since you registered.' },
                { m: 6, t: 'Apply for university housing', d: 'Deadlines range from March to May — check yours the day you\'re admitted.' },
                { m: 3, t: 'No university room? Go all-in on the private market', d: 'May–June: daily searches, fast replies, video viewings.' },
                { m: 1, t: 'Register at your address (BSN)', d: 'Make sure the contract allows registration — you need it for a bank account and insurance.' },
                { m: 0, t: 'Move in', d: 'Check the room matches the contract; keep the inventory.' }
            ],
            deposit: 'Since 1 July 2023 a deposit can be at most 2 months\' basic rent (Good Landlordship Act) — this applies to rooms too.',
            docs: ['Passport', 'Admission letter', 'Proof of funds or a guarantor', 'Registration at the address (BSN) after you arrive'],
            rights: ['Deposit max. 2× basic rent', 'Rent for rooms is regulated by points — the Huurcommissie can lower it', 'The landlord must let you register at the address'],
            scams: 'Scams cluster on Facebook groups and Marktplaats; they still slip past Kamernet\'s moderation. Insist on a live video tour.',
            sources: [['UT — 8 tips to avoid scams', 'https://www.utwente.nl/en/stories/student/299970/looking-for-student-housing-in-the-netherlands-avoid-scams-with-these-8-tips/?tag=student-tips'], ['Study-abroad: NL housing 2026', 'https://www.study-abroad.org/blog/nl-accommodation-guide/'], ['Max deposit 2026', 'https://findlawyer.nl/maximum-security-deposit-netherlands-2026/'], ['Good Landlordship Act', 'https://en.wikipedia.org/wiki/Good_Landlordship_Act']]
        },
        de: {
            cur: '€', pressure: 4, mood: 'Dorms are cheap but have waiting lists of 1–2 semesters (2–4 in Munich, Berlin, Hamburg); most students live in a WG.',
            dorm: [250, 450], dormName: 'Studierendenwerk dorm',
            routes: [
                { id: 'dorm', icon: 'fa-building-columns', price: 'dorm', name: 'Studierendenwerk dorm', start: 8, late: 4,
                  what: 'Public student halls run by the local Studierendenwerk — the cheapest rooms in Germany.', how: 'Apply on your city\'s Studierendenwerk portal the day you\'re admitted (you can apply before admission).',
                  who: 'Anyone enrolled; waiting lists are shortest for the summer semester.', pros: ['€250–450 a month', 'Furnished, bills included'], cons: ['Waits of 1–4 semesters', 'Can\'t pick the exact room'] },
                { id: 'wg', icon: 'fa-people-roof', price: 'room', name: 'Room in a WG', start: 2, late: 0,
                  what: 'A room in a shared flat — how most German students live.', how: 'WG-Gesucht: write a personal message, then a "WG casting" (in person or video).',
                  who: 'Anyone. Deposits are usually 1–2 months.', pros: ['Lots of choice', 'Fastest way to a room'], cons: ['Castings — you get chosen', 'Make sure you get a Wohnungsgeberbestätigung'] },
                { id: 'furnished', icon: 'fa-couch', price: 'studio', name: 'Furnished flat (first months)', start: 2, late: 0,
                  what: 'Verified furnished flats (Wunderflats, HousingAnywhere) that don\'t need a SCHUFA.', how: 'Book online, sign remotely, then hunt for something cheaper once you\'re there.',
                  who: 'Good for arrival.', pros: ['Bookable from abroad', 'No SCHUFA'], cons: ['Much more expensive'] }
            ],
            platforms: ['wggesucht', 'housinganywhere', 'wunderflats', 'spotahome'],
            timeline: [
                { m: 9, t: 'Join the Studierendenwerk waiting list', d: 'Apply the day you\'re admitted — or before. Each city has its own list.' },
                { m: 3, t: 'Start WG hunting', d: 'Most WG rooms are posted 1–2 months ahead. Have a short intro text ready.' },
                { m: 1, t: 'Book a furnished fallback if needed', d: 'A month on Wunderflats/HousingAnywhere while you look locally.' },
                { m: 0, t: 'Register your address (Anmeldung)', d: 'Within 14 days of moving in — you need the landlord\'s Wohnungsgeberbestätigung.' }
            ],
            deposit: 'Deposit (Kaution) is at most 3 months\' cold rent, and you may pay it in 3 monthly instalments. WGs usually ask 1–2 months.',
            docs: ['Passport', 'Admission letter / enrolment', 'Blocked account confirmation (instead of income)', 'SCHUFA — only for whole flats; not available before you arrive'],
            rights: ['Deposit max. 3× cold rent, payable in 3 parts', 'Landlord must give you the Wohnungsgeberbestätigung', 'Deposit must be kept separate from the landlord\'s money'],
            scams: 'Typical German scam: a too-cheap flat in Munich/Berlin, owner "abroad", keys via an "agency" after a transfer.',
            sources: [['Berlin student housing 2026', 'https://www.expatrio.com/about-germany/student-accommodation-in-berlin'], ['Studierendenwerk Karlsruhe FAQ', 'https://www.sw-ka.de/en/wohnen/wohnen-faq/'], ['Renting laws in Germany 2026', 'https://www.uniplaces.com/city-explorer/renting-laws-in-germany-2026/'], ['Wunderflats: legal tips', 'https://hub.wunderflats.com/international-tenants-in-germany-legal-rental-tips-for-non%E2%80%91eu-citizens/']]
        },
        fr: {
            cur: '€', pressure: 3, mood: 'Paris is hard; most other cities are manageable. CROUS is cheap but international students only join in July.',
            dorm: [250, 600], dormName: 'CROUS residence',
            routes: [
                { id: 'crous', icon: 'fa-building-columns', price: 'dorm', name: 'CROUS residence', start: 6, late: 1,
                  what: 'Public student residences — by far the cheapest. Non-EU students can\'t join the main phase but can apply in the complementary phase (from 7 July 2026).',
                  how: 'File a Dossier Social Étudiant (1 March – 31 May) and tick "logement"; then apply on trouverunlogement.lescrous.fr.', who: 'Priority to French scholarship holders; then everyone.',
                  pros: ['€250–600 a month', 'Eligible for CAF housing aid'], cons: ['Few rooms in Paris', 'International students apply later'] },
                { id: 'residence', icon: 'fa-building', price: 'pbsa', name: 'Private student residence', start: 4, late: 1, what: 'Studios in private residences (Studapart, Nexity Studéa…), often furnished.', how: 'Book online; most accept Visale as your guarantor.', who: 'Students with a place.', pros: ['Bookable from abroad', 'CAF aid applies'], cons: ['Pricier than CROUS'] },
                { id: 'coloc', icon: 'fa-people-roof', price: 'room', name: 'Colocation (flatshare)', start: 2, late: 0, what: 'A room in a shared flat — common in Lyon, Toulouse, Bordeaux.', how: 'Visit in person, sign a lease, use Visale as guarantor.', who: 'Anyone.', pros: ['Cheaper than a studio'], cons: ['Landlords want a guarantor — get Visale'] }
            ],
            platforms: ['crous', 'studapart', 'housinganywhere', 'spotahome', 'uniplaces', 'visale', 'leboncoin'],
            timeline: [
                { on: '03-01', t: 'Dossier Social Étudiant opens', d: 'File it by 31 May and tick "request housing".' },
                { on: '05-31', t: 'DSE deadline', d: 'Complete files sent before 31 May get priority.' },
                { on: '07-07', t: 'CROUS complementary phase opens to everyone', d: 'International students can now apply for remaining rooms.' },
                { m: 2, t: 'Get a Visale guarantee', d: 'Free for students 18–30 — replaces a French guarantor.' },
                { m: 0, t: 'Move in, then apply for CAF housing aid', d: 'APL can cover a real share of the rent, also for international students.' }
            ],
            deposit: 'Deposit: 1 month\'s rent (unfurnished) or 2 months (furnished). Returned within 1 month (2 if there\'s damage).',
            docs: ['Passport and visa', 'Admission / enrolment certificate', 'A guarantor — Visale is free', 'Bank details (RIB) for CAF'],
            rights: ['Deposit capped at 1–2 months', 'CAF housing aid (APL) for eligible students', 'Landlord can\'t ask for many documents (no bank statements, no deposit cheque in advance)'],
            scams: 'Leboncoin and Facebook scams: fake "owners" asking for a deposit by transfer before any visit.',
            sources: [['DSE 2026 — digiSchool', 'https://www.digischool.fr/articles/orientation/vie-etudiante/dossier-social-etudiant-2026/'], ['CROUS calendar 2026', 'https://www.aide-sociale.fr/demande-logement-etudiant/'], ['International students & Visale', 'https://demarchesetrangers.fr/etudiant/logement-etudiant-etranger-france']]
        },
        es: {
            cur: '€', pressure: 3, mood: 'Madrid and Barcelona are expensive and fast; other cities are easier. Most students share a flat (piso compartido).',
            dorm: [500, 1200], dormName: 'Residence / colegio mayor',
            routes: [
                { id: 'res', icon: 'fa-building-columns', price: 'dorm', name: 'Residencia / colegio mayor', start: 6, late: 1, what: 'University colleges and private residences, often with meals. From about €500 in cheaper cities to €1,000–1,600 with full board in Madrid/Barcelona.', how: 'Apply on the residence\'s site in spring.', who: 'Mostly first-years.', pros: ['Meals and cleaning', 'Community'], cons: ['Expensive in big cities', 'House rules'] },
                { id: 'piso', icon: 'fa-people-roof', price: 'room', name: 'Room in a piso compartido', start: 2, late: 0, what: 'A room in a shared flat — €220–300 in smaller cities, €500–600 in Madrid, Barcelona, Valencia.', how: 'Idealista, Badi, Spotahome; view in person or by video; sign a contract.', who: 'Anyone.', pros: ['Cheapest', 'Flexible'], cons: ['Ask whether bills are included'] }
            ],
            platforms: ['spotahome', 'uniplaces', 'housinganywhere', 'idealista', 'badi', 'resa'],
            timeline: [
                { m: 6, t: 'Apply for a residence or colegio mayor', d: 'Spring — they fill well before September.' },
                { m: 3, t: 'Start looking at shared flats', d: 'Most rooms are posted 1–2 months ahead; July–August is busiest.' },
                { m: 0, t: 'Register on the padrón', d: 'Register at your address at the town hall; you\'ll need the contract.' }
            ],
            deposit: 'Legal deposit (fianza): 1 month for a main home, 2 months for seasonal/student contracts, plus at most 2 extra months as a guarantee. Returned within 30 days.',
            docs: ['Passport / NIE', 'Enrolment letter', 'Proof you can pay (bank statement)'],
            rights: ['Fianza capped by law and deposited with the region', 'Deposit back within 30 days', 'Written contract'],
            scams: 'Fake "Airbnb payment" links and owners abroad are the common tricks — Spanish police warn every summer.',
            sources: [['Renting laws in Spain 2026', 'https://www.uniplaces.com/city-explorer/renting-laws-and-tenant-rights-in-spain-complete-guide-for-expats-and-students-2026/'], ['Student accommodation in Spain', 'https://el-relocator.com/blog-en/student-accommodation-in-spain'], ['Erasmus housing without scams', 'https://gomate.es/blog/en/erasmus-spain-housing-guide-2026']]
        },
        it: {
            cur: '€', pressure: 4, mood: 'Milan, Bologna and Rome are tight; scams have risen sharply. Public DSU dorms are cheap but means-tested.',
            dorm: [250, 450], dormName: 'DSU residence',
            routes: [
                { id: 'dsu', icon: 'fa-building-columns', price: 'dorm', name: 'Public residence (DSU)', start: 6, late: 2, what: 'Regional student-aid agencies (ER.GO in Bologna, DSU Toscana, DiSCo Lazio…) run cheap residences, mostly for students with grants.', how: 'Apply in the regional "diritto allo studio" call (usually July–September).', who: 'Means-tested — income documents needed.', pros: ['Very cheap', 'Often with a grant'], cons: ['Paperwork (ISEE / income)', 'Limited places'] },
                { id: 'res', icon: 'fa-building', price: 'pbsa', name: 'Private residence', start: 4, late: 1, what: 'Camplus, collegi and private residences — furnished, with community.', how: 'Book online.', who: 'Anyone.', pros: ['Bookable from abroad'], cons: ['Pricier'] },
                { id: 'room', icon: 'fa-people-roof', price: 'room', name: 'Room in a shared flat', start: 2, late: 0, what: 'Most students share. Ask for a "contratto transitorio per studenti" (1–18 months).', how: 'Uniplaces, Spotahome, idealista, Immobiliare.it. View before paying.', who: 'Anyone.', pros: ['Cheaper'], cons: ['Deposit 1–3 months', 'Scam-prone on Subito/Facebook'] }
            ],
            platforms: ['uniplaces', 'spotahome', 'housinganywhere', 'idealista', 'immobiliare', 'camplus', 'subito'],
            timeline: [
                { m: 6, t: 'Check the regional DSU call', d: 'Calls open in summer; prepare income documents.' },
                { m: 3, t: 'Search shared rooms', d: 'Ask for a student transitorio contract.' },
                { m: 0, t: 'Register the contract', d: 'The landlord must register it with the tax agency — ask for proof.' }
            ],
            deposit: 'Usually 1–3 months; must be returned within 30 days of leaving with an itemised list of deductions.',
            docs: ['Passport and visa', 'Codice fiscale (tax code)', 'Enrolment letter'],
            rights: ['A registered written contract', 'Deposit back within 30 days', 'Transitorio contracts need a valid reason — enrolment counts'],
            scams: 'Milan and Bologna scams have increased: stolen photos, below-market prices, "landlord abroad", bank transfer before signing.',
            sources: [['Best sites — Milan 2026', 'https://www.uniplaces.com/city-explorer/best-websites-to-find-student-accommodation-in-milan-2026-guide/'], ['Housing in Italy — mistakes', 'https://yugo.com/en-us/find-student-accommodation-italy-893072'], ['Don\'t get scammed in Milan', 'https://www.rentalmilan.com/dont-get-scammed-renting-a-house-in-milan-italy/']]
        },
        pt: {
            cur: '€', pressure: 3, mood: 'Lisbon moves fast and is pricey; Porto and Coimbra are easier. Start 3–4 months ahead for Lisbon.',
            dorm: [150, 400], dormName: 'University residence (SAS)',
            routes: [
                { id: 'sas', icon: 'fa-building-columns', price: 'dorm', name: 'University residence (SAS)', start: 5, late: 1, what: 'Social-services residences — very cheap, priority to grant holders.', how: 'Apply through your university\'s Serviços de Ação Social.', who: 'Limited; priority to scholarship students.', pros: ['Cheapest'], cons: ['Few places for internationals'] },
                { id: 'res', icon: 'fa-building', price: 'pbsa', name: 'Private residence', start: 4, late: 1, what: 'Residences like Nido, Livensa or Xior — €450–900+ in Lisbon.', how: 'Book online.', who: 'Anyone.', pros: ['Bookable from abroad', 'Bills included'], cons: ['Expensive in Lisbon'] },
                { id: 'room', icon: 'fa-people-roof', price: 'room', name: 'Room in a shared flat', start: 3, late: 0, what: 'Lisbon €300–700 (most pay €400–550); Porto €350–450.', how: 'Uniplaces is the go-to; view by video.', who: 'Anyone.', pros: ['Most choice'], cons: ['Deposit 1–2 months + first month'] }
            ],
            platforms: ['uniplaces', 'spotahome', 'housinganywhere', 'idealista'],
            timeline: [{ m: 4, t: 'Start looking (Lisbon)', d: 'The market moves fast — 3–4 months ahead.' }, { m: 2, t: 'Book a room', d: 'Confirm what\'s included (bills, cleaning).' }, { m: 0, t: 'Get your NIF (tax number)', d: 'Needed for most contracts.' }],
            deposit: 'Usually 1–2 months (caução) plus the first month upfront.',
            docs: ['Passport', 'NIF (tax number)', 'Enrolment letter'],
            rights: ['Written contract', 'Deposit returned at the end'],
            scams: 'Fake listings on Facebook and OLX; prefer platforms that hold your payment.',
            sources: [['Best sites — Lisbon 2026', 'https://www.uniplaces.com/city-explorer/best-websites-to-find-student-accommodation-in-lisbon-2026-guide/'], ['Lisbon cost of living 2026', 'https://www.uniplaces.com/city-explorer/cost-of-living-in-lisbon-2026/'], ['Portugal housing guide', 'https://www.study-abroad.org/blog/pt-accommodation-guide/']]
        },
        ie: {
            cur: '€', pressure: 5, mood: 'A real shortage: only ~34,000 student beds for 250,000 students. 230 scam reports in the first half of 2026 alone.',
            dorm: [700, 1100], dormName: 'On-campus residence',
            routes: [
                { id: 'campus', icon: 'fa-building-columns', price: 'dorm', name: 'On-campus residence', start: 7, late: 2, what: 'University-run rooms — the safest option, but places are scarce.', how: 'Apply the day your offer arrives; many have early deadlines.', who: 'Often first-years and internationals first.', pros: ['Safe, near campus'], cons: ['Very limited'] },
                { id: 'pbsa', icon: 'fa-building', price: 'pbsa', name: 'Private student halls', start: 6, late: 1, what: 'Yugo, Uninest and others.', how: 'Book online early — they sell out.', who: 'Anyone.', pros: ['Bookable from abroad'], cons: ['Expensive'] },
                { id: 'digs', icon: 'fa-house-chimney-user', price: 'room', name: 'Digs (room in a family home)', start: 2, late: 0, what: 'Homeowners rent rooms under the Rent-a-Room scheme — about 5,000 students live in digs.', how: 'University accommodation offices keep lists.', who: 'Often weekdays only.', pros: ['Cheaper', 'Available late'], cons: ['House rules', 'Sometimes Mon–Fri only'] }
            ],
            platforms: ['daft', 'housinganywhere', 'spotahome', 'yugo'],
            timeline: [{ m: 7, t: 'Apply for on-campus housing with your offer', d: 'Places go fast.' }, { m: 6, t: 'Book private halls', d: 'Before summer.' }, { m: 2, t: 'Search Daft and digs lists', d: 'Scams surge August–October — verify everything.' }],
            deposit: 'Usually 1 month; Ireland caps deposits at 1 month\'s rent for new tenancies.',
            docs: ['Passport and IRP / visa', 'Offer letter', 'References'],
            rights: ['Deposit max. 1 month', 'Register disputes with the RTB'],
            scams: 'Gardaí: 230 scam reports and €410,000+ lost in the first half of 2026; they surge August–October. Don\'t transfer money out of fear of losing a room.',
            sources: [['RTÉ — accommodation fraud warning', 'https://www.rte.ie/news/ireland/2026/0825/1589137-student-accommodation-fraud/'], ['Housing inequality — international students', 'https://publicpolicy.ie/papers/housing-inequality-international-students-in-ireland/'], ['Irish Times — tightening options', 'https://www.irishtimes.com/ireland/housing-planning/2026/08/26/third-level-students-warned-of-tightening-accommodation-options-as-cao-offers-come-in/']]
        },
        se: {
            cur: 'kr', pressure: 4, mood: 'Everything runs on queues. Fee-paying students at KTH and many others get guaranteed first-year housing — everyone should join the queue on day one.',
            dorm: [4000, 6000], dormName: 'Student housing queue',
            routes: [
                { id: 'guaranteed', icon: 'fa-shield-halved', price: 'dorm', name: 'University-guaranteed room', start: 6, late: 2, what: 'Many universities guarantee first-year housing to tuition-fee-paying students (e.g. KTH).', how: 'Apply through the university housing office by its deadline.', who: 'Fee-paying first-years; exchange students not guaranteed.', pros: ['Safe and simple'], cons: ['Only year one'] },
                { id: 'queue', icon: 'fa-list-ol', price: 'dorm', name: 'Student housing queue', start: 12, late: 6, what: 'SSSB (Stockholm), AF Bostäder (Lund), SGS (Gothenburg) — one credit day per day. Corridor rooms need 100–300 days, studios 500–1,000+.', how: 'Register the day you\'re admitted, even if you\'re guaranteed year one.', who: 'Enrolled students.', pros: ['Cheapest, first-hand contracts'], cons: ['Months of queue days'] },
                { id: 'sublet', icon: 'fa-people-roof', price: 'room', name: 'Second-hand sublet', start: 2, late: 0, what: 'Most private student rooms are sublets of someone else\'s flat.', how: 'Blocket Bostad, Qasa, Facebook groups — make sure the main tenant has permission.', who: 'Anyone.', pros: ['Available fast'], cons: ['Scam risk; check permission'] }
            ],
            platforms: ['housinganywhere', 'blocket'],
            timeline: [{ m: 12, t: 'Join the housing queue', d: 'Every day counts — join as soon as you\'re admitted.' }, { m: 5, t: 'Apply for guaranteed housing', d: 'Check your university\'s deadline (spring).' }, { m: 2, t: 'Search sublets if not housed', d: 'Ask for the landlord\'s consent to sublet.' }],
            deposit: 'Usually 1–3 months for sublets; queue housing often needs none or a small one.',
            docs: ['Passport', 'Admission letter', 'Residence permit'],
            rights: ['Sublets need the landlord\'s consent', 'Rent must be reasonable — you can challenge it'],
            scams: 'Fake sublets in Stockholm and Lund are common — never pay before seeing the flat and the contract.',
            sources: [['KTH — eligibility & application', 'https://www.kth.se/en/student/studier/housing/eligibility-and-application-1.809659'], ['How to find housing in Stockholm', 'https://www.kth.se/blogs/studentblog/2023/04/how-to-find-accommodation-in-stockholm/'], ['Sweden housing 2026', 'https://www.study-abroad.org/blog/se-accommodation-guide/']]
        },
        dk: {
            cur: 'kr', pressure: 4, mood: 'Copenhagen kollegier have waiting lists from months to 3 years — register with KKIK the moment you\'re admitted.',
            dorm: [3000, 5500], dormName: 'Kollegium (student hall)',
            routes: [
                { id: 'kkik', icon: 'fa-building-columns', price: 'dorm', name: 'Kollegium via KKIK / CIU', start: 8, late: 3, what: 'Student halls; KKIK manages about 6,460 rooms in Copenhagen. Priority by waiting time plus distance (internationals get a fixed bonus).', how: 'Register free at KKIK and CIU at least 6 months before arrival.', who: 'Enrolled students.', pros: ['Affordable, social'], cons: ['Waits can be long'] },
                { id: 'room', icon: 'fa-people-roof', price: 'room', name: 'Room in a shared flat', start: 2, late: 0, what: 'Rooms via Findroommate, BoligPortal, Facebook.', how: 'View before paying; Danish police warn of fake rooms every August.', who: 'Anyone.', pros: ['Faster'], cons: ['Deposit up to 3 months'] }
            ],
            platforms: ['housinganywhere', 'findroommate', 'boligportal'],
            timeline: [{ m: 8, t: 'Register at KKIK & CIU', d: 'At least 6 months before arrival.' }, { m: 2, t: 'Search rooms', d: 'August is scam season — verify.' }],
            deposit: 'Deposit up to 3 months\' rent plus up to 3 months prepaid rent is legal in Denmark.',
            docs: ['Passport', 'Admission letter', 'CPR number after arrival'],
            rights: ['Written contract (standard form)', 'Inspection report at move-in'],
            scams: 'Danish police warn students not to pay deposits for flats that don\'t exist.',
            sources: [['Student housing in Copenhagen — guide', 'https://uniavisen.dk/en/student-housing-in-copenhagen-the-guide/'], ['International House Copenhagen', 'https://international.kk.dk/study/student-housing'], ['Police warning (The Local)', 'https://www.thelocal.dk/20240731/danish-police-warn-students-against-housing-scams']]
        },
        fi: {
            cur: '€', pressure: 3, mood: 'Student foundations (HOAS, TOAS, TYS) house most students; shared flats come fast, studios can take 6–12 months.',
            dorm: [350, 600], dormName: 'Student foundation flat',
            routes: [
                { id: 'hoas', icon: 'fa-building-columns', price: 'dorm', name: 'Student foundation (HOAS / TOAS / TYS)', start: 5, late: 1, what: 'Non-profit student housing. Shared apartments can be offered within days; studios 6–12 months in Helsinki.', how: 'Apply as soon as you accept your study place (March–April for September).', who: 'Enrolled students.', pros: ['Affordable, legal'], cons: ['Studios are slow in Helsinki'] },
                { id: 'private', icon: 'fa-door-closed', price: 'studio', name: 'Private rental', start: 2, late: 0, what: 'Whole flats via Vuokraovi.', how: 'View, sign, pay a deposit.', who: 'Anyone.', pros: ['More choice'], cons: ['Pricier'] }
            ],
            platforms: ['housinganywhere', 'vuokraovi'],
            timeline: [{ m: 5, t: 'Apply to the student foundation', d: 'As soon as you accept your place.' }, { m: 1, t: 'Choose shared over studio if waiting', d: 'Shared flats are offered much faster.' }],
            deposit: 'Usually 1–3 months; student foundations ask a smaller deposit.',
            docs: ['Passport', 'Study place confirmation'], rights: ['Written lease', 'Deposit returned after inspection'],
            scams: 'Fake flats on Facebook groups — use the foundations.',
            sources: [['HOAS', 'https://hoas.fi/en/'], ['Helsinki Times — summer rush', 'https://www.helsinkitimes.fi/finland/finland-news/domestic/25376-summer-rush-for-student-housing-in-helsinki-tips-for-securing-a-place-fast.html'], ['Finland housing 2026', 'https://www.study-abroad.org/blog/fi-accommodation-guide/']]
        },
        be: {
            cur: '€', pressure: 3, mood: 'The "kot" (a furnished student room) is the norm; Leuven, Ghent and central Brussels are tight in August–September.',
            dorm: [350, 600], dormName: 'University residence',
            routes: [
                { id: 'uni', icon: 'fa-building-columns', price: 'dorm', name: 'University residence', start: 5, late: 1, what: 'University-run rooms (KU Leuven, UGent, ULB…).', how: 'Apply through the university housing service.', who: 'Limited.', pros: ['Safe'], cons: ['Limited'] },
                { id: 'kot', icon: 'fa-people-roof', price: 'room', name: 'Kot (student room)', start: 4, late: 0, what: 'A furnished room in a student house, €350–500 in Flanders. Look for the green or blue K-label (quality and fire safety checked).', how: 'Kotwijs (Leuven), Kotatgent (Ghent), MyKot (Brussels).', who: 'Anyone.', pros: ['Checked quality', 'Student contracts'], cons: ['August–September peak'] }
            ],
            platforms: ['housinganywhere'],
            timeline: [{ m: 5, t: 'Apply for university housing', d: 'Spring.' }, { m: 4, t: 'Search the kot databases', d: 'Checked rooms first.' }, { m: 0, t: 'Register at the town hall', d: 'Within 8 days of arriving.' }],
            deposit: '1–2 months for student contracts, paid into a blocked account in your name (Flemish housing code).',
            docs: ['Passport', 'Enrolment letter'], rights: ['Deposit in a blocked account in your name', 'Student contracts end at the academic year'],
            scams: 'Use the university/city databases — every listing there is checked.',
            sources: [['Belgium housing 2026', 'https://www.study-abroad.org/blog/be-accommodation-guide/'], ['KU Leuven — Brussels housing', 'https://www.kuleuven.be/english/life-at-ku-leuven/housing/studenthousing-brussels'], ['Leuven kot guide', 'https://leuvenkotgids.com/en/rooms/']]
        },
        ch: {
            cur: 'CHF', pressure: 4, mood: 'ETH and UZH have no university halls — WOKO and JUWO waiting lists run 3–12 months. Register the day your offer arrives.',
            dorm: [409, 927], dormName: 'WOKO / JUWO room',
            routes: [
                { id: 'woko', icon: 'fa-building-columns', price: 'dorm', name: 'Student housing cooperative', start: 9, late: 3, what: 'WOKO (Zurich, rooms CHF 409–927, average ~580), JUWO, FMEL (Lausanne).', how: 'Register on the waiting lists the day your offer arrives.', who: 'Enrolled students.', pros: ['Cheapest in Switzerland'], cons: ['Waits of 3–12 months'] },
                { id: 'wg', icon: 'fa-people-roof', price: 'room', name: 'Room in a WG', start: 3, late: 0, what: 'Private flatshares CHF 700–1,200 in Zurich.', how: 'wgzimmer.ch, flatfox.ch; view before paying.', who: 'Anyone.', pros: ['More choice'], cons: ['Expensive'] }
            ],
            platforms: ['wgzimmer', 'flatfox', 'housinganywhere'],
            timeline: [{ m: 9, t: 'Register on WOKO / JUWO', d: 'Waiting lists run 3–12 months.' }, { m: 3, t: 'Search WG rooms', d: 'Never pay in advance without viewing (WOKO is the exception).' }],
            deposit: 'Up to 3 months\' rent, held in a blocked account in your name.',
            docs: ['Passport and residence permit', 'Enrolment confirmation', 'Debt-register extract (for private flats)'], rights: ['Deposit max. 3 months in a blocked account'],
            scams: 'Zurich scams copy real flats — insist on a viewing.',
            sources: [['WOKO eligibility', 'https://www.woko.ch/en/our-service/who-is-eligible-to-rent'], ['ESN Zurich — find accommodation', 'https://zurich.esn.ch/w/public:live'], ['FAQ: Zurich student housing', 'https://www.swiftliving.ch/blog/en/faq-student-housing-zurich']]
        },
        us: {
            cur: '$', pressure: 3, mood: 'First-years usually must live on campus; housing deposits are often due around 1 May.',
            dorm: [900, 1600], dormName: 'On-campus residence hall',
            routes: [
                { id: 'campus', icon: 'fa-building-columns', price: 'dorm', name: 'On-campus residence hall', start: 7, late: 3, what: 'Most universities require first-years to live on campus for two semesters.', how: 'Applications open around January; the housing deposit is often due 1 May.', who: 'Required for most first-years.', pros: ['Guaranteed for first-years', 'Meal plans'], cons: ['Room & board is pricey'] },
                { id: 'offcampus', icon: 'fa-door-closed', price: 'studio', name: 'Off-campus apartment', start: 4, late: 0, what: 'From year two: apartments near campus.', how: 'University off-campus portals, Zillow, Apartments.com. Tour before signing.', who: 'Usually needs a co-signer.', pros: ['More freedom'], cons: ['12-month leases', 'Co-signer needed'] }
            ],
            platforms: ['housinganywhere', 'zillow', 'apartments'],
            timeline: [{ m: 8, t: 'Housing applications open', d: 'Around January.' }, { on: '05-01', t: 'Housing deposit due', d: 'Often 1 May (check your university).' }, { m: 1, t: 'Roommate matching & move-in date', d: 'Move-in slots fill fast.' }],
            deposit: 'Depends on the state; many cap it at 1–2 months.',
            docs: ['I-20 / visa', 'Admission letter', 'Co-signer for off-campus'], rights: ['State tenant laws apply'],
            scams: 'Fake sublets near campus asking for a deposit "to hold" the place are the most common student scam.',
            sources: [['UNC — first-year housing', 'https://housing.unc.edu/apply/first-year-students/'], ['Princeton — avoid scams', 'https://offcampushousing.princeton.edu/avoid-scams-and-fraud'], ['UC Santa Cruz — rental scams', 'https://communityrentals.ucsc.edu/during/scams/']]
        },
        ua: {
            cur: '₴', pressure: 2, mood: 'University dormitories (гуртожиток) are very cheap; private flats via OLX, DOM.RIA and LUN. Check your university\'s safety guidance and the nearest shelter.',
            dorm: [800, 5600], dormName: 'University dormitory',
            routes: [
                { id: 'dorm', icon: 'fa-building-columns', price: 'dorm', name: 'University dormitory (гуртожиток)', start: 3, late: 0, what: 'E.g. KPI corridor rooms from ₴800/month (4 people) to ₴5,600 for a single.', how: 'Through your faculty / international office after enrolment.', who: 'Enrolled students.', pros: ['Very cheap'], cons: ['Shared rooms', 'Older buildings'] },
                { id: 'flat', icon: 'fa-door-closed', price: 'studio', name: 'Rented flat', start: 1, late: 0, what: 'One-room flats in Kyiv ~₴16,000–18,000/month.', how: 'DOM.RIA, LUN, OLX; agents often charge 50–100% of the first month.', who: 'Anyone.', pros: ['Privacy'], cons: ['Agent fee'] }
            ],
            platforms: ['domria', 'lun', 'olx'],
            timeline: [{ m: 2, t: 'Ask your faculty about a dorm place', d: 'Right after enrolment.' }, { m: 1, t: 'View flats in person', d: 'Check heating, generator/backup power and the nearest shelter.' }],
            deposit: 'Usually 1 month plus the agent\'s fee.',
            docs: ['Passport', 'Student ID / enrolment'], rights: ['Written agreement'],
            scams: 'Prepayment scams on OLX — never pay before seeing the flat.',
            sources: [['Kyiv rent prices 2025–26', 'https://visitukraine.today/blog/7623/how-much-does-it-cost-to-rent-a-one-room-apartment-in-ukraine-2025-2026-prices-by-region'], ['Student housing in Ukraine', 'https://www.rocapply.com/study-in-ukraine/about-ukraine/student-accommodation-in-ukraine.html']]
        }
    };

    // city-specific official providers (shown first)
    var CITY_PLATFORMS = {
        Stockholm: ['sssb'], Lund: ['afb'], Gothenburg: ['sgs'], Copenhagen: ['kkik'], Helsinki: ['hoas'], Espoo: ['hoas'], Tampere: ['toas'], Turku: ['tys'],
        Leuven: ['kotwijs'], Ghent: ['kotatgent'], Brussels: ['mykot'], Zurich: ['woko', 'juwo'], Lausanne: ['fmel'],
        Amsterdam: ['roomnl', 'duwo'], Delft: ['duwo'], Leiden: ['duwo'], Utrecht: ['ssh'], Rotterdam: ['ssh'], Groningen: ['ssh'], Aarhus: [], Odense: [], Aalborg: [], Uppsala: [], 'Linköping': [], Antwerp: []
    };

    // the red flags every student should know (police, universities, platforms)
    var RED_FLAGS = [
        ['fa-money-bill-transfer', 'Money before you\'ve seen it', 'A deposit to "hold" a room you haven\'t viewed (in person or on a live video call) and before a contract.'],
        ['fa-plane-departure', 'The landlord is "abroad"', 'Working overseas, a missionary, a doctor — so they can\'t show it, but will post the keys.'],
        ['fa-key', 'Keys by post or an "agent"', 'Keys delivered by DHL or an agency after you pay. You\'ll never receive them.'],
        ['fa-building-columns', 'Untraceable payment', 'Western Union, MoneyGram, crypto, gift cards or a transfer to a foreign account.'],
        ['fa-link-slash', 'A fake platform link', 'A "secure Airbnb / Booking payment" link sent by e-mail or WhatsApp — the address is slightly off.'],
        ['fa-tag', 'Too cheap to be true', 'Far below the going rate, in the best area, bills included.'],
        ['fa-stopwatch', 'Pressure', '"Many students are interested — decide today."'],
        ['fa-id-card', 'Your passport, early', 'A copy of your ID or bank card before anything is signed.']
    ];
    var SAFE_STEPS = [
        'See it first — in person or on a live video call.',
        'Reverse-image search the photos (Google Lens).',
        'Get a signed contract with the full name and address.',
        'Pay through a platform that holds your money, or by card.',
        'Check the landlord owns or manages it.',
        'Scammed? Call your bank, then the police and the platform.'
    ];

    window.HousingData = { countries: C, platforms: PLATFORMS, cityRent: CITY_RENT, cityPlatforms: CITY_PLATFORMS, redFlags: RED_FLAGS, safeSteps: SAFE_STEPS,
        stats: [['57%', 'of UK students have come across an accommodation scam', 'https://uniacco.com/blog/how-to-spot-student-accommodation-scams-in-the-uk'],
                ['£1m+', 'lost by UK students to rental fraud in 2023 (NFIB)', 'https://uniacco.com/blog/how-to-spot-student-accommodation-scams-in-the-uk'],
                ['€410k', 'lost to student accommodation scams in Ireland in the first half of 2026', 'https://www.rte.ie/news/ireland/2026/0825/1589137-student-accommodation-fraud/']] };
})();
