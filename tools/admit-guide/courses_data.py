# -*- coding: utf-8 -*-
"""Per-course admission data for "What gets you in" (admitGuide.js).

Why: the grade, the subjects, the test and the competition all depend on the
COURSE, not just the university (Oxford asks AAA for History and A*A*A for
Engineering; History offers go to ~23% of applicants, Economics & Management to
~5%). So the guide asks what you're applying for and compares against that.

Researched 2 Oct 2026 for October 2027 entry, from each university's own course
pages (listed per course). Shapes:
  al / alLow       typical A-level offer / bottom of a published range
  ib / ibLow       IB total / bottom of a published range;  hl = HL profile
  ctx              contextual / widening-access offer {'al','ib'} (UK applicants)
  alReq, ibReq     [subject, grade or None] that must be in the offer;
                   a third item 'opt' = only "if your school offers it"
  test, iv         admissions test, interview
  stat             competition: {'ok': %success, 'iv': %interviewed, 'note'} or {'apps': applications per place, 'note'}
  fam              course family → the site's fields (cs, engineering, finance, medicine, law, science, arts)
"""


def S(t, u): return {'t': t, 'u': u}


FAM = {'cs': 'cs', 'maths': 'science', 'eng': 'engineering', 'econ': 'finance', 'mgmt': 'finance', 'ppe': 'finance', 'med': 'medicine', 'law': 'law',
       'phys': 'science', 'chem': 'science', 'bio': 'medicine', 'natsci': 'science', 'hist': 'arts', 'psych': 'science', 'ir': 'arts'}
ICON = {'cs': 'fa-laptop-code', 'maths': 'fa-square-root-variable', 'eng': 'fa-gears', 'econ': 'fa-chart-line', 'mgmt': 'fa-briefcase', 'ppe': 'fa-landmark',
        'med': 'fa-stethoscope', 'law': 'fa-scale-balanced', 'phys': 'fa-atom', 'chem': 'fa-flask', 'bio': 'fa-dna', 'natsci': 'fa-flask-vial',
        'hist': 'fa-scroll', 'psych': 'fa-brain', 'ir': 'fa-earth-europe'}


def C(id, name, **k):
    k.update({'id': id, 'name': name, 'fam': FAM[id], 'ic': ICON[id]})
    return k


OX = 'https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/'
OXN = '3-year average 2023–25'
CAM = 'https://www.undergraduate.study.cam.ac.uk/courses/'
CAMN = '2025 cycle'
IMP = 'https://www.imperial.ac.uk/study/courses/undergraduate/2027/'
UCL = 'https://www.ucl.ac.uk/prospective-students/undergraduate/degrees/'
KCL = 'https://www.kcl.ac.uk/study/undergraduate/courses/'
ED = 'https://study.ed.ac.uk/programmes/undergraduate/'
WAR = 'https://warwick.ac.uk/study/undergraduate/courses/'
MAN = 'https://www.manchester.ac.uk/study/undergraduate/courses/2027/'
STA = 'https://www.st-andrews.ac.uk/subjects/'
LSE = 'https://www.lse.ac.uk/study-at-lse/undergraduate/'

COURSES = {
    'gb:oxford': [
        C('cs', 'Computer Science', al='A*AA', ib=39, hl='766', alReq=[['Maths', 'A'], ['Further Maths', 'A', 'opt']], ibReq=[['Maths', 7]], test='TMUA', iv='If shortlisted', stat={'ok': 7, 'iv': 21, 'note': OXN}, s=S('Oxford — Computer Science', OX + 'computer-science')),
        C('maths', 'Mathematics', al='A*A*A', ib=39, hl='766', alReq=[['Maths', 'A*'], ['Further Maths', 'A*', 'opt']], ibReq=[['Maths', 7]], test='TMUA', iv='If shortlisted', stat={'ok': 9, 'iv': 32, 'note': OXN}, s=S('Oxford — Mathematics', OX + 'mathematics')),
        C('eng', 'Engineering Science', al='A*A*A', ib=40, hl='776', alReq=[['Maths', 'A'], ['Physics', 'A']], ibReq=[['Maths', 7], ['Physics', 7]], test='ESAT', iv='If shortlisted', stat={'ok': 15, 'iv': 37, 'note': OXN}, s=S('Oxford — Engineering Science', OX + 'engineering-science')),
        C('econ', 'Economics and Management', al='A*AA', ib=39, hl='766', alReq=[['Maths', 'A']], ibReq=[['Maths', 6]], test='TARA', iv='If shortlisted', stat={'ok': 5, 'iv': 18, 'note': OXN}, s=S('Oxford — Economics and Management', OX + 'economics-and-management')),
        C('ppe', 'Philosophy, Politics and Economics', al='AAA', ib=39, hl='766', alReq=[], ibReq=[], note='Maths recommended', test='TARA', iv='If shortlisted', stat={'ok': 12, 'iv': 38, 'note': OXN}, s=S('Oxford — PPE', OX + 'philosophy-politics-and-economics')),
        C('med', 'Medicine', al='A*AA', ib=39, hl='766', alReq=[['Chemistry', 'A'], ['Biology, Physics or Maths', 'A']], ibReq=[['Chemistry', None], ['Biology, Physics or Maths', None]], test='UCAT', iv='If shortlisted', stat={'ok': 11, 'iv': 29, 'note': OXN}, s=S('Oxford — Medicine', OX + 'medicine')),
        C('law', 'Law', al='AAA', ib=38, hl='666', alReq=[], ibReq=[], test='LNAT', iv='If shortlisted', stat={'ok': 10, 'iv': 31, 'note': OXN}, s=S('Oxford — Law', OX + 'law-jurisprudence')),
        C('phys', 'Physics', al='A*AA', ib=39, hl='766', alReq=[['Maths', 'A'], ['Physics', 'A']], ibReq=[['Maths', 6], ['Physics', 6]], note='The 7 at HL in Physics or Maths', test='ESAT', iv='If shortlisted', stat={'ok': 11, 'iv': 31, 'note': OXN}, s=S('Oxford — Physics', OX + 'physics')),
        C('chem', 'Chemistry', al='A*A*A', ib=40, hl='766', alReq=[['Chemistry', 'A'], ['Maths', 'A']], ibReq=[['Chemistry', 7], ['Maths', 6]], test=None, iv='If shortlisted', stat={'ok': 17, 'iv': 63, 'note': OXN}, s=S('Oxford — Chemistry', OX + 'chemistry')),
        C('bio', 'Biomedical Sciences', al='A*AA', ib=39, hl='766', alReq=[['Two of Biology, Chemistry, Physics, Maths', None]], ibReq=[['Two of Biology, Chemistry, Physics, Maths', None]], test='ESAT', iv='If shortlisted', stat={'ok': 8, 'iv': 24, 'note': OXN}, s=S('Oxford — Biomedical Sciences', OX + 'biomedical-sciences')),
        C('hist', 'History', al='AAA', ib=38, hl='666', alReq=[], ibReq=[], note='History highly recommended', test=None, iv='If shortlisted', stat={'ok': 23, 'iv': 74, 'note': OXN}, s=S('Oxford — History', OX + 'history')),
    ],
    'gb:cambridge': [
        C('cs', 'Computer Science', al='A*A*A', ib=42, ibLow=41, hl='776', alReq=[['Maths', None], ['Further Maths', None, 'opt']], ibReq=[['Maths', None]], test='TMUA', iv='Yes', stat={'apps': 14, 'note': CAMN}, s=S('Cambridge — Computer Science', CAM + 'computer-science-ba-hons-meng')),
        C('maths', 'Mathematics', al='A*A*A', ib=42, ibLow=41, hl='776', alReq=[['Maths', None], ['Further Maths', None]], ibReq=[['Maths', None]], note='Offers usually add STEP grades', test='TMUA + STEP', iv='Yes', stat={'apps': 8, 'note': CAMN}, s=S('Cambridge — Mathematics', CAM + 'mathematics-ba-hons-mmath')),
        C('eng', 'Engineering', al='A*A*A', ib=42, ibLow=41, hl='776', alReq=[['Maths', None], ['Physics', None], ['Further Maths', None, 'opt']], ibReq=[['Maths', None], ['Physics', None]], test='ESAT', iv='Yes', stat={'apps': 10, 'note': CAMN}, s=S('Cambridge — Engineering', CAM + 'engineering-ba-hons-meng')),
        C('econ', 'Economics', al='A*A*A', ib=42, ibLow=41, hl='776', alReq=[['Maths', None]], ibReq=[['Maths', None]], test='TMUA', iv='Yes', stat={'apps': 10, 'note': CAMN}, s=S('Cambridge — Economics', CAM + 'economics-ba-hons')),
        C('med', 'Medicine', al='A*A*A', ib=42, ibLow=41, hl='776', alReq=[['Chemistry', None], ['1–2 of Biology, Physics, Maths', None]], ibReq=[['Chemistry', None], ['1–2 of Biology, Physics, Maths', None]], test='UCAT', iv='Yes', stat={'apps': 6, 'note': CAMN}, s=S('Cambridge — Medicine', CAM + 'medicine-mb-bchir')),
        C('law', 'Law', al='A*AA', ib=42, ibLow=41, hl='776', alReq=[], ibReq=[], test='LNAT', iv='Yes', stat={'apps': 7, 'note': CAMN}, s=S('Cambridge — Law', CAM + 'law-ba-hons')),
        C('natsci', 'Natural Sciences', al='A*A*A', ib=42, ibLow=41, hl='776', alReq=[['Maths', None], ['Two more sciences', None]], ibReq=[['Maths', None], ['Two more sciences', None]], test='ESAT', iv='Yes', stat={'apps': 5, 'note': CAMN}, s=S('Cambridge — Natural Sciences', CAM + 'natural-sciences-ba-hons-msci')),
        C('psych', 'Psychological & Behavioural Sciences', al='A*A*A', ib=42, ibLow=41, hl='776', alReq=[['One of Maths, Biology, Chemistry, CS, Physics', None]], ibReq=[['One of Maths, Biology, Chemistry, CS, Physics', None]], test='At some Colleges', iv='Yes', stat={'apps': 8, 'note': CAMN}, s=S('Cambridge — Psychological and Behavioural Sciences', CAM + 'psychological-behavioural-sciences-ba-hons')),
        C('hist', 'History', al='A*AA', ib=42, ibLow=41, hl='776', alReq=[['History', None]], ibReq=[['History', None]], note='2 pieces of written work', test='At some Colleges', iv='Yes', stat={'apps': 4, 'note': CAMN}, s=S('Cambridge — History', CAM + 'history-ba-hons')),
    ],
    'gb:imperial': [
        C('cs', 'Computing', al='A*A*A', ib=42, alReq=[['Maths', 'A*'], ['Further Maths', None, 'opt']], ibReq=[['Maths', 7], ['Another relevant subject', 7]], test='TMUA', iv='Not standard', stat={'apps': 13, 'note': '2025'}, s=S('Imperial — Computing BEng (2027)', IMP + 'computing-beng/')),
        C('maths', 'Mathematics', al='A*A*A', ib=40, alReq=[['Maths', 'A*'], ['Further Maths', 'A*']], ibReq=[['Maths', 7]], test='TMUA', iv='Not routinely', stat={'apps': 14, 'note': '2025'}, s=S('Imperial — Mathematics BSc (2027)', IMP + 'mathematics-bsc/')),
        C('eng', 'Electrical & Electronic Engineering', al='A*A*A', ib=41, alReq=[['Maths', 'A*'], ['Physics', 'A*']], ibReq=[['Maths', 7], ['Physics', 7]], test='ESAT', iv='Some applicants', stat={'apps': 8, 'note': '2025'}, s=S('Imperial — EEE MEng (2027)', IMP + 'electrical-electronic-engineering-meng/')),
        C('econ', 'Economics, Finance & Data Science', al='A*A*A', alLow='A*AA', ib=39, alReq=[['Maths', 'A*']], ibReq=[['Maths', 7]], test='TMUA', iv='Yes', stat={'apps': 13, 'note': '2025'}, s=S('Imperial — Economics, Finance and Data Science (2027)', IMP + 'economics-finance-data-science/')),
        C('med', 'Medicine', al='A*AA', ib=39, alReq=[['Biology', 'A'], ['Chemistry', 'A']], ibReq=[['Biology', 6], ['Chemistry', 6]], note='The A* (or HL 7) in Biology or Chemistry', test='UCAT', iv='MMI, top ~1/3', stat={'apps': 6, 'note': '2025'}, s=S('Imperial — Medicine (2027)', IMP + 'medicine/')),
        C('phys', 'Physics', al='A*A*A', ib=42, alReq=[['Maths', 'A*'], ['Physics', 'A*']], ibReq=[['Maths', 7], ['Physics', 7]], test='ESAT', iv='Not usually', stat={'apps': 7, 'note': '2025'}, s=S('Imperial — Physics BSc (2027)', IMP + 'physics-bsc/')),
        C('chem', 'Chemistry', al='A*AA', ib=40, ibLow=39, alReq=[['Chemistry', 'A'], ['Maths', 'A']], ibReq=[['Chemistry', 6], ['Maths', 6]], test=None, iv='Yes', stat={'apps': 8, 'note': '2025'}, s=S('Imperial — Chemistry BSc (2027)', IMP + 'chemistry-bsc/')),
    ],
    'gb:ucl': [
        C('cs', 'Computer Science', al='A*A*A', ib=40, ctx={'al': 'A*AB', 'ib': 38}, alReq=[['Maths or Further Maths', 'A*']], ibReq=[['Maths', 7]], test='STAT (UCL\'s own)', iv=None, s=S('UCL — Computer Science BSc', UCL + 'computer-science-bsc')),
        C('maths', 'Mathematics', al='A*A*A', ib=40, alReq=[['Maths', 'A*'], ['Further Maths', 'A*']], ibReq=[['Maths', 7]], note='Or A*AA plus a STEP 2', test=None, iv=None, s=S('UCL — Mathematics BSc', 'https://www.ucl.ac.uk/prospective-students/undergraduate/degrees/mathematics-bsc-2025')),
        C('econ', 'Economics', al='A*AA', ib=39, alReq=[['Maths', 'A*']], ibReq=[['Maths', 7]], test='TMUA', iv=None, s=S('UCL — Economics BSc (Econ)', UCL + 'economics-bsc-econ')),
        C('med', 'Medicine', al='A*AA', ib=39, alReq=[['Chemistry', 'A'], ['Biology', 'A']], ibReq=[['Chemistry', 6], ['Biology', 6]], note='A*A across Chemistry and Biology', test='UCAT', iv='Yes', s=S('UCL — MBBS entry requirements 2027', 'https://www.ucl.ac.uk/medical-sciences/divisions/medical-school/study/undergraduate/mbbs-admissions/entry-requirements/2027-entry')),
        C('law', 'Law', al='A*AA', ib=39, alReq=[], ibReq=[], test='LNAT', iv=None, s=S('UCL — Law LLB applying', 'https://www.ucl.ac.uk/laws/study/bachelor-laws-llb/applying-and-entry-requirements')),
        C('phys', 'Physics', al='A*AA', ib=39, alReq=[['Maths', 'A'], ['Physics', 'A']], ibReq=[['Maths', 6], ['Physics', 6]], note='A*A across Maths and Physics', test=None, iv=None, s=S('UCL — Physics BSc', 'https://www.ucl.ac.uk/prospective-students/undergraduate/degrees/physics-bsc-2026')),
        C('eng', 'Mechanical Engineering', al='A*AA', ib=39, alReq=[['Maths', 'A'], ['Physics', 'A']], ibReq=[['Maths', 6], ['Physics', 6]], note='The A* in Maths or Physics', test=None, iv=None, s=S('UCL — Mechanical Engineering MEng', UCL + 'mechanical-engineering-meng')),
        C('hist', 'History', al='AAA', ib=38, ctx={'al': 'ABB'}, alReq=[['History', 'A']], ibReq=[['History', 6]], test=None, iv=None, s=S('UCL — History BA', 'https://www.ucl.ac.uk/study/prospective-students/undergraduate/courses/history-ba')),
    ],
    'gb:lse': [
        C('econ', 'Economics', al='A*AA', ib=39, hl='766', alReq=[['Maths', None]], ibReq=[['Maths', None]], test='TMUA', iv=None, s=S('LSE — BSc Economics', LSE + 'bsc-economics')),
        C('law', 'Laws (LLB)', al='A*AA', ib=39, hl='766', alReq=[], ibReq=[], test='LNAT', iv=None, s=S('LSE — LLB Bachelor of Laws', LSE + 'llb-bachelor-of-laws')),
        C('mgmt', 'Management', al='AAA', alReq=[['Maths', 'A']], ibReq=[], test=None, iv=None, s=S('LSE — BSc Management', LSE + 'bsc-management')),
        C('ppe', 'Philosophy, Politics and Economics', al='A*AA', alReq=[['Maths', 'A*']], ibReq=[], test=None, iv=None, s=S('LSE — BSc PPE', LSE + 'bsc-philosophy-politics-and-economics')),
    ],
    'gb:kcl': [
        C('cs', 'Computer Science', al='A*A*A', ib=39, ctx={'al': 'AAA', 'ib': 36}, alReq=[], ibReq=[], test=None, iv=None, s=S('King\'s — Computer Science entry requirements', KCL + 'computer-science-bsc/requirements')),
        C('maths', 'Mathematics', al='A*AA', ib=38, alReq=[['Maths', 'A'], ['Further Maths', 'A']], ibReq=[['Maths', 6]], note='The A* in Maths or Further Maths', test=None, iv=None, s=S('King\'s — Mathematics BSc', KCL + 'mathematics-bsc/entry-requirements')),
        C('econ', 'Economics', al='A*AA', ib=38, alReq=[['Maths', 'A']], ibReq=[['Maths', 6]], test=None, iv=None, s=S('King\'s — Economics BSc', KCL + 'economics-bsc/entry-requirements')),
        C('law', 'Law', al='A*AA', ib=38, alReq=[], ibReq=[], test='LNAT', iv=None, s=S('King\'s — Law LLB', KCL + 'law-llb/entry-requirements')),
        C('med', 'Medicine', al='A*AA', alReq=[['Chemistry', 'A'], ['Biology', 'A']], ibReq=[], test='UCAT', iv='Yes', s=S('King\'s — Medicine MBBS', KCL + 'medicine-mbbs/entry-requirements')),
        C('phys', 'Physics', al='AAA', alReq=[['Maths', 'A'], ['Physics', 'A']], ibReq=[], test=None, iv=None, s=S('King\'s — Physics BSc', KCL + 'physics-bsc/entry-requirements')),
        C('hist', 'History', al='AAA', alReq=[], ibReq=[], test=None, iv=None, s=S('King\'s — History BA', KCL + 'history-ba/requirements')),
    ],
    'gb:edinburgh': [
        C('cs', 'Computer Science', al='A*A*A*', alLow='AAB', ib=43, ibLow=34, ctx={'al': 'ABB', 'ib': 32}, alReq=[['Maths', 'A']], ibReq=[['Maths', 6]], test=None, iv=None, s=S('Edinburgh — Computer Science entry requirements', ED + '57-computer-science/entry-requirements')),
        C('econ', 'Economics', al='A*A*A*', alLow='A*AA', ib=40, ibLow=37, ctx={'al': 'ABB', 'ib': 34}, alReq=[['Maths', 'B']], ibReq=[['Maths', 5]], test=None, iv=None, s=S('Edinburgh — Economics MA entry requirements', ED + '122-economics/entry-requirements')),
        C('law', 'Law', al='A*A*A', alLow='A*AA', ib=40, ibLow=37, ctx={'al': 'ABB', 'ib': 34}, alReq=[['English', 'B']], ibReq=[['English', 5]], test=None, iv=None, s=S('Edinburgh — Law LLB entry requirements', ED + '168-law-ordinary-and-honours/entry-requirements')),
        C('med', 'Medicine', al='AAA', ib=38, hl='666', ctx={'al': 'AAB', 'ib': 34}, alReq=[['Chemistry', None], ['Biology, Maths or Physics', None]], ibReq=[['Chemistry', None], ['Biology, Maths or Physics', None]], note='In one sitting; minimum UCAT score', test='UCAT', iv='Yes', s=S('Edinburgh — MBChB entry requirements', ED + '354-mbchb-medicine-6-year-programme/entry-requirements')),
        C('phys', 'Physics', al='AAA', alLow='ABB', ib=37, ibLow=32, ctx={'al': 'ABB', 'ib': 32}, alReq=[['Maths', 'A'], ['Physics', 'B']], ibReq=[['Maths', 6], ['Physics', 5]], test=None, iv=None, s=S('Edinburgh — Physics BSc entry requirements', ED + '33-physics/entry-requirements')),
        C('eng', 'Engineering', al='AAA', alLow='ABB', ib=37, ibLow=34, ctx={'al': 'ABB', 'ib': 32}, alReq=[['Maths', 'B'], ['Physics or another science', 'B']], ibReq=[['Maths', 5], ['Physics or another science', 5]], test=None, iv=None, s=S('Edinburgh — Engineering entry requirements', ED + '75-engineering/entry-requirements')),
    ],
    'gb:warwick': [
        C('cs', 'Computer Science', al='A*A*A', ib=39, alReq=[], ibReq=[], test='TMUA', iv=None, s=S('UCAS — Warwick Computer Science', 'https://www.ucas.com/explore/courses/96187c1d-ee68-4b33-3c0e-b040a93861f8/computer-science')),
        C('maths', 'Mathematics', al='A*A*A', ib=39, hl='666', alReq=[['Maths', 'A*'], ['Further Maths', 'A*']], ibReq=[['Maths', 6]], test='TMUA or STEP', iv=None, s=S('Warwick Maths — our offer', 'https://warwick.ac.uk/fac/sci/maths/studywithus/ug/our-offer/')),
        C('econ', 'Economics', al='A*AA', ib=38, alReq=[['Maths', 'A']], ibReq=[['Maths', 6]], note='Top TMUA scores can get AAA', test='TMUA (encouraged)', iv=None, s=S('Warwick — Economics BSc', WAR + 'bsc-economics/')),
        C('law', 'Law', al='A*AA', ib=38, ctx={'ib': 34}, alReq=[], ibReq=[], test=None, iv=None, s=S('Warwick — Law LLB', WAR + 'llb-law/')),
        C('ppe', 'Philosophy, Politics and Economics', al='A*AA', ib=38, alReq=[], ibReq=[], note='IB: SL Maths 5', test=None, iv=None, s=S('Warwick PPE — entry requirements', 'https://warwick.ac.uk/fac/soc/philosophy/ppe/ugstudy/entry-requirements/')),
        C('phys', 'Physics', al='A*AA', ib=38, alReq=[['Maths', 'A'], ['Physics', 'A']], ibReq=[['Maths', 6], ['Physics', 6]], test=None, iv=None, s=S('Warwick — Physics BSc', WAR + 'bsc-physics/')),
        C('eng', 'Engineering', al='A*AA', ib=38, hl='666', alReq=[['Maths', None], ['Physics', None]], ibReq=[['Maths', 6], ['Physics', 6]], test=None, iv=None, s=S('Warwick — Engineering MEng', WAR + 'meng-engineering/')),
        C('hist', 'History', al='AAA', ib=36, alReq=[['History', None]], ibReq=[['History', 6]], test=None, iv=None, s=S('Warwick — History BA', WAR + 'ba-history/')),
    ],
    'gb:manchester': [
        C('cs', 'Computer Science', al='A*AA', ib=37, alReq=[], ibReq=[], test=None, iv=None, s=S('Manchester — BSc Computer Science (2027)', MAN + '00560/bsc-computer-science/')),
        C('maths', 'Mathematics', al='A*AA', ib=37, hl='766', alReq=[['Maths or Further Maths', 'A*']], ibReq=[['Maths', 7]], test=None, iv=None, s=S('Manchester — BSc Mathematics (2027)', MAN + '00590/bsc-mathematics/')),
        C('econ', 'Economics', al='AAA', ib=36, hl='666', alReq=[['Maths', None]], ibReq=[['Maths', 6]], test=None, iv=None, s=S('Manchester — BSc Economics (2027)', MAN + '10224/bsc-economics/entry-requirements/')),
        C('law', 'Law', al='A*AA', ib=37, hl='766', alReq=[], ibReq=[], test=None, iv=None, s=S('Manchester — LLB Law (2027)', MAN + '12446/llb-law/')),
        C('med', 'Medicine', al='AAA', ib=36, hl='666', alReq=[['Biology or Chemistry', None], ['One more science, Maths or Psychology', None]], ibReq=[], test='UCAT', iv='Yes', s=S('Manchester — MBChB Medicine (2027)', MAN + '01428/mbchb-medicine/')),
        C('phys', 'Physics', al='A*A*A', ib=38, hl='776', ctx={'al': 'A*AA'}, alReq=[['Physics', 'A*'], ['Maths or Further Maths', 'A*']], ibReq=[['Physics', 7], ['Maths', 7]], test=None, iv=None, s=S('Manchester — BSc Physics (2027)', MAN + '00638/bsc-physics/')),
        C('eng', 'Mechanical Engineering', al='A*A*A', ib=38, hl='776', ctx={'al': 'A*AA'}, alReq=[['Maths', None], ['Physics', None]], ibReq=[['Maths', None], ['Physics', None]], test=None, iv=None, s=S('Manchester — MEng Mechanical Engineering (2027)', MAN + '03921/meng-mechanical-engineering/')),
        C('hist', 'History', al='AAA', ib=36, hl='666', ctx={'al': 'ABB'}, alReq=[['History', 'A']], ibReq=[['History', None]], test=None, iv=None, s=S('Manchester — BA History (2027)', MAN + '00255/ba-history/')),
    ],
    'gb:st-andrews': [
        C('cs', 'Computer Science', al='AAA', ib=38, ctx={'ib': 36}, alReq=[], ibReq=[], test=None, iv=None, s=S('St Andrews — Computer Science BSc', STA + 'computer-science/computer-science-bsc/')),
        C('maths', 'Mathematics', al='A*A*A', ib=38, hl='666', ctx={'al': 'A*AB', 'ib': 36}, alReq=[['Maths', 'A*']], ibReq=[['Maths', 6]], test=None, iv=None, s=S('St Andrews — Mathematics BSc', STA + 'mathematics/mathematics-bsc/')),
        C('econ', 'Economics', al='AAA', ib=38, hl='666', ctx={'al': 'ABB', 'ib': 36}, alReq=[], ibReq=[], test=None, iv=None, s=S('St Andrews — Economics BSc', STA + 'economics/economics-bsc/')),
        C('phys', 'Physics', al='AAA', ib=38, hl='666', ctx={'al': 'AAB', 'ib': 36}, alReq=[['Maths', 'A'], ['Physics', 'A']], ibReq=[['Maths', 6], ['Physics', 6]], test=None, iv=None, s=S('St Andrews — Physics MPhys', STA + 'physics/physics-mphys/')),
        C('med', 'Medicine', al='AAA', ib=38, hl='666', ctx={'al': 'AAB', 'ib': 36}, alReq=[['Chemistry', None], ['Biology, Maths or Physics', None]], ibReq=[['Chemistry', None], ['Biology, Maths or Physics', None]], test='UCAT', iv='Yes', s=S('St Andrews — Medicine, UK qualifications', STA + 'medicine/entry-requirements/academic-requirements/uk-qualifications/')),
        C('ir', 'International Relations', al='AAA', ib=38, hl='666', ctx={'al': 'ABB', 'ib': 36}, alReq=[], ibReq=[], test=None, iv=None, s=S('St Andrews — International Relations MA', STA + 'international-relations/international-relations-ma/')),
        C('hist', 'Medieval History', al='AAA', ib=38, hl='666', ctx={'al': 'ABB', 'ib': 36}, alReq=[['History', 'A']], ibReq=[['History', 6]], test=None, iv=None, s=S('St Andrews — Medieval History MA', STA + 'history/medieval-history-ma/')),
    ],
}

# What changes with the course, by country — shown for every university in that
# country (and above the course list where we have one).
RULES = {
    'gb': {'by': 'course', 'pts': [
        'Every course sets its own offer, required subjects and test — the same university can ask AAA for History and A*A*A for Engineering.',
        'The test follows the course: TMUA (maths, CS, economics), ESAT (engineering, physical sciences), TARA (PPE, E&M, psychology at Oxford), UCAT (medicine), LNAT (law).',
        'Competition differs by course too: at Oxford about 5% of Economics & Management applicants get a place, against about 23% for History.'],
        's': [S('Oxford — admissions tests 2027 entry', 'https://www.ox.ac.uk/admissions/undergraduate/applying-to-oxford/guide/admissions-tests'), S('Oxford — course listing', 'https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing')]},
    'us': {'by': 'school', 'pts': [
        'At many universities you apply to ONE undergraduate school or college (e.g. Cornell, Penn, Columbia, Duke, Northwestern, CMU), each with its own selectivity. Elsewhere you are admitted to the university and pick a major later.',
        'Engineering and computer science are often the hardest door: UCLA admitted 4.1% of its 10,529 Computer Science applicants for fall 2024.',
        'Medicine and law are graduate degrees in the US — you apply after a bachelor\'s.'],
        's': [S('UCLA — fall 2024 admissions by major', 'https://admission.ucla.edu/apply/first-year/first-year-profile/2024/major'), S('Duke — apply (Trinity or Pratt)', 'https://admissions.duke.edu/apply/')]},
    'de': {'by': 'programme', 'pts': [
        'Each programme is either open (zulassungsfrei) or restricted (NC); restricted ones rank you by grade average, with their own cut-off at each university.',
        'Medicine, dentistry, pharmacy and veterinary medicine are allocated centrally through hochschulstart.de; tests such as the TMS can raise your rank.',
        'Some universities (e.g. TUM) add an aptitude assessment per programme — points for subject grades, a letter or an interview.'],
        's': [S('hochschulstart.de', 'https://www.hochschulstart.de/'), S('uni-assist — Numerus clausus', 'https://www.uni-assist.de/en/tools/glossary-of-terms/description/term/numerus-clausus-nc/')]},
    'nl': {'by': 'programme', 'pts': [
        'Most bachelor\'s admit everyone with a recognised diploma and the required subjects (often maths at a set level).',
        'Numerus fixus programmes (medicine, some psychology, IBA, TU Delft aerospace…) run their own selection with a 15 January deadline: at most 2 of them per year, and medicine at only one university.'],
        's': [S('Study in NL — how to apply', 'https://studyinnl.org/plan-your-stay/how-to-apply'), S('EUR — programmes with limited places', 'https://www.eur.nl/en/education/practical-matters/admission/programmes-limited-places-numerus-fixus')]},
    'it': {'by': 'programme', 'pts': [
        'Each degree has its own entry rule: open access, a local limited number with a test (TOLC-I for engineering, TOLC-E for economics), or the university\'s own test (Bocconi, Polimi).',
        'English-taught medicine at public universities requires the national IMAT (2026 sitting: 29 September).'],
        's': [S('CISIA — TOLC tests', 'https://www.cisiaonline.it/'), S('IMAT 2026 — University of Messina info page', 'https://international.unime.it/study-us/english-taught-programmes/imat-test-info-page')]},
    'fr': {'by': 'programme', 'pts': [
        'On Parcoursup every formation sets its own criteria: selective tracks (CPGE, BUT, double licences, Sciences Po) compare files; most licences are non-selective but can rank when full.',
        'Medicine is reached through PASS or L.AS, with a competitive first year.'],
        's': [S('Parcoursup', 'https://www.parcoursup.gouv.fr/')]},
    'es': {'by': 'programme', 'pts': [
        'Each degree (grado) has its own cut-off mark (nota de corte) and weights different PAU subjects for it.',
        'International applicants usually get a comparable mark through UNEDasiss, including the subject-specific part.'],
        's': [S('UNEDasiss', 'https://unedasiss.uned.es/')]},
    'ch': {'by': 'uni', 'pts': [
        'ETH and EPFL admit holders of a recognised diploma to any bachelor\'s on the same terms — the course doesn\'t change the bar, the first-year exams do.',
        'Medicine is the exception: limited places, the EMS aptitude test, and for applicants living abroad it is almost always closed.'],
        's': [S('berufsberatung.ch — ETH Human Medicine', 'https://www.berufsberatung.ch/de/aus-weiterbildungen/eidgenoessische-technische-hochschule-zuerich-ethz/humanmedizin-human-medicine')]},
    'ie': {'by': 'programme', 'pts': [
        'CAO points are set per course each year by demand, so they vary widely between courses at the same university.',
        'Undergraduate medicine adds the HPAT; many courses have subject minimums (e.g. maths for engineering).'],
        's': [S('CAO', 'https://www.cao.ie/')]},
    'se': {'by': 'programme', 'pts': [
        'Each programme lists specific entry requirements (subjects and levels) and ranks applicants in selection groups — school grades, sometimes the SweSAT.'],
        's': [S('University Admissions in Sweden', 'https://www.universityadmissions.se/')]},
    'dk': {'by': 'programme', 'pts': [
        'Each programme has its own grade-average cut-off in Quota 1, and its own criteria (tests, interviews, experience) in Quota 2.'],
        's': [S('Optagelse.dk', 'https://www.optagelse.dk/')]},
    'fi': {'by': 'programme', 'pts': [
        'In the joint application each programme fills places through certificate-based admission (its own points for your grades) or its own entrance exam.'],
        's': [S('Studyinfo.fi', 'https://studyinfo.fi/')]},
    'be': {'by': 'programme', 'pts': [
        'In Flanders most bachelor\'s are open to anyone with a recognised diploma.',
        'Medicine and dentistry need the entrance exam; civil and industrial engineering require taking the (non-binding) ijkingstoets.'],
        's': [S('ijkingstoets.be', 'https://www.ijkingstoets.be/'), S('UAntwerpen — engineering admission conditions', 'https://www.uantwerpen.be/nl/studeren/opleidingsaanbod/ingenieur-elektronica-ict/bachelor/toelatingsvoorwaarden/')]},
    'pt': {'by': 'programme', 'pts': [
        'Each course decides which national exams (provas de ingresso) count and the minimum marks; international students apply through each university\'s own contingent.'],
        's': [S('DGES — access to higher education', 'https://www.dges.gov.pt/')]},
    'ua': {'by': 'programme', 'pts': [
        'NMT subjects are weighted differently for each specialty, and every programme ranks applicants by its own competitive score.'],
        's': [S('Ministry of Education and Science of Ukraine', 'https://mon.gov.ua/')]},
}

# US: how you are admitted at each profiled university.
USS = {
    'us:cornell': ['school', 'You apply to one of Cornell\'s undergraduate colleges or schools; each reads applications separately and admits at its own rate.', S('Cornell Undergraduate Admissions', 'https://admissions.cornell.edu/')],
    'us:upenn': ['school', 'You apply to one of Penn\'s four undergraduate schools (College, Wharton, Engineering, Nursing).', S('Penn Admissions', 'https://admissions.upenn.edu/')],
    'us:columbia': ['school', 'You apply to Columbia College or to Columbia Engineering (SEAS).', S('Columbia Undergraduate Admissions', 'https://undergrad.admissions.columbia.edu/')],
    'us:duke': ['school', 'You choose Trinity (arts & sciences) or Pratt (engineering) on the application; switching later isn\'t guaranteed.', S('Duke — apply', 'https://admissions.duke.edu/apply/')],
    'us:northwestern': ['school', 'You apply to one of Northwestern\'s undergraduate schools (e.g. Weinberg, McCormick, Medill).', S('Northwestern Admissions', 'https://admissions.northwestern.edu/')],
    'us:carnegie-mellon': ['school', 'You apply to specific CMU colleges/programs; the School of Computer Science is far more selective than the university overall.', S('CMU Admission', 'https://www.cmu.edu/admission/')],
    'us:nyu': ['school', 'You apply to a specific NYU school or program (e.g. Stern, Tandon, Tisch with a portfolio).', S('NYU Undergraduate Admissions', 'https://www.nyu.edu/admissions/undergraduate-admissions.html')],
    'us:georgetown': ['school', 'You apply to one of Georgetown\'s undergraduate schools (College, SFS, McDonough, Nursing, Health).', S('Georgetown Undergraduate Admissions', 'https://uadmissions.georgetown.edu/')],
    'us:vanderbilt': ['school', 'You apply to one of Vanderbilt\'s undergraduate schools (Arts & Science, Engineering, Peabody, Blair).', S('Vanderbilt Admissions', 'https://admissions.vanderbilt.edu/')],
    'us:tufts': ['school', 'You apply to Arts & Sciences, Engineering, or the SMFA art programs.', S('Tufts Admissions', 'https://admissions.tufts.edu/')],
    'us:michigan': ['school', 'You apply to a school or college (e.g. LSA, Engineering); Ross business now admits first-years directly and very selectively.', S('Michigan Undergraduate Admissions', 'https://admissions.umich.edu/')],
    'us:uc-berkeley': ['school', 'You apply to a college; EECS sits in the College of Engineering and is among the hardest programs to enter.', S('Berkeley Engineering — undergraduate FAQs', 'https://engineering.berkeley.edu/admissions/undergraduate-admissions/undergrad-faqs/')],
    'us:ucla': ['major', 'Your major matters: engineering and arts majors are admitted by major — Computer Science admitted 4.1% for fall 2024.', S('UCLA — fall 2024 admissions by major', 'https://admission.ucla.edu/apply/first-year/first-year-profile/2024/major')],
    'us:usc': ['major', 'You list a first-choice major; some majors need a portfolio or audition.', S('USC Admission', 'https://admission.usc.edu/')],
}
UNI_ADMIT = 'You are admitted to the university, not to a major — you choose the major later, so the course doesn\'t change the grade bar here (your intended major is still read in context).'
for k in ['us:harvard', 'us:yale', 'us:princeton', 'us:stanford', 'us:mit', 'us:caltech', 'us:brown', 'us:dartmouth', 'us:rice', 'us:johns-hopkins', 'us:notre-dame', 'us:emory', 'us:georgia-tech']:
    USS[k] = ['uni', UNI_ADMIT, None]


def build():
    return {'courses': COURSES, 'courseRules': RULES, 'usSchools': {k: {'by': v[0], 't': v[1], 's': v[2]} for k, v in USS.items()}}
