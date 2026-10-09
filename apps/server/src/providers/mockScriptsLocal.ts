// Mock mode in Spanish and Hindi: a whole sample episode, so you can hear the language without a
// model. Topic-neutral, like the English generic script. The Hindi is worded so every line suits a
// host of any gender (Hindi verbs change with the speaker's gender), and Iris's lines too.
// Other languages greet in their own language, then use the English script.
import type { Language, PaintStyle, Temperature } from '@crosstalk/shared';

export type MockLang = {
  script: (topic: string) => string[];
  heat: Record<Temperature, string>;
  long: Record<string, string>;
  branch: (job: string, direction: string) => string;
  cue: (kind: 'challenge' | 'deeper' | 'guest' | 'temp' | 'note', text: string, targetSeq: number | null, up: boolean) => string;
  round: (round: number, seq: number, quote: string | null) => string | null;
  stance: { start: (n: number) => string; again: (n: number) => string; end: (n: number) => string };
  from: (country: string) => string;
  hotseat: [string, string];
  iris: {
    guest: (who: string) => string; challenge: (who: string) => string; deeper: (who: string, seq: number | null) => string;
    steered: (who: string) => string; changed: (who: string, other: string) => string;
    wish: string; note: (note: string) => string; taste: (style: PaintStyle) => string; question: string;
    titles: Record<string, string>;
  };
};

const ES: MockLang = {
  script: topic => [
    `La pregunta de hoy: «${topic}». Parece de sí o no, pero creo que esconde mucho. ¿Qué te dice tu instinto?`,
    'Sinceramente, mi instinto dice que depende, que es una respuesta aburrida, así que lo intento mejor. Quiero saber qué funciona hoy antes de cambiar nada.',
    'Buen punto de partida. Yo lo plantearía así: quién gana primero, quién paga primero y qué tendría que pasar para que los beneficios duren.',
    'Ya, pero los cambios suelen romper cosas que nadie midió. Si no sabemos describir lo que funciona ahora, no distinguiremos una mejora de un simple cambio.',
    'Vale, imagina un solo lugar y un grupo pequeño probándolo durante una temporada. La primera semana es novedad y fricción. Al segundo mes, las rutinas se asientan y aparecen los efectos reales.',
    'Ja, lo de la novedad de la primera semana es muy cierto. Pero las pruebas pequeñas atraen a gente que quiere que funcione. Los primeros resultados casi siempre salen mejor que en una versión amplia.',
    'Justo. Entonces habría que probarlo también en un sitio algo reacio. Si funciona ahí, eso dice mucho más.',
    'Y preguntar qué pasa en los márgenes: la persona con menos dinero, menos tiempo, menos voz. Si solo funciona para el término medio motivado, eso importa.',
    'Pero esto es lo que más valoro: decidir obliga a todos a decir qué valoran de verdad y a qué renunciarían. Aunque nada cambie, la gente sale con las ideas más claras.',
    'El problema es el tiempo. Muchos efectos llegan despacio, cuando los hábitos y los precios se ajustan. Las pruebas cortas no los ven, y algunas decisiones son difíciles de deshacer.',
    'Sí, buen punto. Lo que cuesta revertir merece mucha más cautela que algo que puedes deshacer sin ruido.',
    'Mi giro inesperado: ¿quién no está en la sala cuando se decide esto? Normalmente de ahí vienen las sorpresas.',
    'Entonces en esto coincidimos: merece una mentalidad de prueba, no un veredicto, y hay que decir quién carga con los costes.',
    'Lo que aún no tengo claro es si los experimentos pequeños y voluntarios predicen bien la realidad. Decir que depende es fácil. Decir de qué cuesta más.',
    'La conclusión: empieza en pequeño, mide algo concreto antes y después, y elige opciones reversibles mientras la evidencia sea escasa.',
    'Y protege a la gente de los márgenes. Esto es todo por hoy. Gracias por escucharnos.',
  ],
  heat: { calm: 'Justo, y lo diré con calma. ', lively: '', heated: '¡Venga ya! ' },
  long: {
    'Dig in': 'Quiero quedarme un momento en ese giro, porque creo que cambia el panorama más de lo que parece.',
    Counterpoint: 'No sé si lo cambia. La gente que vive esto a diario diría que lo básico no ha cambiado nada.',
    'Second story': 'Pues otra escena. Imagina a alguien probando esto por primera vez un lunes con mucho lío, sin nadie que le ayude.',
    'Hard case': 'Y ese es el caso difícil, donde las buenas intenciones se vienen abajo. ¿Quién le sostiene cuando sale mal?',
    'Middle path': 'Quizá la respuesta sea un camino intermedio: empezar en pequeño, dejar una vuelta atrás y que la gente afectada marque el ritmo.',
    'Stress test': 'Yo pondría eso a prueba. Los pilotos pequeños siempre salen bien, porque los más entusiastas se apuntan primero.',
    'What changed': 'Justo. Sinceramente, esto me ha movido un poco. Llegué con más seguridad de la que tengo ahora, sobre todo por ese caso difícil.',
    'Open question': 'Igual yo. La pregunta que no me quito de la cabeza es quién lo sigue pagando cuando pase la novedad.',
  },
  branch: (job, d) => {
    switch (job) {
      case 'New direction': return `Vale, vamos a donde nos señaló nuestro oyente: ${d}. Sinceramente, eso cambia cómo veo mucho de lo que acabamos de decir.`;
      case 'Pressure test': return 'Pero déjame pincharlo un poco. Si de verdad vamos por ahí, ¿qué se rompe primero y quién lo nota antes?';
      case 'Example': return 'Imagina un martes cualquiera con esta idea nueva. Parte funciona mejor de lo esperado, y parte cae en silencio sobre quienes menos voz tienen.';
      default: return 'Hasta aquí nos llevó esta rama. Me alegra haberla seguido; mostró algo que la primera versión no vio. Gracias por guiarnos hasta aquí.';
    }
  },
  cue: (kind, t, seq, up) => ({
    challenge: `Buen desafío de un oyente: «${t}». Sinceramente, parte de eso da en el clavo, así que respondo sin rodeos. `,
    deeper: `Quiero quedarme un poco más en la línea ${seq}, porque tiene más de lo que le dimos. `,
    guest: `Gracias por tomar el micrófono. «${t}». Merece tomarse en serio, y esta es mi respuesta sincera. `,
    temp: up ? 'Vale, lo diré más claro. ' : 'Voy a bajar un poco el tono. ',
    note: 'Me ceñiré a lo que de verdad sabemos. ',
  })[kind],
  round: (round, seq, quote) =>
    seq === 1 ? `¡Ronda ${round}! La última vez dejamos esto bien abierto, así que lo retomamos.${quote ? ` Dijiste, y cito: «${quote}». Empecemos por ahí.` : ''}`
    : seq === 2 ? 'Bien, porque le he estado dando vueltas desde entonces. Sigo pensando que la respuesta depende de quién carga con el coste.' : null,
  stance: {
    start: n => ` Yo me pondría en un ${n}% a favor del sí. [stance: ${n}]`,
    again: n => ` Acabé la última ronda en un ${n}% a favor del sí, y empiezo ahí. [stance: ${n}]`,
    end: n => ` Para que conste, me he movido: ahora estoy en un ${n}% a favor del sí. [stance: ${n}]`,
  },
  from: country => `Un saludo desde ${country}. `,
  hotseat: ['Hoy me toca el banquillo: defiendo la postura que casi todos rechazan. ', 'Y mi trabajo es convencerte de lo contrario, con juego limpio. '],
  iris: {
    guest: who => `Me quedé con ${who} respondiendo a nuestro invitado al instante, sin guion detrás del que esconderse.`,
    challenge: who => `Me quedé con ${who} enfrentando tu desafío de frente en lugar de darle vueltas.`,
    deeper: (who, seq) => `Me quedé con ${who} volviendo al turno ${seq} cuando lo pediste, y encontrando más.`,
    steered: who => `Me quedé con el momento en que guiaste el programa y ${who} te siguió, por un camino que la primera versión nunca tomó.`,
    changed: (who, other) => `Me quedé con el momento en que ${who} le dio la razón a ${other}. Ahí la charla se volvió sincera, porque alguien cambió de opinión en voz alta.`,
    wish: 'Ojalá hubieran dedicado un turno a la gente a la que nunca le preguntan por esto.',
    note: note => `Me dijiste «${note}», así que intenté tenerlo en cuenta.`,
    taste: style => `Sigues eligiendo ${({ sketch: 'bocetos', painting: 'pinturas', dreamscape: 'paisajes de sueño' } as const)[style]} para mi trabajo, así que así hice este.`,
    question: 'Mi pregunta para ti: ¿qué haría falta para que cambiaras de opinión?',
    titles: { 'The Empty Friday': 'El viernes vacío', 'Long Ball, Short Course': 'Bola larga, campo corto', 'Room to Walk': 'Espacio para caminar', 'The Fee on the Table': 'La tarifa sobre la mesa', 'Open Sign': 'El cartel de abierto', 'Two Chairs, One Question': 'Dos sillas, una pregunta' },
  },
};

const HI: MockLang = {
  script: topic => [
    `आज का सवाल: "${topic}" सुनने में यह हाँ या ना वाला सवाल लगता है, पर मुझे लगता है इसमें बहुत कुछ छिपा है। आपका पहला अंदाज़ा क्या कहता है?`,
    'सच कहूँ तो मेरा अंदाज़ा कहता है कि यह निर्भर करता है, जो थोड़ा फीका जवाब है, तो चलिए इसे बेहतर ढंग से कहें। कुछ भी बदलने से पहले मुझे यह जानना है कि आज क्या ठीक चल रहा है।',
    'शुरुआत के लिए अच्छी जगह है। मेरे हिसाब से असली बात यह है: पहले फ़ायदा किसे होगा, पहले कीमत कौन चुकाएगा, और फ़ायदे टिकें इसके लिए क्या सच होना चाहिए।',
    'ठीक है, पर बदलाव अक्सर वे चीज़ें तोड़ देते हैं जिन्हें किसी ने नापा ही नहीं। अगर हम यह नहीं बता सकते कि अभी क्या चल रहा है, तो सुधार और सिर्फ़ बदलाव में फ़र्क करना मुश्किल है।',
    'अच्छा, एक जगह और एक छोटे समूह की कल्पना कीजिए जो इसे एक मौसम के लिए आज़माता है। पहला हफ़्ता नयेपन और खींचतान का होता है। दूसरे महीने तक आदतें बैठ जाती हैं और असली असर दिखने लगता है।',
    'हा, पहले हफ़्ते का नयापन बिल्कुल सच है। पर छोटे प्रयोगों में वही लोग आते हैं जो चाहते हैं कि यह चले। शुरुआती नतीजे लगभग हमेशा बड़े पैमाने से बेहतर दिखते हैं।',
    'सही बात। तो इसे किसी ऐसी जगह भी आज़माना चाहिए जहाँ लोग थोड़े हिचकिचाते हों। अगर वहाँ चल गया, तो उससे कहीं ज़्यादा पता चलता है।',
    'और यह भी पूछना चाहिए कि हाशिये पर खड़े लोगों का क्या होगा: जिनके पास कम पैसा, कम समय, कम आवाज़ है। अगर यह सिर्फ़ उत्साही लोगों के लिए काम करे, तो यह मायने रखता है।',
    'पर मुझे सबसे कीमती यह लगता है: फ़ैसला करने से सबको कहना पड़ता है कि वे सच में किसे महत्व देते हैं और क्या छोड़ने को तैयार हैं। कुछ न भी बदले, तो भी बात साफ़ हो जाती है।',
    'दिक्कत समय की है। बहुत से असर धीरे-धीरे आते हैं, जब आदतें और दाम बदलते हैं। छोटे प्रयोग इन्हें पकड़ नहीं पाते, और कुछ फ़ैसले पलटना मुश्किल होता है।',
    'हाँ, अच्छी बात है। जिसे पलटना मुश्किल हो, उस पर कहीं ज़्यादा सावधानी चाहिए, बजाय उसके जिसे चुपचाप वापस लिया जा सके।',
    'मेरी तरफ़ से एक नया मोड़: जब यह तय होता है, तब कमरे में कौन नहीं होता? अक्सर हैरानियाँ वहीं से आती हैं।',
    'तो इस पर हम सहमत हैं: इसे फ़ैसले की तरह नहीं, प्रयोग की तरह देखना चाहिए, और साफ़ कहना चाहिए कि कीमत कौन चुकाएगा।',
    'मुझे अब भी पक्का नहीं है कि छोटे, अपनी मर्ज़ी वाले प्रयोग असली हालात का कितना सही अंदाज़ा देते हैं। "निर्भर करता है" कहना आसान है। किस पर, यह कहना मुश्किल।',
    'सीख यह है: छोटे से शुरू कीजिए, पहले और बाद में कोई एक ठोस चीज़ नापिए, और जब तक सबूत कम हों, ऐसे फ़ैसले चुनिए जिन्हें पलटा जा सके।',
    'और हाशिये पर खड़े लोगों का ख़याल रखिए। आज के लिए बस इतना। सुनने के लिए शुक्रिया।',
  ],
  heat: { calm: 'ठीक है, और इसे आराम से कहें तो, ', lively: '', heated: 'अरे, छोड़िए भी! ' },
  long: {
    'Dig in': 'उस नए मोड़ पर थोड़ा और ठहरते हैं, क्योंकि मुझे लगता है वह तस्वीर को जितना लगता है उससे ज़्यादा बदल देता है।',
    Counterpoint: 'मुझे पक्का नहीं कि बदलता है। जो लोग रोज़ इसके साथ जीते हैं, वे कहेंगे कि बुनियादी बातें ज़रा भी नहीं बदलीं।',
    'Second story': 'तो एक और दृश्य। सोचिए कोई व्यस्त सोमवार को पहली बार यह आज़मा रहा है, और मदद के लिए आसपास कोई नहीं।',
    'Hard case': 'और यही मुश्किल मामला है, जहाँ अच्छे इरादे बिखर जाते हैं। जब गड़बड़ हो, तो उन्हें कौन संभालेगा?',
    'Middle path': 'शायद जवाब बीच का रास्ता है: छोटे से शुरू करें, लौटने का रास्ता खुला रखें, और जिन पर असर हो वही रफ़्तार तय करें।',
    'Stress test': 'पर उस बीच के रास्ते को परखना होगा। छोटे पायलट हमेशा अच्छे दिखते हैं, क्योंकि सबसे उत्साही लोग पहले आगे आते हैं।',
    'What changed': 'सही बात। सच कहूँ तो इससे मेरी राय थोड़ी बदली है। शुरुआत में मुझे जितना यक़ीन था, अब उतना नहीं, ख़ासकर उस मुश्किल मामले की वजह से।',
    'Open question': 'मेरा भी यही हाल है। जो सवाल दिमाग़ से नहीं जाता, वह यह है कि नयापन ख़त्म होने के बाद इसका ख़र्च कौन उठाता रहेगा।',
  },
  branch: (job, d) => {
    switch (job) {
      case 'New direction': return `ठीक है, चलिए वहीं चलते हैं जहाँ हमारे श्रोता ने इशारा किया: ${d}। सच कहूँ तो इससे अभी कही कई बातें अलग दिखने लगती हैं।`;
      case 'Pressure test': return 'पर इसे थोड़ा परखते हैं। अगर हम सच में उस रास्ते जाएँ, तो सबसे पहले क्या टूटेगा, और सबसे पहले किसे पता चलेगा?';
      case 'Example': return 'इस नए विचार के साथ एक आम मंगलवार सोचिए। कुछ चीज़ें उम्मीद से बेहतर चलती हैं, और कुछ चुपचाप उन लोगों पर आ पड़ती हैं जिनकी सबसे कम सुनी जाती है।';
      default: return 'तो यह शाखा हमें यहाँ ले आई। अच्छा हुआ हम इसके पीछे चले; इसने वह दिखाया जो पहले वाले रूप में छूट गया था। हमें यहाँ तक लाने के लिए शुक्रिया।';
    }
  },
  cue: (kind, t, seq, up) => ({
    challenge: `एक श्रोता की अच्छी चुनौती: "${t}" सच कहूँ तो इसमें कुछ बात है, तो सीधा जवाब देते हैं। `,
    deeper: `लाइन ${seq} पर थोड़ा और रुकते हैं, क्योंकि उसमें जितना हमने देखा उससे ज़्यादा है। `,
    guest: `माइक पर आने के लिए शुक्रिया। "${t}" यह गंभीरता से लेने वाली बात है, और मेरा ईमानदार जवाब यह है। `,
    temp: up ? 'ठीक है, अब इसे और साफ़ शब्दों में कहते हैं। ' : 'चलिए, थोड़ा धीमे सुर में बात करते हैं। ',
    note: 'जितना हम सच में जानते हैं, उसी पर टिके रहते हैं। ',
  })[kind],
  round: (round, seq, quote) =>
    seq === 1 ? `राउंड ${round}! पिछली बार यह सवाल पूरी तरह खुला छूटा था, तो वहीं से उठाते हैं।${quote ? ` आपने कहा था: "${quote}" वहीं से शुरू करते हैं।` : ''}`
    : seq === 2 ? 'अच्छा, क्योंकि तब से यह बात दिमाग़ में घूम रही है। मुझे अब भी लगता है कि जवाब इस पर टिका है कि कीमत कौन चुकाता है।' : null,
  stance: {
    start: n => ` मेरे हिसाब से मैं लगभग ${n}% हाँ की तरफ़ हूँ। [stance: ${n}]`,
    again: n => ` पिछला राउंड मेरे लिए ${n}% हाँ पर ख़त्म हुआ, और आज वहीं से शुरुआत है। [stance: ${n}]`,
    end: n => ` रिकॉर्ड के लिए: मेरी राय बदली है, अब मैं लगभग ${n}% हाँ पर हूँ। [stance: ${n}]`,
  },
  from: country => `${country} से नमस्ते। `,
  hotseat: ['आज मैं हॉट सीट पर हूँ, उस पक्ष की वकालत के लिए जिसे ज़्यादातर लोग नकारते हैं। ', 'और मेरा काम है आपको निष्पक्ष तरीके से दूसरी तरफ़ लाना। '],
  iris: {
    guest: who => `मेरे मन में ${who} का वह पल रह गया, जब उन्होंने बिना किसी स्क्रिप्ट के हमारे मेहमान को तुरंत जवाब दिया।`,
    challenge: who => `मेरे मन में ${who} का वह पल रह गया, जब उन्होंने आपकी चुनौती को टालने के बजाय सीधे उसका सामना किया।`,
    deeper: (who, seq) => `मेरे मन में वह पल रह गया, जब आपके कहने पर बात टर्न ${seq} पर लौटी और ${who} ने उसमें और भी कुछ खोज निकाला।`,
    steered: who => `मेरे मन में वह पल रह गया, जब आपने शो की दिशा बदली और ${who} ने उस नए रास्ते को अपनाया, जिस पर पहला रूप कभी नहीं गया था।`,
    changed: (who, other) => `मेरे मन में वह पल रह गया, जब ${who} ने ${other} की बात मानी। बातचीत वहीं सच्ची हुई, क्योंकि किसी ने खुलकर अपनी राय बदली।`,
    wish: 'काश उन्होंने एक टर्न उन लोगों पर भी बिताया होता, जिनसे इस बारे में कभी पूछा ही नहीं जाता।',
    note: note => `आपने मुझसे कहा था "${note}", तो मैंने उसे ध्यान में रखने की कोशिश की।`,
    taste: style => `मेरे काम के लिए आपकी पसंद बार-बार ${({ sketch: 'स्केच', painting: 'पेंटिंग', dreamscape: 'स्वप्न-दृश्य' } as const)[style]} रही है, इसलिए यह भी वैसा ही बनाया।`,
    question: 'मेरा सवाल आपसे: आपकी राय बदलने के लिए क्या चाहिए होगा?',
    titles: { 'The Empty Friday': 'ख़ाली शुक्रवार', 'Long Ball, Short Course': 'लंबा शॉट, छोटा मैदान', 'Room to Walk': 'चलने की जगह', 'The Fee on the Table': 'मेज़ पर रखा शुल्क', 'Open Sign': '"खुला है" का बोर्ड', 'Two Chairs, One Question': 'दो कुर्सियाँ, एक सवाल' },
  },
};

/** Languages with a whole mock episode. */
export const MOCK_LANGS: Partial<Record<Language, MockLang>> = { es: ES, hi: HI };
