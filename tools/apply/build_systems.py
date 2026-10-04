# -*- coding: utf-8 -*-
"""Builds server/data/app_systems.json — the structured, sourced rules behind the
Apply page: application systems (UCAS, Common App, UC, Studielink, uni-assist,
Parcoursup, CAO, Sweden, Denmark, university portals), admissions tests, and
per-college Common App data (deadlines, fees, test policy, recommendations).

Every rule carries its official source and the date it was last checked. To
update: re-check the sources, edit below, run `python3 tools/apply/build_systems.py`.
US college rows come from Common App's "2026-27 First-year deadlines, fees and
requirements" grid (ReqGrid.pdf, updated 09-25-2026), parsed into us_grid.json.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'server', 'data', 'app_systems.json')
CHECKED = '2026-10-02'
def S(t, u, checked=CHECKED): return {'t': t, 'u': u, 'checked': checked}

SRC = {
    'ucas_dl': S('UCAS — 2027 entry deadline (13 January 2027, 18:00)', 'https://www.ucas.com/events/2027-entry-deadline-for-all-undergraduate-courses-except-those-with-a-15-october-deadline-475546'),
    'ucas_oct': S('University of Oxford — admissions tests & 15 October UCAS deadline (2027 entry)', 'https://www.ox.ac.uk/admissions/undergraduate/applying-to-oxford/guide/admissions-tests'),
    'ucas_fee': S('UCAS — application fee for the 2027 cycle', 'https://www.ucas.com/faqs/what-is-the-application-fee-for-the-2027-cycle'),
    'ucas_ps': S('Goldsmiths, University of London — the three UCAS personal statement questions', 'https://www.gold.ac.uk/ug/apply/advice/personal-statements/'),
    'imp_dl': S('Imperial College London — undergraduate application deadlines', 'https://www.imperial.ac.uk/study/apply/undergraduate/process/deadlines/'),
    'ca_prompts': S('Common App — 2026–2027 essay prompts', 'https://www.commonapp.org/blog/announcing-2026-2027-common-app-essay-prompts/'),
    'ca_prompts_page': S('Common App — essay prompts', 'https://www.commonapp.org/apply/essay-prompts/'),
    'ca_max': S('Common App — maximum number of colleges', 'https://membersupport.commonapp.org/membersupport/s/article/What-is-the-maximum-number-of-colleges-to-which-a-First-year-applicant-can-submit-a-Common-App'),
    'ca_grid': S('Common App — 2026-27 First-year deadlines, fees and requirements (updated 25 Sep 2026)', 'https://content.commonapp.org/Files/ReqGrid.pdf'),
    'uc_dates': S('University of California — dates & deadlines (fall 2027)', 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/dates-and-deadlines.html'),
    'uc_piq': S('University of California — personal insight questions', 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/personal-insight-questions.html'),
    'mit_dl': S('MIT Admissions — first-year deadlines & requirements', 'https://mitadmissions.org/apply/firstyear/deadlines-requirements/'),
    'mit_tests': S('MIT Admissions — tests & scores', 'https://mitadmissions.org/apply/firstyear/tests-scores/'),
    'sl_time': S('Studielink — make sure you are on time', 'https://info.studielink.nl/en/how-to-use-studielink/make-sure-you-are-on-time'),
    'nl_apply': S('Study in NL — how to apply', 'https://www.studyinnl.org/plan-your-stay/how-to-apply'),
    'uu_fixus': S('Utrecht University — numerus fixus (limited enrolment)', 'https://www.uu.nl/en/bachelors/general-information/how-to-apply/limited-enrolment'),
    'ua_home': S('uni-assist — applying with international certificates', 'https://www.uni-assist.de/en/'),
    'ps_home': S('Parcoursup (official platform)', 'https://www.parcoursup.gouv.fr/'),
    'ps_intl': S('French Ministry of Higher Education — international students and admission', 'https://www.enseignementsup-recherche.gouv.fr/fr/etudiants-etrangers-inscriptions-dans-l-enseignement-superieur-francais-46508'),
    'cao_hb': S('CAO — 2027 Handbook (instructions for completing a CAO application)', 'https://www2.cao.ie/handbook/handbook2027/hb.pdf'),
    'uhr_app': S('University Admissions in Sweden — admissions application', 'https://www.universityadmissions.se/en/support-centre/admissions-application/'),
    'su_dates': S('Stockholm University — important dates (autumn 2027 round)', 'https://www.su.se/english/education/how-to-apply/important-dates'),
    'dk_how': S('Study in Denmark — how to apply', 'https://studyindenmark.dk/study-options/how-to-apply'),
    'dk_ufs': S('Danish Agency for Higher Education — admission with foreign qualifications', 'https://ufsn.dk/english/education/recognition-and-transparency/recognition-guide/admission-he/'),
    'uat': S('University of Oxford — admissions tests (UAT-UK dates for 2027 entry)', 'https://www.ox.ac.uk/admissions/undergraduate/applying-to-oxford/guide/admissions-tests'),
    'imp_cs': S('Imperial — Computing BEng (TMUA windows Oct 2026 / Jan 2027)', 'https://www.imperial.ac.uk/study/courses/undergraduate/2027/computing-beng/'),
    'imp_med': S('Imperial — Medicine (UCAT sat July–September 2026)', 'https://www.imperial.ac.uk/study/courses/undergraduate/2027/medicine/'),
}

SYSTEMS = {
  'ucas': {
    'name': 'UCAS', 'full': 'Universities and Colleges Admissions Service', 'countries': ['gb'],
    'portal': 'https://www.ucas.com/apply', 'portalLabel': 'Open UCAS',
    'summary': 'One UCAS application covers up to 5 UK courses and one personal statement.',
    'limits': {'choices': 5}, 'fee': {'amount': 34.5, 'currency': 'GBP', 'per': 'application', 'note': 'One fee covers up to 5 choices (2027 entry)', 's': SRC['ucas_fee']},
    'rounds': [
      {'id': 'oct', 'label': '15 October', 'date': '2026-10-15', 'time': '18:00 UK time', 'for': 'Oxford, Cambridge and most medicine, dentistry and veterinary courses', 's': SRC['ucas_oct']},
      {'id': 'jan', 'label': 'Equal consideration', 'date': '2027-01-13', 'time': '18:00 UK time', 'for': 'All other undergraduate courses', 's': SRC['ucas_dl']}],
    'rules': [
      {'t': 'Up to 5 course choices on one application, one fee.', 's': SRC['ucas_fee']},
      {'t': 'One personal statement is sent to every university you choose, so it should fit all of them.', 's': SRC['ucas_ps']}],
    'writing': [{'kind': 'ucas_ps', 'scope': 'system', 'title': 'UCAS personal statement', 'shared': True,
      'parts': [{'q': 'Why do you want to study this course or subject?', 'min': 350},
                {'q': 'How have your qualifications and studies helped you to prepare for this course or subject?', 'min': 350},
                {'q': 'What else have you done to prepare outside of education, and why are these experiences useful?', 'min': 350}],
      'limit': {'chars': 4000}, 'note': '4,000 characters in total (including spaces) across the three answers; at least 350 characters each.', 's': SRC['ucas_ps']}],
    'items': [
      {'key': 'academic', 'group': 'academic', 'label': 'Qualifications and predicted grades entered', 'why': 'UCAS asks for every qualification and your predicted grades (your school adds predictions).', 's': SRC['ucas_ps']},
      {'key': 'reference', 'group': 'documents', 'label': 'Reference from a teacher or adviser', 'why': 'Every UCAS application includes one reference, added by your school or referee before you can send it.', 's': SRC['ucas_ps'], 'lead': 21},
      {'key': 'fee', 'group': 'submission', 'label': 'UCAS fee paid (£34.50)', 'why': 'Paid once when you submit; covers all your choices.', 's': SRC['ucas_fee']}],
    'submit': ['Enter each choice in UCAS Hub exactly as listed (course code, campus).', 'Paste your final personal statement.', 'Your referee attaches the reference; your school sends the application.', 'Pay the fee and submit — then record it here.'],
  },
  'commonapp': {
    'name': 'Common App', 'countries': ['us'], 'portal': 'https://apply.commonapp.org/', 'portalLabel': 'Open Common App',
    'summary': 'One application for up to 20 US colleges: one main essay plus each college’s own questions.',
    'limits': {'choices': 20},
    'rules': [{'t': 'Up to 20 colleges per application cycle.', 's': SRC['ca_max']},
              {'t': 'Deadlines, fees, test policy and recommendations are set by each college.', 's': SRC['ca_grid']}],
    'writing': [{'kind': 'commonapp_essay', 'scope': 'system', 'title': 'Common App personal essay', 'shared': True, 'limit': {'words': 650, 'minWords': 250},
      'prompts': ['Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.',
                  'The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?',
                  'Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?',
                  'Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?',
                  'Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.',
                  'Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?',
                  'Share an essay on any topic of your choice. It can be one you’ve already written, one that responds to a different prompt, or one of your own design.'],
      'note': 'Choose one of seven prompts; 250–650 words. Shared by every college you apply to.', 's': SRC['ca_prompts']},
      {'kind': 'supplement', 'scope': 'app', 'title': 'College-specific questions', 'note': 'Most selective colleges add their own short questions in the Common App; copy each prompt and its limit here.', 's': SRC['ca_grid']}],
    'items': [
      {'key': 'academic', 'group': 'academic', 'label': 'Courses & grades / school report', 'why': 'Your school counsellor sends the school report and transcript through Common App.', 's': SRC['ca_grid']},
      {'key': 'counselor', 'group': 'documents', 'label': 'Counselor recommendation + school report', 'why': 'Your school counselor sends a recommendation and the school report through Common App — this college asks for it.', 's': SRC['ca_grid'], 'lead': 21, 'byCollege': 'CR'},
      {'key': 'teacher_recs', 'group': 'documents', 'label': 'Teacher recommendations', 'why': 'Teachers submit these in Common App — ask them a few weeks before the deadline.', 's': SRC['ca_grid'], 'lead': 21, 'byCollege': 'TE'},
      {'key': 'fee', 'group': 'submission', 'label': 'Application fee or fee waiver', 'why': 'Each college charges its own fee; fee waivers are accepted by most.', 's': SRC['ca_grid']}],
    'submit': ['Add the college to My Colleges in Common App.', 'Answer the college questions and writing supplements.', 'Invite your counselor and teachers as recommenders.', 'Review, pay or use a fee waiver, submit — then record it here.'],
  },
  'ucapp': {
    'name': 'UC Application', 'full': 'University of California application', 'countries': ['us'], 'portal': 'https://apply.universityofcalifornia.edu/', 'portalLabel': 'Open the UC Application',
    'summary': 'One application for all nine UC campuses — no recommendations, four short essays.',
    'rounds': [{'id': 'fall', 'label': 'Fall 2027 filing period', 'date': '2026-11-30', 'time': '11:59 pm Pacific', 'for': 'Submit between 1 and 30 November 2026', 's': SRC['uc_dates']}],
    'rules': [{'t': 'Submission window for fall 2027 is 1–30 November 2026.', 's': SRC['uc_dates']}],
    'writing': [{'kind': 'uc_piq', 'scope': 'system', 'title': 'Personal insight questions', 'shared': True, 'parts': [{'q': 'Personal insight question 1', 'maxWords': 350}, {'q': 'Personal insight question 2', 'maxWords': 350}, {'q': 'Personal insight question 3', 'maxWords': 350}, {'q': 'Personal insight question 4', 'maxWords': 350}],
      'limit': {'wordsEach': 350}, 'note': 'Answer 4 of the 8 questions; 350 words maximum each.', 's': SRC['uc_piq']}],
    'items': [{'key': 'academic', 'group': 'academic', 'label': 'Self-reported courses and grades', 'why': 'You enter your own coursework and grades in the UC Application.', 's': SRC['uc_dates']},
              {'key': 'fee', 'group': 'submission', 'label': 'Application fee paid', 'why': 'Paid per campus when you submit (see the UC site for the current amount).', 's': SRC['uc_dates']}],
    'submit': ['Choose your campuses and majors.', 'Enter coursework, activities and the four answers.', 'Pay the per-campus fee and submit between 1 and 30 November — then record it here.'],
  },
  'studielink': {
    'name': 'Studielink', 'countries': ['nl'], 'portal': 'https://app.studielink.nl/', 'portalLabel': 'Open Studielink',
    'summary': 'The Dutch national enrolment system; the university then asks for documents in its own portal.',
    'limits': {'choices': 4, 'fixus': 2},
    'rounds': [{'id': 'fixus', 'label': 'Numerus fixus', 'date': '2027-01-15', 'for': 'Programmes with limited places (selection)', 's': SRC['sl_time']},
               {'id': 'nonEU', 'label': 'Non-EU/EEA applicants', 'date': '2027-04-01', 'for': 'Most bachelor’s for applicants who need a visa (check the programme)', 's': SRC['uu_fixus']},
               {'id': 'eu', 'label': 'EU/EEA applicants', 'date': '2027-05-01', 'for': 'National deadline for bachelor’s without numerus fixus', 's': SRC['sl_time']}],
    'rules': [{'t': 'Up to 4 active applications per year in Studielink, of which at most 2 numerus fixus programmes.', 's': SRC['uu_fixus']},
              {'t': 'Medicine (and dentistry, physiotherapy, dental hygiene) can be chosen at only one university.', 's': SRC['nl_apply']}],
    'writing': [{'kind': 'motivation', 'scope': 'app', 'title': 'Motivation letter', 'note': 'Asked by many programmes (and in most selection procedures); length is set by the programme.', 's': SRC['nl_apply']}],
    'items': [{'key': 'enrol', 'group': 'submission', 'label': 'Enrolment request in Studielink', 'why': 'Every bachelor’s application starts here.', 's': SRC['sl_time']},
              {'key': 'transcript', 'group': 'documents', 'label': 'Diploma / transcript uploaded to the university portal', 'why': 'After Studielink, the university asks for your documents in its own portal.', 's': SRC['nl_apply']}],
    'submit': ['Submit the enrolment request in Studielink.', 'Wait for the university’s e-mail and upload your documents in its portal.', 'For numerus fixus, complete the selection steps — then record it here.'],
  },
  'uniassist': {
    'name': 'uni-assist', 'countries': ['de'], 'portal': 'https://my.uni-assist.de/', 'portalLabel': 'Open uni-assist',
    'summary': 'Checks international certificates for many German universities before they decide.',
    'fee': {'amount': 75, 'currency': 'EUR', 'per': 'first application per semester', 'note': '€30 for each further university in the same semester', 's': S('Expatrio — uni-assist fees 2026 (€75 / €30)', 'https://www.expatrio.com/about-germany/uni-assist')},
    'rules': [{'t': 'Deadlines are set by each university and programme; processing takes several weeks, so submit well before.', 's': SRC['ua_home']}],
    'writing': [{'kind': 'motivation', 'scope': 'app', 'title': 'Motivation letter', 'note': 'Only if the programme asks for one (common in selection procedures).', 's': SRC['ua_home']}],
    'items': [{'key': 'transcript', 'group': 'documents', 'label': 'School-leaving certificate and transcript (with translations)', 'why': 'uni-assist checks that your certificate gives access to German higher education.', 's': SRC['ua_home']},
              {'key': 'fee', 'group': 'submission', 'label': 'uni-assist fee paid', 'why': '€75 for the first university, €30 for each further one, per semester.', 's': S('Expatrio — uni-assist fees 2026', 'https://www.expatrio.com/about-germany/uni-assist')}],
    'submit': ['Create the application in My Assist and upload your documents.', 'Pay the handling fee.', 'uni-assist forwards it to the university — then record it here.'],
  },
  'parcoursup': {
    'name': 'Parcoursup', 'countries': ['fr'], 'portal': 'https://dossier.parcoursup.fr/', 'portalLabel': 'Open Parcoursup',
    'summary': 'France’s national platform for first-year undergraduate places.',
    'limits': {'choices': 10},
    'rules': [{'t': 'Up to 10 wishes (vœux), each with its own motivation text.', 's': SRC['ps_home']},
              {'t': 'The official 2027 calendar is published in December; wishes are usually entered from mid-January to mid-March.', 's': SRC['ps_home']},
              {'t': 'Many non-EU applicants apply through the Études en France procedure instead.', 's': SRC['ps_intl']}],
    'writing': [{'kind': 'pfm', 'scope': 'app', 'title': 'Projet de formation motivé', 'limit': {'chars': 1500}, 'note': 'Up to 1,500 characters per wish.', 's': SRC['ps_home']}],
    'items': [{'key': 'academic', 'group': 'academic', 'label': 'Report cards (bulletins) and grades', 'why': 'Your school’s marks are attached to the file.', 's': SRC['ps_home']}],
    'submit': ['Register and enter your wishes in Parcoursup.', 'Write the motivation text for each wish.', 'Confirm every wish before the April deadline — then record it here.'],
  },
  'cao': {
    'name': 'CAO', 'full': 'Central Applications Office', 'countries': ['ie'], 'portal': 'https://www.cao.ie/', 'portalLabel': 'Open CAO',
    'summary': 'Ireland’s central system: list courses in order of preference; no personal statement.',
    'limits': {'choices': 10, 'note': '10 choices on each list (Level 8, and Level 7/6)'},
    'fee': {'amount': 50, 'currency': 'EUR', 'per': 'application', 'note': '€35 if you apply by 20 January 2027 (5pm)', 's': SRC['cao_hb']},
    'rounds': [{'id': 'disc', 'label': 'Discounted fee', 'date': '2027-01-20', 'time': '17:00', 'for': '€35 application', 's': SRC['cao_hb']},
               {'id': 'normal', 'label': 'Closing date', 'date': '2027-02-01', 'time': '17:00', 'for': 'Normal closing date (€50)', 's': SRC['cao_hb']}],
    'rules': [{'t': 'You can change your course order free of charge until 1 July (Change of Mind).', 's': SRC['cao_hb']},
              {'t': 'No personal statement — offers follow points and course requirements.', 's': SRC['cao_hb']}],
    'writing': [],
    'items': [{'key': 'academic', 'group': 'academic', 'label': 'Qualifications entered (EU/EFTA or other)', 'why': 'Points are calculated from your school-leaving results.', 's': SRC['cao_hb']},
              {'key': 'fee', 'group': 'submission', 'label': 'CAO fee paid', 'why': '€35 until 20 January, then €50 until 1 February.', 's': SRC['cao_hb']}],
    'submit': ['Register on cao.ie and pay.', 'List your courses in order of genuine preference.', 'Upload documents if CAO asks — then record it here.'],
  },
  'uhr': {
    'name': 'University Admissions in Sweden', 'countries': ['se'], 'portal': 'https://www.universityadmissions.se/', 'portalLabel': 'Open universityadmissions.se',
    'summary': 'One national application for Swedish programmes, ranked in order of preference.',
    'limits': {'choices': 8},
    'fee': {'amount': 900, 'currency': 'SEK', 'per': 'application', 'note': 'Covers up to 8 choices; EU/EEA citizens are exempt', 's': SRC['su_dates']},
    'rounds': [{'id': 'intl', 'label': 'International round, autumn 2027', 'date': '2027-01-15', 'for': 'Bachelor’s and master’s, first round', 's': SRC['su_dates']},
               {'id': 'docs', 'label': 'Documents and fee', 'date': '2027-02-01', 'for': 'Supporting documents and payment', 's': SRC['su_dates']}],
    'rules': [{'t': 'Rank up to 8 programmes in order of preference.', 's': SRC['su_dates']}],
    'writing': [],
    'items': [{'key': 'transcript', 'group': 'documents', 'label': 'Upper-secondary diploma and transcript', 'why': 'Needed to show general and specific entry requirements.', 's': SRC['uhr_app']},
              {'key': 'fee', 'group': 'submission', 'label': 'Application fee (SEK 900, non-EU)', 'why': 'Paid by 1 February; EU/EEA citizens don’t pay.', 's': SRC['su_dates']}],
    'submit': ['Apply and rank your programmes by 15 January.', 'Upload documents and pay by 1 February — then record it here.'],
  },
  'optagelse': {
    'name': 'Optagelse.dk', 'countries': ['dk'], 'portal': 'https://www.optagelse.dk/', 'portalLabel': 'Open optagelse.dk',
    'summary': 'Denmark’s national application for bachelor’s programmes.',
    'rounds': [{'id': 'q2', 'label': 'Quota 2 (and most international applicants)', 'date': '2027-03-15', 'time': '12:00 CET', 'for': 'Most programmes; applicants without a Danish qualification', 's': SRC['dk_how']},
               {'id': 'q1', 'label': 'Quota 1', 'date': '2027-07-05', 'time': '12:00 CET', 'for': 'Danish (and some equivalent) qualifications ranked by grade', 's': SRC['dk_how']}],
    'rules': [{'t': 'Some universities set an earlier deadline for non-EU applicants — check the programme page.', 's': SRC['dk_ufs']}],
    'writing': [{'kind': 'motivation', 'scope': 'app', 'title': 'Motivation / quota 2 material', 'note': 'Quota 2 applications are judged on criteria set by each programme.', 's': SRC['dk_how']}],
    'items': [{'key': 'transcript', 'group': 'documents', 'label': 'Diploma and transcript', 'why': 'Uploaded with the application.', 's': SRC['dk_how']}],
    'submit': ['Apply on optagelse.dk and sign with MitID or by signature page.', 'Upload documents — then record it here.'],
  },
  'mitapp': {
    'name': 'MIT Application', 'countries': ['us'], 'portal': 'https://apply.mitadmissions.org/', 'portalLabel': 'Open the MIT application',
    'summary': 'MIT uses its own application, not Common App.',
    'fee': {'amount': 75, 'currency': 'USD', 'per': 'application', 'note': 'Fee waivers available', 's': SRC['mit_dl']},
    'rounds': [{'id': 'ea', 'label': 'Early Action', 'date': '2026-11-01', 'for': 'Non-binding early round', 's': SRC['mit_dl']}],
    'rules': [{'t': 'SAT or ACT required.', 's': SRC['mit_tests']}],
    'writing': [{'kind': 'short', 'scope': 'app', 'title': 'MIT short-answer essays', 'note': 'Several short responses set by MIT each year — copy each prompt and limit here.', 's': SRC['mit_dl']}],
    'items': [{'key': 'academic', 'group': 'academic', 'label': 'Secondary school report and grades', 'why': 'Sent by your school.', 's': SRC['mit_dl']},
              {'key': 'teacher_recs', 'group': 'documents', 'label': 'Teacher evaluations', 'why': 'As listed on MIT’s first-year requirements page.', 's': SRC['mit_dl'], 'lead': 21},
              {'key': 'fee', 'group': 'submission', 'label': 'Application fee ($75) or waiver', 'why': 'Paid on submission.', 's': SRC['mit_dl']}],
    'submit': ['Complete the MIT application portal.', 'Ask teachers to send evaluations.', 'Pay or request a waiver and submit — then record it here.'],
  },
  'portal': {
    'name': 'University portal', 'countries': [], 'portal': None, 'portalLabel': 'Open the university’s application page',
    'summary': 'This university takes applications through its own online portal.',
    'rules': [{'t': 'Deadlines, documents and essays are set by the university — check its admissions page and keep the source here.', 's': None}],
    'writing': [{'kind': 'motivation', 'scope': 'app', 'title': 'Motivation letter / statement', 'note': 'If the programme asks for one, copy its prompt and length here.', 's': None}],
    'items': [{'key': 'transcript', 'group': 'documents', 'label': 'School transcript / diploma', 'why': 'Every university needs proof of your school results.', 's': None}],
    'submit': ['Create an account on the university’s portal.', 'Upload documents and the statement if asked.', 'Pay any fee and submit — then record it here.'],
  },
}

TESTS = {
  'TMUA': {'name': 'TMUA', 'full': 'Test of Mathematics for University Admission', 'by': 'UAT-UK (Pearson VUE)', 'url': 'https://www.uat-uk.ac.uk/',
           'sittings': [{'label': 'October 2026', 'bookBy': '2026-09-28', 'start': '2026-10-12', 'dates': '12–16 October 2026', 'results': '2026-11-16'},
                        {'label': 'January 2027', 'bookFrom': '2026-10-26', 'bookBy': '2026-12-21', 'start': '2027-01-04', 'dates': '4–8 January 2027', 'results': '2027-02-08', 'note': 'Not accepted by Oxford or Cambridge for October-deadline courses — check your university'}], 's': SRC['uat']},
  'ESAT': {'name': 'ESAT', 'full': 'Engineering and Science Admissions Test', 'by': 'UAT-UK (Pearson VUE)', 'url': 'https://www.uat-uk.ac.uk/',
           'sittings': [{'label': 'October 2026', 'bookBy': '2026-09-28', 'start': '2026-10-12', 'dates': '12–16 October 2026', 'results': '2026-11-16'},
                        {'label': 'January 2027', 'bookFrom': '2026-10-26', 'bookBy': '2026-12-21', 'start': '2027-01-04', 'dates': '4–8 January 2027', 'results': '2027-02-08', 'note': 'Only where the university accepts the January sitting'}], 's': SRC['uat']},
  'TARA': {'name': 'TARA', 'full': 'Test of Academic Reasoning for Admissions', 'by': 'UAT-UK (Pearson VUE)', 'url': 'https://www.uat-uk.ac.uk/',
           'sittings': [{'label': 'October 2026', 'bookBy': '2026-09-28', 'start': '2026-10-12', 'dates': '12–16 October 2026', 'results': '2026-11-16'}], 's': SRC['uat']},
  'UCAT': {'name': 'UCAT', 'full': 'University Clinical Aptitude Test', 'by': 'Pearson VUE', 'url': 'https://www.ucat.ac.uk/',
           'sittings': [{'label': '2026 testing', 'start': '2026-07-01', 'dates': 'July–September 2026', 'note': 'Must be taken in the year you apply'}], 's': SRC['imp_med']},
  'LNAT': {'name': 'LNAT', 'full': 'Law National Aptitude Test', 'by': 'Pearson VUE', 'url': 'https://lnat.ac.uk/', 'sittings': [], 's': SRC['uat']},
  'STEP': {'name': 'STEP', 'full': 'Sixth Term Examination Paper', 'by': 'OCR', 'url': 'https://www.ocr.org.uk/', 'sittings': [], 's': S('Cambridge — Mathematics (STEP in offers)', 'https://www.undergraduate.study.cam.ac.uk/courses/mathematics-ba-hons-mmath')},
  'SAT/ACT': {'name': 'SAT or ACT', 'full': 'SAT or ACT', 'by': 'College Board / ACT', 'url': 'https://satsuite.collegeboard.org/', 'sittings': [], 's': SRC['ca_grid']},
}

COUNTRY_DEFAULT = {'gb': 'ucas', 'us': 'commonapp', 'nl': 'studielink', 'de': 'uniassist', 'fr': 'parcoursup', 'ie': 'cao', 'se': 'uhr', 'dk': 'optagelse'}
UNI_SYSTEM = {'us:mit': 'mitapp', 'us:uc-berkeley': 'ucapp', 'us:ucla': 'ucapp', 'de:tum': 'portal', 'fr:sciencespo': 'portal', 'fr:polytec': 'portal', 'es:ie': 'portal', 'it:bocconi': 'portal', 'it:polimi': 'portal'}
# UCAS courses whose deadline is 15 October: every Oxford and Cambridge course, and medicine/dentistry/vet everywhere.
UCAS_OCT_UNIS = ['gb:oxford', 'gb:cambridge']
UCAS_OCT_COURSES = ['med']

# Common App per-college rows (deadlines as YYYY-MM-DD) from the 2026-27 grid.
grid = json.load(open(os.path.join(HERE, 'us_grid.json')))
def iso(d):
    if not d or '/' not in d: return None
    m, dd, y = d.split('/'); return '%s-%02d-%02d' % (y, int(m), int(dd))
COLLEGES = {}
for k, r in grid.items():
    rounds = []
    for col, label in [('ED', 'Early Decision'), ('EDII', 'Early Decision II'), ('EA', 'Early Action'), ('EAII', 'Early Action II'), ('REA', 'Restrictive Early Action'), ('RD', 'Regular Decision')]:
        dt = iso(r.get(col))
        if dt: rounds.append({'id': col.lower(), 'label': label, 'date': dt, 's': SRC['ca_grid']})
    fee = r.get('feeIntl') or r.get('feeUS')
    COLLEGES[k] = {'rounds': rounds, 'fee': {'amount': int(fee.strip('$')), 'currency': 'USD', 'note': 'International applicants; fee waivers accepted' if r.get('waiver') == 'Accepted' else 'International applicants', 's': SRC['ca_grid']} if fee and fee.startswith('$') else None,
                   'testPolicy': {'A': 'required', 'F': 'flexible', 'I': 'ignored', 'N': 'not required', 'S': 'sometimes required'}.get(r.get('testPolicy')),
                   'TE': int(r['TE']) if (r.get('TE') or '').isdigit() else 0, 'CR': r.get('CR') == 'Y', 'portfolio': r.get('portfolio') or None, 's': SRC['ca_grid']}
# Rice sits higher on its page than the parser reads; values copied from the same grid row.
COLLEGES['us:rice'] = {'rounds': [{'id': 'ed', 'label': 'Early Decision', 'date': '2026-11-01', 's': SRC['ca_grid']}, {'id': 'edii', 'label': 'Early Decision II', 'date': '2027-01-04', 's': SRC['ca_grid']}, {'id': 'rd', 'label': 'Regular Decision', 'date': '2027-01-04', 's': SRC['ca_grid']}],
                       'fee': {'amount': 75, 'currency': 'USD', 'note': 'International applicants; fee waivers accepted', 's': SRC['ca_grid']}, 'testPolicy': None, 'TE': 2, 'CR': True, 'portfolio': None, 's': SRC['ca_grid']}

data = {'_about': 'Application systems, admissions tests and Common App college rules for the Apply page. Every rule has its source and the date it was checked. Generated by tools/apply/build_systems.py.',
        'checked': CHECKED, 'systems': SYSTEMS, 'tests': TESTS, 'countryDefault': COUNTRY_DEFAULT, 'uniSystem': UNI_SYSTEM,
        'ucasOct': {'unis': UCAS_OCT_UNIS, 'courses': UCAS_OCT_COURSES}, 'colleges': COLLEGES}
json.dump(data, open(OUT, 'w'), ensure_ascii=False, indent=1)
print('wrote', OUT, len(SYSTEMS), 'systems,', len(TESTS), 'tests,', len(COLLEGES), 'colleges')
