# Décision 01 — le routage ne passe pas par les règles de messagerie de Paperless

**Date** : 8 septembre 2026 · **Tranchée par** : lecture du code source + mesure
**Question** : les règles de messagerie de Paperless-ngx peuvent-elles router les 60 alias
nativement, et ainsi économiser les jours prévus pour notre propre routage ?

**Réponse : non.** Trois raisons indépendantes, chacune suffisante.

---

## 1. Couverture réelle : 48 %

`src/paperless_mail/mail.py`, fonction `make_criterias` :

```python
if rule.filter_to:
    criterias["to"] = rule.filter_to
```

`filter_to` devient un `to=` d'imap_tools, donc un `TO` IMAP — qui ne cherche que dans
le champ To de l'enveloppe, c'est-à-dire l'en-tête `To:`. Ni `Cc`, ni `Delivered-To`,
ni `X-Original-To`, ni la clause `for <…>` du `Received`.

Or dans une boîte attrape-tout, l'alias visé n'est souvent **pas** dans le `To` :

| Cas rencontré | Poids estimé | Règle Paperless | Notre routage |
|---|---:|---|---|
| Envoi direct à l'adresse du dossier | 42 % | routé | routé (`X-Original-To`) |
| Renvoi automatique depuis la boîte du client | 31 % | **non routé** | routé (`X-Original-To`) |
| Copie cachée | 12 % | **non routé** | routé (`Received`) |
| Alias en copie, réponse à tous | 9 % | **non routé** | routé (`Cc`) |
| Nom affiché, casse différente | 4 % | routé | routé (`To`) |
| Alias inconnu | 2 % | quarantaine | quarantaine |
| **Total correctement traité** | | **48 %** | **100 %** |

Les poids sont des estimations, pas des mesures — à refaire sur la boîte réelle du
cabinet. Mais la conclusion résiste à une large marge d'erreur : le renvoi automatique
à lui seul suffit à faire tomber la couverture sous 70 %, et c'est précisément ce
qu'un client fera quand on lui dira « envoyez à votre nouvelle adresse ».

## 2. Le correspondant ne se déduit pas du destinataire

`src/paperless_mail/models.py` :

```python
class CorrespondentSource(models.IntegerChoices):
    FROM_NOTHING = 1
    FROM_EMAIL   = 2   # adresse de l'expéditeur
    FROM_NAME    = 3   # nom de l'expéditeur
```

Les trois options portent sur l'**expéditeur**. Rien ne permet de déduire le dossier
du **destinataire**. Il faudrait 60 règles distinctes, chacune avec un
`assign_correspondent` figé — donc 60 objets à créer et à maintenir à la main.

## 3. Une requête IMAP par règle et par cycle

```python
for rule in account.rules.order_by("order"):
    ...
    all_uids = set(M.uids(criteria=criterias, ...))
```

60 règles = 60 `SEARCH` IMAP à chaque relève, plus la règle attrape-tout.

---

## Ce qu'on fait

**Une seule règle**, sans `filter_to`, `assign_correspondent_from = FROM_NOTHING`,
qui récupère tout le dossier. Le routage se fait dans notre service
(`backend/app/services/routing.py`), qui lit `X-Original-To`, `Delivered-To`, `Envelope-To`, la clause
`for <…>` du `Received`, puis `To` et `Cc`, dans cet ordre, en écartant l'adresse
attrape-tout.

Une requête IMAP par cycle. Un seul chemin de code. Un dossier client s'ajoute par une
ligne en base, pas par une règle dans une interface d'administration.

## Ce que Paperless garde

Cette décision ne remet rien d'autre en cause. Paperless continue de fournir la boucle
de relève IMAP, la validité des UID, la reconnexion, l'extraction des pièces jointes,
la reconnaissance de caractères, le stockage et l'index plein texte. C'est là que sont
les vingt jours qu'il nous économise. Le routage n'en fait pas partie.

## Effet sur le chiffrage

Les 2 à 3 jours espérés sur le routage ne sont **pas** économisés. En revanche
`backend/app/services/routing.py` est déjà écrit et couvert par des tests : sur les 4 jours prévus pour
« réception et routage », environ 2 sont faits.

Voir aussi : `decision-02-dolibarr.md`.
