/* ════════════════════════════════════════════════════════════════════
   Careers dataset.

   companies[]  — `rank` 1..10 = the current largest companies (by market cap,
                  July 2026) shown in the "Top recruiters" grid. All companies
                  (ranked + unranked) feed the university-destination estimator,
                  so students from less-elite universities still get realistic,
                  reachable employers (Big-4, Accenture, regional banks, etc.).

   Fields: sel = selectivity (0..1, higher = harder to enter),
           pre = prestige bias (0..1, higher = strongly prefers elite unis).
           unis[] = well-reported feeder/target universities.

   Curated from public graduate-recruiting patterns (company careers pages,
   university outcome reports, Universum/target-school lists). Illustrative
   guidance, not a guarantee. Remove careers_* files to undo.
   ════════════════════════════════════════════════════════════════════ */
window.CAREERS = {
  companies: [
    // ── Top 10 by market cap (July 2026) ──
    { rank: 1, name: 'NVIDIA', sector: 'AI & Semiconductors', color: '#76B900', icon: '', sel: 0.90, pre: 0.88, degrees: ['Computer Science', 'Electrical Engineering', 'Machine Learning', 'Computer Engineering'], roles: ['Deep Learning Engineer', 'Chip Design Engineer', 'Software Engineer'], unis: ['Stanford University', 'MIT', 'UC Berkeley', 'Carnegie Mellon University', 'ETH Zurich', 'Georgia Tech', 'University of Cambridge', 'Tsinghua University'] },
    { rank: 2, name: 'Apple', sector: 'Consumer Electronics', color: '#111111', icon: 'fa-apple', sel: 0.84, pre: 0.82, degrees: ['Computer Science', 'Electrical Engineering', 'Design'], roles: ['Software Engineer', 'Hardware Engineer', 'Product Designer'], unis: ['Stanford University', 'MIT', 'UC Berkeley', 'Georgia Tech', 'TU Munich', 'University of Cambridge'] },
    { rank: 3, name: 'Alphabet (Google)', sector: 'Internet & AI', color: '#4285F4', icon: 'fa-google', sel: 0.86, pre: 0.86, degrees: ['Computer Science', 'Machine Learning', 'Mathematics', 'Engineering'], roles: ['Software Engineer', 'ML Engineer', 'Product Manager'], unis: ['MIT', 'Stanford University', 'Carnegie Mellon University', 'University of Cambridge', 'UC Berkeley', 'University of Waterloo'] },
    { rank: 4, name: 'Microsoft', sector: 'Software & Cloud', color: '#00A4EF', icon: 'fa-microsoft', sel: 0.72, pre: 0.66, degrees: ['Computer Science', 'Engineering', 'Business'], roles: ['Software Engineer', 'Program Manager', 'Cloud Engineer'], unis: ['University of Washington', 'MIT', 'Carnegie Mellon University', 'University of Waterloo', 'Imperial College London', 'IIT Bombay'] },
    { rank: 5, name: 'Amazon', sector: 'E-commerce & Cloud', color: '#FF9900', icon: 'fa-amazon', sel: 0.60, pre: 0.52, degrees: ['Computer Science', 'Engineering', 'Business', 'Operations'], roles: ['Software Dev Engineer', 'Operations Manager', 'Business Analyst'], unis: ['University of Washington', 'Carnegie Mellon University', 'Georgia Tech', 'University of Waterloo', 'University of Manchester', 'IIT Delhi'] },
    { rank: 6, name: 'TSMC', sector: 'Semiconductor Manufacturing', color: '#E30613', icon: '', sel: 0.80, pre: 0.74, degrees: ['Electrical Engineering', 'Materials Science', 'Physics', 'Chemical Engineering'], roles: ['Process Engineer', 'Device Engineer', 'R&D Engineer'], unis: ['National Taiwan University', 'Tsinghua University', 'Stanford University', 'MIT', 'KAIST', 'ETH Zurich'] },
    { rank: 7, name: 'Broadcom', sector: 'Semiconductors & Software', color: '#CC092F', icon: '', sel: 0.78, pre: 0.70, degrees: ['Electrical Engineering', 'Computer Science', 'Computer Engineering'], roles: ['ASIC Engineer', 'Software Engineer'], unis: ['Stanford University', 'UC Berkeley', 'UCLA', 'Georgia Tech', 'National Taiwan University'] },
    { rank: 8, name: 'Tesla', sector: 'Electric Vehicles & Energy', color: '#E82127', icon: '', sel: 0.80, pre: 0.76, degrees: ['Mechanical Engineering', 'Electrical Engineering', 'Computer Science'], roles: ['Design Engineer', 'Firmware Engineer', 'Manufacturing Engineer'], unis: ['Stanford University', 'MIT', 'UC Berkeley', 'TU Munich', 'Georgia Tech', 'RWTH Aachen'] },
    { rank: 9, name: 'Meta Platforms', sector: 'Social Media & AI', color: '#0866FF', icon: 'fa-meta', sel: 0.80, pre: 0.80, degrees: ['Computer Science', 'Data Science', 'Engineering'], roles: ['Software Engineer', 'Data Scientist', 'Research Scientist'], unis: ['Stanford University', 'MIT', 'UC Berkeley', 'Carnegie Mellon University', 'University of Cambridge'] },
    { rank: 10, name: 'Micron Technology', sector: 'Memory Semiconductors', color: '#0072CE', icon: '', sel: 0.64, pre: 0.50, degrees: ['Electrical Engineering', 'Materials Science', 'Physics'], roles: ['Process Engineer', 'Test Engineer'], unis: ['Purdue University', 'Georgia Tech', 'National Taiwan University', 'University of Michigan'] },

    // ── Investment banking & finance ──
    { name: 'Goldman Sachs', sector: 'Investment Banking', color: '#6C8CBF', icon: '', sel: 0.88, pre: 0.90, degrees: ['Economics', 'Finance', 'Mathematics', 'Business'], roles: ['IB Analyst', 'Trader', 'Quant Analyst'], unis: ['Harvard University', 'London School of Economics', 'University of Oxford', 'University of Pennsylvania', 'Bocconi University', 'University of Cambridge'] },
    { name: 'J.P. Morgan', sector: 'Banking', color: '#117ACA', icon: '', sel: 0.74, pre: 0.70, degrees: ['Economics', 'Finance', 'Accounting', 'Business'], roles: ['Analyst', 'Associate'], unis: ['New York University', 'London School of Economics', 'University of Warwick', 'Bocconi University', 'University of Michigan'] },
    { name: 'Morgan Stanley', sector: 'Investment Banking', color: '#00448C', icon: '', sel: 0.82, pre: 0.80, degrees: ['Finance', 'Economics', 'Mathematics'], roles: ['IB Analyst', 'Quant'], unis: ['London School of Economics', 'University of Oxford', 'New York University', 'Bocconi University'] },
    { name: 'Citadel', sector: 'Hedge Fund / Quant', color: '#111111', icon: '', sel: 0.93, pre: 0.92, degrees: ['Mathematics', 'Computer Science', 'Physics', 'Statistics'], roles: ['Quant Researcher', 'Software Engineer'], unis: ['MIT', 'University of Cambridge', 'University of Oxford', 'Stanford University', 'Carnegie Mellon University'] },
    { name: 'Barclays', sector: 'Banking', color: '#00AEEF', icon: '', sel: 0.58, pre: 0.50, degrees: ['Finance', 'Economics', 'Business'], roles: ['Graduate Analyst'], unis: ['University of Warwick', 'University of Manchester', 'London School of Economics', 'University of Nottingham'] },
    { name: 'HSBC', sector: 'Banking', color: '#DB0011', icon: '', sel: 0.48, pre: 0.40, degrees: ['Finance', 'Economics', 'Business'], roles: ['Graduate Analyst'], unis: ['University of Manchester', 'University of Warwick', 'University of Nottingham', 'University of Hong Kong'] },

    // ── Consulting & professional services ──
    { name: 'McKinsey & Co.', sector: 'Consulting', color: '#0B1F2C', icon: '', sel: 0.90, pre: 0.90, degrees: ['Business', 'Economics', 'Engineering', 'Any field'], roles: ['Business Analyst', 'Associate'], unis: ['Harvard University', 'INSEAD', 'University of Oxford', 'London Business School', 'IE University', 'Bocconi University'] },
    { name: 'BCG', sector: 'Consulting', color: '#177B57', icon: '', sel: 0.88, pre: 0.88, degrees: ['Business', 'Economics', 'Engineering', 'Any field'], roles: ['Associate', 'Consultant'], unis: ['Harvard University', 'INSEAD', 'University of Cambridge', 'HEC Paris', 'Bocconi University'] },
    { name: 'Bain & Company', sector: 'Consulting', color: '#C8102E', icon: '', sel: 0.88, pre: 0.87, degrees: ['Business', 'Economics', 'Any field'], roles: ['Associate Consultant'], unis: ['Harvard University', 'INSEAD', 'University of Oxford', 'Bocconi University'] },
    { name: 'Accenture', sector: 'Consulting & Technology', color: '#A100FF', icon: '', sel: 0.40, pre: 0.24, degrees: ['Business', 'Computer Science', 'Engineering', 'Any field'], roles: ['Analyst', 'Technology Consultant'], unis: ['University of Manchester', 'University of Warwick', 'IE University', 'University of Toronto'] },
    { name: 'Deloitte', sector: 'Professional Services', color: '#86BC25', icon: '', sel: 0.46, pre: 0.24, degrees: ['Accounting', 'Business', 'Computer Science', 'Law'], roles: ['Consultant', 'Auditor', 'Tech Analyst'], unis: ['University of Warwick', 'University of Manchester', 'New York University', 'University of Toronto', 'IE University'] },
    { name: 'PwC', sector: 'Professional Services', color: '#D04A02', icon: '', sel: 0.42, pre: 0.22, degrees: ['Accounting', 'Business', 'Economics', 'Law'], roles: ['Associate', 'Auditor'], unis: ['University of Manchester', 'University of Nottingham', 'University of Warwick', 'IE University'] },
    { name: 'EY', sector: 'Professional Services', color: '#2E2E38', icon: '', sel: 0.42, pre: 0.22, degrees: ['Accounting', 'Business', 'Law'], roles: ['Associate'], unis: ['University of Manchester', 'University of Nottingham', 'University of Toronto'] },
    { name: 'KPMG', sector: 'Professional Services', color: '#00338D', icon: '', sel: 0.42, pre: 0.22, degrees: ['Accounting', 'Business', 'Economics'], roles: ['Associate'], unis: ['University of Warwick', 'University of Manchester', 'University of Nottingham'] },

    // ── Broader / mid-cap technology ──
    { name: 'IBM', sector: 'Technology & Consulting', color: '#1F70C1', icon: '', sel: 0.46, pre: 0.36, degrees: ['Computer Science', 'Engineering', 'Business'], roles: ['Software Engineer', 'Consultant'], unis: ['University of Manchester', 'Georgia Tech', 'University of Toronto', 'IIT Delhi'] },
    { name: 'Intel', sector: 'Semiconductors', color: '#0071C5', icon: '', sel: 0.60, pre: 0.52, degrees: ['Electrical Engineering', 'Computer Science', 'Physics'], roles: ['Hardware Engineer', 'Software Engineer'], unis: ['Georgia Tech', 'Purdue University', 'Technion', 'TU Munich'] },
    { name: 'Oracle', sector: 'Software & Cloud', color: '#F80000', icon: '', sel: 0.50, pre: 0.44, degrees: ['Computer Science', 'Engineering'], roles: ['Software Engineer'], unis: ['University of Manchester', 'Georgia Tech', 'IIT Bombay', 'University of Waterloo'] },
    { name: 'SAP', sector: 'Enterprise Software', color: '#0FAAFF', icon: '', sel: 0.50, pre: 0.48, degrees: ['Computer Science', 'Business Informatics', 'Engineering'], roles: ['Developer', 'Consultant'], unis: ['TU Munich', 'ETH Zurich', 'University of Mannheim', 'University of Waterloo'] },
    { name: 'Salesforce', sector: 'Cloud Software', color: '#00A1E0', icon: '', sel: 0.58, pre: 0.54, degrees: ['Computer Science', 'Business'], roles: ['Software Engineer', 'Solutions Engineer'], unis: ['UC Berkeley', 'University of Waterloo', 'Georgia Tech'] },
    { name: 'Adobe', sector: 'Software', color: '#FA0F00', icon: '', sel: 0.62, pre: 0.56, degrees: ['Computer Science', 'Design'], roles: ['Software Engineer', 'Product Designer'], unis: ['Carnegie Mellon University', 'UC Berkeley', 'IIT Delhi'] },
    { name: 'Palantir', sector: 'Data & AI', color: '#101113', icon: '', sel: 0.85, pre: 0.82, degrees: ['Computer Science', 'Mathematics', 'Physics'], roles: ['Forward Deployed Engineer', 'Software Engineer'], unis: ['Stanford University', 'MIT', 'University of Cambridge', 'University of Oxford'] },
    { name: 'Stripe', sector: 'Fintech', color: '#635BFF', icon: '', sel: 0.80, pre: 0.76, degrees: ['Computer Science', 'Engineering'], roles: ['Software Engineer'], unis: ['University of Waterloo', 'MIT', 'Stanford University', 'University of Cambridge'] },
    { name: 'Spotify', sector: 'Music & Tech', color: '#1DB954', icon: '', sel: 0.60, pre: 0.56, degrees: ['Computer Science', 'Data Science', 'Design'], roles: ['Engineer', 'Data Scientist'], unis: ['KTH Royal Institute', 'University of Waterloo', 'Imperial College London'] },
    { name: 'Booking.com', sector: 'Travel Technology', color: '#003580', icon: '', sel: 0.55, pre: 0.50, degrees: ['Computer Science', 'Data Science', 'Business'], roles: ['Developer', 'Analyst'], unis: ['TU Delft', 'University of Manchester', 'Bocconi University'] },

    // ── Industrial / automotive / energy ──
    { name: 'Siemens', sector: 'Industrial & Engineering', color: '#009999', icon: '', sel: 0.45, pre: 0.44, degrees: ['Electrical Engineering', 'Mechanical Engineering', 'Computer Science'], roles: ['Engineer'], unis: ['TU Munich', 'ETH Zurich', 'RWTH Aachen', 'University of Manchester'] },
    { name: 'Bosch', sector: 'Engineering', color: '#E20015', icon: '', sel: 0.45, pre: 0.42, degrees: ['Mechanical Engineering', 'Electrical Engineering', 'Computer Science'], roles: ['Engineer'], unis: ['TU Munich', 'RWTH Aachen', 'ETH Zurich'] },
    { name: 'BMW Group', sector: 'Automotive', color: '#16588E', icon: '', sel: 0.50, pre: 0.50, degrees: ['Mechanical Engineering', 'Electrical Engineering', 'Design'], roles: ['Engineer', 'Designer'], unis: ['TU Munich', 'RWTH Aachen', 'ETH Zurich'] },
    { name: 'Airbus', sector: 'Aerospace', color: '#00205B', icon: '', sel: 0.55, pre: 0.55, degrees: ['Aerospace Engineering', 'Mechanical Engineering'], roles: ['Engineer'], unis: ['ISAE-SUPAERO', 'TU Munich', 'Imperial College London', 'University of Cambridge'] },
    { name: 'Shell', sector: 'Energy', color: '#DD1D21', icon: '', sel: 0.50, pre: 0.46, degrees: ['Chemical Engineering', 'Mechanical Engineering', 'Geoscience'], roles: ['Engineer', 'Analyst'], unis: ['Imperial College London', 'TU Delft', 'University of Manchester'] },

    // ── Consumer goods (recruit broadly) ──
    { name: 'Unilever', sector: 'Consumer Goods', color: '#1F36C7', icon: '', sel: 0.48, pre: 0.40, degrees: ['Business', 'Engineering', 'Marketing', 'Chemistry'], roles: ['Management Trainee'], unis: ['University of Warwick', 'University of Manchester', 'Bocconi University', 'IE University'] },
    { name: 'Procter & Gamble', sector: 'Consumer Goods', color: '#003DA5', icon: '', sel: 0.55, pre: 0.48, degrees: ['Business', 'Engineering', 'Marketing'], roles: ['Brand Manager', 'Engineer'], unis: ['Bocconi University', 'University of Warwick', 'IE University', 'University of Michigan'] },
    { name: 'L’Oréal', sector: 'Beauty & Consumer', color: '#111111', icon: '', sel: 0.50, pre: 0.46, degrees: ['Business', 'Marketing', 'Chemistry'], roles: ['Management Trainee'], unis: ['HEC Paris', 'Bocconi University', 'University of Warwick'] },
    { name: 'Nestlé', sector: 'Consumer Goods', color: '#63A5DE', icon: '', sel: 0.44, pre: 0.36, degrees: ['Business', 'Food Science', 'Engineering'], roles: ['Graduate Trainee'], unis: ['Bocconi University', 'University of Manchester', 'University of Nottingham'] }
  ],

  universities: [
    { name: 'University of Oxford', short: 'Oxford', tier: 5, fields: ['Economics', 'Law', 'Medicine', 'Computer Science', 'Mathematics', 'Humanities'] },
    { name: 'University of Cambridge', short: 'Cambridge', tier: 5, fields: ['Engineering', 'Computer Science', 'Mathematics', 'Economics', 'Natural Sciences'] },
    { name: 'MIT', short: 'MIT', tier: 5, fields: ['Engineering', 'Computer Science', 'Mathematics', 'Physics', 'Business'] },
    { name: 'Stanford University', short: 'Stanford', tier: 5, fields: ['Computer Science', 'Engineering', 'Business', 'Design'] },
    { name: 'Harvard University', short: 'Harvard', tier: 5, fields: ['Economics', 'Law', 'Business', 'Medicine', 'Humanities'] },
    { name: 'London School of Economics', short: 'LSE', tier: 5, fields: ['Economics', 'Finance', 'Politics', 'Law', 'Business'] },
    { name: 'ETH Zurich', short: 'ETH', tier: 5, fields: ['Engineering', 'Computer Science', 'Physics', 'Mathematics'] },
    { name: 'Imperial College London', short: 'Imperial', tier: 4, fields: ['Engineering', 'Computer Science', 'Medicine', 'Mathematics', 'Aerospace Engineering'] },
    { name: 'Carnegie Mellon University', short: 'CMU', tier: 4, fields: ['Computer Science', 'Engineering', 'Design'] },
    { name: 'UC Berkeley', short: 'Berkeley', tier: 4, fields: ['Computer Science', 'Engineering', 'Business', 'Economics'] },
    { name: 'UCLA', short: 'UCLA', tier: 3, fields: ['Engineering', 'Computer Science', 'Business'] },
    { name: 'Bocconi University', short: 'Bocconi', tier: 4, fields: ['Economics', 'Finance', 'Business', 'Law'] },
    { name: 'INSEAD', short: 'INSEAD', tier: 5, fields: ['Business'] },
    { name: 'London Business School', short: 'LBS', tier: 5, fields: ['Business', 'Finance'] },
    { name: 'University of Pennsylvania', short: 'UPenn', tier: 4, fields: ['Business', 'Finance', 'Economics', 'Engineering'] },
    { name: 'New York University', short: 'NYU', tier: 3, fields: ['Finance', 'Business', 'Law', 'Computer Science'] },
    { name: 'University of Warwick', short: 'Warwick', tier: 4, fields: ['Economics', 'Business', 'Mathematics', 'Engineering', 'Accounting'] },
    { name: 'University of Manchester', short: 'Manchester', tier: 3, fields: ['Engineering', 'Business', 'Computer Science', 'Economics', 'Accounting'] },
    { name: 'University of Nottingham', short: 'Nottingham', tier: 3, fields: ['Business', 'Engineering', 'Economics', 'Accounting'] },
    { name: 'University of Washington', short: 'UW', tier: 3, fields: ['Computer Science', 'Engineering'] },
    { name: 'Georgia Tech', short: 'GT', tier: 3, fields: ['Engineering', 'Computer Science', 'Electrical Engineering'] },
    { name: 'Purdue University', short: 'Purdue', tier: 3, fields: ['Engineering', 'Electrical Engineering', 'Materials Science', 'Computer Science'] },
    { name: 'University of Michigan', short: 'Michigan', tier: 3, fields: ['Engineering', 'Business', 'Economics'] },
    { name: 'University of Waterloo', short: 'Waterloo', tier: 3, fields: ['Computer Science', 'Engineering'] },
    { name: 'University of Toronto', short: 'UofT', tier: 4, fields: ['Computer Science', 'Engineering', 'Business', 'Medicine'] },
    { name: 'HEC Paris', short: 'HEC', tier: 4, fields: ['Business', 'Finance'] },
    { name: 'TU Munich', short: 'TUM', tier: 4, fields: ['Engineering', 'Computer Science', 'Physics', 'Mechanical Engineering'] },
    { name: 'RWTH Aachen', short: 'RWTH', tier: 3, fields: ['Mechanical Engineering', 'Electrical Engineering', 'Engineering'] },
    { name: 'University of Mannheim', short: 'Mannheim', tier: 3, fields: ['Business', 'Economics', 'Business Informatics'] },
    { name: 'IE University', short: 'IE', tier: 3, fields: ['Business', 'Law', 'Computer Science'] },
    { name: 'Tsinghua University', short: 'Tsinghua', tier: 5, fields: ['Engineering', 'Computer Science', 'Physics'] },
    { name: 'National Taiwan University', short: 'NTU', tier: 4, fields: ['Electrical Engineering', 'Computer Science', 'Materials Science', 'Physics'] },
    { name: 'KAIST', short: 'KAIST', tier: 4, fields: ['Engineering', 'Computer Science', 'Physics'] },
    { name: 'IIT Bombay', short: 'IIT-B', tier: 4, fields: ['Engineering', 'Computer Science', 'Electrical Engineering'] },
    { name: 'IIT Delhi', short: 'IIT-D', tier: 4, fields: ['Engineering', 'Computer Science', 'Electrical Engineering'] },
    { name: 'Technion', short: 'Technion', tier: 4, fields: ['Engineering', 'Computer Science', 'Physics'] },
    { name: 'KTH Royal Institute', short: 'KTH', tier: 3, fields: ['Engineering', 'Computer Science'] },
    { name: 'TU Delft', short: 'Delft', tier: 4, fields: ['Engineering', 'Computer Science', 'Aerospace Engineering'] },
    { name: 'ISAE-SUPAERO', short: 'SUPAERO', tier: 4, fields: ['Aerospace Engineering', 'Engineering'] },
    { name: 'University of Hong Kong', short: 'HKU', tier: 3, fields: ['Business', 'Finance', 'Law', 'Medicine'] }
  ]
};
