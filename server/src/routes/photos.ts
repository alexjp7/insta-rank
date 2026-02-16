import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Photo, ComparisonGroup } from '../types.js';
import { rankPhoto, comparePhotos } from '../services/rankingService.js';

const router = Router();

// In-memory stores
const photos: Map<string, Photo> = new Map();
const comparisons: Map<string, ComparisonGroup> = new Map();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
        }
    },
});

// GET /api/photos — List all photos, sorted by ranking (best first)
router.get('/', (_req: Request, res: Response) => {
    const allPhotos = Array.from(photos.values());
    allPhotos.sort((a, b) => {
        const scoreA = a.ranking?.overallScore ?? -1;
        const scoreB = b.ranking?.overallScore ?? -1;
        return scoreB - scoreA;
    });
    res.json(allPhotos);
});

// GET /api/photos/:id — Get a single photo
router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
    const photo = photos.get(req.params.id);
    if (!photo) {
        res.status(404).json({ error: 'Photo not found' });
        return;
    }
    res.json(photo);
});

// GET /api/photos/:id/download — Download the original photo
router.get('/:id/download', (req: Request<{ id: string }>, res: Response) => {
    const photo = photos.get(req.params.id);
    if (!photo) {
        res.status(404).json({ error: 'Photo not found' });
        return;
    }

    const filePath = path.join(process.cwd(), 'uploads', photo.filename);
    if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found on disk' });
        return;
    }

    res.download(filePath, photo.originalName);
});

// POST /api/photos/upload — Upload one or more photos (standard mode)
router.post('/upload', upload.array('photos', 20), (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
    }

    const uploaded: Photo[] = files.map((file) => {
        const photo: Photo = {
            id: uuidv4(),
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            ranking: null,
            rankingStatus: 'pending',
        };
        photos.set(photo.id, photo);
        return photo;
    });

    res.status(201).json(uploaded);
});

// POST /api/photos/compare — Upload 2-4 photos for comparison
router.post('/compare', upload.array('photos', 4), async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length < 2) {
        res.status(400).json({ error: 'Comparison requires at least 2 photos' });
        return;
    }
    if (files.length > 4) {
        res.status(400).json({ error: 'Comparison allows a maximum of 4 photos' });
        return;
    }

    const groupId = uuidv4();

    // Create Photo records for each file
    const uploaded: Photo[] = files.map((file) => {
        const photo: Photo = {
            id: uuidv4(),
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            ranking: null,
            rankingStatus: 'completed', // No individual ranking for comparison photos
            comparisonGroupId: groupId,
        };
        photos.set(photo.id, photo);
        return photo;
    });

    // Create ComparisonGroup
    const group: ComparisonGroup = {
        id: groupId,
        photoIds: uploaded.map((p) => p.id),
        createdAt: new Date().toISOString(),
        comparison: null,
        comparisonStatus: 'processing',
    };
    comparisons.set(group.id, group);

    // Return immediately with processing status, then run comparison in background
    res.status(201).json({ photos: uploaded, comparison: group });

    // Run comparison asynchronously
    try {
        const imagePaths = uploaded.map((p) => ({
            id: p.id,
            path: path.join(process.cwd(), 'uploads', p.filename),
        }));
        const result = await comparePhotos(imagePaths);
        group.comparison = result;
        group.comparisonStatus = 'completed';
    } catch (err: any) {
        group.comparisonStatus = 'error';
        group.comparisonError = err.message || 'Comparison failed';
        console.error('[Compare Route] Error:', group.comparisonError);
    }
});

// GET /api/photos/comparisons/list — List all comparisons
router.get('/comparisons/list', (_req: Request, res: Response) => {
    const allComparisons = Array.from(comparisons.values());
    allComparisons.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Attach the photo objects to each comparison for convenience
    const enriched = allComparisons.map((group) => ({
        ...group,
        photos: group.photoIds.map((id) => photos.get(id)).filter(Boolean),
    }));

    res.json(enriched);
});

// GET /api/photos/comparisons/:id — Get a single comparison
router.get('/comparisons/:id', (req: Request<{ id: string }>, res: Response) => {
    const group = comparisons.get(req.params.id);
    if (!group) {
        res.status(404).json({ error: 'Comparison not found' });
        return;
    }

    const enriched = {
        ...group,
        photos: group.photoIds.map((id) => photos.get(id)).filter(Boolean),
    };

    res.json(enriched);
});

// POST /api/photos/:id/rank — Trigger ranking for a photo
router.post('/:id/rank', async (req: Request<{ id: string }>, res: Response) => {
    const photo = photos.get(req.params.id);
    if (!photo) {
        res.status(404).json({ error: 'Photo not found' });
        return;
    }

    if (photo.rankingStatus === 'processing') {
        res.status(409).json({ error: 'Ranking already in progress' });
        return;
    }

    photo.rankingStatus = 'processing';

    try {
        const imagePath = path.join(process.cwd(), 'uploads', photo.filename);
        const result = await rankPhoto(imagePath);
        photo.ranking = result;
        photo.rankingStatus = 'completed';
        res.json(photo);
    } catch (err: any) {
        photo.rankingStatus = 'error';
        photo.rankingError = err.message || 'Unknown ranking error';
        res.status(500).json({ error: photo.rankingError });
    }
});

// DELETE /api/photos/:id — Delete a photo
router.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
    const photo = photos.get(req.params.id);
    if (!photo) {
        res.status(404).json({ error: 'Photo not found' });
        return;
    }

    // Delete file
    const filePath = path.join(process.cwd(), 'uploads', photo.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // If part of a comparison group, remove from group
    if (photo.comparisonGroupId) {
        const group = comparisons.get(photo.comparisonGroupId);
        if (group) {
            group.photoIds = group.photoIds.filter((id) => id !== req.params.id);
            if (group.photoIds.length === 0) {
                comparisons.delete(photo.comparisonGroupId);
            }
        }
    }

    photos.delete(req.params.id);
    res.json({ message: 'Photo deleted' });
});

export default router;

