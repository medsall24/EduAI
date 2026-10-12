-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE');

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER,
    "passingScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quiz_tenantId_lessonId_idx" ON "Quiz"("tenantId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_tenantId_id_key" ON "Quiz"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_tenantId_lessonId_id_key" ON "Quiz"("tenantId", "lessonId", "id");

-- CreateIndex
CREATE INDEX "Question_tenantId_quizId_idx" ON "Question"("tenantId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_tenantId_id_key" ON "Question"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Question_tenantId_quizId_id_key" ON "Question"("tenantId", "quizId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Question_tenantId_quizId_position_key" ON "Question"("tenantId", "quizId", "position");

-- CreateIndex
CREATE INDEX "Option_tenantId_questionId_idx" ON "Option"("tenantId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Option_tenantId_id_key" ON "Option"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Option_tenantId_questionId_id_key" ON "Option"("tenantId", "questionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Option_tenantId_questionId_position_key" ON "Option"("tenantId", "questionId", "position");

-- CreateIndex
CREATE INDEX "QuizAttempt_tenantId_quizId_userId_idx" ON "QuizAttempt"("tenantId", "quizId", "userId");

-- CreateIndex
CREATE INDEX "QuizAttempt_tenantId_userId_idx" ON "QuizAttempt"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_tenantId_id_key" ON "QuizAttempt"("tenantId", "id");

-- CreateIndex
CREATE INDEX "QuizAnswer_tenantId_attemptId_idx" ON "QuizAnswer"("tenantId", "attemptId");

-- CreateIndex
CREATE INDEX "QuizAnswer_tenantId_questionId_idx" ON "QuizAnswer"("tenantId", "questionId");

-- CreateIndex
CREATE INDEX "QuizAnswer_tenantId_optionId_idx" ON "QuizAnswer"("tenantId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_tenantId_id_key" ON "QuizAnswer"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_tenantId_attemptId_questionId_optionId_key" ON "QuizAnswer"("tenantId", "attemptId", "questionId", "optionId");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_tenantId_lessonId_fkey" FOREIGN KEY ("tenantId", "lessonId") REFERENCES "Lesson"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_tenantId_quizId_fkey" FOREIGN KEY ("tenantId", "quizId") REFERENCES "Quiz"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_tenantId_questionId_fkey" FOREIGN KEY ("tenantId", "questionId") REFERENCES "Question"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_tenantId_quizId_fkey" FOREIGN KEY ("tenantId", "quizId") REFERENCES "Quiz"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_tenantId_attemptId_fkey" FOREIGN KEY ("tenantId", "attemptId") REFERENCES "QuizAttempt"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_tenantId_questionId_fkey" FOREIGN KEY ("tenantId", "questionId") REFERENCES "Question"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_tenantId_optionId_fkey" FOREIGN KEY ("tenantId", "optionId") REFERENCES "Option"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
