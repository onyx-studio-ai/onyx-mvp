-- P0 hardening: lock down critical payment/order write paths.
-- This migration uses RESTRICTIVE policies so legacy permissive policies
-- cannot grant broad write access to anon/authenticated roles.

-- 1) Lock down order updates to service_role only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'voice_orders'
      AND policyname = 'p0_voice_orders_update_service_only'
  ) THEN
    CREATE POLICY p0_voice_orders_update_service_only
      ON public.voice_orders
      AS RESTRICTIVE
      FOR UPDATE
      TO anon, authenticated
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'music_orders'
      AND policyname = 'p0_music_orders_update_service_only'
  ) THEN
    CREATE POLICY p0_music_orders_update_service_only
      ON public.music_orders
      AS RESTRICTIVE
      FOR UPDATE
      TO anon, authenticated
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orchestra_orders'
      AND policyname = 'p0_orchestra_orders_update_service_only'
  ) THEN
    CREATE POLICY p0_orchestra_orders_update_service_only
      ON public.orchestra_orders
      AS RESTRICTIVE
      FOR UPDATE
      TO anon, authenticated
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- 2) Lock down deliverables bucket write operations to service_role only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p0_deliverables_insert_service_only'
  ) THEN
    CREATE POLICY p0_deliverables_insert_service_only
      ON storage.objects
      AS RESTRICTIVE
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (
        bucket_id = 'deliverables'
        AND auth.role() = 'service_role'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p0_deliverables_update_service_only'
  ) THEN
    CREATE POLICY p0_deliverables_update_service_only
      ON storage.objects
      AS RESTRICTIVE
      FOR UPDATE
      TO anon, authenticated
      USING (
        bucket_id = 'deliverables'
        AND auth.role() = 'service_role'
      )
      WITH CHECK (
        bucket_id = 'deliverables'
        AND auth.role() = 'service_role'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p0_deliverables_delete_service_only'
  ) THEN
    CREATE POLICY p0_deliverables_delete_service_only
      ON storage.objects
      AS RESTRICTIVE
      FOR DELETE
      TO anon, authenticated
      USING (
        bucket_id = 'deliverables'
        AND auth.role() = 'service_role'
      );
  END IF;
END $$;
