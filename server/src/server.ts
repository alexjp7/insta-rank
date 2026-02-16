import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import photosRouter from './routes/photos.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API routes
app.use('/api/photos', photosRouter);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 InstaRank server running on http://0.0.0.0:${PORT}`);
    console.log(`📁 Uploads served from ${path.join(process.cwd(), 'uploads')}`);

    const claudeModel = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    const hasKey = !!process.env.claude_key;
    console.log(`🤖 Using Claude model: ${claudeModel}`);
    console.log(`   API key: ${hasKey ? '✅ configured' : '❌ missing — set claude_key in .env'}`);
});
