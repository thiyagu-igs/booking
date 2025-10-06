-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS waitlist_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS waitlist_management_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user and grant permissions (if needed)
-- Note: Replace 'integra' with your actual password
-- CREATE USER IF NOT EXISTS 'root'@'localhost' IDENTIFIED BY 'integra';
-- GRANT ALL PRIVILEGES ON waitlist_management.* TO 'root'@'localhost';
-- GRANT ALL PRIVILEGES ON waitlist_management_test.* TO 'root'@'localhost';
-- FLUSH PRIVILEGES;

-- Check current user and authentication plugin
SELECT user, host, plugin FROM mysql.user WHERE user = 'root';

-- Show databases
SHOW DATABASES;