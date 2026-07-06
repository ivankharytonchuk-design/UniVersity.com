/* ════════════════════════════════════════════════════════════════════
   Careers dataset — top graduate recruiters, their target universities &
   degrees, plus a university list used to estimate destinations.

   Curated from widely-reported graduate-recruiting patterns (company careers
   pages, university outcome reports, Universum/prestige rankings). It's
   illustrative guidance, not a guarantee. Remove careers_* files to undo.
   ════════════════════════════════════════════════════════════════════ */
window.CAREERS = {
  // sel = selectivity (0..1, higher = harder). icon = FA brand icon or '' for monogram.
  companies: [
    { name: 'Google', sector: 'Big Tech', color: '#4285F4', icon: 'fa-google', sel: 0.86,
      degrees: ['Computer Science', 'Engineering', 'Data Science', 'Mathematics'],
      roles: ['Software Engineer', 'Product Manager', 'Data Scientist'],
      unis: ['MIT', 'Stanford University', 'Carnegie Mellon University', 'University of Cambridge', 'ETH Zurich', 'UC Berkeley', 'University of Oxford'] },
    { name: 'Apple', sector: 'Big Tech', color: '#111111', icon: 'fa-apple', sel: 0.82,
      degrees: ['Computer Science', 'Electrical Engineering', 'Design'],
      roles: ['Software Engineer', 'Hardware Engineer', 'Product Designer'],
      unis: ['Stanford University', 'MIT', 'UC Berkeley', 'Georgia Tech', 'TU Munich', 'University of Cambridge'] },
    { name: 'Microsoft', sector: 'Big Tech', color: '#00A4EF', icon: 'fa-microsoft', sel: 0.72,
      degrees: ['Computer Science', 'Engineering', 'Business'],
      roles: ['Software Engineer', 'Program Manager', 'Cloud Engineer'],
      unis: ['University of Washington', 'MIT', 'Carnegie Mellon University', 'University of Cambridge', 'University of Waterloo', 'Imperial College London'] },
    { name: 'Amazon', sector: 'Big Tech', color: '#FF9900', icon: 'fa-amazon', sel: 0.64,
      degrees: ['Computer Science', 'Engineering', 'Business', 'Operations'],
      roles: ['Software Dev Engineer', 'Operations Manager', 'Business Analyst'],
      unis: ['University of Washington', 'Carnegie Mellon University', 'Georgia Tech', 'University of Waterloo', 'London School of Economics', 'University of Manchester'] },
    { name: 'Meta', sector: 'Big Tech', color: '#0866FF', icon: 'fa-meta', sel: 0.8,
      degrees: ['Computer Science', 'Data Science', 'Engineering'],
      roles: ['Software Engineer', 'Data Scientist', 'Research Scientist'],
      unis: ['Stanford University', 'MIT', 'UC Berkeley', 'Carnegie Mellon University', 'University of Cambridge'] },
    { name: 'Goldman Sachs', sector: 'Investment Banking', color: '#6C8CBF', icon: '', sel: 0.88,
      degrees: ['Economics', 'Finance', 'Mathematics', 'Business'],
      roles: ['Investment Banking Analyst', 'Trader', 'Quant Analyst'],
      unis: ['Harvard University', 'London School of Economics', 'University of Oxford', 'University of Pennsylvania', 'Bocconi University', 'University of Cambridge'] },
    { name: 'J.P. Morgan', sector: 'Investment Banking', color: '#117ACA', icon: '', sel: 0.76,
      degrees: ['Economics', 'Finance', 'Accounting', 'Business'],
      roles: ['Analyst', 'Associate', 'Risk Analyst'],
      unis: ['New York University', 'London School of Economics', 'University of Warwick', 'Bocconi University', 'University of Michigan'] },
    { name: 'McKinsey & Co.', sector: 'Consulting', color: '#0B1F2C', icon: '', sel: 0.9,
      degrees: ['Business', 'Economics', 'Engineering', 'Any field'],
      roles: ['Business Analyst', 'Associate'],
      unis: ['Harvard University', 'INSEAD', 'University of Oxford', 'London Business School', 'IE University', 'Bocconi University'] },
    { name: 'BCG', sector: 'Consulting', color: '#177B57', icon: '', sel: 0.88,
      degrees: ['Business', 'Economics', 'Engineering', 'Any field'],
      roles: ['Associate', 'Consultant'],
      unis: ['Harvard University', 'INSEAD', 'University of Cambridge', 'HEC Paris', 'Bocconi University'] },
    { name: 'Deloitte', sector: 'Professional Services', color: '#86BC25', icon: '', sel: 0.5,
      degrees: ['Accounting', 'Business', 'Computer Science', 'Law'],
      roles: ['Consultant', 'Auditor', 'Technology Analyst'],
      unis: ['University of Warwick', 'University of Manchester', 'New York University', 'University of Toronto', 'IE University'] }
  ],

  // tier: 1..5 (5 = elite). fields drive the field-match probability.
  universities: [
    { name: 'University of Oxford', short: 'Oxford', tier: 5, fields: ['Economics', 'Law', 'Medicine', 'Computer Science', 'Mathematics', 'Humanities'] },
    { name: 'University of Cambridge', short: 'Cambridge', tier: 5, fields: ['Engineering', 'Computer Science', 'Mathematics', 'Economics', 'Natural Sciences'] },
    { name: 'MIT', short: 'MIT', tier: 5, fields: ['Engineering', 'Computer Science', 'Mathematics', 'Physics', 'Business'] },
    { name: 'Stanford University', short: 'Stanford', tier: 5, fields: ['Computer Science', 'Engineering', 'Business', 'Design'] },
    { name: 'Harvard University', short: 'Harvard', tier: 5, fields: ['Economics', 'Law', 'Business', 'Medicine', 'Humanities'] },
    { name: 'London School of Economics', short: 'LSE', tier: 5, fields: ['Economics', 'Finance', 'Politics', 'Law', 'Business'] },
    { name: 'ETH Zurich', short: 'ETH', tier: 5, fields: ['Engineering', 'Computer Science', 'Physics', 'Mathematics'] },
    { name: 'Imperial College London', short: 'Imperial', tier: 4, fields: ['Engineering', 'Computer Science', 'Medicine', 'Mathematics'] },
    { name: 'Carnegie Mellon University', short: 'CMU', tier: 4, fields: ['Computer Science', 'Engineering', 'Design'] },
    { name: 'UC Berkeley', short: 'Berkeley', tier: 4, fields: ['Computer Science', 'Engineering', 'Business', 'Economics'] },
    { name: 'Bocconi University', short: 'Bocconi', tier: 4, fields: ['Economics', 'Finance', 'Business', 'Law'] },
    { name: 'INSEAD', short: 'INSEAD', tier: 5, fields: ['Business'] },
    { name: 'London Business School', short: 'LBS', tier: 5, fields: ['Business', 'Finance'] },
    { name: 'University of Pennsylvania', short: 'UPenn', tier: 4, fields: ['Business', 'Finance', 'Economics', 'Engineering'] },
    { name: 'New York University', short: 'NYU', tier: 3, fields: ['Finance', 'Business', 'Law', 'Computer Science'] },
    { name: 'University of Warwick', short: 'Warwick', tier: 4, fields: ['Economics', 'Business', 'Mathematics', 'Engineering'] },
    { name: 'University of Manchester', short: 'Manchester', tier: 3, fields: ['Engineering', 'Business', 'Computer Science', 'Economics'] },
    { name: 'University of Washington', short: 'UW', tier: 3, fields: ['Computer Science', 'Engineering'] },
    { name: 'Georgia Tech', short: 'GT', tier: 3, fields: ['Engineering', 'Computer Science'] },
    { name: 'University of Waterloo', short: 'Waterloo', tier: 3, fields: ['Computer Science', 'Engineering'] },
    { name: 'HEC Paris', short: 'HEC', tier: 4, fields: ['Business', 'Finance'] },
    { name: 'TU Munich', short: 'TUM', tier: 4, fields: ['Engineering', 'Computer Science', 'Physics'] },
    { name: 'IE University', short: 'IE', tier: 3, fields: ['Business', 'Law', 'Computer Science'] },
    { name: 'University of Toronto', short: 'UofT', tier: 4, fields: ['Computer Science', 'Engineering', 'Business', 'Medicine'] },
    { name: 'University of Michigan', short: 'Michigan', tier: 3, fields: ['Engineering', 'Business', 'Economics'] }
  ]
};
