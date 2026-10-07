ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS superadmin_all_clients ON public.clients;
CREATE POLICY superadmin_all_clients ON public.clients FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');

DROP POLICY IF EXISTS client_read_clients ON public.clients;
CREATE POLICY client_read_clients ON public.clients FOR SELECT TO authenticated 
USING (public.user_role() = 'client' AND id = public.user_client_id());
