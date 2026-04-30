const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const dotenv = require("dotenv");
dotenv.config();

const REGION = process.env.AWS_REGION || "us-east-1";
const sesClient = new SESClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const run = async () => {
  // Use a dummy email address to test verification
  const email = process.argv[2] || "test@example.com";
  
  const params = {
    Source: email,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: "Test Email from Mini WeTransfer" },
      Body: { Text: { Data: "This is a test email." } }
    }
  };

  try {
    console.log(`Sending email from ${email} to ${email} in region ${REGION}...`);
    const result = await sesClient.send(new SendEmailCommand(params));
    console.log("Success!", result);
  } catch (error) {
    console.error("Error sending email:", error.message);
  }
};

run();
