-- Migration: Add supervisor role to app_role enum
-- Run this on your PostgreSQL database

-- Add 'supervisor' to the app_role enum
ALTER TYPE public.app_role ADD VALUE 'supervisor';

-- Verify the change
-- SELECT enum_range(NULL::app_role);
