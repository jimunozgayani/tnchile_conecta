
create table if not exists public.tipos_camion (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int,
  activo boolean not null default true
);

grant select on public.tipos_camion to authenticated;
grant all on public.tipos_camion to service_role;

alter table public.tipos_camion enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tipos_camion' and policyname='cualquiera autenticado lee tipos_camion') then
    create policy "cualquiera autenticado lee tipos_camion"
      on public.tipos_camion for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tipos_camion' and policyname='admin gestiona tipos_camion') then
    create policy "admin gestiona tipos_camion"
      on public.tipos_camion for all to authenticated
      using (public.has_role(auth.uid(),'admin'::app_role))
      with check (public.has_role(auth.uid(),'admin'::app_role));
  end if;
end $$;

insert into public.tipos_camion (nombre, orden) values
  ('Batea', 1), ('Cama Baja', 2), ('Camión Abierto 10 Tn', 3),
  ('Camión Cerrado 5 Mil Kg', 4), ('Camión Cerrado 10 Tn', 5),
  ('Camión 3/4 Abierto', 6), ('Camión 3/4 Cerrado', 7),
  ('Camión 5 Mil', 8), ('Camión 5 Mil c/ Frío', 9),
  ('Camión 7 Mil', 10), ('Camión 10 Mil', 11),
  ('Camión 10 Mil c/ Frío', 12), ('Camión 15 Mil', 13),
  ('Camión 15 Mil c/ Frío', 14), ('Camión y Carro', 15),
  ('Cuello Cisne', 16), ('Equipo Plano 24 Ton', 17),
  ('Furgón Kargo Box', 18), ('Furgón Tipo Boxer', 19),
  ('Furgón Tipo Partner', 20), ('Grúa', 21), ('Pluma', 22),
  ('Plano 10T', 23), ('Plano 15T', 24), ('Rampla Plana', 25),
  ('Rampla Plana 28T', 26), ('Rampla Fría/Thermo', 27),
  ('Rampla Furgonada/Paquetera', 28), ('Sider', 29), ('Tolva', 30)
on conflict (nombre) do nothing;

alter table public.disponibilidad_chofer
  add column if not exists tipo_camion_id uuid references public.tipos_camion(id),
  add column if not exists tipo_camion_otro text;
