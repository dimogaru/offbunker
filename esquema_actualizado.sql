-- ====================================================================
-- PARCHE INCREMENTAL MÓDULO GASTOS (OFFBUNKER)
-- Creado para actualizar producción sin tocar datos existentes.
-- ====================================================================

-- 1. Nuevas columnas necesarias en la tabla 'trips'
ALTER TABLE public.trips 
  ADD COLUMN IF NOT EXISTS expense_base_currency text DEFAULT 'EUR'::text NOT NULL,
  ADD COLUMN IF NOT EXISTS expense_currency_locked boolean DEFAULT false NOT NULL;

-- 2. Tabla: Invitados/Acompañantes de gastos
CREATE TABLE IF NOT EXISTS public.expense_guests (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS public.expense_guests_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.expense_guests_id_seq OWNED BY public.expense_guests.id;
ALTER TABLE ONLY public.expense_guests ALTER COLUMN id SET DEFAULT nextval('public.expense_guests_id_seq'::regclass);

-- 3. Tabla: Histórico/Caché de Tasas de Cambio (Cached FX)
CREATE TABLE IF NOT EXISTS public.expense_rate_snapshots (
    id integer NOT NULL,
    base_currency text NOT NULL,
    rate_date date NOT NULL,
    rates jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS public.expense_rate_snapshots_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.expense_rate_snapshots_id_seq OWNED BY public.expense_rate_snapshots.id;
ALTER TABLE ONLY public.expense_rate_snapshots ALTER COLUMN id SET DEFAULT nextval('public.expense_rate_snapshots_id_seq'::regclass);

-- 4. Tabla: Gastos por Viaje
CREATE TABLE IF NOT EXISTS public.trip_expenses (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    client_id text NOT NULL,
    concept text NOT NULL,
    amount_minor integer NOT NULL,
    currency text NOT NULL,
    payer_id text NOT NULL,
    payer_name_snapshot text NOT NULL,
    base_currency text NOT NULL,
    base_amount_minor integer NOT NULL,
    rate_to_base numeric(24,12) NOT NULL,
    rate_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer NOT NULL,
    deleted_at timestamp with time zone
);

CREATE SEQUENCE IF NOT EXISTS public.trip_expenses_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.trip_expenses_id_seq OWNED BY public.trip_expenses.id;
ALTER TABLE ONLY public.trip_expenses ALTER COLUMN id SET DEFAULT nextval('public.trip_expenses_id_seq'::regclass);

-- 5. Tabla: Reparto de Gastos entre Integrantes
CREATE TABLE IF NOT EXISTS public.trip_expense_splits (
    id integer NOT NULL,
    expense_id integer NOT NULL,
    participant_id text NOT NULL,
    participant_name_snapshot text NOT NULL,
    amount_minor integer NOT NULL,
    base_amount_minor integer NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS public.trip_expense_splits_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.trip_expense_splits_id_seq OWNED BY public.trip_expense_splits.id;
ALTER TABLE ONLY public.trip_expense_splits ALTER COLUMN id SET DEFAULT nextval('public.trip_expense_splits_id_seq'::regclass);

-- 6. Claves Primarias y Restricciones Únicas (evita duplicados)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_guests_pkey') THEN
        ALTER TABLE ONLY public.expense_guests ADD CONSTRAINT expense_guests_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_rate_snapshots_pkey') THEN
        ALTER TABLE ONLY public.expense_rate_snapshots ADD CONSTRAINT expense_rate_snapshots_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_expenses_pkey') THEN
        ALTER TABLE ONLY public.trip_expenses ADD CONSTRAINT trip_expenses_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_expense_splits_pkey') THEN
        ALTER TABLE ONLY public.trip_expense_splits ADD CONSTRAINT trip_expense_splits_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_expense_rates_base_date') THEN
        ALTER TABLE ONLY public.expense_rate_snapshots ADD CONSTRAINT uq_expense_rates_base_date UNIQUE (base_currency, rate_date);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_expense_split_participant') THEN
        ALTER TABLE ONLY public.trip_expense_splits ADD CONSTRAINT uq_expense_split_participant UNIQUE (expense_id, participant_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_trip_expense_client_id') THEN
        ALTER TABLE ONLY public.trip_expenses ADD CONSTRAINT uq_trip_expense_client_id UNIQUE (trip_id, client_id);
    END IF;
END $$;

-- 7. Claves Foráneas (Relaciones entre tablas)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_guests_trip_id_fkey') THEN
        ALTER TABLE ONLY public.expense_guests ADD CONSTRAINT expense_guests_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_expenses_trip_id_fkey') THEN
        ALTER TABLE ONLY public.trip_expenses ADD CONSTRAINT trip_expenses_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_expense_splits_expense_id_fkey') THEN
        ALTER TABLE ONLY public.trip_expense_splits ADD CONSTRAINT trip_expense_splits_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.trip_expenses(id) ON DELETE CASCADE;
    END IF;
END $$;