import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maximumBytes = 5 * 1024 * 1024;

function storage() {
  const bucket = process.env.STORAGE_BUCKET; const region = process.env.STORAGE_REGION; const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID; const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!bucket || !region || !accessKeyId || !secretAccessKey) throw new Error('S3-compatible storage is not configured.');
  return { bucket, client: new S3Client({ region, endpoint: process.env.STORAGE_ENDPOINT, forcePathStyle: Boolean(process.env.STORAGE_ENDPOINT), credentials: { accessKeyId, secretAccessKey } }) };
}

export function validateDriverPhoto(contentType: string, size: number) {
  if (!allowedTypes.has(contentType)) throw new Error('Driver photos must be JPEG, PNG, or WebP.');
  if (!Number.isFinite(size) || size < 1 || size > maximumBytes) throw new Error('Driver photos must be 5 MB or smaller.');
}

export async function createDriverPhotoUpload(driverId: string, contentType: string) {
  const { bucket, client } = storage(); const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1]; const key = `drivers/${driverId}/photos/${crypto.randomUUID()}.${extension}`;
  return { photoKey: key, uploadUrl: await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 300 }) };
}

export async function driverPhotoUrl(photoKey?: string | null) {
  if (!photoKey) return null;
  const { bucket, client } = storage();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: photoKey }), { expiresIn: 300 });
}
