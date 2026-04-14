// ─── Taxonomy: Structural Skeleton ───────────────────────────────────────────
// Single source of truth for initial exam/subject/topic seed data.
// Consumed ONLY by seed scripts in server/db/seeds/runners/.
// The runtime API reads from MongoDB — NOT from this file.

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExamTitle = 'JEE' | 'NEET' | 'CLAT' | 'IPMAT' | 'CAT';
export type SubjectName =
  | 'Physics'
  | 'Chemistry'
  | 'Mathematics'
  | 'Botany'
  | 'Zoology'
  | 'Quantitative Aptitude'
  | 'Logical Reasoning'
  | 'English & Verbal Ability'
  | 'Legal Reasoning'
  | 'Current Affairs & GK';

export type SubjectLevel = 'Beginner' | 'Rookie' | 'Skilled' | 'Competent' | 'Expert' | 'Master';

export interface TopicDef {
  slug: string;
  displayName: string;
  examTags: ExamTitle[];
}

export interface SubjectDef {
  name: SubjectName;
  description: string;
  iconName: string;
  accent: string;
  topics: TopicDef[];
}

export interface ExamDef {
  title: ExamTitle;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationMinutes: number;
}

// ─── Levels (fixed, ordered) ─────────────────────────────────────────────────

export const LEVELS: SubjectLevel[] = [
  'Beginner',
  'Rookie',
  'Skilled',
  'Competent',
  'Expert',
  'Master',
];

// ─── Exams ────────────────────────────────────────────────────────────────────

export const EXAMS: ExamDef[] = [
  {
    title: 'JEE',
    description: 'Joint Entrance Examination — gateway to IITs and NITs. Tests Physics, Chemistry, and Mathematics at the highest level of analytical rigor.',
    category: 'Engineering Entrance',
    difficulty: 'advanced',
    durationMinutes: 180,
  },
  {
    title: 'NEET',
    description: 'National Eligibility cum Entrance Test — the single gateway for medical and dental college admissions in India.',
    category: 'Medical Entrance',
    difficulty: 'advanced',
    durationMinutes: 200,
  },
  {
    title: 'CLAT',
    description: 'Common Law Admission Test — the centralized national test for undergraduate and postgraduate law programs at National Law Universities.',
    category: 'Law Entrance',
    difficulty: 'intermediate',
    durationMinutes: 120,
  },
  {
    title: 'IPMAT',
    description: 'Integrated Programme in Management Aptitude Test — for admission to the 5-year IPM program at IIM Indore and IIM Rohtak.',
    category: 'Management Entrance',
    difficulty: 'intermediate',
    durationMinutes: 90,
  },
  {
    title: 'CAT',
    description: 'Common Admission Test — the premier MBA entrance exam for the Indian Institutes of Management and top B-schools.',
    category: 'MBA Entrance',
    difficulty: 'advanced',
    durationMinutes: 120,
  },
];

// ─── Subjects ─────────────────────────────────────────────────────────────────

export const SUBJECTS: SubjectDef[] = [
  {
    name: 'Physics',
    description: 'From classical mechanics to modern physics — the fundamental laws governing the universe.',
    iconName: 'nuclear-outline',
    accent: '#3B82F6',
    topics: [
      { slug: 'units-measurements',         displayName: 'Units & Measurements',         examTags: ['JEE', 'NEET'] },
      { slug: 'kinematics',                  displayName: 'Kinematics',                   examTags: ['JEE', 'NEET'] },
      { slug: 'laws-of-motion',              displayName: 'Laws of Motion',               examTags: ['JEE', 'NEET'] },
      { slug: 'work-energy-power',           displayName: 'Work, Energy & Power',         examTags: ['JEE', 'NEET'] },
      { slug: 'rotational-motion',           displayName: 'Rotational Motion',            examTags: ['JEE', 'NEET'] },
      { slug: 'gravitation',                 displayName: 'Gravitation',                  examTags: ['JEE', 'NEET'] },
      { slug: 'properties-of-matter',        displayName: 'Properties of Matter',         examTags: ['JEE', 'NEET'] },
      { slug: 'thermal-physics',             displayName: 'Thermal Physics',              examTags: ['JEE', 'NEET'] },
      { slug: 'oscillations-waves',          displayName: 'Oscillations & Waves',         examTags: ['JEE', 'NEET'] },
      { slug: 'electrostatics',              displayName: 'Electrostatics',               examTags: ['JEE', 'NEET'] },
      { slug: 'current-electricity',         displayName: 'Current Electricity',          examTags: ['JEE', 'NEET'] },
      { slug: 'magnetism',                   displayName: 'Magnetism',                    examTags: ['JEE', 'NEET'] },
      { slug: 'electromagnetic-induction',   displayName: 'Electromagnetic Induction',    examTags: ['JEE', 'NEET'] },
      { slug: 'optics',                      displayName: 'Optics',                       examTags: ['JEE', 'NEET'] },
      { slug: 'modern-physics',              displayName: 'Modern Physics',               examTags: ['JEE', 'NEET'] },
    ],
  },
  {
    name: 'Chemistry',
    description: 'Physical, inorganic, and organic chemistry — from atomic structure to biomolecules.',
    iconName: 'flask-outline',
    accent: '#10B981',
    topics: [
      { slug: 'basic-concepts',              displayName: 'Basic Concepts of Chemistry',  examTags: ['JEE', 'NEET'] },
      { slug: 'atomic-structure',            displayName: 'Atomic Structure',             examTags: ['JEE', 'NEET'] },
      { slug: 'chemical-bonding',            displayName: 'Chemical Bonding',             examTags: ['JEE', 'NEET'] },
      { slug: 'states-of-matter',            displayName: 'States of Matter',             examTags: ['JEE', 'NEET'] },
      { slug: 'thermodynamics',              displayName: 'Chemical Thermodynamics',      examTags: ['JEE', 'NEET'] },
      { slug: 'equilibrium',                 displayName: 'Chemical Equilibrium',         examTags: ['JEE', 'NEET'] },
      { slug: 'electrochemistry',            displayName: 'Electrochemistry',             examTags: ['JEE', 'NEET'] },
      { slug: 'chemical-kinetics',           displayName: 'Chemical Kinetics',            examTags: ['JEE', 'NEET'] },
      { slug: 'periodic-table',              displayName: 'Periodic Table & Properties',  examTags: ['JEE', 'NEET'] },
      { slug: 'd-f-block-elements',          displayName: 'd & f Block Elements',         examTags: ['JEE', 'NEET'] },
      { slug: 'organic-fundamentals',        displayName: 'Organic Chemistry Fundamentals', examTags: ['JEE', 'NEET'] },
      { slug: 'hydrocarbons',                displayName: 'Hydrocarbons',                 examTags: ['JEE', 'NEET'] },
      { slug: 'organic-functional-groups',   displayName: 'Organic Functional Groups',    examTags: ['JEE', 'NEET'] },
      { slug: 'biomolecules-polymers',        displayName: 'Biomolecules & Polymers',      examTags: ['JEE', 'NEET'] },
    ],
  },
  {
    name: 'Mathematics',
    description: 'Comprehensive JEE Mathematics — from algebra and calculus to vectors and probability.',
    iconName: 'calculator-outline',
    accent: '#6366F1',
    topics: [
      { slug: 'sets-relations-functions',    displayName: 'Sets, Relations & Functions',  examTags: ['JEE'] },
      { slug: 'complex-numbers',             displayName: 'Complex Numbers',              examTags: ['JEE'] },
      { slug: 'quadratic-equations',         displayName: 'Quadratic Equations',          examTags: ['JEE'] },
      { slug: 'sequences-series',            displayName: 'Sequences & Series',           examTags: ['JEE'] },
      { slug: 'permutation-combination',     displayName: 'Permutation & Combination',    examTags: ['JEE'] },
      { slug: 'matrices-determinants',       displayName: 'Matrices & Determinants',      examTags: ['JEE'] },
      { slug: 'trigonometry',                displayName: 'Trigonometry',                 examTags: ['JEE'] },
      { slug: 'straight-lines-circles',      displayName: 'Straight Lines & Circles',     examTags: ['JEE'] },
      { slug: 'conic-sections',              displayName: 'Conic Sections',               examTags: ['JEE'] },
      { slug: '3d-geometry-vectors',         displayName: '3D Geometry & Vectors',        examTags: ['JEE'] },
      { slug: 'limits-continuity',           displayName: 'Limits & Continuity',          examTags: ['JEE'] },
      { slug: 'differentiation',             displayName: 'Differentiation',              examTags: ['JEE'] },
      { slug: 'applications-derivatives',    displayName: 'Applications of Derivatives',  examTags: ['JEE'] },
      { slug: 'integration',                 displayName: 'Integration',                  examTags: ['JEE'] },
      { slug: 'differential-equations',      displayName: 'Differential Equations',       examTags: ['JEE'] },
      { slug: 'statistics-probability',      displayName: 'Statistics & Probability',     examTags: ['JEE'] },
    ],
  },
  {
    name: 'Botany',
    description: 'Plant biology — from diversity and morphology to genetics, biotechnology, and ecology.',
    iconName: 'leaf-outline',
    accent: '#22C55E',
    topics: [
      { slug: 'diversity-living-world',          displayName: 'Diversity in Living World',          examTags: ['NEET'] },
      { slug: 'morphology-flowering-plants',      displayName: 'Morphology of Flowering Plants',     examTags: ['NEET'] },
      { slug: 'anatomy-flowering-plants',         displayName: 'Anatomy of Flowering Plants',        examTags: ['NEET'] },
      { slug: 'cell-biology',                     displayName: 'Cell Biology',                       examTags: ['NEET'] },
      { slug: 'biomolecules',                     displayName: 'Biomolecules',                       examTags: ['NEET'] },
      { slug: 'transport-in-plants',              displayName: 'Transport in Plants',                examTags: ['NEET'] },
      { slug: 'mineral-nutrition',                displayName: 'Mineral Nutrition',                  examTags: ['NEET'] },
      { slug: 'photosynthesis',                   displayName: 'Photosynthesis',                     examTags: ['NEET'] },
      { slug: 'respiration-in-plants',            displayName: 'Respiration in Plants',              examTags: ['NEET'] },
      { slug: 'plant-growth-development',         displayName: 'Plant Growth & Development',         examTags: ['NEET'] },
      { slug: 'sexual-reproduction-plants',       displayName: 'Sexual Reproduction in Plants',      examTags: ['NEET'] },
      { slug: 'genetics-inheritance',             displayName: 'Genetics & Inheritance',             examTags: ['NEET'] },
      { slug: 'molecular-biology',                displayName: 'Molecular Biology',                  examTags: ['NEET'] },
      { slug: 'biotechnology-applications',       displayName: 'Biotechnology & Applications',       examTags: ['NEET'] },
      { slug: 'ecology',                          displayName: 'Ecology',                            examTags: ['NEET'] },
    ],
  },
  {
    name: 'Zoology',
    description: 'Animal biology — from classification and anatomy to human physiology, evolution, and health.',
    iconName: 'paw-outline',
    accent: '#F59E0B',
    topics: [
      { slug: 'animal-kingdom',                   displayName: 'Animal Kingdom',                     examTags: ['NEET'] },
      { slug: 'structural-organisation-animals',  displayName: 'Structural Organisation in Animals', examTags: ['NEET'] },
      { slug: 'human-digestion',                  displayName: 'Human Digestion',                    examTags: ['NEET'] },
      { slug: 'human-respiration',                displayName: 'Human Respiration',                  examTags: ['NEET'] },
      { slug: 'body-fluids-circulation',          displayName: 'Body Fluids & Circulation',          examTags: ['NEET'] },
      { slug: 'excretory-system',                 displayName: 'Excretory System',                   examTags: ['NEET'] },
      { slug: 'locomotion-movement',              displayName: 'Locomotion & Movement',              examTags: ['NEET'] },
      { slug: 'neural-control',                   displayName: 'Neural Control',                     examTags: ['NEET'] },
      { slug: 'chemical-coordination',            displayName: 'Chemical Coordination',              examTags: ['NEET'] },
      { slug: 'human-reproduction',               displayName: 'Human Reproduction',                 examTags: ['NEET'] },
      { slug: 'reproductive-health',              displayName: 'Reproductive Health',                examTags: ['NEET'] },
      { slug: 'evolution',                        displayName: 'Evolution',                          examTags: ['NEET'] },
      { slug: 'human-health-disease',             displayName: 'Human Health & Disease',             examTags: ['NEET'] },
      { slug: 'food-production-strategies',       displayName: 'Strategies for Food Production',     examTags: ['NEET'] },
      { slug: 'microbes-human-welfare',           displayName: 'Microbes in Human Welfare',          examTags: ['NEET'] },
    ],
  },
  {
    name: 'Quantitative Aptitude',
    description: 'Arithmetic, algebra, geometry, and data interpretation — the quantitative foundation for CAT, IPMAT, and CLAT.',
    iconName: 'bar-chart-outline',
    accent: '#EF4444',
    topics: [
      { slug: 'number-system',                    displayName: 'Number System',                      examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'percentage',                       displayName: 'Percentage',                         examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'profit-loss-discount',             displayName: 'Profit, Loss & Discount',            examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'simple-compound-interest',         displayName: 'Simple & Compound Interest',         examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'ratio-proportion-mixtures',        displayName: 'Ratio, Proportion & Mixtures',       examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'time-speed-distance',              displayName: 'Time, Speed & Distance',             examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'time-work',                        displayName: 'Time & Work',                        examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'averages-weighted-mean',           displayName: 'Averages & Weighted Mean',           examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'algebra-equations',                displayName: 'Algebra & Equations',                examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'progressions',                     displayName: 'Progressions (AP/GP/HP)',            examTags: ['CAT', 'IPMAT'] },
      { slug: 'geometry-mensuration',             displayName: 'Geometry & Mensuration',             examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'coordinate-geometry',              displayName: 'Coordinate Geometry',                examTags: ['CAT', 'IPMAT'] },
      { slug: 'permutation-combination-probability', displayName: 'PnC & Probability',              examTags: ['CAT', 'IPMAT'] },
      { slug: 'data-interpretation',              displayName: 'Data Interpretation',                examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'set-theory-venn-diagrams',         displayName: 'Set Theory & Venn Diagrams',         examTags: ['CAT', 'IPMAT', 'CLAT'] },
    ],
  },
  {
    name: 'Logical Reasoning',
    description: 'Analytical puzzles, critical reasoning, and logical deduction — core to CAT DILR, IPMAT, and CLAT.',
    iconName: 'git-branch-outline',
    accent: '#8B5CF6',
    topics: [
      { slug: 'seating-arrangements',             displayName: 'Seating Arrangements',               examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'scheduling-ordering',              displayName: 'Scheduling & Ordering',              examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'blood-relations',                  displayName: 'Blood Relations',                    examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'coding-decoding',                  displayName: 'Coding-Decoding',                    examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'syllogisms',                       displayName: 'Syllogisms',                         examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'critical-reasoning',               displayName: 'Critical Reasoning',                 examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'statement-conclusion',             displayName: 'Statement & Conclusion',             examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'puzzles-grid-games',               displayName: 'Puzzles (Grid & Games)',             examTags: ['CAT', 'IPMAT'] },
      { slug: 'input-output-machines',            displayName: 'Input-Output Machines',              examTags: ['CAT', 'IPMAT'] },
      { slug: 'binary-logic',                     displayName: 'Binary Logic',                       examTags: ['CAT', 'IPMAT'] },
      { slug: 'clocks-calendars',                 displayName: 'Clocks & Calendars',                 examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'series-pattern-recognition',       displayName: 'Series & Pattern Recognition',       examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'visual-nonverbal-reasoning',       displayName: 'Visual / Non-Verbal Reasoning',      examTags: ['IPMAT', 'CLAT'] },
      { slug: 'data-sufficiency',                 displayName: 'Data Sufficiency',                   examTags: ['CAT', 'IPMAT'] },
      { slug: 'argument-analysis',                displayName: 'Argument Analysis',                  examTags: ['CAT', 'CLAT'] },
    ],
  },
  {
    name: 'English & Verbal Ability',
    description: 'Reading comprehension, grammar, vocabulary, and verbal reasoning — for CAT VARC, IPMAT, and CLAT English.',
    iconName: 'book-outline',
    accent: '#EC4899',
    topics: [
      { slug: 'reading-comprehension',            displayName: 'Reading Comprehension',              examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'para-jumbles',                     displayName: 'Para Jumbles & Sentence Order',      examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'para-summary-completion',          displayName: 'Para Summary & Completion',          examTags: ['CAT', 'IPMAT'] },
      { slug: 'odd-sentence-out',                 displayName: 'Odd Sentence Out',                   examTags: ['CAT'] },
      { slug: 'grammar-tenses-voice',             displayName: 'Grammar — Tenses & Voice',           examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'grammar-subject-verb',             displayName: 'Grammar — Subject-Verb Agreement',  examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'grammar-articles-prepositions',    displayName: 'Grammar — Articles & Prepositions',  examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'grammar-conjunctions-modifiers',   displayName: 'Grammar — Conjunctions & Modifiers', examTags: ['CAT', 'IPMAT'] },
      { slug: 'error-spotting-correction',        displayName: 'Error Spotting & Correction',        examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'vocabulary-synonyms-antonyms',     displayName: 'Vocabulary — Synonyms & Antonyms',   examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'vocabulary-fill-blanks',           displayName: 'Vocabulary — Fill in the Blanks',    examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'idioms-phrases-ows',               displayName: 'Idioms, Phrases & OWS',              examTags: ['CAT', 'IPMAT', 'CLAT'] },
      { slug: 'analogy-word-relationships',       displayName: 'Analogy & Word Relationships',       examTags: ['IPMAT', 'CLAT'] },
      { slug: 'phrasal-verbs-collocations',       displayName: 'Phrasal Verbs & Collocations',       examTags: ['CAT', 'IPMAT'] },
      { slug: 'cloze-test',                       displayName: 'Cloze Test',                         examTags: ['CAT', 'IPMAT', 'CLAT'] },
    ],
  },
  {
    name: 'Legal Reasoning',
    description: 'Applying legal principles to factual scenarios — the core of CLAT. No prior legal knowledge required.',
    iconName: 'scale-outline',
    accent: '#0EA5E9',
    topics: [
      { slug: 'torts',                        displayName: 'Torts',                           examTags: ['CLAT'] },
      { slug: 'contract-law',                 displayName: 'Contract Law',                    examTags: ['CLAT'] },
      { slug: 'criminal-law',                 displayName: 'Criminal Law',                    examTags: ['CLAT'] },
      { slug: 'constitutional-principles',    displayName: 'Constitutional Principles',        examTags: ['CLAT'] },
      { slug: 'property-law',                 displayName: 'Property Law',                    examTags: ['CLAT'] },
      { slug: 'family-succession',            displayName: 'Family & Succession',             examTags: ['CLAT'] },
      { slug: 'jurisprudence-legal-theory',   displayName: 'Jurisprudence & Legal Theory',    examTags: ['CLAT'] },
      { slug: 'international-law',            displayName: 'International Law',               examTags: ['CLAT'] },
      { slug: 'public-policy-ethics',         displayName: 'Public Policy & Ethics',          examTags: ['CLAT'] },
      { slug: 'intellectual-property',        displayName: 'Intellectual Property',           examTags: ['CLAT'] },
    ],
  },
  {
    name: 'Current Affairs & GK',
    description: 'Polity, economy, international affairs, and contemporary events — the dynamic section of CLAT.',
    iconName: 'newspaper-outline',
    accent: '#F97316',
    topics: [
      { slug: 'indian-polity-governance',     displayName: 'Indian Polity & Governance',     examTags: ['CLAT'] },
      { slug: 'economy-business',             displayName: 'Economy & Business',             examTags: ['CLAT'] },
      { slug: 'international-affairs',        displayName: 'International Affairs',          examTags: ['CLAT'] },
      { slug: 'science-technology',           displayName: 'Science & Technology',           examTags: ['CLAT'] },
      { slug: 'sports-awards',                displayName: 'Sports & Awards',                examTags: ['CLAT'] },
      { slug: 'history-art-culture',          displayName: 'History, Art & Culture',         examTags: ['CLAT'] },
      { slug: 'environment-ecology',          displayName: 'Environment & Ecology',          examTags: ['CLAT'] },
      { slug: 'legal-social-issues',          displayName: 'Legal & Social Issues',          examTags: ['CLAT'] },
    ],
  },
];

// ─── Exam → Subject Mapping ───────────────────────────────────────────────────

export const EXAM_SUBJECT_MAP: Record<ExamTitle, SubjectName[]> = {
  JEE:   ['Physics', 'Chemistry', 'Mathematics'],
  NEET:  ['Physics', 'Chemistry', 'Botany', 'Zoology'],
  CLAT:  ['English & Verbal Ability', 'Current Affairs & GK', 'Legal Reasoning', 'Logical Reasoning', 'Quantitative Aptitude'],
  IPMAT: ['Quantitative Aptitude', 'Logical Reasoning', 'English & Verbal Ability'],
  CAT:   ['Quantitative Aptitude', 'Logical Reasoning', 'English & Verbal Ability'],
};

// ─── Derived helpers ──────────────────────────────────────────────────────────

export const TOTAL_DECKS = SUBJECTS.reduce((n, s) => n + s.topics.length * LEVELS.length, 0);
export const TOTAL_TOPICS = SUBJECTS.reduce((n, s) => n + s.topics.length, 0);

export const subjectByName = (name: SubjectName): SubjectDef =>
  SUBJECTS.find((s) => s.name === name)!;
