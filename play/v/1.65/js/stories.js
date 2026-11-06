/* Oma's Mahjong — made-up stories from the neighbourhood, about the computer players in the ranking
   (BOTS in social.js). One part per won level (now and then, between the real news: VILLAGE in
   rules.js), each part ends with a little cliffhanger. Before part `ask.at` a memory question
   about an earlier part (right = a bonus star).
   A part: [text, cliffhanger] (the last part has no cliffhanger). Dutch only: these are for grandma. */
'use strict';

const STORIES = [
  {
    id: 'fiets', who: 'Truus', ico: '🚲', title: 'De blauwe fiets',
    parts: [
      ['Truus vond vanochtend een blauwe damesfiets tegen haar heg in Zevenhuizen. Met een mandje voorop, en in dat mandje… een tros bananen.', 'Van wie zou die fiets zijn?'],
      ['Truus hing een briefje op bij de bakker: “Blauwe fiets gevonden, met bananen.” Binnen een uur stonden er al drie mensen voor de deur. Niemand van hen had bananen gekocht.', 'Wie is de echte eigenaar?'],
      ['Henk dacht dat het de fiets van de nieuwe buurvrouw was. Maar die rijdt alleen op een driewieler, weet Ans zeker. Truus zet de fiets voorlopig in haar schuurtje.', 'En dan, ’s avonds laat, gaat de bel…'],
      ['Aan de deur staat Joke, helemaal buiten adem. “Mijn fiets! Ik had hem bij de Apenheul neergezet en ben met de bus naar huis gegaan. Helemaal vergeten!”', 'Maar hoe kwam die fiets dan bij Truus?'],
      ['Het raadsel is opgelost: Jokes kleinzoon had de fiets netjes “teruggebracht”, alleen naar het verkeerde huis. En de bananen? Die waren voor de apen.', 'Joke wil Truus bedanken. Maar hoe?'],
      ['Joke bracht Truus een zelfgebakken bananencake. Sindsdien fietsen ze elke dinsdag samen naar de markt. “Zo’n fiets brengt je soms een vriendin,” zegt Truus.', ''],
    ],
    ask: { at: 4, q: 'Wat lag er in het mandje van de blauwe fiets?', a: ['Bananen', 'Appels', 'Brood'], ok: 0 },
  },
  {
    id: 'kat', who: 'Buurvrouw Ans', ico: '🐈', title: 'De kat die twee keer eet',
    parts: [
      ['De kat van buurvrouw Ans, Minoes, wordt dikker en dikker. En Ans geeft haar echt maar twee keer per dag eten.', 'Waar haalt Minoes dat extra eten vandaan?'],
      ['Ans deed een briefje aan Minoes’ halsband: “Krijgt mijn kat bij u eten?” De volgende dag zat er een ander briefje aan.', 'Wat stond er op dat briefje?'],
      ['“Ja, elke middag een visje. Ze heet hier Poekie. Groetjes, Opa Kees.” Ans moest er hard om lachen.', 'Maar Opa Kees woont twee straten verderop…'],
      ['Minoes loopt elke middag via drie tuinen en een schutting naar Opa Kees, die dan net terug is van het vissen bij het kanaal.', 'Ans en Kees spreken af om het eerlijk te regelen.'],
      ['De afspraak: Opa Kees geeft geen vis meer, alleen nog een aai. Twee dagen later zat Minoes boos voor zijn deur te miauwen. De hele straat hoorde het.', 'Wie geeft er als eerste toe?'],
      ['Opa Kees gaf toe. Nu krijgt Minoes op zondag één visje, en dan komt Ans gezellig koffie drinken. “Die kat heeft ons aan elkaar gekoppeld,” zegt Kees.', ''],
    ],
    ask: { at: 4, q: 'Hoe noemt Opa Kees de kat?', a: ['Poekie', 'Minoes', 'Tijger'], ok: 0 },
  },
  {
    id: 'pompoen', who: 'Henk', ico: '🎃', title: 'De reuzenpompoen',
    parts: [
      ['In de volkstuin van Henk groeit een pompoen die elke dag groter wordt. Hij is nu al zo groot als een kruiwagen.', 'Henk wil meedoen aan de pompoenwedstrijd. Lukt dat?'],
      ['De wedstrijd is volgende week en de pompoen weegt 212 kilo! Henk heeft hem een naam gegeven: Bertha.', 'Maar dan ziet Henk ’s ochtends iets vreemds aan Bertha…'],
      ['Er zit een gat in Bertha! Met kleine tandafdrukjes. Een muis? Een egel? Henk legt een camera bij de tuin.', 'Wat is er op de camera te zien?'],
      ['Op de beelden: een klein eekhoorntje dat elke nacht een hapje neemt. “Hij heeft ook honger,” zegt Henk zacht. Hij zet er een bakje nootjes naast.', 'Nu Bertha nog naar de wedstrijd zien te krijgen…'],
      ['Klaas kwam met zijn tractor! Met zes buren tilden ze Bertha op een pallet. De halve straat liep mee, als een optocht.', 'Wint Bertha de wedstrijd?'],
      ['Bertha werd tweede, met gat en al. Maar Henk kreeg de publieksprijs voor het mooiste verhaal. Van Bertha wordt soep gemaakt voor het hele buurthuis.', ''],
    ],
    ask: { at: 4, q: 'Hoe heet de reuzenpompoen van Henk?', a: ['Bertha', 'Greta', 'Wilma'], ok: 0 },
  },
  {
    id: 'sjaal', who: 'Mien', ico: '🧶', title: 'De sjaal van tien meter',
    parts: [
      ['Mien breit al sinds de zomer aan één sjaal. Hij is nu tien meter lang en ligt door haar hele kamer.', 'Voor wie is die enorme sjaal?'],
      ['Mien wil niets zeggen. Wel kocht ze vandaag nog zes bollen wol: rood, wit en blauw. Bep zag het bij de wolwinkel.', 'Bep wordt steeds nieuwsgieriger…'],
      ['Bep probeerde het via de kleindochter van Mien. Die verklapte alleen: “Oma breit voor iets heel groots in het park.”', 'Wat moet je nou in een park met een sjaal?'],
      ['’s Ochtends vroeg zag Gerrit Mien met een ladder in het Oranjepark lopen. Op weg naar de oudste eik!', 'Wat gaat Mien daar doen?'],
      ['Mien wikkelde de hele sjaal om de dikke stam van de oude eik. Een boomtrui, tegen de kou! Voorbijgangers bleven staan en maakten foto’s.', 'Maar dan komt er iemand van de gemeente kijken…'],
      ['De man van de gemeente vond het prachtig. De boom mag zijn trui de hele winter houden. En Mien krijgt nu bestellingen: drie bomen in de straat willen er ook één.', ''],
    ],
    ask: { at: 4, q: 'Welke kleuren wol kocht Mien?', a: ['Rood, wit en blauw', 'Geel en groen', 'Paars en roze'], ok: 0 },
  },
  {
    id: 'trompet', who: 'Wim', ico: '🎺', title: 'Muziek om middernacht',
    parts: [
      ['Elke nacht om twaalf uur klinkt er trompetmuziek in de straat. Heel zacht en heel mooi. Niemand weet wie het is.', 'Wie speelt er midden in de nacht?'],
      ['Iedereen kijkt naar Wim, want Wim speelt trompet bij de fanfare. Maar Wim zweert dat hij dan allang slaapt. “Met oordopjes in!”', 'Als het Wim niet is, wie dan wel?'],
      ['Corrie hield de wacht achter haar gordijn. Om twaalf uur zag ze een lampje branden op een zolder verderop.', 'Daar woont Meester Dekker, de oude schoolmeester!'],
      ['Meester Dekker speelde vroeger in een orkest. Elke nacht speelt hij het liedje waarmee hij zijn vrouw vijftig jaar geleden ten huwelijk vroeg. Zij valt er nog steeds bij in slaap.', 'Wim krijgt een idee…'],
      ['Wim vroeg of Meester Dekker eens met de fanfare mee wilde spelen. “Ik ben te oud,” zei hij. Maar zaterdag stond de hele fanfare gewoon voor zijn deur te spelen.', 'Wat doet Meester Dekker?'],
      ['Hij pakte zijn trompet en speelde mee, op de stoep, in zijn pantoffels. De hele straat klapte. Nu speelt hij op zaterdag bij de fanfare, en ’s nachts nog steeds één liedje voor zijn vrouw.', ''],
    ],
    ask: { at: 4, q: 'Hoe laat klinkt de trompet elke nacht?', a: ['Om twaalf uur', 'Om drie uur', 'Om zes uur'], ok: 0 },
  },
  {
    id: 'vogelhuis', who: 'Greet', ico: '🐦', title: 'Het vogelhuisje',
    parts: [
      ['Greet hing een vogelhuisje op in haar tuin. Er woont nu iets in, maar het is geen mees en ook geen mus.', 'Wat woont er in het vogelhuisje?'],
      ['Greet ziet alleen een staartje: bruin en dun. Het fluit niet, het… knabbelt.', 'Greet haalt hulp bij Lies.'],
      ['Lies werkte vroeger bij de dierenarts. Ze scheen met een zaklamp naar binnen. “Greet, er woont een bosmuis in je vogelhuisje!”', 'Maar de bosmuis is niet alleen…'],
      ['Er liggen vier piepkleine muisjes in het huisje! Greet durft haar tuin bijna niet meer in. Ze loopt op haar tenen naar de waslijn.', 'En de vogels dan? Die hebben nu geen huis…'],
      ['Greet besloot: de muisjes mogen blijven tot het voorjaar. Ze hing er een bordje bij: “Hier woont mevrouw Muis.”', 'Dan komt Greets kleinzoon met een plan.'],
      ['Samen timmerden ze een tweede huisje, met een kleiner gat. Er woont al een pimpelmees in. “Ik heb nu een heel appartementencomplex,” lacht Greet.', ''],
    ],
    ask: { at: 4, q: 'Wie keek er met een zaklamp in het vogelhuisje?', a: ['Lies', 'Henk', 'Truus'], ok: 0 },
  },
  {
    id: 'koe', who: 'Klaas', ico: '🐄', title: 'De koe in de voortuin',
    parts: [
      ['Er stond vanochtend een koe in de voortuin van Juffrouw Bos. Ze at rustig de geraniums op.', 'Hoe komt er nou een koe midden in de wijk?'],
      ['Boer Klaas telde zijn koeien: allemaal aanwezig. “Het is niet de mijne. Mijn koeien eten geen geraniums, die zijn verwend.”', 'Van wie is die koe dan wel?'],
      ['De koe heeft een geel oormerk met nummer 54. Juffrouw Bos noemt haar alvast Clementine en geeft haar een emmer water.', 'Dan rijdt er een auto met een aanhanger de straat in…'],
      ['Het is een boer uit Hoog Soeren. Clementine heet eigenlijk Bella en is al drie dagen zoek. Ze is helemaal over de hei naar de stad gelopen!', 'Maar Bella wil niet in de aanhanger…'],
      ['Bella zette haar hoeven schrap. Duwen hielp niet, trekken ook niet. Toen kwam Juffrouw Bos aanlopen met haar allerlaatste geranium.', 'Zou dat werken?'],
      ['Voor één geranium stapte Bella zo de aanhanger in. De boer gaf Juffrouw Bos een grote kaas als dank. En ze mag Bella komen opzoeken in Hoog Soeren.', ''],
    ],
    ask: { at: 4, q: 'Welk nummer stond er op het oormerk van de koe?', a: ['54', '12', '99'], ok: 0 },
  },
  {
    id: 'bloemen', who: 'Corrie', ico: '🌻', title: 'Bloemen zonder kaartje',
    parts: [
      ['Elke vrijdag ligt er een bos bloemen op de stoep bij Corrie. Zonder kaartje. Al vier weken lang!', 'Wie stuurt Corrie elke week bloemen?'],
      ['Corrie verdacht Jan van de overkant, die altijd zo vriendelijk zwaait. Maar Jan zit deze week met zijn boot op het IJsselmeer. En toch lagen er vrijdag weer bloemen.', 'Het is Jan dus niet…'],
      ['Het zijn altijd zonnebloemen, Corries lievelingsbloem. Wie weet dat? Alleen haar beste vriendinnen.', 'Corrie zet een stoel achter het raam.'],
      ['Vrijdagochtend, half zeven: een klein meisje met een rugzak legt de bloemen neer en rent weg! Corrie herkent haar niet.', 'Corrie gaat het meisje achterna…'],
      ['Het meisje is Sanne, de kleindochter van Lies. Ze helpt opa in de bloemenkas, en opa zei laatst: “Die mevrouw is altijd zo lief voor iedereen.”', 'Wat doet Corrie nu?'],
      ['Corrie bakte een taart voor Sanne en haar opa. Nu komt Sanne elke vrijdag na school bij Corrie, voor chocolademelk en een spelletje mahjong.', ''],
    ],
    ask: { at: 4, q: 'Welke bloemen krijgt Corrie elke week?', a: ['Zonnebloemen', 'Rozen', 'Tulpen'], ok: 0 },
  },
  {
    id: 'taart', who: 'Bep', ico: '🍰', title: 'De taartwedstrijd',
    parts: [
      ['Bep wint al twaalf jaar de taartwedstrijd van het buurthuis, met haar appeltaart. Maar dit jaar doet er iemand nieuw mee.', 'Wie durft het tegen Bep op te nemen?'],
      ['Het is Tante Riet! Ze zegt dat ze een geheim ingrediënt heeft. Bep slaapt er slecht van.', 'Wat zou dat geheime ingrediënt zijn?'],
      ['Bep fietste “toevallig” langs het huis van Tante Riet. Het rook naar kaneel… en naar nog iets anders. Iets wat Bep niet kon thuisbrengen.', 'En morgen is de wedstrijd al!'],
      ['De twee taarten stonden naast elkaar. De jury proefde, en proefde nog eens… Het werd gelijkspel!', 'Er moet een beslissing komen…'],
      ['Er kwam een extra ronde: de kinderen van de basisschool mochten blind proeven. Ze vonden allebei de taarten heerlijk en wilden méér.', 'Toen verklapte Tante Riet haar geheim…'],
      ['Het geheime ingrediënt? Een snufje peper, in het recept van Bep zelf! Riet had het dertig jaar geleden van Bep gekregen. Ze delen de prijs, en volgend jaar bakken ze samen.', ''],
    ],
    ask: { at: 4, q: 'Hoe lang wint Bep de taartwedstrijd al?', a: ['Twaalf jaar', 'Twee jaar', 'Dertig jaar'], ok: 0 },
  },
  {
    id: 'karper', who: 'Opa Kees', ico: '🎣', title: 'De grote karper',
    parts: [
      ['Opa Kees zegt dat hij in het kanaal een karper heeft gevangen van wel een meter lang. Niemand gelooft hem.', 'Heeft hij bewijs?'],
      ['Kees heeft één foto. Maar die is zó wazig, je ziet alleen een grote grijze vlek en de duim van Kees. “Dat is een sok,” zegt Henk.', 'Kees is beledigd en gaat terug naar het water…'],
      ['Kees zit nu elke ochtend om zes uur aan het kanaal, met een thermosfles koffie en een nieuwe camera. Drie dagen lang: niks.', 'Op dag vier trekt er iets héél hard aan zijn hengel…'],
      ['Het wordt een gevecht van twintig minuten! Wandelaars blijven staan. Iemand rent naar de bakker om hulp te halen.', 'Is het de grote karper?'],
      ['Ja! Een enorme karper, met een litteken op zijn vin, precies zoals Kees had verteld. Zes mensen zagen het met eigen ogen. En er werden foto’s gemaakt. Scherpe, deze keer.', 'Wat doet Kees nu met de vis?'],
      ['Kees zette de karper heel voorzichtig terug in het water. “Hij heet Ome Joop, en hij mag nog lang zwemmen.” De foto hangt nu bij de bakker aan de muur.', ''],
    ],
    ask: { at: 4, q: 'Hoe laat zit Opa Kees elke ochtend aan het water?', a: ['Om zes uur', 'Om negen uur', 'Om twaalf uur'], ok: 0 },
  },
  {
    id: 'bankje', who: 'Gerrit', ico: '🪑', title: 'Het bankje in het park',
    parts: [
      ['Gerrit zit al veertig jaar elke ochtend op hetzelfde bankje in het Oranjepark. Maar vanochtend was het bankje weg!', 'Waar is het bankje van Gerrit gebleven?'],
      ['Op de plek van het bankje staat nu een bordje: “Tijdelijk weggehaald.” Meer niet. Gerrit staat er beteuterd naast, met zijn krantje onder de arm.', 'Gerrit gaat op onderzoek uit.'],
      ['Volgens de parkwachter is het bankje “naar de werkplaats”. Is het kapot? Komt het terug? Hij weet het niet. Gerrit zit nu op een omgekeerde emmer.', 'De hele buurt leeft mee…'],
      ['Mien breide een kussentje voor op de emmer. Wim speelde een treurig liedje. En Truus bracht elke ochtend koffie.', 'Na twee weken rijdt er een vrachtwagen het park in…'],
      ['Het bankje is terug! Helemaal opgeknapt en groen geverfd. En er zit een koperen plaatje op.', 'Wat staat er op dat plaatje?'],
      ['“Het bankje van Gerrit. Hier wordt al 40 jaar goedemorgen gezegd.” De buurt had stiekem geld ingezameld. Gerrit moest even zijn neus snuiten.', ''],
    ],
    ask: { at: 4, q: 'Hoe lang zit Gerrit al op het bankje?', a: ['Veertig jaar', 'Vier jaar', 'Tien jaar'], ok: 0 },
  },
  {
    id: 'boek', who: 'Juffrouw Bos', ico: '📚', title: 'Het boek dat terugkwam',
    parts: [
      ['Er kwam een pakketje bij Juffrouw Bos. Erin: een boek uit haar oude schoolbibliotheek, 52 jaar te laat teruggebracht! Met een briefje erbij.', 'Wie stuurt er na 52 jaar een boek terug?'],
      ['Het boek heet “Het geheim van de vuurtoren”, met haar oude stempel erin. Op het briefje staat alleen: “Sorry juf. Ik heb het nooit uitgelezen.”', 'Welke oud-leerling zou dit zijn?'],
      ['Juffrouw Bos zocht in haar oude klassenfoto’s. Er zat een jongetje in de klas dat altijd onder zijn tafeltje zat te lezen…', 'Maar hoe heette hij ook alweer?'],
      ['Ze vroeg het aan Meester Dekker. Die wist het nog: “Dat was Jantje, met de sproeten! Die zat altijd te dromen.”', 'Is dat dezelfde Jan als die van de boot?'],
      ['Ja! Jan van de boot, nu zestig, en nog steeds met sproeten. Hij bekende: hij was bang voor de boete en heeft het boek al die jaren bewaard.', 'Wat zegt Juffrouw Bos daarvan?'],
      ['“De boete is: het boek nu écht uitlezen.” Jan las het in één middag, bij haar op de bank. Hij gaf het een tien. Het boek staat nu op zijn boot.', ''],
    ],
    ask: { at: 4, q: 'Hoeveel jaar te laat kwam het boek terug?', a: ['52 jaar', '5 jaar', '25 jaar'], ok: 0 },
  },
  {
    id: 'tulpen', who: 'Tante Riet', ico: '🌷', title: 'De verdwenen tulpenbollen',
    parts: [
      ['Iemand graaft ’s nachts de tulpenbollen van Tante Riet uit. Er zijn er al zestien weg!', 'Wie steelt er nou tulpenbollen?'],
      ['Riet strooide bloem op het tuinpad om voetsporen te zien. ’s Ochtends: kleine pootafdrukken. Geen mens dus!', 'Welk dier zou het zijn?'],
      ['Ans denkt aan een eekhoorn, Henk aan een mol. Maar Riet vond in de bloem nog iets: een plukje wit haar.', 'Riet gaat ’s nachts op wacht…'],
      ['Om twee uur ’s nachts zag ze het: Bobbie, het witte hondje van de overburen, graaft vrolijk in haar tuin. En hij neemt de bollen mee in zijn bek!', 'Waar brengt Bobbie ze naartoe?'],
      ['Bobbie heeft alle zestien bollen netjes begraven in zijn eigen tuin. De buren boden duizendmaal excuses aan. Riet besloot: laat ze daar maar zitten.', 'Wat gebeurt er in het voorjaar?'],
      ['In april stond de tuin van Bobbie vol met Riets tulpen, rood en geel. Bobbie ligt er trots tussen. Riet noemt het “mijn tweede tuin” en gaat er elke week kijken.', ''],
    ],
    ask: { at: 4, q: 'Welke kleur haar vond Riet in de bloem?', a: ['Wit', 'Zwart', 'Rood'], ok: 0 },
  },
  {
    id: 'buren', who: 'Ria', ico: '🧁', title: 'De nieuwe buren',
    parts: [
      ['In het huis op de hoek komen nieuwe buren wonen. De verhuiswagen was enorm, maar niemand heeft de buren zelf al gezien.', 'Wie zijn de nieuwe buren?'],
      ['Ria zag wel wat er uit de wagen kwam: een piano, drie fietsen, een papegaaienkooi en een kano. Een kano!', 'Ria bakt cupcakes en gaat aanbellen…'],
      ['Ria belde aan. Niemand deed open, maar van binnen riep een papegaai heel hard: “Kom binnen!”', 'Is er wel iemand thuis?'],
      ['De volgende dag hing er een kaartje op Ria’s deur: “Dank voor de cupcakes! We waren aan het kanoën. Kom zaterdag koffie drinken!”', 'Zaterdag gaat Ria op bezoek…'],
      ['Het zijn superleuke mensen: hij is pianoleraar, zij is boswachter op de Veluwe. De papegaai heet Koos en kent wel vijftig woorden.', 'Toen vroeg de buurman iets aan Ria…'],
      ['Of Ria pianoles wilde! Nu heeft ze elke donderdag les. Haar eerste liedje: “Altijd is Kortjakje ziek”. Koos de papegaai zingt mee. Vals.', ''],
    ],
    ask: { at: 4, q: 'Wat riep de papegaai toen Ria aanbelde?', a: ['Kom binnen!', 'Goedemorgen!', 'Lekker!'], ok: 0 },
  },
  {
    id: 'ring', who: 'Lies', ico: '💍', title: 'De verloren ring',
    parts: [
      ['Lies is haar trouwring kwijt. Ze had hem gisteren nog om, bij het tuinieren.', 'Waar zou die ring nu zijn?'],
      ['De halve buurt hielp zoeken. Henk kwam met een metaaldetector. Die piepte zeven keer: drie spijkers, twee kroonkurken, een sleutel en een oude cent uit 1952.', 'Maar geen ring…'],
      ['Lies is verdrietig: de ring was van haar moeder. Ze zocht overal: in de vuilnisbak, in haar jaszakken, zelfs in de koelkast.', 'Dan krijgt Lies een idee: de compostbak!'],
      ['In de compostbak geen ring. Wel een heel dikke worm. Maar de kip van de buren, Henny, kijkt wel heel verdacht…', 'Zou Henny de ring…?'],
      ['De buurvrouw vond de ring de volgende ochtend in het kippenhok! Henny houdt van glimmende dingen. Er lagen ook een theelepeltje en een knoop.', 'De ring is terug! En Henny?'],
      ['Lies draagt haar ring weer, nu met een kettinkje erbij. En Henny kreeg een eigen glimmend speeltje: een oud lepeltje aan een touwtje. Ze is er dol op.', ''],
    ],
    ask: { at: 4, q: 'Hoe oud was de cent die Henk vond?', a: ['Uit 1952', 'Uit 2002', 'Uit 1800'], ok: 0 },
  },
  {
    id: 'fles', who: 'Jan', ico: '⛵', title: 'Het briefje in de fles',
    parts: [
      ['Jan vond een fles met een briefje erin, tussen het riet langs het kanaal. Het papier is oud en geel.', 'Wat staat er in het briefje?'],
      ['“Wie dit vindt: ik ben Marietje, 9 jaar. Ik woon in Apeldoorn. Wil je mijn vriendje zijn? 12 juni 1971.”', 'Zou Marietje nog in Apeldoorn wonen?'],
      ['Jan zette een oproep in het buurtkrantje. Drie Marietjes reageerden. Eén was te jong, één woonde altijd al in Zutphen…', 'En de derde?'],
      ['De derde Marietje is nu 64 en woont in Osseveld. Ze huilde toen ze haar eigen kinderhandschrift zag.', 'Jan en Marietje spreken af…'],
      ['Ze dronken thee bij het kanaal, precies waar Marietje de fles in het water had gegooid. “We waren net verhuisd, ik kende niemand,” vertelde ze.', 'En Jan had ook nog een verrassing…'],
      ['Jan had een nieuw briefje geschreven, in een nieuwe fles: “Gevonden! Marietje heeft er een vriend bij.” Die fles staat nu bij Marietje in de vensterbank. Ze varen samen met Jans boot.', ''],
    ],
    ask: { at: 4, q: 'Hoe oud was Marietje toen ze het briefje schreef?', a: ['9 jaar', '19 jaar', '6 jaar'], ok: 0 },
  },
  {
    id: 'kabouter', who: 'Truus', ico: '🍄', title: 'De kabouter op reis',
    parts: [
      ['De tuinkabouter van Truus is weg. Gewoon weg, van het gazon. Hij heet Gijs en stond er al twintig jaar.', 'Wie neemt er nou een tuinkabouter mee?'],
      ['Een week later lag er een ansichtkaart in de bus. Een foto van Gijs… voor Paleis Het Loo! Op de achterkant: “Groetjes, Gijs.”', 'Gijs is op reis?!'],
      ['De volgende kaart: Gijs bij de apen in de Apenheul. Daarna: Gijs op de hei, tussen de schapen. Truus hangt alle kaarten op de koelkast.', 'Wie zit hierachter?'],
      ['De vierde kaart komt van verder weg: Gijs voor de Eiffeltoren in Parijs! Dit moet iemand zijn met een auto en veel tijd.', 'Truus heeft een verdachte…'],
      ['Truus belde haar zoon. Die deed heel onschuldig. Maar op de achtergrond hoorde ze een Frans liedje…', 'Betrapt?'],
      ['Haar zoon en de kleinkinderen hadden Gijs meegenomen op vakantie, om oma te verrassen. Gijs staat weer in de tuin, met een klein Frans baretje op. Volgend jaar gaat Truus zelf mee.', ''],
    ],
    ask: { at: 4, q: 'Hoe heet de tuinkabouter van Truus?', a: ['Gijs', 'Kees', 'Piet'], ok: 0 },
  },
  {
    id: 'ballon', who: 'Klaas', ico: '🎈', title: 'De luchtballon',
    parts: [
      ['Zaterdagavond landde er een luchtballon in het weiland van Klaas. Midden tussen de koeien!', 'Wie zat er in de ballon?'],
      ['Uit het mandje stapte een bruidspaar, nog in trouwkleren! De koeien kwamen nieuwsgierig kijken. De bruid moest lachen, de bruidegom iets minder.', 'Hoe komen ze nu thuis?'],
      ['Hun auto stond nog bij het feest in Hoenderloo, twintig kilometer verderop. En de telefoon van de bruidegom was leeg.', 'Klaas start zijn tractor…'],
      ['Klaas bracht het bruidspaar naar het feest, met de bruid achterop de tractor en de sluier wapperend in de wind. Alle auto’s toeterden.', 'Op het feest wachten honderd gasten…'],
      ['Toen de tractor het feest op reed, juichte iedereen. De bruid gooide haar boeket… recht in de handen van Klaas.', 'Klaas, die al dertig jaar vrijgezel is!'],
      ['Klaas werd zo rood als een tomaat. Maar die avond danste hij met Tante Riet, en nu dansen ze elke zaterdag in het buurthuis. “Het is nog niks,” zegt Bep. Klaas lacht alleen maar.', ''],
    ],
    ask: { at: 4, q: 'Waar landde de luchtballon?', a: ['In het weiland van Klaas', 'Op het dak van de kerk', 'In het Oranjepark'], ok: 0 },
  },
  {
    id: 'feest', who: 'Joke', ico: '🎂', title: 'Geen feest voor Joke',
    parts: [
      ['Joke wordt volgende week negentig. Ze wil absoluut géén feest. “Geen gedoe,” zegt ze.', 'Maar de buurt denkt daar anders over…'],
      ['Er wordt stiekem geld ingezameld. Bep bakt, Wim regelt de fanfare en Mien breit vlaggetjes. Alles moet geheim blijven.', 'Maar Joke heeft scherpe ogen…'],
      ['Joke zag Bep met vijf taartdozen lopen. “Voor wie zijn die?” vroeg ze. “Eh… voor de kerk,” zei Bep. Joke kneep haar ogen tot spleetjes.', 'Heeft ze iets door?'],
      ['Op haar verjaardag stond Joke om tien uur al aangekleed, met lippenstift op, in haar mooiste jurk. Ze zat te wachten…', 'Wist ze het dan?'],
      ['Om elf uur speelde de fanfare in de straat. Joke deed de deur open en zei: “Eindelijk! Ik zit al een uur te wachten!” Ze wist het al dagen.', 'Wie had het verklapt?'],
      ['Koos de papegaai? Nee hoor: het was Jokes kleinzoon. Maar Joke vond het het mooiste feest ooit. Ze danste met Meester Dekker en at drie stukken taart.', ''],
    ],
    ask: { at: 4, q: 'Hoe oud wordt Joke?', a: ['Negentig', 'Tachtig', 'Honderd'], ok: 0 },
  },
];
