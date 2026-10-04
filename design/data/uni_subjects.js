/* ════════════════════════════════════════════════════════════════════
   What you can study — curated subject lists for flagship universities.
   Keyed by "<country>:<id>" (ids repeat across countries, e.g. tum).
   Lists follow each university's faculties / schools / departments and
   their main degree subjects, grouped into broad areas so they're easy to
   scan. Programme names and intakes change every year, so the page always
   points to the official course list. Universities not listed here fall
   back to the broad subject areas in data/<cc>.json.
   Areas: H humanities & arts · S social sciences · B business & economics ·
   L law · N sciences & maths · E engineering & technology · C computing &
   data · M medicine & health · A architecture & design · D education ·
   G agriculture & environment.
   Checked: September 2026.
   ════════════════════════════════════════════════════════════════════ */
window.UNI_SUBJECTS = {
    /* ── United Kingdom ─────────────────────────────────────────────── */
    'gb:oxford': { deg: ['Bachelor', 'Master', 'DPhil'], g: {
        H: ['Classics', 'English Language and Literature', 'History', 'History of Art', 'Modern Languages', 'Music', 'Philosophy', 'Theology and Religion', 'Asian and Middle Eastern Studies', 'Linguistics', 'Fine Art'],
        S: ['Philosophy, Politics and Economics (PPE)', 'Archaeology and Anthropology', 'Geography', 'Human Sciences', 'History and Politics'],
        B: ['Economics and Management', 'History and Economics'],
        L: ['Law (Jurisprudence)', 'Law with Law Studies in Europe'],
        N: ['Mathematics', 'Mathematics and Statistics', 'Physics', 'Chemistry', 'Biology', 'Biochemistry', 'Earth Sciences', 'Materials Science'],
        E: ['Engineering Science'],
        C: ['Computer Science', 'Mathematics and Computer Science', 'Computer Science and Philosophy'],
        M: ['Medicine', 'Biomedical Sciences', 'Experimental Psychology', 'Psychology, Philosophy and Linguistics'] } },
    'gb:cambridge': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['Anglo-Saxon, Norse and Celtic', 'Asian and Middle Eastern Studies', 'Classics', 'English', 'History', 'History of Art', 'Linguistics', 'Modern and Medieval Languages', 'Music', 'Philosophy', 'Theology, Religion and Philosophy of Religion'],
        S: ['Archaeology', 'Human, Social, and Political Sciences', 'Geography', 'Land Economy', 'Psychological and Behavioural Sciences'],
        B: ['Economics'], L: ['Law'],
        N: ['Mathematics', 'Natural Sciences (Physical)', 'Natural Sciences (Biological)'],
        E: ['Engineering', 'Chemical Engineering and Biotechnology'],
        C: ['Computer Science'],
        M: ['Medicine', 'Veterinary Medicine'],
        A: ['Architecture'], D: ['Education'] } },
    'gb:imperial': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        E: ['Aeronautical Engineering', 'Bioengineering', 'Chemical Engineering', 'Civil Engineering', 'Design Engineering', 'Electrical and Electronic Engineering', 'Materials Science and Engineering', 'Mechanical Engineering', 'Geology and Geophysics'],
        C: ['Computing', 'Mathematics and Computer Science', 'Electronic and Information Engineering'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biological Sciences', 'Biochemistry', 'Biotechnology'],
        M: ['Medicine', 'Medical Biosciences', 'Biomedical Engineering'],
        B: ['Economics, Finance and Data Science', 'Business School (Master\'s and MBA)'] } },
    'gb:ucl': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['English', 'History', 'History of Art', 'Philosophy', 'Classics', 'Ancient History', 'Hebrew and Jewish Studies', 'Modern Languages', 'Russian and East European Studies', 'Linguistics', 'Fine Art (Slade)', 'Arts and Sciences (BASc)'],
        S: ['Anthropology', 'Archaeology', 'Geography', 'Politics and International Relations', 'Psychology', 'Social Sciences', 'Urban Studies'],
        B: ['Economics', 'Management Science', 'Statistics, Economics and Finance'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Astrophysics', 'Chemistry', 'Biological Sciences', 'Biochemistry', 'Natural Sciences', 'Earth Sciences', 'Statistics', 'Neuroscience'],
        E: ['Mechanical Engineering', 'Civil Engineering', 'Electronic and Electrical Engineering', 'Chemical Engineering', 'Biomedical Engineering'],
        C: ['Computer Science', 'Data Science'],
        M: ['Medicine', 'Pharmacy', 'Biomedical Sciences', 'Population Health'],
        A: ['Architecture (Bartlett)', 'Architectural and Interdisciplinary Studies', 'Urban Planning', 'Construction Project Management'],
        D: ['Education (IOE)'] } },
    'gb:lse': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        S: ['Anthropology', 'Geography', 'Government', 'International Relations', 'International History', 'Social Policy', 'Sociology', 'Psychological and Behavioural Science', 'Philosophy, Logic and Scientific Method', 'Politics and Philosophy', 'Environmental Policy'],
        B: ['Economics', 'Econometrics and Mathematical Economics', 'Economic History', 'Accounting and Finance', 'Finance', 'Management', 'Actuarial Science', 'Mathematics and Economics'],
        L: ['Law'], C: ['Data Science', 'Mathematics, Statistics and Business'] } },
    'gb:kcl': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['English', 'History', 'Classics', 'Philosophy', 'Music', 'Film Studies', 'Liberal Arts', 'Theology and Religion', 'Modern Languages', 'Digital Culture'],
        S: ['War Studies', 'International Relations', 'Geography', 'Politics', 'European Studies'],
        B: ['Economics', 'Business Management', 'Accounting and Finance'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biomedical Science', 'Neuroscience', 'Nutrition'],
        E: ['Engineering'], C: ['Computer Science', 'Artificial Intelligence'],
        M: ['Medicine', 'Dentistry', 'Nursing', 'Midwifery', 'Pharmacy', 'Physiotherapy', 'Psychology'] } },
    'gb:edinburgh': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Classics', 'English Literature', 'Philosophy', 'Divinity', 'Music', 'Modern Languages', 'Linguistics', 'Celtic and Scottish Studies', 'History of Art', 'Fine Art'],
        S: ['Politics', 'International Relations', 'Sociology', 'Social Anthropology', 'Psychology', 'Geography'],
        B: ['Economics', 'Business'], L: ['Law (LLB)'],
        N: ['Mathematics', 'Physics', 'Astrophysics', 'Chemistry', 'Biological Sciences', 'Geology', 'Ecological and Environmental Sciences'],
        E: ['Chemical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Structural Engineering'],
        C: ['Informatics', 'Computer Science', 'Artificial Intelligence'],
        M: ['Medicine', 'Veterinary Medicine', 'Biomedical Sciences', 'Nursing'],
        A: ['Architecture', 'Design', 'Landscape Architecture'], D: ['Education'] } },
    'gb:manchester': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        H: ['History', 'English', 'Music', 'Drama', 'Modern Languages', 'Philosophy', 'Archaeology', 'Religion and Theology'],
        S: ['Politics', 'Sociology', 'Criminology', 'Geography', 'Planning', 'Psychology'],
        B: ['Economics', 'Accounting and Finance', 'Management (Alliance MBS)'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Biochemistry', 'Earth Sciences', 'Materials'],
        E: ['Aerospace Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Electrical and Electronic Engineering'],
        C: ['Computer Science'],
        M: ['Medicine', 'Dentistry', 'Pharmacy', 'Nursing', 'Midwifery', 'Optometry'],
        A: ['Architecture'], D: ['Education'] } },
    'gb:warwick': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        H: ['English', 'History', 'Film and Television', 'Classics', 'History of Art', 'Philosophy', 'Theatre and Performance', 'Modern Languages', 'Liberal Arts'],
        S: ['Politics and International Studies', 'Sociology', 'Psychology', 'Global Sustainable Development'],
        B: ['Economics', 'Philosophy, Politics and Economics (PPE)', 'Management (WBS)', 'Accounting and Finance'], L: ['Law'],
        N: ['Mathematics', 'MORSE (Maths, Operational Research, Statistics, Economics)', 'Physics', 'Chemistry', 'Life Sciences', 'Statistics'],
        E: ['Engineering'], C: ['Computer Science', 'Data Science', 'Discrete Mathematics'],
        M: ['Medicine (graduate entry)'], D: ['Education Studies'] } },
    'gb:durham': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        H: ['English', 'History', 'Classics', 'Philosophy', 'Theology and Religion', 'Music', 'Modern Languages'],
        S: ['Archaeology', 'Anthropology', 'Geography', 'Politics', 'International Relations', 'Sociology', 'Criminology', 'Psychology', 'Sport and Exercise Sciences'],
        B: ['Economics', 'Finance', 'Business and Management', 'Accounting'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biosciences', 'Earth Sciences', 'Natural Sciences'],
        E: ['Engineering'], C: ['Computer Science'], D: ['Education'] } },

    /* ── United States ──────────────────────────────────────────────── */
    'us:harvard': { deg: ['Bachelor', 'Master', 'PhD', 'JD', 'MD', 'MBA'], g: {
        H: ['English', 'History', 'History of Art and Architecture', 'Philosophy', 'Classics', 'Comparative Literature', 'Linguistics', 'Music', 'Religion', 'Romance Languages', 'East Asian Studies', 'Art, Film and Visual Studies', 'Theater, Dance and Media'],
        S: ['Government', 'Economics', 'Social Studies', 'Sociology', 'Anthropology', 'Psychology', 'African and African American Studies', 'History and Science'],
        N: ['Mathematics', 'Applied Mathematics', 'Statistics', 'Physics', 'Astrophysics', 'Chemistry', 'Molecular and Cellular Biology', 'Neuroscience', 'Earth and Planetary Sciences', 'Human Developmental and Regenerative Biology'],
        E: ['Mechanical Engineering', 'Electrical Engineering', 'Biomedical Engineering', 'Environmental Science and Engineering'],
        C: ['Computer Science'],
        M: ['Medicine (graduate)', 'Dental Medicine (graduate)', 'Public Health (graduate)'],
        B: ['Business (HBS, graduate)'], L: ['Law (graduate)'], A: ['Design (GSD, graduate)'], D: ['Education (graduate)'] } },
    'us:mit': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        E: ['Aeronautics and Astronautics', 'Biological Engineering', 'Chemical Engineering', 'Civil and Environmental Engineering', 'Electrical Engineering and Computer Science', 'Materials Science and Engineering', 'Mechanical Engineering', 'Nuclear Science and Engineering'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Brain and Cognitive Sciences', 'Earth, Atmospheric and Planetary Sciences'],
        C: ['Computer Science and Engineering', 'Artificial Intelligence and Decision Making', 'Computation and Cognition'],
        B: ['Economics', 'Management (Sloan)'],
        S: ['Political Science', 'Anthropology', 'Science, Technology and Society', 'Urban Studies and Planning'],
        H: ['Linguistics and Philosophy', 'History', 'Literature', 'Comparative Media Studies', 'Music and Theater Arts'],
        A: ['Architecture'] } },
    'us:stanford': { deg: ['Bachelor', 'Master', 'PhD', 'JD', 'MD', 'MBA'], g: {
        E: ['Aeronautics and Astronautics', 'Bioengineering', 'Chemical Engineering', 'Civil and Environmental Engineering', 'Electrical Engineering', 'Materials Science and Engineering', 'Mechanical Engineering', 'Management Science and Engineering'],
        C: ['Computer Science', 'Symbolic Systems', 'Data Science'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Human Biology', 'Earth Systems', 'Geophysics'],
        S: ['Economics', 'Political Science', 'International Relations', 'Psychology', 'Sociology', 'Anthropology', 'Public Policy'],
        H: ['History', 'English', 'Philosophy', 'Classics', 'Linguistics', 'Music', 'Art Practice', 'Art History', 'Film and Media Studies', 'Comparative Literature'],
        M: ['Medicine (graduate)'], B: ['Business (GSB, graduate)'], L: ['Law (graduate)'], D: ['Education (graduate)'] } },
    'us:caltech': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        N: ['Physics', 'Applied Physics', 'Astrophysics', 'Chemistry', 'Biology', 'Mathematics', 'Applied and Computational Mathematics', 'Geological and Planetary Sciences'],
        E: ['Mechanical Engineering', 'Electrical Engineering', 'Chemical Engineering', 'Bioengineering', 'Materials Science', 'Environmental Science and Engineering', 'Aerospace (graduate)'],
        C: ['Computer Science', 'Information and Data Sciences'],
        B: ['Business, Economics and Management', 'Economics'],
        S: ['Political Science'], H: ['History', 'Philosophy', 'English'] } },
    'us:princeton': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['English', 'History', 'Philosophy', 'Classics', 'Comparative Literature', 'Art and Archaeology', 'Music', 'Religion', 'East Asian Studies', 'Near Eastern Studies', 'French and Italian', 'German', 'Spanish and Portuguese', 'Slavic Languages and Literatures'],
        S: ['Politics', 'Public and International Affairs (SPIA)', 'Sociology', 'Anthropology', 'Psychology', 'Economics'],
        N: ['Mathematics', 'Physics', 'Astrophysical Sciences', 'Chemistry', 'Molecular Biology', 'Ecology and Evolutionary Biology', 'Neuroscience', 'Geosciences'],
        E: ['Chemical and Biological Engineering', 'Civil and Environmental Engineering', 'Electrical and Computer Engineering', 'Mechanical and Aerospace Engineering', 'Operations Research and Financial Engineering'],
        C: ['Computer Science'], A: ['Architecture'] } },
    'us:yale': { deg: ['Bachelor', 'Master', 'PhD', 'JD', 'MD', 'MBA'], g: {
        H: ['English', 'History', 'History of Art', 'Philosophy', 'Classics', 'Music', 'Religious Studies', 'Film and Media Studies', 'Theater, Dance and Performance Studies', 'Art'],
        S: ['Political Science', 'Economics', 'Ethics, Politics and Economics', 'Global Affairs', 'Sociology', 'Anthropology', 'Psychology', 'Cognitive Science'],
        N: ['Mathematics', 'Applied Mathematics', 'Physics', 'Astronomy', 'Chemistry', 'Molecular Biophysics and Biochemistry', 'Neuroscience', 'Environmental Studies'],
        E: ['Biomedical Engineering', 'Electrical Engineering', 'Mechanical Engineering'],
        C: ['Computer Science', 'Statistics and Data Science'],
        M: ['Medicine (graduate)', 'Nursing (graduate)', 'Public Health (graduate)'],
        L: ['Law (graduate)'], B: ['Management (SOM, graduate)'], A: ['Architecture'] } },
    'us:columbia': { deg: ['Bachelor', 'Master', 'PhD', 'JD', 'MD', 'MBA'], g: {
        H: ['English', 'History', 'Philosophy', 'Classics', 'Art History', 'Music', 'Comparative Literature', 'Film and Media Studies'],
        S: ['Economics', 'Political Science', 'Sociology', 'Anthropology', 'Psychology', 'Sustainable Development', 'International and Public Affairs (SIPA, graduate)', 'Journalism (graduate)', 'Social Work (graduate)'],
        N: ['Mathematics', 'Physics', 'Astronomy', 'Chemistry', 'Biology', 'Neuroscience and Behavior', 'Earth and Environmental Sciences'],
        E: ['Biomedical Engineering', 'Chemical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Industrial Engineering and Operations Research', 'Applied Mathematics'],
        C: ['Computer Science', 'Data Science'],
        M: ['Medicine (graduate)', 'Dental Medicine (graduate)', 'Nursing', 'Public Health (graduate)'],
        L: ['Law (graduate)'], B: ['Business (graduate)'], A: ['Architecture, Planning and Preservation (graduate)'] } },
    'us:uc-berkeley': { deg: ['Bachelor', 'Master', 'PhD', 'JD', 'MBA'], g: {
        S: ['Economics', 'Political Science', 'Psychology', 'Sociology', 'Anthropology', 'Global Studies', 'Media Studies', 'Public Policy', 'Public Health', 'Social Welfare'],
        H: ['History', 'English', 'Philosophy', 'Linguistics', 'Music', 'Art Practice'],
        N: ['Mathematics', 'Statistics', 'Physics', 'Astrophysics', 'Chemistry', 'Molecular and Cell Biology', 'Integrative Biology', 'Cognitive Science'],
        E: ['Electrical Engineering and Computer Sciences', 'Mechanical Engineering', 'Civil and Environmental Engineering', 'Bioengineering', 'Chemical Engineering', 'Industrial Engineering and Operations Research', 'Materials Science', 'Nuclear Engineering'],
        C: ['Computer Science', 'Data Science'],
        G: ['Environmental Sciences', 'Conservation and Resource Studies'],
        B: ['Business Administration (Haas)'], L: ['Law (graduate)'], A: ['Architecture', 'Landscape Architecture', 'Urban Studies'], M: ['Optometry'], D: ['Education'] } },
    'us:carnegie-mellon': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        C: ['Computer Science', 'Artificial Intelligence', 'Human-Computer Interaction', 'Information Systems', 'Statistics and Machine Learning'],
        E: ['Electrical and Computer Engineering', 'Mechanical Engineering', 'Chemical Engineering', 'Civil and Environmental Engineering', 'Biomedical Engineering', 'Materials Science and Engineering'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biological Sciences', 'Neuroscience'],
        B: ['Economics', 'Business Administration (Tepper)'],
        S: ['Psychology', 'Public Policy (Heinz)'],
        H: ['Philosophy', 'History', 'English', 'Modern Languages', 'Art', 'Drama', 'Music'],
        A: ['Architecture', 'Design'] } },
    'us:johns-hopkins': { deg: ['Bachelor', 'Master', 'PhD', 'MD'], g: {
        E: ['Biomedical Engineering', 'Mechanical Engineering', 'Electrical and Computer Engineering', 'Chemical and Biomolecular Engineering', 'Materials Science and Engineering', 'Civil and Systems Engineering', 'Environmental Engineering'],
        C: ['Computer Science', 'Applied Mathematics and Statistics'],
        N: ['Biology', 'Molecular and Cellular Biology', 'Biophysics', 'Neuroscience', 'Chemistry', 'Physics', 'Mathematics'],
        S: ['Economics', 'International Studies', 'Political Science', 'Sociology', 'Anthropology', 'Psychological and Brain Sciences', 'Public Health Studies'],
        H: ['History', 'English', 'Writing Seminars', 'Philosophy', 'Music (Peabody)'],
        M: ['Medicine (graduate)', 'Nursing', 'Public Health (graduate)'],
        B: ['Business (Carey)'], D: ['Education'] } },

    /* ── Spain ──────────────────────────────────────────────────────── */
    'es:ucm': { deg: ['Grado', 'Máster', 'Doctorado'], g: {
        H: ['Fine Arts', 'Philology (Languages and Literature)', 'Philosophy', 'History', 'Art History', 'Geography'],
        S: ['Political Science', 'Sociology', 'Journalism', 'Audiovisual Communication', 'Advertising and Public Relations', 'Psychology', 'Social Work', 'Library and Information Science'],
        B: ['Economics', 'Business Administration', 'Commerce', 'Tourism', 'Statistics'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Geology'],
        C: ['Computer Engineering', 'Software Engineering'],
        M: ['Medicine', 'Dentistry', 'Pharmacy', 'Nursing', 'Physiotherapy', 'Podiatry', 'Optics and Optometry', 'Veterinary Medicine'],
        D: ['Primary Education', 'Early Childhood Education', 'Pedagogy'] } },
    'es:ub': { deg: ['Grado', 'Máster', 'Doctorado'], g: {
        H: ['Fine Arts', 'Languages and Literature', 'Philosophy', 'History', 'Art History', 'Archaeology', 'Geography'],
        S: ['Political Science', 'Sociology', 'Anthropology', 'Criminology', 'Psychology', 'Social Work', 'Information Science'],
        B: ['Economics', 'Business Administration', 'Statistics'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Biotechnology', 'Geology', 'Environmental Sciences'],
        E: ['Chemical Engineering', 'Materials Engineering', 'Biomedical Engineering'], C: ['Computer Engineering'],
        M: ['Medicine', 'Dentistry', 'Pharmacy', 'Nursing', 'Podiatry', 'Human Nutrition and Dietetics', 'Food Science'],
        D: ['Primary Education', 'Early Childhood Education', 'Pedagogy'] } },
    'es:uam': { deg: ['Grado', 'Máster', 'Doctorado'], g: {
        H: ['History', 'Art History', 'Philosophy', 'Modern Languages', 'Translation and Interpreting', 'Geography'],
        S: ['Political Science', 'Anthropology', 'Psychology'],
        B: ['Economics', 'Business Administration'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Biochemistry', 'Biotechnology', 'Environmental Sciences', 'Food Science and Technology'],
        C: ['Computer Engineering', 'Data Science', 'Telecommunications Engineering'],
        M: ['Medicine', 'Nursing', 'Human Nutrition'],
        D: ['Primary Education', 'Early Childhood Education'] } },
    'es:upf': { deg: ['Grado', 'Máster', 'Doctorado'], g: {
        H: ['Humanities', 'History', 'Philosophy', 'Translation and Interpreting'],
        S: ['Political Science', 'Global Studies', 'Journalism', 'Audiovisual Communication', 'Advertising and Public Relations', 'Criminology'],
        B: ['Economics', 'Business Administration', 'International Business Economics'], L: ['Law'],
        N: ['Human Biology'], E: ['Biomedical Engineering', 'Telecommunications Engineering'],
        C: ['Computer Engineering', 'Data Science and Engineering', 'Audiovisual Systems Engineering'],
        M: ['Medicine (with UAB)'] } },
    'es:upc': { deg: ['Grado', 'Máster', 'Doctorado'], g: {
        E: ['Industrial Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Electronic Engineering', 'Chemical Engineering', 'Aerospace Engineering', 'Civil Engineering', 'Telecommunications Engineering', 'Engineering Physics', 'Naval Engineering', 'Mining Engineering', 'Energy Engineering', 'Materials Engineering', 'Biosystems and Agricultural Engineering', 'Geomatics'],
        C: ['Computer Engineering (FIB)', 'Data Science and Engineering', 'Artificial Intelligence'],
        N: ['Mathematics', 'Nautical Science'],
        A: ['Architecture', 'Building Engineering', 'Industrial Design'],
        M: ['Optics and Optometry'] } },
    'es:upm': { deg: ['Grado', 'Máster', 'Doctorado'], g: {
        E: ['Aerospace Engineering', 'Industrial Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Chemical Engineering', 'Civil Engineering', 'Mining and Energy Engineering', 'Naval Architecture', 'Telecommunications Engineering', 'Materials Engineering', 'Topography and Geomatics', 'Biotechnology'],
        C: ['Computer Science', 'Software Engineering', 'Data Science and AI'],
        G: ['Agricultural Engineering', 'Forestry Engineering'],
        A: ['Architecture', 'Building', 'Industrial Design', 'Fashion Design'],
        M: ['Sports Science (INEF)'] } },
    'es:uc3m': { deg: ['Grado', 'Máster', 'Doctorado'], g: {
        S: ['Political Science', 'Sociology', 'International Studies', 'Journalism', 'Audiovisual Communication', 'Humanities'],
        B: ['Economics', 'Business Administration', 'Finance and Accounting', 'Statistics and Business', 'Tourism'], L: ['Law'],
        E: ['Aerospace Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Electronic Engineering', 'Biomedical Engineering', 'Energy Engineering', 'Telecommunications Engineering'],
        C: ['Computer Science', 'Data Science', 'Applied Mathematics and Computing'] } },
    'es:uab': { deg: ['Grado', 'Máster', 'Doctorado'], g: {
        H: ['History', 'Philosophy', 'Languages and Literature', 'Art History', 'Translation and Interpreting'],
        S: ['Political Science', 'Sociology', 'Anthropology', 'Psychology', 'Journalism', 'Audiovisual Communication', 'Advertising and Public Relations', 'Criminology'],
        B: ['Economics', 'Business Administration'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Geology', 'Environmental Sciences', 'Biology', 'Biotechnology', 'Biochemistry', 'Genetics', 'Microbiology'],
        E: ['Chemical Engineering', 'Electronic and Telecommunications Engineering'], C: ['Computer Engineering', 'Artificial Intelligence'],
        M: ['Medicine', 'Nursing', 'Physiotherapy', 'Veterinary Medicine'],
        D: ['Primary Education', 'Early Childhood Education'] } },
    'es:upv': { deg: ['Grado', 'Máster', 'Doctorado'], g: {
        E: ['Industrial Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Chemical Engineering', 'Aerospace Engineering', 'Civil Engineering', 'Telecommunications Engineering', 'Biotechnology', 'Geomatics'],
        C: ['Computer Engineering', 'Data Science'],
        G: ['Agricultural Engineering', 'Forestry Engineering', 'Food Science and Technology'],
        A: ['Architecture', 'Building Engineering', 'Industrial Design'],
        B: ['Business Administration', 'Tourism'], H: ['Fine Arts', 'Audiovisual Communication'] } },
    'es:ie': { deg: ['Bachelor', 'Master', 'MBA', 'PhD'], g: {
        B: ['Business Administration', 'Economics', 'Data and Business Analytics', 'Finance (Master)', 'Management (Master)', 'MBA'],
        S: ['Philosophy, Politics, Law and Economics (PPLE)', 'International Relations', 'Communication and Digital Media', 'Behavioral and Social Sciences', 'Environmental Sciences for Sustainability'],
        L: ['Law'], C: ['Computer Science and Artificial Intelligence'],
        A: ['Architecture', 'Design', 'Fashion Design'] } },

    /* ── France ─────────────────────────────────────────────────────── */
    'fr:polytec': { deg: ['Bachelor', 'Ingénieur (Master)', 'Master', 'PhD'], g: {
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Mechanics'],
        C: ['Computer Science', 'Applied Mathematics', 'Data Science', 'Artificial Intelligence', 'Cybersecurity'],
        E: ['Engineering (Ingénieur polytechnicien)', 'Energy and Environment'],
        B: ['Economics', 'Economics and Mathematics'],
        H: ['Humanities and Social Sciences'] } },
    'fr:hec': { deg: ['Master', 'MBA', 'PhD'], g: {
        B: ['Master in Management (Grande École)', 'MBA', 'Executive MBA', 'International Finance', 'Accounting and Financial Management', 'Marketing', 'Strategic Management', 'Entrepreneurship', 'Sustainability and Social Innovation'],
        C: ['Data Science for Business (with École Polytechnique)'] } },
    'fr:sciencespo': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        S: ['Political Science', 'International Relations (PSIA)', 'Public Policy', 'Sociology', 'History', 'Urban Planning', 'Environmental Policy', 'Human Rights', 'Journalism'],
        B: ['Economics', 'Management and Impact'], L: ['Law'] } },
    'fr:sorbonne': { deg: ['Licence', 'Master', 'Doctorat'], g: {
        H: ['French Literature', 'History', 'Philosophy', 'Art History and Archaeology', 'Musicology', 'Linguistics', 'Latin and Greek', 'English', 'German', 'Spanish', 'Italian', 'Arabic', 'Slavic Studies'],
        S: ['Geography', 'Information and Communication (CELSA)'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Earth Sciences', 'Mechanics'],
        E: ['Electronics', 'Engineering (Polytech Sorbonne)'], C: ['Computer Science'],
        M: ['Medicine', 'Midwifery'] } },

    /* ── Germany ────────────────────────────────────────────────────── */
    'de:tum': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        C: ['Informatics', 'Games Engineering', 'Bioinformatics', 'Data Engineering and Analytics'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biochemistry', 'Molecular Biotechnology'],
        E: ['Electrical and Computer Engineering', 'Mechanical Engineering', 'Aerospace', 'Civil Engineering', 'Environmental Engineering', 'Geodesy and Geoinformation', 'Engineering Science'],
        G: ['Agricultural Sciences', 'Forest Science', 'Brewing and Beverage Technology', 'Food Technology', 'Nutrition Science'],
        B: ['Management and Technology'], M: ['Medicine', 'Sport and Health Science'],
        S: ['Political Science'], A: ['Architecture'], D: ['Teacher Education'] } },
    'de:lmu': { deg: ['Bachelor', 'Master', 'Staatsexamen', 'PhD'], g: {
        H: ['History', 'Art History', 'Musicology', 'Philosophy', 'German Studies', 'English Studies', 'Romance Languages', 'Linguistics', 'Classics', 'Theology (Catholic and Protestant)'],
        S: ['Psychology', 'Political Science', 'Sociology', 'Communication Studies', 'Geography'],
        B: ['Business Administration', 'Economics'], L: ['Law'],
        N: ['Mathematics', 'Statistics', 'Physics', 'Chemistry', 'Biology', 'Geology'],
        C: ['Computer Science', 'Media Informatics'],
        M: ['Medicine', 'Dentistry', 'Pharmacy', 'Veterinary Medicine'], D: ['Education'] } },
    'de:heidelberg': { deg: ['Bachelor', 'Master', 'Staatsexamen', 'PhD'], g: {
        H: ['History', 'Art History', 'Philosophy', 'Classics', 'German Studies', 'English Studies', 'Romance Studies', 'Translation and Interpreting', 'Theology', 'Egyptology'],
        S: ['Political Science', 'Sociology', 'Psychology', 'Geography'],
        B: ['Economics'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Astronomy', 'Chemistry', 'Biology', 'Molecular Biotechnology', 'Geosciences'],
        C: ['Computer Science', 'Scientific Computing'],
        M: ['Medicine', 'Pharmacy'], D: ['Education'] } },

    /* ── Italy ──────────────────────────────────────────────────────── */
    'it:bocconi': { deg: ['Bachelor', 'Master', 'MBA', 'PhD'], g: {
        B: ['Business Administration and Management', 'International Economics and Finance', 'Economic and Social Sciences', 'Economics and Management for Arts, Culture and Communication', 'Economics, Management and Computer Science', 'Finance (Master)', 'Accounting (Master)', 'Marketing (Master)', 'MBA (SDA Bocconi)'],
        S: ['International Politics and Government', 'Politics and Policy Analysis (Master)'],
        L: ['Law', 'Global Law'], C: ['Mathematical and Computing Sciences for AI', 'Data Science (Master)'] } },
    'it:polimi': { deg: ['Laurea', 'Laurea Magistrale', 'PhD'], g: {
        E: ['Aerospace Engineering', 'Automation Engineering', 'Biomedical Engineering', 'Chemical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Electronics Engineering', 'Energy Engineering', 'Environmental Engineering', 'Management Engineering', 'Materials Engineering', 'Mechanical Engineering', 'Engineering Physics', 'Mathematical Engineering', 'Telecommunications Engineering'],
        C: ['Computer Science and Engineering'],
        A: ['Architecture', 'Urban Planning', 'Building Engineering', 'Interior Design', 'Product Design', 'Communication Design', 'Fashion Design'] } },
    'it:sapienza': { deg: ['Laurea', 'Laurea Magistrale', 'PhD'], g: {
        H: ['Philosophy', 'Classics', 'Archaeology', 'History', 'Art History', 'Oriental Studies', 'Modern Languages'],
        S: ['Political Science', 'Sociology', 'Communication', 'Psychology'],
        B: ['Economics', 'Business Management'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Geology', 'Statistics'],
        E: ['Civil Engineering', 'Mechanical Engineering', 'Aerospace Engineering', 'Chemical Engineering', 'Electrical Engineering'],
        C: ['Computer Engineering', 'Computer Science'],
        M: ['Medicine', 'Dentistry', 'Pharmacy', 'Nursing'], A: ['Architecture'] } },

    /* ── Portugal ───────────────────────────────────────────────────── */
    'pt:nova': { deg: ['Licenciatura', 'Mestrado', 'Doutoramento'], g: {
        B: ['Economics', 'Management', 'Finance (Nova SBE)'], L: ['Law'],
        H: ['History', 'Philosophy', 'Languages and Literature', 'Art History', 'Musicology'],
        S: ['Communication Sciences', 'Anthropology', 'Sociology', 'Political Science'],
        N: ['Mathematics', 'Chemistry', 'Biochemistry'],
        E: ['Civil Engineering', 'Mechanical Engineering', 'Electrical and Computer Engineering', 'Industrial Engineering', 'Environmental Engineering', 'Materials Engineering', 'Biomedical Engineering', 'Engineering Physics'],
        C: ['Computer Science', 'Data Science', 'Information Management (NOVA IMS)'],
        M: ['Medicine', 'Public Health (graduate)', 'Tropical Medicine (graduate)'] } },
    'pt:ulisboa': { deg: ['Licenciatura', 'Mestrado', 'Doutoramento'], g: {
        H: ['History', 'Philosophy', 'Languages and Literature', 'Fine Arts'],
        S: ['Psychology', 'Political Science', 'Sociology', 'Geography and Spatial Planning', 'Human Kinetics (Sport)'],
        B: ['Economics', 'Management (ISEG)'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Geology'],
        E: ['Engineering (Instituto Superior Técnico)', 'Aerospace Engineering', 'Civil Engineering', 'Electrical and Computer Engineering', 'Mechanical Engineering'],
        C: ['Computer Science and Engineering'],
        G: ['Agronomy', 'Forestry'],
        M: ['Medicine', 'Dental Medicine', 'Pharmacy', 'Veterinary Medicine'],
        A: ['Architecture', 'Design'], D: ['Education'] } },
    'pt:porto': { deg: ['Licenciatura', 'Mestrado', 'Doutoramento'], g: {
        H: ['History', 'Philosophy', 'Languages and Literature', 'Fine Arts'],
        S: ['Psychology', 'Sociology', 'Geography', 'Sport Science'],
        B: ['Economics', 'Management'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology'],
        E: ['Civil Engineering', 'Mechanical Engineering', 'Electrical and Computer Engineering', 'Chemical Engineering', 'Industrial Engineering', 'Mining Engineering'],
        C: ['Informatics and Computing Engineering'],
        M: ['Medicine', 'Dental Medicine', 'Pharmacy', 'Nutrition Sciences', 'Veterinary Medicine'],
        A: ['Architecture'], D: ['Education Sciences'] } },

    /* ── Switzerland ────────────────────────────────────────────────── */
    'ch:eth-zurich': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        A: ['Architecture'],
        E: ['Civil Engineering', 'Environmental Engineering', 'Geomatics', 'Mechanical Engineering', 'Electrical Engineering and Information Technology', 'Materials Science', 'Biotechnology', 'Health Sciences and Technology'],
        C: ['Computer Science', 'Data Science'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Earth Sciences', 'Environmental Sciences', 'Pharmaceutical Sciences'],
        G: ['Agricultural Sciences', 'Food Science'],
        M: ['Human Medicine'],
        B: ['Management, Technology and Economics'], S: ['Political Science'] } },
    'ch:epfl': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        A: ['Architecture'],
        E: ['Civil Engineering', 'Environmental Sciences and Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Microengineering', 'Materials Science', 'Bioengineering', 'Chemical Engineering', 'Life Sciences Engineering'],
        C: ['Computer Science', 'Communication Systems', 'Data Science'],
        N: ['Mathematics', 'Physics', 'Chemistry'],
        B: ['Management of Technology', 'Financial Engineering'] } },
    'ch:unisg': { deg: ['Bachelor', 'Master', 'MBA', 'PhD'], g: {
        B: ['Business Administration', 'Economics', 'Banking and Finance', 'Accounting and Finance', 'Marketing', 'Strategy and International Management', 'Quantitative Economics and Finance'],
        S: ['International Affairs'], L: ['Law', 'Law and Economics'], C: ['Computer Science'] } },
    'ch:uzh': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Art History', 'Linguistics', 'German Studies', 'English Studies', 'Romance Studies', 'Theology', 'Religious Studies'],
        S: ['Psychology', 'Political Science', 'Sociology', 'Communication and Media', 'Geography'],
        B: ['Economics', 'Business Administration', 'Banking and Finance'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Biochemistry', 'Earth Sciences'],
        C: ['Informatics'],
        M: ['Medicine', 'Dentistry', 'Chiropractic Medicine', 'Veterinary Medicine'], D: ['Education'] } },
    'ch:unige': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['French Literature', 'History', 'Philosophy', 'Art History', 'Modern Languages', 'Theology'],
        S: ['Political Science', 'Sociology', 'Geography', 'International Relations', 'Psychology', 'Translation and Interpreting'],
        B: ['Economics', 'Management', 'Statistics'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Earth Sciences'],
        C: ['Computer Science'],
        M: ['Medicine', 'Dental Medicine', 'Pharmaceutical Sciences'], D: ['Education'] } },
    'ch:iheid': { deg: ['Master', 'PhD'], g: {
        S: ['International Affairs', 'Development Studies', 'Anthropology and Sociology', 'International History and Politics', 'International Relations and Political Science'],
        B: ['International Economics'], L: ['International Law'] } },

    /* ── Ukraine ────────────────────────────────────────────────────── */
    'ua:knu': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Ukrainian Philology', 'Linguistics', 'Translation'],
        S: ['Political Science', 'Sociology', 'Psychology', 'Journalism', 'Advertising and Public Relations', 'International Relations'],
        B: ['Economics', 'International Economics'], L: ['Law', 'International Law'],
        N: ['Mathematics', 'Mechanics', 'Statistics', 'Physics', 'Astronomy', 'Chemistry', 'Biology', 'Biotechnology', 'Geography', 'Geology'],
        E: ['Radiophysics', 'Electronics'],
        C: ['Computer Science', 'Cybernetics', 'Software Engineering', 'Cybersecurity'],
        M: ['Medicine'] } },
    'ua:kpi': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        C: ['Applied Mathematics', 'Software Engineering', 'Computer Engineering', 'Cybersecurity', 'System Analysis and AI'],
        E: ['Electronics', 'Radio Engineering', 'Telecommunications', 'Mechanical Engineering', 'Aerospace Engineering', 'Chemical Engineering', 'Chemical Technology', 'Biomedical Engineering', 'Power Engineering', 'Nuclear Energy', 'Electrical Engineering', 'Instrumentation', 'Materials Science', 'Welding'],
        N: ['Applied Physics', 'Biotechnology'],
        B: ['Management', 'Marketing', 'Economics'],
        S: ['Sociology', 'Linguistics and Translation', 'Publishing and Printing'], L: ['Law'] } },
    'ua:naukma': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        H: ['History', 'Philosophy', 'Ukrainian Philology', 'English Philology', 'Cultural Studies'],
        S: ['Political Science', 'Sociology', 'Psychology', 'Social Work', 'Journalism'],
        B: ['Economics', 'Finance', 'Marketing', 'Management', 'MBA (Kyiv-Mohyla Business School)'], L: ['Law'],
        N: ['Biology', 'Chemistry', 'Ecology'],
        C: ['Computer Science', 'Software Engineering', 'Applied Mathematics'],
        M: ['Public Health'] } },
    'ua:karazin': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Philology', 'Foreign Languages'],
        S: ['Psychology', 'Sociology', 'International Relations', 'Tourism'],
        B: ['Economics', 'International Economic Relations'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Geology', 'Geography', 'Ecology'],
        E: ['Radiophysics and Electronics', 'Biomedical Electronics', 'Physics and Technology'],
        C: ['Computer Science', 'Applied Mathematics'],
        M: ['Medicine'] } },
    'ua:lpnu': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        A: ['Architecture', 'Design'],
        E: ['Civil Engineering', 'Environmental Engineering', 'Chemical Engineering', 'Mechanical Engineering', 'Transport', 'Energy Engineering', 'Automation and Control', 'Metrology', 'Electronics', 'Telecommunications', 'Geodesy'],
        C: ['Computer Science', 'Software Engineering', 'Computer Engineering', 'Cybersecurity', 'Applied Mathematics'],
        B: ['Economics', 'Management'],
        S: ['Psychology', 'Humanities and Social Sciences'], L: ['Law'] } },
    'ua:ucu': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        H: ['History', 'Philology', 'Cultural Studies', 'Philosophy', 'Theology'],
        S: ['Journalism', 'Psychology', 'Social Work', 'Ethics, Politics and Economics'],
        B: ['Management (Lviv Business School)', 'MBA'],
        C: ['Computer Science', 'Business Analytics', 'Data Science (Master)'],
        M: ['Physical Therapy'] } },

    /* ── Netherlands ────────────────────────────────────────────────── */
    'nl:uva': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Art History', 'Media and Culture', 'Linguistics', 'Literature', 'Modern Languages', 'Musicology', 'Archaeology'],
        S: ['Political Science', 'Sociology', 'Anthropology', 'Communication Science', 'Psychology', 'Human Geography and Planning', 'Liberal Arts (AUC)'],
        B: ['Economics', 'Business Administration', 'Econometrics', 'Actuarial Science'], L: ['Law', 'International and European Law'],
        N: ['Mathematics', 'Physics and Astronomy', 'Chemistry', 'Biology', 'Biomedical Sciences', 'Future Planet Studies'],
        C: ['Computer Science', 'Artificial Intelligence', 'Information Science'],
        M: ['Medicine', 'Dentistry (ACTA)'], D: ['Education'] } },
    'nl:tud': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        A: ['Architecture', 'Urbanism', 'Industrial Design Engineering'],
        E: ['Civil Engineering', 'Applied Earth Sciences', 'Electrical Engineering', 'Aerospace Engineering', 'Mechanical Engineering', 'Maritime Engineering', 'Applied Physics', 'Clinical Technology'],
        C: ['Computer Science and Engineering', 'Applied Mathematics'],
        N: ['Molecular Science and Technology', 'Nanobiology'],
        B: ['Technology, Policy and Management'] } },
    'nl:lei': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Linguistics', 'Art History', 'Literature', 'Asian Studies (Chinese, Japanese, Korean)', 'Middle Eastern Studies', 'Russian Studies', 'Archaeology'],
        S: ['Political Science', 'Public Administration', 'Security Studies', 'International Studies', 'Anthropology', 'Psychology', 'Education and Child Studies', 'Liberal Arts (LUC The Hague)'],
        L: ['Law', 'Criminology', 'Tax Law'],
        N: ['Mathematics', 'Physics', 'Astronomy', 'Chemistry', 'Biology', 'Life Science and Technology'],
        C: ['Computer Science', 'Data Science'],
        M: ['Medicine', 'Biomedical Sciences'] } },
    'nl:uu': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Linguistics', 'Literature', 'Media and Culture', 'Musicology', 'Art History', 'Religious Studies'],
        S: ['Psychology', 'Sociology', 'Cultural Anthropology', 'Public Administration', 'Human Geography and Planning', 'Liberal Arts (UCU)'],
        B: ['Economics'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Earth Sciences', 'Sustainable Development'],
        C: ['Computer Science', 'Information Science', 'Artificial Intelligence'],
        M: ['Medicine', 'Pharmacy', 'Biomedical Sciences', 'Veterinary Medicine'], D: ['Education'] } },
    'nl:eur': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        B: ['Business Administration (RSM)', 'International Business', 'Economics and Business Economics', 'Econometrics', 'Fiscal Economics'],
        L: ['Law', 'Criminology'],
        S: ['Psychology', 'Sociology', 'Public Administration', 'Pedagogical Sciences', 'Communication and Media', 'Development Studies (ISS)'],
        H: ['History', 'Arts and Culture Studies', 'Philosophy'],
        M: ['Medicine (Erasmus MC)', 'Health Sciences', 'Nanobiology (with TU Delft)'] } },

    /* ── Sweden ─────────────────────────────────────────────────────── */
    'se:kth': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        A: ['Architecture', 'Design and Product Realisation'],
        E: ['Civil Engineering and Urban Management', 'Electrical Engineering', 'Engineering Physics', 'Vehicle Engineering', 'Mechanical Engineering', 'Chemical Engineering', 'Biotechnology', 'Medical Engineering', 'Materials Design', 'Energy and Environment'],
        C: ['Computer Science', 'Information and Communication Technology', 'Media Technology'],
        N: ['Mathematics'], B: ['Industrial Engineering and Management', 'Real Estate'] } },
    'se:lu': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        E: ['Engineering Physics', 'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Biotechnology'],
        A: ['Architecture', 'Industrial Design'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Geology', 'Physical Geography', 'Astronomy'],
        C: ['Computer Science', 'Informatics'],
        L: ['Law'],
        S: ['Political Science', 'Sociology', 'Psychology', 'Social Work', 'Media and Communication', 'Human Geography', 'Development Studies'],
        M: ['Medicine', 'Nursing', 'Physiotherapy', 'Occupational Therapy', 'Biomedicine'],
        H: ['History', 'Philosophy', 'Languages', 'Linguistics', 'Theology', 'Fine Arts', 'Music', 'Theatre'],
        B: ['Economics', 'Business Administration', 'Statistics'] } },
    'se:uu': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Linguistics', 'Languages', 'Theology'],
        S: ['Political Science', 'Peace and Conflict Studies', 'Sociology', 'Psychology'],
        B: ['Economics', 'Business Studies'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Earth Sciences'],
        E: ['Engineering Physics', 'Electrical Engineering', 'Molecular Biotechnology Engineering'],
        C: ['Computer Science'],
        M: ['Medicine', 'Pharmacy', 'Nursing', 'Physiotherapy', 'Biomedicine'], D: ['Education'] } },
    'se:ki': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        M: ['Medicine', 'Nursing', 'Dentistry', 'Dental Hygiene', 'Biomedicine', 'Physiotherapy', 'Occupational Therapy', 'Speech and Language Pathology', 'Radiography', 'Biomedical Laboratory Science', 'Public Health', 'Global Health', 'Nutrition', 'Toxicology'],
        B: ['Bioentrepreneurship (Master)'] } },

    /* ── Denmark ────────────────────────────────────────────────────── */
    'dk:ku': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Linguistics', 'Languages', 'Art History', 'Film and Media Studies', 'Musicology', 'Theology'],
        S: ['Political Science', 'Sociology', 'Anthropology', 'Psychology'],
        B: ['Economics'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Biochemistry', 'Geography', 'Geology', 'Nanoscience'],
        C: ['Computer Science'],
        G: ['Food Science', 'Nutrition', 'Natural Resources'],
        M: ['Medicine', 'Dentistry', 'Pharmacy', 'Public Health', 'Molecular Biomedicine', 'Veterinary Medicine'] } },
    'dk:dtu': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        E: ['Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Environmental Engineering', 'Chemistry and Technology', 'Biotechnology', 'Physics and Nanotechnology', 'Earth and Space Physics', 'Sustainable Energy Design', 'Medicine and Technology', 'Design and Innovation'],
        C: ['Software Technology', 'Computer Engineering', 'Artificial Intelligence and Data', 'Cyber Technology', 'Mathematics and Technology'],
        A: ['Architectural Engineering'], G: ['Food Science', 'Life Science and Technology'],
        B: ['Engineering Management (Master)'] } },
    'dk:au': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Archaeology', 'Linguistics', 'Languages', 'Musicology', 'Media Studies', 'Theology'],
        S: ['Political Science', 'Psychology', 'Journalism'],
        B: ['Economics', 'Business Administration'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Molecular Biology', 'Geoscience', 'Nanoscience'],
        E: ['Engineering'], C: ['Computer Science'],
        G: ['Agrobiology', 'Food Science'],
        M: ['Medicine', 'Dentistry', 'Public Health', 'Sports Science'], D: ['Education'] } },

    /* ── Belgium ────────────────────────────────────────────────────── */
    'be:kul': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Linguistics and Literature', 'Art History', 'Archaeology', 'Theology and Religious Studies'],
        S: ['Political Science', 'Sociology', 'Communication Studies', 'Social Work', 'Psychology', 'Educational Sciences'],
        B: ['Economics', 'Business Engineering', 'Business Administration'], L: ['Law', 'Criminology'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Biochemistry and Biotechnology', 'Geography', 'Geology'],
        E: ['Engineering Science', 'Engineering Technology', 'Bioscience Engineering'],
        C: ['Computer Science'],
        M: ['Medicine', 'Dentistry', 'Pharmaceutical Sciences', 'Biomedical Sciences', 'Rehabilitation Sciences and Physiotherapy', 'Movement Sciences'],
        A: ['Architecture', 'Interior Architecture'] } },
    'be:ugent': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Linguistics and Literature', 'Art History', 'Archaeology'],
        S: ['Political Science', 'Sociology', 'Communication Sciences', 'Psychology', 'Educational Sciences'],
        B: ['Economics', 'Business Economics', 'Business Engineering'], L: ['Law', 'Criminology'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Biochemistry and Biotechnology', 'Geography', 'Geology'],
        E: ['Engineering', 'Bioscience Engineering'], C: ['Computer Science'],
        M: ['Medicine', 'Dentistry', 'Pharmaceutical Sciences', 'Biomedical Sciences', 'Veterinary Medicine'],
        A: ['Architecture'] } },

    /* ── Finland ────────────────────────────────────────────────────── */
    'fi:helsinki': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['History', 'Philosophy', 'Languages', 'Linguistics', 'Art Studies', 'Cultural Studies', 'Theology'],
        S: ['Political Science', 'Sociology', 'Social Work', 'Communication', 'Psychology', 'Logopedics'],
        B: ['Economics'], L: ['Law'],
        N: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Environmental Sciences', 'Geosciences', 'Geography'],
        C: ['Computer Science', 'Data Science'],
        G: ['Agricultural Sciences', 'Forest Sciences', 'Food Sciences', 'Environmental Economics'],
        M: ['Medicine', 'Dentistry', 'Pharmacy', 'Veterinary Medicine'], D: ['Education'] } },
    'fi:aalto': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        A: ['Architecture', 'Landscape Architecture', 'Design', 'Film and Television', 'Media', 'Art'],
        B: ['Economics', 'Accounting', 'Finance', 'Marketing', 'Management', 'Information and Service Management'],
        E: ['Chemical Engineering', 'Bioproducts', 'Materials Science', 'Electrical Engineering and Automation', 'Communications Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Energy and Built Environment', 'Engineering Physics', 'Life Science Technologies'],
        C: ['Computer Science', 'Data Science', 'Mathematics and Systems Analysis'],
        N: ['Industrial Engineering and Management'] } },

    /* ── Ireland ────────────────────────────────────────────────────── */
    'ie:tcd': { deg: ['Bachelor', 'Master', 'PhD'], g: {
        H: ['English', 'History', 'Philosophy', 'Classics', 'History of Art', 'Music', 'Drama', 'Film Studies', 'Modern Languages', 'Linguistics', 'Religion'],
        S: ['Philosophy, Political Science, Economics and Sociology (PPES)', 'Psychology', 'Social Work', 'Geography'],
        B: ['Business', 'Economics'], L: ['Law'],
        N: ['Mathematics', 'Theoretical Physics', 'Natural Sciences', 'Geoscience'],
        E: ['Engineering'], C: ['Computer Science'],
        M: ['Medicine', 'Dentistry', 'Pharmacy', 'Nursing', 'Midwifery', 'Physiotherapy', 'Occupational Therapy', 'Radiation Therapy'], D: ['Education'] } },
    'ie:ucd': { deg: ['Bachelor', 'Master', 'PhD', 'MBA'], g: {
        H: ['English', 'History', 'Philosophy', 'Classics', 'Modern Languages', 'Music', 'Film Studies', 'Art History', 'Archaeology'],
        S: ['Social Science', 'Politics and International Relations', 'Sociology', 'Psychology', 'Geography'],
        B: ['Business and Commerce', 'Economics', 'Finance', 'Accountancy'], L: ['Law'],
        N: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],
        E: ['Engineering'], C: ['Computer Science'],
        G: ['Agricultural Science', 'Food Science'],
        M: ['Medicine', 'Veterinary Medicine', 'Nursing', 'Physiotherapy', 'Radiography', 'Sports Science'],
        A: ['Architecture'] } }
};

/* Degree levels for places that don't teach undergraduates (the default is
   "Bachelor · Master · PhD", shown only as typical). */
window.UNI_DEGREES = {
    'gb:said': ['Master', 'MBA', 'DPhil'], 'gb:cam-judge': ['Master', 'MBA', 'PhD'], 'gb:imperial-bs': ['Master', 'MBA', 'PhD'],
    'gb:cranfield': ['Master', 'MBA', 'PhD'], 'fr:insead': ['Master', 'MBA', 'PhD'], 'fr:hec': ['Master', 'MBA', 'PhD'],
    'ch:iheid': ['Master', 'PhD'], 'ch:imd': ['MBA', 'Executive education']
};
