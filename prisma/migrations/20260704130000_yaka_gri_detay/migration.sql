-- Yaka Aşama 1: GRI yaka değeri + YakaDetayi enum (yönetici kademesi) + Personnel.yakaDetayi (nullable).
-- Additive: DROP yok. Mevcut kayıtlar etkilenmez (yakaDetayi NULL default).
-- Not: ALTER TYPE ADD VALUE PG12+ transaction içinde çalışır; 'GRI' bu migration'da KULLANILMADIĞI
-- için aynı-tx kısıtı tetiklenmez.

-- AlterEnum
ALTER TYPE "YakaRengi" ADD VALUE 'GRI';

-- CreateEnum
CREATE TYPE "YakaDetayi" AS ENUM ('BEYAZ', 'BEYAZ_GMUDUR_YRD', 'BEYAZ_GENEL_MDR', 'BEYAZ_MUDUR', 'BEYAZ_MUDUR_YRD', 'BEYAZ_MUHENDIS', 'BEYAZ_MUHENDIS_MDRYRD', 'BEYAZ_MUHENDIS_MUDUR', 'BEYAZ_SORUMLU_TEKNIKER', 'BEYAZ_TEKNIKER', 'GRI', 'GRI_VEKALET', 'MAVI');

-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN "yakaDetayi" "YakaDetayi";
