-- Elif aşama modeli — JobApplicationStatus'a additive değerler.
-- Mevcut değerler/veri DEĞİŞMEZ; yalnız yeni aşamalar eklenir (ileriye dönük).
-- Not: ADD VALUE kullanımı aynı transaction'da değer KULLANMADIĞI için güvenli.
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'SINAV';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'TELEFON_MULAKATI';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'IK_MULAKATI';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'TEKNIK_MULAKAT';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'TEKLIF';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'TEKLIF_KABUL';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'ISE_BASLADI';
