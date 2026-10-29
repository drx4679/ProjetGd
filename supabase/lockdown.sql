-- ══════════════════════════════════════════════════════════════════════════
--  GoodDoctor's Shop — Verrouillage Supabase (à exécuter dans SQL Editor)
--  Dashboard Supabase → SQL Editor → New query → coller un bloc → Run
-- ══════════════════════════════════════════════════════════════════════════
--  CONSTAT (diagnostic 1c) : le rôle public "anon" (clé visible dans F12) peut
--  EXÉCUTER ~60 fonctions du schéma public, dont : finalize_sale*, open_register,
--  close_register, add_cash_movement, delete_product, hard_delete_archived_product,
--  update_till_balance, sync_multi_payment_sale, fulfill_order_create_products,
--  search_orders, track_order, add_loyalty_points, update_customer_stats...
--  => n'importe qui peut tenter de les appeler depuis la console du navigateur.
--
--  Ce qui est réellement utilisé par les sites depuis le navigateur :
--    get_public_products, get_catalog2_articles (catalogue) -> désormais via Edge Function
--    track_order (ancien site "Ecom site web" uniquement)
--  Tout le reste est réservé au back-office / caisse (comptes connectés).
-- ══════════════════════════════════════════════════════════════════════════


-- ── PARTIE 1 : DIAGNOSTIC (lecture seule, sans risque) ───────────────────

-- 1a. Tables SANS Row Level Security (doit être vide)
select schemaname, tablename
from pg_tables
where schemaname = 'public' and not rowsecurity;

-- 1b. Tables sur lesquelles "anon" a des droits (doit être vide ou justifié)
select table_name, string_agg(privilege_type, ', ') as droits_anon
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
group by table_name;

-- 1c. Fonctions que "anon" peut appeler, avec leur mode d'exécution.
--     security_definer = true  -> la fonction s'exécute avec les droits de son
--     propriétaire et CONTOURNE le RLS : c'est le cas le plus dangereux.
select p.proname as fonction,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind in ('f', 'p')
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by p.prosecdef desc, 1;

-- 1d. Les mêmes fonctions sont-elles appelables par TOUT compte connecté ?
--     (si l'inscription client est ouverte, "authenticated" n'est pas réservé au personnel)
select count(*) as fonctions_appelables_par_authenticated
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind in ('f','p')
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');


-- ── PARTIE 2 : RLS activé partout (sans effet sur service_role) ──────────
-- service_role contourne toujours le RLS : l'Edge Function continue de marcher.
-- ⚠ Si votre back-office lit des tables avec des comptes "authenticated",
--   vérifiez d'abord (1a) que ces tables ont déjà une policy.

do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;


-- ── PARTIE 3 : retirer l'accès "anon" à TOUTES les fonctions du schéma ───
-- Les fonctions des extensions (pg_trgm, unaccent) sont exclues pour ne pas
-- casser les recherches. "authenticated" (back-office) et "service_role"
-- (Edge Function) gardent l'accès. Les triggers continuent de fonctionner
-- (le droit EXECUTE n'est vérifié qu'à la création d'un trigger).

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant  execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

-- Les futures fonctions ne seront plus ouvertes à anon par défaut :
alter default privileges for role postgres in schema public revoke execute on functions from anon;


-- ── PARTIE 3 bis (OPTIONNEL) : ancien site "Ecom site web" encore en ligne ─
-- Il appelle track_order(p_phone, p_order_ref) depuis le navigateur.
-- Décommentez UNIQUEMENT si ce site doit continuer à fonctionner.
-- (il continue alors d'exposer cette seule fonction ; elle exige téléphone + référence)

-- grant execute on function public.track_order(text, text) to anon;


-- ── PARTIE 4 : (optionnel) tout fermer à anon sur les tables ─────────────
-- À lancer seulement si 1b montre des accès anon inutiles.

-- revoke all on all tables    in schema public from anon;
-- revoke all on all sequences in schema public from anon;
-- alter default privileges for role postgres in schema public revoke all on tables    from anon;
-- alter default privileges for role postgres in schema public revoke all on sequences from anon;


-- ── PARTIE 5 : vérification finale ───────────────────────────────────────
-- Relancer 1c : doit renvoyer 0 ligne (ou seulement track_order si 3 bis activé).
-- Test depuis un terminal : doit répondre 401 ou 403, plus 200 :
--   curl -i -X POST "https://<projet>.supabase.co/rest/v1/rpc/delete_product" \
--        -H "apikey: <clé anon>" -H "Content-Type: application/json" \
--        -d '{"p_id":0,"p_hard":false}'
