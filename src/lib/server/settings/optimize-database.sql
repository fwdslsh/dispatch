-- Database Optimization Script for Settings
-- Run this periodically for optimal performance

-- Enable Write-Ahead Logging for better concurrency
PRAGMA journal_mode = WAL;

-- Optimize query planning
PRAGMA optimize;

-- Analyze tables for query optimizer statistics
ANALYZE settings_categories;
ANALYZE configuration_settings;

-- Vacuum to reclaim unused space and defragment
-- Note: VACUUM should be run when database is not heavily loaded
-- VACUUM;

-- Verify foreign key integrity
PRAGMA foreign_key_check;

-- Check index effectiveness
-- This query shows which indexes are being used
SELECT
  name,
  tbl_name,
  sql
FROM sqlite_master
WHERE type = 'index'
  AND tbl_name IN ('settings_categories', 'configuration_settings')
ORDER BY tbl_name, name;

-- Show statistics
SELECT
  'Categories' as table_name,
  COUNT(*) as row_count
FROM settings_categories
UNION ALL
SELECT
  'Settings' as table_name,
  COUNT(*) as row_count
FROM configuration_settings;

-- Performance check: Verify indexes are working
EXPLAIN QUERY PLAN
SELECT * FROM configuration_settings WHERE category_id = 'authentication';