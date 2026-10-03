// Toplu dilim işleminde tek seferde en fazla atama — sunucudaki TOPLU_DILIM_ATAMA_LIMITI ile AYNI olmalı
// (sunucu modülü prisma çektiği için istemciye değer olarak alınamaz; eşitlik testle sabit).
export const TOPLU_DILIM_ATAMA_LIMITI = 200
