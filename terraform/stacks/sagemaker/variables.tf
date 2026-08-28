variable "aws_region" {
  description = "AWS region for resources"
  type        = string
}

variable "sagemaker_image_uri" {
  description = <<-EOT
    URI of the SageMaker Deep Learning Container image. The default is the
    us-east-1 copy; every region hosts its own, and SageMaker cannot pull across
    regions. Override this when aws_region is not us-east-1.
  EOT
  type        = string
  default     = "763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-inference:1.13.1-transformers4.26.0-cpu-py39-ubuntu20.04"

  # Catch the region mismatch at plan time. Left unchecked, SageMaker fails to
  # pull the image and the resulting error does not mention the region at all.
  validation {
    condition     = strcontains(var.sagemaker_image_uri, ".dkr.ecr.${var.aws_region}.amazonaws.com/")
    error_message = "sagemaker_image_uri must point at ECR in ${var.aws_region}; SageMaker cannot pull a Deep Learning Container from another region."
  }
}

variable "embedding_model_name" {
  description = "Name of the HuggingFace model to use"
  type        = string
  default     = "sentence-transformers/all-MiniLM-L6-v2"
}