-- Autorizar solamente cálculo de identidad de lectura en V9. No modifica datos ni writer.
grant execute on function delta_v9.rop05_identity_digest_v1(jsonb) to service_role;
revoke all on function delta_v9.rop05_identity_digest_v1(jsonb) from public,anon,authenticated;
