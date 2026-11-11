-- Migration: Add profile_image column to users table
-- Project: Petrol Bunk Management System

ALTER TABLE `users` 
ADD COLUMN `profile_image` VARCHAR(255) NULL AFTER `role`;
