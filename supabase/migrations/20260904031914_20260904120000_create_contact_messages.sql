CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL DEFAULT 'General Inquiry',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read messages (admin view)
CREATE POLICY "read_contact_messages_authenticated" ON contact_messages
  FOR SELECT TO authenticated USING (true);

-- Anyone (anon + authenticated) can submit a contact message
CREATE POLICY "insert_contact_messages_anyone" ON contact_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);
