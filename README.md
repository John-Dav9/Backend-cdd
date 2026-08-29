# CMCIEA-FRANCE — API

> Documentation principale du back-end · API en production sur `api.cmciea-france.com`

## Table des matières

1. [Présentation du projet](#présentation)
2. [Architecture globale](#architecture)
3. [Prérequis](#prérequis)
4. [Installation et démarrage](#installation)
5. [Variables d'environnement](#variables-denvironnement)
6. [Authentification et sécurité](#authentification-et-sécurité)
7. [Modules métier](#modules-métier)
8. [Base de données](#base-de-données)
9. [Tests](#tests)
10. [Déploiement](#déploiement)

---

## Présentation

API REST et WebSocket de la plateforme **CMCIEA-France** : gestion des contenus, des
membres, des réunions en visioconférence, des notifications et de l'administration du
site.

Le front-end Angular est dans un dépôt séparé :
[cmcieafrance-cdd](https://github.com/John-Dav9/cmcieafrance-cdd).

Toutes les routes sont préfixées par `/api`.

### Stack technique

```
Framework   : NestJS 11 · TypeScript 5.1 · Node 20
Données     : PostgreSQL · TypeORM · migrations versionnées
Cache       : Redis (sessions administrateur, reconnexion)
Fichiers    : MinIO (stockage objet compatible S3)
Temps réel  : Socket.IO · visioconférence Jitsi (jetons JWT)
Emails      : Resend · modèles personnalisables
SMS         : Twilio (codes OTP)
Push        : Web Push (VAPID)
IA          : Groq · Llama 3.1 8B (assistant conversationnel)
Sécurité    : Helmet · CORS strict · Throttler · bcrypt · journal d'audit
Tests       : Jest (unitaires) · Supertest (end-to-end)
Déploiement : Docker multi-stage · GitHub Actions → VPS · staging séparé
```

---

## Architecture

```
cmciea-backend
│
├── .github/workflows/
│   ├── deploy.yml            # push sur main    → production
│   └── deploy-staging.yml    # push sur staging → environnement de recette
│
├── src/
│   ├── main.ts               # Bootstrap : Helmet, CORS, préfixe /api, validation
│   ├── app.module.ts         # 32 modules · Throttler et audit en gardes globales
│   │
│   ├── auth/                 # Authentification, rôles, sessions, révocation
│   ├── database/
│   │   ├── entities/             # 28 entités TypeORM
│   │   └── migrations/           # Migrations versionnées
│   │
│   ├── ── Contenu ──────────────────────────────────────────────
│   ├── actualites/  annonces/  pages/  bibliotheque/  cantiques/
│   ├── temoignages/ prieres/   messages/ bible/
│   │
│   ├── ── Communauté ───────────────────────────────────────────
│   ├── membres/     user/      inscriptions/  cell-groups/
│   ├── mentorship/  marathon/  contact/       newsletter/
│   │
│   ├── ── Réunions et diffusion ────────────────────────────────
│   ├── reunions/             # Meetings, gateway WebSocket, planificateur
│   ├── meeting-access/       # Liens d'invitation à usage contrôlé
│   ├── meeting-backgrounds/  # Arrière-plans de visioconférence
│   ├── replays/  streaming/  # Rediffusions, relais RTMP, enregistrement Jibri
│   │
│   ├── ── Transversal ──────────────────────────────────────────
│   ├── storage/       # MinIO
│   ├── mail/          # Resend + modèles d'email
│   ├── notifications/ # Web Push (VAPID)
│   ├── chat/          # Assistant conversationnel (Groq)
│   ├── audit/         # Journal d'audit, intercepteur global
│   ├── stats/         # Statistiques du tableau de bord
│   ├── settings/      # Paramètres de la communauté
│   ├── firebase/      # Compatibilité avec l'ancienne plateforme
│   └── health/        # Sonde de disponibilité
│
├── scripts/
│   └── migrate-firebase.js   # Migration des données depuis Firebase
│
├── test/                     # Tests end-to-end (Supertest)
├── Dockerfile                # Build multi-stage
└── start-prod.js             # Résolution du point d'entrée compilé
```

**Découpage en trois services** en production :

| Service | Domaine | Rôle |
|---------|---------|------|
| Front-end | `cmciea-france.com` | Application Angular servie par nginx |
| API | `api.cmciea-france.com` | Ce dépôt · REST + WebSocket |
| Visioconférence | `meet.cmciea-france.com` | Jitsi auto-hébergé, accès par jeton |

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | 20.x |
| npm | 10+ |
| PostgreSQL | 14+ |
| Redis | 6+ |
| MinIO | dernière version stable |
| Docker | 24+ (pour le build de production) |

---

## Installation

### 1. Cloner le projet

```bash
git clone https://github.com/John-Dav9/Backend-cdd.git
cd Backend-cdd
```

### 2. Installer les dépendances

```bash
npm ci
```

### 3. Configurer l'environnement

```bash
cp .env.example .env
# Renseigner au minimum : JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD,
# et les paramètres PostgreSQL
```

Un premier compte administrateur est créé automatiquement au démarrage à partir de
`ADMIN_EMAIL` et `ADMIN_PASSWORD` s'il n'existe pas encore.

### 4. Lancer en développement

```bash
npm run start:dev     # http://localhost:3000/api
```

Le front-end en développement proxifie déjà `/api` vers ce port.

### 5. Vérifier que l'API répond

```bash
curl http://localhost:3000/api/health
```

```json
{ "status": "ok", "timestamp": "…", "services": { "mail": "ok" } }
```

### 6. Build de production

```bash
npm run build
npm run start:prod
```

Ou en conteneur, tel qu'utilisé en production :

```bash
docker build -t cmciea-backend .
docker run -p 3000:3000 --env-file .env cmciea-backend
```

---

## Variables d'environnement

Le fichier [`.env.example`](.env.example) fait référence. Résumé par domaine :

| Groupe | Variables | Rôle |
|--------|-----------|------|
| **Serveur** | `PORT` `NODE_ENV` | Port d'écoute et mode d'exécution |
| **CORS** | `FRONTEND_URLS` | Origines autorisées, séparées par des virgules |
| **JWT** | `JWT_SECRET` `JWT_EXPIRES_IN` | Signature et durée de vie des jetons |
| **Admin initial** | `ADMIN_EMAIL` `ADMIN_PASSWORD` `ADMIN_2FA_ENABLED` | Compte créé au premier démarrage |
| **PostgreSQL** | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` `DB_SYNCHRONIZE` | Connexion et mode de synchronisation du schéma |
| **MinIO** | `MINIO_ENDPOINT` `MINIO_PORT` `MINIO_USE_SSL` `MINIO_ACCESS_KEY` `MINIO_SECRET_KEY` `MINIO_BUCKET` | Stockage des fichiers |
| **Emails** | `RESEND_API_KEY` `MAIL_FROM` `MAIL_FROM_MARATHON` `MAIL_FROM_NEWS` `MAIL_REPLY_TO` `MAIL_ADMIN` | Expéditeurs distincts selon le type d'envoi |
| **Assistant IA** | `GROQ_API_KEY` | Chat conversationnel |
| **Jitsi** | `JITSI_APP_ID` `JITSI_APP_SECRET` `JITSI_URL` | Signature des jetons d'accès aux salles |
| **Enregistrement** | `JIBRI_ENABLED` `JIBRI_RECORDINGS_PATH` `JIBRI_FINALIZE_SECRET` | Enregistrement des réunions |
| **Téléphonie** | `JITSI_DIAL_IN_NUMBER` `JITSI_DIAL_IN_PIN` `JITSI_DIAL_IN_COUNTRIES` | Accès aux réunions par téléphone |
| **Diffusion** | `STREAM_RELAY_RTMP_URL` `STREAM_RELAY_CONTROL_URL` `STREAM_RELAY_SECRET` | Relais de flux en direct |
| **SMS** | `TWILIO_ACCOUNT_SID` `TWILIO_AUTH_TOKEN` `TWILIO_PHONE_NUMBER` | Envoi des codes OTP |
| **Sessions admin** | `REDIS_URL` `ADMIN_SESSION_TTL_SECONDS` `HEARTBEAT_INTERVAL_SECONDS` `MAX_RECONNECT_ATTEMPTS` | Suivi de présence et reconnexion |
| **Push PWA** | `VAPID_SUBJECT` `VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` | Notifications navigateur |

Générer les clés VAPID :

```bash
npx web-push generate-vapid-keys
```

---

## Authentification et sécurité

### Parcours d'entrée

| Route | Méthode | Usage |
|-------|---------|-------|
| `POST /api/auth/login` | Mot de passe | Administrateurs |
| `POST /api/auth/login/verify` | Second facteur | Vérification 2FA administrateur |
| `POST /api/auth/register` | Inscription | Nouveaux membres |
| `POST /api/auth/send-otp` · `verify-otp` | Code à usage unique | Membres, par email ou SMS |
| `POST /api/auth/magic-link/verify` | Lien magique | Connexion sans mot de passe |
| `POST /api/auth/guest` | Jeton d'invitation | Accès ponctuel à une réunion, sans compte |
| `GET /api/auth/me` | — | Profil de la session courante |

### Défenses en place

- **Helmet** avec Content-Security-Policy explicite, plus `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer` et `Permissions-Policy` bloquant caméra, micro et
  géolocalisation au niveau de l'API
- **CORS strict** : liste blanche d'origines, `localhost` autorisé uniquement hors
  production
- **Throttler global** : 120 requêtes par minute et par client
- **ValidationPipe global** en mode `whitelist` : tout champ non déclaré dans un DTO
  est retiré de la requête
- **Mots de passe** hachés avec bcrypt
- **Révocation de jetons** (`token-revocation.service.ts`) : une déconnexion
  invalide réellement le jeton
- **Garde de portée réunion** (`meeting-scope.guard.ts`) : un jeton d'invité ne
  donne accès qu'à la réunion pour laquelle il a été émis
- **Journal d'audit** en intercepteur global : chaque action sensible est tracée

---

## Modules métier

### Réunions et diffusion

Le cœur technique du projet.

- Salles Jitsi avec jetons signés distinguant modérateur et participant
- Passerelle WebSocket (`reunions/meeting.gateway.ts`) pour la signalisation et la
  présence en temps réel
- Liens d'invitation à usage contrôlé (`meeting-access/`), couverts par des tests
- État d'exécution des réunions persisté, ce qui permet la reprise après coupure
- Enregistrement via Jibri, relais RTMP pour la diffusion en direct, rediffusions
- Arrière-plans de visioconférence personnalisables
- Tâches planifiées : nettoyage toutes les 6 heures, synchronisation d'état toutes
  les 15 minutes

### Contenu et communauté

Actualités, annonces, pages éditables, bibliothèque de documents, recueil de
cantiques, témoignages, sujets de prière, messagerie, inscriptions, groupes de
cellule, mentorat, marathon biblique, newsletter et formulaire de contact.

La newsletter part automatiquement chaque lundi à 9 h ; le marathon biblique
déclenche un rappel quotidien et un recalcul à minuit.

### Bible

Lecture et recherche de passages, avec analyse des références textuelles
(`bible-passage-reference-parser`) : une requête comme « Jean 3:16-18 » est
interprétée puis résolue.

### Assistant conversationnel

Chat propulsé par Groq (Llama 3.1 8B), cadré par un prompt système, pour orienter
les visiteurs dans le site.

### Notifications

Trois canaux : email transactionnel via Resend avec modèles modifiables depuis
l'administration, SMS via Twilio pour les codes OTP, et notifications push
navigateur via Web Push.

---

## Base de données

PostgreSQL avec TypeORM, **28 entités** et un schéma géré par migrations
versionnées — `DB_SYNCHRONIZE=false` en production.

| Domaine | Entités principales |
|---------|--------------------|
| Identité | `User` · `Member` · `OtpCode` · `SpiritualBackground` |
| Réunions | `Meeting` · `MeetingParticipant` · `MeetingInvite` · `MeetingAccessLink` · `MeetingRuntimeState` · `Recording` |
| Contenu | `Actualite` · `Annonce` · `Bibliotheque` · `Cantique` · `Temoignage` · `Priere` · `Message` |
| Communauté | `CellGroup` · `MentorshipRequest` · `Inscription` · `Marathon` · `MarathonInscription` · `NewsletterSubscriber` |
| Système | `Setting` · `CommunitySettings` · `EmailTemplate` · `AuditLog` · `PushSubscription` |

Migrations présentes : schéma initial, ajout des cantiques, sujet d'authentification
des participants, état d'exécution et arrière-plans de réunion, liens d'accès.

Une migration ponctuelle depuis l'ancienne plateforme Firebase est disponible dans
`scripts/migrate-firebase.js`.

---

## Tests

```bash
npm test          # tests unitaires (Jest)
npm run test:e2e  # tests end-to-end (Supertest)
```

Couverture actuelle, ciblée sur les zones sensibles : service d'authentification,
authentification des membres, garde de portée des réunions, service de réunions,
liens d'accès aux réunions, service Bible, et un test end-to-end sur le parcours
administrateur.

---

## Déploiement

Deux environnements, deux branches :

| Branche | Workflow | Cible |
|---------|----------|-------|
| `main` | `deploy.yml` | Production |
| `staging` | `deploy-staging.yml` | Recette |

Chaque push déclenche une connexion SSH au VPS, récupère la nouvelle version,
reconstruit l'image et redémarre le conteneur :

```bash
git -C backend pull origin main
docker compose up -d --build backend
docker image prune -f
```

L'image est construite en deux étapes sous `node:20-alpine` : compilation NestJS,
puis copie du seul `dist` dans l'image finale. `start-prod.js` localise le point
d'entrée compilé quelle que soit l'arborescence produite par le build.

---

## Dépôt lié

| Dépôt | Contenu |
|-------|---------|
| [cmcieafrance-cdd](https://github.com/John-Dav9/cmcieafrance-cdd) | Front-end Angular 20 · PWA · Docker + nginx |
