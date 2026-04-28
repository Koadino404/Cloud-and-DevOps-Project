const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const dotenv = require('dotenv');

dotenv.config();

const REGION = process.env.AWS_REGION || 'us-east-1';

// Configure S3 Client
const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Configure DynamoDB Client
const dynamoClient = new DynamoDBClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Configure SES Client
const sesClient = new SESClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

module.exports = {
  s3Client,
  docClient,
  PutObjectCommand,
  GetObjectCommand,
  getSignedUrl,
  PutCommand,
  GetCommand,
  ScanCommand,
  sesClient,
  SendEmailCommand,
  BUCKET_NAME: process.env.S3_BUCKET_NAME,
  TABLE_NAME: process.env.DYNAMODB_TABLE_NAME,
};
