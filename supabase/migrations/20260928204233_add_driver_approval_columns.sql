/*
# Add driver approval system columns

## Overview
Adds an approval workflow for driver registration. New drivers register with
is_approved=false and status='pending_approval'. Admin must approve before they
can receive ride requests.

## Changes to existing tables

### drivers (modified)
- Added `is_approved` (boolean, default false) — whether admin approved the driver
- Added `status` (text: pending_approval, approved, rejected) — approval lifecycle

## Security
- No RLS policy changes needed — existing anon+authenticated CRUD policies remain.
- No data loss — only additive columns with safe defaults.
*/

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_approval'
  CHECK (status IN ('pending_approval', 'approved', 'rejected'));
