-- ExamQuestion: MATRIX ve FILE_UPLOAD soru tipleri için config alanları
ALTER TABLE "exam_questions" ADD COLUMN "matrixConfig" JSONB;
ALTER TABLE "exam_questions" ADD COLUMN "allowedFileTypes" TEXT;
