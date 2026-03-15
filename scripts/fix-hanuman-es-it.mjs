#!/usr/bin/env node
/**
 * Fix Hanuman Chalisa: replace placeholder ES/IT (copied from EN) with proper translations.
 * Run: node scripts/fix-hanuman-es-it.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const chantPath = join(__dirname, '../src/content/chants/hanuman-chalisa.json');

// en -> [es, it] for each unique translation string
const TRANSLATIONS = {
  "Having polished the mirror of my mind with the dust of the lotus feet of the Guru.": ["Habiendo pulido el espejo de mi mente con el polvo de los pies de loto del Gurú.", "Avendo pulito lo specchio della mia mente con la polvere dei piedi di loto del Guru."],
  "I sing the spotless glory of the best of Raghu (Rāma), who bestows the four fruits: dharma (religion), artha (wealth), kama (pleasure), and moksha (liberation).": ["Canto la gloria inmaculada del mejor de Raghu (Rāma), que concede los cuatro frutos: dharma (religión), artha (riqueza), kama (placer) y moksha (liberación).", "Canto la gloria immacolata del migliore di Raghu (Rāma), che concede i quattro frutti: dharma (religione), artha (ricchezza), kama (piacere) e moksha (liberazione)."],
  "Knowing myself to be lacking in wisdom, I invoke the son of the wind (Hanumān).": ["Reconociendo mi falta de sabiduría, invoco al hijo del viento (Hanumān).", "Consapevole della mia mancanza di saggezza, invoco il figlio del vento (Hanumān)."],
  "Grant me strength, wisdom and knowledge; remove my afflictions and impurities.": ["Concédeme fuerza, sabiduría y conocimiento; elimina mis aflicciones e impurezas.", "Concedimi forza, saggezza e conoscenza; rimuovi le mie afflizioni e impurità."],
  "Victory to Thee, O Hanumān, ocean of wisdom and virtue.": ["Victoria a Ti, oh Hanumān, océano de sabiduría y virtud.", "Vittoria a Te, o Hanumān, oceano di saggezza e virtù."],
  "Victory to the Lord of the Vānaras (monkeys), who illuminates the three worlds.": ["Victoria al Señor de los Vānaras (monos), que ilumina los tres mundos.", "Vittoria al Signore dei Vānara (scimmie), che illumina i tre mondi."],
  "Messenger of Rāma and repository of immeasurable strength.": ["Mensajero de Rāma y depósito de fuerza inconmensurable.", "Messaggero di Rāma e deposito di forza incommensurabile."],
  "Son of Añjanī and of the wind (Pavana), by that name you are known.": ["Hijo de Añjanī y del viento (Pavana), por ese nombre eres conocido.", "Figlio di Añjanī e del vento (Pavana), da quel nome sei conosciuto."],
  "O Mahāvīra (Hanumān), great hero, of mighty valour like a thunderbolt, thunderbolt-bodied (Vajrāṅgī).": ["Oh Mahāvīra (Hanumān), gran héroe, de valor poderoso como un rayo, de cuerpo adamantino (Vajrāṅgī).", "Oh Mahāvīra (Hanumān), grande eroe, dal valore possente come un fulmine, dal corpo adamantino (Vajrāṅgī)."],
  "Remover of wicked thoughts (kumati) and companion to the good-minded (sumati).": ["Removedor de pensamientos perversos (kumati) y compañero de los de buena mente (sumati).", "Rimuovi i pensieri malvagi (kumati) e sei compagno dei ben pensanti (sumati)."],
  "Your complexion shines golden; you shine with beautiful attire.": ["Tu tez brilla dorada; resplandeces con hermosa vestimenta.", "La tua carnagione brilla d'oro; risplendi con bella vestimenta."],
  "Glittering earrings (kuṇḍala) and curly hair.": ["Aretes brillantes (kuṇḍala) y cabello rizado.", "Orecchini luccicanti (kuṇḍala) e capelli ricci."],
  "You have a thunderbolt-like mace in one hand and Śrī Rāma's victory flag in the other; they shine in your hands.": ["Tienes un mazo como un rayo en una mano y la bandera de victoria de Śrī Rāma en la otra; brillan en tus manos.", "Hai una mazza simile a un fulmine in una mano e la bandiera della vittoria di Śrī Rāma nell'altra; brillano nelle tue mani."],
  "Across your shoulder is the sacred thread made of muñjā grass.": ["Sobre tu hombro está el hilo sagrado hecho de hierba muñjā.", "Sulle tue spalle il filo sacro fatto di erba muñjā."],
  "You are the incarnation of Śiva (Śaṅkara) and the son of Keśarī.": ["Eres la encarnación de Śiva (Śaṅkara) y el hijo de Keśarī.", "Sei l'incarnazione di Śiva (Śaṅkara) e il figlio di Keśarī."],
  "You are adored by the entire world for your great splendour and might.": ["Eres adorado por todo el mundo por tu gran esplendor y poder.", "Sei adorato da tutto il mondo per il tuo grande splendore e potenza."],
  "You are supremely wise, virtuous and intelligent.": ["Eres supremamente sabio, virtuoso e inteligente.", "Sei supremamente saggio, virtuoso e intelligente."],
  "Always eager to accomplish Lord Rāma's work.": ["Siempre ávido por cumplir la obra del Señor Rāma.", "Sempre avido di compiere l'opera del Signore Rāma."],
  "Your greatest pleasure is listening to the Lord's glories and story.": ["Tu mayor placer es escuchar las glorias y la historia del Señor.", "Il tuo più grande piacere è ascoltare le glorie e la storia del Signore."],
  "Śrī Rāma, Śrī Lakṣmaṇa and Śrī Sītā always dwell in your heart.": ["Śrī Rāma, Śrī Lakṣmaṇa y Śrī Sītā residen siempre en tu corazón.", "Śrī Rāma, Śrī Lakṣmaṇa e Śrī Sītā dimorano sempre nel tuo cuore."],
  "Assuming a tiny form you appeared before Sītā.": ["Asumiendo una forma minúscula apareciste ante Sītā.", "Assumendo una forma minuscola apparisti davanti a Sītā."],
  "In awesome, fearsome guise you burned the city of Laṅkā.": ["En aspecto terrible e imponente quemaste la ciudad de Laṅkā.", "In aspetto terribile bruciasti la città di Laṅkā."],
  "Taking a dreadful, mighty form you destroyed the asuras (demons).": ["Tomando una forma temible y poderosa destruiste los asuras (demonios).", "Assumendo una forma terribile e possente distruggesti gli asura (demoni)."],
  "You accomplished the mission of Lord Rāmacandra with great finesse.": ["Cumpliste la misión del Señor Rāmacandra con gran maestría.", "Hai compiuto la missione del Signore Rāmacandra con grande finezza."],
  "Bringing the life-giving Mṛta-Sañjīvaṇī herb, you revived (the unconscious) Lakṣmaṇa.": ["Trayendo la hierba Mṛta-Sañjīvaṇī que da vida, reviviste a Lakṣmaṇa.", "Portando l'erba Mṛta-Sañjīvaṇī che dà la vita, rivivificasti Lakṣmaṇa."],
  "Śrī Raghubīra (Rāma) joyfully embraced you to his heart.": ["Śrī Raghubīra (Rāma) te abrazó jubiloso contra su pecho.", "Śrī Raghubīra (Rāma) ti abbracciò gioiosamente al suo cuore."],
  "Greatly did the Lord of the Raghus (Rāma) praise you.": ["Grandemente el Señor de los Raghu (Rāma) te elogió.", "Grandemente il Signore dei Raghu (Rāma) ti lodò."],
  "Saying: \"You are as dear to me as my very own brother Bharat.\"": ["Diciendo: «Eres tan querido para mí como mi propio hermano Bharat.»", "Dicendo: «Sei così caro a me come il mio fratello Bharat.»"],
  "Thousands of mouths (the thousand-mouthed serpent Śeṣa) sing your glories.": ["Miles de bocas (la serpiente Śeṣa de mil bocas) cantan tus glorias.", "Migliaia di bocche (il serpente Śeṣa dalle mille bocche) cantano le tue glorie."],
  "With these words, Sītā's Lord (Śrīpati—Lord Rāma) drew you to himself, embracing you to his heart.": ["Con estas palabras, el Señor de Sītā (Śrīpati—Señor Rāma) te atrajo a sí, abrazándote contra su corazón.", "Con queste parole, il Signore di Sītā (Śrīpati—Signore Rāma) ti attirò a sé, abbracciandoti al suo cuore."],
  "Sanaka and the sages (Kumāras), Brahmā, the gods and the great sages.": ["Sanaka y los sabios (Kumāras), Brahmā, los dioses y los grandes sabios.", "Sanaka e i saggi (Kumāras), Brahmā, gli dèi e i grandi saggi."],
  "Nārada, Sarasvatī and Ahīśā the lord of serpents cannot completely describe your glories.": ["Nārada, Sarasvatī y Ahīśā el señor de las serpientes no pueden describir completamente tus glorias.", "Nārada, Sarasvatī e Ahīśā il signore dei serpenti non possono descrivere completamente le tue glorie."],
  "Yama and Kubera along with the Dikpāla devatas (the eight guardian deities) keep singing your fame.": ["Yama y Kubera junto con los devatas Dikpāla (las ocho deidades guardianas) siguen cantando tu fama.", "Yama e Kubera insieme ai devata Dikpāla (le otto divinità guardiane) continuano a cantare la tua fama."],
  "How can ordinary poets and knowers of the Vedas fully describe your glory?": ["¿Cómo pueden poetas ordinarios y conocedores de los Vedas describir completamente tu gloria?", "Come possono poeti ordinari e conoscitori dei Veda descrivere pienamente la tua gloria?"],
  "You did Sugrīva a great favour—you made him meet Lord Rāma.": ["Hiciste a Sugrīva un gran favor: lo hiciste encontrar al Señor Rāma.", "Facesti un grande favore a Sugrīva: lo facesti incontrare con il Signore Rāma."],
  "You gave him kingship [over Kiṣkindhā] and refuge at the feet of King Rāma.": ["Le diste el reino [sobre Kiṣkindhā] y refugio a los pies del Rey Rāma.", "Gli desti il regno [su Kiṣkindhā] e rifugio ai piedi del Re Rāma."],
  "By heeding your advice, Vibhīṣaṇa became the king of Laṅkā.": ["Al seguir tu consejo, Vibhīṣaṇa se convirtió en rey de Laṅkā.", "Seguendo il tuo consiglio, Vibhīṣaṇa divenne re di Laṅkā."],
  "This is known throughout the world.": ["Esto es conocido en todo el mundo.", "Questo è noto in tutto il mondo."],
  "You leapt towards the sun, situated millions of yojanas away.": ["Saltaste hacia el sol, situado a millones de yojanas de distancia.", "Saltasti verso il sole, situato a milioni di yojana di distanza."],
  "You tried to swallow it because you mistook it to be a sweet fruit.": ["Intentaste tragarlo porque lo confundiste con una dulce fruta.", "Tentasti di ingoiarlo perché lo scambiaste per un frutto dolce."],
  "Placing Lord Rāma's ring in your mouth (as a token for Sītā).": ["Colocando el anillo del Señor Rāma en tu boca (como señal para Sītā).", "Ponendo l'anello del Signore Rāma in bocca (come segno per Sītā)."],
  "No wonder you leaped across the vast ocean.": ["No es de admirar que hayas atravesado el vasto océano.", "Non c'è da stupirsi che sia saltato attraverso il vasto oceano."],
  "Any task that is difficult or apparently impossible in the world.": ["Cualquier tarea difícil o aparentemente imposible en el mundo.", "Qualsiasi compito difficile o apparentemente impossibile nel mondo."],
  "Becomes easy to attain by your grace.": ["Se vuelve fácil de alcanzar por tu gracia.", "Diventa facile da ottenere per tua grazia."],
  "You are the ever vigilant guard at the door of Śrī Rāma's abode.": ["Eres el guardián siempre vigilante a la puerta de la morada de Śrī Rāma.", "Sei la guardia sempre vigile alla porta della dimora di Śrī Rāma."],
  "Without your permission no one can enter.": ["Sin tu permiso nadie puede entrar.", "Senza il tuo permesso nessuno può entrare."],
  "By taking shelter in you one can enjoy all happiness.": ["Refugiándose en ti se puede gozar de toda felicidad.", "Rifugiandosi in te si può godere di ogni felicità."],
  "Anyone under your protection has nothing to fear.": ["Quien está bajo tu protección no tiene nada que temer.", "Chi è sotto la tua protezione non ha nulla da temere."],
  "When you remember your powers and roar.": ["Cuando recuerdas tus poderes y ruges.", "Quando ricordi i tuoi poteri e ruggisci."],
  "All three worlds tremble with fear before your might.": ["Los tres mundos tiemblan de miedo ante tu poder.", "I tre mondi tremano di paura davanti alla tua potenza."],
  "Ghosts, evil spirits (bhūtas) and hideous demons (piśācas) never come near.": ["Fantasmas, espíritus malignos (bhūtas) y demonios horrendos (piśācas) nunca se acercan.", "Fantasmi, spiriti maligni (bhūtas) e demoni orribili (piśācas) non si avvicinano mai."],
  "They never come near him who utters your name, Mahāvīra.": ["Nunca se acercan a quien pronuncia tu nombre, Mahāvīra.", "Non si avvicinano mai a chi pronuncia il tuo nome, Mahāvīra."],
  "All diseases and sufferings are destroyed.": ["Todas las enfermedades y sufrimientos son destruidos.", "Tutte le malattie e i sofferenze sono distrutti."],
  "By the constant repetition (japa) of the name of the hero Hanumān.": ["Por la repetición constante (japa) del nombre del héroe Hanumān.", "Per la ripetizione costante (japa) del nome dell'eroe Hanumān."],
  "Hanumān frees from all obstacles and difficulties.": ["Hanumān libera de todos los obstáculos y dificultades.", "Hanumān libera da tutti gli ostacoli e le difficoltà."],
  "Anyone who meditates on Lord Hanumān by thought (mana), word (vācana) and deed (krama).": ["Quien medita en el Señor Hanumān por pensamiento (mana), palabra (vācana) y acción (krama).", "Chi medita sul Signore Hanumān con pensiero (mana), parola (vācana) e azione (krama)."],
  "Śrī Rāma, the Lord of Ascetics (tapasvī-rājā), is the Ruler of all beings.": ["Śrī Rāma, el Señor de los Ascetas (tapasvī-rājā), es el Gobernante de todos los seres.", "Śrī Rāma, il Signore degli Asceti (tapasvī-rājā), è il Governante di tutti gli esseri."],
  "And even then you have accomplished all His difficult tasks with ease.": ["Y aún así cumpliste todas Sus tareas difíciles con facilidad.", "E nonostante ciò hai compiuto tutti i Suoi compiti difficili con facilità."],
  "Whatever wish or desire a devotee cherishes and brings to Him.": ["Cualquier deseo que un devoto acaricie y le presente.", "Qualsiasi desiderio che un devoto coltivi e porti a Lui."],
  "Lord Hanumān grants that fruit of fulfilled and limitless life.": ["El Señor Hanumān concede ese fruto de vida cumplida e ilimitada.", "Il Signore Hanumān concede quel frutto di vita compiuta e illimitata."],
  "Your glory is spread throughout the four yugas (Kṛta, Tretā, Dvāpara and Kali).": ["Tu gloria se extiende por los cuatro yugas (Kṛta, Tretā, Dvāpara y Kali).", "La tua gloria si estende attraverso i quattro yuga (Kṛta, Tretā, Dvāpara e Kali)."],
  "Your brilliance is known in the whole world; the world is illumined by you.": ["Tu brillo es conocido en todo el mundo; el mundo resplandece por ti.", "Il tuo splendore è noto in tutto il mondo; il mondo è illuminato da te."],
  "You are the protetor of sādhus and saints.": ["Eres el protector de sādhus y santos.", "Sei il protettore di sādhu e santi."],
  "The destroyer of demons and the beloved of Lord Rāma.": ["El destructor de demonios y el amado del Señor Rāma.", "Il distruttore di demoni e il amato del Signore Rāma."],
  "You are the bestower of the eight supernatural powers (siddhis) and the nine divine treasures (nidhis).": ["Eres el concedente de los ocho poderes sobrenaturales (siddhis) y los nueve tesoros divinos (nidhis).", "Sei il concedente degli otto poteri soprannaturali (siddhis) e dei nove tesori divini (nidhis)."],
  "Such is the boon Mother Jānakī (Sītā) has given you.": ["Tal es la bendición que la Madre Jānakī (Sītā) te concedió.", "Tale è il dono che la Madre Jānakī (Sītā) ti ha concesso."],
  "You enjoy the sweet nectar elixir of Rāma-nāma (the name of Rāma); you always have it with you.": ["Disfrutas del dulce néctar elixir de Rāma-nāma (el nombre de Rāma); siempre lo llevas contigo.", "Godi del dolce nettare elisir di Rāma-nāma (il nome di Rāma); lo hai sempre con te."],
  "You are always present in the service of Śrī Rāma and remain eternally His servant.": ["Estás siempre presente al servicio de Śrī Rāma y permaneces eternamente Su sirviente.", "Sei sempre presente al servizio di Śrī Rāma e rimani eternamente Suo servo."],
  "By reciting your qualities and chanting your name one can reach Lord Rāma.": ["Recitando tus cualidades y cantando tu nombre se puede alcanzar al Señor Rāma.", "Recitando le tue qualità e cantando il tuo nome si può raggiungere il Signore Rāma."],
  "And get freed from the sorrows of many lives.": ["Y liberarse de las tristezas de muchas vidas.", "E liberarsi dai dolori di molte vite."],
  "At last, when he leaves his physical body, he enters the eternal abode of Raghubara (Śrī Rāma).": ["Por fin, cuando deja su cuerpo físico, entra en la morada eterna de Raghubara (Śrī Rāma).", "Infine, quando lascia il corpo fisico, entra nella dimora eterna di Raghubara (Śrī Rāma)."],
  "Or is born on earth as God's devotee (hari-bhakta).": ["O nace en la tierra como devoto de Dios (hari-bhakta).", "O nasce sulla terra come devoto di Dio (hari-bhakta)."],
  "There is no need to fix the mind on or worship any other deity.": ["No hay necesidad de fijar la mente ni adorar ninguna otra divinidad.", "Non c'è bisogno di fissare la mente o adorare nessun'altra divinità."],
  "By just worshipping Hanumān one attains all happiness.": ["Solo adorando a Hanumān se alcanza toda la felicidad.", "Solo adorando Hanumān si ottiene ogni felicità."],
  "All suffering, distress and pain are cut away and vanish.": ["Todo sufrimiento, angustia y dolor se cortan y desaparecen.", "Tutta la sofferenza, angoscia e dolore sono tagliati via e svaniscono."],
  "For one who remembers the mighty and brave Hanumān (balabīrā).": ["Para quien recuerda al poderoso y valiente Hanumān (balabīrā).", "Per chi ricorda il possente e coraggioso Hanumān (balabīrā)."],
  "Victory, victory, victory to Hanumān, O Lord (Gosāīṁ)!": ["¡Victoria, victoria, victoria a Hanumān, oh Señor (Gosāīṁ)!", "Vittoria, vittoria, vittoria a Hanumān, oh Signore (Gosāīṁ)!"],
  "Be compassionate to me and bestow your grace on me as my Guru and Lord!": ["¡Sé compasivo conmigo y concédeme tu gracia como mi Gurú y Señor!", "Sii compassionevole con me e concedi la tua grazia come mio Guru e Signore!"],
  "Whoever recites or reads this (Hanumān Chālīsā) a hundred times.": ["Quien recite o lea esto (Hanumān Chālīsā) cien veces.", "Chi recita o legge questo (Hanumān Chālīsā) cento volte."],
  "Becomes free of all types of bondage and enjoys supreme Bliss.": ["Se libera de todos los tipos de cautiverio y goza la Suprema Bienaventuranza.", "Si libera da tutti i tipi di schiavitù e gode la Suprema Beatitudine."],
  "Whoever reads or chants this Hanumān Chālīsā.": ["Quien lea o cante este Hanumān Chālīsā.", "Chi legge o canta questo Hanumān Chālīsā."],
  "Is sure to obtain all spiritual perfections (Siddhis). May Lord Śiva (Gaurīsā) be my witness!": ["Obtendrá con seguridad las perfecciones espirituales (Siddhis). ¡Que el Señor Śiva (Gaurīsā) sea mi testigo!", "Otterrà certamente tutte le perfezioni spirituali (Siddhis). Che il Signore Śiva (Gaurīsā) sia il mio testimone!"],
  "Tulasīdās, the writer of these verses, is the eternal servant of Hari (God).": ["Tulasīdās, el escritor de estos versos, es el sirviente eterno de Hari (Dios).", "Tulasīdās, l'autore di questi versi, è il servo eterno di Hari (Dio)."],
  "O Lord (Nātha), please make my heart your abode.": ["Oh Señor (Nātha), por favor haz de mi corazón tu morada.", "Oh Signore (Nātha), fa' del mio cuore la tua dimora."],
  "O Son of the Wind (pavana), remover of difficulties, of auspicious form.": ["Oh Hijo del Viento (pavana), removedor de dificultades, de forma auspiciosa.", "Oh Figlio del Vento (pavana), rimuovi difficoltà, di forma auspicabile."],
  "O Lord of the gods (sura bhūpa), please always reside in my heart together with Rāma, Lakṣmaṇa and Sītā.": ["Oh Señor de los dioses (sura bhūpa), por favor reside siempre en mi corazón junto con Rāma, Lakṣmaṇa y Sītā.", "Oh Signore degli dèi (sura bhūpa), dimora sempre nel mio cuore insieme a Rāma, Lakṣmaṇa e Sītā."],
};

const data = JSON.parse(readFileSync(chantPath, 'utf8'));

let fixed = 0;
for (const verse of data.verses) {
  for (const line of verse.lines || []) {
    const t = line.translations;
    if (!t || !t.en) continue;
    const pair = TRANSLATIONS[t.en];
    if (pair) {
      if (t.es !== pair[0]) {
        t.es = pair[0];
        fixed++;
      }
      if (t.it !== pair[1]) {
        t.it = pair[1];
        fixed++;
      }
    }
  }
}

writeFileSync(chantPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Fixed ${fixed} ES/IT translations in hanuman-chalisa.json`);
process.exit(0);
