-- Helpers de prueba (solo en bases de prueba). Los carga run_local.sh antes de cada fase.
create schema tt;
grant usage on schema tt to public;
create function tt.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if c is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function tt.throws(stmt text, frag text, msg text) returns void language plpgsql as $$
declare v_failed boolean := false;
begin
  begin
    execute stmt;
  exception when others then
    v_failed := true;
    if position(frag in sqlerrm) = 0 then
      raise exception 'FAIL: % (error inesperado: %)', msg, sqlerrm;
    end if;
  end;
  if not v_failed then raise exception 'FAIL: % (no lanzó error)', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function tt.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  execute 'set role authenticated';
end $$;
create function tt.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
  execute 'set role anon';
end $$;
create function tt.reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
grant execute on all functions in schema tt to public;
