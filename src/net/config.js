// Domyślna konfiguracja trybu online (Supabase).
// Wpisz tu URL projektu i klucz „anon public”, aby tryb online włączał się automatycznie u wszystkich graczy.
// Klucz anon jest publiczny z założenia – dostęp chronią reguły RLS z pliku supabase/schema.sql.
// NIGDY nie wpisuj tu klucza service_role.
export const DEFAULT_ONLINE = {
  url: 'https://howpkgcffxezqgridpob.supabase.co',
  anonKey: 'sb_publishable_5NiA7zIoVLDXrqFyGZ1m7Q_GFCYBLHu',
};
