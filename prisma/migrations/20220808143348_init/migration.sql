-- CreateTable
CREATE TABLE "Ama" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "modQueue" TEXT NOT NULL,
    "flaggedQueue" TEXT NOT NULL,
    "guestQueue" TEXT NOT NULL,
    "answersChannel" TEXT NOT NULL,
    "ended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Ama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmaQuestion" (
    "id" SERIAL NOT NULL,
    "amaId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "AmaQuestion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AmaQuestion" ADD CONSTRAINT "AmaQuestion_amaId_fkey" FOREIGN KEY ("amaId") REFERENCES "Ama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
