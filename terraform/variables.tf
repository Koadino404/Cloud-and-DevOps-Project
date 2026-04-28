variable "aws_region" {
  description = "The AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "s3_bucket_name" {
  description = "The name of the S3 bucket for file uploads"
  type        = string
  default     = "miniwetransfer-uploads-dev-12345" # Must be globally unique
}

variable "dynamodb_table_name" {
  description = "The name of the DynamoDB table for tracking file metadata"
  type        = string
  default     = "MiniWeTransferFiles"
}
