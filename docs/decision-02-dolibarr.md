# Décision 02 — Dolibarr en moteur pour la partie 2

**Date** : 8 septembre 2026 · **Tranchée par** : lecture du code source
**Question** : Dolibarr peut-il servir de moteur à la partie 2 — temps, facturation,
prélèvement, relance — et faire tomber les 13 jours estimés ?

**Réponse : oui, à hauteur d'environ 7 jours.** Avec deux trous identifiés et deux coûts
à assumer.

---

## Le dépôt

`Dolibarr/dolibarr` · **GPL-3.0** · 7 589 étoiles · PHP · dernier envoi le jour même.
La GPL-3 n'impose rien de particulier ici : on déploie un logiciel non modifié chez un
client, ce n'est pas une distribution en réseau au sens de l'AGPL.

## Ce qui est natif, vérifié dans le code

| Besoin | Où c'est | État |
|---|---|---|
| Pointage du temps par tâche et par client | `projet/class/task.class.php` | natif |
| Le temps par l'API REST | `api_tasks` : `POST {id}/addtimespent`, `GET {id}/timespent`, `PUT`, `DELETE` | natif |
| Facture générée depuis le temps pointé | action de masse `confirm_generateinvoice` dans `projet/tasks/time.php` | natif |
| Marquage « facturé » sur chaque ligne de temps | `llx_element_time` : colonnes `invoice_id`, `invoice_line_id` | natif |
| Mandat SEPA avec référence unique | `core/modules/bank/doc/pdf_sepamandate.modules.php` | natif |
| Fichier de prélèvement pain.008 | `bonprelevement.class.php` ligne 2047 : écrit `urn:iso:std:iso:20022:tech:xsd:pain.008.001.02` et `CstmrDrctDbtInitn` | natif |
| Gestion des rejets | `rejetprelevement.class.php` | natif |
| Factures récurrentes, mentions légales, numérotation continue | cœur | natif |
| Factur-X | cœur | natif |
| Ordonnanceur pour les traitements périodiques | `core/lib/cron.lib.php`, `box_scheduled_jobs` | natif |

**Le point le plus lourd est le prélèvement.** Mandat, référence unique, génération du
pain.008, rejets : c'est toute la couche réglementaire de la partie 2, déjà écrite et
maintenue par d'autres. C'est ce qu'on ne voulait surtout pas réécrire.

Conséquence à signaler au client : générer soi-même le pain.008 **ouvre une alternative
au prestataire de paiement**. Il faut un identifiant créancier obtenu auprès de la
Banque de France et un accord de remise de fichiers avec sa banque, mais cela supprime
un coût récurrent — ce qui compte pour quelqu'un qui refuse les abonnements. Ce n'est
pas une recommandation : c'est une option à mettre devant lui.

## Les deux trous

**1. Aucune relance automatique des impayés dans le cœur.** Recherche sur
`compta/facture/*(relanc|unpaid|impay)*` : zéro fichier. Il n'y a que des rappels
d'agenda, sans rapport. À écrire — mais sur l'ordonnanceur de Dolibarr, qui existe.
Compter 2 jours.

**2. Le module prélèvement n'est pas exposé en API REST.** Les 51 classes d'API
couvrent `thirdparties`, `tasks`, `projects`, `invoices`, `paiements`, `bankaccounts`
et `documents` — mais pas `prelevement`. Le lancement mensuel du prélèvement se fera
donc dans l'écran de Dolibarr, ou via une petite extension d'API à écrire
(`BonPrelevement::create()` est une méthode publique propre, l'extension est courte).

**C'est le seul endroit où la promesse d'écran unique se fissure**, une fois par mois,
pour un geste que le cabinet fait de toute façon en conscience.

## Effet sur le chiffrage

| Poste de la partie 2 | Sans Dolibarr | Avec Dolibarr |
|---|---:|---:|
| Pointage du temps — modèle, écran, API | 3 j | 1 j |
| Génération des factures depuis le temps | 2 j | 0,5 j |
| Mentions légales, numérotation, PDF | 2 j | 0 j |
| Mandats, pain.008, rejets | 4 j | 1 j |
| Relances | 2 j | 2 j |
| Installation et paramétrage de Dolibarr | — | 1,5 j |
| **Total** | **13 j** | **6 j** |

**Environ 7 jours économisés sur la partie 2.**

L'effet commercial de ce gain est traité dans la note interne, hors de ce dépôt.

## Les coûts à assumer

- **Un second système** à installer, sauvegarder, mettre à jour : PHP et MariaDB à côté
  de Python et PostgreSQL. Deux piles à maintenir, et le maintien en condition s'alourdit
  d'environ une demi-journée par an.
- **Une fois par mois**, le prélèvement se lance dans l'écran de Dolibarr, sauf à écrire
  l'extension d'API.
- **Le rythme de version de Dolibarr** devient un sujet de maintien en condition, au même
  titre que celui de Paperless.

## Position du programme après les décisions 01 et 02

| | Jours |
|---|---:|
| Estimation réaliste après la correction sur la lecture d'images | 54 |
| Décision 01 — routage : rien d'économisé | 54 |
| Décision 02 — Dolibarr sur la partie 2 | **47** |
| Vendu | 46 |

**L'écart tombe de 8 jours à 1.** C'est le dernier levier ouvert, et il a suffi.
