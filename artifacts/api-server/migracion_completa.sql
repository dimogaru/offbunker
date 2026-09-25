--
-- PostgreSQL database dump
--

\restrict C0aaL8UwZsTCyQfOIC03gHhSD1LFt1IW5reycDL5HePtREtEr8crMzZCK4p6wu0

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.trips DROP CONSTRAINT IF EXISTS trips_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.trip_shares DROP CONSTRAINT IF EXISTS trip_shares_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.trip_shares DROP CONSTRAINT IF EXISTS trip_shares_trip_id_fkey;
ALTER TABLE IF EXISTS ONLY public.rentals DROP CONSTRAINT IF EXISTS rentals_trip_id_trips_id_fk;
ALTER TABLE IF EXISTS ONLY public.parking DROP CONSTRAINT IF EXISTS parking_trip_id_trips_id_fk;
ALTER TABLE IF EXISTS ONLY public.itinerary_items DROP CONSTRAINT IF EXISTS itinerary_items_trip_id_trips_id_fk;
ALTER TABLE IF EXISTS ONLY public.flights DROP CONSTRAINT IF EXISTS flights_trip_id_trips_id_fk;
ALTER TABLE IF EXISTS ONLY public.baggage_items DROP CONSTRAINT IF EXISTS fk_baggage_user;
ALTER TABLE IF EXISTS ONLY public.documents DROP CONSTRAINT IF EXISTS documents_trip_id_trips_id_fk;
ALTER TABLE IF EXISTS ONLY public.baggage_items DROP CONSTRAINT IF EXISTS baggage_items_trip_id_fkey;
ALTER TABLE IF EXISTS ONLY public.accommodations DROP CONSTRAINT IF EXISTS accommodations_trip_id_trips_id_fk;
DROP INDEX IF EXISTS public."IDX_session_expire";
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.trip_shares DROP CONSTRAINT IF EXISTS uq_trip_user_share;
ALTER TABLE IF EXISTS ONLY public.trips DROP CONSTRAINT IF EXISTS trips_share_token_key;
ALTER TABLE IF EXISTS ONLY public.trips DROP CONSTRAINT IF EXISTS trips_pkey;
ALTER TABLE IF EXISTS ONLY public.trip_shares DROP CONSTRAINT IF EXISTS trip_shares_pkey;
ALTER TABLE IF EXISTS ONLY public.session DROP CONSTRAINT IF EXISTS session_pkey;
ALTER TABLE IF EXISTS ONLY public.rentals DROP CONSTRAINT IF EXISTS rentals_pkey;
ALTER TABLE IF EXISTS ONLY public.parking DROP CONSTRAINT IF EXISTS parking_pkey;
ALTER TABLE IF EXISTS ONLY public.itinerary_items DROP CONSTRAINT IF EXISTS itinerary_items_pkey;
ALTER TABLE IF EXISTS ONLY public.flights DROP CONSTRAINT IF EXISTS flights_pkey;
ALTER TABLE IF EXISTS ONLY public.documents DROP CONSTRAINT IF EXISTS documents_pkey;
ALTER TABLE IF EXISTS ONLY public.baggage_items DROP CONSTRAINT IF EXISTS baggage_items_pkey;
ALTER TABLE IF EXISTS ONLY public.accommodations DROP CONSTRAINT IF EXISTS accommodations_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.trips ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.trip_shares ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rentals ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.parking ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.itinerary_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.flights ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.documents ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.baggage_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.accommodations ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.trips_id_seq;
DROP TABLE IF EXISTS public.trips;
DROP SEQUENCE IF EXISTS public.trip_shares_id_seq;
DROP TABLE IF EXISTS public.trip_shares;
DROP TABLE IF EXISTS public.session;
DROP SEQUENCE IF EXISTS public.rentals_id_seq;
DROP TABLE IF EXISTS public.rentals;
DROP SEQUENCE IF EXISTS public.parking_id_seq;
DROP TABLE IF EXISTS public.parking;
DROP SEQUENCE IF EXISTS public.itinerary_items_id_seq;
DROP TABLE IF EXISTS public.itinerary_items;
DROP SEQUENCE IF EXISTS public.flights_id_seq;
DROP TABLE IF EXISTS public.flights;
DROP SEQUENCE IF EXISTS public.documents_id_seq;
DROP TABLE IF EXISTS public.documents;
DROP SEQUENCE IF EXISTS public.baggage_items_id_seq;
DROP TABLE IF EXISTS public.baggage_items;
DROP SEQUENCE IF EXISTS public.accommodations_id_seq;
DROP TABLE IF EXISTS public.accommodations;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accommodations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accommodations (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'hotel'::text NOT NULL,
    address text NOT NULL,
    check_in timestamp with time zone NOT NULL,
    check_out timestamp with time zone NOT NULL,
    confirmation_code text NOT NULL,
    contact_phone text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_platform text
);


ALTER TABLE public.accommodations OWNER TO postgres;

--
-- Name: accommodations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.accommodations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accommodations_id_seq OWNER TO postgres;

--
-- Name: accommodations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accommodations_id_seq OWNED BY public.accommodations.id;


--
-- Name: baggage_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.baggage_items (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    is_checked boolean DEFAULT false NOT NULL,
    is_last_minute boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.baggage_items OWNER TO postgres;

--
-- Name: baggage_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.baggage_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.baggage_items_id_seq OWNER TO postgres;

--
-- Name: baggage_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.baggage_items_id_seq OWNED BY public.baggage_items.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    module text NOT NULL,
    name text NOT NULL,
    file_type text NOT NULL,
    file_url text,
    notes text,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documents_id_seq OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: flights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flights (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    airline text NOT NULL,
    flight_number text NOT NULL,
    departure_airport text NOT NULL,
    arrival_airport text NOT NULL,
    departure_time timestamp with time zone NOT NULL,
    arrival_time timestamp with time zone NOT NULL,
    terminal text,
    gate text,
    seat text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.flights OWNER TO postgres;

--
-- Name: flights_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.flights_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.flights_id_seq OWNER TO postgres;

--
-- Name: flights_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.flights_id_seq OWNED BY public.flights.id;


--
-- Name: itinerary_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.itinerary_items (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    date date NOT NULL,
    "time" text,
    title text NOT NULL,
    description text,
    location text,
    category text DEFAULT 'other'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.itinerary_items OWNER TO postgres;

--
-- Name: itinerary_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.itinerary_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.itinerary_items_id_seq OWNER TO postgres;

--
-- Name: itinerary_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.itinerary_items_id_seq OWNED BY public.itinerary_items.id;


--
-- Name: parking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parking (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    location text NOT NULL,
    reservation_code text NOT NULL,
    entry_date timestamp with time zone NOT NULL,
    exit_date timestamp with time zone NOT NULL,
    price_total numeric(10,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.parking OWNER TO postgres;

--
-- Name: parking_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.parking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.parking_id_seq OWNER TO postgres;

--
-- Name: parking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.parking_id_seq OWNED BY public.parking.id;


--
-- Name: rentals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rentals (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    company text,
    pickup_location text,
    return_location text,
    pickup_date timestamp with time zone,
    return_date timestamp with time zone,
    fuel_policy text,
    vehicle_type text,
    confirmation_code text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transport_type text DEFAULT 'Alquiler de Vehículo'::text NOT NULL,
    origin_station text,
    destination_station text,
    departure_date_time timestamp with time zone,
    arrival_date_time timestamp with time zone,
    transport_number text,
    seat_info text,
    meeting_point text
);


ALTER TABLE public.rentals OWNER TO postgres;

--
-- Name: rentals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rentals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rentals_id_seq OWNER TO postgres;

--
-- Name: rentals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rentals_id_seq OWNED BY public.rentals.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: trip_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trip_shares (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    user_id integer NOT NULL,
    permission text DEFAULT 'view'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.trip_shares OWNER TO postgres;

--
-- Name: trip_shares_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trip_shares_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trip_shares_id_seq OWNER TO postgres;

--
-- Name: trip_shares_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trip_shares_id_seq OWNED BY public.trip_shares.id;


--
-- Name: trips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trips (
    id integer NOT NULL,
    name text NOT NULL,
    destination text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'upcoming'::text NOT NULL,
    cover_image text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    share_token text,
    owner_id integer
);


ALTER TABLE public.trips OWNER TO postgres;

--
-- Name: trips_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trips_id_seq OWNER TO postgres;

--
-- Name: trips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trips_id_seq OWNED BY public.trips.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: accommodations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accommodations ALTER COLUMN id SET DEFAULT nextval('public.accommodations_id_seq'::regclass);


--
-- Name: baggage_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.baggage_items ALTER COLUMN id SET DEFAULT nextval('public.baggage_items_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: flights id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flights ALTER COLUMN id SET DEFAULT nextval('public.flights_id_seq'::regclass);


--
-- Name: itinerary_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itinerary_items ALTER COLUMN id SET DEFAULT nextval('public.itinerary_items_id_seq'::regclass);


--
-- Name: parking id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking ALTER COLUMN id SET DEFAULT nextval('public.parking_id_seq'::regclass);


--
-- Name: rentals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rentals ALTER COLUMN id SET DEFAULT nextval('public.rentals_id_seq'::regclass);


--
-- Name: trip_shares id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_shares ALTER COLUMN id SET DEFAULT nextval('public.trip_shares_id_seq'::regclass);


--
-- Name: trips id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips ALTER COLUMN id SET DEFAULT nextval('public.trips_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: accommodations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accommodations (id, trip_id, name, type, address, check_in, check_out, confirmation_code, contact_phone, notes, created_at, booking_platform) FROM stdin;
4	3	RIU Plaza New York Times Square	hotel	305 W 46th St, New York, NY 10036, Estados Unidos	2026-08-27 10:00:00+00	2026-09-04 13:00:00+00	WEB-1234	+16468641100	\N	2026-05-14 11:38:50.582541+00	Web del RIU
\.


--
-- Data for Name: baggage_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.baggage_items (id, trip_id, name, category, is_checked, is_last_minute, sort_order, created_at, user_id) FROM stdin;
1	3	Pasaporte	documents_money	t	f	0	2026-05-26 13:13:49.762958+00	2
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, trip_id, module, name, file_type, file_url, notes, uploaded_at) FROM stdin;
15	3	flights	itinerario_completo_ny_2026_v2.pdf	PDF	/api/uploads/itinerario-completo-ny-2026-v2-pcm4mht1.pdf	\N	2026-05-15 10:11:38.028033+00
16	3	itinerary	TOURDECONTRASTES.pdf	PDF	/api/uploads/tourdecontrastes-mo8k50du.pdf	activityId:8	2026-05-15 10:46:02.134049+00
20	3	flights	Booking.com_ Confirmación_Pisa.pdf	PDF	data:application/pdf;base64,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Umz8wX5iNz/pCmVuZHN0cmVhbQplbmRvYmoKMTcgMCBvYmoKPDwvVHlwZSAvQW5ub3QKL1N1YnR5cGUgL0xpbmsKL0YgNAovQm9yZGVyIFswIDAgMF0KL1JlY3QgWzgxLjc1IDExNy40MTk5ODMgMjA2LjI1IDEyNy45MTk5ODNdCi9BIDw8L1R5cGUgL0FjdGlvbgovUyAvVVJJCi9VUkkgKGh0dHBzOi8vd3d3LmJvb2tpbmcuY29tL3RydXN0LWFuZC1zYWZldHkvdHJhdmVsbGVycy5lcy5odG1sP2FpZD0zMDQxNDImbGFiZWw9Z2VuMTczbnItMTBDQUVvZ2dJNDZBZElNMWdFYUVhSUFRR1lBVE80QVJmSUFRellBUVBvQVFINEFRR0lBZ0dvQWdHNEF2dWEyOUFHd0FJQjBnSWtNV001TldNMU56QXRNamM0T0MwME56SXlMV0ZqTlRFdFpHWmxZMk0wWlRBMFkyTTQyQUlCNEFJQiZzaWQ9YTFmZDcyNzJjYjQyZDkwNzY2MTcwMzU1ZTI1MDM4N2ImdXRtX21lZGl1bT13ZWJfY3BhZ2UmdXRtX3NvdXJjZT1yY19saW5rI3NhZmV0eS10aXBzKT4+Pj4KZW5kb2JqCjE4IDAgb2JqCjw8L1R5cGUgL0Fubm90Ci9TdWJ0eXBlIC9MaW5rCi9GIDQKL0JvcmRlciBbMCAwIDBdCi9SZWN0IFs1NCAxMDYuMTY5OTgzIDIwNC43NSAxMTYuNjY5OTgzXQovRGVzdCAvPj4KZW5kb2JqCjE5IDAgb2JqCjw8L1R5cGUgL0Fubm90Ci9TdWJ0eXBlIC9MaW5rCi9GIDQKL0JvcmRlciBbMCAwIDBdCi9SZWN0IFsxMjUuMjUgNzAuMTY5OTgzIDI4MS4yNSA4MC42Njk5ODNdCi9BIDw8L1R5cGUgL0FjdGlvbgovUyAvVVJJCi9VUkkgKGh0dHBzOi8vd3d3LmJvb2tpbmcuY29tL3RydXN0LWFuZC1zYWZldHkvdHJhdmVsbGVycy5lcy5odG1sP2FpZD0zMDQxNDImbGFiZWw9Z2VuMTczbnItMTBDQUVvZ2dJNDZBZElNMWdFYUVhSUFRR1lBVE80QVJmSUFRellBUVBvQVFINEFRR0lBZ0dvQWdHNEF2dWEyOUFHd0FJQjBnSWtNV001TldN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ZW50IDI0IDAgUj4+CmVuZG9iagoyMSAwIG9iago8PC9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwvUHJvY1NldCBbL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSV0KL0V4dEdTdGF0ZSA8PC9HMyAzIDAgUj4+Ci9YT2JqZWN0IDw8L1gyMiAyMiAwIFI+PgovRm9udCA8PC9GNyA3IDAgUj4+Pj4KL01lZGlhQm94IFswIDAgNTk0Ljk1OTk2IDg0MS45MTk5OF0KL0NvbnRlbnRzIDIzIDAgUgovVGFicyAvUwovUGFyZW50IDI0IDAgUj4+CmVuZG9iagoyNCAwIG9iago8PC9UeXBlIC9QYWdlcwovQ291bnQgMgovS2lkcyBbMiAwIFIgMjEgMCBSXT4+CmVuZG9iagoyNSAwIG9iago8PC8gWzIgMCBSIC9YWVogMCA4NDEuOTE5OTggMF0+PgplbmRvYmoKMjkgMCBvYmoKPDwvVHlwZSAvU3RydWN0RWxlbQovUyAvTm9uU3RydWN0Ci9QIDI4IDAgUgovUGcgMiAwIFIKL0sgMD4+CmVuZG9iagozMCAwIG9iago8PC9UeXBlIC9TdHJ1Y3RFbGVtCi9TIC9Ob25TdHJ1Y3QKL1AgMjggMCBSCi9QZyAyIDAgUgovSyAxPj4KZW5kb2JqCjMxIDAgb2JqCjw8L1R5cGUgL1N0cnVjdEVsZW0KL1MgL05vblN0cnVjdAovUCAyOCAwIFIKL1BnIDIgMCBSCi9LIDI+PgplbmRvYmoKMjggMCBvYmoKPDwvVHlwZSAvU3RydWN0RWxlbQovUyAvTm9uU3RydWN0Ci9QIDI3IDAgUgovSyBbMjkgMCBSIDMwIDAgUiAzMSAwIFJdPj4KZW5kb2JqCjI3IDAgb2JqCjw8L1R5cGUgL1N0cnVjdEVsZW0KL1MgL0RvY3VtZW50Ci9MYW5nIChlcykKL1AgMjYgMCBSCi9LIDI4IDAgUj4+CmVuZG9iagozMiAwIG9iagpbMjkgMCBSIDMwIDAgUiAzMSAwIFJdCmVuZG9iagozMyAwIG9iago8PC9UeXBlIC9QYXJlbnRUcmVlCi9OdW1zIFswIDMyIDAgUl0+PgplbmRvYmoKMjYgMCBvYmoKPDwvVHlwZSAvU3RydWN0VHJlZVJvb3QK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ago8PC9UeXBlIC9Gb250RGVzY3JpcHRvcgovRm9udE5hbWUgL0FBQUFBQStTZWdvZVVJLUJvbGQKL0ZsYWdzIDQKL0FzY2VudCAxMDc5LjEwMTU2Ci9EZXNjZW50IDI1MC45NzY1NgovU3RlbVYgODMuOTg0Mzc1Ci9DYXBIZWlnaHQgNzAwLjE5NTMxCi9JdGFsaWNBbmdsZSAwCi9Gb250QkJveCBbLTU3Mi43NTM5MSAtNDMwLjY2NDA2IDE5OTkuMDIzNCAxMjk4LjMzOTg0XQovRm9udEZpbGUyIDM1IDAgUj4+CmVuZG9iagozNyAwIG9iago8PC9UeXBlIC9Gb250Ci9Gb250RGVzY3JpcHRvciAzNiAwIFIKL0Jhc2VGb250IC9BQUFBQUErU2Vnb2VVSS1Cb2xkCi9TdWJ0eXBlIC9DSURGb250VHlwZTIKL0NJRFRvR0lETWFwIC9JZGVudGl0eQovQ0lEU3lzdGVtSW5mbyA8PC9SZWdpc3RyeSAoQWRvYmUpCi9PcmRlcmluZyAoSWRlbnRpdHkpCi9TdXBwbGVtZW50IDA+PgovVyBbMCBbNjQ1LjUwNzgxIDAgMCAyNzUuODc4OTFdIDkgWzg0OS42MDkzOF0gMTUgMTcgMjcwLjk5NjA5IDE5IDI3IDU3NS4xOTUzMSAyOSBbMjcwLjk5NjA5XSAzNiBbNzAzLjEyNSA2NDEuMTEzMjggNjI0LjAyMzQ0IDczNy4zMDQ2OSA1MzIuMjI2NTYgNTIwLjAxOTUzIDcxMC45Mzc1IDc2Ni4xMTMyOCAzMTYuODk0NTMgNDQ1LjMxMjUgMCA1MTEuMjMwNDcgOTU3LjAzMTI1IDc5MC4wMzkwNiA3NTguMzAwNzggNjE0LjI1NzgxIDAgNjUyLjgzMjAzIDU2MC41NDY4OCA1ODUuOTM3NSA3MjMuMTQ0NTMgMCAxMDA0Ljg4MjgxXSA2OCBbNTM4LjA4NTk0IDYyMC4xMTcxOSA0NzkuOTgwNDcgNjE5LjE0MDYzIDU0MS4wMTU2MyAzODMuMzAwNzggNjE5LjE0MDYzIDYwMi4wNTA3OCAyODQuMTc5NjkgMCAwIDI4NC4xNzk2OSA5MTYuMDE1NjMgNjA0Ljk4MDQ3IDYxMS4zMjgxMyA2MjAuMTE3MTkgNjE5LjE0MDYzIDM5Ny45NDky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ZSAvQ0lERm9udFR5cGUyCi9DSURUb0dJRE1hcCAvSWRlbnRpdHkKL0NJRFN5c3RlbUluZm8gPDwvUmVnaXN0cnkgKEFkb2JlKQovT3JkZXJpbmcgKElkZW50aXR5KQovU3VwcGxlbWVudCAwPj4KL1cgWzAgWzY0NS41MDc4MSAwIDAgMjczLjkyNTc4XSA5IFs4MDAuMjkyOTcgMjI5Ljk4MDQ3IDMwMS43NTc4MSAzMDEuNzU3ODEgMCA2ODQuMDgyMDMgMjE2Ljc5Njg4IDM5OS45MDIzNCAyMTYuNzk2ODggMzg5LjY0ODQ0XSAxOSAyOCA1MzkuMDYyNSAyOSBbMjE2Ljc5Njg4XSAzNCBbNDQ4LjI0MjE5IDk1NS4wNzgxMyA2NDUuMDE5NTMgNTczLjI0MjE5IDYxOS4xNDA2MyA3MDEuMTcxODggNTA1Ljg1OTM4IDQ4OC4yODEyNSA2ODYuMDM1MTYgNzA5Ljk2MDk0IDI2Ni4xMTMyOCAwIDAgNDcwLjcwMzEzIDg5Ny45NDkyMiA3NDguMDQ2ODggNzUzLjkwNjI1IDU2MC4wNTg1OSAwIDU5OC4xNDQ1MyA1MzEuMjUgNTIzLjkyNTc4IDY4Ny4wMTE3MiA2MjEuMDkzNzUgOTM0LjA4MjAzIDAgNTUyLjczNDM4IDU3MC4zMTI1XSA2OCBbNTA4Ljc4OTA2IDU4Ny44OTA2MyA0NjEuOTE0MDYgNTg4Ljg2NzE5IDUyMi45NDkyMiAzMTIuOTg4MjggNTg4Ljg2NzE5IDU2NS45MTc5NyAyNDIuMTg3NSAyNDIuMTg3NSA0OTcuMDcwMzEgMjQyLjE4NzUgODYxLjMyODEzIDU2NS45MTc5NyA1ODUuOTM3NSA1ODcuODkwNjMgNTg4Ljg2NzE5IDM0Ny42NTYyNSA0MjQuMzE2NDEgMzM4Ljg2NzE5IDU2NS45MTc5NyA0NzkuMDAzOTEgNzIyLjY1NjI1IDQ1OC45ODQzOCA0ODMuODg2NzIgNDUyLjE0ODQ0XSAxMDUgWzUwOC43ODkwNl0gMTEyIFs1MjIuOTQ5MjIgMCAwIDAgMjQyLjE4NzUgMCAwIDAgNTY1LjkxNzk3IDU4NS45Mzc1XSAxMjYgWzU2NS45MTc5N10gMTMxIFszNzYuOTUzMTMgMCAwIDAgNDA2LjI1XSAxNjIg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MDAwMDAyNDAwNSAwMDAwMCBuIAowMDAwMDI0MzM4IDAwMDAwIG4gCjAwMDAwMjQ3OTggMDAwMDAgbiAKMDAwMDAyNTIyNyAwMDAwMCBuIAowMDAwMDI1NjgxIDAwMDAwIG4gCjAwMDAwMjU3OTggMDAwMDAgbiAKMDAwMDAyNjI5NCAwMDAwMCBuIAowMDAwMDMzMzIwIDAwMDAwIG4gCjAwMDAwMzIwMjEgMDAwMDAgbiAKMDAwMDAzMjM3OSAwMDAwMCBuIAowMDAwMDMzNTYwIDAwMDAwIG4gCjAwMDAwMzM2MjMgMDAwMDAgbiAKMDAwMDAzNDE2NyAwMDAwMCBuIAowMDAwMDMzOTkxIDAwMDAwIG4gCjAwMDAwMzM5MDMgMDAwMDAgbiAKMDAwMDAzMzY3MiAwMDAwMCBuIAowMDAwMDMzNzQ5IDAwMDAwIG4gCjAwMDAwMzM4MjYgMDAwMDAgbiAKMDAwMDAzNDA3MyAwMDAwMCBuIAowMDAwMDM0MTEyIDAwMDAwIG4gCjAwMDAwMzQyNTkgMDAwMDAgbiAKMDAwMDAzNDQ2OSAwMDAwMCBuIAowMDAwMDQ3NjkzIDAwMDAwIG4gCjAwMDAwNDc5MzkgMDAwMDAgbiAKMDAwMDA0ODc0NiAwMDAwMCBuIAowMDAwMDQ5MzAyIDAwMDAwIG4gCjAwMDAwNjgwODAgMDAwMDAgbiAKMDAwMDA2ODMyMSAwMDAwMCBuIAowMDAwMDY5NDE5IDAwMDAwIG4gCjAwMDAwNzAwMDggMDAwMDAgbiAKMDAwMDA3Nzc4OSAwMDAwMCBuIAowMDAwMDc4MDQwIDAwMDAwIG4gCjAwMDAwNzg0MDggMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDQ3Ci9Sb290IDM0IDAgUgovSW5mbyAxIDAgUj4+CnN0YXJ0eHJlZgo3ODkxMAolJUVPRgo=	flightId:4	2026-05-27 12:38:49.20084+00
\.


--
-- Data for Name: flights; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flights (id, trip_id, airline, flight_number, departure_airport, arrival_airport, departure_time, arrival_time, terminal, gate, seat, notes, created_at) FROM stdin;
4	3	IBERIA	IB1234	SEVILLA	MADRID	2026-08-27 05:40:00+00	2026-08-27 06:40:00+00	T1	25	24A		2026-05-14 10:22:02.71255+00
\.


--
-- Data for Name: itinerary_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.itinerary_items (id, trip_id, date, "time", title, description, location, category, created_at) FROM stdin;
9	3	2026-08-29	10:00	VUELTA POR NEW YORK	\N	Chelsea market	sightseeing	2026-05-14 11:21:11.7961+00
12	3	2026-08-29	09:00	Nueva actividad	\N	aqui al lado	sightseeing	2026-05-14 13:29:23.39541+00
8	3	2026-08-28	08:40	Tour de Contrastes	Tour por todo New york 	cafeteria de una esquina	other	2026-05-14 10:18:40.242634+00
\.


--
-- Data for Name: parking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.parking (id, trip_id, location, reservation_code, entry_date, exit_date, price_total, notes, created_at) FROM stdin;
2	3	Sevilla P2	AAA-2345	2026-08-27 05:06:00+00	2026-09-04 10:00:00+00	88.00	\N	2026-05-14 11:07:21.359098+00
\.


--
-- Data for Name: rentals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rentals (id, trip_id, company, pickup_location, return_location, pickup_date, return_date, fuel_policy, vehicle_type, confirmation_code, notes, created_at, transport_type, origin_station, destination_station, departure_date_time, arrival_date_time, transport_number, seat_info, meeting_point) FROM stdin;
2	3	Uber	\N	\N	\N	\N	\N	\N	12345678	\N	2026-05-27 11:40:06.160732+00	Traslado/Transfer	\N	Hotel RIU	2026-08-27 12:00:00+00	\N	\N	\N	Aeropuerto JFK
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (sid, sess, expire) FROM stdin;
-HUVkFfKzVR8LM9QyFC_CZjpQ7KSHeS2	{"cookie":{"originalMaxAge":604800000,"expires":"2026-09-29T17:21:36.312Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"username":"52557586X","role":"superadmin"}	2026-09-29 17:46:19
\.


--
-- Data for Name: trip_shares; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trip_shares (id, trip_id, user_id, permission, created_at) FROM stdin;
1	3	3	view	2026-05-17 12:35:56.849598+00
\.


--
-- Data for Name: trips; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trips (id, name, destination, start_date, end_date, status, cover_image, notes, created_at, share_token, owner_id) FROM stdin;
3	Viaje a Nueva York	Nueva York, EEUU	2026-08-27	2026-09-04	upcoming	https://media.istockphoto.com/id/1454217037/es/foto/estatua-de-la-libertad-y-horizonte-de-la-ciudad-de-nueva-york-con-el-distrito-financiero-de.jpg?s=612x612&w=0&k=20&c=1abPeg82iwNr0XbPc9eormGet3axsUdkaWgnXSM8e9g=	Viaje familiar	2026-05-14 09:38:02.197035+00	Kc66BC7vRRtn9kSP8yzfImBV	2
4	Olivia Rodrigo	Barcelona	2027-05-06	2027-05-09	upcoming	https://imagenes.elpais.com/resizer/v2/RIOWQQJPHHGWN7COEN3IR6L4IY.jpg?auth=ed060320bd1fe2427422309f80a1ad9f737d91250b60585f6b3587ff0a8888b2&width=1960&height=1470&focal=1250%2C610	Aun no sabemos qué fechas	2026-05-14 13:27:04.471914+00	\N	2
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, role, created_at) FROM stdin;
2	viajero1	$2a$12$iSEfyBg06OmUgVa/ZXj8X.FYjkQwp8tfUUwGhKOM4lNuBw/6edeXC	user	2026-05-17 11:20:30.447845+00
3	viajero2	$2a$12$xgKtxFk0WRM0sV.UskGkFOSvwWGG/NIjHYUEb9CGkhjmT5RIYYjoC	user	2026-05-17 12:33:29.578286+00
1	52557586X	$2a$12$UNXotKrZKvlbk/gnQ5yCQeb08xDhp3BK8RWkmVOrEkvzuKHkFOoQS	superadmin	2026-05-17 11:12:16.47716+00
\.


--
-- Name: accommodations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.accommodations_id_seq', 5, true);


--
-- Name: baggage_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.baggage_items_id_seq', 1, true);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.documents_id_seq', 20, true);


--
-- Name: flights_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.flights_id_seq', 4, true);


--
-- Name: itinerary_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.itinerary_items_id_seq', 12, true);


--
-- Name: parking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.parking_id_seq', 2, true);


--
-- Name: rentals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rentals_id_seq', 2, true);


--
-- Name: trip_shares_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trip_shares_id_seq', 1, true);


--
-- Name: trips_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trips_id_seq', 4, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: accommodations accommodations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accommodations
    ADD CONSTRAINT accommodations_pkey PRIMARY KEY (id);


--
-- Name: baggage_items baggage_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.baggage_items
    ADD CONSTRAINT baggage_items_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: flights flights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_pkey PRIMARY KEY (id);


--
-- Name: itinerary_items itinerary_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itinerary_items
    ADD CONSTRAINT itinerary_items_pkey PRIMARY KEY (id);


--
-- Name: parking parking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking
    ADD CONSTRAINT parking_pkey PRIMARY KEY (id);


--
-- Name: rentals rentals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rentals
    ADD CONSTRAINT rentals_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: trip_shares trip_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_shares
    ADD CONSTRAINT trip_shares_pkey PRIMARY KEY (id);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: trips trips_share_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_share_token_key UNIQUE (share_token);


--
-- Name: trip_shares uq_trip_user_share; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_shares
    ADD CONSTRAINT uq_trip_user_share UNIQUE (trip_id, user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: accommodations accommodations_trip_id_trips_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accommodations
    ADD CONSTRAINT accommodations_trip_id_trips_id_fk FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: baggage_items baggage_items_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.baggage_items
    ADD CONSTRAINT baggage_items_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: documents documents_trip_id_trips_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_trip_id_trips_id_fk FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: baggage_items fk_baggage_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.baggage_items
    ADD CONSTRAINT fk_baggage_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: flights flights_trip_id_trips_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_trip_id_trips_id_fk FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: itinerary_items itinerary_items_trip_id_trips_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itinerary_items
    ADD CONSTRAINT itinerary_items_trip_id_trips_id_fk FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: parking parking_trip_id_trips_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking
    ADD CONSTRAINT parking_trip_id_trips_id_fk FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: rentals rentals_trip_id_trips_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rentals
    ADD CONSTRAINT rentals_trip_id_trips_id_fk FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_shares trip_shares_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_shares
    ADD CONSTRAINT trip_shares_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_shares trip_shares_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trip_shares
    ADD CONSTRAINT trip_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: trips trips_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict C0aaL8UwZsTCyQfOIC03gHhSD1LFt1IW5reycDL5HePtREtEr8crMzZCK4p6wu0

