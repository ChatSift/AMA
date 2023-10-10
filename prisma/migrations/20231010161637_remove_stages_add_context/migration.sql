-- AlterTable
ALTER TABLE "Ama" ALTER COLUMN "stageOnly" SET DEFAULT false;

-- AlterTable
ALTER TABLE "AmaQuestion" ADD COLUMN     "answerMessageId" TEXT;
