-- The Data Hub's control layer.
--
-- The data itself (datasets, indexes, persistent cache) lives on the production server's disk.
-- Supabase holds only METADATA: what is installed, at which version and checksum, when storage
-- was last measured, and the state of the disk. Nothing large is ever written here.
--
-- Writers: the `data-hub-storage` workflow, through the two service-role-only functions below.
-- Readers: staff (the admin role). No user, anonymous or authenticated, can read or write a row
-- directly, and the functions that write cannot be called by them either.

CREATE TABLE IF NOT EXISTS public.datahub_datasets (
  slug         text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  group_name   text NOT NULL CHECK (group_name ~ '^[a-z0-9_-]{1,40}$'),
  source_host  text CHECK (source_host IS NULL OR char_length(source_host) <= 120),
  license_name text CHECK (license_name IS NULL OR char_length(license_name) <= 120),
  license_url  text CHECK (license_url IS NULL OR license_url ~ '^https://'),
  enabled      boolean NOT NULL DEFAULT true,
  active_version text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.datahub_versions (
  id              bigserial PRIMARY KEY,
  dataset_slug    text NOT NULL REFERENCES public.datahub_datasets (slug) ON DELETE CASCADE,
  version         text NOT NULL CHECK (version ~ '^[A-Za-z0-9._-]{1,40}$'),
  sha256          text CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  payload_bytes   bigint CHECK (payload_bytes IS NULL OR payload_bytes >= 0),
  extracted_bytes bigint CHECK (extracted_bytes IS NULL OR extracted_bytes >= 0),
  installed_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_slug, version)
);

CREATE TABLE IF NOT EXISTS public.datahub_storage_snapshots (
  id                     bigserial PRIMARY KEY,
  measured_at            timestamptz NOT NULL,
  recorded_at            timestamptz NOT NULL DEFAULT now(),
  state                  text NOT NULL CHECK (state IN ('ok', 'low', 'emergency', 'over_budget')),
  path                   text NOT NULL CHECK (char_length(path) <= 200),
  disk_total_bytes       bigint NOT NULL CHECK (disk_total_bytes >= 0),
  disk_used_bytes        bigint NOT NULL CHECK (disk_used_bytes >= 0),
  disk_free_bytes        bigint NOT NULL CHECK (disk_free_bytes >= 0),
  budget_effective_gb    integer NOT NULL CHECK (budget_effective_gb >= 0),
  reserve_gb             integer NOT NULL CHECK (reserve_gb >= 0),
  datasets_bytes         bigint NOT NULL CHECK (datasets_bytes >= 0),
  indexes_bytes          bigint NOT NULL CHECK (indexes_bytes >= 0),
  global_cache_bytes     bigint NOT NULL CHECK (global_cache_bytes >= 0),
  asset_cache_bytes      bigint NOT NULL CHECK (asset_cache_bytes >= 0),
  conversion_cache_bytes bigint NOT NULL CHECK (conversion_cache_bytes >= 0),
  temporary_bytes        bigint NOT NULL CHECK (temporary_bytes >= 0),
  reserved_bytes         bigint NOT NULL CHECK (reserved_bytes >= 0),
  total_bytes            bigint NOT NULL CHECK (total_bytes >= 0),
  remaining_budget_bytes bigint NOT NULL CHECK (remaining_budget_bytes >= 0)
);
CREATE INDEX IF NOT EXISTS datahub_snapshots_measured_idx ON public.datahub_storage_snapshots (measured_at DESC);

ALTER TABLE public.datahub_datasets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datahub_versions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datahub_storage_snapshots ENABLE ROW LEVEL SECURITY;

-- Staff read; nobody else. has_role is wrapped in (select …) so it is evaluated once, not per row.
DROP POLICY IF EXISTS datahub_datasets_admin_read ON public.datahub_datasets;
CREATE POLICY datahub_datasets_admin_read ON public.datahub_datasets FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));
DROP POLICY IF EXISTS datahub_versions_admin_read ON public.datahub_versions;
CREATE POLICY datahub_versions_admin_read ON public.datahub_versions FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));
DROP POLICY IF EXISTS datahub_snapshots_admin_read ON public.datahub_storage_snapshots;
CREATE POLICY datahub_snapshots_admin_read ON public.datahub_storage_snapshots FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

REVOKE ALL ON public.datahub_datasets, public.datahub_versions, public.datahub_storage_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.datahub_datasets, public.datahub_versions, public.datahub_storage_snapshots TO authenticated;
GRANT ALL ON public.datahub_datasets, public.datahub_versions, public.datahub_storage_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.datahub_versions_id_seq, public.datahub_storage_snapshots_id_seq TO service_role;

-- Record one storage measurement (the JSON the server wrote to manifests/storage.json).
CREATE OR REPLACE FUNCTION public.datahub_record_snapshot(_data jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id bigint;
  _disk jsonb := _data -> 'disk';
  _hub jsonb := _data -> 'data_hub';
  _budget jsonb := _data -> 'budget';
BEGIN
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' OR _disk IS NULL OR _hub IS NULL OR _budget IS NULL THEN
    RAISE EXCEPTION 'invalid snapshot' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.datahub_storage_snapshots (
    measured_at, state, path, disk_total_bytes, disk_used_bytes, disk_free_bytes, budget_effective_gb, reserve_gb,
    datasets_bytes, indexes_bytes, global_cache_bytes, asset_cache_bytes, conversion_cache_bytes, temporary_bytes,
    reserved_bytes, total_bytes, remaining_budget_bytes
  ) VALUES (
    (_data ->> 'measured_at')::timestamptz, _data ->> 'state', left(_data ->> 'path', 200),
    (_disk ->> 'total_bytes')::bigint, (_disk ->> 'used_bytes')::bigint, (_disk ->> 'free_bytes')::bigint,
    (_budget ->> 'effective_gb')::integer, (_budget ->> 'reserve_gb')::integer,
    (_hub ->> 'datasets_bytes')::bigint, (_hub ->> 'indexes_bytes')::bigint, (_hub ->> 'global_cache_bytes')::bigint,
    (_hub ->> 'asset_cache_bytes')::bigint, (_hub ->> 'conversion_cache_bytes')::bigint, (_hub ->> 'temporary_bytes')::bigint,
    (_hub ->> 'reserved_bytes')::bigint, (_hub ->> 'total_bytes')::bigint, (_hub ->> 'remaining_budget_bytes')::bigint
  ) RETURNING id INTO _id;
  -- History is for trends, not an archive: the latest 2,000 measurements are kept.
  DELETE FROM public.datahub_storage_snapshots WHERE id <= _id - 2000;
  RETURN _id;
END;
$$;

-- Record one installed dataset version (a MANIFEST.json the server wrote) and mark it active.
CREATE OR REPLACE FUNCTION public.datahub_record_dataset(_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _slug text := _data ->> 'dataset';
  _version text := _data ->> 'version';
BEGIN
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' OR _slug IS NULL OR _version IS NULL THEN
    RAISE EXCEPTION 'invalid dataset record' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.datahub_datasets (slug, group_name, source_host, active_version, updated_at)
  VALUES (_slug, coalesce(_data ->> 'group', 'technical'), left(_data ->> 'source_host', 120), _version, now())
  ON CONFLICT (slug) DO UPDATE SET source_host = excluded.source_host, active_version = excluded.active_version, updated_at = now();
  INSERT INTO public.datahub_versions (dataset_slug, version, sha256, payload_bytes, extracted_bytes, installed_at)
  VALUES (_slug, _version, _data ->> 'sha256', (_data ->> 'payload_bytes')::bigint, (_data ->> 'extracted_bytes')::bigint,
          coalesce((_data ->> 'installed_at')::timestamptz, now()))
  ON CONFLICT (dataset_slug, version) DO UPDATE SET sha256 = excluded.sha256, payload_bytes = excluded.payload_bytes, extracted_bytes = excluded.extracted_bytes;
END;
$$;

-- What administration reads: the latest measurement and every dataset with its active version.
-- Safe operational numbers only: no cost, no secret, no address.
CREATE OR REPLACE FUNCTION public.datahub_admin_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'storage', (SELECT to_jsonb(s) - 'id' FROM public.datahub_storage_snapshots s ORDER BY measured_at DESC LIMIT 1),
    'datasets', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'slug', d.slug, 'group', d.group_name, 'enabled', d.enabled, 'active_version', d.active_version,
        'installed_at', v.installed_at, 'extracted_bytes', v.extracted_bytes, 'sha256', v.sha256
      ) ORDER BY d.group_name, d.slug)
      FROM public.datahub_datasets d
      LEFT JOIN public.datahub_versions v ON v.dataset_slug = d.slug AND v.version = d.active_version
    ), '[]'::jsonb)
  );
END;
$$;

-- A REVOKE FROM PUBLIC alone is not isolation: anon and authenticated are named, and service_role is granted back.
REVOKE ALL ON FUNCTION public.datahub_record_snapshot(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.datahub_record_dataset(jsonb)  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.datahub_record_snapshot(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.datahub_record_dataset(jsonb)  TO service_role;
-- The admin reader checks the role itself; it is callable by signed-in users and refuses everyone but staff.
REVOKE ALL ON FUNCTION public.datahub_admin_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.datahub_admin_status() TO authenticated, service_role;
