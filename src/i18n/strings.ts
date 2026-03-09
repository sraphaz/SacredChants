export type Locale = 'en' | 'pt';

export const ui = {
  en: {
    nav: {
      home: 'Home',
      chants: 'Chants',
      traditions: 'Traditions',
      knowledge: 'Knowledge',
      contribute: 'Contribute',
    },
    home: {
      tagline: 'A living library of sacred sound traditions.',
      subtitle: 'Sacred chants, mantras, prayers, and devotional songs from different traditions.',
      browseChants: 'Browse chants',
      exploreTraditions: 'Explore traditions',
    },
    chants: {
      title: 'Chants',
      allChants: 'All chants',
      tradition: 'Tradition',
      language: 'Language',
      noChants: 'No chants yet.',
    },
    chant: {
      transliteration: 'Transliteration',
      translation: 'Translation',
      playAudio: 'Play audio',
      verse: 'Verse',
    },
    traditions: {
      title: 'Traditions',
      description: 'Explore sacred vocal traditions from around the world.',
    },
    knowledge: {
      title: 'Knowledge',
      description: 'Educational content about sacred sound traditions.',
    },
    contribute: {
      title: 'Contribute',
      description: 'How to add a new chant to the library.',
    },
    lang: {
      en: 'English',
      pt: 'Português',
    },
  },
  pt: {
    nav: {
      home: 'Início',
      chants: 'Cânticos',
      traditions: 'Tradições',
      knowledge: 'Conhecimento',
      contribute: 'Contribuir',
    },
    home: {
      tagline: 'Uma biblioteca viva das tradições do som sagrado.',
      subtitle: 'Cânticos sagrados, mantras, orações e canções devocionais de diferentes tradições.',
      browseChants: 'Explorar cânticos',
      exploreTraditions: 'Explorar tradições',
    },
    chants: {
      title: 'Cânticos',
      allChants: 'Todos os cânticos',
      tradition: 'Tradição',
      language: 'Idioma',
      noChants: 'Nenhum cântico ainda.',
    },
    chant: {
      transliteration: 'Transliteração',
      translation: 'Tradução',
      playAudio: 'Reproduzir áudio',
      verse: 'Verso',
    },
    traditions: {
      title: 'Tradições',
      description: 'Explore tradições vocais sagradas de todo o mundo.',
    },
    knowledge: {
      title: 'Conhecimento',
      description: 'Conteúdo educativo sobre tradições do som sagrado.',
    },
    contribute: {
      title: 'Contribuir',
      description: 'Como adicionar um novo cântico à biblioteca.',
    },
    lang: {
      en: 'English',
      pt: 'Português',
    },
  },
} as const;

export type UIStrings = typeof ui.en;
