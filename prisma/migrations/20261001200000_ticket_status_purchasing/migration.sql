-- IT Ticket: "Satınalma Sürecinde" durumu (Melih kararı 01.10.2026).
-- SLA saati bu durumda DURUR (bkz. src/lib/sla/ihlal.ts · DURAKLATAN_DURUMLAR).
--
-- ADDITIVE. ALTER TYPE ... ADD VALUE kendi transaction'ında çalışmalı —
-- psql'e --single-transaction ile VERİLMEZ.
ALTER TYPE "TicketStatus" ADD VALUE 'PURCHASING';
