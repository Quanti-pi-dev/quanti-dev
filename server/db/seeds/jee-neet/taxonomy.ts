// ─── JEE & NEET Taxonomy ─────────────────────────────────────
// Single source of truth for all exam/subject/topic data.
// Topics are EXAM-SCOPED: JEE Physics ≠ NEET Physics in content style.

export const EXAMS = [
  {
    slug: 'jee',
    title: 'JEE',
    description: 'Joint Entrance Examination — Engineering. High mathematical rigor, multi-step problems, advanced conceptual depth.',
    category: 'engineering',
    durationMinutes: 180,
  },
  {
    slug: 'neet',
    title: 'NEET',
    description: 'National Eligibility cum Entrance Test — Medical. NCERT-based, concept clarity, direct formula application.',
    category: 'medical',
    durationMinutes: 200,
  },
] as const;

export const SUBJECTS = [
  { slug: 'physics',    name: 'Physics',    description: 'Study of matter, energy, and the fundamental forces of nature.' },
  { slug: 'chemistry',  name: 'Chemistry',  description: 'Study of matter, its properties, and chemical reactions.' },
  { slug: 'mathematics',name: 'Mathematics',description: 'Study of numbers, quantity, structure, and change.' },
  { slug: 'botany',     name: 'Botany',     description: 'Study of plants, their structure, growth, and classification.' },
  { slug: 'zoology',    name: 'Zoology',    description: 'Study of animals, their physiology, behaviour, and classification.' },
] as const;

// Which subjects map to which exams
export const EXAM_SUBJECT_MAP: Record<string, string[]> = {
  jee:  ['physics', 'chemistry', 'mathematics'],
  neet: ['physics', 'chemistry', 'botany', 'zoology'],
};

// ─── Topics (exam-scoped) ─────────────────────────────────────
// Key format: `${examSlug}:${subjectSlug}`
// Style notes are passed to Gemini to calibrate question difficulty.

export interface TopicDef {
  slug: string;
  displayName: string;
  style: string; // Gemini prompt hint about question style for this topic in this exam
}

export const TOPICS: Record<string, TopicDef[]> = {

  // ── JEE Physics ──────────────────────────────────────────────
  'jee:physics': [
    { slug: 'kinematics',              displayName: 'Kinematics',                      style: 'multi-step projectile, relative motion, calculus-based' },
    { slug: 'laws-of-motion',          displayName: 'Laws of Motion',                  style: 'constraint equations, pseudo forces, complex pulley systems' },
    { slug: 'work-energy-power',       displayName: 'Work, Energy & Power',            style: 'variable force integration, potential energy curves, work-energy theorem applications' },
    { slug: 'rotational-motion',       displayName: 'Rotational Motion',               style: 'moment of inertia derivations, rolling dynamics, angular impulse' },
    { slug: 'gravitation',             displayName: 'Gravitation',                     style: 'orbital mechanics, escape velocity derivations, gravitational potential energy' },
    { slug: 'properties-of-matter',   displayName: 'Properties of Solids & Fluids',   style: 'Bernoulli complex applications, viscosity, surface tension derivations' },
    { slug: 'thermodynamics',          displayName: 'Thermodynamics',                  style: 'cyclic processes, entropy calculations, PV diagrams analysis' },
    { slug: 'kinetic-theory',          displayName: 'Kinetic Theory of Gases',         style: 'RMS speed derivations, degrees of freedom, Maxwell distribution' },
    { slug: 'oscillations-waves',      displayName: 'Oscillations & Waves',            style: 'superposition, beats, Doppler with moving medium, resonance' },
    { slug: 'electrostatics',          displayName: 'Electrostatics',                  style: 'Gauss law applications, complex geometry, multipole, conductors' },
    { slug: 'current-electricity',     displayName: 'Current Electricity',             style: 'complex Kirchhoff networks, Wheatstone variations, meter bridge' },
    { slug: 'magnetic-effects',        displayName: 'Magnetic Effects of Current',     style: 'Biot-Savart complex geometry, solenoid derivations, force on current' },
    { slug: 'electromagnetic-induction', displayName: 'Electromagnetic Induction',    style: 'AC circuits LCR, power factor, transformer, self/mutual inductance' },
    { slug: 'optics',                  displayName: 'Optics',                          style: 'wave optics, interference patterns, diffraction, thin film' },
    { slug: 'modern-physics',          displayName: 'Modern Physics',                  style: 'photoelectric effect, nuclear physics, X-rays, de Broglie, radioactivity' },
  ],

  // ── NEET Physics ─────────────────────────────────────────────
  'neet:physics': [
    { slug: 'kinematics',              displayName: 'Kinematics',                      style: 'direct formula: range, time of flight, max height; NCERT-level' },
    { slug: 'laws-of-motion',          displayName: 'Laws of Motion',                  style: 'free body diagrams, friction, basic pulley, Newton\'s laws direct application' },
    { slug: 'work-energy-power',       displayName: 'Work, Energy & Power',            style: 'conservation of energy, basic collision, work-energy theorem direct' },
    { slug: 'rotational-motion',       displayName: 'Rotational Motion',               style: 'moment of inertia standard shapes, angular momentum, torque basics' },
    { slug: 'gravitation',             displayName: 'Gravitation',                     style: 'Kepler\'s laws, gravitational potential direct formula, escape velocity' },
    { slug: 'properties-of-matter',   displayName: 'Properties of Solids & Fluids',   style: 'surface tension, Stokes\' law, Pascal\'s law, Archimedes\' principle' },
    { slug: 'thermodynamics',          displayName: 'Thermodynamics',                  style: 'first & second law, Carnot engine efficiency, PV diagrams basic' },
    { slug: 'kinetic-theory',          displayName: 'Kinetic Theory of Gases',         style: 'ideal gas law, RMS/average/most probable speed formula direct' },
    { slug: 'oscillations-waves',      displayName: 'Oscillations & Waves',            style: 'SHM basics, wave equation, sound waves, resonance in pipes/strings' },
    { slug: 'electrostatics',          displayName: 'Electrostatics',                  style: 'Coulomb\'s law, electric field, potential direct, NCERT-style' },
    { slug: 'current-electricity',     displayName: 'Current Electricity',             style: 'Ohm\'s law, series/parallel, Kirchhoff\'s basic, potentiometer' },
    { slug: 'magnetic-effects',        displayName: 'Magnetic Effects of Current',     style: 'Biot-Savart simple cases, solenoid, moving charges in field' },
    { slug: 'electromagnetic-induction', displayName: 'Electromagnetic Induction',    style: 'Faraday\'s law, Lenz\'s law, self/mutual inductance, AC basics' },
    { slug: 'optics',                  displayName: 'Optics',                          style: 'reflection, refraction, lens/mirror formula, TIR, prism NCERT' },
    { slug: 'modern-physics',          displayName: 'Modern Physics',                  style: 'photoelectric effect, Bohr model, radioactive decay, NCERT direct' },
  ],

  // ── JEE Chemistry ────────────────────────────────────────────
  'jee:chemistry': [
    { slug: 'atomic-structure',        displayName: 'Atomic Structure',                style: 'quantum numbers, Schrödinger equation concepts, complex electronic configurations' },
    { slug: 'chemical-bonding',        displayName: 'Chemical Bonding',                style: 'MOT diagrams, hybridization edge cases, Fajan\'s rule, lattice energy' },
    { slug: 'states-of-matter',        displayName: 'States of Matter',                style: 'real gas equations, Van der Waals, critical constants, liquefaction' },
    { slug: 'thermodynamics',          displayName: 'Chemical Thermodynamics',         style: 'Hess\'s law complex chains, Born-Haber cycle, entropy calculations, Gibbs energy' },
    { slug: 'equilibrium',             displayName: 'Chemical Equilibrium',            style: 'simultaneous equilibria, degree of dissociation, Kp/Kc complex' },
    { slug: 'ionic-equilibrium',       displayName: 'Ionic Equilibrium',               style: 'buffer capacity, solubility product, common ion effect, polyprotic acids' },
    { slug: 'electrochemistry',        displayName: 'Redox & Electrochemistry',        style: 'complex cell EMF, Nernst equation, electrolysis calculations, conductance' },
    { slug: 'chemical-kinetics',       displayName: 'Chemical Kinetics',               style: 'integrated rate laws, Arrhenius equation complex, mechanisms, half-life' },
    { slug: 'solutions',               displayName: 'Solutions',                       style: 'colligative properties with Van\'t Hoff factor, azeotropes, Henry\'s law' },
    { slug: 'organic-basics',          displayName: 'Organic Chemistry — Basics',      style: 'GOC, IUPAC naming edge cases, isomerism types, inductive/resonance effects' },
    { slug: 'organic-reactions',       displayName: 'Organic Chemistry — Reactions',   style: 'named reactions, reagent selection, multi-step synthesis, stereochemistry' },
    { slug: 'coordination-chemistry',  displayName: 'Coordination Chemistry',          style: 'CFT, isomerism, stability constants, EAN rule, colour and magnetism' },
    { slug: 'periodic-d-block',        displayName: 'Periodic Table & Block Elements', style: 'complex trend analysis, metallurgy, transition metal chemistry, lanthanides' },
    { slug: 'surface-polymers',        displayName: 'Surface Chemistry & Polymers',    style: 'adsorption isotherms, catalysis mechanisms, polymer classification, rubber' },
  ],

  // ── NEET Chemistry ───────────────────────────────────────────
  'neet:chemistry': [
    { slug: 'atomic-structure',        displayName: 'Atomic Structure',                style: 'Bohr model, quantum numbers direct, electronic configuration NCERT' },
    { slug: 'chemical-bonding',        displayName: 'Chemical Bonding',                style: 'VSEPR shapes, hybridization standard, bond parameters, H-bonding' },
    { slug: 'states-of-matter',        displayName: 'States of Matter',                style: 'ideal gas law, Graham\'s law, vapour pressure, NCERT-direct' },
    { slug: 'thermodynamics',          displayName: 'Chemical Thermodynamics',         style: 'enthalpy, Hess\'s law simple, spontaneity, NCERT-level problems' },
    { slug: 'equilibrium',             displayName: 'Chemical Equilibrium',            style: 'Le Chatelier, Kp/Kc relationship, equilibrium constants direct' },
    { slug: 'ionic-equilibrium',       displayName: 'Ionic Equilibrium',               style: 'pH, buffer solutions, Henderson-Hasselbalch direct, indicators' },
    { slug: 'electrochemistry',        displayName: 'Redox & Electrochemistry',        style: 'balancing redox, standard electrode potential, Faraday\'s laws direct' },
    { slug: 'chemical-kinetics',       displayName: 'Chemical Kinetics',               style: 'rate law, order of reaction, half-life formula direct, NCERT examples' },
    { slug: 'solutions',               displayName: 'Solutions',                       style: 'Raoult\'s law, molality/molarity, osmotic pressure, NCERT problems' },
    { slug: 'organic-basics',          displayName: 'Organic Chemistry — Basics',      style: 'IUPAC, isomerism, inductive/resonance effects, NCERT-level GOC' },
    { slug: 'organic-reactions',       displayName: 'Organic Chemistry — Reactions',   style: 'named reactions NCERT list, functional group transformations, mechanisms basic' },
    { slug: 'coordination-chemistry',  displayName: 'Coordination Chemistry',          style: 'Werner\'s theory, nomenclature, bonding basic, isomerism types' },
    { slug: 'periodic-d-block',        displayName: 'Periodic Table & Block Elements', style: 'periodic trends, group properties, important compounds NCERT' },
    { slug: 'biomolecules',            displayName: 'Biomolecules & Chemistry in Life', style: 'carbohydrates, amino acids, vitamins, drugs, NCERT chapter direct' },
  ],

  // ── JEE Mathematics ──────────────────────────────────────────
  'jee:mathematics': [
    { slug: 'sets-relations-functions',  displayName: 'Sets, Relations & Functions',      style: 'domain/range complex, composition, invertibility, modular functions' },
    { slug: 'complex-numbers',           displayName: 'Complex Numbers',                  style: 'argument, modulus, polar form, De Moivre\'s theorem, roots of unity' },
    { slug: 'quadratic-equations',       displayName: 'Quadratic Equations',              style: 'nature of roots, symmetric functions, parametric analysis' },
    { slug: 'permutations-combinations', displayName: 'Permutations & Combinations',     style: 'complex arrangements, circular permutation, derangement' },
    { slug: 'binomial-theorem',          displayName: 'Binomial Theorem',                 style: 'general term, middle term, coefficient problems, multinomial' },
    { slug: 'sequences-series',          displayName: 'Sequences & Series',               style: 'AP/GP/HP, AGP, telescoping, sum to n terms' },
    { slug: 'matrices-determinants',     displayName: 'Matrices & Determinants',          style: 'inverse, rank, Cayley-Hamilton, system of equations analysis' },
    { slug: 'limits-continuity',         displayName: 'Limits, Continuity & Differentiability', style: 'L\'Hopital, sandwich theorem, continuity analysis, differentiability at a point' },
    { slug: 'differentiation',           displayName: 'Differentiation & Applications',   style: 'implicit, parametric, higher order, maxima/minima, tangent/normal' },
    { slug: 'integration',               displayName: 'Integration',                      style: 'substitution, by parts, partial fractions, definite integral properties' },
    { slug: 'differential-equations',    displayName: 'Differential Equations',           style: 'variable separable, homogeneous, linear first order, Bernoulli' },
    { slug: 'coordinate-geometry',       displayName: 'Coordinate Geometry',              style: 'circle, parabola, ellipse, hyperbola — tangent, normal, chord of contact' },
    { slug: '3d-geometry-vectors',       displayName: '3D Geometry & Vectors',            style: 'dot/cross product, planes, lines in 3D, skew lines, direction cosines' },
    { slug: 'probability-statistics',    displayName: 'Probability & Statistics',         style: 'Bayes theorem, probability distributions, mean/variance, conditional' },
    { slug: 'trigonometry',              displayName: 'Trigonometry',                     style: 'inverse trig, equations, properties of triangle, identities' },
    { slug: 'mathematical-reasoning',    displayName: 'Mathematical Reasoning',           style: 'statements, logical connectives, contrapositive, tautology' },
  ],

  // ── NEET Botany ──────────────────────────────────────────────
  'neet:botany': [
    { slug: 'living-world',              displayName: 'The Living World',                 style: 'characteristics of living organisms, taxonomy, binomial nomenclature NCERT' },
    { slug: 'biological-classification', displayName: 'Biological Classification',        style: 'five kingdom classification, viruses, lichens, NCERT direct recall' },
    { slug: 'plant-kingdom',             displayName: 'Plant Kingdom',                   style: 'algae, bryophytes, pteridophytes, gymnosperms, angiosperms NCERT' },
    { slug: 'morphology-plants',         displayName: 'Morphology of Flowering Plants',   style: 'root, stem, leaf, flower, fruit, seed — NCERT examples and diagrams' },
    { slug: 'anatomy-plants',            displayName: 'Anatomy of Flowering Plants',      style: 'tissues, meristems, vascular bundles — cross-section diagrams NCERT' },
    { slug: 'cell-biology',              displayName: 'Cell Biology',                    style: 'cell organelles, cell wall, membrane structure, NCERT-level MCQs' },
    { slug: 'cell-division',             displayName: 'Cell Division',                   style: 'mitosis, meiosis stages, significance, NCERT diagrams' },
    { slug: 'photosynthesis',            displayName: 'Photosynthesis',                  style: 'light reactions, Calvin cycle, C3/C4 plants, factors NCERT' },
    { slug: 'respiration-plants',        displayName: 'Respiration in Plants',            style: 'glycolysis, Krebs cycle, ETC, fermentation, RQ NCERT' },
    { slug: 'plant-growth',              displayName: 'Plant Growth & Development',       style: 'growth regulators, photoperiodism, vernalization NCERT' },
    { slug: 'plant-reproduction',        displayName: 'Plant Reproduction',              style: 'vegetative, sexual reproduction in flowering plants, double fertilization' },
    { slug: 'genetics-heredity',         displayName: 'Genetics & Heredity',             style: 'Mendel\'s laws, incomplete dominance, codominance, chromosomal theory' },
    { slug: 'molecular-biology',         displayName: 'Molecular Biology',               style: 'DNA structure, replication, transcription, translation, genetic code' },
    { slug: 'biotechnology',             displayName: 'Biotechnology',                   style: 'recombinant DNA, PCR, transgenic organisms, applications NCERT' },
    { slug: 'ecology',                   displayName: 'Ecology & Environment',           style: 'ecosystems, biodiversity, environmental issues, population dynamics NCERT' },
  ],

  // ── NEET Zoology ─────────────────────────────────────────────
  'neet:zoology': [
    { slug: 'animal-kingdom',            displayName: 'Animal Kingdom',                  style: 'classification, phyla characteristics, NCERT examples' },
    { slug: 'structural-organisation',   displayName: 'Structural Organisation in Animals', style: 'tissues, organ systems, cockroach/frog/earthworm NCERT' },
    { slug: 'biomolecules',              displayName: 'Biomolecules',                    style: 'carbohydrates, proteins, lipids, nucleic acids structure and function NCERT' },
    { slug: 'digestion-absorption',      displayName: 'Digestion & Absorption',          style: 'alimentary canal, digestive glands, enzymes, disorders NCERT' },
    { slug: 'breathing-exchange',        displayName: 'Breathing & Exchange of Gases',   style: 'respiratory system, mechanism, volumes, disorders NCERT' },
    { slug: 'body-fluids-circulation',   displayName: 'Body Fluids & Circulation',       style: 'blood, lymph, heart structure, cardiac cycle, ECG basics NCERT' },
    { slug: 'excretory-products',        displayName: 'Excretory Products & Elimination', style: 'kidney structure, urine formation, tubular functions, disorders NCERT' },
    { slug: 'locomotion-movement',       displayName: 'Locomotion & Movement',           style: 'muscle types, sliding filament theory, skeleton, joints NCERT' },
    { slug: 'neural-control',            displayName: 'Neural Control & Coordination',   style: 'neuron structure, action potential, CNS/PNS, reflex arc NCERT' },
    { slug: 'chemical-coordination',     displayName: 'Chemical Coordination & Integration', style: 'endocrine glands, hormones, mechanism of action NCERT' },
    { slug: 'human-reproduction',        displayName: 'Human Reproduction',              style: 'reproductive system, spermatogenesis, oogenesis, fertilization NCERT' },
    { slug: 'reproductive-health',       displayName: 'Reproductive Health',             style: 'STDs, contraception, IVF, amniocentesis, population control NCERT' },
    { slug: 'evolution',                 displayName: 'Evolution',                       style: 'origin of life, Darwin, Hardy-Weinberg, human evolution NCERT' },
    { slug: 'human-health-disease',      displayName: 'Human Health & Disease',          style: 'pathogens, immunity, vaccines, cancer, drug/alcohol abuse NCERT' },
    { slug: 'microbes-human-welfare',    displayName: 'Microbes in Human Welfare',       style: 'food production, biogas, sewage treatment, antibiotics NCERT' },
  ],
};

export const LEVELS = ['Beginner', 'Rookie', 'Skilled', 'Competent', 'Expert', 'Master'] as const;
export type Level = typeof LEVELS[number];

// Level calibration hints per exam (passed to Gemini for difficulty calibration)
export const LEVEL_HINTS: Record<string, Record<Level, string>> = {
  jee: {
    Beginner:  'Single concept, direct formula application. "Apply F=ma." No calculus needed.',
    Rookie:    'Two-step problem. Combine two concepts or formulas.',
    Skilled:   'Multi-step with mild mathematical rigor. Basic integration or vector decomposition.',
    Competent: 'JEE Mains difficulty. Multi-concept, requires 3-4 steps, time-pressure level.',
    Expert:    'JEE Advanced single-answer. Deep conceptual trap, unusual scenario, high rigor.',
    Master:    'JEE Advanced multi-step. Requires creative problem-solving and synthesis of 3+ concepts.',
  },
  neet: {
    Beginner:  'Direct NCERT recall. "What is the SI unit of force?" Textbook definition.',
    Rookie:    'Simple formula application. One-step calculation from NCERT examples.',
    Skilled:   'NCERT example-level. One-step calculation or basic conceptual MCQ.',
    Competent: 'NEET moderate difficulty. Slightly tricky wording, requires careful reading.',
    Expert:    'NEET high-difficulty. Multi-concept but still fully NCERT-derivable.',
    Master:    'Assertion-reason or tricky conceptual. Edge case within NCERT scope.',
  },
};
