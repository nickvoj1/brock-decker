
REVOKE EXECUTE ON FUNCTION public.crm_search_contacts(text, jsonb, integer, integer, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(text, app_role) FROM authenticated;
