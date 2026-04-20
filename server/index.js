require('dotenv').config();
const express = require('express');
const { Client, Databases, Query, ID, Account } = require('node-appwrite');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

// --- Security & Middleware ---
// Trust the proxy (Cloudflare, Nginx, etc.) to get correct IP for rate limiting
app.set('trust proxy', 1); 

app.use(express.json());

// Robust CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['https://mshr.dev', 'https://l.mshr.dev', 'http://localhost:3000'];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(null, false); // Blocked
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-appwrite-jwt', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(helmet({
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// Rate limiting to prevent API abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

// --- Appwrite Configuration Validation ---
const requiredEnv = [
    'APPWRITE_PROJECT_ID',
    'APPWRITE_DATABASE_ID',
    'APPWRITE_COLLECTION_ID',
    'APPWRITE_API_KEY'
];

const missingEnv = requiredEnv.filter(env => !process.env[env]);
if (missingEnv.length > 0) {
    console.error(`[Error] Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const databaseId = process.env.APPWRITE_DATABASE_ID;
const collectionId = process.env.APPWRITE_COLLECTION_ID;
const apiKey = process.env.APPWRITE_API_KEY;

console.log(`[Config] Endpoint: ${endpoint}`);
console.log(`[Config] Project: ${projectId}`);

// Admin Client
const adminClient = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
const adminDatabases = new Databases(adminClient);

// --- Helpers ---

function generateShortCode(length = 6) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(crypto.randomInt(0, characters.length));
    }
    return result;
}

function calculateExpiry(expiryString) {
    if (!expiryString || expiryString === 'never') return null;
    
    const now = new Date();
    const value = parseInt(expiryString.slice(0, -1));
    const unit = expiryString.slice(-1);

    if (isNaN(value)) return null;

    switch (unit) {
        case 'm': now.setMinutes(now.getMinutes() + value); break;
        case 'h': now.setHours(now.getHours() + value); break;
        case 'd': now.setDate(now.getDate() + value); break;
        case 'w': now.setDate(now.getDate() + value * 7); break;
        default: return null;
    }
    return now.toISOString();
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}

// --- Middlewares ---

async function validateAppwriteJWT(req, res, next) {
    const jwt = req.headers['x-appwrite-jwt'];
    if (!jwt) return res.status(401).json({ error: 'Missing X-Appwrite-JWT header' });

    try {
        const userClient = new Client()
            .setEndpoint(endpoint)
            .setProject(projectId)
            .setJWT(jwt);
            
        const account = new Account(userClient);
        const session = await account.get();
        
        if (!session) return res.status(401).json({ error: 'Invalid session' });
        
        req.user = session;
        next();
    } catch (error) {
        console.error('[Auth Error] JWT validation failed:', error.message);
        return res.status(401).json({ error: `Auth failed: ${error.message}` });
    }
}

// --- Routes ---

// Root Redirect: Redirect l.mshr.dev/ to mshr.dev/
app.get('/', (req, res) => {
    res.redirect(302, 'https://mshr.dev');
});

// POST /api/shorten
app.post('/api/shorten', apiLimiter, validateAppwriteJWT, async (req, res) => {
    const { url, expiry, honeypot } = req.body;

    if (honeypot) return res.status(400).json({ error: 'Invalid request' });
    if (!url || !isValidUrl(url)) return res.status(400).json({ error: 'Invalid or unsafe URL provided' });

    const expiresAt = calculateExpiry(expiry);
    const urlHash = crypto.createHash('sha256').update(url).digest('hex');

    try {
        const existingDocs = await adminDatabases.listDocuments(
            databaseId,
            collectionId,
            [Query.equal('urlHash', urlHash)]
        );

        if (existingDocs.documents.length > 0) {
            const match = existingDocs.documents.find(doc => {
                if (expiresAt === null && doc.expiresAt === null) return true;
                return doc.expiresAt && new Date(doc.expiresAt) > new Date();
            });

            if (match) {
                return res.json({
                    shortCode: match.shortCode,
                    shortUrl: `https://l.mshr.dev/${match.shortCode}`,
                    expiresAt: match.expiresAt,
                    isNew: false
                });
            }
        }

        const shortCode = generateShortCode();
        const newDoc = await adminDatabases.createDocument(
            databaseId,
            collectionId,
            ID.unique(),
            {
                url: url,
                urlHash: urlHash,
                shortCode: shortCode,
                expiresAt: expiresAt,
                createdBy: req.user.$id
            }
        );

        res.status(201).json({
            shortCode: newDoc.shortCode,
            shortUrl: `https://l.mshr.dev/${newDoc.shortCode}`,
            expiresAt: newDoc.expiresAt,
            isNew: true
        });

    } catch (error) {
        console.error('Error creating short URL:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /:shortCode
app.get('/:shortCode', async (req, res) => {
    const { shortCode } = req.params;

    if (shortCode === 'favicon.ico') return res.status(404).end();
    
    // Quick validation of shortCode format
    if (!/^[A-Za-z0-9]{6}$/.test(shortCode)) {
        return res.status(404).send('<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>');
    }

    try {
        const docs = await adminDatabases.listDocuments(
            databaseId,
            collectionId,
            [Query.equal('shortCode', shortCode), Query.limit(1)]
        );

        if (docs.documents.length === 0) {
            return res.status(404).send('<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>');
        }

        const doc = docs.documents[0];
        if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
            return res.status(410).send('<!DOCTYPE html><html><body><h1>410 Link Expired</h1></body></html>');
        }

        res.redirect(301, doc.url);

    } catch (error) {
        console.error('Error redirecting:', error);
        res.status(500).send('Internal server error');
    }
});

// --- Cleanup Task ---
setInterval(async () => {
    try {
        const now = new Date().toISOString();
        let hasMore = true;
        let offset = 0;
        let deletedCount = 0;
        
        while (hasMore) {
            const expiredDocs = await adminDatabases.listDocuments(
                databaseId,
                collectionId,
                [Query.lessThan('expiresAt', now), Query.limit(100), Query.offset(offset)]
            );

            for (const doc of expiredDocs.documents) {
                await adminDatabases.deleteDocument(databaseId, collectionId, doc.$id);
                deletedCount++;
            }

            if (expiredDocs.documents.length < 100) hasMore = false;
            else offset += 100;
        }
        if (deletedCount > 0) console.log(`[Cleanup Task] Deleted ${deletedCount} expired documents.`);
    } catch (error) {
        console.error('[Cleanup Task] Error:', error);
    }
}, 60 * 60 * 1000);

app.listen(port, () => {
    console.log(`mshr.dev oracle server (l.mshr.dev) listening on port ${port}`);
});
