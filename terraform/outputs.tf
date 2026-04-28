output "s3_bucket_name" {
  value = aws_s3_bucket.uploads_bucket.id
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.files_table.name
}

output "ec2_public_ip" {
  value = aws_instance.web_server.public_ip
}
