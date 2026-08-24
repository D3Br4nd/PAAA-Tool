import type { GeoWaypointChallengeType } from './schema';

type DemoGeoWaypoint = {
	adminName: string;
	name: string;
	radiusMeters: number;
	challengeType: GeoWaypointChallengeType;
	enigmaText: string | null;
	quizQuestion: string | null;
	quizOptions: string[] | null;
	quizAnswer: string | null;
	quizTimeLimitSeconds: number;
	challengeDisclaimerText: string | null;
	pointsOnArrival: number;
	pointsOnSuccess: number;
};

export type DemoGeoHunt = {
	factionName: string;
	name: string;
	description: string;
	challengeDisclaimerText: string;
	waypoints: DemoGeoWaypoint[];
};

const COMMON_HUNT_DESCRIPTION =
	'Path del Cavaliere (L\'Esploratore), responsabile Luigi Simone. Cinque fasi da 20 punti, massimo 100 punti, senza bonus di velocità né prove alternative. Al termine la squadra deve presentarsi al palco per ricevere dallo staff il badge di fine fase Cavaliere; il palco non è un waypoint GPS.';

const ROAD_SAFETY_DISCLAIMER =
	'Confermo che la squadra rispetterà il Codice della Strada e le indicazioni dello staff. Arrivare prima non assegna punti aggiuntivi.';

const ALLY_PHOTO_TEXT =
	'Cercate in paese due alleati e portateli al monumento.\n\nIl Nipote: un bambino delle elementari con la sua bici o il suo monopattino, insieme a un genitore.\n\nIl Patriarca: un uomo con i capelli bianchi o grigi e la barba o i baffi.\n\nServono entrambi nella stessa foto. Il genitore e il Patriarca devono essere due persone diverse.\n\nNella foto devono comparire anche il monumento e almeno un componente con la maglietta CaTE.\n\nChiedete il permesso agli adulti e date loro il bigliettino prima di scattare. Se dicono di no, si ringrazia e si cerca qualcun altro.';

const ALLY_PRIVACY_DISCLAIMER =
	'Avete una sola possibilità: la foto non si può rifare né sostituire. Se manca anche una sola cosa, la fase vale 0 punti.\n\nControllate di avere nell\'inquadratura il bambino, la sua bici o il suo monopattino, il genitore che lo accompagna, il Patriarca, il monumento riconoscibile e la maglietta CaTE indossata.\n\nNon chiedete documenti o dati personali. Avete chiesto il permesso a entrambi gli adulti?';

const TESTIMONY_PHOTO_TEXT =
	'Prima della foto dovete procurarvi una musicassetta originale: con la copertina stampata, non una cassetta vergine registrata in casa con l\'etichetta bianca scritta a mano.\n\nTornate poi qui e scattate il selfie di squadra con il luogo riconoscibile alle spalle, la musicassetta in primo piano con la copertina rivolta verso la fotocamera e almeno un componente con la maglietta CaTE.\n\nLa cassetta la procura la vostra Squadra e non si presta. Se la stessa cassetta compare nelle foto di più Squadre, vengono annullate tutte.';

const TESTIMONY_PHOTO_DISCLAIMER =
	'Avete una sola possibilità: la foto non si può rifare né sostituire. Controllate che il luogo sia riconoscibile alle spalle, la musicassetta sia in primo piano con la copertina rivolta verso la fotocamera e a fuoco, e la maglietta CaTE sia indossata.';

function gpsWaypoint(adminName: string, enigmaText: string, points: number) {
	return {
		adminName,
		// The player UI renders `name` while navigating. Keep it identical to
		// the clue so a reset/seed cannot hide the verses in `enigmaText`.
		name: enigmaText,
		radiusMeters: 10,
		challengeType: 'gps' as const,
		enigmaText,
		quizQuestion: null,
		quizOptions: null,
		quizAnswer: null,
		quizTimeLimitSeconds: 60,
		challengeDisclaimerText: null,
		pointsOnArrival: points,
		pointsOnSuccess: 0
	};
}

function photoWaypoint(
	adminName: string,
	name: string,
	enigmaText: string,
	disclaimer: string | null = null
) {
	return {
		adminName,
		name,
		radiusMeters: 20,
		challengeType: 'photo' as const,
		enigmaText,
		quizQuestion: null,
		quizOptions: null,
		quizAnswer: null,
		quizTimeLimitSeconds: 60,
		challengeDisclaimerText: disclaimer,
		pointsOnArrival: 0,
		pointsOnSuccess: 20
	};
}

function quizWaypoint(question: string, options: string[], answer: string) {
	return {
		adminName: 'Fase 5 - Il Sigillo del Templare (Quiz)',
		name: 'Il Sigillo del Templare',
		radiusMeters: 20,
		challengeType: 'quiz' as const,
		enigmaText: 'Avete 15 secondi e un solo tentativo.',
		quizQuestion: question,
		quizOptions: options,
		quizAnswer: answer,
		quizTimeLimitSeconds: 15,
		challengeDisclaimerText:
			'Quando confermate, domanda e opzioni diventano visibili e il timer di 15 secondi parte immediatamente.',
		pointsOnArrival: 0,
		pointsOnSuccess: 20
	};
}

function commonWaypoints(opts: {
	monument: string;
	phaseOneClue: string;
	venticanoPlace: string;
	phaseThreeClue: string;
	quizQuestion: string;
	quizOptions: string[];
	quizAnswer: string;
}): DemoGeoWaypoint[] {
	return [
		gpsWaypoint(
			`Fase 1 - GPS: ${opts.monument}`,
			opts.phaseOneClue,
			20
		),
		photoWaypoint(
			`Fase 2 - Foto alleato presso ${opts.monument}`,
			'L\'Alleato del Paese',
			ALLY_PHOTO_TEXT,
			ALLY_PRIVACY_DISCLAIMER
		),
		gpsWaypoint(
			`Fase 3 - GPS: ${opts.venticanoPlace}`,
			opts.phaseThreeClue,
			20
		),
		photoWaypoint(
			`Fase 4 - Selfie: ${opts.venticanoPlace}`,
			'La Testimonianza',
			TESTIMONY_PHOTO_TEXT,
			TESTIMONY_PHOTO_DISCLAIMER
		),
		quizWaypoint(opts.quizQuestion, opts.quizOptions, opts.quizAnswer)
	];
}

export const DEMO_GEO_HUNTS: DemoGeoHunt[] = [
	{
		factionName: "Precettoria d'Oltremare",
		name: "Path del Cavaliere - Precettoria d'Oltremare",
		description: COMMON_HUNT_DESCRIPTION,
		challengeDisclaimerText: ROAD_SAFETY_DISCLAIMER,
		waypoints: commonWaypoints({
			monument: 'Santuario di San Ciriaco, Torre Le Nocelle',
			phaseOneClue:
				'Il mio campanile canta al cielo da solo,\nstaccato dalla chiesa che gli fa da suolo.',
			venticanoPlace: 'Palazzo Ambrosini',
			phaseThreeClue:
				'Non conti né baroni qui han dimorato,\nma un\'anima mite che il cielo ha chiamato.\nNegli anni Quaranta si spense la luce,\nma il suo nome in paese ancora conduce.',
			quizQuestion:
				'In quale data i Mamelucchi lanciarono l\'assalto generale alle mura di San Giovanni d\'Acri, difese anche dai Cavalieri Templari?',
			quizOptions: ['4 aprile 1291', '18 maggio 1291', '28 maggio 1291'],
			quizAnswer: '18 maggio 1291'
		})
	},
	{
		factionName: 'Precettoria di Francia',
		name: 'Path del Cavaliere - Precettoria di Francia',
		description: COMMON_HUNT_DESCRIPTION,
		challengeDisclaimerText: ROAD_SAFETY_DISCLAIMER,
		waypoints: commonWaypoints({
			monument: 'Torre Aragonese, Pietradefusi',
			phaseOneClue:
				'Su roccia viva sento il vento e la Valle,\nle mie scale di pietra abbracciano le spalle.',
			venticanoPlace: 'Palazzo Colarusso',
			phaseThreeClue:
				'Pietra e balconi guardano la via,\ncustodisco memorie d\'antica signoria.\nTra le case del paese resto silenzioso,\ncercate il mio profilo, nobile e misterioso.',
			quizQuestion:
				'In quale data iniziarono in Francia gli arresti dei Cavalieri Templari ordinati da re Filippo IV?',
			quizOptions: ['13 ottobre 1307', '22 novembre 1307', '22 marzo 1312'],
			quizAnswer: '13 ottobre 1307'
		})
	},
	{
		factionName: "Precettoria d'Iberia",
		name: "Path del Cavaliere - Precettoria d'Iberia",
		description: COMMON_HUNT_DESCRIPTION,
		challengeDisclaimerText: ROAD_SAFETY_DISCLAIMER,
		waypoints: commonWaypoints({
			monument: 'Castello della Leonessa, Montemiletto',
			phaseOneClue:
				'Sulla mia porta una corona conta le punte,\nun Re di Borbone qui fermò le sue giunte.',
			venticanoPlace: "Chiesa di Santa Maria e Sant'Alessio",
			phaseThreeClue:
				'Con la spada nel pugno e le ali distese,\nveglio all\'ingresso di un luogo che il cielo protesse.\nNon sono il patrono che qui è venerato,\nma il suo guardiano, in pietra scolpito, di guardia è restato.',
			quizQuestion:
				'In quale data papa Giovanni XXII riconobbe con la bolla Ad ea ex quibus l\'Ordine di Cristo portoghese, erede dei Templari di Tomar?',
			quizOptions: ['22 marzo 1312', '2 maggio 1312', '14 marzo 1319'],
			quizAnswer: '14 marzo 1319'
		})
	},
	{
		factionName: "Precettoria d'Italia",
		name: "Path del Cavaliere - Precettoria d'Italia (Sud)",
		description: COMMON_HUNT_DESCRIPTION,
		challengeDisclaimerText: ROAD_SAFETY_DISCLAIMER,
		waypoints: commonWaypoints({
			monument: 'Carcere Borbonico, Montefusco',
			phaseOneClue:
				'Tra le nubi del Principato Ultra vegliavo severo,\nmura che un tempo ospitarono il potere.\nPoi tra quelle stesse pietre risuonò il silenzio,\ndi chi pagò con le catene il proprio pensiero.',
			venticanoPlace: 'Cappella della Croce',
			phaseThreeClue:
				'Piccola sono, ma il mio segno è antico,\ndue assi che s\'incontrano: del fedele l\'amico.\nLungo il cammino sono un fermo pegno,\ndi chi cerca la fede come un disegno.',
			quizQuestion:
				'In quale data papa Clemente V promulgò la bolla Vox in excelso, con cui soppresse l\'Ordine dei Cavalieri Templari?',
			quizOptions: ['13 ottobre 1307', '22 marzo 1312', '2 maggio 1312'],
			quizAnswer: '22 marzo 1312'
		})
	}
];
