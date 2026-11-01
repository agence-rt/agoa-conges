# AGOA CG — Calendrier des congés

Application Windows de l'agence pour pointer les congés des collaborateurs.

- **Mois** : calendrier ou planning par collaborateur, avec jours fériés.
- **Année** : les 12 mois d'un coup, avec le nombre d'absents par jour et un tableau des jours ouvrés par mois.
- **Compte rendu** : pour un mois, jours de CP et de RTT par personne, avec les dates. Il se copie en texte ou s'enregistre en `.txt`. Jusqu'au 10 du mois, l'onglet s'ouvre sur le mois qui vient de se terminer.

Les jours ouvrés excluent les week-ends et les jours fériés de France métropolitaine.

## Installer

Télécharger `AGOA-CG-Setup-x.y.z.exe` dans la dernière [Release](https://github.com/agence-rt/agoa-conges/releases/latest) et le lancer. L'assistant est en français et propose le dossier d'installation.

Windows peut afficher « Windows a protégé votre ordinateur » : l'application n'est pas signée. Cliquer sur **Informations complémentaires**, puis **Exécuter quand même**.

Ensuite, l'application cherche toute seule les nouvelles versions au lancement et propose de redémarrer pour les installer. Le bouton **Dossier de données**, puis **Rechercher une mise à jour**, permet de vérifier à la demande.

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
```

| Fichier | Rôle |
| --- | --- |
| `main.js`, `preload.js` | Fenêtre, accès au fichier de données, mises à jour, enregistrement du `.txt` |
| `lib/store.js` | Lecture, fusion et écriture du fichier partagé |
| `src/` | Interface (`index.html`, `style.css`, `app.js`) |
| `scripts/make_icon.py` | Icône : carré rouge de l'agence (`#B3261E`), code `CG` en gras (charte AGOA) |
| `scripts/deploy.js` | Prépare un déploiement (numéro, version, journal) |
| `.github/workflows/release.yml` | Fabrique l'installateur et publie la Release |

## Publier un déploiement

```
npm run deploy -- "Description de la mise à jour"
git push
```

Le script incrémente le numéro de déploiement, aligne la version (`0.<n>.0`), met à jour `DEPLOIEMENTS.md` et crée le commit. Dès que la nouvelle version arrive sur `main`, GitHub Actions fabrique l'installateur et publie la Release (étiquette `vX.Y.Z` comprise). Les postes installés se mettent à jour seuls.
