-- CreateTable
CREATE TABLE "Ama" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "modQueue" TEXT,
    "flaggedQueue" TEXT,
    "guestQueue" TEXT,
    "answersChannel" TEXT NOT NULL,
    "promptChannelId" TEXT NOT NULL,
    "promptMessageId" TEXT NOT NULL,
    "stageOnly" BOOLEAN NOT NULL,
    "ended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Ama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmaQuestion" (
    "id" SERIAL NOT NULL,
    "amaId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "AmaQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ama_promptMessageId_key" ON "Ama"("promptMessageId");

-- AddForeignKey
ALTER TABLE "AmaQuestion" ADD CONSTRAINT "AmaQuestion_amaId_fkey" FOREIGN KEY ("amaId") REFERENCES "Ama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
