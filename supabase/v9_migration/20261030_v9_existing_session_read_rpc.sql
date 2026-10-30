CREATE OR REPLACE FUNCTION public.dm_v9_ops_session_read_v1(
 p_auth_token text,p_limit integer DEFAULT 20,p_after text DEFAULT '',p_gate text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE u public.app_user_credentials%ROWTYPE;
BEGIN
 IF p_auth_token IS NULL OR length(p_auth_token)<24 OR length(p_auth_token)>512 THEN
   RAISE EXCEPTION 'V9_SESSION_REQUIRED' USING ERRCODE='28000';
 END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>50 OR length(coalesce(p_after,''))>150 OR length(coalesce(p_gate,''))>80 THEN
   RAISE EXCEPTION 'V9_INVALID_PARAMS' USING ERRCODE='22023';
 END IF;
 u:=public.app_require_session_(p_auth_token);
 IF coalesce(u.must_change_password,false) THEN
   RAISE EXCEPTION 'V9_PASSWORD_CHANGE_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF NOT(
   upper(btrim(coalesce(u.rol,''))) IN ('ADMIN','ADMINISTRADOR')
   OR upper(translate(btrim(coalesce(u.area,'')),'ÁÉÍÓÚáéíóú','AEIOUaeiou'))='OFICINA TECNICA'
 ) THEN
   RAISE EXCEPTION 'V9_PERMISSION_DENIED' USING ERRCODE='42501';
 END IF;
 RETURN public.dm_v9_ops_read_v1(p_limit,p_after,p_gate);
END $body$;
REVOKE ALL ON FUNCTION public.dm_v9_ops_session_read_v1(text,integer,text,text)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dm_v9_ops_session_read_v1(text,integer,text,text)
 TO anon,authenticated;
