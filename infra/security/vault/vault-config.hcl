# HashiCorp Vault configuration for Visionex AMS
# Deployed as a StatefulSet in visionex-security namespace

ui            = true
log_level     = "warn"
api_addr      = "https://vault.visionex-security.svc.cluster.local:8200"
cluster_addr  = "https://vault.visionex-security.svc.cluster.local:8201"

storage "gcs" {
  bucket     = "visionex-vault-storage"
  ha_enabled = "true"
}

listener "tcp" {
  address            = "0.0.0.0:8200"
  tls_cert_file      = "/vault/tls/tls.crt"
  tls_key_file       = "/vault/tls/tls.key"
  tls_min_version    = "tls13"
}

seal "gcpckms" {
  project    = "visionex-prod"
  region     = "global"
  key_ring   = "vault-keyring"
  crypto_key = "vault-unseal-key"
}

telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
}

# ── Secret paths ──────────────────────────────────────────────────────────────
# vault secrets enable -path=visionex kv-v2
#
# Provider API keys:
#   visionex/provider-keys/luma-api-key
#   visionex/provider-keys/elevenlabs-api-key
#   visionex/provider-keys/openai-api-key
#   visionex/provider-keys/murf-api-key
#
# Infrastructure:
#   visionex/infra/supabase-service-key
#   visionex/infra/jwt-secret
#   visionex/infra/redis-password
#   visionex/infra/cdn-signing-key
#
# Billing:
#   visionex/billing/stripe-secret-key
#   visionex/billing/stripe-webhook-secret
