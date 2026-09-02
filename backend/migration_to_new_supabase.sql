-- ==============================================================================
-- DMS (Digital Signage Management System) Clean Schema
-- Target Supabase Project: hthjagrhwoxwionduhmi (ap-southeast-1)
-- Description: Creates all 7 tables, relations, and performance indexes.
--              Starts completely clean (0 rows).
-- ==============================================================================

-- Drop existing tables if restarting completely fresh (safe for new project)
DROP TABLE IF EXISTS schedule_devices CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS device_playlists CASCADE;
DROP TABLE IF EXISTS playlist_items CASCADE;
DROP TABLE IF EXISTS playlists CASCADE;
DROP TABLE IF EXISTS media CASCADE;
DROP TABLE IF EXISTS devices CASCADE;

-- 1. Devices Table
CREATE TABLE devices (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    location VARCHAR NOT NULL,
    resolution VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'Offline',
    "lastSeen" VARCHAR NOT NULL,
    "lastSeenMs" BIGINT NOT NULL,
    "ipAddress" VARCHAR,
    storage VARCHAR,
    "heartbeatAt" BIGINT,
    "appVersion" VARCHAR,
    "currentPlaylistId" VARCHAR,
    "currentMediaId" VARCHAR,
    "storageUsed" DOUBLE PRECISION,
    "storageTotal" DOUBLE PRECISION,
    "uptimeSeconds" BIGINT,
    "firmwareVersion" VARCHAR,
    "deviceToken" VARCHAR,
    "androidId" VARCHAR,
    orientation VARCHAR NOT NULL DEFAULT 'LANDSCAPE'
);

CREATE UNIQUE INDEX ix_devices_android_id ON devices ("androidId") WHERE "androidId" IS NOT NULL;
CREATE INDEX ix_devices_id ON devices (id);

-- 2. Media Table
CREATE TABLE media (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    category VARCHAR NOT NULL,
    thumbnail VARCHAR NOT NULL,
    "originalFile" VARCHAR NOT NULL,
    size BIGINT NOT NULL,
    dimensions VARCHAR NOT NULL,
    duration INTEGER,
    "uploadedAt" BIGINT NOT NULL,
    "uploadedBy" VARCHAR NOT NULL,
    checksum VARCHAR
);

CREATE INDEX ix_media_id ON media (id);

-- 3. Playlists Table
CREATE TABLE playlists (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR DEFAULT '',
    status VARCHAR NOT NULL DEFAULT 'Draft',
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL
);

CREATE INDEX ix_playlists_id ON playlists (id);

-- 4. Playlist Items Table
CREATE TABLE playlist_items (
    id VARCHAR PRIMARY KEY,
    "playlistId" VARCHAR NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    "mediaId" VARCHAR NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL DEFAULT 1,
    duration INTEGER NOT NULL DEFAULT 10,
    transition VARCHAR DEFAULT 'none'
);

CREATE INDEX ix_playlist_items_id ON playlist_items (id);

-- 5. Device Playlists Junction Table
CREATE TABLE device_playlists (
    "playlistId" VARCHAR NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    "deviceId" VARCHAR NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    PRIMARY KEY ("playlistId", "deviceId")
);

-- 6. Schedules Table
CREATE TABLE schedules (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    "playlistId" VARCHAR NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    repeat VARCHAR NOT NULL DEFAULT 'Once',
    priority VARCHAR NOT NULL DEFAULT 'Normal',
    status VARCHAR NOT NULL DEFAULT 'Draft',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL
);

CREATE INDEX ix_schedules_id ON schedules (id);

-- 7. Schedule Devices Junction Table
CREATE TABLE schedule_devices (
    "scheduleId" VARCHAR NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    "deviceId" VARCHAR NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    PRIMARY KEY ("scheduleId", "deviceId")
);

-- 8. App Updates (OTA) Table
CREATE TABLE app_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_name VARCHAR(30) NOT NULL,
    version_code INTEGER NOT NULL UNIQUE,
    apk_filename TEXT NOT NULL,
    apk_url TEXT NOT NULL,
    checksum_sha256 VARCHAR NOT NULL,
    file_size BIGINT NOT NULL,
    release_notes TEXT,
    mandatory BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0 NOT NULL,
    last_downloaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_app_updates_version_code ON app_updates (version_code);
CREATE INDEX ix_app_updates_is_active ON app_updates (is_active);

-- Performance Indexes for High-Frequency Polling
CREATE INDEX idx_schedules_active_window ON schedules (status, "startDate", "endDate", "startTime", "endTime");
CREATE INDEX idx_schedule_devices_dev ON schedule_devices ("deviceId", "scheduleId");
CREATE INDEX idx_playlist_items_pl ON playlist_items ("playlistId", "order");

-- ==============================================================================
-- Supabase Storage Buckets & Policies Setup
-- ==============================================================================

-- Create public storage buckets for media and apks
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('media', 'media', true),
    ('apks', 'apks', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Access Policies
DO $$
BEGIN
    -- Public Read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for Media') THEN
        CREATE POLICY "Public Access for Media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for APKs') THEN
        CREATE POLICY "Public Access for APKs" ON storage.objects FOR SELECT USING (bucket_id = 'apks');
    END IF;

    -- Upload Access
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Uploads for Media') THEN
        CREATE POLICY "Allow Uploads for Media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Uploads for APKs') THEN
        CREATE POLICY "Allow Uploads for APKs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'apks');
    END IF;

    -- Delete Access
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Delete for Media') THEN
        CREATE POLICY "Allow Delete for Media" ON storage.objects FOR DELETE USING (bucket_id = 'media');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Delete for APKs') THEN
        CREATE POLICY "Allow Delete for APKs" ON storage.objects FOR DELETE USING (bucket_id = 'apks');
    END IF;
END $$;
