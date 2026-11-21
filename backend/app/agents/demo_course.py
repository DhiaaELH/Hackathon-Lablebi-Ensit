"""SYNTHETIC demo course (clearly labelled). Not real Tunisian university material.

`SOURCE_PAGES` is ingested like an uploaded document (one string per page). The hand-written fixtures below
are what DemoProvider returns for this course, so the demo shows realistic agent output without any API
call. Citations are written as section headings and resolved to chunk refs at runtime.
"""

DEMO_TITLE = "[DÉMO] Introduction aux réseaux informatiques"
DEMO_DESCRIPTION = "Cours synthétique de démonstration (L1 informatique). Contenu fictif rédigé pour LessonForge."

SOURCE_PAGES = [
    """# Chapitre 1 : Modèles en couches

## 1.1 Pourquoi des couches ?
Un réseau informatique permet à des machines d'échanger des données. Pour maîtriser la complexité, on découpe la communication en couches. Chaque couche rend un service à la couche supérieure et utilise le service de la couche inférieure. Un protocole est un ensemble de règles qui définit le format et l'ordre des messages échangés entre deux entités de même niveau.

Encapsulation : à l'émission, chaque couche ajoute son propre en-tête aux données reçues de la couche supérieure. À la réception, chaque couche retire l'en-tête correspondant (désencapsulation).

## 1.2 Le modèle OSI
Le modèle OSI comporte 7 couches : physique, liaison de données, réseau, transport, session, présentation, application. La couche physique transmet des bits sur un support. La couche liaison transmet des trames entre deux nœuds voisins et utilise les adresses MAC. La couche réseau achemine des paquets de bout en bout grâce aux adresses IP. La couche transport assure la communication entre processus (ports).
PDU : l'unité de données s'appelle bit (couche 1), trame (couche 2), paquet (couche 3), segment (couche 4).
""",
    """## 1.3 Le modèle TCP/IP
Le modèle TCP/IP, utilisé sur Internet, regroupe les couches en 4 niveaux : accès réseau, Internet (IP), transport (TCP/UDP) et application (HTTP, DNS, SMTP...). Les couches session et présentation de l'OSI sont intégrées à la couche application.

Point difficile : ne pas confondre adresse MAC et adresse IP. L'adresse MAC (48 bits) identifie une interface sur un réseau local et ne sert qu'au saut courant. L'adresse IP identifie une machine dans l'interconnexion de réseaux et reste la même de bout en bout (sans NAT).

# Chapitre 2 : Adressage IPv4

## 2.1 Structure d'une adresse IPv4
Adresse IPv4 : nombre de 32 bits noté en notation décimale pointée, par exemple 192.168.1.10. Chaque octet vaut entre 0 et 255.
Une adresse se compose d'une partie réseau et d'une partie hôte. Le masque de sous-réseau indique quels bits appartiennent à la partie réseau. Notation CIDR : /24 signifie que les 24 premiers bits sont la partie réseau (masque 255.255.255.0).
""",
    """## 2.2 Conversion binaire
Pour calculer une adresse réseau, il faut convertir chaque octet en binaire. Les poids d'un octet sont 128, 64, 32, 16, 8, 4, 2, 1. Exemple : 192 = 128 + 64 = 11000000.
Adresse réseau = adresse IP ET masque (ET logique bit à bit).
Adresse de diffusion (broadcast) : tous les bits de la partie hôte à 1.

## 2.3 Sous-réseaux
Le découpage en sous-réseaux consiste à emprunter des bits à la partie hôte pour créer plusieurs réseaux plus petits.
Formule : nombre d'hôtes utilisables = 2^h - 2, où h est le nombre de bits de la partie hôte (on retire l'adresse réseau et l'adresse de diffusion).
Formule : nombre de sous-réseaux = 2^n, où n est le nombre de bits empruntés.
Exemple : le réseau 192.168.1.0/26 a h = 6 bits d'hôte, donc 2^6 - 2 = 62 hôtes utilisables. Les sous-réseaux /26 de 192.168.1.0/24 commencent à .0, .64, .128 et .192.
Point difficile : oublier de retirer 2 adresses (réseau et diffusion) dans le calcul du nombre d'hôtes.
""",
    """# Chapitre 3 : Routage et transport

## 3.1 Le routage IP
Un routeur relie plusieurs réseaux et décide où envoyer chaque paquet à l'aide de sa table de routage. Chaque entrée associe un réseau destination (préfixe) à une interface de sortie ou à un prochain saut.
Passerelle par défaut : adresse du routeur auquel un hôte envoie les paquets destinés à un autre réseau.
Règle du plus long préfixe : si plusieurs entrées correspondent, le routeur choisit celle dont le masque est le plus long (la plus spécifique).
Pour savoir si la destination est sur le même réseau, l'hôte compare (IP source ET masque) et (IP destination ET masque).
""",
    """## 3.2 TCP et UDP
TCP : protocole de transport orienté connexion et fiable. Il établit une connexion par une poignée de main en trois temps (SYN, SYN-ACK, ACK), numérote les segments, retransmet les segments perdus et contrôle le flux.
UDP : protocole de transport sans connexion et sans garantie de livraison, plus léger. Il est adapté à la voix sur IP, au streaming ou au DNS, où la rapidité compte plus que la retransmission.
Port : numéro de 16 bits qui identifie un processus sur une machine. Exemples : HTTP 80, HTTPS 443, DNS 53.
Point difficile : TCP est fiable mais pas forcément plus rapide ; la fiabilité a un coût (accusés de réception, retransmissions).

## 3.3 Synthèse
Pour qu'un message HTTP arrive, il faut une adresse IP de destination (couche réseau), un port (couche transport), une route (routage) et une adresse MAC pour chaque saut local (couche liaison).
""",
]

# ---------------------------------------------------------------- fixtures (citations = section headings)
S = {
    "1.1": "1.1 Pourquoi des couches ?", "1.2": "1.2 Le modèle OSI", "1.3": "1.3 Le modèle TCP/IP",
    "2.1": "2.1 Structure d'une adresse IPv4", "2.2": "2.2 Conversion binaire", "2.3": "2.3 Sous-réseaux",
    "3.1": "3.1 Le routage IP", "3.2": "3.2 TCP et UDP", "3.3": "3.3 Synthèse",
}

STRUCTURE = {
    "chapters": [
        {
            "title": "Chapitre 1 : Modèles en couches",
            "summary": "Pourquoi on découpe un réseau en couches, le modèle OSI à 7 couches et le modèle TCP/IP à 4 couches.",
            "citations": [S["1.1"], S["1.2"], S["1.3"]],
            "sections": [
                {"title": S["1.1"], "content": "La communication réseau est découpée en couches : chaque couche rend un service à celle du dessus et utilise celle du dessous. Un protocole fixe le format et l'ordre des messages entre entités de même niveau. À l'émission, chaque couche ajoute un en-tête (encapsulation) ; à la réception, elle le retire.",
                 "objectives": ["Expliquer l'intérêt d'une architecture en couches", "Décrire l'encapsulation"],
                 "key_terms": [{"term": "Protocole", "definition": "Ensemble de règles définissant le format et l'ordre des messages entre entités de même niveau."}, {"term": "Encapsulation", "definition": "Ajout d'un en-tête par chaque couche aux données de la couche supérieure."}],
                 "formulas": [], "hard_points": [], "concept_keys": ["couches"], "citations": [S["1.1"]]},
                {"title": S["1.2"], "content": "Le modèle OSI a 7 couches. Les couches 1 à 4 (physique, liaison, réseau, transport) manipulent respectivement des bits, des trames (adresses MAC), des paquets (adresses IP) et des segments (ports).",
                 "objectives": ["Citer les 7 couches OSI", "Associer chaque couche à son PDU"],
                 "key_terms": [{"term": "Trame", "definition": "PDU de la couche liaison, échangée entre deux nœuds voisins."}, {"term": "Paquet", "definition": "PDU de la couche réseau, acheminé de bout en bout."}],
                 "formulas": [], "hard_points": [], "concept_keys": ["osi"], "citations": [S["1.2"]]},
                {"title": S["1.3"], "content": "TCP/IP regroupe les fonctions en 4 couches : accès réseau, Internet, transport et application. L'adresse MAC sert au saut local, l'adresse IP identifie la machine de bout en bout.",
                 "objectives": ["Comparer OSI et TCP/IP", "Distinguer adresse MAC et adresse IP"],
                 "key_terms": [{"term": "Adresse MAC", "definition": "Identifiant de 48 bits d'une interface sur un réseau local."}],
                 "formulas": [], "hard_points": ["Confusion entre adresse MAC (saut local) et adresse IP (bout en bout)."], "concept_keys": ["tcpip", "mac_vs_ip"], "citations": [S["1.3"]]},
            ],
        },
        {
            "title": "Chapitre 2 : Adressage IPv4",
            "summary": "Structure d'une adresse IPv4, masque et notation CIDR, conversion binaire et découpage en sous-réseaux.",
            "citations": [S["2.1"], S["2.2"], S["2.3"]],
            "sections": [
                {"title": S["2.1"], "content": "Une adresse IPv4 fait 32 bits, notée en décimal pointé. Le masque indique quels bits forment la partie réseau ; en CIDR, /24 veut dire 24 bits de réseau (255.255.255.0).",
                 "objectives": ["Lire une adresse IPv4 et son masque", "Utiliser la notation CIDR"],
                 "key_terms": [{"term": "Masque de sous-réseau", "definition": "Indique quels bits de l'adresse appartiennent à la partie réseau."}, {"term": "CIDR", "definition": "Notation /n indiquant le nombre de bits de la partie réseau."}],
                 "formulas": [], "hard_points": [], "concept_keys": ["ipv4", "masque"], "citations": [S["2.1"]]},
                {"title": S["2.2"], "content": "On convertit chaque octet en binaire avec les poids 128…1. L'adresse réseau s'obtient par un ET logique entre l'adresse IP et le masque ; la diffusion met tous les bits d'hôte à 1.",
                 "objectives": ["Convertir un octet en binaire", "Calculer l'adresse réseau et de diffusion"],
                 "key_terms": [{"term": "Adresse de diffusion", "definition": "Adresse dont tous les bits de la partie hôte sont à 1."}],
                 "formulas": [{"name": "Adresse réseau", "expression": "réseau = IP ET masque", "meaning": "ET logique bit à bit entre l'adresse et le masque."}],
                 "hard_points": [], "concept_keys": ["binaire"], "citations": [S["2.2"]]},
                {"title": S["2.3"], "content": "Créer des sous-réseaux revient à emprunter des bits d'hôte. Avec h bits d'hôte on a 2^h − 2 hôtes utilisables ; avec n bits empruntés on obtient 2^n sous-réseaux. Exemple : /26 donne 62 hôtes.",
                 "objectives": ["Calculer le nombre d'hôtes d'un sous-réseau", "Découper un /24 en sous-réseaux"],
                 "key_terms": [{"term": "Sous-réseau", "definition": "Réseau plus petit obtenu en empruntant des bits à la partie hôte."}],
                 "formulas": [{"name": "Hôtes utilisables", "expression": "2^h − 2", "meaning": "h = nombre de bits d'hôte ; on retire réseau et diffusion."}, {"name": "Nombre de sous-réseaux", "expression": "2^n", "meaning": "n = nombre de bits empruntés."}],
                 "hard_points": ["Oublier de retirer les 2 adresses réservées (réseau et diffusion)."], "concept_keys": ["sous_reseaux"], "citations": [S["2.3"]]},
            ],
        },
        {
            "title": "Chapitre 3 : Routage et transport",
            "summary": "Tables de routage, passerelle par défaut, règle du plus long préfixe, puis TCP, UDP et ports.",
            "citations": [S["3.1"], S["3.2"], S["3.3"]],
            "sections": [
                {"title": S["3.1"], "content": "Un routeur choisit la sortie de chaque paquet grâce à sa table de routage et applique la règle du plus long préfixe. Un hôte envoie à sa passerelle par défaut tout paquet destiné à un autre réseau, ce qu'il détermine en comparant les adresses réseau (ET avec le masque).",
                 "objectives": ["Lire une table de routage", "Appliquer la règle du plus long préfixe"],
                 "key_terms": [{"term": "Passerelle par défaut", "definition": "Routeur auquel un hôte envoie les paquets destinés à un autre réseau."}, {"term": "Plus long préfixe", "definition": "Le routeur choisit l'entrée la plus spécifique qui correspond."}],
                 "formulas": [], "hard_points": [], "concept_keys": ["routage"], "citations": [S["3.1"]]},
                {"title": S["3.2"], "content": "TCP est orienté connexion et fiable (poignée de main SYN, SYN-ACK, ACK ; retransmissions). UDP est sans connexion et plus léger, adapté au temps réel et au DNS. Un port (16 bits) identifie un processus.",
                 "objectives": ["Comparer TCP et UDP", "Associer des services courants à leurs ports"],
                 "key_terms": [{"term": "TCP", "definition": "Transport orienté connexion, fiable, avec retransmission."}, {"term": "UDP", "definition": "Transport sans connexion, sans garantie de livraison."}, {"term": "Port", "definition": "Numéro de 16 bits identifiant un processus."}],
                 "formulas": [], "hard_points": ["Croire que TCP est plus rapide parce qu'il est fiable."], "concept_keys": ["tcp_udp"], "citations": [S["3.2"]]},
                {"title": S["3.3"], "content": "Un message HTTP a besoin d'une IP de destination, d'un port, d'une route et d'une adresse MAC à chaque saut local : toutes les couches coopèrent.",
                 "objectives": ["Relier les couches dans un scénario complet"],
                 "key_terms": [], "formulas": [], "hard_points": [], "concept_keys": ["synthese"], "citations": [S["3.3"]]},
            ],
        },
    ],
    "concepts": [
        {"key": "couches", "name": "Architecture en couches", "description": "Découpage de la communication en couches et encapsulation.", "section_title": S["1.1"], "prerequisites": [], "citations": [S["1.1"]]},
        {"key": "osi", "name": "Modèle OSI", "description": "Les 7 couches et leurs PDU.", "section_title": S["1.2"], "prerequisites": ["couches"], "citations": [S["1.2"]]},
        {"key": "tcpip", "name": "Modèle TCP/IP", "description": "Les 4 couches d'Internet.", "section_title": S["1.3"], "prerequisites": ["osi"], "citations": [S["1.3"]]},
        {"key": "mac_vs_ip", "name": "Adresse MAC vs adresse IP", "description": "Rôle local de la MAC, rôle de bout en bout de l'IP.", "section_title": S["1.3"], "prerequisites": ["osi"], "citations": [S["1.3"]]},
        {"key": "ipv4", "name": "Adresse IPv4", "description": "32 bits, notation décimale pointée.", "section_title": S["2.1"], "prerequisites": ["mac_vs_ip"], "citations": [S["2.1"]]},
        {"key": "masque", "name": "Masque et CIDR", "description": "Séparation réseau / hôte.", "section_title": S["2.1"], "prerequisites": ["ipv4"], "citations": [S["2.1"]]},
        {"key": "binaire", "name": "Conversion binaire et ET logique", "description": "Poids binaires, adresse réseau et diffusion.", "section_title": S["2.2"], "prerequisites": ["ipv4"], "citations": [S["2.2"]]},
        {"key": "sous_reseaux", "name": "Sous-réseaux", "description": "Emprunt de bits, 2^h − 2 hôtes.", "section_title": S["2.3"], "prerequisites": ["masque", "binaire"], "citations": [S["2.3"]]},
        {"key": "routage", "name": "Routage IP", "description": "Table de routage, passerelle, plus long préfixe.", "section_title": S["3.1"], "prerequisites": ["masque", "binaire"], "citations": [S["3.1"]]},
        {"key": "tcp_udp", "name": "TCP et UDP", "description": "Fiabilité vs légèreté, ports.", "section_title": S["3.2"], "prerequisites": ["tcpip"], "citations": [S["3.2"]]},
        {"key": "synthese", "name": "Synthèse des couches", "description": "Toutes les couches dans un échange HTTP.", "section_title": S["3.3"], "prerequisites": ["routage", "tcp_udp"], "citations": [S["3.3"]]},
    ],
    "missing_or_ambiguous": ["Le cours ne détaille pas les couches session et présentation.", "IPv6 et NAT sont mentionnés mais non traités."],
    "confidence": 0.9,
}


def q(concept, prompt, choices, correct, explanation, notes, cites, points=1):
    return {"concept_key": concept, "prompt": prompt, "choices": choices, "correct_index": correct,
            "explanation": explanation, "distractor_notes": notes, "citations": cites, "points": points}


QUIZZES = {"quizzes": [
    {"chapter_title": "Chapitre 1 : Modèles en couches", "questions": [
        q("osi", "À quelle couche OSI l'unité de données s'appelle-t-elle « trame » ?", ["Physique", "Liaison de données", "Réseau", "Transport"], 1,
          "La trame est le PDU de la couche 2 (liaison), qui utilise les adresses MAC.", ["Confond bit (couche 1) et trame.", "", "Confond paquet (couche 3) et trame.", "Confond segment (couche 4) et trame."], [S["1.2"]]),
        q("couches", "Que fait une couche lors de l'encapsulation à l'émission ?", ["Elle retire l'en-tête de la couche inférieure", "Elle ajoute son propre en-tête aux données reçues", "Elle chiffre les données", "Elle choisit la route"], 1,
          "À l'émission, chaque couche ajoute son en-tête ; le retrait se fait à la réception.", ["Inverse émission et réception.", "", "Confond encapsulation et chiffrement.", "Confond avec le rôle du routage."], [S["1.1"]]),
        q("mac_vs_ip", "Quelle adresse reste la même de bout en bout (sans NAT) ?", ["L'adresse MAC", "L'adresse IP", "Le port source", "L'adresse de la passerelle"], 1,
          "L'adresse IP identifie la machine dans l'interconnexion ; la MAC ne sert qu'au saut local.", ["Croit que la MAC traverse les routeurs.", "", "Le port identifie un processus, pas la machine.", "La passerelle n'est que le premier saut."], [S["1.3"]]),
        q("tcpip", "Combien de couches comporte le modèle TCP/IP ?", ["4", "5", "7", "3"], 0,
          "TCP/IP regroupe les fonctions en 4 couches : accès réseau, Internet, transport, application.", ["", "Confusion avec des variantes pédagogiques.", "Confond avec OSI.", "Oublie une couche."], [S["1.3"]]),
    ]},
    {"chapter_title": "Chapitre 2 : Adressage IPv4", "questions": [
        q("sous_reseaux", "Combien d'hôtes utilisables dans le réseau 192.168.1.0/26 ?", ["64", "62", "26", "30"], 1,
          "h = 32 − 26 = 6 bits d'hôte, donc 2^6 − 2 = 62.", ["Oublie de retirer réseau et diffusion.", "", "Confond le préfixe et le nombre d'hôtes.", "Calcule avec 5 bits d'hôte (/27)."], [S["2.3"]]),
        q("binaire", "Quelle est l'écriture binaire de 192 ?", ["11000000", "10100000", "11100000", "10000001"], 0,
          "192 = 128 + 64, donc les deux bits de poids fort sont à 1 : 11000000.", ["", "Utilise 128 + 32.", "Utilise 128 + 64 + 32 (= 224).", "Ajoute le bit de poids 1 par erreur."], [S["2.2"]]),
        q("masque", "Que signifie la notation /24 ?", ["24 hôtes possibles", "Les 24 premiers bits sont la partie réseau", "Le masque 255.255.0.0", "24 sous-réseaux"], 1,
          "En CIDR, /24 signifie 24 bits de réseau, soit le masque 255.255.255.0.", ["Confond préfixe et nombre d'hôtes.", "", "255.255.0.0 correspond à /16.", "Confond préfixe et nombre de sous-réseaux."], [S["2.1"]]),
        q("binaire", "Comment obtient-on l'adresse réseau ?", ["IP OU masque", "IP ET masque", "IP + masque", "Tous les bits d'hôte à 1"], 1,
          "L'adresse réseau est le ET logique bit à bit entre l'adresse IP et le masque.", ["Confond ET et OU.", "", "Additionne au lieu d'un ET logique.", "C'est l'adresse de diffusion."], [S["2.2"]]),
    ]},
    {"chapter_title": "Chapitre 3 : Routage et transport", "questions": [
        q("routage", "Deux entrées correspondent : 10.0.0.0/8 et 10.1.0.0/16. Laquelle le routeur choisit-il pour 10.1.2.3 ?", ["10.0.0.0/8", "10.1.0.0/16", "La première de la table", "Aucune, il jette le paquet"], 1,
          "Règle du plus long préfixe : /16 est plus spécifique que /8.", ["Choisit le préfixe le plus court.", "", "Croit que l'ordre de la table décide.", "Croit qu'une ambiguïté bloque le routage."], [S["3.1"]]),
        q("tcp_udp", "Quel protocole utilise une poignée de main en trois temps ?", ["UDP", "TCP", "IP", "DNS"], 1,
          "TCP établit la connexion par SYN, SYN-ACK, ACK.", ["UDP est sans connexion.", "", "IP n'établit pas de connexion.", "DNS est un service applicatif (souvent sur UDP)."], [S["3.2"]]),
        q("tcp_udp", "Pourquoi la voix sur IP utilise-t-elle souvent UDP ?", ["Parce qu'UDP est fiable", "Parce que la rapidité compte plus que la retransmission", "Parce qu'UDP chiffre les données", "Parce que TCP ne gère pas les ports"], 1,
          "Pour le temps réel, retransmettre un paquet en retard ne sert à rien ; UDP est plus léger.", ["UDP n'offre pas de garantie de livraison.", "", "UDP ne chiffre pas.", "TCP utilise aussi des ports."], [S["3.2"]]),
    ]},
]}

EXERCISES = {"exercises": [
    {"section_title": S["2.3"], "questions": [
        q("sous_reseaux", "On découpe 192.168.1.0/24 en sous-réseaux /26. Quelle est l'adresse du 3e sous-réseau ?", ["192.168.1.64", "192.168.1.128", "192.168.1.192", "192.168.1.96"], 1,
          "Les /26 avancent de 64 : .0, .64, .128, .192. Le 3e est 192.168.1.128.", ["C'est le 2e sous-réseau.", "", "C'est le 4e sous-réseau.", "Utilise un pas de 32 (/27)."], [S["2.3"]]),
        q("sous_reseaux", "Combien de bits faut-il emprunter pour obtenir 8 sous-réseaux ?", ["2", "3", "4", "8"], 1,
          "2^n ≥ 8 donne n = 3.", ["2^2 = 4 sous-réseaux seulement.", "", "2^4 = 16, plus que nécessaire.", "Confond n et 2^n."], [S["2.3"]]),
    ]},
    {"section_title": S["2.2"], "questions": [
        q("binaire", "Quelle est l'adresse de diffusion de 192.168.1.0/26 ?", ["192.168.1.63", "192.168.1.64", "192.168.1.255", "192.168.1.62"], 0,
          "6 bits d'hôte à 1 : .0 + 63 = 192.168.1.63.", ["", "C'est l'adresse du sous-réseau suivant.", "C'est la diffusion du /24 entier.", "C'est le dernier hôte utilisable."], [S["2.2"], S["2.3"]]),
    ]},
    {"section_title": S["3.1"], "questions": [
        q("routage", "Un hôte 192.168.1.10/24 envoie à 192.168.2.5. Que fait-il ?", ["Il envoie directement à 192.168.2.5", "Il envoie à sa passerelle par défaut", "Il diffuse à tout le réseau", "Il abandonne"], 1,
          "192.168.1.0 ≠ 192.168.2.0 après ET avec le masque : la destination est sur un autre réseau, donc passerelle.", ["Ignore la comparaison des adresses réseau.", "", "Confond avec la résolution locale.", "Il existe une passerelle pour ce cas."], [S["3.1"]]),
    ]},
    {"section_title": S["1.2"], "questions": [
        q("osi", "Une adresse MAC est utilisée par quelle couche OSI ?", ["Physique", "Liaison de données", "Réseau", "Application"], 1,
          "La couche liaison transmet des trames entre voisins et utilise les adresses MAC.", ["La couche physique transmet des bits sans adressage.", "", "La couche réseau utilise les adresses IP.", "L'application n'utilise pas d'adresse MAC."], [S["1.2"]]),
    ]},
]}

REVISION = {
    "summaries": [
        {"chapter_title": "Chapitre 1 : Modèles en couches", "bullets": ["Chaque couche rend un service à la couche supérieure ; un protocole fixe les règles entre entités de même niveau.", "Encapsulation : ajout d'en-têtes à l'émission, retrait à la réception.", "OSI = 7 couches ; PDU : bit, trame, paquet, segment.", "TCP/IP = 4 couches ; MAC pour le saut local, IP de bout en bout."], "citations": [S["1.1"], S["1.2"], S["1.3"]]},
        {"chapter_title": "Chapitre 2 : Adressage IPv4", "bullets": ["IPv4 = 32 bits en décimal pointé ; le masque sépare réseau et hôte.", "/n = n bits de réseau (/24 = 255.255.255.0).", "Adresse réseau = IP ET masque ; diffusion = bits d'hôte à 1.", "Hôtes utilisables = 2^h − 2 ; sous-réseaux = 2^n."], "citations": [S["2.1"], S["2.2"], S["2.3"]]},
        {"chapter_title": "Chapitre 3 : Routage et transport", "bullets": ["Le routeur utilise sa table de routage et la règle du plus long préfixe.", "Passerelle par défaut pour tout autre réseau.", "TCP : connexion, fiabilité, retransmission ; UDP : léger, sans garantie.", "Port = 16 bits ; HTTP 80, HTTPS 443, DNS 53."], "citations": [S["3.1"], S["3.2"]]},
    ],
    "flashcards": [
        {"front": "Hôtes utilisables avec h bits d'hôte", "back": "2^h − 2 (on retire réseau et diffusion)", "kind": "formula", "citations": [S["2.3"]]},
        {"front": "Nombre de sous-réseaux avec n bits empruntés", "back": "2^n", "kind": "formula", "citations": [S["2.3"]]},
        {"front": "Adresse réseau", "back": "IP ET masque (bit à bit)", "kind": "formula", "citations": [S["2.2"]]},
        {"front": "Encapsulation", "back": "Chaque couche ajoute son en-tête aux données de la couche supérieure.", "kind": "term", "citations": [S["1.1"]]},
        {"front": "PDU de la couche 2", "back": "La trame", "kind": "term", "citations": [S["1.2"]]},
        {"front": "Plus long préfixe", "back": "Le routeur choisit l'entrée correspondante la plus spécifique.", "kind": "concept", "citations": [S["3.1"]]},
        {"front": "TCP vs UDP", "back": "TCP : orienté connexion et fiable. UDP : sans connexion, plus léger.", "kind": "concept", "citations": [S["3.2"]]},
        {"front": "/24", "back": "Masque 255.255.255.0 (24 bits de réseau)", "kind": "term", "citations": [S["2.1"]]},
    ],
}

MOCK_EXAM = {
    "title": "Examen blanc — Introduction aux réseaux (démo)",
    "duration_minutes": 30,
    "questions": [
        *[{**x, "points": 2} for x in QUIZZES["quizzes"][1]["questions"][:2]],
        q("masque", "Quel masque correspond à /27 ?", ["255.255.255.224", "255.255.255.240", "255.255.255.192", "255.255.255.0"], 0,
          "27 bits à 1 : le dernier octet vaut 128+64+32 = 224.", ["", "Correspond à /28.", "Correspond à /26.", "Correspond à /24."], [S["2.1"], S["2.2"]], 2),
        q("synthese", "Pour qu'un message HTTP arrive, de quoi a-t-on besoin à chaque saut local ?", ["D'un nouveau port", "D'une adresse MAC", "D'une nouvelle adresse IP de destination", "D'une poignée de main TCP"], 1,
          "La couche liaison a besoin de l'adresse MAC du prochain nœud à chaque saut.", ["Le port ne change pas par saut.", "", "L'IP de destination reste la même.", "La poignée de main se fait une fois, de bout en bout."], [S["3.3"]], 2),
        *[{**x, "points": 1} for x in QUIZZES["quizzes"][2]["questions"][:2]],
        *[{**x, "points": 1} for x in QUIZZES["quizzes"][0]["questions"][:2]],
    ],
}

PROJECTS = {
    "Chapitre 2 : Adressage IPv4": {"projects": [
        {"title": "Calculateur de sous-réseaux en ligne de commande", "goal": "Écrire un petit programme (Python ou C) qui, à partir d'une adresse et d'un préfixe, affiche adresse réseau, diffusion et nombre d'hôtes.",
         "concept_keys": ["binaire", "masque", "sous_reseaux"], "steps": ["Lire l'adresse et le préfixe", "Convertir en entier 32 bits", "Calculer réseau = IP ET masque", "Calculer diffusion et 2^h − 2", "Comparer avec 5 exemples calculés à la main"],
         "difficulty": "beginner", "effort_hours": 4, "materials": ["Un ordinateur", "Python 3 ou un compilateur C"], "success_criteria": ["Résultats corrects pour /24, /26, /27 et /30", "Gestion d'une entrée invalide"]},
        {"title": "Plan d'adressage d'un club étudiant", "goal": "Concevoir le plan d'adressage d'un petit réseau (Wi-Fi invités, bureau, serveurs) à partir de 192.168.10.0/24.",
         "concept_keys": ["sous_reseaux", "masque"], "steps": ["Lister les besoins en hôtes par zone", "Choisir les préfixes", "Attribuer les plages", "Documenter dans un tableau"],
         "difficulty": "intermediate", "effort_hours": 3, "materials": ["Tableur", "Optionnel : Cisco Packet Tracer"], "success_criteria": ["Aucun chevauchement de plages", "Chaque zone a assez d'adresses"]},
    ]},
}
