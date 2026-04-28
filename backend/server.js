const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const {
  s3Client,
  docClient,
  PutObjectCommand,
  GetObjectCommand,
  getSignedUrl,
  PutCommand,
  GetCommand,
  sesClient,
  SendEmailCommand,
  BUCKET_NAME,
  TABLE_NAME
} = require('./aws');

const app = express();
app.use(cors());
app.use(express.json());

// Configure Multer to keep files in memory (we'll upload directly to S3)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB limit

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Upload Endpoint
app.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Unknown upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = uuidv4();
    const expiryHours = parseInt(req.body.expiryHours) || 24;
    const expiresAt = Math.floor(Date.now() / 1000) + (expiryHours * 60 * 60); // Unix timestamp
    const s3Key = `${fileId}-${req.file.originalname}`;
    const pin = req.body.pin || null;

    // 1. Upload file to S3
    const s3Params = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };
    await s3Client.send(new PutObjectCommand(s3Params));

    // 2. Save metadata to DynamoDB
    const dbParams = {
      TableName: TABLE_NAME,
      Item: {
        fileId: fileId,
        s3Key: s3Key,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
        expiresAt: expiresAt,
        downloadCount: 0
      }
    };
    if (pin) dbParams.Item.pin = pin;
    await docClient.send(new PutCommand(dbParams));

    const recipientEmail = req.body.recipientEmail;
    if (recipientEmail) {
      // In SES Sandbox, the sender email must be verified. 
      // We will try to use the recipientEmail as the sender as well if SES_SENDER_EMAIL is not set.
      const senderEmail = process.env.SES_SENDER_EMAIL || recipientEmail;
      
      const downloadLink = `${req.protocol}://${req.get('host')}/download/${fileId}`;
      const emailParams = {
        Source: senderEmail,
        Destination: { ToAddresses: [recipientEmail] },
        Message: {
          Subject: { Data: `Someone sent you a file via Mini WeTransfer!` },
          Body: {
            Html: {
              Data: `
                <h2>You've received a file!</h2>
                <p><strong>Filename:</strong> ${req.file.originalname}</p>
                <p><strong>Size:</strong> ${(req.file.size / (1024*1024)).toFixed(2)} MB</p>
                <br/>
                <p>Click the link below to download your file before it expires:</p>
                <a href="${downloadLink}" style="padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Download File</a>
                <br/><br/>
                <p>Or copy and paste this link: ${downloadLink}</p>
              `
            }
          }
        }
      };

      try {
        await sesClient.send(new SendEmailCommand(emailParams));
        console.log(`Email successfully sent to ${recipientEmail}`);
      } catch (emailErr) {
        console.error("Failed to send email via SES:", emailErr);
        // We do not fail the upload just because the email failed.
      }
    }

    // 3. Return the download link ID
    res.status(200).json({
      message: 'File uploaded successfully',
      fileId: fileId,
      expiresAt: expiresAt
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Download/Link Generation Endpoint
app.get('/download/:id', async (req, res) => {
  try {
    const fileId = req.params.id;

    // 1. Get metadata from DynamoDB
    const dbParams = {
      TableName: TABLE_NAME,
      Key: { fileId: fileId }
    };
    const { Item } = await docClient.send(new GetCommand(dbParams));

    if (!Item) {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    // Check PIN if required
    if (Item.pin) {
      const providedPin = req.query.pin;
      if (!providedPin) {
        return res.status(401).json({ error: 'This file is protected by a PIN.', requirePin: true });
      }
      if (providedPin !== Item.pin) {
        return res.status(401).json({ error: 'Incorrect PIN.', requirePin: true });
      }
    }

    // 2. Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (now > Item.expiresAt) {
      return res.status(410).json({ error: 'File has expired' });
    }

    // 3. Update download count in background (simple PutCommand for now, ideally UpdateCommand)
    docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...Item, downloadCount: (Item.downloadCount || 0) + 1 }
    })).catch(err => console.error("Failed to update download count:", err));

    // 4. Generate S3 Pre-signed URL
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: Item.s3Key,
      ResponseContentDisposition: `attachment; filename="${Item.originalName}"`
    });
    
    // URL valid for 1 hour
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.status(200).json({ 
      downloadUrl: signedUrl,
      metadata: {
        originalName: Item.originalName,
        size: Item.size,
        uploadedAt: Item.uploadedAt,
        expiresAt: Item.expiresAt,
        downloadCount: Item.downloadCount || 0
      }
    });

  } catch (error) {
    console.error('Error getting download link:', error);
    res.status(500).json({ error: 'Failed to process download request' });
  }
});
// Admin endpoint to list all files
app.get('/admin/files', async (req, res) => {
  try {
    const { ScanCommand } = require('./aws');
    const dbParams = {
      TableName: TABLE_NAME
    };
    const { Items } = await docClient.send(new ScanCommand(dbParams));
    res.status(200).json(Items || []);
  } catch (error) {
    console.error('Error fetching admin files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
