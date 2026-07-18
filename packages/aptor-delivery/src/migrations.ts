export const deliveryMigrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS profiles (
        profile_id TEXT PRIMARY KEY,
        handle TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        public_encryption_key TEXT NOT NULL,
        holder_profile TEXT NOT NULL,
        issuer_profile TEXT NOT NULL,
        access_token_hash TEXT NOT NULL UNIQUE,
        access_token_expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS invitations (
        invitation_id TEXT PRIMARY KEY,
        created_by_profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
        intended_role TEXT NOT NULL CHECK (intended_role = 'issuer'),
        opaque_token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        redeemed_at TEXT,
        redeemed_by_profile_id TEXT REFERENCES profiles(profile_id),
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS invitations_creator_idx
        ON invitations(created_by_profile_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS invitations_redeemer_idx
        ON invitations(redeemed_by_profile_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS encrypted_envelopes (
        envelope_id TEXT PRIMARY KEY,
        sender_profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
        recipient_profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
        envelope_type TEXT NOT NULL CHECK (envelope_type IN ('work_credential', 'proof_request')),
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        ephemeral_public_key TEXT NOT NULL,
        encryption_version INTEGER NOT NULL,
        content_digest TEXT NOT NULL,
        delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending', 'received', 'deleted')),
        created_at TEXT NOT NULL,
        received_at TEXT,
        UNIQUE(sender_profile_id, recipient_profile_id, envelope_type, content_digest)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS envelopes_recipient_idx
        ON encrypted_envelopes(recipient_profile_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS notifications (
        notification_id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
        type TEXT NOT NULL,
        related_entity_id TEXT NOT NULL,
        read_at TEXT,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS notifications_profile_idx
        ON notifications(profile_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS request_tracking (
        request_id TEXT PRIMARY KEY,
        verifier_profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
        professional_profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
        contract_address TEXT NOT NULL,
        network_id TEXT NOT NULL,
        registration_transaction_id TEXT NOT NULL,
        fulfillment_transaction_id TEXT,
        public_status TEXT NOT NULL,
        last_checked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS tracking_verifier_idx
        ON request_tracking(verifier_profile_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS tracking_professional_idx
        ON request_tracking(professional_profile_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS rate_limits (
        rate_key TEXT NOT NULL,
        action TEXT NOT NULL,
        window_started_at INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        PRIMARY KEY(rate_key, action)
      ) STRICT;
    `,
  },
] as const;
