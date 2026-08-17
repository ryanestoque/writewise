from supabase import Client, create_client

from app.core.config import settings

# Service role client - bypasses RLS and handles admin operations
supabase_client: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
)
