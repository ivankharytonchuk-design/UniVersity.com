# "What helps" drawer data for admitGuide.js — researched 2 Oct 2026.
# Levels: 4 can decide it · 3 big plus · 2 helps · 1 small plus · 0 doesn't count here.
# Categories: sport, academic (olympiads/research/competitions), arts, route (tests, early rounds,
# where you apply from), background (legacy, first-gen, low income, contextual), activities.
import json

def S(t, u): return {'t': t, 'u': u}
def H(cat, ic, t, lv, d, s, only=None):
    h = {'c': cat, 'ic': ic, 't': t, 'lv': lv, 'd': d, 's': s}
    if only: h['only'] = only
    return h

# ── shared sources ──────────────────────────────────────────────────
SFFA = S('Arcidiacono, Kinsler & Ransom — Legacy and athlete preferences at Harvard (SFFA trial data)', 'https://public.econ.duke.edu/~psarcidi/legacyathlete.pdf')
AB1780 = S('Governor of California — AB 1780 bans legacy & donor preferences (from 1 Sept 2025)', 'https://www.gov.ca.gov/2024/09/30/california-bans-legacy-and-donor-preferences-in-admissions-at-private-nonprofit-universities/')
QB = S('QuestBridge — college partners', 'https://www.questbridge.org/partners/college-partners')
NCAA = S('NCAA — the three divisions', 'https://www.ncaa.org/sports/2021/2/16/about-resources-media-center-ncaa-101-our-three-divisions.aspx')
OX_EC = S('Oxford — will my extra-curricular activities enhance my application?', 'https://uni-of-oxford.custhelp.com/app/answers/detail/a_id/445/~/will-my-extra-curricular-activities-enhance-my-application')
CAM_IMP = S('Cambridge — improve your application', 'https://www.undergraduate.study.cam.ac.uk/apply/before/improve-application')

# ── US: generated from each university's Common Data Set + programme facts ──────────────
D1 = {'princeton', 'harvard', 'stanford', 'columbia', 'duke', 'dartmouth', 'georgia-tech', 'rice', 'georgetown', 'usc', 'notre-dame', 'yale', 'cornell',
      'uc-berkeley', 'vanderbilt', 'upenn', 'brown', 'northwestern', 'ucla', 'michigan'}
QUEST = {'brown', 'caltech', 'columbia', 'cornell', 'dartmouth', 'duke', 'emory', 'harvard', 'johns-hopkins', 'mit', 'northwestern', 'princeton', 'rice', 'stanford',
         'tufts', 'notre-dame', 'upenn', 'usc', 'vanderbilt', 'yale'}
# early round (checked against each CDS section C21/C22 where present)
EARLY = {'harvard': 'rea', 'yale': 'scea', 'princeton': 'scea', 'stanford': 'rea', 'mit': 'ea', 'caltech': 'rea', 'georgetown': 'rea', 'notre-dame': 'rea',
         'georgia-tech': 'ea', 'usc': 'ea', 'uc-berkeley': 'none', 'ucla': 'none', 'michigan': 'ed', 'columbia': 'ed', 'upenn': 'ed', 'brown': 'ed', 'dartmouth': 'ed',
         'cornell': 'ed', 'duke': 'ed', 'johns-hopkins': 'ed', 'rice': 'ed', 'vanderbilt': 'ed', 'northwestern': 'ed', 'emory': 'ed', 'tufts': 'ed', 'carnegie-mellon': 'ed', 'nyu': 'ed'}
# Common Data Set C1 (applied/admitted, by residency) and C21 (early decision) — read from each CDS file
C1 = {  # key: (year, all, instate, outstate, intl, ed)   each = [applied, admitted]
 'princeton': ('2025-26', [42303, 1868], [4602, 229], [27134, 1398], [10567, 241], None),
 'harvard': ('2025-26', [47893, 2003], None, None, None, None),
 'stanford': ('2025-26', [60646, 2302], None, None, None, None),
 'columbia': ('2024-25', [60247, 2325], [9133, 346], [36521, 1620], [14593, 359], None),
 'duke': ('2024-25', [51795, 2957], [4748, 377], [31906, 1995], [15141, 585], [6013, 1042]),
 'johns-hopkins': ('2025-26', [50259, 3072], None, None, None, [7639, 835]),
 'dartmouth': ('2025-26', [28230, 1699], None, None, None, [3552, 768]),
 'carnegie-mellon': ('2025-26', [34867, 3859], None, None, None, [2680, 553]),
 'nyu': ('2024-25', [110807, 10232], None, None, None, None),
 'georgia-tech': ('2025-26', [66881, 8921], [12527, 3691], [44596, 4513], [9758, 716], None),
 'rice': ('2025-26', [36791, 2948], None, None, None, [5748, 647]),
 'georgetown': ('2024-25', [26131, 3374], [244, 41], [22272, 3053], [3615, 280], None),
 'usc': ('2025-26', [83488, 9345], [32499, 3692], [34374, 3378], [16615, 2275], None),
 'notre-dame': ('2025-26', [35401, 3320], [2069, 219], [26548, 2813], [6784, 288], None),
 'yale': ('2025-26', [50264, 2387], None, None, None, None),
 'cornell': ('2025-26', [72523, 6077], [12978, 1720], [40979, 3693], [18566, 664], [10057, 1889]),
 'uc-berkeley': ('2025-26', [126864, 14524], None, None, None, None),
 'vanderbilt': ('2025-26', [48196, 2593], [2885, 301], [36130, 1926], [9181, 366], [6202, 874]),
 'emory': ('2024-25', [34614, 3562], [4031, 514], [22362, 2528], [8221, 520], [4193, 974]),
 'tufts': ('2024-25', [34432, 3957], [4684, 701], [20401, 2672], [9336, 584], None),
 'upenn': ('2025-26', [72544, 3570], [5411, 451], [49251, 2678], [17882, 441], [9503, 1266]),
 'brown': ('2024-25', [48904, 2638], [591, 59], [37382, 2103], [10919, 475], [6251, 898]),
 'northwestern': ('2024-25', [49474, 3806], None, None, None, None),
 'michigan': ('2025-26', [109112, 17915], None, None, None, None),
}
PUBLIC = {'georgia-tech', 'uc-berkeley', 'ucla', 'michigan'}
PORTFOLIO = {
 'mit': ('Maker, research, music & theatre or visual-art portfolio', 2, 'Optional portfolios go to MIT faculty and staff through SlideRoom — the Maker Portfolio is read by an engineering board. Send one only if the work is significant to you.', S('MIT Admissions — creative portfolios', 'https://mitadmissions.org/apply/firstyear/portfolios-additional-material/')),
 'princeton': ('Arts supplement', 2, 'If you\'ve excelled in architecture, creative writing, dance, music, theatre or visual arts, an optional Arts Supplement is reviewed with your file.', S('Princeton — optional arts supplement', 'https://admission.princeton.edu/apply/optional-arts-supplement')),
 'yale': ('Arts or STEM research supplement', 2, 'Music, art, film or dance samples — or the STEM Research Supplement — are reviewed by faculty. Yale says most admitted students send only the required materials.', S('Yale — supplementary materials', 'https://admissions.yale.edu/supplementary')),
 'harvard': ('Arts supplement', 1, 'Optional art, dance or music submissions via SlideRoom — only useful for talent clearly beyond school level; most admits don\'t send one.', S('Harvard College — application requirements', 'https://college.harvard.edu/admissions/apply/application-requirements')),
 'stanford': ('Arts portfolio', 2, 'An optional Arts Portfolio (art practice, dance, music, theatre) for extraordinary talent — you don\'t have to major in the arts.', S('Stanford — arts portfolio', 'https://admission.stanford.edu/apply/first-year/arts.html')),
 'columbia': ('Arts portfolio or research abstract', 1, 'Optional: a creative portfolio (most who send one have regional-or-higher achievements) or a 1–2 page abstract of research done with a mentor.', S('Columbia — supplementary materials', 'https://undergrad.admissions.columbia.edu/apply/first-year/supplementary-materials')),
}
LV = {'very': 3, 'important': 2, 'considered': 1, 'not': 0}
WORD = {'very': 'very important', 'important': 'important', 'considered': 'considered', 'not': 'not considered'}

def pct(x): return round(x[1] / x[0] * 100, 1) if x and x[0] else None

def us_hooks(key, name, c7, cds_src):
    k = key.split(':')[1]
    out = []
    # sport
    if k == 'harvard':
        out.append(H('sport', 'fa-medal', 'Recruited athlete (tennis, rowing, squash…)', 4, 'Recruited athletes were admitted at about 86% — typical applicants at under 6% (Harvard\'s own data, classes of 2014–19, made public in court).', SFFA))
    elif k in D1:
        out.append(H('sport', 'fa-medal', 'Recruited athlete (tennis, rowing, fencing…)', 4, 'NCAA Division I: coaches can back a set number of recruits, and recruits are admitted far more often — at Harvard about 86% vs under 6%.', SFFA))
    elif k == 'mit':
        out.append(H('sport', 'fa-medal', 'Strong athlete', 2, 'Division III: no athletic scholarships and coaches don\'t select students — but you can contact a coach, who may support your application.', S('MIT Admissions — athletics', 'https://mitadmissions.org/discover/life-culture/athletics/')))
    elif k == 'caltech':
        out.append(H('sport', 'fa-medal', 'Strong athlete', 1, 'No recruiting "slots": athletes can\'t be promised a place and go through the same review.', S('Caltech Admissions blog — being a Caltech athlete', 'https://caltechadmissions.blog/being-a-caltech-athlete/')))
    else:
        out.append(H('sport', 'fa-medal', 'Strong athlete', 2, 'NCAA Division III: no athletic scholarships; coaches can support applicants but can\'t guarantee a place.', NCAA))
    # early round
    e = EARLY.get(k)
    c1 = C1.get(k)
    if e == 'ed':
        if c1 and c1[5] and c1[1]:
            er, ar = pct(c1[5]), pct(c1[1])
            out.append(H('route', 'fa-bolt', 'Applying Early Decision', 3 if er / ar >= 2.5 else 2,
                         'Early Decision: %s%% admitted vs %s%% overall (%s). It\'s binding — and recruited athletes and legacies apply early too, so your own boost is smaller.' % (er, ar, c1[0]), cds_src))
        else:
            out.append(H('route', 'fa-bolt', 'Applying Early Decision', 2, 'Binding Early Decision round. The university doesn\'t publish its early numbers in the Common Data Set.', cds_src))
    elif e in ('rea', 'scea'):
        out.append(H('route', 'fa-bolt', 'Applying early (restrictive early action)', 1, 'Non-binding, but you can\'t apply early anywhere else. The university no longer publishes early-round numbers.', cds_src))
    elif e == 'ea':
        out.append(H('route', 'fa-bolt', 'Applying Early Action', 1, 'Non-binding — mostly an earlier answer.', cds_src))
    elif e == 'none':
        out.append(H('route', 'fa-bolt', 'Applying early', 0, 'There is no early round at the University of California — everyone applies by 30 November.', S('University of California — how to apply', 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-freshman/')))
    # talent (olympiads, chess, music, national rankings)
    t = c7.get('Talent/ability') if c7 else None
    if t:
        out.append(H('academic', 'fa-chess-knight', 'National-level talent — olympiad, chess, music, sport', max(LV[t], 1) if LV[t] else 0,
                     'Talent/ability is rated "%s" in %s\'s own Common Data Set. A national olympiad medal, a chess title or a national ranking is the kind of thing that counts here.' % (WORD[t], name), cds_src))
    ex = c7.get('Extracurricular activities') if c7 else None
    if ex:
        out.append(H('activities', 'fa-people-group', 'Depth in a few activities (leadership, impact)', LV[ex], 'Activities are rated "%s". Depth and real results beat a long list.' % WORD[ex], cds_src))
    if k in PORTFOLIO:
        p = PORTFOLIO[k]; out.append(H('arts', 'fa-palette', p[0], p[1], p[2], p[3]))
    # background
    lg = c7.get('Alumni/ae relation') if c7 else None
    if k in ('stanford', 'usc'):
        out.append(H('background', 'fa-people-roof', 'Parent or grandparent went here (legacy)', 0, 'California banned legacy and donor preferences at private universities from 1 Sept 2025 — the first affected class starts in fall 2026.', AB1780))
    elif k == 'caltech':
        out.append(H('background', 'fa-people-roof', 'Parent or grandparent went here (legacy)', 0, 'Caltech doesn\'t give legacy preference — and California law now bans it at private universities.', AB1780))
    elif lg:
        d = 'Legacy is rated "%s" in the Common Data Set.' % WORD[lg]
        if k == 'harvard': d += ' At Harvard, legacies were admitted at 33.6% — 5.7× non-legacies (classes of 2014–19).'
        out.append(H('background', 'fa-people-roof', 'Parent or grandparent went here (legacy)', LV[lg], d, SFFA if k == 'harvard' else cds_src))
    fg = c7.get('First generation') if c7 else None
    if fg:
        out.append(H('background', 'fa-seedling', 'First in your family to go to university', LV[fg], 'First-generation status is rated "%s".' % WORD[fg], cds_src))
    if k in QUEST:
        out.append(H('background', 'fa-hand-holding-heart', 'Low-income background (QuestBridge)', 3, '%s is a QuestBridge partner: through the National College Match, high-achieving low-income students can be admitted with a full four-year scholarship. Check eligibility on QuestBridge.' % name, QB))
    di = c7.get('Level of applicant') if c7 else None
    if di is not None:
        out.append(H('route', 'fa-envelope-open-text', 'Showing interest (visits, emails, info sessions)', LV[di],
                     'Demonstrated interest is %s here.' % ('rated "%s"' % WORD[di] if LV[di] else 'not considered — visits and emails don\'t change your odds'), cds_src))
    if k == 'georgia-tech':
        out.append(H('route', 'fa-location-dot', 'Living in Georgia (in-state)', 4, 'Georgia residents: %s%% admitted vs %s%% for out-of-state applicants (%s).' % (pct(c1[2]), pct(c1[3]), c1[0]), cds_src))
    return out

# ── UK ──────────────────────────────────────────────────────────────
def uk_sport(name, d, s): return H('sport', 'fa-medal', 'Elite athlete (tennis, rowing, golf…)', 0, d, s)
UK_OTHER_EC = lambda lv, d, s: H('activities', 'fa-chess-knight', 'Chess, music, debating, clubs', lv, d, s)
CTX = lambda d, s: H('background', 'fa-scale-balanced', 'Contextual offer (lower grades)', 3, d, s, 'UK applicants')
UK = {
 'gb:oxford': [
   H('route', 'fa-pen-ruler', 'Admissions test score (TMUA for CS)', 4, 'Shortlisting leans heavily on the test: in the 2025-26 round, CS offer holders averaged 65.3 on the maths test vs 38.9 for all applicants.', S('Oxford CS — admissions statistics 2025-26', 'https://www.cs.ox.ac.uk/admissions/undergraduate/admissions_statistics/feedback2025.pdf')),
   H('route', 'fa-comments', 'Interview — thinking out loud', 4, 'Shortlisted applicants are interviewed by tutors on unseen problems; practise explaining your reasoning.', S('Oxford CS — what tutors look for', 'https://www.cs.ox.ac.uk/admissions/undergraduate/why_oxford/what_tutors_look_for.html')),
   H('academic', 'fa-book-open-reader', 'Super-curricular work in your subject', 3, 'Reading, online courses, projects and summer schools in your subject — the only "activities" Oxford counts.', OX_EC),
   H('academic', 'fa-square-root-variable', 'Olympiads & subject competitions (UKMT, BIO…)', 2, 'Good evidence of ability and interest in your subject — but it doesn\'t replace the admissions test.', OX_EC),
   UK_OTHER_EC(0, 'Extra-curricular activities don\'t form part of Oxford\'s selection criteria in any subject.', OX_EC),
   uk_sport('Oxford', 'Doesn\'t count for admission — Oxford selects on academic ability and potential alone.', OX_EC),
   H('background', 'fa-scale-balanced', 'Opportunity Oxford / Astrophoria Foundation Year', 3, 'UK state-school students from under-represented backgrounds: a bridging programme for offer holders, or a fully funded foundation year (up to 50 places).', S('Oxford — Astrophoria Foundation Year', 'https://www.ox.ac.uk/admissions/undergraduate/applying/astrophoria-foundation-year'), 'UK applicants')],
 'gb:cambridge': [
   H('route', 'fa-pen-ruler', 'Admissions test (TMUA for CS)', 3, 'Most courses use a written assessment; for CS it\'s the TMUA (some colleges add the CSAT).', S('Cambridge — Computer Science', 'https://www.undergraduate.study.cam.ac.uk/courses/computer-science')),
   H('route', 'fa-comments', 'Academic interview', 3, 'Interviews test critical, independent thinking in your subject.', S('Cambridge — how we make decisions', 'https://www.undergraduate.study.cam.ac.uk/apply/after/application-decisions')),
   H('academic', 'fa-book-open-reader', 'Super-curricular reading & projects', 3, 'Cambridge looks for wider engagement with your subject — reading and exploration beyond the syllabus.', CAM_IMP),
   H('academic', 'fa-square-root-variable', 'Olympiads & subject competitions', 2, 'Counts as evidence of engagement with your subject, through your statement and interview.', CAM_IMP),
   UK_OTHER_EC(0, 'Activities unrelated to your course (sport, an instrument, chess) won\'t be taken into consideration.', CAM_IMP),
   uk_sport('Cambridge', 'Not taken into consideration — decisions are academic.', CAM_IMP)],
 'gb:imperial': [
   H('route', 'fa-pen-ruler', 'TMUA score (Computing)', 3, 'For 2027 entry you must sit the TMUA to be considered for Computing; around 13 applications per place in 2025.', S('Imperial — Computing BEng', 'https://www.imperial.ac.uk/study/courses/undergraduate/computing-beng/')),
   H('academic', 'fa-book-open-reader', 'Super-curricular work', 2, 'Your statement may be discussed at interview — make it about your subject.', S('Imperial — Computing BEng', 'https://www.imperial.ac.uk/study/courses/undergraduate/computing-beng/')),
   H('background', 'fa-scale-balanced', 'Contextual admissions', 3, 'Not lower grades here: eligible students predicted AAA get a guaranteed interview (if the test score meets the contextual threshold) or a guaranteed offer at the course minimum.', S('Imperial — contextual admissions', 'https://www.imperial.ac.uk/study/apply/undergraduate/process/admissions-schemes/'), 'UK applicants'),
   H('sport', 'fa-medal', 'Elite athlete', 0, 'Doesn\'t change your offer. Imperial Athletes scholarships: Gold £1,000–3,000, Silver £250–1,000, Bronze £200–400, plus S&C and physio.', S('Imperial — sport scholarships', 'https://www.imperial.ac.uk/sport/imperial-athletes/performance-sport/sport-scholarships/'))],
 'gb:ucl': [
   H('route', 'fa-pen-ruler', 'TARA test (all applicants, 2027)', 2, 'For 2027 entry every applicant sits TARA, a reasoning test.', S('UCL — entry requirements', 'https://www.ucl.ac.uk/study/prospective-students/undergraduate/how-apply/entry-requirements')),
   CTX('Access UCL: up to two grades below the standard offer — CS: A*AB instead of A*A*A. About 1,000 entrants a year are eligible.', S('UCL — access and participation', 'https://www.ucl.ac.uk/study/prospective-students/undergraduate/how-apply/access-and-participation')),
   UK_OTHER_EC(1, 'Spend most of your statement (about three-quarters) on your subject; activities only briefly.', S('UCL — writing the personal statement', 'https://www.ucl.ac.uk/prospective-students/undergraduate/writing-personal-statement')),
   uk_sport('UCL', 'Doesn\'t change your offer.', S('UCL — entry requirements', 'https://www.ucl.ac.uk/study/prospective-students/undergraduate/how-apply/entry-requirements'))],
 'gb:lse': [
   H('route', 'fa-pen-ruler', 'TMUA (Economics)', 3, 'All Economics applicants must sit the TMUA for 2027 entry.', S('LSE — BSc Economics', 'https://www.lse.ac.uk/study-at-lse/undergraduate/bsc-economics')),
   H('academic', 'fa-book-open-reader', 'Super-curricular depth', 3, 'At least 80% of your statement should be about your subject — reading, critical engagement, super-curriculars.', S('LSE — personal statement', 'https://www.lse.ac.uk/study-at-lse/Undergraduate/Prospective-Students/How-to-Apply/Completing-the-UCAS-form/Personal-Statement')),
   CTX('Contextual offers are one or two grades lower, depending on the programme (e.g. AAA instead of A*AA).', S('LSE — contextual admissions', 'https://www.lse.ac.uk/study-at-lse/undergraduate/prospective-students/how-to-apply/contextual-admissions-and-offers')),
   UK_OTHER_EC(1, 'Fine to mention briefly — but more space on clubs than on your subject weakens the statement.', S('LSE — personal statement', 'https://www.lse.ac.uk/study-at-lse/Undergraduate/Prospective-Students/How-to-Apply/Completing-the-UCAS-form/Personal-Statement'))],
 'gb:st-andrews': [
   CTX('Widening-access students get "minimum" entry grades (typically 1–2 grades below standard; CS IB 36 vs 38) or Gateway entry.', S('St Andrews — use of contextual data', 'https://www.st-andrews.ac.uk/study/policy/contextual-data/')),
   H('sport', 'fa-golf-ball-tee', 'Elite golfer or athlete', 0, 'Doesn\'t affect admission — scholarship decisions come after an offer. Saints Golf Performance Scholarships (with The R&A) and sport scholarships for international-level athletes.', S('St Andrews — performance sport scholarships', 'https://sport.wp.st-andrews.ac.uk/performance/scholarships/'))],
 'gb:kcl': [
   CTX('Contextual offers can be up to two grades lower — CS: AAA instead of A*A*A (IB 36 vs 39).', S('King\'s — Computer Science entry requirements', 'https://www.kcl.ac.uk/study/undergraduate/courses/computer-science-bsc/requirements')),
   H('sport', 'fa-medal', 'Elite athlete', 0, 'Doesn\'t change your offer. King\'s Sport gives a £1,000 athlete grant to national-level competitors and partners with TASS.', S('King\'s Sport — performance sport', 'https://www.kcl.ac.uk/sport/performance/performance-sport'))],
 'gb:edinburgh': [
   CTX('With a widening-access "Plus Flag" you\'re considered on the lower minimum entry requirements (CS: IB 32 vs a standard range up to 43).', S('Edinburgh — widening access offers', 'https://study.ed.ac.uk/undergraduate/access-edinburgh/widening-access-offers/what')),
   H('sport', 'fa-medal', 'Elite athlete (junior international or better)', 0, 'Doesn\'t change your offer — but the Elite Athlete Scholarship pays up to £10,000 a year, plus S&C, physio, flexible study and athlete flats.', S('Edinburgh — athlete scholarships', 'https://uoesport.ed.ac.uk/performance-sport/athlete-scholarships'))],
 'gb:warwick': [
   H('route', 'fa-pen-ruler', 'TMUA (Computer Science)', 3, 'Required for CS — except for applicants eligible for a contextual offer.', S('Warwick — contextual offers', 'https://warwick.ac.uk/study/undergraduate/applying/contextual-offers/')),
   CTX('Up to 2 grades lower than the standard offer (e.g. ABB rather than AAA) — and no TMUA for CS.', S('Warwick — contextual offers', 'https://warwick.ac.uk/study/undergraduate/applying/contextual-offers/')),
   H('sport', 'fa-medal', 'Elite athlete', 0, 'Doesn\'t change your offer. Warwick Sport scholarships: £500–£1,000 plus S&C, physio and psychology support.', S('Warwick — sport scholarships', 'https://warwick.ac.uk/services/sport/active/campus/teamwarwick/scholarships'))],
 'gb:manchester': [
   CTX('Manchester Access Programme (Greater Manchester students): offers up to two A-level grades lower, which can combine with a contextual offer.', S('Manchester — MAP eligibility', 'https://www.manchester.ac.uk/study/undergraduate/contextual-admissions/map/eligibility/')),
   H('sport', 'fa-medal', 'Elite athlete', 0, 'Doesn\'t change your offer. Sport scholarships: up to £1,500 towards training plus a package valued at over £9,000.', S('Manchester — sport scholarships', 'https://www.sport.manchester.ac.uk/sport-and-activity/scholarships/'))],
}

# ── Europe ──────────────────────────────────────────────────────────
TUM = S('TUM — aptitude assessment, BSc Informatics (overview with points)', 'https://www.cit.tum.de/fileadmin/w00byx/cit/Studium/Studiengaenge/Bachelor_Informatik/UEbersicht_EFV_BSc_Informatik_inkl._Berechnungsbeispiel_SoSe25.pdf')
KIT = S('KIT — Informatics BSc selection procedure', 'https://www.sle.kit.edu/english/vorstudium/bachelor-informatics.php')
MAN = S('Universität Mannheim — selection statute, BSc Business Administration', 'https://www.uni-mannheim.de/media/Einrichtungen/zula/Auswahlsatzungen_bachelor/satzung_ba_bwl.pdf')
NRW = S('Universität Bonn — places for elite athletes (NRW profile quota)', 'https://www.uni-bonn.de/en/studying/application-admission-and-enrollment/special-application-matters/high-level-athletes')
BW = S('Universität Tübingen — elite-athlete quota (Baden-Württemberg)', 'https://uni-tuebingen.de/studium/bewerbung-und-immatrikulation/sonderfaelle-bewerbung/spitzensportler-innenquote/')
EU = {
 'de:tum': [
   H('academic', 'fa-square-root-variable', 'Mathematik-Olympiade or Jugend forscht (state-level award)', 2, '+2 points on a 100-point scale (CS). 84+ points = direct admission, 73–83 = written test.', TUM),
   H('activities', 'fa-briefcase', 'Relevant internship', 2, 'Up to +3 points depending on length (2 months to over a year, full-time).', TUM),
   H('activities', 'fa-screwdriver-wrench', 'Relevant vocational training', 2, 'Up to +6 points (the cap for all extras together).', TUM),
   H('sport', 'fa-medal', 'National-squad athlete', 1, 'TUM is a "Partnerhochschule des Spitzensports" with the Bavarian Olympic centre — support to combine study and sport, not extra points.', S('TUM — partner university of elite sport', 'https://www.hs.mh.tum.de/en/mh/news-en/article/partnerhochschule-des-spitzensports-20-jahre-kooperation-zwischen-der-technischen-universitaet-muenchen-und-dem-olympiastuetzpunkt-bayern/')),
   H('activities', 'fa-chess-knight', 'Chess, music, clubs', 0, 'Not on the points list — only the qualifications above earn points.', TUM)],
 'de:rwth': [
   H('route', 'fa-door-open', 'CS has no admission limit', 4, 'Computer Science is open (zulassungsfrei): meet the entry requirements and complete the compulsory online self-assessment.', S('RWTH — Informatik B.Sc.', 'https://www.rwth-aachen.de/cms/root/studium/vor-dem-studium/studiengaenge/liste-aktuelle-studiengaenge/studiengangbeschreibung/~bnzs/informatik-b-sc-/?lidx=1')),
   H('sport', 'fa-medal', 'Squad athlete (A/B/C-Kader)', 3, 'In restricted programmes, NRW\'s profile quota lets elite athletes be admitted ahead of other applicants.', NRW),
   H('activities', 'fa-chess-knight', 'Activities & awards', 0, 'Not part of admission for open programmes.', S('RWTH — application bachelor', 'https://www.rwth-aachen.de/cms/root/studium/vor-dem-studium/bewerbung-um-einen-studienplatz/~dedw/bewerbung-bachelor/?lidx=1'))],
 'de:kit': [
   H('activities', 'fa-briefcase', 'Vocational training, work or extracurricular achievements', 3, 'Up to 5 of the 20 selection points in Informatics — a quarter of the maximum.', KIT),
   H('academic', 'fa-square-root-variable', 'Competitions & awards', 2, 'Count among "extracurricular achievements and qualifications" in that 5-point block.', KIT),
   H('sport', 'fa-medal', 'Squad athlete', 3, 'Baden-Württemberg has an advance quota for elite athletes in restricted programmes, if your sport ties you to the location.', BW)],
 'de:mannheim': [
   H('route', 'fa-language', 'C1 English (IELTS 7.0 / TOEFL 100)', 3, 'Worth 20 of 135 points in Business Administration — the biggest extra on the list.', MAN),
   H('activities', 'fa-briefcase', 'Business internship or vocational training', 2, 'Up to 8 points: a completed apprenticeship = 4; internships up to 2 each (over 3 months full value).', MAN),
   H('activities', 'fa-chess-knight', 'Other activities (sport, volunteering, chess…)', 1, 'At most 2 points — only if they show subject aptitude.', MAN),
   H('sport', 'fa-medal', 'Squad athlete', 3, 'Baden-Württemberg advance quota for elite athletes in restricted programmes.', BW)],
 'nl:tud': [
   H('route', 'fa-pen-ruler', 'Selection test score (CSE)', 4, 'Your test score puts you in a lottery category; your final rank is drawn within that category.', S('TU Delft — CSE matching & selection regulation 2026-27', 'https://filelist.tudelft.nl/TUDelft/Onderwijs/Opleidingen/Bachelor/Computer%20science%20engineering/selectieprocedure/Regulation%20CSE%20M_S%202026-2027.pdf')),
   H('activities', 'fa-chess-knight', 'Activities, sport, awards', 0, 'Not part of the selection.', S('TU Delft — CSE matching & selection regulation 2026-27', 'https://filelist.tudelft.nl/TUDelft/Onderwijs/Opleidingen/Bachelor/Computer%20science%20engineering/selectieprocedure/Regulation%20CSE%20M_S%202026-2027.pdf'))],
 'nl:eur': [
   H('route', 'fa-chart-simple', 'Your grade average (IBEB)', 4, 'Ranks 1–250 go to the best averages; the rest by a lottery weighted 50% grades, 50% chance. The online activity is pass/fail.', S('EUR — IBEB numerus fixus regulations', 'https://www.eur.nl/en/media/2025-09-regulations-numerus-fixus-ibeb-2026-2027')),
   H('activities', 'fa-chess-knight', 'Activities, sport, awards', 0, 'Not part of the selection.', S('EUR — IBEB numerus fixus regulations', 'https://www.eur.nl/en/media/2025-09-regulations-numerus-fixus-ibeb-2026-2027'))],
 'nl:uva': [
   H('route', 'fa-file-pen', 'Statement, exam & interview (PPLE)', 3, 'Selective programmes like PPLE score your GPA, a personal statement, a written exam and an interview.', S('UvA PPLE — admissions policy', 'https://pple.uva.nl/how-to-apply/admissions-policy/admissions-policy.html'))],
 'ch:eth-zurich': [
   H('route', 'fa-certificate', 'Meeting the certificate rules', 4, 'Admission is by your school certificate (or the entrance exam) — there is no selection on activities.', S('ETH — admission requirements 2025/26', 'https://ethz.ch/content/dam/ethz/main/education/admission/bachelor/andere-qual/ETH-Zulassungsbedingungen-EN.pdf')),
   H('sport', 'fa-medal', 'Elite athlete', 0, 'Doesn\'t affect admission; a Swiss Olympic Card brings study adjustments.', S('ETH — studies and elite sport', 'https://ethz.ch/students/en/counselling/special-study-situations/studies-and-elite-sport.html'))],
 'ch:epfl': [
   H('route', 'fa-certificate', 'Meeting the grade rules', 4, 'Certificate-based; the real filter is the first-year exam block — 15–17% of Swiss-Matura students left after year one (2016–21).', S('EPFL — early exit data', 'https://www.epfl.ch/about/data/drop-out-to-reorient-yourself-educational-pathways-after-an-early-exit-from-epfl'))],
 'ch:unisg': [
   H('route', 'fa-pen-ruler', 'Aptitude test (+ video interview)', 4, 'Foreign applicants compete for limited places; only the selection-procedure marks count, not your school grades.', S('HSG — selection procedure', 'https://www.unisg.ch/en/studium/zulassung/zulassung-bachelor-studium/hsg-selection-procedure/'))],
 'it:bocconi': [
   H('route', 'fa-pen-ruler', 'Test score (Bocconi test / SAT / ACT)', 4, '55% of the evaluation; the other 45% is your GPA. Nothing else is assessed.', S('Bocconi — admissions', 'https://www.unibocconi.it/en/applying-bocconi/bachelor-and-law-programs/application-and-admissions/admissions')),
   H('activities', 'fa-chess-knight', 'Activities, letters, CV', 0, 'Recommendation letters, motivation letters and CVs are not considered.', S('Bocconi — admissions', 'https://www.unibocconi.it/en/applying-bocconi/bachelor-and-law-programs/application-and-admissions/admissions')),
   H('sport', 'fa-medal', 'Elite athlete', 0, 'Not for admission — but Bocconi Sport Scholarships waive 60–100% of tuition (from 2026-27).', S('Bocconi — sport scholarship', 'https://www.unibocconi.it/en/applying-bocconi/bachelor-and-law-programs/funding/bocconi-sport-scholarship-ay-2026-27'))],
 'it:polimi': [
   H('route', 'fa-pen-ruler', 'TOL score', 4, 'Places are filled by test score; for popular courses the score needed can exceed 80/100.', S('Politecnico di Milano — engineering admission', 'https://www.polimi.it/en/prospective-students/how-to-apply/admission-to-laurea-programmes/engineering')),
   H('sport', 'fa-medal', 'National-level athlete', 0, 'Not for admission — the Dual Career programme (national call-up or top-12 national ranking) gives flexibility and sport-merit scholarships.', S('Sport Polimi — dual career', 'https://www.sport.polimi.it/en/dual-career/'))],
 'it:bologna': [
   H('route', 'fa-pen-ruler', 'TOLC / SAT for limited-place courses', 4, 'Restricted programmes rank applicants by test; others are open.', S('Università di Bologna — admission tests', 'https://www.unibo.it/en/study/enrolment-fees-and-other-procedures/degree-programmes/admission-tests')),
   H('sport', 'fa-medal', 'National-level athlete', 0, 'Not for admission — Dual Career "student-athlete" status (national call-up or top-32 ranking) gives a tutor and flexibility.', S('CUS Bologna — dual career', 'https://cusb.unibo.it/it/competizioni/percorso-dual-career-riconoscimento-dello-status-di-studente-atleta'))],
 'fr:sciencespo': [
   H('route', 'fa-comments', 'Oral interview', 4, 'Half of the decision: the file (40 points) and the oral (40 points) count equally.', S('Sciences Po admissions 2026 (summary)', 'https://www.digischool.fr/articles/orientation/parcoursup/sciences-po-admissions-2026/')),
   H('activities', 'fa-people-group', 'Activities and interests', 2, 'Personal projects, activities and reading that show interest in social sciences and current affairs.', S('Sciences Po — foreign secondary schools', 'https://www.sciencespo.fr/admissions/en/undergraduate/foreign-secondary-schools/'))],
 'fr:polytec': [
   H('academic', 'fa-square-root-variable', 'Science competitions & olympiads', 3, 'Named in the criteria with arts, athletics, internships and leadership — on top of strong maths and science.', S('École polytechnique — Bachelor admission criteria', 'https://programmes.polytechnique.edu/en/bachelors-admissions/bachelor-of-science/admissions-criteria-and-procedure')),
   H('sport', 'fa-medal', 'Athletics or performing arts', 2, '"Exemplary, sustained achievement" in any field counts in the holistic review.', S('École polytechnique — Bachelor admission criteria', 'https://programmes.polytechnique.edu/en/bachelors-admissions/bachelor-of-science/admissions-criteria-and-procedure')),
   H('route', 'fa-comments', 'Interview (~50 min, English)', 3, 'Shortlisted candidates are interviewed; the decision uses the file and the interview together.', S('École polytechnique — Bachelor admission criteria', 'https://programmes.polytechnique.edu/en/bachelors-admissions/bachelor-of-science/admissions-criteria-and-procedure'))],
 'es:ie': [
   H('activities', 'fa-people-group', 'Extracurriculars & global outlook', 2, 'Scored alongside grades, the IE admissions test and the online assessment.', S('IE University — admissions guide', 'https://www.ie.edu/uncover-ie/ie-university-admissions-process-a-guide/')),
   H('sport', 'fa-medal', 'Sport or social-impact talent', 1, 'Talent awards help with fees rather than admission.', S('IE — undergraduate scholarship programs', 'https://www.ie.edu/ie-foundation/our-pillars/scholarships-and-talent-development/undergraduate-scholarship-programs/'))],
 'ie:tcd': [
   H('route', 'fa-chart-simple', 'CAO points', 4, 'Admission is by points alone (e.g. CS 533 in 2025).', S('Trinity — CAO application information', 'https://www.tcd.ie/study/apply/making-an-application/undergraduate/cao/')),
   H('sport', 'fa-medal', 'Elite athlete', 0, 'Trinity sport scholars must meet the normal points — unlike UCD (up to 60-point concession).', S('Irish Times — sports scholarships in Ireland (Mar 2026)', 'https://www.irishtimes.com/your-money/2026/03/03/good-at-sport-heres-how-to-get-a-scholarship-in-ireland-worth-up-to-10000/')),
   H('background', 'fa-scale-balanced', 'HEAR / DARE', 3, 'Reduced-points places for socio-economic disadvantage (HEAR) or disability (DARE).', S('Trinity Access Programmes — HEAR FAQ', 'https://www.tcd.ie/trinityaccess/alternative-entry-routes/young-adults/hear/frequently-asked-questions/'), 'Irish school leavers')],
 'dk:ku': [
   H('route', 'fa-comments', 'Quota 2 interview', 4, 'In quota 2 the interview weighs most, then the quota-2 test and your grades.', S('University of Copenhagen — kvote 2 assessment', 'https://www.ku.dk/studier/optagelse/bachelor/kvote-2/kvote-2-vurdering-og-resultater'))],
 'dk:dtu': [
   H('route', 'fa-file-pen', 'Quota 2 motivation statement', 3, 'DTU puts great emphasis on motivation, plus maths, physics and chemistry grades.', S('DTU — quotas', 'https://www.dtu.dk/english/education/undergraduate/general-engineering/admission-and-deadlines/how-to-apply/quotas')),
   H('activities', 'fa-briefcase', 'Work, voluntary service, stays abroad, languages', 2, 'All listed as quota-2 criteria, with relevant work experience and other education.', S('DTU — quotas', 'https://www.dtu.dk/english/education/undergraduate/general-engineering/admission-and-deadlines/how-to-apply/quotas'))],
 'fi:aalto': [
   H('academic', 'fa-square-root-variable', 'Finnish science olympiads', 3, 'Success in the national olympiads can give direct access to a study place in technology, maths and science.', S('Aalto — Finnish Olympiad in Informatics', 'https://www.aalto.fi/en/news/finnish-olympiad-in-informatics-announces-winners-a-study-place-and-international-contests-as'))],
 'be:kul': [
   H('route', 'fa-door-open', 'Open access (most programmes)', 4, 'All bachelor\'s programmes except medicine and dentistry admit anyone with a valid diploma.', S('KU Leuven — entrance test', 'https://www.kuleuven.be/english/education/educational-glossary/educationalglossary-e/entrance-test')),
   H('sport', 'fa-medal', 'Elite athlete', 0, 'Not for admission — elite-athlete status (A+, A, B) adapts your timetable and exams.', S('KU Leuven Sport — topsport & studie', 'https://www.kuleuven.be/sport/aanbod/studenten/topsport-en-studie'))],
 'pt:ist': [
   H('sport', 'fa-medal', 'Registered high-performance athlete', 3, 'A special access regime for athletes on Portugal\'s high-performance register (Portuguese diploma and entrance exams needed).', S('DGES — high-performance athletes regime', 'https://www.dges.gov.pt/pt/pagina/f-praticantes-desportivos-de-alto-rendimento'))],
}

# ── country fallback (unis without their own list) ─────────────────
COUNTRY = {
 'us': [H('sport', 'fa-medal', 'Recruited athlete', 3, 'At NCAA Division I universities recruits are admitted far more often — at Harvard about 86% vs under 6%.', SFFA),
        H('background', 'fa-people-roof', 'Legacy', 1, 'Varies by university and is now banned in several states (e.g. California from Sept 2025).', AB1780)],
 'gb': [H('academic', 'fa-book-open-reader', 'Super-curricular work in your subject', 3, 'UK universities read the personal statement for your subject — at LSE at least 80% of it.', S('LSE — personal statement', 'https://www.lse.ac.uk/study-at-lse/Undergraduate/Prospective-Students/How-to-Apply/Completing-the-UCAS-form/Personal-Statement')),
        H('background', 'fa-scale-balanced', 'Contextual offer', 3, 'Most selective UK universities make offers 1–2 grades lower for eligible UK students.', S('Warwick — contextual offers', 'https://warwick.ac.uk/study/undergraduate/applying/contextual-offers/'), 'UK applicants')],
 'de': [H('sport', 'fa-medal', 'Squad athlete (A/B/C-Kader)', 3, 'Most states (e.g. Baden-Württemberg, NRW) have a quota letting squad athletes in ahead of others in restricted programmes.', BW),
        H('activities', 'fa-briefcase', 'Internships & vocational training', 2, 'Many restricted programmes give extra points for relevant training or internships (e.g. TUM, KIT, Mannheim).', KIT)],
 'es': [H('sport', 'fa-medal', 'High-level athlete (DAN/DAR)', 3, 'Public universities reserve at least 3% of places for high-level athletes (8% in sport sciences).', S('BOE — Real Decreto 412/2014', 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-6008'))],
 'pt': [H('sport', 'fa-medal', 'Registered high-performance athlete', 3, 'Special access regime; special regimes together get up to 5% of places.', S('DGES — high-performance athletes regime', 'https://www.dges.gov.pt/pt/pagina/f-praticantes-desportivos-de-alto-rendimento'))],
 'dk': [H('activities', 'fa-briefcase', 'Quota 2: work, activities, motivation', 3, 'Quota 2 assesses more than grades — motivation, relevant work and activities, often with a test and interview.', S('DTU — quotas', 'https://www.dtu.dk/english/education/undergraduate/general-engineering/admission-and-deadlines/how-to-apply/quotas'))],
 'fi': [H('academic', 'fa-square-root-variable', 'National science olympiads', 3, 'Can give direct access to a study place at most Finnish universities.', S('Aalto — Finnish Olympiad in Informatics', 'https://www.aalto.fi/en/news/finnish-olympiad-in-informatics-announces-winners-a-study-place-and-international-contests-as'))],
 'it': [H('route', 'fa-pen-ruler', 'Entrance test score', 4, 'Limited-place programmes rank applicants by test (TOLC, TOL, Bocconi test, SAT).', S('Politecnico di Milano — engineering admission', 'https://www.polimi.it/en/prospective-students/how-to-apply/admission-to-laurea-programmes/engineering'))],
 'nl': [H('route', 'fa-pen-ruler', 'Selection test or grades', 4, 'Numerus-fixus programmes rank by tests or grades, often with a weighted lottery; activities rarely count.', S('TU Delft — CSE regulation', 'https://filelist.tudelft.nl/TUDelft/Onderwijs/Opleidingen/Bachelor/Computer%20science%20engineering/selectieprocedure/Regulation%20CSE%20M_S%202026-2027.pdf'))],
 'ie': [H('route', 'fa-chart-simple', 'CAO points', 4, 'Irish admission is by points; some universities give elite athletes a concession (UCD up to 60).', S('Irish Times — sports scholarships in Ireland (Mar 2026)', 'https://www.irishtimes.com/your-money/2026/03/03/good-at-sport-heres-how-to-get-a-scholarship-in-ireland-worth-up-to-10000/'))],
 'be': [H('route', 'fa-door-open', 'Open access', 4, 'Most Flemish bachelor\'s programmes are open; medicine and dentistry have an entrance exam.', S('KU Leuven — entrance test', 'https://www.kuleuven.be/english/education/educational-glossary/educationalglossary-e/entrance-test'))],
 'ch': [H('route', 'fa-certificate', 'Certificate rules', 4, 'Swiss universities admit on your certificate (or an entrance exam); activities don\'t count.', S('ETH — admission requirements', 'https://ethz.ch/content/dam/ethz/main/education/admission/bachelor/andere-qual/ETH-Zulassungsbedingungen-EN.pdf'))],
 'fr': [H('route', 'fa-comments', 'Written application & interview', 3, 'Selective French programmes weigh the file and an oral heavily.', S('Sciences Po admissions 2026 (summary)', 'https://www.digischool.fr/articles/orientation/parcoursup/sciences-po-admissions-2026/'))],
 'ua': [H('route', 'fa-pen-ruler', 'NMT score', 4, 'Admission is by your weighted NMT score; athletes get +10 only for sport programmes.', S('RBC-Ukraine — admission 2026 bonuses', 'https://www.rbc.ua/rus/news/vstup-2026-k-rozrahuvati-konkursniy-bal-i-1783337298.html'))],
}

# ── grade "keycaps": the published CS offer (or nearest programme) ──
OFFERS = {
 'gb:oxford': {'prog': 'Computer Science', 'al': 'A*AA', 'ib': 39, 's': S('Oxford CS — entrance requirements', 'https://www.cs.ox.ac.uk/admissions/undergraduate/why_oxford/offers.html')},
 'gb:cambridge': {'prog': 'Computer Science', 'al': 'A*A*A', 'ib': 41, 's': S('Cambridge — Computer Science', 'https://www.undergraduate.study.cam.ac.uk/courses/computer-science')},
 'gb:imperial': {'prog': 'Computing', 'al': 'A*A*A', 'ib': 42, 's': S('Imperial — Computing BEng', 'https://www.imperial.ac.uk/study/courses/undergraduate/computing-beng/')},
 'gb:ucl': {'prog': 'Computer Science', 'al': 'A*A*A', 'ib': 40, 'ctx': {'al': 'A*AB', 'ib': 38}, 's': S('UCAS — UCL Computer Science 2027', 'https://www.ucas.com/explore/courses/840d4f27-1b10-ce47-9c9a-40a4aa07bf5c/computer-science?studyYear=2027')},
 'gb:lse': {'prog': 'Economics', 'al': 'A*AA', 'ib': 39, 's': S('LSE — BSc Economics', 'https://www.lse.ac.uk/study-at-lse/undergraduate/bsc-economics')},
 'gb:st-andrews': {'prog': 'Computer Science', 'al': 'AAA', 'ib': 38, 'ctx': {'ib': 36}, 's': S('St Andrews — Computer Science BSc', 'https://www.st-andrews.ac.uk/subjects/computer-science/computer-science-bsc/')},
 'gb:kcl': {'prog': 'Computer Science', 'al': 'A*A*A', 'ib': 39, 'ctx': {'al': 'AAA', 'ib': 36}, 's': S('King\'s — Computer Science entry requirements', 'https://www.kcl.ac.uk/study/undergraduate/courses/computer-science-bsc/requirements')},
 'gb:edinburgh': {'prog': 'Computer Science', 'al': 'A*A*A*', 'alLow': 'AAB', 'ib': 43, 'ibLow': 34, 'ctx': {'ib': 32}, 's': S('Edinburgh — Computer Science entry requirements', 'https://study.ed.ac.uk/programmes/undergraduate/57-computer-science/entry-requirements')},
 'gb:warwick': {'prog': 'Computer Science', 'al': 'A*A*A', 'ib': 39, 's': S('UCAS — Warwick Computer Science', 'https://www.ucas.com/explore/courses/96187c1d-ee68-4b33-3c0e-b040a93861f8/computer-science')},
 'gb:manchester': {'prog': 'Computer Science', 'al': 'A*AA', 'ib': 37, 's': S('Manchester — BSc Computer Science (2027)', 'https://www.manchester.ac.uk/study/undergraduate/courses/2027/00560/bsc-computer-science/')},
}

def build(unis, factors_ok=True):
    out = {}
    for key, u in unis.items():
        if key.startswith('us:'):
            src = (u.get('sources') or [None])[0] or S('Common Data Set', 'https://commondataset.org/')
            out[key] = us_hooks(key, u.get('name') or key, u.get('cds') or {}, src)
        elif key in UK: out[key] = UK[key]
        elif key in EU: out[key] = EU[key]
    return out

def us_odds(key, cds_src):
    c1 = C1.get(key.split(':')[1])
    if not c1: return None
    o = {'year': c1[0], 'all': c1[1], 's': cds_src}
    if c1[4] and c1[3]:
        o['intl'] = c1[4]
        o['us'] = [c1[3][0] + (c1[2][0] if c1[2] else 0), c1[3][1] + (c1[2][1] if c1[2] else 0)]
    if c1[5]: o['ed'] = c1[5]
    if key.split(':')[1] in PUBLIC and c1[2]: o['instate'] = c1[2]; o['outstate'] = c1[3]
    return o
