/**
 * Script de migration Firebase → PostgreSQL
 * Lancement : node scripts/migrate-firebase.js
 */

require('dotenv').config({ path: '.env' });
const admin = require('firebase-admin');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'cmciea_db',
  user:     process.env.DB_USER     || 'cmciea_user',
  password: process.env.DB_PASSWORD,
  ssl:      false,
});

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts._seconds) return new Date(ts._seconds * 1000);
  if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
  return null;
}

function log(msg)   { console.log(`  ✔  ${msg}`); }
function warn(msg)  { console.warn(`  ⚠  ${msg}`); }
function title(msg) { console.log(`\n── ${msg} ─────────────────────────`); }

async function getCollection(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

// ─── Annonces ────────────────────────────────────────────────────────────────

async function migrateAnnonces() {
  title('Annonces');
  const docs = await getCollection('annonces');
  log(`${docs.length} document(s) trouvé(s)`);

  for (const d of docs) {
    try {
      await pool.query(
        `INSERT INTO annonces (id, titre, contenu, publiee, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT DO NOTHING`,
        [uuidv4(), d.titre || '', d.contenu || d.description || '', d.publiee !== false, toDate(d.createdAt) || new Date()]
      );
    } catch (e) { warn(`Annonce "${d.titre}" : ${e.message}`); }
  }
  log('Annonces migrées');
}

// ─── Newsletter subscribers ───────────────────────────────────────────────────

async function insertNewsletterEmail(email, prenom, date) {
  if (!email) return;
  try {
    await pool.query(
      `INSERT INTO newsletter_subscribers (id, email, prenom, created_at)
       VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
      [uuidv4(), email, prenom || null, date || new Date()]
    );
  } catch (e) { warn(`Newsletter ${email} : ${e.message}`); }
}

async function migrateNewsletter() {
  title('Newsletter subscribers');
  const docs = await getCollection('newsletter_subscribers');
  log(`${docs.length} abonné(s) trouvé(s)`);

  for (const d of docs) {
    await insertNewsletterEmail(d.email, d.prenom || d.firstName, toDate(d.createdAt));
  }
  log('Abonnés newsletter migrés');
}

// ─── Participants (premier marathon) ─────────────────────────────────────────

async function migrateParticipants() {
  title('Participants (premier marathon)');
  const docs = await getCollection('participants');
  log(`${docs.length} participant(s) trouvé(s)`);

  let inscrits = 0;
  let abonnes  = 0;

  for (const d of docs) {
    const email    = d.email || '';
    const fullName = d.fullName || d.name || '';
    const parts    = fullName.trim().split(' ');
    const prenom   = parts[0] || '';
    const nom      = parts.slice(1).join(' ') || '';
    const date     = toDate(d.createdAt) || new Date();

    // Inscription historique
    try {
      await pool.query(
        `INSERT INTO inscriptions (id, type, nom, prenom, email, telephone, statut, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [uuidv4(), 'marathon-biblique', nom, prenom, email, d.phone || null, 'CONFIRME', date]
      );
      inscrits++;
    } catch (e) { warn(`Inscription ${email} : ${e.message}`); }

    // Newsletter pour futures annonces
    await insertNewsletterEmail(email, prenom, date);
    abonnes++;
  }

  log(`${inscrits} participant(s) → inscriptions`);
  log(`${abonnes} participant(s) → newsletter`);
}

// ─── Marathon inscriptions ────────────────────────────────────────────────────

async function migrateMarathonInscriptions() {
  title('Marathon inscriptions');
  const docs = await getCollection('marathon_inscriptions');
  log(`${docs.length} inscription(s) trouvée(s)`);
  if (!docs.length) return;

  // Crée un marathon archivé placeholder
  const marathonId = uuidv4();
  try {
    await pool.query(
      `INSERT INTO marathons (id, titre, description, date_debut, date_fin, scope, livres_choisis, nb_jours, statut, plan_lecture, nb_inscrits, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) ON CONFLICT DO NOTHING`,
      [
        marathonId,
        'Marathon Biblique 2026 (archivé)',
        'Marathon importé depuis Firebase',
        '2026-01-01',
        '2026-04-30',
        'public',
        '[]',
        0,
        'archive',
        '[]',
        docs.length,
        new Date(),
      ]
    );
    log(`Marathon archivé créé (id: ${marathonId})`);
  } catch (e) { warn(`Création marathon archivé : ${e.message}`); return; }

  for (const d of docs) {
    try {
      await pool.query(
        `INSERT INTO marathon_inscriptions (id, marathon_id, full_name, email, phone, city, progress, progress_percent, milestones_reached, current_streak, max_streak, last_activity_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
         ON CONFLICT (marathon_id, email) DO NOTHING`,
        [
          uuidv4(),
          marathonId,
          d.fullName || '',
          d.email || '',
          d.phone || null,
          d.city || null,
          JSON.stringify(d.progress || {}),
          parseFloat(d.progressPercent) || 0,
          JSON.stringify(Array.isArray(d.milestonesReached) ? d.milestonesReached : []),
          d.currentStreak || 0,
          d.maxStreak || 0,
          d.lastActivityAt ? (toDate(d.lastActivityAt) || new Date()).toISOString() : null,
          toDate(d.createdAt) || new Date(),
        ]
      );

      // Ajoute dans newsletter pour futures annonces
      const prenom = (d.fullName || '').trim().split(' ')[0] || null;
      await insertNewsletterEmail(d.email, prenom, toDate(d.createdAt));
    } catch (e) { warn(`Marathon inscription ${d.email} : ${e.message}`); }
  }
  log(`${docs.length} inscription(s) migrée(s)`);
}

// ─── Settings ────────────────────────────────────────────────────────────────

async function migrateSettings() {
  title('Settings');
  const docs = await getCollection('settings');
  log(`${docs.length} document(s) trouvé(s)`);

  for (const d of docs) {
    const key = d._id;
    const { _id, ...value } = d;
    try {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = $2`,
        [key, JSON.stringify(value)]
      );
      log(`Setting "${key}" migré`);
    } catch (e) { warn(`Setting "${key}" : ${e.message}`); }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Début de la migration Firebase → PostgreSQL\n');

  try {
    await pool.query('SELECT 1');
    log('Connexion PostgreSQL OK');
  } catch (e) {
    console.error('❌ Connexion impossible :', e.message);
    process.exit(1);
  }

  await migrateAnnonces();
  await migrateNewsletter();
  await migrateParticipants();
  await migrateMarathonInscriptions();
  await migrateSettings();

  await pool.end();
  await admin.app().delete();

  console.log('\n✅ Migration terminée !');
  console.log('⚠️  Referme le port PostgreSQL sur le VPS :');
  console.log('   nano /home/john_david/cmciea/docker-compose.yml  → retire les lignes ports du service postgres');
  console.log('   docker compose up -d postgres\n');
}

main().catch(e => {
  console.error('\n❌ Erreur fatale :', e.message);
  process.exit(1);
});
