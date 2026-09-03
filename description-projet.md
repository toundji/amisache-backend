# Description du projet — Amisache

> Ce document donne le **sens** du projet : de quoi il s'agit, pour qui, où il en est, et ce que le logo doit incarner. À lire avec la charte graphique et le cahier des charges.

---

## En une phrase

**Amisache** (qui signifie « mon église ») est une plateforme numérique unique qui rassemble **toutes les églises catholiques du Bénin** — pour trouver sa paroisse, connaître les horaires des messes, demander une intention de messe, faire un don — conçue dès le départ pour **s'étendre à d'autres pays**.

---

## Contexte

Au Bénin, la plupart des paroisses n'ont aucune présence en ligne. Les fidèles n'ont pas d'endroit simple pour trouver l'église la plus proche, ses horaires, ou pour demander une messe. Chaque paroisse qui souhaite un site doit le construire seule, sans cohérence ni mutualisation. La plateforme comble ce manque avec un outil **mobile d'abord**, adapté à une connexion faible, et diffusé par les canaux réels du terrain : **WhatsApp et QR codes** affichés à l'entrée des églises.

Elle est pensée comme un **centre commercial** : une base commune, propre et cohérente, où **chaque paroisse a sa propre page** avec son nom, sa photo et sa couleur — ce qui lui donne un sentiment d'appartenance tout en gardant l'unité de l'ensemble.

---

## Mission & vision

**Rapprocher chaque fidèle de sa paroisse**, et donner à chaque église — même la plus modeste — une présence numérique digne, au sein d'un ensemble qui reflète l'unité de l'Église.

À terme : une infrastructure commune pour l'Église catholique, extensible pays par pays, sans jamais effacer l'identité locale de chaque paroisse.

---

## Public

- **Les fidèles** : trouver une église, des horaires, demander une messe, faire un don, suivre la vie de leur paroisse.
- **Les curés et secrétariats** : gérer la page de la paroisse, les horaires, les intentions reçues, les annonces.
- **Les diocèses et la Conférence épiscopale** : valider les paroisses, superviser, communiquer, piloter à l'échelle nationale.

---

## Fonctions clés

- Église la plus proche (géolocalisation + carte) et fiche de chaque paroisse.
- **Découverte de proximité** : « où et quand est la prochaine messe autour de moi », avec distinction messe *en cours* / *à venir*.
- Horaires des messes, confessions, adoration, horaires spéciaux (Avent, Carême, fêtes patronales).
- Demande d'intention de messe (défunt, action de grâce, guérison…) rattachée à une célébration précise, avec suivi.
- Dons et offrandes via **Mobile Money (MTN MoMo, Moov Money)**, flux déclaratif à validation par le clergé.
- Sacrements (baptême, mariage, confirmation…) : demandes en ligne.
- Communication : annonces, événements, médias (vidéos, albums), partage WhatsApp.
- Groupes et communautés (chorales, mouvements, associations).
- Page dédiée par paroisse, personnalisable dans un cadre commun.

---

## État d'avancement

Le projet a dépassé le stade du concept : le **domaine est modélisé** et l'**architecture est arrêtée**. Ce qui existe aujourd'hui :

- **Cadrage complet** — un cahier des charges structuré (contexte, parties prenantes, périmètre, exigences fonctionnelles et non fonctionnelles, phasage, décisions en suspens).
- **Modèle de données finalisé** — un diagramme de classes UML de **18 entités** et **16 énumérations**, fourni en Mermaid (source) et SVG (rendu). Les grands choix de structure sont posés :
  - une **hiérarchie ecclésiale unifiée** dans une seule table `Church` auto-référente (conférence → archidiocèse → diocèse → doyenné → paroisse → communauté → église/chapelle) ;
  - un **module Adresse réutilisable** (`Country` → `Region` → `Zone` → `Village`) qui gère les découpages propres à chaque pays ;
  - une **table `Request` unifiée** pour les intentions de messe et les sacrements ;
  - une table de **types mutualisée** qui évite tout redéploiement pour ajouter une valeur ;
  - un **flux de paiement déclaratif** réaliste (numéro Mobile Money publié → reçu joint → confirmation par le clergé).
- **Architecture technique définie** — backend **NestJS** sur base du template `amisache-backend`, ORM TypeORM, base PostgreSQL, recherche géospatiale (PostGIS) pour la proximité, conception **multi-tenant** et **multi-pays**.
- **Identité visuelle établie** — une charte graphique complète : palette (bleu firmament, or de gloire, bleu ciel, blanc nuage), typographies (Cormorant + Inter), règles d'usage et principe « unir sans uniformiser ».
- **Documentation produite** — cahier des charges, description du projet, module Adresse documenté à part, et l'ensemble des diagrammes en double format.

En résumé : la **fondation conceptuelle est prête**. Il reste à trancher le périmètre du premier lancement et à passer à la réalisation.

---

## Prochaines étapes

- **Logo** — génération à partir de cette description et de la charte graphique.
- **Priorisation MVP** — arbitrage valeur/effort pour fixer le périmètre du premier lancement (annuaire + vie liturgique + intentions + paiement déclaratif).
- **Présentation institutionnelle** — un inventaire de fonctionnalités structuré, destiné à la **Conférence épiscopale du Bénin** pour obtenir la caution du projet.
- **Décisions sensibles à arbitrer avec l'autorité ecclésiale** — registres sacramentels et délivrance de certificats.
- **Ensuite** — développement, puis encaissement automatique (API Mobile Money) et ouverture multi-pays.

---

## Valeurs & esprit

- **Unir sans uniformiser** — une identité commune forte, mais chaque paroisse garde sa couleur.
- **Sacré et céleste** — l'expérience doit inspirer l'élévation, la paix, la majesté du ciel.
- **Sérieux institutionnel** — la plateforme doit inspirer confiance à la hiérarchie de l'Église.
- **Accessible à tous** — simple, lisible sur téléphone modeste, en connexion faible, multilingue (français, puis fon, yoruba…).
- **Universelle** — catholique avant d'être nationale, prête à franchir les frontières.

---

## Ce que le logo doit incarner

En une image : **le ciel qui rassemble**.

Un signe qui dit à la fois le **sacré catholique** (Marie via le bleu, la lumière divine via l'or, éventuellement une croix ou une étoile), l'**élévation et la majesté des cieux**, et l'idée d'un **rassemblement** — une seule maison sous un même ciel, où chaque paroisse a sa place. Noble, lumineux, paisible ; ni sévère, ni national, ni daté.
