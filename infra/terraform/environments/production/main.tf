###############################################################################
# Visionex AI Media Studio — Multi-Region Production Infrastructure
# Provider: Google Cloud Platform
# Regions: europe-west1, me-central1, us-east1, us-west1, asia-east1
###############################################################################

terraform {
  required_version = ">= 1.7"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }
  backend "gcs" {
    bucket = "visionex-terraform-state"
    prefix = "production"
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = "europe-west1"
}

provider "google-beta" {
  project = var.gcp_project_id
}

###############################################################################
# VARIABLES
###############################################################################

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
}

variable "environment" {
  default = "production"
}

variable "regions" {
  description = "All deployment regions"
  type        = map(object({
    gcp_region    : string
    cluster_name  : string
    node_count_min: number
    node_count_max: number
    machine_type  : string
    is_primary    : bool
  }))
  default = {
    europe = {
      gcp_region     = "europe-west1"
      cluster_name   = "visionex-eu"
      node_count_min = 3
      node_count_max = 50
      machine_type   = "n2-standard-8"
      is_primary     = true
    }
    middle_east = {
      gcp_region     = "me-central1"
      cluster_name   = "visionex-me"
      node_count_min = 2
      node_count_max = 30
      machine_type   = "n2-standard-8"
      is_primary     = false
    }
    us_east = {
      gcp_region     = "us-east1"
      cluster_name   = "visionex-use"
      node_count_min = 3
      node_count_max = 50
      machine_type   = "n2-standard-8"
      is_primary     = false
    }
    us_west = {
      gcp_region     = "us-west1"
      cluster_name   = "visionex-usw"
      node_count_min = 2
      node_count_max = 40
      machine_type   = "n2-standard-8"
      is_primary     = false
    }
    asia = {
      gcp_region     = "asia-east1"
      cluster_name   = "visionex-asia"
      node_count_min = 2
      node_count_max = 40
      machine_type   = "n2-standard-8"
      is_primary     = false
    }
  }
}

###############################################################################
# VPC — shared network with regional subnets
###############################################################################

resource "google_compute_network" "visionex_vpc" {
  name                    = "visionex-vpc"
  auto_create_subnetworks = false
  routing_mode            = "GLOBAL"
}

resource "google_compute_subnetwork" "regional_subnets" {
  for_each      = var.regions
  name          = "visionex-subnet-${each.key}"
  ip_cidr_range = cidrsubnet("10.0.0.0/8", 8, index(keys(var.regions), each.key))
  network       = google_compute_network.visionex_vpc.id
  region        = each.value.gcp_region

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = cidrsubnet("172.16.0.0/12", 8, index(keys(var.regions), each.key))
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = cidrsubnet("192.168.0.0/16", 8, index(keys(var.regions), each.key))
  }
}

###############################################################################
# GKE CLUSTERS — one per region
###############################################################################

module "gke" {
  source   = "../../modules/gke"
  for_each = var.regions

  project_id   = var.gcp_project_id
  cluster_name = each.value.cluster_name
  region       = each.value.gcp_region
  network      = google_compute_network.visionex_vpc.self_link
  subnetwork   = google_compute_subnetwork.regional_subnets[each.key].self_link

  node_count_min = each.value.node_count_min
  node_count_max = each.value.node_count_max
  machine_type   = each.value.machine_type

  depends_on = [google_compute_subnetwork.regional_subnets]
}

###############################################################################
# REDIS (Memorystore) — one per region
###############################################################################

module "redis" {
  source   = "../../modules/redis"
  for_each = var.regions

  project_id   = var.gcp_project_id
  name         = "visionex-redis-${each.key}"
  region       = each.value.gcp_region
  network      = google_compute_network.visionex_vpc.id
  memory_size_gb = 16
  redis_version  = "REDIS_7_0"
  tier           = "STANDARD_HA"
}

###############################################################################
# GLOBAL LOAD BALANCER — geo-routing across all regions
###############################################################################

resource "google_compute_global_address" "visionex_ip" {
  name = "visionex-global-ip"
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "visionex-https"
  target                = google_compute_target_https_proxy.main.self_link
  port_range            = "443"
  ip_address            = google_compute_global_address.visionex_ip.address
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_compute_target_https_proxy" "main" {
  name             = "visionex-https-proxy"
  url_map          = google_compute_url_map.main.self_link
  ssl_certificates = [google_compute_managed_ssl_certificate.visionex.self_link]
}

resource "google_compute_managed_ssl_certificate" "visionex" {
  name = "visionex-ssl-cert"
  managed {
    domains = [
      "app.visionex.ai",
      "studio.visionex.ai",
      "api.visionex.ai",
    ]
  }
}

resource "google_compute_url_map" "main" {
  name            = "visionex-url-map"
  default_service = google_compute_backend_service.api.self_link

  host_rule {
    hosts        = ["app.visionex.ai", "studio.visionex.ai"]
    path_matcher = "frontend-paths"
  }
  host_rule {
    hosts        = ["api.visionex.ai"]
    path_matcher = "api-paths"
  }

  path_matcher {
    name            = "frontend-paths"
    default_service = google_compute_backend_service.frontend.self_link
  }
  path_matcher {
    name            = "api-paths"
    default_service = google_compute_backend_service.api.self_link
    path_rule {
      paths   = ["/functions/v1/*"]
      service = google_compute_backend_service.api.self_link
    }
  }
}

resource "google_compute_backend_service" "api" {
  name                  = "visionex-api-backend"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  load_balancing_scheme = "EXTERNAL_MANAGED"
  locality_lb_policy    = "LEAST_REQUEST"
  enable_cdn            = false

  health_checks = [google_compute_health_check.api.self_link]

  # Failover: traffic shifts to healthy regions automatically
  outlier_detection {
    consecutive_errors                    = 5
    interval                              { seconds = 10 }
    base_ejection_time                    { seconds = 30 }
    max_ejection_percent                  = 50
    enforcing_consecutive_errors          = 100
    enforcing_success_rate               = 100
    success_rate_minimum_hosts            = 2
    success_rate_request_volume           = 100
    success_rate_stdev_factor             = 1900
  }

  security_policy = google_compute_security_policy.cloud_armor.self_link

  dynamic "backend" {
    for_each = module.gke
    content {
      group           = backend.value.instance_group
      balancing_mode  = "UTILIZATION"
      capacity_scaler = 1.0
      max_utilization = 0.8
    }
  }
}

resource "google_compute_backend_service" "frontend" {
  name              = "visionex-frontend-backend"
  protocol          = "HTTP"
  enable_cdn        = true
  timeout_sec       = 10

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 3600
    max_ttl                      = 86400
    client_ttl                   = 3600
    negative_caching             = true
    serve_while_stale            = 86400
    signed_url_cache_max_age_sec = 7200
  }

  health_checks = [google_compute_health_check.api.self_link]

  dynamic "backend" {
    for_each = module.gke
    content {
      group           = backend.value.instance_group
      balancing_mode  = "UTILIZATION"
      capacity_scaler = 1.0
    }
  }
}

resource "google_compute_health_check" "api" {
  name               = "visionex-api-health"
  check_interval_sec = 10
  timeout_sec        = 5
  http_health_check {
    port         = 8080
    request_path = "/health/ready"
  }
}

###############################################################################
# CLOUD ARMOR WAF
###############################################################################

module "waf" {
  source     = "../../modules/waf"
  project_id = var.gcp_project_id
  policy_name = "visionex-cloud-armor"
}

resource "google_compute_security_policy" "cloud_armor" {
  name = "visionex-cloud-armor"

  # OWASP Top 10 pre-configured rules
  rule {
    action   = "deny(403)"
    priority = 1000
    match {
      expr { expression = "evaluatePreconfiguredExpr('xss-stable')" }
    }
    description = "Block XSS"
  }
  rule {
    action   = "deny(403)"
    priority = 1001
    match {
      expr { expression = "evaluatePreconfiguredExpr('sqli-stable')" }
    }
    description = "Block SQL Injection"
  }
  rule {
    action   = "deny(403)"
    priority = 1002
    match {
      expr { expression = "evaluatePreconfiguredExpr('rce-stable')" }
    }
    description = "Block RCE"
  }
  rule {
    action   = "deny(403)"
    priority = 1003
    match {
      expr { expression = "evaluatePreconfiguredExpr('lfi-stable')" }
    }
    description = "Block LFI"
  }
  # Rate limiting per IP
  rule {
    action   = "rate_based_ban"
    priority = 2000
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 1000
        interval_sec = 60
      }
      ban_duration_sec = 300
    }
    description = "Rate limit: 1000 req/min per IP"
  }
  # Per-user rate limit via JWT sub claim (custom header X-User-ID injected by gateway)
  rule {
    action   = "throttle"
    priority = 2001
    match {
      expr { expression = "has(request.headers['x-user-id'])" }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "HTTP_HEADER"
      enforce_on_key_name = "x-user-id"
      rate_limit_threshold {
        count        = 300
        interval_sec = 60
      }
    }
    description = "Per-user rate limit: 300 req/min"
  }
  # Geo block (example: restrict to allowed countries — customize as needed)
  rule {
    action   = "allow"
    priority = 900
    match {
      expr {
        expression = "origin.region_code == 'US' || origin.region_code == 'DE' || origin.region_code == 'AE' || origin.region_code == 'GB' || origin.region_code == 'JP' || origin.region_code == 'SG' || origin.region_code == 'FR' || origin.region_code == 'NL'"
      }
    }
    description = "Allow known regions"
  }
  # Default: allow (adjust if stricter geo-blocking needed)
  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow"
  }
}

###############################################################################
# CLOUD CDN — signed URLs for media assets
###############################################################################

module "cdn" {
  source     = "../../modules/cdn"
  project_id = var.gcp_project_id
}

resource "google_storage_bucket" "media_assets" {
  for_each = var.regions
  name     = "visionex-media-${each.key}-${var.gcp_project_id}"
  location = upper(replace(each.value.gcp_region, "-", "_"))

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    condition { age = 90 }
    action    { type = "Delete" }
  }

  cors {
    origin          = ["https://app.visionex.ai", "https://studio.visionex.ai"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Content-Length"]
    max_age_seconds = 3600
  }
}

###############################################################################
# SECRET MANAGER
###############################################################################

resource "google_secret_manager_secret" "visionex_secrets" {
  for_each  = toset(["supabase-url", "supabase-service-key", "supabase-anon-key", "jwt-secret", "redis-password", "luma-api-key", "elevenlabs-api-key", "openai-api-key"])
  secret_id = "visionex-${each.key}"
  replication {
    auto {}
  }
}

###############################################################################
# OUTPUTS
###############################################################################

output "global_ip" {
  value       = google_compute_global_address.visionex_ip.address
  description = "Point DNS A record here"
}

output "cluster_endpoints" {
  value = {
    for k, v in module.gke : k => v.cluster_endpoint
  }
  sensitive = true
}

output "media_bucket_names" {
  value = {
    for k, v in google_storage_bucket.media_assets : k => v.name
  }
}
