# Builds design/data/admit_guide.js (the "What gets you in" guide). Run: python3 tools/admit-guide/build_guide.py
import os
# Builds design/data/admit_guide.js from the research collected on 2026-10-01/02.
# Every number comes from a cited official/primary source; text is written from those sources.
import json, os
S = os.path.dirname(os.path.abspath(__file__))  # this folder: inputs/, cds/res.json, hooks_data.py
OUT = os.path.join(S, '..', '..', 'design', 'data', 'admit_guide.js')
cds = json.load(open(S + '/cds/res.json'))
bls = json.load(open(S + '/inputs/bls2025.json'))
cbs = json.load(open(S + '/inputs/cbs_latest.json'))
cso = json.load(open(S + '/inputs/cso_ie.json'))
eus = json.load(open(S + '/inputs/eurostat_ses22.json'))

def src(t, u): return {'t': t, 'u': u}

# ───────────────────────── admissions: how it works, per country ─────────────────────────
COUNTRIES = {
 'gb': {'system': 'UCAS · up to 5 choices', 'tone': 'Grades first, then your subject interest',
   'steps': ['Apply through UCAS: up to five courses, one personal statement for all of them (three questions, 4,000 characters from the 2026 cycle).',
             'Oxford, Cambridge and most medicine courses close on 15 October; most others by 13 January 2027 for 2027 entry.',
             'Offers are usually conditional on your predicted grades; your school reference counts.',
             'Some courses add an admissions test (TMUA, ESAT, LNAT, UCAT, MAT…) and, mainly at Oxford, Cambridge, Imperial and in medicine, an interview.'],
   'weights': [['Predicted & achieved grades', 'very'], ['Personal statement (mostly academic)', 'important'], ['Admissions test, where required', 'important'], ['Interview, where used', 'important'], ['General extracurriculars', 'considered']],
   'achievements': 'Subject-related ("super-curricular") work — reading, competitions, olympiads, projects in your subject — carries far more weight than general clubs or sport.',
   'sources': [src('UCAS — 2027 application fee & choices', 'https://www.ucas.com/faqs/what-is-the-application-fee-for-the-2027-cycle'), src('LNAT — universities and 2027 deadlines', 'https://lnat.ac.uk/what-is-lnat/do-i-need-to-sit-the-test/'), src('UCL — how we assess your application', 'https://www.ucl.ac.uk/study/prospective-students/undergraduate/how-apply/how-we-assess-your-application')]},
 'us': {'system': 'Holistic review · Common App', 'tone': 'Every university weighs things differently',
   'steps': ['Apply through the Common App (or a university portal) with essays, recommendations and your school record.',
             'Early Action/Decision usually closes around 1 November, Regular Decision in early January.',
             'Each university publishes how much each factor matters in its Common Data Set (section C7) — that is what you see below.',
             'Testing policies changed a lot after 2024: some now require the SAT/ACT, some are optional, the UC campuses ignore them.'],
   'weights': [['Course rigour & GPA', 'very'], ['Essays & recommendations', 'important'], ['Activities, talent, character', 'important'], ['Tests at test-required schools', 'important']],
   'achievements': 'Depth beats a long list: sustained commitment, leadership and real outcomes in a few activities.',
   'sources': [src('Common Data Set initiative', 'https://commondataset.org/')]},
 'nl': {'system': 'Studielink · diploma-based', 'tone': 'Meet the requirements — selection only where places are capped',
   'steps': ['Apply through Studielink. Most bachelor\'s accept everyone who meets the diploma and subject requirements (often maths at the right level, English C1 for English-taught programmes).',
             'Programmes with capped places ("numerus fixus") close on 15 January and select between 15 January and 15 April; you get a ranking number on 15 April. Max. two such programmes a year.',
             'All other programmes: national deadline 1 May (many international deadlines are earlier).'],
   'weights': [['Diploma level & required subjects', 'very'], ['Grades in key subjects (selective programmes)', 'important'], ['Selection tests / activities (fixus)', 'important'], ['Motivation & CV (some programmes)', 'considered']],
   'achievements': 'Outside capped programmes, achievements barely change the decision — getting the right subjects (e.g. maths) on your diploma does.',
   'sources': [src('Study in NL — how to apply', 'https://www.studyinnl.org/plan-your-stay/how-to-apply')]},
 'de': {'system': 'Diploma recognition · grade-based', 'tone': 'Your school-leaving grade decides most places',
   'steps': ['Your school certificate must be recognised as a university entrance qualification; if not, you take a one-year Studienkolleg and the Feststellungsprüfung.',
             'Many universities check international documents through uni-assist (€75 for the first application).',
             'Restricted programmes (NC) rank by grade average; universities may add subject grades, tests, motivation letters or interviews.',
             'Most bachelor\'s are taught in German (proof at C1 usually needed).'],
   'weights': [['Overall grade average', 'very'], ['Grades in subjects relevant to the course', 'important'], ['Aptitude tests / interviews (some programmes)', 'important'], ['Work experience & extra qualifications', 'considered']],
   'achievements': 'Relevant internships, vocational training or competitions add points in some selection statutes (e.g. KIT, TUM) — but the grade average dominates.',
   'sources': [src('DAAD — requirements and Studienkollegs', 'https://www.daad.de/en/studying-in-germany/requirements/studienkollegs/'), src('uni-assist — Numerus Clausus', 'https://www.uni-assist.de/en/tools/glossary-of-terms/description/term/numerus-clausus-nc/')]},
 'ch': {'system': 'Recognised diploma · strict conditions', 'tone': 'Qualify on paper — or sit the entrance exam',
   'steps': ['ETH Zurich and EPFL admit everyone whose foreign diploma meets their conditions; otherwise you sit an entrance exam.',
             'The conditions are demanding: e.g. ETH asks IB 38/42 without bonus points with set HL subjects; EPFL asks an 80% average with maths and physics.',
             'HSG (St. Gallen) caps foreign students at 25% and runs an aptitude test; medicine is selective nationwide.'],
   'weights': [['Diploma type & subjects', 'very'], ['Overall average', 'very'], ['Entrance / aptitude exam (if required)', 'important'], ['Language level (German/French)', 'important']],
   'achievements': 'Achievements don\'t enter the decision at ETH/EPFL — the subjects and grades on your diploma do.',
   'sources': [src('ETH — admission requirements 2025/26', 'https://ethz.ch/content/dam/ethz/main/education/admission/bachelor/andere-qual/ETH-Zulassungsbedingungen-EN.pdf'), src('EPFL — bachelor admission criteria', 'https://www.epfl.ch/education/admission/admission-2/bachelor-admission-criteria-and-application/')]},
 'it': {'system': 'Entrance tests · limited places', 'tone': 'A test score + your last school years',
   'steps': ['Many degrees have limited places with an entrance test: TOLC (CISIA), a university\'s own test, or the SAT for international applicants.',
             'Private universities (Bocconi, LUISS) run their own selection with a test and your school grades.',
             'Non-EU applicants also pre-enrol through Universitaly; Italian-taught degrees need B2 Italian.'],
   'weights': [['Entrance test score', 'very'], ['School grades (last years)', 'important'], ['Language level', 'considered']],
   'achievements': 'Rarely part of the score at public universities; private ones may consider your profile.',
   'sources': [src('University of Bologna — admission tests', 'https://www.unibo.it/en/study/enrolment-fees-and-other-procedures/degree-programmes/admission-tests')]},
 'fr': {'system': 'Parcoursup · school files', 'tone': 'Your school reports, read by teachers',
   'steps': ['French-bac holders and EU students apply through Parcoursup; non-EU students mostly through Études en France (Campus France).',
             'Committees of teachers rank files on published criteria: grades from the last two years, the school\'s "fiche avenir", motivation and activities.',
             'Selective schools (Sciences Po, Polytechnique\'s bachelor, business schools) run their own written files and interviews.'],
   'weights': [['School reports (last two years)', 'very'], ['Teacher assessment (fiche avenir)', 'important'], ['Motivation / project', 'important'], ['Activities & engagement', 'considered']],
   'achievements': 'The "activities and centres of interest" section is read — show commitment linked to the course.',
   'sources': [src('Parcoursup — how files are examined', 'https://www.parcoursup.gouv.fr/candidater-sur-parcoursup/comment-les-formations-examinent-les-candidatures-1357')]},
 'es': {'system': 'Admission score 5–14 · cut-offs', 'tone': 'One number decides: your admission score',
   'steps': ['International students get a UNEDasiss accreditation: an admission score from 5 to 10 (60% school average + 40% specific tests, PCE).',
             'Each university weights subjects per degree, so the final score goes up to 14.',
             'Places go down the ranking until they run out — the last score admitted is the "nota de corte".',
             'Private universities (e.g. IE) run their own tests and interviews.'],
   'weights': [['School average', 'very'], ['Specific subject tests (PCE)', 'very'], ['Subject weighting for the degree', 'important']],
   'achievements': 'Not part of the score at public universities.',
   'sources': [src('UNEDasiss — FAQs', 'https://unedasiss.uned.es/faqs&idioma=en')]},
 'ie': {'system': 'CAO points', 'tone': 'Points from your best six subjects',
   'steps': ['Apply through the CAO. Your best six subjects become points (max 625); other qualifications are converted — e.g. IB 36 ≈ 496 and IB 42 ≈ 566 points.',
             'You must first meet matriculation (e.g. 2 H5 + 4 O6 including maths and English) and course requirements.',
             'Places go to the highest points; medicine needs at least 480 points plus the HPAT test.'],
   'weights': [['Points (best six subjects)', 'very'], ['Course subject requirements', 'very'], ['HPAT (medicine)', 'important']],
   'achievements': 'Not part of the CAO points system.',
   'sources': [src('CAO — EU/EFTA/UK entry requirements', 'https://www.cao.ie/euefta/'), src('CAO — undergraduate medicine', 'https://www.cao.ie/ugmed/')]},
 'se': {'system': 'Merit rating · universityadmissions.se', 'tone': 'Ranked by your school grades',
   'steps': ['Apply through universityadmissions.se. Eligible applicants are ranked by a merit rating (10–22.5) calculated from upper-secondary grades.',
             'You compete inside a selection group with people holding the same kind of qualification.',
             'Some programmes add portfolios, tests or interviews.'],
   'weights': [['Merit rating (grades)', 'very'], ['Specific entry requirements', 'very']],
   'achievements': 'Not part of grade-based selection.',
   'sources': [src('University Admissions — bachelor selection', 'https://www.universityadmissions.se/en/selection-and-admissions-results/selection-process-bachelors/')]},
 'dk': {'system': 'Quota 1 & 2', 'tone': 'Grades — or a holistic quota with a test',
   'steps': ['Quota 1 ranks EU/EEA, Nordic and IB diplomas purely by grade average (cut-offs change yearly).',
             'Quota 2 is holistic; diplomas from outside the EU/EEA can only apply here and sit the quota-2 test.',
             'Deadline for international diplomas: 15 March, 12:00.'],
   'weights': [['Grade average (quota 1)', 'very'], ['Quota-2 test & application (non-EU)', 'very'], ['Relevant experience (quota 2)', 'considered']],
   'achievements': 'Only count in quota 2.',
   'sources': [src('University of Copenhagen — quota 1 and 2', 'https://studies.ku.dk/bachelor/when-and-how-to-apply'), src('DTU — quotas', 'https://www.dtu.dk/english/education/undergraduate/general-engineering/admission-and-deadlines/how-to-apply/quotas')]},
 'fi': {'system': 'Certificate-based or entrance exam', 'tone': 'Grades, a test score — or an exam',
   'steps': ['Finnish universities admit through certificate-based selection (your final grades) or entrance exams.',
             'English-taught bachelor\'s at Aalto also use SAT/ACT scores (e.g. Science & Technology: SAT 1350 with Math 700; Business: SAT 1200).',
             'Admission normally leads to both the bachelor\'s and the master\'s (e.g. Aalto\'s 3 + 2 years).'],
   'weights': [['Final grades / test scores', 'very'], ['Entrance exam (where used)', 'very']],
   'achievements': 'Not scored in certificate-based selection.',
   'sources': [src('Aalto — bachelor\'s admissions', 'https://www.aalto.fi/en/admission-services/bachelors-admissions-frequently-asked-questions')]},
 'be': {'system': 'Open access · few entrance exams', 'tone': 'A recognised diploma gets you in',
   'steps': ['Most bachelor\'s programmes admit anyone with a recognised secondary diploma (international students via the admissions office).',
             'Medicine and dentistry have an entrance exam; at KU Leuven engineering requires taking the "ijkingstoets" positioning test.',
             'The real selection happens in the first year — study progress rules apply.'],
   'weights': [['Recognised diploma', 'very'], ['Entrance exam (medicine, dentistry)', 'very'], ['Positioning test (engineering, KU Leuven)', 'considered']],
   'achievements': 'Not part of admission.',
   'sources': [src('KU Leuven — eligibility and entrance test', 'https://www.kuleuven.be/english/apply/requested-documents/eligibility-bachelor')]},
 'pt': {'system': 'National contest · international regime', 'tone': 'Exams for Portuguese/EU students, a file for others',
   'steps': ['Portuguese and EU students compete in the national contest using national exams and school average.',
             'Non-EU students apply through the Special Admission Regime for International Students: CV, transcripts and, where needed, the university\'s own exams.',
             'Portuguese-taught degrees need B1 Portuguese; English-taught ones B1 English (e.g. at Técnico).'],
   'weights': [['School results', 'very'], ['Exams in key subjects', 'important'], ['Language level', 'considered']],
   'achievements': 'Not usually part of admission.',
   'sources': [src('Técnico — international students', 'https://tecnico.ulisboa.pt/en/education/study-at-tecnico/applications/international-students/')]},
 'ua': {'system': 'NMT · competitive score', 'tone': 'Your national test results, weighted per specialty',
   'steps': ['Ukrainian applicants take the National Multi-Subject Test (NMT): Ukrainian, maths and history of Ukraine plus one elective.',
             'Results are converted to a 100–200 scale; each specialty weights the subjects differently to build your competitive score.',
             'International applicants are admitted on their documents — check the university\'s international office for its own requirements.'],
   'weights': [['NMT results', 'very'], ['Subject weights for the specialty', 'very'], ['Regional / priority coefficients', 'considered']],
   'achievements': 'Not part of the competitive score.',
   'sources': [src('Ukrainian Center for Educational Quality Assessment — NMT 2026', 'https://testportal.gov.ua/en/university-entrance-exams-in-2026-(university-admission-campaign-2026)/')]},
}

# ───────────────────────── universities (non-US, curated) ─────────────────────────
UNIS = {
 'gb:oxford': {'grades': 'Typically A*AA–A*A*A or IB 38–40 (CS: A*AA / IB 39 incl. core, HL 766 with 7 in maths)', 'tests': 'Most courses (e.g. TMUA for computer science)', 'interview': 'Yes, for shortlisted applicants', 'written': 'Personal statement; written work for some courses',
   'values': ['Academic ability and potential in the subject', 'Admissions test score (decides shortlisting)', 'Interview — how you think about new problems', 'GCSEs / previous results and reference'],
   'helps': ['Super-curricular work: reading, competitions, summer schools, programming — all in your subject', 'Practising the admissions test (past papers)', 'Getting used to thinking out loud on unseen problems'],
   'doesnt': 'Extracurricular activities are not part of the selection criteria in any subject.',
   'sources': [src('Oxford — what tutors look for (CS)', 'https://www.cs.ox.ac.uk/admissions/undergraduate/why_oxford/what_tutors_look_for.html'), src('Oxford CS — entrance requirements', 'https://www.cs.ox.ac.uk/admissions/undergraduate/why_oxford/offers.html')]},
 'gb:cambridge': {'grades': 'Typically A*A*A–A*A*A*; IB 40–42 with 776 at HL (CS: A*A*A / IB 41–42)', 'tests': 'Most applicants (e.g. TMUA for CS; CSAT at some colleges)', 'interview': 'Yes — academic interviews', 'written': 'UCAS statement + My Cambridge Application',
   'values': ['Academic ability, most recent and relevant results', 'Admission assessment', 'Interview: critical, independent thinking', 'Personal statement: how you pursued the subject yourself'],
   'helps': ['Reading and projects beyond the syllabus — and being able to talk about them', 'Admission-assessment practice', 'Strong recent exam results'],
   'doesnt': 'Decisions are based solely on academic criteria.',
   'sources': [src('Cambridge — how we make decisions', 'https://www.undergraduate.study.cam.ac.uk/apply/after/application-decisions'), src('Cambridge — Computer Science requirements', 'https://www.undergraduate.study.cam.ac.uk/courses/computer-science')]},
 'gb:imperial': {'grades': 'High A-level/IB grades with required science/maths subjects', 'tests': 'ESAT or TMUA for many courses', 'interview': 'Yes, for many courses (Nov–Feb)', 'written': 'Personal statement',
   'values': ['Meeting high subject requirements', 'Admissions test (ESAT / TMUA)', 'Interview', 'Personal statement — may be discussed at interview'],
   'helps': ['Strong maths and science preparation', 'Test practice', 'Being able to discuss what you wrote in your statement'],
   'doesnt': '',
   'sources': [src('Imperial — our selection process', 'https://www.imperial.ac.uk/study/apply/undergraduate/process/selection/'), src('Imperial — admissions tests', 'https://www.imperial.ac.uk/study/apply/undergraduate/process/admissions-tests/')]},
 'gb:ucl': {'grades': 'Course-specific; meeting them doesn\'t guarantee an offer', 'tests': 'Some courses: TMUA (economics), LNAT (some law), UCAT (medicine), TARA (new)', 'interview': 'Not standard — some courses', 'written': 'Personal statement (key differentiator)',
   'values': ['Past and predicted grades', 'Personal statement — used to separate high achievers', 'Reference', 'Course tests where required'],
   'helps': ['A focused statement showing motivation and the skills the course needs'],
   'doesnt': '',
   'sources': [src('UCL — how we assess your application', 'https://www.ucl.ac.uk/study/prospective-students/undergraduate/how-apply/how-we-assess-your-application')]},
 'gb:lse': {'grades': 'High predicted grades; subject combinations matter', 'tests': 'TMUA required for Economics (and Econometrics & Mathematical Economics) for 2027 entry', 'interview': 'Never — LSE does not interview', 'written': 'Personal statement — at least 75% academic',
   'values': ['Achieved and predicted grades', 'Personal statement (academic engagement)', 'Reference & context', 'TMUA where required'],
   'helps': ['Academic reading and engagement with the subject — make it most of your statement'],
   'doesnt': 'No interviews, so the written application carries everything.',
   'sources': [src('LSE — admissions information', 'https://www.lse.ac.uk/study-at-lse/Undergraduate/Prospective-Students/How-to-Apply/Admissions-Information')]},
 'gb:st-andrews': {'grades': 'Grades are considered first', 'tests': 'Medicine', 'interview': 'Mostly no (medicine and a few routes)', 'written': 'Personal statement — often decides',
   'values': ['Achieved and predicted grades', 'Personal statement — decisive among well-qualified applicants', 'Reference & context'],
   'helps': ['A statement that shows genuine interest and potential in the subject'],
   'doesnt': '',
   'sources': [src('St Andrews — apply (undergraduate)', 'https://www.st-andrews.ac.uk/study/apply/ug/')]},
 'gb:kcl': {'grades': 'Course-specific', 'tests': 'UCAT (medicine, dentistry), LNAT (law)', 'interview': 'Some courses', 'written': 'Personal statement',
   'values': ['Grades and predicted grades', 'Personal statement', 'Interviews / tests for specific courses'],
   'helps': ['Course-specific preparation (UCAT/LNAT)', 'Relevant experience for health courses'],
   'doesnt': '',
   'sources': [src('KCL — important information for applying', 'https://www.kcl.ac.uk/study/undergraduate/how-to-apply/important-information-for-applying'), src('LNAT — who needs it', 'https://lnat.ac.uk/what-is-lnat/do-i-need-to-sit-the-test/')]},
 'gb:edinburgh': {'grades': 'Course-specific; widening-access entry for some', 'tests': 'Rarely', 'interview': 'Rarely (a few programmes)', 'written': 'Personal statement',
   'values': ['Academic qualifications (predicted grades matter)', 'Personal statement', 'Reference', 'Portfolios/interviews for specific programmes'],
   'helps': ['A statement showing you understand the subject at degree level and your relevant skills'],
   'doesnt': '',
   'sources': [src('Edinburgh — what you need to apply', 'https://study.ed.ac.uk/undergraduate/applying/making-application/what-you-need-apply')]},
 'gb:warwick': {'grades': 'Academic performance is the most important factor', 'tests': 'TMUA for Computer Science and Discrete Maths (not for contextual offers)', 'interview': 'Only theatre courses & atypical profiles', 'written': 'Personal statement (rarely decisive)',
   'values': ['Achieved and predicted grades (with context)', 'TMUA where required', 'Reference', 'Personal statement'],
   'helps': ['A strong TMUA for computing courses'],
   'doesnt': 'The personal statement is unlikely to be the single deciding factor.',
   'sources': [src('Warwick — admissions statement', 'https://warwick.ac.uk/study/undergraduate/applying/admissionsstatement/')]},
 'gb:manchester': {'grades': 'Course-specific', 'tests': 'Some courses', 'interview': 'Some courses', 'written': 'Personal statement',
   'values': ['Prior and predicted achievement', 'Course-specific non-academic criteria', 'Personal statement, interviews, tests where used'],
   'helps': ['Read your course profile — each course lists its own selection criteria'],
   'doesnt': '',
   'sources': [src('Manchester — assessing your application', 'https://www.manchester.ac.uk/study/undergraduate/applying/after-you-apply/your-application/')]},
 'nl:tud': {'grades': 'VWO-equivalent diploma with the right subjects; English test (IELTS 6.5/TOEFL 90) unless your IB/EB includes English', 'tests': 'Selection exam for numerus fixus programmes (e.g. Aerospace Engineering)', 'interview': 'No', 'written': 'Matching assignments (fixus programmes)',
   'values': ['Meeting the subject requirements', 'Selection exam in maths, physics and first-year topics (fixus)', 'Completing all mandatory matching assignments'],
   'helps': ['Preparing maths and physics for the selection exam', 'Registering early (15 January for fixus)'],
   'doesnt': 'Extracurriculars are not part of the ranking.',
   'sources': [src('TU Delft — Aerospace selection procedure', 'https://www.tudelft.nl/en/onderwijs/opleidingen/bachelors/ae/bsc-aerospace-engineering/from-application-to-enrolment/selection-procedure'), src('TU Delft — BSc admission requirements', 'https://www.tudelft.nl/en/education/admission-and-application/bsc-international-diploma/1-admission-requirements')]},
 'nl:eur': {'grades': 'IBEB: minimum maths and English grades (e.g. VWO Maths A 7.0 or B 6.0, English 7.0)', 'tests': 'Online curriculum-based activity (pass/fail)', 'interview': 'No', 'written': 'No',
   'values': ['Grade average (top 250 places go by grades)', 'Maths and English thresholds', 'Passing the online activity', 'Remaining places: weighted lottery (50% grades, 50% random)'],
   'helps': ['High school grades — they decide the top places'],
   'doesnt': '',
   'sources': [src('EUR — IBEB admission requirements', 'https://www.eur.nl/en/bachelor/international-bachelor-economics-and-business-economics/admission')]},
 'nl:uva': {'grades': 'VWO-equivalent diploma with mathematics; English C1', 'tests': 'Selective programmes only', 'interview': 'Some programmes', 'written': 'Some programmes',
   'values': ['Diploma equivalence with maths', 'English C1', 'Programme-specific selection where capped'],
   'helps': ['IB applicants meeting set criteria can skip the file assessment'],
   'doesnt': '',
   'sources': [src('UvA — IB admissions', 'https://www.uva.nl/en/education/admissions/bachelors/pilot-international-baccalaureate.html')]},
 'de:tum': {'grades': 'Grade average + subject grades (maths, English, science/CS)', 'tests': 'No national test; aptitude assessment', 'interview': '20-minute interview if your points are borderline', 'written': 'Written statement/essay in many programmes',
   'values': ['Points for your grade average', 'Points for subject grades', 'Extra qualifications: internships, vocational training, competitions', 'Interview (second stage)'],
   'helps': ['Competitions, relevant internships or training add points', 'A clear, specific written statement'],
   'doesnt': '',
   'sources': [src('TUM — admission procedures', 'https://www.tum.de/en/studies/application/application-info-portal/admission-procedures')]},
 'de:rwth': {'grades': 'Average 2.5 or better (German scale) for international applicants (TestAS can compensate)', 'tests': 'TestAS optional to offset a lower grade', 'interview': 'No', 'written': 'Mandatory online self-assessment',
   'values': ['Grade average', 'Formal requirements (open programmes admit all who meet them)', 'German C1'],
   'helps': ['A good TestAS if your average is weaker'],
   'doesnt': '',
   'sources': [src('RWTH — international applicants', 'https://www.rwth-aachen.de/cms/root/studium/vor-dem-studium/zugangsvoraussetzungen/zugangsvoraussetzung-fuer-den-bachelor-un/~drar/zugangsvoraussetzungen-fuer-internationa/?mobile=1&lidx=1')]},
 'de:kit': {'grades': 'Points for maths, CS and best science grade (Informatics)', 'tests': 'Mechanical Engineering (International): SAT ≥1200 / ACT ≥24 / TestAS', 'interview': 'No', 'written': 'Motivation letter (some programmes)',
   'values': ['Subject grades (up to 15 of 20 points in Informatics)', 'Extra achievements: training, practice, competitions (up to 5 points)'],
   'helps': ['Relevant practical work or competitions — they add points'],
   'doesnt': '',
   'sources': [src('KIT — Informatics bachelor', 'https://www.sle.kit.edu/english/vorstudium/bachelor-informatics.php')]},
 'de:mannheim': {'grades': 'Grade average + maths, German and foreign-language grades', 'tests': 'No', 'interview': 'No', 'written': 'No',
   'values': ['Grade average', 'Maths, German and language grades', 'Business work experience and related extracurriculars', 'Very good English'],
   'helps': ['Business-related work experience or activities'],
   'doesnt': '',
   'sources': [src('Mannheim — Business Administration', 'https://www.uni-mannheim.de/en/academics/before-your-studies/programs/business-administration/')]},
 'ch:eth-zurich': {'grades': 'IB 38/42 without bonus points; HL maths (AA or AI), a science and a language A', 'tests': 'Reduced entrance exam if you don\'t meet the conditions', 'interview': 'No', 'written': 'No',
   'values': ['Diploma conditions (subjects and points)', 'Otherwise: entrance exam'],
   'helps': ['Choosing the right HL subjects early', 'German skills — bachelor\'s are taught mainly in German'],
   'doesnt': 'Achievements play no role in admission.',
   'sources': [src('ETH — admission requirements 2025/26', 'https://ethz.ch/content/dam/ethz/main/education/admission/bachelor/andere-qual/ETH-Zulassungsbedingungen-EN.pdf')]},
 'ch:epfl': {'grades': 'EU/EFTA diplomas: 80% average with maths, physics and set subjects; A-levels: A grades in maths, physics and a science', 'tests': 'Entrance exam or foundation year for non-EU/EFTA/UK certificates', 'interview': 'No', 'written': 'No',
   'values': ['Diploma average (≥80%) and subjects', 'Places limited since 2025 — ranked by average'],
   'helps': ['French at B2 (C1 recommended)'],
   'doesnt': '',
   'sources': [src('EPFL — bachelor admission criteria', 'https://www.epfl.ch/education/admission/admission-2/bachelor-admission-criteria-and-application/')]},
 'ch:unisg': {'grades': 'Recognised diploma', 'tests': '70-minute online aptitude test (quantitative problem-solving, diagrams & tables)', 'interview': 'No', 'written': 'No',
   'values': ['Aptitude test', 'Foreign-student quota (25%)'],
   'helps': ['Practising quantitative reasoning — it\'s an aptitude, not a knowledge test'],
   'doesnt': '',
   'sources': [src('HSG — selection procedure', 'https://www.unisg.ch/en/studium/zulassung/zulassung-bachelor-studium/hsg-selection-procedure/')]},
 'it:bocconi': {'grades': 'GPA of the third-last and second-last school years (45%)', 'tests': 'Bocconi test, SAT or ACT (55%); SAT under 1040 not considered', 'interview': 'No', 'written': 'No',
   'values': ['Test score — 55%', 'School GPA — 45%', 'Country of origin (class diversity)'],
   'helps': ['A strong SAT/Bocconi test — it outweighs grades'],
   'doesnt': '',
   'sources': [src('Bocconi — admissions', 'https://www.unibocconi.it/en/applying-bocconi/bachelor-and-law-programs/application-and-admissions/admissions')]},
 'it:polimi': {'grades': 'Secondary diploma', 'tests': 'TOL (min 30/100) or TOLC-I, CEnT-S, SAT', 'interview': 'No', 'written': 'No',
   'values': ['Entrance test score'],
   'helps': ['Test practice; Italian B2 for Italian-taught degrees'],
   'doesnt': '',
   'sources': [src('PoliMi — engineering admission', 'https://www.polimi.it/en/prospective-students/how-to-apply/admission-to-laurea-programmes/engineering')]},
 'it:bologna': {'grades': 'Secondary diploma', 'tests': 'TOLC or SAT for many programmes (limited places)', 'interview': 'Some programmes', 'written': 'Some programmes',
   'values': ['Test results', 'Programme-specific requirements'],
   'helps': ['Check each programme\'s call — rules differ'],
   'doesnt': '',
   'sources': [src('Bologna — admission tests', 'https://www.unibo.it/en/study/enrolment-fees-and-other-procedures/degree-programmes/admission-tests')]},
 'fr:sciencespo': {'grades': 'Final exam results + academic record (scored)', 'tests': 'No', 'interview': 'Yes, for shortlisted candidates (scored /50)', 'written': 'Written pieces on motivation and academic project',
   'values': ['Secondary exam results', 'Academic performance over secondary school', 'Written pieces', 'Interview (marked /50; examiners don\'t see your file)'],
   'helps': ['Clear, critical writing in the essays', 'Practising image-commentary and discussion for the interview'],
   'doesnt': '',
   'sources': [src('Sciences Po — international applicants', 'https://www.sciencespo.fr/admissions/en/undergraduate/foreign-secondary-schools/')]},
 'fr:polytec': {'grades': 'Strong GPA, high potential in maths', 'tests': 'No standardised test', 'interview': '50 minutes: 30 min maths + 20 min science & motivation', 'written': 'Personal statement, CV, two references',
   'values': ['Mathematics potential', 'GPA', 'English C1', 'Interview'],
   'helps': ['Maths beyond the curriculum — the interview tests it', 'Scientific curiosity you can talk about'],
   'doesnt': '',
   'sources': [src('Polytechnique — bachelor interview', 'https://programmes.polytechnique.edu/en/bachelor/admissions/interview')]},
 'es:ie': {'grades': 'Transcripts reviewed', 'tests': 'IE Admissions Test (verbal, logical, numerical)', 'interview': 'Yes, most candidates', 'written': 'Online assessment (one written, two video answers), personal statement, CV',
   'values': ['Admissions test', 'Interview', 'Online assessment', 'Activities, languages and values you bring'],
   'helps': ['Activities and interests you can talk about with substance', 'Languages'],
   'doesnt': '',
   'sources': [src('IE University — admission process', 'https://www.ie.edu/university/admission/admission-process/')]},
 'ie:tcd': {'grades': 'CAO points (2025 minimum entry, e.g. Computer Science 533)', 'tests': 'HPAT for medicine', 'interview': 'No', 'written': 'No',
   'values': ['CAO points', 'Course subject requirements'],
   'helps': ['Maximising points in your best six subjects'],
   'doesnt': '',
   'sources': [src('TCD — 2025 CAO minimum entry levels', 'https://www.tcd.ie/study/assets/pdfs/2025-cao-minimum-entry-points-final.pdf')]},
 'dk:ku': {'grades': 'Quota 1: grade average (equivalent of 6.0+ to apply)', 'tests': 'Quota-2 test for non-EU diplomas', 'interview': 'Quota 2', 'written': 'Quota 2',
   'values': ['Grade average (quota 1)', 'Quota-2 assessment for non-EU diplomas'],
   'helps': ['Applying by 15 March with an international diploma'],
   'doesnt': '',
   'sources': [src('University of Copenhagen — quota 1 and 2', 'https://studies.ku.dk/bachelor/when-and-how-to-apply')]},
 'dk:dtu': {'grades': 'Quota 1: grade average', 'tests': 'Quota-2 test', 'interview': 'Quota 2', 'written': 'Quota 2',
   'values': ['Grade average', 'Quota-2 assessment'],
   'helps': [], 'doesnt': '',
   'sources': [src('DTU — quotas', 'https://www.dtu.dk/english/education/undergraduate/general-engineering/admission-and-deadlines/how-to-apply/quotas')]},
 'fi:aalto': {'grades': 'Certificate grades or SAT/ACT', 'tests': 'SAT/ACT (Science & Tech: 1350 total, 700 Math; Business: 1200)', 'interview': 'No', 'written': 'No',
   'values': ['SAT/ACT or certificate grades'],
   'helps': ['A strong SAT Math for science & technology'],
   'doesnt': '',
   'sources': [src('Aalto — bachelor\'s admissions', 'https://www.aalto.fi/en/admission-services/bachelors-admissions-frequently-asked-questions')]},
 'be:kul': {'grades': 'Access to higher education in your home country', 'tests': 'Entrance exam: medicine & dentistry; engineering: ijkingstoets + maths test', 'interview': 'No', 'written': 'No',
   'values': ['Recognised diploma', 'Entrance exam (medicine/dentistry)'],
   'helps': ['Preparing the engineering positioning test'],
   'doesnt': '',
   'sources': [src('KU Leuven — eligibility', 'https://www.kuleuven.be/english/apply/requested-documents/eligibility-bachelor')]},
 'pt:ist': {'grades': 'Secondary transcripts', 'tests': 'Own exams in maths, physics & chemistry if you lack valid final exams (May)', 'interview': 'No', 'written': 'CV',
   'values': ['School results', 'Técnico exams where needed', 'Language level'],
   'helps': ['Maths and physics preparation for the May exams'],
   'doesnt': '',
   'sources': [src('Técnico — international students', 'https://tecnico.ulisboa.pt/en/education/study-at-tecnico/applications/international-students/')]},
}

# ───────────────────────── US: Common Data Set C7 + testing policy ─────────────────────────
OFFICIAL_CDS = {'us:mit': 'https://ir.mit.edu/projects/2025-26-common-data-set/', 'us:harvard': 'https://oira.harvard.edu/common-data-set/', 'us:stanford': 'https://irds.stanford.edu/data-findings/cds',
 'us:princeton': 'https://ir.princeton.edu/other-university-data/common-data-set', 'us:yale': 'https://oir.yale.edu/common-data-set', 'us:columbia': 'https://opir.columbia.edu/cds', 'us:upenn': 'https://ira.upenn.edu/penn-numbers/common-data-set'}
SLUG = {'us:michigan': 'umich', 'us:notre-dame': 'university-of-notre-dame', 'us:tufts': 'tufts'}
US = {}
for k, v in cds.items():
    tp = v.get('testPolicy')
    entry = {'cds': v.get('c7') or None, 'cdsYear': v.get('year'), 'tests': tp}
    srcs = []
    if v.get('c7'):
        slug = SLUG.get(k, k.split(':')[1])
        srcs.append(src('Common Data Set ' + v['year'] + ', section C7', OFFICIAL_CDS.get(k) or ('https://www.collegedata.fyi/schools/' + slug + '/' + v['year'])))
    if tp: srcs.append(src('Testing policy (official admissions site)', tp['source']))
    entry['sources'] = srcs
    US[k] = entry
US['us:ucla']['note'] = 'UC campuses use a "comprehensive review" of 13 factors (grades, course rigour, achievements, personal insight answers, context) and do not consider SAT/ACT.'
US['us:ucla']['sources'].append(src('University of California — first-year requirements', 'https://admission.universityofcalifornia.edu/counselors/preparing-freshman-students/freshman-requirements.html'))
US['us:uc-berkeley']['note'] = US['us:ucla']['note']
US['us:caltech']['note'] = 'Holistic review; SAT or ACT required, no cut-off score.'
US['us:georgetown']['note'] = 'Alumni interviews are an important part of the process and are offered to almost every applicant.'
US['us:carnegie-mellon']['note'] = 'Fine Arts requires portfolios or auditions.'
for k, v in US.items(): UNIS[k] = v

FACTORS = [['Rigor of secondary school record', 'Course rigour', 'acad'], ['Academic GPA', 'GPA', 'acad'], ['Class rank', 'Class rank', 'acad'], ['Standardized test scores', 'Test scores', 'acad'],
 ['Application Essay', 'Essays', 'acad'], ['Recommendation', 'Recommendations', 'acad'], ['Interview', 'Interview', 'pers'], ['Extracurricular activities', 'Activities', 'pers'],
 ['Talent/ability', 'Talent', 'pers'], ['Character/personal qualities', 'Character', 'pers'], ['Volunteer work', 'Volunteering', 'pers'], ['Work experience', 'Work experience', 'pers'],
 ['First generation', 'First-generation', 'ctx'], ['Alumni/ae relation', 'Legacy', 'ctx'], ['Geographical residence', 'Where you live', 'ctx'], ['State residency', 'State residency', 'ctx'],
 ['Religious affiliation', 'Religion', 'ctx'], ['Level of applicant', 'Demonstrated interest', 'ctx']]

# ───────────────────────── careers: degree → job → salary ─────────────────────────
H38 = 1976  # Dutch hourly wage → yearly at 38 h/week (CBS publishes hourly wages)
def nl(level, field):
    out = []
    for p, yr in [('1y', 1), ('3y', 3), ('5y', 5), ('10y', 10)]:
        v = cbs.get(level + '|' + field + '|' + p)
        if v: out.append([yr, round(v[1] * H38 / 100) * 100, v[1]])
    return out
def ie(field, lvl):
    row = cso.get(field + '|NFQ Level ' + lvl) or []
    return [[int(y), round(w * 52 / 100) * 100, w] for y, b in row if b for _, w in [b]]
def eu(cc, sect): return (eus.get(cc, {}).get('sectors', {}).get(sect) or {}).get('tertiary')
def eu_young(cc):
    a = eus.get(cc, {}).get('age', {}); return round(a['Y_LT30'] / a['TOTAL'] * 100) if a.get('Y_LT30') and a.get('TOTAL') else None
SECT = {'cs': 'J', 'engineering': 'M', 'finance': 'K', 'medicine': 'Q', 'law': 'M', 'science': 'M', 'arts': 'R'}
SECT_LABEL = {'J': 'information & communication', 'M': 'professional, scientific & technical services', 'K': 'finance & insurance', 'Q': 'health & social work', 'R': 'arts & entertainment'}
def eurostat_block(cc):
    return {'kind': 'sector', 'year': 2022, 'unit': 'EUR', 'note': 'Mean gross yearly pay of tertiary-educated employees by sector (all ages, firms with 10+ staff). Under-30s earn on average ' + str(eu_young(cc)) + '% of the all-age average.',
            'values': {f: eu(cc, s) for f, s in SECT.items()}, 'sectorLabel': {f: SECT_LABEL[s] for f, s in SECT.items()}, 'youngPct': eu_young(cc),
            'source': src('Eurostat — Structure of Earnings Survey 2022 (earn_ses22_30, earn_ses22_27)', 'https://ec.europa.eu/eurostat/databrowser/view/earn_ses22_30/default/table')}

LEO = {  # gross yearly median, tax year 2022-23, by years after graduation (first degree / master's)
 'cs': ['Computer science', [[1, 30300], [3, 34300], [5, 39400], [10, 45300]], [[1, 39400], [3, 47400], [5, 52200], [10, 55800]]],
 'engineering': ['Mechanical engineering', [[1, 29900], [3, 34700], [5, 40900], [10, 51500]], [[1, 34300], [3, 39400], [5, 46000], [10, 58000]]],
 'finance': ['Economics', [[1, 29600], [3, 37600], [5, 50400], [10, 68600]], [[1, 36100], [3, 47800], [5, 55100], [10, 65000]]],
 'law': ['Law', [[1, 23000], [3, 27000], [5, 32100], [10, 40500]], [[1, 31400], [3, 42000], [5, 45300], [10, 48200]]],
 'medicine': ['Medicine', [[1, 40200], [3, 49300], [5, 52900], [10, 61300]], None],
 'science': ['Physics', [[1, 29600], [3, 35800], [5, 42000], [10, 48700]], [[1, 34700], [3, 42000], [5, 44900], [10, 46400]]],
 'arts': ['History', [[1, 23000], [3, 27000], [5, 31400], [10, 38000]], [[1, 25200], [3, 28100], [5, 32100], [10, 36900]]],
}
BLSMAP = {'cs': ['Software developers', 'Bachelor\'s degree'], 'engineering': ['Mechanical engineers', 'Bachelor\'s degree'], 'finance': ['Financial and investment analysts', 'Bachelor\'s degree'],
 'law': ['Lawyers', 'Doctoral or professional degree (JD)'], 'medicine': ['General internal medicine physicians', 'Doctoral or professional degree (MD) + residency'],
 'science': ['Chemists', 'Bachelor\'s degree'], 'arts': ['Graphic designers', 'Bachelor\'s degree']}
NLF = {'cs': 'Techniek', 'engineering': 'Techniek', 'finance': 'Economie', 'law': 'Recht', 'medicine': 'Gezondheidszorg', 'science': 'Natuur', 'arts': 'Taal en cultuur'}
IEF = {'cs': 'Information and Communication Technologies', 'engineering': 'Engineering, Manufacturing and Construction', 'finance': 'Business, Administration and Law', 'law': 'Business, Administration and Law',
 'medicine': 'Health and Welfare', 'science': 'Natural Sciences, Mathematics and Statistics', 'arts': 'Arts and Humanities'}

V = lambda verdict, text: {'verdict': verdict, 'text': text}
CAREERS = {
 'gb': {'currency': 'GBP', 'sym': '£', 'kind': 'years', 'unitLabel': 'median gross pay a year',
   'fields': {f: {'label': LEO[f][0], 'bachelor': LEO[f][1], 'master': LEO[f][2]} for f in LEO},
   'note': 'Median yearly earnings of graduates in sustained employment, tax year 2022-23, counted from graduation (for master\'s: from the master\'s). Graduates of English providers.',
   'sources': [src('DfE — LEO Graduate and Postgraduate Outcomes 2022-23', 'https://explore-education-statistics.service.gov.uk/find-statistics/leo-graduate-and-postgraduate-outcomes/2022-23'), src('DfE — Graduate labour market statistics 2024', 'https://explore-education-statistics.service.gov.uk/find-statistics/graduate-labour-markets/2024')],
   'facts': ['Working-age median pay in England (2024): graduates £42,000, postgraduates £47,000, non-graduates £30,500.'],
   'degree': {'cs': V('bachelor', 'A bachelor\'s is the normal entry route; a master\'s adds about £9,000 at the start.'), 'engineering': V('depends', 'A bachelor\'s gets you hired. Chartered Engineer status needs an accredited integrated MEng — or a BEng plus Master\'s-level learning.'),
     'finance': V('bachelor', 'A bachelor\'s is the norm; economics graduates see the steepest pay growth.'), 'law': V('regulated', 'Solicitors need a degree, the SQE exams and qualifying work experience; barristers take the Bar route.'),
     'medicine': V('regulated', 'Medicine is a 5–6-year primary medical degree followed by the Foundation Programme.'), 'science': V('depends', 'A bachelor\'s works for industry roles; research careers usually need a PhD.'), 'arts': V('bachelor', 'A bachelor\'s is the norm; a master\'s adds little on average.')},
   'degreeSources': [src('Engineering Council — Chartered Engineer', 'https://www.engc.org.uk/professional-registration/our-professional-titles/chartered-engineer-ceng')]},
 'us': {'currency': 'USD', 'sym': '$', 'kind': 'percentiles', 'unitLabel': 'yearly pay across all experience levels',
   'fields': {f: {'label': BLSMAP[f][0], 'education': BLSMAP[f][1], 'p': {k: int(bls[BLSMAP[f][0]][k]) for k in ['p10', 'p25', 'p50', 'p75', 'p90']}} for f in BLSMAP},
   'note': 'Pay of everyone in the occupation, May 2025. The 10th percentile is typical of new entrants, the 90th of the most senior or best paid — this is pay spread, not exact years.',
   'sources': [src('BLS — Occupational Employment and Wage Statistics, May 2025 (API)', 'https://www.bls.gov/oes/'), src('BLS — Occupational Outlook Handbook (typical entry-level education)', 'https://www.bls.gov/ooh/')],
   'facts': [],
   'degree': {'cs': V('bachelor', 'Software developers typically enter with a bachelor\'s degree.'), 'engineering': V('bachelor', 'Engineers typically enter with a bachelor\'s; licensure (PE) comes later with experience.'),
     'finance': V('bachelor', 'Financial analysts typically enter with a bachelor\'s.'), 'law': V('regulated', 'Lawyers need a JD (a 3-year professional doctorate after a bachelor\'s) and the bar exam.'),
     'medicine': V('regulated', 'Physicians need an MD/DO after a bachelor\'s, then a 3–7-year residency.'), 'science': V('depends', 'Chemists can start with a bachelor\'s; research roles mostly need a PhD.'), 'arts': V('bachelor', 'Graphic designers typically enter with a bachelor\'s.')},
   'degreeSources': [src('BLS — Occupational Outlook Handbook', 'https://www.bls.gov/ooh/')]},
 'nl': {'currency': 'EUR', 'sym': '€', 'kind': 'years', 'unitLabel': '≈ gross pay a year (from hourly wages at 38 h/week)',
   'fields': {f: {'label': NLF[f], 'bachelor': nl('wo-bachelor', NLF[f]) or None, 'master': nl('wo-master', NLF[f]) or None, 'applied': nl('hbo-bachelor', NLF[f]) or None} for f in NLF},
   'note': 'CBS hourly wages of graduates 1, 3, 5 and 10 years after leaving (different cohorts, latest available), converted at 38 hours a week. "Applied" = HBO bachelor\'s (universities of applied sciences).',
   'sources': [src('CBS — Uitstromers ho; uurloon na verlaten onderwijs (83815NED)', 'https://www.cbs.nl/nl-nl/cijfers/detail/83815NED')],
   'facts': ['More than 80% of research-university bachelor\'s graduates continue to a master\'s.'],
   'degree': {f: V('master', 'At research universities the master\'s is the normal end point (80%+ continue). An HBO bachelor\'s is a complete professional degree.') for f in NLF},
   'degreeSources': [src('CBS — study outcomes and master\'s transition', 'https://www.cbs.nl/nl-nl/longread/statistische-trends/2021/hoe-vergaat-het-studenten-in-het-leenstelsel-/3-resultaten')]},
 'ie': {'currency': 'EUR', 'sym': '€', 'kind': 'years', 'unitLabel': '≈ gross pay a year (median weekly × 52)',
   'fields': {f: {'label': IEF[f], 'bachelor': ie(IEF[f], '8'), 'master': ie(IEF[f], '9'), 'phd': ie(IEF[f], '10')} for f in IEF},
   'note': 'CSO median weekly earnings 1, 3, 5 and 10 years after graduation (latest cohorts: 2022, 2020, 2018, 2013), × 52. Bachelor = honours degree (NFQ 8), master = NFQ 9.',
   'sources': [src('CSO — Higher Education Outcomes 2013–2022 (HEO12)', 'https://www.cso.ie/en/releasesandpublications/ep/p-heo/highereducationoutcomes-graduationyears2013-2022/whatgraduatesearn/')],
   'facts': [],
   'degree': {'cs': V('bachelor', 'An honours bachelor\'s is standard; a master\'s adds roughly €85 a week at the start.'), 'engineering': V('depends', 'An honours bachelor\'s gets you hired; Chartered Engineer status needs master\'s-level education.'),
     'finance': V('bachelor', 'An honours bachelor\'s is standard.'), 'law': V('regulated', 'Solicitors and barristers take professional entrance exams and training after a degree.'),
     'medicine': V('regulated', 'Medicine is a 5–6-year degree followed by an internship year.'), 'science': V('depends', 'Bachelor\'s for industry; research needs a PhD.'), 'arts': V('bachelor', 'An honours bachelor\'s is standard.')}},
 'de': {'currency': 'EUR', 'sym': '€', 'kind': 'levels', 'unitLabel': 'gross pay a year',
   'levels': {'bachelor': 5183 * 12, 'master': 6850 * 12, 'phd': 9296 * 12},
   'levelsNote': 'Average gross monthly pay of full-time employees by highest degree, April 2024 (Destatis) × 12, without holiday/Christmas bonuses.',
   'fields': {'cs': {'label': 'IT', 'typical': 66750}, 'engineering': {'label': 'Engineering', 'typical': 75000}, 'finance': {'label': 'Finance & accounting', 'typical': 59250},
     'medicine': {'label': 'Medicine & dentistry', 'typical': 105500}, 'law': {'label': 'Law', 'typical': None}, 'science': {'label': 'Science', 'typical': None}, 'arts': {'label': 'Arts & humanities', 'typical': None}},
   'start': 46250, 'startNote': 'Median for people with under one year of experience, all fields (Stepstone 2026).',
   'note': 'Field figures: Stepstone salary report 2026 medians (1.3 million salaries, Jan 2022–Nov 2025), all experience levels.',
   'eurostat': eurostat_block('DE'),
   'sources': [src('Destatis — earnings by education, April 2024', 'https://www.destatis.de/DE/Presse/Pressemitteilungen/2025/03/PD25_117_62.html'), src('Stepstone Gehaltsreport 2026', 'https://www.stepstone.de/magazin/artikel/gehaltsvergleich')],
   'facts': ['2 in 3 university bachelor\'s graduates start a master\'s — 79% in maths & sciences; 31% at universities of applied sciences.'],
   'degree': {'cs': V('depends', 'A bachelor\'s gets you into IT; a master\'s is common and adds pay.'), 'engineering': V('master', 'Most university engineering graduates continue to a master\'s; it\'s what most employers expect from university engineers.'),
     'finance': V('depends', 'A bachelor\'s works; a master\'s is common for consulting and banking.'), 'law': V('regulated', 'Law ends with the state exams (Staatsexamen) and a 2-year traineeship — not a bachelor\'s.'),
     'medicine': V('regulated', 'Medicine is a 6-year state-exam degree followed by specialist training.'), 'science': V('master', '79% of maths & science bachelor\'s graduates continue; research needs a PhD.'), 'arts': V('depends', 'A master\'s is common for academic and cultural careers.')},
   'degreeSources': [src('Destatis — 2 in 3 bachelor\'s graduates start a master\'s', 'https://www.destatis.de/DE/Presse/Pressemitteilungen/2023/05/PD23_181_213.html')]},
 'fr': {'currency': 'EUR', 'sym': '€', 'kind': 'levels', 'unitLabel': 'gross pay a year',
   'levels': {'bachelor': 22000, 'master': 32000}, 'levelsNote': 'Apec medians: bac+3/4 graduates (promo 2019) €22,000; bac+5 graduates (promo 2021, measured 2023) €32,000.',
   'fields': {'cs': {'label': 'Engineering schools', 'start': 39129}, 'engineering': {'label': 'Engineering schools', 'start': 39129}, 'finance': {'label': 'Business schools', 'start': 41103},
     'medicine': {'label': 'Health', 'start': None}, 'law': {'label': 'Law', 'start': None}, 'science': {'label': 'Engineering schools', 'start': 39129}, 'arts': {'label': 'Arts & humanities', 'start': None}},
   'startNote': 'Average starting salary of grande école graduates working in France, without bonuses (CGE 2025).',
   'eurostat': eurostat_block('FR'),
   'sources': [src('Conférence des grandes écoles — insertion survey 2025', 'https://www.cge.asso.fr/wp-content/uploads/2025/06/CP-CGE-Enque%CC%82te-Insertion-2025.pdf'), src('Apec — young graduates', 'https://corporate.apec.fr/home/nos-etudes/toutes-nos-etudes/jeunes-diplome-es-d\'un-bac-5-une-insertion-plus-difficile-et-au-prix-de-concessions-importantes.html')],
   'facts': [],
   'degree': {'cs': V('master', 'Engineers and managers are usually hired at bac+5 (master\'s or engineering diploma).'), 'engineering': V('master', 'The engineering diploma (bac+5) is the standard.'), 'finance': V('master', 'Business-school master\'s (bac+5) is the usual entry level.'),
     'law': V('regulated', 'Lawyers need a master\'s, the CRFPA entrance exam and a law-school year.'), 'medicine': V('regulated', 'Medicine takes 9–12 years including specialisation.'), 'science': V('master', 'Bac+5 for industry; research needs a doctorate.'), 'arts': V('depends', 'A master\'s is common; pay varies widely.')}},
 'it': {'currency': 'EUR', 'sym': '€', 'kind': 'levels', 'unitLabel': 'gross pay a year',
   'levels': {'bachelor': 34640, 'master': 45877}, 'levelsNote': 'Average gross yearly pay (RAL) by degree, all ages — JobPricing University Report 2025/2026.',
   'netYears': {'bachelor': [[1, 1492], [3, 1664], [5, 1770]], 'master': [[1, 1488], [3, 1663], [5, 1847]]}, 'netNote': 'AlmaLaurea 2025: average net monthly pay 1, 3 and 5 years after graduating. Engineering and IT master\'s reach about €2,060–2,225 net a month at 5 years.',
   'fields': {f: {'label': f} for f in ['cs', 'engineering', 'finance', 'medicine', 'law', 'science', 'arts']},
   'eurostat': eurostat_block('IT'),
   'sources': [src('AlmaLaurea — Rapporto 2025', 'https://www.almalaurea.it/sites/default/files/comunicati/2025/cs_rapporto-almalaurea-2025.pdf'), src('JobPricing — University Report 2025/2026 (via press)', 'https://www.money.it/lauree-piu-pagate-2026-classifica-universita-piu-redditizie')],
   'facts': ['In the first years, bachelor\'s and master\'s graduates earn about the same; the master\'s pulls ahead later (AlmaLaurea).'],
   'degree': {'cs': V('depends', 'A laurea triennale gets you hired in IT; the magistrale pays more later.'), 'engineering': V('master', 'Full "Ingegnere" registration (Albo, section A) needs a laurea magistrale + state exam; the triennale gives "Ingegnere iunior".'),
     'finance': V('depends', 'Magistrale is common in finance and consulting.'), 'law': V('regulated', 'A 5-year single-cycle law degree, traineeship and the bar exam.'), 'medicine': V('regulated', 'A 6-year single-cycle degree, then specialisation.'), 'science': V('master', 'Magistrale for industry and research.'), 'arts': V('depends', 'Magistrale common; pay varies.')},
   'degreeSources': [src('Politecnico di Milano — professional outlets & Albo sections', 'https://www.mecheng.polimi.it/post-laurea/sbocchi-professionali/')]},
 'es': {'currency': 'EUR', 'sym': '€', 'kind': 'levels', 'unitLabel': 'gross pay a year',
   'levels': {'bachelor': None, 'master': round(26948.87 * 1.658)}, 'levelsNote': 'University graduates ("licenciados") earn 65.8% above the national mean of €26,949 (INE, 2022); half of male graduates earned over €45,000, half of female over €37,000.',
   'tenure': [[0, 18941], [2, 22041], [7, 26254], [15, 31047], [25, 36515]], 'tenureNote': 'Mean yearly pay by years with the same employer, all workers (INE 2022).',
   'fields': {f: {'label': f} for f in ['cs', 'engineering', 'finance', 'medicine', 'law', 'science', 'arts']},
   'eurostat': eurostat_block('ES'),
   'sources': [src('INE — Encuesta de Estructura Salarial 2022', 'https://www.ine.es/metodologia/t22/ees_prinre22.pdf')],
   'facts': [],
   'degree': {'cs': V('bachelor', 'A 4-year grado is enough for most IT jobs.'), 'engineering': V('depends', 'Grado works for many roles; regulated titles (e.g. Ingeniero Industrial) need a "máster habilitante".'),
     'finance': V('bachelor', 'A grado is the norm; a master\'s helps in finance.'), 'law': V('regulated', 'To practise: law degree + Máster de acceso + national exam.'), 'medicine': V('regulated', 'A 6-year degree, then the MIR exam and residency.'), 'science': V('depends', 'Grado for industry; research needs a doctorate.'), 'arts': V('bachelor', 'A grado is the norm.')},
   'degreeSources': [src('Ministerio de Justicia — access to the legal profession', 'https://www.mjusticia.gob.es/es/ciudadania/empleo-publico/acceso-profesion-abogados')]},
 'ch': {'currency': 'CHF', 'sym': 'CHF ', 'kind': 'levels', 'unitLabel': 'gross pay a year',
   'levels': {'master': 10533 * 12, 'applied': 9288 * 12}, 'levelsNote': 'Median gross monthly wage 2024 × 12 — university degree CHF 10,533, university of applied sciences CHF 9,288 (BFS wage structure survey).',
   'fields': {f: {'label': f} for f in ['cs', 'engineering', 'finance', 'medicine', 'law', 'science', 'arts']},
   'eurostat': eurostat_block('CH'),
   'sources': [src('BFS — Swiss Earnings Structure Survey 2024', 'https://www.bfs.admin.ch/asset/en/36195850')],
   'facts': ['86.6% of university bachelor\'s graduates start a master\'s (2023) — 97% in law, 94% in natural sciences.'],
   'degree': {f: V('master', 'At universities the master\'s is the standard degree; a UAS bachelor\'s is a professional qualification.') for f in ['cs', 'engineering', 'finance', 'science', 'arts']},
   'degreeSources': [src('BFS — bachelor-to-master transition', 'https://www.bfs.admin.ch/bfs/de/home/statistiken/kataloge-datenbanken/medienmitteilungen.assetdetail.18233.html')]},
 'se': {'currency': 'EUR', 'sym': '€', 'kind': 'sectorOnly', 'unitLabel': 'gross pay a year',
   'eurostat': eurostat_block('SE'), 'fields': {},
   'facts': ['SCB 2025: average monthly pay with 3+ years of post-secondary education — women SEK 47,600, men SEK 56,400; with research education SEK 62,600 / 68,100.'],
   'sources': [src('SCB — wages by education', 'https://www.scb.se/hitta-statistik/statistik-efter-amne/arbetsmarknad/loner-och-arbetskostnader/lonestrukturstatistik-hela-ekonomin/')],
   'degree': {'engineering': V('depends', 'Two routes: civilingenjör (5 years, master\'s level) or högskoleingenjör (3 years).'), 'law': V('regulated', 'Lawyers need the juristexamen (4.5 years).'), 'medicine': V('regulated', 'Doctors need the läkarexamen and a licence.')}},
 'dk': {'currency': 'EUR', 'sym': '€', 'kind': 'sectorOnly', 'unitLabel': 'gross pay a year', 'eurostat': eurostat_block('DK'), 'fields': {},
   'facts': ['IDA 2026: average starting salary DKK 42,800 a month for civilingeniører (master\'s) and DKK 41,300 for diplomingeniører, incl. pension.'],
   'sources': [src('IDA — engineering starting salaries', 'https://studerende.ida.dk/snart-nyuddannet/loen/')],
   'degree': {'engineering': V('depends', 'Civilingeniør (master\'s) and diplomingeniør (bachelor) both lead to engineering jobs.'), 'law': V('regulated', 'Lawyers need a master\'s in law and a traineeship.'), 'medicine': V('regulated', 'Medicine needs a master\'s and authorisation.')}},
 'fi': {'currency': 'EUR', 'sym': '€', 'kind': 'sectorOnly', 'unitLabel': 'gross pay a year', 'eurostat': eurostat_block('FI'), 'fields': {},
   'facts': ['TEK 2025: median pay of master\'s engineers (DI) €5,915 a month; 2025 graduates started at a median of €4,000.'],
   'sources': [src('TEK — labour market survey 2025', 'https://www.tek.fi/fi/tietoa-tekista/tutkimus/tek-tutkii-tyoelama-ja-tyosuhteet/tyomarkkinatutkimus-2025')],
   'degree': {f: V('master', 'University degrees are built as bachelor\'s + master\'s (e.g. Aalto\'s 3 + 2); the master\'s is the normal end point.') for f in ['cs', 'engineering', 'finance', 'science', 'arts']}},
 'be': {'currency': 'EUR', 'sym': '€', 'kind': 'sectorOnly', 'unitLabel': 'gross pay a year', 'eurostat': eurostat_block('BE'), 'fields': {},
   'facts': ['Statbel 2022: master\'s holders earn 46% above the national average (€4,076 gross a month), bachelor\'s holders 6% above.'],
   'sources': [src('Statbel — overview of Belgian wages', 'https://statbel.fgov.be/en/themes/work-training/wages-and-labourcost/overview-belgian-wages-and-salaries')],
   'degree': {f: V('master', 'University bachelor\'s usually continue to a master\'s; professional bachelor\'s (hogescholen) are job-ready.') for f in ['cs', 'engineering', 'finance', 'science', 'arts']}},
 'pt': {'currency': 'EUR', 'sym': '€', 'kind': 'sectorOnly', 'unitLabel': 'gross pay a year', 'eurostat': eurostat_block('PT'), 'fields': {}, 'facts': [], 'sources': [], 'degree': {}},
 'ua': {'currency': 'USD', 'sym': '$', 'kind': 'ladder', 'unitLabel': 'net pay a month (IT only)',
   'ladder': [['Junior', 900], ['Middle', 2450], ['All developers (median)', 3450], ['Senior back-end / mobile', 5000], ['Lead (Go)', 6510]],
   'note': 'DOU developer salary survey, December 2025 — after tax, US dollars a month. Only IT has a reliable public breakdown.',
   'fields': {}, 'sources': [src('DOU — developer salaries, winter 2026', 'https://dou.ua/lenta/articles/salary-report-devs-winter-2026/')], 'facts': [],
   'degree': {'cs': V('bachelor', 'In IT, skills and experience drive pay — the survey shows pay by level, not degree.'), 'medicine': V('regulated', 'Medicine is an integrated 6-year master\'s plus internship.'), 'law': V('regulated', 'Advocates need a law degree, experience and the qualification exam.')}},
}
for cc in ['ch', 'it', 'es']:
    for f in ['law', 'medicine']:
        CAREERS[cc]['degree'].setdefault(f, V('regulated', 'A specific professional degree plus licensing is required.'))
for cc in ['nl', 'fi', 'be', 'ch']:
    CAREERS[cc]['degree']['law'] = V('regulated', 'Practising law needs a master\'s in law plus professional training.')
    CAREERS[cc]['degree']['medicine'] = V('regulated', 'Medicine is a long regulated degree followed by registration and specialisation.')

import sys; sys.path.insert(0, S); import hooks_data
import courses_data
names = {}
for _cc in ['us']:
    _d = json.load(open(os.path.join(S, '..', '..', 'design', 'data', '%s.json' % _cc)))
    _arr = _d if isinstance(_d, list) else (_d.get('universities') or next(v for v in _d.values() if isinstance(v, list)))
    for _u in _arr: names[_cc + ':' + _u['id']] = _u['name']
for k in UNIS:
    if k.startswith('us:'): UNIS[k]['name'] = names.get(k, k)
HOOKS = hooks_data.build(UNIS)
ODDS = {k: o for k in UNIS if k.startswith('us:') for o in [hooks_data.us_odds(k, (UNIS[k].get('sources') or [None])[0])] if o}
for k in UNIS:
    if k.startswith('us:'): UNIS[k].pop('name', None)
data = {'updated': '2026-10-02', 'factors': FACTORS, 'countries': COUNTRIES, 'unis': UNIS, 'careers': CAREERS,
        'hooks': HOOKS, 'countryHooks': hooks_data.COUNTRY, 'odds': ODDS, 'offers': hooks_data.OFFERS}
data.update(courses_data.build())   # per-course offers, what changes by course per country, US school-vs-university admission
js = '/* UniVersity — "What gets you in" + "Degree → job → salary" (admitGuide.js).\n   Researched 1–2 Oct 2026 from official/primary sources listed with every entry.\n   US: each university\'s own Common Data Set (C7) + its current testing page.\n   Generated by a script from the source data — do not hand-edit numbers. */\nwindow.ADMIT_GUIDE = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(OUT, 'w').write(js)
print('wrote', OUT, len(js) // 1024, 'KB;', len(UNIS), 'universities;', len(COUNTRIES), 'countries;', len(CAREERS), 'career countries')
print('nl cs', CAREERS['nl']['fields']['cs']); print('ie cs', CAREERS['ie']['fields']['cs']); print('eu DE', CAREERS['de']['eurostat']['values'], CAREERS['de']['eurostat']['youngPct'])
