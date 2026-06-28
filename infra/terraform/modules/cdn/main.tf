variable "project_id" {}

# CDN Signing Key for signed URLs (audio/video asset protection)
resource "google_compute_backend_bucket_signed_url_key" "media_key" {
  name           = "visionex-cdn-signing-key"
  key_value      = random_bytes.signing_key.base64
  backend_bucket = google_compute_backend_bucket.media.name
}

resource "random_bytes" "signing_key" {
  length = 16
}

resource "google_compute_backend_bucket" "media" {
  name        = "visionex-media-cdn"
  description = "CDN backend for AI-generated media assets"
  bucket_name = "visionex-media-cdn-${var.project_id}"
  enable_cdn  = true

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 86400
    max_ttl                      = 604800
    client_ttl                   = 86400
    negative_caching             = true
    signed_url_cache_max_age_sec = 3600
    serve_while_stale            = 86400
    bypass_cache_on_request_headers {
      header_name = "Cache-Control"
    }
  }
}

output "signing_key_name"  { value = google_compute_backend_bucket_signed_url_key.media_key.name }
output "backend_bucket_id" { value = google_compute_backend_bucket.media.id }
