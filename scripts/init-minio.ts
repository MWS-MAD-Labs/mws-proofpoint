import { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import * as dotenv from 'dotenv';

dotenv.config();

const BUCKET_NAME = process.env.MINIO_BUCKET || "evidence";

const s3Client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin",
        secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    },
    forcePathStyle: true,
});

async function initMinio() {
    console.log(`Checking bucket: ${BUCKET_NAME}...`);

    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
        console.log(`Bucket '${BUCKET_NAME}' already exists.`);
    } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            console.log(`Bucket '${BUCKET_NAME}' not found. Creating...`);
            await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
            console.log(`Bucket '${BUCKET_NAME}' created successfully.`);

            // Set bucket policy to allow public read access (optional but helpful for development)
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

            await s3Client.send(new PutBucketPolicyCommand({
                Bucket: BUCKET_NAME,
                Policy: JSON.stringify(policy),
            }));
            console.log(`Public read policy applied to '${BUCKET_NAME}'.`);
        } else {
            console.error("Error checking/creating bucket:", error);
            process.exit(1);
        }
    }
}

initMinio().catch(console.error);
