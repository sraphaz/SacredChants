/**
 * Per-locale SEO meta descriptions and layout accessibility strings.
 * Keeps `<meta name="description">` and key aria-labels aligned with `?lang=`.
 */
import type { Locale } from './strings';

export type KnowledgeArticleSeoKey =
  | 'nadaYoga'
  | 'vibrationMind'
  | 'elementsAndSound'
  | 'soundAttributes'
  | 'balanceAndHealing'
  | 'soundAndHumanity'
  | 'references';

export type PageSeoBundle = {
  /** BaseLayout fallback when a page omits `description` */
  siteDefaultDescription: string;
  homeDescription: string;
  chantsIndexDescription: string;
  knowledge: Record<KnowledgeArticleSeoKey, string>;
  mainNavAriaLabel: string;
  localeSelectAriaLabel: string;
  openMenuAriaLabel: string;
  siteMenuAriaLabel: string;
  footerLine: string;
};

export const PAGE_SEO: Record<Locale, PageSeoBundle> = {
  en: {
    siteDefaultDescription:
      'Human heritage in sound. A living library of sacred chant — preserving access to the inner states of consciousness that sacred sound opens.',
    homeDescription:
      "A living library of humanity's spiritual sound heritage. Sacred chants, mantras, hymns and prayers from different traditions — preserved and shared for listening, reflection and reconnection.",
    chantsIndexDescription: 'Browse all sacred chants in the library.',
    knowledge: {
      nadaYoga:
        'Nada Yoga: the yoga of sound and vibration. Definition, āhata and anāhata sound, classical references.',
      vibrationMind:
        'How sound vibrations affect the mind instrument; resonance, intention, and the audible and inaudible.',
      elementsAndSound:
        'Panchamahabhuta: the five elements and how they relate to sound. Ākāśa and śabda; balance and harmony.',
      soundAttributes:
        'Pitch, volume, timbre, and how sound attributes relate to the five elements and harmonise the listener.',
      balanceAndHealing:
        'The distinction between momentary balance and deeper healing. Sacred sound, ego dissolution, and contact with integral being.',
      soundAndHumanity:
        'Sound and humanity: how cultures across the world have cultivated song; sound in nature; the sacred and inner states channelled through sound.',
      references: 'References and further reading for Nada Yoga and the five elements.',
    },
    mainNavAriaLabel: 'Main',
    localeSelectAriaLabel: 'Language',
    openMenuAriaLabel: 'Open menu',
    siteMenuAriaLabel: 'Site menu',
    footerLine: 'Open source · No ads · Human heritage · Contemplative',
  },
  pt: {
    siteDefaultDescription:
      'Património humano em som. Uma biblioteca viva de cântico sagrado — preservar o acesso aos estados interiores que o som sagrado abre.',
    homeDescription:
      'Uma biblioteca viva do património sonoro espiritual da humanidade. Cânticos sagrados, mantras, hinos e orações de várias tradições — preservados e partilhados para escuta, reflexão e reconexão.',
    chantsIndexDescription: 'Explorar todos os cânticos sagrados da biblioteca.',
    knowledge: {
      nadaYoga:
        'Nada Yoga: o yoga do som e da vibração. Definição, som āhata e anāhata, referências clássicas.',
      vibrationMind:
        'Como as vibrações sonoras afetam o instrumento da mente; ressonância, intenção e o audível e inaudível.',
      elementsAndSound:
        'Panchamahabhuta: os cinco elementos e a sua relação com o som. Ākāśa e śabda; equilíbrio e harmonia.',
      soundAttributes:
        'Altura, volume, timbre e como os atributos do som se relacionam com os cinco elementos e harmonizam quem escuta.',
      balanceAndHealing:
        'A distinção entre equilíbrio momentâneo e cura mais profunda. Som sagrado, dissolução do ego e contacto com o ser integral.',
      soundAndHumanity:
        'Som e humanidade: como culturas no mundo cultivaram o canto; som na natureza; o sagrado e estados interiores canalizados pelo som.',
      references: 'Referências e leitura adicional sobre Nada Yoga e os cinco elementos.',
    },
    mainNavAriaLabel: 'Principal',
    localeSelectAriaLabel: 'Idioma',
    openMenuAriaLabel: 'Abrir menu',
    siteMenuAriaLabel: 'Menu do site',
    footerLine: 'Código aberto · Sem anúncios · Património humano · Contemplativo',
  },
  es: {
    siteDefaultDescription:
      'Patrimonio humano en sonido. Una biblioteca viva de cántico sagrado — preservar el acceso a los estados interiores que el sonido sagrado abre.',
    homeDescription:
      'Una biblioteca viva del patrimonio sonoro espiritual de la humanidad. Cánticos sagrados, mantras, himnos y oraciones de distintas tradiciones — preservados y compartidos para escuchar, reflexionar y reconectar.',
    chantsIndexDescription: 'Explorar todos los cánticos sagrados de la biblioteca.',
    knowledge: {
      nadaYoga:
        'Nada Yoga: el yoga del sonido y la vibración. Definición, sonido āhata y anāhata, referencias clásicas.',
      vibrationMind:
        'Cómo las vibraciones sonoras afectan el instrumento de la mente; resonancia, intención y lo audible e inaudible.',
      elementsAndSound:
        'Panchamahabhuta: los cinco elementos y su relación con el sonido. Ākāśa y śabda; equilibrio y armonía.',
      soundAttributes:
        'Tono, volumen, timbre y cómo los atributos del sonido se relacionan con los cinco elementos y armonizan al oyente.',
      balanceAndHealing:
        'La distinción entre equilibrio momentáneo y sanación más profunda. Sonido sagrado, disolución del ego y contacto con el ser integral.',
      soundAndHumanity:
        'Sonido y humanidad: cómo culturas del mundo han cultivado el canto; sonido en la naturaleza; lo sagrado y estados interiores canalizados por el sonido.',
      references: 'Referencias y lectura adicional sobre Nada Yoga y los cinco elementos.',
    },
    mainNavAriaLabel: 'Principal',
    localeSelectAriaLabel: 'Idioma',
    openMenuAriaLabel: 'Abrir menú',
    siteMenuAriaLabel: 'Menú del sitio',
    footerLine: 'Código abierto · Sin anuncios · Patrimonio humano · Contemplativo',
  },
  it: {
    siteDefaultDescription:
      'Patrimonio umano nel suono. Una biblioteca viva di canto sacro — preservare l’accesso agli stati interiori che il suono sacro apre.',
    homeDescription:
      'Una biblioteca viva del patrimonio sonoro spirituale dell’umanità. Canti devozionali, mantra, inni e preghiere da diverse tradizioni — preservati e condivisi per ascolto, riflessione e riconnessione.',
    chantsIndexDescription: 'Sfoglia tutti i canti sacri della biblioteca.',
    knowledge: {
      nadaYoga:
        'Nada Yoga: lo yoga del suono e della vibrazione. Definizione, suono āhata e anāhata, riferimenti classici.',
      vibrationMind:
        'Come le vibrazioni sonore agiscono sullo strumento della mente; risonanza, intenzione e l’udibile e l’inaudibile.',
      elementsAndSound:
        'Panchamahabhuta: i cinque elementi e il loro rapporto con il suono. Ākāśa e śabda; equilibrio e armonia.',
      soundAttributes:
        'Altezza, volume, timbro e come gli attributi del suono si legano ai cinque elementi e armonizzano chi ascolta.',
      balanceAndHealing:
        'La distinzione tra equilibrio momentaneo e guarigione più profonda. Suono sacro, dissoluzione dell’ego e contatto con l’essere integrale.',
      soundAndHumanity:
        'Suono e umanità: come le culture nel mondo hanno coltivato il canto; suono in natura; il sacro e stati interiori canalizzati dal suono.',
      references: 'Riferimenti e letture sul Nada Yoga e i cinque elementi.',
    },
    mainNavAriaLabel: 'Principale',
    localeSelectAriaLabel: 'Lingua',
    openMenuAriaLabel: 'Apri menu',
    siteMenuAriaLabel: 'Menu del sito',
    footerLine: 'Open source · Nessuna pubblicità · Patrimonio umano · Contemplativo',
  },
  hi: {
    siteDefaultDescription:
      'ध्वनि में मानव विरासत। पवित्र कीर्तन का जीवंत पुस्तकालय — पवित्र ध्वनि जो आंतरिक अवस्थाएँ खोलती है, उन तक पहुँच संरक्षित करना।',
    homeDescription:
      'मानवता की आध्यात्मिक ध्वनि विरासत का जीवंत पुस्तकालय। विभिन्न परंपराओं के पवित्र भजन, मंत्र, स्तोत्र और प्रार्थनाएँ — सुनने, चिंतन और पुनः जुड़ने के लिए संरक्षित और साझा।',
    chantsIndexDescription: 'पुस्तकालय के सभी पवित्र भजन ब्राउज़ करें।',
    knowledge: {
      nadaYoga:
        'नाद योग: ध्वनि और कंपन का योग। परिभाषा, आहत और अनाहत नाद, शास्त्रीय संदर्भ।',
      vibrationMind:
        'ध्वनि कंपन मन-यंत्र को कैसे प्रभावित करते हैं; अनुनाद, संकल्प और श्राव्य व अस्फुट।',
      elementsAndSound:
        'पंचमहाभूत: पाँच तत्व और ध्वनि से संबंध। आकाश और शब्द; संतुलन व सामंजस्य।',
      soundAttributes:
        'स्वर, आयाम, स्वर-वर्ण और ध्वनि गुण पाँच तत्वों से कैसे जुड़ते हैं व श्रोता में सामंजस्य।',
      balanceAndHealing:
        'क्षणिक संतुलन और गहरे उपचार में अंतर। पवित्र ध्वनि, अहं विलय और अखंड सत्ता से संपर्क।',
      soundAndHumanity:
        'ध्वनि और मानवता: संसार भर की संस्कृतियों ने गीत कैसे संवारे; प्रकृति में ध्वनि; पवित्रता और आंतरिक अवस्थाएँ।',
      references: 'नाद योग और पाँच तत्व — संदर्भ व आगे पढ़ने के लिए।',
    },
    mainNavAriaLabel: 'मुख्य नेविगेशन',
    localeSelectAriaLabel: 'भाषा चुनें',
    openMenuAriaLabel: 'मेनू खोलें',
    siteMenuAriaLabel: 'साइट मेनू',
    footerLine: 'ओपन सोर्स · विज्ञापन नहीं · मानव विरासत · चिंतनशील',
  },
};
