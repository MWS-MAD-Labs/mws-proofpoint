import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// MinIO S3 client configuration
const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
  region: "us-east-1", // MinIO doesn't care about region, but SDK requires it
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin",
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = process.env.MINIO_BUCKET || "evidence";

// Track if bucket has been verified to exist (avoid repeated checks)
let bucketVerified = false;

/**
 * Ensure the bucket exists, create it if not
 */
async function ensureBucketExists(): Promise<void> {
  if (bucketVerified) return;

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    bucketVerified = true;
  } catch (error: unknown) {
    const err = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    if (
      err.name === "NotFound" ||
      err.name === "NoSuchBucket" ||
      err.$metadata?.httpStatusCode === 404
    ) {
      console.log(`Bucket '${BUCKET_NAME}' not found. Creating...`);

      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`Bucket '${BUCKET_NAME}' created successfully.`);

      // Set bucket policy to allow public read access
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };

      await s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: BUCKET_NAME,
          Policy: JSON.stringify(policy),
        }),
      );
      console.log(`Public read policy applied to '${BUCKET_NAME}'.`);

      bucketVerified = true;
    } else {
      throw error;
    }
  }
}

export interface UploadResult {
  key: string;
  url: string;
}

export async function uploadFileWithKey(
  file: Buffer,
  key: string,
  contentType: string,
): Promise<UploadResult> {
  await ensureBucketExists();

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await s3Client.send(command);
  const url = `${process.env.MINIO_ENDPOINT}/${BUCKET_NAME}/${key}`;
  return { key, url };
}

/**
 * Upload a file to MinIO S3
 */
export async function uploadFile(
  file: Buffer,
  fileName: string,
  userId: string,
  contentType: string,
): Promise<UploadResult> {
  // Ensure bucket exists before upload
  await ensureBucketExists();

  const timestamp = Date.now();
  const key = `${userId}/${timestamp}_${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Generate public URL
  const url = `${process.env.MINIO_ENDPOINT}/${BUCKET_NAME}/${key}`;

  return { key, url };
}

/**
 * Get a signed URL for file download (expires in 1 hour)
 */
export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return signedUrl;
}

/**
 * Get public URL for a file
 */
export function getPublicUrl(key: string): string {
  return `${process.env.MINIO_ENDPOINT}/${BUCKET_NAME}/${key}`;
}

/**
 * Delete a file from MinIO S3
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export { s3Client, BUCKET_NAME };
