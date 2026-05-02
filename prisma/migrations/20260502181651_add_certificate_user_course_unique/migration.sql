-- AkademiCertificate: aynı (userId, courseId) için tek sertifika garantisi.
-- courseId NULLABLE — PostgreSQL multi-column UNIQUE NULL'larda permissive,
-- yani aynı user'a kursa-bağlı-olmayan birden fazla cert verilebilir.

CREATE UNIQUE INDEX "akademi_certificates_user_course_unique" ON "akademi_certificates"("userId", "courseId");
