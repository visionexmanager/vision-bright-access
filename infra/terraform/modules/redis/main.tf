variable "project_id"     {}
variable "name"           {}
variable "region"         {}
variable "network"        {}
variable "memory_size_gb" { default = 16 }
variable "redis_version"  { default = "REDIS_7_0" }
variable "tier"           { default = "STANDARD_HA" }

resource "google_redis_instance" "cache" {
  name               = var.name
  tier               = var.tier
  memory_size_gb     = var.memory_size_gb
  region             = var.region
  project            = var.project_id
  redis_version      = var.redis_version
  display_name       = "Visionex Redis — ${var.region}"
  authorized_network = var.network
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  redis_configs = {
    maxmemory-policy   = "allkeys-lru"
    activedefrag       = "yes"
    lazyfree-lazy-eviction = "yes"
  }

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }
}

output "host" { value = google_redis_instance.cache.host }
output "port" { value = google_redis_instance.cache.port }
