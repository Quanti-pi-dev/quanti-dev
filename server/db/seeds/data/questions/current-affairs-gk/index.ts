import type { QuestionDef } from '../types.js';

export const currentAffairsGkQuestions: QuestionDef[] = [
  // ── Indian Polity & Governance ────────────────────────────────────────────────────────
  { 
    topicSlug: 'indian-polity-governance', level: 'Beginner',
    question: 'Who is the constitutional head of the Indian government?',
    options: [{id:'A',text:'Prime Minister'},{id:'B',text:'President'},{id:'C',text:'Chief Justice'},{id:'D',text:'Vice President'}],
    correctAnswerId: 'B', explanation: 'The President is the constitutional and executive head of India, though the Prime Minister holds the real executive power.', tags: ['Current Affairs & GK', 'indian-polity-governance', 'CLAT'] 
  },
  { 
    topicSlug: 'indian-polity-governance', level: 'Rookie',
    question: 'Which fundamental right in the Indian Constitution guarantees protection to life and personal liberty?',
    options: [{id:'A',text:'Article 14'},{id:'B',text:'Article 19'},{id:'C',text:'Article 21'},{id:'D',text:'Article 32'}],
    correctAnswerId: 'C', explanation: 'Article 21 of the Indian Constitution states that no person shall be deprived of his life or personal liberty except according to a procedure established by law.', tags: ['Current Affairs & GK', 'indian-polity-governance', 'CLAT'] 
  },
  { 
    topicSlug: 'indian-polity-governance', level: 'Skilled',
    question: 'The anti-defection law was added to the Indian Constitution by which amendment?',
    options: [{id:'A',text:'42nd Amendment'},{id:'B',text:'44th Amendment'},{id:'C',text:'52nd Amendment'},{id:'D',text:'73rd Amendment'}],
    correctAnswerId: 'C', explanation: 'The 52nd Amendment Act of 1985 added the Tenth Schedule, bringing in the anti-defection law to prevent elected officials from changing parties.', tags: ['Current Affairs & GK', 'indian-polity-governance', 'CLAT'] 
  },
  { 
    topicSlug: 'indian-polity-governance', level: 'Competent',
    question: 'What is the maximum gap allowed between two sessions of the Indian Parliament?',
    options: [{id:'A',text:'3 months'},{id:'B',text:'4 months'},{id:'C',text:'6 months'},{id:'D',text:'1 year'}],
    correctAnswerId: 'C', explanation: 'According to Article 85(1) of the Constitution, the maximum gap between two sessions of Parliament cannot exceed six months.', tags: ['Current Affairs & GK', 'indian-polity-governance', 'CLAT'] 
  },
  { 
    topicSlug: 'indian-polity-governance', level: 'Expert',
    question: 'In India, the power to promulgate ordinances during the recess of Parliament is vested in the:',
    options: [{id:'A',text:'Prime Minister'},{id:'B',text:'Speaker of Lok Sabha'},{id:'C',text:'President'},{id:'D',text:'Chief Justice of India'}],
    correctAnswerId: 'C', explanation: 'Under Article 123, the President has the legislative power to promulgate ordinances when either of the Houses of Parliament is not in session.', tags: ['Current Affairs & GK', 'indian-polity-governance', 'CLAT'] 
  },
  { 
    topicSlug: 'indian-polity-governance', level: 'Master',
    question: 'Which landmark Supreme Court judgment established that the doctrine of Basic Structure applies to constitutional amendments?',
    options: [{id:'A',text:'Golaknath Case'},{id:'B',text:'Kesavananda Bharati Case'},{id:'C',text:'Minerva Mills Case'},{id:'D',text:'S.R. Bommai Case'}],
    correctAnswerId: 'B', explanation: 'The Kesavananda Bharati v. State of Kerala (1973) case established the Basic Structure doctrine, limiting Parliament\'s amending power.', tags: ['Current Affairs & GK', 'indian-polity-governance', 'CLAT'] 
  },

  // ── Economy & Business ────────────────────────────────────────────────────────────────
  { 
    topicSlug: 'economy-business', level: 'Beginner',
    question: 'What does GDP stand for in economics?',
    options: [{id:'A',text:'Gross Domestic Product'},{id:'B',text:'Global Development Product'},{id:'C',text:'Gross Domestic Price'},{id:'D',text:'Global Domestic Policy'}],
    correctAnswerId: 'A', explanation: 'Gross Domestic Product (GDP) represents the total monetary value of all final goods and services produced within a country over a specific period.', tags: ['Current Affairs & GK', 'economy-business', 'CLAT'] 
  },
  { 
    topicSlug: 'economy-business', level: 'Rookie',
    question: 'Which institution acts as the central bank of India?',
    options: [{id:'A',text:'State Bank of India (SBI)'},{id:'B',text:'Reserve Bank of India (RBI)'},{id:'C',text:'Ministry of Finance'},{id:'D',text:'Securities and Exchange Board of India (SEBI)'}],
    correctAnswerId: 'B', explanation: 'The Reserve Bank of India (RBI) is India\'s central bank and regulatory body responsible for the regulation of the Indian banking system.', tags: ['Current Affairs & GK', 'economy-business', 'CLAT'] 
  },
  { 
    topicSlug: 'economy-business', level: 'Skilled',
    question: 'The term "Repo Rate" refers to:',
    options: [{id:'A',text:'The rate at which banks lend to public'},{id:'B',text:'The rate at which the RBI lends to commercial banks'},{id:'C',text:'The rate at which commercial banks park excess funds with RBI'},{id:'D',text:'The tax rate applied on repossession of property'}],
    correctAnswerId: 'B', explanation: 'Repo Rate, or Repurchasing Option Rate, is the interest rate at which the RBI lends short-term money to commercial banks to control inflation.', tags: ['Current Affairs & GK', 'economy-business', 'CLAT'] 
  },
  { 
    topicSlug: 'economy-business', level: 'Competent',
    question: 'A situation in a market where there is only one buyer but many sellers is called:',
    options: [{id:'A',text:'Monopoly'},{id:'B',text:'Oligopoly'},{id:'C',text:'Monopsony'},{id:'D',text:'Perfect Competition'}],
    correctAnswerId: 'C', explanation: 'A monopsony is a market condition with a single buyer and multiple sellers, giving the buyer significant power to dictate prices.', tags: ['Current Affairs & GK', 'economy-business', 'CLAT'] 
  },
  { 
    topicSlug: 'economy-business', level: 'Expert',
    question: 'What is "Stagflation"?',
    options: [{id:'A',text:'High economic growth with low inflation'},{id:'B',text:'High inflation combined with high unemployment and stagnant demand'},{id:'C',text:'Deflation occurring after a prolonged period of inflation'},{id:'D',text:'Rapid currency devaluation during a financial crisis'}],
    correctAnswerId: 'B', explanation: 'Stagflation is an economic phenomenon defined by stagnant economic output, high unemployment, and high inflation.', tags: ['Current Affairs & GK', 'economy-business', 'CLAT'] 
  },
  { 
    topicSlug: 'economy-business', level: 'Master',
    question: 'Under the Insolvency and Bankruptcy Code (IBC) 2016, what is the standard time limit prescribed for completing the corporate insolvency resolution process (CIRP), excluding litigation time?',
    options: [{id:'A',text:'90 days'},{id:'B',text:'180 days'},{id:'C',text:'270 days'},{id:'D',text:'330 days'}],
    correctAnswerId: 'B', explanation: 'The IBC initially provided a 180-day timeline for CIRP, with a 90-day extension possible. An amendment later capped the total process, including litigation, at 330 days.', tags: ['Current Affairs & GK', 'economy-business', 'CLAT'] 
  },

  // ── International Affairs ─────────────────────────────────────────────────────────────
  { 
    topicSlug: 'international-affairs', level: 'Beginner',
    question: 'Which city hosts the headquarters of the United Nations?',
    options: [{id:'A',text:'Geneva'},{id:'B',text:'London'},{id:'C',text:'New York'},{id:'D',text:'Paris'}],
    correctAnswerId: 'C', explanation: 'The United Nations is headquartered in New York City.', tags: ['Current Affairs & GK', 'international-affairs', 'CLAT'] 
  },
  { 
    topicSlug: 'international-affairs', level: 'Rookie',
    question: 'How many permanent members sit on the UN Security Council?',
    options: [{id:'A',text:'5'},{id:'B',text:'10'},{id:'C',text:'15'},{id:'D',text:'20'}],
    correctAnswerId: 'A', explanation: 'The UNSC has 5 permanent members (P5): USA, UK, France, Russia, and China.', tags: ['Current Affairs & GK', 'international-affairs', 'CLAT'] 
  },
  { 
    topicSlug: 'international-affairs', level: 'Skilled',
    question: 'The BRICS acronym stands for Brazil, Russia, India, China, and:',
    options: [{id:'A',text:'South Korea'},{id:'B',text:'Singapore'},{id:'C',text:'South Africa'},{id:'D',text:'Spain'}],
    correctAnswerId: 'C', explanation: 'BRICS stands for Brazil, Russia, India, China, and South Africa, representing five major emerging national economies.', tags: ['Current Affairs & GK', 'international-affairs', 'CLAT'] 
  },
  { 
    topicSlug: 'international-affairs', level: 'Competent',
    question: 'What is the primary function of the International Court of Justice (ICJ)?',
    options: [{id:'A',text:'To prosecute individuals for war crimes'},{id:'B',text:'To settle legal disputes submitted by states and give advisory opinions'},{id:'C',text:'To draft international trade treaties'},{id:'D',text:'To govern the global financial system'}],
    correctAnswerId: 'B', explanation: 'The ICJ settles state-to-state legal disputes and provides advisory opinions to UN organs. The ICC (International Criminal Court) handles individual war crimes.', tags: ['Current Affairs & GK', 'international-affairs', 'CLAT'] 
  },
  { 
    topicSlug: 'international-affairs', level: 'Expert',
    question: 'Which treaty governs the exploration and use of outer space, declaring it the "province of all mankind"?',
    options: [{id:'A',text:'The Moon Agreement'},{id:'B',text:'The Outer Space Treaty'},{id:'C',text:'The Artemis Accords'},{id:'D',text:'The Bogota Declaration'}],
    correctAnswerId: 'B', explanation: 'The 1967 Outer Space Treaty forms the basis of international space law, prohibiting weapons of mass destruction in orbit and claiming of celestial bodies.', tags: ['Current Affairs & GK', 'international-affairs', 'CLAT'] 
  },
  { 
    topicSlug: 'international-affairs', level: 'Master',
    question: 'In international law, the "Estrada Doctrine" relates to:',
    options: [{id:'A',text:'Preemptive use of military force'},{id:'B',text:'Recognition of governments following a revolution'},{id:'C',text:'Exclusive economic zones in maritime law'},{id:'D',text:'Extradition of political prisoners'}],
    correctAnswerId: 'B', explanation: 'The Estrada Doctrine suggests foreign governments should not explicitly judge or recognize governments born out of revolution, but simply maintain or withdraw diplomatic envoys.', tags: ['Current Affairs & GK', 'international-affairs', 'CLAT'] 
  },

  // ── Science & Technology ──────────────────────────────────────────────────────────────
  { 
    topicSlug: 'science-technology', level: 'Beginner',
    question: 'Which gas is most abundant in the Earth\'s atmosphere?',
    options: [{id:'A',text:'Oxygen'},{id:'B',text:'Nitrogen'},{id:'C',text:'Carbon Dioxide'},{id:'D',text:'Hydrogen'}],
    correctAnswerId: 'B', explanation: 'Nitrogen makes up approximately 78% of the Earth\'s atmosphere.', tags: ['Current Affairs & GK', 'science-technology', 'CLAT'] 
  },
  { 
    topicSlug: 'science-technology', level: 'Rookie',
    question: 'What is the chemical formula for table salt?',
    options: [{id:'A',text:'H2O'},{id:'B',text:'CO2'},{id:'C',text:'NaCl'},{id:'D',text:'CaCO3'}],
    correctAnswerId: 'C', explanation: 'NaCl (Sodium Chloride) is the chemical name for common table salt.', tags: ['Current Affairs & GK', 'science-technology', 'CLAT'] 
  },
  { 
    topicSlug: 'science-technology', level: 'Skilled',
    question: 'Which agency is responsible for India\'s space research program?',
    options: [{id:'A',text:'DRDO'},{id:'B',text:'BARC'},{id:'C',text:'ISRO'},{id:'D',text:'HAL'}],
    correctAnswerId: 'C', explanation: 'The Indian Space Research Organisation (ISRO) is the national space agency of India.', tags: ['Current Affairs & GK', 'science-technology', 'CLAT'] 
  },
  { 
    topicSlug: 'science-technology', level: 'Competent',
    question: 'The process by which plants convert light energy into chemical energy is called:',
    options: [{id:'A',text:'Respiration'},{id:'B',text:'Transpiration'},{id:'C',text:'Photosynthesis'},{id:'D',text:'Fermentation'}],
    correctAnswerId: 'C', explanation: 'Photosynthesis is the process used by plants, algae, and certain bacteria to harness energy from sunlight and turn it into chemical energy.', tags: ['Current Affairs & GK', 'science-technology', 'CLAT'] 
  },
  { 
    topicSlug: 'science-technology', level: 'Expert',
    question: 'In quantum computing, what is the basic unit of information?',
    options: [{id:'A',text:'Bit'},{id:'B',text:'Byte'},{id:'C',text:'Qubit'},{id:'D',text:'Neuron'}],
    correctAnswerId: 'C', explanation: 'A qubit (quantum bit) is the basic unit of quantum information, capable of representing a 0, a 1, or both simultaneously via superposition.', tags: ['Current Affairs & GK', 'science-technology', 'CLAT'] 
  },
  { 
    topicSlug: 'science-technology', level: 'Master',
    question: 'What is the function of CRISPR-Cas9 in genetic engineering?',
    options: [{id:'A',text:'To sequence entire genomes rapidly'},{id:'B',text:'To act as a molecular vector for protein delivery'},{id:'C',text:'To precisely edit DNA by cutting at specific locations'},{id:'D',text:'To stimulate artificial cell division'}],
    correctAnswerId: 'C', explanation: 'CRISPR-Cas9 acts like molecular "scissors" to cut DNA at a specific targeted location, allowing genetic material to be added, removed, or altered.', tags: ['Current Affairs & GK', 'science-technology', 'CLAT'] 
  },

  // ── Sports & Awards ───────────────────────────────────────────────────────────────────
  { 
    topicSlug: 'sports-awards', level: 'Beginner',
    question: 'Which sport is associated with the term "Grand Slam"?',
    options: [{id:'A',text:'Football'},{id:'B',text:'Cricket'},{id:'C',text:'Tennis'},{id:'D',text:'Hockey'}],
    correctAnswerId: 'C', explanation: 'In Tennis, a Grand Slam refers to winning all four major championships (Australian Open, French Open, Wimbledon, US Open).', tags: ['Current Affairs & GK', 'sports-awards', 'CLAT'] 
  },
  { 
    topicSlug: 'sports-awards', level: 'Rookie',
    question: 'In which city were the first modern Olympic Games held in 1896?',
    options: [{id:'A',text:'London'},{id:'B',text:'Paris'},{id:'C',text:'Athens'},{id:'D',text:'Rome'}],
    correctAnswerId: 'C', explanation: 'The first modern Olympics were held in Athens, Greece, in 1896.', tags: ['Current Affairs & GK', 'sports-awards', 'CLAT'] 
  },
  { 
    topicSlug: 'sports-awards', level: 'Skilled',
    question: 'Which country won the FIFA World Cup in 2022?',
    options: [{id:'A',text:'Brazil'},{id:'B',text:'France'},{id:'C',text:'Argentina'},{id:'D',text:'Germany'}],
    correctAnswerId: 'C', explanation: 'Argentina won the 2022 FIFA World Cup, defeating France in the final.', tags: ['Current Affairs & GK', 'sports-awards', 'CLAT'] 
  },
  { 
    topicSlug: 'sports-awards', level: 'Competent',
    question: 'The highest sporting honour in India is the:',
    options: [{id:'A',text:'Arjuna Award'},{id:'B',text:'Dronacharya Award'},{id:'C',text:'Major Dhyan Chand Khel Ratna'},{id:'D',text:'Padma Shri'}],
    correctAnswerId: 'C', explanation: 'The Major Dhyan Chand Khel Ratna is the highest sporting honour of India, awarded for spectacular performance in sports over four years.', tags: ['Current Affairs & GK', 'sports-awards', 'CLAT'] 
  },
  { 
    topicSlug: 'sports-awards', level: 'Expert',
    question: 'Which author became the first to win the International Booker Prize for a novel translated from Hindi?',
    options: [{id:'A',text:'Geetanjali Shree'},{id:'B',text:'Arundhati Roy'},{id:'C',text:'Kiran Desai'},{id:'D',text:'Aravind Adiga'}],
    correctAnswerId: 'A', explanation: 'Geetanjali Shree won the International Booker Prize in 2022 for her novel "Tomb of Sand" (Ret Samadhi), translated by Daisy Rockwell.', tags: ['Current Affairs & GK', 'sports-awards', 'CLAT'] 
  },
  { 
    topicSlug: 'sports-awards', level: 'Master',
    question: 'In chess, what name is given to the rating system used to calculate the relative skill levels of players?',
    options: [{id:'A',text:'Swiss System'},{id:'B',text:'FIDE System'},{id:'C',text:'Elo Rating System'},{id:'D',text:'Kasparov Metric'}],
    correctAnswerId: 'C', explanation: 'The Elo rating system, invented by Arpad Elo, is the standard method for calculating the relative strength of players in zero-sum games like chess.', tags: ['Current Affairs & GK', 'sports-awards', 'CLAT'] 
  },

  // ── History, Art & Culture ────────────────────────────────────────────────────────────
  { 
    topicSlug: 'history-art-culture', level: 'Beginner',
    question: 'Who painted the Mona Lisa?',
    options: [{id:'A',text:'Vincent van Gogh'},{id:'B',text:'Pablo Picasso'},{id:'C',text:'Leonardo da Vinci'},{id:'D',text:'Michelangelo'}],
    correctAnswerId: 'C', explanation: 'The Mona Lisa was painted by the Italian Renaissance artist Leonardo da Vinci.', tags: ['Current Affairs & GK', 'history-art-culture', 'CLAT'] 
  },
  { 
    topicSlug: 'history-art-culture', level: 'Rookie',
    question: 'Which empire built the Taj Mahal?',
    options: [{id:'A',text:'Mauryan Empire'},{id:'B',text:'Mughal Empire'},{id:'C',text:'Gupta Empire'},{id:'D',text:'Maratha Empire'}],
    correctAnswerId: 'B', explanation: 'The Taj Mahal was commissioned in 1632 by the Mughal emperor Shah Jahan to house the tomb of his favorite wife, Mumtaz Mahal.', tags: ['Current Affairs & GK', 'history-art-culture', 'CLAT'] 
  },
  { 
    topicSlug: 'history-art-culture', level: 'Skilled',
    question: 'The famous "Dandi March" launched by Mahatma Gandhi in 1930 was against which tax?',
    options: [{id:'A',text:'Land Tax'},{id:'B',text:'Salt Tax'},{id:'C',text:'Water Tax'},{id:'D',text:'Income Tax'}],
    correctAnswerId: 'B', explanation: 'The Dandi March (Salt Satyagraha) was an act of nonviolent civil disobedience in colonial India protesting the British salt monopoly and taxes.', tags: ['Current Affairs & GK', 'history-art-culture', 'CLAT'] 
  },
  { 
    topicSlug: 'history-art-culture', level: 'Competent',
    question: 'Which ancient Indian text is considered the oldest surviving literature of Hinduism?',
    options: [{id:'A',text:'Bhagavad Gita'},{id:'B',text:'Ramayana'},{id:'C',text:'Rigveda'},{id:'D',text:'Upanishads'}],
    correctAnswerId: 'C', explanation: 'The Rigveda is an ancient Indian collection of Vedic Sanskrit hymns and is the oldest known Vedic Sanskrit text.', tags: ['Current Affairs & GK', 'history-art-culture', 'CLAT'] 
  },
  { 
    topicSlug: 'history-art-culture', level: 'Expert',
    question: 'Madhubani painting, also known as Mithila art, originates from which Indian state?',
    options: [{id:'A',text:'Rajasthan'},{id:'B',text:'Bihar'},{id:'C',text:'Gujarat'},{id:'D',text:'Odisha'}],
    correctAnswerId: 'B', explanation: 'Madhubani painting is a style of Indian painting originating in the Mithila region of India (primarily Bihar) and Nepal.', tags: ['Current Affairs & GK', 'history-art-culture', 'CLAT'] 
  },
  { 
    topicSlug: 'history-art-culture', level: 'Master',
    question: 'The Harappan period script (Indus Valley Civilization script) is primarily:',
    options: [{id:'A',text:'Alphabetic'},{id:'B',text:'Syllabic'},{id:'C',text:'Logographic'},{id:'D',text:'Undeciphered, largely believed to be logo-syllabic'}],
    correctAnswerId: 'D', explanation: 'The Indus script remains undeciphered, though scholars widely believe it to be logo-syllabic, using symbols to represent both words and syllables.', tags: ['Current Affairs & GK', 'history-art-culture', 'CLAT'] 
  },

  // ── Environment & Ecology ─────────────────────────────────────────────────────────────
  { 
    topicSlug: 'environment-ecology', level: 'Beginner',
    question: 'What is the process of cutting down or clearing wide areas of trees called?',
    options: [{id:'A',text:'Afforestation'},{id:'B',text:'Deforestation'},{id:'C',text:'Erosion'},{id:'D',text:'Logging'}],
    correctAnswerId: 'B', explanation: 'Deforestation refers to the decrease in forest areas across the world that are lost for other uses such as agricultural croplands or urbanization.', tags: ['Current Affairs & GK', 'environment-ecology', 'CLAT'] 
  },
  { 
    topicSlug: 'environment-ecology', level: 'Rookie',
    question: 'The "Ozone Layer" protects the Earth from which of the following?',
    options: [{id:'A',text:'Infrared rays'},{id:'B',text:'Microwaves'},{id:'C',text:'Ultraviolet (UV) radiation'},{id:'D',text:'X-rays'}],
    correctAnswerId: 'C', explanation: 'The ozone layer absorbs most of the Sun\'s harmful ultraviolet (UV) radiation, protecting life on Earth.', tags: ['Current Affairs & GK', 'environment-ecology', 'CLAT'] 
  },
  { 
    topicSlug: 'environment-ecology', level: 'Skilled',
    question: 'Which international treaty was signed in 1997 to commit state parties to reduce greenhouse gas emissions?',
    options: [{id:'A',text:'Montreal Protocol'},{id:'B',text:'Kyoto Protocol'},{id:'C',text:'Paris Agreement'},{id:'D',text:'Geneva Convention'}],
    correctAnswerId: 'B', explanation: 'The Kyoto Protocol (adopted in 1997) implemented the objective of the UNFCCC to reduce the onset of global warming by reducing greenhouse gas concentrations.', tags: ['Current Affairs & GK', 'environment-ecology', 'CLAT'] 
  },
  { 
    topicSlug: 'environment-ecology', level: 'Competent',
    question: 'The term "Biomagnification" refers to:',
    options: [{id:'A',text:'The increasing concentration of a substance, such as a toxic chemical, in the tissues of organisms at successively higher levels in a food chain'},{id:'B',text:'The rapid growth of invasive plant species in a wetland'},{id:'C',text:'The process of using bacteria to clean up oil spills'},{id:'D',text:'The enlargement of an ecosystem\'s boundary over time'}],
    correctAnswerId: 'A', explanation: 'Biomagnification occurs when the concentration of a toxin increases up the food chain, often affecting apex predators the most.', tags: ['Current Affairs & GK', 'environment-ecology', 'CLAT'] 
  },
  { 
    topicSlug: 'environment-ecology', level: 'Expert',
    question: 'In ecology, what describes an organism that has a disproportionately large effect on its environment relative to its abundance?',
    options: [{id:'A',text:'Apex predator'},{id:'B',text:'Endemic species'},{id:'C',text:'Keystone species'},{id:'D',text:'Indicator species'}],
    correctAnswerId: 'C', explanation: 'A keystone species plays a unique and crucial role in the way an ecosystem functions; without them, the ecosystem would be dramatically different or cease to exist.', tags: ['Current Affairs & GK', 'environment-ecology', 'CLAT'] 
  },
  { 
    topicSlug: 'environment-ecology', level: 'Master',
    question: 'The "Red Data Book" which contains lists of species whose continued existence is threatened, is published by:',
    options: [{id:'A',text:'WWF (World Wide Fund for Nature)'},{id:'B',text:'UNEP (UN Environment Programme)'},{id:'C',text:'IUCN (International Union for Conservation of Nature)'},{id:'D',text:'Greenpeace'}],
    correctAnswerId: 'C', explanation: 'The IUCN Red List of Threatened Species, founded in 1964, is the world\'s most comprehensive inventory of the global conservation status of biological species.', tags: ['Current Affairs & GK', 'environment-ecology', 'CLAT'] 
  },

  // ── Legal & Social Issues ─────────────────────────────────────────────────────────────
  { 
    topicSlug: 'legal-social-issues', level: 'Beginner',
    question: 'The Right to Information (RTI) Act allows Indian citizens to:',
    options: [{id:'A',text:'Request information from public authorities'},{id:'B',text:'Demand free legal counsel'},{id:'C',text:'Access classified military secrets'},{id:'D',text:'View tax returns of private citizens'}],
    correctAnswerId: 'A', explanation: 'The RTI Act, 2005 mandates timely responses to citizen requests for government information from public authorities.', tags: ['Current Affairs & GK', 'legal-social-issues', 'CLAT'] 
  },
  { 
    topicSlug: 'legal-social-issues', level: 'Rookie',
    question: 'Which constitutional body in India conducts elections for the Lok Sabha and State Legislative Assemblies?',
    options: [{id:'A',text:'NITI Aayog'},{id:'B',text:'Supreme Court'},{id:'C',text:'Election Commission of India'},{id:'D',text:'Finance Commission'}],
    correctAnswerId: 'C', explanation: 'The Election Commission of India (ECI) is an autonomous constitutional authority responsible for administering election processes in India at the national and state levels.', tags: ['Current Affairs & GK', 'legal-social-issues', 'CLAT'] 
  },
  { 
    topicSlug: 'legal-social-issues', level: 'Skilled',
    question: 'Who is known as the "Father of the Indian Constitution"?',
    options: [{id:'A',text:'Jawaharlal Nehru'},{id:'B',text:'Mahatma Gandhi'},{id:'C',text:'B. R. Ambedkar'},{id:'D',text:'Sardar Vallabhbhai Patel'}],
    correctAnswerId: 'C', explanation: 'Dr. B. R. Ambedkar is recognized as the Father of the Indian Constitution for his pivotal role as the Chairman of the Drafting Committee.', tags: ['Current Affairs & GK', 'legal-social-issues', 'CLAT'] 
  },
  { 
    topicSlug: 'legal-social-issues', level: 'Competent',
    question: 'The "Vishaka Guidelines" laid down by the Supreme Court deal with:',
    options: [{id:'A',text:'Guidelines for prison reforms'},{id:'B',text:'Prevention of sexual harassment of women at the workplace'},{id:'C',text:'Regulations for managing e-waste'},{id:'D',text:'Police interrogation protocols'}],
    correctAnswerId: 'B', explanation: 'The Vishaka Guidelines (1997) were superseded by the POSH Act, 2013, but they established the foundational legal framework against workplace sexual harassment.', tags: ['Current Affairs & GK', 'legal-social-issues', 'CLAT'] 
  },
  { 
    topicSlug: 'legal-social-issues', level: 'Expert',
    question: 'Which constitutional amendment established the National Commission for Backward Classes (NCBC) as a constitutional body?',
    options: [{id:'A',text:'101st Amendment'},{id:'B',text:'102nd Amendment'},{id:'C',text:'103rd Amendment'},{id:'D',text:'104th Amendment'}],
    correctAnswerId: 'B', explanation: 'The 102nd Constitution Amendment Act of 2018 granted constitutional status to the National Commission for Backward Classes under Article 338B.', tags: ['Current Affairs & GK', 'legal-social-issues', 'CLAT'] 
  },
  { 
    topicSlug: 'legal-social-issues', level: 'Master',
    question: 'The landmark Navtej Singh Johar v. Union of India (2018) Supreme Court judgement resulted in:',
    options: [{id:'A',text:'Decriminalization of adultery'},{id:'B',text:'Recognition of the right to privacy as a fundamental right'},{id:'C',text:'Decriminalization of consensual homosexual sex by striking down parts of Section 377 IPC'},{id:'D',text:'Abolition of the practice of Triple Talaq'}],
    correctAnswerId: 'C', explanation: 'In 2018, a five-judge bench unanimously struck down the portion of Section 377 IPC that criminalized consensual same-sex acts between adults.', tags: ['Current Affairs & GK', 'legal-social-issues', 'CLAT'] 
  }
];
