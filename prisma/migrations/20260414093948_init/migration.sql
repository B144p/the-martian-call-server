-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('queued', 'transmitting', 'sent', 'interrupted');

-- CreateTable
CREATE TABLE "continents" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "pusher_channel" TEXT NOT NULL,
    "map_center_lat" DOUBLE PRECISION NOT NULL,
    "map_center_lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "continents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "google_id" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "continent_id" TEXT NOT NULL,
    "antenna_direction" INTEGER NOT NULL DEFAULT 0,
    "is_transmitting" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_continent" TEXT NOT NULL,
    "sender_direction" INTEGER NOT NULL,
    "target_continents" TEXT[],
    "content" TEXT NOT NULL,
    "hex_sequence" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'queued',
    "chars_sent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transmission_started_at" TIMESTAMP(3),
    "transmission_ends_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_log" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "sender_continent" TEXT NOT NULL,
    "sender_direction" INTEGER NOT NULL,
    "transmitted_at" TIMESTAMP(3) NOT NULL,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "signal_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_continent_id_idx" ON "users"("continent_id");

-- CreateIndex
CREATE INDEX "users_last_seen_at_idx" ON "users"("last_seen_at");

-- CreateIndex
CREATE INDEX "messages_status_transmission_ends_at_idx" ON "messages"("status", "transmission_ends_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "signal_log_recipient_id_read_at_idx" ON "signal_log"("recipient_id", "read_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_continent_id_fkey" FOREIGN KEY ("continent_id") REFERENCES "continents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal_log" ADD CONSTRAINT "signal_log_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal_log" ADD CONSTRAINT "signal_log_sender_continent_fkey" FOREIGN KEY ("sender_continent") REFERENCES "continents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
