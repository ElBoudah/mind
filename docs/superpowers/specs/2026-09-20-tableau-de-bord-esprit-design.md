# Tableau de bord de l'esprit — design V1

Date : 2026-09-20
Statut : validé en brainstorming, en attente de relecture

## 1. Intention

Une application personnelle pour externaliser ce qui occupe l'esprit : relations, recherche de job, projets, inquiétudes. Chaque préoccupation devient un **sujet** avec un poids ressenti, un texte d'intention, des actions, des décisions et un journal daté. Un sujet se **pose** quand il n'a plus besoin d'attention, sans être « terminé ».

Philosophie : capturer, comprendre, agir, poser. Calme, sans notification, sans compteur anxiogène. Le cas d'usage prioritaire est le suivi des relations.

Ce n'est pas un gestionnaire de tâches : une action n'a pas de date, l'agenda reste à l'extérieur.

## 2. Contraintes

- Téléphone uniquement, usage en portrait.
- PWA statique déployée sur GitHub Pages, installable sur l'écran d'accueil, fonctionne hors ligne.
- Aucun serveur, aucun compte. Données dans le stockage local du navigateur.
- Sauvegarde par export/import manuel d'un fichier JSON.
- Pas d'outillage de build : HTML, CSS et modules JavaScript natifs.

## 3. Modèle mental

- L'arbre a une profondeur libre. Les **racines** sont les thèmes (Relations, Travail, Moi…). En dessous, des sujets et des sous-sujets sans limite.
- Un sujet a un **poids** de 0 à 3. 0 signifie « ne pèse pas » : le sujet existe, peut avoir des actions et un journal, mais n'apparaît pas dans « Ce qui pèse ». Exemple : la fiche d'une personne rencontrée une fois.
- Les thèmes n'ont pas de poids.
- Une **entrée** est un événement daté rattaché à un sujet : pensée, décision, action ou changement de poids.
- Une action est une entrée de type action ; elle est **ouverte** tant qu'elle n'a pas de date de réalisation. La cocher remplit cette date et l'entrée bascule dans le journal.
- **Poser** un sujet le retire de l'accueil (ses actions ouvertes aussi) et conserve tout son historique. Un sujet posé peut être repris.

### Garde-fous contre la perte de repères

1. L'accueil reste plat quelle que soit la profondeur : il agrège tous les sujets qui pèsent et toutes les actions ouvertes de tout l'arbre, chaque ligne indiquant son sujet direct.
2. Chaque fiche affiche un fil d'Ariane cliquable.
3. Les actions ouvertes des sous-sujets remontent dans la fiche du parent, marquées de leur origine.
4. Une recherche globale sur les titres, sujets posés inclus.

## 4. Écrans

### 4.1 Accueil

Défilement vertical, sans bandeau de titre. Trois zones dans cet ordre :

**Ce qui pèse.** Tous les sujets actifs avec un poids supérieur à 0, triés par poids décroissant puis par date de dernière entrée croissante (le plus ancien d'abord). Chaque ligne : trois points pleins ou vides, titre, chemin du parent en petit. Un tap ouvre la fiche. Si la liste est vide : une ligne « Rien ne pèse en ce moment. »

**À faire.** Toutes les actions ouvertes des sujets actifs de tout l'arbre, avec le titre de leur sujet direct. Une case à cocher par ligne, cocher se fait sur place. Tri par date de création, la plus ancienne d'abord. Un tap sur le texte ouvre la fiche du sujet.

**Thèmes.** Les sujets racines actifs, avec le nombre de sujets actifs dans leur sous-arbre. Un tap ouvre la fiche du thème.

**Pied de page.** Trois icônes discrètes : vue d'ensemble, recherche et réglages.

**Bouton flottant +** en bas à droite : crée un sujet. Formulaire minimal : titre, et sélection du parent parmi les thèmes et sujets actifs (par défaut le premier thème). Le poids et l'intention se remplissent ensuite dans la fiche.

### 4.2 Fiche d'un sujet

Défilement vertical. Sections dans cet ordre :

1. **Fil d'Ariane** cliquable, du thème jusqu'au parent direct, passe à la ligne si trop long.
2. **Titre** et, à droite, le **poids** en trois points. Un tap sur le poids fait défiler 0, 1, 2, 3. Chaque changement crée une entrée de type poids dans le journal.
3. **Intention** : bloc de texte libre, optionnel, éditable sur place. Une seule zone, sans découpage imposé.
4. **À faire** : actions ouvertes du sujet et de son sous-arbre, celles des enfants avec le titre de l'enfant en petit. Cocher sur place.
5. **Sous-sujets** : titre, poids ou tiret, ancienneté de la dernière entrée. Bouton « + sous-sujet » en fin de liste.
6. **Journal** : toutes les entrées du sujet et de son sous-arbre, la plus récente en haut. Les entrées venues d'un descendant portent leur chemin relatif en petit (« Amis › Lucas »), cliquable ; les changements de poids des descendants ne remontent pas. Au-delà de 30 entrées, un bouton « Voir N entrées de plus ». Rendu par type : pensée en texte simple, décision avec une étoile, action faite avec une coche et le préfixe « Fait : », changement de poids en ligne grise discrète. Appui long sur une entrée : modifier ou supprimer.
7. **Barre basse** : bouton « + pensée » et menu « ⋯ ».

**Zone de saisie** (ouverte par « + pensée ») : glisse depuis le bas, trois onglets pensée / action / décision, un champ texte, un bouton valider. Pensée et décision vont au journal, action va dans « À faire ».

**Menu ⋯** : renommer, déplacer vers un autre parent, poser, supprimer.

- *Poser* : confirmation d'une ligne, avec un champ optionnel « un dernier mot » qui devient une pensée dans le journal. Le sujet posé affiche en haut un bandeau « Posé depuis N jours » et un bouton « Reprendre ».
- *Déplacer* : liste des sujets actifs éligibles (pas lui-même ni un de ses descendants).
- *Supprimer* : voir 5.4.

**Fiche d'un thème** : même écran, sans poids, avec la section Sous-sujets placée en premier.

### 4.3 Recherche

Un champ texte, résultats filtrés sur les titres au fil de la frappe, insensibles à la casse et aux accents. Chaque résultat affiche son chemin, les sujets posés sont marqués comme tels. Un tap ouvre la fiche.

### 4.4 Vue d'ensemble

Un plan en retrait, texte seul : les thèmes en en-têtes, leurs sujets en dessous avec poids et ancienneté de la dernière entrée, les sous-sujets repliés derrière « ▸ N sujets ». Un tap sur le chevron déplie ou replie la branche, un tap sur un titre ouvre la fiche. Les sujets posés sont masqués, un bouton en bas les affiche.

### 4.5 Réglages

- Apparence : système / clair / sombre.
- Exporter mes données.
- Importer des données.
- Sujets posés : liste avec date de pose et chemin, un tap ouvre la fiche.
- Numéro de version de l'application.

## 5. Données

### 5.1 Schéma

```
Document
  version      entier, version du schéma (1)
  subjects     liste de Subject
  entries      liste de Entry

Subject
  id           chaîne unique
  parentId     chaîne ou null (null = thème racine)
  title        chaîne
  intent       chaîne, peut être vide
  weight       entier 0..3 (toujours 0 pour une racine)
  order        entier, ordre parmi les frères
  createdAt    date ISO
  restedAt     date ISO ou null (null = actif)

Entry
  id           chaîne unique
  subjectId    chaîne
  type         "thought" | "decision" | "action" | "weight"
  content      chaîne (pour weight : la nouvelle valeur "0".."3")
  createdAt    date ISO
  doneAt       date ISO ou null (utilisé seulement pour action)
```

Définitions dérivées :

- Sujet **actif** : `restedAt` null et tous ses ancêtres actifs.
- Action **ouverte** : entrée de type action avec `doneAt` null, sur un sujet actif.
- **Dernière mise à jour** d'un sujet : date de sa dernière entrée, sinon sa date de création.

### 5.2 Stockage

Un seul document JSON, tenu en mémoire, réécrit dans le stockage local du navigateur après chaque opération. Une clé unique. Au chargement, si la version du document est inférieure à la version courante, une migration séquentielle est appliquée avant usage.

À la première ouverture (aucun document), trois thèmes sont créés : Relations, Travail, Moi.

### 5.3 Export et import

- Export : téléchargement du document tel quel, nommé `mind-AAAA-MM-JJ.json`.
- Import : sélection d'un fichier, lecture, validation (JSON valide, champ `version` reconnu, listes présentes, identifiants uniques, références `parentId` et `subjectId` résolues, pas de cycle). En cas d'échec, message explicite et aucune modification. Si valide, confirmation « Remplacer toutes les données actuelles ? » puis remplacement et migration si nécessaire.

### 5.4 Suppression

Supprimer un sujet supprime son sous-arbre et toutes les entrées concernées. Confirmation indiquant le nombre de sujets et d'entrées. Si le total d'entrées dépasse 5, la confirmation propose un bouton « Exporter d'abord ».

### 5.5 Hors ligne

Un service worker met en cache tous les fichiers de l'application à l'installation. Stratégie : servir depuis le cache, rafraîchir en arrière-plan. Quand une nouvelle version est publiée, elle est entièrement précachée puis prend le contrôle immédiatement (`skipWaiting`), afin qu'un onglet resté ouvert des jours sur le téléphone ne bloque pas la mise à jour ; la page en cours garde son code jusqu'au prochain chargement, les données ne sont pas affectées. Le manifest déclare le nom, les icônes, l'orientation portrait et l'affichage autonome.

## 6. Structure du code

Fichiers à la racine du dépôt, servis directement par GitHub Pages :

- `index.html`, `style.css`, `manifest.webmanifest`, `sw.js`, dossier `icons/`
- `js/store.js` : possède l'état. Chargement, sauvegarde, migrations, et toutes les opérations : créer / renommer / déplacer / poser / reprendre / supprimer un sujet, changer le poids, ajouter / modifier / supprimer une entrée, cocher une action, exporter, importer. Aucune connaissance du DOM.
- `js/queries.js` : fonctions pures de lecture sur un document : sujets qui pèsent, actions ouvertes d'un sous-arbre, fil d'Ariane, enfants triés, comptages, dernière mise à jour, recherche.
- `js/views/home.js`, `subject.js`, `search.js`, `settings.js` : chaque vue rend son HTML à partir du document et branche ses événements.
- `js/router.js` : routage par fragment d'URL (`#/`, `#/s/<id>`, `#/search`, `#/settings`) pour que le bouton retour du téléphone fonctionne.
- `js/app.js` : point d'entrée, relie store, router et vues.

Le store expose un mécanisme d'abonnement : chaque opération notifie, la vue courante se rerend.

## 7. Apparence

- Thèmes clair et sombre, suivant le réglage du téléphone par défaut.
- Typographie système, taille de base généreuse, interlignage aéré, beaucoup de marge.
- Une seule couleur d'accent discrète pour les points de poids, les cases cochées et le bouton +.
- Aucune animation en dehors de l'apparition de la zone de saisie.
- Aucune notification, aucun compteur d'alerte, aucun rouge.

## 8. Tests

`store.js` et `queries.js` sont testés avec le lanceur de tests intégré à Node, sans dépendance. Le stockage local est remplacé par un adaptateur en mémoire injecté au store.

Cas couverts au minimum :

- Cocher une action la retire des actions ouvertes et la fait apparaître dans le journal avec `doneAt`.
- Les actions ouvertes d'un sous-sujet remontent dans le parent et à l'accueil.
- Poser un sujet retire le sujet et les actions de son sous-arbre de l'accueil ; reprendre les réaffiche.
- Un sujet de poids 0 n'apparaît pas dans « Ce qui pèse » mais ses actions apparaissent dans « À faire ».
- Changer le poids crée une entrée de type poids.
- Déplacer un sujet refuse un descendant comme cible.
- Supprimer un sujet supprime tout le sous-arbre et ses entrées.
- Un import invalide ne modifie rien ; un import valide remplace tout.
- La migration d'un document d'une version antérieure produit un document valide.
- La recherche ignore casse et accents.

Les vues sont vérifiées à la main sur téléphone.

## 9. Hors périmètre V1

- Assistant IA pour structurer un « vidage de tête ».
- Sauvegarde automatique vers un dépôt GitHub.
- Dates ou échéances sur les actions, notifications.
- Réordonnancement par glisser-déposer (l'ordre des frères est celui de création).
- Trois dimensions importance / urgence / préoccupation : un seul poids.
- Pièces jointes, images, liens.
