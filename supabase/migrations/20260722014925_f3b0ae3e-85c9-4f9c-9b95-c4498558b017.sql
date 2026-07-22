CREATE OR REPLACE FUNCTION public._debug_who() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('current_user',current_user::text,'session_user',session_user::text,'jwt_role',current_setting('request.jwt.claim.role',true),'jwt_claims',current_setting('request.jwt.claims',true))
$$;
GRANT EXECUTE ON FUNCTION public._debug_who() TO anon, authenticated;