###############################################################################
# GKE Module — production-grade cluster with workload identity + autoscaling
###############################################################################

variable "project_id"     {}
variable "cluster_name"   {}
variable "region"         {}
variable "network"        {}
variable "subnetwork"     {}
variable "node_count_min" { default = 2 }
variable "node_count_max" { default = 50 }
variable "machine_type"   { default = "n2-standard-8" }

resource "google_container_cluster" "primary" {
  name     = var.cluster_name
  location = var.region
  project  = var.project_id

  # Remove default node pool; we manage it ourselves
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = var.network
  subnetwork = var.subnetwork

  # Workload Identity — pods assume GCP SA without key files
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Private cluster — nodes have no public IPs
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "All (restrict in production to VPN CIDR)"
    }
  }

  # Network policy (Calico)
  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  # Binary Authorization — only signed images
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # Security posture scanning
  security_posture_config {
    mode               = "BASIC"
    vulnerability_mode = "VULNERABILITY_BASIC"
  }

  # Logging + Monitoring
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS", "APISERVER", "SCHEDULER", "CONTROLLER_MANAGER", "STORAGE", "HPA", "POD", "DAEMONSET", "DEPLOYMENT", "STATEFULSET"]
    managed_prometheus {
      enabled = true
    }
  }

  # Maintenance windows — 2AM–6AM UTC Sunday
  maintenance_policy {
    recurring_window {
      start_time = "2024-01-07T02:00:00Z"
      end_time   = "2024-01-07T06:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SU"
    }
  }

  # Addons
  addons_config {
    http_load_balancing        { disabled = false }
    horizontal_pod_autoscaling { disabled = false }
    network_policy_config      { disabled = false }
    dns_cache_config           { enabled  = true  }
    gce_persistent_disk_csi_driver_config { enabled = true }
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  release_channel {
    channel = "REGULAR"
  }
}

# General-purpose node pool
resource "google_container_node_pool" "general" {
  name       = "general"
  cluster    = google_container_cluster.primary.name
  location   = var.region
  project    = var.project_id

  autoscaling {
    min_node_count = var.node_count_min
    max_node_count = var.node_count_max
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    strategy        = "SURGE"
    max_surge       = 2
    max_unavailable = 0
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = 100
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    labels = {
      pool        = "general"
      environment = "production"
    }

    tags = ["visionex-node"]
  }
}

# High-memory node pool for AI workers
resource "google_container_node_pool" "ai_workers" {
  name       = "ai-workers"
  cluster    = google_container_cluster.primary.name
  location   = var.region
  project    = var.project_id

  autoscaling {
    min_node_count = 0
    max_node_count = 20
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = "n2-highmem-16"   # 16 vCPU, 128GB RAM for GPU-adjacent ML work
    disk_size_gb = 200
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Taint so only AI workers schedule here
    taint {
      key    = "workload"
      value  = "ai-worker"
      effect = "NO_SCHEDULE"
    }

    labels = {
      pool     = "ai-workers"
      workload = "ai-worker"
    }
  }
}

output "cluster_endpoint"  { value = google_container_cluster.primary.endpoint }
output "instance_group"    { value = google_container_node_pool.general.instance_group_urls[0] }
