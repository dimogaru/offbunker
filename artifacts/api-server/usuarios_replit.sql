--
-- PostgreSQL database dump
--

\restrict n9zDHBy5i6J7wtfMmnc0Fcf9Awyye7mNT0pkNXefTmgrkq1rSjRnY8ZcD2pjSns

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

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, role, created_at) FROM stdin;
2	viajero1	$2a$12$iSEfyBg06OmUgVa/ZXj8X.FYjkQwp8tfUUwGhKOM4lNuBw/6edeXC	user	2026-05-17 11:20:30.447845+00
3	viajero2	$2a$12$xgKtxFk0WRM0sV.UskGkFOSvwWGG/NIjHYUEb9CGkhjmT5RIYYjoC	user	2026-05-17 12:33:29.578286+00
1	52557586X	$2a$12$UNXotKrZKvlbk/gnQ5yCQeb08xDhp3BK8RWkmVOrEkvzuKHkFOoQS	superadmin	2026-05-17 11:12:16.47716+00
\.


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- PostgreSQL database dump complete
--

\unrestrict n9zDHBy5i6J7wtfMmnc0Fcf9Awyye7mNT0pkNXefTmgrkq1rSjRnY8ZcD2pjSns

