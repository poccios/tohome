-- Initial schema for ToHome application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_e164 VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP NULL
);

CREATE INDEX idx_users_phone ON users(phone_e164);
CREATE INDEX idx_users_status ON users(status);

-- Login links table
CREATE TABLE login_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_e164 VARCHAR(20) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  device_id VARCHAR(255) NULL,
  ip_hash VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_links_phone ON login_links(phone_e164);
CREATE INDEX idx_login_links_token_hash ON login_links(token_hash);
CREATE INDEX idx_login_links_expires_at ON login_links(expires_at);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  device_id VARCHAR(255) NULL,
  user_agent TEXT NULL,
  ip_hash VARCHAR(255) NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_revoked_at ON sessions(revoked_at);
