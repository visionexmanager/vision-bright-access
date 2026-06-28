variable "project_id"  {}
variable "policy_name" {}

# WAF module — exports the security policy for use by LB backend services
# Full rule configuration lives in environments/production/main.tf Cloud Armor resource
# This module handles IAM and logging

resource "google_project_iam_member" "cloud_armor_viewer" {
  project = var.project_id
  role    = "roles/compute.securityAdmin"
  member  = "serviceAccount:visionex-sre@${var.project_id}.iam.gserviceaccount.com"
}

# WAF log sink — stream all deny events to BigQuery for analysis
resource "google_logging_project_sink" "waf_logs" {
  name        = "visionex-waf-deny-events"
  project     = var.project_id
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/security_logs"
  filter      = "resource.type=\"http_load_balancer\" AND jsonPayload.enforcedSecurityPolicy.outcome=\"DENY\""

  unique_writer_identity = true
}
