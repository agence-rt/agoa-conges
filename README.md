# AGOA CG — Calendrier des congés

Application Windows de l'agence pour pointer les congés des collaborateurs.

- **Mois** : calendrier ou planning par collaborateur, avec jours fériés.
- **Année** : les 12 mois d'un coup, avec le nombre d'absents par jour et un tableau des jours ouvrés par mois.
- **Compte rendu** : pour un mois, jours de CP et de RTT par personne, avec les dates. Il se copie en texte ou s'enregistre en `.txt`. Jusqu'au 10 du mois, l'onglet s'ouvre sur le mois qui vient de se terminer.

Les jours ouvrés excluent les week-ends et les jours fériés de France métropolitaine.

## Installer

1. Ouvrir la page **Actions** du dépôt, puis la dernière compilation réussie, et télécharger `AGOA-CG-windows`. Une fois une version publiée, les fichiers sont aussi dans **Releases**.
2. Lancer `AGOA-CG-Setup-x.y.z.exe` (installation) ou `AGOA-CG-Portable-x.y.z.exe` (sans installation).

Windows peut afficher « Windows a protégé votre ordinateur » : l'application n'est pas signée. Cliquer sur **Informations complémentaires**, puis **Exécuter quand même**.

## Partager le calendrier entre les postes

Les données sont dans un seul fichier, `agoa-conges.json`.

1. Sur un premier poste : bouton **Dossier de données**, puis **Choisir un dossier…** et sélectionner un dossier de la Dropbox partagée. Les données déjà saisies y sont copiées.
2. Sur les autres postes : choisir **le même dossier**. Le fichier existant est repris tel quel.

Le calendrier se met à jour tout seul quand un autre poste modifie le fichier. Chaque enregistrement relit le fichier avant d'écrire et fusionne fiche par fiche, donc deux personnes qui saisissent en même temps ne s'écrasent pas. Si Dropbox crée une « copie en conflit », elle est fusionnée puis renommée en `.fusionne` (rien n'est supprimé).

Le fichier contient les noms et les dates d'absence : ne pas le placer dans un dossier public.

## Développer

```
npm install
npm start        # lance l'application
npm test         # tests du stockage
npm run icon     # régénère l'icône (build/icon.png et build/icon.ico)
npm run dist     # compile l'installateur Windows (à lancer sous Windows)
```

| Fichier | Rôle |
| --- | --- |
| `main.js`, `preload.js` | Fenêtre, accès au fichier de données, enregistrement du `.txt` |
| `lib/store.js` | Lecture, fusion et écriture du fichier partagé |
| `src/` | Interface (`index.html`, `style.css`, `app.js`) |
| `scripts/make_icon.py` | Icône : carré rouge, code `CG` en gras (charte AGOA) |
| `.github/workflows/build.yml` | Compilation Windows automatique |

La couleur de l'icône est dans `scripts/make_icon.py` (`RED`). La remplacer par le rouge exact de l'agence, puis lancer `npm run icon`.

## Compilation et versions

Chaque envoi sur `main` lance une compilation sur GitHub (onglet **Actions**). Pour publier une version téléchargeable dans **Releases** :

```
git tag v1.0.0
git push origin v1.0.0
```
