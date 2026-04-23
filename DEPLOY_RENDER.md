# Déploiement production (Backend + Email)

Ce guide te permet de mettre en ligne le backend NestJS sur Render et de finaliser l’envoi d’emails via Resend.

## 1) Pré-requis

- Repository GitHub du backend (déjà fait ✅)
- Compte Render
- Compte Resend
- Accès DNS de ton domaine `cmciea-france.com`
- Service account Firebase Admin (JSON)

## 2) Déployer le backend sur Render

1. Ouvre Render > **New** > **Blueprint**.
2. Sélectionne le repo backend contenant `render.yaml`.
3. Lance la création du service.
4. Une fois créé, ouvre le service et vérifie:
   - Build command: `npm ci && npm run build`
   - Start command: `npm run start:prod`
   - Health check: `/api/health`

## 3) Variables d’environnement Render (obligatoires)

Dans Render > service backend > **Environment** :

- `NODE_ENV=production`
- `DEV_ADMIN_ENABLED=false`
- `FRONTEND_URL=https://cmciea-france.com`
- `FRONTEND_URLS=https://cmciea-france.com,https://www.cmciea-france.com,https://cmcieafrance-cdd.web.app`
- `ADMIN_SECRET=<secret long et aléatoire>`

Firebase Admin (depuis le JSON service account):

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (garder les `\n` dans la valeur)
- `FIREBASE_STORAGE_BUCKET`

Email (Resend):

- `RESEND_API_KEY`
- `MAIL_FROM=noreply@cmciea-france.com`
- `MAIL_ADMIN=admin@cmciea-france.com`

## 4) Vérifier le backend en ligne

Après déploiement, teste :

- `https://<ton-backend>.onrender.com/api/health`

Tu dois recevoir un JSON avec :

- `status: "ok"`
- `services.firebase: "ok"`
- `services.mail: "ok"`

Si `mail` ou `firebase` vaut `not_configured`, il manque encore des variables Render.

## 5) Connecter le frontend Firebase au backend

Dans `frontend/src/environments/environment.prod.ts`, l’URL par défaut est :

- `https://cmciea-backend.onrender.com/api`

Si ton service Render reçoit une autre URL, mets :

- `apiBase: 'https://<ton-backend>.onrender.com/api'`

Puis redéploie le frontend Firebase.

## 6) Configurer l’email (Resend)

1. Dans Resend > Domains, ajoute `cmciea-france.com`.
2. Ajoute les enregistrements DNS demandés (SPF/DKIM) chez ton registrar.
3. Attends le statut **Verified**.
4. Vérifie que `MAIL_FROM` utilise ce domaine validé (`noreply@cmciea-france.com`).
5. Teste un envoi via endpoint public (contact/inscription).

## 7) Checklist sécurité production

- `DEV_ADMIN_ENABLED=false`
- `DEV_ADMIN_TOKEN` non utilisé en prod
- Secret admin robuste (`ADMIN_SECRET`)
- Limitation de débit active (déjà configurée)
- CORS limité à tes domaines frontend
- Aucune clé secrète committée dans Git

## 8) Dépannage rapide

- **Erreur Firebase "not initialized"** : variables `FIREBASE_*` manquantes ou `FIREBASE_PRIVATE_KEY` mal formatée.
- **CORS bloqué** : vérifier `FRONTEND_URLS`.
- **Emails non envoyés** : `RESEND_API_KEY` invalide ou domaine Resend non vérifié.
- **Health check KO** : vérifier que l’app écoute bien sur `PORT` fourni par Render.
