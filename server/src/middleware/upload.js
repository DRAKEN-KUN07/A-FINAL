import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppError } from './errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
export const VISITOR_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'visitors');

fs.mkdirSync(VISITOR_UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(VISITOR_UPLOAD_DIR, { recursive: true });
    cb(null, VISITOR_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES.get(file.mimetype) || '.jpg';
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    cb(null, `visitor-${uniqueSuffix}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new AppError(400, 'Only JPEG, PNG, and WebP images are allowed for visitor photos.'));
  }
  return cb(null, true);
}

export const uploadVisitorPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
