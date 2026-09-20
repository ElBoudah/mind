# Mind

Une application personnelle, téléphone uniquement, pour poser ce qui occupe l'esprit :
des sujets rangés par thème, avec un poids ressenti, des actions, des décisions et un journal.
Rien ne quitte le téléphone : les données vivent dans le navigateur, sauvegarde par export JSON.

Design : `docs/superpowers/specs/2026-09-20-tableau-de-bord-esprit-design.md`

## Utiliser

Ouvrir https://elboudah.github.io/mind/ sur le téléphone, puis « Ajouter à l'écran d'accueil ».

## Développer

Aucune dépendance. Servir le dossier :

    python3 -m http.server 8080

Tests (Node 20 ou plus) :

    npm test

## Déployer

Le site est servi par GitHub Pages depuis la racine de la branche `main`.
À chaque changement de fichier servi, incrémenter `CACHE_NAME` dans `sw.js`, puis :

    git push

## Sauvegarder ses données

Réglages → Exporter mes données. Le fichier `mind-AAAA-MM-JJ.json` se réimporte depuis le même écran.
