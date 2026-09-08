# La boîte unique — démonstration exécutable

Démonstration destinée au rendez-vous client. Elle tourne sur un portable,
sans internet, sans compte, sans installation autre qu'une commande.

```bash
./lancer.sh          # http://127.0.0.1:8000
```

ou, si vous préférez le conteneur :

```bash
docker compose up --build
```

---

## Ce qui est réel, ce qui est simulé

C'est la première chose à dire au client. La règle est simple : **tout ce
qu'AI Brothers écrira est réel dans cette démonstration ; tout ce qui viendra
d'un moteur tiers est simulé.**

| Réel — du code de production | Simulé — remplacé en production |
|---|---|
| Routage d'un mail vers son dossier, à partir des vrais en-têtes | La reconnaissance de caractères (Paperless-ngx s'en charge) |
| Lecture Factur-X : le XML est extrait du PDF et lu pour de bon | L'extraction par modèle local (Ollama, sortie contrainte par schéma) |
| Détection des doublons par empreinte du contenu | La relève IMAP (ici, on lit des fichiers `.eml`) |
| Mise en quarantaine des alias inconnus | Le stockage et l'index (ici SQLite, en production Paperless) |
| Recherche plein texte sur le contenu | |
| Export CSV vers Sage et règle de non-rejeu | |

Les pièces marquées « à vérifier » le sont parce que l'extracteur simulé rend
volontairement une confiance de 0,42, sous le seuil de 0,85. C'est le
comportement attendu en production : **aucune pièce incertaine ne part en
écriture toute seule.**

---

## La démonstration en six minutes

1. **Ouvrir sur « Les pièces », vide.** « Vos 60 clients ont chacun leur adresse.
   Regardez ce qui se passe quand l'un d'eux envoie quelque chose. »
2. **Cliquer « Recevoir le prochain mail ».** La pièce apparaît, classée au bon
   dossier, montant lu, sans que personne n'ait rien touché.
3. **Cliquer « Tout relever ».** Douze mails, onze pièces classées, un doublon
   écarté, une quarantaine.
4. **Taper trois lettres** dans la recherche — `fer`, `vel`, `4471`. Le résultat
   arrive à la frappe.
5. **Onglet « Export vers Sage ».** Montrer le fichier, l'équilibre débit-crédit,
   les images en lien. Écrire le fichier, revenir : les pièces sont passées en
   « exportée » et ne repartiront jamais dans un export suivant.
6. **Débrancher le câble réseau. Refaire une recherche.** Tout fonctionne.
   C'est le moment de la démonstration ; ne dites rien, laissez-le regarder.

**À garder sous la main :** l'onglet « Quarantaine », pour la question
« et si un client se trompe d'adresse ? ». La réponse est visible : la pièce
n'est jamais perdue, et les adresses examinées sont affichées.

**Si le client apporte ses propres pièces :** le formulaire « Déposer une pièce »
en bas de l'écran accepte un `.eml` ou un PDF. Une vraie facture Factur-X de son
fournisseur sera lue devant lui.

---

## Ce qui a été volontairement évité

- **Aucune ressource distante.** Ni police Google, ni bibliothèque sur CDN.
  Le point culminant de la démonstration est de débrancher internet : une seule
  dépendance réseau et l'écran se dégrade au pire moment.
- **Aucun format Sage inventé.** Le profil d'export est marqué provisoire et
  isolé dans `app/sage.py`. Ce qui est établi : fichier tabulaire, séparateur
  point-virgule, encodage Windows-1252, images en lien. Ce qui ne l'est pas :
  l'ordre exact des colonnes, à relever sur l'installation du cabinet.
- **Aucune imputation comptable.** La contrepartie part en compte d'attente
  471000. L'outil prépare des écritures, il ne décide pas des imputations.

## Ce qu'il ne faut pas faire avec

Pas d'authentification, pas de chiffrement au repos, écoute sur `127.0.0.1`
uniquement. **Cette démonstration ne doit jamais être exposée sur un réseau.**
En production : accès par tunnel privé, comptes nominatifs, journalisation
des accès, sauvegardes chiffrées.

---

## Les tests

```bash
.venv/bin/python -m pytest tests -q
```

Vingt tests sur les trois zones où une régression coûte cher, comme l'exige
la spec : le routage par alias, la lecture Factur-X, l'export Sage. Le test
`test_piece_deja_exportee_ne_repart_jamais` couvre le critère d'acceptation
n° 6, qui est la régression la plus coûteuse du projet.

## Le jeu de données

```bash
.venv/bin/python samples/make_samples.py
```

Fabrique douze mails et de véritables PDF Factur-X à XML embarqué, profil
EN 16931. Aucune donnée réelle, aucun accès réseau. Les cas couverts :
l'alias dans `X-Original-To`, l'alias seulement dans la clause `for` du
`Received` — celui qui casse les implémentations naïves —, deux pièces dans
un même mail, un ticket photographié sans XML, un renvoi en doublon, et un
alias inconnu.

En production, y ajouter le corpus [ZUGFeRD/corpus](https://github.com/ZUGFeRD/corpus),
qui fournit des factures réelles et des exemplaires volontairement défectueux.

---

## Structure

```
app/routing.py     routage par alias, à partir des en-têtes   ← production
app/facturx.py     extraction du XML, lecture CII             ← production
app/sage.py        export des écritures, profil isolé         ← production
app/ingest.py      découpage du mail, doublons, quarantaine   ← production
app/store.py       stockage et recherche (SQLite en démo,
                   Paperless-ngx en production)               ← interface
app/main.py        l'application et ses écrans
```

Le passage en production remplace `DepotSQLite` par une implémentation
`DepotPaperless` derrière la même interface `Depot`. Le routage, la lecture
Factur-X et l'export ne bougent pas — c'est ce découpage qui fait que les
jours passés sur cette démonstration comptent dans le projet.
